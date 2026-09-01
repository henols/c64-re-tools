# Phase 28: The Store Core - Research

**Researched:** 2026-08-27
**Domain:** Durable local annotation persistence over `node:sqlite`, interval typing over a 64K address space, structural single-seam confinement, planted-violation test design
**Confidence:** HIGH — every load-bearing claim in this document was either read out of the tree at HEAD this session or produced by running code on this host. The `## Contradictions Found` section is where the value is.

## Summary

There is no CONTEXT.md for this phase; `ROADMAP.md` §Phase 28 and `REQUIREMENTS.md`
`STORE-01..07` are the decision record, and this research treats them as locked.
Almost all of it holds up against the real tree. **Five things do not**, and they
are collected in `## Contradictions Found` rather than smoothed into the body:
`node:sqlite` on the pinned Node line **does** expose the session extension
(`createSession`/`applyChangeset`) even though it does not expose inversion; a
zero-length store file is **not** refused by SQLite and reads as a clean empty
database; the WAL-sidecar cost is opt-in rather than inherent because the default
journal mode is `delete`; `block-class.ts` — Phase 27's own named boundary — will
**silently misclassify every block** the new store emits if the store's spelling
is lowercase, and its sibling label-kind vocabulary was never extracted at all;
and `STORE-05`'s stored xref access kind is in direct tension with Phase 29
criterion 5's "derived on every query and never cached on disk".

The persistence decision (`D1` → `node:sqlite`) is sound and I re-earned its
evidence rather than citing it. I built a ~90-line prototype of the criterion-4
design and **ran the exact required sequence** — mutate → `SIGKILL` with no clean
close → fresh process → reopen → read back by value → revert to the prior value —
then planted the violation (`if (!s.noCommit) s.db.exec("commit")`) and watched
**both halves of the same test go red**. That is the milestone's one irreversible
decision discharged by observation, not by argument. The optimistic-concurrency
refusal was likewise proven across two real OS processes, the 65,536-address
exhaustive cross-validation runs in **279 ms** against a 2,000-range fixture, and
the split-table orientation control produces a demonstrably differing
resolved-target set.

The hard parts of this phase are **not** SQL. They are: getting the type
vocabulary written down in one place that `block-class.ts` and the census agree
with; keeping `node:sqlite` behind one module in a way whose absence assertion is
non-vacuous; and writing tests that fit a harness with a nine-file manual-only
carve-out, a ~660 s full-glob runtime, a hanging `vice-proxy.test.ts` child, a
44-failure clean baseline, and one existing `assert.equal(stderr, "")`.

**Primary recommendation:** Build **three** new modules — `anno-types.ts` (the
frozen 12-member vocabulary, the range/label/comment/xref/enum row types, the
named `ViceError` subclasses, the validators), `anno-index.ts` (the pure
narrowest-wins paint-array index and its independent scan oracle), and
`anno-store.ts` (the **only** module in the tree that names `node:sqlite`) — with
default journal mode left at `delete`, an explicit meta-row-plus-`integrity_check`
refusal at open, a revision compare-and-swap on every write, `vacuum into` for the
pre-mutation snapshot, and a single combined durability-and-revert test whose
planted violation is the removal of one `COMMIT`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| The 12-member type vocabulary | `anno-types.ts` (container-side library) | — | It is a data definition with zero I/O; every other tier imports it, including tests that cross-check `block-class.ts`. (This row is about the VOCABULARY, not about the module: since CR-03 the module has exactly one filesystem-touching export — see the next row.) |
| Argument validation (`$`/`0x` parsing, label legality, range shape) | `anno-types.ts` | filesystem, for workspace confinement only | The proxy validates nothing (`vice-proxy.ts:3230`), so validation must live where the store is entered. Not in the persistence module. **REVISED 2026-08-27 after CR-03 (closed by plan `28-09`).** The original rationale ended "…so it is unit-testable with no file on disk", and that clause became false for exactly one export. Workspace confinement (`storePathWithinWorkspace`) has to answer whether a path escapes the root once symbolic links are followed, and that is a filesystem question a string comparison provably cannot answer — the gap CR-03 reported. So this tier imports `node:fs` (`existsSync`, `realpathSync`, nothing more) and that ONE export is a function of its arguments **and the filesystem**; every other export is still a frozen constant or a pure function and is still unit-testable with no file on disk. The alternative siting — resolve real paths in `anno-store.ts` (which this map already pairs with "filesystem") and pass resolved paths into the validator — was weighed and REJECTED: it splits one confinement contract across two modules and leaves the exported validator callable in a form that no longer confines, which is the "two places decide" shape plan `28-07` exists to remove from the snapshot ring. `node:fs` is a Node builtin, not a seam: the closed consumer set for `hostpath.ts`/`containerpath.ts` is unchanged and `anno-types.ts` is still absent from it (`hostpath-consumers.test.ts`), and `node:sqlite` still has exactly one shipped importer. The reversal is recorded here rather than the old rationale being deleted, per `28-03` prohibition P2 |
| Narrowest-range-wins resolution | `anno-index.ts` (pure) | — | A pure function of range rows and an address. Keeping it out of the persistence tier is what makes the 65,536-address exhaustive cross-validation cheap and what lets overlapping rows be fed in deliberately |
| Durability, revision CAS, snapshot/revert | `anno-store.ts` (persistence) | filesystem | `STORE-07`: the one module that names `node:sqlite` |
| Block-class translation for the census | `block-class.ts` (existing, Phase 27) | — | Already the named boundary. Phase 28 changes its two literals; it may not gain an import (its empty import list is asserted) |
| Store reachability from an agent | **Phase 29** (`MCP-01..05`, `STORE-06`) | — | Explicitly out of scope here. Phase 28 ships modules that nothing imports yet, which the tarball closure walk permits (see `## Common Pitfalls` P-9) |
| Host-path translation | **nobody** — forbidden | — | The store file never leaves the container. No new module may import `hostpath.ts` |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-01 | Labels, comments, per-range typing over the **full 12-member vocabulary**, scopes, project enums | `## The 12-Member Vocabulary, Read Off The Real Schema` gives the twelve literal strings verbatim from `anno-tools.ts:291-304`, plus the label/comment/scope/enum field shapes from the same file, plus the label-namespace and legality rules |
| STORE-02 | Ranges stored as ranges, never merged on adjacency, no splitter | `## Architecture Patterns` → Pattern 2. The paint-array index is rebuilt from rows on mutation; adjacency is never consulted, so there is nothing to merge and no splitter to introduce |
| STORE-03 | Narrowest-wins lookup exact at all 65,536 addresses, cross-validated against a second implementation | `## The Cross-Validation Oracle` — measured at **279 ms** for 2,000 ranges, zero disagreements. Tie-break, both ends and `$FFFF` pinning specified |
| STORE-04 | Survives `SIGKILL`; an edit is revertible; **one** combined planted-violation test | `## Durability and Revert, Proven By Running It` — the exact sequence was run and the planted violation observed red. Prototype at `~/.cache/gsd-probe/c4/` |
| STORE-05 | Schema version + reserved uninterpreted `bank` + xref access kind | `## Contradictions Found` C-5 flags the tension with Phase 29 criterion 5 and recommends a resolution. Access-kind vocabulary provenance recorded honestly as `[CITED]`, not `[VERIFIED]` |
| STORE-07 | `node:sqlite` reached through exactly one seam module | `## The Structural Single-Seam Assertion` — the exact idiom, the four access routes that must be caught (one more than the hostpath guard covers), and the non-vacuity pairing |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that bind this phase. The planner must
verify each plan against these.

| # | Directive | How Phase 28 complies |
|---|-----------|----------------------|
| CM-1 | **Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`; the project maintains a tested closed consumer set** | Phase 28 introduces **no** host-facing path. The store path is container-side and arrives per call. No new module imports `hostpath.ts`; `hostpath-consumers.test.ts:143-149`'s five-element `deepEqual` **plus** its `length, 5` assertion already enforces this — a sixth importer fails both halves |
| CM-2 | **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** | Not reachable from Phase 28: no tool is registered here. Phase 29 registers through `buildViceTool()` (`vice-proxy.ts:3263`), which never enters `forwardToVice()`, so `rewriteArguments()` (`:3052`, and `gatherWedgeEvidence()`'s second call site at `:1531`) never sees a store path. Satisfied **by construction**, as `MCP-02` states |
| CM-3 | **Node ≥ 22.18 native type-stripping; the shipped server has no build step** | All three new modules are plain `.ts`, run directly. **No `.mts`**, so `build.ts` and `resources-sync.test.ts` are untouched. Confirmed: `engines.node` is `">=22.18.0"` (`src/mcp/vice/package.json:29-31`) and the live host runs `v22.22.0` |
| CM-4 | **Host-bound `.mts` files must be compiled by `build.ts` into committed `resources/*.mjs`** | Does not apply — see CM-3. A store module authored as `.mts` would drag the whole build/sync apparatus in for no reason; do not |
| CM-5 | **No new runtime dependency** (`ENGINEERING_RULES.md` §4's six-point bar) | `node:sqlite` is a Node builtin, unflagged since v22.13.0 and therefore unconditional at the `>=22.18.0` floor. §4 is not triggered. **Zero** packages are installed by this phase |
| CM-6 | **Single seam per concern** | `STORE-07` is this rule applied to `node:sqlite`, asserted structurally rather than promised |
| CM-7 | **Testing: preserve documented invariants; `vice-sync.ts`'s checkpoint-wait functions stay un-unit-tested** | Untouched by this phase |
| CM-8 | **GSD workflow enforcement: no direct repo edits outside a GSD workflow** | This research wrote only `.planning/phases/28-the-store-core/28-RESEARCH.md`. Every probe artifact lives outside the repo (`~/.cache/gsd-probe/`) |

Two further project-wide constraints are **not** in CLAUDE.md but are enforced by
committed guards, and both will bite a naively-written module header — see
`## Common Pitfalls` P-1 and P-2.

## The 12-Member Vocabulary, Read Off The Real Schema

`anno_set_data_type`'s `data_type.enum` at **`src/mcp/vice/anno-tools.ts:291-304`**,
quoted verbatim [VERIFIED: src/mcp/vice/anno-tools.ts:291-304]:

```
            "code",
            "byte",
            "word",
            "address",
            "petscii",
            "screencode",
            "lo_hi_address",
            "hi_lo_address",
            "lo_hi_word",
            "hi_lo_word",
            "external_file",
            "undefined",
```

Twelve members, lowercase, snake_case. The **four split layouts** are, verbatim:
`lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`. They factor as
`{lo_hi, hi_lo} × {address, word}`, and the schema's own description distinguishes
the two axes [VERIFIED: src/mcp/vice/anno-tools.ts:305-313]:

- orientation: `"lo_hi_address=split address table, low bytes first then high bytes (even count required); hi_lo_address=split address table, high bytes first (even count required)"`
- address-vs-word: `"address=16-bit LE pointers (creates X-Refs, use for jump tables/vectors)"` versus `"word=16-bit LE values"`

**This matters for criterion 1's control.** The orientation axis is observable as a
*differing resolved-target set*; the address-vs-word axis is observable as *whether
xref rows are produced at all*. Both are needed to justify four members rather than
two. `even count required` is a validation rule, not a type property — it belongs in
`anno-types.ts` as a refusal.

**Do not carry `anno_` in the member strings, and do not re-spell them.** The
strings themselves contain no `anno`, so they survive Phase 32's gate unchanged.
Re-spelling them (e.g. `lohi_address`) would break every `src/skills/` playbook that
names them and gain nothing.

### The other four vocabularies STORE-01 needs, also read off the real schema

| Vocabulary | Members | Source |
|---|---|---|
| Comment type | `"line"`, `"side"` | [VERIFIED: src/mcp/vice/anno-tools.ts:270-274] — `enum: ["line", "side"]`, `'line' = comment on its own line before the instruction. 'side' = inline comment on the same line.` |
| Confidence grade (a comment *prefix*, not a column) | `[confirmed-code]`, `[probable-code]`, `[confirmed-data]`, `[probable-data]`, `[unknown]` | [VERIFIED: src/mcp/vice/anno-confidence.ts:81-114] — `CONFIDENCE_GRADES`, five entries, each `{ token, bracket, phrase }` |
| Label kind | `"User"`, `"Auto"`, `"System"` (and `"Platform"`, accepted as a synonym of `System` by the census) | [VERIFIED: src/mcp/vice/anno-coverage.ts:206] — `/** `LabelKind`'s Debug form: `"User"`, `"Auto"` or `"System"`. */`; and `anno-coverage.ts:1430` — `if (kind === "System" \|\| kind === "Platform") {` |
| Auto-name prefixes (11) | `zpf_`, `f_`, `zpa_`, `a_`, `p_`, `zpp_`, `e_`, `j_`, `s_`, `b_`, `r_` | [VERIFIED: src/mcp/vice/anno-coverage.ts:1392] — `export const AUTO_NAME_PREFIX_RE = /^(zpf_\|f_\|zpa_\|a_\|p_\|zpp_\|e_\|j_\|s_\|b_\|r_)/;` |

The `AUTO_NAME_PREFIX_RE` count is **11**, matching `EXPORT-02`'s figure exactly.
`ROADMAP.md`'s warning that a five-prefix reimplementation would break
`routine-queue-walker`'s backlog construction is therefore verified against the real
regex, not assumed. **Phase 28 must not restate these 11 prefixes**; the store's
label-kind field is what separates namespaces, and the prefix regex stays where it is.

### The label namespace and legality rules, verbatim

[VERIFIED: src/mcp/vice/anno-tools.ts:246-251]:

> `"The label name (e.g. 'init_screen', 'loop_start'). Must be a legal ACME identifier: starts with a letter or underscore, followed by letters/digits/underscores only, and must not be a 6502/6510 mnemonic (e.g. 'LDA'). An illegal name is REJECTED, never sanitized or quoted."`

So `ROADMAP.md`'s "reject label collisions, never sanitise" is already this project's
documented contract, in the shipped schema. Two things the planner must add that the
schema text does **not** give:

1. The mnemonic denylist. Do **not** hand-type it: `disasm-opcodes.ts`'s `OPCODES`
   array is all 256 opcodes with a lowercase `mnemonic` field
   [VERIFIED: src/mcp/vice/disasm-opcodes.ts:183-189, 207-215], so the denylist is
   `new Set(OPCODES.map(o => o.mnemonic))` — derived, non-vacuous, and automatically
   covers the illegal-opcode mnemonics (`slo`, `lax`, `jam`, …) that a hand-typed
   56-entry list would miss. Compare case-insensitively: `LDA`, `lda` and `Lda` are
   all illegal.
2. The collision refusal. `init screen` → `init_screen` is the named hazard; the rule
   is that an illegal character **refuses**, so no normalisation step exists that
   could collide. Additionally refuse a *legal* name already bound to a different
   address — that is the second, non-obvious collapse.

## The Named Boundary Phase 27 Left Half-Open

This is the single most important codebase finding for the planner, and it is
**two** findings.

### (a) `block-class.ts` will silently misclassify everything the new store emits

`blockClassAt` [VERIFIED: src/mcp/vice/block-class.ts:126-137]:

```typescript
export const blockClassAt: BlockClassifier = (blocks, address) => {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) {
      if (block.type === "Code") return "code";
      if (block.type === "Undefined") return "undefined";
      return "data";
    }
  }
  return null;
};
```

Its header states the design rationale it now undermines
[VERIFIED: src/mcp/vice/block-class.ts:32-35]:

> `// The neutral classes are LOWERCASE on purpose. The store's vocabulary is`
> `// capitalised, so a comparison site left behind somewhere else cannot`
> `// accidentally still agree -- it gets a different answer and moves a`
> `// measured number, loudly.`

