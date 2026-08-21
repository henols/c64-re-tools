---
phase: 11
slug: annotation-store-enums-and-the-symbol-round-trip
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-20
audited: 2026-08-21
audit_gaps_found: 2
audit_gaps_resolved: 2
audit_gaps_escalated: 0
revalidated: 2026-08-21
revalidation_trigger: phase-11.1-drift
revalidation_gaps_found: 0
revalidation_gaps_resolved: 0
revalidation_gaps_escalated: 0
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `11-RESEARCH.md` § Validation Architecture. Every row below
> traces to a measured claim in that document.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `.claude/mcp/vice/package.json` declares `"test": "node --test '*.test.*'"` |
| **Quick run command** | `cd .claude/mcp/vice && node --test <module>.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm test` |
| **Estimated runtime** | ~30 s without a real r2000 child; longer when `VICE_REQUIRE_R2000=1` forces live legs |

**Availability gate (inherited, not invented).** Live-r2000 tests follow
`disasm-roundtrip.test.ts`'s established pattern: a module-scope `SKIP_REASON`,
exactly one never-skipped availability test, and `VICE_REQUIRE_R2000=1` turning
absence of the real binary into a hard FAIL rather than a silent skip. D-11
already applied this to regenerator2000; this phase inherits it.

**CI blind spot to design around.** `ci.yml` runs `npm test` only inside
`.claude/mcp/vice`. **No skill-side `*.test.mjs` runs in CI at all.** Any
deliverable that must be guarded by CI therefore has to live on the MCP side,
not under `.claude/skills/`.

---

## Sampling Rate

- **After every task commit:** Run the module's own `node --test <module>.test.ts`.
  Do **not** force `VICE_REQUIRE_R2000` locally — absence of the real binary
  SKIPS by the `SKIP_REASON` convention, and only an explicit
  `VICE_REQUIRE_R2000=1` export turns absence into a failure.
- **After every plan wave:** Run `cd .claude/mcp/vice && npm test` (full suite).
- **Before `/gsd-verify-work`:** Full suite green, **plus** both human-witnessed
  artifacts committed under the phase's `evidence/` directory (see
  Manual-Only Verifications).
- **Max feedback latency:** ~30 s for the quick run; ~2 min for the full suite
  with live legs enabled.

### The sampling-rate problem, named explicitly

Criterion 1's real claim — *"a **later** session answers a question by querying
the store"* — is a claim about **session boundaries and prose-blindness**, not
about the query API returning correct rows. A single-process `node --test` run
cannot sample "a different session, with no access to the first session's prose"
at all. It can only sample "does `get_symbols` / `search_disassembly` return
correct data" — necessary, but **not sufficient** evidence for the criterion.

This is why D-26 requires a recorded two-session transcript as a *separate
evidence class* from the automated fixture test (mirroring D-31's split for
criterion 4). The automated test guards the query layer from regressing —
closing Phase 10's **WR-02**-shaped "vacuous construction test" risk — while the
transcript is the only artifact that samples the criterion's actual claim.

---

## Per-Task Verification Map

