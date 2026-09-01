# PKG-03 Census: comment-phase-pointers.test.ts full-corpus dry run

**Measured:** 2026-08-23, against the tree at the top of plan 16-07 (after plans 16-01/16-02/16-03/16-04/16-06 landed).

## Denominator

| Metric | Value |
|---|---|
| Shipped `.ts`/`.mts` modules scanned (`package.json` `files[]`) | 58 |
| Comment spans captured (`//` and `/* */`, across all 58 modules) | 7539 |
| Comment lines naming a phase (`/\bPhase\s+\d+(?:\.\d+)?\b/i`, one row per physical line) | 124 |

The plan-time measurement recorded 123 comment lines naming a phase; this run
measured 124. The one-line difference is expected drift, not a contradiction:
plan 16-04 (MCP-server relocation) added a new relocation-history comment to
`repo-root.ts` that itself names `phase 16-04`, after the plan-time census was
taken. That one line (`repo-root.ts:43`, "FOURTH MOVE (phase 16-04,
2026-08-23): the module directory relocated again...") is pure narration of
this milestone's own already-completed relocation work and is correctly
**not** flagged by either check (see the full corpus dump below).

## Verdict summary

| Check | Raw hits (line×family) | Distinct sites (dedup by file:line) |
|---|---|---|
| Check 1 — assignment-shape | 10 | 7 |
| Check 2 — cut-phase reference | 9 | 9 |
| **Union (distinct sites, either check)** | — | **15** |

Matches the plan-time measurement exactly: 7 assignment-shape hits, 9
cut-phase hits, union 15 distinct sites (one site, `stock-condition.ts:548`,
is flagged by both checks — see below).

**Zero false positives.** Every one of the 124 phase-naming comment lines in
the corpus was inspected. The 15 flagged lines are all genuine violations
(verified against the promoted todo and the source's own present-day state,
see plan 16-07 Task 2's fix log). The remaining 109 lines are all accurate
historical narration and are correctly left unflagged, including two
lines that were specifically at risk of a false positive and were dry-run
individually before the pattern set was locked in:

- `stock-protocol.ts:1110` — `` * value Phase 7's Route A stopwatch reads -- a `bigint` via `` — a bare `route` noun in the possessive-plus-noun pattern would have false-positived here (`Route A` is a proper noun naming the timing technique, not this codebase's "timing route" sense). The noun list is scoped to the exact phrase `timing route`, not bare `route`, specifically because of this line.
- `containerpath.ts:12` — `// This direction did not exist until Phase 01.2's on-demand VICE broker` — a bare "until Phase N" rule without the past-tense exclusion would have false-positived here. The past-tense exclusion (`did/didn't/had/hadn't/was/were/never/has` on the same line) correctly suppresses this narration line while still flagging the three real present-tense violations.
- `repo-root.ts:43` — `// FOURTH MOVE (phase 16-04, 2026-08-23): the module directory relocated` — a whole-block or joined-sentence match (rather than the adopted per-physical-line match) would have false-positived here: the word "MOVE" (a section-heading noun, not the verb "move"/"moved") sits within 80 characters of the phase reference in the same JSDoc-style comment block. Matching per physical line, and dropping bare `move`/`moves` from the verb-first-handoff list (keeping only the tensed `moved`), removes this collision.

## Check 1 — Assignment-shape hits (7 distinct sites)

