---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
plan: 01
subsystem: broker-control-plane
tags: [tcp, handshake, dial, node-net, version-skew, control-plane]

# Dependency graph
requires: []
provides:
  - A ninth `hello` `ControlRequestKind` answered by `broker-control.mts` BEFORE the token gate
  - `src/mcp/vice/broker-endpoint.ts`: the fixed-endpoint dial, four-rank classification, and four act-on-able refusals
  - `BROKER_START_COMMAND`, the one shared npx invocation every future refusal/doc site quotes
affects: [62-02, 62-03, 62-04, 62-05, phase-63-session-relay, phase-64-file-transfer, phase-65-skill-script-seam]

# Actuals (#2632)
actuals:
  tokens: 21483
  tasks: 3
  commits: 3
plan_head_before: ea006182

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-token-gate op dispatch: a control op answered BEFORE tokensMatch() runs, restructuring handleLine() rather than appending one more chained arm"
    - "Mirrored (not imported) literal across the host-bound/.mts vs container-side/.ts compile boundary, pinned together by a source-reading byte-identity test"
    - "Per-candidate connect/reply timeout pair with an onSocket callback for cross-candidate cancellation on early success"
    - "Four small named refusal functions, each quoting one shared exported constant, never a generic message with a variable clause"

key-files:
  created:
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/broker-endpoint.test.ts
    - .planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/deferred-items.md
  modified:
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/resources/broker-control.mjs

key-decisions:
  - "hello dispatches between the JSON-parse/shape guards and tokensMatch() -- proven with a source-offset assertion, not just behaviorally"
  - "classifyHelloReply is one pure function covering all four ranks plus the completed-handshake case, called by both the dial and its own tests"
  - "dialBrokerEndpoint resolves as soon as any candidate completes (a real race via an onSocket callback + manual settle bookkeeping), not a simple Promise.all -- required by the must_have that a completed handshake wins by SETTLE order, not candidate order"
  - "Rank-4 refusal names both @henols/vice-mcp and @henols/c64-re-tools (D-05's lockstep-publish fact), even though only vice-mcp performs this dial in this phase"
  - "BROKER_START_COMMAND is a single literal (grep count 1), never re-typed in a message function"

requirements-completed: [ENDPOINT-01, ENDPOINT-02, ENDPOINT-03, ENDPOINT-04, ENDPOINT-05]

coverage:
  - id: D1
    description: "A broker answers a credential-free hello ahead of its token gate; the eight existing ops are unaffected"
    requirement: "ENDPOINT-03"
    verification:
      - kind: unit
        ref: "broker-control.test.ts#the ControlRequestKind union has exactly nine members including hello, and the hello arm's dispatch sits before the tokensMatch() call"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#a raw hello line with NO token field returns a handshake reply, never unauthorized"
        status: pass
      - kind: unit
        ref: "broker-control.test.ts#a raw status line with NO token field still returns the unauthorized error code, proving the eight existing ops' gate is unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A client dials the fixed endpoint end to end and completes a real handshake against a real listener"
    requirement: "ENDPOINT-01"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#dialBrokerEndpoint completes a real handshake end to end against a real listener on an ephemeral port"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both dial candidates are always attempted concurrently, each bounded by its own timeout; a wedged first candidate cannot block the second"
    requirement: "ENDPOINT-02"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#behavior 1: candidate 1 wedged (accepts, never writes a byte), candidate 2 healthy -- resolves ok from candidate 2, well within twice the reply timeout"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#behavior 3: both candidates healthy -- the dial resolves ok once, and every socket (winner and loser) is destroyed before it resolves"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four failure ranks are distinguishable and stable, ranked by informativeness, reporting the highest rank across both candidates"
    requirement: "ENDPOINT-05"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#behavior 5/6/7/8/9 (rank 2/3/4 cases, skew-never-short-circuits, tie ordering)"
        status: pass
      - kind: unit
        ref: "broker-endpoint.test.ts#classifyHelloReply unit tests (rank 1-4 plus completed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each of the four ranks produces its own act-on-able refusal, quoting one shared start-command constant; the rootless disclosure is gated on a dial observation with its own provenance disclaimer"
    requirement: "ENDPOINT-04"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#rank 1/2/3/4 message assertions, rootless disclosure gating, describeDialFailure purity"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nothing in the new dial path reads the filesystem or imports the legacy discovery-record client"
    verification:
      - kind: unit
        ref: "broker-endpoint.test.ts#broker-endpoint.ts never touches the filesystem and never imports the legacy discovery-record client"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-19
