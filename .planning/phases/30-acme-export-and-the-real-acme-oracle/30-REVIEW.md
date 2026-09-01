---
phase: 30-acme-export-and-the-real-acme-oracle
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-verbs.mjs
  - src/mcp/vice/acme-verify.test.ts
  - src/mcp/vice/acme-verify.ts
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-enum-gen.test.ts
  - src/mcp/vice/anno-enum-gen.ts
  - src/mcp/vice/anno-export-asm.test.ts
  - src/mcp/vice/anno-export-asm.ts
  - src/mcp/vice/anno-memmap-render.test.ts
  - src/mcp/vice/anno-symbols.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
  - src/mcp/vice/fixtures/export-asm/make-export-asm-fixtures.mjs
  - src/mcp/vice/fixtures/export-asm/README.md
  - src/mcp/vice/fixtures/export-asm/smc.a
  - src/mcp/vice/fixtures/export-asm/smc.prg
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-program-recon/references/reconstruction.md
  - src/skills/c64-program-recon/references/tool-selection.md
  - src/skills/c64-program-recon/SKILL.md
findings:
  critical: 3
  warning: 11
  info: 4
  total: 18
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Three new/extended production surfaces were reviewed against the phase's seven stated
design invariants: `anno-export-asm.ts` (ships), `acme-verify.ts` (test-only oracle) and
the new `anno export-asm` CLI verb, plus the guard/manifest/skill files that moved with
them.

**The invariants that hold.** Invariant 5 (path confinement ordering) is implemented
correctly *and* is genuinely falsifiable: `cmdExportAsm()` confines `<image>` and
`--store` at `anno-cli.ts:1257-1264` before either `existsSync` at `:1265`/`:1272`, and
the derived `--out` default is applied first and confined after at `:1268`. The tests at
`anno-cli.test.ts:1532` and `:1551` assert the *confinement* message rather than merely a
non-zero exit, so an ordering regression would be red. Invariant 4's exclusive-end
arithmetic (`endInclusive + 1`) is done in exactly one place (`anno-export-asm.ts:620`)
and is correct. Invariant 6 (argv array, never a shell string) holds in all three spawn
sites. Invariant 7's newline refusal is present at both the store boundary
(`anno-types.ts:1431`) and the export boundary (`assertExportableCommentText()`), and it
covers all four line-break spellings. `tsc --noEmit` is clean.

**The invariants that do not.** Three defects were reproduced live against the committed
code, and all three are on the surfaces the phase context specifically asked about:

1. An enum annotation bound to any of six real opcodes is **silently not expressed** while
   the export reports success and counts it as applied — a direct violation of invariant 3.
2. A **crashed or hung ACME is scored `"skipped"`**, i.e. as "no assembler ran". That
   conflates a real failed observation with an absent toolchain, which is the exact
   category error the module's own header says it exists to prevent.
3. `runAnnoCli()` **throws an unhandled `TypeError`** for a whole class of first
   arguments, breaking its documented never-throw contract. The identical defect was found
   and fixed one directory over in this same phase, and the fix was not carried into the
   CLI it mirrors.

A recurring secondary theme: several `ExportAsmResult` counters do not mean what their
JSDoc says, and those counters are printed verbatim to the user as the CLI's success
summary. The doc comments in this tree are unusually load-bearing — they are the
maintenance contract — so a counter that contradicts its own doc is a real defect, not a
style note.

## Critical Issues

### CR-01: `anno <Object.prototype key>` crashes the CLI with an unhandled `TypeError`

**File:** `src/mcp/vice/anno-cli.ts:293,296` (call site `:1331`)

**Issue:** `checkAcceptedOptions()` reads `VERB_OPTIONS[verb]` with bare bracket access.
`VERB_OPTIONS` is a plain object literal (`:275`), so it inherits from `Object.prototype`;
an inherited key is **truthy**, sails past the `if (!accepted) return undefined` guard at
`:294`, and then `accepted.includes(token)` at `:296` throws because the value is a
function. The call at `:1331` sits **outside** `runAnnoCli()`'s `try` block (`:1338`), so
the exception escapes the function entirely — violating the never-throw contract stated in
this file's own header ("`runAnnoCli()` returns an exit code and never terminates the
process itself … never a thrown stack trace for an expected, user-facing failure") and in
`checkAcceptedOptions()`'s own JSDoc ("Never throws -- this file's never-throw posture
applies here too").

Reproduced against the committed code:

```
$ node -e 'import("./anno-cli.ts").then(m => m.runAnnoCli(["hasOwnProperty","game.prg","--force"]))'
TypeError: accepted.includes is not a function
```

`hasOwnProperty`, `toString`, `constructor`, `valueOf` and `__proto__` all reproduce.

This is not a hypothetical shape. **The exact same defect was found and fixed in this
phase, in the sibling checker**: `scripts/lib/anno-cli-invocations.mjs:427` now reads
verb-keyed tables through `own()`/`Object.hasOwn`, and
`anno-cli-invocations.test.ts:530-596` carries five controls for it — one of which quotes
the failure message *verbatim as `"accepted.includes is not a function"`*, which is
`anno-cli.ts`'s own variable name. The hardening stopped at the checker and never reached
the CLI the checker models.

**Fix:** Use an own-property read, matching the sibling's `own()` helper:

```ts
export function checkAcceptedOptions(verb: string, rest: string[]): string | undefined {
  const accepted = Object.hasOwn(VERB_OPTIONS, verb) ? VERB_OPTIONS[verb] : undefined;
  if (!Array.isArray(accepted)) return undefined;
  // ...
}
```

Add a control per inherited key to `anno-cli.test.ts` asserting `runAnnoCli()` returns 1
with the unknown-verb message rather than throwing. Consider also moving the
`checkAcceptedOptions()` call at `:1331` inside the existing `try`, so the last-resort net
at `:1356` covers it — but that is defence in depth, not the fix.

---

### CR-02: an enum bound to an unexpressible immediate opcode is substituted into a **comment**, and the export reports success

**File:** `src/mcp/vice/anno-export-asm.ts:768-841` (specifically `:774`, `:839`, `:944`)

**Issue:** The enum path gates only on `instr.operand?.role !== "immediate"` (`:774`). The
decoder assigns `role: "immediate"` from the addressing mode alone
(`disasm-decoder.ts:210-211`), **independently of `acmeExpressible`**. Six opcodes in
`disasm-opcodes.ts` are `mode: "immediate"` *and* `acmeExpressible: false` — `$2b` (`anc`),
`$82`/`$89`/`$c2`/`$e2` (`nop #imm`) and `$eb` (`sbc #imm`). For those,
`renderLine()` emits a `!byte` **directive** with the mnemonic and its `#$xx` operand moved
into the trailing comment (`disasm-renderer.ts:245-250`).

`substituteImmediateEnum()` then does `line.indexOf("#$xx")`, finds the literal **in the
comment**, and rewrites it there. The result:

* the enum symbol never reaches the assembler — the operand is still a raw byte in the
  `!byte` list;
* a `viccolor_BLACK = $00` definition is emitted into the header that nothing references,
  which is precisely the clutter the module's own comment at `:830-834` says it avoids;
* `enumSubstitutionCount` (`:944`) counts it, and the CLI prints
  `… 1 enum substitution(s)` at `anno-cli.ts:1304` and **exits 0**.

Reproduced against the committed code (store: one `code` range `$0801..$0803` over
`eb 00 60`, enum `viccolor { $00: BLACK }` applied at `$0801` through the ordinary public
`applyEnumUsage()` route — `applyEnumUsage` performs no opcode validation, so this is
reachable without hand-editing anything):

```
!cpu 6510
viccolor_BLACK = $00
* = $0801
!if * != $0801 { !error "export-asm: block origin drifted, expected $0801" }
        !byte $eb, $00  ; sbc #viccolor_BLACK  [illegal opcode | not expressible in ACME !cpu 6510]
        rts
!if * != $0804 { !error "export-asm: block end drifted, expected $0804" }

=== enumSubstitutionCount: 1 unexpressible: 1
```

This is invariant 3 exactly inverted: "An annotation the exporter cannot express must be
REFUSED loudly and by name, never silently dropped while the export reports success." The
bytes stay correct, so the byte-diff oracle cannot catch it either — a round-trip test
would go green.

It also breaks `substituteImmediateEnum()`'s own stated contract at `:462-467`: "A rendered
line that does not carry the expected literal is a disagreement … refused rather than
patched over: a `replace()` that silently matched nothing would emit the hex literal while
the count claimed a substitution happened." The `indexOf` finds a match in the wrong half
of the line, so the refusal never fires and the exact failure the doc names happens anyway.

**Fix:** Gate on expressibility as well as role, and refuse by name, in the same shape as
the neighbouring refusals:

```ts
if (role !== "immediate" || !instr.acmeExpressible) {
  throw new Error(
    `exportAsm: enum ${JSON.stringify(usage.enumName)} is bound to ${hex4(usage.address)}, whose ` +
      `operand role is ${JSON.stringify(role ?? "none")} and acmeExpressible is ${instr.acmeExpressible} -- ` +
      `an enum renders on an EXPRESSIBLE IMMEDIATE operand only. An unexpressible opcode goes out as a ` +
      `\`!byte\` directive with its mnemonic in a trailing comment, so a substitution there reaches the ` +
      `COMMENT and never the assembler. REFUSED rather than counted as applied.`,
  );
}
```

Additionally harden `substituteImmediateEnum()` so it can only rewrite the directive half
of the line (e.g. search only `line.split("  ; ")[0]`), so the same class of mistake cannot
recur through a different route. Add a test using `$eb`/`$89` as a negative control.

---

### CR-03: a **crashed or timed-out** ACME is reported as `"skipped"` — "ACME never ran"

**File:** `src/mcp/vice/acme-verify.ts:146-147` (consumed at `:667-680`)

**Issue:** `classifySpawn` returns `"unavailable"` when `r.error !== undefined || r.status
=== null`. Both disjuncts are satisfied by a run that genuinely happened:

```
$ node -e 'const{spawnSync}=require("child_process");
           const r=spawnSync("/bin/sh",["-c","kill -SEGV $$"]);
           console.log(r.status, r.signal, r.error)'
null SIGSEGV undefined                       # crash    -> status null,  error undefined
$ node -e '... spawnSync("/bin/sleep",["5"],{timeout:200}) ...'
null SIGTERM Error: spawnSync /bin/sleep ETIMEDOUT   # hang -> error set
```

Both land in the `"skipped"` branch at `:667`, and the returned `reason` at `:676-678`
reads `ACME never ran: spawning "acme" failed with no exit status.` / `… with ETIMEDOUT.`
That statement is **false**: the assembler ran, and its crash or hang is a real observation
about the source. `spawnSync`'s `r.signal` field carries exactly the information needed to
tell the two apart and is never read anywhere in the module.

This contradicts the module's own definitions in the same file:

* `SpawnClassification` (`:115-119`): `"unavailable"` means the assembler **NEVER RAN**;
  `"ran"` means a process really executed "and its result -- whatever its exit status -- is
  a real observation".
* `AcmeOutcome` (`:107-112`): `"skipped"` "means no assembler ran, so no claim about the
  bytes exists".
* `acme-verify.test.ts:154-174`'s paired control asserts that a clean exec producing nothing
  is `"failed"`, "not `"skipped"`" — "`skipped` must be reachable ONLY from a spawn that did
  not run". A SIGSEGV'd process ran.

The consequence is a false-negative channel, not a false pass in the positive tests
(`assert.equal(verdict.outcome, "ok")` would still be red). But the `"skipped"` outcome
exists specifically so a consumer can distinguish "no toolchain here" from "the toolchain
disagrees". A consumer that treats `"skipped"` as an environment condition will silently
absorb a crashing or hanging ACME. `MEASURED_MISSING_BINARY_SPAWNS` at `:159-163` pins only
the three *missing-binary* rows, so `missingAssemblerIsNeverAPass()` cannot see this gap
either.

**Fix:** Read `signal` and split the classification. Three outcomes remain; only the
mapping changes:

```ts
export type SpawnClassifier =
  (r: { error?: unknown; status: number | null; signal?: NodeJS.Signals | null }) => SpawnClassification;

