// The spectrum-memory-map script: the platform meaning of ZX Spectrum
// addresses, ports and values. Local lookup only; nothing is stored. export
// writes the platform names to a project file as a sjasmplus include.

import { formatAddress, formatByte } from "#src/address.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import type { Entry } from "#src/platform.ts";
import { SPECTRUM_AREAS, SPECTRUM_PORTS, SPECTRUM_ROM, SPECTRUM_SYSTEM, spectrumDecode, spectrumLookup, spectrumPlatformNames } from "#src/platform/spectrum.ts";
import { listed, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";

const show = (entry: Entry) => ({ start: formatAddress(entry.start), ...(entry.end !== entry.start ? { end: formatAddress(entry.end) } : {}), name: entry.name, meaning: entry.meaning });

/** The platform names by name in upper case: memory-map knows them also outside a project. */
const PLATFORM = new Map(spectrumPlatformNames().map((entry) => [entry.name.toUpperCase(), entry.address]));

/** The address of a name: a platform name (a ROM routine, a system variable) in any letter case first, else a name of the knowledge. */
function names(name: string, space: string): number {
  const platform = PLATFORM.get(name.toUpperCase());
  if (platform !== undefined) return platform;
  try {
    return knowledgeNames(name, space);
  } catch (error) {
    if (!isRefusal(error) || error.code !== "not-found") throw error;
    throw new Refusal("not-found", `${name} is not a ZX Spectrum platform name and not a name in the knowledge. Give a $ address, a platform name that the command list or export shows (for example LD_BYTES or FRAMES), or a symbol of the project knowledge.`);
  }
}

const LISTS: Record<string, () => unknown[]> = {
  rom: () => SPECTRUM_ROM.map(show),
  system: () => SPECTRUM_SYSTEM.map(show),
  areas: () => SPECTRUM_AREAS.map((area) => ({ start: formatAddress(area.start), end: formatAddress(area.end), name: area.name, meaning: area.meaning })),
  ports: () => SPECTRUM_PORTS.map((port) => ({ port: formatAddress(port.port), name: port.name, meaning: port.meaning })),
};

const DECODERS = ["ula", "paging", "attribute"] as const;

await runScript({
  name: "memory-map",
  summary: "The platform meaning of ZX Spectrum addresses, ports and values.",
  names,
  commands: [
    {
      name: "at",
      summary: "The platform meaning of each address: its name, area and meaning.",
      subjects: [{ name: "<address>", help: "an address, a platform name such as FRAMES, or a name of the knowledge", list: true }],
      run: (call) => {
        const addresses = call.subjects.map((text) => {
          const found = spectrumLookup(call.parseAddress(text, "<address>"));
          return { ...found, address: formatAddress(found.address), ...(found.entryStart === undefined ? {} : { entryStart: formatAddress(found.entryStart) }) };
        });
        const application = addresses.filter((address) => address.kind === "application").map((address) => address.address);
        if (application.length === 0) return { addresses };
        return reply({ addresses }, { hint: `The program decides the use of ${application.join(", ")}. Find its use in the disassembly or in the emulator.` });
      },
    },
    {
      name: "decode",
      summary: "The meaning of a value: an OUT to the ULA, a write to port $7ffd, or an attribute byte.",
      subjects: [
        { name: "<what>", help: `one of ${DECODERS.join(", ")}` },
        { name: "<value>", help: "the value: $ and hex, decimal, or % and binary, 0 to 255" },
      ],
      run: (call) => {
        const what = call.subject(0);
        if (!(DECODERS as readonly string[]).includes(what)) throw new UsageError(`<what> must be one of ${DECODERS.join(", ")}, not ${what}`);
        const value = call.parseNumber(call.subject(1), "<value>", 0, 0xff);
        return { what, value: formatByte(value), ...spectrumDecode(what as (typeof DECODERS)[number], value) };
      },
    },
    {
      name: "list",
      summary: "The ROM routines, the system variables, the memory areas or the I/O ports.",
      subjects: [{ name: "<list>", help: `one of ${Object.keys(LISTS).join(", ")}` }],
      options: { "max-listed": OPTIONS["max-listed"] },
      run: (call) => {
        const name = call.subject(0);
        const list = LISTS[name];
        if (list === undefined) throw new UsageError(`<list> must be one of ${Object.keys(LISTS).join(", ")}, not ${name}`);
        const entries = listed(list(), call.count("max-listed")!, (entry) => entry, "a larger --max-listed, or memory-map.ts export --out <file> for every platform name");
        if (entries.rest === undefined) return { entries };
        return reply({ entries }, { hint: `The list is cut. To get all ${entries.count} entries, give --max-listed ${entries.count}.`, nextAction: call.next("list", name, "--max-listed", String(entries.count)) });
      },
    },
    {
      name: "export",
      summary: "Writes the platform names as a sjasmplus include: NAME EQU $xxxx.",
      options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the include file, relative to the project folder", required: true } },
      run: (call) => {
        const names = spectrumPlatformNames();
        const lines = ["; ZX Spectrum platform names from the spectrum-memory-map skill, for sjasmplus.", ...names.map((item) => `${item.name} EQU ${formatAddress(item.address)}`.padEnd(24) + `; ${item.meaning}`)];
        return { names: names.length, ...writeReported(call.string("out")!, `${lines.join("\n")}\n`, { what: "--out" }) };
      },
    },
  ],
});
