# Phase 45 plan 45-04 -- planted-control evidence (D-09)

**MEASURED** 2026-09-11, on this host, against the REAL `dxa/tracer.prg`
annotation store plan 45-01 derived and live-executed
(`.c64-re-tools/phase45-scratch/tracer.annostore`, sha256
`dbe2e73e4f11a5da280bdd20ced245cd679244edf3d506726dce69bcd64a4f32`, real
`argvDigest`/`imageSha256`/`seed` `c3710dd6677e9e3198e7d094cacce8c76009b44edf03dc8bfa077b76fd6a5864`
/ `875c96218be61538bc71cf6986e37af0e8bc7e4669c85759bb1813f4a689b8a5` /
`phase45-01-tracer-fixed-seed` recorded in that store's own `evid-runs`
table). No `x64sc` process and no VICE broker were involved in this task --
D-06 already establishes that `decomp-completeness` reaches no broker; both
were independently confirmed stopped/inactive before and after this session
(`pgrep -x x64sc` empty, `systemctl --user is-active vice-broker` ->
`inactive`).

This document exists because the milestone's own stated discipline is that
**asserting a fix is present proves nothing; making the failure happen does**
(D-09). Each control below was actually run, its exact output captured
verbatim, and the plant reverted immediately after observation -- never
left in place, never committed.

---

## Control 1 -- OBSERVED RED: the disagreement input removed entirely

**What was done:** invoked `anno decomp-completeness` against the real store
with `--disagreements` omitted (D-09 mechanism 1's own required-argument
check).

**Command (exact):**

```
node vice-proxy.ts anno decomp-completeness \
  --store /home/henrik/dev/henrik/git/c64-re-tools/.c64-re-tools/phase45-scratch/tracer.annostore \
  --manifest fixtures/decomp-execution-manifest.json
```

(run from `src/mcp/vice/`; the same refusal was independently re-observed
through the skill script's own `main()` -- see below.)

**Captured stderr (exact):**

```
decomp-completeness: --disagreements FILE is required -- there is no default and no empty-array substitute; omitting the disagreement input must never render the same report as a real, empty answer (D-09).
```

**Exit code:** `exit=1`

**No report body was printed.** `stdout` carried only the USAGE help text
(150 lines, the same `--help`-shaped text every unknown-argument refusal
prints) -- at no point did any of the report's own headings (`FIXTURE:`,
`BYTE CENSUS`, `SURVIVORS`, `DISAGREEMENTS`, `RANGE PROVENANCE`, `ENTRY
POINTS`, `REFERENCED NON-HARDWARE ADDRESSES`, `GATE:`) appear anywhere in
the captured output. Confirmed by direct inspection of the captured stdout,
not merely by absence-of-error-implies-absence-of-body reasoning.

**Re-observed through the skill script's own `main()` (the actual consumer
this control's permanent test pins):**

```
$ node -e '
import("./src/skills/routine-queue-walker/scripts/completeness-report.mjs").then(async (mod) => {
  const exit = mod.main(["--store", ".../tracer.annostore", "--manifest", "src/mcp/vice/fixtures/decomp-execution-manifest.json"]);
  console.log("EXIT_CODE=" + exit);
});
'
```

**Captured output (exact):**

```
completeness-report.mjs: anno decomp-completeness exited 1: decomp-completeness: --disagreements FILE is required -- there is no default and no empty-array substitute; omitting the disagreement input must never render the same report as a real, empty answer (D-09).

EXIT_CODE=1
```

**This plant was reverted:** nothing was changed to produce this control --
the omission IS the invocation. No file was modified or needs restoring.

---

## Control 2 -- OBSERVED RED: the disagreement input emptied, with a foreign run identity

**What was done:** supplied a syntactically valid `--disagreements` document
(`disagreements: []`, every `EvidReconciliation` field present) whose
`runIdentity` is a FABRICATED triple (`imageSha256`/`argvDigest` of
all-zero/all-one 64-hex-digit strings, `seed: "fabricated"`) that matches NO
row in the real store's own `evid-runs` table.

**The fabricated document (exact, `tracer-disagreements-fabricated.json`,
left over from plan 45-01's own Wave 0 run against this SAME store):**

```json
{
  "store": "/home/henrik/dev/henrik/git/c64-re-tools/.c64-re-tools/phase45-scratch/tracer.annostore",
  "runIdentity": {
    "imageSha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "argvDigest": "1111111111111111111111111111111111111111111111111111111111111111",
    "seed": "fabricated"
  },
  "disagreements": [],
  "disagreementCount": 0,
  "agreementCount": 3,
  "blockCoveredNeverObservedCount": 18,
  "observedOutsideAnyBlockCount": 1991,
  "observedAtUndefinedBlockCount": 0,
  "denominator": 21,
  "positiveClass": "code",
  "tier": "runtime-observed"
}
```

**Command (exact), through the skill script's own `main()`:**

```
$ node -e '
import("./src/skills/routine-queue-walker/scripts/completeness-report.mjs").then(async (mod) => {
  const exit = mod.main([
    "--store", ".../tracer.annostore",
    "--disagreements", ".../tracer-disagreements-fabricated.json",
    "--manifest", "src/mcp/vice/fixtures/decomp-execution-manifest.json",
  ]);
  console.log("EXIT_CODE=" + exit);
});
'
```

**Captured output (exact):**

```
completeness-report.mjs: anno decomp-completeness exited 1: decomp-completeness: the --disagreements document's run identity (image_sha256=0000000000000000000000000000000000000000000000000000000000000000, argv_digest=1111111111111111111111111111111111111111111111111111111111111111, seed="fabricated") matches no row in /home/henrik/dev/henrik/git/c64-re-tools/.c64-re-tools/phase45-scratch/tracer.annostore's own evid-runs table -- a fabricated or foreign document is refused, never rendered.

EXIT_CODE=1
```

**Exit code:** `exit=1`

**This is the control that matters most.** The document is a REAL, complete
`EvidReconciliation` shape -- `disagreements: []`, every count field present,
no missing key -- exactly what a genuine "this run found zero disagreements"
answer looks like. The ONLY thing distinguishing it from a real answer is
the run identity, and the refusal names that identity verbatim, proving the
gate distinguishes "no disagreements" from "the query was never run against
this store" rather than accepting any well-shaped document as license to
render.

**This plant was reverted:** the fabricated document is a pre-existing,
disclosed artifact from plan 45-01's own Wave 0 measurement session (never
the real disagreements document, never used as an argument to any command
outside this control) -- nothing needed restoring. `git status --porcelain`
confirms no tracked file was touched by this control.

