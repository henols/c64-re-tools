# Phase 45: Decomposition to Closure, Disagreement First - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply a **closure bar** to the annotation of the C64 `.prg` fixtures that are
**already committed** in this repo. Nothing here is new architecture: the phase
runs on `.annostore` (v0.7.0) and the runtime evidence layer (v0.9.0). What is
new is the bar itself, and the requirement that `anno_evid_disagreements` be a
**structural input** to the completeness gate rather than a cross-check reported
beside it.

Delivered: every byte of each committed fixture carries a type; every code entry
point carries a real name and a purpose comment naming function, inputs, outputs
and side effects; every referenced non-hardware address resolves to a documented
symbol **or** to an explicit recorded decline; hardware register writes render as
named enum members; and a completeness report that cannot render at all without
the disagreement query as an input.

**Not in scope:** the purpose-built synthetic subject (Phase 48, with its
detector — owner decision, Strategy B), the multi-file export (Phase 47), the
lossless-export invariant (Phase 46). A plan that waits for the new subject to
start decomposition has mis-read the sequencing.

**If a plan here proposes a new module, that is a signal to re-read**
`.planning/codebase/ARCHITECTURE.md`. The one deliberate exception is the
completeness report itself, which cannot be `anno-coverage.ts` (see D-05).

</domain>

<decisions>
## Implementation Decisions

### Where the annotated store lives

- **D-01:** **One store per fixture.** Each committed `.prg` gets its own
  `.annostore`. Matches how the fixtures already live (per-engine directories,
  each with its own provenance README), keeps a per-fixture completeness report
  trivially scoped, and one fixture's churn never touches another's artifact.
  — **Reversibility:** costly — collapsing many stores into one later means
  re-scoping every committed artifact and every gate that reads them.

