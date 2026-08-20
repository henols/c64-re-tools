---
phase: 11
slug: annotation-store-enums-and-the-symbol-round-trip
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-20
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
| 11-01-T1 | 11-01 | 1 | R2000-10 (folded todo 2, WR-02) | T-11-VACUOUS | D-07's `--vice` deny-by-construction guard is non-vacuous | unit + planted violation | `node --test r2000-launch.test.ts` | ⬜ |
| 11-01-T2 | 11-01 | 1 | R2000-13 (folded todo 2, WR-04) | T-11-FALSESUCCESS-ACME | An ACME transcript containing a failure never reports a pass | unit, pinned fixtures | `node --test r2000-verify.test.ts` | ⬜ |
| 11-01-T3 | 11-01 | 1 | R2000-10 | T-11-GATE-DRIFT | One D-11 availability gate; its hard-FAIL mode observed failing | unit + env-driven demo | `node --test r2000-verify.test.ts` | ⬜ |
| 11-02-T1 | 11-02 | 1 | R2000-10 (WR-05/06) | T-11-D64-TRUNC, T-11-D64-NAME | A truncated `.d64` throws; a printed name is a selectable name | unit, synthetic images | `node --test r2000-d64.test.ts` | ⬜ |
| 11-02-T2 | 11-02 | 1 | R2000-10 (WR-07) | T-11-RAW-GUESS | A wrong-size flat capture is refused, not reinterpreted | unit, real files | `node --test r2000-cli.test.ts` | ⬜ |
| 11-02-T3 | 11-02 | 1 | R2000-10 (folded todo 1, WR-03) | T-11-HONESTY-BYPASS, T-11-PKG-CLOSURE | Dynamically-imported modules cannot fall out of `files[]`; the honesty exemption is scoped and bounded | CI scripts + planted violations | `node scripts/check-npm-packages.mjs` | ⬜ |
| 11-03-T1 | 11-03 | 1 | R2000-13 (D-34) | T-11-DOC-DANGLE | No document points at Phase 11 as `.vsf`'s home | doc assertion (grep gate) | `grep -c vsf .planning/ROADMAP.md` cross-checked against the Phase-11 mention count | ⬜ |
| 11-03-T2 | 11-03 | 1 | R2000-14 (D-35), R2000-13 (D-22) | T-11-DOC-OVERCLAIM | The `--export_lbl` claim is verified and scoped to 0.9.20 + this fixture | doc assertion + existing suite | `cd .claude/mcp/vice && npm run test:automated` | ⬜ |
| 11-03-T3 | 11-03 | 1 | R2000-10, R2000-14 | T-11-DOC-DRIFT | CLAUDE.md's cited line numbers match the source | unit + planted violation | `node --test docs-linerefs.test.ts` | ⬜ |
| 11-04-T1 | 11-04 | 2 | R2000-14, R2000-15 (D-28) | T-11-VICE, T-11-PATH-XLATE | `--import_lbl` cannot be built without `--mcp-server-stdio`; no r2000 module imports `hostpath.ts` | unit, exact-argv | `node --test r2000-launch.test.ts hostpath-consumers.test.ts` | ⬜ |
| 11-04-T2 | 11-04 | 2 | R2000-10 | T-11-HANG, T-11-PHANTOM-DEP | Five named client failure modes measured; no direct SDK import | integration vs stub servers | `node --test r2000-mcp-client.test.ts` | ⬜ |
| 11-04-T3 | 11-04 | 2 | R2000-10, R2000-14, R2000-15 | T-11-FALSESUCCESS, T-11-DEMUX | A save is never reported without an independent re-read; responses correlate on `id` | stubs + live real child, gated | `VICE_REQUIRE_R2000=1 node --test r2000-mcp-client.test.ts` | ⬜ |
| 11-05-T1 | 11-05 | 3 | R2000-10, R2000-11 | T-11-BATCH, T-11-UNCURATED, T-11-PATH-ESCAPE, T-11-D32 | The curated gate refuses any name outside the D-18 set, including nested batch names, before any spawn | unit + integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ⬜ |
| 11-05-T2 | 11-05 | 3 | R2000-10 | T-11-PATH-XLATE | No `r2000_*` runner reaches `forwardToVice()`/`rewriteArguments()`; family in neither manifest | structural + proxy handshake | `node --test stock-dispatch.test.ts vice-proxy.test.ts` | ⬜ |
| 11-05-T3 | 11-05 | 3 | R2000-10 | T-11-PROSE | An `r2000_*` name in skill prose must exist and be curated | CI script + planted violation | `node scripts/check-skill-tool-coverage.mjs` | ⬜ |
| 11-06-T1 | 11-06 | 4 | R2000-13 (D-22) | T-11-REGBITS-PROSE, T-11-GEN-DRIFT | Generated identifiers are legal ACME; the table is digest-pinned to `memmap.json` | unit + drift guard | `node --test r2000-regbits.test.ts` | ⬜ |
| 11-06-T2 | 11-06 | 4 | R2000-13 (D-20, D-23) | T-11-ENUM-NAME, T-11-SILENT-CAP, T-11-MISBIND, T-11-GLOBAL-WRITE | No unsanitized identifier reaches `create_project_enum`; coverage reported, never implied | unit + property + zero-spawn refusal | `node --test r2000-enum-gen.test.ts` | ⬜ |
| 11-06-T3 | 11-06 | 4 | R2000-13 (criterion 3) | T-11-ENUM-NAME | `lda #$1b`/`sta $d011` renders semantically in the ACME export and reassembles | integration (live r2000 + real ACME), gated | `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts r2000-cli.test.ts` | ⬜ |
| 11-07-T1 | 11-07 | 4 | R2000-10 | — | The recon subject is reproducible from source | external oracle (real ACME byte-compare) | `acme -f cbm -o /tmp/x.prg recon-subject.a && cmp` | ⬜ |
| 11-07-T2 | 11-07 | 4 | R2000-10 (criterion 1, session A) | T-11-LEAK | Findings persist and re-read in a fresh session | integration (live r2000) + committed artifact | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ⬜ |
| 11-07-T3 | 11-07 | 4 | R2000-10 (criterion 1, the question) | T-11-GUESSABLE, T-11-SEAL-DRIFT | The answer key cannot drift from the answer it seals | unit (seal recomputation) | `node --test r2000-answer-key.test.ts` | ⬜ |
| 11-08-T1 | 11-08 | 5 | R2000-14, R2000-15 | T-11-LBL-PARSER-DUP, T-11-MERGE-DIVERGE | No third `al C:` parser; `vice_symbols_load` stays replace-not-merge | typecheck + source assertions | `npx tsc --noEmit -p tsconfig.json` | ⬜ |
| 11-08-T2 | 11-08 | 5 | R2000-15 (criterion 4, mechanism) | T-11-IMPORT-DISCARD, T-11-LBL-SIZE | `--import_lbl` is never reported as success without a post-save read-back; the discard trap is pinned | integration (live r2000), gated | `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts` | ⬜ |
| 11-08-T3 | 11-08 | 5 | R2000-14, R2000-15 | T-11-LBL-SIZE | The label-file ceilings survive the CLI route | CLI integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` | ⬜ |
| 11-09-T1 | 11-09 | 5 | R2000-10, R2000-11 (criterion 1, session B) | T-11-CONTEXT-BLEED | A prose-blind session answers from the store alone | human-witnessed transcript (recorded artifact) | `grep -q "canonical answer" SESSION-B-ANSWER.md` | ⬜ |
| 11-09-T2 | 11-09 | 5 | R2000-10 | T-11-RETROFIT, T-11-VACUOUS-CHECK | A mismatch is reported, never repaired; a missing answer FAILS rather than skips | unit (seal comparison) | `node --test r2000-answer-key.test.ts` | ⬜ |
| 11-10-T1 | 11-10 | 6 | R2000-10 (D-25) | T-11-GRADE-TYPO, T-11-SECOND-STORE | A typo'd grade prefix fails instead of degrading to ungraded | unit, must-fail-on-typo | `node --test r2000-confidence.test.ts` | ⬜ |
| 11-10-T2 | 11-10 | 6 | R2000-10 (D-24, D-27) | T-11-GEN-EDIT, T-11-PLACEHOLDER, T-11-SKILLPATH | The memory map is generated; a hand edit or a store change is detected; no placeholder is emitted | golden output + drift guard, gated | `VICE_REQUIRE_R2000=1 node --test r2000-memmap-render.test.ts` | ⬜ |
| 11-10-T3 | 11-10 | 6 | R2000-10 | T-11-GEN-EDIT | `render-memmap --check` exits non-zero on drift | CLI integration, gated | `VICE_REQUIRE_R2000=1 node --test r2000-cli.test.ts` | ⬜ |
| 11-11-T1 | 11-11 | 6 | R2000-14 (criterion 4, outbound) | T-11-FLAG-ORDER, T-11-SINGLE-CLIENT | A store label resolves a live address on genuine stock; `-default` precedes `-binarymonitor` | live stock `x64sc` walkthrough | `grep -q "al C:" outbound.lbl` | ⬜ |
| 11-11-T2 | 11-11 | 6 | R2000-15 (criterion 4, the loop) | T-11-TWO-DUMPS, T-11-NAME-INJECT | The inbound name is proven absent before the live discovery | live walkthrough + human-check | `grep -q "absent before" WALKTHROUGH.md` | ⬜ |
| 11-11-T3 | 11-11 | 6 | R2000-14, R2000-15 (BACK-02 standing gate) | T-11-OVERCLAIM | The fork is verified unregressed; no gate is claimed without quoted output | regression gate + packaging validation | `npm run test:automated && npm run typecheck && npm run smoke && node scripts/check-npm-packages.mjs` | ⬜ |
| 11-12-T1 | 11-12 | 7 | R2000-10, R2000-11 | T-11-PROSE-FAKE-TOOL, T-11-TEMPLATE-HANDFILL | Every `r2000_*` name in prose exists and is curated; the template offers nothing to hand-fill | CI prose gates + doc assertions | `node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-fork-honesty.mjs` | ⬜ |
| 11-12-T2 | 11-12 | 7 | R2000-13 | T-11-PROSE-OVERCLAIM | The memmap coverage gap is stated, not glossed | CI prose gate | `node scripts/check-skill-fork-honesty.mjs` | ⬜ |
| 11-12-T3 | 11-12 | 7 | R2000-10 | T-11-PROSE-FAKE-TOOL, T-11-STALE-TARBALL | The reference floor can fail; the installer's generated copy carries the edits | CI script + planted violation + packaging | `node scripts/check-skill-tool-coverage.mjs && node scripts/check-npm-packages.mjs` | ⬜ |

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
