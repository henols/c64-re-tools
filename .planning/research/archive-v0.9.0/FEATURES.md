# Feature Research

**Domain:** Runtime dynamic-analysis / execution-evidence layer for a static C64
reverse-engineering toolchain (text-monitor channel, `memmapshow`/`prof`/`chis`/`bt`/`io`,
and three VICE standalone preprocessing binaries: `c1541`, `petcat`, `cartconv`)
**Researched:** 2026-09-06
**Confidence:** MEDIUM-HIGH (VICE manual and tool source are HIGH-confidence primary
sources; mapping of general dynamic-analysis/coverage-tooling practice onto this
project's specific store design is a synthesis and is scored MEDIUM)

## Ground rules carried in from required reading (not re-derived here)

- **Soundness asymmetry is load-bearing, not a style choice.** An address observed
  executing **is** code (proof). An address never touched proves **nothing** — a
  single run licenses `code` and can **never** license `data`. Every feature below
  that touches classification is checked against this; anything that would silently
  promote absence-of-execution into a `data` claim is marked an **anti-feature**,
  full stop, matching the design already fixed in
  `.planning/seeds/runtime-evidence-layer.md`.
- **Already decided, not re-proposed:** the evidence layer is a separate,
  monotonically-accumulating, run-keyed store joined against the block table by a
  query that reports agreement *and* disagreement — never a silent overwrite or a
  promotion into `BlockClass`'s three-valued (`code | data | undefined`) vocabulary.
  Both alternatives (promote-into-block-table, live-only-nothing-persisted) are
  already rejected with reasons in the seed. This document does not revisit that
  choice; it surveys what *shape* of feature work sits on top of it.
- **`PROJECT.md`'s `### Out of Scope` is binding.** Nothing below re-proposes: VICE
  event record/replay as the reproducibility mechanism (measured absent — `x64sc
  -record` exits 255), the text monitor's `stopwatch` as a capture route,
  `-limitcycles` or text-monitor `bsave` as capture routes, a persisted
  `program.json` parallel model, bank-qualified addressing as a *modelled store*
  feature, a Ghidra post-script writing `.annostore` directly, vendoring Ghidra, or
  the text monitor's assembler/disassembler/`x64`↔`x64sc` switching (declined
  2026-09-06, on the record, for the exact reason this milestone already has two
  disassembly engines). Where research below touches one of these boundaries, it
  is flagged explicitly and not re-argued.

---

## Feature Landscape

### A. Text-monitor channel and command surface

The channel itself (a `channel: "binary" | "text"` discriminator on `monitorClient`,
proven-safe coexistence with the binary client) is this milestone's own gating
prerequisite (its hypothesis H1) and is not re-derived here — it is the **root
dependency** for every row below in sections B–D. What *is* in scope for this
research is what a client does once the channel is open.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-seam text-response parser (one module per command format: `memmapshow`, `prof flat`, `chis`, `bt`, `io`) | The seed itself names this as needed first: "real surface area with real drift risk across VICE versions... one module owns each format, fixtures pinned". This is the same discipline `hostpath.ts`/`vice.ts` already apply elsewhere in this codebase | MEDIUM–HIGH | Human-formatted text, not a binary wire format — no schema to lean on. VICE's own text-console output is not contractually stable across releases (unlike the binary-monitor opcode set); fixtures must be pinned per VICE version the same way the binary client already version-gates `CPUHISTORY_GET`. Directly reuses the `capability-registry.ts` version-gating pattern from v0.2.0, applied to a text-format axis instead of an opcode axis |
| `device c:` issued before any drive-side text-channel command | Already-known remedy for `default_memspace` contamination (a CLAUDE.md-documented pitfall with **no binary-monitor remedy**) — this milestone is what makes the remedy reachable at all | LOW | Direct dependency: nothing new to design, just a call that must precede any drive-scoped `memmapshow`/`chis`/`bt` use. Names a concrete cross-feature link: drive-side runtime evidence (§E) is gated on this |

