// Real-VICE checks for the launch contract (src/host/vice/process.ts) and the
// binary-monitor client (src/host/vice/binary-monitor.ts).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import {
  Command,
  decodeBanks,
  decodeMemory,
  decodeRegisters,
  decodeRegistersAvailable,
  memoryGetBody,
  Memspace,
  type MonitorResponse,
} from "../../../src/host/vice/binary-monitor.ts";
import { launchVice } from "../../../src/host/vice/process.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The scratch directory VICE was started in, read from its argv (Linux only). */
function scratchDirOf(pid: number): string | undefined {
  try {
    const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    const config = argv[argv.indexOf("-config") + 1];
    return config?.replace(/\/vicerc$/, "");
  } catch {
    return undefined;
  }
}

test("VICE launches ready, serves the binary monitor and stops completely", { skip: liveSkip, timeout: 60_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard: "pal", supervisor, env: liveEnv(), log: liveLog });
  try {
    const events: MonitorResponse[] = [];
    vice.monitor.onEvent((event) => events.push(event));
    // A command while running stops the machine: register event, then a stopped event.
    const pong = await vice.monitor.request(Command.ping);
    assert.equal(pong.type, Command.ping);
    // The resumed event from launch may land after launchVice returns; it comes first if at all.
    assert.deepEqual(
      events.map((event) => event.type).filter((type) => type !== 0x63),
      [0x31, 0x62],
    );

    const available = decodeRegistersAvailable((await vice.monitor.request(Command.registersAvailable, Buffer.from([Memspace.main]))).body);
    for (const name of ["PC", "A", "X", "Y", "SP", "FL"]) {
      assert.ok(available.some((register) => register.name === name), `register ${name} is missing`);
    }
    const banks = decodeBanks((await vice.monitor.request(Command.banksAvailable)).body).map((bank) => bank.name);
    assert.ok(banks.includes("cpu") && banks.includes("ram"));

    // The KERNAL ROM at $e000 is the same on every stock C64.
    const kernal = decodeMemory(
      (await vice.monitor.request(Command.memoryGet, memoryGetBody({ start: 0xe000, end: 0xe003, memspace: Memspace.main, bank: 0 }))).body,
    );
    assert.equal(kernal.toString("hex"), "8556200f");

    // Drive 8 is a 1541 whose DOS ROM is readable.
    const dos = decodeMemory(
      (await vice.monitor.request(Command.memoryGet, memoryGetBody({ start: 0xc000, end: 0xc003, memspace: Memspace.drive8, bank: 0 }))).body,
    );
    assert.notEqual(dos.toString("hex"), "00000000", "drive 8 has no ROM");

    const registers = decodeRegisters((await vice.monitor.request(Command.registersGet, Buffer.from([Memspace.main]))).body);
    assert.ok(registers.length >= 6);

    // exit resumes and reports it.
    events.length = 0;
    await vice.monitor.request(Command.exit);
    await waitFor(() => events.some((event) => event.type === 0x63));
  } finally {
    const scratch = scratchDirOf(vice.pid);
    await vice.stop();
    if (scratch !== undefined) assert.ok(!existsSync(scratch), "scratch directory was left behind");
  }
  const status = await vice.exited;
  assert.ok(status.signal !== null || status.code !== null);
  assert.equal(supervisor.size, 0);
});

test("an NTSC session launches", { skip: liveSkip, timeout: 60_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard: "ntsc", supervisor, env: liveEnv(), log: liveLog });
  try {
    assert.equal((await vice.monitor.request(Command.ping)).type, Command.ping);
  } finally {
    await vice.stop();
  }
});

test("a VICE killed from outside is seen as exited", { skip: liveSkip, timeout: 60_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard: "pal", supervisor, env: liveEnv(), log: liveLog });
  const pid = vice.pid;
  process.kill(pid, "SIGKILL");
  await vice.exited;
  assert.ok((await vice.monitor.closed) instanceof Error);
  assert.ok(!isAlive(pid));
  await vice.stop();
});

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("the text monitor answers beside the binary one and both act on one machine", { skip: liveSkip, timeout: 60_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const vice = await launchVice({ videoStandard: "pal", supervisor, env: liveEnv(), log: liveLog });
  try {
    const events: MonitorResponse[] = [];
    vice.monitor.onEvent((event) => events.push(event));

    // A text command while running stops the machine, as the binary events show.
    assert.equal(await vice.text.command("warp"), "Warp mode is off.");
    await waitFor(() => events.some((event) => event.type === 0x62));
    assert.equal(await vice.text.command("warp on"), "");
    assert.equal(await vice.text.command("warp"), "Warp mode is on.");
    assert.equal(await vice.text.command("warp off"), "");

    // Text commands work while the binary side holds the machine, and binary exit resumes it.
    await vice.monitor.request(Command.ping);
    assert.match(await vice.text.command("dev 8:"), /Disk8/);
    assert.match(await vice.text.command("dev c:"), /Computer/);
    events.length = 0;
    await vice.monitor.request(Command.exit);
    await waitFor(() => events.some((event) => event.type === 0x63));
  } finally {
    await vice.stop();
  }
});
