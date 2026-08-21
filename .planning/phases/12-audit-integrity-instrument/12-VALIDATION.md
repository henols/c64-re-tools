---
phase: 12
slug: audit-integrity-instrument
status: approved
nyquist_compliant: true
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

Task IDs are `{plan}-{task}` as assigned in the four PLAN.md files. Every row's
requirement is `GATE-01`. Threat ids are the `T-12-NN` entries in each plan's
`<threat_model>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | GATE-01 (criterion 3) | T-12-01, T-12-05, T-12-06 | Single check point `scripts/audit-gate.mjs`; parses scanned Markdown defensively; never `eval`/`import()`/`exec`s scanned content; guard-file list always from `readdirSync` over a code-controlled dir; `milestoneAuditFiles()` skips dot-dirs and refuses symlinked dirs | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 — does not exist | ⬜ pending |
| 12-01-02 | 01 | 1 | GATE-01 (criteria 1, 2, 3) | T-12-06 | Layer 1: planted-violation + planted-false-negative pair on `mkdtempSync` trees outside the repo, so no synthetic guard can join the real `docs-*` glob (D-12-09); `>= 4` floor plus named-member presence (D-12-08); `gaps_found` allowance asserted (D-12-13); column-zero frontmatter-only scan defeats the prose false-positive | unit (planted pair) | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 — does not exist | ⬜ pending |
| 12-02-01 | 02 | 2 | GATE-01 (RESEARCH A1) | T-12-08 | Empirically resolves this build's `tool_input` field names before any hook code depends on them; recorded in `12-HOOK-STDIN-EVIDENCE.md` | manual, evidenced by committed artifact | restart-free stdin probe; observation recorded | ❌ W0 — artifact does not exist | ⬜ pending |
| 12-02-02 | 02 | 2 | GATE-01 (D-12-03) | T-12-01, T-12-08 | `--hook` mode on the same single script (no wrapper); `exit 2` + reason on stderr, never `exit 2` + JSON `permissionDecision` (anthropics/claude-code#43407); bounded stdin (5 s timeout, 10 MiB cap); field-name-agnostic extraction with a `shapeKnown: false` loud refusal; fail-closed once in scope, exit 0 before any spawn when out of scope | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | GATE-01 (D-12-04) | T-12-07, T-12-08 | Hook contract pinned: `Bash` heredoc / append / tee shapes detected alongside `Write` and `Edit`; unknown-payload-shape case refuses loudly. Payloads built via `spawnSync(..., { input })` inside Node — never literal Bash strings — so the tests cannot self-block once the hook is live | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | GATE-01 (D-12-05) | — | Committed `.claude/settings.json` holds `hooks` and nothing else — no permissions, no absolute machine paths; existing `.claude/settings.local.json` content (`disabledMcpjsonServers`, 4 `permissions.allow` entries) merged and preserved, not overwritten; `.gitignore` comment records the split rationale | unit + inspection | `cd .claude/mcp/vice && node --test audit-integrity.test.ts`; `git diff --stat .gitignore` | ❌ W0 — hooks block does not exist | ⬜ pending |
| 12-03-02 | 03 | 3 | GATE-01 (D-12-02, D-12-14) | T-12-07 | Layer 1 asserts the wiring itself: matcher is `Write\|Edit\|Bash`; deleting or narrowing the hook block reds the suite and is visible in a commit. Proven non-vacuous by break-and-restore | unit | `cd .claude/mcp/vice && node --test audit-integrity.test.ts` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 4 | GATE-01 (criteria 1 & 2) | — | Real-tree plant-and-revert: `docs-linerefs.test.ts` reddened by a one-digit `vice-proxy.ts:<N>` change in CLAUDE.md (D-12-18); revert recorded as explicitly as the plant with the guard's own green output (D-12-20); `passed` and `tech_debt` both refused, `gaps_found` shown passing; artifact written with the Write tool, never a heredoc, to avoid self-blocking the live hook | manual, evidenced by committed transcript | `node scripts/audit-gate.mjs` run red then reverted-green, output captured verbatim | ❌ W0 — `12-GATE-PROOF.md` does not exist | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no 3 consecutive tasks lack an automated verify — the
two manual-evidence tasks (12-02-01, 12-04-01) are each adjacent to
automated-verify tasks. No watch-mode flags anywhere.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-21 (plan-checker: 0 blockers; Nyquist 8a-8d re-checked against the four PLAN.md files)
