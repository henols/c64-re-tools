---
status: diagnosed
trigger: "ghidra-run-dir-outside-one-root: Ghidra per-run project directories are created at <repoRoot>/tools/ghidra-runs/, outside the D-33 one tool-written root (.c64-re-tools/). Owner REJECTED this location with two hard requirements (R1: not under tools/; R2: symlink created by the broker so container tooling keeps working). Find the root cause of why the design landed outside the root and determine precisely what must change."
created: 2026-09-08T00:00:00Z
updated: 2026-09-08T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: |
    The location landed outside the one root through TWO compounding steps, neither of
    which ever measured Ghidra against the option that works:
    (1) Phase 34 A-07 chose `tools/` by REUSING the then-current deploy directory, and
        recorded its candidate set ("existing real directories") as the whole option
        space ("the ONLY placement");
    (2) Phase 40 plan 40-01 then needed to move it, found the project's OWN
        `hasDotPrefixedSegment()` refuses a `.c64-re-tools/...` string, and recorded that
        self-referential result as "a hard external-tool constraint, not a preference".
    A symlinked handle was never in either step's candidate set.
  confirming_evidence:
    - "docs/phase34-host-tool-seam-decisions.md A-07 states the reason verbatim as `installTargetDir(root) = join(root, 'tools')` already being there, and calls it 'the ONLY placement'."
    - "40-01-SUMMARY.md:60 and :167 name the verification as `hasDotPrefixedSegment()` on a synthetic path -- this project's own predicate (ghidra-project.mts:322), not Ghidra."
    - "40-01-SUMMARY.md D5 carries `verification: []` and `human_judgment: true` -- a contemporaneous admission it was never measured."
    - "notes/ghidra-dot-path-check-semantics.md: 5 live runs + javap show ProjectLocator calls getAbsolutePath() and never getCanonicalPath(); two symlinked handles were ACCEPTED, one through a full import+analysis."
    - "A-07's own stated reason is now dead: install-resources.ts:100-102 returns .c64-re-tools/bin, and ghidra-project.mts:396 is the last production writer under tools/ (git ls-files tools/ = 0)."
  falsification_test: |
    A live analyzeHeadless run through a non-dotted symlink into a dotted parent that
    REFUSED would disprove it. Run C in the note is exactly that experiment and it
    succeeded end-to-end ("REPORT: Analysis succeeded", 2.1M of DB under .c64-re-tools/).
  fix_rationale: |
    Root cause is a location decision justified by an unmeasured inference, so the fix is
    to re-point the runs root under the one root and hand Ghidra a broker-minted,
    non-dotted, workspace-internal, RELATIVE-target symlink handle -- plus correct the
    four documents that record the inference as external fact.
  blind_spots:
    - "Whether Ghidra's dot check also binds -import / -scriptPath / -postScript export paths is UNMEASURED (only the project location was tested). It matters only if a caller routes those through the handle -- which the recommendation forbids."
    - "The symlink route depends on getAbsolutePath() staying getAbsolutePath() upstream. Already tracked: .planning/todos/pending/2026-09-08-guard-ghidra-symlink-project-location.md."
    - "Windows has no equivalent symlink guarantee without privilege; the broker is POSIX-only today, so this is out of scope but undocumented."
  candidate_causes:
    - "code: resolveGhidraProject() hardcodes join(repoRoot, 'tools', ...) instead of deriving from the one root (ghidra-project.mts:396)"
    - "config: .gitignore carries TWO ghidra-runs stanzas whose comments assert the exception as fact (.gitignore:19-24, :27-36, :137-144)"
    - "environment: the container/host split makes the naive fix (dotted path, or /tmp) fail two DIFFERENT ways -- Ghidra's absolutized dot check, and containerPath() throwing on an out-of-workspace host path"
    - "data/process: the decision record itself (A-07 'ONLY placement', 40-01 'hard external-tool constraint') is the artefact that froze the wrong option space"
  and_gate: |
    YES -- this failure needed >1 condition simultaneously. Ghidra's dot refusal ALONE does
    not force a second root (measured: symlink works). containerPath()'s throw-on-unknown-root
    ALONE does not either. It is the CONJUNCTION (no dotted segment AND must stay inside the
    bind-mounted workspace AND -- unrecorded until now -- the container itself traverses the
    link to read the run log) that eliminated every naive location and left `tools/` looking
    like the only survivor. The genuine third condition (ghidra-run.ts:241 reads the run log
    container-side) was never written down anywhere, which is why /tmp still looked plausible
    to the owner.