Expanded by the planner on 2026-08-20 into per-task rows: **12 plans, 35 tasks, 7 waves.**
Every task in the plan set appears here, and every row traces to one of this document's original
requirement-level rows or adds one with its reason recorded in the owning plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 11-01-T1 | 11-01 | 1 | R2000-10 (folded todo 2, WR-02) | T-11-VACUOUS | D-07's `--vice` deny-by-construction guard is non-vacuous | unit + planted violation | `node --test r2000-launch.test.ts` | ✅ |
| 11-01-T2 | 11-01 | 1 | R2000-13 (folded todo 2, WR-04) | T-11-FALSESUCCESS-ACME | An ACME transcript containing a failure never reports a pass | unit, pinned fixtures | `node --test r2000-verify.test.ts` | ✅ |
| 11-01-T3 | 11-01 | 1 | R2000-10 | T-11-GATE-DRIFT | One D-11 availability gate; its hard-FAIL mode observed failing | unit + env-driven demo | `node --test r2000-verify.test.ts` | ✅ |
| 11-02-T1 | 11-02 | 1 | R2000-10 (WR-05/06) | T-11-D64-TRUNC, T-11-D64-NAME | A truncated `.d64` throws; a printed name is a selectable name | unit, synthetic images | `node --test r2000-d64.test.ts` | ✅ |
| 11-02-T2 | 11-02 | 1 | R2000-10 (WR-07) | T-11-RAW-GUESS | A wrong-size flat capture is refused, not reinterpreted | unit, real files | `node --test r2000-cli.test.ts` | ✅ |
| 11-02-T3 | 11-02 | 1 | R2000-10 (folded todo 1, WR-03) | T-11-HONESTY-BYPASS, T-11-PKG-CLOSURE | Dynamically-imported modules cannot fall out of `files[]`; the honesty exemption is scoped and bounded | CI scripts + planted violations | `node scripts/check-npm-packages.mjs` | ✅ |
| 11-03-T1 | 11-03 | 1 | R2000-13 (D-34) | T-11-DOC-DANGLE | No document points at Phase 11 as `.vsf`'s home | **was** doc assertion (one-file grep) → **now** unit + planted violation | `node --test docs-dangling-refs.test.ts` | ✅ (**audit-repaired** — see Audit 2026-08-21) |
| 11-03-T2 | 11-03 | 1 | R2000-14 (D-35), R2000-13 (D-22) | T-11-DOC-OVERCLAIM | The `--export_lbl` claim is verified and scoped to 0.9.20 + this fixture | doc assertion + existing suite | `cd .claude/mcp/vice && npm run test:automated` | ✅ |
| 11-03-T3 | 11-03 | 1 | R2000-10, R2000-14 | T-11-DOC-DRIFT | CLAUDE.md's cited line numbers match the source | unit + planted violation | `node --test docs-linerefs.test.ts` | ✅ |
| 11-04-T1 | 11-04 | 2 | R2000-14, R2000-15 (D-28) | T-11-VICE, T-11-PATH-XLATE | `--import_lbl` cannot be built without `--mcp-server-stdio`; no r2000 module imports `hostpath.ts` | unit, exact-argv | `node --test r2000-launch.test.ts hostpath-consumers.test.ts` | ✅ |
| 11-04-T2 | 11-04 | 2 | R2000-10 | T-11-HANG, T-11-PHANTOM-DEP | Five named client failure modes measured; no direct SDK import | integration vs stub servers | `node --test r2000-mcp-client.test.ts` | ✅ |
| 11-04-T3 | 11-04 | 2 | R2000-10, R2000-14, R2000-15 | T-11-FALSESUCCESS, T-11-DEMUX | A save is never reported without an independent re-read; responses correlate on `id` | stubs + live real child, gated | `VICE_REQUIRE_R2000=1 node --test r2000-mcp-client.test.ts` | ✅ |
| 11-05-T1 | 11-05 | 3 | R2000-10, R2000-11 | T-11-BATCH, T-11-UNCURATED, T-11-PATH-ESCAPE, T-11-D32 | The curated gate refuses any name outside the D-18 set, including nested batch names, before any spawn | unit + integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ✅ |
| 11-05-T2 | 11-05 | 3 | R2000-10 | T-11-PATH-XLATE | No `r2000_*` runner reaches `forwardToVice()`/`rewriteArguments()`; family in neither manifest | structural + proxy handshake | `node --test stock-dispatch.test.ts vice-proxy.test.ts` | ✅ (structural half in CI; handshake half manual — see audit note) |
| 11-05-T3 | 11-05 | 3 | R2000-10 | T-11-PROSE | An `r2000_*` name in skill prose must exist and be curated | CI script + planted violation | `node scripts/check-skill-tool-coverage.mjs` | ✅ |
| 11-06-T1 | 11-06 | 4 | R2000-13 (D-22) | T-11-REGBITS-PROSE, T-11-GEN-DRIFT | Generated identifiers are legal ACME; the table is digest-pinned to `memmap.json` | unit + drift guard | `node --test r2000-regbits.test.ts` | ✅ |
| 11-06-T2 | 11-06 | 4 | R2000-13 (D-20, D-23) | T-11-ENUM-NAME, T-11-SILENT-CAP, T-11-MISBIND, T-11-GLOBAL-WRITE | No unsanitized identifier reaches `create_project_enum`; coverage reported, never implied | unit + property + zero-spawn refusal | `node --test r2000-enum-gen.test.ts` | ✅ |
| 11-06-T3 | 11-06 | 4 | R2000-13 (criterion 3) | T-11-ENUM-NAME | `lda #$1b`/`sta $d011` renders semantically in the ACME export and reassembles | integration (live r2000 + real ACME), gated | `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts r2000-cli.test.ts` | ✅ |
| 11-07-T1 | 11-07 | 4 | R2000-10 | — | The recon subject is reproducible from source | external oracle (real ACME byte-compare), now **mechanized + CI-gated** | `VICE_REQUIRE_ACME=1 node --test r2000-answer-key.test.ts` | ✅ (**audit-mechanized** — see Audit 2026-08-21) |
| 11-07-T2 | 11-07 | 4 | R2000-10 (criterion 1, session A) | T-11-LEAK | Findings persist and re-read in a fresh session | integration (live r2000) + committed artifact | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ✅ |
| 11-07-T3 | 11-07 | 4 | R2000-10 (criterion 1, the question) | T-11-GUESSABLE, T-11-SEAL-DRIFT | The answer key cannot drift from the answer it seals | unit (seal recomputation) | `node --test r2000-answer-key.test.ts` | ✅ |
| 11-08-T1 | 11-08 | 5 | R2000-14, R2000-15 | T-11-LBL-PARSER-DUP, T-11-MERGE-DIVERGE | No third `al C:` parser; `vice_symbols_load` stays replace-not-merge | typecheck + source assertions | `npx tsc --noEmit -p tsconfig.json` | ✅ |
| 11-08-T2 | 11-08 | 5 | R2000-15 (criterion 4, mechanism) | T-11-IMPORT-DISCARD, T-11-LBL-SIZE | `--import_lbl` is never reported as success without a post-save read-back; the discard trap is pinned | integration (live r2000), gated | `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts` | ✅ |
| 11-08-T3 | 11-08 | 5 | R2000-14, R2000-15 | T-11-LBL-SIZE | The label-file ceilings survive the CLI route | CLI integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` | ✅ |
| 11-09-T1 | 11-09 | 5 | R2000-10, R2000-11 (criterion 1, session B) | T-11-CONTEXT-BLEED | A prose-blind session answers from the store alone | human-witnessed transcript (recorded artifact) | `grep -q "canonical answer" SESSION-B-ANSWER.md` | ✅ |
| 11-09-T2 | 11-09 | 5 | R2000-10 | T-11-RETROFIT, T-11-VACUOUS-CHECK | A mismatch is reported, never repaired; a missing answer FAILS rather than skips | unit (seal comparison) | `node --test r2000-answer-key.test.ts` | ✅ |
| 11-10-T1 | 11-10 | 6 | R2000-10 (D-25) | T-11-GRADE-TYPO, T-11-SECOND-STORE | A typo'd grade prefix fails instead of degrading to ungraded | unit, must-fail-on-typo | `node --test r2000-confidence.test.ts` | ✅ |
| 11-10-T2 | 11-10 | 6 | R2000-10 (D-24, D-27) | T-11-GEN-EDIT, T-11-PLACEHOLDER, T-11-SKILLPATH | The memory map is generated; a hand edit or a store change is detected; no placeholder is emitted | golden output + drift guard, gated | `VICE_REQUIRE_R2000=1 node --test r2000-memmap-render.test.ts` | ✅ |
| 11-10-T3 | 11-10 | 6 | R2000-10 | T-11-GEN-EDIT | `render-memmap --check` exits non-zero on drift | CLI integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` | ✅ |
| 11-11-T1 | 11-11 | 6 | R2000-14 (criterion 4, outbound) | T-11-FLAG-ORDER, T-11-SINGLE-CLIENT | A store label resolves a live address on genuine stock; `-default` precedes `-binarymonitor` | live stock `x64sc` walkthrough | `grep -q "al C:" outbound.lbl` | ✅ |
| 11-11-T2 | 11-11 | 6 | R2000-15 (criterion 4, the loop) | T-11-TWO-DUMPS, T-11-NAME-INJECT | The inbound name is proven absent before the live discovery | live walkthrough + human-check | `grep -q "absent before" WALKTHROUGH.md` | ✅ |
| 11-11-T3 | 11-11 | 6 | R2000-14, R2000-15 (BACK-02 standing gate) | T-11-OVERCLAIM | The fork is verified unregressed; no gate is claimed without quoted output | regression gate + packaging validation | `npm run test:automated && npm run typecheck && npm run smoke && node scripts/check-npm-packages.mjs` | ✅ |
| 11-12-T1 | 11-12 | 7 | R2000-10, R2000-11 | T-11-PROSE-FAKE-TOOL, T-11-TEMPLATE-HANDFILL | Every `r2000_*` name in prose exists and is curated; the template offers nothing to hand-fill | CI prose gates + doc assertions | `node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs` | ✅ |
| 11-12-T2 | 11-12 | 7 | R2000-13 | T-11-PROSE-OVERCLAIM | The memmap coverage gap is stated, not glossed | CI prose gate | `node scripts/check-skill-fork-honesty.mjs` | ✅ |
| 11-12-T3 | 11-12 | 7 | R2000-10 | T-11-PROSE-FAKE-TOOL, T-11-STALE-TARBALL | The reference floor can fail; the installer's generated copy carries the edits | CI script + planted violation + packaging | `node scripts/check-skill-tool-coverage.mjs && node scripts/check-npm-packages.mjs` | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** 35 tasks, 35 `<automated>` verifies — every task in the plan set has one,
so the "no 3 consecutive tasks without an automated verify" rule holds by construction.

