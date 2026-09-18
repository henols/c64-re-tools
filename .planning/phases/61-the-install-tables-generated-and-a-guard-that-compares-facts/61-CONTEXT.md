# Phase 61: The Install Tables Generated, and a Guard That Compares Facts - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

`README.md`'s install remedies stop being maintained by hand. A generator emits
them from `src/mcp/vice/prerequisites.json`, and a build-failing guard catches
divergence between the two by parsing both sides into records and comparing
those — never bytes.

**What this phase writes:** a generator module and its colocated guard under
`src/mcp/vice/`, the generated region inside `README.md`, a hand rewrite of the
three prose neighbours the dropped version columns leave false, and the
re-anchored citation ledger in `docs/phase58-declaration-provenance.md`.

**Explicitly NOT in this phase:** any change to `src/mcp/vice/prerequisites.json`.
The declaration is frozen at the shape Phase 58 gave it — see D-02, an owner
decision. No `ecosystems` map, no `label` field, no new fields, and no rewrite
of the 27 existing `source` values. A planner that finds itself needing to add
to the declaration has hit D-02 and must solve the problem on the generator side
or record it as a gap.

**Also not in this phase:** the doctor. It was dropped at owner decision on
2026-09-18 and `DOCTOR-01`..`09` sit in REQUIREMENTS.md § Future Requirements.
Nothing here may reintroduce a doctor, a `--check`, or any pre-flight
verification surface — the owner's standing principle is that a tool which needs
something absent says so **at the point of use**, which `DECL-03` already
delivers through `withRemedy()` in `host-tool.mts`.

</domain>

<decisions>
## Implementation Decisions

### What gets generated

- **D-01: The generator emits two regions — the VICE ecosystem table, and one
  overview covering all eight records.** `README.md` today carries exactly one
  install table (the VICE one, `README.md:99-108`); the other seven declared
  prerequisites have no README presence at all. The declaration's eight records
  carry three different remedy shapes: `x64sc`/`c1541`/`petcat` hold the
  *identical* 7-linux + darwin + win32 tree (they ship in one VICE package),
  `acme` holds 2 linux plus a `universal`, and `acme-lib`/`ghidra`/`dxa`/`node`
  hold one `universal` line each. Emitting a table per ecosystem-bearing record
  would put three byte-identical copies of the same eight rows in the README;
  emitting only the VICE table would leave seven of eight prerequisites invisible
  in a milestone whose subject is the user's first hour. So: the VICE remedy tree
  is rendered once as the ecosystem table, and every record appears once in the
  overview. — **Reversibility:** costly — the overview is a second generated
  region with its own markers, its own parse rule and its own guard coverage;
  dropping it later means unwinding all three.

- **D-11: The overview's columns are Claude's to choose.** The user declared
  ready for context with this open. Intent on record, so the planner can
  disagree in writing rather than silently: one row per record, carrying the id,
  what it unblocks, its one-line remedy, and whether an environment variable
  overrides its location. `node` belongs in it — it is a declared record with a
  real absence mode and a real remedy — but it is not an "install this first"
  row in the same sense as `x64sc`, and the overview should not imply it is.

### The declaration is frozen (owner decision)

- **D-02: This phase adds nothing to `src/mcp/vice/prerequisites.json`.** No
  top-level `ecosystems` map, no per-remedy `label`, no new field of any kind.
  Direct user decision, taken after the alternative (a labels map, the option
  Claude recommended) was put and declined. Not up for re-litigation by the
  researcher or the planner.

- **D-03: The ecosystem column therefore comes from the id.** `debian-trixie`,
  not `Debian 13 "trixie"`. None of the eight current README labels is derivable
  from its id — `fedora-rpmfusion` is rendered today as `Fedora (via RPM Fusion
  Non-Free — not Fedora's own base repos)` — so the generated table reads
  differently from the hand-written one in that column, and that is accepted.
  D-02 forecloses putting the label in the declaration, and a generator-side
  id→label map was rejected in the same breath: it reintroduces exactly the
  second place that can disagree with the first, which is what this milestone
  exists to remove. The phase's cross-cutting constraint binds what a user is
  told to **type**; a row label is not a command.

