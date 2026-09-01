---
phase: 27-shared-seams-extracted
plan: 05
subsystem: mcp-vice-classification-record
tags: [seam-extraction, capability-or-glue, enforcing-guard, derived-relation, phase-evidence]

# Dependency graph
requires:
  - phase: 27-shared-seams-extracted
    provides: "27-01's acme-gate.ts (the gate module's ACME half left, so its entry cites ten remaining importers and no shim)"
  - phase: 27-shared-seams-extracted
    provides: "27-02's block-class.ts (the census gained a named store boundary, cited in its entry's note)"
  - phase: 27-shared-seams-extracted
    provides: "27-03's prg-image.ts (the project builder's glue-with-extractable obligation discharged, so its verdict is plain glue)"
  - phase: 27-shared-seams-extracted
    provides: "27-04's shipped-modules.ts (its shippedTsModules() is what the new guard's files[]-absence check calls, rather than a fifth hand copy)"
provides:
  - "src/mcp/vice/module-classification.ts — the committed capability-or-glue verdict for every module in the declared scope, with its basis, its extractables and every deliberate scope exclusion"
  - "ModuleVerdict / ModuleClassificationEntry / MODULE_CLASSIFICATION / classificationFor (plus ModuleScope, ModuleConsumer, ModuleBasis)"
  - "src/mcp/vice/module-classification.test.ts — nine directions, a planted violation driving the SAME named predicates as the real scan, and a non-vacuity threshold DERIVED from the registry rather than pinned"
  - "Criterion 4's evidence: the full-glob command named verbatim, the broker state, the runner's own counts, and the zero-deletions query as command output"
  - "Three newly measured line-citation drifts, and one measured correction to which module EXPORT-02's typed-label clause actually anchors"
affects: [phase-32-anno-deletion, phase-28-store-core, npm-packaging]

tech-stack:
  added: []
  patterns:
    - "Record-as-data-plus-guard: a judgement a later phase will ACT on is committed as a typed const, not as prose, so a module slipping in unclassified is a red rather than a stale paragraph"
    - "Derived non-vacuity relation instead of a pinned or growing literal floor: the threshold is taken from the registry, so a broken glob fails loudly while legitimate growth AND legitimate deletion stay green"
    - "Justification-versus-citation split: the mechanical prohibition scans the basis only, and the `note` field is deliberately exempt so the record can discuss the very hazard it exists to remove"
    - "Predicate sharing as the trust property: every direction is a named function that the real scan and the planted-violation test both call"

key-files:
  created:
    - src/mcp/vice/module-classification.ts
    - src/mcp/vice/module-classification.test.ts
  modified: []

key-decisions:
  - "OQ-2 resolved: the verify module is recorded `capability` per criterion 2, with its basis written as the DISCIPLINE (acmeVerdict()'s never-trust-the-exit-code parse) and the tension against EXPORT-01's own text stated in its `note` — so a later phase reads a basis it can act on rather than a verdict it will contest"
  - "OQ-4 resolved: both scripts/lib/ files are carried as registry DATA with scope: \"out-of-enumeration\", while the enforcing test's enumeration stays inside src/mcp/vice/ — CUT-04's blind spot closed five phases early without a test that reaches into scripts/"
  - "Consumer paths are ALWAYS repository-root-relative, uniformly, rather than directory-relative-with-exceptions: consumers legitimately live under scripts/ and src/skills/ as well as beside the registry"
  - "Direction 4's prohibition is PHRASE-based, not substring-based: every honest citation in this family contains the family's own naming, so a bare substring test would reject the whole record and be switched off within a milestone"
  - "The three `SEAM-02`-anchored entries plus the data file are NAMED as the weakest basis shape in the header, rather than left to look as well-grounded as the rest"
  - "Direction 6's threshold is derived from the registry, explicitly superseding hostpath-consumers.test.ts's `ANNO_MODULE_FLOOR = 14` growing-literal pattern, with the reason recorded at the assertion so a later reader does not 'restore' the literal"

requirements-completed: [SEAM-02]

