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

import { runProgram } from "../../../src/host-client/autostart.ts";
import { textToPetscii } from "../../../src/c64.ts";
import { ViceSessionClient } from "../../../src/host-client/vice-session.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { ORIGINAL } from "../../fixtures/prg/counter-variants.ts";
import { borderLoopPrg } from "../../fixtures/prg/border-loop.ts";
import { gatedPackedPrg } from "../../fixtures/prg/gated-packed.ts";
import { generatedCallPrg } from "../../fixtures/prg/generated-call.ts";
import { selfOverwritingPrg } from "../../fixtures/prg/self-overwriting.ts";
import { stagedPrg } from "../../fixtures/prg/staged.ts";
import { xorPackedPrg } from "../../fixtures/prg/xor-packed.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const script = resolve(import.meta.dirname, "../../../skills/c64-unpacker/scripts/unpack.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-unpack-"));
writeFileSync(join(project, "packed.prg"), xorPackedPrg);
writeFileSync(join(project, "gated.prg"), gatedPackedPrg);
writeFileSync(join(project, "staged.prg"), stagedPrg);
writeFileSync(join(project, "self-overwriting.prg"), selfOverwritingPrg);
writeFileSync(join(project, "generated-call.prg"), generatedCallPrg);
writeFileSync(join(project, "press-key.json"), JSON.stringify([{ frames: 50 }, { type: { mode: "text", text: " " } }]));
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
  const child = spawn(process.execPath, [...process.execArgv, script, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` }, stdio: ["ignore", "pipe", "inherit"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("a capture at the unpacked entry gives the original program back", { skip: liveSkip, timeout: 180_000 }, async () => {
  const end = 0xc000 + ORIGINAL.prg.length - 3;
  const { status, json } = await unpack("capture", "packed.prg", "--until", "$c000", "--out", "unpacked/game", "--range", "$c000", `$${end.toString(16)}`);
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.segments, [{ start: "$c000", end: `$${end.toString(16)}` }]);
  assert.equal(json.pc, "$c000");
  assert.deepEqual([...readFileSync(join(project, "unpacked", "game", `segment-c000-${end.toString(16)}.prg`))], [...ORIGINAL.prg]);
  assert.equal(readFileSync(join(project, "unpacked", "game", "image.bin")).length, 0x10000);
});

test("an address that the program never gets to captures nothing", { skip: liveSkip, timeout: 180_000 }, async () => {
  const { status, json } = await unpack("capture", "packed.prg", "--until", "$c0f0", "--out", "unpacked/never", "--timeout-frames", "200");
  assert.equal(status, 1);
  assert.equal(json.captured, false);
  assert.match(json.reason as string, /did not get to \$c0f0 in 200 frames/);
  assert.equal(existsSync(join(project, "unpacked", "never")), false);
});

test("trace finds the code that the packed program wrote and runs; its range start is the entry for capture", { skip: liveSkip, timeout: 180_000 }, async () => {
  const traced = await unpack("trace", "packed.prg", "--frames", "300");
  assert.equal(traced.status, 0, JSON.stringify(traced.json));
  assert.equal(traced.json.packing, "likely");
  const running = traced.json.runningRange as { start: string; end: string };
  assert.equal(running.start, "$c000", "the decoder wrote the payload at $c000 and jumped there");
  assert.equal(traced.json.suggestedUntil, traced.json.pc);

  const end = 0xc000 + ORIGINAL.prg.length - 3;
  const captured = await unpack("capture", "packed.prg", "--until", running.start, "--out", "unpacked/traced", "--range", "$c000", `$${end.toString(16)}`);
  assert.equal(captured.status, 0, JSON.stringify(captured.json));
  assert.deepEqual([...readFileSync(join(project, "unpacked", "traced", `segment-c000-${end.toString(16)}.prg`))], [...ORIGINAL.prg]);
});

test("trace finds no written code in a program that runs as it loaded; a program without BASIC needs --entry", { skip: liveSkip, timeout: 180_000 }, async () => {
  writeFileSync(join(project, "loop.prg"), borderLoopPrg);
  const loop = await unpack("trace", "loop.prg", "--frames", "200");
  assert.equal(loop.status, 0, JSON.stringify(loop.json));
  assert.equal(loop.json.packing, "unlikely");
  assert.deepEqual(loop.json.writtenThenExecuted, []);

  writeFileSync(join(project, "counter.prg"), ORIGINAL.prg);
  assert.equal((await unpack("trace", "counter.prg")).status, 2, "no BASIC start line and no --entry");
  const started = await unpack("trace", "counter.prg", "--entry", "$c000", "--frames", "100");
  assert.equal(started.status, 0, JSON.stringify(started.json));
  assert.equal(started.json.packing, "unlikely");
  assert.deepEqual(started.json.writtenThenExecuted, [], "the counter runs where it loaded");
});

test("a steps file presses the key that an intro waits for", { skip: liveSkip, timeout: 240_000 }, async () => {
  const end = 0xc000 + ORIGINAL.prg.length - 3;
  const range = ["--range", "$c000", `$${end.toString(16)}`];
  const blocked = await unpack("capture", "gated.prg", "--until", "$c000", "--out", "unpacked/blocked", "--timeout-frames", "300", ...range);
  assert.equal(blocked.json.captured, false, "without a key the intro waits");
  const { status, json } = await unpack("capture", "gated.prg", "--until", "$c000", "--out", "unpacked/gated", "--steps", "press-key.json", ...range);
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual([...readFileSync(join(project, "unpacked", "gated", `segment-c000-${end.toString(16)}.prg`))], [...ORIGINAL.prg]);
  // Whether the CPU is in the unpacked code at the end depends on the moment (an IRQ can be running); that it ran there does not.
  const traced = await unpack("trace", "gated.prg", "--steps", "press-key.json", "--frames", "100");
  assert.ok((traced.json.writtenThenExecuted as Array<{ start: string }>).some((range) => range.start === "$c000"), JSON.stringify(traced.json));
});

test("stages finds each stage of a staged release and where the next one starts", { skip: liveSkip, timeout: 300_000 }, async () => {
  const { status, json } = await unpack("stages", "staged.prg", "--steps", "press-key.json", "--frames", "400");
  assert.equal(status, 0, JSON.stringify(json));
  const found = json.stages as Array<{ stage: number; entry: string; next?: string; wrote: Array<{ start: string; end: string }> }>;
  assert.deepEqual(
    found.map((stage) => [stage.entry, stage.next]),
    [
      ["$080d", "$c000"],
      ["$c000", "$4000"],
      ["$4000", undefined],
    ],
    JSON.stringify(found),
  );
  assert.deepEqual(found[0]!.wrote, [{ start: "$c000", end: "$c07f" }], "stage 0 wrote stage 1");
  assert.deepEqual(found[1]!.wrote, [{ start: "$4000", end: "$407f" }], "stage 1 wrote the program");
});

test("a capture at the last stage writes the image, its segments and the entry state", { skip: liveSkip, timeout: 300_000 }, async () => {
  const { status, json } = await unpack("capture", "staged.prg", "--until", "$4000", "--out", "unpacked/staged", "--steps", "press-key.json", "--timeout-frames", "400");
  assert.equal(status, 0, JSON.stringify(json));
  const image = JSON.parse(readFileSync(join(project, "unpacked", "staged", "image.json"), "utf8")) as Record<string, unknown>;
  assert.equal(image.entry, "$4000");
  // Stage 1's own code at $c000 is loader code: only the program that it wrote is a segment.
  assert.deepEqual(image.segments, [{ start: "$4000", end: "$407f", writtenBy: 1, file: "segment-4000-407f.prg" }]);
  assert.deepEqual((image.stages as Array<{ entry: string }>).map((stage) => stage.entry), ["$080d", "$c000", "$4000"]);
  const segment = readFileSync(join(project, "unpacked", "staged", "segment-4000-407f.prg"));
  assert.deepEqual([...segment.subarray(0, 8)], [0x00, 0x40, 0xee, 0x00, 0x41, 0x4c, 0x00, 0x40], "the program at $4000");
  const state = JSON.parse(readFileSync(join(project, "unpacked", "staged", "entry_state.json"), "utf8")) as Record<string, any>;
  assert.equal(state.registers.pc, "$4000");
  assert.deepEqual(Object.keys(state.pages), ["$0000", "$0100", "$0200", "$0300"]);
  assert.equal(state.io.vic.bytes.length, 0x2f * 2);
  assert.equal(state.vectors.irq, "$ea31", "the KERNAL IRQ handler: this release does not change it");
  assert.ok(Array.isArray(state.differsFromReset) && state.differsFromReset.length > 0, "a run leaves zero page and stack different from a fresh READY");

  // A scenario starts the program and runs the same steps: it reaches $4000 at the same raster position and timer values.
  const client = await ViceSessionClient.open({ videoStandard: "pal", env: { ...process.env, C64RT_HOST: `${server!.host}:${server!.port}` } });
  const cwd = process.cwd();
  process.chdir(project);
  try {
    await client.reset({ mode: "hard", run: false });
    assert.equal(await runProgram(client, "staged.prg", stagedPrg), undefined);
    await client.execution({ action: "advance-frames", count: 50, space: "c64" });
    await client.keyboard(textToPetscii(" "));
    assert.equal((await client.runUntil({ target: { kind: "address", address: 0x4000, space: "c64" }, timeoutFrames: 400 })).reached, true);
    const io = async (address: number, size: number) => Buffer.from((await client.ioRead(address, size)).data, "hex").toString("hex");
    assert.equal(await io(0xd011, 2), state.io.vic.bytes.slice(0x11 * 2, 0x13 * 2), "the raster line");
    assert.equal(await io(0xdc04, 4), state.io.cia1.bytes.slice(4 * 2, 8 * 2), "CIA 1 timers A and B");
  } finally {
    process.chdir(cwd);
    await client.close();
  }
});

test("stages follows a release whose stages write over code that ran before, and a SYS π*656 start", { skip: liveSkip, timeout: 300_000 }, async () => {
  const { status, json } = await unpack("stages", "self-overwriting.prg", "--frames", "100");
  assert.equal(status, 0, JSON.stringify(json));
  const found = json.stages as Array<{ entry: string; next?: string; wrote: Array<{ start: string; end: string }> }>;
  assert.deepEqual(
    found.map((stage) => [stage.entry, stage.next]),
    [
      ["$080c", "$0340"],
      ["$0340", "$0801"],
      ["$0801", "$0801"],
      ["$0801", undefined],
    ],
    JSON.stringify(found),
  );
  assert.deepEqual(found[1]!.wrote, [{ start: "$0801", end: "$0900" }], "the mover wrote the payload over the stub");
  assert.deepEqual(found[2]!.wrote, [{ start: "$0801", end: "$0840" }], "the payload wrote over its own start code");
});

test("a capture keeps the program that a mover wrote back over the first stage, also at a later arrival after a runUntil step", { skip: liveSkip, timeout: 300_000 }, async () => {
  const first = await unpack("capture", "self-overwriting.prg", "--until", "$0801", "--out", "unpacked/first", "--timeout-frames", "100");
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.deepEqual(first.json.segments, [{ start: "$0801", end: "$0900" }], "the stub at $080c ran before the mover wrote over it");

  writeFileSync(join(project, "to-loop.json"), JSON.stringify([{ runUntil: { target: { kind: "address", address: "$0850" }, timeoutFrames: 100 } }]));
  const second = await unpack("capture", "self-overwriting.prg", "--steps", "to-loop.json", "--until", "$0801", "--out", "unpacked/second", "--timeout-frames", "200");
  assert.equal(second.status, 0, JSON.stringify(second.json));
  const image = JSON.parse(readFileSync(join(project, "unpacked", "second", "image.json"), "utf8")) as { segments: unknown; stages: Array<{ entry: string }> };
  assert.deepEqual(image.stages.map((stage) => stage.entry), ["$080c", "$0340", "$0801", "$0801"], "the stages of the runUntil step are tracked");
  assert.deepEqual(image.segments, [{ start: "$0801", end: "$0900", writtenBy: 2, file: "segment-0801-0900.prg" }], "the mover at $0340 is loader code");

  const staged = await unpack("stages", "self-overwriting.prg", "--steps", "to-loop.json", "--frames", "100");
  assert.equal(staged.status, 0, JSON.stringify(staged.json));
  assert.deepEqual((staged.json.stages as Array<{ entry: string }>).map((stage) => stage.entry), ["$080c", "$0340", "$0801", "$0801"]);
});

test("a routine that the program writes and calls, and that returns, starts no stage", { skip: liveSkip, timeout: 300_000 }, async () => {
  const { status, json } = await unpack("stages", "generated-call.prg", "--frames", "100");
  assert.equal(status, 0, JSON.stringify(json));
  const found = json.stages as Array<{ entry: string; next?: string; wrote: Array<{ start: string; end: string }> }>;
  assert.deepEqual(found.map((stage) => [stage.entry, stage.next]), [["$080d", undefined]], JSON.stringify(found));
  assert.deepEqual(found[0]!.wrote, [{ start: "$9e00", end: "$9e7f" }]);
});
