---
phase: 32-the-deletion-and-the-grep-gate
reviewed: 2026-09-01T16:00:00Z
depth: standard
round: 4
supersedes: e35af74 (round-3 report)
files_reviewed: 22
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - scripts/audit-gate.mjs
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
  - src/mcp/vice/audit-harness-restore.test.ts
  - src/mcp/vice/audit-root-args.test.ts
  - src/mcp/vice/docs-linerefs.test.ts
  - src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs
  - src/mcp/vice/fixtures/harness-signal/restore-disarm-driver.mjs
  - src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs
  - src/mcp/vice/fixtures/harness-signal/signal-window-driver.mjs
  - src/mcp/vice/guard-fates.test.ts
findings:
  critical: 1
  warning: 36
  info: 15
  total: 52
status: issues_found
---

# Phase 32: Code Review Report (Round 4)

**Reviewed:** 2026-09-01
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found
**Replaces:** round-3 report at commit `e35af74`

## Summary

Measured on the current tree before writing anything:

- `node --test audit-harness-restore.test.ts` → **15/15 pass**, 2.2 s.
- `npm run test:automated` → `tests 3027 / pass 3021 / fail 0 / skipped 1 / todo 5`, 47.5 s.
- `npx tsc --noEmit` in `src/mcp/vice` → exit 0.
- `git status --porcelain` byte-identical before and after (four pre-existing untracked docs only).
- Registry replay of all 61 rows through the harness's own plant arithmetic (read-only reimplementation): **35 rows carry a plant, 0 fail the new post-condition, 0 fail the strict `slice`-splice equality, 0 carry a code point above U+00FF.**
- `JSON.stringify(registry, null, 2) + "\n"` is byte-identical to the committed `guard-fates.json`, so the write-back is a genuine no-op on an unchanged sweep.

**The three round-3 criticals are genuinely closed, and I proved each one non-vacuously
rather than taking the tests' word for it.** I copied the harness, its seam and the four
drivers into a scratch tree outside the repository and ran five mutations against the
committed fixtures:

| mutation applied to the copied harness | case that should go red | observed |
|---|---|---|
| post-condition reverted to the whole-file `post - pre` difference | `overlap-accepted` | `planted=false` → **RED** |
| `CR-02` replacer function reverted to a replacement STRING | `substitution-is-verbatim` | `planted=false` → **RED** |
| the `latin1`-representability loop deleted | `non-latin1-refused` | `planted=true` → **RED** |
| the `restored` latch re-introduced | disarm `SIGINT`/`SIGTERM` second window | `exitCode=130`, `fileByteIdentical=false`, second plant still on disk → **RED** |
| `originals.clear()` removed from `restoreAll()` | the `WR-03` no-op case | `sentinelIntactAfterSecondCall=false`, driver exit 1 → **RED** |

Every one of the five discriminates. `CR-09`, `CR-10`, `CR-11`, `WR-03`, `WR-27`, `WR-29`
and `IN-10` are closed. Round 3 asked for exact-equality arithmetic; the executor shipped a
different two-fact form (position + length delta) and argued it is exact under overlap — it
is, for the replacer-function code path, and the `substitution-is-verbatim` pin is what
keeps it from being a tautology. That call is sound and it was executed well.

**What is still wrong.** Nothing new rises to Critical. `CR-07` — the one round-3 critical
nobody touched — is still open and still live: `check-skill-cli-invocations.mjs:266-271`
`rmSync`s and repopulates `installer/skills/` at module scope on the default root, the
adjacency loop at `audit-root-args.test.ts:930-932` drives it five times, and four other
test files read that tree under a parallel runner.

Behind that, three of the four things this round set out to fix are only **half** closed, and
in each case the unclosed half is the one the phase's own standard names:

1. `WR-34` was fixed for `plant.file` and left alone for `guard.cwd` (`:560`) — which still
   reports a bad **registry** value as a `--root` refusal, and, worse, throws out of
   `measureRow()` entirely and aborts the whole sweep. That is exactly the blast-radius
   defect plan 32-15 built the per-row containment for, surviving on the guard half of the
   same function (`WR-37`).
2. `WR-28`'s poll-loop liveness check was added — twice, once per copy — but the
   `'exit'`-versus-`'close'` half and the 200 ms negative-control hold were not, so the race
   the finding describes is unchanged (`WR-28`, and `WR-40` on the duplication that made the
   fix have to be written twice).
3. `WR-36` is closed for `plant()` and untouched for everything else. Nothing in the tree
   imports or spawns `measureRow()`, `selectRows()` or `main()`, so the D-05 verdict skip —
   whose own comment at `:743-748` names "driven by the VERDICT, never by the absence of a
   descriptor" as the load-bearing property — and the refused-plant containment that is the
   entire point of plan 32-15 both still ship with zero standing coverage.