export const classifySpawn: SpawnClassifier = (r) => {
  // A process killed by a signal, or killed by our own timeout, RAN. Its
  // failure is a real observation, not an absent toolchain.
  if (r.signal != null) return "ran";
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") return "ran";
  return r.error !== undefined || r.status === null ? "unavailable" : "ran";
};
```

Then let a signal/timeout fall through to the existing rules: with no output file present,
rule 5 (`:721`) already produces `"failed"` with an actionable message. Extend
`MEASURED_MISSING_BINARY_SPAWNS`'s sibling with the two measured *ran-and-died* shapes so
`missingAssemblerIsNeverAPass()` has a paired "a dead assembler is never a skip" predicate.

## Warnings

### WR-01: `symbolCount` does not count what its doc says it counts

**File:** `src/mcp/vice/anno-export-asm.ts:180,938`

**Issue:** The field is documented as "How many symbol definitions the header carries"
(`:180`) but is assigned `sortedLabels.length` (`:938`). Those diverge in two directions:
mid-instruction labels are defined **inline** and skipped by the header loop (`:890`) yet
still counted, and `enumDefinitionLines` **are** header definitions (`:888`) yet are not.
Reproduced: a store with `start`@`$0801` plus `smc_operand`/`smc_alias` both at the
mid-instruction address `$0802` produces a header carrying exactly one definition
(`start = $0801`) while `symbolCount` reports `3`. That number is printed to the user as
`… 3 symbol(s)` (`anno-cli.ts:1302`).

**Fix:** Either compute it (`symbolCount: headerLines.length`) or restate the doc to "How
many store labels the export carries, header and inline together" and add a separate
`headerDefinitionCount`. Pin whichever is chosen with a test over the mid-instruction +
enum case, which is the only shape where the two readings differ.

### WR-02: `midInstructionLabelCount` under-counts when two labels share one address

**File:** `src/mcp/vice/anno-export-asm.ts:196-199,723-766,942`

**Issue:** `anno_label` is `unique` on `name` only (`anno-store.ts:263`), and `setLabel()`
refuses only a name already bound to a *different* address — so two names at one address
are a supported store state. The inline loop at `:723` emits one `=*+$NN` line per label
(correct), but the count is `midInstructionLabelAddresses.size` (`:942`), a set of
**addresses**. Reproduced: two labels at `$0802` emit two inline definitions and exclude
two labels from the header, while `midInstructionLabelCount` reports `1` — contradicting
its own doc at `:196-199` ("Equal to the number of labels that were therefore EXCLUDED from
the header definition block").

Related, same shape: `labelIndex` (`:640-644`) is a `Map<number, string>`, so `symbolFor()`
silently returns whichever of the colliding names sorted last. In the reproduction the
`inc` referenced `smc_alias` rather than `smc_operand` with no diagnostic.

**Fix:** Count emitted inline definitions (`let midInstructionLabelCount = 0;` incremented
beside the `content.push(...)` at `:764`), and either refuse a second label at an address
already indexed or record the collision in the emitted source so the arbitrary pick is
visible.

### WR-03: a store's `dataType` reaches emitted ACME source text unvalidated

**File:** `src/mcp/vice/anno-export-asm.ts:267-297` (`:276`, `:292`); read at
`anno-store.ts:2372`

**Issue:** `listRanges()` casts `row.data_type as DataType` with no `assertDataType()` call,
so a store whose `anno_range.data_type` was edited on disk carries an arbitrary string into
`emitDataLines()`, which interpolates it into the emitted comment at `:276` and `:292`. A
value containing a newline emits arbitrary text at column zero of the generated ACME
source — the same mechanism invariant 7 refuses for comment text.

The asymmetry is what makes this a defect rather than a theoretical: the very next function,
`withComments()` at `:551-559`, **does** defend the analogous case by name, with the
comment "Unreachable through the type, and reachable through a store file somebody edited.
Refusing beats guessing." The same reasoning applies to `dataType` and was not applied.
The block-end `!if` assertion would catch the resulting drift *at assembly time*, but the
CLI verb assembles nothing (`anno-cli.ts:1293-1305`) — it writes the corrupted file and
exits 0.

**Fix:** Call `assertDataType(row.dataType)` once during block construction
(`anno-export-asm.ts:618-623`) and refuse by name, in the same wording as the `commentType`
refusal.

### WR-04: `hexExtent()`'s `$10000` case — the only reason it exists — is untested and rests on an unmeasured assumption

**File:** `src/mcp/vice/anno-export-asm.ts:312-321,348-355`

**Issue:** `hexExtent()` was written specifically for a range ending at `$ffff`, whose
exclusive end is `$10000` ("`hex4()` masks with `0xffff` and would render that as `$0000` --
an assertion no assembly can ever satisfy, firing on a correct export"). No test in
`anno-export-asm.test.ts` uses an address above `$d020`; `grep` for `ffff`/`10000` in that
file returns nothing. Every other measured claim in this module is backed by a real-ACME
observation, but whether ACME's `*` actually reads `$10000` after a block ending at `$ffff`
— rather than wrapping to `$0000` — is asserted and never measured. If it wraps, **every**
export of a range touching the top of memory fails at assembly with the emitted `!error`,
and the failure looks like an exporter bug.

**Fix:** Add a round-trip test over a flat 64K capture with a range `$fffe..$ffff` (which
also exercises `decode()`'s 16-bit address wrap at `disasm-decoder.ts:163`), and record the
measured `*` value in `hexExtent()`'s doc the way the rest of the module records its
measurements.

### WR-05: `--out` is never checked against `<image>` or `--store`, so `--force` can destroy an input

**File:** `src/mcp/vice/anno-cli.ts:1268-1294`

**Issue:** `outPath` is confined and overwrite-checked, but never compared to `storePath` or
`imagePath`. `anno export-asm game.raw --store g.annostore --out g.annostore --force`
overwrites the annotation store with ACME text; `--out game.raw --force` overwrites the
image. `refuseOverwrite()` blocks both without `--force`, and `exportAsm()` has fully read
both inputs before `writeFileSync` at `:1293` — so this is user-directed rather than silent
— but a CLI whose header says "Every verb takes EXISTING inputs and refuses rather than
guess" should not let its own output destination land on its own input.

**Fix:** After confinement, refuse when `outPath === storePath || outPath === imagePath`,
regardless of `--force`. All three are realpaths by that point, so the comparison is exact.

### WR-06: `spawnSync`'s default 1 MiB `maxBuffer` turns a large export into a `"skipped"` verdict

**File:** `src/mcp/vice/acme-verify.ts:657-660`

**Issue:** No `maxBuffer` is set, so Node's 1 MiB default applies. `-v2` emits one
per-segment result line per block; a store with enough ranges (roughly 17 000 at ~60 bytes
per line) overflows stdout, at which point `spawnSync` sets `error.code = "ENOBUFS"`, kills
the child, and `classifySpawn()` returns `"unavailable"` → `"skipped"`. The same
false-"no assembler ran" report as CR-03, from a different cause. `refuseOnCompetingAggregates()`
and `firstResultLineDisagreement()` — the two rules that read stdout — would then never run.

**Fix:** Set an explicit generous `maxBuffer` (e.g. `64 * 1024 * 1024`) and, once CR-03 is
fixed, treat `ENOBUFS` as `"ran"` with truncated evidence rather than as an absent binary.

### WR-07: `decode()` is handed an EXCLUSIVE end for a parameter documented as inclusive

**File:** `src/mcp/vice/anno-export-asm.ts:705`

**Issue:** `decode(slice, block.start, { end: block.endExclusive })`. `DecodeOptions.end` is
compared with `if (end !== undefined && address > end) break`
(`disasm-decoder.ts:169`) and documented as "an instruction starting past `end` is dropped …
an instruction starting at or before `end` is emitted in full" — i.e. an **inclusive**
bound. Passing `endExclusive` therefore permits one instruction more than intended. It is
inert only because `slice` is exactly the block's bytes and the `offset < bytes.length` loop
condition bounds it first — the guard is doing nothing, and the next maintainer who passes a
wider slice (e.g. to give `decode()` lookahead across a block boundary) gets a silent
one-instruction overrun.

**Fix:** Pass `block.endExclusive - 1`, or drop the `end` option entirely and let the slice
be the bound, with a comment saying which of the two is the authority.

### WR-08: `refuseOverwrite()`'s doc comment contradicts itself in adjacent paragraphs

**File:** `src/mcp/vice/anno-cli.ts:304-317`

**Issue:** `:306-309` was updated to "Called by ALL THREE verbs … `cmdRenderMemmap()` …
`cmdCoverage()` and `cmdExportAsm()`", but `:315-316` still reads "The claim is now stated as
the **two** call sites it actually has, because a count is checkable where 'every' is not."
The paragraph whose entire point is that a count is checkable now carries a stale count. In
a tree where header prose is the maintenance contract — and where this exact file's header
documents a prior incident caused by prose that outran the code — this is the failure mode
being reproduced in miniature.

**Fix:** Change "two" to "three" at `:315`, and consider asserting the call-site count
mechanically the way `anno-cli-path-consumers.test.ts` already does for the confinement seam.

### WR-09: option parsing only rejects `--`-prefixed values, so a single-dash token is silently swallowed

**File:** `src/mcp/vice/anno-cli.ts:1120,1128` (same shape at `:368`, `:376`, `:615`, `:623`, `:631`)

**Issue:** `parseExportAsmArgs()` refuses a missing value only when
`value.startsWith("--")`. `anno export-asm g.prg --store -x` accepts `-x` as the store path,
which then fails downstream as a confinement or not-found error rather than as the
"`--store` requires a value" refusal the parser was written to produce. The `*MissingValue`
mechanism exists precisely to avoid "silently swallowing the next token" (its own doc at
`:1112-1118`); a single-dash token is the case it misses.

**Fix:** Reject `value.startsWith("-")` (with an explicit allowance for a bare `-` if any
verb ever wants stdin). Applying it to all five parse sites keeps the three parsers the one
convention their docs claim they are.

### WR-10: an enum variant symbol colliding with a label name is acknowledged but never checked

**File:** `src/mcp/vice/anno-export-asm.ts:825-838`

**Issue:** The comment at `:830-834` names the hazard — "every extra emitted symbol is one
more chance to collide with a label name and turn a correct export into ACME's `Symbol
already defined.`" — and then does not check for it. `definedEnumSymbols` dedupes enum
symbols against each other but never against `labelIndex`/`sortedLabels`. Since the CLI verb
runs no assembler, the collision produces a file that exits 0 here and fails wherever the
user assembles it, with no pointer back to the store row that caused it.

**Fix:** After composing `symbol`, refuse when `labelIndex` holds that name (or when any
`sortedLabels[].name === symbol`), naming both the enum and the label — the same shape as the
`Symbol already defined.` refusal `anno-export-asm.test.ts:1599` already exercises for
duplicate labels.

### WR-11: the new documented-status guard mutates the working tree and can be discharged by an unrelated word

**File:** `src/mcp/vice/anno-verb-coverage.test.ts` (new block from `:198`)

**Issue:** Two problems in one guard.

1. The test spawns `installer/scripts/sync-skills.mjs` with `cwd: ROOT`, regenerating
   `installer/skills/` as a **side effect of running the test suite**. It is gitignored, so
   nothing goes red, but a test that writes into the repository under test is a surprise for
   anyone running `npm test` and makes test ordering matter.
2. `RETURN_MARKERS` contains the bare word `"returned"`. Any paragraph that happens to
   contain it — "the tool returned an error", "the call returned nothing" — discharges a
   genuinely stale withdrawal claim in the same paragraph. The list is documented as
   deliberately narrow on the `WITHDRAWAL_PHRASES` side ("DO NOT WIDEN THIS LIST"); the
   discharge side has no equivalent discipline and is the direction that produces false
   *negatives*, which is the failure mode this guard exists to prevent.

**Fix:** For (1), gate the sync behind an env var or scan the source tree and assert
separately that the two trees are in sync. For (2), require the return marker to co-occur
with the verb (e.g. `returned … as \`anno <verb>\``) rather than appear anywhere in the
paragraph, and add a planted control where an unrelated "returned" fails to discharge.

