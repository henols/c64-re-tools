---
phase: "50"
slug: "equivalence-and-modifiability"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-16"
---

# Phase 50 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: **authored at plan time**. All eight of this phase's PLAN files
carried a parseable `<threat_model>` block, so this audit verifies that the
declared mitigations exist rather than reconstructing a register retroactively.
Twenty-three distinct threats were declared across the eight plans (several
recur across plans and are consolidated here under their first-declared id).

Depth: ASVS level 1 (grep-depth verification), blocking threshold `high`.
Because `threats_open` reached 0 with a plan-time register at L1, the
short-circuit in `secure-phase.md` §3 applied and no deeper auditor pass was
required.

---

## Trust Boundaries

Consolidated from the eight plans' declared boundaries.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer CLI argv → `compare-cross-binary.mjs` | Caller-supplied file paths and an allowlist document cross into the comparison module | Local file paths; capture bytes |
| committed allowlist JSON → verdict | A document that can make a real difference stop failing crosses into the decision | Intentional-difference ranges + justification |
| committed volatile mask → verdict | A mask narrowed after seeing results would hide a real regression | Address spans + hardware reasons |
| `ACME_BIN` environment value → `spawnSync` | An externally supplied binary name reaches a process start in both generators | Process argv |
| generated `.prg` / `.annostore.json` → downstream tests | A fixture drifting from its source silently becomes ground truth | Assembled binary bytes |
| enumerated subject id → host filesystem | The load path resolves a file for a running emulator | Table id only, never a path |
| committed `.prg` → running emulator | Program bytes cross into a machine that executes them | 6510 machine code |
| live emulator output → committed transcript | A value nothing re-derives crosses into the evidence of record | Capture bytes, exit statuses |
| committed transcript → a reader's conclusion | A stale document crosses into a claim that the pipeline currently passes | Digests, subject references |
| committed manifest → assembled bytes | A pre-registration edited after the assembler runs turns acceptance into a rubber stamp | Declared byte values |
| deliberate break → the committed tree | A break introduced to observe a failure can survive the observation | Source edits |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-50-01 | Information disclosure | `compare-cross-binary.mjs` path arguments | low | accept | Developer-invoked CLI reads only paths it is handed and writes no file. Residual accepted. | closed |
| T-50-02 | Tampering | the intentional-difference allowlist | high | mitigate | Non-empty `why` enforced (`compare-cross-binary.mjs:247-249`); entry overlapping a masked span refused (`:260`); `--no-allowlist` red control (`:377`) | closed |
| T-50-03 | Tampering | committed transcripts | medium | mitigate | `phase50-transcript-freshness.test.ts` refuses digest drift, orphaned references, a green section with no paired red, and an empty set. Re-run 2026-09-16: 11/11 pass. | closed |
| T-50-04 | Tampering | the narrowed volatile mask | high | mitigate | `MASK_NARROWED_AT:` stamped into every report (`:451`); mask committed in plan 50-01 (`95a53730`) **before** the first capture landed in 50-04 (`700c147a`) | closed |
| T-50-05 | Elevation of privilege | `spawnSync(ACME_BIN, [...])` in both generators | high | mitigate | Every call site uses the argv-array form; no `shell: true` anywhere in the phase's files; binary path never interpolated | closed |
| T-50-06 | Tampering | committed `.prg` / `.annostore.json` | medium | mitigate | Artifacts stay generator-produced; byte-identical re-derivation asserted rather than trusted | closed |
| T-50-07 | Denial of service | absent ACME assembler | low | accept | `acmeSkipReasonFor()` probes and skips by name; no auto-install, per the project's standing constraint. Residual accepted. | closed |
| T-50-08 | Repudiation | findings documents | medium | mitigate | Each findings doc carries 8 cited `evidence/` references; the verdict is recomputed through `runReassemblyGate()` rather than asserted | closed |
| T-50-09 | Tampering | the single sanctioned assembler launch | high | mitigate | Assembler reached only via `verifyAcmeAssemblesTree()`. See deviation note below. | closed |
| T-50-10 | Elevation of privilege | the chosen load route | high | mitigate | Route-D (text-monitor `load`) adds no capability beyond the advertised surface; subject resolved from a frozen table, never a caller path | closed |
| T-50-11 | Tampering | snapshot and capture file paths | medium | mitigate | `capture-run.mjs` derives `OUT_DIR` from its own location; subject id validated against the closed set. See deviation note below. | closed |
| T-50-12 | Denial of service | a wedged or crashed emulator | medium | mitigate | Checkpoints enumerated and removed per capture — `vice_checkpoint_list` → `vice_checkpoint_delete` → `vice_checkpoint_list` recorded in `run-exported-edit.log.json:94,175,185`; emulator run as a systemd unit and stopped | closed |
| T-50-13 | Tampering | the deliberate break in 50-07 task 3 | medium | mitigate | Break reverted; 50-07 SUMMARY records a clean `git status --porcelain`; freshness guard green on re-run 2026-09-16 | closed |
| T-50-14 | Information disclosure | `docs/phase50-ci-boundary.md` | low | accept | Names only paths, commands and workflow steps already public in this repository. Residual accepted. | closed |
| T-50-15 | Tampering | `exported-edit.manifest.json` | high | mitigate | `make-exported-edit.mjs:259-263` refuses when a declared `from` disagrees with the committed image, before any patch; refusal case observed in `hazard-subject-exported-edit.test.ts:118` | closed |
| T-50-16 | Tampering | `hazard-subject-exported-edit.prg` | medium | mitigate | `hazard-subject-exported-edit.test.ts:105` re-derives the binary from the committed store plus manifest and asserts byte-identity with the committed file | closed |
| T-50-17 | Elevation of privilege | `HAZARD_SUBJECT_PRG_RELPATHS` | high | mitigate | `Object.freeze`d table of reviewed literal rows; `HazardSubjectId` is the only thing a caller names; closure asserted in `text-protocol.test.ts:175` and `text-tools.test.ts:1295` | closed |
| T-50-18 | Tampering | the pre-registered allowlist | high | mitigate | `hazard-subject-modified.allowlist.json` has exactly one commit in its whole history (`ca02a89c`, plan 50-03) — provably unchanged by plan 50-08 | closed |
| T-50-19 | Repudiation | the exported-edit gate verdict | medium | mitigate | Outcome lines printed as bare column-0 `NAME: value` records (`reassembly-gate-exported-edit-run.test.ts:402-407`); frontmatter values transcribed from cited evidence lines | closed |
| T-50-20 | Tampering | `docs/phase50-exported-modifiability-transcript.md` | medium | mitigate | Freshness guard recomputes every recorded subject digest and pins the committed transcript set, so a third transcript cannot land unnoticed | closed |
| T-50-21 | Denial of service | the live capture session | low | accept | A broker dying mid-capture yields no capture rather than a wrong one; the task refuses to synthesise one. Residual is a wasted developer session. | closed |
| T-50-22 | Information disclosure | the committed evidence tree | low | accept | Every artifact is a synthetic fixture this project authored; no copyrighted image, no host secret. Residual accepted. | closed |
| T-50-SC | Tampering | npm/pip/cargo installs | high | accept | This phase installs no package. A diff scan across every phase-50 commit found no added install command; the only textual match is a doc line stating non-applicability. Surface absent, so residual is zero. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Verified deviations

