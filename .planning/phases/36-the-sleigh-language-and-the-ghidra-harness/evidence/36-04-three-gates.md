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

