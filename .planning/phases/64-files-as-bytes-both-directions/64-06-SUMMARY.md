---
phase: 64-files-as-bytes-both-directions
plan: 06
subsystem: transport
tags: [file-transfer, staging, autostart, disk-attach, convergence-metric, tcp]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 02)
    provides: "broker-control.mts stage_file/transfer ops, vice-broker-client.ts stageFile(), stock-connect.ts StockConnectBrokerControl.stageFile/StockConnectDeps.transferFile"
  - phase: 64-files-as-bytes-both-directions (plan 03)
    provides: "broker-transfer.mts staging model (stageFileSlot/resolveStagedFile/clearStagingForSession), the real broker wired to it"
  - phase: 64-files-as-bytes-both-directions (plan 04)
    provides: "stock-machine.ts's stage-then-send / resolve-then-stage-then-upload-then-send patterns, the sentPath -> handle rename precedent, and the manifest-schema-in-the-same-change discipline"
provides:
  - "stock-machine.ts: handleAutostart and handleDiskAttach migrated off withEmulatorSidePath() onto session.brokerControl.stageFile()/session.deps.transferFile() -- both results carry the broker-minted handle in place of sentPath (D-15), staged into DIFFERENT slots (\"autostart\"/\"disk8\") so the two tools never supersede each other's staged file mid-session"
  - "handleDiskAttach's result gains a new exported constant, DISK_ATTACH_WRITE_LOSS (D-16), under its own result key -- the disk-attach tool now states explicitly that writes the running program makes to the attached image do not persist past the session"
  - "stock-machine.ts drops its stock-paths.ts import entirely (D-18): the snapshot handlers now call transfer-paths.ts's validateSnapshotName() directly instead of stock-paths.ts's throwing sanitizeSnapshotName() wrapper"
  - "tools-manifest.stock.json: vice_autostart/vice_disk_attach outputSchema updated to require handle (and, for disk_attach, writeLoss) instead of sentPath"
  - "stock-machine.test.ts / stock-dispatch.test.ts: both files' now-dangling setIsInsideContainerForTest() stubs removed -- no handler either file exercises reaches isInsideContainer() any more"
affects: [64-07, 66]

actuals:
  tokens: 11900
  tasks: 3
  commits: 4
  plan_head_before: 99d7f54ebb64498acb42534b2c647ce484d9eb0f

tech-stack:
  added: []
  patterns:
    - "Real-readability-before-staging: unlike the snapshot pair (whose DUMP direction never reads a local file), handleAutostart/handleDiskAttach genuinely need to read the caller's local file, so a shared checkLocalFileReadable() helper runs a real accessSync() check BEFORE any staging request -- an unreadable path is refused with zero staging calls and zero sends, matching handleSnapshotLoad's own existsSync-before-anything-else ordering read in the other direction."
    - "Two slots, not one: handleAutostart stages under \"autostart\", handleDiskAttach under \"disk8\" -- both deliberately different from each other and from the snapshot pair's \"snapshot\" slot, so calling any two of the three tools in one session never lets one supersede another's staged file mid-session (T-64-29)."
    - "A judgement-carrying constant gets its own result key, not appended to an existing one: DISK_ATTACH_WRITE_LOSS is reported under writeLoss, separate from the existing DISK_ATTACH_APPROXIMATION under approximation -- the two sentences answer different questions (reset-and-load behaviour vs. save persistence) and a caller must be able to read either without the other."

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-machine.ts
    - src/mcp/vice/stock-machine.test.ts
    - src/mcp/vice/stock-dispatch.test.ts
    - src/mcp/vice/tools-manifest.stock.json

