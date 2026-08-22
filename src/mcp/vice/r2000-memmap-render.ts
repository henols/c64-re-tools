#!/usr/bin/env node
// r2000-memmap-render.ts -- the ONE authoritative place in this repo that
// renders the human-readable Markdown memory map from the r2000 annotation
// store (D-24) plus a validated run-scoped provenance sidecar (D-27's
// reconciliation, recorded in 11-10-PLAN.md's objective).
//
// WHY THIS MODULE EXISTS (D-24): the store is canonical; the Markdown memory
// map becomes a rendered VIEW. Criterion 1 says findings must be queryable
// "instead of re-deriving from Markdown prose" -- that is only true by
// construction if the prose is GENERATED from the queryable thing. Nothing
// downstream of this module may hand-author an address row: every row in
// the Range/Contents/Confidence/Evidence table comes from
// `r2000_get_blocks`/`r2000_get_symbols`/`r2000_get_comments`, never from a
// human editing the output file directly.
//
// THE D-24/D-27 RECONCILIATION THIS FILE IMPLEMENTS: run-scoped facts (the
// capture's SHA-256, `$01`, `$DD00`, the derived graphics chain, the video
// standard, the live vector pair, observed raster positions) are facts about
// a RUN, not about an address -- the store is address-keyed and has no shape
// for them. They arrive here as an INPUT to the renderer (a JSON sidecar,
// `parseProvenanceHeader()`'s own schema), never as a hand-edited region of
// this module's OUTPUT. A missing or malformed required sidecar key is a
// named error listing every problem at once; this module never substitutes a
// `<placeholder>` for one.
//
// WHY THE LAYOUT IS EMBEDDED IN TYPESCRIPT RATHER THAN READ FROM A TEMPLATE
// FILE AT RUNTIME (the second decision this plan records): Phase 10's D-06
// established that `.claude/mcp/vice/*.ts` exists as files on disk only
// under the Claude Code plugin route -- both npm-installer routes launch via
// `npx`. A renderer that resolved a template path into the skills tree at
// runtime would silently fail to resolve for an npm-installed user. The
// recon skill's own template becomes prose pointing at this generator
// instead (a later plan's job); this module hardcodes the target shape.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR:
//   - the provenance sidecar schema (`ProvenanceHeader`,
//     `parseProvenanceHeader()`) -- nowhere else in this repo may hand-parse
//     or hand-validate that JSON shape;
//   - rendering the memory map (`renderMemoryMap()`) -- nowhere else may
//     assemble the Range/Contents/Confidence/Evidence table or the banner;
//   - drift detection (`checkRenderedMemoryMap()`) -- the one place a
//     rendered file on disk is compared against what the store (plus the
//     sidecar) would produce right now;
//   - Markdown-cell escaping (`escapeMarkdownCell()`, WR-04, closed) --
//     every store-derived text interpolation in the generated document
//     (comment evidence, symbol names) is escaped through this one
//     function, never a second ad hoc `.replace()` at a call site.
//
// WHAT NOT TO DO, named concretely:
//   - Never hand-edit the rendered output. The banner exists precisely so a
//     human editor is caught by `checkRenderedMemoryMap()` -- see the
//     `render_digest` comment below for exactly what it covers.
//   - Never read the layout from the skills tree at runtime (Phase 10 D-06).
//     This module's own non-vacuity test asserts a zero-count grep for the
//     recon skill's template filename -- if you are tempted to add a
//     `readFileSync()` call reaching into `.claude/skills/`, don't; the
//     layout lives here, in TypeScript, by design.
//   - Never substitute a placeholder for a missing or malformed sidecar key.
//     `parseProvenanceHeader()` throws, naming every problem at once, rather
//     than rendering a document that LOOKS complete but silently carries a
//     `<hash>`-shaped lie.
//   - Never write an address row from anywhere but the store. If a future
//     caller wants to add a derived-but-not-address-keyed fact (a new
//     run-scoped field), it joins `ProvenanceHeader`'s schema, not a second
//     ad hoc parameter to `renderMemoryMap()`.
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { runR2000Tool } from "./r2000-tools.ts";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./r2000-confidence.ts";
import type { ConfidenceGrade } from "./r2000-confidence.ts";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// The r2000 query result shapes this renderer consumes, measured live
// against a real regenerator2000-core-0.9.20 `--mcp-server-stdio` child
// (never transcribed from a document): `r2000_get_blocks` returns
// `{start_address, end_address, type}`; `r2000_get_symbols` returns
// `{address, name, kind, type}`; `r2000_get_comments` returns
// `{address, comment, type}`.
// ---------------------------------------------------------------------------

