#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-details.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-details.mts
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: the composed "everything this
// project knows about ONE address" answer -- labels, comments, the containing
// typed range, and the cross-references that reach it -- assembled from four
// reads of the owned annotation store and DISCLOSED as a composition in the
// body it returns.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Its analog composed the same four facts from four MCP round trips to an
// external analyser, because that analyser's own address-details tool returned
// an out-of-range refusal for EVERY address on a full 64K project. The
// composition's doc block recorded the property that made it trustworthy: the
// defect was "unreachable by construction, not merely avoided by a heuristic".
// That property is carried forward here and strengthened -- there is no
// external analyser left to be unreachable FROM. The four reads are four
// function calls against a store this project owns, in one process, with no
// socket, no child process and no session to go stale between them.
//
// The composition is DISCLOSED rather than passed off as a single stored
// answer: the body carries `composed_client_side` and a `composed_from` list
// naming all four sources, so a reader can always tell a composition from
// something the store held whole. That disclosure is the analog's own shape and
// is deliberately kept verbatim in intent.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never scan for the containing range with a start/end bracket comparison
//     loop. `resolveAt()` over `paintIndexOf()` is the single arbiter --
//     narrowest range wins, and among equally short ones the later-inserted one
//     -- cross-validated at all 65,536 addresses against an
//     independently written implementation. A second lookup rule here would be
//     a second answer, and the disagreement would be invisible because both
//     look authoritative.
//   - Never write anything. This module is on a read path and is held to
//     `anno-derive.mts`'s never-cache rule by the same structural control: no
//     SQL write verb, no filesystem write call, no persistence binding.
//   - Never import `container-guard.mts` -- this composition is proxy-local.
//   - Never return an empty array for something that could not be answered. A
//     component with no answer comes back as `{available:false, reason}`, so an
//     address that genuinely has no comments is distinguishable from a question
//     this composition could not put. An address that simply has no labels IS a
//     genuine empty list and stays one.
//   - Never add a second address parser. `parseStoreAddress` validates the one
//     argument this module takes.
import { listComments, listLabels, listRanges, paintIndexOf } from "./anno-store.mjs";
import { NO_ROW, resolveAt } from "./anno-index.mjs";
import { parseStoreAddress } from "./anno-types.mjs";
import { crossReferencesTo } from "./anno-derive.mjs";
/** The four sources, named in the order they are read. This array IS the
 * `composed_from` disclosure -- there is no second hand-typed copy for the two
 * to drift apart. */
export const ADDRESS_DETAIL_SOURCES = Object.freeze([
    "listLabels",
    "listComments",
    "resolveAt over paintIndexOf",
    "crossReferencesTo",
]);
function hex4(address) {
    return `$${address.toString(16).padStart(4, "0")}`;
}
/**
 * Everything this project knows about `address`, composed from four store
 * reads.
 *
 * 1. LABELS bound at the address (`listLabels`).
 * 2. COMMENTS at the address, both placements (`listComments`).
 * 3. THE CONTAINING RANGE, resolved through `resolveAt()` over
 *    `paintIndexOf()` -- narrowest-range-wins, never a bracket scan.
 * 4. THE CROSS-REFERENCES that reach it (`crossReferencesTo`), derived from the
 *    caller's own bytes on this call and never cached.
 *
 * Nothing is written on any path.
 */
export function composeAddressDetails(handle, image, origin, address) {
    const at = parseStoreAddress(address, { what: "address" });
    const labels = listLabels(handle).filter((row) => row.address === at);
    const comments = listComments(handle).filter((row) => row.address === at);
    const rowId = resolveAt(paintIndexOf(handle), at);
    const range = rowId === NO_ROW
        ? {
            available: false,
            reason: `no typed range covers ${hex4(at)}: the paint index resolves it to nothing, which means this address sits in a gap ` +
                "between the ranges a human has typed rather than in an untyped part of one. Type a range covering it with " +
                "anno-store.mts's setDataType to make this component answerable.",
        }
        : composeRange(handle, rowId, at);
    const crossReferences = image.length === 0
        ? {
            available: false,
            reason: `cross-references to ${hex4(at)} are DERIVED from program bytes on every query and no bytes were supplied: the store ` +
                "holds no program image, so this component is answerable only when the caller names the image it wants derived " +
                "from. The stored non-derivable rows alone are readable through anno-store.mts's listXrefs.",
        }
        : { available: true, value: crossReferencesTo(handle, image, origin, at) };
    return {
        address: at,
        labels,
        comments,
        range,
        crossReferences,
        composed_client_side: true,
        composed_from: ADDRESS_DETAIL_SOURCES,
    };
}
/** The row `resolveAt()` named. Looked up BY ID in `listRanges()`'s own output
 * -- an id-equality match, never a start/end bracket comparison, so the
 * arbiter's verdict is reported rather than re-derived. */
function composeRange(handle, rowId, at) {
    const row = listRanges(handle).find((candidate) => candidate.id === rowId);
    if (row === undefined) {
        return {
            available: false,
            reason: `the paint index resolved ${hex4(at)} to range id ${rowId}, but no row with that id is in the range table -- the index and ` +
                "the table disagree, which should be impossible because the index is rebuilt from the table on every call. Reported rather " +
                "than silently answered as an absent range, because those are different facts.",
        };
    }
    return { available: true, value: row };
}
