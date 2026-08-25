# c64-re-tools

## What This Is

A Claude Code plugin bundling the tooling used to reverse-engineer and rebuild
Commodore 64 games, reusable across C64 projects. It ships a `vice` MCP server
driving a host VICE emulator through an on-demand broker, a **static-analysis
backend** over regenerator2000, plus six C64 reverse-engineering skills,
distributed both as two npm packages (`@henols/vice-mcp`,
`@henols/c64-re-tools`) and as a Claude Code plugin.

**As of v0.2.0 the plugin runs on a VICE anyone can install.** Two backends are
selectable per project: the **stock** backend drives unmodified upstream `x64sc`
through its binary monitor and advertises **38 tools**; the **fork** backend
drives [barryw/vice-mcp](https://github.com/barryw/vice-mcp)'s `-mcpserver` HTTP
endpoint and advertises **62**, unchanged from v0.1.x. The stdio surface is
*trimmed per backend*, not made uniform — a tool on both keeps its name and a
backward-compatible argument shape, and the three capabilities stock provably
cannot have (`vice_sid_get_state`, `vice_keyboard_matrix`,
`vice_keyboard_restore`) refuse by name and say which backend provides them.

**As of v0.3.0 recon findings are state, not prose.** regenerator2000 is a
required, container-side, static-analysis-only prerequisite reached through **17
curated `r2000_*` tools** and a `vice-mcp r2000 <verb>` CLI. It holds a
persistent, queryable annotation store — labels, comments, block types, scopes,
cross-references — and a recursive-descent disassembler with an auto-analyzer.
It is structurally incapable of touching VICE (`--vice` unreachable *and*
denied), so it behaves identically on both backends. Register writes render as
generated bit-name enums, symbols flow both ways between the store and a live
emulator, and the flat linear `toacme` decoder this replaced is deleted.

**As of v0.5.0 that session persists, and as of v0.6.0 the substrate under it is
changing.** The r2000 project stays open across many tool calls with crash
recovery, a FIFO call queue and save-before-return persistence; all five upstream
analyze procedures are absorbed into this project's own skills (now seven,
including `routine-queue-walker`). But the dxa+Ghidra pivot decided 2026-08-24
reverses D-R1/D-R2: **v0.6.0 replaces regenerator2000 as the analysis engine**
with dxa for discovery, Ghidra headless for semantic analysis, and an annotation
store this project owns. The paragraph above describes what ships today and stays
true until v0.6.0 closes.

## Core Value

A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip
state — and keep working when the emulator misbehaves.

*Still correct after v0.2.0.* Shipping the second backend did not shift it; the
milestone widened *which* emulator qualifies as "a real C64 emulator" without
changing what the session needs to do with it.

**Kept as-is (CORE-01, decided 2026-08-23).** The flag recorded at the v0.3.0
close — quoted here rather than left standing as its own paragraph, since
letting it stand beside a verdict would leave this section self-contradicting:
"[this statement] is entirely about driving a *live* emulator ... deliberately
not rewritten yet" — is now discharged. The verdict is **keep-dated**: the
leading statement above is left byte-identical, and this paragraph is the dated
record that the evidence was actually weighed rather than silently carried a
third close in a row.