One measured vacuity worth naming: in `bad-plant-target-attribution`, the assertion carrying
the comment *"This assertion is the one that must never change"* (`planted === false`) passes
under a **total** containment relaxation, because the escape target does not exist and
`existsSync` refuses it first. I removed the containment check entirely in the copied tree and
that assertion stayed green (`WR-38`). The test as a whole still goes red, via the
`/OUTSIDE the repository root/` message match — so it is not a vacuous test, but the assertion
labelled as the containment guard is not the one doing the guarding.

Everything else round 3 recorded against `check-guard-fates.mjs`, `check-guard-fates.d.mts`,
`docs-linerefs.test.ts`, `guard-fates.test.ts`, `audit-gate.mjs`, `lib/audit-root.mjs`,
`audit-root-args.test.ts` and `.gitignore` stands verbatim: `git diff e35af74..HEAD` is empty
for every one of those files.

---

## Round-1/2/3 Finding Dispositions

Re-verified against the current tree. Ids dispositioned as closed in earlier rounds
(`CR-01`–`CR-04`, `WR-13`, `IN-06`, `IN-07`) are not repeated.

| id | disposition | evidence |
|---|---|---|
| CR-05 | **Closed** (round 3). Unchanged. | `audit-mutation-harness.mjs:680-703` |
| CR-06 | **Closed.** Superseded by the `CR-09` fix; the `pre-existing-replacement-accepted` case is the standing pin, and it is red under the reverted arithmetic. | `plant-contract-driver.mjs:146-150`; mutation table above |
| CR-07 | **STILL OPEN, untouched.** `check-skill-cli-invocations.mjs:266-271` runs `installer/scripts/sync-skills.mjs` at module scope whenever the resolved root is the repository; that script `rmSync`s and repopulates `installer/skills/` (`sync-skills.mjs:74-80`). The adjacency loop spawns the gate five times (baseline + four spellings), all resolving to the repository root. Four other test files read `installer/skills/`. No mitigation added. | `audit-root-args.test.ts:928-948`; `check-skill-cli-invocations.mjs:266-271`; `installer/scripts/sync-skills.mjs:74-80`; `grep -rl installer/skills src/mcp/vice/*.test.ts` → 5 files |
| CR-08 | **Closed** (round 3). Unchanged. | `audit-root-args.test.ts:628-681` |
| CR-09 | **CLOSED.** Post-condition rewritten to position + length-delta at the unique match site (`:488-505`). Replayed over all 35 committed descriptors: 0 refusals, and `mutated` equals the strict `slice`-splice for every one. The `--all` sweep reaches the write-back (`evidence/32-gap1-overlap-and-writeback.md:546-563`: `measured=35 skipped=26 total=61`, 0 `PLANT REFUSED`, 0 `UNMEASURABLE`, `registry: <path>`). Reverting the arithmetic reds `overlap-accepted`. | `audit-mutation-harness.mjs:488-505`; mutation table |
| CR-10 | **CLOSED.** The `restored` latch is deleted; `originals.clear()` is the only idempotence mechanism (`:171-184`, and the note at `:196-234` records why). Re-introducing the latch in a copied tree reds both disarm cases: `exitCode=130`, `fileByteIdentical=false`, `SECOND-PLANT-STILL-THERE`. | `audit-mutation-harness.mjs:171-184`; `restore-disarm-driver.mjs`; `audit-harness-restore.test.ts:815-863`; mutation table |
| CR-11 | **CLOSED.** A non-latin1-representable `find`/`replace` is refused by name, code point and index, before path resolution and before any read or write (`:338-362`). Deleting the loop reds `non-latin1-refused`. Measured basis re-confirmed independently: 0 of 70 descriptor fields carry a code point above U+00FF. | `audit-mutation-harness.mjs:338-362`; mutation table |
| WR-01 | **Still stands.** `timedOut: true` at `:599` is unconditional inside `if (result.error)`; ENOENT/EACCES/ENOBUFS all report "The control TIMED OUT." | `audit-mutation-harness.mjs:578-600, 767` |
| WR-02 | **Still stands.** `maxBuffer` is on `porcelain()` (`:258`) only; the guard `spawnSync` at `:569-575` keeps Node's 1 MiB default, and an overflow lands in the `result.error` branch above → reported as a timeout. | `audit-mutation-harness.mjs:258` vs `:569-575` |
| WR-03 | **CLOSED.** The doubt was whether the second `restoreAll()` is a genuine no-op. It is, `originals.clear()` is the mechanism, and removing that clear reds the case (`sentinelIntactAfterSecondCall=false`, driver exit 1). | `restore-latch-driver.mjs:92-134`; mutation table |
| WR-04 | **Still stands (latent).** No `realpathSync` in the seam or the harness. | `audit-root.mjs:31-34, 84-88` |
| WR-05 | **Still stands.** `resolveBin()` still maps `argv[0] === "--run"` to `npm`; 0 of 61 rows use the convention. | `audit-mutation-harness.mjs:530-541` |
| WR-06 | **Still stands, untouched.** `redOwed()` requires `control.exitStatus === 0` and nothing else — no `command` equality, no `plant`, no tie to `row.newSubject`. | `check-guard-fates.mjs:728-761` |
| WR-07 | **Still stands, untouched.** | `git diff e35af74..HEAD -- scripts/check-guard-fates.mjs` empty |
| WR-08 | **Still stands, untouched.** | as above |
| WR-09 | **Still stands, untouched.** | `git diff e35af74..HEAD -- src/mcp/vice/docs-linerefs.test.ts` empty |
| WR-10 | **Still stands.** The only `ci.yml` change this round is `node-version: 22` → `24` in four jobs. | `git diff e35af74..HEAD -- .github/workflows/ci.yml` |
| WR-11 | **Open by operator decision (2026-09-01).** Unchanged. | — |
| WR-12 | **Still stands.** `evidenceMarkdown()` wraps plant strings in single backticks at `:998`. | `audit-mutation-harness.mjs:998` |
| WR-14 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged |
| WR-15 | **Still stands, and drifted a THIRD time.** `.gitignore:53` cites `scripts/audit-mutation-harness.mjs:654`; line 654 is now the excerpt regex `/(not ok \|AssertionError\|…)/`. The claim now lives at `:915` and `:1227`. Round 3 recorded it as `:758`/`:1024`; those have moved too. | `sed -n 654p scripts/audit-mutation-harness.mjs`; `grep -n "EVIDENCE VOID\|evidence is void"` |
| WR-16 | **Still stands.** `resolve(base, rootArg)` at `audit-root.mjs:86` is repo-root-relative; `audit-gate.mjs:1187` does `resolve(rootArg ?? …)` against the process cwd. The eight root-accepting scripts still disagree about what a relative `--root` means. | `audit-root.mjs:86`; `audit-gate.mjs:1187` |
| WR-17 | **Still stands.** `carriesSplitReadRefusal()` is a bare `text.includes(...)`. | `audit-root-args.test.ts:607-611` |
| WR-18 | **Still stands.** `staticSrcImports()` matches only the script's own text. | `audit-root-args.test.ts:602-605` |
| WR-19 | **Still stands, untouched.** | `docs-linerefs.test.ts` unchanged |
| WR-20 | **Still stands.** `generate-tool-support-table` is still a `"refuses"` row and still takes the adjacency loop, so the committed `docs/tool-support.md` is written five times per run. | `audit-root-args.test.ts:419-427, 928-948` |
| WR-21 | **Still stands, verbatim.** `:919` still says "four scripts x four runs (one unflagged baseline plus three spellings) = 16" and `:50` still says "Total end-to-end runs: 19". The loop at `:932` iterates **four** spellings → 20 for the loop alone. | `audit-root-args.test.ts:50, 919, 932` |
| WR-22 | **Still stands.** `splitReadRefusalReason` is absent from `audit-root.d.mts`; two of three exports declared. | `audit-root.d.mts:1-26` |
| WR-23 | **Still stands, untouched.** `GuardFateObservedRed` omits `plant`. | `check-guard-fates.d.mts:17-24` |
| WR-24 | **Still stands.** `usageLine()` emits `[--root <dir>]` unconditionally. | `audit-root.mjs:173-179` |
| WR-25 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged |
| WR-26 | **Still stands, untouched.** | `ci.yml` / `check-guard-fates.mjs` / `docs-linerefs.test.ts` unchanged in substance |
| WR-27 | **CLOSED.** The latch is gone, so the criticism ("cannot distinguish the latch from `originals.clear()`") is moot; the discriminating second-window pair now exists and is red against a re-introduced latch. | `audit-harness-restore.test.ts:642-863`; mutation table |
| WR-28 | **Partially closed.** The plant-poll loop now carries the `!exited` liveness check (`:411-422`, and again at `:762-773`). NOT done: the exit promise still resolves on `'exit'` rather than `'close'` (`:361-368`, `:691-698`), and the negative control's hold is still 200 ms (`:337`). See the finding below. | `audit-harness-restore.test.ts:337, 361-368, 411-422` |
| WR-29 | **CLOSED.** `src/` is admitted, with a derivation re-run against the registry (23/10/2 split recorded at `:238-280`), minus `/fixtures/` and dot-prefixed segments — both exclusions carry a measured 0-of-35 cost. | `audit-harness-restore.test.ts:238-305` |
| WR-30 | **Still stands.** `.gitignore:63-66` still says the test "asserts `git status --porcelain` is byte-identical across an interrupted run". It does not — `porcelainByteIdentical` is recorded, not asserted (`audit-harness-restore.test.ts:198-200, 282-284, 463`). The entry is still load-bearing for the reason round 3 gave; the sentence naming why is still false. | `.gitignore:57-66`; `audit-harness-restore.test.ts:198-200, 463` |
| WR-31 | **Still stands.** `src.includes(ROOT_FLAG)` under a docblock promising "ACCEPTS a root, HOWEVER IT READS IT". | `audit-root-args.test.ts:641, 663` |
| WR-32 | **Still stands.** The header's no-write basis still omits `runGuardsLive()`'s `spawnSync(process.execPath, ["--test", …])` over `docs-*.test.ts` found under the uncontained root. | `audit-gate.mjs:66-77, 1187`, `:263` |
| WR-33 | **Partially addressed, still stands.** `withoutComments()` now blanks whole-line comments first, but the trailing arm `line.replace(/\/\/.*$/, "")` is still applied to code lines, so `const doc = "see https://x"; writeFileSync(p, doc);` still strips to zero write calls. Only-false-greens direction unchanged, and E2 is the sole mechanical revocation of `T-32-22`. | `audit-root-args.test.ts:1295-1300` |
| WR-34 | **Half closed.** `plant.file` is re-attributed to the registry with the containment refusal carried verbatim (`:367-390`), and the `bad-plant-target-attribution` case pins it. `guard.cwd` at `:560` is untouched: a bad registry `cwd` still produces `--root "/x" resolves to … which is OUTSIDE the repository root`. Reproduced directly against the seam. | `audit-mutation-harness.mjs:560`; `audit-root.mjs:95-101` |
| WR-35 | **Still stands.** `resolveBin()` unchanged; `guard.argv` is handed to `process.execPath` with no allow-list, so `argv: ["-e", "<js>"]` in the registry would be evaluated — contradicting the header clause at `:126-128`. | `audit-mutation-harness.mjs:126-128, 530-541, 569-575` |
| WR-36 | **Partially closed.** `plant()` now has eight named contract cases, all non-vacuous (mutation table). NOT closed: nothing imports or spawns `measureRow()`, `selectRows()` or `main()`, so the D-05 verdict skip (`:749-756`) and the refused-plant containment (`:793-804`) — plan 32-15's whole deliverable — still have zero coverage. | `grep -rl audit-mutation-harness` → only the four drivers + two test files, none of which reach `measureRow()` |
| IN-01 | **Still stands.** | `grep -rn allowExtra scripts/ src/` |
| IN-02 | **Still stands.** `after = porcelain(root)` at `:1098` precedes both the registry write (`:1168`) and the evidence write (`:1175`). | `audit-mutation-harness.mjs:1098, 1168, 1175` |
| IN-03 | **Still stands.** | `audit-mutation-harness.mjs:171-194` |
| IN-04 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged |
| IN-05 | **Still stands.** `grep -n unhandledRejection scripts/audit-mutation-harness.mjs` is empty. | `audit-mutation-harness.mjs:235-248` |
| IN-08 | **Still stands, untouched.** | `ci.yml` / `check-guard-fates.mjs` unchanged in substance |
| IN-10 | **CLOSED.** `--all` reaches the write-back. Recorded run: `counts: measured=35 skipped=26 total=61`, `registry: <path>`, `tree: restored byte-identical to the baseline`, 0 `PLANT REFUSED`, 0 `UNMEASURABLE`. Independently corroborated: the registry round-trips byte-identically through `JSON.stringify(…, null, 2) + "\n"`. | `evidence/32-gap1-overlap-and-writeback.md:546-563` |
| IN-11 | **Still stands.** `lines.push("\`\`\`")` at `:974` and `:976`, against `lines.push("```")` everywhere else in the same function. | `audit-mutation-harness.mjs:974, 976` |
| IN-12 | **Still stands.** The six-file CORRECTION block is unchanged in all six. | `grep -c "CORRECTION" scripts/*.mjs` |
| IN-13 | **Still stands, drifted.** Now at `generate-tool-support-table.mjs:384`. | `grep -n "Plan 32-11 migrates" scripts/` |
| IN-14 | **Still stands.** The attempt-log test at `:865-890` still reads a module-level array populated by the tests above it. The new disarm and plant-contract cases deliberately do not push, which is the right call and is documented at `:646-655`. | `audit-harness-restore.test.ts:865-890` |
| IN-15 | **Still stands.** `booleanFlags` has no `seen` check. | `audit-root.mjs:292-295` |

