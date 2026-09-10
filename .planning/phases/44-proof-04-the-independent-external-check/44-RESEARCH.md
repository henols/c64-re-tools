# Phase 44: PROOF-04 — The Independent External Check - Research

**Researched:** 2026-09-10
**Domain:** Live VICE binary-monitor/text-monitor measurement; byte-derived vs. runtime-observed classification reconciliation; internal `.annostore` evidence layer
**Confidence:** HIGH

## Summary

This phase does not require new engineering machinery — it requires *exercising*
machinery that Phases 41-43 already shipped, against real cracked code, and
recording the result with the same evidence discipline Phase 38 used for
`PROOF-01`. The oracle side (`vice_memmap_show`/`memmapshow`'s execute bit,
durably captured into `anno_evid_exec` via `anno_evid_ingest`) and the join side
(`reconcileObservedExecution()`, exposed as `anno_evid_disagreements` and the
`vice-mcp anno evid-disagreements` CLI) shipped complete in Phase 43, purpose-built
for exactly this question
[VERIFIED: src/mcp/vice/evid-reconcile.ts:9-16] — *"an address the byte-derived
block table calls `data` AND the emulator was observed executing is the single
highest-value output this whole evidence layer can produce -- proof that a
byte-derived guess was wrong, from a source (real execution) that never saw the
guess."* `EvidReconciliation.disagreementCount`, together with its
`disagreements` rows, **is** the false-positive count Success Criterion 1 asks
for; nothing needs to be built to compute it, only fed.

