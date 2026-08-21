---
phase: 12
slug: audit-integrity-instrument
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `12-RESEARCH.md` § Validation Architecture (line 642).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `node:assert/strict` (no separate framework, no new dependency) |
| **Config file** | none — `.claude/mcp/vice/package.json:106` (`"test": "node --test '*.test.*'"`) |
| **Quick run command** | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` |
| **Full suite command** | `cd .claude/mcp/vice && npm test` (the command CI's `Test` step actually runs — `.github/workflows/ci.yml:110-122`) |
| **Estimated runtime** | ~1 s quick (four real guards measured at 0.215 s + synthetic pair); full suite as today |

---

## Sampling Rate

- **After every task commit:** Run `cd .claude/mcp/vice && node --test audit-integrity.test.ts`
- **After every plan wave:** Run `cd .claude/mcp/vice && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green **and** the one-time
  plant-and-revert transcript (D-12-17..D-12-20) must be committed as a phase
  artifact. Success criteria 1 and 2 are **not** satisfied by the automated
  suite alone.
- **Max feedback latency:** ~5 s (quick), well under the full-suite budget

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are keyed to the deliverable
each task must produce. Every row's requirement is `GATE-01`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (gate script) | TBD | 1 | GATE-01 (criterion 3) | T-12-01 | Parses hook stdin JSON and scanned Markdown/Bash text defensively; never `eval`/`import()`/`exec`s scanned content | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 — `scripts/audit-gate.mjs` does not exist | ⬜ pending |
| TBD (planted violation) | TBD | 1 | GATE-01 (criterion 1) | — | Synthetic tree: failing guard + gated-status audit → gate refuses | unit (planted-violation) | `cd .claude/mcp/vice && node --test audit-integrity.test.ts -t "planted violation"` | ❌ W0 | ⬜ pending |
| TBD (planted false-negative) | TBD | 1 | GATE-01 (criterion 2) | — | Synthetic tree: passing guards + gated-status audit → gate allows | unit (planted false-negative) | `cd .claude/mcp/vice && node --test audit-integrity.test.ts -t "planted false-negative"` | ❌ W0 | ⬜ pending |
| TBD (derived-set floor) | TBD | 1 | GATE-01 | — | `docs-*.test.ts` glob is non-vacuous: `>= 4` plus the four named members present | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| TBD (gaps_found never gated) | TBD | 1 | GATE-01 (D-12-13) | — | `status: gaps_found` is allowed even with a red guard — honest bad news is never obstructed | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| TBD (frontmatter-only scan) | TBD | 1 | GATE-01 | T-12-02 | Column-zero frontmatter-only line scan; prose occurrences of `status:` (9 in v0.2.0, 4 in v0.3.0) do not false-positive | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| TBD (hook wiring) | TBD | 2 | GATE-01 (D-12-03/04) | T-12-01 | `PreToolUse` matcher covers `Write`, `Edit`, **and** `Bash`; `exit 2` with reason on stderr (not JSON `permissionDecision`) | manual | in-session tool call against a red tree, observe block | ❌ W0 — `.claude/settings.json` hooks block does not exist | ⬜ pending |
| TBD (real-tree red/green transcript) | TBD | 2 | GATE-01 (criteria 1 & 2) | — | Plant-and-revert on the real repo, revert shown as explicitly as the plant | manual, evidenced by committed transcript | `node scripts/audit-gate.mjs` run red then reverted-green, output captured | N/A — one-time recorded evidence | ⬜ pending |
| TBD (packaging unchanged) | TBD | 2 | GATE-01 | — | New files do not leak into either npm tarball | unit | `node scripts/check-npm-packages.mjs` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/audit-gate.mjs` — the single check point (D-12-01); does not exist yet
- [ ] `.claude/mcp/vice/audit-integrity.test.ts` — Layer 1 + planted pair (D-12-02, D-12-16); does not exist yet. **Must not** be named `docs-*` (D-12-09 — self-recursion hazard)
- [ ] `.claude/settings.json` — rewritten hooks-only and committed (D-12-05); today exists locally, is gitignored at `.gitignore:55`, and contains only machine-specific `permissions`
- [ ] `.claude/settings.local.json` — receives the moved `permissions` block. **Already exists with unrelated content** (`disabledMcpjsonServers: ["mastra","vice"]` plus four `permissions.allow` entries) that must be preserved, not overwritten
- [ ] `.gitignore:51-55` — comment amended to record the split rationale (documentation obligation, no functional test gap)

*Framework install: none needed — `node:test` is already the repo's test runner.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `PreToolUse` hook actually refuses a live in-session write of a gated status | GATE-01 (D-12-03) | Hook behavior is a property of the Claude Code runtime, not of repo code — it cannot be exercised by `node --test`. Same class as `vice-sync.ts`'s deliberately-untested checkpoint waits (CLAUDE.md § Testing). | With `.claude/settings.json` wired and one guard planted red, attempt a `Write`, an `Edit`, and a `Bash` heredoc that each record `status: passed` into a `*MILESTONE-AUDIT*.md`. All three must be blocked; capture the refusal text. |
| Real-tree plant-and-revert red → green | GATE-01 (criteria 1 & 2) | Criterion 1 explicitly asks for a committed transcript of the real mechanism against the real tree, not a synthetic fixture. | Red `docs-linerefs.test.ts` by changing one digit of a `vice-proxy.ts:<N>` citation in CLAUDE.md (D-12-18). Run the gate, capture refusal. Revert the digit. Run the gate again, capture green. Record both, plus the guard's own output, in the phase artifact (D-12-19, D-12-20). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
