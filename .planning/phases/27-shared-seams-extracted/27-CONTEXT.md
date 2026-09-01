# Phase 27: Shared Seams Extracted - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the capabilities that a prefix-driven `anno-*` deletion would silently
take with it out from under that prefix; record a capability-or-glue
classification for every `anno-*` module **before** anything is deleted; and
prove the whole thing was a move rather than a change.

**Zero `anno` modules are deleted in this phase.** Deletion is Phase 32
(`CUT-*`). This phase exists so that when Phase 32 runs, the things it must not
take are already out of reach of a prefix and already on the record.

Requirements: `SEAM-01`, `SEAM-02`, `SEAM-03`.

**Not in scope:** any annotation-store code (Phase 28), any tool-surface change
(Phase 29), any export work (Phase 30), any repointing of `anno-*` consumers at
a new store (Phase 31), any deletion (Phase 32). No behaviour change of any kind.

</domain>

<decisions>
## Implementation Decisions

### Gate extraction (SEAM-01)

- **D-01 — The ACME half is a hard move out of `anno-test-gate.ts` — no re-export shim.** `ACME_BIN`, `probeAcme`, `ACME_AVAILABLE`,
  `acmeSkipReasonFor` and `assertAcmeRequiredIfEnvSet` move to a new module and
  all four importing test files get their import line rewritten:
  `disasm-roundtrip.test.ts:57`, `skill-acme-build-cli.test.ts:47`,
  `anno-cli.test.ts:28`, `absorbed-answer-key.test.ts:228-231`.
  `anno-test-gate.ts` keeps only the external analyser half and its nine
  remaining importers. A shim was rejected precisely because it would leave the
  deletion hazard intact: with a re-export in place, deleting `anno-*` still
  breaks four test files, which is the failure `SEAM-01` exists to remove.
  Verified: `grep -c` of the ACME symbols under `anno-*` reaching zero is the
  observable form of this decision.
  — **Reversibility:** reversible — five symbols and four import lines.

- **D-02 — The new module is `src/mcp/vice/acme-gate.ts`.** `test-gate.ts` is
  **not available**: `test-gate.mjs` (the MANUAL_ONLY_TESTS gate) and
  `test-gate.d.mts` / `test-gate.test.ts` already occupy that name in the same
  directory and do a different job — they gate *which tests run*, not *whether
  an external binary exists*. `acme-gate.ts` reads consistently with the
  repo's `<domain>-<role>.ts` convention (`backend-detect`, `stock-condition`,
  `disasm-decoder`). `acme-probe.ts` was rejected because `vice-probe.ts`
  already means "liveness probe of a running thing", a different job.
  — **Reversibility:** reversible.

- **D-03 — `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` keep byte-identical names.** Measured fact from the scout: `.github/workflows/ci.yml`
  binds **only the env var names** (`ci.yml:140`, `VICE_REQUIRE_ACME: "1"`) and
  never references the module path. So ci.yml needs **no functional edit** — the
  "repointed in the same commit" clause in `SEAM-01` is satisfied by comment
  accuracy, not by a code change. A planner must not invent a ci.yml code change
  to satisfy the requirement text; it must instead *state* that ci.yml binds by
  env-var name and confirm the names did not move.
  — **Reversibility:** one-way — renaming either variable silently converts CI's
  hard-FAIL into a skip, with a green run either way. This is the second silent
  failure mode the roadmap's Ordering constraint 1 names.

- **D-04 — The new module gets its own `acme-gate.test.ts`**, carrying (a) the
  `package.json` `files[]`-absence assertion for `acme-gate.ts` and (b)
  criterion 1's hard-FAIL proof. `anno-verify.test.ts:187` is left alone — it
  is still correct about `anno-test-gate.ts`. Extending that assertion was
  rejected: it would put a non-`anno` module's only structural guard inside an
  `anno-*` test file, re-creating the exact prefix-deletion hazard this phase
  removes.
  — **Reversibility:** reversible.

