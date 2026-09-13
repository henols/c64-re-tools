---
phase: "48"
slug: "the-movement-hazard-report-and-its-purpose-built-subject"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-13"
---

# Phase 48 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

All six plans (48-01 through 48-06) authored a `<threat_model>` block at plan time, so
`register_authored_at_plan_time` is **true** and this audit verifies declared mitigations
rather than constructing a register retroactively. With `threats_open: 0` and
`asvs_level: 1`, the workflow's short-circuit applies: grep-depth (L1) verification is
sufficient and no deeper auditor pass was required.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator-supplied `.prg` / `.annostore` → the report | Untrusted by construction — the whole point is analysing a program nobody here wrote | Arbitrary binary bytes, arbitrary store rows |
| CLI argv → filesystem | `--store` and `--image` are operator-supplied path strings resolved against the workspace root | Path strings |
| the report module → the store | Asserted one-way: data flows in, nothing flows back | Read-only queries |
| committed fixture source → the assembler | Project-authored source text reaches an external binary | Source text, argv |
| the emitted tree → a real assembler | Reached only through the host-tool seam | Generated source files |
| the committed images → a real emulator | The only step in this phase where a program actually executes | Assembled machine code |
| the report's rendered output → a human deciding whether to move code | The consequential boundary: a reader acts on what this says | Findings, strengths, limits |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-48-01 | Tampering | `anno-hazard-report.ts` | high | mitigate | Structural source-text test reads the module's own source and fails on any write/store-open/xref-write/live-session substring. Re-grepped independently: 0 forbidden symbols | closed |
| T-48-02 | Denial of Service | decode + interval + detector walks | medium | mitigate | Every walk clamps at `0x10000`; no recursion, no `while (true)`, no walk-while-plausible loop. Re-grepped: 0 unbounded loops across 18 functions | closed |
| T-48-03 | Information disclosure | CLI `--store` / `--image` resolution | medium | mitigate | Existing workspace-confinement helper reused; `hostpath`/`containerpath` absent from the module. Re-grepped: 0 path-translation imports | closed |
| T-48-04 | Repudiation (false assurance) | rendered output, `CROSS-CHECK.md`, `FIXTURE-DESIGN.md` | high | mitigate | Three-inhabitant region outcome with no boolean field anywhere; always-emitted limits list; per-class no-independent-positive-example statements. 64/64 shape and crosscheck tests pass | closed |
| T-48-05 | Tampering | the committed `.prg` fixtures | medium | mitigate | The regenerator is the only writer and refuses partial writes; byte-compare on every suite run. Re-ran the regenerator: exit 0, **zero tree drift** | closed |
| T-48-06 | Tampering | `make-hazard-subject-fixtures.mjs` | medium | mitigate | All three assembler launches use the argv-array form; re-grepped: 0 occurrences of `shell: true`, no string-interpolated binary path. The file is not in `package.json` `files[]`, so it never joins the frozen shipped-spawn-site set | closed |
| T-48-07 | Spoofing (evidence) | planted variants, raster part, expectation table | high | mitigate | Constructions asserted at byte level rather than through a detector's opinion; expectations derived from committed source. Re-grepped: **no fixture source names any detector** | closed |
| T-48-08 | Repudiation (false assurance) | region-disposition machinery | high | mitigate | Runtime key enumeration refuses a boolean shape; all three outcome tokens proven reached by real fixtures, each undecided region carrying a non-empty cause | closed |
| T-48-09 | Tampering | the imported class-1 scanner | medium | mitigate | Exact call-site count test (1 declaration, exactly 2 call sites) fails on a third; the coverage module is absent from `files_modified` | closed |
| T-48-10 | Repudiation (false assurance) | the deliberately undetected self-modification | high | mitigate | Two-sided test asserts both the absence of the finding and the presence of the limit naming it | closed |
| T-48-11 | Information disclosure | committed store export comment text | medium | mitigate | Verify command greps the export for planning vocabulary and fails on any match | closed |
| T-48-12 | Tampering | the strength assignment | high | mitigate | Two-run finding-set identity test proves evidence strengthens only; source assertion bars never-observed arithmetic entirely | closed |
| T-48-13 | Tampering | the reassembly test's assembler invocation | high | mitigate | Reaches the assembler only through the compiled host-tool seam (`resources/host-tool.mjs`) behind the shared `acme-gate.ts`; re-grepped: **no direct spawn call in the test** | closed |
| T-48-14 | Information disclosure | the emitted tree | medium | mitigate | Every directive argument is a bare filename; re-grepped: **0 path separators inside directive string literals** | closed |
| T-48-15 | Denial of Service | the emulator runs in plan 48-06 task 3 | low | accept | Below the `high` block threshold. A stopped emulator is a known, diagnosable state with a dedicated triage playbook the task points at | closed |
| T-48-SC | Tampering | npm / pip / cargo installs | high | accept | Vacuous by construction, verified not merely asserted: across all 14 phase-48 commits the only `package.json` change is `+ "anno-hazard-report.ts"` in `files[]` — a ship-manifest entry. **Zero dependencies added, `package-lock.json` untouched** | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-48-01 | T-48-15 | An emulator that stops advancing is a known, diagnosable state, not a silent failure — the repository carries a dedicated wedge-triage playbook and the task points at it, so a stopped emulator is diagnosed rather than mistaken for a fixture defect. Severity `low`, below the `high` block threshold. No mitigation was built, deliberately | Henrik Olsson | 2026-09-13 |
| R-48-02 | T-48-SC | No package-manager install task exists anywhere in this phase, by an explicit requirements Out-of-Scope row. Confirmed against history rather than taken on trust: no phase-48 commit adds a dependency to either manifest. The supply-chain gate is vacuous by construction, not skipped | Henrik Olsson | 2026-09-13 |
| R-48-03 | T-48-02 (48-05 comparator only) | Plan 48-05 dispositions this threat `accept` at severity `low` for the comparator specifically: it walks two already-bounded address lists from an already-bounded report, introducing no new unbounded input. The same threat id is disposition `mitigate` and verified closed for the decoder and detector walks | Henrik Olsson | 2026-09-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 16 | 16 | 0 | /gsd-secure-phase (L1, orchestrator) |

**What this audit actually did.** Every `mitigate` disposition was re-checked against the
working tree rather than read back from the plan that declared it. Nine mitigations are
carried by tests that were executed on 2026-09-13 and passed (64/64 hazard-report, 36/36
fixture, 11/11 reassembly under real ACME). Seven were additionally re-grepped directly
from the source, independent of any test that claims the same thing: the forbidden-symbol
set in `anno-hazard-report.ts` (0 hits), the absence of `shell: true` at the assembler
launch, the absence of any detector name in the fixture sources, the absence of a path
separator in emitted directive literals, and the assembler route through
`resources/host-tool.mjs` rather than a direct spawn. The regenerator was re-run and
produced zero tree drift, which is the live proof behind T-48-05.

**Depth, stated plainly.** This is ASVS L1 — grep depth over a register authored at plan
time. It verifies that each declared mitigation is present. It does not attempt L2
boundary-placement analysis or L3 end-to-end trace analysis, and it did not scan for
threats outside the declared register.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-13