key-decisions:
  - "Tasks 1 and 2 are recorded as one combined commit (69a8af87), matching 64-04's own precedent exactly, for the same reason: both handlers share one file, one header, one shared helper (checkLocalFileReadable), and mirror each other's structure (stage under a distinct slot, upload, then send AUTOSTART). Reconstructing a genuine, independently-verified intermediate state (\"Task 1 done, Task 2 not yet\") would mean either temporarily reverting an already-correct, already-tested handler or leaving the shared module header's forward-looking prose describing a still-unmigrated handler as migrated -- both add risk without adding real traceability. Task 3's actual remaining work (the manifest schema, the conformance harness fixture fix, and both files' dangling test-stub removal) is its own separate commit (6c1d14ec), matching 64-04's own \"deviation fix\" commit shape for the identical class of manifest/conformance catch-up."
  - "checkLocalFileReadable() is a NEW, deliberate real-filesystem check -- not a reuse of the transfer layer's own statSync-based checks inside defaultTransferFile(). The distinction is load-bearing: the transfer cap's own refusal (which must still fire, naming the limit) happens INSIDE transferFile after staging has already occurred, but an unreadable-path refusal must happen BEFORE staging (zero staging calls is one of this plan's own acceptance criteria) -- delegating both checks to the same place would either stage a slot for a file that was never going to be readable, or duplicate the cap check redundantly in this handler."
  - "The write-loss sentence (DISK_ATTACH_WRITE_LOSS) reads as a complete, standalone statement -- verified by reading it in isolation (this plan's own <human-check>): \"Writes the running program makes to this attached disk image are not preserved: the emulator writes to a copy staged on the broker for this session only, and that copy is deleted once the session closes. Any save made to this disk during the session is gone the next time it is attached.\" It names the session closing and the writes not persisting, and does not depend on DISK_ATTACH_APPROXIMATION's own sentence (which is about reset-and-load behaviour) being read beside it."
  - "The unreadable-path test uses a genuinely nonexistent path under a fresh mkdtempSync() directory rather than a chmod-based permission-denial fixture, following stock-machine.test.ts's own existing precedent (its sidecar-write-failure test's header comment) that a chmod-based approach is a no-op when tests run as root -- ENOENT is deterministic regardless of the running user."

requirements-completed: [XFER-02]
# XFER-08 is declared by this plan's frontmatter but NOT marked complete here:
# gsd_run query requirements.ready-ids reports it BLOCKED -- 64-07 also
# declares XFER-08 and has not yet produced a SUMMARY, so the shared-ID gate
# (#2388) correctly withholds it until 64-07 finishes. XFER-02's only other
# declaring plan (64-04) already finished, so it is marked complete here.

