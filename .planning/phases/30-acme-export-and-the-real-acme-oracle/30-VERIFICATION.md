---
phase: 30-acme-export-and-the-real-acme-oracle
verified: 2026-08-31T05:40:40Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 30: ACME Export and the Real-ACME Oracle — Verification Report

**Phase Goal:** Exported ACME source is correct because a **real ACME actually assembles it and
the bytes match** — through a verify path built for this purpose, standing and exercised before
the deletion window opens.

**Verified:** 2026-08-31T05:40:40Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

Every criterion below was checked against the code, then **mutation-tested**: the guard under
test was deliberately broken in the working tree, the suite re-run, and the tree restored with
`git checkout`. A criterion is recorded VERIFIED only when a real failing observation was
produced — presence of a symbol was never accepted as evidence. Real ACME 0.97 "Zem"
(`/home/henrik/.local/bin/acme`) was driven directly by the verifier in three independent
reproductions that do not go through the project's own test harness at all.

`git status` at the end of verification shows **no tracked modification** — all seven mutations
were reverted.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Real ACME assembles the export; verdict settled by byte-diff, never exit code, never a string match on the exporter's own output; five verdict rules carried explicitly | ✓ VERIFIED | See criterion 1 below — two independent mutations reproduced failing observations |
| 2 | Two mandatory reds, both OBSERVED against the new producer | ✓ VERIFIED | See criterion 2 — both reds run unskipped; both mutation-proved non-vacuous |
| 3 | Both carried idioms load-bearing: `=*+$01` on genuine SMC, 11 prefixes from `AUTO_NAME_PREFIX_RE` | ✓ VERIFIED | See criterion 3 — placement mutation breaks real-ACME byte-identity |
| 4 | Unexpressible reported, not emitted; every block asserts `*`; enum immediate-only | ✓ VERIFIED | See criterion 4 — 221/35 confirmed from the table; WR-04 mask independently reproduced |
| 5 | Duplicate label refused by the store; with the refusal removed real ACME reports the duplicate | ✓ VERIFIED | See criterion 5 — store refusal mutation-proved; external oracle carries a paired clean control |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

---

### Criterion 1 — the oracle is a byte-diff, not an exit code

`src/mcp/vice/acme-verify.ts` (883 lines). `verifyAcmeAssembles()` assigns
`const exitStatus: number | null = r.status` **once** and reports it; no rule reads it. The five
verdict rules are five separately-named exported pure helpers, each with its own JSDoc naming
which property it carries and its own test driving it directly:

| Rule | Function | Carried property |
|------|----------|------------------|
| 1 | `parseAcmeResultLines()` | ACME's own per-segment lines are read off, never synthesised |
| 2 | `parseAcmeAggregateLines()` | the aggregate is recorded and consulted by nothing but rule 3's *count* |
| 3 | `refuseOnCompetingAggregates()` | >1 authoritative line ⇒ refusal, never a pick |
| 4 | `firstResultLineDisagreement()` | unanimity, walking every pair, first mismatch drives |
| 5 | `parseAcmeDiagnostics()` / `isFatal()` | `Warning` never fails; `Error`/`Serious error` do |

`skipped` is a genuine third outcome reached only through `classifySpawn()` before any
exit-status arithmetic exists. Byte comparison is `Buffer.compare` with byte lengths and a byte
offset (`compareBytes()`).

**Independent reproduction (verifier, outside the harness).** Built a store over the committed
`smc.prg`, ran the shipped verb through its real entry point, and assembled the result myself:

```
$ node .../vice-proxy.ts anno export-asm smc.prg --store anno.sqlite --out out.a
export-asm: wrote .../out.a (1 block(s), 1 symbol(s), 0 auto-named, 0 unexpressible
  instruction(s), 1 mid-instruction label(s), 0 enum substitution(s))
export-asm: this file has NOT been assembled -- this command writes source text and runs no assembler.
$ acme -f plain -o out.bin out.a   # exit 0
$ cmp payload.bin out.bin          # BYTE-IDENTICAL  (a900 ee02 088d 20d0 4c01 08)
```