---

## Narrative Findings (AI reviewer)

New ids continue: warnings from `WR-37`, info from `IN-16`. No new Critical.

## Critical Issues

### CR-07: the adjacency loop rebuilds `installer/skills/` five times while four other test files read it

**File:** `src/mcp/vice/audit-root-args.test.ts:928-948`;
`scripts/check-skill-cli-invocations.mjs:266-271`;
`installer/scripts/sync-skills.mjs:74-80`

**Issue:** Carried forward from round 3, untouched, and re-verified live this round. At module
scope — before any check runs — `check-skill-cli-invocations.mjs` does:

```js
if (P.root === DEFAULT_ROOT) {
  execFileSync(process.execPath, [P.syncScript], { cwd: P.root, stdio: "pipe" });
}
```

and `sync-skills.mjs` then does `rmSync(DEST, { recursive: true, force: true })` followed by a
`cpSync` repopulation of `installer/skills/`. The adjacency-accept loop spawns that gate five
times per run — one unflagged baseline plus the four spellings `".", ROOT,
join(ROOT,"scripts",".."), "./scripts/.."`, every one of which resolves to the repository root
and therefore takes the sync branch. Five `rm -rf`-and-rebuild cycles of a shared tree, inside
`node --test '*.test.*'` running ~120 files concurrently, while `ci-suite-coverage.test.ts`,
`anno-verb-coverage.test.ts`, `skill-attribution.test.ts` and `removal-gate.test.ts` all read
`installer/skills/`.

