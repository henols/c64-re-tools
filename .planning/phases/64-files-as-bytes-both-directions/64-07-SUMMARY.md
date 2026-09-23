---
phase: 64-files-as-bytes-both-directions
plan: 07
subsystem: transport
tags: [integration-test, disjoint-roots, convergence-metric, evidence, live-test]

requires:
  - phase: 64-files-as-bytes-both-directions (plan 01)
    provides: "transfer-hash.mts/broker-transfer.mts/transfer-paths.ts foundation"
  - phase: 64-files-as-bytes-both-directions (plan 02)
    provides: "broker-control.mts stage_file/transfer ops, dialFileTransfer(), stock-connect.ts seams"
  - phase: 64-files-as-bytes-both-directions (plan 03)
    provides: "the real broker's own staging model, wired into vice-broker.mts"
  - phase: 64-files-as-bytes-both-directions (plan 04)
    provides: "handleSnapshotSave/handleSnapshotLoad migrated onto the file-transfer protocol"
  - phase: 64-files-as-bytes-both-directions (plan 06)
    provides: "handleAutostart/handleDiskAttach migrated onto the file-transfer protocol; stock-machine.ts drops stock-paths.ts entirely"
provides:
  - "transfer-disjoint-roots.test.ts: all four migrated tools proven end to end across two disjoint filesystem roots, with a recursive no-broker-path-leak scanner proven to catch a planted violation"
  - "64-convergence-metric.md: the measured before/after importer count (6 -> 5), the roadmap's predicted gap (4) named for Phase 66, and D-17/D-18's own limits recorded verbatim"
  - "64-boundary-confirmations.md: every boundary this phase declared, confirmed by a check rather than assumed"
  - "A new todo (2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md) and a WINDOWS.md unrun-verify entry, from a live-test discovery outside this plan's own scope"
affects: [65, 66]

actuals:
  tokens: 16884
  tasks: 3
  commits: 4
  plan_head_before: ce6f71db28ceb17be8597cce530218b9f6d96a43

tech-stack:
  added: []
  patterns:
    - "Compose, don't re-derive: the disjoint-roots test composes vice-broker-staging.test.ts's real-listener/real-staging fixture with stock-machine.test.ts's DI-stub session pattern, rather than building a third fixture."
    - "Recursive leak scanner, proven before trusted: collectStringLeaves()/assertNoPrefixLeak() walks every key and every nested value of a result object; a dedicated test plants a violation three levels deep in an unexpected key and confirms the scanner catches it, then confirms it passes once the plant is removed."
    - "Measure, don't assert: the convergence metric is a grep command recorded with its exact invocation and full module list, per D-18 -- never a test asserting on an import count, which this project's locked rule (260914-poo D-1) bans."

key-files:
  created:
    - src/mcp/vice/transfer-disjoint-roots.test.ts
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md
    - .planning/phases/64-files-as-bytes-both-directions/evidence/64-boundary-confirmations.md
    - .planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md
  modified:
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/text-connect.test.ts
    - .planning/WINDOWS.md

key-decisions:
  - "D-05's slot-supersession behavior (a staged upload keyed by (grant, slot) is superseded on reuse) was discovered live inside this plan's own test, not merely assumed from the decision record: the snapshot save/load pair shares the \"snapshot\" slot by design, so the load's own stage_file call deletes the save's own staged file before UNDUMP ever runs. The test asserts this explicitly (existence right after save, non-existence right after load) rather than asserting all four staged files coexist to the end of the session, which would have been a false claim about the protocol's own behavior."
  - "The plan's own <human-check> item 1 (real broker, real /usr/bin/x64sc, all four tools) was attempted live rather than deferred, and hit a genuine, pre-existing, out-of-scope defect: vice-proxy.ts's dispatchStockFor() never wires the broker's per-boot control_token into StockDispatchDeps, so a REAL MCP-to-broker relay handshake fails before any tool-specific logic runs. This is recorded as a new todo and a WINDOWS.md unrun-verify entry, not fixed here -- vice-proxy.ts/stock-dispatch.ts/stock-connect.ts are not in this plan's own files_modified, and the fix's own scope (whether it's a one-line thread-through or a broader question about exposing a raw token beside an already-authenticated session object) needs its own deliberate decision."
  - "The convergence metric's measured value (5) is recorded honestly against the roadmap's predicted value (4), per the planner's own advance finding -- the gap is named for Phase 66 to reconcile, not forced closed by inventing extra work outside this plan's declared scope."

