# Phase 45 plan 45-06 — Derivation and execution evidence

MEASURED 2026-09-11, on this host, against genuine tool installs (never
installed by this session — detected, per the project's standing "detect,
then refuse by name" convention).

## Tool versions used throughout this document

| Tool | Path / version |
|---|---|
| `dxa` (vendored) | `src/mcp/vice/vendor/dxa/dxa`, sha256 `0e2bf1a5ea4433c795dbcc96089a29eb8efb6bdaad73f065a5443d31f0ec8523` |
| Ghidra `analyzeHeadless` | `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, `C64NmosLanguage` extension already installed, processor id `6502:LE:16:nmos` |
| `x64sc` (stock VICE) | `/usr/bin/x64sc` (genuine unpatched stock; `/usr/local/bin/x64sc` shadows it earlier on `$PATH` and is the custom fork — the absolute path was used throughout) |

`pgrep -x x64sc` and `systemctl --user list-units 'vice-broker*'` were both
confirmed empty immediately before this session's first live run.

## Task 1 — the derived half (dxa + Ghidra, no names)

For each of the six fixtures: `runDxaDisassemble()` (imageKind `"prg"`
always — dxa reads the `.prg`'s own 2-byte header for origin, regardless of
the Ghidra route) classified every in-window byte as `class: "code"` or
`class: "data"`/`"unclassified"`; every range was written via
`anno_set_data_type` (`code` → `dataType: "code"`, everything else →
`dataType: "byte"`). dxa's own `-a dump` always emits either a decoded
instruction line or a `.byt`/`.word` data line for every in-window byte, so
this route never produces a third "unknown" class — there was no gap to
close for any of the six fixtures.

Entry points were supplied to dxa (`-R`, no `$` prefix) ONLY for the three
fixtures with a genuine, manifest-declared entry point that the SYS target
or load address actually names: `dxa/tracer.prg` (`0810`),
`dxa/fixture.prg` (`0810`, `fixture.a`'s own `start:` label), and
`export-asm/smc.prg` (`0801`, its own load address — the program has no
BASIC stub). `dxa/basic-stub.prg`, `petcat/computed-sys.prg` and
`petcat/not-basic.prg` were dxa'd WITHOUT any entry point, so their entire
body classified as data — this is the deliberate safety property: `dxa/basic-stub.prg`'s
own `10 SYS 2064` target ($0810) lands exactly on the fixture's four
arbitrary trailing bytes (`aa bb cc dd`), so naively re-using the "SYS target
= entry point" heuristic that correctly applies to `tracer.prg`/`fixture.prg`
would have fabricated code from the fixture's own planted-unknown ground
truth. It was not applied here.

Ghidra ran with NO `preScript`/`entrypointsPath` for any of the six fixtures
(mirrors plan 45-01's own precedent, `.planning/phases/45-decomposition-to-closure-disagreement-first/evidence/phase45-wave0-measurements.md`
MEASUREMENT A — entrypointsPath requires a preScript on the wire and
`## REFERENCES` is measured unchanged by the volatile carve, so it buys
nothing for this xref-only import). Route per `fixtures/decomp-execution-manifest.json`:
`flat64k` for `dxa/tracer.prg` and `dxa/fixture.prg` (a padded 65,536-byte
image built fresh from the `.prg`, never committed), `prg` for the other
four. `anno_import_ghidra_export` wrote ZERO xrefs for all six fixtures —
none has a JSR/JMP or an address Ghidra's own default auto-analysis
recognised as a function entry point.

| Fixture | dxa code ranges | dxa data/unclassified ranges | Ghidra xrefs | Coverage check |
|---|---|---|---|---|
| `dxa/tracer.prg` | 3 | 5 | 0 | body=21, summed=21, origin=$801 — MATCH |
| `dxa/fixture.prg` | 14 | 82 | 0 | body=279, summed=279, origin=$801 — MATCH |
| `dxa/basic-stub.prg` | 0 | 6 | 0 | body=16, summed=16, origin=$801 — MATCH |
| `export-asm/smc.prg` | 4 | 0 | 0 | body=11, summed=11, origin=$801 — MATCH |
| `petcat/computed-sys.prg` | 0 | 8 | 0 | body=24, summed=24, origin=$801 — MATCH |
| `petcat/not-basic.prg` | 0 | 21 | 0 | body=62, summed=62, origin=$a03 — MATCH |

