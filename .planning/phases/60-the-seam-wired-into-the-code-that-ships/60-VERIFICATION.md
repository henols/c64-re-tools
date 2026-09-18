---
phase: 60-the-seam-wired-into-the-code-that-ships
verified: 2026-09-18T22:10:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".planning/REQUIREMENTS.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-06-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-06-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-07-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-07-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-08-PLAN.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-08-SUMMARY.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-REVIEW.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-loc03-terminal-env-set-diff.md",".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-suite-set-diff.md","docs/phase58-declaration-provenance.md","docs/phase59-tool-location-placement.md","src/mcp/vice/acme-verify.ts","src/mcp/vice/backend-detect.mts","src/mcp/vice/backend-detect.test.ts","src/mcp/vice/broker-launch.mts","src/mcp/vice/host-tool-client.ts","src/mcp/vice/host-tool.mts","src/mcp/vice/host-tool.test.ts","src/mcp/vice/resources/backend-detect.mjs","src/mcp/vice/resources/host-tool.mjs","src/mcp/vice/resources/tool-location.mjs","src/mcp/vice/resources/vice-broker.mjs","src/mcp/vice/tool-location-consumers.test.ts","src/mcp/vice/tool-location.mts","src/mcp/vice/tool-location.test.ts","src/mcp/vice/vice-broker-acquire.test.ts","src/mcp/vice/vice-broker.mts","src/mcp/vice/vice-proxy.ts"]
covered_digest: "v1:sha256:e75a7fc276573886cf097ff3359ec9c9d3371d8e890979dabfbf34682cae9ec0"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "LOC-03 (the residual reported in round 2, not just CR-01): a SEPARATOR-CONTAINING
      VICE_BIN/ACME_BIN/ACME/GHIDRA_HOME override that resolves nowhere no longer falls through
      silently to the declared-id $PATH probe. `envUnresolved` is now set unconditionally
      (independent of the `/` test) in tool-location.mts's Layer 1 block, so the terminal
      refusal fires for a value of EITHER shape once neither Layer 1 step nor tools.json answered.
      Independently reproduced fixed against the live tree (direct resolveTool() call with a
      same-named decoy on PATH: path is null, refusal names the variable and value, decoy never
      returned)."
    - "WR-03 (code review's own finding, not a REQUIREMENTS.md id): the environment layer's
      terminal refusal no longer falsely claims a $PATH-substitution risk for a directory-kind id
      (ghidra/GHIDRA_HOME, acme-lib/ACME). buildEnvLayerRefusal() now branches its trailing clause
      on record.kind: an executable-kind id keeps the $PATH-shadowing warning byte-for-byte; a
      directory-kind id gets a terminal-resolution statement instead. Independently reproduced
      fixed against the live tree for both ghidra and x64sc (contrast pair)."
  gaps_remaining: []
  regressions: []
gaps: []
advisory: []
human_verification:
  - test: "Point ACME_BIN at a path that does not exist and invoke the acme.build route. Then,
      as the contrasting case, unset ACME_BIN entirely with ACME genuinely absent and confirm
      that refusal carries the declaration's remedy text verbatim."
    expected: "The absolute-path case now hits the seam's environment-layer terminal refusal
      (closed this round): a refusal quoted verbatim naming ACME_BIN and the nonexistent value,
      with no remedy appended -- not a raw OS spawn error and not a silently substituted binary.
      The genuinely-absent case carries the declaration's remedy text verbatim."
    why_human: "Needs a real host with a real ACME install moved aside; deferred by plan 60-03's
      own <human-check> block, restated with an UPDATED expectation by plan 60-07 and again by
      plan 60-08 under workflow.human_verify_mode: end-of-phase. Not run by any executor across
      all three gap-closure rounds of this phase."
  - test: "Record a real stock x64sc path in .c64-re-tools/tools.json, start the broker as its
      systemd unit, and confirm from the process arguments or the broker's own launch log line
      that the spawned binary is the recorded path, not whatever $PATH would have supplied. Then,
      separately, set VICE_BIN to the bare filename of a real stock emulator binary that sits on
      $PATH and confirm the broker spawns that binary -- the developer setup LOC-03 promises is
      unaffected. Stop the broker afterwards."
    expected: "The systemd-launched broker's real child process argv matches the tools.json
      -recorded path in the first run, and matches the bare-name-resolved binary in the second."
    why_human: "Needs a real broker process running as its systemd unit against a real recorded
      path and a real installed emulator; deferred by plan 60-05's own <human-check> block and
      restated by plans 60-07 and 60-08's own <human-check> blocks. Not run by any executor
      across all three gap-closure rounds of this phase."
