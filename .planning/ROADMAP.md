# Roadmap: c64-re-tools

## Milestones

- ✅ **v0.2.0 Switchable stock-VICE backend** — Phases 1-8, 8.1, 8.2 (shipped 2026-08-19)
- ✅ **v0.3.0 regenerator2000 static-analysis backend** — Phases 9-11, 11.1 (shipped 2026-08-21)
- ✅ **v0.4.0 Debt discharged, decisions settled** — Phases 12-17 (shipped 2026-08-23)
- **v0.5.0 The rebuild half — absorbed playbooks, modifiable source** — Phases 18-22 (in progress, opened 2026-08-23)

*v0.5.0 continues phase numbering from Phase 17 — it starts at Phase 18. Phase
numbers are continuous across milestones and never reused, including the
dissolved and cut ones.*

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

### v0.5.0 The rebuild half — absorbed playbooks, modifiable source (Phases 18-22)

**Goal:** Turn a C64 binary into rebuildable, subsystem-split, fully-symbolised
ACME source that functions identically to the original and is *demonstrably*
modifiable — by absorbing regenerator2000's own analyze procedures into this
project's skills, and by holding a project open across a session instead of
respawning the binary per tool call. Byte-identity is explicitly not the
acceptance bar; behavioural equivalence in VICE is.

- [x] **Phase 18: Persistent Session and Tool Surface** - A regenerator2000 session survives many tool calls in one working session, and the curated surface covers what absorbed procedures need
- [ ] **Phase 19: Absorbed Procedures and the Coverage Instrument** - Upstream's analyze procedures become this project's own skills, and coverage is measured — never asserted — before the decomposition sweep runs
- [ ] **Phase 20: Decomposition to Closure** - A committed synthetic fixture is fully decomposed: nothing `Undefined`, every entry point named, every reference documented, every hardware write an enum
- [ ] **Phase 21: Rebuildable Source and the Reassembly Gate** - Annotated projects export as symbol-only, subsystem-split ACME source, gated by clean reassembly and a hazard report before any rebuild work runs on top
- [ ] **Phase 22: Equivalence and Modifiability** - The rebuild is proven behaviourally identical and demonstrably modifiable in VICE, via a comparator extended for a mode it has never run in

## Phase Details

### Phase 18: Persistent Session and Tool Surface

**Goal**: A regenerator2000 project stays open across a whole working session
instead of being respawned per tool call, and the curated `r2000_*` surface is
aligned to what every later phase's absorbed procedures actually need — so
nothing downstream is built against the old per-call lifecycle and has to be
rewritten a second time.
**Depends on**: Nothing (first phase of v0.5.0)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SURF-01, SURF-02
**Success Criteria** (what must be TRUE):

  1. A caller can issue many `r2000_*` tool calls in one working session without the underlying regenerator2000 process being respawned per call, and the `--vice` invariant stays guarded in code — `r2000-spawn-seam.test.ts`'s enumerated spawn-site set is unchanged or explicitly extended, never silently widened.
  2. A crashed or wedged session is detected between calls and transparently restarted, so a caller sees a recoverable error rather than a hang — proven against a real kill, not only the happy path.
  3. Annotations survive a hard kill of the session process: a planted-violation test mutates, kills the child, reopens and re-reads from disk, and asserts the mutation persisted; removing the internal save makes the same test fail.
  4. Write-capable calls are serialised through one owner; concurrent fan-out is restricted to read-only queries, so two subagents cannot both write "no label here" and silently lose one write.
  5. The curated tool surface includes `r2000_read_region` (so a routine can be read at a range instead of exporting the whole program), and `r2000_get_address_details`'s D-32 refusal is re-decided — fixed, worked around, or refused with a documented route — against the still-live upstream `u16` overflow, not carried unexamined into this milestone.

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 18-01-PLAN.md — Run the Architecture Change Procedure for the D-17/D-18 reversal; allocate D-36 superseding D-32; pin both with a committed guard
- [x] 18-02-PLAN.md — `ensureProjectSettings()`: force `use_illegal_opcodes` on an existing project, refuse on a `system` mismatch, with a planted-violation control

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-03-PLAN.md — TRACER: one held regenerator2000 child answers many `r2000_*` calls end to end, plus the three-scenario save-discipline gate and the spawn-seam proof

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-04-PLAN.md — Crash detection, transparent between-call respawn, loud mid-call failure, bounded restart budget, teardown hook, and the measured stdin-EOF orphan answer
- [x] 18-05-PLAN.md — Curate `r2000_read_region` with a documented cap; compose `r2000_get_address_details` client-side under D-36; move every count pin and prose mention with no drift

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18-06-PLAN.md — The coarse FIFO mutex with a bounded wait, the lost-update planted violation, and the concurrency answer Phase 19 inherits

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 18-07-PLAN.md — The settings no-revert round trip through a live session, and the phase gate run for real with committed evidence

