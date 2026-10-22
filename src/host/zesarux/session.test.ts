import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import type { ZesaruxProcess } from "./process.ts";
import { Zrcp } from "./zrcp.ts";
import { codeCoverageAddresses, firedStop, keysOf, modelOfMachineName, parseRegisters, SPECTRUM_KEYS, visualmemAddresses, ZesaruxSession } from "./session.ts";

// The get-registers answer of ZEsarUX 13.0 after set-register IX=04d2H.
const REGISTERS = "PC=11dc SP=ffff AF=3fa7 BC=00ff HL=b33a DE=ffff IX=04d2 IY=ffff AF'=ffff BC'=ffff HL'=0000 DE'=ffff I=3f R=26  F=S-5--PNC F'=SZ5H3PNC MEMPTR=11dc IM0 IFF-- VPS: 0 MMU=00000000000000000000000000000000";

test("the registers of get-registers, with the alternate set apart from the main set", () => {
  assert.deepEqual(parseRegisters(REGISTERS), {
    pc: 0x11dc,
    sp: 0xffff,
    af: 0x3fa7,
    bc: 0x00ff,
    de: 0xffff,
    hl: 0xb33a,
    ix: 0x04d2,
    iy: 0xffff,
    af2: 0xffff,
    bc2: 0xffff,
    de2: 0xffff,
    hl2: 0x0000,
    i: 0x3f,
    r: 0x26,
    im: 0,
    iff1: false,
    iff2: false,
  });
  const running = parseRegisters(REGISTERS.replace("IM0 IFF--", "IM1 IFF12"));
  assert.deepEqual([running.im, running.iff1, running.iff2], [1, true, true]);
});

test("an answer without a register is refused, not read as 0", () => {
  assert.throws(() => parseRegisters("PC=8000 SP=ff00"), (error) => error instanceof WireFailure && error.code === "operation-failed" && /no AF register/.test(error.message));
});

test("a visual memory dump gives each address with a count, one value per address from the first", () => {
  assert.deepEqual(visualmemAddresses("11DCH 1\n11DEH 1\n"), [0x11dc, 0x11de]);
  assert.deepEqual(visualmemAddresses("8000H 2 0 1\n\nC000H 0\n"), [0x8000, 0x8002]);
});

test("text maps to the keys of the Spectrum keyboard, with CAPS SHIFT and SYMBOL SHIFT", () => {
  assert.equal(SPECTRUM_KEYS.length, 40);
  assert.deepEqual(keysOf("a"), ["a"]);
  assert.deepEqual(keysOf("7"), ["7"]);
  assert.deepEqual(keysOf("A"), ["caps", "a"]);
  assert.deepEqual(keysOf(" "), ["space"]);
  assert.deepEqual(keysOf("\n"), ["enter"]);
  assert.deepEqual(keysOf('"'), ["symbol", "p"]);
  assert.deepEqual(keysOf("$"), ["symbol", "4"]);
  for (const char of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\",.:;+-=*/?()$!<>_#%&'@^") {
    for (const key of keysOf(char)) assert.ok(SPECTRUM_KEYS.includes(key), `${JSON.stringify(char)} gives ${key}`);
  }
  assert.throws(() => keysOf("~"), (error) => error instanceof WireFailure && error.code === "invalid-input");
});

test("a fired PC breakpoint is read by its address: ZEsarUX writes it in capitals and with no leading zeros", () => {
  const points = [
    { id: 1, kind: "breakpoint" as const, start: 0xec67, end: 0xec67, enabled: true },
    { id: 2, kind: "breakpoint" as const, start: 0x0038, end: 0x0038, enabled: true },
    { id: 3, kind: "watchpoint" as const, start: 0x9000, end: 0x9002, access: "write" as const, enabled: true },
  ];
  assert.deepEqual(firedStop("PC=EC67H", points, undefined), { reason: "breakpoint", pointId: 1 });
  assert.deepEqual(firedStop("PC=38H", points, undefined), { reason: "breakpoint", pointId: 2 });
  // The target of run_until wins over a breakpoint at the same address.
  assert.deepEqual(firedStop("PC=E200H", points, 0xe200), { reason: "target" });
  assert.deepEqual(firedStop("PC=EC67H", points, 0xec67), { reason: "target" });
  assert.deepEqual(firedStop("TSTATESP>=34944000", points, 0xe200), { reason: "frames" });
  assert.deepEqual(firedStop("Memory Breakpoint Write Address: 9001H Value: 01H", points, undefined), { reason: "watchpoint", pointId: 3 });
  assert.deepEqual(firedStop(undefined, points, undefined), {});
});

test("the code coverage answer gives the address of each executed instruction", () => {
  assert.deepEqual(codeCoverageAddresses("8102 8105 8107"), [0x8102, 0x8105, 0x8107]);
  assert.deepEqual(codeCoverageAddresses("38 39\nEC5B\n"), [0x38, 0x39, 0xec5b]);
  assert.deepEqual(codeCoverageAddresses(""), []);
  // After a load the coverage is off: the answer is an error, not addresses such as "be".
  assert.throws(() => codeCoverageAddresses("Error. It's not enabled"), (error) => error instanceof WireFailure && error.code === "operation-failed");
});

