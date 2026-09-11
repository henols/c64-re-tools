#!/usr/bin/env node
// anno-store-export.ts
//
// Phase 45, plan 45-02 (D-02): the general JSON export/import module for a
// per-fixture `.annostore` -- NOT Ghidra-shaped (that is `anno-import.ts`'s
// job, and it writes cross-references only). No general store-JSON round
// trip exists anywhere else in this tree today (RESEARCH.md Section 5,
// VERIFIED by a full census of `anno_*` tool names): this module is it.
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE for export, and an
// already-open handle for import -- it never opens or closes a store itself,
// never names `node:sqlite` directly for a connection, and never resolves a
// workspace path. Confinement is the CALLER's job, through the existing
// `storePathWithinWorkspace()` seam every other `anno-cli.ts` verb already
// uses -- never a second path validator here.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR:
//   - The JSON schema for a full store export: typed ranges, labels,
//     comments (tagged `provenance: "derived" | "authored"` per D-03),
//     project enums and their usage bindings, cross-references, and
//     runtime-execution-observation rows.
//   - The three decline/provenance comment-text conventions
//     (`DECLINE_COMMENT_PREFIX`, `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX`,
//     `AUTHORED_PROVENANCE_COMMENT_PREFIX`), all riding the ONE existing
//     `anno_set_comment` API -- never a second mechanism, never a schema
//     column.
//   - The import round trip: `importStoreDocument()` parses and validates
//     the WHOLE document into an in-memory write plan before the first
//     mutating call.
//
// WHAT NOT TO DO:
//   - Never write a row before the WHOLE document has parsed and validated
//     successfully (`anno-import.ts`'s own rule, copied deliberately: a
//     partial import must never leave the store in a state that is neither
//     the old nor the new content).
//   - Never collapse the derived/authored provenance tag (D-03) -- the
//     export schema exists specifically so a diff shows an authored
//     purpose-comment change, which a binary `.annostore` cannot.
//   - Never resolve a workspace path here -- the caller does, through
//     `storePathWithinWorkspace()`, the one seam.
//   - Never persist `provenance` as a real store column. It is NOT one:
//     `RangeRow`/`CommentRow` (`anno-types.ts`) carry no such field, and
//     `setDataType()`/`setComment()` accept no such argument. Ranges are
//     ALWAYS the derived half (D-03: "block types ... regenerate
//     deterministically from the bytes") -- there is no per-row fact in the
//     schema that could ever make one authored instead, so `"derived"` is a
//     constant for every exported range, not a per-row classification.
//     Comments are ALWAYS the authored half (D-03, confirmed again by
//     RESEARCH.md Section 5: "labels/comments/(and ... decline-comments) are
//     the authored half") -- `provenanceForComment()` is written as a
//     function of the comment's own text (rather than a bare constant) only
//     so a future comment-writing DERIVATION path has exactly one place to
//     add a rule; today it always answers `"authored"`, including for a
//     a decline comment. This is DELIBERATE and is guarded by this
//     module's own test suite (`anno-store-export.test.ts`'s Test 6): a
//     decline comment is machine-written by `runMemmapJoin()`'s bank-state
//     resolution, but the TEXT it produces is exactly as authored/frozen as
//     a hand-written purpose comment once persisted -- neither regenerates
//     byte-for-byte from a re-run in the way a typed range does, because a
//     decline's reason strings can change across `anno-join.ts` code
//     revisions even though the underlying bytes have not. Because
//     `provenance` is never a real column, the round trip reproduces it for
//     free: re-exporting a freshly imported document recomputes the same
//     answer from the same rules, with nothing to persist or drift.
//   - Never re-implement a validator this project already owns.
//     `assertDataType()`, `assertRangeShape()`, `parseStoreAddress()`,
//     `assertCommentType()`, `assertCommentText()`, `assertLabelKind()`,
//     `assertLegalLabel()`, `assertAccessKind()`, `assertEvidSourceBank()`,
//     `assertRunIdentityDigest()`, `assertRunIdentitySeed()` and
//     `assertEnumName()` (all `anno-types.ts`) are pure functions of their
//     arguments -- none touches SQL -- so every one of them is reused here,
//     during validation, before any store write happens. The one exception
//     is project-enum `variants`/`description` shape: `anno-store.ts`'s own
//     `validatedVariants()`/`validatedDescription()` are private to that
//     module, so this module's `assertExportVariants()` is a NEW, narrower
//     shape check (plain object, non-empty string values) that catches gross
//     malformation before any write; `createProjectEnum()` still applies its
//     own full validation at write time, and a document that passes this
//     module's own pre-check but fails that stricter one is a disclosed,
//     narrow residual gap -- see this module's test file for what IS
//     covered by the pre-write pass.

