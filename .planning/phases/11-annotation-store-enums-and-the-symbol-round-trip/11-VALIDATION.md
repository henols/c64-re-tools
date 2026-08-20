---
phase: 11
slug: annotation-store-enums-and-the-symbol-round-trip
status: draft
nyquist_compliant: false
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

Task IDs are assigned by the planner. Until plans exist, this table is the
**requirement-level** map the planner must expand into per-task rows; every task
it writes must trace to one of these rows or add a new one.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | R2000-10 | — | Curated-subset gate refuses any tool name outside the D-18 set | integration (live r2000 child, gated) | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ❌ W0 — new file | ⬜ pending |
| TBD | TBD | TBD | R2000-10 | — | N/A | human-witnessed transcript | N/A — recorded artifact | ❌ W0 — new `evidence/` file | ⬜ pending |
| TBD | TBD | TBD | R2000-11 | — | N/A | integration (live r2000 child, gated) | `VICE_REQUIRE_R2000=1 node --test r2000-tools.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-13 | T-11-ENUM-NAME | Generated enum/variant names cannot inject arbitrary text into exported ACME source | integration (live r2000 child + real `acme`) | `VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 node --test r2000-enum-gen.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-14 | — | Label-file reads keep `stock-symbols.ts`'s byte/line/symbol ceilings | integration (live r2000 child) | `VICE_REQUIRE_R2000=1 node --test r2000-launch.test.ts` (extend existing) | Partial — module + test exist, need new argv builders | ⬜ pending |
| TBD | TBD | TBD | R2000-15 | — | `--import_lbl` never reported as success without a verified post-save read-back | integration (live r2000 child) | `VICE_REQUIRE_R2000=1 node --test r2000-symbol-roundtrip.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-15 | — | N/A | live stock `x64sc` walkthrough (D-30, D-31) | N/A — human-witnessed, not in CI | ❌ W0 — new `evidence/` file | ⬜ pending |
| TBD | TBD | TBD | R2000-10 (folded todo 2) | — | D-07's `--vice` deny-by-construction guard is non-vacuous | unit | `node --test r2000-launch.test.ts` | Exists — **WR-02: currently can go vacuous** | ⬜ pending |
| TBD | TBD | TBD | R2000-10 (folded todo 1) | — | Dynamically-imported r2000 modules cannot silently fall out of `files[]` | unit / packaging | `node scripts/check-npm-packages.mjs` | Exists — static-import-only closure walk at `:129` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/mcp/vice/r2000-tools.test.ts` — stubs for R2000-10, R2000-11
- [ ] `.claude/mcp/vice/r2000-enum-gen.test.ts` — stubs for R2000-13
- [ ] `.claude/mcp/vice/r2000-symbol-roundtrip.test.ts` — stubs for R2000-15
- [ ] `.claude/mcp/vice/r2000-mcp-client.test.ts` — stubs for the MCP-client seam
      (failure modes: spawn failure, mid-call child exit, unanswered `tools/call`,
      stderr interleaving, non-zero exit after a successful save)
- [ ] Extend `.claude/mcp/vice/r2000-launch.test.ts` for the new argv builders
      (R2000-14) **and** fix WR-02's `stripCommentLines()` first, so the D-07
      guard assertions are non-vacuous before anything is built on top of them
- [ ] Phase `evidence/` directory for the two human-witnessed artifacts
- [ ] No framework install needed — `node --test` is already the runner

---

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

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s for the quick run
- [ ] WR-02 fixed before any new argv builder lands
- [ ] Both manual artifacts committed under the phase's `evidence/` directory
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