---

## Control 3 -- OBSERVED RED (documentary): the required-field guard deleted from a scratch copy

**What was done:** a scratch copy of `completeness-report.mjs` was made
alongside the real file (same directory, so its own relative import of
`mcp-module.mjs` still resolved), the `disagreementInput`/`runIdentity`
completeness guard at the top of `renderCompletenessReport()` was deleted
(the `if (input === undefined || ... ) { throw new
MissingDisagreementInputError(...) }` block, twelve lines), and the
previously-green render was re-run against a report object with
`disagreementInput` OMITTED entirely. The scratch copy was deleted
immediately after this single observation.

**The deleted guard (exact, before deletion):**

```js
  const input = report?.disagreementInput;
  const identity = input?.runIdentity;
  if (
    input === undefined ||
    input === null ||
    typeof identity !== "object" ||
    identity === null ||
    typeof identity.imageSha256 !== "string" ||
    typeof identity.argvDigest !== "string" ||
    typeof identity.seed !== "string"
  ) {
    throw new MissingDisagreementInputError(
      "renderCompletenessReport: no disagreement input is present on this report -- refusing to render. " +
        "Pass --disagreements to `anno decomp-completeness` (the JSON `anno evid-disagreements --json` wrote " +
        "for the SAME store); an omitted query and a query that found nothing must never render the same report.",
    );
  }
```

**Command (exact) against the scratch copy, with a synthetic report object
carrying every field EXCEPT `disagreementInput`:**

```
$ node -e '
import("./src/skills/routine-queue-walker/scripts/completeness-report.SCRATCH-DO-NOT-COMMIT.mjs").then((mod) => {
  const report = { store: "test-store", fixture: "dxa/tracer.prg", executionDisposition: "executed",
    notExecutedReason: null, byteCensus: { byType: { byte: 15, code: 6 }, undefinedCount: 0, denominator: 21, undefinedRanges: [] },
    survivors: [], rangeProvenance: [], entryPoints: [], referencedAddresses: { resolved: [], declined: [], unresolved: [], denominator: 0 },
    disagreementResolution: { rows: [], unresolvedCount: 0, denominator: 0 } };
  try {
    console.log("NO THROW -- rendered text follows:");
    console.log(mod.renderCompletenessReport(report));
  } catch (err) {
    console.log("THREW:", err.constructor.name, err.message);
  }
});
'
```

**Captured output (exact, verbatim, whichever occurred):**

```
THREW: TypeError Cannot read properties of undefined (reading 'disagreementCount')
```

**What this proves:** with the guard deleted, the renderer does NOT
silently produce a "no disagreements" report -- it throws a `TypeError`
later in the function, the instant it tries to read `input.disagreementCount`
off the now-`undefined` `input`. This is the "throws elsewhere" branch this
control's own action text names as an acceptable outcome (the other named
branch, "produces a report with no disagreement section", did NOT occur).
Either branch proves the SAME thing: the `disagreementInput` field is
load-bearing to every line after it in the renderer, not decorative --
deleting its own guard does not make the renderer produce a plausible-looking
empty answer, it makes the renderer crash trying to use data that was never
there. This is the proof that the required OUTPUT-SCHEMA field (D-09
mechanism 2) actually does something, distinct from Control 1/2's proof that
the required ARGUMENT (D-09 mechanism 1) actually does something.

**This plant was reverted:** the scratch copy
(`completeness-report.SCRATCH-DO-NOT-COMMIT.mjs`) was deleted immediately
after the single observation above. `git status --porcelain
src/skills/routine-queue-walker/scripts` was confirmed clean of any scratch
or `.bak` file before this plan's own commits were made.

---

## Summary

| Control | Mechanism proven | Exit code | Where pinned |
|---|---|---|---|
| 1 -- input omitted | D-09 mechanism 1 (required argument, no default) | `exit=1` | permanent test in `completeness-report.test.mjs` |
| 2 -- input emptied, foreign run identity | D-09's anti-vacuity distinction ("no disagreements" vs. "query never run") | `exit=1` | permanent test in `completeness-report.test.mjs` |
| 3 -- required field deleted from renderer | D-09 mechanism 2 (required output-schema field) | n/a (threw `TypeError`, documentary only) | this document only, per the plan's own instruction that control 3 stays documentary |

No control in this document was run against a synthetic store: controls 1
and 2 ran against the real `dxa/tracer.prg` store plan 45-01 derived and
live-executed; control 3 ran against a synthetic in-memory report object
(matching the plan's own instruction that the scratch-copy experiment is a
code-level probe, not a store-level one) through that same real module,
copied and reverted.