import { basename } from "node:path";

import {
  setDataType,
  setLabel,
  setComment,
  createProjectEnum,
  applyEnumUsage,
  putXref,
  insertExecObservations,
  listRanges,
  listLabels,
  listComments,
  listProjectEnums,
  listEnumUsage,
  listXrefs,
  listExecObservations,
} from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import {
  assertDataType,
  assertRangeShape,
  parseStoreAddress,
  assertCommentType,
  assertCommentText,
  assertLabelKind,
  assertLegalLabel,
  assertAccessKind,
  assertEvidSourceBank,
  assertRunIdentityDigest,
  assertRunIdentitySeed,
  assertEnumName,
} from "./anno-types.ts";
import type { DataType, CommentType, LabelKind, XrefAccessKind, EvidSourceBank } from "./anno-types.ts";

/** The one version number a document carries. Bumped only when this file's
 * own export shape changes in a way an older importer could not read
 * safely. An unrecognised version is REFUSED BY NAME (this project's
 * standing decline-by-name pattern), never best-effort imported. */
export const STORE_EXPORT_SCHEMA_VERSION = 1;

/** The two provenance classes D-03 splits the store into. See this file's
 * own header for why this is never a real store column. */
export type RowProvenance = "derived" | "authored";

/** Criterion 4's "what is unknown and why" convention: a bank-state or
 * disagreement resolution that could not be determined. Matches
 * `anno-join.ts`'s own decline reasons in spirit (RESEARCH.md Section 3). */
export const DECLINE_COMMENT_PREFIX = "DECLINED:";

/** Criterion 2's "reviewed and accepted" convention -- a DIFFERENT fact from
 * "could not be determined": a runtime disagreement a human/agent explicitly
 * reviewed and chose to accept rather than reclassify. */
export const DISAGREEMENT_ACCEPTED_COMMENT_PREFIX = "DISAGREEMENT-ACCEPTED:";

/** D-10's per-range authored marker: an explicit statement that a range's
 * typing rests on authored judgement rather than derivation or runtime
 * observation. */
export const AUTHORED_PROVENANCE_COMMENT_PREFIX = "PROVENANCE: authored";

/** True iff `text` is a recorded decline (criterion 4's own convention).
 * The ONE predicate the completeness report and the closure passes both
 * need, so neither re-derives a prefix match locally. Distinct from
 * `provenanceForComment()`: a decline comment is machine-written but still
 * classified `"authored"` -- see this file's own header. */
export function isDeclineComment(text: string): boolean {
  return text.startsWith(DECLINE_COMMENT_PREFIX);
}

/** The provenance of ONE comment, as a function of its own text. Always
 * `"authored"` today -- see this file's header for why, and
 * `anno-store-export.test.ts`'s Test 6 for the regression guard against the
 * opposite (and wrong) assumption that a decline comment is derived. */
export function provenanceForComment(text: string): RowProvenance {
  void text;
  return "authored";
}

/** One typed range as the export document holds it. `id` is deliberately
 * OMITTED -- a store-internal rowid, never portable across a re-derivation
 * or a fresh import target, and carrying it would make the round-trip test
 * compare numbers that were never meant to agree. `provenance` is always
 * `"derived"` here -- see this file's header. */
