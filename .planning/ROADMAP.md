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
- 🚧 **v0.8.0 Frame-Exact Capture and the Two Engines** — Phases 33-38 (opened 2026-09-02)

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

### 🚧 v0.8.0 Frame-Exact Capture and the Two Engines (Phases 33-38)

**Goal:** A frame-exact emulator stop makes a real depacked capture
reproducible, and dxa + Ghidra headless then turn a real cracked release — not a
279-byte synthetic fixture — into machine-readable facts that annotate
themselves into the owned store.

**43 requirements, all mapped, each to exactly one phase** — `REPRO-01..05`,
`CAP-01..04`, `GATE-01`, `SEAM-01..07`, `DXA-01..04`, `GHID-01..05`,
`OPC-01..04`, `IMP-01..02`, `AUTO-01..08`, `PROOF-01..03`. Cross-checked
mechanically against the per-phase `**Requirements**:` lines rather than by eye,
because this project has a recorded history of a requirement owned by two phases
or by none.

- [x] **Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go)** - Launch nondeterminism pinned, a frame-exact stop that is a protocol rather than a mechanism, and a snapshot-sliced flat 64K — behind go / degrade / no-go rules committed to git before any measurement exists (completed 2026-09-03)
- [ ] **Phase 34: The Host-Tool Execution Seam** - Host binaries reached over a typed namespaced control op on the existing broker socket, with the two existing skill-script violations migrated so the ban on them can be written at all
- [ ] **Phase 35: dxa, Vendored and Parsed** - A raw C64 image in and a machine-readable code/data map out, from a dxa this project vendors and builds at a pinned version, behind a parser that refuses by name
- [ ] **Phase 36: The SLEIGH Language and the Ghidra Harness** - All 105 undocumented opcode bytes decodable under their own Ghidra language, and structural facts recovered through `DecompInterface` with hardware writes surviving the decompiler
- [ ] **Phase 37: The Importer and the Automatic Annotation Join** - Machine addresses annotate themselves into the owned store with no agent, no queue walk and no skill in the loop — declining with a reason rather than guessing
- [ ] **Phase 38: PROOF-01..03 on Real Cracked Code** - The three measurements Phase 23 recorded `could-not-run`, taken on real cracked releases and stated beside the fixture figures rather than replacing them

**Phase details, the dependency edges, the per-phase guard-breakage inventory
and the sequencing rationale** are in the two v0.8.0 sections below, placed
after v0.6.0's for the window-slicing reason recorded there.

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

## v0.8.0 Frame-Exact Capture and the Two Engines (Phase Details)

*v0.8.0's phase details, placed **after** v0.6.0's for the same measured reason
recorded above: `extractCurrentMilestoneScoped()` slices a milestone's window
from its summary heading to the next version-bearing heading, skipping
`Phase`-shaped headings on the way, and it locates a milestone's detail block by
a `(Phase Details)` heading at or after that window's end. A v0.8.0 detail block
placed between v0.6.0's summary and its `(Phase Details)` heading would fall
inside v0.6.0's window instead. Do not reorder these sections.*

### Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go)

