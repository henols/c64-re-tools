---
phase: 15-debt-and-review-disposition
reviewed: 2026-08-22T18:29:17Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - .claude/mcp/vice/build-atomic.test.ts
  - .claude/mcp/vice/capability-registry.test.ts
  - .claude/mcp/vice/capability-registry.ts
  - .claude/mcp/vice/disasm-roundtrip.test.ts
  - .claude/mcp/vice/docs-dangling-refs.test.ts
  - .claude/mcp/vice/docs-deferred-ledger.test.ts
  - .claude/mcp/vice/docs-review-disposition.test.ts
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get.json
  - .claude/mcp/vice/fixtures/binmon/cpuhistory-get-multi.json
  - .claude/mcp/vice/fixtures/binmon/README.md
  - .claude/mcp/vice/fixtures/planted-review-fixture.md
  - .claude/mcp/vice/fork-deleted-tools.ts
  - .claude/mcp/vice/fork-live.test.ts
  - .claude/mcp/vice/fork-manifest-surface.test.ts
  - .claude/mcp/vice/r2000-cli.test.ts
  - .claude/mcp/vice/r2000-cli.ts
  - .claude/mcp/vice/r2000-project.test.ts
  - .claude/mcp/vice/r2000-project.ts
  - .claude/mcp/vice/r2000-test-gate.ts
  - .claude/mcp/vice/README.md
  - .claude/mcp/vice/stock-a4-checkpoint-flood.test.ts
  - .claude/mcp/vice/stock-broker-live.test.ts
  - .claude/mcp/vice/stock-connect.test.ts
  - .claude/mcp/vice/stock-connect.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-live.test.ts
  - .claude/mcp/vice/stock-machine.test.ts
  - .claude/mcp/vice/stock-machine.ts
  - .claude/mcp/vice/stock-registers.test.ts
  - .claude/mcp/vice/stock-registers.ts
  - .claude/mcp/vice/test-gate.mjs
  - .claude/mcp/vice/test-gate.test.ts
  - .claude/mcp/vice/tool-support-table.test.mjs
  - .claude/mcp/vice/vice-proxy-ping.test.ts
  - .claude/mcp/vice/vice-proxy.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - CLAUDE.md
  - .claude/skills/c64-ram-capture/RELEASES.json.example
  - .claude/skills/c64-ram-capture/SKILL.md
  - docs/stock-vice-parity.md
  - docs/tool-support.md
  - .github/workflows/ci.yml
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - scripts/lib/skill-corpus.mjs
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-22T18:29:17Z
**Depth:** standard
**Files Reviewed:** 45 (`git diff 5710a3a5300b66469c880f2f03a5a38da03cb9a2^..HEAD` scope)
**Status:** issues_found

## Summary

This is a debt-and-disposition phase: most of the diff is comment/prose
correction, todo-path fixes, review-finding closures (WR-06/07/08/09/10/11/12/13,
IN-02/IN-05), and a widened finding-disposition parser. The bulk of it is
careful, well-tested, and consistent with CLAUDE.md's documented constraints —
I ran the full `test:automated` suite (`node test-gate.mjs`, which is what
`npm run test:automated` invokes) plus the three skill-lint/table-generation
scripts and they are all green (2112 tests, 2107 pass, 0 fail, 5 todo; scripts
exit 0 with no diff against the committed generated docs).

However, running `node --test` directly against `vice-proxy.test.ts` (a file
CI's own `npm test` step deliberately includes, per this phase's own updated
`ci.yml` comment) surfaces one real regression introduced by this phase's
`stock-registers.ts` change: a structural network-call guard now fails
because of a code comment, not a real network call. This is a genuine defect
this phase's work introduced and left unnoticed because `test:automated`
excludes `vice-proxy.test.ts` (it is one of the nine files in
`MANUAL_ONLY_TESTS`) — the failure is invisible to the test command a
developer would normally run, but not to CI's `npm test`, which this same
phase's own `ci.yml` comment argues should be trusted to catch exactly this
class of thing.

Two lower-severity issues: a doc-count that drifted out of sync with the
`MANUAL_ONLY_TESTS` array this same phase extended, and a documented
"three independent bounding techniques" invariant across three source files
that is not actually true for one edge case (field ordering inside a
`ToolDefinition` literal).

## Critical Issues

### CR-01: stock-registers.ts's new IN-02 comment breaks vice-proxy.test.ts's network-call structural guard

**File:** `.claude/mcp/vice/stock-registers.ts:109`
**Issue:**
This phase's promise-caching fix for the register-catalog race (15-04, IN-02)
added this doc comment:

```
 * rejected fetch (empty enumeration or a wire error) is evicted from the
```

`vice-proxy.test.ts` has a structural regression test (added in an earlier
phase, still present and still run) that scans every non-test `.ts`/`.mts`/`.js`/`.mjs`
file under `.claude/mcp/vice/` for the pattern `/\bfetch\s*\(/` and asserts the
offender set is EXACTLY `["broker-launch.mts", "vice-probe.ts", "vice.ts"]` —
the three files legitimately allowed to reach the network directly. The
substring `"fetch ("` (the word "fetch", a space, then the eviction
parenthetical) in the comment above satisfies `\bfetch\s*\(` because `\s*`
allows the single space between "fetch" and "(". This makes `stock-registers.ts`
a fourth "offender," and the test now fails:

```
not ok 435 - structural: the set of source files under .claude/mcp/vice/ containing
a network-call construct is exactly broker-launch.mts, vice-probe.ts and vice.ts
  error: the network-call module set changed -- expected exactly
  ["broker-launch.mts", "vice-probe.ts", "vice.ts"], got
  ["broker-launch.mts","stock-registers.ts","vice-probe.ts","vice.ts"]
```

Verified reproducible: confirmed the substring exists only at this one line,
confirmed the pre-phase-15 baseline (`5710a3a^`) had no such substring in this
file, and confirmed by direct `node --test vice-proxy.test.ts` run that this
is the only failing test out of 472 in that file. `stock-registers.ts` does
not actually perform any network call — this is a false positive strictly
caused by comment wording — but the test is a hard CI gate (this very phase's
own `.github/workflows/ci.yml` comment states CI intentionally runs the full
`npm test` glob, specifically so `vice-proxy.test.ts`'s suite — including this
guard — executes on every merge). Left as-is, the next CI run on `main` reds.

**Fix:** Reword the comment so it no longer contains `fetch` immediately
followed by whitespace-then-`(`. For example, replace the phrase "A rejected
fetch (empty enumeration or a wire error) is evicted" with wording that
doesn't place a `(` right after "fetch", e.g.:

```ts
/** Evicts a REJECTED promise (empty enumeration, or a wire error) so a
 * failed fetch is retried by the next call
 */
```

Any rewording that removes the `fetch\s*\(` shape from the comment (and
from the two other comment lines earlier in the same file that use "fetch("-adjacent
phrasing, if any are found to match after the fix — re-run
`node --test vice-proxy.test.ts` to confirm) closes this without touching the
structural test itself.

## Warnings

### WR-01: README.md's manual-only file count is one behind test-gate.mjs's own array, in this same phase's diff

**File:** `.claude/mcp/vice/README.md:67`
**Issue:** This phase's diff touches this exact line, changing it from
"three" to "eight":

```
-`npm run test:automated` is the subset of `npm test` that excludes the three
+`npm run test:automated` is the subset of `npm test` that excludes the eight
 manual-only files (see `test-gate.mjs`'s own header).
```

But this same phase's `test-gate.mjs` diff (plan 15-10) adds
`stock-a4-checkpoint-flood.test.ts` as a NINTH entry to `MANUAL_ONLY_TESTS`,
and updates that file's own header comment ("the exact nine test files...")
and `test-gate.test.ts`'s assertion text ("MANUAL_ONLY_TESTS contains exactly
the nine dispositioned files") to match. `README.md`'s count was edited to
"eight" instead of "nine" in the same phase that made it nine — off by one
from the moment this diff lands. `test-gate.test.ts`'s own assertion is
correct and would not catch this, since it never reads README.md.
**Fix:** Update `README.md:67` to say "nine manual-only files" to match
`test-gate.mjs`'s `MANUAL_ONLY_TESTS` array (currently 9 entries) and
`test-gate.test.ts`'s assertion text.

### WR-02: the "three independent bounding techniques" for synthetic-tool-name discovery are not equivalent — two require `name:` to be the declaration's first field, one does not

**Files:**
- `scripts/generate-tool-support-table.mjs:141` (`declBody.match(/^[^{]*\{\s*name:\s*"([^"]+)"/)`)
- `.claude/mcp/vice/tool-support-table.test.mjs:104` (`declBody.match(/^\{\s*name:\s*"([^"]+)"/)`)
- `.claude/mcp/vice/capability-registry.test.ts:192` (`declBody.match(/name:\s*"([^"]+)"/)` — no `^` anchor)

**Issue:** All three sites carry near-identical header comments claiming they
are deliberately independent bounding techniques so "a bug in one bounding
technique is caught by the other two independent witnesses." In practice, the
generator and the `.mjs` test both require `name:` to be the very first key
inside the `ToolDefinition` object literal (anchored immediately after the
opening `{`), while `capability-registry.test.ts`'s version searches for
`name:\s*"..."` anywhere in the bounded declaration body. Today this is
latent — all three synthetic tool declarations in `vice-proxy.ts`
(`RESULT_CONTINUE_TOOL`, `RECYCLE_TOOL`, `DIAGNOSE_TOOL`) put `name:` first —
but the claimed "three independent, agreeing witnesses" property does not
actually hold: a future synthetic tool declaration that puts `name:` after
another field would make two of the three witnesses throw (loud failure,
not silently wrong data) while the third succeeds, which is not the
"independent confirmation" the comments describe.
**Fix:** Either anchor `capability-registry.test.ts`'s regex to also require
`name:` as the first field (`/^\{\s*name:\s*"([^"]+)"/`), matching the other
two witnesses' assumption, or relax the other two to search anywhere in the
bounded body and update all three header comments to state the actual shared
assumption (`name:` must be present in the declaration, not necessarily
first). Either fix keeps all three sites consistent with what they claim
about each other.

---

_Reviewed: 2026-08-22T18:29:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
