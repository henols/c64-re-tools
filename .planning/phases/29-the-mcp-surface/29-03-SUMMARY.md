---
phase: 29-the-mcp-surface
plan: 03
subsystem: database
tags: [sqlite, node-sqlite, annotation-store, schema-version, enums, ddl]

requires:
  - phase: 28-the-store-core
    provides: the `.annostore` module (`anno-store.ts`, `anno-types.ts`), its write sequence, its snapshot ring, and the single-witness `schema_version` refusal this plan had to leave intact
provides:
  - "`anno_enum_usage` — one address associated with at most one project enum, BY ENUM ID"
  - "`SCHEMA_VERSION` 3, with D-15's cost recorded in the constant's own doc comment and no migration arm anywhere in the module"
  - "`applyEnumUsage` / `clearEnumUsage` / `listEnumUsage` — the three store functions the `anno_apply_enum_usage` verb dispatches to"
  - "`EnumUsageRow` in `anno-types.ts`"
  - "a behavioural proof that a GENUINE version 2 store file is refused by name and left byte-identical, plus a structural proof that the refusal is a SINGLE witness"
affects: [anno-tools, mcp-surface, enum-usage-verb, phase-30]

actuals:
  tokens: 8525
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A schema bump records its own cost, dated, in the constant's doc comment — not only in a planning directory"
    - "A test-only spawned `.mjs` helper is how a test reaches a confined dependency, rather than widening the guard's declared list"

key-files:
  created:
    - src/mcp/vice/anno-schema-v2-fixture.mjs
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "D-15 executed as confirmed: `SCHEMA_VERSION` 2 → 3 with no migration arm, stranding every version 2 store deliberately"
  - "The enum usage is associated by `anno_enum.id`, never by name, so `updateProjectEnum`'s rename cannot orphan or silently re-point it"
  - "Applying a DIFFERENT enum at an address that already carries one REPLACES rather than refuses — `unique(address, bank)` means one address carries at most one enum, and the verb's own schema words are a set"
  - "The plan's `revision does not advance` criterion was NOT implemented: it contradicts `AnnoWriteResult`'s documented invariant and the plan's own instruction to copy `putXref` verbatim. `changed` carries the idempotency claim; the revision advances on every accepted write"
  - "The v2 fixture builder lives in a spawned `.mjs` helper rather than widening `anno-seam.test.ts`'s `TEST_FILES_NAMING_SQLITE`"

patterns-established:
  - "Single-witness refusal, enforced structurally: exactly one `schema_version` comparison site, no second `anno_meta.schema_version` write, no migration entry point — with the failure message saying that a second comparison site is how a migration arm arrives without a decision"
  - "A pinned byte figure that moves is RE-RECORDED with its cause named, not silently updated"

requirements-completed: [MCP-01, MCP-04]