- **D-05 — Criterion 1's FAIL is proven by a committed child-process test, not a one-off transcript.** `ACME_AVAILABLE` is evaluated once at module load
  (`anno-test-gate.ts:132`), so no in-process test can re-probe. The test
  spawns a child `node --test` run with `VICE_REQUIRE_ACME=1` and `ACME_BIN`
  pointed at a nonexistent path, and asserts a **non-zero exit** plus the
  assertion message. It re-runs on every CI run forever, so the gate cannot
  silently rot after Phase 32 rearranges the tree. Cost: one extra child
  process per suite run.
  — **Reversibility:** reversible.

### The classification record (SEAM-02)

- **D-06 — The record is a committed registry data file plus an enforcing test, not a prose document.** The test enumerates `src/mcp/vice/anno-*` on disk and
  **FAILS** when any module has no registry entry, so a module added later
  cannot slip in unclassified. A `docs/` page was rejected as the sole record:
  nothing fails when it goes stale, and its consumer (Phase 32) is five phases
  away.
  — **Reversibility:** costly — Phase 32's deletion decisions are meant to read
  this file rather than re-derive the verdict under deletion pressure. Replacing
  it later means re-establishing trust in a record written *after* deletions
  began, which is the one thing criterion 2 says cannot be done.

- **D-07 — Each entry's basis is surviving consumers plus requirement ids — never the name prefix.** An entry names the concrete files/symbols that break
  if the module vanishes, plus any requirement it implements (`anno-symbols` →
  the ✓ Validated `ANNO-14`/`ANNO-15` symbol round trip; `anno-coverage` →
  `COV-01`/`COV-02`). **Capability** means it has a consumer or a requirement
  that survives the substrate swap. The enforcing test asserts every cited
  consumer path exists on disk and that no entry's justification rests on the
  prefix. That is what makes criterion 2's "no classification cites a name
  prefix" checkable rather than a promise.
  — **Reversibility:** costly — the basis is the evidence Phase 32 acts on.

- **D-08 — Three verdicts, not two: `capability`, `glue`, `glue-with-extractable`.**
  The third names the specific symbols that must move out before the module may
  be deleted. `anno-project.ts` is the concrete instance — it is glue that
  drives the external analyser binary, but it also holds `parsePrg`
  (`anno-project.ts:171`) and `flatImageOrigin` (`:188`), which are pure and
  prefix-free. This turns "also extractable" from a nice-to-have into a recorded
  obligation Phase 32 cannot discharge by ignoring it.
  — **Reversibility:** reversible.

- **D-09 — The registry lives in `src/mcp/vice/` and is deliberately absent from `package.json`'s `files[]`.** Next to the modules it classifies, so registry
  drift and the enumerating test show up in one diff. It is bookkeeping, not
  runtime — same `files[]` rule as the gate (D-04). A `.planning/` location was
  rejected because the test would then reach out of `src/mcp/vice/`, which
  nothing else in the suite does.
  — **Reversibility:** reversible.

### The coverage store boundary (SEAM-03)

- **D-10 — The boundary is an adapter module with a neutral vocabulary.** A new
  non-`anno` module owns the upstream Rust `Display` strings and exposes a
  neutral shape (e.g. `blockClassAt(blocks, addr) → "code" | "data" |
  "undefined" | null`). After the move `anno-coverage.ts` contains **no**
  literal `"Code"` / `"Undefined"` / `"Byte"` comparison anywhere. Phase 28
  swaps the adapter, not the census. Rejected: an injected default-argument
  mapping (a caller that forgets it silently gets upstream's vocabulary back —
  exactly the failure that should be loud) and an interface-only declaration
  (names the boundary without moving anything, so the census still dies with the
  prefix).
  — **Reversibility:** costly — Phase 28's store repoint is written against this
  boundary; changing its shape later moves the census's only contact surface.