coverage:
  - id: D1
    description: "module-classification.ts holds one entry per in-enumeration item plus the two out-of-enumeration files, each with a basis of cited consumers and requirement ids, none justified by the module's name, the ten criterion-2 modules recorded capability, the contested verdict flagged, the discharged extractables recorded, every scope exclusion written into an EXCLUDED, DELIBERATELY section, and the survey result stated"
    requirement: SEAM-02
    verification:
      - kind: other
        ref: "grep -cE '^export (type|interface|const|function) (ModuleVerdict|ModuleClassificationEntry|MODULE_CLASSIFICATION|classificationFor)' => 4; grep -c 'module: \"' => 19; grep -c 'EXCLUDED, DELIBERATELY' => 1; grep -c 'glue-with-extractable' => 5; grep -c 'out-of-enumeration' => 8"
        status: pass
      - kind: other
        ref: "grep -c on anno-regbits.json => 4, scripts/lib/anno-cli-verbs => 3, docs-absorbed-decisions.test.ts => 1, acmeVerdict => 2, prg-image.ts => 3, acme-gate.ts => 1, block-class.ts => 1"
        status: pass
      - kind: other
        ref: "grep -ciE '(prefix|because of its name)' => 6 matches, ALL in header comment lines 40/44/52/133/134 and interface doc comment 214; zero inside any basis object (three occurrences were rewritten out of a basis and two notes to reach this)"
        status: pass
      - kind: other
        ref: "grep -cE 'from \"./(hostpath|containerpath)' => 0; grep -c node:test => 0; grep -c ASSUMED => 0; git diff --stat -- src/mcp/vice/package.json => empty"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck (tsc --noEmit, exit 0) — the typed const's free shape check"
        status: pass
      - kind: unit
        ref: "cd src/mcp/vice && node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts assumption-label-discipline.test.ts hostpath-consumers.test.ts => 49 tests, 49 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D2
    description: "module-classification.test.ts implements all nine directions with the non-vacuity threshold derived from the registry, no equality assertion on any count, the in-scope set enumerated from disk with an explicit filter, order-independence proven over a reversed copy, advisory lines verified by containment, and a planted violation driving the same named predicates across five bad cases and one clean one"
    requirement: SEAM-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/module-classification.test.ts => 16 tests, 16 pass, 0 fail (plan floor was 11)"
        status: pass
      - kind: other
        ref: "grep -cE 'assert\\.equal\\([A-Za-z]+\\.length, *[0-9]+\\)' => 0 — no pinned total anywhere; grep -c readdirSync => 2; grep -cE '>=' => 2; grep -c note => 5"
        status: pass
      - kind: other
        ref: "each of the nine named predicates appears >= 2 times (8/4/5/5/9/6/7/5/8) — the real scan and the planted test drive the SAME functions"
        status: pass
      - kind: other
        ref: "PROBE A (Direction 1 fires on a real absence): empty src/mcp/vice/anno-planted-probe.ts planted => 15 pass / 1 fail, message names the file; deleted => 16 pass / 0 fail"
        status: pass
      - kind: other
        ref: "PROBE B (Direction 6 fires on a narrowed glob): enumeration filter narrowed to anno-c* => 12 pass / 4 fail, Direction 6 reporting '3 paths on disk but the registry declares 17 in-enumeration entries'; restored byte-identical => 16 pass / 0 fail"
        status: pass
      - kind: other
        ref: "node -e '...files.includes(\"module-classification.ts\")' exits 0; git diff --stat -- anno-verify.test.ts hostpath-consumers.test.ts empty; git diff --stat -- test-gate.mjs empty; node --test test-gate.test.ts => 3 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criterion 4's evidence: the full-glob suite run with the broker confirmed stopped, the typecheck and the tarball validator green, the deletion query returning zero, the module family intact at or above its floor, and the phase's files[] diff exactly two entries"
    requirement: SEAM-02
    verification:
      - kind: other
        ref: "pgrep -f 'vice-brok[e]r' finds no process; pgrep -x x64sc finds no process (the bare pattern the plan names self-matched this shell's own command line — see Deviation 2)"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && npm test (node --test '*.test.*') => 2636 tests, 2520 pass, 44 fail, 0 cancelled, 67 skipped, 5 todo, 1,880,048 ms; EXIT 1. All 44 are the dispositioned pre-existing failures (5 anno-session.test.ts + 39 vice-proxy.test.ts) — see Issues Encountered"
        status: fail
      - kind: other
        ref: "cd src/mcp/vice && npm run typecheck => exit 0"
        status: pass
      - kind: integration
        ref: "node scripts/check-npm-packages.mjs => 'transitive closure from vice-proxy.ts -- 60 modules, clean' / 'check-npm-packages: OK' / '@henols/vice-mcp@0.0.0-dev -- 77 files'; exit 0"
        status: pass
      - kind: other
        ref: "test \"$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts | grep -c anno)\" = \"0\" => exit 0; the count prints 0 and the UNFILTERED deletion list for that range is also 0 lines"
        status: pass
      - kind: other
        ref: "ls src/mcp/vice/anno-*.ts | grep -vc '\\.test\\.ts$' => 16, recorded as a floor (>= 16), never an equality"
        status: pass
      - kind: other
        ref: "git diff 6c1f569..HEAD -- src/mcp/vice/package.json => exactly two added lines, +\"block-class.ts\" and +\"prg-image.ts\", zero removed; the three test-only new modules absent (node -e exits 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The phase's six break-and-restore probes are consolidated with each one's broken state, its observed RED and its restoration"
    requirement: SEAM-02
    verification:
      - kind: other
        ref: "four probes drawn verbatim from 27-01/27-02/27-03/27-04's own SUMMARYs (not re-run) plus this plan's two, each observed RED with counts and each restored — see Consolidated Observed-RED Probes"
        status: pass
    human_judgment: false

metrics:
  duration: "49 min"
  completed: "2026-08-27"

actuals:
  tokens: 15945
  tasks: 3
  commits: 3

status: complete
---

# Phase 27 Plan 05: The Capability-or-Glue Record and Its Enforcing Guard Summary

