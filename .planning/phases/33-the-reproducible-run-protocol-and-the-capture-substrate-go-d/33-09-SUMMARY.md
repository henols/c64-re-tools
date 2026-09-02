---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 09
subsystem: mcp-stock-backend
tags: [stock-vice, binary-monitor, checkpoints, reproducibility, stop-identity, tools-manifest, npm-packaging]
status: complete

# Dependency graph
requires:
  - phase: 33-03
    provides: "the settled anchor-counted sequence (AUTOSTART_SEQUENCE: S3) and the measured AUTOSTART_FRAME_EXACT: not-achieved outcome that routed this plan to the READY-prompt sequence instead"
  - phase: 33-07
    provides: "stop-oracle.ts -- compareStopIdentity(), ORACLE_TERMS, StopIdentity, StopOracleError: the four-term oracle this procedure assembles into and validates through"
  - phase: 33-05
    provides: "the stock determinism argv (STOCK_DETERMINISM_SEED / STOCK_DETERMINISM_FLAGS) the measured sequence was taken under"
provides:
  - "runReproducible() -- THE one named seam carrying the reproducible-run protocol: resolve PC/LIN/CYC by name, arm the frame anchor (non-temporary) and the target (temporary) while halted, monitor-issued hard RESET, exactly one resume, event-driven wait on the target's own checkpoint id, and the four-term stop identity from one REGISTERS_GET reply"
  - "the two optional stock-only vice_run_until arguments `reproducible` and `frame_anchor`, declared in tools-manifest.stock.json as pure widenings"
  - "D-14's refusal: reproducible: true without frame_anchor refuses, naming why the frame term cannot otherwise be supplied"
  - "D-13 asserted rather than stated: one assert.deepEqual pins RUN_UNTIL_KEYS to exactly five names, so a future sub-flag reds a test"
  - "CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET -- the one named definition of the hit_count body offset, pinned end to end by a raw 1-vs-256 frame"
  - "a closure-walk fix in scripts/check-npm-packages.mjs: a statement-level `import type` is not a runtime edge (unblocks the gate 33-06 reddened)"
affects: [33-10, 33-11, 33-12, c64-ram-capture skill, stock manifest consumers, any future autostart-path plan]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 24879
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "whole-procedure switch: an optional boolean argument selects an entire named procedure, with no composable sub-flags, so a partial protocol is not a callable surface"
    - "refuse-before-arming: name resolution runs first, so a build that cannot supply a term is refused while the machine is still untouched"
    - "offset-as-named-constant + end-to-end raw-bytes proof, instead of duplicating a parse the single wire seam already owns"
    - "erased-import awareness in a packaging closure walk: `import type` resolves nothing at runtime, so it is not a shipping edge"

key-files:
  created:
    - src/mcp/vice/stock-reproducible-run.ts
    - src/mcp/vice/stock-reproducible-run.test.ts
  modified:
    - src/mcp/vice/stock-run-until.ts
    - src/mcp/vice/tools-manifest.stock.json
    - src/mcp/vice/package.json
    - scripts/check-npm-packages.mjs

key-decisions:
  - "Implemented the READY-prompt sequence (hard RESET inside the procedure), NOT 33-03's autostart S3, because 33-03 recorded AUTOSTART_FRAME_EXACT: not-achieved -- the plan objective's explicit conditional. The module header records S3 as the settled-but-unresolved autostarted ordering with a pointer to the evidence file, rather than inventing an ordering the evidence does not support."
  - "The frame term is the ANCHOR's hit count, read via CHECKPOINT_GET; the target's own count is a separate named field (targetHitCount) so a reader never has to infer which is which."
  - "hit_count is NOT re-read at offset 13 inside the new module -- stock-protocol.ts's parseResponse() is the one seam that turns those bytes into a number (T-33-32 says so explicitly). The offset gets one named exported constant and an end-to-end raw-bytes proof instead. This diverges from a plan verify grep; see Deviations."
  - "An anchor hit arriving before the target's halts the machine (stop:true) and the wait bounds out as a REFUSAL carrying anchorStoppedFirst and the one-resume reason -- never a second EXIT. The multi-resume counting loop stays an evidence script's job."
  - "compareStopIdentity() is called against the assembled record itself: not a tautology but the oracle's own four-term validation, which throws naming the term rather than passing on a partial record. A three-term answer is unreachable."
  - "The packaging gate was closed by teaching the closure walk about erased imports, NOT by adding broker-launch.mts to files[] -- that repair was tried first and provably cascades into three unsatisfiable entries."