coverage:
  - id: D1
    description: "`anno_enum_usage` exists in the DDL with an `enum_id` column referencing `anno_enum(id)` and a `unique(address, bank)` constraint, plus the `anno_enum_usage_address` index"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#applying a project enum at an address is idempotent, is refused by name when the enum does not exist, and clears back to nothing"
        status: pass
      - kind: other
        ref: "grep -ac 'create table anno_enum_usage' src/mcp/vice/anno-store.ts → 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Apply and clear are both idempotent — a repeated apply and a clear of an unused address each return `changed: false`, neither is an error"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#applying a project enum at an address is idempotent, is refused by name when the enum does not exist, and clears back to nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The association is by enum ID — `updateProjectEnum`'s rename re-resolves the usage rather than orphaning or silently re-pointing it (T-29-13)"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#an enum usage is associated by enum ID, so renaming the enum through updateProjectEnum re-resolves the usage rather than orphaning or silently re-pointing it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every argument is validated through the existing `anno-types.ts` assertions before any SQL runs; an out-of-range address and an unprefixed numeric string are both refused (T-29-11, WR-22)"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#applyEnumUsage validates its address through parseStoreAddress before any SQL runs -- an out-of-range address and an UNPREFIXED numeric string are both refused, and neither writes a row"
        status: pass
    human_judgment: false
  - id: D5
    description: "`SCHEMA_VERSION` is 3, with D-15 cited by name and by date in the constant's own doc comment, and the accepted cost (no migration arm) stated there"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#SCHEMA_VERSION is 3, and the constant's own doc comment records D-15 by name and by date -- the bump is a decision on the record, not a number that drifted"
        status: pass
    human_judgment: false
  - id: D6
    description: "A GENUINE version 2 store file — written by a child process against a frozen v2 DDL, not by downgrading a v3 store — is refused by name naming both versions, and left byte-identical on disk"
    requirement: MCP-04
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#D-15: a genuine SCHEMA_VERSION 2 store file is REFUSED by name -- naming both the version found and the version expected -- and the file is left byte-identical, so neither a silent open nor a silent upgrade is possible"
        status: pass
    human_judgment: false
  - id: D7
    description: "The refusal is a SINGLE witness — exactly one comparison site inside `openStore`, no second `anno_meta.schema_version` write, no migration entry point. Both plantings (a second comparison site; a `migrateStore()`) were observed RED before the tree was restored."
    requirement: MCP-01
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#D-15: the schema_version refusal is a SINGLE WITNESS -- exactly one comparison site, inside openStore, with no second write of anno_meta.schema_version and no migration entry point anywhere in the module"
        status: pass
    human_judgment: false
  - id: D8
    description: "The owner's one-way confirmation of D-15 is recorded with its date and a re-verified measured basis"
    verification: []
    human_judgment: true
    rationale: "A recorded human decision. The measured facts underneath it are re-verified below and reproducible, but that the owner confirmed it — and understood the cost — is not something a test can assert."

duration: 17 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 03: The Enum-Usage Table and the SCHEMA_VERSION 3 Bump Summary

**`anno_enum_usage` associates one address with one project enum by enum ID at `SCHEMA_VERSION` 3, and the version refusal is proven — behaviourally and structurally — to have stayed a single witness with no migration arm.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-29T15:25:39Z
- **Completed:** 2026-08-29T15:42:55Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- `anno_enum_usage` in the DDL — autoincrement `id`, not-null `address`, not-null `enum_id references anno_enum(id)`, nullable reserved `bank`, `unique(address, bank)` — plus the `anno_enum_usage_address` index matching its siblings' naming.
- `SCHEMA_VERSION` 2 → 3, with the D-15 record written into the constant's own doc comment: what the bump buys, that no migration arm was written, the measured basis, and an explicit statement of how this refusal DIFFERS in kind from the version 1 one (version 1 could not be migrated even in principle; version 3 could have been and deliberately was not).
- `applyEnumUsage`, `clearEnumUsage`, `listEnumUsage` — `putXref`'s idempotency shape copied, every statement `db.prepare(...)` with bound parameters, every argument validated through the existing `anno-types.ts` assertions before any SQL runs.
- A genuine version 2 store file, built by a spawned child against a frozen hand-written v2 DDL, is observed refused by name and byte-identical afterwards — one test excluding both a silent open and a silent upgrade.
- A structural guard making the refusal a *single* witness, with both its plantings observed going red.

## Task Commits

1. **Task 1: One-way decision gate (D-15)** — no code commit; a decision gate modifies no file (see acceptance criteria below). Its record is this SUMMARY and the plan-metadata commit.
2. **Task 2: `anno_enum_usage`, the schema bump, apply/clear/list** — `f00de82` (test, RED) → `3b78ff0` (feat, GREEN). No refactor commit: nothing needed cleaning up.
3. **Task 3: the single-witness proof** — `8512b3e` (test) → `6f94a92` (fix, the deviation below).

**Plan metadata:** see the `docs(29-03)` commit.

