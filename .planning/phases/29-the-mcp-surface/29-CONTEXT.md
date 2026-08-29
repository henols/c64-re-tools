# Phase 29: The MCP Surface - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose Phase 28's annotation store as an MCP tool family **derived from** Phase
19's `upstream-procedure-manifest.json` and registered proxy-locally through
`buildViceTool()`, shaped for an agent rather than a cursor — and, by a
discussion decision that **supersedes the roadmap text**, remove the
regenerator2000 integration in this same phase rather than leaving it standing
beside its replacement.

**The phase boundary moved during discussion.** ROADMAP.md criterion 2 says
*"Both families are registered and callable at this phase's close — that is the
point of the phase"*, and `MCP-05` says *"Both families coexist at this point,
so nothing is deleted to make them pass."* The user decided otherwise: r2000
usage is removed, and anything that cannot be removed now must be disabled and
never included in any tests. Asked what "removed" meant concretely, the user
chose **"Delete in Phase 29 — pull CUT forward"** over unregister-and-quarantine.

**In scope:**

1. The new `anno_*` tool family over the Phase 28 store, derived and mechanically
   checked (`MCP-01`, `MCP-02`, `MCP-03`, `MCP-04`, `STORE-06`).
2. The registration-time guards moved in the registering commit (`MCP-05`).
3. **Renaming the 11 `capability` modules** out from under the `r2000-` prefix
   (Phase 27 recorded the classification but renamed nothing).
4. **Deleting the binary-driving glue** — the regenerator2000 external dependency
   is gone at this phase's close.
5. **Re-pointing the 9 skill files** naming 18 `r2000_*` tools (pulled forward
   from Phase 31, because the deletion makes them red immediately).
6. **Building the grep gate and observing it bite before the deletion commit**
   (pulled forward from Phase 32, ordering constraint 5 / the `4f048bb`
   precedent).
7. **Editing ROADMAP.md and REQUIREMENTS.md** so the record matches: criterion 2
   and `MCP-05`'s coexistence clause are now false by decision, and Phases 30–32
   shrink.

**Out of scope:** ACME export and the real-ACME oracle (Phase 30 — `export-asm`
is deleted here and returns there, behind the oracle, rather than being deleted
and re-invented inside a window with no oracle). Automatic annotation (v0.8.0).

</domain>

<decisions>
## Implementation Decisions

### The r2000 exit (supersedes ROADMAP criterion 2 and MCP-05's coexistence clause)

