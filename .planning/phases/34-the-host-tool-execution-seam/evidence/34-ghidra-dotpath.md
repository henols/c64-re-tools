# 34-ghidra-dotpath — the live Ghidra observation, side by side with this project's own

**Owner:** plan `34-03`, Task 3. **Measured:** 2026-09-03, on this host, against real Ghidra
12.1.3 at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` and OpenJDK 21.0.12.1. **Bound
by** `evidence/README.md` § *Evidence conventions* and `evidence/SCHEMA.md` § 3 (this phase
directory does not carry its own copy of those files; the convention is inherited from
`.planning/phases/33-.../evidence/33-wallclock-control.md`, whose shape this transcript
mirrors).

**Correction to this plan's own run-time briefing:** the executor's dispatch prompt asserted
"GHIDRA IS NOT INSTALLED ON THIS HOST," having searched `~/ghidra*`, `/opt/ghidra*`,
`/usr/share/ghidra`, `/usr/local/ghidra` and `~/.local/share/ghidra`. None of those paths is
where `34-RESEARCH.md`'s own § *Environment Availability* records the real installation
(`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`) — a directory outside the searched set.
Verified present and functional before any probe below: `support/analyzeHeadless -help` prints
usage, `java -version` reports OpenJDK 21.0.12.1. This transcript is therefore the genuine
LIVE observation the plan's Task 3 requires, not the "unavailable" fallback path.

`PROBE_DIR` (absolute, outside the checkout except where the convention itself requires a
real workspace path — see § *Clean run*, below): a scratchpad temp directory under
`/tmp/claude-1000/.../scratchpad/ghidra-evidence`.

---

## Verdicts

```
LIVE_GHIDRA: available
GHIDRA_DOTPATH_REFUSAL: observed
GHIDRA_DOTPATH_ANCESTOR_REFUSAL: observed
REFUSAL_SITE: pre-analyzeHeadless
PER_RUN_DIR: distinct
DELETE_PROJECT: honoured
SAME_RUN_ID_SECOND_CALL: refused
GHIDRA_VERSION: 12.1.3
JDK_VERSION: OpenJDK 21.0.12.1 (build 21.0.12.1+1-1-deb13u1-Debian)
THIS_PROJECT_REFUSAL_MS: 126
GHIDRA_REFUSAL_MS: 11160
```

**Ratio:** `11160 / 126 ≈ 88.6x`. This project's own refusal is a string comparison over an
already-computed path; Ghidra's own refusal pays a full JVM startup (class search, SSL
context init, RNG init, headless script-path enumeration) before it ever reaches
`ProjectLocator`'s constructor. This is the whole reason the rule lives in `ghidra-project.mts`
rather than being learned by parsing Ghidra's own stderr: two orders of magnitude, on a JVM that
was already warm in the OS page/JIT cache from back-to-back runs in this same session.

---

## 1. Ghidra's own refusal, live

Two shapes, per `34-RESEARCH.md` Finding 2 — a dot in the immediate leaf, and a dot two
segments above a clean leaf. Both pre-created directories confirmed left untouched afterward
(Finding 2's separate claim: `analyzeHeadless` does not create the project location on the
refusal path).

### 1a — dot in the immediate leaf directory

```
$ mkdir -p "$SCRATCH/leaf-test/.dotdir"
$ ls -la "$SCRATCH/leaf-test/.dotdir"          # PRE
total 0
drwxrwxr-x 2 henrik henrik 40 .
drwxrwxr-x 3 henrik henrik 60 ..

$ "$GHIDRA_HOME/support/analyzeHeadless" "$SCRATCH/leaf-test/.dotdir" DotProj \
    -import "$SCRATCH/tiny.bin" -deleteProject
...
ERROR Abort due to Headless analyzer error: Path element starting with '.' is not permitted (HeadlessAnalyzer)
java.lang.IllegalArgumentException: Path element starting with '.' is not permitted
	at ghidra.util.NamingUtilities.checkName(NamingUtilities.java:108)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkValidProjectPath(GhidraURL.java:440)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkLocalAbsolutePath(GhidraURL.java:421)
	at ghidra.framework.model.ProjectLocator.<init>(ProjectLocator.java:75)
	at ghidra.app.util.headless.HeadlessAnalyzer.processLocal(HeadlessAnalyzer.java:420)
	at ghidra.app.util.headless.AnalyzeHeadless.launch(AnalyzeHeadless.java:199)

