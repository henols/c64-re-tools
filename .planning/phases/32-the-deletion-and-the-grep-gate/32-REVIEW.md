---
phase: 32-the-deletion-and-the-grep-gate
reviewed: 2026-09-01T00:00:00Z
depth: standard
round: 2
supersedes: 8218995353efac655c5adba961cf945615bb49f6
files_reviewed: 16
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - scripts/audit-mutation-harness.mjs
  - scripts/check-guard-fates.d.mts
  - scripts/check-guard-fates.mjs
  - scripts/check-no-regenerator2000.mjs
  - scripts/check-skill-cli-invocations.mjs
  - scripts/check-skill-description-overlap.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - scripts/lib/audit-root.d.mts
  - scripts/lib/audit-root.mjs
  - src/mcp/vice/audit-root-args.test.ts
  - src/mcp/vice/docs-linerefs.test.ts
  - src/mcp/vice/guard-fates.test.ts
findings:
  critical: 4
  warning: 26
  info: 8
  total: 38
status: issues_found
---

# Phase 32: Code Review Report (Round 2)

**Reviewed:** 2026-09-01
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found
**Replaces:** round-1 report at blob `8218995353efac655c5adba961cf945615bb49f6` (commit `203fb6d`)

## Summary

The gap-closure round did real work and it holds up where it was aimed. Measured this round on
the current tree:

- `node scripts/check-guard-fates.mjs` → exit 0, `setA=43 setB=16 setC=2 total=61 rows=61`.
- `node scripts/check-no-regenerator2000.mjs` → exit 0, 407 files, 157 exempt occurrences.
- `node --test audit-root-args.test.ts guard-fates.test.ts docs-linerefs.test.ts` → 77/77 pass,
  12.8 s, `git status --porcelain` byte-identical before and after, no leftover
  `.audit-root-synth-*` fixtures.
- `tsc --noEmit` → exit 0.
- The re-measured NUL facts in `check-no-regenerator2000.mjs` reproduce exactly: two NUL bytes in
  `anno-memmap-render.ts` at offsets 15097 and 15118, both on line 315; the one-hit `-a`
  difference is still the provenance comment at `:79`; 157 is the gate's own in-scope total.
- Round-1 `CR-01` is genuinely closed **for the six migrated gates**: `--root=<dir>`, a valueless
  `--root`, a repeated `--root` and every typo are now hard rejections with `BAD ARGUMENTS --`,
  proved per-script by spawned processes.
- Round-1 `CR-03` is genuinely closed by refusal: four gates plus the generator now print
  `SPLIT READ REFUSED --` before any read or write, and the refusal names the resolved root, the
  default root and every statically-bound specifier.
- Round-1 `CR-04` is genuinely closed: a signal-killed child now returns `status: null` with
  `terminatedBySignal: true`, `measureRow()` records it as UNMEASURABLE before the zero-exit
  branch, and `evidenceMarkdown()` renders the planted run's captured output on that path.
- All 35 committed `observedRed` rows now carry a `plant`, and every one has
  `control.command === command`.

That is the good news, and it is most of what the round set out to do. Four things are broken
anyway, all of them in the class this repository says it cares about most — an instrument that
records something other than what happened, a guard whose population excludes exactly the
offenders, and a test that mutates a tree other tests are reading.

1. **The mutation harness was never migrated to the shared argv seam.** It still hand-rolls
   `--root`, and a valueless `--root` is still silently discarded. Reproduced live: `node
   scripts/audit-mutation-harness.mjs --row nonexistent/path.ts --root` fell through to the real
   repository root and read the real registry, with no diagnostic mentioning `--root` at all.
   This is the one instrument in the phase that plants mutations and writes both the registry and
   the evidence file. (`CR-05`)
2. **The `CR-02` post-condition asserts the wrong invariant and has already invalidated a
   committed evidence row.** It counts *total* occurrences of the `replace` string in the mutated
   text instead of *newly introduced* ones, so a replacement string that already appears once
   elsewhere in the file is refused. Reproduced live: `node scripts/audit-mutation-harness.mjs
   --row scripts/lib/skill-honesty-checks.mjs` hard-fails with "occurs 2 time(s) ... expected
   exactly 1". One of the phase's 35 machine-captured rows can no longer be re-measured by the
   instrument that is supposed to be its reproduction mechanism — and the failure message tells
   the operator to "fix the descriptor rather than the assertion", i.e. to change honest data to
   satisfy a wrong check. (`CR-06`)
3. **`audit-root-args.test.ts` introduces a cross-file test race.** Its adjacency-accept loop runs
   `check-skill-cli-invocations.mjs` to completion five times, each of which spawns
   `installer/scripts/sync-skills.mjs`, which does `rmSync(installer/skills, {recursive:true})`
   followed by a repopulate. `node --test '*.test.*'` runs test files in parallel (confirmed on
   this machine: two 1.5 s files complete in 1.66 s wall, `availableParallelism()` = 12), and four
   other test files read `installer/skills/`. Measured window: the tree is missing for ~7 ms of an
   88 ms sync, five times per suite run. (`CR-07`)
