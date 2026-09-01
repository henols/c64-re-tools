---
phase: 29-the-mcp-surface
plan: 15
subsystem: docs
tags: [skills, playbook, render-memmap, annotation-store, installer-sync, prose-citations, e2e]

# Dependency graph
requires:
  - phase: 29-12
    provides: "the `render-memmap` verb rebuilt over the Phase 28 annotation store (D-17) -- the fact the deleted note contradicted"
  - phase: 29-14
    provides: "file ownership of `src/mcp/vice/module-classification.ts` released; its three `anno-cli.ts` citations already moved"
provides:
  - "Four `anno render-memmap` invocations that name a store the verb can actually open, across both canonical skill files and their two generated twins"
  - "A 2026-08-30 dated correction replacing the falsified 2026-08-29 note, naming the correction as a correction"
  - "`29-15-e2e.sh` -- a committed end-to-end proof that the DOCUMENTED invocation runs, extracted from SKILL.md rather than restated, with an exactly-one-line extraction assertion ahead of the run"
  - "A maintainer note recording that `installer/skills/c64-program-recon/` is a generated twin that must never be hand-edited"
  - "Both `module-classification.ts` prose citations into this playbook re-measured and read back; the directory-listing one was ALREADY stale at the base commit"
affects: [29-16]

actuals:
  tokens: 30500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A documented command is proven by EXTRACTING it from the document and running it, never by restating it in the test"
    - "An extractor asserts its own extraction with a named message BEFORE running anything, so 'the extractor broke' can never be reported as 'the documented command does not work'"
    - "A prose line citation is re-measured in the same task as the edit that moved it, and the cited line is READ BACK -- a green existence-and-non-blank check cannot tell a correct citation from one that slid onto a different sentence"
    - "A falsified dated note is DELETED and replaced by a dated correction that names itself a correction, so a reader comparing two dated claims can tell which to believe"

key-files:
  created:
    - .planning/phases/29-the-mcp-surface/29-15-e2e.sh
  modified:
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/templates/memory-map.template.md
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/host-scripts.test.ts

key-decisions:
  - "The directory-listing prose citation moved 274 -> 306, but it was ALREADY WRONG at the base commit: :274 pointed at the export-asm withdrawal paragraph, not the d64 guidance its `note` names, and DIRECTION 9b was green over it the whole time. The new target is the line carrying the operative clause (`... refuse rather than guess (D-02) ...`), not the sentence's first line, because the acceptance criterion is that the QUOTED line confirms the note."
  - "The generation-route citation was NOT moved. It still names SKILL.md:255, the FIRST invocation line of the fenced block (the `npx` route), with the in-repo `node` route on :256. The in-repo route is the one `29-15-e2e.sh` extracts; those are two different jobs and the citation stays on the first line."
  - "`29-15-e2e.sh` lives under `.planning/phases/29-the-mcp-surface/`, not `scripts/`. It greps for the retired vocabulary by name, and the removal gate's scope is `git ls-files` minus the `.planning/` PREFIX -- so no allow-list entry was needed and that gate's 'temporary allow-list is EMPTY' assertion is still true (verified: exit 0)."
  - "The e2e script borrows the main checkout's `node_modules` through a temporary root-level symlink rather than running any package-manager install. `vice-proxy.ts` static-imports `@mastra/mcp` above the `anno` dispatch, and the worktree's copy is gitignored and absent; an install would be a network fetch and is explicitly not auto-fixable."
  - "`host-scripts.test.ts`'s EXPECTED_TRACKED_SHELL_SCRIPTS gained the fifth entry by name rather than by adding a `.planning/` filter. A filter would convert the census from 'what does this repository track' into 'what did someone remember to count'."

patterns-established:
  - "A shell script committed under `.planning/` is still a TRACKED shell script and must be counted in the host-scripts census in the same commit that adds it"
  - "A bootstrap probes for the PACKAGE it needs, never for the `node_modules` directory -- `npm run` creates a bare `node_modules/.cache`, so a directory probe reports 'deps present' over an empty tree"

requirements-completed: [REPOINT-01, REPOINT-02]

