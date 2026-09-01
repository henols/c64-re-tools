---
phase: 27-shared-seams-extracted
reviewed: 2026-08-27T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - src/mcp/vice/acme-gate.test.ts
  - src/mcp/vice/acme-gate.ts
  - src/mcp/vice/block-class.test.ts
  - src/mcp/vice/block-class.ts
  - src/mcp/vice/comment-phase-pointers.test.ts
  - src/mcp/vice/disasm-roundtrip.test.ts
  - src/mcp/vice/docs-dangling-refs.test.ts
  - src/mcp/vice/hop-chain-comments.test.ts
  - src/mcp/vice/module-classification.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/prg-image.test.ts
  - src/mcp/vice/prg-image.ts
  - src/mcp/vice/absorbed-answer-key.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-coverage.test.ts
  - src/mcp/vice/anno-coverage.ts
  - src/mcp/vice/anno-d64.test.ts
  - src/mcp/vice/anno-d64.ts
  - src/mcp/vice/anno-mcp-client.test.ts
  - src/mcp/vice/anno-project.test.ts
  - src/mcp/vice/anno-project.ts
  - src/mcp/vice/spawn-seam.test.ts
  - src/mcp/vice/anno-symbol-roundtrip.test.ts
  - src/mcp/vice/anno-test-gate.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-verify.test.ts
  - src/mcp/vice/shipped-modules.test.ts
  - src/mcp/vice/shipped-modules.ts
  - src/mcp/vice/skill-acme-build-cli.test.ts
  - src/mcp/vice/stock-dispatch.test.ts