- **D-01 — r2000 is deleted in Phase 29, not unregistered and not deferred to Phase 32.** The user's directive: *"The r2000 usage is decided to be removed
  and if it can't be removed right now everything about it must be disabled and
  never be included in any tests."* Presented with unregister-and-quarantine
  (files kept, tests gated off, structural guards live) as the recommended
  option, the user chose deletion. ROADMAP.md criterion 2, `MCP-02`'s and
  `MCP-05`'s coexistence clauses, and the Phase 31/32 scope statements are edited
  in this phase to match — the record is not left describing a plan that was
  abandoned.
  — **Reversibility:** one-way — 26,023 lines of `r2000-*.ts` and the
  regenerator2000 dependency. Restoring the route means restoring a deleted
  external integration and its pinned 0.9.20 crate, and the safety property
  criterion 2 was written to buy ("the replacement is demonstrably ready before
  anything is removed") cannot be re-bought after the fact.

- **D-02 — Scope of the cut: only the binary-driving glue is deleted; the CLI is renamed and keeps its capability-backed verbs.** The user answered "You decide"
  on what rides forward, and this is the call. **Deleted:**
  `r2000-launch.ts`, `r2000-mcp-client.ts`, `r2000-session.ts`, `r2000-tools.ts`,
  `r2000-project.ts`, `scripts/lib/r2000-cli-verbs.mjs`,
  `scripts/lib/r2000-cli-verbs.d.mts` — every module `module-classification.ts`
  verdicts `glue`. **Renamed, not deleted:** `r2000-cli.ts`, dropping only the
  three verbs that reach the spawn (`bootstrap`, `export-asm`, `verify`) and
  keeping the five that import capability modules only (`gen-enums`,
  `export-lbl`, `import-lbl`, `render-memmap`, `coverage`). Verified at
  discussion time by reading the CLI's own import list: `bootstrap`/`export-asm`/
  `verify` are the only verbs reaching `r2000-launch.ts`. This is what lets the
  external dependency go in Phase 29 **without** inventing an export route ahead
  of Phase 30's oracle, so ordering constraint 2 is honoured rather than broken.
  — **Reversibility:** one-way — see D-01.

- **D-03 — The 11 `capability` modules are renamed out from under the prefix BEFORE anything is deleted, and the deletion is driven by `module-classification.ts`, never by a prefix sweep.** Measured at discussion
  time: Phase 27 delivered the classification registry and the ACME-gate
  extraction, but all 19 classified modules still carry `r2000-` on disk. The
  survivors are `r2000-acme-ident.ts`, `r2000-confidence.ts`, `r2000-coverage.ts`,
  `r2000-d64.ts`, `r2000-enum-gen.ts`, `r2000-memmap-render.ts`,
  `r2000-regbits-gen.ts`, `r2000-regbits.json`, `r2000-symbols.ts`,
  `r2000-test-gate.ts`, `r2000-verify.ts`. A prefix sweep would take
  `R2000-14`/`R2000-15`'s ✓ Validated symbol round trip and `COV-01`/`COV-02`'s
  census with it — the exact hazard Phase 27 exists to have removed.
  — **Reversibility:** costly — renames touch every importer; the registry is the
  evidence the rename set is complete.

- **D-04 — `parsePrg`/`flatImageOrigin` need no extraction work.** Measured: they
  already live in `src/mcp/vice/prg-image.ts`. `module-classification.ts` records
  `r2000-project.ts`'s `glue-with-extractable` obligation as **discharged**, and
  its verdict is now plain `glue`. A planner must not re-derive this as
  outstanding work.

### The tool family

- **D-05 — One prefix, `anno_` for tool names and `anno-` for modules.** Phase 28
  already put `anno-store.ts`, `anno-types.ts` and `anno-index.ts` on disk, so the
  module prefix is established and derivable by `readdirSync` plus a stable
  name-prefix regex — which is what the removal gate's rule ("a **single stable
  prefix derivable from disk**") requires, and what `hostpath-consumers.test.ts`
  and `r2000-spawn-seam.test.ts` are shaped for. `c64_` and `re_` were rejected:
  each costs a second prefix, makes the mechanical derivation read two names, and
  `re_` is a weak namespace token in an agent's tool list. Accepted cost: `anno_`
  reads narrow for the read verbs (`anno_disassemble`, `anno_get_binary_info`),
  which are about the program rather than the annotations.
  — **Reversibility:** costly — the prefix is baked into the derivation test, the
  tool-support table generator, the module floor, the grep gate and 9 skill files.

- **D-06 — Open/close per call, with an explicit store-path argument on every verb.** `openStore(path, { workspaceRoot })` and `closeStore` in a `finally`;
  no cross-call state anywhere. Two Phase 28 hazard classes become unreachable
  across calls by construction: `revertTo` returning a **new** handle (nothing
  cached to swap), and `transactionStateUnknown` wedging a connection (nothing
  reused). This deliberately **reverses Phase 18's Rule A21**, which chose a
  long-lived session — that decision existed to avoid respawning a
  regenerator2000 child process per call, and D-02 deletes the child process, so
  its premise is gone. The argument mirrors r2000's `project` shape.
  Workspace-derived defaulting was rejected: it would make Phase 28's
  `unconfinedModuleDerivedPath` escape the normal path rather than the exception.
  — **Reversibility:** reversible — adding a cache later is local.

- **D-07 — The read verbs take a required image-path argument per call.**
  `anno_disassemble`, `anno_read_region`, `anno_get_binary_info`,
  `anno_get_address_details`, `anno_get_cross_references` and `anno_search` each
  take the image path explicitly, resolved under `workspaceRoot` and decoded via
  `prg-image.ts` plus the surviving `disasm-*` decoders. Measured: the store's DDL
  holds **no** program image — `anno_meta`, `anno_range`, `anno_label`,
  `anno_comment`, `anno_scope`, `anno_enum`, `anno_xref`, `anno_snapshot` and
  nothing else. Recording the path in `anno_meta` was rejected: it needs a
  `SCHEMA_VERSION` bump (a one-way decision this milestone) and creates a second
  on-disk truth about the program. An optional-argument-with-fallback hybrid was
  rejected outright: an omitted argument would read as a plausible-looking success
  against whatever was recorded, which is the exact shape `MCP-04`'s refuse-by-name
  rule exists against. Accepted cost: the agent repeats the path on every read.
  — **Reversibility:** costly — the argument is required, so making it optional
  later is additive, but making it *absent* later is a contract break.

- **D-08 — Derivation is checked against the manifest, and verbs the manifest does not classify live in a second committed register.** The mechanical test
  asserts three things against
  `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`:
  every verb classified `curated` or `adapt-to-address-input` has a route, every
  verb classified `omit` is absent, and `r2000_delete_project_enum` is absent.
  Measured at discussion time: the manifest classifies **20** verbs — 15
  `curated`, 1 `adapt-to-address-input` (`r2000_get_disassembly_cursor`), 4 `omit`
  (`set_immediate_format`, `toggle_splitter`, `undo`, `unpack_binary`). Three
  verbs in `CURATED_R2000_TOOLS` appear in **no** manifest procedure —
  `r2000_search_disassembly`, `r2000_add_scope`, `r2000_update_project_enum` — and
  criterion 5 / `STORE-06` positively require search. Those go in a register
  modelled on `module-classification.ts`, each entry citing a requirement id
  (`STORE-06` for search), so a verb added later with no named consumer **fails**
  rather than being reviewed. Amending the manifest was rejected: it describes
  upstream regenerator2000 at commit `493f840` and carries its own re-sync trigger
  and per-procedure sha256s — writing our verbs into it makes it describe us and
  breaks what `r2000-upstream-audit.test.ts` says.
  — **Reversibility:** reversible.

- **D-09 — `r2000_get_disassembly_cursor` is folded into the disassemble verb's address argument, not carried as a verb.** That is what
  `adapt-to-address-input` means here, and it agrees with the roadmap's recorded
  anti-feature (upstream's own procedure text says *"NEVER use the 'current
  cursor address'"*).

### The guards with a fate

- **D-10 — `check-skill-fork-honesty.mjs:504`: the skill loses the route and the assertion is re-pointed.** It asserts `acme-build/SKILL.md` still contains the
  literal `"r2000 export-asm"`; D-02 deletes that verb, so the guard goes red
  either way. The route is stripped from the skill and the assertion re-pointed at
  the renamed CLI, with Phase 30 restoring an export route under that name. Named
  by ROADMAP Phase 32 criterion 4 as needing resolution "in **one change that
  names which side is correct**" — this is that change, and the skill is the side
  that moves.

- **D-11 — `r2000-answer-key.test.ts` is renamed and kept, never deleted.** It
  reads `.planning/phases/11-*/evidence/` with no existence guard and is the
  second leg of the "do not archive phase directories" decision. Deleting it would
  silently discharge that constraint. ROADMAP Phase 32's note requires this be an
  explicit recorded choice rather than a side effect; it is recorded here.

- **D-12 — `docs-r2000-decisions.test.ts` and `scripts/audit-gate.mjs:136` move together, in one commit.** Their own comment records that they were added in one
  commit for exactly this reason: removing the name from `audit-gate.mjs` without
  removing the test, or the reverse, **breaks the audit gate**.

- **D-13 — The registration-time guards move in the registering commit (`MCP-05`), and their re-pointing is now a rename rather than a duplication.**
  `generate-tool-support-table.mjs:104`'s hard-coded `R2000_TOOL_DEFINITIONS`
  regex and its two deliberate duplicate witnesses move together and none is
  refactored into a shared helper. `hostpath-consumers.test.ts`'s
  `R2000_MODULE_FLOOR` (currently `14`) is re-expressed over the `anno-` prefix at
  the measured new count, **raised not lowered**, and its positive control — today
  the four `INT-01` filenames — is replaced with real new filenames.
  `check-skill-tool-coverage.mjs`'s floor is re-expressed the same way (pulled
  forward from Phase 31 criterion 2). Note that criterion 4's wording already
  anticipated re-pointing rather than deletion, so it survives D-01 unedited.

### Amendments from research (added at plan time, 2026-08-29)

`29-RESEARCH.md` measured two locked decisions to be false and found one blocking
gap. All three are resolved here so the planner does not re-litigate them. The
measurements themselves live in `29-RESEARCH.md` (§ "Contradicts a Locked
Decision", § F-1, § F-2, § F-3) with per-claim `[VERIFIED: file:line]` citations —
nothing is restated here as if newly measured.

- **D-14 — D-02's kept-verb set is narrowed to `render-memmap` and `coverage`.**
  **User decision, 2026-08-29.** D-02 verified `r2000-cli.ts`'s own import list,
  which is correct one level deep; research measured the second level and found
  `gen-enums`, `export-lbl`, `import-lbl` and `coverage` all reach
  `r2000-launch.ts` / `r2000-tools.ts` *through* the capability modules
  (`29-RESEARCH.md` § F-2, five verbatim import lines plus eight use sites). They
  are rebuilds, not renames. Offered the three sizings, the user chose the
  narrowing: **`render-memmap` (zero local imports) and `coverage` survive into
  Phase 29; `gen-enums`, `export-lbl` and `import-lbl` follow the export route
  into Phase 30 alongside the ACME oracle** — the same reasoning D-02 already
  applied to `export-asm`. `coverage` stays because `COV-01`'s census re-point is
  already in scope as Discretion item 4.
  — **Consequence the plan must carry:** `R2000-14` / `R2000-15`'s ✓ Validated
  symbol round trip has no route for the duration of Phase 30. That is a
  *temporary loss of a validated capability*, and the plan must record it as such
  where the record will be read — not leave it to be discovered when the
  requirement is next checked.
  — **Reversibility:** reversible — the verbs return in Phase 30.

- **D-15 — `anno_enum_usage` is added and `SCHEMA_VERSION` bumps 2 → 3, with no migration arm.** **User decision, 2026-08-29.** `r2000_apply_enum_usage` is
  disposed `curated` in the Phase 19 manifest, so D-08's mechanical check demands
  a route, but the Phase 28 store has no table associating an enum with an
  address and `openStore` hard-refuses a mismatched `schema_version`
  (`29-RESEARCH.md` § F-1). Offered add-and-bump / add-with-migration /
  refuse-by-name, the user chose **add the table and bump, accepting that every
  existing v2 `.annostore` on disk becomes permanently unopenable** — the store
  shipped five days ago and a migration arm bought now protects stores that may
  not exist. This supersedes D-07's note that a `SCHEMA_VERSION` bump is a
  one-way decision to be avoided this milestone: the bump is now taken
  deliberately, with the cost named.
  — **Consequence the plan must carry:** the refusal must stay a *single-witness*
  refusal — no migration arm is added to `openStore`, and the plan must assert
  that a v2 store still refuses by name rather than being silently upgraded.
  — **Reversibility:** one-way — existing v2 stores cannot be reopened after this.

- **D-16 — D-03's rename set is 9, not 11: `r2000-test-gate.ts` and `r2000-verify.ts` are deleted, not renamed.** *Agent-resolved, taking the
  research recommendation* (`29-RESEARCH.md` § CD-2 / § F-3). This is not research
  overruling `module-classification.ts` — it is research reading the registry as
  D-03 requires. The registry's own `note` fields say *"Do NOT read this verdict
  as a claim that the module survives a prefix deletion"* (`r2000-test-gate.ts`)
  and *"what a later phase inherits is the discipline … NOT the route"*
  (`r2000-verify.ts`); the verdict field and the note field are one record, and
  reading only the verdict is the name-based shortcut D-03 exists to prevent, one
  level up. Corroborated by import measurement: `r2000-test-gate.ts` has zero
  surviving importers (both live ACME-gated tests already use `acme-gate.ts`) and
  `r2000-verify.ts`'s only import is the deleted `r2000-launch.ts`.
  — **Consequence the plan must carry:** `r2000-verify.ts`'s two pinned
  false-pass transcripts are what the registry names as the thing that must
  survive. They ride forward as Phase 30 fixtures; the plan must move them, not
  let them go with the module.
  — **Reversibility:** costly — same class as D-03.

- **D-17 — `render-memmap` is rebuilt onto the Phase 28 store in this phase; D-14's "keep the free ones" premise was false, and neither kept verb was free.** **User decision, 2026-08-29.** D-14 kept `render-memmap` on the strength of `29-RESEARCH.md`'s measurement that its module has *"zero local imports"* — asserted at `:267` and `:569` and repeated in this file's `<deferred>` block as *"no store call site"*. All of those measurements were `grep`-based, and `grep` is blind to `src/mcp/vice/r2000-memmap-render.ts` because the file carries a literal NUL byte at offset 12862 (line 291, a `"\0"` separator in the sidecar hash canonicalisation). Read with `grep -a`, the module imports `runR2000Tool` from `r2000-tools.ts` at `:69`, uses it at `:106` inside `queryR2000Json()`, and `renderMemoryMap()` calls that three times at `:353-355` (`r2000_get_blocks`, `r2000_get_symbols`, `r2000_get_comments`); `checkRenderedMemoryMap()` reaches the same path via `renderMemoryMap()`. So `render-memmap` drives the regenerator2000 child, and D-14's chosen option had **no** free verb in it.
  Offered rebuild-here / drop-to-Phase-30 / refuse-by-name, the user chose **rebuild here**: the three calls are re-pointed onto the Phase 28 store readers this phase already builds (the block table, labels, comments). This is the cheapest of the four rebuilds — pure reads, with no ✓ Validated round trip attached, so nothing needs re-proving the way `export-lbl`/`import-lbl` would — and it keeps the renamed CLI at two verbs so `29-07`'s FLOW-01 verb-coverage guard retains a real subject rather than a near-vacuous one.
  — **Consequence the plan must carry:** `29-10`'s recorded fate for `anno-memmap-render.ts` says its import of the retired runner is UNUSED and may be removed as a line-only edit. That is **false** and must be corrected — removing a used import is a different edit with a different fate, which `29-10` itself already warns about.
  — **The measurement lesson, which is now three-for-three:** every verification pass on this phase found the previous sweep incomplete by widening the *instrument*, not the pattern — directory scope, then file type, then text-vs-binary readability. This decision is the first time that reached a **user decision** rather than a plan detail. Any future claim in this phase of the form "module X has no local imports" must be made with `grep -a` or an AST read, never a plain `grep`.
  — **Reversibility:** reversible — the rebuild is additive and the verb keeps its name.

### Claude's Discretion

The user answered "You decide" on the cut's scope (resolved as D-02) and took the
recommended option on every other question. The following were flagged and left to
the planner and researcher rather than put to the user:

- The grep gate's **scope predicate** — `git ls-files` minus `.planning/**`, plus
  either a post-sync read of `installer/skills/**` or the `npm pack --dry-run`
  file list. ROADMAP Phase 32 flags this as needing deeper research at plan time
  with three measured failure modes; the blast radius is 291 tracked files
  mentioning the word, **55** outside `.planning/`.
- The result envelope and the concrete shape of `{available:false, reason}` — an
  existing project convention, to be matched rather than invented.
- The batch verb's recursive inner-name pre-validation — the shape is already
  fixed by `assertCuratedTool()`'s D-33 batch recursion; carry the discipline.
- How `coverage` / `COV-01`'s census re-points off the r2000 project-JSON shapes
  (`R2000Comment`, `R2000CrossReference`, `R2000Symbol`) onto the new store.
- Whether Phases 30–32 are renumbered or merely narrowed after D-01's roadmap
  edit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The derivation source (MCP-01)
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json` — the classification the family is derived from: 5 procedures, 20 distinct verbs, dispositions `curated` / `adapt-to-address-input` / `omit`, plus `disposition_rationale` and per-procedure sha256s. Pinned to regenerator2000 commit `493f840418f1450a342bb220c2fe3d2585dd0525`, version 0.9.20.
- `src/mcp/vice/r2000-upstream-audit.test.ts` — what currently enforces manifest-vs-surface agreement; must be re-pointed, not deleted, when `CURATED_R2000_TOOLS` goes.

### The deletion evidence (D-02, D-03)
- `src/mcp/vice/module-classification.ts` — Phase 27's registry. **The deletion set comes from here, never from the prefix.** 11 `capability`, 8 `glue`.
- `src/mcp/vice/module-classification.test.ts` — the enumerating test that fails when a module has no entry.
- `.planning/phases/27-shared-seams-extracted/27-CONTEXT.md` — D-01..D-09, especially D-07 (basis is surviving consumers, never the name prefix) and D-08 (the three verdicts).

### The store being exposed
- `src/mcp/vice/anno-store.ts` — `openStore` / `closeStore` / `setLabel` / `setComment` / `setDataType` / `addScope` / `createProjectEnum` / `updateProjectEnum` / `putXref` / the `list*` readers / `revertTo` / the snapshot ring. Read `openStore`'s confinement contract and `AnnoStoreHandle.transactionStateUnknown` before designing the call path.
- `src/mcp/vice/anno-types.ts` — `SCHEMA_VERSION`, the 12-member `DATA_TYPES` vocabulary, the split-table types, `parseStoreAddress`, `storePathWithinWorkspace`, and the whole `AnnoStoreError` family the refusals must belong to.
- `src/mcp/vice/anno-index.ts` — `buildPaintIndex` / `resolveAt`, the derived 64K paint index.
- `.planning/phases/28-the-store-core/28-VERIFICATION.md` and `28-REVIEW.md` — the two `behavior_unverified` items carried forward as OPEN, and CR-08/CR-09/CR-10's history. `set_data_type` reaches this surface with unvalidated agent arguments.

### The registration seam and its guards (MCP-02, MCP-03, MCP-05)
- `src/mcp/vice/vice-proxy.ts:3263` (`buildViceTool`), `:3401-3402` (the r2000 loop registration being replaced).
- `src/mcp/vice/stock-dispatch.test.ts:1505` — `BACKEND_SEAM_BYPASS_KEYS`, the **ordered** allow-list where backend-agnosticism is actually enforceable, plus the body-slice assertion at `:1550`.
- `scripts/generate-tool-support-table.mjs:104` — `discoverSyntheticToolNames`, the hard-coded `R2000_TOOL_DEFINITIONS` regex and its two deliberate duplicate witnesses.
- `src/mcp/vice/hostpath-consumers.test.ts:188` — `R2000_MODULE_FLOOR = 14` and the `INT-01` positive control at `:199`.
- `src/mcp/vice/r2000-spawn-seam.test.ts` — the other disk-derived module set.
- `scripts/check-skill-tool-coverage.mjs`, `scripts/lib/r2000-cli-verbs.mjs`, `src/mcp/vice/r2000-verb-coverage.test.ts` — the FLOW-01 guard; the verb parser is `glue` and dies, so the guard is re-expressed over the renamed CLI.
- `scripts/check-npm-packages.mjs` and `src/mcp/vice/package.json` — 16 `r2000` entries in `files[]`; deleting a file still listed there makes the packaging check fail.
- `scripts/check-skill-fork-honesty.mjs:504` — the `"r2000 export-asm"` assertion (D-10).
- `scripts/audit-gate.mjs:136` and `src/mcp/vice/docs-r2000-decisions.test.ts` (D-12).

### The bytes and the decode (STORE-06, D-07)
- `src/mcp/vice/prg-image.ts:69` (`parsePrg`), `:86` (`flatImageOrigin`).
- `src/mcp/vice/disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` — the surviving decoders every derived answer is computed from, on every query.

### The roadmap text this phase edits (D-01)
- `.planning/ROADMAP.md` §"Phase 29" criterion 2, §"Phase 31", §"Phase 32", and §"Sequencing Rationale (v0.7.0)" constraints 2, 3 and 4.
- `.planning/REQUIREMENTS.md` — `MCP-02` and `MCP-05`'s coexistence clauses; `MCP-01`, `MCP-03`, `MCP-04`, `STORE-06`.
- `CLAUDE.md` — the derived-tool path-translation constraint and its `rewriteArguments()` line citations, pinned by `docs-linerefs.test.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `anno-store.ts` / `anno-types.ts` / `anno-index.ts`: the entire write and read surface already exists with its own error family, confinement default and revision model. The MCP layer is argument decoding plus a `finally`, not new store logic.
- `prg-image.ts` + `disasm-*`: 2,555 lines of 6502 decode including illegal opcodes, already extracted and prefix-free.
- `module-classification.ts`: the rename/delete work-list, already committed and already enforced by an enumerating test.
- `assertCuratedTool()`'s D-33 batch recursion in `r2000-tools.ts`: the sanctioned-exception discipline for the batch verb. Read it before deleting the file.

### Established Patterns
- Sets are **derived from disk** (`readdirSync` + a stable prefix regex) with a non-vacuity **floor that only rises** — never a hand-typed list. `INT-01` found four uncovered modules in the hand-typed array this replaced.
- Every refusal is a `ViceError` subclass carrying the offending value and naming the path or range; nothing throws a bare `Error`.
- Structural guards are proven by a **planted violation observed red and reverted**, not by inspection.
- Long structured header comments record WHY the file exists, what it is the one authoritative place for, and what not to do with the specific past mistake named.

### Integration Points
- `vice-proxy.ts` gains a two-line substitution — the import and the loop — with all new code in sibling modules, preserving `docs-linerefs.test.ts`'s citations and PROJECT.md's standing instruction about that file's size.
- `buildViceTool()`, never `buildBackendAwareTool()`: on the non-fork arm the latter calls `dispatchStock()`, which has no table entry for the new names and would refuse by name — the store would be **unreachable on stock**.
- `BACKEND_SEAM_BYPASS_KEYS` is ordered and currently `["RESULT_CONTINUE_TOOL.name", "r2000Def.name"]`; the second entry is renamed in place, not added to.
- `docs/tool-support.md` must regenerate **byte-identical** — the generator already excludes the r2000 loop structurally, so replacing that loop with the `anno_` loop keeps the table unchanged. Verify rather than assume.

</code_context>

<specifics>
## Specific Ideas

- The user's words on the r2000 exit, recorded as data: *"The r2000 usage is
  decided to be removed and if it can't be removed right now everything about it
  must be disabled an never be included in any tests."*
- Research context for D-05, from the discussion's one web search: tool-space
  interference is measured, not hypothetical — name collisions across 775 tools in
  surveyed MCP servers, with `search` colliding across 32 distinct servers, and
  the MCP specification recommending prefix-based disambiguation. This is the
  concrete reason a single stable domain prefix was preferred over a short generic
  one, and a secondary reason D-01's removal of the near-identical `r2000_*`
  descriptions is a real improvement to the agent's tool list rather than only a
  cleanup.

</specifics>

<deferred>
## Deferred Ideas

- **ACME export and the real-ACME oracle** — Phase 30, unchanged. `export-asm` is
  deleted here and returns there behind the byte-diff oracle. This is the reason
  D-02 scoped the cut the way it did.
- **Automatic annotation** — Phase 26, held for v0.8.0 behind the same corpus gate
  as Phase 24.
- **`packer-finding.mjs`'s `entropySource = "r2000_get_binary_info"`** — a stored
  fact about a past run, not a route. ROADMAP Phase 31 requires its fate be
  decided explicitly rather than string-replaced; it rides with the skill
  re-pointing pulled forward into this phase.
- **`render-memmap`'s independence** — ~~it reads `memmap.json` and writes Markdown
  with no store call site, so it can be re-pointed independently or not at all.~~
  **CORRECTED 2026-08-29 — the "no store call site" half is FALSE; see D-17
  above.** Re-measured with `grep -a`, `r2000-memmap-render.ts` imports
  `runR2000Tool` at `:69`, uses it at `:106`, and `renderMemoryMap()` calls it
  three times at `:353-355`; both CLI entry points reach it. The original
  measurement was a plain `grep`, which cannot read that file because of its NUL
  byte at offset 12862. The error is recorded rather than deleted because its
  cause — a text-only instrument on a file with a NUL byte — is a standing hazard
  for this phase. The verb is NOT deferred: under D-17 it is rebuilt onto the
  Phase 28 store here, planned as 29-12.
  A retarget must not read the `installer/skills/` copy.

### Reviewed Todos (not folded)

Nine pending todos matched Phase 29 on keywords; all nine were reviewed and none
folded — every one is out of this phase's domain (VICE broker and emulator
behaviour, or Phase 28 store residuals), and the match scores came from generic
tokens (`phase`, `code`, `every`) rather than subject overlap.

- `2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md` (0.9) — VICE text-monitor doc accuracy.
- `2026-08-24-reap-vicerc-scratch-dirs-in-broker-kill-recycle-path.md` (0.6) — broker lifecycle.
- `2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md` (0.6) — test-host condition, not a surface concern.
- `2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md` (0.6) — research-doc correction.
- `2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md` (0.6) — RAM capture.
- `2026-08-26-frame-exact-emulator-stop-is-unowned.md` (0.6) — the v0.8.0 blocker behind held Phases 24 and 26.
- `2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md` (0.6) — emulator launch.
- `2026-08-28-phase-28-review-in-02-fsync-portability-on-windows.md` (0.6) — Phase 28 store residual.
- `2026-08-28-phase-28-review-round-3-five-open-findings.md` (0.6) — Phase 28 review residual.

</deferred>

---

*Phase: 29-The MCP Surface*
*Context gathered: 2026-08-29*
