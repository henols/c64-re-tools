---
phase: 49-the-reassembly-gate-committed-before-the-phase-it-gates
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/mcp/vice/acme-verify.ts
  - src/mcp/vice/acme-verify.test.ts
  - src/mcp/vice/acme-seam.test.ts
  - src/mcp/vice/reassembly-gate.ts
  - src/mcp/vice/reassembly-gate.test.ts
  - src/mcp/vice/reassembly-gate-ack.ts
  - src/mcp/vice/reassembly-gate-ack.test.ts
  - src/mcp/vice/reassembly-gate-movement.ts
  - src/mcp/vice/reassembly-gate-movement.test.ts
  - src/mcp/vice/reassembly-gate-movement-subject.ts
  - src/mcp/vice/reassembly-gate-run.test.ts
  - docs/phase49-the-reassembly-gate-findings.md
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 49: Code Review Report

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The reassembly gate's core invariants hold up under adversarial reading: there
is genuinely one child-process launch site for the assembler
(`acme-verify.ts`'s `assembleAndDiff()`), one function body that produces an
`AcmeOutcome`, the byte-diff is the only basis for `"ok"`/`"failed"`, the exit
status and the aggregate `Saving ...` line are recorded but never consulted,
`"skipped"` is unreachable as a pass, a zero-length expected-bytes buffer and
a zero-length diff extent are refused before any comparison, and movement is
mandatory (a `null`/zero-delta movement input derives to `"refused"`, which
`R5` sends to red before any byte rule runs). The gate's own rule table
(`R1`..`R12`) is a genuine first-match-wins ladder and the only way to reach
`green` is both rebuilds `"ok"`, both structural guards `held`, all controls
`all-observed`, complete diff-scope coverage, and a clean hazard disposition
— traced by hand against the code, not just against the tests that already
assert it.

That said, this phase's own new code introduces a documented-policy
violation (planning-vocabulary citations inside `src/mcp/vice/*.ts`), and the
review found several real gaps in the "no second path" guarantees the
domain explicitly cares about: a scan blind spot in the newly-added
`acme-seam.test.ts`, an unguarded scope-shift in the movement transform, two
places where the movement transform silently no-ops instead of refusing on
an out-of-bounds site, and an inconsistent "never ships" guard across the
gate's own test-only modules.

## Critical Issues

### CR-01: This phase's own new code introduces planning-vocabulary citations into `src/mcp/vice/*.ts`

**File:** `src/mcp/vice/acme-verify.ts:413`, `src/mcp/vice/acme-verify.test.ts:811`

**Issue:** Project `CLAUDE.md` states, without carving out test-only files:
"Planning vocabulary stays inside `.planning/`" and lists as forbidden "no
phase/plan number, no bare `D-NN`/`G-NN-N` id ... in any product file",
because `src/mcp/vice/*.ts` ships verbatim to npm and a consumer reading it
has no planning tree to resolve a citation against. `git diff
84d2824b..HEAD` shows this phase's own commits (`f681e76a`, `49-02`/`49-03`)
adding two brand-new citations that this rule forbids, not carried over from
an earlier phase:

- `acme-verify.ts:413` — `"TEST-ONLY seam (plan 49-03). A caller may supply
  its own directory for ..."` (a bare `plan NN-NN` citation).
- `acme-verify.test.ts:811` — `"...then `unscoped.a` LAST regardless of
  address (D47-D) -- and this subject..."` (a bare `D-NN`-shaped id with no
  document named, exactly the shape the same `CLAUDE.md` section calls out
  as resolving nowhere for a consumer).

Both citations resolve only inside `.planning/`, which neither file's own
reader (a contributor reading the shipped-adjacent source, or a maintainer
years from now) has. `acme-verify.ts` and `acme-verify.test.ts` are
test-only and both are independently asserted absent from
`package.json`'s `files[]` in this same review's file set, so this is not a
runtime defect and not an npm-tarball leak — but it is a direct, freshly
introduced violation of the rule as written, which draws no such
carve-out, and the file the mechanical guard for this rule
(`skills-planning-vocabulary.test.ts`) actually covers is `src/skills/**`,
not `src/mcp/vice/**` — so nothing in CI currently catches this class of
regression in this tree at all.

**Fix:**
```diff
- * TEST-ONLY seam (plan 49-03). A caller may supply its own directory for
+ * TEST-ONLY seam. A caller may supply its own directory for
```
```diff
- * start, then `unscoped.a` LAST regardless of address (D47-D) -- and this
+ * start, then `unscoped.a` LAST regardless of address -- and this
```
State the reason in words (as the surrounding prose in both files already
does at length) rather than by citing a decision id that only resolves
inside `.planning/`.

## Warnings

### WR-01: `acme-seam.test.ts`'s spawn-site scan is blind to a property-access first argument

**File:** `src/mcp/vice/acme-seam.test.ts:92-97, 138-149`

**Issue:** `ARGV_CALL_RE` only captures a bare identifier
(`[A-Za-z_$][A-Za-z0-9_$]*`) as the first argument to
`spawnSync`/`spawn`/`execFileSync`/`execFile`. A call written as
`spawnSync(options.acmeBin, argv, ...)` or `spawnSync(this.acmeBin, ...)`
captures only `options`/`this` before the `.`, and `identNamesAssembler()`
then checks whether *that* identifier was declared or received as a
parameter from an expression mentioning `ACME_BIN`/`acmeBin`/`assemblerBin`/
`acmePath` — which `options` or `this` never is. Such a call would silently
fail to register as an assembler spawn site, so a second, unaudited launch
of the assembler written in this shape would never surface in
`ACME_SPAWN_SITES`'s frozen set — exactly the "second launch site appearing
somewhere nobody was looking" scenario this file's own header says it
exists to catch. (`host-tool.mts` is already declared as a similar blind
spot via `NAME_SCAN_BLIND_MEMBERS`, which shows the authors know this class
of miss exists, but a *new* module written this way anywhere else in the
tree gets no such declared exemption — it just goes undetected.)

**Fix:** Extend `ARGV_CALL_RE` (or add a second pass) to also capture a
member-expression first argument (`\b(\w+(?:\.\w+)+)`) and feed the
right-most segment through `identNamesAssembler()`, or explicitly widen
`ASSEMBLER_BIN_SHAPE`/`ASSEMBLER_BIN_SUBSTRING` to match on the full
dotted path text rather than only a standalone identifier.

### WR-02: `relocateSubject()` shifts an entire scope by `delta` without checking the scope's extent matches the moved range's own extent

**File:** `src/mcp/vice/reassembly-gate-movement.ts:274-284`

**Issue:**
```ts
const scopeIndex = scopeRows.findIndex((scope) => scope.start <= originalAddress && originalAddress <= scope.endInclusive);
const movedScope = scopeIndex === -1 ? undefined : { start: scopeRows[scopeIndex]!.start + delta, endInclusive: scopeRows[scopeIndex]!.endInclusive + delta };
```
The scope containing the moved symbol's address is relocated by the whole
`delta`, unconditionally. Every other refusal in this file is stated as "a
dishonest request is refused BY NAME, before any row is shifted" (empty
sites, wrong symbol, stale site value, colliding ranges) — but nothing here
checks that the scope's own extent equals the moved range's extent. If a
scope wraps more than one range (a legitimate `StoreExportDocument` shape;
the shipped fixtures in this phase only ever exercise a 1:1 range:scope
pairing), relocating one range inside it would still shift the *whole*
scope by `delta`, silently leaving the scope's new boundary
mis-aligned with its own unmoved sibling ranges — a document inconsistency
this module's own stated design ("every dishonest request is refused")
would otherwise catch, but does not, for this specific shape.