`installer/skills/` is gitignored, so this is invisible to every porcelain assertion in the
suite — including `attributablePorcelainDelta()`. The failure mode is a sibling reading a
half-populated tree and reporting a missing skill, which reads as a real regression.

It has not been observed failing here (the full suite was green twice today), which is what
makes it a latent scheduling hazard rather than a broken build — but the window is a real
`rm -rf` of a directory four other files read, and it is opened four extra times purely to
test flag spellings.

**Fix:** The gate's own comment already establishes that the sync only runs on the default
root. The cheapest correct change is to stop paying for it four extra times — hoist one
baseline run and assert the four spellings against a *root that is not the default* but still
resolves to it is not possible by construction, so instead serialise: mark the adjacency test
`{ concurrency: 1 }` is not enough (the hazard is cross-file). Prefer one of:

```js
// scripts/check-skill-cli-invocations.mjs -- skip the regeneration when it cannot matter
if (P.root === DEFAULT_ROOT && process.env.CHECK_SKILL_CLI_SKIP_SYNC !== "1") { … }
```

driven from the test — which the no-relaxation-hatch rule forbids — or, better, drop the four
adjacency spellings for **this one script** and cover them against
`check-skill-description-overlap` instead (the one skill gate with no static-import refusal
and no working-tree side effect), recording in the loop's budget note why the invocations gate
is excluded. Either way, the note at `:919-926` that calls the sync "idempotent" should say
that idempotent-at-rest is not the property at stake; concurrent readability is.