interface R2000Block {
  start_address: number;
  end_address: number;
  type: string;
}

interface R2000Symbol {
  address: number;
  name: string;
  kind: string;
  type: string;
}

interface R2000Comment {
  address: number;
  comment: string;
  type: "line" | "side";
}

async function queryR2000Json<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = await runR2000Tool(name, args);
  if (result.isError) {
    throw new Error(`${name} failed: ${result.content[0]?.text ?? "(no message)"}`);
  }
  return JSON.parse(result.content[0]!.text) as T;
}

// ---------------------------------------------------------------------------
// The provenance sidecar schema.
// ---------------------------------------------------------------------------

export interface ProvenanceHeader {
  capturePath: string;
  /** 64 lowercase or uppercase hex characters -- the capture's SHA-256. */
  captureSha256: string;
  /** The `$01` port value, e.g. `"$35"`. */
  port01: string;
  /** The `$DD00` value, e.g. `"$06"`. */
  dd00: string;
  /** The VIC bank derived from `$DD00` bits 0-1 (inverted), e.g. `"0 ($0000-$3FFF)"`. */
  vicBank: string;
  /** Screen RAM derived from `$D018` bits 4-7, e.g. `"$0400"`. */
  screenRam: string;
  /** Charset/bitmap derived from `$D018` bits 1-3, e.g. `"$1000 (ROM shadow)"`. */
  charsetOrBitmap: string;
  /** The graphics mode derived from `$D011` bits 5-6 and `$D016` bit 4, e.g. `"text, multicolor off"`. */
  mode: string;
  videoStandard: "PAL" | "NTSC";
  /** The live vector pair in effect, e.g. `"$0314/$0315"` or `"$FFFE/$FFFF"`. */
  liveVectorPair: string;
  /** The address (or label) the live vector pair points at. */
  vectorHandler: string;
  /** One entry per observed `$D012` write on the way out of a handler. Optional. */
  rasterPositions?: string[];
}

const REQUIRED_STRING_KEYS: readonly (keyof ProvenanceHeader)[] = [
  "capturePath",
  "captureSha256",
  "port01",
  "dd00",
  "vicBank",
  "screenRam",
  "charsetOrBitmap",
  "mode",
  "videoStandard",
  "liveVectorPair",
  "vectorHandler",
];

/** A template placeholder is anything shaped like `<...>` -- the recon
 * template's own placeholders (`<hash>`, `<PAL/NTSC>`, `<n>`, `<value>`,
 * `<handler>`, ...) are exactly this shape, and the most likely thing to be
 * copied into a sidecar by accident. */
const PLACEHOLDER_PATTERN = /^<.*>$/;

export class R2000ProvenanceHeaderError extends Error {
  /** Every problem found, one entry per offending key -- a caller filling a
   * sidecar wants the whole list, not one problem at a time. */
  problems: readonly string[];

  constructor(message: string, problems: readonly string[]) {
    super(message);
    this.name = "R2000ProvenanceHeaderError";
    this.problems = problems;
  }
}

/**
 * Parses and validates a provenance sidecar. Collects EVERY problem (a
 * missing key, a non-string value, a template placeholder, a malformed
 * `captureSha256`, an invalid `videoStandard`, a malformed
 * `rasterPositions`) into one list and throws `R2000ProvenanceHeaderError`
 * naming all of them at once -- never one at a time.
 */
