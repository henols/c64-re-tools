// Source → c64-assembler → ACME → PRG → c64_program_load → VICE reaches a
// known state. The skill script runs ACME itself; ACME never enters the MCP.
// Opt-in with C64RT_LIVE_VICE; also needs ACME.

import assert from "node:assert/strict";
import { cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ACME } from "../../../src/native/discover.ts";
import { runScriptSync, scratchDir, skillScript, startMcp, toolSkip } from "../../kit.ts";
import { liveSkip, startHost, stopHosts, toolResult } from "./live.ts";

const skip = liveSkip || toolSkip(ACME);

after(stopHosts);
const project = scratchDir("assembled");
cpSync(resolve(import.meta.dirname, "../../fixtures/asm/counter"), join(project, "src"), { recursive: true });

test("assembled source loads into VICE and reaches its known end state", { skip, timeout: 180_000 }, async () => {
  const host = await startHost();
  const hostAddress = host.address;

  // 1. The skill script assembles with ACME and writes the PRG into the project.
  const assembled = runScriptSync(skillScript("c64-assembler", "assembler.ts"), ["build", "src", "main.a", "--include", "lib", "--out", "build/counter.prg"], { cwd: project, host: hostAddress });
  assert.equal(assembled.status, 0, assembled.stdout);
  const build = assembled.json as { symbols: { listed: Array<{ name: string; address?: string; value?: string }> } };
  const valueOf = (name: string) => Number.parseInt(symbol(name).value!.slice(1), 16);
  const symbol = (name: string) => build.symbols.listed.find((entry) => entry.name === name)!;

  // 2. The MCP loads it from the same project and runs it to the known state.
  const { client } = await startMcp(hostAddress, { cwd: project });
  try {
    const loaded = await toolResult(client, "c64_program_load", { path: "build/counter.prg" });
    assert.equal(loaded.loadAddress, "$0801");
    await toolResult(client, "c64_registers", { action: "write", values: { pc: symbol("start").address } });
    const reached = await toolResult(client, "c64_run_until", { target: { kind: "address", address: symbol("done").address }, timeoutFrames: 50 });
    assert.equal(reached.stopReason, "target");
    const result = await toolResult(client, "c64_memory_read", { address: symbol("RESULT").value!, size: 1 });
    assert.equal(Number.parseInt(result.data as string, 16), valueOf("MAX"), "the counter reached MAX");
    const border = await toolResult(client, "c64_memory_read", { address: "$d020", size: 1 });
    assert.equal(Number.parseInt(border.data as string, 16) & 0x0f, valueOf("DONE_COLOR"));
  } finally {
    await client.close();
    await host.stop();
  }
});
