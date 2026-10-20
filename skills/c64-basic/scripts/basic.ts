// The c64-basic script: decodes a project C64 BASIC V2 program with petcat
// through the Host Runtime and reports its machine-code handoffs. The SYS
// argument is calculated when it holds only numbers, pi, + - * / and brackets.

import { statSync } from "node:fs";

import { formatC64Address } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { decodeBasic } from "#src/host-client/tools.ts";
import { resolveProjectPath } from "#src/project.ts";
import { reply, runScript } from "#src/script.ts";

await runScript({
  name: "basic",
  summary: "Decodes a C64 BASIC V2 program and reports its machine-code handoffs: SYS and USR.",
  commands: [
    {
      name: "list",
      summary: "The BASIC lines of a PRG, where the BASIC ends, and the handoffs to machine code.",
      subjects: [{ name: "<program>", help: "a PRG file, relative to the project folder" }],
      run: async (call) => {
        const program = call.subject(0);
        const result = await decodeBasic({ program });
        if (!result.decoded) throw new Refusal("invalid-input", `${program} is no BASIC program: ${result.reason}`, { hint: "Usually the file is machine code. Disassemble it from its load address." });
        const size = statSync(resolveProjectPath(program)).size - 2;
        const end = result.loadAddress + size - 1;
        const handoffs = result.handoffs.map((handoff) => ("address" in handoff ? { ...handoff, address: formatC64Address(handoff.address) } : handoff));
        const body = {
          loadRange: { start: formatC64Address(result.loadAddress), end: formatC64Address(end) },
          // From here to the end of the load range, the file holds no BASIC (often machine code).
          basicEnd: result.basicEnd <= end ? formatC64Address(result.basicEnd) : null,
          listing: result.listing,
          handoffs,
        };
        const known = handoffs.flatMap((handoff) => ("address" in handoff ? [handoff.address] : []));
        const computed = handoffs.filter((handoff) => !("address" in handoff)).map((handoff) => handoff.line);
        const hints: string[] = [];
        if (handoffs.length === 0) hints.push("The BASIC starts no machine code with SYS or USR. Look in the listing for a POKE into a vector or a LOAD of another file.");
        if (known.length > 0) hints.push(`Disassemble the machine code at ${known.join(", ")}.`);
        if (computed.length > 0) hints.push(`The handoff address in line ${computed.join(", ")} comes from a calculation at run time. Find it in the emulator.`);
        return reply(body, { hint: hints.join(" ") });
      },
    },
  ],
});