**Two rows are human-witnessed artifacts, as this document requires:** `11-09-T1` (criterion 1's
two-session transcript, whose only mechanical half is the sealed-hash comparison in `11-09-T2`) and
`11-11-T2` (criterion 4's real-program walkthrough, which also carries a `<human-check>` for the
"one loop, not two dumps" judgement). Both produce committed files under the phase's `evidence/`
directory.

---

## Wave 0 Requirements

**Reconciliation with the plan set (planner, 2026-08-20).** There is no separate wave-0 plan whose
only output is empty test stubs — a file full of trivially-passing stubs is the vacuity this
document's own WR-02 section warns about. Instead, wave 1 lands the *known-vacuous* guard fixes and
the one shared seam, and each implementation plan creates its own test file as the file it must
satisfy in the same plan. The original checklist maps as follows:

- [x] Fix WR-02's `stripCommentLines()` **first**, so the D-07 guard assertions are non-vacuous
      before anything is built on top of them — **plan 11-01 (wave 1), before plan 11-04's new argv
      builders (wave 2)**, which is the ordering constraint this document made a prerequisite.
- [x] The shared D-11 availability gate, `r2000-test-gate.ts` — **plan 11-01 (wave 1)**; the four new
      test files import it instead of hand-copying `probeR2000()` a sixth time.
