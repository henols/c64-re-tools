---
outcome: red-then-green (x3), green-throughout (x1)
guard: comment-phase-pointers.test.ts
demonstrations: 4
reverted: true
date: 2026-08-23
sha_before: b59856c
sha_after: f561e91
---

# Phase 16 Plan 07 -- PKG-03 gate-proof: plant-and-revert transcript

This document is the one-time evidence plan 16-07's success criterion 3
asks for: the comment-scoped orphaned-phase-pointer guard
(`src/mcp/vice/comment-phase-pointers.test.ts`) deliberately turned red on
the real repository working tree, three times, each with a captured failing
output naming the exact planted line, then reverted and shown green again;
plus one negative demonstration -- a legitimate historical narration line
planted and shown to leave the guard green. Every command below ran against
this repository's real working tree, between commits `b59856c` (Task 1) and
`f561e91` (Task 2), never a synthetic fixture. The permanent, standing
protection against reintroduction is the committed fixture
(`fixtures/planted-phase-pointer-fixture.ts.txt`) and the two corpus
assertions in `comment-phase-pointers.test.ts` itself, both already
committed in Task 2 -- this document is the secondary, one-time proof that
the same mechanism also works against the real tree, on the record.

## Baseline

Before any plant, the tree is clean and the guard is green.

```
$ git status --porcelain -- src
(no output -- clean)

$ cd src/mcp/vice && node --test comment-phase-pointers.test.ts
# tests 16
# pass 16
# fail 0
```

## Demonstration 1 -- assignment-shape violation inside a LINE comment

