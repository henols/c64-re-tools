import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { ProcessSupervisor } from "./processes.ts";
import { parseZxStatus, ZxRunSession } from "./zxrun.ts";

const skip = process.platform === "win32" ? "the stand-in zxrun is a shell script" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-zxrun-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const STATE = "tick=0 sync=1 pc=8000 af=0044 bc=7ffe de=0000 hl=9002 ix=9000 iy=5c3a sp=8ff0 im=1 iff=1 line=12 cycle=34 hash=0123abcd";

/** A stand-in zxrun: answers version, init, load-z80 and quit; protocol and ROM as given. */
function standInCore(name: string, options: { protocol?: number; roms?: boolean } = {}): string {
  const path = join(scratch, name);
  const init = options.roms === false ? 'echo "err init: no ROM /none/48.rom (16384 bytes)"' : `echo "ok ${STATE}"`;
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      "while read cmd rest; do",
      '  case "$cmd" in',
      `    version) echo "ok zxrun protocol=${options.protocol ?? 1} chips=test" ;;`,
      `    init|load-z80) ${init} ;;`,
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

test("a zxrun status answer gives the Z80 state and the word after ok", () => {
  const state = parseZxStatus(`ok reached ${STATE}`);
  assert.deepEqual([state.tick, state.sync, state.pc, state.af, state.iy, state.im, state.iff, state.line, state.cycle, state.hash, state.word], [0, true, 0x8000, 0x44, 0x5c3a, 1, true, 12, 34, "0123abcd", "reached"]);
  assert.throws(() => parseZxStatus("ok"), /no machine state/);
});

test("a zxrun session loads a snapshot and refuses a missing core, another protocol or a missing ROM", { skip, timeout: 20_000 }, async () => {
  const run = context({ C64RT_ZXRUN: standInCore("zxrun") });
  const session = await ZxRunSession.open(run);
  try {
    assert.equal((await session.loadZ80("/any.z80")).pc, 0x8000);
    await assert.rejects(session.command("fly"), (error: unknown) => error instanceof WireFailure && error.code === "operation-failed" && /zxrun fly: unknown fly/.test(error.message));
  } finally {
    await session.close();
  }
  assert.equal(run.supervisor.size, 0);
  const refused = (pattern: RegExp) => (error: unknown) => error instanceof WireFailure && error.code === "installation-incomplete" && pattern.test(error.message);
  await assert.rejects(ZxRunSession.open(context({})), refused(/zxrun is not installed on this machine/));
  await assert.rejects(ZxRunSession.open(context({ C64RT_ZXRUN: standInCore("zxrun-2", { protocol: 2 }) })), refused(/protocol 2; c64-re-tools needs protocol 1/));
  const noRom = await ZxRunSession.open(context({ C64RT_ZXRUN: standInCore("zxrun-no-rom", { roms: false }) }));
  try {
    await assert.rejects(noRom.init(), refused(/no ROM .*install-zxrun/));
  } finally {
    await noRom.close();
  }
});
