# The Runtime Evidence Layer

This document records what the runtime evidence layer actually shipped: its
four surfaces, the single positive fact it is licensed to assert, the four
buckets its reconciliation query reports, how a run is identified, and the
limits accepted along the way -- named rather than smoothed over. It does not
restate EVID-06's A/B verdict; that verdict lives in
`.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md` and is cited here by
reference, so there is exactly one place it can go stale and exactly one
place it gets corrected.

## What shipped

| Surface | Name | Landed in |
|---|---|---|
| MCP verb (write) | `anno_evid_ingest` | plan 43-05 |
| MCP verb (read) | `anno_evid_disagreements` | plan 43-06 |
| MCP verb (read) | `anno_evid_runs` | plan 43-06 |
| MCP verb (write) | `anno_evid_reset` | plan 43-06 |
| Stock-only MCP tool | `vice_memmap_zap` | plan 43-03 |
| CLI verb | `evid-disagreements` (`vice-mcp anno evid-disagreements --store FILE [--json]`) | plan 43-06 |
| Store table | `anno_evid_exec` (`SCHEMA_VERSION` 4) | plan 43-02 |
| Pure module | `evid-reconcile.ts` (`reconcileObservedExecution()`) | plan 43-04 |
| Pure module | `evid-ingest.ts` (`execObservationsFrom()`, `runIdentityFrom()`, `ingestAccessMap()`) | plan 43-05 |

All four `anno_evid_*` verbs register through the existing `ANNO_TOOL_DEFINITIONS`
array and its single registration loop -- never a second loop, never a second
`node:sqlite` consumer. `vice_memmap_zap` is advertised on the stock backend
only, and clears VICE's own accumulated memory-access map through the shipped
text-monitor channel. `evid-disagreements` renders the same reconciliation an
agent gets from `anno_evid_disagreements`, as text, for a human reading a
terminal instead of a JSON answer.

## The one positive fact

A row exists in `anno_evid_exec` if and only if an execute bit was observed at
that address, in that source bank (`ram`, `rom`, or `io`), during that run.
Read-only and write-only observations are not stored -- an address `memmapshow`
reported with read or write access but no execute produces no row, exactly
the same as an address the reply never mentioned at all. Those are two
different facts (`memmapshow` never asserting anything about an address, and
`memmapshow` asserting the address was accessed but never executed), and the
evidence layer stores neither of them, because storing either would invite a
reader to treat "no row" as meaning something more specific than it does.

The absence of a row is the absence of an assertion. It is never an assertion
that the address is data. A future table could add read/write observations
additively -- a new table, a new column set, never a retrofit onto
`anno_evid_exec`'s existing rows -- if a later need for that signal arrives;
nothing here forecloses it, and nothing here builds it before it is needed.

## The four buckets

`reconcileObservedExecution()` (`evid-reconcile.ts`) joins the byte-derived
block table against `anno_evid_exec`'s rows into four named populations,
never a single blended figure:

1. **Disagreement** -- the block table classifies an address as data, and the
   evidence layer holds an observed execute there. Reported first, as rows:
   this is the one output the whole query exists to surface, proof that a
   byte-derived guess was wrong from a source that never saw the guess.
2. **Agreement** -- the block table classifies an address as code, and the
   evidence layer confirms it. Reported as a count only, never as rows, so a
   wall of agreeing rows can never bury the disagreements above it.
3. **Block-covered, never observed** -- the block table classifies the
   address and no run's observations ever recorded it executing. Neither
   agreement nor disagreement folds this population in: an address never
   observed executing proves nothing about whether it is code or data.
4. **Observed outside any block / observed at an explicitly undefined
   block** -- two further counts naming evidence about addresses the block
   table does not classify as code or data at all, so the query's own
   denominator can never quietly drop real evidence while claiming to
   account for it.

Summing these four buckets tells a reader what the byte-derived block table
covers. It never tells a reader what the program actually is -- the block
table's own coverage is not the same claim as the program's full extent, and
no rendering in this layer conflates the two.

## Run identity

