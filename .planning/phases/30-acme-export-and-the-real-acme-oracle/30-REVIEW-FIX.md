---
phase: 30-acme-export-and-the-real-acme-oracle
fixed_at: 2026-08-31T00:00:00Z
review_path: .planning/phases/30-acme-export-and-the-real-acme-oracle/30-REVIEW.md
iteration: 1
findings_in_scope: 18
fixed: 18
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** `.planning/phases/30-acme-export-and-the-real-acme-oracle/30-REVIEW.md`
**Iteration:** 1
**Scope:** `all` (Critical + Warning + Info)

**Summary:**
- Findings in scope: 18 (3 critical, 11 warning, 4 info)
- Fixed: 18
- Skipped: 0

## Verification

**Where the gates ran:** the MAIN working tree at `/home/henrik/dev/henrik/git/c64-re-tools`,
branch `main`. No worktree was created — the orchestrator dispatched this run against the main
checkout with no sibling agents, so every number below is reproducible from the tree you are
reading. This matters because a worktree-environment run is *not* reproducible from the main
checkout after teardown.

**Commands, all green at the end of the run:**

- `cd src/mcp/vice && npx tsc --noEmit` → clean.
- `cd src/mcp/vice && npm run test:automated` → `# tests 2918 / # pass 2916 / # fail 0`
  once this file exists. It read `# fail 2` immediately before this file was written, and both
  failures were the two disposition guards this file discharges
  (`docs-review-disposition.test.ts` and its cascade `audit-integrity.test.ts`); every other
  test was green from the last fix commit onward.
- `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm run test:automated` with real ACME 0.97 "Zem" at
  `/home/henrik/.local/bin/acme` → the ACME-gated suites (`anno-export-asm.test.ts` 80 tests,
  `acme-verify.test.ts` 39 tests) all pass with the oracle actually running, not skipped.

**Reproduction discipline.** CR-01, CR-02 and CR-03 each had a live reproduction recorded in
REVIEW.md. Every one was reproduced against the committed code *before* the fix and confirmed
no longer to fire *after*. WR-04 went further and is described below. Four guards were
additionally proven to bite by temporarily reverting the fix under them (WR-04, WR-05, WR-09,
WR-11) — a fix asserted from reading alone is not evidence in this tree.

## Fixed Issues

### CR-01: `anno <Object.prototype key>` crashes the CLI with an unhandled `TypeError`

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `b30bd82`

Reproduced first: `runR2000Cli(["hasOwnProperty","game.prg","--force"])` threw
`TypeError: accepted.includes is not a function` and escaped the function entirely, breaking
the never-throw contract stated in the file's own header *and* in `checkAcceptedOptions()`'s
own JSDoc.

`VERB_OPTIONS[verb]` now reads through `Object.hasOwn`, matching the `own()` helper the sibling
checker (`scripts/lib/anno-cli-invocations.mjs`) already uses for the same defect found in this
same phase. `Array.isArray()` rather than a bare truthiness test, so an own key whose value is
somehow not an array also falls through to "unknown verb" rather than reaching `.includes()`.

The pre-dispatch call also moved *inside* `runR2000Cli()`'s `try` — defence in depth, as the
reviewer framed it, not the fix. The contract should not depend on one callee staying careful.

Controls: eight inherited keys (the five reproduced plus `isPrototypeOf`,
`propertyIsEnumerable`, `toLocaleString`), each asserted to return exit 1 with the unknown-verb
message rather than throw, plus a direct predicate test with a paired positive control so a
`checkAcceptedOptions()` that returned `undefined` unconditionally fails.

**After:** all eight keys return exit 1. Nothing throws.

### CR-02: an enum bound to an unexpressible immediate opcode is substituted into a comment

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `4751357`

The highest-value fix in the set, and a live inversion of the phase's own invariant 3.

Reproduced first, exactly as REVIEW.md recorded: a store with one `code` range `$0801..$0803`
over `eb 00 60` and `viccolor { $00: BLACK }` applied at `$0801` through the ordinary public
`applyEnumUsage()` route produced

```
        !byte $eb, $00  ; sbc #viccolor_BLACK  [illegal opcode | not expressible in ACME !cpu 6510]
=== enumSubstitutionCount: 1
```

— the enum symbol in the *comment*, the operand still a raw byte, an unreferenced
`viccolor_BLACK = $00` in the header, the usage counted as applied, exit 0.

Two changes:

1. The enum path now gates on `instr.acmeExpressible` as well as `role`, and refuses by name.
   `decode()` assigns `role: "immediate"` from the addressing mode alone, independently of
   expressibility, which is why the role gate passed.
2. `substituteImmediateEnum()` now searches only the assembler-visible half of the line
   (`line.split("  ; ")[0]`), so the same class of mistake cannot recur through another route.
   This made the confinement unreachable via `exportAsm()`, so the function is exported for
   test reach on the same terms as `assertExportableCommentText()`.

Controls cover **all six** affected opcodes — `$2b` (`anc`), `$82`/`$89`/`$c2`/`$e2`
(`nop #imm`), `$eb` (`sbc #imm`) — not just the one reproduced first, plus a precondition
derived from the real opcode table that fails by name if a seventh ever appears.

**Why the byte-diff oracle could not have caught this:** the bytes stay correct. A round-trip
test goes green on it. That is why the controls assert the *refusal*, not the bytes.

**After:** the reproduction now refuses:
`exportAsm: enum "viccolor" is bound to the immediate operand at $0801, but that opcode ($eb,
sbc) is NOT EXPRESSIBLE in ACME's !cpu 6510 dialect ... REFUSED rather than counted as applied.`

### CR-03: a crashed or timed-out ACME is reported as `"skipped"` — "ACME never ran"

**Files modified:** `src/mcp/vice/acme-verify.ts`, `src/mcp/vice/acme-verify.test.ts`
**Commit:** `53888b1`

Reproduced first: `classifySpawn()` returned `"unavailable"` for both a real SIGSEGV
(`status null, signal SIGSEGV, error undefined`) and a real timeout
(`status null, signal SIGTERM, error ETIMEDOUT`).

`classifySpawn()` now reads `signal` — the one field that separates "no process ever ran" from
"a process ran and died", and previously read nowhere in the module. Ran-and-died checks come
first, because the timeout row's `error` would otherwise be consumed by the missing-binary
disjunct. Both then fall through to the ordinary rules, where rule 5 already produces `"failed"`
with an actionable message.

Added the paired predicate `deadAssemblerIsNeverASkip()` over `MEASURED_RAN_AND_DIED_SPAWNS`,
driven from both directions exactly like `missingAssemblerIsNeverAPass()` — with a
`PRE_CR03_CLASSIFIER` planted violation, so the control can bite. `MEASURED_MISSING_BINARY_SPAWNS`
pins only the three missing-binary rows, which is why that guard stayed green throughout the
window this hole was open, and why widening it would not have been enough.

Three tests: the paired predicate, a live measurement (real spawns, not literals, so a Node
version reporting these differently fails by name), and an end-to-end crashing assembler through
the same `acmeBin` seam the missing-binary and `/bin/true` directions already use.

**Invariant preserved:** the verdict is still a byte-diff, never the exit status; `"skipped"` is
still a third outcome distinct from `ok`/`failed`; it is now reachable *only* from a spawn that
genuinely did not run, which is what `acme-verify.test.ts`'s own paired control has always
demanded.

### WR-01: `symbolCount` does not count what its doc says it counts

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `6139a87`

Documented as "how many symbol definitions the header carries", assigned `sortedLabels.length`.
Diverges in both directions: mid-instruction labels are defined inline and skipped by the header
loop yet counted; `enumDefinitionLines` *are* header definitions yet are not.

The doc now describes what it counts (store labels, header and inline together), and the header
count is a new `headerDefinitionCount` computed from `headerLines` itself so it cannot drift from
the emitted text. Both numbers have a real consumer; collapsing them into one is what produced the
divergence.

Tested over the one fixture shape where all three readings differ, with the header count asserted
against the *emitted source* rather than against another copy of the same expression, and a
`notEqual` guard so the test cannot go vacuous.

### WR-02: `midInstructionLabelCount` under-counts when two labels share one address

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `6139a87`

Two halves.

The counter was `midInstructionLabelAddresses.size`, a set of *addresses*, while the inline loop
emits one line per *label*. It is now incremented beside the `content.push()` that emits the line
it counts, so it cannot drift.

The `labelIndex` collision: `symbolFor()` returned whichever colliding name sorted last, with no
diagnostic anywhere. **Recorded rather than refused**, deliberately, and this is the one departure
from the reviewer's first-listed option. An alias is something the exporter *can* express — both
definitions go out, ACME accepts two symbols with one value, the bytes are unaffected — so
refusing would have deleted a supported store state (`anno_label` is `unique` on name only) to fix
a diagnostic problem. Only the arbitrary pick was invisible. Both definitions now carry an
`ALIAS:` marker naming every candidate and which one references resolve through, and the pick is
the *first* name, stably, rather than an artefact of a sort that never promised a tiebreak.