**Anti-feature (already decided, named for completeness):** VICE's text-monitor
assembler/disassembler (`a`/`d`) and `x64`↔`x64sc` mode switching. `PROJECT.md`
records this as declined on the spot, 2026-09-06, because it would be "a fourth
classifier nobody asked for" against two already-owned disassembly engines. Not
revisited here; research surfaced nothing that reopens it.

---

### B. The runtime code/data oracle (`memmapshow`)

**How comparable toolchains present this.** Three independent survey points, all
converging on the same UX shape:

1. **radare2's `dt`/`dtc`/`dtg` family** keeps instruction/call traces as their own
   named, addressable objects (`dt [addr]`, `dt*` lists all traced opcode offsets,
   `dtc` traces calls specifically, `dtg` renders a call/return graph) — entirely
   separate from `aa`'s static analysis results. radare2 never merges a trace into
   the static type/flag database; a trace is queried *against* the static view.
   This is independent confirmation the seed's "keep it a separate, joined layer"
   design is the standard shape, not a novel one.
2. **Ghidra's coverage-overlay plugins** (`Cartographer`, `dragondance`, and the
   older `Lighthouse`, all consumed via the DRCOV trace format) work by loading a
   *pre-collected* per-address execution bitmap and highlighting it directly in
   the Listing/Decompiler views — overlay, not overwrite. The practitioner-facing
   behavior these tools converge on: unremarkable when execution agrees with the
   static view (just a highlight), and the actual analytic payoff is scanning for
   addresses where the *static* view claims one thing (a function, a data table)
   and the highlighted coverage disagrees (partial coverage inside a claimed
   function, or coverage landing inside a claimed data range).
3. **gprof-family flat profiles** (see §D) are the same shape one level up: ranked
   by self time, and the actionable read is "what's at the top", not "what's
   present at all".

**What good UX for this project's "bytes say data, execution says code" oracle
looks like**, synthesized from the above and consistent with the seed's own
framing that "disagreement is the highest-value output of the whole design":

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| A joined query returning **only disagreement rows** (byte-classifier says `data`/`undefined`, runtime observed `EXECUTE`) as its headline output, with agreement summarized as a count rather than enumerated | Matches the coverage-tool convention above: agreement is unremarkable and would drown the signal if listed row-by-row across a 64K image; disagreement is rare and is exactly the packer-unfolded / self-modifying / table-driven-jump signal the disassembly workflow (`docs/dissambler-workflow.md`) cannot resolve statically | MEDIUM | Depends on: `block-class.ts`'s existing three-valued classifier (read-only consumer, not a schema change) and the new evidence-layer tables. This is the concrete shape of "a query joins the two and reports agreement and disagreement" from the seed — this research adds *which side to foreground* |
| Each disagreement row carries the **denominator** (how many runs / which run identities observed `EXECUTE` there, how many never reached it) | Both surveyed coverage tools and the seed agree: a single "executed" bit without a run-count is a weaker fact than an accumulated one. The seed states this explicitly ("$9C00 never executed is only meaningful with the denominator attached") | LOW (mostly a `COUNT(*) GROUP BY address` over already-keyed rows) | Depends on run-identity keying, §C |
| Cross-checking `io <addr>`'s decoded register semantics against the existing v0.2.0 client-side VIC-II/CIA decoder, as a second independent oracle, with *its own* disagreement report | Same "two independent classifiers, compare rather than trust one" philosophy this project already applies to dxa vs. Ghidra. A genuine second oracle is a differentiator; a silent duplicate that replaces the existing decoder is not | LOW–MEDIUM | **Only** a differentiator if wired as a second, comparable source with a disagreement report. Wired as a drop-in replacement with no comparison, it is redundant maintenance for no new information — flag this fork in the road explicitly when scoping, don't default to "replace" |
| `bt` (JSR chain) run at checkpoint hits, cross-referenced against Ghidra's static call graph to surface calls the static CFG missed (classic value of dynamic call-graph recovery — indirect calls/jumps through computed addresses) | This is the single most-cited reason dynamic tracing beats static CFG recovery in every surveyed toolchain (Ghidra/radare2 alike): indirect control flow is exactly where static analysis is weakest and dynamic observation is strongest | MEDIUM | One-shot, not a bulk source (the seed already says this — "useful at a checkpoint hit rather than as a bulk source"). Depends on the store's existing cross-reference machinery (`STORE-06`) as the static side of the comparison |