hypothesis_status: CONFIRMED
next_action: Return ROOT CAUSE FOUND (goal: find_root_cause_only -- do not fix).

## Symptoms

expected: |
  Every tool-written file lands under one repo-root directory (D-33) --
  <repoRoot>/.c64-re-tools/ -- including Ghidra per-run project data.
  `grep -ac 'ghidra-runs' .gitignore` should be 0.

actual: |
  ghidra.analyze's per-run project directories are created under
  <repoRoot>/tools/ghidra-runs/, a second tool-written root. Recorded as a
  permanent documented exception in src/mcp/vice/ghidra-project.mts
  (GHIDRA_RUNS_DIR_NAME doc comment, lines 72-94), mirrored into CLAUDE.md and
  .planning/phases/40-.../40-01-SUMMARY.md, with `tools/ghidra-runs` in
  .gitignore.

  Owner verbatim: "cant it be linked in from the tmp folder? / I dont want it
  under tools, there must be a better palce. the sym link must be created by
  the broker so the mcp and other toolning it still working from inside a
  devcontainer"

  R1. The non-dotted handle must NOT live under tools/.
  R2. The symlink must be created BY THE BROKER (host side), so the MCP server
      and other tooling keep working from inside a devcontainer.

errors: |
  Real Ghidra 12.1.3: IllegalArgumentException: Path element starting with '.'
  is not permitted

reproduction: |
  UAT test 1 in .planning/phases/40-the-three-preprocessing-host-tools/40-UAT.md
  (gap G-40-1). Inspect src/mcp/vice/ghidra-project.mts + ghidra-project.test.ts
  + every consumer of the run-directory path.

started: |
  Introduced by plan 40-01 (2026-09-08), which flagged it human_judgment: true
  rather than solving it. The tools/ location itself predates 40-01 (Phase 34,
  plan 34-03, A-07).

prefilled_measured_evidence: |
  CONTROL: literal <...>/.c64-re-tools/runs/ghidra/dotrun -> IllegalArgumentException
  SYMLINK: <...>/tools/ghidra-runs/linkrun -> <...>/.c64-re-tools/runs/ghidra/linkrun
           -> "Creating project:" SUCCEEDED; linkrun.gpr + linkrun.rep/ landed
           PHYSICALLY under .c64-re-tools/; tools/ held only the symlink.
  => The refusal is a STRING check on the literal path argument
     (NamingUtilities.checkName -> GhidraURL.checkValidProjectPath). It does not
     canonicalise and does not resolve symlinks.

## Eliminated

<!-- APPEND only -->

## Evidence

- timestamp: 2026-09-08T00:00:00Z
  checked: src/mcp/vice/ghidra-project.mts, full file
  found: |
    Line 396: `const runsRoot = join(repoRoot, "tools", GHIDRA_RUNS_DIR_NAME);`
    -- the "tools" literal is inline in resolveGhidraProject(), NOT derived from
    repo-root.ts's toolsDir(). GHIDRA_RUNS_DIR_NAME = "ghidra-runs" (line 94).
    Doc comment lines 72-94 asserts: "Re-pointing GHIDRA_RUNS_DIR_NAME under
    .c64-re-tools/ would therefore make resolveGhidraProject() refuse EVERY
    call, unconditionally -- verified directly: hasDotPrefixedSegment on a
    synthetic .c64-re-tools/runs/ghidra/<runId> path reports { dotted: true,
    segment: ".c64-re-tools" }. This is a hard external-tool constraint, not a
    preference".
  implication: |
    The "verification" cited is of THIS PROJECT'S OWN string check
    (hasDotPrefixedSegment), not of Ghidra's behaviour with a symlink. The
    conclusion "hard external-tool constraint" is an inference from a
    self-referential check. Also: the comment already anticipates the fix --
    "a follow-up todo tracks whether a future non-dot-prefixed alias could
    reunify it".

- timestamp: 2026-09-08T00:10:00Z
  checked: The ORIGINAL decision record for the location -- docs/phase34-host-tool-seam-decisions.md A-07, and .planning/phases/34-.../34-03-PLAN.md:89-94
  found: |
    A-07 (verbatim): "The Ghidra per-run project root is <repoRoot>/tools/ghidra-runs/<runId>.
    `install-resources.ts`'s `installTargetDir(root) = join(root, "tools")` is already
    non-dot-prefixed and already inside the bind-mounted workspace -- the ONLY placement
    satisfying both Finding 2's every-segment dot rule and the requirement that a result path
    be translatable by containerPath(). `.vice-supervisor/` and `.planning/` are disqualified
    as ancestors at any depth."
  implication: |
    The candidate set A-07 evaluated was "existing REAL directories already in the tree". A
    symlinked handle was never a candidate. The word "ONLY" is therefore true of that set and
    false of the full option space. Root cause step 1.

