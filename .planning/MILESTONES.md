# Milestones

## v0.4.0 Debt discharged, decisions settled (Shipped: 2026-08-23)

**Phases completed:** 6 phases (12, 13, 14, 15, 16, 17), 44 plans, 119 tasks
**Requirements:** 16/16 satisfied, zero cut, zero deferred
**Git range:** `8b1beee` → `c8afcb1` (292 commits since `v0.3.0`)
**Changed:** 482 files, +59,739 / −1,512 lines (290 files / +14,621 outside `.planning/`)
**Timeline:** 2 days (2026-08-21 → 2026-08-23)
**Final audit:** round 1, status `tech_debt` — 16/16 requirements, 6/6 phases, 12/12 integration, 4/4 flows, **zero blockers and zero open gaps**; what remains is bookkeeping debt and validation coverage
**Closeout type:** `override_closeout`
**Known verification overrides:** 16 newly acknowledged, 0 carried forward from a prior close (see STATE.md → Deferred Items)

**Delivered:** the project stops inheriting the same ledger. Every carried item
became a fix or a dated decision, the two questions this project had been
answering *by default* each milestone were answered deliberately, and the
instrument that makes all of it checkable was built first — and has been
observed refusing a write. The pending-todo tree reads genuinely empty for the
first time in this project's history: **19 inherited → 0**.

**Key accomplishments:**

- **An audit can no longer declare a clean status over a red guard — and the
  mechanism was watched refusing.** `scripts/audit-gate.mjs` is now the single
  answer to "would a milestone audit's declared status be allowed right now",
  wired as a real `Write|Edit|Bash` PreToolUse hook. Claude Code's own dispatch
  was observed refusing all four write routes — Write, Edit in two payload
  shapes, a Bash heredoc, and a subagent's Write — against a genuinely red
  `docs-linerefs.test.ts`, then allowing them again after a mechanically
  verified revert, with `gaps_found` passing through unobstructed throughout.
  The instrument was built first, then hardened against its own review: a live
  super-linear-regex denial of service and a single-line Bash-append bypass that
  plan 12-02 had *claimed* to close but did not.

- **External verification replaced the internal proxies, and the binaries
  contradicted us.** The three highest-value carried items — one failure mode
  this project has now been taught six times — were each run against real
  hardware rather than a fixture written by the same pass. `VERIF-02`'s three
  synthetic binmon fixtures are real captures; the `--help` backend
  discriminator is confirmed against genuine stock *and* fork `x64sc` with both
  transcripts committed; all four spec-driven Phase 3 wire details were
  live-probed. Two came back confirmed, one inconclusive, and one **refuted** —
  `vice_disk_attach`'s advertised no-side-effect promise is empirically false
  (it resets the machine and loads a program with the run flag clear), and was
  corrected at source rather than annotated.

- **Both default answers became dated decisions, each pinned by its own guard.**
  `FORK-01` decided **retain**: the forked backend stays the hedge, with the
  upstream `KEYBOARD_MATRIX_SET` coupling named as the reversal criterion and
  the caveats carried rather than resolved — and plan 14-03 exercised the fork's
  own `-mcpserver` HTTP transport live for the first time in this repository's
  history (6/6, `vice_sid_get_state` end to end), so the route the decision
  retains is proven followable. `CORE-01` decided **keep-dated** at a
  `gate="blocking-human"` checkpoint. Both are read out of the live file by
  `docs-fork-decision.test.ts` and `docs-core-value-decision.test.ts`.

- **The inherited ledger drained to zero, honestly.** Every one of the 19
  carried items is fixed, dispositioned `wont-fix` with recorded rationale, or
  explicitly promoted with a **named owner**. Widening
  `docs-review-disposition.test.ts`'s parser from level-3-colon-only headings to
  any level 2–6 id surfaced 150 findings where 119 had been visible, and all 9
  newly exposed ones were dispositioned back to green. Phase 03's last partial
  UAT scenario closed with a real experiment, not a re-reading: a non-stopping
  checkpoint armed on the KERNAL IRQ entry ($EA31) against genuine stock VICE
  3.9, with the D-11 rate-limit guard's auto-disable observed firing under a
  sustained ~21-hits/second flood and the emulator still progressing afterward.

