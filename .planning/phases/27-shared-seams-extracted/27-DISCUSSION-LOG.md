# Phase 27: Shared Seams Extracted - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 27-shared-seams-extracted
**Areas discussed:** Gate extraction shape, Classification record form, Coverage store boundary, Extraction scope beyond SEAM-01/03

---

## Gate extraction shape

### Q1 — How does the ACME gate leave `anno-test-gate.ts`?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard move, repoint all 4 | ACME symbols move to a new module; all four importers rewritten; no re-export left behind, so a later prefix deletion cannot resurrect the coupling | ✓ |
| Move + re-export shim | New module owns the ACME half; `anno-test-gate.ts` re-exports so importers stay untouched | |
| Split file, both halves move | Neither half stays under the old name; touches all 13 importers | |

**User's choice:** Hard move, repoint all 4
**Notes:** The shim option was rejected on the stated grounds that it leaves the deletion hazard intact — deleting `anno-*` would still break four test files, which is the failure SEAM-01 exists to remove.

### Q2 — What is the extracted module called?

| Option | Description | Selected |
|--------|-------------|----------|
| `acme-gate.ts` | Names the tool and the job; matches the repo's `<domain>-<role>.ts` convention; unambiguous next to the existing `test-gate.mjs` | ✓ |
| `acme-probe.ts` | Echoes `vice-probe.ts`, but that means liveness of a running thing — a different job | |
| `acme-availability.ts` | Most literal; introduces a naming shape no sibling uses | |

**User's choice:** `acme-gate.ts`
**Notes:** `test-gate.ts` was ruled out before the question was asked — `test-gate.mjs`, `test-gate.d.mts` and `test-gate.test.ts` already occupy that name in the same directory for a different gate.

### Q3 — Where does the `files[]`-absence assertion for the new module go?

| Option | Description | Selected |
|--------|-------------|----------|
| New `acme-gate.test.ts` | The extracted module gets its own test carrying the `files[]` assertion and criterion 1's proof; leaves `anno-verify.test.ts:187` alone | ✓ |
| Extend `anno-verify.test.ts` | Add the new name to the existing assertion — smallest diff | |
| Fold into an existing non-anno test | Avoids a new file; scatters the gate's guarantees | |

**User's choice:** New `acme-gate.test.ts`
**Notes:** Extending the anno test would put a non-anno module's only structural guard inside an `anno-*` file — the exact hazard the phase removes.

### Q4 — How is the missing-ACME hard-FAIL observed?

| Option | Description | Selected |
|--------|-------------|----------|
| Child-process test, committed | Spawns a child `node --test` with `VICE_REQUIRE_ACME=1` and a nonexistent `ACME_BIN`; asserts non-zero exit. Re-runs forever | ✓ |
| One-off recorded evidence run | Executor runs it by hand and pastes the failing output | |
| Both | Committed test plus a transcript | |

**User's choice:** Child-process test, committed
**Notes:** Driven by the measured fact that `ACME_AVAILABLE` is evaluated once at module load, so no in-process test can re-probe.

---

## Classification record form

### Q1 — What form does the record take?

| Option | Description | Selected |
|--------|-------------|----------|
| Registry + enforcing test | Committed data file mapping every `anno-*` module to a verdict; a test enumerates the directory and fails on any unclassified module | ✓ |
| Prose doc in `docs/` | Readable, matches existing `docs/phase*-findings.md` practice; nothing fails when it goes stale | |
| Both | Registry gates, doc explains | |

**User's choice:** Registry + enforcing test

### Q2 — What does each entry cite as its basis?

| Option | Description | Selected |
|--------|-------------|----------|
| Surviving consumers + requirement ids | Names the files/symbols that break if the module vanishes, plus any requirement it implements; test asserts every cited path exists | ✓ |
| Free-text behavioural sentence | Readable but not checkable — the test only catches the literal word | |
| Structured enum only | Fully mechanical; loses the evidence that makes the verdict trustworthy five phases later | |

**User's choice:** Surviving consumers + requirement ids

### Q3 — How are glue modules that contain a capability handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Third verdict `glue-with-extractable` | Names the specific symbols that must move out before deletion; makes the extraction-scope question a recorded obligation | ✓ |
| Binary; extract first, then classify | Forces every extraction into Phase 27 regardless of readiness | |
| Binary; mixed modules are capability | Simplest and safest, but protects a lot of genuine glue | |

**User's choice:** Third verdict `glue-with-extractable`
**Notes:** `anno-project.ts` is the concrete instance — glue that drives the binary, but holding the pure `parsePrg`/`flatImageOrigin`.

### Q4 — Where does the registry live and does it ship?

| Option | Description | Selected |
|--------|-------------|----------|
| `src/mcp/vice/`, not in `files[]` | Next to the modules it classifies, so drift shows in one diff; bookkeeping, not runtime | ✓ |
| `.planning/` artifact | Keeps the shipped tree clean, but the test would reach out of `src/mcp/vice/`, which nothing else does | |
| `docs/` with a parsing test | Most readable; a parser over prose is new fragility | |

**User's choice:** `src/mcp/vice/`, not in `files[]`