export interface StoreExportRangeRow {
  start: number;
  endInclusive: number;
  dataType: DataType;
  bank: number | null;
  provenance: RowProvenance;
}

/** One label as the export document holds it. `id` omitted -- see
 * `StoreExportRangeRow`'s own doc comment for why. */
export interface StoreExportLabelRow {
  address: number;
  name: string;
  kind: LabelKind;
  bank: number | null;
}

/** One comment as the export document holds it. `id` omitted. `provenance`
 * is computed per row via `provenanceForComment()`. */
export interface StoreExportCommentRow {
  address: number;
  commentType: CommentType;
  text: string;
  bank: number | null;
  provenance: RowProvenance;
}

/** One project-local enum as the export document holds it. `id` omitted. */
export interface StoreExportProjectEnumRow {
  name: string;
  variants: Readonly<Record<string, string>>;
  description: string | null;
}

/** One enum usage as the export document holds it. `enumId` is deliberately
 * REPLACED by `enumName` -- `enumId` is a store-internal foreign key with no
 * meaning across a fresh import target (the target's own `anno_enum` rows
 * get their own fresh ids), while `enumName` is exactly what
 * `applyEnumUsage()` already accepts as its own portable identifier
 * (`anno-store.ts`'s own doc comment: "The association is by `anno_enum.id`,
 * never by name" is the STORE's internal invariant, not this export's --
 * this export's OWN cross-row reference is by name, resolved back to an id
 * at import time exactly the way a caller already does). */
export interface StoreExportEnumUsageRow {
  address: number;
  enumName: string;
  bank: number | null;
}

/** One cross-reference as the export document holds it. `id` omitted. */
export interface StoreExportXrefRow {
  fromAddress: number;
  toAddress: number;
  accessKind: XrefAccessKind;
  bank: number | null;
}

/** One runtime-execution observation as the export document holds it. `id`
 * omitted. */
export interface StoreExportExecObservationRow {
  imageSha256: string;
  argvDigest: string;
  seed: string;
  address: number;
  sourceBank: EvidSourceBank;
}

/** The full document `exportStoreDocument()` returns and
 * `importStoreDocument()` accepts. Every array is present even when empty
 * (never omitted), and every array is sorted by its own stated stable key so
 * two exports of the same store are byte-identical (Test 2). `store` is the
 * BASENAME only -- an absolute host path in a committed artifact is a
 * portability defect (T-45-08). */
export interface StoreExportDocument {
  schemaVersion: number;
  store: string;
  ranges: StoreExportRangeRow[];
  labels: StoreExportLabelRow[];
  comments: StoreExportCommentRow[];
  projectEnums: StoreExportProjectEnumRow[];
  enumUsage: StoreExportEnumUsageRow[];
  xrefs: StoreExportXrefRow[];
  execObservations: StoreExportExecObservationRow[];
}

/** Per-row-class counts of what `importStoreDocument()` wrote. */
export interface ImportSummary {
  ranges: number;
  labels: number;
  comments: number;
  projectEnums: number;
  enumUsage: number;
  xrefs: number;
  execObservations: number;
}

/** This module's own refusal class for document-shape violations that are
 * not already covered by one of `anno-types.ts`'s own validators (an
 * unrecognised `schemaVersion`, a `provenance` value that is neither
 * `"derived"` nor `"authored"`, an enum usage naming an enum the document
 * itself never defines, or a malformed `projectEnums` entry). A bare `Error`
 * subclass, mirroring `AnnoImportError`'s own reasoning: this module's
 * VALIDATION phase never touches the store's persistence, so it has no
 * reason to join the `AnnoStoreError`/`ViceError` family for that phase. */
export class AnnoStoreExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnoStoreExportError";
  }
}

function isRowProvenance(value: unknown): value is RowProvenance {
  return value === "derived" || value === "authored";
}

