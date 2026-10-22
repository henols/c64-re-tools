import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { WireFailure } from "../../protocol/messages.ts";
import type { ZesaruxProcess } from "./process.ts";
import { Zrcp } from "./zrcp.ts";
import { ayOfIoPorts, codeCoverageAddresses, firedStop, historyAddresses, historyOpcode, keysOf, modelOfMachineName, parseRegisters, pcRuns, SPECTRUM_KEYS, visualmemAddresses, ZesaruxSession } from "./session.ts";

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

/** A TAP file of one data block that holds the text: the stand-in ZEsarUX runs the machine that the text names. */
function tapeOf(text: string): Buffer {
  const block = [0xff, ...Buffer.from(text, "latin1")];
  block.push(block.reduce((xor, byte) => xor ^ byte, 0));
  return Buffer.from([block.length & 0xff, block.length >> 8, ...block]);
}

/**
 * A stand-in ZEsarUX on a ZRCP port: smartload runs the machine that the
 * text in its tape names (an empty text keeps the machine, as a real tape
 * does), set-machine the machine of its name. A run ends at the frame
 * breakpoint, a few t-states after it, or at the next stop in `fires`. A fire
 * that ends in " (halt)" stops the CPU in a HALT wait: then snapshot-save
 * writes a .zsf with the HALT state. A step adds the next entry of `steps` to
 * the CPU history and its address to the code coverage; a run adds the
 * addresses of `ran` to the code coverage only, and the next entries of
 * `runs` to the CPU history. The history keeps at most `historyMax`
 * entries. Each command is kept.
 */
async function standInZesarux(
  machine: string,
  options: { fires?: string[]; overshoot?: number; ioPorts?: string; history?: string[]; steps?: string[]; ran?: string[]; runs?: string[][]; historyMax?: number; memory?: Record<number, number> } = {},
): Promise<{ zesarux: ZesaruxProcess; commands: string[] }> {
  // The CPU history, the most recent entry first: a step adds one entry.
  const historyMax = options.historyMax ?? 1_000_000;
  const history = [...(options.history ?? [])];
  const record = (entries: string[]) => {
    history.unshift(...entries);
    history.length = Math.min(history.length, historyMax);
  };
  const runs = [...(options.runs ?? [])];
  let halted = false;
  const steps = [...(options.steps ?? [])];
  const coverage = new Set<string>();
  const commands: string[] = [];
  const fires = [...(options.fires ?? [])];
  let frames: string | undefined;
  let partial = 0;
  const answer = (line: string): string => {
    const [command = "", ...rest] = line.split(" ");
    const argument = rest.join(" ");
    if (command === "get-current-machine") return machine;
    if (command === "smartload" && argument.endsWith(".tap")) {
      const tape = readFileSync(argument);
      machine = tape.subarray(3, tape.length - 1).toString("latin1") || machine;
    }
    if (command === "set-machine") machine = SET_MACHINE[argument] ?? machine;
    if (command === "get-registers") return REGISTERS;
    if (command === "read-memory") {
      const start = Number.parseInt(rest[0]!, 16);
      return Array.from({ length: Number(rest[1]) }, (_, offset) => (options.memory?.[start + offset] ?? 0).toString(16).padStart(2, "0")).join("");
    }
    if (command === "evaluate") return String(partial);
    if (command === "reset-tstates-partial") partial = 0;
    if (command === "cpu-step") {
      partial += 4;
      const entry = steps.shift() ?? `PC=a000 R=${history.length}`;
      record([entry]);
      coverage.add(entry.slice(3, 7));
      return REGISTERS;
    }
    if (command === "cpu-history" && rest[0] === "get-size") return String(history.length);
    if (command === "cpu-history" && rest[0] === "get-max-size") return String(historyMax);
    if (command === "cpu-history" && rest[0] === "get-pc") return history.slice(Number(rest[1]), Number(rest[1]) + Number(rest[2])).map((entry) => entry.slice(3, 7)).join(" ");
    if (command === "cpu-history" && rest[0] === "get-extended") return history[Number(rest[1])] ?? "";
    if (command === "cpu-code-coverage" && rest[0] === "get") return [...coverage].join(" ");
    if (command === "cpu-code-coverage" && rest[0] === "clear") coverage.clear();
    if (command === "get-io-ports") return options.ioPorts ?? "Spectrum FE port: 07\nSpectrum 7FFD port: 10\nSelected register: 0";
    if (line.startsWith("set-breakpoint 100")) frames = rest[1];
    if (command === "snapshot-save") writeFileSync(argument, Buffer.from([...Buffer.from("ZSF ZEsarUX Snapshot File.", "latin1"), 43, 0, 1, 0, 0, 0, halted ? 1 : 0]));
    if (command === "run") {
      for (const address of options.ran ?? []) coverage.add(address);
      record(runs.shift() ?? []);
      const next = fires.shift();
      halted = next?.endsWith(" (halt)") === true;
      const fired = next?.replace(" (halt)", "") ?? frames;
      if (fired === frames && frames !== undefined) partial = Number(frames.split(">=")[1]) + (options.overshoot ?? 0);
      return `Running until a breakpoint, key press or data sent, menu opening or other event\n${REGISTERS}${fired === undefined ? "" : `\nBreakpoint fired: ${fired}`}`;
    }
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
    const started = (await session.handle("autostart", { type: "tap" }, [tapeOf("ZX Spectrum+ 128k")])) as { state: string; model: string };
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
      session.handle("autostart", { type: "tap" }, [tapeOf("ZX81")]),
      (error) => error instanceof WireFailure && error.code === "invalid-input" && /The file is for the ZX81\. .*ZX Spectrum 48K and the ZX Spectrum 128K\. The emulator is a ZX Spectrum 48K again, after a reset\./.test(error.message),
    );
    assert.ok(commands.includes("set-machine 48k"), commands.join("\n"));
    assert.deepEqual(await session.handle("status", {}), { state: "stopped", model: "48k", pc: 0x11dc });
    assert.equal(((await session.handle("registersGet", {})) as { pc: number }).pc, 0x11dc);
    const started = (await session.handle("autostart", { type: "tap" }, [tapeOf("ZX Spectrum +2")])) as { model: string };
    assert.equal(started.model, "128k");
  } finally {
    await session.close();
  }
});