Every one of the six exported documents: `schemaVersion: 1`, zero labels,
zero comments, every range and comment row `provenance: "derived"`, at
least one range, zero `dataType: "undefined"` ranges. `dxa/basic-stub.prg`'s
four arbitrary trailing bytes ($080d-$0810) are typed `byte` — confirmed no
range in that document is `dataType: "code"` at or past `$080c`.

**Interpretive decision, disclosed (not a numbered rule — plan 45-01's own
precedent applied consistently across all six fixtures):** every byte dxa's
own map classified as `"data"`/`"unclassified"` is typed `byte`, never a
finer distinction (`petscii`/`word`/`address`) — dxa's `-a dump` output
carries no such distinction itself, and injecting one here would be an
unproven, authored refinement smuggled into the derived half. Finer
semantic retyping (e.g. `dxa/fixture.prg`'s own array/dispatch-table/text
regions its own `.a` source names) is authored judgment, correctly deferred
to plan 45-08's closure pass.

## Task 2 — the three live execution runs

The broker was started as a transient `systemd-run --user` unit for EACH of
the three runs (never `setsid`, never `nohup`), and stopped
(`systemctl --user stop <unit>`) immediately after each one. Exact unit
invocation used (per run, `<unit>` and the scratch state dir varied by
fixture):

```
systemd-run --user --unit=<unit> --collect \
  --setenv=VICE_BACKEND=stock --setenv=VICE_BIN=/usr/bin/x64sc \
  --setenv=VICE_BROKER_CONTROL_PORT=0 --setenv=VICE_BROKER_MAX=1 \
  --setenv=XDG_CONFIG_HOME=<scratch>/xdg-config \
  -- node resources/vice-broker.mjs --repo-root <ROOT> --state-dir <scratch>/broker-state
```

**MEASURED, disclosed finding: every stock monitor command implicitly
re-pauses the emulated machine.** `vice_execution_run()` must be re-issued
before EVERY subsequent poll, not once before a wait loop — a single
`vice_execution_run()` followed by repeated `vice_checkpoint_list()`/
`vice_registers_get()` polls left the CPU frozen indefinitely (PC unchanged
across a 10-second, 10-poll window, confirmed independently of `systemd-run`
via a plain `spawn()`-launched broker). This mirrors
`stock-broker-live.test.ts`'s own `pollUntilBytesMatch()`, which already
calls `vice_execution_run()` on every iteration — the same discipline was
applied here (`vice_execution_run()` then a bounded wait then
`vice_checkpoint_list()`, repeated, never a single upfront resume).

