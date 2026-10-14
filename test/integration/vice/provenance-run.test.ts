// Runtime evidence of c64-provenance (D50): each release runs in its own
// emulator, a PRG by autostart and an image by writing it with its entry
// state; each difference gets its first access and whether it changed.
// Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-provenance/scripts/provenance.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-provenance-run-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

const LOAD = 0x0801;
/** 10 SYS 2061; LDA #$AA; STA $0830; STA $0831; LDA $0840; JSR $0850; JMP to itself. $0850: NOP, NOP, RTS. */
function release(variant: "a" | "b"): Uint8Array {
  const memory = new Uint8Array(0x70);
  const put = (address: number, bytes: number[]) => memory.set(bytes, address - LOAD);
  put(0x0801, [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00]);
  put(0x080d, [0xa9, 0xaa, 0x8d, 0x30, 0x08, 0x8d, 0x31, 0x08, 0xad, 0x40, 0x08, 0x20, 0x50, 0x08, 0x4c, 0x1c, 0x08]);
  put(0x0850, variant === "a" ? [0xea, 0xea, 0x60] : [0xea, 0x60, 0x00]);
  if (variant === "b") {
    put(0x0830, [0x11, 0x22]);
    put(0x0840, [0x05]);
    put(0x0860, [0x77]);
  }
  return memory;
}

test("each difference gets its first access in every release and whether the run changed it", { skip: liveSkip, timeout: 300_000 }, async () => {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });

  const prg = (bytes: Uint8Array) => Buffer.concat([Buffer.from([LOAD & 0xff, LOAD >> 8]), bytes]);
  writeFileSync(join(project, "a.prg"), prg(release("a")));
  writeFileSync(join(project, "b.prg"), prg(release("b")));
  const image = new Uint8Array(0x10000);
  image.set(release("a"), LOAD);
  mkdirSync(join(project, "unpacked"));
  writeFileSync(join(project, "unpacked", "image.bin"), image);
  writeFileSync(join(project, "unpacked", "image.json"), JSON.stringify({ entry: "$080d", image: "image.bin", segments: [{ start: "$0801", end: "$0870" }] }));
  const page = "00".repeat(256);
  writeFileSync(
    join(project, "unpacked", "entry_state.json"),
    JSON.stringify({
      registers: { pc: "$080d", a: 0, x: 0, y: 0, sp: 0xf6, flags: { n: false, v: false, b: false, d: false, i: true, z: false, c: false } },
      cpuPort: { $00: 0x2f, $01: 0x37 },
      pages: { $0000: page, $0100: page, $0200: page, $0300: page },
    }),
  );

  const child = spawn(process.execPath, [...process.execArgv, script, "a.prg", "b.prg", "unpacked/image.json", "--run", "50"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const json = JSON.parse(stdout) as {
    differences: Array<{ start: string; end: string; runtime: Record<string, { first: string; changed: boolean }> }>;
    run: { releases: Record<string, { started: boolean }> };
  };
  assert.deepEqual(json.run.releases, { "a.prg": { started: true }, "b.prg": { started: true }, "unpacked/image.json": { started: true } });
  const seen = Object.fromEntries(json.differences.map((difference) => [`${difference.start}-${difference.end}`, difference.runtime]));
  const all = (first: string, changed: boolean) => ({ "a.prg": { first, changed }, "b.prg": { first, changed }, "unpacked/image.json": { first, changed } });
  assert.deepEqual(seen, {
    "$0830-$0831": all("write", true),
    "$0840-$0840": all("read", false),
    "$0851-$0852": all("execute", false),
    "$0860-$0860": all("none", false),
  });
});
