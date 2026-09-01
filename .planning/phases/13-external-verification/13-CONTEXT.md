# Phase 13: External Verification - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase closes **three carried verification-debt items** by running them
against a real VICE binary instead of the internal proxy that stood in for each
one. All three exist today as high-priority pending todos with written
acceptance checks; this phase executes those checks and records what the binary
actually said.

Concretely:

1. **EXTV-01** — the three synthetic `VERIF-02` binmon wire fixtures
   (`display-get`, `event-interleaved`, `checkpoint-list`) are re-recorded from a
   real binary, and no sidecar still declares itself synthetic while being relied
   on as ground truth.
2. **EXTV-02** — the `--help` backend discriminator (`classifyHelpOutput()` /
   `probeBackend()`) is confirmed against a real stock `x64sc` **and** a real
   fork `x64sc`, with both transcripts committed.
3. **EXTV-03** — the four Phase 3 wire details written spec-driven and never
   exercised (A1, A2, A3, A5) are each run against a real binary, and a detail
   the binary contradicts is corrected rather than noted.

**Not in this phase:** new capabilities, new backends, new tools, changing which
command CI runs, or probing A4 (see D-13-05). Repair work triggered by a
contradiction is bounded by D-13-04 — this is a verification phase, and
verification phases that silently absorb repair work are how scope escapes.

**Starting state, measured live 2026-08-21 during this discussion:**

```
/usr/bin/x64sc        VICE 3.9    -mcpserver: 0   -binarymonitor: 2   -> genuine stock
/usr/local/bin/x64sc  VICE 3.10   -mcpserver: 5   -binarymonitor: 2   -> the fork
```

Two findings from that check, both material to planning:

- The discriminator's token-level premise **already holds** on real binaries:
  stock advertises `-binarymonitor` with no `-mcpserver`; the fork advertises
  both, which is the "fork wins when both present" branch. EXTV-02's remaining
  work is capturing the transcripts and pinning the result, not discovering it.
- **Both** binaries advertise `-remotemonitor` *and* `-remotemonitoraddress`, so
  A1's flag spelling is confirmed on stock 3.9 and fork 3.10 alike. What remains
  of A1 is only whether the port actually binds.

Note also that the only genuine *stock* build on this host is **3.9** and the
only **3.10** is the fork — so "real stock" and "current protocol version" are
different binaries here. D-13-01 settles which one the fixtures use.

</domain>

<decisions>
## Implementation Decisions

### Which binary is ground truth

- **D-13-01:** All three EXTV-01 fixtures are captured from **whichever `x64sc`
  resolves first in `PATH`** — today `/usr/local/bin/x64sc`, VICE 3.10, the
  fork. Sidecars record `fork` honestly. Stock-vs-fork byte drift is explicitly
  **out of scope** for EXTV-01: no cross-check capture against stock 3.9, and no
  artifact claiming to distinguish "upstream behaviour" from "fork patch
  behaviour". Accepted consequence, recorded so a later reader is not misled: a
  fork-recorded fixture is real hardware evidence for the *protocol*, but if
  Phase 14 retires the fork, these fixtures describe a binary the project no
  longer ships.

- **D-13-02:** All four EXTV-03 assumptions probe against the **same
  first-in-`PATH` binary**, for the reason the user gave: emulators are
  installed and removed by the user at any time, and versions do not matter as
  long as the protocol interface is the same. The phase verifies the protocol
  interface, not a pinned build.
  **Corollary the planner must honour:** probes resolve the binary through the
  project's own lookup and **never hardcode `/usr/bin/x64sc` or
  `/usr/local/bin/x64sc`**. Every artifact records what it was captured from
  rather than asserting a version.
  This was checked rather than assumed: A1's `-remotemonitoraddress` spelling is
  present on both builds, so probing it against the fork answers the flag
  question even though `buildViceArgs()`'s *stock branch* is what carries it.
  The branch-selection half is already unit-testable without an emulator.

### Evidence for the discriminator

- **D-13-03:** EXTV-02 commits **both raw `--help` transcripts verbatim**, plus
  a fixture-driven regression test built from the **real** strings, labelled
  `capturedFrom: "real hardware"` and kept **separate** from the existing
  ASSUMED fixtures in `backend-detect.test.ts` — never merged with them or
  presented as the same class of evidence. This is the
  `2026-08-13-confirm-help-discriminator` todo's own acceptance-check step 2, and
  it is the only option that stops `classifyHelpOutput()` drifting later.
  EXTV-02 is the one sub-item that inherently needs **both** binaries —
  distinguishing the two builds *is* the requirement — so D-13-01's
  first-in-`PATH` rule does not apply to it.
  Also update `docs/phase2-backend-probe-evidence.md` §2's verdict from OPEN.

