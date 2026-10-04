import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "./processes.ts";
import { standIn } from "./standin.testkit.ts";
import { DXA_VERSION, localToolStatus, versionLine } from "./status.ts";

const skip = process.platform === "win32" ? "the stand-in tools are shell scripts" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-status-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("a version line is found among notices and colour codes", () => {
  const output = "\u001b[97;40mOPENCBM\u001b[0m: opening dynamic library libopencbm.so failed!\nc1541 (VICE 3.10)\n";
  assert.equal(versionLine(output, /^c1541 \(VICE \d/), "c1541 (VICE 3.10)");
  assert.equal(versionLine("nothing useful", /^c1541 \(VICE \d/), undefined);
});

test("dxa's version line is found also where it names itself by its full Windows path", () => {
  assert.equal(versionLine("dxa v0.1.5 -- symbolic 65xx disassembler\n", DXA_VERSION), "dxa v0.1.5 -- symbolic 65xx disassembler");
  const windows = "D:\\a\\_temp\\dxa-0.1.5\\dxa.exe: option requires an argument -- h\r\nD:\\a\\_temp\\dxa-0.1.5\\dxa.exe v0.1.5 -- symbolic 65xx disassembler\r\n";
  assert.match(versionLine(windows, DXA_VERSION) ?? "", /dxa\.exe v0\.1\.5/);
  assert.equal(versionLine("dxarchive v2", DXA_VERSION), undefined);
});

test("the local tools are reported as running, missing, or found but not running", { skip, timeout: 30_000 }, async () => {
  const ghidra = join(scratch, "ghidra");
  mkdirSync(join(ghidra, "support"), { recursive: true });
  mkdirSync(join(ghidra, "Ghidra"));
  writeFileSync(join(ghidra, "Ghidra", "application.properties"), "application.version=12.1.3\napplication.release.name=PUBLIC\n");
  standIn(join(ghidra, "support"), "analyzeHeadless", ["Headless Analyzer Usage: analyzeHeadless"], 1);
  const supervisor = new ProcessSupervisor();
  const context = (env: NodeJS.ProcessEnv) => ({ supervisor, signal: new AbortController().signal, env: { PATH: "/usr/bin:/bin", ...env } });

  const working = await localToolStatus(
    context({
      C64RT_ACME: standIn(scratch, "acme", ["This is ACME, release 0.97"]),
      // dxa -V exits 1 after its version: that still counts as running.
      C64RT_DXA: standIn(scratch, "dxa", ["dxa v0.1.5 -- symbolic 65xx disassembler"], 1),
      C64RT_GHIDRA: ghidra,
    }),
  );
  assert.deepEqual(
    working.map((tool) => [tool.name, tool.runs, tool.version]),
    [
      ["ACME", true, "This is ACME, release 0.97"],
      ["dxa", true, "dxa v0.1.5 -- symbolic 65xx disassembler"],
      ["Ghidra", true, "Ghidra 12.1.3"],
    ],
  );

  const broken = await localToolStatus(context({ C64RT_ACME: standIn(scratch, "bad-acme", ["something went wrong"], 3), C64RT_DXA: join(scratch, "no-dxa") }));
  const [acme, dxa, ghidraStatus] = broken;
  assert.deepEqual([acme?.found, acme?.runs], [true, false]);
  assert.match(acme!.problem!, /exit 3/);
  assert.deepEqual([dxa?.found, dxa?.runs], [false, false]);
  assert.match(dxa!.problem!, /C64RT_DXA/);
  assert.equal(ghidraStatus?.found, false);
});
