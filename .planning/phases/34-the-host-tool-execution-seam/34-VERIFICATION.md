---
phase: 34-the-host-tool-execution-seam
verified: 2026-09-03T19:00:00Z
status: gaps_found
score: 4/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Each tool goes through a typed per-tool allowlist with NO ARGV PASSTHROUGH ANYWHERE, as a child process (ROADMAP Phase 34 Success Criterion 1; SEAM-02)"
    status: failed
    reason: >
      Three independent, confirmed code paths let a caller-supplied wire value reach a
      spawn's executable path or its argv completely unresolved and unbounded, directly
      contradicting the literal criterion text and this module's own documented invariant
      ("argv is built ENTIRELY from typed fields... never from a raw wire array or a raw
      wire string", host-tool.mts:16-19). REQUIREMENTS.md marks SEAM-02 "Complete"; on the
      evidence in the code this is false. All three were independently confirmed by reading
      the source during this verification, not merely accepted from the code review.
    artifacts:
      - path: "src/mcp/vice/host-tool.mts:757-778"
        issue: "runOracleProbe() spawns `args.command` (a raw caller-supplied host-absolute path string) as the executable after only an existsSync() check -- no resolveWorkspacePath()-style boundary check, no basename allowlist. Any file the broker process can execute can be named."
      - path: "src/mcp/vice/host-tool.mts:434-441"
        issue: "request.args.preScript/postScript are typed-string-checked only, then placed directly into buildAnalyzeHeadlessArgv()'s argvInput with no resolveWorkspacePath() call -- reaching Ghidra's `-preScript`/`-postScript` argv unresolved. The file's own header comment at :96-100 falsely claims these flow through resolveWorkspacePath() before reaching argv; the code does not do what the comment says."
      - path: "src/mcp/vice/host-tool.mts:400"
        issue: "`for (const include of args.includes ?? []) argv.push(\"-I\", include)` pushes each raw wire-supplied string to ACME's include-search-path argv with no workspace-boundary check, unlike `source`/`outDir` three lines above which are resolved through resolveWorkspacePath()."
    missing:
      - "Require oracle.probe's `command` override, when present, to resolve inside the workspace via resolveWorkspacePath(), or restrict it to a basename allowlist (e.g. basename(command) === \"unp64\")."
      - "Route ghidra.analyze's preScript/postScript through resolveWorkspacePath() before they enter argvInput, and correct the false header comment at host-tool.mts:96-100 to match the code once fixed."
      - "Route every acme.build `includes` entry through resolveWorkspacePath() before pushing `-I <dir>`, refusing the whole request if any entry escapes the workspace."
      - "Add a test in host-tool.test.ts for each of the three paths above exercising a path-escaping/absolute-path value -- none exists today."
  - truth: "ghidra.analyze completes over the shipped, default-configured host_tool control-plane route -- the practical form of the phase goal's claim that Ghidra is reached through the seam, and of SEAM-07's recorded per-invocation JVM binding actually being usable end to end"
    status: failed
    reason: >
      Two independent timeout budgets bound every host_tool round trip and both are shorter
      than Ghidra's own documented and this-phase-measured JVM startup cost, so
      ghidra.analyze cannot complete successfully through the real, wired control-plane
      route at all -- only through the bespoke CLI harness the evidence transcript used to
      call runHostTool() directly, bypassing hostToolOverControlPlane() and the real broker
      wiring entirely.
    artifacts:
      - path: "src/mcp/vice/host-tool-client.ts:132-138"
        issue: "hostToolOverControlPlane()'s single timer reuses CONTROL_CONNECT_TIMEOUT_MS (5000ms, vice-broker-client.ts:546) to bound the ENTIRE round trip including the spawned tool's own execution time, rather than only the initial TCP connect the constant's own header comment says it is for."
      - path: "src/mcp/vice/host-tool.mts:462,690"
        issue: "DEFAULT_HOST_TOOL_TIMEOUT_MS = 20_000 is the server-side ceiling for every host_tool invocation."
      - path: "src/mcp/vice/vice-broker.mts:1167-1171"
        issue: "The real broker's onHostTool wiring never supplies a timeoutMs, so every ghidra.analyze call runs under the fixed, non-overridable 20s default -- no timeoutMs field exists anywhere in the wire request shape."
    missing:
      - "A request-deadline timer in hostToolOverControlPlane() distinct from the connect-timeout constant, mirroring openBrokerControl()'s own connect-timer/request-timer split."
      - "A per-tool (or wire-supplied, capped) server-side timeout for ghidra.analyze that comfortably exceeds the documented/measured 12.6-17.4s JVM-startup cost plus a realistic analysis budget."
      - "A test in host-tool.test.ts exercising a slow ghidra.analyze invocation over the actual control-plane route (today's withFakeGhidraHome() fake exits immediately, so this is untested as well as broken)."
requirements_review:
  - id: SEAM-01
    roadmap_status: Complete
    verifier_finding: "Verified. `host_tool` is dispatched as its own StartControlListenerOptions callback (onHostTool), wired alongside -- never composed from -- the seven VICE lease callbacks (vice-broker.mts). A live test (host-tool.test.ts: 'two overlapping host_tool requests... leave all seven VICE-callback spies at zero calls') proves no lease path is touched."
  - id: SEAM-02
    roadmap_status: Complete
    verifier_finding: "NOT met as stated. The unknown-key/unknown-tool/wrong-type refusal machinery (normaliseHostToolRequest) is real and tested, but the criterion's own second half -- 'no argv passthrough anywhere' -- is false: see the first gap above (CR-01/CR-02/CR-03). REQUIREMENTS.md's 'Complete' marking should be reverted to reflect this."
  - id: SEAM-03
    roadmap_status: Complete
    verifier_finding: "Verified. host-tool-client.ts imports and applies containerPath() from containerpath.ts (an already-declared hostpath.ts consumer) to every response path; host-tool-transport.test.ts asserts the {path, sha256, byteLength}-only response shape by recursive key enumeration and the >64KiB bare-disconnect behaviour against the real listener."
  - id: SEAM-04
    roadmap_status: Complete
    verifier_finding: "Verified. buildAnalyzeHeadlessArgv() emits [projectLocation, projectName, \"-import\", importPath, \"-deleteProject\", ...]; resolveGhidraProject() computes one directory per runId and refuses reuse of an existing run directory; the dot-segment refusal is enforced in two layers (resolveGhidraProject and buildAnalyzeHeadlessArgv) and proven live against real Ghidra 12.1.3 (evidence/34-ghidra-dotpath.md: both this project's own pre-analyzeHeadless refusal at 126ms and Ghidra's own native refusal at 11160-13871ms are observed, not merely read from source). See the second gap above for the separate, unresolved question of whether a ghidra.analyze run can COMPLETE through the shipped route."
  - id: SEAM-05
    roadmap_status: Complete
    verifier_finding: "Verified. acme.mjs and packer-finding.mjs no longer spawn a host binary directly (grep confirms only spawn(process.execPath, ...) remains, an interpreter-exemption case). check-no-skill-external-spawn.mjs scopes BOTH the tracked tree and the npm-pack file list via check-npm-packages.mjs's packFiles() (never git ls-files), is wired into CI at ci.yml:200, exits 0 on the real tree, and skill-external-spawn-gate.test.ts's 18/18 tests include three planted-violation shapes that are caught."
  - id: SEAM-06
    roadmap_status: Complete
    verifier_finding: "Verified. A second, independently hand-pinned floor (HOST_TOOL_FAMILY_FLOOR = 2 + 1) is pinned over a host-tool|ghidra|dxa prefix union in hostpath-consumers.test.ts, disjoint from the anno- family, with a positive control naming the three real on-disk modules this phase created (host-tool.mts, host-tool-client.ts, ghidra-project.mts) and future members named absent before they exist. The floor's capacity to fail is proven via a synthetic empty-directory edge case (the real on-disk family never goes red at floor=3=measured count, so the ROADMAP's 'observed going red' is discharged the same way ANNO_MODULE_FLOOR's own precedent does -- via a synthetic control, not the real tree). EXPECTED_IMPORTERS' five-member set is confirmed byte-identical (unmodified context in the diff). module-classification.ts (flagged for inspection) is unrelated to this criterion -- it is a pre-existing Phase 27 artifact for the anno-* capability/glue classification, touched only for an incidental line-citation repair in 34-04, and is not the SEAM-06 positive control."
  - id: SEAM-07
    roadmap_status: Complete
    verifier_finding: "Verified as a decision record. docs/phase34-host-tool-seam-decisions.md records JVM_BINDING: per-invocation with its measurement (12.6-17.4s range, plus this project's own 12407ms/11160ms observations) and a concrete, mechanically-checkable reversal condition (N>=20 binaries, P=30% of wall-clock spent in JVM startup). Caveat: this recorded binding, matched against the real code, is the binding CR-04 shows cannot complete over the shipped control-plane route -- the decision record is honest about what was built, but what was built does not work end to end for its own headline case."
deferred: []
human_verification: []
---

# Phase 34: The Host-Tool Execution Seam Verification Report

**Phase Goal:** A container-side skill script invokes a host binary — `acme`, `dxa`,
Ghidra — through one typed seam that consumes no emulator lease, returns paths rather than
payloads, and is the only route there is, with the ban on every other route written and
observed biting.
**Verified:** 2026-09-03
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Container-side skill invokes a host binary over a typed control op, routed before any lease-bearing path, consuming no lease, through a typed per-tool allowlist **with no argv passthrough anywhere** (SC1, SEAM-01/02) | ✗ FAILED | Lease-isolation half verified live (host-tool.test.ts's overlapping-request spy test; onHostTool wired independently of the seven VICE callbacks in vice-broker.mts). "No argv passthrough anywhere" half is false: CR-01 (`oracle.probe`'s `command`), CR-02 (`ghidra.analyze`'s `preScript`/`postScript`), CR-03 (`acme.build`'s `includes`) each let an unresolved, unbounded, caller-supplied string reach a spawn's executable path or argv — confirmed directly in `host-tool.mts` at the cited lines, not merely accepted from the code review |
| 2 | The 64 KiB line cap is observed, not read about — an inline result over the cap produces a bare disconnect with no error frame, recorded as a transcript, red (SC2, SEAM-03) | ✓ VERIFIED | `evidence/34-transport-cap.md`: a real, dialed 70050-byte line against the live `startControlListener()` produces `hadError=false gotData=false`, zero bytes; exact-byte boundary controls both sides (`65536` open, `65537` destroyed); mirrored as automated cases in `host-tool-transport.test.ts` (8/8 pass) |
| 3 | Ghidra runs with one project directory per run id and `-deleteProject`, and the no-dot project-path refusal is enforced in code, proven by a dot-prefixed path refused before `analyzeHeadless` is reached (SC3, SEAM-04) | ✓ VERIFIED | `ghidra-project.mts`: `resolveGhidraProject()` keys the directory on `runId`, refuses reuse, and `buildAnalyzeHeadlessArgv()` emits `[...,"-import",importPath,"-deleteProject"]`. Dot-segment refusal enforced at two layers. `evidence/34-ghidra-dotpath.md` is a genuine live transcript against real Ghidra 12.1.3: this project's own refusal fires at 126ms, before any process spawn (confirmed via `pgrep -af analyzeHeadless` finding nothing), and Ghidra's own native refusal is separately observed at 11160-13871ms |
| 4 | The whole-tree grep gate banning a skill-script external-binary spawn is observed biting on a planted violation, and only exists because the two pre-existing violations are migrated first; the gate's scope reads what a user actually receives, never `git ls-files` (SC4, SEAM-05) | ✓ VERIFIED | `acme.mjs`/`packer-finding.mjs` no longer spawn a host binary directly (grep confirms). `check-no-skill-external-spawn.mjs` scopes both the tracked tree and the npm-pack file list via `check-npm-packages.mjs`'s `packFiles()` (header explicitly documents why `git ls-files` alone is wrong); wired into CI (`ci.yml:200`); exits 0 on the real tree; `skill-external-spawn-gate.test.ts` 18/18 pass including 3 planted-violation shapes caught |
| 5 | The new module family is inside the closed-consumer discipline with a second floor pinned over its own prefix, a real positive control on disk, and the JVM lifetime binding recorded with its measurement and reversal condition (SC5, SEAM-06/07) | ✓ VERIFIED | `hostpath-consumers.test.ts`'s `HOST_TOOL_FAMILY_FLOOR = 2 + 1` (22/22 pass), positive control names the three real modules this phase created; `EXPECTED_IMPORTERS` unchanged. `docs/phase34-host-tool-seam-decisions.md` records `JVM_BINDING: per-invocation` with measurement and a concrete N/P reversal condition |
| 6 | (derived from the phase goal's own text naming Ghidra, and from SEAM-07's binding being a claim about a working design) `ghidra.analyze` can complete over the shipped, default-configured control-plane route within the recorded per-invocation binding | ✗ FAILED | CR-04: client-side `CONTROL_CONNECT_TIMEOUT_MS` (5000ms) bounds the *entire* round trip including tool execution, and server-side `DEFAULT_HOST_TOOL_TIMEOUT_MS` (20000ms, non-overridable in the real broker wiring) is shorter than Ghidra's own documented/measured JVM startup (12.6-17.4s; this phase's own transcript measured 11160-13871ms for a refusal alone). No test exercises a real ghidra.analyze call over the actual control-plane route |

