# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 the external analyser static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ✅ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (shipped 2026-08-23)
- ✅ **v0.5.0 Persistent Session and the Coverage Instrument** — Phases 18-19; 20-22 cut (shipped 2026-08-25)
- 🗄 **v0.6.0 Own the substrate** — Phases 23-26 (CLOSED INCOMPLETE 2026-08-26 by
  its own gate: Phase 23 recorded `no-go`, rule `R1`). Phase 23 shipped;
  **Phases 24 and 26 are HELD** with their requirement text live for v0.8.0;
  **Phase 25 was TAKEN FORWARD** as the whole of v0.7.0

- ✅ **v0.7.0 Own the Annotation Store** — Phases 27-32 (shipped 2026-09-01)
- ✅ **v0.8.0 Frame-Exact Capture and the Two Engines** — Phases 33-38 (opened 2026-09-02, shipped 2026-09-06; `GATE-01` returned `degrade` by rule `R6`)

*v0.8.0 continues phase numbering from Phase 32 — it starts at Phase **33**.
Phase numbers are continuous across milestones and are **never** reused,
including the cut Phases 20-22, the **retired but held** Phases 24 and 26, and
Phase 25 — whose *content* was taken forward into v0.7.0 while its *number* is
retired with v0.6.0.*

*Updated 2026-09-02 at the v0.8.0 open, and the change is a correction rather
than a restatement.* Phases 24 and 26 no longer hold live requirement text.
Their text is carried forward by **Phases 35, 36 and 37**; the requirement
**ids** keep their original numbering so each still traces to
`git show 2421f68:.planning/REQUIREMENTS.md`, while the **phase numbers** 24 and
26 stay retired. The forecast recorded above until today — that the text would
carry forward **byte-identical** — is false for **eleven of the 21 carried
ids** (`DXA-01`, `DXA-02`, `GHID-01`, `GHID-03`, `GHID-04`, `OPC-01`,
`AUTO-04`, `AUTO-05`, `AUTO-07`, `PROOF-01`, `PROOF-03`), each amendment
stating what changed and on what evidence in `.planning/REQUIREMENTS.md`. The
superseded forecast is dated and corrected here, not deleted.

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
  tarball — 11 `the external analyser` mentions and 5 synced `ATTRIBUTION (ABS-02)`
  twins live there today, invisible to `git grep` and to every guard built on it
  (`skill-attribution.test.ts` scans `src/skills/` only, so a sync that drops the
  headers is invisible to it). Any gate whose subject is *what a user gets* must
  read the generated tree or the `npm pack` file list —
  `scripts/check-npm-packages.mjs` is the existing seam — never `git ls-files`.
  The failure runs in the worst direction: the tracked copy is correct, the gate
  is green, and the shipped copy is wrong.

- **A module's delete criterion is what it does, never its name prefix.**
  *(Added at the v0.7.0 open, 2026-08-26.)* `anno-test-gate.ts` is the founding
  instance: two gates in one file, one of which is the **ACME** availability gate
  that `disasm-roundtrip.test.ts`, `skill-acme-build-cli.test.ts` and
  `ci.yml:45-140` bind to by env-var name. A prefix-driven deletion takes it and
  silently degrades the ACME claim from "hard fail if ACME is missing" to
  "skip" — in CI, over a green run. At least ten `anno-*` modules are
  capabilities wearing glue-shaped names: `-test-gate`, `-acme-ident`,
  `-confidence`, `-symbols` (which *implements* the ✓ Validated
  `ANNO-14`/`ANNO-15` symbol round trip), `-verify`, `-memmap-render`, `-d64`,
  `-regbits-gen`, `-enum-gen`, `-coverage`. Classify by behaviour and record the
  classification **before** any deletion, which is the only time the record can
  be trusted; a module whose sole claim to deletion is its prefix is not deleted.

- **An `ATTRIBUTION (ABS-02)` block outlives the code it attributes.** *(Added at
  the v0.7.0 open, 2026-08-26.)* The absorbed prose stays adapted from
  the external analyser after every line of the external analyser *integration* is gone, so
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
  `hostpath-consumers.test.ts` (`ANNO_MODULE_FLOOR`),
  `scripts/check-skill-tool-coverage.mjs` (zero mentions cross-checked against
  zero curated tools passes trivially) and `skill-attribution.test.ts` all have
  this shape. **If you cannot make it fail, you have not re-pointed it.**

