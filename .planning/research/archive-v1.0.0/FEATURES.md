# Feature Research

**Domain:** 6502/C64 disassembly-to-rebuildable-source pipelines ("the rebuild half") — for `c64-re-tools` v1.0.0
**Researched:** 2026-09-10
**Confidence:** MEDIUM-HIGH (prior art is well-documented but sparse and largely artisanal; complexity/dependency estimates against this codebase are HIGH-confidence since they were checked against source)

## Scope note

This is a **subsequent-milestone** feature study, not a greenfield one. It answers
the five milestone questions directly, then rolls the answers into the
table-stakes / differentiator / anti-feature framework the roadmapper expects.
Existing capabilities (`.annostore`, dxa+Ghidra auto-annotation, ACME
byte-diff verify, `c64-provenance-diff`) are treated as **substrate**, not
things to re-research.

Two settled bars govern everything below (from `v0.5.0-REQUIREMENTS.md`,
restated as v1.0.0's bars):
- **Byte-identity is not the acceptance bar** — there is no clean original to
  match, only a provenance-graded composite. Functional equivalence is the bar.
- **Proving ground is committed synthetic fixtures only** — no copyrighted
  image enters the repo.

And one constraint frames every "differentiator" and rules out several
"table stakes" a naive reading of prior art would suggest: **the tool
reports, the end-user decides what gets reverse-engineered.** No feature
below may have the pipeline strip, drop, or silently omit any part of a
subject binary on its own judgement.

---

## Q1 — Decomposition to closure: what does "complete" look like?

**Prior art's answer is a closed type vocabulary with an explicit "not yet
classified" member, never a forced binary code/data split.** The most
directly comparable real methodology is [SkoolKit](https://skoolkit.ca/)'s
`.ctl` file format, used for the ZX Spectrum disassemblies of *The Great
Escape*, *Skool Daze*, *Manic Miner*, *Jet Set Willy*, and the Spectrum ROM
itself ([skoolkid/rom](https://github.com/skoolkid/rom)). Its
[control-file block types](https://skoolkit.ca/docs/skoolkit/control-files.html)
are `b` (data), `c` (code), `g` (game-status-buffer variable), `i` (ignore —
deliberately unmodelled), `s` (a same-byte run, typically unused zero
padding), `t` (text), `u` (unused memory), `w` (word table). Three of those
eight (`i`, `s`, `u`) exist specifically so a practitioner never has to lie
about a byte's classification — they are honest "this is not code or
meaningful data" markers, not gaps.

This project's own store already has the equivalent structure: `anno-types.ts`
freezes a **twelve-member** `DATA_TYPES` vocabulary — `code`, `byte`, `word`,
`address`, `petscii`, `screencode`, the four split-table layouts
(`lo_hi_address`/`hi_lo_address`/`lo_hi_word`/`hi_lo_word`), `external_file`,
and `undefined`. `undefined` is the SkoolKit-`i`/`u` equivalent: an explicit,
queryable "not yet classified" state rather than an absence of a row.
`DECOMP-01`'s bar — "nothing left `Undefined`" — is therefore not asking for
a new type; it is asking for **zero rows carrying the type that already means
"not yet looked at."** That is a closure metric the store can already answer
with one query (`COUNT(*) WHERE dataType = 'undefined'`), which is a much
lower-complexity deliverable than it first appears — the hard part is driving
the classification to zero, not building a way to measure it.

**Categories of byte that genuinely resist classification**, per prior art
and this project's own dxa/Ghidra findings (`docs/phase38-*`,
`PROOF-01`..`PROOF-04`):

| Resistant category | Why it resists | Honest handling |
|---|---|---|
| Padding / unused runs | No semantic content, often all-zero or all-`$FF` fill to a block boundary | SkoolKit's `s`; this store's `byte` type with a comment naming it padding, never `code` |
| Compressed/crunched blobs (Exomizer, Pucrunch, etc.) | Opaque until depacked — [Iridis Alpha](https://github.com/mwenge/iridisalpha) is disassembled *post*-depack for exactly this reason, and its own README notes the final binary is re-compressed with Exomizer, which is why byte-identical verification does not apply end-to-end even there | Typed `byte`/`external_file` with a comment naming the packer (this project's own `SURF-03` packer-finding output is the evidence source); never guessed as code |
| Self-modifying operand/opcode bytes | The byte a disassembler sees at rest is not the byte the CPU executes at runtime — see Q3 | `code` with a comment naming the SMC site and its write origin, not silently retyped |
| Load-address-dependent / bank-dependent overlap | Two valid interpretations exist depending on `$01` state or load address, and this project's own `AUTO-*` importer already **declines with a reason** here rather than guess (Phase 37, `docs/phase37-*`) | Carry the decline forward as the DECOMP-01 answer for that range: an explicit "ambiguous, here is why" comment, not a silent `undefined` |
| Cracktro/loader/depacker regions the user has not decided about | Not this pipeline's decision (see the milestone's scoping constraint) | Typed and commented like anything else; provenance verdict attached via `BUILD-05`, inclusion/exclusion left to the user |
| Dead code / unreachable regions never observed executing | The runtime-evidence layer's own stated limit: never-observed is a **count**, not a `data` verdict (`RuntimeExecClass` has no `data` member) | Typed by the static classifier (dxa/Ghidra) as best-effort `code`, annotated with "never observed executing" from `anno_evid_disagreements` rather than silently downgraded |

**Practitioner naming convention for closure of entry points (`DECOMP-02`):**
Gridrunner's own disassembly notes
([Disassembling.md](https://github.com/mwenge/gridrunner/blob/master/Disassembling.md))
describe exactly the workflow `DECOMP-02` demands: raw labels like `b1535` or
`e8C50` are progressively replaced by semantic names (`CopyLevelTextLoop`,
`MaterializeShip`) as understanding grows, driven by finding a recognizable
data structure (a custom charset) and tracing references outward from it.
This project already has the mechanical hook for the same workflow — the
auto-importer's default naming produces exactly the `p_XXXX`/`l_XXXX` forms
`DECOMP-02` requires to be zero at the end, and `routine-queue-walker` (an
existing skill) already exists to drive a backlog of such auto-named symbols
to closure. **`DECOMP-02` is largely an application of an existing skill
against a stricter zero-tolerance bar, not new tooling.**

**`DECOMP-04` (hardware register enums)** has a documented complication:
`ANNO-13` (generated bit-name enums from `memmap.json`) is **Validated but
currently has NO ROUTE** — the `gen-enums` CLI verb was removed at the v0.7.0
cut. The heuristics survive as live code (`anno-enum-gen.ts`), and the by-hand
route (`anno_create_project_enum` + `anno_apply_enum_usage`) writes identical
rows. v1.0.0 does not own restoring the automated route (PROJECT.md is
explicit that no phase does), so `DECOMP-04`'s closure bar must be satisfiable
through the **by-hand route** on the synthetic fixture — a fixture with a
bounded, known register-write surface is exactly the case where by-hand enum
creation is tractable, which is itself a reason the fixture should be scoped
small (see Q5).

---

## Q2 — Rebuildable vs merely reassemblable source

**The distinguishing line practitioners draw is symbolization density, not
reassembly success.** A file that reassembles byte-identical but is full of
absolute-hex branch targets and inline magic numbers "compiles" but cannot be
*edited* — inserting one instruction shifts every address after it, and
every literal branch target silently goes stale. The named prior-art
projects all treat this as the actual bar:

- **SkoolKit** explicitly generates *both* an HTML cross-referenced view and a
  re-assemblable `.asm` from the same `skool` source — the skool file is
  described as "the common 'source' for both," and its whole value
  proposition over a raw disassembly listing is that every reference resolves
  to a symbol, so code can be edited and the cross-references stay correct
  automatically (skoolkit.ca).
- **Gridrunner** explicitly states its guiding principle is compiling to a
  "byte-for-byte copy of the original," which only works because every
  address referenced by a branch/JSR/JMP is a label, not a literal — you
  cannot get byte-identical reassembly from a listing with drifted literal
  addresses once you've renamed and re-ordered anything.
- **N64/GameCube decompilation projects** (the [splat](https://github.com/ethteck/splat)
  ecosystem — Ogre Battle 64, Rogue Squadron, Super Smash Bros. decomp) use a
  different but structurally identical convention: a binary is split into
  named **segments** (roughly this project's "scopes"), each segment renders
  to its own file, and every cross-segment reference goes through a symbols
  table the build system resolves — "one file per logical unit, everything
  cross-referenced by name" is the load-bearing pattern across two completely
  different CPU architectures and two completely different eras of tooling.
  This is direct, cross-platform confirmation that `BUILD-01`+`BUILD-03`
  together (one file per scope, universal symbolization) is *the* standard
  shape of "rebuildable," not an invented one.

**`BUILD-02` (data tables in their own files)** is the same principle applied
to data rather than code, and this project's own store schema already has a
type built for exactly this: `external_file` is one of the frozen twelve
`DATA_TYPES` and today has **no consumer** — `grep` across
`anno-export-asm.ts` finds zero references to it. This is a genuine gap, not
a rename: today's `exportAsm()` (`src/mcp/vice/anno-export-asm.ts:764`)
emits one flat source blob regardless of type, with no scope-splitting and no
per-type file routing. `BUILD-01` and `BUILD-02` are therefore new logic in
the export path, wiring an already-reserved but currently-inert type onto
real file output — **medium complexity**, bounded because the type already
exists and is frozen (can't be redefined, only newly *acted on*), but the
splitting/linking logic (deciding scope boundaries, wiring ACME's `!source`
directive, keeping symbol references valid across file boundaries) is new.

**Complexity ranking for Q2's three sub-asks:**
- `BUILD-03` (universal symbolization) — MEDIUM. The store already has
  cross-reference tracking (`STORE-06`) and the four split-address types
  exist for exactly this; the work is making export *refuse* to emit a raw
  literal anywhere a symbol should exist, which is a new export-time
  assertion, not new store schema.
- `BUILD-01` (one file per scope + `!source`) — MEDIUM. Scopes already exist
  in the store; wiring them to `acme-build`'s existing `!source` support and
  splitting export output is new but mechanical.
  See `acme-build/SKILL.md`.
- `BUILD-02` (external data files) — MEDIUM-HIGH. `external_file` exists in
  schema but is unused; this is the newest logic of the three.

---

## Q3 — Movement hazards

**The four named classes are the textbook set, but a fifth recurs constantly
in real C64 practice and should be named explicitly: packed/crunched loaders
with a load-address baked into the depacker.**

1. **Indexed jump tables, including the RTS trick.** Confirmed real and
   well-documented: the [NESdev RTS Trick page](https://wiki.nesdev.com/w/index.php/RTS_Trick)
   and 6502.org's jump-table thread describe the idiom (push target-1 onto
   the stack, `RTS` adds 1 and "returns" into the target) and its specific
   relocation trap — **pointer-table entries must encode target-1, and a
   naive relocator that rewrites "the address" by +1 instead of +0 silently
   breaks every entry, with `$FFFF`/page-wrap dummy values as a named extra
   gotcha.** A disassembler that does not recognize the RTS-trick idiom sees
   three unrelated instructions (two loads, a push each, an `RTS`) and no
   jump at all — the reference is invisible to the classifier, which is why
   `BUILD-04` calls this out as something "nothing in this stack detects
   today." Detection requires pattern-matching the `LDA`/`PHA`/`LDA`/`PHA`/
   `RTS` idiom specifically, not general jump-table detection.

2. **Self-modifying code.** The [cc65 `smc.inc` macro package](https://cc65.github.io/doc/smc.html)
   is the closest real tooling analog: it exists because "self modifying code
   is often hard to identify" by inspection, and its answer is a **naming
   convention** — a placeholder value (e.g. an address literal like `$FADE`
   used as a doc-only stand-in) marking a byte that will be overwritten,
   rather than any attempt to prove SMC absent. The practitioner-honest
   approach `BUILD-04` should adopt: detect the write (a `STA`/`STX`/`STY`
   whose target falls inside a previously-classified `code` range) and
   *report* the site and its write origin — never attempt to resolve what
   the "real" instruction is, since that depends on runtime state.

3. **Page-alignment dependence.** Two independent real causes, both worth
   naming separately in the hazard report: (a) data tables that must start
   at a page boundary so a single index register spans the whole table
   without a carry (a hi-byte/lo-byte split table, or a sprite-pointer table
   at `$C000`-aligned addresses — literally this store's own `lo_hi_address`
   type's use case); (b) **branch-timing dependence on which side of a page
   boundary an instruction lands**, covered under raster code below since the
   mechanism is the same (an extra cycle on a taken branch that crosses a
   page).

4. **Cycle-exact raster code.** Extensively documented in the retro C64 dev
   literature — [Bumbershoot Software's raster-stabilization series](https://bumbershootsoft.wordpress.com/2015/12/29/stabilizing-the-vic-ii-raster/)
   and the classic [Antimon "Making Stable Raster Routines"](https://www.antimon.org/dl/c64/code/stable.txt)
   document both describe IRQ entry jitter (0–6 extra cycles depending on
   what the CPU was mid-executing) corrected by NOP-padded double-IRQ
   synchronization, and both note that **a branch instruction costs one extra
   cycle when its target crosses a page boundary** — so relocating
   raster-critical code by even one byte can silently move a branch across a
   page boundary and desync a stable raster routine with no assembly error
   and no visible symptom until the picture judders. This is the
   least-mechanically-detectable of the four: static analysis can flag "this
   code writes `$D012`/raster-compare and lives inside an IRQ handler" as a
   *candidate*, but proving cycle-exactness requires either manual review or
   an emulator-driven cycle count (which this project already has via `chis`/
   `vice_cpu_history`, making this hazard class the one most naturally
   *verified* rather than merely flagged).

**A fifth hazard class practitioners hit constantly and this project's own
fixture history has already brushed against**: **packed/crunched images whose
depacker assumes a fixed load address.** Iridis Alpha's own README notes the
shipped binary passes through Exomizer, and this project's `SURF-03` work
established that packer identity is itself only sometimes recoverable. A
depacker's unpack loop frequently hardcodes the *destination* address for the
unpacked payload (sometimes literally reusing the depacker's own now-dead
code space) — relocating the depacked program without also verifying the
depacker's target addresses is a distinct, very common failure mode separate
from the four named classes. **Recommendation: name this as a fifth hazard
class (`packed-image load-address coupling`) in `BUILD-04`'s report**, scoped
to *detecting and reporting* a hardcoded unpack-destination write, exactly
like the other four — never attempting to fix it.

A sixth, narrower case worth a one-line mention rather than a full class:
**zero-page variable collisions** (code assuming a specific zero-page address
is free, colliding with KERNAL/BASIC or another module after relocation) is
a real but *data*-movement hazard, not code-movement — it belongs to
`BUILD-02`'s data-table story more than `BUILD-04`'s code-hazard story, and
should not dilute the four(+1) code-hazard taxonomy.

**How practitioners conventionally report vs. work around these**: universally,
*report, don't fix*. None of the surveyed prior art (SkoolKit, Gridrunner,
Iridis Alpha) attempts automatic relocation — SkoolKit's disassemblies are
literally never relocated, they document the game at its original load
address; when C64 scene actors *do* relocate code (for cracks, trainers,
NTSC/PAL fixes) it is manual, by a human who has already read the hazard by
eye. This directly matches and validates this project's existing framing:
`BUILD-04` "enumerates... and acts on none of it," and "automatic relocation
or rebasing" is already an explicit anti-feature (v0.5.0 Out of Scope,
carried forward) because "no general solution exists for 6502."

---

## Q4 — Demonstrating equivalence and modifiability credibly

**Credible demonstrations in the wild share three properties: they are
executed against a real interpreter/emulator (not argued in prose), they are
committed as artifacts (not described), and they show a *change* taking
effect, not just a re-run of the original.** The weakest version of this
seen anywhere is theatrical: a written claim that "the logic is the same"
with no re-run, or a diff of source text with no execution. The strongest
version, seen in the "matching decompilation" community (N64/GameCube:
splat-based projects, and the general practice the modding community calls
"100% matching" — [Held Games' explainer](https://heldgames.com/guides/retro-decompilation-recompilation-explained)
describes it as "the reconstructed source code, when compiled with the
original toolchain, produces a binary that is identical to the retail game"),
demonstrates equivalence at build time by literal binary comparison. That
bar is explicitly **not** available here (no clean original, no matching
toolchain guarantee), which is exactly why this project's own settled bar
substitutes *behavioral* equivalence for *binary* equivalence — a documented,
deliberate divergence from the strongest prior-art convention, for a
structural reason rather than a laziness one.

Given that substitution, the credible middle ground — and the one `EQUIV-01`/
`EQUIV-02`/`EQUIV-03` already describe — is:

- **A real second-binary run, not a self-comparison.** `EQUIV-01`
  specifically calls out that `compare.mjs` has never been run in
  original-vs-rebuilt mode — only ever self-consistency mode. Running it in
  the mode it was never exercised in is itself non-vacuous evidence; a tool
  that only ever compared a binary to itself cannot be trusted to catch
  divergence, however clean its historical pass record looks.
- **A volatile mask narrow enough that a real regression cannot hide behind
  it.** `EQUIV-01`'s framing (`$D020`/`$D015`/`$D018` must not be maskable)
  is the credibility test for this whole category: an equivalence checker
  that excludes "anything that might differ" is a vacuous pass generator, the
  same failure mode `COV-02` was built to catch for the coverage instrument.
  Concretely: any volatile-masking rule should be reviewed by asking "would
  this mask hide a one-byte wrong write to a VIC-II/SID/CIA register a human
  would call a bug?" — if yes, the mask is too wide.
- **A committed transcript as the artifact of record** (`EQUIV-02`), not a
  described walkthrough — matching this project's own established pattern
  (Phase 40's live text-channel evidence, Phase 44's PROOF-04 transcripts)
  of treating "we measured this" claims as only as credible as the
  committed evidence behind them.
- **A remove-one/add-one modification, reassembled and re-observed**
  (`EQUIV-03`) — this is the one piece with no equivalent in the surveyed
  prior art (SkoolKit/Gridrunner/Iridis Alpha projects demonstrate
  reassembly, not a live behavioral edit-and-observe cycle) — likely because
  those projects' goal is documentation/preservation, not this project's
  stated goal of *modifiable* source. This is a genuine differentiator, not
  a copied practice, and is exactly why `EQUIV-03` needs the purpose-built
  fixture (Q5) — none of today's single-purpose probe fixtures has an
  observable, removable/addable on-screen behavior to demonstrate against.

**What makes a demonstration theatrical rather than credible, named
explicitly for the roadmap:**
- Running the equivalence check only in self-comparison mode and calling it
  "verified" (the exact trap `EQUIV-01` names as unexercised).
- A volatile mask wide enough to swallow a real regression — undetectable
  from the outside without inspecting the mask's own contents.
- Describing a modification in prose ("we changed X and it worked") instead
  of committing the before/after transcript.
- Demonstrating modifiability against a toy that never had the hazard classes
  present, so "we relocated code successfully" proves nothing about the
  hazard detector (this is precisely why Q5's fixture is scoped to carry the
  hazards deliberately rather than incidentally).

---

## Q5 — The synthetic subject: minimum realistic shape

The fixture must make **two different tools non-vacuous simultaneously**:
`BUILD-04`'s hazard detector (needs all classes actually present and
individually distinguishable) and `EQUIV-03`'s modifiability proof (needs
observable behavior that can be removed and added, and needs to still work
*after* the hazard-carrying regions are exercised by relocation/export).
Overbuilding is a real risk here — PROJECT.md's own history (`COV-01`'s four
rounds of "gameable" fixture shapes) shows this project has been burned
before by fixtures that don't force the property they're meant to test.

**Minimum realistic shape** (each item ties to one hazard/proof requirement,
nothing added speculatively):

| Component | Ties to | Why it must be genuine, not decorative |
|---|---|---|
| A dispatch routine using the **RTS-trick jump table** with ≥3 real targets | `BUILD-04` class 1 | Must actually use `PHA`/`PHA`/`RTS`, not a plain `JMP (table,X)` — the RTS-trick's specific relocation trap (target-1 encoding) is only exercised by the real idiom |
| A **self-modifying** instruction operand (e.g. a table-driven color-cycle routine that patches its own `LDA #imm` operand each frame) | `BUILD-04` class 2 | The write must target a previously-`code`-typed byte for real, not a data table read normally |
| A **page-aligned sprite-pointer or split-address table** at a `$xx00` boundary | `BUILD-04` class 3 | Must be an actual `lo_hi_address`/`hi_lo_address` pair this store already types, so the hazard detector's output is checkable against the store's own typed range, not a separate ad-hoc check |
| A **raster IRQ handler** doing a real stable-raster technique (cycle-counted NOP padding, a `$D012` compare) that visibly changes border/background color at a fixed screen line | `BUILD-04` class 4, plus visible on-screen behavior for `EQUIV-02`/`EQUIV-03` | Needs enough real cycle-counting that relocating it across a page boundary would (in principle) desync it — this is what makes the hazard *detectable* rather than assumed |
| At least one **swappable data table** (charset or sprite bitmap) large enough to be worth extracting, typed as a candidate `external_file` range | `BUILD-02` | Must be big enough that "extract to its own file" is a meaningful operation, not one byte |
| A **small level/music-style table** distinct from the graphics table | `BUILD-02` | Proves the extraction mechanism generalizes across at least two data kinds, not one coincidentally-shaped table |
| **One clearly observable on-screen behavior to remove, and one to add** (e.g. remove: a border-flash on a key input; add: a new border color choice) | `EQUIV-03` | The behavior must be observable via a VICE screen capture / checkpoint, not merely "the code path was hit" — otherwise the demonstration degrades into a code-coverage claim, not a behavioral one |

**What should NOT be added** (over-scoping risks, named explicitly since this
project has a documented pattern of catching this late otherwise):
- No actual game logic, scoring, or multi-level structure — a single
  visible screen with the above five mechanisms is sufficient; "looks like a
  real game" is not a requirement anywhere in `DECOMP-*`/`BUILD-*`/`EQUIV-*`.
- No loader/depacker stage and no packing — the fifth hazard class named in
  Q3 (packed-image/load-address coupling) is real but **out of scope for
  this fixture**: it belongs to the real-cracked-code question
  (`PROOF-03`), which this milestone explicitly does not take.
- No bank-switching / `$01` multi-configuration dependence — bank-qualified
  addressing is a standing Out of Scope item (v0.7.0/v0.8.0 audits, both
  reaffirmed), and pulling it into the fixture would silently reopen that
  boundary.
- No cracktro/loader-style content to "report on but not decide about" — the
  fixture is entirely original, so there is no provenance question to
  demonstrate `BUILD-05` against; `BUILD-05`'s provenance-carry behavior
  should be demonstrated separately (e.g. against the existing
  `c64-provenance-diff` fixtures, which already carry a graded ledger), not
  invented into this fixture.

**Complexity**: MEDIUM. The five mechanisms are each individually
well-documented, small (tens of lines of ACME each), and independent of each
other, so they can be built and tested incrementally; the risk is entirely in
under- or over-scoping the on-screen behavior for `EQUIV-03`; a single
`$D020`-driven border color plus one input-triggered flash is enough and
should not grow further.

---

## Feature Landscape

### Table Stakes (users expect these — this milestone's stated bar)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Zero `undefined`-typed bytes on the fixture (`DECOMP-01`) | Baseline definition of "annotated" in every surveyed prior-art project (SkoolKit's `i`/`u`/`s` closure, dxa/Ghidra coverage census this project already has) | LOW (measurement) / HIGH (driving the count to zero) | The type already exists (`anno-types.ts`); the query is trivial, the classification work is not |
| Named entry points with function/inputs/outputs/side-effects comments, zero `p_XXXX`/`l_XXXX` (`DECOMP-02`) | Universal in commented disassemblies (Gridrunner's label-evolution workflow) | MEDIUM | `routine-queue-walker` skill already exists for exactly this backlog-drive workflow |
| Every non-hardware address named (`DECOMP-03`) | Same as above — an unnamed data address is functionally an `undefined` byte with extra steps | MEDIUM | Store already has cross-reference tracking (`STORE-06`) to drive this |
| Hardware register writes as named enums (`DECOMP-04`) | Table stakes for readability in every hand-written or hand-annotated 6502 source seen | MEDIUM | `ANNO-13`'s automated route has NO ROUTE currently; must use the by-hand route (`anno_create_project_enum`) on the bounded fixture |
| One ACME file per scope, `!source`-wired, assembling to one output (`BUILD-01`) | The universal "rebuildable" shape (SkoolKit's dual skool→asm/html output; splat's per-segment files) | MEDIUM | Current `exportAsm()` emits one flat file; scope splitting is new |
| Data tables in their own files (`BUILD-02`) | Same universal shape, applied to data (splat segments; SkoolKit data blocks) | MEDIUM-HIGH | `external_file` type exists in schema, unused by export today — genuinely new export logic |
| Universal symbolization of branches/JSR/JMP/data refs (`BUILD-03`) | The actual dividing line between "reassembles" and "editable" (SkoolKit, Gridrunner, splat all treat this as non-negotiable) | MEDIUM | Store's split-address types and xref tracking already exist; new export-time assertion needed |
| Hazard report across 4(+1) classes, report-only (`BUILD-04`) | No surveyed prior-art tool attempts automatic relocation; all report hazards for human judgement | HIGH | Genuinely new detection logic per class; RTS-trick idiom-matching and raster-code candidate-flagging are the hardest two |
| Lossless export — no range dropped by the tool's own judgement (`BUILD-07`) | Direct consequence of this milestone's scoping constraint | LOW-MEDIUM | Provable by a planted-control test (a heuristic that *would* want to drop a range, and the range survives) — same pattern this project already uses elsewhere |
| Reassembly + clean hazard report as a pre-existing gate (`BUILD-06`) | Prevents downstream phases building on unverified export | LOW | Reuses the existing real-ACME byte-diff oracle infrastructure from `EXPORT-01`..`03` |
| Committed VICE transcript demonstrating behavioral equivalence (`EQUIV-02`) | Universal "show, don't tell" convention across this project's own evidence discipline and every credible RE demonstration surveyed | MEDIUM | Reuses `compare.mjs`, run in a mode it has never been exercised in |
| Committed remove/add modifiability transcript (`EQUIV-03`) | The one genuinely novel demonstration this milestone requires — no direct prior-art equivalent found | MEDIUM-HIGH | Needs the purpose-built fixture (Q5); vacuous without it |
| Fixtures committed, pipeline runnable in CI (`EQUIV-04`) | Matches this project's standing CI discipline for every prior milestone | LOW | Mechanical, once the fixture exists |

### Differentiators (competitive advantage — align with Core Value)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Runtime-evidence-informed decomposition (joining `anno_evid_exec` disagreement-first output into `DECOMP-01`'s closure workflow) | No surveyed prior-art project has a live execution oracle feeding its static classification — this project's v0.9.0 delivered exactly that, upstream of this milestone | already built (v0.9.0) — this milestone consumes it | The `$8000-$BFFF` code-vs-data ambiguity PROJECT.md calls out is precisely where this pays off |
| Provenance-aware reporting carried to point of use (`BUILD-05`, reworded) | Nobody else in the surveyed prior art has a graded-confidence provenance ledger (`c64-provenance-diff`) to carry forward at all — most prior-art projects work from a single canonical original | LOW-MEDIUM (carry, don't decide) | Must render the provenance verdict *at* the export/hazard-report point without ever excluding a range — this is the milestone's central scoping discipline made concrete |
| Cycle-exact raster hazard flagging backed by a real cycle-count instrument (`chis`/`vice_cpu_history`) | Most prior-art projects flag raster-timing risk by eye; this project can *measure* cycle counts across a relocation to confirm or refute a flagged hazard | MEDIUM (uses existing v0.9.0 capability) | Turns a "manual review flag" into a checkable claim, which is unusual in this domain |
| Hazard report as a structured, queryable artifact rather than prose comments | Every surveyed prior-art project's hazard knowledge lives in the disassembler's head or scattered inline comments, never a first-class report | MEDIUM | Natural fit for `.annostore`'s existing comment/label infrastructure — a hazard is just a specially-tagged annotation |

### Anti-Features (commonly requested, often problematic — some already excluded, restated here because Q1-Q5 would otherwise reintroduce them)

| Feature | Why it seems appealing | Why problematic | Alternative |
|---|---|---|---|
| Automatic relocation or rebasing | "If we can detect the hazards, why not fix them automatically?" | No general solution exists for 6502 (already an explicit v0.5.0 Out of Scope entry, reaffirmed); a `da65`+ca65/ld65 auto-rebuild route was actually tried and measured producing a **wrong binary** (v0.8.0 Out of Scope) | Report hazards, human relocates by hand — matches every surveyed prior-art project's actual practice |
| Automatically excluding cracker patches / loader / cracktro content | Feels like "cleaning up" the rebuild | Makes the tool the decider — directly forbidden by this milestone's scoping decision (2026-09-10, owner) | Carry the provenance verdict to point of use (`BUILD-05`); user decides inclusion/exclusion explicitly |
| Byte-identical rebuild as the acceptance bar | The strongest prior-art convention (N64/GameCube "matching decomp") | Structurally undefined here — no clean original exists, only a graded composite | Behavioral equivalence (`EQUIV-01`/`02`), narrowed volatile mask instead |
| C or higher-level decompiled output | Looks more "modern" / easier to read | Not reassemblable to the same program; not what a C64 rebuild is edited in; not the deliverable this milestone promises | Modifiable 6502 ACME source — the actual deliverable |
| Auto-renaming symbols with no evidence bar, to hit `DECOMP-02`'s zero-`p_XXXX` count faster | Tempting shortcut under a hard zero-tolerance metric | Defeats `COV-02`'s vacuous-pass protection by construction; manufactures confident nonsense — the exact failure mode `c64-provenance-diff` exists to prevent | Drive `routine-queue-walker`'s evidence-backed workflow to genuine closure, even if slower |
| Multi-assembler output (targeting KickAssembler, ca65, etc. alongside ACME) | "More reach" | No measured caller; ACME is this project's assembler (standing Out of Scope) | Stay ACME-only |
| A packed/compressed loader stage in the synthetic fixture | Would make the fixture "more realistic" | Pulls in the fifth hazard class and the real-cracked-code question this milestone explicitly does not take (`PROOF-03` deferred) | Keep the fixture unpacked; test packed-image coupling only against real cracked code, in a later milestone |
| Deterministic input replay as a general capability, to make `EQUIV-03`'s demonstration "more automated" | Would remove manual VICE interaction from the transcript-capture step | No VICE-specific tooling exists for this (checked, `FUT-04`); TASVideos-style movie replay is the nearest precedent and is a different domain entirely | Committed transcript from a driven, checkpoint-based VICE session — the pattern this project already uses everywhere else |

## Feature Dependencies

```
DECOMP-01 (zero undefined bytes)
    └──requires──> runtime-evidence layer (anno_evid_exec, EXISTING v0.9.0)
    └──requires──> dxa + Ghidra auto-annotation (EXISTING v0.8.0)

DECOMP-02 (named entry points + purpose comments)
    └──requires──> DECOMP-01 (can't purposefully name what isn't typed as code yet)
    └──enhances-via──> routine-queue-walker skill (EXISTING)

DECOMP-03 (named non-hardware addresses)
    └──requires──> STORE-06 cross-references (EXISTING v0.7.0)

DECOMP-04 (register enums)
    └──requires──> by-hand enum route (anno_create_project_enum, EXISTING — ANNO-13's automated route has NO ROUTE)

BUILD-01 (one file per scope + !source)
    └──requires──> DECOMP-01..04 substantially complete (exporting an undocumented mess is not "rebuildable")
    └──requires──> acme-build's existing !source support (EXISTING)

BUILD-02 (data tables to own files)
    └──requires──> BUILD-01 (file-splitting mechanism)
    └──requires──> external_file DATA_TYPE (EXISTING schema, unused today)

BUILD-03 (universal symbolization)
    └──requires──> DECOMP-03 (named addresses) and split-address types (EXISTING)
    └──enhances──> BUILD-01/02 (moved files stay correct only if refs are symbolic)

BUILD-04 (hazard report)
    └──requires──> BUILD-03 (symbolization surfaces the jump targets/data refs a hazard scan walks)
    └──requires──> the synthetic fixture (Q5) to be NON-VACUOUS
    └──enhanced-by──> vice_cpu_history / chis (EXISTING v0.9.0, cycle-exact class)

BUILD-05 (provenance carried to point of use)
    └──requires──> c64-provenance-diff's graded ledger (EXISTING)
    └──conflicts-with──> any automatic exclusion logic (explicitly forbidden this milestone)

BUILD-06 (reassembly + clean hazard gate before next phase)
    └──requires──> BUILD-01..04 and the real-ACME byte-diff oracle (EXISTING v0.7.0 EXPORT-01..03)

BUILD-07 (lossless export)
    └──conflicts-with──> any heuristic that would drop/filter a range
    └──enhances──> BUILD-05 (provenance carried, not enforced by omission)

EQUIV-01 (compare.mjs, original-vs-rebuilt mode)
    └──requires──> BUILD-06's gate passed (rebuild exists and reassembles)
    └──requires──> narrowed volatile mask (new logic, not existing)

EQUIV-02 (behavioral equivalence transcript)
    └──requires──> EQUIV-01 and the synthetic fixture's observable behavior (Q5)

EQUIV-03 (modifiability demonstration)
    └──requires──> EQUIV-02 passing AND the synthetic fixture's removable/addable behavior (Q5)
    └──requires──> BUILD-01..03 (the modification must be made in the exported, scoped, symbolized source)

EQUIV-04 (CI-runnable pipeline)
    └──requires──> the synthetic fixture (Q5) committed
    └──requires──> EQUIV-01..03 automatable without manual VICE interaction beyond a scripted session
```

### Dependency Notes

- **The synthetic fixture (Q5) is the single most load-bearing new artifact
  in the milestone** — `BUILD-04` and `EQUIV-03` are *both* vacuous without
  it, and it should therefore be built early in phase sequencing, before
  either hazard-detection or modifiability-proof work starts, so both can be
  developed and tested against a real non-trivial subject from day one
  rather than retrofitted later.
- **`DECOMP-*` gates `BUILD-*`, and `BUILD-*` gates `EQUIV-*`, in that strict
  order** — this mirrors the existing phase split (originally Phases 20/21/22
  in the v0.5.0 archive) and there is no prior-art or dependency reason to
  interleave them; every surveyed project (SkoolKit, Gridrunner, splat-based
  decomps) treats "classify," "make editable," and "prove it still works" as
  sequential passes, not parallel tracks.
- **`ANNO-13`'s missing automated route is a real but boundable risk**: it
  only blocks `DECOMP-04` if the by-hand route can't cover the fixture's
  bounded register-write surface in reasonable effort — which it should,
  precisely because the fixture (Q5) is deliberately small (see Q5's
  over-scoping warnings).
- **`external_file` conflicts with nothing else in the frozen vocabulary** —
  it was reserved at `STORE-01`'s one-irreversible-decision point precisely
  for this use, so `BUILD-02` is additive schema *usage*, never a schema
  change (the vocabulary itself cannot be touched again per `STORE-01`'s
  framing).

## MVP Definition

### Launch With (v1.0.0 — nothing here is optional; all 15 requirements are already committed)

- [ ] `DECOMP-01`..`04` — closure on the synthetic fixture (not on any real
      cracked title — that's explicitly deferred)
- [ ] `BUILD-01`..`03`, `06`, `07` — rebuildable, symbolized, lossless,
      gated export
- [ ] `BUILD-04` — the hazard report, all five classes (four named + the
      packed-image coupling class this research recommends adding)
- [ ] `BUILD-05` — provenance carried to point of use, reworded per the
      2026-09-10 scoping decision
- [ ] `EQUIV-01`..`04` — equivalence and modifiability, both demonstrated
      and committed as transcripts
- [ ] The purpose-built synthetic fixture — enabling deliverable for both
      `BUILD-04` and `EQUIV-03`

### Add After Validation (v1.x)

- [ ] `PROOF-03` on real cracked code (bank-boundary claim, currently only
      proven on a synthetic two-caller fixture) — explicitly deferred at
      this milestone's open
- [ ] Restoring `ANNO-13`'s automated enum-generation route, if the by-hand
      route proves too slow once applied beyond the small fixture
- [ ] Applying the whole pipeline to a real title (`FUT-05`, `bruce_lee`,
      where a provenance ledger already exists) — explicitly named as
      downstream use, not this milestone's evidence

### Future Consideration (v2+)

- [ ] The fifth (packed-image/load-address) hazard class evaluated against
      real crunched titles, once `PROOF-03`'s real-code question is answered
- [ ] Extending the hazard report to bank-switching-aware code, if
      bank-qualified addressing is ever un-excluded

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| DECOMP-01..04 (closure) | HIGH | MEDIUM | P1 |
| BUILD-01 (scope files + !source) | HIGH | MEDIUM | P1 |
| BUILD-02 (data table extraction) | HIGH | MEDIUM-HIGH | P1 |
| BUILD-03 (universal symbolization) | HIGH | MEDIUM | P1 |
| BUILD-04 (hazard report) | HIGH | HIGH | P1 |
| BUILD-05 (provenance carry) | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| BUILD-06 (gate) | HIGH | LOW | P1 |
| BUILD-07 (lossless export) | HIGH | LOW-MEDIUM | P1 |
| Synthetic fixture | HIGH (enabling) | MEDIUM | P1 |
| EQUIV-01 (compare.mjs new mode) | HIGH | MEDIUM | P1 |
| EQUIV-02 (equivalence transcript) | HIGH | MEDIUM | P1 |
| EQUIV-03 (modifiability transcript) | HIGH | MEDIUM-HIGH | P1 |
| EQUIV-04 (CI-runnable) | MEDIUM | LOW | P1 |
| ANNO-13 automated-route restoration | MEDIUM | MEDIUM | P3 |
| PROOF-03 on real code | MEDIUM | HIGH (needs real corpus work) | P2 (next milestone) |
| Real-title pipeline run (FUT-05) | HIGH (long-term) | HIGH | P3 |

**Priority key:** P1 must-have (already committed requirements). P2
should-have, natural next milestone. P3 future consideration, no current
owner.

## Sources

- [SkoolKit](https://skoolkit.ca/) and its [control-files documentation](https://skoolkit.ca/docs/skoolkit/control-files.html) — ZX Spectrum disassembly toolkit; `.ctl` block-type vocabulary (`b`/`c`/`g`/`i`/`s`/`t`/`u`/`w`) as real-world prior art for closure typing
- [skoolkid/rom](https://github.com/skoolkid/rom) — SkoolKit-based Spectrum ROM disassembly
- [dpt/The-Great-Escape](https://github.com/dpt/The-Great-Escape) — SkoolKit-based full-game reverse engineering
- [mwenge/gridrunner, Disassembling.md](https://github.com/mwenge/gridrunner/blob/master/Disassembling.md) — C64 disassembly with explicit byte-for-byte MD5 verification methodology and label-evolution workflow
- [mwenge/iridisalpha](https://github.com/mwenge/iridisalpha) — C64 disassembly noting Exomizer re-compression, illustrating the "byte-identical to what" problem
- [Piddewitt/C64-Game-Source-Code](https://github.com/Piddewitt/C64-Game-Source-Code) and [GregWagner/6502-Disassembly](https://github.com/GregWagner/6502-Disassembly) — curated indexes of reverse-engineered C64/6502 game source including a Bruce Lee disassembly
- [5k3105/bruce](https://github.com/5k3105/bruce) — a raw, IDA-derived Bruce Lee disassembly text, useful as a contrast case (not rebuildable source in this project's sense)
- [NESdev Wiki, RTS Trick](https://wiki.nesdev.com/w/index.php/RTS_Trick) and [6502.org Jump Tables thread](http://forum.6502.org/viewtopic.php?f=2&t=4897) — the RTS-trick idiom and its relocation trap
- [cc65 `smc.inc` macro documentation](https://cc65.github.io/doc/smc.html) — real tooling convention for documenting self-modifying code with placeholder values
- [Bumbershoot Software, "Stabilizing the VIC-II Raster"](https://bumbershootsoft.wordpress.com/2015/12/29/stabilizing-the-vic-ii-raster/) and [Antimon, "Making Stable Raster Routines"](https://www.antimon.org/dl/c64/code/stable.txt) — cycle-exact raster technique and page-crossing branch-timing hazard
- [ethteck/splat](https://github.com/ethteck/splat) and its consuming projects (Ogre Battle 64, Rogue Squadron 64, Super Smash Bros. decomp) — segment/symbol-based rebuildable-source pattern from N64/GameCube decompilation, cross-platform confirmation of the scope-file + universal-symbolization shape
- [Held Games, "Retro Game Decompilation and Recompilation, Explained"](https://heldgames.com/guides/retro-decompilation-recompilation-explained) — the "100% matching decompilation" convention as the strongest (and here, deliberately not adopted) equivalence bar
- This project's own source, checked directly: `src/mcp/vice/anno-types.ts` (frozen `DATA_TYPES` vocabulary), `src/mcp/vice/anno-export-asm.ts` (current single-file export, no `external_file` consumer), `.planning/PROJECT.md`, `.planning/milestones/v0.5.0-REQUIREMENTS.md`
