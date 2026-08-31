# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ✅ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (shipped 2026-08-23)
- ✅ **v0.5.0 Persistent Session and the Coverage Instrument** — Phases 18-19; 20-22 cut (shipped 2026-08-25)
- 🗄 **v0.6.0 Own the substrate** — Phases 23-26 (CLOSED INCOMPLETE 2026-08-26 by
  its own gate: Phase 23 recorded `no-go`, rule `R1`). Phase 23 shipped;
  **Phases 24 and 26 are HELD** with their requirement text live for v0.8.0;
  **Phase 25 was TAKEN FORWARD** as the whole of v0.7.0

- 🚧 **v0.7.0 Own the Annotation Store** — Phases 27-32 (in progress, opened 2026-08-26)

*v0.7.0 continues phase numbering from Phase 26 — it starts at Phase **27**.
Phase numbers are continuous across milestones and are **never** reused,
including the cut Phases 20-22, the **held** Phases 24 and 26 (whose numbers stay
reserved against live requirement text v0.8.0 will carry forward unchanged), and
Phase 25 — whose *content* was taken forward into v0.7.0 while its *number* is
retired with v0.6.0.*

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

- **`installer/skills/` is gitignored yet shipped, so any gate implemented over
  tracked files is structurally blind to what users actually receive.** *(Added
  at the v0.7.0 open, 2026-08-26.)* Measured: `git ls-files installer/skills`
  returns **0**, and that same tree ships inside the `@henols/c64-re-tools`
  tarball — 11 `regenerator2000` mentions and 5 synced `ATTRIBUTION (ABS-02)`
  twins live there today, invisible to `git grep` and to every guard built on it
  (`skill-attribution.test.ts` scans `src/skills/` only, so a sync that drops the
  headers is invisible to it). Any gate whose subject is *what a user gets* must
  read the generated tree or the `npm pack` file list —
  `scripts/check-npm-packages.mjs` is the existing seam — never `git ls-files`.
  The failure runs in the worst direction: the tracked copy is correct, the gate
  is green, and the shipped copy is wrong.

- **A module's delete criterion is what it does, never its name prefix.**
  *(Added at the v0.7.0 open, 2026-08-26.)* `r2000-test-gate.ts` is the founding
  instance: two gates in one file, one of which is the **ACME** availability gate
  that `disasm-roundtrip.test.ts`, `skill-acme-build-cli.test.ts` and
  `ci.yml:45-140` bind to by env-var name. A prefix-driven deletion takes it and
  silently degrades the ACME claim from "hard fail if ACME is missing" to
  "skip" — in CI, over a green run. At least ten `r2000-*` modules are
  capabilities wearing glue-shaped names: `-test-gate`, `-acme-ident`,
  `-confidence`, `-symbols` (which *implements* the ✓ Validated
  `R2000-14`/`R2000-15` symbol round trip), `-verify`, `-memmap-render`, `-d64`,
  `-regbits-gen`, `-enum-gen`, `-coverage`. Classify by behaviour and record the
  classification **before** any deletion, which is the only time the record can
  be trusted; a module whose sole claim to deletion is its prefix is not deleted.

- **An `ATTRIBUTION (ABS-02)` block outlives the code it attributes.** *(Added at
  the v0.7.0 open, 2026-08-26.)* The absorbed prose stays adapted from
  regenerator2000 after every line of regenerator2000 *integration* is gone, so
  the attribution is not residue to be swept up with the code — it is a
  licence-and-provenance obligation that must survive the deletion
  byte-identical. Measured: **10 instances across two trees** (5 blocks in 3
  files under `src/skills/`, plus their 5 synced twins in the gitignored-but-
  shipped tree above), each carrying two naming lines. Any removal gate must
  exempt them **and** assert its own exemption is non-vacuous — deleting an
  attribution block must trip the gate — because the cheapest way to silence a
  false fire is to delete the header, and that is the one outcome that must not
  be possible.

- **A guard "repaired" by lowering its floor becomes permanently green, and its
  subject becomes undefended.** *(Added at the v0.7.0 open, 2026-08-26.)* When a
  guard's subject is deleted or renamed, the correct repair is to re-point the
  glob, **raise** the non-vacuity floor to the measured new count, replace the
  positive control with real new names, and **re-run the guard's own planted
  violation against the new subject.** Dropping the floor to 0 and deleting the
  positive control is a one-line change that converts a proven guard into one
  that can never fail, over a suite that still reads green.
  `hostpath-consumers.test.ts` (`R2000_MODULE_FLOOR`),
  `scripts/check-skill-tool-coverage.mjs` (zero mentions cross-checked against
  zero curated tools passes trivially) and `skill-attribution.test.ts` all have
  this shape. **If you cannot make it fail, you have not re-pointed it.**

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

### v0.6.0 Own the substrate — CLOSED INCOMPLETE (Phases 23-26)

**Goal:** Replace regenerator2000 as the analysis substrate with dxa + Ghidra and
an annotation store this project owns — proving the pivot's numbers hold on real
cracked code *before* anything is built on them.