patterns-established:
  - "Pattern 1: every degradation path is an explicit refusal that states its reason in the message, and every refusal test asserts NOTHING was sent -- so a refusal provably happens in the argument gate before a byte reaches the monitor"
  - "Pattern 2: the four oracle terms are emitted onto the answer by WALKING ORACLE_TERMS, so shrinking the oracle shrinks the answer visibly and an address-only certification has to delete a field a test reads"
  - "Pattern 3: a required-sibling argument name lives in one exported constant (REPRODUCIBLE_RUN_REQUIRED_SIBLINGS) read by both the gate and its refusal message, so the two cannot drift after a rename"

requirements-completed: [REPRO-02, REPRO-03]

coverage:
  - id: D1
    description: "runReproducible() drives the measured sequence end to end to a four-term stop identity: CheckpointSet(anchor), CheckpointSet(target), Reset(Hard), one Exit, RegistersGet, with exactly one resume"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: the recorded command order is CheckpointSet, CheckpointSet, Reset, Exit, RegistersGet with exactly one Exit"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: the reset is RESET (0xcc) with a HARD mode byte, sent after both arms and before the single resume"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: both arms are 9-byte stopping exec checkpoints on memspace 0x00, differing ONLY in the temporary flag"
        status: pass
    human_judgment: false
  - id: D2
    description: "The protocol is ONE seam reached from exactly one call site; reproducible absent or false takes the pre-existing path unchanged"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: reproducible absent or false takes the pre-existing path and never calls runReproducible()"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && test \"$(grep -l 'runReproducible(' *.ts | grep -v '\\.test\\.ts$' | grep -v 'stock-reproducible-run\\.ts' | wc -l)\" -eq 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The answer carries the triple (PC, hit_count, (LIN, CYC)) from one REGISTERS_GET reply with ids resolved by name, and hit_count taken from CHECKPOINT_INFO body offset 13"
    requirement: "REPRO-03"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: the answer carries all four ORACLE_TERMS with the scripted values, read by NAME from one REGISTERS_GET reply"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: hit_count comes from CHECKPOINT_INFO body offset 13 -- a raw frame giving 1 at 13 and 256 at 12 reports 1"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: hitCount is the ANCHOR's count (the frame term); the target's own count is reported separately"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every degradation path is an explicit refusal with a stated reason: no frame_anchor, an anchor without the protocol, a non-boolean flag, a malformed anchor, an unknown key, a build without PC/LIN/CYC, a term absent from the reply, and two identical checkpoint ids"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#D-14: reproducible: true with no frame_anchor is REFUSED, naming frame_anchor and why the frame term cannot be supplied"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#D-14: frame_anchor WITHOUT reproducible is refused rather than accepted and ignored"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: a build enumerating no LIN/CYC is REFUSED by name, before any checkpoint is armed"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: a REGISTERS_GET reply missing a term is REFUSED naming the term, never zero-filled"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: two identical checkpoint ids from the monitor are REFUSED -- the frames could not be told apart"
        status: pass
    human_judgment: false
  - id: D5
    description: "No sub-flag exists and none can be added silently: RUN_UNTIL_KEYS is pinned to exactly five names by one assert.deepEqual (D-13)"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#D-13: RUN_UNTIL_KEYS is EXACTLY the five names -- no sub-flag exists"
        status: pass
    human_judgment: false
  - id: D6
    description: "The stock manifest declares both new properties as pure widenings (no required array, nothing retyped) and the fork manifest is untouched"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#D-12: tools-manifest.stock.json declares reproducible and frame_anchor as optional, with no required array introduced"
        status: pass
      - kind: integration
        ref: "cd src/mcp/vice && node --test manifest-arg-compat.test.ts fork-manifest-surface.test.ts"
        status: pass
      - kind: other
        ref: "git diff --quiet -- src/mcp/vice/tools-manifest.json (FORK_MANIFEST_UNTOUCHED)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The wait discriminates on checkpoint id: an anchor CHECKPOINT_INFO arriving first is counted and the wait continues; an unsolicited event never resolves a pending request (T-33-31)"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: an anchor CHECKPOINT_INFO arriving FIRST does not resolve the wait -- it is counted and the wait continues"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible: an unrelated checkpoint's CHECKPOINT_INFO never resolves the wait"
        status: pass
    human_judgment: false
  - id: D8
    description: "The three cleanup paths stay distinct: the temporary target is not deleted on the hit path, both checkpoints are deleted on the timeout path, and nothing is deleted on the machine-restarted path"
    requirement: "REPRO-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible (hit path): the temporary target is NOT deleted; the non-temporary anchor IS"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-reproducible-run.test.ts#reproducible (timeout path): BOTH checkpoints are deleted, and the answer names why the wait bounded out"
        status: pass
    human_judgment: false
  - id: D9
    description: "The npm packaging gate, red since wave 3, exits 0 -- closed by teaching the closure walk that a statement-level `import type` is not a runtime edge"
    verification:
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (check-npm-packages: OK, exit 0, closure clean over 59 modules)"
        status: pass
      - kind: other
        ref: "negative control: removing stock-reproducible-run.ts from files[] still reds with the same Rule 2 message"
        status: pass
    human_judgment: false

