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

- [ ] **SEAM-01**: The ACME availability gate is extracted out of `r2000-test-gate.ts` under a name that does not say `r2000`, keeping `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` working for `disasm-roundtrip.test.ts` and `skill-acme-build-cli.test.ts` — and `ci.yml` is repointed in the same commit, because CI binds those names directly (`ci.yml:45-140`). Proven by observing a missing-ACME run **FAIL** under `VICE_REQUIRE_ACME=1`, not skip
- [ ] **SEAM-02**: Every `r2000-*` module that is a **capability rather than glue** is identified by what it does and not by its name prefix, and the classification is recorded before any deletion — at minimum `r2000-test-gate`, `-acme-ident`, `-confidence`, `-symbols` (which *implements* the ✓ Validated `R2000-14`/`R2000-15` symbol round trip), `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen` and `-coverage`. A module whose only claim to deletion is its prefix is not deleted
- [ ] **SEAM-03**: `r2000-coverage.ts`'s store contact is reduced to a named, repointable boundary — measured as two functions comparing against upstream's Rust `Display` strings — so the coverage census survives the substrate swap intact rather than being deleted as glue. `COV-01`/`COV-02`'s census-versus-store boundary test passes against the new store

### Store Core

<!-- The store itself. STORE-01's vocabulary is the milestone's one irreversible
     decision: split-table orientation is unrecoverable from data that never
     recorded it. -->

