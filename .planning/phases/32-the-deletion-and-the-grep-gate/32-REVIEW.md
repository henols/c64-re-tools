---
phase: 32-the-deletion-and-the-grep-gate
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - scripts/check-guard-fates.mjs
  - scripts/check-guard-fates.d.mts
  - scripts/audit-mutation-harness.mjs
  - scripts/lib/audit-root.mjs
  - scripts/lib/audit-root.d.mts
  - src/mcp/vice/guard-fates.test.ts
  - src/mcp/vice/docs-linerefs.test.ts
  - scripts/check-no-regenerator2000.mjs
  - scripts/check-skill-cli-invocations.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - .github/workflows/ci.yml
findings:
  critical: 4
  warning: 14
  info: 7
  total: 25
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The phase ships a genuinely non-vacuous *core*: `checkGuardFates()` is pure, injection-based,
covered by 21 colocated planted-violation tests, and the three sub-set floors use `!==` rather
than `>=`. `scripts/check-guard-fates.mjs` runs green today at 61/61, the removal gate is green,
`docs-linerefs.test.ts` passes, and every one of the 35 recorded `observedRed` rows carries a
distinct, non-truncated excerpt with a matching green control command. The NUL-byte offsets
re-measured in `check-no-regenerator2000.mjs` (15097 / line 315) and the one-hit `-a` difference
at `anno-memmap-render.ts:79` both reproduce, and the two `vice-proxy.ts` function-start
shorthands (`:1505` = `gatherWedgeEvidence`, `:2985` = `forwardToVice`) are factually correct.

What does not hold up is the *periphery* the phase built around that core — specifically the
`--root` seam and the mutation harness, which are the two things the phase's own headers make
the loudest correctness claims about.

Four defects are demonstrable, not theoretical:

1. `--root=<dir>` (equals form) and a valueless `--root` are **silently discarded** by all six
   hand-rolled `parseArgs()` copies. Proven live: `node scripts/generate-tool-support-table.mjs
   --root=/tmp/definitely-not-here` overwrote the **real** `docs/tool-support.md` and printed the
   unflagged success message — the exact outcome that file's own docblock calls "worse than no
   flag at all".
2. `plant()` writes a mutation that differs from the one it records. Proven live against
   `src/mcp/vice/r2000-enum-gen.test.ts`'s row: the `$$` in its `replace` string collapses to a
   single `$` under `String.prototype.replace`, so the bytes on disk were
   `` `${address…padStart(5,"0")}` `` while the registry and
   `evidence/32-sweep-renamed-rows.md:3889` both record `` `$${address…padStart(5,"0")}` ``.
3. Four of the five `--root`-ised gates still `import` their source-of-truth data
   (`CAPABILITY_REGISTRY`, `CURATED_ANNO_TOOLS`, `VERB_OPTIONS`, `DENY_LIST`) from
   `../src/mcp/vice/*.ts`, i.e. from `DEFAULT_ROOT`, in direct contradiction of the "do not
   re-derive a path from `DEFAULT_ROOT` anywhere below" contract each of them states verbatim.
4. A guard child killed by a signal returns `status: null`, which `result.status ?? 1` turns into
   a recorded **observed red** with a passing green control. Measured. On this machine earlyoom is
   installed and `node --test` suites are memory-hungry, so this is a live path, not a hypothetical.

Behind those, the `--root` surface added to five scripts in this phase is currently **entirely
unexercised**: no CI step, no test, and — per the registry's own notes — no plant used it (all 35
plants are `kind: "worktree"`). That is ~500 lines of new, untested CLI code whose central
soundness property (single root) is false.

## Critical Issues

### CR-01: `--root=<dir>` and valueless `--root` are silently ignored; the generator then writes the real repository

**File:** `scripts/generate-tool-support-table.mjs:312-321`, and identically
`scripts/check-guard-fates.mjs:836-848`, `scripts/check-skill-cli-invocations.mjs:94-102`,
`scripts/check-skill-description-overlap.mjs:111-119`, `scripts/check-skill-fork-honesty.mjs:117-125`,
`scripts/check-skill-tool-coverage.mjs:99-107`

**Issue:** Every one of the six new `parseArgs()` copies matches only the exact token `"--root"`
and then reads `argv[i + 1]`. Three operator mistakes are therefore indistinguishable from an
unflagged run:

