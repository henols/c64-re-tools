---
phase: 29-the-mcp-surface
plan: 20
subsystem: api
tags: [anno-cli, usage, drift-gate, skills, copy-forward-template, wr-02, wr-05, prohibition-29-14]

requires:
  - phase: 29-the-mcp-surface
    provides: "29-18's path-independent banner and its two corrected in-file statements of the drift semantics -- the cause set this plan's three user-facing texts echo"
  - phase: 29-the-mcp-surface
    provides: "29-19's hardened invocation gate and its recorded baseline (10 invocations, 20 of 60 files, 2 trees), which this prose round had to leave unmoved"
  - phase: 29-the-mcp-surface
    provides: "29-16's loadProjectImage() extension dispatch, read as the source of the corrected coverage positional spelling"
provides:
  - "An anno-cli.ts USAGE whose every sentence about either verb is checkable against a branch in the code, verified by RUNNING --help rather than reading the literal"
  - "The drift cause set stated identically in three user-facing texts and the renderer: hand edit, store row, sidecar bytes, a move RELATIVE TO THE WORKSPACE ROOT, the renderer -- plus the negative"
  - "The copy-forward template's remedy made safe to follow, with the sentence that says why"
  - "The W4 one-time-drift sentence in both copy-forward texts and both skill trees, with the measurement it rests on recorded"
  - "The positional half of the CLI path-argument inventory, derived from each verb's --help synopsis in BOTH directions, with both controls observed red"
  - "Three anno-cli.ts headers that state the property anno-cli-path-consumers.test.ts checks, each naming the residual it does not"
affects: [29-verification-round-3, phase-30-anno-export-asm, phase-32-skill-sweep, consuming-projects-with-a-rendered-memory-map]

actuals:
  tokens: 58276
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A CLI's declaration of record for a positional is its --help synopsis line, read from STDOUT rather than scraped from the source literal -- a literal that never reaches stdout satisfies a source check while telling the caller nothing"
    - "A header that names a limit is a header that can be closed on purpose; a header that omits one is a warrant not to check"
    - "A wrap-tolerant prose probe is measured on the PRE-fix tree before it is trusted on the post-fix one -- a post-fix 0 without a recorded pre-fix count proves nothing"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-cli-path-consumers.test.ts
    - src/mcp/vice/module-classification.ts
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/templates/memory-map.template.md

key-decisions:
  - "The USAGE's drift cause set is 29-18's, echoed rather than recomposed -- three texts stating three slightly different cause sets would have recreated the defect at a larger scale"
  - "The `--store FILE is required ... will not derive its path from <project>` refusal message was deliberately NOT renamed, because scripts/lib/anno-cli-invocations.mjs quotes it VERBATIM in REQUIRED_FLAGS' comment and that file belongs to plan 29-19. Renaming one without the other would have created exactly the class of defect this plan discharges. Reported as a residual rather than silently fixed or silently left"
  - "The CR-02 incident record at anno-cli.ts:845 keeps its `coverage <project> ...` spelling: it is a past-tense record of what was reproduced, and renaming it would falsify history"
  - "WR-02 resolved as the plan ruled: headers corrected + the positional direction added, NO argument-to-call-site association, residual named in all three headers AND in the test file's own header"
  - "The RED phase was reached by a LIVE drift rather than a plant -- task 1's `<project>` -> `<image>` rename left the inventory stale, which is precisely what the new direction exists to catch"
  - "module-classification.ts re-measured TWICE, once per commit that moved its citations, and all three moved both times -- unlike 29-18, where re-measurement correctly found nothing had moved"

patterns-established:
  - "Two-way inventory agreement: a hand-declared inventory of surface elements is audited in BOTH directions, because an uninventoried element is the failure that ships and a stale entry is the one that reads as coverage while auditing nothing"
  - "Control isolation is reported honestly: a plant that also reds a neighbouring assertion says so, and says why that second red is the neighbouring assertion working"

requirements-completed: [REPOINT-01, REPOINT-02]
# DECLARED by this plan; deliberately NOT marked Complete in REQUIREMENTS.md.
# Two independent reasons, either sufficient: (1) wave 1 declined to move these
# rows on the grounds that a status row must not move ahead of the
# re-verification verdict that scores it, and this plan holds the same line;
# (2) 29-21 already rewrote REQUIREMENTS.md this wave and this plan was told not
# to re-edit it. A completed plan is not a verdict; a round-3 verification is.