- **D-11 — All three comparison sites route through the adapter — including the divergence sub-report.** The requirement text says "two functions"
  (`storeBlockTypeAt`, `anno-coverage.ts:1662`; `classFromStore`, `:1683`), but
  the scout found a **third** site: the boundary-audit block at
  `anno-coverage.ts:1983-1986` compares `blockType !== "Code"` and
  `blockType === "Code"` directly. Leaving it behind would leave the census
  holding upstream's vocabulary and quietly falsify criterion 3. Treat
  "two functions" as the requirement's measurement, not as an exhaustive list.
  — **Reversibility:** reversible.

- **D-12 — `anno-coverage.ts` keeps its name this phase.** Only its store
  contact moves; the census itself is protected by its registry entry (D-06/D-07)
  rather than by a rename. It is 2292 lines with a 4315-line test file, no
  criterion requires the rename, and renaming it makes criterion 4's
  "demonstrably a move" much harder to read in the diff. The rename stays
  available to Phase 31/32 once its consumers are already repointed.
  — **Reversibility:** reversible.

- **D-13 — The adapter is proven substitutable by a second implementation, not by a string search.** A new test feeds the census a *different* block-vocabulary
  implementation through the adapter and asserts the census's byte counts are
  unchanged while only the divergence sub-report moves. This is the same shape
  as the existing independence test at `anno-coverage.test.ts:604` (the
  mass-rewrite-to-one-type test `COV-01`/`COV-02` already own), and it is the
  property Phase 28 actually needs. A structural "no Rust literal survives in
  the census" guard proves absence of a string, not substitutability — it is
  available as a supplement at the planner's discretion, not as the proof.
  — **Reversibility:** reversible.

### Extraction scope beyond the three requirements

- **D-14 — `prg-image.ts` is extracted in this phase.** `parsePrg` and
  `flatImageOrigin` move out of `anno-project.ts` into a new
  `src/mcp/vice/prg-image.ts`. They are the concrete instance behind
  `anno-project.ts`'s `glue-with-extractable` verdict (D-08), so extracting now
  discharges that obligation immediately instead of leaving Phase 32 to do it
  under deletion pressure. **Unlike the gate, this module ships**:
  `anno-project.ts` is in `package.json`'s `files[]`, so `prg-image.ts` must be
  added there too, and `scripts/check-npm-packages.mjs` validates the resulting
  tarball contents.
  — **Reversibility:** costly — adding a file to `files[]` changes the published
  tarball; removing it later is a packaging change to a published contract.

- **D-15 — `shippedTsModules()` / `codeOnly()` are extracted to one shared test-only helper, and all copies are repointed.** The scout found **four**
  hand-copies of `shippedTsModules()` — `spawn-seam.test.ts:176`,
  `stock-dispatch.test.ts:2902`, `docs-dangling-refs.test.ts:353`,
  `comment-phase-pointers.test.ts:400` — and two of `codeOnly()`
  (`spawn-seam.test.ts:65`, plus the partial variants in
  `disasm-decoder.test.ts:308`, `disasm-renderer.test.ts:346`,
  `disasm-opcodes.test.ts:394`, `anno-tools.test.ts:201`). The roadmap names
  only `stock-dispatch`'s copy. Four copies of a `files[]`-derived module
  enumerator is exactly the divergence hazard `anno-test-gate.ts`'s own header
  was written to stop. Test-only, so the helper stays out of `files[]`.
  **Scope note for the planner:** the four `shippedTsModules()` copies are
  verbatim and repoint cleanly. The `codeOnly()` variants in the three
  `disasm-*` / `anno-tools` test files are *partial* strippers doing a
  different job (comments only, not string bodies) — repoint only the true
  `codeOnly()` copies, and leave the partial ones unless they turn out
  identical on inspection.
  — **Reversibility:** reversible.

- **D-16 — The "no import between sibling guard tests" convention is clarified, not overruled.** `comment-phase-pointers.test.ts:53-59` records its copy as a
  deliberate independence choice: *"Kept as a second, independent copy rather
  than an import — this file and `docs-dangling-refs.test.ts` each own their own
  scan end-to-end."* The convention forbids one guard test importing **another
  guard test**. Importing a neutral non-test helper module is a different thing
  — `spawn-seam.test.ts:53` already imports `anno-test-gate.ts` exactly
  that way. So the extraction is compatible with the convention, **and that
  comment is rewritten in the same commit** to state the convention's scope
  explicitly, so it is not re-read later as a ban on all sharing. Leaving the
  comment as written while repointing the file would be a silent contradiction
  in the record.
  — **Reversibility:** reversible.

