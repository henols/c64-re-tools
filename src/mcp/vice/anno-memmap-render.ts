#!/usr/bin/env node
// anno-memmap-render.ts -- the ONE authoritative place in this repo that
// renders the human-readable Markdown memory map from this project's own
// annotation store (D-24) plus a validated run-scoped provenance sidecar
// (D-27's reconciliation, recorded in 11-10-PLAN.md's objective).
//
// WHY THIS MODULE EXISTS (D-24): the store is canonical; the Markdown memory
// map becomes a rendered VIEW. Criterion 1 says findings must be queryable
// "instead of re-deriving from Markdown prose" -- that is only true by
// construction if the prose is GENERATED from the queryable thing. Nothing
// downstream of this module may hand-author an address row: every row in
// the Range/Contents/Confidence/Evidence table comes from the store's own
// `listRanges()`/`listLabels()`/`listComments()` readers, never from a
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

import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./anno-confidence.ts";
import type { ConfidenceGrade } from "./anno-confidence.ts";
import { openStore, closeStore, listRanges, listLabels, listComments } from "./anno-store.ts";
import { COMMENT_TYPES, workspaceRelativePath } from "./anno-types.ts";
import type { CommentRow, LabelRow, RangeRow } from "./anno-types.ts";
import { blockClassAt } from "./block-class.ts";

// ---------------------------------------------------------------------------
// WHAT THE VERSION-2 DIGEST HASHED -- the provenance of a lineage this
// renderer no longer reads. Version 2 hashed three wire result shapes
// measured LIVE against a real external-analyser-core-0.9.20
// `--mcp-server-stdio` child, never transcribed from a document:
// `anno_get_blocks` returned `{start_address, end_address, type}`,
// `anno_get_symbols` returned `{address, name, kind, type}`, and
// `anno_get_comments` returned `{address, comment, type}`.
//
// THIS PARAGRAPH IS THE RECORD, not a pointer at one. The three `interface`
// declarations it used to sit above went with the queries, so the spellings
// are carried here inline rather than left as a comment above a hole. It
// survives because `RENDERER_VERSION`'s "2" -> "3" bump is a statement about
// TWO KNOWN input shapes -- version 3 canonicalises this store's own
// `RangeRow`/`LabelRow`/`CommentRow` -- and that statement is only true
// while the older one is on the record. Delete this and the bump names one
// known input shape and one assumed one.
// ---------------------------------------------------------------------------

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The ONE piece of a `JSON.parse` failure that is safe to report: the byte
 * offset at which parsing stopped, as ` (at byte offset N)`, or `""` when the
 * runtime did not name one.
 *
 * WHY THIS IS A DIGIT EXTRACTOR AND NOT A MESSAGE PASS-THROUGH (CR-03). V8's
 * JSON `SyntaxError` embeds a SNIPPET OF THE INPUT in its own message --
 * `Unexpected token 'Q', "QQZZORACLE"... is not valid JSON` -- so any code
 * that forwards `err.message` from a JSON parse over caller-supplied bytes is
 * a content-disclosure oracle. The capture group here is `(\d+)` and nothing
 * else, so no byte of the parsed file can reach the returned string however
 * the runtime words its message. Widening this regex to capture anything but
 * digits reopens CR-03.
 *
 * Returns `""` rather than guessing when no position is present (`Unexpected
 * end of JSON input` carries none) -- an absent offset is reported by absence,
 * never by a fabricated zero.
 */
function jsonParsePosition(err: unknown): string {
  const match = /\bat position (\d+)\b/.exec(errMsg(err));
  return match ? ` (at byte offset ${match[1]})` : "";
}

/** The store's own spelling for a comment placed on its own line before the
 * instruction, read out of `COMMENT_TYPES` -- the ONE home of that
 * vocabulary -- rather than re-typed as a literal here. The pre-store
 * renderer passed `type: "line"` to its comment query; this is that filter,
 * moved to the read boundary. */
const [LINE_COMMENT] = COMMENT_TYPES;

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

export class AnnoProvenanceHeaderError extends Error {
  /** Every problem found, one entry per offending key -- a caller filling a
   * sidecar wants the whole list, not one problem at a time. */
  problems: readonly string[];

  constructor(message: string, problems: readonly string[]) {
    super(message);
    this.name = "AnnoProvenanceHeaderError";
    this.problems = problems;
  }
}

