---
phase: 27
slug: shared-seams-extracted
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
security_block_on: high
register_authored_at_plan_time: true
threats_total: 32
threats_closed: 32
created: 2026-08-27
---

# Phase 27 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 27 is a pure-extraction phase: modules move out from under an `r2000`
name prefix, every surviving consumer is repointed, and a capability-or-glue
classification record is committed. **No behaviour changes**, so no threat in
this phase is a new exposure — each is either a discipline that had to survive
a move, or a pre-existing property recorded so it is a decision rather than an
oversight.

All five plans authored a `<threat_model>` at plan time
(`register_authored_at_plan_time: true`), so this audit **verifies mitigations
exist** rather than building a register retroactively.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| CI environment → test harness | `.github/workflows/ci.yml:140` sets `VICE_REQUIRE_ACME`; the harness reads it by name. A rename on either side silently converts a hard-FAIL into a skip, and both sides stay green. | env var name (control-plane, not data) |
| `process.env.ACME_BIN` → `spawnSync` argv | An externally-controlled binary **name** reaches a subprocess launch. | untrusted-ish string → process execution |
| `package.json` `files[]` → published npm tarball | Anything listed ships to consumers of `@henols/vice-mcp`. A test-only module leaking in enlarges the published surface. | source modules (public) |
| temp filesystem → child `node --test` | The ACME gate test writes an executable module to a temp dir and runs it. | generated executable source |
| annotation store → coverage census | A foreign block-type vocabulary produced by another program crosses into this repo's derived-from-bytes measurement. SEAM-03 exists so this crossing happens at one named place. | foreign vocabulary strings |
| bytes side ↔ store side (internal, load-bearing) | `r2000-coverage.ts` records that neither side may read the other's input. An *integrity* boundary for a measurement, enforced only by structure. | census input / store documentation |
| user-supplied image bytes → parser | `.prg`, `.d64`-extracted and flat-64K byte arrays reach the two validators — the only thing between a truncated capture and a silently wrong load address. | untrusted byte arrays |
| glue module → capability module (internal) | Until 27-03 landed, a prefix deletion of a glue module would break a capability with no announcement. | static import edge |
| `package.json` `files[]` → every guard's scanned set | Four committed guards derive *what they scan* from this array. A helper returning a short list silently narrows four guards at once, each still passing. | module path list |
| source text → structural guard predicates | `codeOnly()` decides what a guard can see. Under-stripping gives false positives; over-stripping gives false negatives that look like a clean tree. | source text |
| this phase's record → a later phase's deletion decisions | The classification registry is consumed by a phase that will delete ~12k lines. A wrong or incomplete entry there is acted on, not reviewed. | deletion verdicts |
| on-disk module set → the enforcing test's scanned set | If the enumeration glob silently narrows, every completeness assertion passes vacuously and an unclassified module ships. | module enumeration |
| a suite result → a phase-completion claim | The choice of test command decides what "green" means. Two commands exist and one omits nine files. | pass/fail verdict |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-27-01-01 | Tampering | `probeAcme()` — env-supplied binary name reaching `spawnSync` | medium | mitigate | argv-array form preserved byte-identically; verified: `acme-gate.ts:78,81` are `spawnSync(ACME_BIN, ["--version"\|"--help"], …)`, and `execSync` / `execFileSync` / `shell:` appear nowhere in the file | closed |
| T-27-01-02 | Repudiation | The ACME hard-FAIL gate degrading into a silent skip during the move | high | mitigate | Committed child-process test plus its non-vacuity control; `ACME_BIN` / `VICE_REQUIRE_ACME` byte-identical (D-03); verifier reproduced exit 1 with the gate's own refusal wording under `VICE_REQUIRE_ACME=1` and exit 0 with it unset | closed |
| T-27-01-03 | Information Disclosure | Test-only `acme-gate.ts` leaking into the published tarball | medium | mitigate | Mechanical `files[]`-absence assertion; verified: `acme-gate.ts` is OUT of `files[]` | closed |
| T-27-01-04 | Tampering | Probe file written to a predictable path or left in the module directory | low | mitigate | Verified: `mkdtempSync(join(tmpdir(), "acme-gate-test-"))` at `acme-gate.test.ts:95`, `rmSync(dir, { recursive: true, force: true })` in a `finally` at `:129-130` | closed |
| T-27-01-05 | Spoofing | Banner-matching probe accepting a non-ACME binary that prints the substring | low | accept | Pre-existing property of the moved code. The probe gates *whether an external-oracle test may skip*, never a security decision; this phase preserves behaviour rather than improving it | closed (accepted) |
| T-27-01-SC | Tampering | npm / pip / cargo package installation | low | accept | No install task in the plan. Verified: `dependencies` + `devDependencies` hash identical across the whole phase range | closed (accepted) |
| T-27-02-01 | Tampering | The bytes-versus-store independence axis, if the adapter is handed the census, raw bytes, a decoder or a confidence grade | high | mitigate | `blockClassAt` takes only `(blocks, address)`; structural import-purity assertion. Verified: `block-class.ts` has **zero** import/require statements and the exported signature is two arguments | closed |
| T-27-02-02 | Repudiation | A comparison site left behind, leaving the census holding upstream's vocabulary while criterion 3 reads satisfied | high | mitigate | Substitutability test uses a zero-overlap second vocabulary so a left-behind comparison moves a census count and fails loudly; literal-absence grep; left-behind-site probe observed RED once | closed |
| T-27-02-03 | Information Disclosure | `block-class.ts` newly entering the published tarball | medium | mitigate | Addition forced by the closure walk (C-7), not optional. Module is pure — no fs, subprocess, network, path handling or env read (zero imports). `check-npm-packages.mjs` run, not assumed | closed |
| T-27-02-04 | Tampering | The test-only classifier option becoming a production injection point | medium | mitigate | Public option defaults to the one real adapter (`r2000-coverage.ts:2173`); both internal shapes require it with no default, making omission a typecheck error; criterion asserts no production module passes it | closed |
| T-27-02-05 | Denial of Service | Linear block scan called once per address across a 64K census range | low | accept | Unchanged from the moved code — same algorithm, same call count, same two call sites. The suite's 30-second budget test already bounds the corpus | closed (accepted) |
| T-27-02-SC | Tampering | npm / pip / cargo package installation | low | accept | No install task. Verified: deps byte-identical; the only `package.json` diff in the phase is two `files[]` entries | closed (accepted) |
| T-27-03-01 | Tampering | The two input-validation refusals being reworded, relaxed or reordered during the move | high | mitigate | Bodies and message strings moved byte-identically. Verified in `prg-image.ts`: `bytes.length < 3` at `:70` with its "needs at least 3 bytes" message at `:72`; `bytes.length !== 65536` at `:87` with its "exactly 65536 bytes" message at `:89`. Four existing unit tests relocated verbatim; break-and-restore probe observed RED | closed |
| T-27-03-02 | Repudiation | A capability module left depending on a module a prefix deletion removes | high | mitigate | This plan **is** the mitigation (Correction C-1). Verified: `grep r2000-project r2000-coverage.ts` returns zero | closed |
| T-27-03-03 | Information Disclosure | The new module enlarging the published tarball surface | medium | mitigate | Forced by the closure walk. Verified: `prg-image.ts`'s only import is `node:zlib` (`:62`) — no fs, subprocess, network, path or env. `check-npm-packages.mjs` run, not assumed | closed |
| T-27-03-04 | Tampering | A supply-chain change to the published tarball going unnoticed | medium | mitigate | Canon security, referred not minted: the tarball validator compares both published tarballs' exact contents via dry-run pack, and this plan ran it after the `files[]` change | closed |
| T-27-03-05 | Tampering | Path traversal via an image argument | low | accept | Not reachable: all three moved functions take `Uint8Array` or a base64 string, never a path. Path resolution stays with the CLI, unmodified | closed (accepted) |
| T-27-03-06 | Denial of Service | A hostile gzip payload expanding without bound through the moved decoder | low | accept | Unchanged from the moved code — same call, same absence of a size cap, same single caller. Input reaches it only from an analyser project file the operator supplied. Adding a cap would be a behaviour change, which this phase forbids | closed (accepted) |
| T-27-03-SC | Tampering | npm / pip / cargo package installation | low | accept | No install task. Verified: deps byte-identical | closed (accepted) |
| T-27-04-01 | Tampering | The shared enumerator losing its existence assertion, silently shrinking four guards' scanned set at once | high | mitigate | Verified: `shipped-modules.ts:113` declares `ShippedFilesEntryMissingError` and `:155-156` throws it on a missing on-disk entry — an assert-to-throw upgrade no call site can opt out of, so the function cannot return a short list. Planted stale-entry test drives the same predicate; assertion deleted once and observed RED; element-for-element scanned-set equivalence checked across the repoint | closed |
| T-27-04-02 | Information Disclosure | The test-only helper leaking into the published tarball | medium | mitigate | Mechanical `files[]`-absence assertion (test 56, passing). Verified: `shipped-modules.ts` is OUT of `files[]`, and 27-04 changed `package.json` not at all | closed |
| T-27-04-03 | Tampering | `codeOnly()` "simplified" into a regex or line filter, so a violation hidden in a template literal becomes invisible | high | mitigate | Character state machine moved verbatim. Verified: `shipped-modules.ts:206` `codeOnly()` indexes `src[i]` char-by-char with `inTemplateText` / interpolation-depth / escape handling (`:253-350`) — not a regex or line filter. Unit tests cover single-quoted, double-quoted and template bodies plus all three comment shapes. (The code review's `codeOnly()` regex-literal defect was found and fixed inside the phase — 23 previously-invisible exported symbols across two modules.) | closed |
| T-27-04-04 | Repudiation | The helper imported into a guard test that also registers tests, silently duplicating that file's execution | medium | mitigate | Verified: `shipped-modules.ts` imports only `node:fs`, `node:url`, `node:path` — nothing from `node:test` — and its filename does not match the runner's glob. Test 57 ("registers no test at import time") passes | closed |
| T-27-04-05 | Repudiation | The record contradicting the code — one convention statement narrowed, the other still instructing a reader to duplicate | medium | mitigate | Both statements rewritten (Correction C-4, commit `93c0e2e`), asserted by greps in both directions: old wording absent, narrowed scope present, in both files | closed |
| T-27-04-SC | Tampering | npm / pip / cargo package installation | low | accept | No install task; 27-04 does not touch `package.json` at all | closed (accepted) |
| T-27-05-01 | Repudiation | A verdict recorded on a basis the record did not use — in particular the name prefix, the one justification criterion 2 forbids | high | mitigate | Direction 4 scans every `basis` field, every consumer path, every symbol and every requirement id and rejects a prefix-as-justification; a planted name-justified entry proves non-vacuity and a clean control proves no false positive. Three occurrences of the forbidden token were rewritten *out* during the acceptance loop. **Residual:** `note` is deliberately exempt and `contested` is prose-only — logged as `D-27-05-B`, accepted at UAT test 3 | closed |
| T-27-05-02 | Tampering | A module added later slipping in unclassified, or an entry left behind after a rename | high | mitigate | Directions 1 and 2 assert the relation in both directions from a disk enumeration. A **real** unclassified `r2000-*.ts` was created on disk, Direction 1 went red naming it, and the file was removed (`git status` clean) | closed |
| T-27-05-03 | Tampering | The enumeration glob narrowing silently, making every completeness assertion vacuously true | high | mitigate | Direction 6's non-vacuity threshold is derived from the registry rather than pinned, placed before every loop (`module-classification.test.ts:300`); the narrowed-glob case observed RED. A pinned literal was explicitly rejected — it goes red on a correct tree, this project's recorded scar | closed |
| T-27-05-04 | Repudiation | The phase's green claimed from the narrowed gate, or on a live-broker host, or stated without the counts | high | mitigate | The verify gate refuses to run while a broker process exists; the full-glob command is named verbatim; counts recorded (2636/2520/44/67/5, EXIT 1) with all 44 dispositioned by file; the red is recorded red with attribution rather than replaced by a narrower green. Judged HOLDS and accepted at UAT test 3 | closed |
| T-27-05-05 | Information Disclosure | The registry or one of the phase's three test-only modules leaking into the tarball | medium | mitigate | Mechanical `files[]`-absence assertion via 27-04's extracted enumerator plus a direct manifest read. Verified: `module-classification.ts`, `shipped-modules.ts`, `acme-gate.ts` all OUT; `files[]` delta across the phase is exactly `block-class.ts` + `prg-image.ts` | closed |
| T-27-05-06 | Repudiation | An advisory line citation drifting, so a later phase reads a number pointing at the wrong code | medium | mitigate | Lines are optional and, where present, verified by asserting the cited line **contains** the cited symbol rather than trusted. Three real drifts were caught before the entries were written; WR-06 later added a Direction 9b containment + existence check for the prose `path:NN` citations | closed |
| T-27-05-SC | Tampering | npm / pip / cargo package installation | low | accept | No install task; 27-05 does not modify `package.json`. Verified: deps + devDeps hash identical across `b730032^ … HEAD` | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-27-01 | T-27-01-05 | Banner-substring matching could accept a non-ACME binary. The probe gates only whether an external-oracle test may skip — never a security decision — and this phase's contract preserves behaviour rather than improving it. | henrik | 2026-08-27 |
| R-27-02 | T-27-02-05 | Linear block scan per address across 64K is unchanged from the moved code (same algorithm, call count and call sites); the suite's 30-second budget test bounds the corpus. | henrik | 2026-08-27 |
| R-27-03 | T-27-03-05 | Path traversal via an image argument is unreachable — the moved functions take `Uint8Array` or base64, never a path; path resolution stays in the unmodified CLI. | henrik | 2026-08-27 |
| R-27-04 | T-27-03-06 | Unbounded gzip expansion is unchanged from the moved code and reachable only from an operator-supplied analyser project file. Adding a size cap would be a behaviour change, which this extraction phase forbids. | henrik | 2026-08-27 |
| R-27-05 | T-27-01-SC, T-27-02-SC, T-27-03-SC, T-27-04-SC, T-27-05-SC | No package-manager install task exists anywhere in phase 27. `dependencies` and `devDependencies` are byte-identical across the entire phase range (verified by hash); the only `package.json` diff is two `files[]` entries. RESEARCH.md's Package Legitimacy Audit records zero external packages, so ENGINEERING_RULES.md §4's dependency bar is not triggered. | henrik | 2026-08-27 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 32 | 32 | 0 | /gsd-secure-phase (orchestrator, ASVS L1 short-circuit — plan-time register, `threats_open: 0`) |

**Audit method.** State B (no prior SECURITY.md; 5 PLANs + 5 SUMMARYs). All five
plans carried a parseable `<threat_model>`, so `register_authored_at_plan_time`
is `true`; with `asvs_level: 1` the workflow's short-circuit applies and no
deeper L2/L3 auditor pass is required. Mitigations were verified mechanically
rather than read off the SUMMARYs: the greps and file reads cited per-threat
above, plus a live run of the five phase-27 guard files
(`node --test acme-gate.test.ts block-class.test.ts prg-image.test.ts
shipped-modules.test.ts module-classification.test.ts` → **57 tests, 57 pass,
0 fail, exit 0**, broker confirmed not running).

**Not re-audited here.** The 44 pre-existing whole-glob failures
(39 `vice-proxy.test.ts`, 5 `r2000-session.test.ts`) are environmental, live in
files phase 27 never touched, and were accepted at UAT test 1 via the
`overrides:` block in `27-VERIFICATION.md`. They are not security findings.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