**MEASURED, disclosed finding: `export-asm/smc.prg` has no BASIC stub, and
`vice_autostart`'s own `run: true` keyboard-buffer injection has nothing to
run** (BASIC's own program area is empty for a bare machine-code PRG) — the
machine idles at the KERNAL's keyboard-scan loop (`$e5d1`-area) forever.
For this ONE fixture, the entry point was set directly
(`vice_registers_set(PC=$0801)`) after a plain load (`run: false`), with the
status register's I flag also forced on first (`vice_registers_set(FL, ...
| 0x04)`), since this fixture never executes `SEI` itself and a raster/timer
IRQ landing mid-bound would consume steps servicing the KERNAL rather than
retiring this fixture's own loop.

### Run 1 — `dxa/tracer.prg`

- `vice_autostart({path, run: true})` → `runState: "running"`.
- `vice_checkpoint_add({start: 0x815, exec: true, stop: true})` → id 1.
- Checkpoint hit confirmed via `hit_count` polling (never on paused state).
- `vice_execution_step({count: 1})` — retires the RTS itself.
- `memmapshow` captured: 1,651,493 bytes (matches plan 45-01's own
  MEASUREMENT exactly for this fixture).
- Real launch argv (transcribed from the broker's own journal `launching
  ...` line, never rebuilt): `["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]`
- `image_sha256`: `875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5`
- `seed`: `phase45-06-tracer-fixed-seed`
- Run identity triple (image_sha256, argv_digest, seed), exactly as `anno_evid_runs`/`anno evid-disagreements --json` report it:
  `{"imageSha256":"875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-06-tracer-fixed-seed"}`
- `execObservations`: 1994 (matches plan 45-01's own MEASUREMENT exactly).
- Per-byte real execute evidence at the code range: `$0810`, `$0812`,
  `$0815` (the three opcode bytes — `LDA`, `STA`, `RTS` — never the operand
  bytes, matching real 6502 execute semantics exactly as plan 45-01's own
  transcript recorded).
- `anno evid-disagreements --json`: `disagreementCount: 0`, `agreementCount: 3`,
  `blockCoveredNeverObservedCount: 18`, `observedOutsideAnyBlockCount: 1991`,
  `denominator: 21`.

### Run 2 — `dxa/fixture.prg`

- `vice_autostart({path, run: true})` → `runState: "running"`.
- `vice_checkpoint_add({start: 0x820, exec: true, stop: true})` — the
  `bne l817` instruction closing the array-copy loop; chosen because it is
  the LAST instruction dxa proved is code before the fixture's own
  `jmp ($00fb)` indirect dispatch (an unresolved computed jump this session
  deliberately never executes — the target depends on runtime dispatch-table
  contents this session never established, and following it risks an
  uncontrolled jump into unmapped/KERNAL territory).
- Checkpoint hit confirmed via `hit_count` polling.
- `vice_execution_step({count: 1})` — retires the BNE itself (real 6502
  behaviour: whether it branches back into the loop or falls through depends
  on the real X register at the real moment of the hit, which varies run to
  run — both landings stay inside the code range this session already
  typed).
- `memmapshow` captured: 1,651,457 bytes.
- Real launch argv: identical to Run 1's (the broker's own launch command is
  fixed).
- `image_sha256`: `62ab9a2c287bf33f959be28409eeae5a46b6bf1ac6d2f7e88b7850611a6fc2c0`
  (BYTE-IDENTICAL to Phase 23's own `fixture.prg`, per `fixtures/dxa/README.md`'s
  own provenance record).
- `seed`: `phase45-06-fixture-fixed-seed`
- Run identity triple (image_sha256, argv_digest, seed): `{"imageSha256":"62ab9a2c287bf33f959be28409eeae5a46b6bf1ac6d2f7e88b7850611a6fc2c0","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-06-fixture-fixed-seed"}`
- `execObservations`: 2000.
- Per-byte real execute evidence at the code range: `$0810`, `$0812`,
  `$0815`, `$0817`, `$081a`, `$081d`, `$081e`, `$0820` — the full array-copy
  loop's own opcode bytes (`LDA #$00`, `STA $D020`, `LDX #$00`,
  `LDA l8bf,x`, `STA l8df,x`, `INX`, `CPX #$20`, `BNE l817`), never an
  operand byte.
- `anno evid-disagreements --json`: `disagreementCount: 0`, `agreementCount: 8`,
  `blockCoveredNeverObservedCount: 271`, `observedOutsideAnyBlockCount: 1992`,
  `denominator: 279`.

### Run 3 — `export-asm/smc.prg` (THE BOUNDED, NEVER-HALTING RUN)

**This fixture's own `jmp $0801` never halts.** The bound used, stated
explicitly:

1. `vice_autostart({path, run: false})` — load only, no BASIC RUN attempt
   (this fixture has no BASIC stub for `run: true` to act on).
2. `vice_registers_set({register: "FL", value: currentFl | 0x04})` —
   forces the I flag on, since this fixture never executes `SEI` itself and
   an IRQ landing mid-bound would consume steps servicing the KERNAL.
