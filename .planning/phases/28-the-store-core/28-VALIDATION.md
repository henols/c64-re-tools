---
phase: 28
slug: the-store-core
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `28-RESEARCH.md` § Validation Architecture (lines 1486–1558), which
> derived every row from a live probe on this host rather than from documentation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner (`node --test`) with `node:assert/strict`. No external framework, no config file — the glob *is* the config. |
| **Config file** | none — `"test": "node --test '*.test.*'"` in `src/mcp/vice/package.json` |
| **Quick run command** | `cd src/mcp/vice && node --test anno-*.test.ts && npm run typecheck` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Whole-glob command (evidence only)** | `cd src/mcp/vice && npm test` — **broker stopped**, expect the **44-failure clean baseline**, and expect to terminate the hung `vice-proxy.test.ts` child by hand (D-27-05-A) |
| **Estimated runtime** | quick: sub-second + tsc · `test:automated`: terminates · whole glob: ~660 s and does **not** terminate unaided |

**Two harness constraints that change how tests must be written here:**

1. `node:sqlite` emits an unconditional `ExperimentalWarning` on the Node 22 line —
   **no test in this phase may assert stderr is empty.**
2. `npm run test:automated` skips the frozen nine `MANUAL_ONLY_TESTS`; a green
   `test:automated` is **not** evidence of a green suite. The phase gate needs one
   whole-glob run with the 44-failure baseline reconciled item by item.

---

## Sampling Rate

- **After every task commit:** `cd src/mcp/vice && node --test anno-*.test.ts && npm run typecheck`
- **After every plan wave:** `cd src/mcp/vice && npm run test:automated` — includes every
  regression guard below (`hostpath-consumers`, `comment-phase-pointers`,
  `docs-dangling-refs`, `block-class`, `r2000-coverage`, `shipped-modules`)
- **Before `/gsd-verify-work`:** `npm run test:automated` green **and** `npm run typecheck`
  green **and** `node scripts/check-npm-packages.mjs` green **and** one whole-glob
  `npm test` evidence run with the broker stopped and the baseline reconciled
- **Max feedback latency:** ~2 s per task commit (the 65,536-address cross-validation is
  279 ms measured, cheap enough to run at every commit — so it does)

**Nyquist justification.** The fastest-moving artifact in this phase is the type
vocabulary, which every other module derives from; `anno-types.test.ts` samples it at
every commit, above the rate at which it can change. The slowest-moving is the
packaging/closure state, sampled at wave merge and at the gate — the rate at which
`files[]` changes.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed by requirement and behavior so
the planner can bind each row to a task without renumbering. Threat refs bind to the
`<threat_model>` blocks the security capability requires in each PLAN.md (ASVS L1,
block on `high`).

| Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| The 12 members are exactly the twelve, frozen; the four split layouts are first-class | STORE-01 | — | N/A | unit | `node --test anno-types.test.ts` | ❌ W0 | ⬜ pending |
| **Planted:** a `lo_hi_address` fixture typed `hi_lo_address` yields a differing resolved-target set; collapsing the four to one `table` makes the control fail; fixture asserted non-degenerate | STORE-01 | — | N/A | unit (planted) | `node --test anno-types.test.ts` | ❌ W0 | ⬜ pending |
| `lo_hi_address` vs `lo_hi_word` differ in xref production (justifies four, not two) | STORE-01 | — | N/A | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| Label legality: mnemonic denylist derived from `OPCODES`; `init screen` refused, never sanitised; a legal name already bound elsewhere refused | STORE-01 | T-28-label | Collision refused, never silently merged into one label | unit | `node --test anno-types.test.ts` | ❌ W0 | ⬜ pending |
| Labels / comments / scopes / project enums round-trip by value | STORE-01 | — | N/A | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| No merge on adjacency: two adjacent same-type ranges stay two rows; **and** no splitter symbol exists | STORE-02 | — | N/A | unit + structural | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| Exhaustive 65,536-address cross-validation, two independent implementations, **0** disagreements (~279 ms measured) | STORE-03 | — | N/A | unit | `node --test anno-index.test.ts` | ❌ W0 | ⬜ pending |
| Four separate pins: `$FFFF`, both inclusive ends, `$0400-$0400` reports length **1**, the equal-length tie-break (needs deliberately overlapping rows) | STORE-03 | — | N/A | unit | `node --test anno-index.test.ts` | ❌ W0 | ⬜ pending |
| Split-and-preserve: total typed bytes unchanged across **all five** overlap cases; every previously-typed address still typed | STORE-03 | — | N/A | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| **Planted:** `filter()`-and-insert in place of the split makes the **fully-contained** case fail | STORE-03 | — | N/A | unit (planted) | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| A contradicting retype returns the contradicted comments **as data**; **planted:** removing the check returns clean success | STORE-03 | T-28-undoc | A previously annotated region is never silently un-documented | unit (planted) | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| **ONE** combined test: mutate → `SIGKILL` no clean close → fresh process → reopen → read back **by value** → revert returns the prior value | STORE-04 | — | N/A | integration | `node --test anno-durability.test.ts` | ❌ W0 | ⬜ pending |
| **Planted:** removing the `COMMIT` makes *that same test* go red — **both halves** (observed in research probe) | STORE-04 | — | N/A | integration (planted) | `node --test anno-durability.test.ts` | ❌ W0 | ⬜ pending |
| A truncated store file is **refused**: zero-length **and** mid-file both `AnnoStoreCorruptError`; the tail-in-last-page residual is stated, not claimed closed | STORE-04 | T-28-corrupt | A corrupt store is refused, never returned as a pristine empty one | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| Every write carries `schema_version`; a mismatched version refuses | STORE-05 | T-28-corrupt | N/A | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| The `bank` field exists, is nullable, and is **never read** by any store code path (structural: no `bank` on any right-hand side outside the DDL and the row mapper) | STORE-05 | — | N/A | unit + structural | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| An xref row carries `access_kind`, and the four members are the **only** accepted values | STORE-05 | — | N/A | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| A write whose base revision is stale is **refused**, observed by mutating from a **second OS process** and reading back | STORE-05 | T-28-lostwrite | Another process's annotations are never silently discarded | integration | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| Argument validation throws named `ViceError` subclasses; `$`/`0x`-prefixed strings and `integer` accepted, unprefixed numeric string **refused** | STORE-01 | T-28-unvalidated | The proxy validates nothing, so an unvalidated argument never reaches storage | unit | `node --test anno-types.test.ts` | ❌ W0 | ⬜ pending |
| `node:sqlite` is named by exactly **one** shipped module — `deepEqual` **plus** `length` — over `shippedTsModules()` | STORE-07 | — | N/A | structural | `node --test anno-seam.test.ts` | ❌ W0 | ⬜ pending |
| **Planted:** static, multi-line static, dynamic `import()`, and `process.getBuiltinModule` shapes each reported; a comment-only mention is **not** | STORE-07 | — | N/A | structural (planted) | `node --test anno-seam.test.ts` | ❌ W0 | ⬜ pending |
| The new modules are in `package.json` `files[]` — so the single-seam assertion is not vacuous | STORE-07 | — | N/A | structural | `node --test anno-seam.test.ts` | ❌ W0 | ⬜ pending |
| The `snapshots/` directory is bounded, with the bound named | STORE-04 | T-28-diskgrowth | Revert history cannot grow the disk without bound | unit | `node --test anno-store.test.ts` | ❌ W0 | ⬜ pending |
| (regression) No new module imports `hostpath.ts` | — | — | The store file never leaves the container | structural | `node --test hostpath-consumers.test.ts` | ✅ exists | ⬜ pending |
| (regression) No new shipped comment hands work to a numbered phase; no shipped literal names one | — | — | N/A | structural | `node --test comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | ✅ exists | ⬜ pending |
| (regression) `block-class.ts` maps **every one** of the twelve members correctly — derived from the vocabulary, total, not a spot check | STORE-01 | — | The census cannot silently reclassify every block as `data` | unit | `node --test block-class.test.ts` | ✅ exists (extend) | ⬜ pending |
| (regression) The census's label-kind spelling and the store's agree (or the second boundary is extracted) | STORE-01 | — | A measured census number cannot silently go to zero | unit | `node --test r2000-coverage.test.ts` | ✅ exists (extend) | ⬜ pending |
| (regression) `shippedTsModules()` does not throw — every new `files[]` entry is on disk | STORE-07 | — | N/A | structural | `node --test shipped-modules.test.ts` | ✅ exists | ⬜ pending |
| (regression) Tarball closure and packaging clean with the new shipped modules | STORE-07 | — | N/A | CI script | `node scripts/check-npm-packages.mjs` | ✅ exists | ⬜ pending |
| (regression) Typecheck | — | — | N/A | typecheck | `cd src/mcp/vice && npm run typecheck` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `anno-types.test.ts` — STORE-01 (vocabulary freeze, split orientation control, label legality, argument validation)
- [ ] `anno-index.test.ts` — STORE-03 (65,536-address cross-validation + the four pins)
- [ ] `anno-store.test.ts` — STORE-01/02/03/04/05 (round-trip, no-merge, five overlap cases, contradiction, corrupt-file refusals, cross-process CAS, snapshot bound)
- [ ] `anno-durability.test.ts` — STORE-04 (the ONE combined test) **plus a sibling mutator script** the test spawns and `SIGKILL`s
- [ ] `anno-seam.test.ts` — STORE-07 (structural single-seam + four plantings + the `files[]` non-vacuity pairing)
- [ ] Extend `block-class.test.ts` — total derived mapping over the twelve members (closes research finding C-6/§"Named Boundary Left Half-Open" (a))
- [ ] Extend `r2000-coverage.test.ts` — label-kind spelling agreement (closes the same finding, part (b))
- [ ] Framework install: **none** — `node --test` is built in and every new `*.test.ts` joins both globs automatically

*Module names carry research assumption A1 (`anno-*` prefix) — the planner may rename
freely, but every hard constraint on the name was verified: no `r2000` substring
(Phase 32's grep gate), outside `module-classification.ts`'s glob, a single stable
prefix derivable from disk, and the names are free.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Whole-glob suite evidence at the phase gate | all | `npm test` runs ~660 s, does not terminate unaided (a `vice-proxy.test.ts` child hangs — D-27-05-A), and has a 44-failure clean baseline that must be reconciled item by item rather than asserted | Stop the VICE broker first (a live broker deterministically reddens the BACK-05 test). Run `cd src/mcp/vice && npm test`. Terminate the hung `vice-proxy.test.ts` child by hand. Reconcile the failure list against the 44-failure baseline; **name the command in the evidence**. |
| The irreversible vocabulary decision | STORE-01 | The type vocabulary is decided in this phase and never revisited; split-table orientation is unrecoverable from stored data because it was never recorded, so the recovery cost is a hand re-annotation, not a migration | `REVERSIBILITY_GATES` is on: the planner places a `checkpoint:decision` before the task that freezes the vocabulary. Confirm the twelve members and the four-split decision at that checkpoint. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s per task commit
- [ ] No test in this phase asserts stderr is empty (`node:sqlite` `ExperimentalWarning`)
- [ ] Every planted violation named in the map was **observed** red, not reasoned about
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
