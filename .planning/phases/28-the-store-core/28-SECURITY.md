---
phase: 28
slug: the-store-core
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
created: 2026-08-29
---

# Phase 28 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: **authored at plan time** — all 23 of the phase's `*-PLAN.md`
files carry a parseable `<threat_model>` block, so this audit **verifies that the
planned mitigations exist** rather than retroactively constructing a register.

ASVS enforcement level **1**; blocking severity threshold **high**.

---

## Trust Boundaries

The 23 plans declare 72 boundary rows, 66 distinct. They collapse into six
recurring boundaries that every plan in the phase restates in its own terms:

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| MCP caller → store validators | `vice-proxy.ts:3224`'s `rawJsonSchemaAsStandardSchema()` returns `validate: (value) => ({ value })` at `:3230`, by design. Every argument reaches the store unvalidated; this is the phase's primary boundary and its own responsibility. | Addresses, ranges, data types, label and enum names, comment text, revision numbers |
| store module → filesystem | The store path and the `snapshots/` directory are caller-supplied filesystem locations inside the container. | Store path, snapshot image paths |
| store validators → SQL | Every statement in `anno-store.ts`; the one unavoidable interpolation is `vacuum into '<path>'`. | Bound parameters plus one quoted path literal |
| a second OS process → the same store file | SQLite locking is the only arbiter below the store's own revision compare-and-swap. | Concurrent writes, revision claims |
| the store writing on its own initiative (`retype()` → `anno_range`) | The one writer a caller cannot inspect — the boundary CR-09 and CR-10 both cross. | Remainder rows, split-table fragments |
| stored rows → every later reader (`resolveSplitTargets`, Phase 30 ACME export) | A row no reader can decode is a silent data loss with no error message anywhere. | Range rows, split-table entry pairs |

---

## Threat Register

