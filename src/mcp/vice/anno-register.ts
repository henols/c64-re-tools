// anno-register.ts -- the ONE authoritative, committed record of WHY a verb on
// the `anno_*` surface exists when the Phase 19 upstream procedure manifest
// does not classify it, and of the one verb whose route deliberately answers
// something OTHER than what the manifest's upstream contract described.
//
// WHY THIS FILE EXISTS (MCP-01, D-08). `MCP-01`'s whole claim is that the tool
// surface is DERIVED rather than CHOSEN: every verb the manifest disposes
// `curated` or `adapt-to-address-input` has a route, every verb it disposes
// `omit` is absent, and the verb with zero callers anywhere is not carried.
// `anno-derivation.test.ts` checks that half mechanically. This file is the
// OTHER half, and without it the derivation is a half-truth: four verbs on the
// surface appear in no manifest procedure at all, and one of them --
// `anno_search` -- is POSITIVELY REQUIRED by `STORE-06`. A derivation with an
// unrecorded remainder is not a derivation; it is a derivation plus an
// unwritten allow-list.
//
// D-08 rejected the alternative explicitly, and the reason is worth restating
// where it will be read: the manifest could have been amended to carry these
// four names, and must not be. It describes UPSTREAM at a pinned commit, and it
// carries its own re-sync trigger and per-procedure sha256 digests. Writing this
// project's verbs into it makes it describe US, and the next re-hash against a
// real upstream clone would then be comparing a record that had been quietly
// edited to agree with the thing it was supposed to audit.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR:
//   - every surface verb the manifest does not classify, with the named
//     consumers and the cited requirement ids that justify its existence;
//   - every surface verb the manifest DOES classify but whose route answers
//     something other than upstream's contract, recorded as a deviation so a
//     later reader does not mistake a deliberate reporting route for an
//     oversight.
// Nothing else in the repo may hold a second copy of this judgement. A consumer
// that needs it in another shape imports `ANNO_VERB_REGISTER` and reshapes it.
//
// WHAT MAKES THIS AN OBLIGATION RATHER THAN A DOCUMENT: `anno-register.test.ts`
// enumerates the surface, subtracts the manifest-classified names, and FAILS --
// naming the offending verb -- the moment a verb has no entry. D-08's wording is
// literal and is the wording the failure uses: a verb added later with no named
// consumer FAILS rather than being reviewed.
//
// WHAT NOT TO DO, named concretely:
//   - AN ENTRY CITING NO REQUIREMENT ID AND NO CONSUMER IS NOT AN ENTRY. The
//     enforcing test reports it by name. Do not "temporarily" add a verb with a
//     rationale and nothing else; a rationale is prose, and prose is what this
//     register exists to stop being the whole basis.
//   - Do not let this grow into an unbounded allow-list. Every entry added here
//     makes "derived from the manifest" a little more decorative. Four entries
//     and one deviation is the measured state at the time of writing; a fifth is
//     a decision, not paperwork.
//   - CITATION DISCIPLINE, carried over verbatim in intent from
//     `module-classification.ts`: `path` is ALWAYS repository-root-relative,
//     never relative to this directory, because consumers legitimately live
//     under `.planning/`, `scripts/` and `src/skills/` as well as beside this
//     file. `symbol` names what the consumer actually TAKES from the verb (an
//     imported binding, a store entry point, or -- for a documentation consumer
//     -- the identifier the cited line names); it is a CITATION, never a
//     justification. `line` is OPTIONAL AND ADVISORY: where present the
//     enforcing test asserts that line of that file contains `symbol` and never
//     trusts the number, so OMIT IT RATHER THAN GUESS.
//
// Deliberately a plain `.ts` module and never a `.test.ts` file, for the reason
// `module-classification.ts` gives: importing a `.test.ts` module for its
// exports also re-runs every `test(...)` it registers, as an import side effect.
// This module imports nothing at all.

/** One cited consumer of a registered verb. See the header's citation
 * discipline: `path` is repository-root-relative, `symbol` is a citation and
 * never a justification, and `line` is optional and advisory -- omit it rather
 * than guess. */
export interface AnnoVerbConsumer {
  path: string;
  symbol: string;
  line?: number;
}