// The AY part of get-io-ports on a 128K (ZEsarUX 13.0).
const AY_PORTS = ["ULA Data Bus value: FFH", "Spectrum FE port: 07", "Spectrum 7FFD port: 13", "", "AY-3-8912 chip 0:", "", "Selected register: 8", ...Array.from({ length: 16 }, (_, index) => `${index.toString(16).toUpperCase().padStart(2, "0")}:  ${index === 7 ? "38" : index === 8 ? "0F" : "FF"}`)].join("\n");

test("the AY registers come from the AY part of get-io-ports; without that part they are unknown, not 0", () => {
  const ay = ayOfIoPorts(AY_PORTS);
  assert.equal(ay.selected, 8);
  assert.deepEqual([ay.registers.length, ay.registers[7], ay.registers[8], ay.registers[0]], [16, 0x38, 0x0f, 0xff]);
  assert.throws(() => ayOfIoPorts("ULA Data Bus value: FFH\nSpectrum FE port: 07\nSpectrum 7FFD port: 13"), (error) => error instanceof WireFailure && error.code === "operation-failed" && /no AY chip/.test(error.message));
});

test("ay on the 48K refuses with invalid-input and names the model; on the 128K it gives the registers", async () => {
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { ioPorts: AY_PORTS });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await assert.rejects(session.handle("ay", {}), (error) => error instanceof WireFailure && error.code === "invalid-input" && /machine is a 48K now/.test(error.message));
    await session.handle("autostart", { type: "tap" }, [tapeOf("ZX Spectrum+ 128k")]);
    await session.handle("execution", { action: "pause" });
    assert.equal(((await session.handle("ay", {})) as { registers: number[] }).registers[7], 0x38);
  } finally {
    await session.close();
  }
});

