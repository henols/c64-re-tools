#!/usr/bin/env node
// anno-tools.mts
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: dispatching the curated
// `anno_*` tool surface against a store handle -- the engine entry
// (`runAnnoToolOnHandle()`) that answers exactly one call against a handle its
// caller opened. The definitions, the allow-list and every argument validator
// live in `anno-tool-defs.mts`, which a client loads without the store; this
// module re-exports them. The client half -- confining paths, staging the
// files, opening the workspace's annotations.db -- is `anno-call-client.ts`
// with `anno-workspace-store.ts`.
//
// WHY THIS FILE EXISTS, in the words of the decisions that shaped it:
//
//   ONE PREFIX. `anno_` names the tools, `anno-` names the modules.
//   There is no second annotation family advertised alongside this one: the
//   registration loop in `vice-proxy.ts` was SUBSTITUTED, not appended to, so
//   an agent never has to choose between two surfaces over the same subject.
//
//   ONE HANDLE PER CALL. This module holds NO module-level store handle and
//   no ambient "current store": its caller opens a handle bound to one
//   project, this module answers one call against it, and the caller closes
//   it. There is no session to crash and nothing for a second concurrent
//   caller to corrupt.
//
//   NO PATH REACHES THIS MODULE. It runs where the store lives, which is not
//   where the caller's files live. A file argument (`image`, `export_path`)
//   arrives as a staged reference -- `{ $file: "<slot>" }` -- naming bytes the
//   client read and sent beside the call; a plain string in its place is
//   refused, never opened.
//
//   EVERY DERIVED READ NAMES ITS OWN IMAGE. The store holds
//   annotations, never program bytes. Every verb that derives an answer FROM
//   the bytes -- the disassembly, the region read, the binary info, the
//   cross-references, the search, the address details -- takes an explicit
//   `image` path. An optional-argument-with-fallback hybrid was rejected
//   outright: an omitted argument would read as a plausible-looking success
//   against whatever image happened to be recorded last.
//
//   THERE IS NO CURSOR, ANYWHERE. Upstream's own procedure text says
//   never to rely on a current cursor address, and this project has no editor
//   to have one. The verb that would have exposed it is folded into
//   `anno_disassemble`'s explicit address argument. Nothing on this surface --
//   no identifier, no schema property, no dispatch branch -- names a cursor or
//   a current address, and `anno-tools.test.ts` asserts that over this file's
//   comment-and-string-stripped source so this paragraph cannot satisfy the
//   check by containing the word.
//
// TWO REFUSAL CHANNELS, AND THE DIFFERENCE IS DELIBERATE:
//
//   1. AN INVALID ARGUMENT resolves `{isError:true}` naming the
//      `AnnoStoreError` subclass that fired. The caller passed something this
//      surface cannot act on, and it should not send it again unchanged.
//   2. A WELL-FORMED REQUEST THIS SURFACE CANNOT ANSWER resolves
//      `{isError:false}` carrying `{available:false, reason}` in the body.
//      That is not a caller error -- the question was legal, the answer is
//      "no". Returning `isError:true` for it teaches an agent to retry
//      something that will never succeed; returning `[]` or `0` for it is the
//      plausible-looking zero this refusal channel exists to prevent. Every reason names what
//      was asked for, why it cannot be answered, and where the nearest
//      answerable thing lives, in the shape `stock-cia.ts:116-124` established
//      and at the >= 40-character length `anno-tools.test.ts` asserts.
//
// `anno_batch_execute` IS THE ONE SANCTIONED NESTED-ARGUMENT VERB ON THIS
// SURFACE, AND NO SECOND MAY JOIN IT. A meta-tool that takes an arbitrary tool
// name inside its own arguments is precisely the confused-deputy shape a
// generic meta-tool surface this project closed once had, with an
// outer-name-only refusal array: the outer name passes the gate while the
// inner name never sees it. This one verb earns the exception by being the only
// route to the multi-edit pass an annotation run actually performs, and it
// pays for it with `assertAnnoBatch()` below -- a recursive, DEPTH-CAPPED
// pre-validator that refuses the WHOLE batch, before any store is opened, if
// anything at any depth is wrong. Adding a second such verb would reopen the
// hole this one closes.
//
// WHAT NOT TO DO:
//   - Never hand-type a second list of curated names. `CURATED_ANNO_TOOLS` is
//     derived from `ANNO_TOOL_DEFINITIONS`'s own `name` values precisely so a
//     name cannot be curated in one place and absent from the other (T-29-02).
//   - Never widen `CURATED_ANNO_TOOLS` without adding the definition here with
//     a named criterion. The gate's FIRST statement is set membership; a name
//     that is not in the set is refused before any argument is looked at.
//   - Never re-implement an argument rule the store already owns. Addresses go
//     through `parseStoreAddress`, ranges through `assertRangeShape`, data
//     types through `assertDataType`, label names through `assertLegalLabel`,
//     comment text through `assertCommentText`, enum names through
//     `assertEnumName`. A second, divergent rule here would accept a value the
//     store then refuses, or the reverse, and the disagreement would be
//     invisible because both look authoritative.
//   - Never sanitize. An illegal label, enum name or comment is REJECTED by
//     name, never quoted, trimmed, coerced or normalized into a legal one:
//     the store's printed name must never diverge from the symbol an export
//     would emit (T-29-23).
//   - Never add a second comment-length check or a truncation. The byte bound
//     is `assertCommentText()`'s and it is measured in UTF-8 BYTES, not code
//     units; this layer adds nothing on top of it.
//   - Never map `changed: false` to an error. A repeated identical edit
//     SUCCEEDING while reporting no change is the store's own idempotency, and
//     an agent re-running an annotation pass must not have to diff first.
//   - Never drop `contradictedComments` or `reinterpretedSplitTables` from
//     `anno_set_data_type`'s body. 28-VERIFICATION.md hands this phase the
//     obligation in writing: the disclosure must be SURFACED where the human
//     sees it, or the human never sees it. A success that quietly drops it is
//     exactly the plausible-looking clean answer this surface forbids.
//   - Never move `assertAnnoTool()` out of `runAnnoTool()`'s `try`. That
//     asymmetry is WR-02, recorded as out of scope at `anno-tools.mts:772-774`
//     and CLOSED here: inside the `try`, a refusal RESOLVES `{isError:true}`
//     like every other failure instead of REJECTING the returned promise, so
//     the caller has one shape to handle rather than two.
//   - Never read, stat or delete a file here. A file argument is a staged
//     reference; the client confines the path and reads the bytes.
//   - Never open or close a store here, and never echo a store path: the
//     caller owns the handle, and its path is not the caller's to know.
//   - Never collapse a failure into a bare string. The runner's catch names
//     the error CLASS, so a caller can tell an `AnnoStoreCorruptError` from an
//     `AnnoStorePathError` from the text alone (T-29-04, D18-12).
//
// D-16's SECOND renderer (plan 45-05): `anno-export-asm.mts` carries the
// proof (a real-ACME byte-diff oracle), this file carries the readability --
// both call decomposeRegisterValue(), the ONE owning decoder, and NEITHER
// decodes a bit itself. `REGISTER_ENUM_NAME_RE` below is deliberately a
// SEPARATE, small predicate from `anno-export-asm.mts`'s own copy: D-16 names
// two renderers, each owning its own substitution glue, and only the decoder
// itself is shared. `hasRegBitsEntry()` is likewise shared (45-REVIEW CR-01,
// fixed 2026-09-11): both renderers gate the decoder attempt on TABLE
// MEMBERSHIP, not name shape alone, via this one exported predicate -- a
// second, locally-derived membership test would be exactly the kind of
// "two answers to one question" this file's own header elsewhere refuses.
// The pure, read-only movement-hazard report. Declares its own
// input shapes and never reads a store, a file or a tool on its own behalf --
// the SAME caller-fetches-everything split `anno-coverage.mts`'s own header
// states for the coverage instrument, and exactly why the store re-point
// below is a CALLER-side change and nothing more.
import { extname } from "node:path";
import { addExcludedRange, addScope, applyEnumUsage, applyWrite, clearEnumUsage, createProjectEnum, currentRevision, deleteExecObservationsForRun, insertExecObservations, listComments, listEnumUsage, listExcludedRanges, listExecObservations, listLabels, listObservedRuns, listProjectEnums, listRanges, listScopes, listXrefs, removeExcludedRange, removeScope, setComment, setDataType, setLabel, updateProjectEnum, type AnnoStoreHandle } from "./anno-store.mts";
import { AnnoStoreError, assertCommentType, assertDataType, parseStoreAddress, parseVariantKey, type CommentRow, type EnumUsageRow, type LabelRow, type ProjectEnumRow } from "./anno-types.mts";
import { crossReferencesTo, searchAnnotations } from "./anno-derive.mts";
import { composeAddressDetails } from "./anno-details.mts";
import { decode, type Instruction } from "./disasm-decoder.mts";
import { render } from "./disasm-renderer.mts";
import { decomposeRegisterValue, hasRegBitsEntry, type RegisterDecomposition } from "./anno-enum-gen.mts";
import { importGhidraExport } from "./anno-import.mts";
import { runMemmapJoin } from "./anno-join.mts";
import { accessMapRanges, parseAccessMap } from "./textmon-memmap.mts";
import { ingestAccessMap, runIdentityFrom, type IngestRunIdentity } from "./evid-ingest.mts";
import { reconcileObservedExecution } from "./evid-reconcile.mts";
import { buildHazardReport } from "./anno-hazard-report.mts";
import { flatImageOrigin, parsePrg } from "./prg-image.mts";
import { blocksFromStore } from "./block-class.mts";
import {
  okText,
  toolFailure,
  AnnoUncuratedToolError,
  AnnoToolArgumentError,
  argBag,
  assertMaxResults,
  assertOptionalMaxResults,
  assertBaseRevisionArg,
  isEnumUsageClear,
  assertConstWritesArg,
  assertGraphicsMapIndexArg,
  currentReadRegionMaxBytes,
  assertWithinRegionCap,
  batchArgumentsFor,
  assertAnnoTool,
  stagedInputFile,
  type ToolCallResult,
  type AnnoInputs,
} from "./anno-tool-defs.mts";
export * from "./anno-tool-defs.mts";

