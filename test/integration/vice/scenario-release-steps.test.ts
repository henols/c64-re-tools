// c64-testing for real releases: steps for one side, a raster sync, a
// normalize step, an exclude with its reason, and the files of a FAIL.
// The original is the key-gated packed counter; the rebuild is the plain
// counter, loaded and started without BASIC. Opt-in with C64RT_LIVE_VICE.

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
import { gatedPackedPrg } from "../../fixtures/prg/gated-packed.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";
import { importImage } from "../../fixtures/program.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-testing/scripts/test.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-d46-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function runTest(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({ port: 0, createViceSession: viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog }) });
  }
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

const steps = [
  { autostart: true, side: "original" },
  { type: { mode: "text", text: " " }, side: "original" },
  { frames: 150, side: "rebuild" },
  { load: true, side: "rebuild" },
  { registers: { pc: "$c000" }, side: "rebuild" },
  { runUntil: { target: { kind: "address", address: "$c014" }, timeoutFrames: 600 } },
  { runUntil: { target: { kind: "raster", line: 100 }, timeoutFrames: 5 } },
  { normalize: true },
];
const memory = [{ at: "$c100" }, { at: "$0002", size: 4, exclude: [{ at: "$0002", reason: "the test writes it after normalize on one side" }] }];

test("one-side steps, a raster sync, normalize and an exclude make two different starts comparable; a FAIL leaves its files", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "gated.prg"), gatedPackedPrg);
  writeFileSync(join(project, "counter.prg"), ORIGINAL.prg);
  const page = (fill: number) => Buffer.alloc(256, fill).toString("hex");
  // The entry state that normalize writes is in the knowledge, with its program.
  importImage(project, new Uint8Array(0x10000), { segments: [{ start: 0xc000, end: 0xc000 }], entry: 0xc000, state: { cpuPort: { $00: 0x2f, $01: 0x37 }, pages: { $0000: page(0x11), $0100: page(0x22), $0200: page(0x33), $0300: page(0x44) } } });
  const subjects = { original: { program: "gated.prg", symbols: "none" }, rebuild: { program: "counter.prg", symbols: "none" } };
  // The exclude: after normalize the rebuild writes $0002 again, so only that byte differs.
  const diverge = { write: { address: "$0002", data: "99" }, side: "rebuild" };
  writeFileSync(join(project, "pass.json"), JSON.stringify({ name: "counts", ...subjects, steps: [...steps, diverge, { observe: "done", memory }] }));
  const pass = await runTest("pass.json");
  assert.equal(pass.json.result, "PASS", JSON.stringify(pass.json));
  assert.deepEqual(pass.json.excluded, [{ checkpoint: "done", at: "$0002", reason: "the test writes it after normalize on one side" }]);

  // The screens differ: the original went through BASIC (RUN on the screen), the rebuild did not.
  writeFileSync(join(project, "fail.json"), JSON.stringify({ name: "screens", ...subjects, steps: [...steps, { observe: "done", memory, screen: {} }] }));
  const fail = await runTest("fail.json", "--out", "results/fail");
  assert.equal(fail.json.result, "FAIL", JSON.stringify(fail.json));
  assert.deepEqual((fail.json.differences as Array<{ what: string }>).map((difference) => difference.what), ["screen"]);
  assert.deepEqual(fail.json.files, ["done-original.png", "done-rebuild.png", "done-diff.png"]);
  for (const file of fail.json.files as string[]) assert.equal(readFileSync(join(project, "results", "fail", file)).subarray(1, 4).toString(), "PNG", file);
  assert.equal(existsSync(join(project, "results", "fail", "memory.json")), false, "no memory differed");
});