test("runs of frames one after the other end where one run of all the frames ends: the late t-states of a stop do not add up", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k", { overshoot: 5 });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("execution", { action: "advance-frames", count: 1 });
    await session.handle("execution", { action: "advance-frames", count: 11 });
    await session.handle("execution", { action: "advance-frames", count: 2 });
    const runs = commands.filter((command) => command.startsWith("set-breakpoint 100 "));
    assert.deepEqual(runs, ["set-breakpoint 100 TSTATESP>=69888", `set-breakpoint 100 TSTATESP>=${11 * 69_888 - 5}`, `set-breakpoint 100 TSTATESP>=${2 * 69_888 - 5}`]);
    // A step between two runs: the next run counts from where the CPU stopped.
    await session.handle("execution", { action: "step", count: 1 });
    await session.handle("execution", { action: "advance-frames", count: 1 });
    assert.equal(commands.filter((command) => command.startsWith("set-breakpoint 100 ")).at(-1), "set-breakpoint 100 TSTATESP>=69888");
  } finally {
    await session.close();
  }
});

test("typed counts only the characters whose keys were down for all their frames", async () => {
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { fires: ["PC=C003H"] });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("breakpoint", { action: "add", address: 0xc003 });
    const typed = (await session.handle("keyboard", { text: "pz" })) as { typed: number; stopReason: string };
    assert.deepEqual([typed.typed, typed.stopReason], [0, "breakpoint"]);
  } finally {
    await session.close();
  }
});

test("the keyboard rows keep bits 5 to 7 at 1, as the ULA gives them: a key down is a 0 only in bits 0 to 4", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k");
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("joystick", { up: false, down: false, left: false, right: true, fire: true });
    await session.handle("keys", { keys: ["caps", "8"], frames: 1 });
    const ports = commands.filter((command) => command.startsWith("set-ui-io-ports "));
    assert.deepEqual(ports, ["set-ui-io-ports ffffffffffffffff11", "set-ui-io-ports fefffffffbffffff11", "set-ui-io-ports ffffffffffffffff11"]);
  } finally {
    await session.close();
  }
});

test("cpu_history leaves out the copies of the last instruction that ZEsarUX records at a stop, also after steps", async () => {
  // The DEC DE at $962c ran one time; the stop recorded it twice more, with the same R.
  const history = ["PC=962c R=00", "PC=962c R=00", "PC=962c R=00", "PC=962f R=7f", "PC=962e R=7e", "PC=962d R=7d", "PC=962c R=7c", "PC=962c R=7b"];
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { history });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    assert.deepEqual(((await session.handle("cpuHistory", { count: 5 })) as { pcs: number[] }).pcs, [0x962c, 0x962f, 0x962e, 0x962d, 0x962c]);
    await session.handle("execution", { action: "step", count: 2 });
    // A loop of one instruction is no copy: R changes at each execution.
    assert.deepEqual(((await session.handle("cpuHistory", { count: 8 })) as { pcs: number[] }).pcs, [0xa000, 0xa000, 0x962c, 0x962f, 0x962e, 0x962d, 0x962c, 0x962c]);
  } finally {
    await session.close();
  }
});

test("a tape runs on the model that the session started with, or on the model of the call, not on the model of the last snapshot", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k");
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    assert.equal(((await session.handle("autostart", { type: "tap" }, [tapeOf("ZX Spectrum+ 128k")])) as { model: string }).model, "128k");
    await session.handle("execution", { action: "pause" });
    const loads = () => commands.filter((command) => command.startsWith("set-machine") || command.startsWith("smartload")).map((command) => command.split(" ").slice(0, 2).join(" "));
    commands.length = 0;
    assert.equal(((await session.handle("autostart", { type: "tap" }, [tapeOf("")])) as { model: string }).model, "48k");
    assert.deepEqual(loads(), ["set-machine 48k", `smartload ${join(zesarux.scratch, "media.tap")}`]);
    await session.handle("execution", { action: "pause" });
    commands.length = 0;
    assert.equal(((await session.handle("autostart", { type: "tap", model: "128k" }, [tapeOf("")])) as { model: string }).model, "128k");
    assert.deepEqual(loads(), ["set-machine 128k", `smartload ${join(zesarux.scratch, "media.tap")}`]);
    await session.handle("execution", { action: "pause" });
    assert.equal(((await session.handle("ula", {})) as { frameTstates: number }).frameTstates, 70_908);
  } finally {
    await session.close();
  }
});

