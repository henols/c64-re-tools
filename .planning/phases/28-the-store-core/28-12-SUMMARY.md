---
phase: 28-the-store-core
plan: 12
subsystem: infra
tags: [symlink, confinement, path-resolution, lstat, readlink, node-fs, security]

requires:
  - phase: 28-the-store-core
    provides: "28-09's live-symlink confinement fix and its six-case anno-confinement.test.ts control set — the untouched regression surface this plan extends rather than edits"
  - phase: 28-the-store-core
    provides: "28-08's openStore error wrapper, which is why an openStore-only test of the dangling DIRECTORY case would have passed against the broken predicate for an unrelated reason"
provides:
  - "A workspace confinement that stops the ancestor walk at a path ENTRY (lstat) rather than at a path that RESOLVES (existsSync), so a dangling symlink cannot place a store outside the workspace root"
  - "A bounded manual resolution of a dangling stopping entry: readlinkSync resolved against the link's own directory, MAX_SYMLINK_HOPS = 40 (Linux's MAXSYMLINKS)"
  - "Six new confinement cases (7-12): dangling leaf, dangling directory at the predicate, the dangling over-refusal control, the symlink cycle, the boundary one step either side, and idempotency"
  - "Two residuals stated in the test file's header where the guarantee is claimed: the check-then-open window and the byte-wise non-normalising comparison"
affects: [store-core, annotation-store, path-confinement]

actuals:
  tokens: 7145
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Entry-existence vs path-resolution: lstatSync(p, { throwIfNoEntry: false }) is the question a confinement check asks; existsSync is a different question that follows links"
    - "A manual symlink hop resolves the target against dirname(link), never the process cwd, and is bounded by the kernel's own MAXSYMLINKS so the two never disagree about an input"
    - "A refusal control is paired with a FOLLOW control that was confirmed to redden against a deliberately over-broad implementation, rather than argued"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-confinement.test.ts
    - src/mcp/vice/anno-types.test.ts
    - .planning/todos/completed/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md

key-decisions:
  - "Path-entry existence is decided with lstatSync(p, { throwIfNoEntry: false }) rather than existsSync: the two answers differ for exactly one input class — a symlink whose target is absent — and that class is the whole of CR-04"
  - "A dangling stopping entry is resolved by hand with readlinkSync against dirname(current), never the process cwd, because a relative target (../outside/x) is the common form and resolving it against the cwd is the one way a naive fix gets this wrong"
  - "MAX_SYMLINK_HOPS = 40 is Linux's own MAXSYMLINKS, so a chain this walk refuses is a chain the kernel would refuse too — the bound is a named number rather than a comfort number"
  - "storePathWithinWorkspace was deliberately NOT edited: the defect is one level down, and editing the caller would obscure which function was wrong"
  - "The check-then-open window is recorded as a stated limit, never as handled: node:sqlite's DatabaseSync takes a path rather than a file descriptor, so no O_NOFOLLOW/openat route exists at this layer"
  - "Test 9 carries TWO assertions because they redden against different wrong implementations — 'not refused' is the over-refusal control (red under a blanket symlink refusal), 'FOLLOWED to the target' is red under the pre-change code, which returned the link's own path"

patterns-established:
  - "Reversal-recording in a doc comment: keep the premise that was right (deepest existing ancestor), name the sentence that became false, and quote the observed reproduction rather than deleting the paragraph"
  - "A test whose regression failure mode is a TIMEOUT rather than a diff says so in its own comment, so a reader of a red run expects the right shape"

requirements-completed: [STORE-01]