// ---------------------------------------------------------------------------
// The dispatch table. Each dispatcher receives an ALREADY-OPEN handle it does
// not own: opening and closing are the caller's job.
//
// Every dispatcher surfaces `changed` from its `AnnoWriteResult` and NEVER maps
// `changed: false` to an error.
// ---------------------------------------------------------------------------

function dispatchGetSymbols(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_symbols", args);
  const bag = argBag(args);
  const start = bag.start_address !== undefined ? parseStoreAddress(bag.start_address, { what: "start_address" }) : undefined;
  const end = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : undefined;

  const all: LabelRow[] = listLabels(handle);
  const matched = all.filter((row) => {
    if (start !== undefined && row.address < start) return false;
    if (end !== undefined && row.address > end) return false;
    return true;
  });
  const symbols = matched.slice(0, maxResults);
  // `truncated` is reported rather than left for the caller to infer from a
  // count that happens to equal its own ceiling -- the ceiling being hit and
  // the answer being complete-at-exactly-the-ceiling are different facts.
  return { symbols, returned: symbols.length, matched: matched.length, truncated: matched.length > symbols.length };
}

function dispatchSetLabelName(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setLabel(handle, {
    address: bag.address as number | string,
    name: bag.name,
    // 'User' is the default because a name arriving through this surface was
    // chosen by whoever made the call; an unstated provenance is a human's.
    kind: bag.kind === undefined ? "User" : bag.kind,
    baseRevision: assertBaseRevisionArg("anno_set_label_name", args),
  });
  return { address: parseStoreAddress(bag.address, { what: "address" }), name: bag.name, kind: bag.kind ?? "User", ...written };
}

function dispatchSetComment(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setComment(handle, {
    address: bag.address as number | string,
    commentType: bag.type,
    text: bag.comment,
    baseRevision: assertBaseRevisionArg("anno_set_comment", args),
  });
  return { address: parseStoreAddress(bag.address, { what: "address" }), type: bag.type, ...written };
}

function dispatchSetDataType(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = setDataType(handle, {
    start: bag.start_address as number | string,
    endInclusive: bag.end_address as number | string,
    dataType: bag.data_type,
    baseRevision: assertBaseRevisionArg("anno_set_data_type", args),
  });
  // BOTH disclosures ride out on the SUCCESSFUL body, as named top-level
  // fields, every time -- including when they are empty, so "this write
  // contradicted nothing" is a fact the caller is told rather than the absence
  // of a field it has to know to look for. This is 28-VERIFICATION.md's F-4
  // obligation, discharged at the layer the human actually reads.
  return {
    start_address: parseStoreAddress(bag.start_address, { what: "start_address" }),
    end_address: parseStoreAddress(bag.end_address, { what: "end_address" }),
    data_type: bag.data_type,
    revision: written.revision,
    changed: written.changed,
    contradictedComments: written.contradictedComments,
    reinterpretedSplitTables: written.reinterpretedSplitTables,
  };
}

function dispatchScope(name: string, handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const span = {
    start: bag.start_address as number | string,
    endInclusive: bag.end_address as number | string,
    baseRevision: assertBaseRevisionArg(name, args),
  };
  const written = name === "anno_add_scope" ? addScope(handle, span) : removeScope(handle, span);
  return {
    start_address: parseStoreAddress(bag.start_address, { what: "start_address" }),
    end_address: parseStoreAddress(bag.end_address, { what: "end_address" }),
    ...written,
    scopes: listScopes(handle),
  };
}

/** One dispatcher serving `anno_exclude_range` / `anno_include_range`,
 * modelled on `dispatchScope()`. `excludedRanges` rides on EVERY successful
 * body, including when it is empty, for the same reason `dispatchSetDataType`'s
 * own disclosures do: the resulting state is a fact the caller is told, not
 * the absence of a field it has to know to look for. */