**Score:** 4/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/host-tool.mts` | Host-bound executor: typed allowlist, argv construction, async spawn | ⚠️ PARTIAL | Present, substantive, wired, tested (31/31 `host-tool.test.ts` pass) — but three of its own documented invariants are violated in the code itself (see gap 1) |
| `src/mcp/vice/host-tool-client.ts` | Container-side client, `containerPath()` translation | ✓ VERIFIED | Present, wired, correctly translates every response path |
| `src/mcp/vice/ghidra-project.mts` | Per-run project resolution, dot-segment refusal, argv builder | ✓ VERIFIED | Present, substantive, wired, live-transcript proven (28/28 `ghidra-project.test.ts` pass) |
| `scripts/check-no-skill-external-spawn.mjs` | Whole-tree grep gate, npm-pack scope | ✓ VERIFIED | Present, wired into CI, exits 0, 18/18 gate tests pass |
| `src/mcp/vice/hostpath-consumers.test.ts` (SEAM-06 addition) | Second non-vacuity floor over host-tool/ghidra/dxa prefix | ✓ VERIFIED | 22/22 pass including 9 new SEAM-06 cases |
| `docs/phase34-host-tool-seam-decisions.md` | JVM lifetime binding decision record | ✓ VERIFIED | Present, carries measurement and reversal condition |
| `src/skills/acme-build/scripts/acme.mjs` | Migrated off direct spawn | ✓ VERIFIED | Now `spawn(process.execPath, ...)` calling the CLI, never the host binary directly |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` | Migrated off direct spawn | ✓ VERIFIED | Now reaches the oracle only through `host-tool-client.ts`'s CLI |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `broker-control.mts` `handleLine()` | `host-tool.mts` `runHostTool()` | `onHostTool` callback | ✓ WIRED | Declared alongside, never composed from, the seven lease callbacks (`vice-broker.mts:1167-1171`) |
| `host-tool.mts` argv builders | `resolveWorkspacePath()` | boundary check | ⚠️ PARTIAL | `source`/`outDir`/`importPath` are resolved; `includes`, `preScript`, `postScript`, and `oracle.probe`'s `command` override are **not** — see gap 1 |
| `host-tool-client.ts` | `containerpath.ts` `containerPath()` | response path translation | ✓ WIRED | Every response path translated; `hostpath.ts`'s 5-member `EXPECTED_IMPORTERS` untouched |
| `host-tool-client.ts` `hostToolOverControlPlane()` | real broker `onHostTool` wiring | TCP control-plane round trip | ⚠️ HOLLOW (for `ghidra.analyze`) | Round trip cannot complete for Ghidra within either the client or server timeout budget — see gap 2 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 64 KiB cap red observation | `node evidence/64k-cap-probe.mjs` | `PROBE_RUNS_RED` (matches transcript) | ✓ PASS |
| Gate bites on planted violation | `node --test skill-external-spawn-gate.test.ts` | 18/18 pass | ✓ PASS |
| Gate exits 0 on real tree, npm-pack scope | `node scripts/check-no-skill-external-spawn.mjs` | `OK -- tracked-tree 16 files, packed-tarball 15 files`, exit 0 | ✓ PASS |
| Host-tool full test suite | `node --test host-tool.test.ts` | 31/31 pass | ✓ PASS (does not cover CR-01/02/03) |
| Ghidra dot-refusal, live | `evidence/34-ghidra-dotpath.md` transcript | refusal at 126ms pre-spawn; Ghidra's own at 11160-13871ms | ✓ PASS |
| `ghidra.analyze` over real control-plane route within default timeouts | not exercised by any test | n/a | ✗ FAIL (CR-04; no test exists) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SEAM-01 | 34-01 | Typed control op before lease path | ✓ SATISFIED | See requirements_review above |
| SEAM-02 | 34-01 | Typed per-tool allowlist, no argv passthrough | ✗ BLOCKED | CR-01/CR-02/CR-03; REQUIREMENTS.md's "Complete" is not supported by the code |
| SEAM-03 | 34-01/34-02 | Path+digest+length via containerpath.ts | ✓ SATISFIED | `containerPath()` applied; 64KiB cap observed red |
| SEAM-04 | 34-03 | Per-run Ghidra dir, `-deleteProject`, dot-refusal in code | ✓ SATISFIED (refusal claim); see gap 2 for the separate completion question | Live transcript |
| SEAM-05 | 34-04/34-05 | Migrations + whole-tree gate, npm-pack scope | ✓ SATISFIED | Gate wired into CI, biting |
| SEAM-06 | 34-06 | Second floor, closed-consumer discipline | ✓ SATISFIED | 22/22 pass |
| SEAM-07 | 34-06 | JVM binding, measurement, reversal condition | ✓ SATISFIED (as a decision record); undermined in practice by CR-04 | `docs/phase34-host-tool-seam-decisions.md` |

