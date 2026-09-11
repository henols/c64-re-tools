---
phase: 45-decomposition-to-closure-disagreement-first
verified: 2026-09-11T12:06:31Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 45: Decomposition to Closure, Disagreement First Verification Report

**Phase Goal:** Every byte of the committed synthetic fixtures carries a type, a
name and a documented purpose a person can read — with the two independent
classifiers' disagreements resolved rather than averaged, and an explicit
decline wherever the evidence is genuinely path-dependent.
**Verified:** 2026-09-11T12:06:31Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is not a re-statement of SUMMARY.md/closure-gate.md prose. Every finding
below was independently reproduced against the current `main` checkout:
the real `anno decomp-completeness` / `anno evid-disagreements` / `anno
export-asm` CLI dispatch (`runAnnoCli()`, in-process, the same code a
developer's CLI invocation takes) was invoked directly from a throwaway
script against the real committed `.annostore.json` exports and `.prg`
images; the D-09 planted control was re-triggered live (not read from a
transcript); criterion 5's export was independently re-assembled with a
freshly-invoked real ACME 0.97 binary and byte-diffed with `cmp`; the full
`npm run test:automated` suite was re-run from a clean broker-inactive state
and its failing-test set compared against the two baseline documents; and
`npx tsc --noEmit` was re-run clean. No VICE emulator or broker was started;
nothing was installed.

## Goal Achievement — the FIVE ROADMAP Success Criteria

### Criterion 1 — zero `Undefined` bytes; gate cannot render without `anno_evid_disagreements`; soundness asymmetry in the output

**Status: ✓ VERIFIED**

- Independently invoked `runAnnoCli(["decomp-completeness", "--store", ..., "--manifest", ...])` **without** `--disagreements` against a freshly-imported `dxa/tracer.annostore.json` copy: exit code `1`, message `--disagreements FILE is required -- there is no default and no empty-array substitute; omitting the disagreement input must never render the same report as a real, empty answer (D-09).` No report body was printed. This is the load-bearing behaviour the criterion names — reproduced live, not read from a transcript.
- `anno-decomp-closure.test.ts` (24/24 pass, re-run this session) asserts, for all nine committed fixtures, `byteCensus.undefinedCount === 0` by name through the real gate dispatch, plus Test 5's own non-vacuity control (removing `--disagreements` reds the same gate inside the suite).
- The soundness asymmetry is visible in real rendered output (`docs/phase45-wave0-measurements.md`'s `tracer.prg` capture, itself reproducing the shipped rendering discipline): `NO OBSERVATION: 18 of 21 -- an address never observed executing proves NOTHING`, never rendered as `data` on that absence alone; `DISAGREEMENTS`/`AGREEMENT` are separate named lines, never combined.

### Criterion 2 — every disagreement resolved into the block table or recorded ACCEPTED; unresolved count blocks

**Status: ✓ VERIFIED** (with a disclosed, non-blocking finding about the fixtures themselves — see Gaps Summary)

- All nine committed fixtures report `disagreementCount: 0` in their real, committed `anno_evid_disagreements` join. This is a genuine finding about these nine SYNTHETIC fixtures' own construction (disclosed candidly in `docs/phase45-closure-gate.md`), not evidence the oracle was never cashed: the oracle's OWN required-input mechanism was exercised live (Criterion 1 above), and the `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX` accept-path is unit-tested directly (`anno-store-export.test.ts` Test 6, `completeness-report.test.mjs` Test 9: "an unresolved disagreement fails the gate; the same disagreement, accepted, does not" — re-run, passes).
- The three declared-non-executed fixtures (`dxa/basic-stub.prg`, `petcat/computed-sys.prg`, `petcat/not-basic.prg`) render **by name** as `NOT EXECUTED`, never a clean bill of health — re-confirmed via `anno-decomp-closure.test.ts`'s "Test 3: a GREEN gate run still renders NOT EXECUTED and the manifest's own reason" (all three pass) — this is D-13's own anti-vacuity guard and it is real, not merely asserted.

### Criterion 3 — no `p_XXXX`/`l_XXXX` survivor; every entry point's four-element purpose comment (checkable per entry point)

**Status: ✓ VERIFIED — and confirmed NON-VACUOUS**

- Independently re-implemented the frozen survivor-prefix predicate (the 11 `AUTO_NAME_PREFIX_RE` prefixes plus the three defensive extras from `docs/phase45-wave0-measurements.md`) and ran it directly over all nine committed `.annostore.json` files' real `labels` arrays: **zero survivors** in every fixture.
- Critically, this is checked against a **populated** label set, not an empty one — the exact vacuity risk this phase's own Wave 0 measurement flagged (derivation writes zero labels). Direct inspection: `charset-phantom.annostore.json` carries 514 real authored labels, `bank.prg` carries 5, `fixture.prg` carries 8, etc. — all nine fixtures have real names, confirmed by reading the committed JSON directly, not by trusting a SUMMARY count.
- Spot-checked purpose comments directly in the committed store JSON (`ghidra/bank.annostore.json`'s `start` entry, `ghidra/charset-phantom.annostore.json`'s `start` entry): each carries substantive, specific `function:`/`inputs:`/`outputs:`/`side effects:` text naming real registers, real called routines and real byte counts — not placeholder text.

### Criterion 4 — every referenced non-hardware address resolved or explicitly declined naming what is unknown

**Status: ✓ VERIFIED**

- Read directly from the committed store JSON, all three of this phase's own named decline shapes are present and real:
  1. `ghidra/bank-path-dependent.annostore.json` address `$082c` — ONE `DECLINED:` comment naming both candidate meanings (`$01=$33` → Character ROM, `$01=$34` → RAM), citing `anno_join_memmap`'s real decline reason verbatim.
  2. `export-asm/smc.annostore.json` address `$0802` — `DECLINED:` naming the self-modified operand's per-iteration-varying value.
  3. `petcat/computed-sys.annostore.json` address `$0805` — `DECLINED:` naming the runtime zero-page pointer (`$2B`/`$2C`) the computed `SYS` handover depends on.
- `bank-path-dependent.prg`'s sibling address `$0827` (`sta $D020`) is resolved with an authored comment, not declined — confirmed genuinely non-ambiguous by the same document's own reasoning (both callers' `$01` values leave I/O unselected).
- `anno-decomp-closure.test.ts` asserts `referencedAddresses.unresolved.length === 0` by name for all nine fixtures on every CI run (re-run, passes).

### Criterion 5 — hardware register writes as named enum members; `$D011`/`$D018` decomposed into named bits

**Status: ✓ VERIFIED — independently reproduced end to end, and found to hold on the REAL committed store with no workaround required**

- Imported the real, unmodified, currently-committed `fixtures/ghidra/charset-phantom.annostore.json` into a fresh scratch store and ran the real `exportAsm()` over it against the real committed `charset-phantom.prg` image: **it succeeded with no throw** (`enumSubstitutionCount: 2`, `enumDecompositionCount: 2`), producing the exact OR-ed named-constant lines the closure-gate document shows for `$D011`/`$D018`.
- Wrote the exported source to disk and assembled it with a freshly-invoked real ACME 0.97 ("Zem") binary (`acme -f cbm -o out2.prg out.a`): `cmp` against the real committed `charset-phantom.prg` reports **byte-identical** (4097/4097 bytes including the load header).
- This is a stronger result than `docs/phase45-closure-gate.md` itself documents: that document (written before the code-review-fix commits) describes needing a scratch-modified copy with the `DD00` bonus enum removed. The later commit `42820042` (`fix(45-review): drop the DD00 bonus enum from charset-phantom fixture`) actually removed that enum from the **committed** fixture itself, so the workaround described in the closure-gate document is no longer necessary — verified directly above by running the unmodified committed store through the unmodified `exportAsm()` and getting a clean pass. See Gaps Summary for the resulting documentation-staleness note (non-blocking).
- `anno_disassemble` over the same store renders the identical OR-ed constants and decoded comments for the readability surface (D-16), confirmed by reading `anno-tools.ts`'s shared `hasRegBitsEntry()`/`decomposeRegisterValue()` call sites directly.

**Score:** 5/5 criteria verified.

## Code Review Disposition (45-REVIEW.md / 45-REVIEW-FIX.md)

All four findings accounted for, fixes confirmed present in the current `main` checkout (not merely claimed):

| Finding | Severity | Disposition | Verified in code |
|---|---|---|---|
| CR-01 (decomposition gated on enum-name shape, not table membership — breaks e.g. `$D020`) | Critical | Fixed | `hasRegBitsEntry()` exported from `anno-enum-gen.ts`; both call sites (`anno-export-asm.ts:1221`, `anno-tools.ts:2766`) gate on `REGISTER_ENUM_NAME_RE.test(...) && hasRegBitsEntry(...)` — confirmed by direct grep of current source |
| WR-01 (`bank` field silently dropped on import) | Warning | Fixed | `assertExportBankIsNull()` present, refuses a non-null `bank` by name rather than dropping it |
| WR-02 (fabricated `$0000` entry point on missing image) | Warning | Fixed | `buildEntryPoints()`/`buildReferencedAddresses()` take a nullable image; `imageUnavailable` field added; re-run `anno-decomp-closure.test.ts`'s WR-02 test, passes |
| IN-01 (two hand-copied survivor-prefix definitions) | Info | Accepted, no action (review's own text says optional) | N/A |

Commits `382445d5`, `a892d8bf`, `c1248c3f`, `42820042` all present and reachable on `main`'s `git log`.

## Regression / Suite Baseline

Broker confirmed inactive (`pgrep -x x64sc` empty, `systemctl --user is-active vice-broker` → `inactive`) before and after. `npm run test:automated` re-run fresh this session (redirected to a file, `$?` read on the same line):

```
tests 4119, pass 4101, fail 4, skipped 9, todo 5
EXITCODE=1
```

**Failing set (4), matches exactly** the phase's own claimed strict subset of the Wave 0 5-item baseline: the three `anno-register.test.ts` findings (stable requirement-id floor) and `audit-root-args.test.ts`'s `check-skill-fork-honesty` (documented `/tmp`-scratch race). `text-protocol.test.ts`'s flake and `anno-tools.test.ts`'s TOCTOU flake were both absent this run — consistent with both being previously-documented flakes, not regressions. **No new failure was introduced by this phase's work**, confirmed by direct re-run, not by trusting the closure document's own claim.

`npx tsc --noEmit`: clean (exit 0), re-run this session.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| DECOMP-01 | 45-01, 45-02, 45-04, 45-06, 45-07, 45-10 | ✓ SATISFIED | Criterion 1 above |
| DECOMP-02 | 45-01, 45-04, 45-08, 45-09, 45-10 | ✓ SATISFIED | Criterion 3 above |
| DECOMP-03 | 45-04, 45-07, 45-08, 45-09, 45-10 | ✓ SATISFIED | Criterion 4 above |
| DECOMP-04 | 45-03, 45-05, 45-08, 45-09, 45-10 | ✓ SATISFIED | Criterion 5 above |

No orphaned requirements: `REQUIREMENTS.md`'s Phase 45 mapping table lists exactly these four ids, all four appear in at least one plan's `requirements:` frontmatter, and all four are already marked `[x]`/`Complete` in `REQUIREMENTS.md`/`ROADMAP.md` — consistent with the evidence above, not merely asserted by those documents.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `docs/phase45-closure-gate.md` | Criterion 5 section, "A measured blocker" subsection | Stale claim: states the committed `charset-phantom.annostore.json` "was never modified" and describes a scratch-only DD00 workaround | ℹ️ Info | Superseded by the later same-day commit `42820042`, which DID remove the `DD00` enum from the committed fixture. The actual current state is strictly better than the document describes (no workaround needed at all — verified live above), but the document itself is now factually inaccurate about its own mechanism. Non-blocking: does not affect any of the five ROADMAP criteria, which are independently verified against the current committed state. |
| — | — | `TBD`/`FIXME`/`XXX` debt-marker scan | — | Scanned all phase-touched source files (`anno-cli.ts`, `anno-decomp-closure.test.ts`, `anno-enum-gen.ts`, `anno-export-asm.ts`, `anno-store-export.ts`, `anno-tools.ts`, `completeness-report.mjs`) — zero genuine markers found (all `XXX` substring matches were `$XXXX` placeholder-address prose, not debt markers) |

## Gaps Summary

No blocking gaps. Two disclosed, non-blocking findings, both already honestly recorded by the phase itself and independently confirmed here rather than merely trusted:

1. **`docs/phase45-closure-gate.md`'s criterion-5 section is stale** relative to the later code-review-fix commit that removed `DD00` from the committed fixture — the document describes a workaround that current `main` no longer needs. Recommend a follow-up doc touch-up (not a code change) the next time this file is edited; does not block phase closure since the underlying criterion is independently verified true on the current committed state.
2. **The D-03 idempotence sweep is a whole-document import/export round trip for all nine fixtures, not a from-raw-bytes re-derivation for all nine** — the phase's own `docs/phase45-closure-gate.md` Limits section discloses this precisely (raw re-derivation was independently confirmed pre-closure for 5 of the 9 fixtures only, and an attempted full nine-fixture re-run was abandoned rather than forced under time pressure). This is honestly disclosed by the phase itself, does not correspond to any of the five ROADMAP success criteria, and is D-03's own internal completeness bar rather than a DECOMP-01..04 requirement.

Both items are informational. All five ROADMAP success criteria and all four DECOMP-01..04 requirements are independently verified true against the current codebase, with the phase's own most safety-critical claims (the D-09 planted control, criterion 5's byte-diff, the suite-baseline comparison) reproduced live in this verification pass rather than read from a transcript.

---

_Verified: 2026-09-11T12:06:31Z_
_Verifier: Claude (gsd-verifier)_