test("the addresses of a get-pc answer end at the error text that ZEsarUX gives past the oldest entry", () => {
  // "be" in the error text looks like an address.
  assert.deepEqual(historyAddresses("11DC 11E0 ERROR: index can't be negative ERROR: index can't be negative "), [0x11dc, 0x11e0]);
  assert.deepEqual(historyAddresses("9102 9102\n"), [0x9102, 0x9102]);
  assert.deepEqual(historyAddresses(""), []);
});

test("the runs of one address in the CPU history, and the opcode of an extended entry", () => {
  assert.deepEqual(pcRuns([0x8002, 0x8002, 0x8001, 0x8002]), [
    { pc: 0x8002, first: 0, last: 1 },
    { pc: 0x8001, first: 2, last: 2 },
    { pc: 0x8002, first: 3, last: 3 },
  ]);
  assert.equal(historyOpcode("PC=8001 SP=bff0 I=3f R=01 IM1 IFF12 (PC)=7618fc00 (SP)=0000 MMU=8001"), 0x76);
  assert.equal(historyOpcode("PC=8001"), undefined);
});

// A HALT at $8001 after EI at $8000, then JR $8000 at $8002: the extended entries give the opcode at the PC.
const EI = "PC=8000 R=00 (PC)=fb7618fc";
const HALT_ENTRY = "PC=8001 R=01 (PC)=7618fc00";
const cycle = (r: number) => `PC=8002 R=${r.toString(16).padStart(2, "0")} (PC)=18fc0000`;

test("cpu_history shows a HALT cycle at the address of the HALT, never as an execution of the byte after it", async () => {
  // Most recent first: two cycles, the HALT, EI; then the JR at $8002 that ran after an interrupt, and LD A,$76 at $8fff that is no HALT.
  const history = [cycle(5), cycle(4), HALT_ENTRY, EI, cycle(3), "PC=0052 R=02 (PC)=c9000000", "PC=9001 R=01 (PC)=00000000", "PC=8fff R=00 (PC)=3e760000"];
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { history, steps: [cycle(6)], memory: { 0x8001: 0x76, 0x9000: 0x76 } });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    assert.deepEqual(((await session.handle("cpuHistory", { count: 8 })) as { pcs: number[] }).pcs, [0x8001, 0x8001, 0x8001, 0x8000, 0x8002, 0x0052, 0x9001, 0x8fff]);
    // A run of cycles that goes past the entries asked for: the session looks further back for the HALT.
    await session.handle("execution", { action: "step", count: 1 });
    assert.deepEqual(((await session.handle("cpuHistory", { count: 2 })) as { pcs: number[] }).pcs, [0x8001, 0x8001]);
  } finally {
    await session.close();
  }
});

test("the memmap leaves out the execute mark that only HALT cycles made, and keeps it when the byte after the HALT ran", async () => {
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { history: [HALT_ENTRY, EI], steps: [cycle(2), cycle(3), cycle(4), "PC=0038 R=05 (PC)=f5000000", "PC=8002 R=06 (PC)=18fc0000"], memory: { 0x8001: 0x76 } });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  const executed = async () => ((await session.handle("memmap", { action: "read" })) as { ranges: Array<{ start: number; flags: number }> }).ranges.filter((range) => (range.flags & 4) !== 0).map((range) => range.start);
  try {
    await session.handle("memmap", { action: "clear" });
    await session.handle("execution", { action: "step", count: 3 });
    assert.deepEqual(await executed(), []);
    // An interrupt ends the wait, and the JR at $8002 runs.
    await session.handle("execution", { action: "step", count: 2 });
    assert.deepEqual(await executed(), [0x8002]);
  } finally {
    await session.close();
  }
});

