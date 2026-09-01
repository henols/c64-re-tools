---
phase: 29-the-mcp-surface
plan: 14
subsystem: security
tags: [path-confinement, cli, information-disclosure, closed-consumer-set, tdd]

# Dependency graph
requires:
  - phase: 28-the-annotation-store
    provides: "storePathWithinWorkspace() -- the annotation family's ONE confinement seam, and anno-confinement.test.ts's fifteen predicate tests"
  - phase: 29-the-mcp-surface
    provides: "the two-verb anno CLI (29-07, D-14) and the anno-* module family (29-05)"
provides:
  - "All six caller-supplied path arguments on both anno CLI verbs confined through storePathWithinWorkspace() before any filesystem call"
  - "--force on render-memmap, and the shared refuseOverwrite() reached from both verbs that write"
  - "A sidecar parse failure that names the path and the failure without echoing the file's bytes"
  - "anno-cli-path-consumers.test.ts -- the CLOSED CONSUMER SET for the CLI's path arguments, with a hand-pinned floor and two positive controls"
  - "Three headers that describe the code and name the mechanism that keeps it, rather than asserting an unkept guarantee"
affects: [phase-30-acme-oracle, anno-cli-verbs, skill-playbooks-invoking-anno]

actuals:
  tokens: 50797
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Closed consumer set beside a proven predicate: enumerate the CALLERS of a security seam, not only the seam"
    - "Digit-only extraction from a runtime error whose message quotes its input"

key-files:
  created:
    - src/mcp/vice/anno-cli-path-consumers.test.ts
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-memmap-render.ts
    - src/mcp/vice/module-classification.ts

key-decisions:
  - "Confine render-memmap's --provenance BEFORE the existsSync probe, because an existence check is itself an oracle for any path the process can stat"
  - "Confine the DEFAULT output path too, so a derived path is confined by the same rule as a caller-supplied one rather than trusted because the verb computed it"
  - "Report the JSON parse byte OFFSET, never the parser's message: a position is a fact about where parsing stopped, content is not"
  - "Copy stripComments() rather than widen scripts/lib/anno-cli-verbs.mjs's export surface, since that module sits deliberately outside the shipped runtime's files[]"
  - "Leave storePathWithinWorkspace()'s 'refusing to open a store there' wording alone even though the argument may be a sidecar or an output file -- the seam is this plan's untouched regression surface"

patterns-established:
  - "Ten-character planted tokens for disclosure assertions: V8 truncates its JSON parse-error snippet at ten, so a longer token makes the assertion vacuous"
  - "Positive controls in both polarities: every refusal test is paired with an over-refusal control, so a verb that can never write cannot satisfy the suite"

requirements-completed: [REPOINT-01]