## Task 1 — the one-way decision, as executed

**Owner response: "confirmed" — option id `add-and-bump`. Confirmation date: 2026-08-29.**

The owner confirmed executing D-15's recorded choice: add `anno_enum_usage` and bump `SCHEMA_VERSION` 2 → 3 **with no migration arm**, accepting that every existing version 2 `.annostore` on disk becomes permanently unopenable, with no upgrade path and no later opportunity to add one that would not be guessing.

### The measured basis — re-verified in this run, not inherited

The basis presented at decision time was *"no store file is tracked in this repository, and the store shipped five days ago"*. It was re-measured rather than copied forward, and it is **stronger than the inherited claim in one respect and imprecise in another**. Both are recorded, because a basis quietly improved is a basis nobody can check:

| Fact | Measured this run | Command |
|---|---|---|
| Store files tracked in this repository | **none** | `git ls-files \| grep -aiE 'annostore'` → no output |
| Store files anywhere in the working tree | **none** | `find . -name '*.annostore*' -not -path './node_modules/*'` → no output |
| `anno-store.ts` / `anno-types.ts` first landed | **2026-08-27** (`4c9cea3`, `feat(28-01)`) — **two days ago, not five** | `git log --diff-filter=A -- src/mcp/vice/anno-store.ts` |
| The **version 2** shape landed | **2026-08-28** (`0e15c51`, `feat(28-10)`) — **one day ago** | `git log -S'SCHEMA_VERSION = 2' -- src/mcp/vice/anno-types.ts` |
| Most recent release tag | **`v0.5.0`, 2026-08-25** — which **PREDATES the store entirely** | `git for-each-ref --sort=-creatordate refs/tags` |

The last fact is the one that was not in the inherited basis and is the most load-bearing: **no tagged release has ever shipped the annotation store at all**, so no store reached a user through a release. The inherited "five days" is imprecise in the direction that *understates* the case — the artefact at risk is younger than claimed, and version 2 specifically is one day old.

**Assumption A2, flagged rather than asserted (unchanged):** any store that would be stranded is in a user's own project and outside this repository's reach by construction. That is not measurable from here; it is stated as an assumption.

### Task 1 acceptance criteria

- ✅ `29-03-SUMMARY.md` records the confirmation, its date, and the measured basis — this section.
- ✅ No file under `src/mcp/vice/` was modified by Task 1. Verified: Task 1 produced no commit and no working-tree edit; the first source change is in `f00de82`, which is Task 2's RED commit.

## Phase 28's two `behavior_unverified` items — restated verbatim, STILL OPEN

Nothing in this plan closes, drops, or re-files either item. Prohibition 28-18 P3 forbids doing so, and F-6 carries them forward unchanged. Their reasons below are quoted unedited from `28-VERIFICATION.md` as `.planning/REQUIREMENTS.md` carries them.

| Item | Status after plan 29-03 | Reason, carried unchanged |
|---|---|---|
| `openStore`'s `integrity_check could not be run at all` throw arm (`anno-store.ts:529-535` as numbered in Phase 28) | **STILL OPEN** — open since round 4 | *"The arm is defensive and has no reachable input without filesystem- or SQLite-level fault injection. Presence and wiring verified in source this round (`db.close()` precedes the throw, and the message names `resolved`); no test exercises the throw, and a 10-second spot-check cannot construct the precondition."* |
| 28-17's `backstop`-tagged host-crash durability bound across `stageSnapshot` fsync → `publishSnapshot` rename → pointer-row commit | **STILL OPEN** — abstained as `insufficient_spec` | *"An `fsync` has NO in-process observable, so the only in-process evidence is the SOURCE ORDER of two `fsyncPath()` calls — which is presence, not behaviour. 28-17 filed this honestly as `backstop`. Presence + wiring never qualify as behavioural evidence for a durability claim."* |

