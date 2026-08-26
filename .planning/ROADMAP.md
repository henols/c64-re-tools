# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ✅ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (shipped 2026-08-23)
- ✅ **v0.5.0 Persistent Session and the Coverage Instrument** — Phases 18-19; 20-22 cut (shipped 2026-08-25)
- **v0.6.0 Own the substrate** — Phases 23-26 (in progress, opened 2026-08-25)

*v0.6.0 continues phase numbering from Phase 22 — it starts at Phase **23**.
Phases 20, 21 and 22 were cut by the dxa+Ghidra pivot on 2026-08-25 and are
never reused. Phase numbers are continuous across milestones and never reused,
including the dissolved and cut ones.*

## Standing Constraints

These outlive any one milestone. They were carried out of v0.5.0's archived
phase notes at its close rather than left to be archived with them; the four
added at the v0.6.0 open are hazards demonstrated on committed fixtures during
the pivot exploration, each of which fails **silently** when broken.

- **A mutate-then-read sequence must not be split across separate connections.**
  Phase 9's recorded incident: doing so produced a `.vsf` snapshot that did not
  contain the bytes just written. A persistent session multiplies how many such
  sequences share one connection, so the discipline has to hold for longer, not
  less. Reuse the VICE broker's session-lifecycle patterns — single-owner
  acquire guard, PID/identity-verified kill, a persisted identity/lease file, a
  fragile no-retry liveness probe distinct from the resilient query path —
  rather than re-deriving lighter versions of each.
- **`.vsf` is not an established bootstrap input.** No shipped requirement
  covers it as one; its recorded home is the backlog item
  [`todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md`](todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md),
  which records why it was deferred. Point at that item, never at a numbered
  phase — the machine-type field only reads correctly by coincidence, matching
  none of the literal `System` arms and falling through to a default.
- **Ghidra deletes hardware writes as dead stores unless the I/O ranges are
  marked volatile — silently, with no warning.** *(Added at the v0.6.0 open,
  2026-08-25.)* Demonstrated on the committed `bank.a` fixture: under default
  settings three of four `$01` writes and a `$d020` write were eliminated. Any
  Ghidra run this project drives marks at least `$0000-$0001` and
  `$D000-$DFFF` volatile **before** `analyzeAll()`, and where the loader
  already owns a block at that address it sets the flag on the existing block
  rather than creating a conflicting one — a thrown `MemoryConflictException`
  makes the whole run fall back to non-volatile. Applied to a raster loop this
  deletes the entire visible effect of the program and reports success. See
  [`notes/ghidra-volatile-io-and-banking.md`](notes/ghidra-volatile-io-and-banking.md).
- **Ghidra's structural facts live in the decompiler layer, never the listing's
  data types.** *(Added at the v0.6.0 open, 2026-08-25.)*
  `DataTypeManager.getAllComposites()` and `getDefinedData()` — the obvious
  implementation — return essentially nothing on 6502. Every structural export
  goes through `DecompInterface`. Recorded as a standing constraint because it
  is the single most expensive mistake available in this design and its symptom
  is an empty result, not an error.
- **A `memmap.json` lookup is bank-parameterised and narrowest-range-wins, never
  flat and never first-match.** *(Added at the v0.6.0 open, 2026-08-25.)*
  `memmap.json` has a flat address model; the machine does not. Resolve `$01`
  bits 0-2 (LORAM / HIRAM / CHAREN) before resolving the address; select the
  smallest containing range, breaking ties toward the entry carrying a `sym`;
  skip the lookup entirely for any address inside the loaded image; and decline
  to annotate where the bank state is path-dependent. All four rules produce
  confident wrong comments rather than errors when broken, so each needs a
  control observed **red** without the fix — an assertion that the fix is
  present proves nothing. How far a single forward-carried `$01` value can be
  trusted is what `PROOF-03` establishes; the discipline above stands
  regardless of that answer. See
  [`notes/auto-annotation-from-ghidra-xrefs.md`](notes/auto-annotation-from-ghidra-xrefs.md).
- **dxa is the discovery engine and nothing more.** *(Added at the v0.6.0 open,
  2026-08-25.)* Checked, not assumed: `grep -in bank` over all 3,417 lines
  returns zero, and its entire C64-specific knowledge is eight lines testing
  whether the load address looks like a BASIC start. Never ask it about
  banking, the VIC, sprites, charsets or bitmaps. It also has **no
  machine-readable output**, so the listing parser — including its refusal
  behaviour on a listing it does not understand — is this project's to own and
  maintain.

## Phases

<details>
<summary>✅ v0.2.0 Switchable stock-VICE backend (Phases 1-8, 8.1, 8.2) — SHIPPED 2026-08-19</summary>

**Delivered:** a second, project-selectable backend that drives stock upstream
VICE through its binary monitor — so a user with an apt-installed VICE can run
the six shipped skills, and is told plainly where they must reach for the fork
instead. The stock manifest ships **38** tools against the fork's 62; the gap is
documented rather than hidden.