coverage:
  - id: D1
    description: "The four documented `anno render-memmap` invocations name a store the verb can open, and the documented command runs end to end against a real store and a real sidecar"
    requirement: REPOINT-01
    verification:
      - kind: e2e
        ref: "bash .planning/phases/29-the-mcp-surface/29-15-e2e.sh -- extracts the in-repo invocation from SKILL.md, runs it, asserts row count + [unknown] count + render digest independently"
        status: pass
      - kind: other
        ref: "grep -rn 'regen2000proj' src/skills/ -- no output, exit 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shipped `installer/skills/` twin carries the same corrected invocations and the replacement note, regenerated by sync-skills rather than hand-edited"
    requirement: REPOINT-02
    verification:
      - kind: integration
        ref: "npm --prefix installer run sync-skills -- exit 0, 7 skills; regenerated files read back at SKILL.md:255-256/:263 and memory-map.template.md:11-12"
        status: pass
      - kind: other
        ref: "grep -rn 'regen2000proj' installer/skills/ -- no output, exit 1; node scripts/check-npm-packages.mjs -- exit 0, 34 files / 7 skills"
        status: pass
    human_judgment: false
  - id: D3
    description: "The falsified 2026-08-29 note is deleted and replaced by a 2026-08-30 correction stating what plan 29-12 shipped and that the earlier note was wrong when it shipped"
    requirement: REPOINT-01
    verification:
      - kind: other
        ref: "grep -n '2026-08-30' src/skills/c64-program-recon/SKILL.md -> :263; grep -c 'still reads the pre-store project file' -> 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both `module-classification.ts` prose citations into this playbook resolve to the text their notes claim"
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts#DIRECTION 9b (prose citations) -- 20/20 pass"
        status: pass
      - kind: manual_procedural
        ref: "both cited lines read back with sed -n '255p' / '306p' and quoted in this summary"
        status: pass
    human_judgment: false
  - id: D5
    description: "The extractor refuses to run a degenerate command: a non-matching extraction exits non-zero with a named message before anything runs"
    verification:
      - kind: manual_procedural
        ref: "hand-demonstrated red against a copy with MATCH_B narrowed to 'render-memmap-NO-SUCH-VERB' -- exit 3, message quoted below"
        status: pass
    human_judgment: false

# Metrics
duration: 18 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 15: Re-point the `render-memmap` Playbooks onto the Store Summary

**Four dead `anno render-memmap game.regen2000proj` invocations re-pointed onto `game.annostore` across both canonical skill files and their generated installer twins, the falsified 2026-08-29 note deleted and replaced by a dated correction, and the whole thing proven by a committed script that extracts the documented command from `SKILL.md` and runs it against a real store.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-30T11:22:57Z
- **Completed:** 2026-08-30T11:40:58Z
- **Tasks:** 2
- **Files modified:** 4 modified, 1 created

## Accomplishments

- The four documented `render-memmap` call sites now name a store the verb can open, and the documented text was **run**, not read.
- The dated note that asserted in the present tense the exact behaviour this phase replaced is gone, replaced by one that names itself a correction.
- The shipped twin was proven by regenerating it and reading it back — the evidence REPOINT-02 actually asks for, not an assertion that the sync works.
- A pre-existing, invisible prose-citation drift was found and fixed: `module-classification.ts` cited `SKILL.md:274` for the d64 directory guidance, and `:274` was the export-asm withdrawal paragraph. DIRECTION 9b was green over it.

## Task Commits

1. **Task 1: Re-point all four invocations and delete the falsified note** — `a3f4a40` (fix)
2. **Task 2: Prove the SHIPPED copy** — `8c787c6` (docs)
3. **Deviation: count the new e2e script in the shell-script census; fix the bootstrap's false-green probe** — `4c9b479` (fix)
4. **Deviation: stop the census comment naming the retired subject** — `b7491ba` (fix)

## Files Created/Modified

- `.planning/phases/29-the-mcp-surface/29-15-e2e.sh` — **created.** Extracts the in-repo invocation from `SKILL.md`, asserts exactly one non-empty extracted line before running anything, builds a real in-tree store + sidecar, runs the documented command, asserts exit 0 plus row count, `[unknown]` count and render digest independently, then runs the corroborating gates. Removes its fixture (and any borrowed deps link) on every exit path.
- `src/skills/c64-program-recon/SKILL.md` — both invocation lines corrected; falsified note deleted and replaced; maintainer note about the generated twin added.
- `src/skills/c64-program-recon/templates/memory-map.template.md` — both invocation lines corrected; the opening paragraph's retired `anno_*` tool-family prefix updated to `anno_*`.
- `src/mcp/vice/module-classification.ts` — the two `c64-program-recon/SKILL.md` prose citations re-measured. Nothing else touched: no verdict, no rationale, no fate, no requirement anchor, no citation deleted.
- `src/mcp/vice/host-scripts.test.ts` — `EXPECTED_TRACKED_SHELL_SCRIPTS` gained the fifth entry (deviation, below).

