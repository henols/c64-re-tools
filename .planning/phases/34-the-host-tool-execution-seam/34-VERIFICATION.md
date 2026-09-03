---
phase: 34-the-host-tool-execution-seam
verified: 2026-09-03T20:12:31Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "Each tool goes through a typed per-tool allowlist with NO ARGV PASSTHROUGH ANYWHERE (SC1/SEAM-02) — CR-01 (oracle.probe's command), CR-02 (ghidra.analyze's preScript/postScript), CR-03 (acme.build's includes) all independently reverified CLOSED in code, not merely claimed closed"
    - "ghidra.analyze completes over the shipped, default-configured host_tool control-plane route (CR-04) — client/server timeout budgets now split (660s client / 600s server for ghidra.analyze), and a live end-to-end test with a 3s-sleeping fake launcher over the real control-plane route resolves ok:true, reproduced by re-running host-tool.test.ts (67/67 pass, including the two-overlapping-slow-ghidra.analyze case)"
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "resolveWorkspacePath() — the seam's own declared single enforcement point ('the ONLY place a wire-supplied path becomes a real path', host-tool.mts:34-37) — actually confines every one of the seven path-bearing host_tool argument keys to the workspace root, including against a symlink planted inside the workspace"
    status: failed
    reason: >
      NEW finding (CR-05 in 34-REVIEW.md), not covered by either of the prior
      round's two gaps and not touched by any of plans 34-07/34-08/34-09.
      resolveWorkspacePath() enforces the workspace boundary with plain
      lexical path.resolve() plus a startsWith(rootAbs + sep) string check —
      it never calls node:fs realpath and never consults the filesystem
      (grep -c realpath host-tool.mts is 0, confirmed independently). I
      reproduced the escape live, outside the test suite, rather than
      accepting the review's argument: a symlink planted inside a workspace
      root (<root>/link -> an external directory) causes
      resolveWorkspacePath(root, "link/x") to return { ok: true, path:
      "<root>/link/x" } — a string that lexically satisfies the workspace
      prefix check — and a subsequent real filesystem write to that
      "accepted" path lands inside the external directory the symlink
      targets, not inside the workspace. This is not hypothetical: I ran the
      exact repro (mkdtemp workspace + mkdtemp outside dir + symlinkSync +
      writeFileSync at the "ok:true" path) and confirmed the file lands
      outside the workspace root. Two of the seven affected keys
      (acme.build's outDir, oracle.run's source) are write/read destinations
      reachable this way, not merely inert path values. This exact bug class
      was already found and fixed once in this codebase, in
      anno-types.ts's storePathWithinWorkspace(), which resolves both sides
      through realpathOfNearestExisting() specifically because a bare
      resolve()-based check "succeeded and the store file was created
      outside the workspace root" under a planted symlink (per that file's
      own incident history). No test in host-tool.test.ts,
      host-tool-transport.test.ts, or ghidra-project.test.ts plants a
      symlink; the word "symlink" appears in no file in this module family
      (confirmed by grep, zero matches).

      Judgment call on scope (asked for explicitly): SEAM-02's literal text
      — "typed per-tool allowlist with no argv passthrough anywhere" — is
      MET. The value that reaches argv for every affected key is the
      *resolved* path from resolveWorkspacePath(), never the raw wire
      string; that specific, narrowly-defined property is real, independently
      re-verified in code and via 13 passing named tests (unknown-key
      refusal, includes-escape refusal, preScript-escape refusal,
      cross-seam ordering, etc.). CR-05 is a DIFFERENT defect: the
      confinement check *underneath* that property is bypassable, so a
      caller-controlled "resolved path" can still name a location outside
      the workspace. I am not reverting SEAM-02's Complete status in
      REQUIREMENTS.md on this basis — the requirement's own words are
      satisfied. But this is scored as a phase-blocking gap regardless,
      because it directly falsifies host-tool.mts's own declared design
      invariant for the module this whole phase exists to deliver, it is a
      demonstrated (not theoretical) host-side write/read escape, it
      reintroduces a bug class this project already paid to fix once
      elsewhere, and its only disposition today is a pending todo filed by
      the review process itself — not an accepted override recorded in this
      VERIFICATION.md's frontmatter by a human decision-maker. A todo is
      tracking, not disposition; Step 3b's override mechanism requires an
      explicit accepted_by/accepted_at entry, which does not exist for this
      finding.
    artifacts:
      - path: "src/mcp/vice/host-tool.mts:370-386"
        issue: "resolveWorkspacePath() uses resolvePath() (node:path resolve) and a startsWith prefix check only — no realpath/symlink resolution on either side of the comparison."
      - path: "src/mcp/vice/host-tool.mts:780-843"
        issue: "acme.build's source/outDir/includes and ghidra.analyze's importPath/preScript/postScript all consume resolveWorkspacePath()'s result directly as the confined path, inheriting the symlink-blind check."
      - path: "src/mcp/vice/host-tool.mts:1013-1017"
        issue: "oracle.run's source likewise inherits the symlink-blind check — an arbitrary host file's bytes can be read back through the oracle's stdout capture via a symlink."
    missing:
      - "Resolve both repoRoot and the candidate path through an ancestor-realpath walk before the prefix comparison (mirror anno-types.ts's realpathOfNearestExisting(), reused or reimplemented), returning the realpath — not the lexical join — as the ok:true result."
      - "A live planted-symlink test in host-tool.test.ts (a real symlink on disk, mirroring anno-confinement.test.ts's own discipline, not a synthetic string) for at least one read key (acme.build's source) and one write key (acme.build's outDir)."
      - "Verify buildHostToolArgv()'s no-argv-passthrough tests (34-07/34-08) still hold once resolveWorkspacePath() returns a realpath instead of a lexical join, since callers assume the returned path is exactly what gets spawned."
