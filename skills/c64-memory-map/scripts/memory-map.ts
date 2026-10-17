// The c64-memory-map script: the platform meaning of C64 addresses and of
// values in platform registers. Local lookup only; nothing is stored. export
// writes the platform names to a project file as an ACME include.

import { formatC64Address, formatC64Byte } from "#src/c64.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { decode, IO, lookup, platformNames, ROM, SYSTEM, type Entry } from "#src/platform.ts";
import { listed, OPTIONS, runScript, UsageError } from "#src/script.ts";

const show = (entry: Entry) => ({ start: formatC64Address(entry.start), ...(entry.end !== entry.start ? { end: formatC64Address(entry.end) } : {}), name: entry.name, meaning: entry.meaning });

const LISTS: Record<string, () => Entry[]> = {
  vic: () => IO[0]!.registers,
  sid: () => IO[1]!.registers,
  cia1: () => IO[2]!.registers,
  cia2: () => IO[3]!.registers,
  kernal: () => ROM,
  system: () => SYSTEM,
};

await runScript({
  name: "memory-map",
  summary: "The platform meaning of C64 addresses and of values in platform registers.",
  names: knowledgeNames,
  commands: [
    {
      name: "at",
      summary: "The platform meaning of each address: its name, area and meaning.",
      subjects: [{ name: "<address>", help: "an address or a name of the knowledge", list: true }],
      run: (call) => ({
        addresses: call.subjects.map((text) => {
          const found = lookup(call.parseAddress(text, "<address>"));
          // The chip registers, color RAM and the cartridge I/O areas show only while $01 maps I/O in.
          const io = found.address >= 0xd000 && found.address <= 0xdfff;
          return {
            ...found,
            address: formatC64Address(found.address),
            ...(found.mirrorOf === undefined ? {} : { mirrorOf: formatC64Address(found.mirrorOf) }),
            ...(found.entryStart === undefined ? {} : { entryStart: formatC64Address(found.entryStart) }),
            ...(io ? { visible: "when $01 shows I/O at $D000 (the default)" } : {}),
          };
        }),
      }),
    },
    {
      name: "decode",
      summary: "The meaning of a value in a platform register.",
      subjects: [
        { name: "<register>", help: "the register: $0001, $d011, $d016, $d018, $d010, $d015-$d01f, $dc0d, $dd00 or $dd0d" },
        { name: "<value>", help: "the value of the register: $ and hex, decimal, or % and binary, 0 to 255" },
      ],
      options: { bank: { kind: "number", value: "<value>", help: "the value of $dd00, for the VIC-II bank of a $d018 value", max: 0xff } },
      run: (call) => {
        const register = call.parseAddress(call.subject(0), "<register>");
        const value = call.parseNumber(call.subject(1), "<value>", 0, 0xff);
        return { register: formatC64Address(register), value: formatC64Byte(value), name: lookup(register).name, ...decode(register, value, call.count("bank")) };
      },
    },
    {
      name: "list",
      summary: "The registers of a chip, the KERNAL jump table, or the system areas.",
      subjects: [{ name: "<list>", help: `one of ${Object.keys(LISTS).join(", ")}` }],
      options: { "max-listed": OPTIONS["max-listed"] },
      run: (call) => {
        const list = LISTS[call.subject(0)];
        if (list === undefined) throw new UsageError(`<list> must be one of ${Object.keys(LISTS).join(", ")}, not ${call.subject(0)}`);
        return { entries: listed(list(), call.count("max-listed")!, show, "a larger --max-listed, or memory-map.ts export --out <file> for every platform name") };
      },
    },
    {
      name: "export",
      summary: "Writes the platform names as an ACME include: NAME = $xxxx.",
      options: { out: { ...OPTIONS.out, value: "<file>", help: "the include file, relative to the project folder", required: true } },
      run: (call) => {
        const names = platformNames();
        const lines = ["; C64 platform names from the c64-memory-map skill, for ACME.", ...names.map((item) => `${item.name} = ${item.address < 0x100 ? formatC64Byte(item.address) : formatC64Address(item.address)}`.padEnd(24) + `; ${item.meaning}`)];
        return { names: names.length, ...writeReported(call.string("out")!, `${lines.join("\n")}\n`, { what: "--out" }) };
      },
    },
  ],
});
