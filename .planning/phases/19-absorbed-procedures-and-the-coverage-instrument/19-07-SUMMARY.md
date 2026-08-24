---
phase: 19-absorbed-procedures-and-the-coverage-instrument
plan: 07
subsystem: docs
tags: [licensing, mit, attribution, regenerator2000, third-party-notices, npm-packaging, node-test, gap-closure]

requires:
  - phase: 19-absorbed-procedures-and-the-coverage-instrument
    provides: "the absorbed regenerator2000 procedure prose, its five pinned upstream digests, the per-file ATTRIBUTION (ABS-02) headers, and the three THIRD-PARTY-NOTICES.md documents 19-01/19-02 landed"
provides:
  - "MIT's inclusion condition discharged BY ARTIFACT: the upstream 1072-byte LICENSE-MIT reproduced byte-for-byte in all three notices files, each hashing to sha256 e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b"
  - "A corrected statement of where the notice actually travels, true of this commit's own files[] lists — replacing a sentence that was packed to consumers and falsified three ways by the tree that shipped it"
  - "The notices guard in skill-attribution.test.ts: byte-exact presence per claiming file, an in-memory planted-violation control, and a forbidden-claim absence check scoped to NOTICES_FILES"
  - "check-npm-packages.mjs notices assertions extended from presence-in-files[] to presence-AND-content"
  - "The recorded human decision on the MIT election and the named condition that lifts the release hold"
affects: [19-08, 19-09, phase-20-decomposition-to-closure]

actuals:
  tokens: 7888
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Discharge a licence obligation by reproducing the text, then pin the reproduction by digest — an obligation asserted in prose is not an obligation discharged"
    - "The claim predicate and its discharge must be INDEPENDENT strings, or deleting the discharge deletes the obligation with it"
    - "Scope a forbidden-phrase absence check to a named file set, never repo-wide, when the guard itself must hold the phrases as constants"
    - "A packed-file-list assertion cannot see bytes: pair every files[] presence check on a document with a content check on its source"

key-files:
  created: []
  modified:
    - THIRD-PARTY-NOTICES.md
    - installer/THIRD-PARTY-NOTICES.md
    - src/mcp/vice/THIRD-PARTY-NOTICES.md
    - src/mcp/vice/skill-attribution.test.ts
    - scripts/check-npm-packages.mjs

key-decisions:
  - "Human decision (Task 2 checkpoint), option id `approve-wording-release-on-reverification`: the corrected wording and the MIT election are APPROVED as-is; the release is a separate later act. The named condition that lifts the release hold is: \"Phase 19 re-verification returns no gaps.\""
  - "INCORPORATION_CLAIM_PATTERN is derived from the incorporated-material heading's shared phrase (`regenerator2000 analysis procedures`), NOT from NOTICE_SECTION_HEADING. Keying the claim on the notice section would make the presence test tautological — a file would owe the notice exactly when it already carried it, and deleting the notice would delete the obligation with it."
  - "The forbidden-claim check normalises whitespace on both haystack and needle, so re-wrapping the paragraph cannot smuggle the deleted sentence back in. Demonstrated: the demo-2 plant was deliberately reflowed across three lines and was still caught."
  - "All three planted-violation demonstrations were run against a DISPOSABLE SHADOW TREE built with `git archive HEAD`, not by editing a real notices file. This plan's must_haves forbid a plant-and-revert against a real notices file; the acceptance criteria's `git checkout --` mechanics would have violated that prohibition, so the prohibition won. The evidence is equivalent — the real, uncopied guard code ran and produced the real failure messages recorded below."
  - "`git stash` was NOT used at any point (prohibited in this execution environment — the stash stack is shared across worktrees)."

patterns-established:
  - "Shadow-tree demonstration: `git archive HEAD | tar -x -C <tmp>` plus the uncommitted edits copied in, with CLAUDE_PROJECT_DIR pointing at the shadow, gives a real end-to-end guard failure without ever dirtying the working tree"
  - "Pair a digest constant with its byte count, so a truncated extraction reports the wrong length rather than only the wrong hash"