- [x] `.claude/mcp/vice/r2000-tools.test.ts` (R2000-10, R2000-11) — **plan 11-05, task 1**.
- [x] `.claude/mcp/vice/r2000-mcp-client.test.ts` (the MCP-client seam, all five named failure modes:
      spawn failure, mid-call child exit, unanswered `tools/call`, stderr interleaving, non-zero exit
      after a successful save) — **plan 11-04, task 2**, where it is written before the
      implementation because its measurements decide which client shape gets built.
- [x] `.claude/mcp/vice/r2000-enum-gen.test.ts` (R2000-13) — **plan 11-06, tasks 2-3**, plus
      `r2000-regbits.test.ts` as the generated-artifact drift guard (task 1).
- [x] `.claude/mcp/vice/r2000-symbol-roundtrip.test.ts` (R2000-15) — **plan 11-08, task 2**.
- [x] Extend `.claude/mcp/vice/r2000-launch.test.ts` for the new argv builders (R2000-14) — **plan
      11-04, task 1**, after plan 11-01's WR-02 fix.
- [x] Phase `evidence/` directory for the two human-witnessed artifacts — created by the plans that
      write into it: `evidence/criterion1/` (plans 11-07, 11-09) and `evidence/criterion4/`
      (plan 11-11).
- [x] No framework install needed — `node --test` is already the runner. New `*.test.ts` files join
      `test-gate.mjs`'s **derived** automated set automatically (it lists only the manual-only
      exceptions), so no gate file needs editing and `test-gate.test.ts`'s drift guard stays green.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A **later** session answers a question purely from `r2000_*` store queries, with no access to the first session's prose | R2000-10 (criterion 1) | The claim is about a session boundary. A single-process `node --test` run cannot sample "a different session, prose-blind" at all — it can only sample that the query API returns correct rows. | Structure as **two separate plans in different waves**. Wave N commits the analysed `.regen2000proj` plus a written-down QUESTION (not the answer). Wave N+1 runs as a genuinely separate execution context given **only** the committed project file and the committed question, explicitly barred from reading Wave N's PLAN.md prose or transcript. Its output — the answer plus the exact `r2000_*` calls that derived it — is the artifact. **Do NOT implement this as a nested headless `claude -p` invocation**: this project has a documented, repeated failure mode of executor agents stalling on nested headless sessions. |
| The closed symbol loop on one **real** program (store → `--export_lbl` → `vice_symbols_load` → name discovered live → `--import_lbl` + `--mcp-server-stdio` + `r2000_save_project` → store) | R2000-15 (criterion 4) | The live half needs genuine unpatched stock `x64sc` and a real program, neither of which is committable. The committed-fixture test (D-31) guards the mechanism; it cannot witness "one closed loop, not two one-way dumps." | Run against `/usr/bin/x64sc` (genuine stock — the fork shadows it on `PATH`). **`-default` must precede `-binarymonitor`** or the monitor never binds. Record the loop as a single ordered transcript in which the name that returns to the store is demonstrably the one discovered against the running machine, not one that was already there. |

**Falsifiability rule for both artifacts (guards against a WR-02-shaped vacuous
result).** The committed question for criterion 1 must be answerable **only**
from the store: not from reading the `.prg`/`.a` source, and not guessable from
the program's name or from a comment in the plan file. Test it by asking whether
an agent that has never seen the program could answer correctly by guessing — if
yes, tighten the question. Likewise, criterion 4's transcript must show the
inbound name was **absent** from the store before the live discovery.

---

## Known-Vacuous Test to Fix Before Building On It

**WR-02** — `r2000-launch.test.ts`'s `stripCommentLines()` fails to close a block
comment whose closing line carries trailing code after `*/`, silently hiding
everything after it. The reviewer ran the helper against a synthetic source with
a rest-param pass-through and **all three D-07 guard assertions still passed.**

D-16 makes `r2000-launch.ts` the only sanctioned spawn path, which is exactly
what makes D-07's `--vice` guard load-bearing for this phase. Fixing WR-02 is a
**prerequisite**, not cleanup: every new argv builder this phase adds is
protected by a guard whose test can currently go blind.

---

## Validation Audit 2026-08-21

Every one of the 35 rows' declared automated commands was executed on this host. Real
`regenerator2000 0.9.20` and real ACME 0.97 "Zem" are both present, so **no gated leg skipped
silently** — the live halves genuinely ran.

| Metric | Count |
|--------|-------|
| Rows audited | 35 |
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Rows green as declared | 33 |