deferred: []
human_verification: []
---

# Phase 34: The Host-Tool Execution Seam Verification Report

**Phase Goal:** A container-side skill script invokes a host binary — `acme`, `dxa`,
Ghidra — through one typed seam that consumes no emulator lease, returns paths rather than
payloads, and is the only route there is, with the ban on every other route written and
observed biting.
**Verified:** 2026-09-03T20:12:31Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plans 34-07/34-08/34-09 closed the prior round's two gaps

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Container-side skill invokes a host binary over a typed control op, routed before any lease-bearing path, consuming no lease, through a typed per-tool allowlist with **no argv passthrough anywhere** (SC1, SEAM-01/02) | ✓ VERIFIED | Independently reconfirmed in code: `HOST_TOOL_ARG_KEYS["oracle.probe"]` is `Object.freeze([])`, `resolveOracleCommand()` reads only the broker's own environment with a basename gate (host-tool.mts:938-958); `ghidra.analyze`'s `preScript`/`postScript` and `acme.build`'s `includes` are resolved through `resolveWorkspacePath()` at host-tool.mts:792-832 **before** `buildHostToolArgv()` is called, which reads only the resolved fields (host-tool.mts:467-472, 480). Re-ran the specific closure tests (not the whole suite): 13/13 pass, including the retired-key refusal, both escape refusals, and the cross-seam ordering test |
| 2 | `ghidra.analyze` completes over the shipped, default-configured host_tool control-plane route within its recorded per-invocation JVM binding (closes prior gap 2 / CR-04) | ✓ VERIFIED | `hostToolRequestTimeoutMs()` (host-tool-client.ts:103-121) gives `ghidra.analyze` 660,000ms client-side; `HOST_TOOL_TIMEOUT_MS["ghidra.analyze"]` (host-tool.mts:563-570) is 600,000ms server-side; `vice-broker.mts:1163-1180`'s real wiring deliberately supplies no override. Ran `host-tool.test.ts` in full (not filtered): 67/67 pass, including "two overlapping slow ghidra.analyze host_tool requests over the real control-plane route both resolve ok:true" — a live round trip that completes past the OLD 5000ms connect-timeout constant |
| 3 | **NEW** `resolveWorkspacePath()` — the seam's own declared single confinement point — actually confines every path-bearing key to the workspace, including against a symlink planted inside the workspace tree | ✗ FAILED | Independently reproduced, not merely accepted from the review: `resolveWorkspacePath()` uses `path.resolve()` + `startsWith()` with zero `realpath` calls (`grep -c realpath host-tool.mts` = 0). A live repro (mkdtemp workspace, mkdtemp external dir, `symlinkSync` inside the workspace pointing at the external dir, `resolveWorkspacePath()` called on a path through the symlink) returns `{ok:true, path:"<workspace>/link/pwned.txt"}`, and a subsequent `writeFileSync` at that "accepted" path lands **inside the external directory**, confirmed via `existsSync` — a demonstrated workspace escape, not a theoretical one. Two of the seven affected keys (`acme.build`'s `outDir`, `oracle.run`'s `source`) are write/read destinations. No test in the module family plants a symlink (`grep -rn symlink` across `host-tool.test.ts`, `host-tool-transport.test.ts`, `ghidra-project.test.ts` returns nothing) |
| 4 | The 64 KiB line cap is observed, not read about (SC2, SEAM-03) | ✓ VERIFIED (regression) | `host-tool-transport.test.ts` re-run: 8/8 pass (part of a 4-file, 80-test combined run, all passing); `evidence/34-transport-cap.md` unchanged since the prior round |
| 5 | Ghidra runs with one project directory per run id, `-deleteProject`, and the no-dot project-path refusal enforced in code (SC3, SEAM-04) | ✓ VERIFIED (regression) | `ghidra-project.test.ts` re-run as part of the same combined run: all pass; `evidence/34-ghidra-dotpath.md` unchanged |
| 6 | The whole-tree grep gate banning skill-script external-binary spawn bites on a planted violation, scoped to what a user actually receives (SC4, SEAM-05) | ✓ VERIFIED (regression) | `skill-external-spawn-gate.test.ts` re-run in the same combined run: all pass, including 3 planted-violation shapes |
| 7 | The new module family is inside the closed-consumer discipline with a second floor pinned over its own prefix, and the JVM lifetime binding is recorded with measurement and reversal condition (SC5, SEAM-06/07) | ✓ VERIFIED (regression) | `hostpath-consumers.test.ts` re-run in the same combined run: all pass; `docs/phase34-host-tool-seam-decisions.md` unchanged |

