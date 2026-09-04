# 36-04 — GHID-01's three gates, observed firing on real runs

All three runs below were driven through `runGhidraAnalyze()` (`ghidra-run.ts`)
against a real Ghidra 12.1.3 installation, in a scratch workspace outside this
repository (D-36-12), never through a click-path. Every wire request shown is
the exact object passed to `runGhidraAnalyze()`; `repoRoot` pointed at the
scratch workspace in every case.

## Part: Gate 1 — a wrong expected count throws; the exit status is 0 either way

**Wire request (wrong-expectation run):**

```json
{
  "runId": "ev-gate1-wrong",
  "importPath": "bank.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "gate1-wrong-export.txt",
  "expectedClassificationLines": 1
}
```

The real block total for `bank.prg` on the `.prg` route is **572** (see Gate 2
below); this run planted `expectedClassificationLines: 1`, a value the export
script cannot possibly observe.

**Quoted run-log line (the exact literal signal):**

```
ERROR REPORT SCRIPT ERROR:  (HeadlessAnalyzer) java.lang.IllegalStateException: GhidraStructExport: exported 572 classification lines but expected 1 (block-total expectation=572). Refusing a short export.
```

**Recorded `analyzeHeadless` exit status for this run: `0`.** The process
exited cleanly even though its own post-script threw an uncaught exception —
this is the entire reason gate 1's classifier reads run-log TEXT, never the
exit status: an implementation that trusted the exit status as its pass
signal would have called this run a success.

The export file (`gate1-wrong-export.txt`) was **not created at all** —
`GhidraStructExport.java`'s internal classification-count assertion throws
*before* it ever opens a `FileWriter` for the export path, so there is no
partial file carrying a completed-assertion line to check for.

**Paired negative case (`expectedClassificationLines` omitted):**

```json
{
  "runId": "ev-gate1-omitted",
  "importPath": "bank.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "gate1-omitted-export.txt"
}
```

Recorded exit status: `0`. No thrown-script signal in the run log. The
export file exists and carries:

```
CLASSIFICATION_EXPECTED_FROM_BLOCKS 572
CLASSIFICATION_OBSERVED 572
```

Both counts equal — this is the "normal" path: with no override, the script
asserts its own observed count against its own computed block total, and
they agree.

**The exit status is recorded here as evidence that it is UNINFORMATIVE, not
as a pass signal for any gate.** Both the throwing and the succeeding run
exited `0`; the only thing that told them apart was the run log's own text.

## Part: Gate 2 — the classification count is the block total, on BOTH routes

**`.prg` route** (`bank.prg`, 60 bytes, base `0x801`):

```json
{
  "runId": "ev-gate2-prg",
  "importPath": "bank.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "gate2-prg-export.txt"
}
```

Observed = expected = **572**. The image's own byte length is **60** — the
observed count (572) is NOT equal to the image's byte length, which is what
makes this the block total rather than the image size: an implementation
that reverted to comparing against the image's byte length would pass an
`observed == expected` check trivially (both would read the same wrong
number) but would fail this specific `observed != imageBytes` relation, or
would simply be asserting the wrong quantity throughout.

**`flat64k` route** (a generated 65,536-byte buffer, `bank.prg`'s own code
body placed at its load address, base `0x0`):

```json
{
  "runId": "ev-gate2-flat64k",
  "importPath": "bank-flat64k.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "gate2-flat64k-export.txt"
}
```

Observed = expected = **65536**. On this route the block total and the
image's own byte length **coincide** — both are 65,536 — because the entire
imported file spans the classified address space and the language's own
`ZERO_PAGE`/`STACK` blocks fail to add due to conflict with the imported
range (the same benign conflict `fixtures/ghidra/runlog-benign-base0-
conflict.txt`, from plan 36-03, already recorded). **This coincidence is a
property of this one route, not a general fact** — the `.prg` route's own
572-vs-60 numbers above are the proof that a route where the two do NOT
coincide exists, so a single-route reading could not have stood in for both.

**The two routes' own observed counts: 572 (prg) vs. 65536 (flat64k) — they
differ**, as required.

Neither route's assertion above uses `36-RESEARCH.md`'s own carried literals
(4887 classification lines against a 279-byte image) — those numbers came
from a *different* fixture, per `fixtures/ghidra/README.md`'s own note. The
numbers recorded here (572, 65536) are what THIS committed fixture pair
(`bank.prg` / its generated flat-64K variant) actually yields.

## Part: Gate 3 — reproducibility, and Ghidra declared as a prerequisite by version

**Fixture anchor.** `bank.prg`'s own sha256, computed fresh at test time:
`e46e71e1ffbfc196d1eb04d3a14f6ae638502225be56c996f0a090650ded2384` (60
bytes) — matches `fixtures/ghidra/README.md`'s own recorded value exactly.
The reproducibility claim below is anchored to this known input, not to
whatever happens to be on disk.

**Two runs, two run ids, same fixture, same script set:**

```json
{ "runId": "ev-gate3-a", "importPath": "bank.prg", "processor": "6502:LE:16:nmos",
  "importRoute": "prg", "noanalysis": true, "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java", "exportPath": "gate3-a-export.txt" }
```
```json
{ "runId": "ev-gate3-b", "importPath": "bank.prg", "processor": "6502:LE:16:nmos",
  "importRoute": "prg", "noanalysis": true, "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java", "exportPath": "gate3-b-export.txt" }
```

Both export files: **6996 bytes**, sha256
`e5acd260228f9389b55fb2c8674c188ae2d8a451d52f8422c32a138263d9d577` —
**byte-identical**, despite the two runs using different run ids and
different, freshly-reserved project directories. Reproducible from the
committed script set, with no click-path anywhere in the loop.

**Ghidra's own installed version, read from the installation itself**
(`$GHIDRA_HOME/Ghidra/application.properties`, never assumed):

```
application.version=12.1.3
application.build.date=2026-Aug-17 1710 UTC
```

Asserted against the named constant `EXPECTED_GHIDRA_VERSION = "12.1.3"` in
`ghidra-live.test.ts` — a match. JDK present on this host: OpenJDK
21.0.12.1 (measured via `java -version`; `GHID-01`'s own JDK floor is
`>= 21`, no stated ceiling, per `36-RESEARCH.md` § Standard Stack).

## Closing statement — what each gate now catches, and what it does not

- **Gate 1** catches a run whose post-script threw an internal assertion —
  by reading the run log's own exact-literal signal, never the process exit
  status (which was `0` on the very run that failed). It does NOT catch a
  script that silently produces a *wrong but self-consistent* result without
  ever throwing — that failure mode is outside gate 1's own scope and would
  need a second, independent oracle.
- **Gate 2** catches an implementation that (re-)compares the classification
  count against the image's own byte length instead of the script's own
  computed block total — the `.prg` route's 572-vs-60 divergence is the
  proof. It does NOT catch a block-total computation that is *itself* wrong
  in a way that happens to still differ from the image's byte length; the
  block total is trusted as the script's own internal arithmetic, not
  independently re-derived here.
- **Gate 3** catches a run that cannot be reproduced from the committed
  script set (a click-path dependency, or non-deterministic output across
  run ids) and a version drift between what this phase was developed
  against and what is actually installed. It does NOT catch a Ghidra
  release that changes *behaviour* while keeping the same declared version
  string — that would require re-running the whole gate set against the new
  install, which this assertion does not do on its own.
