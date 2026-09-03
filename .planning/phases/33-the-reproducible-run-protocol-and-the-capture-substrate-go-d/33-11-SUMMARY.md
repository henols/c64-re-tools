---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 11
subsystem: evidence-measurement
tags: [stock-vice, binary-monitor, determinism-block, hard-reset, frame-anchor, stop-oracle, raster-condition, probe-ready, launch-profile, gate-input, negative-control]
status: complete

# Dependency graph
requires:
  - phase: 33-03
    provides: "the S3 anchor-counted sequence, the D-11 preflight discipline, the measured warp figures, and AUTOSTART_FRAME_EXACT: not-achieved -- whose cause this plan isolates on a corpus-free stop"
  - phase: 33-04
    provides: "vsf-slice.ts and the skill-side vsf-slice.mjs CLI -- the ONE route from a .vsf snapshot to a flat 64K image, spawned by three of this plan's four probes"
  - phase: 33-05
    provides: "STOCK_DETERMINISM_SEED / STOCK_DETERMINISM_FLAGS and buildViceArgs()'s optional profile -- the determinism block whose EFFECT this plan measures, imported rather than retyped"
  - phase: 33-06
    provides: "LaunchProfile threaded through the broker control plane -- the four profiles whose time-to-bind this plan measures on D-18's behalf"
  - phase: 33-07
    provides: "stop-oracle.ts (compareStopIdentity, ORACLE_TERMS) and capture-predicate.ts (argvDigest, normalisePorts) -- every stop comparison in this plan goes through the shipped oracle"
  - phase: 33-09
    provides: "stock-reproducible-run.ts's ordered eight-step procedure and its module header, which names the anchor-counting loop as an evidence script's job -- which these scripts are"
  - phase: 33-10
    provides: "C0_CAPTURE_PAIR: pass, CAPTURE_FRAME_EXACT: no with (line, cycle) named, and the measured finding that a broker grant is not a bound monitor -- the frame-inexactness this plan supplies the mechanism for"
provides:
  - "SEED_EFFECT: pinned -- GATE-01 input, in evidence/33-repro01-determinism.md, derived from 57 of 4080 (block omitted) against 0 of 4080 (block present) over the untouched $C000-$CFEF window"
  - "JITTER_IMMUNITY: immune -- GATE-01 input, in evidence/33-repro02-reset-removed.md, from nine runs sharing one sha256 (0999713e, research M4's own digest) and one four-term stop ($ea31, 1, 257, 57)"
  - "ORACLE_NECESSITY: unproven -- GATE-01 input, in evidence/33-repro03-frame-anchor.md; R6 fires -> degrade, and this plan's own variant control is what supports R6's pre-mapped narrowing to (PC, hit_count)"
  - "RESET_REMOVED_CONTROL: red -- the third of the five D-07 controls observed red: 0 pairwise differing bytes with the reset, 401 without, one step apart"
  - "PROBEREADY_BUDGET: short, WARP_TIME_TO_BIND_MS_MAX: 3155, CONSOLE_TIME_TO_BIND_MS_MAX: 2385 -- D-18's re-check as a range over twenty launches; declared never a gate"
  - "MEASURED: the monitor-issued hard reset does NOT reset the VIC-II raster counter, so the raster phase at the moment of the reset carries through to the stop -- the mechanism behind 33-10's CAPTURE_FRAME_EXACT: no"
  - "MEASURED: the $ea31 anchor is a 60 Hz KERNAL IRQ against a 50.125 Hz PAL frame -- 240 counted anchor hits produced 240 distinct (LIN, CYC) and 0 consecutive repeats, so consecutive anchor hits are never one frame apart"
  - "MEASURED: every monitor command stops the machine to be serviced and resumes it, so a polling wait STARVES the emulator -- PC stuck at $fd80 in RAMTAS across thirty reads spanning 21 s while an unpolled machine reached READY in under 4.5 s"
  - "MEASURED: -console binds ~800-1000 ms FASTER than a windowed launch (1945-2385 ms against 2792-3155 ms), and -warp makes no measurable difference to time-to-bind"
  - "evidence/determinism-probe.mjs, reset-removed-probe.mjs, frame-anchor-probe.mjs, probeready-probe.mjs -- four named repeatable probes driving only shipped seams"