*Provenance.* The choice was escalated to a human at plan 17-02 task 1's
`gate="blocking-human"` checkpoint — a gate auto-mode does not bypass. Recorded
to exactly what the session transcript evidences, and no further: the checkpoint
was rendered, with the counted evidence columns (six items for restating, five
against, compressed from `17-RESEARCH.md`'s `## Core Value evidence`) in the
terminal output around it, while the decision prompt itself carried only the two
option labels plus one strongest-argument line each; 298 seconds later the
operator answered in free text — `you decide` — rather than choosing either
label; the orchestrator then selected `keep-dated` on the reasoning below.
Attendance and delegation are on the record; comprehension is not evidenced by
any artifact and is not claimed here. Corrected 2026-08-23 by plan 17-04 (gap
`G-17-1`): the original entry asserted the operator's comprehension as observed
fact. Asked about the exchange at this phase's UAT, roughly 106 minutes after it,
the operator did not recall it — the transcript, not recall, is what settles what
happened, and the transcript evidence is enumerated in
`.planning/debug/core-01-provenance-overstates-human-involvement.md`. Recorded
precisely rather than smoothed over: a human was stopped at the gate and answered
it, but the verdict word itself was the orchestrator's, not a literal human
selection — the distinction this project's own audit discipline exists to keep
visible.

*Decisive reason.* The outlives-the-session property this statement would gain
belongs to a component structurally incapable of driving VICE at all —
`R2000-01` records that regenerator2000 is never launched with `--vice`, guarded
in code, not only documented. This statement's subject is a session driving a
*live* emulator; folding in the persistence axis would make one sentence's
subject two structurally separate subsystems, which is a category error, not a
style objection. v0.4.0 also produced zero new evidence on the question: every
item weighed for restating is Phase 11 (v0.3.0) evidence — the two-session
sealed-question test (`R2000-10`), the symbol round trip (`R2000-14`/`R2000-15`),
and the 17 curated `r2000_*` tools — re-weighed one milestone later, not new.

*Case against this verdict, carried rather than resolved.* Phase 11's
two-session sealed-question test is genuinely the strongest evidence this
project has produced — this file's own Key Decisions row calls it exactly
that — and a real, proven, falsifiably-tested capability (findings that outlive
a session) is left unnamed in the project's identity statement for a third close
running. That cost is real and is not explained away by the reasoning above; it
is accepted, not dismissed.

*Reversal.* This reverses if either of two conditions is met, named specifically
so a future reader can tell whether they have been: **(a)**, the sharper
trigger — a shipped skill or workflow in this repo demonstrably depends on
cross-session recall to function, checkable by emptying the annotation store
between sessions and observing the skill fail; or **(b)** a second milestone
produces persistent-state evidence that is genuinely new rather than the Phase
11 set re-weighed above. This trigger is manually tracked, not mechanically
probed, the same way FORK-01's Key Decisions row states its own trigger is.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Claude drives a host VICE emulator through a stable `vice_*` stdio MCP surface — existing, v0.1.x
- ✓ Emulator instances are pooled on demand with port allocation, warm floor, and crash supervision — existing, v0.1.x
- ✓ A crashed or wedged emulator is detected and recycled without losing evidence (incident record written before any kill) — existing, v0.1.x
- ✓ Tool calls work from inside a container against an emulator on the host, with every path translated at the boundary — existing, v0.1.x
- ✓ Six C64 RE skills usable as playbooks: `acme-build`, `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage` — existing, v0.1.x
- ✓ Installable two ways: `npx @henols/c64-re-tools` into any project, or as a Claude Code plugin — existing, v0.1.x
- ✓ Releases are automated: CI typechecks, tests, validates both npm tarballs, and publishes via OIDC trusted publishing on `v*` tags — existing, v0.1.x
- ✓ User selects which VICE backend the MCP server drives, project-level, without editing code — v0.2.0 (`VICE_BACKEND`, resolved once per broker process by `backend-detect.mts`)
- ✓ The tool surface works against an unmodified upstream `x64sc` from apt / Homebrew / official builds — v0.2.0 (proven live against genuine stock VICE 3.9 at `/usr/bin/x64sc`)
- ✓ The fork backend keeps working exactly as it does today when selected — v0.2.0 (`tools-manifest.json` byte-identical; fork argv byte-identical; standing regression gate at every phase boundary)
- ✓ A binary-monitor protocol client speaks stock VICE's wire format, correlating replies and demultiplexing unsolicited events — v0.2.0 (request-id-first demux across all five event types, never resolving a pending request with an event)
- ✓ Tools with a 1:1 binary-monitor equivalent work on the stock backend — v0.2.0 (memory, registers, checkpoints, watchpoints, step, reset, joystick, snapshots, autostart, banks, ping)
- ✓ Tools the fork implemented in-emulator are reimplemented client-side — v0.2.0 (memory search/compare, symbol store, 6510 disassembler, sprite decode, VIC-II/CIA state decode; **scoped to what the skills call** — see Out of Scope)
- ✓ The broker launches stock VICE with binary-monitor flags as well as the fork with `-mcpserver` — v0.2.0 (incl. the `-default -drive8type 1541` ordering invariant, regression-pinned)
- ✓ Every tool declares its support level per backend, so a user is told which backend restores a capability — v0.2.0 (`capability-registry.ts`, 26 entries, four consumers and no copies)
- ✓ The client detects the connected VICE's version and degrades gracefully when a capability is absent — v0.2.0 (`CPUHISTORY_GET`'s three-way answer settled once per binary)
- ✓ The binary-monitor assumptions are confirmed empirically against a real VICE build before client design is locked — v0.2.0 (13-check probe run against stock 3.9 and fork 3.10; all five UNVERIFIED items resolved)
- ✓ Cycle timing and "is the emulator still advancing" work on the stock backend — v0.2.0
- ✓ A user can install this from a package manager and is never silently given a wrong answer by a backend that cannot do the thing — v0.2.0 (`docs/tool-support.md` generated from both manifests with a byte-identity drift guard)
- ✓ Five load-bearing assumptions checked against a real regenerator2000 build before any plan is written, with the pty/HTTP-MCP one gating the rest — Phase 9 (`R2000-16`; verdict `degrade` via rule `R4`, see [`docs/phase9-regenerator2000-probe-findings.md`](../docs/phase9-regenerator2000-probe-findings.md))
- ✓ `c64-program-recon` writes findings as queryable annotation state, not only Markdown prose, so a later session can query instead of re-deriving — Phase 11 (`R2000-10`; proven by the two-session falsifiability test — session B answered a question sealed before it existed, from store queries alone)
- ✓ A user can ask which addresses reference a given address, and search labels, comments and instructions across an analysed program — Phase 11 (`R2000-11`; the 17 curated `r2000_*` tools)
- ✓ Enum definitions are generated from `c64-memory-mapping`'s `memmap.json`, so register writes render with semantic names instead of magic numbers — Phase 11 (`R2000-13`; `lda #$1b`/`sta $d011` renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` and reassembles byte-identical under real ACME)
- ✓ Symbols annotated in regenerator2000 export as VICE label files into the symbol store, and names discovered live flow back — closing the round trip — Phase 11 (`R2000-14`, `R2000-15`; demonstrated as one closed loop against genuine unpatched stock `x64sc`, with the inbound name's prior absence shown rather than claimed)
- ✓ regenerator2000 is adopted as a **static-analysis** backend and is never launched with `--vice`, guarded in code rather than only documented — v0.3.0 Phase 10 (`R2000-01`; two independent guarantees — unreachable by fixed per-verb argv builders *and* denied by a scan throwing `R2000ViceFlagError`, both pinned by tests proven to fail under live reintroduction)
- ✓ It runs on the same side of the container boundary as the MCP proxy, so no path translation applies — v0.3.0 Phase 10 (`R2000-02`; the `r2000_*` family registers proxy-locally via `buildViceTool()` and never reaches `forwardToVice()`, asserted structurally by `hostpath-consumers.test.ts` over a `readdirSync`-derived module set. **Scope honesty:** the two-projects-at-once half is a *stated* upstream limit, not a detected one, and the devcontainer half is documented rather than exercised — no devcontainer exists in this repo)
- ✓ It is a declared prerequisite named in the install documentation alongside VICE, with its licence notice in `THIRD-PARTY-NOTICES.md` — v0.3.0 Phase 10 (`R2000-03`; the notice records the **true dual `MIT OR Apache-2.0`** licence. The requirement as written said "Apache-2.0", which the Phase 9 probe falsified; every Apache-2.0-only mention in the living documents was corrected)
- ✓ `acme-build`'s `disasm` verb and its `toacme`-on-PATH prerequisite are removed, replaced by a regenerator2000 route — v0.3.0 Phase 10 (`R2000-05`; `cmdDisasm`, its dispatch entry, its usage line and ~50 lines of decoder-shaped `SKILL.md` caveats deleted, with a whole-tree grep gate proven to bite on a non-`SKILL.md` file)
- ✓ A `.prg` or flat 64K capture becomes reassemblable ACME source matching this project's `!cpu 6510` expectations, **verified by reassembly** rather than asserted — v0.3.0 Phase 10 (`R2000-06`; `--verify`'s output parsed by one seam keying strictly on ACME's own result line, proven in both directions on real transcripts — an exit-1 run where ACME still passed, an exit-0 run where ACME never ran)
- ✓ Project bootstrap from a raw binary is automated rather than a documented manual step — v0.3.0 Phase 10 (`R2000-09`; a pure-Node `.regen2000proj` synthesiser a real regenerator2000 loads, with `use_illegal_opcodes`/`system` forced explicitly, plus a container-side `.d64` reader that refuses to guess between matching entries)

- ✓ The three highest-value carried items are verified against real binaries instead of internal proxies — v0.4.0 Phase 13 (`EXTV-01`/`EXTV-02`/`EXTV-03`; `VERIF-02`'s fixtures re-recorded from a real binary, the `--help` discriminator confirmed against both real stock and real fork with transcripts committed, and the four spec-driven Phase 3 wire details run — details the binary contradicted were corrected at source rather than annotated)
- ✓ A milestone audit cannot record `status: passed` while any `docs-*.test.ts` guard is red — v0.4.0 Phase 12 (`GATE-01`; mechanically enforced as a precondition, not documented). Every open code-review finding across all phases is dispositioned and `docs-review-disposition.test.ts` runs green from a clean checkout — Phase 15 (`GATE-02`)
- ✓ The fork-backend question is a dated decision with named reversal criteria, not a default carried a third time — v0.4.0 Phase 14 (`FORK-01` decided **retain**, with the upstream `KEYBOARD_MATRIX_SET` coupling named as a reversal criterion; `FORK-02` gives any user hitting one of the three hard losses a route they can follow)
- ✓ Every pending todo is fixed, dispositioned `wont-fix` with rationale, or explicitly promoted — nothing carried silently into v0.5.0 — v0.4.0 Phase 15 (`DEBT-01`/`DEBT-02`) and Phase 17 (`DEBT-04`; the ledger closes at **0**, derived and guarded in both directions by `docs-deferred-ledger.test.ts`, down from the 19 items inherited at the v0.3.0 close)
- ✓ Phase 03's three pending UAT scenarios are executed against real fixtures and a running program — v0.4.0 Phase 15 (`DEBT-03`; recorded pass or fail with evidence rather than left partial)
- ✓ Core Value is confirmed on two milestones of evidence, resolving the flag left at the v0.3.0 close — v0.4.0 Phase 17 (`CORE-01` decided **keep-dated** at a `gate="blocking-human"` checkpoint, with the case against the verdict carried rather than resolved and a specific reversal condition stated; pinned by `docs-core-value-decision.test.ts`. The provenance record was itself corrected by plan 17-04 after UAT gap `G-17-1` — see the `*Provenance.*` paragraph under Core Value)
- ✓ The plugin payload lives under `src/` with `.mcp.json` merged, and `QUAL-01..03` are closed — v0.4.0 Phase 16 (`PKG-01`..`PKG-04`; both published tarballs still validated by `scripts/check-npm-packages.mjs`)

- ✓ A regenerator2000 project stays open across many tool calls in one working session, with crash detection between calls, save-before-return persistence and a single-owner write path — v0.5.0 Phase 18 (`SESS-01`..`SESS-04`)
- ✓ The curated `r2000_*` surface covers what the absorbed procedures actually call, `r2000_get_address_details`'s D-32 refusal is re-decided (D-36 supersedes D-32; client-side composition), and which packer a binary used is a recon finding — v0.5.0 Phase 18 (`SURF-01`..`SURF-03`)
- ✓ All five upstream analyze procedures are absorbed into this project's skills at a pinned upstream commit, attributed per file and in `THIRD-PARTY-NOTICES.md`, with no dependency on `.agent/skills/` and no pairwise trigger collision across all seven skill descriptions — v0.5.0 Phase 19 (`ABS-01`..`ABS-04`; a seventh skill, `routine-queue-walker`, shipped with them)
- ✓ Coverage is a derived-from-bytes census the store's own block table cannot move by a single byte, reported as three distinct numbers and defended by six committed controls against a vacuous pass — v0.5.0 Phase 19 (`COV-01`/`COV-02`; `COV-01` closed under an accepted override, since the replacement plan for the instrument *is* the dxa+Ghidra pivot)

### Active

<!-- v0.6.0 scope, opened 2026-08-25. REQ-IDs live in `.planning/REQUIREMENTS.md`;
     this list is the human-readable restatement and moves to Validated at the
     v0.6.0 close. The milestone is scoped to the substrate only — DECOMP-01..04,
     BUILD-01..06 and EQUIV-01..04 stay re-mapped to v0.7.0, deliberately not
     rewritten against a store that does not exist yet. -->

- [ ] The pivot's numbers are re-measured against real cracked releases rather than the one 279-byte self-authored fixture, as a go/no-go gate before anything is built on them
- [ ] The `memmap.json` flat address model is tested against code that banks ROM in and out, where an address's meaning becomes bank-dependent
- [ ] dxa is vendored and its human-readable listing is parsed into a machine-readable code/data map — it has no machine-readable output, so that parser is this project's to own
- [ ] Ghidra runs headless under this project's harness, handed dxa's map plus volatile `$0000-$0001` / `$D000-$DFFF` memory blocks before `analyzeAll()`, so the decompiler cannot delete hardware writes as dead stores
- [ ] Structural facts are exported from Ghidra's **decompiler** layer via `DecompInterface` — array bounds, the split-pointer `CONCAT11` idiom, record strides, resolved computed jumps — not from the listing's data types, which return essentially nothing on 6502
- [ ] Undocumented NMOS opcodes are decodable by Ghidra: all 105 opcode bytes stock's `6502.slaspec` omits, as a SLEIGH extension
- [ ] An annotation store this project owns holds labels, comments, per-range typing, scopes, enums, undo and persistence, reached through an MCP surface
- [ ] The store exports ACME source, carrying the two idioms worth stealing rather than rediscovering — the `=*+$01` mid-instruction label for self-modifying write targets, and typed label prefixes
- [ ] The 19,181 lines of regenerator2000 integration glue are deleted, not left beside their replacement
- [ ] Annotation is automatic where it can be: the `memmap.json` join and its three selection rules, `$01` bank-state derivation, and VIC graphics-map derivation


### Out of Scope

<!-- Explicit boundaries, with reasoning to prevent re-adding. -->

- **Client-side SID write-shadowing mitigation** — switchability supersedes it. SID read-back routes to the fork backend, which retains `vice_sid_get_state`. Shadowing could only ever capture writes the client itself issued, never the running program's, so it was never parity. (Resolves ingest WARNING W1.)
- **Removing or deprecating the fork backend** — it is the hedge against stock's three hard losses (SID read-back, matrix keyboard, RESTORE/NMI) and the reason this migration is not a bet. Its incremental maintenance cost is near zero since it already exists and is tested. *Reaffirmed at v0.2.0 close: the fork's 62-tool surface shipped unchanged. Formalised by FORK-01 (Key Decisions, 2026-08-22): retained as the default hedge, now with dated reversal criteria — see that row rather than treating this bullet as the sole record.*
- **Upstreaming a `KEYBOARD_MATRIX_SET` opcode to VICE** — genuinely worth doing (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`, and it would close the hardest loss for everyone), but it is an upstream contribution, not a deliverable of this project. Recorded as a follow-up.
- **Byte-identical output parity with the fork** — explicitly not an acceptance bar. Disassembly formatting and illegal-opcode rendering differ from VICE's own, per `docs/stock-vice-parity.md` §A.7. *v0.2.0 dropped the two-process parity harness (`VERIF-03`) for exactly this reason: it would have measured something the project does not promise.*
- **Matrix-keyboard equivalence on the stock backend** — proven not recoverable at source level. `read_ciapb()` recomputes from `keyarr` on every read, and watchpoints fire after the load completes. `JOYPORT_SET` covers most in-game input instead.
- **Distributed / multi-host broker** — outside the current single-host architecture; no demand established.
- **Fixing the unauthenticated emulator endpoint exposure** — real (documented in `.planning/codebase/CONCERNS.md`), but a property of the external fork and its `0.0.0.0` bind, not of this project's scope.
- **Tool surplus on either backend, absent a caller** *(added v0.2.0, 2026-08-17)* — 17 requirements were cut against one measured test: *does a shipped skill call it, or does something a skill calls depend on it?* Cut: client-side screenshots and the PNG encoder (`SHOT-01..05`), call backtrace (`DERIV-02`), checkpoint groups and ignore counts (`DERIV-03`), memory fill and every `*_set_state` write half, all nine stock-only gains (`GAIN-01..09`, Phase 6 entire), disk detach, and the parity harness. Each stays in `milestones/v0.2.0-REQUIREMENTS.md` marked `CUT` with rationale, so restoring one is a scope decision rather than archaeology. **The fork's other 33 uncalled tools are surplus, not a gap.**
- **regenerator2000 capability surplus, absent a caller** *(added v0.3.0, cut 2026-08-17)* — 4 of the original 16 `R2000-*` requirements were folded or cut on the same measured test v0.2.0 used. Cut: HTML export with clickable xrefs (`R2000-07` — a shareable artifact no skill produces or consumes; still available ad-hoc via `--export_html`); the two-project limit as a reported error (`R2000-04` — folded into install documentation, since building detection for an upstream port collision is work in the wrong place); the static-vs-live tool-selection axis (`R2000-12` — folded into v0.2.0's `SKILL-01`, which already rewrote the same playbooks); and the `.vsf`/`.raw` bridge as its own requirement (`R2000-08` — it is which file extension you hand over, not a deliverable). Each stays in `milestones/v0.3.0-REQUIREMENTS.md` with rationale. A separate MCP-server-standup phase was dissolved into a task at the same time.
- **`.vsf` as a regenerator2000 bootstrap input** *(added v0.3.0, D-34; closed `wont-fix` by Phase 15 plan 15-12)* — the synthesis route hands over `.prg` / `.d64` / flat-64K only. Phase 9 found that a `.vsf`'s machine type reads correct only by coincidence: `"C64SC"` matches none of regenerator2000's literal arms, so it falls through to that tool's own C64 default and a non-C64 snapshot would be misreported. Prefer `.vsf` for anything *leaving* the emulator; that preference does not extend to this input set. Filed as `.planning/todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md` — reverses only if a consumer has `.vsf` captures and cannot re-capture as `.raw`.
- **Launching regenerator2000 with `--vice`, in any form** *(added v0.3.0, D-R1/D-07)* — not a scoping preference but a load-bearing invariant. It is what makes the whole `r2000_*` family backend-agnostic and keeps the binary monitor's single-client rule intact. Guarded twice in code, not documented once.
- **Uniform tool lists across backends** *(added v0.2.0)* — superseded the original "the MCP surface must not change" constraint and `.planning/intel/decisions.md`'s `DEC-preserve-mcp-surface`. Stock advertises only what it implements. A skill written against the full fork surface therefore *breaks* on stock rather than degrading, which is why the playbooks must name the stock route or the fork requirement.

## Context

**Where this stands.** v0.4.0 shipped 2026-08-23: 6 phases, 44 plans, 119 tasks,
16/16 requirements, 2 days, audit round 1 `tech_debt` with **zero blockers and
zero open gaps**. Three axes are now built and one is now *maintained*.
**Live:** a user with an apt-installed VICE can run the six shipped skills, and
is told plainly where they must reach for the fork instead (v0.2.0).
**Static:** what a recon session learns is written into a queryable annotation
store instead of prose, and the symbol round trip between the two closes
(v0.3.0, the first `passed` audit). **Honest:** the ledger this project carried
across three closes is discharged, the two questions it kept answering by
default are dated decisions, and the audit that checks all of it can no longer
declare itself clean over a red guard (v0.4.0).

**Current codebase state.** ~14.6k lines added outside `.planning/` across 290
files this milestone (~18k / 72 files in v0.3.0; ~54k / 151 files in v0.2.0).
The payload now lives under `src/` — `src/mcp/vice/` for `@henols/vice-mcp`,
`src/skills/` for the six skills — deliberately outside Claude Code's in-repo
autoload path, with a `mustNotExist` CI gate proving the old locations cannot
silently reappear. Node ≥ 22.18, TypeScript run directly via native
type-stripping (no build step for the shipped server). Stock backend: 38 tools,
9 derived client-side. Fork backend: 62 tools, unchanged. Static-analysis
surface: 17 curated `r2000_*` tools plus 7 `vice-mcp r2000` CLI verbs, all
container-side. Test suite at close: **2395 tests / 2351 pass / 0 fail** / 39
skipped / 5 todo / 24 suites — the full `npm test` glob, not `test:automated`,
which skips `MANUAL_ONLY_TESTS`.

**Documents are guarded like code, and the guards now gate the audit itself.**
Six `docs-*.test.ts` guards fail CI on planning-document drift:
`docs-linerefs.test.ts` pins CLAUDE.md's `rewriteArguments()` citations;
`docs-dangling-refs.test.ts` is a hand-written character state machine that fails
if any shipped string literal names a phase number; `docs-deferred-ledger.test.ts`
derives `STATE.md`'s deferred ledger from `.planning/todos/pending/` and fails in
*both* directions; `docs-review-disposition.test.ts` fails if any phase's review
finding lacks a cited disposition; and v0.4.0 added `docs-fork-decision.test.ts`
and `docs-core-value-decision.test.ts`, each reading its decision out of the live
PROJECT.md. `scripts/audit-gate.mjs` makes a green run of all six a
**precondition** of recording a gated milestone-audit status, enforced by a real
`PreToolUse` hook rather than by convention — and observed refusing all four
write routes against a genuinely red guard.

**The lesson this project has now been taught six times, in escalating forms.**
A test written by the same pass that wrote the code proves less than it looks
like it does. Phase 2's green suites hid 7 critical defects. Phase 3's fixtures
stubbed the same bits-vs-bytes assumption the code made. Phase 4's opcode table
was pinned by an independent bit-pattern derivation and *still* shipped 14 wrong
entries — caught only by running output through a real ACME. Phase 5's registry
could mark fields unavailable but could not defend against a wrong *bank
address*, so every chip read returned plausible values decoded from RAM
underneath the I/O area. Phase 8.1 is the cleanest instance: running the one
unwitnessed claim *falsified* it. And Phase 13 is the sixth: of four wire details
finally run against a real binary, one was refuted outright. In every case the
external check — a real assembler, a real emulator, a real container, a real
broker launch, a real `--help` — found what the internal one could not.

**A newer, sharper form of the same lesson.** Twice this milestone, a *closure
plan re-read its own premise and found it false.* Plan 15-04 was told two
findings were "superseded" and direct source inspection found both still open.
Plan 16-08's deferred entry predicted which plan would close its cascading test
failures and named the wrong one; the entry was corrected mid-close rather than
left standing. Restating a stale claim confidently is the same defect class as
an internal check standing in for an external one, one level up.

**Known debt carried out of v0.4.0.** **Zero pending todos** — the ledger is
derived from `.planning/todos/pending/` and guarded in both directions
(`STATE.md` → Deferred Items), and it reads 0 for the first time, down from 19
at the v0.3.0 close and 13 at v0.2.0's. What carries forward instead is
*explicit and owned*: 9 follow-on items promoted with named owners (5 under
`### Promoted by DEBT-01`, 3 under `### Fork Backend Follow-on`, 1 under
`### Control-Plane Bind Follow-on` in `milestones/v0.4.0-REQUIREMENTS.md`), plus
`UP-01`/`UP-02`, which stay Out of Scope as pull requests against projects this
repo does not own. Two coverage TODOs the audit recorded as non-blocking: five
of six phases left a `VALIDATION.md` at `status: draft`, and only Phase 17
produced a `SECURITY.md` — Phase 16's packaging/CI/network-bind work being the
one most likely to have benefited. Sixteen bookkeeping items were acknowledged
rather than resolved at the close (`override_closeout`); each is itemised in
`STATE.md` → `### Acknowledged at the v0.4.0 close` and each self-invalidates if
its artifact changes. Separately, and unchanged: `vice-proxy.ts` remains large
and is the sole tool-surface seam — client-side derivations go in sibling
modules, never appended to it. Also unchanged: `~15` carried WR-class
code-review findings are **dispositioned, not fixed**, and `DEBT-04`'s closure
note correctly declines to claim otherwise.

**A structural gap worth naming.** Phase directories are deliberately *not*
archived out of `.planning/phases/` at milestone close, unlike the roadmap and
requirements. Two committed guards read them directly:
`docs-review-disposition.test.ts` asserts at least 150 review findings found
there and explicitly excludes `.planning/milestones/`, and
`r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no
existence guard. Archiving them would turn both red. `.planning/phases/`
therefore accumulates across milestones by design, not by omission.

**Existing planning context (do not re-derive).** `.planning/codebase/` holds the
codebase map. `.planning/intel/` holds the ingested doc set: decisions,
constraints, `CAND-*` scope items, and resolutions. `.planning/INGEST-CONFLICTS.md`
records two user-resolved precedence warnings (W1, W2).
`.planning/notes/regenerator2000-integration.md` grounds v0.3.0 (D-R1..D-R4).

**Shipping history.** Newest tag `v0.4.0`; the version number resolves from a
single `VERSION` template rather than being hand-maintained in six places
(quick task `260819-tsz`), and release assets are stamped/zipped/attached by one
seam both CI release paths call (`260819-vie` — v0.2.0 had shipped with none,
because the merge path's `GITHUB_TOKEN` tag never re-triggers the tag-gated job).
The planning label and the published npm semver are determined independently — every merge to `main` auto-publishes a
patch version unless the subject contains `[skip release]`, so npm can run ahead
of the planning label at any time.

## Constraints

- **Compatibility**: The stdio MCP surface is **trimmed per backend** — stock advertises only the tools it implements, so the two backends expose different tool lists (Phase 2, D-07). A tool advertised on both keeps the same name and a backward-compatible argument shape — stock may add optional parameters but never removes, retypes, or newly-requires one — and the fork's list is unchanged from v0.1.x. A skill written against the full fork surface therefore *breaks* on stock rather than degrading; the playbooks must name the stock route or the fork requirement (SKILL-01). *(Supersedes the original "the surface must not change" constraint, and is pinned by `manifest-arg-compat.test.ts`.)*
- **Architecture**: The transport swap happens behind `vice.ts`'s `call()` seam for *direct* tools. **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** — `rewriteArguments()` runs at `vice-proxy.ts:3029` inside `forwardToVice()` (which starts at `:2964`) and before `call()`, so a derived tool sitting behind `call()` receives host-translated paths and acts on them inside the container. Second site with the same cause: `gatherWedgeEvidence()` calls `rewriteArguments()` itself, at `vice-proxy.ts:1508` (the function starts at `:1484`). The `r2000_*` family (v0.3.0 Phase 11) is registered through `buildViceTool()` and never reaches `forwardToVice()`, so neither call site is reachable from it — the constraint is satisfied by construction for that family, not by an interception. (Line numbers in this bullet are checked against the source at each phase and drift between phases; treat a mismatch as drift to re-verify, not as evidence the constraint itself changed. `docs-linerefs.test.ts` mechanically checks the two `rewriteArguments()` citations — the figures above were stale at `:2889`/`:1368` until the v0.3.0 close.)
- **Protocol (settled, normative)**: 11-byte request header / 12-byte response header, all multi-byte values little-endian. Confirmed opcode set and error codes per `docs/phase0-binmon-findings.md` §5.
- **Protocol**: **Five** unsolicited message types arrive at request-id `0xffffffff`, not three: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), plus `CHECKPOINT_INFO` (0x11) on every checkpoint hit and `REGISTER_INFO` (0x31) on every monitor open. The last two **share a response type with a legitimate command reply**, so demux must key on request-id and never resolve a pending request with an event.
- **Protocol**: `JAM` (0x61) has a **zero-length body**. `monitor_binary.c:384-394` computes the PC then passes `length = 0`, so no PC is sent. Every client surveyed assumes 2 bytes and breaks on it.
- **Protocol**: A non-stopping checkpoint emits a `CHECKPOINT_INFO` frame per hit **synchronously, over the blocking socket, from inside the CPU loop** — `mon_breakpoint.c:557-562` calls `mon_breakpoint_event()` before checking `cp->stop`. On a hot address this can stall the emulator thread. Independent source-level confirmation of `vice-sync.ts`'s "poll on `hit_count`, never on paused state" invariant.
- **Concurrency**: Stock VICE's binary monitor services **exactly one client**. A second `connect()` sits unserviced in the backlog with no reply and no EOF — indistinguishable from a wedge. The broker must guarantee single-client-per-instance and must not diagnose this state as a hang.
- **Protocol**: `default_memspace` contamination has no direct remedy over the binary monitor. A drive checkpoint hit sets it (`monitor.c:3393-3396`) and no command resets it, after which `ADVANCE_INSTRUCTIONS` and `EXECUTE_UNTIL_RETURN` step the *drive* CPU and `@bank:` conditions fail outright. Affects any stepping code written after drive debugging is added.
- **Protocol**: The wire memspace byte is **not** the internal enum — `0x00` = main, `0x01`–`0x04` = units 8–11 (`monitor_binary.c:401-434`). `0x08` is rejected.
- **Protocol**: Checkpoint *conditions* use the pseudo-registers `RL` and `CY` (uppercase), **not** the register-list names `LIN`/`CYC` — those lex as `BANKNAME` and produce a syntax error. Conditions have **no operator precedence** (`mon_parse.y:168`), so `RL == $64 && CY == $14` parses as `(((RL==$64) && CY) == $14)` and is always false; parenthesise every comparison. Bare integer literals are **hex** by default (`monitor.c:1597`), so `RL == 100` means line 256.
- **Protocol**: `CPUHISTORY_GET`'s count field is read as uint32 but stored in a `uint16_t` (`monitor_binary.c:1492`), so counts ≥ 65536 wrap. Clamp client-side to 65535.
- **Capability**: There is no runtime `WarpMode` resource (`vsync.c:220-241`, deliberately). Warp control on the stock backend must be launch-time (`-warp` / `InitialWarpMode`).
- **Capability**: Drive memory reads with true drive emulation off return **silent zeros, not an error**. The real gate is `Drive8TrueEmulation` plus a non-zero `Drive8Type` (`drive/drive-resources.c:450`); `check_drive_emu_level_ok()` is a machine-capability check that always passes on `x64sc`.
- **Safety**: Three resources power-cycle the machine one call deep, destroying all emulation state — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` (all reach `machine_trigger_reset(POWER_CYCLE)` at `c64/c64.c:1367`). Any resource-set tool exposed to an LLM must deny these.
- **Compatibility**: Resource names are not version-stable — `TrapDevice8` was `VirtualDevice8` before 3.10, renamed with no alias.
- **Protocol**: `DISPLAY_GET` (0x84) is INDEXED8-only and needs api_version ≥ 2; RGB conversion and PNG encoding move client-side.
- **Protocol**: No monotonic cycle register. `LIN`/`CYC` are readable but not monotonic; absolute cycles must be reconstructed or read from the text monitor's `stopwatch`.
- **Dependency**: `CPUHISTORY_GET` (0x86) requires **VICE ≥ 3.10**. Debian trixie/forky/sid and all current Ubuntu ship 3.9, which lacks the opcode entirely. Homebrew and official builds are fine.
- **Capability**: SID `$D400–$D418` is write-only in hardware and the binary monitor has no SID command — read-back is unrecoverable on stock. VIC-II/CIA *internal* state (raster-IRQ latch, timer latches) is likewise unavailable; only the readable register map is.
- **Capability**: Matrix keyboard is not recoverable on stock. `KEYBOARD_FEED` (0x72) injects buffer text only.
- **Tech stack**: Node ≥ 22.18 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift.
- **Architecture**: Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic.
- **Architecture**: The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between. It exists because of the 2026-08-01 triple-launch outage and is regression-tested.
- **Dependency**: regenerator2000 is a **required, container-side prerequisite**, not an optional accelerator (D-R2). Install is `cargo install regenerator2000` — no upstream release assets exist — and its real toolchain floor is **rustc ≥ 1.90**, transitive and undeclared in its own `Cargo.toml` (not edition 2024's 1.85; `--locked` does not work around it). Licence is the dual **`MIT OR Apache-2.0`**, not Apache-2.0 alone.
- **Architecture**: regenerator2000 is **never** launched with `--vice` (D-R1/D-07). `r2000-launch.ts` is the sole spawn seam for CLI verbs and `r2000-mcp-client.ts` the second, necessary async spawn site; both are guard-before-spawn, checked as a property over the shipped module set (`package.json` `files[]`, not a raw directory listing) by `r2000-spawn-seam.test.ts`.
- **Capability**: regenerator2000's keystroke-bootstrapped project defaults `use_illegal_opcodes: false`, under which an ACME export contains no illegal-opcode mnemonic at all — so an unqualified default run proves nothing about 6510 illegal opcodes. The synthesiser forces the `use_illegal_opcodes`/`system` pair explicitly.
- **Capability**: regenerator2000 reads a `.vsf`'s machine type by matching literal arms that `"C64SC"` does not match, falling through to its own C64 default. A C64 snapshot reads correct only by coincidence; a non-C64 one would be misreported. Hand it `.prg` / `.d64` / flat-64K (D-34).
- **Capability**: regenerator2000's MCP HTTP mode has no `--mcp-port`/`--mcp-bind`, so only one project can be served at a time. This is a **stated** limit carried in the install docs, not a detected-and-reported one (`R2000-04` was cut). The `--mcp-server-stdio` route is unaffected.
- **Testing**: `vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested — their correctness only means anything against a real emulator's timing. Preserve the documented invariants (exactly one resume per wait; poll on `hit_count`, never on paused state).

## Engineering Governance

All planning and implementation must comply with:

- `.planning/ARCHITECTURE.md` — stable runtime, dependency, backend, broker, protocol, and
  host/container boundaries.
- `.planning/ENGINEERING_RULES.md` — verification, testing, dependency, scope, Git, and definition-
  of-done policy.

The architecture rules are project invariants, not implementation suggestions.

If a plan requires violating an architecture rule, the plan must identify the rule, explain why
it cannot be preserved, record the architecture decision, and add/update a regression guard where
practical before implementation proceeds.

A plan is not complete when code is written. It is complete only when the applicable verification
requirements in `ENGINEERING_RULES.md` have passed, and the wording of the completion claim does not
exceed the available evidence.

Where correctness depends on external behavior (for example stock/fork VICE, ACME,
regenerator2000, package installation, or the real broker launch path), an internal mock or
same-assumption fixture does not replace the relevant external oracle unless the reduced evidence
ceiling is explicitly recorded.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add a stock-VICE backend rather than replacing the fork | The fork retains SID read-back and matrix keyboard; keeping it costs almost nothing since it already exists and is tested, and it removes the single-point-of-failure bet | ✓ Good — v0.2.0 shipped both; the fork's 62-tool surface is byte-identical to v0.1.x |
| Backend selected project-level (one per MCP server process) via config | Simplest to implement and reason about; user chose it over launch-time probing and per-instance selection | ✓ Good — `backend-detect.mts` resolves once per broker process with an on-disk cache |
| Parity verification runs two server processes, not one switching in-process | Forced by the project-level choice above — both backends cannot be live at once | ⚠️ Revisit — the harness (`VERIF-03`) was **dropped**: `PROJECT.md` already declares byte-identical parity a non-goal, so it would have measured an unpromised property. The generated `docs/tool-support.md` gives the user the same information |
| All three stock-only gain groups in scope, not parity-first | User elected the fuller scope; makes the milestone materially larger than the ADR's 7-phase plan | ⚠️ Revisit — **reversed 2026-08-17.** `GAIN-01..09` and all of Phase 6 were cut: no shipped skill calls any of them. Capability surplus, not a gap |
| Every tool kept in the manifest with per-backend support annotation | A tool degraded on stock may be fully supported on the fork; a single flag would lose that, and removing tools would change the surface shape between backends | ⚠️ Revisit — **reversed by D-07.** The stock manifest is genuinely trimmed to 38 tools. Per-backend honesty moved into `capability-registry.ts`'s runtime refusal plus the generated support table, which serve the same goal better than a manifest annotation would have |
| No SID write-shadowing mitigation | Switchability routes SID work to the fork; shadowing was never parity | ✓ Good — held all milestone; `vice_sid_get_state` refuses on stock by name |
| Ship a client-side 6510 disassembler | The binary monitor has none, and byte-identical output was explicitly ruled out as an acceptance bar | ✓ Good — 221/256 opcodes assembler-expressible, round-tripped byte-exact through real ACME 0.97; live output byte-identical to VICE's own text-monitor `d` |
| Backend swap confined to the `call()` seam | `vice.ts` was built as the single transport seam for exactly this kind of change | ⚠️ Revisit — true for *direct* tools only. **Derived tools must be intercepted before `forwardToVice()`**, since `rewriteArguments()` runs inside it and ahead of `call()`; a derived tool behind `call()` receives host-translated paths and acts on them inside the container. Phase 4 built `withDerivedTool()` as the second seam |
| Cut scope by measured caller, not by judgment (2026-08-17) | Diffing the six skills' actual `vice_*` usage against both manifests answers "is this needed" mechanically | ✓ Good — 29 open requirements → 14, Phase 6 removed whole, and every cut names its requirements so reversal is a scope decision |
| Trim the stock manifest instead of keeping surface shape uniform (D-07) | Advertising a tool the backend cannot serve is the dishonesty the milestone exists to remove | ✓ Good — and it forced `SKILL-01`: playbooks now name the stock route or the fork requirement at the point of use |
| Run the walkthrough for real rather than assert it (Phase 8.1) | The one claim in the milestone with no witness was the install-to-capture flow | ✓ Good — and it **failed**, exposing the `Drive8Type=0` defect. Phase 8.2 fixed it and re-ran to a verified 65536-byte capture. The cheapest defect this milestone found came from refusing to assume |
| Make the assumption probe a standalone go/no-go **phase**, not a criterion inside one (v0.3.0, 2026-08-19) | `R2000-16`'s failure mode is reconsider-the-milestone, not replan-the-phase. A phase boundary makes that gate structural rather than skippable | ✓ Good — and the gate fired for real: criterion 3(4) scored `partial`, rule `R4` selected `degrade`, and the input set narrowed to `.prg`/`.d64`/flat-64K. It also corrected three of its own research inputs (rustc floor, dual licence, a glibc mismatch). A probe that cannot say no is theatre |
| Honour the `degrade` verdict rather than override it | The rule was written and its inputs recorded *before* the answer was known; overriding it would have made every future gate advisory | ✓ Good — cost one input format, kept the mechanism credible. `R4` specifically, not `R3`: the bootstrap was **not** the degraded element, so Phase 10 still delivered full automation |
| Register the `r2000_*` family proxy-locally via `buildViceTool()`, never through `forwardToVice()` | CLAUDE.md's derived-tool constraint says a tool behind `call()` receives host-translated paths and acts on them inside the container | ✓ Good — the constraint is satisfied **by construction**: neither `rewriteArguments()` call site is reachable from the family, so there is no interception to forget. Also makes the family backend-agnostic for free |
| Guard `--vice` twice — unreachable by construction *and* denied by a scan | A single guard is one refactor away from silently lapsing, and the invariant is what keeps the family backend-agnostic and the binary monitor's single-client rule intact | ✓ Good — both pinned by tests proven to fail under live reintroduction mutations, not merely written |
| Synthesise `.regen2000proj` in pure Node instead of using the tmux keystroke bootstrap the probe had already proven automatable | The keystroke route works, but defaults `use_illegal_opcodes: false` — under which an export proves nothing about illegal opcodes | ✓ Good — the working route was rejected for the correct one. Forces the `use_illegal_opcodes`/`system` pair explicitly, pinned by planted-violation-verified tests |
| Hand-roll the newline-delimited JSON-RPC client instead of using `@mastra/mcp`'s `MCPClient` | Decided by a five-property live measurement against the real binary, not by preference | ✓ Good — yields six distinct named failure modes instead of one opaque one, plus independent persistence verification for `r2000_save_project` |
| Make the store canonical and the Markdown memory map a generated view | A hand-edited map and a queryable store cannot both be the truth | ✓ Good — `render-memmap --check` plus a render-digest drift guard makes the divergence mechanical rather than a review item |
| Prove the store's value by sealed question, not by assertion (Phase 11 criteria 1) | "A later session can query instead of re-deriving" is exactly the kind of claim that reads true and tests nothing | ✓ Good — session A sealed a question with a hashed answer key; a genuinely separate session B answered from tool calls alone and the canonical line hashed identically (`e64463d8…`). The strongest evidence this milestone produced |
| Close every audit finding behind a guard proven non-vacuous, not merely fixed (Phase 11.1) | An audit finding fixed without a guard is a finding that returns | ✓ Good — each guard demonstrated by a planted violation or a real reverted edit before acceptance. The completeness guard then found **27** undispositioned findings against a pre-measured 8, and the audit closed `passed` |
| Extend document guarding from source claims to planning claims | v0.2.0's audits kept finding stale planning-document assertions by hand, repeatedly | ✓ Good — four `docs-*.test.ts` guards now fail CI on line-reference drift, dangling phase pointers, an undelegated deferred ledger, and undispositioned review findings. This close found two more stale counts *because* the guards exist |
| Retain the forked VICE MCP backend as the default hedge (FORK-01, decided 2026-08-22) | Both hard losses this branch hedges — SID read-back (write-only in hardware, unrecoverable by any opcode) and RESTORE/NMI (no client-side substitute exists) — have no route except the fork, and retention's steady-state cost is already sunk and running in CI; the one unpaid cost, the first live exercise of the fork's own `-mcpserver` HTTP transport, is paid by 14-03 on this branch. This decision reverses if UP-01 lands: a `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in `monitor_binary.c` calling `keyboard_set_keyarr_any()`) that closes stock's hardest loss for everyone. As of VICE 3.10 that opcode has NOT landed — confirmed against the 3.10 manual's binary-monitor command list, whose only keyboard-related command is `0x72` buffer-text feed — and Debian/Ubuntu's `apt` path already lags a release behind, so a landed opcode needs a further release cycle to reach this project's documented primary install path. Landing it would close the matrix-keyboard loss specifically; its effect on RESTORE/NMI is unconfirmed, not assumed closed; it closes SID read-back not at all, since that is a write-only-hardware fact no opcode changes. This trigger is manually tracked, not mechanically probed, since a version probe for an opcode with zero wire presence today is out of scope. Caveats carried, not resolved: the fork maintainer's current activity was not checked this session, so retain's near-zero carrying cost dates from 2026-08-11 (A2); no evidence establishes whether any consumer runs the fork transport in production today (A3). | ⚠️ Revisit — pinned by the committed guard `docs-fork-decision.test.ts`. The adequacy evidence now exists: plan 14-03 exercised the fork's own `-mcpserver` HTTP transport live against a real fork binary (`/usr/local/bin/x64sc`, VICE 3.10) for the first time in this repository's history — 6/6 passing, including `vice_sid_get_state` end to end, so the SID read-back route this decision retains is proven followable rather than merely documented. Observed payloads in `.planning/phases/14-backend-decision/14-CRITERION3-EVIDENCE.md`; repeatable via the default-skipped `fork-live.test.ts` (opt in with `VICE_LIVE_FORK_BIN`). Still `Revisit` rather than `✓ Good` because the reversal trigger is manually tracked, not probed. |
| Accept the broker control-plane listener's `0.0.0.0` bind default as a documented risk rather than narrowing it (PKG-04, decided 2026-08-22) | The broker's own TCP control-plane listener (acquire/release/recycle/status/host_state/monitor_claim/monitor_release) defaults its bind to `0.0.0.0` at five sites — two authored code sites (`vice-broker.mts`'s `controlHost`, `broker-control.mts`'s `startControlListener()` fallback), one authored doc-comment site recording the same rule, and two compiled `resources/*.mjs` twins that carry it forward mechanically. This is deliberate, not an oversight: a containerised consumer dials `host.docker.internal`, which on Linux resolves to the Docker bridge gateway address rather than the loopback interface, so a `127.0.0.1`-bound listener would be structurally unreachable from exactly the topology this project's container-detection code exists to serve. The decision was taken at a blocking `checkpoint:decision` on 2026-08-03, `as-specified`, no amendments. The listener is not unauthenticated: every request is gated by a 256-bit CSPRNG capability token, minted once per broker boot, compared with `timingSafeEqual` over equal-length buffers before any state read or write, and persisted for the broker's entire running lifetime in a mode-`0600` `broker.json` — never logged, never placed in an error message. Residual risk, stated without softening: any host reachable on the same local network segment can open a connection to the control port; without a valid token every operation returns `unauthorized` and nothing is read or written; with a leaked token, an attacker on that segment can acquire, release and recycle emulator instances — materially smaller than arbitrary code execution, but a real tampering and availability exposure on an untrusted segment such as public Wi-Fi or a shared lab network. The narrow branch (bind `127.0.0.1` by default) was considered and rejected: it reverses the 2026-08-03 checkpoint decision without the live container-reachability evidence that decision rests on, and the only non-regressive form of narrowing — binding loopback unless a container topology is detected — is new behaviour this milestone's Out of Scope table excludes ("Any new tool on either backend ... This milestone adds no capability"). Reverses if a future milestone ships a loopback default with an opt-in widen, mirroring the existing binary-monitor host pattern that already warns once on widening, gated on `container-guard.mts`'s detector actually being consulted at the control-plane bind decision — which it is not today. | ⚠️ Revisit — accepted rather than removed; the reversal trigger is a design decision a future milestone takes, not something probed mechanically. Live-confirmed this session: the control listener bound `0.0.0.0:19510` on a real broker start (`16-PKG04-EVIDENCE.md`); the corresponding stock binary-monitor default (`127.0.0.1`) is source-cited in the same document, not independently live-observed this session since this host's `x64sc` resolved to the fork build. |
| Build the audit-integrity instrument first, as Phase 12, before any disposition work (v0.4.0, 2026-08-21) | `4f048bb` closed v0.3.0 with `docs-review-disposition.test.ts` already red and nothing forced anyone to notice. An instrument built *after* the work it is meant to gate has never gated anything | ✓ Good — every later v0.4.0 phase ran under its own gate, and the mechanism was **watched refusing**: Claude Code's own `PreToolUse` dispatch blocked all four write routes (Write, Edit in two payload shapes, Bash heredoc, a subagent's Write) against a genuinely red guard, then allowed them after a verified revert. The instrument's own review then found a live super-linear-regex denial of service and a single-line Bash-append bypass that plan 12-02 had *claimed* to close but did not |
| Promote unclosable items with a **named owner** rather than closing or carrying them (DEBT-01, v0.4.0) | "Every item is fixed" is unachievable and invites a dishonest ledger; "every item is carried" is what this project did for three closes. A promotion with an owner is checkable and neither | ✓ Good — 19 inherited items → 0 pending, with 9 promoted into named buckets in `milestones/v0.4.0-REQUIREMENTS.md`. The ledger reads 0 honestly rather than by redefinition, and `docs-deferred-ledger.test.ts` was fixed to be *able* to express zero (its non-vacuity floor had asserted `pending.length >= 2`) |
| Widen `docs-review-disposition.test.ts`'s parser rather than trust its green run (v0.4.0 Phase 15) | The guard keyed on level-3-colon-only headings, which is a property of how findings happened to be written, not of what a finding is | ✓ Good — 119 visible findings became 150, and the 9 the widening exposed were dispositioned back to green. A guard whose scope is narrower than its subject reports clean for the wrong reason |
| Acknowledge the pre-close artifact audit's 16 items rather than resolve them (v0.4.0 close, 2026-08-23) | All 16 are bookkeeping — `status:` fields never flipped after their work landed, plus quick-task directories from this and earlier milestones. None is a requirement gap, an integration gap, or an unverified phase; the milestone audit scored 16/16, 6/6, 12/12, 4/4 with zero blockers | — Pending — recorded as `closeout_type=override_closeout` and itemised in `STATE.md` → `### Acknowledged at the v0.4.0 close`. Acknowledgment is verdict-preserving and self-invalidating: each suppression lapses the moment its artifact's observed state changes, so none of it can hide a *new* problem. Revisit at the next close, where a still-acknowledged item is evidence the bookkeeping never got fixed |
| Do **not** archive phase directories at milestone close, unlike the roadmap and requirements (v0.4.0 close, 2026-08-23) | Two committed guards read `.planning/phases/` directly: `docs-review-disposition.test.ts` asserts ≥150 review findings found there and explicitly *excludes* `.planning/milestones/`, and `r2000-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no existence guard. The default-on archival would turn both red | ⚠️ Revisit — `--no-archive-phases` passed at this close (and effectively at the two before it). `.planning/phases/` accumulates across milestones by design, not omission. The clean fix is to teach both guards to read the archive too; until then this is a standing constraint on the close procedure, not a preference |
| D-36 (decided 2026-08-24) supersedes D-32: `r2000_get_address_details` is curated as a client-side composition, not excluded | `r2000_get_address_details` is curated and composed **entirely client-side** from the four already-curated reads `r2000_get_symbols`, `r2000_get_comments`, `r2000_get_blocks` and `r2000_get_cross_references`, and never calls upstream's same-named tool at all (D18-27/D18-28). Why: `handler.rs:1894`'s `raw_data.len() as u16` wraps 65536 to 0, so on a full 64K project upstream's tool answers `OutOfRange` for every address — re-confirmed live against the installed 0.9.20 during v0.5.0 research on 2026-08-23. Composition makes that defect unreachable by construction rather than detected and routed around. The tool keeps its upstream name (D18-29) so Phase 19's absorbed procedures need no rewriting, with the composed nature stated in the tool description rather than encoded in the name. This reverses if an upstream fix to regenerator2000 issue #42 (https://github.com/ricardoquesada/regenerator2000/issues/42) lands in a released version this project installs, which would let the composition be retired in favour of the native tool. This trigger is manually tracked, not mechanically probed, the same way this project's other retain-with-reversal-criteria decisions state their own triggers (see the fork-backend retention row above). Standing position: a pull request against a repository this project does not own is a follow-up, not a deliverable — which is why the fix is recorded as this project's reversal trigger rather than as work | ⚠️ Revisit — pinned by the committed guard `docs-r2000-decisions.test.ts` |
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state


## Current State

**Shipped: v0.4.0 Debt discharged, decisions settled** — 2026-08-23.
6 phases (12, 13, 14, 15, 16, 17 — no inserted decimals), 44 plans, 119 tasks,
16/16 requirements, 2 days, 292 commits.
Full record: [`MILESTONES.md`](MILESTONES.md) ·
[`milestones/v0.4.0-ROADMAP.md`](milestones/v0.4.0-ROADMAP.md) ·
[`milestones/v0.4.0-REQUIREMENTS.md`](milestones/v0.4.0-REQUIREMENTS.md) ·
[`milestones/v0.4.0-MILESTONE-AUDIT.md`](milestones/v0.4.0-MILESTONE-AUDIT.md)

The project stops inheriting the same ledger. The pending-todo tree reads
genuinely empty for the first time in this project's history — **19 inherited
items → 0** — with every one of them fixed, dispositioned `wont-fix` with
rationale, or promoted with a named owner. The two questions this project had
been answering *by default* each milestone are now dated decisions pinned by
their own guards: `FORK-01` **retain** (with the upstream `KEYBOARD_MATRIX_SET`
coupling as the named reversal criterion) and `CORE-01` **keep-dated**. The
plugin payload lives under `src/` with both published tarballs still validated.

**Audit verdict: `tech_debt`, round 1 — zero blockers, zero open gaps.**
16/16 requirements, 6/6 phases, 12/12 integration, 4/4 flows, no orphaned or
missing connections. `tech_debt` rather than `passed` on bookkeeping and coverage
only: five of six phases left a `VALIDATION.md` at `status: draft`, and only
Phase 17 produced a `SECURITY.md`. Four of the six phases needed a second
verification round, and in every case the gap was closed by real work rather
than by re-reading the same evidence — which is the pattern the audit instrument
was built to force.

**Closed as `override_closeout`.** The pre-close artifact audit reported 16 open
items — all bookkeeping (`status:` fields never flipped after their work landed,
plus quick-task directories from this and earlier milestones). They were
acknowledged rather than resolved; see `STATE.md` →
`### Acknowledged at the v0.4.0 close` for the itemised disclosure. 0 items were
carried forward from a prior close.

**What the milestone proved beyond its requirements.** The audit gate is not a
document: Claude Code's own PreToolUse dispatch was watched refusing all four
write routes — Write, Edit in two payload shapes, a Bash heredoc, and a
subagent's Write — against a genuinely red guard, then allowing them after a
verified revert. And external checking beat internal checking a sixth time: of
the four spec-driven Phase 3 wire details finally run against a real binary, one
came back **refuted** — `vice_disk_attach`'s advertised no-side-effect promise
is false, and was corrected at source rather than annotated.

**Prior milestone — v0.3.0 regenerator2000 static-analysis backend**, 2026-08-21:
4 phases (9, 10, 11, inserted 11.1), 36 plans, 101 tasks, 12/12 in-scope
requirements, 3 days, 268 commits, audit round 2 **`passed`** — the first
`passed` this project recorded. Recon findings stop being prose: 17 curated
`r2000_*` tools and 7 `vice-mcp r2000` CLI verbs over a persistent annotation
store, container-side and structurally incapable of touching VICE; register
writes render as generated bit-name enums; symbols flow both ways between the
store and a live emulator; the flat linear `toacme` decoder is deleted,
grep-gated gone. The go/no-go gate fired for real and was honoured — the
milestone shipped *smaller* than proposed because criterion 3(4) came back
`partial`. Archived at
[`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md).

**Before that — v0.2.0 Switchable stock-VICE backend**, 2026-08-19: 9 phases,
87 plans, 218 tasks, 51/51 in-scope requirements, 8 days, audit round 4
`tech_debt`. The plugin no longer requires a custom VICE build. Stock upstream
`x64sc` is a first-class, project-selectable backend with 38 tools; the fork
keeps its 62 and is the documented route for the three capabilities stock
provably cannot have. Verified end to end against a genuine `/usr/bin/x64sc`
(VICE 3.9) through the real broker. Archived at
[`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md).

## Shipped: v0.5.0 Persistent Session and the Coverage Instrument

**Shipped 2026-08-25** (`override_closeout`). 2 executed phases, 27 plans, 61
tasks, 13/27 requirements.

**Opened as** "The rebuild half — absorbed playbooks, modifiable source"
(Phases 18-22), aiming to turn a C64 binary into rebuildable, subsystem-split,
fully-symbolised ACME source. **It delivered the first half and cut the second.**

**Delivered:** a regenerator2000 session that survives many tool calls with
crash recovery and a FIFO call queue; all five upstream analyze procedures
absorbed and attributed at one pinned commit; a seventh skill
(`routine-queue-walker`); and a derived-from-bytes coverage census that the
store's own block table cannot move by a single byte, with six committed
controls and a pairwise trigger-collision gate over all seven skill
descriptions.

**Cut on 2026-08-25:** Phases 20-22 (Decomposition to Closure; Rebuildable
Source and the Reassembly Gate; Equivalence and Modifiability), dissolved by
the dxa+Ghidra pivot. No plan was ever written for any of the three — the
fourteen requirements they carried (DECOMP-*, BUILD-*, EQUIV-*) are re-mapped
to v0.6.0, not dropped.

**The pivot, and why it reverses D-R1/D-R2.** Those phases assumed
regenerator2000 as the analysis substrate. Measured on a committed 279-byte
fixture (141 code / 138 data bytes) exercising split pointer tables, an
RTS-trick dispatch, a bounded indexed array, a stride-5 record array, inline
`JSR` parameters and self-modifying code:

- **r2000 unannotated flat-decodes** — every data table rendered as garbage
  instructions. So does `da65` with no info file.
- **dxa**, with zero hints, typed 72% of data bytes as data with **zero false
  positives**, found every routine from the BASIC `SYS`, and resolved a
  4-entry address table to labels.
- **Ghidra**, given dxa's map plus volatile `$0000-$0001`/`$D000-$DFFF` memory
  blocks, resolved the indirect dispatch (`COMPUTED_JUMP`), flagged the
  self-modifying write landing inside a Code block, and recovered the index
  bound, the split-pointer `CONCAT11` idiom and the record stride — all in the
  **decompiler** layer, not the listing's data types.

r2000 is consequently reduced from "the analysis engine" to an annotation store
plus an ACME printer, both of which this project can own. `cc65` (da65/ca65/
ld65) is not adopted: da65's `RANGE TYPE` vocabulary cannot express a
split-address table or a struct, so everything Ghidra recovers dies at that
export boundary.

**Standing record:** `.planning/notes/dxa-ghidra-pivot.md`,
`auto-annotation-from-ghidra-xrefs.md`, `ghidra-volatile-io-and-banking.md`,
`vic-graphics-map-derivation.md`, and the reproduction material in
`notes/dxa-ghidra-pivot-evidence/`.

**Known verification overrides:** 5 newly acknowledged, 16 carried forward
(STATE.md → Deferred Items), plus Phase 19's own SC4/COV-01 override — accepted
because the replacement plan for the coverage instrument *is* this pivot.

## Current Milestone: v0.6.0 Own the substrate

**Opened 2026-08-25.** Decided at the v0.5.0 close and scoped in this session.

**Goal:** Replace regenerator2000 as the analysis substrate with dxa + Ghidra
and an annotation store this project owns — proving the pivot's numbers hold on
real cracked code *before* anything is built on them.

**Target features:**
- The pivot's measurements re-run against real cracked releases as a standalone
  go/no-go gate, including the `memmap.json` flat-address model against
  ROM-banking code
- dxa vendored plus the listing parser this project must own, since dxa has no
  machine-readable output
- Ghidra headless under this project's harness, with volatile I/O memory blocks
  applied before `analyzeAll()` so hardware writes survive the decompiler
- Structural facts exported through `DecompInterface`, not `DataTypeManager`
- The 105-byte undocumented-opcode SLEIGH extension
- An owned annotation store — labels, comments, per-range typing, scopes, enums,
  undo, persistence — with an MCP surface and an ACME exporter
- 19,181 lines of regenerator2000 integration glue deleted
- Automatic annotation: the `memmap.json` join, `$01` bank-state derivation, VIC
  graphics-map derivation

**Scoped to the substrate only.** `DECOMP-01..04`, `BUILD-01..06` and
`EQUIV-01..04` stay re-mapped to v0.7.0 rather than being rewritten now against
a store that does not exist yet. That is a scoping decision taken in this
session, not a second cut — see "Next Milestone Goals" below.

**Phases:**

| | Phase | Delivers |
|---|---|---|
| **23** | The real-release gate | dxa + Ghidra re-run against the `c64-provenance-diff` fixtures — real releases, already committed, already provenance-classified. Measures data-recovery rate and false positives on real packed/cracked code, whether constant propagation still resolves indirect dispatch when the index is *computed* rather than an immediate `ldx #$02`, whether the `analyzer.rs` work being dropped was doing something the pair does not replace, and how the auto-annotation join behaves against ROM banking. Go / degrade / no-go on Phase 9's pattern — which came back `degrade` and shipped a smaller, correct milestone |
| **24** (A) | The two engines | dxa vendored plus a listing parser; Ghidra headless harness; `ApplyHints` (volatile I/O blocks + dxa's map); `ExportAnalysis` against `DecompInterface`; the undocumented-opcode SLEIGH extension (`docs/undocumented-opcodes-ghidra.md`, all 105 bytes) — stock Ghidra's `6502.slaspec` defines 57 instructions, all documented, so this is the one real toolchain gap |
| **25** (B) | The annotation store | labels, comments, per-range typing, scopes, enums, undo, persistence; MCP surface; ACME exporter. Deletes 19,181 lines of r2000 integration glue (9,087 non-test + 9,928 test) |
| **26** (C) | Automatic annotation | the `memmap.json` join and its three selection rules; `$01` bank-state derivation; VIC graphics-map derivation |

**Phase numbering starts at 23.** 20-22 are cut and never reused.

**Reuse rather than rebuild:** `disasm-opcodes.ts`/`disasm-decoder.ts`/
`disasm-renderer.ts` (2,555 lines) already decode 6502 including illegal
opcodes; `r2000-d64.ts` (310 lines) is standalone; `memmap.json` plus
`r2000-regbits-gen.ts` plus `r2000-enum-gen.ts` already own machine knowledge
and enum generation.

**Dropped deliberately:** r2000's unpacker (~5,400 lines including the CPU it
needs, with claimed 100% unp64 benchmark parity). Owner decision 2026-08-25:
depack-by-running via `c64-ram-capture` is sufficient.

**The open question is now Phase 23, not a caveat.** Every number behind this
pivot comes from one 279-byte fixture written by the same person testing it.
Rather than carry that as a note, v0.6.0 opens with the gate that answers it,
against the `c64-provenance-diff` fixtures. The specific risk named at the
v0.5.0 close is that `memmap.json` has a flat address model, so against code
that banks ROM in and out an address's meaning becomes bank-dependent. See
`.planning/research/questions.md` for both open questions and
`.planning/notes/dxa-ghidra-pivot.md` for the evidence being re-tested.

**Byte-perfect reconstruction is explicitly not the goal.** Source quality and
functionality are; rebuilding a binary is a separate, later step (user decision,
2026-08-24).

## Next Milestone Goals

**v0.7.0 — the rebuild half, on the owned substrate.** v0.5.0's three cut
phases, rewritten: decomposition to closure, rebuildable source and the
reassembly gate, equivalence and modifiability — carrying `DECOMP-01..04`,
`BUILD-01..06` and `EQUIV-01..04` unchanged except for `BUILD-01`, already
reworded from "per regenerator2000 scope" to "per annotation-store scope". They
were held out of v0.6.0 deliberately: each is written against a substrate that
v0.6.0 builds, so scoping them before Phase 25 lands would mean writing them
twice. Their text stands in
[`milestones/v0.5.0-REQUIREMENTS.md`](milestones/v0.5.0-REQUIREMENTS.md).

---

**v0.4.0 took four of the five candidates standing at the v0.3.0 close** — the
carried debt, the fork-backend decision, the Core Value restatement, and
packaging and repo shape — and closed all four. See "Current State" above. What
follows is what carries into the next scoping conversation, all of it explicit
and owned rather than inherited silently.

**Standing, not scoped:**

1. **The upstream contributions.** Recorded under Out of Scope here and left
   there by v0.4.0, because both are pull requests against projects this repo
   does not own: a `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60
   lines in `monitor_binary.c` calling `keyboard_set_keyarr_any`, closing stock's
   hardest loss for everyone, not just this plugin), and regenerator2000's
   `--mcp-port` / `--mcp-bind` (~5 lines, unblocking two projects at once and a
   host-side TUI — currently a *stated* limit in this project's install
   documentation precisely because it cannot be fixed downstream). Neither is a
   deliverable of this repo; both would change what this repo can promise.
   **The first is coupled to `FORK-01`** — if it lands upstream, one of the three
   reasons to keep the fork backend disappears. The trigger is tracked *manually*,
   because a version probe for an opcode with zero wire presence today would be
   speculative engineering against an unlanded upstream change.

2. **The 9 follow-on items v0.4.0 promoted rather than closed**, each already
   carrying a named owner in `milestones/v0.4.0-REQUIREMENTS.md`. This is the
   list `DEBT-01` exists to produce: promoting with an owner instead of carrying
   silently is the outcome, not a shortfall.
   - `### Promoted by DEBT-01` (5): `vice_disk_attach`'s contract-redesign
     question (the A5 refutation's *behavioural* half — `fileIndex` when
     `runAfter=false` — deliberately not resolved by the string fix);
     `code-review.md`'s file-list scoping omission (owner: GSD toolkit
     upstream); measuring `InitialWarpMode`'s actual runtime effect; deriving
     the `cpuhistory-get*` fixtures' `capturedFrom` automatically;
     `c64-ram-capture`'s keyboard-typed-`LOAD` fallback stall.
   - `### Fork Backend Follow-on` (3, `FORK-01` = `retain`): the 24
     fork-only-tool disposition; how a breaking tool-surface change is released;
     tracking the `KEYBOARD_MATRIX_SET` reversal trigger (manual — no version
     probe is possible).
   - `### Control-Plane Bind Follow-on` (1, `PKG-04` = `accept`): the smart
     loopback-unless-container bind default. Explicitly *not* a narrowing of the
     current `0.0.0.0` default — it is new behaviour, and reversing the
     2026-08-03 checkpoint decision needs live container-reachability evidence.

