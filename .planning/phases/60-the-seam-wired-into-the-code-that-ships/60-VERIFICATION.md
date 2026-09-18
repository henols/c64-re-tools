---
phase: 60-the-seam-wired-into-the-code-that-ships
verified: 2026-09-18T19:40:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-01-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-02-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-03-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-04-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-05-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-06-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-06-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-07-PLAN.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-07-SUMMARY.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/60-REVIEW.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-gap-closure-suite-set-diff.md", ".planning/phases/60-the-seam-wired-into-the-code-that-ships/evidence/phase60-suite-set-diff.md", "docs/phase58-declaration-provenance.md", "docs/phase59-tool-location-placement.md", "src/mcp/vice/acme-verify.ts", "src/mcp/vice/backend-detect.mts", "src/mcp/vice/backend-detect.test.ts", "src/mcp/vice/broker-launch.mts", "src/mcp/vice/host-tool-client.ts", "src/mcp/vice/host-tool.mts", "src/mcp/vice/host-tool.test.ts", "src/mcp/vice/resources/backend-detect.mjs", "src/mcp/vice/resources/host-tool.mjs", "src/mcp/vice/resources/tool-location.mjs", "src/mcp/vice/resources/vice-broker.mjs", "src/mcp/vice/tool-location-consumers.test.ts", "src/mcp/vice/tool-location.mts", "src/mcp/vice/tool-location.test.ts", "src/mcp/vice/vice-broker-acquire.test.ts", "src/mcp/vice/vice-broker.mts", "src/mcp/vice/vice-proxy.ts"]
covered_digest: "v1:sha256:ff5d103b29940681606c0794a86240776f183663a28f312c3134217d536e3b6f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "LOC-03 (partial): a slash-free VICE_BIN/ACME_BIN/ACME/GHIDRA_HOME override that resolves
      nowhere no longer silently substitutes a same-named $PATH binary — it now refuses by name
      (Plan 60-06). Independently reproduced fixed."
    - "WR-01 (code review): a malformed tools.json entry for c1541/petcat now carries the seam's
      own specific reason instead of a generic 'does not exist' + wrong-category remedy (Plan
      60-07). Independently reproduced fixed."
  gaps_remaining:
    - "LOC-03 (the requirement itself, not just its originally-reported CR-01 shape): a
      SEPARATOR-CONTAINING VICE_BIN/ACME_BIN/ACME/GHIDRA_HOME override that resolves nowhere
      still silently substitutes a same-named $PATH binary with refusal: null — the identical
      substitution hazard, for the other input shape. This was deliberately left in place by plan
      60-06 to keep vice-broker-acquire.test.ts's 'Plan 60-01 Test 4' green, but that test itself
      pins a REGRESSION introduced by this same phase (plan 60-01), not genuinely pre-phase
      behaviour — see Gaps Summary below for the independent trace proving this."
  regressions: []
gaps:
  - truth: "LOC-03: An existing VICE_BIN, ACME_BIN, ACME or GHIDRA_HOME override still wins over
      tools.json, so no current developer setup, test invocation or CI step changes behaviour."
    status: partial
    reason: "The slash-free half of the substitution hazard (CR-01, the originally-reported shape)
      is genuinely fixed. The separator-containing half of the identical hazard is not: an
      absolute-path override that resolves to nothing (a stale path after a reinstall or a move —
      a real developer-setup shape, not a synthetic one) still falls through silently to a $PATH
      search for the declared tool id and can return a completely different binary with
      refusal: null. This is independently reproducible against the current tree (see Gaps
      Summary) and is traced, by direct comparison against the pre-Phase-60 backend-detect.mts
      (commit d54d98a1), to be a REGRESSION plan 60-01 itself introduced when resolvedBackend()
      was rewired through the seam — not a pre-existing behaviour LOC-03's own text asks this
      phase to leave alone. Plan 60-06 knowingly preserved it to keep a same-phase test green,
      characterising that test as pinning pre-existing behaviour when it does not."
    artifacts:
      - path: "src/mcp/vice/tool-location.mts"
        issue: "Lines ~665-674 (the Layer 1 envUnresolved gate): `envUnresolved` is set only
          `if (!envValue.includes(\"/\"))`, so a separator-containing value that fails
          matchesDeclaredKind() never sets envUnresolved and therefore never reaches the terminal
          refusal at ~lines 801-810 -- it falls through in silence to Layer 3's declared-id $PATH
          probe (~lines 815-822), exactly the CR-01 shape, for the other input class."
    missing:
      - "Either widen the terminal refusal to also cover a separator-containing value that resolves
        to nothing (accepting that 'Plan 60-01 Test 4' pins a regression and must be rewritten, not
        preserved), or explicitly re-scope LOC-03's own text to acknowledge this residual as an
        accepted, permanent limitation rather than leaving it silently unaddressed in a requirement
        marked Complete."
      - "A test using a separator-containing (absolute-path) VICE_BIN/ACME_BIN value that resolves
        to nothing, with a same-named decoy on $PATH, proving no substitution occurs -- the mirror
        of the slash-free case plan 60-06 already covers."