- `--root=/some/tree` — the equals form is never matched, `root` stays `undefined`
- `--root` as the last argument — `argv[i+1]` is `undefined`, `root` stays `undefined`
- `--roott /x`, `-root /x`, any typo — unrecognised tokens are silently dropped

In all three cases `resolveContainedRoot(undefined, …)` returns `DEFAULT_ROOT` and the script runs
against the **real repository** while reporting success. Verified:

```
$ node scripts/check-guard-fates.mjs --root=/tmp
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 ...

$ node scripts/check-guard-fates.mjs --rooot /tmp
check-guard-fates: OK -- ...
```

For the read-only gates this silently measures the wrong tree — a planted violation in the
operator's synthetic tree goes unobserved and is recorded as "the plant did not bite". For
`generate-tool-support-table.mjs` it is worse, because that script **writes**:

```
$ node scripts/generate-tool-support-table.mjs --root=/tmp/definitely-not-here
generate-tool-support-table: wrote docs/tool-support.md      # the REAL one
```

The `where` suffix at `:371` only appears when `p.root !== DEFAULT_ROOT`, so the operator gets
byte-identical output to a deliberate unflagged run. This is precisely the failure that file's own
`paths()` docblock (`:56-62`) names as the thing that must never happen: "it would make a planted
violation silently unobservable while still overwriting the real table."

Note the harness gets this right — `audit-mutation-harness.mjs:347-353` throws on any unrecognised
argument. The six others do not.

**Fix:** Reject unrecognised arguments and a missing flag value, in the shared place, rather than
in six copies. Add to `scripts/lib/audit-root.mjs`:

```js
/** Parses `--root <dir>`, refusing the equals form, a missing value and any
 * unrecognised token. A silently-dropped root makes a run measure (or write)
 * the wrong tree while reporting success. */
export function parseRootArg(argv, { extraFlags = [] } = {}) {
  let root;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith("-")) {
        throw new Error("`--root` requires a directory argument.");
      }
      root = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--root=")) {
      throw new Error(
        `\`${a}\`: the equals form is not supported. Use \`--root <dir>\`. A silently-ignored ` +
          "root makes this run read and write the REAL repository while reporting success.",
      );
    } else if (!extraFlags.includes(a)) {
      throw new Error(`unrecognised argument ${JSON.stringify(a)}.`);
    }
  }
  return root;
}
```

and have all six call it (`check-guard-fates.mjs` passing `extraFlags: ["--json"]`). Additionally,
make `generate-tool-support-table.mjs:371` always print the absolute root it wrote under, so the
target tree is never implicit.

---

### CR-02: `plant()` applies a different mutation than the one it records — `$` substitution in the replacement string

**File:** `scripts/audit-mutation-harness.mjs:190-201`

**Issue:** The occurrence check uses `text.split(descriptor.find)` (literal, `$`-blind) but the
write uses `text.replace(descriptor.find, descriptor.replace)`. With a *string* pattern,
`String.prototype.replace` still interprets `$$`, `$&`, `` $` ``, `$'`, `$n` and `$<name>` in the
**replacement**. So any `replace` value containing those sequences is not written literally, while
the registry and the evidence file record it as if it were.

This is not hypothetical — it fired on this phase's own sweep. Row
`src/mcp/vice/r2000-enum-gen.test.ts` records:

```
find:    return `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
replace: return `$${address.toString(16).toUpperCase().padStart(5, "0")}`;
```

Reproduced against the real file, what was actually written was:

```
return `${address.toString(16).toUpperCase().padStart(5, "0")}`;
```

— the `$$` collapsed to `$`, so the plant also silently deleted the `$` hex sigil. The recorded
red is therefore over-determined and, worse, **not reproducible from its own record**: a reader
following `evidence/32-sweep-renamed-rows.md:3889` and applying `find` → `replace` by hand gets a
different tree than the harness measured. In a phase whose entire deliverable is "the evidence is
machine-captured and re-runnable", a recorded mutation that is not the applied mutation is a
correctness failure of the artifact.

(Two other rows carry `$` in their strings and happen to be safe: `${verb}` and `$/` are not
special sequences. That they survive is luck, not design.)

**Fix:** Use a replacer function, which disables all `$` interpretation, and assert the result:

```js
const mutated = text.replace(descriptor.find, () => descriptor.replace);
if (mutated === text || mutated.split(descriptor.replace).length - 1 !== 1) {
  throw new Error(
    `row ${row.historicalPath}: the applied mutation does not match the recorded ` +
      "`replace` string. The evidence must be reproducible by re-applying find -> replace " +
      "literally.",
  );
}
if (!originals.has(abs)) originals.set(abs, originalBytes);
writeFileSync(abs, Buffer.from(mutated, "latin1"));
```

Then re-run the affected row and correct both the registry and
`evidence/32-sweep-renamed-rows.md`.

---

### CR-03: four `--root`-ised gates still read their source of truth from `DEFAULT_ROOT` via static imports

**File:** `scripts/check-skill-tool-coverage.mjs:50-51`, `scripts/check-skill-fork-honesty.mjs:70`,
`scripts/check-skill-cli-invocations.mjs:43`, `scripts/generate-tool-support-table.mjs:40-41`

**Issue:** Each of these files carries an identical `paths()` docblock stating:

> "That is only sound if EVERY path comes from the one root. **WHAT NOT TO DO:** do not re-derive
> a path from `DEFAULT_ROOT` anywhere below. A root threaded through only SOME of the paths reads
> the synthetic tree for one input and the real repository for another, and a planted violation in
> the synthetic tree then goes silently unobserved — a false green."

That contract is broken by the files' own static ESM imports, which resolve relative to
`import.meta.url` — i.e. `DEFAULT_ROOT` — and are unaffected by `--root`:

- `check-skill-tool-coverage.mjs:50-51` — `CAPABILITY_REGISTRY`, `CURATED_ANNO_TOOLS`
- `check-skill-fork-honesty.mjs:70` — `CAPABILITY_REGISTRY`
- `check-skill-cli-invocations.mjs:43` — `VERB_OPTIONS` from `../src/mcp/vice/anno-cli.ts`
- `generate-tool-support-table.mjs:40-41` — `CAPABILITY_REGISTRY`, `DENY_LIST`

`check-skill-tool-coverage.mjs` makes the inconsistency explicit: `paths()` lists
`join(viceDir, "anno-cli.ts")` in `required[]` and re-reads it at `:590` from the resolved root,
while the *comparison data* it checks against comes from the real repository's module graph. Under
`--root <synthetic>`, a violation planted in the synthetic tree's `capability-registry.ts`,
`anno-tools.ts`, `anno-cli.ts` or `vice.ts` is invisible: the gate compares the synthetic corpus
against the real registry and can report green. That is a false green in the audit instrument
itself — the exact defect class CUT-04 exists to prevent.

**Fix:** Either (a) load the registry data through a root-parameterised dynamic import inside
`paths()`/main, e.g.

```js
const { CAPABILITY_REGISTRY } = await import(
  pathToFileURL(join(P.viceDir, "capability-registry.ts")).href
);
```

or (b) if that is judged unacceptable, delete the false claim from all four docblocks and
**refuse `--root` outright** when it is not `DEFAULT_ROOT`, so nobody relies on a seam that cannot
carry a plant. Silently keeping both the claim and the split read is the one option that must not
ship.

---

### CR-04: a guard child killed by a signal is recorded as an observed red

**File:** `scripts/audit-mutation-harness.mjs:295-304`

**Issue:** `spawnSync` reports a child terminated by a signal as `{ status: null, signal: "SIGKILL",
error: undefined }`. The `if (result.error)` arm at `:271` does not fire, so control falls to
`:300`: `status: result.status ?? 1` — `null ?? 1` is `1`. The `signal` field is discarded
entirely and `timedOut` is set to `false`.

Measured:

```
$ node -e 'const r=require("child_process").spawnSync(process.execPath,
    ["-e","process.kill(process.pid,\"SIGKILL\")"],{encoding:"utf8"});
    console.log(r.status, r.signal, r.error)'