---

## Warnings

### WR-37: a bad `guard.cwd`, `guard.argv` or missing `guard` still aborts the entire sweep — the per-row containment covers only `plant()`

**File:** `scripts/audit-mutation-harness.mjs:543-560` (the throws), `:761` and `:808` (the
unguarded call sites), `:793-804` (the containment that exists for the other half)

**Issue:** Plan 32-15's stated deliverable is that one bad descriptor is reported *against its
row* instead of aborting the sweep, and the comment at `:779-792` records exactly that:
"Thrown out of the row loop, one bad descriptor aborted the whole sweep at its own index and
left every later row unmeasured AND unreported". That containment was built around `plant()`
only:

```js
let planted;
try { planted = plant(root, row); } catch (err) { report.plantRefused = true; … return report; }
```

`runGuard()` is called twice with no such wrapper — once for the green control at `:761`,
before any plant, and once for the planted run at `:808`. It throws on four distinct registry
defects: no `guard` descriptor (`:546`), a non-array or empty `guard.argv` (`:549`), a
non-string argv element (`:553-557`), and a `guard.cwd` that escapes the root (`:560`). Every
one of those propagates out of `measureRow()`, out of the row loop, into `main()`'s
`catch (err) { restoreAll(); process.exit(1); }` at `:1090-1093` — aborting the sweep at that
index, leaving every later row unmeasured *and unreported*, and writing no evidence file at
all. That is the identical shape, with the identical consequence, one function away from the
fix.

The `guard.cwd` case additionally carries the wrong attribution (the unclosed half of
`WR-34`). Reproduced against the seam directly:

```
$ node -e 'resolveContainedRoot(join("/tmp/fake-root","../elsewhere"),{repoRoot:"/tmp/fake-root"})'
--root "/tmp/elsewhere" resolves to /tmp/elsewhere, which is OUTSIDE the repository root /tmp/fake-root
```

— a refusal of a command-line flag the operator did not pass, for a value that came from the
registry.

Latent today: all 35 measured rows carry a well-formed `guard`, and no row sets `cwd` at all.

**Fix:** Two changes at one site. Wrap both `runGuard()` calls the same way `plant()` is
wrapped, with a distinct `report.guardDescriptorRefused` flag added to the
`suppressionCauses` enumeration at `:1157-1163` so a suppressed write-back still names which
of the now-five causes fired:

```js
let control;
try {
  control = runGuard(root, row, "control (unplanted)");
} catch (err) {
  report.failed = true;
  report.guardDescriptorRefused = true;
  report.reason =
    "this row's `guard` descriptor was REFUSED before the control run, so nothing was " +
    `measured for it and no evidence can be recorded: ${err?.message ?? String(err)}`;
  return report;
}
```

