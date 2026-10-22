// The retro-testing run: steps in its own emulator, with screens, a
// coverage map, a snapshot file and observations written to a directory; a
// second run starts from the snapshot file of the first. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../../src/cpu/coverage.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer, viceBackend } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { joystickCounterPrg, LEFT_SEEN } from "../../fixtures/prg/joystick-counter.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";
import { readEnvelope } from "../../kit.ts";

const script = resolve(import.meta.dirname, "../../../skills/retro-testing/scripts/testing.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-run-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

async function runSteps(...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  if (server === undefined) {
    const supervisor = new ProcessSupervisor();
    supervisor.installExitGuard();
    server = await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  }
  const child = spawn(process.execPath, [...process.execArgv, script, "run", ...args], { cwd: project, env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: readEnvelope(stdout, status).json as Record<string, unknown> };
}

test("a run writes screens, a coverage map, a snapshot and observations; a later run starts from that snapshot", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "counter.prg"), joystickCounterPrg);
  writeFileSync(
    join(project, "first.json"),
    JSON.stringify({
      name: "hold left",
      start: { program: "counter.prg", load: true },
      steps: [
        { registers: { pc: "$c000" } },
        { joystick: { port: 2, direction: "left" } },
        { frames: 20 },
        { screen: "left" },
        { coverage: "left" },
        { observe: "counted", memory: [{ address: "$c100", size: 2 }], registers: true },
        { save: "after-left" },
      ],
    }),
  );
  const first = await runSteps("first.json", "--out", "runs/first");
  assert.equal(first.status, 0, JSON.stringify(first.json));
  const results = JSON.parse(readFileSync(join(project, "runs", "first", "results.json"), "utf8")) as { completed: boolean; files: string[]; observations: Record<string, { memory: Record<string, string> }> };
  assert.equal(results.completed, true);
  assert.deepEqual(results.files, ["left.png", "left.bin", "after-left.vsf"]);
  assert.equal(readFileSync(join(project, "runs", "first", "left.png")).subarray(1, 4).toString(), "PNG");
  const map = readFileSync(join(project, "runs", "first", "left.bin"));
  assert.equal(map.length, 0x10000);
  assert.ok((map[LEFT_SEEN]! & COVERAGE.ramExecute) !== 0, "the code for left ran");
  const [frames, left] = Buffer.from(results.observations.counted!.memory["$c100"]!, "hex");
  assert.ok(frames! >= 19 && left! >= 19, `frames ${frames}, left ${left}`);

  writeFileSync(join(project, "second.json"), JSON.stringify({ name: "go on", start: { snapshot: "runs/first/after-left.vsf" }, steps: [{ frames: 10 }, { observe: "later", memory: [{ address: "$c100", size: 2 }] }] }));
  const second = await runSteps("second.json", "--out", "runs/second");
  assert.equal(second.status, 0, JSON.stringify(second.json));
  const later = JSON.parse(readFileSync(join(project, "runs", "second", "results.json"), "utf8")) as { observations: { later: { memory: Record<string, string> } } };
  const [framesLater] = Buffer.from(later.observations.later.memory["$c100"]!, "hex");
  assert.ok(framesLater! >= frames! + 9, `the counter goes on from the snapshot: ${frames} then ${framesLater}`);
});

test("a runUntil that does not reach its target ends the run with the reason", { skip: liveSkip, timeout: 180_000 }, async () => {
  writeFileSync(join(project, "never.json"), JSON.stringify({ name: "never", start: { program: "counter.prg", load: true }, steps: [{ registers: { pc: "$c000" } }, { runUntil: { target: { kind: "address", address: "$c0f0" }, timeoutFrames: 20 } }, { screen: "never" }] }));
  const { status, json } = await runSteps("never.json", "--out", "runs/never");
  assert.equal(status, 0);
  assert.equal(json.result, "FAIL");
  assert.equal(json.completed, false);
  assert.match(json.reason as string, /Step 2 did not reach its target in 20 frames/);
  assert.deepEqual((json.files as Array<{ out: string }>).map((file: { out: string }) => file.out.split("/").at(-1)), ["results.json"], "the steps after it did not run");
});

test("an expect step passes on equal values, fails on others with each mismatch, and the later steps still run", { skip: liveSkip, timeout: 180_000 }, async () => {
  writeFileSync(join(project, "counter.prg"), joystickCounterPrg);
  writeFileSync(
    join(project, "expect.json"),
    JSON.stringify({
      name: "expect",
      start: { program: "counter.prg", load: true },
      steps: [
        { registers: { pc: "$c000", a: 7 } },
        { write: { address: "$0400", data: "08050c0c0f" } },
        { write: { address: "$d020", data: "01" } },
        // $d020 reads its unused bits as 1: the mask compares only the colour.
        { expect: "good", memory: [{ address: "$0400", text: "HELLO" }, { address: "$d020", data: "01", mask: "0f" }], registers: { pc: "$c000", a: 7 } },
        { expect: "bad", memory: [{ address: "$0400", text: "WORLD" }, { address: "$d020", data: "02", mask: "0f" }], registers: { a: 8 } },
        { screen: "after" },
      ],
    }),
  );
  const { status, json } = await runSteps("expect.json", "--out", "runs/expect");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.result, "FAIL");
  assert.equal(json.completed, true);
  assert.deepEqual(json.failedExpectations, ["bad"]);
  const [good, bad] = json.expectations as Array<{ expect: string; pass: boolean; count: number; mismatches: unknown[] }>;
  assert.deepEqual(good, { expect: "good", pass: true, count: 0, mismatches: [] });
  assert.deepEqual(bad!.mismatches, [
    { address: "$0400", expected: "WORLD", actual: "HELLO" },
    { address: "$d020", expected: "$02", actual: "$f1" },
    { register: "a", expected: 8, actual: 7 },
  ]);
  assert.ok((json.files as Array<{ out: string }>).some((file) => file.out.endsWith("after.png")), "the step after the failed expectation ran");
});