findings:
  critical: 1
  warning: 12
  info: 7
  total: 20
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-08-27
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 27 moved five shared seams out from under the `anno-` name prefix. I verified the
move itself is faithful: `acme-gate.ts`'s five symbols are byte-identical to the bodies
deleted from `anno-test-gate.ts`; `prg-image.ts`'s three functions are byte-identical
(only `decodeRawData`'s doc comment was reworded) and every one of the eight importers was
repointed; `blockClassAt` is semantically equivalent to the `storeBlockTypeAt` +
`classFromStore` + divergence-loop comparisons it replaced (including the `null`-covers-
nothing and unrecognised-spelling-is-data fallthroughs, and both inclusive range ends);
`shippedTsModules()` preserves the `.ts`/`.mts` filter and strengthens the existence check
from a soft `assert.ok` into a thrown named error. `tsc --noEmit` is clean and every test
file in scope is green on this host (anno-coverage 112/112, stock-dispatch 130/130,
module-classification/shipped-modules/acme-gate/block-class/prg-image 50/50).

The phase's real defect is in the one merged symbol the phase context flagged:
`codeOnly()`. Its `keepLiteralBodies` flag threads correctly through every literal branch
(I verified `codeOnly(src, true)` reconstructs source exactly, including nested templates
and escaped quotes, and that the default path is byte-for-byte the behaviour of the
`spawn-seam.test.ts` original). But the state machine has **no regular-expression-
literal handling**, and that is not theoretical here: a regex character class containing a
backtick or a quote desynchronises the scanner and silently swallows the remainder of the
file. Two currently-shipped modules trip it, so the tree's now-single shared stripper hands
its consuming guards a truncated view of ~1000 lines of real production code. That is
precisely the "a guard that scans nothing finds nothing" failure `shipped-modules.ts`'s own
header claims to have removed, and it is the reason this review is not clean.

Secondary theme: several of the new structural guards can pass while their scanned set
quietly shrinks (`block-class.test.ts`'s import-purity scan, the `let|var`-only mutability
scan), and `module-classification.ts` verifies only the line citations it carries as
structured data, not the eleven it carries in prose — while its own header calls that drift
liability "measured, not hypothetical."

## Critical Issues

### CR-01: `codeOnly()` has no regex-literal handling; a regex containing a backtick or quote silently truncates the scanned source

**File:** `src/mcp/vice/shipped-modules.ts:148-244` (specifically the quote branch at `:200-214` and the backtick branch at `:215-220`)

**Issue:** The character state machine treats `` ` ``, `"` and `'` as literal openers
wherever they appear outside a comment. It has no notion of a regular-expression literal,
so a `/` … `/` regex whose body contains one of those characters opens a phantom string or
template frame and the scanner never recovers.

Minimal reproduction (run against the shipped module):

```js
const src = 'const a = "SHOULD_BE_BLANKED";\nconst r = /[`*_]/g;\nfunction spawnHere() { spawnSync(ANNO_BIN, []); }\n';
codeOnly(src);
// => 'const a = ;\nconst r = /['
```

Everything after the regex — including a real `spawnSync(ANNO_BIN, …)` call — is gone from
the "code" the guards then match against.

This is live on the currently-scanned set (`shippedTsModules()`, 62 entries):

- `src/mcp/vice/anno-coverage.ts:1495` — `.replace(/[`*_]/g, "")`. Real code from roughly
  line 1532 onward becomes invisible: `computeCommentVacuity`, `computeReproducibility`,
  `COVERAGE_REPORT_KEYS` and `coverageFindings` are all absent from `codeOnly()`'s output
  even though they are `export function`/`export const` declarations. Strict output is
  1107 lines for a 2329-line file.
- `src/mcp/vice/incident-record.ts:107` — `` return `'${String(value).replace(/'/g, "''")}'`; ``
  (and again at `:395`). Real code from line 141 onward is invisible: `renderIncidentRecord`,
  `writeIncidentRecord` and `finaliseIncidentRecord` are all missing.

Consumer impact today: `spawn-seam.test.ts:180-188` scans exactly this `codeOnly()`
output for spawn-family call sites across the shipped set. Its set-equality test would
catch a *disappearing* expected site (the `missing` direction), but the `extra` direction —
"a third spawn site has appeared and must be added to the frozen set" — cannot see anything
added after `anno-coverage.ts:1495` or `incident-record.ts:107`. The guard-before-spawn
ordering check (`guardsBeforeEverySpawn`, comparing indices into the same truncated string)
is likewise computed over a partial file. The ANNO-01 invariant is therefore enforced over
a silently narrowed set, and `shippedTsModules()`'s hard-throw existence check — the thing
27-04 added to stop the scanned set shrinking — does not protect against this, because the
shrinkage happens inside the stripper rather than in the enumerator.

Provenance, stated honestly: the same flaw existed in the `spawn-seam.test.ts` copy
before this phase, and 27-04 moved it verbatim. It is reported as a blocker on this phase
because 27-04 is the commit that promoted this body to the tree's single authority, added
`shipped-modules.test.ts` as its committed proof, applied it to a fifth consumer
(`prg-image.test.ts`), and wrote a header asserting a correctness property it does not
hold (see WR-02).

**Fix:** Add a regex-literal branch to the top-level/interpolation arm, before the quote
and backtick branches. A `/` starts a regex only in expression position, so use the standard
previous-significant-token test; then consume `\…` escapes and `[...]` character classes
without interpreting quotes inside them.

```ts
// Track the last emitted significant character so `/` can be classified.
function regexAllowedAfter(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  return !/[A-Za-z0-9_$)\]}'"`]/.test(prev);
}

