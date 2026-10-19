// The spectrum-media script: ZX Spectrum tapes (TAP, TZX), snapshots (.z80,
// .sna) and screens (.scr) in the project. It lists the blocks of a tape, writes
// the data of a block, gives the machine state of a snapshot and writes a screen
// as a PNG. Local decoding; nothing is stored.

import { formatAddress, formatByte } from "#src/address.ts";
import { Refusal } from "#src/errors.ts";
import { encodePng, SPECTRUM_PALETTE, spectrumScreenFrame } from "#src/graphics.ts";
import { readProjectFile, writeReported } from "#src/host-client/transfer.ts";
import { OPTIONS, reply, runScript, UsageError, type Call } from "#src/script.ts";
import { pagedBank, readSna, readTap, readTzx, readZ80, type SpectrumSnapshot, type TapeBlock } from "#src/spectrum.ts";

const SCREEN_BYTES = 6912;

function tapeBlocks(path: string): TapeBlock[] {
  const file = readProjectFile(path, { what: "<tape>" });
  if (file.type === "tap") return readTap(file.bytes);
  if (file.type === "tzx") return readTzx(file.bytes);
  throw new Refusal("invalid-input", `${path} is no tape: give a .tap or a .tzx file.`);
}

function snapshotOf(path: string, what: string): SpectrumSnapshot {
  const file = readProjectFile(path, { what });
  if (file.type === "z80") return readZ80(file.bytes);
  if (file.type === "sna") return readSna(file.bytes);
  throw new Refusal("invalid-input", `${path} is no snapshot: give a .z80 or a .sna file.`);
}

const showBlock = (block: TapeBlock, index: number) => ({
  block: index,
  kind: block.kind,
  ...(block.id === undefined ? {} : { id: formatByte(block.id) }),
  ...(block.flag === undefined ? {} : { flag: formatByte(block.flag), length: block.bytes!.length - 2, checksumOk: block.checksumOk }),
  ...(block.header === undefined
    ? {}
    : {
        header: {
          type: block.header.type,
          name: block.header.name,
          length: block.header.length,
          ...(block.header.type === "program"
            ? { autostart: block.header.param1 < 0x8000 ? block.header.param1 : null, programLength: block.header.param2 }
            : block.header.type === "code"
              ? { address: formatAddress(block.header.param1) }
              : {}),
        },
      }),
  ...(block.text === undefined ? {} : { text: block.text }),
});

/** The hint of a block list: the files to examine next, and the blocks that the own loader of the game reads. */
function blocksReply(call: Call, blocks: TapeBlock[], body: unknown) {
  const tape = call.subject(0);
  const hints: string[] = [];
  let nextAction: string | undefined;
  const isData = (block: TapeBlock | undefined) => block?.bytes !== undefined && block.flag === 0xff;
  const programs = blocks.flatMap((block, index) => (block.header?.type === "program" ? [index] : []));
  const code = blocks.flatMap((block, index) => (block.header?.type === "code" && isData(blocks[index + 1]) ? [{ index: index + 1, name: block.header.name, address: formatAddress(block.header.param1) }] : []));
  const headed = new Set(blocks.flatMap((block, index) => (block.header === undefined ? [] : [index + 1])));
  const own = blocks.flatMap((block, index) => (block.kind === "turbo" || block.kind === "pure-data" || (block.flag !== undefined && block.header === undefined && !headed.has(index)) ? [index] : []));
  if (programs.length > 0) hints.push(`Block ${programs.join(", ")} has the header of a BASIC program. List the BASIC of the tape.`);
  if (code.length > 0) {
    hints.push(`Write the data of each CODE file with read, and disassemble it at its address: ${code.map((item) => `block ${item.index} at ${item.address}`).join(", ")}.`);
    nextAction = call.next("read", tape, String(code[0]!.index), "--out", `.c64-re-tools/local/${code[0]!.name.trim().replace(/[^A-Za-z0-9_-]+/g, "_") || "block"}.bin`);
  }
  if (own.length > 0) hints.push(`The own loader of the program reads block ${own.join(", ")}. Load the tape in the emulator and stop at the entry of the machine code to find where these blocks go.`);
  return hints.length === 0 ? body : reply(body, { hint: hints.join(" "), nextAction });
}

