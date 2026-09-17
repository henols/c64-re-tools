---
phase: "58"
slug: "one-declaration-four-places-that-can-no-longer-disagree"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-17"
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `58-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled once plans exist (validate-phase §6).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (no separate framework; project-wide convention) |
| **Config file** | none — `src/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` list governs which colocated `*.test.ts` files the automated gate excludes. A new `prerequisites.test.ts` needs no host dependency and terminates in milliseconds, so it must **not** be added to that list |
| **Quick run command** | `cd src/mcp/vice && node --test prerequisites.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~1 second quick · full automated gate per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run `cd src/mcp/vice && node --test prerequisites.test.ts`
- **After every plan wave:** Run `cd src/mcp/vice && npm run test:automated` **plus** `node scripts/check-npm-packages.mjs` (DECL-05 lives outside `npm test`)
- **Before `/gsd-verify-work`:** Full suite green, `check-npm-packages.mjs` green, and the new CI matrix cell green
- **Max feedback latency:** 5 seconds for the quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {58-NN-NN} | {NN} | {N} | DECL-01 | — | N/A | unit | `cd src/mcp/vice && node --test prerequisites.test.ts` | ❌ W0 | ⬜ pending |
| {58-NN-NN} | {NN} | {N} | DECL-02 | — | N/A | integration (CI) | `actions/setup-node@v4` node-version 18 + `node -e "JSON.parse(...)"` | ❌ W0 | ⬜ pending |
| {58-NN-NN} | {NN} | {N} | DECL-04 | — | N/A | unit (non-vacuous, planted violation) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ❌ W0 | ⬜ pending |
| {58-NN-NN} | {NN} | {N} | DECL-05 | T-58-01 | Packaging omission cannot ship silently | build-gate | `node scripts/check-npm-packages.mjs` | ❌ W0 | ⬜ pending |
| {58-NN-NN} | {NN} | {N} | DECL-01 (D-09) | T-58-02 | Every remedy is a bare string; no `argv`/`cmd`/`args` key anywhere | unit (structural) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders until plans are written — validate-phase §6 binds them.*

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/prerequisites.json` — the declaration itself; every other artifact in this phase depends on it
- [ ] `src/mcp/vice/prerequisites.test.ts` — stubs for DECL-01, DECL-04, and D-09's no-argv structural assertion
- [ ] New assertion block in `scripts/check-npm-packages.mjs` — DECL-05
- [ ] New CI step in `.github/workflows/ci.yml` (`actions/setup-node@v4`, `node-version: "18"`) — DECL-02
- [ ] `docs/phase58-declaration-provenance.md` — not a test, but a required deliverable (D-04) cited by D-05's worked example and by the c1541/petcat carried-remedy case

*No test framework install is required — `node --test` is already the project convention.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The Node-18 CI matrix cell actually runs green on a GitHub Actions runner | DECL-02 | The evidence D-14/D-15 require is the real runner environment; a local run proves the JSON parses under Node 18 but not that the workflow cell is wired correctly | Push the branch, open the Actions run, confirm the new node-18 cell is present and green. Local pre-check: `nvm exec 18 node -e 'JSON.parse(require("fs").readFileSync("src/mcp/vice/prerequisites.json","utf8"))'` (Node v18.20.8 verified available on this host) |
| Every remedy string traces to a named existing source | Success criterion 5 | Provenance is a human judgement about whether a quoted source says what the declaration claims; no assertion can check that a citation is honest | Read `docs/phase58-declaration-provenance.md` against the cited `file:line` for each record, and confirm every disagreement between sources records a chosen-and-why |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