test("the memmap joins adjacent addresses with the same flags into one range, also executed addresses", async () => {
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { steps: ["PC=a000 R=01 (PC)=00000000", "PC=a001 R=02 (PC)=00000000", "PC=a002 R=03 (PC)=00000000", "PC=a004 R=04 (PC)=00000000"] });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("execution", { action: "step", count: 4 });
    assert.deepEqual(await session.handle("memmap", { action: "read" }), {
      ranges: [
        { start: 0xa000, end: 0xa002, flags: 4 },
        { start: 0xa004, end: 0xa004, flags: 4 },
      ],
    });
  } finally {
    await session.close();
  }
});

const REAL = "PC=8002 R=0a (PC)=18fc0000";
const RET = "PC=0052 R=09 (PC)=c9000000";
const IRQ = "PC=0038 R=08 (PC)=f5000000";
type MemmapRead = { ranges: Array<{ start: number; end: number; flags: number }>; uncheckedAfterHalt?: number[] };
const marked = (read: MemmapRead, address: number) => read.ranges.some((range) => range.start <= address && range.end >= address && (range.flags & 4) !== 0);

test("one read checks a mark after a HALT over a long window: a real execution of the byte keeps it, a wait with its start in the history removes it", async () => {
  // 20 frames each: the newest entries first. $9001 is after no HALT opcode and keeps its mark.
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { ran: ["8002", "9001"], runs: [[REAL, RET, IRQ, cycle(7), cycle(6), HALT_ENTRY, EI], [cycle(3), cycle(2), HALT_ENTRY, EI]], memory: { 0x8001: 0x76 } });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("memmap", { action: "clear" });
    await session.handle("execution", { action: "advance-frames", count: 20 });
    const ran = (await session.handle("memmap", { action: "read" })) as MemmapRead;
    assert.deepEqual([ran.uncheckedAfterHalt, marked(ran, 0x8002), marked(ran, 0x9001)], [undefined, true, true]);
    // The second window has only the wait: the real execution of the first window is older than it.
    await session.handle("memmap", { action: "clear" });
    await session.handle("execution", { action: "advance-frames", count: 20 });
    const waited = (await session.handle("memmap", { action: "read" })) as MemmapRead;
    assert.deepEqual([waited.uncheckedAfterHalt, marked(waited, 0x8002), marked(waited, 0x9001)], [undefined, false, true]);
  } finally {
    await session.close();
  }
});

test("the memmap names a mark after a HALT when the full history has no real execution and no start of the wait, until a check or a clear", async () => {
  // The history keeps 4 entries: a run of 20 frames fills it with wait cycles.
  const wait = [cycle(4), cycle(3), cycle(2), cycle(1)];
  const { zesarux } = await standInZesarux("ZX Spectrum 48k", { ran: ["8002"], historyMax: 4, runs: [wait, wait, wait], steps: [IRQ, REAL], memory: { 0x8001: 0x76 } });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("memmap", { action: "clear" });
    await session.handle("execution", { action: "advance-frames", count: 20 });
    const long = (await session.handle("memmap", { action: "read" })) as MemmapRead;
    assert.deepEqual([long.uncheckedAfterHalt, marked(long, 0x8002)], [[0x8002], true]);
    // The interrupt ends the wait, and the byte after the HALT runs: the mark is checked.
    await session.handle("execution", { action: "step", count: 2 });
    assert.equal(((await session.handle("memmap", { action: "read" })) as MemmapRead).uncheckedAfterHalt, undefined);
    await session.handle("execution", { action: "advance-frames", count: 20 });
    assert.equal(((await session.handle("memmap", { action: "read" })) as MemmapRead).uncheckedAfterHalt, undefined, "a checked mark stays checked");
    await session.handle("memmap", { action: "clear" });
    await session.handle("execution", { action: "advance-frames", count: 20 });
    assert.deepEqual(((await session.handle("memmap", { action: "read" })) as MemmapRead).uncheckedAfterHalt, [0x8002]);
    await session.handle("memmap", { action: "clear" });
    assert.equal(((await session.handle("memmap", { action: "read" })) as MemmapRead).uncheckedAfterHalt, undefined);
  } finally {
    await session.close();
  }
});

