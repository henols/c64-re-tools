import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../native/processes.ts";
import { standIn } from "../../native/standin.testkit.ts";
import { hostStatus } from "./status.ts";

const skip = process.platform === "win32" ? "the stand-in tools are shell scripts" : false;
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-host-status-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("host.status reports VICE and the tools that come with it, and nothing else", { skip, timeout: 30_000 }, async () => {
  const env = {
    PATH: "/usr/bin:/bin",
    C64RT_VICE: standIn(scratch, "x64sc", ["x64sc (VICE 3.9)"]),
    C64RT_C1541: standIn(scratch, "c1541", ["\u001b[97;40mOPENCBM\u001b[0m: no library", "c1541 (VICE 3.10)"]),
    C64RT_PETCAT: join(scratch, "no-petcat"),
  };
  const { result } = await hostStatus({ supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env });
  assert.deepEqual(
    result.tools.map((tool) => [tool.name, tool.found, tool.runs, tool.version]),
    [
      ["VICE (x64sc)", true, true, "x64sc (VICE 3.9)"],
      ["c1541", true, true, "c1541 (VICE 3.10)"],
      ["petcat", false, false, undefined],
    ],
  );
});

test("host.status reports a tool from a VICE older than 3.9 as not working, with the remedy", { skip, timeout: 30_000 }, async () => {
  const env = {
    PATH: "/usr/bin:/bin",
    C64RT_VICE: standIn(scratch, "x64sc-old", ["x64sc (VICE 3.7.1)"]),
    C64RT_C1541: standIn(scratch, "c1541-current", ["c1541 (VICE 3.9)"]),
    C64RT_PETCAT: standIn(scratch, "petcat-old", ["petcat (VICE 3.8)"]),
  };
  const supervisor = new ProcessSupervisor();
  try {
    const { result } = await hostStatus({ supervisor, signal: new AbortController().signal, env });
    assert.deepEqual(
      result.tools.map((tool) => [tool.name, tool.found, tool.runs]),
      [
        ["VICE (x64sc)", true, false],
        ["c1541", true, true],
        ["petcat", true, false],
      ],
    );
    assert.match(result.tools[0]!.problem!, /VICE 3\.7, and c64-re-tools needs VICE 3\.9 or later\. Install VICE 3\.9 or later/);
    assert.match(result.tools[2]!.problem!, /VICE 3\.8, and c64-re-tools needs VICE 3\.9 or later\. Install VICE 3\.9 or later/);
  } finally {
    await supervisor.stopAll();
  }
});