advisory: []
human_verification:
  - test: "Point ACME_BIN at a path that does not exist, invoke the acme.build route, and confirm
      the refusal shape. Per plan 60-07's own carried-forward note: after plan 60-06, an ACME_BIN
      naming a nonexistent ABSOLUTE path is NOT refused by the seam's environment layer (see the
      LOC-03 gap above) and instead falls through to the tools.json layer then the $PATH probe for
      the literal id 'acme' -- record which message is actually produced, since the plan's own
      expectation (a seam refusal with no remedy) may not match what the residual gap produces."
    expected: "A named refusal citing the declaration's remedy for the genuinely-absent case, or a
      seam refusal quoting the value verbatim (no remedy) for an unresolvable one -- not a raw OS
      spawn error and not a silently substituted binary."
    why_human: "Needs a real host with a real ACME install moved aside; deferred by plan 60-03's
      own <human-check> block and restated by plan 60-07's own <human-check> block under
      workflow.human_verify_mode: end-of-phase. Not run by any executor in this phase."
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
      restated by plan 60-07's own <human-check> block. Not run by any executor in this phase."
---

# Phase 60: The Seam Wired Into the Code That Ships Verification Report

**Phase Goal:** The seam stops being a module with tests and becomes the only way this
project finds a tool. Every live resolution goes through it, every live remedy message comes
from the declaration, and a developer whose setup, test invocation or CI step sets `VICE_BIN`,
`ACME_BIN`, `ACME` or `GHIDRA_HOME` notices nothing whatsoever.

**Verified:** 2026-09-18T19:40:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 60-06, 60-07). Previous verification scored
4/5 and failed LOC-03 (CR-01: a slash-free env-var override silently substituted a decoy binary).
This pass finds the slash-free shape genuinely fixed, but an equivalent, previously-unreported
residual in the requirement's separator-containing shape, independently discovered and
reproduced during this re-verification (not carried over from the prior report or from
60-REVIEW.md, which does not flag it as a defect — see Gaps Summary).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LOC-01: A path recorded in `.c64-re-tools/tools.json` is honoured by the code that actually spawns/resolves the tool, not only by a test calling the seam directly. | ✓ VERIFIED (regression check) | `vice-broker.mts:1192,1265,1310` still threads `resolvedViceBin` into the real `onAcquire`/deps object. `host-tool.mts` still resolves `acme`/`acme-lib`/`ghidra`/`c1541`/`petcat` through the seam. Unchanged since the prior pass; no regression found. |
| 2 | LOC-02: The precedence order exists in exactly one place — no callsite under `src/mcp/vice` keeps its own ordering, verified mechanically rather than by care. | ✓ VERIFIED (regression check) | `tool-location-consumers.test.ts` re-run directly: 9/9 pass, unchanged from the prior verification. |
| 3 | LOC-03: `VICE_BIN`, `ACME_BIN`, `ACME` and `GHIDRA_HOME` still win over the file, so no current developer setup, test invocation or CI step changes behaviour. | ✗ FAILED (partial closure) | The slash-free shape (CR-01, the previously-reported defect) is fixed and independently re-verified fixed below. A separator-containing (absolute-path) override that resolves to nothing is NOT fixed: it still silently substitutes a same-named `$PATH` binary with `refusal: null`, independently reproduced against the live tree. See "Independent Reproduction" sections below and Gaps Summary for the trace proving this is a Phase-60-introduced regression, not accepted pre-phase behaviour. |
| 4 | LOC-04: `c1541` and `petcat` become locatable via `.c64-re-tools/tools.json` for the first time, while the sibling probe and its `$PATH`-shadowing warning stay intact for the case the file says nothing. | ✓ VERIFIED | `host-tool.mts`'s `findSiblingBinary()` now also carries a `refusal` field (WR-01 fix, plan 60-07): a malformed `tools.json` entry surfaces the seam's specific reason; a genuinely absent entry still gets today's generic refusal plus the declaration's remedy. Neither change narrows LOC-04's core capability. |
| 5 | DECL-03: A live refusal and the doctor cannot name different remedies for the same tool, because every refusal site reads the declaration's remedy prose at call time. | ✓ VERIFIED (regression check) | `remedyTextsFor()` still exported and wired at `host-tool.mts`'s refusal sites (confirmed at lines 143, 151, 1345-1353, 1609). Unchanged since the prior pass. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Independent Reproduction: the CR-01 fix (slash-free shape) is genuinely closed