The premise is that the store's spelling is **capitalised**. It was — anno's Rust
`Display` emits `Code`/`Undefined`/`Byte`. The vocabulary read off
`anno_set_data_type` is **lowercase**. So a new store returning `type: "code"` hits
neither branch and falls through to `"data"`, and the census's whole code/data axis
collapses to data. **Nothing currently red-flags this**: `block-class.test.ts`
hard-codes `const STORE_CODE = "Code"` at line 34, deliberately, so "a silent change
to the mapping cannot silently change its own test". A correct store plus a
correct-looking guard, and the measured coverage number moves.

Phase 28 must therefore, in the same phase:

1. change the two literals in `blockClassAt` to the new store's spellings; **and**
2. add a cross-check that fails if the store's vocabulary and `block-class.ts`'s
   expectation diverge again.

For (2), note the hard constraint: **`block-class.ts`'s import list is asserted
EMPTY** [VERIFIED: src/mcp/vice/block-class.test.ts:186-191] — it may not import
`anno-types.ts`. The cross-check must live in a **test**, which may import both. The
correct shape: a test that iterates the store's frozen 12-member vocabulary and
asserts `blockClassAt` returns `"code"` for exactly `code`, `"undefined"` for exactly
`undefined`, and `"data"` for the other ten. That is total, derived from the
vocabulary, and it goes red the moment either side drifts.

**Also update `block-class.ts`'s header.** The lowercase-distinctness argument
becomes false when both vocabularies are lowercase, and leaving a false rationale in
a seam header is exactly what this project's comment convention exists to prevent.
The honest replacement rationale: the mapping is now pinned by a derived total
cross-check rather than by spelling distinctness.

### (b) The label-kind vocabulary was never extracted at all

`SEAM-03` claims `anno-coverage.ts`'s store contact is "reduced to a named,
repointable boundary — measured as two functions comparing against upstream's Rust
`Display` strings". That measurement covered the **block-type** comparisons. The
**label-kind** comparisons are still inline, at four sites
[VERIFIED: src/mcp/vice/anno-coverage.ts:1430, 1432, 1869, 2180]:

```
1430:    if (kind === "System" || kind === "Platform") {
1432:    } else if (kind === "User") {
1869:    if (s && typeof s.name === "string" && String(s.kind ?? "") === "User") nameByAddress.set(s.address, s.name);
2180:    if (sym && String(sym.kind ?? "") === "User") seeds.add(sym.address);
```

Lines 1869 and 2180 are the dangerous ones: a store emitting `kind: "user"` makes
`nameByAddress` empty and `seeds` empty. The `COV-01`/`COV-02` boundary test does not
cover this — it rewrites **block** entries to a single type
[VERIFIED: src/mcp/vice/anno-coverage.test.ts:616] — `const oneType: BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];`.

**Two dispositions, and the planner must pick one explicitly:**

- **Cheap (recommended):** have the store emit label `kind` as `"User"` / `"Auto"` /
  `"System"` verbatim — the census's existing spelling — and add a derived
  cross-check test the way (a) does. Costs one design asymmetry (block types
  lowercase, label kinds capitalised) which must be written down as a decision, not
  left as an accident.
- **Thorough:** extract a `labelKindClassAt`-shaped second boundary and repoint all
  four sites. Larger diff, discharges `SEAM-03`'s claim properly, and is the honest
  reading of "the store's contact is one boundary".

Either way this must be a **named task with a test**, because the failure mode is a
measured number silently moving to zero.

## `node:sqlite` On The Pinned Node Line — Measured, Not Read

Everything in this section was produced by running code on this host, not from docs.

| Fact | Value | Provenance |
|---|---|---|
| Host Node | `v22.22.0` | [VERIFIED: `node --version`] |
| Declared floor | `">=22.18.0"` | [VERIFIED: src/mcp/vice/package.json:29-31] |
| Bundled SQLite | `3.50.4` | [VERIFIED: `select sqlite_version()`] |
| Module exports | `DatabaseSync`, `StatementSync`, `backup`, `constants`, `default` | [VERIFIED: `Object.keys(require("node:sqlite"))`] |
| `DatabaseSync.prototype` | `aggregate, applyChangeset, close, constructor, createSession, enableLoadExtension, exec, function, loadExtension, location, open, prepare` | [VERIFIED: `Object.getOwnPropertyNames(DatabaseSync.prototype)`] |
| `StatementSync.prototype` | `all, columns, get, iterate, run, setAllowBareNamedParameters, setAllowUnknownNamedParameters, setReadBigInts, setReturnArrays` | [VERIFIED: same probe] |
| `Session.prototype` | `changeset, close, patchset` | [VERIFIED: `db.createSession()` probe] |
| `run()` return shape | `{ lastInsertRowid, changes }` | [VERIFIED: observed `{"lastInsertRowid":1,"changes":1}`] |
| Compile options present | `ENABLE_FTS3`, `ENABLE_FTS3_PARENTHESIS`, `ENABLE_FTS5`, `ENABLE_RTREE`, `ENABLE_SESSION` | [VERIFIED: `pragma_compile_options()`] |
| Default journal mode | `delete` | [VERIFIED: `pragma journal_mode` on a fresh db] |
| Default `synchronous` | `2` (FULL) | [VERIFIED: `pragma synchronous`] |
| Constructor options accepted | `open`, `readOnly`, `timeout`, `enableForeignKeyConstraints`, `allowExtension`, `enableDoubleQuotedStringLiterals` | [VERIFIED: probe] |
| Unknown constructor options | **silently accepted**, no throw | [VERIFIED: `{nonsenseOption:1}` opened fine] |
| Double-quoted string literals | **disabled by default** — `insert into t values ("a")` throws `no such column: "a" - should this be a string literal in single-quotes?` | [VERIFIED: probe] |
| Valid specifier | only `node:sqlite`; bare `sqlite` fails `ERR_MODULE_NOT_FOUND` / `MODULE_NOT_FOUND` | [VERIFIED: probe] |
| Access routes | static `import`, dynamic `import()`, `createRequire()(...)`, `process.getBuiltinModule("node:sqlite")` — all four work | [VERIFIED: probe] |
| `ExperimentalWarning` | emitted unconditionally on first load: `SQLite is an experimental feature and might change at any time` | [VERIFIED: probe] |
| TypeScript type-stripping warning | **none** on 22.22 — `node:sqlite` would be the tree's **first and only** `ExperimentalWarning` | [VERIFIED: ran a `.ts` file and a `node --test` file, no warning either time] |
| Warning suppression | `--disable-warning=ExperimentalWarning` and `NODE_OPTIONS=--disable-warning=ExperimentalWarning` both silence it completely | [VERIFIED: probe] |

### The revert mechanism: what is actually available

**`sqlite3changeset_invert` is not exposed.** `Session` has exactly
`changeset`/`patchset`/`close`; there is no `invert` on the session, on
`DatabaseSync`, or on the module. `REQUIREMENTS.md`'s `D2` is **correct on that
narrow claim** and its conclusion (whole-store snapshot/restore) stands.

But `D2`'s prose invites a wrong inference, and a planner reading it will make it:
**the session extension itself IS present and functional.** `ENABLE_SESSION` is
compiled in; `db.createSession()` → `session.changeset()` returns a `Uint8Array`
(20 bytes for a one-row insert) and `db.applyChangeset(cs)` returned `true` and
replayed the row into a second database [VERIFIED: probe]. `constants` carries the
eight `SQLITE_CHANGESET_*` conflict codes. So changesets are available for **forward
replay**, and only inversion is missing. Do not build on this — there is no consumer
— but do not let a plan claim "node:sqlite has no session support" either.

**Three real revert routes, measured on this host (ext4/nvme, `/home`):**

| Route | Cost | Verdict |
|---|---|---|
| `db.exec("vacuum into '<path>'")` — synchronous, one statement, whole-store snapshot | **6.32 ms** for a 32 KB store; 2.22 ms for 180 KB on tmpfs | **Recommended.** Synchronous, no async plumbing in the write path, honours `D2` exactly |
| `await backup(db, path)` — async, returns page count (`44` observed) | 1.13 ms on tmpfs | Works, but forces the write path async for no gain |
| A per-edit inverse-command journal | — | **Out of scope** (`D2`, `## Out of Scope` in REQUIREMENTS.md) |

### Durability and revert, proven by running it

Default `delete` journal mode plus `synchronous=FULL` survives `SIGKILL` with no
clean close. Observed, in a fresh process, four ways
[VERIFIED: `~/.cache/gsd-probe/dur/`, `~/.cache/gsd-probe/j2/`]:

| Sequence | Readback after `SIGKILL` + fresh-process reopen |
|---|---|
| `delete` journal, `begin immediate` → insert → **`commit`** → `SIGKILL` | row present |
| `delete` journal, `begin immediate` → insert → **no commit** → `SIGKILL` | `[]` — rolled back |
| WAL, insert → **`commit`** → `SIGKILL` | row present |
| WAL, insert → **no commit** → `SIGKILL` | `[]` — rolled back |
| previously-committed row, then a *different* transaction killed mid-flight | previously-committed row **intact**; the killed one gone |

Sidecars, precisely [VERIFIED: `~/.cache/gsd-probe/j2/`]:

- clean create/commit/close in `delete` mode → **one file**, no sidecar
- `SIGKILL` mid-transaction in `delete` mode → a `<db>-journal` hot journal appears
- the next open **rolls it back and deletes it** — back to one file
- WAL mode → `<db>-wal` and `<db>-shm` appear and persist through a `SIGKILL`, removed on the next clean open

**Then I ran criterion 4's exact sequence.** A ~90-line prototype
(`~/.cache/gsd-probe/c4/store.mjs`, `mutate.mjs`, `combined.mjs`) with a
`{ noCommit }` flag at the single `COMMIT` site:

```
[commit]    revision=1 readBackByValue=true  revertReturnsPriorValue=true  -> TEST GREEN
[no-commit] revision=0 readBackByValue=false revertReturnsPriorValue=false -> TEST RED
            (AnnoStoreError: no snapshot recorded for revision 0 -- cannot revert)
```

[VERIFIED: `node combined.mjs` on this host, 2026-08-27]

**Both halves of the same test go red from one planted violation.** That is exactly
what `STORE-04` demands and what `D1` chose SQLite over atomic-JSON for. The
mechanism that makes it one test rather than two: the snapshot **pointer row** is
inserted in the same transaction as the mutation, so removing the `COMMIT` destroys
the durability claim *and* the revert claim simultaneously.

Ordering inside `setDataType` matters and must be specified in the plan:

1. read the current revision;
2. refuse if the caller's `baseRevision` disagrees;
3. `vacuum into` the snapshot file (SQLite's own commit fsyncs it);
4. `begin immediate`;
5. revision CAS: `update anno_meta set revision = revision + 1 where id = 1 and revision = ?` — `changes !== 1` → rollback and refuse;
6. insert the snapshot pointer row;
7. apply the mutation;
8. `commit`.

A `SIGKILL` between 3 and 8 leaves an orphan snapshot file, which is harmless and
reconcilable by revision. The reverse order (mutate then snapshot) is **wrong** and
is worth a comment: it would make a kill in the window produce a durable mutation
with no snapshot, i.e. an unrevertible edit.

### Truncation: `node:sqlite` will NOT refuse for you

Measured on real store files [VERIFIED: `~/.cache/gsd-probe/dur/trunc.mjs`, `~/.cache/gsd-probe/c4/extras.mjs`]:

| Truncation | Raw `node:sqlite` behaviour | With the store's own meta-row check |
|---|---|---|
| **0 bytes** | **OPENS.** `pragma integrity_check` → `ok`. `sqlite_master` → `[]`. `user_version` → `0`. Reads as a pristine empty database | **REFUSED** (`AnnoStoreCorruptError`) |
| ~50% | throws `database disk image is malformed` (`errcode 11`) | REFUSED |
| 100 bytes off the tail of a 12 KB db | **OPENS and returns the correct rows**; `integrity_check` reports `Fragmentation of 1 bytes reported as 0 on page 3` and `row 1 missing from index sqlite_autoindex_t_1` | **OPENS** (meta row is intact) — closed only by `integrity_check` |

`ROADMAP.md`'s "a store file truncated between kill and reopen is **refused**, never
returned partial" is therefore **true for a mid-file truncation and false for a
zero-length one** — and the zero-length case is the dangerous one, because "no
annotations" and "your annotations are gone" become indistinguishable.

**Design consequence, mandatory:** the store owns its refusal. At open, on an
existing file, `select schema_version, revision from anno_meta where id = 1` — a
throw or a missing row is `AnnoStoreCorruptError`, never an empty store. Add
`pragma integrity_check` at open too: measured at **0.73 ms** on a 100 KB /
5,000-row store, and it is the only thing that catches the tail-truncation case. A
mismatched `schema_version` refuses as well.

### The optimistic-concurrency refusal, across two OS processes

Run for real: process A reads revision, process B (`execFileSync` → a genuinely
separate `node` process) commits a mutation bumping the revision, then A attempts its
write with the stale base [VERIFIED: `~/.cache/gsd-probe/c4/extras.mjs`]:

```
stale write REFUSED: AnnoStoreStaleRevisionError base=1 current=2
rows now: [{"start":4096,...,"data_type":"byte"},{"start":8192,...,"data_type":"word"}]
```

B's row survived; A's write was refused, not merged and not silently dropped. Two
mechanisms both work and the CAS is the one to use:

- **`update ... where revision = ?` + `changes !== 1`** — atomic inside
  `begin immediate`, gives the actual current revision for the error message, and is
  the *enforcement*.
- **`pragma data_version`** — observed moving `1 → 2` after B's commit. Useful as a
  cheap "did anything change" probe, but it is a *detector*, not an enforcement
  point, and it does not tell you what changed. Do not build the refusal on it.

Use `{ timeout: N }` on the constructor so a genuinely concurrent writer waits rather
than failing `SQLITE_BUSY` immediately; the CAS still refuses a stale base afterwards.

### Per-edit write cost, honestly

Measured on **real disk** (`/home`, ext4 on nvme), 200 single-edit transactions each
with the revision CAS [VERIFIED: `~/.cache/gsd-probe/disk.mjs`]:

| Journal mode | ms/edit |
|---|---|
| `delete` (default) | **6.24** |
| WAL | **2.26** |
| `delete`, on tmpfs | 0.13 |

`REQUIREMENTS.md`'s `1.16 ms` figure is reachable in WAL or on tmpfs; on a real disk
in the default mode it is ~6 ms. Both are irrelevant to an agent making tens to
hundreds of edits, and `D1`'s reasoning was explicitly *not* on the performance
margin. **Recommendation: stay in the default `delete` mode.** It is single-file at
rest, it survives `SIGKILL` identically (proven above), and it avoids the `-wal`/
`-shm` sidecar surface entirely. Revisit only if a measured need appears.

## The Structural Single-Seam Assertion (STORE-07)

Three existing structural guards, all touched in Phase 27, are the templates. They
differ in **which set they scan** and that difference is load-bearing.

| Guard | Scanned set | Stripper |
|---|---|---|
| `hostpath-consumers.test.ts` | `readdirSync(HERE)` filtered to `.ts`/`.mts` minus `*.test.*` — a **local** `topLevelProductionModules()` [VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:124-127] | its own local `stripCommentLines()` (comments only) |
| `spawn-seam.test.ts` | `shippedTsModules()` — `package.json` `files[]` filtered to `.ts`/`.mts` [VERIFIED: src/mcp/vice/spawn-seam.test.ts:53, 183] | `codeOnly()` from `shipped-modules.ts` |
| `comment-phase-pointers.test.ts` | `shippedTsModules()` [VERIFIED: src/mcp/vice/comment-phase-pointers.test.ts:53-55, 74] | its own inverted comment extractor |

`shippedTsModules()` **throws** `ShippedFilesEntryMissingError` when a `files[]` entry
is not on disk, deliberately, so the scanned set cannot silently shrink
[VERIFIED: src/mcp/vice/shipped-modules.ts:151-162]:

```typescript
export function shippedTsModules(dir: string = HERE): string[] {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
```

**`STORE-07` says "asserted structurally over the shipped module set" — so use
`shippedTsModules()`, not `readdirSync`.** That has a hard precondition: the three
new modules must be added to `package.json`'s `files[]` **in Phase 28**, or the
assertion scans a set that excludes the one importer and passes vacuously. Adding
them is safe (see `## Common Pitfalls` P-9).

### The detector must catch four routes, one more than the hostpath guard covers

The hostpath guard uses two regexes [VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:50, 60]:

```typescript
const HOSTPATH_IMPORT_RE = /^\s*import\s[^;]*from\s+"\.\/hostpath\.(ts|mts|mjs)"/m;
const HOSTPATH_DYNAMIC_IMPORT_RE = /import\s*\(\s*["'][^"']*\/hostpath\.(ts|mts|mjs)["']\s*\)/;
```

`node:sqlite` has **four** working access routes, all verified live: static `import`,
dynamic `import()`, `createRequire(...)("node:sqlite")`, and
`process.getBuiltinModule("node:sqlite")`. Reproducing the two-regex idiom would miss
the last two.

**Use the simpler and strictly stronger form instead.** Because only the literal
specifier `node:sqlite` works (bare `sqlite` fails `ERR_MODULE_NOT_FOUND` /
`MODULE_NOT_FOUND` — verified), a single substring test over source that has had
**comments stripped but string-literal bodies kept** catches all four routes at once.
`codeOnly()` has exactly that mode, and its doc comment says it exists for precisely
this caller shape [VERIFIED: src/mcp/vice/shipped-modules.ts:198-205]:

> `` `keepLiteralBodies` exists for the one caller shape that needs the opposite: an import-specifier assertion, where the thing being read IS a string, so blanking literal bodies would make it unobservable.``

So: `codeOnly(readFileSync(f, "utf8"), true)` then `/node:sqlite/.test(...)`. Comments
that *discuss* `node:sqlite` (every new module header will) are stripped and
correctly ignored — and that is the negative control the test must also assert.

### The non-vacuity pairing, copied from the real thing

[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:143-150]:

```typescript
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];

test("hostpath.ts's production consumer set is exactly the five declared modules", () => {
  const importers = hostpathImporters();
  assert.deepEqual(importers, EXPECTED_IMPORTERS);
  assert.equal(importers.length, 5);
```

Both halves matter: `deepEqual` catches the wrong name, `length` catches a broken
glob returning `[]`. The `node:sqlite` version is
`assert.deepEqual(importers, ["anno-store.ts"]); assert.equal(importers.length, 1);`
plus three planted-violation cases, mirroring
`hostpath-consumers.test.ts:220-260` exactly:

1. a synthetic source with a static `import { DatabaseSync } from "node:sqlite";` → reported;
2. a multi-line static import, and a `await import("node:sqlite")`, and a `process.getBuiltinModule("node:sqlite")` → each reported;
3. a control whose *only* mentions of `node:sqlite` are inside a `//` comment and inside a string literal that is not a specifier → **not** reported. This is the half that keeps the detector from degenerating into a substring search over the whole file, and it is non-trivial here because the detector deliberately keeps literal bodies. Note the tension and resolve it explicitly: the control's string literal must not be a bare `"node:sqlite"` (that would be indistinguishable from a `getBuiltinModule` argument), so use e.g. `'the node:sqlite seam'` embedded in a sentence and match on the specifier in an access position rather than on the bare substring — or accept the wider match and drop the string-literal half of the control, stating which.

That last point is a genuine design decision, not a detail: the planner must choose
between a *wider* detector with a *weaker* control and a *narrower* detector with a
*stronger* control, and say which, because it is exactly the trade the hostpath guard
records having made in the other direction.

## The Cross-Validation Oracle (STORE-03 / criterion 2)

"A second, independently written implementation" concretely means: two functions in
the same test that compute the same answer by **different algorithms**, neither
calling the other.

- **Oracle A (production):** a paint array. `new Int32Array(65536).fill(-1)`, rows
  sorted **longest-first** with equal-length ties ordered by ascending id, then each
  row painted over its span. Narrowest-wins falls out because a shorter row is
  painted later; the tie-break falls out because the higher id is painted last. O(sum
  of span lengths) to build, O(1) to look up.
- **Oracle B (test-only):** for one address, a linear scan over all rows keeping the
  smallest span, breaking ties on the higher id. O(rows) per address, no array, no
  sort, and its comparison is written as an explicit `if (lr < lb || (lr === lb && r.id > best.id))` rather than being derived from a sort order.

They share no code path. Measured on this host, 2,000 synthesized ranges with heavy
overlap across the full 64K [VERIFIED: `~/.cache/gsd-probe/paint.mjs`]:

| Measurement | Value |
|---|---|
| Paint build | **8.56 ms** |
| **Exhaustive 65,536-address cross-validation** | **279 ms** |
| Disagreements | **0** |
| 65,536 paint lookups alone | 1.30 ms |

**279 ms is fine for the normal automated suite.** No `MANUAL_ONLY_TESTS` entry is
needed, no sampling, no `--test-only` gate. A realistic store (hundreds of ranges,
not 2,000) will be well under 50 ms. Do not weaken the exhaustive loop to a sample —
`STORE-03` says "rather than by spot checks" and the measurement says it is
unnecessary.

**Four things must be pinned separately, because the exhaustive loop can be green
while any of them is wrong** (a fixture with no range touching `$0000` or `$FFFF`
makes both oracles agree on `-1` there):

| Pin | Assertion |
|---|---|
| `$FFFF` boundary | a range ending at `0xFFFF` resolves at `0xFFFF`, and the paint loop's `a <= r.endInclusive` does not run off the array |
| Both range ends inclusive | `start - 1` and `endInclusive + 1` resolve to a **different** row (or `-1`), and `start` and `endInclusive` resolve to **this** row |
| Length 1 | a `$0400-$0400` range reports length **1** — `endInclusive - start + 1`, the off-by-one criterion 2 names explicitly |
| The tie-break | two rows of **equal** length covering the same address resolve to the specified one, deterministically, and reversing their insertion order flips the answer |

The tie-break pin needs overlapping rows in the index, which the store's write path
(split-and-preserve, `STORE-02`) is designed to prevent. **That is fine and is the
reason `anno-index.ts` must be a pure module taking rows as an argument:** the test
feeds overlapping rows straight in. If narrowest-wins lived inside `anno-store.ts`
behind the write path, this pin would be unreachable and criterion 2's "tie-break
pinned" clause unsatisfiable.

## Planted-Violation Reddenability, Criterion By Criterion

Every planting below was checked for actual reddenability, not assumed.

### Criterion 1 — collapse the four split members to one `table`

**The control:** a fixture with a known `lo_hi_address` table, typed as
`hi_lo_address`, produces a **differing resolved-target set**. Verified arithmetically
on a 4-entry table at `$C000` with bytes `10 34 00 ff 08 12 c0 cf`
[VERIFIED: `node -e` computation, 2026-08-27]:

```
lo_hi_address targets: $0810 $1234 $c000 $cfff
hi_lo_address targets: $1008 $3412 $00c0 $ffcf
sets differ: true
```

**Why the planting reddens:** collapsing to one `table` type means orientation is not
recorded, so only one target set can be produced and the differing-set assertion has
nothing to differ from. **Confirmed.**

**Why `ROADMAP.md` is right that reassembly cannot be the control:** the bytes never
change under a retype, so a byte-identical reassembly assertion is green under both
orientations. Do not write it as the control. (It is still worth having as a
*separate* assertion for a different reason — it catches an exporter that mangles
bytes — but it must not be presented as criterion 1's evidence.)

**Fixture requirement the plan must state:** choose the bytes so the two orientations
genuinely differ. A table whose lo and hi halves are byte-identical (or a 1-entry
table with lo == hi) makes the control vacuous. Assert the fixture's non-degeneracy
in the test itself.

**Second axis, needed to justify four members rather than two:** `address` creates
xrefs and `word` does not [VERIFIED: src/mcp/vice/anno-tools.ts:307-308]. Assert
that `lo_hi_address` and `lo_hi_word` over the same bytes differ in xref production.
Without this, a reviewer can correctly object that two members would do.

### Criterion 3 — `filter()`-and-insert in place of split; removing the contradicted-comment check

**Planting A: `filter()`-and-insert.** The assertion is that **total typed bytes are
unchanged across all five overlap cases**. The five cases, enumerated so none is
missed:

| Case | Existing `[a,b]`, new `[c,d]` | Correct result |
|---|---|---|
| 1. identical | `c == a && d == b` | one row, retyped |
| 2. new fully contains existing | `c <= a && d >= b` | one row, retyped; existing gone |
| 3. new fully **inside** existing | `a < c && d < b` | **three** rows: `[a,c-1]` old type, `[c,d]` new, `[d+1,b]` old type |
| 4. overlap at the low end | `c <= a && a <= d < b` | `[c,d]` new, `[d+1,b]` old |
| 5. overlap at the high end | `a < c <= b && d >= b` | `[a,c-1]` old, `[c,d]` new |

`filter()`-and-insert (delete every overlapping row, insert the new one) gets cases 1,
2, 4 and 5 accidentally right on the *total-bytes* metric and **loses bytes in case
3** — it drops `[a,c-1]` and `[d+1,b]` entirely. So the planting reddens **only via
case 3**, exactly as `ROADMAP.md` says ("makes the fully-contained case fail").
**Confirmed reddenable — but only if case 3 is present.** The plan must name case 3
explicitly as the load-bearing case; a five-case table with case 3 written weakly
(e.g. `c == a`, which is really case 4) makes the planting green.

**Planting B: remove the contradicted-comment check.** The assertion is that a retype
contradicting an existing comment returns the contradicted comments **as data** (not
an error, not a refusal). Removing the check makes the call return clean success —
which is the red.

**The contradiction rule already exists in this repo and must be reused, not
invented.** `anno-confidence.ts` owns the five-grade vocabulary and
`parseConfidencePrefix()` [VERIFIED: src/mcp/vice/anno-confidence.ts:81-114, 175].
The rule falls out of it:

- a comment graded `[confirmed-code]` or `[probable-code]` at an address being
  retyped to any of the ten non-`code` members is contradicted;
- a comment graded `[confirmed-data]` or `[probable-data]` at an address being
  retyped to `code` is contradicted;
- `[unknown]` and an ungraded comment are never contradicted.

Note `parseConfidencePrefix()` **throws** `AnnoConfidenceGradeError` on a bracket
token that is not exactly one of the five, deliberately, so an unparseable prefix is
not silently treated as ungraded. The store must not swallow that.

**Two consequences the planner must record:** (1) `anno-confidence.ts` still carries
the `anno` prefix and is renamed in **Phase 32**, so a Phase-28 import of it becomes
a Phase-32 edit — acceptable, but it must be on Phase 32's enumerated task list, not
discovered there. (2) `AnnoConfidenceGradeError extends Error`, **not** `ViceError`
[VERIFIED: src/mcp/vice/anno-confidence.ts:139] — so the store's own errors cannot
be caught by a single `catch (e) { if (e instanceof ViceError) }` if this one escapes.
Either wrap it or state the asymmetry.

### Criterion 4 — remove the commit

**Verified by running it** (see `## Durability and revert, proven by running it`).
Both halves of the one combined test go red. The only subtlety: the redness must come
from the *store*, not from the test harness. In my prototype the revert half failed
with `AnnoStoreError: no snapshot recorded for revision 0 -- cannot revert`, i.e. a
named domain error rather than an assertion — so the test must assert the **values**,
not merely that no throw occurred, or a `try/catch` in the test could absorb the red.
Assert `readBackByValue === true` and `revertReturnsPriorValue === true` as
booleans computed outside any `try`.

**Harness requirements for this one test**, all of which are real:

- The mutating process must be a **genuinely separate OS process** that is
  `SIGKILL`ed. `process.kill(process.pid, "SIGKILL")` from inside a child spawned via
  `execFileSync` works and is what I used; `execFileSync` throws on the non-zero
  status (137), which must be caught and ignored.
- The reopening process must not be the mutator. In-process reopen of the same
  `DatabaseSync` would prove nothing.
- The store file must live in a `mkdtempSync` directory removed in a `finally`. See
  `## Common Pitfalls` P-7: `/tmp` on this host is a 16 GB tmpfs whose cleanup is
  disabled.
- `stdio: "pipe"`, never `"inherit"`, so the child's `ExperimentalWarning` does not
  pollute the parent's TAP stream.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` (`DatabaseSync`) | built-in, SQLite **3.50.4** on Node **22.22.0** | The whole persistence layer | A Node builtin, unflagged since v22.13.0 and therefore unconditional at this project's `>=22.18.0` floor. `ENGINEERING_RULES.md` §4's dependency bar is not triggered. Chosen by `D1` on evidence grounds: its planted violation (drop the `COMMIT`) reliably reddens, which I re-verified rather than took on trust [VERIFIED: probe] |
| `node:test` + `node:assert/strict` | built-in | Every test | The tree's only test framework: `"test": "node --test '*.test.*'"` [VERIFIED: src/mcp/vice/package.json scripts] |
| `Int32Array` | built-in | The 64K paint array | 256 KB, `fill(-1)`, O(1) lookup. 65,536 lookups in 1.30 ms measured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` (`mkdtempSync`, `renameSync`, `fsyncSync`, `copyFileSync`) | built-in | Snapshot restore, test temp dirs | The revert path replaces the store file by `rename` after an `fsync` of both the temp file and its directory |
| `ViceError` from `./vice.ts` | in-repo | Base class for all new named errors | Established by ~14 existing modules [VERIFIED: grep for `extends ViceError`] |
| `OPCODES` from `./disasm-opcodes.ts` | in-repo | Derive the mnemonic denylist for label legality | Never hand-type the mnemonic list |
| `CONFIDENCE_GRADES` / `parseConfidencePrefix()` from `./anno-confidence.ts` | in-repo | The comment-contradiction rule | Reuse; do not reinvent |
| `codeOnly()` / `shippedTsModules()` from `./shipped-modules.ts` | in-repo, **test-only** | The `STORE-07` structural assertion | `keepLiteralBodies = true` for an import-specifier scan |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:sqlite` | `better-sqlite3` 13.0.3 | Ruled out in `REQUIREMENTS.md` `## Out of Scope`: 11.4 MB unpacked per consumer and a hard `MODULE_NOT_FOUND` off its eight prebuild targets. Not reopened |
| `node:sqlite` | atomic-JSON + `fsync` | Ruled out by `D1` on the *evidence* axis, not performance: its planted violation (remove the `fsync`) frequently still passes because the page cache serves the read. Not reopened |
| An owned paint array | any interval-tree package | Ruled out in `REQUIREMENTS.md` `## Out of Scope` (all six surveyed packages return every overlap with no narrowest-wins tie-break; one has no licence field) [CITED: .planning/REQUIREMENTS.md:197]. My own measurement supports keeping it owned: 8.56 ms to build over 2,000 rows, 1.30 ms for 65,536 lookups |
| `vacuum into` for snapshots | `await backup(db, path)` | `backup()` is async (1.13 ms on tmpfs, returned page count `44`). Forces the write path async for no benefit |
| FTS5 for search | `LIKE 'prefix%'` with an index | **Defer to Phase 29** — `STORE-06` is Phase 29's. Measured on a 20,000-row table: indexed `LIKE 'prefix%'` **2.02 ms**, unindexed infix `LIKE '%x%'` full scan **4.49 ms**, FTS5 `MATCH` **2.99 ms** but with a **121.8 ms** rebuild [VERIFIED: `~/.cache/gsd-probe/fts.mjs`]. At annotation-store row counts (hundreds to low thousands) `LIKE` wins on every axis. **Phase 28 must not create an FTS5 virtual table** — adding one in Phase 29 is a purely additive migration; removing one is not |
| WAL journal mode | default `delete` | WAL is 2.26 vs 6.24 ms/edit on real disk but adds `-wal`/`-shm` sidecars that persist through a `SIGKILL`. Durability across `SIGKILL` is identical (both proven). Stay on the default |

**Installation:**

```bash
# Nothing to install. node:sqlite is a Node builtin at this project's floor.
node --version   # must be >= 22.18.0; this host: v22.22.0
```

## Package Legitimacy Audit

**No external packages are installed by this phase.** The persistence layer is a
Node builtin (`node:sqlite`), the test framework is a Node builtin (`node:test`), and
every in-repo import is a relative path inside `src/mcp/vice/`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`better-sqlite3` and the six interval-tree packages were surveyed and rejected in
prior milestones' research and are recorded in `REQUIREMENTS.md`'s
`## Out of Scope`; none is installed, so none needs a legitimacy verdict here. If a
plan proposes any npm install, that is a scope change and the legitimacy gate must be
run before it lands.

## Architecture Patterns

### System Architecture Diagram

```
        A Claude session                          (Phase 29 — NOT this phase)
               │
               ▼
     ┌───────────────────────┐   registers via buildViceTool() at
     │  vice-proxy.ts        │   vice-proxy.ts:3263 — never enters
     │  (stdio MCP)          │   forwardToVice(), so rewriteArguments()
     └───────────┬───────────┘   at :3052 / :1531 never sees a store path
                 │  args arrive UNVALIDATED
                 │  (rawJsonSchemaAsStandardSchema's
                 │   validate: (value) => ({ value })  — vice-proxy.ts:3230)
                 ▼
    ════════════ PHASE 28 STARTS HERE ════════════
                 │
                 ▼
     ┌──────────────────────────────────────────┐
     │ anno-types.ts                            │
     │  • DATA_TYPES (frozen, 12 members)       │
     │  • row types: range/label/comment/       │
     │    scope/enum/xref  (endInclusive!)      │
     │  • parseStoreAddress()  ← integer | $hex │
     │    | 0xhex ; UNPREFIXED NUMERIC STRING   │
     │    REFUSED (diverges from                │
     │    stock-address.ts:155 — see C-4)       │
     │  • assertLegalLabel()  ← denylist from   │
     │    disasm-opcodes.ts OPCODES             │
     │  • ViceError subclasses (named)          │
     └───────┬───────────────────────┬──────────┘
             │ types + validators    │ types only
             ▼                       ▼
  ┌────────────────────┐   ┌──────────────────────────────────┐
  │ anno-index.ts      │   │ anno-store.ts                    │
  │ PURE. no fs, no    │   │ ***THE ONLY MODULE IN THE TREE   │
  │ sqlite.            │   │    THAT NAMES node:sqlite***     │
  │                    │   │                                  │
  │ buildPaintIndex(   │◄──┤ open():                          │
  │   rows) →Int32Array│   │   fresh?  → DDL + meta row       │
  │ resolveAt(idx,addr)│   │   exists? → SELECT anno_meta     │
  │                    │   │             + integrity_check    │
  │ narrowest wins;    │   │             else REFUSE (corrupt)│
  │ tie → higher id;   │   │                                  │
  │ both ends incl.;   │   │ write(): 1 read rev              │
  │ rebuilt on every   │   │          2 CAS refuse if stale   │
  │ mutation, never    │   │          3 vacuum into snapshot  │
  │ incrementally      │   │          4 BEGIN IMMEDIATE       │
  │ maintained         │   │          5 rev CAS (changes==1)  │
  └────────────────────┘   │          6 snapshot pointer row  │
                           │          7 split-and-preserve    │
                           │          8 COMMIT ◄── planted    │
                           │                      violation   │
                           │ revert(): snapshot → tmp →fsync  │
                           │           → rename → fsync dir   │
                           └───────────┬──────────────────────┘
                                       │
                                       ▼
                            <project>.annostore   (container-side ONLY;
                                                   never through hostpath.ts)
                            snapshots/rN.db

    ─────── existing consumers Phase 28 must not break ───────

  block-class.ts ──► anno-coverage.ts census
   (two literals "Code"/"Undefined" must change to the new
    lowercase spellings; its import list stays EMPTY, so the
    store-vs-classifier cross-check lives in a TEST)

  anno-coverage.ts:1430/1432/1869/2180 — label-kind literals
   ("User"/"Auto"/"System"/"Platform") were NEVER extracted.
    Either the store emits those spellings verbatim, or a
    second boundary is extracted here.  ← named decision
```

### Recommended module layout

```
src/mcp/vice/
├── anno-types.ts        # vocabulary + row types + validators + errors  (in files[])
├── anno-types.test.ts   # vocabulary pinning, parser, label legality
├── anno-index.ts        # pure narrowest-wins paint index               (in files[])
├── anno-index.test.ts   # 65,536-address cross-validation + 4 pins
├── anno-store.ts        # THE node:sqlite seam                          (in files[])
├── anno-store.test.ts   # open/refuse, split-and-preserve, contradiction, CAS
├── anno-seam.test.ts    # STORE-07 structural assertion + 3 plantings
└── anno-durability.test.ts  # THE ONE combined SIGKILL+revert test
```

Naming: `anno-*` [ASSUMED — a discretion choice, not read off anything]. It satisfies
every hard constraint checked this session: no `anno` substring (Phase 32's gate);
outside `module-classification.test.ts`'s `startsWith("anno-")` enumeration
[VERIFIED: src/mcp/vice/module-classification.test.ts:72-78], so **no classification
entry is required and the planner should not invent one**; the prefix is a single
stable disk-derivable prefix as Phase 29's notes require; and no file of that name
exists (checked against the 200-entry directory listing). `annotation-*` also works
and is more legible; `store-*` does not, because it reads as a sibling of the
`stock-*` family.

### Pattern 1 — The frozen vocabulary as a single exported const

**What:** one `Object.freeze`d array in `anno-types.ts` is the only place the twelve
strings appear.
**When to use:** always. Every consumer — the validator, the split-table layout
logic, the `block-class.ts` cross-check test, the Phase 29 tool schema — derives from
it.
**Example** (shape follows `anno-confidence.ts:81-114`'s `CONFIDENCE_GRADES` and
`capability-registry.ts`'s typed-const idiom):

```typescript
// Source: shape from src/mcp/vice/anno-confidence.ts:81-114 (CONFIDENCE_GRADES);
//         member strings verbatim from src/mcp/vice/anno-tools.ts:291-304
export const DATA_TYPES = Object.freeze([
  "code", "byte", "word", "address", "petscii", "screencode",
  "lo_hi_address", "hi_lo_address", "lo_hi_word", "hi_lo_word",
  "external_file", "undefined",
] as const);
export type DataType = (typeof DATA_TYPES)[number];

/** The four split layouts, derived rather than re-typed. */
export const SPLIT_TYPES = Object.freeze(
  DATA_TYPES.filter((t) => t.startsWith("lo_hi_") || t.startsWith("hi_lo_")),
);
```

A test asserts `DATA_TYPES.length === 12` and `SPLIT_TYPES.length === 4`. The
non-vacuity matters: a typo collapsing a member would otherwise leave every
downstream `switch` silently narrower.

### Pattern 2 — Ranges as rows, index rebuilt (STORE-02)

**What:** `anno_range` rows are never merged, never coalesced, never compared for
adjacency. `buildPaintIndex(rows)` is called after every mutation and throws the old
array away.
**When to use:** always. Write **no** incremental-maintenance code — `ROADMAP.md`
says so and the measurement backs it: 8.56 ms to rebuild over 2,000 rows.
**Why this designs out the named blockers:** because adjacency is never consulted,
there is no merge, therefore no splitter primitive to introduce (`DECOMP-01`'s and
`BUILD-02`'s blocker) and no over-merge bias for `COV-01` to inherit. State this in
the module header as the *reason* the code is absent, or a later maintainer will add
a "nice" coalescing pass.

### Pattern 3 — `endInclusive`, never a bare `end`

**What:** every field, parameter, column and JSON key uses `endInclusive` (column
`end_inclusive`).
**Why:** `ROADMAP.md` names six conversion boundaries, five of which produce
plausible output when wrong. **Verified as a real hazard in this tree:**
`block-class.ts`'s `BlockEntry` uses `end_address` with both ends inclusive
[VERIFIED: src/mcp/vice/block-class.ts:130] and `anno_set_data_type`'s schema says
`"End of the memory region (inclusive), decimal."`
[VERIFIED: src/mcp/vice/anno-tools.ts:288] — the inclusivity is real but is carried
only in prose, in two different field names. The new name makes it carried by the
identifier. Add a test that the *string* `end_inclusive` appears in the DDL and that
no store row type exposes a bare `end`.

### Pattern 4 — Named `ViceError` subclasses, following the house constructor

The exact pattern [VERIFIED: src/mcp/vice/vice.ts:245-259]:

```typescript
export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

export class ViceError extends Error {
  code?: number | string;
  data?: unknown;

  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
```

and a subclass [VERIFIED: src/mcp/vice/vice.ts:283-290]:

```typescript
  constructor(message: string, { baselineEpoch, currentEpoch, where, lastToolCall }: MachineRestartedErrorOptions = {}) {
    super(message);
    this.name = "MachineRestartedError";
    this.baselineEpoch = baselineEpoch;
```

So: `interface XErrorOptions`, `class XError extends ViceError`, fields as plain
public properties, `super(message)` **without** forwarding options (the existing
subclasses do not forward, so `code`/`data` stay undefined), `this.name = "XError"`,
then assign. `import { ViceError, type ViceErrorOptions } from "./vice.ts";` is the
established specifier [VERIFIED: src/mcp/vice/stock-symbols.ts:56, stock-derived.ts:79,
stock-address.ts:35, stock-paths.ts:38 and ten more].

Suggested set, each carrying the evidence a caller needs to act:

| Error | Extra fields | Thrown when |
|---|---|---|
| `AnnoStoreError` | — | base for the family |
| `AnnoStoreCorruptError` | `path` | meta row absent/unreadable, `schema_version` mismatch, `integrity_check` not `ok` |
| `AnnoStoreStaleRevisionError` | `baseRevision`, `currentRevision` | the write CAS refuses |
| `AnnoTypeError` | `dataType`, `validTypes` | a `data_type` outside the twelve |
| `AnnoAddressError` | `input`, `what` | address/range parse or range failure, incl. the unprefixed-numeric-string refusal |
| `AnnoLabelError` | `name`, `reason` | illegal identifier, mnemonic collision, or an existing binding at another address |
| `AnnoRangeShapeError` | `start`, `endInclusive` | `endInclusive < start`, out of `0..0xFFFF`, or an odd byte count on a split type |

`vice.ts` imports only `repo-root.ts` and `container-guard.mts`
[VERIFIED: src/mcp/vice/vice.ts:14-18], so importing `ViceError` pulls in no transport
machinery and no `hostpath.ts`. Safe.

### Anti-Patterns to Avoid

- **Threading a classifier or a store handle into `block-class.ts`.** Its import list
  is asserted empty and its two-argument signature is asserted to stay two, because
  one extra argument collapses the census's bytes-versus-store independence axis
  *quietly* — the independence test keeps passing while the claim it protects becomes
  void [VERIFIED: src/mcp/vice/block-class.ts:41-52].
- **Putting narrowest-wins inside the write path.** It makes criterion 2's tie-break
  pin unreachable (see `## The Cross-Validation Oracle`).
- **An explicit `save` verb.** Durability is the store's, not the caller's. `ROADMAP.md`
  §Phase 29 lists it as a measured anti-feature; `anno_save_project` exists in the
  old surface [VERIFIED: src/mcp/vice/anno-tools.ts:526] and is exactly what not to
  carry.
- **Caching a derived index on disk.** A cached index inside the store creates a
  second truth that can disagree with the range table — the failure `COV-01`'s
  derived-from-bytes census exists to make impossible.
- **Double-quoted SQL string literals.** `node:sqlite` disables them by default:
  `insert into t values ("a")` throws `no such column: "a"`. Single quotes, or bound
  parameters — which you want anyway.
- **`db.exec()` with an interpolated value.** `exec()` takes no parameters. It is
  needed for `vacuum into '<path>'` (which cannot be parameterised), so escape the
  path (`replace(/'/g, "''")`) and validate it first. Everything else goes through
  `prepare().run(...)`.
- **Reusing `stock-address.ts`'s `parseAddress()`.** It accepts a bare decimal string
  and also carries module-level mutable symbol-resolver state. See C-4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable atomic multi-row writes | An atomic-JSON writer with `fsync` | `node:sqlite` transactions | `D1`: the atomic-JSON planted violation frequently still passes because the page cache serves the read. Verified the SQLite one reddens |
| Crash rollback | A hand-rolled write-ahead log | SQLite's rollback journal | Proven across `SIGKILL` in a fresh process, four ways |
| Whole-store snapshot | Reading every table and re-inserting | `vacuum into '<path>'` | One synchronous statement, 6.32 ms, and SQLite fsyncs it |
| Interval overlap queries | An interval tree | A 256 KB `Int32Array` paint array | Every surveyed package returns *all* overlaps with no narrowest-wins tie-break, so the deciding logic is ours regardless. 1.30 ms for 65,536 lookups |
| 6502 mnemonic denylist for label legality | A hand-typed 56-name list | `new Set(OPCODES.map(o => o.mnemonic))` | 256 entries including every illegal-opcode mnemonic; a hand list misses `slo`/`lax`/`jam` |
| The comment-contradiction rule | A new grade vocabulary | `CONFIDENCE_GRADES` + `parseConfidencePrefix()` | Already owned, already tested, already what the skills emit |
| The 11 auto-name prefixes | A five-prefix reimplementation | `AUTO_NAME_PREFIX_RE` | `EXPORT-02` names the exact failure: a five-prefix version silently breaks `routine-queue-walker`'s backlog construction |
| The shipped-module enumerator or a source stripper | A fifth hand copy | `shippedTsModules()` / `codeOnly()` | `shipped-modules.ts`'s whole reason for existing. Four hand copies had already diverged |
| Full-text search | An FTS5 virtual table, now | Nothing in Phase 28; `LIKE` in Phase 29 | Additive later, not removable later. 121.8 ms rebuild for zero measured benefit at these row counts |

**Key insight:** every "don't hand-roll" here is really "don't hand-roll a *guard*".
This project's acceptance bar is observed-RED, and a hand-rolled durability or
adjacency mechanism is precisely the kind of thing that cannot be made to fail on
demand. The persistence choice was made on reddenability, not on features.

## Runtime State Inventory

Not a rename/refactor/migration phase — Phase 28 is additive. Included anyway,
narrowly, because the phase creates on-disk state whose format is unrecoverable
later.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None to migrate.** No `.annostore` file exists anywhere; the existing store format is anno's `.regen2000proj` [VERIFIED: src/mcp/vice/anno-tools.ts:174] and **no parity is owed to it** (owner decision, `REQUIREMENTS.md` decision 1), so nothing is converted. New state created: `<project>.annostore` plus a `snapshots/` sibling directory | none — but the plan must state that no import path from `.regen2000proj` is built, so a later reader does not look for one |
| Live service config | None — verified: the store is container-side, reached per call by explicit path, with no daemon, no port and no broker involvement | none |
| OS-registered state | None — verified: no systemd unit, no scheduler entry. (The VICE broker's systemd unit is unrelated and untouched) | none |
| Secrets/env vars | None — verified: no new env var is required. If a plan adds one (e.g. a store-path override) it must be named in the module header the way `VICE_*` vars are | none |
| Build artifacts | None — verified: all new modules are plain `.ts`, so `build.ts`, `tsconfig.build.json` and `resources/*.mjs` are untouched and `resources-sync.test.ts` cannot drift | none |
| **Unrecoverable-if-wrong** | The **12-member vocabulary** and the **`endInclusive` semantics**. Split-table orientation was never recorded by the predecessor, so recovery is a hand re-annotation, not a migration | decide once, in this phase, and pin with a `schema_version` so a future change is detectable |

## Common Pitfalls

### P-1: A module header that hands work to a numbered phase fails a committed guard

**What goes wrong:** the natural header sentence — "the tool surface that reaches this
store lands in Phase 29" — fails `comment-phase-pointers.test.ts`.
**Why:** that guard scans `shippedTsModules()` and rejects seven **assignment
shapes** in comments while permitting narration
[VERIFIED: src/mcp/vice/comment-phase-pointers.test.ts:271-301]. The families, with
their real regexes:

| Family | Regex |
|---|---|
| `verb-first-handoff` | `/\b(?:moved\|deferred\|defers?\|belongs?\|lands?\|pushed\|punted\|reassigned\|handed)\b[^.;]{0,80}?\bPhase\s+\d+(?:\.\d+)?/i` |
| `possessive-plus-noun` | `Phase N's … (extension\|home\|scope\|deliverable\|remit\|business\|timing route)` |
| `owner-home` | `(home\|owner\|owned by\|covered by\|claimed by\|lives in) … Phase N` |
| `is-was-possessive` | `(is\|are\|was\|were\|remains\|becomes\|will be) Phase N's` |
| `comma-appositive` | `Phase N, (via\|through\|using\|by way of)` |
| `needs-requires` | `(needs\|needed\|requires\|awaits\|pending on\|blocked on) … Phase N` |
| `until-phase-present-tense` | `until Phase N` (past-tense exclusion applies) |

**How to avoid:** in shipped-module comments, refer to *requirement ids* — "`MCP-01`
registers the surface" — never to phase numbers in an assignment shape. Past-tense
narration ("extracted in phase 27") is legal.
**Warning signs:** the words *lands*, *belongs*, *home*, *until*, *requires* within
80 characters of `Phase <digit>`.

### P-2: A shipped string literal naming a phase number fails a different guard

**What goes wrong:** an error message like `"not yet implemented (Phase 29)"` fails
`docs-dangling-refs.test.ts`'s FLOW-02 check, which is scoped to **string and
template literals** rather than comments
[VERIFIED: src/mcp/vice/comment-phase-pointers.test.ts:3-13, which documents FLOW-02's
scope and why the two guards are deliberately disjoint].
**How to avoid:** never put a phase number in a shipped string literal. Cite a
requirement id or a todo path.

### P-3: `block-class.ts` silently reclassifies everything as `data`

Covered in full above. The warning sign is a *measured coverage number moving* with
every test green.

### P-4: The `ExperimentalWarning` — and the one existing empty-stderr assertion

`node:sqlite` emits `ExperimentalWarning: SQLite is an experimental feature and might
change at any time` on first load, unconditionally, and on Node 22.22
**type-stripping emits no warning**, so this would be the tree's first
[VERIFIED: probe, both directions].

There is exactly **one** empty-stderr assertion in the tree
[VERIFIED: src/mcp/vice/audit-integrity.test.ts:601-602]:

```typescript
      assert.equal(status, 0, `expected exit 0 (all guards green); stderr: ${stderr}`);
      assert.equal(stderr, "");
```

It spawns `scripts/audit-gate.mjs --hook` against a **synthetic** tree with synthetic
guards, so it is not reached by a store import today. It becomes reachable the moment
`audit-gate.mjs` (or anything it loads) touches the store. **Rules for the plan:** no
new test may assert stderr is empty; every child process the store tests spawn uses
`stdio: "pipe"` and never `"inherit"`, so the warning cannot leak into the parent's
TAP stream; and if the warning ever needs silencing in production,
`NODE_OPTIONS=--disable-warning=ExperimentalWarning` in `.mcp.json`'s `env` block
works completely — but note it would suppress *all* experimental warnings, so it is a
decision, not a tidy-up.

The warning goes to **stderr**, and the MCP protocol is on stdout, so it cannot
corrupt the wire.

### P-5: `vice-proxy.test.ts` hangs the whole-glob run, and 44 failures is the clean baseline

`npm test` runs the bare glob `node --test '*.test.*'`, which does **not** consult
`MANUAL_ONLY_TESTS`. Two recorded consequences the plan must budget for
[VERIFIED: .planning/phases/27-shared-seams-extracted/deferred-items.md, items
D-27-02-B and D-27-05-A]:

- the whole-glob run produces **44 failures on a clean tree** (39 in
  `vice-proxy.test.ts` needing a live host, 5 in `anno-session.test.ts` needing
  `the external analyser` on PATH), and
- `vice-proxy.test.ts` **leaks two LISTEN sockets and never exits** — diagnosed on a
  real PID, zero CPU, all 2,410 TAP lines already emitted, two `127.0.0.1` listeners
  held. The child must be terminated by hand once its results are out.

**Therefore:** use `npm run test:automated` (= `node test-gate.mjs`, the glob minus
the frozen nine) as the phase's routine gate, and reserve the full glob for the
phase-close evidence run with the caveat recorded. And note the standing hazard: a
**running VICE broker deterministically reddens the `BACK-05` test**, so the broker
must be stopped before any `npm test` result is trusted.

### P-6: New store tests must be automated, and they land there by default

`automatedTestFiles()` is `readdirSync` filtered to `*.test.*` minus
`MANUAL_ONLY_TESTS` [VERIFIED: src/mcp/vice/test-gate.mjs:110-113], and
`MANUAL_ONLY_TESTS` is a frozen nine-entry list
[VERIFIED: src/mcp/vice/test-gate.mjs:95-105]. So a new `anno-*.test.ts` is picked up
by both `npm test` and `npm run test:automated` automatically, with no edit anywhere —
and `test-gate.test.ts`'s drift guard fails the build if a file escapes both lists.
**Do not add any store test to `MANUAL_ONLY_TESTS`:** none needs an emulator, a
broker or a network, and the 279 ms cross-validation is the slowest thing here.

### P-7: `/tmp` is a 16 GB tmpfs with cleanup disabled

Test temp directories must be `mkdtempSync`ed and removed in a `finally`/`after` hook.
The store tests create database files, hot journals, snapshot files and a `snapshots/`
directory per case; leaking them leaks RAM on this host, and the tree already leaks
~2 GB per full run. Prefer `mkdtempSync(join(tmpdir(), "anno-"))` and clean up
unconditionally — including on the `SIGKILL` path, where the child cannot clean up
after itself, so the parent must.

### P-8: SQLite will not refuse a zero-length store file

Covered above. The store owns its refusal via the meta row plus `integrity_check`.
The specific warning sign is a store that reports "no annotations" instead of
"corrupt".

### P-9: Shipping a module nothing imports yet is fine — verified, not assumed

`scripts/check-npm-packages.mjs`'s transitive-closure walk asserts **one** direction
only: every module *reachable* from `vice-proxy.ts` must be in `files[]`
[VERIFIED: scripts/check-npm-packages.mjs:232-258, whose only failure message is
`"${dep} is imported by ${f} but is not in the published tarball"`]. It does not
assert the converse. So adding `anno-types.ts`, `anno-index.ts` and `anno-store.ts` to
`files[]` in Phase 28 — before Phase 29 imports them — passes. And it is **required**,
because `STORE-07`'s assertion scans `shippedTsModules()`; leaving them out makes that
assertion vacuous.

Two knock-on effects of joining `files[]`, both desirable and both to be verified in
the phase: the new modules enter `comment-phase-pointers.test.ts`'s scanned set (see
P-1) and `spawn-seam.test.ts`'s (they contain no spawn call, so they pass
trivially — but confirm rather than assume).

### P-10: `anno-confidence.ts` is imported under a name Phase 32 renames

If Phase 28 imports `parseConfidencePrefix()` (recommended), the import specifier
`"./anno-confidence.ts"` becomes a Phase-32 edit. Put it on Phase 32's enumerated
task list at plan time. Do **not** avoid the import by copying the vocabulary — that
is exactly the divergence the single-seam convention exists to prevent.

### P-11: `pragma` statements are not transactional and `journal_mode` is sticky

`pragma journal_mode = wal` is a **persistent** property written into the database
header; `pragma synchronous` is per-connection. If any code path ever sets WAL, every
later connection inherits it and the sidecars appear. Set neither, and assert the
mode in a test so a future edit that switches it is visible.

## Code Examples

### Opening a store, with the refusal SQLite will not give you

```typescript
// Source: measured behaviour of node:sqlite 3.50.4 on Node v22.22.0, this host.
// A ZERO-LENGTH file OPENS, reports pragma integrity_check "ok", and returns an
// empty sqlite_master -- so "your annotations are gone" and "there are no
// annotations" are indistinguishable unless the store refuses for itself.
import { DatabaseSync } from "node:sqlite";

export function openStore(path: string): AnnoStore {
  const fresh = !existsSync(path);
  const db = new DatabaseSync(path, { timeout: 5_000 });
  if (fresh) {
    db.exec("begin immediate");
    db.exec(DDL);
    db.prepare("insert into anno_meta(id, schema_version, revision) values (1, ?, 0)").run(SCHEMA_VERSION);
    db.exec("commit");
    return { db, path };
  }
  let row: { schema_version: number; revision: number } | undefined;
  try {
    row = db.prepare("select schema_version, revision from anno_meta where id = 1").get() as never;
  } catch (e) {
    throw new AnnoStoreCorruptError(`${path}: not an annotation store (${(e as Error).message})`, { path });
  }
  if (!row) {
    throw new AnnoStoreCorruptError(
      `${path}: annotation store has no meta row -- refusing to treat a truncated or foreign file as an empty store`,
      { path },
    );
  }
  if (row.schema_version !== SCHEMA_VERSION) {
    throw new AnnoStoreCorruptError(`${path}: schema_version ${row.schema_version}, expected ${SCHEMA_VERSION}`, { path });
  }
  const check = db.prepare("pragma integrity_check").all() as { integrity_check: string }[];
  if (check.length !== 1 || check[0].integrity_check !== "ok") {
    throw new AnnoStoreCorruptError(`${path}: integrity_check reported ${JSON.stringify(check)}`, { path });
  }
  return { db, path };
}
```

Measured: `integrity_check` on a 100 KB / 5,000-row store is **0.73 ms**
(`quick_check` is 0.74 ms — no reason to prefer it at this scale).

### The write: snapshot, then CAS, then mutate, then one COMMIT

```typescript
// Source: prototype run on this host 2026-08-27 (~/.cache/gsd-probe/c4/store.mjs).
// Removing the single `commit` below makes ONE combined test fail BOTH its
// durability half and its revert half -- observed, both modes, same test.
export function applyWrite(s: AnnoStore, mutate: (db: DatabaseSync) => void, baseRevision?: number): number {
  const rev = currentRevision(s);
  if (baseRevision !== undefined && baseRevision !== rev) {
    throw new AnnoStoreStaleRevisionError(
      `refusing the write: base revision ${baseRevision} is not the current on-disk revision ${rev}`,
      { baseRevision, currentRevision: rev },
    );
  }
  const snapPath = snapshotPathFor(s, rev);          // <dir>/snapshots/r<rev>.db
  mkdirSync(dirname(snapPath), { recursive: true });
  // exec() takes no parameters and `vacuum into` cannot be parameterised, so the
  // path is escaped. Validate it before it gets here.
  s.db.exec(`vacuum into '${snapPath.replace(/'/g, "''")}'`);

  s.db.exec("begin immediate");
  const cas = s.db
    .prepare("update anno_meta set revision = revision + 1 where id = 1 and revision = ?")
    .run(rev);
  if (cas.changes !== 1) {
    s.db.exec("rollback");
    throw new AnnoStoreStaleRevisionError("refusing the write: the revision moved under us", { baseRevision: rev });
  }
  s.db.prepare("insert into anno_snapshot(revision, path) values (?, ?)").run(rev, snapPath);
  mutate(s.db);
  s.db.exec("commit");   // <-- the ONE planted-violation site
  return rev + 1;
}
```

### Split-and-preserve, the five overlap cases

```typescript
// Source: derived from STORE-02 / criterion 3. Case 3 is the ONLY case a
// filter()-and-insert implementation gets wrong on the total-typed-bytes metric,
// so case 3 IS the planted violation's detector.
function retype(db: DatabaseSync, start: number, endInclusive: number, dataType: DataType): void {
  const overlapping = db
    .prepare("select id, start, end_inclusive, data_type from anno_range where end_inclusive >= ? and start <= ? order by id")
    .all(start, endInclusive) as RangeRow[];

  for (const r of overlapping) {
    db.prepare("delete from anno_range where id = ?").run(r.id);
    // Preserve the head that survives (cases 3 and 5).
    if (r.start < start) {
      insertRange(db, r.start, start - 1, r.data_type);
    }
    // Preserve the tail that survives (cases 3 and 4).
    if (r.end_inclusive > endInclusive) {
      insertRange(db, endInclusive + 1, r.end_inclusive, r.data_type);
    }
  }
  insertRange(db, start, endInclusive, dataType);
}
```

The invariant to assert across all five cases: `sum(endInclusive - start + 1)` over
all rows is unchanged, **and** every address that had a type before still has one
(the second half is what catches a case-3 hole that happens to balance).

### The structural single-seam assertion

```typescript
// Source: idiom from src/mcp/vice/hostpath-consumers.test.ts:132-150, widened
// because node:sqlite has FOUR access routes (static import, dynamic import(),
// createRequire()(...), process.getBuiltinModule(...)) rather than two.
// keepLiteralBodies = true because the thing being read IS a string literal --
// see shipped-modules.ts:198-205 for why that mode exists.
import { codeOnly, shippedTsModules } from "./shipped-modules.ts";

function sqliteImporters(): string[] {
  return shippedTsModules()
    .filter((name) => /node:sqlite/.test(codeOnly(readFileSync(join(HERE, name), "utf8"), true)))
    .sort();
}

test("node:sqlite is named by exactly one shipped module (STORE-07)", () => {
  const importers = sqliteImporters();
  assert.deepEqual(importers, ["anno-store.ts"]);
  assert.equal(importers.length, 1);
});
```

### The one combined durability-and-revert test

```typescript
// Source: run end-to-end on this host 2026-08-27. Output:
//   [commit]    readBackByValue=true  revertReturnsPriorValue=true  -> GREEN
//   [no-commit] readBackByValue=false revertReturnsPriorValue=false -> RED
// stdio: "pipe" so the child's ExperimentalWarning never reaches the TAP stream.
test("STORE-04: mutate -> SIGKILL -> fresh process -> reopen -> read back by value -> revert returns the prior value", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-"));
  try {
    const path = join(dir, "proj.annostore");
    openStore(path).db.close();
    try {
      execFileSync(process.execPath, [MUTATOR, path], { stdio: "pipe" });
    } catch {
      /* the child SIGKILLs itself; status 137 is the point */
    }
    const s = openStore(path);                       // a different OS process from the mutator
    const rows = listRanges(s);
    const readBackByValue =
      rows.length === 1 && rows[0].start === 0x0810 && rows[0].end_inclusive === 0x084f && rows[0].data_type === "lo_hi_address";
    const s2 = revertTo(s, 0);
    const revertReturnsPriorValue = listRanges(s2).length === 0 && currentRevision(s2) === 0;
    assert.equal(readBackByValue, true, "the mutation must read back BY VALUE after a SIGKILL with no clean close");
    assert.equal(revertReturnsPriorValue, true, "revert must return the prior value, in the same test");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

Note the two booleans are computed **outside** any `try` around the assertions, so a
domain error from the store cannot be absorbed and reported as a pass.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A native SQLite binding (`better-sqlite3`, `node-sqlite3`) | `node:sqlite` built in | unflagged in Node **v22.13.0** | No dependency, no prebuilds, no install script — and `ENGINEERING_RULES.md` §4 is not triggered at all |
| `sqlite3_backup` C API for snapshots | `VACUUM INTO` | SQLite **3.27** (2019); bundled version here is 3.50.4 | One synchronous statement instead of an async page loop |
| Hand-rolled optimistic concurrency over mtime | a revision column + `UPDATE … WHERE revision = ?` + `changes` | — | Atomic inside `BEGIN IMMEDIATE`, and observably refuses across OS processes |
| `pragma journal_mode = wal` as a default reflex | leave the default `delete` | — | Single file at rest; identical `SIGKILL` durability; 6.24 vs 2.26 ms/edit, irrelevant at this volume |

**Deprecated / outdated in the upstream inputs to this phase:**

- The claim that `node:sqlite` has no session support. It has `createSession`,
  `session.changeset()`, `session.patchset()` and `db.applyChangeset()`; only
  inversion is missing.
- The `1.16 ms` per-edit figure as an unqualified number: it is a tmpfs/WAL figure. On
  real disk in the default journal mode it is ~6 ms.

## Contradictions Found

**This is the section the orchestrator asked to be stated loudly.** Five items. None
of them invalidates the phase, and **criterion 4 and criterion 5 are both
achievable** — but three of the five change what the plan must contain.

### C-1 — `node:sqlite` DOES expose the session extension. Only inversion is missing.

`REQUIREMENTS.md:50` says *"Node's `sqlite` surface also does not expose
`sqlite3changeset_invert`, confirmed two independent ways."* That narrow statement is
**correct** and `D2`'s conclusion stands. But `DatabaseSync.prototype` carries
`createSession` and `applyChangeset`, `ENABLE_SESSION` is compiled in, and I ran a
changeset from one database into another successfully
[VERIFIED: probe, `~/.cache/gsd-probe/probe2.mjs`]. **Impact: low, but real** — a
planner reading `D2` as "no session support" might either re-litigate the decision or
miss that forward changeset replay is available. State it accurately and build nothing
on it (there is no consumer).

### C-2 — A zero-length store file is NOT refused. `ROADMAP.md`'s truncation claim is only half true.

`ROADMAP.md` §Phase 28 criterion 4: *"A store file truncated between kill and reopen
is **refused**, never returned partial."* Measured:

- mid-file truncation → `database disk image is malformed` (`errcode 11`). **Refused.** ✅
- **zero-length → OPENS, `integrity_check` says `ok`, `sqlite_master` is empty, `user_version` is 0.** Reads as a pristine empty store. ❌
- tail truncation inside the last page → **opens and returns correct rows**; only `integrity_check` notices. ❌

**Impact: HIGH.** The criterion is satisfiable only if the store implements its own
refusal (meta row + `schema_version` + `integrity_check`) — which I prototyped and
which refuses both the zero-length and the mid-file cases
[VERIFIED: `~/.cache/gsd-probe/c4/extras.mjs`: `truncate zero: REFUSED AnnoStoreCorruptError`].
The tail-inside-last-page case is closed by `integrity_check` at open (0.73 ms) and
otherwise remains a stated residual. **The plan must make this an explicit task**, not
an assumed property of SQLite.

### C-3 — The WAL sidecar cost is opt-in, not inherent; and the default mode has a transient sidecar too.

`ROADMAP.md` presents the `-wal`/`-shm` sidecars as *"costs of the chosen route,
stated rather than discovered"*. Measured: the default journal mode is **`delete`**,
which is single-file at rest and leaves only a transient `<db>-journal` after an
unclean kill, deleted on the next open. WAL is opt-in and is the only mode with
persistent sidecars. **Impact: low, and favourable** — the claim is a cost of a
*choice this phase need not make*. Recommend the default and record the reason;
`ExperimentalWarning` remains a genuine unavoidable cost, the sidecars do not.

### C-4 — `stock-address.ts` already accepts a bare decimal string, so "reject an unprefixed numeric string" creates a real inconsistency.

`ROADMAP.md` §Phase 28: *"Accept `integer` **and** `$`/`0x`-prefixed strings, and
**reject an unprefixed numeric string outright** … this codebase already contains two
opposite defaults."* The second half is verified true and the first half is a real
divergence from a shipped, tested, documented parser
[VERIFIED: src/mcp/vice/stock-address.ts:155-160]:

```typescript
  if (/^[0-9]+$/.test(trimmed)) {
    const value = parseInt(trimmed, 10);
    if (!inAddressRange(value)) {
      throw new StockAddressError(`${what}: "${trimmed}" is out of range -- expected a decimal integer 0..65535`);
    }
    return value;
```

and its own doc comment [VERIFIED: src/mcp/vice/stock-address.ts:100-105] says
`"or a bare decimal string"` is accepted, under decision `D-04`.

**Impact: MEDIUM, and it is a decision the plan must record rather than a bug.** An
agent will hit `vice_read_memory("1024")` → 1024 decimal while
`anno_set_type(start: "1024")` refuses. `ROADMAP.md`'s ruling stands and the rationale
is defensible — a mis-based address written into the store is *persistent and silently
wrong*, whereas a mis-based read is transient — but it must be written down as a
divergence with that reason, in the store's own module header. And the store must
**not** reuse `parseAddress()`, for a second independent reason: it carries
module-level mutable symbol-resolver state
[VERIFIED: src/mcp/vice/stock-address.ts:52-76], which the store has no business
depending on.

### C-5 — `STORE-05`'s stored xref access kind contradicts Phase 29 criterion 5's "never cached on disk".

- `STORE-05`: *"cross-reference rows carry their access kind (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`). All three are free at decode time and **unrecoverable afterwards**."*
- `ROADMAP.md` §Phase 29 criterion 5: xrefs are *"**derived on every query** from the surviving `disasm-*` decoders and **never cached on disk**"*.

If xrefs are never on disk there are no rows to carry a field, and if they are
re-derived on every query the kind is never unrecoverable. **Both cannot be literally
true.**

**Recommended resolution** (the planner must choose and record one): Phase 28 defines
an `anno_xref` **table with an `access_kind` column** used only for xrefs that are
*not* derivable from the bytes — a hand-asserted or externally-resolved reference,
which is exactly the `COMPUTED_JUMP` case that `PROOF-02` found produces **no
reference at all** when the dispatch index is computed
[CITED: .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md:613-620].
Phase 29's derived query returns the **same row shape** with the kind computed on the
fly. That satisfies both texts: the schema carries the column from the first write,
and nothing derivable is cached.

Two supporting facts the planner needs:

- **The access-kind vocabulary is not from this repo's code.** It is Ghidra's
  `RefType.READ`/`WRITE`/`READ_WRITE` and `FlowType.COMPUTED_JUMP`
  [CITED: .planning/research/FEATURES.md:49, 71; observed in
  .planning/notes/dxa-ghidra-pivot.md:40-42 as `082e -> 089a COMPUTED_JUMP` and
  `0892 -> d021 READ_WRITE`]. `GHID-*` is **held for v0.8.0**, so no shipped consumer
  reads the field. Storing it is `[CITED]`-grounded and cheap; do not present the
  four-member spelling as verified project code.
- **"Free at decode time" needs a small amount of new code.** `OpcodeEntry` carries
  `mnemonic`, `mode`, `length`, `illegal`, `acmeExpressible` and **no access field**
  [VERIFIED: src/mcp/vice/disasm-opcodes.ts:183-201]. So a mnemonic→access map is new
  (~30 entries: `sta`/`stx`/`sty` → `WRITE`; `inc`/`dec`/`asl`/`lsr`/`rol`/`ror` and
  the RMW illegals → `READ_WRITE`; the rest → `READ`). Cheap, but it is work, not a
  field that already exists.

### C-6 (minor) — Two citations drifted slightly

- `ROADMAP.md` cites `vice-proxy.ts:3216-3230` for `rawJsonSchemaAsStandardSchema()`.
  Current tree: the doc comment is `:3212-3222`, the function declaration `:3224`, and
  `validate: (value: unknown) => ({ value })` is exactly `:3230`
  [VERIFIED: src/mcp/vice/vice-proxy.ts:3224, 3230]. The claim is correct; the range
  starts two lines late. `docs-linerefs.test.ts` only checks CLAUDE.md's
  `rewriteArguments()` bullet [VERIFIED: src/mcp/vice/docs-linerefs.test.ts:32, 66-83],
  so nothing goes red — but a plan quoting the range should use the real lines.
- `SEAM-03` describes `anno-coverage.ts`'s store contact as *"two functions"*. The
  block-type half is now behind `block-class.ts`; the **label-kind** half is four
  inline comparisons that were never counted. See `## The Named Boundary Phase 27 Left
  Half-Open` (b).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | **v22.22.0** (floor `>=22.18.0`) | — |
| `node:sqlite` | `anno-store.ts` (STORE-04/05/07) | ✓ | built-in, SQLite **3.50.4** | none needed; none exists |
| SQLite `ENABLE_SESSION` | nothing (informational — C-1) | ✓ | compiled in | — |
| SQLite `ENABLE_FTS5` | nothing in Phase 28 (Phase 29 may) | ✓ | compiled in | `LIKE` + index |
| `node:test` | every test | ✓ | built-in | — |
| Real disk for durability measurement | the `SIGKILL` evidence run | ✓ | ext4 on nvme at `/home` | note: `/tmp` is tmpfs, so a durability measurement taken there is not a disk measurement |
| ACME cross-assembler | **not** this phase (Phase 30) | ✓ (0.97 per prior phases) | — | — |
| A VICE emulator / the broker | **not** this phase | n/a | — | — |
| `the external analyser` on PATH | **not** this phase | ✗ on this host | — | irrelevant: no Phase 28 test spawns it. It is the cause of 5 of the 44 whole-glob baseline failures (D-27-02-A) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none required by this phase.

One environmental hazard rather than a dependency: **a running VICE broker
deterministically reddens the `BACK-05` test**, so it must be stopped before any
`npm test` result taken as evidence.

## Validation Architecture

`workflow.nyquist_validation` is `true` [VERIFIED: .planning/config.json].

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`) with `node:assert/strict`. No external framework. |
| Config file | none — the glob is the config: `"test": "node --test '*.test.*'"` in `src/mcp/vice/package.json` |
| Quick run command | `cd src/mcp/vice && node --test anno-types.test.ts anno-index.test.ts anno-store.test.ts anno-seam.test.ts anno-durability.test.ts` |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (the glob minus the frozen nine `MANUAL_ONLY_TESTS`) |
| Whole-glob command (evidence only) | `cd src/mcp/vice && npm test` — **broker stopped**, expect the **44-failure clean baseline**, and expect to terminate the hung `vice-proxy.test.ts` child by hand (D-27-05-A) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-01 | The 12 members are exactly the twelve, frozen, and the four split layouts are first-class | unit | `node --test anno-types.test.ts` | ❌ Wave 0 |
| STORE-01 | A `lo_hi_address` fixture typed `hi_lo_address` yields a **differing resolved-target set**; the fixture is asserted non-degenerate | unit | `node --test anno-types.test.ts` | ❌ Wave 0 |
| STORE-01 | `lo_hi_address` vs `lo_hi_word` differ in xref production (justifies four, not two) | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-01 | Label legality: mnemonic denylist derived from `OPCODES`; `init screen` refused, never sanitised; a legal name already bound elsewhere refused | unit | `node --test anno-types.test.ts` | ❌ Wave 0 |
| STORE-01 | Labels/comments/scopes/project enums round-trip by value | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-02 | No merge on adjacency: two adjacent same-type ranges stay two rows; **and** no splitter symbol exists (structural) | unit + structural | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-03 | Exhaustive 65,536-address cross-validation, two independent implementations, **0** disagreements (~279 ms) | unit | `node --test anno-index.test.ts` | ❌ Wave 0 |
| STORE-03 | The four separate pins: `$FFFF`, both inclusive ends, `$0400-$0400` length **1**, the equal-length tie-break (needs deliberately overlapping rows) | unit | `node --test anno-index.test.ts` | ❌ Wave 0 |
| STORE-03 | Split-and-preserve: total typed bytes unchanged across **all five** overlap cases, and every previously-typed address still typed | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-03 | **Planted violation:** `filter()`-and-insert makes the **fully-contained** case fail | unit (planted) | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-03 | A contradicting retype returns the contradicted comments **as data**; **planted violation:** removing the check returns clean success | unit (planted) | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-04 | **ONE** combined test: mutate → `SIGKILL` no clean close → fresh process → reopen → read back by value → revert returns the prior value | integration | `node --test anno-durability.test.ts` | ❌ Wave 0 |
| STORE-04 | **Planted violation:** removing the `COMMIT` makes *that same test* go red — both halves | integration (planted) | `node --test anno-durability.test.ts` | ❌ Wave 0 |
| STORE-04 | A truncated store file is **refused**: zero-length and mid-file both `AnnoStoreCorruptError`; the tail-in-last-page residual is stated | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-05 | Every write carries `schema_version`; a mismatched version refuses | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-05 | The `bank` field exists, is nullable, and is **never read** by any store code path (structural: no `bank` on any right-hand side outside the DDL and the row mapper) | unit + structural | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-05 | An xref row carries `access_kind`, and the four members are the only accepted values | unit | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-05 | A write whose base revision is stale is **refused**, observed by mutating from a **second OS process** and reading back | integration | `node --test anno-store.test.ts` | ❌ Wave 0 |
| STORE-07 | `node:sqlite` is named by exactly one shipped module — `deepEqual` **plus** `length` — over `shippedTsModules()` | structural | `node --test anno-seam.test.ts` | ❌ Wave 0 |
| STORE-07 | **Planted violations:** static, multi-line static, dynamic `import()`, and `process.getBuiltinModule` shapes each reported; a comment-only mention is not | structural (planted) | `node --test anno-seam.test.ts` | ❌ Wave 0 |
| STORE-07 | The three new modules are in `package.json` `files[]` (so the assertion above is not vacuous) | structural | `node --test anno-seam.test.ts` | ❌ Wave 0 |
| (regression) | No new module imports `hostpath.ts` | structural | `node --test hostpath-consumers.test.ts` | ✅ exists |
| (regression) | No new shipped comment hands work to a numbered phase; no shipped literal names one | structural | `node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | ✅ exists |
| (regression) | `block-class.ts` maps **every one** of the twelve members correctly — derived from `DATA_TYPES`, total | unit | `node --test block-class.test.ts` | ✅ exists (extend) |
| (regression) | The census's label-kind spelling and the store's agree (or the second boundary is extracted) | unit | `node --test anno-coverage.test.ts` | ✅ exists (extend) |
| (regression) | `shippedTsModules()` does not throw — every new `files[]` entry is on disk | structural | `node --test shipped-modules.test.ts` | ✅ exists |
| (regression) | Tarball closure and packaging still clean with three unreachable-but-shipped modules | CI script | `node scripts/check-npm-packages.mjs` | ✅ exists |
| (regression) | Typecheck | typecheck | `cd src/mcp/vice && npm run typecheck` | ✅ exists |

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && node --test anno-*.test.ts && npm run typecheck` — the store's own tests plus a typecheck. Sub-second plus tsc.
- **Per wave merge:** `cd src/mcp/vice && npm run test:automated` — includes every regression guard above (`hostpath-consumers`, `comment-phase-pointers`, `docs-dangling-refs`, `block-class`, `anno-coverage`, `shipped-modules`) and terminates.
- **Phase gate:** `npm run test:automated` green, `npm run typecheck` green, `node scripts/check-npm-packages.mjs` green, and one whole-glob `npm test` evidence run with the broker stopped, the 44-failure baseline reconciled item by item, and the hung `vice-proxy.test.ts` child terminated and noted — **before** `/gsd-verify-work`.

**Nyquist justification for the sampling rate.** The fastest-moving thing in this
phase is the type vocabulary, which every other module derives from; a per-task run of
`anno-types.test.ts` samples it at every commit, which is above the rate at which it
can change. The slowest-moving is the packaging/closure state, sampled at wave merge
and at the gate, which is the rate at which `files[]` changes. The one measurement
that cannot be sampled more cheaply than it is run is the 65,536-address
cross-validation at 279 ms — and 279 ms is cheap enough to run at every commit, so it
does.

### Wave 0 Gaps

- [ ] `anno-types.test.ts` — covers STORE-01 (vocabulary, split orientation, label legality)
- [ ] `anno-index.test.ts` — covers STORE-03 (cross-validation + the four pins)
- [ ] `anno-store.test.ts` — covers STORE-01/02/03/05 (round-trip, no-merge, five overlap cases, contradiction, refusals, cross-process CAS)
- [ ] `anno-durability.test.ts` — covers STORE-04 (the one combined test) **plus a sibling mutator script** the test spawns and `SIGKILL`s
- [ ] `anno-seam.test.ts` — covers STORE-07 (structural + four plantings + the `files[]` non-vacuity pairing)
- [ ] Extensions to two existing files: `block-class.test.ts` (total derived mapping over `DATA_TYPES`) and `anno-coverage.test.ts` (label-kind agreement)
- [ ] Framework install: **none** — `node --test` is built in and every new `*.test.ts` joins both globs automatically

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level` is `1`
[VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | No principal, no credential. The store is a local file reached in-process by an already-trusted MCP server |
| V3 Session Management | **no** | No session. `D-19`'s explicit-path-per-call convention is carried: no ambient state names the store [VERIFIED: src/mcp/vice/anno-tools.ts:174-176] |
| V4 Access Control | **partially** | The only boundary is the filesystem. One control matters and is a real risk: the store path arrives from the caller, so it must be constrained to the workspace. The tree has the *idiom* — `class PathOutOfWorkspaceError extends Error {}` [VERIFIED: src/mcp/vice/vice-proxy.ts:1873], thrown at `:1923` — but it is **module-private and not exported**, so it cannot be imported. Copy the *shape* under a new exported `ViceError` subclass in `anno-types.ts`; do not export the private one out of `vice-proxy.ts` (that file is under a standing size instruction) |
| V5 Input Validation | **yes — the whole phase** | The proxy validates nothing (`vice-proxy.ts:3230`'s `validate: (value) => ({ value })`), so every argument arrives unvalidated. Hand-written validators in `anno-types.ts` throwing named `ViceError` subclasses. **Not `zod`** — it is present only as an undeclared transitive of `@mastra`, so depending on it would be depending on someone else's dependency tree |
| V6 Cryptography | **no** | No secrets, no hashing, no signing. Nothing to hand-roll |
| V7 Error Handling & Logging | **yes** | Every refusal is a named error carrying the offending value and the valid range, matching this tree's convention. No error message may contain a phase number (P-2) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a label, comment or enum name | Tampering | **Bound parameters everywhere.** `prepare(...).run(...)`, never string-concatenated SQL. `exec()` takes no parameters and is therefore restricted to fixed DDL and the one unavoidable `vacuum into '<path>'`, whose path is escaped (`replace(/'/g, "''")`) **and** validated first |
| Path traversal via the `project` argument (`../../etc/…`, an absolute path outside the workspace) | Tampering / Info disclosure | Resolve and confine to the workspace root before opening. This is the one genuinely new attack surface the phase adds, because the argument is an unvalidated caller-supplied filesystem path |
| Writing a store file outside the container's workspace | Tampering | Same control. **And never route it through `hostpath.ts`** — a host-translated path would let a store write land on the host, which is precisely why the closed consumer set exists |
| Nested-argument smuggling through a batch verb | Elevation of privilege | Phase 29's problem, not this one, but the store's API shape must not make it easier: no meta-verb, no eval, no name-dispatch by string from caller data |
| A corrupt/foreign file read as an empty store | Tampering (silent data loss) | The meta row + `schema_version` + `integrity_check` refusal (C-2). This is a **security** control as much as a correctness one: it is the difference between "refused" and "your annotations are gone" |
| Unbounded blob growth via `external_file` typing or a huge comment | DoS | Bound comment length and range size at validation. A 64K address space caps ranges naturally; comments do not cap themselves |
| Snapshot directory growth | DoS (disk) | `snapshots/` grows one file per write. Cap the retained count (a bounded ring) or the phase ships an unbounded disk consumer. **Name this in the plan** — my prototype did not bound it |
| `enableLoadExtension` / `loadExtension` | Elevation of privilege | Present on `DatabaseSync.prototype`. **Never call either, and never pass `allowExtension: true`.** Worth a structural assertion that neither identifier appears in `anno-store.ts` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `anno-*` module prefix and the three-module split (`anno-types` / `anno-index` / `anno-store`) | Architecture Patterns | Low. A naming/structure choice, not a fact. Every hard constraint on it was verified (no `anno`, outside the classification glob, single stable prefix, names free). The planner may rename freely |
| A2 | `<project>.annostore` as the store file extension and a `snapshots/` sibling directory | Runtime State Inventory | Low. Nothing depends on it yet. Must be decided here because a later change is a user-visible file rename |
| A3 | The comment-contradiction rule is derived from `CONFIDENCE_GRADES` (code-graded comment vs a data retype, and vice versa) | Planted-Violation Reddenability | **Medium.** The five grades and `parseConfidencePrefix()` are verified; the *mapping* from grade to "contradicted by which retype" is my inference. If the intended rule is different (e.g. any comment at all is "contradicted"), criterion 3's second planting changes shape. **Worth a one-line owner confirmation** |
| A4 | The tie-break is "equal length → higher id (later insertion) wins" | The Cross-Validation Oracle | **Medium.** Criterion 2 requires *a* pinned tie-break but does not name one. Any deterministic rule satisfies it; this one is the cheapest to implement in both oracles independently. Pick it explicitly rather than letting a sort order decide |
| A5 | The `access_kind` mnemonic map (`sta`/`stx`/`sty` → `WRITE`; `inc`/`dec`/`asl`/`lsr`/`rol`/`ror` + RMW illegals → `READ_WRITE`; rest → `READ`) | Contradictions C-5 | **Medium.** Derived from 6502 semantics, not from any in-repo table (`OpcodeEntry` has no access field — verified). If Ghidra's classification differs in a corner (e.g. `bit`, `cmp`, the `jsr`/`jmp` flow types), a v0.8.0 comparison will disagree. Mitigation: store the field, build nothing on it, and say the classifier is this project's |
| A6 | Recommending the default `delete` journal mode over WAL | node:sqlite section | Low. Both are proven durable across `SIGKILL`. Reversible at any time, though `journal_mode` is a persistent database property (P-11) |
| A7 | The four access-kind member spellings (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) are the right vocabulary | Contradictions C-5 | Low-medium. `[CITED]` from Ghidra via this project's own research notes and observed transcripts — **not** verified against any code in this repo. `REQUIREMENTS.md` fixes them, so this is really a note that their provenance is a citation, not a read |
| A8 | Bounding the `snapshots/` directory is required | Security Domain | Low. Unbounded growth is certain; only the bound's shape is a choice |

**Nothing in the Assumptions Log blocks planning.** A3 and A4 are the two worth
resolving before the plan is written; both are one-line decisions.

## Open Questions (RESOLVED)

**All six were answered during planning and execution of `28-01`..`28-06`; each carries its resolution inline below.** The section is kept in full rather than trimmed, so a later reader can see what was open, what was decided, and where the decision is now pinned.

1. **Does the store emit label `kind` in the census's capitalised spelling, or is a second boundary extracted?** — **RESOLVED (`28-03`).** The recommendation was taken: the spelling is matched and cross-checked rather than a second boundary extracted. This is verified truth 11 in `28-VERIFICATION.md` — all 12 `DATA_TYPES` map totally, `block-class.ts`'s import list is still empty, and the derived cross-check lives at `block-class.test.ts:130` with a `DATA_TYPES.length === 12` non-vacuity pin.
   - What we know: the census compares `"User"`/`"Auto"`/`"System"`/`"Platform"` inline at four verified sites, and `SEAM-03`'s "two functions" measurement did not include them.
   - What's unclear: whether Phase 28 is the right place for a second extraction, or whether matching the spelling and cross-checking it is enough.
   - Recommendation: **match the spelling, add a derived cross-check test, and record the block-lowercase / kind-capitalised asymmetry as a decision.** Cheapest, and it makes the failure mode loud. Extracting the boundary properly is a defensible larger alternative; either way it must be a named task, because the failure is a measured number silently going to zero.

2. **How is C-5 resolved — is there an `anno_xref` table at all?** — **RESOLVED (`28-01`).** The recommendation was taken: the table exists with its `access_kind text not null` column from the first write and nothing is stored in it this milestone. Verified truth 5.
   - What we know: `STORE-05` requires the column; Phase 29 forbids caching derived xrefs.
   - What's unclear: whether any xref is non-derivable in this milestone (the `COMPUTED_JUMP` case is, but its producer is held for v0.8.0).
   - Recommendation: create the table with the column, store nothing in it during this milestone, and assert the column exists and accepts exactly the four members. That satisfies "carries the field from the first write" without creating the second truth Phase 29 forbids. If instead the answer is "no table", `STORE-05`'s xref clause needs an explicit re-reading in the plan.

3. **Are all four split variants needed?** — **RESOLVED (`28-01`): yes, all four.** `lo_hi_address`, `hi_lo_address`, `lo_hi_word` and `hi_lo_word` all ship in the 12-member vocabulary. Verified as goal criterion 1.
   - What we know: the schema names four; the orientation axis is observably different (verified); the address-vs-word axis is `creates X-Refs` versus not (verified in the schema text).
   - Recommendation: **keep all four.** The decision is irreversible (orientation is unrecoverable from data that never recorded it), `DECOMP-01` is sized for it, and shipping fewer re-creates the `da65` expressiveness boundary that got `cc65` rejected. The cost of four over two is a handful of lines; the cost of being wrong is a hand re-annotation.

4. **FTS5 versus `LIKE 'prefix%'`** — **RESOLVED (`28-01`): `LIKE`, no FTS5 table.** Recorded as trap 5 in `anno-store.ts:84-86` with the measurement beside it; verified truth 5 confirms no FTS5 table exists. The Phase 29 search surface (`STORE-06`) inherits the open half.
   - What we know: measured — indexed `LIKE 'prefix%'` 2.02 ms, infix full scan 4.49 ms, FTS5 `MATCH` 2.99 ms with a 121.8 ms rebuild, on 20,000 rows.
   - Recommendation: **`LIKE`, and defer the decision to Phase 29 by not creating an FTS5 table now.** Adding FTS5 later is additive; removing it is a schema migration. The measurement says FTS5 buys nothing at these row counts.

5. **Does the phase want a spike?** — **RESOLVED: no, and none was run.** The phase went straight to planning.
   - **No.** The spike's stated purpose was to "measure the chosen persistence route's planted-violation reddenability on this repo's real workload." That measurement is **done, in this research**: the exact criterion-4 sequence was run, and removing the `COMMIT` was observed to redden both halves of one test. The prototype is at `~/.cache/gsd-probe/c4/` and is ~90 lines. A spike phase would re-run what is already in this document. What remains is the two open *decisions* (Q1, Q2), which are decisions rather than measurements.

6. **Does the snapshot bound belong in this phase?** — **RESOLVED (`28-06`): yes.** Shipped as `MAX_SNAPSHOT_REVISIONS = 32` in `anno-types.ts`, the single home of the bound. Its post-revert correctness is what gap 1 reopened and plan `28-07` closes.
   - What we know: `snapshots/` grows one file per write, unbounded, in my prototype.
   - Recommendation: yes — a bounded ring (e.g. the last N revisions) with the bound named. Otherwise the phase ships a monotonically growing disk consumer and the fix later has to reason about which snapshots a revert might still need.

## Sources

### Primary (HIGH confidence)

- **This repository at HEAD**, read with `Read`/`sed` this session. Every `[VERIFIED: path:lines]` tag in this document cites a file and line range I opened, with the values quoted verbatim beside the claim:
  `src/mcp/vice/anno-tools.ts` (170-177, 233-334, 405-420, 467-510, 526), `block-class.ts` (32-52, 126-137), `block-class.test.ts` (26-137, 186-191, 218-227), `anno-coverage.ts` (206, 1392, 1430-1432, 1869, 2180), `anno-coverage.test.ts` (616, 647-649), `anno-confidence.ts` (81-114, 139, 175), `shipped-modules.ts` (1-80, 105-205), `hostpath-consumers.test.ts` (32-70, 120-260), `module-classification.ts` (133-152, 169-251), `module-classification.test.ts` (60-90, 288-623), `spawn-seam.test.ts` (33-53, 176-205), `comment-phase-pointers.test.ts` (1-77, 271-320), `vice.ts` (14-18, 245-292), `stock-address.ts` (12, 52-76, 91-180, 185-205), `disasm-opcodes.ts` (183-215), `disasm-decoder.ts` (51-85), `vice-proxy.ts` (3212-3236, 3263-3276), `test-gate.mjs` (1-135), `audit-integrity.test.ts` (535-605), `docs-linerefs.test.ts` (1-99), `load-order.test.ts` (1-30), `package.json` (files[], scripts, engines), `scripts/check-npm-packages.mjs` (207-260)
- **Live execution on this host**, 2026-08-27 — probes at `~/.cache/gsd-probe/` and `$SCRATCH/dur|j|j2`: `node --version`; `node:sqlite` module/prototype/session/constants surface; `pragma journal_mode`/`synchronous`/`compile_options`/`integrity_check`/`quick_check`/`data_version`; four `SIGKILL` durability matrices; three truncation shapes; the four `node:sqlite` access routes; `--disable-warning=ExperimentalWarning`; per-edit cost on ext4 and on tmpfs; `vacuum into` and `backup()`; the cross-process revision CAS; the 65,536-address paint-vs-scan cross-validation; FTS5 vs `LIKE`; and the **full criterion-4 combined test in both the committing and the planted-violation configuration**
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (§Phase 27-32 and §Sequencing Rationale), `.planning/STATE.md`, `.planning/config.json`, `.planning/ENGINEERING_RULES.md` §4-5, `./CLAUDE.md`, `.planning/phases/27-shared-seams-extracted/{27-PATTERNS.md,deferred-items.md}`

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` (49, 71, 210) and `.planning/research/SUMMARY.md` (131) — the xref access-kind vocabulary and the store-the-field-build-nothing recommendation. Project research documents, not primary sources for Ghidra's API.
- `.planning/notes/dxa-ghidra-pivot.md` (40-42) — observed `COMPUTED_JUMP` / `READ_WRITE` transcript lines on the 279-byte fixture.
- `.planning/phases/23-.../23-RESEARCH.md` (613-620) — an unresolved computed dispatch produces **no** reference at all, which is why a non-derivable xref row is a real category.

### Tertiary (LOW confidence)

- The six-interval-tree-package survey and the `better-sqlite3` 11.4 MB / eight-prebuild figures. Carried from `REQUIREMENTS.md`'s `## Out of Scope`; not re-verified this session, and not re-opened — both are settled decisions, and my own paint-array measurement independently supports keeping the index owned.

**No web search or external documentation lookup was used or needed.** The two
questions that mattered — what `node:sqlite` actually does on the pinned Node line,
and what this repo actually contains — are both answerable only by running code and
reading files on this host, and both were.

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** — one built-in, zero packages, every capability probed live on the exact Node the project pins.
- **Architecture: HIGH** — the module split is driven by two verified hard constraints (`block-class.ts`'s asserted-empty import list; the tie-break pin being unreachable if narrowest-wins sits behind the write path) rather than by preference. `anno-*` naming is `[ASSUMED]` and free to change.
- **Durability / revert: HIGH** — the exact criterion-4 sequence was executed and its planted violation observed red. This is the milestone's one irreversible decision and it is discharged by observation.
- **Concurrency refusal: HIGH** — observed across two real OS processes.
- **Narrowest-wins / cross-validation: HIGH** — 279 ms, zero disagreements, measured.
- **Pitfalls: HIGH** — every guard named was opened and its actual predicate quoted; the 44-failure baseline and the hanging child come from Phase 27's own recorded deferred items.
- **Contradictions: HIGH on C-1..C-4 and C-6** (each measured or read); **MEDIUM on C-5**, which is a genuine textual tension between two roadmap sections whose resolution is an owner/planner decision, not a measurement.
- **`STORE-05` xref vocabulary: MEDIUM** — `[CITED]` from project research notes describing Ghidra, not verified against code in this repo. Flagged as A5/A7.

**Research date:** 2026-08-27
**Valid until:** 2026-09-26 (30 days). Two things would shorten it: a Node minor bump on this host (the `node:sqlite` surface is still marked *active development*, which is exactly why `STORE-07` exists), or any commit touching `block-class.ts`, `shipped-modules.ts`, `hostpath-consumers.test.ts` or `package.json`'s `files[]`.