null SIGKILL undefined
```

Consequence: if the **planted** run's child is killed by a signal — Ctrl-C reaching the process
group, an OOM kill (earlyoom is installed on this host and `node --test` suites are memory-hungry),
a segfault — `measureRow()` sees a non-zero status, passes the `planted_run.status === 0` check at
`:423`, and writes an `observedRed` with `exitStatus: 1` into the registry. The green control ran
*before* the plant and passed, so it does not protect against this. The file's own header commits
to the opposite: "a guard that is red for an unrelated reason … would otherwise record a false
observed red, which is exactly the vacuity this whole phase exists to catch."

Worse, `main()` is fully synchronous, so a `SIGINT` handler cannot run until after the registry
write-back at `:623` — the false red is persisted before the handler ever fires.

**Fix:** Treat a signalled child as UNMEASURABLE, never as a red, and carry the signal into the
evidence:

```js
if (result.signal !== null && result.signal !== undefined) {
  return {
    label, command, cwd: relativeCwd, cwdAbsolute: cwd,
    status: null,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}\nguard child was TERMINATED BY SIGNAL ${result.signal}. ` +
      "A signalled child is NOT evidence: its exit status says nothing about the plant.",
    timedOut: false,
  };
}
```

and in `measureRow()`, before the `status === 0` check:

```js
if (planted_run.status === null) {
  report.unmeasurable = true;
  report.reason =
    `the planted guard was terminated by signal ${planted_run.signal}, so its status is not ` +
    "evidence about the plant. Recorded as UNMEASURABLE.";
  report.control = control;
  report.planted = planted_run;
  return report;
}
```

## Warnings

### WR-01: every spawn error is reported as a timeout

**File:** `scripts/audit-mutation-harness.mjs:271-293`
**Issue:** The `timedOut: true` at `:292` is inside `if (result.error)` unconditionally, but the
ETIMEDOUT-specific message is added only under `if (result.error.code === "ETIMEDOUT")` at `:275`.
So an `ENOENT` (bad `guard.cwd`, missing `npm`), `EACCES` or `EAGAIN` is reported to the operator
as `"The control TIMED OUT."` (`:403`) — a false diagnosis that sends a reader looking at
`GUARD_RUN_TIMEOUT_MS` instead of at their descriptor.
**Fix:** `timedOut: result.error.code === "ETIMEDOUT"`, and record `result.error.code` on the
returned object so the evidence names the real failure.

### WR-02: no `maxBuffer` on the guard `spawnSync` — output is silently truncated

**File:** `scripts/audit-mutation-harness.mjs:262-268`
**Issue:** `spawnSync`'s default `maxBuffer` is 1 MiB. Measured on this Node: a child writing 3 MiB
came back with `status: 0`, **no** `error`, and only 146 176 bytes of `stdout`. The exit status
survives, so this is not a false red — but `excerptOf()` then searches truncated output, and can
miss the `not ok`/`AssertionError` line entirely and fall back to the head of an unrelated slice.
The evidence excerpt is the thing that "distinguishes a genuine red from a guard that failed to
start" (`check-guard-fates.mjs:752`), so silently truncating it degrades the evidence.
Inconsistent with `porcelain()` at `:126`, which explicitly sets 64 MiB.
**Fix:** Add `maxBuffer: 64 * 1024 * 1024` to the `spawnSync` options, matching `porcelain()`.

### WR-03: the `restored` latch permanently disarms restore-on-exit and buys nothing

**File:** `scripts/audit-mutation-harness.mjs:83-100`
**Issue:** `restoreAll()` sets `restored = true` forever on its first call and returns early
thereafter. Because it also calls `originals.clear()` at `:99`, a second call is *already* a no-op
without the flag — the flag adds no idempotency, only the ability to permanently disable the
`exit`/`SIGINT`/`SIGTERM`/`uncaughtException` restore. `main()`'s `finally` at `:614` fires it
before the registry write-back at `:623` and the evidence write at `:630`; any future code that
plants after that point (or any refactor that moves the `finally`) would leave a mutation in the
tree with the safety net already latched off. The header's promise — "Do not let a run leave a
plant behind" — depends on a flag that can only ever weaken it.
**Fix:** Delete `restored` and the early return; rely on `originals.clear()`:

```js
function restoreAll() {
  for (const [abs, bytes] of originals) {
    try { writeFileSync(abs, bytes); } catch (err) { /* shout, keep going */ }
  }
  originals.clear();
}
```

### WR-04: `resolveContainedRoot()` is lexical, so `plant()`'s containment claim is false under a symlink

**File:** `scripts/lib/audit-root.mjs:31-34, 75-80`; consumer `scripts/audit-mutation-harness.mjs:181-183`
**Issue:** The module deliberately does not call `realpathSync`, and documents why. That is
defensible for a read-only root, but `plant()` reuses it for a **write** target and comments:
"Contain the plant target: a registry value must not be able to name a path outside the tree this
run was pointed at." That is not what the code guarantees. `resolve()` is purely lexical, so
`descriptor.file = "some/tracked/symlink/target.ts"` passes containment and `writeFileSync()`
follows the link outside the repository — and `restoreAll()` would then restore the *outside* file,
not the repo one. The same applies to `--root` itself pointing at an in-repo symlink.
There are currently **no tracked symlinks** in this repository (`git ls-files -s | awk '$1=="120000"'`
is empty), so this is latent, not live.
**Fix:** For write targets specifically, add a post-resolution check in `plant()`:

```js
const abs = resolveContainedRoot(join(root, descriptor.file), { repoRoot: root });
const real = realpathSync(abs);            // the file must exist (checked below)
if (real !== abs && !real.startsWith(root + sep)) {
  throw new Error(
    `row ${row.historicalPath}: plant target ${descriptor.file} resolves through a symlink to ` +
      `${real}, outside ${root}. Refusing to write there.`,
  );
}
```

and soften `audit-root.mjs`'s claim from "contained" to "lexically contained; callers that WRITE
must additionally realpath the target".

### WR-05: `resolveBin()`'s documented `["--run", …] -> npm` convention produces an invalid npm command

**File:** `scripts/audit-mutation-harness.mjs:225-234, 270`
**Issue:** The docblock advertises `["--run", "typecheck"]` as one of three supported guard argv
conventions, and `resolveBin()` implements it by spawning `npm` with that argv verbatim, i.e.
`npm --run typecheck`. npm does not accept that form:

```
$ npm --run typecheck
Unknown command: "typecheck"
Did you mean this?  npm run typecheck
(exit 1)
```

No registry row uses it (the typecheck row spawns `node_modules/typescript/bin/tsc` directly), so
it is currently dead code — but it is dead code that *documents itself as working*. A future row
written to the documented convention gets a control exit of 1 → `UNMEASURABLE` (fail-closed, at
least) with a reason that points at the guard rather than at the harness.
**Fix:** Either `if (argv[0] === "--run") return "npm"` → spawn `npm` with `["run", ...argv.slice(1)]`
and build the `command` string to match, or delete the convention from both `resolveBin()` and the
docblock.

### WR-06: `checkGuardFates()` never ties the observed red, its control, or the plant to the row's subject

**File:** `scripts/check-guard-fates.mjs:728-762`
**Issue:** `redOwed()` requires `exitStatus` non-zero, `command` non-empty, `excerpt` non-empty and
`control.exitStatus === 0`. It does **not** require:

- `observedRed.control.command === observedRed.command` — a red from guard A can be paired with a
  green control from guard B, and the check passes. `guard-fates.test.ts:178-183` demonstrates the
  hole being exercised: it supplies `control: { exitStatus: 0 }` with no `command` at all and the
  row is accepted.
- any relationship between `observedRed.command` and `row.newSubject` — a row can record a red from
  a completely unrelated guard.
- the presence of a `plant` descriptor at all, so a hand-typed `observedRed` that no harness ever
  produced is indistinguishable from a machine-captured one.

The verdict predicate is the CI gate; the harness is the honest producer. Nothing forces the CI
gate to only accept the honest producer's output.
**Fix:** Add to `redOwed()`:

```js
need(
  isNonEmptyString(red.control?.command) && red.control.command === red.command,
  `row ${key}: \`observedRed.control.command\` must be BYTE-IDENTICAL to ` +
    `\`observedRed.command\`. A green control from a DIFFERENT guard proves nothing about ` +
    "this red; the control is 'the same guard run UNPLANTED', not 'some guard that passed'.",
);
need(
  red.plant !== null && typeof red.plant === "object" && isNonEmptyString(red.plant.file),
  `row ${key}: \`observedRed.plant\` must record the mutation that produced the red, so a ` +
    "later reader can re-apply it. A red with no recorded plant is a transcription.",
);
```

### WR-07: `removingCommit` is validated only as a non-empty string

**File:** `scripts/check-guard-fates.mjs:803-807`
**Issue:** The message says "The commit that removed it IS the evidence; without it the deletion is
a claim rather than a record." But the only check is `isNonEmptyString`, so `"TBD"`, `"see git log"`
or a typo'd SHA all pass. The seven current values (`1d40ad0` ×6, `c59fcef`) do check out by hand,
but nothing keeps the next one honest. The driver has git available and could verify cheaply
without making the predicate impure.
**Fix:** Inject a `commitExists: (sha) => boolean` alongside `exists` (driver:
`git cat-file -t <sha>` === `"commit"`), and additionally verify the commit actually removed the
path (`git show --name-status --diff-filter=D <sha> -- <historicalPath>` non-empty).

### WR-08: `TOTAL_FLOOR` is never checked against the three sub-floors, and is the only `>=` comparison

**File:** `scripts/check-guard-fates.mjs:133-136, 607-613`
**Issue:** The comment declares `TOTAL_FLOOR` as "43 + 16 + 2", but nothing enforces that identity,
and the union assertion is `union.length >= TOTAL_FLOOR` — the one relaxed comparison in a file
whose FLOORS block argues at length for `!==`. If a future commit raises `SET_A_FLOOR` to 44 and
forgets `TOTAL_FLOOR`, the derived union of 62 still satisfies `>= 61` and the drift is invisible
in the total line, which is the line a reader scans. Today the three `===` checks make the `>=`
harmless, but that is a property of the current state, not of the assertion.
**Fix:** Add a module-load invariant and tighten the union check:

```js
if (SET_A_FLOOR + SET_B_FLOOR + SET_C_FLOOR !== TOTAL_FLOOR) {
  throw new Error(
    `TOTAL_FLOOR (${TOTAL_FLOOR}) must equal SET_A_FLOOR + SET_B_FLOOR + SET_C_FLOOR ` +
      `(${SET_A_FLOOR} + ${SET_B_FLOOR} + ${SET_C_FLOOR}). A floor moved without its total.`,
  );
}
```

and change `union.length >= TOTAL_FLOOR` to `union.length === TOTAL_FLOOR`, with the message
explaining that an overlap between sets is the only way to land below it.

### WR-09: `docs-linerefs.test.ts`'s `isFunctionStart` arm is permanently unreachable but still weakens the assertion

**File:** `src/mcp/vice/docs-linerefs.test.ts:262-266`
**Issue:** The resolution check accepts `isCallSite || isFunctionStart`. Measured against both
scanned documents, **every** extracted citation is a call site:

| doc | cited line | callsite | funcstart |
|---|---|---|---|
| CLAUDE.md:26 | 3050 | true | false |
| CLAUDE.md:26 | 1529 | true | false |
| .planning/PROJECT.md:311 | 3050 | true | false |
| .planning/PROJECT.md:311 | 1529 | true | false |

The function-start numbers the prose does cite (`:1505`, `:2985`) are written as bare shorthands,
which `CITATION_RE` **deliberately** refuses to match (`:69-83`). So `isFunctionStart` can never
fire for a correct document — but it *can* fire for a wrong one: if a call-site citation drifts by
a few lines onto any `function foo(` declaration, the disjunction accepts it and the guard stays
green on a stale number. The regex is also generic (`function\s+\w+`), not scoped to
`forwardToVice` / `gatherWedgeEvidence`. That is a relaxation branch with no upside in a test whose
purpose is non-vacuity.
**Fix:** Drop the `isFunctionStart` arm and assert `isCallSite` alone (and update the
planted-violation control at `:282-283` accordingly). If function-start citations are wanted later,
extend `CITATION_RE` and pin the *named* function rather than "any function".

### WR-10: the new CI gate hard-depends on live `.planning/` phase artifacts and carries no removal trigger of its own

**File:** `.github/workflows/ci.yml:256-257`, `scripts/check-guard-fates.mjs:80-90, 483`
**Issue:** The gate is now blocking on every push, and it reads two live planning artifacts:
`.planning/ROADMAP.md`'s `### Phase 32` section (parsed for the deferred-fates note, hard failure
if the heading or the marker sentence moves) and
`.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json`. Both are phase-scoped. When
this milestone is closed and its phase directories are archived — or if `phases.clear` is ever run
— CI goes red for a reason that has nothing to do with the code. The `--json` failure path exits 1
too, so it will be a hard block, not a warning.