affects: [33-12, GATE-01's verdict, any future plan that adds a step before the protocol's reset, any future plan that polls a stock monitor while waiting]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 67781
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the declared derivation is implemented AS CODE in the probe (deriveSeedEffect, deriveJitterImmunity, deriveResetRemovedControl, deriveOracleNecessity, deriveBudgetVerdict), so each value is produced by the frozen rule rather than chosen once the numbers are visible"
    - "a method control beside the measurement: when an added step changed the result, the added step became its own labelled arm (PREHALT) rather than being deleted from the record"
    - "when the literal antecedent cannot be built, BOTH forms ship -- the literal control is run and reported as not satisfying the rule, and the defensible variant is run beside it and labelled as a variant"
    - "the unflattering reading is taken where two readings of a frozen rule are both available, and the flattering one is written down with its consequence so a later document can override explicitly rather than silently"
    - "a two-term oracle is expressed as a PROJECTION of the shipped four-term one (pc and hitCount held to one shared constant on both sides), never as a second comparison and never as a mode flag on the oracle"
    - "the timing budget under measurement is read out of the shipped module's own source text, because it is a module-private const and a typed copy would drift from the value the launcher uses"

key-files:
  created:
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/determinism-probe.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro01-determinism.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/reset-removed-probe.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro02-reset-removed.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/frame-anchor-probe.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro03-frame-anchor.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/probeready-probe.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-probeready-warp-console.md
  modified: []

key-decisions:
  - "The determinism probe spawns execve(/usr/bin/x64sc, argv) DIRECTLY rather than going through the broker, because buildViceArgs() emits STOCK_DETERMINISM_FLAGS unconditionally on the stock branch. There is no broker route that omits the block -- that unconditionality is the shipped behaviour REPRO-01 asked for -- so a broker-routed probe could only ever have measured Arm B, which is exactly the one-armed measurement SCHEMA.md 2.1 forbids. The flag list is still IMPORTED from the shipped export, so Arm B measures the shipped block."
  - "ORACLE_NECESSITY is derived as `unproven` on the STRICT reading of SCHEMA.md 2.3's 'exactly one frame apart', even though a variant control satisfying every other conjunct was built and is recorded. `proven` is the flattering value here -- it is the difference between degrade and a possible go -- and SCHEMA.md exists so a measuring plan cannot pick the reading that improves its own result. The alternative reading and its complete evidence are written down so 33-12 can override explicitly and record that it moved the value."
  - "The reset-removed control is produced by an evidence script calling the procedure's pieces directly over the wire, never by a tool argument (D-13). git status --porcelain -- src/mcp/vice/ is empty for this plan; no protocol-removing sub-flag was shipped, and 33-09's single-equality key-set test would have redded if one had been."
  - "The probe drives ONE non-temporary Exec checkpoint at the anchor, not the anchor-plus-temporary-target pair runReproducible() arms. That is REPRO-02's own wording and research M4's own measured sequence; the two-checkpoint form cost two 90 s timeouts when VICE deleted the temporary target on its first hit before the wait was keyed."
  - "The halt-establishing step that turned an `immune` measurement into a `not-immune` one was NOT deleted once the method control found it -- it became the labelled PREHALT arm, because its result is the mechanism behind 33-10's CAPTURE_FRAME_EXACT: no and is the most transferable finding in this plan."
  - "PROBEREADY_BUDGET: short is RECORDED and the budget is not changed (T-33-38). The follow-up is named with the four observed maxima to size it against, and the file states that `short` means the first post-launch probe pass always misses rather than that any instance is lost -- probeReady has no retry loop by design."
  - "Research's single -console observation (unbound at 3000 ms, bound at 5000 ms) was NOT reproduced in ten launches, and this is recorded as not reproduced rather than quietly superseded. Ten launches on one host on one day are also not a distribution, and the file says so."

patterns-established:
  - "Pattern 1: measure the method before trusting the measurement. A control on this plan's OWN added step (explore5, then the PREHALT arm) is what stopped a no-go being banked from an artefact -- the strict rule would have fired R3 on a protocol that reproduces perfectly."
  - "Pattern 2: a negative result about the harness is evidence too. The starvation finding and the temporary-target deletion are recorded with their run counts and their causes, because both cost real runs and both are re-encounterable by any later plan that waits on a stock checkpoint."
  - "Pattern 3: when a frozen rule's antecedent is physically unavailable, say so with the number that makes it unavailable (240 hits, 240 distinct raster coordinates) rather than with an adverb, and let the rule fire."

