---
phase: 17
slug: project-identity-and-ledger-close
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-23
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: `register_authored_at_plan_time: true` — all four PLAN files
(`17-01` … `17-04`) carried a parseable `<threat_model>` block, so this audit
**verifies the planned mitigations exist**; it does not scan for new threats.
ASVS level 1 (`workflow.security_asvs_level: 1`), block threshold
`workflow.security_block_on: high`.

**Scope note.** Phase 17 edited `.planning/` markdown and one test file
(`docs-deferred-ledger.test.ts`, plan 17-01). It ships no runtime code, no
endpoint, no auth path and no dependency. Every plan's threat model independently
assessed ASVS V2/V3/V4/V5/V6 (auth, session, access control, validation,
cryptography) as **not applicable**, and nothing in the executed diff changes
that. The asset at risk in this phase is **record integrity**, not
confidentiality — which is why the register is dominated by Repudiation and
Tampering rows.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo filesystem → guard process | The `docs-*.test.ts` guards read `.planning/*.md` and the todo directories through the pre-existing `repo-root.ts` seam. | Repo-local, already-public planning text. No network, process or user boundary. |
| human decision → written record | A verdict reached by a human at a `gate="blocking-human"` checkpoint is transcribed by an agent into a durable document; that transcription is what every future reader sees. **Fidelity and attribution are the asset.** | Decision provenance (who decided, on what basis) |
| completed session → durable planning record | A resolving session writes a provenance narrative no later reader can independently verify. The 2026-08-23 over-claim crossed exactly this boundary: an inference about a human's internal state entered a published record as observed fact. | Unverifiable claims about human state |
| planning record → future auditor / milestone | `/gsd-audit-milestone`, `/gsd-complete-milestone` and the next milestone's planners read these documents as ground truth and cannot re-derive them. | Milestone closure counts, requirement dispositions |
| this phase's own diff → the count it reports | The closure count is taken by the same run that produces the diff a later review scrutinises; a finding filed by that review lands *after* the count. | DEBT-04 close count |
| planning record → mechanical guard | `docs-*.test.ts` are the only automated readers of these documents; anything they do not assert propagates unchecked. | Guarded vs. unguarded assertions |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-17-01 | Tampering | `src/mcp/vice/docs-deferred-ledger.test.ts` | medium | mitigate | Non-vacuity teeth verified intact after the plan-17-01 widening: `completed.length >= 5` floor present at `:152`, planted-violation test present at `:195`, guard 6/6 green. A blanket weakening would have greened all predicates and failed the tracer's own gate. | closed |
| T-17-02 | Repudiation | `.planning/STATE.md` → `## Deferred Items` | medium | mitigate | Count is stated with its derivation and the `2 → 0` transition (`STATE.md:72`), not as a bare figure; guarded in both directions by `docs-deferred-ledger.test.ts` (6/6). Live recount: `.planning/todos/pending/*.md` = 0, agreeing with the record. | closed |
| T-17-03 | Information disclosure | guard filesystem reads | low | accept | Reads only repo-local planning documents through the pre-existing `repo-root.ts` seam. See Accepted Risks R-01. | closed |
| T-17-04 | Spoofing | the CORE-01 verdict's provenance | medium | mitigate | `gate="blocking-human"` on 17-02 task 1 (auto-mode does not bypass it); the written entry names the checkpoint, so the claim is falsifiable against the execution log. **Exercised in anger:** the claim was challenged at UAT, the primary transcript was recovered, and the gate was confirmed rendered 08:32:48Z / answered 08:37:46Z. The control worked as designed. | closed |
| T-17-05 | Repudiation | `.planning/PROJECT.md` → `## Core Value` | medium | mitigate | ISO date `2026-08-23`, named evidence (`sealed-question`), `blocking-human` provenance and a specific `*Reversal.*` clause all present in the section; pinned mechanically by `docs-core-value-decision.test.ts` (6/6). | closed |
| T-17-06 | Tampering | `src/mcp/vice/docs-core-value-decision.test.ts` | low | mitigate | Planted-violation convention carried into the guard as test 6 (`:206`), demonstrated live during 17-02 (date-stripped PROJECT.md → exit 1, then reverted). Guard is not vacuous. | closed |
| T-17-07 | Information disclosure | guard filesystem reads | low | accept | One repo-local planning document via a pre-existing seam. See Accepted Risks R-01. | closed |
| T-17-08 | Repudiation | the DEBT-04 close count | medium | mitigate | Recount taken after every edit the phase made (pending = 0, re-verified live in this audit), and the residual window is disclosed rather than hidden: `/gsd-audit-milestone` is named as the backstop in `STATE.md:879,886`. | closed |
| T-17-09 | Tampering | `.planning/REQUIREMENTS.md` closure record | medium | mitigate | Both closure-note blockquotes present (`:198` DEBT-04, `:222` CORE-01), each naming its guard or stating plainly that none exists; 16/16 Traceability rows Complete, 0 open. | closed |
| T-17-10 | Denial of service | the phase gate | low | accept | Full `npm test` (~2 min, ~2395 tests) deliberately preferred over `npm run test:automated`. See Accepted Risks R-02. | closed |
| T-17-11 | Information disclosure | planning documents | low | accept | Every file touched is already committed to a public repository. See Accepted Risks R-03. | closed |
| T-17-SC | Tampering | npm/pip/cargo installs | low | accept | No plan in this phase installs a package or adds a dependency; supply chain untouched. Confirmed: `git diff HEAD -- src/` clean, no lockfile change. See Accepted Risks R-04. | closed |
| T-17-04-01 | Repudiation | `PROJECT.md` `## Core Value` → `*Provenance.*` | medium | mitigate | The canonical paragraph now separates evidenced claims (attendance, delegation, verdict) from the unevidenced one, and states explicitly that "comprehension is not evidenced by any artifact and is not claimed here" (1 match, verified live). | closed |
| T-17-04-02 | Tampering | the six downstream re-transcriptions | medium | mitigate | Cross-document **absence** gate re-run live over all seven files: the comprehension-claim family returns **0** matches (measured baseline 16). **Presence** gate re-run per file: `blocking-human`, a `delegat` stem and `you decide` are all non-zero in every one of the seven. | closed |
| T-17-04-03 | Tampering | `src/mcp/vice/docs-core-value-decision.test.ts` | medium | mitigate | The guard was not weakened to fit the rewritten documents: `git diff --quiet HEAD -- src/` passes, last touch is `ab9a28a` (a 17-02-era CR-01 anchoring fix, predating the 17-04 rewrite), and the guard is 6/6 green against the corrected text. The provenance predicate the operator declined was correctly not added. | closed |
| T-17-04-04 | Information disclosure | primary session transcript under `~/.claude/projects/` | low | accept | The corrected record cites the debug session, not the machine-local `.jsonl` path. See Accepted Risks R-05. | closed |
| T-17-04-05 | Denial of service | `docs-review-disposition.test.ts` disposition anchors | low | mitigate | No `CR-`/`WR-`/`IN-` token was dropped by the seven-document rewrite: `docs-review-disposition.test.ts` 7/7 green against the final state. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