### Proving it was a move (criterion 4)

- **D-17 — The green-run evidence names the command and states the broker was stopped.** A live VICE broker makes the `BACK-05` D→G ordering test go red
  **deterministically** — a known, recorded environmental condition with an open
  todo (`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`).
  It is a pre-existing red, not something this extraction causes, and fixing it
  is **out of scope** (broker behaviour, no requirement in this phase). The
  evidence must therefore name the exact command (`npm test`, the full
  `*.test.*` glob — **not** `npm run test:automated`, which skips
  `MANUAL_ONLY_TESTS`) and state the broker was stopped.
  — **Reversibility:** reversible.

### Claude's Discretion

The following were left open with a stated lean; the planner decides:

- **Adapter module name (D-10).** Lean: `block-class.ts` or
  `annotation-blocks.ts` — must not say `anno`, and must not collide with
  anything already in `src/mcp/vice/`. Check the directory before choosing.
- **Whether `AnnoBlockEntry` (and `AnnoSymbol` / `AnnoComment`) move with the
  adapter (`anno-coverage.ts:192-219`).** Lean: `AnnoBlockEntry` moves (it is
  the store's shape and its doc comment literally documents the Rust `Display`
  vocabulary); the other two stay, since nothing in this phase touches them.
  If they move, they are renamed off the `ANNO` prefix.
- **Whether the registry also covers `anno-*.test.ts` files and
  `anno-regbits.json`.** Lean: cover the 16 non-test modules plus
  `anno-regbits.json` (it is in `files[]`); leave test files out, since a test
  file's fate follows its module's.
- **Registry file format** (TS module with a typed const, vs JSON). Lean: TS —
  the enforcing test gets type-checking for free and `tsconfig` already covers
  the directory.
- **Plan decomposition.** The roadmap's Ordering constraint 1 is binding: the
  gate split precedes any deletion, in the same commit or earlier. Since this
  phase deletes nothing, the constraint is satisfied by construction — but the
  gate work should still land first so criterion 1 is observable independently
  of the rest.

**One standing hazard for the enforcing test (D-06):** assert *relations*, not
counts. A pinned "there are exactly 16 `anno-*` modules" assertion goes red on
a correct tree the moment a module is added or extracted — the failure mode
already seen in `audit-integrity.test.ts`. The test's contract is "every module
on disk has an entry and every cited consumer exists", never a total.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` — Phase 27 goal, four success criteria, the Notes block
  (Ordering constraint 1; the "also extractable" list), and the milestone's
  Standing Constraints
- `.planning/REQUIREMENTS.md` lines 68-70 — `SEAM-01`, `SEAM-02`, `SEAM-03` verbatim
- `.planning/PROJECT.md` — Core Value; Key Decisions table
- `.planning/STATE.md` §"Current Position", §"Decisions" — v0.6.0 close, and why
  Phase 25's content became the whole of v0.7.0

### The gate being extracted (SEAM-01)
- `src/mcp/vice/anno-test-gate.ts` — the module being split; its header states
  the divergence rationale the ACME half must carry with it (`:96-166` is the
  ACME half)
- `.github/workflows/ci.yml:44-141` — the ACME install step, the banner proof,
  the scaffold assembly, and the `Test` step that sets `VICE_REQUIRE_ACME: "1"`
  and runs `npm test`. **Binds env-var names only, never the module path.**
- `src/mcp/vice/disasm-roundtrip.test.ts:57,60-65` — importer; originated the
  `ACME_BIN`/`VICE_REQUIRE_ACME` convention
- `src/mcp/vice/skill-acme-build-cli.test.ts:15-47,283-287` — importer; asserts
  `ACME_BIN` is the shared seam's value, not a second default