4. **The "matrix covers EVERY script wired to the shared argv seam" completeness guard derives its
   own population as "scripts whose text contains `parseRootArg(`".** That definition excludes,
   by construction, exactly the scripts that still carry the original defect:
   `scripts/audit-gate.mjs:1118-1131` and `scripts/audit-mutation-harness.mjs:389-427` both accept
   `--root`, both hand-roll it, and neither is visible to the guard — while the guard's own
   docblock calls its table "the whole population" and asserts "a seventh root-accepting script
   added later fails this file by omission rather than passing unnoticed". It would not.
   (`CR-08`)

Behind those, most of round 1's warnings are untouched. The mutation harness in particular still
has every one of its round-1 warnings open: no `maxBuffer` on the guard spawn, every spawn error
reported as a timeout, the `restored` latch, the un-escaped evidence markdown (live and visibly
broken at `evidence/32-sweep-renamed-rows.md:487`), and the `npm --run typecheck` convention that
npm does not accept. `redOwed()` still does not require `control.command === command` or the
presence of a `plant`, so the registry's current honesty is a property of the producer, not of
the CI gate.

One factual correction to round 1: `WR-13` asserted that `scripts/audit-gate.mjs` "**writes**".
It does not — `grep -n writeFileSync scripts/audit-gate.mjs` is empty. The rest of `WR-13` stands.

---

## Round-1 Finding Dispositions

Every round-1 id, preserved. "Still stands" means re-verified against the current tree this round.

| id | disposition | evidence |
|---|---|---|
| CR-01 | **Closed as scoped; recurs at a new site.** The six gates reject every malformed form (18-case spawned matrix, all green). The harness was not migrated → `CR-05`. | `scripts/lib/audit-root.mjs:173-249`; `audit-root-args.test.ts:131-211, 447-473` |
| CR-02 | **Closed** — `text.replace(find, () => replace)` disables all `$` interpretation; the `r2000-enum-gen` row's excerpt now reads `register $0D011` (sigil preserved), i.e. it was re-measured after the fix. The added post-condition is itself defective → `CR-06`. | `scripts/audit-mutation-harness.mjs:207`; `guard-fates.json` row `src/mcp/vice/r2000-enum-gen.test.ts` |
| CR-03 | **Closed** — four gates plus the generator refuse any resolved root ≠ `DEFAULT_ROOT`, before any read or write, naming every statically-bound specifier. Verified by spawned test and by reading each `main()`. | `check-skill-tool-coverage.mjs:188-196`, `check-skill-fork-honesty.mjs:207`, `check-skill-cli-invocations.mjs:196-204`, `generate-tool-support-table.mjs:408-418` |
| CR-04 | **Closed** — signal branch at `runGuard()`, UNMEASURABLE branch in `measureRow()` before the zero-exit check, and the planted run's output is rendered on the unmeasurable path. | `audit-mutation-harness.mjs:342-356` (signal branch), `:503-517` (UNMEASURABLE branch), `:607-625` (evidence rendering) |
| WR-01 | **Still stands.** `timedOut: true` at `:322` is unconditional inside `if (result.error)`; the ETIMEDOUT-specific text is added only under `result.error.code === "ETIMEDOUT"`. An ENOENT/EACCES is still reported to the operator as "The control TIMED OUT." | `audit-mutation-harness.mjs:301-325, 497` |
| WR-02 | **Still stands.** `maxBuffer: 64 * 1024 * 1024` is on `porcelain()` (`:126`) only. The guard `spawnSync` at `:292-298` has no `maxBuffer`, so it keeps Node's 1 MiB default and `excerptOf()` can search truncated output. | `audit-mutation-harness.mjs:126` vs `:292-298` |
| WR-03 | **Still stands.** `let restored = false` / `if (restored) return; restored = true;` unchanged. | `audit-mutation-harness.mjs:83-87` |
| WR-04 | **Still stands (latent).** `grep -n realpath` over the harness and `audit-root.mjs` finds only the comment explaining its absence; `git ls-files -s | awk '$1=="120000"'` is still empty, so no tracked symlink exists to exploit it today. | `audit-root.mjs:31-34`; `audit-mutation-harness.mjs:183` |
| WR-05 | **Still stands.** `resolveBin()` still maps `argv[0] === "--run"` to `npm` and spawns `npm --run typecheck`, which npm rejects. Still documented as a supported convention at `:255-261`. | `audit-mutation-harness.mjs:255-263` |
| WR-06 | **Still stands.** `redOwed()` requires `control.exitStatus === 0` and nothing else about the control. It does not require `control.command === command`, does not require a `plant`, and does not tie the red to `row.newSubject`. `guard-fates.test.ts:178-183` still supplies `control: { exitStatus: 0 }` with no `command` and the row is accepted. The 35 committed rows all happen to satisfy the stricter rule — a property of the harness, not of the gate. | `check-guard-fates.mjs:728-762`; `guard-fates.test.ts:169-202` |
| WR-07 | **Still stands.** `removingCommit` is validated only by `isNonEmptyString`; `"TBD"` would pass. | `check-guard-fates.mjs:803-808` |
| WR-08 | **Still stands.** No module-load identity between `TOTAL_FLOOR` and the three sub-floors (`grep -n "SET_A_FLOOR + SET_B_FLOOR"` is empty), and the union check is still `union.length >= TOTAL_FLOOR` — the one `>=` in a file whose FLOORS block argues for `!==`. | `check-guard-fates.mjs:133-136, 607-613` |
| WR-09 | **Still stands.** The resolution check is still `isCallSite || isFunctionStart` with a generic `/^\s*(async\s+)?function\s+\w+/`, not scoped to the two named functions. | `docs-linerefs.test.ts:261-266` |
| WR-10 | **Still stands, and widened.** `check-guard-fates.mjs` is now blocking CI and still parses `.planning/ROADMAP.md`'s `### Phase 32` section (set C resolved from line 830) plus the phase-directory registry, and still records no `removalTrigger` of its own. This round additionally added `.planning/PROJECT.md` to `docs-linerefs.test.ts`'s `SCANNED_DOCS`, so a second CI-blocking check now hard-depends on a planning artifact. | `.github/workflows/ci.yml:257-258`; `check-guard-fates.mjs:80-90`; `docs-linerefs.test.ts:64-67` |
| WR-11 | **Open by operator decision (2026-09-01), with the "zero tests" half closed.** `audit-root-args.test.ts` now covers the seam. The "no caller" half stands and has hardened: the split-read refusal means five of the six consumers accept no root but a spelling of the repository root, so exactly one script (`check-skill-description-overlap.mjs`) honours a non-default root. See also `WR-24`. | `audit-root-args.test.ts`; `MATRIX` at `:377-384` |
| WR-12 | **Still stands, and is live in committed artifacts.** `evidenceMarkdown()` still wraps plant strings in single backticks and output in bare fences. `evidence/32-sweep-renamed-rows.md:487` renders broken today: `` - **Plant:** ...: `text.includes(`anno ${verb}`)` → `text.includes(`anno-${verb}`)` ``. 15 such lines in that file, 18 in `32-sweep-same-path-rows.md`. | `audit-mutation-harness.mjs:644` (inline plant span), `:572-578, 610-614, 646-650` (bare fences) |
| WR-13 | **Partially stands, with one correction.** `scripts/audit-gate.mjs` was still not migrated: `grep -n resolveContainedRoot scripts/audit-gate.mjs` is empty and its `parseArgs()` at `:1118-1131` still accepts any path with the original silent-drop defect. Each migrated file now records the non-migration deliberately, which is an improvement over the silent state. **Correction to round 1:** `audit-gate.mjs` does *not* write — `grep -n writeFileSync scripts/audit-gate.mjs` is empty. | `scripts/audit-gate.mjs:1118-1131` |
| WR-14 | **Still stands.** The `--json` contract is honoured only on the success/predicate path at `:940-953`. `assertPinnedCommitsPresent`, `resolveSetC`, the registry read and `JSON.parse` all fail through `:912-916`, which writes plain text and exits 1 with empty stdout. | `check-guard-fates.mjs:889-916, 940-953` |
| IN-01 | **Still stands.** `allowExtra` has exactly one caller in the whole tree: `guard-fates.test.ts:449`. | `grep -rn allowExtra scripts/ src/` |
| IN-02 | **Still stands.** `after = porcelain(root)` at `:735` precedes the registry write-back at `:740` and the evidence write at `:743`. | `audit-mutation-harness.mjs:730-743` |
| IN-03 | **Still stands.** `restoreAll()` still restores only what `originals` holds. | `audit-mutation-harness.mjs:85-101` |
| IN-04 | **Still stands.** `SUCCESSOR_PREFIXES` still includes `""` and `nameDescendantCandidates()` still matches on stem alone with no content check. | `check-guard-fates.mjs:154, 274-281` |
| IN-05 | **Still stands.** `grep -n unhandledRejection scripts/audit-mutation-harness.mjs` is empty; the four registered hooks are unchanged. | `audit-mutation-harness.mjs:103-116` |
| IN-06 | **Closed for the six gates; recurs.** `parseRootArg()` exists and all six call it. Two `--root`-accepting scripts still hand-roll the reader — see `CR-05` and `CR-08`. | `scripts/lib/audit-root.mjs:173`; `grep -n '"--root"' scripts/` |
| IN-07 | **Closed.** `splitReadRefusalReason()` builds the reasoning once; each consumer writes only its own prefix. | `scripts/lib/audit-root.mjs:299-321` |