and re-attribute the `cwd` containment exactly as `plant.file` was, at `:560`:

```js
let cwd;
try {
  cwd = resolveContainedRoot(join(root, relativeCwd), { repoRoot: root });
} catch (err) {
  throw new Error(
    `row ${row.historicalPath}: this row's \`guard.cwd\` field names a path ` +
      `(${JSON.stringify(relativeCwd)}) outside the tree this run was pointed at. The path came ` +
      "from the REGISTRY, not from a `--root` argument, so the row is what needs correcting. " +
      `Containment refusal, verbatim: ${err?.message ?? String(err)} (WR-34)`,
  );
}
```

Then add the two cases to `plant-contract-driver.mjs`'s sibling coverage (see `WR-36`).

### WR-28: the exit promise still resolves on `'exit'`, and the negative control's hold is still 200 ms

**File:** `src/mcp/vice/audit-harness-restore.test.ts:337, 361-368, 691-698`

**Issue:** Half of round 3's `WR-28` was taken — the plant-poll loop now checks `!exited`
(`:411-422`, mirrored at `:762-773`) — and that is a real improvement: a dead child now fails
fast and by name instead of spinning for 20 s and blaming `plant()`. The other half was not.

`exitPromise` still resolves on `'exit'`:

```ts
const exitPromise = new Promise<void>((resolveExit) => {
  child.on("exit", (code, sig) => { exited = true; … });
});
```

`'exit'` fires when the child terminates; `'close'` is the event that additionally guarantees
the piped stdio streams are drained. So `exited` can become `true` while the marker line is
still sitting unread in the parent's stream. Both liveness checks — the marker loop at
`:377-381` and the plant-poll loop the fix just added at `:418-422` — then fire on a run that
would have succeeded, with a message that positively asserts the driver never emitted its
marker. **Adding the second `!exited` check widened the exposure to this race rather than
narrowing it.**

The only attempt where the child can plausibly beat the parent is the negative control, whose
hold is still `signal === "none" ? 200 : 30000` at `:337`. 200 ms between the child's
`stdout.write` and the parent's first `readFileSync` is comfortable on this host (six
concurrent runs of the file were 6/6 green at ~2.2 s each; the full suite was green twice
today) and is not obviously comfortable on a 2-core CI runner executing ~120 test files.

**Fix:** Resolve on `'close'` in both `runAttempt` and `runDisarmAttempt`, and raise the
control's hold. The control is signalled by *not* signalling, so a longer hold costs wall
clock only when something is already wrong:

```ts
const exitPromise = new Promise<void>((resolveExit) => {
  child.on("close", (code, sig) => { exited = true; exitCode = code; killedBy = sig; resolveExit(); });
});
…
const holdMs = signal === "none" ? 2000 : 30000;
```

`'close'` carries the same `(code, signal)` arguments, so nothing else moves.

### WR-38: the assertion labelled "the one that must never change" passes with containment removed entirely

**File:** `src/mcp/vice/audit-harness-restore.test.ts:1209-1215`;
`src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs:128-132`

**Issue:** The `bad-plant-target-attribution` case opens with

```ts
assert.equal(
  v.planted,
  false,
  "CONTAINMENT WAS RELAXED. A registry value naming a path outside the tree this run was " +
    "pointed at must be refused, in this state and in every earlier one. This assertion is " +
    "the one that must never change.",
);
```

`ESCAPING_FILE` is `"../plant-contract-escape-target.txt"`, and no such file exists. So when
containment refuses, the refusal comes from `resolveContainedRoot`; when it does **not**,
`plant()` falls through to `if (!existsSync(abs))` at `:391` and refuses anyway. Measured — I
replaced `resolveContainedRoot`'s body with an unconditional `return resolved;` in a copied
tree and re-ran the case:

```
planted=false
msg=row fixtures/…: plant target /…/work/plant-contract-escape-target.txt does not exist.
```

The assertion that is documented as the containment guard stayed green against a total
containment removal. The test as a whole did go red, on
`assert.match(msg, /OUTSIDE the repository root/)` and on ``assert.match(msg, /`plant\.file`/)``
— so the case is not vacuous. But the discrimination is being done by two message-shape
assertions that read as diagnosis checks, while the one carrying the "must never change"
comment does nothing.

That inversion matters here specifically: the comment tells the next maintainer which
assertion is load-bearing, and a future round loosening the "cosmetic" message matches would
silently take the containment coverage with them.

**Fix:** Make the escape target a path that EXISTS and is safe to point at, so the only
possible refusal is the containment one. The parent already creates the scratch root with
`mkdtempSync`; have it create a *second* scratch dir, seed a target inside it, and pass its
path to the driver as a third argument:

```ts
const escapeHome = mkdtempSync(join(ROOT, SCRATCH_PREFIX));           // sibling of `scratch`
writeFileSync(join(escapeHome, "escape-target.txt"), "ESCAPE_TARGET_ANCHOR\n");
spawn(process.execPath, [PLANT_CONTRACT_DRIVER, scratch, caseName, escapeHome], …);
```

with the driver resolving `file` as `relative(scratch, join(escapeHome, "escape-target.txt"))`.
Then removing containment makes the plant SUCCEED, `v.planted` goes `true`, and the assertion
whose comment claims to be the guard actually is one. Watch it fail against the relaxed
resolver before trusting it, the same discipline `restore-disarm-driver.mjs` records.
Alternatively, keep the non-existent target and rewrite the comment to say the containment
discrimination is carried by the `/OUTSIDE the repository root/` match — but then move that
match to the top of the case so it reads as the primary assertion.

### WR-39: `attributablePorcelainDelta()`'s stated claim is wider than what it can measure

**File:** `src/mcp/vice/audit-harness-restore.test.ts:217-305, 462-464`

**Issue:** The docblock states the purpose as "proving the harness did not write outside the
scratch root it was pointed at". Three properties of the implementation make the measurement
narrower than that:

1. **It reads porcelain after the child has exited** (`:462`, after the `await` on
   `exitPromise` at `:447-451`). By that point the harness's registered `exit`/signal handler
   has already restored every captured original, so a mis-contained plant that *was* restored
   leaves no trace at all. What the assertion actually proves is "no write escaped the scratch
   root **and survived restoration**".
2. **It is a set difference over whole porcelain LINES.** A mis-contained plant into a tracked
   file that was already dirty at `porcelainBefore` produces the identical ` M path` line, so
   the delta is empty. Not hypothetical on a developer tree mid-phase.
3. **`const path = l.slice(3)` does not handle porcelain's quoting or rename form.** Git
   quotes any path containing a space, a quote, a backslash or a non-ASCII byte (`?? "src/a
   b.txt"`), and renames render as `R  old -> new`. A quoted path starts with `"`, so
   `startsWith("src/")` is false and the entry is silently unattributable.

None of these is live today — all 35 plant targets are plain ASCII paths, and the drivers
write only inside their scratch roots. The finding is that a filter whose only failure
direction is "silently admits nothing" is being relied on as the escape detector, in a phase
whose standard is that a recorded basis must not be wider than its measurement.

**Fix:** Narrow the docblock's claim to what it measures, and fix (3) cheaply:

```ts
const raw = l.slice(3);
// Porcelain quotes paths with spaces/non-ASCII, and renames render as `old -> new`.
// Take the DESTINATION and unquote, so neither form can slip past the prefix tests.
const path = (raw.includes(" -> ") ? raw.slice(raw.indexOf(" -> ") + 4) : raw)
  .replace(/^"(.*)"$/, "$1");