```
$ node --input-type=module -e '
import { resolveTool } from "./tool-location.mts";
const d = "<scratch dir>";
const base = { toolsDir: d+"/empty", projectRoot: d+"/empty" };
const hit = resolveTool("x64sc", { ...base, env: { VICE_BIN: "x64sc-custom", PATH: d+"/bin" } });
// hit.path === "<scratch dir>/bin/x64sc-custom" (the developer'"'"'s own binary, not a decoy)
const miss = resolveTool("x64sc", { ...base, env: { VICE_BIN: "x64sc-absent", PATH: d+"/bin" } });
// miss.path === null, miss.refusal names VICE_BIN and "x64sc-absent", no decoy returned
'
```
Both assertions pass. This closes the shape the prior verification reported (CR-01), matching
plan 60-06's own claim.

### Independent Reproduction: LOC-03's residual (separator-containing shape) is NOT closed

Reproduced directly against the current tree, mirroring the prior verification's own reproduction
method but for an absolute-path value instead of a bare one:

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
  "path": "<scratch dir>/bin/x64sc",     // the DECOY, not the developer's own value
  "tried": ["/definitely/does/not/exist/x64sc", "<scratch dir>/bin/x64sc"],
  "layer": "probe",
  "mechanism": "$PATH",
  "refusal": null,
  "envCandidate": "/definitely/does/not/exist/x64sc"
}
```

**Why this is in scope, not a pre-existing limitation LOC-03 accepts:** Diffed against
`backend-detect.mts` as it stood immediately before Phase 60 (`git show d54d98a1:...`), the
pre-phase `defaultResolveBinPath()` for a value containing `/` did exactly this and nothing more:
`resolvePath(bin)`, then `existsSync(abs) ? abs : null` — if not found, it returned `null` with
**no** fallback `$PATH` walk for the bare declared id. `resolvedBackend()`'s pre-phase
`binPathFields(null, viceBin)` then reported `binPath: viceBin` (the literal, nonexistent absolute
path) with `binPathResolved: false`, and `broker-launch.mts` would `spawn()` that literal path —
an honest `ENOENT`, never a substituted binary. The unconditional Layer-3 `$PATH` probe for the
bare declared id (`resolveOnPath(id, env)`, `tool-location.mts:~815-822`) that now answers this
case instead was introduced by plan 60-01 wiring `resolvedBackend()` through the seam, in this
same phase. `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" — the test plan 60-06 preserved
unchanged specifically to justify leaving this case unresolved (per its own SUMMARY's Deviation
#1) — is itself a Phase-60-authored test pinning this newly-introduced behaviour, not a
pre-existing regression control inherited from before the phase. LOC-03's own text ("no current
developer setup... changes behaviour") makes no separator-based carve-out, and a stale absolute
path in a developer's shell profile or CI step (after a reinstall, a container rebuild, or a path
move) is exactly the class of "current developer setup" the requirement is about. This is
therefore judged as the requirement genuinely unmet for this input shape, not merely a documented,
accepted residual — see also 60-REVIEW.md, which reviewed plan 60-06's diff and explicitly did
**not** flag this as a defect (it characterised the same scoping as "exactly the narrow, documented
limit this review's own context names as deliberate and graded"), which this verification
disagrees with on the merits, independent of that characterisation.

### Independent Reproduction: WR-03 (code review's own new finding) is present, unfixed

```
$ node --input-type=module -e '
import { resolveTool } from "./tool-location.mts";
const r = resolveTool("ghidra", { toolsDir: "<empty>", projectRoot: "<empty>", env: { GHIDRA_HOME: "ghidra-bare-name", PATH: "" } });
console.log(r.refusal);
'
"ghidra"'s GHIDRA_HOME environment variable is set to "ghidra-bare-name", which did not resolve
to a directory carrying its required marker (support/analyzeHeadless) (tried: ghidra-bare-name);
the seam will not fall back to searching $PATH for "ghidra" itself, because that could start a
different binary than the one GHIDRA_HOME named
```

Confirmed as 60-REVIEW.md's WR-03 describes: the `$PATH`-substitution clause is factually false
for a `directory`-kind id — Layer 3 never runs for `ghidra`/`acme-lib` regardless (D-15), so there
was never a substitution risk this sentence claims to be declining. Confirmed reachable at a real
call site: `host-tool.mts:1471-1483`'s `ghidra.analyze` branch quotes `ghidraResolved.refusal`
verbatim into the MCP tool's error response.

**Disposition:** this does not break any of the five phase-declared requirements' own graded
truths — LOC-03's must-have (Plan 60-06) only requires that a directory-kind bare value is never
`$PATH`-walked and that it refuses (Test G/H), both of which hold; it says nothing about the
refusal's justification clause being accurate. DECL-03 is about remedy-text provenance, not
refusal-sentence accuracy. This is scored as a Warning (message-accuracy defect reachable at a
live call site, not a functional or safety defect) rather than a Blocker, per the orchestrator's
framing. It is included here as a finding, not folded into the LOC-03 gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/tool-location.mts` | The seam: `resolveTool`, `resolveOnPath`, `validateToolsFile`, `toolsFileTemplate`, `remedyTextsFor`, plus the widened, terminal environment layer and `envCandidate` | ⚠️ VERIFIED WITH RESIDUAL | Widened environment layer present and correct for slash-free values; terminal refusal correctly scoped to slash-free values only per its own header comment — but that same scoping leaves the separator-containing substitution hazard open (see LOC-03 gap). `envUnresolved` also not gated on `record.kind` (WR-03), producing a factually wrong message for directory-kind ids. |
| `src/mcp/vice/backend-detect.mts` | `resolvedBackend()` resolves through the seam, `locationRefusal` and `envCandidate`-derived display name | ✓ VERIFIED | Confirmed present; `viceBin` display name no longer hardcoded to `"x64sc"` (IN-01 closed). |
| `src/mcp/vice/vice-broker.mts` | Real spawn wiring threads the resolved `viceBin`; new startup stderr line on `locationRefusal` | ✓ VERIFIED | `viceBin: resolvedViceBin` present (lines 1265, 1310); additional refusal stderr line confirmed present in diff. |
| `src/mcp/vice/host-tool.mts` | `acme`/`acme-lib`/`ghidra`/`c1541`/`petcat` resolved through the seam; refusals carry declared remedies; `findSiblingBinary()` carries the seam's specific refusal reason (WR-01) | ✓ VERIFIED | `refusal` field confirmed threaded through `findSiblingBinary()`'s memo and both call sites. |
| `src/mcp/vice/tool-location-consumers.test.ts` | Closed-consumer-set structural scan | ✓ VERIFIED | 9/9 pass, re-run directly. |
| `resources/*.mjs` (regenerated, committed) | Byte-identical to a fresh build | ✓ VERIFIED | `resources-sync.test.ts` green, re-run directly as part of the combined 284/284 run below. |
| `.planning/phases/.../evidence/phase60-gap-closure-suite-set-diff.md` | A second, committed full-suite failing-set-difference evidence note | ✓ VERIFIED | Present, well-formed, names both SHAs, both exit statuses, an empty regression list, and the plan-60-06 test rename under both old and new names. Orchestrator-supplied measured facts (3863/3854/0/9 automated; 4020/3939/0/81 full glob) corroborate its own numbers. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `prerequisites.json` | `vice-broker.mts` real spawn | `resolveTool("x64sc")` → `resolvedBackend()` → `HandleAcquireDeps.viceBin` → `spawn()` | ✓ WIRED | Confirmed at `vice-broker.mts:1265,1310`; unchanged since prior pass. |
| `tool-location.mts` env layer (slash-free case) | Real spawn | `resolveTool()`'s widened Layer 1, step 2 | ✓ WIRED, CORRECT | The reported CR-01 defect is closed and traced end to end (`vice-broker-acquire.test.ts`'s Plan 60-06 tracer tests). |
| `tool-location.mts` env layer (separator-containing case) | Real spawn | `resolveTool()`'s Layer 1 (unresolved, `envUnresolved` never set) → Layer 3's declared-id `$PATH` probe | ⚠️ WIRED BUT DEFECTIVE | Wired, but resolves the wrong candidate silently for this input shape — the residual LOC-03 gap. |
| `.c64-re-tools/tools.json` | `findSiblingBinary()`'s refusal message | `resolveTool()`'s `refusal` field → memo → refusal-first branch | ✓ WIRED | WR-01 closed; confirmed by direct read and the 6 new `Plan 60-07` tests. |
| `prerequisites.json` `remedies` | Every refusal site | `remedyTextsFor()` | ✓ WIRED | Unchanged since prior pass. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Env-var override, slash-free, resolves via `$PATH` | Direct `resolveTool()` call, injected `PATH` | Resolves the developer's own named binary, not a decoy | ✓ PASS |
| Env-var override, slash-free, resolves nowhere, decoy present | Direct `resolveTool()` call, injected `PATH` with a same-named decoy | Refuses by name; decoy never returned | ✓ PASS |
| Env-var override, separator-containing (absolute path), resolves nowhere, decoy present | Direct `resolveTool()` call, injected `PATH` with a same-named decoy | **Decoy returned, `refusal: null`** | ✗ FAIL — the reported residual gap |
| Directory-kind env var (`GHIDRA_HOME`), bare, unresolved | Direct `resolveTool()` call | Refuses, but message wrongly claims a `$PATH`-substitution risk that cannot occur for a directory kind | ⚠️ WARNING (WR-03, message accuracy only) |
| `findSiblingBinary()` malformed `tools.json` entry for `c1541` | `host-tool.test.ts` "Plan 60-07 Test 1/2/5" | Seam's own specific reason surfaces, no remedy appended | ✓ PASS |
| `findSiblingBinary()` genuinely absent entry | `host-tool.test.ts` "Plan 60-07 Test 3/4" | Generic refusal plus declaration's remedy, unchanged | ✓ PASS |
| Closed consumer set for the four env-var names | `node --test tool-location-consumers.test.ts` | 9/9 pass | ✓ PASS |
| `resources/*.mjs` byte-identical to source | `node --test resources-sync.test.ts` | green | ✓ PASS |
| Combined targeted-file run (`tool-location.test.ts`, `vice-broker-acquire.test.ts`, `host-tool.test.ts`, `backend-detect.test.ts`, `tool-location-consumers.test.ts`, `resources-sync.test.ts`) | `node --test --test-reporter=tap <files>`, no live broker | 284/284 pass | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and none is named in its plans
or SUMMARYs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| LOC-01 | 60-01, 60-03 | Every code path that resolves a tool honours `tools.json` | ✓ SATISFIED | `vice-broker.mts`, `host-tool.mts` seam calls, `findSiblingBinary()`. Unchanged, regression-checked. |
| LOC-02 | 60-01, 60-05 | One resolver seam owns the precedence order | ✓ SATISFIED | `tool-location-consumers.test.ts`, 9/9 pass, re-run. |
| LOC-03 | 60-01, 60-03, 60-05, 60-06, 60-07 | Existing env-var overrides still win, unchanged behaviour | ✗ BLOCKED | Slash-free shape closed; separator-containing shape independently reproduced still silently substitutes a binary — see gap. REQUIREMENTS.md marks this `Complete`; this verification disagrees on the codebase evidence above. |
| LOC-04 | 60-04, 60-07 | `c1541`/`petcat` locatable via the file | ✓ SATISFIED | `host-tool.mts` sibling-probe widening plus WR-01's specific-reason fix. |
| DECL-03 | 60-02, 60-03, 60-04, 60-07 | Live refusal and doctor share one remedy source | ✓ SATISFIED | `remedyTextsFor()`, wired into refusal sites; unchanged, regression-checked. |

No orphaned requirements: all five phase-declared IDs (`LOC-01`, `LOC-02`, `LOC-03`, `LOC-04`,
`DECL-03`) appear in at least one plan's `requirements:` frontmatter, and REQUIREMENTS.md maps no
additional ID to Phase 60 beyond these five. REQUIREMENTS.md itself currently marks all five
`Complete`; this verification's independent codebase check finds `LOC-03` not genuinely met and
flags that discrepancy rather than accepting the written status.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/mcp/vice/tool-location.mts` | ~665-674, ~801-822 | The environment layer's terminal refusal is scoped to slash-free values only; a separator-containing value that resolves to nothing still falls through silently to the declared-id `$PATH` probe | 🛑 Blocker | Silently substitutes a different binary for a developer setup (a stale absolute path) that pre-Phase-60 code handled honestly (an `ENOENT` spawn failure); directly contradicts LOC-03's own text. Independently reproduced. |
| `src/mcp/vice/tool-location.mts` | ~665-674 (`envUnresolved` assignment) | Set unconditionally on the `record.kind`, so a directory-kind id's terminal refusal message claims a `$PATH`-substitution risk that structurally cannot occur for that kind (WR-03, from 60-REVIEW.md, confirmed still present) | ⚠️ Warning | Misleads a user debugging a bad `GHIDRA_HOME` toward a nonexistent risk; reachable at `host-tool.mts`'s `ghidra.analyze` refusal. Does not change resolution behaviour, only message accuracy. |
| `src/mcp/vice/host-tool.mts` | `findAcmeLib()` (~2444-2452) | Discards the seam's `refusal` entirely rather than surfacing it (unlike every sibling consumer touched by this phase) | ℹ️ Info | Pre-existing, unrelated to this phase's own changes (IN-02 from code review); currently masks WR-03's wrong message for `acme-lib` rather than exposing it. Not itself a functional defect. |
| `src/mcp/vice/host-tool.mts` | 2482-2528 | `findSiblingBinary()`'s process-lifetime memo remains inconsistent with the seam's own no-memo posture (WR-02) | ⚠️ Warning | Deliberately recorded as an open, unresolved tension per PD-18; a process restart is needed for an edited `tools.json` to take effect for `c1541`/`petcat` only. Not re-litigated here — carried forward as intentionally open. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in the phase's changed files.

### Human Verification Required

1. **ACME_BIN pointed at a nonexistent path, `acme.build` invoked, refusal checked**
   **Test:** Point `ACME_BIN` at a path that does not exist, invoke the `acme.build` route.
   **Expected:** A refusal naming `acme.build` — but note the LOC-03 residual above means an
   absolute nonexistent `ACME_BIN` does NOT hit the seam's own terminal refusal; it falls through
   to the `$PATH` probe for the literal id `acme`. Record which message is actually produced.
   **Why human:** Needs a real host with ACME moved aside; deferred by plans 60-03 and 60-07's own
   `<human-check>` blocks under `workflow.human_verify_mode: end-of-phase`. Not run by any executor.

2. **Real stock `x64sc` recorded in `tools.json`, broker started as its systemd unit; and a bare
   `$PATH`-resolved `VICE_BIN`**
   **Test:** Record a real stock `x64sc` path in `.c64-re-tools/tools.json`, start the broker as
   its systemd unit, confirm via process args or the broker's own log line that the spawned
   binary is the recorded path. Separately, set `VICE_BIN` to a bare filename on `$PATH` and
   confirm the broker spawns that binary.
   **Expected:** The real child process's argv matches the recorded path in the first case, and
   the bare-name-resolved binary in the second.
   **Why human:** Needs a real systemd-launched broker against a real recorded path and a real
   installed emulator; deferred by plans 60-05 and 60-07's own `<human-check>` blocks. Not run by
   any executor.

### Gaps Summary

**LOC-03 is genuinely closed for the shape it was originally reported in (CR-01: a slash-free
env-var override) and genuinely unclosed for the mirror shape (a separator-containing/absolute-path
env-var override that resolves to nothing).** Both shapes produce the identical harm the
requirement exists to prevent: a silent substitution of a different binary, `refusal: null`, for a
developer setup the phase's own text promises is unaffected. This verification independently
traced the separator-containing shape back through git history and confirmed it is not a
pre-existing limitation the phase inherited — it is a regression plan 60-01 itself introduced when
`resolvedBackend()` was rewired through the seam (the pre-phase `defaultResolveBinPath()` returned
`null`, never a `$PATH` search for the bare declared id, when a slash-containing value did not
exist). Plan 60-06 knowingly preserved this regression rather than fixing it, in order to keep a
test written by plan 60-01 (in this same phase) green — a test whose own SUMMARY documents this
tension but resolves it in the direction of NOT closing the requirement's own promise, reading a
same-phase test as though it were an inviolable legacy contract. 60-REVIEW.md's incremental
re-review characterised this residual as "the narrow, documented limit this review's own context
names as deliberate and graded" and did not raise it as a finding; this verification reaches a
different judgment on the same evidence, because the requirement's own text draws no
separator-based distinction and the residual case is independently, live-reproducibly a silent
substitution of the exact kind LOC-03 exists to prevent.

**WR-03** (the code review's own new finding from the incremental re-review) is confirmed still
present and live-reproducible: the environment layer's terminal refusal message for a
directory-kind id (`ghidra`/`GHIDRA_HOME`, `acme-lib`/`ACME`) falsely claims a `$PATH`-substitution
risk that cannot exist for that kind. This is scored as a Warning, not a Blocker: it does not
change resolution behaviour or safety, only the accuracy of a message reachable at
`ghidra.analyze`'s live refusal site.

**Everything else holds.** LOC-01, LOC-02, LOC-04, and DECL-03 are unchanged from the prior
passing verification and re-confirmed by direct regression check. WR-01 (the code review's other
warning, `findSiblingBinary()` discarding the seam's specific refusal reason) is genuinely closed
by plan 60-07, independently confirmed by the "Plan 60-07" test suite and by direct read of the
two refusal call sites. WR-02 remains an intentionally recorded, open tension (not a defect). The
second full-suite failing-set-difference evidence note (`phase60-gap-closure-suite-set-diff.md`)
is present, well-formed, and its own regression-free claim is corroborated by the orchestrator's
own measured full-suite run (4020/3939/0 fail/81 skipped). Two human-verification items from
plans 60-03/60-05/60-07 remain carried forward, unrun by any executor, and must not be forgotten
when this phase seals — one of them (the `ACME_BIN` refusal check) should now be run with the
LOC-03 residual's actual message shape in mind, since the plan's own stated expectation for that
scenario may not match what the residual gap actually produces.

**Suggested fix path for the remaining LOC-03 gap:** widen the terminal refusal (or the
`envUnresolved` condition) to also cover a separator-containing value that resolves to nothing,
accepting that `vice-broker-acquire.test.ts`'s "Plan 60-01 Test 4" pins a regression and must be
rewritten rather than preserved — mirroring exactly the fix plan 60-06 already applied for the
slash-free case, generalised to drop the `!envValue.includes("/")` gate on the `envUnresolved`
assignment (while keeping the separate, correct gate on the `$PATH`-*walk* step, which genuinely
should stay slash-free-only). Alternatively, if the residual is judged acceptable, LOC-03's own
requirement text should be amended to say so explicitly rather than left to read as fully closed
in REQUIREMENTS.md while the codebase still exhibits the substitution hazard for this shape.

**This looks like it could be argued as intentional** (plan 60-06's own deviation record shows a
considered decision, not an oversight). To accept this deviation instead of treating it as a gap,
add to this file's frontmatter:

```yaml
overrides:
  - must_have: "LOC-03: An existing VICE_BIN, ACME_BIN, ACME or GHIDRA_HOME override still wins
      over tools.json, so no current developer setup, test invocation or CI step changes
      behaviour."
    reason: "A separator-containing (absolute-path) override that resolves to nothing is accepted
      to keep falling through to a $PATH search for the declared id, mirroring the file layer's
      analogous pre-existing posture, on the judgment that this shape is materially rarer than a
      bare $PATH name and that plan 60-06's narrow closure of the more common shape is sufficient
      for this milestone."
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

No such override is present in this file as written, so the gap stands and the phase is not
sealed.

---

_Verified: 2026-09-18T19:40:00Z_
_Verifier: Claude (gsd-verifier)_
