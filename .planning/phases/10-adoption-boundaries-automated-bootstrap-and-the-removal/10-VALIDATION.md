---
phase: 10
slug: adoption-boundaries-automated-bootstrap-and-the-removal
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `10-RESEARCH.md` § Validation Architecture. Task IDs are filled in
> by the planner; requirement rows below are fixed and must all be covered.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `.claude/mcp/vice/package.json` `scripts.test`: `node --test '*.test.*'` |
| **Quick run command** | `cd .claude/mcp/vice && node --test <specific>.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm test` |
| **Estimated runtime** | ~30 seconds (full suite); < 5 seconds per single test file |

**Additional CI-blocking gates this phase directly touches** (run at the phase gate, not per task):

| Gate | Command | Why this phase touches it |
|------|---------|---------------------------|
| Skill/fork honesty | `node scripts/check-skill-fork-honesty.mjs` | R2000-03 / D-13 array-move edit |
| npm package contents | `node scripts/check-npm-packages.mjs` | New seam modules must appear in `files[]` (transitive-closure walk) |
| Resources sync | `cd .claude/mcp/vice && node --test resources-sync.test.ts` | Confirms the r2000 modules stay container-side and need no `resources/*.mjs` artifact |

---

## Sampling Rate

- **After every task commit:** Run the specific new/modified test file's quick command
  (e.g. `cd .claude/mcp/vice && node --test r2000-launch.test.ts`)
- **After every plan wave:** Run `cd .claude/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite green **plus** `node scripts/check-skill-fork-honesty.mjs`
  and `node scripts/check-npm-packages.mjs` both exit 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Requirement-level rows are authoritative. The planner MUST assign each row a Task ID
and Plan number; no row may be left unassigned.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01 T1+T2 | 10-01 | 1 | R2000-01 | T-10-01 | `--vice` unreachable by construction; a scan throws a named, loud error — never silently strips | unit | `cd .claude/mcp/vice && node --test r2000-launch.test.ts` | ❌ W0 | ⬜ pending |
| 10-01 T3 | 10-01 | 1 | R2000-02 | — | No argument reaching regenerator2000 is host-translated; absence is structurally asserted | unit (extends existing) | `cd .claude/mcp/vice && node --test hostpath-consumers.test.ts` | ✅ | ⬜ pending |
| 10-02 T2+T3 | 10-02 | 1 | R2000-09 | T-10-02 | `.prg`/`.d64`(named entry)/`.raw` → `.regen2000proj` with no human; `use_illegal_opcodes` and machine `system` explicitly forced, never inherited from auto-detection | unit (pure synthesis) + integration (real r2000 load) | `cd .claude/mcp/vice && node --test r2000-project.test.ts` | ❌ W0 | ⬜ pending |
| 10-05 T1+T2 | 10-05 | 3 | R2000-06 | — | `--verify`'s ACME result line parsed as `✓`; fails on `skipped`; never trusts exit code alone | integration (subprocess, gated) | `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 node --test r2000-verify.test.ts` (CI: named SKIP per D-11, and CI never sets the variable) | ❌ W0 | ⬜ pending |
| 10-06 T1-T3 | 10-06 | 4 | R2000-05 | — | `disasm` verb, `## Disassembly` caveat section, and `toacme` prerequisite are gone from both `acme.mjs` and `SKILL.md` | negative assertion (grep) | `! grep -qn "disasm\|toacme" .claude/skills/acme-build/scripts/acme.mjs .claude/skills/acme-build/SKILL.md` | ❌ W0 → permanent CI regression assertion added by plan 10-08 task 3 (`check-skill-fork-honesty.mjs`) | ⬜ pending |
| 10-08 T1+T3 | 10-08 | 5 | R2000-03 | — | README names regenerator2000 as required prerequisite, states `cargo install` cost + one-project-per-namespace limit; `THIRD-PARTY-NOTICES.md` carries the dual `MIT OR Apache-2.0` notice (D-14 corrects the Apache-2.0-only wording) | documentation-honesty CI gate | `node scripts/check-skill-fork-honesty.mjs` | ✅ (needs the D-13 array move; plan 10-08 task 1 makes the gate fail first, task 3 makes it pass) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 gaps are assigned to plans; none is left unowned.

