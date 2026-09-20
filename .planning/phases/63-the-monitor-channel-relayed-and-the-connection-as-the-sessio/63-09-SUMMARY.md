---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
plan: 09
subsystem: infra
tags: [vice-mcp, broker-relay, binary-monitor-protocol, jam-frame, gap-closure]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
    plan: "07"
    provides: "tearDownRelaySessionsForGrant()'s delete-before-close discipline and the current, green broker-relay.test.ts harness (withStubEmulatorServer(), withRelayTestBroker(), claimAndDialRelay(), decodeOneRequest()) this plan's cases reuse unchanged"
provides:
  - "broker-relay.test.ts: three JAM (0x61) wire-shape cases -- zero-length-body byte-transparency with a null program counter, a header-split reassembly, and a demux-under-interleave case -- all driven through the real spliceRelay()/dialMonitorRelay()/stock-protocol.ts parser over real loopback sockets, closing the relay's own half of 63-VERIFICATION.md truth #2 (ROADMAP Success Criterion 1, SESS-02)"
affects: []

actuals:
  tokens: 3400
  tasks: 2
  commits: 2
  plan_head_before: 411b58cd4015d5a147733218b92dd2c173f9bf46

tech-stack:
  added: []
  patterns:
    - "Raw-byte capture alongside the parser, never instead of it: a case wires its OWN 'data' listener on the same relayed socket a ViceMonitorClient is also attached to (Node fans one chunk out to every listener without consuming it), so byte-transparency is asserted by Buffer.equals over the concatenated stream, not merely by a decoded field."
    - "Deterministic unsolicited-frame timing without a client-originated trigger byte: the stub emulator writes its frame the instant its OWN TCP accept fires, which -- by construction of spliceRelay()'s synchronous connect-then-pipe-then-return sequence, itself called strictly before broker-control.mts's own synchronous 'attached' reply write on the SAME socket -- can never race ahead of that reply on the wire. No sleep, no first-byte handshake needed."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-relay.test.ts

key-decisions:
  - "No -jamaction launch-argv override was added, and this is the finding this plan carries forward, not an omission: broker-control.mts's normaliseLaunchProfile() carries an explicit T-33-04 prohibition on any profile key whose VALUE reaches argv, and -jamaction <n> is exactly that. This plan's cases prove the relay's own byte-transparency and demux guarantees entirely synthetically, needing no launch-argv change at all."
  - "The interleave case's two write-mode sub-cases (single-segment, split-segment) were implemented as two calls to one shared async helper inside a SINGLE test(), rather than two separate top-level test() calls -- both sub-cases share the same assertion shape and this keeps the shared-defect-class assertion message (five unsolicited types at 0xffffffff, two sharing a response type with a legitimate reply) written once."

requirements-completed: []

coverage:
  - id: D1
    description: "A JAM (0x61) frame with a genuinely zero-length body crosses the relay byte-identically and decodes to a jam event whose programCounter is strictly null, proven both by raw Buffer.equals byte comparison and by the decoded field"
    requirement: "SESS-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-relay.test.ts#spliceRelay is byte-transparent for a JAM (0x61) with a zero-length body, which decodes to a jam event with a null program counter"
        status: pass
    human_judgment: false
  - id: D2
    description: "A JAM frame split across two TCP segments inside its 12-byte response header (splitting the little-endian body-length field itself) reassembles into exactly one jam event, never two and never zero"
    requirement: "SESS-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-relay.test.ts#a JAM frame split across two TCP segments inside its response header reassembles into exactly one jam event"
        status: pass
    human_judgment: false
  - id: D3
    description: "A JAM written ahead of a legitimate command reply -- in both a same-segment (single write) and a split-segment (two writes, one event-loop turn apart) interleave -- never resolves the pending request; the reply always settles with the client's own sent request id and the JAM stays on the broadcast id"
    requirement: "SESS-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/broker-relay.test.ts#a JAM interleaved with a legitimate command reply leaves the reply resolving its OWN request -- the relayed path demuxes by request id, never by arrival order"
        status: pass
    human_judgment: false