## Info

### IN-01: shebang on a library module

**File:** `src/mcp/vice/acme-verify.ts:1`

`#!/usr/bin/env node` on a module that exports only functions and is never executed
directly. `anno-export-asm.ts`, the sibling created in the same phase, correctly has none.
Remove it.

### IN-02: data-line comments lose their address

**File:** `src/mcp/vice/anno-export-asm.ts:539-564`

For a `!byte` line covering up to 16 addresses, every `line` comment in that span is pushed
into `before` with no record of which address it annotated, so `n` comments on `n` distinct
data bytes emit as `n` indistinguishable lines above one directive. The code path attaches
each comment to its own instruction. Consider appending `; $XXXX: <text>` for the data path,
or splitting the `!byte` line at commented addresses.

### IN-03: hex case is inconsistent within one emitted document

**File:** `src/mcp/vice/anno-export-asm.ts:304-321,404-407`

`formatSymbolDefinition()` emits uppercase (`start = $C000`) while `hex2()`/`hex4()`/
`hexExtent()` emit lowercase (`* = $0801`, `!byte $a9`). Both assemble identically; the
mixed casing in one generated file is the only cost. Pick one.

### IN-04: the fixture generator's ACME probe is narrower than the gate's

**File:** `src/mcp/vice/fixtures/export-asm/make-export-asm-fixtures.mjs:66-69`

The probe accepts only `acme --version` exiting 0, while `acme-gate.ts:79-84` falls back to
`--help` because "ACME 0.97 prints its banner to either depending on build". On a build
where `--version` is not zero-exiting, the generator refuses to regenerate a fixture that
would assemble fine. The file explains why it cannot import the gate (test-only); mirroring
the gate's fallback ladder costs three lines and keeps the two probes agreeing.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
