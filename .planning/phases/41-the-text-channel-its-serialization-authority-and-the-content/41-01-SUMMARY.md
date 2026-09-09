---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 01
subsystem: protocol
tags: [vice, text-monitor, remotemonitor, tcp-framing, broker, stock-backend]

requires:
  - phase: 39-the-dual-channel-coexistence-gate-go-degrade-no-go
    provides: "the go verdict (rule R15) selecting an in-process async mutex as this phase's serialization shape, and the fixtures/textmon/ capture batch this plan's cap-derivation and encoding tests are sized against"
provides:
  - "remoteMonitorPort travels grant -> control-plane wire -> HeldLease, key-omitted-when-absent throughout (D-15)"
  - "text-protocol.ts: TextMonitorClient, the ONE place the text wire's bytes are framed, with a closed command allowlist (D-01), a quiescence window, a passive banner drain (D-13(b)), and an accumulation cap"
  - "text-connect.ts: textConnect()/textDisconnect(), the claim-before-dial session lifecycle for the text channel, reusing stock-connect.ts's StockConnectBrokerControl interface"
  - "text-monitor-live.test.ts: the phase's one live end-to-end proof, registered in the two-directional manual-only gate (13 entries)"
affects: [41-02, 41-03, 41-04, 41-05, 41-06, 42]

actuals:
  tokens: 26000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single-seam text-wire framing client (text-protocol.ts) mirroring stock-protocol.ts's ViceMonitorClient shape, deliberately dropping its request-id multiplexing fields since the text protocol carries one command at a time"
    - "Claim-before-dial session lifecycle (text-connect.ts) reusing stock-connect.ts's StockConnectBrokerControl interface rather than a parallel one"
    - "Quiescence-window tail-match framing: a PROMPT_RE match is accepted as final only after no further bytes arrive within TEXT_QUIESCENCE_MS"
    - "Key-omitted-when-undefined idiom for an additive, backend-conditional wire field (remoteMonitorPort), matching spawnAndRecordInstance()'s own existing convention"

key-files:
  created:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-connect.ts
    - src/mcp/vice/text-protocol.test.ts
    - src/mcp/vice/text-connect.test.ts
    - src/mcp/vice/text-monitor-live.test.ts
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/test-gate.mjs
    - src/mcp/vice/test-gate.test.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/docs-linerefs.test.ts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-control.mjs
    - CLAUDE.md
    - .planning/PROJECT.md

key-decisions:
  - "Pulled the quiescence-window mechanism forward from Task 2 into Task 1 (Rule 1 auto-fix): the tracer's own live <verify> measurably failed without it -- see Deviations."
  - "Both planted controls (CHAN-03's own criterion text) are proven as live A/B demonstrations on the shipped TextMonitorClient class -- Control 1 via a same-file negative per-chunk-decode comparison, Control 2 via constructing the real class with quiescenceMs:0 (RED) versus its default TEXT_QUIESCENCE_MS (GREEN) -- rather than via git-archaeology against a since-superseded commit."
  - "TEXT_MAX_BUFFERED_LEN set to 4 MiB, re-derived from the largest real fixture (~1.62 MiB, access-map-stock.txt) with generous headroom; asserted in text-protocol.test.ts to be strictly greater than whatever the largest fixture on disk measures at test time."
  - "command()'s CR/LF/C0-control-character check runs BEFORE the allowlist-membership check (reordered from the initial draft) so the character-refusal path is independently reachable and testable, not permanently shadowed by the allowlist check for every real-world input."

requirements-completed: [CHAN-02, CHAN-03]