- `src/mcp/vice/anno-cli.test.ts:28,679-683` — importer
- `src/mcp/vice/absorbed-answer-key.test.ts:219-231,259` — importer
- `src/mcp/vice/anno-verify.test.ts:175-194` — the existing `files[]`-absence
  assertion, which stays as-is
- `src/mcp/vice/hostpath-consumers.test.ts:204` — enumerates
  `anno-test-gate.ts` by literal name; check whether `acme-gate.ts` belongs
- `src/mcp/vice/spawn-seam.test.ts:20-34,53,158-195` — the `codeOnly()` /
  `shippedTsModules()` origin, and two literal `anno-test-gate.ts` mentions
  (`:23`, `:162`)
- `.planning/todos/completed/2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md`
  — the record of why the gate was consolidated in the first place

### The coverage boundary (SEAM-03)
- `src/mcp/vice/anno-coverage.ts:184-219` — the store input shapes and their
  Rust `Display` doc comments
- `src/mcp/vice/anno-coverage.ts:1615-1690` — `DerivedClass`,
  `storeBlockTypeAt()`, `classFromBytes()`, `classFromStore()` — the boundary
- `src/mcp/vice/anno-coverage.ts:1972-1990` — the **third** comparison site
  (divergence sub-report) that the requirement's "two functions" does not name
- `src/mcp/vice/anno-coverage.ts:59-70,116-135` — the header's independence
  invariants ("NEVER derive any measure from the store's block-type listing";
  "neither side reads the other's input"), which the adapter must not weaken
- `src/mcp/vice/anno-coverage.test.ts:604-615` — the `COV-01`/`COV-02`
  boundary test that must still pass across the new boundary
- `src/mcp/vice/anno-confidence.ts` — supplies the grade tokens
  `classFromStore()` reads before falling through to block type

### Extraction scope
- `src/mcp/vice/anno-project.ts:171-195` — `parsePrg`, `flatImageOrigin` (note `decodeRawData` at `:202` is anno-payload-specific and does **not** move)
- `src/mcp/vice/package.json` `files[]` — the shipped module list; both the
  `prg-image.ts` addition and the gate/registry/helper *absences* are checked
  against it
- `scripts/check-npm-packages.mjs` — validates both published tarballs' contents
- `src/mcp/vice/stock-dispatch.test.ts:2885-2955` — the copy the roadmap names
- `src/mcp/vice/docs-dangling-refs.test.ts:344-415` — the `shippedTsModules()`
  origin and its existence-assertion rationale
- `src/mcp/vice/comment-phase-pointers.test.ts:53-59,392-414` — the recorded
  "second, independent copy" convention that D-16 clarifies

### Project conventions
- `CLAUDE.md` — the Architecture/Testing constraints, including the
  `rewriteArguments()` interception rule and the `docs-linerefs.test.ts` note
  that line numbers in that bullet drift between phases
- `.planning/codebase/CONVENTIONS.md` — naming, import-extension and
  single-seam conventions the new module names must satisfy
- `.planning/codebase/TESTING.md` — test-file colocation and `node --test` glob
  behaviour

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`anno-test-gate.ts`'s own header** is the model for `acme-gate.ts`'s header:
  it states WHY the seam exists, what NOT to do, and which past mistake motivated
  it. The ACME half's rationale (`:96-113`) travels with the code.
- **`docs-dangling-refs.test.ts:344-360`'s `shippedTsModules()`** is the
  canonical implementation — `files[]` filtered to `.ts`/`.mts` with a
  per-entry `existsSync` assertion so a stale `files[]` entry fails loudly
  rather than silently shrinking the scanned set. Extract *this* one.
- **`anno-coverage.test.ts:604`'s mass-rewrite test** is the shape D-13's
  substitutability test copies: rewrite the whole store side, assert the census
  side does not move.
- **`capability-registry.ts`** is the repo's existing precedent for a typed
  registry consulted by tests — a useful shape reference for D-06/D-09.

### Established Patterns

- **Single seam per concern.** Every cross-cutting responsibility has exactly one
  owning file with a long header explaining the incident that motivated it. Both
  new modules (`acme-gate.ts`, the block adapter) must carry one.