Two mitigations were implemented differently from their plan-time wording. Both
are recorded here rather than silently passed, and neither leaves its threat
open.

**T-50-09** — plan 50-03 promised "a `grep` check asserts the new file contains
no process-launch call". The shipped `reassembly-gate-modified-run.test.ts` does
contain one process launch, at line 562: `spawnSync(process.execPath, [CROSS_BINARY_SCRIPT, ...])`.
The threat's substance is nevertheless intact — that launch starts *Node* on the
comparison script, not the assembler, and `compare-cross-binary.mjs` was
confirmed to contain no `child_process`, `spawn`, `exec`, or network import at
all, so it cannot reach an assembler transitively. The assembler is still
reached only through `verifyAcmeAssemblesTree()`. The deviation is documented
in-code at lines 439-451 with the cross-package-import constraint that forces
the subprocess form. Verified, not assumed.

**T-50-11** — the plan wording was "never to a caller-named absolute path", but
`capture-run.mjs:80` accepts an optional `--out-dir` override. This is a
developer-invoked evidence script under the phase's own evidence directory, not
a shipped MCP tool, and its default is derived from the script's own location.
The residual is the same one T-50-01 already accepts explicitly — a
developer-invoked CLI writing where the developer names. Below the `high`
blocking threshold and consistent with the register's own accepted disposition.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-50-01 | T-50-01 | A developer-invoked CLI reading a file the developer names is not a boundary crossing worth a guard. The module writes no file. | Plan 50-01 threat model | 2026-09-15 |
| R-50-02 | T-50-07 | Both generators probe for ACME and refuse by name with the remedy. No auto-install, per the project's standing never-auto-install constraint. | Plan 50-02 threat model | 2026-09-15 |
| R-50-03 | T-50-14 | `docs/phase50-ci-boundary.md` restates only public repository structure. | Plan 50-07 threat model | 2026-09-16 |
| R-50-04 | T-50-21 | A broker dying mid-capture yields no capture rather than a wrong one; synthesising one is refused. Residual is a wasted session. | Plan 50-08 threat model | 2026-09-16 |
| R-50-05 | T-50-22 | Every committed artifact is a synthetic fixture this project authored — no copyrighted image, no host-specific secret. | Plan 50-08 threat model | 2026-09-16 |
| R-50-06 | T-50-SC | The phase introduces no package install of any kind, so the supply-chain surface is absent rather than guarded. Confirmed by a diff scan over every phase-50 commit. | All eight plan threat models | 2026-09-16 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-16 | 23 | 23 | 0 | /gsd-secure-phase (orchestrator, ASVS L1 grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-16