coverage:
  - id: D1
    description: "A container-side caller holding a stock lease can read its instance's text-monitor port off HeldLease.remoteMonitorPort (CHAN-02)"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "vice-broker-client.test.ts#acquire result: the grant object has exactly the key set containerizeGrant() reads"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts#text-monitor-live: a stock grant carries remote_monitor_port, textConnect() dials it, and one real device c: command returns its complete prompt-framed response"
        status: pass
    human_judgment: false
  - id: D2
    description: "One real text-monitor command issued through textConnect() + TextMonitorClient.command() returns its complete response against genuine stock VICE 3.9, framed by the prompt, never a timeout (CHAN-03)"
    requirement: "CHAN-03"
    verification:
      - kind: e2e
        ref: "text-monitor-live.test.ts#text-monitor-live: a stock grant carries remote_monitor_port, textConnect() dials it, and one real device c: command returns its complete prompt-framed response"
        status: pass
      - kind: e2e
        ref: "text-monitor-live.test.ts#text-monitor-live (Task 2): memmapshow's ~1.6MB output arrives across more than one TCP segment and is returned complete"
        status: pass
    human_judgment: false
  - id: D3
    description: "Framing survives a split prompt, prompt-shaped data mid-stream, a passively-arriving banner, an empty response, a split multi-byte sequence, and an over-cap response -- each proven by a test, the first two observed red first"
    requirement: "CHAN-03"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#Control 1: a prompt split across two socket chunks (even byte-at-a-time) yields exactly one complete response"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#Control 1 (negative control): a per-chunk decode-and-match design fails on the exact same split"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#Control 2 (planted RED, without the fix): a quiescence window of 0ms accepts prompt-shaped mid-stream text as final, losing the real output"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#Control 2 (fixed, GREEN): the default quiescence window survives prompt-shaped mid-stream text and returns the complete response with the mid-stream occurrence preserved"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#D-13(b): a passively-arriving banner with no command outstanding is drained, counted, and never resolves a later command"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#a command whose entire response is just the prompt resolves with an empty payload, prompt consumed, never a hang"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#a split three-byte UTF-8 sequence (U+202F) across two chunks decodes to one character, no replacement character"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#exceeding TEXT_MAX_BUFFERED_LEN with no prompt in sight refuses with TextFramingError naming the byte count and the outstanding command"
        status: pass
    human_judgment: false
  - id: D4
    description: "StatusInstanceEntry and vice.ts's ActiveInstance are both unchanged"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#the client module's export list is exactly the surviving surface"
        status: pass
      - kind: other
        ref: "git diff --name-only HEAD~2 HEAD | grep vice.ts -- zero hits"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-09
status: complete
---

# Phase 41 Plan 01: The Text Channel, Its Serialization Authority, and the Contention Verdict Summary

**Opened the `-remotemonitor` text channel end to end for the first time in this project's history -- a stock grant now carries its text-monitor port to the container, `textConnect()` claims and dials it, and `TextMonitorClient` frames one real `device c:`/`memmapshow` round trip against genuine stock VICE 3.9, surviving a split prompt, prompt-shaped text mid-stream, a passive banner, and an over-cap response.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 12

## Accomplishments

- `remoteMonitorPort` now travels the full path from the host broker's `InstanceRecord` through the control-plane wire (`remote_monitor_port`) to the container's `HeldLease`, key-omitted-when-absent at every hop, with `StatusInstanceEntry` and `vice.ts`'s fork-shared transport seam both left untouched (D-15).
- `text-protocol.ts` ships `TextMonitorClient`: the ONE place the text wire's bytes are framed, a closed `TEXT_COMMAND_ALLOWLIST` of eight verbs (D-01/D-02), a quiescence window that survives prompt-shaped text mid-stream, a passive banner drain for bytes arriving with no command outstanding (D-13(b)), and an accumulation cap (`TEXT_MAX_BUFFERED_LEN`) refusing an over-cap response by name rather than truncating it.
- `text-connect.ts` ships `textConnect()`/`textDisconnect()`: the claim-before-dial session lifecycle for the text channel, reusing `stock-connect.ts`'s `StockConnectBrokerControl` interface rather than declaring a parallel one, and deliberately building no `textReconnect()` (an unexpected close is fatal for the session, per RESEARCH Open Question 2).
- `text-monitor-live.test.ts` is the phase's one live end-to-end proof: a real broker daemon, a real genuine-stock `x64sc`, one `device c:` round trip and one `memmapshow` multi-chunk round trip, both measured and passing. Registered in `test-gate.mjs`'s `MANUAL_ONLY_TESTS` (now 13 entries) and `test-gate.test.ts`'s pinning assertion, in the same commit as Task 1.
- `text-protocol.test.ts` and `text-connect.test.ts` cover the full framing state machine and the claim/connect/release lifecycle deterministically, with no emulator involved -- 42 tests, all passing.