No orphaned requirements found — all seven `SEAM-*` ids declared across the six plans are present in `.planning/REQUIREMENTS.md`'s Phase 34 section.

### Anti-Patterns Found

None (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` grep across all phase-touched files returned nothing). The defects found in this phase are logic/security gaps (unresolved argv passthrough, timeout mismatch), not debt markers or stubs — arguably a more concerning category, since nothing in the tree flags them as unfinished.

Two review warnings (not scored as gaps, but recorded for follow-up):
- **WR-01**: `check-no-skill-external-spawn.mjs`'s call-site detector can be evaded by aliasing the spawn function (`const run = spawnSync; run(...)`) — no planted-violation test covers this shape.
- **WR-02**: `host_tool` has no admission control — an unbounded number of concurrent host-side child processes (including JVMs) can be requested with no ceiling.

### Gaps Summary

Four of the five ROADMAP Success Criteria for this phase hold up under direct code inspection (the 64 KiB cap, the Ghidra dot-refusal mechanism, the whole-tree gate, and the second closed-consumer floor with the JVM decision record). Success Criterion 1's second half does not: the phase's own stated purpose — "a typed per-tool allowlist with no argv passthrough anywhere" — is violated in three separate, independently confirmed places (`oracle.probe`'s `command`, `ghidra.analyze`'s `preScript`/`postScript`, `acme.build`'s `includes`), each letting a container-side, wire-supplied string reach a host-side spawn's executable path or argv with no workspace-boundary check. `SEAM-02` is marked "Complete" in `REQUIREMENTS.md`; the code does not support that marking. Separately, and specific to the phase's headline second tool: `ghidra.analyze` cannot complete over the shipped, default-configured control-plane route at all, because both the client-side and server-side timeout budgets are shorter than Ghidra's own documented and this-phase-measured JVM startup cost — so while the *refusal* mechanics (per-run directory, `-deleteProject`, dot-segment rejection) are genuinely proven, a *successful* Ghidra run through the seam as shipped is not, and no test exercises it.

**This looks like it needs a closure plan, not an override.** Both gaps have concrete, narrow fixes named in the code review (route the three unresolved values through `resolveWorkspacePath()`/a basename allowlist; give the control-plane round trip its own request-deadline timer and raise the server-side default for `ghidra.analyze`). Neither looks like an intentional design tradeoff — both directly contradict this phase's own documented invariants and its own measured numbers.

---

_Verified: 2026-09-03T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
