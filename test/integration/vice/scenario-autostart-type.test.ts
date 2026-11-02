// A key typed right after autostart reaches the program: autostart returns
// only when the program runs, so its own RUN and the scenario's keys do not
// mix. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { keyWaitPrg } from "../../fixtures/prg/key-wait.ts";
import { runScript, scratchDir, skillScript } from "../../kit.ts";
import { hostServer, liveSkip } from "./live.ts";

const project = scratchDir("autostart-type");
const host = hostServer();

test("a type step right after autostart reaches the program", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "game.prg"), keyWaitPrg);
  writeFileSync(join(project, "symbols.json"), "{}");
  writeFileSync(
    join(project, "key.json"),
    JSON.stringify({
      name: "takes a key after autostart",
      reference: { program: "game.prg", symbols: "symbols.json" },
      rebuild: { program: "game.prg", symbols: "symbols.json" },
      steps: [{ autostart: true }, { type: { mode: "text", text: "X" } }, { runUntil: { target: { kind: "memory", address: "$c000", operator: "eq", value: 0x58 }, timeoutFrames: 600 } }, { observe: "key", memory: ["$c000"] }],
    }),
  );
  const { status, json } = await runScript(skillScript("c64-testing", "testing.ts"), ["test", "key.json"], { cwd: project, host: await host() });
  assert.deepEqual(json, { result: "PASS", scenario: "takes a key after autostart", checkpoints: ["key"], differences: [] });
  assert.equal(status, 0);
});