test("a breakpoint or a run_until target after a HALT stops only when the instruction is about to execute, not in the wait: the run goes on with the same frames", async () => {
  // $11dc is the PC of every stop of the stand-in, after a HALT at $11db. The first stop of each call comes in the wait.
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k", { fires: ["PC=11DCH (halt)", "PC=11DCH", "PC=11DCH (halt)", "PC=11DCH", "PC=11DCH (halt)", "PC=11DCH"], memory: { 0x11db: 0x76 } });
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    const added = (await session.handle("breakpoint", { action: "add", address: 0x11dc })) as { points: Array<{ id: number }> };
    commands.length = 0;
    assert.deepEqual(await session.handle("execution", { action: "advance-frames", count: 3 }), { state: "stopped", pc: 0x11dc, stopReason: "breakpoint", pointId: added.points[0]!.id });
    assert.equal(commands.filter((command) => command === "run").length, 2);
    assert.deepEqual(commands.filter((command) => command.startsWith("set-breakpoint 100 ")), [`set-breakpoint 100 TSTATESP>=${3 * 69_888}`], "the frames of the call stay as they are");
    await session.handle("breakpoint", { action: "remove", id: added.points[0]!.id });
    assert.deepEqual(await session.handle("runUntil", { address: 0x11dc, timeoutFrames: 5 }), { state: "stopped", pc: 0x11dc, stopReason: "target", reached: true });
    // A resume goes on after the stop in the wait, too.
    await session.handle("breakpoint", { action: "add", address: 0x11dc });
    assert.deepEqual(await session.handle("execution", { action: "resume" }), { state: "running" });
    for (let wait = 0; wait < 50 && ((await session.handle("status", {})) as { state: string }).state === "running"; wait++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(await session.handle("status", {}), { state: "stopped", pc: 0x11dc, stopReason: "breakpoint", pointId: 2, model: "48k" });
  } finally {
    await session.close();
  }
});

/** A .zsf as ZEsarUX writes it, with a machine block and no HALT. */
const ZSF = Buffer.from([...Buffer.from("ZSF ZEsarUX Snapshot File.", "latin1"), 1, 0, 1, 0, 0, 0, 1]);

test("autostart with run false loads a snapshot and runs no instruction: the CPU stays at the PC of the snapshot, and the clock counts from there", async () => {
  const { zesarux, commands } = await standInZesarux("ZX Spectrum 48k");
  const session = await ZesaruxSession.open(zesarux, "spectrum48");
  try {
    await session.handle("execution", { action: "advance-frames", count: 1 });
    const before = ((await session.handle("timing", { action: "read" })) as { tstates: number }).tstates;
    commands.length = 0;
    assert.deepEqual(await session.handle("autostart", { type: "zsf", run: false }, [ZSF]), { state: "stopped", pc: 0x11dc, model: "48k" });
    const load = commands.findIndex((command) => command.startsWith("smartload "));
    assert.ok(load >= 0 && !commands.slice(load).some((command) => command === "run" || command === "cpu-step"), commands.join("\n"));
    assert.equal(((await session.handle("timing", { action: "read" })) as { tstates: number }).tstates, before);
    assert.equal(((await session.handle("status", {})) as { state: string }).state, "stopped");
    // Without run false, the snapshot runs.
    assert.equal(((await session.handle("autostart", { type: "zsf" }, [ZSF])) as { state: string }).state, "running");
  } finally {
    await session.close();
  }
});