function assertRowProvenance(value: unknown, what: string): RowProvenance {
  if (!isRowProvenance(value)) {
    throw new AnnoStoreExportError(`${what}: provenance must be "derived" or "authored"; got ${JSON.stringify(value)}`);
  }
  return value;
}

/** A narrow, NEW shape check for a project enum's `variants` mapping --
 * `anno-store.ts`'s own `validatedVariants()` is private to that module (see
 * this file's header). Catches gross malformation (not a plain object, or a
 * non-string/empty variant name) before any write; `createProjectEnum()`
 * still applies its own full validation (numeric-string key format) at
 * write time. */
function assertExportVariants(variants: unknown, what: string): Record<string, string> {
  if (typeof variants !== "object" || variants === null || Array.isArray(variants)) {
    throw new AnnoStoreExportError(`${what}: variants must be a plain object mapping value strings to variant names; got ${JSON.stringify(variants)}`);
  }
  for (const [key, value] of Object.entries(variants as Record<string, unknown>)) {
    if (typeof value !== "string" || value === "") {
      throw new AnnoStoreExportError(`${what}: variant ${JSON.stringify(key)} must map to a non-empty string name; got ${JSON.stringify(value)}`);
    }
  }
  return variants as Record<string, string>;
}

function assertExportDescription(description: unknown, what: string): string | null {
  if (description !== null && typeof description !== "string") {
    throw new AnnoStoreExportError(`${what}: description must be a string or null; got ${JSON.stringify(description)}`);
  }
  return description;
}

/**
 * Exports the WHOLE state of an already-open store as a versioned,
 * stably-sorted JSON document. Every array is sorted by its own key so two
 * exports of the same store are byte-identical (Test 2) -- never left to
 * `node:sqlite`'s own row order, which is insertion order and can drift
 * across a rewritten table.
 */
export function exportStoreDocument(handle: AnnoStoreHandle, opts: { storeName?: string } = {}): StoreExportDocument {
  const storeName = opts.storeName ?? basename(handle.path);

  const ranges: StoreExportRangeRow[] = [...listRanges(handle)]
    .sort((a, b) => a.start - b.start || a.endInclusive - b.endInclusive)
    .map((row) => ({
      start: row.start,
      endInclusive: row.endInclusive,
      dataType: row.dataType,
      bank: row.bank,
      provenance: "derived" as const,
    }));

  const labels: StoreExportLabelRow[] = [...listLabels(handle)]
    .sort((a, b) => a.address - b.address || a.name.localeCompare(b.name))
    .map((row) => ({ address: row.address, name: row.name, kind: row.kind, bank: row.bank }));

  const comments: StoreExportCommentRow[] = [...listComments(handle)]
    .sort((a, b) => a.address - b.address || a.commentType.localeCompare(b.commentType))
    .map((row) => ({
      address: row.address,
      commentType: row.commentType,
      text: row.text,
      bank: row.bank,
      provenance: provenanceForComment(row.text),
    }));

  const projectEnums: StoreExportProjectEnumRow[] = [...listProjectEnums(handle)]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({ name: row.name, variants: row.variants, description: row.description }));

  const enumUsage: StoreExportEnumUsageRow[] = [...listEnumUsage(handle)]
    .sort((a, b) => a.address - b.address || a.enumName.localeCompare(b.enumName))
    .map((row) => ({ address: row.address, enumName: row.enumName, bank: row.bank }));

  const xrefs: StoreExportXrefRow[] = [...listXrefs(handle)]
    .sort((a, b) => a.fromAddress - b.fromAddress || a.toAddress - b.toAddress || a.accessKind.localeCompare(b.accessKind))
    .map((row) => ({ fromAddress: row.fromAddress, toAddress: row.toAddress, accessKind: row.accessKind, bank: row.bank }));

  const execObservations: StoreExportExecObservationRow[] = [...listExecObservations(handle)]
    .sort(
      (a, b) =>
        a.address - b.address ||
        a.sourceBank.localeCompare(b.sourceBank) ||
        a.imageSha256.localeCompare(b.imageSha256) ||
        a.argvDigest.localeCompare(b.argvDigest) ||
        a.seed.localeCompare(b.seed),
    )
    .map((row) => ({
      imageSha256: row.imageSha256,
      argvDigest: row.argvDigest,
      seed: row.seed,
      address: row.address,
      sourceBank: row.sourceBank,
    }));

  return {
    schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
    store: storeName,
    ranges,
    labels,
    comments,
    projectEnums,
    enumUsage,
    xrefs,
    execObservations,
  };
}