coverage:
  - id: D1
    description: "handleAutostart resolves the caller's absolute path (D-14, unrestricted), verifies it is genuinely readable BEFORE any staging request, stages a slot under the \"autostart\" wire-vocabulary slot, uploads the file's bytes, and only then sends AUTOSTART with the broker-chosen emulator filename in the request body -- the result carries the resolved local path, run, index and the opaque handle, never a broker-side path"
    requirement: XFER-02
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#handleAutostart: records an AutoStart body whose filename equals the staging reply's emulator filename, stages under the 'autostart' slot, uploads the resolved local path, and the result carries the handle -- never sentPath"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleAutostart: an absolute path outside the project root is accepted and uploaded, unrestricted (D-14)"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleAutostart: an unreadable (nonexistent) path refuses naming the path, with zero staging calls and zero sends"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleAutostart: a source file over the transfer cap is refused with the limit in decimal digits, zero sends"
        status: pass
      - kind: unit
        ref: 'stock-machine.test.ts#handleAutostart: program: "GAME" refuses with a message containing "index", zero sends'
        status: pass
    human_judgment: false
  - id: D2
    description: "handleDiskAttach does the same for unit 8 (units 9-11 still refused by name, zero staging calls), staging under the DIFFERENT \"disk8\" slot, and its result states explicitly -- under its own writeLoss key, separate from the existing approximation -- that writes the running program makes to the attached image will NOT persist past the session (D-16)"
    requirement: XFER-08
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#handleDiskAttach: unit: 8 records an AutoStart body whose byte 0 is 0x00 (run flag clear), stages under the 'disk8' slot, uploads the resolved local path, and carries the handle plus both the approximation and write-loss constants"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleDiskAttach: units 9, 10 and 11 are refused with zero staging calls recorded"
        status: pass
      - kind: unit
        ref: "stock-machine.test.ts#handleDiskAttach: an unreadable (nonexistent) path refuses naming the path, with zero staging calls and zero sends"
        status: pass
      - kind: manual_procedural
        ref: "this plan's own <human-check>: DISK_ATTACH_WRITE_LOSS read in isolation, confirmed to state what happened to a saved game without needing DISK_ATTACH_APPROXIMATION beside it"
        status: pass
    human_judgment: true
    rationale: "The write-loss sentence's wording is a judgement call the plan's own <human-check> names explicitly (\"this is a wording judgement, which is exactly the kind a test cannot make\"). This executor self-verified it against the stated criteria and recorded the reasoning in key-decisions above, but the verifier should re-read the sentence itself rather than trust the self-check alone."
  - id: D3
    description: "vice_autostart and vice_disk_attach stage into DIFFERENT slots: using both in one session leaves two distinct staged files with two distinct handles, never one tool's upload superseding the other's mid-session (T-64-29)"
    verification:
      - kind: unit
        ref: "stock-machine.test.ts#handleAutostart then handleDiskAttach in one session: two distinct slots, two distinct handles, two distinct staged files (T-64-29)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The result's broker-side field is the opaque handle, never sentPath (D-15), for both tools -- a test enumerates every key of the successful result and asserts no value equals or contains the stubbed staged path or staging directory"
    verification:
      - kind: unit
        ref: "stock-machine.test.ts's assertNoLeak() helper, applied in both handleAutostart's and handleDiskAttach's own success-case tests"
        status: pass
      - kind: other
        ref: "tools-manifest.stock.json's vice_autostart/vice_disk_attach outputSchema requires handle (and, for disk_attach, writeLoss), not sentPath -- checked by stock-dispatch.test.ts's conformance harness against the real dispatchStock() answer"
        status: pass
    human_judgment: false
  - id: D5
    description: "stock-machine.ts imports nothing from stock-paths.ts and contains zero emulator-side path translation calls outside comments -- the mechanism D-18 names for the convergence metric moving. Exactly four handlers were migrated across this phase (vice_autostart, vice_disk_attach, vice_snapshot_save, vice_snapshot_load) and no fifth tool (vice_symbols_load, vice_program_load, host_tool) gained transport work."
    requirement: XFER-08
    verification:
      - kind: other
        ref: "grep: 'from \"./stock-paths.ts\"' and 'withEmulatorSidePath' (outside comments) both return zero matches in stock-machine.ts"
        status: pass
      - kind: other
        ref: "git diff --name-only origin/main -- host-tool.mts host-tool-client.ts stock-symbols.ts: empty (text-tools.ts's own appearance in that same diff predates this plan -- see Issues Encountered)"
        status: pass
      - kind: other
        ref: "measured: production (non-test) importers of hostpath.ts/containerpath.ts/stock-paths.ts dropped from 6 (STATE.md's milestone-open list) to 5 -- stock-machine.ts is the one that left the list. Not yet 4: 64-07 is the sibling plan that closes the remainder."
        status: pass
    human_judgment: false
  - id: D6
    description: "The full pre-existing suite's failing-test set is unchanged (0 fail), typecheck is clean, and no untracked scratch directory was left"
    verification:
      - kind: integration
        ref: "npm test (full suite): 4396 tests, 4312 pass, 0 fail, 84 skipped -- improvement over the 64-04 baseline (4376/4292/0/84), consistent with this plan's own added coverage"
        status: pass
      - kind: other
        ref: "npm run typecheck: clean"
        status: pass
      - kind: other
        ref: "git status --porcelain after this plan's commits: no untracked fixture/scratch directory (the 5 untracked files present are pre-existing and unrelated to this plan -- confirmed via git status before any edit)"
        status: pass
    human_judgment: false

duration: ~50min (approximate -- see Issues Encountered)
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 6: Files as Bytes, Both Directions -- Autostart/Disk-Attach Migration Summary