- **Launch nondeterminism is real, and the reproducibility key is not the seed
  alone.** *(Added at the v0.8.0 open, 2026-09-02.)* MEASURED against genuine
  stock VICE 3.9 at `/usr/bin/x64sc`: `x64sc` prints a `time()`-derived RAM-init
  seed that differs every launch, and over an untouched `$C000-$CFEF` window
  three cold boots differed at **67 of 4080 bytes** — and at **0** with
  `-seed 4242`. The three `raminit*` flags
  (`-raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0`) took
  three differing 64K images to **one identical sha256**. The failure is silent
  and it is large: worth roughly **1,000 false-divergence addresses per capture
  pair**, which is enough to make two identical runs look genuinely different.
  And the seed alone is not the key — the **same** seed with a reordered argv
  yielded a 76-byte-different image, so a capture record's reproducibility key
  is `(binary sha256, argv digest, seed)`. `buildViceArgs()` emits neither
  `-seed` nor any `raminit*` flag today.

- **A failed `sleigh` build leaves the previous `.sla` in place, so the next run
  goes GREEN on a language that decodes nothing new.** *(Added at the v0.8.0
  open, 2026-09-02.)* MEASURED twice independently against real Ghidra 12.1.3:
  `6502.ldefs` declares only `6502:LE:16:default` and `65C02:LE:16:default`,
  every artifact in this repository names the **stock** language, and a `sleigh`
  run that exits 2 with `ERROR No output produced` does **not** remove the
  pre-shipped `6502.sla`. The following `analyzeHeadless` therefore succeeds,
  decodes none of the 105 undocumented opcode bytes, and reports success. Any
  run this project drives must assert **the language the run log says it used**,
  and any `sleigh` invocation must be gated on exit 0 **and** a produced `.sla`
  **and** an mtime newer than every input. Install an extension as its **own**
  language with a new `.ldefs` `id`, never by editing the base — READ-IN-SOURCE,
  `65c02.slaspec:1` is `@include "6502.slaspec"`, so an in-place edit makes
  `65C02` inherit the illegal bytes rather than avoid them.

- **`analyzeHeadless` exits 0 even when a post-script throws.** *(Added at the
  v0.8.0 open, 2026-09-02.)* Measured in Phase 23's
  `evidence/tools/instrument-provenance.txt` and re-confirmed 2026-09-02: the
  process exit status carries no information about whether the analysis script
  ran, so a harness that trusts it asserts nothing. Grep the run log for the
  **exact literal** `ERROR REPORT SCRIPT ERROR` — a naive `error` / `fail` grep
  false-fires on the flat-64K route's benign `ZERO_PAGE` / `STACK` INFO lines
  and a guard that false-fires gets switched off. Two adjacent measured facts
  belong with it: `analyzeHeadless` refuses a project directory containing a
  **dot-prefixed path element**, so `.planning/...` can never be one, and it
  does not create the project *location* directory.

- **A non-vacuity floor pinned over a module-name prefix is structurally blind
  to a different prefix.** *(Added at the v0.8.0 open, 2026-09-02.)*
  READ-IN-SOURCE: `hostpath-consumers.test.ts`'s floor is
  `const ANNO_MODULE_FLOOR = 16 + 1`, pinned deliberately over the `anno-*`
  prefix under a comment reading *"THE FLOOR MUST NEVER BE DERIVED FROM DISK."*
  A new `ghidra-*` / `dxa-*` family is therefore **outside its scan entirely** —
  adding forty such modules does not move the floor and does not trip it. This
  is the sibling of the constraint above: that one is a floor *lowered* until it
  cannot fail, this one is a floor that was never pointed at the subject at all.
  Two obligations follow. Prefer **not to become a consumer** — put the path
  translation in **one** new declared-consumer module and have the rest of the
  family reach it through that, turning "N new consumers" into "one", which is
  the `anno_*` by-construction precedent. And when a new family lands, **add a
  second floor for its prefix**, pinned as a literal, with a **real**
  unclassified module created on disk as a positive control **observed red** —
  the technique `SEAM-02` used in Phase 27.

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
<summary>✅ v0.3.0 the external analyser static-analysis backend (Phases 9-11, 11.1) — SHIPPED 2026-08-21</summary>

**Delivered:** recon findings stop being prose. The external analyser is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler — reached through **17** curated `anno_*` tools
and a `vice-mcp anno <verb>` CLI, entirely container-side and structurally
incapable of touching VICE. Register writes read as bit names, symbols flow both
ways between the store and a live emulator, and the flat linear `toacme` decoder
it makes obsolete is deleted.

- [x] Phase 9: The Assumption Probe (Go/No-Go) (8/8 plans) — completed 2026-08-20 — verdict `degrade` (rule `R4`), see `docs/phase9-external-analyser-probe-findings.md`
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
18-22). **Delivered** its first half and cut its second: an external analyser
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
The external analyser as the analysis substrate. Measurement on a committed 279-byte
fixture showed anno unannotated flat-decodes, while dxa recovered 72% of data
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

