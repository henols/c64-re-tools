---
phase: 27
slug: shared-seams-extracted
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json:58` declares the script |
| **Quick run command** | `node --test <changed>.test.ts` (single file, from `src/mcp/vice`) |
| **Full suite command** | `npm test` from `src/mcp/vice` — the **whole glob**, broker stopped. Not `test:automated` (it skips `MANUAL_ONLY_TESTS` and hides CI failures), and not on a host with a live broker (`BACK-05`'s D→G ordering test then fails deterministically — see D-17). |
| **Estimated runtime** | Single file: **< 5 s**. Per-task file lists in this phase (7–11 files): **< 30 s**. Full glob `npm test`: **~110 s** — measured, not guessed: `# duration_ms 116872` (117 s wall) recorded in `19-19-SUMMARY.md`, ~105–110 s in the most recent phases. `npm run typecheck` adds ~10 s and is chained into every task's gate. |

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command (column below) — every one of the 15 tasks has one, and each is a `typecheck && node --test <named files>` chain scoped to the files the task touched.
- **After every plan wave:** Run the plan's own gate (its `<verification>` "Plan gate" list). The **full glob** is run once for the phase, in `27-05-03`, deliberately rather than per wave — three of the five plans state `npm run test:automated` as **forbidden as evidence**, and a full-glob run per wave would cost ~110 s × 3 for no extra signal while wave-1 and wave-2 siblings are concurrently editing shared test files.
- **Before `/gsd-verify-work`:** Full suite must be green — `27-05-03`'s command, which additionally refuses to run at all if a VICE broker is up.
- **Max feedback latency:** **30 s** per task (single-plan file lists); **~120 s** for the phase's one full-glob gate.

---

## Per-Task Verification Map