requirements-completed: [XFER-01, XFER-05, XFER-08]

coverage:
  - id: D1
    description: "All four file-carrying tools (vice_autostart, vice_disk_attach, vice_snapshot_save, vice_snapshot_load) complete end to end in one session against a client root and a broker root under two disjoint mkdtempSync directories, with no broker-side path in any of the four results"
    requirement: XFER-08
    verification:
      - kind: integration
        ref: "transfer-disjoint-roots.test.ts#transfer-disjoint-roots: all four tools complete against a client and a broker that cannot see each other's filesystems, with no broker-side path in any result and nothing left in staging when the session ends"
        status: pass
    human_judgment: false
  - id: D2
    description: "The recursive no-leak scanner is proven to catch a planted violation in an unexpected, nested key before being trusted against a real handler result -- not merely present, but demonstrated load-bearing"
    verification:
      - kind: unit
        ref: "transfer-disjoint-roots.test.ts#transfer-disjoint-roots: the leak scanner is proven to catch a violation in a key nobody anticipated, before it is trusted against a real result"
        status: pass
    human_judgment: false
  - id: D3
    description: "A save-then-load round trip carries a payload of at least 65536 bytes spanning every value 0x00-0xFF, byte for byte, through the full four-tool path"
    requirement: XFER-05
    verification:
      - kind: integration
        ref: "transfer-disjoint-roots.test.ts's own snapshotPayload assertion inside the combined test case (fullByteRangeBuffer(), 76800 bytes, asserted byte-equal after save's download and again inside the load's own UNDUMP responder)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The convergence metric is measured (not asserted) and recorded with its exact reproducible command and full module list, before and after this phase, with the roadmap's own predicted gap named honestly rather than closed by inventing work"
    verification:
      - kind: other
        ref: "64-convergence-metric.md: grep -aln '...' *.ts *.mts | grep -v '\\.test\\.' -- measured count 5 (down from 6), stock-machine.ts confirmed dropped, roadmap's predicted 4 named as Phase 66's gap"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every boundary this phase declared (non-file-carrying tools, host_tool's prohibition, stock-paths.ts's survival, the legacy string framers, the orphaned chunking todo, the inert text-channel timeout) is confirmed by a check rather than assumed"
    verification:
      - kind: other
        ref: "64-boundary-confirmations.md -- six sections, each naming the command or file read and its result; one correction recorded honestly (the chunking todo's own 'four still-failing tests' framing is stale, fixed in Phase 55 before this phase began)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The plan's own <human-check> item 1 (real broker, real emulator, all four tools) was attempted live against a genuine stock /usr/bin/x64sc"
    verification: []
    human_judgment: true
    rationale: "Confirmed: a real systemd-run broker started correctly, bound the real /usr/bin/x64sc, and a real vice-proxy.ts session completed initialize + acquire against it. Every subsequent tool call then failed identically at the relay handshake, traced precisely to vice-proxy.ts's dispatchStockFor() never forwarding the broker's control_token into StockDispatchDeps -- a genuine, pre-existing, out-of-scope defect (see Deviations and the new todo), not a defect in this phase's own migrated protocol. The human-check therefore did NOT reach a successful tool call; recorded honestly as attempted-but-blocked rather than claimed passing. A human/future plan must independently confirm whether this reproduces against an unmodified real Claude Code session and decide the fix's own scope."
  - id: D7
    description: "The plan's own <human-check> item 2 (disk write-loss wording, read by a human, after a real attach-write-close cycle)"
    verification: []
    human_judgment: true
    rationale: "Blocked by the SAME defect as D6 -- no real attach-write-close cycle could be driven through vice-proxy.ts's own MCP surface in this session. The wording itself (DISK_ATTACH_WRITE_LOSS) was already read in isolation and confirmed self-standing by 64-06's own executor (64-06-SUMMARY.md's D2 coverage entry); this plan adds no new confirmation of that wording, only the finding that the live attach-write-close cycle could not be exercised."

duration: 105min
completed: 2026-09-23
status: complete
---

# Phase 64 Plan 7: The Disjoint-Roots Proof, the Convergence Metric, and the Boundaries Confirmed Summary