**Score:** 6/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/host-tool.mts` | Host-bound executor: typed allowlist, argv construction, async spawn | ⚠️ PARTIAL | Present, substantive, wired, tested (67/67 `host-tool.test.ts` pass) — the argv-passthrough invariant (CR-01/02/03) now holds; the confinement invariant one layer below it (CR-05) does not |
| `src/mcp/vice/host-tool-client.ts` | Container-side client, `containerPath()` translation, per-tool request-deadline timers | ✓ VERIFIED | Present, wired; `HOST_TOOL_REQUEST_TIMEOUT_MS` table added this round, correctly ordered against the server-side table (cross-seam ordering test passes) |
| `src/mcp/vice/ghidra-project.mts` | Per-run project resolution, dot-segment refusal, argv builder | ✓ VERIFIED (regression) | Present, substantive, wired, live-transcript proven |
| `scripts/check-no-skill-external-spawn.mjs` | Whole-tree grep gate, npm-pack scope | ✓ VERIFIED (regression) | Present, wired into CI, exits 0, 18/18 gate tests pass |
| `src/mcp/vice/resources/host-tool.mjs`, `resources/ghidra-project.mjs` | Compiled artifacts in sync with `.mts` sources | ✓ VERIFIED | `resources-sync.test.ts` re-run: 2/2 pass — byte-identical to a fresh build, no drift |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `broker-control.mts` `handleLine()` | `host-tool.mts` `runHostTool()` | `onHostTool` callback | ✓ WIRED (regression) | Unchanged; declared alongside, never composed from, the seven lease callbacks |
| `host-tool.mts` argv builders | `resolveWorkspacePath()` | boundary check | ⚠️ HOLLOW | All seven path-bearing keys now route through this single function (CR-02/CR-03 closed the "raw string reaches argv" defect), but the function itself accepts a symlink-mediated escape — see gap 3 |
| `host-tool-client.ts` `hostToolOverControlPlane()` | real broker `onHostTool` wiring | TCP control-plane round trip, per-tool deadline | ✓ WIRED | Now completes for `ghidra.analyze` — live test proves a round trip past the old connect-timeout constant resolves `ok:true` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01/02/03 closure (targeted) | `node --test --test-name-pattern="cross-seam ordering\|includes.*escap\|preScript.*escap\|command.*refus\|oracle.probe" host-tool.test.ts` | 13/13 pass | ✓ PASS |
| Full `host-tool.test.ts` (single file, not the whole-glob suite) | `node --test host-tool.test.ts` | 67/67 pass, including live overlapping-slow-ghidra.analyze round trip | ✓ PASS |
| SEAM-03/04/05/06 regression | `node --test ghidra-project.test.ts host-tool-transport.test.ts hostpath-consumers.test.ts skill-external-spawn-gate.test.ts` | 80/80 pass | ✓ PASS |
| Compiled-artifact drift check | `node --test resources-sync.test.ts` | 2/2 pass | ✓ PASS |
| Debt-marker scan on phase-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" host-tool.mts host-tool-client.ts ghidra-project.mts vice-broker.mts host-tool.test.ts` | no matches | ✓ PASS |
| **CR-05 live reproduction** | inline Node script: mkdtemp workspace + mkdtemp external dir + `symlinkSync` + `resolveWorkspacePath()` (inlined, pure function, identical logic) + `writeFileSync` at the accepted path | file lands inside the **external** directory, confirmed via `existsSync` | ✗ FAIL — confirms CR-05 live, not merely from source reading |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SEAM-01 | 34-01 | Typed control op before lease path | ✓ SATISFIED (regression) | Unchanged from prior round |
| SEAM-02 | 34-01/34-07/34-08 | Typed per-tool allowlist, no argv passthrough | ✓ SATISFIED (literal text) | CR-01/CR-02/CR-03 independently reconfirmed closed. **Caveat, not a revert**: the requirement's own words ("no argv passthrough") are met; the confinement layer the resolved argv values depend on for meaning (CR-05) is not — see gap 3. This is scored as a phase-blocking gap under the phase's own design invariant, not as a reason to revert SEAM-02 in REQUIREMENTS.md |
| SEAM-03 | 34-01/34-02 | Path+digest+length via containerpath.ts | ✓ SATISFIED (regression) | `containerPath()` applied; 64KiB cap observed red |
| SEAM-04 | 34-03 | Per-run Ghidra dir, `-deleteProject`, dot-refusal in code | ✓ SATISFIED (regression) | Live transcript, unchanged |
| SEAM-05 | 34-04/34-05 | Migrations + whole-tree gate, npm-pack scope | ✓ SATISFIED (regression) | Gate wired into CI, biting |
| SEAM-06 | 34-06 | Second floor, closed-consumer discipline | ✓ SATISFIED (regression) | 22/22 pass (part of combined 80/80 run) |
| SEAM-07 | 34-06 | JVM binding, measurement, reversal condition | ✓ SATISFIED (regression) | Decision record unchanged; now practically usable since CR-04 closed |