---

## Coverage store boundary

### Q1 — What is the boundary, concretely?

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter module, neutral vocabulary | New non-anno module owns the Display strings and exposes a neutral block class; the census holds no upstream literal | ✓ |
| Injected vocabulary mapping | Functions stay put, mapping passed as a parameter with today's strings as the default | |
| Interface-only, functions stay put | Names the boundary without moving anything | |

**User's choice:** Adapter module, neutral vocabulary
**Notes:** The injected-mapping option was rejected because a caller who forgets the parameter silently gets upstream's vocabulary back — the failure that should be loud.

### Q2 — Does `anno-coverage.ts` itself get renamed this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Only the store contact moves | Census keeps its name, protected by its registry entry; 2292 lines with a 4315-line test file, and no criterion requires the rename | ✓ |
| Rename the census too | Strongest reading of the phase goal; largest diff in the repo | |
| Decide from the diff | Leaves the choice to be made under execution pressure | |

**User's choice:** Only the store contact moves now

### Q3 — How is the adapter proven to be a real boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Second implementation in the test | Feed the census a different block vocabulary through the adapter; byte counts unchanged, only the divergence sub-report moves | ✓ |
| Structural test: no Rust literal in the census | Cheap regression guard; proves absence of a string, not substitutability | |
| Both | | |

**User's choice:** Second implementation in the test
**Notes:** The structural guard survives in CONTEXT.md as an optional supplement at the planner's discretion, not as the proof.

---

## Extraction scope beyond SEAM-01/03

### Q1 — `prg-image.ts` in or out?

| Option | Description | Selected |
|--------|-------------|----------|
| In — extract now | Two pure functions; discharges `anno-project.ts`'s `glue-with-extractable` obligation immediately. Because the host module ships, `files[]` gains `prg-image.ts` | ✓ |
| Out — registry obligation only | Keeps Phase 27 to the three requirements; never touches the tarball | |
| In, as a registry-driven sweep | Extract every `glue-with-extractable` symbol; scope only known once the registry is written | |

**User's choice:** In — extract now

### Q2 — The `shippedTsModules()` / `codeOnly()` copies

| Option | Description | Selected |
|--------|-------------|----------|
| Extract, repoint all copies | One shared test-only helper; all four `shippedTsModules()` copies and both true `codeOnly()` copies import it | ✓ |
| Extract, repoint only the anno-adjacent copies | Smaller blast radius; leaves the divergence in the copies nobody is looking at | |
| Out of scope this phase | Roadmap calls it optional; defer to a todo | |

**User's choice:** Extract, repoint all copies
**Notes:** The scout found **four** copies of `shippedTsModules()`, not the one the roadmap names.

### Q3 — Conflict: `comment-phase-pointers.test.ts`'s deliberate duplication

Raised mid-area. `comment-phase-pointers.test.ts:53-59` records its copy as deliberate under a "no import between sibling guard tests" convention.

| Option | Description | Selected |
|--------|-------------|----------|
| Shared helper module satisfies it | The convention forbids importing another *guard test*, not a neutral helper — `spawn-seam.test.ts` already imports `anno-test-gate.ts` that way. Rewrite the comment in the same commit to state the scope | ✓ |
| Honour it — leave the two guard tests alone | Respects the record; leaves the divergence hazard | |
| Overrule it explicitly | Same end state, framed as a reversal | |

**User's choice:** Shared helper module satisfies it

### Q4 — Criterion 4's green run and the known BACK-05 red

| Option | Description | Selected |
|--------|-------------|----------|
| Stop the broker, record the command | Evidence names the exact command and states the broker was stopped; the BACK-05 todo stays open and out of scope | ✓ |
| Also require a baseline run before the move | Before/after pair; costs an extra full run per plan | |
| Fold the BACK-05 todo into this phase | Scope creep into broker behaviour | |

**User's choice:** Stop the broker, record the command

---

## Claude's Discretion

Left open with a stated lean; the planner decides. Full detail in CONTEXT.md `<decisions>` → "Claude's Discretion".

- Adapter module name (lean: `block-class.ts` / `annotation-blocks.ts`)
- Whether `AnnoBlockEntry` / `AnnoSymbol` / `AnnoComment` move with the adapter (lean: only `AnnoBlockEntry`)
- Whether the registry covers `anno-*.test.ts` and `anno-regbits.json` (lean: modules + the JSON, not test files)
- Registry file format, TS vs JSON (lean: TS)
- Plan decomposition and ordering within the phase

Plus one standing hazard recorded rather than chosen: the enforcing test must assert relations, not a pinned module count — the failure mode already seen in `audit-integrity.test.ts`.

## Deferred Ideas

- Renaming `anno-coverage.ts` off the prefix — deferred to Phase 31/32
- The remaining eight `anno-*` capability renames — classification only this phase
- The partial `codeOnly()` variants in `disasm-decoder`, `disasm-renderer`, `disasm-opcodes` and `anno-tools` tests — different job, not consolidated

Six todos matched Phase 27 by keyword; none folded. See CONTEXT.md `<deferred>` → "Reviewed Todos".
