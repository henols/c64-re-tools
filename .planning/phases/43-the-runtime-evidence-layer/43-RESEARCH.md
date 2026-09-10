# Phase 43: The Runtime Evidence Layer - Research

**Researched:** 2026-09-10
**Domain:** Durable runtime-observation storage (SQLite, `node:sqlite`) joined
against a static byte-derived classifier, fed by VICE's text-monitor
`memmapshow`/`memmapzap` commands over the Phase 41 text channel.
**Confidence:** MEDIUM-HIGH — every code-level claim below is read from the
source this session; the one genuinely open empirical question (EVID-06's A/B
outcome) is, correctly, unanswered by design — that is what the phase's first
plan must measure, not what research can assert in advance.

## Summary

Phase 43 adds exactly one new table to `anno-store.ts`'s single `DDL`, a third
independent classifier fed by VICE's `memmapshow`/`memmapzap` text-monitor
commands, and a small set of new `anno_*` verbs registered through the exact
same `buildViceTool()` / `ANNO_TOOL_DEFINITIONS` mechanism the 21 existing
`anno_*` tools already use. No new transport, no new store file, no new
external package. The phase opens on a measurement (EVID-06), not a feature:
whether recording runtime evidence during the v0.8.0-established S3
anchor-counted AUTOSTART sequence disturbs the byte-identical capture that
sequence produces through anchor hit 50. This document names the concrete
anchor address, checkpoint shape, and comparison predicate needed to run that
measurement, because v0.8.0 already built and validated every piece of it —
Phase 43 does not invent a new methodology, it reuses `frame-anchor-probe.mjs`'s
S3 sequence and `capture-predicate.ts`'s `compareCaptures()` verbatim.

The two classifiers this layer must sit beside already exist and already
establish the "reconciliation shape" the roadmap refers to:
`dxa-proof01-compare.ts` is a pure join module — takes two independently
produced classifications as plain data, computes recovered/missed/overlap
buckets with an explicit numerator, denominator and positive class, never
fetches either side itself. The new evidence-vs-block-table disagreement
query (EVID-03) should be built the same way: a new pure module that takes the
store's byte-derived block listing and the new evidence table's rows as plain
inputs and returns agreement-count-first, disagreement-rows-first output,
never mutating either side.

