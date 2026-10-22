// The spectrum-basic script: lists the Sinclair BASIC of a project file (a tape,
// a snapshot or the bytes of a program) and reports what the BASIC hands over
// to machine code: USR, CLEAR and LOAD "" CODE. Local decoding; nothing is stored.

import { formatAddress } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { reply, runScript } from "#src/script.ts";
import {
  cpuRam,
  findSinclairHandoffs,
  parseSinclairBasic,
  readSna,
  readTap,
  readTzx,
  readZ80,
  sinclairLineText,
  type SinclairHandoff,
  type SpectrumModel,
  type TapeBlock,
} from "#src/spectrum.ts";

const PROG = 0x5c53;
const VARS = 0x5c4b;
const E_LINE = 0x5c59;

const handoff = (item: SinclairHandoff) => ("address" in item && item.address !== undefined ? { ...item, address: formatAddress(item.address) } : item);

/**
 * The listing of a program, its handoffs and the size of its variables:
 * `bytes` are the program and its variables, the first `length` the program,
 * when a tape header or VARS gives that length. Bytes of the program after its
 * last line are hidden: LIST does not show them, and a loader can keep machine
 * code there. `at` is the address of the first byte, when it is known.
 */
function program(bytes: Uint8Array, length: number | undefined, model: SpectrumModel, what: string, at?: number) {
  const parsed = parseSinclairBasic(bytes, length);
  if ("reason" in parsed) throw new Refusal("invalid-input", `${what} is no BASIC program: ${parsed.reason}`, { hint: "Usually the bytes are machine code. Disassemble them from their load address." });
  const end = Math.min(length ?? parsed.variablesAt, bytes.length);
  const hidden = end - parsed.variablesAt;
  return {
    listing: parsed.lines.map((line) => sinclairLineText(line, model)),
    handoffs: findSinclairHandoffs(parsed.lines).map(handoff),
    variableBytes: bytes.length - end,
    ...(hidden > 0 ? { hiddenBytes: { offset: parsed.variablesAt, bytes: hidden, ...(at === undefined ? {} : { address: formatAddress(at + parsed.variablesAt) }) } } : {}),
  };
}

/** The programs of a tape (a header block and the data block after it), and the code files it holds. */
function tape(blocks: TapeBlock[], model: SpectrumModel) {
  const programs = [];
  const code = [];
  for (let index = 0; index < blocks.length; index++) {
    const header = blocks[index]!.header;
    const data = blocks[index + 1];
    if (header === undefined) continue;
    if (header.type === "code") code.push({ block: index, name: header.name, address: formatAddress(header.param1), length: header.length });
    if (header.type !== "program") continue;
    // The data block: the flag byte $ff, the program and its variables, the checksum.
    if (data?.bytes === undefined || data.flag !== 0xff || data.bytes.length !== header.length + 2) {
      programs.push({ block: index, name: header.name, problem: "No data block of the length that the header gives follows the header: the program uses its own loader, or the tape is cut." });
      continue;
    }
    programs.push({
      block: index,
      name: header.name,
      autostart: header.param1 < 0x8000 ? header.param1 : null,
      ...program(data.bytes.subarray(1, -1), header.param2, model, `The program ${header.name} at block ${index}`),
    });
  }
  return { programs, code };
}

type Listed = ReturnType<typeof program> & { block?: number; name?: string; problem?: string; from?: string };