**Fix:** Before shifting the scope, assert
`scopeRows[scopeIndex]!.start === originalRange.start && scopeRows[scopeIndex]!.endInclusive === originalRange.endInclusive`
(i.e. the scope wraps *only* the range being moved), and throw a named
refusal otherwise, on the same terms as the collision check a few lines
above it.

### WR-03: Reference-site reads and writes silently no-op out of bounds instead of refusing

**File:** `src/mcp/vice/reassembly-gate-movement.ts:142-150, 155-166`

**Issue:** `readSiteValue()` uses `image[offset] ?? 0` — if `offset` is
negative or beyond the buffer (a site address outside `image`'s covered
range, or, for a two-byte site, a high-octet offset that runs one byte past
the end), a genuinely out-of-bounds read is indistinguishable from a
legitimately-zero byte. That means the "declared site currently holds the
symbol's original address" check a few lines below (rule stated at
lines 228-241) can pass by coincidence for a mis-declared, out-of-range
site whose expected value happens to be `0`, instead of being refused as
the module's own doc comment says every stale/wrong site declaration must
be. Symmetrically, `writeSiteValue()` assigns directly into the
`Uint8Array` (`buffer[offset] = ...`); an out-of-bounds assignment on a
typed array is a silent no-op in JavaScript, so a site whose *patched*
address (`site.address` shifted by `delta` when inside the moved range)
falls outside the rebuilt image's new bounds is silently left unpatched,
with no error and no test able to observe the failure to write.