Separately: the gate demands a `removalTrigger` from all 54 non-deleted rows it audits ("Without it
a guard that outlives its purpose has no recorded exit") while itself having none. It is pinned to
two commits (`0394cbc`, `345d5c4`) that will only recede further into history, so its audited set is
frozen forever and it can never audit a guard re-pointed after `345d5c4`.
**Fix:** (a) Move `guard-fates.json` and the set-C mandate to a milestone-durable location, or
promote the two set-C members into the derivation so `ROADMAP.md` is not a CI input; (b) record the
gate's own removal trigger in its header ("remove when the audited set's last `kept-unchanged` row
reaches its trigger, or when the pinned commits leave the default branch's history") and add a
`.planning/` archive-survival note to the milestone close checklist.

### WR-11: the `--root` seam added to five scripts is shipped with zero callers and zero tests

**File:** `scripts/check-skill-cli-invocations.mjs:61-142`, `scripts/check-skill-description-overlap.mjs:73-159`,
`scripts/check-skill-fork-honesty.mjs:75-166`, `scripts/check-skill-tool-coverage.mjs:56-147`,
`scripts/generate-tool-support-table.mjs:44-75, 312-378`
**Issue:** ~500 lines of new path-plumbing, refusal handling and diagnostics landed in five
scripts, justified as "the phase-32 audit has to observe this gate FAILING against a planted
violation, and the only safe way to arrange that for some rows is to point the whole gate at a
synthetic tree via `--root`". It was never used for that:

- no `guard.argv` in `guard-fates.json` passes `--root`; all 35 plants are `kind: "worktree"`
- the registry's own notes say so explicitly, e.g. *"The inventory (§2) records this script as
  gaining `--root` in plan 32-02, but the harness implements only `kind: "worktree"` plants"*
- no CI step and no `.test.ts` exercises `--root` on any of the five
  (`guard-fates.test.ts:426-450` tests `resolveContainedRoot()` in isolation, not the CLIs)

So the seam is untested, unused, and — per CR-01 and CR-03 — unsound in two distinct ways. That
combination is how the next reader ends up trusting it.
**Fix:** Either land the missing coverage (one `spawnSync` test per script asserting: contained
`--root` reads the synthetic tree; out-of-repo `--root` exits 1 with `REFUSED`; `--root=<dir>` exits
non-zero) and fix CR-01/CR-03, or revert the flag from the four gates that never needed it and keep
it only where a plant actually requires it.

### WR-12: `evidenceMarkdown()` interpolates untrusted text into inline code and fenced blocks without escaping

**File:** `scripts/audit-mutation-harness.mjs:478-486, 500-543`
**Issue:** Plant strings are wrapped in single backticks (`:532`) and captured output is wrapped in
plain ``` fences (`:506-508`, `:525-527`, `:540-542`). Neither is escaped or fence-length-adjusted.
Any plant string containing a backtick breaks the inline span, and any captured guard output
containing a line of three backticks terminates the block early and lets the remainder render as
prose. This is live in the committed artifact: `evidence/32-sweep-renamed-rows.md:3889` records a
plant whose `find`/`replace` both contain backticks, and the line does not render as intended.
**Fix:** Wrap inline code in a fence sized to the content (`` `` ``…`` `` when the value contains a
backtick), and compute the fence length for output blocks:

```js
function fence(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return "`".repeat(longest + 1);
}
```

### WR-13: `audit-root.mjs` claims to be the single containment seam, but the one pre-existing `--root` consumer was not migrated

**File:** `scripts/lib/audit-root.mjs:3-18`
**Issue:** The header states the flag "needs exactly one containment check, in exactly one place,
rather than a re-derived `startsWith` in each consumer", and cites `scripts/audit-gate.mjs` by name
twice. `audit-gate.mjs` is the *only* script that had `--root` before this phase, it **writes**, and
it was left untouched: `grep -n 'resolveContainedRoot' scripts/audit-gate.mjs` is empty and its
`parseArgs()` at `:1118-1130` still accepts any path (`audit-integrity.test.ts:105` depends on that,
passing a system temp dir). So the new module is the seam for six *new* consumers and not for the
one that most needs it, and its header overstates what shipped.
**Fix:** Either migrate `audit-gate.mjs` to `resolveContainedRoot(rootArg, { repoRoot, allowExtra:
[tmpdir()] })` — which is exactly what `allowExtra` was built for and would give it a real caller —
or correct the header to say which consumers are covered and record `audit-gate.mjs` as a known,
deliberate exception with its reason.

### WR-14: `--json` mode emits no JSON on the derive/load failure path

**File:** `scripts/check-guard-fates.mjs:867-895, 921-936`
**Issue:** The `--json` contract is only honoured on the success/predicate-error path at `:921`. If
`assertPinnedCommitsPresent()`, `resolveSetC()`, the registry read or `JSON.parse` throws, the
handler at `:890-895` writes a plain-text line to stderr and exits 1 — a `--json` consumer gets an
empty stdout and cannot distinguish "no output" from "crashed". The exit status is correct
(fail-closed), so this is a contract defect rather than a safety one.
**Fix:** Branch on `json` inside that catch and emit
`{ ok: false, phase: "derive", errors: [message] }` before exiting 1, mirroring the success branch.

## Info

### IN-01: `allowExtra` has no production caller

**File:** `scripts/lib/audit-root.mjs:60, 76, 80-85`
**Issue:** All eight call sites pass only `repoRoot`; `allowExtra` is exercised solely by
`guard-fates.test.ts:449`. It is well-documented dead parameter surface today. WR-13's fix would
give it a real user.

### IN-02: the harness's "tree restored byte-identical" claim excludes its own two writes

**File:** `scripts/audit-mutation-harness.mjs:618-630`
**Issue:** `after = porcelain(root)` is captured at `:618`, before the registry write-back at
`:623` and the evidence write at `:630`. The evidence markdown's "`git status --porcelain` AFTER
the run" block is therefore a snapshot from before the harness's own artifacts landed. Correct as a
plant check, misleading as a label. Suggest renaming the heading to "AFTER the measurement (before
this run's own artifact writes)".

### IN-03: `restoreAll()` only restores what the harness planted

**File:** `scripts/audit-mutation-harness.mjs:85-100`
**Issue:** A guard with a filesystem side effect (a generator, a cache write) leaves the tree dirty;
`assertTreeClean()` at `:420` catches it and the run exits 1, but the side effect is not reverted.
Acceptable given the loud failure, but the header's "Do not let a run leave a plant behind" reads
as a broader guarantee than the code makes. Worth one sentence in the header.

### IN-04: `nameDescendantCandidates()`'s empty successor prefix can mis-attribute a rename

**File:** `scripts/check-guard-fates.mjs:154, 274-281`
**Issue:** `SUCCESSOR_PREFIXES` includes `""`, so `src/mcp/vice/r2000-verify.test.ts` would claim
`src/mcp/vice/verify.test.ts` as its successor if such a file ever appeared, purely on a stem match
and with no content check. The forward map is documented as authoritative over git's own rename
detection, so a coincidental name collision silently removes a member from set B via the adjacency
subtraction. Today the derived counts are pinned by `!==` floors so any such event reds the gate —
which is the right outcome — but the diagnostic would point at the floor, not at the collision.

### IN-05: no `unhandledRejection` handler alongside `uncaughtException`

**File:** `scripts/audit-mutation-harness.mjs:110-116`
**Issue:** `main()` is fully synchronous today so nothing can reject, but the restore-on-exit
inventory in the header lists four hooks and this is the missing fifth. One line, and it removes a
future footgun in a file whose whole point is that a crash must not leave a plant.

### IN-06: `parseArgs()` is copy-pasted verbatim into six files

**File:** `scripts/check-guard-fates.mjs:836`, `scripts/check-skill-cli-invocations.mjs:94`,
`scripts/check-skill-description-overlap.mjs:111`, `scripts/check-skill-fork-honesty.mjs:117`,
`scripts/check-skill-tool-coverage.mjs:99`, `scripts/generate-tool-support-table.mjs:312`
**Issue:** Six byte-similar copies of the same eight-line parser, each with the same comment block
above it. This is the direct cause of CR-01 being a six-file defect rather than a one-file one, and
it sits awkwardly against this repo's own "single seam per concern" convention. The CR-01 fix
(`parseRootArg()` in `scripts/lib/audit-root.mjs`) resolves this as a side effect.

### IN-07: the `--root` refusal/typo preamble is duplicated four times

**File:** the four `check-skill-*.mjs` gates, ~50 identical lines each
**Issue:** The `paths()` docblock, the `parseArgs()` comment, the `resolveContainedRoot` try/catch
and the `P.required` existence loop are near-identical across the four gates. Same remedy as IN-06:
a shared `resolveGateRoot(name, { repoRoot, required })` helper in `scripts/lib/audit-root.mjs`
would collapse ~200 lines and give the "one root" contract one place to be correct in — which is
also where CR-03's fix belongs.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