requirements-completed: [REPRO-01, REPRO-02, REPRO-03, REPRO-05]

coverage:
  - id: D1
    description: "REPRO-01's divergence control: four cold boots plus a two-boot concurrency arm prove launch nondeterminism pinned BY DIVERGENCE -- 57 of 4080 over the untouched $C000-$CFEF window without the determinism block, 0 of 4080 with it -- feeding a derived SEED_EFFECT line"
    requirement: "REPRO-01"
    verification:
      - kind: other
        ref: "node evidence/determinism-probe.mjs run -> NOSEED_DIFF_C000_CFEF 57 of 4080, BLOCK_DIFF_C000_CFEF 0 of 4080, DERIVED_SEED_EFFECT pinned; full transcript in evidence/33-repro01-determinism.md"
        status: pass
      - kind: command
        ref: "grep -Eq '^SEED_EFFECT: (pinned|partial|unpinned)$' && grep -q 4080 && grep -q 'BROKER_STATE: inactive' && grep -q 'TEST_AUTOMATED_BASELINE:' && test $(grep -c '^$ ') -ge 4 && grep -q 'ip4://' -> SEED_EFFECT_RECORDED"
        status: pass
      - kind: command
        ref: "grep -v '^//' evidence/determinism-probe.mjs | grep -c 'STOCK_DETERMINISM_FLAGS' -> 3; same for 'vsf-slice' -> 3 (imports the shipped block, reaches the flat 64K through the shipped slicer)"
        status: pass
    human_judgment: false
  - id: D2
    description: "REPRO-01's concurrency edge: two instances under the block on different ports produce argv differing only in the ip4:// element and the same window divergence count, so the pinning is a property of the flags rather than of one port"
    requirement: "REPRO-01"
    verification:
      - kind: other
        ref: "CONCURRENCY_ARGV_DIFFERING_INDICES [16] with index 16 the ip4:// element, CONCURRENCY_ARGV_DIFFERS_ONLY_IN_IP4_ELEMENT yes, CONCURRENCY_WINDOW_P1 0 of 4080 and CONCURRENCY_WINDOW_P2 0 of 4080, CONCURRENCY_SAME_WINDOW_COUNT yes"
        status: pass
    human_judgment: false
  - id: D3
    description: "REPRO-02's positive arm: the protocol reproduces under pre-protocol jitter 0 / 1500 / 4000 ms -- one identical sliced 64K sha256 and one identical four-term stop across the declared triple, confirmed across a nine-run superset"
    requirement: "REPRO-02"
    verification:
      - kind: other
        ref: "node evidence/reset-removed-probe.mjs run -> TRIPLE_DISTINCT_SHA256 1 (0999713e...), TRIPLE_PAIRWISE_DIFF_TOTAL 0, TRIPLE_ANY_STOP_TERM_DIFFERS no, FULL_ALL over 9 runs identical; DERIVED_JITTER_IMMUNITY_DECLARED_TRIPLE immune"
        status: pass
      - kind: command
        ref: "grep -Eq '^JITTER_IMMUNITY: (immune|partial|not-immune)$' && grep -Eq '^RESET_REMOVED_CONTROL: (red|not-red)$' && test $(grep -c '^$ ') -ge 6 && grep -q 'BROKER_STATE: inactive' -> REPRO02_RECORDED"
        status: pass
    human_judgment: false
  - id: D4
    description: "REPRO-02's reset-removed control observed RED: the same three jitters with exactly one step removed -- the monitor-issued hard reset -- produce three distinct sha256 values and differing (line, cycle) on every pair; 0 pairwise differing bytes with the reset against 401 without"
    requirement: "REPRO-02"
    verification:
      - kind: other
        ref: "NORESET_DISTINCT_SHA256 3, NORESET_DIFFERING_TERMS_UNION line,cycle, CONTRAST_FULL_PAIRWISE_DIFF_TOTAL 0 against CONTRAST_NORESET_PAIRWISE_DIFF_TOTAL 401, DERIVED_RESET_REMOVED_CONTROL red"
        status: pass
      - kind: command
        ref: "git status --porcelain -- src/mcp/vice/ | wc -l -> 0 (the control exists without any protocol-removing argument having been shipped, D-13 / T-33-37)"
        status: pass
    human_judgment: false
  - id: D5
    description: "REPRO-03's frame-anchor control: (LIN, CYC) alone observed PASSING on two genuinely different stops (3 differing bytes, different sha256) while the shipped four-term identity reports them different naming hitCount, plus a same-frame positive the four-term identity correctly unifies"
    requirement: "REPRO-03"
    verification:
      - kind: other
        ref: "node evidence/frame-anchor-probe.mjs run -> VARIANT_TWO_TERM_PROJECTION identical:true, VARIANT_FOUR_TERM_DIFFERING_TERMS hitCount, VARIANT_IMAGE_DIFF differing_bytes=3, SAMEFRAME_FOUR_TERM_IDENTITY identical:true with 0 differing bytes"
        status: pass
      - kind: command
        ref: "grep -Eq '^ORACLE_NECESSITY: (proven|unproven)$' && grep -q hitCount && grep -q 'BROKER_STATE: inactive' && test $(grep -c '^$ ') -ge 4 && grep -v '^//' evidence/frame-anchor-probe.mjs | grep -c compareStopIdentity -> 3"
        status: pass
    human_judgment: false
  - id: D6
    description: "REPRO-03's literal control was RUN and is reported as not satisfying SCHEMA.md 2.3's antecedent, with the measurement that makes it unavailable: 240 counted anchor hits, 240 distinct (LIN, CYC), 0 of 239 consecutive pairs equal"
    requirement: "REPRO-03"
    verification:
      - kind: other
        ref: "ANCHOR_SURVEY_DISTINCT_LIN_CYC 240, ANCHOR_SURVEY_CONSECUTIVE_PAIRS_WITH_EQUAL_LIN_CYC 0, LITERAL_TWO_TERM_VERDICT 'differs -- ... proves nothing', CONJUNCT_0_ONE_FRAME_APART_PAIR_EXISTS no, DERIVED_ORACLE_NECESSITY unproven with the failing conjunct named"
        status: pass
    human_judgment: true
    rationale: "That the honest non-red result is reported BESIDE a defensible variant, with each labelled as which, is a property of the record's framing rather than something a command asserts. The greps prove the outcome line, the survey numbers and the variant's comparisons exist; only a reader can confirm the labelling is not a substitution."
  - id: D7
    description: "REPRO-05 / D-18: probeReady's wall-clock budget re-checked under -warp AND under -console as a RANGE -- twenty launches, five per profile, argv from the shipped buildViceArgs() and readiness from the shipped probeReady() -- with the observed time-to-bind recorded against the current budget"
    requirement: "REPRO-05"
    verification:
      - kind: other
        ref: "node evidence/probeready-probe.mjs run -> 20/20 bound, 0 died; absent 2792-3132 ms, warp 2896-3155, headless 1956-2175, warp+headless 1945-2385 against BUDGET_RESOLVED_MS 1000; DERIVED_PROBEREADY_BUDGET short"
        status: pass
      - kind: command
        ref: "grep -Eq '^PROBEREADY_BUDGET: (adequate|short)$' && grep -Eq '^WARP_TIME_TO_BIND_MS_MAX: [0-9]+$' && grep -Eq '^CONSOLE_TIME_TO_BIND_MS_MAX: [0-9]+$' && grep -q 'BROKER_STATE: inactive' && test $(grep -c '^$ ') -ge 4 -> PROBEREADY_RECORDED"
        status: pass
      - kind: command
        ref: "git status --porcelain -- src/mcp/vice/ | wc -l | grep -qx 0 -> NO_SOURCE_TOUCHED (the measuring task changed no shipped source, T-33-38)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every transcript records BROKER_STATE: inactive and the observed TEST_AUTOMATED_BASELINE it was taken against, every voided run appears with its reason, and no numeric claim appears that is not transcribed from a command's real output above it"
    requirement: "REPRO-02"
    verification:
      - kind: command
        ref: "per file: BROKER_STATE: inactive x1, TEST_AUTOMATED_BASELINE: x1, '^$ ' transcript lines 13 / 22 / 12 / 7 across the four evidence files"
        status: pass
      - kind: other
        ref: "evidence/33-repro02-reset-removed.md § Voided runs tables four classes with causes (temporary target deleted before its wait; polling wait starving the emulator; a superseded whole run); 33-repro01 and 33-repro03 record VOIDED_BOOTS/VOIDED_RUNS (none) from the probes' own output"
        status: pass
    human_judgment: true
    rationale: "Exhaustiveness of the voided-run enumeration and the absence of an untranscribed number are properties only a reader can confirm; the greps prove the required lines and the minimum transcript counts are present."

