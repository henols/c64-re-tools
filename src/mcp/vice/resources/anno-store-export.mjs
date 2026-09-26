#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-store-export.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-store-export.mts
//
// The general JSON export/import module for a
// per-fixture `.annostore` -- NOT Ghidra-shaped (that is `anno-import.mts`'s
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
//     comments (tagged `provenance: "derived" | "authored"`),
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
//     successfully (`anno-import.mts`'s own rule, copied deliberately: a
//     partial import must never leave the store in a state that is neither
//     the old nor the new content).
//   - Never collapse the derived/authored provenance tag -- the
//     export schema exists specifically so a diff shows an authored
//     purpose-comment change, which a binary `.annostore` cannot.
//   - Never resolve a workspace path here -- the caller does, through
//     `storePathWithinWorkspace()`, the one seam.
//   - Never persist `provenance` as a real store column. It is NOT one:
//     `RangeRow`/`CommentRow` (`anno-types.mts`) carry no such field, and
//     `setDataType()`/`setComment()` accept no such argument. Ranges are
//     ALWAYS the derived half ("block types ... regenerate
//     deterministically from the bytes") -- there is no per-row fact in the
//     schema that could ever make one authored instead, so `"derived"` is a
//     constant for every exported range, not a per-row classification.
//     Comments are ALWAYS the authored half (confirmed again by
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
//     decline's reason strings can change across `anno-join.mts` code
//     revisions even though the underlying bytes have not. Because
//     `provenance` is never a real column, the round trip reproduces it for
//     free: re-exporting a freshly imported document recomputes the same
//     answer from the same rules, with nothing to persist or drift.
//   - Never re-implement a validator this project already owns.
//     `assertDataType()`, `assertRangeShape()`, `parseStoreAddress()`,
//     `assertCommentType()`, `assertCommentText()`, `assertLabelKind()`,
//     `assertLegalLabel()`, `assertAccessKind()`, `assertEvidSourceBank()`,
//     `assertRunIdentityDigest()`, `assertRunIdentitySeed()` and
//     `assertEnumName()` (all `anno-types.mts`) are pure functions of their
//     arguments -- none touches SQL -- so every one of them is reused here,
//     during validation, before any store write happens. The one exception
//     is project-enum `variants`/`description` shape: `anno-store.mts`'s own
//     `validatedVariants()`/`validatedDescription()` are private to that
//     module, so this module's `assertExportVariants()` is a NEW, narrower
//     shape check (plain object, non-empty string values) that catches gross
//     malformation before any write; `createProjectEnum()` still applies its
//     own full validation at write time, and a document that passes this
//     module's own pre-check but fails that stricter one is a disclosed,
//     narrow residual gap -- see this module's test file for what IS
//     covered by the pre-write pass.
import { setDataType, setLabel, setComment, createProjectEnum, applyEnumUsage, putXref, insertExecObservations, addScope, addExcludedRange, listRanges, listLabels, listComments, listProjectEnums, listEnumUsage, listXrefs, listExcludedRanges, listExecObservations, listScopes, } from "./anno-store.mjs";
import { assertDataType, assertRangeShape, parseStoreAddress, assertCommentType, assertCommentText, assertLabelKind, assertLegalLabel, assertAccessKind, assertEvidSourceBank, assertRunIdentityDigest, assertRunIdentitySeed, assertEnumName, } from "./anno-types.mjs";
/** The one version number a document carries. Bumped only when this file's
 * own export shape changes in a way an older importer could not read
 * safely. An unrecognised version is REFUSED BY NAME (this project's
 * standing decline-by-name pattern), never best-effort imported.
 *
 * Version 2 carries `excludedRanges` and drops the `store` filename: a
 * project in the shared database has no file of its own to name, and a
 * document that omitted exclusions was not a complete copy of a project. */
export const STORE_EXPORT_SCHEMA_VERSION = 2;
/** Criterion 4's "what is unknown and why" convention: a bank-state or
 * disagreement resolution that could not be determined. Matches
 * `anno-join.mts`'s own decline reasons in spirit (RESEARCH.md Section 3). */