## The four corrected call sites

| # | File | Line | Before | After |
|---|---|---|---|---|
| 1 | `src/skills/c64-program-recon/SKILL.md` | 255 | `npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json` | `... render-memmap game.annostore --provenance sidecar.json` |
| 2 | `src/skills/c64-program-recon/SKILL.md` | 256 | `node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.regen2000proj --provenance sidecar.json` | `... render-memmap game.annostore --provenance sidecar.json` |
| 3 | `src/skills/c64-program-recon/templates/memory-map.template.md` | 11 | `npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json` | `... render-memmap game.annostore --provenance sidecar.json` |
| 4 | `src/skills/c64-program-recon/templates/memory-map.template.md` | 12 | `node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.regen2000proj --provenance sidecar.json` | `... render-memmap game.annostore --provenance sidecar.json` |

`grep -rn 'regen2000proj' src/skills/` → no output, exit 1.
`grep -c 'annostore'` → `SKILL.md:4`, `memory-map.template.md:2`.

Fifth site, one sentence away and corrected with them: `memory-map.template.md:4` said the store is
"written through the `anno_*` tools described in `../SKILL.md`". It now says `anno_*`.

## The deleted note and its replacement

**DELETED** (was `SKILL.md:263-266`):

> **Dated note, 2026-08-29.** `render-memmap` is one of only **two** CLI verbs that still exist
> (`coverage` is the other), and it still reads the pre-store project file shown above. The route that
> used to create those project files is withdrawn, so until this verb is rebuilt over the
> `.annostore` it runs only against a project file you already have.

**REPLACEMENT** (now `SKILL.md:263-271`):

> **Dated correction, 2026-08-30 — `render-memmap` reads the annotation store directly, and the note
> that used to stand here was WRONG when it shipped.** Phase 29 plan 29-12 rebuilt this verb over the
> Phase 28 annotation store on `D-17`'s authority: its positional is an EXISTING `.annostore`, opened
> with `mustExist` — an absent store is refused by name rather than created — and nothing on the path
> it reaches consults the retired external analyser. The pre-store project file the earlier note named
> has no producer left in this repository, so there is no route back to the old spelling. That earlier
> note asserted in the PRESENT TENSE that this verb still read a project file; it was already false
> when it shipped, and it is DELETED here rather than amended, so a reader comparing two dated claims
> can tell which one to believe.

The replacement follows `acme-build/SKILL.md:137-143`'s dated-withdrawal shape. It deliberately does
NOT spell the retired analyser's name — the first draft did, and `check-no-analyser.mjs`
would have refused the commit.

`grep -n '2026-08-30' src/skills/c64-program-recon/SKILL.md` → `263:`.
`grep -c 'still reads the pre-store project file'` → `0`.

## The end-to-end run

Command: `bash .planning/phases/29-the-mcp-surface/29-15-e2e.sh` → **exit 0**.

Full transcript of the load-bearing part:

```
29-15-e2e: borrowed node_modules from /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice (temporary root-level symlink)
29-15-e2e: extracted from src/skills/c64-program-recon/SKILL.md:
29-15-e2e:   node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.annostore --provenance sidecar.json
29-15-e2e: running:
29-15-e2e:   node ./src/mcp/vice/vice-proxy.ts anno render-memmap src/mcp/vice/.anno-e2e-wePaoq/game.annostore --provenance src/mcp/vice/.anno-e2e-wePaoq/sidecar.json
29-15-e2e: transcript:
render-memmap: wrote /home/henrik/.../src/mcp/vice/.anno-e2e-wePaoq/memory-map.md (2 row(s), 0 [unknown], digest 9664d710860f995908ee00c32a4a8feec012decdf671e5a73fff08254dbfc5bd)
29-15-e2e: PASS -- the documented invocation ran end to end.
29-15-e2e: src/skills/ carries no 'regen2000proj' occurrence.
src/skills/c64-program-recon/SKILL.md:4
src/skills/c64-program-recon/templates/memory-map.template.md:2
check-skill-tool-coverage: OK -- 37 distinct vice_* names ... anno CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved
check-skill-description-overlap: OK -- 7 skills scanned; 21 pairs compared; observed maximum score 0.250 ... threshold 0.35
29-15-e2e: module-classification.test.ts green.
29-15-e2e: ALL CHECKS PASSED.
```

