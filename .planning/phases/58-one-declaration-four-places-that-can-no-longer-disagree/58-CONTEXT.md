# Phase 58: One Declaration, Four Places That Can No Longer Disagree - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

One committed JSON file that names every host prerequisite this plugin needs —
`x64sc`, `c1541`, `petcat`, the ACME binary, ACME's standard library, Ghidra,
dxa and Node — and for each one records its id, which skills and MCP
capabilities it unblocks, and its remedy text per platform. Plus the packaging
evidence that the file reaches a user who installed rather than cloned
(`DECL-05`), the guard that Node is the only record carrying a version floor
(`DECL-04`), and the proof that the file parses under a Node below the MCP
server's own floor (`DECL-02`).

**The declaration describes; it does not act.** Nothing in this phase invokes a
package manager, and no field may be shaped so a later reader could execute it
directly.

**Explicitly NOT in this phase:** `DECL-03` — repointing every live refusal at
the declaration. That edits `host-tool.mts`, whose compiled `resources/*.mjs`
artifact is byte-guarded by `resources-sync.test.ts`, and Phase 60 exists to
isolate that first regeneration. No shipped code path reads this file when
Phase 58 ends. That is correct, not an oversight.

</domain>

<decisions>
## Implementation Decisions

### Two roadmap premises are stale — measured against the tree, 2026-09-16

Phase 58's goal names four disagreeing places. Two of them are not what the
roadmap says they are, and the planner must not spend a task looking for them.

- **D-01:** `README.md` carries **one** install table, for VICE only
  (`README.md:99-107`) — eight ecosystem rows, plus a "Version it ships" and a
  "Clears the 3.10 gate?" column. There is **no** README install line for ACME,
  `c1541`, `petcat`, Ghidra, dxa or Node. The roadmap's plural "per-distro
  tables" describes one table covering one of eight records.
- **D-02:** `acme-build/SKILL.md` **no longer carries the ACME prefix list.**
  `SKILL.md:211-212` says in as many words that the prefixes are "none of them
  documented a second time here". They exist in exactly one place:
  `findAcmeLib()` at `host-tool.mts:2231-2246`. `CLAUDE.md`'s bullet citing
  `src/skills/acme-build/SKILL.md` for "four documented prefixes" is out of date
  and should be corrected wherever this phase touches it — but correcting
  `CLAUDE.md` is **not** a Phase 58 deliverable and must not be absorbed as one.

Consequence: success criterion 5 as written — *"every string in the declaration
is carried from a named existing source"* — is satisfiable for **one** of the
eight records. D-03 amends it.

### Remedy provenance

- **D-03: Criterion 5 is amended, explicitly, not reinterpreted.** The rule
  becomes: *every remedy string names its origin, and a newly authored one is
  marked authored.* Every string carries a three-valued `provenance`:
  - `measured` — this project has observed it work. Exactly one qualifies today:
    `sudo apt install acme` on Debian/Ubuntu, which CI runs every build
    (`.github/workflows/ci.yml:78`).
  - `carried` — copied from an existing in-tree string, and the record names the
    `file:line` it came from.
  - `authored` — derived from the tool's own upstream install documentation, and
    the record names that source.

  No string may be unlabeled. This preserves the project's measured-over-asserted
  discipline (an authored `brew install acme` is never presented internally as a
  measured fact) while leaving the Phase 61 doctor useful to a macOS user on day
  one. — **Reversibility:** costly — the tag is read by `DECL-04`'s test, by
  Phase 60's refusal wiring and by Phase 62's generator; adding or removing a
  value later touches all three plus every record.

- **D-04: Per-string provenance lives in the JSON; the reasoning lives in a
  docs file.** `docs/phase58-declaration-provenance.md`, in the style this
  project already uses (`docs/phase40-preprocessing-tools-decisions.md`,
  `docs/stock-hard-losses.md`), carries every case where two sources disagreed
  and which won. The JSON tag is what a test asserts on; the doc is what a human
  reads. Criterion 5's second half ("records which was chosen and why") is
  satisfied by the doc, not by prose inside the JSON.

- **D-05: One genuine live disagreement is already identified and must be
  recorded.** `README.md:96-97` frames the VICE 3.10 gate as load-bearing
  (`CPUHISTORY_GET` behind the cycle stopwatch). `.planning/REQUIREMENTS.md:88`
  records the opposite and is the later evidence: *"No shipped tool refuses on
  one. `vice_cpu_history` runs over the text channel (`chis`)"*. REQUIREMENTS.md
  wins. This is the worked example for `docs/phase58-declaration-provenance.md`.

### Record shape