### What happens when a probe contradicts an assumption

- **D-13-04:** The correction unit is **every site carrying that assumption's
  `[ASSUMED]` label**, enumerated by `grep` at execution time — *not* the single
  "file to correct" line its todo names, which is measurably wrong for A2 and A3.
  Verified during this discussion:

  | Assumption | Sites carrying the label |
  |---|---|
  | A1 flag spelling | `.claude/mcp/vice/broker-launch.mts:140` |
  | A2 step-over | `.claude/mcp/vice/stock-execution.ts:227` **and** `.claude/mcp/vice/stock-protocol.ts:742` |
  | A3 joystick bits | `.claude/mcp/vice/stock-input.ts:161,166` **and** `.claude/mcp/vice/stock-protocol.ts:791` |
  | A5 autostart `fileIndex` | `.claude/mcp/vice/stock-protocol.ts:847` |

  A label comes off only when **all** of its sites come off together, and
  `stock-protocol.ts:408`'s module-level "labelled as `[ASSUMED]` ... never
  silent" convention is re-checked afterward — stripping one site and leaving
  its twin still claiming the detail unverified would put contradictory labels in
  shipped source, which is the exact defect class this milestone exists to stop.
  A confirmed assumption also needs its `03-RESEARCH.md` Assumptions Log row
  updated; a contradicted one needs a regression test capturing the corrected,
  real behaviour **before** any label is removed.
  **Escape hatch:** if a probe shows an *advertised tool contract* is wrong (e.g.
  A2 turning out to mean `vice_execution_step`'s documented `stepOver` semantic
  is false), the phase records the finding and files a todo rather than
  redesigning the contract in-phase. The trigger is a behavioural contract
  change, not a file count.
  — **Reversibility:** reversible — label edits and test additions are local; the
  escape hatch exists precisely so no contract change lands here.