---

## Narrative Findings (AI reviewer)

New finding ids continue from round 1 so no id is ever reused: criticals start at `CR-05`,
warnings at `WR-15`, info at `IN-08`.

## Critical Issues

### CR-05: the mutation harness still hand-rolls `--root`, and a valueless `--root` silently reads and writes the real repository

**File:** `scripts/audit-mutation-harness.mjs:389-427` (the reader), `:671` (resolution),
`:735` and `:743` (the two writes)

**Issue:** Every other `--root` consumer in the phase was migrated to `parseRootArg()`. This one
was not, and `scripts/lib/audit-root.mjs:119-122` cites *this file's* reader as the model that
"DID throw on an unrecognised token" — the model that was reused everywhere except in the file it
was taken from. The reader does reject an unrecognised token, but it has the other half of the
round-1 defect intact:

```js
if (a === "--root") {
  root = argv[i + 1];   // undefined when `--root` is the last argument
  i += 1;
}
```

A trailing `--root` yields `root === undefined`, which `resolveContainedRoot(undefined, …)` maps
to `REPO_ROOT`. Reproduced live on the current tree:

```
$ node scripts/audit-mutation-harness.mjs --row nonexistent/path.ts --root
audit-mutation-harness: FAIL -- row selection: "nonexistent/path.ts" matched 0 registry row(s) ...
```