**Every module in the analyser-named family now carries a committed
capability-or-glue verdict derived from what it does — nineteen entries with
cited consumers, requirement ids and stated scope exclusions — and a
sixteen-test guard whose non-vacuity threshold is DERIVED from the registry
rather than pinned makes a module slipping in unclassified a red rather than a
stale paragraph.**

- **Start:** 2026-08-27T07:11Z
- **End:** 2026-08-27T08:00Z
- **Duration:** 49 min
- **Tasks:** 3 of 3
- **Files:** 2 created, 0 modified
- **Commits:** 3 (`d3323fb`, `157c480`, plus this metadata commit)

## Accomplishments

1. **`src/mcp/vice/module-classification.ts` (698 lines)** holds nineteen
   entries: the sixteen non-test modules, the generated `anno-regbits.json`
   data file, and both `scripts/lib/` files carried as data with an explicit
   `out-of-enumeration` marker. Four exports match the plan's contract
   (`ModuleVerdict`, `ModuleClassificationEntry`, `MODULE_CLASSIFICATION`,
   `classificationFor`) plus three supporting types. It imports nothing.
2. **Every basis was populated from the post-extraction tree, not from the
   planning documents** — measured by grepping the live tree for each module's
   importers and then checking every intended line citation against disk before
   writing a single entry. Three citations had drifted; see below.
3. **The ten modules criterion 2 names are recorded `capability`.** Their bases
   split exactly as the discriminator predicts: two rest on requirement ids
   alone (the ACME identifier module and the confidence module have no
   consumer outside the family at all), and the header says so out loud with
   file:line citations, because that is the trap `SEAM-02`'s own wording sets.
4. **The contested verdict is flagged, not smoothed.** The verify module is
   `capability`, its basis is the discipline, and its `note` states the tension
   against `EXPORT-01`'s verbatim text in full.
5. **`src/mcp/vice/module-classification.test.ts` (534 lines, 16 tests)**
   implements all nine directions plus three planted-violation tests and the
   `files[]`-absence check. Every direction is a named predicate that both the
   real scan and the planted test call. Two break-and-restore probes were
   observed RED and restored.
6. **Criterion 4's evidence was produced with the broker confirmed stopped**,
   and it is recorded honestly: the full-glob run exits 1 on 44 pre-existing,
   already-dispositioned failures, with zero failures anywhere in this phase's
   own files, zero `anno` deletions and the module family intact.

## Task Commits

1. **Task 1: Write the classification registry against the post-extraction
   tree** — `d3323fb` (feat)
2. **Task 2: Create the enforcing guard — relations, never counts, with a
   planted violation** — `157c480` (test)