3. **Two coverage TODOs the v0.4.0 audit recorded as non-blocking**, worth
   folding into scope rather than rediscovering at the next close: five of six
   phases left a `VALIDATION.md` at `status: draft` (seeded by `plan-phase`,
   never reconciled by `validate-phase`), and only Phase 17 produced a
   `SECURITY.md` — Phase 16's packaging/CI/network-bind work, including
   `PKG-04`'s accepted `0.0.0.0` bind, is the one most likely to have benefited.

4. **The `~15` dispositioned-but-unfixed WR-class review findings.** Enumerated
   in `milestones/v0.2.0-MILESTONE-AUDIT.md`; all carry a cited disposition
   (`docs-review-disposition.test.ts` is green over 150 findings with 0
   undispositioned), which is not the same as fixed. `DEBT-04`'s closure note
   correctly declines to claim otherwise. Whether any of them is worth fixing is
   a scope decision, not debt discovery.

**Shipped since this section was last written:** v0.4.0, 2026-08-23 (see Current
State). The release plumbing v0.2.0 exposed remains closed — one `VERSION`
template with a resolver seam replaced six hand-maintained strings, and one
`scripts/release-assets.sh` seam is called by both CI release paths, since
`release-on-merge`'s `GITHUB_TOKEN` tag cannot re-trigger the tag-gated job.

