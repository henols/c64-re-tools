// The c64-basic script: decodes a project C64 BASIC V2 program with petcat
// through the Host Runtime and reports its machine-code handoffs.

import { statSync } from "node:fs";

import { formatC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { decodeBasic } from "#src/host-client/tools.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript } from "#src/script.ts";

await runScript({
  name: "basic",
  summary: "Decodes a C64 BASIC V2 program with petcat and reports its machine-code handoffs: SYS, USR and the vectors that the BASIC lines set.",
  commands: [
    {
      name: "list",
      summary: "The BASIC lines of a PRG, where the BASIC ends, and the handoffs to machine code.",
      subjects: [{ name: "<program>", help: "a PRG file, relative to the project folder" }],
      run: async (call) => {
        const program = call.subject(0);
        const result = await decodeBasic({ program });
        if (!result.decoded) throw new Refusal("invalid-input", `${program} is no BASIC program: ${result.reason}`);
        const size = statSync(resolveProjectPath(program)).size - 2;
        const end = result.loadAddress + size - 1;
        return {
          loadRange: { start: formatC64Address(result.loadAddress), end: formatC64Address(end) },
          // From here to the end of the load range, the file holds no BASIC (often machine code).
          basicEnd: result.basicEnd <= end ? formatC64Address(result.basicEnd) : null,
          listing: result.listing,
          handoffs: result.handoffs.map((handoff) => ("address" in handoff ? { ...handoff, address: formatC64Address(handoff.address) } : handoff)),
        };
      },
    },
  ],
});