function dispatchExcludedRange(name: string, handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const span = {
    start: bag.start_address as number | string,
    endInclusive: bag.end_address as number | string,
    baseRevision: assertBaseRevisionArg(name, args),
  };
  const written =
    name === "anno_exclude_range"
      ? addExcludedRange(handle, { ...span, reason: bag.reason as string })
      : removeExcludedRange(handle, span);
  return {
    start_address: parseStoreAddress(bag.start_address, { what: "start_address" }),
    end_address: parseStoreAddress(bag.end_address, { what: "end_address" }),
    ...written,
    excludedRanges: listExcludedRanges(handle),
  };
}

function dispatchGetComments(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_comments", args);
  const bag = argBag(args);
  const wanted =
    bag.addresses === undefined ? undefined : new Set((bag.addresses as unknown[]).map((entry) => parseStoreAddress(entry, { what: "addresses[]" })));
  const start = bag.start_address !== undefined ? parseStoreAddress(bag.start_address, { what: "start_address" }) : undefined;
  const end = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : undefined;
  const type = bag.type !== undefined ? assertCommentType(bag.type) : undefined;

  const all: CommentRow[] = listComments(handle);
  const matched = all.filter((row) => {
    if (wanted !== undefined && !wanted.has(row.address)) return false;
    if (start !== undefined && row.address < start) return false;
    if (end !== undefined && row.address > end) return false;
    if (type !== undefined && row.commentType !== type) return false;
    return true;
  });
  const comments = matched.slice(0, maxResults);
  return { comments, returned: comments.length, matched: matched.length, truncated: matched.length > comments.length };
}

function dispatchGetBlocks(handle: AnnoStoreHandle, args: unknown): unknown {
  const maxResults = assertMaxResults("anno_get_blocks", args);
  const bag = argBag(args);
  const blockType = bag.block_type !== undefined ? assertDataType(bag.block_type) : undefined;
  const include = new Set((Array.isArray(bag.include) ? bag.include : []) as string[]);

  const matched = listRanges(handle).filter((row) => blockType === undefined || row.dataType === blockType);
  const blocks = matched.slice(0, maxResults);
  return {
    blocks,
    returned: blocks.length,
    matched: matched.length,
    truncated: matched.length > blocks.length,
    ...(include.has("scopes") ? { scopes: listScopes(handle) } : {}),
    ...(include.has("enums") ? { enums: listProjectEnums(handle) } : {}),
    ...(include.has("enum_usage") ? { enum_usage: listEnumUsage(handle) } : {}),
  };
}

function dispatchCreateProjectEnum(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = createProjectEnum(handle, {
    name: bag.name,
    variants: bag.variants,
    description: bag.description,
    baseRevision: assertBaseRevisionArg("anno_create_project_enum", args),
  });
  return { name: bag.name, ...written, enums: listProjectEnums(handle) };
}

function dispatchUpdateProjectEnum(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const written = updateProjectEnum(handle, {
    name: bag.name,
    newName: bag.new_name,
    variants: bag.variants,
    description: bag.description,
    baseRevision: assertBaseRevisionArg("anno_update_project_enum", args),
  });
  return { name: bag.new_name ?? bag.name, ...written, enums: listProjectEnums(handle) };
}

function dispatchApplyEnumUsage(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const baseRevision = assertBaseRevisionArg("anno_apply_enum_usage", args);
  const cleared = isEnumUsageClear(args);
  const written = cleared
    ? clearEnumUsage(handle, { address: bag.address as number | string, baseRevision })
    : applyEnumUsage(handle, { address: bag.address as number | string, name: bag.name, baseRevision });
  return {
    address: parseStoreAddress(bag.address, { what: "address" }),
    name: cleared ? null : bag.name,
    cleared,
    ...written,
    enum_usage: listEnumUsage(handle),
  };
}

/** THE HONEST SAVE. It opens (through the runner), reads the revision, and
 * closes. It writes NOTHING, and the body says so in its own words rather than
 * leaving the caller to infer durability from an empty success. `curated` in
 * the manifest means a route is required; returning `{available:false}` was
 * rejected, because a permanent refusal for a curated disposition is what the
 * `omit` disposition is for and the manifest does not say `omit`.
 *
 * THE REVISION IS READ EXACTLY ONCE, into a `const`, and that single value
 * feeds both the returned field and the note's prose. This is the one verb
 * whose output a caller is TOLD to use as a `base_revision` compare-and-swap
 * guard, so a field and a prose that could name different revisions is a guard
 * built on a number its own note contradicts -- and a guard nobody can trust is
 * worse than no guard, because it is acted on (WR-10). Two reads agreeing is an
 * accident of when they ran; one read agreeing with itself is a property. */
function dispatchSaveProject(handle: AnnoStoreHandle): unknown {
  const revision = currentRevision(handle);
  return {
    revision,
    wrote: false,
    note:
      "This verb performed NO write. Every mutating verb on this surface commits and fsyncs its own write before it " +
      "returns, so the store was already durable at revision " +
      String(revision) +
      " when this call arrived and there was nothing for an explicit save to flush. The revision is reported so it can " +
      "be used as a base_revision compare-and-swap guard on a later write.",
  };
}

/** Both multi-write verbs take `base_revision` as a whole-call guard: the
 * verb checks it under the write lock and runs every write in one
 * transaction, so a stale guard or a refusal part-way writes nothing. */
function dispatchImportGhidraExport(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const bag = argBag(args);
  const baseRevision = assertBaseRevisionArg("anno_import_ghidra_export", args);
  const exportFile = stagedInputFile("anno_import_ghidra_export", "export_path", bag.export_path, inputs);
  return importGhidraExport(handle, {
    exportName: exportFile.name,
    exportBytes: exportFile.bytes,
    expectedSha256: bag.sha256 as string | undefined,
    ...(baseRevision !== undefined ? { baseRevision } : {}),
  });
}

function dispatchJoinMemmap(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const baseRevision = assertBaseRevisionArg("anno_join_memmap", args);
  const image = loadImage("anno_join_memmap", args, inputs);
  // OMITTING `const_writes` (not sending `[]`) is what keeps the bank-state
  // and graphics steps off.
  const constWrites = assertConstWritesArg("anno_join_memmap", args);
  const graphicsMapIndex = assertGraphicsMapIndexArg("anno_join_memmap", args);
  return runMemmapJoin(handle, {
    imageOrigin: image.origin,
    imageByteLength: image.body.length,
    ...(constWrites !== undefined ? { constWrites } : {}),
    ...(graphicsMapIndex !== undefined ? { graphicsMapIndex } : {}),
    ...(baseRevision !== undefined ? { baseRevision } : {}),
  });
}