**Mutation A** — `if (byteDiff.equal && absentBeforeSpawn)` → `if (exitStatus === 0)`:
`not ok 25 - MANDATORY RED 2`, 38 pass / 1 fail.
**Mutation G** — `classifySpawn` replaced with the historical `r.status === 0 ? "ran" : "unavailable"`
shortcut: 33 pass / **6 fail**, including the crash, timeout, overflow and end-to-end
`acmeBin`-seam observations.

The no-string-match property is enforced structurally at `acme-verify.test.ts:1455` in three
directions — the real module scans clean, a planted `options.source.includes("!error")` verdict
is reported, and a comment-only mention is not (so the guard cannot pass by matching its own
prose).

### Criterion 2 — the two mandatory reds

Both run **unskipped**: `VICE_REQUIRE_ACME=1 node --test acme-verify.test.ts` →
**39 pass / 0 fail / 0 skipped**.

**RED 1** is observed at three levels. In-process (`missingAssemblerIsNeverAPass()` driven with
the real classifier and again with the historical one, so the guard is provably able to bite).
Child-process, because `ACME_BIN`/`ACME_AVAILABLE` are module-load constants — the harness
deletes `NODE_TEST_CONTEXT` (a measured trap that would otherwise exit zero), spawns
`process.execPath`, and asserts the non-zero exit **plus** the gate's own refusal wording read
out of `acme-gate.ts` at run time, so a module-resolution error cannot masquerade as the gate
firing. The paired direction deletes `VICE_REQUIRE_ACME` (not blanks it) and requires exit 0.

**RED 2** (`acme-verify.test.ts:1115`) runs an honest control first, flips exactly one operand
byte, and asserts in one recorded result: `outcome === "failed"`, `byteDiff.equal === false`,
`firstDifferingOffset === 1`, and **`exitStatus === 0`**. Mutation A reds precisely this test.

The two pinned transcripts under `.planning/phases/30-.../fixtures/` were re-recorded from this
phase's producer; a non-vacuity test asserts neither is byte-equal to its Phase 29 counterpart,
and a scan asserts no test in this phase reads the retired producer's fixtures directory.

### Criterion 3 — both idioms load-bearing

`fixtures/export-asm/smc.prg` is `0108 a900 ee02 088d 20d0 4c01 08`. Verified from the bytes by
the verifier: `inc $0802` (`ee 02 08`) writes to the immediate operand byte of the `lda #$00` at
`$0801`. This genuinely self-modifies.

**Mutation B** — the `=*+$01` line pushed **after** its host instruction instead of before:
76 pass / **4 fail**, including `ROUND TRIP: the self-modifying fixture reassembles
BYTE-IDENTICALLY with its write target named by a mid-instruction label`. The placement is
load-bearing against real ACME's bytes, not decorative.

`AUTO_NAME_PREFIX_RE` (`anno-coverage.ts:1393`) holds exactly eleven prefixes
(`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`); `L_` is absent. `anno-export-asm.ts:115` imports it —
the first cross-module production importer. **Mutation C** — import replaced by a local
five-prefix regex: 78 pass / **2 fail**, both the structural scan and the round-trip marking test.

### Criterion 4 — what ACME cannot express is reported as such

`OPCODES` measured live: **221 expressible, 35 unexpressible** — matching the criterion's figure.
The all-256 test derives its expectation from the table itself (never a hand list), asserts every
`acmeExpressible: false` entry goes out as `!byte` carrying **all** its bytes with the mnemonic
and note in the trailing comment, asserts the **directive half** of every `!byte` line is hex
bytes only (so no invented mnemonic can leak out of the comment into assembler input), and
settles with a real-ACME byte-identity verdict.

Every block is bracketed by `!if * != $XXXX { !error ... }` at both its origin and its exclusive
end, in the single `emitBlock()`.