## Task Commits

1. **Task 1: End-to-end "one text-monitor command" -- one path only** - `fad65de8` (feat)
2. **Task 2: Harden the framing -- the two planted controls, the banner drain, and the cap** - `bf6d886c` (test)

**Plan metadata:** committed separately (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md), see `docs(41-01)` commit following this file.

## Files Created/Modified

- `src/mcp/vice/text-protocol.ts` - `TextMonitorClient`, `PROMPT_RE`, `TEXT_COMMAND_ALLOWLIST`, `isAllowlistedTextCommand`, `TextFramingError`, `TEXT_MAX_BUFFERED_LEN`, `TEXT_QUIESCENCE_MS`
- `src/mcp/vice/text-connect.ts` - `textConnect()`, `textDisconnect()`, `TextConnectSession`
- `src/mcp/vice/text-protocol.test.ts` - framing state-machine unit tests, both planted controls
- `src/mcp/vice/text-connect.test.ts` - claim/connect/release lifecycle unit tests
- `src/mcp/vice/text-monitor-live.test.ts` - the phase's one live end-to-end proof
- `src/mcp/vice/broker-control.mts` - `AcquireGrant.remoteMonitorPort`, `ControlResponse`'s `grant` member gains `remote_monitor_port`, `attemptAcquire()`'s `writeLine` emits it when defined
- `src/mcp/vice/vice-broker.mts` - `handleAcquire()`'s success grant gains `remoteMonitorPort` (key-omitted-when-undefined)
- `src/mcp/vice/vice-broker-client.ts` - wire-side `AcquireGrant.remote_monitor_port`, `HeldLease.remoteMonitorPort` (doc comment: mandatory on a stock grant, absent on a fork grant), both `AcquireGrant` construction sites validate the wire value through a shared `parseOptionalRemoteMonitorPort()`
- `src/mcp/vice/vice-proxy.ts` - module-level `grantRemoteMonitorPort`, validated and stashed in `adoptGrant()`, read fresh by `buildHeldLease()`; `vice.ts` untouched
- `src/mcp/vice/test-gate.mjs`, `src/mcp/vice/test-gate.test.ts` - `text-monitor-live.test.ts` registered as the 13th manual-only entry, in both directions
- `src/mcp/vice/package.json` - `text-protocol.ts`/`text-connect.ts` added to `files[]`
- `src/mcp/vice/docs-linerefs.test.ts` - the hardcoded function-start citation pin (`[1505, 2991]` -> `[1505, 3035]`) updated for this commit's own line-number drift
- `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/resources/broker-control.mjs` - regenerated via `npm run build`
- `CLAUDE.md`, `.planning/PROJECT.md` - the `rewriteArguments()`/`forwardToVice()` line-citation bullet corrected for this commit's own drift (`:3056`/`:2991` -> `:3100`/`:3035`, a +44 shift from the new `grantRemoteMonitorPort` plumbing landing above `forwardToVice()`), with the drift history appended per the project's own standing discipline

## Decisions Made