/**
 * `anno_evid_ingest`'s dispatch arm (EVID-01, EVID-04, plan 43-05). Calls
 * `parseAccessMap()` -- THE ONE PARSE -- then `ingestAccessMap()` from
 * `evid-ingest.mts`; on a refusal it throws inside the `ViceError` family
 * (never absorbs a drifted reply, T-43-22); on success it writes the WHOLE
 * observation array through ONE `insertExecObservations()` call, so the
 * write is one transaction through the store's single commit site
 * (T-43-26). `observationsWritten` is `insertExecObservations()`'s own
 * `insertedCount` (WR-02) -- counted row-by-row INSIDE that same
 * transaction, never from a separate pre-write read -- not the size of the
 * array handed in: re-ingesting the identical reply must report
 * `observationsWritten: 0` even though the same-shaped array was passed
 * again.
 *
 * `denominator` travels beside every count this answer reports
 * (`addressesQueried`, the parsed map's own projection) -- a bare
 * `observationsWritten` would invite the reading "the rest is data", which
 * is why the denominator is never omitted. No percentage is ever formed
 * here.
 */
function dispatchEvidIngest(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const baseRevision = assertBaseRevisionArg("anno_evid_ingest", args);

  const parsed = parseAccessMap(bag.memmap_text as string);
  const identity: IngestRunIdentity = {
    imageSha256: bag.image_sha256 as string,
    argv: bag.argv as string[],
    seed: bag.seed as string,
  };
  const ingested = ingestAccessMap(parsed, identity);
  if (!ingested.ok) {
    throw new AnnoToolArgumentError(`anno_evid_ingest refused: ${ingested.message}`, {
      toolName: "anno_evid_ingest",
      argument: "memmap_text",
    });
  }

  const ranges = parsed.ok ? accessMapRanges(parsed.value) : undefined;
  const addressesWithRecordedAccess = ranges?.addressesWithRecordedAccess ?? 0;
  const addressesQueried = ranges?.addressesQueried ?? 0;

  // A reply that recorded no execution anywhere is a real, legitimate
  // answer -- not an error -- but `insertExecObservations` refuses an EMPTY
  // observations array, so that zero-write case is reported directly here
  // rather than calling a store function built to refuse it. WR-01: it is
  // still routed through `applyWrite()` with a no-op mutator (rather than
  // returning early on `currentRevision(handle)` alone) so a stale
  // `base_revision` is refused on THIS path exactly as it would be on the
  // non-empty path below -- every other write verb in this store enforces
  // staleness through `applyWrite()`'s own check, and a caller relying on
  // that contract must not get a silent success here instead.
  if (ingested.observations.length === 0) {
    const { revision } = applyWrite(handle, () => false, { baseRevision });
    return {
      revision,
      changed: false,
      observationsWritten: 0,
      addressesWithRecordedAccess,
      addressesQueried,
      denominator: addressesQueried,
    };
  }

  // WR-02: `observationsWritten` is the COUNT `insertExecObservations()`
  // itself returns, counted row-by-row INSIDE its own `applyWrite`
  // transaction -- never a `listExecObservations()` read taken before that
  // transaction opens. A separately-derived pre-read can be overtaken by a
  // concurrent writer to the same run identity between the read and this
  // call's own commit, overstating how many rows THIS call actually added;
  // counting inside the transaction that performs the insert is the one
  // place this number can be exact.
  const written = insertExecObservations(handle, {
    imageSha256: ingested.runIdentity.imageSha256,
    argvDigest: ingested.runIdentity.argvDigest,
    seed: ingested.runIdentity.seed,
    observations: ingested.observations.map((o) => ({ address: o.address, sourceBank: o.sourceBank })),
    baseRevision,
  });

  return {
    revision: written.revision,
    changed: written.changed,
    observationsWritten: written.insertedCount,
    addressesWithRecordedAccess,
    addressesQueried,
    denominator: addressesQueried,
  };
}

/**
 * `anno_evid_disagreements`'s dispatch arm (EVID-03/EVID-04, plan 43-06).
 * Fetches BOTH sides HERE -- `listExecObservations()` and `listRanges()` --
 * so `reconcileObservedExecution()` (`evid-reconcile.mts`) is never handed a
 * store to open itself; that pure module's own header states it must never
 * fetch either side.
 *
 * The byte-derived ranges are mapped through `blocksFromStore()`
 * (`block-class.mts`). The mapping itself is NOT re-implemented here: a second `RangeRow` -> `BlockEntry` site
 * would be a second answer to "what class is this address", which is
 * exactly the boundary `block-class.mts` (and `blocksFromStore()`'s own
 * comment) exists to keep at one.
 *
 * `max_results` (optional, `assertOptionalMaxResults`) bounds the RETURNED
 * `disagreements` array only -- `agreementCount` and every other bucket are
 * already counts, never rows, so there is nothing else to truncate.
 * `reconciliation`'s own key order is preserved by spreading it before
 * re-assigning `disagreements`: JS does not move an existing key to the end
 * of an object literal on reassignment, so `disagreements` stays the FIRST
 * key of the answer (EVID-03).
 */
async function dispatchEvidDisagreements(handle: AnnoStoreHandle, args: unknown): Promise<unknown> {
  const maxResults = assertOptionalMaxResults("anno_evid_disagreements", args);
  const bag = argBag(args);
  const hasRunFilter = bag.image_sha256 !== undefined;
  const observations = listExecObservations(
    handle,
    hasRunFilter ? { imageSha256: bag.image_sha256, argvDigest: bag.argv_digest, seed: bag.seed } : {},
  );
  const blocks = blocksFromStore(listRanges(handle));
  const reconciliation = reconcileObservedExecution({ blocks, observations });
  const disagreements = maxResults === undefined ? reconciliation.disagreements : reconciliation.disagreements.slice(0, maxResults);
  return {
    ...reconciliation,
    disagreements,
    returned: disagreements.length,
    matched: reconciliation.disagreements.length,
    truncated: reconciliation.disagreements.length > disagreements.length,
  };
}

/** `anno_evid_runs`'s dispatch arm (plan 43-06): `listObservedRuns()`'s own
 * answer, carried through UNCHANGED beside `store` -- its `denominator` is
 * reported exactly as that function computed it, never re-derived here. */
function dispatchEvidRuns(handle: AnnoStoreHandle, args: unknown): unknown {
  void args; // this verb takes no argument beyond the universal `store`
  return { ...listObservedRuns(handle) };
}

/**
 * `anno_evid_reset`'s dispatch arm (EVID-05, plan 43-06): the store-side
 * half of a bracket reset, beside plan 43-03's emulator-side
 * `vice_memmap_zap`. Derives the run identity through `runIdentityFrom()`
 * from `evid-ingest.mts` -- the SAME single digest site `anno_evid_ingest`
 * uses -- never a second hashing site here, and never a caller-supplied
 * digest. `observationsRemoved` is read from a `listExecObservations()`
 * query taken BEFORE the delete, so the answer names exactly how many rows
 * this call removed rather than leaving a caller to infer it from `changed`
 * alone. `baseRevision` is threaded straight into
 * `deleteExecObservationsForRun()`, which enforces staleness itself through
 * `applyWrite()` -- the same "let the store's own write sequence check it"
 * discipline `dispatchEvidIngest()` above already uses, so there is no
 * second, redundant `assertNotStale()` call here.
 */