3. **Task 3: Prove the phase was a move rather than a change** — this metadata
   commit (its deliverable is this SUMMARY's evidence, not source code)

## Criterion 4 Evidence

Every element below is a command and its output, not a claim.

### 1. The broker was stopped, and why that matters

```
pgrep -f 'vice-brok[e]r'   ->  no process
pgrep -x x64sc             ->  no process
```

**Why it matters, stated rather than assumed:** the backend-ordering test
(`BACK-05`) in the stdio-proxy suite reddens **deterministically** on a
live-broker host. It is a recorded environmental condition with an open todo
(`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`),
it is pre-existing, and fixing it is broker behaviour with no requirement in
this phase. A suite result taken on a live-broker host is therefore not merely
noisy — it is *uninterpretable*, because a red there would mean nothing either
way. No broker and no `x64sc` was started at any point in this plan.

The pattern the plan names literally (`pgrep -f 'vice-broker'`) **self-matched
this shell's own command line** and reported a false positive; the
character-class form above cannot. See Deviation 2.

### 2. The typecheck

```
cd src/mcp/vice && npm run typecheck     # tsc --noEmit -p tsconfig.json
-> exit 0
```

Run after each task and again at the plan gate. This phase's characteristic
failure mode is a half-done import split across a dozen files, and the
typechecker catches that class before the suite does.

### 3. The full-glob suite — the command named verbatim

The command is `package.json`'s own `test` script, read out of the manifest
rather than remembered:

```
"test": "node --test '*.test.*'"
```

Run as `cd src/mcp/vice && npm test`. **`npm run test:automated` was NOT used
as evidence anywhere in this plan.** That script is `node test-gate.mjs`, which
runs `automatedTestFiles()` — the whole glob minus the frozen nine-file
`MANUAL_ONLY_TESTS` list. Naming the nine it would have skipped, read out of
`test-gate.mjs` directly:

`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`,
`stock-live.test.ts`, `stock-live-triage.test.ts`,
`stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`,
`fork-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`.

`vice-proxy.test.ts` is the second of those nine and carries the only
end-to-end wire proof in the suite. Two committed CI guards
(`ci-guardrails.test.mjs`) exist specifically to stop that substitution
happening upstream.

**Counts, as reported by the runner:**

```
# tests 2636
# suites 24
# pass 2520
# fail 44
# cancelled 0
# skipped 67
# todo 5
# duration_ms 1880048.267847     (~31.3 min)
NPM_TEST_EXIT=1
```

An independent count taken from the TAP stream itself, so the summary is not
the only source: **2410 flat result lines — 2366 `ok`, 44 `not ok`, 67
`# SKIP`-marked**. (The runner's higher `# tests` figure counts nested
subtests inside the 24 suites; both numbers are recorded rather than
reconciled away.)

**The skip count did not drop.** 67 skips, all pre-existing availability gates
(`the external analyser` absent, `ANNO_BIN` unset). A skip count that *fell* would
be as much a signal as a failure, which is why it is recorded.

**The 44 failures, decomposed by owning file:**

| Count | File | Cause |
|---|---|---|
| 5 | `anno-session.test.ts` | `D-27-02-A`. The plan-18-06 queue tests spawn a real child with no availability gate, so on a host without `the external analyser` they FAIL where every sibling in the same file SKIPs cleanly. Last modified in phase 18; in no phase-27 plan's `files_modified`; **open and unclaimed by any plan, including this one**. |
| 39 | `vice-proxy.test.ts` | `D-27-02-B`. Needs a reachable host/broker; it is entry 2 of the frozen `MANUAL_ONLY_TESTS` list precisely for that reason, and no broker was running because starting one would deterministically redden `BACK-05`. `npm test`'s bare glob does not consult that list. |

Both are recorded in this phase's own `deferred-items.md` and were **not
fixed** — each lies outside every plan's file set. **Zero failures occur in
any file this phase created or modified**
(`grep -cE '^not ok .*(acme-gate|block-class|prg-image|shipped-modules|module-classification|DIRECTION|substitutability|independence)'`
returns `0`), and all sixteen of the new guard's tests are present as `ok`
inside this run — twelve `DIRECTION`-titled, three planted-violation, one
structural.

The 5 `# todo` entries are the five `vice-sync.ts` checkpoint-wait gaps
`CLAUDE.md` documents as deliberately not unit-tested. Expected forever.

**`npm test` exits 1, and this SUMMARY records it red with its attribution
rather than narrowing the command.** The plan's own criterion asked for exit 0;
that was unsatisfiable on this host before this plan began, because the 44
dispositioned failures pre-date it — `27-02` already measured the same suite at
2337 pass / 44 fail. An honest red plus its cause is evidence; a green from a
different command is not.

### 4. The tarball validator

```
node scripts/check-npm-packages.mjs
-> check-npm-packages: transitive closure from vice-proxy.ts -- 60 modules, clean
-> check-npm-packages: OK
->   @henols/vice-mcp@0.0.0-dev -- 77 files
->   @henols/c64-re-tools@0.0.0-dev -- 35 files, 7 skills
-> exit 0
```

The closure walk holds at `27-03`'s 60 modules and the shipped tarball at 77
files, as expected: this plan's two files are both unshipped. One honest
observation: the `@henols/c64-re-tools` count reads **35** here where `27-03`
recorded 34. It is **not attributable to this phase** —
`git diff --stat 6c1f569..HEAD -- src/skills` is empty, so no skill file
changed at all. `installer/skills/` is gitignored and regenerated by `prepack`,
and the most likely cause is a stale entry left in that regenerated tree by an
earlier run. Recorded rather than explained away; the validator exits 0, which
is what the criterion asks.

### 5. The zero-deletions query — criterion 4's actual substance

```
test "$(git diff --diff-filter=D --name-only 6c1f569..HEAD -- src/mcp/vice scripts | grep -c anno)" = "0"
-> exit 0
```

Output of the inner pipeline: `0`. And the **unfiltered** deletion list for
that range is `0` lines — nothing at all was deleted in either directory across
the whole phase, not merely nothing `anno`-named. The wrapped `test "$(…)"`
form matters: the bare pipeline prints `0` but *exits 1*, because `grep -c`
returns no-match status even when its count is the count we want.

### 6. The module family is intact, stated as a floor

```
ls src/mcp/vice/anno-*.ts | grep -vc '\.test\.ts$'
-> 16          (floor: >= 16, satisfied)
```

Never an equality. A pinned total is this project's standing hazard, and this
phase's own directory gained four files — none of which matches the family's
naming, which is why the 16 did not move.

### 7. `files[]` accounting for the whole phase

```
git diff 6c1f569..HEAD -- src/mcp/vice/package.json
-> +    "block-class.ts",
-> +    "prg-image.ts",
```

**Exactly two added lines, zero removed, and no `dependencies` or
`devDependencies` line touched.** The three test-only new modules are absent:

```
node -e 'const f=require("./src/mcp/vice/package.json").files; const bad=["acme-gate.ts","module-classification.ts","shipped-modules.ts"].filter(n=>f.includes(n)); process.exit(bad.length?1:0)'
-> exit 0
```

## OQ-2: the verify module is `capability`, on the discipline rather than the route

Resolved exactly as `27-RESEARCH.md` recommended, and the tension is written
into the entry itself rather than only into a planning document.

**The verdict** is `capability`, because criterion 2 is the phase's own binding
text and a registry should not overrule it. **The basis** is the discipline:
`acmeVerdict()` at `anno-verify.ts:116` derives its result only from parsed
assembler result lines — unanimity required, no passing line may hide a later
failing one, a refusal to guess when two are present, a skipped assembler read
as a failure rather than an absence of evidence, and the aggregate summary line
(the line that actually lied in the captured transcript) never parsed at all.
Requirement ids `EXPORT-01` and `EXPORT-03`.

**The tension, in the entry's own `note`:** `EXPORT-01`'s preamble states
verbatim that the existing verify seam invokes the analyser and parses *its*
transcript, and that only the discipline survives. So a later phase inherits
the discipline and its two pinned false-pass transcripts, **not the route** —
and the note says to act on the discipline and not to read the verdict as a
claim that the route survives. That is what a later phase can act on instead of
a verdict it would contest.

## OQ-4: both `scripts/lib/` files are carried as data, out of enumeration

Resolved as the research recommended. The enforcing test's **enumeration** stays
inside `src/mcp/vice/` (respecting D-09), and both
`scripts/lib/anno-cli-verbs.mjs` and its `.d.mts` declaration are carried in
the registry **data** with `scope: "out-of-enumeration"` plus a `note` stating
that the enumeration does not reach them. `CUT-04` names the former explicitly
as a guard whose fate must be recorded, so this closes that blind spot five
phases early for the cost of two entries and no test reaching into `scripts/`.

Direction 7 proves the marker is what does the excluding rather than a special
case inside the loop: removing every out-of-enumeration entry changes neither
completeness direction's result.

The third scope decision a reader will look for is recorded in the same place:
`docs-absorbed-decisions.test.ts` is named in the `EXCLUDED, DELIBERATELY` section
because a reader will expect it and the enumeration does not match it (its name
begins `docs-`), and the nineteen `anno-*.test.ts` files are excluded because a
test file's fate follows its module's and a committed drift guard already
ensures every on-disk test file lands in exactly one of the automated or
manual-only sets.

## The glue-module extractables survey — what it found

**Result: none found.** The third verdict therefore has **zero instances** at
the time this record is written, which is a correct outcome and is stated in
the header rather than left to look like a vacuum. The survey was run, not
assumed; four candidates were considered and rejected on measurement, each
recorded in the module's own `note` or in the header:

| Candidate | Site | Why not an extractable |
|---|---|---|
| `parseAnnoTimeoutMs` | `anno-launch.ts:251` | Pure parser with a range refusal, but its subject is the analyser's own spawn-timeout env var and it has no consumer outside the family |
| `checkAcceptedOptions` | `anno-cli.ts:330` | Generic argv option checker, used only by the CLI it lives in and that CLI's own test |
| `resolveStorePath`, `composeAddressDetails` | `anno-tools.ts:972`, `:1121` | Both exist to work around specific behaviours of the analyser's own tool surface |
| the single-flight session queue | `anno-session.ts:294` onward | Generic *discipline*, but an implementation bound to the analyser child process, and no consumer outside the family |

The one genuine instance was the project builder, and `27-03` discharged it in
full: `parsePrg`, `flatImageOrigin` and `decodeRawData` all moved into
`prg-image.ts` byte-identically with no shim. Its entry records that discharge
by name so a reader does not conclude the obligation was overlooked.

## Consolidated Observed-RED Probes (six, none re-run here)

Four are drawn verbatim from the preceding plans' own SUMMARYs; two are this
plan's. Each was broken deliberately, observed RED, and restored.

| # | Plan | What was broken | Observed RED | Restored |
|---|---|---|---|---|
| 1 | 27-01 | The `VICE_REQUIRE_ACME` env guard removed from `assertAcmeRequiredIfEnvSet`, so the assertion always runs | `not ok 4 — non-vacuity control: the identical child run with VICE_REQUIRE_ACME ABSENT exits zero`; 5 pass / 1 fail | byte-identical to the committed file; 6 pass / 0 fail |
| 2 | 27-02 | One raw-string block-type comparison planted back at the census's divergence loop | 110 pass / **2** fail — the substitutability proof's non-vacuity assertion *and* the structural supplement, two independent detectors | `git diff --stat` empty against `d5b7e3c`; 112 pass / 0 fail |
| 3 | 27-03 | `parsePrg`'s minimum length loosened from 3 to 2 | `not ok 2 — parsePrg: a 2-byte or shorter input throws`; 7 pass / 1 fail | byte-identical to `56b7d0d`; 8 pass / 0 fail |
| 4 | 27-04 | The `files[]`-entry existence check removed from `shippedTsModules()` | `not ok 2 — planted violation: a files[] entry missing from disk THROWS a named error`; 8 pass / 1 fail | `diff` against the pristine copy empty; 9 pass / 0 fail |
| 5 | **27-05** | An empty `src/mcp/vice/anno-planted-probe.ts` planted in the enumeration scope | `not ok 2 — DIRECTION 1 (completeness)`, message reading `these in-scope files have no capability-or-glue verdict: anno-planted-probe.ts`; 15 pass / 1 fail | file deleted; 16 pass / 0 fail |
| 6 | **27-05** | The enumeration filter narrowed with `.filter((name) => name.startsWith("anno-c"))` | `not ok 1 — DIRECTION 6 (non-vacuity)`, message reading `the in-scope enumeration found 3 paths on disk but the registry declares 17 in-enumeration entries`; 12 pass / 4 fail | restored from a pristine copy, `diff` empty; 16 pass / 0 fail |

Probe 6's three additional reds (Direction 2's two tests and the completeness
planted violation) are informative rather than noise: a narrowed glob is caught
by more than one direction, and Direction 6 is the one that names the cause.