Populated from each task's own `<verify><automated>` block. Commands are abbreviated to the distinguishing files; the authoritative text is in the named plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | SEAM-01 | T-27-01-01 / T-27-01-05 | Moved `probeAcme()` keeps the argv-array `spawnSync` form — never a shell string, `execSync`, or `shell: true` — so an env-supplied binary name cannot become a shell injection | integration (tracer) | `typecheck && node --test disasm-roundtrip.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts absorbed-answer-key.test.ts anno-verify.test.ts hostpath-consumers.test.ts assumption-label-discipline.test.ts` | ✅ | ⬜ pending |
| 27-01-02 | 01 | 1 | SEAM-01 | T-27-01-02 / T-27-01-03 / T-27-01-04 | The ACME hard-FAIL cannot degrade into a silent skip: a child run with `VICE_REQUIRE_ACME=1` + nonexistent `ACME_BIN` exits non-zero, its paired control exits zero, the module is absent from `files[]`, and the probe file is `mkdtempSync`-scoped and `rmSync`-ed in a `finally` | unit + child-process | `typecheck && node --test acme-gate.test.ts test-gate.test.ts` | ✅ created in-task | ⬜ pending |
| 27-01-03 | 01 | 1 | SEAM-01 | T-27-01-02 | The `ci.yml` env-var binding audit is recorded as a stated finding, and `ci.yml` stays byte-identical — a rename on either side is the silent-degradation route | guard (comment/docs) | `typecheck && node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts docs-linerefs.test.ts ci-guardrails.test.mjs disasm-roundtrip.test.ts skill-acme-build-cli.test.ts anno-cli.test.ts absorbed-answer-key.test.ts` | ✅ | ⬜ pending |
| 27-02-01 | 02 | 1 | SEAM-03 | T-27-02-01 / T-27-02-03 | The adapter never receives the census, the raw bytes, a decoder or a confidence grade — the bytes-versus-store independence axis is enforced by a committed import-purity assertion, not by the header; and its new `files[]` entry is validated against the real tarball | unit + packaging | `typecheck && node --test block-class.test.ts && node scripts/check-npm-packages.mjs` | ✅ created in-task | ⬜ pending |
| 27-02-02 | 02 | 1 | SEAM-03 | T-27-02-04 / T-27-02-05 | The test-only classifier seam cannot become a production injection point: required-with-no-default on both internal shapes, optional-with-the-real-adapter at the public entry, and no production module passes it | unit + structural | `typecheck && node --test anno-coverage.test.ts anno-coverage-grammar.test.ts anno-cli.test.ts block-class.test.ts` | ✅ | ⬜ pending |
| 27-02-03 | 02 | 1 | SEAM-03 | T-27-02-02 | A comparison site left behind is *observable*: the zero-overlap second vocabulary moves a census byte count and fails loudly, and one left-behind-site probe is observed RED before the plan closes | unit (substitutability) | `typecheck && node --test anno-coverage.test.ts` | ✅ | ⬜ pending |
| 27-03-01 | 03 | 2 | SEAM-02, SEAM-03 | T-27-03-01 / T-27-03-02 / T-27-03-03 / T-27-03-04 | Both input-validation refusals move byte-identically (3-byte minimum, exact-65536), the extension-before-length dispatch order in the CLI is provably untouched, the census's last import from the glue module is gone, and the tarball is validated rather than assumed | unit + packaging | `typecheck && node --test anno-coverage.test.ts anno-coverage-grammar.test.ts && node scripts/check-npm-packages.mjs` | ✅ | ⬜ pending |
| 27-03-02 | 03 | 2 | SEAM-02 | T-27-03-01 | The four refusal-regression tests relocate **verbatim** rather than being rewritten, and one break-and-restore probe against the minimum-length check is observed RED | unit | `typecheck && node --test prg-image.test.ts anno-project.test.ts test-gate.test.ts` | ✅ created in-task | ⬜ pending |
| 27-03-03 | 03 | 2 | SEAM-02 | T-27-03-05 / T-27-03-06 (both `accept`) | No path or unbounded-payload surface is added — all three moved functions take bytes or a base64 string, never a path; the `doesNotMatch(stderr, /parsePrg/)` assertion stays as written | guard (imports/comments) | `typecheck && node --test prg-image.test.ts anno-symbol-roundtrip.test.ts anno-verify.test.ts anno-tools.test.ts anno-mcp-client.test.ts anno-coverage.test.ts anno-d64.test.ts anno-cli.test.ts docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts` | ✅ | ⬜ pending |
| 27-04-01 | 04 | 2 | SEAM-02 | T-27-04-01 / T-27-04-02 | The extracted enumerator cannot silently return a short list — a `files[]` entry naming a nonexistent file throws a named error — and the helper stays absent from `files[]` | unit | `typecheck && node --test shipped-modules.test.ts test-gate.test.ts` | ✅ created in-task | ⬜ pending |
| 27-04-02 | 04 | 2 | SEAM-02 | T-27-04-03 | `codeOnly()` still blanks string and template-literal bodies, so the spawn-site scan stays trustworthy; each local copy is **deleted**, not left beside an import | unit + guard | `typecheck && node --test shipped-modules.test.ts docs-dangling-refs.test.ts spawn-seam.test.ts stock-dispatch.test.ts comment-phase-pointers.test.ts` | ✅ | ⬜ pending |
| 27-04-03 | 04 | 2 | SEAM-02 | T-27-04-04 / T-27-04-05 | The record does not contradict itself: both statements of the no-import-between-guard-tests convention state the same narrowed scope, and no guard test imports another guard test (which would silently duplicate its registered tests) | guard (comments) | `typecheck && node --test comment-phase-pointers.test.ts hop-chain-comments.test.ts spawn-seam.test.ts docs-dangling-refs.test.ts stock-dispatch.test.ts shipped-modules.test.ts` | ✅ | ⬜ pending |
| 27-05-01 | 05 | 3 | SEAM-02 | T-27-05-01 / T-27-05-05 / T-27-05-06 | No verdict is justified by the name prefix; every exclusion and the one contested verdict are stated in the record; line citations are marked advisory; and the registry stays out of `files[]` | typecheck + guard | `typecheck && node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts hop-chain-comments.test.ts assumption-label-discipline.test.ts hostpath-consumers.test.ts` | ✅ | ⬜ pending |
| 27-05-02 | 05 | 3 | SEAM-02 | T-27-05-02 / T-27-05-03 | The enforcing guard derives its threshold from the on-disk glob instead of pinning a total, so a narrowing glob fails the relation rather than making every completeness assertion vacuously true; proven by a planted violation | unit (enforcing guard) | `typecheck && node --test module-classification.test.ts test-gate.test.ts` | ✅ created in-task | ⬜ pending |
| 27-05-03 | 05 | 3 | SEAM-02 | T-27-05-04 | The phase's green is claimed from the **full glob**, never `test:automated`, on a host with no live broker — the command refuses to run if `pgrep -f vice-broker` matches — plus the tarball validator and the zero-deletion gate | full suite + packaging | `pgrep-broker guard && typecheck && npm test && node scripts/check-npm-packages.mjs && test "$(git diff --diff-filter=D … \| grep -c anno)" = "0" && test "$(ls anno-*.ts \| grep -vc '\.test\.ts$')" -ge 16` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity: 15/15.** Every task carries an `<automated>` block; no task relies on a manual check; there is no run of 3 consecutive tasks without automated verification. No watch-mode flag (`--watch`, `--watchAll`, `-w`) appears in any command. No command invokes a full end-to-end runner except `27-05-03`, which is the phase's single deliberate full-glob gate.