EXIT=1  ELAPSED_MS=13871

$ ls -la "$SCRATCH/leaf-test/.dotdir"          # POST -- unchanged
total 0
drwxrwxr-x 2 henrik henrik 40 .
drwxrwxr-x 3 henrik henrik 60 ..
```

### 1b — dot two segments above a clean leaf

```
$ mkdir -p "$SCRATCH/ancestor-test/.hidden/leafdir"

$ "$GHIDRA_HOME/support/analyzeHeadless" "$SCRATCH/ancestor-test/.hidden/leafdir" DotParentProj \
    -import "$SCRATCH/tiny.bin" -deleteProject
...
ERROR Abort due to Headless analyzer error: Path element starting with '.' is not permitted (HeadlessAnalyzer)
java.lang.IllegalArgumentException: Path element starting with '.' is not permitted
	at ghidra.util.NamingUtilities.checkName(NamingUtilities.java:108)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkValidProjectPath(GhidraURL.java:440)
	at ghidra.framework.protocol.ghidra.GhidraURL.checkLocalAbsolutePath(GhidraURL.java:421)
	at ghidra.framework.model.ProjectLocator.<init>(ProjectLocator.java:75)

EXIT=1  ELAPSED_MS=11160

$ ls -la "$SCRATCH/ancestor-test/.hidden" "$SCRATCH/ancestor-test/.hidden/leafdir"   # POST -- unchanged
.../.hidden:
drwxrwxr-x 3 henrik henrik 60 .
drwxrwxr-x 3 henrik henrik 60 ..
drwxrwxr-x 2 henrik henrik 40 leafdir

.../.hidden/leafdir:
drwxrwxr-x 2 henrik henrik 40 .
drwxrwxr-x 3 henrik henrik 60 ..
```

Both refused identically, at the same pre-analysis stage, inside `ProjectLocator`'s
constructor — before `HEADLESS: execution starts` is ever logged, and before any project
file is written into either pre-created directory. `TEST_COUNTERPART:` none in the unit
suite — this shape is deliberately excluded from `ghidra-project.test.ts` (it needs a real
Ghidra install); `hasDotPrefixedSegment`'s own unit cases (`ghidra-project.test.ts`, the
"ancestor two segments above a clean leaf" and "dot-prefixed LEAF" cases) are the
install-free proxy for the SAME logical claim.

---

## 2. This project's refusal, live

Driven through the shipped `resources/host-tool.mjs` CLI entry point
(`node resources/host-tool.mjs run --repo-root <path> --request <json>`), with
`GHIDRA_HOME` set to the real installation above. Both shapes tested, since this project's
own refusal reaches the dot rule via two different code paths depending on WHERE the dot
appears: a dot-prefixed `runId` is refused earlier, by `RUN_ID_PATTERN` (no path separator or
dot ever accepted in a run id at all); a dot-prefixed ancestor in `repoRoot` is refused by
`hasDotPrefixedSegment()` over the full computed `projectLocation`, the direct analog of
Ghidra's own per-segment walk.

### 2a — dot two segments above a clean leaf (dotted `repoRoot`, the direct analog)

```
$ mkdir -p "$SCRATCH/.hidden-repo" && cp "$SCRATCH/tiny.bin" "$SCRATCH/.hidden-repo/tiny.bin"

$ GHIDRA_HOME="$GHIDRA_HOME" node resources/host-tool.mjs run \
    --repo-root "$SCRATCH/.hidden-repo" \
    --request '{"tool":"ghidra.analyze","args":{"runId":"r1","importPath":"tiny.bin"}}'
{"ok":false,"message":"resolveGhidraProject refuses a project location containing a dot-prefixed path element (\".hidden-repo\"): path element starting with '.' is not permitted; computed location was $SCRATCH/.hidden-repo/tools/ghidra-runs/r1"}