## Requirement-to-Artifact Mapping

| Requirement | Artifact that evidences it | Plan |
|---|---|---|
| **SEAM-01** | `src/mcp/vice/acme-gate.ts` (five symbols, byte-identical names, no shim; `grep -ci acme` on the origin module returns 0) plus `acme-gate.test.ts`'s two-direction child-process observation of the hard FAIL | 27-01 |
| **SEAM-02** | `src/mcp/vice/module-classification.ts` (nineteen recorded verdicts, none justified by name) plus `module-classification.test.ts`'s nine enforcing directions. Supported by `prg-image.ts` (27-03), which removed the census's last import from a module a name-driven deletion takes away, and `shipped-modules.ts` (27-04), which put the four hand-copied guard enumerators under one non-family name | 27-05, 27-03, 27-04 |
| **SEAM-03** | `src/mcp/vice/block-class.ts` plus the committed substitutability proof: a zero-overlap second block vocabulary through the boundary holds every census byte count exact and moves only the divergence sub-report | 27-02 |

## Measured Corrections to the Plan

**1. `EXPORT-02`'s typed-label clause anchors the CENSUS, not the ACME
identifier module.**
The plan directs that "the ACME-identifier module rests on the typed-label-prefix
requirement, its only unprefixed-surviving basis". Measured:
`AUTO_NAME_PREFIX_RE` — the symbol `EXPORT-02` names verbatim — is declared at
`anno-coverage.ts:1392`, not in the ACME identifier module. So `EXPORT-02` was
recorded on the census's entry, and the ACME identifier module's basis is
`EXPORT-01` and `EXPORT-03` instead (identifier legality is a precondition of
source a real assembler accepts). Both entries carry the correction in their own
`note`/header text so a later reader does not re-derive the wrong anchor.