**Full suite:** `VICE_REQUIRE_ACME=1 npm run test:automated` → 1954 tests, **1949 pass, 0 fail,
0 skipped, 5 todo**. The 5 todos are `vice-sync.ts`'s `readCheckpoint()`/`waitCheckpointHit()`/
`runToCheckpoint()`/`reset()`/`screenshot()` — pre-existing, and deliberately never unit-tested
per CLAUDE.md's own Testing constraint ("their correctness only means anything against a real
emulator's timing"). Not Phase 11 gaps.

**Other gates re-run green:** `npx tsc --noEmit` · `npm run smoke` (78 tools advertised) ·
`node scripts/check-npm-packages.mjs` (73 / 35 files, 6 skills — unchanged, so the new test file
is correctly absent from `files[]`) · `check-skill-tool-coverage.mjs` · `check-skill-fork-honesty.mjs`
· `test-gate.test.ts`'s own drift guard.

### Gap 1 — 11-03-T1 / T-11-DOC-DANGLE: the dangling `.vsf` pointer was never fully closed

**The row's own verification was the reason.** Its declared automated command was
`grep -c vsf .planning/ROADMAP.md` cross-checked by hand against a mention count — scoped to
**one file**, for a defect class that spanned **six sites in four files**. Plan 11-03's commit
`4c5ffef` corrected four of them (ROADMAP.md ×3, `10-CONTEXT.md` ×1) and its SUMMARY claimed
the class closed. Two survived in `.planning/REQUIREMENTS.md`:

- `:66` — `R2000-09`'s own requirement text: "`.vsf` is dropped from this requirement's input
  set and deferred to **Phase 11's `c64-ram-capture` extension**".
- `:140` — the `R2000-08` fold entry: "`.vsf` **moves to Phase 11's `c64-ram-capture`
  extension**".

Both survived plan 11-03, phase completion (`7bc4b19`), goal-backward verification (`214fa54`,
which scored the phase 4/4) and a full security audit. A one-file grep could not have caught
them, and no human re-reading did.

Worth recording *how* the second one was found: a line-based `grep -i vsf | grep -i "phase 11"`
found `:140` but **missed `:66`**, because that sentence's two halves straddle a line break.
The new guard found it on its first run — it joins wrapped lines before splitting sentences,
which is exactly why it is a scanner and not a grep.

**Resolution:**

1. Both sentences rewritten to state `.vsf` has **no** later phase as its home, pointing at the
   backlog item (`.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md`) instead of a
   phase — matching ROADMAP.md's already-corrected wording.
2. The one-file grep replaced with `.claude/mcp/vice/docs-dangling-refs.test.ts`, a **repo-wide,
   CI-running** guard (4 tests). It scans the six normative forward-looking documents
   (`ROADMAP.md`, `REQUIREMENTS.md`, `CLAUDE.md`, `README.md`, `docs/roadmap-stock-vice.md`,
   `docs/stock-vice-parity.md`) for any sentence that both mentions `.vsf` and hands a topic to a
   numbered phase. Deliberately **not** scoped to `.planning/phases/**` — those are historical
   records that legitimately quote the wrong wording while describing its removal, and a guard
   with false positives gets switched off. It also asserts the backlog item still exists (deleting
   it re-creates the dangling reference in the other direction) and carries a **planted-violation
   test using the verbatim wording that survived**, including the line break it straddled, so the
   guard cannot go vacuous the way WR-02's did.
3. The backlog item's `files:` list and Problem section now record all six sites, which two were
   missed, why, and that the guard depends on the item's continued existence.

### Gap 2 — 11-07-T1: a declared external oracle that nothing mechanized

The row declares "the recon subject is reproducible from source", verified by
`acme -f cbm -o /tmp/x.prg recon-subject.a && cmp`. That command **does** pass (re-run by hand
during this audit: byte-identical). But it was a shell command typed once — nothing re-ran it.
Every other piece of criterion 1's committed evidence is guarded in CI by
`r2000-answer-key.test.ts`; the fixture the entire two-session proof was *derived from* was not.
An edit to `recon-subject.a`, or a re-export of the `.prg` from a different source, would drift
silently while the sealed answer key went on sealing an answer about a program that no longer
matched its own source.

**Resolution:** the byte-compare now lives in `r2000-answer-key.test.ts` (7 tests → 10), the file
that already owns criterion 1's evidence. It **runs in CI**: `ci.yml`'s Test step installs ACME
and sets `VICE_REQUIRE_ACME=1`, so a missing ACME hard-FAILS rather than skipping. Three
behaviours were proven by measurement, not assumed:

| Condition | Observed |
|-----------|----------|
| `VICE_REQUIRE_ACME=1 ACME_BIN=/nonexistent-acme` | 8 pass, **1 fail**, 1 skipped — hard-FAIL, as required |
| `ACME_BIN=/nonexistent-acme`, env unset | 9 pass, 0 fail, **1 skipped** — named SKIP, never a false pass |
| One byte of the committed `.prg` flipped | **FAILS** with the T-11-RETROFIT message — the guard is non-vacuous (fixture restored; tree clean) |