coverage:
  - id: D1
    description: "A DANGLING leaf symlink pointing outside the workspace root is refused with AnnoStorePathError and nothing is created outside the root — the end-to-end half the verifier's finding actually was"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#7. a DANGLING leaf symlink pointing outside the workspace is REFUSED, and nothing is created outside the root"
        status: pass
    human_judgment: false
  - id: D2
    description: "A DANGLING directory symlink pointing outside the root is refused AT THE PREDICATE — the half that carries the finding, since an openStore-only assertion passes against the broken predicate for an unrelated reason"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#8. a DANGLING directory symlink pointing outside the workspace is REFUSED at the predicate, and nothing is created outside the root"
        status: pass
    human_judgment: false
  - id: D3
    description: "The over-refusal control survives in its dangling form: a dangling link pointing INSIDE the workspace is not refused AND is followed to its target location under the root"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#9. a dangling link pointing INSIDE the workspace is still FOLLOWED -- the over-refusal control, restated for the dangling case"
        status: pass
      - kind: other
        ref: "hand probe: an over-broad implementation (throw whenever the stopping entry is a symlink) reddens tests 2, 6 and 9 while leaving 1 and 7 green"
        status: pass
    human_judgment: false
  - id: D4
    description: "A symlink cycle refuses with AnnoStorePathError naming the 40-hop bound, inside two seconds, rather than looping"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#10. a symlink CYCLE refuses with AnnoStorePathError naming the hop bound, rather than looping"
        status: pass
      - kind: other
        ref: "hand probe: neutering `if (hops > MAX_SYMLINK_HOPS)` produces `test timed out after 8000ms`, confirming the regression shape is a timeout"
        status: pass
    human_judgment: false
  - id: D5
    description: "STORE-01 boundary pinned one step either side: the root itself ACCEPTED, one segment beneath ACCEPTED, <root>/.. REFUSED, sibling-prefix REFUSED"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#11. the boundary, one step either side: the root itself, one segment in, one segment out, and the sibling-prefix"
        status: pass
      - kind: other
        ref: "hand probes: bare `startsWith` reddens tests 5 and 11; dropping the `resolvedPath !== resolvedRoot` arm reddens 11 alone"
        status: pass
    human_judgment: false
  - id: D6
    description: "STORE-01 idempotency: a repeated confinement check returns the byte-identical string on an accepted input, refuses both times on a rejected one, and leaves the workspace listing unchanged"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-confinement.test.ts#12. idempotency: a repeated confinement check returns the identical answer and creates nothing"
        status: pass
    human_judgment: true
    rationale: "The three assertions pass, but the plan's claimed reddening plantings for this case (a memoising implementation, one that creates a directory to make the walk resolve, one that mutates module state) were NOT planted and observed — see Deviations #3. The memoisation arm is independently pinned by anno-types.test.ts's no-module-level-mutable-binding assertion; the other two are argued, not measured. A verifier should treat the reddenability of this specific case as unproven."
  - id: D7
    description: "The two residuals — the check-then-open window and the byte-wise, non-normalising comparison — are stated in anno-confinement.test.ts's header as limits, never as handled cases"
    requirement: "STORE-01"
    verification: []
    human_judgment: true
    rationale: "Whether a stated limit is stated honestly and in the right place is a reading judgment, not an assertion. Nothing here closes either residual and no test may be read as covering them."
  - id: D8
    description: "The CR-04 disposition todo moved from .planning/todos/pending/ to .planning/todos/completed/, with the rename present in the task commit"
    verification:
      - kind: other
        ref: "git log --stat 001144c → `rename .planning/todos/{pending => completed}/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md (100%)`"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/docs-review-disposition.test.ts (7/7)"
        status: pass
    human_judgment: false

duration: 24 min
completed: 2026-08-28
status: complete
---

# Phase 28 Plan 12: Dangling-Symlink Confinement Bypass Summary

**`realpathOfNearestExisting` now stops at a path ENTRY (`lstatSync(p, { throwIfNoEntry: false })`) instead of at a path that RESOLVES (`existsSync`), and resolves a dangling stopping entry by hand with `readlinkSync` against the link's own directory under a 40-hop bound — closing CR-04, where a one-line dangling symlink placed a store file outside the workspace root while the confinement returned an in-workspace path.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-28T08:25:00Z (approx — first read of the plan)
- **Completed:** 2026-08-28T08:49:43Z
- **Tasks:** 2
- **Files modified:** 4 (3 source/test + 1 renamed todo)

## Accomplishments