**2. Three more line-citation drifts measured, on top of the two the research
pass already found.** Every intended citation was checked against disk *before*
the registry was written, which is what caught them:

| Citation the planning documents give | Measured site | Drift |
|---|---|---|
| the confidence-grade import into the census, `anno-coverage.ts:133` | `:144` | +11 (27-02 inserted the block-boundary import above it) |
| the CLI's first description of the verify verdict, `anno-cli.ts:83` | `:91` | +8 |
| the CLI's second description, `anno-cli.ts:623` | `:631` | +8 |
| `openAnnoSession` in `anno-session.ts:102` | `:554` | `:102` is the closing brace of a multi-line import statement; the symbol is not on it |

This is exactly the liability the plan predicted, now measured three more
times, and it is why `line` is optional and verified by containment rather than
trusted. Direction 9 would have caught every one of these as drift.

**3. The plan's arithmetic held exactly.** 16 non-test modules + 1 data file +
2 `scripts/lib/` files = 19 entries, re-measured on disk. The four modules this
phase added (`acme-gate.ts`, `block-class.ts`, `prg-image.ts`,
`shipped-modules.ts`) match neither the family's naming nor the enumeration, so
the 16 did not move.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The completeness planted-violation test was coupled to the
real filesystem, which made an observed RED unattributable**

- **Found during:** Task 2, on the first run of Probe A.
- **Issue:** the planted-violation test built its synthetic disk list as
  `[...inEnumerationOnDisk(), "anno-planted-probe.ts"]`. When Probe A planted a
  real file of that name on disk, the same name appeared twice in the list, so
  the test went red *alongside* Direction 1 — 14 pass / 2 fail. Renaming the
  synthetic entry alone did not fix it: the real enumeration still contained the
  planted file, so `unclassified` had two elements either way. An observed RED
  that reddens two tests for two different reasons is an observation a reader
  cannot attribute, which is the whole point of a probe.
- **Fix:** the synthetic disk list is now **fully synthetic** —
  `["anno-cli.ts", "anno-regbits.json", "anno-synthetic-unclassified.ts"]` —
  two names the registry classifies plus one it does not. A predicate test
  should exercise the predicate, not the filesystem. The measurement and the
  reason are recorded in a comment at the site so a later reader does not
  "simplify" it back to appending onto the real enumeration.
- **Files modified:** `src/mcp/vice/module-classification.test.ts`
- **Verification:** Probe A re-run → **15 pass / 1 fail**, red on exactly
  Direction 1, with the message naming `anno-planted-probe.ts`; restored →
  16 pass / 0 fail. Typecheck exit 0.
- **Commit:** `157c480` (fixed before the commit; the probe gate blocked it
  until the attribution was clean)

**2. [Rule 3 - Blocker] A stale whole-glob run from an earlier plan had been
hung for 67 minutes and would have made this plan's evidence uninterpretable**