A round-trip test through real ACME confirms the markers and the second inline definition are
comments and text, not bytes.

### WR-03: a store's `dataType` reaches emitted ACME source text unvalidated

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `ea53dcd`

`assertDataTypeForExport()` added at the block-construction boundary, re-checking (never
re-defining) through `assertDataType()`. The reviewer's asymmetry argument is the whole case: the
very next function already defends the analogous `commentType` with "Unreachable through the type,
and reachable through a store file somebody edited. Refusing beats guessing."

The store validator's message is discarded and replaced, for `assertExportableCommentText()`'s
reason — `assertDataType()` interpolates the offending value, and an exporter error that echoes a
file's contents is a content-disclosure oracle. The refusal carries the address range and the
valid list, and nothing read off disk.

**Driven at the predicate, not through a corrupted store, deliberately.** `anno-store.ts` is the
ONE module in this repo permitted to name `node:sqlite`, so manufacturing the corrupted row would
mean breaking a stated architectural constraint to prove a point about robustness. Eight hostile
values including the line-break case, plus a non-vacuity control over every real `DATA_TYPES`
member so a validator that refused everything fails.

### WR-04: `hexExtent()`'s `$10000` case is untested and rests on an unmeasured assumption

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `a631db1`

**The reviewer flagged this as an untested assumption. Measured, the assumption was false, and
this was the most consequential finding in the Warning tier.**

`hexExtent()` padded without masking so a range ending at `$ffff` emitted `!if * != $10000`,
justified by the claim that `hex4()`'s mask "would render that as `$0000` — an assertion no
assembly can ever satisfy, firing on a correct export".

Measured against real ACME 0.97 on this host:

```
* = $fffe
        !byte $aa, $bb
!if * != $0000 { !error "end drifted" }     -> exit 0, file written, bytes aa bb
!if * != $10000 { !error "end drifted" }    -> exit 1, no output file
```

ACME's `*` is a 16-bit program counter and **wraps**. So the *unmasked* assertion was the one
firing on a correct export — for every range touching the top of memory, with a failure that
looks like an exporter bug rather than an arithmetic one. ACME's own `-v2` line prints the
unwrapped extent (`0xfffe - 0x10000 exclusive`), which is presumably where the assumption came
from; that is ACME describing a *segment*, and `*` is a different thing.

`hexExtent()` now masks. The function is kept (rather than folded into `hex4()`) so the
measurement has somewhere to live and so the one non-address value still reads differently at its
call site.

Four tests, **three of which were confirmed to go red against the pre-fix function**: shape, data
round trip, code round trip (which also exercises `decode()`'s 16-bit address wrap, as the
reviewer suggested), and a non-vacuity control proving the masked assertion still bites at the top
of memory (one byte short → exit 1, no output file).

### WR-05: `--out` is never checked against `<image>` or `--store`

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `551f042`

`outPath` is now compared to both inputs after confinement, and the refusal is **unconditional** —
`--force` does not lift it. `--force` means "yes, replace the file I named"; nobody types it
meaning "yes, destroy the annotation store I spent a month writing". This is the one write refusal
in the file that `--force` does not lift, and it says so.

All three paths are confined realpaths at that point, so the comparison is exact rather than a
string-shape guess about `..` and symlinks.

Both directions plus a paired non-vacuity control. **Confirmed to bite**: stubbing the condition
to `false` turns both tests red.

### WR-06: `spawnSync`'s default 1 MiB `maxBuffer` turns a large export into `"skipped"`

**Files modified:** `src/mcp/vice/acme-verify.ts`, `src/mcp/vice/acme-verify.test.ts`
**Commit:** `207f049`

`maxBuffer: 64 * 1024 * 1024` set explicitly, chosen to be far past any plausible real store
rather than tuned — this is a test-only oracle run once per verification, and an unfilled buffer
costs nothing while an overflowed one costs a verdict about the wrong thing.

The reviewer's second half is also done: ENOBUFS is now `"ran"`. Measured — `spawnSync` *kills*
the child on overflow (`status null, signal SIGTERM, code ENOBUFS`), so CR-03's signal rule
already covers it, and the shape is pinned as a third `MEASURED_RAN_AND_DIED_SPAWNS` row so a
future change to that rule cannot silently reopen the channel.

