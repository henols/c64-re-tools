// Against real VICE through the Host Runtime and the MCP: load a fixture PRG, run, send input, run until a known address,
// advance an exact frame count, read memory and registers, capture the
// screen. The scenario runs twice and gives identical results, with no
// wall-clock waits anywhere in it.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { formatC64Address } from "../../../src/c64.ts";
import { readPng } from "../../../src/graphics.testkit.ts";
import { FRAMES_SEEN, joystickCounterPrg, LEFT_SEEN } from "../../fixtures/prg/joystick-counter.ts";
import { scratchDir, startMcp } from "../../kit.ts";
import { callTool, viceFlawsOfLive, liveSkip, startHost, stopHosts, toolResult } from "./live.ts";

after(stopHosts);
const project = scratchDir("scenario");

/** The scenario. Every step is driven by emulated time, so two runs must agree exactly. */
async function scenario(client: Client) {
  // The reset stops at the reset vector and says where.
  assert.deepEqual(await toolResult(client, "c64_reset", { mode: "hard" }), { state: "stopped", pc: "$fce2" });
  const loaded = await toolResult(client, "c64_program_load", { path: "build/counter.prg" });
  assert.deepEqual(loaded, { state: "stopped", loadAddress: "$c000", size: joystickCounterPrg.length - 2 });
  await callTool(client, "c64_registers", { action: "write", values: { pc: "$c000" } });
  await callTool(client, "c64_joystick", { port: 2, direction: "left" });

  const reached = await toolResult(client, "c64_run_until", { target: { kind: "address", address: formatC64Address(LEFT_SEEN) }, timeoutFrames: 10 });
  assert.deepEqual(reached, { reached: true, stopReason: "target", state: "stopped", pc: formatC64Address(LEFT_SEEN), space: "c64" });

  const advanced = await toolResult(client, "c64_execution", { action: "advance-frames", count: 20 });
  assert.deepEqual(advanced, { state: "stopped", pc: formatC64Address(LEFT_SEEN), space: "c64", advancedFrames: 20, stopReason: "frames" });

  const counters = await toolResult(client, "c64_memory_read", { address: formatC64Address(FRAMES_SEEN), size: 2 });
  // One frame to reach the target, then 20 more; left was held for the 20.
  assert.deepEqual(counters, { address: "$c100", size: 2, data: "1514" });
  const registers = await toolResult(client, "c64_registers", { action: "read" });

  const screen = await callTool(client, "c64_screen", { action: "capture" });
  const image = (screen.content as Array<{ type: string; data?: string }>).find((block) => block.type === "image")!;
  const png = Buffer.from(image.data!, "base64");
  assert.equal(readPng(png).pixels[0], 2, "the border is red while left is held");

  await callTool(client, "c64_joystick", { port: 2, direction: "center" });
  await callTool(client, "c64_execution", { action: "advance-frames", count: 5 });
  const after = await toolResult(client, "c64_memory_read", { address: formatC64Address(FRAMES_SEEN), size: 2 });
  // Five more frames. The INC at LEFT_SEEN that the stop interrupted still runs once; then left is no longer seen.
  assert.equal(after.data, "1a15");
  return { loaded, reached, advanced, counters, registers, png: png.toString("base64"), after };
}

test("a scenario of load, input, run-until, frame advance, reads and a capture gives the same results twice", { skip: liveSkip, timeout: 180_000 }, async (t) => {
  mkdirSync(join(project, "build"));
  writeFileSync(join(project, "build", "counter.prg"), joystickCounterPrg);
  // The version as the host reads it: a VICE whose known flaw breaks the joystick refuses it.
  const joystickBroken = (await viceFlawsOfLive()).some((flaw) => flaw.breaks.includes("joystick"));

  const host = await startHost();
  const { client } = await startMcp(host.address, { cwd: project });
  try {
    if (joystickBroken) {
      const refused = (await client.callTool({ name: "c64_joystick", arguments: { port: 2, direction: "left" } })) as CallToolResult;
      const text = JSON.stringify(refused.content);
      assert.equal(refused.isError, true);
      assert.match(text, /not-implemented/);
      assert.doesNotMatch(text, /VICE|3\.\d+|#2202/, "the agent learns no VICE version");
      t.skip("this VICE has a flaw that breaks the joystick: c64_joystick is not implemented");
      return;
    }
    const first = await scenario(client);
    const second = await scenario(client);
    assert.deepEqual(second, first);
  } finally {
    await client.close();
    await host.stop();
  }
});