# Metrics
duration: 42 min
completed: 2026-09-02
---

# Phase 33 Plan 09: The Reproducible-Run Protocol Summary

The reproducible-run protocol as ONE named procedure behind ONE optional argument
with the monitor-issued hard reset inside it — `runReproducible()`, reached from a
single call site in `handleRunUntil`, answering with the four-term stop identity
`(PC, hit_count, (LIN, CYC))` and refusing rather than silently weakening on every
degradation path in reach.

- **Duration:** 42 min
- **Tasks:** 2 of 2
- **Files:** 2 created, 4 modified
- **Commits:** 3

## Accomplishments

1. **`stock-reproducible-run.ts` (699 lines) — the one seam.** `runReproducible()`
   resolves `PC`/`LIN`/`CYC` by name through `registerCatalogFor()` *before* arming
   anything, arms the frame anchor (`temporary: false`, `stop: true`, `memspace: 0x00`),
   arms the target (`temporary: true`), issues the hard `RESET` (0xcc, `ResetMode.Hard`),
   sends **exactly one** `EXIT`, waits event-driven on the *target's* own checkpoint id,
   reads the triple from **one** `REGISTERS_GET` reply, and reads the frame term from the
   anchor's `CHECKPOINT_GET`. Every wire body comes from `stock-protocol.ts`'s encoders;
   nothing is hand-assembled.

