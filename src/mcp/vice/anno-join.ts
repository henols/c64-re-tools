#!/usr/bin/env node
// anno-join.ts
//
// Phase 37, plan 37-01 (AUTO-01): the mechanical join between stored
// cross-references and `memmap.json`, with no agent call, no queue walk and
// no skill invocation anywhere in the loop.
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE, exactly like
// `anno-import.ts` -- there is no second store session anywhere in this
// file. It never names `node:sqlite`, never calls `openStore()`/`closeStore()`
// itself, and never imports `hostpath.ts`/`containerpath.ts`: the image range
// it needs arrives as plain numbers (`imageOrigin`, `imageByteLength`) that
// the caller has already derived from a loaded image, mirroring
// `dxa-blocks.ts`'s own header posture of reading only already-fetched facts
// a caller passes in.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: reading `listXrefs()`'s
// distinct target addresses, classifying each one (inside the loaded image,
// no `memmap.json` entry, or annotated) and writing the resulting comment
// through `setComment()`. `AUTO-01`'s own criterion -- no agent, no queue
// walk, no skill invocation -- is checked STRUCTURALLY over this module's own
// source in `anno-join.test.ts` (plan 37 task 3), not merely asserted here in
// prose.
//
// WHAT NOT TO DO:
//   - Never import anything under `src/skills/`. This function's entire
//     point is that annotating an address costs one mechanical call, not an
//     agent turn.
//   - Never spawn a child process from this module.
//   - `declined` stays at zero and its branch does nothing in THIS plan --
//     a later plan populates it once bank-state resolution lands. The field
//     is landed now so the shape of `JoinCounts`/`JoinDecision` does not
//     change under that later plan.

import { listXrefs, setComment } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { loadMemmap, selectMemmapEntry } from "./memmap-lookup.ts";
import type { MemmapEntry, MemmapSelection } from "./memmap-lookup.ts";

/** Raised when `runMemmapJoin()`'s own inputs cannot support a join at all --
 * currently only the zero-byte-image refusal below. Follows `anno-import.ts`'s
 * `AnnoImportError` construction idiom (a bare `Error` subclass, not
 * `AnnoStoreError`, since this module never touches the store's own
 * persistence). */
export class AnnoJoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnoJoinError";
  }
}

/** What one `runMemmapJoin()` call reports. `addressesConsidered` is always
 * the sum of the next four fields. */
export interface JoinCounts {
  addressesConsidered: number;
  annotated: number;
  skippedInImage: number;
  skippedNoMapEntry: number;
  declined: number;
  commentsChanged: number;
}

/** One address's own outcome. A skip or a decline always carries a non-empty
 * `reason` naming WHY in the join's own vocabulary; an annotation carries the
 * `label` it wrote. */
export interface JoinDecision {
  address: number;
  outcome: "annotated" | "skipped-in-image" | "skipped-no-entry" | "declined";
  reason?: string;
  label?: string;
}

export interface RunMemmapJoinArgs {
  imageOrigin: number;
  imageByteLength: number;
}

/**
 * Joins every DISTINCT `toAddress` `listXrefs()` holds against `memmap.json`,
 * in ascending address order. An address inside the caller's own loaded
 * image range is a program address, not a hardware/memory-map feature, and
 * is skipped WITHOUT a `memmap.json` lookup -- the membership test runs
 * BEFORE `selectEntry()` is called at all (D-37-12), so the guard is a
 * control-flow fact rather than a result-filtering one: `AUTO-03` says an
 * in-image address is "never looked up in memmap.json", a claim about what
 * runs, not merely about what the caller sees back. An address with no
 * containing `memmap.json` entry is skipped for that reason instead;
 * everything else is annotated with the selected entry's label via
 * `setComment()`. Running this twice over an unchanged store re-classifies
 * every address identically and reports `commentsChanged: 0` on the second
 * run, because `setComment()` itself reports `changed: false` for a
 * byte-identical repeat.
 *
 * `selectEntry` defaults to the real `selectMemmapEntry` and exists as an
 * injection point for exactly one reason: it is the seam that makes "never
 * looked up" checkable at all. Without it, the only available assertion is
 * on the RESULT, and a result-filtering implementation (compute the
 * selection, then discard it for an in-image address) would pass that
 * assertion while still violating the requirement. A test passes a counting
 * spy in its place and asserts zero calls for an all-in-image store.
 */
export function runMemmapJoin(
  handle: AnnoStoreHandle,
  args: RunMemmapJoinArgs,
  entries: readonly MemmapEntry[] = loadMemmap(),
  selectEntry: (address: number, entries: readonly MemmapEntry[]) => MemmapSelection | undefined = selectMemmapEntry,
): { counts: JoinCounts; decisions: JoinDecision[] } {
  if (args.imageByteLength === 0) {
    throw new AnnoJoinError(
      "runMemmapJoin refused: the image's own body length is 0 -- an image with no bytes has no range, and treating " +
        "it as a zero-width range at its own origin would silently make one address (the origin) read as in-image.",
    );
  }

  const xrefs = listXrefs(handle);
  const targets = [...new Set(xrefs.map((xref) => xref.toAddress))].sort((a, b) => a - b);

  // The inclusive image range, computed ONCE from the LoadedImage's own body
  // bytes (D-37-12) -- never from `totalBytes` (the file's own byte count,
  // which on the .prg route includes the two-byte load-address header and
  // would shift this whole range by two bytes) and never a caller-supplied
  // number pair that could silently widen or narrow the program's own
  // extent.
  const imageStart = args.imageOrigin;
  const imageEnd = args.imageOrigin + args.imageByteLength - 1;

  const decisions: JoinDecision[] = [];
  let annotated = 0;
  let skippedInImage = 0;
  let skippedNoMapEntry = 0;
  let commentsChanged = 0;

  for (const address of targets) {
    // THE GUARD: one early-return, before selectEntry() is ever called. A
    // single textual deletion of this block removes it cleanly -- that
    // deletion is plan 37-05's own observed-red control (row 4).
    if (address >= imageStart && address <= imageEnd) {
      skippedInImage += 1;
      decisions.push({
        address,
        outcome: "skipped-in-image",
        reason:
          `address $${address.toString(16)} lies inside the loaded image's own range ($${imageStart.toString(16)}-` +
          `$${imageEnd.toString(16)}) and is therefore a program address, never looked up in memmap.json`,
      });
      continue;
    }

    const selection = selectEntry(address, entries);
    if (selection === undefined) {
      skippedNoMapEntry += 1;
      decisions.push({
        address,
        outcome: "skipped-no-entry",
        reason: "no memmap.json entry contains this address",
      });
      continue;
    }

    const write = setComment(handle, { address, commentType: "line", text: selection.entry.label });
    annotated += 1;
    if (write.changed) commentsChanged += 1;
    decisions.push({ address, outcome: "annotated", label: selection.entry.label });
  }

  const counts: JoinCounts = {
    addressesConsidered: targets.length,
    annotated,
    skippedInImage,
    skippedNoMapEntry,
    declined: 0,
    commentsChanged,
  };
  return { counts, decisions };
}
