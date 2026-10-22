// The c64-memory-map script: the platform meaning of C64 addresses and of
// values in platform registers. Local lookup only; nothing is stored. export
// writes the platform names to a project file as an ACME include.

import { formatAddress, formatByte } from "#src/address.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { decode, IO, lookup, platformNames, ROM, SYSTEM, type Entry } from "#src/platform.ts";
import { listed, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";

const show = (entry: Entry) => ({ start: formatAddress(entry.start), ...(entry.end !== entry.start ? { end: formatAddress(entry.end) } : {}), name: entry.name, meaning: entry.meaning });

/** The platform names by name in upper case: memory-map knows them also outside a project. */
const PLATFORM = new Map(platformNames().map((entry) => [entry.name.toUpperCase(), entry.address]));

/**
 * The address of a name: a platform name (a register, a KERNAL or BASIC entry,
 * a system variable) in any letter case first, else a name of the knowledge.
 */
function names(name: string, space: string): number {
  const platform = PLATFORM.get(name.toUpperCase());
  if (platform !== undefined) return platform;
  try {
    return knowledgeNames(name, space);
  } catch (error) {
    if (!isRefusal(error) || error.code !== "not-found") throw error;
    throw new Refusal("not-found", `${name} is not a C64 platform name and not a name in the knowledge. Give a $ address, a platform name that the command list or export shows (for example SCROLY or CHROUT), or a symbol of the project knowledge.`);
  }
}

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
  names,
  commands: [
    {
      name: "at",
      summary: "The platform meaning of each address: its name, area and meaning.",
      subjects: [{ name: "<address>", help: "an address, a platform name such as SCROLY, or a name of the knowledge", list: true }],
      run: (call) => {
        const addresses = call.subjects.map((text) => {
          const found = lookup(call.parseAddress(text, "<address>"));
          // The chip registers, color RAM and the cartridge I/O areas show only while $01 maps I/O in.
          const io = found.address >= 0xd000 && found.address <= 0xdfff;
          return {
            ...found,
            address: formatAddress(found.address),
            ...(found.mirrorOf === undefined ? {} : { mirrorOf: formatAddress(found.mirrorOf) }),
            ...(found.entryStart === undefined ? {} : { entryStart: formatAddress(found.entryStart) }),
            ...(io ? { visible: "when $01 shows I/O at $D000 (the default)" } : {}),
          };
        });
        const application = addresses.filter((address) => address.kind === "application").map((address) => address.address);
        if (application.length === 0) return { addresses };
        return reply({ addresses }, { hint: `The program decides the use of ${application.join(", ")}. Find its use in the disassembly or in the emulator.` });
      },
    },
    {
      name: "decode",
      summary: "The meaning of a value in a platform register.",
      subjects: [
        { name: "<register>", help: "the register, as an address or a platform name: $0001, $d011 (SCROLY), $d016, $d018, $d010, $d015-$d01f, $dc0d, $dd00 or $dd0d" },
        { name: "<value>", help: "the value of the register: $ and hex, decimal, or % and binary, 0 to 255" },
      ],
      options: { bank: { kind: "number", value: "<value>", help: "the value of $dd00, for the VIC-II bank of a $d018 value. Only for $d018", max: 0xff } },
      run: (call) => {
        const register = call.parseAddress(call.subject(0), "<register>");
        const value = call.parseNumber(call.subject(1), "<value>", 0, 0xff);
        const bank = call.count("bank");
        if (bank !== undefined && register !== 0xd018) throw new UsageError(`--bank works only with $d018 (VMCSB), not with ${formatAddress(register)}. Remove --bank.`);
        const body = { register: formatAddress(register), value: formatByte(value), name: lookup(register).name, ...decode(register, value, bank) };
        if (register === 0xd018 && bank === undefined) return reply(body, { hint: "The addresses are offsets in the VIC-II bank. To get the addresses, give --bank with the value of $dd00." });
        return body;
      },
    },
    {
      name: "list",
      summary: "The registers of a chip, the KERNAL jump table, or the system areas.",
      subjects: [{ name: "<list>", help: `one of ${Object.keys(LISTS).join(", ")}` }],
      options: { "max-listed": OPTIONS["max-listed"] },
      run: (call) => {
        const name = call.subject(0);
        const list = LISTS[name];
        if (list === undefined) throw new UsageError(`<list> must be one of ${Object.keys(LISTS).join(", ")}, not ${name}.`);
        const entries = listed(list(), call.count("max-listed")!, show, "a larger --max-listed, or the command export for every platform name");
        if (entries.rest === undefined) return { entries };
        return reply({ entries }, { hint: `The list is cut. To get all ${entries.count} entries, give --max-listed ${entries.count}.`, nextAction: call.next("list", name, "--max-listed", String(entries.count)) });
      },
    },
    {
      name: "export",
      summary: "Writes the platform names as an ACME include: NAME = $xxxx.",
      options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the include file, relative to the project folder", required: true } },
      run: (call) => {
        const names = platformNames();
        const lines = ["; C64 platform names from the c64-memory-map skill, for ACME.", ...names.map((item) => `${item.name} = ${item.address < 0x100 ? formatByte(item.address) : formatAddress(item.address)}`.padEnd(24) + `; ${item.meaning}`)];
        return { names: names.length, ...writeReported(call.string("out")!, `${lines.join("\n")}\n`, { what: "--out" }) };
      },
    },
  ],
});
