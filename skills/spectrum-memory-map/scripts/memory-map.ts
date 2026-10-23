// The spectrum-memory-map script: the platform meaning of ZX Spectrum
// addresses, ports and values. Local lookup only; nothing is stored. export
// writes the platform names to a project file as a sjasmplus include. The
// project machine picks the model: a 128K project gets the names of the 128K
// ROM at $5B00-$5BFF, any other project the printer buffer of the 48K.

import { formatAddress, formatByte } from "#src/address.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { writeReported } from "#src/host-client/transfer.ts";
import { knowledgeNames, projectMachine } from "#src/knowledge/names.ts";
import type { SpectrumModel } from "#src/machine.ts";
import type { Entry } from "#src/platform.ts";
import {
  SPECTRUM_AREAS,
  SPECTRUM_AY,
  SPECTRUM_DECODERS,
  SPECTRUM_PORTS,
  SPECTRUM_ROM,
  spectrumContention,
  spectrumDecode,
  spectrumDecodeAy,
  spectrumLookup,
  spectrumModelOf,
  spectrumPlatformNames,
  spectrumSystem,
  spectrumTimingFacts,
  type SpectrumDecoder,
} from "#src/platform/spectrum.ts";
import { listed, OPTIONS, reply, runScript, UsageError } from "#src/script.ts";

const show = (entry: Entry) => ({ start: formatAddress(entry.start), ...(entry.end !== entry.start ? { end: formatAddress(entry.end) } : {}), name: entry.name, meaning: entry.meaning });

/** The model of the project: 128k in a 128K project, else 48k. */
let projectModel: SpectrumModel | undefined;
const model = (): SpectrumModel => (projectModel ??= spectrumModelOf(projectMachine()));
const modelName = () => (model() === "128k" ? "128K" : "48K");

/** The address of a platform name of the model, in any letter case. memory-map knows the names also outside a project. */
const platformAddress = (name: string) => spectrumPlatformNames(model()).find((entry) => entry.name.toUpperCase() === name.toUpperCase())?.address;

/** The address of a name: a platform name (a ROM routine, a system variable) in any letter case first, else a name of the knowledge. */
function names(name: string, space: string): number {
  const platform = platformAddress(name);
  if (platform !== undefined) return platform;
  try {
    return knowledgeNames(name, space);
  } catch (error) {
    if (!isRefusal(error) || error.code !== "not-found") throw error;
    throw new Refusal("not-found", `${name} is not a ZX Spectrum platform name of the ${modelName()} and not a name in the knowledge. Give a $ address, a platform name that the command list or export shows (for example LD_BYTES or FRAMES), or a symbol of the project knowledge.`);
  }
}

const LISTS: Record<string, () => unknown[]> = {
  rom: () => SPECTRUM_ROM.map(show),
  system: () => spectrumSystem(model()).map(show),
  areas: () => SPECTRUM_AREAS.map((area) => ({ start: formatAddress(area.start), end: formatAddress(area.end), name: area.name, meaning: area.meaning })),
  ports: () => SPECTRUM_PORTS.map((port) => ({ port: formatAddress(port.port), name: port.name, meaning: port.meaning })),
  ay: () => SPECTRUM_AY.map((register) => ({ register: `R${register.register}`, name: register.name, meaning: register.meaning })),
  timing: () => spectrumTimingFacts(),
};

const DECODERS = [...SPECTRUM_DECODERS, "ay"] as const;

await runScript({
  name: "memory-map",
  summary: "The platform meaning of ZX Spectrum addresses, ports and values.",
  names,
  commands: [
    {
      name: "at",
      summary: "The platform meaning of each address: its name, area, meaning and contention.",
      subjects: [{ name: "<address>", help: "an address, a platform name such as FRAMES, or a name of the knowledge", list: true }],
      run: (call) => {
        const addresses = call.subjects.map((text) => {
          const found = spectrumLookup(call.parseAddress(text, "<address>"), model());
          return { ...found, address: formatAddress(found.address), ...(found.entryStart === undefined ? {} : { entryStart: formatAddress(found.entryStart) }), ...spectrumContention(found.address, model()) };
        });
        const application = addresses.filter((address) => address.kind === "application").map((address) => address.address);
        if (application.length === 0) return { addresses };
        return reply({ addresses }, { hint: `The program decides the use of ${application.join(", ")}. Find its use in the disassembly or in the emulator.` });
      },
    },
    {
      name: "decode",
      summary: "The meaning of a value: an OUT to the ULA, a write to port $7ffd, an attribute byte, an AY register, or all 16 AY registers.",
      subjects: [
        { name: "<what>", help: `one of ${DECODERS.join(", ")}` },
        { name: "<value>", help: "the value: $ and hex, decimal, or % and binary, 0 to 255. For ay, 1 to 16 values from R0: a register that you do not give is 0", list: true },
      ],
      run: (call) => {
        const what = call.subject(0);
        if (!(DECODERS as readonly string[]).includes(what)) throw new UsageError(`<what> must be one of ${DECODERS.join(", ")}, not ${what}`);
        const texts = call.rest(1);
        if (what === "ay") {
          if (texts.length > 16) throw new UsageError(`decode ay takes at most 16 values, R0 to R15, not ${texts.length}`);
          const registers = Array.from({ length: 16 }, (_, index) => (index < texts.length ? call.parseNumber(texts[index]!, `R${index}`, 0, 0xff) : 0));
          return { what, registers: registers.map(formatByte), ...spectrumDecodeAy(registers) };
        }
        if (texts.length !== 1) throw new UsageError(`decode ${what} takes one <value>, not ${texts.length}`);
        const value = call.parseNumber(texts[0]!, "<value>", 0, 0xff);
        return { what, value: formatByte(value), ...spectrumDecode(what as SpectrumDecoder, value) };
      },
    },
    {
      name: "list",
      summary: "The ROM routines, the system variables, the memory areas, the I/O ports, the AY registers or the timing facts.",
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
      summary: "Writes the platform names of the project model as a sjasmplus include: NAME EQU $xxxx.",
      options: { out: { ...OPTIONS.out, output: "file", value: "<file>", help: "the include file, relative to the project folder", required: true } },
      run: (call) => {
        const names = spectrumPlatformNames(model());
        const lines = [`; ZX Spectrum ${modelName()} platform names from the spectrum-memory-map skill, for sjasmplus.`, ...names.map((item) => `${item.name} EQU ${formatAddress(item.address)}`.padEnd(24) + `; ${item.meaning}`)];
        return { names: names.length, ...writeReported(call.string("out")!, `${lines.join("\n")}\n`, { what: "--out" }) };
      },
    },
  ],
});
