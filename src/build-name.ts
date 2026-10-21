// The name of a build: the file name tells what kind of build a program is.
// A release build is release_<label>. A build of config.asm is clean when each
// switch has its default, else custom_ with each switch that differs: its
// name when it is on, no_<name> when it is off. A build of an entry other
// than main.asm adds the entry, for example clean_loader. A source without
// config.asm and without a release keeps the name of its entry. The symbols
// of a build go into symbols/ next to the program, so the program folder
// holds only programs.

import { basename, dirname, extname, join } from "node:path";

/** The file with the value of each switch. The user edits it, and generate keeps the values. */
export const CONFIG_FILE = "config.asm";

/** A value line of config.asm: NAME = 0 or NAME = 1. */
const CONFIG_VALUE = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*([01])\s*(?:;.*)?$/;

/** The values of the switches in a config.asm text, by name. Lines that are not a value line are not read. */
export function configValues(text: string): Map<string, 0 | 1> {
  const values = new Map<string, 0 | 1>();
  for (const line of text.split(/\r?\n/)) {
    const match = CONFIG_VALUE.exec(line);
    if (match !== null) values.set(match[1]!, match[2] === "1" ? 1 : 0);
  }
  return values;
}

/** What a build is made of: a release, or the values of config.asm with the default of each switch (0 when the defaults do not have it). */
export type BuildKind = { release: string } | { values: ReadonlyMap<string, number>; defaults: ReadonlyMap<string, number> };

/** The name of a build of `entry`, without an extension. */
export function buildName(entry: string, kind: BuildKind | undefined): string {
  const base = basename(entry, extname(entry));
  if (kind === undefined) return base;
  let type: string;
  if ("release" in kind) type = `release_${kind.release}`;
  else {
    const changed = [...kind.values].filter(([name, value]) => value !== (kind.defaults.get(name) ?? 0)).map(([name, value]) => (value === 0 ? `no_${name}` : name).toLowerCase());
    type = changed.length === 0 ? "clean" : `custom_${changed.join("_")}`;
  }
  return base === "main" ? type : `${type}_${base}`;
}

/** The symbols file of a program: symbols/<name>.json in the folder of the program. */
export function symbolsPath(program: string): string {
  return join(dirname(program), "symbols", `${basename(program, extname(program))}.json`).split("\\").join("/");
}