The three independent transcript assertions all fired on the real output: `2 row(s)`, `0 [unknown]`,
`digest 9664d710…`. The fixture is gone afterwards — `git status --porcelain src/mcp/vice/` is empty.

### The hand-demonstrated extractor red

Copied the script, narrowed `MATCH_B` from `render-memmap` to `render-memmap-NO-SUCH-VERB`, ran it,
reverted (the copy lived in `/tmp` and was deleted; the committed script was never edited for this).
Observed, **before any command ran**, exit **3**:

```
29-15-e2e: EXTRACTION FAILED -- expected exactly 1 non-empty line, found 0.
29-15-e2e:   file searched: src/skills/c64-program-recon/SKILL.md
29-15-e2e:   match terms:   'vice-proxy.ts' AND 'render-memmap-NO-SUCH-VERB'
29-15-e2e: This is the EXTRACTOR being broken, NOT the documented command failing.
29-15-e2e: Do not read this as 'render-memmap does not work'.
```

## The shipped copy, regenerated and read

Sync command: `npm --prefix installer run sync-skills` → exit 0,
`sync-skills: copied 7 skill(s) ... excluded 6 non-shipping entries`.

Lines read back out of the regenerated tree:

```
installer/skills/c64-program-recon/SKILL.md:255:npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json
installer/skills/c64-program-recon/SKILL.md:256:node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.annostore --provenance sidecar.json
installer/skills/c64-program-recon/SKILL.md:263:**Dated correction, 2026-08-30 — `render-memmap` reads the annotation store directly, and the note
installer/skills/c64-program-recon/templates/memory-map.template.md:4:types and scopes written through the `anno_*` tools described in `../SKILL.md` — is canonical. This
installer/skills/c64-program-recon/templates/memory-map.template.md:11:npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json
installer/skills/c64-program-recon/templates/memory-map.template.md:12:node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.annostore --provenance sidecar.json
```

After task 2's maintainer note the twin also carries it at
`installer/skills/c64-program-recon/SKILL.md:263` (the note sits above the dated correction).

`grep -rn 'regen2000proj' installer/skills/` → no output, exit 1.
`git status --porcelain installer/skills/` → no output (gitignored; nothing committed from that tree).

### `check-npm-packages.mjs`

Exit **0**. Reported counts:

```
check-npm-packages: transitive closure from vice-proxy.ts -- 55 modules, clean
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 78 files
  @henols/c64-re-tools@0.0.0-dev -- 34 files, 7 skills
```

**What this proves:** the shipped tarball contains all 7 canonical skills (the relation is against
`src/skills/` subdirectories carrying a `SKILL.md`, not a pinned literal), and it leaks no
`node_modules/`, no `*.test.mjs` and no `fixtures/`. **What it does not prove:** it never reads an
invocation's arguments. A tarball containing a skill whose every documented command is dead passes
this gate — which is exactly what shipped. Closing that is plan 29-16's new gate.

## The two prose citations

| Citation (in `module-classification.ts`) | Before | After | Moved? |
|---|---|---|---|
| `anno-memmap-render.ts` entry's note — "documented as the generation route (never hand-author an address row)" | `SKILL.md:255` | `SKILL.md:255` | **No** |
| `anno-d64.ts` entry's note — "list the directory and refuse rather than guess which file inside the image to analyse" | `SKILL.md:274` | `SKILL.md:306` | Yes (274 → 298 in task 1, → 306 in task 2) |

Both lines read back with `sed -n`:

- **`SKILL.md:255`** — `npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json`
  This is the **FIRST** invocation line of the generator's fenced block and it begins with the `npx`
  launcher, exactly as required. The in-repo `node .../vice-proxy.ts` route sits on `:256` and the
  citation was **not** moved onto it, even though `:256` is the line `29-15-e2e.sh` extracts. A green
  DIRECTION 9b cannot tell the two apart (neither carries an adjacent backticked symbol, so only
  existence-and-non-blank is checked), so this is confirmed by reading, not by the run.
- **`SKILL.md:306`** — `name the file inside the image explicitly and refuse rather than guess (D-02), because a guess could`
  This is the text the `anno-d64.ts` note names. The line carrying the operative clause was chosen over
  the sentence's first line (`:305`, "Extracting a program from a `.d64` image is likewise a Phase 30
  concern; when it returns it will") precisely because the acceptance criterion is that the QUOTED line
  confirms the note — `:305` alone does not contain "refuse rather than guess".