requirements-completed: [ABS-02]

coverage:
  - id: ABS-02/empty
    description: "A notices file that claims incorporation but carries no permission-notice block FAILS the guard — the empty/absent edge, answered EXPLICITLY"
    requirement: ABS-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#the permission-notice guard bites on a planted claiming file with no notice, and on a one-word-altered notice"
        status: pass
    human_judgment: false
  - id: ABS-02/encoding
    description: "Whose definition of equality applies is answered as BYTES: sha256 over the extracted fence content, 1072 bytes, LF line endings, no re-wrapping — a paraphrased or review-sourced notice fails"
    requirement: ABS-02
    verification:
      - kind: unit
        ref: "src/mcp/vice/skill-attribution.test.ts#every notices file that claims incorporation reproduces the upstream MIT permission notice byte-exactly"
        status: pass
    human_judgment: false
  - id: ABS-02/concurrency
    description: "BACKSTOP (flat-scalar marker): the guard performs no write, so two concurrent runs cannot interleave into a false pass and an interrupted run leaves no partial state. Discharged by construction — the planted violations are in-memory strings and the three real files are opened read-only"
    requirement: ABS-02
    verification:
      - kind: inspection
        ref: "src/mcp/vice/skill-attribution.test.ts — the notices-guard section comment, CONCURRENCY paragraph; no writeFileSync/appendFileSync/rm anywhere in the file"
        status: pass
    human_judgment: false

metrics:
  duration: "~2h wall clock across two agents (Task 1 + checkpoint, then this continuation agent)"
  completed: 2026-08-24

status: complete
---

# Phase 19 Plan 07: Discharge MIT's Inclusion Condition, and Make the Claim Checkable — Summary

The elected licence's own inclusion condition is now discharged by reproduced text rather than
asserted about, in all three notices documents, pinned to the upstream 1072-byte `LICENSE-MIT`
by sha256; the sentence the previous commit falsified three independent ways is gone, replaced
by statements true of this commit's own packed file lists; and a committed guard now fails when
a notices file claims incorporation without carrying the byte-exact notice, or when the deleted
claim returns.

## The human decision (Task 2), recorded verbatim

Plan 19-09 is required to restate BOTH of the following verbatim from this SUMMARY. They are
written here so a later agent can copy them exactly.

**Selected option id:**

```
approve-wording-release-on-reverification
```

**The named condition that lifts the release hold:**

```
Phase 19 re-verification returns no gaps.
```

The option, as presented and chosen, verbatim:

> **Approve the wording; the release is a separate act taken once Phase 19 re-verification passes.**
> The wording question is settled now, while it is cheap, and the publish is conditioned on the one
> artifact that would justify it — a re-verification that finds the gaps closed. `[skip release]`
> stays on every commit; 19-09 records "Phase 19 re-verification returns no gaps" as the named
> condition that lifts the hold, so it is a condition a later reader can check rather than a promise.

What this decision does and does not do:

- The corrected notices wording committed in `48e02f4` is **APPROVED as-is**. Task 3's guard
  constants (`UPSTREAM_MIT_NOTICE_SHA256`, `FORBIDDEN_NOTICE_CLAIMS`) were written against the
  wording exactly as it stands in that commit, with no revision to it.
- The MIT election (`19-DECISIONS.md` Decision 4) is **APPROVED**.
- The `[skip release]` hold **REMAINS IN FORCE**. This decision does not authorise a publish and
  none was performed. Both commits in this plan carry `[skip release]` in their subject.

## What was built

### Task 1 — the notice, reproduced (commit `48e02f4`, from the previous agent; re-verified here)

**Fetch command and verified digest.** The notice was fetched at the immutable commit SHA, never
at a branch:

