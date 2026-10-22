// The c64-packer script: packs and crunches PRG files of the project into one
// C64 program that unpacks itself, with Exomizer, which it runs itself. It
// unpacks the result again in the emulator of Exomizer and checks the bytes
// and the entry before it writes the program.

import { posix } from "node:path";

import { findHandoffs, parseTokenized, prgRange } from "#src/c64.ts";
import { formatAddress } from "#src/address.ts";
import { compareBuild, mergedPrograms } from "#src/compare.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { pack } from "#src/native/exomizer.ts";
import { localToolContext } from "#src/native/local.ts";
import { OPTIONS, reply, runScript, UsageError } from "#src/script.ts";

/** CPU cycles in one second of a PAL C64. */
const PAL_CYCLES_PER_SECOND = 985_248;

/** The SYS address of the BASIC line of a PRG at $0801, or the reason that there is none. */
function sysEntry(program: Uint8Array): number | string {
  const load = prgRange(program).start;
  if (load !== 0x0801) return `It loads at ${formatAddress(load)}, not at $0801 where BASIC starts.`;
  const tokenized = parseTokenized(program);
  if ("reason" in tokenized) return tokenized.reason;
  const sys = findHandoffs(tokenized.lines).find((handoff) => handoff.kind === "sys");
  if (sys === undefined) return "Its BASIC program has no SYS.";
  if (!("address" in sys)) return `Its SYS in line ${sys.line} has the argument ${sys.expression}, which needs run-time values.`;
  return sys.address;
}

const samePath = (a: string, b: string) => posix.normalize(a.replaceAll("\\", "/")) === posix.normalize(b.replaceAll("\\", "/"));

await runScript({
  name: "packer",
  summary: "Packs and crunches PRG files of the project into one C64 program that unpacks itself, with Exomizer, and checks that it unpacks to the same bytes.",
  names: knowledgeNames,
  commands: [
    {
      name: "pack",
      summary:
        "Packs the PRG files into one program that unpacks itself and starts at the entry, and checks it in the emulator of Exomizer. result is PASS when it unpacks to the bytes of the inputs and jumps to the entry, FAIL when it does not (no program is written), and INCONCLUSIVE when the check does not hold all bytes of the inputs.",
      subjects: [{ name: "<input.prg>", help: "a PRG in the project. Give more files to put them into one program: in load order, a later file wins where two overlap", list: true }],
      options: {
        out: { ...OPTIONS.out, output: "file", value: "<file.prg>", help: "where to write the packed program, relative to the project folder", required: true },
        entry: { ...OPTIONS.entry, help: "where the program starts after the unpack, $0400 or above. Without it, the SYS address of the BASIC line of the first input" },
        "exit-memory": { kind: "number", value: "<value>", min: 0x34, max: 0x37, help: "the value of $01 when the program starts, $34 to $37, for example '$35'. Without it, $37: BASIC, KERNAL and I/O. With it, the program starts with interrupts off" },
      },
      notes: "The packed program loads at $0801 and starts with RUN. The unpacker uses $0334 to $03ff and the zero page while it runs.",
      run: async (call) => {
        const files = call.rest(0);
        const out = call.string("out")!;
        const same = files.find((file) => samePath(file, out));
        if (same !== undefined) throw new UsageError(`--out ${out} is the input ${same}. Write the packed program to a different file.`);
        const programs = files.map((file) => {
          const { bytes } = readProjectFile(file, { what: file });
          try {
            return { file, bytes, ...prgRange(bytes) };
          } catch (error) {
            if (isRefusal(error)) throw new Refusal("invalid-input", `${file} is not a PRG: ${error.message}`);
            throw error;
          }
        });
        let entry = call.address("entry");
        if (entry === undefined) {
          const found = sysEntry(programs[0]!.bytes);
          if (typeof found === "string") throw new UsageError(`There is no SYS address in ${files[0]}. ${found} Give --entry with the start address of the program.`);
          entry = found;
        }
        const exitMemory = call.count("exit-memory");
        const packed = await pack({ programs: programs.map((program) => program.bytes), entry, ...(exitMemory === undefined ? {} : { exitMemory }) }, localToolContext());

        const reference = mergedPrograms(programs);
        const check = compareBuild(packed.unpacked, reference);
        const entryReached = packed.entry === entry;
        const different = !entryReached || check.segments.some((segment) => segment.result === "different");
        const result = different ? "FAIL" : check.identical ? "PASS" : "INCONCLUSIVE";
        const unpackedBytes = reference.segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0);
        const body = {
          result,
          // A program that does not unpack to its inputs is not written.
          ...(different ? {} : writeReported(out, packed.program, { what: "--out" })),
          packedBytes: packed.program.length,
          unpackedBytes,
          percent: Math.round((packed.program.length / unpackedBytes) * 1000) / 10,
          entry: formatAddress(entry),
          ...(exitMemory === undefined ? {} : { exitMemory: `$${exitMemory.toString(16)}` }),
          ...(packed.cycles === undefined ? {} : { unpackSeconds: Math.round((packed.cycles / PAL_CYCLES_PER_SECOND) * 10) / 10 }),
          inputs: programs.map((program) => ({ file: program.file, loadRange: { start: formatAddress(program.start), end: formatAddress(program.end) }, bytes: program.body.length })),
          check: { entry: formatAddress(packed.entry), ...check },
        };
        const hint =
          result === "PASS"
            ? `Run ${out} in the emulator with RUN. Make sure that the program starts and works.`
            : result === "INCONCLUSIVE"
              ? `The check does not hold all bytes of the inputs. Run ${out} in the emulator, and examine the memory of each segment in check.segments that is not covered.`
              : "The packed program does not unpack to the inputs, or it jumps to a different entry. The script did not write it. Do not use it. Give the call and check to the user.";
        return reply(body, { hint });
      },
    },
  ],
});
