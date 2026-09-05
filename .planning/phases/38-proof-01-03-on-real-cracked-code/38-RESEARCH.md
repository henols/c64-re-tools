# Phase 38: PROOF-01..03 on Real Cracked Code - Research

**Researched:** 2026-09-05
**Domain:** Measurement (not design) — running three already-delivered instruments (dxa, the SLEIGH/Ghidra harness, the `memmap.json` join) against real cracked C64 releases and recording the numbers Phase 23 could not obtain.
**Confidence:** HIGH — every load-bearing claim below was either (a) read from a committed source file this session, or (b) independently re-run live against the real corpus, real dxa binary and real Ghidra 12.1.3 installation on this host, with the command and its output shown.

<user_constraints>
## User Constraints (from CONTEXT.md)

No `CONTEXT.md` exists for this phase (confirmed: `.planning/phases/38-proof-01-03-on-real-cracked-code/` contains no `*-CONTEXT.md` file). The ROADMAP.md Phase 38 section is unusually detailed and stands in for it per the orchestrator's own instruction. Its "Notes" and Success Criteria are reproduced and treated as locked scope throughout this document; there are no separate "Decisions" / "Claude's Discretion" / "Deferred Ideas" sections to copy verbatim.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, `.planning/REQUIREMENTS.md`) | Research Support |
|----|-------------|------------------|
| PROOF-01 | dxa's data-recovery rate and false-positive count measured on real cracked releases, reported as numbers against a **named binary**, stated **beside** the fixture figures. Every rate carries its denominator and positive class. **NARROWED** — no independent external check exists (`memmapshow` absent). | See "PROOF-01" deep dive below. Named binary identified, sha256-verified, extraction reproduced live. The ground-truth instrument (`dxa-partition.ts`) is read in full and its `certainCode`-is-always-empty design is the single most load-bearing finding in this document — it determines what "false-positive count" CAN and CANNOT mean on a real release. |
| PROOF-02 | Ghidra's indirect-dispatch resolution tested where the index is **computed**, not immediate — the pivot fixture's untested case — result recorded whichever way it comes out. A corpus searched and found to contain none is `not-exercised`, never a pass, never `could-not-run`. | See "PROOF-02" deep dive below. Phase 36 already searched the reachable static corpus (both `danish.d64` and `saeger.d64`) and found **no resolved `COMPUTED_JUMP`** at the loader/depacker depth reached — only the unrelated "BRK trick" IRQ-vector jump. Phase 36's own record explicitly states the game's packed body was never reached. Prior-art plan `23-08-PLAN.md` (never dispatched) supplies a ready-made, D-06-compliant site-enumeration method this phase should reuse. |
| PROOF-03 | The `memmap.json` join run against code that banks ROM in and out; the point where a forward-carried `$01` becomes wrong established in **both directions**. **AMENDED** — "the fixture that will measure it" is explicitly anticipated, not necessarily a real release. | See "PROOF-03" deep dive below. **This is essentially already measured.** Phase 37 plan `37-06` built exactly this fixture (`fixtures/ghidra/bank-path-dependent.a`/`.prg`) and its own observed-red controls already show (a) the same address annotating two different, both-non-border-colour labels under two bank states, and (b) a scratch-copy forward-carry mutation producing a confident wrong label the committed code declines instead. Phase 38's job is very likely formalization + citation, not fresh construction. |
</phase_requirements>

## Summary

This is a measurement phase: every instrument PROOF-01..03 needs already exists on disk, built and verified by Phases 33 (reproducible corpus), 35 (dxa), 36 (Ghidra/SLEIGH), and 37 (the join). This session extracted the corpus's real release, ran the shipped `dxa.disassemble` and `ghidra.analyze` host-tool seams against it live (see "Code Examples" below — every command shown was actually executed on this host during research, not copied from a prior phase's transcript), and read every relevant module the plan will touch.

Three findings are unusually load-bearing and should shape the plan directly:

1. **PROOF-01's honest answer is thinner than the fixture's, structurally, not as a matter of degree.** `dxa-partition.ts`'s byte-derived tier (the ONLY ground-truth tier available for a real release with no source) sets `certainCode` to the empty set *by construction* (`dxa-partition.ts:462`, doc comment: *"certainCode is ALWAYS empty (A-09: this tier decides exactly two facts, and neither is ever code)"*). A "false positive" (dxa says data, ground truth says code) is definitionally uncomputable against this tier, because the tier never asserts any byte is code. This is not an oversight to fix — extending the tier to guess at code would violate the exact discipline `DXA-04`/`T-35-12` were written to enforce. The plan must decide how PROOF-01 states this rather than silently reporting `0` false positives (which would misrepresent an absence-of-evidence as a positive finding — the same trap `PROOF-01`'s existing "no independent external check" caveat already names).
2. **PROOF-02's corpus search has already partly happened, and the answer at the depth reached is `not-exercised`, not `could-not-run`.** Phase 36 plan `36-07` searched both `danish.d64`'s and `saeger.d64`'s extracted `BRUCE LEE` programs for a resolved `COMPUTED_JUMP` and found none — every computed control transfer reachable from the entry points used (`$081b`, `$b70a`, `$b74c`, `$b7e7`, `$b790`) is the unrelated BRK-trick IRQ-vector jump. Critically, Phase 36's own record states the game's real (packed) code was **never reached** because static analysis does not run the depacker. The plan needs to decide whether to (a) accept `not-exercised` at this depth as PROOF-02's answer, citing the existing search, or (b) go one level deeper using Phase 33's own capture substrate to obtain a **depacked flat 64K image** and feed it to Ghidra's already-built `flat64k` import route, searching the actual game code for the first time.
3. **PROOF-03 is very likely already answered by Phase 37's own controls, and Phase 38's job is mostly formalization.** `37-06`'s two committed evidence files (`37-06-bank-decode-bypass-red.md`, `37-06-path-dependent-decline-red.md`) already demonstrate, against the real committed fixture and its real captured Ghidra export, both halves PROOF-03 asks for: an address annotating differently under two bank states, and the exact point (a disagreeing-values program point) where forward-carrying a single value produces a confident wrong label instead of the committed code's correct decline. These were built to validate `AUTO-04`/`AUTO-05` (Phase 37's own requirements), not badged as `PROOF-03`, and neither is `PROOF-03` marked complete anywhere. The plan should very likely **re-run the identical measurement under Phase 38's own evidence conventions** (citing but not merely repeating Phase 37's prose) rather than build a second fixture.

**Primary recommendation:** Scope this phase as three small, evidence-recording plans (one per PROOF-*), each importing the shipped TS seams directly (`dxa-run.ts`, `dxa-partition.ts`, `dxa-listing.ts`, `ghidra-run.ts`, `anno-d64.ts`, `anno-bank.ts`/`anno-join.ts`) from a `.planning/phases/38-.../evidence/*.mjs` script — mirroring Phase 33's `capture-pair.mjs` convention exactly ("drives the shipped seams, not private copies of them") — rather than adding new shipped `src/` modules, with the one exception of PROOF-01's comparator (join `dxa-partition.ts` ground truth against `dxa-listing.ts`'s parsed output), which does not exist anywhere yet and must be written fresh, in whichever location the plan decides (evidence script vs. shipped module — see Open Questions).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Corpus release identification & extraction | Evidence script (container-side TS, `anno-d64.ts`) | — | Pure byte-level `.d64` directory read; no host process, no broker |
| dxa invocation | Host-tool seam (`dxa-run.ts` → `host-tool-client.ts` → host route on this dev host) | Broker control-plane (only inside a container) | `SEAM-01`: dxa is a host binary reached through the typed allowlist; this dev host takes the direct-spawn route since `isInsideContainer()` is false here |
| dxa listing parse | Evidence/analysis tier (`dxa-listing.ts`) | — | Pure text-to-structure transform, no host access |
| Ground-truth partition (byte-derived) | Evidence/analysis tier (`dxa-partition.ts`) | — | Pure byte-grammar walk, no execution, no host access |
| PROOF-01 comparator (NEW) | Evidence script or new shipped module (undecided — see Open Questions) | — | Joins the two outputs above; does not exist yet |
| Ghidra invocation | Host-tool seam (`ghidra-run.ts` → host route on this dev host) | Broker control-plane (only inside a container) | Same as dxa; `GHIDRA_HOME` is a host prerequisite, not a container path |
| Structural-fact / reference export parsing | Evidence/analysis tier (`GhidraStructExport.java`'s text output, parsed by hand or by `anno-import.ts` helpers) | — | Plain-text, section-delimited; no JVM needed to *read* it |
| `$01` bank-state resolution & the join | Evidence/analysis tier (`anno-bank.ts`, `anno-join.ts`) | Store (`anno-store.ts`, read-only for this phase) | Pure computation over parsed const-writes and xrefs; Phase 37 already exercises it end to end on the exact fixture PROOF-03 needs |
| Depacked flat-64K capture (if PROOF-02 goes deeper) | VICE broker + binary monitor (`vice-broker.mjs`, `stock-reproducible-run.ts`, `vsf-slice.ts`) | — | The ONLY route that reaches the packed release's un-obfuscated code; needs a live broker + real `x64sc`, unlike everything else in this phase |

## Standard Stack

No new libraries or dependencies are introduced by this phase. Every instrument below was vendored, built, and integration-tested in Phases 34–37; this phase reuses them exactly as shipped.

### Core (already delivered, reused unchanged)

| Instrument | Version | Purpose | Delivered by |
|---|---|---|---|
| dxa | 0.1.5, vendored, digest-pinned | Byte-level code/data discovery disassembler | Phase 35 (`src/mcp/vice/vendor/dxa/`) |
| Ghidra | 12.1.3, host prerequisite (not vendored) | Semantic decompilation / structural-fact export | Phase 34/36 (`GHIDRA_HOME`) |
| `6502:LE:16:nmos` SLEIGH language | committed extension, installed into `$GHIDRA_HOME` | Decodes all 105 undocumented NMOS 6502 opcode bytes | Phase 36 |
| `dxa-run.ts` / `dxa-listing.ts` / `dxa-partition.ts` / `dxa-blocks.ts` | committed | Container-side dxa orchestration, listing parse, ground-truth partition, `-B`/`-l` emission | Phase 35 |
| `ghidra-run.ts` / `ghidra-project.mts` | committed | Container-side Ghidra orchestration, run-log classification, installed-language check | Phase 36 |
| `anno-d64.ts` | committed | `.d64` directory read + entry extraction (no VICE) | pre-existing (used by Phase 35/36 already) |
| `anno-bank.ts` / `anno-join.ts` / `anno-import.ts` | committed | `$01` bank-state decode, reaching-values computation, bank-conditional decline, `.prg`/flat-64K export parsing | Phase 37 |
| `vsf-slice.ts` / `stock-reproducible-run.ts` / `vice-broker.mjs` | committed | (Only if PROOF-02 goes to the depacked-image route) reproducible capture substrate | Phase 33/34 |

### Not needed / explicitly out of scope for this phase

No new npm package, no new Java dependency, no new Ghidra extension. `memmapshow` (the one instrument this phase's own criteria repeatedly name as absent) stays absent by owner decision 2026-09-02 — do not propose adding it.

**Installation:** None required beyond what Phases 34–37 already installed. Verify presence, do not (re)install:

```bash
ls src/mcp/vice/vendor/dxa/dxa                                  # dxa binary, built by Phase 35
echo $GHIDRA_HOME                                                # must be set — NOT exported by default in a fresh shell
node -e "process.env.GHIDRA_HOME='/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC'; import('./src/mcp/vice/ghidra-project.mts').then(m=>console.log(m.installedLanguageIds(process.env.GHIDRA_HOME).filter(l=>l.id.includes('6502'))))"
```

`[VERIFIED: this session, live commands shown in "Code Examples" below]` — `GHIDRA_HOME` is **not exported by default** in an interactive shell on this host; every plan task that calls `ghidra.analyze` (directly or via `ghidra-run.ts`) must set it explicitly, e.g. `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`.

## Package Legitimacy Audit

**Not applicable — this phase installs no new external packages.** dxa 0.1.5 and Ghidra 12.1.3 were vendored/declared as host prerequisites in Phases 35 and 34/36 respectively, and their legitimacy was already audited there (dxa: GPL-2.0-or-later, vendored source, digest-pinned; Ghidra: NSA-published, declared host prerequisite by version, not vendored). No `npm install`, `pip install`, or `cargo add` occurs anywhere in this phase's plan.

## Architecture Patterns

### The one pattern this phase should follow: "drive the shipped seams, not private copies of them"

This is Phase 33's own documented convention (`capture-pair.mjs`'s header, quoted in full because it is exactly this phase's situation):

> "Everything below that could have been re-authored is imported or invoked instead, because a second copy of any of it would make this measurement a measurement of the copy."

Concretely for Phase 38: every evidence script imports `dxa-run.ts`'s `runDxaDisassemble()`, `dxa-partition.ts`'s `partitionByteDerived()`/`partitionSourceDerived()`, `ghidra-run.ts`'s `runGhidraAnalyze()`, and `anno-d64.ts`'s `listEntries()`/`extractEntry()` — never a hand-rolled re-implementation of dxa's argv, the `.d64` directory format, or the Ghidra export format.

### System flow for PROOF-01 (verified this session — see Code Examples)

```
danish.d64 (gitignored, on-disk, .planning/phases/23-.../evidence/corpus/)
    │  anno-d64.ts: listEntries() + extractEntry()
    ▼
"BRUCE LEE   (DC)" .prg, 45074 bytes  ──────────────────────────┐
    │  dxa-run.ts: runDxaDisassemble({image, imageKind:"prg",   │
    │              entrypointsPath})  → host-tool seam → dxa    │
    ▼                                                           │
DumpListingMap {code, data, unclassified, covered}              │
    │                                                           │
    │            dxa-partition.ts: partitionByteDerived()  ◀────┘
    │            (same .prg bytes, independently)
    ▼
{certainData (BASIC-stub bytes only), certainCode: ALWAYS EMPTY, unknown}
    │
    ▼
[NOT YET BUILT] comparator: joins the two sets above, reports
  BYTE_DERIVED_RECOVERY = |certainData ∩ dxa.data| / |certainData|
  BYTE_DERIVED_FALSE_POSITIVES = uncomputable (denominator: |certainCode| = 0, always)
```

### Recommended evidence-script structure (mirrors `33-.../evidence/capture-pair.mjs`)

```
.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/
├── README.md                      # evidence conventions, mirrors 33's
├── SCHEMA.md                      # outcome-line schema for PROOF-01/02/03 (if this phase needs its own — see Open Questions)
├── proof01-dxa-real-release.mjs   # imports dxa-run.ts, dxa-partition.ts; NEW comparator logic lives here or in a new src/ module
├── proof02-computed-dispatch.mjs  # imports ghidra-run.ts, anno-d64.ts; independent site enumeration per 23-08-PLAN.md's method
└── proof03-bank-boundary.mjs      # imports anno-bank.ts, anno-join.ts, anno-import.ts against the ALREADY-committed fixtures/ghidra/export-bank-path-dependent.txt
```

### Anti-pattern to avoid

- **Re-deriving dxa's or Ghidra's own output format instead of importing the parser.** `dxa-listing.ts` and `anno-import.ts`'s `parseGhidraExport()`/`parseConstWrites()` already exist and are hermetically tested; a plan task that greps the raw export text by hand duplicates work this project already did and risks silently drifting from the real format (the exact trap `DXA-02`'s "loud, never silent" amendment exists to prevent).
- **Treating dxa's `certainCode` gap as a bug to fix.** `dxa-partition.ts`'s header comment states explicitly this tier decides "exactly two facts... EVERYTHING ELSE is unknown", by design (`T-35-12`/`A-09`). A plan that tries to widen the byte-derived tier to guess at code (e.g., "assume everything after the BASIC stub not proven data is code") reintroduces exactly the silent, unfalsifiable convention-guess this project's own `DXA-04` was written to forbid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.d64` directory listing / file extraction | A new `.d64` parser | `anno-d64.ts`'s `listEntries()`/`extractEntry()` | Already used by Phases 35/36 on this exact corpus; re-verified this session to reproduce the identical sha256 |
| dxa's `-a dump` output parsing | A regex ad-hoc in the evidence script | `dxa-listing.ts`'s `parseDumpListing()` | Hermetically tested against dxa's 5 real line shapes, refuses loudly on byte-total mismatch |
| Ground-truth code/data partition on a real release | A convention guess (e.g. "screen at $0400, charset at $1000") | `dxa-partition.ts`'s `partitionByteDerived()` | `T-35-12` names exactly this guess as the failure mode this module exists to prevent |
| Reaching Ghidra or dxa from a skill/evidence script | `child_process.spawn("dxa"/"analyzeHeadless", …)` | `runDxaDisassemble()` / `runGhidraAnalyze()` | `SEAM-05`'s whole-tree grep gate bans a new spawn site outright; it will fail CI |
| Bank-state ($01) decode and per-address resolution | New bit-arithmetic in an evidence script | `anno-bank.ts`'s `decodeBankState()`/`resolveBankedRegion()` | Already built, already has its own observed-red controls (37-06) proving it matters |

**Key insight:** every piece of machinery PROOF-01..03 needs already exists as a tested, committed module. The only genuinely new code this phase should need is the PROOF-01 comparator (joining two already-existing outputs) and, if the plan chooses the deeper PROOF-02 route, a depacked-image capture + a Ghidra `flat64k` run over it — both compositions of existing seams, not new mechanisms.

## PROOF-01 Deep Dive: dxa on a Real Cracked Release

### The named binary (verified this session)

| Field | Value | Source |
|---|---|---|
| Release image | `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64` | On disk, **gitignored** (`.gitignore` at that path excludes `*.d64`), 174848 bytes |
| Image sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` | `[VERIFIED: this session — sha256sum re-run against the file, matches docs/phase33-reproducible-run-gate-findings.md frontmatter's corpus.releases[0], canonical: true]` |
| Directory entry | `"BRUCE LEE   (DC)"`, type `PRG`, track 17, sector 0 | `[VERIFIED: this session — anno-d64.ts listEntries() re-run live, output shown below]` |
| Extracted `.prg` length | 45074 bytes (2-byte header `$01 $08` + 45072-byte body) | `[VERIFIED: this session]` |
| Extracted sha256 | `331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4` | `[VERIFIED: this session — byte-identical to Phase 35's own recorded extraction in evidence/35-dxa03-real-image.md]` |
| A second corpus release exists | `saeger.d64` (sha256 `b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5`), extracted entry `"BRUCE LEE"` — same game, different crack group | `[VERIFIED: this session]` — not marked `canonical` in the gate frontmatter, but already used by Phase 36 as an independent cross-check |

Only `danish.d64` is marked `canonical: true` in `docs/phase33-reproducible-run-gate-findings.md`'s frontmatter (`corpus.releases[0]`). Recommend PROOF-01 name `danish.d64`'s `BRUCE LEE (DC)` as its primary named binary, for consistency with `GATE-01`'s own corpus record, and optionally cite `saeger.d64` as a cross-check the way Phase 36 did.

### The fixture figures PROOF-01 must sit beside (already committed, no new measurement needed)

`[VERIFIED: docs/phase23-real-release-gate-findings.md:456-479]` — quoted verbatim:

> | data-recovery rate | **`72.39 (97/134)`** | **`72.46%` (100/138)** | `could-not-run` |
> | `FIXTURE_REPRODUCED` | `no` | — | — |
> "...The apples-to-apples fixture figures are the source-derived ones — `72.39` / `3` / `27.61` — and the published..."

`[VERIFIED: .planning/phases/35-dxa-vendored-and-parsed/35-03-SUMMARY.md]` — Phase 35's `dxa-partition.ts` (`partitionSourceDerived()`) already **reproduced** this exactly: "145 code bytes, 131 strict data bytes, 3 pad bytes, 90 emissions, 4 truncated columns recovered." These three numbers (`FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, `FIXTURE_REPRODUCED: no`) are **already available today** by running:

```bash
node src/mcp/vice/dxa-partition.ts source-derived src/mcp/vice/fixtures/dxa/fixture.rep src/mcp/vice/fixtures/dxa/fixture.prg
```

The plan does not need to re-derive these; it needs to run the real-release comparator (below) and print the two sets of numbers **beside** each other.

### The comparator does not exist yet, and the ground truth it must use is structurally thin

`[VERIFIED: src/mcp/vice/dxa-partition.ts:462-464]` — quoted verbatim (the field's own doc comment):

> "`certainCode` is ALWAYS empty (A-09: this tier decides exactly two facts, and neither is ever code) -- it exists as a field purely so the denominator discipline (`certainCode.size + certainData.size`, never the image size) reads identically to the source-derived tier's."

This session re-verified this live against the real extracted `BRUCE LEE (DC)` `.prg`:

```
$ node dxa-partition.ts byte-derived <extracted BRUCE LEE (DC) .prg>
BYTE_DERIVED_ORIGIN: $0801
BYTE_DERIVED_HEADER_BYTES_EXCLUDED: 2
BYTE_DERIVED_STUB_ATTEMPTED: yes
BYTE_DERIVED_STUB_OUTCOME: BASIC stub at $0801 parsed cleanly: 24 byte(s) certain-data ($0801-$0818).
BYTE_DERIVED_CERTAIN_CODE_BYTES: 0
BYTE_DERIVED_CERTAIN_DATA_BYTES: 24
BYTE_DERIVED_UNKNOWN_BYTES: 45048
BYTE_DERIVED_DATA_FRACTION: 100.00 (24/24)
```

`[VERIFIED: this session]`. Then, driving the real vendored dxa binary via the shipped `runDxaDisassemble()` seam (not a raw CLI call) with the one entry point Phase 35 already established (`$0819`, from the extracted `.prg`'s own `10 SYS2073` BASIC line):

```
$ node --input-type=module -e "
import { runDxaDisassemble } from './dxa-run.ts';
const res = await runDxaDisassemble(
  { image: 'bl.prg', imageKind: 'prg', entrypointsPath: 'bl.entrypoints' },
  { repoRoot: '<scratch dir>' }
);
console.log(res.map.code.size, res.map.data.size);
"
67 45005
```

`[VERIFIED: this session]` — 67 bytes classified code, 45005 data, matching Phase 35's earlier `$0819-$081f` (7-byte) exclusion-mechanism finding plus the depacker chain reached from `$b70a`. All 24 of `certainData`'s bytes land in dxa's own `data` set (100% recovered, denominator 24) — **but this denominator is 24, not 134** (the fixture's denominator). This is not a smaller sample of the same thing; it is a structurally different, much narrower fact (only the BASIC loader stub, never any game code, because no independent ground truth about game code exists without an execution oracle).

**The false-positive count cannot be computed the way the fixture computed it (`[...dxa.data].filter(a => !trueData.has(a)).length`), because `trueData`'s complement (`certainCode`) is empty by construction on a real release.** Any number reported for "false positives" here that isn't explicitly qualified as "0 by vacuous absence of a known-code denominator" would misrepresent an absence of evidence as a positive finding.

### Recommendation for the plan

1. Build the comparator as a new small module (evidence script per the "drive the shipped seams" pattern, OR — the planner's call — a hermetic `src/` module analogous to `dxa-partition.ts` if the phase wants it unit-tested and reusable). Either way it must import `runDxaDisassemble()` and `partitionByteDerived()` directly, never re-implement either.
2. Report the real-release numbers explicitly labelled with their true denominator (24, not 134) and positive class (`data`).
3. State the false-positive count as **structurally uncomputable against this ground truth**, naming the reason (`certainCode` is always empty for a real release with no source), rather than reporting `0`. This is a NEW named weakness distinct from (though related to) the already-disclosed "no independent external check (`memmapshow` absent)" — the planner should decide whether to fold it into that same disclosed weakness or record it as a second, related one.
4. State both the fixture numbers (72.39%/3 FP/reproduced:no) and the real-release numbers (100.00% recovery on denominator 24 / FP: uncomputable) beside each other, exactly as the criterion requires.

## PROOF-02 Deep Dive: Computed-Index Dispatch on Real Code

### What Phase 36 already searched, and what it found (verified — read, not re-run, given the ~15-90s Ghidra JVM cost per run; commands and exact evidence file paths cited)

`[VERIFIED: .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-07-corpus-before-after.md]` — entry points established for `danish.d64`'s `BRUCE LEE (DC)`: `$081b` (the BASIC stub's `SYS 2073` call), `$b70a` (reached from `$081b`'s direct `JMP`), `$b74c` and `$b7e7` (the depacker's two self-relocating copy-loop source addresses), `$b790` (the depacker's second real routine).

`[VERIFIED: .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-07-acceptance-run.md:33-77]` — quoted verbatim:

> "`STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found`"
> "...every computed control transfer this image reaches decodes as a `BRK` instruction whose own flow is the "BRK trick" -- a computed jump through the hardware IRQ vector (`$FFFE`), which this synthetic flat import cannot resolve because the vector's own target lives entirely outside the loaded image... This was independently RE-CONFIRMED... on a SECOND, unrelated crack of the SAME game (`saeger.d64`, cracked by a different group)..."
> "**Not known / not established here.** Whether a resolved `COMPUTED_JUMP` reference exists ANYWHERE in this corpus release's own game code (as opposed to its loader/depacker stage, which is all this plan's five entry points reach) is not established -- the game's own real code is packed and never appears as static bytes in this file until the depacker actually runs, which this plan's static analysis does not emulate."

**This is not the same thing as a computed-index dispatch table** (e.g., `ldx <computed> / lda table_lo,x / sta ptr / lda table_hi,x / sta ptr+1 / jmp (ptr)`), the construct PROOF-02 asks about. The BRK trick is a different unresolvable-by-construction jump through a fixed hardware vector. Phase 36's search establishes that **at the loader/depacker depth reached, no computed dispatch of either kind exists** — a real, valid `not-exercised` finding for that depth — but the actual GAME code (which is where a real crack's dispatch tables, if any, would live) has never been examined, because it is packed and only exists as bytes after the depacker runs.

### The pivot fixture's own computed-dispatch construct (read this session)

`[VERIFIED: .planning/notes/dxa-ghidra-pivot-evidence/fixture.a:18-23]` — quoted verbatim:

```
; --- dispatch via JMP (ptr) built from a split table ---
        ldx #$02
        lda disp_lo,x
        sta $fb
        lda disp_hi,x
        sta $fc
        jmp ($fb)
```

`[VERIFIED: .planning/phases/23-the-real-release-gate-go-degrade-no-go/23-RESEARCH.md:236-244]` — this session's predecessor phase already measured (synthetically, on a hand-edited variant of this exact fixture, never committed) that replacing `ldx #$02` with `lda $d012 / and #$03 / tax` (a genuinely computed index) makes Ghidra's `082e -> 089a COMPUTED_JUMP` reference disappear entirely, replaced by a bare `REF 0832 -> 00fb READ` — i.e., Ghidra fails **silently**, emitting no warning and no log line. This synthetic variant was never committed to the repository as a fixture (grepped for `$d012`/`and #$03` under `fixtures/` and `.planning/phases/23-.../evidence/`; not found). If the plan wants a controlled, source-known computed-dispatch fixture (as opposed to relying entirely on the real, ambiguous corpus), it must be re-created — the exact substitution above is the fastest way to do it, reusing `fixture.a`'s already-committed BASIC stub and surrounding constructs.

### Site-enumeration method — reuse Phase 23's un-dispatched plan design (D-06 circularity guard)

`23-08-PLAN.md` (never executed — the plan itself states "NOT DISPATCHED, and the work is NOT DONE") already designed exactly this measurement and is directly reusable prior art:

- **The circularity trap, named explicitly:** "if Ghidra found the dispatch site, the criterion degrades to 'Ghidra resolved the dispatch that Ghidra found'." Sites must be enumerated **independently of Ghidra's own export**, before checking whether Ghidra resolved each one.
- 23-08's own design enumerated sites from a **runtime inventory** — but that route assumed an execution oracle (`memmapshow`), which is now stated absent (owner decision 2026-09-02). **This phase must adapt the method**: enumerate candidate indirect-jump sites via a **static, non-Ghidra** route instead — e.g., dxa's own `-a dump` listing (already parsed by `dxa-listing.ts`) grepped for the raw opcode `$6C` (`JMP (abs)`), or a raw byte scan over the extracted/depacked image — never by scanning Ghidra's own `## REFERENCES`/`## STRUCTURAL_FACTS` output to *discover* which sites to check.
- Detection method (unchanged from `23-08-PLAN.md`, still correct): "An unresolved computed dispatch is detected as the absence of a computed-jump reference from an independently-enumerated site, never as a reported error — Ghidra emits no warning and no log line when it fails to resolve one." This session's own re-confirmation above bears this out directly.
- The `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED found/not-found` line in `GhidraStructExport.java`'s output (`[VERIFIED: src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java:503-517]`) is the exact machine-readable signal to check per enumerated site, alongside `## REFERENCES`'s per-line `COMPUTED_JUMP` kind tag.

### Recommendation for the plan

Two honest options, both consistent with the criterion's own text ("a corpus searched and found to contain no computed dispatch is reported as `not-exercised`... never as a pass"):

1. **Shallow answer (cheap, already 90% done):** formally record Phase 36's existing search as PROOF-02's `not-exercised` finding, citing `36-07-corpus-before-after.md`/`36-07-acceptance-run.md` verbatim, explicitly scoped to "the loader/depacker stage reachable from the BASIC stub without running the depacker" — and name that scope limit plainly (do not silently generalize to "the whole release").
2. **Deeper answer (more work, more informative, matches the ROADMAP's "the corpus now exists" framing):** use Phase 33's capture substrate (`CAP-01`/`CAP-04`, already delivered — `vsf-slice.ts` + `stock-reproducible-run.ts`) to capture a **depacked flat 64K image** of `danish.d64` at a point after the depacker has run (Phase 33's own `33-10` already captured such an image at anchor hit 400, though not committed — `PROBE_DIR` was outside the checkout and is ephemeral), then feed that flat image to Ghidra via the already-built `flat64k` import route (`GHID-01` supports both), and search the ACTUAL game code for a resolved or unresolved computed dispatch for the first time. This is real, uncompleted work — no plan or evidence in Phases 33/35/36/37 does this.

Given the phase's own framing ("Measurement, not design — skip `--research-phase`... the corpus now exists"), option 2 appears to be the intended reading, but option 1 is a legitimate, honestly-scoped fallback if a fresh capture proves infeasible inside this phase's budget. Flag this choice for `/gsd-discuss-phase` or the planner's own judgement — it is the single biggest scope decision in this phase.

## PROOF-03 Deep Dive: The `$01` Boundary, Already (Almost) Measured

### The fixture (read this session, in full)

`[VERIFIED: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a]` — quoted verbatim (the full program, elided only where marked):

```
        * = $0810
start:
        sei
        lda #$34                ; %00110100 : bits 1-0 clear -> $D000-$DFFF reads as RAM
        sta $01
        jsr probe                ; call 1 -- probe's writes/reads run under $01=$34

        lda #$33                ; %00110011 : bits 1-0 set, bit 2 clear -> Character ROM
        sta $01
        jsr probe                ; call 2 -- SAME address, SAME instructions, $01=$33 now
        ...
probe:
        lda #$aa
        sta $d020               ; the shared write -- reached twice: $01=$34, then $01=$33
        ldx #$00
        lda $d000,x             ; the shared read -- reached twice: $01=$34, then $01=$33
        sta $3000,x
        rts
```

This is a **single shared program point** (`probe`'s `sta $d020` and `lda $d000,x`), each reached from two callers under two determinate, different `$01` bank states — exactly the construct PROOF-03 needs ("code that banks ROM in and out... at least one address shown annotating differently under two bank states"). It was built by Phase 37 plan `37-02`, assembled with real ACME (`acme -f cbm`), and its real, unedited `analyzeHeadless` export is committed at `src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt`.

### What Phase 37 plan 37-06 already measured against this exact fixture (read this session, in full)

`[VERIFIED: .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md]` — quoted verbatim, the committed (unmutated) module's own output:

> "| `$34` (all-RAM) | `$0815` | NOT "Border color (only bits #0-#3)" -- resolves to the RAM-constrained candidate |
> | `$33` (Character ROM) | `$081c` | NOT "Border color (only bits #0-#3)" -- resolves to the Character-ROM-constrained candidate |
> The two values produce **DIFFERENT** annotations, confirmed by direct string inequality."

This alone already satisfies "at least one address shown annotating differently under two bank states." Both call sites correctly avoid the wrong border-colour label, and the two labels differ from each other because the two bank states resolve to two different regions (RAM vs. Character ROM).

`[VERIFIED: .planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-path-dependent-decline-red.md]` — quoted verbatim, the DISAGREEING-values case (both `$34` and `$33` reaching the SAME address simultaneously, via `putXref()`):

> "**Under the committed (unmutated) module:** `$D020`'s decision is `declined`, its reason names both `$34` and `$33`, `counts.declined` reads `1`... **Under the forward-carry (mutated) module:** `$D020`'s decision is `annotated`, exactly ONE comment is written, and its label equals the SAME label the character-ROM-constrained candidate set independently computes for `$33` (the ascending-sorted first value) -- confirming the mutation produced a confident, specific, WRONG annotation rather than merely "some different outcome"."

This is, functionally, an empirical demonstration of "the point where a single forward-carried `$01` value becomes wrong": at the disagreeing-values program point, forward-carrying (taking the first reaching value) produces a specific, confident, WRONG label, while the committed code correctly declines instead.

### What this means for the plan

`requirements-completed: [AUTO-04, AUTO-05]` in `37-06-SUMMARY.md`'s own frontmatter — **not** `PROOF-03`. `PROOF-03` is nowhere marked complete. The measurement substance exists and is committed; the formal, schema-compliant PROOF-03 record does not. The plan's job is very likely:

1. **Re-run this exact measurement under Phase 38's own evidence conventions** (a committed transcript with PROOF-03's own outcome-line schema — see "Validation Architecture" below), citing Phase 37's fixture/capture/modules rather than re-authoring them. This can almost certainly reuse `37-06`'s own scratch-tree technique (mutated module in a `mkdtempSync` scratch copy, real committed capture as input) directly.
2. Decide whether "in both directions" (the criterion's own phrase) is satisfied by these two existing transcripts (different-under-two-states, plus wrong-if-forward-carried) or whether a third, distinct demonstration is wanted. Recommend treating it as satisfied — the two together cover "shown annotating differently under two bank states" (direction 1) and "the point where forward-carrying becomes wrong" (direction 2) — but this is a judgement call for the planner/discuss-phase to confirm explicitly, since REQUIREMENTS.md's "AMENDED" text was written speculating about a fixture that, as of this research, has already been built and exercised.
3. Note the fixture's own comment **corrects a claim in its sibling `bank.a`**: `[VERIFIED: src/mcp/vice/fixtures/ghidra/bank-path-dependent.a:9-11]` — *"`bank.a`'s own inline comment mislabels `$34` as having bit 2 clear -- it does not; bit 2 (0b100) is SET in `$34`. The RAM outcome it states is nevertheless right, because the RAM case depends only on bits 1-0."* If the plan cites `bank.a` anywhere, do not repeat its bit-2 error.
4. If the plan wants the "banks ROM in and out" language taken literally against the **real cracked release** (not the synthetic fixture) rather than the fixture REQUIREMENTS.md explicitly anticipated, that is separate, uncompleted work — Phase 37's `export-bank-path-dependent.txt` capture is the ONLY committed real bank-boundary capture; nothing establishes whether `danish.d64`'s `BRUCE LEE (DC)` itself ever writes `$01` more than once. This is a genuinely open question — see below.

## Common Pitfalls

### Pitfall 1: Assuming a live broker is required for dxa/Ghidra measurements
**What goes wrong:** A plan task budgets time/complexity for starting and stopping a task-scoped `vice-broker.mjs`, as Phase 33's capture work required.
**Why it happens:** `runDxaDisassemble()`/`runGhidraAnalyze()` both default to `runHostToolFromContainer()`, which the reader might assume always dials the broker's control-plane socket.
**How to avoid:** `host-tool-client.ts`'s own header states the route is chosen by `isInsideContainer()`, "and NEVER by whether a broker happens to be reachable" — on the host route (this dev host, no devcontainer), it is a direct `spawn` of `resources/host-tool.mjs`, no broker needed at all. `[VERIFIED: this session — runGhidraAnalyze() called directly against the real GHIDRA_HOME with no broker running (confirmed `systemctl --user is-active vice-broker` = `inactive`, no `x64sc` process), exited 0]`.
**Warning signs:** A plan task that says "start the broker" before a `dxa.disassemble`/`ghidra.analyze` call with no VICE lease anywhere nearby.

### Pitfall 2: Writing extracted/scratch corpus material inside the checkout without `repoRoot` confinement
**What goes wrong:** An evidence script writes an extracted `.prg` or a Ghidra project directly under `.planning/phases/38-.../evidence/`, expecting the existing `.gitignore` (which only covers Phase 23's own `evidence/corpus/`) to protect it, or hits `resolveWorkspacePath()`'s refusal when passing an absolute `/tmp` path as `image`.
**Why it happens:** `dxa-run.ts`/`ghidra-run.ts` confine every path argument to a `root` (default `repoRoot()`), refusing anything that resolves outside it — `[VERIFIED: this session — a direct call with an absolute /tmp path as `image` and no `repoRoot` override threw "resolves to ..., which is outside the workspace root ... -- refusing"]`.
**How to avoid:** Follow `ghidra-live.test.ts`'s own convention (`D-36-12`): build a `mkdtempSync` scratch workspace OUTSIDE the checkout, pass it as `opts.repoRoot`, write every extracted/generated file there, tear it down in a `finally`. `[VERIFIED: this session — the exact same pattern, `runGhidraAnalyze()` called with `{ repoRoot: '<scratch dir>' }`, `git status --porcelain` confirmed clean before and after]`.
**Warning signs:** A `git status --porcelain` check after a plan task's own verification step showing an untracked `.prg`, `.gz`, or Ghidra `.rep`/`.gpr` file.

### Pitfall 3: Treating dxa's `certainCode: empty` as something to work around with a heuristic
**What goes wrong:** A plan task tries to widen the byte-derived ground-truth tier (e.g., "assume the region after the last recognizable structure is code") to make a false-positive count computable.
**Why it happens:** The criterion's plain-English wording ("false-positive count") reads as if a number must always exist.
**How to avoid:** `dxa-partition.ts`'s own header (quoted above) states this is a **deliberate** design choice, not a gap — `T-35-12` names exactly this class of convention-guess as the thing `DXA-04` exists to forbid. Report the absence honestly (see PROOF-01 deep dive) rather than inventing a heuristic that would itself become an unverified, unfalsifiable claim.
**Warning signs:** A plan `<verify>` step that asserts a specific false-positive number > 0 with no cited ground-truth source for what makes those bytes "code."

### Pitfall 4: Confusing the BRK-trick IRQ-vector jump with a computed-index dispatch
**What goes wrong:** A plan reads Phase 36's `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found` and reports PROOF-02 as already answered without checking that the searched code actually contains an indexed dispatch construct at all.
**Why it happens:** Both are "unresolved indirect control transfers" superficially, but they are different mechanisms with different causes (a fixed hardware vector outside the loaded image, vs. a computed table index inside it).
**How to avoid:** Re-read `36-07-acceptance-run.md`'s own finding closely — it explicitly says the corpus's OWN game code (as opposed to loader/depacker) was never reached, and that absence is stated as a fact about depth-of-search, not as "no computed dispatch anywhere in this release."
**Warning signs:** A plan `<verify>` step that cites `COMPUTED_JUMP_RESOLVED: not-found` without also stating which addresses/depth were actually searched.

### Pitfall 5: `GHIDRA_HOME` silently unset
**What goes wrong:** A plan task's shell has no `GHIDRA_HOME` exported (confirmed this session — a fresh shell on this host has it unset), and `runGhidraAnalyze()` refuses cleanly, but a script that doesn't check the refusal message can misreport "Ghidra unavailable" as a corpus/measurement finding.
**How to avoid:** Every task that calls `ghidra.analyze` must set `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` explicitly (or read it from wherever the plan documents it), and should assert on the refusal message's own wording rather than a generic non-zero exit.

### Pitfall 6: Forgetting the corpus binaries are gitignored and operator-supplied
**What goes wrong:** A plan step assumes `danish.d64`/`saeger.d64` will exist on a fresh clone or CI runner.
**Why it happens:** They are real, present, sha256-verified on THIS host, and easy to forget are excluded from git.
**How to avoid:** Every plan task that reads the corpus must fail loudly (not silently skip) if the file is absent, per `evidence/corpus/.gitignore`'s own stated convention (D-04): "the corpus image is never committed... identity is release name plus sha256." Any live/manual test built for this phase should join the `MANUAL_ONLY_TESTS` list (currently 12 entries, `test-gate.mjs:121`) if it becomes a committed `*.test.ts`, exactly as `dxa-live.test.ts`/`ghidra-live.test.ts`/`ghidra-opcode-live.test.ts` did.

## Code Examples

Every command below was run live, on this host, during this research session.

### Extracting the named real release (matches Phase 35's own recorded extraction exactly)

```javascript
// Source: this session, using anno-d64.ts (committed, src/mcp/vice/anno-d64.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { listEntries, extractEntry } from './anno-d64.ts';
const img = readFileSync('.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64');
const entries = listEntries(new Uint8Array(img));
// -> [{"name":"BRUCE LEE   (DC)","type":"PRG","track":17,"sector":0,"sizeBlocks":178}]
const bytes = extractEntry(new Uint8Array(img), entries[0].name);
// -> 45074 bytes, sha256 331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4
```

### Running dxa through the shipped seam, byte-derived ground truth, and reading the result

```javascript
// Source: this session, using dxa-run.ts + dxa-partition.ts (both committed)
import { runDxaDisassemble } from './dxa-run.ts';
import { partitionByteDerived } from './dxa-partition.ts';
import { readFileSync } from 'node:fs';

const root = '<scratch dir, outside the checkout>';
// bl.entrypoints contains "0819\n" -- the extracted .prg's own "10 SYS2073" BASIC line, SYS target
const res = await runDxaDisassemble(
  { image: 'bl.prg', imageKind: 'prg', entrypointsPath: 'bl.entrypoints' },
  { repoRoot: root }
);
// res.map.code.size === 67, res.map.data.size === 45005, res.map.covered.size === 45072

const bytes = readFileSync(root + '/bl.prg');
const partition = partitionByteDerived({ bytes: new Uint8Array(bytes), isPrg: true });
// partition.certainData.size === 24 ($0801-$0818, the BASIC stub)
// partition.certainCode.size === 0  -- ALWAYS, by dxa-partition.ts's own design (A-09)

let recovered = 0;
for (const a of partition.certainData) if (res.map.data.has(a)) recovered++;
// recovered === 24 -- ALL 24 ground-truth-data bytes land in dxa's own "data" classification
```

### Running Ghidra through the shipped seam with no broker running

```javascript
// Source: this session, using ghidra-run.ts (committed)
import { runGhidraAnalyze } from './ghidra-run.ts';

const res = await runGhidraAnalyze({
  runId: 'proof38-smoke-<timestamp>',
  importPath: 'bl.prg',
  processor: '6502:LE:16:nmos',
  importRoute: 'prg',
  noanalysis: true,
}, { repoRoot: '<scratch dir>' });
// res.exitStatus === 0 -- with `systemctl --user is-active vice-broker` == "inactive"
// and no x64sc process running, confirmed both before and after
```

## State of the Art

| Old Approach (Phase 23) | Current Approach (Phase 38) | When Changed | Impact |
|---|---|---|---|
| PROOF-01..03 recorded `could-not-run` — no corpus, no reproducible protocol, no seam | Every instrument exists, corpus is reproducibly capturable (`GATE-01: degrade`, not `no-go`) | Phases 33–37, completed 2026-09-02 through 2026-09-05 | `could-not-run` is no longer a legal spelling for this phase's outcomes; `not-exercised` is, and only for a genuinely searched-and-absent case |
| Ground truth for dxa's rates was "trust the pivot's published numbers" | A committed, independent, two-tier partition script (`DXA-04`), never importing dxa's own output | Phase 35 | The pivot's `72.46%`/`0 FP` figures are demoted to "recorded beside, not as ground truth" |
| No SLEIGH extension; 105 opcode bytes silently misdecoded | `6502:LE:16:nmos`, a real installed Ghidra language | Phase 36 | Crack/packer code (where illegal opcodes are common) decodes correctly for the first time |
| Bank state ($01) unresolved in the join, or naively forward-carried | `anno-bank.ts` decode + `anno-join.ts` reaching-values computation, with a decline path | Phase 37 | PROOF-03's core question already has committed, real evidence — see deep dive above |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | PROOF-02's "corpus" should include a fresh depacked flat-64K capture (option 2), not just the already-reached loader/depacker static bytes (option 1) | PROOF-02 deep dive | If wrong, the plan spends a wave building a capture pipeline the criterion didn't actually require, when citing Phase 36's existing search would have sufficed |
| A2 | Phase 37's `37-06` evidence, re-run under Phase 38's own conventions, is sufficient to satisfy PROOF-03's "in both directions" language without a third, distinct demonstration | PROOF-03 deep dive | If wrong, the verifier could find PROOF-03 under-evidenced even though the underlying measurement is sound; low risk since the two existing transcripts genuinely do cover both stated directions |
| A3 | The PROOF-01 comparator should live as an evidence script (Phase 33's convention) rather than a new shipped `src/` module | Architecture Patterns / PROOF-01 deep dive | If wrong (project wants it reusable/testable), the plan under-invests in test coverage for a piece of logic that computes the milestone's headline numbers |
| A4 | `danish.d64`'s `BRUCE LEE (DC)` (not `saeger.d64`) should be PROOF-01's primary named binary | PROOF-01 deep dive | Low risk — only `danish.d64` is marked `canonical: true` in the gate frontmatter, and Phase 35's own real-image exercise already used it |

**If this table is empty:** N/A — see rows above. Every other claim in this document is `[VERIFIED]` against a source read or a command run this session.

## Open Questions

1. **How deep should PROOF-02's corpus search go?**
   - What we know: Phase 36 searched the loader/depacker stage of both `danish.d64` and `saeger.d64` and found no computed dispatch, explicitly noting the game's packed body was never reached.
   - What's unclear: whether "the corpus now exists" (the ROADMAP's own phrase) means "the corpus Phase 33 can capture (including depacked)" or "the corpus already extracted as static bytes."
   - Recommendation: raise this explicitly in `/gsd-discuss-phase` or have the planner decide directly — this is the single biggest scope/budget decision in the phase (a fresh depacked capture is real, uncompleted engineering work; citing the existing search is close to zero-cost).

2. **Does PROOF-01's false-positive count need a NEW named weakness distinct from the already-disclosed "no independent external check", or does it fold into that same disclosure?**
   - What we know: `certainCode` is always empty for a real release under the byte-derived tier; false positives are structurally uncomputable against it.
   - What's unclear: REQUIREMENTS.md's existing PROOF-01 text names one weakness (no `memmapshow` oracle); this is a second, related but distinct limitation (a ground-truth *design* limit, not merely an absent *oracle*).
   - Recommendation: record it explicitly, named separately, in the plan's own evidence file — conflating the two would understate how thin the real-release measurement is.

3. **Should the PROOF-03 measurement re-run Phase 37's exact scratch-copy technique, or does citing the existing committed evidence files suffice?**
   - What we know: the two `37-06-*-red.md` files already contain the exact numbers and mechanism PROOF-03 needs, built and verified in Phase 37.
   - What's unclear: whether Phase 38's own evidence conventions require a *fresh* transcript (re-run, re-dated, re-attributed to this phase) or whether citation of an already-committed, still-true measurement is acceptable.
   - Recommendation: re-run it (cheap — the fixture, capture, and modules are all already in place; a fresh transcript costs one small plan task) so Phase 38's own evidence directory is self-contained and does not require a reader to cross-reference Phase 37 to verify PROOF-03's claim.

4. **Does PROOF-01 also want `saeger.d64`'s independent crack cross-checked, the way Phase 36 did for PROOF-02's search?**
   - What we know: `saeger.d64`'s extracted entry is plain `"BRUCE LEE"` (no crack-group suffix in the name), same game, different crack.
   - What's unclear: the criterion says "a **named** real cracked release" (singular); it's unclear whether a second release strengthens or merely duplicates the finding.
   - Recommendation: treat as optional strengthening, not a requirement — `danish.d64` alone satisfies the criterion's literal text.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `src/mcp/vice/vendor/dxa/dxa` (built binary) | PROOF-01 | ✓ | 0.1.5 | Rebuildable via `vendor/dxa/build.bash build` if absent |
| `$GHIDRA_HOME` | PROOF-02, PROOF-03 (if a fresh Ghidra run is needed) | ✓ but **not exported by default** | 12.1.3, at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` | Every plan task must set it explicitly; no fallback if genuinely absent (host prerequisite, not vendored) |
| `6502:LE:16:nmos` SLEIGH language | PROOF-02 | ✓ | installed under `$GHIDRA_HOME/Ghidra/Processors/` | Re-installable via `ghidra.installExtension` if a fresh `$GHIDRA_HOME` lacks it |
| `danish.d64` / `saeger.d64` corpus images | PROOF-01, PROOF-02 | ✓ (gitignored, operator-supplied, present on this host) | — | None — genuinely blocking if absent on a different machine; must fail loudly, never silently substitute a synthetic image |
| `src/mcp/vice/fixtures/ghidra/export-bank-path-dependent.txt` | PROOF-03 | ✓ | committed, real capture | None needed — already exists |
| VICE broker + real `x64sc` | Only if PROOF-02 takes the "deeper" (depacked-image) route | ✓ (stock 3.9 at `/usr/bin/x64sc`) | 3.9 | If chosen, this is the ONLY sub-task in this phase needing "stop the broker before test:automated" discipline |

**Missing dependencies with no fallback:** None currently — everything this phase needs is present on this host today.

**Missing dependencies with fallback:** `GHIDRA_HOME` export (trivial, must be set per-task); dxa binary (rebuildable).

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), `src/mcp/vice/*.test.ts`/`*.test.mjs` |
| Config file | none — `test-gate.mjs`'s `automatedTestFiles()`/`MANUAL_ONLY_TESTS` is the one governing list |
| Quick run command | `cd src/mcp/vice && npm run test:automated` (excludes the 12 `MANUAL_ONLY_TESTS`, currently `tests 3519 / pass 3517 / fail 2` per Phase 37's own closing baseline) |
| Full suite command | `npm test` — **do not use**; the whole-glob run does not terminate unaided (standing project baseline, `CLAUDE.md`) |

### Phase Requirements → Test Map

This phase is a **measurement** phase, not a feature phase — its "tests" are evidence-file outcome-line assertions (mirroring Phase 33's `GATE-01` pattern: a `bash -c` check against `grep`-ed outcome lines in a committed `.md` file) rather than conventional unit tests, with one possible exception (the PROOF-01 comparator, if built as a shipped module — see Open Question 3).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROOF-01 | Real-release data-recovery/FP numbers computed and recorded beside fixture figures | evidence-file outcome-line check | `grep -E '^(PROOF01_DATA_RECOVERY_PCT|PROOF01_FALSE_POSITIVES|PROOF01_RELEASE_SHA256): ' evidence/proof01-*.md` | ❌ Wave 0 — evidence dir/schema does not exist yet |
| PROOF-01 (if comparator is shipped) | Comparator computes recovery/FP correctly on hermetic fixtures | unit | `node --test <new comparator>.test.ts` | ❌ Wave 0 — module does not exist |
| PROOF-02 | Computed-dispatch site search recorded, resolved/unresolved/not-exercised stated | evidence-file outcome-line check | `grep -E '^PROOF02_(COMPUTED_DISPATCH|SITES_ENUMERATED): ' evidence/proof02-*.md` | ❌ Wave 0 |
| PROOF-03 | Bank-boundary measurement recorded, both directions stated | evidence-file outcome-line check + reuse of existing `anno-bank.test.ts` planted-violation cases | `grep -E '^PROOF03_.*: ' evidence/proof03-*.md`; `node --test anno-bank.test.ts` (already green, already covers the underlying mechanism) | ⚠️ Partial — `anno-bank.test.ts` already exists and passes (18 cases incl. 2 planted violations); only the Phase-38-badged evidence file is Wave 0 |

### Sampling Rate

- **Per task commit:** the relevant evidence-file outcome-line grep, plus `npm run test:automated` (broker stopped) if any shipped module changed.
- **Per wave merge:** full `npm run test:automated`, `npm run typecheck`.
- **Phase gate:** `npm run test:automated` green at its documented floor (currently 2 pre-existing `anno-register.test.ts` failures, unrelated to this phase — do not adopt "0 failures" as this phase's own acceptance bar; the floor is a recorded baseline per `evidence/DECISION-RULE.md`'s "Never a gate" convention, reused across every phase in this milestone).

### Wave 0 Gaps

- [ ] `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/README.md` — evidence conventions (mirror Phase 33's), if this phase wants its own schema rather than reusing Phase 23's `docs/phaseNN-*-findings.md` outcome-line style directly
- [ ] `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/SCHEMA.md` — the PROOF-01/02/03 outcome-line names, committed BEFORE any measurement is taken (mirrors `GATE-01`'s own "rules committed before measurement" discipline, though PROOF-01..03 are not gate-and-rule-shaped the way `GATE-01` was — this is a lighter-weight "declare the outcome-line vocabulary first" step, not a full rule table)
- [ ] The PROOF-01 comparator itself (evidence script or shipped module — undecided, Open Question 3)
- [ ] Framework install: none — `node --test` and every dependency already present

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`). This phase has no user-facing surface, no authentication, no session management, and touches no new external package. The relevant category is input handling of untrusted binary corpus material fed to two external tools (dxa, Ghidra/JVM).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | N/A — no user-facing auth surface |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Already enforced by the existing seam: `confineToWorkspace()` in both `dxa-run.ts` and (equivalently) `ghidra-run.ts` refuses any path outside the declared root; `SEAM-02`'s typed per-tool allowlist with no argv passthrough already bars arbitrary command construction from corpus content |
| V6 Cryptography | partial | sha256 is used for release-identity verification only (integrity, not confidentiality) — `dxa-run.ts`/evidence scripts should assert the corpus file's sha256 matches the recorded value BEFORE processing it, exactly as Phase 33's `capture-pair.mjs` does ("the script refuses outright when the file on disk digests to anything else") |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A crafted/corrupted corpus binary causing dxa or Ghidra to misbehave (crash, hang, resource exhaustion) | Denial of Service | Already out of scope to newly mitigate here — dxa and Ghidra are host-installed, version-pinned tools this project does not patch; a plan task should simply time-bound any `ghidra.analyze` call (the seam already supports a per-run project directory + `-deleteProject`, `SEAM-04`) |
| A same-named-but-different corpus file silently substituted between measurement runs | Tampering | Assert sha256 before every measurement, exactly as `capture-pair.mjs`'s own convention ("Identity is name plus digest over the exact bytes... the script refuses outright when the file on disk digests to anything else") |
| A new evidence script spawning `dxa`/`analyzeHeadless` directly instead of through the seam | Elevation of Privilege / seam bypass | `SEAM-05`'s whole-tree grep gate (already wired into CI per Phase 34) catches this; do not disable or narrow it for this phase |

## Sources

### Primary (HIGH confidence — read this session)

- `src/mcp/vice/dxa-partition.ts` (full read) — `certainCode` always-empty design, `formatPercent()`, both tiers
- `src/mcp/vice/dxa-run.ts` (full read) — `runDxaDisassemble()`, `confineToWorkspace()`, host/container route selection
- `src/mcp/vice/dxa-listing.ts` (partial read) — `DumpListingMap` shape
- `src/mcp/vice/ghidra-run.ts` (partial read) — `runGhidraAnalyze()`, `GhidraRunOptions`
- `src/mcp/vice/host-tool-client.ts` (partial read) — host-vs-container route selection, `isInsideContainer()`
- `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` (partial read) — export section format, `COMPUTED_JUMP_RESOLVED`
- `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a` (full read) — the PROOF-03 fixture
- `.planning/notes/dxa-ghidra-pivot-evidence/fixture.a` (partial read) — the PROOF-02 pivot fixture's `ldx #$02` construct
- `.planning/phases/23-the-real-release-gate-go-degrade-no-go/23-08-PLAN.md` (partial read) — the never-dispatched PROOF-02 design, D-06 circularity guard
- `.planning/phases/35-dxa-vendored-and-parsed/evidence/35-dxa03-real-image.md`, `35-03-SUMMARY.md`
- `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-07-corpus-before-after.md`, `36-07-acceptance-run.md`
- `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/37-06-bank-decode-bypass-red.md`, `37-06-path-dependent-decline-red.md`, `37-06-SUMMARY.md`
- `docs/phase23-real-release-gate-findings.md`, `docs/phase33-reproducible-run-gate-findings.md`
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 33/34/35/36/37/38 sections), `.planning/STATE.md`
- Live commands this session: `.d64` extraction, `runDxaDisassemble()` (twice — no entry points, one entry point), `partitionByteDerived()`, `runGhidraAnalyze()` smoke run — all shown verbatim in "Code Examples"

### Secondary (MEDIUM confidence)

- None — every finding above was either read from a committed source or independently re-verified this session; no WebSearch was performed (this is a fully internal, repo-grounded measurement phase with no external library/API questions).

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every instrument's location and invocation verified live this session
- Architecture: HIGH — the host-route-no-broker-needed finding and the `certainCode`-always-empty finding were both independently re-verified against real code and real live runs, not inferred from prose
- Pitfalls: HIGH — every pitfall above is grounded in either a committed doc comment or an error message this session actually triggered

**Research date:** 2026-09-05
**Valid until:** Effectively pinned to this milestone (v0.8.0) — the instruments this phase depends on are locked at their Phase 33-37 state; re-validate only if any of those phases' modules are amended, or if `GHIDRA_HOME`'s installation moves.