- **Found during:** Task 3, asserting the environment.
- **Issue:** two separate problems, both blocking.
  (a) The plan's literal precondition command, `pgrep -f 'vice-broker'`,
  **self-matched this shell's own command line** — the pattern string appears in
  the shell's `args`, so `pgrep -f` reported a "running broker" that was the
  check itself. Taking that at face value would have aborted a correct run;
  ignoring it would have skipped the check entirely.
  (b) A `node --test '*.test.*'` process (PID 2116939, started 08:18:31 local,
  cwd `src/mcp/vice`) had been running **67 minutes** and was stuck on
  `vice-proxy.test.ts`, alongside nine orphaned
  `broker-e2e/probe-answering-stub.cjs` processes holding broker ports
  6600–6605. A second whole-glob run alongside those would contend for the same
  ports and temp directories, and its result would not be attributable.
- **Fix:** (a) used `pgrep -f 'vice-brok[e]r'` — the character class cannot
  match the checking shell's own literal while still matching `vice-broker` —
  plus `pgrep -x x64sc` (an exact `comm` match, which cannot match a shell) and
  a full listing of every `node` process on the host, all recorded above.
  (b) terminated the hung runner, its `vice-proxy.test.ts` child and the nine
  orphaned probe stubs. The six long-lived `vice-proxy.ts` processes were
  **deliberately left alone** — those are live Claude Code sessions' MCP
  servers, not brokers, and killing them would break the sessions' tool surface.
- **Verification:** after the cleanup both broker checks report no process and
  no `node --test` runs remain; the evidence run then completed with attributable
  results.
- **Commit:** none (environment, not code).

**3. [Rule 3 - Blocker] The full-glob run does not terminate on this host:
`vice-proxy.test.ts` finishes its tests and then leaks two LISTEN sockets**

- **Found during:** Task 3, waiting on the evidence run.
- **Issue:** after ~11 minutes the run's output froze with only
  `vice-proxy.test.ts` (PID 2308306) still alive. Diagnosed rather than guessed:
  state `Sl`, **zero CPU consumed across a 5-second sample** (utime/stime `322
  50` before and after), **all 2410 of its result lines already emitted** (the
  last being its final `vice_recycle` test), and **two LISTEN sockets still
  open** — `127.0.0.1:34211` (fd 21) and `127.0.0.1:42613` (fd 22). It was not
  running tests; it had finished them and could not exit because two
  test-created listeners were never closed. This is the same hang the 67-minute
  stale run had hit, so it is reproducible on this host and not a one-off.
- **Fix:** terminated that one child after 19 minutes of zero output and zero
  CPU, which let the runner emit its own totals for the whole glob. The kill
  added **no** failure — `# fail 44` matches the dispositioned count exactly, so
  the totals are the genuine whole-glob totals rather than an artefact of the
  termination. An independent count taken from the TAP stream *before* the kill
  (2410 results, 2366 `ok`, 44 `not ok`, 67 `# SKIP`) is recorded alongside the
  runner's summary so a reader can check one against the other.
- **Why the command was not narrowed:** substituting a command that excludes
  the nine manual-only files — whether via `npm run test:automated` or by
  hand-deriving the same set — is exactly what this plan's prohibition forbids.
  The full-glob command stays the evidence; the hang and its attribution are
  recorded as findings.
- **Scope:** the leak is in `vice-proxy.test.ts`, a file in no phase-27 plan's
  `files_modified` and on the frozen `MANUAL_ONLY_TESTS` list. **Not fixed
  here** — logged to `deferred-items.md` as `D-27-05-A`.
- **Commit:** none (environment/diagnosis, not code).

---

**Total deviations:** 1 auto-fixed Rule 1 bug plus 2 Rule 3 blockers resolved
in the environment, and 3 measured corrections to the plan's expectations.
**Impact:** no deliverable, no verdict and no acceptance criterion changed
meaning. The Rule 1 fix is the substantive one — without it, this plan's
central reddenability evidence would have been an observation nobody could
attribute to a single cause, which is the same defect class the probes exist to
rule out. Deviation 3 is the honest cost of insisting on the full glob: the
command cannot terminate unaided on this host, and that is now written down
rather than papered over with a narrower green.

## Issues Encountered

**`npm test` exits 1, on 44 pre-existing failures this phase neither caused nor
claims.** Decomposed by file above; both items were already recorded in
`deferred-items.md` before this plan ran, and `D-27-02-A` is explicitly noted
there as open and unclaimed — `27-04`'s SUMMARY corrects the ledger's guess that
it belonged to that plan (it owns `spawn-seam.test.ts`, a guard *about*
spawn sites, not the session module). This plan does not claim it either: it
lies outside `files_modified` and outside every task's scope.