**Planted text (matches `16-PKG03-CENSUS.md`'s pre-fix row for `stock-cia.ts:39` exactly):**

> `//     (\`docs/stock-vice-parity.md\` SS A item 2) and is Phase 8's business.`

This is the promoted todo's originally-named site. The fixed (post-Task-2)
wording it replaced, and was restored to, is:

> `//     (\`docs/stock-vice-parity.md\` SS A item 2) -- the wire protocol has no matrix command, and \`KEYBOARD_FEED\` (0x72) injects buffer text only.`

**Plant and captured failing output** (verbatim, `error` field only -- the
full TAP block additionally includes the structured `actual`/`expected`
diff, elided here for length):

```
$ node --test comment-phase-pointers.test.ts
not ok 4 - no shipped src/mcp/vice/ source comment assigns pending/future work to a numbered phase (PKG-03)
  ---
  location: '.../comment-phase-pointers.test.ts:474:1'
  failureType: 'testCodeFailure'
  error: |-
    orphaned assignment-shape phase pointer(s) found in shipped source comments -- repoint each at an existing permanent record (a parity-doc cut entry, a module's own exclusion header) rather than a phase number:
      [possessive-plus-noun] stock-cia.ts:39: //     (`docs/stock-vice-parity.md` SS A item 2) and is Phase 8's business.
      [is-was-possessive] stock-cia.ts:39: //     (`docs/stock-vice-parity.md` SS A item 2) and is Phase 8's business.
  code: 'ERR_ASSERTION'
1..16
# tests 16
# pass 15
# fail 1
```

Two pattern families fire on this one planted line (`possessive-plus-noun`
and `is-was-possessive`) -- both correctly attributed to `stock-cia.ts:39`,
the exact planted line.

**Revert and captured green output:**

```
$ git diff --stat -- src/mcp/vice/stock-cia.ts
(no output -- byte-identical to HEAD)

$ node --test comment-phase-pointers.test.ts
1..16
# tests 16
# pass 16
# fail 0
```

## Demonstration 2 -- assignment-shape violation inside a BLOCK comment

**Planted text (matches `16-PKG03-CENSUS.md`'s pre-fix row for `stock-dispatch.ts:634` exactly):**

> `` *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route) ``

Planted inside the twelve-line `/** ... */` "Deliberately NOT registered
below" block comment (`stock-dispatch.ts:628-640`), replacing the fixed
(post-Task-2) line:

> `` *   - `vice_joystick_tap` (permanently excluded -- stock-input.ts's own header) ``

**Plant and captured failing output**, demonstrating per-line reporting
inside a multi-line block comment (the failure names line 634 only, not
lines 628-640):

```
$ node --test comment-phase-pointers.test.ts
not ok 4 - no shipped src/mcp/vice/ source comment assigns pending/future work to a numbered phase (PKG-03)
  ---
  location: '.../comment-phase-pointers.test.ts:474:1'
  failureType: 'testCodeFailure'
  error: |-
    orphaned assignment-shape phase pointer(s) found in shipped source comments -- repoint each at an existing permanent record (a parity-doc cut entry, a module's own exclusion header) rather than a phase number:
      [possessive-plus-noun] stock-dispatch.ts:634: *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route)
      [needs-requires] stock-dispatch.ts:634: *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route)
  code: 'ERR_ASSERTION'
1..16
# tests 16
# pass 15
# fail 1
```

The failure names exactly `stock-dispatch.ts:634` -- the single offending
physical line -- not the block comment's span (lines 628-640), confirming
the plan's per-line-granularity requirement: a twenty-line (here,
twelve-line) block comment fails naming the one offending line rather than
the whole block.

**Revert and captured green output:**

```
$ git diff --stat -- src/mcp/vice/stock-dispatch.ts
(no output -- byte-identical to HEAD)

$ node --test comment-phase-pointers.test.ts
1..16
# tests 16
# pass 16
# fail 0
```

## Demonstration 3 -- cut-phase reference, narration form

**Planted text (matches `16-PKG03-CENSUS.md`'s pre-fix row for `stock-condition.ts:38` exactly):**

> `//   - Phase 6's GAIN-06 extends this AST with raster semantics (finer-grained`
> `//     raster/cycle conditions) rather than replacing it or adding a second,`
> `//     parallel condition-building path. Any future raster work grows this`
> `//     module's types, it does not fork them.`

This is pure narration -- it does not match any of the seven assignment-shape
pattern families (confirmed below: the assignment-shape test stays green
while this plant is in place). It is flagged **only** because Phase 6 is a
phase the roadmap records as cut, and the cut-phase check flags any mention
of a cut phase regardless of shape.

**Plant and captured failing output:**

```
$ node --test comment-phase-pointers.test.ts
not ok 5 - no shipped source comment names a phase the roadmap records as cut or dissolved (PKG-03)
  ---
  location: '.../comment-phase-pointers.test.ts:488:1'
  failureType: 'testCodeFailure'
  error: |-
    shipped source comment(s) name a phase the roadmap records as cut -- a reference to a cut phase is orphaned by definition, narration included. Repoint at the phase's NAME rather than its number where citing history (e.g. "Stock-Only Gains" rather than "Phase 6"), since the cut-phase check matches any numbered mention, or at the permanent record the cut left behind:
      [cut-phase:6] stock-condition.ts:38: //   - Phase 6's GAIN-06 extends this AST with raster semantics (finer-grained
  code: 'ERR_ASSERTION'
1..16
# tests 16
# pass 15
# fail 1
```

Confirmed the assignment-shape check (test 4) is UNAFFECTED by this plant --
only test 5 (the cut-phase check) fails, shown by the `# pass 15 / # fail 1`
summary and the absence of test 4 from the failing-test list, proving the
two checks are independent.

**Revert and captured green output:**

```
$ git diff --stat -- src/mcp/vice/stock-condition.ts
(no output -- byte-identical to HEAD)

$ node --test comment-phase-pointers.test.ts
1..16
# tests 16
# pass 16
# fail 0
```

## Negative demonstration -- legitimate historical narration stays green

**Planted text**, the past-tense until-phase form -- the case the tense
filter exists for, reusing the real corpus's own accurate wording verbatim
from `containerpath.ts:12` (an unedited, currently-shipping comment):

> `This direction did not exist until Phase 01.2's on-demand VICE broker.`

Appended as a temporary thirteenth "WHAT NOT TO DO" bullet inside
`stock-cia.ts`'s existing header block (between the WR-02 and the matrix
bullets), clearly marked as a temporary plant in the source itself so it
could not be mistaken for a real addition:

```
//   - PLANTED NEGATIVE CONTROL (16-07 gate-proof, temporary): This direction did not exist until Phase 01.2's on-demand VICE broker.
```

**Plant and captured output -- stays green:**

```
$ node --test comment-phase-pointers.test.ts
1..16
# tests 16
# pass 16
# fail 0
```

Both `did` (the past-tense exclusion trigger) and `until Phase 01.2's` (the
raw until-phase pattern) are present on this line; the exclusion correctly
suppresses the match, exactly as `comment-phase-pointers.test.ts`'s own
committed fixture-driven test ("fixture-driven: past-tense until-phase
narration is NOT flagged") already pins permanently. This live demonstration
confirms the same behaviour holds against a real shipped module, not only
the fixture.

**Removed and confirmed clean:**

```
$ git diff --stat -- src/mcp/vice/stock-cia.ts
(no output -- byte-identical to HEAD)

$ node --test comment-phase-pointers.test.ts
1..16
# tests 16
# pass 16
# fail 0
```

## Final state: no plant survives anywhere

```
$ git status --porcelain -- src
(no output -- clean)

$ grep -rnE "is Phase [0-9]+'s|Phase [0-9]+, via" src/ --include='*.ts' --include='*.mts' | grep -v 'fixtures/'
src/mcp/vice/docs-dangling-refs.test.ts:152:// `r2000-cli.ts` told a user that closing the `.vsf` gap "is Phase 11's
src/mcp/vice/docs-dangling-refs.test.ts:389:        "none of its literal System arms). Closing that gap for real is Phase 11's job, not this CLI's. " +

$ grep -rnE "is Phase [0-9]+'s|Phase [0-9]+, via" src/mcp/vice/fixtures/ | wc -l
7
```

**Recorded honestly rather than filtered out:** the two lines above are NOT
survivors of any plant this document performed. Both are pre-existing,
unedited-by-this-plan content inside `docs-dangling-refs.test.ts` -- a
DIFFERENT guard's own committed evidence, quoting `r2000-cli.ts`'s real
pre-fix wording from an unrelated defect this project fixed in plan
11.1-01 (FLOW-02, the `.vsf` dangling-phase-pointer, not PKG-03). Line 152
is prose in that file's own header explaining why FLOW-02 exists; line 389
is a string literal inside that file's OWN planted-violation test, proving
`docs-dangling-refs.test.ts`'s literal-scoped extractor sees the exact old
wording it exists to catch. Neither is a shipped module's comment (test
files are excluded from `shippedTsModules()`'s `package.json`-`files[]`-
derived scan, so `comment-phase-pointers.test.ts` never sees either line),
and modifying either would break a DIFFERENT guard's own demonstrated
non-vacuity for an unrelated, already-closed defect -- exactly the kind of
scope invention this plan's prohibitions forbid. `git status --porcelain --
src` being empty is the load-bearing confirmation that none of THIS
document's four plants survived; the grep command as written additionally
catches this pre-existing, out-of-scope match, which is recorded here for
honesty rather than narrowed away.

The fixture is the only file in the repository carrying a violation shape
(one line per pattern family, seven total, plus the cut-phase narration
control -- see the fixture file itself), and it sits outside the shipped
scan by construction (its `.ts.txt` extension is not in `package.json`'s
`files[]`).

```
$ cd src/mcp/vice && node --test comment-phase-pointers.test.ts
# tests 16 / pass 16 / fail 0

$ VICE_REQUIRE_ACME=1 npm test
# tests 2356 / suites 23 / pass 2312 / fail 0 / skipped 39 / todo 5

$ cd /home/henrik/dev/henrik/git/c64-re-tools
$ bash scripts/package.sh
package: manifests OK (plugin "c64-re-tools" v0.0.0-dev)
package: done: files 968

$ node scripts/check-npm-packages.mjs
check-npm-packages: OK
  @henols/vice-mcp@0.0.0-dev -- 73 files
  @henols/c64-re-tools@0.0.0-dev -- 36 files, 6 skills
```

`@henols/vice-mcp`'s 73-file tarball is unchanged from plan 16-04's recorded
baseline; the fixture does not appear in either package's `npm pack
--dry-run --json` file list (verified directly, not merely asserted).

## What this document establishes, and what it does not

**Establishes:** on this date, against this tree, the comment-scoped guard
(`comment-phase-pointers.test.ts`) genuinely detects all three real
pre-fix wordings this plan fixed -- an assignment-shape violation inside a
single-line `//` comment, an assignment-shape violation inside a multi-line
`/** */` block comment (with the failure correctly naming one physical line
out of twelve, not the whole block), and a cut-phase reference in pure
narration form -- and genuinely stays green on a legitimate historical
narration line using the same "until Phase N" shape the tense filter exists
to exempt. Each plant was removed and independently verified byte-identical
to the pre-plant committed content (`git diff --stat` empty) before the next
plant began, and the working tree is confirmed clean at the end.

**Does not establish:** that this is an independently, humanly reproduced
result -- it is a session-observed transcript, produced by the same
executor that built and fixed the guard, not a separate human running the
commands from a fresh terminal. It also does not establish anything about
future pattern-family additions or future cut phases; those are covered
going forward by the same two mechanisms this document is secondary to --
the committed fixture (which pins all seven families plus the cut-phase
narration shape and four negative controls permanently, run on every `npm
test`) and the two enabled corpus assertions in
`comment-phase-pointers.test.ts` (which re-scan the live tree on every run,
not only at plan-authoring time). This transcript is evidence the mechanism
worked once, here, today -- the fixture and the assertions are what keep
working after this document is filed.