Notes:

- **This is the enabler.** Every later phase's skills assume a session that survives many small calls; building them against the old per-call spawn-load-mutate-save-exit lifecycle first means rewriting them a second time. Mirrors this project's own strongest precedent for sequencing an instrument/enabler first (v0.4.0 Phase 12, audit-gate-first).
- Reuse the VICE broker's session-lifecycle patterns — single-owner acquire guard, PID/identity-verified kill, a persisted identity/lease file, a fragile no-retry liveness probe distinct from the resilient query path — rather than re-deriving lighter versions of each. Phase 9's own recorded incident generalises directly: splitting a mutate-then-read sequence across separate MCP connections produced a `.vsf` that did not contain the written bytes. A persistent session multiplies how many mutate-then-read sequences share one connection; the same discipline now has to hold for longer, not less.
- Criterion 4 is the go/no-go answer on the concurrency question, decided here — do not let Phase 19 copy upstream's 7-way concurrent-subagent orchestration model unchanged when absorbing procedures.
- Force `use_illegal_opcodes: true` at the start of any session this milestone's pipeline opens, not only at fresh-project synthesis time — the existing synthesiser only forces it at creation, and a session re-opening an older project would otherwise silently re-degrade every illegal opcode to an opaque `!byte` fallback.

### Phase 19: Absorbed Procedures and the Coverage Instrument

**Goal**: Upstream's five analyze procedures become this project's own skills —
absorbed, attributed, and diffed against the curated surface — and a coverage
instrument exists that resists being gamed, before any decomposition work runs
under it.
**Depends on**: Phase 18 — absorption and coverage measurement both assume the persistent session and the aligned tool surface
**Requirements**: ABS-01, ABS-02, ABS-03, ABS-04, COV-01, COV-02, SURF-03
**Success Criteria** (what must be TRUE):

  1. The five upstream analyze procedures are absorbed at a pinned upstream commit into `c64-program-recon`/`c64-memory-mapping` and new skills where nothing currently owns the job (a routine-queue-walker, at minimum), with every tool call each absorbed procedure makes diffed explicitly against the curated `r2000_*` surface — no absorbed step calls a tool this project does not expose — and with zero runtime dependency on `.agent/skills/`, which the published crate excludes.
  2. Absorbed procedure text carries a per-file attribution header naming the source repository, file path, and the pinned commit, and `THIRD-PARTY-NOTICES.md` records the true dual `MIT OR Apache-2.0` licence for the absorbed text specifically, not only for the binary dependency.
  3. No two skills in the whole inventory — absorbed and pre-existing — contend for the same trigger; a pairwise description check runs clean across all of them, because descriptions are the trigger mechanism.
  4. Running the coverage tool against a binary reports three distinct numbers — structural completeness, the Auto-versus-User label ratio, and a sampled independent-reproducibility result — never one aggregate percentage; a binary mechanically auto-labelled or commented "handles data" everywhere visibly fails to read as well-documented, and any label reached from more than one call site requires cross-reference-backed documentation to count.
  5. Which packer a binary used is surfaced as a recon finding, and the snapshot-versus-drift trade for the absorbed procedure text is a dated decision naming its own re-sync trigger, not a consequence discovered at the next milestone close.