- **D-13-05:** **A4 is out of scope.** It is explicitly not one of the four wire
  details (the `2026-08-14` todo calls it "a design choice, not a wire
  assumption"), and probing it means arming a `stop:false` checkpoint on a hot
  address — which per CLAUDE.md emits `CHECKPOINT_INFO` synchronously from
  inside VICE's CPU loop and can stall the emulator thread. The
  `2026-08-14-probe-phase3-assumed-wire-details` todo therefore stays **open**
  after this phase, with A4 as its only remaining item. Closing three of four
  named assumptions and saying so beats closing four and hiding a stall risk.

### Fixture provenance

- **D-13-06:** Replace the three synthetic `.bin`/`.json` pairs **in place**.
  `binmon-fixtures.ts`'s `loadCapturedFixture()` *requires* the `synthetic` key,
  so the new pairs carry `synthetic: false` and cannot be mistaken for the old
  ones; the `specSections`/`note` keys that only described the synthesis are
  removed with them. The record of what *was* assumed lives in
  `fixtures/binmon/README.md`'s provenance table and
  `docs/phase2-backend-probe-evidence.md` §1 — plus git history holds the
  original bytes. No parallel dead fixtures.
  **Also correct while editing that README:** it currently describes
  `/usr/local/bin/x64sc` VICE 3.10 as a "genuine build" without saying it is the
  **patched** one. True but misleading, and this phase is about exactly that
  distinction.
  — **Reversibility:** costly — the old bytes survive only in git history once
  overwritten, so a reader who wants the synthetic model back must go find it.
  Accepted deliberately over keeping dead fixtures in the tree.

- **D-13-07:** The live probes are **extensions to `probe-binmon.mjs`** — a
  script, not a test — so nothing new depends on a reachable emulator in CI.
  Only the **offline fixture-driven assertions** become committed tests, running
  in the automated gate against committed bytes. This is the same split plan
  07-12 already used for the three real `cpuhistory-get` captures, and it avoids
  adding to the set of test files that cannot be automated (see the
  `2026-08-12-vice-broker-tests-stall-outside-devcontainer` todo).

### Claude's Discretion

The user delegated D-13-03 through D-13-07 explicitly ("if it matters you
decide" / "if you want to rework something pick it otherwise continue"), and
gave a standing instruction not to over-invest in the binary-selection question.
Within the decisions above the planner has latitude on: how the three sub-items
split across plans (they are independent and may run in parallel per ROADMAP.md);
where exactly the EXTV-02 transcripts live on disk; and the probe-extension
shape inside `probe-binmon.mjs`. Anything that would widen scope past D-13-04's
escape hatch is not discretionary — it becomes a todo.

### Folded Todos

All three are the phase's actual source material, each carrying a written
acceptance check the plans should execute rather than re-derive:

- **`2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`** — the
  three synthetic fixtures. Its acceptance check has 6 numbered steps including
  the `MAX_CAPTURE_FRAMES` flood hazard, the geometry diff, and the
  `checkpoint-list` terminator-frame shape (`0x14`/`u32LE`) that is an
  *unverified reading* and may well be contradicted. → EXTV-01.
- **`2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`** — the
  discriminator. Names three specific ASSUMED sub-claims about `--help` output
  shape and the fallback ladder. → EXTV-02.
- **`2026-08-14-probe-phase3-assumed-wire-details.md`** — A1/A2/A3/A5 (+A4, out
  of scope per D-13-05). Its acceptance check gives a concrete probe per
  assumption. → EXTV-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The three acceptance checks (start here — they are the phase content)
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` — EXTV-01's 6-step acceptance check, and the per-fixture record of exactly which spec section each synthetic field came from
- `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md` — EXTV-02's 5-step acceptance check; distinguishes what is *known* (both flag names are real) from what is *assumed* (that `--help` actually lists them)
- `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md` — EXTV-03's per-assumption probe recipe, including the A4 item this phase deliberately leaves open

### Prior override records this phase closes
- `docs/phase2-backend-probe-evidence.md` §1 — the full D-19 override record for the synthetic fixtures
- `docs/phase2-backend-probe-evidence.md` §2 — the discriminator's **OPEN** verdict, to be resolved by EXTV-02
- `.planning/phases/03-direct-tools/03-RESEARCH.md` — the Assumptions Log rows A1/A2/A3/A4/A5 that carry the `[ASSUMED]` status
- `.planning/phases/03-direct-tools/03-VALIDATION.md` — the Manual-Only Verifications table whose "New encoders are byte-for-byte accepted by a real VICE binary" row this phase answers

### Protocol ground truth
- `docs/phase0-binmon-findings.md` §5 — the normative opcode/error-code set the synthetic fixtures were built from; the re-capture is checked against it
- `docs/phase1-probe-results.md` — the geometry (`dw=504 dh=312 xo=136 yo=51 iw=320 ih=200 bpp=8`) the new `display-get` capture should match, and the `CHECKPOINT_INFO` x18 flood record behind `MAX_CAPTURE_FRAMES`
- `CLAUDE.md` → Constraints — the settled protocol facts, including the `CHECKPOINT_INFO`-from-inside-the-CPU-loop hazard behind D-13-05 and `CPUHISTORY_GET`'s VICE >= 3.10 requirement

### Files the phase touches
- `.claude/mcp/vice/fixtures/binmon/README.md` — the mixed-provenance table to update (and the "genuine build" mislabel to fix, per D-13-06)
- `.claude/mcp/vice/binmon-fixtures.ts` — `loadCapturedFixture()`, which *requires* the `synthetic` key, so provenance cannot be established by omission
- `.claude/mcp/vice/probe-binmon.mjs` — the existing `--capture` tool the new probes extend (D-13-07)
- `.claude/mcp/vice/backend-detect.mts` / `backend-detect.test.ts` — `classifyHelpOutput()`/`probeBackend()`/`resolvedBackend()` and the ASSUMED fixtures the real transcripts must sit apart from
- `docs/stock-vice-parity.md` section A item 7 — the licensed-divergence register; A1/A2/A3/A5 are implementation-detail risks, not licensed divergences, but a wrong A2/A3/A5 produces a silently wrong answer this doc does not currently warn about

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`probe-binmon.mjs`'s `--capture` mode** — already writes `.bin` + provenance
  sidecar (`capturedFrom`, `viceVersion`, `capturedAt`, `command`) via a
  tmp-sibling → rename write, bounded per case by `MAX_CAPTURE_FRAMES`. The
  EXTV-01 re-capture is an existing-tool run, not new machinery.
- **`loadCapturedFixture()`** in `binmon-fixtures.ts` — enforces the explicit
  `synthetic` key. The provenance guarantee D-13-06 relies on is already
  mechanical.
- **Plan 07-12's three real `cpuhistory-get` captures** — a working precedent
  for "real capture committed alongside synthetic ones, each labelled", and the
  precedent for D-13-07's script-vs-test split.

### Established Patterns
- **Fixtures are frozen evidence** (`.planning/codebase/TESTING.md`): treat
  anything under `fixtures/` as read-only unless its README says otherwise. This
  phase is an authorised exception for exactly three pairs, which is why D-13-06
  spells the replacement out rather than leaving it implied.
- **Dependency injection over mocking** — the suite has no mocking library;
  the external boundary (a real emulator) is injected, not faked in place. New
  offline assertions should follow that, and the emulator-dependent part stays in
  the script.
- **`assert` calls carry a descriptive third-argument message** stating what
  property is checked and why it matters; test names are long sentences.
  Guard-removal sensitivity is an explicit design goal.
- **No coverage tool is wired anywhere** — do not add one for this phase.

### Integration Points
- `npm test` / `npm run test:automated` in `.claude/mcp/vice` — where the new
  offline assertions land; CI runs it on every merge and every merge to `main`
  auto-publishes, so a broken assertion blocks a release.
- `docs/phase2-backend-probe-evidence.md` — the doc whose two OPEN/override
  verdicts flip as a result of this phase.
- The `[ASSUMED]` label sites listed in D-13-04 — the shipped-source surface this
  phase edits.

</code_context>

<specifics>
## Specific Ideas

- **"Whatever emulator is first found in path is the one to use."** The user's
  own framing, and the reason D-13-01/D-13-02 do not pin a version: *"emulators
  can be installed and removed at any time by the user, and versions doesn't
  really matter as long they have the same protocol interface."* Recorded as
  data, not as an instruction to a later agent — but it is the governing
  principle for binary selection in this phase, and it is why the planner must
  resolve binaries dynamically instead of hardcoding paths.
- **Don't over-invest in the binary question.** Explicit direction during
  discussion. Where a check settles a question cheaply (both builds advertise
  `-remotemonitoraddress`), settle it and move on rather than building
  apparatus to compare builds.

</specifics>

<deferred>
## Deferred Ideas

- **Stock-vs-fork fixture drift** — capturing the same three frames from both
  builds to separate "the protocol changed between 3.9 and 3.10" from "the fork
  patched something". No current artifact can distinguish these. Explicitly cut
  from EXTV-01 by D-13-01; worth revisiting only if Phase 14 keeps the fork.
- **A4, the `stop:false` rate limiter under a real `CHECKPOINT_INFO` flood** —
  out of scope per D-13-05, stays tracked in its own todo.
- **`fixtures/binmon/README.md`'s "genuine build" wording** — being corrected
  in-phase as a side effect of D-13-06, noted here so it is not mistaken for
  scope creep.

### Reviewed Todos (not folded)

The matcher returned 18 candidates at a uniform score of 0.6, which is keyword
noise rather than signal. Reviewed and **not** folded:

- `2026-08-12-vice-broker-tests-stall-outside-devcontainer.md` — adjacent to
  D-13-07's reasoning (it is why the phase avoids adding non-automatable tests)
  but its own fix is a test-gate change, out of scope here.
- `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` — CI command
  shape; explicitly out of scope.
- `2026-08-19-*` (drive-type prerequisite, keyboard-fallback LOAD, project-paths
  git marker, releases.json schema, `vice_ping` resolvedBinaryPath) — all
  documentation or behaviour debt unrelated to these three verification items;
  Phase 15 (`DEBT-*`) or Phase 17 territory.
- `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` — **Phase 14**
  (`FORK-01`). Interacts with D-13-01's accepted consequence but must not be
  pre-empted here.
- `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md` — Phase 16
  (`PKG-*`).
- `2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` — a settled
  refutation, no action in this phase.
- `2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md` — test-gate
  refactor, Phase 15/16 territory.
- `2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md` and
  `2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md` — **Phase 15**
  (`GATE-02`), named in that requirement by number.
- `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md` —
  comment hygiene; Phase 15.
- `2026-08-20-vsf-as-a-bootstrap-input.md` (score 0.2) — unrelated feature idea.

</deferred>

---

*Phase: 13-External Verification*
*Context gathered: 2026-08-21*