duration: 3h 37m
completed: 2026-09-03
---

# Phase 33 Plan 11: The Three Remaining Observed-Red Controls Summary

The three corpus-free `GATE-01` inputs measured live on genuine stock VICE 3.9 and emitted at column 0 — `SEED_EFFECT: pinned` from a 57-of-4080 divergence collapsing to 0, `JITTER_IMMUNITY: immune` from nine runs on one sha256, and `ORACLE_NECESSITY: unproven` because the frozen rule's "exactly one frame apart" antecedent is physically unavailable on a 60 Hz IRQ anchor — plus `RESET_REMOVED_CONTROL: red` and `D-18`'s budget re-check recorded as a range and deliberately not acted on.

## What was built

Four named repeatable probes under the phase's `evidence/` directory and four transcripts, one
per measurement. Each probe drives only shipped seams: `STOCK_DETERMINISM_FLAGS` and
`buildViceArgs()` and `probeReady()` from `broker-launch.mts`, `compareStopIdentity()` from
`stop-oracle.ts`, `argvDigest()` / `normalisePorts()` from `capture-predicate.ts`, every wire
body from `stock-protocol.ts`, and the flat 64K always through the shipped `vsf-slice` CLI. No
probe reimplements a comparison, retypes a flag list or parses a snapshot.

