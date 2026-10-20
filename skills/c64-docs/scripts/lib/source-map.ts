// The source map that c64-source writes next to the source: the line of
// each name and of each address. The documentation links to these lines.

import { posix } from "node:path";

import { parseC64Address } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import type { Space } from "#src/knowledge/schema.ts";

export const SOURCE_MAP_FILE = "source-map.json";

export interface SourceLine {
  file: string;
  line: number;
}

export interface SourceMap {
  /** The source directory, relative to the project folder. */
  directory: string;
  space: Space;
  revision: string;
  files: string[];
  labels: Array<SourceLine & { address: number; name: string }>;
  /** The label line of a name. */
  labelOf: (name: string) => (SourceLine & { address: number }) | undefined;
  /** The line that writes an address: an instruction, a macro use or a data line. */
  lineOf: (address: number) => SourceLine | undefined;
  /** The project path of a source file. */
  pathOf: (file: string) => string;
}

/** Reads <directory>/source-map.json of the project `root`. A missing map is a refusal with the remedy. */
export function readSourceMap(directory: string, root?: string): SourceMap {
  const path = posix.join(directory, SOURCE_MAP_FILE);
  let text: string;
  try {
    text = readProjectFile(path, root === undefined ? {} : { root }).bytes.toString("utf8");
  } catch (error) {
    if (error instanceof WireFailure && error.code === "not-found") {
      throw new WireFailure("not-found", `There is no ${path}. Generate the source from the project knowledge into ${directory}. That also writes the source map.`);
    }
    throw error;
  }
  const fail = (what: string): never => {
    throw new WireFailure("invalid-input", `${path} is not a source map of the generated source: ${what}. Generate the source again from the project knowledge.`);
  };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    return fail((error as Error).message);
  }
  if (!Array.isArray(raw.labels) || !Array.isArray(raw.items) || !Array.isArray(raw.files)) fail("it has no labels, items or files");
  const labels = (raw.labels as Array<Record<string, unknown>>).map((label) => ({ address: parseC64Address(String(label.address)), name: String(label.name), file: String(label.file), line: Number(label.line) }));
  const items = (raw.items as Array<Record<string, unknown>>)
    .map((item) => ({ start: parseC64Address(String(item.start)), end: parseC64Address(String(item.end)), file: String(item.file), line: Number(item.line) }))
    .sort((a, b) => a.start - b.start);
  const byName = new Map(labels.map((label) => [label.name, label]));
  return {
    directory,
    space: String(raw.space ?? "c64") as Space,
    revision: String(raw.revision),
    files: (raw.files as unknown[]).map(String),
    labels,
    labelOf: (name) => byName.get(name),
    lineOf: (address) => {
      let low = 0;
      let high = items.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        const item = items[middle]!;
        if (address < item.start) high = middle - 1;
        else if (address > item.end) low = middle + 1;
        else return { file: item.file, line: item.line };
      }
      return undefined;
    },
    pathOf: (file) => posix.join(directory, file),
  };
}