**Scoped to the substrate only.** `DECOMP-01..04`, `BUILD-01..06` and
`EQUIV-01..04` stay held for v0.7.0 rather than rewritten now against a store
that does not exist yet. That is a scoping decision taken 2026-08-25, not a
second cut — their text stands unchanged in
[`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md).
*(Correction, 2026-08-26, recorded rather than rewritten: at the v0.7.0 open those
14 were re-mapped to **v0.9.0**, since v0.7.0 became the store-and-cutover
milestone alone. The sentence above stands as what was decided on 2026-08-25.)*

**Phase numbering starts at 23.** Phases 20, 21 and 22 were cut on 2026-08-25 by
the dxa+Ghidra pivot and are never reused.

**Closed incomplete 2026-08-26 by its own gate.** Phase 23 was written as a
pre-committed go / degrade / no-go gate with the authority to narrow or cancel
every phase after it, and it fired: **`no-go`, rule `R1`**, on the input
`C0_CORPUS: partial` — recorded in
[`docs/phase23-real-release-gate-findings.md`](../docs/phase23-real-release-gate-findings.md).
`R1` names its own consequence: *"secure a corpus first, or re-scope v0.6.0 to a
claim explicitly qualified as fixture-only."* One of the four phases shipped, and
the "re-measure against real cracked releases" half of even that phase's goal is
recorded NOT MET under three accepted overrides rather than reclassified.

**Phases 24 and 26 are HELD, not cut**, and the distinction is deliberate:
nothing about them was falsified, only their substrate is missing. The single
gate on reviving them is a **frame-exact emulator stop**, which nothing owns
(verification warning W4;
[`todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md`](todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md)).
Their numbers stay reserved and their requirement text stands unchanged for
v0.8.0 — which is why neither this roadmap nor `REQUIREMENTS.md` was archived at
this close, and why their detail blocks are left standing rather than deleted,
under `## v0.6.0 Own the substrate — CLOSED INCOMPLETE (Phase Details)` further
down. **Phase 25 was TAKEN FORWARD** and became the whole of v0.7.0: once the
Phase 24 engine coupling is dropped, its goal carries no corpus dependency and is
therefore reachable while the `no-go` stands.

- [x] **Phase 23: The Real-Release Gate (Go/Degrade/No-Go)** - The pivot's numbers re-measured against real cracked releases, with a recorded verdict able to narrow or cancel everything after it — **verdict recorded: `no-go`, rule `R1`** in `docs/phase23-real-release-gate-findings.md`
- [ ] **Phase 24: The Two Engines** - dxa separates code from data and Ghidra headless recovers semantics, with all 105 undocumented opcode bytes decodable and hardware writes surviving the decompiler — **HELD** 2026-08-26 for v0.8.0: blocked on a frame-exact emulator stop that nothing owns; requirement text unchanged
- [ ] **Phase 25: The Annotation Store and the Cutover** - This project owns the annotation state and its ACME export, and 19,181 lines of regenerator2000 glue are deleted rather than left standing beside their replacement — **TAKEN FORWARD to v0.7.0** 2026-08-26: its goal needs no corpus once the Phase 24 coupling is dropped, so it became Phases 27-32
- [ ] **Phase 26: Automatic Annotation** - Machine addresses annotate themselves, bank-aware, declining rather than guessing where the bank state is path-dependent — **HELD** 2026-08-26 for v0.8.0: same corpus gate as Phase 24; requirement text unchanged

### v0.7.0 Own the Annotation Store (Phases 27-32)

**Goal:** This project owns the annotation state it has been renting from
regenerator2000, and the analysis procedures already absorbed from it run on that
store instead — with regenerator2000 deleted outright, no parity owed to it, and
no procedural knowledge lost with it.

**Two owner decisions taken at the open, 2026-08-26.** Both narrow requirement
text inherited from v0.6.0's Phase 25, and both are recorded rather than left
implicit:

1. **No parity is owed to regenerator2000.** v0.6.0's deletion gate — *"nothing
   may delete r2000 before a replacement demonstrably produces the same facts"* —
   and its `STORE-04`'s *"the capability `R2000-11` shipped, carried across the
   substrate swap rather than lost in it"* are both **removed**. The store is
   built to what this project needs; the Phase 19 manifest's per-procedure tool
   list is the bar, and a procedure that runs is the test.

2. **The Phase 24 engine coupling is dropped with it** — Phase 25's *"populated
   from the engines' output"* dependency and its criterion 3's *"against a program
   analysed by the new engines"*. The store stands on the `disasm-*` decoders this
   project already owns.

**No corpus dependency — which is why this milestone is reachable at all.**
Phase 23's recorded `no-go` (rule `R1`) stands and is **not** overridden here. It
gates work that needs a depacked real-release capture; nothing in Phases 27-32
does. Every external oracle this milestone leans on is already installed and was
run live during research: a real ACME 0.97, `node:sqlite` at the declared Node
floor, and this repository's own tree at HEAD.

**Phase directories are deliberately NOT archived at this close either**, and the
reason has grown rather than weakened. Five committed tests read live paths under
`.planning/phases/`, two of them by hard-coded relative path to Phase 19's
`upstream-procedure-manifest.json` — which is a **design input** to this
milestone, not merely a guard's fixture. Phase 32 does not treat the deletion as
a route to relaxing that constraint.

**Three research disagreements were resolved in `REQUIREMENTS.md` rather than by
a planner.** `D1` persistence → **`node:sqlite`**, chosen on planted-violation
reddenability rather than throughput (dropping a `COMMIT` reliably reddens;
removing an `fsync` frequently still passes because the page cache serves the
read). `D2` undo → **whole-store snapshot/restore**, not a per-edit inverse
journal: zero callers measured, and Node's `sqlite` does not expose
`sqlite3changeset_invert`. `D3` → **no** `capability-registry.ts` entry, because
that registry holds only the per-backend delta a proxy-local family does not
have.

- [x] **Phase 27: Shared Seams Extracted** - The modules a prefix-driven deletion would silently take with it stand under their own names, with every surviving consumer proven still served (completed 2026-08-27)
- [x] **Phase 28: The Store Core** - Labels, comments, per-range typing over the full 12-member vocabulary, scopes and project enums — durable across a `SIGKILL`, revertible, behind one persistence seam (completed 2026-08-29)
- [x] **Phase 29: The MCP Surface** - The store is reachable through a family derived from Phase 19's manifest, registered proxy-locally — and the family it replaces is deleted in the same phase, with every guard moved by the change that broke it and the removal gate observed biting first (**widened by `D-01`**) (completed 2026-08-30)
- [x] **Phase 30: ACME Export and the Real-ACME Oracle** - Exported source is correct because a real ACME assembles it and the bytes match, through a verify path built for this purpose and standing before the deletion window opens (completed 2026-08-31)
- [ ] **Phase 31: Procedure Re-pointing** - The `ABS-02` attribution chain is byte-identical across both trees and Phase 19's manifest is re-synced in the commit that changes what it describes (**narrowed by `D-01`**: the re-pointing itself landed in Phase 29)
- [ ] **Phase 32: The Deletion and the Grep Gate** - Every guard re-pointed off the deleted subject is proven non-vacuous as a set on a settled tree, and no living document is left pointing a user at a route that no longer exists (**narrowed by `D-01`**: the deletion and the grep gate landed in Phase 29)

## v0.7.0 Own the Annotation Store (Phase Details)

### Phase 27: Shared Seams Extracted

**Goal**: Every module a prefix-driven deletion would silently take with it
stands under a name that does not say `r2000`, its surviving consumers are proven
still served, and the classification that decides what may be deleted at all is
on the record — before a line of store code exists.
**Depends on**: Nothing (first phase of v0.7.0; pure moves, no behaviour change, no corpus dependency)
**Requirements**: SEAM-01, SEAM-02, SEAM-03
**Success Criteria** (what must be TRUE):

  1. A run with `VICE_REQUIRE_ACME=1` and `ACME_BIN` pointed at a nonexistent path makes the suite **FAIL** — observed, not reasoned about — from the extracted gate under its new non-`r2000` name. `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` keep byte-identical names because `ci.yml:45-140` binds them by name, and `ci.yml` is repointed in the same commit. If the run **skips**, the gate is gone: that is the whole failure mode, and it is silent in CI over a green run.
  2. Every `r2000-*` module carries a recorded **capability-or-glue** classification derived from what it does, and no classification cites a name prefix — so the ten named capability modules (`-test-gate`, `-acme-ident`, `-confidence`, `-symbols`, `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen`, `-coverage`) are provably not deletable by prefix. The record exists **before** anything is deleted, which is the only point at which it can be trusted.
  3. `r2000-coverage.ts`'s contact with the annotation store is a **named, repointable boundary** rather than two functions comparing against upstream's Rust `Display` strings, and `COV-01`/`COV-02`'s census-versus-store boundary test — the one that rewrites every block entry to a single type and asserts no census byte count moves — passes across that boundary. The coverage instrument survives the substrate swap intact instead of being deleted as glue.
  4. Full `npm test` (the whole glob, broker stopped, command named in the evidence) is green with **zero** `r2000` modules deleted — the extraction is demonstrably a move rather than a change, which is what makes every later phase's diff readable.

**Plans**: 5/5 plans executed in 3 waves

Plans:
**Wave 1**

- [x] 27-01-PLAN.md — Extract the ACME availability gate into `acme-gate.ts`, repoint its four importers, and prove the missing-ACME hard-FAIL by a committed child-process observation (SEAM-01)
- [x] 27-02-PLAN.md — Reduce the coverage census's store contact to one named boundary, `block-class.ts`, and prove it substitutable with a zero-overlap second vocabulary (SEAM-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-03-PLAN.md — Move `parsePrg`, `flatImageOrigin` and `decodeRawData` into a shipped `prg-image.ts` and repoint all nine consumers (SEAM-02, SEAM-03)
- [x] 27-04-PLAN.md — Extract the four hand-copied `shippedTsModules()` enumerators and `codeOnly()` into `shipped-modules.ts`, and rewrite both recorded statements of the sharing convention (SEAM-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 27-05-PLAN.md — Record the capability-or-glue classification in `module-classification.ts` with its enforcing guard, then produce criterion 4's full-glob green-run evidence (SEAM-02)

Waves: 1 = 27-01, 27-02 (disjoint file sets) · 2 = 27-03, 27-04 · 3 = 27-05
(its entries must cite the post-extraction tree, so it runs last).

Notes:

- **Ordering constraint 1**, verbatim from research: the gate split must precede the deletion, in the same commit or earlier. A rename of `ACME_BIN` / `VICE_REQUIRE_ACME` is a second, silent failure mode stacked on the first.
- Keep the extracted ACME gate **out of** `package.json`'s `files[]` — it verifies test-harness behaviour, not shipped runtime behaviour, exactly as the module it comes out of does.
- Also extractable here and named by research: `prg-image.ts` (`parsePrg`, `flatImageOrigin`), and the `codeOnly()` / `shippedTsModules()` helpers `stock-dispatch.test.ts:2889,2919` borrows from `r2000-spawn-seam.test.ts`.
- Research flagged this phase as needing **no** deeper research: every consumer is already enumerated by file and symbol.
- This is the cheapest phase in the milestone and it is not optional. Without it, deleting by prefix takes the ACME hard-fail gate, the symbol round trip that implements two ✓ Validated requirements, and the coverage census — three capabilities, none of which announces its loss.

### Phase 28: The Store Core

**Goal**: This project owns the annotation state — labels, comments, per-range
typing over the full 12-member vocabulary, scopes and project enums — durable
across a `SIGKILL`, revertible, and reachable through exactly one persistence
seam. The milestone's one irreversible decision lands here.
**Depends on**: Phase 27 (the extracted seams and the capability-or-glue classification)
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-07
**Success Criteria** (what must be TRUE):

  1. A caller can type any range in the **full 12-member vocabulary** read off `r2000_set_data_type`'s own schema, with the four split layouts as first-class members rather than one `table` type carrying an orientation flag. Proven by the control that can actually go red: a fixture with a known `lo_hi_address` table, typed as `hi_lo_address`, produces a **differing resolved-target set**, and collapsing the four members to one `table` makes that control fail. A "it reassembles clean" assertion **cannot** go red here — a mis-oriented split table reassembles byte-identically, because the bytes never changed — and is therefore not the control.
  2. A narrowest-range-wins lookup is exact at every one of the **65,536** addresses, cross-validated against a second, independently written implementation with **zero disagreements**, with the tie-break, both range ends and the `$FFFF` boundary each pinned. A `$0400-$0400` range reports length **1**. Ranges are stored as ranges and are never merged on adjacency, so no splitter primitive exists to introduce — `DECOMP-01`'s and `BUILD-02`'s named blocker, and `COV-01`'s predicted over-merge bias, are designed out by construction.
  3. A partial overwrite **splits and preserves**: total typed bytes are unchanged across all five overlap cases, and planting `filter()`-and-insert in place of the split makes the fully-contained case fail. A retype that contradicts an existing comment returns the contradicted comments **as data** — remove that check and the call returns clean success, which is the red. Silently un-documenting a previously annotated region is the exact failure the store exists to prevent.
  4. **Durability and revert are proven by ONE combined planted-violation test, not two.** mutate → `SIGKILL` with no clean close → **fresh process** → reopen → the mutation reads back **by value** → revert returns the prior value; and removing the commit makes that same test go **red**, observed. Two separate tests both stay green over a store that cannot revert across a restart, which is exactly why there is one. A store file truncated between kill and reopen is **refused**, never returned partial.
  5. Every write carries a schema version and a **reserved, uninterpreted** `bank` field, cross-reference rows carry their access kind (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), and a write whose base revision is not the current on-disk revision is **refused** rather than silently discarding another process's annotations — observed by mutating from a second OS process and reading back. `node:sqlite` is reachable from exactly one module, asserted structurally over the shipped module set.

**Plans**: 23/23 plans executed in 21 waves. The SIXTH gap-closure round is EXECUTED — 28-23 in wave 21, scoped by design to ONE plan and to CR-10 alone: the split layout's pairing rule gets one definition and a writer-side consumer, a partial overwrite that re-interprets a split table is accepted WITH A REPORT carrying both entry-pair sets, and the tests that pinned the corrupting outcome as correct are rewritten. Previously — the fifth gap-closure round is EXECUTED IN FULL: 28-19 (the tracer), 28-20 (WR-18 + WR-22 + WR-24), 28-21 (WR-21 + WR-25 — addScope idempotence plus the overlap refusal, and confinement as openStore's default behind a greppable escape pinned to four module-derived opens; 209/209 at real exit 0, was 198) and 28-22 (WR-19 — the commit-statement matcher now finds the STATEMENT inside an `exec()` literal, closing the trailing-semicolon and multi-statement evasions; plus the round's record and its closing gate: 210/210 at real exit 0, all twelve round-5 ids dispositioned in `28-REVIEW.md`'s own table, STORE-04 moved to `Complete` on the verifier's quoted sentence, both `behavior_unverified` items carried forward as OPEN, NINE plantings re-observed red and restored, and both the CR-09 and CR-08 reproductions re-driven through production entry points). ROUND 5 IS EXECUTED, NOT VERIFIED — the code-review gate, the regression gate and the phase verifier have not run; 15/15 of waves 1–13 executed (6/6 in waves 1–4, plus 28-07 in wave 5, 28-08 in wave 6, 28-09 in wave 7, and the second gap-closure round’s 28-10..28-12 in waves 8–10). Originally 18/18 plans executed in 16 waves; 15/15 of waves 1–13 executed (6/6 in waves 1–4, plus 28-07 in wave 5, 28-08 in wave 6, 28-09 in wave 7, and the second gap-closure round's 28-10..28-12 in waves 8–10). A THIRD gap-closure round adds 28-13..28-15 in waves 11–13 after round-3 verification scored 10/12 with two gaps remaining: all five success criteria are VERIFIED for a third round, but the goal's REVERTIBLE clause is still false (CR-05 — the ring keyed on the store path's basename spelling, so a second spelling deletes every pointer row) and an accepted write can leave its handle permanently wedged (CR-06/CR-07/WR-12). 28-13 (the identity decision plus the sweep's transaction lifetime) is EXECUTED — CR-05 and CR-07 closed behaviourally through production entry points; 28-14 (the commit and revert paths brought inside the error family) is EXECUTED — CR-06 and CR-07's third property closed, the CR-06 closure proven cross-process against a genuinely separate reader with a negative control reproducing the review's bare `Error: database is locked`; 28-15 (the confinement predicate's regression plus the closing gate) is EXECUTED — WR-12 closed (every non-ENOENT stat failure in the ancestor walk is now an `AnnoStorePathError` naming the path, at both entry points, pinned by three new confinement cases), and the closing gate recorded as numbers: 144/144 anno tests at real exit 0, `tsc --noEmit` clean, the four named non-vacuity controls re-observed individually, and criterion 4's planted red re-observed on the final tree and reverted. ROUND 3 IS VERIFIED at **11/12** (was 10/12): CR-05, CR-06, CR-07 and WR-12 are all GENUINELY CLOSED, re-driven through production entry points, and round 3's gap 2 is closed outright. The verdict is still `gaps_found` on ONE NEW blocker, **CR-08** — `revertTo` renames an unverified snapshot image over the live store after closing the caller's handle, gating only on `existsSync`, so a snapshot that exists but is not a database destroys the store irrecoverably (reproduced: 69632 -> 0 bytes, no handle returned). That makes the goal's REVERTIBLE clause false for a FOURTH distinct cause, and it is not deferrable — Phase 29 puts this handle on the MCP surface for a session's lifetime. A FOURTH gap-closure round is EXECUTING as 28-16..28-18 in waves 14–16, scoped strictly to the REVERTIBLE clause and the six round-4 finding ids: 28-16 (CR-08 + WR-17) is EXECUTED — the CR-08 CLASS is closed by ordering, so nothing is closed and nothing is renamed until the replacement image has been OPENED as an annotation store (`openStore` gained a judging `mustExist`/`readOnly` open, `revertTo` gained a step 3b over the STAGED copy, and the round-4 reproduction now leaves the live store byte-identical at 69632 bytes with the caller's handle still answering instead of taking it to 0 bytes with no handle); `retained` is PROMOTED to the openable definition, so `retainedRevisions()` reports `[0, 2]` where it reported `[0, 1, 2]` and the published floor and the gate read one witness (`snapshotOpenFailure`); the ring's file sweep is re-pointed at the pointer-ROW question (`claimedRevisions`), so a corrupt-but-claimed image survives on disk as EVIDENCE and the 32-image cost never runs under the sweep's write lock; and WR-17 is closed alongside it because it lives in the same function — both of `revertTo` step 6's reopens are inside handlers reporting a revert that LANDED ON DISK. Recorded as numbers: 165/165 anno tests (was 159), `tsc --noEmit` clean, and the step 3b planted red observed on both the task-1 tree and the final tree and reverted to an empty diff. The store-identity admission stays an OPEN residual (a `SCHEMA_VERSION` bump, this milestone's one-way decision); 28-17 (WR-13 + WR-16 + WR-14) is EXECUTED — the publish path is now as durable as the row that claims it (`stageSnapshot` fsyncs the staged image, unguarded, because that is the call removing the DESTRUCTIVE half-state; `publishSnapshot` fsyncs the ring directory best effort, because that call removes only the orphan-ROW direction already inert since 28-13 — an asymmetry recorded as a plan-letter deviation and measured: a directory fsync needs the same read bit `readdirSync` needs, so an unguarded one refuses every write against a writable-but-unreadable ring), three handlers now report the rollback they OBSERVED (a recorded `rolledBack` branching both refusal messages and riding in `data`, plus `rollbackFailed` widening the sweep's result rather than making the one path forbidden to throw throw), and both root-sensitive controls skip where the runner can count them (`# skipped 2` with reasons under a forged uid 0, where the pre-task file reported `# skipped 0` with both as `ok`). Recorded as numbers: 167/167 anno tests (derived 165 + 2), `anno-store.test.ts` 73/73, `tsc --noEmit` clean at every commit, and the fsync planted red observed and reverted. The host-crash durability claim's only in-process evidence is the SOURCE ORDER, so it is filed as a `backstop` truth needing human judgment rather than claimed proven; 28-18 (WR-15 + the round's record + the closing gate) is EXECUTED — the single-commit-site control now matches commit STATEMENTS via an `exec()` call carrying a bare statement literal in any of SQLite's three spellings, closing a defect observed rather than argued (a second FULLY WORKING commit site spelled `db.exec("end")` passed the old word-count control at `ok 15` / 17-of-17), and its mirror cost went with it (`anno-store.ts` no longer couples an error message's wording to a control in another file). All six round-4 finding ids carry a recorded `fix` in `28-REVIEW.md`'s round-4 disposition table, each naming its plan and quoting a number or line reference from that plan's SUMMARY, with `anno-store.ts:432`'s `integrity_check` throw arm carried forward as an explicit STILL-OPEN row. Both record corrections are made, transcribed from the round-4 verifier with its own sentence quoted: STORE-05 back to `Complete`, STORE-04 still `Gaps Found` with its recorded reason corrected from the pending `integrity_check` human item to CR-08. The closing gate is recorded as numbers on the final tree: 169/169 anno tests at `# fail 0 / # skipped 0` and a REAL exit code of 0 (derived as 28-17's recorded 167 + 2), `tsc --noEmit` clean, 28-15's four named non-vacuity controls re-run individually and quoted, this round's three plantings plus criterion 4's planted red each re-observed red and reverted to an empty diff, and the CR-08 reproduction RE-DRIVEN through production entry points as **69632 -> 69632** (round 4 recorded 69632 -> 0) with the caller's handle still answering and a later `openStore` succeeding. **ROUND 4 IS EXECUTED IN FULL AND AWAITS VERIFICATION** — the code-review gate, the regression gate and the phase verifier have not run, so nothing here is a verification result; STORE-04 stays `Gaps Found` with CR-08 as its recorded blocker until a verification pass says otherwise. ROUND 4 IS NOW VERIFIED at **11/12**, and its scoped claim held: truth 12 — the goal’s REVERTIBLE clause — is VERIFIED for the FIRST TIME IN FIVE ROUNDS, re-driven through production entry points over THREE input classes rather than the one round 4 reported (0 bytes, 46 foreign bytes, half-truncated): `retained [0, 2]`, an in-family refusal naming both paths, the live store **69632 -> 69632** byte-identical where round 4 measured 69632 -> 0, the same handle still answering, a later `openStore` succeeding, and the refusal NOT bought by broadening because every revision the advertised list carries still reverts. WR-13, WR-14, WR-16 and WR-17 are genuinely fixed and WR-15 is fixed with a residual hole in its replacement. The verdict is still `gaps_found` on ONE NEW blocker, **CR-09** — `retype()`’s split-and-preserve re-inserts a surviving remainder carrying `row.data_type` forward with NO shape check, so `setDataType($1000..$100f, lo_hi_address)` followed by `setDataType($1004..$1004, byte)` leaves `id=3 $1005..$100f lo_hi_address` at span **11**, a shape `setDataType` refuses at its own entry point and `resolveSplitTargets()` cannot decode, written with `changed: true`, an empty `contradictedComments` and no diagnostic of any kind. The attribution matters and the verifier corrected it: CR-09 does NOT falsify criterion 1 (the vocabulary is 12 members, the four split layouts are first-class, and the differing-resolved-target-set control and its collapse planting are green) and does NOT falsify criterion 3’s three NAMED controls (total typed bytes 16 -> 4+11+1, the filter-and-insert planting, contradicted comments as data) — what is FALSE is criterion 3’s own stated PURPOSE, and with it STORE-01 and STORE-03. It survived five rounds because `anno-overlap.test.ts`, the suite that exists to prove criterion 3, contains ZERO split-table overlap cases, while `anno-types.test.ts` exercises all four split members and never overlaps them: criterion 1’s vocabulary and criterion 3’s split-and-preserve had never met. It is not deferrable — Phase 29 puts `set_data_type` and `list_ranges` on an agent-driven path where arguments arrive unvalidated, and Phase 30 reads these rows to emit ACME source. A FIFTH gap-closure round is PLANNED as 28-19..28-22 in waves 17–20, tracer-first and strictly scoped to the verifier’s own routing — CR-09 plus IN-06 and WR-08 (the same function), the five WARNINGs routed `→ gap-closure round` (WR-18, WR-19, WR-21, WR-22, WR-24), WR-25 DECIDED as a fix rather than accepted, and WR-20/WR-23/IN-07/IN-08 accept-only with no code written for them. Three record deliverables ride with it: all twelve round-5 ids transcribed into `28-REVIEW.md`’s own disposition table so they survive the next overwrite of the verification report; STORE-04 moved to `Complete` on the verifier’s own authorising sentence, with STORE-01 and STORE-03 confirmed already at `Gaps Found` (two of the three requested moves were already satisfied by commit `737f9e7`, so only one row actually changes); and BOTH `behavior_unverified` items carried forward as OPEN, closed by nothing. Measured at plan time and stated because the verification report is wrong about it in the same way round 4 was: `docs-review-disposition.test.ts` is **7/7** and `audit-integrity.test.ts` **44/44** on the real tree, GREEN — the guard treats a phase’s own `*-VERIFICATION.md` as a disposition source, so writing the round-5 report is what dispositioned the twelve ids there, and no plan in this round may be premised on a red guard

Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Tracer: the twelve-member vocabulary frozen at a decision checkpoint, then one range typed end-to-end through the single `node:sqlite` seam and read back by value, with the structural single-seam assertion green

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-02-PLAN.md — The pure narrowest-wins index, cross-validated against an independently written oracle at all 65,536 addresses, with the `$FFFF`, both-ends-inclusive, length-1 and equal-length tie-break pins
- [x] 28-04-PLAN.md — Validation and the rest of the vocabulary: labels, comments, scopes, project enums and cross-references, with criterion 1's split-orientation control and its collapse planting

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-03-PLAN.md — The census boundary re-pointed: `block-class.ts` accepts the store's lowercase vocabulary alongside the analyser's capitalised one, pinned by a derived total cross-check, plus the label-kind agreement that makes the silent zero loud
- [x] 28-05-PLAN.md — Split-and-preserve across all five overlap cases with the fully-contained case load-bearing, and the contradicted-comment rule returning comments as data

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 28-06-PLAN.md — The ONE combined durability-and-revert test with the removed `COMMIT` observed reddening both halves, the four corrupt-file refusals, the cross-process stale-revision refusal, and the bounded snapshot ring

**Wave 5** *(gap closure — `28-VERIFICATION.md` scored 8/11 must-haves; all five success criteria VERIFIED)*

- [x] 28-07-PLAN.md — Gap 1 + gap 2: one ownership predicate for the snapshot ring, one half-state resolver, a second revert that refuses by name instead of crashing out of the error family, and a prune whose statement order matches its own argument

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 28-08-PLAN.md — CR-02: one owner per published snapshot — stage under a unique unpublished name and publish only after winning the compare-and-swap — plus the WR-04 and WR-11 error-family escapes folded in

**Wave 7** *(blocked on Wave 6 completion — an ordering-only edge, not a code dependency: this plan shares no `files_modified` with either peer, but its acceptance checks READ `anno-store.test.ts` and `anno-seam.test.ts`, which waves 5 and 6 rewrite)*

- [x] 28-09-PLAN.md — Gap 3: workspace confinement compares real paths on both sides, so a symlinked subdirectory is refused rather than followed — with an inside-pointing symlink still followed, so the control discriminates

**Wave 8** *(second gap-closure round — re-verification scored 9/11; all five success criteria still VERIFIED, but the goal's "revertible" clause is false: `revertTo` was reproduced returning a neighbouring store's rows, and the ring reproduced being destroyed by an `mv` and by write contention)*

- [x] 28-10-PLAN.md — Gap 1, CR-01 + CR-03: a snapshot's identity — the ring keyed on the store FILE, the location derived from the handle, `anno_snapshot.path` dropped and `SCHEMA_VERSION` bumped so the previous on-disk shape refuses by name

**Wave 9** *(blocked on Wave 8 completion — it sweeps the directory wave 8 renames)*

- [x] 28-11-PLAN.md — Gap 1, CR-02: who may judge an unclaimed snapshot — the sweep decides under the store's write lock, commits its row deletes before it unlinks, and declines rather than guessing; WR-01, WR-02 and WR-04 folded in because they live in the same rewritten code

**Wave 10** *(blocked on Wave 9 completion — an ordering-only edge, not a code dependency: this plan shares no `files_modified` with either peer, but its acceptance surface runs `anno-confinement.test.ts`, which imports `anno-store.ts` — the module waves 8 and 9 rewrite)*

- [x] 28-12-PLAN.md — Gap 2, CR-04: the confinement walk stops at a path ENTRY rather than at a path that resolves, so a dangling symlink cannot place the store outside the workspace root — with the inside-pointing dangling link still followed, so the control discriminates

**Wave 11** *(third gap-closure round — round-3 verification scored 10/12; all five success criteria VERIFIED for a third round, but the REVERTIBLE clause is false for a third cause and the write path can wedge its own handle)*

- [x] 28-13-PLAN.md — Gap 1, CR-05 + CR-07: what identifies a snapshot ring, decided on the record — the sweep abstains from the pointer-ROW direction entirely, because a row without a file is inert to every consumer and deleting one under a second path spelling destroyed a reachable revert history; plus a structural transaction lifetime for the sweep and the two corrected comments that asserted a guarantee the code did not provide

**Wave 12** *(blocked on Wave 11 completion — it rewrites the same file, and three rounds of evidence say concurrent edits to `anno-store.ts` are how the next blocker arrives)*

- [x] 28-14-PLAN.md — Gap 2, CR-06 + CR-07's revert arm: step 8's commit brought inside the ViceError family so a concurrent READER can no longer wedge the handle with the write lock held, and a `revertTo` whose housekeeping fails still hands back a usable handle — proven by a cross-process test with a child holding a real read transaction

**Wave 13** *(blocked on Wave 12 completion — an ordering-only edge, not a code dependency: this plan shares no `files_modified` with either peer, but its acceptance surface runs `anno-confinement.test.ts`, which imports `anno-store.ts`, and it carries the round's closing regression gate)*

- [x] 28-15-PLAN.md — Gap 2, WR-12: every stat failure other than ENOENT in the confinement walk becomes `AnnoStorePathError` naming the path, pinned by the three ancestor cases twelve existing cases never planted — plus the closing gate that re-establishes the reverted requirements by regression and re-observes criterion 4's planted red on the final tree

**Wave 14** *(fourth gap-closure round — round-4 verification scored 11/12; truths 1–11 are VERIFIED and re-driven through production entry points, and the ONE blocker is CR-08: `revertTo` renames a snapshot image it never opened over the live store after closing the caller's handle, gating only on `existsSync`, reproduced as 69632 -> 0 bytes with no handle returned and no route back)*

- [x] 28-16-PLAN.md — CR-08 + WR-17, closed as a CLASS by ordering: nothing is closed and nothing is renamed until the replacement image has been OPENED as an annotation store, `retained` promoted to the openable definition so the published floor and the gate read one witness, the ring's file sweep re-pointed at the pointer-ROW question so a corrupt-but-claimed image stays on disk as evidence, and both of `revertTo` step 6's reopens brought inside the guarantee

**Wave 15** *(blocked on Wave 14 completion — it rewrites the same file, and four rounds of evidence say concurrent edits to `anno-store.ts` are how the next blocker arrives)*

- [x] 28-17-PLAN.md — WR-13 + WR-16 + WR-14: the staged snapshot and its ring directory fsynced through the module's existing helper so a durable pointer row can no longer name a non-durable image (which is what MANUFACTURES CR-08's input from an ordinary crash), three handlers that report the rollback that happened rather than the one intended, and two root-sensitive controls converted to node:test's real skip so a precondition that cannot be built is counted rather than reported as a pass

**Wave 16** *(blocked on Wave 15 completion — an ordering-only edge plus the round's closing gate: its acceptance surface runs the whole anno suite over the code waves 14 and 15 rewrite, and task 1 removes a constraint wave 15's message had to be written around)*

- [x] 28-18-PLAN.md — WR-15 plus the round's record and closing gate: the single-commit-site control counts `exec()` STATEMENTS across SQLite's `commit`/`end`/`end transaction` spellings instead of a bare word (so a synonym can no longer split the durability planting) and stops constraining user-facing error prose; all six round-4 finding ids get a recorded decision with cited evidence; STORE-05 returns to `Complete` and STORE-04's recorded reason is corrected to CR-08, both transcribing the verifier's own verdict; and the gate re-observes the round as numbers — the suite count at a real exit code, each named non-vacuity control individually, four plantings red and restored, and the CR-08 reproduction re-driven from a destruction into a refusal

**Wave 17** *(fifth gap-closure round — round-5 verification scored 11/12; truth 12, the goal's REVERTIBLE clause, is VERIFIED for the first time in five rounds and CR-08 is closed as a CLASS, and the ONE blocker is CR-09: `retype()`'s split-and-preserve re-inserts a surviving remainder carrying the overlapped row's type forward with NO shape check, so two ordinary `setDataType` calls leave an 11-byte `lo_hi_address` row — a shape the store refuses at its own entry point and `resolveSplitTargets()` cannot decode — reported as `changed: true` with an empty `contradictedComments` and no diagnostic. It falsifies criterion 3's stated PURPOSE, not criterion 1, and it blocks STORE-01 and STORE-03)*

- [x] 28-19-PLAN.md — TRACER: CR-09 + IN-06 + WR-08, the one end-to-end slice from `setDataType` through `retype` to disk and back through `assertRangeShape`/`resolveSplitTargets`. The remainder rule is enforced inside `retype()` in the same transaction and BEFORE the first delete, so a refusal costs nothing; the outcome is a named `AnnoSplitRemainderError` carrying both conflicting spans and the legal alternatives; the reserved `bank` value survives a split; `anno-overlap.test.ts` gains the five overlap geometries against a `lo_hi_address` row (the suite proving criterion 3 had ZERO split-table cases) plus the round-trip invariant that catches the CLASS — every row `listRanges()` returns must be re-acceptable at the store's own entry point — with its planting observed red against the shipped function

**Wave 18** *(blocked on Wave 17 completion — it rewrites the same file, and five rounds of evidence say concurrent edits to `anno-store.ts` are how the next blocker arrives)*

- [x] 28-20-PLAN.md — WR-18 + WR-22 + WR-24, the three verifier-routed WARNINGs in and around `revertTo`: `rollbackFailed` gets a PRODUCTION reader at both call sites (`pruneSnapshots` returns the fact, the write sequence records it on the handle so the NEXT call refuses by name rather than with SQLite's bare nested-transaction error, and step 6 closes-and-reopens instead of handing back a connection it cannot vouch for) without converting a committed write into a caller-visible failure; the `revision` argument is validated at the entry so an argument error stops wearing CR-08's corruption message; and the staging path becomes unique per ATTEMPT with all three cleanups routed through `discardSnapshot`

**Wave 19** *(blocked on Wave 18 completion — same file, same argument as waves 12, 15 and 18)*

- [x] 28-21-PLAN.md — WR-21 + WR-25, the two findings where the tree carries a claim it does not honour: `addScope` gains an idempotence check (a byte-identical repeat SUCCEEDS reporting `changed: false`, which is Phase 29's criterion 5 landed here) and a nesting rule that refuses an overlapping scope by name with both scopes in the message, so `ScopeRow`'s and `addScope`'s NO-NESTING doc comments become true and the contradicting ADDITIVE paragraph is deleted in the same commit; and workspace confinement becomes `openStore`'s DEFAULT with the unconfined path an explicit, greppable escape pinned by `anno-seam.test.ts` to the module's four derived-path opens

**Wave 20** *(blocked on Wave 19 completion — an ordering-only edge plus the round's closing gate: its acceptance surface runs the whole anno suite over the code waves 17–19 rewrite, and its record work is `.planning/` content, so worktree isolation is forbidden for it)*

- [x] 28-22-PLAN.md — WR-19 plus the round's record and closing gate: the single-commit-site control matches the commit STATEMENT inside an `exec()` literal, closing the trailing-semicolon and multi-statement evasions the round-5 verifier confirmed by running the regex, without re-coupling any user-facing message's wording to a control in another file; all TWELVE round-5 ids get a recorded decision in `28-REVIEW.md`'s own table so it survives the next overwrite of the verification report; STORE-04 moves to `Complete` on the verifier's own authorising sentence while STORE-01 and STORE-03 are confirmed already at `Gaps Found`; both `behavior_unverified` items are carried forward as OPEN; and the gate re-observes the round as numbers — the suite count at a real exit code, eight named controls individually, nine plantings red and restored (this round's eight — including 28-20's three, one per structural control it adds, and 28-21's three — plus criterion 4's carried one), and BOTH reproductions (CR-09's six-line drive and CR-08's byte-length pair) re-driven through production entry points

**Wave 21** *(SIXTH gap-closure round — round-6 verification scored 11/12 on a denominator kept at twelve, and the ONE failing truth is ROADMAP criterion 3's own stated purpose, not plan-derived scope. CR-10: `retype()`'s new remainder gate checks byte-count PARITY and nothing else, but a split table pairs byte `i` with byte `n + i`, so trimming either end re-pairs EVERY entry — five accepted geometries each preserve **0 of 8** recorded targets with `changed: true`, an empty `contradictedComments` and no diagnostic, and `anno-overlap.test.ts:592` pins the corrupted set BY VALUE as correct. Not deferrable: Phase 30's byte-diff oracle is structurally blind to it because CR-10 changes no bytes, and Phase 29 puts `set_data_type` on an unvalidated agent path. Scoped to ONE plan by design — the phase's measured failure mode is a denominator that grows out of each round's own frontmatter)*

- [x] 28-23-PLAN.md — CR-10: the split layout's PAIRING rule gets one definition and, for the first time, a writer-side consumer, and a partial overwrite that re-interprets a split table is ACCEPTED WITH A REPORT instead of accepted silently. Answer (b) of the verifier's two — the re-interpretation comes back as data on the successful result beside `contradictedComments`, carrying the overlapped row's entry-address pairs BEFORE, every surviving remainder's pairs AFTER, and the pairs preserved (computed by comparison, never assumed) — chosen because criterion 3's operative failure word is *silently*, because refusing outright would make split tables editable only wholesale, and because recording the original extent on disk would be a `SCHEMA_VERSION` bump. All three forbidden moves are avoided and recorded: no boundary rounded outward, no remainder demoted to `undefined`, and CR-09's parity check untouched and still first. The tests that CERTIFY the defect are rewritten — the case naming the fragmentation legal, the `SEQUENCE` expectations and the non-vacuity floors — and the assertion no existing control could make is added: `resolveSplitTargets` before and after across all five accepted geometries, plus a class-level invariant that no split entry pair vanishes outside the caller's own range without being reported. STORE-01 moves to `Complete` on the round-6 verifier's quoted authorising sentence; STORE-03 stays `Gaps Found` with its reason corrected from CR-09 to CR-10

Notes:

- **The type vocabulary is decided here and never revisited** (ordering constraint 6). Split-table orientation is unrecoverable from stored data because it was never recorded, so the recovery cost is a hand re-annotation, not a migration. `DECOMP-01` (v0.9.0) is precisely what the 12 members are sized for, and shipping seven would re-create inside this project the `da65` expressiveness boundary that got `cc65` rejected one milestone ago.
- Research flags this as the **one phase that may want a spike** — not for the domain but for the decision: measure the chosen persistence route's planted-violation reddenability on this repo's real workload. `D1` and `D2` are already resolved in `REQUIREMENTS.md`; what stays open is FTS5 versus `LIKE 'prefix%'` for the search surface (both compiled in, both free) and whether all four split variants are needed.
  *All three resolved at plan time, 2026-08-27, and recorded in `28-01-PLAN.md` §`<research_corrections_applied>`: **no spike** — its stated measurement was executed in `28-RESEARCH.md`, where the exact criterion-4 sequence ran and removing the `COMMIT` was observed to redden both halves of one test; **`LIKE`, and no FTS5 table is created in this phase** — measured 2.02 ms indexed prefix `LIKE` against 2.99 ms FTS5 `MATCH` with a 121.8 ms rebuild, and adding FTS5 later is additive while removing it is a migration; **all four split variants are kept** — both axes were verified separately observable (orientation as a differing resolved-target set, address-versus-word as whether cross-references are produced).*

- **The proxy validates nothing** — `vice-proxy.ts:3216-3230`'s `rawJsonSchemaAsStandardSchema()` returns `validate: (value) => ({ value })` by design, and its header says so — so every argument arrives unvalidated and validation belongs here, throwing named `ViceError` subclasses. **Not `zod`** (present only as an undeclared transitive of `@mastra`).
- Name the field `endInclusive`, never a bare `end`: six conversion boundaries, five of which produce plausible output when wrong. Accept `integer` **and** `$`/`0x`-prefixed strings, and **reject an unprefixed numeric string outright** rather than guessing a base — this codebase already contains two opposite defaults, since VICE's monitor reads bare literals as hex.
- **Reject label collisions, never sanitise.** `init screen` → `init_screen` silently collapses two labels into one, and `LDA`/`INC`/`ROL` are legal identifiers but illegal labels. Auto-generated names live in a separate namespace from user names — `export-lbl` exports user names only, so a test asserting an `a_`-prefixed name appears in an export is testing the wrong thing.
- The store file never leaves the container: it must **not** import `hostpath.ts`, which `hostpath-consumers.test.ts`'s five-element `deepEqual` plus length assertion already enforces against static, multi-line and `await import()` forms.
- `node:sqlite` emits an unconditional `ExperimentalWarning` on the Node 22 line, so **no test may assert stderr is empty**; WAL leaves `-wal`/`-shm` sidecars after an unclean exit, so the store is not single-file at rest. Both are costs of the chosen route, stated rather than discovered.
- The interval index is owned code by measurement, not preference: every surveyed interval-tree package returns *all* overlaps with no narrowest-wins tie-break, so the deciding logic is this project's regardless. Rebuild on mutation; write no incremental-maintenance code.

### Phase 29: The MCP Surface

**Goal**: The store is reachable through a tool family **derived from** Phase
19's `upstream-procedure-manifest.json`, registered proxy-locally and shaped for
an agent rather than a cursor — and the family it replaces is **deleted in this
same phase**, safely, because every guard that breaks on registration, on the
rename and on the deletion moved with the change that broke it, and the removal
gate was built and observed biting first.
**Widened by `D-01`** from "registered beside the family it will replace, with
nothing yet deleted": the owner chose deletion over unregister-and-quarantine, so
the coexistence this phase was originally scoped around never happened. See
criterion 2.
**Depends on**: Phase 28 (the store this surface exposes)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, STORE-06, REPOINT-01, REPOINT-02, CUT-01, CUT-02, CUT-03, CUT-05
*(The last six were **narrowed in from Phases 31 and 32 by D-01**, which moved the deletion into this phase and the re-pointing that had to precede it with it. They are moved, not duplicated — Phases 31 and 32 no longer name them, and every requirement still maps to exactly one phase.)*
**Success Criteria** (what must be TRUE):

  1. Every verb the Phase 19 manifest classifies `curated` or `adapt-to-address-input` has a route, every verb it classifies `omit` is absent, and `r2000_delete_project_enum` — the one verb with zero callers anywhere — is not carried. The derivation is checked **mechanically**, so a verb added later without a named consumer **fails** rather than being reviewed.
  2. **The new family is registered and the retired one is deleted, in this same phase.** This criterion originally demanded that *both* families be registered and callable at the phase's close, and called that the point of the phase. **`D-01` superseded that before planning began** (`29-CONTEXT.md` § "The r2000 exit"): presented with unregister-and-quarantine, the owner chose deletion, so the coexistence this criterion was written to buy never happened and the criterion is edited to the outcome rather than left standing beside it. What made deleting *inside* the registration phase safe is an **ordering**, named here because it is the reason and not a detail: the removal gate was built and **observed biting** before anything was removed (29-02); every guard that breaks on the **rename** moved with the rename (29-05) and every guard that breaks on **registration** moved in the registering commit (29-01); both skill trees were re-pointed onto verbs that exist, proven against the *shipped* copy, before the removal (29-09); and only then was the glue deleted (29-10). The new family never reaches `forwardToVice()`, so CLAUDE.md's derived-tool path-translation constraint is satisfied **by construction** with no interception to forget: the body-slice assertion reports the runner containing none of `forwardToVice` / `ensureViceSession` / `rewriteArguments`, and no new module imports `hostpath.ts`.
  3. Backend-agnosticism reads out of `stock-dispatch.test.ts`'s **ordered** `BACKEND_SEAM_BYPASS_KEYS` allow-list — where it is actually enforceable — and **not** out of `capability-registry.ts`, which holds only the per-backend delta a proxy-local family does not have. Neither manifest gains an entry, and `docs/tool-support.md` regenerates **byte-identical**.
  4. The registration-time gates move in the commit that registers the family, and `docs/tool-support.md`'s byte-identity drift guard, `node scripts/check-skill-tool-coverage.mjs` and `node scripts/check-npm-packages.mjs` are all green **with nothing deleted**. `generate-tool-support-table.mjs:104`'s hard-coded `R2000_TOOL_DEFINITIONS` regex and its **two deliberate duplicate witnesses** move together and none is refactored into a shared helper; `hostpath-consumers.test.ts`'s `R2000_MODULE_FLOOR` is re-pointed with its floor **raised** to the measured new count and its positive control replaced with real new filenames.
  5. Cross-references and search over the typed decode are answerable through the surface — which addresses reference a given address, and search across labels, comments and instructions — **derived on every query from the surviving `disasm-*` decoders and never cached on disk**, with `max_results` required (no default) and the result count returned so truncation is detectable. Addressing is by explicit address with no cursor concept, a repeated edit **succeeds** reporting no change rather than being rejected, a batch pre-validates every inner name and returns per-item status without aborting on the first failure, and an ambiguous or unsupported request **refuses by name** with `{available:false, reason}` rather than a plausible-looking zero.

**Plans**: 21/21 plans executed — **all 21 executed and merged**. The original 12 all executed, then **verified at 4/6 — `gaps_found`**, so 5 gap-closure plans (29-13..29-17, in 3 further waves) were added. All three of those gap waves are executed and merged (29-13, 29-14, 29-17, then 29-15, then 29-16), and re-verification has run: **4/6 again, but a different 4/6** — five of the six prior gaps are closed, two remain (criterion 2's `render-memmap --check` false drift, and `CUT-01`'s non-reproducing surviving-line figure). **Gap-closure round 2 (29-18..29-21, in 2 waves) was executed on 2026-08-30 against those two remaining gaps**: both waves are executed and merged (wave 1: 29-18, 29-19, 29-21; wave 2: 29-20). Re-verification has not yet run on this round, so the phase is not yet complete.

Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Tracer: the `anno_*` family registers end to end through `buildViceTool()`, with every registration-time guard moved in the same commit (wave 1)
- [x] 29-02-PLAN.md — The pre-phase baseline, and the removal gate built and observed biting before anything is deleted (wave 1)
- [x] 29-03-PLAN.md — `anno_enum_usage` and the one-way `SCHEMA_VERSION` 2→3 bump, with the v2 refusal proven a single witness (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-04-PLAN.md — STORE-06: derived cross-references and search, never cached, plus the address-details composition (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-05-PLAN.md — The nine registry-driven renames and the CLI rename, with every guard that breaks on the rename moved with it (wave 3)
- [x] 29-06-PLAN.md — The full verb surface: writes, stored reads, derived reads, and the depth-capped batch (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 29-07-PLAN.md — The two-verb CLI and the coverage census re-pointed onto the store, with the block-type vocabulary measured (wave 4)
- [x] 29-08-PLAN.md — MCP-01 made mechanical: the manifest derivation check and the committed verb register (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 29-09-PLAN.md — Skill re-pointing in both trees, and the fork-honesty contradiction resolved in one change (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 29-12-PLAN.md — D-17: `render-memmap` rebuilt onto the Phase 28 store, its gated tests converted rather than deleted (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 29-10-PLAN.md — The deletion, gated: the glue removed, the knowledge kept, the line citations corrected (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 29-11-PLAN.md — The record: the falsified criteria edited, Phases 30-32 narrowed, the gate's last exception closed (wave 8)

**Gap closure** — added 2026-08-30 after `29-VERIFICATION.md` scored the phase **4/6, `gaps_found`**. Five plans closing the five recorded gaps; each carries `gap_closure: true`. Waves restart at 1 because the twelve original plans are shipped and none of these depends on them.

**Re-waved 2026-08-30 after plan-checker review.** The round originally ran 4 plans in wave 1 and 1 in wave 2. The checker found that `src/mcp/vice/module-classification.ts` — a mechanically-guarded record of symbols and line citations, enforced by `module-classification.test.ts` DIRECTION 9 / 9b — is cited into files that **three** of these plans edit, so all three must correct citations in the same commit as the edit that moved them. Same-wave plans run in parallel worktrees off one base, so 29-15 moved to wave 2 and 29-16 to wave 3. Those are **file-ownership dependencies, not content ones**: nothing in 29-15 reads anything 29-14 wrote.

*Gap-closure wave 1* (three plans, no shared files — fully parallel)

- [x] 29-13-PLAN.md — MCP-04: `anno_disassemble` and `anno_read_region` made to agree on an out-of-image address, and the nested batch made to validate on the arguments it executes (gaps 1 and 4, CR-01/CR-06, plus WR-10) (wave 1)
- [x] 29-14-PLAN.md — The CLI's caller-supplied paths run through the one confinement seam, `render-memmap` gains `--force`, and the seam's consumer set becomes a closed, tested set (gap 3, CR-02/CR-03/WR-08) (wave 1)
- [x] 29-17-PLAN.md — `CUT-01`'s three falsified sizing figures corrected to the measured ones and the row moved in the same edit, on the owner's 2026-08-30 decision (gap 5) (wave 1)

*Gap-closure wave 2* *(blocked on 29-14 — file ownership of `module-classification.ts`, not content)*

- [x] 29-15-PLAN.md — Both skill trees re-pointed onto a store the `render-memmap` verb can open, and the falsified dated note deleted rather than amended, with the documented command run end to end inside `<automated>` (gap 2a, CR-04) (wave 2)

*Gap-closure wave 3* *(blocked on 29-14 and 29-15)*

- [x] 29-16-PLAN.md — The coverage verb taught the image forms the surface already reads so its only documented invocation runs, plus the CI gate that argument-checks every documented invocation (gap 2b, CR-05, plus WR-07 and WR-14 in part — the two internal identifier renames are deferred on a recorded decision) (wave 3)

**Gap closure — round 2**, added 2026-08-30 after the re-verification scored the phase **4/6 again, but a different 4/6**. Four plans in **2 waves**, each carrying `gap_closure: true`. Waves restart at 1: none of these depends on a round-1 plan for content, only for the tree they all branch from.

**This round is NOT the self-generated-scope loop, and that was checked rather than asserted.** The denominator did not grow — same six truths, same six-way split. Truths 1-5 are the five **Success Criteria** listed above; truth 6 is **`CUT-01`**, a requirement named on this phase's own `**Requirements**:` line. Neither remaining gap is a must-have lifted from a gap plan's own frontmatter. Accordingly the round's `requirements:` fields name only **REPOINT-01, REPOINT-02, CUT-01, MCP-04**; the other eight phase requirement IDs are already covered by plans 29-01..29-17 and are deliberately not re-planned.

**What is deliberately NOT in this round**, so a later reader can tell an omission from a decision: the twelve findings dispositioned **OPEN-AS-WARNING** in `29-VERIFICATION.md` (WR-03, WR-04, WR-06..WR-13) are recorded and explicitly not blocking this phase; **WR-14** is deferred to Phase 30 on shipped evidence at `scripts/lib/anno-cli-verbs.mjs:57-60`; **WR-15** and **WR-16** are deferred on record (`29-16-PLAN.md:138` and its `<wr14_scope_decision>`); **CUT-06** belongs to Phase 32 — the gap-1 texts are not CUT-06, because they misdescribe a **live** verb this phase built rather than pointing at a deleted route; and both items in `deferred-items.md` stay where they are. **WR-02 is the single warning folded in**, and only because a recorded prohibition is `violated` on it.

**Two owner decisions were already taken and are implemented rather than re-opened.** CR-01's fix shape: the banner records **workspace-relative** paths — the alternative of moving them to stderr is rejected, because the memory map is a committed artifact and its provenance belongs inside it where `--check` can compare it in CI and in a worktree. And `CUT-01`: **correct the sentence to the figures that re-derive**, with **no** `overrides:` entry — an override would defeat the requirement's own stated purpose.

**Stopping rule, dated 2026-08-30 and written into all four plans.** If a **round-3** verification again finds new defects in **plan-derived** truths while all five success criteria plus `CUT-01` read verified, the phase **seals on the contract with its residuals stated** rather than running a round 4.

*Gap-closure round 2, wave 1* (three plans, no shared files — fully parallel)

- [x] 29-18-PLAN.md — **Tracer:** the `render-memmap` banner made path-independent through one new `workspaceRelativePath()` seam, proven end to end by rendering under root A and `--check`ing the identical bytes under root B, and the suite that PINNED the defect re-pointed (gap 1, CR-01) (wave 1)
- [x] 29-19-PLAN.md — The invocation gate taught to see an omitted REQUIRED flag, with its declaration tables moved where its own committed test can read them, and the verifier's exact plant observed biting (gap 1 `missing` item 4, WR-01) (wave 1)
- [x] 29-21-PLAN.md — `CUT-01` re-measured rather than transcribed, at a commit the sentence names, with checkbox, sizing sentence, provenance paragraphs and traceability row moved in one edit; and `MCP-04` promoted on the re-verification verdict across all four of its sites (gap 2, plus the stale row) (wave 1)

*Gap-closure round 2, wave 2* *(blocked on 29-18 for content — the corrected prose describes the corrected code — and on 29-18/29-19 for **file ownership** of `module-classification.ts` and of the invocation gate's baseline; those are ownership dependencies, not content ones)*

- [x] 29-20-PLAN.md — The three falsified user-facing drift texts corrected, including the template copied into every new project, plus WR-05's other USAGE drifts and the WR-02 header contradiction resolved with its residual named — discharging the 29-14 prohibition's three recorded counts (gap 1 `missing` item 3, WR-05, WR-02) (wave 2)

Notes:

- **Ordering constraint 4, and research calls it the single most important sequencing fact in the architecture work:** two CI gates break on the **rename**, not on the deletion. Handled anywhere later, this phase closes with a red CI gate and the deletion phase inherits a failure it did not cause.
- Nothing is appended to `vice-proxy.ts` — registration is a two-line substitution (the import and the loop) with all new code in sibling modules, which preserves both `docs-linerefs.test.ts`'s citations and PROJECT.md's standing instruction about that file's size.
- Do **not** route the family through `buildBackendAwareTool()`: on the non-fork arm it calls `dispatchStock()`, which has no table entry for the new names and refuses by name — the store would be **unreachable on stock**.
- Do **not** hand-add the family to a manifest: `refresh-manifest.ts` regenerates from a live *host VICE* `tools/list` and would wipe the entry.
- Derive the module set from disk (`readdirSync` plus a stable name-prefix regex), never from a hand-typed list — that is why `hostpath-consumers.test.ts` and `r2000-spawn-seam.test.ts` are shaped the way they are: a hand-typed list went stale and `INT-01` found four uncovered modules.
- The prefix must be a **single stable prefix derivable from disk**, and the removal gate's rule stays prefix-independent: no shipped module name may contain `r2000`, and no shipped tool name may contain `r2000_`.
- A `py_eval`-shaped meta-tool is the nested-argument smuggling shape `vice.ts`'s `DENY_LIST` exists to close. The batch verb is the one sanctioned exception, and it pre-validates every inner name including recursively.
- **Anti-features, measured rather than assumed:** a cursor / current address (upstream's own procedure text says *"NEVER use the 'current cursor address'"*), rejecting no-op writes (breaks idempotency, and agents retry on timeout), nested scopes (`add_scope` has exactly one site in the whole skill tree), and an explicit save verb that governs durability (durability is the store's, not the caller's).
- `anno-xref`-class derivation must never cache on disk: a cached index inside the store creates a second truth that can disagree with the block table, which is the exact failure `COV-01`'s derived-from-bytes census was built to make impossible.

### Phase 30: ACME Export and the Real-ACME Oracle

**Goal**: Exported ACME source is correct because a **real ACME actually
assembles it and the bytes match** — through a verify path built for this
purpose, standing and exercised before the deletion window opens.
**Depends on**: Phase 28 (the store to export) and Phase 29 (the surface to reach it)
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):

  1. Real ACME 0.97 assembles the export and the verdict is settled by a **byte-diff against the input** — never by an exit code, and never by a string match on the exporter's own output. The five surviving verdict rules are carried explicitly: never derive `ok` from exit status; never trust an aggregate line; require **unanimity** across ACME's own result lines with the first non-ok driving the verdict; refuse to guess when more than one authoritative line is present; and treat `"skipped"` as a **third outcome** that is never conflated with `"ok"`.
  2. **Two mandatory reds, both observed against the new producer.** (1) With `ACME_BIN` bogus, export verification reports skipped-or-failed and **never** a pass, and restoring the exit-code shortcut makes the test fail. (2) A deliberately corrupted export byte makes the byte-diff **fail while ACME itself still exits 0**. Both directions were proven once before against a producer this milestone deletes; that evidence does not transfer and is re-earned here.
  3. Both carried idioms are **load-bearing in that reassembly** rather than merely emitted: a self-modifying write target named by an `=*+$01` mid-instruction label reassembles byte-identically **on a fixture that actually contains self-modifying code**, and the **11** typed label prefixes come from `AUTO_NAME_PREFIX_RE` itself — so `routine-queue-walker`'s backlog signal still recognises `p_`, `j_`, `s_`, `b_`, `r_` and `zpf_`. Neither idiom exists in this codebase today; both are built, not preserved.
  4. What ACME cannot express is **reported as such** rather than emitted and hoped for: an illegal opcode outside the 221 expressible under `!cpu 6510` round-trips byte-identically as `!byte $xx` with a naming comment and never as an invented mnemonic, and every block asserts `*` equals its original address so a label substituted for a zero-page literal cannot change the instruction length and shift the code after it unnoticed. An enum renders on the **immediate** operand only, with reassembly byte-identity as the control that catches the wrong-operand case.
  5. A duplicate label is **refused** by the store, and with that refusal removed the export reassembles and **real ACME itself reports the duplicate-symbol error** — the external oracle confirming the internal one. That is the shape this project's own record demands: an internally-verified opcode table still shipped 14 wrong entries, caught only by running the output through a real assembler.

**Plans**: 6/6 plans executed across 5 waves

Plans:
**Wave 1**

- [x] 30-01-PLAN.md — TRACER: one store, one range, one image, real ACME, one byte-diff — `acme-verify.ts` (test-only) and `anno-export-asm.ts` (ships) proved end to end (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-02-PLAN.md — Both mandatory reds against the new producer, the five verdict rules as named pure helpers, and both pinned transcripts re-recorded from real ACME 0.97 (wave 2)
- [x] 30-03-PLAN.md — Per-block `*` assertions proved capable of biting, the typed data-range emitter over all twelve `DATA_TYPES`, and the embedded-newline refusal `assertCommentText()` did not have (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-04-PLAN.md — The `=*+$01` idiom on a fixture that genuinely self-modifies, the eleven prefixes read from `AUTO_NAME_PREFIX_RE`, enums on the immediate operand only, every inexpressible opcode as `!byte`, and real ACME confirming the duplicate-label refusal (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 30-05-PLAN.md — `anno export-asm` lands as a CLI verb, with every floor it moves raised on both sides in the same commit and the exporter added to the `files[]` closure (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 30-06-PLAN.md — Re-point every statement this phase falsifies in both skill trees, the shipped module headers and the project record, plus the guard that ties documented verb status to the parsed verb set (wave 5)

Notes:

- **Ordering constraint 2, and where its subject now lives:** `r2000-launch.ts` was deleted in **Phase 29** (plan 29-10) under `D-01`, so the window this constraint warns about is **open now**, from the v0.7.0 Phase 29 close until this phase lands. The constraint is **honoured rather than broken**, and the mechanism is `D-02`/`D-14`: no export route was invented ahead of this phase's oracle. `export-asm`, `export-lbl`, `import-lbl` and `gen-enums` are **withdrawn** with dated notices in both skill trees and in `PROJECT.md`, so nothing makes an unverified reassembly claim inside the window — there is no claim to sit at fixture level. What this phase must therefore do is *rebuild* the route, not re-verify a surviving one.
- **The "reuse the existing `--verify` seam" premise is false, and three researchers flagged it independently as the most dangerous item in the milestone.** `r2000-verify.ts` (184 lines) imports from `r2000-launch.ts` and parses *regenerator2000's* per-assembler transcript; it never invokes ACME, and it dies with its subject. Only the **discipline** survives. Plan this as a rebuild, not a rename.
- The natural repair reopens the incident the seam exists to prevent: `spawnSync("acme", ...).status === 0` has the same hole one level over — a missing binary yields `status: null`, and a truthiness check reads a missing assembler as a pass. The recorded false pass, verbatim: `x ACME — ACME not found in PATH (skipped)` / `ok All roundtrip verifications passed.` / `EXIT=0` — exit zero, an aggregate line reading as a full pass, and the one assembler this project cares about never ran.
- Spawn ACME with an **argv array**, never a shell string, matching `src/skills/acme-build/scripts/acme.mjs`'s argv verbatim so the two agree by inspection; never treat an ACME stderr *warning* as a failure. The verify module is a **deliberate second implementation** of that spawn, because `src/mcp/vice/**` and `src/skills/**` are separate npm packages and cannot import each other.
- The committed golden witness of the target output format is [`notes/dxa-ghidra-pivot-evidence/r2000.asm`](notes/dxa-ghidra-pivot-evidence/r2000.asm), which carries four live `=*+$01` labels. The idiom was run against real ACME 0.97 during research: `smc_operand = * + $01` before `lda #$00` assembles `sta smc_operand` as `8d 02 08`, correctly targeting the operand byte.
- Re-record both pinned transcripts — the honest pass and the false-pass trap — from **real ACME output**, not from the deleted producer's. **Both were carried forward by plan 29-10 before their module was deleted and now live in `.planning/phases/29-the-mcp-surface/fixtures/`** — `verify-honest-pass.txt`, `verify-false-pass-trap.txt`, and a `README.md` recording their provenance (`regenerator2000 0.9.20` + ACME 0.97, Phase 10) and this obligation. They are carried as **the shape to reproduce, not content to assert against**: asserting against these bytes would re-pin this phase's oracle to the very producer it replaces, which is what the re-record obligation in this same sentence exists to prevent. The two statements agree deliberately.
- Run the ACME hard-fail gate from Phase 27 at this phase's boundary too. It is the cheapest red available in the milestone and it protects every claim in this phase.

### Phase 31: Procedure Re-pointing

**Goal**: The attribution and provenance record that outlives the deleted code is
correct — the `ABS-02` chain byte-identical across both trees, the one trigger
description that named the retired analyser rewritten **substantively** and
re-checked for collisions, and Phase 19's manifest re-synced in the same commit
that changes what it describes.
**Narrowed by `D-01`.** The re-pointing itself — this phase's original criteria 1,
2 and 3, and `REPOINT-01`/`REPOINT-02` with them — was carried out in **Phase 29**
by plan 29-09, because `D-01` moved the deletion into Phase 29 and the re-pointing
had to precede it (see the restated ordering constraint 3 in Sequencing Rationale).
Those criteria are discharged there and are not restated here.
**Depends on**: Phase 29 (which carried out the re-pointing whose attribution and manifest records this phase must now make correct)
**Requirements**: REPOINT-03, REPOINT-04
**Success Criteria** (what must be TRUE):

  1. The `ABS-02` attribution chain is intact after the change: **10 instances across two trees**, each with its two naming lines byte-identical, while `routine-queue-walker/SKILL.md:3`'s YAML `description:` — trigger text, **not** attribution, and therefore not exempt — changes **substantively** rather than being worked around. `ABS-03`'s pairwise trigger-collision check across all seven skill descriptions passes on the rewritten text.
  2. `upstream-procedure-manifest.json` is updated in the **same commit** that changes what it describes — its own third re-sync trigger requires it — including a criterion for `r2000_undo`'s `omit` disposition, so the justification assertion in `anno-derivation.test.ts` (the re-pointed successor to `r2000-upstream-audit.test.ts`) cannot end up recording a reversed decision.

**Plans**: 3 plans in 3 waves

Plans:
- [ ] 31-01-PLAN.md — Re-sync `upstream-procedure-manifest.json`: seven live stale references re-pointed onto surviving subjects or turned into dated facts, and `r2000_undo` gains `"requirement_id": "STORE-04"` with its `omit` disposition intact. One task, one commit (`REPOINT-04`)
- [ ] 31-02-PLAN.md — Score criterion 1 with a committed assertion: one new test in `skill-attribution.test.ts` walking **both** skill trees for the two byte-exact naming lines (relations plus a floor, no adjacency, no literal total), plus its in-memory planted-violation proof, plus the recorded `ABS-03` measurement (`REPOINT-03`)
- [ ] 31-03-PLAN.md — Re-point the three living citations of the criterion `D-01` renumbered (two in the removal gate, one in `STATE.md`), and record this phase's four judgements as a dated `STATE.md` Decisions entry. No requirement status is promoted ahead of the verification verdict (`REPOINT-03`, `REPOINT-04`)

Notes:

- **Ordering constraint 3 no longer runs between this phase and Phase 32 — it became an *intra-phase* constraint of Phase 29.** It is restated there and in Sequencing Rationale rather than deleted, because it is the reason the removal gate was built and observed biting before the deletion commit, and deleting the constraint would delete the reason.
- **The re-pointing itself landed in Phase 29 (plan 29-09), not here.** All five absorbed procedures, the 10 files under `src/skills/`, the 18 distinct tool names, `scripts/packer-finding.mjs`, `templates/memory-map.template.md` and the gitignored-but-shipped `installer/skills/` twin were re-pointed there and proven against the **shipped** copy by `scripts/check-npm-packages.mjs`. `scripts/check-skill-tool-coverage.mjs` extracts **zero** old-family names and its floor is re-expressed over the new prefix at the measured new count, raised not lowered. `REPOINT-01` and `REPOINT-02` are recorded complete against Phase 29.
- **Partially discharged already, and stated so rather than left as work to redo:** `routine-queue-walker/SKILL.md:3`'s YAML `description:` was rewritten **substantively** in 29-09 (it now names the annotation store, not the retired analyser) and `check-skill-description-overlap.mjs` / `skill-description-overlap.test.ts` re-ran green over all seven descriptions. `REPOINT-03` is nevertheless **not** recorded complete — no verification pass has scored the `ABS-02` chain's byte-identity across both trees since, and a status may not claim more than its evidence. What remains for this phase is confirming that chain, not rewriting the description.
- `packer-finding.mjs`'s recorded provenance value was given an explicit fate in 29-09 — the fact about the past run survives, the tool-name-shaped literal does not — and its residual mention sits under the removal gate's `surviving-provenance` permanent exemption. Do not re-open that decision here.
- The `ABS-02` headers are protected in **both** directions and in **both** trees: `skill-attribution.test.ts` enforces them, and the removal gate's BLOCK-scoped `skill-attribution-headers` class exempts them with both a hit pin and a block pin, so **deleting a header fails the gate** rather than silencing it. Driving `grep -rail 'regenerator2000' installer/skills` to zero is therefore unsatisfiable by design, not an outstanding task.
- **`R2000-14`/`R2000-15`'s symbol round trip is WITHDRAWN, not riding on this phase.** Its route was removed in Phase 29 (D-14). An earlier version of this note forecast that it would come back alongside the ACME export oracle; the ACME export route did return on 2026-08-31 as `anno export-asm`, but the work that rebuilt it covered that route only, so **no phase currently owns the symbol round trip's return**. The forecast is corrected here rather than deleted. See the dated withdrawal note in `PROJECT.md` and beside `SEAM-02` in `REQUIREMENTS.md`, both corrected in the same change.

### Phase 32: The Deletion and the Grep Gate

**Goal**: The deletion **stays** clean — every guard and CI script that was
re-pointed off the deleted subject is audited **as a set, after the dust has
settled**, and proven non-vacuous; and no living document is left pointing a user
at a route that no longer exists.
**Narrowed by `D-01`.** The deletion itself, the grep gate, its non-vacuity
assertion and the fork-honesty contradiction all landed in **Phase 29** —
`CUT-01`, `CUT-02`, `CUT-03` and `CUT-05` are recorded against that phase, and
this phase's original criteria 1, 2 and 3 are discharged there. What is left is
the part that could not be done early: a retrospective audit whose subject does
not exist until the last guard has moved.
**Depends on**: Phase 29 (which deleted the integration and re-pointed the guard set this phase audits) and Phase 31 (the attribution and manifest records). Last, non-negotiably
**Requirements**: CUT-04, CUT-06
**Success Criteria** (what must be TRUE):

  1. **Every guard and CI script pinned to the deleted subject has a recorded fate, and none passes vacuously — audited over the whole re-pointed set at once, retrospectively.** This is `CUT-04`, and it is the one cut requirement Phase 29 deliberately did **not** pull forward; see the note below for why. Each re-pointed guard's own planted violation is re-run against its **new** subject and observed red — a guard that cannot be made to fail has not been re-pointed. The three that went red **by construction** (`docs-linerefs`, `docs-dangling-refs`, and `docs-absorbed-decisions` — renamed from `docs-r2000-decisions` by plan 29-05, in the same commit as `scripts/audit-gate.mjs`'s registry entry, per `D-12`) were **pre-declared before the deletion**, so an unpredicted red stayed distinguishable from a predicted one, and each was discharged by rewriting content rather than by loosening the guard; this phase re-checks that judgement over the settled tree rather than re-taking it. `check-skill-fork-honesty.mjs`'s direct contradiction is **already resolved** — plan 29-09 named the *skill* as the side that moves, replacing the live `"r2000 export-asm"` instruction with a dated withdrawal notice and re-pointing the guard's positive check at that notice's literal (`CUT-05`, recorded against Phase 29).
  2. **No living document points a user at a deleted route** (`CUT-06`): install documentation, `CLAUDE.md`'s regenerator2000 constraint bullets and its `r2000_*` clause, `PROJECT.md`'s constraints and Key Decisions rows — including its already-stale `vice-proxy.ts` line citations and its `D-36` row's pointer at the **pre-rename** guard file name `docs-r2000-decisions.test.ts`, which no longer exists on disk — `ARCHITECTURE.md`'s Rule A21, `THIRD-PARTY-NOTICES.md`'s dual-licence notice — which **remains true** for the retained prose — and all seven skill playbooks. The **phase-close gate half** of this criterion (full `npm test` over the whole glob with the **broker stopped**, both `check-*.mjs` CI scripts, `docs/tool-support.md` byte-identical, and every `docs-*.test.ts` guard green — the last a precondition of recording any milestone-audit status, enforced by a real `PreToolUse` hook rather than by convention) was first carried out at **Phase 29's** close and is **re-run** here rather than established here.

**Plans**: TBD

Notes:

- **Why `CUT-04` stayed here when `CUT-01`, `CUT-02`, `CUT-03` and `CUT-05` were pulled forward into Phase 29 — deliberate, not an oversight.** `CUT-04` is a **retrospective vacuity audit**, and its subject only exists once the re-pointing has happened. Phase 29 re-pointed a **large** guard set — `hostpath-consumers.test.ts`'s module floor, `check-skill-tool-coverage.mjs`'s CLI-verb floor and its skill-coverage floor, `anno-derivation.test.ts`'s registry-versus-manifest non-vacuity relation, the `docs-absorbed-decisions` / `audit-gate.mjs` pair, `check-skill-fork-honesty.mjs`'s re-pointed README assertion, and `spawn-seam.test.ts` re-pointed onto the emulator spawn seam — and each was proven non-vacuous **individually, at the commit that moved it**, by that phase's own standing prohibition. What `CUT-04` adds is the **mechanical sweep over the whole set at once, measured after the dust settles**, which is a different check and one that cannot be run before the last guard has moved. Keeping it here is the only place it can be honest. **Phase 29 is the source of most of the guards it will audit**, so this phase's scope *grew* rather than shrank when the other four cut requirements left.
- **Ordering constraint 5, and the `4f048bb` precedent:** that commit closed a milestone with `docs-review-disposition.test.ts` already red and nothing forced anyone to notice. The grep gate and every guard fate were therefore a **precondition** of the deletion commit rather than a follow-up — a rule Phase 29 had to satisfy *inside itself* once `D-01` moved the deletion there, which is exactly what it did (see the restated ordering constraint 3 in Sequencing Rationale). It still governs this phase: nothing here may be recorded green over a guard already red.
- **The gate, its scope predicate and its exemption axes are BUILT, not outstanding.** Plan 29-02 delivered `scripts/check-no-regenerator2000.mjs` with the scope predicate settled (`git ls-files` minus the `.planning/` prefix, plus a post-sync read of the gitignored-but-shipped `installer/**` paths supplied by `packFiles()`), both exemption axes in place (line-scoped and BLOCK-scoped, the latter reusing `skill-attribution.test.ts`'s own block extractor), and per-exemption non-vacuity pins in **both** directions so deleting an attribution header fails the gate rather than silencing it. It was observed biting on four planted routes plus the exemption non-vacuity plant with a green false-positive control, and re-proven by two further plants against the real post-deletion tree in 29-10. Do not re-derive any of it here; audit it.
- **The answer-key leg is preserved and the choice is recorded.** `r2000-answer-key.test.ts` — which reads `.planning/phases/11-*/evidence/` with no existence guard and is the second leg of the "do not archive phase directories" decision — was **renamed to `absorbed-answer-key.test.ts` and kept**, not deleted. `docs-r2000-decisions.test.ts` likewise moved to `docs-absorbed-decisions.test.ts` in the same commit as `scripts/audit-gate.mjs`'s registry entry, per `D-12`; splitting those two would have broken the audit gate, and it did not happen.
- **Two guard fates were DEFERRED to this phase rather than discharged in Phase 29, and they are named here so the recorded-fate criterion picks them up instead of them sitting inert.** Both hinge on the same subject — the twelve committed `project.regen2000proj` coverage fixtures — so they are one decision taken twice, not two:
  1. **`block-class.ts`'s transitional capitalised block-type arm survives its own removal trigger** (recorded by plan 29-07). Its producer is gone, but every committed coverage fixture is still spelled in that vocabulary, so deleting the arm today would silently reclassify every fixture block as `data`. Its **new** removal trigger is *the fixtures being re-spelled*; record its fate against that trigger rather than against the producer's absence.
  2. **`src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` kept its generator and FROZE its writer** (plan 29-10). `synthesizeProject()` was inlined as a module-private writer emitting byte-identical JSON rather than being re-pointed onto the Phase 28 store, because re-pointing it would re-derive all twelve fixtures and change what the census controls measure. Its header now records that those twelve files are the only remaining record of the format. The re-point is Phase 30's work on Phase 30's evidence; this phase records the fate, it does not perform the re-point.
- Keep the **D-36** decision row as dated history rather than deleting it, and give its guard an explicit superseded-by fate. A dated decision with a named reversal trigger is a record, not a pointer at live code.
- Close with **`--no-archive-phases`**. The deletion is not a route to relaxing that constraint: Phase 19's manifest is a design input to this milestone, and two surviving guards force the constraint regardless.
- This phase contains no build work by design, and it is not thin: its deliverable is a **recorded, non-vacuously-verified fate for every guard and CI script** that was pinned to the deleted subject, measured over the whole re-pointed set at once on a settled tree — plus the living-document sweep. The gate itself, and its four observed plants and green false-positive control, were delivered in Phase 29; this phase audits that work rather than repeating it.

## Sequencing Rationale (v0.7.0)

**Six phases, at `standard` granularity — one above the band, deliberately.** The
requirements do not cluster into four. The milestone has two halves with different
verification regimes — build a store, then remove its predecessor — and the
removal half is where the risk lives. Both research agents that derived an
ordering independently arrived at the same six roles, and their orderings do not
conflict. Every phase here completes a verifiable capability; none is a technical
layer, and none is the thin-maintenance shape this project's granularity guidance
says to fold.

**Eight hard ordering constraints, each derived from code rather than taste.**
They are recorded per phase above and collected here because they, not the phase
count, are what the sequence exists to satisfy:

1. **The ACME gate split precedes the deletion** (27 → 32), in the same commit or
   earlier, with `ACME_BIN` / `VICE_REQUIRE_ACME` byte-identical because CI binds
   them by name.

2. **An ACME oracle exists before the deletion window opens** (30 → 32), or every
   claim made inside that window sits at fixture level. **Where its subject now
   lives, after `D-01`:** the deletion moved into **Phase 29**, so the window is
   open *now* — from the Phase 29 close until Phase 30 lands. The constraint is
   **honoured rather than broken**, and `D-02`/`D-14` are the mechanism: no export
   route was invented ahead of the oracle. `export-asm`, `export-lbl`,
   `import-lbl` and `gen-enums` are **withdrawn** with dated notices in both skill
   trees and in `PROJECT.md`, so no claim is made inside the window at all — there
   is nothing sitting at fixture level because there is nothing claiming.

3. **The removal follows the skill re-pointing — RESTATED, 2026-08-30, as an
   INTRA-PHASE constraint of Phase 29 rather than an inter-phase one between 31
   and 32.** `D-01` moved both subjects into the same phase, so the rule did not
   stop applying, it changed scale: it is why plan 29-02 ran *before* plan 29-10.
   The gate was built and **observed biting** on four planted routes plus the
   exemption non-vacuity plant, with a green false-positive control, at wave 1;
   both skill trees were re-pointed at wave 5 and proven against the **shipped**
   copy; the deletion commit came at wave 7. Deleting first would have left the
   absorbed procedures pointing at nothing **and** left the grep gate unable to
   distinguish "not yet re-pointed" from "reintroduced", which makes the
   milestone's own gate requirement unenforceable. **The `4f048bb` precedent is
   what this constraint exists against** — a milestone closed over an already-red
   `docs-review-disposition.test.ts` with nothing forcing anyone to notice — and
   that is why this is restated rather than deleted: deleting the constraint
   deletes the reason the gate came first.

4. **The registration-time guards move in the registration phase** (29) — *the
   single most important sequencing fact in the architecture research.* Two CI
   gates break on the **rename**, not on the deletion. **Where its subject now
   lives:** unchanged — still Phase 29 — but after `D-01` that phase carries the
   rename, the registration *and* the deletion, so the constraint tightened
   rather than moved. It was satisfied in three separate commits inside the
   phase: registration-time guards at wave 1 (29-01), rename-time guards with the
   `git mv` at wave 3 (29-05), and deletion-time guards with the deletion at
   wave 7 (29-10).

5. **Every gate is built before the thing it gates.** The `4f048bb` precedent is a
   milestone closed over an already-red guard with nothing forcing anyone to
   notice.

6. **The type vocabulary is decided in the store core** (28) **and never
   revisited.** Split-table orientation is unrecoverable from data that never
   recorded it.

7. **Phase directories are not archived at the close**, and the reason has grown:
   Phase 19's manifest is now a design input, not merely a guard's fixture.

8. **The expected reds are pre-declared.** Three guards go red by construction on
   the deletion, so an unpredicted red must be distinguishable from a predicted
   one.

**Why the seams come first, and why they are not folded into the store core.**
Phase 27 is pure moves with no behaviour change — the cheapest phase in the
milestone — and it is what makes every later diff readable. It also delivers a
guarantee a user can observe rather than only internal tidiness: without it, CI's
ACME claim silently degrades from "hard fail if ACME is missing" to "skip", over
a green run. Folding it into Phase 28 would put a pure move in the same phase as
the milestone's one irreversible decision, where its diff would disappear.

**Why the exporter is its own phase rather than part of the store or the
surface.** It carries a different verification regime from both: an external
oracle with **two mandatory reds**, neither of which any store or surface test
can produce. Its supposed predecessor seam does not exist — `r2000-verify.ts`
parses regenerator2000, not ACME — so this is a rebuild, and burying a rebuild
inside a larger phase is how the "reuse the existing seam" premise survived into
a requirement in the first place.

**Why the deletion is last and contains no build work.** Everything it removes
has a live replacement by then: registered at 29, exercised against a real
assembler at 30, depended on by the skills at 31. Deleting before 31 leaves the
absorbed procedures pointing at nothing; deleting before 29 breaks
`check-skill-tool-coverage.mjs` at module load and leaves CI red with no
replacement to point at.

**What is NOT in this milestone, and why that is a disposition rather than an
omission.** `DXA-*`, `GHID-*`, `OPC-*`, `AUTO-*` and `PROOF-*` stay **held** with
v0.6.0's Phases 24 and 26, blocked on a frame-exact emulator stop that nothing
owns. `DECOMP-*`, `BUILD-*` and `EQUIV-*` are **v0.9.0**, each written against
the substrate this milestone builds — `DECOMP-01` being precisely what
`STORE-01`'s 12-member vocabulary is sized for.

## v0.6.0 Own the substrate — CLOSED INCOMPLETE (Phase Details)

*v0.6.0's phase details, kept in place rather than archived. Phase 23 is
complete; Phases 24 and 26 are **HELD** with their requirement text live for
v0.8.0, which carries them forward unchanged; Phase 25 was **taken forward** and
its live scope is v0.7.0's Phases 27-32, above — not the Phase 25 block below,
which is retained as the historical record of how that work was scoped inside
v0.6.0.*

*This section sits **after** v0.7.0's, deliberately.
`extractCurrentMilestoneScoped()` slices the active milestone's window from its
summary heading to the next version-bearing heading, skipping `Phase`-shaped
headings on the way — so v0.6.0 detail blocks placed between v0.7.0's summary and
its `(Phase Details)` heading fall inside v0.7.0's window. Measured, not reasoned
about: `roadmap.analyze` reported `phase_count: 10` for a six-phase milestone
before this section was moved, and `6` after. Do not reorder these two sections
back.*

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

**Plans**: 11 plans — **6 executed** (23-01, 23-02, 23-03, 23-04, 23-10, 23-11); **5 deliberately NOT dispatched** (23-05, 23-06, 23-07, 23-08, 23-09), by explicit operator decision: each reads the depacked flat-64K capture as its substrate (D-03) and 23-03 could not produce one, so running them against the 279-byte self-authored fixture instead would reproduce the exact defect `PROOF-01` exists to remove. Not a failure and not an omission — a recorded decision. Their criteria are `could-not-run`.

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Pre-commit the decision rule R1..R9, the outcome-line schema, the criterion-1 measurement definitions and the evidence conventions (wave 1, alone)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — Provision dxa 0.1.5 pinned by sha256, Ghidra 12.1.3 and the probe scripts, proven end-to-end on the 279-byte fixture (the tracer)
- [x] 23-03-PLAN.md — Corpus intake and depack-by-running flat 64K captures for both releases, with capture equivalence proven — **outcome: equivalence DISPROVEN.** Corpus secured and the $1BC2 handoff proven per release, but the fork's stopping checkpoint is not frame-exact so no reproducible 64K capture exists. `C0_CORPUS: partial` → rule R1 fires → **no-go**
- [x] 23-04-PLAN.md — The analyzer.rs capability audit, read offline, every capability given one of three dispositions

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 23-05-PLAN.md — The VICE-observed corpus inventory: $01 timeline, dispatch sites, certain sets and the measurement window — **NOT dispatched** (deliberate operator decision: no depacked flat-64K capture substrate, D-03; criterion recorded `could-not-run`)
- [ ] 23-06-PLAN.md — Two-release provenance classification, holding cracker-authored bytes out of criterion 1's denominator — **NOT dispatched** (deliberate operator decision: no depacked flat-64K capture substrate, D-03; criterion recorded `could-not-run`)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 23-07-PLAN.md — Criterion 1: dxa's data-recovery rate and error direction, printed beside the fixture's reproduced numbers — **NOT dispatched** (deliberate operator decision: no depacked flat-64K capture substrate, D-03; criterion recorded `could-not-run`)
- [ ] 23-08-PLAN.md — Criterion 2: Ghidra against a computed-index dispatch, checked site by site against the runtime inventory — **NOT dispatched** (deliberate operator decision: no depacked flat-64K capture substrate, D-03; criterion recorded `could-not-run`)
- [ ] 23-09-PLAN.md — Criterion 3: where a single forward-carried $01 value stops being correct, established by observation — **NOT dispatched** (deliberate operator decision: no depacked flat-64K capture substrate, D-03; criterion recorded `could-not-run`)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 23-10-PLAN.md — The findings document and the machine-readable verdict, derived from the pre-committed rule — **outcome: `no-go`, rule `R1` fired** on `C0_CORPUS: partial`. `docs/phase23-real-release-gate-findings.md` carries the machine-readable verdict, the rule reproduced verbatim, and criteria 1-3 as `could-not-run` (23-05..23-09 not dispatched: no depacked capture substrate, D-03)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 23-11-PLAN.md — ROADMAP and STATE pointers gating Phase 24, and the PROOF traceability flip

Notes:

- **Verdict recorded: `no-go`, rule `R1` fired** on the input `C0_CORPUS: partial`. The machine-readable verdict, the rule reproduced verbatim, the corpus identity, the instrument pins and every criterion outcome live in one place: `docs/phase23-real-release-gate-findings.md` (frontmatter `verdict` / `verdict_rule_applied` / `criteria`). The per-criterion values are deliberately **not** restated here — that document is their single source of truth, and a second copy is a second thing that can drift.
- **This phase is the gate, and its verdict is an artifact, not a judgement held in a head.** Criterion 5 is what makes the gate structural rather than skippable. Read the recorded verdict before planning Phase 24.
- **Nothing downstream may be planned as though the answer is already known.** Do not write Phase 24, 25 or 26 plans before this phase closes. `PROOF-05`'s own wording is "before any engine or store code is written".
- Nothing here builds product. If the probe wants throwaway scripts, they are evidence, not deliverables — the Phase 9 shape exactly (8 plans, zero product code).
- **Write the rules before you have the answers.** Phase 9's `R4` was credible only because its inputs and thresholds were committed while the outcome was still unknown. A rule written after the measurement makes every future gate advisory.
- **The corpus is an input this phase must secure first, and its absence is itself a gate input.** `c64-provenance-diff` operates on a *consuming* project's `recovery/` tree (`RELEASES.json` plus `.bin` dumps and their `.map.json` manifests); nothing in this repository is a real release — `find` over the whole tree returns three `.prg` files, all synthetic probe fixtures. If real, independently-cracked releases cannot be obtained, measuring on another self-authored fixture reproduces the exact defect `PROOF-01` exists to remove, and that fact belongs in the verdict rather than in a footnote.
- The releases are already provenance-classified, which is worth using: a `CRACKER-PATCH` range is loader or cracktro code and a measurement that silently mixes it with game code is measuring two different things at once.
- Research question 2 — *does Ghidra's 6502 decompiler degrade on illegal opcodes in real code* — is **not** a v0.6.0 requirement and is deliberately unmapped. Real cracked code will exercise it incidentally here; the deliberate answer is `OPC-03` in Phase 24. If this phase observes an undecodable byte poisoning a whole function rather than being skipped, record it: it raises `OPC-01`'s priority inside Phase 24, and it does not add scope here.

### Phase 24: The Two Engines

**Status**: **HELD** for v0.8.0 (2026-08-26). Blocked on a frame-exact
emulator stop, which nothing owns; nothing here was falsified, only its
substrate is missing. Requirements, success criteria and notes below are left
**byte-identical** and are not archived, because v0.8.0 carries them forward
unchanged.

**Goal**: A raw C64 binary goes in and machine-readable facts come out — dxa
separating code from data, Ghidra headless recovering structure under this
project's own harness — with the 105 undocumented opcode bytes decodable so
cracked code is not silently mis-read, and hardware writes surviving the
decompiler rather than being deleted as dead stores.
**Depends on**: Phase 23 — the recorded verdict gates this phase's scope; a `degrade` narrows it and a `no-go` may dissolve it. The verdict is recorded in `docs/phase23-real-release-gate-findings.md`; read its frontmatter field `verdict` — and `verdict_rule_applied`, which names the rule that produced it — **before writing any plan here**. As recorded: `verdict: no-go`, `verdict_rule_applied: R1`.
**Requirements**: DXA-01, DXA-02, DXA-03, GHID-01, GHID-02, GHID-03, GHID-04, GHID-05, OPC-01, OPC-02, OPC-03
**Success Criteria** (what must be TRUE):

  1. A caller hands a `.prg` or flat 64K image to a command this project ships and gets a machine-readable code/data map back — from a dxa this project **builds at a pinned version** with its GPLv2+ notice recorded, never one assumed present on `$PATH`. Naming a known-data range excludes those bytes from discovery. On a listing it does not understand the parser **refuses by name**, proven by a planted malformed listing line producing the refusal rather than a partial map — a silent mis-parse here feeds phantom code into every stage downstream, which is the one failure this parser exists to prevent.
  2. Ghidra runs headless against the same image from a **committed script**, handed dxa's map as hints — reproducible by a second run from a clean project rather than reachable only through a documented click-path.
  3. **The volatile-I/O hazard is proven caught, not asserted fixed.** A committed control removes the volatile flag from `$0000-$0001` / `$D000-$DFFF` and the test observes the hardware writes *disappearing* from the decompiler output — red without the fix, green with it — so the guard is demonstrably measuring the deletion rather than restating the fix. A run where the loader already owns a block at that address sets the flag on the existing block, and is proven not to fall back to non-volatile through a swallowed `MemoryConflictException`.
  4. Structural facts no listing-level query can produce are present in the export **from a real binary**: an array bound, the split-pointer `CONCAT11` idiom, a record stride, at least one resolved computed jump and at least one self-modifying write target — with cross-references carrying their access kind (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), not addresses alone. A committed control asserts the same export routed through `DataTypeManager` returns essentially nothing, so the single most expensive mistake available in this design is one a future edit cannot make silently.
  5. All 105 opcode bytes stock `6502.slaspec` omits decode under the extension, and loading `65c02.slaspec` in the same installation still yields *its* documented meanings for the bytes both claim — the layering is demonstrated non-colliding rather than asserted. `XAA` (`$8b`), immediate `LAX`/`LXA` (`$ab`) and the page-crossing-dependent `AHX`/`TAS`/`SHX`/`SHY` read as **declared unknowns** in the output, never as plausible p-code. The extension is exercised against real code containing illegal opcodes — a cracked or packed release from Phase 23's corpus — not only a synthetic opcode sweep, with the before/after difference in decompiler output recorded.

**Plans**: TBD

Notes:

- **Verdict-gated.** Read Phase 23's recorded verdict before writing any plan here: `docs/phase23-real-release-gate-findings.md`, frontmatter `verdict` (recorded value: **`no-go`**) and `verdict_rule_applied` (**`R1`**).
- **Scope amendment recorded by the verdict (rule `R1`).** `R1` names its own consequence, reproduced rather than re-authored: *"The milestone becomes: secure a corpus first, or re-scope v0.6.0 to a claim explicitly qualified as fixture-only."* That is the whole of the pre-committed narrowing for this verdict. Unlike `R6` and `R7`, `R1` carries **no** pre-mapped per-requirement narrowing, so no `DXA-*`, `GHID-*` or `OPC-*` requirement is narrowed by name. The success criteria above are left **byte-identical** and are qualified by this note rather than rewritten: which branch of `R1` is taken is a scope decision for whoever plans this phase, and it is deliberately not taken here.
- **The single remaining obstacle to a real measurement, named.** Of 23-03's two capture blockers, hex transcription is **solved** — extract the 64K from a VICE `.vsf` snapshot's `C64MEM` module body rather than re-emitting hex through the agent, validated against 23-03's own transcript (`.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`). What remains is **one** thing, not two: the fork's stopping exec checkpoint is not frame-exact, and snapshot-to-snapshot, with no transcription anywhere, the two `danish` runs still diverge at 201 multi-bit addresses. **A frame-exact stop is the single gate** on `R1`'s "secure a corpus first" branch. Neither fact changed the verdict, and neither may be read as though it did.
- **The single most expensive mistake available in this design** is writing the structural-fact export against `DataTypeManager`. Measured on the pivot fixture: `getAllComposites()` and `getDefinedData()` return essentially nothing on 6502, while `DecompInterface` yields the index bound, the split-pointer idiom and the record stride directly. Criterion 4's control exists so this cannot be re-made silently.
- **The volatile block is a correctness requirement of the pre-script, not a tuning option**, and it fails silently — see Standing Constraints. Call `mem.getBlock(addr)` first and `setVolatile(true)` on an existing block rather than creating a conflicting one.
- **Why `OPC-*` stays in this phase rather than becoming its own.** Its verification is not separable. `OPC-03` can only be checked by running the harness `GHID-01` delivers, and `GHID-04`'s acceptance — structural facts recovered from *real cracked code* — is not honestly claimable while 105 opcode bytes are undecodable, because crack and packer code is exactly where that gap bites. Splitting would force Phase 24 to close on a claim its own corpus contradicts and a later phase to reopen it. The phase still groups three ways in planning — discovery, semantic harness, opcode coverage — with the SLEIGH extension sequenced **ahead of** criterion 4's acceptance run, not after it.
- The SLEIGH source already exists in full: `docs/undocumented-opcodes-ghidra.md`, 776 lines, all 105 bytes, with the unstable instructions already modelled as black-box userops and the `@include` layering already written against the `65c02.slaspec` collision. This phase integrates and verifies it; it does not write it from scratch.
- dxa 0.1.5 is 3,417 lines of C, GPLv2+, builds clean with plain `make`, dormant since a 2022-03 tarball, and ships in no Debian package (`dpkg -L xa65` has no `dxa`). Vendor and build; do not assume `$PATH`.
- **Reuse rather than rebuild** (`CUT-02` is Phase 25's, but the reuse decisions are taken here): `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` already decode 6502 including illegal opcodes across 2,555 lines, and `r2000-d64.ts` is 310 standalone lines. Neither is r2000's.
- Ghidra alone, with zero hints, produced **nothing** on the pivot fixture — 0 functions, 0 code bytes. The map from dxa is not an optimisation; it is what makes Ghidra work at all on a headerless 6502 image.

### Phase 25: The Annotation Store and the Cutover

**Status**: **TAKEN FORWARD to v0.7.0** (2026-08-26). This block is the
historical record of how the work was scoped *inside* v0.6.0 and is kept for
that reason; it is **not** the live scope. The live scope is v0.7.0's Phases
27-32, where the Phase 24 engine coupling is dropped, no parity is owed to
regenerator2000, the type vocabulary is corrected from 7 members to **12**, and
the 19,181-line deletion figure below is corrected to a net **~12.4k** of a
25,759-line surface (~12.9k survives under new names). Read the v0.7.0 phase
details, not this block, before planning.

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

- **Verdict-gated** on Phase 23 like everything after it — recorded verdict **`no-go`** (rule **`R1`**) in `docs/phase23-real-release-gate-findings.md`; read its frontmatter `verdict` before writing any plan here.
- **Scope amendment recorded by the verdict (rule `R1`).** `R1`'s consequence is milestone-level — *"secure a corpus first, or re-scope v0.6.0 to a claim explicitly qualified as fixture-only"* — and it carries no pre-mapped narrowing of any `STORE-*` or `CUT-*` requirement. The success criteria above stand **byte-identical** and are not rewritten by this verdict; what the verdict puts in question is whether this phase is reached as scoped at all, which is the milestone decision `R1` hands back.
- The store is `DECOMP-01`'s substrate in v0.7.0, and per-range typing is the part nothing else in the stack records. Type for what v0.7.0 needs now, not for the minimum this milestone happens to exercise — `STORE-01` says so explicitly, and rebuilding the type vocabulary one milestone later is exactly the double-write this milestone's scoping decision exists to avoid.
- **The MCP family registers through `buildViceTool()` and never reaches `forwardToVice()`** — the same structural route the `r2000_*` family used. That is what satisfies CLAUDE.md's derived-tool path-translation constraint *by construction*, with no interception to forget, and it makes the family backend-agnostic for free. Assert it over `package.json`'s `files[]`, the way `hostpath-consumers.test.ts` already does, rather than over a raw directory listing.
- **The removal pattern is the `toacme` one**: a whole-tree grep gate proven to bite on a planted reintroduction, not a documented deletion. That precedent bit on a non-`SKILL.md` file, which is why the gate is whole-tree rather than playbook-scoped.
- `CUT-03`'s blast radius is wider than the install docs: `CLAUDE.md` carries three regenerator2000 constraint bullets, `PROJECT.md` carries constraints, Out-of-Scope entries and Key Decisions rows, `THIRD-PARTY-NOTICES.md` carries the dual-licence notice, and all seven skill playbooks name the route. A skill pointing at a deleted route is worse than one pointing at nothing.
- **Deleting r2000 also deletes what several committed guards read.** `r2000-spawn-seam.test.ts`, `docs-r2000-decisions.test.ts` and `r2000-answer-key.test.ts` — the last reading `.planning/phases/11-*/evidence/` with no existence guard — are pinned to the thing being removed. Plan their fate explicitly; discovering it in a red CI run at the phase gate is the avoidable version of this.
- r2000's own C64 map is 732 labels, names only, no descriptions, and its first line excludes the entire hardware register file. Nothing in the store's machine knowledge comes from it; `memmap.json` (959 entries, 4 published sources) is the source and is already pinned upstream of the enum path by `memmapSha256`.

### Phase 26: Automatic Annotation

**Status**: **HELD** for v0.8.0 (2026-08-26). Same gate as Phase 24 — a
frame-exact emulator stop, which nothing owns. `AUTO-04`/`AUTO-05` remain
**unvalidated rather than narrowed**. Requirements, success criteria and notes
below are left **byte-identical** and are not archived.

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
- **Scope amendment recorded by the verdict (rule `R1`).** The recorded verdict is **`no-go`**, not `degrade`, so the `AUTO-04`/`AUTO-05` narrowing anticipated in the note above **was not triggered**: the pre-mapped narrowings belong to `R6` and `R7`, and under first-match-wins neither was ever evaluated. `AUTO-04` and `AUTO-05` are therefore **unvalidated rather than narrowed** — `PROOF-03`'s criterion was never measured (23-09 was not dispatched for want of the capture substrate, D-03), so no observation exists of where a single forward-carried `$01` value stops being correct, in either direction. Recorded in `docs/phase23-real-release-gate-findings.md`; the success criteria above are left **byte-identical**.
- **All three selection rules fail silently.** Each was got wrong on the first attempt during the pivot exploration, and each produced plausible, confident, wrong comments rather than an error. That is why criteria 2, 3 and 4 each require a control **observed red** without the fix. Against a silent failure mode, a criterion that merely asserts the fix is worthless — this project has been taught the general form of that lesson six times.
- The join's containment for the pipeline's most dangerous failure is `AUTO-07`, not a review step. Graphics bytes decoded as instructions mint phantom labels (`zpp_02`, `zpa_06`, `f_1B1A`) indistinguishable in form from genuine ones; a phantom routine inside a charset gets promoted to a Ghidra function, yields phantom xrefs, feeds the join, and emerges as a confident wrong comment the next pass treats as established.
- The error direction makes graphics regions the worst offender specifically: dxa's errors run the dangerous way (data called code), and graphics regions are the largest single source of them. **Corrected 2026-08-26 by Phase 23 (verification warning W2): this bullet previously stated "dxa scored 0 false positives" as fact, from the pivot's published claim. Phase 23 rebuilt the fixture and re-measured it against a pinned dxa: `FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, and `FIXTURE_REPRODUCED: no` — the pivot's own 72.46%/0-FP figures do not reproduce, because its 141/138 partition is not source-derivable and flattered dxa exactly where the "0 false positives" headline lived** (`docs/phase23-real-release-gate-findings.md`, criterion 1). Criterion 1's re-measurement **on real cracked code** was `could-not-run` — no depacked capture exists — so the apples-to-apples baseline any later phase should quote is 3 FP on the fixture, and there is still **no real-release number at all**.
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
| 23. The Real-Release Gate (Go/Degrade/No-Go) | v0.6.0 | 6/11 | Complete | 2026-08-26 |
| 24. The Two Engines | v0.6.0 | — | Held for v0.8.0 | - |
| 25. The Annotation Store and the Cutover | v0.6.0 | — | Taken forward to v0.7.0 | - |
| 26. Automatic Annotation | v0.6.0 | — | Held for v0.8.0 | - |
| 27. Shared Seams Extracted | v0.7.0 | 5/5 | Complete | 2026-08-27 |
| 28. The Store Core | v0.7.0 | 23/23 | Complete | 2026-08-29 |
| 29. The MCP Surface | v0.7.0 | 21/21 | Complete | 2026-08-30 |
| 30. ACME Export and the Real-ACME Oracle | v0.7.0 | 6/6 | Complete | 2026-08-31 |
| 31. Procedure Re-pointing | v0.7.0 | — | Not started | - |
| 32. The Deletion and the Grep Gate | v0.7.0 | — | Not started | - |

**Milestone roll-up:** v0.2.0 — 9 phases, 87 plans, 51/51 in-scope requirements,
shipped 2026-08-19 (audit round 4 `tech_debt`; 13 deferred items at close).
v0.3.0 — 4 phases, 36 plans, 101 tasks, 12/12 in-scope requirements, shipped
2026-08-21 (audit round 2 `passed`, zero gaps; 19 deferred items at close).
v0.4.0 — 6 phases, 44 plans, 119 tasks, 16/16 requirements, shipped 2026-08-23
(audit round 1 `tech_debt`, zero blockers and zero open gaps; **0** pending
todos at close, 16 bookkeeping items acknowledged). v0.5.0 — 2 executed phases
(18, 19), 27 plans, 61 tasks, 13/27 requirements, shipped 2026-08-25 as
`override_closeout`; Phases 20-22 cut by the dxa+Ghidra pivot with their 14
requirements re-mapped forward, not dropped (they are v0.9.0 as of 2026-08-26).
v0.6.0 — opened 2026-08-25, **closed incomplete 2026-08-26** after 1 of 4 phases:
Phase 23's gate **fired** and recorded **`no-go`** (rule `R1`), six of its eleven
plans executed and five deliberately not dispatched; Phases 24 and 26 are **held**
with live requirement text for v0.8.0 and Phase 25 was **taken forward** as the
whole of v0.7.0. No milestone audit was run, which is a statement rather than an
omission — the gate had already recorded, under three accepted overrides, that the
intent was not delivered, and Phase 23's findings document is the audit of record.
v0.7.0 — opened 2026-08-26, Phases 27-32, **28/28 requirements mapped**
(`SEAM-*`, `STORE-*`, `MCP-*`, `EXPORT-*`, `REPOINT-*`, `CUT-*`), not yet shipped;
it carries **no corpus dependency**, which is why it is reachable while Phase 23's
`no-go` stands. Requirements cut in earlier milestones stay in their own
`milestones/v*-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one is a
scope decision rather than archaeology.

**Phase directories are not archived.** Unlike the roadmap and requirements,
`.planning/phases/` accumulates across milestones by design.
`docs-review-disposition.test.ts` asserts at least 150 review findings read out
of `.planning/phases/` and explicitly excludes `.planning/milestones/`, and
`r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard — archiving them turns both red. Every milestone close therefore
passes `--no-archive-phases`. *As of the v0.7.0 open the count is **five**
committed tests reading live paths under `.planning/phases/`, two of them by
hard-coded relative path to Phase 19's `upstream-procedure-manifest.json` — which
is a **design input** to v0.7.0, not merely a fixture, so the constraint is
stronger now than when it was recorded. **Phase 32** deletes the subject of
`r2000-answer-key.test.ts`; that guard's fate is planned there, not discovered at
a gate, and deleting it must be an explicit recorded choice rather than a side
effect.*

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 shipped and collapsed 2026-08-23 → `milestones/v0.4.0-ROADMAP.md`*
*v0.5.0 shipped and collapsed 2026-08-25 → `milestones/v0.5.0-ROADMAP.md`*
*v0.6.0 roadmap created 2026-08-25 — Phases 23-26, continuing numbering from Phase 22, 32/32 requirements mapped.*
*v0.6.0 closed incomplete 2026-08-26 by its own gate (`no-go`, rule `R1`) and deliberately NOT archived — Phases 24 and 26 are held with live requirement text.*
*v0.7.0 roadmap created 2026-08-26 — Phases 27-32, continuing numbering from Phase 26, 28/28 requirements mapped.*
*Phase numbering is continuous across milestones and never reused, including the cut Phases 20-22, the held Phases 24 and 26, and Phase 25 whose content was taken forward while its number was retired.*