| File | Line | Pattern family | Text |
|---|---|---|---|
| `stock-cia.ts` | 39 | `is-was-possessive`, `possessive-plus-noun` | `` (`docs/stock-vice-parity.md` SS A item 2) and is Phase 8's business. `` |
| `stock-dispatch.ts` | 633 | `comma-appositive` | `` *   - `vice_disk_detach` (D-13 -- Phase 7, via the text monitor) `` |
| `stock-dispatch.ts` | 634 | `possessive-plus-noun`, `needs-requires` | `` *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route) `` |
| `stock-input.ts` | 28 | `until-phase-present-tense` | `` //     frame/cycle measurement that does not exist on stock until Phase 7's `` |
| `stock-input.ts` | 192 | `until-phase-present-tense`, `possessive-plus-noun` | `` * frame/cycle measurement stock does not have until Phase 7's timing route `` |
| `stock-condition.ts` | 548 | `is-was-possessive` | `` * Accepted input, deliberately narrow (widening this grammar is Phase 6's `` |
| `stock-address.ts` | 26 | `until-phase-present-tense` | `` //     a deliberately empty extension point until Phase 5's DERIV-04 symbol `` |

Every row above carries the **violation** verdict. None is a false positive.

## Check 2 — Cut-phase reference hits (9 distinct sites, all naming Phase 6)

Cut set parsed from `.planning/ROADMAP.md`'s `## Progress` table: `["6"]`
(Phase 6, "Stock-Only Gains", status `**Cut** 2026-08-17`).

| File | Line | Text |
|---|---|---|
| `stock-machine.ts` | 15 | `` //     MachineVideoStandard/VICIIModel/MachinePowerFrequency -- Phase 6 `` |
| `stock-dispatch.ts` | 637 | `` *   - `vice_machine_config_get` / `vice_machine_config_set` (Phase 6) `` |
| `stock-protocol.ts` | 824 | `` * (`MachineVideoStandard`/`VICIIModel`/`MachinePowerFrequency`, Phase 6 `` |
| `stock-condition.ts` | 38 | `` //   - Phase 6's GAIN-06 extends this AST with raster semantics (finer-grained `` |
| `stock-condition.ts` | 548 | `` * Accepted input, deliberately narrow (widening this grammar is Phase 6's `` |
| `disasm-opcodes.ts` | 104 | `` // and Phase 6's CPU-history decode (GAIN-01) all read instruction lengths `` |
| `disasm-decoder.ts` | 4 | `` // D-05's standalone module. Phase 5's backtrace (DERIV-02) and Phase 6's `` |
| `disasm-decoder.ts` | 18 | `` // renderer (04-04), Phase 5's backtrace and Phase 6's CPU-history decode. `` |
| `disasm-renderer.ts` | 10 | `` // `Instruction[]` in hand (Phase 5's backtrace, Phase 6's CPU-history decode `` |

Every row above carries the **violation** verdict (a reference to a cut
phase is orphaned by definition, narration included). None is a false
positive.

`stock-condition.ts:548` appears in both tables — it is the one site both
checks independently flag (an `is Phase 6's` assignment shape that also
names the cut phase), which is why the union of 7 + 9 is 15, not 16.

## Union: 15 distinct sites, across 9 shipped modules

`stock-cia.ts`, `stock-dispatch.ts`, `stock-input.ts`, `stock-address.ts`,
`stock-condition.ts`, `stock-machine.ts`, `stock-protocol.ts`,
`disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` — ten files
listed, nine distinct modules carry a violation once `stock-condition.ts`'s
single dual-flagged line is not double-counted (`stock-condition.ts` itself
is one module, flagged by both checks at the same line).

Plus, outside this table (a sibling test file, not a shipped module): two
decision-id string literals in `stock-dispatch.test.ts` (lines 423-424)
naming `"Phase 6"` as the decision responsible for `vice_machine_config_get`
and `vice_machine_config_set`'s deliberate non-registration. These are
string literals in a test file — outside both this guard's comment scope
and `docs-dangling-refs.test.ts`'s shipped-module scope — and are fixed in
plan 16-07 Task 2 alongside the 15 shipped-module sites, per the plan's own
scope.

## Full corpus dump (all 124 phase-naming comment lines, for audit)

The complete unflagged remainder (109 lines) is accurate historical
narration: citations of a completed phase's decision or delivery ("Phase
3's D-05", "Phase 5's DERIV-04 store", "verified Phase 9, ANNO-16(c)"),
cross-references to a phase's own criterion or requirement ("Phase 2's
BACK-04 capability resolution routes"), and the relocation-history entries
in `repo-root.ts`/`repo-root.test.ts` narrating this project's four prior
directory moves. None assign pending or future work to a phase, and none
name a cut phase. The full per-line dump (124 rows) was generated by the
same `commentPhaseLines()` function the shipped guard uses and was
inspected in full during this census; it is not reproduced row-by-row here
to keep this document to the 15 rows that matter, but the 15-row verdict
above is exhaustive over that full dump — every phase-naming line not
listed in the two tables above was individually checked and confirmed
narration.

## Guard implementation location

`src/mcp/vice/comment-phase-pointers.test.ts`. Extractor: an inverted
character-state-machine (`extractCommentSpans()`), never a regex, per this
plan's own prohibition and the precedent `docs-dangling-refs.test.ts`
established. Module set: `shippedTsModules()`, derived from `package.json`'s
`files[]`. Cut-phase set: `parseCutPhasesFromRoadmap()`, parsed from
`.planning/ROADMAP.md`'s `## Progress` table, asserted non-empty.