**Plans**: 14/14 plans executed — 9/9 of the original and first-round set (5/5 original, 4/4 first-round gap closure), plus 5/5 of the second-round gap-closure plans (19-14, 19-10, 19-11, 19-12, 19-13)

**Wave 1**

- [x] 19-01-PLAN.md — tracer: one absorbed procedure end-to-end (seventh skill, relation-based packaging pin, truthful notices, attribution guards) plus the D18-16 stdio-multiplexing measurement

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — absorb the remaining four procedures, attributed per source path, and give the installer package a notices document
- [x] 19-03-PLAN.md — the coverage instrument: pinned report schema, derived-from-bytes census, widened dispatch scan, three measures, six committed controls

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-04-PLAN.md — the coverage CLI verb run live against a previously-unseen fixture, and the packer recon finding with its never-infer-a-name proof

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-05-PLAN.md — inventory-wide trigger uniqueness, the five dated decisions, and the phase gate

**Gap closure** *(verification 2026-08-24 returned `gaps_found`, 3/5 must-haves; waves renumbered from 1 for this run)*

**Gap-closure wave 1**

- [x] 19-06-PLAN.md — tracer: anchor the multi-caller rule on a hex-token boundary so a colliding `$8106` no longer buys a clean verdict, with the adversarial control run through the real report path
- [x] 19-07-PLAN.md — reproduce the upstream MIT permission notice verbatim in all three notices files, delete the claim the same commit falsifies, and guard the class

**Gap-closure wave 2** *(blocked on gap-closure wave 1)*

- [x] 19-08-PLAN.md — gate the split lo/hi table scan on real dispatch context, seed the descent only from proven targets, and give the heuristic the negative control it never had

**Gap-closure wave 3** *(blocked on gap-closure wave 2)*

- [x] 19-09-PLAN.md — the committed false-positive census control pair, the corrected fixture counts, and the extended validation record

**Gap closure, round 2** *(re-verification 2026-08-25 returned `gaps_found`, 4/5 must-haves, two open gaps; waves renumbered from 1 for this run)*

**Gap-closure wave 1**

- [x] 19-10-PLAN.md — tracer: require the dispatch CONSUMER rather than the zero-page pointer construction, and commit the interior control the gate has never had, asserted at report level
- [x] 19-14-PLAN.md — discharge `CR-02`, the one genuinely undispositioned finding id, so the tree is green before any downstream plan asserts it (`.planning/`-only; runs in parallel with 19-10)

**Gap-closure wave 2** *(blocked on gap-closure wave 1)*

- [x] 19-11-PLAN.md — gate the class-4 stack-return scan to class 3's standard with the negative controls it never had, and stop an unrelated indexed load from silently erasing a proven split table

**Gap-closure wave 3** *(blocked on gap-closure wave 2)*

- [x] 19-12-PLAN.md — make the multi-caller rule's name branch demand a reference rather than a coincidence, and give the dispatch scan the census's own 16-bit bound

**Gap-closure wave 4** *(blocked on gap-closure wave 3)*

- [x] 19-13-PLAN.md — the durable disposition ledger replacing the five accidental dispositions, the two corrected deferred entries, the extended validation record, and the full-suite green gate

Notes:

- **RESOLVED 2026-08-24 (was: research flag).** The packer-identification mechanism was resolved by a live-source spike against 0.9.20 — see `19-RESEARCH.md` §2. The answer is negative and established four independent ways: **no read-only route to packer identity exists** on the pinned surface (`handler.rs:798-826`'s seven-field `json!` block; `UnpackResult` not serialised; `LoadedProjectData.detected_packer` TUI-only; `detect_packer`'s consumer set internal), corroborated by a live `--help` and a live `tools/call`. What ships instead is a project-owned recon finding with a hard unknown (19-04). Acceptance bar and reopen trigger: `19-DECISIONS.md` decision 3.
- **RESOLVED 2026-08-24 (was: research flag).** The pin is `493f840418f1450a342bb220c2fe3d2585dd0525` (v0.9.20), corroborated two independent ways — the clone at that commit and the installed crate's own `.cargo_vcs_info.json` — see `19-RESEARCH.md` §1.1-§1.2. The tool-call surface was diffed explicitly, not assumed: every absorbed step calls only curated `r2000_*` tools, and every omitted upstream call carries a cited justification in `upstream-procedure-manifest.json`. Two of those omissions turned out to have acquired criteria from the diff — see decision 2 below.
- **2026-08-24 (inherited from Phase 18 / plan 18-06):** The concurrency model is a coarse mutex at the `r2000-session.ts` seam: exactly one logical operation per session is in flight at a time, and contention is answered by a bounded FIFO wait rather than a refuse-while-busy error. Phase 19 must not copy upstream's 7-way concurrent-subagent orchestration unchanged; read-only fan-out is the sanctioned orchestration pattern, while the seam quietly queues whatever reaches it.
- **CLOSED 2026-08-24 by measurement (was: deferred, not rejected).** The reader-writer upgrade's own named precondition has been met and answered. Evidence: `19-STDIO-MULTIPLEXING-EVIDENCE.md` — three runs against the real binary, all `serial-one-request-at-a-time`, with a negative control, corroborated at source by `stdio.rs:67-98` (`handle_request` called synchronously on `&mut AppState`, spawning nothing). Outcome: the child does not multiplex, so a reader-writer upgrade would buy **zero** parallelism and the coarse FIFO mutex is an exact model of the child's own behaviour rather than a compromise. Read-only fan-out remains the sanctioned orchestration pattern, and its value is agent reasoning concurrency — explicitly **not** throughput at the session. CLOSED, not re-deferred; what would reopen it is named in `19-DECISIONS.md` decision 5.
- Coverage-instrument design constraint: walk the raw byte range and instruction stream independently of what regenerator2000's own block-type table already claims — a derived-from-bytes census, not a report generated from the store's own bookkeeping. Widen it specifically to cover what `follow_indirect_jumps` does not walk (multi-entry indexed dispatch tables) — Phase 21's hazard report needs this same widened scan.
- Do not copy upstream's 7-way concurrent-subagent orchestration unchanged (decided in Phase 18, criterion 4) — absorb the procedures' sequencing, not their concurrency model.
- Validate the coverage instrument against a real, previously-unseen fixture before trusting it, not only against the fixture the same pass wrote it against.
- **2026-08-24 — two future-surface tool proposals came out of the absorption diff.** `r2000_toggle_splitter` (serves DECOMP-01 and BUILD-02) and `r2000_set_immediate_format` (**is** BUILD-03's low/high-byte step) were previously recorded as having no criterion and acquired one from this phase's diff. Both are PROPOSED here and implemented at the **start of Phase 20**; both are mutating, so both go through the existing session seam. Full record, including what would withdraw either proposal: `19-DECISIONS.md` decision 2.
- **2026-08-24 — the phase's five dated decisions live in `19-DECISIONS.md`**, each with its evidence, the alternatives weighed, and a named, checkable reversal or re-sync condition (ABS-04). The executed validation record — every requirement beside a command that actually ran, plus the fourteen planted-violation demonstrations and the full phase gate — is `19-VALIDATION.md`.

### Phase 20: Decomposition to Closure

**Goal**: A committed synthetic C64 binary is fully decomposed and documented —
nothing left ambiguous, every entry point and reference named, every hardware
write self-explanatory — with coverage measured by Phase 19's instrument
throughout, not asserted at the end.
**Depends on**: Phase 19 — both the absorbed procedures doing the work and the coverage instrument measuring it must exist first
**Requirements**: DECOMP-01, DECOMP-02, DECOMP-03, DECOMP-04
**Success Criteria** (what must be TRUE):

  1. On the committed synthetic fixtures, nothing remains typed `Undefined` — every byte is code, byte, word, address, PETSCII, screencode or table.
  2. Every code entry point carries a user-set name and a purpose comment stating function, inputs, outputs and side effects — no `p_XXXX`/`l_XXXX` name is left.
  3. Every referenced non-hardware address is named and documented.
  4. Every hardware register write renders as a named enum rather than a magic number.

**Plans**: TBD

Notes:

- Run Phase 19's coverage instrument throughout this phase, not only once at the end — the whole point of building it first was to gate this sweep, not to grade it retroactively.
- **Open this phase by implementing the two tools Phase 19 proposed** (`19-DECISIONS.md` decision 2): `r2000_toggle_splitter` serves DECOMP-01 — without it two adjacent tables merge into one block and there is no boundary to cut on — and `r2000_set_immediate_format` serves BUILD-03. Both are mutating and must go through `r2000-session.ts`'s existing seam; neither may add a second child-launch site. If DECOMP-01 is reached on the fixtures without ever needing a table boundary, the splitter proposal is withdrawn rather than implemented.
- The coverage report's `flat-three` schema was auto-selected under `yolo` mode and never reviewed by a human (`19-DECISIONS.md`, closing note). This phase's first use of the report is the moment to confirm or revise it, before Phase 21 hardens the commitment.
- Watch for overlapping instruction streams and code/data boundaries implied only by fall-through: treat every routine-boundary claim as a checkable hypothesis — does any jump target land strictly inside an already-decoded routine's byte range, other than at its declared start? Route anything flagged through `c64-provenance-diff` before treating it as original code to decompose.
- A `!byte` fallback line inside an otherwise densely-named region is the signature of a silently-degraded illegal opcode — grep for it; don't assume Phase 18's forced setting held across every session this phase opens.

### Phase 21: Rebuildable Source and the Reassembly Gate

**Goal**: An annotated project becomes rebuildable, symbol-only, subsystem-split
ACME source with a relocation-hazard report — and clean reassembly plus a clean
hazard report is a gate the next phase must pass through, not a claim made
after the fact.
**Depends on**: Phase 20 — export and hazard analysis operate on a fully decomposed project
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06
**Success Criteria** (what must be TRUE):

  1. Export emits one ACME source file per regenerator2000 scope, wired by `acme-build`'s `!source`, with data tables extracted to their own files, and the whole set assembles to a single working output.
  2. Every branch, `JSR`/`JMP` and data reference resolves through a symbol — including data byte-pairs that decode to in-range addresses with an incoming cross-reference, not only instruction operands.
  3. A hazard report enumerates, for a real fixture, every instance of four named classes — indexed jump tables (with the index range stated from the bounding compare/mask, and the RTS-trick idiom's off-by-one bias recorded explicitly), self-modifying-code write-targets landing inside `Code` blocks, page-alignment dependence, and cycle-exact raster chains — none of which any existing tool in this stack currently detects.
  4. `c64-provenance-diff`'s verdict is carried at the point of export; cracker-patched ranges are excluded from the rebuild rather than inherited.
  5. Clean reassembly plus a clean hazard report is a gate this phase's own tooling enforces before Phase 22 is allowed to build on the exported source — checked mechanically, not asserted after the fact.

**Plans**: TBD

Notes:

- Treat "reassembles clean" as a *necessary* gate, never a *sufficient* one — every hazard class in this phase's own report reassembles clean while being silently wrong at runtime.
- The hazard report must state, for every jump table, how its length/index range was established — not merely that a table exists. This is the single most-cited failure mode for this class of report.
- Validate the hazard detectors against a real, previously-unseen fixture, not only the one the same pass wrote them against.
- Provenance-awareness (BUILD-05) is wiring, not new analysis: it consumes `c64-provenance-diff`'s already-existing, already-committed `recovery/RELEASES.json`/`PROVENANCE.md` artifacts.
- **BUILD-02 and BUILD-03 both depend on a tool Phase 19 proposed and Phase 20 implements** (`19-DECISIONS.md` decision 2): `r2000_toggle_splitter` is what supplies the boundary BUILD-02's table extraction cuts on, and `r2000_set_immediate_format` **is** BUILD-03's low/high-byte mechanism — a 16-bit address loaded as two immediate bytes is the one construct where a reference cannot go through a symbol without it. If Phase 20 withdrew either proposal, re-open the question here rather than discovering it mid-rebuild.

### Phase 22: Equivalence and Modifiability

**Goal**: The rebuild is proven, not described — behaviourally identical to
the original in VICE, and demonstrably modifiable — using a comparator
extended for a mode it has never been run in.
**Depends on**: Phase 21's gate — behavioural comparison and the modifiability demo need rebuildable source and a passing hazard report first
**Requirements**: EQUIV-01, EQUIV-02, EQUIV-03, EQUIV-04
**Success Criteria** (what must be TRUE):

  1. **[Highest-risk requirement in this milestone.]** `compare.mjs` runs, for the first time ever, in original-versus-different-binary mode: a narrowed volatile mask (so a real `$D020`/`$D015`/`$D018` regression cannot hide behind the existing blanket `$D000-$DFFF` exclusion), an explicit allowlist for declared intentional differences, and per-binary logical checkpoints resolved from each binary's own symbol table rather than a raw literal shared across both. This is scoped, novel work — not a "just call it" integration — and must be validated against a real difference before being trusted on the modifiability demo below.
  2. Behavioural equivalence between the original and the rebuild is demonstrated in VICE, with a committed transcript as the artifact of record rather than a described walkthrough.
  3. Modifiability is demonstrated, not described: one behaviour removed and one added in the rebuilt source, reassembled, both observed taking effect in VICE, with a committed transcript — and criterion 1's extended comparator is run against this exact change and correctly reports it as an allowlisted intentional difference, not a failure.
  4. The synthetic fixtures are committed to the repository and the whole pipeline — persistent session through equivalence check — runs end to end in CI, carrying no copyrighted game image.

**Plans**: TBD

Notes:

- **Needs research at plan-time (research flag).** Extending `compare.mjs` for original-versus-different-binary comparison has no existing precedent in this project — never run in this mode before. Budget it as first-class scoped work (narrowed mask, allowlist, per-binary checkpointing, a write-trace comparison for write-only hardware ranges like SID), not as a thin wrapper call.
- **Needs research at plan-time (research flag).** Deterministic input replay for the behavioural-equivalence and modifiability demos has no VICE-specific tooling located; TASVideos-style movie replay is the nearest precedent, not a confirmed solution.
- Pin or verify VICE's power-on RAM-fill pattern and force a clean machine (fresh launch or verified reset, never a reused warm-floor instance) for both sides of any equivalence run — an unpinned nondeterminism source or carried-over broker state produces a false PASS or FAIL with no error surfaced.
- Compare screen content (`$0400-$07E7`/`$D800-$DBFF`) as its own named check — it is the actual user-visible surface and can diverge without any underlying data table changing.
- This phase **is** the first real, non-synthetic exercise of the coverage and hazard instruments built in Phases 19 and 21 — record whether they caught the right things during this phase's own work, not only whether the demo worked.

## Sequencing Rationale (v0.5.0)

- **Phase 18 (persistent session) precedes everything else.** Every later phase's skills assume a session that survives many small calls; building them against the old per-call lifecycle first means rewriting them a second time.
- **Both verification instruments precede the substantial work they measure.** Coverage (Phase 19) precedes the decomposition sweep (Phase 20); the hazard-report-plus-reassembly gate (Phase 21) precedes the equivalence/modifiability demo (Phase 22). This mirrors this project's own strongest precedent: v0.4.0 built its audit-gate as Phase 12, first, so every later phase ran under it.
- **EQUIV-01 stays inside Phase 22 rather than becoming its own phase.** It is this milestone's single highest-risk requirement — `compare.mjs` has never been run in original-versus-different-binary mode, and its current design would produce both a false PASS (a real `$D020`/`$D015`/`$D018` regression hidden by the blanket `$D000-$DFFF` mask) and a false FAIL (the modifiability demo's own intentional change, with no allowlist). But it has no independent value outside the equivalence/modifiability work it exists to verify, and a standalone one-requirement phase would fragment the milestone past this project's "standard" granularity calibration (4-6 phases) without changing what has to be built or in what order. It is instead sequenced as Phase 22's first success criterion and explicitly flagged, so planning treats it as that phase's own internal gate rather than an afterthought bolted onto the demo.
- **Provenance-awareness (BUILD-05) is folded into the export phase (21)** rather than given its own phase, since it consumes an already-existing, already-committed artifact (`c64-provenance-diff`'s `RELEASES.json`/`PROVENANCE.md`) — wiring, not new analysis.
- This is a considered adoption of the research's proposed 5-phase shape (18-22), not a default carry-over: the alternative considered — splitting Phase 22 into a standalone comparator-extension phase plus a demo phase — was rejected for the granularity reason above, and the alternative of a standalone coverage-instrument phase (mirroring Phase 12 more literally) was rejected because, unlike Phase 12's audit-gate, Phase 19's coverage instrument gates only one downstream phase (20), not the whole milestone, and pairs naturally with the absorption work it has no dependency conflict with.

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
| 19. Absorbed Procedures and the Coverage Instrument | v0.5.0 | 14/14 | In Progress|  |
| 20. Decomposition to Closure | v0.5.0 | TBD | Not started | - |
| 21. Rebuildable Source and the Reassembly Gate | v0.5.0 | TBD | Not started | - |
| 22. Equivalence and Modifiability | v0.5.0 | TBD | Not started | - |

**Milestone roll-up:** v0.2.0 — 9 phases, 87 plans, 51/51 in-scope requirements,
shipped 2026-08-19 (audit round 4 `tech_debt`; 13 deferred items at close).
v0.3.0 — 4 phases, 36 plans, 101 tasks, 12/12 in-scope requirements, shipped
2026-08-21 (audit round 2 `passed`, zero gaps; 19 deferred items at close).
v0.4.0 — 6 phases, 44 plans, 119 tasks, 16/16 requirements, shipped 2026-08-23
(audit round 1 `tech_debt`, zero blockers and zero open gaps; **0** pending
todos at close, 16 bookkeeping items acknowledged). v0.5.0 — opened 2026-08-23,
Phases 18-22, 27/27 requirements mapped, not yet shipped. Requirements cut in
earlier milestones stay in their own `milestones/v*-REQUIREMENTS.md` marked
`CUT` with rationale, so restoring one is a scope decision rather than
archaeology.

**Phase directories are not archived.** Unlike the roadmap and requirements,
`.planning/phases/` accumulates across milestones by design.
`docs-review-disposition.test.ts` asserts at least 150 review findings read out
of `.planning/phases/` and explicitly excludes `.planning/milestones/`, and
`r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard — archiving them turns both red. Every milestone close therefore
passes `--no-archive-phases`.

---
*Roadmap created: 2026-08-12 for milestone v0.2.0*
*v0.2.0 shipped and collapsed 2026-08-19 → `milestones/v0.2.0-ROADMAP.md`*
*v0.3.0 shipped and collapsed 2026-08-21 → `milestones/v0.3.0-ROADMAP.md`*
*v0.4.0 shipped and collapsed 2026-08-23 → `milestones/v0.4.0-ROADMAP.md`*
*v0.5.0 roadmap created 2026-08-23 — Phases 18-22, continuing numbering from Phase 17, 27/27 requirements mapped.*
*Phase numbering is continuous across milestones and never reused.*
