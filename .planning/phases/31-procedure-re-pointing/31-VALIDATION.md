---
phase: 31
slug: procedure-re-pointing
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `31-RESEARCH.md` § Validation Architecture (measured live, 2026-08-31).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`), Node ≥ 22.18 — no external framework |
| **Config file** | none — `src/mcp/vice/test-gate.mjs` is the automated-subset seam; `src/mcp/vice/tsconfig.json` for typecheck |
| **Quick run command** | `cd src/mcp/vice && node --test skill-attribution.test.ts anno-derivation.test.ts skill-description-overlap.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~0.5 s (quick, 53 tests) / ~47 s (full, 2918 tests) |
| **Gate ladder (non-test)** | `node scripts/check-no-analyser.mjs`, `check-skill-description-overlap.mjs`, `check-skill-tool-coverage.mjs`, `check-skill-fork-honesty.mjs`, `check-skill-cli-invocations.mjs`, `check-npm-packages.mjs` |

**Measured baseline, 2026-08-31:** 2918 tests / **0 fail** / exit 0 / ~47 s. Typecheck exit 0.
All seven CI gate scripts exit 0.
**The clean floor is 0 failures, and `test:automated` carries NO failure baseline in
`test-gate.mjs`.** Any red this phase introduces is this phase's.

**Standing hazards (project memory — honour all three):**
- A **live VICE broker reddens the BACK-05 test deterministically.** `systemctl --user is-active
  vice-broker` must read `inactive` before any suite result is trusted. It is not a flake.
- `npm test` (full glob) **blocks forever** on `vice-proxy.test.ts` under a bash timeout. Use
  `npm run test:automated` — never the bare full glob — for both per-task and wave sampling.