- **D-04: Rows dedupe by `(ecosystem, text)`, with a generated `Platforms`
  column.** `homebrew` appears under both `linux` and `darwin` with identical
  text — `docs/phase58-declaration-provenance.md` § "Case five: one ecosystem
  under two platforms" (lines 198-211) calls this a deliberate duplication, and
  today's README collapses it into the single row `Homebrew (macOS + Linux)`.
  The generated table keeps eight rows and carries the platform coverage as
  data (`linux, macOS`) rather than as prose inside a label. With no authored
  labels anywhere (D-02/D-03), every cell in the generated table is then data
  from the declaration, and the guard's record comparison is total — there is no
  cell it cannot check. Claude's choice; the user was offered the raw
  nine-row alternative and did not take it.

### Command fidelity

- **D-05: A generated cell is the declaration's `text`, character for
  character.** No markdown injected, no formatting heuristic, no unwrapping on
  the guard side. Measured: no remedy string contains a `|` or a newline and the
  longest is 157 characters, so nothing in the data is hostile to a table cell.
  Five of the seven linux remedies are not verbatim in today's README — not
  because the words differ but because the README backticks fragments *inside*
  the sentence (`` not `main` ``, `` a stock `debian:trixie` installation ``) and
  the declaration carries the same words with those inner backticks stripped.
  Those five rows lose their inner code formatting. The command a user types is
  unchanged; only its rendering is. Rejected: wrapping the whole cell in
  backticks, which would render `enable RPM Fusion Non-Free, then sudo dnf
  install vice` entirely as a command. — **Reversibility:** costly — the guard
  compares cells by exact string equality *because* of this; adding any
  formatting rule later means a matching un-formatting rule in the guard and a
  re-render of every cell.

### The generated region, and the prose it orphans

- **D-06: The markers wrap the table alone.** The generator never owns English
  prose. The lead-in at `README.md:96-97` introduces the two columns that are
  being dropped, and the generator has no data from which to author a
  replacement sentence.

- **D-07: This phase hand-rewrites three prose neighbours, once.** The two
  version columns go (D-10/D-11 from Phase 58, already locked — the declaration
  carries no VICE version data, so they cannot be generated), and three pieces of
  surrounding prose cite what they carried:
  - `README.md:96-97` — "Checked live against each ecosystem on 2026-08-18.
    `CPUHISTORY_GET` … requires **VICE >= 3.10**:" — introduces columns that vanish.
  - `README.md:110-111` — "the official SourceForge 3.9 zips **above**" — cites
    the version column's content.
  - `README.md:122-123` — "The 3.10 floor **named in the table above** binds
    `CPUHISTORY_GET`" — goes outright false the moment the column is gone.

  This is the same failure shape Phase 58 fixed at its D-11, one section further
  down. Leaving a known-false claim standing was rejected there and is rejected
  here. — **Reversibility:** costly — moving the marker boundary later makes the
  generator author prose and moves the ledger anchors a second time.

- **D-08: The citation ledger is re-anchored in the same commit that moves the
  lines.** `src/mcp/vice/phase58-citation-ledger.test.ts` re-verifies a literal
  anchor against the live file on every run, and three of its entries point into
  or around this table:
  `README.md:96-97` / `"Checked live against each ecosystem on 2026-08-18."`,
  `README.md:117-123` / `"No shipped tool in this project refuses on a VICE version."`,
  and `README.md:107` / `"brew install vice"`
  (`docs/phase58-declaration-provenance.md:384,385,398`). Any line movement in
  `README.md` reds that test. It is a guard, not an obstacle — treat a failure
  as the ledger doing its job and update the entries, never as a reason to avoid
  moving the lines.

### The 27 circular citations

