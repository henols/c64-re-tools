---
phase: "38"
slug: "proof-01-03-on-real-cracked-code"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-06"
---

# Phase 38 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: **authored at plan time**. All four plans (`38-01` … `38-04`)
carry a parseable `<threat_model>` block, so this audit *verifies mitigations
exist* — it does not retroactively scan for new threats. Eight distinct threat
IDs appear across the four registers; where the same ID recurs in more than one
plan with a different component or severity, the strictest severity is carried
here and every occurrence is verified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator corpus → evidence driver / enumerator | Untrusted binary corpus material (`danish.d64`, gitignored, operator-supplied) crosses into a measurement script or byte scanner | Raw cracked-release disk image bytes (untrusted) |
| evidence driver → host-tool seam → dxa / Ghidra JVM | The only sanctioned route from container-side/analysis code to a host binary; argv is typed and allowlisted, never constructed from corpus content | Typed tool arguments + file paths (no corpus-derived argv) |
| committed fixture → driver | The real `analyzeHeadless` export text crosses into a parser; git-tracked and digest-asserted, not operator-supplied | Ghidra export text (trusted, digest-pinned) |
| scratch tree → committed tree | A deliberately mutated copy of a shipped module exists during the `38-02` run; it must never cross back | Mutated `anno-join.ts` / `anno-bank.ts` source (must not propagate) |
| operator corpus → emulator | `38-04` autostarts the gitignored corpus in a real `x64sc` — the only plan in the phase that *executes* corpus content | Executed 6510 code (untrusted) |
| emulator → capture → analysis | A flat-64K image derived from a running machine crosses into a byte scanner and then the Ghidra JVM | 64KiB RAM image (untrusted, digest-tracked) |
| task-scoped broker → host | `capture-pair.mjs` starts and owns a broker with state under its own probe directory; it must be down before any suite result is trusted | Broker control-plane session, emulator processes |
| scratch workspace / `PROBE_DIR` → checkout | Every `.vsf`, flat image, Ghidra project and export lives outside the checkout | Binary artifacts (must not leak into git) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-38-01 | Tampering | `proof01-dxa-real-release.mjs`, `proof02-enumerate-sites.mjs`, `proof03-bank-boundary.mjs`, `src/mcp/vice/dxa-proof01-compare.ts` | high | mitigate | Host binaries are reached only through the shipped seams (`runDxaDisassemble()`, `runGhidraAnalyze()`); no direct spawn. Verified: zero `child_process`/`execSync`/`spawnSync`/`execFile` hits in all four files. SEAM-05's gate `scripts/check-no-skill-external-spawn.mjs` is neither narrowed nor disabled and re-run clean (`OK — tracked-tree 16 files, packed-tarball 15 files`). D-06 circularity guard holds: the enumerator has no non-comment reference to a Ghidra export reader. | closed |
| T-38-02 | Tampering | corpus / fixture identity at read time | high | mitigate | `danish.d64` pinned to `1a9d294e…5fb6c5` and the extracted entry to `331fe97e…1efdaf4` as source constants in `proof01-dxa-real-release.mjs:60-61`; refuses outright on mismatch. Digests recorded as outcome lines in `proof01-dxa-real-release.md`, `proof02-loader-stage.md`, `proof02-depacked-capture.md` (`RELEASE_SHA256`). `38-02`'s fixtures carry `PROOF03_FIXTURE_PRG_SHA256` / `PROOF03_EXPORT_SHA256` on every subcommand. `38-04` re-asserts the copied flat-64K image against Task 1's `PROOF02_CAPTURE_IMAGE_SHA256` (`99b1d660…071dd5`) before scanning. | closed |
| T-38-03 | Denial of Service | dxa / Ghidra JVM on crafted or real crack/packer bytes | medium | accept (`38-01`, `38-02`, low) · mitigate (`38-03`, `38-04`, medium) | Neither tool is patched by this project — both are host-installed and version-pinned (dxa 0.1.5 vendored/audited in Phase 35, Ghidra 12.1.3 a host prerequisite from Phase 34/36). Bounded rather than patched: a distinct per-run Ghidra project directory inside a `mkdtempSync` workspace torn down in a `finally` — verified live as `phase38/proof02-loader-ZLZz8z` and `phase38-04-Pcux1a`, both carrying per-run random suffixes. `38-02` runs no external tool at all. See Accepted Risks R-38-01. | closed |
| T-38-04 | Information Disclosure | scratch workspace / capture artifacts leaking binary material into the checkout | high | mitigate | Scratch roots are `mkdtempSync` under `PROBE_DIR` outside the checkout, torn down in a `finally` (`mkdtempSync`+`finally`+`rmSync` present in `proof01-dxa-real-release.mjs` and `proof03-bank-boundary.mjs`). `git status --porcelain` transcripts recorded empty in `proof02-depacked-capture.md`, `proof02-computed-dispatch.md`, `proof03-bank-boundary.md`; `proof02-loader-stage.md` records the same confirmation in prose. Re-verified live at audit time: no `.prg`/`.rep`/`.gpr`/`.bin`/`.vsf`/`.d64` in the working tree. | closed |
| T-38-05 | Tampering | `src/mcp/vice/anno-join.ts`, `src/mcp/vice/anno-bank.ts` | high | mitigate | The `38-02` forward-carry mutation lives only inside a `mkdtempSync` scratch tree under `PROBE_DIR`, torn down in a `finally`. Byte-identity proven in `proof03-bank-boundary.md`: `ANNO_JOIN_TS_SHA256_BEFORE == _AFTER` (`70060b7c…3705cf`) and `ANNO_BANK_TS_SHA256_BEFORE == _AFTER` (`13fc58ba…35b3cc`). Deviation accepted and documented: the driver's own cleanliness check is this sha256 comparison rather than a shelled-out `git status --porcelain`, *because* T-38-01 forbids the driver importing any child-process module; the literal porcelain transcript is run by the executor and recorded at `proof03-bank-boundary.md:236`. | closed |
| T-38-06 | Repudiation | candidate site-list provenance (loader stage and depacked depth) | high | mitigate | The document's own ordering is the evidence, verified by line number. `proof02-loader-stage.md`: `PROOF02_LOADER_SITES_ENUMERATED: 53` at line 137, first actual Ghidra *run* at line 182 — strictly after, under a Step 2 header that states it. `proof02-computed-dispatch.md`: `PROOF02_DEPACKED_SITES_ENUMERATED: 1` at line 82, first `runGhidraAnalyze` at line 118 — strictly after. Earlier textual mentions of "Ghidra" are the circularity guard's own prose, not the run. | closed |
| T-38-07 | Denial of Service | a task-scoped broker left running | medium | mitigate | `proof02-depacked-capture.md` records `BROKER_STOP_AT` per capture (lines 109, 162) and a Closing section showing `systemctl --user is-active vice-broker` → `inactive`, `pgrep -x vice-broker` → `exit=1`, `pgrep -x x64sc` → `exit=1`, plus `BROKER_STATE: inactive`. The record uses `pgrep -x` (exact process-name match) where the plan wrote `pgrep -f`; this is stricter-or-equivalent for the process name, not a gap. Suite commands use the broker-aware idiom that reports `BROKER_RUNNING` rather than yielding a falsely-red result. | closed |
| T-38-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install occurs anywhere in this phase. `38-RESEARCH.md` § Package Legitimacy Audit records this as not applicable; no `[ASSUMED]`/`[SUS]` package exists to gate. See Accepted Risks R-38-02. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-38-01 | T-38-03 | dxa 0.1.5 and Ghidra 12.1.3 are host-installed, version-pinned third-party tools this project does not patch. The corpus is a fixed, digest-asserted pair of images, not attacker-supplied at runtime. Hardening the tools themselves is out of scope; blast radius is bounded instead by per-run scratch project directories torn down in a `finally`. | Henrik Olsson | 2026-09-06 |
| R-38-02 | T-38-SC | No package-manager install occurs in this phase, so there is no supply-chain surface to gate. dxa was vendored and audited in Phase 35; Ghidra was declared a host prerequisite in Phase 34/36. | Henrik Olsson | 2026-09-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-06 | 8 | 8 | 0 | /gsd-secure-phase (orchestrator, L1 verification) |

### Security Audit 2026-09-06

| Metric | Count |
|--------|-------|
| Threats found | 8 |
| Closed | 8 |
| Open | 0 |

Register origin: authored at plan time (all four plans). ASVS level 1,
`security_block_on: high`. Short-circuit rule applied — `threats_open: 0` with a
plan-time register at ASVS L1 makes grep-depth verification sufficient; no
deeper auditor pass was required. No `## Threat Flags` section was present in
any of the four SUMMARY files, so no summary-originated threats were added.

Live re-verification performed at audit time rather than trusting the recorded
transcripts alone: the SEAM-05 gate was re-run (`exit=0`), the four new source
files were re-grepped for child-process imports (zero hits), and the working
tree was re-checked for stray binary artifacts (none).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-06