**Nothing in 29-03 touches either.** The `integrity_check` arm was read and left byte-identical — the plan required it left exactly as it is, and the new structural test deliberately asserts nothing about it. The snapshot fsync/rename/pointer-row path is untouched; the new `delete from anno_enum_usage` runs inside the existing write sequence's transaction and adds no new durability claim.

**One line-number note, so a reader is not misled:** Phase 28 cites the arm at `anno-store.ts:529-535`. This plan's insertions shifted it — it now sits at `:547-553`. The arm's text is unchanged; only its address moved.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `SCHEMA_VERSION` 2 → 3 with the dated D-15 paragraph; new `EnumUsageRow` interface beside `ProjectEnumRow` / `XrefRow`.
- `src/mcp/vice/anno-store.ts` — `anno_enum_usage` table and index in the DDL; the DDL header's now-partial "the DDL change touched only `anno_snapshot`" sentence scoped and kept rather than deleted; `applyEnumUsage`, `clearEnumUsage`, `listEnumUsage`.
- `src/mcp/vice/anno-store.test.ts` — the four behaviour tests, the two single-witness tests, the frozen `SCHEMA_VERSION_2_DDL` literal, and the re-recorded CR-08 byte figure.
- `src/mcp/vice/anno-types.test.ts` — the hand-written `SCHEMA_VERSION` 3 pin and the `EnumUsageRow` shape pin (type-level plus runtime keys).
- `src/mcp/vice/anno-schema-v2-fixture.mjs` — **new.** The test-only spawned child that writes a genuine v2 store file. Absent from `files[]`, outside the `*.test.*` glob, never imported by a production module.

## Decisions Made

- **The association is by `anno_enum.id`.** A row persisting the *name* would be re-pointed silently by `updateProjectEnum`'s rename — the usage would follow whatever enum next took the old name — and the disagreement would be invisible because both answers look authoritative. `listEnumUsage` resolves the name back through a join at read time.
- **Applying a *different* enum at an occupied address REPLACES rather than refuses.** `unique(address, bank)` means one address carries at most one enum, and the verb's own schema words ("Applies an enum definition to format the immediate operand … at a specific address") describe a set, not an add. Refusing would leave the caller with no way to change an address's enum at all.
- **The enum is resolved to its id INSIDE the transaction.** Resolving outside it would open a window in which a concurrent writer renames or removes the enum between the read and the insert — the same reasoning the write sequence's own rollback comment already records for the label-name case.
- **`clearEnumUsage`'s doc block states the row-deleting-statement count moving from two to three, in prose that deliberately does not spell the SQL prefix a census greps for.** Writing the count using the literal pattern would have made `grep -ac 'delete from anno_'` report 6 rather than 3 — a census counting its own description. The count is stated; the pattern is not repeated.

## Deviations from Plan

### 1. [Rule 1 — Bug in the plan's own criterion] `applyEnumUsage` DOES advance the revision on a no-op

- **Found during:** Task 2, reading `runWriteSequence` before writing the test.
- **Issue:** The plan's `<behavior>` says *"Applying the same enum at the same address again returns `changed: false` and the revision does not advance"*, and its acceptance criterion repeats it as *"the store's revision is unchanged between them"*. **Both are false of this module, and the plan contradicts itself.** Its own `<action>` instructs copying `putXref`'s idempotency shape *exactly*, and `putXref` goes through `applyWrite` → `runWriteSequence`, whose compare-and-swap (`update anno_meta set revision = revision + 1`) runs **before** the caller's mutation and unconditionally on every accepted write. `AnnoWriteResult`'s own doc comment states this as an invariant: *"`changed` is the ONLY signal that distinguishes a no-op from a real edit. The revision is NOT that signal: every accepted write advances it by exactly one, including a write that turned out to be identical to what was already stored."* Satisfying the criterion literally would have required a second write path bypassing `applyWrite` — new code in the module D-15 explicitly chose the bump to *avoid* adding code to.
- **Fix:** Implemented `<action>`'s instruction (copy `putXref`) and the plan's `must_haves` truth, which is the load-bearing one and says nothing about the revision: *"Applying the same enum at the same address twice returns `changed: false` with no error … both are idempotent, neither is rejected."* The test asserts `changed: false` **and** asserts the revision advances by exactly one, with the invariant cited in the assertion message so the next reader finds the reason rather than a surprise.
- **Files modified:** `src/mcp/vice/anno-store.ts`, `src/mcp/vice/anno-store.test.ts`
- **Verification:** the idempotency test passes and pins both facts.
- **Committed in:** `3b78ff0` (test in `f00de82`)