- **D-02:** **Committed form is a JSON export plus a committed importer**, not a
  binary `.annostore` and not "regenerated only". *(User said "you decide";
  chosen because a binary sqlite cannot show a purpose-comment change in a diff,
  which is exactly what D-03's split provenance exists to make visible.)* Note
  for research: no general store-JSON importer exists today —
  `anno_import_ghidra_export` is Ghidra-shaped only — so this phase builds one,
  and the export/import round trip is itself testable.
  — **Reversibility:** one-way — the export becomes a committed on-disk format
  every later phase's fixtures are written in; changing it later needs a
  migration of every committed fixture artifact.

- **D-03:** **Split provenance: derived regenerates, authored is frozen.**
  Block types, cross-references and enum bindings regenerate deterministically
  from the bytes and must reproduce byte-identically (the
  `fixtures/coverage/make-coverage-fixtures.mjs` idempotence bar, enforced the
  same way — `git status --porcelain` empty after a re-run). Names, purpose
  comments and recorded declines are **authored**, reviewed once, then frozen;
  no regeneration claim is made about them. The gate proves the derived half
  reproduces and the authored half is present.
  — **Reversibility:** costly — the two provenance classes have to be
  distinguishable in the committed artifact, so the export schema carries them;
  merging them later loses the distinction irrecoverably.

### The completeness report

- **D-04:** **A skill with a dedicated script — NOT an MCP tool.** Explicit user
  redirect; all three MCP/CLI-shaped options were rejected in favour of a skill
  script.

- **D-05:** It is **not** `anno-coverage.ts` and must not extend it. Two
  independent reasons, both binding: that module's own trap 1 forbids deriving
  any measure from the store's block-type listing ("a completeness number
  sourced from the block table measures the annotator's bookkeeping, not the
  annotation"), and there is a standing owner instruction not to extend, verify,
  or plan gap closure against the coverage instrument.

- **D-06:** **The script does not need the broker.** Settled factually during
  discussion, not assumed: `anno-cli.ts` and `anno-store.ts` reach no broker, no
  `host_tool` op and no `forwardToVice()` — the store is `node:sqlite`
  in-process. Nothing in the completeness path spawns an external binary, so the
  container-out seam requirement does not apply to it.

- **D-07:** **The script reaches store data through a fifth `anno` CLI verb.**
  This **deliberately supersedes D-14** (2026-08-29, "FOUR VERBS. THAT IS THE
  WHOLE SURFACE"). Precedent exists: plan 43-06 already raised that cap
  three → four for `evid-disagreements`. The guard that will bite is
  `anno-verb-coverage.test.ts:59`'s `REAL_VERBS` array — it must be raised in
  the same change, and the supersession recorded rather than slipped through.
  — **Reversibility:** costly — a published CLI verb is a surface consumers can
  script against.

- **D-08:** **`routine-queue-walker` owns the script.** Not a new skill. It
  already exists to drive an annotation store's backlog to closure, rebuild the
  queue after every pass, and report every leftover — which is criterion 3's job
  almost verbatim. The completeness report supplies the numeric stop condition
  it currently lacks.

- **D-09:** **The disagreement input is made structural TWO ways**, because
  either alone is insufficient. *(User said "you decide".)*
  1. A **required argument with no default** that throws by name when absent —
     the same shape `evid-reconcile.ts` already uses (both classifications
     arrive as data the caller fetched; the module never fetches).
  2. A **required output-schema field** that only that input can populate, with
     the report refusing to render without it.
  A required argument alone is satisfied by passing an empty array, which would
  make "no disagreements" and "no disagreement query" indistinguishable — the
  exact silent pass criterion 1 forbids. Verify by a planted control **observed
  going red**, per this milestone's stated discipline: asserting a fix is
  present proves nothing; making the failure happen does.

- **D-10:** **The output carries the soundness asymmetry two ways**, both
  required.
  1. **Aggregate:** reuse `evid-reconcile.ts`'s four buckets verbatim —
     `blockCoveredNeverObservedCount` stays its own named line against an
     explicit `denominator`, never folded into a code or data total, never
     combined into a percentage or rate.
  2. **Per range:** every typed range carries how it was typed —
     `observed-executing` / `byte-derived` / `authored` — so a reader can see
     which `data` claims rest on evidence and which on inference. This feeds
     Phase 46's provenance carry (`BUILD-05`) directly.

- **D-11:** **Criterion 1's word "table" maps onto the four split layouts** —
  `lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`. The frozen
  twelve-member `DATA_TYPES` vocabulary has **no `table` member** and is not to
  be widened. The report names those four as "table" in its rendered output so a
  reader sees the criterion's own word without the schema changing.

### How the annotation gets done

- **D-12:** **Derive first, then agent closure.** dxa + Ghidra import fills block
  types and cross-references mechanically via the route that already shipped in
  v0.8.0 (narrowest-range-wins, in-image addresses skipped, `$01` bank state
  resolved before address, decline-with-reason where bank state is
  path-dependent). The agent pass then does only what derivation cannot: names
  and purpose comments. This maps exactly onto D-03's split — the derived half
  of the artifact is literally the derivation's output.

- **D-13:** **Execution subset is named up front, and non-execution is rendered,
  not hidden.** *(User said "you decide".)* Every fixture with a genuine entry
  point gets a live run under Phase 33's reproducible-run protocol, `memmapshow`
  ingested and its disagreements cashed. Fixtures with nothing meaningful to
  execute are reported **by name as "not executed"** — never as a clean bill of
  health. This is the anti-vacuity guard for criterion 2: a fixture with no run
  has no disagreement rows and would otherwise pass vacuously.
  Research must fix the exact list; the candidates by content are
  `dxa/tracer.prg`, `dxa/fixture.prg`, `ghidra/bank.prg`,
  `ghidra/bank-path-dependent.prg`, `ghidra/charset-phantom.prg` and
  `export-asm/smc.prg`, with `dxa/basic-stub.prg`, `petcat/computed-sys.prg` and
  `petcat/not-basic.prg` the likely declared non-executed set.

- **D-15:** **The enum route is rebuilt in `anno-enum-gen.ts`, over this project's own
  disassembler.** Restore a `generateEnums()`-shaped fetch over
  `anno_disassemble` / `anno_search` rows, feeding the surviving
  `pairSearchRows()` (the D-23 adjacent-pair rule) and `planEnumsForPairing()`
  (D-20: one variant per distinct value the program actually writes, never a
  256-entry table), installing through `anno_create_project_enum` +
  `anno_apply_enum_usage`. The heuristics were deliberately preserved as live
  code for exactly this; only the route was deleted.
  — **Reversibility:** costly — see the ANNO-13 flag below; this changes what
  the project claims is shipped.

*(Number `D-14` is deliberately unused in this document: it is already the id of
this project's 2026-08-29 four-verb CLI decision, cited above and superseded by
D-07. Reusing it here would make a citation ambiguous.)*

### Where enum bits render

- **D-16:** **Both surfaces, one owning decoder.** The ACME export
  (`anno-export-asm.ts`) carries the **proof** — it is already under a real-ACME
  byte-diff oracle, so a wrong decomposition fails to assemble or fails the
  diff. `anno_disassemble` output carries the **readability** — it is where a
  Claude session actually reads the code. One decoder, two renderers; the
  `anno_*` family's existing one-module-two-surfaces shape.

- **D-17:** **A multi-bit write renders as OR-ed named constants AND a decoded
  comment** — both, not either. Shape:

  ```
  lda #VIC_SCREEN_1024 | VIC_CHARSET_2048   ; screen=$0400, charset=$0800
  ```

  The OR-ed constants reassemble to the identical byte, so the byte-diff oracle
  proves the decomposition is arithmetically correct rather than merely
  plausible; the comment carries the human decode. Neither half alone satisfies
  criterion 5 — a bare hex constant with a comment still "emits one hex
  constant", and bare constants without a comment are not readable at a glance.

### Claude's Discretion

Three gray areas were identified and **not** selected for discussion. Research
and planning have latitude here, but each carries a named constraint:

- **Fixture set for typing.** All nine committed `.prg` fixtures are in scope for
  criteria 1, 3 and 4. (Execution scope is separately settled by D-13.)
- **How a decline and an accepted disagreement are recorded.** Criteria 2 and 4
  both need a machine-checkable *negative* statement. **Constraint from the
  roadmap:** `.annostore`'s importer already declines with a reason — *match that
  convention rather than inventing a second one.* Whether one mechanism serves
  both criteria or two are needed is open.
- **Which auto-name prefixes count as survivors.** Criterion 3 names `p_XXXX`
  and `l_XXXX`. But `anno-coverage.ts`'s `AUTO_NAME_PREFIX_RE` already covers
  **eleven** prefixes (`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`), and dxa emits
  `lNNNN` labels of its own shape. Which set the survivor search uses materially
  changes how much work the phase is. Resolve against the actual label
  population in the derived stores, not against the roadmap prose alone.

### Flags the planner must not lose

1. **`ANNO-13` is being partially reclaimed.** `.planning/PROJECT.md` records the
   generated-enum and symbol-round-trip capabilities as **withdrawn**, with
   "no phase owns their return". D-15 above makes Phase 45 own the **enum half**.
   `ANNO-14` / `ANNO-15` (the symbol round trip, `export-lbl` / `import-lbl`)
   stay unowned. The withdrawal notice must be updated to say so rather than
   left to contradict the code.
2. **The historical `D-14` four-verb cap (2026-08-29) is superseded, deliberately** (see D-07). Record the
   supersession; do not let it read as an oversight.
3. **Criterion 5's multi-bit demo has exactly one possible home.** MEASURED
   during discussion by scanning every fixture's bytes for VIC register
   accesses: **only `fixtures/ghidra/charset-phantom.prg` writes `$D011` and
   `$D018`** (`8d11d0`, `8d18d0`). Every other fixture touches `$D020`, `$D021`
   or `$01` only. There is no second candidate among the committed fixtures.
4. **`charset-phantom.prg` is 4097 bytes**, mostly charset data — so it is
   simultaneously the criterion-5 fixture and the fixture where "every byte
   typed" means typing a 4K table. Size it accordingly.
5. **`bank-path-dependent.prg` is criterion 4's own fixture** — the roadmap says
   it "already exists precisely because it contains one". Pitfall 5 (bank-state
   collapse) and Pitfall 12 (fabricated indirect targets) both land here, and
   both are prevented by the same discipline: **decline with a reason.** A
   confident wrong symbol is worse than an absent one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and milestone definition
- `.planning/ROADMAP.md` § "Phase 45: Decomposition to Closure, Disagreement First" — goal, five success criteria, and the three Notes (no new architecture; existing fixtures are the subject; decline-with-a-reason)
- `.planning/ROADMAP.md` § "Sequencing Rationale (v1.0.0)" — why decomposition is first and why it does not wait for the new subject
- `.planning/ROADMAP.md` § "Standing Constraints"
- `.planning/REQUIREMENTS.md` — `DECOMP-01`..`DECOMP-04`, and the amendment table row explaining `DECOMP-01`'s appended gate condition
- `.planning/PROJECT.md` — the v0.7.0 / v0.8.0 / v0.9.0 paragraphs, and the `ANNO-13`/`14`/`15` withdrawal note
- `.planning/codebase/ARCHITECTURE.md` § "What already exists that this milestone builds on"

### The disagreement oracle (criterion 2 — the milestone's named most-dangerous gap)
- `src/mcp/vice/evid-reconcile.ts` — the four buckets, the union-across-runs prohibition, and the five named traps. **Read the header before designing the report.**
- `src/mcp/vice/evid-ingest.ts` — the one positive fact the evidence layer is licensed to assert; why absence of a row is not an assertion
- `src/mcp/vice/anno-cli.ts:1470-1510` — `printEvidDisagreementsReport()`, the existing rendering discipline (every measure under its own heading, never a combined figure, `denominator` beside every count)

### The type vocabulary and its boundary
- `src/mcp/vice/anno-types.ts` — `DATA_TYPES`, the frozen twelve
- `src/mcp/vice/anno-types.test.ts:63-107` — the twelve written out by hand, and why that expectation is not derived from its subject
- `src/mcp/vice/block-class.ts` — the ONE place a store block-type string may be compared; the lowercase-collision loss recorded in its header

### What the completeness report must NOT be
- `src/mcp/vice/anno-coverage.ts` — header, especially trap 1. Also the source of `AUTO_NAME_PREFIX_RE` (eleven prefixes) and `scanIndirectDispatch()`, which Phase 48 reuses.

### The CLI surface being extended
- `src/mcp/vice/anno-cli.ts:11-45` — the four-verb cap (D-14, 2026-08-29) and the record of what was removed and why
- `src/mcp/vice/anno-verb-coverage.test.ts:53-59` — `REAL_VERBS`, the guard that bites; and the comment recording the earlier three → four raise

### The enum route being rebuilt
- `src/mcp/vice/anno-enum-gen.ts:7-40` — what left, what stayed, and where the route returns. The surviving heuristics: `variantNameFor()`, `pairSearchRows()` (D-23), `planEnumsForPairing()` (D-20)
- `src/mcp/vice/anno-regbits-gen.ts` — the curated address → bit-name table, the `OVERRIDES` and why memmap.json alone is insufficient; `anno-regbits.json` is generated-but-committed, never hand-edited
- `src/mcp/vice/anno-export-asm.ts` — the render surface carrying the byte-diff proof

### The fixtures themselves (provenance — read before annotating)
- `src/mcp/vice/fixtures/ghidra/README.md` — `bank.prg` byte layout, the 2026-09-04 correction about `BinaryLoader` not stripping the `.prg` header, and the MEASURED reference-dump lines
- `src/mcp/vice/fixtures/dxa/README.md` — `tracer.prg`'s exact byte layout and the MEASURED dxa command and output
- `src/mcp/vice/fixtures/coverage/README.md` — the "generated, never hand-written, deterministic and idempotent" precedent D-03 partially adopts
- `src/mcp/vice/fixtures/README.md` — the frozen-evidence and planted-violation conventions

### The skill being extended
- `src/skills/routine-queue-walker/SKILL.md` — the existing backlog-to-closure playbook
- `src/skills/c64-memory-mapping/SKILL.md` — the register/bit tables criterion 5 names against

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`evid-reconcile.ts`** — criterion 2's oracle is already built and already
  reports disagreement-first with four named buckets and an explicit
  denominator. This phase **cashes** it; it does not rebuild it.
- **`anno-enum-gen.ts` heuristics** — `variantNameFor()` (pinned by injectivity
  tests across all 256 values), `pairSearchRows()`, `planEnumsForPairing()`. All
  survive as live code. Only the fetch-and-install route needs writing.
- **`anno-regbits.json`** — the committed, banner-marked address → bit-name
  table criterion 5's decode reads against. Generated by `anno-regbits-gen.ts`;
  never hand-edited.
- **`anno-export-asm.ts` + its real-ACME byte-diff oracle** — the existing proof
  mechanism D-15 leans on. A wrong bit decomposition fails the diff.
- **The v0.8.0 dxa + Ghidra derivation route** — D-12's first half already ships,
  including decline-with-a-reason on path-dependent bank state.
- **`printCoverageReport()` / `printEvidDisagreementsReport()`** — the rendering
  discipline the new report should copy: every measure under its own heading,
  no combined figure, no percentage, `denominator` beside every count.

### Established Patterns
- **One owning module per concern**, with a header naming what it is the ONE
  authoritative place for and what NOT to do with the specific past mistake
  named. The new report module must be written this way.
- **Generated-but-committed artifacts** with a drift guard that fails CI
  (`resources-sync.test.ts`, `anno-regbits.test.ts`). D-03's derived half joins
  this class.
- **A control observed going RED**, not an assertion that a fix is present. The
  milestone's stated discipline, and D-09's planted control follows it.
- **Decline by name with the remedy in the message** — the project-wide pattern
  for anything unresolvable. Criterion 4's declines inherit it.
- **`buildViceTool()` registration** keeps the `anno_*` family off
  `forwardToVice()` and backend-agnostic by construction (MCP-02). Not directly
  used here — D-04 chose a skill script — but any tool touched must preserve it.

### Integration Points
- **`anno-cli.ts` dispatch** — the fifth verb lands here, with
  `anno-verb-coverage.test.ts:59` raised in the same change.
- **`src/skills/routine-queue-walker/scripts/`** — the new script's home. It
  must reach store data through the CLI verb (D-07), never by re-implementing a
  store read and never by `spawnSync`-ing an external binary.
- **Phase 33's reproducible-run protocol** — D-13's execution runs go through it.
- **Phase 46 consumes D-10's per-range provenance markers** for `BUILD-05`'s
  provenance carry. Design the field with that consumer in mind.

</code_context>

<specifics>
## Specific Ideas

- The rendered form for a multi-bit register write, as agreed:
  `lda #VIC_SCREEN_1024 | VIC_CHARSET_2048   ; screen=$0400, charset=$0800`
- The report must make a **non-executed fixture visible as non-executed**, not
  merely absent from the disagreement section — the user's concern that a
  vacuous pass should never read as a clean bill of health.
- Where a choice was between "one mechanism" and "both", the answer was **both**
  three times running (D-09, D-10, D-17). Treat belt-and-braces as the house
  preference for this phase rather than as over-engineering to trim.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.

### Reviewed Todos (not folded)

`todo.match-phase 45` returned 7 matches, **none folded** — all are generic
keyword coincidences against an unrelated area:

- *BACK-05 D-G ordering test fails deterministically on a live-broker host* — broker/testing, unrelated to decomposition
- *Correct the false real-corpus claim in research/questions.md* — planning hygiene, no code in this phase
- *Phase 28 review: fsync portability on Windows* — store durability, already shipped and out of scope
- *Phase 28 review round 3: five open findings* — prior-phase review backlog
- *Move all tests into a separate test folder* — tree-wide refactor, would collide with every plan here
- *Reap vicerc scratch dirs in broker kill/recycle path* — broker lifecycle
- *Remove pre-warm; launch VICE only on first request* — broker lifecycle

</deferred>

---

*Phase: 45-decomposition-to-closure-disagreement-first*
*Context gathered: 2026-09-10*