No threat in this phase is rated `high` or `critical`, so nothing trips
`security_block_on: high` even before mitigation. All 17 rows are closed:
11 mitigations verified with evidence, 6 documented accepted risks.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-17-03, T-17-07 | Guard filesystem reads touch only `.planning/*.md` and two repo-local directory listings, resolved through the pre-existing `repo-root.ts` seam. No secret, no user input, no path from outside the repository. Accepted with no control. | Phase 17 plans 17-01 / 17-02 (planning-time disposition) | 2026-08-23 |
| R-02 | T-17-10 | The ~2-minute full `npm test` gate is accepted over the faster `npm run test:automated`, which skips nine suites and has hidden CI failures on this project before. Slowness accepted deliberately rather than optimised away. | Phase 17 plan 17-03 (planning-time disposition) | 2026-08-23 |
| R-03 | T-17-11 | Every file written is a repo-local planning document already committed to a public repository; closure notes cite plan numbers, commits and test names only. | Phase 17 plan 17-03 (planning-time disposition) | 2026-08-23 |
| R-04 | T-17-SC | No plan installs a package or adds a dependency, so no package-legitimacy checkpoint applies. Supply chain untouched. | Phase 17 plans 17-01 / 17-02 / 17-03 (planning-time disposition) | 2026-08-23 |
| R-05 | T-17-04-04 | The corrected provenance record cites `.planning/debug/core-01-provenance-overstates-human-involvement.md`, not the machine-local `~/.claude/projects/**.jsonl` transcript path, and quotes only the four-character answer string already published. The debug session carries the path for one-time diagnosis and is not re-published. | Phase 17 plan 17-04 (planning-time disposition) | 2026-08-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-23 | 17 | 17 | 0 | /gsd-secure-phase 17 (verify:post step hook, orchestrator-verified at ASVS L1) |

**Method.** Register assembled from the four PLAN `<threat_model>` blocks plus
`17-04-SUMMARY.md`'s `## Threat Flags` (which records none). Because
`threats_open` evaluated to 0 with `register_authored_at_plan_time: true` at
ASVS L1, the workflow's short-circuit rule applied and no `gsd-security-auditor`
subagent was spawned — L1 grep-depth verification is sufficient at this level.
Every `mitigate` row above was checked live against the working tree during this
audit rather than accepted from the plan's own claim; the commands and their
results are named in each Mitigation cell.

**Guard set at audit time:** `docs-core-value-decision` 6/6 ·
`docs-dangling-refs` 8/8 · `docs-deferred-ledger` 6/6 · `docs-fork-decision` 6/6 ·
`docs-linerefs` 3/3 · `docs-review-disposition` 7/7 — all exit 0.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-23