- [x] Phase 1: Corrected Ground Truth (4/4 plans) — completed 2026-08-12
- [x] Phase 2: Stock Backend Connection (10/10 plans) — completed 2026-08-13
- [x] Phase 3: Direct Tools (18/18 plans) — completed 2026-08-16
- [x] Phase 4: Client-Side Tool Seam and 6510 Disassembler (7/7 plans) — completed 2026-08-17
- [x] Phase 5: Skill-Critical Derived Tools (13/13 plans) — completed 2026-08-17
- [~] Phase 6: Stock-Only Gains — **CUT** 2026-08-17 (no skill calls any of them)
- [x] Phase 7: Cycle Timing and Wedge Triage (18/18 plans) — completed 2026-08-18
- [x] Phase 8: Capability Honesty and the Install Story (6/6 plans) — completed 2026-08-18
- [x] Phase 8.1: Close v0.2.0 audit items (INSERTED) (5/5 plans) — completed 2026-08-19
- [x] Phase 8.2: Close v0.2.0 blockers (INSERTED) (6/6 plans) — completed 2026-08-19

**Shipped and archived 2026-08-19:** 9 phases, 87 plans, 218 tasks, 51/51
in-scope requirements, 8 days. Final audit round 4 — `tech_debt`, no blockers.

**Full phase details, standing constraints, cut-scope rationale and success
criteria:** [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
**Final audit (round 4, `tech_debt`, no blockers):** [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.3.0 regenerator2000 static-analysis backend (Phases 9-11, 11.1) — SHIPPED 2026-08-21</summary>

**Delivered:** recon findings stop being prose. regenerator2000 is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler — reached through **17** curated `r2000_*` tools
and a `vice-mcp r2000 <verb>` CLI, entirely container-side and structurally
incapable of touching VICE. Register writes read as bit names, symbols flow both
ways between the store and a live emulator, and the flat linear `toacme` decoder
it makes obsolete is deleted.

- [x] Phase 9: The Assumption Probe (Go/No-Go) (8/8 plans) — completed 2026-08-20 — verdict `degrade` (rule `R4`), see `docs/phase9-regenerator2000-probe-findings.md`
- [x] Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal (9/9 plans) — completed 2026-08-20
- [x] Phase 11: Annotation Store, Enums, and the Symbol Round Trip (12/12 plans) — completed 2026-08-21
- [x] Phase 11.1: Close v0.3.0 Audit Items (INSERTED) (7/7 plans) — completed 2026-08-21

**Shipped and archived 2026-08-21:** 4 phases, 36 plans, 101 tasks, 12/12
in-scope requirements, 3 days. Final audit round 2 — `passed`, zero open gaps.

**Full phase details, standing constraints, cut-scope rationale, success
criteria and the close-time milestone summary:** [`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.3.0-REQUIREMENTS.md`](milestones/v0.3.0-REQUIREMENTS.md)
**Final audit (round 2, `passed`):** [`milestones/v0.3.0-MILESTONE-AUDIT.md`](milestones/v0.3.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.4.0 Debt discharged, decisions settled (Phases 12-17) — SHIPPED 2026-08-23</summary>

**Goal:** Stop inheriting the same ledger a third time. Every carried item
becomes a fix or a dated decision, and the two questions this project has
answered *by default* each milestone (the fork backend, the Core Value
statement) get answered deliberately.

**Delivered:** the pending-todo tree reads genuinely empty for the first time in
this project's history — **19 inherited items → 0**. Both default answers are now
dated decisions pinned by their own guards (`FORK-01` **retain**, `CORE-01`
**keep-dated**). The instrument that makes any of it checkable was built first
and has been observed refusing a real write: `scripts/audit-gate.mjs`, wired as a
`Write|Edit|Bash` PreToolUse hook, makes a clean audit status impossible over a
red docs guard. External verification replaced the internal proxies on the three
highest-value carried items, and one advertised promise was **refuted** by the
real binary rather than confirmed. The plugin payload moved under `src/` with
both published tarballs still validated.

- [x] Phase 12: Audit Integrity Instrument (7/7 plans) — completed 2026-08-22 — verification 11/11; the live `PreToolUse` dispatch observed refusing all four write routes
- [x] Phase 13: External Verification (5/5 plans) — completed 2026-08-22 — `vice_disk_attach`'s no-side-effect promise refuted against a real binary and corrected at source
- [x] Phase 14: Backend Decision (5/5 plans) — completed 2026-08-22 — `FORK-01` **retain**, with the upstream `KEYBOARD_MATRIX_SET` coupling as the named reversal criterion; the fork's `-mcpserver` transport exercised live for the first time (6/6)
- [x] Phase 15: Debt and Review Disposition (12/12 plans) — completed 2026-08-22 — pending-todo tree 21 → 2, review findings 119 → 150 visible and all dispositioned, Phase 03's last UAT scenario closed by live experiment
- [x] Phase 16: Packaging and Repo Shape (11/11 plans) — completed 2026-08-23 — payload under `src/` in two atomic `git mv`s, `QUAL-01..03` closed, tarball proven byte-identical
- [x] Phase 17: Project Identity and Ledger Close (4/4 plans) — completed 2026-08-23 — `CORE-01` **keep-dated** at a `blocking-human` checkpoint; the ledger reads 0 at the true close

**Shipped and archived 2026-08-23:** 6 phases, 44 plans, 119 tasks, 16/16
requirements (zero cut, zero deferred), 2 days, 292 commits. Final audit round 1
— `tech_debt`, **zero blockers and zero open gaps** (16/16 requirements, 6/6
phases, 12/12 integration, 4/4 flows); what remained was bookkeeping debt and
validation coverage. Closed as `override_closeout`: the pre-close artifact audit's
16 open items were acknowledged rather than resolved — see `STATE.md` →
`### Acknowledged at the v0.4.0 close`.

**Full phase details, success criteria and sequencing rationale:**
[`milestones/v0.4.0-ROADMAP.md`](milestones/v0.4.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.4.0-REQUIREMENTS.md`](milestones/v0.4.0-REQUIREMENTS.md)
**Final audit (round 1, `tech_debt`, no blockers):** [`milestones/v0.4.0-MILESTONE-AUDIT.md`](milestones/v0.4.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v0.5.0 Persistent Session and the Coverage Instrument (Phases 18-19; 20-22 cut) — SHIPPED 2026-08-25</summary>

**Opened as** "The rebuild half — absorbed playbooks, modifiable source" (Phases
18-22). **Delivered** its first half and cut its second: a regenerator2000
session that survives many tool calls, all five upstream analyze procedures
absorbed and attributed, a seventh skill, and a derived-from-bytes coverage
census that the store's own block table cannot move by a single byte.

- [x] Phase 18: Persistent Session and Tool Surface (7/7 plans) — completed 2026-08-24
- [x] Phase 19: Absorbed Procedures and the Coverage Instrument (20/20 plans) — completed 2026-08-25
- [~] Phase 20: Decomposition to Closure — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)
- [~] Phase 21: Rebuildable Source and the Reassembly Gate — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)
- [~] Phase 22: Equivalence and Modifiability — **CUT** 2026-08-25 (dissolved by the dxa+Ghidra pivot)

**Shipped and archived 2026-08-25:** 2 executed phases, 27 plans, 61 tasks,
13/27 requirements. `override_closeout` — the 14 unchecked requirements
(DECOMP-*, BUILD-*, EQUIV-*) all belong to the three cut phases; none was
attempted and failed, and all are re-mapped to v0.6.0 rather than dropped.
*(Correction, 2026-08-25, recorded rather than rewritten: at the v0.6.0 scoping
those 14 were held for **v0.7.0** instead, since each is written against a
substrate v0.6.0 builds. The sentence above stands as what was decided at the
v0.5.0 close; this note is what changed after it.)*

**Why 20-22 were cut.** The milestone's second half was written against
regenerator2000 as the analysis substrate. Measurement on a committed 279-byte
fixture showed r2000 unannotated flat-decodes, while dxa recovered 72% of data
bytes with zero false positives and resolved a dispatch table unaided, and
Ghidra — given dxa's map plus volatile I/O blocks — resolved the indirect
dispatch, the self-modifying write, and the index/stride/split-pointer facts.
The goals survive; the substrate does not. Reverses D-R1/D-R2.

**Pivot record and reproduction material:**
[`notes/dxa-ghidra-pivot.md`](notes/dxa-ghidra-pivot.md),
[`notes/auto-annotation-from-ghidra-xrefs.md`](notes/auto-annotation-from-ghidra-xrefs.md),
[`notes/ghidra-volatile-io-and-banking.md`](notes/ghidra-volatile-io-and-banking.md),
[`notes/vic-graphics-map-derivation.md`](notes/vic-graphics-map-derivation.md),
[`notes/dxa-ghidra-pivot-evidence/`](notes/dxa-ghidra-pivot-evidence/)

**Full phase details and success criteria:** [`milestones/v0.5.0-ROADMAP.md`](milestones/v0.5.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md)

</details>

### v0.6.0 Own the substrate (Phases 23-26)

**Goal:** Replace regenerator2000 as the analysis substrate with dxa + Ghidra and
an annotation store this project owns — proving the pivot's numbers hold on real
cracked code *before* anything is built on them.

**Scoped to the substrate only.** `DECOMP-01..04`, `BUILD-01..06` and
`EQUIV-01..04` stay held for v0.7.0 rather than rewritten now against a store
that does not exist yet. That is a scoping decision taken 2026-08-25, not a
second cut — their text stands unchanged in
[`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md).

**Phase numbering starts at 23.** Phases 20, 21 and 22 were cut on 2026-08-25 by
the dxa+Ghidra pivot and are never reused.

- [ ] **Phase 23: The Real-Release Gate (Go/Degrade/No-Go)** - The pivot's numbers re-measured against real cracked releases, with a recorded verdict able to narrow or cancel everything after it
- [ ] **Phase 24: The Two Engines** - dxa separates code from data and Ghidra headless recovers semantics, with all 105 undocumented opcode bytes decodable and hardware writes surviving the decompiler
- [ ] **Phase 25: The Annotation Store and the Cutover** - This project owns the annotation state and its ACME export, and 19,181 lines of regenerator2000 glue are deleted rather than left standing beside their replacement
- [ ] **Phase 26: Automatic Annotation** - Machine addresses annotate themselves, bank-aware, declining rather than guessing where the bank state is path-dependent

## Phase Details

### Phase 23: The Real-Release Gate (Go/Degrade/No-Go)

**Goal**: The pivot's numbers are re-measured against real cracked releases
rather than one 279-byte self-authored fixture, and a recorded verdict says
whether v0.6.0 proceeds as scoped, degrades, or is reconsidered — produced
before a line of engine or store code exists.
**Depends on**: Nothing (first phase of v0.6.0; runs against either backend and needs no v0.5.0 artifact)
**Requirements**: PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05
**Success Criteria** (what must be TRUE):

  1. dxa's data-recovery rate and false-positive count are readable as numbers against a **named real release** — binary identified by release id and hash — and printed *beside* the 279-byte fixture's 72%-data / 0-false-positive claim rather than replacing it, so a reader can see for themselves whether the fixture flattered the tool. The error *direction* is re-measured too (the fixture scored 0 false positives against 28% false negatives), because which way the errors run is what decides whether the graphics-feedback containment in Phase 26 is sufficient or load-bearing.
  2. A **computed**-index indirect dispatch taken from real code is either resolved by Ghidra's constant propagation, with the resolved target shown, or recorded as unresolved with its transcript. A corpus containing no computed dispatch is reported as *not exercised* and never as a pass — the pivot fixture used an immediate `ldx #$02`, which is the easy case, and silently re-testing the easy case would reproduce exactly the defect this phase exists to remove.
  3. The point at which a single forward-carried `$01` value stops being correct is **established rather than assumed**: at least one address in real banking code is shown annotating differently under two bank states, or the absence of such an address in the corpus is recorded as a fact about the corpus rather than about the model. This is the highest-risk item on the pivot's own record.
  4. What the dropped `analyzer.rs` work did that the dxa+Ghidra pair does not is a named list of concrete capabilities, each either matched to a replacement or accepted as lost with what it costs — derived from the real thing, not inferred from the fixture.
  5. A machine-readable verdict — `go` / `degrade` / `no-go` — is recorded against decision rules **committed before the measurements were run**, and Phase 24's planner reads it as a precondition. A `degrade` verdict names which requirements narrow and how; a `no-go` names what the milestone becomes instead. Phase 9's precedent is the bar: the rule fired, `degrade` was honoured rather than overridden, and the milestone shipped smaller and correct.

**Plans**: 11 plans

Plans:
**Wave 1**

- [ ] 23-01-PLAN.md — Pre-commit the decision rule R1..R9, the outcome-line schema, the criterion-1 measurement definitions and the evidence conventions (wave 1, alone)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 23-02-PLAN.md — Provision dxa 0.1.5 pinned by sha256, Ghidra 12.1.3 and the probe scripts, proven end-to-end on the 279-byte fixture (the tracer)
- [ ] 23-03-PLAN.md — Corpus intake and depack-by-running flat 64K captures for both releases, with capture equivalence proven
- [ ] 23-04-PLAN.md — The analyzer.rs capability audit, read offline, every capability given one of three dispositions

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 23-05-PLAN.md — The VICE-observed corpus inventory: $01 timeline, dispatch sites, certain sets and the measurement window
- [ ] 23-06-PLAN.md — Two-release provenance classification, holding cracker-authored bytes out of criterion 1's denominator

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 23-07-PLAN.md — Criterion 1: dxa's data-recovery rate and error direction, printed beside the fixture's reproduced numbers
- [ ] 23-08-PLAN.md — Criterion 2: Ghidra against a computed-index dispatch, checked site by site against the runtime inventory
- [ ] 23-09-PLAN.md — Criterion 3: where a single forward-carried $01 value stops being correct, established by observation

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 23-10-PLAN.md — The findings document and the machine-readable verdict, derived from the pre-committed rule

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 23-11-PLAN.md — ROADMAP and STATE pointers gating Phase 24, and the PROOF traceability flip

Notes:

- **This phase is the gate, and its verdict is an artifact, not a judgement held in a head.** Criterion 5 is what makes the gate structural rather than skippable. Read the recorded verdict before planning Phase 24.
- **Nothing downstream may be planned as though the answer is already known.** Do not write Phase 24, 25 or 26 plans before this phase closes. `PROOF-05`'s own wording is "before any engine or store code is written".
- Nothing here builds product. If the probe wants throwaway scripts, they are evidence, not deliverables — the Phase 9 shape exactly (8 plans, zero product code).
- **Write the rules before you have the answers.** Phase 9's `R4` was credible only because its inputs and thresholds were committed while the outcome was still unknown. A rule written after the measurement makes every future gate advisory.
- **The corpus is an input this phase must secure first, and its absence is itself a gate input.** `c64-provenance-diff` operates on a *consuming* project's `recovery/` tree (`RELEASES.json` plus `.bin` dumps and their `.map.json` manifests); nothing in this repository is a real release — `find` over the whole tree returns three `.prg` files, all synthetic probe fixtures. If real, independently-cracked releases cannot be obtained, measuring on another self-authored fixture reproduces the exact defect `PROOF-01` exists to remove, and that fact belongs in the verdict rather than in a footnote.
- The releases are already provenance-classified, which is worth using: a `CRACKER-PATCH` range is loader or cracktro code and a measurement that silently mixes it with game code is measuring two different things at once.
- Research question 2 — *does Ghidra's 6502 decompiler degrade on illegal opcodes in real code* — is **not** a v0.6.0 requirement and is deliberately unmapped. Real cracked code will exercise it incidentally here; the deliberate answer is `OPC-03` in Phase 24. If this phase observes an undecodable byte poisoning a whole function rather than being skipped, record it: it raises `OPC-01`'s priority inside Phase 24, and it does not add scope here.

### Phase 24: The Two Engines

**Goal**: A raw C64 binary goes in and machine-readable facts come out — dxa
separating code from data, Ghidra headless recovering structure under this
project's own harness — with the 105 undocumented opcode bytes decodable so
cracked code is not silently mis-read, and hardware writes surviving the
decompiler rather than being deleted as dead stores.
**Depends on**: Phase 23 — the recorded verdict gates this phase's scope; a `degrade` narrows it and a `no-go` may dissolve it
**Requirements**: DXA-01, DXA-02, DXA-03, GHID-01, GHID-02, GHID-03, GHID-04, GHID-05, OPC-01, OPC-02, OPC-03
**Success Criteria** (what must be TRUE):

  1. A caller hands a `.prg` or flat 64K image to a command this project ships and gets a machine-readable code/data map back — from a dxa this project **builds at a pinned version** with its GPLv2+ notice recorded, never one assumed present on `$PATH`. Naming a known-data range excludes those bytes from discovery. On a listing it does not understand the parser **refuses by name**, proven by a planted malformed listing line producing the refusal rather than a partial map — a silent mis-parse here feeds phantom code into every stage downstream, which is the one failure this parser exists to prevent.
  2. Ghidra runs headless against the same image from a **committed script**, handed dxa's map as hints — reproducible by a second run from a clean project rather than reachable only through a documented click-path.
  3. **The volatile-I/O hazard is proven caught, not asserted fixed.** A committed control removes the volatile flag from `$0000-$0001` / `$D000-$DFFF` and the test observes the hardware writes *disappearing* from the decompiler output — red without the fix, green with it — so the guard is demonstrably measuring the deletion rather than restating the fix. A run where the loader already owns a block at that address sets the flag on the existing block, and is proven not to fall back to non-volatile through a swallowed `MemoryConflictException`.
  4. Structural facts no listing-level query can produce are present in the export **from a real binary**: an array bound, the split-pointer `CONCAT11` idiom, a record stride, at least one resolved computed jump and at least one self-modifying write target — with cross-references carrying their access kind (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), not addresses alone. A committed control asserts the same export routed through `DataTypeManager` returns essentially nothing, so the single most expensive mistake available in this design is one a future edit cannot make silently.
  5. All 105 opcode bytes stock `6502.slaspec` omits decode under the extension, and loading `65c02.slaspec` in the same installation still yields *its* documented meanings for the bytes both claim — the layering is demonstrated non-colliding rather than asserted. `XAA` (`$8b`), immediate `LAX`/`LXA` (`$ab`) and the page-crossing-dependent `AHX`/`TAS`/`SHX`/`SHY` read as **declared unknowns** in the output, never as plausible p-code. The extension is exercised against real code containing illegal opcodes — a cracked or packed release from Phase 23's corpus — not only a synthetic opcode sweep, with the before/after difference in decompiler output recorded.

**Plans**: TBD

Notes:

- **Verdict-gated.** Read Phase 23's recorded verdict before writing any plan here.
- **The single most expensive mistake available in this design** is writing the structural-fact export against `DataTypeManager`. Measured on the pivot fixture: `getAllComposites()` and `getDefinedData()` return essentially nothing on 6502, while `DecompInterface` yields the index bound, the split-pointer idiom and the record stride directly. Criterion 4's control exists so this cannot be re-made silently.
- **The volatile block is a correctness requirement of the pre-script, not a tuning option**, and it fails silently — see Standing Constraints. Call `mem.getBlock(addr)` first and `setVolatile(true)` on an existing block rather than creating a conflicting one.
- **Why `OPC-*` stays in this phase rather than becoming its own.** Its verification is not separable. `OPC-03` can only be checked by running the harness `GHID-01` delivers, and `GHID-04`'s acceptance — structural facts recovered from *real cracked code* — is not honestly claimable while 105 opcode bytes are undecodable, because crack and packer code is exactly where that gap bites. Splitting would force Phase 24 to close on a claim its own corpus contradicts and a later phase to reopen it. The phase still groups three ways in planning — discovery, semantic harness, opcode coverage — with the SLEIGH extension sequenced **ahead of** criterion 4's acceptance run, not after it.
- The SLEIGH source already exists in full: `docs/undocumented-opcodes-ghidra.md`, 776 lines, all 105 bytes, with the unstable instructions already modelled as black-box userops and the `@include` layering already written against the `65c02.slaspec` collision. This phase integrates and verifies it; it does not write it from scratch.
- dxa 0.1.5 is 3,417 lines of C, GPLv2+, builds clean with plain `make`, dormant since a 2022-03 tarball, and ships in no Debian package (`dpkg -L xa65` has no `dxa`). Vendor and build; do not assume `$PATH`.
- **Reuse rather than rebuild** (`CUT-02` is Phase 25's, but the reuse decisions are taken here): `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` already decode 6502 including illegal opcodes across 2,555 lines, and `r2000-d64.ts` is 310 standalone lines. Neither is r2000's.
- Ghidra alone, with zero hints, produced **nothing** on the pivot fixture — 0 functions, 0 code bytes. The map from dxa is not an optimisation; it is what makes Ghidra work at all on a headerless 6502 image.

### Phase 25: The Annotation Store and the Cutover

**Goal**: This project owns the annotation state — labels, comments, per-range
typing, scopes, enums, undo, persistence — reached through its own MCP surface
and exported as ACME a real assembler accepts, and the 19,181 lines of
regenerator2000 integration glue are deleted rather than left standing beside
their replacement.
**Depends on**: Phase 24 — the store's typed decode and cross-references are populated from the engines' output, and nothing may delete r2000 before a replacement demonstrably produces the same facts. Verdict-gated on Phase 23
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, CUT-01, CUT-02, CUT-03
**Success Criteria** (what must be TRUE):

  1. A caller creates and queries labels, comments, per-range data typing (code, byte, word, address, PETSCII, screencode, table), scopes and project enums through MCP tools **this project owns**, declared in `capability-registry.ts` and advertised identically on the stock and fork manifests. The family registers proxy-locally and never reaches `forwardToVice()`, so backend-agnosticism is structural rather than tested once per backend — asserted over the shipped module set, not by a hand-maintained list.
  2. **Durability is proven by planted violation, not by a passing happy path.** An edit is undoable, and a mutate → kill → reopen → read sequence returns the mutation; removing the save makes that same test go **red**, observed rather than assumed.
  3. The capability `R2000-11` shipped survives the substrate swap: *which addresses reference this address*, and search across labels, comments and instructions, are still answerable — against a program analysed by the new engines, with the old route gone rather than kept as a fallback.
  4. Exported ACME **reassembles under a real ACME** through the `--verify` seam that keys strictly on ACME's own result line, and both carried idioms are load-bearing in that reassembly: a self-modifying write target named by the `=*+$01` mid-instruction label reassembles byte-identically, and typed label prefixes carry the inferred type. Proven by the assembler, never by a string match on the exporter's own output — this project's own record is that an internally-checked opcode table still shipped 14 wrong entries.
  5. The removal is real and stays removed: 19,181 lines of glue (9,087 non-test + 9,928 test) deleted, with a whole-tree grep gate **observed biting** on a planted reintroduction; every living document naming regenerator2000 as a required prerequisite corrected — install documentation, `CLAUDE.md`'s constraints, all seven skill playbooks — and what survives (`disasm-*.ts`, `r2000-d64.ts`, `memmap.json` with `r2000-regbits-gen.ts` and `r2000-enum-gen.ts`) reused under names that no longer say `r2000`.

**Plans**: TBD

Notes:

- **Verdict-gated** on Phase 23 like everything after it.
- The store is `DECOMP-01`'s substrate in v0.7.0, and per-range typing is the part nothing else in the stack records. Type for what v0.7.0 needs now, not for the minimum this milestone happens to exercise — `STORE-01` says so explicitly, and rebuilding the type vocabulary one milestone later is exactly the double-write this milestone's scoping decision exists to avoid.
- **The MCP family registers through `buildViceTool()` and never reaches `forwardToVice()`** — the same structural route the `r2000_*` family used. That is what satisfies CLAUDE.md's derived-tool path-translation constraint *by construction*, with no interception to forget, and it makes the family backend-agnostic for free. Assert it over `package.json`'s `files[]`, the way `hostpath-consumers.test.ts` already does, rather than over a raw directory listing.
- **The removal pattern is the `toacme` one**: a whole-tree grep gate proven to bite on a planted reintroduction, not a documented deletion. That precedent bit on a non-`SKILL.md` file, which is why the gate is whole-tree rather than playbook-scoped.
- `CUT-03`'s blast radius is wider than the install docs: `CLAUDE.md` carries three regenerator2000 constraint bullets, `PROJECT.md` carries constraints, Out-of-Scope entries and Key Decisions rows, `THIRD-PARTY-NOTICES.md` carries the dual-licence notice, and all seven skill playbooks name the route. A skill pointing at a deleted route is worse than one pointing at nothing.
- **Deleting r2000 also deletes what several committed guards read.** `r2000-spawn-seam.test.ts`, `docs-r2000-decisions.test.ts` and `r2000-answer-key.test.ts` — the last reading `.planning/phases/11-*/evidence/` with no existence guard — are pinned to the thing being removed. Plan their fate explicitly; discovering it in a red CI run at the phase gate is the avoidable version of this.
- r2000's own C64 map is 732 labels, names only, no descriptions, and its first line excludes the entire hardware register file. Nothing in the store's machine knowledge comes from it; `memmap.json` (959 entries, 4 published sources) is the source and is already pinned upstream of the enum path by `memmapSha256`.

### Phase 26: Automatic Annotation

**Goal**: Machine addresses annotate themselves — the join runs mechanically
with no agent in the loop, resolves bank state before address, and declines
rather than emitting a confident wrong comment wherever it cannot be sure.
**Depends on**: Phase 24 (the join consumes typed cross-references) and Phase 25 (the annotations land in the store). Verdict-gated on Phase 23, which tests this phase's third selection rule directly
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07
**Success Criteria** (what must be TRUE):

  1. One command over an analysed real binary writes machine-address annotations into the store with **no agent call, no queue walk and no skill invocation** anywhere in the loop, reporting how many addresses were annotated and how many skipped. The annotations are read back **out of the store**, not out of the pipeline's own stdout.
  2. **The narrowest-range rule is proven against the wide entry it must beat.** A committed control asserts `$D020` annotates as the 1-byte border-colour entry and *not* as the 4096-byte I/O-area entry, and that switching selection to first-match or to longest-description makes that control go **red**. Ties resolve toward the entry carrying a `sym`. A criterion that only asserted the fix would be worthless here: this rule was got wrong on the first attempt during the pivot exploration and produced plausible, confident, wrong comments rather than an error.
  3. An in-program branch target inside the loaded image is **skipped**, never annotated out of the "Default BASIC area" entry, with a control that goes red if the image-range check is removed — the first attempt annotated two ordinary loop-back branches as machine features.
  4. **Bank state is resolved before the address, proven by a flip rather than by an assertion.** The same address annotates differently under two `$01` states in one program: a `$d020` write under `$34` is not labelled the border colour, and a `$d000` read under `$33` is not labelled sprite-0-X — with a control that goes red when the `$01` bits 0-2 decode is bypassed. Where bank state is path-dependent (computed, or set inside a routine reached from several banking contexts) the join emits **no annotation** and says why, rather than carrying one value forward and being confidently wrong.
  5. Screen matrix, charset-or-bitmap and sprite-pointer ranges are derived from the VIC pointer writes (`$DD00` bits 0-1 inverted, `$D018`, `$D011` bit 5, screen + `$3F8`) for a charset **referenced by no instruction anywhere in the program** — the case cross-references structurally cannot find, because the VIC fetches by DMA. Those ranges are fed back to dxa as `-b` data blocks and to Ghidra as data, with the phantom labels a graphics region mints when decoded as code shown present before the feedback and absent after.

**Plans**: TBD

Notes:

- **Verdict-gated, and the most exposed of the four.** `PROOF-03` tests this phase's rule 3 directly; a `degrade` verdict most plausibly lands here, narrowing `AUTO-04`/`AUTO-05` to a declared-unknown-everywhere fallback rather than a resolved bank state.
- **All three selection rules fail silently.** Each was got wrong on the first attempt during the pivot exploration, and each produced plausible, confident, wrong comments rather than an error. That is why criteria 2, 3 and 4 each require a control **observed red** without the fix. Against a silent failure mode, a criterion that merely asserts the fix is worthless — this project has been taught the general form of that lesson six times.
- The join's containment for the pipeline's most dangerous failure is `AUTO-07`, not a review step. Graphics bytes decoded as instructions mint phantom labels (`zpp_02`, `zpa_06`, `f_1B1A`) indistinguishable in form from genuine ones; a phantom routine inside a charset gets promoted to a Ghidra function, yields phantom xrefs, feeds the join, and emerges as a confident wrong comment the next pass treats as established.
- The error direction makes graphics regions the worst offender specifically: dxa scored **0 false positives** but 28% false negatives on the pivot fixture — its errors run exactly the dangerous way (data called code), and graphics regions are the largest single source of them. Phase 23's criterion 1 re-measures that direction on real code.
- This annotates **machine** addresses only. What `$1173` does *in this program* remains a finding a human or agent produces — which is the reason an annotation store has to exist at all, and the boundary between this phase and v0.7.0's `DECOMP-*`.
- `memmap.json` is **more** load-bearing after the pivot, not less: it moves from a skill an agent invokes to a data source a pipeline stage joins against.
- Two gaps are carried rather than owned here, both recorded in `REQUIREMENTS.md` → "Carried, unowned by this milestone": sprite *bitmap* locations (the pointer values are program data usually written at runtime, so they are not register values Ghidra recovers) and the second VIC banking axis under path-dependent state. Do not let a plan quietly promise either.
- One map per program point, not one per program: a program that switches bank or charset per raster split has several valid graphics maps, and a single derived map is wrong for all but one. Same path-dependence limit as criterion 4.

## Sequencing Rationale (v0.6.0)

**Four phases, at `standard` granularity.** The requirements cluster into four
delivery boundaries that each complete a verifiable capability: a verdict, a
toolchain, a store, and a join. No phase here is a technical layer.

**Why the gate is a phase and not a criterion inside one.** Every number behind
this pivot comes from one 279-byte fixture written by the same person testing
it. `PROOF-05`'s failure mode is *reconsider the milestone*, not *replan the
phase* — if dxa's recovery rate collapses on real packed code, or if bank state
proves path-dependent everywhere that matters, Phases 24-26 are not the same
phases. A note inside a larger phase makes that gate skippable; a phase boundary
makes it structural. The precedent is Phase 9, where the gate fired for real,
`degrade` was honoured rather than overridden, and the milestone shipped smaller
and correct. **Nothing in Phases 24-26 is planned as though Phase 23's answer is
already known.**

**Why the engines precede the store.** The store's cross-references and typed
decode are populated *from* the engines' output. Building the store first means
designing its schema against a guess at what `DecompInterface` returns, then
rewriting it — the same double-write the milestone's own scoping decision
avoided by holding `DECOMP-*`/`BUILD-*`/`EQUIV-*` for v0.7.0.

**Why the cutover rides with the store rather than being its own phase.** The
deletion is only safe once a replacement demonstrably produces the same facts,
and `CUT-02`'s reuse decisions (`disasm-*.ts`, `r2000-d64.ts`, `memmap.json`
plus the two generators) are decisions about what the store is built out of.
Split apart, Phase 25 would end with the replacement standing beside its
predecessor — exactly the state `CUT-01` exists to prevent — and a later phase
would carry a deletion with no build work in it, which is the thin-maintenance-
phase shape this project's granularity guidance says to fold.

**Why `OPC-*` is inside Phase 24.** Argued in full in that phase's notes: its
verification is not separable from the harness that runs it, and Phase 24 cannot
honestly claim structural facts recovered from real cracked code while 105
opcode bytes are undecodable — crack and packer code being exactly where the gap
bites. Splitting would produce a phase that closes on a claim its own corpus
contradicts.

**Why automatic annotation is last.** It consumes both the engines' typed
cross-references and the store's write surface, and it is the only phase whose
core rules are already known to fail *silently*. Running it last means its three
red-observed controls run against the real pipeline rather than against a stub.

## Progress

**This per-phase table is load-bearing, not decorative.**
`comment-phase-pointers.test.ts`'s `parseCutPhasesFromRoadmap()` parses it to
derive the cut/dissolved phase set that its orphaned-pointer check runs against
— it splits on the `## Progress` heading and reads column 1 (`N.` or `N.M`) and
column 4 (Status) of every row. Collapsing it to a per-milestone summary makes
that set empty and turns four of its tests red. Keep the per-phase rows, keep
the column order, and keep cut/dissolved phases recorded here rather than only
in a milestone archive.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corrected Ground Truth | v0.2.0 | 4/4 | Complete | 2026-08-12 |
| 2. Stock Backend Connection | v0.2.0 | 10/10 | Complete | 2026-08-13 |
| 3. Direct Tools | v0.2.0 | 18/18 | Complete | 2026-08-16 |
| 4. Client-Side Tool Seam and 6510 Disassembler | v0.2.0 | 7/7 | Complete | 2026-08-17 |
| 5. Skill-Critical Derived Tools | v0.2.0 | 13/13 | Complete | 2026-08-17 |
| 6. Stock-Only Gains | v0.2.0 | — | **Cut** 2026-08-17 | - |
| 7. Cycle Timing and Wedge Triage | v0.2.0 | 18/18 | Complete | 2026-08-18 |
| 8. Capability Honesty and the Install Story | v0.2.0 | 6/6 | Complete | 2026-08-18 |
| 8.1 Close v0.2.0 audit items (INSERTED) | v0.2.0 | 5/5 | Complete | 2026-08-19 |
| 8.2 Close v0.2.0 blockers (INSERTED) | v0.2.0 | 6/6 | Complete | 2026-08-19 |
| 9. The Assumption Probe (Go/No-Go) | v0.3.0 | 8/8 | Complete | 2026-08-20 |
| 10. Adoption Boundaries, Automated Bootstrap, and the Removal | v0.3.0 | 9/9 | Complete | 2026-08-20 |
| 11. Annotation Store, Enums, and the Symbol Round Trip | v0.3.0 | 12/12 | Complete | 2026-08-21 |
| 11.1 Close v0.3.0 Audit Items (INSERTED) | v0.3.0 | 7/7 | Complete | 2026-08-21 |
| 12. Audit Integrity Instrument | v0.4.0 | 7/7 | Complete | 2026-08-22 |
| 13. External Verification | v0.4.0 | 5/5 | Complete | 2026-08-22 |
| 14. Backend Decision | v0.4.0 | 5/5 | Complete | 2026-08-22 |
| 15. Debt and Review Disposition | v0.4.0 | 12/12 | Complete | 2026-08-22 |
| 16. Packaging and Repo Shape | v0.4.0 | 11/11 | Complete | 2026-08-23 |
| 17. Project Identity and Ledger Close | v0.4.0 | 4/4 | Complete | 2026-08-23 |
| 18. Persistent Session and Tool Surface | v0.5.0 | 7/7 | Complete | 2026-08-24 |
| 19. Absorbed Procedures and the Coverage Instrument | v0.5.0 | 20/20 | Complete | 2026-08-25 |
| 20. Decomposition to Closure | v0.5.0 | 0/0 | Cut | 2026-08-25 |
| 21. Rebuildable Source and the Reassembly Gate | v0.5.0 | 0/0 | Cut | 2026-08-25 |
| 22. Equivalence and Modifiability | v0.5.0 | 0/0 | Cut | 2026-08-25 |
| 23. The Real-Release Gate (Go/Degrade/No-Go) | v0.6.0 | — | Not started | - |
| 24. The Two Engines | v0.6.0 | — | Not started | - |
| 25. The Annotation Store and the Cutover | v0.6.0 | — | Not started | - |
| 26. Automatic Annotation | v0.6.0 | — | Not started | - |

**Milestone roll-up:** v0.2.0 — 9 phases, 87 plans, 51/51 in-scope requirements,
shipped 2026-08-19 (audit round 4 `tech_debt`; 13 deferred items at close).
v0.3.0 — 4 phases, 36 plans, 101 tasks, 12/12 in-scope requirements, shipped
2026-08-21 (audit round 2 `passed`, zero gaps; 19 deferred items at close).
v0.4.0 — 6 phases, 44 plans, 119 tasks, 16/16 requirements, shipped 2026-08-23
(audit round 1 `tech_debt`, zero blockers and zero open gaps; **0** pending
todos at close, 16 bookkeeping items acknowledged). v0.5.0 — 2 executed phases
(18, 19), 27 plans, 61 tasks, 13/27 requirements, shipped 2026-08-25 as
`override_closeout`; Phases 20-22 cut by the dxa+Ghidra pivot with their 14
requirements re-mapped to v0.7.0, not dropped. v0.6.0 — opened 2026-08-25,
Phases 23-26, 32/32 requirements mapped, not yet shipped. Requirements cut in
earlier milestones stay in their own `milestones/v*-REQUIREMENTS.md` marked
`CUT` with rationale, so restoring one is a scope decision rather than
archaeology.

**Phase directories are not archived.** Unlike the roadmap and requirements,
`.planning/phases/` accumulates across milestones by design.
`docs-review-disposition.test.ts` asserts at least 150 review findings read out
of `.planning/phases/` and explicitly excludes `.planning/milestones/`, and
`r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard — archiving them turns both red. Every milestone close therefore
passes `--no-archive-phases`. *Phase 25 deletes the subject of the second of
those guards; that guard's fate is planned there, not discovered at a gate.*

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 shipped and collapsed 2026-08-23 → `milestones/v0.4.0-ROADMAP.md`*
*v0.5.0 shipped and collapsed 2026-08-25 → `milestones/v0.5.0-ROADMAP.md`*
*v0.6.0 roadmap created 2026-08-25 — Phases 23-26, continuing numbering from Phase 22, 32/32 requirements mapped.*
*Phase numbering is continuous across milestones and never reused, including the cut Phases 20-22.*