**Goal:** Replace the external analyser as the analysis substrate with dxa + Ghidra and
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
- [ ] **Phase 25: The Annotation Store and the Cutover** - This project owns the annotation state and its ACME export, and 19,181 lines of the external analyser glue are deleted rather than left standing beside their replacement — **TAKEN FORWARD to v0.7.0** 2026-08-26: its goal needs no corpus once the Phase 24 coupling is dropped, so it became Phases 27-32
- [ ] **Phase 26: Automatic Annotation** - Machine addresses annotate themselves, bank-aware, declining rather than guessing where the bank state is path-dependent — **HELD** 2026-08-26 for v0.8.0: same corpus gate as Phase 24; requirement text unchanged

<details>
<summary>✅ v0.7.0 Own the Annotation Store (Phases 27-32) — SHIPPED 2026-09-01</summary>

**Delivered:** this project stopped renting its analysis state. The external analyser
is **deleted** — not deprecated, not wrapped — and `.annostore` replaced it: a
`node:sqlite` store behind one structurally-asserted seam holding labels,
comments, a frozen twelve-member per-range type vocabulary, scopes and project
enums, with durability and revert proven together across a real `SIGKILL` in a
separate OS process. Eighteen `anno_*` tools reach it proxy-locally through
`buildViceTool()`, so the family never touches `forwardToVice()` and is
backend-agnostic by construction. All five absorbed analysis procedures run on
it. ACME source exports from it behind a real-ACME 0.97 byte-diff oracle that is
deliberately test-only. Measured net removal: **6,309 lines** (26,023 pre-phase
at `8f21d77` → 19,714 surviving at `f16d0b1`).

- [x] Phase 27: Shared Seams Extracted (5/5 plans) — completed 2026-08-27
- [x] Phase 28: The Store Core (23/23 plans) — completed 2026-08-29
- [x] Phase 29: The MCP Surface (21/21 plans) — completed 2026-08-30 (**widened by `D-01`**: absorbed the deletion, the grep gate and the procedure re-pointing)
- [x] Phase 30: ACME Export and the Real-ACME Oracle (6/6 plans) — completed 2026-08-31
- [x] Phase 31: Procedure Re-pointing (4/4 plans) — completed 2026-08-31 (**narrowed by `D-01`**)
- [x] Phase 32: The Deletion and the Grep Gate (21/21 plans) — completed 2026-09-01 (**narrowed by `D-01`**)

**Shipped and archived 2026-09-01:** 6 phases, 80 plans, 214 tasks, 28/28
requirements, 7 days, 690 commits, `override_closeout`. **No milestone audit was
run** — every phase carries `verification_status: passed` and the per-phase
`VERIFICATION.md` files are the evidence of record. Two qualifications ship with
it: `STORE-03`'s traceability row contradicts its own prose (Phase 29 routed it
to a verification pass or an audit; this close ran neither), and `ANNO-13` /
`ANNO-14` / `ANNO-15` were withdrawn with the removal and **no phase owns their
return**.