---

## Wave 0 Requirements

**Existing infrastructure covers all phase requirements.** No Wave 0 scaffold is needed, and this is a measured claim rather than a default:

- Every pre-existing test file named in any `<automated>` command exists on disk today — checked file by file: `disasm-roundtrip`, `skill-acme-build-cli`, `anno-cli`, `anno-answer-key`, `anno-verify`, `hostpath-consumers`, `assumption-label-discipline`, `test-gate`, `docs-dangling-refs`, `comment-phase-pointers`, `hop-chain-comments`, `docs-linerefs`, `ci-guardrails.test.mjs`, `anno-coverage`, `anno-coverage-grammar`, `anno-project`, `anno-symbol-roundtrip`, `anno-tools`, `anno-mcp-client`, `anno-d64`, `anno-spawn-seam`, `stock-dispatch`, plus `scripts/check-npm-packages.mjs`.
- The five **new** test files (`acme-gate.test.ts`, `block-class.test.ts`, `prg-image.test.ts`, `shipped-modules.test.ts`, `module-classification.test.ts`) are each created by the very task whose `<automated>` command runs them, so no `MISSING —` placeholder is required and no task verifies against a file no task creates.
- No framework install is needed: the runner is `node --test`, built in.

---

## Manual-Only Verifications

**All phase behaviors have automated verification.** Four **observed probes** are additionally required — each is a break-and-restore performed *by* the executor and recorded in the plan SUMMARY, not a manual acceptance step, and each is already an acceptance criterion of its task:

| Behavior | Requirement | Why an observed probe rather than a standing test | Instructions |
|----------|-------------|--------------------------------------------------|--------------|
| The ACME gate's FAIL can actually be made to fail | SEAM-01 | A permanently-broken gate would make the suite permanently red; the point is to observe once that the assertion is load-bearing | `27-01-02`: delete the `VICE_REQUIRE_ACME` guard from `assertAcmeRequiredIfEnvSet`, observe `node --test acme-gate.test.ts` RED, restore, record both observations |
| A left-behind raw-string comparison is detectable | SEAM-03 | Same reason — the violation must not be committed | `27-02-03`: restore one raw-string comparison at the divergence site, observe `node --test anno-coverage.test.ts` RED on the substitutability test, restore, record both |
| The relocated minimum-length refusal is load-bearing | SEAM-02 | Same reason | `27-03-02`: loosen `parsePrg`'s minimum by one byte, observe `node --test prg-image.test.ts` RED, restore, record both |
| The enumerator's existence assertion is load-bearing | SEAM-02 | Same reason | `27-04-01`: remove the existence assertion, observe `node --test shipped-modules.test.ts` RED, restore, record both |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 15/15, none `MISSING`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — verified across all 15
- [x] Wave 0 covers all MISSING references — none exist; the five new test files are created in-task
- [x] No watch-mode flags — none in any of the 15 commands
- [ ] Feedback latency < 30s — per-task: yes by construction; the phase's one full-glob gate is ~120 s **by design** (see Sampling Rate), to be confirmed by observation during execution
- [ ] `nyquist_compliant: true` set in frontmatter — **`/gsd-validate-phase` §6's to flip, not the planner's**

**Approval:** pending — this record is complete as a *plan-time* contract (checks 8a–8d pass from the plans themselves); `status` and `nyquist_compliant` stay as seeded until `/gsd-validate-phase` §6 confirms against execution.