The failure message states the T-11-RETROFIT policy explicitly: a divergence is a real result to
report, **not** to be fixed by re-exporting the `.prg`, because the sealed answer key describes
the committed program.

**One scope decision recorded honestly.** The new test needed an ACME availability gate, and
`disasm-roundtrip.test.ts` and `r2000-cli.test.ts` each already carry a hand-copied one — a third
copy is precisely the divergence `r2000-test-gate.ts` exists to prevent (the two existing copies
have *already* diverged: neither passes a `spawnSync` timeout, the seam does). The gate was
therefore added to `r2000-test-gate.ts`, the sanctioned seam, and the new test imports it. The two
pre-existing copies were **not** migrated: `r2000-cli.test.ts`'s gate semantics are load-bearing
for criterion 3's already-verified evidence (`11-VERIFICATION.md` cites its test 35 by name), and
an audit should not silently re-cut the ground under evidence it is auditing. So the seam is the
route for new consumers, not yet the only implementation — stated as such in its own header and
filed as backlog:
`.planning/todos/pending/2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate.md`.

### Annotation — 11-05-T2: half its command does not run in CI

Not a gap, but recorded so nobody mistakes it for full CI coverage. The row's command names
`vice-proxy.test.ts`, which is a member of `test-gate.mjs`'s frozen `MANUAL_ONLY_TESTS` — it
spawns a real proxy, so `npm run test:automated` never runs it. Checked where the load-bearing
assertions actually live: **all three are in `stock-dispatch.test.ts`, which does run in CI** —
`runR2000Tool()` reaching no VICE transport, the `r2000Def.name` registration bypassing the
backend-aware seam by design, and every curated `r2000_*` name being absent from *both*
manifests. Only the live wire-`tools/list` handshake half is manual, which is correct for it.
Combined run measured: 242 pass, 0 fail, 4 skipped.

### Measured per-command results (pre-Phase-11.1 — superseded)

> These counts were accurate on the pre-11.1 tree and are kept as the record of *that* audit.
> Phase 11.1 changed nine of these files; see **Re-validation Audit 2026-08-21 (post-Phase-11.1)**
> below for the current numbers. Do not check the tree against this table.