/** The body with a hint: the machine code to disassemble, a handoff to find at run time, or a program without its data. */
function answer(body: { programs: Array<Partial<Listed>>; code?: Array<{ block: number; name: string; address: string }> }) {
  const hints: string[] = [];
  const handoffs = body.programs.flatMap((item) => item.handoffs ?? []);
  const usr = handoffs.filter((item) => item.kind === "usr");
  const known = usr.flatMap((item) => ("address" in item && item.address !== undefined ? [item.address] : []));
  const computed = usr.filter((item) => "computed" in item).map((item) => item.line);
  const missing = body.programs.filter((item) => item.problem !== undefined).map((item) => item.block);
  if (body.programs.every((item) => item.problem === undefined) && usr.length === 0) {
    hints.push("The BASIC has no USR. It can start machine code in another way, for example with a POKE of the error return at ERR_SP (23613 and 23614). Look in the listing for a POKE, a hidden number and a LOAD of another file.");
  }
  for (const item of body.programs) {
    if (item.hiddenBytes === undefined) continue;
    const where = item.hiddenBytes.address ?? `offset ${item.hiddenBytes.offset} of the program`;
    const named = item.name === undefined ? "The program" : `The program ${item.name}`;
    hints.push(`${named} has ${item.hiddenBytes.bytes} bytes after its last line at ${where}, which LIST does not show. Machine code can be there: disassemble them.`);
  }
  for (const address of new Set(known)) {
    const file = body.code?.find((item) => item.address === address);
    hints.push(file === undefined ? `Disassemble the machine code at ${address}.` : `Disassemble the machine code at ${address}. The CODE file ${file.name} at block ${file.block} loads to that address.`);
  }
  if (computed.length > 0) hints.push(`The USR address in line ${computed.join(", ")} comes from a calculation at run time. Find it in the emulator.`);
  if (missing.length > 0) hints.push(`The program at block ${missing.join(", ")} has no data block. Load the tape in the emulator and stop at the entry of the machine code.`);
  return hints.length === 0 ? body : reply(body, { hint: hints.join(" ") });
}

await runScript({
  name: "basic",
  summary: "Lists the Sinclair BASIC of a tape, a snapshot or a program, and reports its handoffs to machine code: USR, CLEAR and LOAD \"\" CODE.",
  commands: [
    {
      name: "list",
      summary: "The BASIC lines, the handoffs, and on a tape the code files.",
      subjects: [{ name: "<file>", help: "a .tap or .tzx tape, a .z80 or .sna snapshot, or the bytes of a program, relative to the project folder" }],
      options: {
        model: { kind: "choice", choices: ["48k", "128k"], value: "<model>", help: "the model for the keywords of $a3 and $a4 (SPECTRUM and PLAY only on the 128K). Default: the model of a snapshot, else 48k" },
      },
      run: (call) => {
        const path = call.subject(0);
        const file = readProjectFile(path, { what: "<file>" });
        const given = call.string("model") as SpectrumModel | undefined;
        if (file.type === "tap" || file.type === "tzx") {
          return answer(tape(file.type === "tap" ? readTap(file.bytes) : readTzx(file.bytes), given ?? "48k"));
        }
        if (file.type === "z80" || file.type === "sna") {
          const snapshot = file.type === "z80" ? readZ80(file.bytes) : readSna(file.bytes);
          const ram = cpuRam(snapshot);
          const word = (address: number) => ram[address - 0x4000]! | (ram[address - 0x4000 + 1]! << 8);
          // PROG, VARS and E_LINE: the program, its variables and the line that is edited follow each other.
          const [start, variables, edited] = [word(PROG), word(VARS), word(E_LINE)];
          if (start < 0x5c00 || variables < start || edited < variables) {
            throw new Refusal("invalid-input", `${path}: PROG is ${formatAddress(start)}, VARS ${formatAddress(variables)} and E_LINE ${formatAddress(edited)}, so the memory holds no BASIC program.`);
          }
          const bytes = ram.subarray(start - 0x4000, edited - 0x4000);
          return answer({ programs: [{ from: formatAddress(start), ...program(bytes, variables - start, given ?? snapshot.model, path, start) }] });
        }
        // The bytes of a program have no length of the program: its variables start at the first byte that starts no line.
        return answer({ programs: [{ from: "file", ...program(file.bytes, undefined, given ?? "48k", path) }] });
      },
    },
  ],
});