- **D-09: The 27 `"source": "README.md:NNN"` values in `prerequisites.json` are
  left exactly as they are, and the circularity is written down.** After this
  phase the README's rows are generated *from* the declaration, so a record
  saying `provenance: carried, source: README.md:101` cites its own output.
  Nothing audits those 27 today — the ledger guard reads documents, not the
  JSON — so nothing breaks; the claim simply becomes historical. The phase's
  provenance document states plainly that these citations record where each
  string came from *before* generation, and that following one post-generation
  lands on output. Rejected: a commit-pinned citation syntax (`README.md@<sha>:101`)
  that nothing else in the repo uses, and re-pointing `source` at the generator,
  which would destroy the historical record that is the entire reason D-03 of
  Phase 58 gave `carried` a `source` at all. Consistent with D-02 either way.

### The guard

- **D-10: Shared row-derivation, independently-parsed README.** The guard calls
  the generator's own row-derivation function on the declaration, and parses the
  committed README region into records with its own reader. This mirrors
  `src/mcp/vice/resources-sync.test.ts`, whose header states the rule directly:
  it drives the same `build()` entry point because "the banner text must never
  exist in two implementations, so this test never re-derives it." Criterion 4's
  tolerances — reflowed whitespace, different column padding, different row
  order — fall out of a record comparison rather than being special-cased.
  Rejected: a fully independent second reader (the dedupe and platform rules
  would then live in two places that can disagree — the milestone's own failure
  mode), and render-then-normalise-then-diff (a byte comparison with a pre-wash,
  which is the assertion class the 2026-09-13 owner decision removed).

- **D-12: `GEN-03`'s planted divergence mutates the real pair in a temp
  directory.** Copy the real `prerequisites.json` and the real `README.md` into
  `mkdtempSync(tmpdir())`, change one record, run the guard, assert it fails and
  names the record that diverged. This exercises the guard's actual
  configuration against all eight real records rather than a toy, and it stays
  out of the repository tree — which matters concretely here, because this suite
  already has sites that fail deterministically once a scratch file is left in
  the repo tree. `phase58-citation-ledger.test.ts` was built with exactly this
  in mind: its options exist so "a planted fixture tree can be fed to the same
  code as the committed one."

### Claude's Discretion

The user answered "you decide" on three questions and gave five direct
decisions. Claude chose the following and stated the reasoning inline above
rather than leaving it implicit:

- **D-01** (generated scope) — "you decide".
- **D-04** (row dedupe and the `Platforms` column) — Claude's choice, with the
  nine-row alternative offered and not taken.
- **D-13: Both the generator module and its guard live under `src/mcp/vice/`** —
  "you decide". `node --test '*.test.*'` globs only that directory, so a guard
  placed there runs in CI through the existing `Test` step with no workflow
  change, and CI already fails on that step. `README.md` is at the repository
  root, reached by the plain `.git`-marker walk that
  `phase58-citation-ledger.test.ts` and `phase50-findings-contract.test.ts`
  already both use. Keeping the derive, render and parse functions in one module
  is what makes D-10's shared derivation possible at all. The module is repo
  tooling, not shipped surface: leave it out of `src/mcp/vice/package.json`'s
  `files[]`. Rejected: a repo-root `scripts/` generator (splits the pure
  functions the guard needs across a package boundary), and folding it into
  `build.ts` (whose contract is compiling host-bound `.mts` into `resources/`,
  not writing repo-root markdown).