- **Real file extensions in relative imports** (`./acme-gate.ts`, not
  `./acme-gate`) — `verbatimModuleSyntax` + `allowImportingTsExtensions`.
- **Test-only helpers must not match `*.test.*`** — `package.json`'s `test`
  script runs `node --test '*.test.*'`, so a helper named `*.test.ts` would be
  collected as a test file. `anno-test-gate.ts`'s own header records this.
  `acme-gate.ts` and the shared test helper inherit the rule.
- **`files[]` absence is asserted mechanically, never assumed** — the pattern at
  `anno-verify.test.ts:187`.
- **No build step for the shipped server.** Everything here is `.ts` run through
  Node's type-stripping; nothing new needs `build.ts` unless it is host-bound
  `.mts` (nothing in this phase is).

### Integration Points

- `package.json` `files[]` — gains `prg-image.ts` (D-14); must **not** gain
  `acme-gate.ts`, the registry, or the test helper.
- `.github/workflows/ci.yml` — no functional edit expected (D-03); comment
  accuracy only.
- `anno-coverage.ts`'s `ReproducibilityInput` — the adapter sits between it and
  the `blocks` array it currently reads directly.
- `scripts/check-npm-packages.mjs` — sees the `files[]` change from D-14.

</code_context>

<specifics>
## Specific Ideas

- The user's consistent instinct across all four areas was **structural
  enforcement over recorded intent**: a committed child-process test rather than
  a transcript (D-05), an enforcing registry rather than a doc (D-06), cited
  consumers rather than prose (D-07), a second implementation rather than a
  string search (D-13). Downstream agents should prefer a mechanism that fails
  over a statement that is true.
- Equally consistent: **no shims, no partial repoints.** A re-export shim (D-01)
  and a two-of-four repoint (D-15) were both rejected on the same grounds — a
  half-move leaves the hazard in place while looking finished.
- On the one conflict found (`comment-phase-pointers.test.ts`'s deliberate
  duplication), the chosen route was to **clarify the convention's scope in the
  same commit**, not to overrule it silently. That preference generalises: when
  a recorded decision blocks a change, rewrite the record, don't route around it.

</specifics>

<deferred>
## Deferred Ideas

- **Renaming `anno-coverage.ts` off the prefix.** Explicitly deferred by D-12
  to Phase 31/32, once its consumers are already repointed.
- **The remaining `anno-*` capability renames** (`-acme-ident`, `-confidence`,
  `-symbols`, `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen`).
  This phase records their classification (D-06/D-07); it does not rename them.
  Whether they ever need renaming is a Phase 32 question the registry exists to
  answer.
- **The partial `codeOnly()` variants** in `disasm-decoder.test.ts:308`,
  `disasm-renderer.test.ts:346`, `disasm-opcodes.test.ts:394` and
  `anno-tools.test.ts:201` — comment-only strippers doing a different job. Not
  consolidated (D-15).

### Reviewed Todos (not folded)

Six todos matched Phase 27 by keyword; none were folded — all are broker,
capture or planning concerns with no contact with module extraction.

- *Reap vicerc scratch dirs in broker kill/recycle path* — broker lifecycle, no
  overlap with this phase.
- *Run VICE headless and in warp mode when the run allows it* — broker launch
  behaviour.
- *BACK-05 D→G ordering test fails deterministically on a live-broker host* —
  **reviewed and deliberately not folded** (D-17). It is the known environmental
  red that criterion 4's evidence must state the broker was stopped to avoid.
  Fixing it is broker behaviour and belongs in its own work.
- *Correct the false real-corpus claim in research/questions.md* — planning-doc
  accuracy, unrelated.
- *Extract flat 64K from VICE snapshots instead of transcribing hex* — capture
  tooling.
- *Frame-exact emulator stop is unowned* — the blocker holding Phases 24/26 for
  v0.8.0; nothing to do with this phase.

</deferred>

---

*Phase: 27-Shared Seams Extracted*
*Context gathered: 2026-08-26*