export const DECLINE_COMMENT_PREFIX = "DECLINED:";
/** Criterion 2's "reviewed and accepted" convention -- a DIFFERENT fact from
 * "could not be determined": a runtime disagreement a human/agent explicitly
 * reviewed and chose to accept rather than reclassify. */
export const DISAGREEMENT_ACCEPTED_COMMENT_PREFIX = "DISAGREEMENT-ACCEPTED:";
/** The per-range authored marker: an explicit statement that a range's
 * typing rests on authored judgement rather than derivation or runtime
 * observation. */
export const AUTHORED_PROVENANCE_COMMENT_PREFIX = "PROVENANCE: authored";
/** True iff `text` is a recorded decline (criterion 4's own convention).
 * The ONE predicate the completeness report and the closure passes both
 * need, so neither re-derives a prefix match locally. Distinct from
 * `provenanceForComment()`: a decline comment is machine-written but still
 * classified `"authored"` -- see this file's own header. */
export function isDeclineComment(text) {
    return text.startsWith(DECLINE_COMMENT_PREFIX);
}
/** The provenance of ONE comment, as a function of its own text. Always
 * `"authored"` today -- see this file's header for why, and
 * `anno-store-export.test.ts`'s Test 6 for the regression guard against the
 * opposite (and wrong) assumption that a decline comment is derived. */
export function provenanceForComment(text) {
    void text;
    return "authored";
}
/** This module's own refusal class for document-shape violations that are
 * not already covered by one of `anno-types.mts`'s own validators (an
 * unrecognised `schemaVersion`, a `provenance` value that is neither
 * `"derived"` nor `"authored"`, an enum usage naming an enum the document
 * itself never defines, or a malformed `projectEnums` entry). A bare `Error`
 * subclass, mirroring `AnnoImportError`'s own reasoning: this module's
 * VALIDATION phase never touches the store's persistence, so it has no
 * reason to join the `AnnoStoreError`/`ViceError` family for that phase. */
export class AnnoStoreExportError extends Error {
    constructor(message) {
        super(message);
        this.name = "AnnoStoreExportError";
    }
}
function isRowProvenance(value) {
    return value === "derived" || value === "authored";
}
function assertRowProvenance(value, what) {
    if (!isRowProvenance(value)) {
        throw new AnnoStoreExportError(`${what}: provenance must be "derived" or "authored"; got ${JSON.stringify(value)}`);
    }
    return value;
}
/**
 * This fix: `bank` is exported faithfully by `exportStoreDocument()`
 * for every row kind (`StoreExportRangeRow.bank`, `StoreExportLabelRow.bank`,
 * `StoreExportCommentRow.bank`, `StoreExportEnumUsageRow.bank`,
 * `StoreExportXrefRow.bank`), but no write call on `anno-store.mts`'s current
 * surface (`setDataType`, `setLabel`, `setComment`, `applyEnumUsage`, `putXref`)
 * accepts a `bank` argument -- every fresh insert hard-codes `bank: null`
 * (`anno-store.mts:1890`). Threading a real value through five write calls with
 * no bank-carrying writer anywhere in the codebase to prove it against would be
 * exactly the kind of speculative widening this project's other modules refuse.
 * Refusing a non-null
 * `bank` BY NAME instead -- this project's standing "refuse by name, never
 * silently drop" convention (`enumUsage[i]` naming an undefined enum, above, is
 * the same shape) -- means the moment a real writer starts producing a
 * non-null `bank`, importing that document fails LOUDLY, naming the row and
 * the value, rather than silently losing it while `importStoreDocument()`
 * reports success. Every one of this phase's own nine committed fixtures
 * carries `bank: null` throughout (confirmed by `anno-store-export.test.ts`
 * and this module's own round-trip proof), so this refusal is unreachable on
 * every fixture that exists today -- it exists for the writer that does not
 * exist yet.
 */