test("an observation reads the RAM under the KERNAL and all 64 KiB, and diff finds the change between two snapshots", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "counter.prg"), joystickCounterPrg);
  writeFileSync(
    join(project, "under.json"),
    JSON.stringify({
      name: "under the KERNAL",
      start: { program: "counter.prg", load: true },
      steps: [
        { registers: { pc: "$c000" } },
        { frames: 5 },
        { save: "a" },
        { write: { address: "$e000", data: "01020304" } },
        { save: "b" },
        { observe: "under", memory: [{ address: "$e000", size: 4, view: "ram" }] },
        { observe: "rom", memory: [{ address: "$e000", size: 4 }] },
        { observe: "everything", memory: "all" },
      ],
    }),
  );
  const run = await runSteps("under.json", "--out", "runs/under");
  assert.equal(run.status, 0, JSON.stringify(run.json));
  const results = JSON.parse(readFileSync(join(project, "runs", "under", "results.json"), "utf8")) as { observations: Record<string, { memory: Record<string, unknown> }> };
  assert.deepEqual(results.observations.under!.memory, { $e000: "01020304" }, "the ram view reads the RAM under the KERNAL");
  assert.notEqual((results.observations.rom!.memory as Record<string, string>).$e000, "01020304", "the CPU view reads the KERNAL ROM");
  assert.deepEqual(results.observations.everything!.memory, { file: "everything.bin" });
  const all = readFileSync(join(project, "runs", "under", "everything.bin"));
  assert.equal(all.length, 0x10000);
  assert.deepEqual([...all.subarray(0xe000, 0xe004)], [1, 2, 3, 4]);

  const differ = resolve(import.meta.dirname, "../../../skills/retro-testing/scripts/testing.ts");
  const child = spawn(process.execPath, [...process.execArgv, differ, "diff", "runs/under/a.vsf", "runs/under/b.vsf"], { cwd: project, env: { ...process.env, C64RT_HOST: `${server!.host}:${server!.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(status, 0, stdout);
  const diff = readEnvelope(stdout, status).json as { memory: { listed: Array<{ start: string; end: string; a?: string; b?: string }> } };
  assert.ok(diff.memory.listed.some((range) => range.start === "$e000" && range.end === "$e003" && range.b === "01020304"), stdout);

  // PAL snapshots in an NTSC machine do not restore: refused, never a diff of the wrong state.
  const ntsc = spawn(process.execPath, [...process.execArgv, differ, "diff", "runs/under/a.vsf", "runs/under/b.vsf", "--ntsc"], { cwd: project, env: { ...process.env, C64RT_HOST: `${server!.host}:${server!.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let refused = "";
  ntsc.stdout.on("data", (chunk) => (refused += chunk));
  const [ntscStatus] = (await once(ntsc, "exit")) as [number | null];
  assert.equal(ntscStatus, 2, refused);
  const { error } = readEnvelope(refused, ntscStatus).json as { error: { code: string; message: string } };
  assert.equal(error.code, "invalid-input", refused);
  assert.match(error.message, /^runs\/under\/a\.vsf did not restore: the RAM after the restore is not the RAM of the file\..*Leave out --ntsc for a PAL snapshot/);
});

test("a trace step writes each write to the counter with the instruction and raster line 128", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "counter.prg"), joystickCounterPrg);
  writeFileSync(
    join(project, "traced.json"),
    JSON.stringify({ name: "trace", start: { program: "counter.prg", load: true }, steps: [{ registers: { pc: "$c000" } }, { frames: 3 }, { trace: "counter", points: [{ kind: "write", start: "$c100" }], frames: 5 }] }),
  );
  const run = await runSteps("traced.json", "--out", "runs/traced");
  assert.equal(run.status, 0, JSON.stringify(run.json));
  const results = JSON.parse(readFileSync(join(project, "runs", "traced", "results.json"), "utf8")) as { traces: Record<string, { file: string; hits: number; end: string }> };
  assert.equal(results.traces.counter!.end, "frames");
  const traced = JSON.parse(readFileSync(join(project, "runs", "traced", "counter.json"), "utf8")) as { hits: Array<{ pc: string; text: string; rasterLine: number; address: string }> };
  assert.ok(traced.hits.length >= 4 && traced.hits.length <= 6, `${traced.hits.length} writes in 5 frames`);
  for (const hit of traced.hits) {
    assert.deepEqual([hit.pc, hit.text, hit.address], ["$c015", "INC $c100", "$c100"]);
    assert.equal(hit.rasterLine, 128, "the loop waits for line 128");
  }
});
