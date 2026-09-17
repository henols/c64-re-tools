---
phase: "58"
slug: "one-declaration-four-places-that-can-no-longer-disagree"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-17"
---

# Phase 58 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register origin: **authored at plan time** — all three plans (`58-01`, `58-02`,
> `58-03`) carry a `<threat_model>` block, so this audit verifies declared
> mitigations rather than reconstructing a register retroactively.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| committed declaration → future consumer | `prerequisites.json` is first-party, committed, trusted data. The boundary that matters is the one Phases 60/61 cross when they read it: whatever shape a field gets here is the shape a later reader trusts. | Remedy strings, provenance grades, version floor |
| repository → published npm tarball | A file present in the repo is not thereby present in the package. The tarball's own file list is the only honest evidence across this boundary. | Packaged file manifest |
| workflow definition → GitHub Actions runner | A new CI job runs with whatever token scope it declares or inherits. | Repository contents, job token |
| repository claim → reader's decision | README prose and docs are what a user and a future agent act on. A false claim here is acted on with no signal, because nothing tests prose. | Install instructions, capability claims |
| Phase 58 hand-edit → Phase 62 generated output | The install table is hand-maintained today, generated later. An edit to a to-be-regenerated region is silently discarded. | README install table rows |
| committed document → filesystem | `auditProvenanceCitations()` takes a path string out of a markdown document and opens it. The only place in the phase where data chooses a file. | Ledger citation paths |
| test process → repository tree | Planted-fixture cases write and delete a temporary tree. Nothing writes inside the repository. | Temp fixture trees |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-58-01 | Elevation of Privilege | `prerequisites.json` remedy fields | high | mitigate | Every remedy is a bare JSON string; no key anywhere is a structured-command key. Structural, not documentary. | **closed** — `prerequisites.test.ts:317` (planted `argv` key rejected, non-vacuous) and `:327` (grep-shaped key census) both green |
| T-58-02 | Tampering (by omission) | `package.json` `files[]` and the published tarball | medium | mitigate | Tarball-list assertion reading `npm pack`'s own output, never a repo-path `existsSync`. | **closed** — `prerequisites.test.ts:356` green; `packedFileList()` (`:350`) runs `execFileSync("npm", ["pack","--dry-run","--json"])` in argv-array form, and the case contains zero `existsSync` calls |
| T-58-03 | Elevation of Privilege | the `decl-02-node18-proof` CI job | low | mitigate | Job declares `permissions: contents: read` explicitly — a deliberate deviation from `build`, which declares none. Installs nothing, needs no secrets, touches no publish path. | **closed** — `.github/workflows/ci.yml:279-280` carries the explicit scope; verified green on run `35270271098` |
| T-58-04 | Spoofing | remedy `source` citations | medium | mitigate | Validator resolves every `carried`/`measured` source path against the filesystem; every `authored` source must be an https URL. Line numbers deliberately not pinned (brittle assertions get disabled, not maintained). | **closed** — `prerequisites.test.ts:223` green |
| T-58-05 | Spoofing | `docs/phase58-declaration-provenance.md` citations | medium | mitigate | Every `path:line` extracted and its path resolved against the filesystem; unresolved paths fail. | **closed** — `phase58-citation-ledger.test.ts:240` green; plan 58-02's own `<verify>` caught and fixed one bad citation before commit (recorded in its Deviations) |
| T-58-06 | Tampering | `README.md:99-108` (the region Phase 62 will generate) | medium | mitigate | Table region extracted from HEAD and working tree and diffed; any difference fails, plus a changed-markdown-row count required to be zero. | **closed** — `58-02-SUMMARY.md` records the region byte-identical |
| T-58-07 | Repudiation | the rewritten README prose | medium | mitigate | The rewrite must cite `REQUIREMENTS.md` and name the declaration, both grep-asserted, plus a human check that the three statements of the same fact agree. | **closed** — re-measured this audit: `requirements_cite=1`, `declaration_named=1`, and the retracted `within-one-frame` claim is gone (`stale_claim=0`) |
| T-58-08 | Information Disclosure | none applicable | low | accept | Neither 58-02 deliverable handles input, secrets, credentials or user data. V2/V3/V4/V6 recorded as not applicable in `58-RESEARCH.md` § Security Domain rather than omitted. | **closed** (accepted) |
| T-58-06b | Tampering | `auditProvenanceCitations()` path resolution | low | mitigate | Every ledger `citation` path resolved against `repoRoot`; the resolved path must begin with `repoRoot` plus a separator. An escaping entry is reported and its file never opened. | **closed** — `phase58-citation-ledger.test.ts:286` green ("its file is never read") |
| T-58-07b | Denial of Service | planted-fixture temporary trees | low | mitigate | Every `mkdtempSync` fixture removed with `rmSync` in a `finally`. This host's `/tmp` is a RAM-backed tmpfs with ageing disabled, so a leaked fixture is leaked memory until reboot — cleanup is the mitigation, not hygiene. | **closed** — 12 `rmSync` against 11 `finally` blocks in `phase58-citation-ledger.test.ts` |
| T-58-08b | Information Disclosure | audit failure strings quoting file content | low | accept | Failure strings quote the anchor and the text at the cited range. All of it is already committed, publicly readable repository content, and a diagnostic that does not quote what it found is not usable. | **closed** (accepted) |
| T-58-09 | Elevation of Privilege | ledger fields shaped as executable input | low | mitigate | The ledger's two keys are `citation` and `anchor`; the parser rejects any element carrying a third key, so an `argv`-shaped field cannot be added without failing the guard. | **closed** — `phase58-citation-ledger.test.ts:107` enforces "must carry exactly the two keys" |
| T-58-SC | Tampering | npm/pip/cargo installs | low | accept | No package added to any dependency list and no install task exists in any of the three plans. The Package Legitimacy Gate has nothing to check — recorded as not applicable in `58-RESEARCH.md` rather than skipped silently. `actions/setup-node@v4` provisions a language runtime for CI and is already used four times in this workflow. | **closed** (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Threat-ID collision across plans — recorded, not silently merged

`58-02-PLAN.md` and `58-03-PLAN.md` each independently number a `T-58-06`,
`T-58-07` and `T-58-08`, and the two sets mean **different things** (58-02:
README-region tampering, README-prose repudiation, no-applicable-disclosure;
58-03: path-resolution tampering, fixture DoS, diagnostic-quoting disclosure).
The gap-closure plan 58-03 was authored after 58-02 and restarted the numbering
rather than continuing it. This audit disambiguates 58-03's three as `T-58-06b`,
`T-58-07b` and `T-58-08b` and verifies all six separately. Nothing was merged and
no mitigation was assumed to cover its same-numbered twin — a merge would have
silently dropped three verifications. The register is therefore 13 rows for 13
distinct threats, not 10.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-58-01 | T-58-08 | No input, secrets, credentials or user data handled by 58-02's deliverables; ASVS V2/V3/V4/V6 not applicable to a docs-and-prose change. | Phase 58 plan author | 2026-09-17 |
| R-58-02 | T-58-08b | Failure diagnostics quote only already-committed, publicly readable repository content; a diagnostic that hides what it found is not usable. | Phase 58 plan author | 2026-09-17 |
| R-58-03 | T-58-SC | No dependency added, no install task in any plan; guard uses `node:` built-ins only. Package Legitimacy Gate not triggered. | Phase 58 plan author | 2026-09-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-17 | 13 | 13 | 0 | `/gsd-secure-phase 58` (orchestrator, L1 verification) |

**Audit depth.** ASVS level 1, block threshold `high`. Exactly one threat is rated
`high` (`T-58-01`), and it is closed by two non-vacuous structural cases — the
planted-violation half is what makes the guard meaningful rather than
self-satisfying. With `threats_open: 0`, `register_authored_at_plan_time: true`
and `asvs_level == 1`, workflow §3's short-circuit applies: L1 grep-depth is
sufficient and the `gsd-security-auditor` subagent was deliberately not spawned.
Had the project been at ASVS L2+, that skip would not have been permitted.

**What was re-measured rather than taken from the summaries.** T-58-02's argv-array
and no-`existsSync` shape, T-58-03's `permissions:` block, T-58-07's three greps,
T-58-07b's `rmSync`/`finally` counts, and T-58-09's exactly-two-keys rejection were
all re-run against the working tree during this audit. T-58-06 is the one row
resting on a plan-time gate that cannot be re-run after the fact (a HEAD-vs-worktree
diff taken at execution time); its closure rests on `58-02-SUMMARY.md`'s record and
is marked as such rather than presented as freshly measured.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-17