| Command | Result |
|---------|--------|
| `node --test r2000-launch.test.ts` | 21 pass |
| `node --test r2000-verify.test.ts` | 12 pass |
| `node --test r2000-d64.test.ts` | 14 pass |
| `node --test r2000-cli.test.ts` | 43 pass |
| `node --test docs-linerefs.test.ts` | 3 pass |
| `node --test docs-dangling-refs.test.ts` | 4 pass *(new)* |
| `node --test r2000-launch.test.ts hostpath-consumers.test.ts` | 28 pass |
| `node --test r2000-mcp-client.test.ts` | 23 pass |
| `node --test r2000-regbits.test.ts` | 13 pass |
| `node --test r2000-enum-gen.test.ts` | 23 pass |
| `node --test r2000-answer-key.test.ts` | 10 pass *(was 7)* |
| `node --test r2000-confidence.test.ts` | 15 pass |
| `node --test r2000-memmap-render.test.ts` | 18 pass |
| `node --test stock-dispatch.test.ts vice-proxy.test.ts` | 242 pass, 4 skipped |
| `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | 27 pass |
| `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts` | 8 pass |
| `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts r2000-cli.test.ts` | 66 pass |
| `node scripts/check-npm-packages.mjs` | OK — 73 / 35 files, 6 skills |
| `node scripts/check-skill-tool-coverage.mjs` | OK — 37 `vice_*`, 10 `r2000_*` all curated |
| `node scripts/check-skill-fork-honesty.mjs` | OK — 11 fork-only mentions, all section-scoped |
| `npx tsc --noEmit -p tsconfig.json` | clean |
| `npm run smoke` | OK — 78 tools advertised |
| **Evidence assertions** | |
| `grep -q "canonical answer" evidence/criterion1/SESSION-B-ANSWER.md` | found |
| `grep -q "al C:" evidence/criterion4/outbound.lbl` | found — 8 label lines |
| `grep -q "absent before" evidence/criterion4/WALKTHROUGH.md` | found |
| `acme -f cbm` + `cmp` on `evidence/criterion1/fixture/recon-subject.a` | byte-identical (now mechanized — see Gap 2) |

---

## Re-validation Audit 2026-08-21 (post-Phase-11.1)

**Why this section exists.** Phase 11.1 (`close-v0-3-0-audit-items...`, commits `2277885..a2e6128`)
landed *after* the audit above and touched 30 non-planning files, including three of Phase 11's own
production modules (`r2000-cli.ts`, `r2000-launch.ts`, `r2000-symbols.ts`, `r2000-project.ts`) and
**nine of the test files this ledger names as its automated commands**. Every measured count in the
section above was therefore stale the moment 11.1 merged. A ledger whose numbers no longer match
reality cannot tell drift from regression — which is the exact defect class `docs-linerefs.test.ts`
exists to prevent for CLAUDE.md. All 35 rows were re-executed against the post-11.1 tree.

| Metric | Count |
|--------|-------|
| Rows re-audited | 35 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Rows green as declared | 35 |

**Full suite:** `VICE_REQUIRE_ACME=1 VICE_REQUIRE_R2000=1 npm run test:automated` → **2021 tests,
2016 pass, 0 fail, 0 skipped, 5 todo** (was 1954 / 1949 pre-11.1). The 5 todos are the same
pre-existing `vice-sync.ts` entries CLAUDE.md's Testing constraint deliberately exempts — not Phase
11 gaps. Real `regenerator2000 0.9.20` (`~/.cargo/bin`) and real ACME 0.97 "Zem" (`~/.local/bin`)
were both present, so **no gated leg skipped silently**; the live halves genuinely ran.

### The three 11.1 changes to Phase 11's production modules are comment-only

Checked rather than assumed, because a behavioural change here would have invalidated rows without
failing them:

- `r2000-symbols.ts` — a `LIBRARY-ONLY` marker on `regenerateAndReload()` recording that it has no
  production caller, plus the statement that R2000-15 is satisfied through the
  `export-lbl → vice_symbols_load → r2000_set_label_name → import-lbl` sequence, **not** through
  that wrapper. Newly guarded as a **biconditional** in `r2000-symbol-roundtrip.test.ts` (8 → 15
  tests): zero callers requires the marker present, one or more requires it absent.
- `r2000-project.ts` — the FLOW-02 comment fix; a phase pointer replaced by the backlog path.
- `r2000-cli.ts` / `r2000-launch.ts` — 11.1's own WR-09/WR-10/IN-06 fixes, carried by 11.1's rows.

No Phase 11 requirement lost coverage, and no new Phase 11 surface went unguarded.

### Non-vacuity re-proven by mutation, not re-asserted

The audit above proved its two repaired guards non-vacuous. Since 11.1 rewrote the infrastructure
around both, each was **mutation-tested again** against the current tree. The working tree was
verified clean (`git status --porcelain` empty) after every mutation was reverted.

| Mutation | Expected | Observed |
|----------|----------|----------|
| Byte 10 of the sealed `evidence/criterion1/fixture/recon-subject.prg` flipped | `r2000-answer-key.test.ts` FAILS | 9 pass, **1 fail** ✅ |
| Pre-fix `.vsf` wording re-appended to `.planning/REQUIREMENTS.md` | `docs-dangling-refs.test.ts` test 1 FAILS | 7 pass, **1 fail** ✅ |
| `VICE_REQUIRE_ACME=1 ACME_BIN=/nonexistent-acme` | hard-FAIL, never skip | 8 pass, **1 fail**, 1 skipped ✅ |
| `ACME_BIN=/nonexistent-acme`, env unset | named SKIP, never false pass | 9 pass, 0 fail, **1 skipped** ✅ |
| `VICE_REQUIRE_R2000=1 R2000_BIN=/nonexistent-r2000` | hard-FAIL, never skip | 25 pass, **1 fail**, 1 skipped ✅ |
| `R2000_BIN=/nonexistent-r2000`, env unset | named SKIP, never false pass | 26 pass, 0 fail, **1 skipped** ✅ |

`docs-dangling-refs.test.ts` grew 4 → 8 tests under 11.1's FLOW-02 generalisation: it now also
polices shipped `.claude/mcp/vice/` **string literals** for phase-number pointers, and carries a
second planted-violation test using the verbatim pre-fix wording. Both planted-violation tests
still fail-on-plant, so neither half has gone vacuous.

### Measured per-command results (supersedes the table above)

Counts that changed under 11.1 are marked; every one is a **growth**, none a loss.

| Command | Result | vs. pre-11.1 |
|---------|--------|--------------|
| `node --test r2000-launch.test.ts` | 26 pass | 21 → 26 |
| `node --test r2000-verify.test.ts` | 12 pass | unchanged |
| `node --test r2000-d64.test.ts` | 16 pass | 14 → 16 |
| `node --test r2000-cli.test.ts` | 54 pass | 43 → 54 |
| `node --test docs-linerefs.test.ts` | 3 pass | unchanged |
| `node --test docs-dangling-refs.test.ts` | 8 pass | 4 → 8 |
| `node --test r2000-launch.test.ts hostpath-consumers.test.ts` | 37 pass | 28 → 37 |
| `node --test r2000-mcp-client.test.ts` | 23 pass | unchanged |
| `node --test r2000-regbits.test.ts` | 13 pass | unchanged |
| `node --test r2000-enum-gen.test.ts` | 23 pass | unchanged |
| `node --test r2000-answer-key.test.ts` | 10 pass | unchanged |
| `node --test r2000-confidence.test.ts` | 15 pass | unchanged |
| `node --test r2000-memmap-render.test.ts` | 18 pass | unchanged |
| `node --test stock-dispatch.test.ts vice-proxy.test.ts` | 246 pass, 4 skipped | 242 → 246 |
| `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | 27 pass | unchanged |
| `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts` | 15 pass | 8 → 15 |
| `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts r2000-cli.test.ts` | 77 pass | 66 → 77 |
| `VICE_REQUIRE_R2000=1 node --test r2000-memmap-render.test.ts` | 18 pass | unchanged |
| `VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` | 54 pass | 43 → 54 |
| `VICE_REQUIRE_ACME=1 node --test r2000-answer-key.test.ts` | 10 pass | unchanged |
| `npx tsc --noEmit -p tsconfig.json` | clean | unchanged |
| `npm run smoke` | OK — 78 tools advertised | unchanged |
| `node scripts/check-npm-packages.mjs` | OK — 73 / 35 files, 6 skills | unchanged |
| `node scripts/check-skill-tool-coverage.mjs` | OK — 37 `vice_*`, 10 `r2000_*` all curated, **7/7 CLI verbs resolved** | verb check added by 11.1-02 |
| `node scripts/check-skill-fork-honesty.mjs` | OK — 11 fork-only mentions, all section-scoped | unchanged |
| **Evidence assertions** | | |
| `grep -q "canonical answer" evidence/criterion1/SESSION-B-ANSWER.md` | found | unchanged |
| `grep -q "al C:" evidence/criterion4/outbound.lbl` | found — 8 label lines | unchanged |
| `grep -q "absent before" evidence/criterion4/WALKTHROUGH.md` | found | unchanged |

