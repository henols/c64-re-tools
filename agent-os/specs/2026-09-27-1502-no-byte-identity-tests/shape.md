# Shape: remove the byte-identity determinism and sync tests

## Scope

Remove every test assertion that compares two runs, two calls or two parses
of the same input with each other (determinism, idempotence), and every
tree-sync guard (a committed copy or build output compared with a fresh
build of its source). Keep every byte comparison against an independent
reference. The per-site list is in `census.md`.

## Owner decisions

- 2026-09-13: byte-identity checks are unproductive and are removed
  (old Phase 54, never started; `roadmap.md` "Remove byte-identical
  assertions from the tests").
- 2026-09-27: keep the correctness checks. These are ACME reassembly
  against the original, transfer integrity, "a refusal or read-only call
  changed nothing", golden and single-source values, security
  indistinguishability, and a comparison tool's own "identical" output.
- 2026-09-27: a CI step replaces the stale-build guards. It regenerates
  the committed generated artifacts and fails on a dirty tree.

## Classification calls (made during the census)

- Regenerator agreement (a committed `.prg` compared with a fresh assembly
  of its `.a`) is a sync guard. It goes, and the CI step covers it.
- `anno-regbits.test.ts`: the fresh-table-equals-committed-JSON test is a
  sync guard and the banner-twice test is determinism, so both go. The
  digest relation and its planted proof are facts and stay.
- These stay:
  - non-vacuity preconditions (a scratch copy equals its source before the
    mutation)
  - a second monitor claim that reuses the same handle (a contract)
  - "a repeat write reports `changed:false`" rules
  - the atomic-build test
  - chunked-result reassembly against the unchunked path
- "Concurrency" tests over synchronous functions only repeat a call, so
  they are determinism and go.
- Four sites get a real assertion instead of only losing one:
  - `dxa-blocks` second emit equals a literal.
  - The `anno-export-asm` `force: true` re-write checks the file set that
    the scopes define.
  - `anno-cli --out` checks that the root file exists.
  - `ghidra-live` GATE 3 keeps its README sha256 check.

## What is knowingly given up

- A change that makes the exporter, a parser, the argv builder, the
  report builders or the fixture corpus non-deterministic is no longer
  caught by the suite.
- The eight `skills/*/scripts/sibling.ts` copies are kept identical by
  hand. No test compares them. Each copy is still exercised by the
  refuse-by-name and run-beside-c64-project tests.
- A stale committed build is caught in CI, not by a local `npm test`.

## The CI step

The CI step deletes the generated `.mjs` files first, so stale, missing
and orphan outputs all show in `git status`. `build()` does not prune, and
`resources-sync`'s orphan direction used to catch that case. The step then
runs every generator that leaves a clean tree clean, needs no network and
needs no emulator.

Each generator was measured on a clean tree on 2026-09-27:

| Generator | Clean tree stays clean | In the step |
|---|---|---|
| `build.ts` | yes | yes |
| `anno-regbits-gen.mts` | yes | yes |
| `fixtures/hazard-subject/make-hazard-subject-fixtures.ts` | yes | yes |
| `fixtures/hazard-subject/make-hazard-subject-annostore.ts` | yes | yes |
| `fixtures/export-asm/make-export-asm-fixtures.ts` | yes | yes |
| `fixtures/coverage/make-coverage-fixtures.ts` | yes | yes |
| `fixtures/hazard-subject/make-exported-edit.ts` | the `.prg` stays clean; `exported-edit-run.json` gets a new timestamp and new input digests | yes, and the run record is restored before the diff |
| `fixtures/vsf/make-fixtures.ts` | no: each sidecar gets a new `capturedAt` | no. No removed test covered it |

Measured proofs of the step script (run locally): a clean tree exits 0. A
committed `.mts` edit without a rebuild exits 1 and names
`resources/broker-home.mjs`. A committed orphan `resources/zz-orphan.mjs`
exits 1 and shows it as deleted.
