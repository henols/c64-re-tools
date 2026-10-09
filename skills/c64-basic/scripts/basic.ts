// The c64-basic script: decodes a project C64 BASIC V2 program with petcat
// through the Host Runtime and reports its machine-code handoffs.

import { statSync } from "node:fs";
import { parseArgs } from "node:util";

import { formatC64Address } from "#src/c64.ts";
import { decodeBasic } from "#src/host-client/tools.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";

const USAGE = `basic.ts <program>

<program> is a PRG file relative to the project directory. The result is one
JSON object. Addresses are $ and four hex digits.`;

async function run(argv: string[]): Promise<{ output: unknown; failed: boolean }> {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { help: { type: "boolean" } } });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 1) throw new UsageError("give one program");
  const program = positionals[0]!;
  const result = await decodeBasic({ program });
  if (!result.decoded) return { output: { decoded: false, reason: result.reason }, failed: true };
  const size = statSync(resolveProjectPath(program)).size - 2;
  const end = Math.min(0xffff, result.loadAddress + size - 1);
  return {
    output: {
      decoded: true,
      loadRange: { start: formatC64Address(result.loadAddress), end: formatC64Address(end) },
      // From here to the end of the load range, the file holds no BASIC (often machine code).
      basicEnd: result.basicEnd <= end ? formatC64Address(result.basicEnd) : null,
      listing: result.listing,
      handoffs: result.handoffs.map((handoff) => ("address" in handoff ? { ...handoff, address: formatC64Address(handoff.address) } : handoff)),
    },
    failed: false,
  };
}

await runScript(
  async () => {
    const { output, failed } = await run(process.argv.slice(2));
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE },
);
