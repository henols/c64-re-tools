// The c64-memory-map script: the platform meaning of C64 addresses and of
// values in platform registers. Local lookup only; nothing is stored.

import { parseArgs } from "node:util";

import { decode, IO, lookup, ROM, SYSTEM, type Entry } from "./platform.ts";

const USAGE = `memmap.ts at <address> [<address> ...]
memmap.ts decode <register> <value> [--bank <$dd00 value>]
memmap.ts list <vic|sid|cia1|cia2|kernal|system>

Addresses and values are $ and hex digits, decimal, or % and binary digits.
The result is one JSON object.`;

class UsageError extends Error {}

const hex = (value: number, digits = 4) => `$${value.toString(16).padStart(digits, "0")}`;

function number(text: string, max: number, what: string): number {
  let value = Number.NaN;
  if (/^\$[0-9a-f]{1,4}$/i.test(text)) value = Number.parseInt(text.slice(1), 16);
  else if (/^%[01]{1,16}$/.test(text)) value = Number.parseInt(text.slice(1), 2);
  else if (/^\d{1,5}$/.test(text)) value = Number(text);
  if (!(value >= 0 && value <= max)) throw new UsageError(`${what} must be from 0 to ${hex(max, max > 0xff ? 4 : 2)}, not ${text}`);
  return value;
}

const show = (entry: Entry) => ({ start: hex(entry.start), ...(entry.end !== entry.start ? { end: hex(entry.end) } : {}), name: entry.name, meaning: entry.meaning });

function run(argv: string[]): unknown {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { bank: { type: "string" }, help: { type: "boolean" } } });
  if (values.help || positionals.length === 0) throw new UsageError("");
  const [command, ...rest] = positionals;
  switch (command) {
    case "at": {
      if (rest.length === 0) throw new UsageError("give at least one address");
      return {
        addresses: rest.map((text) => {
          const found = lookup(number(text, 0xffff, "an address"));
          // The chip registers, color RAM and the cartridge I/O areas show only while $01 maps I/O in.
          const io = found.address >= 0xd000 && found.address <= 0xdfff;
          return {
            ...found,
            address: hex(found.address),
            ...(found.mirrorOf === undefined ? {} : { mirrorOf: hex(found.mirrorOf) }),
            ...(found.entryStart === undefined ? {} : { entryStart: hex(found.entryStart) }),
            ...(io ? { visible: "when $01 shows I/O at $D000 (the default)" } : {}),
          };
        }),
      };
    }
    case "decode": {
      if (rest.length !== 2) throw new UsageError("decode takes a register and a value");
      const register = number(rest[0]!, 0xffff, "the register");
      const value = number(rest[1]!, 0xff, "the value");
      const bank = values.bank === undefined ? undefined : number(values.bank, 0xff, "--bank");
      try {
        return { register: hex(register), value: hex(value, 2), name: lookup(register).name, ...decode(register, value, bank) };
      } catch (error) {
        if (error instanceof RangeError) throw new UsageError(error.message);
        throw error;
      }
    }
    case "list": {
      const lists: Record<string, Entry[]> = {
        vic: IO[0]!.registers,
        sid: IO[1]!.registers,
        cia1: IO[2]!.registers,
        cia2: IO[3]!.registers,
        kernal: ROM,
        system: SYSTEM,
      };
      const list = lists[rest[0] ?? ""];
      if (list === undefined || rest.length !== 1) throw new UsageError(`list takes one of ${Object.keys(lists).join(", ")}`);
      return { entries: list.map(show) };
    }
    default:
      throw new UsageError(`unknown command ${command}`);
  }
}

try {
  process.stdout.write(`${JSON.stringify(run(process.argv.slice(2)))}\n`);
} catch (error) {
  if (error instanceof UsageError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    const message = (error as Error).message;
    process.stdout.write(`${JSON.stringify({ error: { code: "invalid-input", message: message === "" ? USAGE : `${message}\n\n${USAGE}` } })}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