coverage:
  - id: D1
    description: "Every sentence in anno-cli.ts's USAGE about either verb is checkable against a branch in the code -- the drift cause set, the --out default, the coverage positional's kind, and the exit contract"
    requirement: "REPOINT-01"
    verification:
      - kind: manual_procedural
        ref: "node src/mcp/vice/vice-proxy.ts anno --help -- printed block quoted in full under Evidence 1"
        status: pass
      - kind: other
        ref: "grep -c 'beside the project' src/mcp/vice/anno-cli.ts => 0"
        status: pass
      - kind: e2e
        ref: "node src/mcp/vice/vice-proxy.ts anno coverage <1-byte .prg> --store <real store> => EXIT 1, after the report, naming the undecodable payload"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli.test.ts#the verb-options map agrees with USAGE's own per-verb option lists, for both verbs (IN-06) -- observed RED on a planted option removal, then green"
        status: pass
    human_judgment: false
  - id: D2
    description: "The exit-code sentence is enumerated from the code's own branches rather than from intent, and the 29-13 clause it sits beside (a low measurement is a RESULT) is preserved"
    verification: []
    human_judgment: true
    rationale: "Whether an enumeration is EXHAUSTIVE is not something a test asserts -- the tests assert that each named branch behaves as described. A human must read the corrected sentence against every `return 1` reachable after argument parsing in cmdCoverage(). The enumeration performed here is quoted under Evidence 4 so the reading is cheap."
  - id: D3
    description: "The file an agent copies into every new project describes the drift gate the code ships, and its remedy is safe to follow on any machine"
    requirement: "REPOINT-02"
    verification:
      - kind: other
        ref: "grep -n 'hand edit' over both texts -- both hits sit in a paragraph naming the sidecar, workspace-relative-location and renderer causes and stating that relocating the checkout is not drift"
        status: pass
      - kind: other
        ref: "diff -q src/skills/c64-program-recon/{SKILL.md,templates/memory-map.template.md} against their installer/skills twins => no difference, both"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs => exit 0, 78 / 34 files, 7 skills -- identical to 29-VERIFICATION.md's recorded figures"
        status: pass
    human_judgment: false
  - id: D4
    description: "W4 -- 29-18's RENDERER_VERSION non-bump is handed to a user: both copy-forward texts, in both trees, name the one-time `drifted` report and its one-step remedy"
    requirement: "REPOINT-02"
    verification:
      - kind: other
        ref: "grep -n '2026-08-30' over both src/skills texts and both installer/skills twins => 1 hit in each template, 3 in each SKILL.md; all sit in paragraphs naming re-running the generator"
        status: pass
      - kind: other
        ref: "git ls-files | grep -i memory-map => only the template plus unrelated c64-memory-mapping files; NO committed rendered memory-map.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "No anno-cli.ts header credits anno-cli-path-consumers.test.ts with a property it does not check, and the residual is named in all three"
    verification:
      - kind: other
        ref: "wrap-tolerant probe over comment-stripped, line-joined anno-cli.ts => 3 pre-fix, 0 post-fix (the naive single-line grep returned 2 pre-fix and is NOT the proof)"
        status: pass
      - kind: other
        ref: "grep -c 'does not associate' src/mcp/vice/anno-cli.ts => 3; grep -c 'written warrant' => 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "The positional half of the path-argument inventory exists, derived from the --help synopsis in both directions, with both planted controls observed failing"
    requirement: "REPOINT-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts#every positional a verb's USAGE synopsis declares is named in CLI_PATH_ARGUMENTS"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-cli-path-consumers.test.ts#every CLI_PATH_ARGUMENTS positional is declared in some verb's USAGE synopsis -- a stale entry audits nothing while reading as coverage"
        status: pass
      - kind: manual_procedural
        ref: "planted controls A and B, transcripts under Evidence 6; git status --porcelain empty after each revert"
        status: pass
    human_judgment: false
  - id: D7
    description: "A prose round did not red a gate: the invocation gate, the skill-tool-coverage gate, the npm-package gate, the fork-honesty gate, the description-overlap gate, the removal gate and the tool-support byte-identity check are all green with unchanged figures"
    verification:
      - kind: integration
        ref: "seven gate runs quoted under Evidence 7, each with its exit code and its reported counts against 29-19's / 29-VERIFICATION.md's baselines"
        status: pass
    human_judgment: false
  - id: D8
    description: "REPOINT-02 / concurrency -- installer/skills/ is regenerated before any gate scans it, so a gate running mid-edit reads the shipped text rather than a half-synced copy"
    verification: []
    human_judgment: true
    rationale: "Backstop marker, authored as such in the plan's must_haves. The sync is not transactional and the twin is gitignored, so `git status` cannot witness a stale one; the gate mitigates this in practice by running the sync itself before scanning, but no cheap deterministic assertion exists for the interrupted-or-parallel case. Abstains to a human rather than being claimed."

duration: 23 min
completed: 2026-08-30
status: complete
---

# Phase 29 Plan 20: The prose half of gap 1 Summary