<details>
<summary>Previous milestone detail — v0.3.0 phase-by-phase narrative (archived 2026-08-21)</summary>

**v0.3.0 regenerator2000 static-analysis backend — as it was tracked during execution:**

**Goal:** Adopt regenerator2000 as a static-analysis-only backend so recon findings
become queryable, undoable state instead of Markdown prose — and the symbol round
trip between static annotation and the live emulator finally closes.

**Target features (all delivered):**
- The `R2000-16` assumption probe answered against a real build, as a standalone
  go/no-go gate before any further plan is written — the pty/HTTP-MCP question
  decides whether project bootstrap is automatable at all
- regenerator2000 adopted static-analysis-only, never launched with `--vice`,
  guarded in code rather than only documented; runs container-side so no path
  translation applies
- Project bootstrap from a raw binary automated rather than a documented manual step
- `acme-build`'s `disasm` verb and its `toacme`-on-PATH prerequisite removed,
  replaced by a route whose output is verified by reassembly
- `c64-program-recon` writes labels, comments, block types and scopes into a
  queryable annotation store; a later session queries instead of re-deriving
- Cross-reference and search over an analysed program
- Enums generated from `c64-memory-mapping`'s `memmap.json`, so register writes
  render with semantic names instead of magic numbers — neither project can do
  this alone