### 2. [Rule 3 — Blocking] CR-08's pinned live-store byte figure moved, 69,632 → 81,920

- **Found during:** Task 2, first green run.
- **Issue:** `anno-store.test.ts`'s CR-08 truncation test pins the live store's size at 69,632 bytes for a three-write store. Adding one table and one index to the DDL grows the schema pages, so the figure became 81,920 and the test went red.
- **Fix:** Re-recorded to 81,920, with the cause named as a *second admissible reason* beside the SQLite-default drift the test's own comment already anticipates. The CR-08 reproduction's original figure (69,632) is deliberately left spelled out in the comment and in the assertion message, because the finding is quoted in bytes and a test that stopped naming the number could no longer be matched against it. What the assertion actually protects — the bytes being identical *after* the refusal — is untouched.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`
- **Verification:** the CR-08 test and its three siblings pass.
- **Committed in:** `3b78ff0`

### 3. [Rule 1 — Bug I introduced] The inline v2 fixture builder reddened the test-tree `node:sqlite` bound

- **Found during:** Task 3, on the post-task `test:automated` comparison against `29-BASELINE.md`.
- **Issue:** The fixture builder was first written inline in `anno-store.test.ts` as an `execFileSync(process.execPath, ["-e", script, …])` call whose script string spells `node:sqlite`. `anno-seam.test.ts` bounds the **test** tree with the same predicate `STORE-07` uses on the shipped set: the set of test files naming the builtin is a DECLARED list, today exactly `["anno-seam.test.ts"]`. The naming is a substring test over stripped source, so a specifier inside a spawn script counts — correctly. This surfaced as one extra failing file that was **not** in the phase baseline's recorded set, which is exactly what that baseline exists to catch.
- **Fix:** Moved the builder into `anno-schema-v2-fixture.mjs`, a test-only spawned helper following `anno-durability-mutator.mjs`'s established pattern — absent from `files[]`, outside the `*.test.*` glob, never imported by a production module. The child names the builtin; no test file does. **Widening `TEST_FILES_NAMING_SQLITE` was the available alternative and was rejected:** it would have cost a standing guard to serve one fixture. The frozen v2 DDL stays declared in `anno-store.test.ts` beside the claim it supports, passed to the child as `argv[3]`, so the shape has one home and the writer is a writer.
- **Files modified:** `src/mcp/vice/anno-store.test.ts`; created `src/mcp/vice/anno-schema-v2-fixture.mjs`
- **Verification:** `anno-seam.test.ts` green; the automated failing-**file** set back to the baseline's exactly.
- **Committed in:** `6f94a92`

---

**Total deviations:** 3 auto-fixed (2 × Rule 1, 1 × Rule 3).
**Impact on plan:** No scope creep. Deviation 1 rejects a plan criterion that contradicted both the module's documented invariant and the plan's own instruction — the alternative would have been new code in a hardened module, which is what D-15 chose the bump to avoid. Deviations 2 and 3 are consequences of the DDL change, both fixed at the introducing commit; deviation 3 was caught only by comparing against `29-BASELINE.md`'s recorded failing-file set rather than against a count.

## Verification

| Check | Result |
|---|---|
| `cd src/mcp/vice && node --test anno-store.test.ts anno-types.test.ts anno-index.test.ts anno-overlap.test.ts anno-confinement.test.ts anno-durability.test.ts anno-seam.test.ts` | **208 tests, 208 pass, 0 fail** (236/236 with `anno-tools.test.ts` and `shipped-modules.test.ts` added) |
| `cd src/mcp/vice && npm run typecheck` | **clean** |
| `cd src/mcp/vice && node --test anno-store.test.ts anno-durability.test.ts anno-confinement.test.ts` (Task 3) | **118 tests, 118 pass, exit 0** |
| A v2 store file observed refused by name, file unchanged on disk | **observed** — `AnnoStoreCorruptError` naming 2 and 3; byte length and full buffer equality asserted across the failed open |
| Both Phase 28 `behavior_unverified` items restated verbatim as STILL OPEN | **done** (section above) |
| `grep -ac 'delete from anno_' src/mcp/vice/anno-store.ts` | **3** — `anno_snapshot` (prune), `anno_range` (`retype`), `anno_enum_usage` (`clearEnumUsage`) |
| `node scripts/check-npm-packages.mjs` | **exit 0** |

### Baseline comparison (`29-BASELINE.md`'s blocking rule: compare the failing-file SET, never a count against zero)

`npm run test:automated`, run after Task 3's fix, with **no VICE broker running** (`ps` shows no `vice-broker`/`x64sc`):

| | Baseline (`c27922a`) | This tree |
|---|---|---|
| Failing **files** | `audit-integrity.test.ts`, `r2000-session.test.ts` | `audit-integrity.test.ts`, `r2000-session.test.ts` |
| Failures | 7 | 8 |

**No file entered the failing set and none left it — no regression, no unexplained improvement.** The count moved 7 → 8 entirely inside `r2000-session.test.ts`, which the baseline records as *"timing-sensitive FIFO-queue tests. Load-sensitive on a busy host"*; the extra failure (`stub: a child that answers nothing within the call timeout…`) is in that same file and that same class. `audit-integrity.test.ts`'s 2 are the baseline's census assertions that go red on a correct tree.

## Issues Encountered

- The plan's `<read_first>` line references drifted from the source (`anno-store.ts:515-535` for the refusal is actually `:500-545`; `:3084-3190` for the enum functions is `:3080-3190`). Navigated by `grep -a` rather than by line number. Noted, not treated as a defect — CLAUDE.md states line numbers in cross-references drift between phases and a mismatch is drift to re-verify.
- Non-vacuity of the structural test was established by planting, not assumed: a second `schema_version !== SCHEMA_VERSION` comparison site outside `openStore`, and a `migrateStore()` writing `update anno_meta set schema_version`, were each observed going **red**, and `anno-store.ts` was confirmed byte-identical to `HEAD` afterwards before the test was committed.

## User Setup Required

None — no external service configuration required. `node:sqlite` is a Node built-in at the `>=22.18.0` engine floor; no package was installed by this plan (T-29-SC).

## Next Phase Readiness

- The store now carries everything the `anno_apply_enum_usage` verb needs: apply, clear, and list, all idempotent, all validated through the existing assertion family, all confined to `anno-store.ts` per `STORE-07`.
- **The one thing a later plan must not do:** add a second `schema_version` comparison site or any migration entry point to `anno-store.ts`. That is now enforced structurally, and the failure message says why — but a plan that *decides* to add one will need to change that test deliberately, which is the point.
- Both Phase 28 `behavior_unverified` items remain open and are inherited by whatever pass next scores them. Neither is closable by anything this phase does.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

- `src/mcp/vice/anno-schema-v2-fixture.mjs` — FOUND
- `src/mcp/vice/anno-types.ts`, `anno-store.ts`, `anno-types.test.ts`, `anno-store.test.ts` — FOUND
- Commits `f00de82`, `3b78ff0`, `8512b3e`, `6f94a92` — all present in `git log`
- All Task 2 and Task 3 acceptance criteria re-run and passing; Task 1's two criteria verified above