/** One fully-validated write, ready to apply with no further checking. A
 * discriminated union so `importStoreDocument()`'s apply loop is a single
 * `switch`, never a re-inspection of the original document shape. */
type PlannedWrite =
  | { kind: "range"; start: number; endInclusive: number; dataType: DataType }
  | { kind: "label"; address: number; name: string; kind_: LabelKind }
  | { kind: "comment"; address: number; commentType: CommentType; text: string }
  | { kind: "projectEnum"; name: string; variants: Record<string, string>; description: string | null }
  | { kind: "enumUsage"; address: number; name: string }
  | { kind: "xref"; fromAddress: number; toAddress: number; accessKind: XrefAccessKind }
  | { kind: "execObservationGroup"; imageSha256: string; argvDigest: string; seed: string; observations: { address: number; sourceBank: EvidSourceBank }[] };

/**
 * Imports a `StoreExportDocument` into an already-open store handle.
 *
 * THE WHOLE DOCUMENT IS PARSED AND VALIDATED INTO AN IN-MEMORY WRITE PLAN
 * BEFORE THE FIRST MUTATING CALL (`anno-import.ts`'s own rule, copied
 * deliberately). A validation failure ANYWHERE in the document -- including
 * its very last row -- throws before any `set*`/`put*`/`insert*` function on
 * `handle` has been called, so the target store is left byte-identical to
 * how it started (Test 4).
 *
 * `provenance` is validated for SHAPE (must be `"derived"` or `"authored"`)
 * but is never itself written anywhere: it is not a real store column (see
 * this file's header), and re-exporting the freshly imported store
 * recomputes the same answer from the same rules.
 */