export function parseProvenanceHeader(json: unknown): ProvenanceHeader {
  const problems: string[] = [];

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new R2000ProvenanceHeaderError(
      `provenance sidecar must be a JSON object, got ${Array.isArray(json) ? "an array" : typeof json}`,
      ["<root>: must be a JSON object"],
    );
  }
  const obj = json as Record<string, unknown>;

  for (const key of REQUIRED_STRING_KEYS) {
    const value = obj[key];
    if (typeof value !== "string" || value.trim() === "") {
      problems.push(`${key}: missing or not a non-empty string`);
      continue;
    }
    if (PLACEHOLDER_PATTERN.test(value.trim())) {
      problems.push(`${key}: still carries a template placeholder (${value}) -- fill in the real value`);
    }
  }

  const sha = obj.captureSha256;
  if (typeof sha === "string" && sha.trim() !== "" && !PLACEHOLDER_PATTERN.test(sha.trim())) {
    if (!/^[0-9a-fA-F]{64}$/.test(sha.trim())) {
      problems.push(`captureSha256: must be exactly 64 hex characters, got "${sha}" (length ${sha.trim().length})`);
    }
  }

  const vs = obj.videoStandard;
  if (typeof vs === "string" && vs.trim() !== "" && !PLACEHOLDER_PATTERN.test(vs.trim())) {
    if (vs !== "PAL" && vs !== "NTSC") {
      problems.push(`videoStandard: must be exactly "PAL" or "NTSC", got "${vs}"`);
    }
  }

  let rasterPositions: string[] | undefined;
  if (obj.rasterPositions !== undefined) {
    const rp = obj.rasterPositions;
    if (!Array.isArray(rp) || rp.some((v) => typeof v !== "string")) {
      problems.push("rasterPositions: when present must be an array of strings");
    } else {
      rasterPositions = rp as string[];
    }
  }

  if (problems.length > 0) {
    throw new R2000ProvenanceHeaderError(
      `provenance sidecar has ${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join("\n"),
      problems,
    );
  }

  return {
    capturePath: obj.capturePath as string,
    captureSha256: (obj.captureSha256 as string).trim(),
    port01: obj.port01 as string,
    dd00: obj.dd00 as string,
    vicBank: obj.vicBank as string,
    screenRam: obj.screenRam as string,
    charsetOrBitmap: obj.charsetOrBitmap as string,
    mode: obj.mode as string,
    videoStandard: obj.videoStandard as "PAL" | "NTSC",
    liveVectorPair: obj.liveVectorPair as string,
    vectorHandler: obj.vectorHandler as string,
    rasterPositions,
  };
}

// ---------------------------------------------------------------------------
// The render digest -- documented exactly, because a digest whose inputs are
// unclear is a digest nobody trusts. It covers, in order: a canonical JSON
// serialisation of the SORTED `r2000_get_blocks`/`r2000_get_symbols`/
// `r2000_get_comments` results (so a store-side change, e.g. a comment's
// confidence grade, changes the digest even with the rendered file
// untouched), the raw provenance sidecar BYTES (not the parsed object, so
// even whitespace-only sidecar edits are covered), and this renderer's own
// version constant (so a future format change is distinguishable from a
// hand edit).
// ---------------------------------------------------------------------------

/** Bumped whenever this renderer's OUTPUT SHAPE changes, so a re-render
 * under a new renderer version is distinguishable from drift under the same
 * one. Version 2 (this plan, 260821-a86) escapes Markdown table cells via
 * `escapeMarkdownCell()` -- WR-04. */
export const RENDERER_VERSION = "2";

/**
 * Escapes `text` for safe interpolation into a Markdown table cell or list
 * item: every `|` becomes `\|`, and every `\r\n`/`\n`/bare `\r` collapses to
 * `<br>` (a single-line-safe line break inside a table cell). This control
 * ESCAPES and never REJECTS -- unlike the label-name policy
 * (`r2000-acme-ident.ts`'s `assertLegalAcmeIdentifier()`, T-11-NAME-INJECT's
 * other leg), because comment `evidence` legitimately contains `|` and
 * embedded newlines (`r2000_set_comment`'s own schema documents multi-line
 * support) -- refusing here would refuse valid data, not an attack. Closes
 * WR-04 / T-11-NAME-INJECT's render leg: an unescaped `|` or newline in
 * store text used to be able to inject an extra table cell or split a row
 * across lines in the generated Markdown. A plain string or an empty string
 * is returned unchanged. */
export function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");
}

function computeRenderDigest(
  blocks: readonly R2000Block[],
  symbols: readonly R2000Symbol[],
  comments: readonly R2000Comment[],
  sidecarBytes: string,
): string {
  const canonical = JSON.stringify({ blocks, symbols, comments }) + " " + sidecarBytes + " " + RENDERER_VERSION;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function hex4(addr: number): string {
  return `$${addr.toString(16).toUpperCase().padStart(4, "0")}`;
}

interface GradedComment {
  address: number;
  grade: ConfidenceGrade | null;
  evidence: string;
}

// ---------------------------------------------------------------------------
// renderMemoryMap()
// ---------------------------------------------------------------------------

export interface RenderMemoryMapOptions {
  projectPath: string;
  provenancePath: string;
}

export interface RenderMemoryMapResult {
  markdown: string;
  renderDigest: string;
  /** Number of Range/Contents/Confidence/Evidence rows emitted. */
  rowCount: number;
  /** Number of comments carrying the `[unknown]` grade -- the Open questions count. */
  unknownCount: number;
}

/**
 * Renders the memory map from the r2000 store plus a validated provenance
 * sidecar. Queries `r2000_get_blocks`/`r2000_get_symbols`/`r2000_get_comments`
 * through `r2000-tools.ts`'s curated, allow-listed `runR2000Tool()` -- never
 * `r2000-mcp-client.ts` directly (mirrors every other consumer's discipline
 * in this repo).
 *
 * A malformed confidence prefix inside a store comment (a typo that survived
 * whatever wrote it) THROWS through `parseConfidencePrefix()` -- this
 * renderer never silently drops or blanks a grade it cannot parse; the typo
 * must be fixed in the store, not hidden in the rendered view.
 */
export async function renderMemoryMap(opts: RenderMemoryMapOptions): Promise<RenderMemoryMapResult> {
  const { projectPath, provenancePath } = opts;

  let sidecarBytes: string;
  try {
    sidecarBytes = readFileSync(provenancePath, "utf8");
  } catch (err) {
    throw new Error(`renderMemoryMap: could not read provenance sidecar at "${provenancePath}": ${errMsg(err)}`);
  }

  let sidecarJson: unknown;
  try {
    sidecarJson = JSON.parse(sidecarBytes);
  } catch (err) {
    throw new Error(`renderMemoryMap: provenance sidecar at "${provenancePath}" is not valid JSON: ${errMsg(err)}`);
  }
  const provenance = parseProvenanceHeader(sidecarJson);

  const blocks = await queryR2000Json<R2000Block[]>("r2000_get_blocks", { project: projectPath });
  const symbols = await queryR2000Json<R2000Symbol[]>("r2000_get_symbols", { project: projectPath });
  const comments = await queryR2000Json<R2000Comment[]>("r2000_get_comments", {
    project: projectPath,
    type: "line",
  });

  const sortedBlocks = [...blocks].sort((a, b) => a.start_address - b.start_address);
  const sortedSymbols = [...symbols].sort((a, b) => a.address - b.address);
  const sortedComments = [...comments].sort((a, b) => a.address - b.address);

  const gradedComments: GradedComment[] = sortedComments.map((c) => {
    const parsed = parseConfidencePrefix(c.comment);
    return { address: c.address, grade: parsed.grade, evidence: parsed.rest };
  });

  function findGradeInRange(startAddr: number, endAddr: number): GradedComment | undefined {
    return gradedComments.find((c) => c.address >= startAddr && c.address <= endAddr);
  }

  const renderDigest = computeRenderDigest(sortedBlocks, sortedSymbols, sortedComments, sidecarBytes);

  const lines: string[] = [];

  lines.push("<!--");
  lines.push("  GENERATED by `vice-mcp r2000 render-memmap` -- do not hand-edit; re-run the generator.");
  lines.push(`  store: ${projectPath}`);
  lines.push(`  sidecar: ${provenancePath}`);
  lines.push(`  render_digest: ${renderDigest}`);
  lines.push(
    "  The digest covers the sorted r2000_get_blocks/r2000_get_symbols/r2000_get_comments results, the",
  );
  lines.push(
    "  raw provenance sidecar bytes, and this renderer's version constant -- so either a hand edit or a",
  );
  lines.push("  store-side change (e.g. a comment's confidence grade) is detected by `render-memmap --check`.");
  lines.push("-->");
  lines.push("");
  lines.push(`# Memory map — ${provenance.capturePath}`);
  lines.push("");
  lines.push(`Capture: \`${provenance.capturePath}\`  ·  SHA-256 \`${provenance.captureSha256}\``);
  lines.push(
    `\`$01\` = \`${provenance.port01}\`  ·  VIC bank \`${provenance.vicBank}\` (\`$DD00\` = \`${provenance.dd00}\`)  ·  video standard \`${provenance.videoStandard}\``,
  );
  lines.push(`Live vector pair: \`${provenance.liveVectorPair}\` → \`${provenance.vectorHandler}\``);
  lines.push("");
  lines.push(
    "Every row carries a confidence. Do not promote a row by editing its grade -- re-verify and restate",
  );
  lines.push("the evidence, so the record of when something stopped being a guess survives.");
  lines.push("");
  lines.push("| Range | Contents | Confidence | Evidence |");
  lines.push("|---|---|---|---|");
  for (const block of sortedBlocks) {
    const match = findGradeInRange(block.start_address, block.end_address);
    const range = `\`${hex4(block.start_address)}-${hex4(block.end_address)}\``;
    const grade = match?.grade ? match.grade.phrase.toUpperCase() : "";
    const evidence = match ? escapeMarkdownCell(match.evidence) : "";
    lines.push(`| ${range} | ${block.type} | ${grade} | ${evidence} |`);
  }
  lines.push("");
  lines.push("Confidence vocabulary — the project's HIGH / MEDIUM / LOW scale, applied to classification:");
  lines.push("");
  lines.push("| Grade | Means |");
  lines.push("|---|---|");
  for (const grade of CONFIDENCE_GRADES) {
    lines.push(`| **${grade.phrase}** | ${grade.meaning} |`);
  }
  lines.push("");
  lines.push("## Graphics chain");
  lines.push("");
  lines.push("| What | Address | Derived from |");
  lines.push("|---|---|---|");
  lines.push(`| VIC bank | ${provenance.vicBank} | \`$DD00\` bits 0-1, inverted |`);
  lines.push(`| Screen RAM (VM) | ${provenance.screenRam} | \`$D018\` bits 4-7 |`);
  lines.push(`| Charset / bitmap (CB) | ${provenance.charsetOrBitmap} | \`$D018\` bits 1-3 |`);
  lines.push(`| Mode | ${provenance.mode} | \`$D011\` bits 5-6, \`$D016\` bit 4 |`);
  lines.push("");
  lines.push("## Interrupts");
  lines.push("");
  lines.push("| | Address | Notes |");
  lines.push("|---|---|---|");
  lines.push(`| Live IRQ handler | ${provenance.vectorHandler} | via ${provenance.liveVectorPair} |`);
  if (provenance.rasterPositions && provenance.rasterPositions.length > 0) {
    lines.push(
      `| Raster positions | ${provenance.rasterPositions.join(", ")} | one per \`$D012\` write on the way out of a handler |`,
    );
  }
  lines.push("");
  lines.push("## Routines");
  lines.push("");
  lines.push("| Address | Provisional name | Confirmed by | Confidence |");
  lines.push("|---|---|---|---|");
  const codeBlocks = sortedBlocks.filter((b) => b.type === "Code");
  for (const sym of sortedSymbols) {
    const inCode = codeBlocks.some((b) => sym.address >= b.start_address && sym.address <= b.end_address);
    if (!inCode) continue;
    const match = gradedComments.find((c) => c.address === sym.address);
    const grade = match?.grade ? match.grade.phrase.toUpperCase() : "";
    const confirmedBy = match ? escapeMarkdownCell(match.evidence) : "";
    lines.push(`| ${hex4(sym.address)} | ${escapeMarkdownCell(sym.name)} | ${confirmedBy} | ${grade} |`);
  }
  lines.push("");
  lines.push("## Open questions");
  lines.push("");
  const unknowns = gradedComments.filter((c) => c.grade?.token === "unknown");
  if (unknowns.length === 0) {
    lines.push("- (none)");
  } else {
    for (const u of unknowns) {
      lines.push(`- ${hex4(u.address)}: ${escapeMarkdownCell(u.evidence)}`);
    }
  }
  lines.push("");

  const markdown = lines.join("\n");
  return { markdown, renderDigest, rowCount: sortedBlocks.length, unknownCount: unknowns.length };
}

// ---------------------------------------------------------------------------
// checkRenderedMemoryMap()
// ---------------------------------------------------------------------------

export interface CheckRenderedMemoryMapOptions {
  projectPath: string;
  provenancePath: string;
  renderedPath: string;
}

export type CheckRenderedMemoryMapResult =
  | { status: "in-sync" }
  | { status: "drifted"; line: number; expected: string; actual: string }
  | { status: "missing"; path: string };

/**
 * Re-renders the memory map from the CURRENT store and sidecar state and
 * compares it against the file on disk at `renderedPath`, line by line.
 * Never auto-fixes. Returns:
 *   - `{status:"missing"}` when `renderedPath` does not exist;
 *   - `{status:"in-sync"}` when the freshly rendered text is byte-identical
 *     to the file on disk;
 *   - `{status:"drifted", line, expected, actual}` naming the first
 *     differing line otherwise -- reached by EITHER a hand edit to the file
 *     OR a store-side change (a label, a comment, a block) since the file
 *     was last rendered, because both change what a fresh render produces.
 */
export async function checkRenderedMemoryMap(
  opts: CheckRenderedMemoryMapOptions,
): Promise<CheckRenderedMemoryMapResult> {
  const { projectPath, provenancePath, renderedPath } = opts;

  if (!existsSync(renderedPath)) {
    return { status: "missing", path: renderedPath };
  }

  const onDisk = readFileSync(renderedPath, "utf8");
  const { markdown } = await renderMemoryMap({ projectPath, provenancePath });

  if (onDisk === markdown) {
    return { status: "in-sync" };
  }

  const diskLines = onDisk.split("\n");
  const freshLines = markdown.split("\n");
  const max = Math.max(diskLines.length, freshLines.length);
  for (let i = 0; i < max; i++) {
    if (diskLines[i] !== freshLines[i]) {
      return {
        status: "drifted",
        line: i + 1,
        expected: freshLines[i] ?? "(end of file)",
        actual: diskLines[i] ?? "(end of file)",
      };
    }
  }
  // Unreachable in practice (the strings already compared unequal above),
  // kept only as a defensive fallback.
  return { status: "drifted", line: max + 1, expected: "(no further lines)", actual: "(no further lines)" };
}
