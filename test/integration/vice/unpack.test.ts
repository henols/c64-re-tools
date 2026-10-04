// The c64-unpacker capture against a real Host Runtime and real VICE: a
// small packed program decodes its payload to $C000 and jumps there; the
// capture after that jump gives the original program back exactly.
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
import { ORIGINAL } from "../../fixtures/prg/counter-variants.ts";
import { xorPackedPrg } from "../../fixtures/prg/xor-packed.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-unpacker/scripts/unpack.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpack-"));
writeFileSync(join(project, "packed.prg"), xorPackedPrg);
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function unpack(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  }
  const child = spawn(process.execPath, [script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("a capture at the unpacked entry gives the original program back", { skip: liveSkip, timeout: 180_000 }, async () => {
  const end = 0xc000 + ORIGINAL.prg.length - 3;
  const { status, json } = await unpack("capture", "packed.prg", "--until", "$c000", "--out", "unpacked/game.prg", "--range", "$c000", `$${end.toString(16)}`);
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.loadRange, { start: "$c000", end: `$${end.toString(16)}` });
  assert.equal(json.pc, "$c000");
  assert.deepEqual([...readFileSync(join(project, "unpacked", "game.prg"))], [...ORIGINAL.prg]);

  const full = await unpack("capture", "packed.prg", "--until", "$c000", "--out", "unpacked/memory.bin");
  assert.equal(full.json.flat64k, true);
  assert.equal(readFileSync(join(project, "unpacked", "memory.bin")).length, 0x10000);
});

test("an address that the program never gets to captures nothing", { skip: liveSkip, timeout: 180_000 }, async () => {
  const { status, json } = await unpack("capture", "packed.prg", "--until", "$c0f0", "--out", "unpacked/never.prg", "--timeout-frames", "200");
  assert.equal(status, 1);
  assert.equal(json.captured, false);
  assert.match(json.reason as string, /did not get to \$c0f0 in 200 frames/);
  assert.equal(existsSync(join(project, "unpacked", "never.prg")), false);
});