**WR-04, independently reproduced by the verifier against real ACME 0.97:**

```
* = $fffe / !byte $aa,$bb / !if * != $0000   -> exit 0, 2 bytes written   (masked: correct)
                            !if * != $10000  -> exit 1, no output          (unmasked: fires on a CORRECT export)
* = $fffe / !byte $aa      / !if * != $0000  -> exit 1, no output          (masked guard STILL bites)
```

The fix is correct at the top of memory, not merely present. **Mutation E** — `hexExtent()`
reverted to the unmasked pad: 77 pass / **3 fail**, all three WR-04 tests.

**CR-02 is genuinely closed.** `anno-export-asm.ts:1107` refuses an enum bound to an
`acmeExpressible: false` immediate opcode by name, and `substituteImmediateEnum()` independently
confines its search to `line.split("  ; ")[0]` — the assembler-visible half — and throws rather
than silently no-op'ing. **Mutation D** — the refusal disabled: 79 pass / **1 fail**, the CR-02
test. The silent-drop-reported-as-success channel is closed at two points.

*Judged deviation (accepted):* the wrong-operand control observes `exitStatus === 1` because the
block's `*` end assertion fires before the byte-diff (`sta viccolor_BLACK` re-encodes as
zeropage). The test asserts `outcome === "failed"` **unconditionally** and then branches on the
observed exit status, naming which rule produced the verdict. The executor did not silence the
`*` assertion to manufacture the plan's predicted exit-0. This is the honest handling: the
reassembly oracle still catches the case, via a strictly stronger instrument.

### Criterion 5 — duplicate label refused, confirmed externally

`anno-store.ts:2837` refuses a name already bound to a different address with a named
`AnnoLabelError`. **Mutation F** — the refusal disabled: 79 pass / **1 fail**
(`INTERNAL REFUSAL: setLabel() refuses a name already bound to a DIFFERENT address`).

