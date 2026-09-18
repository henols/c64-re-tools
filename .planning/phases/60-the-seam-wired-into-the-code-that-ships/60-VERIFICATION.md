---
phase: 60-the-seam-wired-into-the-code-that-ships
verified: 2026-09-18T18:20:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files: [".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-REVIEW.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-suite-set-diff.md", "src/mcp/vice/tool-location.mts", "src/mcp/vice/backend-detect.mts", "src/mcp/vice/vice-broker.mts", "src/mcp/vice/broker-launch.mts", "src/mcp/vice/vice-proxy.ts", "src/mcp/vice/host-tool.mts", "src/mcp/vice/host-tool-client.ts", "src/mcp/vice/acme-verify.ts", "src/mcp/vice/tool-location-consumers.test.ts"]
covered_digest: "v1:sha256:931bc52c74fda2b4b71fdef1e46d5e885c8909077c1c80c56a784f08ba5713fe"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "An existing VICE_BIN, ACME_BIN, ACME or GHIDRA_HOME override still wins over tools.json, so no current developer setup, test invocation or CI step changes behaviour (LOC-03 / the phase goal's own closing sentence)."
    status: failed
    reason: "The seam's environment layer (tool-location.mts's Layer 1) calls matchesDeclaredKind(envValue), which statSync()s the literal env-var string. A slash-free value (e.g. VICE_BIN=x64sc-custom, ACME_BIN=acme-custom) is resolved against process.cwd(), not $PATH, so it almost never stats successfully for a long-running broker/executor. The layer then reports 'not matched' (not refused) and resolution silently falls through to Layer 3, which walks $PATH for the DECLARED TOOL ID ITSELF (\"x64sc\"/\"acme\") -- a different string than what the user's env var named. If a same-named binary is also on $PATH, a DIFFERENT binary is silently spawned with refusal: null and no diagnostic. This is a regression from pre-phase behaviour: broker-launch.mts previously handed a bare VICE_BIN straight to spawn() (OS-level $PATH search), and backend-detect.mts's old defaultResolveBinPath() had an explicit bin.includes(\"/\") branch that walked $PATH for a slash-free bin -- both worked. Independently reproduced (see evidence below), matching the code-review's CR-01 finding verbatim. No test in the tree (tool-location.test.ts, vice-broker-acquire.test.ts, host-tool.test.ts, backend-detect.test.ts) exercises a slash-free VICE_BIN/ACME_BIN value, so the green full-suite run is not evidence against this."
    artifacts:
      - path: "src/mcp/vice/tool-location.mts"
        issue: "Lines ~572-585 (Layer 1, the environment): matchesDeclaredKind() calls statKind() directly on the raw env value with no $PATH fallback for a slash-free candidate, and Layer 3 (~685-691) probes $PATH for the declared id, never for the user's env-var value, once Layer 1 fails to match."
    missing:
      - "Either widen the environment layer to fall back to a $PATH search of the env value itself when it contains no '/' and does not stat directly (mirroring resolveOnPath()'s existing bin.includes(\"/\") branch), or make the non-match a terminal refusal (never fall through to Layer 3's literal-id $PATH probe when an env var was set but unresolvable) so the failure is loud rather than a silent substitution."
      - "A test using a slash-free VICE_BIN/ACME_BIN value resolved via an injected PATH, covering both the 'no PATH match at all' and the 'a same-named-but-different binary sits on PATH' cases."
advisory: []
human_verification:
  - test: "Point ACME_BIN at a path that does not exist, invoke the acme.build route, and confirm the refusal names acme.build, states the binary was not found, and carries the declaration's remedy text verbatim rather than a raw OS spawn error."
    expected: "A named refusal citing the declaration's remedy, not a raw spawn ENOENT."
    why_human: "Needs a real host with a real ACME install moved aside; deferred by plan 60-03's own <human-check> block (workflow.human_verify_mode: end-of-phase) rather than automated."
  - test: "Record a real stock x64sc path in .c64-re-tools/tools.json, start the broker as its systemd unit, and confirm from the process arguments or the broker's own launch log line that the spawned binary is the recorded path, not whatever $PATH would have supplied."
    expected: "The systemd-launched broker's real child process argv matches the tools.json-recorded path."
    why_human: "Needs a real broker process running as its systemd unit against a real recorded path; deferred by plan 60-05's own <human-check> block, since the automated integration tests can only assert the resolved path threads to the spawn call in-process, not that a real emulator process started with it."
---

# Phase 60: The Seam Wired Into the Code That Ships Verification Report

**Phase Goal:** The seam stops being a module with tests and becomes the only way this
project finds a tool. Every live resolution goes through it, every live remedy message comes
from the declaration, and a developer whose setup, test invocation or CI step sets `VICE_BIN`,
`ACME_BIN`, `ACME` or `GHIDRA_HOME` notices nothing whatsoever.

