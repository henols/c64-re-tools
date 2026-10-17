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
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-unpacker/scripts/unpack.ts");
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

test("each capture step writes what the C64 changed since the capture before, and the drive RAM", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  writeFileSync(join(project, "game.d64"), buildD64([{ name: "MAIN", bytes: main }, { name: "PART", bytes: part }]));
  writeFileSync(
    join(project, "steps.json"),
    JSON.stringify([
      { runUntil: { target: { kind: "address", address: "$080d" }, timeoutFrames: 6000 } },
      { capture: "main" },
      { runUntil: { target: { kind: "address", address: "$c005" }, timeoutFrames: 6000 } },
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
  const json = JSON.parse(stdout) as { captures: Array<{ capture: string; pc: string; segments: Array<{ start: string; end: string }>; smallChanges?: number; drive?: string }> };
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
});

test("loads that capture no segment give loaded false, and a capture at READY. tells the key wait", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server ??= await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
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
  assert.equal(status, 1, stdout);
  const json = JSON.parse(stdout) as { loaded: boolean; reason: string; captures: Array<{ segments: unknown[]; keyWait?: boolean }> };
  assert.equal(json.loaded, false);
  assert.match(json.reason, /No capture has a segment/);
  assert.equal(json.captures[0]!.keyWait, true, stdout);
});