/**
 * Parses and validates a provenance sidecar. Collects EVERY problem (a
 * missing key, a non-string value, a template placeholder, a malformed
 * `captureSha256`, an invalid `videoStandard`, a malformed
 * `rasterPositions`) into one list and throws `AnnoProvenanceHeaderError`
 * naming all of them at once -- never one at a time.
 */
export function parseProvenanceHeader(json: unknown): ProvenanceHeader {
  const problems: string[] = [];

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new AnnoProvenanceHeaderError(
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
    throw new AnnoProvenanceHeaderError(
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
// serialisation of the SORTED `listRanges()`/`listLabels()`/
// `listComments()` store rows (so a store-side change, e.g. a comment's
// confidence grade, changes the digest even with the rendered file
// untouched), the raw provenance sidecar BYTES (not the parsed object, so
// even whitespace-only sidecar edits are covered), and this renderer's own
// version constant (so a future format change is distinguishable from a
// hand edit).
// ---------------------------------------------------------------------------

/** Bumped whenever this renderer's OUTPUT SHAPE **or its digest's canonical
 * INPUT** changes, so a re-render under a new renderer version is
 * distinguishable from drift under the same one.
 *
 * Version 2 (260821-a86) escaped Markdown table cells via
 * `escapeMarkdownCell()` -- WR-04, an output-shape change.
 *
 * Version 3 (D-17) is an INPUT change: `computeRenderDigest()` canonicalises
 * this store's own `RangeRow`/`LabelRow`/`CommentRow` instead of the three
 * wire shapes recorded above, so the same underlying annotations hash
 * differently either side of it. Leaving the version at "2" across that
 * boundary would let two incompatible renderings compare as ordinary drift. */
export const RENDERER_VERSION = "3";

/**
 * Escapes `text` for safe interpolation into a Markdown table cell or list
 * item: every `|` becomes `\|`, and every `\r\n`/`\n`/bare `\r` collapses to
 * `<br>` (a single-line-safe line break inside a table cell). This control
 * ESCAPES and never REJECTS -- unlike the label-name policy
 * (`anno-acme-ident.ts`'s `assertLegalAcmeIdentifier()`, T-11-NAME-INJECT's
 * other leg), because comment `evidence` legitimately contains `|` and
 * embedded newlines (`anno_set_comment`'s own schema documents multi-line
 * support) -- refusing here would refuse valid data, not an attack. Closes
 * WR-04 / T-11-NAME-INJECT's render leg: an unescaped `|` or newline in
 * store text used to be able to inject an extra table cell or split a row
 * across lines in the generated Markdown. A plain string or an empty string
 * is returned unchanged. */
export function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");
}

function computeRenderDigest(
  blocks: readonly RangeRow[],
  symbols: readonly LabelRow[],
  comments: readonly CommentRow[],
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
  /** The annotation store to render. The CALLER confines it through
   *  `storePathWithinWorkspace()` and `openStore()` below confines it again
   *  against the same `workspaceRoot`, so both answers agree by construction
   *  rather than by a second rule (T-29-51). */
  storePath: string;
  /** The provenance sidecar to render from. The CALLER confines it through
   *  `storePathWithinWorkspace()` before entering this module -- today that
   *  caller is `anno-cli.ts`'s `cmdRenderMemmap()`. THIS MODULE PERFORMS NO
   *  CONFINEMENT OF ITS OWN, and must never be handed a path that has not
   *  been through that seam.
   *
   *  THIS FIELD WAS DOCUMENTED BY SILENCE, and the silence is what the review
   *  names as the mechanism. `storePath` one line above carried four lines
   *  stating who confines it; this field, an equally caller-supplied path
   *  reaching an equally real `readFileSync`, carried nothing -- so a reader
   *  comparing the two would reasonably conclude the difference was
   *  deliberate. It was not: the CLI read this argument raw, making it an
   *  arbitrary-file read oracle (`29-REVIEW.md` CR-03). An absent comment
   *  beside a present one is a claim, and this one was false. */
  provenancePath: string;
  /** The workspace root both confinement checks are taken against. REQUIRED
   *  rather than defaulted: `openStore()`'s default behaviour is to CREATE
   *  the file, so an unconfined store path is a store file created wherever
   *  the caller's argument pointed. */
  workspaceRoot: string;
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
 * Renders the memory map from an annotation store plus a validated
 * provenance sidecar. Reads the store DIRECTLY -- `listRanges()`,
 * `listLabels()` and `listComments()` on ONE handle, opened once per render
 * and closed in a `finally` -- with no child process anywhere on this path.
 *
 * The store's block-kind spelling is interpreted in exactly one place,
 * `block-class.ts`'s `blockClassAt()`; nothing below compares a
 * `dataType` string itself.
 *
 * A malformed confidence prefix inside a store comment (a typo that survived
 * whatever wrote it) THROWS through `parseConfidencePrefix()` -- this
 * renderer never silently drops or blanks a grade it cannot parse; the typo
 * must be fixed in the store, not hidden in the rendered view.
 */
export async function renderMemoryMap(opts: RenderMemoryMapOptions): Promise<RenderMemoryMapResult> {
  const { storePath, provenancePath, workspaceRoot } = opts;

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
    // NEVER INTERPOLATE THE UNDERLYING PARSE ERROR HERE (CR-03). Node's
    // SyntaxError quotes a snippet of the input it choked on -- e.g.
    // `Unexpected token 'Q', "QQZZORACLE"... is not valid JSON` -- so passing
    // it through turns a read refusal into a CONTENT-DISCLOSURE ORACLE. That
    // matters here specifically because this argument arrives from an
    // agent-composed Bash invocation: the shipped playbooks tell an LLM to
    // compose this path, so the error text is read by whatever composed it.
    //
    // What survives is everything a caller legitimately needs to fix the
    // problem: WHICH file, and THAT it is not JSON. The byte OFFSET is
    // included where Node exposes one, because a position is a fact about
    // where parsing stopped and not about what the file contains.
    throw new Error(
      `renderMemoryMap: provenance sidecar at "${provenancePath}" is not valid JSON${jsonParsePosition(err)}. ` +
        "The underlying parser message is deliberately NOT included -- it quotes the file's own bytes (CR-03).",
    );
  }
  const provenance = parseProvenanceHeader(sidecarJson);

  // ONE handle for the whole render, closed in a `finally`. `mustExist` is
  // what makes "the annotations are gone" and "there are no annotations"
  // refuse differently (T-29-52): without it a mistyped path would CREATE an
  // empty store and render as an empty memory map indistinguishable from a
  // real one.
  const handle = openStore(storePath, { workspaceRoot, mustExist: true });
  let ranges: RangeRow[];
  let labels: LabelRow[];
  let lineComments: CommentRow[];
  try {
    ranges = listRanges(handle);
    labels = listLabels(handle);
    lineComments = listComments(handle).filter((c) => c.commentType === LINE_COMMENT);
  } finally {
    closeStore(handle);
  }

  const sortedBlocks = [...ranges].sort((a, b) => a.start - b.start);
  const sortedSymbols = [...labels].sort((a, b) => a.address - b.address);
  const sortedComments = [...lineComments].sort((a, b) => a.address - b.address);

  // The block listing in `block-class.ts`'s own entry shape. The `dataType`
  // column is copied VERBATIM and never compared here -- that module is the
  // one place in this tree allowed to interpret it.
  const blockEntries = sortedBlocks.map((row) => ({
    start_address: row.start,
    end_address: row.endInclusive,
    type: row.dataType as string,
  }));

  const gradedComments: GradedComment[] = sortedComments.map((c) => {
    const parsed = parseConfidencePrefix(c.text);
    return { address: c.address, grade: parsed.grade, evidence: parsed.rest };
  });

  function findGradeInRange(startAddr: number, endAddr: number): GradedComment | undefined {
    return gradedComments.find((c) => c.address >= startAddr && c.address <= endAddr);
  }

  const renderDigest = computeRenderDigest(sortedBlocks, sortedSymbols, sortedComments, sidecarBytes);

  // The two recorded locations are WORKSPACE-RELATIVE, and that is the
  // load-bearing detail rather than a formatting preference: every byte below
  // is re-rendered and compared BYTE FOR BYTE by `checkRenderedMemoryMap()`,
  // so an absolute path here would make the drift verdict a function of where
  // the checkout sits (CR-01). `workspaceRelativePath()` is the one definition
  // of that spelling; it computes a location and refuses one that escapes the
  // root. It is NOT a confinement check -- this module still performs no
  // confinement of its own, exactly as `RenderMemoryMapOptions` documents.
  const storeLocation = workspaceRelativePath(storePath, workspaceRoot);
  const sidecarLocation = workspaceRelativePath(provenancePath, workspaceRoot);

  const lines: string[] = [];

  lines.push("<!--");
  lines.push("  GENERATED by `vice-mcp anno render-memmap` -- do not hand-edit; re-run the generator.");
  lines.push(`  store: ${storeLocation}`);
  lines.push(`  sidecar: ${sidecarLocation}`);
  lines.push(`  render_digest: ${renderDigest}`);
  lines.push(
    "  The digest covers the sorted listRanges/listLabels/listComments results, the raw provenance",
  );
  lines.push(
    "  sidecar bytes, and this renderer's version constant. `render-memmap --check` reports drift when, and",
  );
  lines.push(
    "  only when, one of these changed: this file was hand-edited; a store row changed (a range, a label, a",
  );
  lines.push(
    "  comment, or a comment's confidence grade); the provenance sidecar's bytes changed; the store or the",
  );
  lines.push(
    "  sidecar moved to a different location RELATIVE TO THE WORKSPACE ROOT; or the renderer changed.",
  );
  lines.push(
    "  Relocating the checkout is NOT drift -- the same tree at a different absolute path renders these same",
  );
  lines.push(
    "  bytes, because the two locations above are workspace-relative. That matters because this file is meant",
  );
  lines.push("  to be committed and read on a machine that did not produce it.");
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
  for (const row of sortedBlocks) {
    const match = findGradeInRange(row.start, row.endInclusive);
    const range = `\`${hex4(row.start)}-${hex4(row.endInclusive)}\``;
    const grade = match?.grade ? match.grade.phrase.toUpperCase() : "";
    const evidence = match ? escapeMarkdownCell(match.evidence) : "";
    lines.push(`| ${range} | ${row.dataType} | ${grade} | ${evidence} |`);
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
  for (const sym of sortedSymbols) {
    if (blockClassAt(blockEntries, sym.address) !== "code") continue;
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
  /** See `RenderMemoryMapOptions.storePath`. */
  storePath: string;
  /** See `RenderMemoryMapOptions.provenancePath` -- same argument, one layer
   *  up. The CALLER (`anno-cli.ts`'s `cmdRenderMemmap()`) confines it through
   *  `storePathWithinWorkspace()`; this module performs no confinement of its
   *  own (CR-03). */
  provenancePath: string;
  /** The rendered file to compare against, read RAW by `readFileSync` below.
   *  The CALLER confines it through `storePathWithinWorkspace()` -- the SAME
   *  resolution that produces the write path on the non-`--check` branch, so
   *  the drift check and the write are one confined value rather than two
   *  rules. This module performs no confinement of its own (CR-02). */
  renderedPath: string;
  /** See `RenderMemoryMapOptions.workspaceRoot`. */
  workspaceRoot: string;
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
 *     differing line otherwise.
 *
 * WHAT REACHES `drifted`, enumerated from what the compared bytes are a
 * function of rather than from a remembered summary -- the fresh render is a
 * function of the store rows, the sidecar bytes, `RENDERER_VERSION` and the
 * two WORKSPACE-RELATIVE locations, and nothing else:
 *   - a hand edit to the rendered file;
 *   - a store-side change (a range, a label, a comment, or a comment's
 *     confidence grade);
 *   - a change to the provenance sidecar's bytes;
 *   - a move of the store or the sidecar to a different location RELATIVE TO
 *     the workspace root;
 *   - a renderer change (output shape, or a `RENDERER_VERSION` bump).
 *
 * AND THE NEGATIVE, which is the defect this list was corrected for (CR-01,
 * `29-VERIFICATION.md` gap 1): relocating the checkout -- the same tree at a
 * different absolute path -- does NOT drift. The banner records
 * workspace-relative locations, so no compared byte is a function of where the
 * checkout sits. Before that fix this returned `drifted` for a byte-identical
 * store, sidecar and rendered file while `renderMemoryMap()` printed the SAME
 * `render_digest` in both trees, so the gate contradicted its own artifact.
 * That matters here specifically because the rendered file is a committed
 * artifact and this repository runs its phases in worktrees, which makes a
 * differing checkout path the normal case rather than an edge.
 */
export async function checkRenderedMemoryMap(
  opts: CheckRenderedMemoryMapOptions,
): Promise<CheckRenderedMemoryMapResult> {
  const { storePath, provenancePath, renderedPath, workspaceRoot } = opts;

  if (!existsSync(renderedPath)) {
    return { status: "missing", path: renderedPath };
  }

  const onDisk = readFileSync(renderedPath, "utf8");
  const { markdown } = await renderMemoryMap({ storePath, provenancePath, workspaceRoot });

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
