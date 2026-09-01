# Phase 29: The MCP Surface - Research

**Researched:** 2026-08-29
**Domain:** Proxy-local MCP tool-family design over a `node:sqlite` annotation store; structural-guard re-pointing; a driven deletion of an external integration
**Confidence:** HIGH for everything measured in-repo (the overwhelming majority); MEDIUM for the two places the locked decisions leave genuinely open

> **Everything factual in this document was measured against the working tree at
> commit `5e9d8ec` on 2026-08-29.** No package research was needed: this phase
> adds no external dependency (see `## Package Legitimacy Audit`). Where a
> number in `29-CONTEXT.md` or `.planning/ROADMAP.md` has drifted, the corrected
> figure is given with the command that produced it.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `.planning/phases/29-the-mcp-surface/29-CONTEXT.md` `<decisions>`.

**The anno exit (supersedes ROADMAP criterion 2 and MCP-05's coexistence clause)**

- **D-01 — anno is deleted in Phase 29, not unregistered and not deferred to
  Phase 32.** The user's directive: *"The anno usage is decided to be removed
  and if it can't be removed right now everything about it must be disabled and
  never be included in any tests."* Presented with unregister-and-quarantine
  (files kept, tests gated off, structural guards live) as the recommended
  option, the user chose deletion. ROADMAP.md criterion 2, `MCP-02`'s and
  `MCP-05`'s coexistence clauses, and the Phase 31/32 scope statements are edited
  in this phase to match — the record is not left describing a plan that was
  abandoned.
  — **Reversibility:** one-way — 26,023 lines of `anno-*.ts` and the
  the external analyser dependency. Restoring the route means restoring a deleted
  external integration and its pinned 0.9.20 crate, and the safety property
  criterion 2 was written to buy ("the replacement is demonstrably ready before
  anything is removed") cannot be re-bought after the fact.

- **D-02 — Scope of the cut: only the binary-driving glue is deleted; the CLI is
  renamed and keeps its capability-backed verbs.** The user answered "You decide"
  on what rides forward, and this is the call. **Deleted:**
  `anno-launch.ts`, `anno-mcp-client.ts`, `anno-session.ts`, `anno-tools.ts`,
  `anno-project.ts`, `scripts/lib/anno-cli-verbs.mjs`,
  `scripts/lib/anno-cli-verbs.d.mts` — every module `module-classification.ts`
  verdicts `glue`. **Renamed, not deleted:** `anno-cli.ts`, dropping only the
  three verbs that reach the spawn (`bootstrap`, `export-asm`, `verify`) and
  keeping the five that import capability modules only (`gen-enums`,
  `export-lbl`, `import-lbl`, `render-memmap`, `coverage`). Verified at
  discussion time by reading the CLI's own import list: `bootstrap`/`export-asm`/
  `verify` are the only verbs reaching `anno-launch.ts`. This is what lets the
  external dependency go in Phase 29 **without** inventing an export route ahead
  of Phase 30's oracle, so ordering constraint 2 is honoured rather than broken.
  — **Reversibility:** one-way — see D-01.

- **D-03 — The 11 `capability` modules are renamed out from under the prefix
  BEFORE anything is deleted, and the deletion is driven by
  `module-classification.ts`, never by a prefix sweep.** Measured at discussion
  time: Phase 27 delivered the classification registry and the ACME-gate
  extraction, but all 19 classified modules still carry `anno-` on disk. The
  survivors are `anno-acme-ident.ts`, `anno-confidence.ts`, `anno-coverage.ts`,
  `anno-d64.ts`, `anno-enum-gen.ts`, `anno-memmap-render.ts`,
  `anno-regbits-gen.ts`, `anno-regbits.json`, `anno-symbols.ts`,
  `anno-test-gate.ts`, `anno-verify.ts`. A prefix sweep would take
  `ANNO-14`/`ANNO-15`'s ✓ Validated symbol round trip and `COV-01`/`COV-02`'s
  census with it — the exact hazard Phase 27 exists to have removed.
  — **Reversibility:** costly — renames touch every importer; the registry is the
  evidence the rename set is complete.

- **D-04 — `parsePrg`/`flatImageOrigin` need no extraction work.** Measured: they
  already live in `src/mcp/vice/prg-image.ts`. `module-classification.ts` records
  `anno-project.ts`'s `glue-with-extractable` obligation as **discharged**, and
  its verdict is now plain `glue`. A planner must not re-derive this as
  outstanding work.

**The tool family**

- **D-05 — One prefix, `anno_` for tool names and `anno-` for modules.** Phase 28
  already put `anno-store.ts`, `anno-types.ts` and `anno-index.ts` on disk, so the
  module prefix is established and derivable by `readdirSync` plus a stable
  name-prefix regex — which is what the removal gate's rule ("a **single stable
  prefix derivable from disk**") requires, and what `hostpath-consumers.test.ts`
  and `spawn-seam.test.ts` are shaped for. `c64_` and `re_` were rejected:
  each costs a second prefix, makes the mechanical derivation read two names, and
  `re_` is a weak namespace token in an agent's tool list. Accepted cost: `anno_`
  reads narrow for the read verbs (`anno_disassemble`, `anno_get_binary_info`),
  which are about the program rather than the annotations.
  — **Reversibility:** costly — the prefix is baked into the derivation test, the
  tool-support table generator, the module floor, the grep gate and 9 skill files.

- **D-06 — Open/close per call, with an explicit store-path argument on every
  verb.** `openStore(path, { workspaceRoot })` and `closeStore` in a `finally`;
  no cross-call state anywhere. Two Phase 28 hazard classes become unreachable
  across calls by construction: `revertTo` returning a **new** handle (nothing
  cached to swap), and `transactionStateUnknown` wedging a connection (nothing
  reused). This deliberately **reverses Phase 18's Rule A21**, which chose a
  long-lived session — that decision existed to avoid respawning a
  the external analyser child process per call, and D-02 deletes the child process, so
  its premise is gone. The argument mirrors anno's `project` shape.
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

- **D-08 — Derivation is checked against the manifest, and verbs the manifest
  does not classify live in a second committed register.** The mechanical test
  asserts three things against
  `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`:
  every verb classified `curated` or `adapt-to-address-input` has a route, every
  verb classified `omit` is absent, and `anno_delete_project_enum` is absent.
  Measured at discussion time: the manifest classifies **20** verbs — 15
  `curated`, 1 `adapt-to-address-input` (`anno_get_disassembly_cursor`), 4 `omit`
  (`set_immediate_format`, `toggle_splitter`, `undo`, `unpack_binary`). Three
  verbs in `CURATED_ANNO_TOOLS` appear in **no** manifest procedure —
  `anno_search_disassembly`, `anno_add_scope`, `anno_update_project_enum` — and
  criterion 5 / `STORE-06` positively require search. Those go in a register
  modelled on `module-classification.ts`, each entry citing a requirement id
  (`STORE-06` for search), so a verb added later with no named consumer **fails**
  rather than being reviewed. Amending the manifest was rejected: it describes
  upstream the external analyser at commit `493f840` and carries its own re-sync trigger
  and per-procedure sha256s — writing our verbs into it makes it describe us and
  breaks what `anno-derivation.test.ts` says.
  — **Reversibility:** reversible.

- **D-09 — `anno_get_disassembly_cursor` is folded into the disassemble verb's
  address argument, not carried as a verb.** That is what
  `adapt-to-address-input` means here, and it agrees with the roadmap's recorded
  anti-feature (upstream's own procedure text says *"NEVER use the 'current
  cursor address'"*).

**The guards with a fate**

- **D-10 — `check-skill-fork-honesty.mjs:504`: the skill loses the route and the
  assertion is re-pointed.** It asserts `acme-build/SKILL.md` still contains the
  literal `"anno export-asm"`; D-02 deletes that verb, so the guard goes red
  either way. The route is stripped from the skill and the assertion re-pointed at
  the renamed CLI, with Phase 30 restoring an export route under that name. Named
  by ROADMAP Phase 32 criterion 4 as needing resolution "in **one change that
  names which side is correct**" — this is that change, and the skill is the side
  that moves.

- **D-11 — `absorbed-answer-key.test.ts` is renamed and kept, never deleted.** It
  reads `.planning/phases/11-*/evidence/` with no existence guard and is the
  second leg of the "do not archive phase directories" decision. Deleting it would
  silently discharge that constraint. ROADMAP Phase 32's note requires this be an
  explicit recorded choice rather than a side effect; it is recorded here.

- **D-12 — `docs-absorbed-decisions.test.ts` and `scripts/audit-gate.mjs:136` move
  together, in one commit.** Their own comment records that they were added in one
  commit for exactly this reason: removing the name from `audit-gate.mjs` without
  removing the test, or the reverse, **breaks the audit gate**.

- **D-13 — The registration-time guards move in the registering commit
  (`MCP-05`), and their re-pointing is now a rename rather than a duplication.**
  `generate-tool-support-table.mjs:104`'s hard-coded `ANNO_TOOL_DEFINITIONS`
  regex and its two deliberate duplicate witnesses move together and none is
  refactored into a shared helper. `hostpath-consumers.test.ts`'s
  `ANNO_MODULE_FLOOR` (currently `14`) is re-expressed over the `anno-` prefix at
  the measured new count, **raised not lowered**, and its positive control — today
  the four `INT-01` filenames — is replaced with real new filenames.
  `check-skill-tool-coverage.mjs`'s floor is re-expressed the same way (pulled
  forward from Phase 31 criterion 2). Note that criterion 4's wording already
  anticipated re-pointing rather than deletion, so it survives D-01 unedited.

### Claude's Discretion

Copied verbatim from `29-CONTEXT.md`. These five are the only genuinely open
questions; each is answered in `## Discretion Items — Answered` below.

- The grep gate's **scope predicate** — `git ls-files` minus `.planning/**`, plus
  either a post-sync read of `installer/skills/**` or the `npm pack --dry-run`
  file list. ROADMAP Phase 32 flags this as needing deeper research at plan time
  with three measured failure modes; the blast radius is 291 tracked files
  mentioning the word, **55** outside `.planning/`.
- The result envelope and the concrete shape of `{available:false, reason}` — an
  existing project convention, to be matched rather than invented.
- The batch verb's recursive inner-name pre-validation — the shape is already
  fixed by `assertCuratedTool()`'s D-33 batch recursion; carry the discipline.
- How `coverage` / `COV-01`'s census re-points off the anno project-JSON shapes
  (`AnnoComment`, `AnnoCrossReference`, `AnnoSymbol`) onto the new store.
- Whether Phases 30–32 are renumbered or merely narrowed after D-01's roadmap
  edit.

### Deferred Ideas (OUT OF SCOPE)

- **ACME export and the real-ACME oracle** — Phase 30, unchanged. `export-asm` is
  deleted here and returns there behind the byte-diff oracle. This is the reason
  D-02 scoped the cut the way it did.
- **Automatic annotation** — Phase 26, held for v0.8.0 behind the same corpus gate
  as Phase 24.
- **`packer-finding.mjs`'s `entropySource = "anno_get_binary_info"`** — a stored
  fact about a past run, not a route. ROADMAP Phase 31 requires its fate be
  decided explicitly rather than string-replaced; it rides with the skill
  re-pointing pulled forward into this phase.
- **`render-memmap`'s independence** — it reads `memmap.json` and writes Markdown
  with no store call site, so it can be re-pointed independently or not at all.
  A retarget must not read the `installer/skills/` copy.
- Nine keyword-matched pending todos, reviewed and **not folded** — all out of
  this phase's domain (VICE broker / emulator behaviour, or Phase 28 store
  residuals). Enumerated in `29-CONTEXT.md` `<deferred>`.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| **MCP-01** | The tool surface is **derived from Phase 19's `upstream-procedure-manifest.json`** rather than chosen — every `curated`/`adapt-to-address-input` verb has a route, every `omit` verb is absent, `anno_delete_project_enum` is not carried, checked mechanically. | `## The Verb List, Derived and Mapped` gives the full 20-verb manifest inventory verbatim from the JSON, the 19-entry `CURATED_ANNO_TOOLS` set, the exact 3-way delta, and the name-mapping function the mechanical check needs. `## Pitfall 1` names the one `curated` verb (`save_project`) that collides with a ROADMAP anti-feature. |
| **MCP-02** | The family registers proxy-locally through `buildViceTool()` and never reaches `forwardToVice()`; pinned by the existing body-slice assertion. | `## Architecture Patterns → Pattern 1` gives the exact two-line substitution at `vice-proxy.ts:194` and `:3401`, and `## The Registration Seam` quotes the body-slice assertion at `stock-dispatch.test.ts:1551-1562` that must be re-pointed. |
| **MCP-03** | Backend-agnosticism is structural, expressed in `stock-dispatch.test.ts`'s **ordered** `BACKEND_SEAM_BYPASS_KEYS`, not by a `capability-registry.ts` entry; neither manifest nor `docs/tool-support.md` gains an entry. | `## The Registration Seam` quotes `BACKEND_SEAM_BYPASS_KEYS` verbatim and names all four re-pointing sites in that file. `## Verified: `docs/tool-support.md` regenerates byte-identical` is an executed proof, not an assumption. |
| **MCP-04** | Shaped for an agent, not a cursor: explicit-address addressing, batchable + idempotent edits, refuse-by-name as `{available:false, reason}` per the project's existing convention. | `## Discretion 2` locates the convention at `stock-recycle.ts:86` / `vice-proxy.ts:1461` / `stock-cia.ts:494` with verbatim quotes. `## Discretion 3` reconciles D-33's whole-batch refusal with criterion 5's per-item status. Idempotency is `AnnoWriteResult.changed` (`anno-store.ts:193`). |
| **MCP-05** | Every guard that breaks on **registration rather than deletion** is repointed in the registering commit. | `## The Guard Ledger` gives every guard's exact current value and location, verified this session, with drift corrections. |
| **STORE-06** | Cross-references and search over the typed decode are answerable, built on the surviving `disasm-*` decoders, with the old route gone rather than kept as a fallback. | `## STORE-06: What Has To Be Built` — measured: **neither** derived-xref nor search exists anywhere in the store. `disasm-decoder.ts`'s `Instruction.resolvedTarget` + `DecodedOperand.role` is the whole input. |

**Note on `MCP-02` and `MCP-05`'s coexistence clauses.** Both contain sentences
D-01 falsifies by decision (`MCP-05`: *"Both families coexist at this point, so
nothing is deleted to make them pass."*). `29-CONTEXT.md` in-scope item 7 makes
editing them part of this phase. See `## Conflicts the Planner Must Resolve → C-1`.
</phase_requirements>

---

## Summary

This phase is **not** the "register a new tool family" phase the ROADMAP text
describes. `29-CONTEXT.md`'s D-01 pulled the entire Phase 32 cut forward, and D-02
pulled a CLI rebuild forward with it. Measured against the tree, the work has
**seven streams**, of which the tool family itself is roughly a third.

Three things dominate the plan and none of them is optional:

1. **The derivation is nearly free; the *implementations behind it* are not.**
   The manifest's 20 verbs and `CURATED_ANNO_TOOLS`'s 19 entries are exactly as
   `29-CONTEXT.md` records them — I re-derived both from the JSON and the source.
   But mapping each surviving verb onto Phase 28's store shows **four verbs with
   no backing implementation at all**: `anno_get_cross_references` and
   `anno_search` (`STORE-06`'s actual content — nothing derived exists in the
   store, only `putXref`/`listXrefs` for the *non-derivable* rows), plus
   `anno_get_address_details` (a composition that must be re-written) and, most
   seriously, **`anno_apply_enum_usage`, which the store has no table for and
   `openStore` refuses to migrate**.

2. **D-02's "keep five CLI verbs" is falsified transitively.** D-02 verified the
   CLI's *own* import list, which is correct as far as it goes. But
   `anno-symbols.ts` (verdict `capability`) statically imports `runAnno()`,
   `withAnnoSession()` and `runAnnoTool()`; `anno-enum-gen.ts` (verdict
   `capability`) statically imports `runAnnoTool()`; and the `coverage` verb
   calls `runAnnoTool` four times plus `resolveStorePath`. **Four of the five
   "kept" verbs require a substantive rebuild in this phase, not a rename.** Only
   `render-memmap` is genuinely free — its module has zero local imports.

   > **[CORRECTED 2026-08-29 — this last sentence is FALSE. See D-17.]** The
   > "zero local imports" measurement was taken with a plain `grep`, which is
   > blind to `anno-memmap-render.ts`: the file carries a literal NUL byte at
   > offset 12862 (line 291, the `"\0"` separator in the sidecar hash
   > canonicalisation), so GNU grep classifies it as binary and prints
   > `binary file matches` in place of the matching lines. Re-measured with
   > `grep -a`: the module imports `runAnnoTool` from `anno-tools.ts` at
   > `:69`, uses it at `:106` inside `queryAnnoJson()`, and `renderMemoryMap()`
   > calls that three times at `:353-355` (`anno_get_blocks`,
   > `anno_get_symbols`, `anno_get_comments`); `checkRenderedMemoryMap()` at
   > `:499` reaches the same three calls through `renderMemoryMap()`. So **five
   > of the five** kept verbs required a rebuild and none was free. The error is
   > left in place rather than deleted because its *cause* is a standing hazard
   > for this phase: any claim of the form "module X has no local imports" must
   > be made with `grep -a` or an AST read. A NUL-safe scan over `git ls-files`
   > minus `.planning/` confirms this is the **only** grep-blind source file in
   > the tree — the other six are `fixtures/binmon/*.bin` assets with zero hits —
   > so no other claim in this document is affected by this cause. The owner's
   > resolution is D-17: the verb is rebuilt onto the Phase 28 store in this
   > phase, planned as 29-12.

3. **The registration-time guards are cheap and provable, and I proved the
   headline one.** `docs/tool-support.md` regenerates **byte-identical** (7,874
   bytes, both before and after) under the two-line loop substitution provided the
   `ANNO_TOOL_DEFINITIONS` regex moves in the same change; and if the regex is
   *not* moved the generator **throws by name** rather than emitting a different
   table. The whole 10-file structural-guard set this phase touches runs green in
   **1.24 s** — a per-task verification loop is realistic.

**Primary recommendation:** plan this phase in the order *rename → re-implement
the surviving CLI verbs on the store → register the family (guards moving in the
same commit) → build the grep gate and observe it bite → delete → edit the
record*, and treat `anno_apply_enum_usage` as a blocking decision gate at plan
time rather than an implementation detail.

---

## Architectural Responsibility Map

This phase is a single-process Node MCP server with no browser, no network tier
and no database server. The "tiers" that matter here are the project's own
documented seams.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool advertisement (`tools/list`) | Stdio MCP entry point (`vice-proxy.ts`) | — | `@mastra/mcp`'s `MCPServer` answers `tools/list` from the `tools` object built at module scope; the family is added by a loop at `:3401` [VERIFIED: src/mcp/vice/vice-proxy.ts:3401-3403]. |
| Argument validation | **The family's own runner module** | Store (`anno-types.ts` assertions) | The transport validates **nothing**: `validate: (value: unknown) => ({ value })` [VERIFIED: src/mcp/vice/vice-proxy.ts:3230]. Every `inputSchema` is advertisement only. |
| Store mutation + persistence | `anno-store.ts` | `anno-types.ts` (the assertion family) | Phase 28 owns this; `setDataType`'s own doc says *"Every argument is validated before any SQL runs -- the transport validates nothing"* [VERIFIED: src/mcp/vice/anno-store.ts:2300-2302]. |
| Byte decode (disassembly, xrefs, search corpus) | `prg-image.ts` + `disasm-*` | — | D-07: the store holds no image. Derived on every query, never cached (`putXref`'s own contract). |
| Refusal-by-name (`{available:false, reason}`) | The family's runner | — | A *result body*, not an exception. See `## Discretion 2`. |
| Backend agnosticism | `stock-dispatch.test.ts`'s ordered allow-list | — | `MCP-03` / `D3`: `capability-registry.ts` holds only the per-backend delta; a proxy-local family has none. |
| Host/container path translation | **Nobody — by construction** | — | The family never imports `hostpath.ts`, so `rewriteArguments()` is unreachable. Pinned by `hostpath-consumers.test.ts`'s five-member `EXPECTED_IMPORTERS` [VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:143]. |
| CLI verbs (`gen-enums`, `export-lbl`, `import-lbl`, `coverage`) | The renamed CLI | `anno-store.ts` directly | These must stop going through an MCP round trip and call the store's exported functions. See `## Finding F-2`. |

---

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md`. Every one of these binds the
plan; three of them bind it hard.

| # | Directive | Bearing on this phase |
|---|-----------|----------------------|
| P-1 | **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`.** `rewriteArguments()` runs at `vice-proxy.ts:3052`; second site `gatherWedgeEvidence()` at `:1531`. Line numbers "drift between phases; treat a mismatch as drift to re-verify". `docs-linerefs.test.ts` mechanically checks the two citations. | Satisfied **by construction**: the `anno_*` runner is never wired to `forwardToVice()`. `docs-linerefs.test.ts` reads CLAUDE.md's bullet and checks each cited `vice-proxy.ts:<N>` still contains `rewriteArguments(` or a `function` keyword [VERIFIED: src/mcp/vice/docs-linerefs.test.ts:66-83]. **Deleting the anno import at `:194` and substituting the loop at `:3401` shifts nothing above `:3052`** if the substitution is line-count-neutral — but an import line deletion at `:194` shifts *everything*. See `## Pitfall 4`. |
| P-2 | **The stdio MCP surface is trimmed per backend**; a tool advertised on both keeps the same name and a backward-compatible argument shape. | The `anno_*` family is proxy-local and advertised on **both** backends identically — no trimming. This is why `buildViceTool()` and not `buildBackendAwareTool()`. |
| P-3 | **Node ≥ 22.18 (native type-stripping — the shipped server has no build step).** Host-bound `.mts` files must be compiled by `build.ts` into committed `resources/*.mjs`; `resources-sync.test.ts` fails CI on drift. | All new modules are `.ts` under `src/mcp/vice/`, never `.mts` — no `build.ts` involvement, no `resources/` churn. |
| P-4 | **Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.** | The `anno_*` family must NOT import any of them. This is `MCP-02` and it is enforced by `hostpath-consumers.test.ts`'s exact-five `assert.deepEqual`. |
| P-5 | **The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between.** | Untouched by this phase. |
| P-6 | **`vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested.** | Untouched by this phase. |
| P-7 | *(CUT-06 obligation)* CLAUDE.md itself carries a `the external analyser` mention and a derived-tool bullet naming `anno_*`. | `git grep -c the external analyser CLAUDE.md` → **1**. `docs-dangling-refs.test.ts` asserts its scanned doc set exists, so CLAUDE.md must be *edited*, never deleted. |

---

## Measured Corrections to CONTEXT.md and ROADMAP.md

Every figure below was re-measured this session. **Report the corrected number to
the planner; do not let a stale one drive a floor.**

| Claim | Source | Measured 2026-08-29 | Command |
|---|---|---|---|
| "291 tracked files mention the word" | CONTEXT `<decisions>`, CUT-02, ROADMAP P32 c1 | **339** | `git grep -il the external analyser -- . \| wc -l` |
| "**55** outside `.planning/`" | same | **61** | `git grep -il the external analyser -- . ':!.planning/**' \| wc -l` |
| "9 skill files naming 18 `anno_*` tools" | CONTEXT in-scope item 5 | **5 files naming 17 distinct tool names**; **10 files** mention `anno` at all | `grep -rloE '\banno_[a-z0-9_]+' src/skills/` and `grep -rlI anno src/skills/` |
| "10 files under `src/skills/` … **18** distinct tool names" | REPOINT-01, ROADMAP P31 c1 | 10 files ✓, **17** tool names ✗ | as above |
| "`ANNO_TOOL_DEFINITIONS` is an array of 17" | `capability-registry.test.ts:154-156` (comment) | **19** | `grep -c 'name: "anno_' anno-tools.ts` |
| "16 `anno` entries in `files[]`" | CONTEXT `<canonical_refs>` | **16** ✓ (15 `.ts` + `anno-regbits.json`) | `grep -c anno src/mcp/vice/package.json` |
| "`generate-tool-support-table.mjs:104`" | CONTEXT, D-13, MCP-05 | the regex is at **`:107`**; the header prose naming it is at `:95` | `grep -n ANNO_TOOL_DEFINITIONS scripts/generate-tool-support-table.mjs` |
| "`check-skill-fork-honesty.mjs:504`" | CONTEXT, D-10, CUT-05 | ✓ — the `need(` spans `:500-504`, the literal is at `:501` | `sed -n '495,505p'` |
| "`hostpath-consumers.test.ts:188` / `:199`" | CONTEXT | ✓ both exact | `sed -n '188p;199p'` |
| "`stock-dispatch.test.ts:1505`" | CONTEXT | ✓ exact | `sed -n '1505p'` |
| "`vice-proxy.ts:3263` / `:3401-3402`" | CONTEXT | ✓ `buildViceTool` at `:3263`; loop at `:3401`, body at `:3402` | `grep -n` |
| "`scripts/audit-gate.mjs:136`" | CONTEXT, D-12 | ✓ — `"docs-absorbed-decisions.test.ts"` inside `EXPECTED_DOCS_GUARD_NAMES` | `sed -n '129,137p'` |
| "26,023 lines of `anno-*.ts`" | D-01 | not re-measured (not load-bearing for any gate) | — |

**The two duplicate witnesses D-13 names, found and cited:**

1. `src/mcp/vice/tool-support-table.test.mjs:66` — `const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;` inside `independentlyDiscoverSyntheticNames()`. Its own comment: *"deliberately a DIFFERENT bounding technique … so a bug in one bounding technique is caught by the other two independent witnesses. This is load-bearing (see this file's header): do not collapse the three scans into one shared helper."* [VERIFIED: src/mcp/vice/tool-support-table.test.mjs:60-88]
2. `src/mcp/vice/capability-registry.test.ts:161` — `const annoLoopVarMatch = proxySource.match(/for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/);`. Its own comment: *"deliberately a THIRD, different bounding technique … Load-bearing (see this file's header): do not collapse the three scans into one shared helper."* [VERIFIED: src/mcp/vice/capability-registry.test.ts:155-174]

The authoritative implementation is `scripts/generate-tool-support-table.mjs:107`.
All three must be re-pointed to `ANNO_TOOL_DEFINITIONS` (or whatever the array is
named) in the same commit, and **none may be refactored into a shared helper**.

---

## The Verb List, Derived and Mapped

### The manifest's 20 verbs, read from the JSON this session

`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`
holds 5 procedures whose `tools` field is a `{ "<name>": "<disposition>" }` map.
Union across all five, quoted verbatim:

```
CURATED (15):
  anno_apply_enum_usage       anno_get_blocks             anno_save_project
  anno_batch_execute          anno_get_comments           anno_set_comment
  anno_create_project_enum    anno_get_cross_references   anno_set_data_type
  anno_disassemble            anno_get_symbols            anno_set_label_name
  anno_get_address_details    anno_read_region
  anno_get_binary_info

ADAPT-TO-ADDRESS-INPUT (1):
  anno_get_disassembly_cursor

OMIT (4):
  anno_set_immediate_format   anno_toggle_splitter
  anno_undo                   anno_unpack_binary
```
[VERIFIED: .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json — enumerated by `node -e` over `m.procedures[].tools` this session; 15 + 1 + 4 = 20, matching CONTEXT D-08 exactly]

### `CURATED_ANNO_TOOLS` — the 19 names on the surface today

```
anno_set_label_name      anno_get_cross_references   anno_delete_project_enum
anno_set_comment         anno_search_disassembly     anno_apply_enum_usage
anno_set_data_type       anno_disassemble            anno_save_project
anno_add_scope           anno_get_binary_info        anno_batch_execute
anno_get_symbols         anno_create_project_enum    anno_read_region
anno_get_comments        anno_update_project_enum    anno_get_address_details
anno_get_blocks
```
[VERIFIED: src/mcp/vice/anno-tools.ts:233,257,279,320,337,364,390,405,417,440,454,467,481,496,511,526,544,572,604 — 19 `name: "anno_…"` literals inside `ANNO_TOOL_DEFINITIONS`]

`19 = 15 manifest-curated + 4 unclassified` (`add_scope`, `search_disassembly`,
`update_project_enum`, `delete_project_enum`). `anno_get_disassembly_cursor` is
**not** in the set — it is HELD upstream-side (D18-26), which is exactly why the
manifest disposes it `adapt-to-address-input`.

### The 18 verbs the `anno_` family must expose, with their backing implementation

The mapping rule the mechanical test needs: **`anno_<suffix>` ⟼ `anno_<suffix>`**,
with two documented departures (`get_disassembly_cursor` folded into
`anno_disassemble`'s `address`; `search_disassembly` shortened to `anno_search`).

| # | `anno_*` verb | Manifest disposition | Backing implementation | Status |
|---|---|---|---|---|
| 1 | `anno_set_label_name` | curated | `setLabel()` `anno-store.ts:2801` + `assertLegalLabel()` `anno-types.ts:1217` | ✅ exists |
| 2 | `anno_set_comment` | curated | `setComment()` `:2868` + `assertCommentText()`/`assertCommentType()` | ✅ exists |
| 3 | `anno_set_data_type` | curated | `setDataType()` `:2303` → `SetDataTypeResult` | ✅ exists — **but see F-4** |
| 4 | `anno_add_scope` | *(unclassified → register)* | `addScope()` `:2953` | ✅ exists — **but see F-5 (no inverse)** |
| 5 | `anno_get_symbols` | curated | `listLabels()` `:2842` → `LabelRow[]` | ✅ exists |
| 6 | `anno_get_comments` | curated | `listComments()` `:2898` → `CommentRow[]` | ✅ exists |
| 7 | `anno_get_blocks` | curated | `listRanges()` `:2341` → `RangeRow[]`; `paintIndexOf()` `:2768` + `resolveAt()` for gaps | ✅ exists |
| 8 | `anno_get_cross_references` | curated | `listXrefs()` `:3254` covers **only non-derivable rows** | ⚠️ **GAP — derivation missing** |
| 9 | `anno_search` | *(unclassified → register, cites `STORE-06`)* | nothing | ❌ **GAP — build from scratch** |
| 10 | `anno_disassemble` | curated (+ cursor folded, D-09) | `parsePrg()` `prg-image.ts:69` + `decode()` `disasm-decoder.ts:148` + `render()` `disasm-renderer.ts:280` | ✅ decoders exist; composition new |
| 11 | `anno_get_binary_info` | curated | `parsePrg()` / `flatImageOrigin()` `prg-image.ts:69,86` | ✅ exists (thin) |
| 12 | `anno_create_project_enum` | curated | `createProjectEnum()` `:3084` | ✅ exists |
| 13 | `anno_update_project_enum` | *(unclassified → register)* | `updateProjectEnum()` `:3124` | ✅ exists |
| 14 | `anno_apply_enum_usage` | **curated** | **nothing — no table in the DDL** | ❌ **BLOCKING GAP — see F-1** |
| 15 | `anno_save_project` | **curated** | nothing — and the ROADMAP names an explicit save verb an **anti-feature** | ⚠️ **CONFLICT — see C-2** |
| 16 | `anno_batch_execute` | curated | nothing; the discipline is `assertCuratedBatch()` `anno-tools.ts:801` | ❌ build (pattern given below) |
| 17 | `anno_read_region` | curated | `parsePrg()` + `decode()`; cap pattern at `anno-tools.ts:207` | ✅ decoders exist; composition new |
| 18 | `anno_get_address_details` | curated | composition of 4 reads; template at `anno-tools.ts:1121` (`composeAddressDetails`) | ❌ rewrite over the store |

**Absent by construction (the check's negative half):** `anno_set_immediate_format`,
`anno_toggle_splitter`, `anno_undo`, `anno_unpack_binary`,
`anno_delete_project_enum`, `anno_get_disassembly_cursor`.

**Nine of eighteen verbs are a thin decode-and-return over an existing store
function. Nine are new work.** That is the honest sizing.

---

## STORE-06: What Has To Be Built

`STORE-06` is the one Phase-29 requirement with no Phase-28 substrate. Measured:

**Derived cross-references do not exist.** `putXref()`'s own doc block is explicit
that the table is *not* the answer:

> *"the only rows ever written here are references that CANNOT be recovered from
> the bytes — hand-asserted, or resolved from something outside the program image.
> … nothing derivable is ever written here. A cached derivation would be a SECOND
> ON-DISK TRUTH that can disagree with the range table it came from"*
> [VERIFIED: src/mcp/vice/anno-store.ts:3192-3221]

`XrefRow`'s type doc says the same in one line: *"Only NON-DERIVABLE references
live here"* [VERIFIED: src/mcp/vice/anno-types.ts:445-455].

**Search does not exist.** No `search`, `grep` or `match` entry point in
`anno-store.ts`, `anno-types.ts` or `anno-index.ts`.

**The whole input is `disasm-decoder.ts`'s `Instruction`:**

```ts
export interface DecodedOperand {
  role: "immediate" | "zeropage" | "absolute" | "relative" | "indirect";
  value: number;
  width: 1 | 2;
}
export interface Instruction {
  address: number; bytes: number[]; opcode: number; mnemonic: string;
  mode: AddressingMode; illegal: boolean; acmeExpressible: boolean;
  operand?: DecodedOperand; resolvedTarget?: number; notes: DisasmNote[];
}
```
[VERIFIED: src/mcp/vice/disasm-decoder.ts:61-82]

So `anno_get_cross_references(to)` is derivable as: decode every range
`listRanges()` types `code`, keep instructions whose `operand.role` is
`absolute` / `zeropage` / `relative`, edge = `address → (resolvedTarget ?? operand.value)`,
access kind from the mnemonic; **union** that with `listXrefs()`'s stored
non-derivable rows and with `resolveSplitTargets()` (`anno-types.ts:1392`) over
every typed split range. `producesXrefsFor()` (`:1362`) already answers whether a
split layout contributes at all.

`anno_search` is derivable as: search `listLabels()` names, `listComments()` texts,
and the rendered instruction text from `render()` — three corpora, three
independently disableable flags, exactly the argument shape
`anno_search_disassembly` already advertises (below).

**Both must be computed on every query and never written to disk.** That is
`putXref`'s stated contract *and* ROADMAP's `anno-xref`-class note *and*
`COV-01`'s derived-from-bytes discipline. Three independent statements of the same
rule; a cached index is the failure all three exist against.

---

## Findings the Planner Must Act On

These are the load-bearing discoveries. Each is measured, not inferred.

### F-1 (BLOCKING) — `anno_apply_enum_usage` has no store shape, and `openStore` cannot migrate to one

`anno_apply_enum_usage` is disposed **`curated`** in the manifest, so D-08's
mechanical check *requires* it to have a route. Its upstream contract:

> *"Applies an enum definition to format the immediate operand or constant
> reference at a specific address. If name is omitted or empty, clears the enum
> usage."* — required args `["project", "address"]`
> [VERIFIED: src/mcp/vice/anno-tools.ts:510-524]

The store's DDL has eight tables and **none of them associates an enum with an
address**:

```sql
create table anno_enum (
  id integer primary key autoincrement,
  name text not null unique,
  variants text not null,
  description text
);
```
[VERIFIED: src/mcp/vice/anno-store.ts:271-276 — quoted verbatim; the full table list is `anno_meta`, `anno_range`, `anno_label`, `anno_comment`, `anno_scope`, `anno_enum`, `anno_xref`, `anno_snapshot`, at `:236-289`]

And `openStore` **hard-refuses** a mismatched schema with no migration arm:

```ts
if (meta.schema_version !== SCHEMA_VERSION) {
  throw new AnnoStoreCorruptError(`${resolved}: schema_version ${meta.schema_version}, expected ${SCHEMA_VERSION}`, { path: resolved });
```
[VERIFIED: src/mcp/vice/anno-store.ts:521-523]

`SCHEMA_VERSION = 2` [VERIFIED: src/mcp/vice/anno-types.ts:154]. Bumping it to 3
makes every existing v2 store permanently unopenable — the one-way move D-07
already flagged.

This also **breaks the `gen-enums` CLI verb** D-02 keeps: `createOrUpdateEnum()`
calls `runAnnoTool("anno_apply_enum_usage", …)` [VERIFIED: src/mcp/vice/anno-enum-gen.ts:446].

**Three options, none free — the planner must pick one explicitly:**

| Option | Cost | Notes |
|---|---|---|
| (a) Add an `anno_enum_usage(address, enum_name)` table, bump `SCHEMA_VERSION` to 3 | One-way; every v2 store on disk becomes unopenable | Honest, and the store is days old with (presumably) no field stores. Needs a recorded owner decision. |
| (b) Add the table **and** a v2→v3 migration arm in `openStore` | New code in the module Phase 28 spent six rounds hardening | Contradicts `openStore`'s current single-witness refusal shape. |
| (c) Route `anno_apply_enum_usage` to `{available:false, reason}` | D-08's check is satisfied *formally* (a route exists) but `gen-enums` loses its last mutating step | Cheapest; makes `gen-enums` a partial capability. **Must be recorded, not silent.** |

**Recommendation: (a)**, taken as an explicit gate at plan time. The store shipped
five days ago; a migration arm bought now to protect stores that may not exist is
the more expensive mistake. But this is a user-facing one-way call and the planner
should route it to a `checkpoint:human-verify` task, not decide it in a plan.

### F-2 (MAJOR) — four of D-02's five "kept" CLI verbs reach deleted modules transitively

D-02 verified `anno-cli.ts`'s own import list and concluded only
`bootstrap`/`export-asm`/`verify` reach `anno-launch.ts`. **That is true and
insufficient.** The `capability`-verdict modules the surviving verbs import
themselves import the glue:

```
anno-symbols.ts:72  import { buildExportLblArgs, buildImportLblArgs, runAnno } from "./anno-launch.ts";
anno-symbols.ts:73  import { withAnnoSession, saveAndVerify } from "./anno-mcp-client.ts";
anno-symbols.ts:74  import { runAnnoTool } from "./anno-tools.ts";
anno-enum-gen.ts:84 import { runAnnoTool } from "./anno-tools.ts";
anno-verify.ts:46   import { buildVerifyArgs, runAnno } from "./anno-launch.ts";
```
[VERIFIED: exact import lines, `grep -n '^import' src/mcp/vice/anno-{symbols,enum-gen,verify}.ts`]

Use sites, all inside functions the surviving verbs call:

- `exportLabels()` → `runAnno(buildExportLblArgs(...))` [VERIFIED: anno-symbols.ts:131-132]
- `importLabels()` → `withAnnoSession(projectPath, (call) => saveAndVerify(projectPath, call), { argv })` [VERIFIED: anno-symbols.ts:284-285]
- `anno-symbols.ts:378` → `runAnnoTool("anno_set_label_name", …)`
- `generateEnums()` → `runAnnoTool("anno_search_disassembly" ×2, "anno_create_project_enum", "anno_update_project_enum", "anno_apply_enum_usage")` [VERIFIED: anno-enum-gen.ts:304,318,419,431,446]
- `coverage` verb → `resolveStorePath()` [VERIFIED: anno-cli.ts:1365] and `queryAnnoJson` ×3 + per-address xref lookups [VERIFIED: anno-cli.ts:1384-1386]

| Kept verb | Reaches | Real work in this phase |
|---|---|---|
| `render-memmap` | ~~nothing local (`anno-memmap-render.ts` has **zero** local imports)~~ — **CORRECTED, see D-17:** `runAnnoTool` ×3 via `anno-memmap-render.ts:69,106,353-355`; the original figure was a plain-`grep` miss caused by the file's NUL byte at offset 12862 | ~~rename only ✅~~ **rebuild** over `listRanges`/`listLabels`/`listComments` (plan 29-12) |
| `gen-enums` | `runAnnoTool` ×5 via `anno-enum-gen.ts` | rebuild over `createProjectEnum`/`updateProjectEnum` + `anno_search`; blocked on F-1 |
| `export-lbl` | `runAnno()` spawn via `anno-symbols.ts` | rebuild over `listLabels()` → `.lbl` writer |
| `import-lbl` | `runAnno()` + `withAnnoSession`/`saveAndVerify` | rebuild over `parseViceLabelFile` (`stock-symbols.ts`) → `setLabel()` |
| `coverage` | `runAnnoTool` ×3 + `resolveStorePath` | re-point (this is Discretion 4) |

**`export-lbl`/`import-lbl` are `ANNO-14`/`ANNO-15`'s ✓ Validated symbol round
trip** — the exact capability D-03 exists to protect. They cannot ride forward on
a rename; they need a new implementation and a re-earned round-trip proof.

### F-3 (MAJOR) — `module-classification.ts`'s own notes contradict D-03 on two of the eleven

D-03 lists 11 `capability` modules to rename and keep. The registry's own `note`
fields — which the registry exists to be read for — flag two of them as
**CONTESTED** and say plainly not to read the verdict as survival:

**`anno-test-gate.ts`:**
> *"CONTESTED, flagged rather than smoothed over … every one of the ten measured
> importers is an `anno-*.test.ts` file, so every consumer of this module dies
> with the substrate it gates; and the substrate-INDEPENDENT half of its
> discipline has already been extracted, in this same phase, under a different
> name (`acme-gate.ts`). … **Do NOT read this verdict as a claim that the module
> survives a prefix deletion** … An unflagged tense verdict here is how a later
> phase keeps dead code."*
> [VERIFIED: src/mcp/vice/module-classification.ts:475-490]

Corroborated: the two *surviving* ACME-gated tests both import `acme-gate.ts`,
not `anno-test-gate.ts` —
`disasm-roundtrip.test.ts:57` and `skill-acme-build-cli.test.ts:50` both read
`import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";`
[VERIFIED]. After the deletion `anno-test-gate.ts` has **zero** surviving importers.

**`anno-verify.ts`:**
> *"CONTESTED, flagged rather than smoothed over. … EXPORT-01's preamble states
> verbatim that the existing verify seam invokes the external analyser and parses
> ITS transcript, and that only the discipline survives. So what a later phase
> inherits is the discipline and its two pinned false-pass transcripts, **NOT the
> route**. Act on the discipline; do not read this verdict as a claim that the
> route survives."*
> [VERIFIED: src/mcp/vice/module-classification.ts:516-524]

Its **only** import is `anno-launch.ts`; its whole body is that spawn.
ROADMAP Phase 30's own note agrees: *"it never invokes ACME, and it dies with its
subject. Only the discipline survives. Plan this as a rebuild, not a rename."*

**Recommendation:** the rename set is **9**, not 11 — `anno-acme-ident.ts`,
`anno-confidence.ts`, `anno-coverage.ts`, `anno-d64.ts`, `anno-enum-gen.ts`,
`anno-memmap-render.ts`, `anno-regbits-gen.ts`, `anno-regbits.json`,
`anno-symbols.ts`. `anno-test-gate.ts` and `anno-verify.ts` are **deleted**, with
their two pinned false-pass transcripts carried forward as fixtures for Phase 30.
The registry's `note` fields are the authority for this, exactly as designed — this
is the registry working, not a research contradiction of it.

### F-4 — the split-table re-interpretation disclosure is a Phase 29 obligation, in writing

28-VERIFICATION.md, verbatim:

> *"**The residual, stated plainly and carried to Phase 29 rather than hidden:**
> the disclosure must be SURFACED when Phase 29 puts `set_data_type` on the MCP
> tool path, or the human never sees it. Phase 29's criterion 5 already requires
> that an unsupported or ambiguous request *"refuses by name … rather than a
> plausible-looking zero"*, which is the same instinct applied one layer up. That
> is a Phase 29 obligation, not a Phase 28 gap."*
> [VERIFIED: .planning/phases/28-the-store-core/28-VERIFICATION.md:495-501]

Concretely: `setDataType()` returns `SetDataTypeResult extends AnnoWriteResult`
with `contradictedComments: readonly ContradictedComment[]` and
`reinterpretedSplitTables: readonly SplitTableReinterpretation[]`
[VERIFIED: src/mcp/vice/anno-store.ts:2291-2294]. Both arrays ride on a
**SUCCESSFUL** result. `anno_set_data_type`'s result body must carry both, never
drop them, and never bury them behind an `isError:false` that reads as "clean".

### F-5 — `addScope` has no inverse, and this phase is where that becomes dangerous

28-VERIFICATION round-7 carry-forward, verbatim:

> *"`addScope`'s overlap refusal still has no inverse; `delete from anno_` is
> exactly two hits (`:1255` `anno_snapshot`, `:2155` `anno_range`).
> Safe-direction and reversible inside the 32-revision ring. **Carry to Phase 29,
> which puts `addScope` on an agent-driven surface where a mistyped span is
> likelier.**"* — `id: WR-28`
> [VERIFIED: .planning/phases/28-the-store-core/28-VERIFICATION.md:216-221]

28-REVIEW.md spells out the consequence: `anno_add_scope($1000, $ffff)` — one
transposed end — makes every future scope from `$1000` up **permanently
unaddable**, recoverable only via `revertTo`, which is bounded at
`MAX_SNAPSHOT_REVISIONS = 32`. After 32 further writes the mistake is permanent
for the life of the project file. Its stated fix: *"ship the inverse verb in the
same phase as the refusal."*
[VERIFIED: .planning/phases/28-the-store-core/28-REVIEW.md:1788-1814]

Note the tension with D-08: an `anno_remove_scope` verb appears in **no** manifest
procedure, so it must go in the D-08 criterion register citing this finding as its
named consumer. That is exactly what the register is for.

### F-6 — the two `behavior_unverified` items, carried forward unchanged

| Item | Status | Reason, verbatim from `REQUIREMENTS.md:252-257` |
|---|---|---|
| `openStore`'s `integrity_check could not be run at all` throw arm (`anno-store.ts:529-535`) | **STILL OPEN** — open since round 4 | *"The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection. Presence and wiring verified in source this round … no test exercises the throw."* |
| 28-17's `backstop`-tagged host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit | **STILL OPEN** — abstained as `insufficient_spec` | *"An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two `fsyncPath()` calls — which is presence, not behaviour."* |

Neither is closable by anything this phase does. Prohibition 28-18 P3 forbids
closing, dropping, or re-filing them as done. **The plan must carry them forward
verbatim, not re-litigate them.**

---

## Discretion Items — Answered

### Discretion 1 — The grep gate's scope predicate

**Measured blast radius (2026-08-29):** 339 tracked files mention
`the external analyser` case-insensitively; **61** outside `.planning/`. Of those 61,
by inspection of `grep -ic` per file:

| Class | Count | Examples |
|---|---|---|
| Modules/tests deleted in this phase | ~24 | `anno-tools.ts` (19 hits), `anno-launch.ts` (19), `anno-mcp-client.ts` (18), `spawn-seam.test.ts` (38), the six glue tests |
| Files edited/renamed in this phase | ~19 | `vice-proxy.ts` (6), `anno-cli.ts` (13), `anno-symbols.ts` (7), the 5 skill files, the 3 CI scripts |
| **Legitimately keep the word forever** | **~18** | `docs/phase9-external-analyser-probe-findings.md` (41), `docs/phase23-real-release-gate-findings.md` (2), `THIRD-PARTY-NOTICES.md` × **3 trees** (16/7/3), `skill-attribution.test.ts` (12), `docs/stock-vice-parity.md` (1), `README.md` (7) |

So a whole-tree gate outside `.planning/` fires ~18 times, not ~236 — the 236
figure in `CUT-02` counts `.planning/` too. **This makes a whole-tree-minus-planning
gate genuinely viable**, which is the opposite of what `CUT-02`'s framing implies.

**The `installer/skills/` hole is real and measured:**
`git ls-files installer/skills | wc -l` → **0**. The directory is gitignored at
`.gitignore:43` (`/installer/skills/`), yet 7 skills totalling 8 files mentioning
`the external analyser` are on disk and **are shipped**: `check-npm-packages.mjs`
reports `@henols/c64-re-tools@0.0.0-dev -- 34 files, 7 skills`. A `git ls-files`
predicate is structurally blind to exactly what users receive.

**Recommended predicate (one concrete choice):**

```
scope = ( git ls-files , minus .planning/** )   ∪   packFiles("installer")
```

where `packFiles` is the **existing** `npm pack --dry-run --json` helper at
`scripts/check-npm-packages.mjs:140-141` [VERIFIED], reused rather than
re-implemented. Rationale, and why not the alternative:

- `npm pack --dry-run` in `installer/` runs the `prepack` hook, which runs
  `scripts/sync-skills.mjs` — so the file list is **post-sync by construction**.
  A "post-sync read of `installer/skills/**`" needs the gate to remember to run
  the sync first; the pack route cannot forget.
- **Cost measured:** `npm pack --dry-run --json` in `src/mcp/vice` takes
  **1.30 s** wall (`time`, this session). The full `check-npm-packages.mjs` run
  (both packages, including the sync) completed well inside its budget. This is
  affordable in CI and affordable per-commit.
- The `toacme` precedent's scope (`src/skills/` + `README.md` via
  `walkSkills()`, `check-skill-fork-honesty.mjs:76`) filters to `/\.(md|mjs)$/`
  only [VERIFIED: scripts/lib/skill-corpus.mjs:58] — structurally blind to
  `.ts`, `docs/`, `scripts/` and `installer/`. Do not copy it.

**Named failure modes:**

| Mode | Which predicate | Consequence | Mitigation |
|---|---|---|---|
| **False positive** — an attribution/history file legitimately naming the subject fires the gate | both | ~18 fires; the cheapest silencing is deleting the header, which is exactly what `CUT-03` exists against | A **block-scoped, shape-matched** exemption reusing `skill-attribution.test.ts`'s existing block extractor, never a substring exemption; with a per-exemption **non-vacuity counter** (the `exemptionHits === 1` pattern at `check-skill-fork-honesty.mjs`, whose value is re-measured, never copied) |
| **False negative A** — the gitignored-but-shipped tree | `git ls-files` alone | users receive a re-pointed-nowhere skill and the gate is green | the `packFiles("installer")` union above |
| **False negative B** — an untracked-but-present file (a new module not yet `git add`ed) | `git ls-files` alone | a reintroduction lands green locally, red only after `git add` | acceptable: CI runs post-commit, and a `--cached`-only gate is the documented tradeoff. **State it rather than discover it.** |
| **False negative C** — a mention inside a `.planning/` file that is *also* a live route | `minus .planning/**` | `.planning/` is history by construction; no route lives there | acceptable, but the exclusion must be a **prefix** exclusion, not a substring one, so `docs/planning-notes.md` is still scanned |

**How the gate is observed red before the deletion commit — exactly:**

The project's discipline is a **planted violation observed red and reverted**
(`29-CONTEXT.md` `<code_context>` → Established Patterns). Concretely, and in this
order, all **before** any `git rm`:

1. Land the gate as a `scripts/check-no-anno.mjs` (or a `*.test.ts` — either;
   the CI scripts are the closer precedent) with its exemption set and its
   non-vacuity counter, over a tree where the deletion has **not** happened.
   It must be **green** at this point over the exemption set only, which means the
   deletion-bound files must be excluded by a *named, dated, temporary* allow-list
   whose entries are removed by the deletion commit itself.
2. **Plant 1 (.ts):** add the literal to a surviving `src/mcp/vice/*.ts`. Run the
   gate. Record the exact failing output. `git checkout --` the file.
3. **Plant 2 (docs/):** same in a `docs/*.md` outside the exemption set.
4. **Plant 3 (scripts/):** same in a `scripts/*.mjs`.
5. **Plant 4 (installer/skills/, post-sync):** run `node installer/scripts/sync-skills.mjs`
   (or `npm pack --dry-run` in `installer/`), then plant the literal in
   `installer/skills/<skill>/SKILL.md`. Run the gate. This is the plant that proves
   the gitignored tree is in scope and it is the one a `git ls-files` predicate
   cannot see. Revert by re-running the sync.
6. **Exemption non-vacuity (CUT-03):** delete one attribution block from
   `THIRD-PARTY-NOTICES.md`. The gate must **trip** — an exemption nothing can
   violate is not an exemption. `git checkout --`.
7. **Exemption false-positive control:** with every attribution block untouched,
   the gate is **green**. Record that too; step 6 without step 7 proves only that
   the gate is noisy.

Only then does the deletion commit land, removing the temporary allow-list in the
same commit.

### Discretion 2 — The result envelope and `{available:false, reason}`

**This is an existing convention. It is to be matched, and here it is.** Two
distinct shapes exist and the family needs both, for different things.

**(a) The discriminated union — one step's availability:**

```ts
type CaptureStepResult<T> = { available: true; value: T } | { available: false; reason: string };
```
[VERIFIED: src/mcp/vice/stock-recycle.ts:86 — and written a second time, identically, at src/mcp/vice/vice-proxy.ts:1461]

with the producer:

```ts
return { available: false, reason: e && (e as Error).message ? (e as Error).message : String(e) };
```
[VERIFIED: src/mcp/vice/stock-recycle.ts:135, and identically at src/mcp/vice/vice-proxy.ts:1484]

**(b) The field-level unavailability map — a named field that cannot be answered:**

```ts
const unavailable: Record<string, { available: false; reason: string }> = {};
for (const [name, reason] of CIA_UNAVAILABLE_FIELDS) {
  unavailable[name] = { available: false, reason };
}
```
[VERIFIED: src/mcp/vice/stock-cia.ts:494-497 — and identically at src/mcp/vice/stock-vicii.ts:239-242]

The `reason` strings are **long and specific**, never a bare token. The
established register, verbatim:

> `"the timer A start value written behind $xx04/$xx05 -- reading those two addresses returns the timer's CURRENT counter (available as timerA.current), and the binary monitor has no CIA command that exposes the latch itself."`
> [VERIFIED: src/mcp/vice/stock-cia.ts:118-120]

Note the shape: **what was asked for, why it cannot be answered, and where the
nearest answerable thing lives.** `check-skill-tool-coverage.mjs:285` even
enforces a minimum: `Boolean(reason) && reason.length >= 40` [VERIFIED].

**(c) The outer MCP envelope — this is `ToolCallResult`, not a new type:**

```ts
interface ToolCallResult { content: { type: "text"; text: string }[]; isError: boolean; }
function okText(text: string): ToolCallResult  { return { content: [{ type: "text", text }], isError: false }; }
function errText(text: string): ToolCallResult { return { content: [{ type: "text", text }], isError: true  }; }
```
[VERIFIED: src/mcp/vice/anno-tools.ts:133-148]

and the family's runner is the **never-throw boundary**, catching everything and
naming the error class:

```ts
} catch (err) {
  const errName = err instanceof Error ? err.name : "Error";
  const errMessage = err instanceof Error ? err.message : String(err);
  return errText(`${name} failed: [${errName}] ${errMessage}`);
}
```
[VERIFIED: src/mcp/vice/anno-tools.ts:1205-1213]

**The rule the planner should write down:**

| Situation | Channel | Shape |
|---|---|---|
| The verb ran and produced an answer | `okText(JSON.stringify(result))` | `isError: false` |
| A *named field* of an otherwise-successful answer cannot be produced | `okText`, with that field as `{available:false, reason}` | shape (b) |
| The whole request is **ambiguous or unsupported** (MCP-04's refuse-by-name) | `okText`, body `{available:false, reason}` | shape (a); **never a zero, never an empty array** |
| An argument is invalid | `errText(...)` naming the `AnnoStoreError` subclass | `isError: true` |

**Why the last two must be different channels:** an ambiguous-but-well-formed
request is not a caller error, and returning `isError: true` for it teaches an
agent to retry. Returning `{results: [], count: 0}` for it is exactly the
"plausible-looking zero" `MCP-04` forbids. The `{available:false, reason}` body on
a successful call is the only shape that is both honest and non-retryable.

**One constraint on the error channel:** the proxy's own catch at
`vice-proxy.ts:3487` renders a thrown error as `e.message` only — the structured
`data` fields of an `AnnoStoreError` are **lost on the wire** [VERIFIED:
src/mcp/vice/vice-proxy.ts:3480-3488]. The `anno-types.ts` error family already
puts the offending value and range into the message text, so this costs nothing
today, but a new error class added in this phase must do the same.

### Discretion 3 — The batch verb's recursive inner-name pre-validation

**Read before it dies.** `assertCuratedBatch()` at `anno-tools.ts:801-835`, with
its doc block at `:792-800`:

> *"Walks a `anno_batch_execute` payload's `calls` array and refuses the WHOLE
> batch if any inner call's name is outside `CURATED_ANNO_TOOLS`, or if a `calls`
> entry is malformed (not an object, or missing a string `name`) — a malformed
> payload is a REFUSAL, never treated as an empty batch that passes through.
> **Recurses into a nested `anno_batch_execute`** (upstream permits arbitrary
> tool names inside a batch, including another batch call) so a two-level
> smuggling attempt is caught the same way a one-level one is. Also refuses WHOLE
> on an illegal `anno_set_label_name` name (T-11-NAME-INJECT), naming the
> offending `calls[i]`."*
> [VERIFIED: src/mcp/vice/anno-tools.ts:792-800]

The discipline, in five checkable rules, each with its site:

1. **A malformed payload is a refusal, never an empty batch.**
   `if (!isPlainObject(args) || !Array.isArray(args.calls)) throw …` — `:802-808`
2. **A malformed entry names its index and refuses the whole batch.**
   `` `anno_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name")` `` — `:812-817`
3. **An uncurated inner name refuses the whole batch, by index and by name.**
   `` `…calls[${i}].name "${call.name}" is outside the curated … (D-33)` `` — `:818-823`
4. **Per-verb argument validators fire identically inside and outside a batch.**
   `assertLegalLabelArg(call.arguments, i)` / `assertReadRegionArgs(call.arguments, i)` — `:825-830`; the same two functions are called from `assertCuratedTool()` at `:864-869` with `batchIndex` undefined. Every one takes an optional `batchIndex` and interpolates ` (calls[N])` into the message.
5. **Recursion.** `if (call.name === "anno_batch_execute") { assertCuratedBatch(call.arguments); }` — `:831-833`, exactly mirroring `assertCuratedTool`'s own `:868-870`.

Plus the invariant that makes it sound: **pre-validation runs before anything
executes.** `runAnnoTool`'s doc says *"First statement: `assertCuratedTool`"*
and the body confirms it [VERIFIED: anno-tools.ts:1159-1160].

**The reconciliation ROADMAP criterion 5 needs, which is already written down.**
Criterion 5 says the batch *"pre-validates every inner name and returns per-item
status without aborting on the first failure"*, which reads as contradicting
"refused WHOLE". It does not. The module's own measured header settles it:

> *"MEASURED: `anno_batch_execute`'s partial-failure semantics
> (`handler.rs:506-542`, read at execution time against the installed
> external-analyser-core-0.9.20 crate source). The batch does NOT abort on the first
> failing inner call — … each outcome (`Ok`/`Err`) is pushed into a `results`
> array as `{"status":"success","result":...}` or `{"status":"error","error":...}`;
> the loop always runs to completion … This is PER-CALL status reporting … —
> orthogonal to (and irrelevant to) D-33's OWN refusal, which happens entirely on
> our side, before any request reaches the child at all."*
> [VERIFIED: src/mcp/vice/anno-tools.ts:63-75]

**So the replacement is two phases, and the planner should specify it as two:**

- **Phase A — pre-validation, before any store is opened.** Recursive, whole-batch
  refusal on: malformed payload, malformed entry, uncurated inner name, illegal
  label name, out-of-cap read-region range. Throws; becomes `isError:true`.
- **Phase B — execution, one `openStore`/`closeStore` for the whole batch.**
  Loop to completion, push `{"status":"success", …}` / `{"status":"error", …}`
  per entry, never abort. Returns `okText`.

**Two additions the replacement needs that the original did not:**

- **A depth cap.** The original recursion is unbounded; a deeply-nested payload is
  a stack-exhaustion shape. `assertCuratedBatch` was safe only because a spawn cost
  dominated. Cap the nesting depth explicitly and refuse by name past it.
- **`anno_batch_execute` remains the ONE sanctioned exception to the
  nested-argument rule.** CLAUDE.md's `DENY_LIST` exists to close the
  `tools_call`-shaped smuggling hole. The module header names this in terms the
  replacement must inherit verbatim: *"Never add a `tools_call`-shaped meta-tool
  to this surface — that is exactly the nested-argument smuggling shape
  `vice.ts`'s `DENY_LIST` exists to close."* [VERIFIED: anno-tools.ts:88-92]

### Discretion 4 — How `coverage` / `COV-01`'s census re-points

**The boundary is already named and narrow — SEAM-03 did this work.**
`anno-coverage.ts` declares three input shapes and its own header states it never
calls a tool:

```ts
export interface AnnoSymbol        { address: number; name: string; kind: string; type?: string; }
export interface AnnoComment       { address: number; type: string; comment: string; }
export interface AnnoCrossReference{ address: number; callers: readonly number[]; }
```
> *"Input shapes -- exactly what the curated read tools return … This module never
> calls those tools itself; a caller fetches and hands the data in. That is what
> keeps it pure, keeps it session-free, and keeps it testable with no child
> process."*
> [VERIFIED: src/mcp/vice/anno-coverage.ts:195-227]

The block-entry shape is deliberately elsewhere:
`export interface BlockEntry { start_address: number; end_address: number; type: string; }`
[VERIFIED: src/mcp/vice/block-class.ts:113-118], with `blockClassAt()` the one
function allowed to interpret `type`.

**So the re-point is a four-function adapter in the CLI, not a change to
`anno-coverage.ts`.** Only the *caller* changes: `anno-cli.ts:1384-1386` stops
doing `queryAnnoJson<T>("anno_get_symbols", …)` and instead opens the store once
and maps:

| Census input | Store source | Mapping |
|---|---|---|
| `AnnoSymbol[]` | `listLabels()` → `LabelRow{id,address,name,kind,bank}` | `{address, name, kind}`; drop `id`/`bank`; `type` is `undefined` (the store has no `LabelType`). **`kind` is already the same four-token vocabulary** — `LABEL_KINDS = ["User","Auto","System","Platform"]` [VERIFIED: anno-types.ts:261], and `computeLabelRatio` filters on exactly `"System"`/`"Platform"` [VERIFIED: anno-cli.ts:1393-1394]. No translation needed. |
| `AnnoComment[]` | `listComments()` → `CommentRow{id,address,commentType,text,bank}` | `{address, type: commentType, comment: text}`. `COMMENT_TYPES = ["line","side"]` [VERIFIED: anno-types.ts:239] matches `AnnoComment.type`'s documented `"line"`/`"side"` exactly. |
| `BlockEntry[]` | `listRanges()` → `RangeRow{id,start,endInclusive,dataType,bank}` | `{start_address: start, end_address: endInclusive, type: dataType}` — **⚠️ verify the `type` vocabulary against `blockClassAt()`.** `DATA_TYPES` is the frozen twelve `["code","byte","word","address","petscii","screencode","lo_hi_address","hi_lo_address","lo_hi_word","hi_lo_word","external_file","undefined"]` [VERIFIED: anno-types.ts:181-194]; `block-class.ts`'s classifier was written against *upstream's* `Display` strings. `SEAM-03` says the census must pass against the new store; this mapping is the one place it can silently not. |
| `AnnoCrossReference[]` | `anno_get_cross_references`'s **derived** answer (F-1's `STORE-06` work) | `{address, callers: sorted-deduped from-addresses}`. This is the only input that depends on new code. |

Two further edits in the same verb: `resolveStorePath()` (deleted with
`anno-tools.ts`) is replaced by `storePathWithinWorkspace()`
[VERIFIED: anno-types.ts:1140], and the per-address xref loop
(`MAX_COVERAGE_CROSS_REFERENCE_LOOKUPS` round trips) collapses into **one**
derivation pass — the round-trip cap becomes vestigial and should be removed
rather than left as a silent truncation.

**`SEAM-03`'s own acceptance is the test to re-run:** *"`COV-01`/`COV-02`'s
census-versus-store boundary test passes against the new store."*

### Discretion 5 — Renumber Phases 30–32, or narrow them?

**Recommendation: NARROW. Do not renumber.**

**What D-01 actually leaves for each phase, measured against the ROADMAP text:**

| Phase | Survives D-01? | What is left |
|---|---|---|
| **30 — ACME Export and the Real-ACME Oracle** | **Yes, entirely.** | All three requirements (`EXPORT-01/02/03`) and all five criteria are about building a *new* ACME oracle. The ROADMAP's own note already says `anno-verify.ts` *"dies with its subject. Only the discipline survives. Plan this as a rebuild, not a rename."* Nothing in Phase 30 depended on anno surviving. **Only its note about ordering constraint 2 needs a sentence.** |
| **31 — Procedure Re-pointing** | **Substantially consumed.** | `REPOINT-01` (5 files, 17 names) and `REPOINT-02` (`installer/skills/`) are pulled into 29 by in-scope item 5. `REPOINT-03` (the `ABS-02` attribution chain, `routine-queue-walker/SKILL.md:3`'s YAML description, `ABS-03`'s pairwise trigger-collision check) and `REPOINT-04` (`upstream-procedure-manifest.json`'s own re-sync trigger) are **not** — they are prose/attribution work with their own guards and are cleanly separable. |
| **32 — The Deletion and the Grep Gate** | **Substantially consumed.** | `CUT-01`/`CUT-02`/`CUT-03`/`CUT-05` land in 29. `CUT-04` (every guard's recorded, non-vacuously-verified fate — 32 test files and 11 `scripts/` files) and `CUT-06` (every living document naming anno as a required prerequisite) are large and are **not** in 29's seven streams. |

**Why not renumber:**

1. **`ROADMAP.md` phase numbers are cited from tracked, guarded files.**
   `absorbed-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
   existence guard (D-11); `anno-derivation.test.ts` resolves
   `"../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json"`
   as a **literal path** [VERIFIED: src/mcp/vice/anno-derivation.test.ts:46];
   `comment-phase-pointers.test.ts` exists specifically to police phase pointers.
   Renumbering 30→30 is fine but a cascade is not, and the value bought is zero.
2. **`REQUIREMENTS.md`'s Traceability table maps every requirement to exactly one
   phase number**, and its own text says *"Every v0.7.0 requirement maps to
   **exactly one** phase; the mapping is `ROADMAP.md`'s per-phase
   `**Requirements**:` lines"* [VERIFIED: .planning/REQUIREMENTS.md:206-209]. A
   renumber rewrites 28 rows; a narrow rewrites the ~10 rows whose phase actually
   moved.
3. **Phase 30 is untouched.** Renumbering it to 29-bis or 30' for symmetry would
   be churn with a real cost and no benefit.

**What breaks under the alternative (renumber):** the traceability table, every
`ROADMAP.md` cross-reference in `STATE.md`'s history section, the phase-directory
names on disk (which several tests read literally), and — because
`.planning/phases/` is never archived by owner decision — the entire back-reference
graph. Renumbering is strictly more expensive and buys nothing a `**Requirements**:`
line edit does not.

**Concretely, the edits D-01 requires (in-scope item 7):**

- ROADMAP Phase 29 criterion 2: replace *"Both families are registered and callable
  at this phase's close"* with the deletion outcome.
- ROADMAP Phase 31: drop criteria 1–3 (moved to 29); keep 4–5.
- ROADMAP Phase 32: drop criteria 1–3 and 5's grep-gate half; keep 4 (guard fates)
  and the living-document half of 5. Its "Depends on" changes.
- ROADMAP "Sequencing Rationale" constraints 2, 3 and 4: constraint 3 (*"The
  removal follows the skill re-pointing (31 → 32)"*) becomes an **intra-phase**
  ordering constraint inside 29 and must be restated as such, not deleted —
  it is the reason the grep gate is built before the deletion commit.
- `REQUIREMENTS.md`: `MCP-02`/`MCP-05` coexistence clauses; move
  `REPOINT-01`/`REPOINT-02`, `CUT-01`/`CUT-02`/`CUT-03`/`CUT-05` to Phase 29 in
  the traceability table.

---

## The Registration Seam

### The exact two-line substitution

```ts
// vice-proxy.ts:194
import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";

// vice-proxy.ts:3401-3403
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
[VERIFIED: src/mcp/vice/vice-proxy.ts:194 and :3401-3403, quoted verbatim]

`buildViceTool` is at `:3263`:
`function buildViceTool(def: ToolDefinition, run: (args: Record<string, unknown>) => Promise<ToolCallResult>)`
[VERIFIED].

**The loop variable name is load-bearing.** Its comment says so:

> *"Deliberately NOT named `def` (the manifest loop's own loop variable, above):
> `stock-dispatch.test.ts`'s `proxyToolRegistrations()` regex-scans this file's own
> `tools[...] = ...;` lines and keys each one by its raw captured text, so an
> identically-named loop variable here would make this registration textually
> indistinguishable from the manifest loop's"*
> [VERIFIED: src/mcp/vice/vice-proxy.ts:3393-3400]

So the replacement variable must be a distinct name (`annoDef`) and the
`BACKEND_SEAM_BYPASS_KEYS` entry becomes `"annoDef.name"` **in the same position**
— the assertion is an ordered `deepEqual`.

### The four re-pointing sites in `stock-dispatch.test.ts`

```ts
// :1505 — ORDERED; source-order of registrations must match
const BACKEND_SEAM_BYPASS_KEYS = ["RESULT_CONTINUE_TOOL.name", "annoDef.name"];
```
[VERIFIED: src/mcp/vice/stock-dispatch.test.ts:1505]

1. `:1505` — the allow-list itself. **Rename the second entry in place.**
2. `:1507-1517` — the "every registered tool whose runner can touch a transport
   goes through `buildBackendAwareTool`" test; also asserts
   `registrations.length >= 5` with a message naming "the anno loop registration".
3. `:1519-1531` — `assert.deepEqual(bypassing, BACKEND_SEAM_BYPASS_KEYS, …)` —
   **order-sensitive**, and it is the non-vacuity half.
4. `:1549-1563` — **the body-slice assertion `MCP-02` names.** Verbatim:
   ```ts
   const start = ANNO_TOOLS_SOURCE.indexOf("export async function runAnnoTool(");
   assert.ok(start > 0, "runAnnoTool() must still exist in anno-tools.ts");
   const body = ANNO_TOOLS_SOURCE.slice(start, ANNO_TOOLS_SOURCE.indexOf("\n}", start));
   for (const forbidden of ["forwardToVice", "ensureViceSession", "rewriteArguments"]) {
     assert.ok(!body.includes(forbidden), `runAnnoTool() must not reach ${forbidden} -- that is what makes the anno_* family's backend-independence sound`);
   }
   ```
   [VERIFIED: src/mcp/vice/stock-dispatch.test.ts:1549-1562]
   Note `const ANNO_TOOLS_SOURCE = readFileSync(join(…, "anno-tools.ts"), "utf8");`
   at `:1547` — the file path must move with the module.
5. `:1564-1575` — "every curated `anno_*` name is absent from BOTH manifests",
   iterating `CURATED_ANNO_TOOLS`. Re-point to the `anno_*` set. **This is
   `MCP-03`'s "neither manifest gains an entry" half.**

### Verified: `docs/tool-support.md` regenerates byte-identical

`29-CONTEXT.md` says *"Verify rather than assume."* I ran the generator against a
scratch copy. **Result: byte-identical, both 7,874 bytes, and equal to the
committed file.**

Method (no tree mutation — scratch copies only):
1. `genOrig.generateToolSupportTable({})` → the committed table; asserted
   `=== readFileSync("docs/tool-support.md")` → **true**, 7,874 bytes.
2. Wrote a scratch `vice-proxy-swapped.ts` applying exactly the substitution above
   (`annoDef` / `ANNO_TOOL_DEFINITIONS` / `runAnnoTool` / `./anno-tools.ts`).
3. Wrote a scratch generator with `ANNO_TOOL_DEFINITIONS` → `ANNO_TOOL_DEFINITIONS`.
4. `genNew.generateToolSupportTable({ proxySourcePath: <scratch> })` → **byte-identical
   to (1)**, 7,874 bytes.
5. `discoverSyntheticToolNames` returns `["vice_diagnose","vice_recycle","vice_result_continue"]`
   both before and after.

**And the failure mode if the regex is *not* moved is loud, not silent.** Running
the *unmodified* generator against the swapped proxy throws:

```
generate-tool-support-table: could not resolve synthetic tool registration identifier
"annoDef" (from `tools[annoDef.name] = ...`) to a declaration -- expected a
`const annoDef: ToolDefinition = { ... }` declaration in vice-proxy.ts.
```
[VERIFIED: executed this session against `scripts/generate-tool-support-table.mjs:137-146`]

That is the WR-08 bounding guard working as designed. **The generator cannot emit
a wrong table; it can only throw.** The planner can rely on this.

---

## The Guard Ledger

Every guard named in D-13 and `<canonical_refs>`, with its measured current value,
its exact location as of 2026-08-29, and what this phase owes it.

| Guard | Location (verified) | Current value | Owed |
|---|---|---|---|
| `ANNO_MODULE_FLOOR` | `src/mcp/vice/hostpath-consumers.test.ts:188` | `const ANNO_MODULE_FLOOR = 14;` | Re-express over `anno-` at the measured new count. **See C-3 for the arithmetic problem.** |
| `INT-01` positive control | `hostpath-consumers.test.ts:199-206` | `["anno-acme-ident.ts","anno-regbits-gen.ts","anno-symbols.ts","anno-test-gate.ts"]` | Replace with **real new filenames**; note `anno-test-gate.ts` is proposed for deletion (F-3) so it cannot be one of them under any name. |
| `annoProductionModules()` | `hostpath-consumers.test.ts:180-182` | `topLevelProductionModules().filter((name) => /^anno-.*\.ts$/.test(name))` | Re-point the regex to `/^anno-.*\.ts$/`. Note `topLevelProductionModules()` filters `/\.(ts\|mts)$/` — `anno-durability-mutator.mjs` is **not** counted. |
| `EXPECTED_IMPORTERS` (hostpath) | `hostpath-consumers.test.ts:143` | `["containerpath.ts","install-resources.ts","stock-paths.ts","vice-proxy.ts","vice-sync.ts"]` — exact `deepEqual`, length 5 | **Must remain exactly 5.** `MCP-02`'s "no new module imports `hostpath.ts`" is this assertion. |
| `BACKEND_SEAM_BYPASS_KEYS` | `stock-dispatch.test.ts:1505` | `["RESULT_CONTINUE_TOOL.name", "annoDef.name"]` — **ordered** | Rename entry 2 in place; keep position. |
| body-slice assertion | `stock-dispatch.test.ts:1549-1562` | forbids `forwardToVice` / `ensureViceSession` / `rewriteArguments` in the runner's body | Re-point the file read and the function name. |
| `ANNO_TOOL_DEFINITIONS` regex (authoritative) | `scripts/generate-tool-support-table.mjs:107` (**not :104**) | `/for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/` | Rename the array. Prose at `:95` too. |
| duplicate witness 1 | `src/mcp/vice/tool-support-table.test.mjs:66` | identical regex, brace-depth bounding | Rename. **Never share a helper.** |
| duplicate witness 2 | `src/mcp/vice/capability-registry.test.ts:161` | identical regex, line-oriented bounding | Rename. **Never share a helper.** Also fix its stale `"an array of 17"` comment at `:154` — it is **19**. |
| `files[]` anno entries | `src/mcp/vice/package.json:56-71` | 16 entries (15 `.ts` + `anno-regbits.json`) | Every deleted file must leave `files[]` **in the same commit**; `check-npm-packages.mjs` fails on a stale entry. |
| `shippedTsModules()` floor | `src/mcp/vice/spawn-seam.test.ts:251` | `assert.ok(modules.length >= 40, …)` | Safe: 65 `.ts`/`.mts` in `files[]` today → 60 after deleting 5 glue modules. |
| `check-npm-packages.mjs` closure | run this session | `transitive closure from vice-proxy.ts -- 60 modules, clean`; `@henols/vice-mcp -- 80 files`; `@henols/c64-re-tools -- 34 files, 7 skills` | Re-run; it is the only proof `installer/skills/` is right. |
| `extractedAnno.size` floor | `scripts/check-skill-tool-coverage.mjs:446` | `assert(extractedAnno.size >= 10, …)`; **measured today: 17** | Re-express over `anno_`. D-13's "raised": with 17 names re-pointed, a floor of 17 is a raise. ✅ |
| `ANNO_CLI_VERB_FLOOR` | `scripts/lib/anno-cli-verbs.mjs:44` | `export const ANNO_CLI_VERB_FLOOR = 8;` — comment says *"never lower it to make a regression pass"* | **The module is `glue` and D-02 deletes it.** The floor is therefore *replaced*, not lowered: a new parser module over the renamed CLI with a floor of **5**. Recording it as a replacement rather than a lowering is what keeps the discipline honest. |
| `parseAnnoCliVerbs` consumers | `scripts/check-skill-tool-coverage.mjs:50,464-468` and `src/mcp/vice/anno-verb-coverage.test.ts` | 8/8 verbs resolved | Both re-point. The test hard-pins `assert.equal(verbs.length, 8)` at `:158` and names `export-asm` at `:163`. |
| `verbsMissingFromSkills` | `scripts/lib/anno-cli-verbs.mjs:146-148` | matches the literal `` `anno ${verb}` `` | The literal changes with the CLI's new name. **The CLI's new name is an unmade decision — see C-4.** |
| `check-skill-fork-honesty.mjs` `"anno export-asm"` | `scripts/check-skill-fork-honesty.mjs:500-504` | `need(acmeBuildSkillSource.includes("anno export-asm"), …)` | D-10: strip the route from `acme-build/SKILL.md`, re-point the assertion at the renamed CLI. |
| `toacme` walk (the precedent) | `check-skill-fork-honesty.mjs:452-480`, corpus at `scripts/lib/skill-corpus.mjs:39-62` | per-line, whole-tree over `src/skills/`, `/\.(md\|mjs)$/`; exactly one line-scoped exemption with `exemptionHits === 1` non-vacuity | **The template for the grep gate's exemption discipline.** Its scope is too narrow to copy directly (see Discretion 1). |
| `EXPECTED_DOCS_GUARD_NAMES` | `scripts/audit-gate.mjs:129-137` (the anno entry at `:136`) | 7 names incl. `"docs-absorbed-decisions.test.ts"`; `DOCS_GUARD_FLOOR = 7` at `:109` | D-12: the test file and this entry move **in one commit**. If the file is renamed rather than deleted the floor is unchanged; if deleted, `DOCS_GUARD_FLOOR` must drop to 6 **and** `audit-integrity.test.ts`'s registry-vs-disk cross-check re-run. |
| `docs-absorbed-decisions.test.ts` content pins | `src/mcp/vice/docs-absorbed-decisions.test.ts:48` | `GUARD_FILENAMES = ["anno-session.test.ts", "spawn-seam.test.ts"]` | `anno-session.test.ts` is deleted. Re-point or the guard goes red on its own content. |
| `docs-linerefs.test.ts` | `src/mcp/vice/docs-linerefs.test.ts:37-99` | reads CLAUDE.md's `rewriteArguments()` bullet, ≥2 `vice-proxy.ts:<N>` citations, each must land on a `rewriteArguments(` call or a `function` line | **Any net line-count change above `vice-proxy.ts:3052` reds this.** See Pitfall 4. |
| `MANUAL_ONLY_TESTS` | `src/mcp/vice/test-gate.mjs:95-105` | 9 files, exact-set asserted by `test-gate.test.ts:16-22` | Every `*.test.*` on disk must land in exactly one of automated/manual. Adding or deleting a test file changes the derived automated set; the exact-set assertion is on `MANUAL_ONLY_TESTS` only, so deletions of anno tests are fine. |

---

## Common Pitfalls

### Pitfall 1 — Registering through `buildBackendAwareTool()` makes the store unreachable on stock

**What goes wrong:** the family is invisible/refused on the stock backend.
**Why:** `buildBackendAwareTool()`'s non-fork arm calls `dispatchStock()`, which has
no table entry for the new names and refuses by name.
[VERIFIED: assertion at `stock-dispatch.test.ts:1577-1583` — *"the non-fork arm must answer through dispatchStock"*]
**How to avoid:** `buildViceTool()`, always.
**Warning sign:** the `deepEqual(bypassing, BACKEND_SEAM_BYPASS_KEYS)` test at
`:1519` goes red naming the missing key.

### Pitfall 2 — Hand-adding the family to a manifest

`refresh-manifest.ts` regenerates `tools-manifest.json` from a live *host VICE*
`tools/list` and would wipe the entry. The proxy-local family belongs in **neither**
manifest, and `stock-dispatch.test.ts:1564-1575` asserts exactly that.

### Pitfall 3 — Deriving the module set from a hand-typed list

`INT-01` found four uncovered modules in the ten-name hard-coded array
`annoProductionModules()` replaced. The comment at `hostpath-consumers.test.ts:182-187`
is explicit: *"an empty or broken glob (e.g. a typo'd filter regex, or a directory
walk that silently resolves to the wrong path) must fail this test rather than pass
vacuously."* Every derived set in this phase — the module glob, the verb set, the
skill corpus — uses `readdirSync` + a stable regex + a floor.

### Pitfall 4 — Line-count drift in `vice-proxy.ts` reds `docs-linerefs.test.ts`

CLAUDE.md cites `vice-proxy.ts:3052` (`rewriteArguments()` inside `forwardToVice()`)
and `:1531` (inside `gatherWedgeEvidence()`). `docs-linerefs.test.ts:66-83` checks
each cited line still contains `rewriteArguments(` or a `function` keyword.

**Deleting the import at `:194` shifts everything below it by one line**, moving
`:1531` and `:3052` to `:1530` and `:3051`. `29-CONTEXT.md` promises the change is
*"a two-line substitution (the import and the loop)"* — substitution, not deletion.
**Keep it a substitution: replace line 194 in place, replace lines 3401-3403 in
place, add no lines and remove none.** If the line count does change, CLAUDE.md's
citations must be corrected in the same commit and `docs-linerefs.test.ts` re-run.
CLAUDE.md itself already anticipates this: *"Line numbers in this bullet are checked
against the source at each phase and drift between phases; treat a mismatch as drift
to re-verify."*

### Pitfall 5 — A large `anno_disassemble` result is **not** chunked

`wrapPossiblyChunked()` (`vice-proxy.ts:2108-2125`) splits results over
`OUTPUT_CHAR_CAP` (default **500,000**, `VICE_MAX_RESULT_CHARS`-overridable,
`:436-439`) into a `vice_result_continue` sequence. **The anno loop registration
does not go through it** — `buildViceTool(def, run)` calls `run` directly.

The measured client ceiling is far lower: the proxy's own comment records
*"MAX_MCP_OUTPUT_TOKENS genuinely governs the CLIENT's own inline-response ceiling
(measured at 40-60KB … a 64K RAM read is ~192KB as hex, far above either figure)"*
[VERIFIED: vice-proxy.ts:443-448].

**Mitigations, both already conventions here:**
- `anno_read_region`'s range cap. `ANNO_READ_REGION_MAX_BYTES = 4096`, whose
  comment reads: *"A full-64K disassembly view dumped into an LLM's context is the
  hazard this cap exists to prevent … ONE cap, both views, so there is no per-view
  rule to get subtly wrong."* [VERIFIED: anno-tools.ts:196-207]
- `max_results` **required, no default**, on every list-returning verb, with the
  count returned so truncation is detectable. The existing description is the
  wording to carry: *"`max_results` is REQUIRED on this surface (no default):
  The external analyser's own default is 50, which would silently truncate a full-program
  pass -- pass an explicit ceiling and compare the returned count against it to
  detect truncation."* [VERIFIED: anno-tools.ts:419-424]

### Pitfall 6 — Trusting `inputSchema`

`validate: (value: unknown) => ({ value })` [VERIFIED: vice-proxy.ts:3230]. Every
`type: "integer"`, every `required: [...]`, every `enum` is **documentation for the
agent and nothing else**. 28-REVIEW.md's WR-22 is the recorded consequence: a JSON
`"1"` arrived verbatim and SQLite's column affinity turned an argument error into a
corruption refusal.

**What the MCP layer owes, concretely:**

| Argument | Owed validation | Existing helper |
|---|---|---|
| `store` (path) | resolve + confine under workspace | `storePathWithinWorkspace()` `anno-types.ts:1140` |
| `image` (path) | resolve + confine under workspace | same helper; then `parsePrg()` refuses a non-PRG |
| `address` / `start` / `endInclusive` | integer, `0..0xffff`, `"$hex"`/`"0x"` strings accepted, **unprefixed numeric strings refused** | `parseStoreAddress()` `:864`; `assertRangeShape()` `:828` |
| `dataType` | exact membership in the frozen twelve | `assertDataType()` `:810` |
| `commentType` / `kind` / `accessKind` | exact membership | `assertCommentType()` `:1174`, `assertLabelKind()` `:1180`, `assertAccessKind()` `:1187` |
| label `name` | legal ACME identifier | `assertLegalLabel()` `:1217` |
| comment `text` | ≤ `MAX_COMMENT_BYTES` (4096), no leading `;` | `assertCommentText()` `:1281` |
| enum `name` / variant keys | `assertEnumName()` `:1252`, `parseVariantKey()` `:1322` | — |
| `revision` (for `revertTo`, if exposed) | **non-negative integer, numeric strings refused** | `assertRevisionArgument()`, added by 28-20 — WR-22's fix |
| `max_results` | positive integer, **required** | none — new |
| batch `calls[]` | the five rules of Discretion 3 | none — new |

The store's own contract already covers most of this: *"Every argument is validated
before any SQL runs -- the transport validates nothing (see `anno-types.ts`'s
header)."* [VERIFIED: anno-store.ts:2300-2302]. The MCP layer's job is to **not
add a second, weaker validator** — call the store's assertions, do not re-implement
them, and validate only what the store cannot see (paths, `max_results`, batch
shape).

### Pitfall 7 — A cached derivation

`putXref`'s contract, `COV-01`'s census, and the ROADMAP note all forbid it
independently. If `anno_get_cross_references` or `anno_search` ever writes an index
to disk, it creates the second on-disk truth that `COV-01`'s
derived-from-bytes census exists to make impossible.
**Detection:** a structural test asserting `delete from anno_` / `insert into anno_`
appear in exactly the existing sites — the same shape 28-REVIEW used
(`grep -n 'delete from anno_'` → exactly two hits).

### Pitfall 8 — Refactoring the three bounding witnesses into a helper

Named in all three files, in their own words, as load-bearing. The three
*deliberately different* bounding techniques (character-offset search / brace-depth
counting / line-oriented scanning) are three independent witnesses. Collapsing them
destroys the property. **Rename in three places; share nothing.**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Address parsing from agent input | a `parseInt`/regex | `parseStoreAddress()` `anno-types.ts:864` | Owns the `$`/`0x` forms *and* the deliberate refusal of unprefixed `"1024"` (trap 4 in its header). A second parser is a second vocabulary. |
| Range validation | inline `if (start > end)` | `assertRangeShape()` `:828` | Also owns the split-table even-byte-count rule; getting that wrong is CR-09. |
| Data-type vocabulary | a string literal | `assertDataType()` `:810` over the frozen `DATA_TYPES` | `STORE-01`'s twelve are the milestone's one irreversible decision. |
| Narrowest-range-wins lookup | an interval tree / SQL query | `buildPaintIndex()` + `resolveAt()` `anno-index.ts:96,142` | `STORE-03` cross-validated it at all 65,536 addresses; out-of-scope table in REQUIREMENTS names the six surveyed interval-tree packages and why none fits. |
| Path confinement | `resolve()` + `startsWith` | `storePathWithinWorkspace()` `:1140` | WR-01's finding: a not-yet-existing leaf under a directory symlink bypassed containment entirely. |
| 6502 decode | anything | `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` | 2,555 lines incl. illegal opcodes; `EXPORT-03` records that an internally-checked opcode table still shipped 14 wrong entries. |
| PRG parsing | a 2-byte read | `parsePrg()` / `flatImageOrigin()` `prg-image.ts:69,86` | D-04: already extracted, prefix-free, and the obligation is recorded discharged. |
| Skill corpus walking | a fresh `readdirSync` | `walkSkills()` / `topLevelSkillDirs()` `scripts/lib/skill-corpus.mjs` | One corpus, three consumers. |
| Shipped-file enumeration | a glob over `files[]` | `packFiles()` `scripts/check-npm-packages.mjs:140` | It runs `prepack`, so the installer sync cannot be forgotten. |
| Comment stripping for a source scan | a regex | the character-scanner `stripComments()` in `scripts/lib/anno-cli-verbs.mjs:56-93` | *"`docs-dangling-refs.test.ts` measured a regex-alternation extractor silently missing a literal at the exact site a real defect lived."* Carry the function into the replacement module; do not re-derive it. |

**Key insight:** this codebase's whole quality posture is *one seam per concern,
derived from disk, with a floor that only rises and a planted violation observed
red*. Nine of the eighteen verbs are three lines of argument decode over a function
that already exists. The temptation this phase creates is to write a second,
"simpler" validator at the MCP layer because the tool schema looks like a contract.
It is not a contract — see Pitfall 6.

---

## Conflicts the Planner Must Resolve

### C-1 — `MCP-02` and `MCP-05`'s coexistence clauses are false by decision

`MCP-05` ends *"Both families coexist at this point, so nothing is deleted to make
them pass."* D-01 deletes. `29-CONTEXT.md` in-scope item 7 makes editing
`REQUIREMENTS.md` part of this phase. **Not a research contradiction — a recorded
supersession the plan must execute.** Note that `MCP-05`'s *first* sentence (the
guard list) survives untouched, and D-13 says so explicitly.

### C-2 — `anno_save_project`: a `curated` manifest verb that is a named anti-feature

The manifest disposes `anno_save_project` **`curated`**, so D-08's mechanical check
demands a route. ROADMAP Phase 29's anti-feature list names *"an explicit save verb
that governs durability (durability is the store's, not the caller's)"*.

**Recommended resolution:** route it, honestly. `anno_save_project(store)` opens,
reads `currentRevision()` (`anno-store.ts:555`), closes, and returns
`{revision, durable: true, note: "every write on this surface is committed and durable at the moment it returns; this verb reports the current revision and performs no write"}`.
That satisfies D-08 (a route exists), satisfies the anti-feature (the caller does
not govern durability), and is honest.

**Rejected alternative:** returning `{available:false, reason}` — that makes the
verb a permanent refusal for a `curated` disposition, which is what the `omit`
disposition is for, and the manifest does not say `omit`.

**The planner must record whichever it chooses in the D-08 register**, because
"a route that reports rather than writes" is the kind of thing a later reader will
mistake for an oversight.

### C-3 — D-13's "raised not lowered" may be arithmetically unsatisfiable

`ANNO_MODULE_FLOOR = 14`. D-13 says it is *"re-expressed over the `anno-` prefix
at the measured new count, **raised not lowered**"*.

**The arithmetic.** `topLevelProductionModules()` counts `.ts`/`.mts` only.
Today: `anno-index.ts`, `anno-store.ts`, `anno-types.ts` = **3**
(`anno-durability-mutator.mjs` does not count).

| Naming policy | `anno-*.ts` at phase close | ≥ 15? |
|---|---|---|
| **A — every survivor takes `anno-`** | 3 existing + 9 renamed capabilities (F-3's corrected set, incl. `anno-regbits.json` which is *not* `.ts`, so 8 `.ts`) + `anno-cli.ts` + 3–5 new surface modules ≈ **15–17** | marginally yes |
| **B — bare names, following SEAM-01's `acme-gate.ts` precedent** (`d64.ts`, `confidence.ts`, `coverage.ts` …) | 3 existing + `anno-cli.ts` + 3–5 new ≈ **7–9** | **no** |

Policy B is the more natural rename (`anno-d64.ts` for C64 disk geometry is
misleading, and SEAM-01 already set the bare-name precedent by extracting
`acme-gate.ts`). Policy A is forced only if "raised" is read literally.

**Two readings of D-13, and a recommendation:**

- *Literal:* the new floor must be `> 14`. Forces Policy A.
- *Charitable (recommended):* the floor is set **to the measured new count**, and
  the *discipline* "raise, never lower" carries forward from that point — which is
  exactly what the existing comment says of itself: *"This floor must be RAISED,
  never lowered, **as the family grows**"* [VERIFIED: hostpath-consumers.test.ts:182-187].
  Under this reading Policy B works with a floor of e.g. 7.

**Recommendation: the charitable reading, Policy B for names, floor at the measured
count.** But this is a locked-decision interpretation and the planner should state
the reading it adopts in the plan rather than let a number decide a naming policy.

### C-4 — The renamed CLI has no name yet

D-02 says `anno-cli.ts` is "renamed"; D-10 says the fork-honesty assertion is
"re-pointed at the renamed CLI"; `verbsMissingFromSkills` matches the literal
`` `anno ${verb}` ``, so **every skill file's invocation prose changes with it**,
and Phase 30 will restore `export-asm` "under that name".

Nothing names it. Candidates: `anno-cli.ts` invoking as `anno <verb>` (consistent
with D-05's single prefix, and it makes the C-3 arithmetic slightly better);
`c64-cli.ts` / `c64 <verb>` (reads better for `d64`/`render-memmap`, costs a second
prefix D-05 rejected). **Recommendation: `anno-cli.ts`, invoked as `anno <verb>`** —
D-05's single-prefix rule is the binding decision and this is downstream of it.

### C-5 — `check-skill-tool-coverage.mjs` will find `anno_*` names it cannot classify

The script has two independent sections: `vice_*` names (classified against the two
manifests + `capability-registry.ts`) and `anno_*` names (classified against
`CURATED_ANNO_TOOLS`). `MCP_PREFIX_RE`/`TOOL_NAME_RE` in `skill-corpus.mjs` extract
`vice_*`; `ANNO_TOOL_NAME_RE = /\banno_[a-z0-9_]+/g` at `:88` extracts the other
family into its own map, *"Kept in its OWN map rather than …"* [VERIFIED:
scripts/check-skill-tool-coverage.mjs:83-88].

Re-pointing is a mechanical rename of that regex and its floor — **but the
`anno_*` names have no manifest at all**, so the "absent from BOTH manifests"
assertion at `:407-421` becomes the *only* structural check on them, and the
non-vacuity control at `:423-431` (which pins `anno_get_address_details` as
curated) needs a new subject. Pick one that is load-bearing, not arbitrary:
`anno_search` (it is `STORE-06`'s named requirement and lives in the D-08 register,
so if it silently leaves the surface both checks should fire).

---

## Contradicts a Locked Decision

Two places where measurement contradicts a locked decision with hard evidence.
Stated here rather than planned around.

### CD-1 — D-02's "keeping the five that import capability modules only" is false

**Locked text:** *"Renamed, not deleted: `anno-cli.ts`, dropping only the three
verbs that reach the spawn (`bootstrap`, `export-asm`, `verify`) and keeping the
five that import capability modules only (`gen-enums`, `export-lbl`, `import-lbl`,
`render-memmap`, `coverage`). Verified at discussion time by reading the CLI's own
import list."*

**Evidence:** the verification was one level deep. See **F-2**. Four of the five
kept verbs reach `anno-launch.ts` or `anno-tools.ts` **through the capability
modules themselves** — five verbatim import lines quoted there, plus eight use
sites.

**Consequence:** D-02's *conclusion* (the external dependency can go in Phase 29
without inventing an export route ahead of Phase 30) still holds — `anno-verify.ts`
was never going to be reused, as ROADMAP Phase 30's own note says. **But its
*sizing* does not.** `export-lbl`/`import-lbl`/`gen-enums`/`coverage` are four
rebuilds, and `export-lbl`/`import-lbl` carry the ✓ Validated `ANNO-14`/`ANNO-15`
round trip whose proof does not transfer.

**What the planner must do:** either plan the four rebuilds as first-class work in
this phase, or narrow D-02's kept-verb set (e.g. keep only `render-memmap` and
`coverage`, and let `gen-enums`/`export-lbl`/`import-lbl` follow the export route
into Phase 30 alongside the ACME oracle). **This is a scope decision the plan cannot
make silently** — it is roughly the difference between a large phase and a very
large one.

### CD-2 — D-03's eleven-module rename set includes two modules the registry itself says will not survive

**Locked text:** *"The 11 `capability` modules are renamed out from under the prefix
… The survivors are … `anno-test-gate.ts`, `anno-verify.ts`."*

**Evidence:** see **F-3**. `module-classification.ts`'s own `note` fields say, in
its own words, *"Do NOT read this verdict as a claim that the module survives a
prefix deletion"* (`:487-488`) and *"what a later phase inherits is the discipline
… NOT the route"* (`:520-522`). Corroborated by import measurement:
`anno-test-gate.ts` has zero surviving importers (both live ACME-gated tests use
`acme-gate.ts`), and `anno-verify.ts`'s only import is the deleted
`anno-launch.ts`.

**Note this is not research overruling the registry — it is research reading the
registry as designed.** D-03's own text says the deletion is *"driven by
`module-classification.ts`, never by a prefix sweep"*, and the registry's verdict
field plus its `note` field are one record. Reading only the verdict is the
name-based shortcut D-03 exists to prevent, one level up.

**Recommendation:** rename **9**, delete **2**, and carry `anno-verify.ts`'s two
pinned false-pass transcripts forward as Phase 30 fixtures — the registry names them
as the thing that must survive.

---

## Architecture Patterns

### System Architecture Diagram

```
  Claude Code (MCP client)
        │  stdio JSON-RPC
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ vice-proxy.ts  (module scope: tools{} built ONCE)                         │
│                                                                           │
│   manifest loop ──► buildBackendAwareTool ──► fork? forwardToVice()        │
│                                          └──► stock? dispatchStock()      │
│                                                    │                      │
│   3 synthetic  ───► buildBackendAwareTool ─────────┘   (recycle/diagnose) │
│      "         ───► buildViceTool ──► handleResultContinue  (continue)    │
│                                                                           │
│   :3401  anno loop ─► buildViceTool ──► runAnnoTool(name, args)  ◄── NEW  │
│            │                                    │                         │
│            │  (never reaches forwardToVice / ensureViceSession /          │
│            │   rewriteArguments — pinned by the body-slice assertion)     │
└────────────┼──────────────────────────────────────────────────────────────┘
             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ anno-tools.ts   THE NEVER-THROW BOUNDARY                    │
   │                                                             │
   │  1. assertAnnoTool(name, args)   ← allow-list, recursive    │
   │       │                            batch pre-validation     │
   │       ▼  (throws → errText)                                 │
   │  2. resolve+confine store path & image path                 │
   │       ▼                                                     │
   │  3. openStore(path,{workspaceRoot})                         │
   │       │                                                     │
   │       ├─ WRITE verbs ─► setLabel / setComment / setDataType │
   │       │                 addScope / create|updateProjectEnum │
   │       │                 putXref        → AnnoWriteResult    │
   │       │                                  {revision,changed} │
   │       │                                                     │
   │       ├─ STORED READS ► listLabels / listComments /         │
   │       │                 listRanges / listScopes /           │
   │       │                 listProjectEnums / listXrefs        │
   │       │                                                     │
   │       └─ DERIVED READS (NEVER cached on disk)               │
   │             │                                               │
   │             ├─ parsePrg(image) ─► decode() ─► render()      │
   │             ├─ xrefs:  operand.role + resolvedTarget        │
   │             │          ∪ listXrefs()  ∪ resolveSplitTargets │
   │             └─ search: labels ∪ comments ∪ rendered text    │
   │                        (max_results REQUIRED, count out)    │
   │       ▼                                                     │
   │  4. finally { closeStore(handle) }        ← D-06            │
   │       ▼                                                     │
   │  5. okText(JSON) | {available:false,reason} | errText(...)  │
   └─────────────────────────────────────────────────────────────┘
                     │                          │
                     ▼                          ▼
              *.annostore (SQLite)      <program>.prg (read-only)
              + .snapshots/ ring
```

### Recommended module layout

```
src/mcp/vice/
├── anno-store.ts         # Phase 28 — unchanged
├── anno-types.ts         # Phase 28 — unchanged (+ any new error class)
├── anno-index.ts         # Phase 28 — unchanged
├── anno-tools.ts         # NEW: ANNO_TOOL_DEFINITIONS + runAnnoTool + the
│                         #      allow-list gate + recursive batch validation
├── anno-register.ts      # NEW: D-08's second committed register — verbs the
│                         #      manifest does not classify, each citing a
│                         #      requirement id (modelled on
│                         #      module-classification.ts)
├── anno-derive.ts        # NEW: STORE-06 — derived xrefs + search over the
│                         #      disasm-* decoders. NEVER writes.
├── anno-details.ts       # NEW: anno_get_address_details' composition
│                         #      (template: anno-tools.ts:1121)
├── anno-cli.ts           # RENAMED from anno-cli.ts, 5 verbs, 4 rebuilt
└── <9 renamed capability modules>   # naming per C-3
scripts/
├── lib/anno-cli-verbs.mjs        # REPLACES scripts/lib/anno-cli-verbs.mjs
│                                 # (carry stripComments() verbatim)
└── check-no-analyser.mjs  # NEW: the grep gate (Discretion 1)
```

Splitting the surface across `anno-tools` / `anno-derive` / `anno-details` is not
cosmetic: it keeps `anno-tools.ts` small enough that the body-slice assertion stays
readable, gives C-3's floor three real modules, and puts the never-cache rule in a
file whose whole subject is derivation.

### Pattern 1 — Registration (the two-line substitution)

```ts
// vice-proxy.ts:194  — REPLACE IN PLACE, one line for one line
import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";

// vice-proxy.ts:3401-3403 — REPLACE IN PLACE, three lines for three lines
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
Source of the shape: `src/mcp/vice/vice-proxy.ts:194,3401-3403` (verbatim, with
identifiers substituted). Keep the comment block at `:3386-3400` and update its
wording — it explains why the loop variable is not `def`, which is still true.

### Pattern 2 — The per-call open/close runner (D-06)

```ts
export async function runAnnoTool(name: string, args: unknown): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);                    // FIRST statement. Throws.
    const storePath = storePathWithinWorkspace(readStoreArg(args), repoRoot());
    const handle = openStore(storePath, { workspaceRoot: repoRoot() });
    try {
      return okText(JSON.stringify(await dispatch(name, args, handle)));
    } finally {
      closeStore(handle);                          // D-06: always, on every path
    }
  } catch (err) {
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
```
Source: `src/mcp/vice/anno-tools.ts:1158-1213` (the try/catch and `errText`
wording verbatim); `openStore`/`closeStore` signatures from
`src/mcp/vice/anno-store.ts:413,550`.

**Note the deliberate difference from the original:** `assertAnnoTool` is inside
the `try`. The original leaves it outside, which makes a refusal **reject the
promise** rather than resolve `{isError:true}` — filed as WR-02 and explicitly
called *"out of scope for this plan"* at `anno-tools.ts:772-774`. This phase is
the natural place to close it, and closing it makes every refusal reach the caller
through one shape.

### Pattern 3 — Idempotency (MCP-04's "a repeated edit succeeds reporting no change")

```ts
export interface AnnoWriteResult { revision: number; changed: boolean; /* … */ }
```
[VERIFIED: src/mcp/vice/anno-store.ts:193]

Every write already returns `{revision, changed}`, and `putXref` demonstrates the
pattern: `const existing = db.prepare("select id from anno_xref where …").get(…); if (existing) return false;`
→ `return { revision, changed: result };` [VERIFIED: anno-store.ts:3232-3249].
**Surface `changed` in the result body and never map `changed: false` to an error.**
That is criterion 5's "a repeated edit succeeds reporting no change rather than
being rejected", already built.

### Anti-Patterns to Avoid

- **A cursor / "current address" concept.** Upstream's own text: *"**NEVER** use
  the 'current cursor address' or rely on the active cursor location in the
  editor"* [VERIFIED: the `upstream_citation` field of
  `disposition_rationale["anno_get_disassembly_cursor"]` in the manifest].
- **Rejecting no-op writes.** Breaks idempotency; agents retry on timeout.
- **Nested scopes.** `ScopeRow`'s doc comment and the schema both say unsupported;
  `add_scope` has exactly one site in the whole skill tree
  (`src/skills/c64-program-recon/SKILL.md`, measured).
- **A `tools_call`-shaped meta-tool.** `anno_batch_execute` is the one sanctioned
  exception; see Discretion 3.
- **A second validator at the MCP layer.** See Pitfall 6.
- **Returning a plausible-looking zero.** See Discretion 2.

---

## Standard Stack

**No new dependency is added by this phase.** Everything is first-party or a Node
built-in.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` | built-in at Node ≥ 22.13.0 | store persistence | `D1` in REQUIREMENTS: chosen on evidence grounds (its planted violation reliably reddens); unconditional at the `>=22.18.0` engine floor, so `ENGINEERING_RULES.md` §4's dependency bar is not triggered |
| `node:test` | built-in | the entire test suite | `"test": "node --test '*.test.*'"` [VERIFIED: src/mcp/vice/package.json:113] |
| `@mastra/mcp` | 1.15.0 | stdio MCP framing | already a dependency; `MCPServer` answers `tools/list`, `tools/call` is overridden |
| `@mastra/core` | 1.55.0 | `createTool` / `noopObserve` | transitive requirement of the above |

### Supporting (all first-party, all already on disk)

| Module | Purpose | When to Use |
|---|---|---|
| `anno-store.ts` / `anno-types.ts` / `anno-index.ts` | the store and its assertion family | every write and stored read |
| `prg-image.ts` | `parsePrg` / `flatImageOrigin` / `decodeRawData` | every read verb (D-07) |
| `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` | 6502/6510 decode incl. illegals | `anno_disassemble`, `anno_read_region`, derived xrefs, the search corpus |
| `block-class.ts` | `blockClassAt` / `BlockEntry` | the coverage census boundary (Discretion 4) |
| `repo-root.ts` | `repoRoot()` / `supervisorDir()` | workspace resolution for path confinement |
| `stock-symbols.ts` | `parseViceLabelFile` / `MAX_LABEL_FILE_BYTES` | `import-lbl`'s rebuild |
| `acme-gate.ts` | `ACME_BIN` / `acmeSkipReasonFor` / `assertAcmeRequiredIfEnvSet` | SEAM-01's extracted gate; the two live ACME tests already use it |

### Alternatives Considered

None open. `D1`/`D2`/`D3` in REQUIREMENTS closed the persistence, undo and
capability-registry questions at the milestone open; the "Out of Scope" table
records `better-sqlite3`, interval-tree libraries and a per-edit inverse journal as
rejected with reasons.

**Installation:** none. `node_modules/` for the MCP server is provisioned by the
existing `SessionStart` hook (`scripts/ensure-mcp-deps.sh`), gated behind a sha256
of the lockfile.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.**

Every module named in this research is either first-party (under `src/mcp/vice/`
or `scripts/`) or a Node built-in (`node:sqlite`, `node:test`, `node:fs`,
`node:path`, `node:url`, `node:crypto`, `node:child_process`). The two runtime
dependencies (`@mastra/mcp` 1.15.0, `@mastra/core` 1.55.0) and the two dev
dependencies (`@types/node` 24.13.3, `typescript` 7.0.2) are **already installed and
committed in `src/mcp/vice/package-lock.json`**; this phase changes none of them.

| Package | Registry | Verdict | Disposition |
|---|---|---|---|
| *(none added)* | — | — | — |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

If a plan proposes an external package, that is a scope change from this research
and the legitimacy gate must be run before it lands.

---

## Runtime State Inventory

This phase deletes an integration and renames modules, so the rename/refactor
inventory applies. **Every category answered explicitly.**

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | **None.** the external analyser integration's only persistent artefact is a `.regen2000proj` JSON file in a *user's* project, never in this repo (`git ls-files '*.regen2000proj'` → 0). The new store is a fresh `*.annostore` SQLite file with `SCHEMA_VERSION = 2` and no migration path (F-1). **No data migration is owed by this repo**; a consuming project's `.regen2000proj` is simply orphaned, which is the documented consequence of D-01's one-way call. | none (repo-side); **document the orphaning** in the CUT-06 documentation edits |
| **Live service config** | **None.** This project drives a local VICE process through a broker; there is no external service holding a `anno` string in a UI or database. The broker's state dir (`.vice-supervisor/`) holds ports and epochs, not tool names — verified by inspection of `broker-state.mts`'s subject. | none |
| **OS-registered state** | **One, and it is the user's, not the repo's:** the `the external analyser` binary itself must be on `$PATH` for the deleted verbs. After this phase nothing looks for it. No systemd unit, launchd plist, Task Scheduler entry or pm2 process in this repo names it (`git grep -l 'the external analyser' -- '*.service' '*.plist' '*.yml'` → only `.github/workflows` is a candidate and **it returns nothing**). | none; the user may uninstall the binary |
| **Secrets / env vars** | **Three env var names die with their modules**, and none is a secret: `ANNO_UPSTREAM_CLONE` (read by `anno-derivation.test.ts:73-74` to enable the optional re-hash check — **survives**, the test is re-pointed not deleted), `ANNO_READ_REGION_MAX_BYTES` (`anno-tools.ts:216`), and `ANNO_BIN` (`anno-test-gate.ts`, consumed only by dying tests). `ACME_BIN` and `VICE_REQUIRE_ACME` are **byte-identical and must stay so** — `ci.yml:45-140` binds them by name (SEAM-01). No `.env` file exists in this repo. | rename the two dying ones with their modules; **do not touch `ACME_BIN`/`VICE_REQUIRE_ACME`**; keep `ANNO_UPSTREAM_CLONE` or rename it in the same commit as its only reader |
| **Build artifacts / installed packages** | **Two.** (1) `installer/skills/` — gitignored, regenerated by `installer/scripts/sync-skills.mjs` on `prepack`; it holds 8 files mentioning the word and **is shipped**. It must be re-synced and re-verified via `check-npm-packages.mjs`, and it is the grep gate's blind spot (Discretion 1). (2) `src/mcp/vice/resources/*.mjs` — compiled from `.mts` by `build.ts`; **none of the touched modules is `.mts`**, so no artefact drift (`resources-sync.test.ts` unaffected). `node_modules/` is not committed. | re-sync `installer/skills/` and re-run `check-npm-packages.mjs` in the same commit as the skill re-pointing |

**The canonical question — after every file in the repo is updated, what runtime
systems still have the old string cached, stored, or registered?**
Answer, measured: **only `installer/skills/`**, and only because it is generated
rather than tracked. That is why the grep gate's scope predicate must union the
pack file list.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.22.0 (≥ 22.18 floor met) | — |
| `node:sqlite` | the store | ✓ | built-in, unflagged | — |
| npm | `npm pack --dry-run` in the grep gate + `check-npm-packages.mjs` | ✓ | bundled with Node 22 | — |
| git | `git ls-files` in the grep gate | ✓ | repo is a git repo | — |
| ACME cross-assembler | `disasm-roundtrip.test.ts`, `skill-acme-build-cli.test.ts` (gated by `acme-gate.ts`) | not probed this session | — | the gate **skips** unless `VICE_REQUIRE_ACME=1`, in which case it **hard-fails** (SEAM-01's whole point). Not needed by this phase's own work. |
| the external analyser (`anno` binary) | the modules being deleted | irrelevant | — | **This phase removes the requirement.** Its absence must not be treated as a blocker. |
| A running VICE / broker | nothing in this phase | — | — | **Relevant warning:** a *live* broker makes `BACK-05`'s test fail deterministically (recorded in project memory). Stop the broker before trusting any `npm test` result. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED].

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node:test`) — **no separate framework** |
| Config file | none; the automated set is derived by `src/mcp/vice/test-gate.mjs` |
| Quick run command | `cd src/mcp/vice && node --test <specific files>` |
| Full automated command | `cd src/mcp/vice && npm run test:automated` (= `node test-gate.mjs`) |
| Full glob command | `cd src/mcp/vice && npm test` (= `node --test '*.test.*'`) — **includes the 9 manual-only/live files** |
| CI scripts | `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-fork-honesty.mjs`, `node scripts/check-npm-packages.mjs`, `node scripts/audit-gate.mjs` |
| Typecheck | `cd src/mcp/vice && npm run typecheck` (`tsc --noEmit`) |

### Measured baselines, this session, this tree

| Command | Result | Wall time |
|---|---|---|
| `node --test hostpath-consumers stock-dispatch tool-support-table capability-registry module-classification anno-upstream-audit anno-verb-coverage docs-anno-decisions docs-linerefs test-gate` (the **10 files this phase touches**) | **201 tests, 200 pass, 0 fail, 1 skipped** | **1.24 s** |
| `node scripts/check-skill-tool-coverage.mjs` | `OK` — 37 `vice_*` names / 33 files / 7 dirs; **17** `anno_*` names, all curated (19 in `CURATED_ANNO_TOOLS`); **8** CLI verbs, 8/8 resolved | < 5 s |
| `node scripts/check-skill-fork-honesty.mjs` | `OK` — 11 fork-only mentions / 33 files / 7 dirs; 24 names policed from `CAPABILITY_REGISTRY` | < 5 s |
| `node scripts/check-npm-packages.mjs` | `OK` — closure 60 modules; `@henols/vice-mcp` 80 files; `@henols/c64-re-tools` 34 files, 7 skills | ~15 s |
| `npm pack --dry-run --json` in `src/mcp/vice` | success | **1.30 s** |
| `npm test` (full glob) | **not run** — recorded as ~660 s with a `vice-proxy` hang and a ~44-failure baseline on a host with no emulator | ~660 s |

**The practical consequence, which the planner should build the verification story
around:** the guards that matter for `MCP-02`/`MCP-03`/`MCP-05` run in **1.24
seconds**. There is no reason to defer them to a phase gate. Per-task is affordable.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | manifest-derived surface: every `curated`/`adapt` verb routed, every `omit` absent, `delete_project_enum` absent, checked mechanically | unit | `node --test anno-derivation.test.ts` | ❌ Wave 0 (re-point `anno-derivation.test.ts`, which exists) |
| MCP-01 | verbs the manifest does not classify appear in the committed register with a requirement id | unit | `node --test anno-register.test.ts` | ❌ Wave 0 (model on `module-classification.test.ts`) |
| MCP-02 | the runner's body contains none of `forwardToVice`/`ensureViceSession`/`rewriteArguments` | structural | `node --test stock-dispatch.test.ts` | ✅ re-point `:1549-1562` |
| MCP-02 | no new module imports `hostpath.ts` (consumer set stays exactly 5) | structural | `node --test hostpath-consumers.test.ts` | ✅ `:141-145` |
| MCP-03 | `BACKEND_SEAM_BYPASS_KEYS` ordered `deepEqual` | structural | `node --test stock-dispatch.test.ts` | ✅ re-point `:1505,1519-1531` |
| MCP-03 | no `anno_*` name in either manifest | structural | `node --test stock-dispatch.test.ts` | ✅ re-point `:1564-1575` |
| MCP-03 | `docs/tool-support.md` byte-identical | structural | `node --test tool-support-table.test.mjs` | ✅ **proven byte-identical this session** |
| MCP-04 | idempotent write: same edit twice → second returns `changed: false`, `isError: false` | unit | `node --test anno-tools.test.ts` | ❌ Wave 0 |
| MCP-04 | batch pre-validates recursively and refuses WHOLE on an uncurated inner name at any depth | unit | `node --test anno-tools.test.ts` | ❌ Wave 0 (port `anno-tools.test.ts`'s batch cases) |
| MCP-04 | batch execution returns per-item status and does not abort on the first failure | unit | `node --test anno-tools.test.ts` | ❌ Wave 0 |
| MCP-04 | an ambiguous/unsupported request returns `{available:false, reason}` with `reason.length >= 40`, never `[]` and never `0` | unit | `node --test anno-tools.test.ts` | ❌ Wave 0 |
| MCP-05 | the three `ANNO_TOOL_DEFINITIONS` witnesses all moved; the generator throws (not silently differs) if one did not | structural | `node --test tool-support-table.test.mjs capability-registry.test.ts` | ✅ re-point |
| MCP-05 | `ANNO_MODULE_FLOOR` re-expressed with a real positive control | structural | `node --test hostpath-consumers.test.ts` | ✅ re-point `:188,199` |
| STORE-06 | `anno_get_cross_references(to)` returns every deriving address, union'd with stored non-derivable rows | unit | `node --test anno-derive.test.ts` | ❌ Wave 0 |
| STORE-06 | search finds a term in a label, in a comment, and in an instruction; each corpus independently disableable | unit | `node --test anno-derive.test.ts` | ❌ Wave 0 |
| STORE-06 | `max_results` is required and the returned count makes truncation detectable | unit | `node --test anno-derive.test.ts` | ❌ Wave 0 |
| STORE-06 | **nothing is cached:** after any derived query, `anno_xref` row count is unchanged and the store file mtime/bytes are unchanged | structural | `node --test anno-derive.test.ts` | ❌ Wave 0 |
| *(D-01 / CUT-02)* | the grep gate bites on 4 plants and is green over the untouched exemption set | structural + planted | `node scripts/check-no-analyser.mjs` | ❌ Wave 0 |
| *(D-02 / FLOW-01)* | the renamed CLI's verbs are parsed from its own switch, floor 5, and every one is named by a skill file | structural | `node --test anno-verb-coverage.test.ts` | ❌ Wave 0 (port `anno-verb-coverage.test.ts` — it is already a planted-violation test) |

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && node --test hostpath-consumers.test.ts stock-dispatch.test.ts tool-support-table.test.mjs capability-registry.test.ts module-classification.test.ts docs-linerefs.test.ts` — measured **~1.2 s**
- **Per wave merge:** `npm run test:automated` **plus** all four `scripts/check-*.mjs` **plus** `npm run typecheck`
- **Phase gate:** full `npm test` (whole glob, **broker stopped** — the command named in the evidence), all four CI scripts, `docs/tool-support.md` byte-identical, all `docs-*.test.ts` green

**A note the planner needs on baselines:** the full-glob suite runs ~660 s and has a
non-zero failure baseline on a host with no emulator, and a *live* broker makes
`BACK-05`'s test fail deterministically. **Record the baseline count before the
phase starts and compare against it**, rather than expecting zero. Do not use the
full glob as a per-task loop.

### Wave 0 Gaps

- [ ] `src/mcp/vice/anno-tools.test.ts` — MCP-04 (idempotency, batch, refusal shape)
- [ ] `src/mcp/vice/anno-derivation.test.ts` — MCP-01 (the manifest check; re-points `anno-derivation.test.ts`)
- [ ] `src/mcp/vice/anno-register.test.ts` — MCP-01 (the second register; models `module-classification.test.ts`)
- [ ] `src/mcp/vice/anno-derive.test.ts` — STORE-06 (xrefs, search, **the never-cached control**)
- [ ] `src/mcp/vice/anno-verb-coverage.test.ts` — FLOW-01 over the renamed CLI (ports `anno-verb-coverage.test.ts`)
- [ ] `scripts/lib/anno-cli-verbs.mjs` — replaces the deleted `anno-cli-verbs.mjs`; carry `stripComments()` verbatim
- [ ] `scripts/check-no-analyser.mjs` — the grep gate + its exemption non-vacuity counter
- [ ] No framework install needed.

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level: 1` [VERIFIED:
.planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | stdio MCP server; the client is the local Claude process |
| V3 Session Management | no | D-06 removes all cross-call state by design |
| V4 Access Control | **yes** | Workspace confinement. `storePathWithinWorkspace()` (`anno-types.ts:1140`) is the one seam; the image path needs the same treatment (D-07). |
| V5 Input Validation | **yes — the dominant category** | Every argument is LLM-supplied and the transport validates nothing (`vice-proxy.ts:3230`). The `anno-types.ts` assertion family is the control; see Pitfall 6's table. |
| V6 Cryptography | no | none used; `createHash` in `anno-regbits-gen.ts` is a content fingerprint, not a security control |
| V12 File & Resources | **yes** | Path traversal via the store/image arguments; resource exhaustion via an uncapped `anno_disassemble`/`anno_search`. |
| V13 API & Web Service | **yes** | Nested-argument smuggling through `anno_batch_execute` — the one sanctioned exception to `DENY_LIST`'s rule. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via the `store` / `image` argument | Tampering / Information Disclosure | `storePathWithinWorkspace()`. **Carry WR-01's finding forward:** containment must be enforced against the deepest *existing* ancestor's realpath, with every remaining segment `lstat`-guarded against being an unresolved symlink — a not-yet-existing leaf under a directory symlink bypassed containment entirely in the anno implementation [VERIFIED: anno-tools.ts:874-887 header] |
| Nested-name smuggling through the batch verb | Elevation of Privilege | Recursive pre-validation, whole-batch refusal, **plus a depth cap** (new — see Discretion 3) |
| Label-name injection into generated ACME source | Tampering | `assertLegalLabel()` (`anno-types.ts:1217`) — **REJECT, never sanitize or quote**; the store's printed name must never diverge from the exported symbol (T-11-NAME-INJECT's recorded posture) |
| SQL injection into the store | Tampering | Every statement in `anno-store.ts` is `db.prepare(...)` with bound parameters; `STORE-07` confines `node:sqlite` to one module. A structural test asserting no string-concatenated SQL is cheap and worth adding. |
| Context exhaustion / resource exhaustion via an unbounded read | Denial of Service | `max_results` required with no default; a range cap on `anno_read_region` (`ANNO_READ_REGION_MAX_BYTES = 4096`'s pattern); note the family is **not** chunked (Pitfall 5) |
| A refusal that reads as an empty success | *(not STRIDE — a correctness/trust failure)* | `{available:false, reason}`, never `[]` and never `0`. This is `MCP-04`. |
| Argument-error masquerading as data corruption | *(correctness)* | WR-22: validate `revision` at the entry so SQLite's column affinity cannot turn `"0001"` into CR-08's corrupt-snapshot refusal |

**One security note that is *not* a finding:** 28-REVIEW explicitly cleared the
`revertTo` string-argument issue as *"a diagnostic and correctness defect, not a
security one"* — path traversal is unreachable there because a non-numeric string
fails the affinity conversion and the pointer-row gate refuses first
[VERIFIED: 28-REVIEW.md:686-688]. Do not re-file it as a vulnerability.

---

## Code Examples

### The manifest derivation check (MCP-01, D-08)

```ts
// Source pattern: src/mcp/vice/anno-derivation.test.ts:96-155 (the
// existing manifest-vs-surface agreement test this replaces), plus the
// disposition vocabulary read from the manifest itself.
const MANIFEST_PATH = join(HERE, "../../../.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

/** The ONE mapping from an upstream verb name to this surface's name.
 *  Total over the manifest's 20; two documented departures. */
function annoNameFor(upstream: string): string | null {
  if (upstream === "anno_get_disassembly_cursor") return "anno_disassemble";   // D-09
  if (upstream === "anno_search_disassembly")     return "anno_search";
  return "anno_" + upstream.slice("anno_".length);
}

test("MCP-01: every curated/adapt verb has a route and every omit verb is absent", () => {
  const names = new Set(ANNO_TOOL_DEFINITIONS.map((d) => d.name));
  let curatedSeen = 0, omitSeen = 0;
  for (const procedure of manifest.procedures) {
    for (const [upstream, disposition] of Object.entries(procedure.tools)) {
      const anno = annoNameFor(upstream);
      if (disposition === "curated" || disposition === "adapt-to-address-input") {
        assert.ok(names.has(anno), `${upstream} is "${disposition}" but ${anno} has no route`);
        curatedSeen++;
      } else if (disposition === "omit") {
        assert.ok(!names.has(anno), `${upstream} is "omit" but ${anno} is on the surface`);
        omitSeen++;
      } else {
        assert.fail(`${upstream}: unknown disposition "${disposition}"`);
      }
    }
  }
  // Non-vacuity: an empty or broken manifest read must fail here, not pass
  // every assertion above trivially. Measured 2026-08-29: 16 curated-or-adapt
  // and 4 omit, across 5 procedures (some verbs appear in several).
  assert.ok(curatedSeen >= 16 && omitSeen >= 4, `manifest read produced ${curatedSeen}/${omitSeen}`);
  assert.ok(!names.has("anno_delete_project_enum"), "the one verb with zero callers anywhere must not be carried");
});

test("MCP-01: every surface name is either manifest-classified or in the committed register", () => {
  const classified = new Set(manifest.procedures.flatMap((p) => Object.keys(p.tools)).map(annoNameFor));
  for (const def of ANNO_TOOL_DEFINITIONS) {
    if (classified.has(def.name)) continue;
    const entry = ANNO_VERB_REGISTER.find((e) => e.name === def.name);
    assert.ok(entry, `${def.name} is on the surface but classified by NEITHER the manifest NOR the register -- a verb with no named consumer FAILS rather than being reviewed`);
    assert.ok(entry.requirements.length > 0, `${def.name}'s register entry cites no requirement id`);
  }
});
```

### The recursive batch pre-validator (MCP-04, carrying D-33)

```ts
// Source: src/mcp/vice/anno-tools.ts:801-835 (assertCuratedBatch), read
// before deletion. Adds a depth cap the original did not have.
const MAX_BATCH_DEPTH = 4;

function assertAnnoBatch(args: unknown, depth = 0): void {
  if (depth > MAX_BATCH_DEPTH) {
    throw new AnnoUncuratedToolError(
      `anno_batch_execute refused: nesting deeper than ${MAX_BATCH_DEPTH} levels -- refused by name rather than walked.`,
      { toolName: "anno_batch_execute" },
    );
  }
  if (!isPlainObject(args) || !Array.isArray(args.calls)) {
    throw new AnnoUncuratedToolError(
      'anno_batch_execute refused: "calls" must be an array of {name, arguments} objects -- a ' +
        "malformed batch payload is treated as a refusal, never as an empty batch that passes through.",
      { toolName: "anno_batch_execute" },
    );
  }
  (args.calls as unknown[]).forEach((call, i) => {
    if (!isPlainObject(call) || typeof call.name !== "string") {
      throw new AnnoUncuratedToolError(
        `anno_batch_execute refused WHOLE: calls[${i}] is malformed (missing a string "name") -- ` +
          "treated as a refusal, never as an empty batch that passes through.",
        { toolName: "anno_batch_execute", batchIndex: i },
      );
    }
    if (!CURATED_ANNO_TOOLS.includes(call.name)) {
      throw new AnnoUncuratedToolError(
        `anno_batch_execute refused WHOLE: calls[${i}].name "${call.name}" is outside the curated ` +
          "anno_* tool surface -- a batch is refused whole if any inner name is outside the curated set (D-33).",
        { toolName: call.name, batchIndex: i },
      );
    }
    // The SAME per-verb validators the outer dispatch uses, so a refusal fires
    // identically whether the verb is called directly or smuggled in a batch.
    assertVerbArgs(call.name, call.arguments, i);
    if (call.name === "anno_batch_execute") assertAnnoBatch(call.arguments, depth + 1);
  });
}
```

### The refuse-by-name result body (MCP-04)

```ts
// Source: the shape at src/mcp/vice/stock-recycle.ts:86 and the reason-string
// register at src/mcp/vice/stock-cia.ts:116-124.
type Availability<T> = { available: true; value: T } | { available: false; reason: string };

const UNAVAILABLE_REASONS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  [
    "anno_apply_enum_usage",
    "an enum-to-address association is not part of this store's schema -- the anno_enum table holds a " +
      "name, its variants and a description, and nothing associates an enum with an address. Define the " +
      "enum with anno_create_project_enum and record the association as a comment at the address until " +
      "the schema carries it.",
  ],
]);
// reason.length >= 40 is enforced by check-skill-tool-coverage.mjs:285's own
// convention -- a bare token is not a reason.

function refuse(name: string): ToolCallResult {
  const reason = new Map(UNAVAILABLE_REASONS).get(name);
  // isError stays FALSE: the request was well-formed, the answer is "no".
  // Returning isError:true here teaches an agent to retry; returning [] or 0
  // is the plausible-looking zero MCP-04 forbids.
  return okText(JSON.stringify({ available: false, reason }));
}
```

### The derived cross-reference query (STORE-06) — never cached

```ts
// Sources: disasm-decoder.ts:61-82 (Instruction/DecodedOperand),
// anno-store.ts:2341 (listRanges), :3254 (listXrefs),
// anno-types.ts:1392 (resolveSplitTargets), :1362 (producesXrefsFor).
export function crossReferencesTo(handle: AnnoStoreHandle, image: Uint8Array, origin: number, to: number) {
  const callers = new Set<number>();

  // 1. Derived from the bytes: every code range, decoded fresh.
  for (const range of listRanges(handle)) {
    if (range.dataType !== "code") continue;
    const slice = image.subarray(range.start - origin, range.endInclusive - origin + 1);
    for (const insn of decode(slice, range.start)) {
      if (!insn.operand) continue;
      if (insn.operand.role === "immediate" || insn.operand.role === "indirect") continue;
      const target = insn.resolvedTarget ?? insn.operand.value;
      if (target === to) callers.add(insn.address);
    }
  }

  // 2. Derived from typed split tables (also bytes, also never stored).
  for (const range of listRanges(handle)) {
    if (!isSplitDataType(range.dataType) || !producesXrefsFor(range.dataType)) continue;
    const bytes = image.subarray(range.start - origin, range.endInclusive - origin + 1);
    const { targets } = resolveSplitTargets(bytes, range.dataType);
    targets.forEach((t, i) => { if (t === to) callers.add(range.start + i); });
  }

  // 3. The ONLY stored half: references that cannot be recovered from bytes.
  for (const row of listXrefs(handle)) if (row.toAddress === to) callers.add(row.fromAddress);

  // NOTHING IS WRITTEN. A cached index here would be a second on-disk truth
  // that can disagree with the range table it came from -- putXref's own
  // contract (anno-store.ts:3208-3213) and COV-01's derived-from-bytes census
  // both forbid it, independently.
  return { to, callers: [...callers].sort((a, b) => a - b), count: callers.size };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A long-lived the external analyser session (Rule A21, Phase 18) | Open/close per call (D-06) | this phase | Rule A21's premise — avoiding a child-process respawn — is deleted with the child process. `ARCHITECTURE.md`'s Rule A21 must be edited (ROADMAP Phase 32 c5 names it). |
| Store state rented from a `.regen2000proj` JSON file | `node:sqlite` `*.annostore` with a 32-revision snapshot ring | Phase 28 | `D1`: chosen because its planted violation reliably reddens |
| A per-edit inverse-command undo journal | Whole-store snapshot/restore | Phase 28 (`D2`) | Node's `sqlite` does not expose `sqlite3changeset_invert`; `anno_undo` was already disposed `omit` |
| An entry in `capability-registry.ts` for the family | The ordered `BACKEND_SEAM_BYPASS_KEYS` allow-list | v0.7.0 open (`D3`) | v0.6.0's `STORE-03` required an entry; that clause *"was factually wrong and is replaced"* |
| A hand-typed module array | `readdirSync` + a stable prefix regex + a floor that only rises | Phase 11.1 (`INT-01`) | The hand-typed array missed four modules; this is now the project-wide pattern |

**Deprecated / outdated in this repo:**
- `capability-registry.test.ts:154-156`'s comment says `ANNO_TOOL_DEFINITIONS` is *"an array of 17"*. It is **19**. Fix while re-pointing.
- `CUT-02`/ROADMAP's `291` / `55` blast-radius figures. Now **339** / **61**.
- `REPOINT-01`/ROADMAP P31's `18 distinct tool names`. Now **17**.
- `29-CONTEXT.md`'s `9 skill files naming 18 anno_* tools`. Measured: **5 files, 17 names** (10 files mention `anno` at all).

---

## Assumptions Log

Everything material in this document was measured. These are the residual
`[ASSUMED]` claims — none is load-bearing for an implementation choice, and each
is flagged so a plan does not treat it as fact.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The full-glob `npm test` takes ~660 s with a ~44-failure baseline on a host with no emulator, and a live broker deterministically reds `BACK-05`. | Validation Architecture | Sourced from project memory, **not re-measured this session** (the run exceeds the tool timeout). If wrong, the phase-gate verification story's *timing* is wrong; the per-task story (measured at 1.24 s) is unaffected. Re-measure once at plan time. |
| A2 | No consuming project holds a `.regen2000proj` whose orphaning matters, so no data migration is owed. | Runtime State Inventory | Verified for **this repo** (`git ls-files '*.regen2000proj'` → 0). A *user's* project is outside this repo's reach by construction; if any exists, D-01 already accepted that cost as one-way. |
| A3 | `block-class.ts`'s `blockClassAt()` vocabulary and `anno-types.ts`'s `DATA_TYPES` twelve agree well enough for the coverage census re-point. | Discretion 4 | **Flagged, not verified** — `block-class.ts`'s classifier was written against upstream's Rust `Display` strings. If they disagree, `SEAM-03`'s census-versus-store boundary test fails and the mapping needs an explicit translation table. **The planner should verify this before sizing the `coverage` re-point.** |
| A4 | The `anno-` module set will land at 15–17 modules under naming Policy A / 7–9 under Policy B. | C-3 | An estimate over the *new* surface modules (3–5). If the surface is one module rather than three, Policy A also fails to clear 15 and C-3's literal reading becomes unsatisfiable under either policy. |
| A5 | `check-npm-packages.mjs`'s `packFiles()` can be imported and reused by the grep gate without re-running the whole check. | Discretion 1 | The function is module-local (`function packFiles(dir)` at `:140`, not exported). It may need an `export` added, or the gate may need its own `execFileSync("npm", ["pack","--dry-run","--json"])`. Cost is one line either way. |
| A6 | ACME 0.97 is installed on the dev host. | Environment Availability | Not probed. Irrelevant to this phase's own work — the ACME-gated tests **skip** unless `VICE_REQUIRE_ACME=1`. Matters for Phase 30. |

---

## Open Questions (RESOLVED)

**All six questions below were resolved before Phase 29's plans were written
(2026-08-29). This section is kept as the record of what was open and how each was
closed — it is not live advice, and question 3's recommendation in particular was
superseded and must not be followed.** Each question carries a `RESOLVED:` line
naming the decision or plan that closed it.

1. **`anno_apply_enum_usage` and the `SCHEMA_VERSION` bump (F-1).**
   - *What we know:* the store has no enum-usage table; `openStore` hard-refuses a
     mismatched `schema_version` with no migration arm; `gen-enums` depends on it.
   - *What's unclear:* whether any `*.annostore` exists outside this repo that a
     bump would strand.
   - *Recommendation:* a `checkpoint:human-verify` task at the top of the plan.
     Recommend option (a) — add the table and bump to 3 — but let the owner
     confirm the one-way call, exactly as D-07 anticipated.
   - **RESOLVED: D-15** (`29-CONTEXT.md`, user decision 2026-08-29). The
     recommendation was taken: the table is added and `SCHEMA_VERSION` bumps 2 → 3
     with **no migration arm**, accepting that every existing v2 `.annostore`
     becomes permanently unopenable. Implemented by plan **29-03**, whose
     `checkpoint:decision` gate carries the one-way call and whose prohibition
     keeps the mismatch a single-witness refusal.

2. **The scope of D-02's cut, given CD-1.**
   - *What we know:* four of five kept verbs need rebuilds; `export-lbl`/`import-lbl`
     carry ✓ Validated requirements whose proof does not transfer.
   - *What's unclear:* whether the owner intended a phase this large.
   - *Recommendation:* present the measured sizing and offer the narrowing (keep
     only `render-memmap` + `coverage` now; `gen-enums`/`export-lbl`/`import-lbl`
     ride into Phase 30 with the ACME oracle). **Do not silently absorb four
     rebuilds into a phase scoped as "register a tool family".**
   - **RESOLVED: D-14** (`29-CONTEXT.md`, user decision 2026-08-29). The sizing was
     presented and the owner chose the narrowing exactly as recommended:
     `render-memmap` and `coverage` survive into Phase 29; `gen-enums`,
     `export-lbl` and `import-lbl` follow the export route into Phase 30. Carried
     out by plan **29-07**, which also records the temporary withdrawal of
     `ANNO-14` / `ANNO-15`'s symbol round trip.

3. **C-3's reading of "raised not lowered".**
   - *Recommendation:* adopt the charitable reading (floor = measured count, then
     raise-only) and **state the reading in the plan**. Let the naming policy be
     chosen on legibility (Policy B: `d64.ts`, not `anno-d64.ts`), following
     SEAM-01's own `acme-gate.ts` precedent.
   - **RESOLVED — SUPERSEDED. The Policy B half of this recommendation was NOT
     adopted and must not be followed.** Plan **29-05** adopts **Policy A**: every
     renamed survivor takes the `anno-` prefix, and D-13's "raised not lowered" is
     read **literally** rather than charitably. The grounds are recorded in full in
     29-05's "Decisions and readings adopted by this plan" and are three, two of
     them locked decisions: (1) **D-05** locks `anno-` as the module prefix and
     names the disk-derived `readdirSync`-plus-stable-prefix-regex as its reason;
     (2) **D-13** locks the floor as re-expressed *over the `anno-` prefix*, and
     under bare names the renamed modules would not be counted by it at all, which
     is a lowering by construction; (3) `module-classification.test.ts`'s
     `inEnumerationOnDisk()` is itself a prefix enumeration this ledger did not
     list, so bare names would leave the registry with no disk-derivable predicate
     at all. Under Policy A the measured count reaches 15 at 29-05's close, so the
     literal reading is satisfiable and no charitable reading is needed.

4. **`anno_save_project` (C-2).**
   - *Recommendation:* route it as an honest revision report. Record the choice in
     the D-08 register.
   - **RESOLVED: adopted as recommended.** Plan **29-06** routes it as an honest
     revision report that performs no write and says so in its own result body;
     plan **29-08** records the deviation in the D-08 register, because "a route
     that reports rather than writes" is exactly what a later reader would mistake
     for an oversight.

5. **The renamed CLI's name (C-4).**
   - *Recommendation:* `anno-cli.ts` / `anno <verb>`, downstream of D-05.
   - **RESOLVED: adopted as recommended.** Plan **29-05** renames the module to
     `anno-cli.ts`; the invocation literal and the proxy's subcommand token move
     later, in plan **29-09**, in the same commit as the skill files that spell
     them — changing either half alone reds the FLOW-01 guard from the wrong side.

6. **Whether `docs-absorbed-decisions.test.ts` is renamed or deleted (D-12).**
   - *What we know:* D-12 says it and `audit-gate.mjs:136` move together; ROADMAP
     Phase 32 says *"Keep the **D-36** decision row as dated history rather than
     deleting it, and give its guard an explicit superseded-by fate."* Its content
     pins `GUARD_FILENAMES = ["anno-session.test.ts", "spawn-seam.test.ts"]`,
     the first of which is deleted.
   - *Recommendation:* **rename and re-point**, not delete — it keeps
     `DOCS_GUARD_FLOOR = 7` and `audit-integrity.test.ts`'s registry-vs-disk
     cross-check green with no floor change, which is the cheaper and safer move.
   - **RESOLVED: D-12, rename-and-re-point as recommended.** Plan **29-05** Task 3
     renames it to `docs-absorbed-decisions.test.ts` and changes
     `scripts/audit-gate.mjs`'s `EXPECTED_DOCS_GUARD_NAMES` entry **in the same
     commit**, re-points its `GUARD_FILENAMES` to two guards that still exist after
     plan 29-10, and keeps `DOCS_GUARD_FLOOR = 7`.

---

## Sources

### Primary (HIGH confidence) — read this session with `Read`/`sed`/`grep`

- `src/mcp/vice/vice-proxy.ts` — `:194`, `:436-448`, `:1461,1484`, `:2101-2125`, `:3224-3237`, `:3263-3276`, `:3386-3405`, `:3420-3490`
- `src/mcp/vice/anno-tools.ts` — `:53-95`, `:133-148`, `:196-232`, `:233-620` (all 19 `name:` literals), `:628-641`, `:692-760`, `:763-835`, `:837-871`, `:1141-1213`
- `src/mcp/vice/anno-store.ts` — `:193`, `:235-305`, `:413`, `:521-523`, `:550-555`, `:2291-2340`, `:2341`, `:2439`, `:2768`, `:2801-3010`, `:3084-3190`, `:3191-3270`
- `src/mcp/vice/anno-types.ts` — `:150-197`, `:225-296`, `:322-460`, `:474-800`, `:810-880`, `:1140`, `:1174-1400`, `:1476`
- `src/mcp/vice/anno-index.ts` — `:59-142`
- `src/mcp/vice/disasm-decoder.ts` — `:51-88`, `:148`; `disasm-renderer.ts` — `:66-100`, `:268-280`
- `src/mcp/vice/module-classification.ts` — `:1-120` (header), `:244-708` (all 19 entries, incl. the two CONTESTED notes at `:475-490` and `:516-524`)
- `src/mcp/vice/hostpath-consumers.test.ts` — `:115-235`
- `src/mcp/vice/stock-dispatch.test.ts` — `:1486-1600`
- `src/mcp/vice/tool-support-table.test.mjs` — `:55-90`; `capability-registry.test.ts` — `:145-180`
- `src/mcp/vice/stock-recycle.ts` — `:75-140`; `stock-cia.ts` — `:85-124`, `:195-215`, `:480-510`
- `src/mcp/vice/anno-derivation.test.ts` — `:1-165`; `anno-verb-coverage.test.ts` — `:140-185`
- `src/mcp/vice/docs-linerefs.test.ts` — `:1-99`; `docs-absorbed-decisions.test.ts` — `:1-60`
- `src/mcp/vice/anno-cli.ts` — `:51-84` (imports), `:1340-1400` (the `coverage` verb), `:1478-1493` (the dispatch switch)
- `src/mcp/vice/anno-symbols.ts` — `:68-76`, `:116-135`, `:209-305`, `:330-380`
- `src/mcp/vice/anno-enum-gen.ts` — `:80-86`, `:296-450`, `:509`
- `src/mcp/vice/anno-coverage.ts` — `:141-145`, `:195-232`
- `src/mcp/vice/anno-verify.ts` — `:46`; `anno-test-gate.ts` — `:34`; `anno-memmap-render.ts` (no imports)
- `src/mcp/vice/block-class.ts` — `:113-128`; `prg-image.ts` — `:69-100`
- `src/mcp/vice/shipped-modules.ts` — `:1-160`; `spawn-seam.test.ts` — `:245-260`
- `src/mcp/vice/test-gate.mjs` — `:95-113`; `test-gate.test.ts` — `:12-55`
- `src/mcp/vice/package.json` — `:1-128` (bin, files[], scripts, deps)
- `scripts/generate-tool-support-table.mjs` — `:1-260`
- `scripts/check-skill-tool-coverage.mjs` — `:35-110`, `:280-310`, `:370-520`
- `scripts/check-skill-fork-honesty.mjs` — `:1-80`, `:400-515`
- `scripts/check-npm-packages.mjs` — `:1-145`
- `scripts/audit-gate.mjs` — `:84-150`, `:360-390`, `:850-870`
- `scripts/lib/anno-cli-verbs.mjs` — whole file; `scripts/lib/skill-corpus.mjs` — `:39-70`
- `.planning/phases/19-.../upstream-procedure-manifest.json` — enumerated programmatically
- `.planning/phases/28-the-store-core/28-VERIFICATION.md` — `:77`, `:160-250`, `:488-505`
- `.planning/phases/28-the-store-core/28-REVIEW.md` — `:44-250`, `:655-700`, `:1780-1815`
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `./CLAUDE.md`, `.planning/config.json`

### Executed proofs (HIGH confidence) — commands run this session

- `generateToolSupportTable` before/after the loop substitution → **byte-identical, 7,874 bytes, equal to the committed file**
- `discoverSyntheticToolNames` against an un-re-pointed regex → **throws by name**, does not silently differ
- `node --test` over the 10 touched guard files → **201 tests, 200 pass, 0 fail, 1 skip, 1.24 s**
- `node scripts/check-skill-tool-coverage.mjs` / `check-skill-fork-honesty.mjs` / `check-npm-packages.mjs` → all `OK`
- `git grep -il the external analyser` with and without `':!.planning/**'` → 339 / 61
- `git ls-files installer/skills | wc -l` → 0; `grep -ril the external analyser installer/skills | wc -l` → 8
- `time npm pack --dry-run --json` in `src/mcp/vice` → 1.30 s
- manifest verb enumeration via `node -e` over `procedures[].tools` → 15 curated / 1 adapt / 4 omit
- `grep -c 'name: "anno_' anno-tools.ts` → 19
- `grep -rhoE '\banno_[a-z0-9_]+' src/skills/ | sort -u | wc -l` → 17

### Secondary (MEDIUM confidence)

- Project memory: the ~660 s full-glob runtime, the ~44-failure baseline, and the
  live-broker `BACK-05` interaction. Recorded from prior sessions, **not
  re-measured here** (A1).

### Tertiary (LOW confidence)

- None. No web search was performed and none was needed: this phase adds no
  external dependency and every question was answerable against the tree.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Guard ledger (values, locations, drift) | **HIGH** | Every line read this session; drift corrected against the source, not against a document |
| `docs/tool-support.md` byte-identity | **HIGH** | Executed proof, both directions (identical when re-pointed; throws when not) |
| The verb list and its manifest derivation | **HIGH** | Enumerated programmatically from the JSON and from the source's `name:` literals |
| The `{available:false, reason}` convention | **HIGH** | Four independent in-repo sites quoted verbatim, plus the ≥40-char reason-length rule already enforced in CI |
| The batch pre-validation discipline | **HIGH** | Read from `anno-tools.ts` before deletion, including the measured upstream partial-failure semantics that reconcile criterion 5 with D-33 |
| CD-1 (D-02's transitive falsification) | **HIGH** | Five verbatim import lines plus eight use sites |
| CD-2 (the two contested rename entries) | **HIGH** | The registry's own `note` fields, quoted; corroborated by import measurement |
| The grep gate's scope predicate | **MEDIUM** | The blast radius and the `installer/skills/` hole are measured; the *choice* of predicate is a recommendation, and A5 flags one unverified reuse detail |
| Coverage census re-point | **MEDIUM** | The four shapes and three of four mappings are verified; the `BlockEntry.type` ↔ `DATA_TYPES` agreement is **A3, flagged unverified** |
| C-3's module-count arithmetic | **MEDIUM** | Depends on how many modules the new surface is split into (A4) |
| Full-suite timing baseline | **LOW** | A1 — carried from project memory, not re-measured |

**Research date:** 2026-08-29
**Valid until:** ~2026-09-12 (14 days). Shorter than the usual 30: every line
number in the Guard Ledger is against a tree this phase is about to rewrite, and
`CLAUDE.md` itself records that these citations drift between phases. **Re-verify
the Guard Ledger's line numbers at the start of each wave**, exactly as CLAUDE.md
instructs — treat a mismatch as drift to re-verify, not as evidence the constraint
changed.