Two guards: a live overflowing spawn asserting the classification, and a structural check on the
spawn's own options object. The structural one caught itself matching a `maxBuffer: 1024` quoted
in a doc comment on its first run and is now scoped to the real call site.

### WR-07: `decode()` is handed an EXCLUSIVE end for a parameter documented as inclusive

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `2dcedb6`

Now passes `block.endExclusive - 1`, with a comment naming which of the slice and the `end` option
is the authority so the two are not read as one mechanism.

The reviewer's point that it was *inert* is exactly why it was worth fixing rather than leaving:
the guard was doing nothing, so the next maintainer to hand `decode()` a wider slice inherits a
silent one-instruction overrun with no test to catch it.

Tested at `decode()`'s own contract with a wide slice, where the two spellings genuinely produce
different output (two instructions vs three) — plus a structural check on the call, because no
`exportAsm()`-level test can tell them apart, which is precisely why the wrong one survived.

### WR-08: `refuseOverwrite()`'s doc comment contradicts itself in adjacent paragraphs

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `551f042`

"two" → "THREE", with the correction itself recorded, since in this tree header prose is the
maintenance contract and this file's header already documents a prior incident caused by prose
outrunning the code.

The reviewer's suggestion taken: the count is now asserted **mechanically** against the stripped
source, the way `anno-cli-path-consumers.test.ts` already does for the confinement seam, so the
next verb to write an output file cannot leave the number behind. The guard caught an off-by-one
in itself on its first run — it counted the declaration as a call site — which is exactly the
shape of defect it exists against, so that is recorded in the test.

### WR-09: option parsing only rejects `--`-prefixed values

**Files modified:** `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-cli.test.ts`
**Commit:** `551f042`

One `isMissingOptionValue()` predicate now serves all **seven** value-taking sites (the review
named five plus the two export-asm ones). Any leading `-` is refused, including a bare `-`: no verb
in this CLI reads stdin, and a path that genuinely begins with a dash is addressable as `./-x`.

Applying it at one call site would have left the finding armed in the other two parsers — and the
shared predicate is also what makes the three parsers' "the same convention" claim true by
construction rather than by three inline copies that drift.

Driven over every (verb, value-taking option) pair *derived from `VERB_OPTIONS`*, so a new option
is covered with no edit, with a precondition that every verb contributes at least one pair and a
paired direction proving an ordinary value is still accepted. **Confirmed to bite**: restoring
`startsWith("--")` turns the single-dash test red.

### WR-10: an enum variant symbol colliding with a label name is acknowledged but never checked

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `2dcedb6`

The comment named the hazard exactly and then did not look. Now refused by name, naming the enum,
the variant, the address and the label.