**`anno --help` now states the drift cause set the code has, the `--out` default beside the STORE, an `<image>` positional with its three accepted forms, and an exit contract enumerated from every reachable `return 1`; the copy-forward template and the recon playbook say the same thing and hand 29-18's one-time banner drift to a reader; and the three headers that credited the path-consumer test with per-argument association now state what it checks and name what it does not — proven with a wrap-tolerant probe that read 3 before the fix where the naive grep read 2.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-30T16:22Z
- **Completed:** 2026-08-30T16:45Z
- **Tasks:** 3 (5 commits — task 3 is `tdd="true"` and ran RED → GREEN → headers)
- **Files modified:** 6

## Accomplishments

- **The 29-14 prohibition's three recorded counts are all discharged.** Count (1): the USAGE's two-cause drift claim replaced by 29-18's cause set, echoed rather than recomposed. Count (2): the `--out` default, the coverage positional and the exit contract each re-derived from the branch that implements them. Count (3): the three path-consumer headers corrected, each now naming its own residual.
- **The highest-leverage text is corrected and its remedy is now safe to follow.** `templates/memory-map.template.md` is copied into every new project; its "the fix is always to re-run the generator" sentence is kept — because 29-18 removed the cause for which it was actively harmful — and gains the sentence that says why it is safe: the banner records workspace-relative locations, so re-running in another checkout or worktree does not write that machine's absolute paths into a committed file.
- **W4 discharged.** 29-18 deliberately did not bump `RENDERER_VERSION` and handed this plan the one sentence that turns that into something a user is told rather than something a user discovers. Both texts, both trees, with the measurement it rests on recorded: this repository has no committed rendered `memory-map.md`, so the sentence exists for consuming projects.
- **WR-02's cheap half is closed and its expensive half is named.** The positional inventory now has a direction, in both directions, derived from each verb's `--help` synopsis. The argument-to-call-site association is explicitly *not* attempted, and that limit is written into all three headers and into the test file's own header.
- **A prose round moved no gate.** Seven gates and the `docs/tool-support.md` byte-identity check are green with figures identical to 29-19's and `29-VERIFICATION.md`'s.

## Task Commits

1. **Task 1: the USAGE block made true** — `bc1df6e` (docs)
2. **Task 2: the two shipped playbook texts, both trees in sync** — `8ded6fc` (docs)
3. **Task 3, RED: the positional half of the inventory** — `23cae55` (test)
4. **Task 3, GREEN: the inventory entry re-pointed onto `<image>`** — `c8503f9` (feat)
5. **Task 3, headers: the three claims corrected + second citation re-measurement** — `2da457d` (docs)

## Files Created/Modified

- `src/mcp/vice/anno-cli.ts` — the USAGE block (both verb blocks), the `coverage` per-verb error usage line, two doc comments spelling the positional, and the three path-consumer headers.
- `src/mcp/vice/anno-cli.test.ts` — one regex re-pointed onto the new error-usage spelling.
- `src/mcp/vice/anno-cli-path-consumers.test.ts` — two new directions (3b), the `--help` capture they read, the inventory entry re-pointed, and a header paragraph naming the residual.
- `src/mcp/vice/module-classification.ts` — all three `anno-cli.ts` citations re-measured twice, once per commit that moved them.
- `src/skills/c64-program-recon/SKILL.md` — the `--check` paragraph, a dated 2026-08-30 correction, and the W4 sentence. Round 1's dated correction is untouched.
- `src/skills/c64-program-recon/templates/memory-map.template.md` — the `--check` paragraph, the remedy sentence, and the W4 sentence.

## Evidence

### 1. The printed `--help` block (task 1 criterion 1) — RUN, not read

`node src/mcp/vice/vice-proxy.ts anno --help`, exit 0:

```
usage (npm install):    npx -y @henols/vice-mcp anno <verb>
usage (plugin/in-repo): node <plugin-root>/src/mcp/vice/vice-proxy.ts anno <verb>

verbs:
  render-memmap <store> --provenance FILE [--out FILE] [--force] [--check]
      Generates the Markdown memory map from an annotation store plus a
      validated provenance sidecar (D-24: the store is canonical, this
      output is a GENERATED VIEW -- never hand-edit it). Without --check,
      writes --out (default: memory-map.md beside the STORE -- in the
      store's own directory), refusing to overwrite an existing file there
      unless --force is passed, and prints the row count, the number of
      [unknown]-graded rows, and the render digest. That derived default is
      put through the SAME confinement seam as a caller-supplied --out,
      rather than trusted because this verb computed it.
      With --check, re-renders in memory and compares against the file at
      --out: prints "in sync" and exits 0 when they match, prints the first
      differing line and exits non-zero on drift, or prints "missing" and
      exits non-zero when --out does not exist yet. Drift is reported when,
      and only when, one of these changed: this file itself (a hand edit --
      which is what --check exists to catch); a store row (a range, a label,
      a comment, or a comment's confidence grade); the provenance sidecar's
      bytes; the location of the store or the sidecar RELATIVE TO THE
      WORKSPACE ROOT; or the renderer. Relocating the checkout is NOT drift --
      the same tree at a different absolute path renders these same bytes,
      because the two locations the banner records are workspace-relative.
      Requires an EXISTING annotation store and an EXISTING --provenance
      sidecar (this verb creates neither).

  coverage <image> --store FILE [--out FILE] [--force] [--sample N]
      Measures how far a program has actually been reverse-engineered
      (COV-01/COV-02), through anno-coverage.ts. <image> supplies the
      PAYLOAD BYTES and the load origin; --store names the ANNOTATION STORE
      holding the labels, comments and typed ranges. Those are two separate
      files on purpose: the store holds annotations and never bytes, so a
      derived measure has to be told which bytes it is measuring and this
      verb refuses to guess one from the other.
      <image> is dispatched BY EXTENSION FIRST and never by byte length.
      Three forms are read: a .prg (its first two bytes are the load
      address); a .raw or .bin flat capture; and a file of any other
      extension that is exactly 65536 bytes, read as a flat capture. The
      retired JSON project form survives as a TRAILING LEGACY branch,
      reached only when none of those matched -- its only producer was
      deleted (D-14) and it is kept solely so an existing file on disk is
      not broken.
      Prints three separately named measures -- the structural byte census,
      the two label figures, and the sampled reproducibility result -- plus
      the comment-vacuity measure, the indirect-dispatch scan and the
      divergence sub-report, each under its own heading with its own
      numbers. Writes the JSON report to --out when given, refusing to
      overwrite an existing file there unless --force is passed; --sample
      overrides the reproducibility sample size.
      Exits non-zero for a caller error (a missing or malformed argument, a
      path outside the workspace root, a named file that does not exist, or
      a refused overwrite of an existing --out without --force), for a store
      it could not read, for a report it could not write, and for an image
      whose PAYLOAD COULD NOT BE DECODED -- that last is not a low score but
      a measurement taken over nothing, and it is reported AFTER the report
      so the reason is on screen. A LOW MEASUREMENT IS A RESULT, NEVER A
      FAILURE, so a bad report still exits 0.
      This verb deliberately reports separate numbers and never a single
      combined figure: one aggregate is precisely what makes a coverage
      claim unfalsifiable, because any one weak measure can be hidden by
      averaging it against a strong one.

Both verbs require inputs that already exist. Neither creates a project, a
store or a sidecar, and neither derives one path from another -- this CLI
never guesses (D-02).
```

`grep -c 'beside the project' src/mcp/vice/anno-cli.ts` → **0** (criterion 2).

### 2. IN-06 observed RED on its merits, then green (task 1 criterion 3)

`[--force]` temporarily removed from the `render-memmap` synopsis line:

```
not ok 42 - the verb-options map agrees with USAGE's own per-verb option lists, for both verbs (IN-06)
  error: verb "render-memmap": USAGE documents ["--provenance","--out","--check"]
         but VERB_OPTIONS accepts ["--provenance","--out","--force","--check"]
```

Reverted:

```
ok 42 - the verb-options map agrees with USAGE's own per-verb option lists, for both verbs (IN-06)
ok 43 - every verb's own documented options are still accepted, one assertion per verb (IN-06 regression guard)
```

An agreement test that has not been seen failing has not been proven to still agree; this one has.

### 3. The undecodable-payload exit, observed (task 1 criterion 6)

A real store built at `.tmp2920/probe.annostore` and a 1-byte `.prg` at `.tmp2920/undecodable.prg` (both inside the workspace root, because `coverage` confines all three of its paths):

```
$ node src/mcp/vice/vice-proxy.ts anno coverage .tmp2920/undecodable.prg --store .tmp2920/probe.annostore
coverage: <path>/undecodable.prg
  origin $0000, 0 byte(s), payload UNAVAILABLE -- ... parsePrg: input is 1 byte(s) --
  a .prg needs at least 3 bytes (2-byte load address plus at least 1 payload byte)
  ... 50 lines of report, all three measures printed ...
(stderr) coverage: the project's payload was UNAVAILABLE -- ...
EXIT 1
```

**Exit 1, after a complete report** — exactly what the corrected sentence now claims, including "reported AFTER the report so the reason is on screen". The fixture tree was removed; `git status --short` was empty before the task-1 commit.

### 4. The exit-code enumeration, from the branches rather than from intent

Every `return 1` in `cmdCoverage()` reachable after a successful argument parse, read off the source:

| Branch | Covered by the corrected sentence as |
|---|---|
| `storePathWithinWorkspace()` throws on any of the three paths | caller error — a path outside the workspace root |
| `project file not found` / `annotation store not found` | caller error — a named file that does not exist |
| `refuseOverwrite(outPath, force, "coverage")` false | caller error — a refused overwrite of an existing `--out` without `--force` |
| `openStore()` throws; the `listLabels`/`listComments`/`listRanges`/`projectImage` block throws | a store it could not read |
| `buildCoverageReport()` throws | a store it could not read (the report is built from the store's rows) |
| `writeFileSync(outPath, ...)` throws | a report it could not write |
| `!report.project.payloadDecoded` | an image whose PAYLOAD COULD NOT BE DECODED |

The pre-existing `cmdCoverage()` doc comment already stated the correct contract ("for a caller error (bad path, bad option, refused overwrite) and for a store it could not read or a payload it could not decode"). The USAGE was the drifted half, which is why `--help` — the only route a CLI caller has — was the site the verifier flagged.

### 5. The WR-02 probe, both routes, before and after (task 3 criterion 3)

| Probe | Pre-fix | Post-fix |
|---|---|---|
| **Wrap-tolerant** (`sed` strips the comment marker, `tr` joins the file, `grep -o \| wc -l`) | **3** | **0** |
| Naive single-line `grep -c 'without passing through the seam'` | **2** | 0 |

The pre-fix values were measured **before** any edit, on the base tree. The naive grep's 2 is the whole point: it matches `:339` and `:831` and is structurally blind to the third site, which is wrapped across `:68` (`... without passing through the`) / `:69` (`seam.`). Fixing two sites and then running the naive grep would have reported 0 with a false claim still in the file — a green-but-blind check standing in for a check that did not happen.

One correction to my own method, recorded because it is the same failure class: the first run of the wrap-tolerant probe returned **0**, not 3, because I had typed `sed -n` (which suppresses output) instead of `sed`. The plan's instruction — *"If it is not 3, the probe is wrong, not the file"* — is what caught it. Re-run without `-n`, it returned 3.

Residual assertions after the fix: `grep -c 'does not associate' src/mcp/vice/anno-cli.ts` → **3** (criterion 4); `grep -c 'written warrant'` → **1** (criterion 5, the CR-02/CR-03 incident record survives the correction that acts on it).

### 6. The two planted controls for the new direction (task 3 criterion 2)

**Control A — a synopsis positional with no inventory entry.** `<victim>` planted into the `render-memmap` synopsis line:

```
not ok 7 - every positional a verb's USAGE synopsis declares is named in CLI_PATH_ARGUMENTS
  error: render-memmap's USAGE synopsis declares the positional <victim>, which is not named in
         CLI_PATH_ARGUMENTS (that verb's inventoried positionals are ["<store>"]). ...
ok  8 - every CLI_PATH_ARGUMENTS positional is declared in some verb's USAGE synopsis ...
# tests 11 / # pass 10 / # fail 1
```

Direction A fires alone; direction B stays green. Reverted with `git checkout -- src/mcp/vice/anno-cli.ts`; `git status --porcelain` empty.

**Control B — a stale inventory entry with no synopsis declaration.** `{ verb: "coverage", argument: "<ghost>", kind: "positional" }` added:

```
not ok 5 - anno-cli.ts contains at least one storePathWithinWorkspace() call site per declared path argument
ok  7 - every positional a verb's USAGE synopsis declares is named in CLI_PATH_ARGUMENTS
not ok 8 - every CLI_PATH_ARGUMENTS positional is declared in some verb's USAGE synopsis ...
  error: CLI_PATH_ARGUMENTS names coverage <ghost> as a positional, but that verb's USAGE synopsis
         declares ["<image>"]. ...
# tests 11 / # pass 9 / # fail 2
```

Direction B fires and names the ghost; direction A stays green. **The second red is reported rather than hidden**: adding a seventh inventory entry without a seventh confinement call site is exactly what section 3's count assertion checks, so that red is the neighbouring assertion working, not a defect in the control. Reverted with `git checkout -- src/mcp/vice/anno-cli-path-consumers.test.ts`; `git status --porcelain` empty.

**Test count:** `anno-cli-path-consumers.test.ts` 9 tests / 9 pass → **11 tests / 11 pass** (criterion 1). The intermediate RED state at `23cae55` was 11 tests / 9 pass / **2 fail**, both new directions, failing on the live `<project>` / `<image>` drift rather than on a plant.

### 7. Gates, all green, all figures unmoved

| Gate | Result | Baseline it is checked against |
|---|---|---|
| `node --test anno-cli.test.ts anno-cli-path-consumers.test.ts module-classification.test.ts` | 89 tests, 89 pass, exit 0 | 87 before (+2 new directions) |
| `node scripts/check-skill-cli-invocations.mjs` | exit 0 — **10 invocations, 20 of 60 files, 2 trees, 2 verbs** | byte-identical to 29-19's recorded baseline; the new `<image>` synopsis spelling is still classified as a placeholder and did not enter the corpus |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 — 37 `vice_*`, 18 `anno_*`, **2/2 anno CLI verbs resolved** | unchanged |
| `node scripts/check-npm-packages.mjs` | exit 0 — **78 files / 34 files, 7 skills** | identical to `29-VERIFICATION.md` § Probe Execution |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 — 11 fork-only mentions, no stale phase-deferral prose | see deviation 2 |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 — 21 pairs, max 0.250, threshold 0.35; CLAUDE.md table 7 rows byte-identical | the `description:` YAML was untouched, proven rather than assumed |
| `node scripts/check-no-analyser.mjs` | exit 0 — 392 files, **0 temporarily allow-listed across 0 entries** | unchanged |
| `node scripts/generate-tool-support-table.mjs` | wrote `docs/tool-support.md`; `git status --porcelain` **empty** | byte-identical — this plan changes no tool name |
| `npm --prefix src/mcp/vice run typecheck` | exit 0 | — |
| `npm --prefix src/mcp/vice run test:automated` | 2752 tests, **2745 pass, 1 fail**, 1 skipped, 5 todo | see below |

**`test:automated` failing-file set: `{ repo-root.test.ts }`.** One assertion, `path agreement (D-3, D-6, ...)` at `repo-root.test.ts:178`, failing with *"the agreed directory must not sit under .claude -- got .../.claude/worktrees/agent-a04b507c3ae15afad/.vice-supervisor"*. That is verbatim `deferred-items.md` item 2: every GSD worktree lives under `.claude/worktrees/`, so `repoRoot()` legitimately resolves there. It fails identically before any edit and all three wave-1 agents hit it. Against the orchestrator's pre-dispatch baseline in the main checkout (2750 tests / 2744 pass / 0 fail at `3817d434`) the arithmetic reconciles exactly: `2750 + 2 new tests = 2752`, and `2744 + 2 - 1 = 2745` passing. No other failure.

### 8. The two skill trees, and the W4 sentence in both (task 2 criteria 2 and 7)

```
$ diff -q src/skills/c64-program-recon/SKILL.md installer/skills/c64-program-recon/SKILL.md
(no output) EXIT 0
$ diff -q src/skills/c64-program-recon/templates/memory-map.template.md \
          installer/skills/c64-program-recon/templates/memory-map.template.md
(no output) EXIT 0
```

`grep -n '2026-08-30'`, canonical tree:

```
src/skills/c64-program-recon/templates/memory-map.template.md:30: **One-time drift after upgrading, 2026-08-30.** ...
src/skills/c64-program-recon/SKILL.md:267: **Dated correction, 2026-08-30 -- the paragraph above used to name TWO drift causes ...
src/skills/c64-program-recon/SKILL.md:276: **One-time drift after upgrading, 2026-08-30.** ...
src/skills/c64-program-recon/SKILL.md:290: **Dated correction, 2026-08-30 -- `render-memmap` reads the annotation store directly ...
```

Shipped twin, same four hits at the same four line numbers (`installer/skills/c64-program-recon/...`). `:290` is **round 1's** dated correction, untouched — `grep -c 'DELETED here rather than amended' src/skills/c64-program-recon/SKILL.md` → **1** (criterion 5). The two dated notes are stacked, not merged; they concern different claims.

The measurement the W4 sentence rests on:

```
$ git ls-files | grep -i 'memory-map'
src/mcp/vice/skill-memory-mapping-cli.test.ts
src/skills/c64-memory-mapping/SKILL.md
src/skills/c64-memory-mapping/memmap.json
src/skills/c64-memory-mapping/scripts/driver.mjs
src/skills/c64-program-recon/templates/memory-map.template.md
```

The template plus four unrelated `c64-memory-mapping` files. **No committed rendered `memory-map.md`** — so nothing in this repository regresses, and the sentence exists for consuming projects, which is exactly why omitting it would have been invisible here.

`grep -n 'hand edit'` over both texts returns exactly one hit each, and both sit in a paragraph that also names the sidecar cause, the workspace-relative-location cause and the renderer cause, and states that relocating the checkout is not drift (criterion 1).

### 9. Guarded citations — re-measured TWICE, and all three moved both times

| Citation | Before | After task 1 (`bc1df6e`) | After task 3 (`2da457d`) | Cited line's content at the final value |
|---|---|---|---|---|
| structured, `symbol: "renderMemoryMap"` | `line: 94` | 94 (unchanged) | **106** | `import { renderMemoryMap, checkRenderedMemoryMap } from "./anno-memmap-render.ts";` |
| structured, `symbol: "buildCoverageReport"` | `line: 99` | 99 (unchanged) | **111** | `import { buildCoverageReport, coverageFindings, loadProjectImage } from "./anno-coverage.ts";` |
| prose, `` `checkAcceptedOptions` (`anno-cli.ts:NN`) `` | `:200` | **:222** | **:234** | `export function checkAcceptedOptions(verb: string, rest: string[]): string | undefined {` |

Task 1's edits were all *below* the two import lines and *above* `checkAcceptedOptions`, so only the prose citation moved; task 3's header edit is above all three, so all three moved. Each was corrected **in the commit that moved it**, per the plan: same-wave plans run in parallel worktrees off one base, so a citation corrected later was wrong at the commit that moved it. `node --test module-classification.test.ts` exits 0 at both commits.

Unlike 29-18 — where the same procedure correctly found that nothing had moved and the file was deliberately left unchanged — this plan's edits genuinely moved every citation, twice.

## Decisions Made

- **The cause set is 29-18's, echoed rather than recomposed.** `anno-memmap-render.ts`'s `checkRenderedMemoryMap()` doc comment and its banner prose were read (with `grep -a`, per the NUL byte at line 315) and their five causes plus the negative were carried into all three texts. Three texts stating three slightly different cause sets would have recreated the defect at a larger scale.
- **The `--store FILE is required ... will not derive its path from `<project>`` message was NOT renamed.** `scripts/lib/anno-cli-invocations.mjs`'s `REQUIRED_FLAGS` comment quotes that message **verbatim, including the `<project>` token**, as its documented provenance ("EVERY VALUE IS READ OFF THE CLI'S OWN REFUSAL BRANCH, quoted, never guessed"). That file is 29-19's and is not in this plan's `files_modified`. Renaming the message without the quote would have created exactly the class of defect this plan discharges — a comment asserting something the code does not say. The message makes no false behavioural claim (the verb genuinely will not derive `--store` from the positional, whatever the positional is spelled), so it is left, and named as a residual below rather than silently fixed or silently ignored.
- **The CR-02 incident record at `anno-cli.ts:845` keeps `coverage <project> --store <store> --out /tmp/...`.** It is a past-tense record of the command that reproduced the escape. Renaming it would falsify the record; the plan's own instruction is to preserve each paragraph's incident history.
- **Two doc comments WERE renamed** (`:203`, `:829`/`:833`): they describe the current surface in the present tense, and leaving them would have been a fresh instance of the prohibition, introduced by my own edit.
- **RED was reached by a live drift, not a plant.** Task 1's `<project>` → `<image>` rename left `CLI_PATH_ARGUMENTS` stale; the new directions caught it on their first run. That is a stronger demonstration than a plant, and the plants were still run afterwards to prove each direction fires independently.
- **`--help` stdout, not the source literal, is the declaration of record for a positional.** Same route as `anno-cli.test.ts`'s IN-06 test, for its reason: a source literal that never reached stdout would satisfy a source-scraping check while telling the caller nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` absent in the worktree**

- **Found during:** Task 1, before the first `--help` run.
- **Issue:** `src/mcp/vice/node_modules` was empty, so `node src/mcp/vice/vice-proxy.ts` could not resolve `@mastra/mcp` and criterion 1 — which requires *running* `--help` — could not run at all.
- **Fix:** `cmp` confirmed the worktree's `package-lock.json` is byte-identical to the main checkout's, then one symlink per entry (213 packages plus `.bin` and `.package-lock.json`) into the main checkout's already-installed tree. **No package manager ran, no name was resolved, no registry was contacted, no dependency was added** — so this is not the executor's excluded `npm install <pkg>` case. A single top-level symlink was not used: `.gitignore`'s `node_modules/` pattern matches directories only, and 29-18 recorded that a symlink of that name shows up as untracked.
- **Files modified:** none. Filesystem-only, gitignored, in no commit. `git status --short` empty afterwards.
- **Verification:** `anno --help` then ran and printed the USAGE.

**2. [Rule 1 - Bug, introduced by this plan's own edit] `check-skill-fork-honesty.mjs` red on the new dated note**

- **Found during:** Task 2, running the task's own `<verify>` chain.
- **Issue:** The gate reported `src/skills/c64-program-recon/SKILL.md:267: stale forward reference to a numbered phase`. Its rule is paragraph-scoped: a paragraph matching `/Phase\s+\d+/` **and** `/\b(deferred|not yet|until|unavailable)\b/i` fails. My dated correction opened *"**Until** gap-closure round 2..."* and cited *"**Phase 29** plan 29-18"* — both triggers in one paragraph.
- **Fix:** *"Until"* → *"Before"*, and *"Phase 29 plan 29-18"* → *"Plan 29-18"*. The claim is unchanged; only the two tripwire tokens are gone. This is the gate working: a paragraph that pairs a numbered phase with deferral vocabulary is exactly the shape it exists to catch, and mine was a false positive only in the sense that my sentence was retrospective rather than deferring.
- **Files modified:** `src/skills/c64-program-recon/SKILL.md` (plus the regenerated twin).
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` → exit 0, and both `diff -q` twins re-confirmed after the re-sync.
- **Committed in:** `8ded6fc` (part of the task-2 commit).

**3. [Rule 2 - Missing critical] The `--check ... hand edit` assertion, and two doc comments the rename would have falsified**

- **Found during:** Task 1.
- **Issue (a):** My first draft folded *"--check is how a hand edit to the generated file is caught"* into the enumeration as "this file was hand-edited", which broke `anno-cli.test.ts`'s `/--check.*hand edit/is` assertion. That assertion pins a real property — the USAGE must tell a caller what `--check` is for — so the test was right and the prose was wrong.
- **Issue (b):** Renaming the coverage positional in the synopsis alone would have left `anno-cli.ts:203` and `:829`/`:833` describing the surface with a spelling no caller can pass — a fresh instance of the prohibition this plan discharges, created by the fix for it.
- **Fix:** (a) the first cause is now spelled *"this file itself (a hand edit -- which is what --check exists to catch)"*, restoring the property inside the enumeration rather than beside it; (b) both doc comments renamed to `<image>` in the same commit.
- **Verification:** `node --test anno-cli.test.ts module-classification.test.ts` → 78/78, exit 0.
- **Committed in:** `bc1df6e`.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 self-introduced bug, 1 missing critical)
**Impact on plan:** None on scope. Deviation 1 changed no tracked file and was required to run the plan's own criterion 1. Deviations 2 and 3 are corrections to prose this plan itself wrote, each caught by a gate or a test rather than by review — which is the outcome the plan's whole thesis argues for. No file outside `files_modified` was touched.

## Issues Encountered

- **My own wrap-tolerant probe returned 0 on the first run** because of a stray `sed -n`. The plan's instruction to treat a non-3 pre-fix value as a broken probe rather than a clean file is what caught it. Recorded under Evidence 5 rather than quietly corrected, because a measurement instrument that silently reads zero is the same failure class the probe exists to defeat.
- **`repo-root.test.ts` fails inside a GSD worktree.** Pre-existing, documented (`deferred-items.md` item 2), reported by name, not fixed, not caused by this plan.
- **The plan's `:136` citation for the coverage synopsis line is off by one** — the line is `:137` on the base tree (`:136` is blank). The `:125` and `:130-131` citations are exact. Reported rather than silently corrected; the site was unambiguous.

## Residuals Named Rather Than Hidden

- **WR-02's expensive half is untouched, by decision.** `anno-cli-path-consumers.test.ts` still does not associate a particular argument with a particular call site. That limit is now written into all three `anno-cli.ts` headers and into the test file's own header, with its reason (per-argument dataflow through a 900-line CLI is a static-analysis project) so a later reader can close it deliberately.
- **The `coverage: --store FILE is required ... from `<project>`` message still spells the old positional.** See Decisions. Closing it means editing `scripts/lib/anno-cli-invocations.mjs`'s verbatim quote in the same change; the correct home is a pass that owns both files.
- **The other ten OPEN-AS-WARNING ids are untouched**, exactly as dispositioned: WR-03, WR-04, WR-06, WR-07, WR-08, WR-09, WR-10, WR-11, WR-12, WR-13 — plus the three deferred (WR-14 → Phase 30, WR-15/WR-16 → on record). Nothing here was planned or done for any of them, or for CUT-06.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or unwired component was introduced. The `<image>` and `<store>` tokens in the USAGE synopsis are documentation placeholders by design and are classified as such by the invocation gate's `isPlaceholder()` — proven by running the gate, whose invocation count is unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The 29-14 prohibition's counts (1), (2) and (3) are discharged; gap 1's prose half is closed and its residual named.
- `REPOINT-01` / `REPOINT-02` remain `Gaps Found` in `REQUIREMENTS.md` by design. A completed plan is not a verdict — a round-3 verification is what may move them, and this plan holds the line wave 1 set.
- The dated 2026-08-30 stopping rule stands unchanged: if round 3 again finds new defects in plan-derived truths while all five ROADMAP success criteria plus `CUT-01` read verified, the phase seals on the contract with its eleven OPEN-AS-WARNING residuals stated.
- No blockers introduced.

## Self-Check: PASSED

- All six `key-files.modified` entries exist on disk.
- All five task commits resolve in `git log`: `bc1df6e`, `8ded6fc`, `23cae55`, `c8503f9`, `2da457d`.
- No commit in this plan deleted a tracked file (`git diff --diff-filter=D` empty for each).
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified — the orchestrator owns those writes after the wave merges. `.planning/REQUIREMENTS.md` was not modified — 29-21 owns it this wave.
- The temporary fixture tree (`.tmp2920/`) was removed; both planted controls were reverted with `git status --porcelain` empty after each.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-30*