- **D-06: Platform keys are OS-level; ecosystems nest beneath them.** Top level
  is `linux` / `darwin` / `win32` — what a doctor can match on `process.platform`.
  Each carries an ordered list of ecosystem entries (`debian-trixie`,
  `ubuntu-2510`, `arch`, `fedora-rpmfusion`, `alpine-edge`, `homebrew`,
  `windows-official`, …). The Phase 61 doctor matches the OS and prints its
  list; the Phase 62 generator walks the same tree and re-emits all eight README
  rows losslessly.

  Rejected: a flat ecosystem-row list (the doctor cannot choose between five
  Linux rows from `process.platform` alone), and a separate short per-OS remedy
  beside a separate ecosystem table — that reintroduces two places that can
  disagree, which is the exact thing this phase exists to remove.
  — **Reversibility:** costly — both Phase 61's doctor and Phase 62's generator
  walk this tree; reshaping it later is a change to two consumers plus the file.

- **D-07: ACME's standard library is its own record,** separate from the ACME
  binary. Forced upstream by `DOCTOR-04`, not decided here. Its carried remedy
  is `export ACME=<dir holding cbm/c64/vic.a>` (`SKILL.md:255`), and the four
  probe prefixes come from `findAcmeLib()` (`host-tool.mts:2237-2243`), which is
  now their only home (see D-02).

- **D-08: `unblocks` is keyed by two closed, checkable vocabularies** —
  skills by their `src/skills/<name>/` directory name (nine of them), and MCP
  capabilities by `host_tool` op id (`acme.build`, `dxa.disassemble`,
  `ghidra.analyze`, and the `c1541.*` / `petcat.*` ops). Both sets are
  enumerable from the tree, so `DECL-01` becomes mechanically verifiable rather
  than prose. Do **not** key by individual `vice_*` / `anno_*` tool names — most
  of that surface depends on no host prerequisite at all.

- **D-09: Remedy strings are human prose containing a command, never a
  structured argv.** `"Enable the contrib component first, then run: sudo apt
  install vice"` as one string — never `{"cmd": "apt", "args": ["install",
  "vice"]}`. This is the phase's cross-cutting no-execute constraint made
  testable: a structured argv field is one `execFile()` away from breaking the
  milestone's governing never-auto-install rule. A test should assert the shape.
  — **Reversibility:** one-way in spirit — the whole milestone's governing
  constraint rests on this; undoing it is not a refactor but a policy reversal.

### VICE version columns