- **The bypass is closed at its cause.** `existsSync` answers "does this path resolve to something?" — it follows links, so a dangling one reads as absent and the ancestor walk stepped straight *past* it. `pathEntryExists()` asks the question confinement actually needs: "does this NAME exist in its directory?" The two answers differ for exactly one input class, and that class is the whole of CR-04.
- **The dangling stopping entry is resolved by hand**, because nothing else will: `realpathSync` cannot resolve a chain whose end does not exist. The hop reads the link and resolves its target against `dirname(current)`, never the process cwd, and consumes only the link's own name — the segments below it still hang below whatever it resolves to. After a hop the loop re-enters the same walk, so a *chain* of dangling links is one case repeated and a hop landing on a *live* entry falls through to `realpathSync`. There is no third state.
- **The cycle is bounded rather than hoped about.** `MAX_SYMLINK_HOPS = 40` is Linux's own `MAXSYMLINKS`, so a chain this walk refuses is a chain the kernel would refuse too.
- **Six new cases (7-12)** with every claimed reddening planting actually planted and observed, except one, which is declared (see Deviations #3).
- **Tests 1-6 are untouched.** The only removals in `anno-confinement.test.ts`'s diff are header comment lines and the `node:path` import widening — no assertion in the six live-link cases was edited, so they remain the regression surface proving the new walk did not trade one class of escape for another.
- **`storePathWithinWorkspace` was not edited at all.** Its both-sides symmetry, its separator-appended comparison and its doc comment are byte-identical. The defect was one level down.

## Task Commits

1. **Task 1 (tracer, tdd): The walk stops at a path ENTRY, not at a path that resolves — dangling leaf, end to end** — `9e58487` (fix)
2. **Task 2: Expand — dangling directory, the cycle, the boundary and the idempotency pins, and the todo closed** — `001144c` (test)

**Plan metadata:** see the final `docs(28-12)` commit.

## The pre-change RED, verbatim

Recorded by driving the production functions against the pre-change code (no test hooks), before any edit to `anno-types.ts`:

```
target exists before: false
A) confinement ACCEPTED, returned: /tmp/annosym-EL6TbI/ws/p.annostore
A) file created OUTSIDE workspace: true
B dangling dir  -> ACCEPTED: /tmp/annosym-EL6TbI/ws2/escape/q.annostore
C inside-dangling -> returned: /tmp/annosym-EL6TbI/ws3/link
```

Lines A and B reproduce the verifier's own `28-VERIFICATION.md` output for gap 2 exactly — `A) confinement ACCEPTED` / `A) file created OUTSIDE workspace: true`, and at the predicate `B dangling dir -> ACCEPTED`. The leaf link was planted with a **relative** target (`../outside/p.annostore`), which is the form that makes resolve-against-the-link's-directory load-bearing rather than incidental.

As the same RED run through the test file:

```
not ok 7 - 7. a DANGLING leaf symlink pointing outside the workspace is REFUSED, ...
  error: 'Missing expected exception (AnnoStorePathError): ...'
```

Line C is discussed under Deviations #1.

## Test 9 reddens against a deliberately over-broad implementation — confirmed by hand, not assumed

An extra arm was inserted into `realpathOfNearestExisting` — `if (lstatSync(current).isSymbolicLink()) throw new AnnoStorePathError("OVER-BROAD PROBE: ...")`, i.e. refuse whenever the stopping entry is a symlink — and the suite run:

```
ok 1 - 1. a symlinked subdirectory inside the workspace is REFUSED, ...
not ok 2 - 2. a symlink pointing INSIDE the workspace is FOLLOWED, ...
ok 7 - 7. a DANGLING leaf symlink pointing outside the workspace is REFUSED, ...
not ok 6 - 6. a symlinked workspace ROOT does not make every path look foreign
not ok 8 - 9. a dangling link pointing INSIDE the workspace is still FOLLOWED ...
# pass 5
# fail 3
```

The over-broad fix passes **every refusal case** (1 and 7) while reddening **exactly the three discriminating controls** (2, 6 and 9). That is the trap this plan's prohibition names, and test 9 is a control that can actually go red. The probe was removed and the file restored from a byte copy; `grep -c "OVER-BROAD PROBE"` on the committed file returns `0`.

## The other reddening plantings, all observed

| Test | Planted regression | Observed |
|---|---|---|
| 10 (cycle) | `if (false && hops > MAX_SYMLINK_HOPS)` — neuter the bound | `not ok 1 - anno-confinement.test.ts` / `error: 'test timed out after 8000ms'`. The failure shape is a **timeout, not a diff**, exactly as the test's own comment warns. |
| 11 (sibling-prefix) | `startsWith(resolvedRoot)` — drop the appended separator | tests **5 and 11** red, 10 pass / 2 fail |
| 11 (root itself) | drop the `resolvedPath !== resolvedRoot` arm | test **11 alone** red, 11 pass / 1 fail |
| 8 (dangling dir, predicate) | none needed — the pre-change code IS the regression | `B dangling dir -> ACCEPTED`, above |

Test 8's `openStore` half is present for the nothing-created assertion but is explicitly **not** the half carrying the finding, and its comment says so: `28-VERIFICATION.md` records that driving `openStore` for the dangling-directory case throws `AnnoStorePathError` for an *unrelated* reason — `DatabaseSync` cannot create a file under a non-existent directory, and 28-08's wrapper converts that into a path error — so an `openStore`-only version of this test would have passed today, against the broken predicate, for the wrong reason.

## The CR-04 todo, closed

- **From:** `.planning/todos/pending/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md`
- **To:** `.planning/todos/completed/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md`
- **Filename:** byte-identical. **Rename is in the commit**, not only the working tree — `git log --stat 001144c` shows `rename .planning/todos/{pending => completed}/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md (100%)`.

Its three "What resolving it requires" bullets, each mapped to what discharges it:

| Todo bullet | Discharged by |
|---|---|
| "`realpathOfNearestExisting` must stop at a path entry that **is** a symlink, dangling or not, rather than at the first path entry that fails `existsSync`. `lstatSync` distinguishes the two" | `pathEntryExists()` in `anno-types.ts` (`lstatSync(p, { throwIfNoEntry: false }) !== undefined`), driving the walk's `while (!pathEntryExists(current))` condition, plus the manual `readlinkSync` hop for the dangling stopping entry. Proven by **tests 7 and 8**. |
| "`anno-confinement.test.ts` needs the dangling-link case added alongside its six live-link cases, with the planted red observed" | **Test 7** (dangling leaf, relative target, both halves) and **test 8** (dangling directory, asserted at the predicate). The planted red is recorded verbatim above for both. |
| "The over-refusal control must be kept: an inside-pointing link, live or dangling, must still be followed" | **Test 9** (dangling, inside-pointing — two assertions), with tests **2 and 6** unedited for the live case. All three confirmed to redden against the over-broad implementation. |

**On the disposition guard:** `docs-review-disposition.test.ts` accepts a todo in `pending` *or* `completed`, so the move did not turn it from red to green — it passed before and after. What the move and this SUMMARY change is *which* disposition the guard finds: CR-04 is now dispositioned by a SUMMARY recording it as **closed with evidence**, rather than by a todo recording it as **open and unfixed**. Stating that plainly rather than claiming a reddened guard.

## The two residuals — stated limits, not closed

Both are recorded in `anno-confinement.test.ts`'s header, beside the controls, so the next reader of the file finds the limit where the guarantee is claimed:

1. **The check-then-open window.** The confinement decision and the file creation are two separate filesystem operations. A link planted *between* them redirects the write, and every refusal test in the file would still pass. **There is no honest fix at this layer:** `node:sqlite`'s `DatabaseSync` constructor takes a **path**, not a file descriptor, so there is no `O_NOFOLLOW`/`openat` route to making the check and the open one operation. No test here covers this, and none may be read as covering it.
2. **The comparison is byte-wise and normalises nothing.** `storePathWithinWorkspace` compares resolved path *strings* with the platform separator appended and applies no Unicode normalisation. Two paths differing only in normalisation form are two distinct paths here, and a filesystem that normalises on its own may accept a path this check computed differently. Normalising here would introduce a second truth disagreeing with the filesystem, so the divergence is recorded rather than papered over.

Neither is described anywhere as handled, in the code, the commits or this SUMMARY.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` — `MAX_SYMLINK_HOPS = 40`, module-private `pathEntryExists()`, `realpathOfNearestExisting` rewritten as an outer loop around the existing upward walk with a bounded manual symlink hop; `lstatSync`/`readlinkSync` failures rethrown as `AnnoStorePathError`; the `node:fs` import widened with two named bindings (no new specifier); the reversal recorded in the doc comment with the observed reproduction quoted. `storePathWithinWorkspace` unchanged.
- `src/mcp/vice/anno-confinement.test.ts` — six new cases (7-12), two stated residuals in the header, three existing header paragraphs widened to describe a twelve-test file. Tests 1-6 unedited.
- `src/mcp/vice/anno-types.test.ts` — one stale comment clause corrected (Deviations #2). No assertion changed.
- `.planning/todos/completed/2026-08-28-phase-28-review-cr-04-dangling-symlink-confinement-bypass.md` — moved from `pending/`, content unchanged (100% rename).

## Decisions Made

See `key-decisions` in the frontmatter. The one worth restating in prose: **`storePathWithinWorkspace` was not touched.** Its doc comment already stated the right contract and its comparison was already boundary-safe; the function that was wrong was the one below it. Editing the caller to "make the tests pass" would have moved the fix away from the defect and left the next reader unable to tell which function had been broken.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own prediction] Test 9 is RED before the fix, not green**

- **Found during:** Task 1, at the RED step.
- **Issue:** The plan states test 9 "passes before AND after, which is the point: it is the control that a wrong fix would redden." It does not. Against the pre-change code, `storePathWithinWorkspace(<ws>/link, ws)` returns **the link's own path** — `C inside-dangling -> returned: /tmp/annosym-EL6TbI/ws3/link` — because the `existsSync` walk stepped past the dangling link and re-joined `link` as an ordinary tail segment. The link was never *followed*; it was merely not refused. The plan's `must_haves` truth 2 and the todo's third bullet both require the stronger property ("is still FOLLOWED, and the store lands at the link's target location inside the root"), which the pre-change code does not provide.
- **Fix:** Test 9 now carries **two** assertions, with a comment explaining that they redden against *different* wrong implementations: (a) *not refused and inside the root* — the over-refusal control proper, which holds pre-change and reddens under a blanket symlink refusal; (b) *equal to the link's target under the root* — which is red pre-change and says the walk RESOLVES a dangling link rather than merely tolerating it. Splitting them keeps the plan's intended control while also asserting the must-have's actual claim. Nothing was weakened.
- **Files modified:** `src/mcp/vice/anno-confinement.test.ts`
- **Verification:** Both assertions green after the fix; assertion (a) confirmed red under the over-broad probe, assertion (b) confirmed red against the pre-change code.
- **Committed in:** `9e58487`

**2. [Rule 1 - Stale comment the change made false] `anno-types.test.ts`'s specifier rationale said `node:fs` was "existsSync and realpathSync, nothing more"**

- **Found during:** Task 1, after widening the `node:fs` import.
- **Issue:** The four-entry specifier pin's `deepEqual` message asserted that `node:fs` is used for "existsSync and realpathSync, nothing more". After this change it is those two plus `lstatSync` and `readlinkSync`. Leaving it is exactly the shape 28-07 P3 forbids — a comment asserting something the code does not do — and the file is unlisted in this plan's `files_modified`, so the honest options were to fix it and declare it, or to ship a false comment. Fixed and declared.
- **Fix:** One clause replaced with a dated record of the growth (what the minimum was, what it is now, and why — `existsSync` follows links, so a dangling one read as absent), in the module's established reversal-recording style. **No assertion was changed**: the specifier `deepEqual`, its length assertion and all three targeted absence assertions are byte-identical.
- **Files modified:** `src/mcp/vice/anno-types.test.ts`
- **Verification:** `node --test anno-types.test.ts` → 15/15. Checked first that no doc or test cites `anno-types.test.ts` by line number, so the edit could not shift a line reference.
- **Committed in:** `9e58487`

**3. [Declared, NOT auto-fixed] Test 12's reddening plantings were argued rather than planted**

- **Found during:** Task 2.
- **Issue:** For tests 8, 10 and 11 the plan named a specific regression to plant, and each was planted and its red observed (table above). For test 12 the plan names three — "any implementation that memoises, creates a directory to make the walk resolve, or mutates module state to short-circuit the second call" — and **none was planted**. Two of the three are also awkward to plant honestly: a memoising or state-mutating implementation reddens `anno-types.test.ts`'s no-module-level-mutable-binding assertion *first*, so it would be caught by a different test rather than by test 12; and a directory-creating implementation does not fire on test 12's fixtures (both inputs have a single-segment tail).
- **Why not fixed:** Constructing an implementation that reddens test 12 *and only* test 12 is a test-design exercise beyond this plan's scope, and inventing a probe that fires for an unrelated reason would be worse than declaring the gap. Recorded here and in the `coverage` block (D6 carries `human_judgment: true`) rather than presented as measured.
- **Impact:** Test 12's three assertions pass and are non-vacuous in shape (the listing comparison genuinely observes the filesystem), but its **reddenability is unproven**. A verifier should treat D6 as asserted-not-demonstrated. The memoisation arm is independently pinned elsewhere, as noted above.

---

**Total deviations:** 2 auto-fixed (2 × Rule 1: one plan misprediction corrected by strengthening a control, one stale comment corrected), 1 declared and not fixed.
**Impact on plan:** No scope creep. Deviation 1 makes a control strictly stronger than planned; deviation 2 is a three-line comment correction with no assertion touched; deviation 3 is a declared evidence gap, recorded rather than papered over.

## Verification Results

All run scoped, per this repo's rule that the full workspace suite (~19 min, with a hang in `vice-proxy.test.ts`) is not a test result:

```
node --test anno-store.test.ts anno-types.test.ts anno-confinement.test.ts \
             anno-seam.test.ts anno-index.test.ts anno-overlap.test.ts \
             anno-durability.test.ts block-class.test.ts
# tests 150   # pass 150   # fail 0

node --test anno-confinement.test.ts     # tests 12   # pass 12   # fail 0
node --test hostpath-consumers.test.ts   # tests 11   # pass 11   # fail 0
node --test docs-review-disposition.test.ts  # tests 7  # pass 7  # fail 0
npx tsc --noEmit -p tsconfig.json        # exit 0
```

- `anno-types.ts`'s **four-entry specifier pin is unchanged** — `["./disasm-opcodes.ts", "./vice.ts", "node:fs", "node:path"]` plus its length assertion, both green, proving two named bindings were added to an existing specifier rather than a fifth specifier added.
- The three targeted absence assertions (`hostpath`, `containerpath`, the SQLite builtin) are all green: `anno-types.ts` still reaches neither path-translation seam.
- `hostpath-consumers.test.ts`'s five-element closed consumer set is at **11/11** and did not move — `anno-types.ts` is still absent from it, as `key_links` requires.
- Test 10 completed well inside its two-second wall-clock guard.

## Issues Encountered

- **A `cd` inside a compound Bash call drifted the working directory** and silently aimed a restore `cp` and a probe at a non-existent relative path (`cp: cannot create regular file 'src/mcp/vice/anno-types.ts': No such file or directory`). Caught immediately by `git diff --stat`, which showed `anno-types.ts` already clean at the committed state; the probe was re-run with absolute paths throughout. No file was left in a probe state — verified by `git diff` and by `grep -c "OVER-BROAD PROBE"` returning 0.
- **A `git add` of the pending todo path failed** (`fatal: pathspec ... did not match any files`) because `git mv` had already staged the rename and the source no longer exists. Re-run against the destination path only; the rename is in the commit.
- **The deliberate timeout probe leaked one `/tmp` fixture** — `node --test` was killed mid-test, so `inTempDir`'s `finally rmSync` never ran. Removed, along with two pre-existing `annosym*` fixture directories dated 01:00 (before this session, almost certainly the verifier's own reproduction runs). `/tmp` here is a RAM-backed tmpfs whose cleanup is disabled, so this is leaked RAM rather than disk. No fixtures remain.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Verification gap 2 / CR-04 is closed** with a fix at the cause, a test for every dangling shape the verification and the todo name, and the over-refusal control preserved in both its live and dangling forms. `STORE-01`'s blocking half is discharged.
- **Two residuals remain open by design** and are stated in the code: the check-then-open window (no honest fix at this layer) and the byte-wise non-normalising comparison. Neither is a blocker; both should survive into any future re-verification as stated limits rather than being re-discovered as findings.
- **One declared evidence gap:** test 12's reddenability is unproven (Deviations #3, coverage D6). A verifier re-establishing `STORE-01` / `idempotency` should either plant a reddening implementation or record the gap forward rather than reading D6 as demonstrated.
- The three `28-REVIEW.md` blockers CR-01, CR-02 and CR-03 are the concern of plans 28-10 and 28-11, not this one; nothing here touches `anno-store.ts`.

---
*Phase: 28-the-store-core*
*Completed: 2026-08-28*

## Self-Check: PASSED

All modified files present on disk; the CR-04 todo absent from `pending/` and
present in `completed/`; all three commits (`9e58487`, `001144c`, `03edbbf`)
present in `git log`.