/**
 * The two reasons a verb is in this register, kept DISTINGUISHABLE on purpose:
 * a reader must be able to tell "this verb has no manifest classification" from
 * "this verb has one and we answered it differently".
 *
 *   - "unclassified": the manifest's five procedures never mention the upstream
 *     name this verb derives from, so the derivation says nothing about it. Its
 *     existence rests entirely on the consumers and requirement ids below.
 *   - "manifest-deviation": the manifest DOES classify it, and it has a route,
 *     so the derivation check is satisfied -- but the route answers something
 *     other than what upstream's contract described. Recorded so the difference
 *     is a decision on the record rather than something a reader discovers by
 *     calling the verb and being surprised.
 */
export type AnnoVerbEntryKind = "unclassified" | "manifest-deviation";

/**
 * One registered verb.
 *
 * `verb` is the EXACT surface tool name, including the family prefix, because
 * the enforcing test compares it as a literal string against
 * `ANNO_TOOL_DEFINITIONS[].name` in both directions.
 *
 * `consumers` and `requirements` are the BASIS. At least one of each is
 * required -- not "one or the other", which is the weaker rule
 * `module-classification.ts` could afford because its subject was a module that
 * already existed. A verb is a public surface commitment; D-08 asks for a named
 * consumer AND a cited requirement, and the enforcing test asks for both.
 *
 * `rationale` states, in terms of what the verb DOES, why it is on the surface.
 *
 * `note` carries anything the basis cannot say -- a consequence measured
 * elsewhere, or the shape of the recorded finding this entry discharges.
 */
export interface AnnoVerbRegisterEntry {
  verb: string;
  kind: AnnoVerbEntryKind;
  consumers: readonly AnnoVerbConsumer[];
  requirements: readonly string[];
  rationale: string;
  note?: string;
}