**One new deferred item, `D-27-05-A`:** `vice-proxy.test.ts` leaks two LISTEN
sockets and prevents `node --test` from exiting, so the whole-glob suite cannot
terminate unaided on a host with no broker. Reproduced twice (a stale 67-minute
run and this plan's own), diagnosed to two open fds with zero CPU consumption
after all results were emitted. Out of scope: the file is in no phase-27 plan's
file set.

## Known Stubs

None. No stub, placeholder or unrun `<verify>` was introduced. The 67 skips in
the whole-glob run are all pre-existing `the external analyser` availability gates
(an expected-forever SKIP by D-11's design) and the 5 `todo` entries are
`vice-sync.ts`'s documented, deliberately-untested checkpoint-wait invariants —
neither count moved because of this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change
at a trust boundary. Every threat in the plan's own register was mitigated as
planned:

- `T-27-05-01` (a verdict recorded on a basis the record did not use):
  Direction 4 scans every basis field and rejects a name-as-justification, the
  planted-violation test drives the same predicate against a synthetic
  name-justified entry, and the contested verdict is flagged in its own entry.
  Three occurrences of the forbidden token were rewritten *out* of basis and
  note fields during the acceptance loop to keep the guard meaningful.
- `T-27-05-02` (a module slipping in unclassified, or an entry left behind):
  Directions 1 and 2 assert the relation in both directions from a disk
  enumeration; a real planted module was observed RED with the file named, then
  removed.
- `T-27-05-03` (the enumeration glob narrowing silently): Direction 6's
  threshold is derived from the registry, placed before every loop, and the
  narrowed-glob case was observed RED. A pinned literal was explicitly rejected
  with the reason recorded at the assertion.
- `T-27-05-04` (a green claimed from the narrowed gate or a live-broker host):
  the broker state is asserted and stated, the full-glob command is named
  verbatim from the script's own definition, the counts are recorded, and the
  red is recorded red with its attribution.
- `T-27-05-05` (the registry leaking into the tarball): asserted mechanically
  in the registry's own test via `27-04`'s extracted enumerator *and* a direct
  manifest read, plus the phase-level two-entry accounting.
- `T-27-05-06` (an advisory line citation drifting): lines are optional and
  verified by containment; three real drifts were caught before the entries were
  written.
- `T-27-05-SC`: `package.json` is untouched by this plan
  (`git diff --stat` empty), so it remains vacuously satisfied.

## Next Phase Readiness

**Phase 27 is complete.** All three requirements have a named artifact, zero
`anno` modules were deleted or renamed across the whole phase, and the
extraction is demonstrably a move: the unfiltered deletion list for
`6c1f569..HEAD` is empty in both `src/mcp/vice` and `scripts`.

What a later phase inherits, stated so it does not have to be re-derived under
deletion pressure:

- **A record it can act on.** Nineteen verdicts with bases, plus a guard that
  fails if the record stops matching the tree. Read the *rationale* on the four
  `SEAM-02`-anchored entries and on the contested verify verdict before acting
  on those five; the header names them for exactly that reason.
- **The third verdict has zero instances today**, and the survey that
  established that is written into the header with its four rejected candidates.
- **Two live gaps remain open and unclaimed:** `D-27-02-A` (five ungated queue
  tests in `anno-session.test.ts`) and the new `D-27-05-A` (the
  `vice-proxy.test.ts` listener leak that prevents the whole-glob suite from
  terminating). Neither is a phase-27 regression; both are in
  `deferred-items.md`.
- **The confidence grades are a second, unmoved store surface** (carried forward
  from `27-02` and recorded in the confidence module's entry): the census
  answers from the grade token and returns before consulting the block class, so
  `SEAM-03`'s substitutability proof does not cover a store substitution that
  changes grade spellings.

## Self-Check: PASSED

- `src/mcp/vice/module-classification.ts` — FOUND (698 lines)
- `src/mcp/vice/module-classification.test.ts` — FOUND (534 lines)
- Commit `d3323fb` — FOUND
- Commit `157c480` — FOUND
- All Task 1 acceptance criteria re-run: 14 of 14 pass (including the
  `prefix`-outside-`basis` check by reading every match)
- All Task 2 acceptance criteria re-run: pass, including the nine
  predicate-sharing counts and both break-and-restore probes
- All Task 3 acceptance criteria re-run: pass, except `npm test` exit 0 —
  recorded red with its attribution as the plan's own instruction requires
- Plan-level `<verification>` re-run at HEAD: broker absent; typecheck exit 0;
  full-glob 2636 tests / 2520 pass / 44 fail / 67 skipped, exit 1 with all 44
  dispositioned; `check-npm-packages.mjs` exit 0; zero-deletions exit 0;
  family floor 16 (>= 16)

## TDD Gate Compliance

Task 2 carried `tdd="true"`. The RED and GREEN gates are present as commits
(`d3323fb` is the `feat`, `157c480` the `test`) but **in the inverted order**,
and that inversion is the plan's own design rather than a discipline lapse: the
registry has to exist before a guard can enumerate against it, and Task 1's
`<precondition>` and `<reversibility rating="costly">` both say so explicitly.
The substance of the RED gate — proof that the guard can be made to fail — was
discharged by the two break-and-restore probes above, each observed RED with its
counts and its message, then restored to a byte-identical file. `workflow.tdd_mode`
is off for this run, so no gate validation was bypassed.