// ... inside the top-level / interpolation arm, BEFORE the `"`/`'` and backtick branches:
if (c === "/" && regexAllowedAfter(lastSignificant)) {
  const start = i;
  i++;                       // past the opening slash
  let inClass = false;
  while (i < n) {
    const d = src[i];
    if (d === "\\") { i += 2; continue; }
    if (d === "\n") break;    // not a regex after all -- bail without consuming
    if (d === "[") inClass = true;
    else if (d === "]") inClass = false;
    else if (d === "/" && !inClass) { i++; break; }
    i++;
  }
  while (i < n && /[dgimsuvy]/.test(src[i]!)) i++;   // flags
  out.push(src.slice(start, i));                    // a regex IS real code, both modes
  continue;
}
```

Then extend `shipped-modules.test.ts` with the WR-01 cases and re-run
`spawn-seam.test.ts` — its `EXPECTED_ANNO_SPAWN_SITES` set equality must still hold
in both directions once the two previously-truncated modules become fully visible.

## Warnings

### WR-01: `shipped-modules.test.ts` certifies `codeOnly()` with no regex-literal case at all

**File:** `src/mcp/vice/shipped-modules.test.ts:85-132`

**Issue:** The three `codeOnly()` tests cover single quotes, double quotes, template
literals with interpolation, `//`, same-line `/* */`, multi-line `/* */`, a genuine call,
and the `keepLiteralBodies = true` import-specifier path. None of them contains a `/`
regex literal, which is why CR-01 shipped green. The `keepLiteralBodies = true` path is
also only exercised on one double-quoted specifier — never on a template literal, a
single-quoted string, an escaped quote, or a nested template, even though those are the
branches the flag threads through.

**Fix:** Add cases pinning the CR-01 shapes and the flag's remaining branches:

```ts
test("codeOnly(): a regex literal containing a backtick or a quote does not swallow the code after it", () => {
  const src = 'const r = /[`*_]/g;\nspawnSync(ANNO_BIN, []);\nconst s = "HIDDEN";\n';
  const code = codeOnly(src);
  assert.match(code, /spawnSync\(ANNO_BIN/, "code after a regex literal must stay visible");
  assert.equal(/HIDDEN/.test(code), false, "and the real string literal must still be blanked");
  assert.match(codeOnly("const r = /'/; spawnSync(ANNO_BIN, []);"), /spawnSync\(ANNO_BIN/);
});

test("codeOnly(keepLiteralBodies = true) reconstructs every literal shape exactly", () => {
  for (const src of [
    'const d = `a ${f("x")} b`;',
    'const d = `a ${`inner ${g()}`} b`;',
    'const s = "a\\"b";',
    "const s = 'a\\'b';",
  ]) {
    assert.equal(codeOnly(src, true), src, `keepLiteralBodies must be lossless for ${src}`);
  }
});
```

### WR-02: `shipped-modules.ts`'s header states a correctness property the function does not have

**File:** `src/mcp/vice/shipped-modules.ts:22-29` and `:132-147`

**Issue:** The header justifies the move on the grounds that this is "the only
implementation in this tree that correctly blanks TEMPLATE-LITERAL bodies — logic that was
measured into existence after a regex extractor was observed to MISS a real violation
sitting inside a template literal." Measured against the tree it actually scans, this
implementation *also* misses real code, for a different reason (CR-01), and does so on two
shipped modules. In a codebase whose convention is that headers state measured facts, an
unqualified correctness claim in the seam header is the thing that stops the next reader
looking.

**Fix:** Once CR-01 is fixed, keep the claim and add the regex-literal branch to the list
of shapes it handles. Until then, replace the claim with the measurement:
"handles comments, all three literal shapes and nested interpolation; regular-expression
literals are NOT tokenised, and a regex body containing a quote or a backtick truncates the
scan — see `shipped-modules.test.ts`'s regex cases."

### WR-03: `block-class.test.ts`'s import-purity guard cannot see three real import shapes

**File:** `src/mcp/vice/block-class.test.ts:120-155` (extraction at `:131-135`)

**Issue:** The specifier extractor is `line => /\bfrom\s+"/.test(line)` followed by
`line.match(/from\s+"([^"]+)"/)`. That sees only single-line, double-quoted, `from`-bearing
imports. Every one of the following would be invisible, and both the family loop and the
`assert.deepEqual(specifiers, [])` emptiness assertion would pass:

```ts
import "./anno-coverage.ts";                      // bare side-effect import, no `from`
import { x } from './anno-coverage.ts';           // single-quoted specifier
const m = await import("./anno-coverage.ts");     // dynamic import
```

This is the load-bearing test of the file, per its own header: trap 1 in `block-class.ts`
says an extra input collapses the bytes-versus-store independence axis *quietly*. A guard
whose scanned set can shrink to nothing while staying green is the same failure class as
CR-01.

