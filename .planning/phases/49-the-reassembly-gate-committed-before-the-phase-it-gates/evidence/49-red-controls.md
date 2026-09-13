# Phase 49, plan 49-07 — `RED_CONTROLS`

Declares the one outcome line `SCHEMA.md` §3 assigns to this file:
`RED_CONTROLS` (§2.5).

---

## What was measured

The phase's own success criterion 3 names exactly three planted controls
(ROADMAP.md, Phase 49): a wrong-byte rebuild under an exit-zero assembler,
a stale-output-path scenario where a previous run's artifact would be read
as this run's, and a rebuild in which a hazard-adjacent range was left
outside the diff scope. Plan 49-03 planted all three, each paired with an
honest control and a case that confirms the gate itself reads the
resulting verdict as red under the correct rule (never the catch-all).

`RED_CONTROLS: all-observed` requires all three to be **observed red in the
same suite run** that also produces the green result being reported — this
is why `RED_CONTROLS` sits ahead of the passing rules in `DECISION-RULE.md`
(`R8`, before `R9`/`R10`/`R11`): a green (or acknowledged) verdict is never
trusted before the planted controls have gone red in the same run.

A planted control's own case **passing** IS the observation that the gate
went red on it — the case's own assertion is what checks the red outcome,
so a passing case means the red was observed; a failing case would mean
the plant did not fire as designed.

## Command and raw output

Both files carrying the three controls, run together in one suite
invocation:

```
$ date -u +"%Y-%m-%d"
2026-09-13
$ cd src/mcp/vice && node --test acme-verify.test.ts reassembly-gate.test.ts
[...]
✔ gate red: a corrupted byte in the tree entry point's expected bytes fails the byte-diff while ACME itself exits 0 (58.647093ms)
✔ gate red: the gate reads that wrong-byte verdict as red under the failed-rebuild rule, not the catch-all and not the no-assembler rule (60.494824ms)
✔ gate red: a previous run's artifact sitting at the tree entry point's own output path is refused even though its bytes are byte-identical to the expected bytes (63.759033ms)
✔ gate red: the gate reads that refused-artifact verdict as red under the failed-rebuild rule (43.229002ms)
[...]
✔ gate red: a purpose-built subject carrying one detectable self-modification produces a hazard report with a finding inside the full export's extent, and the scope check reports complete coverage (9.955973ms)
✔ gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding (7.101418ms)
✔ gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean (8.098332ms)
[...]
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1189.019689
```

Exit code, read directly on the same line (never through a pipe): `0`.

## Naming every planted-control case individually

**Control 1 — the wrong-byte rebuild** (`acme-verify.test.ts`):
- `gate red: a corrupted byte in the tree entry point's expected bytes fails the byte-diff while ACME itself exits 0` — PASSED (the honest control is inside this same case, asserted before the corruption is applied — see the test's own body)
- `gate red: the gate reads that wrong-byte verdict as red under the failed-rebuild rule, not the catch-all and not the no-assembler rule` — PASSED

**Control 2 — the stale-output-path scenario** (`acme-verify.test.ts`):
- `gate red: a previous run's artifact sitting at the tree entry point's own output path is refused even though its bytes are byte-identical to the expected bytes` — PASSED
- `gate red: the gate reads that refused-artifact verdict as red under the failed-rebuild rule` — PASSED

**Control 3 — the hazard-adjacent range left outside the diff scope**
(`reassembly-gate.test.ts`):
- `gate red: a purpose-built subject carrying one detectable self-modification produces a hazard report with a finding inside the full export's extent, and the scope check reports complete coverage` — PASSED (the honest control: the unmodified subject's finding lies inside scope)
- `gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding` — PASSED
- `gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean` — PASSED

All three named controls' cases were observed passing in this single
`node --test` invocation — `67` tests, `67` pass, `0` fail. `RED_CONTROLS`
derives to `all-observed` per `SCHEMA.md` §2.5's own rule: all three
controls named in success criterion 3 were observed red in the same run.

---

<!-- Bare column-0 outcome line. Final occurrence wins -- superseded by the
     re-measurement section below, which appends its own occurrence rather
     than editing this one. -->

RED_CONTROLS: all-observed

## Re-measurement (2026-09-13, after the alignment subject was amended)

**This is a re-measurement, not the original run.** The three planted
controls this file names (`acme-verify.test.ts`'s wrong-byte and
stale-artifact controls, `reassembly-gate.test.ts`'s hazard-adjacent-scope
control) are properties of test fixtures those two files own directly --
none of them reads `hazard-subject-align.a` or its regenerated images, so
the alignment-subject amendment a separate quick task made does not touch
any of the three. This re-run exists because `SCHEMA.md` requires all
seven gate inputs re-measured together in one invocation once the subject
changes, not because this input was expected to move.

### Command and raw output (re-measurement)

```
$ date -u +"%Y-%m-%d"
2026-09-13
$ cd src/mcp/vice && node --test acme-seam.test.ts acme-verify.test.ts reassembly-gate.test.ts reassembly-gate-ack.test.ts reassembly-gate-movement.test.ts reassembly-gate-run.test.ts
[...]
✔ gate red: a corrupted byte in the tree entry point's expected bytes fails the byte-diff while ACME itself exits 0 (49.765311ms)
✔ gate red: the gate reads that wrong-byte verdict as red under the failed-rebuild rule, not the catch-all and not the no-assembler rule (50.221124ms)
✔ gate red: a previous run's artifact sitting at the tree entry point's own output path is refused even though its bytes are byte-identical to the expected bytes (51.620198ms)
✔ gate red: the gate reads that refused-artifact verdict as red under the failed-rebuild rule (46.394886ms)
[...]
✔ gate red: a purpose-built subject carrying one detectable self-modification produces a hazard report with a finding inside the full export's extent, and the scope check reports complete coverage (13.502545ms)
✔ gate red: the same subject exported from a store with the hazard-anchored range removed still assembles to an equal byte-diff, and the scope check reports incomplete naming that finding (13.499483ms)
✔ gate red: the gate returns red for the narrowed export under the diff-scope rule even though its rebuild input carries the pass outcome and its hazard disposition is clean (8.365621ms)
[...]
ℹ tests 121
ℹ pass 121
ℹ fail 0
```

Exit code, read directly on the same line (never through a pipe): `0`.

### Reading the re-measured line

All three planted controls' cases were observed passing again, in the same
single `node --test` invocation this quick task's other re-measured inputs
came from -- `121` tests, `121` pass, `0` fail (a wider run than the
original `67`, since this invocation also covers the two files whose own
inputs did move). `RED_CONTROLS` re-derives to `all-observed`, unchanged.

<!-- Bare column-0 outcome line, second (re-measured) occurrence. -->

RED_CONTROLS: all-observed
