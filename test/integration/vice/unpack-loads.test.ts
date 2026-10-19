// The loads command of c64-unpacker: a program on a disk loads a second
// part with the KERNAL; a capture step after each part writes what the C64
// side changed since the capture before, and --drive the drive RAM.
// Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer, viceBackend } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";
import { readEnvelope } from "../../kit.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-unpacker/scripts/unpacker.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpack-loads-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

/** 10 SYS 2061; SETLFS 1,8,1; SETNAM "PART"; LOAD; JMP $C000. */
const main = Uint8Array.from([
  0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
  0xa9, 0x01, 0xa2, 0x08, 0xa0, 0x01, 0x20, 0xba, 0xff, // $080d: SETLFS
  0xa9, 0x04, 0xa2, 0x28, 0xa0, 0x08, 0x20, 0xbd, 0xff, // $0816: SETNAM "PART" at $0828
  0xa9, 0x00, 0x20, 0xd5, 0xff, // $081f: LOAD
  0x4c, 0x00, 0xc0, // $0824: JMP $C000
  0xea, // $0827
  0x50, 0x41, 0x52, 0x54, // $0828: "PART"
]);
/** At $c000: LDA #$2A; STA $C100; JMP to itself at $C005. */
const part = Uint8Array.from([0x00, 0xc0, 0xa9, 0x2a, 0x8d, 0x00, 0xc1, 0x4c, 0x05, 0xc0]);