```
curl -sfL https://raw.githubusercontent.com/ricardoquesada/regenerator2000/493f840418f1450a342bb220c2fe3d2585dd0525/LICENSE-MIT -o /tmp/upstream-LICENSE-MIT
```

verified as `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b`, 1072 bytes. The
temporary file was not committed and does not exist in the repository.

**The three extracted-block digests**, re-verified by this continuation agent before proceeding
(extracting the ````text` fence under `## Upstream MIT permission notice (regenerator2000)` and
piping to `sha256sum`):

| File | Bytes | sha256 |
|------|-------|--------|
| `THIRD-PARTY-NOTICES.md` | 1072 | `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b` |
| `installer/THIRD-PARTY-NOTICES.md` | 1072 | `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b` |
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` | 1072 | `e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b` |

All three equal the fetched upstream file. Commit `48e02f4` was confirmed present in `git log`
before any Task 3 work began.

**The sentence that was deleted**, transcribed from `git show HEAD~1:src/mcp/vice/THIRD-PARTY-NOTICES.md`:

> The MIT permission notice and copyright above travel inside every absorbed file's header, which
> is what ships in both published tarballs.

It was false three independent ways at the moment it shipped: the permission-notice text existed
nowhere in the repository; the absorbed headers carry the copyright line and the licence NAME
only; and `@henols/vice-mcp` packs zero skill files, so no absorbed header ships in that tarball
at all — while the false claim itself did.

**The exact replacement wording** now at `src/mcp/vice/THIRD-PARTY-NOTICES.md:116-127`:

> MIT's own inclusion condition is discharged here by reproduction rather
> than by assertion: the upstream permission notice and copyright are
> reproduced in full, byte-for-byte, in **Upstream MIT permission notice (regenerator2000)**
> below. Each absorbed file additionally carries its own per-file
> `ATTRIBUTION (ABS-02)` header naming the source repository, the source path,
> the pinned commit, the sha256 of the upstream bytes, the upstream licence and
> this project's election — that header is what survives a consumer copying a
> single playbook out of a package. The absorbed skill files themselves are
> packed by `@henols/c64-re-tools` only: this package, `@henols/vice-mcp`, packs
> no skill file at all (compare the two `files[]` lists), which is precisely why
> the notice is reproduced in this document rather than relied on to arrive
> inside an absorbed header.

The repo-root pointer's parallel sentence was likewise corrected from the unnamed singular "the
published tarball" to name `@henols/c64-re-tools` explicitly, and to state that `@henols/vice-mcp`
packs no skill file.

### Task 3 — the guard (commit `f941eef`)

`src/mcp/vice/skill-attribution.test.ts` (432 → 746 lines) gains a notices-guard section with its
own banner comment stating why it exists, why the list is named rather than globbed, why equality
is bytes, and why the absence half is scoped and must stay so.

New module constants: `NOTICES_FILES` (three repo-relative paths resolved through `ROOT`),
`UPSTREAM_MIT_NOTICE_SHA256`, `UPSTREAM_MIT_NOTICE_BYTES`, `NOTICE_SECTION_HEADING`,
`NOTICE_FENCE_OPEN`, `INCORPORATION_CLAIM_PATTERN`, `FORBIDDEN_NOTICE_CLAIMS`.

New predicates, each pulled out so it can be handed a planted string: `claimsIncorporation()`,
`extractPermissionNotice()` (content-anchored, bounded to the notice section so a later section's
fence cannot be borrowed), `forbiddenClaimsIn()`, and `normaliseProse()`.

Four new tests, taking the suite from 8 to 12, all passing:

1. `every notices file that claims incorporation reproduces the upstream MIT permission notice byte-exactly`
2. `the permission-notice guard bites on a planted claiming file with no notice, and on a one-word-altered notice`
3. `no notices file carries a claim about the notice that this commit falsifies`
4. `the forbidden-claim set is non-empty and its predicate bites on a planted string`

`scripts/check-npm-packages.mjs` gains `needNoticesCarryPermissionNotice()`, invoked for both
packages immediately after their existing `files[]` presence assertions. The existing assertions
are kept: `npm pack --dry-run --json` reports packed file NAMES and never their bytes, so a
notices document that is present but gutted was previously invisible, and "absent" versus
"present-but-gutted" are different producer bugs that must both be caught.

## Planted-violation demonstrations

All three were run against a **disposable shadow tree** (`git archive HEAD | tar -x` into the
scratchpad, with the uncommitted Task 3 edits copied in and `CLAUDE_PROJECT_DIR` pointed at it).
The shadow was confirmed green on both guards before each plant, and was deleted afterwards. **No
real notices file was edited at any point** — this plan's must_haves forbid a plant-and-revert
against a real notices file, and that prohibition takes precedence over the acceptance criteria's
`git checkout --` mechanics. See Deviations below.

### 1. One word altered inside the fenced notice (`installer/THIRD-PARTY-NOTICES.md`)

`sublicense` → `sublicence`. Observed:

```
not ok 9 - every notices file that claims incorporation reproduces the upstream MIT permission notice byte-exactly
  error: |-
    installer/THIRD-PARTY-NOTICES.md: the reproduced permission notice is 1072 bytes with sha256
    9eaac7c42f31963e90443de0cfb3d80a35c06188f3dd48892e0d3d1c72ea1ed4, expected 1072 bytes with sha256
    e2579ce7a10784ea205270fc7775e75c07b283f7a5f6e1fdd31f20f8b8a4973b -- the notice must be the upstream
    LICENSE-MIT bytes at commit 493f840418f1450a342bb220c2fe3d2585dd0525, not a re-wrapped, paraphrased
    or review-sourced copy (19-REVIEW.md's own copy is ELIDED -- do not transcribe from it)
```

Note the byte count is unchanged at 1072 — the digest is what catches it, exactly as intended.

### 2. A deleted forbidden claim re-added, deliberately RE-WRAPPED (`src/mcp/vice/THIRD-PARTY-NOTICES.md`)

The deleted sentence was reinserted broken across three lines, to prove normalisation defeats
reflow. Observed:

```
not ok 11 - no notices file carries a claim about the notice that this commit falsifies
  error: |-
    these notices files carry a claim about the permission notice that the repository falsifies --
    the notice does NOT travel inside an absorbed file's header (headers name the licence, they do
    not reproduce it), and absorbed headers do NOT ship in both tarballs (@henols/vice-mcp packs zero
    skill files): src/mcp/vice/THIRD-PARTY-NOTICES.md: "The MIT permission notice and copyright above
    travel inside every absorbed file's header, which is what ships in both published tarballs.";
    src/mcp/vice/THIRD-PARTY-NOTICES.md: "travel inside every absorbed file's header";
    src/mcp/vice/THIRD-PARTY-NOTICES.md: "ships in both published tarballs"