export const ANNO_VERB_REGISTER: readonly AnnoVerbRegisterEntry[] = Object.freeze([
  // --- unclassified: the manifest's five procedures never name these ---
  {
    verb: "anno_add_scope",
    kind: "unclassified",
    consumers: [
      { path: "src/mcp/vice/anno-store.ts", symbol: "addScope" },
      { path: "src/mcp/vice/anno-tools.ts", symbol: "anno_add_scope" },
    ],
    requirements: ["STORE-01"],
    rationale:
      "Scopes are one of the five things STORE-01 requires the store to hold -- labels, comments, per-range " +
      "data typing, scopes and project enums -- and four of those five reached the surface through a " +
      "manifest-classified verb. Scopes did not, because the absorbed upstream procedures never used them: " +
      "they are how a routine's local symbols are kept out of the global namespace, which is an EXPORT-side " +
      "concern the procedures had no reason to touch. Without this verb the store persists a table no caller " +
      "on this surface can write, which is a stored capability with no route -- exactly the shape STORE-01 " +
      "was written against.",
  },
  {
    verb: "anno_remove_scope",
    kind: "unclassified",
    consumers: [
      { path: "src/mcp/vice/anno-store.ts", symbol: "removeScope" },
      { path: ".planning/phases/28-the-store-core/28-REVIEW.md", symbol: "removeScope" },
    ],
    requirements: ["STORE-01"],
    rationale:
      "The inverse of the overlap refusal, and the register's clearest case of a verb existing because a " +
      "recorded finding demanded it rather than because a procedure used it. 28-REVIEW's round-6 WARNING is " +
      "the named consumer: the store refuses any scope overlapping an existing one, and had no removal verb " +
      "for a scope, a label, a comment, a cross-reference or an enum. A write verb whose mistakes cannot be " +
      "undone is a data-loss surface even when every individual refusal is correct, so the inverse ships in " +
      "the same phase as the refusal.",
    note:
      "The measured consequence, which is why this is not merely tidiness: `anno_add_scope($1000, $ffff)` -- " +
      "ONE TRANSPOSED END, arriving from a transport whose validator returns its input unchanged -- makes " +
      "every future scope from $1000 upward permanently unaddable. The only route back was `revertTo`, and " +
      "the snapshot ring is bounded at MAX_SNAPSHOT_REVISIONS: 32 further writes and the store's own " +
      "published floor refuses, by name, the revision that would undo it.",
  },
  {
    verb: "anno_search",
    kind: "unclassified",
    consumers: [
      { path: "src/mcp/vice/anno-derive.ts", symbol: "searchAnnotations" },
      { path: "src/mcp/vice/anno-tools.ts", symbol: "anno_search" },
      // Re-pointed at the v0.7.0 close, 2026-09-01: `/gsd-complete-milestone`
      // `git rm`s `.planning/REQUIREMENTS.md` and archives it under
      // `milestones/<version>-REQUIREMENTS.md`. The cited text is unchanged --
      // this names the file STORE-06 is actually declared in today, so
      // DIRECTION 5's "every path exists" check stays a real check.
      { path: ".planning/milestones/v0.7.0-REQUIREMENTS.md", symbol: "STORE-06" },
    ],
    requirements: ["STORE-06"],
    rationale:
      "POSITIVELY REQUIRED by STORE-06, which names search across labels, comments and instructions as one " +
      "of its two halves and says in terms that it is built on the surviving decoders with the old route " +
      "gone rather than kept as a fallback. The manifest cannot classify it: the upstream call it derives " +
      "from appears in no absorbed procedure, so the derivation is silent and the requirement is the whole " +
      "basis. That is the second of the two admissible bases and not a weaker one -- it is the strongest " +
      "kind of entry this register holds, because a requirement id is checkable against a committed document " +
      "whereas a consumer can be deleted by the next refactor.",
    note:
      "This entry is load-bearing for a check in another file. The skill-coverage script's non-vacuity " +
      "control is re-pointed onto this verb (C-5): it is STORE-06's named requirement AND it lives here, so " +
      "if it ever silently leaves the surface, BOTH the coverage control and this register's completeness " +
      "relation fire. Do not remove this entry to make a count come out.",
  },
  {
    verb: "anno_update_project_enum",
    kind: "unclassified",
    consumers: [
      { path: "src/mcp/vice/anno-store.ts", symbol: "updateProjectEnum" },
      { path: "src/mcp/vice/anno-tools.ts", symbol: "anno_update_project_enum" },
    ],
    requirements: ["STORE-01"],
    rationale:
      "Project enums are STORE-01's fifth stored kind. The manifest classifies creation and application " +
      "(both `curated`, from the routine and symbol procedures) but not update, because the absorbed " +
      "procedures create an enum once from a fresh reading and never revise one. This project does revise " +
      "them: the register-bit and enum generators emit a variant set from a data file, and a regenerated " +
      "set must be able to REPLACE an earlier one rather than collide with it. Without update, the only " +
      "route to a corrected variant set is delete-and-recreate -- and delete is the one verb with zero " +
      "callers anywhere, which MCP-01 requires this surface not to carry.",
    note:
      "This is the entry that explains why the absent delete verb costs nothing. The delete route existed " +
      "upstream to support exactly the delete-and-recreate cycle update makes unnecessary; carrying update " +
      "instead is what lets MCP-01's zero-caller clause hold without losing a capability.",
  },

  // --- manifest-deviation: classified, routed, and answering differently ---
  {
    verb: "anno_save_project",
    kind: "manifest-deviation",
    consumers: [
      { path: "src/mcp/vice/anno-store.ts", symbol: "currentRevision" },
      { path: "src/mcp/vice/anno-tools.ts", symbol: "anno_save_project" },
    ],
    requirements: ["STORE-04", "MCP-04"],
    rationale:
      "The manifest disposes this verb `curated` in two procedures and it has a route, so the derivation " +
      "check is satisfied -- but THE ROUTE PERFORMS NO WRITE. It reports the store's current revision and " +
      "states the no-write property in its own body. Upstream's contract was an explicit flush of unsaved " +
      "editor state; this store has none, because STORE-04 makes every mutating verb commit and fsync its " +
      "own write before it returns. Durability belongs to the store, not to a verb an agent has to remember " +
      "to call. Recorded HERE, as a deviation, because a route that reports rather than writes is precisely " +
      "what a later reader would otherwise diagnose as an oversight and 'fix'.",
    note:
      "Routed honestly rather than refused, which is the MCP-04 half. Refusing an absorbed procedure's own " +
      "step would break the procedures this project inherited for no gain; answering it with the revision " +
      "gives the caller something genuinely useful -- the value a subsequent compare-and-swap needs, and the " +
      "confirmation that a pass advanced the store as far as expected.",
  },
]);

/** The registered entry for a verb, or `undefined`. Exported so a consumer
 * asking "why is this verb here?" reads the record rather than re-deriving it,
 * and so the enforcing test and any later caller share one lookup. */
export function annoRegisterEntryFor(verb: string): AnnoVerbRegisterEntry | undefined {
  return ANNO_VERB_REGISTER.find((entry) => entry.verb === verb);
}