- The symbol round trip: annotations export as VICE label files into the symbol
  store, and names discovered live flow back

**How it actually went, phase by phase:**
- **Phase 9 (8 plans, no product code — the deliverable is evidence).** Verdict
  `degrade`, rule `R4`. Four of five assumptions held: the pty tolerates a
  non-TTY, the Save-As bootstrap completes with no human, ACME reassembly is
  byte-identical once `use_illegal_opcodes` is on, and an unmodified
  `--export_lbl` file is consumed by the live `vice_symbols_load`. The fifth is a
  genuine `partial` — a `.vsf` carries its start address, but `"C64SC"` matches
  none of regenerator2000's literal arms and falls through to its own C64
  default, so a non-C64 snapshot would be misreported. `R4` not `R3`: the
  bootstrap was **not** the degraded element, so Phase 10 still delivered
  automation. The probe also corrected its own inputs — rustc floor ≥ 1.90, the
  true dual licence, and a Debian-release/glibc mismatch breaking naive
  multi-stage builds.
- **Phase 10 (9 plans).** The adoption boundary made structural, the bootstrap
  automated, and the removal earned: `--vice` guarded twice, a pure-Node
  `.regen2000proj` synthesiser, a cycle-guarded `.d64` reader that refuses to
  guess, the `vice-mcp r2000` subcommand, one `--verify`-parsing seam keyed on
  ACME's own result line, and `cmdDisasm`/`toacme` deleted behind a whole-tree
  grep gate.