EXIT=1  ELAPSED_MS=126
```

`pgrep -af analyzeHeadless` immediately after this call found no process — the refusal fires
entirely inside `resolveGhidraProject()`, before `buildAnalyzeHeadlessArgv()` is ever called
and before `spawnHostTool()` is ever reached. `REFUSAL_SITE: pre-analyzeHeadless` is measured
here, not inferred: `runHostTool()`'s own code path returns `{ ok: false, message }` from the
path-resolution branch (`host-tool.mts`'s `ghidra.analyze` arm) strictly before its call to
`buildHostToolArgv()`/`spawnHostTool()` — no child process object is ever constructed for a
refused request.

### 2b — dot in the immediate leaf (dotted `runId`)

```
$ mkdir -p "$SCRATCH/clean-repo" && cp "$SCRATCH/tiny.bin" "$SCRATCH/clean-repo/tiny.bin"

$ GHIDRA_HOME="$GHIDRA_HOME" node resources/host-tool.mjs run \
    --repo-root "$SCRATCH/clean-repo" \
    --request '{"tool":"ghidra.analyze","args":{"runId":"bad.id","importPath":"tiny.bin"}}'
{"ok":false,"message":"resolveGhidraProject \"runId\" must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$ (alphanumeric-first, alphanumeric/dash/underscore only, no separator, no dot, length-capped); got \"bad.id\""}

EXIT=1  ELAPSED_MS=197
```

`TEST_COUNTERPART:` `ghidra-project.test.ts`'s `resolveGhidraProject: refuses a repoRoot that
itself contains a dot-prefixed segment...` case (2a) and `resolveGhidraProject: refuses a run
id with a dot-prefixed component` case (2b) assert the same two refusals, install-free,
against synthetic paths.

---

## 3. One clean run, to prove the happy path is real

**First take — voided, and the reason it was voided is the actual finding.** Before
`ghidra-project.mts`'s `resolveGhidraProject()` was fixed (commit `5694f27`, this same
session), a clean run against a well-formed, not-yet-existing project location FAILED:

```
$ "$GHIDRA_HOME/support/analyzeHeadless" \
    "$REPO/tools/ghidra-runs/clean-run-1" clean-run-1 \
    -import "$REPO/ghidra-probe-tiny-input.bin" -deleteProject
...
INFO  Creating temporary project: .../tools/ghidra-runs/clean-run-1/clean-run-1 (HeadlessAnalyzer)
ERROR Abort due to Headless analyzer error: Directory not found: .../tools/ghidra-runs/clean-run-1 (HeadlessAnalyzer)
java.io.FileNotFoundException: Directory not found: .../tools/ghidra-runs/clean-run-1
	at ghidra.framework.project.DefaultProjectManager.createProject(DefaultProjectManager.java:100)
	at ghidra.app.util.headless.HeadlessAnalyzer.processLocal(HeadlessAnalyzer.java:439)
```

**Finding, escalated rather than hidden:** `analyzeHeadless` does not create the leaf project
directory itself, on EITHER the refusal path (Finding 2, confirmed again in §1 above) OR the
success path (new this session). `resolveGhidraProject()` as Task 1 originally wrote it only
ever CHECKED existence (`existsSync`) — it never created the directory — so the entire
`ghidra.analyze` happy path was non-functional until fixed. Escalated and fixed in the same
session as commit `5694f27` (`fix(34-03): resolveGhidraProject creates the run directory, not
just checks it`): `resolveGhidraProject()` now `mkdirSync`s the location as the LAST step of a
successful resolution, never on a refusal — making a successful resolve a genuine
reservation. `ghidra-project.test.ts` gained a case asserting the directory now exists on
disk after a successful resolve, and the pre-existing idempotency case was re-verified to
still pass unchanged (a repeat `mkdirSync` with `recursive: true` on an existing directory is
a no-op, not a throw).

**Re-take, against the fixed code, in the real repository's own `tools/ghidra-runs/`
convention** (the plan's own artifact list names `<repoRoot>/tools/ghidra-runs/<runId>` as the
directory convention, so this take runs against the real project root rather than a scratch
stand-in):

```
$ cd /home/henrik/dev/henrik/git/c64-re-tools
$ printf '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09' > ghidra-probe-tiny-input.bin