**Primary recommendation:** Reuse `danish.d64` / `BRUCE LEE   (DC)` — the exact
corpus and entry `PROOF-01` already measured
[VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md:70-94]
— drive a live, genuine `/usr/bin/x64sc` (stock VICE 3.9, confirmed present on
this host: `x64sc (VICE 3.9)` [VERIFIED: `/usr/bin/x64sc --version` output,
this session]) through the same S3 frame-anchored `AUTOSTART` sequence Phase 43's
EVID-06 A/B already proved does not perturb the capture at anchor hit depths of
10 and 50, dial `memmapzap` before the anchor arm and `memmapshow` at or before
hit 50, capture dxa's classification of the same release **in a wholly separate
process that never touches the emulator**, and join the two through
`reconcileObservedExecution()` — never re-implemented, never hand-rolled. Stay
at or under anchor hit 50; a run reaching past hit 75 has already left the
region EVID-06 licenses any frame-exactness claim about
[VERIFIED: .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md:236]
— *"`S3` | connect → arm anchor → `AUTOSTART` → count hits → `REGISTERS_GET` |
**yes** — the sequence that works | frame-exact and byte-identical to hit 50;
diverging from hit 75"*.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROOF-04 | `PROOF-01` gains the independent external check it shipped without, using observed execution as the oracle, so its false-positive count becomes computable for the first time rather than structurally uncomputable [VERIFIED: .planning/REQUIREMENTS.md:63]. | The oracle (`memmapshow`→`anno_evid_ingest`), the subject (dxa/Ghidra static classification), and the join (`reconcileObservedExecution()`/`anno_evid_disagreements`) all ship today (Phases 41-43). This research locates each, confirms the join produces exactly the requested count/denominator/positive-class shape, and settles the structural-independence mechanism, the depth bound, and the `not-exercised` escape shape. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Execution oracle capture (`memmapshow`) | Emulator process (`x64sc`'s own `monitor_memmap_store()`, continuous once `FEATURE_CPUMEMHISTORY` is present) | MCP/text-monitor surface (`vice_memmap_show`/`vice_memmap_zap`) | The access map lives inside VICE's own memory; the MCP tool only dials the text channel and parses the reply. |
| Runtime evidence durability | Annotation store (`.annostore`, `anno_evid_exec`, `SCHEMA_VERSION` 4) | MCP write verb (`anno_evid_ingest`) | Already shipped in Phase 43 specifically so a session does not have to re-run the emulator to re-query evidence. |
| Static classification (the subject) | Host process (dxa disassembler, invoked via the `dxa.disassemble` host-tool seam) | Ghidra (`ghidra.analyze`, optional strengthening) | Runs entirely offline against the static `.prg`/image bytes; has no VICE dependency and must have none, for Criterion 2. |
| Reconciliation / join | Pure module (`evid-reconcile.ts`'s `reconcileObservedExecution()`) | CLI (`vice-mcp anno evid-disagreements`) / MCP verb (`anno_evid_disagreements`) | A pure function over two already-fetched arrays; never opens a store, transport, or child process itself [VERIFIED: src/mcp/vice/evid-reconcile.ts:47-52]. |
| Structural independence enforcement | Process/script boundary (two separate driver scripts, each with its own committed source file) | Automated structural test (import-grep, mirroring `textmon-memmap.ts`'s own purity test) | The codebase already has this exact convention for asserting a module never imports a sibling it must stay independent of. |
| Live emulator launch | Host launcher (`probe-harness.mjs`'s `buildProbeArgs()`/`spawnVice()`, direct-spawn, no broker) | — | Every prior evidence-gathering plan in this milestone (33, 38, 39, 43) used this same harness rather than the production broker, because a measurement needs a controlled, single-purpose process lifecycle. |

## Standard Stack

This phase installs no new packages and adds no new library dependency. The
"stack" is entirely in-repo, already-shipped modules and already-installed host
tools. Listed here as the equivalent of a Standard Stack table, each cited to
where it was read this session:

### Core (already shipped, reused unchanged)

| Module / Tool | Where | Purpose | Why Standard (for this phase) |
|---|---|---|---|
| `textmon-memmap.ts` | `src/mcp/vice/textmon-memmap.ts` | Parses `memmapshow`'s framed text reply into a structured, sparse `AccessMap`; never classifies an absent address as data [VERIFIED: src/mcp/vice/textmon-memmap.ts:41-46]. | THE ONE owning module for this wire format (PARSE-01/PARSE-03); re-parsing it here would duplicate a purity-tested, fixture-pinned module. |
| `evid-ingest.ts` | `src/mcp/vice/evid-ingest.ts` | Turns a parsed `AccessMap` plus a run identity into `EvidExecRow[]`, writing a row only for an observed execute bit [VERIFIED: src/mcp/vice/evid-ingest.ts:11-15]. | THE ONE PLACE a parsed reply becomes durable-store-shaped rows (EVID-01/EVID-04). |
| `evid-reconcile.ts` | `src/mcp/vice/evid-reconcile.ts` | Pure join of a `BlockEntry[]` classification against `EvidExecRow[]` observations into four named, denominator-carrying buckets [VERIFIED: src/mcp/vice/evid-reconcile.ts:58-76]. | This is the false-positive computation Criterion 1 asks for — built in Phase 43, unexercised on real code until this phase. |
| `block-class.ts` | `src/mcp/vice/block-class.ts` | The one place a store block-type string (or a bare `"code"`/`"data"`/`"undefined"` literal) becomes the neutral three-valued `BlockClass` [VERIFIED: src/mcp/vice/block-class.ts:157-185]. | Already handles a raw `"code"`/`"data"` `BlockEntry.type` with no store involvement at all — see Open Question 1 below. |
| `dxa-partition.ts` | `src/mcp/vice/dxa-partition.ts` | The byte-derived ground-truth partition dxa already produces for a `.prg`; used unmodified by Phase 38's own driver [VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md:41-53]. | Reuse, don't re-derive: dxa's own code/data split for `BRUCE LEE` is already measured (`code=67 data=45005 unclassified=0 covered=45072`). |
| `probe-harness.mjs` | `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs` | `buildProbeArgs()`, `spawnVice()`, `connectWithRetry()`, `armStoppingExec()`, `resumeExecution()`, `reapAll()` — the shipped direct-spawn harness every evidence plan since Phase 39 reuses [VERIFIED: .planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs:127-138]. | This is "the shipped broker/launcher route" for a controlled measurement — inventing a second harness would duplicate proven flag-order and lifecycle handling. |
| `STOCK_DETERMINISM_FLAGS` | `src/mcp/vice/broker-launch.mts:133` | The frozen determinism flag set (`-seed`, `-raminitstartrandom 0`, etc.) `buildProbeArgs()` appends to every probe launch. | Same determinism inputs `PROOF-01`'s corpus run and EVID-06's A/B both used; a different flag set would make the new run not comparable. |
| `vsf-slice.mjs` | `src/skills/c64-ram-capture/scripts/vsf-slice.mjs` | Slices a `.vsf` snapshot to flat 64K, if a capture-pair comparison against a v0.8.0 capture is wanted. | Already the one slicing tool this project ships (`c64-ram-capture` skill). |

**Version verification:** No package versions apply (no npm/pip/cargo package is
installed). The one external binary this phase depends on, `/usr/bin/x64sc`, was
probed live this session: `x64sc (VICE 3.9)` — the genuine unpatched stock build,
not the fork that shadows a bare `x64sc` on `$PATH`
[VERIFIED: `/usr/bin/x64sc --version`, run this session; `command -v x64sc` /
`which x64sc` both resolve to `/usr/local/bin/x64sc`, the fork, confirming the
shadowing CLAUDE.md documents].

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every module and
tool it depends on already ships in this repository (`src/mcp/vice/*.ts`) or is
an already-detected host binary (`x64sc`, `dxa`, optionally `Ghidra`) reached
through the project's existing "detect, then refuse by name with the remedy"
discipline. No `npm view`, `pip index versions`, or `cargo search` check is
needed because no new dependency is proposed anywhere in this research.

## Architecture Patterns

### System Architecture Diagram

```
  SUBJECT PRODUCER (never touches VICE)          ORACLE PRODUCER (never touches dxa/Ghidra)
  ------------------------------------           --------------------------------------------
  danish.d64 (static bytes)                      /usr/bin/x64sc (genuine stock 3.9, resolved
       |                                          by absolute path, never bare "x64sc")
       v                                               |
  extractEntry("BRUCE LEE   (DC)")                      v
       |                                          buildProbeArgs() + STOCK_DETERMINISM_FLAGS
       v                                          (probe-harness.mjs, direct spawn, no broker)
  runDxaDisassemble() (dxa-partition.ts,               |
    host_tool seam, dxa binary)                        v
       |                                          connect binary + text monitor sockets
       v                                                |
  BlockEntry[] { start,end,type:"code"|"data" }         v
       |                                          arm STOPPING Exec checkpoint at $ea31 (halted)
       |                                                |
       |                                          memmapzap  (clear VICE's own access map)
       |                                                |
       |                                          AUTOSTART runAfter:true fileIndex:0
       |                                                |
       |                                          count CHECKPOINT_INFO hits to N <= 50,
       |                                          exactly one resume per hit
       |                                                |
       |                                          memmapshow  (dial, BEFORE any RESET)
       |                                                |
       |                                          parseAccessMap() (textmon-memmap.ts, pure)
       |                                                |
       |                                          execObservationsFrom() (evid-ingest.ts, pure)
       |                                                |
       |                                          EvidExecRow[] { address, sourceBank }
       |                                                |
       +--------------------+      +------------------+
                             |      |
                             v      v
                    reconcileObservedExecution({ blocks, observations })
                       (evid-reconcile.ts -- pure, fetches nothing, never
                        opens a store or a socket itself)
                             |
                             v
                    EvidReconciliation
                    { disagreements[], disagreementCount, agreementCount,
                      blockCoveredNeverObservedCount, observedOutsideAnyBlockCount,
                      observedAtUndefinedBlockCount, denominator, positiveClass:"code" }
                             |
                             v
                    evidence/proof04-*.md
                    (PROOF04_FALSE_POSITIVES = disagreementCount / denominator,
                     stated BESIDE PROOF01_DATA_RECOVERY_PCT: 100.00 (24/24),
                     FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134),
                     PIVOT_PUBLISHED_DATA_RECOVERY_PCT: 72.46 (100/138))
```

A reader can trace the primary use case end to end: static bytes enter the left
column and never touch VICE; the live binary enters the right column and never
touches dxa; the two converge only inside `reconcileObservedExecution()`, which
takes plain arrays and touches neither producer's process.

### Recommended Project Structure

Mirror Phase 38's evidence-directory convention exactly (same phase family, same
discipline):

```
.planning/phases/44-proof-04-the-independent-external-check/
├── 44-RESEARCH.md          # this file
├── 44-0N-PLAN.md / SUMMARY.md
└── evidence/
    ├── README.md            # evidence conventions (broker-inactive check, TEST_AUTOMATED_BASELINE, etc. -- copy Phase 38's convention 1-5)
    ├── SCHEMA.md            # the not-exercised / shortfall derivation rule, stated BEFORE any run (mirrors Phase 38's proof02 rule)
    ├── proof04-subject-dxa.mjs      # SUBJECT producer -- imports ONLY dxa-partition.ts / host-tool seam; must import NOTHING from text-protocol.ts, textmon-memmap.ts, evid-ingest.ts, or any VICE transport module
    ├── proof04-subject-dxa.json     # committed or cache-path artifact, sha256-named in the .md record
    ├── proof04-oracle-memmap.mjs    # ORACLE producer -- imports ONLY probe-harness.mjs / textmon-memmap.ts / evid-ingest.ts; must import NOTHING from dxa-partition.ts, block-class.ts, or the annotation store
    ├── proof04-oracle-memmap.json   # committed or cache-path artifact, sha256-named
    ├── proof04-reconcile.mjs        # JOIN -- imports ONLY evid-reconcile.ts, reads the two JSON artifacts above by path, calls reconcileObservedExecution(), never re-derives either side
    ├── proof04-independence.test.ts # STRUCTURAL test: greps proof04-subject-dxa.mjs's own source for a forbidden import list and proof04-oracle-memmap.mjs's own source for its forbidden list; fails if either producer imports from the other's domain
    └── proof04-false-positives.md   # the recorded outcome lines, PROOF01/FIXTURE/PIVOT figures cited beside the new number, never re-derived
```

### Pattern 1: The two-producer, hash-pinned handoff (structural independence, Criterion 2)

**What:** Two separately-invoked Node scripts, each importing only its own
domain's modules, each writing a JSON artifact and printing/recording that
artifact's own sha256; a third script (or the shipped `evid-disagreements` CLI)
reads both artifacts by path and performs the join. Neither producer script ever
imports, requires, or dynamically `import()`s a module from the other's domain.

**When to use:** Exactly here — Criterion 2 requires independence to be
"asserted structurally rather than promised." A shared annotation store that
both a dxa-import step and a live-run ingest step write into, opened by the same
process, does not by itself prove independence; a caller could (accidentally or
not) read one side while producing the other. Two separate processes each
reading only their own domain's inputs, with an automated import-purity test on
each, is checkable.

**Example (the purity-test convention this codebase already uses, adapted):**
```typescript
// Source: this codebase's own convention, textmon-memmap.ts's own header
// (VERIFIED: src/mcp/vice/textmon-memmap.ts:18-22):
//   "Never import anything -- not `node:` anything, not `text-protocol.ts`,
//   not `textmon-fixtures.ts`, not even a type-only import of a sibling
//   module. Purity is asserted mechanically by this file's own test (reads
//   this module's source, greps for a top-level `import`)"
// proof04-independence.test.ts, adapted to two producer scripts instead of one:
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("subject producer never imports the oracle's domain", () => {
  const src = readFileSync("evidence/proof04-subject-dxa.mjs", "utf8");
  for (const forbidden of ["text-protocol", "textmon-memmap", "evid-ingest", "probe-harness"]) {
    assert.equal(src.includes(forbidden), false, `subject producer imports ${forbidden}`);
  }
});

test("oracle producer never imports the subject's domain", () => {
  const src = readFileSync("evidence/proof04-oracle-memmap.mjs", "utf8");
  for (const forbidden of ["dxa-partition", "block-class", "anno-store"]) {
    assert.equal(src.includes(forbidden), false, `oracle producer imports ${forbidden}`);
  }
});
```

### Pattern 2: Feed `reconcileObservedExecution()` directly, bypass the annotation store for `blocks`

**What:** Build `BlockEntry[]` in memory from dxa's own partition (`type: "code"`
for dxa's code addresses, `type: "data"` for dxa's data addresses), never routing
it through `anno_set_data_type`/`anno_import_ghidra_export` into a `.annostore`
file at all.

**When to use:** `block-class.ts`'s production classifier, `blockClassAt`,
already accepts a bare `{ start_address, end_address, type: string }` and maps
literal `"code"`/`"undefined"` to their classes and **everything else** — which
includes a bare `"data"` literal — to `"data"`
[VERIFIED: src/mcp/vice/block-class.ts:167-185, quoted: `if (block.type === "code") return "code"; if (block.type === "undefined") return "undefined"; ... return "data";`].
This means the subject side never needs a populated `.annostore` at all: a
producer script that runs dxa, reads `partitionByteDerived()`'s output, and
writes `BlockEntry[]` literals directly satisfies `evid-reconcile.ts`'s own input
contract with zero store dependency — one fewer shared resource for the
independence argument to reason about, and it matches `evid-reconcile.ts`'s own
stated trap: "NEVER fetch either side here... this module never opens a store"
[VERIFIED: src/mcp/vice/evid-reconcile.ts:49-52].

**Example:**
```typescript
// Source: derived from dxa-partition.ts's ByteDerivedPartition shape
// (VERIFIED: src/mcp/vice/dxa-partition.ts:447-462) and block-class.ts's
// BlockEntry contract (VERIFIED: src/mcp/vice/block-class.ts:113-117).
import { runDxaDisassemble } from "./host-tool.ts"; // or the dxa CLI wrapper Phase 38's driver used
import type { BlockEntry } from "../../src/mcp/vice/block-class.ts";

// dxa's own listing already reports per-address code/data classification
// (Phase 38's own driver: "runDxaDisassemble: code=67 data=45005
// unclassified=0 covered=45072" -- VERIFIED: proof01-dxa-real-release.md:43)
function blocksFromDxaListing(listing: DxaListing): BlockEntry[] {
  return listing.entries.map((e) => ({
    start_address: e.address,
    end_address: e.address, // or merged runs, if the listing groups them
    type: e.classification === "code" ? "code" : "data",
  }));
}
```

### Anti-Patterns to Avoid

- **Re-implementing the join:** `reconcileObservedExecution()` already produces
  the exact bucket shape Criterion 1 and Criterion 3 need (disagreement rows
  first, agreement as a count only, two more named "not evidence of data"
  counts, an explicit `denominator`). Writing a second comparison anywhere
  reopens exactly the boundary `evid-reconcile.ts`'s own header exists to close.
- **Treating `blockCoveredNeverObservedCount` as anything but a count:**
  `evid-reconcile.ts` states this explicitly — "an address never observed
  executing proves nothing about whether it is code or data"
  [VERIFIED: src/mcp/vice/evid-reconcile.ts:117-121]. A plan that reports "N
  addresses confirmed data" from this bucket violates Criterion 3's
  "absence is never converted into `data`" directly.
- **Running the anchor past hit 50 and still claiming frame-exactness:** see
  Common Pitfall 1 below.
- **Using a non-stopping checkpoint to sample additional addresses:** see
  Common Pitfall 2 below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Parsing `memmapshow`'s text reply | A second regex-based parser | `textmon-memmap.ts`'s `parseAccessMap()` | Purity-tested, fixture-pinned against both real captures and the fork's own three trailer annotations; already handles the leading-echo-prompt vs. trailing-prompt asymmetry. |
| Turning a parsed map into durable rows | A second write path into `.annostore` | `evid-ingest.ts`'s `execObservationsFrom()` / `anno_evid_ingest` | Already enforces "row only on an observed execute bit, never on read/write-only or absence" — re-deriving this risks silently writing a row for a non-execute access. |
| Computing the disagreement count | A hand-rolled address-by-address diff loop | `evid-reconcile.ts`'s `reconcileObservedExecution()` | Already produces all four named buckets with a correct denominator; a hand-rolled diff is exactly the kind of "second comparison site" this project's own conventions (see `block-class.ts`'s header) exist to forbid. |
| Launching a controlled, deterministic stock VICE run | A new spawn/argv-building routine | `probe-harness.mjs`'s `buildProbeArgs()`/`spawnVice()`/`connectWithRetry()` | Already encodes the `-default`-before-`-binarymonitor` flag-order hazard and `STOCK_DETERMINISM_FLAGS`; reused unchanged by Phases 39, 41, 42, 43. |
| Deciding what counts as a "shortfall" vs. `not-exercised` | A new ad hoc prose judgment call | Phase 38's `proof02-computed-dispatch.md` derivation rule, adapted (`resolved` / `unresolved` / `not-exercised`, stated before any run) [VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md:14-21] | This project's own discipline: "the roll-up derivation rule, stated BEFORE any value." A rule written after seeing the numbers is not a proof by this project's own standard. |

**Key insight:** Every piece of machinery this phase needs to *compute* the
false-positive count already shipped in Phase 43, unexercised on real code. The
actual engineering work in this phase is producing two independent evidence
artifacts (dxa's classification of `BRUCE LEE`, and a live `memmapshow` capture
of the same release) and wiring them into the existing join — not building a
new capability.

## Common Pitfalls

### Pitfall 1: Claiming frame-exactness past anchor hit 50

**What goes wrong:** A plan drives the AUTOSTART sequence to a high anchor hit
count (say, to reach further into the game's resident code before capturing
`memmapshow`) and reports the resulting disagreement count as though it carries
the same frame-exact, byte-identical guarantee the pre-load region does.

**Why it happens:** `S3`'s own measured boundary is sharp and undramatic to
miss: "frame-exact and byte-identical to hit 50; diverging from hit 75"
[VERIFIED: .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md:236],
because "AUTOSTART's power cycle does not reset the absolute emulated clock"
[VERIFIED: .planning/ROADMAP.md:1218]. `EVID-06`'s own A/B measured
`no-perturbation` **only** at depths 10 and 50
[VERIFIED: docs/phase43-instrumentation-perturbation-ab.md:129-133, quoted: "At
both measured depths, the instrumented run ... produced a capture byte-identical
to the un-instrumented control"] and states plainly: *"This `no-perturbation`
verdict licenses **only** the claim that this project's own instrumentation
dials ... do not perturb frame-exactness at anchor hit depths of 50 or below."*
[VERIFIED: docs/phase43-instrumentation-perturbation-ab.md:153-156].

**How to avoid:** Stay at or under anchor hit 50 for any run whose result is
compared for frame-exactness. If the phase wants a deeper `memmapshow` capture
(more of the game's resident code observed), that is legitimate but the record
must state the run is past EVID-06's proven region and any exactness comparison
against v0.8.0's frame-exact captures is *narrowed*, per Success Criterion 3's
own text.

**Warning signs:** A recorded run with `hit_count` > 50 anywhere in a plan's
transcript that is also compared against a "byte-identical" or "frame-exact"
capture without a stated caveat.

### Pitfall 2: Using checkpoint-based sampling to widen coverage

**What goes wrong:** A plan arms additional non-stopping Exec checkpoints across
a wide address range to sample more of the code/data boundary than `memmapshow`
alone would report, expecting a cheap coverage win.

**Why it happens:** A non-stopping checkpoint "emits a `CHECKPOINT_INFO` frame
per hit **synchronously, over the blocking socket, from inside the CPU loop**"
[project CLAUDE.md, "Protocol" bullet, citing `mon_breakpoint.c:557-562`], which
"can stall the emulator thread" on a hot address. `memmapshow`'s own access map
already accumulates continuously and unconditionally once the binary carries
`FEATURE_CPUMEMHISTORY` [VERIFIED: docs/phase43-instrumentation-perturbation-ab.md:144-146,
quoted: "`monitor_memmap_store()` records continuously and unconditionally once
the connected binary carries `FEATURE_CPUMEMHISTORY`"] — a checkpoint sweep adds
risk for no coverage `memmapshow` was not already going to report.

**How to avoid:** Rely exclusively on `memmapshow`'s own continuously-accumulated
map for the oracle. If a specific address needs cross-confirmation, use
`vice_cpu_history`/`chis` (bounded, per-entry PC history) as a secondary,
narrowly-scoped probe rather than a checkpoint sweep.

**Warning signs:** A plan action that arms more than the one S3-style Exec
checkpoint at the frame anchor (`$ea31`).

### Pitfall 3: Reporting `blockCoveredNeverObservedCount` (or its silence) as evidence of "data"

**What goes wrong:** A summary states something like "N addresses were never
observed executing, confirming they are data."

**Why it happens:** It reads intuitively as confirmation, but this project's own
runtime evidence layer forbids exactly this inference: "The absence of a row is
the absence of an assertion. It is never an assertion that the address is data."
[VERIFIED: docs/phase43-runtime-evidence-layer.md:46-47]. `RuntimeExecClass` is
a closed two-member union (`"code" | "unobserved"`) with **no** `"data"` member
"for a caller to return, mistakenly or otherwise"
[VERIFIED: src/mcp/vice/anno-types.ts:601-603].

**How to avoid:** Report `blockCoveredNeverObservedCount` only as its own named
count against `denominator`, exactly as `evid-reconcile.ts` returns it. Never
fold it into, or phrase it as evidence for, a "data" conclusion.

**Warning signs:** Any sentence in the phase's evidence record pairing "never
observed" with "confirmed data" or "is data."

### Pitfall 4: Conflating `chis`'s version-floor nuance

**What goes wrong:** A plan assumes `vice_cpu_history` is unusable on this
host's stock 3.9 build because the binary-monitor `CPUHISTORY_GET` opcode
requires VICE ≥ 3.10, and either skips a useful secondary cross-check or
misdiagnoses a live failure.

**Why it happens:** The version floor is on the **binary-monitor opcode**, not
on the capability — the text-monitor command `chis` "returned CPU history with
per-entry cycle counts over the text channel on genuine stock 3.9"
[project CLAUDE.md, "Dependency" bullet]. If this phase uses `chis` at all
(secondary, optional), it must go through `vice_cpu_history` (the text-monitor
tool, PARSE-02/PARSE-04), never expect the binary-monitor path to work on this
host.

**How to avoid:** Treat `vice_cpu_history`/`chis` as available on this host and
usable as a narrow, bounded secondary probe (subject to the uint16 count-wrap
clamp at 65535 entries, CLAUDE.md's `CPUHISTORY_GET` bullet) — never as the
primary oracle, since it is a rolling PC-history window, not an exhaustive
per-address execute map the way `memmapshow` is.

**Warning signs:** A refusal message citing "requires VICE >= 3.10" surfacing
from a text-monitor call on this host — that would indicate a code defect, not
a genuine host limitation, since this host is confirmed to run the capability
over the text channel already (Phase 42's own shipped `vice_cpu_history` tool
targets exactly this host/binary combination).

### Pitfall 5: Re-ingesting the same `memmapshow` reply under the same run identity and expecting new rows

**What goes wrong:** A plan calls `anno_evid_ingest` twice with the same
`image_sha256`/`argv`/`seed` and the same `memmap_text`, expecting the second
call to add more observations, and misreads `observationsWritten: 0` as a
failure.

**Why it happens:** "Re-ingesting the SAME reply for the SAME run identity
succeeds and reports `changed:false` with `observationsWritten:0`"
[VERIFIED: src/mcp/vice/anno-tools.ts:1064-1066] — this is by design, not an
error.

**How to avoid:** To capture more coverage, either widen the anchor hit depth
(subject to Pitfall 1's bound) within the same run identity and re-ingest a
*new* `memmapshow` reply (more entries accumulate before the next `memmapzap`),
or start a genuinely new run identity (different seed or argv) if a fresh
bracket is wanted. Use `vice_memmap_zap` (clears the emulator's own map) and
`anno_evid_reset` (clears the store's rows for one run identity) together when
re-measuring a bracket from nothing — "Neither call implies the other"
[VERIFIED: docs/phase43-runtime-evidence-layer.md:127-129].

## Code Examples

### Driving the live oracle side (adapted from the shipped EVID-06 harness)

```javascript
// Source: .planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs:127-138
// (VERIFIED, read this session), adapted to a single-run oracle capture rather
// than an A/B pair.
const { binaryPort, textPort } = await allocPorts();
const args = buildProbeArgs({ binaryPort, textPort }); // -default ... -binarymonitor ... -remotemonitor ...
spawnVice(VICE_STOCK, args, { env: bootEnv("proof04-oracle") });
// connect both sockets, arm a STOPPING Exec checkpoint at $ea31 while halted,
// dial "memmapzap" over the text channel, AUTOSTART runAfter:true fileIndex:0,
// count CHECKPOINT_INFO hits to N (N <= 50), then dial "memmapshow" BEFORE any
// RESET and before DUMP.
```

### The join (never re-implemented)

```typescript
// Source: src/mcp/vice/evid-reconcile.ts (VERIFIED, read this session,
// exported function signature at line 216)
import { reconcileObservedExecution } from "./evid-reconcile.ts";

const result = reconcileObservedExecution({ blocks, observations });
// result.disagreements       -- rows: { address, byteDerived: "data", runtime: "code", sourceBanks }
// result.disagreementCount   -- THE false-positive count Criterion 1 asks for
// result.denominator         -- the count of addresses the block table covers
// result.positiveClass       -- always "code"
```

### The already-shipped CLI route (no code to write at all, if the store route is chosen)

```
$ npx @henols/vice-mcp anno evid-disagreements --store FILE --json
```
[VERIFIED: src/mcp/vice/anno-cli.ts:1509-1524, the `cmdEvidDisagreements()`
function opens the store read-only, calls `blocksFromStore(listRanges(handle))`
and `listExecObservations(handle)`, and calls the SAME `reconcileObservedExecution()`
`anno_evid_disagreements` calls.]

### The `not-exercised` shortfall shape (Phase 38's precedent, to reuse verbatim in structure)

```
# Source: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md:14-21
- `resolved` -- at least one enumerated site has a matching resolved reference.
- `unresolved` -- at least one site was enumerated and none resolved.
- `not-exercised` -- zero sites were enumerated. The corpus was searched and
  found to contain none at the depth reached; this is not a pass, and it is
  not `could-not-run`, because the corpus exists and was searched.
```
Adapted for PROOF-04: `not-exercised` applies if the live run cannot reach the
anchor stop at all, or if the control-of-the-control (a second un-instrumented
run at the same depth, compared byte-identical) fails — mirroring EVID-06's own
`not-exercised` branch: *"`not-exercised` iff a required input is absent, either
condition fails to reach the anchor stop at either depth, or the
control-of-the-control does not itself compare `equivalent`. `not-exercised` is
NOT a pass"* [VERIFIED: docs/phase43-instrumentation-perturbation-ab.md:53-58].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `PROOF-01`'s false-positive count is `structurally-uncomputable` because `certainCode.size` is always 0 on the byte-derived tier [VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md:88] | An independent execution oracle (`memmapshow`'s execute bit) supplies a `runtime`-tier positive class (`"code"`) that never depended on the byte-derived tier's own limits, so a real false-positive count (data-classified address, observed executing) becomes computable | Phase 43 (2026-09-10), shipped but unexercised on real code until this phase | Closes the reversal condition named at the v0.8.0 open by the "open the text channel" branch — deliberately, on the record, per `STATE.md`'s own framing |
| No independent check existed for `PROOF-01`; the weakness was disclosed rather than closed: "no independent execution oracle exists for this measurement" [VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md:152-154] | `reconcileObservedExecution()`'s four-bucket join, with disagreement reported first and absence never converted into a class | Phase 43 | This phase is the first to actually run the check, not merely to have built it |

**Deprecated/outdated:** None — this is the first exercise of newly-shipped
machinery, not a replacement of an older approach.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The subject `BlockEntry[]` should be built directly in memory from dxa's own partition (bypassing the `.annostore` entirely for this measurement) rather than imported into a populated store via `anno_set_data_type`/`anno_import_ghidra_export`. | Architecture Patterns, Pattern 2 | If a store-backed route is preferred instead (e.g. to reuse `anno_get_blocks` for a human-readable review), the planner needs to design the "structural independence" mechanism around a shared store file instead — a materially different plan shape. Recorded here as a recommendation, not a locked decision, because no CONTEXT.md exists for this phase to confirm it. |
| A2 | The corpus and entry stay fixed at `danish.d64` / `BRUCE LEE   (DC)` (the same release `PROOF-01` used), and `saeger.d64` stays an optional, not-taken cross-check, exactly as Phase 38 recorded it. | Summary | If the planner wants a second release for a stronger claim, an additional corpus run doubles the live-testing surface and the evidence-recording burden; Phase 38 explicitly declined this ("deliberately not taken in this plan"). |
| A3 | Anchor hit depth for the live oracle run should be chosen at or below 50 (matching EVID-06's proven region) rather than reaching further into the game body (which would surface more of the actual game code/data but loses the frame-exactness guarantee). | Common Pitfalls, Pitfall 1 | A deeper run without the narrowing language Success Criterion 3 requires would overclaim; a shallower run may surface disagreementCount == 0 for want of coverage — depth is a real tradeoff decision for the planner. |
| A4 | `vice_cpu_history`/`chis` is treated as a secondary, optional cross-check only, never the primary oracle. | Common Pitfalls, Pitfall 4 | If the planner instead wants `chis` as the primary/only oracle (e.g. for cheaper per-entry evidence), the coverage-granularity argument in this research would need re-weighing — `memmapshow` is exhaustive-while-recording, `chis` is a bounded rolling window. |

## Open Questions

1. **Store-backed vs. in-memory subject classification (see A1).**
   - What we know: `block-class.ts`'s production classifier accepts a bare
     `{ start_address, end_address, type: "code"|"data"|"undefined" }` with no
     store dependency, and `evid-reconcile.ts` never opens a store itself.
   - What's unclear: whether the planner/owner wants the subject side to be
     independently *reviewable* through the existing `anno_get_blocks` tool
     (which would require a populated store), trading a small amount of
     independence-argument complexity for reviewability.
   - Recommendation: default to the in-memory route (Pattern 2) for the
     cleanest structural-independence story; note the store-backed alternative
     as available if reviewability is prioritized.

2. **Depth beyond hit 50, deliberately deferred.**
   - What we know: the boundary is measured and sharp (hit 50 exact,
     divergence begins at hit 75).
   - What's unclear: whether the phase wants ONE run at hit <=50 (safe,
     narrow coverage, unambiguous frame-exactness claim) or an additional,
     explicitly-narrowed deeper run to surface more of the game's actual
     code/data boundary (broader coverage, EVID-06's authority does not
     extend there and the record must say so).
   - Recommendation: plan the hit<=50 run as the primary, required measurement
     (satisfies all three success criteria unambiguously); treat a deeper run
     as optional additional coverage, explicitly labelled per Criterion 3's
     "narrowed rather than assumed" language if taken.

3. **`saeger.d64` cross-check.**
   - What we know: Phase 38 explicitly declined it as "optional strengthening."
   - What's unclear: whether this phase's owner wants it now that a real
     oracle exists (a second release could distinguish "dxa is wrong on this
     specific binary" from "dxa is wrong in general").
   - Recommendation: out of scope for this phase unless the planner is
     explicitly directed otherwise — Phase 38's own precedent and this phase's
     single-requirement, `not-exercised`-tolerant design both argue for the
     narrowest sufficient measurement first.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `/usr/bin/x64sc` (genuine stock VICE) | The oracle run | ✓ | `VICE 3.9` [VERIFIED: `/usr/bin/x64sc --version`, this session] | none needed — already confirmed present |
| `dxa` disassembler (host tool) | The subject classification | Assumed present — Phase 38's own driver ran it live; not re-probed this session | — | Refuse by name with the remedy (`bash vendor/dxa/build.bash build`) per CLAUDE.md's "never auto-install" discipline if absent |
| Ghidra (`analyzeHeadless`) | Optional strengthening only (Ghidra cross-check of dxa's classification) | Known non-standard path from prior phases, `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` [VERIFIED: reused by Phase 38's own driver, .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md:94] | 12.1.3 | Not required for this phase's minimum success — dxa alone already supplied `PROOF-01`'s classification |
| `vice-broker` systemd unit | Must be **inactive** for a direct-spawn evidence run | Verify with `systemctl --user is-active vice-broker` before every run (every prior evidence plan does this) | — | Stop it if active; direct-spawn and the broker must never race for the same port/process |
| `.c64-re-tools/` corpus | `danish.d64` present at `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64` | ✓ (confirmed on disk this session, alongside `saeger.d64`) | sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` [VERIFIED: .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md:37, and independently re-stated at docs/phase43-instrumentation-perturbation-ab.md:26-27] | — |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** dxa (if absent, refuse by name; not
expected to be absent given Phase 38's own live run).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework [VERIFIED: this repo's package.json test script, per CLAUDE.md's Technology Stack section] |
| Config file | none — `node --test '*.test.*'` globs colocated `*.test.ts` files |
| Quick run command | `cd src/mcp/vice && node --test evid-reconcile.test.ts evid-ingest.test.ts textmon-memmap.test.ts block-class.test.ts` (plus any new `proof04-independence.test.ts`) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| PROOF-04 (Criterion 1: false-positive count computed) | A live run against real cracked code produces a genuine `disagreementCount`/`denominator` pair | live evidence transcript (not a unit test — the true count is not knowable in advance; this is a measurement, like `PROOF-01` and `EVID-06` before it) | manual/live, per this project's own evidence-script discipline — no automated CI assertion of a specific number | N/A by design |
| PROOF-04 (Criterion 2: structural independence) | Neither producer script imports the other's domain | unit/structural | `node --test evidence/proof04-independence.test.ts` | ❌ Wave 0 — new file, following `textmon-memmap.ts`'s own purity-test pattern |
| PROOF-04 (Criterion 2, join purity) | `reconcileObservedExecution()` itself fetches nothing and mutates nothing | unit | `node --test evid-reconcile.test.ts` | ✅ already exists and already passing (Phase 43) |
| PROOF-04 (Criterion 3: shortfall / `not-exercised`) | The derivation rule is written before any run, and a shortfall is recorded with its denominator rather than smoothed over | manual, evidence-document discipline (mirrors Phase 38's `SCHEMA.md`) | N/A — process discipline, not a test | N/A by design |
| PROOF-04 (Criterion 3: EVID-06 bound respected) | Any run past anchor hit 50 is labelled and narrowed | manual/live transcript review | N/A — the depth is a runtime choice made and recorded during the live run, not something a unit test can assert in advance | N/A by design |

### Sampling Rate

- **Per task commit:** the quick run command above, plus `npm run typecheck`.
- **Per wave merge:** `npm run test:automated` (full suite; this project's own
  documented floor is 3 pre-existing failures in `anno-register.test.ts`,
  unrelated to this phase — per user's own standing note, never assume 0).
- **Phase gate:** full suite green at or below the documented floor, AND the
  live evidence transcript (`evidence/proof04-*.md`) recorded with
  `BROKER_STATE: inactive` verified before and after, exactly as every prior
  evidence plan in this milestone has done.

### Wave 0 Gaps

- [ ] `evidence/proof04-independence.test.ts` — new structural test, covers
  Criterion 2 (no existing file provides this specific two-producer purity
  check; the closest precedent, `textmon-memmap.ts`'s own test, checks only
  one module).
- [ ] `evidence/proof04-subject-dxa.mjs` — new subject-producer driver script
  (can reuse `dxa-partition.ts`'s `partitionByteDerived()` and Phase 38's own
  `runDxaDisassemble()` call shape, cited above).
- [ ] `evidence/proof04-oracle-memmap.mjs` — new oracle-producer driver script
  (can reuse `probe-harness.mjs` and EVID-06's own AUTOSTART sequencing
  unchanged).
- [ ] No framework install needed — `node --test` is already the project's
  test runner and every module this phase touches already has committed unit
  tests.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | This phase adds no auth surface; it reuses already-shipped local MCP tools. |
| V3 Session Management | no | No session/user-facing surface added. |
| V4 Access Control | no | No new access-controlled resource. |
| V5 Input Validation | yes (inherited, not new) | Every argument this phase's driver scripts feed to shipped tools (`anno_evid_ingest`'s `memmap_text`/`image_sha256`/`argv`/`seed`) is already validated by `assertEvidIngestArgs` [VERIFIED: src/mcp/vice/anno-tools.ts:1470-1499] — this phase adds no new validated surface, only calls the existing one. |
| V6 Cryptography | no direct use | `argvDigest()` (sha256-based run identity) is already the one shipped digest function; this phase must not hand-roll a second identity/digest scheme. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A caller-supplied `export_path` (if Ghidra strengthening is used) resolving outside the workspace | Tampering/Information Disclosure | Already refused by `anno_import_ghidra_export`'s own workspace-confinement check [VERIFIED: src/mcp/vice/anno-tools.ts:968-976, "REFUSES ... on an export_path that resolves outside the workspace root"] — reused unchanged, never re-implemented. |
| A caller inventing a run identity to make two distinct runs collide or diverge unexpectedly | Tampering | `anno_evid_ingest`/`anno_evid_reset` both compute `argv_digest` themselves from the caller's raw `argv`; a pre-computed digest is never accepted [VERIFIED: src/mcp/vice/evid-ingest.ts:26-31]. This phase's driver scripts must pass the real launch `argv`, never a synthesized one. |
| Treating a malformed/drifted `memmapshow` reply as a valid zero-entry map | Tampering (data-integrity) | `parseAccessMap()` refuses structurally on any drift, never silently returns an empty map [VERIFIED: src/mcp/vice/textmon-memmap.ts:212-224]. This phase must surface a parse refusal as `not-exercised`/failure, never paper over it. |

## Sources

### Primary (HIGH confidence — read this session via `Read`/`Bash`, source code and committed evidence documents)

- `.planning/REQUIREMENTS.md:63` — PROOF-04's exact wording.
- `.planning/STATE.md` (multiple sections, lines 1-260, 540-699) — milestone framing, EVID-06 citation at line 1170, PROOF-04 phase-shape rationale at lines 645-648.
- `.planning/ROADMAP.md:1197-1300` — Phase 44's full roadmap text and v0.9.0 Sequencing Rationale.
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof01-dxa-real-release.md` — `PROOF-01`'s exact recorded figures, corpus identity, weaknesses.
- `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-computed-dispatch.md` — the `not-exercised` derivation-rule precedent.
- `docs/phase43-runtime-evidence-layer.md` — the four surfaces, the one positive fact, the four buckets, run identity, accepted limits.
- `docs/phase43-instrumentation-perturbation-ab.md` — EVID-06's full rule, measurement, and verdict (`no-perturbation`, licensing text quoted verbatim).
- `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md` — the frame-exactness boundary (hit 50 vs. hit 75) and the `S3` sequence table.
- `.planning/phases/43-the-runtime-evidence-layer/43-VERIFICATION.md` — Phase 43's verified pass status and test floor.
- `.planning/phases/43-the-runtime-evidence-layer/evidence/evid06-instrumentation-ab.mjs` — the live-launch harness reuse pattern (`buildProbeArgs`, `spawnVice`).
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/probe-harness.mjs` — `buildProbeArgs()`'s exact flag-order implementation.
- `src/mcp/vice/broker-launch.mts:133` — `STOCK_DETERMINISM_FLAGS`.
- `src/mcp/vice/textmon-memmap.ts`, `evid-ingest.ts`, `evid-reconcile.ts`, `block-class.ts`, `anno-types.ts`, `anno-tools.ts`, `anno-cli.ts`, `text-tools.ts`, `dxa-partition.ts` — full source read this session.
- Project `CLAUDE.md` — the MEASURED, normative constraints on `default_memspace`, `CPUHISTORY_GET`'s version-floor nuance, the non-stopping-checkpoint hazard, and the never-auto-install discipline.
- `/usr/bin/x64sc --version` — live probe this session, confirmed `x64sc (VICE 3.9)`.
- `which x64sc` / `command -v x64sc` — live probe this session, confirmed `/usr/local/bin/x64sc` (the fork) shadows the bare name.

### Secondary (MEDIUM confidence)

- None used — every claim above was checked against a committed source file or a live probe this session.

### Tertiary (LOW confidence)

- None — this research deliberately avoided any web search or training-knowledge claim, since every needed fact was locatable in-repo (the phase is entirely about exercising already-shipped, already-documented machinery).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module cited was read this session; no external package research was needed.
- Architecture: HIGH — the join, the oracle, and the subject-classification pipeline are all read from committed source, not inferred.
- Pitfalls: HIGH — every pitfall is sourced to a measured, committed finding (EVID-06's A/B, the 33-09 frame-exactness sweep, CLAUDE.md's own MEASURED constraints), not speculation.

**Research date:** 2026-09-10
**Valid until:** This research is tied to the current state of Phases 41-43's shipped code and the current corpus/binary on this host; treat as valid until any of those change (no fixed expiry — this is an internal-mechanism research, not a fast-moving external-ecosystem one).