- **Phase 11 (12 plans).** The store, the enums and the round trip: 17 curated
  tools over a hand-rolled NDJSON JSON-RPC client, `memmap.json`-generated
  bit-name enums verified byte-identical under real ACME, the store made
  canonical with the memory map a generated view, the playbooks rewritten to
  emit store entries rather than prose — and criterion 1 closed by a two-session
  sealed-question test whose hashes matched.
- **Phase 11.1 (7 plans, inserted after audit round 1).** Every audit finding
  fixed or formally dispositioned behind a guard proven non-vacuous. Its own
  completeness guard then found 27 undispositioned review findings across five
  phases against a pre-measured 8, and closed them all by fixing or filing.

**Verdict at close:** audit round 2 `passed`, zero open gaps against the audited
scope, 19 items deferred with a derived-and-guarded ledger. One honest asterisk,
recorded at the close rather than after it: the completeness guard 11.1-07 built
was **already red at `4f048bb`** — the commit whose subject reads "all findings
closed" — with Phase 09's three `Info`-severity `IN-*` findings undispositioned.
Neither audit round scanned Phase 9's review. The findings themselves are minor
and against non-shipping evidence harnesses, so the `passed` verdict stands; the
overstated commit subject and the unread guard do not.

</details>

<details>
<summary>Previous milestone detail — v0.2.0 phase-by-phase narrative (archived 2026-08-19)</summary>