All 17 files under `evidence/` are present and unmodified.

### The prior audit's one scope limit still stands, and is still filed

The 2026-08-21 audit deliberately left `disasm-roundtrip.test.ts` and `r2000-cli.test.ts` on their
hand-copied ACME gates rather than re-cutting the ground under evidence it was auditing. Re-checked:
both still hand-roll their gate, `r2000-answer-key.test.ts` still imports the
`r2000-test-gate.ts` seam, and
`.planning/todos/pending/2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate.md` still
exists. 11.1 did not close it and did not claim to. Unchanged deliberate limit, not a new gap.

### Observation outside this phase's scope

**Phase 11.1 has no `VALIDATION.md`.** It has 7 plans, 7 summaries, a CONTEXT and a VERIFICATION
(`11/11`, every guard mutation-tested), but no Nyquist ledger — and it is the phase that added
`docs-deferred-ledger.test.ts`, `docs-review-disposition.test.ts`, `r2000-spawn-seam.test.ts`,
`r2000-verb-coverage.test.ts` and `skill-honesty-checks.test.ts`. Those guards are all green in the
full-suite run above, so nothing is unguarded in fact; what is missing is the ledger that would say
so. Recorded here because 11.1's drift is what triggered this re-audit. Route:
`/gsd-validate-phase 11.1`.

### Re-validation sign-off (2026-08-21, post-11.1)

- [x] All 35 rows' declared automated commands re-executed against the post-11.1 tree, not read
- [x] No gated leg skipped silently — real `regenerator2000 0.9.20` and real ACME 0.97 both present
- [x] 0 gaps found; every row still green as declared
- [x] Both previously-repaired guards re-proven non-vacuous by fresh planted mutations
- [x] All four availability-gate modes (2 hard-FAIL, 2 SKIP) observed behaving correctly
- [x] 11.1's edits to Phase 11 production modules confirmed comment-only, with a new biconditional guard
- [x] Working tree verified clean after every mutation was reverted
- [x] Full suite + typecheck + smoke + all three CI scripts green
- [x] `nyquist_compliant: true` still holds post-11.1

**Approval:** re-validation audit 2026-08-21 (35/35 rows re-measured after Phase 11.1; 0 gaps)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — 35/35
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all ❌ references above (see the reconciliation note)
- [x] No watch-mode flags
- [x] Feedback latency < 30 s for the quick run
- [x] WR-02 fixed before any new argv builder lands — plan 11-01 (wave 1) precedes plan 11-04 (wave 2)
- [x] Both manual artifacts committed under the phase's `evidence/` directory — plans 11-07/11-09 and 11-11
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-08-20 (12 plans, 35 tasks, 7 waves)

### Post-execution audit sign-off (2026-08-21)

- [x] All 35 rows' declared automated commands executed, not read — results tabled above
- [x] No gated leg skipped silently: real `regenerator2000 0.9.20` and real ACME 0.97 both present
- [x] 2 gaps found, 2 resolved, 0 escalated to manual-only
- [x] Both new/extended guards proven non-vacuous by planted violation, not asserted to be
- [x] Both env-gated hard-FAIL modes observed failing, and both SKIP modes observed skipping
- [x] Full suite + typecheck + smoke + all three CI scripts green after the changes
- [x] One deliberate scope limit stated rather than glossed (the two unmigrated ACME gates) and filed as backlog
- [x] `nyquist_compliant: true` still holds — every requirement now has automated verification that can fail

**Approval:** validation audit 2026-08-21 (35/35 rows measured; 2 gaps closed)
