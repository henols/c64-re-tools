import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../processes.ts";
import { hostStatus, versionLine } from "./status.ts";

const skip = process.platform === "win32" ? "the stand-in tools are shell scripts" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-status-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** A stand-in executable that prints the given lines. */
function tool(name: string, lines: string[], exit = 0): string {
  const path = join(scratch, name);
  writeFileSync(path, `#!/bin/sh\n${lines.map((line) => `echo '${line}'`).join("\n")}\nexit ${exit}\n`);
  chmodSync(path, 0o755);
  return path;
}

test("a version line is found among notices and colour codes", () => {
  const output = "\u001b[97;40mOPENCBM\u001b[0m: opening dynamic library libopencbm.so failed!\nc1541 (VICE 3.10)\n";
  assert.equal(versionLine(output, /^c1541 \(VICE \d/), "c1541 (VICE 3.10)");
  assert.equal(versionLine("nothing useful", /^c1541 \(VICE \d/), undefined);
});

test("each tool is reported as running, missing, or found but not running", { skip, timeout: 30_000 }, async () => {
  const ghidra = join(scratch, "ghidra");
  mkdirSync(join(ghidra, "support"), { recursive: true });
  mkdirSync(join(ghidra, "Ghidra"));
  writeFileSync(join(ghidra, "Ghidra", "application.properties"), "application.version=12.1.3\napplication.release.name=PUBLIC\n");
  writeFileSync(join(ghidra, "support", "analyzeHeadless"), "#!/bin/sh\necho 'Headless Analyzer Usage: analyzeHeadless'\nexit 1\n");
  chmodSync(join(ghidra, "support", "analyzeHeadless"), 0o755);
  const env = {
    PATH: "/usr/bin:/bin",
    C64RT_VICE: tool("x64sc", ["x64sc (VICE 3.9)"]),
    C64RT_ACME: tool("acme", ["This is ACME, release 0.97"]),
    // dxa -V exits 1 after its version: that still counts as running.
    C64RT_DXA: tool("dxa", ["dxa v0.1.5 -- symbolic 65xx disassembler"], 1),
    C64RT_C1541: tool("c1541", ["something went wrong"], 3),
    C64RT_PETCAT: join(scratch, "no-such-petcat"),
    C64RT_GHIDRA: ghidra,
  };
  const { result } = await hostStatus({ supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env });
  const byName = Object.fromEntries(result.tools.map((entry) => [entry.name, entry]));
  assert.deepEqual(byName["VICE (x64sc)"], { name: "VICE (x64sc)", found: true, path: env.C64RT_VICE, version: "x64sc (VICE 3.9)", runs: true });
  assert.equal(byName.ACME?.version, "This is ACME, release 0.97");
  assert.equal(byName.dxa?.runs, true);
  assert.deepEqual([byName.c1541?.found, byName.c1541?.runs], [true, false]);
  assert.match(byName.c1541!.problem!, /exit 3/);
  assert.deepEqual([byName.petcat?.found, byName.petcat?.runs], [false, false]);
  assert.match(byName.petcat!.problem!, /C64RT_PETCAT/);
  assert.deepEqual([byName.Ghidra?.version, byName.Ghidra?.path], ["Ghidra 12.1.3", ghidra]);
});
