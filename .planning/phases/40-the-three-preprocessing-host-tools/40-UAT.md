---
status: diagnosed
phase: 40-the-three-preprocessing-host-tools
source: [40-VERIFICATION.md]
started: 2026-09-08T13:41:56Z
updated: 2026-09-08T15:22:57Z
---

## Current Test

[testing complete]

## Tests

### 1. Accept or reject the Ghidra per-run project directory staying OUTSIDE `.c64-re-tools/` (at `tools/ghidra-runs/`) as a permanent, standing exception to the D-33 "one root" consolidation
expected: A project-owner decision on whether the two-location split (`tools/ghidra-runs/` + `.c64-re-tools/`) is acceptable long-term, or whether a future non-dot-prefixed alias should reunify it.
why_human: Ghidra's own `hasDotPrefixedSegment()` refuses any ancestor path segment starting with `.`, verified directly against `ghidra-project.test.ts` before any code was written that would have broken it. So this is an evidence-backed technical necessity, not a bug — but it IS a deviation from 40-01's own declared must-have truth ("every tool-written file lands under one repo-root directory") and from the phase's declared artifact list. Plan 40-01 flagged it `human_judgment: true` and recorded it in code, in `CLAUDE.md`, and on the folded consolidation todo. One Task 3 acceptance criterion (`grep -ac 'ghidra-runs' .gitignore` expected 0) fails as a direct consequence.
result: issue
reported: "cant it be linked in from the tmp folder? / I dont want it under tools, there must be a better palce. the sym link must be created by the broker so the mcp and other toolning it still working from inside a devcontainer"
severity: major