- timestamp: 2026-09-08T00:12:00Z
  checked: install-resources.ts:100-102 (installTargetDir), and every production writer under <root>/tools
  found: |
    installTargetDir(root) now returns join(root, ".c64-re-tools", "bin") -- moved 2026-09-08
    by D-33. `grep -an 'join([a-zA-Z]*, *"tools"' *.ts *.mts` finds exactly ONE production
    hit left: ghidra-project.mts:396. `git ls-files tools/` returns ZERO tracked files.
  implication: |
    A-07's stated reason evaporated on the same day the exception was recorded. `tools/`'s
    only remaining production writer is the one the owner objects to. The .gitignore stanza's
    claim that tools/ "also holds tracked reverse-engineering tooling (d64-parse.mjs,
    diff-images.mjs, watch-loads.mjs, recovery-schema.mjs, releases.mjs and their tests) that
    must stay tracked" (.gitignore:32-35) is FALSE -- those files live under
    src/skills/*/scripts/. So the reason tools/ is not blanket-ignored is fictional too.

- timestamp: 2026-09-08T00:14:00Z
  checked: .planning/phases/40-.../40-01-SUMMARY.md:60, :106-112, :167
  found: |
    key-decisions[0]: "Verified directly (hasDotPrefixedSegment on a synthetic
    .c64-re-tools/runs/ghidra/<runId> path) and against ghidra-project.test.ts's own pinned
    tools/ghidra-runs literal."
    :167: "a hard external-tool constraint ... discovered by direct verification
    (hasDotPrefixedSegment() on a synthetic path)".
    D5's own verification list is EMPTY (`verification: []`, `human_judgment: true`).
  implication: |
    hasDotPrefixedSegment() is THIS PROJECT'S OWN predicate (ghidra-project.mts:322). The
    "direct verification" measured the project's own string check, and the second corroborant
    was the project's own pinned test literal. Neither observes Ghidra. A self-referential
    check was recorded as external-tool evidence and promoted to a permanent constraint.
    Root cause step 2 -- and D5's empty verification + human_judgment:true is the
    contemporaneous admission that it was never measured.

- timestamp: 2026-09-08T00:18:00Z
  checked: .planning/notes/ghidra-dot-path-check-semantics.md (5 live runs + javap on ProjectLocator, 12.1.3)
  found: |
    ProjectLocator calls java.io.File.getAbsolutePath() and NEVER getCanonicalPath().
    Consequences measured: a RELATIVE location is absolutized against the cwd and refused (D);
    a literal `.` segment survives and is refused (E); a SYMLINK is not resolved, so both
    symlinked handles were ACCEPTED (A = project creation; C = full import + "REPORT: Analysis
    succeeded", 2.1M of program DB physically under .c64-re-tools/).
  implication: |
    Refines (and partly corrects) the prompt's own framing: the check is not a pure string
    test -- it DOES absolutize. Design consequences: the handle must be passed ABSOLUTE, must
    contain no `.`-prefixed and no bare `.` segment anywhere, and may be a symlink.

- timestamp: 2026-09-08T00:22:00Z
  checked: host-tool-client.ts:31-40, :312-322, containerpath.ts:120-158
  found: |
    host-tool-client.ts:320 maps EVERY response path through containerPath(). containerPath()
    THROWS when the host path matches no member of hostRootCandidates() -- containerpath.ts:141
    ("does not match any known host root -- translation is impossible, not merely unknown").
  implication: |
    HARD CONSTRAINT C2: the handle must live INSIDE the workspace tree. A host /tmp (or
    XDG-cache) handle makes ghidra.analyze throw on the container route -- the exact opposite
    of R2's stated purpose. The owner's "tmp folder" idea is refuted by this project's own code.

- timestamp: 2026-09-08T00:24:00Z
  checked: host-tool.mts:1454, ghidra-run.ts:59, :241
  found: |
    host-tool.mts:1454: `const runLogPath = join(dirname(projectLocation), `${projectName}.ghidra-run.log`)`
    -- outputs[0] is a SIBLING of the project dir, i.e. inside the runs root.
    ghidra-run.ts:241: `readFileSync(resolvePath(runLogResult.path), "utf8")` -- the CONTAINER
    side opens that path after translation.
  implication: |
    HARD CONSTRAINT C3: the container actually TRAVERSES the handle symlink. Its target must
    therefore be RELATIVE (".c64-re-tools/runs/ghidra"), because an absolute HOST target
    names a path that does not exist inside the container -> ENOENT on every run-log read.
    This is the real reason R2 says "created by the broker": creation must be host-bound code,
    and the target must be mount-agnostic.

- timestamp: 2026-09-08T00:27:00Z
  checked: host-tool.mts:1123-1158 (resolveWorkspacePath) and 1108-1117 (realpathOfNearestExisting)
  found: |
    resolveWorkspacePath() REALPATHS its result (realpathSync), and returns the real path by
    deliberate decision A-16. Every caller-supplied path field (importPath, scriptPath,
    preScript, entrypointsPath, postScript, exportPath, dataRangesPath) goes through it.
  implication: |
    A caller-supplied path routed THROUGH the handle would be collapsed back to the dotted
    real path. The handle is therefore usable ONLY for the two paths that are never
    realpath'd: the computed projectLocation (resolveGhidraProject) and its sibling run log.
    That is a statable invariant and needs a guard.

- timestamp: 2026-09-08T00:29:00Z
  checked: ghidra-project.mts:429-436 (mkdirSync recursive) vs a missing handle
  found: |
    resolveGhidraProject() ends with mkdirSync(projectLocation, { recursive: true }).
  implication: |
    DANGEROUS FAILURE MODE of the symlink design: if the handle link is absent, recursive
    mkdir silently creates a REAL directory tree at the handle path -- Ghidra succeeds, the
    run "works", and D-33 is violated invisibly. The ensure-handle helper must verify
    lstat().isSymbolicLink() + readlink() equals the expected relative target, and
    resolveGhidraProject() must REFUSE BY NAME rather than mkdir through an unverified handle.

- timestamp: 2026-09-08T00:32:00Z
  checked: The three host-side entry points that reach resolveGhidraProject()
  found: |
    1. broker: vice-broker.mts:71 imports runHostTool from ./host-tool.mjs; run() at :1077 is
       the startup body and holds args.repoRoot (parseArgs :104-133, --repo-root required).
    2. brokerless host route: host-tool-client.ts:269-273 spawns
       resources/host-tool.mjs run --repo-root ... (exists for CI; and this host has no
       devcontainer, so it is the everyday route here).
    3. tests importing resources/host-tool.mjs directly (ghidra-live.test.ts:82-91,
       host-tool.test.ts:2167).
  implication: |
    A broker-ONLY creator satisfies R2 literally but breaks routes 2 and 3. One
    implementation in ghidra-project.mts, called from the broker startup (R2) AND from
    resolveGhidraProject() as an idempotent precondition, satisfies both with a single owner
    of the "how".

- timestamp: 2026-09-08T00:35:00Z
  checked: repo-root.ts:185-207 (toolsDir doc comment)
  found: |
    Claims (a) "the Ghidra runs directory" is one of six writers that "now all resolve their
    subdirectory through THIS function", and (b) 'the literal string ".c64-re-tools" therefore
    has exactly one non-comment occurrence in this codebase: the line below'.
  implication: |
    (a) is FALSE -- ghidra-project.mts:396 joins "tools" itself. (b) is FALSE -- three
    production non-comment occurrences exist (install-resources.ts:101, vice-broker.mts:131,
    host-tool.mts:2934), each for the documented no-import-cycle / host-bound reason. Both
    claims are load-bearing documentation and must be corrected.

## Resolution

root_cause: |
  A location decision justified by an inference that was never measured, compounded across
  two phases.
  (1) Phase 34 plan 34-03 assumption A-07 placed the Ghidra runs root at
      `<repoRoot>/tools/ghidra-runs/` because `install-resources.ts`'s then-current
      `installTargetDir(root) = join(root, "tools")` was already a non-dotted directory
      inside the bind-mounted workspace, and recorded that candidate set -- existing REAL
      directories -- as the entire option space ("the ONLY placement satisfying both
      Finding 2's every-segment dot rule and the requirement that a result path be
      translatable by containerPath()"). A symlinked HANDLE was never a candidate.
  (2) Phase 40 plan 40-01 (D-33) then had to move it, ran this project's OWN
      `hasDotPrefixedSegment()` against a synthetic `.c64-re-tools/runs/ghidra/<runId>`
      string, and recorded the resulting refusal as "a hard external-tool constraint, not a
      preference" (ghidra-project.mts:88-90), mirroring it into CLAUDE.md, .gitignore and
      40-01-SUMMARY.md. That check observes the project's own predicate, not Ghidra.
  MEASURED FALSE: Ghidra's ProjectLocator calls getAbsolutePath() and never
  getCanonicalPath(), so it absolutizes but does not resolve symlinks -- a non-dotted
  symlink handle into `.c64-re-tools/` is accepted through a full import plus analysis.
  Contributing (AND-gate): the real constraint set is a CONJUNCTION of three conditions,
  the third of which was never written down -- no dotted/bare-dot segment in the
  absolutized path, the path must stay inside the bind-mounted workspace (containerPath()
  THROWS otherwise, host-tool-client.ts:320 / containerpath.ts:141), and the CONTAINER
  itself traverses the handle to read the run log (ghidra-run.ts:241). The missing third
  condition is why `/tmp` still looked plausible.
  Aggravating: A-07's own stated reason died on 2026-09-08 -- installTargetDir() now
  returns `.c64-re-tools/bin`, and `git ls-files tools/` is empty, so `tools/` is a
  vestigial directory whose sole remaining production writer is the objected-to one.

fix: "not applied -- diagnose-only mode (goal: find_root_cause_only)"
verification: "n/a"
files_changed: []

## Consumer Census (grep -a, node_modules/.git/worktrees excluded)

### Production code (4 sites, 1 authoritative)
- src/mcp/vice/ghidra-project.mts:94   GHIDRA_RUNS_DIR_NAME = "ghidra-runs"
- src/mcp/vice/ghidra-project.mts:396  join(repoRoot, "tools", GHIDRA_RUNS_DIR_NAME)  <-- THE defect
- src/mcp/vice/ghidra-project.mts:72-94 the doc comment recording the exception as fact
- src/mcp/vice/resources/ghidra-project.mjs:98,:347 the COMPILED mirror (build.ts; resources-sync.test.ts reds CI on drift)
- (indirect, no literal) host-tool.mts:1454 runLogPath = join(dirname(projectLocation), ...) -- inherits the location

### Config (3 stanzas, 2 files)
- .gitignore:19-24  the /.c64-re-tools/ stanza's "NOT covered by this stanza" carve-out comment
- .gitignore:27-36  /tools/ghidra-runs/  (+ the FALSE "tools/ holds tracked tooling" claim)
- .gitignore:137-144 /src/mcp/vice/tools/ghidra-runs/  (the nested-repo-root second entry)

### Tests (5 files)
- ghidra-project.test.ts:71,76,140,141,198,206 + ~30 pinned "/repo/tools/ghidra-runs/r1" literals
- host-tool.test.ts:1144,1148,1273-1274,2167-2168
- ghidra-live.test.ts:29,57,244,267,938,980,1484  (reconstructs the run-log path itself)
- (no structural gate pins it: ghidra-harness-gates.test.ts / test-gate.test.ts / hostpath-consumers.test.ts / docs-linerefs.test.ts have ZERO hits)
- fixtures/ghidra/runlog-benign-base0-conflict.txt, runlog-script-error.txt (captured real logs; paths are historical data, no change needed)

### Docs asserting the exception (must be corrected)
- CLAUDE.md            -- Configuration section, the D-33 bullet's ghidra.analyze exception
- .planning/STATE.md:1111 -- "Verified directly" decision entry
- .planning/phases/40-.../40-01-SUMMARY.md:12,60,61,99,107,159,167 + D5 rationale
- .planning/phases/40-.../40-UAT.md:52-57 -- carries the superseded "does NOT canonicalise" framing (it DOES absolutize)
- .planning/todos/completed/2026-09-07-consolidate-...md -- the Ghidra addendum
- docs/phase34-host-tool-seam-decisions.md A-07 -- "the ONLY placement"
- .planning/phases/34-.../34-03-PLAN.md:89-94, 34-03-SUMMARY.md, 34-VERIFICATION.md
- src/mcp/vice/repo-root.ts:185-207 -- two independently FALSE claims (see Evidence 2026-09-08T00:35)
- src/mcp/vice/host-tool.mts:2932 -- cites "ghidra-project.mts's runs root" as following the .c64-re-tools convention it does not follow
- ALREADY CORRECT (the corrective record): .planning/notes/ghidra-dot-path-check-semantics.md, .planning/REQUIREMENTS.md PREP-05