**Fix:** Match specifiers in any quote style, and add a positive prohibition on the two
shapes that carry no `from`:

```ts
const specifiers = [...codeOnly(source, true).matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)]
  .map((m) => m[1] ?? m[2] ?? m[3])
  .filter((s): s is string => s !== undefined);
assert.equal(/\bimport\s*\(/.test(codeOnly(source)), false, "no dynamic import either");
```

(`codeOnly` from `shipped-modules.ts` is already the tree's shared stripper for exactly this
job; using it here also removes the fourth hand-rolled comment filter at `:126-129`.)

### WR-04: `block-class.test.ts`'s mutable-state guard only greps `let`/`var`, so `const` collection state passes

**File:** `src/mcp/vice/block-class.test.ts:157-161`

**Issue:** Trap 3 in `block-class.ts` forbids *module-level mutable state*. The test checks
`/^\s*(let|var)\s/`. A memoising cache — `const seen = new Map<number, BlockClass>();` — is
module-level mutable state, is exactly the shape someone would add to a linear scan, and
passes this assertion untouched. The test's title over-promises what it checks.

**Fix:** Also reject module-level `const` bindings initialised to a mutable container, or
narrow the test's title to what it actually asserts:

```ts
const offenders = source.split("\n").filter((line) =>
  /^\s*(let|var)\s/.test(line) || /^\s*const\s+\w+\s*(:[^=]*)?=\s*(new (Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
);
```

### WR-05: `existsSync` is now an unused import in `stock-dispatch.test.ts`

**File:** `src/mcp/vice/stock-dispatch.test.ts:9`

**Issue:** `cf6d624` deleted the file's local `shippedTsModules()`, which held the only
`existsSync` call in the file. `existsSync` remains in the `node:fs` import list with zero
remaining uses. `tsconfig.json` sets no `noUnusedLocals`, so nothing catches it.

**Fix:**

```ts
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, realpathSync } from "node:fs";
```

### WR-06: `module-classification.ts` verifies its structured line citations but not the eleven it carries in prose

**File:** `src/mcp/vice/module-classification.ts:109`, `:113`, `:115-116`, `:118`, `:135`,
`:328`, `:352`, `:392`, `:491`, `:507`; guard at `src/mcp/vice/module-classification.test.ts:209-229`

**Issue:** Direction 9 walks `entry.basis.consumers[].line` only. The file additionally
cites eleven `path:line` locations in its own header and in `note` fields
(`anno-launch.ts:251`, `anno-cli.ts:330`, `anno-tools.ts:972`, `anno-tools.ts:1121`,
`anno-session.ts:294`, `anno-coverage.ts:1392` (twice), `anno-verify.ts:116`,
`anno-cli.ts:91` and `:631`, `c64-program-recon/SKILL.md:274` and `:250`,
`c64-memory-mapping/SKILL.md:195`). I checked all of them by hand and every one is
currently correct — so this is a latent defect, not a present one. But the file's own
header says the drift liability is "MEASURED, NOT HYPOTHETICAL" and that three citations
had already drifted while it was being written, and the header itself is the part with no
gate. Line references in prose in this repo already have a mechanical checker
(`docs-linerefs.test.ts`); these are outside it.

**Fix:** Either extend the enforcing test to scan this module's own source for
`` `path:NN` `` shaped citations and apply the same containment check, or move the eleven
prose citations into the structured `consumers[]`/`extractables` data that Direction 9
already covers. If neither, delete the line numbers from the prose and cite symbols only —
an unverifiable line number is worse than no line number in a record written to be trusted
under deletion pressure.

### WR-07: the `.d64` composition test degrades a broken checkout into a green SKIP, and its dynamic import removes `tsc` from the boundary the phase most needed verified

**File:** `src/mcp/vice/anno-d64.test.ts:359-364` (skip gate) and `:369-383` (dynamic import)

**Issue:** Two problems in the same test, both introduced by 27-03's rewrite of this block:

1. `SKIP_REASON` is still a skip. The comment above it now says prg-image.ts "exists on
   disk in every checkout, so this test is not expected to skip" and "the module ships in
   package.json's files[]" — i.e. the condition can now only be false when something is
   genuinely wrong. Under that premise the correct response is a hard failure, not a named
   skip; a skip reports green. This is the same degradation `acme-gate.ts:61-63` and
   `anno-test-gate.ts` both name as the failure mode their whole design exists to prevent.
2. The dynamic `import(pathToFileURL(PRG_IMAGE_PATH).href)` plus
   `as { parsePrg: (bytes: Uint8Array) => { origin: number; body: Uint8Array } }` means
   `tsc --noEmit` never checks that `prg-image.ts` exports `parsePrg` with that signature.
   The comment concedes the original worktree rationale "has lapsed" and keeps the pattern
   "because it is harmless" — but in a phase whose central risk is a moved symbol whose
   importers were not all repointed, this is the one composition site that deliberately
   opts out of static verification.

**Fix:** Replace the probe with an assertion and the dynamic import with a static one:

```ts
import { parsePrg } from "./prg-image.ts";

test("composition: extracted bytes feed parsePrg(), and the recovered origin matches the fixture's load address", () => {
  const { origin, body } = parsePrg(extractEntry(twoEntryImage(), "GAME"));
  assert.equal(origin, 0x0801, "the fixture's load address ($0801) must be recovered exactly");
  ...
});
```

### WR-08: two new assertions pin a fixture-derived absolute count, with no message

**File:** `src/mcp/vice/anno-coverage.test.ts:627` and `:729`

**Issue:** `assert.equal(before.divergence.censusCodeStoreNotCode, 0);` is a bare equality
on an absolute byte count derived from the `WELL_DOCUMENTED` fixture, and it is the *only*
assertion in either of the two new substitutability tests with no explanatory message. It
is the baseline half of a relation ("0 before, >0 after"), so a legitimate fixture or census
change that gives the baseline a non-zero divergence reddens both tests with no diagnostic —
the pinned-total failure mode this repo has already been bitten by and which
`module-classification.test.ts:237-248` goes out of its way to argue against for its own
non-vacuity threshold.

**Fix:** Express it as the relation it is, and say so:

```ts
assert.ok(
  after.divergence.censusCodeStoreNotCode > before.divergence.censusCodeStoreNotCode,
  "the divergence sub-report did not move at all -- if a vocabulary substitution cannot move it, " +
    "the substitutability assertions above are vacuous",
);
```

### WR-09: the block-literal SUPPLEMENT scans raw source, so a comment quoting the store's spelling reddens it

**File:** `src/mcp/vice/anno-coverage.test.ts:799-812`

**Issue:** The supplement reads `anno-coverage.ts` with `readFileSync` and asserts the raw
text contains none of `"Code"`, `"Undefined"`, `"Byte"`, `"Address"`. Comments are not
stripped, so a future header paragraph that legitimately discusses the store's `"Code"`
spelling — exactly the kind of paragraph this phase's own modules are full of — turns the
test red for a reason unrelated to the invariant. `shipped-modules.ts`'s `codeOnly()` exists
in this directory for precisely this, and is already imported by four other guards.

**Fix:** `const source = codeOnly(readFileSync(join(HERE, "anno-coverage.ts"), "utf8"), true);`
— `keepLiteralBodies: true` is the right mode here, since the thing being searched for *is*
a string literal.

### WR-10: `anno-test-gate.ts`'s "capability" verdict is internally tense and is not marked contested

**File:** `src/mcp/vice/module-classification.ts:458-479`

