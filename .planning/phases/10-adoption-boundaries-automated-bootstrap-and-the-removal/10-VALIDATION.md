---
phase: 10
slug: adoption-boundaries-automated-bootstrap-and-the-removal
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | R2000-01 | T-10-01 | `--vice` unreachable by construction; a scan throws a named, loud error — never silently strips | unit | `cd .claude/mcp/vice && node --test r2000-launch.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-02 | — | No argument reaching regenerator2000 is host-translated; absence is structurally asserted | unit (extends existing) | `cd .claude/mcp/vice && node --test hostpath-consumers.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | R2000-09 | T-10-02 | `.prg`/`.d64`(named entry)/`.raw` → `.regen2000proj` with no human; `use_illegal_opcodes` and machine `system` explicitly forced, never inherited from auto-detection | unit (pure synthesis) + integration (real r2000 load) | `cd .claude/mcp/vice && node --test r2000-project.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-06 | — | `--verify`'s ACME result line parsed as `✓`; fails on `skipped`; never trusts exit code alone | integration (subprocess, gated) | `VICE_REQUIRE_R2000=1 cd .claude/mcp/vice && node --test r2000-verify.test.ts` (CI: named SKIP per D-11) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R2000-05 | — | `disasm` verb, `## Disassembly` caveat section, and `toacme` prerequisite are gone from both `acme.mjs` and `SKILL.md` | negative assertion (grep) | `! grep -qn "disasm\|toacme" .claude/skills/acme-build/scripts/acme.mjs .claude/skills/acme-build/SKILL.md` | ❌ W0 (regression test optional) | ⬜ pending |
| TBD | TBD | TBD | R2000-03 | — | README names regenerator2000 as required prerequisite, states `cargo install` cost + one-project-per-namespace limit; `THIRD-PARTY-NOTICES.md` carries the Apache-2.0 notice | documentation-honesty CI gate | `node scripts/check-skill-fork-honesty.mjs` | ✅ (needs D-13 edit) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/mcp/vice/r2000-launch.ts` + `r2000-launch.test.ts` — R2000-01 (D-07 construction + scan guard)
- [ ] `.claude/mcp/vice/r2000-project.ts` + `r2000-project.test.ts` — R2000-09 (D-01/D-04/D-05 synthesis, forced settings)
- [ ] `.claude/mcp/vice/r2000-verify.test.ts` — R2000-06 (D-09/D-10/D-11 gated `--verify` proof).
      **New file. Must NOT edit `disasm-roundtrip.test.ts`** — that is Phase 4's protected
      stock-disassembler test and is unrelated to `acme-build`'s deleted `disasm` verb.
- [ ] `hostpath-consumers.test.ts` extension — R2000-02 (D-08). No new file.
- [ ] `.d64` named-entry extraction function in or beside
      `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs` — D-02. Confirmed absent today
      (`d64-parse.mjs` exports only `readImage`/`sectorsPerTrack`/`tsToOffset`/`parseBam`/`parseDirectory`).
- [ ] Skill-side entry point reaching the D-06 seam across the npm-installer package boundary.
      **Open design question** (RESEARCH.md Open Question #1 / Assumption A2): the recommended
      shape is an argv-subcommand dispatch on the existing `vice-mcp` bin, not a filesystem
      import — `.claude/mcp/vice/*.ts` are never plain files in the npm-installer route.
      No test infrastructure exists yet because the mechanism itself is unlocked.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Devcontainer run with no upstream patch | R2000-02 | This repo is host-developed with no devcontainer (see project constraints); a real container run cannot be exercised in CI | Reviewer confirms by inspection that no arg reaching regenerator2000 passes through `hostpath.ts`/`containerpath.ts`, backed by the automated `hostpath-consumers.test.ts` absence assertion |
| regenerator2000 version drift | all | regenerator2000 0.9.20 is an actively-developed eight-month-old project; the CLI surface is verified as of 2026-08-20 only | Re-run `regenerator2000 --version && regenerator2000 --help` at execution start; if the flag set differs from RESEARCH.md § Environment, stop and re-research before planning changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every requirement row above has a Task ID and Plan assigned
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
