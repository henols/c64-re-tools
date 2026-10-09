// The VICE tools on the host must come from a VICE that c64-re-tools works
// with. Each executable is asked once for its version; a version that
// cannot be read is refused, as is one that is too old.

import { tmpdir } from "node:os";

import { WireFailure } from "../../protocol.ts";
import { isOlderThanMinimum, MIN_VICE, viceVersionOf, type ToolSpec } from "../../native/discover.ts";
import { runToolOrFail, type ToolContext } from "../../native/run.ts";

const VERSION_TIMEOUT_MS = 30_000;
const checked = new Map<string, Promise<void>>();

/** Refuses a tool from a VICE older than MIN_VICE, or one whose VICE version cannot be read, by name and with the remedy. */
export function requireMinimumVersion(tool: ToolSpec, executable: string, context: ToolContext): Promise<void> {
  let check = checked.get(executable);
  if (check === undefined) {
    // Every caller waits for the same check, so no caller's cancel may stop it; its own time limit bounds it.
    const shared: ToolContext = { ...context, signal: new AbortController().signal };
    check = (async () => {
      const run = await runToolOrFail(tool.name, `The ${tool.name} version check`, { argv: [executable, "-version"], cwd: tmpdir(), timeoutMs: VERSION_TIMEOUT_MS }, shared);
      const version = viceVersionOf(`${run.stdout}\n${run.stderr}`);
      if (version === undefined) {
        throw new WireFailure(
          "installation-incomplete",
          `${tool.name} (${executable}) does not tell its VICE version, and c64-re-tools needs VICE ${MIN_VICE.major}.${MIN_VICE.minor} or later. ${tool.remedy}`,
        );
      }
      if (isOlderThanMinimum(version)) {
        throw new WireFailure(
          "installation-incomplete",
          `${tool.name} (${executable}) comes from VICE ${version.major}.${version.minor}, and c64-re-tools needs VICE ${MIN_VICE.major}.${MIN_VICE.minor} or later. ${tool.remedy}`,
        );
      }
    })();
    // A refusal or a failed check is asked again next time: the user can install a newer VICE meanwhile.
    check.catch(() => checked.delete(executable));
    checked.set(executable, check);
  }
  return check;
}