Every `anno_evid_exec` row and every write verb's identity argument is keyed
by the same bare composite: an image sha256, an argv digest, and a
determinism seed. The digest itself is computed at exactly one site --
`evid-ingest.ts`'s `runIdentityFrom()`, which calls the project's single
`argvDigest()` function (`capture-predicate.ts`) over the caller's exact
launch argv and never accepts a pre-computed digest as an argument. Both
`anno_evid_ingest` and `anno_evid_reset` route through this same function, so
there is one place a run becomes an identity, not two that could disagree.

Whether this composite needed a fourth, run-class-shaped column was an open
question this phase measured rather than assumed, and the answer is recorded
in `.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md`. That document is the
one place the measurement, its rule, and its selected schema consequence
live; this section points at it rather than repeating any of the three.

## Accepted limits

Named individually, because a limit smoothed into a paragraph is a limit the
next reader will not notice:

1. **The A/B's authority is narrowed to this project's own dials.** The
   measurement in `.planning/phases/43-the-runtime-evidence-layer/evidence/phase43-instrumentation-perturbation-ab.md` licenses
   a claim about the two text-monitor commands this layer itself issues, at
   the anchor hit depths it actually ran. It says nothing about a VICE build
   without the capability `memmapshow`/`chis` already require, and nothing
   about a different perturbation source a later phase might introduce --
   launching a second, differently-configured binary to reach either
   question was explicitly rejected, because that would move the binary's
   own identity (part of the run-identity composite) at the same time,
   answering a different question than the one asked.
2. **The schema carries no run-class discriminator, by design, and that is
   accepted debt.** Because the measured verdict selected the narrower of
   two possible schemas, `anno_evid_exec` has no column distinguishing an
   instrumented run from an uninstrumented one. A later phase that finds a
   genuinely different perturbation source faces a one-way schema bump this
   phase's own decision already named as the cost of not inventing a column
   for a phenomenon this measurement did not observe.
3. **`vice_memmap_zap`'s own disabled-build stub text was never
   source-traced.** Its build-capability verdict is borrowed by classifying
   `vice_memmap_show`'s reply instead of asserting anything unverified about
   `memmapzap`'s own text on a build lacking the required capability --
   `memmapzap` was deliberately kept off the gated-command list that drives
   that classification, so it never makes a claim about text this project
   has not read.
4. **A bracket reset is two operations, not one.** `vice_memmap_zap` clears
   the emulator's own accumulated access map; `anno_evid_reset` clears the
   store's rows for one run identity. Neither call implies the other, and a
   caller re-measuring a bracket from nothing must perform both.
5. **The schema-version reaffirm-refusal's factual basis is one machine's
   filesystem.** `SCHEMA_VERSION`'s own VERSION 4 paragraph (`anno-types.ts`)
   records a dated, four-part check -- a filesystem search, this
   repository's git history, release-tag dates, and an explicit statement of
   scope -- that found no real deployed store, and re-affirms the existing
   strict-equality refusal on the strength of that null result. The check is
   scoped to the one development machine it ran on and is not a claim that
   no such store exists anywhere in the field.
6. **The two-dial design's "confirmed-empty" treatment is scoped to one
   handler.** A `memmapshow` dialed immediately after a real `memmapzap`, in
   the same locked session with the CPU halted throughout, was live-measured
   to always return a header with zero data lines -- the parser's own
   refusal code for an ambiguous, possibly-truncated reply. `vice_memmap_zap`'s
   own handler treats that one code, in that one handler, as a confirmed-empty
   map, because its own two-dial sequence structurally rules out the
   ambiguity that refusal exists to guard against. `vice_memmap_show`, dialed
   by an arbitrary caller with no such guarantee, keeps the general refusal
   unchanged.

## What this layer does not claim

The union of observations across however many runs have contributed evidence
is never exhaustive, and is never presented as complete coverage of the
image. No percentage, rate, ratio, or fraction figure exists anywhere in this
layer's answers -- every count travels beside the denominator it is a
fraction of, and a reader who wants a rate forms it themselves. The
byte-derived block table remains the authoritative classifier it always was;
it was never written by an observation, and no verb in this layer writes to
it.