duration: ~20 min (approximate)
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 9: The JAM (0x61) Wire Shape, Proven Through the Real Relay Summary

**Three new `broker-relay.test.ts` cases prove the relay's own half of Success Criterion 1's JAM claim: a genuinely zero-length-body JAM crosses `spliceRelay()` byte-identically (raw `Buffer.equals`, not just a decoded field), survives a split across its own 12-byte header, and never lets a JAM impersonate a legitimate reply under either a same-segment or split-segment interleave with a real command.**

## Performance

- **Duration:** ~20 min (approximate)
- **Completed:** 2026-09-20T09:21:39Z
- **Tasks:** 2 completed
- **Files modified:** 1 (0 created, 1 modified)

## Accomplishments

- **Task 1** added two cases to `broker-relay.test.ts`: a stub emulator writes `syntheticJamFrame()` (`binmon-fixtures.ts` -- `responseType: 0x61`, `requestId: VICE_BROADCAST_REQUEST_ID`, `body: Buffer.alloc(0)`) the instant its own TCP accept fires. A `ViceMonitorClient` attached to the relayed socket, with its `"event"` listener wired BEFORE `attach()`, collects exactly one item: `type === "jam"`, `requestId === VICE_BROADCAST_REQUEST_ID`, and — the load-bearing assertion — `programCounter` strictly `null`, with the assertion message naming the fabricated-two-byte-PC failure mode by name. A second case splits the same frame into two `socket.write()` calls at byte offset 5 (strictly inside the header, cutting the little-endian body-length field itself), separated by a real `setImmediate()` event-loop turn, and still gets exactly one jam event.
- A raw-byte capture wired alongside (never instead of) the `ViceMonitorClient` parser, on the SAME relayed socket: `dial.pending` concatenated with every subsequent raw `"data"` chunk equals `syntheticJamFrame()`'s own bytes, `Buffer`-for-`Buffer` — this is what proves byte-transparency by bytes, not merely by a decoded field, per this plan's own prohibition.
- **Task 2** added one case, `runJamInterleaveCase()`, exercised twice (`"single-write"` and `"split-write"`): a stub emulator decodes one real `CommandType.Ping` request via the existing `decodeOneRequest()`, then writes a JAM *ahead of* that request's own reply — either concatenated in one `socket.write()`, or as two separate writes with an event-loop turn between them. In both shapes, the client's `send()` promise resolves with the reply carrying the client's OWN sent request id (never the broadcast id), and exactly one jam event reaches the event surface — proving the relayed path demuxes by request id, never by arrival order, matching ROADMAP Phase 63's cross-cutting "Demux by request id, one layer up" constraint and CLAUDE.md's own naming of the two response types (`CHECKPOINT_INFO`, `REGISTER_INFO`) that share a shape with a legitimate reply (JAM itself does not share a type with any reply, but the demux mechanism these cases exercise is the SAME keyed lookup that protects those two).
- Recorded a module-header bullet (Task 2's own instruction) stating the JAM shape is now covered synthetically here, and that the live, emulator-side question — whether genuine stock VICE ever emits a bare JAM at all under a given `JamAction` — is a separate, ledgered matter this file cannot answer.
- Full automated suite re-run at the end of Task 2: 4266 tests / 4184 pass / 0 fail / 82 skipped, exit 0 — see "Full-suite counts" below.

## Task Commits

Each task was committed atomically:

1. **Task 1: A zero-length-body JAM crosses the relay and decodes as a jam event with a null program counter** - `bea983f4` (test)
2. **Task 2: Demux by request id under adversarial interleave, and the full-suite gate** - `2c8411bb` (test)

## Which half of Success Criterion 1's JAM claim this plan closes

Success Criterion 1 states: "`stock-protocol.ts` is handed a different socket and frames, parses and demuxes identically, with its own content unchanged." That is a claim about the **relay**, and this plan closes it completely for the JAM shape: byte-transparency (proven by raw bytes), header-split reassembly, and demux-under-interleave are now all covered synthetically, deterministically, and in CI, joining the three wire shapes 63-01..63-06 already proved (register read, memory write, checkpoint hit).

**What this plan does NOT close:** whether genuine stock VICE ever *emits* a bare JAM at all, under the project's default `JamAction`. Plan 63-06's own live run against genuine stock VICE 3.9 (`/usr/bin/x64sc`) wrote the KIL opcode and the JAM target PC — both independently verified correct by read-back — resumed, and observed no JAM (0x61) event within 5 seconds. That is an emulator-behaviour question, not a relay question, and it is already honestly disclosed and ledgered as `.planning/WINDOWS.md` id 70 (`open`) and 63-VERIFICATION.md's Human Verification item 1. This plan's own cases prove that IF a real stock JAM ever crosses the relay, it will do so byte-identically and demux correctly — they cannot and do not speak to whether stock VICE emits one at all. That measurement, and its own disposition, belongs to plan 63-10.

## The T-33-04 finding: why no `-jamaction` launch knob was added

Recorded in this plan's own `<carried_debt>` and re-confirmed here: `broker-control.mts`'s `normaliseLaunchProfile()` carries an explicit, requirement-tagged prohibition (T-33-04): *"WHAT MUST NEVER BE ADDED HERE: a passthrough string, an `extraArgs`, or any key whose VALUE reaches argv. `profile` maps to exactly two literal flag tokens (`-console`, `-warp`) and to nothing else."* `-jamaction <n>` is precisely a key whose value reaches argv — it is not a boolean-to-literal-token mapping like `warp`/`headless` already use. This plan therefore adds no launch-argv change of any kind. A future phase wanting a `-jamaction` override must first decide whether to express it as a boolean-to-literal-token pair (the existing shape) or accept a scoped, explicit exception to T-33-04 — a design decision this gap round deliberately leaves out of scope. Plan 63-10 measures the emulator-side question without needing one.

## Full-suite counts beside the recorded baseline

| | tests | pass | fail | skipped | exit |
|---|---|---|---|---|---|
| 63-VERIFICATION.md baseline | 4255 | 4173 | 0 | 82 | 0 |
| Baseline after 63-08 (this plan's own starting point) | 4263 | 4181 | 0 | 82 | 0 |
| This plan's run (after both tasks) | 4266 | 4184 | 0 | 82 | 0 |

Delta from the 63-08 baseline: **+3 tests, +3 pass, 0 fail, 82 skipped unchanged** — exactly this plan's three new cases, no regressions. The failing SET is empty in all three measurements, compared as a set per the plan's own instruction, never merely as a count. `npm run test:automated` (via `test-gate.mjs`'s `MANUAL_ONLY_TESTS`) additionally skips 13 files this plan did not touch and did not need to run — `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`, `stock-live-relay.test.ts` — distinct from the 82 individual `test.skip()`/manual-gate cases the full `npm test` glob itself marks `skipped` inside otherwise-included files, so the two gates are never confused.

`npm --prefix src/mcp/vice run typecheck` exits 0 with no errors, both immediately after Task 1 and again after Task 2. No `.mts` file appears in this plan's own diff (`git diff --stat` shows exactly one file, `broker-relay.test.ts`), so no host-bound rebuild was required.

## Files Created/Modified

- `src/mcp/vice/broker-relay.test.ts` -- three new cases (Task 1: two; Task 2: one, exercised twice), one new module-scope helper (`runJamInterleaveCase()`), a new `syntheticJamFrame` import from `binmon-fixtures.ts`, and one new module-header bullet naming what this file now covers for the JAM shape and what it explicitly does not.

## Decisions Made

See `key-decisions` in the frontmatter: no `-jamaction` launch-argv override (T-33-04), and the interleave case's two write-mode sub-cases share one `test()` and one helper rather than two top-level tests.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<acceptance_criteria>` were verified directly (see below) with no fix cycles needed.

**Total deviations:** 0.
**Impact on plan:** None.

### Acceptance criteria, verified

- `grep -ac 'syntheticJamFrame' broker-relay.test.ts` -> 4 (import + 3 call sites across the three new cases) -- at least 2 required.
- Both Task 1 cases assert `programCounter` is strictly `null`, each with an assertion message naming the fabricated-PC failure mode by the literal string `FABRICATED-PC CHECK`.
- The zero-length-body case asserts raw byte equality (`assert.deepEqual` over `Buffer.concat([dial.pending, ...rawChunks])` against `jamFrame`) -- byte-transparency proven by bytes, not a decoded field alone.
- The split case splits at byte index 5, strictly between 1 and 11 inside the 12-byte header.
- Every new case runs through `withRelayTestBroker()`/`claimAndDialRelay()`; no `ViceMonitorClient` in this plan's cases is ever attached to a socket that did not traverse `spliceRelay()`.
- `git diff "$(git merge-base HEAD main)" -- src/mcp/vice/broker-relay.test.ts` shows **zero** deletion lines (`grep -cE '^-[^-]'` -> 0) across both task commits -- no pre-existing assertion was relaxed, reworded or removed.
- `grep -ac 'VICE_BROADCAST_REQUEST_ID' broker-relay.test.ts` -> 7 -- at least 4 required.
- The interleave case covers both a single concatenated write and two separate writes, asserting for each that the resolved reply's `requestId` equals the client's own sent id, and that exactly one jam event reached the event surface.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 63-VERIFICATION.md truth #2's relay-side half is now closed synthetically, deterministically, and in CI. The remaining, disclosed emulator-behaviour question (whether genuine stock VICE ever emits a bare JAM under the default `JamAction`) stays open at `.planning/WINDOWS.md` id 70 and routes to plan 63-10's own measurement and disposition.
- `requirements-completed` is left empty in this SUMMARY's frontmatter even though this plan declares `requirements: [SESS-02]`: SESS-02 is also declared by `63-01`, `63-02`, `63-05`, `63-06`, `63-07`, and `63-10`-PLAN.md, and the shared-ID gate (#2388) does not mark a shared requirement complete until every declaring plan has a SUMMARY. `requirements.ready-ids` was run directly and returned `0/1 requirement(s) ready to mark complete`, because `63-10-PLAN.md` has no SUMMARY yet -- so `requirements.mark-complete` was correctly never invoked by this plan. (REQUIREMENTS.md's SESS-02 row already reads `Complete` from an earlier point in the phase, before the shared-ID gate's full sibling set was accounted for; this plan neither touches nor corrects that pre-existing state, consistent with 63-07-SUMMARY.md's own precedent for the identical situation with SESS-05.)
- Ready for 63-10, the plan that measures and disposes of WINDOWS id 70 (and id 69).

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `bea983f4`, `2c8411bb` -- both `FOUND`.
- Key file verified present on disk: `src/mcp/vice/broker-relay.test.ts` -- `FOUND`.
- All plan-level `<verification>` commands re-run and passing: `node --test --test-reporter=tap broker-relay.test.ts` (`# fail 0`, all three new case names present in the TAP body); `npm --prefix src/mcp/vice run typecheck` (exit 0); `npm --prefix src/mcp/vice test` (4266/4184/0/82, exit 0, failing SET empty against the recorded baseline); `grep -ac 'syntheticJamFrame' broker-relay.test.ts` -> 4 (previously 0).
- Every `must_haves.truths` entry from the plan has a named, passing test case (see coverage block D1-D3 above).

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio*
*Completed: 2026-09-20*