**Issue:** The entry's own `note` records that "Ten importers remain, all inside the
analyser family" (I verified: exactly ten `*.test.ts` files, every one `anno-*`), and that
the reusable half of its discipline left for `acme-gate.ts` in this same phase. So the
record marks as a surviving capability a module whose every consumer dies with the
substrate and whose substrate-independent half has already been extracted under a different
name. That may still be the right call — the *discipline* is reusable — but it is the same
shape of tension the `anno-verify.ts` entry explicitly flags as `CONTESTED`, and here it is
not flagged. The record's whole purpose is to be trusted by a later reader driving a
deletion; an unflagged tense verdict is how a later phase keeps dead code (the inverse of
the failure SEAM-02 targets, but still a failure the record exists to prevent).

**Fix:** Add a `CONTESTED`-style paragraph to the note, in the shape `anno-verify.ts`
already uses: state that what survives is the discipline (now also embodied in
`acme-gate.ts`), that all ten measured importers are inside the family, and what a later
reader should therefore actually carry forward.

### WR-11: `acme-gate.test.ts` spawns four child processes while its header states three, because one probe runs twice

**File:** `src/mcp/vice/acme-gate.test.ts:36-41` (the stated cost) and `:126-145` (two tests, two `runGateProbe(true)` calls)

**Issue:** The header's "COST, STATED RATHER THAN SMUGGLED: three child processes per suite
run" is wrong: `runGateProbe(true)` is called once at `:127` and again at `:138`, so the
file spawns four children (two identical FAIL runs, one control, one `-e` one-liner) plus a
`mkdtemp`/`rm` cycle for each. On a host where `/tmp` is RAM-backed this also doubles the
temp-directory churn for no added observation — the two assertions are made against
independent runs of the same fixed input.

**Fix:** Run the probe once and assert both properties against that single result:

```ts
const failRun = runGateProbe(true);
test("VICE_REQUIRE_ACME=1 with a nonexistent ACME_BIN makes a child run FAIL ...", () => {
  assert.notEqual(failRun.status, 0, ...);
});
test("that same failing child run names the gate's OWN refusal wording ...", () => {
  assert.ok(failRun.output.includes(REFUSAL_PREFIX), ...);
});
```

and correct the header's count.

### WR-12: "PRODUCTION MUST NOT PASS THIS" is the one invariant in this phase with no mechanical gate

**File:** `src/mcp/vice/anno-coverage.ts:2081-2098`

**Issue:** `CoverageOptions.blockClassifier` is documented in capitals as a test-only seam
that production must never supply, on the stated ground that a second production classifier
is a second answer to "what class is this address" — the exact hazard `block-class.ts`
exists to close. Every other invariant this phase introduced got a committed guard
(`files[]` presence/absence, import purity, name-as-justification, the third verdict's
extractables, disk completeness in both directions). This one got a comment. I confirmed the
only caller supplying it today is `anno-coverage.test.ts`, so nothing is broken — but the
prohibition is unenforced.

**Fix:** Add a one-line structural assertion beside the existing supplement, using the
enumerator and stripper this phase just extracted:

```ts
test("no shipped module passes CoverageOptions.blockClassifier", () => {
  for (const m of shippedTsModules()) {
    if (m === "anno-coverage.ts") continue;   // the declaration site
    assert.equal(/\bblockClassifier\s*:/.test(codeOnly(readFileSync(join(HERE, m), "utf8"))), false, `${m} injects a classifier`);
  }
});
```

## Info

### IN-01: `codeOnly()` declares two loop-local flags at function scope

**File:** `src/mcp/vice/shipped-modules.ts:152-153`, reassigned at `:159-160`

**Issue:** `inTemplateText` and `inInterp` are recomputed from `templateStack` on every
iteration and carry no state across iterations, so their function-scope `let` declarations
and `= false` initialisers are dead. (The original copy also carried a genuinely unused
`let interpBraceDepth = 0;` — correctly dropped in the merge.)

**Fix:** Declare both inside the `while` body as `const`.

### IN-02: `SPAWN_CALL_RE`'s doc comment describes behaviour `codeOnly()` does not have and names a function that does not exist

**File:** `src/mcp/vice/spawn-seam.test.ts:81-88`