function dispatchEvidReset(handle: AnnoStoreHandle, args: unknown): unknown {
  const bag = argBag(args);
  const baseRevision = assertBaseRevisionArg("anno_evid_reset", args);
  const identity = runIdentityFrom({
    imageSha256: bag.image_sha256 as string,
    argv: bag.argv as string[],
    seed: bag.seed as string,
  });
  const existing = listExecObservations(handle, {
    imageSha256: identity.imageSha256,
    argvDigest: identity.argvDigest,
    seed: identity.seed,
  });
  const written = deleteExecObservationsForRun(handle, {
    imageSha256: identity.imageSha256,
    argvDigest: identity.argvDigest,
    seed: identity.seed,
    baseRevision,
  });
  return {
    revision: written.revision,
    changed: written.changed,
    observationsRemoved: existing.length,
    // `denominator` travels beside `observationsRemoved` for the same reason
    // it travels beside every other count this evidence layer reports
    // (EVID-04, plan 43-07's own structural guard): a bare count invites the
    // reading "the rest is data". The bracket this call reset held exactly
    // `existing.length` rows before the delete, so that is what
    // `observationsRemoved` is a fraction of -- a full reset makes the two
    // numbers equal, but the field is never omitted just because it agrees.
    denominator: existing.length,
  };
}

// ---------------------------------------------------------------------------
// The image loader (D-07). The store holds annotations and never bytes, so
// every derived read names its own image and this function is the ONE place
// that turns that name into bytes plus an origin.
//
// DISPATCH IS BY EXTENSION FIRST, NEVER BY BYTE LENGTH. The branch order below
// was copied from the CLI's own bootstrap dispatch rather than re-derived; that
// verb was removed on 2026-08-29 when the CLI narrowed to two (D-14), so THIS
// is now the only implementation of the order and the citation that named the
// CLI's line range is deliberately gone rather than left dangling. The
// incident it encodes (WR-07): a 4096-byte flat `.raw` capture fell through to
// the `.prg` parser, whose first two bytes become the load address, so a
// truncated capture silently "bootstrapped" with an origin read backwards out
// of its own payload bytes and exited zero -- every downstream address wrong,
// no diagnostic. The extension check runs BEFORE any length check so
// `flatImageOrigin()`'s own named refusal stays reachable for those two
// extensions.
// ---------------------------------------------------------------------------

interface LoadedImage {
  path: string;
  kind: "prg" | "flat";
  origin: number;
  body: Uint8Array;
  totalBytes: number;
}

function loadImage(name: string, args: unknown, inputs: AnnoInputs): LoadedImage {
  const file = stagedInputFile(name, "image", argBag(args).image, inputs);
  const path = file.name;
  const bytes = file.bytes;
  const ext = extname(path).toLowerCase();
  try {
    if (ext === ".raw" || ext === ".bin") {
      return { path, kind: "flat", origin: flatImageOrigin(bytes), body: bytes, totalBytes: bytes.length };
    }
    if (ext !== ".prg" && bytes.length === 65536) {
      return { path, kind: "flat", origin: flatImageOrigin(bytes), body: bytes, totalBytes: bytes.length };
    }
    const { origin, body } = parsePrg(bytes);
    return { path, kind: "prg", origin, body, totalBytes: bytes.length };
  } catch (err) {
    // `prg-image.mts` throws a bare `Error` by design -- it is a pure
    // byte-layout module with no error family of its own. Wrapped here so the
    // never-throw boundary can still name a class, and so the message carries
    // the caller's own vocabulary (the image path) rather than only the
    // internal function name.
    const reason = err instanceof Error ? err.message : String(err);
    throw new AnnoToolArgumentError(
      `${name} refused: ${JSON.stringify(path)} is not an image this surface can read (${reason}). Supply a .prg (a 2-byte ` +
        "little-endian load address plus a payload) or an exactly-65536-byte flat capture.",
      { toolName: name, argument: "image" },
    );
  }
}

/** Shannon entropy of `bytes`, in bits per byte. Above roughly 7.5 the image is
 * very likely compressed or packed, and nothing in it will decode sensibly
 * until it is depacked -- which is why this is REPORTED rather than left for a
 * caller to wonder about after a disassembly comes back as noise. */
function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const histogram = new Uint32Array(256);
  for (const byte of bytes) histogram[byte] += 1;
  let entropy = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 1000) / 1000;
}

/** The slice of `image` covering the inclusive span, or `null` when the span
 * falls outside the bytes the image actually holds. `null` rather than a short
 * slice: a partial answer to a range question reads as a complete answer to a
 * smaller one.
 *
 * TOTAL OVER EVERY (start, end) PAIR, and that is three cases, not two. Below
 * the origin and past the last byte are the obvious two. The third is an
 * INVERTED span -- a resolved `from` past its own `to` -- which passes both
 * bound checks while covering no bytes at all, and which `subarray()` would
 * hand back as a zero-length success. That is the same failure as a short
 * slice wearing a smaller hat: answering a question about no bytes with an
 * empty result reads as a complete answer to a smaller question, which is the
 * very thing this `null` return exists against (CR-01). */
function sliceSpan(image: LoadedImage, start: number, end: number): Uint8Array | null {
  const from = start - image.origin;
  const to = end - image.origin;
  if (from < 0 || to >= image.body.length || from > to) return null;
  return image.body.subarray(from, to + 1);
}

/** The ONE refusal builder both read verbs report through. `anno_disassemble`
 * and `anno_read_region` each call `sliceSpan()` exactly once, over the span
 * their own answer would have reported -- the span the CALLER can see -- and
 * each reaches this builder from that one verdict. Their AGREEMENT is the
 * property CR-01 was reported against: the defect was `anno_disassemble`
 * narrowing the requested end down to the image's last address BEFORE slicing,
 * so an out-of-image start produced an empty slice instead of the `null` that
 * reaches here, and the caller got `instructions:0` with an `end_address`
 * numerically below the `address` asked about. Do not reintroduce a per-verb
 * narrowing: it makes the two verbs disagree about the same bytes. */
function outsideImage(name: string, image: LoadedImage, start: number, end: number): Record<string, unknown> {
  const last = image.origin + image.body.length - 1;
  return {
    available: false,
    reason:
      `${name} was asked for $${start.toString(16).padStart(4, "0")}..$${end.toString(16).padStart(4, "0")}, which is not ` +
      `entirely inside the image: ${JSON.stringify(image.path)} loads at $${image.origin.toString(16).padStart(4, "0")} and ` +
      `ends at $${last.toString(16).padStart(4, "0")}. Reported as unanswerable rather than served as a short slice, because a ` +
      "partial answer to a range question reads as a complete answer to a smaller one. Narrow the range, or name the image that " +
      "actually covers those addresses.",
  };
}

function hexdump(bytes: Uint8Array, start: number): string[] {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    lines.push(`$${(start + offset).toString(16).padStart(4, "0")}  ${hex}`);
  }
  return lines;
}