The external oracle runs at the source-text boundary (the only place the duplicate can exist —
`anno_label.name` carries a `unique` DDL constraint on top of the guard). It asserts the
**un**-duplicated export verifies `ok` first, then makes one documented substitution and requires
real ACME to exit 1, write no output file, and emit `Symbol already defined.` parsed as severity
`Error`. The refusal wording asserted in the test is read out of `anno-store.ts` at run time, so
the test cannot pass for the wrong reason.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/mcp/vice/acme-verify.ts` | ACME spawn + three-outcome verdict, test-only | ✓ VERIFIED | 883 lines; absent from `files[]` per USER-D-02, mechanically asserted |
| `src/mcp/vice/anno-export-asm.ts` | store-driven exporter, ships | ✓ VERIFIED | 1310 lines; present in `files[]`; reachable from `vice-proxy.ts` |
| `src/mcp/vice/acme-verify.test.ts` | tracer proof + argv invariant | ✓ VERIFIED | 1669 lines, 39 tests, 0 skipped |
| `src/mcp/vice/anno-export-asm.test.ts` | exporter tests, never-skipped gate | ✓ VERIFIED | 2334 lines, 80 tests, 0 skipped |
| `fixtures/export-asm/smc.prg` `.a` `.mjs` `README.md` | genuine SMC image + regenerator | ✓ VERIFIED | SMC confirmed from the bytes by the verifier |
| `.planning/.../fixtures/verify-{honest-pass,false-pass-trap}.txt` + `README.md` | re-recorded transcripts + provenance | ✓ VERIFIED | non-vacuity test proves not byte-equal to Phase 29's |
| `src/mcp/vice/anno-cli.ts` `export-asm` verb | writes source, assembles nothing | ✓ VERIFIED | run end-to-end by the verifier; output states it was NOT assembled |
| `scripts/lib/anno-cli-verbs.mjs` | `ANNO_CLI_VERB_FLOOR = 3` | ✓ VERIFIED | reads 3; `anno-verb-coverage.test.ts:185` asserts equality with 3 |
| both skill trees | Phase-30 forecasts discharged / re-pointed | ✓ VERIFIED | notices kept and edited, never deleted; `installer/` twin re-pointed identically |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `anno-export-asm.ts` | `anno-coverage.ts` | `import { AUTO_NAME_PREFIX_RE }` (line 115) | ✓ WIRED — mutation C reds 2 tests |
| `anno-export-asm.ts` | `disasm-decoder.ts` / `disasm-renderer.ts` | `decode()` / `renderLine()` | ✓ WIRED — no second opcode table or `!byte` emitter |
| `acme-verify.ts` | `acme-gate.ts` | `import { ACME_BIN }` | ✓ WIRED — one home for the env-var name |
| `acme-verify.test.ts` | `acme-gate.ts` | `acmeSkipReasonFor()` / `assertAcmeRequiredIfEnvSet()` | ✓ WIRED — Phase 27 hard-fail gate reaches this phase |
| `anno-cli.ts` | `anno-export-asm.ts` | `import { exportAsm }` (line 126) | ✓ WIRED — verifier ran the verb end-to-end |
| `vice-proxy.ts:307` | `anno-cli.ts` | dynamic `import` → `runR2000Cli` | ✓ WIRED — the real entry point |
| `ExportAsmResult.expectedBytes` | the IMAGE | built from image bytes, not exported text | ✓ WIRED — export-vs-image, not export-vs-itself |

### Data-Flow Trace (Level 4)

| Value | Source | Produces real data | Status |
|-------|--------|--------------------|--------|
| `AcmeVerifyResult.byteDiff` | `readFileSync(outPath)` written by a real ACME child process | yes | ✓ FLOWING |
| `expectedBytes` | image file bytes via the store's ranges | yes | ✓ FLOWING |
| `unexpressibleCount` / `midInstructionLabelCount` / `enumSubstitutionCount` | counted at emission; each has a "not a constant" zero-case test | yes | ✓ FLOWING |
| exported source text | `decode()` + `renderLine()` over image bytes | yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Real ACME present | `acme --version` | `release 0.97 ("Zem")` | ✓ PASS |
| Oracle suite, ACME required | `VICE_REQUIRE_ACME=1 node --test acme-verify.test.ts` | 39 pass / 0 fail / **0 skipped** | ✓ PASS |
| Exporter suite, ACME required | `VICE_REQUIRE_ACME=1 node --test anno-export-asm.test.ts` | 80 pass / 0 fail / **0 skipped** | ✓ PASS |
| Full automated suite | `VICE_REQUIRE_ACME=1 npm run test:automated` | 2918 tests, **2912 pass / 0 fail**, 1 skip (r2000 upstream clone, unrelated) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | clean | ✓ PASS |
| CLI verb end-to-end | `vice-proxy.ts anno export-asm ...` | wrote `out.a`, exit 0, states it was NOT assembled | ✓ PASS |
| Export → real ACME → byte-diff | `acme -f plain -o out.bin out.a; cmp` | exit 0, **BYTE-IDENTICAL** | ✓ PASS |
| Expressible opcode count | `OPCODES` filter | 221 expressible / 35 unexpressible | ✓ PASS |
| WR-04 wrap at `$fffe` | three hand-written ACME sources | masked correct, unmasked fires on a correct export, masked still bites | ✓ PASS |
| Packaging closure | `node scripts/check-npm-packages.mjs` | OK — 79 files / 34 files, 7 skills | ✓ PASS |
| Skill-doc honesty | `node scripts/check-skill-fork-honesty.mjs` | OK — no stale phase-deferral prose | ✓ PASS |

### Mutation (Non-Vacuity) Results

| # | Mutation | Reds produced |
|---|----------|---------------|
| A | verdict derived from `exitStatus === 0` | 1 — MANDATORY RED 2 |
| B | `=*+$01` label emitted after its host instruction | 4 — incl. the SMC round trip |
| C | `AUTO_NAME_PREFIX_RE` replaced by a 5-prefix local copy | 2 — structural scan + round-trip marking |
| D | CR-02 unexpressible-opcode enum refusal disabled | 1 — the CR-02 test |
| E | `hexExtent()` unmasked (WR-04 reverted) | 3 — all top-of-memory tests |
| F | store duplicate-label refusal disabled | 1 — INTERNAL REFUSAL |
| G | `classifySpawn()` → historical exit-status shortcut | 6 — crash, timeout, overflow, seam, RED 2 |

No mutation passed silently. Tree restored to `HEAD` afterwards.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| EXPORT-01 | 30-01, 30-02, 30-05, 30-06 | ✓ SATISFIED | Criteria 1 + 2; the `export-asm` verb exists and was run end-to-end; both mandatory reds observed unskipped and mutation-proved |
| EXPORT-02 | 30-04 | ✓ SATISFIED | Criterion 3; SMC confirmed from the bytes, placement proved load-bearing by mutation B, 11 prefixes imported from their one home |
| EXPORT-03 | 30-01, 30-02, 30-03, 30-04 | ✓ SATISFIED | Criteria 1 + 4; no-string-match scan with planted violation and comment control; all-256 opcode byte-identity |

No orphaned requirements — `grep "| Phase 30 |"` in REQUIREMENTS.md returns exactly these three,
and all three are claimed by plan frontmatter. The `Complete` markings are **earned**, not assumed.

### Prohibitions

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| Oracle never satisfiable by the exporter's own output | ✓ HELD | three-direction structural scan; mutation A/G red |
| A skipped assembler is never a pass on any surface | ✓ HELD | `skipped` is a distinct outcome; RED 1 at three levels; CLI prints "has NOT been assembled" |
| An inexpressible annotation is refused by name, never silently dropped | ✓ HELD | CR-02, non-immediate enum, `>$ff` variant, mid-instruction label `<$0100`, newline comment, unknown dataType — all refuse by name |
| A dated withdrawal notice is re-pointed, never deleted | ✓ HELD | notices survive in both trees, edited to stay true; `no phase currently owns its return` used instead of an invented number |
| No capability outside USER-D-01's locked scope absorbed | ✓ HELD | `ANNO_CLI_VERB_FLOOR = 3`; `gen-enums`/`export-lbl`/`import-lbl` remain withdrawn |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None** across all phase-modified source, scripts and skill markdown |
| `src/mcp/vice/anno-cli.ts` | 302 | doc-comment tense: "The call site at `runR2000Cli()` **sits** OUTSIDE that function's `try`" reads as present state, but CR-01 moved `checkAcceptedOptions()` inside the `try` (line 1431, inside `try {` at 1416) | ℹ️ Info | The enclosing paragraph is explicitly historical ("Reproduced against the shipped table **before this fix**"), so the meaning is recoverable. Cosmetic tense drift only — no behaviour, no gate, no criterion affected. Not a gap. |

### Human Verification Required

None. No plan carried a deferred `<verify><human-check>` block, and no criterion depends on
visual appearance, real-time behaviour, or an external service the verifier could not drive —
real ACME 0.97 was invoked directly by the verifier in three independent reproductions.

### Gaps Summary

No gaps. The phase goal is achieved and the achievement is falsifiable: seven deliberate
mutations of the load-bearing guards each produced a real failing observation, and the two
findings the orchestrator flagged for specific scrutiny (CR-02's silent enum drop, WR-04's
wrapping `*`) are both genuinely closed — CR-02 at two independent points, WR-04 confirmed
correct at the top of memory by the verifier's own ACME runs rather than accepted from the
fixer's note.

The single Info finding is a doc-comment tense, not a defect.

---

_Verified: 2026-08-31T05:40:40Z_
_Verifier: Claude (gsd-verifier)_