**`vice_autostart`/`vice_disk_attach` migrated off the shared-filesystem path onto the broker's own file-transfer protocol, staged into two DISTINCT slots so neither tool supersedes the other's staged file -- `stock-machine.ts` now imports nothing from `stock-paths.ts` at all, and `vice_disk_attach`'s result states plainly, in its own key, that a game's saves to the attached disk are lost when the session closes.**

## Performance

- **Duration:** ~50 min (approximate -- see Issues Encountered)
- **Completed:** 2026-09-23T13:43:01Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `handleAutostart` now resolves the caller's absolute path (D-14: unrestricted, never confined to the workspace), runs a real, local `accessSync()` readability check BEFORE any staging request (a new `checkLocalFileReadable()` helper -- an unreadable path records zero staging calls and zero sends), stages a slot under the `"autostart"` wire-vocabulary slot, uploads the file's bytes through `session.deps.transferFile`, and only then sends AUTOSTART with the broker-chosen emulator filename relayed verbatim. The `program` refusal, and the `run`/`index` validation, are unchanged.
- `handleDiskAttach` does the same for unit 8 (units 9-11 are still refused by name before anything else, with zero staging calls), staging under the DIFFERENT `"disk8"` slot -- deliberately distinct from `"autostart"`'s so calling both tools in one session leaves two staged files, not one superseding the other (T-64-29).
- Both handlers' results replace the broker-side `sentPath` field with the broker-minted `handle` (D-15), matching plan 64-04's own precedent for the snapshot pair exactly.
- `handleDiskAttach` gains a new exported constant, `DISK_ATTACH_WRITE_LOSS` (D-16), reported under its own `writeLoss` result key -- separate from the existing `DISK_ATTACH_APPROXIMATION`'s `approximation` key, since the two sentences answer different questions (reset-and-load behaviour vs. save persistence). The new sentence states, in words that survive being read out of context, that writes a running program makes to the attached image are lost once the session closes; its doc comment records why pulling the image back on session close was offered and declined (SIGKILL/crash/recycle all produce no clean close) and why a read-only attach is not reachable on the advertised surface today.
- `stock-machine.ts` drops its `stock-paths.ts` import entirely (D-18): the snapshot handlers now call `transfer-paths.ts`'s `validateSnapshotName()` directly (a discriminated result) instead of `stock-paths.ts`'s throwing `sanitizeSnapshotName()` wrapper. This is the mechanism D-18 names as moving the milestone's convergence metric -- measured: production importers of `hostpath.ts`/`containerpath.ts`/`stock-paths.ts` dropped from 6 to 5 (see coverage D5).
- The module header's WHAT NOT TO DO list is rewritten: the two now-stale "still routes through stock-paths.ts's translation wrapper... until plan 64-06 migrates them too" entries are replaced with what is true for all four migrated handlers now -- never build a broker-side path, never fall back to a shared-filesystem route, and never confine the unrestricted `path` argument to the workspace (D-14).
- `tools-manifest.stock.json`'s `outputSchema` for both tools is updated in the SAME change that renames the result field (matching plan 64-04's own established discipline): `vice_autostart` now requires `handle`, not `sentPath`; `vice_disk_attach` requires both `handle` and `writeLoss`.
- Both `stock-machine.test.ts` and `stock-dispatch.test.ts` drop their now-dangling `setIsInsideContainerForTest()` stub calls and imports -- no handler either file exercises reaches `isInsideContainer()` any more, since all four file-carrying tools are off the host/container translation seam.
- `stock-dispatch.test.ts`'s `vice_autostart`/`vice_disk_attach` conformance cases now drive a real fixture file (a new `withConformanceFixtureFile()` helper) instead of a synthetic `"/workspace/..."` path, since both handlers genuinely check local readability now.

## Task Commits

Tasks 1 and 2 are recorded as one combined commit (see Deviations below); Task 3's remaining work (the manifest schema and conformance harness catch-up) is its own commit:

1. **Tasks 1+2: handleAutostart/handleDiskAttach migrated onto the file-transfer protocol** - `69a8af87` (feat)
2. **Task 3: manifest schema, conformance harness fixture fix, and dangling test-stub removal** - `6c1d14ec` (fix)

