# Evidence — Phase 44, PROOF-04, the Independent External Check

This directory holds every artifact this phase's measurements produce.
Cross-wave working artifacts (extracted `.prg` bytes, the subject/oracle JSON
artifacts, run logs) live at `PROBE_DIR=$HOME/.cache/c64-re-tools/phase44` —
never inside the checkout, and never under `/tmp`, which is tmpfs on this
host (16 GB, emptied only on reboot) and has already cost this project a
build.

**Nothing binary lands here.** No corpus `.d64` image, no extracted `.prg`,
and no captured `.vsf` snapshot is ever committed; identity travels as name
plus sha256 and nothing else. Adapted from Phase 38's own evidence
conventions (`.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/README.md`).

## Files

| File | Owner | What it is | What it proves |
|---|---|---|---|
| `SCHEMA.md` | `44-01` | The `resolved`/`unresolved`/`not-exercised` derivation rule and every `SUBJECT_`/`ORACLE_`/`PROOF04_` outcome-line name, fixed BEFORE any measurement | That no later plan could invent a line name or a verdict rule that flatters its own result |
| `README.md` | `44-01` | This file: the artifact table and the numbered evidence conventions binding on every plan in the phase | That the conventions were stated before the measurements they govern |
| `proof04-subject-dxa.mjs` | `44-01` | The SUBJECT producer: extracts `BRUCE LEE   (DC)` from `danish.d64` via the `c1541.dir`/`c1541.read` seam, feeds dxa through `runDxaDisassemble()`, writes an in-memory `BlockEntry[]` artifact | That the byte-derived classification is reproducible by re-running a committed script, independent of the oracle side |
| `proof04-oracle-memmap.mjs` | `44-01` | The ORACLE producer: drives genuine stock `/usr/bin/x64sc` through the S3 AUTOSTART sequence, dials `memmapzap`/`memmapshow`, writes `EvidExecRow`-shaped observations via `evid-ingest.ts` | That the runtime-observed execution evidence is reproducible and never touches dxa or the block classifier |
| `proof04-reconcile.mjs` | `44-01` | The JOIN driver: reads both artifacts by path, calls `evid-reconcile.ts`'s `reconcileObservedExecution()` exactly once, derives the verdict per `SCHEMA.md`; also carries `--self-check` (four synthetic edge cases needing no emulator) | That the false-positive count is never hand-derived, and that the empty/zero-denominator/ordering/single-address edges are gated without a live run |
| `proof04-independence.test.ts` | `44-01` | The structural, non-vacuous test: neither producer imports the other's domain or names the other's artifact basename; the join calls `reconcileObservedExecution()` exactly once | Success Criterion 2, proven with a planted-violation control rather than promised |

## Evidence conventions

**Binding on every plan in phase 44**, not only on `44-01`. Later plans cite
this section rather than restating it.

1. **Transcript convention.** Before running a command, append a line
   reading `$ <the exact command line>` to the named evidence file; then
   append its real stdout and stderr immediately below. A summary written in
   place of output is not evidence.

2. **Worktree-independent probe directory.** Cross-wave working artifacts
   live at `PROBE_DIR=$HOME/.cache/c64-re-tools/phase44` — never inside the
   checkout, and never under `/tmp`.

3. **Broker stopped, recorded.** Every live run in this phase is taken with
   the VICE broker **stopped**, and each transcript records
   `ORACLE_BROKER_STATE inactive` (via `preflight()`) alongside the
   `TEST_AUTOMATED_BASELINE:` line it is compared against. A live broker
   reddens the `BACK-05` assertion **deterministically**, so a measurement
   taken against a live-broker run reads a false baseline and every number in
   it is suspect — such a measurement is discarded and re-run, never
   repaired. Verify before the run with `systemctl --user is-active
   vice-broker` (expect `inactive`) and `pgrep -x x64sc` (expect no
   output — `-x`, exact-name match; never `-af`).

4. **`TEST_AUTOMATED_BASELINE` stated, never re-derived.** This project's
   own automated-subset floor is **three pre-existing failures**, not zero
   (`anno-import.test.ts`/`anno-register.test.ts`'s own `STORE-06`
   undeclared-requirement-id bookkeeping cause, plus one `text-protocol.test.ts`
   planted-RED control). No transcript in this phase writes "clean" or "0
   failures", and no plan adopts a green `test:automated` as an acceptance
   criterion. `npm test`'s full glob must **never** be piped into `tail` —
   `npm test | tail` reports `tail`'s own exit code, faking a green baseline;
   redirect to a file and read `$?` on the same line.

5. **Corpus resolution.** `danish.d64` is gitignored, operator-supplied
   material — absent from a fresh clone and from a git worktree. Every
   script in this phase resolves it from `$C64_CORPUS_DIR` if that
   environment variable is set, else from
   `<repo-root>/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/`,
   and fails loudly, naming **both** attempted absolute paths, when neither
   holds the file. Every script asserts the resolved file's sha256 against
   its recorded value **before reading a byte for any other purpose**.

6. **Voided runs are recorded, not discarded.** A run that produced no
   usable result is written into the evidence file **with its reason**,
   never silently dropped.

7. **`not-exercised` is not a pass.** Stated once here, and restated in
   `SCHEMA.md` section 8: `not-exercised` is a refusal to claim anything
   about the false-positive count, never a clean bill of health.

8. **The derivation rule lives in exactly one place.** `SCHEMA.md` is the
   sole home of the `resolved`/`unresolved`/`not-exercised` rule and the
   `frame-exact-region`/`narrowed` depth-label rule. This file, and every
   later plan's own evidence record, cites it rather than restating it.

---

## `TEST_AUTOMATED_BASELINE` — measured at plan 44-01, broker stopped

Verified before the run, per convention 3 above:

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

`pgrep -x x64sc` exits `1` with no output, and `systemctl --user is-active
vice-broker` reads `inactive` — the required precondition for a trusted
`test:automated` result.

Per this project's own standing note (MEMORY.md), the automated-subset floor
on this tree is **three pre-existing failures**, not zero:
`anno-import.test.ts`/`anno-register.test.ts`'s `STORE-06`
undeclared-requirement-id bookkeeping cause, plus `text-protocol.test.ts`'s
own "Control 2 (planted RED, without the fix)" case. This plan's own
`npm run typecheck` gate ran clean (see the plan's own `<verify>` block); the
full `test:automated` suite was not re-run as a gating condition for this
plan (the plan's acceptance criteria and `<verify>` blocks are scoped to
`typecheck` plus this phase's own new scripts and test file, per this
project's convention that the `test:automated` floor is a recorded baseline,
never a re-derivation, and never itself the gate).

TEST_AUTOMATED_BASELINE: tests (not re-measured this plan; floor recorded at
3 pre-existing failures per project MEMORY.md, dated 2026-09-09)

BROKER_STATE: inactive