await runScript({
  name: "media",
  summary: "ZX Spectrum tapes, snapshots and screens: the blocks of a tape, the data of a block, the machine state of a snapshot, a screen as a PNG.",
  commands: [
    {
      name: "blocks",
      summary: "The blocks of a TAP or TZX tape: the kind, the flag byte, the length, the checksum and the ROM header.",
      subjects: [{ name: "<tape>", help: "a .tap or .tzx file, relative to the project folder" }],
      run: (call) => {
        const blocks = tapeBlocks(call.subject(0));
        return blocksReply(call, blocks, { count: blocks.length, blocks: blocks.map(showBlock) });
      },
    },
    {
      name: "read",
      summary: "Writes the data of one block, without its flag byte and its checksum.",
      subjects: [
        { name: "<tape>", help: "a .tap or .tzx file, relative to the project folder" },
        { name: "<block>", help: "the number of the block, as blocks gives it" },
      ],
      options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the data file, relative to the project folder", required: true } },
      run: (call) => {
        const blocks = tapeBlocks(call.subject(0));
        const index = call.parseNumber(call.subject(1), "<block>", 0, Math.max(0, blocks.length - 1));
        const bytes = blocks[index]!.bytes;
        if (bytes === undefined || bytes.length < 2) throw new UsageError(`Block ${index} holds no data: it is a ${blocks[index]!.kind} block. Give a block that blocks shows with a flag`);
        const body = { block: index, ...writeReported(call.string("out")!, bytes.subarray(1, -1), { what: "--out" }) };
        const header = blocks[index - 1]?.header;
        if (header?.type === "code") return reply(body, { hint: `The header in block ${index - 1} gives the load address ${formatAddress(header.param1)}. Disassemble the data at that address.` });
        if (header?.type === "program") return reply(body, { hint: "The header in block " + String(index - 1) + " tells that the data is a BASIC program. List its BASIC." });
        return body;
      },
    },
    {
      name: "snapshot",
      summary: "The machine state of a .z80 or .sna snapshot: the model, the registers, the border and the paging.",
      subjects: [{ name: "<snapshot>", help: "a .z80 or .sna file, relative to the project folder" }],
      run: (call) => {
        const snapshot = snapshotOf(call.subject(0), "<snapshot>");
        const r = snapshot.registers;
        const word = (value: number) => formatAddress(value);
        return {
          model: snapshot.model,
          registers: {
            pc: word(r.pc), sp: word(r.sp), af: word(r.af), bc: word(r.bc), de: word(r.de), hl: word(r.hl), ix: word(r.ix), iy: word(r.iy),
            af2: word(r.af2), bc2: word(r.bc2), de2: word(r.de2), hl2: word(r.hl2), i: formatByte(r.i), r: formatByte(r.r), im: r.im, iff1: r.iff1, iff2: r.iff2,
          },
          border: snapshot.border,
          ...(snapshot.model === "128k" ? { port7ffd: formatByte(snapshot.port7ffd), pagedBank: pagedBank(snapshot), screenBank: snapshot.port7ffd & 0x08 ? 7 : 5 } : {}),
        };
      },
    },
    {
      name: "screen",
      summary: "Writes a screen as a PNG: a .scr file (6912 bytes), or the screen of a snapshot with its border.",
      subjects: [{ name: "<file>", help: "a .scr, .z80 or .sna file, relative to the project folder" }],
      options: {
        out: { ...OPTIONS.out, output: "file", value: "<file.png>", help: "the PNG file, relative to the project folder", required: true },
        border: { kind: "number", value: "<colour>", help: "the border colour 0-7 for a .scr file. Default 7 (white)", max: 7 },
      },
      run: (call) => {
        const path = call.subject(0);
        const file = readProjectFile(path, { what: "<file>" });
        let screen: Uint8Array;
        let border: number;
        if (file.type === "z80" || file.type === "sna") {
          if (call.count("border") !== undefined) throw new UsageError("--border works only with a .scr file: a snapshot gives its own border. Remove --border");
          const snapshot = snapshotOf(path, "<file>");
          screen = snapshot.banks[snapshot.port7ffd & 0x08 ? 7 : 5]!.subarray(0, SCREEN_BYTES);
          border = snapshot.border;
        } else {
          if (file.bytes.length !== SCREEN_BYTES) throw new Refusal("invalid-input", `${path} has ${file.bytes.length} bytes: a .scr screen has ${SCREEN_BYTES} (the bitmap and the attributes).`);
          screen = file.bytes;
          border = call.count("border") ?? 7;
        }
        const frame = spectrumScreenFrame(screen, border);
        return { width: frame.width, height: frame.height, ...writeReported(call.string("out")!, encodePng(frame, SPECTRUM_PALETTE), { what: "--out" }) };
      },
    },
  ],
});