`SCHEMA_VERSION` is 3, and its own doc comment records the exact recorded
justification EVID-02 asks to be fact-checked: "no store file is tracked in
this repository and none exists in its working tree" (as of 2026-08-29, D-15).
A machine-wide filesystem search performed this session found no `.annostore`
file anywhere on this development machine outside a dated (2026-08-27),
clearly-scratch test-probe cache directory (`~/.cache/gsd-probe/c4/...`,
named `t-half.annostore`/`t-zero.annostore`/`p.annostore` — durability-test
fixture naming, not a real project's store). That is not proof no store
exists anywhere in the field, but it is the factual check the requirement
demands, and it comes back empty — supporting a **re-affirmation** of the
strict-equality refusal rather than a migration arm, unless the phase owner
has independent knowledge of a real deployed store.

**Primary recommendation:** Extend `ANNO_TOOL_DEFINITIONS` with the new EVID
verbs (do not open a second registration loop), add one table to the existing
`DDL`, build the disagreement query as a `dxa-proof01-compare.ts`-shaped pure
join module, and run EVID-06's A/B using the S3 sequence and
`compareCaptures()` before writing a single line of the new table's schema.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runtime observation capture (dial `memmapzap`/`memmapshow`, ingest) | MCP server (container-side, proxy-local) | Broker (owns the text-channel dial via Phase 41's serialization authority) | `anno_*` tools never touch VICE transport directly today, but a new *ingest* verb must reach the text channel through the existing `withTextTool()`/`dispatchStock` seam — this is new territory the existing 21 `anno_*` tools do not cover |
| Evidence storage (durable rows, schema) | `anno-store.ts` (the one `node:sqlite` consumer) | — | `anno-seam.test.ts` structurally forbids a second consumer |
| Reconciliation query (agreement/disagreement) | New pure module (MCP server, no I/O) | `anno-store.ts` (supplies both inputs as plain rows) | Follows `dxa-proof01-compare.ts`'s existing shape: the joiner never fetches either side |
| A/B measurement harness (EVID-06) | Evidence script (`.planning/phases/43-.../evidence/`, not shipped code) | `capture-predicate.ts` (the comparison predicate), `stock-protocol.ts`/`broker-launch.mts` (the S3 sequence primitives) | Mirrors Phase 33's `frame-anchor-probe.mjs` exactly — a one-off measurement script, not a shipped feature |
| Bracket identity / reset | Run-identity composite (`argvDigest`, seed) — no new field | — | Roadmap note: bracket folds into argv digest + seed, not a fourth column |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` | Node built-in (project targets Node ≥ 24) | Already the store's only persistence dependency | `anno-store.ts` is the one authorized consumer; no new dependency needed [VERIFIED: src/mcp/vice/anno-store.ts:1-10, header] |

### Supporting

No new supporting libraries are needed. The phase is additive TypeScript
inside the existing MCP server package plus one new `CREATE TABLE` in the
existing `DDL` string.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `ANNO_TOOL_DEFINITIONS` in place | A parallel `EVID_TOOL_DEFINITIONS` array + a second `for` loop in `vice-proxy.ts` | The second loop is structurally identical to the anno loop and would need its own carve-outs in `stock-dispatch.test.ts`'s CR-07 registration test and `capability-registry.test.ts`'s anno-exclusion regex (which today keys specifically on `ANNO_TOOL_DEFINITIONS`'s loop variable, `D-16`/Rule A18 [VERIFIED: src/mcp/vice/capability-registry.test.ts:182-191, quoted below]). Extending the existing array/loop gets both exclusions for free. |

**Installation:** none — no new package.

**Version verification:** N/A — no new package.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** It adds one
`CREATE TABLE` to an existing `DDL` string and new TypeScript modules inside
`src/mcp/vice/`, reusing `node:sqlite` (already the sole store dependency,
audited in prior phases) and the already-shipped text-monitor client from
Phase 41. No `npm install`, no new registry lookup required.

## Architecture Patterns

### System Architecture Diagram

```
 Claude session
      │  vice_memmap_zap / vice_memmap_show   (Phase 42, already shipped)
      │  anno_evid_* (new, this phase)
      ▼
 vice-proxy.ts  ── buildViceTool() ──────────────────────────────┐
      │  (manifest loop: fork/stock VICE tools)                 │
      │  (RESULT_CONTINUE_TOOL: proxy-local, no transport)       │
      │  (ANNO_TOOL_DEFINITIONS loop: proxy-local, SQLite only) ◄┤ new anno_evid_* verbs
      ▼                                                          │
 ┌─────────────────────────┐        ┌───────────────────────────┴──┐
 │ Text-channel dispatch    │        │ runAnnoTool() -> dispatch()   │
 │ (withTextTool/dispatch   │        │  -> anno-store.ts (the ONE   │
 │  Stock, Phase 41's       │        │  node:sqlite consumer)        │
 │  serialization authority)│        └───────────────┬───────────────┘
 └─────────────┬────────────┘                        │
               │ memmapzap (reset bracket)            │ new table's rows
               │ memmapshow (read access map)         │ (run-identity keyed)
               ▼                                      ▼
      textmon-memmap.ts::parseAccessMap()     anno_evid_range / anno_evid_run
      (Phase 42, already shipped, pure)       (new DDL table(s), this phase)
               │                                      ▲
               └────────── ingestion verb ────────────┘
                     (new: reads AccessMap.entries,
                      writes execute=true rows keyed by
                      run identity — never writes "data")

                          ┌───────────────────────────────┐
                          │  New pure join module          │
                          │  (dxa-proof01-compare.ts shape) │
                          │  reads: anno_range (byte-       │
                          │  derived block table) + the     │
                          │  new evidence rows               │
                          │  writes: nothing                 │
                          │  returns: agreement count first, │
                          │  disagreement rows first         │
                          └───────────────────────────────┘
```

### Recommended Project Structure

No new top-level directories. New files live beside their siblings in
`src/mcp/vice/`:

```
src/mcp/vice/
├── anno-store.ts          # DDL gains ONE new table (or two: run + range-observation)
├── anno-types.ts          # new row/type exports beside CommentRow/RangeRow etc.
├── anno-tools.ts          # ANNO_TOOL_DEFINITIONS gains new anno_evid_* entries;
│                          # dispatch() gains new cases; READ_ONLY_ANNO_VERBS
│                          # gains the read-only ones
├── evid-reconcile.ts      # NEW — the dxa-proof01-compare.ts-shaped pure join
│                          # (byte-derived block table vs runtime evidence)
├── evid-ingest.ts         # NEW (or folded into anno-tools.ts's dispatch) —
│                          # turns a parsed AccessMap into store rows
└── package.json           # files[] must list any genuinely new module
```

### Pattern 1: Proxy-local registration via the existing anno_* loop

**What:** Register new verbs by adding entries to `ANNO_TOOL_DEFINITIONS` and
extending `dispatch()`'s switch — not by writing a second registration loop.

**When to use:** Any new tool whose runner never needs `forwardToVice()`,
`call()`, or `ensureViceSession()` and only opens the SQLite store.

**Example (registration, unchanged mechanism):**
```typescript
// Source: src/mcp/vice/vice-proxy.ts:3436-3439 (verbatim structure, cited this session)
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
Adding a new `anno_evid_*` entry to the `ANNO_TOOL_DEFINITIONS` array (defined
in `anno-tools.ts:442`) is picked up by this loop with **zero changes** to
`vice-proxy.ts` itself, and is automatically recognized by:
- `capability-registry.test.ts`'s anno-exclusion regex, which matches
  `for (const X of ANNO_TOOL_DEFINITIONS)` structurally
  [VERIFIED: src/mcp/vice/capability-registry.test.ts:182-191 — quoted: "The anno_* family is not a VICE capability at all (D-16/Rule A18), so it never enters this test's registry-divergence set either way."]
- `stock-dispatch.test.ts`'s CR-07 registration test, which already names
  "the anno_* family" as one of the two exemptions from
  `buildBackendAwareTool()`
  [VERIFIED: src/mcp/vice/stock-dispatch.test.ts:1624 — test title quoted: "structure/proxy (CR-07): the synthetic tools are all registered, and the only registrations bypassing the backend-aware seam are vice_result_continue and the anno_* family"]

A separate `EVID_TOOL_DEFINITIONS` loop would require editing **both** of
those structural tests by hand.

### Pattern 2: The never-throw dispatch boundary (`runAnnoTool`)

**What:** Every `anno_*` verb — including new ones — must resolve, never
reject, wrapping the store open/dispatch/close in one `try/catch` whose
`finally` always closes the handle.

**Example:**
```typescript
// Source: src/mcp/vice/anno-tools.ts:2339-2358 (read this session)
export async function runAnnoTool(name: string, args: unknown): Promise<ToolCallResult> {
  try {
    assertAnnoTool(name, args);
    const storePath = resolveStoreArg(name, args);
    const inodeBefore = assertStorePresent(name, storePath);
    const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: READ_ONLY_ANNO_VERBS.includes(name) });
    try {
      assertSameFile(name, storePath, inodeBefore);
      return okText(JSON.stringify(await dispatch(name, args, handle)));
    } finally {
      closeStore(handle);
    }
  } catch (err) {
    const errName = err instanceof Error ? err.name : "Error";
    const errMessage = err instanceof Error ? err.message : String(err);
    return errText(`${name} failed: [${errName}] ${errMessage}`);
  }
}
```
New read-only verbs (the disagreement query, evidence read-back) must be
added to `READ_ONLY_ANNO_VERBS` (`anno-tools.ts:1676`, currently 10 entries)
so `openStore` opens them with `mustExist: true` and a read-only connection.
Write verbs (ingest, bracket reset) get the existence-check-plus-inode-guard
route `assertStorePresent()` already implements — **no new verb may ever
create the store it was asked to annotate** (D-06, same discipline as every
other `anno_*` writer).

### Pattern 3: The pure-join reconciliation shape (`dxa-proof01-compare.ts`)

**What:** A module that takes two already-fetched classifications as plain
data and computes a join — recovered/missed/overlap-shaped, never a silent
merge — with an explicit `denominator`, `positiveClass` and named "third
bucket" for the ambiguous case.

**When to use:** EVID-03's disagreement query. The existing precedent already
solved the exact problem shape ("two independent classifiers, report where
they disagree, never overwrite either").

**Example (the shape to imitate, not the code to reuse — this module compares
dxa's listing against the byte-derived ground truth, not the runtime evidence
against the block table, but the shape transfers directly):**
```typescript
// Source: src/mcp/vice/dxa-proof01-compare.ts:59-133 (read this session)
export interface Proof01Comparison {
  denominator: number;
  recovered: number;
  missed: number;
  unclassifiedOverlap: number;         // a THIRD bucket -- ambiguous, not a miss
  recoveredAddresses: number[];
  missedAddresses: number[];
  overlapAddresses: number[];
  positiveClass: "data";
  tier: "byte-derived";
}

export function compareByteDerivedRecovery(input: Proof01ComparisonInput): Proof01Comparison {
  const { listing, groundTruth } = input;
  const denominator = groundTruth.certainCode.size + groundTruth.certainData.size;
  // ... buckets addresses into recovered / missed / unclassifiedOverlap,
  // never mutates either input, never re-fetches either side.
}
```
For EVID-03, the new module's shape should be: input = the store's
byte-derived block listing (`anno_range` rows via `listRanges()`) plus the
new evidence table's per-address `executeObserved` rows; output = agreement
count (a single number — never a wall of rows), disagreement rows (byte-derived
`data` at an address the evidence shows `execute: true` — the highest-value
bucket, reported **first**), and a third "no evidence" bucket for addresses
the block table classifies but no run ever touched (this is neither agreement
nor disagreement — it must not be silently folded into either).

### Pattern 4: Reset/epoch-keyed transient state (`stock-timing.ts`'s stopwatch)

**What:** A per-target baseline that is forgotten when the target's identity
(or launch epoch) changes, so a relaunch never inherits a previous instance's
state.

**When to use:** EVID-05's bracket reset-without-leakage requirement.

**Example:**
```typescript
// Source: src/mcp/vice/stock-timing.ts:368-403 (read this session)
let stopwatchBaselines = new Map<string, StoredBaseline>();

export function resetTimingStateForTest(): void {
  stopwatchBaselines = new Map<string, StoredBaseline>();
}

/** Forgets every stored baseline for a target OTHER than the currently active
 * one -- called so a later, unrelated instance sharing the same map cannot
 * see a stale baseline. */
export function forgetTimingForOtherTargets(activeTargetId: string): void {
  for (const targetId of stopwatchBaselines.keys()) {
    if (targetId !== activeTargetId) stopwatchBaselines.delete(targetId);
  }
}
```
`StoredBaseline` carries both the `baseline` sample and `session.baselineEpoch`
— so a `vice_recycle` (which advances the epoch) invalidates a stale reading
even for the *same* `targetId`, without an explicit reset call. This is the
concrete existing pattern for "a bracket can be reset and re-measured without
a previous run's observations leaking into it": key evidence rows by run
identity (which folds in the launch epoch transitively, since `argvDigest`
covers the launch argv and `seed` covers the per-launch nondeterminism pin),
and forget/ignore stale rows the same way `forgetTimingForOtherTargets` does —
never by mutating them in place.

### Anti-Patterns to Avoid

- **Promoting observed execution into the block table under a confidence
  bracket.** Explicitly rejected in the seed (`.planning/seeds/runtime-evidence-layer.md`)
  and re-affirmed in the ROADMAP's Out of Scope notes: it collapses two
  independent classifiers into one, destroys the disagreement signal, and a
  wrong promotion is unrecoverable.
- **A second `node:sqlite` consumer.** `anno-seam.test.ts` scans
  `shippedTsModules()` (derived from `package.json`'s `files[]`) and asserts
  `anno-store.ts` (`THE_ONE_SEAM`) is the only module naming the specifier,
  across all four working access routes (static import, dynamic `import()`,
  `process.getBuiltinModule`, `createRequire(...)("node:sqlite")`)
  [VERIFIED: src/mcp/vice/anno-seam.test.ts:27-140, read this session].
- **Deriving `data` from absence anywhere.** The parser layer already
  enforces this convention (`textmon-memmap.ts`'s header: "Never add a field,
  key, label or enum member anywhere in this module or its answer types that
  classifies an address as DATA on the strength of never having been
  observed" [VERIFIED: src/mcp/vice/textmon-memmap.ts:32-38]) — the new
  evidence table and its read verbs must carry the same discipline forward,
  never regress it.
- **A second registration loop for the new verbs**, when extending
  `ANNO_TOOL_DEFINITIONS` gets both structural test exclusions for free (see
  Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reconciling two independent classifications | A bespoke comparison ad hoc inside a tool handler | The `dxa-proof01-compare.ts`-shaped pure join module | Denominator discipline, "third bucket" handling, and percent-formatting via `formatPercent()` (`dxa-partition.ts:139`) are already solved and tested there |
| Percent/rate formatting | A local `.toFixed(2)` | `formatPercent(numerator, denominator)` | Refuses a zero denominator by name (never prints `0.00`/`NaN`/`100.00`) [VERIFIED: src/mcp/vice/dxa-partition.ts:139-148, read this session] |
| Run identity | A new "scenario" or "bracket" label | The existing `(binary sha256, argv digest, seed)` composite via `argvDigest()` (`capture-predicate.ts:581`) | REPRO-04 already established and measured this triple; a fourth independently-invented notion of sameness is exactly the failure this project's single-seam discipline exists to prevent (ROADMAP note, this phase) |
| Detecting a corrupt/truncated/zero-length store | A custom file-size or header check | `openStore()`'s existing `schema_version` + `pragma integrity_check` refusal path | Already handles the measured "zero-length file opens successfully" SQLite trap [VERIFIED: src/mcp/vice/anno-store.ts:16-30, header] |
| Frame-exact reproducible runs | A new AUTOSTART/checkpoint sequencing scheme for the A/B | The existing S3 sequence (`arm anchor while halted → AUTOSTART → count hits → REGISTERS_GET`, no `RESET` anywhere) | Already measured frame-exact through anchor hit 50, diverging from hit 75 — re-deriving this would repeat Phase 33's whole survey for no reason |

**Key insight:** Every piece this phase needs — the reconciliation shape, the
run-identity composite, the reproducible-run sequence, the percent-formatting
discipline, the store's corruption-refusal path — was already built and
measured in a prior phase. Phase 43's genuinely new work is: one DDL table,
the ingestion verb that turns a parsed `AccessMap` into rows, the
disagreement-query module, and the EVID-06 measurement itself.

## Runtime State Inventory

Not applicable — Phase 43 is not a rename/refactor/migration phase. It is
additive (one new table in an existing store file, new proxy-local tool
verbs). The one adjacent question that *does* require the rename/refactor
discipline — "does an existing `.annostore` in the field need a migration
arm?" — is EVID-02 itself, addressed above under Summary and again below
under Common Pitfalls / Assumptions Log, because it is a **decision to reach
and record** (per REQUIREMENTS.md's "Notes for the roadmapper"), not a schema
migration to write in the general case.

## Common Pitfalls

### Pitfall 1: Assuming EVID-06's "instrumentation on" means a runtime toggle

**What goes wrong:** Designing the A/B around turning memmap tracking "on"
and "off" via a monitor command, when no such toggle exists.

**Why it happens:** The seed document and casual VICE familiarity suggest a
`mm+`/`mm-`-style switch. Official VICE documentation and the `mon_memmap.c`
source say otherwise: `monitor_memmap_store()` **records continuously and
unconditionally** once the binary is built with `FEATURE_CPUMEMHISTORY`
(the same build flag `memmapshow`/`chis` already require, per `PARSE-04`'s
existing `CPUHISTORY_GATED_COMMANDS`). Its only guard is
`memmap_state & MEMMAP_STATE_IN_MONITOR` (skip recording while the monitor
itself is open) — not a start/stop switch. `mon_memmap_zap()` is a full
`memset()` clear, not a pause [CITED: VICE Manual §12 Monitor,
https://vice-emu.sourceforge.io/vice_12.html; mon_memmap.c,
https://github.com/svn2github/vice-emu/blob/master/vice/src/monitor/mon_memmap.c].

**How to avoid:** Frame the A/B as comparing the S3 sequence **with** extra
text-monitor traffic issued during the halted pre-`AUTOSTART` window
(`memmapzap` to arm/reset the bracket) and **without** any such traffic — not
as comparing a build-time flag, since the connected binary already needs that
flag for `memmapshow`/`chis` to work at all (shipped by Phase 42).

**Warning signs:** A plan that tries to launch two different `x64sc` binaries
(one with, one without `--enable-cpuhistory`) for the A/B — that changes two
variables at once (the binary identity itself, which is part of the run-
identity composite) rather than isolating the one thing EVID-06 asks about.

### Pitfall 2: Retrofitting the schema after the A/B instead of before it

**What goes wrong:** Writing the evidence table's DDL first (with a bare
run-identity key), then discovering instrumentation perturbs frame-exactness,
and bolting on an `instrumented: boolean` column afterward as a migration.

**Why it happens:** It is natural to want to see the shape of the data before
deciding how the table should be keyed.

**How to avoid:** EVID-06 is this phase's opening criterion precisely to
prevent this — the ROADMAP itself states "because that is a schema
consequence, the measurement is taken before the table exists rather than
retrofitted onto a shipped key." Run the A/B (an evidence script under
`.planning/phases/43-.../evidence/`, never shipped code) before writing a
single `CREATE TABLE` line for the new table.

**Warning signs:** A plan whose first task is "design the evidence table
schema" rather than "run the EVID-06 A/B and record its verdict."

### Pitfall 3: Treating "no row" and "observed not executing" as the same fact

**What goes wrong:** A percentage or summary computed as
`(addresses with execute=true) / (65536)` — silently treating every
never-touched address as "confirmed not code," which is exactly the
soundness violation EVID-04 forbids.

**Why it happens:** It is the natural, wrong shortcut once evidence rows
exist per address — "if it's not marked executed, count it as not-code."

**How to avoid:** Follow `AccessMap.entries`'s existing sparse-by-design
convention (`textmon-memmap.ts:88-91`, read this session: "`entries` is
SPARSE by design — VICE skips an address with no recorded access with a bare
`continue`... so a shorter `entries` array is evidence, not an error"). Any
new evidence-table percentage must state its denominator explicitly (mirror
`anno-coverage.test.ts`'s banned-key regex,
`/overall|combined|aggregate|composite|score|headline|totalcoverage/i`,
line 601 — add the evidence layer's report keys to an equivalent banned-word
test) and the query surface must have **no code path** that can return
"data" from the runtime classifier — a type-level control, not a runtime
check (make the runtime classifier's own return type a union with no `data`
member at all, e.g. `"code" | "unobserved"` or `"code" | null`, never
`BlockClass`'s three-valued `"code" | "data" | "undefined"`).

### Pitfall 4: A parallel or duplicated store file

**What goes wrong:** Creating a second SQLite file (or a second table set in
a differently-named file) for evidence rows, reasoning that it's a distinct
concern from annotations.

**Why it happens:** The evidence table's write pattern (accumulate rows from
a run, keyed by run identity) looks different enough from the existing
annotation tables (labels, comments, ranges) that a fresh file feels cleaner.

**How to avoid:** `anno-seam.test.ts` mechanically forbids this — one table
added to the existing `DDL` in `anno-store.ts`, never a second store file
(explicit ROADMAP note, and structurally enforced).

### Pitfall 5: A concurrent second bracket corrupting the first via the open handle

**What goes wrong:** Two overlapping runs (or a relaunch racing an in-flight
ingest) write into the SAME store file concurrently, and the "planted
concurrent-reset or relaunch scenario" (EVID-05's criterion 5) reveals a
cross-contamination the sequential-only tests never would have caught.

**Why it happens:** All prior `anno_*` write verbs assume one caller, one
open/close cycle per tool call — never two overlapping writers.

**How to avoid:** Reuse `anno-durability.test.ts`'s existing multi-process
harness shape (a separate spawned OS process, `SIGKILL`ed mid-write, a fresh
process reopens and reads back) but run it with **two distinct run
identities** writing concurrently rather than one, and assert that a
`SIGKILL` mid-ingest for bracket A leaves bracket B's rows untouched and
readable. `anno-store.ts`'s single `commitTransaction()` (`anno-store.ts`,
`function commitTransaction`) is the one commit site every write already
routes through — the new ingest verb must go through the same seam so a
kill mid-ingest leaves the whole insert either fully committed or fully
absent, never a partial row set.

## Code Examples

### The concrete, runnable EVID-06 A/B

**The anchor and checkpoint, exactly as v0.8.0 measured them**
[VERIFIED: `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/frame-anchor-probe.mjs:19` — quoted: "The anchor is `$ea31`, the KERNAL IRQ entry, driven by CIA#1 timer A."; and `.../evidence/33-autostart-sequencing.md:236` — quoted: "`S3` | connect → arm anchor → `AUTOSTART` → count hits → `REGISTERS_GET` | **yes** — the sequence that works | frame-exact and byte-identical to hit 50; diverging from hit 75"]:

```
S3 sequence (no RESET anywhere -- AUTOSTART's own power cycle is the reset):
  1. connect
  2. arm a non-temporary Exec checkpoint at $ea31, stop:true, while halted
  3. AUTOSTART (0xdd), runAfter:true, fileIndex:0, filename=<the release>
  4. count CHECKPOINT_INFO hits from that checkpoint
  5. at a chosen hit count <= 50, REGISTERS_GET, then slice a .vsf snapshot
     to flat 64K via vsf-slice.mjs / vsf-slice.ts
```

**The measured frame-exact boundary**
[VERIFIED: `.../evidence/33-autostart-sequencing.md:541-543` — table quoted:
"frame-anchored, pre-load stop | S3, hits 1 / 10 / 50 | **0** | far under" ...
"frame-anchored, post-load stop | S3, hits 75 / 100 / 200 / 400 | 23 / 12 / 33 / 48 | under"].

**The A/B this phase must run, stated as a pre-committed rule:**
Run the S3 sequence twice at the same hit count `N <= 50` (e.g. `N = 10`, deep
inside the proven-safe window with margin to spare) against the same release
image, same seed:
- **Control run:** exactly the S3 sequence above, no extra text-monitor
  traffic.
- **Instrumented run:** the S3 sequence with one extra command issued during
  the halted pre-`AUTOSTART` window — `memmapzap` (arms/clears the evidence
  bracket) — and, after the stop, a `memmapshow` read before slicing the
  snapshot.

Slice both to flat 64K and compare with the existing, unmodified predicate:
```typescript
// Source: src/mcp/vice/capture-predicate.ts (compareCaptures, read this session
// -- exact export name and signature should be confirmed against the current
// file at plan time; this module is the ONE authoritative comparison site).
```
**Pass/fail rule, fixed before measurement:** if `compareCaptures()` reports
zero differing bytes outside the committed enumerated transient allow-list
between the control and instrumented captures at hit `N`, instrumentation
does not perturb frame-exactness at this depth, and run identity stays the
unmodified `(binary sha256, argv digest, seed)` triple. If any unenumerated
byte differs, instrumentation perturbs the run, and the schema must carry an
`instrumented: boolean` (or equivalent) discriminator on every run-identity
row from the start, with every rendering surface labelling instrumented rows
distinctly rather than mixing them with frame-exact ones.

### The `AccessMap` shape being ingested (Phase 42, already shipped)

```typescript
// Source: src/mcp/vice/textmon-memmap.ts:58-96 (read this session)
export interface AccessFlags {
  readonly read: boolean;
  readonly write: boolean;
  readonly execute: boolean;   // never derived from read -- its own bit
}
export interface AccessMapEntry {
  readonly address: number;
  readonly io: AccessFlags;
  readonly rom: AccessFlags;
  readonly ram: AccessFlags;
  readonly annotations: readonly AccessAnnotation[];
}
export interface AccessMap {
  readonly entries: readonly AccessMapEntry[];  // SPARSE by design
}
export type AccessMapParseResult = { ok: true; value: AccessMap } | { ok: false; refusal: TextParseRefusal };
export function parseAccessMap(text: string): AccessMapParseResult { /* ... */ }
```
The ingestion verb this phase adds should read `AccessMap.entries`, and for
every entry where `ram.execute || rom.execute` is `true`, write (or upsert)
one evidence row keyed by `(run identity, address)`. Entries with `execute:
false` on every flag (read/write-only access) and addresses **absent** from
`entries` entirely are two **different** facts and must never collide in the
new schema — mirror `textmon-memmap.ts`'s own "sparse array is evidence, not
absence" discipline in the new table (e.g., no row at all for an address
`memmapshow` never mentioned; an explicit `execute: false` row only if the
address was mentioned with read/write but not execute — or, more simply,
never write a row for anything except an observed `execute: true`, since that
is the only positive fact the layer is licensed to assert; document whichever
choice is made explicitly, because both are defensible and only one should
ship).

### The store-open / never-create-on-read discipline new write verbs must follow

```typescript
// Source: src/mcp/vice/anno-tools.ts:1693-1707 (read this session)
function assertStorePresent(name: string, storePath: string): number {
  if (!existsSync(storePath)) {
    throw new AnnoStorePathError(
      `${name} refused: no annotation store exists at ${JSON.stringify(storePath)} -- refusing to CREATE one, because "the ` +
        'annotations are gone" and "there are no annotations" must not read the same. Create the store deliberately first.',
      { path: storePath },
    );
  }
  // ... inode identity is captured and compared post-open (WR-04) ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Live read-only `memmapshow` queries with nothing persisted | Durable, run-keyed, accumulating evidence rows in `.annostore` | This phase (EVID-01) | Findings survive the session — the CORE-01 gap the seed named explicitly is closed for runtime evidence, though not for every other kind of ephemeral finding |
| Static-only code/data classification (byte-derived block table) | Byte-derived classification stays authoritative; runtime evidence is a third, independent, never-merged signal | This phase (EVID-03/EVID-04) | Disagreement (bytes say data, execution says code) becomes queryable for the first time |

**Deprecated/outdated:** Nothing in the existing store schema is deprecated
by this phase — it is purely additive at `SCHEMA_VERSION` 3 → a new version
(4), following the exact discipline the version-3 bump (D-15) already
recorded: state whether a migration arm is written, and why, in the same doc
comment style as `SCHEMA_VERSION`'s existing history
[VERIFIED: src/mcp/vice/anno-types.ts:120-186, read this session — quoted
version-3 rationale: "NO MIGRATION ARM WAS WRITTEN, AND THAT IS THE ACCEPTED
COST... The basis measured on the day of the decision: no store file is
tracked in this repository and none exists in its working tree"].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `.annostore` file exists "in the field" for any real c64-re-tools user, based on a filesystem search of this one development machine only | Summary, EVID-02 | If a real user's store does exist somewhere this search could not reach, a "re-affirm the strict refusal" decision would silently strand that user's store at the next schema bump — same cost D-15 already accepted once, but the phase should still record this as a fact-check performed on 2026-09-10 with its scope stated (one machine), not as a global guarantee |
| A2 | Whether new evidence rows should exist only for observed `execute:true` (never for read/write-only or execute:false) is a design choice this research recommends but does not settle | Code Examples | If the phase instead stores a row for every accessed address regardless of execute, the "no row vs observed-not-executing" distinction (EVID-04) still holds, but the table grows much larger and every query must filter on execute explicitly rather than relying on row presence — a planning decision, not a research gap |
| A3 | The registration mechanism recommendation (extend `ANNO_TOOL_DEFINITIONS` in place rather than a second loop) is a design recommendation inferred from how the existing structural tests key on the array/loop name, not a decision already made in any planning document | Architecture Patterns, Pattern 1 | If the planner instead opens a second loop for naming-clarity reasons, `stock-dispatch.test.ts`'s CR-07 test and `capability-registry.test.ts`'s anno-exclusion regex both need a matching edit — a real but bounded cost, not a correctness risk |

**Note on tagging:** Every other claim in this document was verified this
session either by reading the cited source file directly (quoted verbatim
where the provenance rules require it) or via the official VICE manual /
`mon_memmap.c` source (tagged `[CITED: ...]`). Package names: none — no new
packages this phase.

## Open Questions

1. **Does an evidence row get written for `read`/`write`-only access, or only for `execute:true`?**
   - What we know: `AccessMap.entries` carries all three flags per address;
     the layer's only licensed positive class is "observed executing."
   - What's unclear: whether read/write-only rows are useful evidence for a
     *later* extension (e.g. "this address is definitely touched as data,
     never as code, across N runs" — which is still not `data` per EVID-04,
     but might be a useful future signal) or unnecessary storage.
   - Recommendation: store only `execute:true` observations for this phase;
     the schema can add a `read`/`write` observation table later without a
     migration, since it would be a wholly new table (additive, matching the
     store's existing "add a table" discipline at each schema bump).
   - **Decided (plan 43-05):** see `docs/phase43-runtime-evidence-layer.md`'s
     "The one positive fact" section for the shipped answer.

2. **What exact hit count `N` should the EVID-06 A/B use?**
   - What we know: hits 1/10/50 are all measured byte-identical (0 differing
     bytes) in the control condition; hit 50 is the outer edge of the proven
     window.
   - What's unclear: whether the instrumented run's extra command (issued
     while halted, before `AUTOSTART`) could plausibly interact with the
     jitter tolerance differently at different depths.
   - Recommendation: run the A/B at more than one hit count within the safe
     window (e.g. 10 and 50) rather than just one, since the existing S3
     survey already demonstrates behavior can differ meaningfully between
     "just after boot" and "just before the safe boundary."
   - **Answered by measurement (plan 43-01):** the A/B ran at N = 10 and
     N = 50 and came back `no-perturbation` at both depths --
     `docs/phase43-instrumentation-perturbation-ab.md`.

3. **Should the disagreement query (EVID-03) be exposed as a new `anno_*` tool, a CLI verb, or both?**
   - What we know: the existing `anno-coverage.ts` census is exposed via both
     an MCP tool and `vice-mcp anno` CLI verbs (per `anno-cli.ts`).
   - What's unclear: whether this phase needs a CLI route in addition to an
     MCP tool, or whether an MCP-only surface satisfies EVID-03's "a user can
     ask" requirement.
   - Recommendation: MCP tool is required (matches `anno_*` precedent
     directly); a CLI verb is a nice-to-have the planner can scope out if
     time-constrained, since `anno-cli.ts`'s wiring is a known, separate cost.
   - **Decided (plan 43-06):** see `docs/phase43-runtime-evidence-layer.md`'s
     "What shipped" table for the shipped surface(s).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `x64sc` (stock, genuinely unpatched) | EVID-06's A/B, and any live capture this phase's tests exercise | ✓ | `/usr/bin/x64sc`, VICE 3.9 (genuinely unpatched stock; `/usr/local/bin/x64sc` is the non-upstream fork and is first on `$PATH` — must be addressed by absolute path for a real stock test) | — |
| Node.js ≥ 24 | Running the MCP server / tests directly via type-stripping | ✓ (project's existing runtime requirement, unchanged by this phase) | — | — |
| `node:sqlite` | The store, already the sole persistence dependency | ✓ (built into Node ≥ 22, this project's floor is ≥ 24) | — | — |
| VICE broker (systemd user unit) | Any live A/B run or capture needing a managed instance | Must be started manually per CLAUDE.md / project convention (`systemd-run --user --unit=vice-broker ...`) and **stopped** immediately after, since a live broker deterministically reddens `vice-proxy.test.ts` BACK-05 | Manual start/stop is the documented, required workflow — not a gap |

**Missing dependencies with no fallback:** None identified — every tool this
phase needs is already present and already used by prior, shipped phases.

**Missing dependencies with fallback:** None — this phase adds no new
external dependency.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `src/mcp/vice/test-gate.mjs` is the automated-subset selector, not a framework config |
| Quick run command | `node --test anno-store.test.ts anno-tools.test.ts` (scope to the touched files during development) |
| Full suite command | `npm run test:automated` (runs `node test-gate.mjs`, which excludes 12 `MANUAL_ONLY_TESTS` entries) [VERIFIED: src/mcp/vice/package.json:132, src/mcp/vice/test-gate.mjs:129-150, read this session] |

**Known-good baseline is NOT zero.** Per the project owner's standing note
(2026-09-09): `test:automated`'s floor is **3 failures** in
`anno-register`/`anno-import` (one named bookkeeping cause), and an
intermittent 4th failure is a `zz-scratch` ENOENT race, not a regression.
Never pipe `npm test` (the full, non-gated glob) into `tail` — it hangs on
`vice-proxy.test.ts` and reporting `tail`'s exit code fakes a green baseline.
Always redirect and read `$?` on the same line.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVID-01 | Durable, run-keyed, accumulating rows; idempotent re-ingest | unit | `node --test anno-store.test.ts` (extend with new-table cases) | ❌ Wave 0 — new test cases needed |
| EVID-02 | Migration-arm-vs-refusal decision recorded, reached from a factual field check | manual/decision-record | N/A — this is a documentation/decision deliverable, not an automated assertion | ❌ Wave 0 — no test; a decision record (like D-15's own doc comment) is the deliverable |
| EVID-03 | Disagreement-first query; block table never overwritten; agreement reported as a count | unit | `node --test evid-reconcile.test.ts` (new file, mirroring `dxa-proof01-compare.test.ts`'s shape) | ❌ Wave 0 |
| EVID-04 | No `data` from absence; denominators on every summary; type-level "no data branch" | unit + structural | `node --test evid-reconcile.test.ts` plus a structural source-scan test mirroring `anno-coverage.test.ts:601`'s banned-key regex | ❌ Wave 0 |
| EVID-05 | Bracket reset without leakage; concurrent-reset/relaunch safety | unit (multi-process) | `node --test anno-durability.test.ts` (extend with a two-run-identity concurrent case, mirroring the existing SIGKILL harness) | ❌ Wave 0 — extend existing file |
| EVID-06 | A/B measurement; pass/fail rule fixed in advance | manual (live VICE), one-off evidence script | `node .planning/phases/43-.../evidence/evid06-instrumentation-ab.mjs` (new, modeled on `frame-anchor-probe.mjs`) | ❌ Wave 0 — this is the phase's first deliverable, not a unit test |

### Sampling Rate
- **Per task commit:** targeted `node --test <touched-file>.test.ts`
- **Per wave merge:** `npm run test:automated`
- **Phase gate:** Full automated suite at its known 3-failure floor (not 0)
  before `/gsd-verify-work`; EVID-06's live A/B result recorded in the phase's
  findings doc as its own gate, independent of the unit-test suite.

### Wave 0 Gaps
- [ ] `evid-reconcile.test.ts` — covers EVID-03/EVID-04, mirroring
      `dxa-proof01-compare.test.ts`'s existing structure
- [ ] Extend `anno-store.test.ts` — new table's DDL, insert/read/idempotent-reingest
- [ ] Extend `anno-durability.test.ts` — two-run-identity concurrent SIGKILL case (EVID-05)
- [ ] `.planning/phases/43-.../evidence/evid06-instrumentation-ab.mjs` — the
      EVID-06 A/B itself, modeled on `frame-anchor-probe.mjs`
- [ ] A structural banned-key test for the evidence layer's report output,
      mirroring `anno-coverage.test.ts:601`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local single-user tool, no auth surface |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — no multi-tenant concept |
| V5 Input Validation | yes | Same discipline as every existing `anno_*` verb: `assertAnnoTool`, address parsing (`parseStoreAddress`), workspace confinement (`storePathWithinWorkspace`) — all reused, not reinvented |
| V6 Cryptography | no | Run-identity hashing reuses `argvDigest()`'s existing `sha256`, no new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a run-identity or address value reaching raw SQL | Tampering | `anno-store.ts`'s existing discipline: parameterized `prepare().run()` everywhere, never string interpolation into `exec()` — new code must follow the same trap-3 rule the module header states |
| Path confinement escape (a caller-supplied store path reaching outside the workspace) | Tampering / Information Disclosure | `storePathWithinWorkspace()` — already the confinement seam every `anno_*` verb uses; new verbs must not bypass it |
| A malformed/drifted `memmapshow` reply silently absorbed as a plausible-but-wrong evidence row | Tampering (data integrity) | `parseAccessMap()`'s discriminated `AccessMapParseResult` (never throws, `{ok:false, refusal}` on any drift) — the ingestion verb must check `.ok` and refuse rather than write partial/garbled rows |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/mcp/vice/anno-store.ts` — DDL, `SCHEMA_VERSION` refusal logic, module header
- `src/mcp/vice/anno-types.ts` — `SCHEMA_VERSION` history/doc comment (D-15 rationale)
- `src/mcp/vice/anno-tools.ts` — `ANNO_TOOL_DEFINITIONS`, `runAnnoTool`, `dispatch`, `READ_ONLY_ANNO_VERBS`, `assertStorePresent`
- `src/mcp/vice/anno-seam.test.ts` — single-`node:sqlite`-consumer structural assertion
- `src/mcp/vice/anno-durability.test.ts` + `anno-durability-mutator.mjs` — STORE-04's SIGKILL/reopen proof
- `src/mcp/vice/vice-proxy.ts` — `buildViceTool`, `buildBackendAwareTool`, the manifest/anno registration loops
- `src/mcp/vice/capability-registry.ts` + `capability-registry.test.ts` — the anno_* exclusion (D-16/Rule A18)
- `src/mcp/vice/stock-dispatch.test.ts` — CR-07 registration-exemption test
- `src/mcp/vice/textmon-memmap.ts` — `AccessMap`/`AccessFlags`/`parseAccessMap`, sparse-by-design and no-data-from-absence discipline
- `src/mcp/vice/text-tools.ts` — `handleMemmapShow`, existing capability-probe wiring
- `src/mcp/vice/capture-predicate.ts` — `argvDigest`, run-identity digest discipline
- `src/mcp/vice/block-class.ts` — `BlockClass`/`BlockClassifier` (existing store-derived classifier)
- `src/mcp/vice/dxa-proof01-compare.ts` + `dxa-partition.ts` — the reconciliation-shape precedent, `formatPercent`
- `src/mcp/vice/stock-timing.ts` — epoch-keyed bracket/baseline reset pattern
- `.planning/phases/33-.../evidence/frame-anchor-probe.mjs` + `33-autostart-sequencing.md` — the S3 sequence and its measured frame-exact boundary
- `.planning/milestones/v0.8.0-REQUIREMENTS.md` — REPRO-01..05 verbatim
- `.planning/seeds/runtime-evidence-layer.md` — the decided design and its two rejected alternatives
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 43/44 sections), `.planning/STATE.md` — phase scope and dependencies
- `CLAUDE.md` — project constraints, live-VICE testing facts

### Secondary (MEDIUM confidence)
- VICE Manual §12 Monitor (`https://vice-emu.sourceforge.io/vice_12.html`) — `memmapshow`/`memmapzap`/`memmapsave` command documentation
- `mon_memmap.c` source, via `WebFetch` (`https://github.com/svn2github/vice-emu/blob/master/vice/src/monitor/mon_memmap.c`) — confirms unconditional recording, no on/off toggle, `mon_memmap_zap()` as the only reset

### Tertiary (LOW confidence)
- `docs/vice-mcp-ideas.md` — per standing project memory, already explored and partially measured false; not relied on for any claim in this document beyond what the seed (which supersedes it) already states

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, everything reuses already-shipped, already-tested code
- Architecture: HIGH — the registration mechanism, store DDL pattern, and reconciliation shape all have direct, read-this-session precedent
- Pitfalls: HIGH for the mechanical ones (store duplication, absence-as-data, retrofit-after-measurement); MEDIUM for the EVID-06 perturbation question itself, which is correctly unresolved pending the phase's own measurement
- EVID-02 factual check: MEDIUM — a real, executed filesystem search on this machine, but scoped to one machine and cannot rule out a store existing elsewhere in the field

**Research date:** 2026-09-10
**Valid until:** 30 days (stable, in-repo code); the EVID-06 measurement itself has no expiry — once run, its verdict is a permanent fact about this VICE version's behavior, not a time-sensitive one
