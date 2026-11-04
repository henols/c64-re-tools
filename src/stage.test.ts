// The show stage of a start screen from a captured stage: its plan, and the
// bytes of the stage that a build of start_screen_stage.asm holds. The build
// of the plan with ACME is in test/skills/c64-source.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";

import { Refusal } from "./errors.ts";
import type { StartScreenRow } from "./knowledge/read.ts";
import { startScreenPlan } from "./knowledge/start-screen.ts";
import { planStage, stageFileMismatch, stageKey, stageOfBuild, type StageInput } from "./stage.ts";

test("the show stage runs where the KERNAL can be in, and puts the loader bytes under the stage in a stash; without room it refuses with the free ranges", () => {
  const row: StartScreenRow = { space: "c64", mode: "multicolour", screen: 0xcc00, bitmap: 0xe000, colours: 0x8328, border: 0, background: 6, stage: "bank1", call: 0x0a00, origin: "llm", revision: "r" };
  const stageInput = (inner: StageInput["inner"], stage: StageInput["stage"]): StageInput => ({ inner, innerStart: 0x080d, innerPort: 0x37, stage, row, plan: startScreenPlan(row), settings: [], header: [], key: "0123456789abcdef", codeSize: 300 });
  const plan = planStage(stageInput([{ start: 0x0801, body: new Uint8Array(0x500) }], [{ start: 0x0a00, body: new Uint8Array(0x20) }, { start: 0xcc00, body: new Uint8Array(1000) }]));
  assert.equal(plan.code, 0x0400, "the first free range that the code fits");
  assert.deepEqual(plan.stash.map((item) => item.target), [{ start: 0x0a00, end: 0x0a1f }]);
  const at = plan.stash[0]!.at;
  assert.ok(at >= 0x0400 + 300 + 8 && at + 0x1f <= 0x0800, "the stash is in free memory after the code");
  assert.match(plan.text, /c64_source_ss_call = \$0a00 /);
  assert.match(plan.text, new RegExp(`!word 32, \\$${at.toString(16).padStart(4, "0")}, \\$0a00 ; \\$0a00-\\$0a1f of the loader`));
  assert.match(plan.text, /jmp \$080d\n/);
  // The key of the start screen is in the text, and only there.
  assert.equal(stageKey(plan.text), "0123456789abcdef");
  const unkeyed = plan.text.replace(/^; The start screen key .*\n/m, "");
  assert.equal(stageKey(unkeyed), undefined);
  // A build with other switch values takes the bytes of the stage only from a file with the key of the knowledge.
  assert.equal(stageFileMismatch(plan.text, "0123456789abcdef", "src", "bank1"), undefined);
  assert.match(stageFileMismatch(unkeyed, "0123456789abcdef", "src", "bank1")!, /^start_screen_stage\.asm of src has no start screen key, .* Generate the source with the loader again\.$/);
  assert.match(stageFileMismatch(plan.text, "fedcba9876543210", "src", "bank1")!, /^start_screen_stage\.asm of src is not of the start screen of the knowledge now: the start screen or the stage bank1 changed /);
  // The colour RAM of the capture is in the show code: the start screen copies it from there.
  const { colours: _colours, ...picture } = row;
  const fromCapture: StartScreenRow = { ...picture, colourRam: true };
  const withColours = planStage({ ...stageInput([{ start: 0x0801, body: new Uint8Array(0x500) }], [{ start: 0xcc00, body: new Uint8Array(1000) }]), row: fromCapture, plan: startScreenPlan(fromCapture), colourRam: Uint8Array.from({ length: 1000 }, (_, index) => index & 0x0f), codeSize: 1300 });
  assert.match(withColours.text, /\nc64_source_ss_colour_mode = \$02\n/);
  assert.match(withColours.text, /\nc64_source_ss_colours = c64_source_stage_colours\n/);
  assert.match(withColours.text, /\nc64_source_stage_colours\n {8}!byte \$00,\$01,\$02,/);
  assert.equal((withColours.text.split("\nc64_source_stage_colours\n")[1]!.split("c64_source_stage_code_end")[0]!.match(/\$[0-9a-f]{2}/g) ?? []).length, 1000);
  assert.throws(() => planStage(stageInput([{ start: 0x0400, body: new Uint8Array(0xcc00) }], [{ start: 0xe000, body: new Uint8Array(8000) }])), /The show stage needs 308 free bytes for its code in \$0400-\$9fff or \$c000-\$cfff.* The largest free ranges outside the loader and the bytes of the stage: \$d000-\$dfff \(4096 bytes\)/);
});

test("a build of start_screen_stage.asm gives the bytes of the stage between the labels of each part, and the colour RAM of the capture", () => {
  // The build: the show code at $c000 with the colours at $c010, and the parts at $c400 and $c800.
  const build = new Uint8Array(2 + 0x0c00);
  build.set([0x00, 0xc0]);
  const colours = Uint8Array.from({ length: 1000 }, (_, index) => index & 0x0f);
  build.set(colours, 2 + 0x10);
  build.set([1, 2, 3], 2 + 0x0400);
  build.set([4, 5], 2 + 0x0800);
  const label = (name: string, address: number) => ({ name, kind: "address" as const, address, used: false });
  const symbols = [label("c64_source_stage", 0xc000), label("c64_source_stage_colours", 0xc010), label("stage_from_c800", 0xc800), label("stage_end_c800", 0xc802), label("stage_from_c400", 0xc400), label("stage_end_c400", 0xc403)];
  const stage = stageOfBuild(build, symbols, true);
  assert.deepEqual(stage.parts.map((part) => [part.start, [...part.body]]), [[0xc400, [1, 2, 3]], [0xc800, [4, 5]]]);
  assert.deepEqual(stage.colourRam, colours);
  assert.equal(stageOfBuild(build, symbols, false).colourRam, undefined);
  const refused = (error: unknown) => error instanceof Refusal && error.code === "invalid-input" && /^start_screen_stage\.asm of the source does not hold the bytes of the stage /.test(error.message);
  assert.throws(() => stageOfBuild(build, symbols.slice(0, 2), false), refused);
  assert.throws(() => stageOfBuild(build, symbols.filter((symbol) => symbol.name !== "c64_source_stage_colours"), true), refused);
});