---

# Phase 60: The Seam Wired Into the Code That Ships Verification Report

**Phase Goal:** The seam stops being a module with tests and becomes the only way this
project finds a tool. Every live resolution goes through it, every live remedy message comes
from the declaration, and a developer whose setup, test invocation or CI step sets `VICE_BIN`,
`ACME_BIN`, `ACME` or `GHIDRA_HOME` notices nothing whatsoever.

**Verified:** 2026-09-18T22:10:00Z
**Status:** human_needed
**Re-verification:** Yes — this is the THIRD verification of this phase, following gap-closure
plan 60-08. Round 1 found LOC-03 unmet (closed by plans 60-06/60-07). Round 2 found LOC-03 still
unmet in its separator-containing shape, traced to a same-phase regression introduced by plan
60-01. This round follows plan 60-08, which was dispatched specifically to close that residual
and 60-REVIEW.md's WR-03 finding. Both are independently confirmed closed below, against the
live tree, not accepted on SUMMARY prose.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LOC-01: A path recorded in `.c64-re-tools/tools.json` is honoured by the code that actually spawns/resolves the tool, not only by a test calling the seam directly. | ✓ VERIFIED (regression check) | `vice-broker.mts:1265,1310` still threads `resolvedViceBin` into the real spawn wiring. `host-tool.mts` still resolves `acme`/`acme-lib`/`ghidra`/`c1541`/`petcat` through the seam. `host-tool.mts` is untouched by plan 60-08's diff (confirmed via `git diff --stat`); no regression found. |
| 2 | LOC-02: The precedence order exists in exactly one place — no callsite under `src/mcp/vice` keeps its own ordering. | ✓ VERIFIED (regression check) | `tool-location-consumers.test.ts` re-run directly as part of the combined run below: passes, unchanged. |
| 3 | LOC-03: `VICE_BIN`, `ACME_BIN`, `ACME` and `GHIDRA_HOME` still win over the file, so no current developer setup, test invocation or CI step changes behaviour. | ✓ VERIFIED (residual closed this round) | Both shapes now refuse honestly instead of substituting a decoy. Independently reproduced against the live tree below — the exact repro the round-2 report used, re-run against plan 60-08's code, now returns `path: null` with a named refusal instead of the decoy. |
| 4 | LOC-04: `c1541` and `petcat` become locatable via `.c64-re-tools/tools.json` for the first time, while the sibling probe and its `$PATH`-shadowing warning stay intact. | ✓ VERIFIED | Unchanged since round 2 (`host-tool.mts` untouched by this round). `findSiblingBinary()`'s `refusal` threading (WR-01, plan 60-07) still present at both call sites. |
| 5 | DECL-03: A live refusal and the doctor cannot name different remedies for the same tool, because every refusal site reads the declaration's remedy prose at call time. | ✓ VERIFIED (regression check) | `remedyTextsFor()` still exported and wired at `host-tool.mts`'s refusal sites. Unchanged since round 2. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Independent Reproduction: LOC-03's round-2 residual (separator-containing shape) is now closed

Reproduced directly against the current tree, using the identical repro round 2 used to report
the defect (a same-named decoy `x64sc` on `PATH`, an absolute, nonexistent `VICE_BIN`):