**v0.2.0 Switchable stock-VICE backend — as it was tracked during execution:**

**Goal:** Drive stock upstream VICE through its binary monitor as a second,
selectable backend — so the plugin runs on a VICE anyone can install — while the
existing fork backend keeps working unchanged for the capabilities only it has.

**Target features:**
- Project-level backend selection (`VICE_BACKEND`), fork backend unchanged
- Binary-monitor protocol client behind the `call()` seam, with async event demux
- Direct tools (1:1 opcode) and reimplemented derived tools, incl. a 6502 disassembler
- Client-side screenshot encoding from the INDEXED8 framebuffer + palette
- Broker launch support for `-binarymonitor` alongside `-mcpserver`
- Per-backend capability annotation across the whole tool surface
- Stock-only gains: CPU-history tracing, 1541 drive-CPU debugging, raster-precise checkpoints / palette / full resources
- Version detection (VICE ≥ 3.10) with graceful degradation
- Empirical probe against a real build, and a two-process parity harness

**Current state:** v0.2.0's phase work is complete — **all 9 executed phases closed**, Phase 8.2
(inserted) being the last, on 2026-08-19. Phase 6 was cut wholesale, so 9 of 10 phase-list
entries is the terminal figure for this milestone.

Phase 8.1 first ran the one unwitnessed claim — the install-to-RAM-capture walkthrough — and
**recorded it as failed**, which was the honest outcome: it surfaced a confirmed product defect
rather than a documentation gap, and deliberately declined to apply the known fix to manufacture
a pass. Phase 8.2 then closed that defect and re-ran the walkthrough to a real pass:

- **I-2 (the blocker):** the broker launched stock `x64sc` with `Drive8Type=0` (NONE), so no drive
  answered unit 8 and `LOAD"*",8,1` returned `?DEVICE NOT PRESENT ERROR`. Fixed at one site —
  `buildViceArgs()`'s stock branch now emits `-default -drive8type 1541` ahead of
  `-binarymonitor`, with the fork branch's argv byte-identical to before. The blast radius was
  **measured, not inferred**, and proved wider than the audit had guessed: a bare `.prg`
  autostart hit the identical wall, so it was **all program loads**, not just disk loads.
- **I-1:** production stock launches now get a per-instance scratch `XDG_CONFIG_HOME` that
  reaches the real `nodeSpawn()` on every path — cold acquire, warm-floor spare and
  crash-respawn — so an emulator never reads the operator's real `vicerc`. Proven through the
  real spawn composition rather than an injected stub.
- **I-3:** the red test gate is green; CI's own bare `npm test` reports zero failures, so the
  tagging push cannot produce a red run.
- **DIST-03, the milestone's stated finish line:** `c64-ram-capture` reached a verified
  65536-byte capture on a provably broker-launched genuine stock `x64sc` (VICE 3.9), approved by
  a human at a blocking gate. Two limitations are recorded rather than glossed: the artifact was
  a local checkout, not a published release, and an agent-proxy drove it rather than a human
  witness.
- Coverage added where its absence had hidden the defect: `stock-broker-live.test.ts` is the first
  test to launch through the real broker primitive instead of hand-spawning its own argv.

**Known open, tracked, non-blocking:** the `vice_keyboard_type` `LOAD` fallback route does not
progress within a bounded poll (FINDING-E2) — promoted with a named owner by Phase 15's DEBT-01
disposition, so "tracked" now resolves to a specific entry: see `REQUIREMENTS.md`'s
`### Promoted by DEBT-01`. And the `acme-build` scaffold cannot build on any
machine provisioned the documented way because the Debian `acme` package ships no `cbm/c64/*.a`
standard library — CI's own environment included (FINDING-A1). Also untested by design: no
VIC-II revision / PAL-vs-NTSC / board-revision matrix, and only drive type `1541` was exercised
— the defect fixed was *no drive at all*, and other board and drive variants remain an open
question rather than a verified claim.

**Previously:** Phase 2 (Stock Backend Connection) complete — 2026-08-13.
The server can now be pointed at a stock VICE and hold a correlated,
event-demultiplexed conversation with it: `stock-protocol.ts` (framing, parsing,
request-id-first demux), `stock-connect.ts` (the one connect handshake),
`stock-dispatch.ts` + `tools-manifest.stock.json` (a trimmed, separately committed
stock surface per D-07), `backend-detect.mts` (backend resolved once, cached per
binary), and broker support for `-binarymonitor` launch plus broker-enforced
single-monitor-client ownership. The fork path is untouched — `tools-manifest.json`
is byte-identical to the phase-start commit. Verified 5/5 success criteria,
16/16 requirements.

Two things about this phase constrain how much it proved. **No stock VICE binary
exists in this environment** (user ruling, 2026-08-13) *(Superseded 2026-08-19, during
Phase 8.1: this ruling is now known wrong. A genuine unpatched stock binary is present at
`/usr/bin/x64sc` (VICE 3.9) — the fork build at `/usr/local/bin/x64sc` merely shadows it on
`$PATH`, which is why bare-`x64sc` probes resolve to the fork. Phase 8.1 plan 04 drove
`c64-ram-capture` against that genuine binary and confirmed its identity from the broker log
and live `ps` argv. The synthetic-fixture caveat below still stands; the no-binary caveat does
not.)*: every line is written
against the normative spec, the three VERIF-02 fixtures are synthetic and stamped
as such, locked decision D-19 was explicitly overridden
(`docs/phase2-backend-probe-evidence.md`), and the `--help` backend discriminator
is recorded as an OPEN question rather than an answered one. And a post-execution
code review found **7 critical defects that all ten plans' green test suites had
reported as passing** — including a connect handshake that halted the emulator
with a bare `PING` and never sent the `EXIT` that resumes it, and a reap whose
identity guard was vacuously true for an empty identity. All 20 Critical+Warning
findings were fixed (`02-REVIEW-FIX.md`); the lesson worth carrying is that a
green suite written by the same pass that wrote the code proves less than it
looks like it does. Three follow-ups are tracked in `.planning/todos/pending/`:
re-record the fixtures against hardware, confirm the discriminator against real
stock and fork binaries, and settle whether CI's bare `npm test` or the narrowed
`test:automated` gate is correct.

**Previously:** Phase 3 (Direct Tools) complete — 2026-08-16. Every tool with a
1:1 binary-monitor opcode now works on the stock backend: memory and registers,
checkpoints and watchpoints with a typed condition builder, pause/resume/step/
until-return, and machine control (reset, autostart, disk attach, keyboard,
joystick, snapshots, bank/register enumeration). 18 plans across 4 waves, plus 5
gap-closure plans answering `03-UAT.md`.

**Phase 2's central constraint no longer holds.** That phase was written entirely
against the spec because "no stock VICE binary exists in this environment" (user
ruling, 2026-08-13). It does exist: a genuine unpatched stock VICE 3.9 at
`/usr/bin/x64sc`, distinct from the fork build at `/usr/local/bin/x64sc` that
shadows it on `$PATH`. Phase 3 therefore validated against real hardware-equivalent
behaviour rather than against the spec alone, and that is what caught the phase's
blocker: `vice_registers_set` refused **every** register, because the catalog read
VICE's `REGISTERS_AVAILABLE` size byte as *bytes* when the wire reports *bits*.
Unit tests had missed it for exactly the reason Phase 2's post-mortem warned about
— the fixtures stubbed the same wrong assumption the code made. The fix renames the
field `sizeBits`, derives the range check from it, and pins it with a wire-shaped
fixture built from the real 3.9 enumeration. `stock-live.test.ts` now re-verifies it
against the real binary on demand, and skips cleanly where none exists.

Two further gap-closure results worth carrying: `npm test` could previously hang
forever on a bare host (a listener opened before its `try` leaked when a precondition
threw), which silently converted a *failure* into an *infinite wait* — now fixed with
an `after()` registry and env-gated skips. And CI had not run against any Phase 01/02/03
commit since 2026-08-11; it now has — run `31972421757` against sha `f040d79`, conclusion
**success**, via a PR branch deliberately chosen over pushing `main`, since a push to
`main` auto-publishes both npm packages and the milestone is only 3 of 8 phases done.

Verified 8/9 must-haves plus one accepted override: disk **detach** is not implemented
on stock and will not be — the binary monitor has no detach opcode, so it falls outside
this phase's "1:1 equivalent" goal by definition. It is no longer an orphaned deferral;
Phase 7 now formally owns it in both ROADMAP.md and REQUIREMENTS.md. Three items still
need a human at a real emulator, tracked in `03-HUMAN-UAT.md`. A code review of the
gap-closure diff returned 0 critical / 8 warning; the two most useful are that the stock
manifest still advertises flag-bit register names the handler always refuses, and that
the new leak-prevention net covers only 1 of 4 server factories.

**Previously:** Phase 4 (Client-Side Tool Seam and 6510 Disassembler) complete —
2026-08-17. DERIV-07's derived-tool seam exists as sibling modules (`stock-derived.ts`
plus `withDerivedTool()` in `stock-dispatch.ts`), intercepting client-side tools *before*
`forwardToVice()` runs `rewriteArguments()`, so a derived tool structurally cannot receive
a host-translated path. `vice_disassemble` is its first consumer and is live on the stock
backend. 7 plans across 6 waves; all 5 success criteria verified; 1321 tests green.

