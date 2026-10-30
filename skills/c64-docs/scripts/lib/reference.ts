// The reference pages of the documentation: generated from the
// knowledge, the source map and the image, never edited. A name links to its
// line in the source; an address links to the entry of its name; a call site
// links to its line.

import { posix } from "node:path";

import { formatC64Address, POINTER_TABLE_TYPES, pointerTableEntries, type PointerTableType } from "#src/c64.ts";
import { IO_RAM } from "#src/host-client/coverage.ts";
import { bitmapFrame, charsetFrame, encodePng, PATTERN_PALETTES, scaleFrame, screenText, spriteSheet, type GraphicsMode } from "#src/graphics.ts";
import { mermaidGraph, ownerOf, routineEdges, routineHeads, type GraphReference, type RoutineHead } from "#src/knowledge/graph.ts";
import type { CommentRow, ModuleRow, ReferenceRow, RegionRow, SymbolRow } from "#src/knowledge/read.ts";
import type { RegionType } from "#src/knowledge/schema.ts";
import { platformNames } from "#src/platform.ts";
import { referenceHeader } from "#src/reference-pages.ts";
import type { SourceMap } from "./source-map.ts";

export interface ReferenceInput {
  /** The reference directory, relative to the project folder. */
  out: string;
  map: SourceMap;
  revision: string;
  symbols: SymbolRow[];
  regions: RegionRow[];
  comments: CommentRow[];
  references: ReferenceRow[];
  modules: ModuleRow[];
  image?: { byteAt: (address: number) => number; inImage: (address: number) => boolean };
}

export interface ReferenceFile {
  /** Relative to the project folder. */
  path: string;
  bytes: Buffer;
}

/** What the knowledge does not have yet, as the pages show it. */
export interface ReferenceGaps {
  /** The routines of the module pages without a comment: an empty summary in the routine table. */
  routinesWithoutComment: Array<{ name: string; address: number; file: string }>;
  /** The modules of the knowledge whose file has code but no routine. */
  modulesWithoutRoutines: Array<{ file: string; start: number; title?: string }>;
  /** The tables of the tables page without a name: their heading is a range. */
  tablesWithoutName: Array<{ start: number; end: number; type: RegionType }>;
}

/** Files that the source map lists but that hold no code of the program: they get no module page. */
const NOT_PIECES = new Set(["main.asm", "constants.asm", "macros.asm", "loader.asm", "config.asm", "switches.asm", "start_screen.asm", "start_screen_stage.asm"]);
const TABLE_TYPES: readonly RegionType[] = [...POINTER_TABLE_TYPES, "jumps", "words"];
const GRAPHICS_TYPES: readonly RegionType[] = ["sprite", "bitmap", "charset", "screen"];
/** A list longer than this ends with the number of the rest. */
const MAX_LISTED = 40;
/** A list of one entry of a module page is shorter: the reader scans it. */
const MAX_FACTS = 12;
/** A call graph with more edges is not readable: then it shows the calls only, and at most this many. */
const MAX_EDGES = 30;
/** A name outside the image covers the addresses that references use up to the next name, at most this many. */
const MAX_SPAN = 256;
/** A source line that uses an ACME macro: +name, after a label or not. An anonymous label (+ alone) is no use. */
const MACRO_USE = /^\s*(?:[\w.]+\s+)?\+[A-Za-z_]/;
/** The kinds of a reference that reads a table: the decompiler gives an indexed read (lda table,x) as "reference". */
const TABLE_READS: readonly string[] = ["read", "reference", "pointer"];

const hex = (address: number) => formatC64Address(address).toUpperCase();
const range = (start: number, end: number) => (start === end ? hex(start) : `${hex(start)}-${hex(end)}`);
const stem = (file: string) => file.replace(/\.asm$/, "");

interface Entry {
  name: string;
  address: number;
  kind: string;
  /** The page that holds the entry, relative to the project folder. */
  page: string;
  /** The last address that the name covers: references to it belong to the name. */
  spanEnd: number;
}