All 167 register rows from the 23 plans, sorted by severity. Every row is
**closed**: `mitigate` rows by a control verified present in the implementation,
`accept` rows by a documented rationale, the single `transfer` row by its
delivered target plan.

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation / Rationale | Status |
|-----------|------|----------|-----------|----------|-------------|------------------------|--------|
| T-28-01 | 28-13 | Tampering | `reconcileSnapshotRing` step 3 (`anno-store.ts`) | critical | mitigate | Task 1: the sweep abstains from the pointer-ROW direction entirely, so no path spelling — symlink alias, rename, bind-mount alias or case-folded name… | closed |
| T-28-16 | 28-16 | Denial of service | `revertTo` steps 2-5 (`anno-store.ts`) | critical | mitigate | Task 1: the destructive steps are downstream of a successful `openStore` of the STAGED copy, so a present-but-unusable image is a refusal instead of… | closed |
| T-28-61 | 28-23 | Tampering | `retype()`'s split-and-preserve path (`anno-store.ts`) | critical | mitigate | The gate computes a reinterpretation record per fragmented split row, before the first `delete`, and `setDataType` returns it. A partial overwrite ca… | closed |
| T-28-62 | 28-23 | Information disclosure (inverted — with… | `SetDataTypeResult` | critical | mitigate | The field is always present and often empty, on a successful result, so a caller reads it unconditionally. Silence was the defect; absence of the fie… | closed |
| T-28-corrupt | 28-01 | Tampering (silent data loss) | `openStore()` on an existing file | high | mitigate | The `anno_meta` row plus a `schema_version` match plus `pragma integrity_check` (0.73 ms measured). Measured necessity: a zero-length file OPENS with… | closed |
| T-28-lostwrite | 28-01 | Tampering | the write sequence's revision compare-and-swap | high | mitigate | `update anno_meta set revision = revision + 1 where id = 1 and revision = ?` inside `begin immediate`, rolling back and throwing `AnnoStoreStaleRevis… | closed |
| T-28-path | 28-01 | Tampering / Information disclosure | `openStore()`'s `path` argument | high | mitigate | `storePathWithinWorkspace()` resolves both the store path and the workspace root and refuses with `AnnoStorePathError` unless the store path is insid… | closed |
| T-28-sqli | 28-01 | Tampering | every SQL statement in `anno-store.ts` | high | mitigate | Bound parameters through `prepare().run()` everywhere. `exec()` takes no parameters and is therefore restricted to the fixed `DDL`, the transaction k… | closed |
| T-28-censuszero | 28-03 | Tampering (silent misinformation) | `block-class.ts:130-134`'s comparisons and `anno-coverage.… | high | mitigate | Dual-vocabulary acceptance in the boundary so no live producer's blocks are reclassified; a derived TOTAL cross-check over all twelve store members w… | closed |
| T-28-staleguard | 28-03 | Repudiation | `block-class.ts:32-35`'s rationale and `block-class.test.ts… | high | mitigate | The false rationale is REPLACED with the honest one naming the two guards that actually protect the mapping, not deleted and not softened; the contra… | closed |
| T-28-basemismatch | 28-04 | Tampering (persistent silent error) | `parseStoreAddress` | high | mitigate | An unprefixed numeric string is refused rather than guessed. Recorded as a deliberate divergence from `stock-address.ts:155-160`, which accepts the b… | closed |
| T-28-label | 28-04 | Tampering (silent data loss) | `setLabel` and `assertLegalLabel` | high | mitigate | An illegal name refuses outright with `AnnoLabelError`; there is no sanitisation, substitution, trimming or quoting step anywhere on the write path,… | closed |
| T-28-secondtruth | 28-04 | Tampering (invisible disagreement) | `anno_xref` and `putXref` | high | mitigate | Only non-derivable references are written. The positive pin is that `listXrefs()` returns an empty array after typing a `lo_hi_address` range whose t… | closed |
| T-28-sqli | 28-04 | Tampering | every new SQL statement | high | mitigate | Bound parameters through `prepare().run()` everywhere. `exec()` remains restricted to the fixed `DDL`, the transaction keywords and the one escaped `… | closed |
| T-28-vacantcontrol | 28-04 | Repudiation | criterion 1's differing-target-set control | high | mitigate | Two non-degeneracy assertions run before the differing-set assertion in the same test (the halves are not byte-identical; the entry count exceeds one… | closed |
| T-28-paddedtable | 28-05 | Repudiation | the five-case table itself | high | mitigate | Planting A's **selectivity** is asserted, not merely its failure: cases 1, 2, 4 and 5 must hold and case 3 must not. A five-case table whose case 3 i… | closed |
| T-28-refusalpressure | 28-05 | Tampering (converts a reported loss int… | the shape of the contradiction report | high | mitigate | The contradiction is returned as data on a SUCCESSFUL result, never as an error and never as a refusal, and no option exists to make it a refusal. A… | closed |
| T-28-undoc | 28-05 | Tampering (silent data loss) | `setDataType`'s split-and-preserve mutation and its contrad… | high | mitigate | Split-and-preserve re-inserts every surviving head and tail as rows; both invariants are asserted for all five overlap cases, with the fully-containe… | closed |
| T-28-absorbedred | 28-06 | Repudiation | the combined test's assertion shape | high | mitigate | Both booleans are computed OUTSIDE any `try` around the assertions, because in research's prototype the revert half failed with a named domain error… | closed |
| T-28-corrupt | 28-06 | Tampering (silent data loss) | `openStore`'s four refusal branches | high | mitigate | Proven on four shapes: zero-length, mid-file truncation, a foreign file, and a `schema_version` mismatch, each refused with `AnnoStoreCorruptError` a… | closed |
| T-28-lastwritewins | 28-06 | Tampering | the shape of the stale-base recovery | high | mitigate | The store never resolves a stale base by re-reading the current revision and proceeding — that would be last-write-wins wearing a compare-and-swap's… | closed |
| T-28-lostwrite | 28-06 | Tampering | `runWriteSequence`'s step-5 compare-and-swap | high | mitigate | Observed across two genuinely separate OS processes: the child's row survives, the parent's stale-base write is refused with both revision values in… | closed |
| T-28-07-familyescape | 28-07 | Tampering | `revertTo`'s filesystem calls | high | mitigate | Every `copyFileSync`/`fsyncPath`/`renameSync` is inside a `try` whose `catch` throws an `AnnoStoreError` naming the path and the operation, so nothin… | closed |
| T-28-07-floorlie | 28-07 | Repudiation | `oldestRetainedRevision` | high | mitigate | The published floor is read from `retainedRevisions()`, which requires the file, so the store cannot publish a number it will then refuse. Asserted b… | closed |
| T-28-07-sweep | 28-07 | Denial of Service | `reconcileSnapshotRing`'s directory sweep | high | mitigate | The sweep is anchored to the `r<digits>.db` pattern and deletes only entries no surviving pointer row claims, so it cannot reach the store file, the… | closed |
| T-28-08-familyescape | 28-08 | Tampering | `openStore`'s constructor and fresh-init block | high | mitigate | Both wrapped; failures rethrown as `AnnoStorePathError` / `AnnoStoreError` naming the path, with the fresh path rolling back and closing the connecti… | closed |
| T-28-08-ownership | 28-08 | Tampering | the published snapshot path | high | mitigate | A published `r<revision>.db` is written by exactly one writer: the one whose CAS won and whose pointer row commits. `stageSnapshot` never names the p… | closed |
| T-28-08-silentwrong | 28-08 | Repudiation | `revertTo` under concurrency | high | mitigate | The damage CR-02 caused was a pointer row describing another revision's bytes and a revert that succeeded with the wrong state — a silent wrong answe… | closed |
| T-28-09-rootenoent | 28-09 | Denial of Service | a non-existent workspace root | high | mitigate | The root gets the same deepest-existing-ancestor treatment as the path, so a root that does not exist yields a comparable string instead of a raw `EN… | closed |
| T-28-09-symlink | 28-09 | Elevation of Privilege | `storePathWithinWorkspace` | high | mitigate | Both sides compared as REAL paths, resolved through the deepest existing ancestor. Proven end to end through `openStore` by asserting no file is crea… | closed |
| T-28-10-01 | 28-10 | Tampering | `snapshotDirFor` / the ring directory | high | mitigate | Two stores in one directory can no longer write into one ring: the directory name is a pure function of `basename(handle.path)`, and two distinct sto… | closed |
| T-28-10-02 | 28-10 | Information Disclosure | `revertTo` | high | mitigate | `revertTo` returning a neighbouring store's whole database is cross-store data disclosure — reproduced. Closed by the same keying; the test asserts A… | closed |
| T-28-10-03 | 28-10 | Tampering | `anno_snapshot.path` fed to `rmSync` / `copyFileSync` | high | mitigate | A persisted absolute path is environment-controlled input to a delete. Dropping the column removes the primitive: the only path any delete can name i… | closed |
| T-28-10-SC | 28-10 | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task exists in this plan and none is added: every import is a Node builtin (`node:fs`, `node:path`, `node:crypto`, `node:s… | closed |
| T-28-11-01 | 28-11 | Denial of Service | `reconcileSnapshotRing` deleting a live writer's published… | high | mitigate | The sweep takes `begin immediate` before it reads anything. Publication is gated on the won compare-and-swap, which holds that same lock, so the publ… | closed |
| T-28-11-02 | 28-11 | Tampering | an interrupted sweep leaving a pointer row aimed at a delet… | high | mitigate | The sweep commits its row deletes through `commitTransaction` before any `rmSync`, so an interruption leaves extra files. Pinned by a second source-o… | closed |
| T-28-11-05 | 28-11 | Tampering | an open transaction left with the compare-and-swap applied | high | mitigate | The outer catch rolls back before it rethrows, and the WR-01 test proves it by performing a second successful `applyWrite` on the same handle. | closed |
| T-28-11-SC | 28-11 | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task exists in this plan and none is added; every import is a Node builtin or an existing intra-repo module. The package-l… | closed |
| T-28-12-01 | 28-12 | Elevation of Privilege | `realpathOfNearestExisting` / `existsSync` as an entry test | high | mitigate | Path-entry existence is decided with `lstatSync(p, { throwIfNoEntry: false })`, which does not follow the link, so a dangling entry counts as present… | closed |
| T-28-12-02 | 28-12 | Tampering | a dangling link redirecting the store file outside the work… | high | mitigate | The dangling stopping entry is resolved with `readlinkSync` against `dirname(current)` and the walk restarts there, so the compared path is the one t… | closed |
| T-28-12-SC | 28-12 | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task exists in this plan and none is added; the only new imports are named bindings on the already-present `node:fs` built… | closed |
| T-28-02 | 28-13 | Denial of Service | `reconcileSnapshotRing`'s transaction (`anno-store.ts`) | high | mitigate | Task 2: a structural `try`/`catch` rolls the sweep's transaction back on every reachable throw, so the store's write lock cannot be held for a handle… | closed |
| T-28-06 | 28-14 | Denial of Service | `runWriteSequence` step 8's commit (`anno-store.ts`) | high | mitigate | Task 1: the commit is wrapped and its handler rolls back, so a `SQLITE_BUSY` on COMMIT can no longer leave the store's write lock held for a session-… | closed |
| T-28-07 | 28-14 | Tampering | `runWriteSequence`'s CAS on commit failure (`anno-store.ts`) | high | mitigate | Task 1's rollback undoes the CAS, the mutation and the pointer-row insert together, so `currentRevision()` can no longer report an advanced revision… | closed |
| T-28-11 | 28-15 | Elevation of privilege | `pathEntryExists` (`anno-types.ts`) | high | mitigate | Task 1 wraps every non-ENOENT stat failure in `AnnoStorePathError`, so a regular-file ancestor, an unreadable ancestor and an ancestor symlink cycle… | closed |
| T-28-17 | 28-16 | Tampering | image substituted between the gate and the rename (TOCTOU) | high | mitigate | Task 1 validates the STAGED COPY — the exact bytes `renameSync` installs — rather than the source image alone, so a substitution after the gate canno… | closed |
| T-28-21 | 28-16 | Tampering | the judge creating or modifying the file it judges | high | mitigate | Task 1's `mustExist` refuses an absent path before `new DatabaseSync` and opens `readOnly: true`, so the witness cannot initialise an empty store int… | closed |
| T-28-22 | 28-16 | Repudiation | a sweep that unlinks a corrupt-but-claimed image | high | mitigate | Task 2 re-points the sweep to `claimedRevisions`, so evidence of the failure survives on disk for inspection instead of being deleted by the repair.… | closed |
| T-28-23 | 28-17 | Tampering | `stageSnapshot` / `publishSnapshot` (`anno-store.ts`) | high | mitigate | Task 1 fsyncs the staged image and the ring directory through the module's existing `fsyncPath()`, so a durable pointer row can no longer name a file… | closed |
| T-28-24 | 28-17 | Repudiation | the three rollback handlers (`anno-store.ts`) | high | mitigate | Task 2 records whether the rollback returned and branches the message on the recorded fact, so a refusal can no longer report the CR-06 state as its… | closed |
| T-28-25 | 28-17 | Denial of service | a connection left holding the store's write lock after a fa… | high | mitigate | Task 2's not-rolled-back message instructs the caller to close and reopen, which is the only correct action; the sweep's `rollbackFailed` reports the… | closed |
| T-28-29 | 28-18 | Tampering | the single-commit-site control (`anno-seam.test.ts`) | high | mitigate | Task 1 matches `exec()` statements across all three SQLite spellings instead of counting a word, and proves the coverage with fixture controls over l… | closed |
| T-28-30 | 28-18 | Repudiation | requirement status rows (`.planning/REQUIREMENTS.md`) | high | mitigate | Task 2 transcribes verdicts already recorded in `28-VERIFICATION.md` and names its source in the record note; the diff is asserted to be confined to… | closed |
| T-28-33 | 28-18 | Spoofing | a disposition claiming a fix the evidence does not support | high | mitigate | Every `fix` cell must name its plan and quote a number or line reference from that plan's SUMMARY; a cell that cannot reads `accept` with its reason.… | closed |
| T-28-35 | 28-19 | Tampering | `retype()`'s remainder inserts (`anno-store.ts:1724`, `:172… | high | mitigate | Task 1 runs the store's own `assertRangeShape` over every proposed remainder before the first `delete`, so no writer in the module can persist a row… | closed |
| T-28-36 | 28-19 | Information disclosure | the silent loss itself — a decodable split table becoming u… | high | mitigate | The outcome is a named `AnnoSplitRemainderError` in the `ViceError` family carrying both conflicting numbers and the legal alternatives (28-08 P2). N… | closed |
| T-28-37 | 28-19 | Tampering | a future internal writer added without the shape gate | high | mitigate | Task 3's round-trip invariant asserts the CLASS — every row `listRanges()` returns must be re-acceptable at the entry point — after a deterministic s… | closed |
| T-28-42 | 28-20 | Repudiation | a corruption-flavoured message for an argument error (WR-22) | high | mitigate | A dedicated class outside the corruption family, asserted with `!(thrown instanceof AnnoStoreCorruptError)`. `AnnoStoreCorruptError`'s own doc commen… | closed |
| T-28-43 | 28-20 | Tampering | `revertTo`'s shared staging path (WR-24) | high | mitigate | Task 2 makes the name unique per attempt from the same `randomUUID` primitive the writer uses, and routes all three cleanups through `discardSnapshot… | closed |
| T-28-44 | 28-20 | Tampering | a returned handle still inside the sweep's transaction (WR-… | high | mitigate | Task 3 makes `revertTo` close and reopen rather than return such a handle, and marks the handle on the write path so the NEXT call refuses by name. T… | closed |
| T-28-45 | 28-20 | Denial of service | a fix that converts a committed write into a caller-visible… | high | mitigate | Explicitly guarded: the accepted write returns its revision unchanged and a dedicated control asserts it, with the handle's field `false` afterwards.… | closed |
| T-28-47 | 28-21 | Tampering | `openStore`'s unconfined default (WR-25) | high | mitigate | Task 2 refuses when neither a `workspaceRoot` nor the explicit escape is supplied, before `new DatabaseSync` so no file is created by the refused cal… | closed |
| T-28-48 | 28-21 | Elevation of privilege | the escape option spreading beyond the module's derived-pat… | high | mitigate | Task 3 pins it over the `files[]`-derived shipped module set with a positive count and a non-vacuity companion, and the pin is observed red with a fi… | closed |
| T-28-50 | 28-21 | Repudiation | two doc comments claiming a no-nesting guarantee the code d… | high | mitigate | Task 1 refuses an overlapping or nested scope by name with both scopes in the message, and deletes the contradicting `ADDITIVE` paragraph in the same… | closed |
| T-28-51 | 28-21 | Spoofing | a confinement refusal bought by broadening | high | mitigate | `anno-confinement.test.ts` is re-run individually twice on this plan's trees, 15 cases with the inside-pointing symlink still FOLLOWED, and `storePat… | closed |
| T-28-53 | 28-22 | Tampering | the single-commit-site control (`anno-seam.test.ts`) | high | mitigate | Task 1 matches the STATEMENT inside an `exec()` literal, anchored at a statement boundary, covering the semicolon and multi-statement evasions the ve… | closed |
| T-28-54 | 28-22 | Repudiation | a disposition that lives only in `28-VERIFICATION.md` | high | mitigate | Task 2 transcribes all twelve into `28-REVIEW.md`'s own table in the round-4 form, so the decisions survive the next overwrite of the verification re… | closed |
| T-28-55 | 28-22 | Repudiation | requirement status rows (`.planning/REQUIREMENTS.md`) | high | mitigate | Task 2 transcribes verdicts already recorded in `28-VERIFICATION.md`, quotes the authorising sentences, names the source file and table, and verifies… | closed |
| T-28-56 | 28-22 | Repudiation | the two carried-forward `behavior_unverified` items | high | mitigate | Task 2 records both as explicit STILL-OPEN rows with unchanged reasons; task 3's fourth self-assertion re-states it. Neither is promoted, and the hos… | closed |
| T-28-57 | 28-22 | Spoofing | a disposition claiming a fix the evidence does not support | high | mitigate | Every `fix` cell must name its plan and quote a number or line reference from that plan's SUMMARY; a cell that cannot reads `accept` with its reason.… | closed |
| T-28-59 | 28-22 | Denial of service | a closing gate that reports an aggregate instead of numbers | high | mitigate | Task 3 re-runs every named control individually and quotes it, re-drives BOTH reproductions, and re-observes nine plantings red and restored (eight f… | closed |
| T-28-60 | 28-22 | Repudiation | a `.planning/` deliverable silently stripped by worktree is… | high | mitigate | Worktree isolation is forbidden for this plan and the prohibition is stated in the objective; task 2 asserts the `.planning/` paths are actually in t… | closed |
| T-28-63 | 28-23 | Tampering | the split layout's partner rule | high | mitigate | One definition (`splitPartnerOffsets`) consumed by both `resolveSplitTargets` and the writer-side gate, so a resolver and a writer can never disagree… | closed |
| T-28-64 | 28-23 | Repudiation | `anno-overlap.test.ts` as the recorded definition of correc… | high | mitigate | The case that pinned the corrupting outcome by value and named it legal is rewritten; the `SEQUENCE` expectations are re-derived; the non-vacuity flo… | closed |
| T-28-65 | 28-23 | Tampering | the parity gate (CR-09's closure) | high | mitigate | `remainderRefusal` and `assertRangeShape` are untouched and still run FIRST. The odd-fragment drive is re-driven on the final tree with its row set a… | closed |
| T-28-66 | 28-23 | Elevation of privilege | a plan that quietly widens its own scope | high | mitigate | ONE plan file, `gap_closure: true`, the 22 existing plans untouched, every truth `TRACE:`-prefixed to the verification report, and no newly minted pr… | closed |
| T-28-67 | 28-23 | Repudiation | requirement status rows (`.planning/REQUIREMENTS.md`) | high | mitigate | Task 3 transcribes verdicts already recorded in `28-VERIFICATION.md`, quotes the authorising sentences verbatim, names the source, and verifies each… | closed |
| T-28-69 | 28-23 | Repudiation | a `.planning/` deliverable silently stripped by worktree is… | high | mitigate | Worktree isolation is forbidden for this plan and the prohibition is stated in the objective; task 3 asserts the `.planning/` path is actually in the… | closed |
| T-28-diskgrowth | 28-01 | Denial of service (disk) | the `snapshots/` directory | medium | mitigate | `MAX_SNAPSHOT_REVISIONS = 32` is declared in this plan; the pruning that enforces it is `28-06`'s task. Recorded here because the bound is a constant… | closed |
| T-28-ext | 28-01 | Elevation of privilege | `DatabaseSync`'s extension-loading surface | medium | mitigate | The two extension-loading methods are never called and the extension-allowing constructor option is never passed; `anno-seam.test.ts` asserts their a… | closed |
| T-28-nocommit | 28-01 | Tampering | `applyWriteWithoutCommit` | medium | mitigate | The wrapper exists only so `STORE-04`'s planted violation drives the identical code path. `anno-seam.test.ts` asserts no shipped module other than `a… | closed |
| T-28-oob | 28-02 | Tampering / Denial of service | `resolveAt(index, address)` and `buildPaintIndex`'s paint l… | medium | mitigate | `resolveAt` refuses an address outside `ADDRESS_MIN..ADDRESS_MAX` with `AnnoAddressError` carrying the offending value, pinned by Task 2's Pin 1 agai… | closed |
| T-28-secondtruth | 28-02 | Tampering (silent divergence) | a memoised or disk-cached index | medium | mitigate | `anno-index.ts` is asserted to declare no module-level mutable binding (reusing `block-class.test.ts:194-212`'s scan, which already caught a real `co… | closed |
| T-28-vacuousgate | 28-02 | Repudiation | the cross-validation test itself | medium | mitigate | Three independent non-vacuity halves: the comparison counter must equal 65536, the fixture must contain differing-length overlaps, and the fixture mu… | closed |
| T-28-fixturedrift | 28-03 | Tampering | `fixtures/coverage/*/store.json` and `fixtures/coverage/mak… | medium | accept | Not touched by this plan, deliberately: they model the external analyser's output, which the census still consumes in production, and migrating them… | closed |
| T-28-vacuousdisjoint | 28-03 | Repudiation | `anno-coverage.test.ts:688-697`'s zero-overlap disjointnes… | medium | mitigate | `PRODUCTION_BLOCK_SPELLINGS` becomes the derived union of both accepted vocabularies, with a no-duplicates assertion and a membership assertion for a… | closed |
| T-28-blob | 28-04 | Denial of service | comment text and enum variant mappings | medium | mitigate | `MAX_COMMENT_BYTES = 4096`, measured in UTF-8 bytes with a `TextEncoder` rather than in code units — a multi-byte comment would otherwise pass a code… | closed |
| T-28-gradeswallow | 28-05 | Tampering (silent exemption) | `parseConfidencePrefix()`'s throw path | medium | mitigate | The store catches `AnnoConfidenceGradeError` and rethrows `AnnoCommentGradeError extends ViceError` with the original message preserved verbatim; it… | closed |
| T-28-overmerge | 28-05 | Tampering | any adjacency, coalescing or merge pass | medium | mitigate | Proven absent both ways: two adjacent same-type ranges stay two rows with distinct ids and distinct boundary resolutions (behavioural), and no coales… | closed |
| T-28-torncheck | 28-05 | Tampering | the contradiction query's placement relative to the retype | medium | mitigate | The comment select runs inside the same `applyWrite` mutation as the retype, which `BEGIN IMMEDIATE` serialises, so a comment written by another conn… | closed |
| T-28-diskgrowth | 28-06 | Denial of service (disk) | the `snapshots/` directory | medium | mitigate | Bounded at `MAX_SNAPSHOT_REVISIONS`, single-homed in `anno-types.ts` with no literal copy, pruned after the commit and outside the transaction, file-… | closed |
| T-28-journalmode | 28-06 | Tampering | `pragma journal_mode` | medium | mitigate | Pinned by a test on a freshly created store, because `journal_mode` is a persistent database property and `pragma` statements are not transactional —… | closed |
| T-28-prunerace | 28-06 | Tampering | the ordering of the prune relative to the commit | medium | mitigate | Pruning runs after the commit and outside the transaction because an unlink is not transactional; the file is deleted before its pointer row for the… | closed |
| T-28-seamspread | 28-06 | Tampering | the `node:sqlite` import added to `anno-store.test.ts` | medium | mitigate | Necessary for the one `schema_version` fixture and outside `STORE-07`'s scope by construction (`shippedTsModules()` reads `files[]`, which excludes t… | closed |
| T-28-07-commentlie | 28-07 | Repudiation | the trap-10 and `pruneSnapshots` doc comments | medium | mitigate | Corrected to match the code, with the reversal recorded rather than the paragraph deleted, and pinned by two negative greps plus a positive grep on t… | closed |
| T-28-07-handleloss | 28-07 | Denial of Service | `revertTo`'s close ordering | medium | mitigate | Copy and both fsyncs happen before `closeStore`, and the failure path returns with the original connection open. The one residual — a `renameSync` fa… | closed |
| T-28-07-revarg | 28-07 | Tampering | the caller-supplied `revision` | medium | mitigate | An unretained revision (absent row OR absent file) is refused by name before any filesystem work; the refusal names only revisions `retainedRevisions… | closed |
| T-28-08-conflictopacity | 28-08 | Repudiation | the CAS-failure refusal | medium | mitigate | Both revisions carried, the second read before the rollback. Pinned structurally, with the reason for a structural pin (the path is not deterministic… | closed |
| T-28-08-seamspread | 28-08 | Tampering | the new `stageSnapshot` export | medium | mitigate | Bounded by the same mechanism `applyWriteWithoutCommit` uses — the `anno-seam.test.ts` scan asserting no shipped module other than the seam names it… | closed |
| T-28-08-tmpleak | 28-08 | Denial of Service | the `.tmp` staging files | medium | mitigate | `discardSnapshot` runs on every refusal and rollback exit and is a safe no-op after a successful publish. The staging suffix is deliberately outside… | closed |
| T-28-09-familyescape | 28-09 | Tampering | `realpathSync` failures | medium | mitigate | Wrapped in a `try` whose `catch` throws `AnnoStorePathError` naming the path, so a permission failure resolving an ancestor stays inside the `ViceErr… | closed |
| T-28-09-guardwiden | 28-09 | Repudiation | the widened import-specifier assertion | medium | mitigate | Widened with the length pin moved in step, the local half untouched, the rationale rewritten to record WHY the old claim became false, the test title… | closed |
| T-28-09-overbroad | 28-09 | Denial of Service | the same fix | medium | mitigate | The easy wrong fix — refuse every symlink — is pinned against by test 2 (an inside-pointing symlink is followed and the store opens at the real path)… | closed |
| T-28-09-toctou | 28-09 | Tampering | the window between the check and `new DatabaseSync` | medium | accept | `realpathSync` resolves at check time; a symlink swapped between the check and the connection would defeat it. Accepted at ASVS level 1: the attacker… | closed |
| T-28-10-04 | 28-10 | Elevation of Privilege | `basename(handle.path)` spliced into a directory name | medium | mitigate | `handle.path` is already the output of `storePathWithinWorkspace` or `resolve`, so its basename contains no separator and no `..` component; the suff… | closed |
| T-28-10-06 | 28-10 | Repudiation | the legacy `<dir>/snapshots/` ring | medium | mitigate | A migration would have to guess which store owned which legacy file, silently attributing one store's history to another. Refused: the ring is never… | closed |
| T-28-11-03 | 28-11 | Denial of Service | a sweep that cannot take the lock — ring size AND write lat… | medium | accept | **Two consequences, both accepted, both stated.** (1) It declines and reports `deferred: true`, so the ring may temporarily exceed the bound until th… | closed |
| T-28-11-04 | 28-11 | Repudiation | an error escaping the `ViceError` family from the staging→i… | medium | mitigate | The window is wrapped; a `ViceError` is rethrown unchanged so no existing refusal's class or message moves, anything else is wrapped as `AnnoStoreErr… | closed |
| T-28-11-06 | 28-11 | Denial of Service | unbounded `.tmp` growth in the ring directory | medium | mitigate | The outer catch calls `discardSnapshot` on every failing exit. The sweep is deliberately anchored NOT to collect `.tmp` files, so an unguarded throw… | closed |
| T-28-11-07 | 28-11 | Repudiation | a committed write reported to the caller as a failure | medium | mitigate | Step 9's prune call is wrapped and does not rethrow; the caller sees the commit that actually happened. Pinned structurally, with the reason it is st… | closed |
| T-28-12-03 | 28-12 | Denial of Service | a symlink cycle in an unvalidated path | medium | mitigate | Hops are bounded by `MAX_SYMLINK_HOPS` (40, Linux's own `MAXSYMLINKS`); exceeding it refuses with `AnnoStorePathError`. Pinned by test 10 with a wall… | closed |
| T-28-12-04 | 28-12 | Tampering | a link planted BETWEEN the confinement check and the open | medium | accept | **Stated residual, not closed.** `DatabaseSync` takes a path, not a file descriptor, so there is no `O_NOFOLLOW`/`openat` route to making the check a… | closed |
| T-28-12-05 | 28-12 | Elevation of Privilege | an over-broad fix that refuses every symlink | medium | mitigate | Would pass every refusal test while breaking legitimate layouts. Tests 2, 6 and 9 are the discriminating controls; test 9 was confirmed to redden aga… | closed |
| T-28-03 | 28-13 | Repudiation | `snapshotDirFor` doc comment, `28-10-SUMMARY.md` | medium | mitigate | Task 3: the two comments that assert a guarantee the code does not provide are corrected, and the correction is attributed rather than silently overw… | closed |
| T-28-04 | 28-13 | Tampering | ring directory unlink loop (`anno-store.ts` step 5) | medium | accept | Unchanged by this plan and already mitigated by 28-11: the sweep takes the store's write lock before it judges, and `SNAPSHOT_FILE_PATTERN` is anchor… | closed |
| T-28-05 | 28-13 | Elevation of privilege | store path confinement (`anno-types.ts`) | medium | transfer | Out of scope for this plan by design; owned by plan 28-15, where the code it depends on is fixed. Splitting it here would mean correcting a comment i… | closed |
| T-28-08 | 28-14 | Denial of Service | `revertTo` step 6 (`anno-store.ts`) | medium | mitigate | Task 2: the caller can no longer be left with no handle and an unreachable connection holding the write lock after a revert that already succeeded on… | closed |
| T-28-10 | 28-14 | Tampering | `anno-durability-mutator.mjs` shipped to consumers | medium | mitigate | Task 3 keeps every clause of the mutator's TEST-ONLY header: absent from `package.json` `files[]` (asserted mechanically on every suite run), never i… | closed |
| T-28-12 | 28-15 | Spoofing | ancestor symlink cycle (`anno-types.ts`) | medium | mitigate | Task 2 case 15 pins the ANCESTOR spelling against the same 40-hop bound the LEAF spelling already refuses at, closing the gap where 28-12's truth 3 w… | closed |
| T-28-13 | 28-15 | Tampering | confinement over-refusal | medium | mitigate | Prohibition 28-12 P2 is carried forward and asserted: the inside-pointing dangling-link case must still be FOLLOWED after this change, so the fix can… | closed |
| T-28-14 | 28-15 | Tampering | check-then-open window (`anno-types.ts` → `openStore`) | medium | accept | Declared unclosable at this layer and already STATED as a limit: `node:sqlite`'s `DatabaseSync` takes a path, not a descriptor, so there is no `O_NOF… | closed |
| T-28-18 | 28-16 | Spoofing | a valid annotation store belonging to a DIFFERENT project p… | medium | accept | Refused only if it fails to open; an image that opens cleanly with the expected `schema_version` is ADMITTED. Closing this needs a store-identity col… | closed |
| T-28-19 | 28-16 | Elevation of privilege | `snapshotPathFor` resolving outside the workspace root | medium | mitigate | No new path input is introduced: every path the witness opens comes from `snapshotDirFor(handle)`, which is derived from the already-confined `handle… | closed |
| T-28-20 | 28-16 | Denial of service | denial-of-restore via an unreadable or unopenable ring | medium | accept | An unopenable image makes its revision drop out of the advertised list — the store refuses rather than destroys, which is the safe direction, and the… | closed |
| T-28-26 | 28-17 | Repudiation | the two root-sensitive controls (`anno-store.test.ts`) | medium | mitigate | Task 3 converts both to node:test's `{ skip: ... }` form, so under root the runner reports skips with reasons instead of a green suite whose behaviou… | closed |
| T-28-28 | 28-17 | Tampering | a `synchronous` or `journal_mode` pragma introduced while "… | medium | mitigate | Explicitly forbidden by the task action and asserted by a negative grep criterion; header rule 4 forbids both outright because `journal_mode` is a pe… | closed |
| T-28-31 | 28-18 | Repudiation | the carried-forward `behavior_unverified` item | medium | mitigate | Task 2 records it as an explicit OPEN row with its unchanged reason, so it cannot be lost between rounds by being absent rather than by being closed. | closed |
| T-28-32 | 28-18 | Tampering | `docs-review-disposition.test.ts`'s parser | medium | mitigate | The new table uses the existing round-3 section's format and adds no heading shaped like a finding id; both guards are run before and after and asser… | closed |
| T-28-34 | 28-18 | Denial of service | a closing gate that reports an aggregate instead of numbers | medium | mitigate | Task 3 re-runs every named control individually and quotes it, re-drives the CR-08 reproduction, and re-observes four plantings red and restored — th… | closed |
| T-28-38 | 28-19 | Repudiation | the reserved `bank` value dropped on the split path (IN-06) | medium | mitigate | Task 1 threads the overlapped row's `bank` through `insertRange()` and the control drives the PRESERVATION through `setDataType` and `listRanges()` r… | closed |
| T-28-39 | 28-19 | Denial of service | a refusal that costs the caller a half-applied mutation or… | medium | mitigate | The gate runs before the first `delete`; every refusing control asserts `listRanges()` deep-equal and `currentRevision()` unchanged, so the refusal i… | closed |
| T-28-41 | 28-20 | Spoofing | `revertTo`'s `revision` argument (WR-22) | medium | mitigate | Task 1 validates at the entry, before the pointer-row query and before `snapshotPathFor`, so the SQL operand and the filename can no longer disagree.… | closed |
| T-28-46 | 28-20 | Repudiation | a `backstop` claim presented as behavioural evidence | medium | mitigate | Both un-injectable arms — the concurrent staging collision and the `rollbackFailed: true` end-to-end path — are filed as structured `backstop` truths… | closed |
| T-28-49 | 28-21 | Denial of service | an unbounded `anno_scope` table grown by a caller that cann… | medium | mitigate | Task 1 makes a byte-identical repeat an accepted no-op reporting `changed: false`, so an agent re-running an annotation pass can tell. There is no de… | closed |
| T-28-52 | 28-21 | Tampering | a structural pin re-coupling to error-message prose | medium | mitigate | Task 3's guard control asserts BEHAVIOURALLY through the entry point rather than matching source text, and says so in the SUMMARY, so 28-18 P1's remo… | closed |
| T-28-58 | 28-22 | Tampering | `docs-review-disposition.test.ts`'s parser | medium | mitigate | The new table uses the existing round-4 section's format and adds no heading shaped like a finding id; both guards are run before and after and asser… | closed |
| T-28-68 | 28-23 | Denial of service | an `fsync`-free or lock-holding computation added to the wr… | medium | accept | The new computation is pure arithmetic over at most 32768 offset couples per overlapped row, runs inside the existing pre-delete loop, performs no I/… | closed |
| T-28-SC | 28-01 | Tampering | npm / pip / cargo installs | low | accept | Zero package-manager installs in this phase: the persistence layer and the test framework are Node builtins and every in-repo import is a relative pa… | closed |
| T-28-SC | 28-02 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. `node:test` and `Int32Array` are Node builtins; both imports in this plan are relative paths inside `src/mcp/vice/`. `28-RESEARCH.md`… | closed |
| T-28-SC | 28-03 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empt… | closed |
| T-28-SC | 28-04 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empt… | closed |
| T-28-SC | 28-05 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empt… | closed |
| T-28-SC | 28-06 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. `node:sqlite`, `node:test`, `node:child_process` and `node:fs` are Node builtins; every other import is a relative path inside `src/mc… | closed |
| T-28-07-SC | 28-07 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. `node:fs`, `node:path`, `node:test` and `node:sqlite` are Node builtins; every other import is a relative path inside `src/mcp/vice/`.… | closed |
| T-28-07-seamspread | 28-07 | Tampering | new `node:sqlite` reachability | low | accept | This plan adds no import to any test file — the half-states are constructed through the public `handle.db`, which the existing tests already use — so… | closed |
| T-28-08-SC | 28-08 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. `node:crypto`, `node:fs`, `node:path` and `node:sqlite` are Node builtins; every other import is a relative path inside `src/mcp/vice/… | closed |
| T-28-08-uuid | 28-08 | Spoofing | the staging filename's uniqueness | low | accept | `randomUUID()` is `node:crypto`'s CSPRNG-backed v4 generator; a collision within the same directory is not a threat model this project needs to defen… | closed |
| T-28-09-SC | 28-09 | Tampering | npm / pip / cargo installs | low | accept | Zero installs. `node:fs`, `node:path` and `node:test` are Node builtins; every other import is a relative path inside `src/mcp/vice/`. `28-RESEARCH.m… | closed |
| T-28-09-seamspread | 28-09 | Tampering | `node:fs` in the validator layer | low | accept | A Node builtin, not a seam. `hostpath-consumers.test.ts`'s closed five-element consumer set is unchanged and still excludes `anno-types.ts`; `TEST_FI… | closed |
| T-28-10-05 | 28-10 | Denial of Service | the `schema_version` 1 → 2 refusal | low | accept | A store written by the current code becomes unopenable. Accepted at the task-1 checkpoint on the record: the code is unreleased, the refusal is by na… | closed |
| T-28-12-06 | 28-12 | Information Disclosure | `AnnoStorePathError` messages naming resolved paths | low | accept | The refusal names both the resolved path and the resolved root, which is required for a caller to act on it and is already the established message sh… | closed |
| T-28-12-07 | 28-12 | Spoofing | a path differing only in Unicode normalisation form | low | accept | The comparison is byte-wise over resolved strings with no normalisation. Recorded as a `verification: backstop` truth and in the test file's header r… | closed |
| T-28-SC | 28-13 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan; `package.json` and `package-lock.json` are not in `files_modified`. No new dependency is introdu… | closed |
| T-28-09 | 28-14 | Information disclosure | the new refusal message (`anno-store.ts`) | low | accept | The message interpolates the store path and the underlying SQLite message, matching every existing refusal in this module. The store path is caller-s… | closed |
| T-28-SC | 28-14 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan; no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-15 | 28-15 | Tampering | byte-wise, non-normalising path comparison | low | accept | Stated as a limit in the same place the guarantee is claimed. A normalising comparison would be a new decision with its own case-folding and Unicode… | closed |
| T-28-SC | 28-15 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan; no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-SC | 28-16 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-27 | 28-17 | Information disclosure | the not-rolled-back message quoting an underlying SQLite er… | low | accept | The message quotes an error this module already surfaces on the neighbouring branch, and the store path it names is already in every other refusal in… | closed |
| T-28-SC | 28-17 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-SC | 28-18 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-40 | 28-19 | Elevation of privilege | the refusal message suggesting the store could widen the ca… | low | accept | Trap 7 forbids the substitution and the action forbids the message from offering it. Accepted rather than mechanically enforced: a grep over message… | closed |
| T-28-SC | 28-19 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. `28-RESEARCH.md`… | closed |
| T-28-SC | 28-20 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-SC | 28-21 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-SC | 28-22 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | closed |
| T-28-SC | 28-23 | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. `28-RESEARCH.md`… | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Verification Evidence

L1 (grep-depth) verification performed 2026-08-29 against `src/mcp/vice/`, plus
the phase-scoped behavioural suite.

**All four `critical` threats — controls located in source:**

| Threat | Control | Evidence |
|--------|---------|----------|
| T-28-01 (28-13) | `reconcileSnapshotRing` abstains from the pointer-row direction | `anno-store.ts:1013`; header at `:793` states it "IS NO LONGER ONE OF THEM"; symlink fixtures in `anno-confinement.test.ts` |
| T-28-16 (28-16) | `revertTo`'s destructive steps sit downstream of a successful `openStore` of the staged copy | `mustExist` option `anno-store.ts:415`, refusal before `new DatabaseSync` at `:447`/`:465`, step-2 gate `:675-699` |
| T-28-61 (28-23) | Reinterpretation record computed per fragmented split row **before the first `delete`** | `splitReinterpretation` `:1939`; gate loop `:2141-2152` completes before the delete loop opens at `:2154-2155` — read and confirmed, not inferred |
| T-28-62 (28-23) | `reinterpretedSplitTables` always present on a successful result | declared `:2282`, returned `[]` on the no-change path `:2124`, populated `:2165` |

**Recurring high-severity control families — verified present:**

| Family | Threats | Evidence |
|--------|---------|----------|
| Path confinement | T-28-path, T-28-09-toctou, T-28-05 | `storePathWithinWorkspace` (3 sites), `AnnoStorePathError` `:346`/`:431`; closed consumer set pinned by `hostpath-consumers.test.ts:148-149` (`deepEqual` + `length, 5`) |
| SQL injection | T-28-sqli | 37 `prepare()` sites; every `exec()` site is a literal keyword (`commit`, `begin immediate`, `rollback`, `DDL`) except the single `vacuum into ${sqlQuotedPath(staging)}` at `:1327`. `sqlQuotedPath` `:344-351` refuses control characters and doubles single quotes |
| Corruption refusal | T-28-corrupt | Both `integrity_check` arms present `:534-546`; `db.close()` precedes each throw; `AnnoStoreCorruptError` names the resolved path |
| Lost-update / stale base | T-28-lostwrite, T-28-lastwritewins, T-28-basemismatch, T-28-staleguard | `AnnoStoreStaleRevisionError` with `baseRevision` vs `currentRevision` compare-and-swap at `:1517-1522` |
| Error-family containment | T-28-07-familyescape | Twelve declared error classes, all in the `AnnoStoreError` / `ViceError` family |
| Shape gate / silent-loss disclosure | T-28-35…T-28-39 | `assertRangeShape` over every proposed remainder before the first `delete`; `AnnoSplitRemainderError` carries both conflicting numbers |

**Behavioural evidence.** `node --test anno-types.test.ts anno-index.test.ts
anno-overlap.test.ts anno-store.test.ts anno-seam.test.ts anno-durability.test.ts
anno-confinement.test.ts block-class.test.ts` → **218 tests / 218 pass / 0 fail /
0 skipped**, real exit code 0, 13.8 s. Independently re-run for this audit; matches
`28-VERIFICATION.md`'s recorded figure exactly.

**Residual, disclosed not closed.** `28-VERIFICATION.md` records a
`coincidental_reliance` item: truth 4's class-level completeness rests on
`retype()` being the only writer of `anno_range` (`insertRange` has exactly three
call sites, all inside `retype()`), which is **true today but not structurally
enforced**. A fourth `insertRange` call added outside `retype()` would bypass the
shape gate silently. This is advisory — it falsifies no threat's mitigation as
shipped — and is carried forward as an accepted risk below.


---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-SC | T-28-SC (28-01) | Zero package-manager installs in this phase: the persistence layer and the test framework are Node builtins and every in-repo import is a relative path. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table… | plan author, phase 28 | 2026-08-29 |
| AR-02-SC | T-28-SC (28-02) | Zero installs. `node:test` and `Int32Array` are Node builtins; both imports in this plan are relative paths inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by measurement. A pl… | plan author, phase 28 | 2026-08-29 |
| AR-03-fixturedrift | T-28-fixturedrift (28-03) | Not touched by this plan, deliberately: they model the external analyser's output, which the census still consumes in production, and migrating them would move measured census numbers for no criterion. `git diff --stat… | plan author, phase 28 | 2026-08-29 |
| AR-03-SC | T-28-SC (28-03) | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by measurement. A plan proposing an install is a scope change… | plan author, phase 28 | 2026-08-29 |
| AR-04-SC | T-28-SC (28-04) | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by measurement. A plan proposing an install is a scope change… | plan author, phase 28 | 2026-08-29 |
| AR-05-SC | T-28-SC (28-05) | Zero installs. Every import added by this plan is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by measurement. A plan proposing an install is a scope change… | plan author, phase 28 | 2026-08-29 |
| AR-06-SC | T-28-SC (28-06) | Zero installs. `node:sqlite`, `node:test`, `node:child_process` and `node:fs` are Node builtins; every other import is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty… | plan author, phase 28 | 2026-08-29 |
| AR-07-seamspread | T-28-07-seamspread (28-07) | This plan adds no import to any test file — the half-states are constructed through the public `handle.db`, which the existing tests already use — so `TEST_FILES_NAMING_SQLITE` stays a one-element list and STORE-07's sh… | plan author, phase 28 | 2026-08-29 |
| AR-07-SC | T-28-07-SC (28-07) | Zero installs. `node:fs`, `node:path`, `node:test` and `node:sqlite` are Node builtins; every other import is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by… | plan author, phase 28 | 2026-08-29 |
| AR-08-uuid | T-28-08-uuid (28-08) | `randomUUID()` is `node:crypto`'s CSPRNG-backed v4 generator; a collision within the same directory is not a threat model this project needs to defend. The `pid` component makes a cross-process collision require a UUID… | plan author, phase 28 | 2026-08-29 |
| AR-08-SC | T-28-08-SC (28-08) | Zero installs. `node:crypto`, `node:fs`, `node:path` and `node:sqlite` are Node builtins; every other import is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table… | plan author, phase 28 | 2026-08-29 |
| AR-09-toctou | T-28-09-toctou (28-09) | `realpathSync` resolves at check time; a symlink swapped between the check and the connection would defeat it. Accepted at ASVS level 1: the attacker model here is a symlink already present in a workspace the agent is w… | plan author, phase 28 | 2026-08-29 |
| AR-09-seamspread | T-28-09-seamspread (28-09) | A Node builtin, not a seam. `hostpath-consumers.test.ts`'s closed five-element consumer set is unchanged and still excludes `anno-types.ts`; `TEST_FILES_NAMING_SQLITE` is unchanged. Accepted, with both guards asserted g… | plan author, phase 28 | 2026-08-29 |
| AR-09-SC | T-28-09-SC (28-09) | Zero installs. `node:fs`, `node:path` and `node:test` are Node builtins; every other import is a relative path inside `src/mcp/vice/`. `28-RESEARCH.md` § Package Legitimacy Audit records an empty table by measurement. A… | plan author, phase 28 | 2026-08-29 |
| AR-10-05 | T-28-10-05 (28-10) | A store written by the current code becomes unopenable. Accepted at the task-1 checkpoint on the record: the code is unreleased, the refusal is by name inside the `ViceError` family, and the legacy ring is left on disk… | plan author, phase 28 | 2026-08-29 |
| AR-10-SC | T-28-10-SC (28-10) | No package-manager install task exists in this plan and none is added: every import is a Node builtin (`node:fs`, `node:path`, `node:crypto`, `node:sqlite`) or an existing intra-repo module. The package-legitimacy gate… | plan author, phase 28 | 2026-08-29 |
| AR-11-03 | T-28-11-03 (28-11) | **Two consequences, both accepted, both stated.** (1) It declines and reports `deferred: true`, so the ring may temporarily exceed the bound until the next accepted write — extra files, the direction trap 10 already arg… | plan author, phase 28 | 2026-08-29 |
| AR-11-SC | T-28-11-SC (28-11) | No package-manager install task exists in this plan and none is added; every import is a Node builtin or an existing intra-repo module. The package-legitimacy gate is not applicable. | plan author, phase 28 | 2026-08-29 |
| AR-12-04 | T-28-12-04 (28-12) | **Stated residual, not closed.** `DatabaseSync` takes a path, not a file descriptor, so there is no `O_NOFOLLOW`/`openat` route to making the check and the open one operation. Recorded as a `verification: backstop` trut… | plan author, phase 28 | 2026-08-29 |
| AR-12-06 | T-28-12-06 (28-12) | The refusal names both the resolved path and the resolved root, which is required for a caller to act on it and is already the established message shape across this module. The paths are the caller's own input plus the… | plan author, phase 28 | 2026-08-29 |
| AR-12-07 | T-28-12-07 (28-12) | The comparison is byte-wise over resolved strings with no normalisation. Recorded as a `verification: backstop` truth and in the test file's header rather than fixed: normalising here would disagree with whatever the fi… | plan author, phase 28 | 2026-08-29 |
| AR-12-SC | T-28-12-SC (28-12) | No package-manager install task exists in this plan and none is added; the only new imports are named bindings on the already-present `node:fs` builtin specifier. The package-legitimacy gate is not applicable. | plan author, phase 28 | 2026-08-29 |
| AR-13-04 | T-28-04 (28-13) | Unchanged by this plan and already mitigated by 28-11: the sweep takes the store's write lock before it judges, and `SNAPSHOT_FILE_PATTERN` is anchored so a concurrent writer's staging file is invisible to it. Round 3 r… | plan author, phase 28 | 2026-08-29 |
| AR-13-SC | T-28-SC (28-13) | No package-manager install task exists in this plan; `package.json` and `package-lock.json` are not in `files_modified`. No new dependency is introduced, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-14-09 | T-28-09 (28-14) | The message interpolates the store path and the underlying SQLite message, matching every existing refusal in this module. The store path is caller-supplied and the process is local; no new information crosses a boundar… | plan author, phase 28 | 2026-08-29 |
| AR-14-SC | T-28-SC (28-14) | No package-manager install task exists in this plan; no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-15-14 | T-28-14 (28-15) | Declared unclosable at this layer and already STATED as a limit: `node:sqlite`'s `DatabaseSync` takes a path, not a descriptor, so there is no `O_NOFOLLOW`/`openat` route. Round 3 ruled the substitution accepted. Prohib… | plan author, phase 28 | 2026-08-29 |
| AR-15-15 | T-28-15 (28-15) | Stated as a limit in the same place the guarantee is claimed. A normalising comparison would be a new decision with its own case-folding and Unicode hazards, and no reachable exploit is recorded against the current form… | plan author, phase 28 | 2026-08-29 |
| AR-15-SC | T-28-SC (28-15) | No package-manager install task exists in this plan; no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-16-18 | T-28-18 (28-16) | Refused only if it fails to open; an image that opens cleanly with the expected `schema_version` is ADMITTED. Closing this needs a store-identity column, i.e. a `SCHEMA_VERSION` bump — this milestone's one-way decision,… | plan author, phase 28 | 2026-08-29 |
| AR-16-20 | T-28-20 (28-16) | An unopenable image makes its revision drop out of the advertised list — the store refuses rather than destroys, which is the safe direction, and the file stays on disk as evidence (task 2's sweep control). Fully closin… | plan author, phase 28 | 2026-08-29 |
| AR-16-SC | T-28-SC (28-16) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-17-27 | T-28-27 (28-17) | The message quotes an error this module already surfaces on the neighbouring branch, and the store path it names is already in every other refusal in the family. No new class of information crosses the boundary. | plan author, phase 28 | 2026-08-29 |
| AR-17-SC | T-28-SC (28-17) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-18-SC | T-28-SC (28-18) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-19-40 | T-28-40 (28-19) | Trap 7 forbids the substitution and the action forbids the message from offering it. Accepted rather than mechanically enforced: a grep over message prose would re-create exactly the message-wording coupling 28-18 P1 re… | plan author, phase 28 | 2026-08-29 |
| AR-19-SC | T-28-SC (28-19) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. `28-RESEARCH.md` carries no new package rows for this round. | plan author, phase 28 | 2026-08-29 |
| AR-20-SC | T-28-SC (28-20) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-21-SC | T-28-SC (28-21) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-22-SC | T-28-SC (28-22) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. | plan author, phase 28 | 2026-08-29 |
| AR-23-68 | T-28-68 (28-23) | The new computation is pure arithmetic over at most 32768 offset couples per overlapped row, runs inside the existing pre-delete loop, performs no I/O and opens nothing. It cannot extend the write lock beyond what the l… | plan author, phase 28 | 2026-08-29 |
| AR-23-SC | T-28-SC (28-23) | No package-manager install task exists in this plan and no dependency is added, so the package-legitimacy gate has nothing to audit. `28-RESEARCH.md`'s Package Legitimacy Audit is unchanged and unconsulted because nothi… | plan author, phase 28 | 2026-08-29 |
| AR-RES-01 | `coincidental_reliance` (28-VERIFICATION.md) | `retype()` is the only writer of `anno_range` today (3 `insertRange` call sites, all inside it; one `delete from anno_range`), but nothing declares or enforces it. Recommended hardening: pin the call sites structurally in `anno-seam.test.ts`, which already owns that pattern. Advisory only — no effect on status or score. | Henrik Olsson | 2026-08-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Transferred Threats

| Threat ID | From | To | Rationale | Delivered |
|-----------|------|----|-----------|-----------|
| T-28-05 | 28-13 | plan 28-15 | Out of scope for this plan by design; owned by plan 28-15, where the code it depends on is fixed. Splitting it here would mean correcting a comment in the plan that does not fix its code. | yes — `28-15-SUMMARY.md` present |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-29 | 167 | 167 | 0 | /gsd-secure-phase (orchestrator, L1 grep-depth + behavioural suite) |

Breakdown: 124 `mitigate`, 42 `accept`, 1 `transfer`. By severity: 4 critical,
74 high, 59 medium, 30 low. No open threat at or above the `high` blocking
threshold — `threats_open: 0`.

Per the workflow short-circuit (`threats_open: 0` ∧ `register_authored_at_plan_time:
true` ∧ `asvs_level == 1`), L1 grep-depth is sufficient and no deeper auditor pass
was required.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-29