The run reached row selection, which means it had already loaded the **real** repository's
`guard-fates.json`. No message anywhere mentions `--root`. With a real row name and `--all`, the
same invocation plants mutations in the real working tree, rewrites the real
`.planning/phases/32-.../guard-fates.json` and the real evidence file — while the operator
believes they pointed it at a synthetic tree. That is round-1 `CR-01` verbatim, on the only
instrument in this phase that both mutates and writes.

`--root --all` is a second face of the same reader: the flag swallows `--all` as its value.

**Fix:** Use the seam that already exists and is already tested.

```js
import { parseRootArg, resolveContainedRoot } from "./lib/audit-root.mjs";

// in parseArgs(), replace the hand-rolled loop's --root arm:
const { root } = parseRootArg(argv, {
  script: "audit-mutation-harness",
  booleanFlags: ["--all"],
});
```

`--row`, `--rows` and `--out` are value-taking flags `parseRootArg()` does not know about, so
either extend it with a declared `valueFlags` list (mirroring `booleanFlags`, still supplied in
code and never from argv) or, at minimum, apply the same three rules to each of them here: a
missing value, a value that starts with `--`, and a repeated flag are all hard errors. Note that
`--out` and `--rows` have the identical trailing-flag hole today.

---

### CR-06: the `CR-02` post-condition counts total occurrences instead of introduced ones, and has already made a committed evidence row un-reproducible

**File:** `scripts/audit-mutation-harness.mjs:219-229`

**Issue:** The write itself is now correct (`text.replace(find, () => replace)` — no `$`
interpretation). The post-condition guarding it is not:

```js
const applied = mutated.split(descriptor.replace).length - 1;
if (applied !== 1) { throw ... }
```

`applied` is the number of occurrences of the replacement string in the whole mutated file, not
the number the plant introduced. If the `replace` text already occurs elsewhere in the target,
`applied` is 2 and the plant is refused even though the bytes written would be exactly the bytes
recorded. Reproduced live on the current tree:

```
$ node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs
audit-mutation-harness: FAIL -- row scripts/lib/skill-honesty-checks.mjs: plant post-condition
FAILED for scripts/lib/skill-honesty-checks.mjs -- the recorded `replace` string occurs 2 time(s)
in the mutated text, expected exactly 1. ... Fix the descriptor rather than the assertion (CR-02).
```

That row's descriptor is `find: "if (!content.includes(needle)) {"` →
`replace: "if (content.includes(needle)) {"`, and the un-negated form already occurs once in
`scripts/lib/skill-honesty-checks.mjs`. `find` still occurs exactly once; the mutation is
unambiguous; the recorded find/replace is exactly what a reader would apply by hand. The check
refuses it anyway.

Two consequences, both squarely in this phase's own subject matter:

- **One of the 35 machine-captured rows can no longer be re-measured by the committed
  instrument.** A sweep over `--all` now hard-fails on it, and `hardFailure` suppresses the
  registry write-back for the *whole* sweep. The phase's claim that the evidence is re-runnable is
  false for that row.
- **The failure message points the operator the wrong way.** "Fix the descriptor rather than the
  assertion" instructs a reader to alter honest recorded data to satisfy an incorrect check. In a
  repository whose stated value is that its audit instruments do not lie, an instrument that tells
  you to edit the evidence is worse than one that is merely wrong.

I verified this is the only affected row: replaying every recorded plant against the current tree,
34 of 35 satisfy `find`-occurs-once **and** the post-condition; only
`scripts/lib/skill-honesty-checks.mjs` fails, and it fails only on the post-condition.

The check can never produce a *false pass* (the replacer function guarantees the written bytes
equal `replace`), so this is over-strictness rather than a soundness hole — but it is
over-strictness that invalidates committed evidence.

**Fix:** Count what the mutation introduced, not what the file contains.