| Probe | Transcript | Runs | Outcome lines |
|---|---|---|---|
| `determinism-probe.mjs` | `33-repro01-determinism.md` | 6 cold boots | `SEED_EFFECT: pinned` |
| `reset-removed-probe.mjs` | `33-repro02-reset-removed.md` | 15 (9 + 3 + 3) | `JITTER_IMMUNITY: immune`, `RESET_REMOVED_CONTROL: red` |
| `frame-anchor-probe.mjs` | `33-repro03-frame-anchor.md` | 7 (2 surveys + 5 stops) | `ORACLE_NECESSITY: unproven` |
| `probeready-probe.mjs` | `33-probeready-warp-console.md` | 20 launches | `PROBEREADY_BUDGET: short`, `WARP_TIME_TO_BIND_MS_MAX: 3155`, `CONSOLE_TIME_TO_BIND_MS_MAX: 2385` |

## The three gate inputs, and what each rests on

**`SEED_EFFECT: pinned`.** Two cold boots without the determinism block differ at **57 of the
4080** addresses in the untouched `$c000-$cfef` window; two with it differ at **0 of 4080**. Both
halves of `SCHEMA.md` § 2.1's rule are satisfied, which is what makes the zero mean something.
Research measured `59 → 0` and `REPRO-01` itself `67 → 0`, so this reproduces both in shape and
magnitude. The `RESOURCE_GET` read-backs confirm the flags landed —
`RAMInitRandomChance` reads `10` without the block and `0` with it — so the arms are observed and
not inferred from argv. A two-boot concurrency arm on a second port shows the two argv arrays
differing in exactly one element (the `ip4://` one) and both ports measuring `0 of 4080`.

The whole-64K counts are the interesting part. Research's block-applied residual was **1242**
bytes because that stop was wall-clock-anchored; this plan's is **0**, on the same host and
build, and the only thing that changed is that the stop is frame-anchored. So the file can state
the necessary-not-sufficient conclusion with its own numbers on both sides rather than as an
argument: the block and the anchor do different jobs, and Arm A's frame-exact stop still leaves
1028 bytes differing whole-64K.

**`JITTER_IMMUNITY: immune`.** Nine runs of the protocol at jitter 0 / 1500 / 4000 ms produced
**one** sliced 64K sha256 — `0999713e…`, byte-for-byte research's own M4 digest — and one
four-term stop `($ea31, 1, 257, 57)`. All 36 pairs compare at 0 differing bytes.