coverage:
  - id: D1
    description: "render-memmap --out outside the workspace root is refused and creates nothing there"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-02 (A): render-memmap --out outside the workspace root is refused by the ONE seam, and creates nothing there"
        status: pass
    human_judgment: false
  - id: D2
    description: "render-memmap --provenance outside the workspace root is refused, and the refusal discloses none of the target file's bytes"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-03 (B): render-memmap --provenance outside the workspace root is refused, and the refusal contains NONE of that file's bytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "render-memmap refuses to overwrite an existing --out without --force, and --force overwrites"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-02/WR-08 (C): render-memmap refuses to overwrite an existing in-workspace --out without --force, leaving its bytes untouched"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-02/WR-08 (D, over-refusal control): render-memmap --force DOES overwrite -- so C is not satisfied by a verb that can never write"
        status: pass
    human_judgment: false
  - id: D4
    description: "coverage --out outside the workspace root is refused and creates nothing there"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-02 (E): coverage --out outside the workspace root is refused, and creates nothing there"
        status: pass
    human_judgment: false
  - id: D5
    description: "An in-workspace sidecar that is not JSON fails naming the path and the failure without echoing its bytes; a schema failure still routes through the header parser"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-03 (H): an in-workspace sidecar that is not JSON fails naming the path and the failure, and discloses NONE of its bytes"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#CR-03 (I): a sidecar that IS valid JSON but is not a valid provenance header still fails through the HEADER PARSER, naming the fields"
        status: pass
    human_judgment: false
  - id: D6
    description: "The CLI's caller-supplied path arguments are a declared, closed, mechanically-checked set with a floor and two positive controls"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts (9 tests, all pass)"
        status: pass
      - kind: manual_procedural
        ref: "two hand-planted violations driven and observed red, then reverted -- see 'Planted violations' below"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three module-classification.ts citations into anno-cli.ts re-measured against the post-edit file, DIRECTION 9 and 9b green"
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts (20 tests, all pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 71min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 14: Confining the anno CLI's Path Arguments Summary

**All six caller-supplied path arguments on both `anno` verbs now resolve through `storePathWithinWorkspace()` before any filesystem call, the sidecar parse failure no longer echoes the file's bytes, and a closed-consumer-set test makes the next unconfined argument fail a test rather than a review.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-08-30T10:47:00Z
- **Completed:** 2026-08-30T11:58:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- Closed all three reproduced escapes: two out-of-workspace writes (one of which silently destroyed a pre-existing file and exited 0) and one arbitrary-file read oracle with content disclosure.
- Gave `render-memmap` the `--force` opt-in and the shared `refuseOverwrite()` call that `refuseOverwrite()`'s own doc had been claiming it already had.
- Replaced the interpolated JSON parse error with a byte offset extracted by a `(\d+)`-only capture, so no byte of a parsed file can reach an error message however the runtime words it.
- Enumerated the CLI's path-argument consumer set mechanically, deriving the flag half from `VERB_OPTIONS` so a new path-shaped flag joins the audit automatically.
- Corrected three headers that asserted a maintained property the code did not keep, and pointed each at the test that now keeps it.

## Task Commits

1. **Task 1 RED: failing cases for the unconfined path arguments** — `eba2dc9` (test)
2. **Task 1 GREEN: confine every caller-supplied path on both verbs** — `e776be7` (fix)
3. **Task 2 RED: failing case for the sidecar parse failure echoing bytes** — `57c6b74` (test)
4. **Task 2 GREEN: stop echoing the file's bytes** — `37b529d` (fix)
5. **Task 3: the closed-consumer-set test** — `c9b7203` (test)

_Tasks 1 and 2 were `tdd="true"`; each carries its own RED `test(...)` commit before its GREEN `fix(...)` commit._

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` — six confinement call sites, `--force` on `render-memmap` (option map, parser, USAGE, refusal), and three corrected headers.
- `src/mcp/vice/anno-cli.test.ts` — ten new cases (A–J) plus one positive-control update.
- `src/mcp/vice/anno-memmap-render.ts` — `jsonParsePosition()`, the de-interpolated syntax failure, and confinement docs on three previously-silent path fields.
- `src/mcp/vice/anno-cli-path-consumers.test.ts` — **new.** `CLI_PATH_ARGUMENTS`, `CLI_PATH_ARGUMENT_FLOOR = 6`, `NON_PATH_OPTIONS`, nine tests.
- `src/mcp/vice/module-classification.ts` — three line citations re-measured; nothing else.

## The two reproduced escapes: before and after

Driven in-process against a real temp workspace, a real store, a real sidecar and a sibling directory outside the workspace root.

### 1. `render-memmap --out` outside the workspace, over a pre-existing file (CR-02)

**Before:**
```
render-memmap: wrote /tmp/repro-outside-wO4Fuh/PRECIOUS.md (1 row(s), 0 [unknown], digest c293d338...)
exit code: 0
victim still original? false
victim first line now: "<!--"
```

**After:**
```
render-memmap: store path "/tmp/repro-outside-4ugI4w/PRECIOUS.md" is outside the workspace root
"/home/henrik/.../agent-a09c6a143211b29cb" -- refusing to open a store there
exit code: 1
victim still original? true
```

### 2. `render-memmap --provenance` outside the workspace (CR-03)

**Before** — exit code was *already* 1, and the message disclosed the target file's opening bytes:
```
render-memmap: renderMemoryMap: provenance sidecar at "/tmp/repro-outside-wO4Fuh/SECRET.txt"
is not valid JSON: Unexpected token 'T', "TOKEN-ZZQQ"... is not valid JSON
exit code: 1
```

**After** — refused by the confinement, before the file is opened at all:
```
render-memmap: store path "/tmp/repro-outside-4ugI4w/SECRET.txt" is outside the workspace root
"/home/henrik/.../agent-a09c6a143211b29cb" -- refusing to open a store there
exit code: 1
```

### 3. `coverage --out` outside the workspace (CR-02)

**Before:** `coverage: wrote /tmp/repro-outside-wO4Fuh/cov.json (schema version 2)` — `created outside? true`.

**After:** `coverage: store path "/tmp/repro-outside-4ugI4w/cov.json" is outside the workspace root ... -- refusing to open a store there` — `created outside? false`.

### 4. The in-workspace sidecar disclosure (CR-03, task 2)

Task 1 alone did **not** close this half — an in-workspace non-JSON sidecar still echoed its bytes, observed on the post-task-1 tree:
```
render-memmap: renderMemoryMap: provenance sidecar at ".../bad.json" is not valid JSON:
Unexpected token 'Q', "QQZZORACLE
not json
" is not valid JSON
```
After task 2 the message is:
```
renderMemoryMap: provenance sidecar at "<path>" is not valid JSON (at byte offset N).
The underlying parser message is deliberately NOT included -- it quotes the file's own bytes (CR-03).
```

### 5. The overwrite refusal and its control

```
render-memmap: refusing to overwrite the existing file <path> -- pass --force to overwrite it deliberately.
exit code: 1   unchanged? true
```
With `--force`: `render-memmap: wrote <path> (1 row(s), 0 [unknown], digest c293d338...)` — exit 0, overwritten.

## Planted violations against `anno-cli-path-consumers.test.ts`

Both driven by hand, observed red, then reverted (`git status` clean after each).

**(a) Removing one `storePathWithinWorkspace(` call** (render-memmap's `--out`):
```
not ok 5 - anno-cli.ts contains at least one storePathWithinWorkspace() call site per declared path argument
  error: 'anno-cli.ts has 5 storePathWithinWorkspace( call site(s) in its comment-stripped source but
  declares 6 caller-supplied path argument(s). At least one argument reaches a filesystem call without
  passing through the ONE confinement seam -- which is exactly the state CR-02 and CR-03 were reported from.'
```

**(b) Adding a path-shaped flag to `VERB_OPTIONS` with no inventory entry** (`--baseline` on `coverage`):
```
not ok 3 - every VERB_OPTIONS entry that is not an explicitly-declared non-path option is named in CLI_PATH_ARGUMENTS
  error: 'coverage accepts --baseline, which is neither declared non-path (--check, --force, --sample) nor
  named in CLI_PATH_ARGUMENTS. If it carries a path, add it to the inventory AND add its
  storePathWithinWorkspace() call; if it does not, add it to NON_PATH_OPTIONS deliberately.
  Do NOT widen NON_PATH_OPTIONS merely to make this pass.'
```

Both name the offending item rather than merely reporting that a set changed.

## `anno-confinement.test.ts`: zero diff

```
$ git diff f16d0b1c..HEAD --numstat
360	0	src/mcp/vice/anno-cli-path-consumers.test.ts
290	1	src/mcp/vice/anno-cli.test.ts
169	40	src/mcp/vice/anno-cli.ts
62	1	src/mcp/vice/anno-memmap-render.ts
3	3	src/mcp/vice/module-classification.ts
```
`anno-confinement.test.ts` does not appear. Its fifteen predicate tests ran green throughout as the untouched regression surface.

## `module-classification.ts` citations: before and after

Measured with `grep -n` against the **finished** file, never computed by arithmetic.

| Citation | Kind | Before | After | Measuring command |
|---|---|---|---|---|
| `renderMemoryMap` | structured `basis.consumers[].line` | 63 | **94** | `grep -n 'renderMemoryMap\|buildCoverageReport' anno-cli.ts \| head -6` |
| `buildCoverageReport` | structured `basis.consumers[].line` | 68 | **99** | (same command) |
| `checkAcceptedOptions` | prose `` `anno-cli.ts:NN` `` | 169 | **201** | `grep -n 'export function checkAcceptedOptions' anno-cli.ts` |

`git diff src/mcp/vice/module-classification.ts` shows exactly three changed lines and nothing else — no verdict, rationale, fate or requirement anchor moved. `module-classification.test.ts` is 20/20 green (DIRECTION 9 and DIRECTION 9b).

## Verification gates

| Gate | Result |
|---|---|
| `node --test anno-cli.test.ts anno-memmap-render.test.ts anno-cli-path-consumers.test.ts anno-confinement.test.ts` | **105/105 pass** |
| `node --test module-classification.test.ts` | **20/20 pass** (DIRECTION 9 + 9b) |
| `node --test hostpath-consumers.test.ts stock-dispatch.test.ts` | **green** (MCP-02 intact; `ANNO_MODULE_FLOOR` unchanged) |
| `npm run typecheck` | **clean** |
| `npm run test:automated` | 2696 tests, **1 fail** — see reconciliation below |
| `node scripts/check-npm-packages.mjs` | **exit 0** — `@henols/vice-mcp` 78 files, `@henols/c64-re-tools` 34 files / 7 skills; no test file leaked |
| `node scripts/check-no-analyser.mjs` | **exit 0**, allow-list still 0 entries |
| `node scripts/audit-gate.mjs` | **exit 0** — 9 docs guards green |
| `md5sum docs/tool-support.md` after regeneration | **`bb4744890855e58887142e5a97f44fc0`** — unchanged at `bb47448…`, as predicted |

MCP-02 holds by construction: no `ANNO-*` module imports `hostpath.ts`, and this plan used the annotation family's own seam throughout.

### `test:automated` failing-file set vs `29-BASELINE.md`

The baseline records `audit-integrity.test.ts` (2) + `anno-session.test.ts` (5). The observed set is `repo-root.test.ts` (1). All three names reconcile:

- **`anno-session.test.ts` — gone.** Deleted by plan 29-10; `29-BASELINE.md` anticipates this in its own "Note for plan 29-10".
- **`audit-integrity.test.ts` — now green.** A real improvement, not a guard that stopped asserting: `git log` shows 29-05 (`c59fcef`) re-expressed its census assertions as relations with survivable fates, and `7a8bf52` registered a missing guard in both registries. Untouched by this plan.
- **`repo-root.test.ts` — new, and NOT a regression from this plan.** It touches none of the five files this plan changed. `repo-root.test.ts:178` asserts the agreed supervisor directory does not sit under `.claude`; every GSD worktree is created at `.claude/worktrees/agent-<id>/`, so `repoRoot()` legitimately resolves there. **Confirmed by running the same file in the MAIN checkout: 6/6 green.** Logged to `deferred-items.md` item 2.

## Decisions Made

- **`--provenance` is confined before the `existsSync` probe, not after.** An existence check is itself an oracle — it answers "does this file exist" for any path the process can stat — so confining after it would have left a narrower but real disclosure route.
- **The default `--out` is confined too.** The default is applied first and the *result* confined, so the derived path and a caller-supplied one are governed by one rule. Trusting a path because the verb computed it is how the next escape gets written.
- **The JSON parse error is not forwarded, and the byte offset is extracted with a digits-only capture.** `jsonParsePosition()`'s regex captures `(\d+)` and nothing else, so no byte of the parsed file can reach the message however V8 words it. An absent offset is reported by absence, never a fabricated zero.
- **`parseProvenanceHeader()`'s schema failures are untouched.** A schema failure names fields the *caller* supplied and is not a disclosure route; blurring it into the syntax failure would have cost the verb its diagnostic. Case I pins that separation.
- **`stripComments()` is copied, not imported.** `scripts/lib/anno-cli-verbs.mjs` sits deliberately outside the shipped runtime's `files[]` and does not export the helper; widening its export surface for a test in another tree is a larger change than twenty mirrored lines.
- **The seam's refusal wording was left alone.** `storePathWithinWorkspace()` says "refusing to open a **store** there" even when the argument is a sidecar or an output file. The wording is imprecise for the new consumers, but the seam is this plan's untouched regression surface and `anno-confinement.test.ts` must stay byte-identical. Recorded here rather than silently accepted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned `node_modules` for the worktree**

- **Found during:** Baseline measurement, before Task 1
- **Issue:** `src/mcp/vice/node_modules` is gitignored, so the worktree had none. Five `anno-cli.test.ts` cases (the bin-level ones that spawn `vice-proxy.ts`) failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@mastra/mcp'`, which would have masked the real RED/GREEN signal.
- **Fix:** Created `src/mcp/vice/node_modules` as a real directory of 216 symlinks into the main checkout's already-provisioned tree. **No package-manager install was run** — nothing was fetched, and the committed lockfile was not consulted, so the Rule 3 package-install exclusion does not apply.
- **Why a directory of symlinks rather than one symlink:** `.gitignore`'s pattern is `node_modules/` with a trailing slash, which matches directories only. A single symlink is not a directory to git and showed up as untracked; the directory form is ignored correctly and left `git status` clean.
- **Verification:** `git status --short` empty; the five failures went green; baseline re-measured at 105/105.
- **Committed in:** nothing — this is worktree-local scaffolding outside the repo's tracked content.

**2. [Rule 1 - Bug] Updated the WR-09 structural guard's stale positive control**

- **Found during:** Task 1 (GREEN)
- **Issue:** `anno-cli.test.ts`'s WR-09 guard pins the literal argument text at each `writeFileSync` site to prove the scanner reads real content. It pinned `out, JSON.stringify(report` at `cmdCoverage`'s write site; confining that argument renamed `out` to `outPath`, so the control went red.
- **Fix:** Updated the pin to `outPath, JSON.stringify(report` with a comment recording that pinning `out,` would keep the control green only for as long as the escape it was written beside stayed open. The control's purpose — proving the scanner sees real content at the real site — is unchanged.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** `node --test anno-cli.test.ts` 55/55 green.
- **Committed in:** `e776be7` (Task 1 commit)

**3. [Rule 1 - Bug] Two disclosure assertions were vacuous as first written**

- **Found during:** Task 1 (RED)
- **Issue:** Cases B and H planted 26-character tokens and asserted their absence from the output. V8 truncates its JSON parse-error snippet at **ten** characters, so the full token was never present even in the disclosing build — B and H both passed against the live oracle they existed to catch.
- **Fix:** Shortened both tokens to exactly ten characters (`QQZZORACLE`, `WWXXLEAKED`) with a comment recording the measurement and why the length is load-bearing. Both then failed against the unfixed code, as RED requires.
- **Files modified:** `src/mcp/vice/anno-cli.test.ts`
- **Verification:** RED count went from 6 to 7; H stayed red through Task 1 and went green only with Task 2's fix.
- **Committed in:** `eba2dc9` and `57c6b74`

---

**Total deviations:** 3 auto-fixed (1 blocking-environment, 2 bugs)
**Impact on plan:** No scope creep. Deviation 1 is worktree scaffolding with no repo footprint. Deviations 2 and 3 are both consequences of this plan's own changes — 2 a pin this plan invalidated, 3 a test this plan wrote — and both are inside the plan's stated subject. Nothing outside the five `files_modified` entries was touched.

## Issues Encountered

- **The bin-level tests need real `node_modules`.** Resolved as deviation 1. Worth knowing for any future worktree-isolated plan touching `anno-cli.test.ts`: five of its cases spawn `vice-proxy.ts` as a child, so they are silently unrunnable in a fresh worktree and will fail with a module-resolution error rather than an assertion.
- **`anno-memmap-render.ts`'s NUL byte, confirmed again.** `grep -a -c 'provenancePath'` returns **10** and exits 0; the same command without `-a` prints nothing and exits 1. Every gate against this file used `-a`.
- **`repo-root.test.ts` cannot pass inside a GSD worktree.** Diagnosed, proven worktree-only against the main checkout, and logged to `deferred-items.md` rather than fixed — it is outside this plan's scope and outside its `files_modified`.

## Known Stubs

None. No stub value, placeholder, TODO or FIXME was introduced; the `placeholder` matches in `anno-memmap-render.ts` are that module's pre-existing domain vocabulary for the recon template's `<hash>`/`<PAL/NTSC>` markers. No test was skipped and every `<verify>` block in the plan was run.

No `.planning/WINDOWS.md` entry was appended: the ledger's kinds cover stubs, skipped tests, unrun verifies and deviations left behind, and this plan left none. The one open defect it surfaced (`repo-root.test.ts` under a worktree) is pre-existing, unrelated to these changes, and recorded in `deferred-items.md` — putting it in a ledger that blocks `/gsd-ship` would gate shipping on something this phase did not cause.

## Threat Flags

None. This plan removes attack surface (three confinement escapes and one disclosure oracle) and adds no network endpoint, auth path, file-access pattern or schema change. `--force` is a new CLI flag, not a new trust boundary: it is an opt-in that *loosens* a refusal that did not exist before this plan, and the refusal it gates is itself new.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The `anno` CLI's path-argument surface is now a declared, closed, mechanically-checked set. Phase 30's rebuilt verbs (`gen-enums`, `export-lbl`, `import-lbl`, and the ACME export oracle) will each add path arguments; each one must gain a `CLI_PATH_ARGUMENTS` entry, a `storePathWithinWorkspace()` call and a raise of `CLI_PATH_ARGUMENT_FLOOR`, or `anno-cli-path-consumers.test.ts` reds by name.
- **For plans 29-15 and 29-16 (waves 2 and 3):** `module-classification.ts`'s three `anno-cli.ts` citations now read **94**, **99** and **201**. Plan 29-16's import changes will move them again and must re-measure in the same task, exactly as this plan did.
- One concern carried forward: the seam's refusal message says "refusing to open a store there" for arguments that are not stores. Cosmetic, deliberate, and recorded above.

## Self-Check: PASSED

- All 5 claimed source files present on disk (`ls -1`), plus this SUMMARY.
- All 6 claimed commits present in `git log --oneline --all`: `eba2dc9`, `e776be7`, `57c6b74`, `37b529d`, `c9b7203`, `a6d16eb`.
- Final combined run of the six affected test files: **138 tests, 138 pass, 0 fail.**
- No file deletions in any commit (`git diff --diff-filter=D` empty at each).
- `STATE.md` and `ROADMAP.md` untouched, per worktree-mode rules.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