3. `vice_registers_set({register: "PC", value: 0x0801})` — jumps straight to
   the entry point (the fixture's own load address).
4. `vice_execution_step({count: 8})` — EXACTLY two full loop iterations
   (`LDA #$00` / `INC $0802` / `STA $D020` / `JMP $0801`, four instructions
   per iteration), never a free-run and never a checkpoint wait.
5. `memmapshow` captured immediately after — no further execution.

No natural termination was waited for, and none exists for this fixture.

- `memmapshow` captured: 1,645,659 bytes.
- Real launch argv: identical to Runs 1/2's.
- `image_sha256`: `81cad9e8ba9b1c46f9bb576e47d16613e0551c7507d7249346247696d0513f39`
- `seed`: `phase45-06-smc-fixed-seed`
- Run identity triple (image_sha256, argv_digest, seed): `{"imageSha256":"81cad9e8ba9b1c46f9bb576e47d16613e0551c7507d7249346247696d0513f39","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-06-smc-fixed-seed"}`
- `execObservations`: 1734.
- Per-byte real execute evidence: `$0801` (the `LDA #$00` opcode byte) shows
  `execute: true`. **Disclosed finding:** the other three opcode bytes
  (`$0803` INC, `$0806` STA, `$0809` JMP) did NOT show `execute: true` in
  this capture despite the 8-step bound covering two full loop iterations —
  a genuine, measured nuance of this fixture's own memmap accumulation this
  session did not fully resolve given the time available, recorded here
  rather than silently omitted or fabricated into a cleaner-looking result.
  The evidence IS real (a genuine execute observation exists for this
  fixture's own entry byte, anchored to a real run identity) — it is simply
  narrower than Runs 1/2's own full-opcode-byte coverage.
- `anno evid-disagreements --json`: `disagreementCount: 0`, `agreementCount: 1`,
  `blockCoveredNeverObservedCount: 10`, `observedOutsideAnyBlockCount: 1733`,
  `denominator: 11`.

### Teardown, per run

`systemctl --user stop <unit>` was run immediately after each of the three
runs above, followed by `pgrep -x x64sc` — confirmed EMPTY after every one
of the three runs, and again at the end of this whole session. No
`.d64`/`.prg`/`.bin`/`.vsf` artifact was ever staged under the fixture tree
(`git status --porcelain src/mcp/vice/fixtures` never showed one).

## The completeness gate, at this stage (expected non-zero — nothing named yet)

`anno evid-disagreements --store <store> --json` was run for all six
fixtures, then `anno decomp-completeness` (both the raw CLI and
`completeness-report.mjs`) for all six. The gate is EXPECTED to exit
non-zero at this point — nothing has been named yet, so the entry-point
name/purpose-comment measure fails for every fixture with a code range.
This expected red is itself evidence the gate measures something real;
recorded below rather than treated as a problem.

| Fixture | Disposition | Gate exit | Failing measures |
|---|---|---|---|
| `dxa/tracer.prg` | EXECUTED | 1 | entry point `$0801` has no authored name |
| `dxa/fixture.prg` | EXECUTED | 1 | entry point `$0801` has no authored name; 7 referenced non-hardware addresses (`$00fb`, `$00fc`, `$0817`, `$08ab`, `$08ae`, `$08bf`, `$08df`) neither named nor declined |
| `export-asm/smc.prg` | EXECUTED | 1 | entry point `$0801` has no authored name; 2 referenced non-hardware addresses (`$0801`, `$0802`) neither named nor declined |
| `dxa/basic-stub.prg` | NOT EXECUTED | 1 | entry point `$0801` has no authored name |
| `petcat/computed-sys.prg` | NOT EXECUTED | 1 | entry point `$0801` has no authored name |
| `petcat/not-basic.prg` | NOT EXECUTED | 1 | entry point `$0a03` has no authored name |

Every fixture's byte census, survivors (0 for all six — zero labels exist
anywhere), disagreements (0 for all six) and disagreement resolution (0
accepted / 0 unresolved of 0 for all six) render cleanly. This is D-12's
intended checkpoint: the derived half is complete and honest; closure
(names, purpose comments, declines) is plan 45-08's own job.

## Task 3 (1) — the three NOT EXECUTED declarations

Rendered, verbatim, through `completeness-report.mjs` (the real CLI path,
not the unit-level `buildCompletenessReport()` shortcut):

```
FIXTURE: dxa/basic-stub.prg
  NOT EXECUTED: A 12-byte canonical 10 SYS 2064 BASIC stub followed by 4 arbitrary bytes (aa bb cc dd) explicitly built as unknown-region ground truth, never real code -- running it would SYS 2064 into four garbage bytes with no defined behaviour, and the fixture's own purpose (byte-derived partition ground truth) does not depend on execution.
```

```
FIXTURE: petcat/computed-sys.prg
  NOT EXECUTED: Pure BASIC (10 sys peek(43)+256*peek(44)) with no machine-code payload of its own; the computed SYS target depends on runtime BASIC-pointer state this standalone fixture never establishes meaningfully. Its entire purpose (petcat.decode's computed-vs-literal SYS handover verdict) is about the BASIC tokenization/decode layer, not about running the program.
```

```
FIXTURE: petcat/not-basic.prg
  NOT EXECUTED: 64 deterministic non-BASIC bytes ((i*7+3) mod 256), the PREP-04 planted-failure fixture for petcat.decode's non-vacuous control. By construction it is not a program; it exists to make petcat.decode refuse it.
```

**The disagreement query WAS run for all three, never omitted.** Each of
these three fixtures' `anno evid-disagreements --json` answer is a REAL
answer over zero observations (`agreementCount: 0`, `disagreementCount: 0`,
`denominator` equal to the fixture's own byte count, `runIdentity: null`
because the store's own `evid-runs` table genuinely holds zero rows) — the
`--disagreements` argument to `decomp-completeness` was a real file
containing this real answer, never an omitted argument and never a
fabricated non-null identity.

### Disclosed deviation: `decomp-completeness` refused a real zero-run answer unconditionally

**[Rule 1 — Bug]** `anno decomp-completeness`'s own `--disagreements`
validator (`validateDisagreementDocumentShape()`, `anno-cli.ts`) and
`completeness-report.mjs`'s own `renderCompletenessReport()` both refused
`runIdentity: null` UNCONDITIONALLY — but `null` is exactly what `anno
evid-disagreements --json` returns (via `listObservedRuns()`) for a store
with zero observed runs, i.e. the real, honest answer this plan's own
`must_haves` requires for the three non-executed fixtures above ("a
non-executed fixture's disagreement answer is a real answer over zero
observations, produced by really running the query — not an omitted
argument"). Before this fix, the real CLI path could not render a
NOT EXECUTED report at all for any of the three fixtures above — only the
unit-level `buildCompletenessReport()` shortcut (which never exercises
`validateDisagreementDocumentShape()`) could.

**Fix:** `null` is now accepted as a well-formed (not malformed)
`runIdentity` shape at both validation sites. The anti-vacuity property
D-09 mechanism 2 exists for is preserved: `cmdDecompCompleteness`'s own
match-check still refuses a null identity when the store's `evid-runs`
table is NOT also empty — a store that DOES carry real runs can never slip
past validation with a null identity, only a genuinely zero-run store can.

**Files modified (outside this plan's own declared `files_modified`,
disclosed):** `src/mcp/vice/anno-cli.ts`,
`src/skills/routine-queue-walker/scripts/completeness-report.mjs`.

**Verification:** `node --test anno-cli.test.ts` (88/88 pass),
`node --test completeness-report.test.mjs` (24/24 pass, including both
permanent planted-control regression tests — a fabricated, non-null,
foreign run identity is still refused exactly as before). All six
committed `.annostore.json` fixtures' reports above were rendered through
the real, fixed CLI paths, not the unit-level shortcut.

**Commit:** see this plan's own git history (`fix(45-06): ...`).

## Task 3 (3) — idempotence, MEASURED by actually re-running

One fixture of each family was re-derived (Task 1's own action, replayed
verbatim) into a FRESH scratch store, re-exported, and compared against the
already-committed artifact:

- `dxa/tracer.prg`: re-derivation command replayed (`dxa` disassemble,
  imageKind=prg, entrypointsPath=`0810`; `ghidra.analyze` route=flat64k,
  exitStatus=0, scriptThrew=false). Derived-half fields (`schemaVersion`,
  `store`, `ranges`, `labels`, `comments`, `projectEnums`, `enumUsage`,
  `xrefs`) MATCH byte-identically against the committed
  `fixtures/dxa/tracer.annostore.json` — `execObservations` excluded from
  this comparison by design (Task 2's own live-run evidence is out of
  Task 1's own derivation scope; D-03's idempotence claim is about the
  DERIVED half only).
- `export-asm/smc.prg`: re-derivation command replayed (imageKind=prg,
  entrypointsPath=`0801`; route=prg, exitStatus=0, scriptThrew=false).
  Derived-half fields MATCH byte-identically against the committed
  `fixtures/export-asm/smc.annostore.json`, same exclusion.
- `petcat/not-basic.prg`: re-derivation command replayed (no entrypoints;
  route=prg, exitStatus=0, scriptThrew=false). This fixture carries NO
  `execObservations` at all (declared non-executed), so a FULL-document
  comparison applies — the freshly re-derived and re-exported document was
  written directly OVER the committed
  `fixtures/petcat/not-basic.annostore.json`, and
  `git status --porcelain src/mcp/vice/fixtures` was confirmed EMPTY
  immediately afterward.

**Why `tracer.prg`/`smc.prg` are not overwritten directly:** both carry
real `execObservations` from Task 2's own live run, which a fresh
derivation-only re-run never produces (a brand-new store has zero recorded
runs by construction) — literally overwriting either committed file with a
derivation-only re-export would ERASE that real execution evidence, which
is not what D-03's idempotence claim is about. The field-level comparison
above is the correct, disclosed scoping: it proves the MECHANICAL half
(dxa+Ghidra's own output) regenerates byte-identically, exactly as D-03
claims, without conflating it with Task 2's separately-recorded, genuinely
non-repeatable-on-demand live-execution evidence.

## Final host state

`pgrep -x x64sc`: empty. `systemctl --user list-units 'vice-broker*'`:
empty (every transient unit self-collected via `--collect` once stopped).
`git status --porcelain src/mcp/vice/fixtures`: clean (checked repeatedly
throughout this session, and once more at its end).
