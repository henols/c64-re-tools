import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { C64RunSession, commandLimitMs, parseStatus } from "./c64run.ts";
import { ProcessSupervisor } from "./processes.ts";

const skip = process.platform === "win32" ? "the stand-in c64run is a shell script" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-c64run-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const STATE = "tick=0 sync=1 pc=fce2 a=00 x=00 y=00 s=fd p=16 line=0 cycle=7 hash=0123abcd";

/** A stand-in c64run: answers version, init, peek and quit; protocol and ROMs as given. */
function standInCore(name: string, options: { protocol?: number; roms?: boolean } = {}): string {
  const path = join(scratch, name);
  const init = options.roms === false ? 'echo "err init: no ROM /none/kernal-901227-03.bin (8192 bytes)"' : `echo "ok ${STATE}"`;
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      "while read cmd rest; do",
      '  case "$cmd" in',
      `    version) echo "ok c64run protocol=${options.protocol ?? 3} chips=test" ;;`,
      `    init) ${init} ;;`,
      '    peek) echo "ok 0102" ;;',
      "    hang) sleep 600 ;;",
      "    quit) exit 0 ;;",
      '    *) echo "err unknown $cmd" ;;',
      "  esac",
      "done",
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return path;
}

function context(env: NodeJS.ProcessEnv) {
  return { supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env: { PATH: "/usr/bin:/bin", ...env } };
}

test("a status answer gives the machine state and the word after ok", () => {
  const state = parseStatus(`ok reached ${STATE}`);
  assert.deepEqual([state.tick, state.sync, state.pc, state.s, state.p, state.cycle, state.hash, state.word], [0, true, 0xfce2, 0xfd, 0x16, 7, "0123abcd", "reached"]);
  assert.throws(() => parseStatus("ok"), /no machine state/);
});

test("a session sends commands in order and turns an err answer into operation-failed", { skip, timeout: 20_000 }, async () => {
  const run = context({ C64RT_C64RUN: standInCore("c64run") });
  const session = await C64RunSession.open(run);
  try {
    assert.equal((await session.init()).pc, 0xfce2);
    assert.deepEqual([...(await session.peek(0x0400, 2))], [1, 2]);
    await assert.rejects(session.command("fly"), (error: unknown) => error instanceof WireFailure && error.code === "operation-failed" && /c64run fly: unknown fly/.test(error.message));
  } finally {
    await session.close();
  }
  assert.equal(run.supervisor.size, 0);
});

test("a run to a far tick gets the time of its cycles at 1 million per second; other commands get 30 s", () => {
  assert.equal(commandLimitMs("peek 0400 2"), 30_000);
  assert.equal(commandLimitMs("run-sync"), 30_000);
  assert.equal(commandLimitMs("run 600000000"), 630_000);
  assert.equal(commandLimitMs("run-pc c000 60000000"), 90_000);
  assert.equal(commandLimitMs("run-reads c000 dc00 3 120000000"), 150_000);
});

test("a command that c64run does not answer in time fails, stops the core and fails every later command", { skip, timeout: 20_000 }, async () => {
  const run = context({ C64RT_C64RUN: standInCore("c64run-hang") });
  const session = await C64RunSession.open(run);
  const stopped = (error: unknown) => error instanceof WireFailure && error.code === "operation-failed" && /c64run hang did not answer in 1 s; the core is stopped/.test(error.message);
  try {
    await assert.rejects(session.command("hang", 300), stopped);
    await assert.rejects(session.command("peek 0400 2"), stopped);
    // The stop of the core's group (its sleep too) is under way; close waits for it.
  } finally {
    await session.close();
  }
  assert.equal(run.supervisor.size, 0);
});

test("a missing c64run, another protocol or missing ROMs refuse with installation-incomplete", { skip, timeout: 20_000 }, async () => {
  const refused = (pattern: RegExp) => (error: unknown) => error instanceof WireFailure && error.code === "installation-incomplete" && pattern.test(error.message);
  await assert.rejects(C64RunSession.open(context({ C64RT_C64RUN: join(scratch, "no-c64run") })), refused(/C64RT_C64RUN/));
  await assert.rejects(C64RunSession.open(context({})), refused(/c64run is not installed on this machine/));
  await assert.rejects(C64RunSession.open(context({ C64RT_C64RUN: standInCore("c64run-1", { protocol: 1 }) })), refused(/protocol 1; c64-re-tools needs protocol 3/));
  const session = await C64RunSession.open(context({ C64RT_C64RUN: standInCore("c64run-no-roms", { roms: false }) }));
  try {
    await assert.rejects(session.init(), refused(/no ROM .*dev container of c64-re-tools/));
  } finally {
    await session.close();
  }
});