```js
const before = text.split(descriptor.replace).length - 1;
const applied = mutated.split(descriptor.replace).length - 1;
if (applied - before !== 1) {
  throw new Error(
    `row ${row.historicalPath}: plant post-condition FAILED for ${descriptor.file} -- applying ` +
      `the recorded \`replace\` string introduced ${applied - before} occurrence(s), expected ` +
      "exactly 1. The mutation that would reach disk is not the mutation this descriptor " +
      "records. Nothing was written.",
  );
}
```

Note the overlap case (`replace` containing `find`, or splicing joining boundaries) is still
caught by this form. Once fixed, re-run
`node scripts/audit-mutation-harness.mjs --row scripts/lib/skill-honesty-checks.mjs` and confirm
the recorded red still reproduces.

---

### CR-07: `audit-root-args.test.ts` deletes and repopulates `installer/skills/` five times while four other test files read it, under a parallel test runner

**File:** `src/mcp/vice/audit-root-args.test.ts:553-573` (the adjacency-accept loop) →
`scripts/check-skill-cli-invocations.mjs:250-255` → `installer/scripts/sync-skills.mjs:75-76`

**Issue:** The adjacency-accept loop runs each "refuses" script to completion once unflagged plus
once per spelling:

```ts
const baseline = runScript(script, []);
for (const spelling of [".", ROOT, join(ROOT, "scripts", ".."), "./scripts/.."]) {
  const r = runScript(script, ["--root", spelling]);
```

For `check-skill-cli-invocations` that is five completed runs, and each one takes the
`P.root === DEFAULT_ROOT` branch and spawns `installer/scripts/sync-skills.mjs`, which is:

```js
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
```

`node --test '*.test.*'` (the exact CI command, `src/mcp/vice/package.json:112`) runs test **files**
in parallel. Confirmed on this machine: `availableParallelism()` = 12, and two deliberately-slow
1.5 s test files complete in 1.66 s wall — they overlap. Four other test files read
`installer/skills/`: `skill-attribution.test.ts`, `removal-gate.test.ts`,
`anno-verb-coverage.test.ts`, `ci-suite-coverage.test.ts`.

Measured window, sampling at 1 ms while a single sync runs:

```
elapsed_ms 88  samples 73  samples_with_file_absent 7
```

So `installer/skills/acme-build/SKILL.md` does not exist for roughly 7 ms out of each 88 ms sync,
five times per suite run — about 35 ms per run in which a concurrent reader can observe a missing
or half-populated tree. Those readers carry non-vacuity floors, so the realistic outcome is an
intermittent CI red attributed to a skill gate that is not broken; the worse outcome is a reader
that treats an empty tree as "nothing to check".

The test file's own docblock (`:52-57`) addresses this with "is idempotent". Idempotence is a
property of the end state and says nothing about atomicity or about concurrent readers; the claim
does not cover the failure mode it is offered against.

**Fix:** Do not let a test spawn a script that rewrites a shared generated directory. Either

(a) skip the regeneration for these runs — pass an argv the gate understands as "do not sync", or
    point the adjacency-accept case at a script with no working-tree side effect and assert
    `check-skill-cli-invocations`'s spelling-equivalence at the `resolveContainedRoot()` level
    instead; or

(b) make the sync atomic so no reader ever sees a partial tree:

```js
const staging = `${DEST}.tmp-${process.pid}`;
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
// ... cpSync into staging ...
rmSync(DEST, { recursive: true, force: true });
renameSync(staging, DEST);
```

(b) narrows the window to a single rename but does not close it; (a) is the correct fix. Whichever
is chosen, replace the "is idempotent" sentence with one that states the concurrency property
actually relied on.

---

### CR-08: the completeness guard's population is "scripts that already use the seam", so the two scripts that still hand-roll `--root` are invisible to it

**File:** `src/mcp/vice/audit-root-args.test.ts:417-425` (`scriptsUsingTheSharedParser()`),
`:428-444` (the assertion), `:291-296` (the docblock claim)

**Issue:** The guard is presented as the thing that stops a root-accepting script from shipping
untested:

> "Six scripts accept a root. ... The table below is the whole population, and the completeness
> guard beneath it derives that population FROM DISK — so a seventh root-accepting script added
> later fails this file by omission rather than passing unnoticed."

But the derivation is:

```ts
if (src.includes("parseRootArg(")) out.push(entry.name.replace(/\.mjs$/, ""));
```

The population is not "scripts that accept a root". It is "scripts that already call the shared
parser". A script that accepts `--root` with its own reader — which is precisely the defect
`IN-06`/`CR-01` describe — is excluded from the population and therefore cannot fail the guard by
omission. Two such scripts exist right now:

```
$ grep -rn '"--root"' scripts/
scripts/audit-mutation-harness.mjs:397:    if (a === "--root") {
scripts/audit-gate.mjs:1123:    if (argv[i] === "--root") {
scripts/lib/audit-root.mjs:210:    if (token !== "--root") {
```

`audit-gate.mjs:1118-1131` still carries the verbatim round-1 reader and still accepts an
arbitrary, uncontained path. `audit-mutation-harness.mjs` is `CR-05`. Both are invisible here, and
the assertion is green.

The same shape recurs one layer down in the split-read contract test: `MATRIX` is the only input,
so the contract is never evaluated against `audit-gate.mjs` or the harness either.

This is a guard that passes vacuously against exactly the population it was written to police,
while asserting in its own text that it does not.

**Fix:** Derive the population from the *flag*, not from the remedy, and let non-migration be an
explicit, named exception rather than an invisible one.

```ts
/** Every top-level `scripts/*.mjs` that ACCEPTS a --root flag, however it reads it.
 *  Deriving from the flag (not from `parseRootArg(`) is load-bearing: a script that
 *  hand-rolls the reader is the defect this file exists to catch, and keying on the
 *  remedy would exclude exactly those. */
function scriptsAcceptingARoot(): string[] {
  const dir = join(ROOT, "scripts");
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    if (readFileSync(join(dir, entry.name), "utf8").includes("--root"))
      out.push(entry.name.replace(/\.mjs$/, ""));
  }
  return out.sort();
}

/** Scripts that accept a root but are deliberately NOT on the shared seam yet.
 *  Each entry is a debt with a name, not a silence. Emptying this list is the goal. */
const UNMIGRATED = ["audit-gate", "audit-mutation-harness"] as const;

test("the matrix covers EVERY root-accepting script, or names it as unmigrated", () => {
  assert.deepEqual(
    scriptsAcceptingARoot(),
    [...MATRIX.map((r) => r.script), ...UNMIGRATED].sort(),
    "a script accepts --root and is neither exercised by MATRIX nor declared unmigrated",
  );
});
```

Then either migrate the two (`CR-05` migrates one of them) or keep the list, which at least makes
the debt fail loudly when a third appears. Correct the docblock's "whole population" sentence
either way.

---

## Warnings

### WR-15: `.gitignore:53` cites a line that does not carry the claim, and was already wrong when written

**File:** `.gitignore:53`
**Issue:** The new entry justifies itself with "a dirty tree VOIDS the mutation harness's evidence
(`scripts/audit-mutation-harness.mjs:654`)". Line 654 is `lines.push("");` inside
`evidenceMarkdown()`. The claim actually lives at `:585` ("This run's evidence is void.") and
`:766` ("DIRTY -- EVIDENCE VOID"). Checked at the introducing commit `06b9705`: line 654 there was
`lines.push("```");` — also not the claim. This repository maintains a mechanical guard
(`docs-linerefs.test.ts`) for exactly this drift class on two hand-picked citations; this new one
is outside it and was never right.
**Fix:** Cite `scripts/audit-mutation-harness.mjs:766` (the operator-visible line), or drop the
line number and name the behaviour: "a dirty tree VOIDS the mutation harness's evidence — see its
`assertTreeClean()` / final `tree:` report line".

### WR-16: a relative `--root` resolves against the repository root, never the process cwd, and nothing says so

**File:** `scripts/lib/audit-root.mjs:86, 148-151`
**Issue:** `resolve(base, rootArg)` makes every relative `--root` repo-relative. Measured from
`/tmp`:

```
--root docs -> /home/henrik/dev/henrik/git/c64-re-tools/docs
--root .    -> /home/henrik/dev/henrik/git/c64-re-tools
```

`--root .` from an unrelated directory silently means the repository root. The usage line
(`Usage: node scripts/<script>.mjs [--root <dir>]`) says nothing, `parseRootArg`'s docblock
explicitly declines to resolve, and `resolveContainedRoot`'s docblock documents only the falsy
case. `audit-root-args.test.ts` always spawns with `cwd: ROOT`, so no case distinguishes the two
bases. For a seam whose whole premise is that a root is never silently reinterpreted, a silently
reinterpreted *base* is the same class of surprise.
**Fix:** State it in both the usage line and `resolveContainedRoot`'s `@param`, e.g.
`Usage: node scripts/<script>.mjs [--root <dir>]   (a relative <dir> is resolved against the
repository root, not the current directory)`, and add a case to `audit-root-args.test.ts` that
spawns from a different cwd and asserts the resolved root.

### WR-17: the split-read consequent is a bare substring test, satisfiable by a comment

**File:** `src/mcp/vice/audit-root-args.test.ts:368, 400-408`
**Issue:** `carriesSplitReadRefusal(text)` is `text.includes("SPLIT READ REFUSED")`. The rule
"binds `../src/` statically ⇒ refuses" is therefore discharged by the literal appearing anywhere
in the file, including inside a comment that says the opposite. For the four current members the
spawned matrix independently proves the behaviour, so today the hole is covered — but the text
rule is the half explicitly claimed to "hold for every member of the population, including ones a
future phase adds" (`:357-360`), and for those it proves only that a string is present.
**Fix:** Require the literal to appear in a `process.exit`-bearing branch, or (better) drop the
text consequent and make the behavioural matrix the consequent: for every script the antecedent
selects, spawn it with an in-repo non-default root and require `SPLIT READ REFUSED` on stderr and
a non-zero exit. That is already written for the four; generalise the loop over
`staticSrcImports(...)` instead of over `MATRIX`.

### WR-18: the split-read antecedent is not transitive

**File:** `src/mcp/vice/audit-root-args.test.ts:386-390`
**Issue:** `staticSrcImports()` matches only direct `from "../src/…"` specifiers in the script's
own text. Four of the six gates get most of their logic from `scripts/lib/*.mjs`
(`skill-corpus.mjs`, `skill-descriptions.mjs`, `skill-honesty-checks.mjs`,
`anno-cli-invocations.mjs`, `anno-cli-verbs.mjs`). If any of those ever binds `../src/` data
statically, the consuming script's antecedent stays false, the rule is satisfied, and the split
read is real. I verified today that no `scripts/lib/*.mjs` imports from `../src` and none derives
a path from `import.meta.url` — so this is latent, not live. It is also the exact reason
`check-skill-description-overlap` is currently asserted "clean", and that assertion is pinned by
name at `:782-784`.
**Fix:** Extend the antecedent one hop: for each script, also scan every `./lib/*.mjs` it imports.
Or add a standing assertion that `scripts/lib/*.mjs` contains no `../src/` specifier and no
`import.meta.url`, and cross-reference it from the antecedent's docblock so the two cannot drift
apart.

### WR-19: `docs-linerefs.test.ts`'s planted-violation control re-implements the predicate it is supposed to be driving

**File:** `src/mcp/vice/docs-linerefs.test.ts:279-284` vs `:261-266`
**Issue:** The file's own discipline (`:32-37`) is: "The predicates below RETURN their findings
instead of asserting internally. That is deliberate: it lets the planted-violation tests at the
bottom of this file drive the REAL rule ... rather than re-implementing the rule locally and
proving nothing about the rule the real checks apply." The citation-resolution check is the one
rule in the file that was never extracted into a returning function, and its plant is a verbatim
copy of the two lines it is meant to test:

```ts
const isCallSite = lineText.includes("rewriteArguments(");
const isFunctionStart = /^\s*(async\s+)?function\s+\w+/.test(lineText);
```

If the real check at `:261-266` were changed or neutered, the plant at `:279-284` would not
follow — which is exactly the failure the file forbids in its own header. Compounds `WR-09`: the
relaxation branch nobody can fire has no plant that would notice if it started firing.
**Fix:** Extract it, in the same shape as `isolateCitationBullet()`:

```ts
function citationResolutionProblems(doc: string, lines: string[], citations: number[]): string[]
```

and drive both the real test and the plant through it. Fixing `WR-09` at the same time removes the
disjunction the plant currently has to reproduce.

### WR-20: the test suite writes the committed, byte-pinned `docs/tool-support.md` six times per run, concurrently with its own drift guard

**File:** `src/mcp/vice/audit-root-args.test.ts:275-282, 553-573`
**Issue:** `generate-tool-support-table` is a `"refuses"` MATRIX row, so it goes through the
adjacency-accept loop: one unflagged baseline plus four spellings, all of which reach
`writeFileSync(p.outputPath, doc)`. Plus the explicit `--root ROOT` run at `:275`. Six writes to a
file whose byte-identity is the subject of a separate guard
(`tool-support-table.test.mjs:148`, "docs/tool-support.md is STALE -- run `node
scripts/generate-tool-support-table.mjs` and commit the result"). Those runs perform, from inside
the test suite, exactly the remediation that guard tells a human to perform — in a process running
in parallel with it. Today the file is in sync and the tree stayed byte-identical across a full
run (measured), and the `:275` case would red on drift because it captures `before` first, so this
is not currently a false green. It is still a test suite that writes a committed artifact, and if
the `:275` case is ever reordered after the loop or its assertion relaxed, a stale doc would be
silently self-healed and left as an unexplained working-tree modification.
**Fix:** Point the adjacency-accept loop's `generate-tool-support-table` runs at a throwaway
output. If the generator gains no `--out`, wrap those five runs with a save/restore of
`docs/tool-support.md` bytes and assert byte-identity after each, so a drift is reported by this
file rather than absorbed by it.

### WR-21: the stated end-to-end run budget does not match the code

**File:** `src/mcp/vice/audit-root-args.test.ts:44-51, 531-546, 556`
**Issue:** Both budget notes say "four scripts x four runs (an unflagged baseline plus three
spellings)" = 16 full runs, "Total end-to-end runs: 19". The loop iterates **four** spellings
(`".", ROOT, join(ROOT, "scripts", ".."), "./scripts/.."`), so it is a baseline plus four = five
runs per script, 20 for the loop alone, plus the `--root ROOT` generator run, the
`check-guard-fates --root ROOT` run and the synthetic-corpus run — at least 23. The whole point of
writing the budget down was that it should be "stated rather than quietly spent"; a budget that is
20% under-reported does not do that, and it is the number a future reader will use when deciding
whether adding one more case is affordable.
**Fix:** Recount and restate, or derive it: `const SPELLINGS = [...]` at module scope, and quote
`MATRIX.filter(r => r.contained === "refuses").length * (SPELLINGS.length + 1)` in the comment.

### WR-22: `scripts/lib/audit-root.d.mts` omits `splitReadRefusalReason`

**File:** `scripts/lib/audit-root.d.mts:1-18`
**Issue:** The module exports three functions; the declaration file declares two. Four scripts
import the third. Nothing breaks today because the `.mjs` consumers are untyped and no test
imports it — which is also the point: the one export whose message text is asserted verbatim by
four spawned test cases has no type surface, so it cannot be unit-tested from a `.ts` file without
first editing the declarations.
**Fix:**

```ts
export declare function splitReadRefusalReason(options: {
  resolvedRoot: string;
  defaultRoot: string;
  imports: Array<{ name: string; from: string }>;
}): string;
```

### WR-23: `scripts/check-guard-fates.d.mts` omits `plant` from `GuardFateObservedRed`

**File:** `scripts/check-guard-fates.d.mts:17-24`
**Issue:** All 35 committed `observedRed` objects carry a `plant` (verified), the harness writes
it at `:529-543`, and `WR-06`'s fix requires the CI gate to read it. The declared interface has
`command`, `cwd`, `exitStatus`, `excerpt`, `control` and nothing else, so a strict-mode test that
constructs an `observedRed` with a `plant` fails on excess-property checking. The type contract
omits the field that makes the evidence reproducible.
**Fix:** Add `plant?: { kind?: string; file?: string; find?: string; replace?: string } | null;`
to `GuardFateObservedRed`.

### WR-24: five of six consumers advertise `[--root <dir>]` while refusing every value but a spelling of the repository root

**File:** `scripts/lib/audit-root.mjs:148-151`; consumers
`generate-tool-support-table.mjs:408-418`, `check-skill-tool-coverage.mjs:188-196`,
`check-skill-fork-honesty.mjs:207`, `check-skill-cli-invocations.mjs:196-204`,
`check-guard-fates.mjs` (needs a git object store, so any in-repo subdirectory fails)
**Issue:** After the `CR-03` refusal landed, the shared usage line still promises `[--root <dir>]`
on every consumer. On five of six the only accepted `<dir>` is one that resolves to the repository
root, i.e. the flag is inert. An operator reading the usage line has no way to learn that before
running it. Related consequences already visible in the code: the `where` suffix at
`generate-tool-support-table.mjs:450` (`p.root === DEFAULT_ROOT ? "" : ...`) is now
unreachable, and the whole `SKIPPED the installer/skills/ regeneration` arm at
`check-skill-cli-invocations.mjs:256-262` is unreachable (that one is deliberately retained and
its reasoning holds — re-enabling an arbitrary root without it would spawn `sync-skills.mjs` from
an operator-supplied tree — so it is correctly kept).
**Fix:** Let `parseRootArg()` take a `rootPolicy: "any-contained" | "default-only"` and print the
honest usage line for each: `[--root <dir>]` for `check-skill-description-overlap`, and
`[--root <this repository's root>]` plus a one-line "an arbitrary root is refused; see SPLIT READ
REFUSED" note for the other five. Also delete the now-dead `where` suffix, or keep it with a
comment saying why it is unreachable, matching how the `else` arm in the invocations gate is
handled.

### WR-25: `deriveAuditedSet`'s `roadmapText` docblock claim is false

**File:** `scripts/check-guard-fates.mjs:462-470`
**Issue:** "it is never supplied by the CLI, and every value it can take either leaves the
derivation unchanged or makes `resolveSetC` THROW." The second clause is not true.
`resolveSetC()` accepts any text whose deferred-fates note yields exactly `SET_C_FLOOR` backticked
tokens each resolving to exactly one tracked path — so a crafted `roadmapText` naming two
*different* tracked `.ts` files produces a *different* set C and a different union, with no throw.
`deriveAuditedSet` is an exported function; the first clause (not CLI-reachable) is what actually
keeps this safe, and the second is doing work it cannot do. This is a docblock claim the code does
not honour, which this repository weights above ordinary defects.
**Fix:** Reduce the claim to what holds: "it is never supplied by the CLI; the driver at the
bottom of this file is the only caller and passes only `{ root }`. A test that supplies it can
change the derived set C, so it may only ever be used to make a check FAIL — never to make one
pass."

### WR-26: two CI-blocking checks now hard-depend on live `.planning/` phase artifacts

**File:** `.github/workflows/ci.yml:257-258`; `scripts/check-guard-fates.mjs:80-90`;
`src/mcp/vice/docs-linerefs.test.ts:64-67`
**Issue:** This is `WR-10` restated because the round widened it rather than closing it.
`check-guard-fates.mjs` is blocking and reads `.planning/ROADMAP.md`'s `### Phase 32` heading (set
C resolved from line 830) and `.planning/phases/32-…/guard-fates.json`. `docs-linerefs.test.ts`,
which runs under the blocking `npm test` step, now additionally requires `.planning/PROJECT.md` to
exist *and* to carry exactly one `rewriteArguments()` bullet with ≥2 citations. Archiving this
milestone's phase directories, or any reword of the ROADMAP marker sentence, reds CI for a reason
unrelated to the code. Both fail closed, which is right; neither has a recorded exit.
**Fix:** (a) move `guard-fates.json` and the set-C mandate somewhere milestone-durable, or promote
the two set-C members into the derivation so `ROADMAP.md` stops being a CI input; (b) record
`check-guard-fates.mjs`'s own `removalTrigger` in its header — it demands one from all 54
non-deleted rows it audits while having none; (c) add a milestone-close checklist item covering
both this gate and `SCANNED_DOCS`.

---

## Info

### IN-08: `showAt()` swallows every git error, not only "object not present"

**File:** `scripts/check-guard-fates.mjs:182-188`
**Issue:** `catch { return ""; }` turns a transient git failure (buffer overrun, ENOMEM, a broken
object store) into "the subject is not in this file", silently dropping a member from set A. The
`!==` floor makes that red, so it is fail-closed — but the resulting message blames "the ls-tree
walk or the content predicate", which points a reader away from the real cause. One sentence in
the docblock, or a narrowed catch, would fix the diagnosis.

### IN-09: recorded excerpts embed absolute worktree paths

**File:** `guard-fates.json` (`observedRed.excerpt` on the re-measured rows)
**Issue:** `runGuard()`'s docblock states the reasoning for recording a root-relative `cwd`: "an
absolute path pins the artifact to the machine that produced it, and this evidence has to stay
re-runnable from any clone." Several excerpts nonetheless carry
`/home/henrik/.../.claude/worktrees/agent-a4c097c848a03c6d7/src/mcp/vice/...` inside the captured
output. That is raw child output and cannot be sanitised without falsifying it, so this is not a
defect — but it means "re-runnable from any clone" is true of the `command`/`cwd`/`plant` triple
and not of the excerpt, and it is worth saying so where the claim is made.

### IN-10: `hardFailure` discards a whole sweep's measurements when any single row fails

**File:** `scripts/audit-mutation-harness.mjs:730-743`
**Issue:** `if (!hardFailure) writeFileSync(registryPath, ...)` means one unmeasurable or
zero-exit row in an `--all` run throws away the other 34 successful captures. Defensible as
all-or-nothing evidence, and the evidence markdown is still written, but combined with `CR-06`
(one row that now always hard-fails) it means `--all` currently cannot write the registry at all.
Worth one sentence stating the intent, or a `--partial` that is loud about what it kept.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 2 — replaces `203fb6d:.planning/phases/32-the-deletion-and-the-grep-gate/32-REVIEW.md`_
