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
- ✅ **v0.9.0 The Text Channel and the Runtime Evidence Layer** — Phases 39-44 (opened 2026-09-06, shipped 2026-09-10; 20/20 requirements, 51 plans, 123 tasks; `CHAN-01` returned **`go`** by rule `R15` — the first `go` of this project's four gates). Requirement count was corrected 20→19 on 2026-09-08 when `PREP-03` was removed by owner direction, then back to 20 the same day when `PREP-05` was added by owner direction during the Phase 40 UAT; see `docs/phase40-preprocessing-tools-decisions.md`

- ✅ **v1.0.0 The Rebuild Half** — Phases 45-50, 52, 55, 56 (opened 2026-09-10, **shipped 2026-09-16**; 9 phases, 73 plans, 203 tasks, 33/33 in-scope requirements, `override_closeout`). **Phases 51, 53, 54 and 57 are CARRIED FORWARD** with their requirement text live — `VOCAB-01..06`, `DOCS-01..04` and `INSTALL-01..05`, 15 requirements in total — following the same rule v0.6.0's held Phases 24 and 26 were kept under. Two of those three families need **re-scoping rather than resumption**: an owner-directed quick task on 2026-09-14 retired the planning-vocabulary convention outright and deleted the guards `VOCAB-*` and `DOCS-04` are written against. The original scoping note follows, unedited: opened 2026-09-10; 15/15 requirements mapped: `DECOMP-01..04`, `BUILD-01..07`, `EQUIV-01..04`). The three phases cut at the v0.5.0 close, taken forward a third time and finally standing on a substrate where nothing they depend on is hypothetical. **No opening go/degrade/no-go gate phase** — a recorded decision, reasoned in the phase section below; the gate discipline is distributed as a red-observed control in every phase, plus `BUILD-06`'s own gate phase (49) standing before the phase it gates (50)
- 🚧 **v1.1.0 The Prerequisite Doctor** — Phases 58-62 (opened 2026-09-16, roadmap created 2026-09-16; **24/24 requirements mapped, each to exactly one phase** — `DECL-01..05`, `LOC-01..07`, `DOCTOR-01..09`, `GEN-01..03`). The user's **first hour**, deliberately upstream of the Core Value and extending none of it: one command that says what is missing and what each absence costs, one file that says where an oddly-located tool lives, and one declaration standing behind both. **Phases 51, 53, 54 and 57 stay CARRIED and are NOT in this milestone** — their 15 requirements (`VOCAB-01..06`, `DOCS-01..04`, `INSTALL-01..05`) stay live and untouched. Phase 57 shares this milestone's subject matter and is excluded on purpose: its goal is to *withdraw* the three never-auto-install carve-outs, and the owner chose at this open to keep them.

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

*v0.9.0 continues phase numbering from Phase 38 — it starts at Phase **39**.
No number is reset and none is reused. Phase **directories** are likewise not
archived, per the standing v0.4.0 decision re-measured at the v0.7.0 close, so
Phases 39-44 land alongside the 34 directories already under `.planning/phases/`
rather than in a fresh tree.*

*v1.0.0 continues phase numbering from Phase 44 — it starts at Phase **45**.
Same two rules, unchanged: no number is reset, none is reused, and phase
directories are not archived — Phases 45-50 land alongside the 40 directories
already under `.planning/phases/`.*

*v1.1.0 continues phase numbering from Phase 57 — it starts at Phase **58**.
The rules are unchanged, and one of them now bites: no number is reset and none
is reused, and the four **carried** numbers are not free. Phases 51, 53, 54 and
57 still hold live requirement text that is not this milestone's, so 58 is the
first available number rather than 51. Phase directories are again not archived,
so Phases 58-62 land alongside the directories already under `.planning/phases/`.*

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

- **Monitor-output format drift across VICE versions is *semantic*, not
  syntactic, so a fixture-only defence keeps passing while returning the
  inverse answer.** *(Added at the v0.9.0 open, 2026-09-06.)* The dated
  instances: VICE **3.4** inverted the meaning of `mc`/`ms`'s glyphs with no
  layout, delimiter or column change to signal it; **3.0** widened `chis`'s
  cycle column; **3.5** added a new `memmapshow` access class. A parser pinned
  before 3.4 raises nothing and reports the opposite of the truth. Any text
  format this project parses is therefore pinned to an exact
  `(binary sha256, VICE version)` pair, captured from **at least two real
  binaries**, parsed into closed enums, and made to **fail loudly on an
  unrecognised value** — the control being a planted fixture carrying one,
  observed making the parser refuse.

- **The text monitor halts the machine on command, so it is a second channel
  needing the same serialization discipline — not a free side-channel.**
  *(Added at the v0.9.0 open, 2026-09-06.)* MEASURED 2026-08-27 against genuine
  stock 3.9: the stopwatch counter advanced only across an `x`. Bind-time
  coexistence with the binary monitor is confirmed; **interleaved command
  behaviour is not**, and the binary monitor's own one-client rule already
  produces a second `connect()` that sits unserviced with no reply and no EOF,
  indistinguishable from a wedge. Any code that issues a halting command on
  either channel goes through one serialization authority, and any triage that
  reads "not advancing" must be able to say *contended* as well as *wedged* —
  a healthy contended instance recycled is evidence destroyed.

- **`c1541` and `cartconv` exit `0` on error.** *(Added at the v0.9.0 open,
  2026-09-06.)* MEASURED; only `petcat` returns non-zero. An exit-status check
  over these two passes failures silently, which is the same failure class the
  real-ACME verify path already refuses to have — it reads the tool's own
  output and carries `skipped` as a third outcome that is never a pass. Every
  host tool this project adds decides its outcome from what the tool *said*,
  and proves it with a planted failure whose exit-status-only check is shown to
  **pass** on the same input.

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

<details>
<summary>✅ v0.9.0 The Text Channel and the Runtime Evidence Layer (Phases 39-44) — SHIPPED 2026-09-10</summary>

**Delivered:** a second monitor channel to the same running emulator, five
text formats parsed into structured data, three preprocessing host tools, and a
runtime-evidence layer that keeps what the machine *did* apart from what its
bytes *imply*. `CHAN-01` returned **`go`** (rule `R15`) — the first `go` any of
this project's four go/degrade/no-go gates has returned. 20/20 in-scope
requirements; 51 plans; all six phases `verification_status: passed`.

**Goal:** Dial the `-remotemonitor` text-monitor port this project has opened on
every stock launch since Phase 3 and never connected to, and make what the
emulator *observed* a durable, accumulating class of fact — kept deliberately
apart from what the bytes *imply*, with disagreement between the two as the
highest-value output rather than an error to reconcile.

**19 requirements, all mapped, each to exactly one phase** — `CHAN-01..05`,
`PARSE-01..04`, `EVID-01..06`, `PREP-01`, `PREP-02`, `PREP-04`, `PROOF-04`.
Cross-checked mechanically against the per-phase `**Requirements**:` lines
below rather than by eye, because this project has a recorded history of a
requirement owned by two phases or by none. **AMENDED 2026-09-08** — originally
20 requirements including `PREP-03`, struck from scope by owner direction at
the Phase 40 discussion; see `docs/phase40-preprocessing-tools-decisions.md`.

**Six phases, and the first one's deliverable is evidence rather than code.**
`CHAN-01`'s verdict selects which of three structurally different serialization
modules Phase 41 builds, so every phase after it states what it becomes under
each verdict rather than assuming the favourable one. Two items research proposed
as phases are **not** phases here: the `.annostore` schema-bump question is a
decision record folded into Phase 43 — it is `EVID-02`, and it belongs beside the
code that adds the table — and the `c1541`-supersedes-`d64-parse.mjs` question is
already deferred to Future Requirements and needs no phase at all.

- [x] **Phase 39: The Dual-Channel Coexistence Gate (Go/Degrade/No-Go)** - Five named live experiments against genuine stock 3.9 answer whether a text client and a binary client can drive one emulator without corrupting each other, against rules committed to git before any measurement exists — with the authority to narrow or cancel every phase after it (completed 2026-09-08)
- [x] **Phase 40: The Three Preprocessing Host Tools** - ~~`c1541`, `petcat` and `cartconv` reached over v0.8.0's typed `host_tool` control op, with a failure reported as a failure on two tools that exit 0 on error~~ **AMENDED 2026-09-08** — `c1541` and `petcat` reached over v0.8.0's typed `host_tool` control op, with a failure reported as a failure despite `c1541` exiting 0 on error (`cartconv` removed from scope by owner direction, see `docs/phase40-preprocessing-tools-decisions.md`) — fully independent of the gate and of the channel, and runnable beside Phase 39 from day one (completed 2026-09-08)
- [x] **Phase 41: The Text Channel, Its Serialization Authority, and the Contention Verdict** - A tool call reaches the text monitor with responses framed by the prompt rather than by a timeout, every halt-taking operation on either channel passes through the serialization shape Phase 39 selected, and a contended instance is reported as contended rather than recycled (completed 2026-09-09)
- [x] **Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures** - Five human-formatted text outputs become structured data behind one owning module each, with `memmapshow`'s execute bit preserved as its own bit — and a drifted format failing loudly instead of returning an inverted answer (completed 2026-09-10)
- [x] **Phase 43: The Runtime Evidence Layer** - Observed execution becomes durable, run-keyed, monotonically accumulating store state joined against the byte-derived block table disagreement-first, opening on a committed-before-measurement A/B that says whether instrumenting a run destroys the reproducibility its rows are keyed on (completed 2026-09-10)
- [x] **Phase 44: PROOF-04 — The Independent External Check** - `PROOF-01`'s false-positive count computed for the first time, using observed execution as the independent oracle it shipped without, closing a reversal condition stated verbatim at the v0.8.0 open (completed 2026-09-10)

**Phase details, the dependency edges, the per-verdict branches and the
sequencing rationale** are in the two v0.9.0 sections further below, placed after
v0.6.0's for the window-slicing reason recorded there.

</details>

### ✅ v1.0.0 The Rebuild Half (Phases 45-50, 52, 55, 56) — SHIPPED 2026-09-16
*(Phases 51, 53, 54 and 57 below are **carried forward** with live requirement
text; they are not part of v1.1.0 and their checklist entries stay unticked.)*

**Goal:** Ship the "and rebuild" half that `## What This Is` has claimed since
v0.1.x and never delivered — from an annotated binary to ACME source a person
can actually read, change, reassemble and observe behaving identically in VICE.

**15 requirements, all mapped, each to exactly one phase** — `DECOMP-01..04`,
`BUILD-01..07`, `EQUIV-01..04`. Cross-checked mechanically against the per-phase
`**Requirements**:` lines further below rather than by eye, because this project
has a recorded history of a requirement owned by two phases or by none.

**Phase numbering continues at 45.** No number is reset and none is reused.
Phase **directories** are likewise not archived, per the standing v0.4.0
decision re-measured at the v0.7.0 close, so Phases 45-50 land alongside the 40
directories already under `.planning/phases/` rather than in a fresh tree.

**The governing constraint binds every phase below, not just the two that name
it:** *the tool reports; the end-user decides what gets reverse-engineered.* No
phase here delivers behaviour that removes, strips, drops or excludes part of a
subject binary on the tool's own judgement. **Phase 46 exists specifically to
make that invariant structural rather than stated** — it builds the recorded
exclusion mechanism and the no-filter guard *before* the exporter is widened, so
Phase 47's multi-file work is written against an already-enforced invariant
instead of having one retrofitted onto it. Phase 48's hazard report enumerates
and acts on nothing it finds.

**No opening go / degrade / no-go gate phase — and that is a recorded decision
rather than an omission.** Four prior milestones opened with one (Phases 9, 23,
33, 39), and each probed the same shape of unknown: a fact about something this
project does **not** control — could a third-party analyser be driven headless;
did the pivot's numbers hold on real cracked code; could a real emulator be
stopped frame-exactly; could two clients share one upstream VICE. v1.0.0 has no
unknown of that shape. Every substrate it stands on is code this project owns
and already ships: `.annostore`, `anno-export-asm.ts`, `acme-verify.ts`'s
real-ACME byte-diff oracle, `scanIndirectDispatch()` (which already survived a
false-positive incident, CR-04), `capture-pair.mjs`/`compare.mjs`, and v0.9.0's
`anno_evid_exec` join. Research returned HIGH confidence on all four axes with
**zero new npm dependencies and zero new host prerequisites**, and the one real
blocker it found — `host-tool.mts`'s `acme.build` spawn setting no `cwd` — is an
identified defect with a one-line fix, not an open question. The two genuinely
unproven requirements (`BUILD-04`'s hazard detection and `EQUIV-01`'s
cross-binary comparison, both with essentially no reusable prior art) have
failure modes that **narrow a requirement**, not cancel the milestone: a hazard
class that cannot be decided statically is reported `unclassified`, which is the
degrade path built into the requirement itself, and a comparison that cannot
separate signal from noise degrades `EQUIV-02` to a narrower, honestly-qualified
claim. The gate discipline is therefore **distributed rather than dropped**, and
in its stronger form — every phase below carries at least one control that must
be **observed going RED** at the point of use, rather than one gate measured once
up front. Where the discipline genuinely binds, it is still a phase: **Phase 49
is `BUILD-06`'s gate, its rules committed to git before its first real run, and
it stands before the phase it gates** (Phase 50), on this project's own Phase 9 /
Phase 12 precedent.

**`BUILD-04`'s purpose-built synthetic subject ships inside Phase 48, with the
detector — owner decision 2026-09-10 ("Strategy B").** Research produced two
competing sequencings and declined to pick between them; the owner picked. A
fixture built ahead of its detector gets written to *match* it rather than test
it, which is the exact failure mode this project measured on the `COV-01`
coverage instrument across four verification rounds. There is therefore **no
separate early "build the fixture" phase**, and that choice has a named cost
recorded in the sequencing rationale below rather than left to be discovered:
Phase 47's export work cannot use the purpose-built subject, so it runs against
the existing committed fixtures and Phase 48 re-runs the multi-file export path
over the new subject as one of its own criteria.

**Explicitly carried, NOT in scope, and no phase may quietly absorb them:**
`PROOF-03` on real cracked code; the `audit-root-args.test.ts` scratch-fixture
race; the 3-failure `test:automated` floor in `anno-register`/`anno-import`;
`STORE-03`'s traceability row contradicting its own verifier's quoted sentence;
`ANNO-13`/`14`/`15`; and the live `broker-owned-tool-output-paths` seed. Each
was weighed at this open and left standing on the owner's decision to scope
v1.0.0 to the rebuild half alone.

- [x] **Phase 45: Decomposition to Closure, Disagreement First** - Every byte of the committed fixtures carries a type, a name and a documented purpose, with the two independent classifiers' disagreements resolved rather than averaged — and an honest decline wherever the evidence is genuinely path-dependent (completed 2026-09-11)
- [x] **Phase 46: The Lossless-Export Invariant and the Provenance Carry** - The export path is made structurally incapable of dropping a byte on its own judgement, and what the provenance evidence says about a range travels with the range to the point of use — built before the exporter widens, not retrofitted after (completed 2026-09-11)
- [x] **Phase 47: Multi-File Rebuildable Source** - An annotated store becomes a tree of ACME files a person can open and edit — one file per scope, data tables in their own swappable files, every reference through a symbol — and real ACME assembles the tree back to the same program (completed 2026-09-12)
- [x] **Phase 48: The Movement-Hazard Report and Its Purpose-Built Subject** - One synthetic C64 program deliberately carrying all four movement-blocking classes, and a report that enumerates them across those four classes — delivered and reviewed together so neither is written to match the other, and acting on nothing it finds (completed 2026-09-13)
- [x] **Phase 49: The Reassembly Gate, Committed Before the Phase It Gates** - A gate that says whether an exported tree really rebuilds — byte-diffed against the image, hazard report attached, movement exercised on every run — with its rules in git before its first real run and its verdict read as a precondition by Phase 50 (completed 2026-09-13)
- [x] **Phase 50: Equivalence and Modifiability** - The rebuild shown behaving like the original in a real emulator and shown being changed, with committed transcripts as the artifacts of record rather than described walkthroughs — and the comparison observed failing before it is trusted (completed 2026-09-16)
- [ ] **Phase 51: Planning Vocabulary Out of the Shipped Server** - The 2384 planning citations still in the 88 modules npm ships verbatim are replaced by the reasoning each one stands for, and the guard that already holds `src/skills/**` at zero is widened to hold the server there too
- [ ] **Phase 53: Operator-Owned `docs/`** - The 21 phase-evidence documents squatting in the operator's own `docs/` tree go back to the phase artifact tree, the citations that pinned them there become the reasons they stood for, and a guard stops the precedent that has quietly recurred at every phase since 2026-08-11
- [ ] **Phase 54: Remove Every Byte-Identical Assertion** - Owner decision: byte-identical checks are unproductive and go. 148 assertion sites across 60 test files -- 72 tests that exist only to assert byte-identity, and 76 assertions inside tests that do other work and keep it

**Phase details, the dependency edges and the sequencing rationale** are in the
two v1.0.0 sections further below, placed after v0.6.0's and v0.9.0's for the
window-slicing reason recorded there.

### Phase 55: Restore the Fork Removal's Dropped Capabilities and Re-Baseline the Proxy Test

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 29 lines that were correct at the time.

`wrapPossiblyChunked()`'s only call site and `stock-recycle.ts`'s bounded post-kill epoch poll restored; 2,826 lines of assertions about five confirmed-gone fork-era mechanisms removed, each naming its successor or its settled no-successor disposition. **Shipped with no VERIFICATION.md, VALIDATION.md or REVIEW.md** — see the v1.0.0 Known Gaps in `MILESTONES.md`.

### 🚧 v1.1.0 The Prerequisite Doctor (Phases 58-62)

**Goal:** A user can find out in one command, before any session exists, which of
this plugin's prerequisites are present and what each missing one costs them —
and when a tool is installed somewhere unusual, point at it once in a file
instead of hunting for the right environment variable.

**This milestone sits entirely upstream of the Core Value and does not extend
it.** It is about the user's first hour, before a session drives anything. No
success criterion below is a claim about driving an emulator, and none should be
read as one.

**24 requirements, all mapped, each to exactly one phase** — `DECL-01..05`,
`LOC-01..07`, `DOCTOR-01..09`, `GEN-01..03`. Cross-checked mechanically against
the per-phase `**Requirements**:` lines further below rather than by eye, because
this project has a recorded history of a requirement owned by two phases or by
none.

**Phase numbering continues at 58**, and the four carried numbers are not free.
**Phases 51, 53, 54 and 57 stay carried from v1.0.0** with `VOCAB-01..06`,
`DOCS-01..04` and `INSTALL-01..05` live; none of them is in this milestone and no
phase below may quietly absorb one. Phase 57 shares this milestone's subject and
is excluded deliberately — its goal is to *withdraw* the three never-auto-install
carve-outs (`scripts/ensure-mcp-deps.sh`, CI's `retry_apt install -y acme`, the
installer's `--vendor`), and the owner chose at this open to keep them exactly as
they are.

**The governing constraint binds every phase below, and binds its tests and its
CI as much as its shipped code:** *never auto-install.* `CLAUDE.md`'s standing
rule (owner, 2026-09-08) is not re-litigated here. Every surface this milestone
adds **detects and reports**; the user runs every install command. **No phase may
be satisfied by code that invokes a package manager** — not a fixture, not a
workflow step, not a convenience flag.

**Two orderings below are structural rather than tidy, and a reader re-planning
this milestone must keep both.** The resolver seam lands **before** the doctor,
because `DOCTOR-05` forbids a second detection path and a doctor built first
would grow one — the ordering is what makes that requirement enforceable instead
of a matter of discipline. And wiring the seam into today's consumers is its
**own** phase, because it is the first regeneration of the committed
`resources/*.mjs` artifacts `resources-sync.test.ts` guards byte-identically, and
because `LOC-03`'s success condition is that *nothing changed* — a claim that
needs its own evidence rather than a corner of a larger phase.

- [ ] **Phase 58: One Declaration, Four Places That Can No Longer Disagree** - Every prerequisite described once — what it unblocks and the remedy per platform — in plain JSON a Node too old to run the server can still parse, and present in the published package
- [ ] **Phase 59: The Tool-Location Seam and Its Precedence Order** - One module owns *where is this tool*, in one order — environment variable, then `tools.json`, then `$PATH` or sibling probe — naming the source that answered and refusing a bad entry by name instead of falling through
- [ ] **Phase 60: The Seam Wired Into the Code That Ships** - Every live resolution goes through the seam and every live remedy comes from the declaration, with a developer who already has `VICE_BIN` set noticing nothing at all
- [ ] **Phase 61: `vice-mcp doctor`, Reachable on a Node Too Old to Run the Server** - One command reports per skill and per MCP capability what is ready and what blocks it, naming every resolved path and which source supplied it, and printing remedies it never runs
- [ ] **Phase 62: The Install Tables Generated, and a Guard That Compares Facts** - `README.md`'s per-platform install tables come from the declaration, and divergence fails the build by comparing parsed records rather than bytes

**Phase details, the dependency edges and the sequencing rationale** are in the
two v1.1.0 sections further below, placed after v1.0.0's for the window-slicing
reason recorded above `### Phase 23`.

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

## v0.9.0 The Text Channel and the Runtime Evidence Layer — SHIPPED (Phase Details Archived)

**Shipped 2026-09-10.** The full per-phase detail, the dependency edges, the
per-verdict branches for `CHAN-01`'s three possible outcomes, and the sequencing
rationale are archived verbatim in
[`milestones/v0.9.0-ROADMAP.md`](milestones/v0.9.0-ROADMAP.md). They are not
restated here, and this pointer replaces roughly 470 lines of detail that were
correct at the time and are preserved unedited in the archive.

**What the archive records, in one line each:** Phase 39 froze `CHAN-01`'s
rules and a 3,888-tuple totality proof *before* measuring, then returned **`go`**
on rule `R15`. Phase 40 landed `c1541` and `petcat` over the `host_tool` seam
and consolidated every tool-written path under `.c64-re-tools/`. Phase 41 dialed
`-remotemonitor` end to end, put both channels behind one FIFO mutex, and
replaced the destructive `wedged` verdict with a named contention verdict. Phase
42 gave each of five text formats exactly one owning parser with two-binary
fixtures. Phase 43 added `anno_evid_exec` at `SCHEMA_VERSION` 4 and the
disagreement-first join. Phase 44 computed `PROOF-01`'s false-positive count for
the first time: 168/45072 at anchor hit 50.

**`PREP-03` (cartridge banks via `cartconv`) was removed from scope** by owner
direction at the Phase 40 discussion, and **`PREP-05` was added** by owner
direction at the Phase 40 UAT — the count held at 20 in-scope requirements. See
`docs/phase40-preprocessing-tools-decisions.md`.

## v1.0.0 The Rebuild Half — SHIPPED 2026-09-16 (Shipped Details Archived; Carried Phases Live)

**Shipped phases 45-50, 52, 55 and 56** are collapsed to one-line pointers below;
their full detail is preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md).
**Phases 51, 53, 54 and 57 are kept in full** — they were carried forward rather
than closed, and their success criteria are still the live specification for work
the next milestone inherits. Read the Active section of
[`PROJECT.md`](PROJECT.md) before re-planning any of them: two of the three
requirement families are written against mechanisms deleted on 2026-09-14.

*Placed **after** v0.6.0's and v0.9.0's sections, deliberately, for the same
window-slicing reason recorded above `### Phase 23`:
`extractCurrentMilestoneScoped()` slices the active milestone's window from its
summary heading to the next version-bearing heading, so a v1.0.0 detail block
placed earlier would swallow — or be swallowed by — a neighbouring milestone's
window. Do not reorder these sections.*

### Phase 45: Decomposition to Closure, Disagreement First

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 51 lines that were correct at the time.

Nine committed fixtures fully typed from real dxa+Ghidra derivation with **zero fabricated code**, six carrying genuine stock-VICE execution evidence. The `decomp-completeness` gate was proven non-vacuous by three planted controls watched going RED against a real store, and criterion 5 ran end to end at **4095/4095 bytes byte-identical** under real ACME 0.97.

### Phase 46: The Lossless-Export Invariant and the Provenance Carry

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 43 lines that were correct at the time.

The lossless-export invariant. A provenance ledger is carried verbatim to point of use, `anno_excluded_range` lands at `SCHEMA_VERSION` 5 recording a user exclusion's extent *and* the reason given, and `BUILD-07`'s planted control is watched dropping a `CRACKER-PATCH` range (RED) before the real exporter is trusted to keep it byte for byte (GREEN).

### Phase 47: Multi-File Rebuildable Source

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 49 lines that were correct at the time.

A store exports as a real **directory** of ACME files that real ACME 0.97 reassembles byte-identically. Data tables leave as sibling `.bin` files — proven swappable by replacing `charset-phantom.prg`'s own 2048-byte character set with zero lines of code touched — and every branch, `JSR`/`JMP` and data reference resolves through a symbol or the export refuses by name, naming both addresses and count.

### Phase 48: The Movement-Hazard Report and Its Purpose-Built Subject

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 54 lines that were correct at the time.

All four movement-hazard classes implemented against a purpose-built subject whose every planted construction is asserted **at the byte level**, never through a detector's opinion. Cross-checked against four programs built weeks earlier for unrelated questions, with the record stating plainly that two of the four classes have no independently-sourced positive example at all.

### Phase 49: The Reassembly Gate, Committed Before the Phase It Gates

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 46 lines that were correct at the time.

The reassembly gate — a seven-input outcome schema and a twelve-rule, first-match-wins table — **frozen in git, alone, before any measurement existed**. Watched turning red on all three named failure shapes, proven by exhaustive 864-combination enumeration to admit no non-clean hazard disposition to green, and its first real run published **`red` under rule `R7`** rather than tuned until it passed.

### Phase 50: Equivalence and Modifiability

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 54 lines that were correct at the time.

`compare-cross-binary.mjs` committed before any rebuild existed to compare under it. Three planted single-bit regressions at `$D020`/`$D015`/`$D018` each produced a named DIVERGENCE row and `VERDICT: FAIL`; the rebuild then gave `VERDICT: PASS`, exit 0, **empty difference set** under the same mask. `EQUIV-03` closed on its literal reading, editing `scope_087a.a` — a file `exportAsmTree()` itself emitted.

### Phase 51: Planning Vocabulary Out of the Shipped Server

**Goal**: `src/mcp/vice/**` stops shipping this project's GSD bookkeeping to npm.
Every planning citation in a module `package.json`'s `files[]` publishes is
replaced by the reason it stands for, and `skills-planning-vocabulary.test.ts`
is widened from the skills tree to the shipped module set so the surface cannot
drift back.
**Requirements**: `VOCAB-01`, `VOCAB-02`, `VOCAB-03`, `VOCAB-04`, `VOCAB-05`,
`VOCAB-06` — minted at planning time (2026-09-14), one per success criterion
below plus `VOCAB-06`, which closes the guard-pattern hole named under "the guard
hole" in Phase 53's notes. Plan `51-02` writes them into
`.planning/REQUIREMENTS.md` with Traceability rows. `VOCAB-06` overlaps `DOCS-04`
in EFFECT but not in id: this phase adds the category and drives that form to
zero across its OWN scan surface, while Phase 53 retains the relocation and the
same form in test files, skill scripts and the vestigial deployment copies.
**Depends on**: Nothing in this milestone. `.planning/ENGINEERING_RULES.md` § 21
and the guard it is enforced by both already exist (2026-09-11), so this phase
can run in any slot. It is numbered last because it was found last, not because
the rebuild work gates it.
**Success Criteria** (what must be TRUE):

  1. `scanForPlanningVocabulary()` reports **zero** occurrences across the file
     set `src/mcp/vice/package.json`'s `files[]` publishes, and the guard that
     measures it runs in `npm run test:automated`.
  2. Each replaced citation states the REASON, not a shorter pointer. A diff
     whose net effect is deleting explanatory comments fails this phase — § 21.2
     requires the WHY header to survive, and a sweep that shortens the house's
     engineering rationale away has done the opposite of the intended thing.
  3. All six comment-pinning guards are green, having been MOVED rather than
     relaxed wherever a pin named text this phase rewrote.
  4. The `.planning/` paths cited from product source that do not resolve are
     gone — not repointed at a different `.planning/` path, which is the same
     defect one hop along.
  5. A planted citation in a shipped module reds the widened guard, proving it
     is not vacuous on the new surface.

**Plans**: 8/17 plans executed, 16 waves

Plans:
**Wave 1**

- [x] 51-01-PLAN.md — TRACER: hoist the comment extractor to its single seam, build the four-source scan enumerator, widen the guard, freeze the count-pinned ratchet and the comment-byte baseline, add the third planted control, repoint `comment-phase-pointers.test.ts`, and take `installer/bin/cli.mjs` to zero end to end
- [x] 51-02-PLAN.md — the citation-resolution index every sweep plan consumes, and the `VOCAB-01..06` minting

**Wave 2** *(blocked on Wave 1)*

- [x] 51-03-PLAN.md — host tools: `host-tool.mts` to zero, artifact regenerated, and the comment-byte slack term finalised against the phase's densest real diff

**Wave 3** *(blocked on Wave 2)*

- [x] 51-04-PLAN.md — broker: `broker-launch.mts`, `broker-control.mts`, `broker-epoch.mts` and their three artifacts

**Wave 4** *(blocked on Wave 3)*

- [x] 51-05-PLAN.md — broker: `vice-broker.mts`, `vice-broker-client.ts`, `broker-state.mts`, `broker-kill.mts` and their three artifacts

**Wave 5** *(blocked on Wave 4)*

- [x] 51-06-PLAN.md — annotation store: `anno-cli.ts` plus four helpers, separating comment sites from user-visible output

**Wave 6** *(blocked on Wave 5)*

- [x] 51-07-PLAN.md — annotation store: `anno-store.ts`, `anno-types.ts` and three helpers, plus the first technical-token collision

**Wave 7** *(blocked on Wave 6)*

- [x] 51-08-PLAN.md — annotation store: the export path and seven siblings, including the file an ordinary text search silently skips

**Wave 8** *(blocked on Wave 7)*

- [ ] 51-09-PLAN.md — annotation store: the tool surface, the enum generator, the coverage gate and the bank helper

**Wave 9** *(blocked on Wave 8)*

- [ ] 51-10-PLAN.md — protocol: `stock-dispatch.ts`, `stock-protocol.ts`, `stock-derived.ts`, plus the second technical-token collision

**Wave 10** *(blocked on Wave 9)*

- [ ] 51-11-PLAN.md — protocol: the text channel's four modules, the connect and diagnosis paths, and the container detector with its artifact

**Wave 11** *(blocked on Wave 10)*

- [ ] 51-12-PLAN.md — protocol: the checkpoint, condition and execution group

**Wave 12** *(blocked on Wave 11)*

- [ ] 51-13-PLAN.md — protocol: the remaining eleven transport modules

**Wave 13** *(blocked on Wave 12)*

- [ ] 51-14-PLAN.md — cross-cutting: the version rules and their runtime refusal message, the shipped third-party notices, the root and path seams, and nine more modules

**Wave 14** *(blocked on Wave 13)*

- [ ] 51-15-PLAN.md — cross-cutting: the five text-monitor parsers and the disassembly and memory-map tables

**Wave 15** *(blocked on Wave 14)*

- [ ] 51-16-PLAN.md — proxy: the server entry point and every advertised tool description

**Wave 16** *(blocked on Wave 15)*

- [ ] 51-17-PLAN.md — FINAL: the last two sources, the ledger emptied and asserted empty, the guard's last stale paragraph rewritten, and all six requirements verified with recorded evidence

Notes:

- **MEASURED 2026-09-11, with the guard's own predicate rather than a hand-rolled
  grep** — so the scope is what the enforcing code actually sees. **2384
  occurrences across 88 of the 92 scannable files** in `files[]`. By category:
  requirement id 914, decision or gap id 814, plan citation 294, phase citation
  165, planning artifact filename 117, `.planning` path 41, planning-document
  cross-reference 34, gsd command 5. Worst files: `vice-proxy.ts` 199,
  `anno-cli.ts` 149, `anno-store.ts` 124, `vice-broker-client.ts` 95,
  `stock-dispatch.ts` 95, `anno-tools.ts` 85, `stock-protocol.ts` 84,
  `anno-export-asm.ts` 74. Separately, **34 of the 77 distinct `.planning/`
  targets cited from `src/` do not resolve** in this checkout.
- **The figure is not the 1663 recorded earlier the same day, and the difference
  is a rule change rather than drift.** That count predates the 2026-09-11
  tightening of § 21.2, which removed the "allowed when the line names the
  defining document" escape for decision AND requirement ids — `docs/` ships in
  the plugin zip but in neither npm tarball, so the qualified form dangles for
  every `npx` install. The 914 requirement ids came into scope with that change.
  Re-measure at planning time rather than trusting either number; both are dated.
- **This is per-site judgement, not a mechanical strip, and that is the whole
  cost of the phase.** § 21.2's worked pair is the standard: `// Phase 40, plan
  40-02 (PREP-01, D-13): reached ONLY through the host-tool seam` becomes
  `// Reached ONLY through the host-tool seam: this script runs container-side
  and the binary lives on the host, so a direct spawn finds nothing.` Every one
  of the 2384 needs someone to know what the citation MEANT. Sites whose meaning
  cannot be recovered are the phase's real risk, and the honest move there is to
  say so in the plan, not to delete the comment.
- **Six committed guards pin comment content in this tree and must move in
  lockstep** (3445 lines between them): `docs-linerefs.test.ts` (584),
  `docs-dangling-refs.test.ts` (458), `comment-phase-pointers.test.ts` (607),
  `hop-chain-comments.test.ts` (454), `docs-absorbed-decisions.test.ts` (231),
  `audit-integrity.test.ts` (1111). Two need care beyond a rename.
  `comment-phase-pointers.test.ts` does not merely pin strings — it ARGUES for
  the practice, recording that "a blanket 'no comment mentions Phase N' rule is
  not viable here" and legalising historical narration. That position is what
  § 21 overrides, so the guard needs its reasoning rewritten, not its literals
  patched. And `docs-dangling-refs.test.ts`'s FLOW-02 check is "deliberately,
  permanently scoped to literals only"; widening it is NOT the route — the new
  guard covers whole files, and the two should not be merged.
- **The guard extension is one function.** `skills-planning-vocabulary.test.ts`'s
  `shippedSkillFiles()` walks `src/skills/**`; the widened form reads
  `package.json`'s `files[]` instead. All eight categories apply unchanged, and
  the file already carries the exemption machinery. Note the ordering trap: the
  guard must be widened LAST or held behind a scope flag, because a guard that
  is red on arrival gets switched off rather than obeyed — the reason it was
  scoped to the skills tree in the first place.
- **The skills tree stays at zero throughout.** It reached zero on 2026-09-11 and
  the existing guard holds it there. This phase must not regress it, and the
  widened guard must keep the skills surface covered rather than replacing it.
- **PLANNING DEVIATION, recorded 2026-09-14, from "this is why Phase 53 runs
  before Phase 51".** Phase 53 has not run, and this phase was planned anyway. The
  hole that ordering existed to close is closed HERE instead, as `VOCAB-06`:
  the guard gains a ninth category matching the `docs/phase*` path form, scoped to
  this phase's own scan surface. MEASURED 2026-09-14: 46 hand-edit occurrences of
  that form fall inside this surface (39 in the server tree, 7 in
  `src/skills/**`), and 16 of the 19 files carrying them are files this phase
  already opens — about 1.5% of the phase. This also removes a live § 21.1
  violation: that section declares the skills tree must be at ZERO and calls the
  rule mechanically enforced, while seven such citations sit there with the guard
  green. Phase 53 keeps `DOCS-01`, `DOCS-02`, `DOCS-03` and the remainder of
  `DOCS-04`'s pattern work outside this surface; it must RE-GREP rather than trust
  any count here.
- **A LOCKED DECISION'S PREMISE WAS CORRECTED, not its structure.** `D-07`'s
  tiered recovery ladder stands. What moved is membership: `D-NN` decision ids are
  phase-scoped, not globally unique (`D-13` alone is independently DEFINED in six
  unrelated contexts across 188 files), so they resolve by a history walk like the
  code-review ids rather than by a single search. Real requirement ids and gap ids
  stay cheap. `Plan NN-MM` citations are cheaper still and get their own tier.
  Plan `51-02` publishes the corrected partition and the per-file originating-phase
  map that makes a phase-scoped id resolvable at all.
- **CONTEXT.md's dangling-citation list is WRONG for its two largest entries.**
  `Plan 41-05` (about 35 occurrences) and `plan 40-03` (about 20) both resolve
  cleanly to real plan and summary documents whose content matches what the citing
  comments say — together roughly 41% of that list's claimed population. Plan
  `51-02` re-derives the set against the real tree rather than inheriting the
  33-token figure.
- **The spec-less probe took its documented visible skip.** No `*-SPEC.md` exists
  for this phase, so there was no edge-coverage or prohibition section to lift
  predicates from, and the probe ran before any requirement id existed. It is not
  re-run now that `VOCAB-01..06` are declared; the plans' `must_haves` are derived
  from the five success criteria above and the locked decisions instead.

### Phase 52: Remove the Fork Backend

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 95 lines that were correct at the time.

The fork backend deleted outright: `vice.ts`, the fork manifest, its probe, `capability-registry.ts` and ~1,800 lines of proxy forwarding. `ViceBackend` narrows to the single literal `"stock"`, **zero fork mentions remain under `src/skills/`**, and the three capabilities stock provably cannot have become permanent accepted losses in `docs/stock-hard-losses.md`.

## Gap closure (round 1, planned 2026-09-12)

`52-VERIFICATION.md` scored 7/8 and returned `gaps_found`. All seven numbered
success criteria above are VERIFIED and all seven `FORKRM-*` requirements
SATISFIED, confirmed against the tree rather than against any summary's word.
The single failed truth is the eighth, derived by the verifier from this phase's
own Goal clause "*...and the decision records retaining it are gone*":

> The documents this project loads into every working session no longer describe
> the fork transport, deleted files, or per-backend selection as CURRENT
> architecture.

`CLAUDE.md` — loaded as project instructions in every session — still described
deleted modules as live components across its Technology Stack, Conventions,
Architecture, Platform Requirements and Error Handling sections. Plan 52-09
correctly scoped its `CLAUDE.md` edit to the `## Constraints` bullet block (byte-synced
against `PROJECT.md` and guarded); nothing told a later plan the rest of the document
was also false, and no guard could see it: `docs-fork-absence.test.ts` scanned for nine
forbidden code identifiers and checked six deleted filenames against *disk and the
published file list*, never against prose.

**Planning found one thing the verification did not.** Those three `CLAUDE.md`
sections are not hand-written — they sit in marker blocks whose own comments name
`codebase/STACK.md`, `CONVENTIONS.md` and `ARCHITECTURE.md` as their sources. All
three sources are dated 2026-09-01, eleven days before the removal, and all three
still describe the fork as a live selectable backend in more detail than `CLAUDE.md`
did. Correcting only the projected copy would have left a regeneration able to push
the falsehood back over the fix — the exact failure `docs-constraints-sync.test.ts`'s
own header records for the `PROJECT.md` pair. Plan 52-12 therefore reconciles both
sides, as that precedent did.

Out of scope by the verifier's own recorded disposition, and not planned here:
`WR-01` and `WR-02` (deferred), `WR-03` and `IN-01` (accepted), and the documented
suite failure floor, which is measured as a SET and never repaired.

Notes:

- **This is a decision reversal with a paper trail, not a cleanup.** `FORK-01`
  was decided `retain` by a human; a todo named
  `fully-remove-the-forked-vice-mcp-backend` was already disposed `retain` and
  moved to `completed/` in plan 14-05. That disposition is now superseded and
  must not be left reading as the current answer. Full basis and guard inventory:
  `.planning/notes/fork-removal-reversal-basis.md`.
- **Order is load-bearing.** `docs-fork-decision.test.ts` (181 lines) asserts
  six properties of `PROJECT.md`'s `FORK-01` row — that it exists exactly once,
  is ISO-dated, names `KEYBOARD_MATRIX_SET` case-sensitively, carries a
  reversal-trigger phrase, and is cited from `### Out of Scope`. It reds on ANY
  edit to that row. Amend the decision record and rewrite that guard together,
  in one step, FIRST — then delete code against a green baseline. A code-first
  pass leaves the suite red throughout and gives no signal about the deletions.
- **`vice.ts` is not a clean delete.** Ten non-test modules import from it, most
  for the shared error hierarchy (`ViceError`, `MachineRestartedError`) and
  `readEpoch`, not the HTTP transport: `stock-symbols.ts`, `stock-petscii.ts`,
  `stock-paths.ts`, `anno-types.ts`, `stock-reproducible-run.ts`,
  `stock-handler.ts`, `stock-recycle.ts`, `vice-sync.ts`. Split the shared
  infrastructure out before removing the transport half.
- **The skills are the half that does not get simpler.** `SKILL-01` says a skill
  written against the full fork surface *breaks* on stock rather than degrading,
  so playbooks name either the stock route or the fork requirement. With no
  fork, every "requires the fork" route becomes a dead end that must be
  REWRITTEN as a stated permanent limitation, not deleted.
  `c64-program-recon/references/tool-selection.md` carries at least one, for
  `vice_sid_get_state`. Grep all nine skills for fork-requirement language.
- **Two known skill defects should land in the same pass, not separately.**
  `c64-program-recon` (13 fork references) and `vice-wedge-triage` (12) are
  already being rewritten by the bullet above, and both defects sit in that
  neighbourhood — reopening these pages twice is the waste to avoid. Neither is
  caused by the fork removal, so neither may be treated as a success criterion
  of this phase; they ride along:
    - `routine-queue-walker` §2.2/§3.2 paraphrases `c64-program-recon`'s
      "Documenting one routine, end to end" procedure instead of calling into
      it as that skill's own scope paragraph claims, and the paraphrase has
      dropped the 4096-byte `anno_read_region` cap (0 mentions vs 5 in each of
      the other two) and the tail-call / fall-through bounds rules (0 vs 4).
      `.planning/todos/pending/routine-queue-walker-restates-instead-of-delegating.md`
    - `c64-memory-mapping`'s 623-line SKILL.md covers three jobs under a
      description promising one.
      `.planning/todos/pending/c64-memory-mapping-is-three-skills.md`
  Measured 2026-09-11; full audit `.planning/notes/skill-redundancy-audit.md`,
  which also records that textual duplication across the nine skills is 12
  lines in 11,040 — so this is a lossy-copy defect, NOT a case for merging or
  deleting skills.
- **`vice_disk_list` is already dead independently of this phase** — it is in
  NEITHER manifest, so the one `DENY_LIST` entry carrying the crash hazard has
  been guarding a tool that exists on no backend. Measured 2026-09-11;
  `.planning/notes/deny-list-is-a-fork-artifact.md`.
- **Blast radius, MEASURED 2026-09-11**: 9 non-test modules reference the
  backend split; whole-file candidates `vice.ts` (772), `vice-probe.ts` (278),
  `refresh-manifest.ts` (124), `tools-manifest.json` (1223); fork-conditional
  branches in 12 test files, worst `backend-detect.test.ts` (22 hits),
  `broker-control.test.ts` (10), `broker-launch.test.ts` (8).
- **Blast-radius correction, RE-MEASURED at planning time (2026-09-11).** The
  figures above undercount, and criterion 7's "12 test files" is the number to
  read against this correction rather than as the bar. Counting `VICE_BACKEND`
  as well as `"fork"`, **19** test files carry a fork-conditional branch: 13 in
  the `test:automated` gate and 6 dispositioned manual-only. Three whole-file
  casualties appear in no earlier note — `fork-manifest-surface.test.ts`,
  `fork-deleted-tools.ts` and `tool-support-table.test.mjs` — as do four
  further fork-manifest readers (`scripts/check-skill-tool-coverage.mjs`, which
  is a CI step and not a suite test, plus `anno-tools.test.ts`, `smoke.mjs` and
  `src/mcp/vice/README.md`). `vice.ts` has **23** non-test importers, not ten.
  Two guards not previously named also fire: `docs-constraints-sync.test.ts`
  requires `CLAUDE.md` and `PROJECT.md`'s `## Constraints` lists to stay
  BYTE-IDENTICAL, so every constraint edit must touch both in one commit; and
  `spawn-seam.test.ts`'s frozen spawn set has exactly one member, the
  `probeBackend()` `--help` probe, so deleting it empties that set. The skills
  half is **27** fork-mentioning lines across 9 files, of which the 9 routing
  sites are a subset.

### Phase 53: Operator-Owned `docs/`

**Goal**: `docs/` contains only what the operator put there. The 27
`docs/phase*.md` evidence documents return to the phase artifact tree and the
`src/**` citations that kept them outside `.planning/` become the reasons they
stood for. No guard is built: criterion 6 was withdrawn 2026-09-17 and the
recurrence risk is accepted (`tools/**` is out of scope — that directory no
longer exists). Re-measured 2026-09-17: 27 documents, 83 citation occurrences
across 34 files, `src/skills/**` already at zero.

**Requirements**: `DOCS-01`, `DOCS-02`, `DOCS-03`, `DOCS-04`

**Depends on**: Nothing. **Should run BEFORE Phase 51** — see "the guard hole"
below. Phase 51 plans to widen this exact guard's file set, and widening it over
a pattern hole ships a guard that is green on the citations it was built to catch.

**Success Criteria** (what must be TRUE):

  1. `ls docs/` shows only operator-authored documents. No `phase*`-named file
     remains, and no `docs/evidence/` or equivalent subfolder was created to hold
     them — the owner rejected that route by name on 2026-09-13.
  2. Each relocated document sits at `.planning/phases/NN-<slug>/evidence/`,
     matching the convention 17 phase directories already follow. `git mv` is used
     so history survives.
  3. `docs/phase0-binmon-findings.md`'s destination is decided and RECORDED. It has
     no phase directory — it was committed 2026-08-11, a day before
     `.planning/ROADMAP.md` existed — and it is the most-cited of the 21.
  4. A grep for `docs/phase` across `src/**` and `tools/**` returns zero. Every
     replaced site states the REASON, per ENGINEERING_RULES section 21.2. A site
     repointed at a `.planning/` path FAILS this criterion — that rule's own
     criterion 4 calls it "the same defect one hop along."
  5. A diff whose net effect is deleting explanatory comments FAILS this phase,
     on the same terms Phase 51 sets. The WHY headers are house style and must
     survive the rewrite.
  6. ~~A guard reds on a `docs/phase*` path appearing in `src/**` or `tools/**`, runs
     in `npm run test:automated`, and is proven non-vacuous by a planted citation.~~
     **WITHDRAWN 2026-09-17 — it asks for a test this project banned one day after
     this phase was written.** Such a guard scans source text by construction. Quick
     task `260914-poo` (2026-09-14, `276c15c9` / `e4759250`) locked D-1 "No test may
     assert on text at all", D-2 "Only data-driven tests of production code are kept"
     and D-6 "retired outright ... no successor", and deleted 60 files on those
     grounds — including the four text-scanning CI checkers and `audit-gate.mjs`, so
     moving the check into CI rather than a test does not escape it either. Its own
     summary records `textmon-seam.test.ts` being "deleted rather than patched"
     precisely because "it imports only node builtins and scans source". This phase's
     notes are stamped MEASURED 2026-09-13; the policy landed 2026-09-14, and the two
     were never reconciled. The owner settled it on 2026-09-17: honour the newer
     decision, drop the guard. **The recurrence risk is accepted and named** — nothing
     mechanical now stops a future plan writing evidence to `docs/` again. `DOCS-04`
     closes as SUPERSEDED, not met.

**Plans**: 5 plans

Plans:
- [ ] 53-01-PLAN.md — Rewrite the 30 citations in the ten npm-published modules
- [ ] 53-02-PLAN.md — Rewrite the 32 citations in the probe script, the fixture module and the fixture tree
- [ ] 53-03-PLAN.md — Rewrite the 21 citations in the thirteen test files
- [ ] 53-04-PLAN.md — `git mv` the 27 documents, repoint the two guard tests, record the orphan decision
- [ ] 53-05-PLAN.md — Repair the 98 references the move stranded, and demonstrate criteria 1-5

Notes:

- **This is not GSD's doing, and the fix is not a GSD setting.** Nothing in the
  vendored `gsd-core/` tree writes to `docs/`; every one of these files was written
  by a plan that named the path. Stock GSD prescribes no evidence directory at all
  — there is no `.planning/phases/*/evidence/` string anywhere in it. The
  `evidence/` subdirectory is this project's own convention layered inside GSD's
  phase artifact directory, and it is already the majority practice: 17 phase
  directories use it.
- **How the precedent started.** `docs/phase0-binmon-findings.md` was committed
  2026-08-11 (`68b0a799`); `.planning/ROADMAP.md` first appeared 2026-08-12. At that
  moment `docs/` was the repository's only documentation directory, so the first
  phase's evidence landed there because there was nowhere else. Every later phase
  copied it — the rest are all `docs(NN-NN):` commits. Nothing re-examined the
  choice for thirteen months of phases, which is exactly why criterion 6 exists.
- **What kept it alive is a rule whose justification has since expired.**
  ENGINEERING_RULES section 21 bars `.planning/` paths from product source, so
  evidence that `src/**` cited could not live in `.planning/` and `docs/` was the
  only alternative. Section 21.2 was then tightened on 2026-09-11 on the
  measurement that `docs/` ships in the plugin zip but in NEITHER npm tarball — so
  a `docs/`-qualified citation "looks like a working cross-reference and sends the
  reader after a file they do not have." That tightening banned the decision ID
  form but left the `docs/phaseNN-*.md` PATH form standing. The paths dangle for
  every `npx` consumer exactly as the banned form did, and the filename smuggles a
  phase number into shipped source besides. The operator's folder complaint and a
  live section 21 gap are the same defect.
- **MEASURED 2026-09-13 — OBSOLETE as of 2026-09-17, superseded by the two notes below.**
  This note originally read: 21 of 27 files in `docs/` are `phase*`-named, 20 of the 21
  map onto a live phase directory, `phase0` is the single orphan, 89 hand-edit citation
  occurrences across 37 files, of which 39 occurrences in 15 files fall inside Phase 51's
  scope. Re-measurement on 2026-09-17 found the orphan count wrong: `phase0-binmon-findings.md`
  is not the only pre-roadmap document with no matching phase directory —
  `phase1-probe-results.md` and `phase2-backend-probe-evidence.md` are orphans too. The
  Goal paragraph above carries the counts this phase actually closed with.
- **ORPHAN DESTINATIONS — DECIDED and RECORDED 2026-09-17 (`DOCS-02`).** All three
  pre-roadmap documents are placed by the evidence of which plan authored them, not by the
  number in their filename:
  - `docs/phase0-binmon-findings.md` and `docs/phase1-probe-results.md` both appear verbatim
    in `.planning/phases/01-corrected-ground-truth/01-04-PLAN.md`'s own `files_modified:`
    frontmatter list — that plan authored both documents. Destination:
    `.planning/phases/01-corrected-ground-truth/evidence/`.
  - `docs/phase2-backend-probe-evidence.md`'s own opening paragraph names its origin —
    it records evidence-gathering "plan 02-02 was supposed to perform" — and its body cites
    the decision record it overrides, `.planning/phases/02-stock-backend-connection/02-CONTEXT.md`.
    Destination: `.planning/phases/02-stock-backend-connection/evidence/`.
  All three moved with `git mv` in plan 53-04; `git log --follow` on each returns its
  pre-move history.
- **The ordering is load-bearing and runs opposite to intuition.** The citations
  must be rewritten BEFORE the files move. Moving first leaves 42 files pointing
  into `.planning/`, which is a straight section 21 violation and precisely the
  "one hop along" failure criterion 4 forbids. Rewrite, verify zero, then `git mv`.
- **THE GUARD HOLE — MEASURED 2026-09-13, OBSOLETE as of 2026-09-17.** This note
  originally read: `src/skills/**` carries 7 `docs/phase45-*.md` citations
  (`routine-queue-walker/scripts/completeness-report.mjs:79`, `SKILL.md:92` and `:163`,
  and `scripts/completeness-report.test.mjs:22`, `:468`, `:491`, `:512`), and
  `skills-planning-vocabulary.test.ts` passed 5/5 green with all seven in place because
  its category patterns did not match the `docs/phase*` path form — the rule was violated
  and the enforcement reported otherwise. That test file no longer exists: it was deleted
  2026-09-14 (`276c15c9`, quick task `260914-poo`) under the standing decisions that
  retired the text-scanning-test shape outright. There is nothing left to widen, and
  `src/skills/**` measures zero `docs/phase` citations as of this phase's start.
- **This is why Phase 53 runs before Phase 51, not after.** Phase 51's guard
  strategy is to widen this same file's `shippedSkillFiles()` from the skills tree
  to `package.json`'s `files[]`. Widening the FILE SET over an unfixed PATTERN hole
  inherits the hole: the widened guard would be green across all 102 `docs/phase*`
  occurrences, and Phase 51's own criterion 5 — a planted citation reds the widened
  guard — would pass while this entire form goes uncaught. Close the pattern first,
  then let 51 widen the set.
- **Neither phase subsumes the other.** 51 is scoped to what npm publishes: 39 of
  the 102 occurrences, in 15 of the 42 files. The other 64 occurrences across 27
  files sit where 51 never looks — tests, `.mts` sources, skill scripts, the
  gitignored `tools/` copies. Whichever runs first, the second must RE-GREP rather
  than trust any count written here.
- **THREE FILE CLASSES, and a raw grep conflates them.** MEASURED 2026-09-13:
  - **Canonical, 37 files / 89 occurrences** — hand-rewrite each. These are the
    phase's actual work.
  - **Generated, 4 files / 9 occurrences — OBSOLETE as of 2026-09-17, measures zero
    today.** Originally: `src/mcp/vice/resources/broker-launch.mjs` and `host-tool.mjs`
    (compiled from the `.mts` by `build.ts`), plus `installer/skills/routine-queue-walker/`'s
    two files (copied from `src/skills/` by `sync-skills.mjs`, untracked). The `.mts`
    sources that fed those generated files no longer carry `docs/phase` citations, so
    this class is empty by the time this phase executed.
  - **Dead, 3 files / 8 occurrences — OBSOLETE as of 2026-09-17, the directory no
    longer exists.** Originally: `tools/broker-launch.mjs`, `tools/host-tool.mjs`,
    `tools/backend-detect.mjs`, to be DELETED rather than rewritten. `tools/` itself is
    gone from disk (`ls tools` returns "No such file or directory"); this class has
    nothing left to act on.
- **Delete the stale layout tree while here — OBSOLETE as of 2026-09-17, already
  gone from disk.** Originally: `tools/` (12 files), `.vice-snapshots/` (4) and
  `.vice-supervisor/` (40) were the pre-consolidation locations `.gitignore` said were
  "left on disk, unread, for the user to delete by hand." Re-measured 2026-09-17: all
  three are unresolvable (`ls tools` → "No such file or directory") — the user already
  removed them by hand. Nothing left for this phase to do here.

### Phase 54: Remove Every Byte-Identical Assertion

**Goal**: No byte-identical assertion remains anywhere in the test suite. Owner decision
2026-09-13: they are unproductive and are removed, including the three tree-sync guards.

**Requirements**: TBD -- declare at planning time

**Depends on**: Nothing.

**Success Criteria** (what must be TRUE):

  1. Zero byte-identical assertions remain. Measured by the same census that scoped this phase,
     re-run at verification time rather than trusting the counts below.
  2. **No unrelated coverage was deleted as collateral.** A test that merely CONTAINED a
     byte-identical assertion among others keeps every other assertion it had. Only tests whose
     entire purpose was asserting byte-identity are removed outright. The phase reports both
     numbers separately.
  3. `npm run test:automated` is green, and the test COUNT drop is accounted for -- stated as a
     number and reconciled against the 72 deletions, so a silently broken file cannot hide
     inside the expected decrease.
  4. No test file is left empty, and none is left with only setup and no assertions.
  5. `node build.ts` is run and `resources/` committed if any `.mts` is touched.

**Plans**: TBD

Notes:

- **MEASURED 2026-09-13.** 60 files carry the phrase. 62 occurrences are comment-only and need
  no code change. **76 sit inside an assertion; 72 are whole `test()` titles.** Re-measure at
  planning time; these are dated.
- **The collateral trap, and why criterion 2 exists.** A title-based sweep would delete tests
  that merely USE the phrase while testing something else entirely. Two measured examples:
  `anno-store.test.ts:3848` is "a retained snapshot TRUNCATED to zero bytes is REFUSED by name"
  -- a data-corruption guard; `containerpath.test.ts:126` is the loopback-rewrite matrix for
  the host/container path seam. Neither is a byte-identity test. Deleting them would remove
  coverage the decision never targeted. Read each of the 72 before removing it.
- **What is knowingly given up.** Most of the 148 are determinism and idempotence assertions
  about the product: the exporter producing identical source across two runs over an unchanged
  store (`anno-export-asm.test.ts`, 22 sites), argv stability across successive
  `buildHostToolArgv()` calls, string-path and object-path producing the same output for the
  same logical condition. After this phase, a change that makes any of those non-deterministic
  is not caught by the suite. That is the accepted cost of the decision, recorded so it is not
  rediscovered as a surprise.
- **`resources-sync.test.ts` is the one removal with a deploy consequence.** `resources/*.mjs`
  is committed BUILD OUTPUT, and that test was what made a stale committed build a failure
  rather than a silent bad deploy -- its own header names the scenario: "developer edits .mts,
  forgets to rebuild, commits the stale resources/ tree". That path is exercised routinely. The
  replacement does not need a byte-identical assertion: run `node build.ts` in CI and fail on a
  dirty tree (`git diff --exit-code -- src/mcp/vice/resources/`). Recorded with its ordering
  constraint in `.planning/seeds/replace-resources-sync-with-a-ci-build-step.md`. Do this in
  THIS phase or explicitly decide not to -- do not leave the hole undocumented.
- **`anno-verb-coverage.test.ts:451` is the one removal with no downside at all.** It compares
  `installer/skills/` against `src/skills/`, but that tree has ZERO files tracked in git and
  `installer/package.json` regenerates it on `prepack`, so the test cannot protect what ships.
  It only ever failed on a stale or polluted local copy -- which it did, twice on 2026-09-13,
  once nearly derailing a push.
- **`docs-constraints-sync.test.ts` removal has a documented consequence**: CLAUDE.md's
  Constraints block is regenerated from `.planning/PROJECT.md`, so a CLAUDE.md-only edit is
  silently wiped on the next regeneration. Nothing will warn after this phase.
- **Ordering: do the census FIRST, in one pass, and commit it** before deleting anything. A
  sweep that re-greps after each edit measures a moving tree and cannot reconcile criterion 3.

## Sequencing Rationale (v1.0.0)

**Why decomposition is first, and why it does not wait for the new subject.**
Every later phase assumes a classified, named subject: the exporter emits
symbols the decomposition created, the hazard report queries the block table the
decomposition filled, and the gate byte-diffs against an image the decomposition
described. Phase 45 needs no new architecture at all — it runs on tools that
shipped in v0.7.0 and v0.9.0 — so making it first costs nothing and unblocks
everything. It runs against the **existing** committed fixtures deliberately:
the purpose-built subject ships in Phase 48 with its detector, and a
decomposition phase that waited for it would idle for two phases to gain
nothing it needs.

**Why the invariant comes before the exporter that must honour it.** Phase 46
builds the recorded-exclusion mechanism and the structural no-filter guard
before Phase 47 widens `anno-export-asm.ts` for multi-file output. The order is
the point: an invariant enforced first means the multi-file work is *written*
against it, while an invariant added afterwards means auditing scope-splitting,
`!source` wiring and table extraction for filtering behaviour that was never
prevented in the first place. This is the same "rules and instrument before the
work they gate" shape as Phase 9, Phase 12, Phase 23, Phase 33 and Phase 39,
applied to an invariant instead of a measurement.

**Why the hazard report and its subject are one phase — and what that costs.**
Owner decision, 2026-09-10, "Strategy B". Research produced two defensible
sequencings and refused to choose; both reasoned from real incident history.
Strategy B wins on the stronger precedent: this project already paid for a
self-validating instrument once, on `COV-01`, across four verification rounds
each finding new gameability. Same-phase delivery puts fixture and detector in
front of one reviewer under one non-vacuity bar. **The cost is real and is
recorded rather than discovered:** Phase 47 cannot exercise the new subject's
hazard-adjacent shapes — SMC operand labels, split hi/lo tables — through the
multi-file path, because that subject does not exist yet. Phase 47 therefore
runs against the existing committed fixtures, and Phase 48 carries re-running
the multi-file export over the new subject as one of its own criteria. Strategy
A would have inverted this cost, not removed it.

**Why `BUILD-04` is one phase and not four.** It reads as four detectors and is
three plus a reuse: `anno-coverage.ts`'s `scanIndirectDispatch()` **already**
detects the RTS-trick idiom and split jump tables, and it already survived a
real false-positive incident (CR-04) with a mechanically-enforced closed shape
list and negative controls proven to reach the predicate's interior. A second
implementation would start over from zero evidence and could silently
reintroduce exactly the false-positive class CR-04 fixed. Sizing the phase as
four new detectors would have over-scoped it and invited that re-derivation.

**Why the gate is its own phase.** `BUILD-06`'s own text requires it: *"a gate
that exists before the phase it gates runs, not after."* Folding it into Phase
47 or Phase 50 makes it a step inside the work it judges, which is the
structural difference between a gate and a checklist item. It is also the phase
where this milestone's committed-rules-before-measurement discipline genuinely
binds, which is why the milestone does not open with a separate
go/degrade/no-go phase: the discipline is placed where the decision actually is.

**Why `EQUIV-01` sits with `EQUIV-02`/`03` rather than in the gate phase.** It
is tempting to promote the comparison instrument into Phase 49 alongside the
reassembly gate, on the grounds that both are instruments the final claim is
measured by. It is not promoted, for two reasons. `BUILD-06`'s gate judges the
*rebuild* — bytes and hazards, no emulator — while `EQUIV-01` judges *runtime
behaviour*, and merging them would produce a gate with two unrelated substrates
and no single verdict. And the discipline `EQUIV-01` needs is not a phase
boundary but a commit order: the narrowed mask in git **before** any rebuild is
compared under it, plus a red transcript, both of which are criteria 1 and 2 of
Phase 50. Research's own pitfall-to-phase mapping puts `EQUIV-01` in the
equivalence phase for the same reason.

**Why no opening gate phase, stated once more because its absence is the
conspicuous difference from the last four milestones.** The gate pattern's
trigger is an unproven load-bearing assumption about something this project does
**not** control, whose falsification re-scopes or cancels the milestone. v1.0.0
stands entirely on owned, shipped, tested code, with zero new dependencies and
zero new host prerequisites, and its two genuinely unproven requirements each
carry their own degrade path inside the requirement text (`unclassified` for
hazards; a narrower qualified claim for equivalence). What replaces the single
up-front gate is a control **observed going RED** in every phase — the
deliberately-filtering exporter in 46, the broken zero-page ordering in 47, the
non-canonical variants and negative controls in 48, the wrong-byte and
stale-path rebuilds in 49, the deliberately-broken rebuild in 50 — which is the
same discipline measured at five points of use instead of one point up front.
Asserting a fix is present proves nothing; making the failure happen does.

### Phase 56: Remove `shipped-modules.ts` and Its Embedded Source Scans

**SHIPPED — detail archived.** Full per-phase detail, dependency edges and
success criteria are preserved verbatim in
[`milestones/v1.0.0-ROADMAP.md`](milestones/v1.0.0-ROADMAP.md). This pointer replaces 97 lines that were correct at the time.

116 source-scanning test cases removed across eleven plans with **zero collateral loss** — a test that merely *contained* a scanning assertion kept every other assertion it had — reconciled case by case against the suite's measured 3753→3637 drop.

### Phase 57: Nothing Is Installed Automatically

**Goal**: No trigger anywhere in this project installs anything. Not a session start, not an
MCP server launch, not a test run, not an installer flag, and not CI. Every tool and every
dependency is expected to be already correctly installed; a missing one is DETECTED and
REFUSED BY NAME with the remedy in the message, never provisioned.

Owner decision 2026-09-15: "I don't want anything to be installed at all, not from a new
session, mcp start or when running the test. We can expect that all tools are correctly
installed." Scope confirmed the same day as total — user machine, the installer's `--vendor`
flag, and CI alike.

**Requirements**: INSTALL-01, INSTALL-02, INSTALL-03, INSTALL-04, INSTALL-05.

**Depends on**: Nothing. Independent of Phase 56.

**Success Criteria** (what must be TRUE):

  1. **No session start installs.** `scripts/ensure-mcp-deps.sh` detects and refuses by name
     instead of running `npm ci`; it still exits 0 on every path, and the lockfile-sha256
     stamp is removed along with the install it gated (INSTALL-01).
  2. **No MCP launch installs.** No `npx -y` of the server package is written into any
     consumer's `.mcp.json`; the installer wires an entry resolving an already-present
     package (INSTALL-02).
  3. **The installer cannot install under any flag.** `--vendor` and `vendorInstall()` are
     deleted rather than defaulted off, with the help text and `installer/wire-mcp.test.mjs`
     updated to match (INSTALL-03).
  4. **CI installs nothing.** `npm ci`, `retry_apt install -y acme`, both
     `npm install -g npm@latest` steps and `setup-node`'s `cache: npm` block are gone, CI
     running against a pre-provisioned image or container carrying `node_modules`, `acme`
     and npm >= 11.5.1 (INSTALL-04).
  5. **A guard enforces it.** A build-failing check catches any newly introduced
     package-manager invocation across `.github/workflows/**`, `src/**`, `scripts/**` and
     `installer/**`, proven non-vacuous by a planted invocation (INSTALL-05).
  6. **`npm run test:automated` is green and `npm run typecheck` exits 0** on a machine where
     `node_modules` already exists — which is now the only supported state.

**Cross-cutting constraints:**

- The external-tool half of the rule is already satisfied and must not be re-litigated or
  re-implemented: `x64sc`, `c1541`, `petcat`, ACME, Ghidra and dxa are already
  detect-then-refuse-by-name. This phase changes only the project's OWN npm dependencies.
- `CLAUDE.md`'s external-tools bullet must be edited in the same phase to withdraw the three
  exemptions it names (`scripts/ensure-mcp-deps.sh`, CI's `retry_apt install -y acme`,
  `--vendor`). Leaving it stating the old carve-outs is a documented rule contradicting an
  enforced one.
- No `npm run typecheck` regression at any commit.

Notes:

- **The plugin-install cost is accepted, not a defect.** A plugin ships no `node_modules`,
  and the SessionStart hook is the only reason a fresh plugin install works today. After
  INSTALL-01, a first-time plugin user gets a refusal naming `npm ci` in `src/mcp/vice`
  rather than a working MCP server. Do not "fix" this later by restoring the hook.
- **CI cannot satisfy INSTALL-04 from inside the workflow.** A GitHub runner has nothing
  pre-installed, so the requirement necessarily means changing how the runner is
  provisioned (pre-baked image or `container:`). Scoping this as a workflow edit will fail.
- **The `npx -y` site was undocumented.** `installer/bin/cli.mjs:135-142` carried no
  lockfile gate, and since `package-lock.json` is not in the published `files[]`, its
  transitive tree floated to whatever the registry served at launch — so the installer path
  never ran the dependency tree the plugin path tests. Only the two direct deps were pinned.
- Full measured inventory, including the auto-*written* (non-network) sites that must NOT be
  removed by mistake: `.planning/notes/nothing-is-installed-automatically.md`.

## v1.1.0 The Prerequisite Doctor (Phase Details)

*Placed **after** v1.0.0's detail section, deliberately, and for the same
window-slicing reason recorded above `### Phase 23`:
`extractCurrentMilestoneScoped()` slices the active milestone's window from its
summary heading to the next version-bearing heading, so this block must not sit
between the v1.1.0 summary heading in `## Phases` and the checklist entries under
it — its five `### Phase` headings would then be counted a second time and
`roadmap.analyze` would report ten phases for a five-phase milestone. That is the
measured failure this ordering exists to prevent. Do not move this section up.*

### Phase 58: One Declaration, Four Places That Can No Longer Disagree

**Goal**: What this plugin needs from the host is described **once**. One
committed JSON file names every prerequisite, what each unblocks, and how to
install it per platform — replacing four places that can disagree today and have
no mechanism that says when they do (`README.md`'s hand-kept per-distro tables,
`acme-build/SKILL.md`'s prefix list, the inline refusal strings in
`host-tool.mts`, and the probe in `backend-detect.mts`) with one place a Node too
old to run the server can still read.

**Requirements**: `DECL-01`, `DECL-02`, `DECL-04`, `DECL-05`.

**Depends on**: Nothing. First phase of this milestone, and independent of the
four carried phases.

**Success Criteria** (what must be TRUE):

  1. **One file names every prerequisite.** A committed declaration carries, per
     tool, its id, the skills and MCP capabilities it unblocks, and its remedy
     text per platform — covering `x64sc`, `c1541`, `petcat`, the ACME binary,
     ACME's standard library, Ghidra, dxa and Node (`DECL-01`).
  2. **It is readable where it has to be read.** Plain JSON, parsed with
     `JSON.parse`, adding no new runtime dependency, and proven to parse under
     the oldest Node the doctor must start on rather than only under the Node 24
     the server itself requires (`DECL-02`).
  3. **Node is the only record carrying a version floor.** A test asserts that no
     other record has a version-floor field, because no other tool's version
     makes a shipped code path refuse — an unenforced floor is a number a reader
     would act on (`DECL-04`).
  4. **A user who installed rather than cloned gets the same remedies.** The
     declaration is in `package.json`'s `files[]`, and
     `scripts/check-npm-packages.mjs` asserts its presence in the published
     tarball rather than leaving packaging to be discovered by a user (`DECL-05`).
  5. **No remedy text is invented at authoring time.** Every string in the
     declaration is carried from a named existing source — a README table, the
     SKILL.md prefix list, or an existing refusal message — and where two of
     those disagree today, the declaration records which was chosen and why
     instead of silently picking one.

**Cross-cutting constraints:**

- The declaration **describes**; it does not act. Nothing here invokes a package
  manager, and no field is shaped so a later reader could execute it directly.
- `DECL-03` — every live refusal sourcing its remedy from this file — is
  deliberately **not** in this phase. It edits `host-tool.mts`, whose compiled
  `resources/*.mjs` artifact is regenerated for the first time in Phase 60, where
  that risk is isolated and carries its own evidence.

**Plans**: 2 plans

Plans:
- [ ] 58-01-PLAN.md — The declaration proven end to end: one tracer record wired
  through the JSON file, its structural test, the `files[]` entry, the tarball
  assertion and a Node-18 CI job, then expanded to all eight records with every
  remedy string traced to a named source
- [ ] 58-02-PLAN.md — The provenance record of which source won each
  disagreement, and the README prose correction the declaration's
  no-version-data rule requires

### Phase 59: The Tool-Location Seam and Its Precedence Order

**Goal**: One module answers *where is this tool*, in one order — environment
variable, then `.c64-re-tools/tools.json`, then `$PATH` or sibling probe — and
says which of the three answered. A bad entry in the file is refused by name
rather than falling through silently, and the two deliberate exclusions are
refused and documented rather than quietly ignored.

**Requirements**: `LOC-05`, `LOC-06`, `LOC-07`.

**Depends on**: Phase 58 — the declaration supplies the tool ids this seam
resolves and the remedy text its refusals quote.

**Success Criteria** (what must be TRUE):

  1. **One module owns the order.** A new host-bound module resolves any declared
     tool and returns the resolved path, the source that supplied it (env-var
     name, `tools.json`, `$PATH`, sibling probe) and what it tried — compiled
     into `resources/` by the existing `build.ts` pipeline like every other
     host-bound module, rather than by new machinery.
  2. **A bad entry is refused by name, and the refusal says where the path came
     from.** A `tools.json` path that is absent, not executable, or a directory
     produces a named refusal stating that the file supplied it, so the user
     knows which of the three layers to fix (`LOC-06`).
  3. **dxa is refused, not ignored.** A `tools.json` entry naming dxa is refused
     by name and says why: dxa is vendored **and built** by this project, so an
     override could only ever select a binary this project did not build and did
     not pin (`LOC-05`).
  4. **`VICE_BROKER_NODE` stays environment-only, and the file says so where a
     reader would look for it.** The exclusion is documented in the written
     template and in the seam's own documentation, with its reason:
     `vice-launcher.sh` is bash and reads that variable before any working Node
     exists to parse JSON with (`LOC-07`).
  5. **The open placement question is answered in writing rather than drifted
     into.** The phase records which shape it took — `resolvedBackend()` gaining
     the file step internally and staying the sole `x64sc` authority, or the new
     seam wrapping it externally — and states what that choice costs Phase 60 in
     refactoring scope.

**Cross-cutting constraints:**

- **Never call this seam from inside `broker-launch.mts`'s `inFlight` launch
  guard.** That guard must stay a synchronous check-and-set with no `await`
  between; it exists because a second broker launch once raced the first and
  killed a live capture, and it is regression-tested.
- Path handling belongs to the seam, not to each caller: `~` expansion, a
  relative path resolved from the repo root, and the executable check all live
  here. A resolved path is never interpolated into a shell string.
- No static import of `repo-root.ts` — callers pass the resolved tools directory
  as an explicit string, exactly as `backend-detect.mts` already does for the
  supervisor directory, so the host-bound module keeps no import cycle.

**Plans**: TBD

### Phase 60: The Seam Wired Into the Code That Ships

**Goal**: The seam stops being a module with tests and becomes the only way this
project finds a tool. Every live resolution goes through it, every live remedy
message comes from the declaration, and a developer whose setup, test invocation
or CI step sets `VICE_BIN`, `ACME_BIN`, `ACME` or `GHIDRA_HOME` notices nothing
whatsoever.

**Requirements**: `LOC-01`, `LOC-02`, `LOC-03`, `LOC-04`, `DECL-03`.

**Depends on**: Phase 59 (the seam it wires), Phase 58 (the remedy text it
sources).

**Success Criteria** (what must be TRUE):

  1. **A path recorded in the file is honoured by the code that runs, not only by
     a test calling the seam directly.** Every code path that resolves a tool
     honours `.c64-re-tools/tools.json` (`LOC-01`).
  2. **The precedence order exists in exactly one place.** The live dispatch path
     resolves through the seam and no callsite keeps its own ordering — which is
     what leaves the doctor in Phase 61 with nothing to reimplement and makes
     `DOCTOR-05` structural rather than a matter of care (`LOC-02`).
  3. **Nothing changed for anyone who already had it working, and that is
     measured rather than asserted.** `VICE_BIN`, `ACME_BIN`, `ACME` and
     `GHIDRA_HOME` still win over the file; every existing test, CI step and
     live-test invocation that sets one passes unchanged; and
     `resources-sync.test.ts` is green against **regenerated and committed**
     `resources/*.mjs` (`LOC-03`).
  4. **`c1541` and `petcat` become locatable by the user for the first time**,
     while still resolving as siblings of the already-resolved `x64sc` when the
     file says nothing about them — the sibling probe is widened, not replaced,
     and its `$PATH` fallback keeps warning about the shadowing hazard (`LOC-04`).
  5. **A live refusal and the doctor cannot name different remedies for the same
     tool**, because the remedy text emitted at every site that emits one comes
     from the declaration (`DECL-03`).

**Cross-cutting constraints:**

- This is the **first** regeneration of the committed `resources/*.mjs`
  artifacts. Treat the byte-level sync guard as a deliverable of this phase, not
  as a hazard discovered during it.
- The `inFlight` guard constraint stated in Phase 59 binds hardest here, where
  the callsites actually live.
- `findSiblingBinary()`'s per-process memoisation keeps its current semantics:
  widening what it can resolve must not change when it caches.
- A fork build shadowing genuine stock on `$PATH` is a dated incident in this
  project's history. A location file makes that recoverable; it does not make it
  stop mattering, so the warning stays.

**Plans**: TBD

### Phase 61: `vice-mcp doctor`, Reachable on a Node Too Old to Run the Server

**Goal**: A user who has just installed this plugin runs one command and learns,
per skill and per MCP capability, what is ready, what is blocked, which missing
tool blocks it, where each present tool was found and which source said so — and
what to run to fix it, which the doctor prints and never runs.

**Requirements**: `DOCTOR-01`, `DOCTOR-02`, `DOCTOR-03`, `DOCTOR-04`,
`DOCTOR-05`, `DOCTOR-06`, `DOCTOR-07`, `DOCTOR-08`, `DOCTOR-09`.

**Depends on**: Phase 60 — the seam must already BE the live resolution path
before the doctor exists. A doctor built first grows the second detection path
`DOCTOR-05` forbids, and no amount of discipline substitutes for the ordering.

**Success Criteria** (what must be TRUE):

  1. **The answer is capability-shaped, not binary-shaped.** One command reports,
     per skill and per MCP capability, whether it is ready and which missing tool
     blocks it — a user missing ACME learns that `acme-build` is blocked and that
     the other skills are not, rather than reading a bare red row (`DOCTOR-01`).
  2. **The doctor starts where the server cannot.** It delivers its Node-floor
     verdict running under a Node below the server's own floor, proven by a CI
     matrix cell that runs it on a genuinely pre-24 Node — a unit test cannot
     prove "starts on a Node that cannot parse the server" (`DOCTOR-02`).
  3. **Every row explains itself and claims nothing it cannot support.** Each
     tool row names the resolved path and the source that supplied it; no version
     number is reported for any tool except Node; and ACME's standard library is
     its own row, separate from the ACME binary (`DOCTOR-03`, `DOCTOR-04`).
  4. **There is no second opinion available to disagree with.** The doctor
     resolves every tool by calling the same functions the live dispatch path
     calls, a differential check shows the two agreeing per tool, and the doctor
     runs one-shot and is never resident — so the per-process memoisation inside
     those probes cannot serve it a stale answer (`DOCTOR-05`, `DOCTOR-09`).
  5. **The exit code agrees with the page, and the only thing the doctor writes
     is a template of its own findings.** Exit codes distinguish all-ready,
     only-optional-missing and blocking-missing, with a test proving the code
     agrees with what was printed; the doctor installs nothing, offers to install
     nothing and has no flag that would; and on request it writes a commented
     `tools.json` template containing no path it did not itself resolve
     (`DOCTOR-06`, `DOCTOR-07`, `DOCTOR-08`).

**Cross-cutting constraints:**

- **No `--fix` flag, under any name.** Named out of scope at the open precisely
  so it is not re-proposed later as a convenience; Claude Code's own `/doctor`
  crossed that line in a later version.
- The doctor must not spawn `x64sc`. The set of modules that spawn the emulator
  is deliberately frozen **empty**, and a version probe would reopen it for a
  number nothing acts on.
- The entry point may not reach `@mastra/*` or `vice-proxy.ts` on any import
  path. A stray import turns the low-floor guarantee into a parse error on the
  exact Node the user most needs an answer on, so the import graph is checked,
  not assumed.
- The doctor is a CLI verb following the `vice-mcp anno <verb>` precedent, not an
  MCP tool: an MCP tool answering from the container cannot see the host's
  `$PATH` without a broker round trip, and would be unreachable before `.mcp.json`
  is wired.

**Plans**: TBD

### Phase 62: The Install Tables Generated, and a Guard That Compares Facts

**Goal**: `README.md`'s per-platform install tables stop being maintained by
hand. They are generated from the declaration, and a build-failing guard catches
divergence between the two by comparing parsed records — never bytes.

**Requirements**: `GEN-01`, `GEN-02`, `GEN-03`.

**Depends on**: Phase 58 for the declaration. Sequenced **after** Phase 61 so the
doctor and the README are generated from one source and cannot tell a user two
different stories about the same tool.

**Success Criteria** (what must be TRUE):

  1. **The tables are generated and the hand-kept ones are gone.**
     `README.md`'s per-platform install tables come from the declaration, with no
     hand-maintained copy left standing beside the generated section (`GEN-01`).
  2. **The guard compares facts, and fails the build when they differ.**
     Divergence between the declaration and the generated section is caught by
     parsing both into records and comparing those — with no byte comparison
     anywhere in it, honouring the owner decision of 2026-09-13 that removed that
     assertion class, under `ENGINEERING_RULES.md` §11's already-permitted
     "equivalent deterministic drift check" (`GEN-02`).
  3. **The guard is watched failing before it is trusted.** A planted divergence
     — a record changed in the declaration and not regenerated — makes the guard
     fail, and the planted control is committed rather than described (`GEN-03`).
  4. **A change that alters no fact leaves the guard green.** Reflowed
     whitespace, different column padding or a different row order does not fail
     it, which is the whole difference between this guard and the byte-identical
     class it replaces.

**Cross-cutting constraints:**

- The generator writes a documentation section. It never writes, and never
  implies, a command that is run on the user's behalf — the per-distro
  `apt`/`brew`/`pacman` lines stay lines for the **user** to run.
- Generating the tables must not change what a user is told to type. A remedy
  that reads differently after generation is a `DECL-01` authoring defect
  surfaced late, not a formatting decision to be taken here.

**Plans**: TBD

## Sequencing Rationale (v1.1.0)

**Five phases, and the research-proposed build order survived scrutiny**
(declaration → resolver seam → wire into consumers → doctor CLI → README
generator). It was adopted because every edge in it is a structural dependency
verified against the tree rather than a preference: the declaration supplies the
tool ids the seam resolves; the seam must be the live resolution path before the
doctor exists; and the README generator consumes the same declaration. Five
phases also sits inside this project's **standard** granularity calibration
(4-6). Two departures were made, and both are requirement-ownership changes
rather than reorderings — recorded here rather than left to be noticed.

**Departure 1: `DECL-03` moved out of the declaration phase into the wire-in
phase.** Research scoped Phase 58 as "data only". `DECL-03` — every live refusal
sourcing its remedy from the declaration — is not data: it edits `host-tool.mts`,
whose compiled artifact under `resources/` is guarded byte-identically by
`resources-sync.test.ts`. Leaving it in 58 would spread the first regeneration of
those committed artifacts across two phases, which is exactly the risk Phase 60
exists to isolate. Phase 58 is thinner for it and that is accepted: what it
delivers is the vocabulary every later phase spends, plus packaging evidence
(`DECL-05`) that is real work on its own.

**Departure 2: `LOC-01` and `LOC-02` are owned by Phase 60, not by the phase that
builds the seam.** Read literally, both requirements are claims about *every code
path* — "have every code path that resolves that tool honour it", and "both the
doctor and the live dispatch path resolve through that same seam". Neither can be
true when only the module exists. Phase 59 therefore builds the precedence order
and owns its refusal semantics (`LOC-05`, `LOC-06`, `LOC-07`), and Phase 60 owns
the two requirements that only become true once the shipped code resolves through
it. `LOC-02`'s doctor half is left structurally forced rather than unowned: at the
end of Phase 60 there is exactly one resolution path and no doctor yet, so
`DOCTOR-05` in Phase 61 has nothing to reimplement even if someone tried.

**Phases 59 and 60 are separate on purpose, and merging them would hide the
risk.** Phase 60 is the first regeneration of the committed `resources/*.mjs`
artifacts, it touches two host-bound modules at once, and its headline success
condition is that **nothing changed** for existing `VICE_BIN` / `ACME_BIN` /
`ACME` / `GHIDRA_HOME` users. A "nothing changed" claim folded into a phase that
also introduces a new module gets asserted rather than measured. Given a separate
phase, it gets its own evidence: the existing tests, CI steps and live-test
invocations that set those variables, run unchanged.

**The doctor stays one phase despite owning nine of the 24 requirements.** The
tempting split — low-floor entry point first, report content second — would
produce a phase whose deliverable is an executable that prints nothing a user can
act on, which is not a verifiable capability. The nine requirements describe one
command and one output; they decompose into plans, not into phases. The weight is
acknowledged here so the planner expects it rather than discovers it.

**`DOCTOR-02` owns a CI change, not just a code change.** "Starts on a Node too
old to run the server" cannot be proven by a unit test running on Node 24 — the
proof is a matrix cell running the real entry point on a genuinely pre-24 Node.
Whichever plan closes `DOCTOR-02` owns that workflow edit, and it must land
without introducing a package-manager invocation, which this milestone's
governing constraint forbids in CI exactly as in shipped code.

**`GEN-02` must NOT be byte-identical, and that is a design task rather than a
constraint to route around.** The owner decision of 2026-09-13 removed that whole
assertion class; `ENGINEERING_RULES.md` §11 already permits "an equivalent
deterministic drift check", so no rule change is owed. What is owed is a guard
whose comparison is over parsed records, and `GEN-03`'s planted divergence is
what stops that guard from being vacuous. A guard that cannot be observed failing
is documentation.

**One open design question is assigned rather than left to drift.** Research
flagged, and did not settle, whether `resolvedBackend()` gains the `tools.json`
step internally — staying the sole `x64sc` authority — or whether the new seam
wraps it externally. Both avoid the module cycle; the choice changes how much of
Phase 60 is refactoring. Phase 59 owns the answer and must record it, because a
phase that discovers this mid-execution will discover it as rework.

**No opening go / degrade / no-go gate phase, and that is a decision rather than
an omission.** Four milestones have opened with one (Phases 9, 23, 33, 39), and
each probed the same shape of unknown: a fact about something this project does
not control. v1.1.0 has no unknown of that shape. Every probe it reports through
already ships and is already tested; research returned HIGH confidence on all
four axes with **zero new npm packages and zero new host prerequisites**; and the
one thing genuinely outside this project's control — whether a given Node parses
the entry point — is settled by the CI cell inside `DOCTOR-02` rather than by a
gate standing in front of the milestone. What replaces the gate is the same
distributed discipline v1.0.0 used: a control observed going **RED** at the point
of use — the refused `tools.json` entries in 59, the unchanged-behaviour evidence
in 60, the differential doctor-versus-dispatch check and the exit-code agreement
test in 61, and `GEN-03`'s planted divergence in 62.

**What no phase here may absorb:** Phases 51, 53, 54 and 57, and the 2026-09-14
retirement reconciliation. All were weighed at this open and left standing on the
owner's decision to scope v1.1.0 to the prerequisite story alone. Phase 57 is the
one most likely to be absorbed by mistake, since it shares this milestone's
subject: its goal is to **withdraw** the three never-auto-install carve-outs,
while every phase above leaves them exactly as they are.

## Progress

**Keep this per-phase table. Keep its column order. Keep every row, including
the cut and dissolved phases (`6.`, `20.`, `21.`, `22.`, `25.`).**
This live table is the only current and complete per-phase record. The
archived `milestones/v0.*-ROADMAP.md` copies are cumulative snapshots frozen
at their own close, not per-milestone slices. The newest one, `v0.9.0`, stops
at 47 phase rows and carries nothing for Phases 45 to 56. Collapsing this
table would leave the newest phases with no per-phase record, and would force
a reader to rebuild history from seven frozen snapshots instead of reading one
live one.

No mechanism enforces this table today. Convention alone maintains it. Commit
`276c15c9` deleted the former mechanical consumer, `comment-phase-pointers.test.ts`,
which used to parse this table to derive a cut-phase set for an orphaned-pointer
check. No test reads this table now.

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
| 39. The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) | v0.9.0 | 8/8 | Complete | 2026-09-08 |
| 40. The Three Preprocessing Host Tools | v0.9.0 | 11/11 | Complete | 2026-09-08 |
| 41. The Text Channel, Its Serialization Authority, and the Contention Verdict | v0.9.0 | 6/6 | Complete | 2026-09-09 |
| 42. The Text-Format Parsers and Their Two-Binary Fixtures | v0.9.0 | 16/16 | Complete | 2026-09-10 |
| 43. The Runtime Evidence Layer | v0.9.0 | 7/7 | Complete | 2026-09-10 |
| 44. PROOF-04 — The Independent External Check | v0.9.0 | 3/3 | Complete | 2026-09-10 |
| 45. Decomposition to Closure, Disagreement First | v1.0.0 | 10/10 | Complete | 2026-09-11 |
| 46. The Lossless-Export Invariant and the Provenance Carry | v1.0.0 | 6/6 | Complete | 2026-09-11 |
| 47. Multi-File Rebuildable Source | v1.0.0 | 6/6 | Complete | 2026-09-12 |
| 48. The Movement-Hazard Report and Its Purpose-Built Subject | v1.0.0 | 6/6 | Complete | 2026-09-13 |
| 49. The Reassembly Gate, Committed Before the Phase It Gates | v1.0.0 | 7/7 | Complete | 2026-09-13 |
| 50. Equivalence and Modifiability | v1.0.0 | 8/8 | Complete | 2026-09-16 |
| 51. Planning Vocabulary Out of the Shipped Server | v1.0.0 → carried | 8/17 | **Carried forward** | - |
| 52. Remove the Fork Backend | v1.0.0 | 13/13 | Complete | 2026-09-12 |
| 53. Operator-Owned `docs/` | v1.0.0 → carried | - | **Carried forward** | - |
| 54. Remove Every Byte-Identical Assertion | v1.0.0 → carried | - | **Carried forward** | - |
| 55. Restore the Fork Removal's Dropped Capabilities and Re-Baseline the Proxy Test | v1.0.0 | 6/6 | Complete ⚠️ no gate | 2026-09-14 |
| 56. Remove `shipped-modules.ts` and Its Embedded Source Scans | v1.0.0 | 11/11 | Complete | 2026-09-15 |
| 57. Nothing Is Installed Automatically | v1.0.0 → carried | 0/0 | **Carried forward** | - |
| 58. One Declaration, Four Places That Can No Longer Disagree | v1.1.0 | 0/2 | Planned | - |
| 59. The Tool-Location Seam and Its Precedence Order | v1.1.0 | 0/? | Not started | - |
| 60. The Seam Wired Into the Code That Ships | v1.1.0 | 0/? | Not started | - |
| 61. `vice-mcp doctor`, Reachable on a Node Too Old to Run the Server | v1.1.0 | 0/? | Not started | - |
| 62. The Install Tables Generated, and a Guard That Compares Facts | v1.1.0 | 0/? | Not started | - |

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
v0.9.0 — 6 phases (39-44), 51 plans, 123 tasks, 20/20 in-scope requirements,
shipped 2026-09-10 as `override_closeout`; `CHAN-01` returned **`go`** by rule
`R15`, the first `go` of this project's four gates; no milestone audit run
(fifth consecutive close without one), all six phases
`verification_status: passed`; 6 items newly acknowledged, 33 carried forward,
and the same 8 Phase 23 evidence-table rows disclosed-but-unsuppressable for the
**third** close running. `PREP-03` was removed and `PREP-05` added mid-milestone,
both by owner direction, holding the count at 20.
v1.0.0 — 9 phases (45-50, 52, 55, 56), 73 plans, 203 tasks, 33/33 in-scope
requirements, shipped 2026-09-16 as `override_closeout`; **the first close in
this project's history preceded by a milestone audit** (`gaps_found`), which is
what produced the scope split: the milestone closed on the 33 requirements it
delivered and **carried 15 forward** with Phases 51, 53, 54 and 57, rather than
archiving never-started work as met. Eight of the nine closed phases carry
`verification_status: passed`; Phase 55 carries none at all and is disclosed as a
Known Gap. 11 items newly acknowledged, 38 carried forward, and the same 8 Phase
23 evidence-table rows disclosed-but-unsuppressable for the **fourth** close
running. The `test:automated` failure floor, carried as "3 failures" since the
v0.9.0 close, was re-measured at **0** and corrected rather than restated.

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
*v0.9.0 roadmap created 2026-09-06 — Phases 39-44, continuing numbering from Phase 38, 19/19 requirements mapped (`CHAN-01..05`, `PARSE-01..04`, `EVID-01..06`, `PREP-01`, `PREP-02`, `PREP-04`, `PROOF-04`). **AMENDED 2026-09-08** — corrected from 20/20 after `PREP-03` was removed from scope by owner direction; see `docs/phase40-preprocessing-tools-decisions.md`.*
*v0.9.0 shipped and collapsed 2026-09-10 → `milestones/v0.9.0-ROADMAP.md`. Phase directories again NOT archived (`--no-archive-phases`), per the standing v0.4.0 decision re-measured at the v0.7.0 close. The `## Progress` per-phase table was deliberately KEPT rather than collapsed to a per-milestone summary — `comment-phase-pointers.test.ts` parses it, and collapsing it empties the cut-phase set and reds four of its tests.*
*v0.9.0's requirement count reads 20/20, not the 19/19 recorded in the line above: `PREP-05` was added by owner direction at the Phase 40 UAT after `PREP-03` was struck, restoring the total the same day.*
*v1.0.0 roadmap created 2026-09-10 — Phases 45-50, continuing numbering from Phase 44, 15/15 requirements mapped (`DECOMP-01..04`, `BUILD-01..07`, `EQUIV-01..04`), each to exactly one phase. `BUILD-04`'s purpose-built synthetic subject ships inside its detector's phase (48) by owner decision 2026-09-10 ("Strategy B"); `BUILD-06`'s gate is its own phase (49), standing before the phase it gates (50). No opening go/degrade/no-go gate phase, reasoned in the phase section rather than omitted silently.*
*v1.1.0 roadmap created 2026-09-16 — Phases 58-62, continuing numbering from Phase 57, 24/24 requirements mapped (`DECL-01..05`, `LOC-01..07`, `DOCTOR-01..09`, `GEN-01..03`), each to exactly one phase. Phases 51, 53, 54 and 57 stay carried and are NOT in this milestone. `DECL-03` is owned by Phase 60 rather than the declaration phase, and `LOC-01`/`LOC-02` by Phase 60 rather than the seam phase — both departures from the researched shape are reasoned in "Sequencing Rationale (v1.1.0)" rather than left to be noticed.*