/** Builds every page and image of the reference, and lists what the knowledge does not have yet. */
export function buildReference(input: ReferenceInput): { files: ReferenceFile[]; counts: Record<string, number>; gaps: ReferenceGaps } {
  const { map, out } = input;
  const pieces = map.files.filter((file) => !NOT_PIECES.has(file));
  const pageOfFile = (file: string) => (file === "constants.asm" ? posix.join(out, "memory-map.md") : posix.join(out, "modules", `${stem(file)}.md`));

  // --- Names and their entries ------------------------------------------------
  const knowledgeNames = new Map(input.symbols.map((symbol) => [symbol.name, symbol]));
  const entries = new Map<string, Entry>();
  const sortedNames = [...new Set([...input.symbols.map((symbol) => symbol.address), ...map.labels.filter((label) => label.file === "constants.asm").map((label) => label.address)])].sort((a, b) => a - b);
  const nextName = (address: number) => sortedNames.find((other) => other > address);
  /** A name of the platform covers only its register or area: RANDOM is $D41B, not the color RAM after it. */
  const platformEnd = new Map(platformNames().map((entry) => [entry.name, entry.end]));
  const regionAt = (address: number) => input.regions.find((region) => region.start <= address && region.end >= address);
  const spanOf = (address: number, kind: string) => {
    if (kind === "routine" || kind === "label") return address;
    const next = nextName(address) ?? 0x10000;
    const region = regionAt(address);
    if (region !== undefined) return Math.min(next - 1, region.end);
    if (input.image?.inImage(address) === true) return address;
    const last = Math.min(next - 1, address + MAX_SPAN - 1);
    let end = address;
    for (const reference of input.references) if (reference.to > end && reference.to <= last) end = reference.to;
    return end;
  };
  for (const label of map.labels) {
    const symbol = knowledgeNames.get(label.name);
    // A name that c64-source makes (l_xxxx) is no entry: it has no meaning of its own.
    if (symbol === undefined && label.file !== "constants.asm") continue;
    const kind = symbol?.kind ?? "platform";
    const platform = symbol === undefined ? platformEnd.get(label.name) : undefined;
    entries.set(label.name, { name: label.name, address: label.address, kind, page: pageOfFile(label.file), spanEnd: platform ?? spanOf(label.address, kind) });
  }
  const entryAt = new Map<number, Entry>();
  for (const entry of entries.values()) if (!entryAt.has(entry.address)) entryAt.set(entry.address, entry);
  const spans = [...entries.values()].filter((entry) => entry.spanEnd > entry.address).sort((a, b) => a.address - b.address);
  const sourceNameAt = new Map<number, string>();
  for (const label of map.labels) if (!sourceNameAt.has(label.address)) sourceNameAt.set(label.address, label.name);

  // --- Links ------------------------------------------------------------------
  const rel = (page: string, target: string) => posix.relative(posix.dirname(page), target) || posix.basename(target);
  const codeOfName = (page: string, name: string) => {
    const label = map.labelOf(name);
    return label === undefined ? `\`${name}\`` : `[\`${name}\`](${rel(page, map.pathOf(label.file))}#L${label.line})`;
  };
  const entryOfName = (page: string, name: string, text: string) => {
    const entry = entries.get(name);
    return entry === undefined ? `\`${text}\`` : `[\`${text}\`](${rel(page, entry.page)}#${name})`;
  };
  /** A name and its address as one link to the line of the name (the convention of every page). */
  const pair = (page: string, name: string, address: number) => {
    const label = map.labelOf(name);
    const shown = `\`${name}\` \`${hex(address)}\``;
    return label === undefined ? shown : `[${shown}](${rel(page, map.pathOf(label.file))}#L${label.line})`;
  };
  const codeOfAddress = (page: string, address: number) => {
    const line = map.lineOf(address);
    return line === undefined ? `\`${hex(address)}\`` : `[\`${hex(address)}\`](${rel(page, map.pathOf(line.file))}#L${line.line})`;
  };
  /** What a reader calls an address: its name, a name plus an offset, or the address. */
  const nameFor = (address: number): { name: string; base: number } | undefined => {
    const own = entryAt.get(address)?.name;
    if (own !== undefined) return { name: own, base: address };
    const span = spans.find((entry) => entry.address < address && entry.spanEnd >= address);
    if (span !== undefined) return { name: span.name, base: span.address };
    const made = sourceNameAt.get(address);
    return made === undefined ? undefined : { name: made, base: address };
  };
  const target = (page: string, address: number) => {
    const named = nameFor(address);
    if (named === undefined) return codeOfAddress(page, address);
    const shown = named.base === address ? named.name : `${named.name}+${address - named.base}`;
    return entries.has(named.name) ? entryOfName(page, named.name, shown) : codeOfName(page, named.name).replace(`\`${named.name}\``, `\`${shown}\``);
  };
  /** An address as the name that holds it, without the offset: a list names actor_queue once, not actor_queue+3 and actor_queue+6. */
  const baseTarget = (page: string, address: number) => {
    const named = nameFor(address);
    if (named === undefined) return codeOfAddress(page, address);
    return entries.has(named.name) ? entryOfName(page, named.name, named.name) : codeOfName(page, named.name);
  };
  const capped = (items: string[], limit = MAX_LISTED) => (items.length <= limit ? items.join(", ") : `${items.slice(0, limit).join(", ")} and ${items.length - limit} more`);
  /**
   * The references that use the data at their target. An access to the I/O area inside the image is the
   * register, as the source writes it: it uses no data of the RAM under it, unless the knowledge names that
   * address. So the code of the SID and the CIAs is no reader of the sprites in RAM at $d400 or $dc00.
   */
  const named = new Set(input.symbols.map((symbol) => symbol.address));
  const dataReferences = input.references.filter((reference) => !(reference.to >= IO_RAM.start && reference.to <= IO_RAM.end && input.image?.inImage(reference.to) === true && !named.has(reference.to)));
  /**
   * How the source line of a reference uses a platform name, as the source writes it: "named", "indexed"
   * (name,x or name,y: the index can reach the registers after it), or undefined when the line does not
   * name it, for example lda $d000,x with the character ROM in. "named" when the source text is not there,
   * and for a macro use (+name): each byte of the macro maps to that line, which does not show its body.
   */
  const platformUse = (reference: ReferenceRow, use: RegExp): "named" | "indexed" | undefined => {
    const line = map.lineOf(reference.from);
    const text = line === undefined ? undefined : map.textOf?.(line);
    if (text === undefined || MACRO_USE.test(text)) return "named";
    const found = use.exec(text);
    return found === null ? undefined : found[1] === undefined ? "named" : "indexed";
  };
  /** The routines that read or write a range, each once and linked to its entry. `platform` is the platform name of the range. */
  const ownersOf = (page: string, start: number, end: number, kind: string, platform?: string) => {
    const use = platform === undefined ? undefined : new RegExp(`(?<![\\w.])${platform}(?!\\w)([^,)]*,\\s*[xXyY]\\b)?`);
    // A routine with an indexed use and a direct use shows once, as indexed.
    const owners = new Map<string, boolean>();
    for (const reference of dataReferences) {
      if (reference.kind !== kind || reference.to < start || reference.to > end) continue;
      const how = use === undefined ? "named" : platformUse(reference, use);
      if (how === undefined) continue;
      const name = ownerAt(reference.from)?.name ?? hex(reference.from);
      owners.set(name, (owners.get(name) ?? false) || how === "indexed");
    }
    return capped(
      [...owners].map(([name, indexed]) => {
        const shown = entries.has(name) ? entryOfName(page, name, name) : `\`${name}\``;
        return indexed ? `${shown} (indexed)` : shown;
      }),
    );
  };

  // --- The routine graph ----------------------------------------------------
  const tableReferences: GraphReference[] = [];
  const tables = input.regions.filter((region) => TABLE_TYPES.includes(region.type));
  const tableEntries = new Map<RegionRow, Array<{ at: number; value: number; target?: number }>>();
  if (input.image !== undefined) {
    const { byteAt } = input.image;
    for (const table of tables) {
      const rows: Array<{ at: number; value: number; target?: number }> = [];
      if ((POINTER_TABLE_TYPES as readonly string[]).includes(table.type)) {
        for (const pair of pointerTableEntries({ ...table, type: table.type as PointerTableType }, byteAt)) rows.push({ at: pair.low, value: byteAt(pair.low) | (byteAt(pair.high) << 8), target: pair.target });
      } else if (table.type === "jumps") {
        for (let at = table.start; at + 2 <= table.end; at += 3) {
          const value = byteAt(at + 1) | (byteAt(at + 2) << 8);
          rows.push(byteAt(at) === 0x4c ? { at, value, target: value } : { at, value });
        }
      } else {
        for (let at = table.start; at + 1 <= table.end; at += 2) rows.push({ at, value: byteAt(at) | (byteAt(at + 1) << 8) });
      }
      tableEntries.set(table, rows);
      for (const row of rows) if (row.target !== undefined && table.type !== "words") tableReferences.push({ from: table.start, to: row.target, kind: "table" });
    }
  }
  // A table entry is an edge of the graph from each instruction that reads the table to each target in code; a table of data pointers makes no edge.
  const symbolKinds = new Map(input.symbols.map((symbol) => [symbol.address, symbol.kind]));
  const inCode = (address: number) =>
    symbolKinds.get(address) === "routine" || symbolKinds.get(address) === "label" || input.regions.some((region) => (region.type === "code" || region.type === "jumps") && region.start <= address && region.end >= address);
  const dispatches: GraphReference[] = [];
  for (const [table, rows] of tableEntries) {
    const readers = input.references.filter((reference) => TABLE_READS.includes(reference.kind) && reference.to >= table.start && reference.to <= table.end).map((reference) => reference.from);
    for (const row of rows) if (row.target !== undefined && table.type !== "words" && inCode(row.target)) for (const from of new Set(readers)) dispatches.push({ from, to: row.target, kind: "table" });
  }
  const graphReferences: GraphReference[] = [...input.references, ...dispatches];
  const heads = routineHeads(input.symbols, graphReferences, (address) => sourceNameAt.get(address) ?? hex(address));
  const boundaries = input.modules.map((module) => module.start);
  const ownerAt = (address: number) => ownerOf(heads, boundaries, address);
  const site = (page: string, from: number) => {
    const owner = ownerAt(from);
    const named = owner === undefined ? undefined : entries.has(owner.name) ? entryOfName(page, owner.name, owner.name) : codeOfName(page, owner.name);
    return named === undefined ? codeOfAddress(page, from) : `${named} ${codeOfAddress(page, from)}`;
  };
  const edges = routineEdges(heads, boundaries, graphReferences);
  /** The routine that holds an address, linked to its entry; the address when no routine holds it. */
  const ownerLink = (page: string, from: number) => {
    const owner = ownerAt(from);
    if (owner === undefined) return codeOfAddress(page, from);
    return entries.has(owner.name) ? entryOfName(page, owner.name, owner.name) : codeOfName(page, owner.name);
  };

  // --- File ranges ----------------------------------------------------------
  const fileRanges = new Map<string, { start: number; end: number }>();
  for (let address = 0; address <= 0xffff; address++) {
    const line = map.lineOf(address);
    if (line === undefined) continue;
    const known = fileRanges.get(line.file);
    if (known === undefined) fileRanges.set(line.file, { start: address, end: address });
    else known.end = address;
  }
  const titleOf = (file: string) => input.modules.find((module) => module.file === file)?.title;

  const header = referenceHeader(input.revision, map.mapPath);
  const files: ReferenceFile[] = [];
  const write = (path: string, lines: string[]) => files.push({ path, bytes: Buffer.from(`${[header, ...lines].join("\n").replace(/\n{3,}/g, "\n\n")}\n`, "utf8") });

  // --- One entry --------------------------------------------------------------
  const commentLines = (address: number) =>
    input.comments
      .filter((comment) => comment.address === address)
      .sort((a, b) => (a.placement === b.placement ? 0 : a.placement === "line" ? -1 : 1))
      .map((comment) => comment.text.replace(/\s*\r?\n\s*/g, " ").trim());
  const incoming = (entry: Entry) => dataReferences.filter((reference) => reference.to >= entry.address && reference.to <= entry.spanEnd);
  const outgoing = (head: RoutineHead) => input.references.filter((reference) => ownerAt(reference.from)?.address === head.address);
  const entryText = (page: string, entry: Entry, labels: readonly Entry[]): string[] => {
    const lines = ["", `<a id="${entry.name}"></a>`, `### ${codeOfName(page, entry.name)} \`${entry.spanEnd > entry.address ? range(entry.address, entry.spanEnd) : hex(entry.address)}\``, "", `*${entry.kind}*`];
    const comments = commentLines(entry.address);
    if (comments.length > 0) lines.push("", ...comments);
    const facts: string[] = [];
    const into = incoming(entry);
    const selfHead = heads.find((candidate) => candidate.address === entry.address);
    const fromOthers = into.filter((reference) => selfHead === undefined || ownerAt(reference.from)?.address !== selfHead.address);
    const strong = new Set(fromOthers.filter((reference) => reference.kind !== "reference" && reference.kind !== "pointer").map((reference) => reference.from));
    const by = (kinds: readonly string[]) =>
      fromOthers
        .filter((reference) => kinds.includes(reference.kind) && !((reference.kind === "reference" || reference.kind === "pointer") && strong.has(reference.from)))
        .map((reference) => ownerLink(page, reference.from));
    const add = (label: string, items: string[]) => {
      if (items.length > 0) facts.push(`- **${label}:** ${capped([...new Set(items)], MAX_FACTS)}`);
    };
    add("Called from", by(["call"]));
    add("Jumped to from", by(["jump"]));
    add("Read by", by(["read"]));
    add("Written by", by(["write"]));
    add("Referred to by", by(["reference", "pointer"]));
    const inTables = tableReferences.filter((reference) => reference.to === entry.address).map((reference) => {
      const table = tables.find((region) => region.start === reference.from)!;
      return tableLink(page, table);
    });
    add("Entry of", inTables);
    const head = selfHead;
    if (head !== undefined) {
      const all = outgoing(head);
      const named = new Set(all.filter((reference) => reference.kind !== "reference" && reference.kind !== "pointer").map((reference) => `${reference.from}:${reference.to}`));
      const from = all.filter((reference) => !((reference.kind === "reference" || reference.kind === "pointer") && named.has(`${reference.from}:${reference.to}`)));
      const to = (kinds: readonly string[]) => from.filter((reference) => kinds.includes(reference.kind) && ownerAt(reference.to)?.address !== head.address).map((reference) => baseTarget(page, reference.to));
      add("Calls", to(["call"]));
      add("Jumps to", to(["jump"]));
      add("Reads", to(["read"]));
      add("Writes", to(["write"]));
      add("Refers to", to(["reference", "pointer"]));
    }
    if (facts.length > 0) lines.push("", ...facts);
    return [...lines, ...labelTable(page, labels)];
  };
  /** The labels that only code of their own file reaches: one row each, with the anchor that links to the label. */
  const labelTable = (page: string, labels: readonly Entry[]) =>
    labels.length === 0
      ? []
      : ["", "| Label | Address | Comment |", "|---|---|---|", ...labels.map((label) => `| <a id="${label.name}"></a>${codeOfName(page, label.name)} | \`${hex(label.address)}\` | ${commentLines(label.address).join(" ").replace(/\|/g, "\\|")} |`)];
  const entersAt = new Map<number, ReferenceRow[]>();
  for (const reference of input.references) if (reference.kind === "call" || reference.kind === "jump") entersAt.set(reference.to, [...(entersAt.get(reference.to) ?? []), reference]);
  // A pointer to code (lda #<irq_handler) is a vector: the CPU enters there from no file.
  const pointedAt = new Set(input.references.filter((reference) => reference.kind === "pointer").map((reference) => reference.to));
  const tableAnchor = (table: RegionRow) => entryAt.get(table.start)?.name ?? `table_${table.start.toString(16).padStart(4, "0")}`;
  function tableLink(page: string, table: RegionRow): string {
    return `[\`${entryAt.get(table.start)?.name ?? range(table.start, table.end)}\`](${rel(page, posix.join(out, "tables.md"))}#${tableAnchor(table)})`;
  }

  // --- Module pages -----------------------------------------------------------
  const counts = { pages: 0, entries: 0, tables: 0, images: 0, edges: edges.length };
  const pieceEntries = new Map<string, Entry[]>();
  for (const entry of entries.values()) {
    const label = map.labelOf(entry.name)!;
    if (!pieces.includes(label.file)) continue;
    pieceEntries.set(label.file, [...(pieceEntries.get(label.file) ?? []), entry]);
  }
  for (const file of pieces) {
    const page = pageOfFile(file);
    const span = fileRanges.get(file);
    const own = (pieceEntries.get(file) ?? []).sort((a, b) => a.address - b.address);
    const title = titleOf(file);
    const lines = [`# ${file}${title === undefined ? "" : `: ${title}`}`, "", `Range \`${span === undefined ? "-" : range(span.start, span.end)}\`. Source: [${file}](${rel(page, map.pathOf(file))}). Index: [the reference](${rel(page, posix.join(out, "index.md"))}).`];
    // A label that only code of this file enters is a row: under the routine that holds it, else in the labels of the page.
    const headAt = new Set(heads.map((head) => head.address));
    const fromOtherFiles = (address: number) => (entersAt.get(address) ?? []).filter((reference) => map.lineOf(reference.from)?.file !== file);
    const mains = new Set(own.filter((entry) => entry.kind !== "label" || headAt.has(entry.address) || pointedAt.has(entry.address) || fromOtherFiles(entry.address).length > 0).map((entry) => entry.address));
    const labelsOf = new Map<number | undefined, Entry[]>();
    for (const entry of own) {
      if (mains.has(entry.address)) continue;
      const owner = ownerAt(entry.address)?.address;
      const group = owner !== undefined && mains.has(owner) ? owner : undefined;
      labelsOf.set(group, [...(labelsOf.get(group) ?? []), entry]);
    }
    if (span !== undefined) {
      const inside = (address: number) => address >= span.start && address <= span.end;
      const ownHeads = heads.filter((head) => inside(head.address));
      // The overview: each routine, and each label that code of another file enters.
      const starts = [...new Set([...ownHeads.map((head) => head.address), ...own.filter((entry) => mains.has(entry.address) && (entry.kind === "routine" || entry.kind === "label")).map((entry) => entry.address)])].sort((a, b) => a - b);
      if (starts.length > 0) {
        lines.push("", "## Routines", "", "| Routine | Address | Reached from | Summary |", "|---|---|---|---|");
        for (const start of starts) {
          const name = entryAt.get(start)?.name ?? ownHeads.find((head) => head.address === start)!.name;
          const shown = entries.has(name) ? entryOfName(page, name, name) : codeOfName(page, name);
          const callers = [...new Set([...edges.filter((edge) => edge.to === start && edge.kind !== "jump").map((edge) => edge.from), ...fromOtherFiles(start).map((reference) => reference.from)].map((from) => ownerLink(page, from)))];
          const summary = /^.*?[.!?](?=\s|$)|^.*$/.exec(commentLines(start).join(" "))![0].replace(/\|/g, "\\|");
          lines.push(`| ${shown} | \`${hex(start)}\` | ${capped(callers, MAX_FACTS)} | ${summary} |`);
        }
      }
      const regions = input.regions.filter((region) => region.start <= span.end && region.end >= span.start && region.type !== "code");
      if (regions.length > 0) {
        lines.push("", "## Data", "", "| Range | Type | Name | Read by | Written by |", "|---|---|---|---|---|");
        for (const region of regions) {
          const owners = (kind: string) => ownersOf(page, region.start, region.end, kind);
          const name = entryAt.get(region.start);
          lines.push(`| ${codeOfAddress(page, region.start)}${region.end === region.start ? "" : `-\`${hex(region.end)}\``} | ${region.type}${region.element === undefined ? "" : ` of ${region.element}`} | ${name === undefined ? "" : codeOfName(page, name.name)} | ${owners("read")} | ${owners("write")} |`);
        }
      }
      // Jumps are the control flow inside a group of routines: the graph draws the calls and the table entries only.
      const ownAt = new Set(ownHeads.map((head) => head.address));
      const reaching = edges.filter((edge) => edge.kind !== "jump" && (ownAt.has(edge.from) || ownAt.has(edge.to)));
      const shown = reaching.slice(0, MAX_EDGES);
      if (shown.length > 0) {
        lines.push(
          "",
          "## Call graph",
          "",
          "A solid arrow is a call, a thick arrow a table entry: from each routine that reads the table to each target in code. A table of data addresses gives no arrow, and the graph does not show the jumps. Rounded nodes are in this file.",
        );
        if (shown.length < reaching.length) lines.push("", `The graph shows ${shown.length} of the ${reaching.length} edges.`);
        lines.push("", "```mermaid", mermaidGraph(heads, shown, ownAt), "```");
      }
    }
    if (own.length > 0) lines.push("", "## Details");
    for (const entry of own) if (mains.has(entry.address)) lines.push(...entryText(page, entry, labelsOf.get(entry.address) ?? []));
    const loose = labelsOf.get(undefined) ?? [];
    if (loose.length > 0) lines.push("", "## Labels", ...labelTable(page, loose));
    counts.entries += own.length;
    write(page, lines);
  }

  // --- Tables -----------------------------------------------------------------
  {
    const page = posix.join(out, "tables.md");
    const lines = ["# Tables", "", `Each table of addresses, jumps and words, entry by entry. An RTS table holds each target minus 1; the target column gives the target. Index: [the reference](${rel(page, posix.join(out, "index.md"))}).`];
    if (input.image === undefined) lines.push("", "Put the program bytes into the project knowledge. Then generate the reference again to decode the tables.");
    for (const table of tables) {
      const name = entryAt.get(table.start);
      lines.push("", `<a id="${tableAnchor(table)}"></a>`, `## ${name === undefined ? `\`${range(table.start, table.end)}\`` : `${codeOfName(page, name.name)} \`${range(table.start, table.end)}\``}`, "", `*${table.type}*`);
      const comments = commentLines(table.start);
      if (comments.length > 0) lines.push("", ...comments);
      const readers = [...new Set(input.references.filter((reference) => reference.to >= table.start && reference.to <= table.end && TABLE_READS.includes(reference.kind)).map((reference) => site(page, reference.from)))];
      if (readers.length > 0) lines.push("", `- **Read by:** ${capped(readers)}`);
      const rows = tableEntries.get(table);
      if (rows === undefined) continue;
      lines.push("", "| Index | At | Value | Target |", "|---|---|---|---|");
      rows.forEach((row, index) => {
        const named = row.target === undefined ? nameFor(row.value) : nameFor(row.target);
        const shown = row.target === undefined ? (named?.base === row.value ? pair(page, named.name, row.value) : "") : named !== undefined && named.base === row.target ? pair(page, named.name, row.target) : target(page, row.target);
        lines.push(`| ${index} | ${codeOfAddress(page, row.at)} | \`${hex(row.value)}\` | ${shown} |`);
      });
      counts.tables++;
    }
    write(page, lines);
  }

  // --- Graphics -----------------------------------------------------------------
  {
    const page = posix.join(out, "graphics.md");
    const graphics = input.regions.filter((region) => GRAPHICS_TYPES.includes(region.type));
    const lines = [
      "# Graphics",
      "",
      `Each sprite, bitmap, charset and screen region of the knowledge. The knowledge gives no display mode and no colours, so a sprite, bitmap or charset shows in hires and in multicolour, in pattern colours: black is pixel value 0, white is 1 in hires; in multicolour light grey is 1, grey is 2 and yellow is 3. Index: [the reference](${rel(page, posix.join(out, "index.md"))}).`,
    ];
    if (input.image === undefined && graphics.length > 0) lines.push("", "Put the program bytes into the project knowledge. Then generate the reference again to show the graphics.");
    for (const region of graphics) {
      const anchor = entryAt.get(region.start)?.name ?? `${region.type}_${region.start.toString(16).padStart(4, "0")}`;
      const name = entryAt.get(region.start);
      lines.push("", `<a id="${anchor}"></a>`, `## ${name === undefined ? codeOfAddress(page, region.start) : pair(page, name.name, region.start)} \`${range(region.start, region.end)}\``, "", `*${region.type}*`);
      const comments = commentLines(region.start);
      if (comments.length > 0) lines.push("", ...comments);
      if (input.image === undefined) continue;
      const bytes = Uint8Array.from({ length: region.end - region.start + 1 }, (_, offset) => input.image!.byteAt(region.start + offset));
      if (region.type === "screen") {
        lines.push("", "```text", ...screenText(bytes), "```");
        continue;
      }
      for (const mode of ["hires", "multicolour"] as GraphicsMode[]) {
        // A sheet of sprites, a charset, or a bitmap of at most 8 rows of cells, is small: each pixel shows as 2 x 2.
        const raw = region.type === "sprite" ? spriteSheet(bytes, mode, region.element === 63 ? 63 : 64) : region.type === "charset" ? charsetFrame(bytes, mode) : bitmapFrame(bytes, mode);
        const frame = region.type === "sprite" || region.type === "charset" || raw.height <= 64 ? scaleFrame(raw, 2) : raw;
        const image = posix.join(out, "images", `${anchor}-${mode}.png`);
        files.push({ path: image, bytes: encodePng(frame, PATTERN_PALETTES[mode]) });
        lines.push("", `![${anchor} in ${mode}](${rel(page, image)})`);
        counts.images++;
      }
    }
    write(page, lines);
  }

  // --- Memory map ---------------------------------------------------------------
  {
    const page = posix.join(out, "memory-map.md");
    const lines = [
      "# Memory map",
      "",
      `Every region of the knowledge in address order, then the variables outside the program. A platform name, for example a chip register, has a reader or a writer only where the source line uses that name. (indexed) after a routine: the line adds X or Y to the address, so the access can also reach the addresses after it, which can have no row. Index: [the reference](${rel(page, posix.join(out, "index.md"))}).`,
      "",
      "## Regions",
      "",
      "| Range | Bytes | Type | Name | File |",
      "|---|---|---|---|---|",
    ];
    for (const region of [...input.regions].sort((a, b) => a.start - b.start)) {
      const name = entryAt.get(region.start);
      const line = map.lineOf(region.start);
      const file = line === undefined || !pieces.includes(line.file) ? "" : `[${line.file}](${rel(page, pageOfFile(line.file))})`;
      lines.push(`| ${codeOfAddress(page, region.start)}${region.end === region.start ? "" : `-\`${hex(region.end)}\``} | ${region.end - region.start + 1} | ${region.type} | ${name === undefined ? "" : pair(page, name.name, region.start)} | ${file} |`);
    }
    // The names outside the image: zero page, the stack, work areas and the chips. The module pages link to their rows.
    const outside = [...entries.values()].filter((entry) => map.labelOf(entry.name)?.file === "constants.asm").sort((a, b) => a.address - b.address);
    if (outside.length > 0) {
      lines.push("", "## Variables outside the program", "", "| Address | Name | Comment | Read by | Written by |", "|---|---|---|---|---|");
      for (const entry of outside) {
        const at = `\`${entry.spanEnd > entry.address ? range(entry.address, entry.spanEnd) : hex(entry.address)}\``;
        const owners = (kind: string) => ownersOf(page, entry.address, entry.spanEnd, kind, entry.kind === "platform" ? entry.name : undefined);
        lines.push(`| ${at} | <a id="${entry.name}"></a>${codeOfName(page, entry.name)} | ${commentLines(entry.address).join(" ").replace(/\|/g, "\\|")} | ${owners("read")} | ${owners("write")} |`);
      }
      counts.entries += outside.length;
    }
    write(page, lines);
  }

  // --- Index ------------------------------------------------------------------------
  {
    const page = posix.join(out, "index.md");
    const lines = [
      "# Reference",
      "",
      `Generated from the knowledge and the source in [${map.directory}](${rel(page, map.directory)}). The other pages: [tables](tables.md), [memory map and variables](memory-map.md) and [graphics](graphics.md).`,
      "",
      "| File | Range | Title | Routines | Names |",
      "|---|---|---|---|---|",
    ];
    for (const file of pieces) {
      const span = fileRanges.get(file);
      const own = pieceEntries.get(file) ?? [];
      const routines = span === undefined ? 0 : heads.filter((head) => head.address >= span.start && head.address <= span.end).length;
      lines.push(`| [${file}](${rel(page, pageOfFile(file))}) | \`${span === undefined ? "-" : range(span.start, span.end)}\` | ${titleOf(file) ?? ""} | ${routines} | ${own.length} |`);
    }
    write(page, lines);
  }
  counts.pages = files.filter((file) => file.path.endsWith(".md")).length;

  // --- Gaps -----------------------------------------------------------------------
  const fileOf = (address: number) => map.lineOf(address)?.file;
  const routineFiles = new Set(heads.map((head) => fileOf(head.address)));
  // A module of data only needs no routine: only a file with code lines is a gap.
  const codeFiles = new Set<string | undefined>();
  for (const region of input.regions) if (region.type === "code") for (let address = region.start; address <= region.end; address++) codeFiles.add(fileOf(address));
  const gaps: ReferenceGaps = {
    routinesWithoutComment: heads.flatMap((head) => {
      const file = fileOf(head.address);
      return file !== undefined && pieces.includes(file) && commentLines(head.address).length === 0 ? [{ name: head.name, address: head.address, file }] : [];
    }),
    modulesWithoutRoutines: [...input.modules]
      .sort((a, b) => a.start - b.start)
      .filter((module) => pieces.includes(module.file) && codeFiles.has(module.file) && !routineFiles.has(module.file))
      .map((module) => ({ file: module.file, start: module.start, ...(module.title === undefined ? {} : { title: module.title }) })),
    tablesWithoutName: tables.filter((table) => entryAt.get(table.start) === undefined).map((table) => ({ start: table.start, end: table.end, type: table.type })),
  };
  return { files, counts, gaps };
}