**Finding worth recording: the d64 citation was already wrong at the base commit.** At `ed32b55`,
`SKILL.md:274` read `by **assembling the output with a real ACME and diffing the bytes against the
input** — never by an` — the middle of the `export-asm` withdrawal paragraph, not the d64 guidance the
note claims. `module-classification.test.ts` was **20/20 green** over that. This is the exact
green-while-wrong mode T-29-15-06 predicts, observed rather than hypothesised.

`cd src/mcp/vice && node --test module-classification.test.ts` → **20 pass / 0 fail**.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing ones: the generation-route citation was kept
on the `npx` line and not silently retargeted; the d64 citation's new target is the clause-bearing
line; the e2e script lives under `.planning/` so the removal gate's empty allow-list stays empty; and
the shell-script census gained an entry rather than a filter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `host-scripts.test.ts`'s tracked shell-script census went red**
- **Found during:** Task 2 (plan-level `<verification>` item 6, `npm run test:automated`)
- **Issue:** `EXPECTED_TRACKED_SHELL_SCRIPTS` is asserted `deepEqual` against `git ls-files -- *.sh`.
  Committing `29-15-e2e.sh` made the tracked set five, the array four. The test's own message
  requires the array be updated "as part of the commit that actually adds or retires the script".
- **Fix:** Added the fifth entry with a rationale comment naming what the script is, why it exists
  (CR-04: a name-only gate cannot see a dead invocation) and why it lives under `.planning/`. A
  `.planning/` exclusion filter was considered and rejected — it would convert the census from "what
  does this repository track" into "what did someone remember to count".
- **Files modified:** `src/mcp/vice/host-scripts.test.ts`
- **Verification:** `cd src/mcp/vice && node --test host-scripts.test.ts` → 4 pass / 0 fail
- **Committed in:** `4c9b479`