- **The repo took its shipping shape.** The plugin payload moved out of Claude
  Code's auto-discovery path into `src/` in two atomic `git mv`s with roughly 30
  functional consumers repointed and the published tarball proven
  byte-identical; `installer/`'s `wireMcp()` — the one function in this repo
  that rewrites a file it does not own — went from never-tested to 18 cases
  driving the shipped `cli.mjs`; the three untested skill scripts got tests
  (`QUAL-01`); a new comment-scoped guard found and fixed **15** pre-existing
  orphaned phase pointers across nine shipped modules (`QUAL-02`); and the
  broker control-plane's `0.0.0.0` bind was recorded as a dated accepted risk
  with its residual exposure stated without softening (`QUAL-03`/`PKG-04`).

**What this milestone proved beyond its requirements.** Two of the closure
plans reversed their own stale premises after re-reading source — plan 15-04
found two findings it had been told were "superseded" still false, and plan
16-08's deferred entry was corrected mid-close when its predicted closure plan
turned out to be the wrong one. Both corrections were made rather than left
standing, which is the same documentation-consistency discipline the milestone
was built to install.

**Regression evidence at close:** `npm test` in `src/mcp/vice` — 2395 tests /
2351 pass / **0 fail** / 39 skipped / 5 todo / 24 suites (the full glob, not
`test:automated`, which skips `MANUAL_ONLY_TESTS`).
`node scripts/audit-gate.mjs --json` → `allowed:true`, `redGuards:[]`, 6/6
guards discovered. `node scripts/check-npm-packages.mjs` → OK, 0 leaks.

---

## v0.3.0 regenerator2000 static-analysis backend (Shipped: 2026-08-21)

