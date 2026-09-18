---
phase: "59"
slug: "the-tool-location-seam-and-its-precedence-order"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-18"
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by `/gsd-plan-phase` from `59-RESEARCH.md` § Validation Architecture.
> The Per-Task Verification Map is filled once `59-*-PLAN.md` exists.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) — no separate test library |
| **Config file** | none — `src/mcp/vice/package.json`'s `test` script is `node --test '*.test.*'` |
| **Quick run command** | `cd src/mcp/vice && node --test tool-location.test.ts prerequisites.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run typecheck && npm test` |
| **Estimated runtime** | ~5s quick · full suite minutes (3800+ tests) |

**Suite hazards that bind this phase's commands:**
- Piping `npm test` into `tail`/`head` reports the pipe's exit code, not the suite's. Redirect to a file and read `$?` on the same line.
- A live `vice-broker` reddens the BACK-05 test deterministically. Assert no broker is running before trusting any suite result.
- `node --test` exits 0 for a filename that does not exist. Verify the file is present before treating a green run as coverage.
- `prerequisites.test.ts` contains a real NUL byte — any content census against it must use `grep -a`.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && node --test tool-location.test.ts prerequisites.test.ts`
- **After every plan wave:** `cd src/mcp/vice && npm run typecheck && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, measured with the exit code read directly (no pipe)
- **Max feedback latency:** ~10 seconds for the per-task command

---

## Per-Task Verification Map

The seam is `src/mcp/vice/tool-location.mts` (D-14); its colocated test is
`src/mcp/vice/tool-location.test.ts`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T1 | 59-01 | 1 | D-11 / D-12 (one-way) | — | The user-facing `tools.json` format is confirmed before any of it is written | checkpoint:decision | *(blocking-human, no command)* | n/a | ⬜ pending |
| T2 | 59-01 | 1 | Success Criterion 1 | T-59-02 | The seam resolves one tool through env → file → `$PATH`, and the COMPILED `resources/tool-location.mjs` finds `prerequisites.json` one directory up | unit (tracer) | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T2 | 59-01 | 1 | Success Criterion 1 (structural) | — | The new module is compiled into `resources/` byte-identically by `build.ts` | unit (existing gate, unmodified) | `cd src/mcp/vice && node --test resources-sync.test.ts` | ✅ exists | ⬜ pending |
| T3 | 59-01 | 1 | `LOC-06` (encoding edge), D-03 | T-59-01, T-59-04 | `~`, a relative value and a non-ASCII segment resolve exactly once inside the seam; no memo exists, proven by a second call seeing a new file | unit | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T1 | 59-02 | 2 | D-05 / D-06 / D-07 | — | All eight records carry a `location` block, a `kind`, and — for the two exclusions — a `reason` | unit (existing gate + inline shape gate) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ exists | ⬜ pending |
| T2 | 59-02 | 2 | `LOC-05`, `LOC-07` (concurrency edge) | T-59-05, T-59-06, T-59-07 | A record declaring `fileOverridable: false` resolves through no layer at all; a directory tool resolves to its directory and never to its marker | unit | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T1 | 59-03 | 3 | `LOC-05`, `LOC-07` (empty + encoding edges) | T-59-09, T-59-11 | `validateToolsFile()` judges the file alone: absent/empty/bare-object silent; unparseable, non-object, unknown key, case-variant key, prototype key, non-string value each reported once; both exclusions refused quoting the declared reason | unit | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T2 | 59-03 | 3 | `LOC-06` (amended triad, empty + concurrency edges) | T-59-10, T-59-12, T-59-13 | A file-supplied path absent, of the wrong kind, missing its marker, or lacking the executable bit is refused by name with the file named as its source; one bad entry refuses one tool | unit | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T1 | 59-04 | 3 | `LOC-05`, `LOC-06`, `LOC-07` (structural) | T-59-14, T-59-15, T-59-17 | The new declaration fields are validated by three named exported validators, each with a planted-violation control | unit (existing gate, extended) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ exists | ⬜ pending |
| T2 | 59-04 | 3 | D-13 (packaging half) | T-59-16 | The compiled seam artifact is present in the packed tarball's own file list, one directory below the declaration | unit (existing gate, extended) | `cd src/mcp/vice && node --test prerequisites.test.ts` | ✅ exists | ⬜ pending |
| T1 | 59-05 | 4 | `LOC-07` (criterion 4), `LOC-05` | T-59-18, T-59-19, T-59-21 | The emitted template documents both exclusions under reserved keys, carries no path its caller did not resolve, and passes `validateToolsFile()` | unit | `cd src/mcp/vice && node --test tool-location.test.ts` | ❌ W0 | ⬜ pending |
| T2 | 59-05 | 4 | Success Criterion 5 | T-59-20 | The placement record exists and every file-and-line citation in it is anchor-verified against the live file | unit (existing gate, extended) | `cd src/mcp/vice && node --test phase58-citation-ledger.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase gate, run once per wave merge and once before `/gsd-verify-work`:**
`pgrep -af 'vice-broker' || echo "NO_BROKER"; cd src/mcp/vice && npm run typecheck && npm test`
— redirected to a file with the exit status read on the same line, never piped.

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/tool-location.mts` and its colocated `tool-location.test.ts` — entirely new; no existing file covers this seam's behaviour (created in plan 59-01 Task 2)
- [ ] `prerequisites.test.ts` extension — the file exists but does not yet validate the `location` / `kind` / `marker` fields this phase adds
- [ ] Planted-violation control per refusal test (`ENGINEERING_RULES.md` §6) — a malformed entry, a `dxa` key, a `node` key and a wrong-`kind` entry, each observed failing before the fix and passing after, matching `prerequisites.test.ts`'s existing "real document and planted violation run the same code" idiom

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *(none identified)* | — | — | — |

*All phase behaviors identified in `59-RESEARCH.md` have automated verification. This seam is pure host-side path resolution with no emulator interaction, so nothing here needs a live VICE run.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for the per-task command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