```

All three overlapping forbidden entries fired, and the re-wrapped plant was caught.

### 3. The notice section removed entirely (`installer/THIRD-PARTY-NOTICES.md`)

The whole `## Upstream MIT permission notice (regenerator2000)` section was deleted. The shadow's
`node scripts/check-npm-packages.mjs` went from exit 0 to **exit 1**:

```
check-npm-packages: FAIL
  - installer: installer/THIRD-PARTY-NOTICES.md is packed but does not reproduce the upstream MIT
    permission notice -- ABS-02 requires the elected licence's own inclusion condition ("The above
    copyright notice and this permission notice shall be included in all copies or substantial
    portions of the Software.") to be discharged by the shipped document, not asserted about it
```

The `files[]` presence assertion still passed on that same run — which is precisely the blind spot
the content check closes.

## Verification results

| Check | Result |
|-------|--------|
| `cd src/mcp/vice && node --test skill-attribution.test.ts` | **12 pass, 0 fail** (8 → 12; the plan's floor is ≥12) |
| `node scripts/check-npm-packages.mjs` | **exit 0** — vice-mcp 75 files, c64-re-tools 34 files / 7 skills |
| Three extracted notice blocks, `sha256sum` | **all three** `e2579ce7…4973b`, 1072 bytes |
| `cd src/mcp/vice && npx tsc --noEmit` | **exit 0** |
| `node scripts/check-skill-tool-coverage.mjs` | **exit 0** |
| `node scripts/check-skill-description-overlap.mjs` | **exit 0** |
| `grep -c 'NOTICES_FILES' src/mcp/vice/skill-attribution.test.ts` | **12** (floor is 4) |
| `git diff -- …skill-attribution.test.ts \| grep -c '^+.*\.planning/phases/19'` | **0** — WR-11 not aggravated |
| Artifact floors | test file 746 ≥ 470; notices 255 ≥ 215 / 110 ≥ 78 / 55 ≥ 24 |
| Commit subjects carry `[skip release]` | both (`48e02f4`, `f941eef`) |

### Full test suite — reported honestly

`cd src/mcp/vice && npm test` (the FULL suite, not `test:automated`):

```
# tests 2555
# suites 24
# pass 2508
# fail 2
# skipped 40
# todo 5
# duration_ms 94390
```

**Two failures, both pre-existing and neither caused by this plan.** They are the same two
19-06's SUMMARY recorded, unchanged in kind:

1. `docs-review-disposition.test.ts` — `19-REVIEW.md` findings with no disposition anywhere:
   `IN-02`, `IN-03`, `WR-04`, `WR-05`, `WR-06`, `WR-07`, `WR-08`, `WR-09`, `WR-10`, `WR-11`.
2. `audit-integrity.test.ts` (D-12-02) — cascades from (1): it refuses a gated milestone-audit
   status while any docs guard is red.

**What this plan owns and discharges of that list:** `WR-11` and `WR-12`, both **DEFERRED** with
reasons (below), and `CR-03`, which this plan **FIXES** — all three are named in this SUMMARY,
which is a recognised disposition source for the phase, so `WR-11` leaves the list when this
commit lands. (`WR-12` and `CR-03` were already dispositioned and are not on it.)

**What this plan does not own:** `IN-02`, `IN-03`, `WR-04` … `WR-10` sit in the coverage
instrument. `19-07-PLAN.md` assigns their dispositions to plans **19-08 and 19-09**. Both
failures will therefore persist until those plans land, and this SUMMARY does not claim otherwise.

## Deferred dispositions

- **`WR-11`** — three suites and five shipped-prose citations hard-code a `.planning/phases/19-…`
  path that GSD archives at milestone close. **DEFERRED.** It touches
  `skill-attribution.test.ts`, which this plan edits, but it is a pre-existing archival-fragility
  concern spanning five other files and three suites; fixing it here would expand a licence fix
  into a path-resolution refactor across shipped skill prose. It is real and will bite at the next
  milestone close. This plan did NOT aggravate it: the guard introduces **zero** new hard-coded
  `.planning/` paths (verified — the grep above returns 0), and `NOTICES_FILES` is deliberately
  repo-relative and stable for exactly this reason.
- **`WR-12`** — `manifestEntryFor()` lies to the type system and can throw a `TypeError` instead
  of its intended message. **DEFERRED.** Same file, different function; this plan's guard does not
  call it. One-line fix, no licence consequence, no gap depends on it.
- **`CR-03`** — the originating code-review finding for this gap (a shipped documentation claim
  the same commit falsifies). **FIXED** by Task 1 and made checkable by Task 3.

## Deviations from Plan

### 1. [Rule 2 — values/prohibition precedence] Planted-violation demonstrations run against a shadow tree, not by editing real notices files

- **Found during:** Task 3 acceptance-criteria execution.
- **Issue:** The acceptance criteria instruct: "temporarily change one word inside the fenced
  notice in `installer/THIRD-PARTY-NOTICES.md`, re-run the suite … then restore with
  `git checkout --`", and similarly for the other two demonstrations. The plan's own `must_haves`
  say the opposite and say it as a hard constraint: the guard must be demonstrated to fail "on a
  planted string held only in memory — **never by editing a real notices file**". A
  plant-and-revert against a real notices file also risks leaving a legal claim mutated in the
  working tree if the run is interrupted, which is the precise failure the constraint exists to
  prevent. `git stash` is prohibited in this execution environment, so it was not an escape either.
- **Fix:** The prohibition won. All three demonstrations ran in a disposable shadow tree built
  with `git archive HEAD | tar -x` into the scratchpad, with the uncommitted Task 3 edits copied
  in and `CLAUDE_PROJECT_DIR` pointed at the shadow so `repoRoot()` resolved there. The **real,
  uncopied** guard code and the **real** `check-npm-packages.mjs` executed and produced the
  failure messages recorded above. The shadow was verified green before each plant and deleted
  afterwards. The working tree was never dirty; `git status --porcelain` showed exactly the two
  intended files as modified before the commit.
- **Files modified:** none beyond the plan's own file set.
- **Commit:** `f941eef` (the guard); the demonstrations themselves produced no repository change.

### 2. [Rule 2 — non-vacuity] `INCORPORATION_CLAIM_PATTERN` derived from the incorporated-material phrase, not from the notice heading

- **Found during:** Task 3 design.
- **Issue:** The plan says to derive the claim pattern "from the section heading Task 1's files
  already carry". Read as the NEW `## Upstream MIT permission notice (regenerator2000)` heading,
  that would make the presence test tautological — a file would owe the notice exactly when it
  already carried one, and deleting the notice would delete the obligation with it. Additionally,
  the repo-root pointer states its incorporation claim as a bullet, not a heading, so a
  whole-heading match would have excluded it.
- **Fix:** The pattern is the shared PHRASE from the pre-existing incorporated-material heading,
  `regenerator2000 analysis procedures`, which all three files carry and which is independent of
  the notice section. The reasoning is recorded in the constant's own doc comment so it cannot be
  "simplified" back into a tautology later.
- **Commit:** `f941eef`.

### 3. [Rule 2 — non-vacuity] `UPSTREAM_MIT_NOTICE_BYTES` added alongside the digest

- Not named in the plan. A second, independent handle on the same bytes, so a truncated extraction
  reports the wrong length rather than only a mismatched hash, and the failure message can say so.
  Demonstration 1 exercised exactly this: the byte count stayed 1072 while the digest changed,
  making it obvious the alteration was a substitution and not a truncation.
- **Commit:** `f941eef`.

## Known Stubs

None. No placeholder values, no `TODO`/`FIXME`, no skipped tests were introduced by this plan.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no schema
change. The one network fetch (`T-19G-07-01`) was a one-off authoring-time provenance fetch at an
immutable commit SHA, digest-verified before transcription and pinned in the committed guard; it
is not a runtime or CI-time integration, so `COVERAGE.md`'s `No external API integration`
declaration remains correct and was not amended. `/tmp/upstream-LICENSE-MIT` (`T-19G-07-04`) is
not in the repository. No package was installed and no dependency added (`T-19G-07-SC`).

## Self-Check: PASSED

- `THIRD-PARTY-NOTICES.md` — FOUND (55 lines, notice block digest verified)
- `installer/THIRD-PARTY-NOTICES.md` — FOUND (110 lines, notice block digest verified)
- `src/mcp/vice/THIRD-PARTY-NOTICES.md` — FOUND (255 lines, notice block digest verified)
- `src/mcp/vice/skill-attribution.test.ts` — FOUND (746 lines)
- `scripts/check-npm-packages.mjs` — FOUND (modified, exit 0)
- Commit `48e02f4` — FOUND in `git log`
- Commit `f941eef` — FOUND in `git log`
</content>