**Phases completed:** 4 phases (9, 10, 11, inserted 11.1), 36 plans, 101 tasks
**Requirements:** 12/12 in-scope satisfied (4 of the original 16 cut or folded 2026-08-17)
**Git range:** `4867535` → `4f048bb` (268 commits since `v0.2.0`)
**Changed:** 244 files, +121,291 / −416 lines (72 files / +18,316 outside `.planning/`)
**Timeline:** 3 days (2026-08-19 → 2026-08-21)
**Final audit:** round 2, status `passed` — 12/12 requirements, 4/4 phases, 12/12 integration, 4/4 flows, zero open gaps
**Known deferred items at close:** 19 (18 pending todos + Phase 03's UAT gap; see STATE.md → Deferred Items)

**Delivered:** recon findings stop being prose. regenerator2000 is adopted as a
static-analysis backend — a persistent, queryable annotation store plus a
recursive-descent disassembler with an auto-analyzer — reached through 17 curated
`r2000_*` tools and a `vice-mcp r2000 <verb>` CLI, entirely container-side, and
structurally incapable of touching VICE. Register writes read as bit names,
symbols flow both ways between the store and a live emulator, and the flat
linear `toacme` decoder it makes obsolete is deleted.

**Key accomplishments:**

- **Probed the five load-bearing assumptions before building on them, then
  honoured the answer.** A standalone go/no-go phase tested a real
  regenerator2000 0.9.20 against seven criteria and recorded a verdict of
  **`degrade`** (rule `R4`) when criterion 3(4) — `.vsf` machine-type
  derivation — proved to be a coincidental default fallback rather than a
  genuine read of the snapshot's own `"C64SC"` field. The milestone shipped
  smaller than proposed because the gate was real: the input set narrowed to
  `.prg` / `.d64` / flat-64K (D-34). Along the way the probe corrected its own
  research — rustc floor `>= 1.90` not 1.85, the true dual `MIT OR Apache-2.0`
  licence, and a Debian-release/glibc mismatch that breaks a naive multi-stage
  container build.

- **Made "regenerator2000 never touches VICE" a property of the code, twice
  over.** `r2000-launch.ts` is the sole spawn seam: `--vice` is unreachable by
  fixed per-verb argv builders *and* denied by a scan that throws
  `R2000ViceFlagError`, both pinned by tests proven to fail under live
  reintroduction. The whole `r2000_*` family registers proxy-locally through
  `buildViceTool()` and never reaches `forwardToVice()`, so CLAUDE.md's
  derived-tool path-translation constraint is satisfied by construction rather
  than by an interception — and the family behaves identically on the fork and
  stock backends.

- **Turned a raw binary into an analysed project with no human in the loop.** A
  pure-Node `.regen2000proj` synthesiser (gzip + base64 + minimal JSON) that a
  real regenerator2000 loads and exports ACME from, with the
  `use_illegal_opcodes`/`system` pair forced explicitly — the keystroke
  bootstrap Phase 9 proved automatable defaults it to `false`, under which an
  export proves nothing about 6510 illegal opcodes. Plus a container-side
  `.d64` reader with a cycle-guarded sector-chain walk that refuses to guess,
  a `vice-mcp r2000 <verb>` subcommand reaching its CLI before any MCP server
  side effect runs, and one seam parsing `--verify`'s output that keys strictly
  on ACME's own result line — proven in both directions on real transcripts,
  including an exit-1 run where ACME still passed and an exit-0 run where ACME
  never ran.

- **Built the annotation store and proved it holds knowledge, by sealed
  question.** 17 curated `r2000_*` tools over a hand-rolled newline-delimited
  JSON-RPC client (chosen over `@mastra/mcp`'s `MCPClient` by a five-property
  live measurement, yielding six distinct named failure modes). Its usefulness
  was then tested falsifiably rather than asserted: session A annotated a
  purpose-made fixture and sealed a question with a hashed answer key; a
  genuinely separate session B answered it from tool calls alone, and the
  canonical line hashed identically — `e64463d8…`.

- **Closed the symbol round trip live, and made register writes readable.**
  `sta $d011` now renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` in real
  ACME-exported source, from a digest-pinned bit-name table generated
  re-runnably from `memmap.json`. A 23-step transcript against genuine
  unpatched stock `x64sc` (VICE 3.9) closes `R2000-14`/`R2000-15` end to end: a
  store-written label resolves live, and a name discovered by disassembling the
  running program — never read off source — is written back into the store. The
  store became canonical and the Markdown memory map a generated view with a
  render-digest drift guard.

- **Deleted the thing this milestone earned the right to remove.** The 14-line
  `toacme` wrapper (`cmdDisasm`), its dispatch entry, its usage line, and ~50
  lines of `SKILL.md` caveats structural to a flat linear decoder are gone; both
  playbooks point at the single live-verified `r2000 export-asm`/`verify` route,
  and a whole-tree grep gate proven to bite on a non-`SKILL.md` file keeps it
  gone.

- **Closed every audit finding behind a guard, and the guard found more than the
  audit did.** Inserted Phase 11.1 fixed or formally dispositioned all of
  `AUDIT-01`..`AUDIT-05`, `FLOW-01`, `FLOW-02`, `INT-01`, `INT-02` plus Phase
  10/11's outstanding review findings — each behind a mechanical guard proven
  non-vacuous by a planted violation or a real reverted edit. Plan 11.1-07's
  new completeness guard, on its first run, found **27** undispositioned
  code-review findings across five phases against the plan's own pre-measured
  8, and closed them all by fixing or filing. Both `SECURITY.md` ledgers now
  read `threats_open: 0` / `status: verified`.

**Archived:**

- [`milestones/v0.3.0-ROADMAP.md`](milestones/v0.3.0-ROADMAP.md)
- [`milestones/v0.3.0-REQUIREMENTS.md`](milestones/v0.3.0-REQUIREMENTS.md)
- [`milestones/v0.3.0-MILESTONE-AUDIT.md`](milestones/v0.3.0-MILESTONE-AUDIT.md) (round 2, plus round 1 verbatim)

---

## v0.2.0 Switchable stock-VICE backend (Shipped: 2026-08-19)

**Phases completed:** 9 phases, 87 plans, 218 tasks
**Requirements:** 51/51 in-scope satisfied (17 cut wholesale 2026-08-17)
**Git range:** `669a7ce` → `HEAD` (696 commits since `v0.1.10`)
**Changed:** 448 files, +133,229 / −736 lines (151 files / +53,857 outside `.planning/`)
**Timeline:** 8 days (2026-08-11 → 2026-08-19)
**Final audit:** round 4, status `tech_debt` — no blockers, Nyquist fully compliant
**Known deferred items at close:** 13 (see STATE.md → Deferred Items)

**Delivered:** the plugin's tool surface no longer requires a custom, non-upstream
VICE fork. A second, project-selectable backend drives stock upstream VICE through
its binary monitor, and the two backends are honest with the user about the three
capabilities stock provably cannot have.

**Key accomplishments:**

- **Corrected the protocol ground truth before building on it.** Fixed four verified
  factual errors and a 3-to-5 unsolicited-event undercount across the normative
  documents, then extended the binary-monitor probe from 6 to 13 checks and ran it
  against both a genuine stock VICE 3.9 and the fork's 3.10 — resolving all five
  UNVERIFIED items with recorded evidence rather than inference.

- **Built a correctly-demultiplexed stock backend connection.** Request-id-first
  demux with a duplicate-reply ring and socket-lifecycle rejection distinguishable
  from timeout, so the five unsolicited event types (two of which share a response
  type with a legitimate command reply) can never resolve a pending request. Backed
  by broker-enforced `monitor_claim`/`monitor_release`, which refuses a conflicting
  claim *by name* before a second binmon `connect()` — the one that would otherwise
  be indistinguishable from a wedge — is ever attempted.

- **Ported every 1:1 tool and built the ten the skills need that stock lacks.**
  38 tools now ship on the stock manifest against the fork's 62: memory, registers,
  checkpoints, execution and machine control direct on the wire; plus a client-side
  6510 disassembler whose output reassembles through a real ACME 0.97 to exactly the
  original bytes across all 256 opcodes, memory search/compare, a symbol store, and
  VIC-II/CIA/sprite state decoders that report six internal-only fields as
  `{available:false, reason}` instead of a plausible-looking zero.

- **Made unavailable capabilities fail honestly instead of silently wrong.** A
  26-entry capability registry, wired strictly after `DENY_LIST`, answers a call to
  an unadvertised tool by naming the capability, the reason, and which backend
  provides it. The three proven-unrecoverable tools (`vice_sid_get_state`,
  `vice_keyboard_matrix`, `vice_keyboard_restore`) are named at their point of use in
  the playbooks, and `docs/tool-support.md` is generated from both manifests with a
  byte-identity drift guard rather than maintained by hand.

- **Cut 17 requirements against a single measured test**, not a judgment call: does a
  shipped skill call this tool, or does something a skill calls depend on it?
  Measured by diffing the six skills' actual `vice_*` usage against both manifests.
  Phase 6 was removed wholesale. Each cut names its requirements, which stay in the
  archive marked `CUT` with rationale.

- **Proved the finish line end-to-end, after it failed once.** Phase 8.1 ran the
  install-to-RAM-capture walkthrough that had only ever been claimed — and it
  falsified the claim, exposing a real defect (stock `x64sc` boots with
  `Drive8Type=0`, unfixable by any MCP tool). Phase 8.2 fixed the launch argv, and
  the re-run reached a verified 65536-byte capture against a broker-launched genuine
  `/usr/bin/x64sc`.

**Archived:**

- [`milestones/v0.2.0-ROADMAP.md`](milestones/v0.2.0-ROADMAP.md)
- [`milestones/v0.2.0-REQUIREMENTS.md`](milestones/v0.2.0-REQUIREMENTS.md)
- [`milestones/v0.2.0-MILESTONE-AUDIT.md`](milestones/v0.2.0-MILESTONE-AUDIT.md) (round 4, plus rounds 1-3 verbatim)

---