- **D-10: Both version columns are dropped, and the README prose is corrected.**
  The declaration carries **no** VICE version data of any kind — not a floor, not
  a dated observation. `DECL-04` therefore holds literally rather than by
  argument. (User decision, not Claude's discretion.)

- **D-11: The correction splits by who owns the text, and the split is the
  reverse of the obvious one.** Phase 62 *generates* the table, so a hand-edit to
  `README.md:99-107` in Phase 58 would be overwritten — Phase 62 removes the two
  columns when it emits the table. But `README.md:113-119` ("What a sub-3.10
  VICE costs") sits **outside** the generated section; nothing regenerates it, so
  it stays false unless a phase owns it. **Phase 58 rewrites that prose.**

  This is the one place Phase 58 leaves "data only". Accepted deliberately: a
  markdown edit carries none of the `resources/*.mjs` regeneration risk the
  roadmap keeps Phase 58 thin to avoid, and leaving a known-false claim standing
  for four more phases — in a milestone whose whole subject is the user's first
  hour — is worse.

### Placement, packaging, and the low-Node proof

- **D-12: The file is `src/mcp/vice/prerequisites.json`.** It must live under
  `src/mcp/vice/` to be reachable by that package's `files[]`; the precedent for
  a committed JSON data file there is `anno-regbits.json` and
  `tools-manifest.stock.json`. Named `prerequisites.json`, **not** research's
  proposed `tools.declaration.json` — `tools.json` is already this milestone's
  name for the *user's* location-override file (`LOC-01`,
  `.c64-re-tools/tools.json`), and two near-identical names in one milestone is a
  confusion worth spending a rename to avoid. — **Reversibility:** costly —
  renaming after Phase 60 wires refusals to it touches the seam, the doctor and
  the generator.

- **D-13: `DECL-05` is proved off the tarball's own file list, never off the
  filesystem.** An explicit named assertion in `scripts/check-npm-packages.mjs`
  reading `vice.files`. The existing transitive-closure import walk **cannot**
  reach this file — nothing imports it — so it needs its own entry, in the style
  of the regression guard already documented at
  `scripts/check-npm-packages.mjs:16-18`. That file's own header explains why a
  repo-path `existsSync` would pass while the published package silently omits
  the file; that is the CR-07 failure shape, and it applies here exactly.

- **D-14: "The oldest Node the doctor must start on" is Node 18.** The number is
  not invented for this phase: it is the floor this project already declares for
  a package users run (`installer/package.json:16`, `">=18"`). `DECL-02`'s proof
  is a CI matrix cell that `JSON.parse`s `prerequisites.json` under Node 18.
  All four current CI jobs pin Node 24 (`ci.yml:33,237,278,344`), so this cell is
  new. Phase 61's `DOCTOR-02` cell later runs the real doctor entry point on the
  same floor — one number, two phases.

- **D-15: The Node 18 cell must use `actions/setup-node`,** which provisions a
  Node runtime and is not a package-manager invocation of an external
  prerequisite. The milestone's governing constraint forbids the latter in CI
  exactly as in shipped code; the planner must not reach for `apt`/`nvm`/`npm i -g`
  to get the old Node.

### Claude's Discretion

The user answered "you decide" on four of five questions and gave one direct
decision (D-10). Claude chose D-03, D-04, D-06 and D-11 and stated the reasoning
inline above rather than leaving it implicit. The planner may revisit any of the
four on new evidence, but should record the reversal the way this file records
the original choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements and their scoping
- `.planning/REQUIREMENTS.md` — `DECL-01`, `DECL-02`, `DECL-04`, `DECL-05` in
  full; the governing never-auto-install constraint; and the Out of Scope table,
  whose "Reporting a VICE, ACME, Ghidra or dxa version number" row is the
  evidence behind D-05 and D-10.
- `.planning/ROADMAP.md` § "Phase 58" — the five success criteria and the two
  cross-cutting constraints.
- `.planning/ROADMAP.md` § "Sequencing Rationale (v1.1.0)" — Departure 1 explains
  why `DECL-03` is Phase 60's; read before assuming Phase 58 should wire anything.
- `.planning/research/SUMMARY.md` — the v1.1.0 research. Note: its proposed file
  name (`tools.declaration.json`) is superseded by D-12.

### The four sources the declaration consolidates
- `README.md:99-107` — the VICE install table, eight ecosystem rows. The only
  per-platform remedy source that exists today.
- `README.md:113-119` — "What a sub-3.10 VICE costs". Known-false prose that
  Phase 58 rewrites (D-11).
- `src/mcp/vice/host-tool.mts:2231-2246` — `findAcmeLib()`. The ACME library
  prefix list's only home (D-02).
- `src/mcp/vice/host-tool.mts:1472` — the dxa refusal, carrying
  `bash vendor/dxa/build.bash build`.
- `src/mcp/vice/host-tool.mts:2290-2305` — `findSiblingBinary()`'s `c1541` /
  `petcat` fallback, including the PATH-shadowing warning. Names tried paths but
  carries no remedy.
- `src/mcp/vice/backend-detect.mts:304-315` — `resolvedBackend()`, the `x64sc`
  probe and its `VICE_BIN` default.
- `src/skills/acme-build/SKILL.md:254-255` — the two generic ACME remedy strings.
- `src/mcp/vice/resources/vice-launcher.sh:156` — `NODE_FLOOR_MAJOR=24`, the
  server's own floor.

### Packaging and proof
- `src/mcp/vice/package.json` — `files[]` (where `prerequisites.json` must be
  listed) and `engines.node` (`>=24.0.0`).
- `installer/package.json:16` — `">=18"`, the source of D-14's number.
- `scripts/check-npm-packages.mjs:1-60` — the header explaining why tarball-list
  assertions beat filesystem checks, and the regression-guard style D-13 follows.
- `.github/workflows/ci.yml:78` — `retry_apt install -y acme`, the single
  `measured` provenance source (D-03), and itself a documented carve-out that
  this phase must leave exactly as it is.

### Standing project constraints
- `CLAUDE.md` § Constraints, the `**Dependency**: External tools are never
  auto-installed` bullet — the detect-then-refuse-by-name pattern per tool.
  **Note:** its citation of `src/skills/acme-build/SKILL.md` for the ACME
  prefixes is stale (D-02).
- `.planning/ENGINEERING_RULES.md` §6 (non-vacuous verification) and §11 (the
  equivalent-deterministic-drift-check allowance).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Committed JSON data files in `files[]`:** `src/mcp/vice/anno-regbits.json`
  and `src/mcp/vice/tools-manifest.stock.json` are both plain JSON, both listed
  in `files[]`, both read with `JSON.parse` and neither adds a dependency.
  `prerequisites.json` is the third of that kind — an established pattern, not a
  new one.
- **The three existing probe functions** the declaration describes but does not
  call: `findAcmeLib()`, `findDxaBinary()`, `findSiblingBinary()`
  (`host-tool.mts`), and `resolvedBackend()` (`backend-detect.mts`). All four
  return the same `{ path, tried }` shape. Phase 58 must not import or modify any
  of them — that is Phase 59/60 work.
- **`docs/stock-hard-losses.md`** — the model for a docs file that records an
  accepted, reasoned outcome rather than a gap. `docs/phase58-declaration-provenance.md`
  (D-04) should read like it.

### Established Patterns
- **Assert relations, not counts.** `check-npm-packages.mjs:29-45` records the
  incident where pinning the skill count to six turned CI red on a correct tree.
  D-08's `unblocks` vocabularies are enumerable from the tree — any test over
  them should assert the relation (every named skill directory exists; every
  named `host_tool` op is in the allowlist), never a literal count of records.
- **Refuse by name, with the remedy in the message.** Every existing refusal
  string this phase carries follows it. The declaration's job is to become the
  single source those messages read from in Phase 60 — so the strings it carries
  must stay usable verbatim inside a refusal sentence.
- **Generated-but-committed.** `build.ts`'s `HOST_BOUND_ARTIFACTS` and
  `resources-sync.test.ts`. `prerequisites.json` is **not** part of this — it is
  hand-authored, not generated, and nothing in Phase 58 touches `build.ts` or
  regenerates `resources/*.mjs`.

### Integration Points
- `src/mcp/vice/package.json` `files[]` — one new entry.
- `scripts/check-npm-packages.mjs` — one new named assertion (D-13).
- `.github/workflows/ci.yml` — one new low-floor matrix cell (D-14, D-15).
- `README.md:113-119` — the prose rewrite (D-11).
- Everything else is a new file: `src/mcp/vice/prerequisites.json` and
  `docs/phase58-declaration-provenance.md`.

</code_context>

<specifics>
## Specific Ideas

- The user's one direct decision was unambiguous and is D-10: **drop both
  version columns and correct the README**, rather than preserving them as a
  dated non-floor annotation. The "Clears the 3.10 gate?" column asserts a
  consequence the project has since measured false; keeping it under a different
  field name would have preserved the error.

- Three gray areas were identified during discussion and deliberately **not**
  raised, because the user declared ready for context. They are recorded here so
  the researcher and planner treat them as open rather than settled:
  1. **Does the declaration carry a `schemaVersion` field?** `.annostore` uses
     `SCHEMA_VERSION` 4; `tools-manifest.stock.json` carries no version at all.
     Both precedents exist in-tree and they point opposite ways.
  2. **Does dxa belong in the declaration at all?** `LOC-05` makes it
     un-overridable by file or environment because it is project-vendored and
     project-built. It still has a real remedy (`bash vendor/dxa/build.bash
     build`) and a real absence mode, so it probably does — but its record's
     shape will differ from every other one, and that should be deliberate.
  3. **How is `DECL-04`'s "no other record carries a version-floor field" test
     written so it stays non-vacuous?** A test that passes because no record has
     the field, on a file where no record ever could, proves nothing. Per
     `ENGINEERING_RULES.md` §6 it needs a planted violation observed failing.

</specifics>

<deferred>
## Deferred Ideas

- **Correcting `CLAUDE.md`'s stale ACME-prefix citation** (D-02). Real and worth
  doing; not a Phase 58 deliverable. `CLAUDE.md`'s constraint list is mirrored
  from `.planning/PROJECT.md`, so a CLAUDE.md-only edit would be wiped on the
  next regeneration — this needs its own quick task touching both.
- **Generating `acme-build/SKILL.md`'s prefix list from the declaration** —
  already recorded as `DECL-F2` in REQUIREMENTS.md § Future Requirements.
  Additionally moot as written, since D-02 establishes the list is no longer in
  SKILL.md at all; if this is ever taken up, its subject is `findAcmeLib()`.
- **The installer package consuming the declaration** for a "what you will need"
  message — already `DECL-F1`, deferred.
- **A per-machine `~/.config/c64-re-tools/tools.json`** — already `DOCTOR-F2`,
  deferred.

### Reviewed Todos (not folded)

`todo.match-phase 58` returned fifteen matches, all scored 0.6 on generic
keyword overlap (`phase`, `mcp`, `path`, `test`) and none touching prerequisite
declaration, tool location or packaging. None folded. One is adjacent and worth
naming so a later phase does not think it was missed:

- **"Fix stale 'six skills' count — nine ship"** — adjacent because D-08 keys
  `unblocks` by skill directory name and will enumerate all nine. The todo is a
  documentation-count fix elsewhere in the tree; Phase 58 does not close it, and
  should not be read as having done so.

</deferred>

---

*Phase: 58-one-declaration-four-places-that-can-no-longer-disagree*
*Context gathered: 2026-09-16*