Checked against a new `labelSymbolNames` set of *every* label name — not `labelIndex`, which is
keyed by address and (after WR-02's alias handling) holds only the first name at each, so an
aliased label would have been invisible to a collision check reading it.

Includes an **external oracle**: real ACME 0.97 confirms the predicted `Symbol already defined.`
at exit 1 with no output file, so the refusal is not merely asserted to be necessary. Plus a
paired direction proving a non-colliding enum and label still export.

### WR-11: the documented-status guard mutates the working tree and can be discharged by an unrelated word

**Files modified:** `src/mcp/vice/anno-verb-coverage.test.ts`
**Commit:** `20b9bd1`

Both halves, taking the reviewer's suggestions.

The `sync-skills.mjs` spawn is gone. The shipped tree is scanned *as it is on disk*, and a
companion test asserts it is byte-identical to the source tree — so a stale shipped copy is
reported by name instead of being silently regenerated, which is strictly more information than
regenerating gave. `scripts/check-skill-cli-invocations.mjs` is a CI *script* and may still
regenerate; a test may not. **Verified**: a sha256 snapshot of `installer/skills/` is unchanged
across a run of the suite.

The discharge is now per-verb and same-sentence: a return marker only discharges a claim about a
verb it shares a sentence with, expressed checkably as "no sentence terminator between them" (a
bare `.` does not split, so dates and version numbers are safe). A character radius alone would
not do — the real discharge and the loophole are about equally far apart, and the sentence
boundary is what separates them.

Three planted loopholes ("the tool returned an error.", "The call returned nothing.", and a
trailing "The probe returned no rows.") and three real discharges including one where the marker
*follows* the verb. **Confirmed to bite**: restoring the per-paragraph discharge turns the planted
control red.

### IN-01: shebang on a library module

**Files modified:** `src/mcp/vice/acme-verify.ts`
**Commit:** `1b78aab`

Removed. The module exports only functions and is never executed directly; its sibling
`anno-export-asm.ts`, created in the same phase, correctly has none.

### IN-02: data-line comments lose their address

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `1b78aab`

A comment on a multi-address line is now qualified with its own address (`; $XXXX: <text>`) — the
first of the reviewer's two options. Splitting the `!byte` line was the other and is worse here:
it changes the emitted structure for a presentation problem, and every extra directive is another
line whose width and origin the byte-diff has to keep agreeing about.

**Gated on ambiguity**, so the code path — which calls `withComments()` with a span of exactly one
address — is untouched and no existing expected line moves. Three tests including the paired
unqualified direction and a round trip proving the qualification is still just a comment.

### IN-03: hex case is inconsistent within one emitted document

**Files modified:** `src/mcp/vice/anno-export-asm.ts`, `src/mcp/vice/anno-export-asm.test.ts`,
`src/mcp/vice/anno-cli.test.ts`
**Commits:** `1b78aab`, `23e653e`

Lowercase chosen, because three emitters (`hex2()`/`hex4()`/`hexExtent()`) and the golden witness
disassembly they were matched to already use it — one emitter changes rather than three. The
load-bearing *width* rule is untouched.

Guarded by a scan for any uppercase hex digit in a document deliberately built over `$c000` so it
carries letter-bearing literals, with a non-vacuity assertion so a scan finding nothing is finding
nothing for the right reason. One expectation in `anno-cli.test.ts` moved with it (`23e653e`), kept
case-sensitive so it still notices a drift back.

### IN-04: the fixture generator's ACME probe is narrower than the gate's

**Files modified:** `src/mcp/vice/fixtures/export-asm/make-export-asm-fixtures.mjs`,
`src/mcp/vice/anno-export-asm.test.ts`
**Commit:** `1b78aab`

The generator now mirrors `probeAcme()`'s full ladder — `--version`, falling back to `--help`,
with the same case-insensitive `acme` banner test. The banner check matters as much as the
fallback: "exit 0" alone is satisfied by any binary at all under a misconfigured `ACME_BIN`.

Mirrored rather than imported, as the file's own header explains it must be (the gate is test-only
and asserts its own absence from `files[]`; the generator sits under a path the packer walks) — so
a new guard asserts the two mirrors carry the same rungs and that the narrow `status !== 0` form
does not come back.

## Skipped Issues

None. All 18 in-scope findings were fixed.

## Design invariants preserved

All five invariants named in the fix brief were checked and hold:

1. **The ACME verdict is a byte-diff, never the exit status**, and `skipped` remains a third
   outcome. CR-03 and WR-06 both *narrow* the route into `skipped` so it is reachable only from a
   spawn that genuinely did not run; neither lets a skipped assembler present as a pass.
2. **`acme-verify.ts` is test-only and stays out of `files[]`.** Untouched, and
   `acme-verify.test.ts`'s own guard for this still passes.
3. **An inexpressible annotation is refused loudly and by name.** CR-02 was the live violation and
   is fixed; WR-03 and WR-10 add two more refusals in the same shape.
4. **Block bracketing uses `endInclusive + 1`.** The arithmetic is unchanged and still
   single-sited. WR-04 changed only how that value is *rendered*, and WR-07 changed only what is
   handed to `decode()`; `ExportBlock.endExclusive` still carries the true exclusive end, which the
   WR-04 test asserts explicitly.
5. **Path confinement happens before any filesystem probe.** Unchanged. WR-05's new refusal is
   placed *after* confinement, deliberately, so it compares realpaths.

## Notes for the verifier

- **WR-04 is worth a second look.** The reviewer classified it as an untested assumption; the
  measurement showed the assumption was wrong in the direction that breaks correct exports. Any
  store with a range touching `$ffff` would have failed at assembly before this commit. It had no
  test because no test in the file used an address above `$d020`.
- **WR-02 was resolved by recording rather than refusing.** That is the reviewer's second-listed
  option, chosen because refusing would delete a store state the schema supports. If the project
  would rather refuse aliases outright, that is a one-line change at the same site and the
  reasoning for both directions is written there.
- **WR-01 added a field** (`headerDefinitionCount`) rather than redefining `symbolCount`. The CLI
  summary line is unchanged and now accurate against the corrected doc.
- Three fixes involved exporting a previously-private function for test reach
  (`substituteImmediateEnum`, `assertDataTypeForExport`, plus `deadAssemblerIsNeverASkip` as new
  public API). Each carries a note saying why, on the precedent
  `assertExportableCommentText()` set.

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