```
$ node --input-type=module -e '
import { resolveTool } from "./tool-location.mts";
const d = "<scratch dir with an executable x64sc on PATH>";
const r = resolveTool("x64sc", {
  toolsDir: d+"/empty", projectRoot: d+"/empty",
  env: { VICE_BIN: "/definitely/does/not/exist/x64sc", PATH: d+"/bin" }
});
console.log(JSON.stringify(r, null, 2));
'
{
  "id": "x64sc",
  "path": null,
  "tried": ["/definitely/does/not/exist/x64sc"],
  "layer": null,
  "mechanism": null,
  "refusal": "\"x64sc\"'s VICE_BIN environment variable is set to \"/definitely/does/not/exist/x64sc\", which did not resolve to an executable file (tried: /definitely/does/not/exist/x64sc); the seam will not fall back to searching $PATH for \"x64sc\" itself, because that could start a different binary than the one VICE_BIN named",
  "envCandidate": "/definitely/does/not/exist/x64sc"
}
```

The decoy is no longer returned; `path` is `null`; `refusal` names `VICE_BIN` and quotes the
value verbatim. This matches plan 60-08's claim and closes the exact hazard round 2 traced back
(via `git show d54d98a1:src/mcp/vice/backend-detect.mts`) to a same-phase regression in plan
60-01. Source read confirms the mechanism: in `tool-location.mts`'s Layer 1 block,
`envUnresolved = true` now sits AFTER the separator-gated `$PATH`-walk block, unconditional on
the value's shape — the walk itself stays gated to `!envValue.includes("/") && record.kind ===
"executable"`, but the refusal-triggering assignment does not. This is the surviving
distinction plan 60-08's own SUMMARY and 60-REVIEW.md both describe, and it is what the source
actually shows.

PD-14 (tools.json still gets its say after an unresolved env value) also confirmed still true:
with the same absolute unresolvable `VICE_BIN` but a valid `tools.json` entry present, the file
layer answers and wins (`layer: "file"`, `mechanism: "tools.json"`), not a refusal.

### Independent Reproduction: WR-03 (code review's own finding) is now closed

```
$ node --input-type=module -e '
import { resolveTool } from "./tool-location.mts";
console.log(resolveTool("ghidra", { toolsDir: "<empty>", projectRoot: "<empty>", env: { GHIDRA_HOME: "ghidra-bare-name", PATH: "" } }).refusal);
console.log("---");
console.log(resolveTool("x64sc", { toolsDir: "<empty>", projectRoot: "<empty>", env: { VICE_BIN: "vice-bare-decoy-name", PATH: "" } }).refusal);
'
"ghidra"'s GHIDRA_HOME environment variable is set to "ghidra-bare-name", which did not resolve
to a directory carrying its required marker (support/analyzeHeadless) (tried: ghidra-bare-name);
resolution is terminal for GHIDRA_HOME, and .c64-re-tools/tools.json was consulted and had
nothing to say for "ghidra" either
---
"x64sc"'s VICE_BIN environment variable is set to "vice-bare-decoy-name", which did not resolve
to an executable file (tried: vice-bare-decoy-name); the seam will not fall back to searching
$PATH for "x64sc" itself, because that could start a different binary than the one VICE_BIN named
```

The directory-kind (`ghidra`) refusal no longer claims a `$PATH`-substitution protection that
cannot structurally apply to it (Layer 3 has no probe for a directory-kind id, D-15); the
executable-kind (`x64sc`) refusal still carries the `$PATH`-shadowing clause, correctly, since
Layer 3's probe is real for it. This matches `buildEnvLayerRefusal()`'s `record.kind` branch
read directly at `tool-location.mts` and matches 60-REVIEW.md's own independent confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/tool-location.mts` | The seam: `resolveTool`, `resolveOnPath`, `validateToolsFile`, `toolsFileTemplate`, `remedyTextsFor`, plus a terminal-for-both-shapes environment layer and kind-branched refusal message | ✓ VERIFIED | `envUnresolved` assignment confirmed unconditional (not gated on `/`); `buildEnvLayerRefusal()` confirmed kind-branched. Both read directly from source, not inferred from comments. |
| `src/mcp/vice/tool-location.test.ts` | New `Plan 60-08` tests proving the refusal, walk-gate survival, positive control, PD-14, compiled artifact, kind-correct message pair, declaration-enumerated invariant, concurrency | ✓ VERIFIED | All read directly; each asserts the specific outcome it claims (e.g. Test 10 enumerates `prerequisites.json`'s own `envVar`-carrying ids rather than a hand-typed list). |
| `src/mcp/vice/vice-broker-acquire.test.ts` | "Plan 60-01 Test 4" rewritten in place with outcome reversed but stated surviving intents kept; a new tracer test through `handleAcquire()`'s real cold-spawn call | ✓ VERIFIED | Read directly: asserts `path/layer/mechanism === null`, a named refusal, and the decoy `notEqual` to the returned path. Tracer test ("Plan 60-08 Test 1b") confirms the real `spawn()` call receives the developer's own unresolved value, never the decoy. |
| `resources/tool-location.mjs` (regenerated, committed) | Byte-identical to a fresh build, terminal refusal and kind-correct message reachable from the compiled artifact | ✓ VERIFIED | `resources-sync.test.ts` green in the combined run below. |
| `.planning/phases/.../evidence/phase60-loc03-terminal-env-set-diff.md` | A third committed full-suite failing-set-difference evidence note, comparing SETS not counts, naming the closed carried-forward limit | ✓ VERIFIED | Present; uses `comm -13`/`comm -23` for an actual set difference (not a count comparison); baseline `d7d5a151` (4020/3931/7 fail/82 skip) vs. post-round `2cf21509` (4032/3951/0 fail/81 skip); regression list empty; both deliberate reversals named under old and new assertions. |
| `.planning/REQUIREMENTS.md` | `LOC-03` marked `Complete` | ✓ VERIFIED | Confirmed at line 125 (`LOC-03 \| Phase 60 \| Complete`), matching the codebase evidence this round (unlike round 2, where this verification disagreed with the written status — that disagreement is now resolved). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `prerequisites.json` | `vice-broker.mts` real spawn | `resolveTool("x64sc")` → `resolvedBackend()` → `HandleAcquireDeps.viceBin` → `spawn()` | ✓ WIRED | Confirmed at `vice-broker.mts:1265,1310`; unchanged since round 2. |
| `tool-location.mts` env layer (either shape) | Real spawn | `resolveTool()`'s Layer 1, both steps, terminal `envUnresolved` refusal | ✓ WIRED, CORRECT | Both the slash-free (round 1/2) and separator-containing (this round) shapes now refuse honestly rather than substituting a decoy; traced end to end through `vice-broker-acquire.test.ts`'s tracer tests including the new "Plan 60-08 Test 1b" real cold-spawn probe. |
| `.c64-re-tools/tools.json` | `findSiblingBinary()`'s refusal message | `resolveTool()`'s `refusal` field → memo → refusal-first branch | ✓ WIRED | Unchanged since round 2 (WR-01, plan 60-07). |
| `prerequisites.json` `remedies` | Every refusal site | `remedyTextsFor()` | ✓ WIRED | Unchanged since round 2. |
| `tool-location.mts`'s `buildEnvLayerRefusal()` | Refusal message text | `record.kind` branch | ✓ WIRED, CORRECT | Directory-kind ids (`ghidra`, `acme-lib`) no longer claim a `$PATH`-substitution protection that cannot apply; executable-kind ids still do. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Env-var override, separator-containing, resolves nowhere, decoy present | Direct `resolveTool()` call, injected `PATH` with a same-named decoy | Refuses by name; `path: null`; decoy never returned | ✓ PASS (previously FAIL in round 2) |
| Env-var override, separator-containing, resolves to a real value | Direct `resolveTool()` call | Resolves outright through the env layer | ✓ PASS |
| PD-14: separator-containing unresolvable env value, valid `tools.json` entry present | Direct `resolveTool()` call | File layer answers and wins, no refusal | ✓ PASS |
| Directory-kind env var (`GHIDRA_HOME`), bare, unresolved | Direct `resolveTool()` call | Refuses; message no longer claims a `$PATH`-substitution risk | ✓ PASS (previously WARNING in round 2, WR-03) |
| Executable-kind env var (`VICE_BIN`), bare, unresolved | Direct `resolveTool()` call | Refuses; message still carries the `$PATH`-shadowing clause | ✓ PASS |
| Combined targeted-file run (`tool-location.test.ts`, `vice-broker-acquire.test.ts`, `host-tool.test.ts`, `backend-detect.test.ts`, `tool-location-consumers.test.ts`, `resources-sync.test.ts`) | `node --test --test-reporter=tap <files>`, no live broker | 296/296 pass | ✓ PASS |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| No debt markers in this round's changed files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` on `tool-location.mts`, `tool-location.test.ts`, `vice-broker-acquire.test.ts`, `resources/tool-location.mjs` | no matches | ✓ PASS |
| No uncommitted drift in this round's files | `git status --short` on the same files plus `REQUIREMENTS.md` | empty | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and none is named in its plans
or SUMMARYs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| LOC-01 | 60-01, 60-03 | Every code path that resolves a tool honours `tools.json` | ✓ SATISFIED | `vice-broker.mts`, `host-tool.mts` seam calls, `findSiblingBinary()`. Unchanged, regression-checked. |
| LOC-02 | 60-01, 60-05 | One resolver seam owns the precedence order | ✓ SATISFIED | `tool-location-consumers.test.ts` re-run, passes. |
| LOC-03 | 60-01, 60-03, 60-05, 60-06, 60-07, 60-08 | Existing env-var overrides still win, unchanged behaviour, both value shapes | ✓ SATISFIED | Both the slash-free (round 1/2) and separator-containing (this round) substitution hazards are closed and independently reproduced fixed. `.planning/REQUIREMENTS.md` marks this `Complete`; this verification's independent codebase check now agrees. |
| LOC-04 | 60-04, 60-07 | `c1541`/`petcat` locatable via the file | ✓ SATISFIED | Unchanged since round 2. |
| DECL-03 | 60-02, 60-03, 60-04, 60-07 | Live refusal and doctor share one remedy source | ✓ SATISFIED | Unchanged since round 2. |

No orphaned requirements: all five phase-declared IDs appear in at least one plan's
`requirements:` frontmatter, and REQUIREMENTS.md maps no additional ID to Phase 60.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/host-tool.mts` | `findAcmeLib()` (~2444-2452) | Discards the seam's `refusal` entirely rather than surfacing it (unlike every sibling consumer touched by this phase) | ℹ️ Info | Pre-existing (IN-02), unrelated to plan 60-08's diff; no longer masks a wrong message now that WR-03 is fixed (per 60-REVIEW.md's own updated disposition). Not a functional defect. |
| `src/mcp/vice/host-tool.mts` | 2482-2528 | `findSiblingBinary()`'s process-lifetime memo remains inconsistent with the seam's own no-memo posture (WR-02) | ⚠️ Warning | Deliberately recorded as an open, unresolved tension per PD-18; a process restart is needed for an edited `tools.json` to take effect for `c1541`/`petcat` only. Carried forward as intentionally open, not re-litigated this round (unrelated to plan 60-08's diff). |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in this round's changed files
(`tool-location.mts`, `tool-location.test.ts`, `vice-broker-acquire.test.ts`,
`resources/tool-location.mjs`).

### Human Verification Required

1. **ACME_BIN pointed at a nonexistent absolute path, `acme.build` invoked, refusal checked
   against the UPDATED expectation**
   **Test:** Point `ACME_BIN` at a path that does not exist, invoke the `acme.build` route. Then,
   separately, unset `ACME_BIN` entirely with ACME genuinely absent.
   **Expected:** After this round's fix, the absolute-path case now hits the seam's
   environment-layer terminal refusal (previously it fell through to a `$PATH` probe for the
   literal id — the very defect this round closed). Expect a refusal quoted verbatim naming
   `ACME_BIN` and the value, with no remedy appended. The genuinely-absent case should carry the
   declaration's remedy text verbatim.
   **Why human:** Needs a real host with ACME moved aside; deferred by plans 60-03/60-07/60-08's
   own `<human-check>` blocks under `workflow.human_verify_mode: end-of-phase`. Not run by any
   executor across all three gap-closure rounds of this phase.

2. **Real stock `x64sc` recorded in `tools.json`, broker started as its systemd unit; and a bare
   `$PATH`-resolved `VICE_BIN`**
   **Test:** Record a real stock `x64sc` path in `.c64-re-tools/tools.json`, start the broker as
   its systemd unit, confirm via process args or the broker's own log line that the spawned
   binary is the recorded path. Separately, set `VICE_BIN` to a bare filename on `$PATH` and
   confirm the broker spawns that binary.
   **Expected:** The real child process's argv matches the recorded path in the first case, and
   the bare-name-resolved binary in the second.
   **Why human:** Needs a real systemd-launched broker against a real recorded path and a real
   installed emulator; deferred by plans 60-05/60-07/60-08's own `<human-check>` blocks. Not run
   by any executor across all three gap-closure rounds of this phase.

### Gaps Summary

**No gaps remain.** Round 2's residual — a separator-containing (absolute-path)
`VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME` value that resolves to nothing still silently
substituting a same-named `$PATH` binary — is closed by plan 60-08, independently confirmed
against the live tree using the identical reproduction method round 2 used to report it. The
mechanism is a genuine, targeted fix, not a broadened refusal that also swallows valid cases:
PD-14 (tools.json still gets a say after an unresolved env value) and the positive control (a
separator-containing value that resolves still wins outright) both hold, confirmed directly.

The two shipped tests plan 60-08 rewrote in place (`vice-broker-acquire.test.ts`'s "Plan 60-01
Test 4" and `tool-location.test.ts`'s separator-containing case) are genuine corrections, not
gutted assertions: both retain their originally-stated surviving intents (agreement across two
calls in one process; the environment candidate tried before any `$PATH` candidate — now
vacuously true since no such candidate exists once a variable is set and left unresolved) while
their outcome assertions are reversed to the corrected contract, with the reversal recorded on
the record (module header, evidence note, SUMMARY) as a correction of a same-phase regression
rather than left as an unexplained flip. This verification independently confirmed the reversal
is warranted by reading `tool-location.mts`'s actual Layer 1 code, not by trusting the SUMMARY's
characterization.

The code review's own WR-03 finding (a directory-kind id's refusal falsely claiming a
`$PATH`-substitution risk) is also closed, independently confirmed by direct reproduction
contrasting a directory-kind (`ghidra`) and executable-kind (`x64sc`) refusal message.

The full suite (4032 tests, 3951 pass, 0 fail, 81 skipped per the orchestrator's own measurement,
independently corroborated by this verification's own 296/296 combined targeted run) and
`npm run typecheck` (exit 0) are both clean. `resources/tool-location.mjs` is regenerated,
committed, and confirmed in sync. `.planning/REQUIREMENTS.md` marking all five requirement IDs
`Complete` is, for the first time across this phase's three verification rounds, independently
corroborated rather than disputed by the codebase evidence.

**Status is `human_needed`, not `passed`,** because two human-verification items remain open —
both deferred since plans 60-03/60-05, restated by every subsequent gap-closure plan including
60-08, and not run by any executor across all three rounds of this phase. Neither blocks the
phase goal's codebase evidence (both are live-hardware/live-systemd confirmations of behavior
already proven at the unit and integration-tracer level), but per this verifier's own decision
tree, a non-empty human-verification section routes to `human_needed` even when every truth is
independently VERIFIED. These should be run — or explicitly waived by the project owner — before
this phase is considered fully closed out, since this project's own standing practice is to
live-test against a genuine, unpatched `/usr/bin/x64sc` rather than defer indefinitely.

---

_Verified: 2026-09-18T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