- [x] `.claude/mcp/vice/r2000-launch.ts` + `r2000-launch.test.ts` — R2000-01 (D-07 construction + scan guard) → **plan 10-01, tasks 1-2**
- [x] `.claude/mcp/vice/r2000-project.ts` + `r2000-project.test.ts` — R2000-09 (D-01/D-04/D-05 synthesis, forced settings) → **plan 10-02, tasks 2-3**
- [x] `.claude/mcp/vice/r2000-verify.test.ts` — R2000-06 (D-09/D-10/D-11 gated `--verify` proof) → **plan 10-05, tasks 1-2**.
      **New file. Must NOT edit `disasm-roundtrip.test.ts`** — that is Phase 4's protected
      stock-disassembler test and is unrelated to `acme-build`'s deleted `disasm` verb.
      Plans 10-02, 10-04 and 10-05 each assert in their acceptance criteria that no Phase 4
      disassembler file appears in the diff.
- [x] `hostpath-consumers.test.ts` extension — R2000-02 (D-08) → **plan 10-01, task 3**. No new
      file; `EXPECTED_IMPORTERS` stays a five-element array, and all five future r2000 module
      names are placed on the negative/absence side in one test.
- [x] `.d64` named-entry extraction — D-02 → **plan 10-03**, landing as
      `.claude/mcp/vice/r2000-d64.ts` rather than inside `d64-parse.mjs`. Open Question #2 is
      resolved by the package boundary: `.claude/skills/**` is not in `@henols/vice-mcp`'s
      `files[]`, both npm-installer routes launch via `npx` with no skill files on disk, and
      `check-npm-packages.mjs`'s transitive-closure walk would fail a pack that reached outside
      the package. `d64-parse.mjs` is left untouched and cited as the algorithm's origin.
- [x] Skill-side entry point reaching the D-06 seam — **plan 10-04**, which adopts RESEARCH.md's
      recommendation as the design (an argv subcommand on the existing `vice-mcp` bin, dispatched
      before any server side effect) and verifies it end to end: plan 10-04 task 3 spawns the bin
      exactly as a consumer would and asserts exit 0, usage text, no JSON-RPC frame, and
      termination within a timeout. `files[]` gains the four new modules in plan 10-04 task 2 and
      `r2000-verify.ts` in plan 10-05 task 1, both gated by `check-npm-packages.mjs`.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Devcontainer run with no upstream patch | R2000-02 | This repo is host-developed with no devcontainer (see project constraints); a real container run cannot be exercised in CI | Reviewer confirms by inspection that no arg reaching regenerator2000 passes through `hostpath.ts`/`containerpath.ts`, backed by the automated `hostpath-consumers.test.ts` absence assertion |
| regenerator2000 version drift | all | regenerator2000 0.9.20 is an actively-developed eight-month-old project; the CLI surface is verified as of 2026-08-20 only | **Assigned: plan 10-02, task 1** — re-runs `regenerator2000 --version && regenerator2000 --help` at execution start, writes a PASS/FAIL line per depended-on flag plus one `DRIFT:` verdict to `evidence/10-environment-recheck.txt`, and STOPS the plan on any drift rather than adapting silently |
| Live `--verify` evidence, since CI never runs it | R2000-06 | D-11 keeps regenerator2000 out of CI, so no green tick will ever record this | **Assigned: plan 10-05, task 2** — the raw stdout, exit codes and tool versions of both live runs (`.prg` and flat 64K) are committed to `evidence/10-verify-transcript.txt` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every requirement row above has a Task ID and Plan assigned
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-20 — every requirement row carries a Task ID and plan number, every Wave 0 gap is owned, and both manual-only rows are assigned to a task with a committed artifact.