**One integration test drives all four migrated file-carrying tools across two filesystem roots that cannot see each other, proving XFER-01/XFER-05/XFER-08 with a recursive leak-scanner proven load-bearing; two evidence documents measure the convergence metric (6 -> 5, not yet the roadmap's predicted 4) and confirm every boundary this phase declared; and a live-emulator attempt surfaced a genuine, pre-existing, out-of-scope defect in vice-proxy.ts's own control-token wiring.**

## Performance

- **Duration:** 105 min
- **Tasks:** 3
- **Files created:** 4 (1 test file, 2 evidence documents, 1 todo)
- **Files modified:** 3 (2 test-file allow-list fixes, WINDOWS.md)

## Accomplishments

- `transfer-disjoint-roots.test.ts`: composes vice-broker-staging.test.ts's real control listener / real staging fixture with stock-machine.test.ts's DI-stub session pattern to drive `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save` and `vice_snapshot_load` in ONE session, against a client root and a broker root under two disjoint `mkdtempSync` directories. Every result is recursively scanned (every key, every nested value) for the broker's own root prefix -- proven to actually catch a planted violation three levels deep in an unexpected key, before being trusted against the four real results. The save/load pair round-trips a 76800-byte payload spanning every value 0x00..0xFF, byte for byte. Discovers and asserts D-05's own slot-supersession behavior live: the snapshot pair's shared "snapshot" slot means the load's own stage call deletes the save's staged file, which the test confirms explicitly rather than assuming all four staged files coexist to the session's end.
- `64-convergence-metric.md`: the exact, reproducible grep command; the six-importer "before" list from `STATE.md`; the five-importer "after" list measured directly (`containerpath.ts`, `host-tool-client.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts` -- `stock-machine.ts` confirmed dropped); the roadmap's predicted value of 4 named honestly against the measured 5, as Phase 66's gap to reconcile rather than manufactured work; D-18's accepted cost and D-17's guarantee-and-limit recorded verbatim; the wire-field narrowing from this plan's own `planner_findings`.
- `64-boundary-confirmations.md`: six boundaries confirmed by direct check -- `vice_symbols_load`/`vice_program_load` untouched (with the same stale-`origin/main`-baseline correction 64-06 already documented for `text-tools.ts`), `host_tool`'s byte-payload prohibition unchanged at the same lines D-19 cites, `stock-paths.ts` intact with its relocated-vs-reexported exports traced precisely, the two legacy UTF-8 string framers confirmed unconverted and NOT an inherited Phase 66 obligation, the orphaned result-chunking todo's three named constraints all held (plus an honest correction: its own "four still-failing tests" claim is stale -- the regression was fixed in Phase 55, before Phase 64 even opened, confirmed by running the four tests directly and by `git log -L` on the restoring commit), and the inert text-channel timeout untouched.
- A live-emulator attempt (real systemd-run broker, absolute `/usr/bin/x64sc`) proved the fixed-endpoint infrastructure works up through `acquire` (a real grant for a real emulator instance), then discovered a genuine, pre-existing gap: `vice-proxy.ts`'s `dispatchStockFor()` never forwards the broker's per-boot `control_token` into `StockDispatchDeps`, so every subsequent relay-gated operation fails. Recorded as a new todo and a `WINDOWS.md` `unrun-verify` entry rather than fixed (out of this plan's own scope) -- see Deviations below.

## Task Commits

Each task was committed atomically, plus one deviation-fix commit discovered during Task 3's own full-suite verification:

1. **Task 1: All four tools, two roots that cannot see each other** - `2142d738` (test)
2. **Task 2: Measure the convergence metric and write down what the proof is worth** - `c3220c08` (docs)
3. **Deviation fix: allow-list transfer-disjoint-roots.test.ts in the monitorClients census guard** - `0c0e2a92` (fix; bundled with `64-boundary-confirmations.md`, which was already staged -- see Deviations)
4. **Task 3: Confirm the boundaries this phase deliberately did not cross** - `0974c2d4` (docs; the WINDOWS.md entry and new todo from the live-test finding)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `src/mcp/vice/transfer-disjoint-roots.test.ts` - the disjoint-roots integration test, all four tools, one session
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-convergence-metric.md` - the measured convergence metric, before/after, with the roadmap gap named
- `.planning/phases/64-files-as-bytes-both-directions/evidence/64-boundary-confirmations.md` - six confirmed boundaries, one correction disclosed
- `.planning/todos/pending/2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md` - the live-test finding, precisely traced
- `.planning/WINDOWS.md` - one new `unrun-verify` entry for the blocked human-check
- `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts` - allow-list `transfer-disjoint-roots.test.ts` in the `monitorClients` halting-path census guard (deviation, see below)

## Decisions Made

See `key-decisions` in the frontmatter for the full reasoning on: the D-05 slot-supersession discovery, the live-test defect finding (attempted rather than deferred, discovered rather than papered over), and the honest convergence-metric gap recording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Allow-listed `transfer-disjoint-roots.test.ts` in the `monitorClients` halting-path census guard**
- **Found during:** Task 3's own full-suite verification
- **Issue:** `broker-control.test.ts` and `text-connect.test.ts` each carry a structural test enumerating every tracked file and refusing any NEW file (outside an explicit allow-list) that references the `monitorClients` identifier. `transfer-disjoint-roots.test.ts`'s own `makeGrantedInstance()` fixture constructs a raw `InstanceRecord` literal with `monitorClients: {}` -- the same non-optional field every other allowed `*.test.ts` fixture in this codebase already satisfies -- tripping both copies of the guard.
- **Fix:** Added `"transfer-disjoint-roots.test.ts"` to both allow-lists, matching the exact convention every prior phase-64 plan (64-03, 64-04, 64-06) already used for this identical class of fix.
- **Files modified:** `src/mcp/vice/broker-control.test.ts`, `src/mcp/vice/text-connect.test.ts`
- **Verification:** Both structural tests re-run green; full suite re-run 4398 tests / 4314 pass / 0 fail / 84 skipped.
- **Committed in:** `0c0e2a92` (deviation fix commit)

### Procedural Deviation (not a Rule 1-4 fix)

**2. The deviation-fix commit (`0c0e2a92`) unintentionally bundled `64-boundary-confirmations.md`** (Task 3's own evidence document, already `git add`ed at the time the fix commit was made) alongside the two allow-list files. The commit message names only the allow-list fix. This is a commit-message/content mismatch, not a content error -- `64-boundary-confirmations.md`'s own content is correct and unaffected; its presence in that commit rather than the following Task 3 commit is cosmetic. Disclosed here rather than silently left unremarked, matching this phase's own established convention of disclosing commit-granularity deviations (64-04, 64-06) rather than treating them as invisible.

**3. The plan's own `<human-check>` item 1 was attempted live rather than deferred to end-of-phase, per the plan's explicit "Run them and record the outcome in the phase SUMMARY" instruction, and did NOT reach a successful tool call.** A real systemd user unit was created for this session only (`vice-broker-64-07-live-test.service`, later stopped, disabled and removed -- no residue), pointed at the absolute `/usr/bin/x64sc`, with a fresh, disposable `VICE_BROKER_HOME`. The broker started correctly and bound the real emulator. A real `vice-proxy.ts` process over stdio completed `initialize` and a real `acquire` (a genuine grant for a genuine emulator instance) -- proving the fixed-endpoint acquire layer works end to end against a real emulator. Every one of the four tool calls then failed identically with `"stock handshake failed (vice: missing or invalid control token)"`, traced precisely to `vice-proxy.ts`'s `dispatchStockFor()` never forwarding the broker's `control_token` into `StockDispatchDeps` (confirmed: `grep -n "controlToken" vice-proxy.ts` returns zero hits, while `stock-dispatch.ts`'s own `stockConnectDepsFor()` explicitly forwards `deps.controlToken` when present). This is a genuine, pre-existing gap unrelated to Phase 64's own protocol work -- every one of this phase's own tests proves the stage/transfer protocol correct when a caller supplies a valid token, which is exactly what production code at this one entry point currently does not do. Recorded as a new todo (`2026-09-23-vice-proxy-never-wires-the-control-token-into-stockdispatchdeps.md`) and a `WINDOWS.md` `unrun-verify` entry, NOT fixed here -- `vice-proxy.ts`, `stock-dispatch.ts` and `stock-connect.ts` are not in this plan's own `files_modified`, and the correct fix scope is a decision for whoever owns that wiring, not a silent one-line patch inside a plan whose own deliverable is elsewhere. Full teardown confirmed: no leftover `x64sc`/`vice-cli`/broker process, no leftover systemd unit, no leftover `/tmp` scratch beyond what this executor's own killed-and-restarted debugging left (also cleaned up).

**4. The plan's own `<human-check>` item 2 (disk write-loss wording, read after a real attach-write-close cycle) could not be completed for the SAME reason as item 3** -- no real attach-write-close cycle could be driven through `vice-proxy.ts`'s own MCP surface in this session. `DISK_ATTACH_WRITE_LOSS`'s own wording was already read in isolation and confirmed self-standing by 64-06's own executor (`64-06-SUMMARY.md`'s D2 coverage entry); this plan adds no new confirmation, only the finding that the live cycle itself is currently blocked by deviation 3's own defect.

---

**Total deviations:** 1 auto-fixed (Rule 3 -- a blocking structural-guard failure, matching established precedent exactly), 3 disclosed procedural/discovery deviations (a commit-content mismatch, and two blocked human-check items with a precisely-traced root cause).
**Impact on plan:** The auto-fix was necessary for a green full suite. The two blocked human-checks do NOT reflect a defect in this phase's own deliverable -- every one of this plan's own automated assertions (the disjoint-roots test, the byte-for-byte round trip, the recursive leak scanner) passed cleanly. The blocked checks reflect an out-of-scope, pre-existing wiring gap this plan's own live-testing effort is what surfaced it in the first place, and it is now on record rather than silently absent.

## Issues Encountered

- An early draft of the disjoint-roots test asserted all four staged files coexist under B at the very end of the session, which failed: D-05's own slot-supersession rule means the load's own stage call (sharing the "snapshot" slot with save) deletes the save's staged file before the assertion ran. Root-caused directly (not guessed), and the test was corrected to assert the save's staged file's existence immediately after save completes, and its absence immediately after load completes -- a stronger, more accurate proof than the original (incorrect) assumption would have been.
- The live-emulator attempt required iterating through three distinct env-var mismatches (client-vs-broker `VICE_BROKER_HOME` resolution, then a `VICE_POOL_DIR` alignment) before reaching the genuine control-token defect described in Deviation 3 above -- documented in full in this executor's own working notes, condensed here to the final, precisely-traced root cause.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Phase 65 (`SEAM-03`, `host_tool`) inherits: `host-tool.mts`'s byte-payload prohibition's first clause survives the whole milestone unmodified; its second clause (`{ path, sha256, byteLength }`) is Phase 65's own to amend in the same change that replaces `path` with a handle.
- Phase 66 (`RM-01`/`RM-02`) inherits: `stock-paths.ts` still exists, still exports its full surface, ready for deletion; the convergence metric stands at **5**, not the roadmap's predicted **4** -- the gap (this phase drops exactly one importer, `stock-machine.ts`) is Phase 66's to reconcile, not this plan's to have forced closed; the two legacy UTF-8 string framers in `vice-broker-client.ts` are explicitly NOT an inherited conversion obligation.
- A new, precisely-traced, pre-existing defect is now on record for whoever owns `vice-proxy.ts`'s deps-construction: `dispatchStockFor()` never wires `control_token` into `StockDispatchDeps`, blocking any real MCP-surface tool call against a Phase-62+-model broker. This is independent of Phase 64's own deliverable and does not block this phase's own completion, but it is a live, reproducible, unaddressed gap a future plan (or a direct human confirmation against a real Claude Code session) should resolve before relying on the full stack end to end.
- All four file-carrying tools' migration (`XFER-01`, `XFER-02`, `XFER-05`, `XFER-08`) is now complete and proven, both by direct handler-level tests (plans 64-04/64-06) and by this plan's own cross-tool, disjoint-roots, single-session proof.
- Full suite: 4398 tests, 4314 pass, 0 fail, 84 skipped -- an improvement over the 64-06 baseline (4396/4312/0/84), consistent with this plan's own two new tests, 0 new failures.

---
*Phase: 64-files-as-bytes-both-directions*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 created files verified present on disk (`transfer-disjoint-roots.test.ts`, `64-convergence-metric.md`,
`64-boundary-confirmations.md`, the new todo); all 4 commits (`2142d738`, `c3220c08`, `0c0e2a92`, `0974c2d4`)
verified present in `git log`; `git log --oneline --all --grep="64-07"` returns all four.