- [ ] **STORE-01**: The store holds labels, comments, per-range data typing, scopes and project enums, with per-range typing covering the **full 12-member vocabulary** read off `r2000_set_data_type`'s own schema — not the 7 v0.6.0 named, because "table" is four distinct split layouts and collapsing them re-creates the exact `da65` expressiveness boundary this project rejected `cc65` for
- [ ] **STORE-02**: Ranges are stored as ranges and are **never merged on adjacency**, so no splitter concept is needed and none is introduced — the manifest's named blocker for `DECOMP-01` and `BUILD-02`, and the over-merge bias it predicts for `COV-01`, are designed out by construction rather than worked around
- [ ] **STORE-03**: A narrowest-range-wins lookup over the 64K space is exact at every one of the 65,536 addresses, verified by cross-validating two independent implementations rather than by spot checks — the tie-break, the range ends, and the behaviour when a typed range is partially overwritten all pinned
- [ ] **STORE-04**: The store survives a process restart and an edit can be reverted, proven by **one combined planted-violation test** — mutate → `SIGKILL` with no clean close → fresh process → reopen → read returns the mutation → revert returns the prior value — and removing the commit makes that same test go **red**, observed. One test rather than two, because an in-memory journal passes both separate tests while satisfying neither claim
- [ ] **STORE-05**: The schema carries a version field and a reserved bank field from the first write, and cross-reference rows carry their access kind (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`). All three are free at decode time and unrecoverable afterwards; the bank field is reserved and **not** interpreted, since `PROOF-03` is recorded `could-not-run` and `memmap.json` is flat
- [ ] **STORE-06**: Cross-references and search over the typed decode are answerable — which addresses reference a given address, and search across labels, comments and instructions — built on the surviving `disasm-*` decoders, with the old route gone rather than kept as a fallback
- [ ] **STORE-07**: `node:sqlite` is reached through exactly one seam module, so the store's dependence on an API still marked *active development* on the Node 22 line is confined to one file rather than spread across the store

### MCP Surface

<!-- Derived from a committed artifact, not designed. 18 of 19 curated verbs
     have a named consumer; `r2000_delete_project_enum` has zero callers
     anywhere and is the one verb the measured test cuts. -->

- [ ] **MCP-01**: The tool surface is **derived from Phase 19's `upstream-procedure-manifest.json`** rather than chosen — every verb it classifies `curated` or `adapt-to-address-input` has a route, every verb it classifies `omit` is absent, and the one verb with zero callers anywhere (`r2000_delete_project_enum`) is not carried. The derivation is checked mechanically, so a future verb added without a consumer fails
- [ ] **MCP-02**: The family registers proxy-locally through `buildViceTool()` and never reaches `forwardToVice()`, satisfying CLAUDE.md's derived-tool path-translation constraint **by construction** — no interception to forget. Pinned by the existing body-slice assertion that the runner contains none of `forwardToVice` / `ensureViceSession` / `rewriteArguments`
- [ ] **MCP-03**: Backend-agnosticism is structural, expressed where it actually lives — `stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS` ordered allow-list — and **not** by an entry in `capability-registry.ts`, which holds only the per-backend delta a proxy-local family does not have. Neither manifest nor `docs/tool-support.md` gains an entry
- [ ] **MCP-04**: The surface is shaped for an agent rather than a cursor: addressing is by explicit address, edits are batchable and idempotent, and an ambiguous or unsupported request **refuses by name** — reporting `{available:false, reason}` rather than a plausible-looking zero, per this project's existing convention
- [ ] **MCP-05**: Every guard that breaks on **registration rather than deletion** is repointed in the commit that registers the family — `generate-tool-support-table.mjs:104`'s hard-coded `R2000_TOOL_DEFINITIONS` regex and its two deliberate duplicates, and `hostpath-consumers.test.ts`'s `R2000_MODULE_FLOOR`. Both families coexist at this point, so nothing is deleted to make them pass

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

- [ ] **CUT-01**: The regenerator2000 integration is deleted — a **net ~12.4k lines** of the 25,759-line `r2000-*.ts` surface (10,102 non-test + 15,657 test), the remaining ~12.9k surviving under new names. Both figures correct v0.6.0's `CUT-01`/`CUT-02`, which asserted 19,181; a phase sized at 25.7k deletes the coverage instrument and the enum generator
- [ ] **CUT-02**: The grep gate's scope is chosen against measured blast radius and defended in both directions. 291 tracked files mention regenerator2000, **55 outside `.planning/`**, so ~236 legitimately keep the word permanently: a whole-tree gate produces 236 false fires and gets switched off, while the `toacme` precedent's real scope (`src/skills/` + `README.md` + `src/mcp/vice/` + `docs/stock-vice-parity.md`) is blind to `docs/`, `scripts/`, `installer/` and both tarballs. Proven by **three plants** — a `.ts`, a `docs/` file and a `scripts/` file — each observed biting
- [ ] **CUT-03**: The gate's exemption set carries its own **non-vacuity assertion**: deleting an attribution block must trip it. An exemption nothing can violate is not an exemption
- [ ] **CUT-04**: Every guard and CI script pinned to the deleted subject has a recorded fate and none passes **vacuously** — measured mechanically at the v0.7.0 open, resolving the research documents'
  disagreement: **32 test files** (19 `r2000-`named plus 13 non-`r2000-`named that
  reference it) and **11 files under `scripts/`**, not the 2 CI scripts first
  named — the extras include `scripts/lib/r2000-cli-verbs.mjs` and two `.d.mts`
  declarations, `audit-gate.mjs`, `check-npm-packages.mjs`,
  `check-skill-fork-honesty.mjs` and `skill-honesty-checks.mjs`. Each re-pointed guard's own planted violation is re-run, because a guard that cannot be made to fail has not been re-pointed. Named explicitly: `docs-linerefs` (deletion shifts its cited line numbers), `docs-dangling-refs` (asserts its scanned doc set exists, so `CLAUDE.md` must be edited), `docs-r2000-decisions` (pins D-36), `hostpath-consumers`, `stock-dispatch`, `vice-proxy`, `capability-registry`, `skill-attribution`, `tool-support-table`, `check-skill-tool-coverage.mjs`, `generate-tool-support-table.mjs`
- [ ] **CUT-05**: `check-skill-fork-honesty.mjs:504`'s direct contradiction is resolved in one change — it asserts `acme-build/SKILL.md` still contains `"r2000 export-asm"`, so cleansing the skills fails its `need()` while keeping the string fires the new gate. The resolution names which side is correct
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
| SEAM-01 | Phase 27 | Pending |
| SEAM-02 | Phase 27 | Pending |
| SEAM-03 | Phase 27 | Pending |
| STORE-01 | Phase 28 | Pending |
| STORE-02 | Phase 28 | Pending |
| STORE-03 | Phase 28 | Pending |
| STORE-04 | Phase 28 | Pending |
| STORE-05 | Phase 28 | Pending |
| STORE-07 | Phase 28 | Pending |
| MCP-01 | Phase 29 | Pending |
| MCP-02 | Phase 29 | Pending |
| MCP-03 | Phase 29 | Pending |
| MCP-04 | Phase 29 | Pending |
| MCP-05 | Phase 29 | Pending |
| STORE-06 | Phase 29 | Pending |
| EXPORT-01 | Phase 30 | Pending |
| EXPORT-02 | Phase 30 | Pending |
| EXPORT-03 | Phase 30 | Pending |
| REPOINT-01 | Phase 31 | Pending |
| REPOINT-02 | Phase 31 | Pending |
| REPOINT-03 | Phase 31 | Pending |
| REPOINT-04 | Phase 31 | Pending |
| CUT-01 | Phase 32 | Pending |
| CUT-02 | Phase 32 | Pending |
| CUT-03 | Phase 32 | Pending |
| CUT-04 | Phase 32 | Pending |
| CUT-05 | Phase 32 | Pending |
| CUT-06 | Phase 32 | Pending |

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
*Last updated: 2026-08-26 — traceability populated at roadmap creation (Phases 27-32, 28/28 mapped)*