- **Do not name any new test file `docs-*.test.ts`** — it joins `audit-gate.mjs`'s globbed guard
  set and reds `audit-integrity.test.ts`. This phase extends an existing test file instead.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && node --test skill-attribution.test.ts anno-derivation.test.ts skill-description-overlap.test.ts`
  **plus** `node scripts/check-no-analyser.mjs`
- **After every plan wave:** `cd src/mcp/vice && npm run typecheck && npm run test:automated`,
  then the full gate ladder above
- **Before `/gsd-verify-work` (phase gate):** full suite green at **0 failures** with **no VICE
  broker running**, plus the whole gate ladder
- **Max feedback latency:** 47 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is completed against `*-PLAN.md` at execution
time. The requirement→behaviour rows below are the **contract** each task's `<verify>` must
satisfy.

| Behaviour | Req | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----------|-----|------------|-----------|-------------------|-------------|--------|
| The `ABS-02` chain is intact: 5 blocks / 3 files / 6 fields / digest equality / adaptation statement, over `src/skills` | REPOINT-03 | licence-obligation-dropped | unit | `node --test skill-attribution.test.ts` | ✅ `src/mcp/vice/skill-attribution.test.ts` | ⬜ pending |
| **10 instances across two trees, each with its two naming lines byte-identical** | REPOINT-03 | licence-obligation-dropped | unit | `node --test skill-attribution.test.ts` (NEW assertion) | ❌ **W0** — no assertion covers this claim today | ⬜ pending |
| Deleting an attribution header FAILS rather than silences (both trees, block + hit pins) | REPOINT-03 | exemption-widening | integration | `node scripts/check-no-analyser.mjs` | ✅ + `removal-gate.test.ts` | ⬜ pending |
| The twin tree carries the same headers, proven against the **shipped** copy | REPOINT-03 | licence-obligation-dropped | integration | `node scripts/check-npm-packages.mjs` | ✅ `scripts/check-npm-packages.mjs` | ⬜ pending |
| `description:` is substantively rewritten (names the annotation store, not the analyser) | REPOINT-03 | — | **manual-only** | — | ⚠️ human judgment | ⬜ pending |
| `ABS-03`'s pairwise trigger-collision check passes over all seven descriptions | REPOINT-03 | — | integration | `node scripts/check-skill-description-overlap.mjs` | ✅ + `skill-description-overlap.test.ts` | ⬜ pending |
| CLAUDE.md's project-skills table stays byte-identical to every `description:` | REPOINT-03 | record-answering-twice | integration | same command | ✅ | ⬜ pending |
| Manifest schema survives the edit (pin shape, 5 procedures, known dispositions, licence, triggers with mechanisms) | REPOINT-04 | input-validation-weakened | unit | `node --test anno-derivation.test.ts` | ✅ `src/mcp/vice/anno-derivation.test.ts` | ⬜ pending |
| Every non-curated call still carries a justification **and** a citation naming a file line | REPOINT-04 | record-answering-twice | unit | same | ✅ (`:144-222`) | ⬜ pending |
| `anno_undo`'s `requirement_id` is a well-formed requirement id | REPOINT-04 | input-validation-weakened | unit | same | ✅ (`:207-213`) — optional field, shape-gated | ⬜ pending |
| The omission is **not reversed**: `omit` verbs absent under any spelling; manifest ↔ surface agree both directions | REPOINT-04 | record-answering-twice | unit | same (`derivationVerdict`, `:405-425`, `:451-478`) | ✅ | ⬜ pending |
| Manifest ↔ attribution-header agreement survives the edit (procedure count, path set, digests) | REPOINT-04 | pin-recomputed | unit | `node --test skill-attribution.test.ts` (`:419-459`, `:475-507`) | ✅ | ⬜ pending |
| The manifest is edited **in the same commit** as what it describes | REPOINT-04 | record-answering-twice | **manual-only** | `git show --stat <sha>` | ⚠️ **no mechanical enforcement exists** (Finding 6) | ⬜ pending |
| No manifest prose names a deleted module or symbol | REPOINT-04 | — | integration | `grep -n "anno-tools\|anno-session\|anno-upstream-audit\|CURATED_ANNO_TOOLS" <manifest>` → 0 | ❌ **W0 (optional)** — plan-level criterion at minimum | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`src/mcp/vice/skill-attribution.test.ts`** — a new test scoring `REPOINT-03`'s "10
      instances across two trees, each with its two naming lines byte-identical". Must: walk
      **both** `src/skills` and `installer/skills`; pin the two naming lines as named constants
      with a comment saying they are *the* naming lines; assert **relations plus a floor**
      (`src === installer`, `adapted === repository`, `>= 5` per tree) — never a growing exact
      literal; carry an **in-memory** planted violation proving the predicate bites; and **not**
      assert adjacency of the two lines (one block orders them non-adjacently —
      `c64-program-recon/SKILL.md:571` vs `:577`).
- [ ] *(optional)* A grep-shaped assertion — or, at minimum, a plan-level acceptance criterion —
      that the manifest names no deleted module or symbol. The manifest has **no mechanical
      reader for its prose**, which is precisely why the drift survived Phase 29 in full.
- [ ] Framework install: **none needed.**

*Nothing else is missing: every other clause of both requirements is already covered by an
existing, currently-green instrument.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `routine-queue-walker`'s `description:` was rewritten **substantively** rather than worked around | REPOINT-03 | "Substantively" is editorial. No test can assert substance — only that the text differs and that the analyser is unnamed | Read `src/skills/routine-queue-walker/SKILL.md:3`; confirm it names the annotation store and names no analyser; cross-read 29-09-SUMMARY.md's record of the rewrite |
| The manifest is updated in the **same commit** that changes what it describes | REPOINT-04 | No diff-based check exists anywhere in the repo (Finding 6). The `anno-derivation.test.ts` state invariant forces co-change only for what it can *see*, and it cannot see prose | `git show --stat <sha>` must list the manifest and the re-pointed subject in one commit. The plan must **obey** this, not build enforcement for it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 47s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