- **D-11** (the overview's columns) — left open by the user, intent recorded above.

Naming is also Claude's, and needs a decision the planner should make
deliberately: `src/mcp/vice/install-resources.ts` already exists and means
something else entirely (deploying host launcher scripts into a consuming
project). A new module called `install-*` would collide with it in a reader's
head. A `prereq-*` prefix has no incumbent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements and their scoping
- `.planning/ROADMAP.md` § "Phase 61: The Install Tables Generated, and a Guard
  That Compares Facts" — the four success criteria and the two cross-cutting
  constraints. Criterion 4 (a change that alters no fact leaves the guard green)
  is what forces the record comparison.
- `.planning/ROADMAP.md` § "Sequencing Rationale (v1.1.0)" — annotated where the
  dropped doctor made it stale. Read the annotations, not just the prose.
- `.planning/REQUIREMENTS.md` — `GEN-01`, `GEN-02`, `GEN-03`; the governing
  never-auto-install constraint; and § Future Requirements, where `DOCTOR-01`..`09`
  now sit unbuilt and un-retracted.
- `.planning/ENGINEERING_RULES.md` §11 "Generated Artifacts" — the four-step
  change procedure, and the "equivalent deterministic drift check" allowance that
  `GEN-02`'s record comparison is taken under. §6 — non-vacuous verification,
  which `GEN-03` discharges.

### Carried decisions this phase depends on
- `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-CONTEXT.md`
  — D-01 (README carries one table), D-06 (the platform tree, written before
  `universal` existed in it), D-09 (prose containing a command, never a
  structured argv), D-10 and D-11 (both version columns dropped; the prose split
  by who owns the text).
- `docs/phase58-declaration-provenance.md` — § "Case five: one ecosystem under
  two platforms" (lines 198-211) is the authority for D-04's dedupe. § "Citation
  ledger" (from line 368) is the section D-08 edits.
- `docs/phase59-tool-location-placement.md` — the second document the citation
  ledger guard audits. Not edited by this phase, but it shares the guard.

### The source of truth and its readers
- `src/mcp/vice/prerequisites.json` — eight records, `schemaVersion: 1`, frozen
  by D-02. Top level is `{ schemaVersion, tools }`, `tools` keyed by id.
  Platform keys are `linux` / `darwin` / `win32` / `universal`.
- `src/mcp/vice/tool-location.mts` — `readDeclaration()` at line 281 is
  **module-private**, so the generator cannot import it as written. Its two
  exported neighbours are `remedyTextsFor()` (line 953) and `resolveTool()`
  (line 522). See Integration Points below.
- `src/mcp/vice/build.ts` — `HOST_BOUND_DATA_FILES = ["prerequisites.json"]`
  (line 76) copies the declaration into `resources/`. The generator reads the
  canonical file, never the copy.

### The target and its neighbours
- `README.md:94-115` — the whole "Which VICE you get, per package manager"
  section. `:96-97` lead-in, `:99-108` the table, `:110-111` and `:113-115` the
  prose below it.
- `README.md:117-125` — "VICE version compatibility", rewritten by Phase 58 and
  containing the false "named in the table above" clause D-07 fixes.

### The guards this phase touches or mirrors
- `src/mcp/vice/phase58-citation-ledger.test.ts` — re-verifies every ledger
  anchor against the live file on every run. Its header states the rule D-08
  honours: "A path existing on disk is not evidence a claim is true."
- `src/mcp/vice/resources-sync.test.ts` — the never-re-derive pattern D-10
  mirrors, stated in its own header.
- `src/mcp/vice/package.json` — the `test` script (`node --test '*.test.*'`) and
  `files[]`, which the new module stays out of.
- `.github/workflows/ci.yml` — the `Test` step (working-directory
  `src/mcp/vice`), and the standalone `decl-02-node18-proof` job, which must
  keep passing if the declaration is touched. Under D-02 it is not.

### Standing project constraints
- `CLAUDE.md` § Conventions — file naming and domain prefixes, one module per
  seam, "Import the owning function. Do not recompute it inline."
- `CLAUDE.md` § Constraints, the never-auto-install bullet — the generator writes
  documentation and must never imply a command run on the user's behalf.
- `.planning/codebase/CONVENTIONS.md` — the full convention record.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`findRepoRoot()` — the plain `.git`-marker walk.** Implemented identically in
  `phase58-citation-ledger.test.ts` and `phase50-findings-contract.test.ts`
  (the ledger test names the findings-contract test as its source in a comment above the copy). This is how a module under
  `src/mcp/vice/` reaches `README.md` at the repository root. Do not invent a
  third copy without deciding to; `src/mcp/vice/repo-root.ts` is the project's
  owning resolver for the project root and should be checked first.
- **`mkdtempSync(tmpdir())` fixture trees.** Used by
  `phase58-citation-ledger.test.ts`, `host-tool.test.ts` (which writes a scratch
  `prerequisites.json`) and `tool-location.test.ts` (`withExclusionFixture`).
  D-12's planted divergence follows this, not a repo-tree scratch file.
- **Committed JSON data files read with `JSON.parse` and no dependency** —
  `anno-regbits.json`, `tools-manifest.stock.json`, `prerequisites.json`.
  No parser dependency is needed or wanted on either side of this phase.

### Established Patterns
- **Never re-derive what the generator owns.** `resources-sync.test.ts` drives
  `build()` itself rather than reimplementing the banner. D-10 is the same move.
- **Anchors over paths.** The citation ledger exists because two `file:line`
  citations pointed at the wrong lines and passed every verify that only checked
  the path existed. Any claim this phase writes about a README line should carry
  an anchor the guard re-checks, not a bare line number.
- **Assert relations, not counts.** The guard should assert that every declared
  record has a row and every row has a record — never that there are eight of
  them. **Caution for the planner:** the canonical write-up of this rule lived
  in `scripts/check-npm-packages.mjs`, which no longer exists — it was deleted
  on 2026-09-17 in `d0e9fb2e`. `CLAUDE.md` and Phase 58's CONTEXT.md both still
  cite that path. Do not follow either citation; the rule survives, its stated
  home does not.
- **Generated-but-committed.** `build.ts` plus `resources-sync.test.ts` is the
  in-tree precedent for exactly the shape this phase adds, one artifact kind over.

### Integration Points
- **`readDeclaration()` is module-private** (`tool-location.mts:281`). The
  generator needs the parsed declaration. Three routes, and the planner should
  pick one deliberately rather than by accident: export it from
  `tool-location.mts` (honours "import the owning function", but that file is
  `.mts` — host-bound and compiled into `resources/` — so a `.ts` consumer
  crosses the `.mts`/`.ts` seam described in CONVENTIONS); read and parse the
  JSON in the new module (simple, but a second reader of the file's shape); or
  lift the reader into a module both can import.
- `README.md` — two new marker-delimited regions, plus three hand-rewritten
  prose passages (D-07).
- `docs/phase58-declaration-provenance.md` — three ledger entries re-anchored
  (D-08), and a new section recording the circular citations (D-09).
- `src/mcp/vice/` — one new module and one new colocated `.test.ts`. No
  `package.json` `files[]` entry, no CI workflow change, no `build.ts` change.
- **Untouched by construction:** `src/mcp/vice/prerequisites.json` (D-02),
  `resources/prerequisites.json` and everything `build.ts` emits, the
  `decl-02-node18-proof` CI job, and every `host-tool.mts` refusal path.

</code_context>

<specifics>
## Specific Ideas

- The user's decisive intervention was D-02, and it arrived as a refusal rather
  than a selection: the labels question was put with a recommended option, and
  the answer was that no labels go in the declaration. The consequence — the
  README's ecosystem column reading `fedora-rpmfusion` instead of `Fedora (via
  RPM Fusion Non-Free — not Fedora's own base repos)` — was stated in the option
  text that was accepted. It is a deliberate trade, not an oversight, and a
  later agent must not "fix" it by reintroducing a label from either side.

- Four facts were measured during this discussion rather than assumed, and each
  one changed a decision. Recorded so the researcher does not re-derive them:
  1. `README.md` carries **one** install table, not several. Phase 58's D-01
     still holds three phases later.
  2. Three of the eight records (`x64sc`, `c1541`, `petcat`) carry **identical**
     remedy trees; four carry `universal` only. This is what killed the
     table-per-record option.
  3. No remedy string contains a `|` or a newline; longest is 157 characters.
  4. Five of seven linux remedies differ from their README rows **only** by
     inner backticks. The words round-trip; the formatting does not.

- One thing was deliberately **not** raised, and is recorded as open rather than
  settled: how a developer regenerates the README after editing the declaration
  — an npm script in `src/mcp/vice/package.json`, a `--write` flag on the
  module, or something else. `ENGINEERING_RULES.md` §11 requires the procedure
  to exist ("update the generator/source of truth; regenerate the artifact; run
  the drift guard"), so the planner owns naming it, and the guard's failure
  message should name the exact command to run.

</specifics>

<deferred>
## Deferred Ideas

- **A doctor, a `--check`, or any pre-flight verification surface.** Dropped at
  owner decision 2026-09-18; `DOCTOR-01`..`09` are in REQUIREMENTS.md § Future
  Requirements, unbuilt and un-retracted. Not a gap this phase may close, and
  not a thing a generator may grow into.
- **Correcting `CLAUDE.md`'s stale ACME-prefix citation** — carried forward
  unclosed from Phase 58's deferred list. Still real, still not this phase's.
- **`DECL-F1` / `DECL-F2` / `DOCTOR-F2`** — the installer consuming the
  declaration, generating `acme-build/SKILL.md`'s prefix list, and a per-machine
  `~/.config/c64-re-tools/tools.json`. All already recorded in REQUIREMENTS.md
  § Future Requirements.
- **Labels for the eight ecosystem ids**, in any location. Foreclosed by D-02
  for this phase. If a future phase wants readable row labels back, this is
  where that conversation resumes — and it should resume as its own decision,
  not as a formatting fix inside a generator change.

### Flagged during this discussion, not this phase's to fix

- **`DECL-05` reads Complete but its proof no longer exists in the tree.**
  Phase 58's D-13 placed the packaging assertion — the named check that
  `prerequisites.json` appears in the published tarball's own file list — in
  `scripts/check-npm-packages.mjs`. That file was deleted on 2026-09-17 in
  `d0e9fb2e` ("build: reduce CI to a correctness gate"), which removed five of
  the six scripts under `scripts/`. Measured today: no file anywhere in the tree
  names `DECL-05`, and nothing asserts the tarball file list. The declaration
  *is* still listed in `src/mcp/vice/package.json`'s `files[]`, so the shipped
  behaviour is intact — what is missing is the guard that would catch it being
  dropped. `.planning/REQUIREMENTS.md:31` and `:147` both mark it Complete.
  This belongs to Phase 58, not Phase 61. Recorded here because Phase 61 is the
  last phase of v1.1.0 and this would otherwise close the milestone unnoticed.

### Reviewed Todos (not folded)

`todo.match-phase 61` returned fourteen matches. Twelve scored 0.6 or below on
generic keyword overlap (`phase`, `source`, `2026`, `what`) with nothing touching
README generation, the declaration or drift guards. None folded. Two are
adjacent enough to name so a later phase does not think they were missed:

- **"audit-gate.mjs's shared 15s guard budget marks the last docs guards red
  under suite load"** — would have been directly relevant to adding a new
  documentation guard to the suite. Measured stale during this discussion:
  `audit-gate.mjs` no longer exists anywhere in the tree, and there are no
  `docs*.test.*` files under `src/mcp/vice/`. The todo should be closed on that
  basis by whoever next triages the backlog; this phase does not close it.
- **"Fix stale 'six skills' count — nine ship"** — a documentation-count fix
  elsewhere in the tree. Adjacent because D-11's overview enumerates what each
  record unblocks, including skills. Phase 61 does not close it and must not be
  read as having done so.

</deferred>

---

*Phase: 61-the-install-tables-generated-and-a-guard-that-compares-facts*
*Context gathered: 2026-09-19*