function assertExportBankIsNull(bank, what) {
    if (bank !== null) {
        throw new AnnoStoreExportError(`${what}: bank must be null -- no write call on anno-store.mts's current surface accepts a bank argument (every fresh insert ` +
            `hard-codes bank: null), so a non-null bank in an imported document would be silently discarded rather than round-tripped. ` +
            `Refusing by name (got ${JSON.stringify(bank)}) rather than importing it and reporting success.`);
    }
    return bank;
}
/** A narrow, NEW shape check for a project enum's `variants` mapping --
 * `anno-store.mts`'s own `validatedVariants()` is private to that module (see
 * this file's header). Catches gross malformation (not a plain object, or a
 * non-string/empty variant name) before any write; `createProjectEnum()`
 * still applies its own full validation (numeric-string key format) at
 * write time. */
function assertExportVariants(variants, what) {
    if (typeof variants !== "object" || variants === null || Array.isArray(variants)) {
        throw new AnnoStoreExportError(`${what}: variants must be a plain object mapping value strings to variant names; got ${JSON.stringify(variants)}`);
    }
    for (const [key, value] of Object.entries(variants)) {
        if (typeof value !== "string" || value === "") {
            throw new AnnoStoreExportError(`${what}: variant ${JSON.stringify(key)} must map to a non-empty string name; got ${JSON.stringify(value)}`);
        }
    }
    return variants;
}
function assertExportDescription(description, what) {
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
export function exportStoreDocument(handle) {
    const ranges = [...listRanges(handle)]
        .sort((a, b) => a.start - b.start || a.endInclusive - b.endInclusive)
        .map((row) => ({
        start: row.start,
        endInclusive: row.endInclusive,
        dataType: row.dataType,
        bank: row.bank,
        provenance: "derived",
    }));
    const labels = [...listLabels(handle)]
        .sort((a, b) => a.address - b.address || a.name.localeCompare(b.name))
        .map((row) => ({ address: row.address, name: row.name, kind: row.kind, bank: row.bank }));
    const comments = [...listComments(handle)]
        .sort((a, b) => a.address - b.address || a.commentType.localeCompare(b.commentType))
        .map((row) => ({
        address: row.address,
        commentType: row.commentType,
        text: row.text,
        bank: row.bank,
        provenance: provenanceForComment(row.text),
    }));
    const projectEnums = [...listProjectEnums(handle)]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({ name: row.name, variants: row.variants, description: row.description }));
    const enumUsage = [...listEnumUsage(handle)]
        .sort((a, b) => a.address - b.address || a.enumName.localeCompare(b.enumName))
        .map((row) => ({ address: row.address, enumName: row.enumName, bank: row.bank }));
    const xrefs = [...listXrefs(handle)]
        .sort((a, b) => a.fromAddress - b.fromAddress || a.toAddress - b.toAddress || a.accessKind.localeCompare(b.accessKind))
        .map((row) => ({ fromAddress: row.fromAddress, toAddress: row.toAddress, accessKind: row.accessKind, bank: row.bank }));
    const execObservations = [...listExecObservations(handle)]
        .sort((a, b) => a.address - b.address ||
        a.sourceBank.localeCompare(b.sourceBank) ||
        a.imageSha256.localeCompare(b.imageSha256) ||
        a.argvDigest.localeCompare(b.argvDigest) ||
        a.seed.localeCompare(b.seed))
        .map((row) => ({
        imageSha256: row.imageSha256,
        argvDigest: row.argvDigest,
        seed: row.seed,
        address: row.address,
        sourceBank: row.sourceBank,
    }));
    const scopes = [...listScopes(handle)]
        .sort((a, b) => a.start - b.start)
        .map((row) => ({ start: row.start, endInclusive: row.endInclusive }));
    const excludedRanges = [...listExcludedRanges(handle)]
        .sort((a, b) => a.start - b.start)
        .map((row) => ({ start: row.start, endInclusive: row.endInclusive, reason: row.reason }));
    return {
        schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
        ranges,
        labels,
        comments,
        projectEnums,
        enumUsage,
        xrefs,
        execObservations,
        scopes,
        excludedRanges,
    };
}
/**
 * Imports a `StoreExportDocument` into an already-open store handle.
 *
 * THE WHOLE DOCUMENT IS PARSED AND VALIDATED INTO AN IN-MEMORY WRITE PLAN
 * BEFORE THE FIRST MUTATING CALL (`anno-import.mts`'s own rule, copied
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
export function importStoreDocument(handle, doc) {
    if (doc.schemaVersion !== STORE_EXPORT_SCHEMA_VERSION) {
        throw new AnnoStoreExportError(`anno-store-export refused: document schemaVersion ${JSON.stringify(doc.schemaVersion)} is not the version this build reads ` +
            `(expected ${STORE_EXPORT_SCHEMA_VERSION}) -- an unrecognised version is refused by name, never best-effort imported.`);
    }
    const plan = [];
    for (const [i, row] of doc.ranges.entries()) {
        const dataType = assertDataType(row.dataType);
        assertRangeShape(row.start, row.endInclusive, dataType);
        assertRowProvenance(row.provenance, `ranges[${i}]`);
        assertExportBankIsNull(row.bank, `ranges[${i}]`);
        plan.push({ kind: "range", start: row.start, endInclusive: row.endInclusive, dataType });
    }
    for (const [i, row] of doc.labels.entries()) {
        const address = parseStoreAddress(row.address, { what: `labels[${i}].address` });
        const name = assertLegalLabel(row.name);
        const kind = assertLabelKind(row.kind);
        assertExportBankIsNull(row.bank, `labels[${i}]`);
        plan.push({ kind: "label", address, name, kind_: kind });
    }
    for (const [i, row] of doc.comments.entries()) {
        const address = parseStoreAddress(row.address, { what: `comments[${i}].address` });
        const commentType = assertCommentType(row.commentType);
        const text = assertCommentText(row.text, { what: `comments[${i}].text` });
        assertRowProvenance(row.provenance, `comments[${i}]`);
        assertExportBankIsNull(row.bank, `comments[${i}]`);
        plan.push({ kind: "comment", address, commentType, text });
    }
    const definedEnumNames = new Set();
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
            throw new AnnoStoreExportError(`anno-store-export refused: enumUsage[${i}] names project enum ${JSON.stringify(name)}, which this document's own projectEnums array does not define -- an enum usage naming an undefined enum is refused, never imported against a guess.`);
        }
        assertExportBankIsNull(row.bank, `enumUsage[${i}]`);
        plan.push({ kind: "enumUsage", address, name });
    }
    for (const [i, row] of doc.xrefs.entries()) {
        const fromAddress = parseStoreAddress(row.fromAddress, { what: `xrefs[${i}].fromAddress` });
        const toAddress = parseStoreAddress(row.toAddress, { what: `xrefs[${i}].toAddress` });
        const accessKind = assertAccessKind(row.accessKind);
        assertExportBankIsNull(row.bank, `xrefs[${i}]`);
        plan.push({ kind: "xref", fromAddress, toAddress, accessKind });
    }
    const execGroups = new Map();
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
    const sortedScopes = [...doc.scopes].map((row, i) => ({ row, i })).sort((a, b) => a.row.start - b.row.start);
    // EXISTING-STORE OVERLAP IS ALSO REFUSED HERE, before any write -- not just
    // overlap among the document's own scopes (checked below). `addScope()`
    // itself refuses a scope that overlaps a scope ALREADY IN THE TARGET STORE,
    // via a live query inside its own transaction, and that refusal used to
    // fire only after ranges/labels/comments/enums/xrefs/exec-observations from
    // this same plan had already been committed -- contradicting the
    // "VALIDATION IS COMPLETE" claim below and the document-internal refusal's
    // own "whole import is refused rather than partially applied" guarantee.
    // Mirroring `addScope()`'s predicate (and its identical-scope idempotence:
    // a byte-identical repeat is an accepted no-op, never an overlap) up here
    // closes that gap without touching `anno-store.mts`'s transaction model.
    const existingScopes = listScopes(handle);
    for (let s = 0; s < sortedScopes.length; s++) {
        const { row, i } = sortedScopes[s];
        assertRangeShape(row.start, row.endInclusive, "byte");
        const conflict = existingScopes.find((existing) => !(existing.start === row.start && existing.endInclusive === row.endInclusive) &&
            existing.start <= row.endInclusive &&
            existing.endInclusive >= row.start);
        if (conflict) {
            throw new AnnoStoreExportError(`anno-store-export refused: scopes[${i}] (${row.start}..${row.endInclusive}) overlaps a scope already present in the target ` +
                `store (id=${conflict.id} ${conflict.start}..${conflict.endInclusive}) -- nested and overlapping scopes are unsupported by ` +
                `the schema this store mirrors, so the whole import is refused rather than partially applied.`);
        }
        // OVERLAP IS REFUSED using `addScope()`'s own predicate, checked here
        // against the DOCUMENT's own scopes before any write -- a document whose
        // own scopes overlap must never partially apply.
        const prev = s > 0 ? sortedScopes[s - 1].row : undefined;
        if (prev && prev.endInclusive >= row.start) {
            throw new AnnoStoreExportError(`anno-store-export refused: scopes[${i}] (${row.start}..${row.endInclusive}) overlaps another scope in this same document -- ` +
                `nested and overlapping scopes are unsupported by the schema this store mirrors, so the whole import is refused rather than ` +
                `partially applied.`);
        }
        plan.push({ kind: "scope", start: row.start, endInclusive: row.endInclusive });
    }
    // EXCLUSIONS, validated the way `addExcludedRange()` would refuse them, and
    // BEFORE any write: a non-empty reason, no overlap with an exclusion already
    // in the target project unless it is the identical record, and no overlap
    // within the document.
    const existingExclusions = listExcludedRanges(handle);
    const sortedExclusions = [...doc.excludedRanges].map((row, i) => ({ row, i })).sort((a, b) => a.row.start - b.row.start);
    for (let x = 0; x < sortedExclusions.length; x++) {
        const { row, i } = sortedExclusions[x];
        assertRangeShape(row.start, row.endInclusive, "byte");
        const reason = assertCommentText(row.reason, { what: `excludedRanges[${i}].reason` });
        if (reason.trim() === "") {
            throw new AnnoStoreExportError(`anno-store-export refused: excludedRanges[${i}] has an empty reason -- an exclusion records why, or it is not imported.`);
        }
        const conflict = existingExclusions.find((existing) => !(existing.start === row.start && existing.endInclusive === row.endInclusive && existing.reason === reason) &&
            existing.start <= row.endInclusive &&
            existing.endInclusive >= row.start);
        if (conflict) {
            throw new AnnoStoreExportError(`anno-store-export refused: excludedRanges[${i}] (${row.start}..${row.endInclusive}) overlaps an exclusion already present in the ` +
                `target project (id=${conflict.id} ${conflict.start}..${conflict.endInclusive}), so the whole import is refused rather than partially applied.`);
        }
        const prev = x > 0 ? sortedExclusions[x - 1].row : undefined;
        if (prev && prev.endInclusive >= row.start) {
            throw new AnnoStoreExportError(`anno-store-export refused: excludedRanges[${i}] (${row.start}..${row.endInclusive}) overlaps another exclusion in this same document, ` +
                `so the whole import is refused rather than partially applied.`);
        }
        plan.push({ kind: "excludedRange", start: row.start, endInclusive: row.endInclusive, reason });
    }
    // VALIDATION IS COMPLETE. Nothing above this line calls a `set*`/`put*`/
    // `insert*` function on `handle` -- everything from here on is applying
    // the already-validated plan.
    const summary = {
        ranges: 0,
        labels: 0,
        comments: 0,
        projectEnums: 0,
        enumUsage: 0,
        xrefs: 0,
        execObservations: 0,
        scopes: 0,
        excludedRanges: 0,
    };
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
            case "scope":
                addScope(handle, { start: write.start, endInclusive: write.endInclusive });
                summary.scopes++;
                break;
            case "excludedRange":
                addExcludedRange(handle, { start: write.start, endInclusive: write.endInclusive, reason: write.reason });
                summary.excludedRanges++;
                break;
        }
    }
    return summary;
}