export function importStoreDocument(handle: AnnoStoreHandle, doc: StoreExportDocument): ImportSummary {
  if (doc.schemaVersion !== STORE_EXPORT_SCHEMA_VERSION) {
    throw new AnnoStoreExportError(
      `anno-store-export refused: document schemaVersion ${JSON.stringify(doc.schemaVersion)} is not the version this build reads ` +
        `(expected ${STORE_EXPORT_SCHEMA_VERSION}) -- an unrecognised version is refused by name, never best-effort imported.`,
    );
  }

  const plan: PlannedWrite[] = [];

  for (const [i, row] of doc.ranges.entries()) {
    const dataType = assertDataType(row.dataType);
    assertRangeShape(row.start, row.endInclusive, dataType);
    assertRowProvenance(row.provenance, `ranges[${i}]`);
    plan.push({ kind: "range", start: row.start, endInclusive: row.endInclusive, dataType });
  }

  for (const [i, row] of doc.labels.entries()) {
    const address = parseStoreAddress(row.address, { what: `labels[${i}].address` });
    const name = assertLegalLabel(row.name);
    const kind = assertLabelKind(row.kind);
    plan.push({ kind: "label", address, name, kind_: kind });
  }

  for (const [i, row] of doc.comments.entries()) {
    const address = parseStoreAddress(row.address, { what: `comments[${i}].address` });
    const commentType = assertCommentType(row.commentType);
    const text = assertCommentText(row.text, { what: `comments[${i}].text` });
    assertRowProvenance(row.provenance, `comments[${i}]`);
    plan.push({ kind: "comment", address, commentType, text });
  }

  const definedEnumNames = new Set<string>();
  for (const [i, row] of doc.projectEnums.entries()) {
    const name = assertEnumName(row.name);
    const variants = assertExportVariants(row.variants, `projectEnums[${i}]`);
    const description = assertExportDescription(row.description, `projectEnums[${i}]`);
    definedEnumNames.add(name);
    plan.push({ kind: "projectEnum", name, variants, description });
  }

  for (const [i, row] of doc.enumUsage.entries()) {
    const address = parseStoreAddress(row.address, { what: `enumUsage[${i}].address` });
    const name = assertEnumName(row.enumName);
    if (!definedEnumNames.has(name)) {
      throw new AnnoStoreExportError(
        `anno-store-export refused: enumUsage[${i}] names project enum ${JSON.stringify(name)}, which this document's own projectEnums array does not define -- an enum usage naming an undefined enum is refused, never imported against a guess.`,
      );
    }
    plan.push({ kind: "enumUsage", address, name });
  }

  for (const [i, row] of doc.xrefs.entries()) {
    const fromAddress = parseStoreAddress(row.fromAddress, { what: `xrefs[${i}].fromAddress` });
    const toAddress = parseStoreAddress(row.toAddress, { what: `xrefs[${i}].toAddress` });
    const accessKind = assertAccessKind(row.accessKind);
    plan.push({ kind: "xref", fromAddress, toAddress, accessKind });
  }

  const execGroups = new Map<string, { imageSha256: string; argvDigest: string; seed: string; observations: { address: number; sourceBank: EvidSourceBank }[] }>();
  for (const [i, row] of doc.execObservations.entries()) {
    const imageSha256 = assertRunIdentityDigest(row.imageSha256, `execObservations[${i}].imageSha256`);
    const argvDigest = assertRunIdentityDigest(row.argvDigest, `execObservations[${i}].argvDigest`);
    const seed = assertRunIdentitySeed(row.seed);
    const address = parseStoreAddress(row.address, { what: `execObservations[${i}].address` });
    const sourceBank = assertEvidSourceBank(row.sourceBank);
    const key = `${imageSha256} ${argvDigest} ${seed}`;
    let group = execGroups.get(key);
    if (group === undefined) {
      group = { imageSha256, argvDigest, seed, observations: [] };
      execGroups.set(key, group);
    }
    group.observations.push({ address, sourceBank });
  }
  for (const group of execGroups.values()) {
    plan.push({ kind: "execObservationGroup", ...group });
  }

  // VALIDATION IS COMPLETE. Nothing above this line calls a `set*`/`put*`/
  // `insert*` function on `handle` -- everything from here on is applying
  // the already-validated plan.
  const summary: ImportSummary = { ranges: 0, labels: 0, comments: 0, projectEnums: 0, enumUsage: 0, xrefs: 0, execObservations: 0 };

  for (const write of plan) {
    switch (write.kind) {
      case "range":
        setDataType(handle, { start: write.start, endInclusive: write.endInclusive, dataType: write.dataType });
        summary.ranges++;
        break;
      case "label":
        setLabel(handle, { address: write.address, name: write.name, kind: write.kind_ });
        summary.labels++;
        break;
      case "comment":
        setComment(handle, { address: write.address, commentType: write.commentType, text: write.text });
        summary.comments++;
        break;
      case "projectEnum":
        createProjectEnum(handle, { name: write.name, variants: write.variants, description: write.description ?? undefined });
        summary.projectEnums++;
        break;
      case "enumUsage":
        applyEnumUsage(handle, { address: write.address, name: write.name });
        summary.enumUsage++;
        break;
      case "xref":
        putXref(handle, { fromAddress: write.fromAddress, toAddress: write.toAddress, accessKind: write.accessKind });
        summary.xrefs++;
        break;
      case "execObservationGroup":
        insertExecObservations(handle, {
          imageSha256: write.imageSha256,
          argvDigest: write.argvDigest,
          seed: write.seed,
          observations: write.observations,
        });
        summary.execObservations += write.observations.length;
        break;
    }
  }

  return summary;
}