**`ORACLE_NECESSITY: unproven`.** The literal control the plan specifies — anchor hit `k` against
`k+1` — was built, run, and does **not** satisfy `SCHEMA.md` § 2.3, because the antecedent is
physically unavailable: `$ea31` is a **60 Hz** KERNAL IRQ against a **50.125 Hz** PAL frame, so
240 counted anchor hits produced **240 distinct `(LIN, CYC)`** values and **zero** consecutive
repeats. A variant control at a raster-conditioned probe point does exhibit § 2.3's phenomenon
exactly — the two-term projection **PASSES** on two stops whose images differ, and the shipped
four-term identity separates them naming **`hitCount`** — but at a two-frame separation, not one.
`R6` therefore fires and the verdict narrows.

## The reset-removed control, red with its positive beside it

| Arm | Pairwise differing bytes across the jitter triple | Distinct sha256 | Stop terms |
|---|---|---|---|
| full protocol | **0** (0 / 0 / 0) | 1 | identical on every pair |
| reset removed | **401** (199 / 199 / 3) | 3 | `line`, `cycle` differ on every pair |

One step apart, and the step is the monitor-issued hard reset. One honest note is recorded rather
than smoothed: at jitter 0 the control coincided with the positive, because at a 3000 ms free-run
the machine is still inside KERNAL init (`PRE_PROTOCOL pc=$fd7e LIN=0 CYC=4 jiffy=000000`) so its
first anchor hit *is* the first-IRQ-after-power-up state a reset also produces. The red comes from
the 1500 ms and 4000 ms rows.

## The finding worth carrying forward

**A hard reset does not reset the VIC-II raster counter.** The raster phase at the moment of the
reset carries through to the stop. A monitor halt reads `LIN 0` and the reset then starts from a
reproducible phase; a **checkpoint** halt leaves the VIC-II mid-frame, and the stop's `(LIN, CYC)`
inherits that phase, landing on one of two values 6 cycles apart.

That is measured in isolation as the labelled `PREHALT` arm, and it explains `33-10`'s
`CAPTURE_FRAME_EXACT: no` (`line` 154 against 311): an autostarted capture *necessarily* has the
anchor armed and hit before the machine is captured, so it is always in the `PREHALT` situation.
The frame inexactness `33-10` reported beside its `pass` is not release-specific and not a fault
in its script.

**Method rule for later phases: never add a step before the protocol's reset.** This plan's own
first attempt added one — a halt-establishing checkpoint, added for what looked like a good
reason — and turned an `immune` measurement into a `not-immune` one. Under the frozen rule that
would have fired `R3` and banked a `no-go` on an artefact. A control on the method (a run of the
protocol *without* the added step, six runs across the three jitters, all `(257, 57)` and one
sha256) is what caught it.

## `D-18` — the budget, measured and not moved

| Profile | Argv addition | Time-to-bind (ms) | Max | Headroom vs 1000 ms |
|---|---|---|---|---|
| `(absent)` | none | 3132, 3085, 2839, 2792, 2834 | 3132 | −2132 |
| `{warp}` | `-warp` | 2896, 2975, 3117, 3155, 2950 | 3155 | −2155 |
| `{headless}` | `-console` | 2175, 2041, 1956, 2052, 2142 | 2175 | −1175 |
| `{warp, headless}` | both | 2385, 2310, 2026, 1945, 1961 | 2385 | −1385 |

20 of 20 bound, none died, no stderr. `-console` binds **faster** by ~800–1000 ms (skipping GTK
init), and `-warp` makes no measurable difference — so the shortfall is not caused by either new
flag: the argv a stock launch has always emitted is already 2.1 s over. `probeReady` has no retry
loop by design, so `short` means the first post-launch probe pass always misses, never that an
instance is lost. Research's single `-console` observation (unbound at 3000 ms) was **not**
reproduced in ten launches, and is recorded as not reproduced. The budget was not changed
(`T-33-38`); the follow-up is named with the four maxima to size it against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The plan's REPRO-03 construction is not available on this machine**
- **Found during:** Task 2
- **Issue:** The plan specifies "take one stop at anchor hit count `k` and one at `k + 1`" on the
  premise that consecutive anchor hits are one frame apart and therefore share raster coordinates.
  `$ea31` is the KERNAL IRQ entry at 60 Hz against a 50.125 Hz PAL frame, so the premise is false.