**Goal**: Two runs of the same real cracked release stop in the same frame and
their 64K captures compare as equivalent, produced without a transcription step
anywhere — and a recorded verdict, against rules committed to git before any
measurement exists, says whether v0.8.0 proceeds as scoped, narrows, or is
reconsidered.
**Depends on**: Nothing (first phase of v0.8.0; runs against the stock backend and needs no v0.7.0 artifact). Its own two halves are parallel — the snapshot slicer touches no emulator and is independent of the stop
**Requirements**: REPRO-01, REPRO-02, REPRO-03, REPRO-04, REPRO-05, CAP-01, CAP-02, CAP-03, CAP-04, GATE-01
**Success Criteria** (what must be TRUE):

  1. **Launch nondeterminism is proven pinned by divergence, not by a flag's presence.** Two cold boots of the same release without `-seed` and without the three `raminit*` flags differ over an untouched window — that observation recorded as a committed transcript, red — and with them, **zero** addresses differ. The block is emitted after `-default` on the **stock branch only**, with the fork branch's argv left byte-identical. Every capture carries a record whose reproducibility key is `(binary sha256, argv digest, seed)` and **not** the seed alone, because the same seed with a reordered argv was MEASURED to yield a 76-byte-different image. **OUTCOME 2026-09-02 — MET.** `SEED_EFFECT: pinned` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro01-determinism.md`: the untouched `$C000-$CFEF` window (4080 addresses) differs at **57** addresses without the determinism block and at **0** with it, so both halves of the declared derivation are satisfied and the with-block zero means something. `NOSEED_DIFF_TOTAL_64K 1028` / `BLOCK_DIFF_TOTAL_64K 0` are recorded beside them as the audit trail and never gate. The block is emitted on the stock branch only and the fork argv is byte-identical. Carried limit: the block is **unconditional** on stock, so all **five** whole-argv assertions moved with `profile` absent — see the guards note's superseded rider below.
  2. **The reset step inside the protocol is proven load-bearing.** The reproducible-run protocol is one **named single-seam procedure** reached through an optional argument on `vice_run_until` rather than as a second route a caller can forget; two runs with deliberate pre-protocol jitter stop identically under it; and a committed control that removes the monitor-issued hard reset from that same procedure produces **differing stop phases, observed red**. The MEASURED baseline it must reproduce: jitter of 0 / 1500 / 4000 ms stopped byte-identically while the pre-reset state spanned 6.7M cycles. **OUTCOME 2026-09-02 — MET.** `JITTER_IMMUNITY: immune` and `RESET_REMOVED_CONTROL: red`, both at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro02-reset-removed.md`: one distinct 64K sha256 and `TRIPLE_PAIRWISE_DIFF_TOTAL 0` across the 0 / 1500 / 4000 ms triple with all four stop-identity terms identical, against **three** distinct sha256 values and differing `line`/`cycle` on every pair once the reset is removed. Carried limit, recorded rather than glossed: the triple was taken at the KERNAL `READY` prompt with **no corpus**, because `runReproducible()` provably cannot serve an autostarted release (its hard `RESET` undoes `AUTOSTART`) and `JITTER_IMMUNITY` is declared corpus-free. A method control caught a **false `no-go`** here: a checkpoint halt placed before the reset leaves the VIC-II mid-frame and turned `immune` into `not-immune`.
  3. **The frame term of the stop-identity oracle is proven necessary rather than argued.** Two stops are certified identical by the triple `(PC, hit_count, (LIN, CYC))` and by nothing else, with a frame-anchor checkpoint on a once-per-frame site supplying the frame term — and a committed control shows `(LIN, CYC)` **alone PASSING** on two stops exactly one frame apart, so the anchor's necessity is *observed*, not asserted. The main-CPU memspace assertion is proven able to refuse: a drive checkpoint hit contaminates `default_memspace` and the assertion is observed refusing after one. The captured 64K is **structurally barred** from being a conjunct of this oracle, asserted so the next edit cannot reintroduce the circularity. **OUTCOME 2026-09-02 — PARTLY MET, and this is the criterion that fired the gate.** `ORACLE_NECESSITY: unproven` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro03-frame-anchor.md`: on the `$ea31` anchor a pair **exactly one frame apart** is unbuildable — a 60 Hz KERNAL IRQ against a 50.125 Hz PAL frame, measured as 240 anchor hits producing 240 distinct `(LIN, CYC)` with 0 consecutive repeats — and the smallest reachable equal-raster separation on this build is 2 frames. A variant control at a raster-conditioned probe point (`$e5d4`, `(RL == $f0)`) **does** show `(LIN, CYC)` alone PASSING on two stops whose sliced images differ at 3 bytes, with the shipped four-term oracle separating them naming `hitCount` — but at an *integral*, not a *one*, frame separation, so the declared derivation yields `unproven`. This fires `R6 → degrade`. The memspace half IS met — `MEMSPACE_ASSERTION: refuses` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-memspace-refusal.md` — but on the `@bank:`-condition symptom **alone**: a memspace-less `ADVANCE_INSTRUCTIONS` still stepped the main CPU after contamination, contradicting `P10`'s first symptom. The `CAP-03` structural bar is met by two assertions (import and parameter type); a caller passing a **derived scalar** into `compareStopIdentity()` is forbidden in prose only.
  4. **A depacked flat 64K image comes out of a snapshot slice with no transcription step anywhere, and the equivalence predicate is proven able to fail.** The image is the `C64MEM` module body (4 bytes of port/PLA state, then 65536 bytes of RAM). A byte planted **outside** the enumerated transient allow-list fails the comparison, observed red; the allow-list is enumerated rather than range-shaped, under a committed size cap, and re-derived per release with the *method* carried forward rather than any address set; and the `$0000`/`$0001` 6510-port overlay is normalised **in code**, never in a reader's head. **OUTCOME 2026-09-02 — MET.** `SLICER: validated` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-slicer-validation.md`, with both declared transcripts appended (`vsf-slice.test.ts` 34/34 `fail 0`; `capture-predicate.test.ts capture-seam.test.ts` 39/39 `fail 0`). The allow-list is enumerated and under its cap — `TRANSIENT_COUNT: 49` against 64 at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-transient-derivation.md`, so `DERIVATION: void` is absent — and a one-bit flip planted at `$C000`, outside the 49 addresses, fails the same comparison, so the list is not vacuous. Carried limit: the union straddles the cap — 48 of the 49 come from one pairing and `33-03` measured **66**, over the cap, for the nominally corresponding comparison on a directly launched instance, so the earlier claim that frame anchoring always fits the cap is **withdrawn**. Two decisions were falsified by measurement here (`D-21`'s `4 + 65536` body length, measured 65555 at snapshot minor 1; `D-24`'s prefix-over-RAM overlay, the values living in the 3-byte suffix) and both carry dated riders in `33-CONTEXT.md`.
  5. **A machine-readable go / degrade / no-go verdict is recorded against rules committed to git before any measurement exists, with no judgement step** — and it **cannot** return `could-not-run` for want of a capture, because its `go` inputs include the protocol's jitter-immunity and the seed's effect, both measurable before a corpus exists. The phase's opening measurement is the binary-monitor re-instrumentation probe on an **autostarted** real release with true drive emulation in the loop, with the wall-clock-anchoring negative control **observed red** (MEASURED to reproduce the original failure: same instruction, `LIN` 116 / 223 / 267) and the warp-invalidated wall-clock bracket observed timing out spuriously. A real release is captured twice and the pair satisfies criterion 4's predicate; a shortfall is a named **gate input**, never a silent omission. Warp and headless are **additive** launch knobs a run can request, not a whole-argv override, with `-default` still at index 0 ahead of `-binarymonitor`. **OUTCOME 2026-09-02 — MET, with one named shortfall in this criterion's own wording.** The verdict is `degrade`, fired by `R6`, recorded as machine-readable frontmatter in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md) against rules committed at `2a8ef95` — still the only commit reachable from itself that touches the phase evidence directory, re-asserted after every measurement landed. `could-not-run` was **structurally unavailable**: `R9` carries no antecedent and the rule set is total over all 108 tuples. The opening measurement ran on an autostarted real release with true drive emulation in the loop (`AUTOSTART_SEQUENCE: S3` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-autostart-sequencing.md`) and the release was captured twice with the pair satisfying criterion 4's predicate (`C0_CAPTURE_PAIR: pass` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-capture-pair.md`). Both wall-clock controls are red (`WALLCLOCK_CONTROL: red`, `WARP_BRACKET_CONTROL: red` at column 0 of `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-wallclock-control.md`). **The shortfall:** `WARP_BRACKET_CONTROL` is red by a **stop outside the intended region** (1.76× overshoot on an identical 10 s bracket), NOT by the *spurious timeout* this criterion names — the timeout instance came out `not-red` and was reported rather than discarded, because `AUTOSTART` owns warp during the load whatever argv says and `-warp` is worth only ~1.97× on this host. Also recorded honestly: `AUTOSTART_FRAME_EXACT: not-achieved` (frame-exact through anchor hit 50, lost from 75, the 1541's rotational phase riding the un-reset absolute clock) and `CAPTURE_FRAME_EXACT: no` beside the `pass`. Read that `pass` for what it supports: the allow-list was derived from three runs two of which ARE the pair, so all discriminating power sits in the cap.

**Plans**: 12 plans in 7 waves, all twelve executed and none deliberately withheld — `33-01` the pre-committed decision rules (nothing else, git order is the proof); `33-02` the research reconciliation and the suite-baseline repair; `33-03` the live autostart-sequencing probe with the wall-clock and warp-bracket controls; `33-04` the `.vsf` `C64MEM` slicer; `33-05` the determinism block, the launch-knob argv and the re-grounded warp sentence; `33-06` the control-plane launch profile and warm-instance eligibility; `33-07` the equivalence predicate, the stop-identity oracle and `CAP-03`'s structural bar; `33-08` the allow-list derivation method and the three-field reproducibility key; `33-09` `runReproducible()` and the two optional `vice_run_until` arguments; `33-10` the real release captured twice, the derivation on it, and the memspace refusal; `33-11` the three remaining observed-red controls and the `probeReady` re-check; `33-12` the verdict, its downstream binding and the folded-todo ledger. The two halves run concurrently: `33-04` / `33-07` / `33-08` (the emulator-free capture substrate) are independent of the stop, and `33-01` lands before every measuring plan by construction.

Plans:
**Wave 1**

- [x] 33-01-PLAN.md — GATE-01: the pre-committed go/degrade/no-go decision rules, schema and evidence conventions
- [x] 33-02-PLAN.md — reconcile the three falsified decisions; repair one root cause of the known-red suite baseline

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 33-03-PLAN.md — CAP-04's opening measurement: the autostarted anchor-counted sequence, plus the wall-clock and warp-bracket controls red
- [x] 33-04-PLAN.md — CAP-01: the strict `.vsf` module-table walk and `C64MEM` slice, with its refusal fixtures and skill route
- [x] 33-05-PLAN.md — REPRO-01/REPRO-05: the stock determinism block, `-console`/`-warp` argv, and the re-grounded warp sentence

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 33-06-PLAN.md — REPRO-05: the additive acquire `profile` and the warm-instance eligibility rule
- [x] 33-07-PLAN.md — CAP-02/CAP-03/REPRO-03: the equivalence predicate, the stop-identity oracle, and the structural bar

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 33-08-PLAN.md — REPRO-04/CAP-02: the N>=3 allow-list derivation under a voiding cap, and the three-field reproducibility key
- [x] 33-09-PLAN.md — REPRO-02/REPRO-03: `runReproducible()` behind one optional argument, refusing without a frame anchor

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 33-10-PLAN.md — CAP-04: a real release captured twice, the derivation on it, and the memspace assertion observed refusing

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 33-11-PLAN.md — the three remaining observed-red controls, and `probeReady` re-checked under warp and console

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 33-12-PLAN.md — GATE-01: the recorded verdict, its binding on Phases 34-38, and the folded-todo ledger

Notes:

- **The gate is a phase and not a criterion inside one, for the third time in this project — and this time its input domain is different.** Phase 9's `R4` fired and returned `degrade`; Phase 23's `R1` fired and returned `no-go` five plans before the measurement it gates existed. Both were correct. But Phase 23 *could* return `could-not-run` because every one of its inputs needed a corpus. `GATE-01`'s `go` inputs are measurable **before** any corpus exists, so this gate must not be written in a way that lets it abstain: record `CAP-04`'s outcome as a gate **input**, never as a precondition for producing a verdict. Write the rules while the answers are still unknown — a rule written after the measurement makes every future gate advisory.
- **The opening task is a measurement, not an implementation.** Every probe behind `REPRO-*` ran at the KERNAL `READY` prompt over the **now-excluded** text channel, so the recipe is **PARTLY UNVERIFIED** until re-instrumented over `-binarymonitor` on an autostarted real release. That is `CAP-04`, and it is the first real measurement of the milestone. Two untested preconditions ride with it and are *probes inside this phase* rather than a research pass: autostart determinism with true drive emulation in the loop, and whether the transient allow-list method holds on a real release.
- **The two halves of this phase are parallel.** The `.vsf` `C64MEM` slicer touches no emulator and is independent of the stop; run it as a concurrent plan rather than behind one. It is already validated against 23-03's own hand-transcribed hex — two 8 KB chunks byte-identical, one differing only at `$0000`/`$0001`, the fourth localising ten dropped characters to `$7871`.
- **The stop is a protocol, not a new mechanism — and the mechanism this milestone was opened on does not exist.** MEASURED 2026-09-02: `event.c` registers exactly six event options and none is `-record` / `-recordevents`; `x64sc -record` returns `Unknown option`, exit 255; `event_record_start()` has no non-UI caller; and no binary-monitor opcode addresses it. The trap that makes the belief plausible is that the text monitor's `record` / `playback` are monitor-command **file scripting**, not event history. The scope decision stands and its named mechanism is replaced rather than lost: stock is cycle-deterministic from a monitor-issued hard reset, so reproducibility is that reset protocol plus pinned launch nondeterminism.
- **Absolute cycle count is deliberately not a requirement.** `stopwatch` is excluded by name (owner decision 2026-09-02) and `CPUHISTORY_GET` (0x86) needs VICE >= 3.10 while this host runs 3.9, so at the 3.9 floor the run-equivalence oracle is raster line plus raster cycle plus the 64K capture comparison, with absolute cycle a 3.10-only strengthening. Phase 0's Route B reconstructed clock is deliberately **not** revived — an incidental measurement put it at 19,657 cycles/frame against phase 0's documented 19,656, a 1-cycle-per-frame accumulating error.
- **`default_memspace` contamination has no remedy over the binary monitor**, which is why the main-CPU assertion is a criterion rather than a comment. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the **drive** CPU and `@bank:` conditions fail outright. With true drive emulation in the loop for an autostarted release, this is reachable here and not a theoretical hazard.
- **The transient allow-list is a method, not an address set.** MEASURED at the `READY` prompt the transient set is 3 of 1024 addresses (`$00A2` jiffy-clock low byte, `$00CD` cursor-blink countdown, `$01F2` dead stack byte above SP), and that is an **upper bound taken under frame-divergent conditions**. A real release's transients are its own frame counters, RNG, sprite positions and music-player pointers. A rule tolerating a page would be over-wide by three orders of magnitude.
- **Warp is launch-time here for a reason that is not the obvious one, and the stale claim needs re-grounding rather than deleting.** `capability-registry.ts` states inside `vice_machine_config_set`'s reason that warp on stock is a launch-time flag and not a runtime-togglable resource, and `docs/tool-support.md` reproduces the sentence **verbatim because it is generated** from the registry under a byte-identity drift guard. That sentence is **factually wrong about VICE** — runtime `warp` / `warp on` / `warp off` were refuted live on 2026-08-27 — and **operationally correct for this milestone**, because runtime toggling lives only on the excluded text channel. Re-ground it to say both things ("no runtime `WarpMode` resource; runtime toggling exists only on the text monitor, which this project does not dial") and **regenerate the table in the same commit**, or the drift guard reds. Consequence to carry: warp is a **per-instance** property, which puts it inside the warm-instance-eligibility problem — a pre-warmed interactive instance cannot be retro-warped.
- **Guards this phase breaks.** The three whole-argv `assert.deepEqual` assertions in `broker-launch.test.ts` are **avoidable**: an optional field defaulting to absent keeps all three green, and the ordering assertions were written to survive additions. The **fork argv byte-identity promise is a Validated v0.2.0 requirement, not merely a test**, so the determinism block is stock-branch-only. `-default` stays at index 0 ahead of `-binarymonitor`, the ordering invariant regression-pinned since Phase 8.2. `MANUAL_ONLY_TESTS` in `test-gate.test.ts` is **exactly nine files** and is one of this milestone's **five reviewed decisions** — a live frame-exact suite not added to it silently runs inside `test:automated` and fails on any machine without the corpus. `docs-deferred-ledger.test.ts` fails in **both** directions, so resolving the frame-exact, the headless-and-warp or the snapshot-extraction todo requires moving its `STATE.md` row in the same commit. And if any new host-bound `.mts` launcher appears, `build.ts`'s `HOST_BOUND_ARTIFACTS` **throws** while `resources-sync.test.ts` fails in both directions — a differing committed file *and* a missing one a fresh build produces. **SUPERSEDED IN PART 2026-09-02 (33-05, measured).** The original sentence above is left readable; two of its clauses are false. There are **five** stock whole-argv `assert.deepEqual(args, …)` assertions in `broker-launch.test.ts` (lines 1775, 1789, 1907, 1919, 1929), not three — and `REPRO-01`'s determinism block is **unconditional** on stock, so **all five changed, with `profile` absent**: it is the determinism block and not the profile that moves them, which makes them **not avoidable** by an optional-field default. What survives from the note unchanged: the three *ordering* assertions did survive additions exactly as it says, `-default` stayed at index 0 ahead of `-binarymonitor`, and the fork branch's argv is byte-identical — a Validated v0.2.0 requirement, not merely a test.
- **Two known-red baselines to establish before trusting any run in this phase.** **Stop the broker first** — a live broker reddens the `BACK-05` assertion deterministically, and a phase measuring against a live-broker run reads a false baseline. And use `npm run test:automated`, not `npm test`: the whole-glob run does not terminate unaided. The clean floor for `test:automated` is **0** failures. **SUPERSEDED 2026-09-02 (measured).** The original sentence above is left readable, and it is wrong: measured at the phase open with the broker stopped, `test:automated` exits `1` with **5 failing tests in 3 files** — `anno-register.test.ts`, `docs-deferred-ledger.test.ts`, `audit-integrity.test.ts` — from two root causes Phase 33 did not create. `33-02` repaired one of them, leaving **2 failing tests in `anno-register.test.ts`** (`:385`, `:479`; `tests 3113 / pass 3105 / fail 2`) as the baseline for the rest of the phase. The residual root cause is named and **out of phase**: the anno tool register cites `STORE-01`, `STORE-04`, `STORE-06` and `MCP-04`, which `.planning/REQUIREMENTS.md` no longer declares after the v0.8.0 rewrite dropped the v0.7.0 ids. So the floor is **not 0**, and no plan in this phase adopted "`test:automated` green" as an acceptance criterion — the count is a recorded baseline, never a gate (`evidence/DECISION-RULE.md` § *Never a gate*).

### Phase 34: The Host-Tool Execution Seam

**Goal**: A container-side skill script invokes a host binary — `acme`, `dxa`,
Ghidra — through one typed seam that consumes no emulator lease, returns paths
rather than payloads, and is the only route there is, with the ban on every
other route written and observed biting.
**Depends on**: Phase 33 — for gate authority only, not for any artifact: `GATE-01`'s verdict holds the authority to narrow or cancel every phase after it, and a `degrade` could narrow this one. Nothing here reads a Phase 33 deliverable. **Must precede Phases 35 and 36, never follow them**
**Requirements**: SEAM-01, SEAM-02, SEAM-03, SEAM-04, SEAM-05, SEAM-06, SEAM-07
**Success Criteria** (what must be TRUE):

  1. A container-side skill script invokes a named host binary over a **typed namespaced control op on the existing broker socket, routed before any lease-bearing path** — proven by an invocation that completes while consuming **no** emulator lease. Each tool goes through a **typed per-tool allowlist with no argv passthrough anywhere**, as a child process, with the invocation and its exit status recorded.
  2. **The 64 KiB line cap is observed, not read about.** An inline return larger than the cap produces a bare disconnect with **no error frame** — recorded as a transcript, red — which is what makes "results cross as path plus digest plus length through `containerpath.ts`, never as payload" a contract rather than a workaround. Ghidra exports run to megabytes, so the file route is forced regardless.
  3. Ghidra runs with **one project directory per run id** and `-deleteProject`, and the **no-dot project-path refusal is enforced in this project's code** — proven by a dot-prefixed path being refused before `analyzeHeadless` is ever reached, rather than by a comment saying not to pass one. Per-run directories make the single-writer lock unreachable, which is a better answer than guarding it.
  4. **The whole-tree grep gate banning an external-binary spawn from a skill script is observed biting on a planted violation**, and it exists at all only because the two existing violations are gone first: `src/skills/acme-build/scripts/acme.mjs` (`spawnSync("acme", …)` behind a PATH ladder of five *container* paths) and `src/skills/c64-program-recon/scripts/packer-finding.mjs` are migrated **in this phase**. The gate's scope reads what a user actually receives, not `git ls-files`.
  5. **The new module family is inside the closed-consumer discipline rather than beside it, with a second floor pinned over its own prefix and observed going red.** A **real** unclassified module is created on disk as a positive control and the new floor is observed naming it. And the JVM lifetime binding is a **recorded decision carrying its measurement and its reversal condition** — not an inherited default.

**Plans**: 4/6 plans executed in 4 waves. `34-01` leads with a production-quality tracer — one tool (`acme.build`) wired end to end through the control op, the host-bound executor, a real `acme` child process and back as `{path, sha256, byteLength}` — because proving the architecture on one path catches a dead end after one commit instead of after ten. Wave 2 expands sideways from that proven slice: `34-02` the 64 KiB cap observed red at the exact boundary, `34-03` Ghidra's per-run project directory and the dot-segment refusal in code. Wave 3: `34-04` the two migrations (ordering is a requirement — the gate cannot be written while anything violates it), `34-06` the second prefix floor and the JVM decision record. Wave 4: `34-05` the gate itself, observed biting, plus the phase's closing sweep. No `/gsd-discuss-phase` ran, so fourteen planner assumptions (`A-01`..`A-14`) are recorded in the plans and consolidated into `docs/phase34-host-tool-seam-decisions.md`; `A-01` and `A-02` resolve `34-RESEARCH.md`'s Open Questions 1 and 2, `A-09` resolves its Open Question 3.

Plans:
**Wave 1**

- [x] 34-01-PLAN.md — Tracer: one tool, one path, end to end (`host_tool` op, `host-tool.mts`, `host-tool-client.ts`, the allowlist, the guard dispositions)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 34-02-PLAN.md — The 64 KiB cap observed red at the boundary, plus result-by-reference asserted by key enumeration
- [x] 34-03-PLAN.md — Ghidra: per-run project directory, the dot-segment refusal in code, and the live transcript

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 34-04-PLAN.md — The two migrations: one resolution ladder, `acme.mjs` and `packer-finding.mjs` onto the seam
- [ ] 34-06-PLAN.md — The second prefix floor with a real positive control, and the JVM lifetime decision record

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 34-05-PLAN.md — The whole-tree gate, observed biting on a planted violation, wired into CI, plus the closing sweep

Notes:

- **`GATE-01`'s verdict, and what it narrows here.** Phase 33 recorded **`degrade`**, fired by rule **`R6`** (`ORACLE_NECESSITY: unproven`), against rules committed at `2a8ef95` before any measurement existed. The verdict, its derivation and the collected accepted limits are in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md). `R6` carries a **pre-mapped narrowing (`D-04`)**, reproduced rather than re-authored: the stop-identity oracle narrows to the two-term **`(PC, hit_count)`** form with the frame term `(LIN, CYC)` **recorded but not asserted**, and every downstream capture pair carries that weakening **in its own record**, not in a footnote to the findings document. **What that narrowing does to this phase: nothing.** `R6` is a fact about the oracle's frame term and this phase reads no Phase 33 deliverable — its dependency is gate authority only. The `REPRO-*` / `CAP-01` / `CAP-02` substrate is untouched by this branch and stands on its own corpus-free evidence (`SLICER: validated`, `SEED_EFFECT: pinned`, `JITTER_IMMUNITY: immune`). `SEAM-01`..`SEAM-07` proceed as scoped. Two Phase 33 measurements are worth carrying anyway because they are facts about the launcher this phase extends: `PROBEREADY_BUDGET: short` (`WARP_TIME_TO_BIND_MS_MAX: 3155`, `CONSOLE_TIME_TO_BIND_MS_MAX: 2385` against a 1000 ms per-attempt budget — the shortfall predates both new flags and costs a first probe pass, never a launch), and `-warp` measured worth only ~1.97× on this host with `AUTOSTART` owning warp during a load regardless of argv. Per `D-06` no test guard encodes this binding; it lives here, in the findings document, and in the `STATE.md` pointer.
- **This is a precondition, not a plan inside another phase**, and three independent research lines say so for three different reasons: it gates the Ghidra post-script's output format; it gates any skill script reaching a host binary at all; and the whole-tree grep gate **can only be written once nothing violates it**, while two skill scripts violate it today. Inlining `spawnSync("dxa", …)` "just for the measurement phase" means writing the violation twice and deleting it twice, and the second deletion is the one that gets skipped.
- **The rule this discharges is the project owner's, stated 2026-08-28** in [`seeds/host-tool-executor.md`](seeds/host-tool-executor.md): a skill script runs container-side, the binaries live host-side, and there is no container PATH to find them on. The seed is framed around **stateless** tools (`c1541`, `petcat`, `cartconv`, `acme`). Ghidra is not one — a JVM with a persistent project directory, multi-minute runs, and exports past the control channel's 64 KiB line cap — which is why `SEAM-07` makes the lifetime binding a recorded decision rather than an assumption inherited from the stateless case.
- **Measured inputs to the JVM decision, so it is decided on evidence.** JVM startup is **12.6-17.4 s** before any analysis, which is what makes per-request `analyzeHeadless` untenable at corpus scale; and four independent comparable projects converge on **one resident JVM behind a localhost socket** — structurally the same design as this project's own VICE broker. Whichever way it is decided, record the reversal condition.
- **The trap that will otherwise be discovered in a red CI run.** `spawn-seam.test.ts`'s discovery predicate matches `\bbinPath\b`, so a host-tool executor writing `spawnSync(binPath, […])` for **Ghidra** is counted as an *emulator* spawn site and reds the `EXPECTED_EMULATOR_SPAWN_SITES === 1` assertion. Avoid it by naming the local `toolPath` / `ghidraPath`, or widen the set as a **recorded decision** — never by editing the number to make a red test green.
- **The second trap, and it is the quieter one.** `hostpath-consumers.test.ts`'s non-vacuity floor is `ANNO_MODULE_FLOOR = 16 + 1`, pinned over the `anno-*` prefix, so a `ghidra-*` / `dxa-*` family sits **outside its scan entirely** — see Standing Constraints. Its "exactly five declared modules" assertion *will* fire when the new family imports `hostpath.ts`, which is the guard working; but the natural repair, adding the module to the declared list, converts a closed set into an open one, one entry per milestone. Prefer **one** declared-consumer module the rest of the family reaches through, and add the second prefix floor with a real on-disk positive control observed red.
- **Guards this phase breaks, with three of the milestone's five reviewed decisions among them.** `ControlRequestKind`'s byte-exact declaration in `broker-control.test.ts` trips on **any** new control-plane op (`ghidra.*`, `dxa.*`, `tool.*`) and is therefore unavoidable in every execution-seam design — it is not a discriminator between them. `EXPECTED_IMPORTERS`, the five-member host-path consumer set, carries its own header: *"Widening the five-member list below is a REVIEWED DECISION, not a mechanical fix for a failing test"*. `EXPECTED_EMULATOR_SPAWN_SITES` is the third, above. Mechanical but easy to miss: `EXPECTED_TRACKED_SHELL_SCRIPTS` is a repo-wide `git ls-files -- *.sh` at 5 entries, so an `analyzeHeadless` wrapper script trips it; `check-skill-cli-invocations.mjs` and `check-skill-tool-coverage.mjs` (allowlists designed to *"SHRINK BY FAILING"*) both read the migrated skill scripts; `shippedTsModules()` throws on a `files[]` entry missing from disk; and `docs-linerefs.test.ts` is verified correct at HEAD (`:3050` / `:2985` / `:1529` / `:1505`) but **any** new interception near `forwardToVice()` shifts all four — these citations have been stale twice before, so treat a mismatch as drift to re-verify rather than as evidence the constraint changed.
- **`installer/skills/` is gitignored yet shipped**, so the migration's gate must read the `npm pack` file list through `scripts/check-npm-packages.mjs` and never `git ls-files` — see Standing Constraints. The failure runs in the worst direction: the tracked copy is correct, the gate is green, and the shipped copy is wrong.
- **Reuse rather than rebuild.** The existing `resources/` recursive-walk delivery channel already ships committed non-`.ts` payloads to the host side, and `verifiedKill()` already kills by identity. Neither needs re-deriving.
- **Research flag: this is the one section of the milestone's research resting on survey rather than measurement** (MEDIUM confidence). Two live questions, **nothing probed**: whether batch framing with `-process` actually amortises the measured 12-17 s JVM startup across a corpus item, and the cost of installing Ghidra plus a JDK in GitHub Actions. `/gsd-plan-phase --research-phase 34` is warranted.

### Phase 35: dxa, Vendored and Parsed

**Goal**: A raw C64 image goes in and a machine-readable code/data map comes out,
from a dxa this project vendors and builds at a pinned version — with the
listing parser refusing by name rather than silently mis-parsing, and every rate
it will ever be measured against derived from a committed script before the tool
runs.
**Depends on**: Phase 34 (dxa is reached through the host-tool execution seam; inlining a spawn here writes the ban's violation twice) and Phase 33 (the corpus for any real-image exercise, plus `GATE-01`'s authority to narrow this phase)
**Requirements**: DXA-01, DXA-02, DXA-03, DXA-04
**Success Criteria** (what must be TRUE):

  1. A caller hands a `.prg` or flat 64K image to a command this project ships and gets a machine-readable code/data map back, from a dxa **this project vendors and builds at a pinned version** — never one assumed present on `$PATH`. The digest gate is written **before** the fetch, `sha256` is re-verified against Phase 23's pin byte-for-byte, and the build reproduces the same binary digest. The GPL-2.0-or-later notice in `THIRD-PARTY-NOTICES.md` is **quoted from the source headers** with this project supplying the licence text, because the tarball carries no `LICENSE` or `COPYING` file.
  2. **The parser's refusal is observed, provoked by a real unknown listing form from an actual run** — not only by a hand-planted malformed line, and not by dxa's exit status, which was MEASURED to exit **0** on an inconsistent fixture under `-d strict`. It is **this project's parser refusing by name**. Overlapping decodes — a `jsr` into a mid-instruction target — yield **unclassified with a stated reason**, never a winner, because a byte-per-address map structurally cannot represent them.
  3. Naming a known-data range excludes those bytes from discovery: known-data ranges are handed to dxa as `-b` data blocks with the store's existing 12-member vocabulary as the source and the `-B` / `-l` store-to-dxa emitters as the route, **exercised on a real image** rather than asserted.
  4. **Every rate this project quotes about dxa has a ground-truth partition derived by a committed script that ran before dxa did**, with its denominator and positive class stated. MEASURED reason this is a criterion and not a nicety: the pivot's 141/138 partition was not source-derivable and flattered dxa exactly where its `0 false positives` headline lived.

**Plans**: TBD

Notes:

- **`GATE-01`'s verdict, and what it narrows here.** Phase 33 recorded **`degrade`**, fired by rule **`R6`** (`ORACLE_NECESSITY: unproven`), against rules committed at `2a8ef95` before any measurement existed. The verdict, its derivation and the collected accepted limits are in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md). `R6` carries a **pre-mapped narrowing (`D-04`)**, reproduced rather than re-authored: the stop-identity oracle narrows to the two-term **`(PC, hit_count)`** form with the frame term `(LIN, CYC)` **recorded but not asserted**, and every downstream capture pair carries that weakening **in its own record**, not in a footnote to the findings document. **What that narrowing does to this phase: nothing to its scope, one line to its records.** `R5`'s fixture-only branch does **not** apply — the corpus input came out `C0_CAPTURE_PAIR: pass` on a real autostarted `danish.d64` with true drive emulation in the loop, so the real-image exercise `DXA-03` and `DXA-04` need is available and this phase is not narrowed to fixtures. `DXA-01`..`DXA-04` proceed as scoped. What the narrowing costs: any capture pair this phase produces or consumes states in its own record that it was compared under a two-term oracle with the frame term recorded but not asserted. Read the `pass` for what it supports — `CAPTURE_FRAME_EXACT: no` sits beside it and the allow-list was derived from three runs two of which are the pair, so all discriminating power sits in the cap of 64 (`TRANSIENT_COUNT: 49`, and `33-03` measured **66** — over the cap — for the nominally corresponding comparison on a directly launched instance). No test guard encodes this binding (`D-06`).
- **dxa's map is what makes Ghidra work at all, not an optimisation.** Ghidra alone with zero hints produced **0 functions and 0 code bytes** on the pivot fixture. That is the strongest edge in this milestone's dependency graph and the reason this phase precedes the semantic engine rather than running beside it.
- **dxa is not installed anywhere on this host** (MEASURED 2026-09-02), so the vendored build is real work rather than setup. 3,417 lines of C, GPLv2+, builds clean with plain `make`, dormant since a 2022-03 tarball, and shipped in no Debian package (`dpkg -L xa65` has no `dxa`).
- **The licence position is a packaging gap, not a formality.** MEASURED tarball contents: **no `LICENSE` / `COPYING` file**, GPL-2.0-or-later appearing only in C headers under two-party copyright with no upstream signature. `THIRD-PARTY-NOTICES.md` therefore quotes the headers and this project supplies the GPL-2.0 text.
- **dxa is the discovery engine and nothing more** — see Standing Constraints. `grep -in bank` over all 3,417 lines returns zero, and its entire C64-specific knowledge is eight lines testing whether the load address looks like a BASIC start. Never ask it about banking, the VIC, sprites, charsets or bitmaps. It also has **no machine-readable output**, so the listing parser — including its refusal behaviour — is this project's to own and maintain, over the five measured line shapes of `-a dump`.
- **Do not accept a published benchmark, including this project's own.** The fixture re-measurement reads `FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, `FIXTURE_REPRODUCED: no` against a pinned dxa. The real-release numbers belong to Phase 38, not here; **do not let a plan in this phase quietly claim `PROOF-01`**. What this phase owes Phase 38 is `DXA-04`'s partition script and the discipline that every rate carries its denominator.
- **The error direction is what makes the graphics feedback load-bearing rather than cosmetic.** dxa's errors run the dangerous way — data called code — and graphics regions are the largest single source of them, which is the coupling to `AUTO-07`.
- **Guards this phase breaks.** `EXPECTED_TRACKED_SHELL_SCRIPTS` (repo-wide `git ls-files -- *.sh`, 5 entries) trips on a dxa `build.sh`. `check-npm-packages.mjs`'s leak checks catch `node_modules/`, `*.test.*` and `fixtures/` but **not** vendored C under `vendor/`, so `files[]` membership for the vendored tree is a deliberate decision rather than something the gate will notice for you. `ci-suite-coverage.test.ts` reds on a committed test file in a directory with no matching `ci.yml` step, so a `vendor/dxa/` test directory needs its CI step **in the same commit**. And a live dxa suite belongs in `MANUAL_ONLY_TESTS` (exactly nine files today, a reviewed decision) or it runs inside `test:automated` on machines with no dxa build.
- **Skip `--research-phase`.** The flag set, the five `-a dump` output line shapes, the build, the licence position and the false-positive direction are all measured. This is implementation.

### Phase 36: The SLEIGH Language and the Ghidra Harness

**Goal**: Ghidra headless recovers structure from a real C64 image under this
project's own committed harness — all 105 undocumented opcode bytes decodable
under an extension installed as its own language, hardware writes surviving the
decompiler, and structural facts exported through `DecompInterface`.
**Depends on**: Phase 35 — **the strongest edge in the graph**: Ghidra alone with zero hints produced 0 functions and 0 code bytes, so dxa's map is what makes it work at all. Also Phase 34 (the host-tool seam, the project-directory-per-run rule, the no-dot refusal and the path-plus-digest return) and Phase 33 (the real cracked corpus `OPC-03` and criterion 5 are verified against, plus `GATE-01`'s authority to narrow)
**Requirements**: OPC-01, OPC-02, OPC-03, OPC-04, GHID-01, GHID-02, GHID-03, GHID-04, GHID-05
**Success Criteria** (what must be TRUE):

  1. **The run log says which language it used, and the acceptance run under `6502:LE:16:default` is observed FAILING the 105-byte assertion.** The extension is installed as its **own** Ghidra language with a new `.ldefs` `id`, the `-processor` change made in the **same commit**, and this is deliberately the phase's *first* criterion: a failed `sleigh` leaves the pre-shipped `6502.sla` in place, so an unchecked build yields a green run on a language that decodes none of the 105 bytes. That is the difference between the phase delivering and the phase reporting delivery.
  2. **The `sleigh` compile gate is observed red before the fix and green after** — reverting one sized-local fix reddens it. The gate asserts exit 0 **and** a produced `.sla` **and** an mtime newer than every input, and it is the **earliest task in the phase**. All 105 opcode bytes stock `6502.slaspec` omits then decode; loading `65c02.slaspec` in the same installation still yields **its** documented meanings for the bytes both claim; and `XAA` (`$8b`), immediate `LAX` / `LXA` (`$ab`) and the page-crossing-dependent `AHX` / `TAS` / `SHX` / `SHY` read as **declared unknowns** — opaque userops — never as plausible p-code. The extension is exercised against **real code containing illegal opcodes** from this milestone's corpus, with the before/after difference in decompiler output recorded, sequenced **ahead of** criterion 5's acceptance run.
  3. **Each of the harness's three gates is observed firing.** A wrong expected count fires the **exact literal** `ERROR REPORT SCRIPT ERROR` while `analyzeHeadless`'s own exit status is still 0; the classification count is asserted as the **block total, not the image size**, on **both** import routes; and the run is reproducible from a committed script against a `.prg` or flat 64K image given dxa's map as hints, with Ghidra a **declared host prerequisite by version** rather than an unpinned unpack.
  4. **The volatile-I/O carve is proven by disappearance, on both import routes.** Removing the flag from `$0000-$0001` / `$D000-$DFFF` makes hardware writes **vanish** from the reference dump — observed red on the `.prg` route **and** on the flat-64K route, because the conflict path is MEASURED route-dependent. A loader-owned block at the same address has the flag set on the **existing** block and is proven not to fall back to non-volatile through a swallowed `MemoryConflictException`.
  5. Structural facts no listing-level query can produce are exported through **`DecompInterface`** from a real binary — an array bound, the split-pointer `CONCAT11` idiom, a record stride, at least one resolved computed jump, at least one self-modifying write target — with cross-references carrying their **access kind** (`READ` / `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), per-function **attempted / decompiled / timedOut** accounting satisfying `attempted == decompiled + timedOut` under a committed timeout ceiling, and unresolved dispatch reported as a **count and a list with no denominator**. A committed control observes the same export routed through `DataTypeManager` returning essentially nothing, **on the same image** as the acceptance run.

**Plans**: TBD

Notes:

- **`GATE-01`'s verdict, and what it narrows here.** Phase 33 recorded **`degrade`**, fired by rule **`R6`** (`ORACLE_NECESSITY: unproven`), against rules committed at `2a8ef95` before any measurement existed. The verdict, its derivation and the collected accepted limits are in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md). `R6` carries a **pre-mapped narrowing (`D-04`)**, reproduced rather than re-authored: the stop-identity oracle narrows to the two-term **`(PC, hit_count)`** form with the frame term `(LIN, CYC)` **recorded but not asserted**, and every downstream capture pair carries that weakening **in its own record**, not in a footnote to the findings document. **What that narrowing does to this phase: nothing to its scope.** `OPC-03` and criterion 5 are verified against the real cracked corpus, which exists — `C0_CAPTURE_PAIR: pass`, so `R5`'s fixture-only branch does **not** apply and this phase keeps its real-image exercise. `OPC-01`..`OPC-04` and `GHID-01`..`GHID-05` proceed as scoped. What the narrowing costs: the flat-64K images this phase imports were captured at a stop certified by a two-term oracle, so each carries that statement in its own capture record. The substrate producing them is untouched by `R6` and stands on its own evidence (`SLICER: validated` with both declared suites at `fail 0`). Also carried, because it bounds what a Phase 36 comparison may claim about two runs of one image: `AUTOSTART_FRAME_EXACT: not-achieved` and `CAPTURE_FRAME_EXACT: no` — frame-exactness holds through anchor hit 50 and is lost from 75, because `AUTOSTART`'s power cycle does not reset the absolute emulated clock. No test guard encodes this binding (`D-06`).
- **The carried claim that this phase only integrates the SLEIGH source is FALSIFIED, and the correction is recorded rather than substituted.** v0.6.0's Phase 24 block reads *"already exists in full … this phase integrates and verifies it; it does not write it"*. MEASURED twice independently on 2026-09-02 against real Ghidra 12.1.3's `support/sleigh`: `docs/undocumented-opcodes-ghidra.md`'s 766 lines produce **8 failing constructors** and `ERROR No output produced`, exit 2, against a clean control compile of stock `6502.slaspec` in the same scratch directory. The `@include` layering is sound; the p-code is not. **One root cause for all eight** — an unsized value where SLEIGH needs an explicit size — and the fix (explicitly sized locals) is verified. The failures sit at exactly `XAA $8b`, immediate `LAX` / `LXA $ab`, `AHX` / `TAS` / `SHX` / `SHY`, `SBC $eb` and `NOP $0c`, so `OPC-01`'s fix and `OPC-02`'s declared-unknowns are the same work seen from two sides. This is the **seventh** instance of this project's oldest lesson, and it was found by *running* the thing rather than reading about it.
- **Offsetting measured good news, which is what makes criterion 1 cheap:** a drop-in language extension needs **no Gradle and no Ghidra rebuild** — `-processor 6502:LE:16:nmos` ran headless to exit 0.
- **Ghidra is a declared host prerequisite by version, not a vendored dependency** — 543 MiB. MEASURED: 12.1.3 exists on this host only as an unpinned out-of-tree probe unpack at `/home/henrik/dev/_ghidra-probe/`, neither vendored nor on `$PATH`; the JDK floor is 21 with no ceiling.
- **The single most expensive mistake available in this design** is writing the structural-fact export against `DataTypeManager` — see Standing Constraints. Criterion 5's control exists so it cannot be re-made silently, and it runs on the **same image** as the acceptance run so the comparison is real. The accounting half is the same failure one level down: a **timed-out** function yields no facts and no error, failing short in exactly the shape the `DataTypeManager` failure does, which is why `attempted == decompiled + timedOut` is asserted under a committed ceiling.
- **The volatile carve's control must be observed red on BOTH import routes**, because MEASURED the `MemoryConflictException` path is route-dependent: a pre-script tested on the `.prg` fixture and shipped for the flat-64K corpus meets a conflict the test never saw. Call `mem.getBlock(addr)` first and `setVolatile(true)` on the **existing** block rather than creating a conflicting one.
- **Unresolved dispatch is reported as a count and a list with NO denominator.** The specified `C2_SITES_ENUMERATED` drew on `memmapshow`, **stated ABSENT** by owner decision 2026-09-02 — excluded twice over, since the runtime-evidence layer is out of scope and it lives on the excluded text channel. Naming a denominator this milestone cannot source would reproduce exactly the defect the unreproducible `72.46%` headline was.
- **`OPC-*` stays with `GHID-*` rather than becoming its own phase**, for the reason v0.6.0's Phase 24 gave and this milestone's research re-confirmed: `OPC-03` can only be checked by running the harness `GHID-01` delivers, and `GHID-04`'s acceptance — structural facts recovered from *real cracked code* — is not honestly claimable while 105 opcode bytes are undecodable, because crack and packer code is exactly where the gap bites. The phase still groups two ways in planning (language, then harness), with the extension sequenced **ahead of** the acceptance run and never after.
- **Guards this phase breaks.** `docs-dangling-refs.test.ts`'s shipped-string-literal state machine fails if any shipped string names a phase number, so **rename `ExportAnalysis23.java` and `FlatVolatile.java` on promotion out of `.planning/phases/`**. Moving the pre/post scripts into `src/` makes them **shipped code** that must be reachable from `-scriptPath` **after** package installation and **after** path translation, which puts them inside `check-npm-packages.mjs`'s file-list assertions and inside the gitignored-but-shipped `installer/skills/` blind spot. Recommendation, recorded so it is a decision rather than a habit: **build the `.sla`, do not commit it**. `ci-suite-coverage.test.ts` needs its `ci.yml` step in the same commit as any new test directory; a live Ghidra suite belongs in `MANUAL_ONLY_TESTS` or it runs inside `test:automated` and fails on any machine without Ghidra; and an `analyzeHeadless` wrapper `.sh` trips `EXPECTED_TRACKED_SHELL_SCRIPTS`.
- **Skip `--research-phase`.** The compile failure, its root cause, the verified fix, the `.ldefs` shape, the drop-in extension route and Phase 23's whole recorded harness are measured. This is implementation against a green control.

### Phase 37: The Importer and the Automatic Annotation Join

**Goal**: Machine addresses annotate themselves into the owned store — the join
runs mechanically with no agent, no queue walk and no skill in the loop,
resolves bank state before address, and declines with a reason rather than
emitting a confident wrong comment wherever it cannot be sure.
**Depends on**: Phase 36 — nothing to import until the export exists, and one hard dependency inside that edge: **`GHID-02`'s volatile carve gates `AUTO-04`**, because no volatile carve means no recovered `$01` literals, which means no bank state. Also Phase 35 (`AUTO-07` feeds derived graphics ranges back to dxa as `-b` data blocks) and Phase 33 (the real analysed binary the join runs over, plus `GATE-01`'s authority to narrow)
**Requirements**: IMP-01, IMP-02, AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07, AUTO-08
**Success Criteria** (what must be TRUE):

  1. One command over an analysed real binary writes machine-address annotations into the store with **no agent call, no queue walk and no skill invocation** anywhere in the loop, reporting how many addresses were annotated and how many skipped — and the annotations are read back **out of the store**, not out of the pipeline's own stdout. The facts arrive through a **container-side importer** reading a host-written transfer file with access kinds preserved and the store's single seam respected; that transfer file carries a digest and is **consumed and deleted in the same command that imports it**, so no fourth artifact can drift from the store.
  2. **Narrowest-range-wins and its tie-break are each observed red.** `$D020` annotates as the 1-byte border-colour entry and **not** as the 4096-byte I/O-area entry, and switching selection to first-match or longest-description makes that control go **red**; equal-width contenders resolve toward the entry carrying a `sym`, and reversing that tie-break reddens it too. A criterion that only asserted the fix would be worthless here — this rule was got wrong on the first attempt during the pivot exploration and produced plausible, confident, wrong comments rather than an error.
  3. **The in-image skip is observed red.** An address inside the loaded image is treated as a program address and never looked up in `memmap.json`, and removing the image-range check makes ordinary loop-back branches annotate as machine features again — which is what the first attempt actually did, twice.
  4. **Bank state is resolved before the address, proven by a flip and by a decline, on a fixture built for the purpose.** A **synthetic two-caller path-dependent `$01` fixture** is built as an early task, because MEASURED the existing `bank.a` fixture has no path-dependent site and "the join declines on the fixture" is therefore not a usable control. The same address then annotates differently under two `$01` states — a `$d020` write under `$34` is not labelled the border colour, a `$d000` read under `$33` is not labelled sprite-0-X — with the `$01` bits 0-2 decode bypass **observed reddening** the flip. Where bank state is path-dependent the join emits **no annotation and says why**, and replacing that decline with a forward-carried value reddens its own control.
  5. **Graphics ranges come from the VIC pointers rather than from cross-references, and the feedback is exercised rather than built.** Screen matrix, charset-or-bitmap and sprite-pointer ranges are derived from `$DD00` bits 0-1 inverted, `$D018`, `$D011` bit 5 and screen + `$3F8` — for a charset **referenced by no instruction anywhere in the program**, the case cross-references structurally cannot find because the VIC fetches by DMA. Those ranges are fed back to dxa as `-b` data blocks and to Ghidra as data, with the phantom labels a graphics region mints when decoded as code shown **present before** the feedback and **absent after**. Every derived row carries `memmapSha256` provenance.

**Plans**: TBD

Notes:

- **`GATE-01`'s verdict, and what it narrows here.** Phase 33 recorded **`degrade`**, fired by rule **`R6`** (`ORACLE_NECESSITY: unproven`), against rules committed at `2a8ef95` before any measurement existed. The verdict, its derivation and the collected accepted limits are in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md). `R6` carries a **pre-mapped narrowing (`D-04`)**, reproduced rather than re-authored: the stop-identity oracle narrows to the two-term **`(PC, hit_count)`** form with the frame term `(LIN, CYC)` **recorded but not asserted**, and every downstream capture pair carries that weakening **in its own record**, not in a footnote to the findings document. **What that narrowing does to this phase: nothing to its scope, and one adjacent Phase 33 measurement it must not misread.** The real analysed binary this join runs over exists (`C0_CAPTURE_PAIR: pass`), so `R5`'s fixture-only branch does **not** apply. `IMP-01`, `IMP-02` and `AUTO-01`..`AUTO-08` proceed as scoped. What the narrowing costs: any capture pair reached from here states in its own record that equivalence was asserted over `(PC, hit_count)` with the frame term recorded only. **The adjacent measurement:** Phase 33 recorded `MEMSPACE_ASSERTION: refuses`, but on the `@bank:`-condition symptom **alone** — a memspace-less `ADVANCE_INSTRUCTIONS` still stepped the main CPU after one drive-checkpoint hit, contradicting `P10`'s first symptom, and the evidence file states that a stepping-only definition would have read `did-not-refuse`. Any `AUTO-04` bank-state work that assumes the stepping symptom is present is assuming something this project measured **absent** on stock 3.9. No test guard encodes this binding (`D-06`).
- **Three of this phase's rules fail SILENTLY, and each was got wrong on the first attempt during the pivot exploration** — narrowest-range-wins, the in-image skip, and bank-before-address. Each produced plausible, confident, wrong comments rather than an error. That is why criteria 2, 3 and 4 each require a control **observed red** without the fix, with the red transcript as a task deliverable **separate from** the task that implements the fix. **Six of this milestone's eighteen worthless-as-an-assertion criteria sit in this phase** — the largest single concentration — and the temptation to batch them into "the controls are in place" is exactly the failure mode. The full table with each required observation is at `.planning/research/PITFALLS.md` § *Pitfall 23*.
- **There is no prior art to validate the decline against, and that is an argument for the controls rather than a gap to close.** MEASURED survey: SVD-Loader, radare2's SVD import and IDA's device definitions all annotate **unconditionally** from a flat device description, because their domain has no path-dependent address meaning.
- **The importer must exist before the join**, because `AUTO-01`'s criterion reads annotations back out of the store rather than out of the pipeline's own stdout. And a Ghidra post-script writing `.annostore` directly is **structurally unavailable**, not merely discouraged: `anno-seam.test.ts` asserts `node:sqlite` is named by exactly one shipped module, so a Java writer would sit outside every guard's scope — an invisible violation rather than a caught one — and `openStore()`'s confinement, the paint index and the revert journal would all need re-implementing in Java against a container-side store.
- **The transfer file is transient evidence, not a model.** `.annostore` is the model; `.asm` is a rendering of it through the shipped `anno export-asm`. Prior art is unanimous on this split — SourceGen's `.dis65` stores metadata only, and Mesen's CDL is pure evidence kept outside the model.
- **`AUTO-07` is the containment for the pipeline's most dangerous failure, and it is not a review step.** Graphics bytes decoded as instructions mint phantom labels (`zpp_02`, `zpa_06`, `f_1B1A`) indistinguishable in form from genuine ones; a phantom routine inside a charset is promoted to a Ghidra function, yields phantom xrefs, feeds the join, and emerges as a confident wrong comment the next pass treats as established.
- **One map per program point, not one per program.** A program that switches bank or charset per raster split has several valid graphics maps, and a single derived map is wrong for all but one — the same path-dependence limit as criterion 4.
- **This annotates MACHINE addresses only.** What `$1173` does *in this program* remains a finding a human or agent produces, which is the reason the annotation store exists at all and the boundary between this phase and v0.9.0's `DECOMP-*`.
- **Two gaps are carried rather than owned here, and no plan may quietly promise either**: sprite **bitmap** locations (the pointer values are program data usually written at runtime, so they are not register values Ghidra recovers) and the second `$DD00` VIC banking axis under path-dependent state. Both are recorded Out of Scope in `REQUIREMENTS.md`.
- **`memmap.json` is more load-bearing after the pivot, not less** — it moves from a skill an agent invokes to a data source a pipeline stage joins against, which is why `AUTO-08`'s `memmapSha256` provenance rides on every derived row.
- **Guards this phase breaks, including the fourth of the milestone's five reviewed decisions.** `BACKEND_SEAM_BYPASS_KEYS` in `stock-dispatch.test.ts` is **2 entries under an order-sensitive `deepEqual`**, and its own comment says *"A THIRD entry collides here rather than being absorbed into a superset."* **Avoid it by extending `ANNO_TOOL_DEFINITIONS` rather than adding a new tool family** — the importer needs 1-3 new entries, not a family. Then: `anno-verb-coverage.test.ts`'s `REAL_VERBS` scans **both** `src/skills/` and `installer/skills/`; `anno-derivation.test.ts` walks Phase 19's `upstream-procedure-manifest.json` and asserts a route in **both** directions; `check-skill-tool-coverage.mjs`'s allowlists are designed to *"SHRINK BY FAILING"*; and `absorbed-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no existence guard.
- **Skip `--research-phase`.** The three selection rules, their failure modes and the 18/18 proof-of-concept are measured in-repo. The absence of prior art is a reason for controls, not for research.

### Phase 38: PROOF-01..03 on Real Cracked Code

**Goal**: The three measurements Phase 23 recorded `could-not-run` are taken on
real cracked releases — dxa's data-recovery rate and false-positive count on a
named binary, Ghidra's computed-index dispatch resolution, and the point where a
single forward-carried `$01` value becomes wrong — each stated beside the
fixture figures rather than replacing them.
**Depends on**: Phase 33 (the reproducible corpus every number is measured on), Phase 35 (dxa and its ground-truth partition script), Phase 36 (the Ghidra harness and the working opcode extension) and Phase 37 (the join these proofs read). `GATE-01`'s verdict narrows this phase's denominator rather than widening its claims
**Requirements**: PROOF-01, PROOF-02, PROOF-03
**Success Criteria** (what must be TRUE):

  1. dxa's data-recovery rate and false-positive count read as numbers against a **named** real cracked release — binary identified by release id and hash — each carrying its **denominator and positive class**, and stated **beside** the source-derived fixture figures (`FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, `FIXTURE_REPRODUCED: no`) rather than replacing them. The pivot's published `72.46%` / `0 FP` may appear **only** beside those, with the non-reproduction cause attached as a **hypothesis**. That `PROOF-01` has **no independent external check** is recorded as a named weakness of the measurement, not absorbed.
  2. A **computed**-index indirect dispatch taken from real code — the case the pivot fixture never exercised, which used an immediate `ldx #$02` — is either resolved by Ghidra with the resolved target shown, or recorded as unresolved with its transcript. A corpus **searched** and found to contain no computed dispatch is reported as `not-exercised` with the search recorded, and never as a pass; it is no longer reportable as `could-not-run`, because the corpus now exists.
  3. The point where a single forward-carried `$01` value stops being correct is **established rather than assumed, in both directions**, against code that banks ROM in and out: at least one address shown annotating differently under two bank states, or the absence of such an address in the corpus recorded as a fact **about the corpus** rather than about the model. The result is recorded whichever way it comes out.

**Plans**: TBD

Notes:

- **`GATE-01`'s verdict, and what it narrows here.** Phase 33 recorded **`degrade`**, fired by rule **`R6`** (`ORACLE_NECESSITY: unproven`), against rules committed at `2a8ef95` before any measurement existed. The verdict, its derivation and the collected accepted limits are in [`docs/phase33-reproducible-run-gate-findings.md`](../../docs/phase33-reproducible-run-gate-findings.md). `R6` carries a **pre-mapped narrowing (`D-04`)**, reproduced rather than re-authored: the stop-identity oracle narrows to the two-term **`(PC, hit_count)`** form with the frame term `(LIN, CYC)` **recorded but not asserted**, and every downstream capture pair carries that weakening **in its own record**, not in a footnote to the findings document. **What that narrowing does to this phase: it does NOT narrow the denominator, and that is the load-bearing consequence.** `R5` — the branch that would have narrowed this phase to **method-only** and had it re-record its predecessor's `could-not-run` — did **not** fire: `C0_CAPTURE_PAIR: pass` was obtained on a real autostarted release with true drive emulation in the loop, so the reproducible corpus every number here is measured on exists. `PROOF-01`..`PROOF-03` proceed as scoped, and criterion 2's `not-exercised` reporting stays available while `could-not-run` no longer is. What the narrowing costs: every capture pair this phase reports states in its own record that it was compared under a two-term `(PC, hit_count)` oracle with the frame term recorded but not asserted — and that statement belongs beside each number, not in a single footnote, because these are the numbers the milestone exists to produce. Read the corpus `pass` for exactly what it supports: `CAPTURE_FRAME_EXACT: no` is recorded beside it, the 49-entry allow-list was derived from three runs two of which **are** the reported pair, so the equivalence verdict restates "the union fitted under the cap" rather than independently testing the pair, and all discriminating power sits in the cap of 64 — which a future run of the same script may well exceed (`33-03` measured 66 on a directly launched instance). A planted one-bit flip at `$C000` still fails, so the list is not vacuous. No test guard encodes this binding (`D-06`).
- **This is the milestone's point.** `PROOF-01`..`PROOF-03` were recorded `could-not-run` by Phase 23 — **not** `not-exercised`, and that phase was emphatic about the distinction: no corpus was ever searched for a computed dispatch, so nothing is known about whether the construct is even present in real cracked code.
- **State the new numbers BESIDE the old ones, never instead of them.** The fixture re-measurement against a pinned dxa reads `FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)`, `FIXTURE_REPRODUCED: no`, and the pivot's own `72.46%` / `0 FP` figures do not reproduce because its 141/138 partition was not source-derivable and flattered dxa exactly where the headline lived. Attach the non-reproduction cause as a hypothesis, not as a finding.
- **`PROOF-01` has no independent external check, and that is a named weakness of the measurement rather than a detail.** `memmapshow` was the specified oracle and is **stated ABSENT** by owner decision 2026-09-02 — excluded twice over, since the runtime-evidence layer is out of scope and it lives on the excluded text channel. This is the same weakness that let the pivot's unreproducible headline stand, so it is recorded rather than absorbed. Reversal condition, named so a future reader can tell whether it has been met: a binary-monitor-reachable execution oracle, or a decision to open the text channel.
- **`PROOF-03` is unmeasured in BOTH directions.** Nothing is known about where a single forward-carried `$01` value stops being correct, in either direction. `R1` fired under first-match-wins at Phase 23, so `R7`'s pre-mapped narrowing was never evaluated and `AUTO-04` / `AUTO-05` are **unvalidated rather than narrowed**. Name the fixture that will measure it, and record the result whichever way it comes out — path-dependent bank state is the highest-risk item on the pivot's own record.
- **Measurement, not design — skip `--research-phase`.** Every instrument this phase reads is delivered by Phases 33, 35, 36 and 37. If any of them is narrowed by `GATE-01`, this phase's **denominator** narrows with it; the claim does not widen to compensate.
- Two standing baselines apply to every number produced here: **stop the broker** before trusting any suite result (a live broker reddens `BACK-05` deterministically), and use `npm run test:automated` rather than `npm test`, whose whole-glob run does not terminate unaided.

## Sequencing Rationale (v0.8.0)

**Six phases, at `standard` granularity.** Four researchers proposed structures
that converged in shape and differed in granularity — four phases, a ten-node
dependency graph, an MVP checklist with a P1/P2/P3 matrix, and none. This is the
four-phase count with its two-engines phase **split**, because the SLEIGH
compile gate and the Ghidra harness carry independent gates and the dxa ->
Ghidra edge is the strongest in the graph. The finer nodes are absorbed as
**plans** inside these phases, including the parallel edge inside Phase 33. Six
sits inside the 4-6 `standard` band; nothing here is a technical layer and
nothing here is a thin maintenance phase.

**Why the gate is a phase and not a criterion inside one, for the third time —
and what is different this time.** Phase 9's `R4` fired and returned `degrade`,
and the milestone shipped smaller and correct. Phase 23's `R1` fired and
returned `no-go`, five plans before the measurement it gates existed. A note
inside a larger phase makes that gate skippable; a phase boundary makes it
structural. What changes here is the gate's **input domain**: Phase 23 could
return `could-not-run` because every one of its inputs needed a corpus.
`GATE-01`'s `go` inputs include the protocol's jitter-immunity and the seed's
effect, both measurable **before** any corpus exists, so this gate cannot fail
to produce a verdict for want of a capture.

**33 -> 35/36 -> 38.** `PROOF-*` need a reproducible corpus, and the corpus needs
the protocol. This is the edge the whole milestone hangs on, and it is the one
v0.6.0 discovered it did not have.

**33's two halves are parallel.** The snapshot slicer touches no emulator and is
independent of the stop, so it runs as a concurrent plan rather than behind one.

**34 before 35 and 36, never after** — the constraint most likely to be
"optimised" away and the one that costs most if it is. Three independent
reasons: it gates the Ghidra post-script's output format; it gates any skill
script reaching a host binary at all; and the whole-tree grep gate banning an
external-binary spawn from a skill script can only be written once **nothing**
violates it, while two skill scripts violate it today. Inlining
`spawnSync("dxa", …)` "just for the measurement phase" means writing the
violation twice and deleting it twice, and the second deletion is the one that
gets skipped. Phase 34 reads no Phase 33 artifact — it sits after 33 only
because `GATE-01` holds the authority to narrow it.

**35 -> 36, the strongest edge in the graph.** Ghidra alone with zero hints
produced **0 functions and 0 code bytes** on the pivot fixture. dxa's map is not
an optimisation; it is what makes Ghidra work at all on a headerless 6502 image.

**SLEIGH before the Ghidra acceptance run, inside 36** — the compile gate as the
phase's earliest task and the language-selection assertion as its **first**
criterion. Crack and packer code is exactly where the 105-byte gap bites, so an
acceptance run taken before the extension works measures the wrong thing while
reporting a pass.

**36 -> 37 -> 38.** Nothing to import until the export exists; the join reads
back out of the store; the proofs read the join. One edge inside that chain is a
hard dependency rather than a preference: **`GHID-02`'s volatile carve gates
`AUTO-04`** — no volatile carve means no recovered `$01` literals, which means
no bank state, so the bank-before-address criterion would have nothing to
resolve. **35 -> 37** holds as well, because `AUTO-07` feeds derived graphics
ranges back to dxa as `-b` data blocks.

**Where the researchers disagreed, and how it was resolved.** One folded dxa +
SLEIGH + Ghidra into a single phase; another split them three ways and
additionally split corpus capture and the importer into their own nodes. This
roadmap splits the engines — they carry independent gates, and the dxa listing
parser has nothing to do with the `.ldefs` question — but folds corpus capture
into 33 and the importer into 37, because each is one plan and each is
meaningless without its neighbour. Splitting the importer out would produce
exactly the thin phase this project's granularity guidance says to fold.

**Research flags.** `/gsd-plan-phase --research-phase 34` is warranted: the
execution seam is the one section of this milestone's research resting on survey
rather than measurement, with two unprobed questions (whether `-process` batch
framing amortises the measured 12-17 s JVM startup across a corpus item, and the
cost of Ghidra plus a JDK in GitHub Actions). Phase 33 needs **probes inside the
phase**, not a research pass — autostart determinism with true drive emulation
in the loop, and whether the transient allow-list method holds on a real
release. Phases 35, 36, 37 and 38 are implementation and measurement against
measured inputs; skip `--research-phase` for all four.

**Eighteen criteria in this milestone are worthless as bare assertions**, and
each needs a control **observed red** — against a failure mode that fails
silently, asserting the fix is present proves nothing. Distribution: 8 in Phase
33 (RAM-init determinism, the reproducible-run protocol, the capture
equivalence oracle, `default_memspace`, warp-safe waits, and the three
allow-list controls), 2 in Phase 34 (the 64 KiB cap, the new-prefix floor), 6
across Phases 35 and 36 (the dxa parser refusal, the SLEIGH compile, the SLEIGH
language selection, the harness log check, the volatile carve **on both import
routes**, the `DataTypeManager` control) and 6 in Phase 37 (narrowest-range-wins,
the tie-break, the in-image skip, bank-before-address, the path-dependent
decline, the graphics feedback) — with overlap where one control serves two
phases. **The plannable shape is fixed rather than left to preference:** for
each row, a **task whose deliverable is the red transcript, separate from the
task that implements the fix**, with the transcript committed. The risk is
**scale**, not novelty — this project already does this well, and eighteen red
observations is a lot. The warning signs, written down so a reviewer can use
them: a criterion whose verification sentence contains "is present", "is set",
"is configured" or "is marked"; a phase closing with a controls **count** but no
transcripts; a control that has never been observed failing. The full table with
each required observation is at `.planning/research/PITFALLS.md` §
*Pitfall 23*.

**The guard-breakage inventory is distributed into the phase that breaks each
guard**, rather than collected here — see each phase's Notes. Roughly **18
committed guards** will go red across the milestone, of which **five are
reviewed decisions rather than mechanical fixes**: `ControlRequestKind`'s
byte-exact declaration and `EXPECTED_IMPORTERS`' five-member host-path consumer
set and `EXPECTED_EMULATOR_SPAWN_SITES`' `=== 1` (all Phase 34),
`BACKEND_SEAM_BYPASS_KEYS`' two order-sensitive entries (Phase 37), and
`MANUAL_ONLY_TESTS`' exactly-nine files (Phases 33, 35 and 36, wherever a live
suite lands). Two traps a planner must not discover in a red CI run are called
out where they bite, both in Phase 34: `spawn-seam.test.ts`'s discovery
predicate matches `\bbinPath\b`, so a host-tool executor spawning **Ghidra** is
counted as an *emulator* spawn site; and `hostpath-consumers.test.ts`'s
non-vacuity floor is pinned over the `anno-*` prefix, so a new `ghidra-*` /
`dxa-*` family sits outside its scan entirely.

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
| 33. The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) | v0.8.0 | 12/12 | In Progress | - |
| 34. The Host-Tool Execution Seam | v0.8.0 | 4/6 | In Progress | - |
| 35. dxa, Vendored and Parsed | v0.8.0 | 0/0 | Not started | - |
| 36. The SLEIGH Language and the Ghidra Harness | v0.8.0 | 0/0 | Not started | - |
| 37. The Importer and the Automatic Annotation Join | v0.8.0 | 0/0 | Not started | - |
| 38. PROOF-01..03 on Real Cracked Code | v0.8.0 | 0/0 | Not started | - |

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
scope decision rather than archaeology.

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
*Phase numbering is continuous across milestones and never reused, including the cut Phases 20-22, the held Phases 24 and 26, and Phase 25 whose content was taken forward while its number was retired.*