**Verified:** 2026-09-18T18:20:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LOC-01: A path recorded in `.c64-re-tools/tools.json` is honoured by the code that actually spawns/resolves the tool, not only by a test calling the seam directly. | VERIFIED | `vice-broker.mts:1253` now threads `viceBin: resolvedViceBin` into the real `onAcquire` -> `handleAcquire()` call — this was found BROKEN by plan 60-05's own required full-suite baseline diff (LOC-01 silently failing in production while 60-01's own summary claimed the path was wired) and is fixed at commit `ce890041`. `host-tool.mts` resolves `acme`/`acme-lib`/`ghidra` through `resolveTool()` (confirmed by direct read, lines ~1395-1404 and `ghidra-project.mts`) and `findSiblingBinary()` gains a `tools.json` layer ahead of the sibling probe for `c1541`/`petcat` (confirmed by direct read, `host-tool.mts:2515-2528`). |
| 2 | LOC-02: The precedence order exists in exactly one place — no callsite under `src/mcp/vice` keeps its own ordering, verified mechanically rather than by care. | VERIFIED | `tool-location-consumers.test.ts` run directly: 9/9 pass, including the non-vacuity/control cases (Tests 4-8) proving the scan actually detects a real env read and ignores a comment/string mention. The three non-ACME_BIN closed sets are empty; the ACME_BIN set contains exactly the one declared test-only exception (`acme-gate.ts`). |
| 3 | LOC-03: `VICE_BIN`, `ACME_BIN`, `ACME` and `GHIDRA_HOME` still win over the file, so no current developer setup, test invocation or CI step changes behaviour. | ✗ FAILED | Independently reproduced (below). A slash-free env-var value (the shape many real setups use) is silently dropped by the seam's environment layer and resolution falls through to a `$PATH` search of the bare *declared tool id*, not the user's value — silently spawning a different binary with `refusal: null`, or silently discarding the override entirely. This is a regression from pre-phase behaviour and directly contradicts this truth and the phase goal's own closing sentence. See Gaps Summary. |
| 4 | LOC-04: `c1541` and `petcat` become locatable via `.c64-re-tools/tools.json` for the first time, while the sibling probe and its `$PATH`-shadowing warning stay intact for the case the file says nothing. | VERIFIED | `host-tool.mts:2497-2528` (`findSiblingBinary()`): Layer 1 (seam/`tools.json`, `layer === "file"` only), Layer 2 (sibling-of-`x64sc`), Layer 3 (seam's own `resolveOnPath()`). Code review found no defect in the ordering itself (only two lower-severity quality issues, WR-01/WR-02, neither of which breaks the LOC-04 truth). |
| 5 | DECL-03: A live refusal and the doctor cannot name different remedies for the same tool, because every refusal site reads the declaration's remedy prose at call time. | VERIFIED | `remedyTextsFor()` exported at `tool-location.mts:789`; `tool-location.test.ts` (68/68 pass) exercises non-vacuity (a mutated scratch declaration changes the returned text), ordering, empty cases and non-ASCII byte-identity. Wired into `host-tool.mts`'s acme/ghidra/dxa/c1541/petcat refusal sites per the 60-03/60-04 summaries and confirmed present in the diff the code review scanned. `resources-sync.test.ts` green (2/2) against the regenerated `resources/tool-location.mjs`. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Independent Reproduction of the LOC-03 Gap (CR-01)

Reproduced directly against the current tree (not merely re-stated from the code review):

```
$ node --input-type=module -e '
import { resolveTool } from "./tool-location.mts";
const env = { VICE_BIN: "x64sc-custom", PATH: "<dir with an executable x64sc-custom AND a decoy x64sc>:/usr/bin:/bin" };
console.log(JSON.stringify(resolveTool("x64sc", { toolsDir: "<empty>", projectRoot: "<empty>", env }), null, 2));
'
{
  "id": "x64sc",
  "path": "<dir>/x64sc",              // the DECOY, not x64sc-custom
  "tried": ["x64sc-custom", "<dir>/x64sc"],
  "layer": "probe",
  "mechanism": "$PATH",
  "refusal": null
}
```

The identical shape reproduces for `ACME_BIN=acme-custom` against `resolveTool("acme", ...)`.
Both runs are recorded in this session's scratch output; the finding matches the code review's
CR-01 verbatim and is not fixed by any commit after the review (`git log` shows no commits
after `546782a2` touching `src/mcp/vice/`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/tool-location.mts` | The seam: `resolveTool`, `resolveOnPath`, `validateToolsFile`, `toolsFileTemplate`, `remedyTextsFor` | ✓ VERIFIED (substantively, but see CR-01) | All five exports present and exercised by `tool-location.test.ts` (68 tests, green). Env layer contains the LOC-03 defect above. |
| `src/mcp/vice/backend-detect.mts` | `resolvedBackend()` resolves through the seam | ✓ VERIFIED | Confirmed via `grep`/read: no local `VICE_BIN`/emulator env-var read remains outside the seam (closed-consumer-set scan). |
| `src/mcp/vice/vice-broker.mts` | Real spawn wiring threads the resolved `viceBin` | ✓ VERIFIED | `viceBin: resolvedViceBin` present in the real `onAcquire` deps object (line 1253), the fix from plan 60-05's own regression discovery. |
| `src/mcp/vice/broker-launch.mts` | Pure consumer of `deps.viceBin`, no env fallback | ✓ VERIFIED | Confirmed absent from the closed-consumer-set's four expected arrays (empty set for `VICE_BIN`). |
| `src/mcp/vice/host-tool.mts` | `acme`/`acme-lib`/`ghidra`/`c1541`/`petcat` resolved through the seam; refusals carry declared remedies | ✓ VERIFIED | `resolveTool()` calls present at the acme/ghidra branches and inside `findSiblingBinary()`; `remedyTextsFor()` wired into refusal composition (`withRemedy()` per summary). |
| `src/mcp/vice/tool-location-consumers.test.ts` | Closed-consumer-set structural scan | ✓ VERIFIED | 9/9 tests pass, run directly. |
| `resources/*.mjs` (regenerated, committed) | Byte-identical to a fresh build | ✓ VERIFIED | `resources-sync.test.ts` (2/2) run directly, green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `prerequisites.json` | `vice-broker.mts` real spawn | `resolveTool("x64sc")` → `resolvedBackend()` → `HandleAcquireDeps.viceBin` → `spawn()` | ✓ WIRED | Confirmed at `vice-broker.mts:1253`; this link was broken until `ce890041` (found by plan 60-05's own full-suite diff), now fixed. |
| `tool-location.mts` env layer | Real spawn | `resolveTool()`'s Layer 1 env match | ⚠️ WIRED BUT DEFECTIVE | Wired (the code path runs), but its behaviour for a slash-free override value is wrong — see LOC-03 gap above. Not a missing link; a wrong one. |
| `prerequisites.json` `remedies` | Every refusal site | `remedyTextsFor()` | ✓ WIRED | Confirmed present at acme/ghidra/dxa/c1541/petcat refusal composition per direct read and the 68-test `tool-location.test.ts` suite. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Env-var override with an absolute path still wins over `tools.json` | `tool-location.test.ts` fixtures (all absolute-path shaped) | 68/68 pass | ✓ PASS |
| Env-var override with a slash-free (bare) value | Direct `resolveTool()` call, injected `PATH` with a decoy same-named binary | Silently resolves to the decoy, `refusal: null` | ✗ FAIL — this is the reported gap |
| Closed consumer set for the four env-var names | `node --test tool-location-consumers.test.ts` | 9/9 pass | ✓ PASS |
| `resources/*.mjs` byte-identical to source | `node --test resources-sync.test.ts` | 2/2 pass | ✓ PASS |
| `remedyTextsFor()` non-vacuity, ordering, empty cases | `node --test tool-location.test.ts` | 68/68 pass | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and none is named in its plans
or SUMMARYs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOC-01 | 60-01, 60-03 | Every code path that resolves a tool honours `tools.json` | ✓ SATISFIED | `vice-broker.mts:1253`, `host-tool.mts` seam calls, `findSiblingBinary()`. |
| LOC-02 | 60-01, 60-05 | One resolver seam owns the precedence order | ✓ SATISFIED | `tool-location-consumers.test.ts`, 9/9 pass. |
| LOC-03 | 60-01, 60-03, 60-05 | Existing env-var overrides still win, unchanged behaviour | ✗ BLOCKED | CR-01 — slash-free env values silently mis-resolve; see gap. |
| LOC-04 | 60-04 | `c1541`/`petcat` locatable via the file | ✓ SATISFIED | `host-tool.mts` sibling-probe widening. |
| DECL-03 | 60-02, 60-03, 60-04 | Live refusal and doctor share one remedy source | ✓ SATISFIED | `remedyTextsFor()`, wired into refusal sites. |

No orphaned requirements: all five phase-declared IDs (`LOC-01`, `LOC-02`, `LOC-03`, `LOC-04`,
`DECL-03`) appear in at least one plan's `requirements:` frontmatter, and REQUIREMENTS.md maps
no additional ID to Phase 60 beyond these five.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/tool-location.mts` | ~572-585, ~685-691 | Silent fall-through from an unmatched env-var layer to a `$PATH` probe of the *declared id*, not the user's value | 🛑 Blocker | Silently substitutes a different binary, or silently discards a bare env-var override, for the exact developer setups LOC-03 promises are unaffected (CR-01, independently reproduced). |
| `src/mcp/vice/host-tool.mts` | 2515-2528 | `findSiblingBinary()` discards the seam's specific file-layer refusal reason for `c1541`/`petcat`, reporting a generic "does not exist" | ⚠️ Warning | User with a malformed `tools.json` entry (e.g. missing chmod +x) sees the wrong remedy category (WR-01 from code review). Does not block LOC-04's core truth. |
| `src/mcp/vice/host-tool.mts` | 2482-2528 | `findSiblingBinary()`'s process-lifetime memo caches the seam's `tools.json` answer, inconsistent with `findAcmeLib()`'s no-memo posture and the seam's own stated "never cache a location" rationale | ⚠️ Warning | An edited `tools.json` has no effect for `c1541`/`petcat` until process restart, while it does for `acme`/`ghidra` (WR-02 from code review, confirmed deliberate and tested). |
| `src/mcp/vice/backend-detect.mts` | 404-419 | `viceBin` display name is hardcoded to the literal `"x64sc"` regardless of which layer answered | ℹ️ Info | Documented as deliberate; only a reader confusion risk (IN-01 from code review). |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in the phase's changed files.

### Human Verification Required

1. **ACME_BIN pointed at a nonexistent path, `acme.build` invoked, refusal checked**
   **Test:** Point `ACME_BIN` at a path that does not exist, invoke the `acme.build` route.
   **Expected:** A refusal naming `acme.build`, stating the binary was not found, carrying the
   declaration's remedy text verbatim — not a raw OS spawn error.
   **Why human:** Needs a real host with ACME moved aside; deferred by plan 60-03's own
   `<human-check>` block under `workflow.human_verify_mode: end-of-phase`.

2. **Real stock `x64sc` recorded in `tools.json`, broker started as its systemd unit**
   **Test:** Record a real stock `x64sc` path in `.c64-re-tools/tools.json`, start the broker
   as its systemd unit, confirm via process args or the broker's own log line that the spawned
   binary is the recorded path.
   **Expected:** The real child process's argv matches the recorded path, not a `$PATH` match.
   **Why human:** Needs a real systemd-launched broker against a real recorded path; deferred
   by plan 60-05's own `<human-check>` block — the automated tests can only prove the resolved
   path threads to the spawn call in-process, not that a real process started with it.

### Gaps Summary

One blocking gap: **LOC-03 is not actually true for the class of override value real
developer setups commonly use.** The phase's own closing goal sentence — "a developer whose
setup, test invocation or CI step sets `VICE_BIN`, `ACME_BIN`, `ACME` or `GHIDRA_HOME` notices
nothing whatsoever" — is falsified for any such setup that names a bare, `$PATH`-resolved
executable rather than an absolute path. Pre-phase, this class of value worked (the OS's own
`spawn()` PATH search, and `backend-detect.mts`'s own former explicit `$PATH` walk for a
slash-free name). Post-phase, through the seam, it is silently dropped and resolution falls
through to a `$PATH` probe of the *declared tool id* — not the user's value — which can spawn
an entirely different binary with no refusal, no warning, and no log line naming the
discrepancy. This was raised by the phase's own code review (CR-01) as a Critical finding, was
independently reproduced here against the current tree (no fix has landed since the review),
and is untested anywhere in the suite (every existing fixture uses an absolute path), which is
exactly why the green 3996/3915/0/81 full-suite run is not evidence against it.

Everything else — LOC-01, LOC-02, LOC-04, and DECL-03 — is genuinely wired and verified: the
two production regressions plan 60-05's own required full-suite diff caught (the missing
`viceBin` thread into the broker's real `onAcquire`, and the missing `prerequisites.json`
deploy copy) are both fixed and covered by real tests, the closed-consumer-set scan is
non-vacuous and green, and `remedyTextsFor()` is a real, tested, wired declaration reader. Two
items are deferred to human verification per the plans' own design (not automatable), and
should be run before this phase is considered closed even after the LOC-03 gap is fixed.

Suggested fix path for the LOC-03 gap (from the code review, concurred with): either (a) widen
the environment layer to fall back to a `$PATH` search of the env value itself when it
contains no `/` and does not stat directly (mirroring `resolveOnPath()`'s own
`bin.includes("/")` branch), or (b) make the non-match a hard refusal rather than a silent
fall-through to the declared-id `$PATH` probe. Either fix should ship with a test using a
slash-free `VICE_BIN`/`ACME_BIN` value resolved via an injected `PATH`.

---

_Verified: 2026-09-18T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