- **Fix:** Built and ran the literal control anyway, measured the premise directly (240 anchor
  hits, 240 distinct `(LIN, CYC)`, 0 consecutive repeats), reported the literal form as not
  satisfying the rule, and built a labelled variant at a raster-conditioned probe point that does
  exhibit the phenomenon. Both are in the transcript with the derivation walked conjunct by
  conjunct.
- **Files modified:** `evidence/frame-anchor-probe.mjs`, `evidence/33-repro03-frame-anchor.md`
- **Commit:** `678da05`

**2. [Rule 1 — Bug] The two-checkpoint arming in the first probe design lost two runs**
- **Found during:** Task 2
- **Issue:** The first `reset-removed-probe.mjs` armed a non-temporary anchor *and* a temporary
  target at the same address. VICE deletes a temporary checkpoint on its first hit, so a wait
  keyed on its id never resolved — two 90 s timeouts.
- **Fix:** Reduced to ONE non-temporary Exec checkpoint at the anchor, which is `REPRO-02`'s own
  wording and research M4's own sequence. The voided runs are recorded with this cause.
- **Files modified:** `evidence/reset-removed-probe.mjs`
- **Commit:** `678da05`

**3. [Rule 1 — Bug] A polling wait starved the emulator and voided four runs**
- **Found during:** Task 2
- **Issue:** Every monitor command stops the machine to be serviced and resumes it, so a wait
  implemented as four commands per 700 ms leaves almost no run time. `PC` sat at `$fd80` inside
  RAMTAS's RAM-sizing loop across thirty reads spanning 21 s while an unpolled machine reached
  `READY` in under 4.5 s.
- **Fix:** Every wait now installs its listener before its single resume and then waits with no
  command traffic. The four voided runs and the mechanism are recorded in the transcript and in
  both probes' headers as a "what not to do".
- **Files modified:** `evidence/reset-removed-probe.mjs`, `evidence/frame-anchor-probe.mjs`
- **Commit:** `678da05`

**4. [Rule 2 — Missing critical] A control on this plan's own added step**
- **Found during:** Task 2
- **Issue:** A halt-establishing step added to satisfy the protocol's documented "while halted"
  precondition changed the result from `immune` to `not-immune`. Nothing in the plan asked for a
  control on the plan's own method, and without one a `no-go` would have been banked from an
  artefact.
- **Fix:** Ran the protocol without the added step across all three jitters (six runs, all
  `(257, 57)`, one sha256), confirmed the added step was the confound, made it a labelled
  `PREHALT` arm rather than deleting it, and recorded the mechanism.
- **Files modified:** `evidence/reset-removed-probe.mjs`, `evidence/33-repro02-reset-removed.md`
- **Commit:** `678da05`

**Total deviations:** 4 auto-fixed (3 × Rule 1 — bug, 1 × Rule 2 — missing critical).
**Impact:** All four are within the plan's own deliverables; no shipped source was touched
(`git status --porcelain -- src/mcp/vice/` is empty). Deviation 4 changed a gate input's value from
`not-immune` (which would have fired `R3` → `no-go`) to `immune`, and it did so by measuring the
method rather than by reinterpreting a number.

## Accepted limits recorded in the evidence files

Two, both against frozen text, both recorded in this plan's own files as `SCHEMA.md` § 1 requires:

1. **`SCHEMA.md` § 2.2's aside about an autostarted release** (`33-repro02-reset-removed.md`).
   `JITTER_IMMUNITY` is declared corpus-free and `33-10` measured that `runReproducible()` cannot
   serve an autostarted release at all — its hard `RESET` undoes `AUTOSTART`. There is no
   configuration that both autostarts a release and issues the reset whose necessity `REPRO-02`
   exists to prove. The autostarted side is not unmeasured: `33-03` and `33-10` cover it, and this
   plan supplies the mechanism.
