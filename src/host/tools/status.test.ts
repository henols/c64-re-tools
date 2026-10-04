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