No orphaned requirements — all seven `SEAM-*` ids declared across the plans are present in `.planning/REQUIREMENTS.md`'s Phase 34 section, all currently marked Complete.

### Anti-Patterns Found

None (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` grep across `host-tool.mts`, `host-tool-client.ts`, `ghidra-project.mts`, `vice-broker.mts`, `host-tool.test.ts` returns nothing). CR-05 is a logic/security gap, not a debt marker — nothing in the tree flags it as unfinished, which is itself worth noting.

Two review warnings, both deliberately deferred by an in-execution plan decision (not new, not scored as gaps):
- **WR-01** (carried, unchanged): `check-no-skill-external-spawn.mjs`'s detector is evadable by aliasing the spawn function.
- **WR-02** (carried, unchanged): `host_tool` has no admission control / concurrent-JVM ceiling. CR-04's fix widens this window from 20s to 600s per `ghidra.analyze` call — noted, not scored, per the review's own framing.

One new warning, filed as a todo, not scored as a gap (minor severity, no demonstrated exploit path, distinct from CR-05's demonstrated write/read escape):
- **WR-03** (new): `runOracleRun()`'s `mkdirSync` sits outside its own try/catch, and the standalone CLI entry point has no `.catch()` — an environmental failure (disk full, permission denied) becomes an unhandled rejection rather than the module's own `{ ok: false, message }` contract, on the standalone-CLI route only (the real broker's `.catch()` around `onHostTool` already absorbs it).

### Gaps Summary

This re-verification confirms both of the prior round's gaps are genuinely closed: (1) the three argv-passthrough defects (CR-01 `oracle.probe`'s `command`, CR-02 `ghidra.analyze`'s `preScript`/`postScript`, CR-03 `acme.build`'s `includes`) are fixed in code and covered by 13 passing, targeted tests I re-ran independently; (2) `ghidra.analyze` now completes over the real, shipped control-plane route — proven by a live end-to-end test with a fake launcher sleeping past the old, too-short connect-timeout constant, which I re-ran and confirmed passing (67/67 in `host-tool.test.ts`).

However, the code review that ran after these closures landed found a new, unresolved Critical issue this reverification independently reproduced rather than took on faith: `resolveWorkspacePath()`, the single function this phase's own code calls "the ONLY place a wire-supplied path becomes a real path," enforces the workspace boundary with a purely lexical check that a symlink planted anywhere inside the workspace tree defeats. I constructed and ran a minimal, live repro proving a file write "accepted" by this check actually lands outside the workspace root. Two of the seven affected keys are write/read destinations, not inert values, so this is a demonstrated host-side confinement escape, not a theoretical one — and it reintroduces a bug class (`anno-types.ts`'s pre-`realpathOfNearestExisting()` history) this same codebase already paid to fix once.

My independent judgment on the scoping question this task specifically asked me to resolve: **SEAM-02's literal text — "no argv passthrough anywhere" — is met.** The value reaching argv for every affected key is always a resolved path from `resolveWorkspacePath()`, never a raw wire string; that specific property is real and re-verified. CR-05 is a distinct defect in the confinement check underneath that property, not an argv-passthrough violation, and I am not recommending SEAM-02 be reverted to Pending on this basis. **But this does not make the phase `passed`.** CR-05 is a demonstrated security escape in code this phase delivered, contradicts that same code's own stated design invariant, and its only disposition today is a pending todo — filed by the review process itself, with no human-accepted override recorded anywhere. A todo tracks a finding; it does not discharge it. Per this workflow's override mechanism, only an explicit `accepted_by`/`accepted_at` entry in this file's frontmatter constitutes acceptance, and none exists. This is scored as a new, phase-blocking gap.

**This looks like it needs a closure plan, not a silent pass.** The fix is narrow and precedented: mirror `anno-types.ts`'s own `realpathOfNearestExisting()`-based fix in `resolveWorkspacePath()`, and add a live planted-symlink test for at least one read key and one write key — exactly what the filed todo (`.planning/todos/pending/2026-09-03-cr-05-resolveworkspacepath-is-symlink-blind.md`) already specifies.

---

_Verified: 2026-09-03T20:12:31Z_
_Verifier: Claude (gsd-verifier)_
