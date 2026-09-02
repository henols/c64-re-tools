# Stack Research

**Domain:** An owned, persistent, undoable annotation store with per-range interval typing over a 64K address space, reached through a proxy-local MCP surface (v0.7.0, "Own the Annotation Store")
**Researched:** 2026-08-26
**Confidence:** HIGH — every number, version and API fact below was produced this session by running the real thing on this host, reading the upstream git source, or querying the npm registry API. Nothing is recalled from training data. See "Sources and evidence ceilings" for what each claim rests on and which two claims are weaker.

> **Note on the confidence seam.** `gsd-tools query classify-confidence` has no provider id for "ran the binary locally / read upstream git". Its taxonomy returns `LOW` for `npm`/`registry`/`local` and `MEDIUM` for `context7`. That taxonomy is inverted relative to this project's own normative hierarchy (`ENGINEERING_RULES.md` §7: *real external system / live end-to-end behavior* is the top tier). The confidence tiers stated in this document follow §7, which is the governing rule here, and every claim names its oracle so a reader can re-grade it.

---

## Headline finding

**No new runtime dependency. One new built-in module.**

The store is built on **`node:sqlite`** — a Node built-in since v22.5.0, out from behind `--experimental-sqlite` since v22.13.0, therefore already unconditionally available at this project's declared floor of `>=22.18.0`. It adds:

- zero entries to `dependencies`
- zero bytes to either published tarball
- zero change to `package-lock.json`, so the `SessionStart` lockfile-hash gate stays a no-op
- zero build step (it is `internalBinding('sqlite')`, not a native addon)
- zero change to the documented prerequisite story

`ENGINEERING_RULES.md` §4's six-point dependency bar is therefore **not triggered at all** — there is no new dependency to justify. The prior milestone's conclusion ("no new runtime dependency was needed") holds for this milestone too, and for a stronger reason: the capability that previously had to be hand-rolled is now in the runtime.

Three things stay owned code, deliberately, because measurement says the libraries are worse:

| Concern | Decision | Why |
|---|---|---|
| Per-range typing / narrowest-wins lookup | **~60–120 lines of owned code** (paint array + run-length) | 0.018 µs/lookup vs 42.6 µs for the SQL formulation and 4.6 µs for a naive scan. Every surveyed interval-tree package returns *all* overlapping intervals with no narrowest-wins tie-break, so you write the deciding logic regardless. Measured, cross-validated. |
| Undo | **Inverse-command journal in the same SQLite transaction** | SQLite savepoints do not survive process exit; the session/changeset extension is exposed but `sqlite3changeset_invert` is **not**, so inverses cannot be derived mechanically. |
| Tool-argument validation | **Owned, hand-rolled, named-error** | `vice-proxy.ts:3216-3230` performs *no* argument validation by design (`validate: (value) => ({ value })` always succeeds). Do not add `zod` — it is present only as a transitive `@mastra` dependency. |

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:sqlite` (`DatabaseSync`) | Built-in. Bundles **SQLite 3.50.4** on the Node 22.22.0 on this host (`SELECT sqlite_version()`, run live). Added Node v22.5.0; flag removed v22.13.0 / v23.4.0 (nodejs/node PR #55890) | The durable store: symbols, comments, typed ranges, scopes, enums, edit journal | The only option that satisfies **all** of: no build step, no dependency, no prerequisite-story change, crash-safe transactions, and a real query language for the search/xref surface. Live-verified: mutate → `SIGKILL` with no `close()` → reopen returns the mutation, `PRAGMA integrity_check` = `ok`. Also verified working under Node's native type-stripping from a `.ts` file, and typechecking clean against the project's already-installed `@types/node` 24.13.3 (`node_modules/@types/node/sqlite.d.ts` exists). |
| Owned paint-array interval index | new, ~60–120 lines | Narrowest-range-wins address → range lookup over the 64K space | O(1) lookup at **0.018 µs**; full rebuild for 2,700 ranges costs **7.5 ms**, so rebuild-on-mutation is affordable and no incremental-maintenance code is needed. The pattern already exists in this repo: `anno-coverage.ts`'s `toRuns()` paints a `Uint8Array` then run-length-compacts it. Extend an established seam rather than adding a parallel one (`ENGINEERING_RULES.md` §1). |
| Owned inverse-command journal | new, one SQLite table | Undo / redo across process restart | Satisfies the milestone's exact durability wording — *mutate → kill → reopen returns the mutation* — because the mutation and its inverse commit in **one** transaction. Measured **1.16 ms/edit** on ext4/NVMe with `synchronous=FULL`, i.e. the same order as a bare `fsync()`: transactional integrity costs nothing above the durability floor. |
| `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` | existing, 1,042 lines | The typed decode the store annotates, and the ACME rendering | Already model `illegal-opcode` and `acme-unassemblable` as `DisasmNote`s and already round-trip byte-exact through real ACME (`disasm-roundtrip.test.ts`). `decode(bytes, startAddress, opts)` is the seam the store's typed-range engine calls per `code` range. |
| `memmap.json` + `anno-regbits-gen.ts` + `anno-enum-gen.ts` | existing, 995 lines + 959 address entries | Machine knowledge and project enum generation | Retarget, do not rewrite. `anno-enum-gen.ts` already owns `registerKeyFor()`, `variantNameFor()`, `pairImmediateLoadsToStores()`, `createOrUpdateEnum()` — the whole enum pipeline. Only its I/O tail (which currently talks to an external analyser project) changes. Note `memmap.json` is **duplicated** at `src/skills/c64-memory-mapping/memmap.json` and `installer/skills/c64-memory-mapping/memmap.json`; the installer copy is synced by `installer/scripts/sync-skills.mjs`, so a retarget must not read the installer copy. |
| ACME | 0.97 "Zem" (31 Jan 2021), at `/home/henrik/.local/bin/acme` on this host | External oracle for the ACME export | The reassembly gate. **See the correction below** — the route is *not* `anno-verify.ts`. |
| `anno-test-gate.ts` → rename | existing, 166 lines | The shared ACME-availability seam (`ACME_BIN`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()`) | This is the surviving ACME gate. It carries an `anno-` name but is **not** the external analyser glue — it must be renamed and kept, and the whole-tree grep gate must not eat it. |