test("the model of a machine that ZEsarUX names: the 48K and the 128K with their ROM variants, no other machine", () => {
  for (const name of ["ZX Spectrum 48k", "ZX Spectrum+ 48k", "ZX Spectrum+ 48k (Spanish)"]) assert.equal(modelOfMachineName(name), "48k", name);
  for (const name of ["ZX Spectrum+ 128k", "ZX Spectrum+ 128k (Spanish)", "ZX Spectrum +2", "ZX Spectrum +2 (French)", "ZX Spectrum +2 (Spanish)"]) assert.equal(modelOfMachineName(name), "128k", name);
  for (const name of ["ZX Spectrum 16k", "ZX Spectrum +2A (ROM v4.0)", "ZX Spectrum +3 (ROM v4.0)", "Pentagon", "TC2048", "TK90X", "Inves Spectrum+", "ZX81", ""]) assert.equal(modelOfMachineName(name), undefined, name);
});

const SET_MACHINE: Record<string, string> = { "48k": "ZX Spectrum 48k", "128k": "ZX Spectrum+ 128k" };

/**
 * A stand-in ZEsarUX on a ZRCP port: smartload runs the machine that the file
 * names as text, set-machine the machine of its name. Each command is kept.
 */
async function standInZesarux(machine: string): Promise<{ zesarux: ZesaruxProcess; commands: string[] }> {
  const commands: string[] = [];
  let frames: string | undefined;
  const answer = (line: string): string => {
    const [command = "", ...rest] = line.split(" ");
    const argument = rest.join(" ");
    if (command === "get-current-machine") return machine;
    if (command === "smartload") machine = readFileSync(argument, "latin1");
    if (command === "set-machine") machine = SET_MACHINE[argument] ?? machine;
    if (command === "get-registers") return REGISTERS;
    if (command === "evaluate") return "0";
    if (command === "get-io-ports") return "Spectrum FE port: 07\nSpectrum 7FFD port: 10\nSelected register: 0";
    if (line.startsWith("set-breakpoint 100")) frames = rest[1];
    if (command === "run") return `Running until a breakpoint, key press or data sent, menu opening or other event\n${REGISTERS}${frames === undefined ? "" : `\nBreakpoint fired: ${frames}`}`;
    return "";
  };
  const server: Server = createServer((socket) => {
    socket.setEncoding("latin1");
    socket.on("error", () => {});
    socket.write("Welcome to ZEsarUX remote command protocol\ncommand> ");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        // A line feed alone ends a run, which this stand-in already ended.
        if (line === "") continue;
        commands.push(line);
        socket.write(`${answer(line)}\ncommand@cpu-step> `);
      }
    });
  });
  const port = await new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port)));
  const zrcp = await Zrcp.connect(port);
  const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-zesarux-test-"));
  const zesarux: ZesaruxProcess = {
    pid: 0,
    zrcp,
    version: "13.0",
    scratch,
    exited: new Promise(() => {}),
    stop: async () => {
      zrcp.close();
      await new Promise((resolve) => server.close(resolve));
      rmSync(scratch, { recursive: true, force: true });
    },
  };
  return { zesarux, commands };
}

test("the session takes its model from the machine that a load gives: a 128K snapshot in a 48K session runs 128K frames", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k");
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    assert.equal(((await session.handle("status", {})) as { model: string }).model, "48k");
    const started = (await session.handle("autostart", { type: "z80" }, [Buffer.from("ZX Spectrum+ 128k")])) as { state: string; model: string };
    assert.deepEqual(started, { state: "running", model: "128k" });
    await session.handle("execution", { action: "pause" });
    const ula = (await session.handle("ula", {})) as { model: string; frameTstates: number; pagedBank?: number };
    assert.deepEqual([ula.model, ula.frameTstates, ula.pagedBank], ["128k", 70_908, 0]);
    const ran = (await session.handle("execution", { action: "advance-frames", count: 2 })) as { stopReason?: string };
    assert.equal(ran.stopReason, "frames");
    assert.ok(commands.includes(`set-breakpoint 100 TSTATESP>=${2 * 70_908}`), commands.join("\n"));
    assert.ok(!commands.some((command) => command.startsWith("set-machine")), "a served machine stays as it loaded");
  } finally {
    await session.close();
  }
});

test("a load of a machine that the session does not serve is refused, and the session runs its model again and stays usable", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k");
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await assert.rejects(
      session.handle("autostart", { type: "z80" }, [Buffer.from("ZX81")]),
      (error) => error instanceof WireFailure && error.code === "invalid-input" && /The file is for the ZX81\. .*ZX Spectrum 48K and the ZX Spectrum 128K\. The emulator is a ZX Spectrum 48K again, after a reset\./.test(error.message),
    );
    assert.ok(commands.includes("set-machine 48k"), commands.join("\n"));
    assert.deepEqual(await session.handle("status", {}), { state: "stopped", model: "48k", pc: 0x11dc });
    assert.equal(((await session.handle("registersGet", {})) as { pc: number }).pc, 0x11dc);
    const started = (await session.handle("autostart", { type: "z80" }, [Buffer.from("ZX Spectrum +2")])) as { model: string };
    assert.equal(started.model, "128k");
  } finally {
    await session.close();
  }
});