### 2. Confirm the fake-stand-in-binary substitution used for PREP-04's non-vacuity proof on `c1541.bam`/`c1541.chain`/`c1541.read` is an acceptable resolution, and that `findSiblingBinary()`'s $PATH-fallback branch needs no dedicated automated test
expected: A decision that (a) proving classifier-vs-exit-status disagreement via fake stand-in binaries — reproducing the MEASURED `c1541.dir`/`entry` failure text, and the DOCUMENTED general D-09 shape for `c1541.bam`/`chain`/`read` — is sufficient evidence for "a failure is reported as a failure, proven separately on each of the two shipped tools"; and (b) `findSiblingBinary()`'s PATH-fallback branch having no dedicated unit test is an acceptable residual gap.
why_human: Live re-measurement against both installed VICE builds found `c1541.bam`/`chain`/`read` actually exit **1** on a real failure — contradicting `host-tool.mts`'s own general D-11 comment, which was written from a `-dir`-only measurement. An exit-1 failure makes the exit-status-only predicate AGREE with the classifier, which is a vacuous control, so those three ids could not take their non-vacuity fixture from the real binary. The classifiers are pure POSITIVE-shape checks (a specific success marker must be present), so they are architecturally robust to any failure text lacking that marker regardless of exit code; and 2 of 6 ids (`c1541.dir`/`entry`) plus `petcat.decode` ARE verified end-to-end against the real binary's real failure output. But no test proves the real classifier refuses the real `c1541 -bam`/`-chain`/`-read` failure output specifically. Disclosed in `host-tool-oracle.test.ts`'s header with the measurements; 40-02 flagged the sibling PATH-fallback branch `human_judgment: true` for the same reason.
result: pass

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-40-1
  truth: "Every tool-written file lands under one repo-root directory (D-33), including Ghidra per-run project data"
  status: failed
  reason: "User reported: cant it be linked in from the tmp folder? / I dont want it under tools, there must be a better palce. the sym link must be created by the broker so the mcp and other toolning it still working from inside a devcontainer"
  severity: major
  test: 1
  measured_this_session: |
    Real Ghidra 12.1.3, both halves, 2026-09-08:
      CONTROL  literal `<...>/.c64-re-tools/runs/ghidra/dotrun` handed to analyzeHeadless
               -> IllegalArgumentException: Path element starting with '.' is not permitted
      SYMLINK  `<...>/tools/ghidra-runs/linkrun` -> `<...>/.c64-re-tools/runs/ghidra/linkrun`
               -> "Creating project:" SUCCEEDED; linkrun.gpr + linkrun.rep/
                  (project.prp, idata/, versioned/, user/) landed PHYSICALLY under
                  `.c64-re-tools/`. tools/ held only the symlink.
    Conclusion (REFINED by diagnosis, 2026-09-08): the refusal is a check on the
    ABSOLUTIZED path argument (ProjectLocator calls getAbsolutePath(), never
    getCanonicalPath()), so it does NOT resolve symlinks but it DOES absolutize --
    a relative location is resolved against cwd and refused, and a bare `.` segment
    is caught too. It is therefore not a pure string test, as this entry first said.
    The exception's recorded justification -- "a hard external-tool constraint, not a
    preference" (ghidra-project.mts:80-96, mirrored in CLAUDE.md and 40-01-SUMMARY.md)
    -- is still OVERSTATED: the dot rule binds the literal path handed to
    analyzeHeadless, not the physical storage location, which is why the SYMLINK half
    above succeeded. See `.planning/notes/ghidra-dot-path-check-semantics.md` (5 live
    runs + javap on ProjectLocator, 12.1.3) for the authoritative semantics.
  owner_requirements:
    - "The non-dotted handle must NOT live under `tools/` -- find a better location."
    - "The symlink must be created BY THE BROKER (host side), so the MCP server and other tooling keep working from inside a devcontainer."
  root_cause: |
    A location decision justified by an inference that was never measured, compounded
    across two phases -- plus a third, genuinely-binding constraint never written down.
      (1) Phase 34 plan 34-03 assumption A-07 placed the runs root at `tools/ghidra-runs/`
          because `install-resources.ts`'s THEN-current `installTargetDir(root)` was
          `join(root, "tools")`, and recorded that candidate set -- existing real
          directories already in the tree -- as the WHOLE option space ("the ONLY
          placement satisfying both ..."). A symlinked HANDLE was never a candidate.
      (2) Phase 40 plan 40-01 (D-33) had to move it, ran THIS PROJECT'S OWN
          `hasDotPrefixedSegment()` (`ghidra-project.mts:322`) against a synthetic
          `.c64-re-tools/...` STRING, and promoted the refusal to "a hard external-tool
          constraint, not a preference" (`ghidra-project.mts:88-90`). That predicate
          observes the project, not Ghidra. 40-01-SUMMARY.md:167 states the method
          outright; its D5 carries `verification: []` + `human_judgment: true`.
      (3) The real constraint is an AND-gate of three conditions, and the THIRD was
          never recorded -- which is exactly why `/tmp` still looked plausible:
            a. no dot-prefixed OR bare `.` segment in the ABSOLUTIZED path
               (`ProjectLocator` calls `getAbsolutePath()`, never `getCanonicalPath()`);
            b. the path must stay INSIDE the bind-mounted workspace, because
               `containerPath()` THROWS on a host path matching no known root
               (`host-tool-client.ts:320` -> `containerpath.ts:141`);
            c. the CONTAINER ITSELF traverses the handle -- `ghidra-run.ts:241` does
               `readFileSync(resolvePath(runLogResult.path))` on the translated path.
    Aggravating: A-07's own stated reason died the day the exception was recorded.
    `install-resources.ts:100-102` now returns `.c64-re-tools/bin`; `ghidra-project.mts:396`
    is the LAST production writer under `tools/`; `git ls-files tools/` returns ZERO. The
    `.gitignore:32-35` claim that `tools/` "also holds tracked reverse-engineering tooling"
    is FALSE -- those live under `src/skills/*/scripts/`. `tools/` is vestigial.
  artifacts:
    - path: "src/mcp/vice/ghidra-project.mts"
      issue: ":396 inline `join(repoRoot, \"tools\", GHIDRA_RUNS_DIR_NAME)` -- the \"tools\" literal is NOT derived from repo-root.ts's toolsDir(). :72-94 the overstated \"hard external-tool constraint\" justification (its own text already concedes an alias escape hatch). :429-436 `mkdirSync(projectLocation, {recursive:true})` -- if the handle link is absent this SILENTLY creates a real dir tree at the handle path, Ghidra succeeds, and D-33 is violated invisibly."
    - path: "src/mcp/vice/resources/ghidra-project.mjs"
      issue: ":98, :347 compiled mirror (build.ts HOST_BOUND_ARTIFACTS); resources-sync.test.ts reds CI on drift"
    - path: "src/mcp/vice/host-tool.mts"
      issue: ":1454 run log inherits the location; :2932 cites the runs root as following a convention it does not follow; :1123-1158 resolveWorkspacePath() REALPATHS its result, so any caller-supplied path routed through a handle collapses back to the dotted real path"
    - path: ".gitignore"
      issue: "three stanzas (:19-24, :27-36, :137-144); :32-35 carries a fictional tracked-tooling justification"
    - path: "src/mcp/vice/repo-root.ts"
      issue: ":185-207 two independently false load-bearing claims -- that the Ghidra runs dir resolves through toolsDir(), and that \".c64-re-tools\" has exactly one non-comment occurrence (there are three: install-resources.ts:101, vice-broker.mts:131, host-tool.mts:2934)"
    - path: "src/mcp/vice/vice-broker.mts"
      issue: "run() at :1077 holds args.repoRoot -- the R2 (broker-creates-the-symlink) seam"
    - path: "src/mcp/vice/ghidra-project.test.ts, host-tool.test.ts, ghidra-live.test.ts"
      issue: "~40 pinned `tools/ghidra-runs` literals; NO structural gate pins it (ghidra-harness-gates / test-gate / hostpath-consumers / docs-linerefs all zero hits), so the move is mechanical"
  missing:
    - "R1 location: replace `tools/ghidra-runs` with `<repoRoot>/c64-re-tools` -> symlink -> `.c64-re-tools` (RELATIVE target), runs root becoming join(handle, \"runs\", \"ghidra\") -- structurally parallel to runs/oracle. One link whose name differs by one character reads as an ALIAS, not a third root, and generalises to any future dot-refusing host tool at zero code cost. Net .gitignore effect: three stanzas -> one."
    - "The link target MUST be RELATIVE: an absolute HOST target ENOENTs when the container follows it at ghidra-run.ts:241. This is the unrecorded reason R2 matters."
    - "`/tmp` is refuted by this project's own code, not by preference: containerPath() throws on a host path outside the workspace (containerpath.ts:141), so ghidra.analyze would fail on EVERY container-route call -- the opposite of R2's purpose. Secondary: /tmp here is a RAM tmpfs with aging disabled, and -deleteProject is not guaranteed to run on a crash."
    - "R2 creator: one `ensureGhidraRunsHandle(repoRoot)` in ghidra-project.mts (already the authoritative place, host-bound, value-imported by both the broker and host-tool.mts), called from TWO host-side sites: vice-broker.mts's run() (satisfies R2 literally -- after containerGuardEnforce() proves host-side, before the control listener accepts) AND resolveGhidraProject() as an idempotent precondition."
    - "The second call site is REQUIRED because two host-side routes have no broker: host-tool-client.ts:269-273's direct spawn (CI, and the everyday route on this devcontainer-less host) and tests importing resources/host-tool.mjs directly. Container-side code must NEVER mint the handle."
    - "It must VERIFY (lstat().isSymbolicLink() + readlink() equals the expected relative target) and resolveGhidraProject() must REFUSE BY NAME -- never mkdir through an unverified handle (closes the :429-436 silent-violation hole)."
    - "install-resources.ts / toolsDir() are NOT involved: the former is container-side and no longer owns tools/, the latter is unreachable from host-bound modules (module-cycle rule). Join the two segments directly per the existing documented convention."
    - "Docs to correct: ghidra-project.mts:72-94; .gitignore:19-24 / :27-36 (delete the false tracked-tooling claim) / :137-144; CLAUDE.md's D-33 exception bullet; .planning/STATE.md:1111; 40-01-SUMMARY.md (:12,:60,:61,:99,:107,:159,:167, D5 rationale); this UAT's own measured_this_session \"does NOT canonicalise\" wording (it DOES absolutize); the completed consolidation todo addendum; docs/phase34-host-tool-seam-decisions.md A-07 (\"the ONLY placement\"); 34-03-PLAN.md:89-94 / 34-03-SUMMARY.md / 34-VERIFICATION.md; repo-root.ts:185-207; host-tool.mts:2932. Already correct and usable as the corrective source: .planning/notes/ghidra-dot-path-check-semantics.md and REQUIREMENTS.md PREP-05."
    - "Land with two guards: the pending live-Ghidra symlink guard (.planning/todos/pending/2026-09-08-guard-ghidra-symlink-project-location.md, blocked on this) and a new guard for the invariant discovered here -- the handle is used ONLY for the computed projectLocation and its sibling run log, never for a caller-supplied workspace-relative path, because resolveWorkspacePath() realpaths and would silently restore the dot."
  debug_session: .planning/debug/ghidra-run-dir-outside-one-root.md