### Supporting Libraries

**None.** No `npm install` runs in this milestone.

| Library | Version present | Status for this milestone |
|---------|---------|-------------|
| `@mastra/mcp` | 1.15.0 (declared) | Unchanged. Serves the stdio surface; the store's tools register through `buildViceTool()` at `vice-proxy.ts:3263`, exactly as the 17 `anno_*` tools do at `:3402`. |
| `@mastra/core` | 1.55.0 (declared) | Unchanged, untouched. |
| `@modelcontextprotocol/sdk` | 1.30.0 (transitive) | **Precision correction to a carried belief:** the repo *does* already import it directly — `vice-proxy.ts:174` imports `CallToolRequestSchema` from `@modelcontextprotocol/sdk/types.js`. The prohibition in `anno-mcp-client.ts`'s header is scoped to that module (a *client* transport), not repo-wide. Do not widen the direct-import surface for the store; it needs nothing from the SDK. |
| `zod` | 4.4.3 (transitive, via `@mastra`) | **Do not import.** Undeclared transitive. See "What NOT to Use". |
| `@types/node` | 24.13.3 (dev) | Already ships `sqlite.d.ts`. No bump needed. Confirmed: `createSession` / `applyChangeset` typed; **no `invert`** anywhere in it. |
| `typescript` | 7.0.2 (dev) | Typechecks `node:sqlite` usage clean under `--strict --module nodenext`. Verified. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test '*.test.*'` | All store tests | No new framework. Colocated `*.test.ts`. |
| Real ACME 0.97 | The reassembly oracle for the export | Extend `disasm-roundtrip.test.ts`'s pattern: spawn `acme` with an **argv array** (never a shell string), byte-diff the result, and never treat an ACME stderr *warning* as failure (ACME 0.97 documents warnings on stderr). Gate through `anno-test-gate.ts`'s `acmeSkipReasonFor()` / `VICE_REQUIRE_ACME`, so CI fails on a missing ACME while a local run skips visibly. |
| `--disable-warning=ExperimentalWarning` | Silences the Node-22-only `node:sqlite` warning | Verified working on 22.22.0. **Do not make any test assert stderr is empty** as a proxy for success — see "Version Compatibility". |
| `db.exec("PRAGMA integrity_check")` | Post-crash assertion in the durability test | Returns `{ integrity_check: 'ok' }` after an uncommitted-close `SIGKILL`. Live-verified. |
| `node:sqlite`'s exported `backup()` | Pre-destructive safety copy | Mirrors the existing `incident-record.ts` "write evidence before any destructive action" precedent. Not the undo mechanism. |

---

## 1. Persistence format — the decision, and every option measured

### The measurements (real disk, not tmpfs)

Run on `/dev/nvme0n1p4`, ext4 — **not** in `/tmp`, which is a 16 GB tmpfs on this host and makes every `fsync()` nearly free, understating the JSON route's cost by ~2×. Seed store: 6,000 symbols, 3,000 comments, 2,500 typed ranges (561 KB as JSON, 712 KB as SQLite). Workload: 2,000 mutating tool calls, each durable on return (the project's existing `save-before-return` contract, D18-08).

| Route | Per mutating call | Scales with | Notes |
|---|---|---|---|
| **`node:sqlite`, WAL + `synchronous=FULL`, one txn per edit incl. journal insert** | **1.16 ms** | edit size | The recommendation. |
| Append-only NDJSON + `fsync()` per edit | 1.36 ms | edit size | Same order — the cost *is* the fsync. But you then own torn-tail detection, compaction, recovery and index rebuild. |
| Whole-file JSON + atomic rename (`write` → `fsync` → `rename` → `fsync(dir)`) | **16.03 ms** | **total store size** | 14× slower and getting worse as the project grows. At 766 KB already; a fully annotated 64K program with per-address comments is several MB. |
| SQLite narrowest-range lookup via SQL | 42.6 µs / lookup | — | 2.8 s for one full 64K pass. See §2. |

### Options, with verdicts

| Option | Version (verified via registry API, 2026-08-26) | Build step? | Verdict |
|---|---|---|---|
| **`node:sqlite`** | Built-in; SQLite 3.50.4 on Node 22.22.0 | **None** | **ADOPT** |
| `better-sqlite3` | **13.0.3**, published 2026-08-05, `engines.node >= 22`, MIT, 159 versions | No compiler on 8 targets — but see below | **REJECT** |
| `node-sqlite3-wasm` | **0.8.60**, published 2026-07-28, zero deps, MIT | None (WASM) | **NOT NEEDED** — the only reason to reach for it is a platform `node:sqlite` does not exist on, and there is none: it is in the runtime. |
| `sqlite3` (node-sqlite3) | **6.0.1**, published 2026-03-12, BSD-3, has `install` script, deps on `prebuild-install` + `tar` | Yes (prebuild-install, node-gyp fallback) | **REJECT** — async API, install script, four transitive deps. |
| Plain JSON + atomic rename | owned | None | **REJECT as primary** — 16 ms/edit scaling with store size, and a *weaker planted violation* (below). Keep the **technique** for the deterministic text export. |
| Append-only NDJSON + compaction | owned | None | **REJECT** — same durability cost as SQLite, but you hand-build recovery, compaction and every index. `ENGINEERING_RULES.md` §4(2): the platform is not insufficient here. |
| `lmdb` | **3.5.6**, published 2026-06-18, `gypfile: true`, install script, 6 transitive deps incl. `msgpackr`, `node-addon-api@^6` | Yes | **REJECT** — native, gyp, and a key/value store means you hand-build the query surface anyway. |
| `classic-level` / `level` | **3.0.0** / **10.0.0**, both published 2025-04-20, `gypfile: true`, `node-gyp-build` | Yes | **REJECT** — same reasons. |
| `lowdb` | **7.0.1**, published **2023-12-26** (2.7 years stale), deps on `steno@^4.0.2` | None | **REJECT** — it *is* the whole-file-JSON route, plus a dependency, plus staleness. |
| `write-file-atomic` | **8.0.0**, published 2026-05-08, ISC. `engines.node: "^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0"` | None | **REJECT, and note why:** its engines floor is **above** this project's declared `>=22.18.0`. Adopting it forces an `engines` bump on `@henols/vice-mcp`, i.e. a breaking change to the documented prerequisite for an atomic-rename helper that is ~15 lines of `node:fs`. |
| `proper-lockfile` | 4.1.2, published **2021-01-25** | None | **REJECT** — 5.5 years stale, and the store is single-writer by construction (container-side, one project, the existing FIFO-queue pattern). SQLite's own locking covers the rest. |

### Why `better-sqlite3` 13.0.3 loses, precisely

This deserves detail because the "native build breaks the no-build-step constraint" intuition is now *out of date* and would be the wrong reason to reject it.

Verified by downloading and unpacking `better-sqlite3-13.0.3.tgz` (11.4 MB) this session:

- `gypfile: false`, **no `install`/`postinstall` script**. It ships **eight prebuilt `.node` binaries** in `prebuilds/`: `linux-{x64,arm64}`, `linuxmusl-{x64,arm64}`, `darwin-{x64,arm64}`, `win32-{x64,arm64}`. On any of those, **no compiler is needed** — the "no build step" constraint is genuinely satisfied.
- So it must lose on other grounds, and it does:
  1. **11.4 MB download / 27.3 MB unpacked, per consumer, always.** All eight binaries plus the full SQLite amalgamation (`deps/**`, `src/**`) install unconditionally; there is no `optionalDependencies` platform split. Adding it changes `package-lock.json`, so `scripts/ensure-mcp-deps.sh` fires a real `npm ci` for every existing user's next session.
  2. **No fallback off the eight targets.** `lib/binding.js` (read this session) falls through to `require(path.join(__dirname,'..','build','Release','better_sqlite3.node'))`. With no install script, that file never exists → a hard `MODULE_NOT_FOUND` on e.g. `linux-armv7`, `freebsd`, `s390x`, `linux-riscv64`. That is *worse* than the old node-gyp behaviour, which at least compiled.
  3. **It buys nothing.** Everything the store needs — WAL, `synchronous=FULL`, savepoints, user-defined functions, `json_extract`, FTS5, R*Tree, generated columns, session/changeset — is present in `node:sqlite`, all confirmed live (below).
  4. `ENGINEERING_RULES.md` §4(1) and §4(2) both fail: existing runtime code *does* provide the capability, and the standard library is *not* insufficient.

### What `node:sqlite` on Node 22.22.0 actually has — probed, not assumed

Every line below was executed on this host:

```
sqlite_version()               3.50.4
PRAGMA journal_mode = WAL      -> 'wal'          (works)
PRAGMA synchronous             -> 2 (FULL)       (default!)
PRAGMA foreign_keys            -> 1 (ON)         (default — unlike the sqlite3 CLI)
BEGIN / SAVEPOINT / ROLLBACK TO / RELEASE / COMMIT   all work
db.function("ovl", fn)         user-defined functions work
json_extract('{"a":5}','$.a')  -> 5              (JSON1 compiled in)
GENERATED ALWAYS AS (...) VIRTUAL                works
CREATE VIRTUAL TABLE ... USING rtree(...)        works
CREATE VIRTUAL TABLE ... USING fts5(...)         works
DatabaseSync.prototype:  open close prepare exec function location aggregate
                         createSession applyChangeset enableLoadExtension
                         loadExtension  + [Symbol.dispose]
StatementSync.prototype: run get all iterate columns setAllowBareNamedParameters
                         setAllowUnknownNamedParameters setReadBigInts setReturnArrays
module exports:          DatabaseSync StatementSync constants backup
```

Two of these are load-bearing findings:

- **`foreign_keys` defaults to `1`** in `node:sqlite`, unlike raw SQLite/the CLI. So `ON DELETE CASCADE` on the range/scope tables is enforced without an explicit pragma. Rely on it, but set it explicitly anyway so the schema is self-documenting.
- **FTS5 is compiled in.** The milestone's *"search over the typed decode"* requirement can be an FTS5 virtual table over comments and labels rather than owned substring matching, at zero dependency cost. (Weigh against: FTS5 tokenisation is tuned for prose, and label search wants prefix/identifier matching — `LIKE 'f_%'` on an indexed column may serve better. Both are free; decide at plan time.)

### Recommended pragmas and file layout

```sql
PRAGMA journal_mode = WAL;      -- crash-safe, and commit cost ≈ one fsync
PRAGMA synchronous = FULL;      -- already the default; state it explicitly
PRAGMA foreign_keys = ON;       -- already the default; state it explicitly
```

**One honest cost of WAL:** it leaves `<name>.db-wal` and `<name>.db-shm` alongside the database. On a clean `close()` they are removed; after a `SIGKILL` they **persist** (observed: 12,392-byte `-wal`, 32,768-byte `-shm`). So the store is *not* single-file at rest after an unclean exit. If single-file-at-rest matters more than throughput, `journal_mode = DELETE` + `synchronous = FULL` gives one file with the same crash guarantee at higher per-commit cost. **Recommendation: keep WAL** and treat the sidecars as what they are — recovery state that the next `open()` consumes.

**Where the file lives.** Not `.vice-supervisor/` — that is gitignored, host-synchronised, and owned by the broker's lifecycle. Mirror the existing `anno_*` convention instead: the store path is an **explicit tool argument**, resolved through `repo-root.ts`'s `repoRoot()` when relative. Add `*.db-wal` / `*.db-shm` to `.gitignore`.

**Commit the export, not the database.** This project has already decided the shape of this problem — Key Decisions: *"Make the store canonical and the Markdown memory map a generated view … `render-memmap --check` plus a render-digest drift guard makes the divergence mechanical rather than a review item."* Apply the same pattern: SQLite is the working store; a deterministic, sorted, newline-stable text export (written with the atomic-rename technique) is the git-diffable artifact, guarded by an `--check` digest comparison. This is the correct home for the JSON/atomic-rename technique that lost as the primary store.

---

## 2. Interval / range data structure — owned, and the measurements say so

### Measured, on this host, cross-validated

Domain: 2,500 narrow ranges (16 bytes each) plus 200 wide overlapping ranges (2,001 bytes each) — deliberately including overlap, so narrowest-wins is actually exercised.

| Approach | Per lookup | One full 64K pass | Retained memory | Build cost |
|---|---|---|---|---|
| **Paint array (`Int32Array(65536)` of winning range ids)** | **0.018 µs** | **1.2 ms** | 256 KB | 7.5 ms for 2,700 ranges |
| Sorted-by-`lo` array + binary search + bounded forward walk | 0.31 µs | 20 ms | ~0 | O(n log n) sort |
| Naive O(n) scan over all ranges — *the shape `anno-coverage.ts`'s `classAt()` already has* | 4.6 µs | **301 ms** | 0 | none |
| SQL `WHERE lo<=? AND hi>=? ORDER BY (hi-lo) LIMIT 1`, index on `lo` | 42.6 µs | **2.8 s** | 0 | none |

The paint array and the sorted+binary-search implementation were cross-checked against each other on **all 65,536 addresses: 0 disagreements.** That is two independently written implementations agreeing, not one implementation agreeing with itself.

A better-indexed SQL formulation (e.g. a materialised `width` generated column with a composite index) would improve on 42.6 µs — but not by the 2,400× needed to close the gap, and it cannot beat an array index.

### Verdict: ~60–120 lines of owned code. No library.

The deciding fact is that **the domain is bounded at 64K**. An interval tree exists to avoid materialising a sparse or unbounded key space; a C64 address space is neither. A 256 KB `Int32Array` *is* the index, and its lookup is a single array read.

Design, concretely, so a planner does not re-derive it:

- SQLite's `range` table is the **source of truth**; the paint array is a derived in-memory index rebuilt from it.
- Build: `Int32Array(65536).fill(-1)` for winner range-id, plus a parallel `Int32Array(65536).fill(0x7fffffff)` for winner width. For each range, for each address in it, overwrite iff `width < currentWidth`. **Narrowest-wins is resolved at paint time, not at query time.** Tie-break for equal widths must be explicit (recommend: higher `range.id`, i.e. the more recent edit wins) and pinned by a test — an unspecified tie-break is exactly the kind of thing that produces a non-reproducible export.
- Rebuild cost is 7.5 ms, so **rebuild on mutation**. Do not write incremental-maintenance code; it is the classic source of index-drift bugs and it buys single-digit milliseconds.
- Queries the paint array does **not** serve — *"list every range covering address X"*, *"list ranges intersecting [a,b]"* — go against the SQLite table. The paint array answers exactly one question: *which range wins at X*.
- Run-length compaction for the JSON/tool-response surface: reuse `anno-coverage.ts`'s `toRuns()` shape (`{start, end, class}`), which already exists and is already tested. Its header states the reason ("the census reports runs rather than a per-byte array so the report stays JSON-safe and stays deep-comparable between two runs") and it applies unchanged.
- **If the domain ever exceeds 64K** (banked ROM/RAM under I/O, an REU): switch to the sorted+binary-search variant at 0.31 µs and ~0 memory, or paint per bank. Both were measured; neither needs a library. State this so a later banking milestone does not reach for a package.

### Libraries surveyed — all rejected, with dates

| Package | Latest | Published | Status | Why rejected |
|---|---|---|---|---|
| `@flatten-js/interval-tree` | 2.0.3 | 2025-11-07 | Maintained; ESM; MIT; deps on `tslib@^2.8.1` | The only genuinely maintained candidate. Returns **all** overlapping intervals with no narrowest-wins tie-break, so the deciding logic is yours regardless — and its lookup can only be slower than an array read. A dependency for the easy half of the problem. |
| `node-interval-tree` | 2.1.2 | 2022-12-12 | Stale ~3.7y; CJS; deps on `shallowequal` | Same semantics gap, plus staleness and a CJS interop wrinkle. |
| `interval-tree-1d` | 1.0.4 | 2021-06-03 | Stale ~5.2y; deps on `binary-search-bounds` | Same. |
| `static-interval-tree` | 1.3.0 | 2016-03-24 | Stale ~10.4y; **no `license` field in the manifest** | Rejected on the licence gap alone; this repo maintains `THIRD-PARTY-NOTICES.md`. |
| `interval-tree2` | 1.1.0 | 2015-09-23 | Stale ~10.9y; 3 versions ever | Abandoned. |
| `augmented-interval-tree` | 0.1.0 | 2017-06-25 | **One version, ever** | Abandoned. |
| `mnemonist` | 0.40.4 | 2026-04-30 | Well maintained; MIT | Excellent general structure library, but has no interval structure with narrowest-wins. Nothing to take. |

---

## 3. Undo model

The requirement is precise and it eliminates most of the field: *"mutate → kill → reopen returns the mutation, and removing the save makes that same test go red."* That is a **durability** requirement on the undo history too — undo must survive the kill, or a session that crashes loses the ability to undo the edits it recovered.

### Recommendation: inverse-command journal, committed in the same transaction as the mutation

```sql
CREATE TABLE edit_log (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   TEXT    NOT NULL,   -- one composite tool call = one undoable unit
  tool       TEXT    NOT NULL,   -- which MCP tool produced it (audit trail)
  forward    TEXT    NOT NULL,   -- JSON: the op that was applied
  inverse    TEXT    NOT NULL,   -- JSON: the op that reverses it
  undone     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);
CREATE INDEX edit_log_group ON edit_log(group_id);
```

- **One transaction per mutating tool call**: `BEGIN` → apply mutation → insert the `edit_log` row(s) → `COMMIT`. Measured 1.16 ms including the journal insert.
- **Undo** = highest `seq` with `undone = 0`; apply its `inverse` and set `undone = 1`, all in one transaction. Composite calls undo as a `group_id`, atomically.
- **Redo** = lowest contiguous `seq` with `undone = 1`; re-apply `forward`. A new edit truncates the redo tail (standard, and the alternative — branching history — is scope this milestone does not have).
- **Every inverse must be constructible at edit time.** This is the real design constraint, and it is where undo models fail: `set_label(addr, name)` inverts to `set_label(addr, previousName)` *or* `delete_label(addr)` depending on prior state, so the mutation handler must **read the prior state inside the same transaction** before writing. A handler that computes the inverse after the write, or from the arguments alone, is wrong. Make that a reviewed invariant, not an assumption.
- **Range typing needs an interval-aware inverse.** `set_type([lo,hi], "table")` may split, shadow or fully cover several existing ranges. The honest inverse is *"restore this exact list of prior range rows over [lo,hi]"* — so the inverse payload carries the displaced rows, not a single reverse op. This is the single most likely place for an undo bug; plan a test that types overlapping ranges in three layers, undoes twice, and asserts byte-for-byte equality of the paint array.

### Rejected alternatives, each for a specific reason

| Approach | Verified state | Why rejected |
|---|---|---|
| **SQLite `SAVEPOINT`** | Works: `BEGIN; INSERT; SAVEPOINT sp1; INSERT; ROLLBACK TO sp1; RELEASE sp1; COMMIT;` executed live and left exactly the pre-savepoint row | Savepoints are **intra-transaction and in-process**. They do not exist after `close()`, let alone after a `SIGKILL`. They cannot be the undo model. **Do use them** for atomicity *within* one composite tool call (e.g. "type this range and rename every label inside it") so a partial failure leaves no half-applied edit. |
| **SQLite session / changeset extension** | Exposed and working: `db.createSession({table})`, `session.changeset()` (22-byte changeset for one insert), `session.patchset()`, `db.applyChangeset(cs)` → `true`, applied cleanly to a second database. `constants` exports the eight `SQLITE_CHANGESET_*` conflict codes | **`sqlite3changeset_invert` is not exposed.** No `invert` on the session or changeset, and no `invert` anywhere in `@types/node@24.13.3`'s `sqlite.d.ts` (grepped). Without it you would hand-decode SQLite's changeset binary format to derive an inverse — a large, undocumented-in-Node surface for something a `JSON` column gives free. **Revisit trigger:** if Node exposes `invert`, changesets become a strictly better undo log (they capture *actual* row deltas rather than a hand-maintained inverse, eliminating the "inverse computed wrong" bug class). Worth recording as a named reversal criterion in this project's usual style. |
| **Snapshot-diff / copy-on-write snapshots** | `backup()` is exported from `node:sqlite` and works | Full snapshots of a 712 KB database per edit is wasteful, and *presenting* what an undo did then requires diffing two databases — work the command log gives for free. **Do use `backup()`** for a single pre-destructive-operation safety copy (bulk retype, import, schema migration), mirroring `incident-record.ts`'s "write evidence before any destructive action" precedent. |
| **Immutable persistent structures (`immer` 11.1.18, 2026-08-19)** | Maintained, zero deps | In-memory only: the undo stack dies with the process, which is precisely the requirement it must satisfy. Plus a dependency for a data-structure discipline TypeScript already expresses. |
| **Append-only op log as the *only* store (event sourcing)** | Measured 1.36 ms/edit | This *is* the journal, minus the queryable projection. Keeping both — a queryable current state and a journal — in one transactional file is what SQLite is for. Choosing the log alone means rebuilding all state by replay on every open, and owning compaction. |

### A non-obvious testability argument for SQLite over atomic JSON

`ENGINEERING_RULES.md` §6 requires the durability guard to be **observed failing under a planted violation**. The two routes are not equally testable:

- **SQLite:** the planted violation is "drop the `COMMIT`" or "move the `edit_log` insert outside the transaction." A `SIGKILL` after that reliably loses the mutation, so the guard reliably reddens.
- **Atomic JSON:** the planted violation is "remove the `fsync()`." That frequently **still passes**, because the page cache serves the subsequent read on the same machine — you only lose the write on a power cut or kernel panic, which a test cannot stage. A guard that cannot be made to fail is not evidence (§6's closing line).

So SQLite is the better choice on *evidence quality*, independent of speed. Worth stating in the plan, because it is the kind of reasoning this project's own history says gets skipped.

---

## Integration with the existing module set

### A correction the roadmapper needs: the `--verify` seam does not survive the deletion

The milestone text says the ACME export is *"verified by a real ACME through the existing `--verify` seam."* Read directly this session, that seam is **the external analyser's**, not ACME's:

- `anno-verify.ts` (184 lines) imports `buildVerifyArgs` and `runAnno` from `anno-launch.ts` and parses **`analyser --verify`'s stdout** with `VERIFY_LINE_PATTERN = /^[✓✗]\s+(.+?)\s+[—–-]\s+(.+)$/`. It never invokes ACME. When the external analyser is deleted, `anno-verify.ts` and `buildVerifyArgs` die with it.

The genuinely surviving ACME oracle is a different pair of files, and the plan must name them:

| File | Lines | Fate |
|---|---|---|
| `anno-test-gate.ts` | 166 | **Rename and keep.** Owns `ACME_BIN`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()` and the `VICE_REQUIRE_ACME` convention. Not the external analyser glue despite the name — the grep gate must exempt or the rename must precede it. |
| `disasm-roundtrip.test.ts` | 427 | **The pattern to extend.** Already spawns real ACME with an argv array, byte-diffs the reassembly, and documents the "never treat a warning as failure" rule. Its "ACME availability gate (D-08)" test always runs and is never skipped. |
| `src/skills/acme-build/scripts/acme.mjs` | — | The shipped `build` / `sym` / `new` route. Unchanged. |
| `anno-verify.ts`, `anno-launch.ts::buildVerifyArgs` | 184 + part of 357 | **Deleted with the subject.** The store's own verify must be re-built against ACME directly. |

This is a real scope item, not a rename: the store needs a new `verify` path that emits ACME source to a temp dir, spawns ACME, and byte-diffs against the source bytes. `disasm-roundtrip.test.ts` already contains every technique needed.

### The `=*+$01` mid-instruction label idiom — verified against real ACME

The seed asks that this be *preserved rather than rediscovered*. It exists nowhere in the codebase today (grepped), so it must be **built**, and it does work. Verified live with ACME 0.97 on this host:

```asm
!cpu 6510
* = $0801
start
smc_operand = * + $01
        lda #$00
        sta $d020
        lda #$01
        sta smc_operand
        rts
```

`acme -o smc2.prg -l smc2.lbl` exits 0; the label file reads `smc_operand = $802`; the emitted bytes are `a9 00 8d 20 d0 a9 01 8d 02 08 60` — i.e. `sta smc_operand` assembled as `8d 02 08`, correctly targeting the operand byte of the preceding `lda #$00`. The `= * - 1` form placed *after* the instruction resolves identically. **Confidence: HIGH, real-assembler oracle.**

### Typed label prefixes — already owned, and richer than the seed says

`anno-coverage.ts:1384` already owns the vocabulary:

```
AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/
```

Eleven prefixes, not the five the seed lists (`zpp_`/`zpa_`/`f_`/`a_`/`e_`). `anno-coverage.test.ts:946` pins all eleven, and `src/skills/routine-queue-walker/SKILL.md:154,200` documents them for users. **Move this regex into the store's naming module; do not re-derive a subset from the seed.** A five-prefix reimplementation would silently stop recognising `p_`, `j_`, `s_`, `b_`, `r_`, `zpf_` as auto-generated — which is exactly the signal `routine-queue-walker` builds its backlog from.

### The model interfaces already exist

`anno-coverage.ts:192-224` already defines the four record shapes, and they map 1:1 onto the store's tables:

| Existing interface | Becomes |
|---|---|
| `AnnoSymbol { address, name, kind, type? }` | `symbol` table. `kind` ∈ `User`/`Auto`/`System`; `type` ∈ `Subroutine`/`AbsoluteAddress`/… |
| `AnnoComment { address, type, comment }` | `comment` table. `type` ∈ `line`/`side` — **keep both**; the ACME renderer needs the distinction. |
| `AnnoBlockEntry { start_address, end_address, type }` | `range` table. **Widen `type`** from anno's `BlockType` Display strings to the milestone's full seven-value vocabulary: `code`, `byte`, `word`, `address`, `petscii`, `screencode`, `table`. |
| `AnnoCrossReference { address, callers[] }` | `xref` table, or a derived view over the typed decode. |

Rename off the `anno` prefix, keep the field names (they are already the wire shape the absorbed procedures speak), and note `start_address`/`end_address` are **inclusive** in the existing code — carry that, and document it, because half-open vs closed is the other classic interval bug.

### Where `anno-coverage.ts`'s `classAt()` must NOT be copied

`classAt()` (line 342) is a linear scan over `classRuns` — the 4.6 µs/lookup shape measured above, 301 ms per full 64K pass. Its own comment says why it is acceptable there ("Linear over runs, which is what keeps the census JSON-safe"), and for a once-per-census lookup it is. **Do not carry that shape into the store's hot path**, which is queried once per decoded instruction across the whole image. Use the paint array. Note this explicitly in the plan, because copying the nearest existing function is the obvious move and it is the wrong one here.

### Tool-surface registration and argument validation

- Register through `buildViceTool()` (`vice-proxy.ts:3263`), following the existing `anno_*` precedent at `:3402`. This satisfies the architecture constraint **by construction**: neither `rewriteArguments()` call site (`:3029` inside `forwardToVice()`, `:1508` inside `gatherWedgeEvidence()`) is reachable, so there is no interception to forget and the store is backend-agnostic for free. Re-check those line numbers at plan time — `docs-linerefs.test.ts` guards two of them and PROJECT.md warns they drift.
- **The proxy validates nothing.** `vice-proxy.ts:3216-3230`: `rawJsonSchemaAsStandardSchema()` returns `validate: (value) => ({ value })`, and the header says so plainly — *"this proxy has never validated argument shape itself."* So every store tool receives **unvalidated** arguments. Validate in the store: address range `0x0000–0xFFFF`, `lo <= hi`, `type` in the seven-value set, label matches `assertLegalAcmeIdentifier()` (`anno-acme-ident.ts`, `MAX_ACME_IDENTIFIER_LENGTH = 200`) — throwing named error subclasses per the existing `ViceError` convention. **Do not add `zod`.**
- **`anno-acme-ident.ts` (97 lines) is a keeper.** It already enforces ACME identifier legality, which is what stops an illegal label reaching the exporter and failing the ACME oracle late instead of at the setter.

### The tool surface is a diff, not a design

`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json` exists and already classifies every verb the five absorbed procedures call as `curated` / `omit` / `adapt-to-address-input`. Derive the store's surface from it. No stack implication — just: the input exists, at that path, and it survives (it is a `.planning/phases/` artifact, which this project deliberately does not archive).

---

## Installation

```bash
# Core:       nothing. node:sqlite is built in at the project's existing Node floor.
# Supporting: nothing.
# Dev:        nothing.
```

`src/mcp/vice/package.json` is unchanged — same two `dependencies`, same two `devDependencies`, same `engines: { node: ">=22.18.0" }`. `package-lock.json` is unchanged, so `scripts/ensure-mcp-deps.sh` stays a no-op for every existing user. Both published tarballs gain only source files, so `scripts/check-npm-packages.mjs` needs new `files[]` entries and nothing else.

The only prerequisite unchanged-but-worth-restating: **real ACME on `$PATH`** for the export oracle, already documented.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative wins |
|-------------|-------------|---------------------------|
| `node:sqlite` | `better-sqlite3` 13.0.3 | If a measured hot path needs better-sqlite3's faster statement path, *and* the 11.4 MB install plus the hard failure off its eight prebuild targets are accepted. Neither applies: measured cost is 1.16 ms/edit against a durability floor of one fsync. |
| `node:sqlite` | `node-sqlite3-wasm` 0.8.60 | Only on a platform lacking `node:sqlite`. None exists — it is in the runtime on every platform Node ships for. |
| `node:sqlite` | JSON + atomic rename | If the store were tiny and write-rare (< ~50 KB, a handful of edits per session). At 6,000 symbols it is 16 ms/edit and rising. **Keep the technique for the git-diffable text export.** |
| `node:sqlite` WAL | `node:sqlite` `journal_mode = DELETE` | If single-file-at-rest after an unclean exit is a hard requirement (e.g. a user copies the store while a crashed process's sidecars are on disk). Same crash guarantee, higher commit cost. |
| Paint array | Sorted array + binary search | If the address space exceeds 64K (banking, REU) or 256 KB of retained memory becomes objectionable. 0.31 µs/lookup, cross-validated against the paint array on all 65,536 addresses. |
| Owned interval index | `@flatten-js/interval-tree` 2.0.3 | If the domain became unbounded/sparse *and* narrowest-wins were dropped in favour of all-overlaps. Neither is true. |
| Inverse-command journal | SQLite changesets | If Node exposes `sqlite3changeset_invert`. Record as a named reversal trigger — it would remove the "inverse computed wrong" bug class entirely. |
| Owned validation | `zod` 4.4.3 | Never, at the current dependency posture: `zod` is an undeclared transitive of `@mastra`. If the project ever declares it directly and deliberately, revisit. |
| FTS5 for search | `LIKE 'prefix%'` on an indexed column | Both are free (FTS5 is compiled in). FTS5 suits prose comments; `LIKE`/`GLOB` suits identifier and prefix matching, which is what `AUTO_NAME_PREFIX_RE` queries look like. Decide per query at plan time; not a stack decision. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `better-sqlite3` 13.0.3 | 11.4 MB / 27.3 MB per consumer, unconditionally; no fallback off its eight prebuild targets (hard `MODULE_NOT_FOUND` on armv7/freebsd/s390x); changes the lockfile hash so every user's next session runs `npm ci`; and fails `ENGINEERING_RULES.md` §4(1) and §4(2) outright | `node:sqlite` |
| `sqlite3` 6.0.1 | `install` script, `prebuild-install` + `tar` transitive deps, async-callback API | `node:sqlite` |
| `lmdb` 3.5.6, `classic-level` 3.0.0, `level` 10.0.0 | `gypfile: true` + install scripts (a real build step); and a key/value store means hand-building the entire query surface | `node:sqlite` |
| `lowdb` 7.0.1 | Last published 2023-12-26; it *is* the whole-file-JSON route (16 ms/edit, scaling with store size) with a dependency attached | Owned atomic-rename for the text export; `node:sqlite` for the store |
| `write-file-atomic` 8.0.0 | `engines.node: "^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0"` — **above** this project's declared `>=22.18.0` floor. Adopting it forces a breaking `engines` bump for a ~15-line `node:fs` helper | ~15 lines of owned `node:fs`: `open` → `writeFile(fd)` → `fsyncSync(fd)` → `close` → `rename` → `fsync` the directory |
| `proper-lockfile` 4.1.2 | 5.5 years stale; the store is single-writer by construction and SQLite handles the rest | SQLite locking + the existing FIFO-queue pattern |
| Any interval-tree package | `static-interval-tree` has **no licence field**; `interval-tree2` and `augmented-interval-tree` are abandoned (2015 / one version ever); `node-interval-tree` and `interval-tree-1d` are 3.7–5.2 years stale; and the one maintained option (`@flatten-js/interval-tree` 2.0.3) still has no narrowest-wins semantics, so you write the deciding logic anyway | ~60–120 lines of owned paint-array code, extending `anno-coverage.ts`'s existing `toRuns()` pattern |
| `immer` 11.1.18 | In-memory undo dies at process exit — the exact requirement it must satisfy | Inverse-command journal in SQLite |
| `zod` 4.4.3 | Present only as an undeclared transitive of `@mastra`; a direct import is the same phantom-dependency defect class `anno-mcp-client.ts`'s header already names. And the proxy validates nothing anyway, so validation is store-local logic, not a schema layer | Owned validators throwing named `ViceError` subclasses; `anno-acme-ident.ts` for label legality |
| `uuid`, `nanoid` | `node:crypto.randomUUID()` is built in | `randomUUID()` for `edit_log.group_id` |
| Copying `anno-coverage.ts`'s `classAt()` into the store hot path | Linear over runs: 4.6 µs/lookup, 301 ms per full 64K pass, 250× slower than the paint array | The paint array. Leave `classAt()` where it is — it is correct for the census's once-per-report use. |
| Keeping `anno-verify.ts` as "the ACME seam" | It parses **the external analyser's** `--verify` output and calls `runAnno()`; it dies with the subject | Build the ACME verify path on `disasm-roundtrip.test.ts`'s pattern, gated by the renamed `anno-test-gate.ts` |
| A five-prefix reimplementation of the typed label prefixes | `AUTO_NAME_PREFIX_RE` already owns **eleven**; dropping six silently breaks `routine-queue-walker`'s backlog construction | Move the existing regex |
| A test asserting the store's stderr is empty | `node:sqlite` emits an unconditional `ExperimentalWarning` on the Node 22 line | Assert on results; suppress with `--disable-warning=ExperimentalWarning` if noise matters |

---

## Version Compatibility

| Package A | Compatible with | Notes |
|-----------|-----------------|-------|
| `node:sqlite` | Node **>= 22.13.0** without any flag | Added v22.5.0 behind `--experimental-sqlite`; flag removed in **v22.13.0 / v23.4.0** (nodejs/node PR #55890, read from `doc/api/sqlite.md`'s YAML changelog on the `v22.x` branch). The project's `engines` floor of `>=22.18.0` already clears it — **no `engines` bump needed.** |
| `node:sqlite` stability | **1.1 Active development** on the `v22.x` line; **1.2 Release candidate** since **v24.15.0 / v25.7.0** (PR #61262) | Read from the `v22.x`, `v24.x`, `v25.x` and `main` branches of `doc/api/sqlite.md` this session. Node 22 entered maintenance 2025-10-21 and is EOL **2027-04-30** (`nodejs/Release/schedule.json`); Node 24 is Active LTS. So the *practical* trajectory is toward RC, and a user on Node 24+ already gets RC. |
| Experimental warning | Emitted on Node 22 only | `lib/sqlite.js` on `v22.x` calls `emitExperimentalWarning('SQLite')` unconditionally at module load. On `v24.x`, `v25.x` and `main` the file is just `module.exports = internalBinding('sqlite')` — **no warning at all.** It goes to stderr, so it cannot corrupt the stdout JSON-RPC channel. Suppress with `--disable-warning=ExperimentalWarning` (verified working on 22.22.0) if `smoke.mjs` or a test is stderr-sensitive. |
| API drift risk | **Additive only, so far** | Diffing `doc/api/sqlite.md`'s method headings `v22.x` vs `main`: **20 additions, 0 removals.** Only two signature changes, both adding *optional* parameters (`loadExtension(path[, entryPoint])`, `prepare(sql[, options])`). New on `main`: `enableDefensive`, `setAuthorizer`, `limits`, `serialize`/`deserialize`, `createTagStore`, `statement.close()`, `statement.stat()`, `resetStats()`, `[Symbol.dispose]` on session and statement, and the `sqlTagStore` family. This is real evidence that "might change at any time" has, in practice, meant "gains things" — the strongest available answer to the stability objection. Mitigate anyway: **confine `node:sqlite` behind one seam module** (the project's established single-seam pattern) so a future break is a one-file fix, and express the schema in SQL rather than in driver API calls. |
| `@types/node` 24.13.3 | `node:sqlite` | `sqlite.d.ts` present; `createSession`/`applyChangeset` typed at lines 531/561; **no `invert`**. Typechecks clean under `--strict --module nodenext --target es2022`. Verified by running `tsc`. |
| Node native type-stripping | `node:sqlite` | Verified: a `.ts` file doing `import { DatabaseSync, type StatementSync } from "node:sqlite"` runs directly on Node 22.22.0 and typechecks clean. No build step. |
| Statements on Node 22 | No `statement.close()` | `StatementSync.prototype` on 22.22.0 has `run get all iterate columns setAllowBareNamedParameters setAllowUnknownNamedParameters setReadBigInts setReturnArrays` — no `close`. Statements are GC'd. `main` adds `close()` and `[Symbol.dispose]`. Do not write code that depends on explicit statement disposal. |
| ACME | 0.97 "Zem" (31 Jan 2021) | Unchanged. `label = * + $01` verified working. |

---

## Sources and evidence ceilings

Ordered by `ENGINEERING_RULES.md` §7's hierarchy. **HIGH** = real external system, live end-to-end.

**HIGH — run live on this host (Node 22.22.0, ext4/NVMe, ACME 0.97):**
- `node:sqlite` capability probe: SQLite version, WAL, `synchronous`/`foreign_keys` defaults, savepoints, UDFs, JSON1, FTS5, R*Tree, generated columns, full `DatabaseSync`/`StatementSync` prototype enumeration, `backup` export, `[Symbol.dispose]`.
- Session/changeset probe: `createSession`, `changeset()` (22 bytes), `patchset()`, cross-database `applyChangeset()` → `true`. **Absence of `invert` confirmed** by prototype enumeration *and* by grepping `@types/node@24.13.3`'s `sqlite.d.ts`.
- **Durability test:** insert → `process.kill(pid,'SIGKILL')` with no `close()` (exit 137) → reopen → row present → `PRAGMA integrity_check` = `ok`. Sidecar sizes observed.
- **Persistence benchmark**, 2,000 mutating calls over a 6,000-symbol / 3,000-comment / 2,500-range store, run on ext4/NVMe *and* on tmpfs to quantify the tmpfs distortion (SQLite 0.026 ms on tmpfs vs 1.16 ms on disk — a 45× understatement, which is why the tmpfs run is not quoted).
- **Interval benchmark:** paint array, sorted+binary-search, naive scan and the SQL formulation, plus a cross-validation of paint vs binary-search across all 65,536 addresses (0 disagreements).
- **ACME oracle:** `smc_operand = * + $01` and the `= * - 1` variant assembled by real ACME 0.97, exit 0, label file and emitted bytes inspected.
- `tsc --noEmit --strict --module nodenext` on a `node:sqlite`-using `.ts` file, and the same file executed directly under type-stripping.
- `better-sqlite3-13.0.3.tgz` downloaded (11.4 MB), unpacked, `lib/binding.js` read for the fallback path, `prebuilds/` enumerated (8 binaries), `files[]`/`scripts`/`optionalDependencies` read from the shipped manifest.

**HIGH — upstream source of truth, read directly:**
- `doc/api/sqlite.md` and `lib/sqlite.js` on `nodejs/node` branches `v22.x`, `v24.x`, `v25.x`, `main` (stability levels, flag-removal PRs #55890/#61262, warning presence, method-heading diff).
- `nodejs/Release/schedule.json` (Node 22 maintenance 2025-10-21, EOL 2027-04-30).
- npm registry API (`registry.npmjs.org`) for every version, publish date, `engines`, `gypfile`, install-script and dependency claim in this document.
- This repository's own committed source: `vice-proxy.ts` (`buildViceTool` :3263, SDK import :174, no-validation seam :3216-3230, `anno_*` registration :3402), `anno-coverage.ts` (`AnnoSymbol`/`AnnoComment`/`AnnoBlockEntry`/`AnnoCrossReference` :192-224, `ClassRun`/`toRuns`/`classAt` :272-347, `AUTO_NAME_PREFIX_RE` :1384), `anno-verify.ts` (external-analyser-not-ACME, `VERIFY_LINE_PATTERN`), `disasm-roundtrip.test.ts`, `anno-test-gate.ts`, `anno-acme-ident.ts`, `repo-root.ts`, `package.json`, `.gitignore`.
- `.planning/PROJECT.md`, `.planning/ENGINEERING_RULES.md`, `.planning/seeds/own-the-annotation-store.md`.

**MEDIUM — inference from directly-read evidence, not itself executed:**
- *"Adopting `better-sqlite3` triggers `npm ci` for every existing user's next session."* Follows from `scripts/ensure-mcp-deps.sh` being gated on a lockfile sha256 (per CLAUDE.md) plus the fact that a new dependency changes the lockfile. The hook was not run.
- *"No fallback off `better-sqlite3`'s eight prebuild targets."* Read from `lib/binding.js`'s fall-through to a `build/Release` path that no install script creates. Not tested on an armv7/freebsd host — no such host available.

**Gaps, stated rather than smoothed:**
- Node **24/25/26** were not available on this host, so the "no `ExperimentalWarning` on 24+" claim rests on reading `lib/sqlite.js` on those branches, not on running them. Source-level, high-confidence, but not live.
- The 1.16 ms/edit figure is one machine's NVMe. A consumer on spinning rust or a network filesystem will be slower — but so will *every* route, since all of them are fsync-bound. The *ratio* between routes is the durable finding, not the absolute.
- FTS5-vs-`LIKE` for the search surface was confirmed *available* but not benchmarked. Left as a plan-time decision.

---
*Stack research for: owned annotation store with per-range interval typing, undo and crash-safe persistence (v0.7.0)*
*Researched: 2026-08-26*