2. **"exactly one frame apart", and the alternative reading** (`33-repro03-frame-anchor.md`). If
   the phrase is read as "an integral number of frames apart" — which is what § 2.3's own stated
   rationale describes — the variant pair satisfies every conjunct and the value is `proven`, `R6`
   does not fire, and `GATE-01` loses a narrowing. The strict reading is taken because `proven` is
   the flattering value and `SCHEMA.md` exists to prevent a measuring plan choosing it. Also
   recorded: § 2.3's control establishes the insufficiency of `(LIN, CYC)` **alone**, which is not
   the same claim as "the frame term is necessary", and `R6`'s narrowing drops the frame term —
   the measurement supports the first and gives no support to the second on this pair.

## Issues Encountered

None outstanding. The four deviations above were all resolved within the plan.

## Verification

| Check | Result |
|---|---|
| All four probes `node --check` | pass |
| `determinism-probe.mjs` imports `STOCK_DETERMINISM_FLAGS` / reaches `vsf-slice` | 3 / 3 occurrences |
| `frame-anchor-probe.mjs` calls `compareStopIdentity` | 3 occurrences |
| Seven outcome lines at column 0 in their declared files | all present, all in domain |
| `BROKER_STATE: inactive` + `TEST_AUTOMATED_BASELINE:` per file | 1 + 1 in all four |
| `^$ ` transcript lines per file (minimum 4 / 6 / 4 / 4) | 13 / 22 / 12 / 7 |
| `git status --porcelain -- src/` | 0 lines |
| Frozen files (`SCHEMA.md`, `DECISION-RULE.md`, `README.md`) | 1 commit each, still `2a8ef95` |
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `cd src/mcp/vice && npm run test:automated` | `tests 3113 / pass 3105 / fail 2`, both in `anno-register.test.ts` — the declared baseline, no regression |
| `node scripts/check-npm-packages.mjs` | exit 0, skills byte-for-byte in sync |
| `D-11` during every retained measurement | `PREFLIGHT_BROKER inactive` and `PREFLIGHT_X64SC (none)` on every run; enforced in code, not by shell habit |

## Next Phase Readiness

`33-12` is the last plan in the phase and now has **all five** `GATE-01` inputs on disk in their
declared source files:

| Input | Value | File |
|---|---|---|
| `SLICER` | `validated` | `evidence/33-slicer-validation.md` (33-07) |
| `SEED_EFFECT` | `pinned` | `evidence/33-repro01-determinism.md` |
| `JITTER_IMMUNITY` | `immune` | `evidence/33-repro02-reset-removed.md` |
| `ORACLE_NECESSITY` | `unproven` | `evidence/33-repro03-frame-anchor.md` |
| `C0_CAPTURE_PAIR` | `pass` | `evidence/33-capture-pair.md` (33-10) |

Walked through `DECISION-RULE.md` in order: `R1` no (`SLICER: validated`), `R2` no
(`pinned`), `R3` no (`immune`), `R4` no (`pass`), `R5` no (`pass`), **`R6` fires**
(`ORACLE_NECESSITY: unproven`) → **`degrade`**, with the `D-04` pre-mapped narrowing to the
two-term `(PC, hit_count)` oracle and the frame term recorded but not asserted. `R7`, `R8` and
`R9` are **not evaluated**. `33-12` must transcribe each value from its declared file by path,
reproduce the rule set verbatim, and record the two accepted limits above — including the
alternative reading of § 2.3, which is the one thing that could move the verdict, and which must
be recorded as an explicit override if taken.

Ready for `33-12`.

## Self-Check: PASSED

Every file this summary claims was created exists on disk, and every commit hash it cites is
reachable.

```
FOUND: evidence/determinism-probe.mjs
FOUND: evidence/33-repro01-determinism.md
FOUND: evidence/reset-removed-probe.mjs
FOUND: evidence/33-repro02-reset-removed.md
FOUND: evidence/frame-anchor-probe.mjs
FOUND: evidence/33-repro03-frame-anchor.md
FOUND: evidence/probeready-probe.mjs
FOUND: evidence/33-probeready-warp-console.md
FOUND: 33-11-SUMMARY.md
FOUND: 1fff362
FOUND: 678da05
FOUND: 01cfae9
```

`git diff --diff-filter=D --name-only 543522c..HEAD` reports **0** deletions across this plan's
commits. `git status --porcelain -- src/` is empty. The three frozen files carry one commit each,
still `2a8ef95`.