**2. [Rule 3 - Blocking] `29-15-e2e.sh`'s dependency bootstrap had its own false-green**
- **Found during:** Task 2 (attributing the suite's failures)
- **Issue:** `vice-proxy.ts` static-imports `@mastra/mcp` at module scope, above the
  `process.argv[2] === "anno"` dispatch, so the CLI route needs the package present. The worktree's
  `src/mcp/vice/node_modules` is gitignored and absent, so the documented command failed with
  `ERR_MODULE_NOT_FOUND` for a reason unrelated to the invocation. The first bootstrap probed for the
  node_modules **directory** — but `npm run` creates a bare `node_modules/.cache`, so after any
  `npm run test:automated` the probe reported "deps present" over a tree with no packages in it.
- **Fix:** The probe is now for `@mastra/mcp` itself, and the borrowed symlink goes at the **worktree
  root** rather than over `src/mcp/vice/node_modules` — Node's resolver walks every ancestor's
  `node_modules`, so nothing that already exists has to be moved aside or restored. No
  package-manager install was run (a network fetch, and explicitly not auto-fixable).
- **Files modified:** `.planning/phases/29-the-mcp-surface/29-15-e2e.sh`
- **Verification:** script re-run to exit 0 with the deps stub present; `git status --porcelain` empty
- **Committed in:** `4c9b479`

**3. [Rule 1 - Bug] The census rationale comment named the retired analyser**
- **Found during:** final gate sweep
- **Issue:** the comment added in `4c9b479` spelled the removal gate's own filename, which contains
  the retired subject's name. `check-no-analyser.mjs` exited 1 on `host-scripts.test.ts:198`
  as an unexempted reintroduction (CUT-02).
- **Fix:** the comment names the gate by role rather than by filename. **No exemption and no
  allow-list entry was added** — widening an exemption to cover an avoidable mention is what that
  gate's "WHAT NOT TO DO #2" forbids, and it would have broken this plan's own "allow-list still 0
  entries" assertion.
- **Files modified:** `src/mcp/vice/host-scripts.test.ts`
- **Verification:** `node scripts/check-no-analyser.mjs` → exit 0; `node --test host-scripts.test.ts` → 4 pass
- **Committed in:** `b7491ba`

**4. [Rule 1 - Bug] The `anno-d64.ts` prose citation was stale before this plan touched it**
- **Found during:** Task 1 step 6 (measuring, as instructed, rather than computing)
- **Issue:** `module-classification.ts:432` cited `SKILL.md:274` for the d64 directory guidance. At
  the base commit `:274` was the middle of the `export-asm` withdrawal paragraph. DIRECTION 9b was
  green over it because neither citation carries an adjacent symbol, so only existence-and-non-blank
  is checked.
- **Fix:** re-measured to the line actually carrying the guidance (`:298` after task 1, `:306` after
  task 2's note shifted the file) and read back both times.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` → 20 pass; both cited lines quoted above
- **Committed in:** `a3f4a40` and `8c787c6`

**Note on the plan's own read_first text.** The plan located the `:255` generation-route citation in
"the `anno-enum-gen.ts` entry's `note`". It is actually in the **`anno-memmap-render.ts`** entry's
note (`module-classification.ts:485-487`); `anno-enum-gen.ts`'s entry carries no note at all. The
citation itself, its wording and its target were all as described, so this is a naming slip in the
plan rather than a drift in the record. Recorded so the next reader is not sent to the wrong entry.

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking).
**Impact on plan:** All four are corrections to things this plan's own artifacts broke or uncovered.
No scope creep: no verdict, rationale, fate or requirement anchor in `module-classification.ts` was
touched, no citation was deleted, and nothing under `installer/skills/` was committed.

## Issues Encountered

**The automated suite is red for environment reasons in a worktree, and it was red before this plan.**
`cd src/mcp/vice && npm run test:automated` ends **31 fail / 2671 pass / 2708 tests**. The
orchestrator's brief said the clean state on this tree is 0 failures; that figure does not hold inside
a freshly-created git worktree. Attribution was done by measurement, not assumption:

- The **first** run showed 37 failures. 5 of them (`anno-cli.test.ts` bin tests) were
  `ERR_MODULE_NOT_FOUND: @mastra/mcp` — the worktree has no `node_modules`. Linking the main
  checkout's copy at the worktree root dropped them, leaving 32.
- **1** of those 32 was genuinely mine — the shell-script census — and is fixed above. That leaves
  **31**, none of which this plan touches:

| File | Count | Why it is environmental |
|---|---|---|
| `vice-broker-acquire.test.ts` | 15 | broker daemon tests; spawn real children |
| `broker-control.test.ts` | 4 | binds real control ports |
| `broker-kill.test.ts` | 2 | sends real signals to real children |
| `build-atomic.test.ts` | 4 | invokes `node_modules/.bin/tsc`, absent here |
| `resources-sync.test.ts` | 1 | `spawnSync .../node_modules/.bin/tsc ENOENT` (quoted from the log) |
| `repo-root.test.ts` | 1 | asserts the supervisor dir is not under `.claude`; every worktree lives at `.claude/worktrees/agent-*`. **Named as a known worktree artifact in the executor brief** |
| `vice-broker-supervision.test.ts` | 1 | crash-respawn against real argv |
| `telemetry-import.test.ts` | 1 | reads the "live installed tree" of `@mastra`, which here is a symlink into the main checkout |

`host-scripts.test.ts` and `module-classification.test.ts` — the two files this plan's edits could
plausibly redden — are both **green**. Deferred: verifying the 31 against a non-worktree checkout is
outside this plan's scope and is the same set every worktree executor in this round will see.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **29-16 (wave 3) is unblocked.** It owns `src/mcp/vice/module-classification.ts` next, and this plan
  has released it. The two `c64-program-recon/SKILL.md` prose citations are at `:255` and `:306`;
  29-16 edits the `anno-cli.ts` citations, not these, but any edit it makes to
  `src/skills/routine-queue-walker/SKILL.md` cannot move them (different file).
- **The structural anti-regression is still open, by design.** `check-skill-tool-coverage.mjs`
  resolves verb NAMES and never an invocation's ARGUMENTS. `29-15-e2e.sh` closes this ONE documented
  invocation by running it; it does not generalise. Argument-checking every documented invocation is
  plan 29-16 task 3.
- **If `29-15-e2e.sh` is ever promoted out of `.planning/` into the scanned tree**, it needs a
  `check-no-analyser.mjs` allow-list entry, and this round's "temporary allow-list is EMPTY"
  assertion stops being true.

## Self-Check: PASSED

- `[ -f .planning/phases/29-the-mcp-surface/29-15-e2e.sh ]` → FOUND
- `git log --oneline` → `a3f4a40` FOUND, `8c787c6` FOUND, `4c9b479` FOUND, `b7491ba` FOUND
- All task `<acceptance_criteria>` re-run and passing (see the sections above)
- Plan-level `<verification>` 1-9 re-run: items 1-5, 7, 8, 9 exit 0; item 6 measured and attributed
  above; item 10 (wave disjointness) is structural and holds — wave 2 contains this plan alone
- `git status --porcelain` → empty; `git status --porcelain installer/skills/` → empty

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