/** The SAME shape `registerKeyFor().slice(1)` produces (uppercase, exactly
 * four hex digits) -- `anno-export-asm.mts`'s own `REGISTER_ENUM_NAME_RE`
 * comment explains why an enum usage is only a CANDIDATE for the decoder
 * when its name has this shape, and why that check is not centralised: two
 * renderers, two small local copies of this one shape predicate, one shared
 * decoder. Kept in sync by inspection (both are one line) rather than by
 * import, per D-16's own "two renderers" design.
 *
 * SHAPE ALONE IS NOT ENOUGH (45-REVIEW CR-01, fixed 2026-09-11): the call
 * site below also requires `hasRegBitsEntry()` -- imported from
 * `anno-enum-gen.mts` above, the ONE shared membership predicate, NOT a third
 * local copy -- to confirm `anno-regbits.json` actually covers the register
 * before attempting the decoder at all. */
const REGISTER_ENUM_NAME_RE = /^[0-9A-F]{4}$/;

/** `#$XX` -> `#<replacement>` on the ASSEMBLER-VISIBLE half of `line`, the
 * same confinement `anno-export-asm.mts`'s `substituteImmediateEnum()` uses
 * (never rewriting inside a trailing `;` comment, where a renderer's own
 * NOTE text could coincidentally contain the same hex digits). A rendered
 * line that does not carry the expected literal is a disagreement between
 * this function and `disasm-renderer.mts`, and it is refused rather than
 * silently left unchanged. */
function substituteReadableImmediate(line: string, value: number, replacement: string, address: number): string {
  const literal = `#$${(value & 0xff).toString(16).padStart(2, "0")}`;
  const separatorIndex = line.indexOf("  ; ");
  const directiveHalf = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
  const commentHalf = separatorIndex >= 0 ? line.slice(separatorIndex) : "";
  const at = directiveHalf.indexOf(literal);
  if (at < 0) {
    throw new AnnoStoreError(
      `anno_disassemble: the instruction at $${address.toString(16).padStart(4, "0")} carries an enum usage, but its rendered line does ` +
        `not contain the immediate literal ${literal} this renderer expected to replace. Refusing rather than emitting a line whose ` +
        "substitution silently did nothing.",
    );
  }
  return `${directiveHalf.slice(0, at)}#${replacement}${directiveHalf.slice(at + literal.length)}${commentHalf}`;
}

/** Appends `comment` as a trailing `;`-comment on `line`, joining it with any
 * EXISTING trailing comment (a `disasm-renderer.mts` note, e.g. an NMOS
 * page-wrap warning) via `" | "` -- the SAME separator `formatNotesComment()`
 * already uses to join multiple notes on one instruction, so a line with
 * both a note and a decoded register comment reads as one vocabulary rather
 * than two different join styles on one line. */
function appendReadableComment(line: string, comment: string): string {
  const separatorIndex = line.indexOf("  ; ");
  if (separatorIndex < 0) return `${line}  ; ${comment}`;
  return `${line} | ${comment}`;
}

/**
 * D-16's SECOND renderer (plan 45-05): the READABILITY half. `anno-export-
 * asm.mts` carries the proof (a real-ACME byte-diff oracle); this is what a
 * Claude session actually reads. Calls `decomposeRegisterValue()` -- the ONE
 * owning decoder -- for exactly the same reason: this function decodes
 * NOTHING itself.
 *
 * BYTE-IDENTICAL TO `render()`'S OWN OUTPUT when the store carries no enum
 * usage inside the decoded range at all (the fast-path return below), and
 * for every instruction `usageByAddress` does not cover even when it does --
 * D-16 widens what a bound instruction shows; it does not touch anything
 * else `render()` already produces.
 *
 * THE LINE-INDEX MAPPING THIS RELIES ON: `render(instructions, { origin })`
 * is called here WITHOUT `showSymbols`, so `resolveSymbol()` (`disasm-
 * renderer.mts`) always returns `undefined` and its own symbol-header loop
 * never emits a line -- the header is EXACTLY `"!cpu 6510"` then `"* =
 * $XXXX"`, two lines, and `instructions[i]` maps to `lines[HEADER_LINES +
 * i]` with no other possible offset. A future caller of this function that
 * ever passes `showSymbols: true` would break that mapping silently; this
 * function does not, and does not need to for the readability job D-16 gives
 * it.
 */