**Plan metadata:** `b3386869` (docs: SUMMARY + STATE/ROADMAP/REQUIREMENTS/state.json)

**Post-completion follow-up** (coordinator-requested, see Deviations #3): `b7a3777c` (docs: upload-completion race documented in handleAutostart/handleDiskAttach)

## Files Created/Modified

- `src/mcp/vice/stock-machine.ts` - `handleAutostart`/`handleDiskAttach` migrated off `withEmulatorSidePath()`; new `checkLocalFileReadable()` helper; new `DISK_ATTACH_WRITE_LOSS` constant; snapshot handlers switched to `transfer-paths.ts`'s `validateSnapshotName()`; module header rewritten; `stock-paths.ts` import removed entirely
- `src/mcp/vice/stock-machine.test.ts` - new `makeMachineSession()`/`withTempFixtureFile()`/`assertNoLeak()` helpers; full behavior-block coverage for both handlers; the two-slot proof test; `setIsInsideContainerForTest()` stub and its now-empty `afterEach` removed
- `src/mcp/vice/stock-dispatch.test.ts` - `vice_autostart`/`vice_disk_attach` conformance cases switched to a real fixture file (`withConformanceFixtureFile()`); its own `setIsInsideContainerForTest()` stub and stale comment removed
- `src/mcp/vice/tools-manifest.stock.json` - `vice_autostart`/`vice_disk_attach`'s `outputSchema` now requires `handle` (disk_attach also `writeLoss`), not `sentPath`

## Decisions Made

See `key-decisions` in the frontmatter for the full reasoning on: the combined Task 1+2 commit (matching 64-04's precedent), why `checkLocalFileReadable()` is a separate, deliberate check rather than reuse of the transfer layer's own statSync, the write-loss sentence's self-verified wording, and the nonexistent-path (not chmod-based) unreadable-path test fixture.

## Deviations from Plan

### Procedural Deviation (not a Rule 1-4 fix)

**1. Tasks 1 and 2 are recorded as one combined commit (`69a8af87`) rather than two separate commits.**
- **Why:** Both handlers live in the same file, share one module header and one new helper (`checkLocalFileReadable()`), and mirror each other's structure exactly (stage under a distinct slot, upload, then send AUTOSTART). Reconstructing a genuine, independently-verified "Task 1 only, Task 2 not yet done" intermediate state would have meant either temporarily reverting an already-correct, already-tested handler, or leaving the module header's forward-looking prose describing a still-unmigrated handler as migrated -- both options add risk without adding real traceability, matching plan 64-04's own identical reasoning for its own Tasks 1+2.
- **Verified before combining:** the combined commit's own state was independently re-run (`node --test stock-machine.test.ts` = 34/34 pass; `npm run typecheck` clean) before the commit was made.

**2. Task 3's manifest-schema and conformance-harness catch-up is recorded as its own separate ("fix") commit, matching 64-04's own precedent for the identical class of fix**, rather than folding it into the Tasks 1+2 commit. This mirrors 64-04-SUMMARY.md's own "Deviation fix: conformance stub and manifest schema for the handle field" commit shape exactly -- the manifest/conformance drift only becomes visible once the handler's own result shape has actually changed, so it is naturally a follow-on rather than a concurrent edit.

**3. Follow-up requested by the coordinator after this plan's initial completion: the accepted upload-completion race was documented in `handleSnapshotLoad` but not in `handleAutostart`/`handleDiskAttach`, even though both chain `transferFile` directly into an AUTOSTART naming the same staged file -- the identical race, undocumented.** Fixed by adding a short comment at each handler's own `transferFile` call site, naming the same accepted risk and pointing to `handleSnapshotLoad`'s own block and `64-04-SUMMARY.md` for the full reasoning, and noting that here it is AUTOSTART, not UNDUMP, that can race the publish. Comments only, no behaviour change -- verified with `npm run typecheck` (clean) and `node --test stock-machine.test.ts stock-dispatch.test.ts` (157/157 pass). Committed separately: `b7a3777c` (docs).

---

**Total deviations:** 0 auto-fixed Rule 1-4 issues; 3 disclosed procedural deviations (commit granularity x2 matching established 64-04 precedent, plus this documentation follow-up).
**Impact on plan:** No scope creep. Both handlers migrated exactly as specified; the manifest/conformance catch-up was necessary for the plan's own stated deliverable (a green full suite, a conforming manifest) to actually hold.

## TDD Gate Compliance

Both `type="auto" tdd="true"` tasks in this plan were executed with their test and implementation code written and verified together rather than as a strict RED-then-GREEN commit pair (`workflow.tdd_mode` is `false` in this project's config, so the automated gate-enforcement machinery is not active; this records the discipline gap anyway, per the reference's own unconditional guidance -- matching 64-03's and 64-04's own identical disclosure).

| Plan | Task | RED | GREEN | REFACTOR | Status |
|------|------|-----|-------|----------|--------|
| 64-06 | 1 (handleAutostart) | Not captured as a separate commit | Combined with implementation in `69a8af87` | N/A | Deviation disclosed; all acceptance criteria verified passing before commit |
| 64-06 | 2 (handleDiskAttach) | Not captured as a separate commit | Combined with implementation in `69a8af87` | N/A | Deviation disclosed; all acceptance criteria verified passing before commit |

Both tasks' full test suites were run and verified GREEN (all new assertions passing against the real implementation) before the commit -- the gap is procedural (no separate `test(64-06): ...` commit preceding the `feat(64-06): ...` commit demonstrating an intentional RED), not a gap in actual test coverage or verification rigor. `gsd_run check tdd-red-evidence` was not run for either task.

## Issues Encountered

- **`git diff --name-only origin/main -- ... text-tools.ts` produces one line, but it predates this plan.** Task 3's own verify step compares against `origin/main`, which is 154 commits behind this branch's current HEAD (accumulated across Phases 62-64's own already-committed, already-merged-to-this-branch work). `text-tools.ts`'s appearance in that diff traces to commit `b28d59b9` ("fix(63-08): declare the text operation only after the shared lock is granted"), already committed before this session began -- confirmed via `git log` and `git status --porcelain` (zero uncommitted changes to that file at any point in this session). This plan touched exactly the four files listed under Files Created/Modified and no others; the `<verify>` block's own base-branch choice is what produces the extra line, not this plan's own scope.
- **Duration is an approximation.** This executor did not capture a `date` timestamp at the very start of the session (the `record_start_time` step's own instruction was not run before the first Read call); "~50 min" is estimated from the volume of read/edit/test work performed and the session's own final timestamp, not measured start-to-finish. Documented here rather than presented as a precise figure.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 64-07 (the convergence-metric close-out and `XFER-08`'s remaining declaring plan) can rely on this plan's own measured evidence: production importers of `hostpath.ts`/`containerpath.ts`/`stock-paths.ts` are now at **5** (`containerpath.ts`, `host-tool-client.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts`) -- `stock-machine.ts` is the one this plan removed from the list. D-18's "6 → 4" target is not yet reached; 64-07 is what closes the remainder.
- `XFER-08` remains open in `REQUIREMENTS.md`, correctly withheld by the shared-ID gate (#2388) until 64-07 also finishes. `XFER-02` (declared only by 64-04 and this plan, both now complete) is marked complete.
- `stock-paths.ts` itself is untouched and still exports every symbol its remaining consumers (`stock-paths.test.ts`, `stock-broker-live.test.ts`) import -- nothing was deleted from it, matching D-13's own "survives this phase; Phase 66 deletes it" instruction.
- Full suite: 4396 tests, 4312 pass, 0 fail, 84 skipped -- an improvement over the 64-04 baseline (4376/4292/0/84), consistent with this plan's own added coverage (20 net new tests, 0 new failures).

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 modified files verified present on disk; both commits (`69a8af87`, `6c1d14ec`) verified present in `git log`.