$ GHIDRA_HOME="$GHIDRA_HOME" node src/mcp/vice/resources/host-tool.mjs run \
    --repo-root "$(pwd)" \
    --request '{"tool":"ghidra.analyze","args":{"runId":"clean-run-2","importPath":"ghidra-probe-tiny-input.bin"}}'
{"ok":true,"tool":"ghidra.analyze","exitStatus":0,"results":[],"stderrTail":"openjdk version \"21.0.12.1\" 2026-08-18\nOpenJDK Runtime Environment (build 21.0.12.1+1-1-deb13u1-Debian)\nOpenJDK 64-Bit Server VM (build 21.0.12.1+1-1-deb13u1-Debian, mixed mode)\n"}

PROCESS_EXIT=0  exitStatus=0  ELAPSED_MS=14844

$ ls -la tools/ghidra-runs/clean-run-2       # project directory SURVIVED, empty
total 8
drwxrwxr-x 2 henrik henrik 4096 .
drwxrwxr-x 3 henrik henrik 4096 ..
```

`DELETE_PROJECT: honoured` — the directory survived, but empty: `-deleteProject` removed
every project file it created inside (no `.gpr`, `.rep`, or lock file left behind), but the
containing directory itself is not removed. This is the exact reason `PER_RUN_DIR` is the
PRIMARY mechanism and `-deleteProject` is secondary cleanup on top of it (`ghidra-project.mts`'s
own comment, quoting `analyzeHeadlessREADME.md`): the directory's continued existence is
precisely what makes reuse-refusal possible on the next line.

**Second invocation, SAME run id — refused by this project's code before any launch:**

```
$ GHIDRA_HOME="$GHIDRA_HOME" node src/mcp/vice/resources/host-tool.mjs run \
    --repo-root "$(pwd)" \
    --request '{"tool":"ghidra.analyze","args":{"runId":"clean-run-2","importPath":"ghidra-probe-tiny-input.bin"}}'
{"ok":false,"message":"resolveGhidraProject refuses to reuse an existing run directory (.../tools/ghidra-runs/clean-run-2): a Ghidra project directory is never reused across runs, because reuse is exactly what makes Ghidra's single-writer project lock reachable again -- choose a different runId"}

EXIT=1  ELAPSED_MS=173
```

`SAME_RUN_ID_SECOND_CALL: refused`, measured at 173ms — no JVM process was launched (compare
against the ~11-15s any real `analyzeHeadless` invocation costs above).

**Cleanup after this observation:** `tools/ghidra-runs/` and `ghidra-probe-tiny-input.bin`
were removed from the real repository tree after this transcript was recorded, so no probe
artifact was left in the working tree. `tools/ghidra-runs/` is now `.gitignore`d
(commit `5694f27`) for any future real invocation.

---

## `test:automated` baseline, this session

```
$ pgrep -x x64sc || echo "(no output)"
(no output)
$ systemctl --user is-active vice-broker 2>&1 || echo "not a systemd unit on this host"
```

BROKER_STATE: inactive (no `x64sc` process running during this session's probes)

`npm run test:automated` before this plan's own commits and after: unchanged at 2 failing
tests in `anno-register.test.ts` (the documented pre-existing baseline, per plan 34-01/34-02's
own recorded measurement) — no new failure introduced by this plan.

---

## Sources

- Live probes, this session: real Ghidra 12.1.3 `analyzeHeadless`, four times (§1a, §1b, §3
  first take, §3 re-take) plus one fast reuse-refusal (§3, second invocation) and two fast
  refusals through this project's own CLI (§2a, §2b).
- `34-RESEARCH.md` Finding 2 — the prior session's own probes, re-observed rather than merely
  cited, per this plan's own instruction.
- `src/mcp/vice/ghidra-project.mts` (as written by Task 1, then fixed by commit `5694f27`
  after this Task's own live finding).
- `src/mcp/vice/host-tool.mts` (as written by Task 2) — the `ghidra.analyze` entry whose
  refusal is timed in §2 against Ghidra's own in §1.