status: complete
---

# Phase 62 Plan 1: The Fixed Endpoint and the Broker That Owns the Machine Summary

**A `hello` handshake answered ahead of the token gate, a two-candidate concurrent dial with a real four-rank classifier, and four act-on-able refusals all quoting one shared `npx -y @henols/vice-mcp broker` start command.**

## Performance

- **Duration:** 55 min (estimated)
- **Started:** 2026-09-19T13:57:00Z (approximate)
- **Completed:** 2026-09-19T14:52:18Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 edited) plus 1 deferred-items note

## Accomplishments
- `broker-control.mts` answers a ninth op, `hello`, dispatched between the JSON-parse/shape guards and `tokensMatch()` — proven both behaviorally (no-token handshake succeeds, no-token `status` still refuses) and structurally (a source-offset assertion pins the arm above the gate so a future refactor that moves it back goes red).
- New `src/mcp/vice/broker-endpoint.ts`: `dialBrokerEndpoint()` dials both fixed candidates (`127.0.0.1`, `host.docker.internal`) concurrently, each on its own connect/reply timeout, and resolves the instant either produces a completed handshake — a version skew never short-circuits the other candidate.
- `classifyHelloReply()` is the one pure classifier mapping every observation onto D-07's four ranks (nothing listening, foreign listener, stale broker, version skew) or a completed handshake; both the dial and 10 direct unit tests call it.
- `describeDialFailure()` builds one of four distinct, act-on-able refusal messages, each quoting the single exported `BROKER_START_COMMAND` constant (except rank 4, which instead names both package names and both observed versions); the rootless-container disclosure line is gated purely on a candidate's hostname having resolved despite a failed connection, carries its own unconfirmed-provenance disclaimer, and never mentions the deferred alternative-runtime default.
- `resources/broker-control.mjs` regenerated and committed alongside its `.mts` source in the same commit that introduced `hello`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "a client finds the broker and completes a handshake"** - `83907805` (tracer)
2. **Task 2: Both candidates always dialled, ranked by informativeness** - `81550294` (feat)
3. **Task 3: Four refusals quoting the shared start command** - `55ed4064` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/mcp/vice/broker-endpoint.ts` - the fixed-endpoint dial, `classifyHelloReply`, `describeDialFailure`, `BROKER_START_COMMAND`, `DIAL_CANDIDATES`, `HELLO_PROTOCOL_MAGIC`
- `src/mcp/vice/broker-endpoint.test.ts` - 34 tests: end-to-end handshake, per-candidate timeout/ranking behavior, classifier unit tests, refusal-text assertions
- `src/mcp/vice/broker-control.mts` - the ninth `hello` `ControlRequestKind`, its pre-gate dispatch arm, `resolveBrokerVersion()`, `helloVersion` injectable override
- `src/mcp/vice/broker-control.test.ts` - regression tests for the pre-gate placement, the widened union, the hello reply's key set/tag defaulting/version override
- `src/mcp/vice/resources/broker-control.mjs` - regenerated compiled copy
- `.planning/phases/62-the-fixed-endpoint-and-the-broker-that-owns-the-machine/deferred-items.md` - logs one unrelated pre-existing failure (see Issues Encountered)

## Decisions Made
- **hello's dispatch placement is load-bearing, not incidental**: placed between the parse/shape guards and `tokensMatch()`, proven with a character-offset assertion in addition to behavioral tests, because a branch placed after the gate would be indistinguishable from D-06's own stale-broker signature.
- **A genuine race, not `Promise.all`**: `dialBrokerEndpoint` resolves as soon as any candidate completes, using an `onSocket` callback so a still-pending losing candidate's socket can be destroyed immediately rather than waiting out its own timers. This was necessary because the plan's own must-have requires "the first completed one" to win by real settle order, not fixed candidate order (a simple `Promise.all` + `.find()` would have preferred candidate order regardless of timing).
- **Rank 4's message names both `@henols/vice-mcp` and `@henols/c64-re-tools`** per D-05's supporting fact that the two packages are always published together — even though, in this phase, only `@henols/vice-mcp` performs this particular dial. Documented inline so a future reader understands why a currently-single-actor comparison still names two packages.
- **`resolveBrokerVersion()` mirrors `tool-location.mts`'s own two-candidate locate idiom** (beside the running module, then one directory up) rather than inventing a new one, and degrades to a local `HELLO_DEV_PLACEHOLDER` mirrored from `version.ts`'s `DEV_PLACEHOLDER` rather than importing that container-side module into the host-bound `broker-control.mts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing `ControlRequestKind` tests asserted exactly eight members**
- **Found during:** Task 1
- **Issue:** `broker-control.test.ts` carried two tests hard-asserting the union had exactly eight members (pre-dating this plan's ninth, `hello`). Widening the union without updating them would have left a permanently red pair.
- **Fix:** Updated both assertions' expected member lists and docstrings to include `"hello"` as the ninth member, preserving their original intent (a reviewed widening, never per-tool).
- **Files modified:** `src/mcp/vice/broker-control.test.ts`
- **Verification:** Both tests pass; `node --test broker-control.test.ts` is green.
- **Committed in:** `83907805` (Task 1 commit)

**2. [Rule 1 - Bug] A naive raw-source substring check tripped on this module's own header prose**
- **Found during:** Task 1
- **Issue:** The "no filesystem access, no legacy-client import" structural test checked `source.includes("readFileSync(")` etc. against `broker-endpoint.ts`'s raw text — but that file's own header comment explicitly NAMES the forbidden calls and the legacy module (explaining what not to do), so the naive check false-failed against its own documentation.
- **Fix:** Adopted this codebase's existing `stripCommentLines()` idiom (already used by `hostpath-consumers.test.ts`/`tool-location-consumers.test.ts` for the identical problem) to strip comments before the substring check.
- **Files modified:** `src/mcp/vice/broker-endpoint.test.ts`
- **Verification:** Test passes against the real source, which genuinely contains no forbidden calls outside comments.
- **Committed in:** `83907805` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test assertions/checks, both direct consequences of this plan's own widening — no scope creep).
**Impact on plan:** Both fixes were necessary for the plan's own new code to be provable; neither touches unrelated behavior.

## Issues Encountered

- `npm run test:automated` (the full suite) surfaces one unrelated, pre-existing failure: `phase58-citation-ledger.test.ts` — a citation-anchor drift in `.planning/PROJECT.md` (`anchor "a user missing ACME should learn that" not found in cited range`). Confirmed present when running that test file in isolation, and `.planning/PROJECT.md` carries no uncommitted changes and was last touched by a commit (`b45892c3`) that predates this phase. Logged to `deferred-items.md` per this executor's scope-boundary rule rather than fixed here. All 112 tests in the three files this plan's `<verification>` names directly (`broker-endpoint.test.ts`, `broker-control.test.ts`, `resources-sync.test.ts`) pass with zero failures, and `npm run typecheck` is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `broker-endpoint.ts` is ready to be dialed by real callers in later plans/phases (63-65) once they choose to route through it instead of the legacy discovery-record path — this plan deliberately keeps both paths running in parallel, per the phase's own domain boundary.
- `BROKER_START_COMMAND` is now the one place four other planned sites (README, systemd unit, launchd plist, universal fallback) should quote from, rather than hand-copying the string.
- The unrelated `phase58-citation-ledger.test.ts` failure remains open in `deferred-items.md` for whichever phase or hygiene pass owns `.planning/PROJECT.md`'s citation ledger.

---
*Phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine*
*Completed: 2026-09-19*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (`83907805`, `81550294`, `55ed4064`) verified present in `git log`.
