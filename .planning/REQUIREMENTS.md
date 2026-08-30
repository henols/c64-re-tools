# Requirements: c64-re-tools — v0.7.0 Own the Annotation Store

**Defined:** 2026-08-26
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.

**Milestone goal:** This project owns the annotation state it has been renting
from regenerator2000, and the analysis procedures already absorbed from it run on
that store instead — with regenerator2000 deleted outright, no parity owed to it,
and no procedural knowledge lost with it.

**Scope note — how this milestone came to be.** v0.6.0 closed incomplete on its
own pre-committed gate: Phase 23 recorded **`no-go`, rule `R1`**. Its Phase 25
was taken forward as the whole of v0.7.0 because, once the Phase 24 engine
coupling is dropped, its goal carries **no corpus dependency** and is therefore
reachable while the `no-go` stands. Phases 24 and 26 are **held**, not cut — see
"Held for v0.8.0" below.

**Two owner decisions taken at the open, 2026-08-26.** Both narrow requirement
text inherited from v0.6.0, and both are recorded here rather than left implicit:

1. **No parity is owed to regenerator2000.** v0.6.0's Phase 25 carried the gate
   *"nothing may delete r2000 before a replacement demonstrably produces the same
   facts"*, and `STORE-04` was worded as *"the capability `R2000-11` shipped,
   carried across the substrate swap rather than lost in it"*. Both are removed.

2. **The Phase 24 engine coupling is dropped with it** — Phase 25's *"populated
   from the engines' output"* dependency and its criterion 3's *"against a program
   analysed by the new engines"*. The store stands on the `disasm-*` decoders this
   project already owns.

**Three research disagreements resolved here rather than by a planner.** The four
research agents disagreed on three points; `research/SUMMARY.md` names them as
`D1`, `D2`, `D3`. Resolved:

- **`D1` persistence → `node:sqlite`.** Not on the performance margin (1.16 ms vs
  16.0 ms per edit) but on evidence grounds: SQLite's planted violation — drop the
  `COMMIT` — reliably reddens, whereas atomic-JSON's — remove the `fsync` —
  frequently still passes because the page cache serves the read. A guard that
  cannot be made to fail is not evidence, and observed-RED is this project's
  acceptance bar. `node:sqlite` is a built-in, unflagged since Node v22.13.0 and
  therefore unconditional at the `>=22.18.0` floor, so `ENGINEERING_RULES.md` §4's
  dependency bar is not triggered at all.

- **`D2` undo → whole-store snapshot/restore, not a per-edit inverse journal.**
  Measured: zero callers anywhere, and the Phase 19 manifest already disposes
  `r2000_undo` as `omit` because idempotent range typing collapses "undo the wrong
  conversion" into "set it correctly". Node's `sqlite` surface also does not expose
  `sqlite3changeset_invert`, confirmed two independent ways. `STORE-04` is scoped
  to what a planted-violation test can actually prove.

- **`D3` no `capability-registry.ts` entry.** That registry holds only the
  per-backend *delta*; a proxy-local family has none, and the precedent named in
  its own header is `vice_diagnose` / `vice_recycle`. v0.6.0's `STORE-03` required
  an entry; that clause was factually wrong and is replaced in `MCP-03` by the
  structural check that actually exists.

**Requirement numbering.** `STORE-*` continues from v0.6.0's `STORE-01..06`, whose
text is superseded here rather than carried. `SEAM-*`, `MCP-*`, `EXPORT-*` and
`REPOINT-*` are new families. `CUT-*` continues from `CUT-01..03`.

## v0.7.0 Requirements

### Shared Seams

<!-- These must land FIRST. Each is a module with surviving consumers that a
     prefix-driven deletion would silently take with it. Extracting them before
     anything else is what makes the deletion safe rather than lucky. -->

- [x] **SEAM-01**: The ACME availability gate is extracted out of `r2000-test-gate.ts` under a name that does not say `r2000`, keeping `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` working for `disasm-roundtrip.test.ts` and `skill-acme-build-cli.test.ts` — and `ci.yml` is repointed in the same commit, because CI binds those names directly (`ci.yml:45-140`). Proven by observing a missing-ACME run **FAIL** under `VICE_REQUIRE_ACME=1`, not skip
- [x] **SEAM-02**: Every `r2000-*` module that is a **capability rather than glue** is identified by what it does and not by its name prefix, and the classification is recorded before any deletion — at minimum `r2000-test-gate`, `-acme-ident`, `-confidence`, `-symbols` (which *implements* the ✓ Validated `R2000-14`/`R2000-15` symbol round trip), `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen` and `-coverage`. A module whose only claim to deletion is its prefix is not deleted
  - ⚠ **WITHDRAWAL RECORDED 2026-08-29 (Phase 29, `D-14`) — the `R2000-14`/`R2000-15` symbol round trip currently has NO ROUTE.** `r2000-symbols.ts` was correctly classified a **capability** by this requirement and survives, renamed to `anno-symbols.ts`, with its whole pre-spawn validation gate intact. What left is the **route**, not the knowledge: the `export-lbl` and `import-lbl` CLI verbs that delivered `R2000-14` and `R2000-15` were removed together with the rest of the retired analyser's delivery paths, because both reached that analyser *through* `anno-symbols.ts` and would have typechecked, dispatched, and then failed at the first call. **This is a temporary loss of a capability that was genuinely Validated, not a completed one being tidied away** — the round trip was demonstrated end to end against genuine unpatched stock `x64sc`, and that demonstration still stands as a record of what worked. **It returns in Phase 30**, rebuilt over the Phase 28 annotation store alongside the ACME export oracle, which is the same route `export-asm` takes for the same reason. Until then, a reader checking whether the symbol round trip works should read this line as: it does not, and the reason is a deliberate sequencing choice rather than a defect. *(Same wording as the dated note in `PROJECT.md`'s shipped-capability list — one statement in two places, not two statements.)*