test("each capture step writes what the C64 changed since the capture before, and the drive RAM; a save step writes a snapshot file", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  writeFileSync(join(project, "game.d64"), buildD64([{ name: "MAIN", bytes: main }, { name: "PART", bytes: part }]));
  writeFileSync(
    join(project, "steps.json"),
    JSON.stringify([
      { runUntil: { target: { kind: "address", address: "$080d" }, timeoutFrames: 6000 } },
      { capture: "main" },
      { runUntil: { target: { kind: "address", address: "$c005" }, timeoutFrames: 6000 } },
      { save: "at-part" },
      { capture: "part" },
    ]),
  );
  const child = spawn(process.execPath, [...process.execArgv, script, "loads", "game.d64", "--steps", "steps.json", "--out", "parts", "--drive", "--min-block", "4"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = readEnvelope(stdout, status).json as { captures: Array<{ capture: string; pc: string; segments: Array<{ start: string; end: string }>; smallChanges?: number; drive?: string }> };
  const [first, second] = json.captures;
  assert.equal(first!.pc, "$080d");
  assert.ok(
    first!.segments.some((segment) => segment.start <= "$0801" && segment.end >= "$082b"),
    `the main program is in the first capture: ${JSON.stringify(first!.segments)}`,
  );
  assert.equal(second!.pc, "$c005");
  assert.ok(second!.segments.some((segment) => segment.start === "$c000" && segment.end === "$c007"), `the part is in the second capture: ${JSON.stringify(second!.segments)}`);
  assert.ok(!second!.segments.some((segment) => segment.start <= "$0801" && segment.end >= "$0801"), "the main program is not captured again");
  assert.equal(second!.smallChanges, 1, "the STA to $c100 is a small change");
  const image = JSON.parse(readFileSync(join(project, "parts", "part", "image.json"), "utf8")) as { entry: string; drive: { file: string; space: string } };
  assert.equal(image.entry, "$c005");
  assert.equal(image.drive.space, "drive8");
  const drive = readFileSync(join(project, "parts", "part", "drive8.prg"));
  assert.equal(drive.length, 2 + 0x800);
  assert.equal(drive.readUInt16LE(0), 0x0000);
  assert.ok(existsSync(join(project, "parts", "part", "entry_state.json")));
  // The save step: a snapshot file at the part, which a run can start from.
  assert.deepEqual((json as unknown as { saved: Array<{ save: string; pc: string }> }).saved.map((item) => [item.save, item.pc]), [["at-part", "$c005"]]);
  assert.equal(readFileSync(join(project, "parts", "at-part.vsf")).subarray(0, 18).toString("latin1"), "VICE Snapshot File");
});

test("loads that capture no segment give loaded false, and a capture at READY. tells the key wait", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server ??= await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  // 10 END: the program is smaller than one segment, and the C64 goes back to READY.
  writeFileSync(join(project, "end.d64"), buildD64([{ name: "END", bytes: Uint8Array.from([0x01, 0x08, 0x07, 0x08, 0x0a, 0x00, 0x80, 0x00, 0x00, 0x00]) }]));
  writeFileSync(join(project, "ready.json"), JSON.stringify([{ frames: 600 }, { capture: "ready" }]));
  const child = spawn(process.execPath, [...process.execArgv, script, "loads", "end.d64", "--steps", "ready.json", "--out", "ready"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = readEnvelope(stdout, status).json as { result: string; loaded: boolean; reason: string; captures: Array<{ segments: unknown[]; keyWait?: boolean }> };
  assert.equal(json.result, "FAIL");
  assert.equal(json.loaded, false);
  assert.match(json.reason, /No capture has a segment/);
  assert.equal(json.captures[0]!.keyWait, true, stdout);
});

test("loads of a PRG without a BASIC start line gives loaded false, an empty captures list and the remedy", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server ??= await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  // Code at $c000 and no BASIC line: RUN runs no program line.
  writeFileSync(join(project, "c000.prg"), part);
  writeFileSync(join(project, "c000.json"), JSON.stringify([{ frames: 10 }, { capture: "start" }]));
  const child = spawn(process.execPath, [...process.execArgv, script, "loads", "c000.prg", "--steps", "c000.json", "--out", "c000"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = readEnvelope(stdout, status).json as { result: string; loaded: boolean; reason: string; captures: unknown[] };
  assert.deepEqual([json.result, json.loaded, json.captures], ["FAIL", false, []]);
  assert.match(json.reason, /^After RUN, BASIC ran no program line in \d+ frames\. loads starts a PRG with RUN, so it needs a program with a BASIC start line, for example 10 SYS 2061\. For a PRG without a BASIC start, use capture with --entry\.$/);
});

test("a capture holds the RAM under the I/O area that the program wrote, and leaves out an --exclude range", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server ??= await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  // 10 SYS 2061; with all RAM ($01 = $34) it fills $d000-$d0ff and $c000-$c0ff with $5a, then waits at $0824.
  const io = Uint8Array.from([
    0x01, 0x08, 0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
    0x78, 0xa9, 0x34, 0x85, 0x01, 0xa2, 0x00, // $080d: SEI; LDA #$34; STA $01; LDX #0
    0xa9, 0x5a, 0x9d, 0x00, 0xd0, 0x9d, 0x00, 0xc0, 0xe8, 0xd0, 0xf5, // $0814: LDA #$5A; STA $D000,X; STA $C000,X; INX; BNE $0814
    0xa9, 0x37, 0x85, 0x01, 0x58, 0x4c, 0x24, 0x08, // $081f: LDA #$37; STA $01; CLI; JMP $0824
  ]);
  writeFileSync(join(project, "io.prg"), io);
  writeFileSync(join(project, "io.json"), JSON.stringify([{ runUntil: { target: { kind: "address", address: "$0824" }, timeoutFrames: 600 } }, { capture: "io" }]));
  const child = spawn(process.execPath, [...process.execArgv, script, "loads", "io.prg", "--steps", "io.json", "--out", "io", "--min-block", "1", "--exclude", "$c000-$c0ff"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = readEnvelope(stdout, status).json as { captures: Array<{ segments: Array<{ start: string; end: string }>; excluded?: Array<{ start: string; end: string }> }> };
  const [capture] = json.captures;
  assert.ok(capture!.segments.some((segment) => segment.start === "$d000" && segment.end === "$d0ff"), `the RAM under the I/O area is a segment: ${JSON.stringify(capture!.segments)}`);
  assert.ok(!capture!.segments.some((segment) => segment.start <= "$c0ff" && segment.end >= "$c000"), `the excluded range is no segment: ${JSON.stringify(capture!.segments)}`);
  assert.deepEqual(capture!.excluded, [{ start: "$c000", end: "$c0ff" }]);
  const image = JSON.parse(readFileSync(join(project, "io", "io", "image.json"), "utf8")) as { excluded: unknown };
  assert.deepEqual(image.excluded, [{ start: "$c000", end: "$c0ff" }]);
  assert.deepEqual([...readFileSync(join(project, "io", "io", "segment-d000-d0ff.prg")).subarray(2, 6)], [0x5a, 0x5a, 0x5a, 0x5a]);
});