- **Reused `stock-connect.ts`'s `StockConnectBrokerControl` interface verbatim** in `text-connect.ts` rather than declaring a parallel claim interface -- the same narrow structural shape, extendable later with an optional `channel` field (plan 41-03) without a second interface to keep in sync.
- **No `textReconnect()`** -- an unexpected text-socket close is treated as fatal for the session (RESEARCH Open Question 2), matching D-13's "held for the session's lifetime" framing rather than silently reconnecting and papering over what happened on the channel while it was down.
- **TEXT_MAX_BUFFERED_LEN = 4 MiB**, re-derived from the largest real fixture (`access-map-stock.txt`, ~1.62 MiB) with generous headroom, and asserted in-test to be strictly greater than whatever the largest fixture on disk measures at test time -- never a value that can silently drift below real observed output.
- **command()'s control-character check runs before the allowlist-membership check** (reordered from the initial draft after the first test run showed the character-refusal path was otherwise permanently unreachable through the public API, since every allowlist entry is already clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The tracer's own live verify failed on the naive happy-path design; fixed by pulling the quiescence window forward from Task 2**
- **Found during:** Task 1, the mandatory live `<verify>` run (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts`)
- **Issue:** The plan's own Task 1 scope was "the happy path only... resolve on the first tail match against PROMPT_RE," deferring the quiescence window to Task 2. Running the live test against genuine stock VICE showed this design genuinely fails: a fresh connection's very FIRST command reply can arrive as TWO separate TCP chunks -- a residual leading prompt (`(C:$xxxx) `) with no command output attached yet, then the real output -- and a resolve-on-first-tail-match design mistakes the first chunk alone for a complete, empty response. MEASURED failure text: `AssertionError [ERR_ASSERTION]: device c: response must be non-empty, got: ""`. Reproduced deterministically across repeated runs (not a fluke): a manual byte-level probe against the same running VICE binary confirmed the split -- `chunk 1: "(C:$e5d1) "`, `chunk 2: "Setting default device to \`Computer'\n(C:$e5d1) "` -- with the residual leading prompt arriving as its own isolated write.
- **Fix:** Implemented the quiescence-window mechanism (a `PROMPT_RE` tail match is accepted as final only after `TEXT_QUIESCENCE_MS` elapses with no further bytes) directly in Task 1's own commit, rather than deferring it to Task 2. The mechanism is exactly what Task 2's own criterion (Control 2: "prompt-shaped output mid-stream") already required -- this discovery showed it occurring naturally on the plain happy path, not merely as a planted control.
- **Files modified:** `src/mcp/vice/text-protocol.ts`
- **Verification:** Re-ran `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` after the fix -- passed, with the measured response `"(C:$fd75) (C:$fd75) Setting default device to \`Computer'\n"` (the leading residual prompt preserved in the payload, only the true trailing prompt stripped).
- **Committed in:** `fad65de8` (Task 1 commit)

**2. [Rule 3 - Blocking] `docs-linerefs.test.ts`'s mechanical line-citation gate reddened from this plan's own edits to `vice-proxy.ts`**
- **Found during:** Task 1's own `<verify>` (`npm run test:automated`)
- **Issue:** Adding the `grantRemoteMonitorPort` module variable, its validation in `adoptGrant()`, and its stashing in `buildHeldLease()` inserted ~44 lines above `forwardToVice()` in `vice-proxy.ts`, moving that function (and the `rewriteArguments()` call inside it) from `:2991`/`:3056` to `:3035`/`:3100`. `CLAUDE.md`'s own Architecture bullet and its duplicate in `.planning/PROJECT.md` cite the stale line numbers, and `docs-linerefs.test.ts` mechanically checks both documents plus its own hardcoded function-start positive control (`[1505, 2991]`).
- **Fix:** Updated both documents' citations to `:3100`/`:3035`, appending the drift history in the same register the bullet already uses for two prior phases' drifts, and updated `docs-linerefs.test.ts`'s hardcoded pin to `[1505, 3035]`.
- **Files modified:** `CLAUDE.md`, `.planning/PROJECT.md`, `src/mcp/vice/docs-linerefs.test.ts`
- **Verification:** `node --test docs-linerefs.test.ts` -- 13/13 pass.
- **Committed in:** `fad65de8` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug essential to the tracer's own acceptance criterion, 1 blocking documentation-drift fix required by an existing mechanical gate). **Impact on plan:** Both were necessary for this plan's own stated verification to pass; neither expanded scope beyond what CHAN-02/CHAN-03 already required.

## Issues Encountered

- **Full-suite `npm run test:automated` is measured at 2-4 failing tests, not always exactly 2.** The documented baseline is 2 failures, both in `anno-register.test.ts` (`DIRECTION 5` and `planted violation (the negative control)`), confirmed by running that file in isolation. Three separate full-suite runs during this plan's own verification showed 2, 3, and 4 failures respectively, with the EXTRA failure differing each time (`check-skill-fork-honesty`'s root-spelling equivalence test once, a third `anno-register.test.ts` case another time) and passing cleanly when re-run in isolation. This matches this project's own documented "test suite races on repo-tree scratch files" characterization (an intermittent extra-fail run from concurrent test files touching shared working-tree state, not a regression) -- none of the extra failures are caused by this plan's own changes, and none touch a file this plan modified.
- A stray, orphaned `x64sc` process (unrelated to this session, pre-existing per the environment notes) was holding `127.0.0.1:6600`/`:6601` for the duration of this plan's work. It did not block any live test: the broker's own port allocator (`nextFreePort()`) allocates the lowest FREE port at or above the base, so every cold-launched instance in this plan's live runs used higher, unaffected ports. No broker daemon was ever running concurrently with a live test in this plan (confirmed via `pgrep -fa vice-broker` before each live run), so the `BACK-05` ordering hazard this precondition guards against was never actually in play.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CHAN-02` and `CHAN-03` are both closed by this plan. `remoteMonitorPort`/`HeldLease` and `text-protocol.ts`/`text-connect.ts` are the load-bearing seams plans 41-02 through 41-06 build on.
- `channel-lock.ts` (plan 41-02, `CHAN-04`) can now import `TEXT_COMMAND_ALLOWLIST`/`isAllowlistedTextCommand` and the `TextMonitorClient` shape if needed, and has a real text session to serialize against.
- The `channel: "text"` discriminator on `monitor_claim`/`monitor_release` (D-14, plan 41-03) is NOT yet wired -- `textConnect()` claims through the existing, undiscriminated `claimMonitor({ targetId })` today, which is broker-state-compatible but does not yet enforce one-text-client-per-instance as its own concern. Plan 41-03 must extend `ClaimMonitorOptions`/`ReleaseMonitorOptions` with the optional `channel` field this plan's `text-connect.ts` header comment already anticipates.
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All 5 created files confirmed present on disk via `[ -f ]`.
- Both task commits (`fad65de8`, `bf6d886c`) confirmed present via `git log --oneline --all`.
- `npm run typecheck` clean (re-confirmed).
- `node --test text-protocol.test.ts text-connect.test.ts textmon-fixtures.test.ts` -- 42/42 pass.
- `node --test resources-sync.test.ts shipped-modules.test.ts docs-dangling-refs.test.ts docs-linerefs.test.ts test-gate.test.ts` -- 39/39 pass.
- `VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test text-monitor-live.test.ts` -- 2/2 pass, 0 skipped, broker/x64sc confirmed stopped beforehand each run.
- `git diff --name-only HEAD~2 HEAD` confirms `src/mcp/vice/vice.ts` is not in the changed-file set.
- `StatusInstanceEntry` confirmed to declare exactly the six fields `port`, `url`, `state`, `reason`, `epoch`, `hasMonitorClient`.
- `MANUAL_ONLY_TESTS` confirmed at 13 entries including `text-monitor-live.test.ts`, matching `test-gate.test.ts`'s pinning assertion.
- No unexpected deletions in either task commit (`git diff --diff-filter=D --name-only` empty for both).
