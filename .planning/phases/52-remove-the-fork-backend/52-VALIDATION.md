---
phase: "52"
slug: "remove-the-fork-backend"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-11"
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `52-RESEARCH.md` § Validation Architecture. The
> Per-Task Verification Map is deliberately empty until plans exist —
> `/gsd-validate-phase` fills it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — invocation is via `src/mcp/vice/package.json` scripts (`test`, `test:automated`, `test:manual`) plus `test-gate.mjs`'s own file-list logic |
| **Quick run command** | `cd src/mcp/vice && node --test <the one file the task touched>.test.ts; echo "EXIT=$?"` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated > /tmp/floor.log 2>&1; echo "EXIT=$?"` |
| **Estimated runtime** | quick ~seconds; `test:automated` ~minutes |

**Two hazards this phase must not trip (both measured, both previously cost a wrong
conclusion in this repo):**

1. `npm test` on the full glob **hangs** — it blocks forever on `vice-proxy.test.ts`.
   `npm run test:automated` is the gate. Never propose the full glob as a verify command.
2. Piping the run (`| tail`, `| grep`) reports the **pipe's** exit code, faking a green
   baseline. Redirect to a file and read `$?` **on the same line**, as the full suite
   command above does.
3. A **live vice broker reddens one test deterministically** (not a flake). Confirm no
   broker is running before trusting any suite result.

---

## Sampling Rate

- **After every task commit:** the single-file quick command for the file the task touched
  (e.g. `node --test vice-proxy.test.ts` after a `vice-proxy.ts` edit)
- **After every plan wave:** `npm run test:automated`, with the **failure set** compared
  against the pre-phase floor — never the failure *count*
- **Before `/gsd-verify-work`:** full `test:automated` green at the documented floor, plus
  `npm run typecheck` (the project's configured build command)
- **Max feedback latency:** single-file run, seconds

**"Green at the floor" is a failure-SET comparison, not a count.** The floor is 3 failures
plus 2 named flakes that sit outside those files (re-confirmed live during research,
2026-09-11). A run with the same count but a different member is a regression; a run with a
different count whose new members are the known flakes is not. Any `<fails_when>` written
for the suite must say this.

---

## Per-Task Verification Map

*Empty by design — plans do not exist yet. `/gsd-validate-phase` populates this table once
`52-*-PLAN.md` files are written.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | — | — | — | — | — | — | ⬜ pending |

### Criterion-level map (seed, from research — 1:1 with the 7 success criteria)

Requirement IDs are TBD at plan time; this maps success **criteria** until the planner mints them.

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|--------------------|--------------|
| 1 | No backend-selection code or tests remain | structural (grep) | `grep -rac '"fork"' src/mcp/vice/*.ts src/mcp/vice/*.mts \| awk -F: '$2>0'` (expect empty) | ✅ grep-based, no new file |
| 2 | `FORK-01` row reversed, guard repointed | unit | `cd src/mcp/vice && node --test docs-fork-decision.test.ts` | ✅ exists, needs rewrite |
| 3 | Three hard losses recorded as ACCEPTED | doc-presence | `grep -ac "SID read-back\|matrix keyboard\|RESTORE" <chosen doc>` | ❌ **Wave 0 gap** — the record does not exist yet |
| 4 | `DENY_LIST` gone, `anno-tools.ts` UNCHANGED | unit + diff | `git diff --stat src/mcp/vice/anno-tools.ts` (expect empty) + `node --test anno-tools.test.ts` | ✅ existing |
| 5 | `capability-registry.ts` resolved by decision | structural | asserts absence, or asserts the repurposed content — depends on the recorded decision | ❌ depends on the Wave-4 decision |
| 6 | One manifest only | structural | `test ! -f src/mcp/vice/tools-manifest.json; echo "EXIT=$?"` | ✅ trivial |
| 7 | Test floor green | full automated run | the full suite command above, failure-SET compared | ✅ `test-gate.mjs` |

**Note the `grep -a` in criteria 1 and 3.** A NUL byte in `anno-memmap-render.ts` hides it
from plain `grep`; a census without `-a` silently skips that file and has already produced
one wrong decision in this repo.

---

## Wave 0 Requirements

- [ ] **The criterion-3 permanent-acceptance record does not exist yet** as a file or
      section. Wave 0 must create it. The text to reuse is already in the tree:
      `capability-registry.ts`'s six `"hardware"` entries carry, verbatim, the technical
      evidence (SID write-only in hardware; CIA recompute-on-read; no NMI wire command).
      Reuse that wording — a hand-rewrite risks garbling it. **Where it lives is an open
      decision** (see `52-RESEARCH.md` Open Question 2).
- [ ] **`scripts/check-skill-fork-honesty.mjs` asserts the OPPOSITE of this phase's goal**
      today — it derives its policed tool-name list from `capability-registry.ts` and
      hard-asserts `README.md` contains `VICE_BACKEND` / fork-tool strings. It needs
      **inverting**, not deletion, and not manual grep in its place.
- [ ] Framework install: **none needed** — `node --test` is already in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skill prose reads as a *stated permanent limitation* rather than a dead fork route | criterion 3 | A grep can prove the phrase "requires the fork" is absent; it cannot prove the replacement sentence is true and useful to a reader | Read each of the 9 rewritten sites (listed in `52-RESEARCH.md` §5) and confirm each states what is permanently unavailable and why, not merely that a tool is missing |
| The reversal's paper trail reads as current | criterion 2 | The superseded `retain` disposition in `.planning/todos/completed/` must not still read as the current answer; that is a reading judgement, not a string match | Read `PROJECT.md`'s amended `FORK-01` row, its `### Out of Scope` bullet, and the superseded todo together and confirm no one of them contradicts the others |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` naming an observable signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the criterion-3 record; the inverted honesty gate)
- [ ] No watch-mode flags
- [ ] No piped suite command (exit code must be read on the same line)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