**Full phase details, the two owner decisions taken at the open, the three
resolved research disagreements and the sequencing rationale:**
[`milestones/v0.7.0-ROADMAP.md`](milestones/v0.7.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.7.0-REQUIREMENTS.md`](milestones/v0.7.0-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v0.8.0 Frame-Exact Capture and the Two Engines (Phases 33-38) — SHIPPED 2026-09-06</summary>

**Delivered:** this project stopped measuring a 279-byte synthetic fixture. Two
runs of the same real cracked release stop in the same frame and their 64K
captures compare byte-identically, with the capture sliced out of a VICE `.vsf`
snapshot's `C64MEM` body rather than retyped as hex. On that substrate, two
engines this project vendors and drives itself — dxa 0.1.5 and Ghidra 12.1.3
under an NMOS 6502 SLEIGH language decoding all **105** opcode bytes stock omits
— turn a real release into structural facts that annotate themselves into the
owned store, declining with a reason rather than guessing. Every host binary in
that chain is reached over one typed `host_tool` control op, with every other
route banned by a CI gate observed biting on planted violations.

**`GATE-01` fired and returned `degrade`, by rule `R6`** — derived from five
column-0 outcome lines walked through rules committed at `2a8ef95` before any
measurement, with `could-not-run` structurally unemittable and the one available
override explicitly declined. The frame-exact stop is exact through anchor hit 50
and **lost from hit 75**, because AUTOSTART's power cycle does not reset the
absolute emulated clock. That limit is recorded beside the capability, not behind
it.

- [x] Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) (12/12 plans) — completed 2026-09-03
- [x] Phase 34: The Host-Tool Execution Seam (11/11 plans) — completed 2026-09-04
- [x] Phase 35: dxa, Vendored and Parsed (5/5 plans) — completed 2026-09-04
- [x] Phase 36: The SLEIGH Language and the Ghidra Harness (7/7 plans) — completed 2026-09-05
- [x] Phase 37: The Importer and the Automatic Annotation Join (8/8 plans) — completed 2026-09-05
- [x] Phase 38: PROOF-01..03 on Real Cracked Code (4/4 plans) — completed 2026-09-05

**Shipped and archived 2026-09-06:** 6 phases, 47 plans, 118 tasks, 43/43
requirements, 5 days, `override_closeout`. No milestone audit was run — all six
phases carry `verification_status: passed` and the per-phase `VERIFICATION.md`
files are the evidence of record.

**Three forecasts this milestone carried in were falsified by its own
measurements**, each corrected in place rather than deleted: VICE event
record/replay **does not exist**; `docs/undocumented-opcodes-ghidra.md`'s p-code
**did not compile** (8 failing constructors, one root cause), so `OPC-01` became
fix → compile → integrate → verify; and **eleven of the 21** requirement ids
carried forward from held Phases 24 and 26 were **amended, not byte-identical**.

**Full phase details, the dependency edges, the per-phase guard-breakage
inventory and the sequencing rationale:**
[`milestones/v0.8.0-ROADMAP.md`](milestones/v0.8.0-ROADMAP.md)
**Requirements as shipped:** [`milestones/v0.8.0-REQUIREMENTS.md`](milestones/v0.8.0-REQUIREMENTS.md)

</details>

## v0.6.0 Own the substrate — CLOSED INCOMPLETE (Phase Details)

*v0.6.0's phase details, kept in place rather than archived. Phase 23 is
complete; Phases 24 and 26 are **HELD** with their requirement text live for
v0.8.0, which carried them forward under NEW phase numbers (35, 36, 37);
Phase 25 was **taken forward** and
its live scope is v0.7.0's Phases 27-32, above — not the Phase 25 block below,
which is retained as the historical record of how that work was scoped inside
v0.6.0.*

*Rider added at the v0.8.0 close, 2026-09-06. The forecast above — that the held
text would carry forward **unchanged** — is false for **eleven of the 21 carried
ids** (`DXA-01`, `DXA-02`, `GHID-01`, `GHID-03`, `GHID-04`, `OPC-01`,
`AUTO-04`, `AUTO-05`, `AUTO-07`, `PROOF-01`, `PROOF-03`), each amendment
stating what changed and on what evidence in
[`milestones/v0.8.0-REQUIREMENTS.md`](milestones/v0.8.0-REQUIREMENTS.md). The ids
keep their original numbering, so each still traces to
`git show 2421f68:.planning/REQUIREMENTS.md`; the phase numbers 24 and 26 stay
retired. **All 21 shipped** with v0.8.0 on 2026-09-06. The superseded forecast is
dated and corrected here, not deleted.*

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
- **Dated forward note, 2026-09-02 (the v0.8.0 open).** `PROOF-01`, `PROOF-02` and `PROOF-03` — each recorded `could-not-run` here for want of the depacked capture substrate — are re-owned by **v0.8.0's Phase 38**, with `PROOF-01` and `PROOF-03` **AMENDED**: `PROOF-01` now requires a denominator and positive class on every rate and records that it has **no independent external check** (`memmapshow` is stated ABSENT by owner decision 2026-09-02), and `PROOF-03` is stated **unmeasured in BOTH directions** with the fixture that will measure it named. `PROOF-04` and `PROOF-05` are deliberately **not** carried: both were satisfied by this phase, and v0.8.0's gate requirement is its own `GATE-01` rather than a re-run of `PROOF-05`. The `**Requirements**:` line above is left byte-identical because it records what v0.6.0's Phase 23 owned; a v0.8.0 reader should read `PROOF-01..03` as owned by exactly one v0.8.0 phase, Phase 38.

### Phase 24: The Two Engines

**Status**: **HELD** for v0.8.0 (2026-08-26), then **CARRIED FORWARD and
partly AMENDED** (2026-09-02). Blocked on a frame-exact emulator stop, which
nothing owned at the time. Requirements, success criteria and notes below are
left byte-identical **as the historical record** and are not archived.

**Corrected 2026-09-02 at the v0.8.0 open — two claims above are now false, and
are dated rather than deleted per this project's convention.** (1) *"nothing
here was falsified, only its substrate is missing"* is **false**: `OPC-01`'s
premise was falsified by measurement. The SLEIGH source in
`docs/undocumented-opcodes-ghidra.md` **does not compile** — 8 failing
constructors and `ERROR No output produced`, exit 2, measured twice
independently against real Ghidra 12.1.3 against a clean control compile of
stock `6502.slaspec`. (2) *"v0.8.0 carries them forward unchanged"* is **false**
for six of this block's eleven ids: `DXA-01`, `DXA-02`, `GHID-01`, `GHID-03`,
`GHID-04` and `OPC-01` are **amended**, each with its evidence, in
`.planning/REQUIREMENTS.md`. The live scope is **Phase 35** (`DXA-*`) and
**Phase 36** (`GHID-*`, `OPC-*`) — read those, not this block, before planning.
This block's requirement **ids** keep their numbering, so each still traces to
`git show 2421f68:.planning/REQUIREMENTS.md`; the phase **number** 24 stays
retired and is never reused.

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
- The SLEIGH source already exists in full: `docs/undocumented-opcodes-ghidra.md`, 766 lines, all 105 bytes, with the unstable instructions already modelled as black-box userops and the `@include` layering already written against the `65c02.slaspec` collision. This phase integrates and verifies it; it does not write it from scratch.
- dxa 0.1.5 is 3,417 lines of C, GPLv2+, builds clean with plain `make`, dormant since a 2022-03 tarball, and ships in no Debian package (`dpkg -L xa65` has no `dxa`). Vendor and build; do not assume `$PATH`.
- **Reuse rather than rebuild** (`CUT-02` is Phase 25's, but the reuse decisions are taken here): `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts` already decode 6502 including illegal opcodes across 2,555 lines, and `anno-d64.ts` is 310 standalone lines. Neither is anno's.
- Ghidra alone, with zero hints, produced **nothing** on the pivot fixture — 0 functions, 0 code bytes. The map from dxa is not an optimisation; it is what makes Ghidra work at all on a headerless 6502 image.
- **Dated forward note, 2026-09-02 (the v0.8.0 open): this block is now purely the historical record, and its requirement text is live elsewhere.** Phase 24's eleven requirement ids carry forward into v0.8.0 — `DXA-01`, `DXA-02` and `DXA-03` into **Phase 35**; `GHID-01`..`GHID-05` and `OPC-01`..`OPC-03` into **Phase 36** — joined there by two ids this milestone adds, `DXA-04` and `OPC-04`. The ids keep their original numbering so each still traces to `git show 2421f68:.planning/REQUIREMENTS.md`; the **phase number 24 stays retired** and is never reused. **The promise in the Status block above — that this text carries forward byte-identical — is corrected rather than deleted: six of these eleven ids are AMENDED** (`DXA-01`, `DXA-02`, `GHID-01`, `GHID-03`, `GHID-04`, `OPC-01`), part of **eleven amendments across the 21 carried ids**, each stating what changed and on what evidence in `.planning/REQUIREMENTS.md`. The success criteria above are left byte-identical and are **superseded** by Phases 35 and 36 rather than edited in place.
- **Two premises in this block are FALSIFIED, and are corrected here rather than erased.** First, the note above claiming the SLEIGH source *"already exists in full … this phase integrates and verifies it; it does not write it"* is false as a compile claim: MEASURED twice independently on 2026-09-02 against real Ghidra 12.1.3's `support/sleigh`, `docs/undocumented-opcodes-ghidra.md` produces **8 failing constructors** and `ERROR No output produced`, exit 2, against a clean control compile of stock `6502.slaspec` in the same scratch directory. The `@include` layering is sound; the p-code is not. One root cause for all eight — an unsized value where SLEIGH needs an explicit size — and the fix is verified, so `OPC-01` is now *fix → compile → integrate → verify*. Second, "**a frame-exact stop is the single gate**" understates it: MEASURED host inventory 2026-09-02, **two** prerequisites were unowned, not one — dxa is not installed anywhere on this host and Ghidra 12.1.3 exists only as an unpinned out-of-tree probe unpack at `/home/henrik/dev/_ghidra-probe/`, neither vendored nor on `$PATH`.

### Phase 25: The Annotation Store and the Cutover

**Status**: **TAKEN FORWARD to v0.7.0** (2026-08-26). This block is the
historical record of how the work was scoped *inside* v0.6.0 and is kept for
that reason; it is **not** the live scope. The live scope is v0.7.0's Phases
27-32, where the Phase 24 engine coupling is dropped, no parity is owed to
The external analyser, the type vocabulary is corrected from 7 members to **12**, and
the 19,181-line deletion figure below is corrected to a net **~12.4k** of a
25,759-line surface (~12.9k survives under new names). Read the v0.7.0 phase
details, not this block, before planning.

**Goal**: This project owns the annotation state — labels, comments, per-range
typing, scopes, enums, undo, persistence — reached through its own MCP surface
and exported as ACME a real assembler accepts, and the 19,181 lines of
The external analyser integration glue are deleted rather than left standing beside
their replacement.
**Depends on**: Phase 24 — the store's typed decode and cross-references are populated from the engines' output, and nothing may delete anno before a replacement demonstrably produces the same facts. Verdict-gated on Phase 23
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, CUT-01, CUT-02, CUT-03
**Success Criteria** (what must be TRUE):

  1. A caller creates and queries labels, comments, per-range data typing (code, byte, word, address, PETSCII, screencode, table), scopes and project enums through MCP tools **this project owns**, declared in `capability-registry.ts` and advertised identically on the stock and fork manifests. The family registers proxy-locally and never reaches `forwardToVice()`, so backend-agnosticism is structural rather than tested once per backend — asserted over the shipped module set, not by a hand-maintained list.
  2. **Durability is proven by planted violation, not by a passing happy path.** An edit is undoable, and a mutate → kill → reopen → read sequence returns the mutation; removing the save makes that same test go **red**, observed rather than assumed.
  3. The capability `ANNO-11` shipped survives the substrate swap: *which addresses reference this address*, and search across labels, comments and instructions, are still answerable — against a program analysed by the new engines, with the old route gone rather than kept as a fallback.
  4. Exported ACME **reassembles under a real ACME** through the `--verify` seam that keys strictly on ACME's own result line, and both carried idioms are load-bearing in that reassembly: a self-modifying write target named by the `=*+$01` mid-instruction label reassembles byte-identically, and typed label prefixes carry the inferred type. Proven by the assembler, never by a string match on the exporter's own output — this project's own record is that an internally-checked opcode table still shipped 14 wrong entries.
  5. The removal is real and stays removed: 19,181 lines of glue (9,087 non-test + 9,928 test) deleted, with a whole-tree grep gate **observed biting** on a planted reintroduction; every living document naming the external analyser as a required prerequisite corrected — install documentation, `CLAUDE.md`'s constraints, all seven skill playbooks — and what survives (`disasm-*.ts`, `anno-d64.ts`, `memmap.json` with `anno-regbits-gen.ts` and `anno-enum-gen.ts`) reused under names that no longer say `anno`.

**Plans**: TBD

Notes:

- **Verdict-gated** on Phase 23 like everything after it — recorded verdict **`no-go`** (rule **`R1`**) in `docs/phase23-real-release-gate-findings.md`; read its frontmatter `verdict` before writing any plan here.
- **Scope amendment recorded by the verdict (rule `R1`).** `R1`'s consequence is milestone-level — *"secure a corpus first, or re-scope v0.6.0 to a claim explicitly qualified as fixture-only"* — and it carries no pre-mapped narrowing of any `STORE-*` or `CUT-*` requirement. The success criteria above stand **byte-identical** and are not rewritten by this verdict; what the verdict puts in question is whether this phase is reached as scoped at all, which is the milestone decision `R1` hands back.
- The store is `DECOMP-01`'s substrate in v0.7.0, and per-range typing is the part nothing else in the stack records. Type for what v0.7.0 needs now, not for the minimum this milestone happens to exercise — `STORE-01` says so explicitly, and rebuilding the type vocabulary one milestone later is exactly the double-write this milestone's scoping decision exists to avoid.
- **The MCP family registers through `buildViceTool()` and never reaches `forwardToVice()`** — the same structural route the `anno_*` family used. That is what satisfies CLAUDE.md's derived-tool path-translation constraint *by construction*, with no interception to forget, and it makes the family backend-agnostic for free. Assert it over `package.json`'s `files[]`, the way `hostpath-consumers.test.ts` already does, rather than over a raw directory listing.
- **The removal pattern is the `toacme` one**: a whole-tree grep gate proven to bite on a planted reintroduction, not a documented deletion. That precedent bit on a non-`SKILL.md` file, which is why the gate is whole-tree rather than playbook-scoped.
- `CUT-03`'s blast radius is wider than the install docs: `CLAUDE.md` carries three the external analyser constraint bullets, `PROJECT.md` carries constraints, Out-of-Scope entries and Key Decisions rows, `THIRD-PARTY-NOTICES.md` carries the dual-licence notice, and all seven skill playbooks name the route. A skill pointing at a deleted route is worse than one pointing at nothing.
- **Deleting anno also deletes what several committed guards read.** `spawn-seam.test.ts`, `docs-absorbed-decisions.test.ts` and `absorbed-answer-key.test.ts` — the last reading `.planning/phases/11-*/evidence/` with no existence guard — are pinned to the thing being removed. Plan their fate explicitly; discovering it in a red CI run at the phase gate is the avoidable version of this.
- anno's own C64 map is 732 labels, names only, no descriptions, and its first line excludes the entire hardware register file. Nothing in the store's machine knowledge comes from it; `memmap.json` (959 entries, 4 published sources) is the source and is already pinned upstream of the enum path by `memmapSha256`.

### Phase 26: Automatic Annotation

**Status**: **HELD** for v0.8.0 (2026-08-26), then **CARRIED FORWARD and
partly AMENDED** (2026-09-02). Same gate as Phase 24 — a frame-exact emulator
stop, which nothing owned at the time. `AUTO-04`/`AUTO-05` remain **unvalidated
rather than narrowed**. Requirements, success criteria and notes below are left
byte-identical **as the historical record** and are not archived.

**Corrected 2026-09-02 at the v0.8.0 open.** *"byte-identical"* no longer
describes the carry-forward: `AUTO-04`, `AUTO-05` and `AUTO-07` are **amended**
in `.planning/REQUIREMENTS.md`, and a new `AUTO-08` joins them. Two amendments
matter to anyone reading this block for scope. (1) `AUTO-04` now requires a
**synthetic two-caller path-dependent `$01` fixture built as an early task** —
measured: the existing `bank.a` fixture has **no path-dependent site**, so *"the
join declines on the fixture"* was never a usable control. (2) The
`memmapshow` external oracle this block's criterion 4 leaned on is **stated
absent** by owner decision, so `AUTO-04` rests on that synthetic fixture alone.
The live scope is **Phase 37** — read it, not this block, before planning. The
requirement **ids** keep their numbering; the phase **number** 26 stays retired.

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
- **Dated forward note, 2026-09-02 (the v0.8.0 open): this block is now purely the historical record, and its requirement text is live elsewhere.** Phase 26's seven requirement ids — `AUTO-01`..`AUTO-07` — carry forward into **v0.8.0's Phase 37**, joined there by `AUTO-08` (`memmapSha256` provenance on every derived row) and by the two new importer ids `IMP-01` / `IMP-02`. The ids keep their original numbering so each still traces to `git show 2421f68:.planning/REQUIREMENTS.md`; the **phase number 26 stays retired** and is never reused. **The promise in the Status block above — that this text carries forward byte-identical — is corrected rather than deleted: three of these seven ids are AMENDED** (`AUTO-04`, `AUTO-05`, `AUTO-07`), part of **eleven amendments across the 21 carried ids**, each with its evidence in `.planning/REQUIREMENTS.md`. The success criteria above are left byte-identical and are **superseded** by Phase 37 rather than edited in place.
- **What changed substantively in the three amendments, stated so a reader does not have to diff.** `AUTO-04` and `AUTO-05` stay **unvalidated rather than narrowed** — `R1` fired under first-match-wins at Phase 23, so `R7`'s pre-mapped narrowing was never evaluated, and the note above anticipating that narrowing describes something that did not happen. `AUTO-04` now additionally requires a **synthetic two-caller path-dependent `$01` fixture built as an early task**: MEASURED, the existing `bank.a` fixture has no path-dependent site, so "the join declines on the fixture" is not a usable control. Its `memmapshow` external check is **stated ABSENT** by owner decision 2026-09-02, so the requirement rests on that synthetic fixture alone. And `AUTO-07`'s before/after ordering must now be **exercised** — phantom labels shown present before the feedback and absent after — not merely built.

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
and `CUT-02`'s reuse decisions (`disasm-*.ts`, `anno-d64.ts`, `memmap.json`
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
| 31. Procedure Re-pointing | v0.7.0 | 4/4 | Complete | 2026-08-31 |
| 32. The Deletion and the Grep Gate | v0.7.0 | 21/21 | Complete | 2026-09-01 |
| 33. The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) | v0.8.0 | 12/12 | Complete | 2026-09-03 |
| 34. The Host-Tool Execution Seam | v0.8.0 | 11/11 | Complete | 2026-09-04 |
| 35. dxa, Vendored and Parsed | v0.8.0 | 5/5 | Complete | 2026-09-04 |
| 36. The SLEIGH Language and the Ghidra Harness | v0.8.0 | 7/7 | Complete | 2026-09-05 |
| 37. The Importer and the Automatic Annotation Join | v0.8.0 | 8/8 | Complete | 2026-09-05 |
| 38. PROOF-01..03 on Real Cracked Code | v0.8.0 | 4/4 | Complete | 2026-09-05 |

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
v0.7.0 — 6 phases (27-32), 80 plans, 214 tasks, 28/28 requirements, shipped
2026-09-01 as `override_closeout`; no milestone audit run, all six phases
`verification_status: passed`; 15 items newly acknowledged and 8 disclosed as
un-acknowledgeable at close.
v0.7.0 — opened 2026-08-26, Phases 27-32, **28/28 requirements mapped**
(`SEAM-*`, `STORE-*`, `MCP-*`, `EXPORT-*`, `REPOINT-*`, `CUT-*`), not yet shipped;
it carries **no corpus dependency**, which is why it is reachable while Phase 23's
`no-go` stands. Requirements cut in earlier milestones stay in their own
`milestones/v*-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one is a
scope decision rather than archaeology. v0.8.0 — 6 phases (33-38), 47 plans, 118 tasks,
43/43 requirements, shipped 2026-09-06 as `override_closeout`; `GATE-01`
returned **`degrade`** by rule `R6`; no milestone audit run (fourth
consecutive close without one); 4 items newly acknowledged, 31 carried forward,
and the same 8 Phase 23 evidence-table rows disclosed-but-unsuppressable for the
second close running.

**Phase directories are not archived.** Unlike the roadmap and requirements,
`.planning/phases/` accumulates across milestones by design.
`docs-review-disposition.test.ts` asserts at least 150 review findings read out
of `.planning/phases/` and explicitly excludes `.planning/milestones/`, and
`absorbed-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard — archiving them turns both red. Every milestone close therefore
passes `--no-archive-phases`. *As of the v0.7.0 open the count is **five**
committed tests reading live paths under `.planning/phases/`, two of them by
hard-coded relative path to Phase 19's `upstream-procedure-manifest.json` — which
is a **design input** to v0.7.0, not merely a fixture, so the constraint is
stronger now than when it was recorded. **Phase 32** deletes the subject of
`absorbed-answer-key.test.ts`; that guard's fate is planned there, not discovered at
a gate, and deleting it must be an explicit recorded choice rather than a side
effect.*

**Measured at the v0.7.0 close, 2026-09-01 — the constraint is real and is now
quantified.** Phases 27-32 were archived to `milestones/v0.7.0-phases/` at this
close and the result was measured rather than predicted: `audit-integrity.test.ts`
reported **nine** red `docs-*` guards (`docs-absorbed-decisions`,
`docs-core-value-decision`, `docs-dangling-refs`, `docs-deferred-ledger`,
`docs-fork-decision`, `docs-linerefs`, `docs-review-disposition`,
`docs-uat-abstention`, `docs-worktree-isolation`), plus `check-guard-fates.mjs`
failing on an absent `32-*/guard-fates.json`, `anno-register.test.ts`'s
basis-integrity direction failing on a cited consumer path
(`28-the-store-core/28-REVIEW.md`) that no longer existed, and `acme-verify.test.ts`
losing its Phase 29 fixtures — 9 failing tests across 5 files against this
project's 0-failure floor. **The directories were restored** and the suite
returned to its floor. The blast radius is therefore not "two guards" as first
recorded but **at least twelve consumers**, several of them the audit instruments
themselves — which is why teaching them to read the archive is scoped work for a
phase, not a step inside a close.

*Two adjacent consumers WERE fixed at this close, because the close mandates the
operations that broke them rather than merely permitting one.* `git rm`ing
`REQUIREMENTS.md` and collapsing `ROADMAP.md` are required steps, and they
reddened 6 tests across three files. Both now prefer the live document and fall
back to the newest `milestones/v*-` archive, throwing rather than returning a
smaller set when neither carries the subject: `anno-register.test.ts`'s
DIRECTION 5 membership check (plus `anno-register.ts`'s `anno_search` consumer
citation, re-pointed to the archived path) and `check-guard-fates.mjs`'s set-C
parse of `### Phase 32`. That is the same fallback shape the phase-directory
consumers need — it is now demonstrated to work, which lowers the cost of the
scoped work above rather than doing it.

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 shipped and collapsed 2026-08-23 → `milestones/v0.4.0-ROADMAP.md`*
*v0.5.0 shipped and collapsed 2026-08-25 → `milestones/v0.5.0-ROADMAP.md`*
*v0.6.0 roadmap created 2026-08-25 — Phases 23-26, continuing numbering from Phase 22, 32/32 requirements mapped.*
*v0.6.0 closed incomplete 2026-08-26 by its own gate (`no-go`, rule `R1`) and deliberately NOT archived — Phases 24 and 26 are held with live requirement text.*
*v0.7.0 roadmap created 2026-08-26 — Phases 27-32, continuing numbering from Phase 26, 28/28 requirements mapped.*
*v0.7.0 shipped and collapsed 2026-09-01 → `milestones/v0.7.0-ROADMAP.md`. Phase directories restored to `.planning/phases/` after archival was measured to redden 9 tests across 5 files — see the Progress note above.*
*v0.8.0 shipped and collapsed 2026-09-06 → `milestones/v0.8.0-ROADMAP.md`. Phase directories again NOT archived (`--no-archive-phases`), per the standing v0.4.0 decision — `docs-review-disposition.test.ts` and `absorbed-answer-key.test.ts` both read `.planning/phases/` directly.*
*Phase numbering is continuous across milestones and never reused, including the cut Phases 20-22, the held Phases 24 and 26, and Phase 25 whose content was taken forward while its number was retired.*