**The real-assembler gate is what made this phase honest.** The opcode table was
transcribed from cc65 and pinned by an independent `aaabbbcc` bit-pattern derivation test,
and it still shipped 14 wrong `acmeExpressible` entries — caught only when 04-06 ran the
renderer's output through a real ACME 0.97 and compared bytes. Bare `jam` assembles to
`$02` no matter which of the 12 JAM opcodes it decoded from, and `anc #imm` always to
`$0B`, so 11 JAM entries and `$2B` were over-substituting: they would have emitted a
mnemonic that silently re-assembles to a *different byte*. Seven further entries were
under-substituting — byte-faithful, but seeded `false`, so they emitted `!byte` where ACME
accepts the mnemonic. Net: 221 of 256 opcodes are assembler-expressible, verified
byte-exact in both directions. A test written from the same understanding as the code
cannot find this class of error; only the external tool can.

**Four of seven plans had their own plan text corrected during execution**, nearly always
the same defect: a test whose expected value was read from the same live source that built
its input, making the acceptance criterion permanently green. 04-03's suite 6 was the
first (asserting `entry.length` against a stream built from `entry.length`); it was fixed
by asserting against `LENGTH_FOR_MODE` and proven non-vacuous by corrupting `$00` and
watching it fail. Both gates this phase added were likewise verified by watching them
fail, not by inspection: removing `THIRD-PARTY-NOTICES.md` from `files[]` makes
`check-npm-packages.mjs` reject publication, and with ACME absent under CI's
`VICE_REQUIRE_ACME=1` the round-trip hard-fails instead of skipping.

Independently cross-checked outside this codebase: all 256 instruction lengths re-derived
from oxyron.de (a source separate from cc65) with **0 mismatches**; the illegal-`NOP` class
re-counted as exactly 27 opcodes across 6 addressing-mode groups, confirming the
planning-time correction to the ROADMAP's stale "twelve"; and `vice_disassemble` live-tested
against genuine unpatched stock VICE 3.9, output byte-identical to that emulator's own
text-monitor `d`. Criterion 5 holds empirically — all four dependency blocks are
byte-identical to the phase-start commit, so the disassembler added zero npm dependencies.

Carried forward: no Active requirement graduates yet — Phase 4 delivered only the
disassembler slice of "tools the fork implemented in-emulator are reimplemented
client-side"; backtrace, sprite decode and chip-state decode remain Phase 5. One code-review
Warning is open and worth closing *before* Phase 5 consumes the decoder: `decode()`'s
`startAddress` accepts any non-negative safe integer and silently wraps via `& 0xffff`,
harmless today only because `parseAddress()` bounds the single current call site, while the
decoder is explicitly the direct import surface for Phase 5's backtrace and Phase 6's
CPU-history decode. `04-HUMAN-UAT.md` tracks one deployment-observable item: CI has never
run this work, since all commits are local and `origin/main` is 298 behind. A separate
pre-existing tracking gap surfaced at completion: `UP-01`, `UP-02`, `QUAL-01..03` appear in
REQUIREMENTS.md's body but not its traceability table — it predates Phase 4 and belongs to
whichever phase owns those IDs.

**Current state:** Phase 5 (Skill-Critical Derived Tools) complete — 2026-08-17. All four
DERIV families the shipped skills call now work on the stock backend: memory search/compare
(DERIV-01), the symbol store and address resolution (DERIV-04), decoded VIC-II and CIA state
(DERIV-05 read side), and sprite read/inspect with ASCII rendering (DERIV-06 read side).
13 plans; all 5 success criteria verified; 1426 tests green, 0 fail.

**One defect class accounted for this entire phase's rework, and only the real emulator
found it.** All four chip and sprite reads hardcoded `bank: 0x0000` — the *CPU* view, which
follows `$00`/`$01` banking. With I/O banked out (`$01 = $34`) every tool returned
`isError:false` and plausible, fully-"available" values decoded from the RAM *underneath* the
I/O area: `borderColour:15`, `rasterLine:256`, CIA joystick `raw:255`. Nothing moved to
`unavailable`, because the defect arrived through the bank argument, not the field registry
that the phase had carefully built. Every unit suite was green. Verification failed criteria 3
and 4, and five gap-closure plans (05-09..05-13) closed it by resolving the emulator's *own*
`io`/`ram` bank ids through one new seam, `resolveRequiredBank()`, which refuses rather than
falling back when a build reports no such bank.

**The same anti-pattern then survived gap closure twice more, in smaller form.** A
post-closure review found `tod.tenths` still fabricating an impossible decimal (`tenths: 15`)
from a non-BCD nibble while its three siblings had been hardened — conforming to its own
schema, so an agent trained to trust `invalidBcd` would read it as measured. And
`vice_memory_banks` reported 5 banks where the wire enumerates 6, which mattered beyond its
own answer because the same map feeds `resolveRequiredBank()`'s refusal text: a refusal could
tell an agent that a working bank name did not exist. Both are fixed, with 7 of 16 findings
closed (`05-REVIEW-FIX.md`). The lesson is narrower and sharper than Phase 2's: a registry
that marks unavailable fields cannot defend against a wrong *address*, and only a live read
with I/O banked out distinguishes the two.

Live evidence is now first-class rather than incidental: `stock-live.test.ts` runs 10 cases
against genuine unpatched stock VICE 3.9 at `/usr/bin/x64sc`, including the `$01 = $34`
regression for both chip state and sprites. It stays out of `test:automated` (it is in
`test-gate.mjs`'s `MANUAL_ONLY_TESTS`), so it must be run deliberately — worth remembering,
since the automated suite cannot catch a break in it.

Carried forward as tracked debt, each judged against the five criteria and breaking none:
`WR-07` (the `mode:'snapshot'` refusal and two docs promise a time dimension `mode:'ranges'`
lacks — now quoted in a third place), `WR-08` (`truncated` set on an exact-boundary result,
with a dead `!truncated` conjunct), `WR-09` (`stock-sprites.ts` re-deriving constants
`stock-vicii.ts` exports), `WR-10` (a structurally unfailable derived-path test), `WR-11`
(dead code across the derived modules), and `IN-01..IN-04` — including `IN-04`, where
`sound-and-input.md` documents the joystick bits without mentioning the new `confounded`
field. Phase 4's open decoder bound (`decode()`'s `startAddress` silently wrapping via
`& 0xffff`) was not consumed by this phase and remains open for whichever phase adds
backtrace. The `UP-01`/`UP-02`/`QUAL-01..03` traceability note above is confirmed a false
positive of a body-vs-table scan: those IDs sit under "Future Requirements — deferred, not in
this roadmap", and the v0.2.0 traceability table is correct to omit them, as it is to omit the
proposed `R2000-*` v0.3.0 set.

**Previously:** Phase 8 (Capability Honesty and the Install Story) complete —
2026-08-18, and it is the milestone's last phase. `capability-registry.ts` is now
the single runtime-importable home for the 26-entry per-backend capability delta,
deliberately shaped like `vice.ts`'s `DENY_LIST` / `denyListRefusalMessage()` pair.
Four consumers read it and none holds a copy: `vice-proxy.ts`'s `tools/call` miss
branch (strictly after `DENY_LIST`), the generator behind `docs/tool-support.md`,
the skill-honesty lint, and `check-skill-tool-coverage.mjs` — whose literal
duplicate array this phase deleted, closing the **D-E** debt its own header comment
had asked for. `docs/tool-support.md` is this repository's first generated markdown
file: 63 rows derived from the two shipped manifests plus three mechanically
discovered synthetic tools, with **zero** hand-curated exclusions, guarded by the
same generate-into-scratch-then-byte-diff mechanism `resources-sync.test.ts` uses
for compiled resources. README gained the install story — per-ecosystem VICE
versions, the `VICE_BACKEND` choice and its consequences — and lost two false
claims, including an assertion that two guardrail test files existed when neither
was anywhere in the repository. Verified 4/4 success criteria, 5/5 requirements.

**The phase's own deliverables contained the failure class it exists to remove**,
and only executing the documentation caught it. Running the README's own install
instructions in a fresh `debian:trixie` container failed outright — Debian ships
`vice` in `contrib`, not `main` — a defect in a section written minutes earlier and
reviewed as correct. The post-execution code review then found two more: README
called `VICE_BACKEND` "one config value" in `.mcp.json` while `vice-proxy.ts`'s own
mismatch error says it "must be set for both" processes, and
`capabilityRefusalMessage()` rendered `entry.alternative` only in its `descoped`
branch — while all five entries carrying one are `hardware`, so the field was dead
at exactly the surface `BACK-05` exists for. The generated table, four skill files
and README all printed the stock route; the runtime refusal alone dropped it. Two
green test suites had passed over it because the hardware case tested
`vice_sid_get_state` and the descoped case `vice_memory_fill`, neither of which has
an alternative. All three are fixed and pinned. Thirteen review warnings were
consciously left; `WR-14` is the one to revisit — skill prose presents
`vice_joystick_set` as the stock route for a keyboard-matrix gate, where the
registry itself only hedges "covers most in-game input".

One item stays open by design: `08-HUMAN-UAT.md` records the plugin-install plus
`c64-ram-capture` walkthrough as `pending`, since its interactive half needs a live
session. The install half was executed live and is what caught the `contrib` defect.

Next: v0.2.0's phase work is complete — `/gsd-audit-milestone` then
`/gsd-complete-milestone`. *(Both were run: audit round 4 returned `tech_debt` with
no blockers, and the milestone was archived and tagged on 2026-08-19.)*

**Phase 11 complete — the annotation store is on the tool surface, and the symbol
loop is closed.** 2026-08-21. 12 plans, 7 waves, verification `passed` (4/4 roadmap
criteria, 5/5 requirement IDs). This project became an MCP *client* for the first
time (`r2000-mcp-client.ts`, a hand-rolled JSON-RPC client chosen after measuring
that `@mastra/mcp`'s `MCPClient` cannot retrieve a spawned child's exit code), and
exposes 17 curated `r2000_*` tools registered proxy-locally — so they never reach
`forwardToVice()` and the derived-tool path constraint holds by construction.

Two claims rest on evidence rather than tests, and both were verified independently:
criterion 1's **two-session falsifiability proof** (session B answered a question
whose sha256 answer session A sealed before B existed — the answer's label appears
nowhere in session A's transcript, and a near-miss decoy is visible there instead),
and criterion 4's **live loop** against genuine unpatched stock `x64sc` (VICE 3.9),
with the inbound name's absence proven at two independent points before discovery
and `vice_symbols_load` called exactly once on the fully regenerated file.

The Markdown memory map is now a generated view of the store rather than a
hand-maintained document, and the recon / memory-mapping / ram-capture playbooks
emit store entries instead of prose.

**Open and recorded, non-blocking:** `T-11-NAME-INJECT` — label names are not
validated on entry via `r2000_set_label_name` or `--import_lbl`. Code review
finding WR-04 widened its blast radius: the generated memory map writes label and
comment text unescaped into Markdown table cells, and comments may be multi-line.
Five warning-level review findings total in `11-REVIEW.md`; none critical.

**Bookkeeping note (written at Phase 11 close, resolved at the v0.3.0 close):**
Phase 10's requirements (`R2000-01`, `-02`, `-03`, `-05`, `-06`, `-09`) were
left in Active at the time — Phase 10 closed without graduating them and Phase
11 did not touch them, so they were not closed by a phase that had not
delivered them. All six were graduated to Validated at the v0.3.0 milestone
close, two with scope-honesty caveats recorded (`R2000-02`'s devcontainer and
two-projects halves; `R2000-03`'s licence, which the Phase 9 probe falsified as
written).

</details>

---

*Last updated: 2026-08-25 at the **start of milestone v0.6.0 — Own the
substrate**. v0.5.0's delivered scope moved from Active to Validated; Active was
replaced with v0.6.0's substrate scope; "Next Milestone Goals" became "Current
Milestone: v0.6.0" with a fourth phase (23, the real-release gate) added ahead of
the three decided at the v0.5.0 close; and the three rewritten cut phases —
`DECOMP-*`, `BUILD-*`, `EQUIV-*` — moved to a new "Next Milestone Goals" for
v0.7.0 rather than being scoped now against a store that does not exist yet.*