**Anti-features (soundness-asymmetry violations — hard no, matching the seed's
already-rejected alternatives):**

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Auto-writing `data` into `.annostore`'s per-range type for any address with zero `EXECUTE` observations across all runs to date | Looks like "free" coverage of the data-recovery numbers `PROOF-01` already tracks | Directly violates the soundness asymmetry: absence of execution is not evidence of `data`, only evidence of "not yet reached." A wrong write here is unrecoverable in the same way the seed already names for confidence-bracket promotion | Keep it query-only: report "never executed across N runs" as a strengthening *statement*, never a write |
| Promoting `EXECUTE`-observed addresses directly into `block-class.ts`'s type field under a confidence threshold | Fewer moving parts, one classifier instead of three | Already rejected in the seed verbatim — "collapses two independent classifiers into one, destroys the disagreement signal, and a wrong promotion is unrecoverable" | The join-query design already chosen |

---

### C. Run identity and reproducibility

**Survey finding:** with native event record/replay measured absent (confirmed:
`event.c` has six options, none `-record`; `x64sc -record` exits 255), every
comparable emulator-based workflow (TAS communities, embedded-fuzzing-to-Ghidra
pipelines like the Lauterbach/SCHUTZWERK writeup, and this project's own already-
built capture protocol) converges on the same two-tier mechanism, not a
single silver bullet:

1. **Savestate + checkpoint bracket is table stakes**, and this project already
   has it. The frame-exact reproducible-run protocol (`REPRO-01..05`) and the
   `.vsf`-slice capture (`CAP-01..04`) already key a run by `(binary sha256, argv
   digest, seed)` — exactly the denominator the evidence layer needs. **This is
   not new work for the evidence layer to invent; it is a direct reuse of an
   already-shipped key.** The "which bracket" axis is likewise already solved:
   checkpoint hit-count deltas are the existing, regression-pinned mechanism
   (`vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant).
2. **Scripted input is the differentiator**, and it is two-tier itself:
   - `-keybuf <string>` (confirmed in the VICE manual: "Put the specified string
     into the keyboard buffer") is launch-time, deterministic, and ASCII/hex-
     escapable — but the manual documents **no injection timing or length limit**,
     so treating it as a scenario primitive needs an empirical probe (measure,
     don't assume) before it's load-bearing, the same discipline this project
     already applied to `warp`/`CPUHISTORY_GET`/`default_memspace`.
   - Scripted joystick/port sequences via the existing binary-monitor
     `JOYPORT_SET` tool, applied at exact checkpoint-bracket boundaries — this is
     precisely the pattern TAS-style tooling uses in the absence of native replay:
     savestate + deterministic per-frame input write, not a recorded stream.
     `-keybuf` alone only reaches "past the loader"; a scenario that needs to be
     "past the title screen, mid-level" needs this second mechanism.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Key every evidence row by the existing `(binary sha256, argv digest, seed)` capture-record tuple, not a new identity scheme | Reuses `CAP-01..04` verbatim; zero new design surface for "which run" | LOW | Hard dependency: `CAP-01..04`, the `.vsf`-slice capture protocol |
| Checkpoint-hit-count brackets as the "which scenario boundary" primitive | Already regression-pinned (`vice-sync.ts`); no new mechanism | LOW | Hard dependency: the documented "exactly one resume per wait; poll on `hit_count`" invariant — must not be re-derived, only reused |
| `-keybuf` as a deterministic launch-time scenario primitive (get past a BASIC loader / simple prompt reproducibly) | Differentiator over "just autostart and hope": lets a scenario definition be text, versioned, and diffable | MEDIUM (needs an empirical timing/length probe first — VICE's own docs don't say) | Table-stakes-adjacent: cheap, and this project already treats "confirm empirically before designing around it" as standard practice (13-check binary-monitor probe, the `chis`/`warp`/`memspace` corrections in the live-probe note) |
| Scripted `JOYPORT_SET` sequences at checkpoint boundaries as a scenario primitive for in-game (not just loader) reproducibility | The only route to a repeatable *gameplay* scenario without native replay — matches how TAS-style tooling solves the identical absence-of-replay problem elsewhere | HIGH | Real complexity: requires a director loop (checkpoint hit → write input → resume → next checkpoint), and interacts directly with the still-open interleaved binary/text coexistence question (H1). Should not be scoped before H1 is resolved |

**Anti-features (already excluded in `PROJECT.md`, named for completeness, not
reopened):** VICE event record/replay as the reproducibility mechanism (does not
exist); the text-monitor `stopwatch`/`sw` as a capture or bracket denominator
(it is a raw cumulative `clk` counter, not address-keyed — confirmed again by this
research: it answers "how long", never "which addresses", so it cannot serve as
an evidence-row key even in principle); `-limitcycles` and text-monitor `bsave` as
capture routes.

---

### D. Profiling as a triage tool (`prof flat N`)

**Survey finding (gprof, the canonical flat-profile precedent):** flat profiles
are conventionally sorted "first by decreasing run-time spent in them, then by
decreasing call count, then alphabetically" and the documented practitioner
workflow is exactly "start with the top of the list" — self time is the intended
triage signal, not total/cumulative time, precisely because self time answers
"where is this program actually spending its cycles" without being inflated by
callees. `prof flat N`'s existing measured shape (self **and** total cycles,
ranked and percentaged) already matches this convention.

**What the first-pass question actually is, for a 64K image:** not "what does
this code do" (that's Ghidra's job) but "which of the ~145/131/3-region split
this project's own dxa partition already produces is worth a human's attention at
all" — i.e., profiling is a **prioritization filter over static analysis**, not a
classifier. The seed says this directly: "profiling tells you which of those
regions is worth a human's attention at all."

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| `prof flat N` output parsed into `(address, self%, total%, hit-count)` rows and joined against **existing store labels/ranges** (not a bare address list) | Bare addresses force a human back to `anno_get_address_details` per row; joining against the store turns "the top 5 hottest addresses" into "the top 5 hottest *named/typed* regions" in one query — directly actionable | MEDIUM | Depends on: the store's existing label/range query surface (`anno_*` search), and the run-identity keying in §C so a profile is attributable to a specific scenario, not an ambient "the profiler ran at some point" |
| Address-range rollup (map a flat per-function address to the containing dxa/Ghidra-recovered function boundary, not just the leaf address `prof` reports) | `prof flat`'s addresses are individual function entry points; without rolling up to known boundaries, adjacent inlined/jump-table-adjacent code fragments look like separate, smaller entries than they are | MEDIUM | Depends on: dxa/Ghidra's already-recovered function boundaries in the store |
| Ranked report as **the** entry point into a fresh, unfamiliar 64K image — i.e., "run `prof flat`, look at rows 1–5, start there" as the documented first move in the disassembly workflow | Matches the surveyed gprof convention exactly (sort order *is* the UX) and closes the loop `docs/dissambler-workflow.md` draws but cannot feed today | LOW (mostly a documentation/skill-playbook concern once the parse+join above exists) | This is a skill-doc feature, not a code feature — cheap once B/C exist |

**No anti-features surfaced here.** Profiling is inherently sound-positive in the
same way execution observation is (hit ⇒ executed ⇒ code), so it does not create
a new soundness-asymmetry risk — it is a ranking over addresses already known to
have executed, not a claim about addresses that didn't.

---

### E. Disk-level analysis (`c1541`)

**What `c1541`'s low-level surface gives that plain file extraction does not:**
plain extraction (reading a `.d64`'s directory and pulling the named file) trusts
the disk's own claimed structure completely. `c1541`'s `bam` (allocation bitmap),
`chain` (walk a file's actual sector-link chain from a given track/sector), and
`bpeek`/`bpoke`/`block` (raw sector-level read/write bypassing the filesystem
layer entirely) let a reverse engineer see the **physical layout independent of
what the directory claims** — exactly the surface fastloaders and copy-protection
schemes target (non-standard sector interleave, sectors marked free in the BAM
that a loader reads anyway, chains that loop or point outside the claimed file).

**Table stakes vs. differentiator, as asked:**

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Static structural read: `bam` + `chain` + `block`/`bpeek` walked into a JSON preprocessing artifact (claimed sector chain, BAM allocation state, per-block raw bytes) | This is the direct, offline, well-documented (official VICE manual + Debian manpages) capability the milestone context names; no protocol risk, `c1541` is a mature standalone tool with a stable batch-mode command set | LOW–MEDIUM | Reached over `host_tool`, same pattern as the six existing host tools (`acme`, `dxa`, `analyzeHeadless`, etc.) — a straightforward seventh/eighth/ninth entry, not a new pattern |
| `bpoke` (raw sector write) as a **test-fixture-construction** utility (building synthetic copy-protection scenarios for the project's own test suite, in the same spirit as `PROOF-03`'s synthetic fixture) | Useful, but narrower than a core analysis capability — this project is analysis-only against real disks; write access is for building controlled test inputs, not for the RE workflow itself | LOW | Scope this as a test-infrastructure differentiator, not a headline analysis feature — avoid over-claiming it as part of the "real" RE capability set |

**The actual fastloader/copy-protection signal — differentiator, and genuinely
hard, not glossed:**

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Comparing the disk's **claimed** chain (from `c1541`, static) against the sectors a loader **actually reads** at runtime | This is the real signal named in the question — the gap between claimed structure and observed drive behavior is exactly where non-standard loaders and protection schemes live, and no static tool alone can produce it | HIGH | `c1541` itself is offline-only and cannot observe runtime reads at all — the runtime half needs the **drive CPU's own execution**, observed via drive-scoped checkpoints/`memmapshow`, which requires `Drive8TrueEmulation` + non-zero `Drive8Type` (documented gate — with true drive emulation off, drive memory reads are **silent zeros, not an error**) and the `device c:` remedy for `default_memspace` contamination this same milestone's text channel newly makes reachable (§A). This is a real, direct same-milestone dependency chain worth naming explicitly to whoever scopes phases: the disk-analysis differentiator is gated on the text-channel work, not merely adjacent to it |

---

### F. BASIC stub decoding (`petcat`)

**How this is used in practice:** `petcat` detokenizes a `.prg`'s BASIC portion
into readable text; the standard convention (confirmed by the VICE manual and
community tutorials) is a stub line containing a `SYS <address>` statement whose
argument is the machine-code entry point — the practitioner's actual first move
on an unfamiliar `.prg` is "detokenize, find `SYS`, that address is where the real
disassembly starts", spending zero disassembler time on the BASIC wrapper itself.

**Failure modes, which is exactly what the question asks for:**

- **Computed/obfuscated `SYS` argument.** Not every stub is a literal `10 SYS
  2064`. Crack/protection stubs commonly compute the target from zero-page
  `PEEK`s (`SYS PEEK(43)+256*PEEK(44)`), arithmetic (`SYS 49152+X`), or a value
  set by a prior `POKE`/loop — a plain regex for `SYS \d+` silently fails (finds
  nothing) or silently misleads (finds a decoy literal inside a `REM` or string
  literal that is not the real target).
- **Non-standard load address.** The convention assumes BASIC starts at `$0801`;
  loaders that relocate BASIC (e.g., to `$1C01` under a different memory
  configuration) break any hard-coded assumption about where the stub begins.
- **Packed/obfuscated stub itself.** A stub that is itself compressed or whose
  tokens have been hand-patched to defeat naive detokenizers is a real, observed
  crack-scene technique — `petcat` will still detokenize the bytes it's given,
  but the *human-readable* result may still require manual reading rather than
  automated extraction.
- **Multi-statement / `REM`-hiding lines.** BASIC lines separated by `:` and
  `REM` comments that contain binary-looking bytes are a known way to hide data
  or defeat naive line-oriented parsing.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| `petcat`-based detokenize → regex-extract literal `SYS <decimal>` as the fast path | Handles the large majority of real stubs (the "standard" case) essentially for free, before any disassembler time is spent | LOW | Reached over `host_tool`, same pattern as the other five |
| A **named, disclosed decline** (not a silent wrong guess) when the `SYS` argument is not a literal decimal — mirroring this project's own existing convention (dxa/Ghidra's "decline with a reason rather than a confident wrong comment wherever bank state is path-dependent") | Directly matches the project's own established engineering discipline (`AUTO-*`'s bank-state declines) rather than introducing a new failure philosophy | LOW | This is a **direct precedent match**, not new design — reuse the existing decline pattern verbatim rather than inventing a confidence score for entry-point guessing |
| Computed-argument resolution (tracing the `PEEK`/arithmetic expression) | Would recover the entry point even from obfuscated stubs | HIGH, and arguably out of this milestone's actual ask — the question only asks what `petcat` gives before any disassembler is spent; resolving a computed expression **is** disassembly-adjacent work | Flagged as a candidate differentiator for later, not this milestone: the "decline with a reason" answer above is the correct v0.9.0-shaped scope, and reaching further risks re-deriving a mini-interpreter that the two owned disassembly engines already do better |

---

### G. Cartridge handling (`cartconv`)

**How much bank-structure output actually changes the starting representation:**
a real, non-cosmetic amount — genuinely more than "which flag do I pass". Many
CRT types are bank-switched (multiple 8K/16K ROM banks mapped in and out via
I/O-triggered bank registers, not all resident at the same address
simultaneously); treating a CRT as a flat `$8000–$9FFF` window silently analyzes
**only whichever bank happens to be resident at dump time** and never sees the
others at all — not a degraded view, a **missing** one. `cartconv`'s own header
parsing already identifies cartridge type and bank count/size directly from the
well-documented CRT header format.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| `cartconv`-driven CRT→per-bank flat image splitting, each bank exported as its own normalized image (matching the "segments" concept `docs/dissambler-workflow.md` already sketches for banked ROMs) | This is the actual value: without it, bank-switched cartridges are **structurally invisible** past bank 0 to both dxa and Ghidra, not merely less convenient to analyze | LOW–MEDIUM | `cartconv`'s CRT-type/bank-count identification is well-documented and stable; the harder part is *what this project does with N banks*, addressed below |
| Analyze each split bank as **its own independent image**, through the existing single-bank-at-a-time dxa/Ghidra flow, rather than modeling banks inside `.annostore` | Reuses the entire existing pipeline unchanged — N banks are N images, not a new addressing dimension | LOW | **Hard constraint, not a suggestion:** `PROJECT.md`'s Out of Scope explicitly excludes "bank-qualified addressing as a modelled store feature" (named twice, v0.7.0 and v0.8.0 audits). `cartconv`'s bank split must feed the *existing* single-image-at-a-time flow, never motivate reopening that exclusion. This research found nothing that should reopen it — multiple independent per-bank images is a complete, correct answer that doesn't need bank-qualified store addressing at all |

**No anti-feature surfaced specific to `cartconv` beyond the constraint above** —
the tool's identification/splitting role is narrow and well-bounded by the CRT
header format itself.

---

## Feature Dependencies

```
Text-monitor channel client (H1, this milestone's own gate)
    └──requires──> coexistence proof: binary + text clients, interleaved commands
                   (Unverified — the seed and PROJECT.md both name this as the
                   thing everything else in this file sits behind)

Runtime evidence layer (§B)
    ├──requires──> Text-monitor channel client (parses memmapshow/prof/chis/bt/io)
    ├──requires──> Run-identity keying (§C) — reuses CAP-01..04's
    │              (binary sha256, argv digest, seed) tuple, not a new scheme
    ├──requires──> block-class.ts's existing three-valued classifier (read-only
    │              join target — never mutated by the evidence layer)
    └──enhances──> the dxa/Ghidra disassembly workflow (docs/dissambler-workflow.md):
                   profiling (§D) directs which regions are worth Ghidra's/a
                   human's attention; disagreement rows (§B) surface exactly the
                   packer/self-modifying/table-dispatch cases both static
                   engines guess at

Disk fastloader signal (§E, differentiator half)
    └──requires──> Text-monitor channel client's `device c:` remedy for
                   default_memspace contamination (§A) — a same-milestone
                   dependency, not a future one
    └──requires──> Drive8TrueEmulation + non-zero Drive8Type (existing documented
                   gate; silent zeros otherwise, not an error)

BASIC-stub decoding (§F) ──feeds──> disassembly entry point selection
                                    (dxa/Ghidra already own everything past this)

Cartridge bank splitting (§G) ──feeds──> N independent per-bank images through the
                                          EXISTING single-image dxa/Ghidra flow
                                          (does NOT feed a bank-qualified store —
                                          that remains explicitly out of scope)

host_tool control op (existing, SEAM-01..07)
    └──required by──> c1541, petcat, cartconv (three new host binaries, same
                       pattern as acme/dxa/analyzeHeadless — never spawnSync'd
                       from a skill script)
```

### Dependency Notes

- **Everything in §B–E depends on H1 (text-channel coexistence).** This is not a
  new finding — it's restated here because every complexity estimate above
  assumes H1 resolves favorably; if interleaved binary+text commands corrupt each
  other's view, the whole evidence-layer feature set is blocked, not degraded.
- **Run identity is reused, not designed.** `CAP-01..04`'s `(binary sha256, argv
  digest, seed)` key is the correct denominator for evidence rows; this research
  found no reason to invent a second identity scheme.
- **The disk fastloader differentiator and the text-channel work are the same
  milestone, not sequential milestones** — the `device c:` fix that makes
  drive-side checkpoints usable is delivered by this same phase's text channel,
  which is worth flagging explicitly since it changes the natural ordering: the
  text channel isn't just a prerequisite for §B, it's also a prerequisite for
  §E's hardest differentiator.
- **Bank-qualified addressing stays out of the store, permanently, per two prior
  audits.** `cartconv`'s bank split must resolve to "N images," never to "one
  image with a bank axis."

---

## MVP Definition

### Launch with (v0.9.0, assuming H1 resolves favorably)

- [ ] Text-channel parser for `memmapshow`/`prof flat`/`chis`/`bt`/`io`, one seam
      per format, fixtures pinned — the prerequisite for everything else here
- [ ] Evidence rows keyed by the existing `(binary sha256, argv digest, seed)`
      run-identity tuple — no new identity scheme
- [ ] Agreement/disagreement join query over the evidence table and
      `block-class.ts`, **surfacing disagreement rows as the headline output**
      and agreement as a summary count — matches the surveyed coverage-tool
      convention (Cartographer/dragondance/radare2's `dt`) and the seed's own
      framing
- [ ] `prof flat N` parsed and joined against existing store labels/ranges —
      turns "top 5 hot addresses" into "top 5 hot named regions"
- [ ] `c1541` static structural preprocessing (`bam`/`chain`/`block`) over
      `host_tool`, as a JSON artifact — table stakes, no protocol risk
- [ ] `petcat` detokenize → literal `SYS <decimal>` fast path, with a **named,
      disclosed decline** (not a silent guess) on any non-literal argument —
      direct reuse of the project's existing decline convention
- [ ] `cartconv`-driven CRT bank splitting into N independent flat images fed
      through the existing single-image dxa/Ghidra flow

### Add after validation (v0.9.x / v1.0.0)

- [ ] `-keybuf` as a versioned, diffable scenario-definition primitive — needs an
      empirical timing/length probe first (VICE's own docs don't specify either)
- [ ] `io <addr>` wired as a genuine second independent oracle against the
      existing v0.2.0 client-side VIC-II/CIA decoder, with its own disagreement
      report — trigger: a concrete case where the two disagree is found
- [ ] `bt`-at-checkpoint cross-referenced against Ghidra's static call graph, to
      surface indirect-call/jump targets the static CFG missed

### Future consideration (v1.x+)

- [ ] Scripted `JOYPORT_SET` sequences at checkpoint boundaries, as the route to
      genuinely repeatable *gameplay* scenarios (not just past-the-loader) —
      defer until H1's interleaved-command question is fully settled, since this
      is the highest-complexity, highest-coordination item in the whole set
- [ ] Drive-side checkpoint/`memmapshow` correlation for the full claimed-vs-
      actual sector-read fastloader signal — defer past the static `c1541`
      preprocessing table-stakes item; this is real, hard work gated on
      `Drive8TrueEmulation` plus the text channel's `device c:` remedy
- [ ] `petcat` computed-`SYS`-argument resolution (tracing `PEEK`/arithmetic
      expressions) — arguably belongs to the disassembly engines, not `petcat`
      preprocessing; revisit only if the "decline with a reason" answer proves
      insufficient in practice

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Text-channel format parsers (memmapshow/prof/chis/bt/io) | HIGH | HIGH | P1 |
| Evidence rows keyed by existing run-identity tuple | HIGH | LOW | P1 |
| Agreement/disagreement join, disagreement-first presentation | HIGH | MEDIUM | P1 |
| `prof flat` joined against store labels | HIGH | MEDIUM | P1 |
| `c1541` static structural preprocessing | HIGH | LOW-MEDIUM | P1 |
| `petcat` SYS-literal fast path + disclosed decline | MEDIUM-HIGH | LOW | P1 |
| `cartconv` bank splitting into N images | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| `-keybuf` scenario primitive (post-probe) | MEDIUM | MEDIUM | P2 |
| `io` as second independent oracle | LOW-MEDIUM | LOW-MEDIUM | P2 |
| `bt`-at-checkpoint vs. static call graph | MEDIUM | MEDIUM | P2 |
| Scripted `JOYPORT_SET` gameplay scenarios | HIGH | HIGH | P3 |
| Drive-side claimed-vs-actual sector reads | HIGH | HIGH | P3 |
| `petcat` computed-argument resolution | LOW-MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Directly answers this milestone's four stated hypotheses
- P2: Genuine value, but reasonably deferred a beat without blocking the milestone
- P3: Real and named, but each has an explicit gating dependency (H1's
  interleaved-command question, or drive-emulation correctness) that should
  resolve first

---

## Sources

- [VICE Manual — Invoking the emulators (`-keybuf`)](https://vice-emu.sourceforge.io/vice_2.html) — HIGH confidence, primary/official
- [VICE Manual — c1541](https://vice-emu.sourceforge.io/vice_14.html) — HIGH confidence, primary/official
- [c1541(1) — Debian manpages](https://manpages.debian.org/testing/vice/c1541.1.en.html) — HIGH confidence, primary/official
- [VICE Manual — petcat](https://vice-emu.sourceforge.io/vice_16.html) — HIGH confidence, primary/official
- [Tokenize/De-tokenize Commodore Basic Programs Using petcat](https://techtinkering.com/articles/tokenize-detokenize-commodore-basic-programs-using-petcat/) — MEDIUM confidence, community tutorial
- [VICE Manual — cartconv](https://vice-emu.sourceforge.io/vice_15.html) — HIGH confidence, primary/official
- [VICE cartconv.txt (source doc)](https://github.com/martinpiper/VICE/blob/master/doc/cartconv.txt) — HIGH confidence, primary/official
- [dt — Radare2 wiki (Display instruction traces)](https://r2wiki.readthedocs.io/en/latest/options/d/dt/) — MEDIUM-HIGH confidence, project-adjacent community docs
- [Radare2 Code Analysis book](https://book.rada.re/analysis/code_analysis.html) — MEDIUM-HIGH confidence, official book
- [Cartographer — Code Coverage Exploration Plugin for Ghidra (NCC Group)](https://github.com/nccgroup/Cartographer) — HIGH confidence, primary source repo
- [dragondance — Binary code coverage visualizer for Ghidra](https://github.com/0ffffffffh/dragondance) — HIGH confidence, primary source repo
- [GNU gprof — Flat Profile](https://sourceware.org/binutils/docs/gprof/Flat-Profile.html) — HIGH confidence, primary/official
- [GNU gprof — How to Understand the Flat Profile](https://www.math.utah.edu/docs/info/gprof_5.html) — HIGH confidence, primary/official

---
*Feature research for: v0.9.0 text-monitor channel and runtime evidence layer, c64-re-tools*
*Researched: 2026-09-06*