**Fix:** Bounds-check `offset` (and, for `twoByteLittleEndian`, `offset + 1`)
against `image.length` in both helpers and throw a named error
(`relocateSubject: declared site $XXXX (encoding ...) lies outside the
image it is declared against`) rather than silently reading/writing past
the end.

### WR-04: The "must never ship" guard is inconsistent across the gate's own test-only modules

**File:** `src/mcp/vice/reassembly-gate-ack.ts`, `src/mcp/vice/reassembly-gate-movement.ts`, `src/mcp/vice/reassembly-gate-movement-subject.ts`

**Issue:** `acme-verify.ts`/`acme-verify.test.ts` and
`reassembly-gate.ts`/`reassembly-gate.test.ts` each carry a mechanical test
asserting the module is absent from `package.json`'s `files[]`
(`acme-verify.test.ts:2083-2103`, `reassembly-gate.test.ts:550-555`). No
equivalent assertion exists for `reassembly-gate-ack.ts`,
`reassembly-gate-movement.ts`, or `reassembly-gate-movement-subject.ts`
(checked: neither `reassembly-gate-ack.test.ts` nor
`reassembly-gate-movement.test.ts` contains any `files.includes(...)`
assertion), and `scripts/check-npm-packages.mjs`'s generic leak checks only
name a specific `test-corpus.mjs` pattern, not this family of modules. Today
none of the three appear in `files[]`, so there is no live leak — but
nothing would go red in CI if one of them were added to the published
tarball tomorrow, unlike its two sibling test-only oracle modules.

**Fix:** Add the same absence assertion pattern
(`pkg.files.includes("reassembly-gate-ack.ts") === false`, etc.) to
`reassembly-gate-ack.test.ts` and `reassembly-gate-movement.test.ts`, mirroring
`reassembly-gate.test.ts:550-555`.

## Info

### IN-01: The hazard-acknowledgement key relies on an unenforced "no `::` in the value" invariant

**File:** `src/mcp/vice/reassembly-gate-ack.ts:129-157`

**Issue:** `hazardFindingKey()`/`undecidedRegionKey()` join `hazardClass`,
`anchorAddress` and `mechanism` with the separator `"::"`, and the code
comment justifies safety by asserting `mechanism` is "always a
lowercase-hyphenated identifier" that never contains `::` — an invariant
this module does not itself validate. A `mechanism` string that ever did
contain `"::"` could produce a key collision between two distinct findings
(e.g. `class::1::a::b` vs. a hypothetical `class::1::a` finding whose
mechanism is literally `"a::b"` disambiguated only by field boundaries that
no longer line up).

**Fix:** Either validate `mechanism` against a narrow pattern
(`/^[a-z][a-z0-9-]*$/`) at the key-building boundary, or use an
unambiguous encoding (e.g. `JSON.stringify([hazardClass, anchorAddress,
mechanism])`) instead of string concatenation with a separator whose
absence is merely asserted in a comment.

---

_Reviewed: 2026-09-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