**Issue:** It states that a string-literal first argument "surfaces here as an empty pair of
quote characters" — `codeOnly()` removes the quotes entirely, leaving `spawnSync(, …)` — and
attributes the handling to `isAnnoBinaryExpression()`, which does not exist (the real
predicate is `isAnnoSpawnCall()` at `:132`). The guard's *behaviour* is still correct: with
the quotes gone the regex's identifier group cannot match, which is the intended outcome.
Both inaccuracies predate this phase, but 27-04 rewrote the surrounding comment block
without correcting them.

**Fix:** Say "contributes nothing at all, so the identifier group cannot match", and name
`isAnnoSpawnCall()`.

### IN-03: a relocated assertion's regex matcher is satisfied by the wrong number

**File:** `src/mcp/vice/prg-image.test.ts:62-65`

**Issue:** `assert.throws(() => flatImageOrigin(Buffer.alloc(0)), /0/)` — `flatImageOrigin`'s
message always contains the constant `65536`, so `/0/` matches regardless of the observed
length. The zero-length case is not actually pinned to naming `0`. Relocated verbatim by
design (27-03's stated rule), so this is a re-committed pre-existing weakness rather than a
regression.

**Fix:** `/is 0 byte\(s\)/`, and correspondingly `/is 65535 byte\(s\)/` on the line above.

### IN-04: `blockClassAt` throws on a non-array `blocks`, which its own doc-comment premise argues against

**File:** `src/mcp/vice/block-class.ts:120-130`

**Issue:** The doc comment justifies skipping `null`/`undefined` holes on the ground that
"the listing arrives from a project file this process did not author", but `for (const block
of blocks)` throws `TypeError` if `blocks` itself is not iterable. Both production callers
pre-guard (`anno-coverage.ts:1860` and `:1991` both do `Array.isArray(blocks) ? blocks : []`),
so nothing is reachable today — but the defence is asymmetric and the pre-guard now lives
outside the module that documents the premise.

**Fix:** `if (!Array.isArray(blocks)) return null;` at the top, or move the note about the
caller-side guard into this doc comment so the split is deliberate rather than incidental.

### IN-05: `shipped-modules.ts` calls the four prior enumerator copies "byte-identical"; they were not

**File:** `src/mcp/vice/shipped-modules.ts:7-12`

**Issue:** All four deleted copies used `assert.ok(existsSync(...), …)` — a soft assertion
taking the caller's assert library — whereas the extracted version throws its own
`ShippedFilesEntryMissingError`. That change is an improvement (the header at `:113-114`
argues for it correctly: "no call site can opt out of the check by forgetting an argument"),
but it means the four origins were neither byte-identical to each other nor to the
extraction, and the header describes the move as if nothing changed.

**Fix:** Say "four hand copies with identical filter logic" and note the deliberate
assert-to-throw upgrade, which the header already justifies further down.

### IN-06: formatting artefacts left by the deletions

**File:** `src/mcp/vice/comment-phase-pointers.test.ts:399-401` (double blank line where the
function was removed); `src/mcp/vice/spawn-seam.test.ts:24-26` (a sentence broken
mid-clause: "…so neither is a special case. Within that derived set, / this file / finds
every call to a spawn-family function…")

**Issue:** Cosmetic residue of the extraction; the second one makes a header paragraph read
as truncated.

**Fix:** Re-flow the paragraph and drop the duplicate blank line.

### IN-07: pre-existing unused import moved by this phase

**File:** `src/mcp/vice/anno-verify.test.ts:40`

**Issue:** `ANNO_BIN` has been imported and unused in this file since phase 11 (`1271e06`).
This phase shifted the line by one when it split the `prg-image.ts` import out, and
`module-classification.ts:463` now cites this exact line number as a consumer citation (for
`skipReasonFor`, which *is* used, so the citation is valid). Flagged only so the dead
binding is not mistaken for something this phase introduced.

**Fix:** Drop `ANNO_BIN` from the import list — but do so in a change that also re-checks
`module-classification.ts:463`'s line citation, since Direction 9 verifies it.

---

_Reviewed: 2026-08-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