- [x] **SEAM-03**: `r2000-coverage.ts`'s store contact is reduced to a named, repointable boundary — measured as two functions comparing against upstream's Rust `Display` strings — so the coverage census survives the substrate swap intact rather than being deleted as glue. `COV-01`/`COV-02`'s census-versus-store boundary test passes against the new store

### Store Core

<!-- The store itself. STORE-01's vocabulary is the milestone's one irreversible
     decision: split-table orientation is unrecoverable from data that never
     recorded it. -->

- [x] **STORE-01**: The store holds labels, comments, per-range data typing, scopes and project enums, with per-range typing covering the **full 12-member vocabulary** read off `r2000_set_data_type`'s own schema — not the 7 v0.6.0 named, because "table" is four distinct split layouts and collapsing them re-creates the exact `da65` expressiveness boundary this project rejected `cc65` for
- [x] **STORE-02**: Ranges are stored as ranges and are **never merged on adjacency**, so no splitter concept is needed and none is introduced — the manifest's named blocker for `DECOMP-01` and `BUILD-02`, and the over-merge bias it predicts for `COV-01`, are designed out by construction rather than worked around
- [x] **STORE-03**: A narrowest-range-wins lookup over the 64K space is exact at every one of the 65,536 addresses, verified by cross-validating two independent implementations rather than by spot checks — the tie-break, the range ends, and the behaviour when a typed range is partially overwritten all pinned
- [x] **STORE-04**: The store survives a process restart and an edit can be reverted, proven by **one combined planted-violation test** — mutate → `SIGKILL` with no clean close → fresh process → reopen → read returns the mutation → revert returns the prior value — and removing the commit makes that same test go **red**, observed. One test rather than two, because an in-memory journal passes both separate tests while satisfying neither claim
- [x] **STORE-05**: The schema carries a version field and a reserved bank field from the first write, and cross-reference rows carry their access kind (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`). All three are free at decode time and unrecoverable afterwards; the bank field is reserved and **not** interpreted, since `PROOF-03` is recorded `could-not-run` and `memmap.json` is flat
- [x] **STORE-06**: Cross-references and search over the typed decode are answerable — which addresses reference a given address, and search across labels, comments and instructions — built on the surviving `disasm-*` decoders, with the old route gone rather than kept as a fallback
- [x] **STORE-07**: `node:sqlite` is reached through exactly one seam module, so the store's dependence on an API still marked *active development* on the Node 22 line is confined to one file rather than spread across the store

### MCP Surface

<!-- Derived from a committed artifact, not designed. 18 of 19 curated verbs
     have a named consumer; `r2000_delete_project_enum` has zero callers
     anywhere and is the one verb the measured test cuts. -->

- [x] **MCP-01**: The tool surface is **derived from Phase 19's `upstream-procedure-manifest.json`** rather than chosen — every verb it classifies `curated` or `adapt-to-address-input` has a route, every verb it classifies `omit` is absent, and the one verb with zero callers anywhere (`r2000_delete_project_enum`) is not carried. The derivation is checked mechanically, so a future verb added without a consumer fails
- [x] **MCP-02**: The family registers proxy-locally through `buildViceTool()` and never reaches `forwardToVice()`, satisfying CLAUDE.md's derived-tool path-translation constraint **by construction** — no interception to forget. Pinned by the body-slice assertion that the runner contains none of `forwardToVice` / `ensureViceSession` / `rewriteArguments`. **`D-01` (2026-08-29) superseded this requirement's assumption that the assertion would be an *existing* one still policing a coexisting old family.** The owner chose deletion over unregister-and-quarantine, so the old family is deleted in this same phase and no coexistence happened. The assertion was therefore **re-pointed in place** onto the new family's runner — `BACKEND_SEAM_BYPASS_KEYS`'s second entry renamed rather than added to — in the commit that broke it, and re-proven by a planted violation against the real post-deletion tree. Nothing was deleted to make it pass
- [x] **MCP-03**: Backend-agnosticism is structural, expressed where it actually lives — `stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS` ordered allow-list — and **not** by an entry in `capability-registry.ts`, which holds only the per-backend delta a proxy-local family does not have. Neither manifest nor `docs/tool-support.md` gains an entry
- [ ] **MCP-04**: The surface is shaped for an agent rather than a cursor: addressing is by explicit address, edits are batchable and idempotent, and an ambiguous or unsupported request **refuses by name** — reporting `{available:false, reason}` rather than a plausible-looking zero, per this project's existing convention
- [x] **MCP-05**: Every guard that breaks on **registration rather than deletion** is repointed in the commit that registers the family — `generate-tool-support-table.mjs:104`'s hard-coded `R2000_TOOL_DEFINITIONS` regex and its two deliberate duplicates, and `hostpath-consumers.test.ts`'s `R2000_MODULE_FLOOR`. **`D-01` (2026-08-29) falsified the clause that closed this requirement** — *"Both families coexist at this point, so nothing is deleted to make them pass"*. Presented with unregister-and-quarantine, the owner chose deletion, so the old family is deleted in this same phase and that coexistence did not happen. The clause is edited rather than left standing beside the outcome that contradicts it, and rather than silently deleted. What replaces it is the ordering that keeps the guards' correctness provable without coexistence: **each guard moved in the commit that broke it** — registration-time guards with the registration (29-01), rename-time guards with the `git mv` (29-05), deletion-time guards with the deletion (29-10) — and each was re-proven by a **planted violation observed red against its new subject and reverted**, so no guard was made to pass by deleting what it asserted over. The sentence listing the guards, above, is unchanged: `D-13` records that its wording already anticipated re-pointing rather than deletion and so survives `D-01` unedited

### ACME Export

<!-- v0.6.0's STORE-06 asserted this reuses an existing `--verify` seam. It does
     not: that seam invokes regenerator2000 and parses ITS transcript. Only the
     discipline survives. -->

- [ ] **EXPORT-01**: The store exports ACME source, and correctness is established by **a real ACME actually assembling it** — through a verify path built for this purpose, since the existing `--verify` seam invokes regenerator2000 rather than ACME. The surviving discipline is carried explicitly: never trust the exit code, require unanimity, and a skipped assembler is not a pass. Proven by **two mandatory reds** — an exit-1 run where ACME passed, and an exit-0 run where ACME never ran
- [ ] **EXPORT-02**: Both carried idioms are load-bearing in that reassembly rather than merely emitted: a self-modifying write target named by the `=*+$01` mid-instruction label reassembles byte-identically, and the **11** typed label prefixes already owned by `AUTO_NAME_PREFIX_RE` are carried — not a five-prefix reimplementation, which would silently break `routine-queue-walker`'s backlog construction. Neither idiom exists in this codebase today; both are built, not preserved
- [ ] **EXPORT-03**: Correctness is never claimed from a string match on the exporter's own output. This project's own record is that an internally-checked opcode table still shipped 14 wrong entries, and illegal opcodes ACME cannot assemble are reported as such rather than emitted and hoped for

### Procedure Re-pointing

<!-- The absorbed prose is already this project's; the route underneath it is
     not. Measured: 10 files under src/skills/, 18 distinct tool names, plus a
     gitignored-but-shipped twin tree. -->

- [ ] **REPOINT-01**: All five absorbed procedures run on the new surface with their heuristics intact — block-classification tables, symbol data-flow patterns, the BASIC V2 token table, the routine procedure and its pitfalls, the full-program orchestration — across the **10 files under `src/skills/`** that reference r2000 and its **18 distinct tool names**, including `scripts/packer-finding.mjs` (executable), `templates/memory-map.template.md` (copied into consuming projects), and two `references/*.md`
- [ ] **REPOINT-02**: The `installer/skills/` twin tree is re-pointed in the same change. It is **gitignored yet shipped in the published tarball** — `git ls-files installer/skills` returns 0 — so any gate implemented over tracked files is structurally blind to it while users receive it. `scripts/check-npm-packages.mjs` proves the shipped copy matches
- [ ] **REPOINT-03**: The `ABS-02` attribution chain survives the code's deletion, because the prose remains adapted from regenerator2000 — 5 blocks in 3 files under `src/skills/` plus their 5 synced twins, 10 instances across two trees, each carrying two naming lines. Separately, `routine-queue-walker/SKILL.md:3`'s YAML `description:` names regenerator2000 and must change **substantively** rather than be exempted, which re-triggers `ABS-03`'s pairwise trigger-collision check across all seven skill descriptions
- [ ] **REPOINT-04**: `upstream-procedure-manifest.json` is updated in the same commit that changes what it describes — its own third re-sync trigger requires it, and `r2000_undo`'s `omit` disposition is one v0.7.0 supplies a criterion for

### The Cutover

<!-- Last, non-negotiably: before the re-pointing lands, a grep gate cannot tell
     "not yet re-pointed" from "reintroduced". -->

- [ ] **CUT-01**: The regenerator2000 integration is deleted — a **net 10,066 lines** of the **26,023-line, 35-file** `r2000-*.ts` surface (10,035 non-test + 15,988 test), the remaining **15,957 lines** surviving under new names. These figures supersede v0.6.0's `CUT-01`/`CUT-02`, which asserted 19,181: the surface was 26,023 rather than 19,181, and a phase sized at 26.0k deletes the coverage instrument and the enum generator.

  **Provenance, carried here rather than in a footnote, so a later reader re-derives every figure instead of taking it on trust.** Pre-phase end measured at commit `8f21d77` (the Phase 29 open); surviving end at `f16d0b1` (the phase HEAD this correction was written against). File-selection predicate at `8f21d77`: `git ls-tree -r --name-only 8f21d77 -- src/mcp/vice` filtered by `^src/mcp/vice/r2000-.*\.ts$` — 35 files, with `r2000-regbits.json` excluded because the requirement is a `.ts` claim. Predicate at `f16d0b1`: the `anno-*` name-descendants of that same set, plus the three renamed test files `absorbed-answer-key.test.ts`, `spawn-seam.test.ts` and `docs-absorbed-decisions.test.ts` that `29-VERIFICATION.md` enumerates individually. Counting command at **both** ends, so "lines" has one definition across the subtraction rather than two that merely get compared: `git show <commit>:<path> | wc -l`, summed over the selected set.

  **Re-derivation status, stated rather than implied, because a figure whose provenance does not reproduce is the condition this entry exists to fix.** The pre-phase end re-derives **exactly**: 26,023 = 10,035 non-test + 15,988 test across 35 files at `8f21d77`. The surviving end does **not** re-derive under the predicate above — at `f16d0b1` it yields 19,714 (20 `anno-*` name-descendants totalling 18,728, plus the three named files totalling 986), and the same predicate yields 18,728 at `d30b63e`, the commit that recorded the verification, so the divergence is not commit drift. The **15,957 recorded here is `29-VERIFICATION.md`'s as-measured figure**, kept because the owner decided on these specific numbers on 2026-08-30 and an executor's re-measurement is a finding rather than a licence to substitute; the divergence and the three candidate set-definitions tried against it are recorded in `29-17-SUMMARY.md` for a later reader to adjudicate. The net figure 10,066 is the subtraction 26,023 − 15,957 and inherits that same status
- [x] **CUT-02**: The grep gate's scope is chosen against measured blast radius and defended in both directions. 291 tracked files mention regenerator2000, **55 outside `.planning/`**, so ~236 legitimately keep the word permanently: a whole-tree gate produces 236 false fires and gets switched off, while the `toacme` precedent's real scope (`src/skills/` + `README.md` + `src/mcp/vice/` + `docs/stock-vice-parity.md`) is blind to `docs/`, `scripts/`, `installer/` and both tarballs. Proven by **three plants** — a `.ts`, a `docs/` file and a `scripts/` file — each observed biting
- [x] **CUT-03**: The gate's exemption set carries its own **non-vacuity assertion**: deleting an attribution block must trip it. An exemption nothing can violate is not an exemption
- [ ] **CUT-04**: Every guard and CI script pinned to the deleted subject has a recorded fate and none passes **vacuously** — measured mechanically at the v0.7.0 open, resolving the research documents'
  disagreement: **32 test files** (19 `r2000-`named plus 13 non-`r2000-`named that
  reference it) and **11 files under `scripts/`**, not the 2 CI scripts first
  named — the extras include `scripts/lib/r2000-cli-verbs.mjs` and two `.d.mts`
  declarations, `audit-gate.mjs`, `check-npm-packages.mjs`,
  `check-skill-fork-honesty.mjs` and `skill-honesty-checks.mjs`. Each re-pointed guard's own planted violation is re-run, because a guard that cannot be made to fail has not been re-pointed. Named explicitly: `docs-linerefs` (deletion shifts its cited line numbers), `docs-dangling-refs` (asserts its scanned doc set exists, so `CLAUDE.md` must be edited), `docs-r2000-decisions` (pins D-36; renamed to `docs-absorbed-decisions` by plan 29-05, in the same commit as `scripts/audit-gate.mjs`'s registry entry per `D-12`), `hostpath-consumers`, `stock-dispatch`, `vice-proxy`, `capability-registry`, `skill-attribution`, `tool-support-table`, `check-skill-tool-coverage.mjs`, `generate-tool-support-table.mjs`

  - **Why this requirement STAYED in Phase 32 when `CUT-01`, `CUT-02`, `CUT-03` and `CUT-05` were pulled forward into Phase 29 — a recorded decision, not an omission.** `CUT-04` is a **retrospective vacuity audit**, and its subject does not exist until the last guard has moved. Phase 29 re-pointed a large guard set — `hostpath-consumers.test.ts`'s module floor, `check-skill-tool-coverage.mjs`'s CLI-verb and skill-coverage floors, `anno-derivation.test.ts`'s manifest-versus-surface non-vacuity relation, the `docs-absorbed-decisions` / `audit-gate.mjs` pair, `check-skill-fork-honesty.mjs`'s re-pointed README assertion, and `spawn-seam.test.ts` re-pointed onto the emulator spawn seam — and proved each non-vacuous **individually, at the commit that moved it**, under that phase's own standing prohibition. What `CUT-04` adds is the **mechanical sweep over the whole set at once, measured after the dust settles**, which is a different check and one that cannot be run before the last guard has moved. Phase 32 is therefore the only place it can be honest, and **Phase 29 is the source of most of the guards it will audit** — this requirement's scope grew rather than shrank. Stated in agreement with the same reason recorded in `ROADMAP.md` § Phase 32's notes.

- [x] **CUT-05**: `check-skill-fork-honesty.mjs:504`'s direct contradiction is resolved in one change — it asserts `acme-build/SKILL.md` still contains `"r2000 export-asm"`, so cleansing the skills fails its `need()` while keeping the string fires the new gate. The resolution names which side is correct
- [ ] **CUT-06**: Every living document naming regenerator2000 as a **required prerequisite** is corrected — install documentation, `CLAUDE.md`'s three constraint bullets, `PROJECT.md`'s constraints and Key Decisions rows, `THIRD-PARTY-NOTICES.md`'s dual-licence notice (which remains true for the retained prose), and all seven skill playbooks — because a skill pointing at a deleted route is worse than one pointing at nothing

## Held for v0.8.0

<!-- v0.6.0's Phases 24 and 26. HELD, not cut: nothing about them was falsified,
     only their substrate is missing. Numbers reserved, text unchanged. -->

Both phases are blocked behind one thing: **a frame-exact emulator stop**, which
nothing owns (verification warning W4 on Phase 23; tracked in
`todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`). Of Phase 23's
two capture blockers the hex-transcription half is solved with a validated method;
this is the remaining one.

### Phase 24 — The Two Engines

- **DXA-01..03**, **GHID-01..05**, **OPC-01..03** — text unchanged. Recoverable
  verbatim from this file at commit `2421f68` (`git show 2421f68:.planning/REQUIREMENTS.md`),
  and restated per phase in `ROADMAP.md`'s Phase 24 detail, which is not archived
  precisely because these are held rather than shipped.

### Phase 26 — Automatic Annotation

- **AUTO-01..07** — text unchanged. `AUTO-04`/`AUTO-05` were already recorded as
  *unvalidated rather than narrowed* at the Phase 23 close.

### The gate itself

- **PROOF-01..03** — recorded `could-not-run`, not `not-exercised` and not a pass.
  `PROOF-04`/`PROOF-05` are complete.

## Future Requirements

### The rebuild half (v0.9.0 — text unchanged in `milestones/v0.5.0-REQUIREMENTS.md`)

- **DECOMP-01..04**, **BUILD-01..06**, **EQUIV-01..04**. Re-mapped from v0.7.0 to
  v0.9.0 on 2026-08-26: each is written against a substrate v0.7.0 now builds, and
  `DECOMP-01` is precisely what `STORE-01`'s 12-member vocabulary is sized for.
  `BUILD-01` is already reworded from "per regenerator2000 scope" to "per
  annotation-store scope".

### Deferred with a named trigger, not scoped here

- **`set_immediate_format`** and the **emitted/non-emitted comment flag** — both
  have named *future* consumers (`BUILD-03`; the exporter) and no caller today.

- **Analysis built on the xref access-kind field** — the field is stored by
  `STORE-05` because it is free now and unrecoverable later, but no shipped caller
  reads it until `GHID-05` unholds.

## Out of Scope

Explicitly excluded, with reasoning, to prevent re-adding.

| Feature | Reason |
|---------|--------|
| Parity with regenerator2000's feature set | Owner decision 2026-08-26. r2000 is out of scope and is eliminated; the store is built to what this project needs. This removes v0.6.0's "same facts" deletion gate and `STORE-04`'s `R2000-11` carry-across |
| A per-edit inverse-command undo journal | `D2`. Zero callers measured; the Phase 19 manifest disposes `r2000_undo` as `omit`; Node's `sqlite` does not expose `sqlite3changeset_invert`. Whole-store snapshot/restore serves the requirement that has a consumer |
| An entry in `capability-registry.ts` | `D3`. The registry holds only the per-backend delta, and a proxy-local family has none. Adding one would be a factual error, not merely redundant |
| `better-sqlite3` or any other new runtime dependency | `node:sqlite` is a built-in at this project's Node floor. `better-sqlite3` 13.0.3 needs no install script and ships 8 prebuilds, so the native-build objection is out of date — it loses on 11.4 MB unpacked per consumer and a hard `MODULE_NOT_FOUND` off its eight targets |
| An interval-tree library | All six surveyed packages return *every* overlap with no narrowest-wins tie-break, and one has no licence field. A paint array resolves in 0.018 µs against SQL's 42.6 µs in ~60-120 owned lines |
| Bank-qualified addressing as a modelled feature | `PROOF-03` is `could-not-run`, `memmap.json` is flat, and Ghidra's own answer still leaves bank-switch analysis manual. `STORE-05` reserves the field; nothing interprets it |
| `r2000_delete_project_enum` | Zero callers anywhere. `gen-enums` re-runs via create-then-update |
| Multi-assembler output (64tass / ca65 / KickAssembler) | r2000 supported all three; this project's fixed target has always been ACME / `!cpu 6510` / cbm. No shipped-skill caller |
| Byte-perfect binary reconstruction | Owner decision 2026-08-24. Source quality and functionality are the goal |
| The two upstream contributions | VICE's `KEYBOARD_MATRIX_SET` and regenerator2000's `--mcp-port`/`--mcp-bind`. Pull requests against projects this repo does not own. Standing, not scoped — and the second becomes moot on this milestone's landing |

## Traceability

Which phases cover which requirements. Populated at roadmap creation,
2026-08-26. Every v0.7.0 requirement maps to **exactly one** phase; the mapping is
`ROADMAP.md`'s per-phase `**Requirements**:` lines, and this table is the index
over them.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEAM-01 | Phase 27 | Complete |
| SEAM-02 | Phase 27 | Complete |
| SEAM-03 | Phase 27 | Complete |
| STORE-01 | Phase 28 | Complete |
| STORE-02 | Phase 28 | Complete |
| STORE-03 | Phase 28 | Complete |
| STORE-04 | Phase 28 | Complete |
| STORE-05 | Phase 28 | Complete |
| STORE-07 | Phase 28 | Complete |
| MCP-01 | Phase 29 | Complete |
| MCP-02 | Phase 29 | Complete |
| MCP-03 | Phase 29 | Complete |
| MCP-04 | Phase 29 | Gaps Found |
| MCP-05 | Phase 29 | Complete |
| STORE-06 | Phase 29 | Complete |
| EXPORT-01 | Phase 30 | Pending |
| EXPORT-02 | Phase 30 | Pending |
| EXPORT-03 | Phase 30 | Pending |
| REPOINT-01 | Phase 29 | Gaps Found |
| REPOINT-02 | Phase 29 | Gaps Found |
| REPOINT-03 | Phase 31 | Pending |
| REPOINT-04 | Phase 31 | Pending |
| CUT-01 | Phase 29 | Gaps Found |
| CUT-02 | Phase 29 | Complete |
| CUT-03 | Phase 29 | Complete |
| CUT-04 | Phase 32 | Pending |
| CUT-05 | Phase 29 | Complete |
| CUT-06 | Phase 32 | Pending |

**SIX ROWS MOVED TO PHASE 29 ON 2026-08-30, by `D-01` — MOVED, NOT DUPLICATED.** `D-01` put the deletion inside Phase 29 rather than Phase 32, and the re-pointing that had to precede it came with it. `REPOINT-01`, `REPOINT-02`, `CUT-01`, `CUT-02`, `CUT-03` and `CUT-05` therefore now map to **Phase 29**; Phases 31 and 32 no longer name them on their own `**Requirements**:` lines, so every requirement still maps to **exactly one** phase and this table remains what it says it is — the index over the roadmap's per-phase lines, not a second opinion about them. Phases 30 to 32 were **narrowed, not renumbered**: phase numbers are cited from tracked, guarded files, so a renumber rewrites every row while a narrow rewrites only the rows whose phase actually moved.

**`CUT-04` and `CUT-06` STAY mapped to Phase 32, and `CUT-04`'s retention is the one that needs a reason rather than an omission.** `CUT-04` is a **retrospective vacuity audit** over the whole re-pointed guard set, and its subject does not exist until the last guard has moved — which is Phase 29's close. Phase 29 proved each re-pointed guard non-vacuous *individually*, at the commit that moved it; what `CUT-04` adds is the mechanical sweep over the set **at once, after the dust settles**, and that cannot be run early. Phase 32 is the only place it can be honest, and Phase 29 is the source of most of the guards it will audit — so its scope grew rather than shrank. The full reason is recorded beside `CUT-04` itself above and in `ROADMAP.md` § Phase 32's notes, in agreement.

**`CUT-01` MOVES BACK DOWN to `Gaps Found` on 2026-08-30, by the re-verification pass — superseding the move-up paragraph below, which is kept as the record rather than deleted.** `29-VERIFICATION.md` (2026-08-30T15:20Z) re-measured the requirement independently, under the predicate this entry itself documents, and scores it ✗ **BLOCKED**. The **substantive** claim is confirmed and is not in dispute: zero `r2000-*.ts` files remain under `src/mcp/vice/`, and the removal gate is green tree-wide with an empty temporary allow-list. What fails is narrower and is the entry's whole stated purpose — that its numbers are the measured ones. The pre-phase figure re-derives **exactly**. The surviving-line figure does **not**, at any commit in the phase: the verifier swept every one of them, so this is not commit drift, and two alternative set-definitions miss in both directions. The net-removal figure is the subtraction and inherits the same status. Per this file's own standing rule, the checkbox, this paragraph and the traceability row move together — moving the row alone is the failure the audit gate exists against. **The remedy is a text edit and touches no code:** either state the predicate under which the recorded figure re-derives, or correct the sentence to the re-measured figures in the same edit as the row. Until one of those happens the row may not read `Complete`, because the entry currently asserts as measured a figure the same entry records as non-reproducing, and a reader cannot act on both halves.

**`CUT-01` MOVES UP to `Complete` on the OWNER's decision of 2026-08-30, after the measurement that had never been taken was taken — and its sizing sentence was rewritten in the same edit as its row.** The pass happened: `29-VERIFICATION.md` measured the requirement for the first time and scored truth 6 `✗ FAILED`, falsifying **all three** of the original figures in the same direction: the pre-phase surface was larger than stated (26,023 lines across 35 files, 10,035 non-test + 15,988 test), more survived under new names than stated (15,957 lines), and the net removal was therefore **smaller** than the approximate figure the requirement had claimed (10,066 lines). The three superseded figures are deliberately not reproduced here — they are recoverable from `29-VERIFICATION.md` and from this file's own history, and restating them would re-seed falsified numerals into a record whose whole purpose is that its numbers are the measured ones. The report's `human_verification` item put exactly two options to the owner: correct the text to the measured figures and mark the requirement `Complete`, or accept the shortfall as intended scope and hold the row at `Partial` with a recorded reason. **The owner chose the first on 2026-08-30**, and this entry implements that choice — checkbox, sizing sentence, this paragraph and the traceability row all changed together, because moving the row without rewriting the sentence it scores is the failure the audit gate exists against and the failure the verifier named in the same breath as the decision. The **substantive** claim was independently confirmed by that same pass rather than inherited from a summary: **zero** `r2000-*.ts` files remain under `src/mcp/vice/`, and the removal gate is green tree-wide with an **empty** temporary allow-list, re-observed biting on four independent plants.

**The paragraph this replaces was correct when it was written, and is superseded rather than wrong.** It held that marking `CUT-01` `Complete` would claim a measurement nobody had taken — citing `29-10-SUMMARY.md`, which said in its own words that `CUT-01` was NOT being marked complete because the requirement sized a net removal far larger than the 8,221 lines that plan delivered — and that a verification pass re-measuring the figures was what would move the row. That reasoning was sound, that pass has now run, and its verdict plus the owner's decision are what move the row here. A reader meeting both paragraphs in the history can tell which one is live: this one, dated 2026-08-30. `29-11-SUMMARY.md`'s wording of the `Partial` record is superseded by the same decision. One figure in the corrected sentence — the 15,957 surviving-line count — did not re-derive when re-measured during this correction; that is recorded in the entry itself and adjudicated in `29-17-SUMMARY.md` rather than quietly reconciled, because a status that hides a disagreement in its own evidence is the thing this paragraph is here to prevent.

**This phase's six requirement statuses, each with the summary that evidences it.** No status claims more than its evidence, and none is a self-assessment of the plan that wrote this line:

| Requirement | Status | Evidencing summaries |
|---|---|---|
| `MCP-01` | Complete | `29-03-SUMMARY.md`, `29-06-SUMMARY.md`, `29-08-SUMMARY.md` (the derivation made mechanical, in both directions, plus the committed verb register) |
| `MCP-02` | Complete | `29-01-SUMMARY.md` (registration through `buildViceTool()`), `29-10-SUMMARY.md` (the family never reaches `forwardToVice()`; `CLAUDE.md`'s constraint restated with re-measured citations) |
| `MCP-03` | Complete | `29-01-SUMMARY.md` (`BACKEND_SEAM_BYPASS_KEYS` renamed in place; neither manifest gains an entry; `docs/tool-support.md` byte-identical) |
| `MCP-04` | Gaps Found | `29-VERIFICATION.md` (Requirements Coverage, `MCP-04` row) is the authority, and it scores this requirement ✗ **BLOCKED**: *"Explicit addressing, idempotence and per-item batch status all hold — but CR-01 delivers exactly the 'plausible-looking zero' this requirement names, and CR-06 makes the batch's documented nesting unusable with a message contradicting the tool's own description."* So the row records a partial truth precisely rather than flattening it: three clauses — explicit addressing, idempotent edits, per-item batch status — DO hold on `29-03-SUMMARY.md` and `29-06-SUMMARY.md`; the refusal-by-name clause and the documented nesting do not, on **CR-01** and **CR-06** |
| `MCP-05` | Complete | `29-01`, `29-02`, `29-05`, `29-07`, `29-08`, `29-09` (every guard moved in the commit that broke it, each re-proven by a planted violation observed red and reverted) |
| `STORE-06` | Complete | `29-04-SUMMARY.md` (derived cross-references and search, never cached on disk), `29-07-SUMMARY.md` |

**`MCP-04`'s row in the table above was corrected DOWNWARD on 2026-08-30, and the correction needed making because this table and the traceability table were answering the same question differently.** `e87650e` reverted the premature `Complete` statuses after the gaps were found, but it reached the traceability table only — which has read `Gaps Found` for `MCP-04` ever since — while this table, introduced as current fact rather than as a dated snapshot, went on asserting `Complete` for the same requirement that `29-VERIFICATION.md` had already scored BLOCKED on two independently reproduced defects. A record that answers one question twice with different answers is the condition the audit gate exists against, and the stale half was the live claim. The row moves back UP only on a **re-verification verdict** — never on the completion of the gap-closure plans that address `CR-01` and `CR-06`, and never on an executor's reading of its own work.

**Four STORE rows read `Complete` at the close of the FIFTH gap-closure round (28-19..28-22), and two deliberately do not.** `STORE-02`, `STORE-05` and `STORE-07` are unmoved from the fourth round's close, on the evidence recorded there: 28-15's four named non-vacuity controls each re-run and quoted individually rather than aggregated, `node:sqlite` resolving to exactly one shipped module, and both store modules absent from the five-element host-path consumer set. 28-22's closing gate re-observes every one of those controls individually on the FINAL tree of round 5, after three plans rewrote `anno-store.ts`.

**`STORE-04` moves UP to `Complete`, and the authorising sentences are the phase verifier's own, not this round's opinion of its own work.** Round-5 verification (`.planning/phases/28-the-store-core/28-VERIFICATION.md`, Requirements Coverage table, STORE-04 row) scores it `✓ SATISFIED` and states: *"Both halves now hold. The combined test and its live subprocess planting are green (truth 5), and the REVERT half — round 4's recorded blocker — is closed and re-driven over three input classes (truth 12). `.planning/REQUIREMENTS.md` records `Gaps Found` with CR-08 as the reason; **CR-08 is closed and that row can move to `Complete`.**"* The same report's Gaps Summary adds, of the three record moves it asks for: *"Per prohibition 28-18 P2 the rows move only on a verification verdict — this is that verdict, and the sentences above are the authorising ones."* **`CR-08` is CLOSED**, by 28-16, and the verifier re-drove it over three different kinds of unusable image, all refusing identically with the live store byte-identical and the caller's handle still alive; 28-22's closing gate re-drives it once more on the final tree. That closure is why this row moves, and the row moved on that sentence rather than on an executor's reading of its own work.

**`STORE-01` MOVES UP to `Complete`; `STORE-03` STAYS `Gaps Found`, and its blocker is now `CR-10` rather than `CR-09`. The authorising sentences are the ROUND-6 phase verifier's own, not this round's opinion of its own work.** Round-6 verification (`.planning/phases/28-the-store-core/28-VERIFICATION.md`, §Requirements Coverage table, `STORE-01` row) scores it ✓ **SATISFIED — row may move to `Complete`** and states: *"Round 5's blocking reason (“persists a typing it refuses at its own entry point and its own resolver cannot decode”) is no longer true of any row: CR-09 is closed and every CR-10 row is re-acceptable and decodable. Vocabulary driven as exactly 12; labels, comments, scopes and enums all green. CR-10 attaches to STORE-03's partial-overwrite clause."* The same report's §2 is more explicit still, and names itself the authority: *"**STORE-01 is a change from round 5 and I state the reason.** Round 5 blocked STORE-01 on CR-09 with the stated reason ‘the store persists a per-range typing it refuses at its own entry point and its own resolver cannot decode.’ Neither half of that sentence is true any longer: every row CR-10 produces is re-acceptable and decodable. CR-10 attaches to the partial-overwrite clause, which is STORE-03's, not STORE-01's. **STORE-01 is SATISFIED and its row may move to `Complete`; this is the authorising verdict.** STORE-03 stays `Gaps Found`."* That last sentence is why `STORE-01`'s row moves here and `STORE-03`'s does not — per prohibition 28-18 P2 a row moves only on a verification verdict, and these are the verdict's own words rather than an executor's reading of its own work.

**`CR-09` IS CLOSED AND `CR-10` REPLACED IT AS `STORE-03`'s BLOCKER — the round-5 wording above this line is superseded, not merely stale.** `CR-09`, in one sentence: `retype()`'s split-and-preserve wrote a split-table row with an ODD byte count — a shape the store refuses at its own entry point and its own resolver cannot decode. It was closed by 28-19 and the round-6 verifier confirms the closure. `CR-10`, in one sentence: an EVEN fragment of a split table passes the parity gate, and because a split table pairs byte `i` with byte `n + i`, every surviving fragment re-pairs EVERY entry — so the surviving rows are legal, re-acceptable and decodable, and decode to 16-bit values the human who typed the table never recorded. The round-6 verifier's own sentence for `STORE-03` is the reason its row does not move: *"The first two clauses hold (oracle cross-validation, both ends, `$FFFF`, tie-break, length-1). The third does not: the partial-overwrite behaviour for the four split members is pinned to an outcome that discards every recorded target (`preserved 0/8` across five geometries). CR-10."* `CR-10` is dispositioned `gap-closure round 6` in that report's `round_6_review_dispositions`, and the sixth gap-closure round (28-23) is what this entry records.

**This round is EXECUTED, not VERIFIED, and `STORE-03` moves only when a verification pass says so.** 28-23 has run and committed; no verification pass has yet scored the tree it produced. What it did about `CR-10`: the split layout's partner rule now has exactly ONE definition in the repo (`splitPartnerOffsets` in `anno-types.ts`), consumed by both `resolveSplitTargets()` and a new writer-side consumer `splitEntryAddressPairs()`; `retype()`'s pre-delete gate builds one re-interpretation record per fragmented split row and `setDataType()` returns it as data on a SUCCESSFUL result beside `contradictedComments`; the `anno-overlap.test.ts` case that pinned the corrupting outcome BY VALUE and named it legal now asserts the disclosure and the disjoint target sets; and a class-level invariant over ENTRY PAIRS — no split entry pair vanishes outside the caller's own range without being named by that write's own report — was observed going RED on two plantings before it was observed green. The phase verifier remains the authority on every row above, and an executor's confidence in its own fix is not a verdict.

**Both `behavior_unverified` items are STILL OPEN, carried forward with their reasons unchanged, and are claimed closed by NOTHING in round 6** (prohibition 28-18 P3):

| Item | Status after round 6 | Reason, carried unchanged from `28-VERIFICATION.md` |
|---|---|---|
| `openStore`'s `integrity_check could not be run at all` throw arm (`anno-store.ts:529-535`) | **STILL OPEN** — open since round 4 | *"The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection. Presence and wiring verified in source this round (`db.close()` precedes the throw, and the message names `resolved`); no test exercises the throw, and a 10-second spot-check cannot construct the precondition."* Nothing in 28-23 touches `openStore`. |
| 28-17's `backstop`-tagged host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit | **STILL OPEN** — abstained again as `insufficient_spec` | *"An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop`. Presence + wiring never qualify as behavioural evidence for a durability claim."* Nothing in 28-23 touches the snapshot path. |

**Coverage:**

- v0.7.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

**Two mappings worth explaining, because a family name does not decide a phase.**

- **`STORE-06` maps to Phase 29, not Phase 28.** It is answerability — *which
  addresses reference this address*, and search across labels, comments and
  instructions — which is only observable through the tool surface, and it is
  derived on every query from the surviving `disasm-*` decoders rather than stored.
  Research places `anno-xref`-class code in the surface phase for that reason. The
  store core (Phase 28) owns what is *stored*; Phase 29 owns what is *asked*.

- **`STORE-07` maps to Phase 28, with `STORE-06` its only family sibling
  elsewhere.** The one-seam confinement of `node:sqlite` is a property of the
  persistence layer and is asserted structurally there, before any surface exists
  to spread it across.

**Held and future requirements are deliberately unmapped here.** `DXA-*`,
`GHID-*`, `OPC-*`, `AUTO-*` and `PROOF-*` stay held with v0.6.0's Phases 24 and 26
(see "Held for v0.8.0" above), and `DECOMP-*`, `BUILD-*` and `EQUIV-*` are v0.9.0.
Neither set is in this milestone's denominator.

---
*Requirements defined: 2026-08-26*
*Last updated: 2026-08-30 — plan 29-11: `D-01`'s falsified clauses edited in `MCP-02` and `MCP-05`, the `R2000-14`/`R2000-15` withdrawal recorded beside `SEAM-02`, and six rows moved to Phase 29 as Phases 30-32 were narrowed (Phases 27-32, 28/28 mapped, exactly one phase each)*