2. **The two optional stock-only arguments, and the single call site.**
   `RUN_UNTIL_KEYS` is hoisted to module scope, exported, and extended to five names;
   `handleRunUntil` gains one branch on `args.reproducible === true`. The pre-existing
   path is untouched — asserted, not assumed (no `RESET`, one arm, and none of the
   reproducible answer's discriminators).

3. **Refusals as the primary deliverable, not error handling.** Eight distinct
   refusals, each stating its reason: `reproducible: true` without `frame_anchor`
   (D-14, naming that the once-per-frame site is release-specific and that refusing
   beats a two-term oracle); `frame_anchor` without `reproducible` (refused rather than
   accepted-and-ignored); a non-boolean `reproducible` (never coerced — the string
   `"false"` is truthy); a malformed anchor (`parseAddress`'s own wording); an unknown
   key by name; a build enumerating no `PC`/`LIN`/`CYC` (before anything is armed); a
   term absent from the register reply; and two identical checkpoint ids from the
   monitor. Every refusal test asserts **nothing was sent**.

4. **The frame term is unambiguous.** `hitCount` is the *anchor's* count and
   `targetHitCount` is the target's own, with `hitCountNote` saying which is which on
   the answer, so a reader never infers one from the other.

5. **`hit_count`'s offset 13 proven end to end.** A raw 22-byte `CHECKPOINT_INFO`
   body whose u32LE at offset 13 is `1` and at offset 12 is `256` is pushed through the
   real `parseResponse()`, and the procedure's reported frame term is asserted `1` and
   `notEqual` 256. The 1-vs-256 discrimination is not contrived — it falls out of the
   wire layout, because offset 12 is the `temporary` flag and a non-temporary checkpoint
   on its first hit gives `00 01 00 00 00`.

6. **D-13 asserted rather than stated.** One `assert.deepEqual` pins the accepted key
   set to exactly five names, carrying the rationale in a comment, so a future
   `skip_reset` / `no_anchor` / `reset_only` reds a test rather than earning a review
   comment.

7. **The stock manifest widened purely.** `reproducible` (boolean) and `frame_anchor`
   (string) added to `vice_run_until.inputSchema.properties` with descriptions carrying
   the two facts a caller cannot discover by trying, plus the answer's new
   `outputSchema` fields and one description sentence. No property removed or retyped,
   no `required` array introduced, fork manifest byte-identical.

8. **The red packaging gate closed** (deviation — see below).

## Key Decisions

### The sequence: READY-prompt, not autostart S3

`33-03`'s evidence file records **both** `AUTOSTART_SEQUENCE: S3` and
`AUTOSTART_FRAME_EXACT: not-achieved`. The plan objective's explicit conditional
covers exactly this: *"If it recorded `AUTOSTART_FRAME_EXACT: not-achieved`,
implement the READY-prompt sequence measured green and record in the module header
that the autostarted ordering is unresolved with a pointer to the evidence file —
never invent an ordering the evidence does not support."*

So the procedure implements the sequence measured green at jitter 0 / 1500 / 4000
(one identical 64K sha256, one identical `(PC=$ea31, hit_count=1, LIN=257, CYC=57)`),
with the hard `RESET` inside it — which is also what Task 1's acceptance criteria and
both `<verify>` blocks pin. The module header records S3 as the settled autostarted
ordering, records that it is **unresolved for a post-load stop** (frame-exact through
anchor hit 50, lost from hit 75, because a power cycle resets the CPU/VIC-II/CIAs but
not the absolute emulated clock and the 1541's rotational phase is a function of that
clock), and points at `evidence/33-autostart-sequencing.md`. No autostart path was
written, and `-initbreak reset` was not reached for.

The procedure therefore **reports** the stop identity it achieved and does not assert
frame-exactness — `33-03`'s own § *What 33-09 must NOT conclude from this file*.

### Exactly one resume, and what that costs — reported, not papered over

The anchor is armed `stop: true` (a non-stopping checkpoint emits `CHECKPOINT_INFO`
synchronously from inside the CPU loop on every hit and stalls the emulator thread —
`T-33-10`). So an anchor hit arriving **before** the target's halts the machine, and
with exactly one resume the wait bounds out. That is surfaced as
`anchorStoppedFirst: true` with a reason naming the one-resume invariant and pointing
the caller at the evidence script — a refusal, not a silent stall, and explicitly not
"fixed" by a second `EXIT`.

### `default_memspace` contamination is unreachable by construction

Every command the procedure sends carries an explicit `memspace: 0x00` (routed through
the encoders' wire-byte mapping — `0x00` main, `0x01`–`0x04` units 8–11, `0x08`
rejected — never `body[8] =`), and it sends no `ADVANCE_INSTRUCTIONS`, no
`EXECUTE_UNTIL_RETURN` and no `@bank:` condition. Since there is no remedy for
contamination over the binary monitor, immunity had to be structural; a `WHAT NOT TO DO`
entry names the three additions that would break it.

### `compareStopIdentity()` against the record itself

Not a tautology: it is the oracle's own four-term validation. `requireTerms()` throws a
`StopOracleError` naming the term and the side for any absent or non-integer term, so a
three-term answer is unreachable from this procedure. The four terms are then emitted by
**walking `ORACLE_TERMS`**, which makes the assumption-delta `promote` decision
structural — the bare target address is one *term* (`pc`), not the whole identity.

## Deviations from Plan

### 1. [Rule 3 — Blocking] Closed the red `check-npm-packages.mjs` gate; the obvious repair was provably wrong

- **Found during:** assigned to this plan by the orchestrator (red since wave 3).
- **Issue:** `33-06` (`11f897d`) correctly added
  `import type { LaunchProfile } from "./broker-launch.mts"` at
  `src/mcp/vice/vice-broker-client.ts:39`, so the profile shape has one definition
  rather than two. Zero runtime impact — `import type` is fully erased — but the
  transitive-closure walk turned red.
- **The precedent repair was tried first and rejected on measurement.** `6801cf5` and
  `897faf6` both chose *add the reachable module to `files[]`*. Adding
  `broker-launch.mts` produced a new failure immediately:
  `broker-state.mjs is imported by broker-launch.mts but is not in the published tarball`.
  Cause: the host-bound `.mts` broker family imports its siblings by their **compiled
  `.mjs`** specifiers (`./broker-state.mjs`, `./broker-epoch.mjs`,
  `./backend-detect.mjs`), and those paths exist only under `resources/`, never at the
  package root. Listing it cascades into three entries **no existing file can satisfy**.
  `container-guard.mts` is listable only because it has no local imports at all. So this
  is not the same class the precedents faced, and the precedent repair is unavailable.
- **Fix:** taught the walk that a **statement-level** `import type ... from "./x"` is not
  a runtime edge. This is the tree's own documented doctrine, not a new rule —
  `stock-handler.ts`'s header already permits a type-only import of `stock-dispatch.ts`
  because it *"creates no runtime cycle even though stock-dispatch.ts imports this file
  at runtime"*. Inline `import { type Foo, Bar }` still emits an import under
  `verbatimModuleSyntax`, so it remains a runtime edge and is still walked.
- **Not a weakening, and proved so:** a module reachable only through erased imports
  genuinely need not ship; one reachable through any value import is still caught. A
  negative control was run — removing `stock-reproducible-run.ts` from `files[]` still
  reds with the identical Rule 2 message.
- **Files modified:** `scripts/check-npm-packages.mjs`
- **Verification:** `node scripts/check-npm-packages.mjs` → `check-npm-packages: OK`,
  exit 0, closure clean over 59 modules. The four suites that reference the script
  (`docs-linerefs`, `ci-suite-coverage`, `hostpath-consumers`, plus `acme-verify`) stay
  green.
- **Commit:** `fc199e7`

### 2. [Rule 2 — Missing critical] `hit_count`'s offset is a named constant plus an end-to-end proof, not a duplicated read

- **Found during:** Task 1.
- **Issue:** Task 1's second `<verify>` greps for the literal `readUInt32LE(13)` inside
  `stock-reproducible-run.ts`. That grep cannot be satisfied honestly: the plan's own
  threat register (`T-33-32`) requires the value be read *"through `stock-protocol.ts`'s
  existing parse branch **rather than a local offset**"*, and `parseResponse()` already
  owns that read (`stock-protocol.ts:1370`). Duplicating it in the new module would be a
  second parse of the same field — precisely the drift the single-seam rule exists to
  prevent — and satisfying the grep from a comment would manufacture a fake pass.
- **Fix:** the offset gets **one named, exported definition**
  (`CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET = 13`) with a header comment explaining the
  1-vs-256 trap and why the read is not duplicated; and the *proof* is made stronger
  than the grep — the test builds a **raw** 22-byte body whose u32LE at 13 is `1` and at
  12 is `256`, pushes it through the real `parseResponse()`, and asserts both the parsed
  value and the procedure's reported frame term are `1`, with an explicit
  `notEqual(..., 256)`. A wrong offset therefore reds with a distinguishable number, end
  to end through production code — which is what the acceptance criterion actually asks
  for ("proven by a scripted frame that yields 1 at offset 13 and 256 at offset 12").
- **Verify substitution:** `grep -c 'readUInt32LE(13)'` over the module returns `0` by
  design. The equivalent-or-stronger check is
  `node --test stock-reproducible-run.test.ts` (the offset-13 test), plus
  `grep -c 'CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET' stock-reproducible-run.ts` → non-zero.
  The rest of that `<verify>` line (`registerCatalogFor` count, the one-call-site test,
  `SHIPPED_OK`) passes verbatim.
- **Files modified:** `src/mcp/vice/stock-reproducible-run.ts`,
  `src/mcp/vice/stock-reproducible-run.test.ts`
- **Commit:** `5aa9719`

### 3. [Rule 2 — Missing critical] The five-command order is asserted as an ordered subsequence *and* as the full sequence

- **Found during:** Task 1.
- **Issue:** the criterion reads *"the recorded command order … is exactly
  `CheckpointSet`, `CheckpointSet`, `Reset`, `Exit`, `RegistersGet`"*, but the plan's own
  action mandates `registerCatalogFor()` (which sends `REGISTERS_AVAILABLE`), the
  anchor's hit-count read, and the non-temporary anchor's delete — so a literal
  "complete list is exactly five" is unsatisfiable by the plan's own text.
- **Fix:** asserted **both**, so nothing can hide between the five: the ordered
  subsequence filtered to those five command types deep-equals the criterion exactly,
  *and* the complete recorded sequence is pinned as
  `RegistersAvailable, CheckpointSet, CheckpointSet, Reset, Exit, RegistersGet, CheckpointGet, CheckpointDelete`.
  `REGISTERS_AVAILABLE` is placed **first** — matching `33-03`'s S3 step 4 — so a build
  that cannot supply the frame term is refused while the machine is untouched.
- **Commit:** `5aa9719`

### 4. [Rule 2 — Missing critical] `outputSchema` widened alongside `inputSchema`

- **Found during:** Task 2. The plan named only the two `inputSchema` properties, but the
  reproducible answer carries 22 fields the stock manifest did not declare. Added as pure
  widenings (nothing removed, retyped, or added to `required`), keeping the manifest and
  the answer in step.
- **Commit:** `9233e78`

**Total deviations:** 4 auto-fixed (1 × Rule 3 blocking, 3 × Rule 2 missing-critical).
**Impact:** the packaging gate is green for the first time since wave 3, and the plan's
`hit_count` and command-order criteria are verified more strongly than their literal
grep form would have been. No architectural change; no Rule 4 escalation needed.

## Authentication Gates

None.

## Verification Results

| # | Plan verification | Result |
|---|---|---|
| 1 | `node --test stock-reproducible-run.test.ts manifest-arg-compat.test.ts fork-manifest-surface.test.ts` → `fail 0`; `npm run typecheck` exits 0 | **PASS** — with `stock-run-until.test.ts` added: `tests 65 / pass 65 / fail 0`; typecheck silent |
| 2 | Command order `CheckpointSet`, `CheckpointSet`, `Reset`, `Exit`, `RegistersGet`, one `Exit` | **PASS** — asserted as subsequence *and* full sequence |
| 3 | `runReproducible` called from exactly one non-test module | **PASS** — `ONE_CALL_SITE_OK` |
| 4 | `hit_count` read at offset 13, proven by the 1-vs-256 frame | **PASS** — via named constant + raw-bytes proof through `parseResponse()` (Deviation 2) |
| 5 | `RUN_UNTIL_KEYS` deep-equals the five names; every refusal reds as specified | **PASS** — 8 refusal cases, each asserting nothing was sent |
| 6 | Stock manifest declares both properties, no `required` array; fork manifest unchanged | **PASS** — `MANIFEST_WIDENED_OK`, `FORK_MANIFEST_UNTOUCHED` |
| 7 | **Wave gate:** `npm run test:automated` at no more than 2 failures, all in `anno-register.test.ts` | **PASS** — `tests 3113 / pass 3105 / fail 2`, both in `anno-register.test.ts` (`:389`, `:481`), the known out-of-phase baseline |

Additional gates run:

- `node scripts/check-npm-packages.mjs` → **exit 0**, `check-npm-packages: OK`.
- Broker and `x64sc` state before the suite: **none running** (`broker.json` is a stale
  file from 2026-08-26 whose pid 25165 is dead; earlier `pgrep -f` hits were
  self-matches). So `BACK-05` was not reddened by a live broker.
- Test count moved 3088 → 3113 (+25, exactly this plan's new file); failure count
  unchanged at 2-in-1.
- The three frozen files (`evidence/DECISION-RULE.md`, `SCHEMA.md`, `README.md`) are each
  still exactly one commit (`2a8ef95`) and unmodified. Nothing was written under
  `evidence/`.

## Known Stubs

None. No hardcoded empty value, placeholder string, or unwired data path was
introduced. Every unreachable-value path in the new module is an explicit refusal
carrying a reason, not a stub.

## Threat Flags

None. The plan's `<threat_model>` covers every trust boundary this plan touches, and no
new network endpoint, auth path, file-access pattern, or schema change at a trust
boundary was introduced. `T-33-31`, `T-33-32`, `T-33-17`, `T-33-10`, `T-33-33` and
`T-33-34` all carry `mitigate` and all are implemented with the test refs listed in the
`coverage` block. `T-33-SC` (package installs) stays `accept` — no package-manager
install occurred.

## Issues Encountered

None blocking. Two notes for later plans:

1. **`33-11` owns the live transcripts.** The jitter triple and the reset-removed
   control are not produced here; the procedure's pieces are importable for an evidence
   script, and `D-13` requires the control come from such a script rather than a shipped
   flag.
2. **The anchor-stopped-first timeout is a real operating limit, not a bug.** A
   `frame_anchor` whose site fires before the target is reached cannot be driven to the
   target through this tool with one resume. It is reported with a named reason; a
   multi-resume counting protocol remains out of the published surface by design.

## Next Phase Readiness

Wave 4 deliverable complete. `REPRO-02` and `REPRO-03` are implemented and covered.
Ready for `33-10` (capture pair) and `33-11` (live transcripts, including the
reset-removed control that makes this protocol's reset step falsifiable).

## Self-Check: PASSED

Created files verified on disk:

- `FOUND: src/mcp/vice/stock-reproducible-run.ts`
- `FOUND: src/mcp/vice/stock-reproducible-run.test.ts`

Commits verified in `git log`:

- `FOUND: 5aa9719` — `feat(33-09): runReproducible() -- the reproducible-run protocol as one seam`
- `FOUND: fc199e7` — `fix(33-09): the package closure walk must not treat` `import type` `as a runtime edge`
- `FOUND: 9233e78` — `feat(33-09): the reproducible-run refusals, the argument gate and the stock manifest`

All task `<acceptance_criteria>` re-run and passing, except the one literal grep
substituted with an equivalent-or-stronger check and documented as Deviation 2. All
plan-level `<verification>` items 1–7 pass, including the wave gate at the known
2-in-1 baseline.