function renderDisassembleListing(handle: AnnoStoreHandle, instructions: readonly Instruction[], origin: number): string {
  const baseListing = render(instructions as Instruction[], { origin });

  const usageByAddress = new Map<number, EnumUsageRow>();
  for (const row of listEnumUsage(handle)) usageByAddress.set(row.address, row);
  if (usageByAddress.size === 0) return baseListing;

  const enumsByName = new Map<string, ProjectEnumRow>();
  for (const row of listProjectEnums(handle)) enumsByName.set(row.name, row);

  const HEADER_LINES = 2;
  const lines = baseListing.split("\n");

  instructions.forEach((instr, index) => {
    const usage = usageByAddress.get(instr.address);
    if (usage === undefined) return;

    // THE SAME REFUSAL SHAPE THE EXPORT BOUNDARY RAISES (`anno-export-
    // asm.mts`'s own enum-substitution block) for the same conditions, not a
    // silently plain listing for a store row this readable surface cannot
    // honour.
    const project = enumsByName.get(usage.enumName);
    if (project === undefined) {
      throw new AnnoStoreError(
        `anno_disassemble: the enum usage at $${instr.address.toString(16).padStart(4, "0")} names enum ${JSON.stringify(usage.enumName)}, ` +
          "which the store holds no definition for. Refusing to render a readable operand whose vocabulary is missing.",
      );
    }
    const role = instr.operand?.role;
    if (role !== "immediate" || !instr.acmeExpressible) {
      throw new AnnoStoreError(
        `anno_disassemble: the enum usage at $${instr.address.toString(16).padStart(4, "0")} names enum ${JSON.stringify(usage.enumName)}, but ` +
          "the instruction there is not an assembler-visible IMMEDIATE operand -- an enum renders on the immediate operand only. Refusing " +
          "rather than rendering a readable line with no substitution.",
      );
    }

    // D-16: attempted ONLY when BOTH (45-REVIEW CR-01, fixed 2026-09-11) the
    // enum's name has the register-key shape -- see `REGISTER_ENUM_NAME_RE`'s
    // own comment for why a name that does not (e.g. a hand-authored
    // `viccolor`) is never a candidate -- AND `anno-regbits.json` actually
    // has a table entry for it (`hasRegBitsEntry()`). A register-shaped name
    // for a register the table does not cover (e.g. `D020`) is not a
    // decomposition failure; it falls through to the single-symbol shape
    // below with no decomposition attempted at all.
    let decomposition: RegisterDecomposition | undefined;
    if (REGISTER_ENUM_NAME_RE.test(usage.enumName) && hasRegBitsEntry(`$${usage.enumName}`)) {
      try {
        // `Number("0x...")`, never `parseInt()` -- this file's own guard
        // (anno-tools.test.ts) forbids a second, divergent numeric-parsing
        // rule beside the store's own. `usage.enumName` is already proven
        // to match REGISTER_ENUM_NAME_RE (four hex digits) above.
        decomposition = decomposeRegisterValue(Number(`0x${usage.enumName}`), instr.operand!.value);
      } catch (err) {
        throw new AnnoStoreError(
          `anno_disassemble: decomposing the enum usage at $${instr.address.toString(16).padStart(4, "0")} (enum ` +
            `${JSON.stringify(usage.enumName)}) against its bit-name table failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const lineIndex = HEADER_LINES + index;
    const currentLine = lines[lineIndex]!;

    if (decomposition !== undefined && decomposition.multiField) {
      // D-17: OR-ed named constants AND the decoded comment -- both, exactly
      // as the export renders them, so a Claude session reading this listing
      // sees what the export proves.
      const orExpression = decomposition.terms.map((term) => term.name).join(" | ");
      const substituted = substituteReadableImmediate(currentLine, instr.operand!.value, orExpression, instr.address);
      lines[lineIndex] = appendReadableComment(substituted, decomposition.comment);
      return;
    }

    // THE EXISTING SINGLE-SYMBOL SHAPE (D-16: not replaced) -- a single-field
    // register, an enum usage whose name is not register-shaped at all, OR
    // (45-REVIEW CR-01) a register-shaped name for a register
    // `anno-regbits.json` has no entry for (e.g. `D020`).
    let matched: string | undefined;
    for (const [key, variantName] of Object.entries(project.variants)) {
      if (parseVariantKey(key) === instr.operand!.value) matched = variantName;
    }
    if (matched === undefined) {
      throw new AnnoStoreError(
        `anno_disassemble: enum ${JSON.stringify(usage.enumName)} is bound to the immediate operand at ` +
          `$${instr.address.toString(16).padStart(4, "0")}, whose value is $${(instr.operand!.value & 0xff).toString(16).padStart(2, "0")}, ` +
          "and the enum has no variant for that value.",
      );
    }
    lines[lineIndex] = substituteReadableImmediate(currentLine, instr.operand!.value, `${usage.enumName}_${matched}`, instr.address);
  });

  return lines.join("\n");
}

function dispatchDisassemble(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_disassemble", args, inputs);
  const bag = argBag(args);
  const start = parseStoreAddress(bag.address, { what: "address" });
  const cap = currentReadRegionMaxBytes();
  const last = image.origin + image.body.length - 1;
  // An omitted end is the CAP, not the whole image: the default has to be the
  // bound, or the default is the hazard.
  const requestedEnd = bag.end_address !== undefined ? parseStoreAddress(bag.end_address, { what: "end_address" }) : Math.min(start + cap - 1, last);
  if (bag.end_address !== undefined) assertWithinRegionCap("anno_disassemble", start, requestedEnd, undefined);
  // Sliced on the span the CALLER named, never on one narrowed down to the
  // image's last address first. The narrowing used to happen here, and it is
  // what made this verb disagree with `anno_read_region` (CR-01) -- see
  // `outsideImage()`. Note what is NOT lost: an omitted `end_address` derives
  // `requestedEnd` from the image's own last address above, so it is inside
  // the image by construction and nothing a caller named is narrowed away.
  const slice = sliceSpan(image, start, requestedEnd);
  if (slice === null) return outsideImage("anno_disassemble", image, start, requestedEnd);

  const instructions = decode(slice, start, { end: requestedEnd });
  return {
    image: image.path,
    origin: image.origin,
    address: start,
    end_address: requestedEnd,
    instructions: instructions.length,
    listing: renderDisassembleListing(handle, instructions, start),
  };
}

/**
 * `anno_hazard_report`'s dispatch arm. Fetches EVERY input here -- the
 * byte-derived ranges, labels, comments, cross-references, execution
 * observations and the image bytes -- and hands them to `buildHazardReport()`
 * exactly once; the pure module itself never fetches any of it (see its own
 * header). The byte-derived ranges are mapped through `blocksFromStore()`
 * (`block-class.mts`), for the same reason `dispatchEvidDisagreements` states
 * for itself.
 */
async function dispatchHazardReport(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): Promise<unknown> {
  const maxResults = assertOptionalMaxResults("anno_hazard_report", args);
  const image = loadImage("anno_hazard_report", args, inputs);
  const ranges = blocksFromStore(listRanges(handle));
  const symbols = listLabels(handle);
  const comments = listComments(handle);
  const xrefs = listXrefs(handle);
  const execObservations = listExecObservations(handle);
  const report = buildHazardReport({
    bytes: image.body,
    origin: image.origin,
    symbols,
    comments,
    ranges,
    xrefs,
    execObservations,
  });
  const findings = maxResults === undefined ? report.findings : report.findings.slice(0, maxResults);
  return {
    image: image.path,
    ...report,
    findings,
    returned: findings.length,
    matched: report.findings.length,
    truncated: report.truncated || report.findings.length > findings.length,
  };
}

function dispatchReadRegion(args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_read_region", args, inputs);
  const bag = argBag(args);
  const start = parseStoreAddress(bag.start_address, { what: "start_address" });
  const end = parseStoreAddress(bag.end_address, { what: "end_address" });
  const view = bag.view === "hexdump" ? "hexdump" : "disasm";
  const slice = sliceSpan(image, start, end);
  if (slice === null) return outsideImage("anno_read_region", image, start, end);

  if (view === "hexdump") {
    return { image: image.path, origin: image.origin, start_address: start, end_address: end, view, bytes: slice.length, hexdump: hexdump(slice, start).join("\n") };
  }
  const instructions = decode(slice, start, { end });
  return {
    image: image.path,
    origin: image.origin,
    start_address: start,
    end_address: end,
    view,
    bytes: slice.length,
    instructions: instructions.length,
    listing: render(instructions, { origin: start }),
  };
}

function dispatchBinaryInfo(args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_get_binary_info", args, inputs);
  const entropy = shannonEntropy(image.body);
  return {
    image: image.path,
    kind: image.kind,
    origin: image.origin,
    total_bytes: image.totalBytes,
    body_bytes: image.body.length,
    last_address: image.origin + image.body.length - 1,
    entropy,
    likely_packed: entropy > 7.5,
  };
}

function dispatchCrossReferences(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_get_cross_references", args, inputs);
  const maxResults = assertMaxResults("anno_get_cross_references", args);
  const bag = argBag(args);
  const union = crossReferencesTo(handle, image.body, image.origin, bag.address as number | string);
  const callers = union.callers.slice(0, maxResults);
  return {
    image: image.path,
    to: union.to,
    callers,
    returned: callers.length,
    total: union.count,
    truncated: union.count > callers.length,
  };
}

function dispatchSearch(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_search", args, inputs);
  const bag = argBag(args);
  // THE CALLER'S OWN BAG IS PASSED THROUGH, not reconstructed from the three
  // keys this layer knows about. `searchAnnotations` detects a corpus this
  // surface does not have by scanning for `search_<name>` keys it does not
  // recognise, so rebuilding the request here would silently DROP exactly the
  // signal the unanswerable-corpus report depends on -- and the caller would
  // get a clean, plausible, wrong hit list for a corpus that was never
  // searched. `query` and `max_results` are re-stated last so the validated
  // values win over whatever shape arrived.
  const result = searchAnnotations(handle, image.body, image.origin, {
    ...bag,
    query: bag.query as string,
    max_results: assertMaxResults("anno_search", args),
  });

  const unanswerable = Object.keys(result.unavailable);
  if (unanswerable.length > 0) {
    // THE WHOLE CALL IS ANSWERED AS UNANSWERABLE, not served as a partial
    // result set with a footnote. The request named a corpus this surface does
    // not have, so any hit list returned beside that would look like the
    // complete answer to the question actually asked -- which is the
    // plausible-looking zero this shape exists against. `isError` stays FALSE:
    // the request was well-formed and the answer is "no".
    return {
      available: false,
      reason: unanswerable.map((corpus) => result.unavailable[corpus]!.reason).join(" "),
      unanswerable_corpora: unanswerable,
      corpora: result.corpora,
    };
  }
  return { image: image.path, ...result };
}

function dispatchAddressDetails(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): unknown {
  const image = loadImage("anno_get_address_details", args, inputs);
  const bag = argBag(args);
  return { image: image.path, ...composeAddressDetails(handle, image.body, image.origin, bag.address as number | string) };
}


/** PHASE TWO. Runs every entry against the ONE already-open handle, to
 * COMPLETION, pushing a per-entry status and never aborting on the first
 * failure. Pre-validation has already refused every batch that should not have
 * been sent, so a failure here is genuinely about one call rather than about
 * the payload. */
async function dispatchBatchExecute(handle: AnnoStoreHandle, args: unknown, inputs: AnnoInputs): Promise<unknown> {
  const bag = argBag(args);
  const calls = bag.calls as Record<string, unknown>[];
  const results: Record<string, unknown>[] = [];
  for (const [index, call] of calls.entries()) {
    const name = call.name as string;
    const innerArgs = batchArgumentsFor(bag, call);
    try {
      const value = name === "anno_batch_execute" ? await dispatchBatchExecute(handle, innerArgs, inputs) : await dispatch(name, innerArgs, handle, inputs);
      results.push({ index, name, status: "success", result: value });
    } catch (err) {
      // NAMED BY CLASS, exactly as the outer boundary names it, so a per-item
      // failure is as diagnosable as a whole-call one.
      const errName = err instanceof Error ? err.name : "Error";
      const errMessage = err instanceof Error ? err.message : String(err);
      results.push({ index, name, status: "error", error: `[${errName}] ${errMessage}` });
    }
  }
  const failed = results.filter((entry) => entry.status === "error").length;
  return {
    results,
    executed: results.length,
    succeeded: results.length - failed,
    failed,
    note:
      "Every entry ran: this loop does not abort on the first failure, so an error entry here means THAT CALL did not work, " +
      "not that the batch should not have been sent. A batch that should not have been sent is refused WHOLE before anything " +
      "is opened, and arrives as isError:true instead of as a per-item status.",
  };
}

async function dispatch(name: string, args: unknown, handle: AnnoStoreHandle, inputs: AnnoInputs): Promise<unknown> {
  if (name === "anno_get_symbols") return dispatchGetSymbols(handle, args);
  if (name === "anno_set_label_name") return dispatchSetLabelName(handle, args);
  if (name === "anno_set_comment") return dispatchSetComment(handle, args);
  if (name === "anno_set_data_type") return dispatchSetDataType(handle, args);
  if (name === "anno_add_scope" || name === "anno_remove_scope") return dispatchScope(name, handle, args);
  if (name === "anno_exclude_range" || name === "anno_include_range") return dispatchExcludedRange(name, handle, args);
  if (name === "anno_get_comments") return dispatchGetComments(handle, args);
  if (name === "anno_get_blocks") return dispatchGetBlocks(handle, args);
  if (name === "anno_create_project_enum") return dispatchCreateProjectEnum(handle, args);
  if (name === "anno_update_project_enum") return dispatchUpdateProjectEnum(handle, args);
  if (name === "anno_apply_enum_usage") return dispatchApplyEnumUsage(handle, args);
  if (name === "anno_save_project") return dispatchSaveProject(handle);
  if (name === "anno_import_ghidra_export") return dispatchImportGhidraExport(handle, args, inputs);
  if (name === "anno_join_memmap") return dispatchJoinMemmap(handle, args, inputs);
  if (name === "anno_evid_ingest") return dispatchEvidIngest(handle, args);
  if (name === "anno_evid_disagreements") return dispatchEvidDisagreements(handle, args);
  if (name === "anno_evid_runs") return dispatchEvidRuns(handle, args);
  if (name === "anno_evid_reset") return dispatchEvidReset(handle, args);
  if (name === "anno_disassemble") return dispatchDisassemble(handle, args, inputs);
  if (name === "anno_hazard_report") return dispatchHazardReport(handle, args, inputs);
  if (name === "anno_read_region") return dispatchReadRegion(args, inputs);
  if (name === "anno_get_binary_info") return dispatchBinaryInfo(args, inputs);
  if (name === "anno_get_cross_references") return dispatchCrossReferences(handle, args, inputs);
  if (name === "anno_search") return dispatchSearch(handle, args, inputs);
  if (name === "anno_get_address_details") return dispatchAddressDetails(handle, args, inputs);
  if (name === "anno_batch_execute") return dispatchBatchExecute(handle, args, inputs);
  // Unreachable: `assertAnnoTool()` above has already refused every name
  // outside `CURATED_ANNO_TOOLS`, and every curated name has an arm here. It
  // refuses BY NAME anyway rather than returning a plausible-looking empty
  // answer -- a curated name with no dispatch arm is a bug in this file, and
  // saying so is cheaper than a silent `{}` somebody has to trace back.
  throw new AnnoUncuratedToolError(
    `"${name}" is curated but has no dispatch arm in anno-tools.mts. Resolution routes: implement it and ` +
      "add it to ANNO_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
    { toolName: name },
  );
}

/**
 * Answers one curated `anno_*` call against `handle`, which the caller opened
 * and closes. THE NEVER-THROW BOUNDARY: every failure -- an uncurated name, a
 * malformed argument, an unstaged file, a corrupt store, a bug in a dispatcher
 * -- resolves as `{isError:true}` text naming the error CLASS. Nothing rejects
 * the returned promise.
 *
 * `assertAnnoTool` is INSIDE the `try`, so a refusal RESOLVES like every other
 * failure instead of rejecting (WR-02).
 */
export async function runAnnoToolOnHandle(handle: AnnoStoreHandle, name: string, args: unknown, inputs: AnnoInputs): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    return okText(JSON.stringify(await dispatch(name, args, handle, inputs)));
  } catch (err) {
    return toolFailure(name, err);
  }
}