```

For (1), the honest sentence is "…did not leave a write outside the scratch root behind"; if
the stronger property is wanted, take a third porcelain reading *while the child is still
held* (between the plant-poll loop and the `child.kill`) and record it alongside
`porcelainByteIdentical`.

### WR-40: `runDisarmAttempt()` is a ~110-line near-duplicate of `runAttempt()`, and the `WR-28` fix already had to be written twice

**File:** `src/mcp/vice/audit-harness-restore.test.ts:331-489` versus `:642-813`

**Issue:** The two routines share, line for line with only the marker constant and the
assertion text changed: the scratch/porcelain setup, the spawn, the two stdout/stderr
accumulators, the exit-promise block, the marker poll loop, the plant poll loop with its two
liveness assertions, the "bytes are not identical to original" vacuity guard, the signal, the
raced exit wait, the byte comparison, the porcelain delta and the `readdirSync` + `rmSync`.
`runPlantContractCase()` at `:933-998` carries a third copy of the spawn-and-collect half.

The docblock at `:642-656` argues the split is deliberate, and its reason is sound as far as
it goes — the attempt log asserts exactly five signalled attempts per signal and must not be
widened. But that argues for not pushing onto `attempts`, not for copying the plumbing: a
`recordInLog: boolean` parameter, or a shared `driveOnePlantWindow()` returning the raw
observations with the two routines layering their own assertions on top, satisfies it.

The cost is not hypothetical. The `WR-28` liveness check landed in **the same commit twice**
— `:411-422` and `:762-773` — with a comment at the second site explaining it is a mirror of
the first. The next fix to the poll/exit machinery needs three edits, and the third copy
(`runPlantContractCase`) has neither liveness check today.

**Fix:** Extract the spawn-and-accumulate block and the two poll loops into one helper
parameterised by `{ driverPath, args, markerPrefix, recordInLog }`, returning
`{ child, stdout, stderr, exited, exitCode, killedBy, markerLine, plantedBytes }`. Keep the
two test bodies and their distinct assertion sets exactly as they are; only the plumbing
moves. Then apply `WR-28`'s `'close'` fix once.

### WR-01 through WR-06, WR-09 through WR-12, WR-14 through WR-26, WR-30 through WR-36

All carried forward unchanged from round 3 with the dispositions and evidence recorded in the
table above. Their fix text in the round-3 report at commit `e35af74` still applies verbatim;
it is not restated here. The two with corrected line citations are:

- **WR-15** — `.gitignore:53` cites `scripts/audit-mutation-harness.mjs:654`; the claim now
  lives at `:915` (`"This run's evidence is void."`) and `:1227` (`DIRTY -- EVIDENCE VOID`).
  This citation has now drifted in three consecutive rounds, in a repository that owns a
  mechanical line-reference test. Either cite the *file* with no line number, or add the
  `.gitignore` citation to `docs-linerefs.test.ts`'s checked set.
- **WR-13** — closed, but note `WR-32` and `WR-16` both name what the recorded acceptance in
  `audit-gate.mjs:54-87` still leaves out.

---

## Info

### IN-16: the driver's byte-level comparison cannot detect a `latin1` truncation, though its comment says it can

**File:** `src/mcp/vice/fixtures/harness-signal/plant-contract-driver.mjs:246-254`
**Issue:** The comment says the pair `bytesAtMatchIndexBase64` / `recordedReplacementBase64`
detects "the harness writing bytes the row does not record". `recordedReplacementBytes` is
computed as `Buffer.from(spec.replace, "latin1")` — the *same* truncating encode the harness
uses — so for a non-latin1 descriptor both sides truncate identically and compare equal.
Measured: with the `CR-11` refusal deleted, `non-latin1-refused` reports `planted=true` and
`bytesEq=true`; only the `planted === false` assertion and
`replacementVerbatimAtMatchIndex=false` catch it. The pair does discriminate the `$&` class it
is actually used for (`substitution-is-verbatim`, `bytesEq=false` under the reverted replacer).
**Fix:** Say what it measures — "the `$&`-expansion class" — or compute the expected bytes with
`Buffer.from(spec.replace, "utf8")` when the descriptor is non-latin1, so the comparison can
see the truncation it names.

### IN-17: the three accepted plant-contract cases never assert the pending count the driver's header promises

**File:** `src/mcp/vice/audit-harness-restore.test.ts:1027-1117`;
`plant-contract-driver.mjs:65-69`
**Issue:** The driver's WHAT-NOT-TO-DO block states the contract explicitly: "the verdict
reports `pendingRestoreCount()` as 1 after an accepted plant and must report 0 after a refused
one." Five refused cases assert the 0 half. None of the three accepted cases asserts the 1
half, so an accepted plant that failed to register its original for restoration would pass.
**Fix:** Add `assert.equal(v.pendingRestoreCount, 1, …)` to `overlap-accepted`,
`pre-existing-replacement-accepted` and `substitution-is-verbatim`.

### IN-18: `--out` is resolved outside any try/catch, after the registry write-back, and silently reinterprets an absolute path

**File:** `scripts/audit-mutation-harness.mjs:1171-1175`
**Issue:** Every other resolution in `main()` is wrapped and reported (`:1034-1039`,
`:1055-1061`). `resolveContainedRoot(join(root, args.out ?? …))` is not, so a `--out` naming a
path outside the root surfaces as an `uncaughtException` stack through the handler at `:242`,
at exit 1 with no `audit-mutation-harness: REFUSED --` prefix — after the registry has already
been rewritten. Separately, `join(root, "/tmp/x")` yields `<root>/tmp/x`, so an absolute
`--out` is silently reinterpreted as root-relative rather than refused.
**Fix:** Wrap it in the same shape as `:1034-1039`, move it above the write-back so a bad
`--out` costs nothing, and reject an absolute value in `parseArgs()` with a message naming the
root the path will be taken relative to.

### IN-19: `split()` cannot count self-overlapping matches, so the "exactly once" uniqueness claim is not enforced for a self-overlapping `find`

**File:** `scripts/audit-mutation-harness.mjs:397-405`
**Issue:** `text.split(descriptor.find).length - 1` counts *non-overlapping* matches:
`"ababab".split("abab").length - 1 === 1`, while a reader scanning by hand finds a match at
index 0 and another at index 2. The refusal text says "a plant that matches more than once is
ambiguous about what it proved" — that ambiguity exists for a self-overlapping `find` and the
check reports 1. `text.replace` then takes the first, which happens to be what a
left-to-right hand application does, so nothing is currently mis-planted. Measured: 0 of 35
committed `find` strings self-overlap.
**Fix:** Count with an `indexOf` scan advancing by 1 rather than by `find.length`, or state in
the refusal comment that the count is non-overlapping and that a self-overlapping `find`
resolves to its leftmost match by definition.

### IN-01 through IN-05, IN-08, IN-11 through IN-15

Carried forward unchanged from round 3 with the dispositions and evidence recorded in the
table above; the fix text at commit `e35af74` still applies. `IN-13`'s line has moved to
`scripts/generate-tool-support-table.mjs:384`.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 4 — replaces the round-3 report at commit `e35af74`_
