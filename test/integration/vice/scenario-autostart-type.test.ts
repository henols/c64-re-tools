// A key typed right after autostart reaches the program: autostart returns
// only when the program runs, so its own RUN and the scenario's keys do not
// mix. Opt-in with C64RT_LIVE_VICE.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/native/processes.ts";
import { startHostServer, type HostServer, viceBackend } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { keyWaitPrg } from "../../fixtures/prg/key-wait.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";
import { readEnvelope } from "../../kit.ts";

const script = resolve(import.meta.dirname, "../../../skills/retro-testing/scripts/testing.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-autostart-type-"));
let server: HostServer | undefined;
after(async () => {
  await server?.close();
  rmSync(project, { recursive: true, force: true });
});

test("a type step right after autostart reaches the program", { skip: liveSkip, timeout: 300_000 }, async () => {
  writeFileSync(join(project, "game.prg"), keyWaitPrg);
  writeFileSync(join(project, "symbols.json"), "{}");
  writeFileSync(
    join(project, "key.json"),
    JSON.stringify({
      name: "takes a key after autostart",
      original: { program: "game.prg", symbols: "symbols.json" },
      rebuild: { program: "game.prg", symbols: "symbols.json" },
      steps: [{ autostart: true }, { type: { mode: "text", text: "X" } }, { runUntil: { target: { kind: "memory", address: "$c000", operator: "eq", value: 0x58 }, timeoutFrames: 600 } }, { observe: "key", memory: ["$c000"] }],
    }),
  );
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  server = await startHostServer({ port: 0, backends: { c64: viceBackend(viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })) } });
  const child = spawn(process.execPath, [...process.execArgv, script, "test", "key.json"], {
    cwd: project,
    env: { ...process.env, C64RT_HOST: `${server.host}:${server.port}` },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  const json = readEnvelope(stdout, status).json as Record<string, unknown>;
  assert.deepEqual(json, { result: "PASS", scenario: "takes a key after autostart", checkpoints: ["key"], differences: [] });
  assert.equal(status, 0);
});
