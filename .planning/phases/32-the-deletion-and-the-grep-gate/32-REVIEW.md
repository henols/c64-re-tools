---
phase: 32-the-deletion-and-the-grep-gate
reviewed: 2026-09-01T12:00:00Z
depth: standard
round: 3
supersedes: c9df889043110be9d7b573b31610fded359be9eb
files_reviewed: 20
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
  - src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs
  - src/mcp/vice/fixtures/harness-signal/signal-window-driver.mjs
  - src/mcp/vice/guard-fates.test.ts
findings:
  critical: 3
  warning: 10
  info: 5
  total: 18
status: issues_found
---

# Phase 32: Code Review Report (Round 3)

**Reviewed:** 2026-09-01
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found
**Replaces:** round-2 report at blob `c9df889043110be9d7b573b31610fded359be9eb`

## Summary

Measured on the current tree before writing anything:

- `node --test audit-root-args.test.ts guard-fates.test.ts docs-linerefs.test.ts audit-harness-restore.test.ts`
  → 100/100 pass, 10.2 s.
- `npm run test:automated` → `tests 3017 / pass 3011 / fail 0 / skipped 1 / todo 5`, 50.4 s,
  `git status --porcelain` unchanged before and after (four pre-existing untracked docs only).
- `audit-harness-restore.test.ts` run six times concurrently → 6/6 green, ~2.2 s each.
- Population census: eight `scripts/*.mjs` carry the `--root` token (`audit-gate`,
  `audit-mutation-harness`, `check-guard-fates`, `check-skill-cli-invocations`,
  `check-skill-description-overlap`, `check-skill-fork-honesty`, `check-skill-tool-coverage`,
  `generate-tool-support-table`) and MATRIX carries exactly those eight.

Four of round 2's criticals were genuinely aimed at and three of them landed. `CR-05` is closed:
the harness now reads argv through `parseRootArg()` with `valueFlags: ["--row","--rows","--out"]`,
so `--root` with no value, `--root --all`, `--out` as the last token and every typo are hard
`BAD ARGUMENTS --` rejections at exit 1 before the registry is opened. `CR-08` is closed properly:
the completeness population is now derived from the flag (`src.includes("--root")`), it selects
eight, `audit-gate` and `audit-mutation-harness` are both inside it with typed expectations, and
the guard is additionally cross-checked against a shell glob expanded in another process so the
two sides cannot be the same mechanism. `CR-02`'s post-condition arithmetic was changed from total
occurrences to introduced occurrences, which unblocked `scripts/lib/skill-honesty-checks.mjs`
exactly as round 2 asked. And the restore-on-signal invariant plan 32-14 could not observe is now
observed for real, through an out-of-process driver rather than by injecting an `await` into the
instrument — that is the right call and it was executed cleanly.

Three things are broken anyway, all three in the harness, all three in the class this phase exists
to police.

1. **The post-condition is still wrong, and one committed evidence row still cannot be
   re-measured.** Round 2's suggested fix (`applied - before !== 1`) was adopted verbatim,
   including its incorrect claim that the form "still catches" the overlap case. It does not: it
   *mis-fires* on it. Replaying every recorded plant against the current tree,
   `src/mcp/vice/hop-chain-comments.test.ts` — whose `replace` is its own `find` with a leading
   newline — computes `pre=1, post=1, introduced=0` and is refused. That is the same defect
   round 2 recorded, moved one row over, and the response this round was to contain the refusal
   to its own row rather than to fix the arithmetic. Because `plantRefused` sets `report.failed`,
   `hardFailure` is still set, so **an `--all` sweep still cannot write the registry back** — the
   consequence round 2 recorded as `IN-10` is now permanent rather than incidental. (`CR-09`)
2. **The restore latch is a permanent one-shot, and exporting `plant()`/`restoreAll()` made that
   reachable.** `restoreAll()` sets `restored = true` and never clears it, so after the first call
   every later plant is unprotected. Reproduced live against the real exported API: plant →
   `restoreAll()` → plant again → SIGINT gives exit 130 with the mutation still on disk, and the
   ordinary exit path leaves it too. The module header's "Restoration is idempotent and registered
   on the normal path AND on `exit`, `SIGINT`, `SIGTERM` and `uncaughtException`" is false for any
   consumer that restores more than once. (`CR-10`)
3. **The `latin1` round trip silently writes bytes the descriptor does not record.** A `replace`
   containing any code point above U+00FF is truncated to one byte by
   `Buffer.from(mutated, "latin1")`, while the post-condition — which compares JS strings — reports
   "introduced 1" and passes. Demonstrated: `→` is written as the single byte `0x92`, not
   `e2 86 92`. That is precisely the record-versus-reality divergence the CR-02 post-condition was
   added to make impossible, surviving inside it. Latent today (0 of 35 descriptors carry a
   non-ASCII `find` or `replace`), silent when it fires. (`CR-11`)

Behind those, the WR-03 investigation is measured but not decisive (`WR-27`), the new porcelain
narrowing dropped the one tree a mis-contained plant would actually land in (`WR-29`), and the
`audit-gate` uncontained-by-design acceptance rests on a "performs no filesystem write" basis whose
own paired guard names the hole it omits (`WR-32`). Most of round 2's warnings are untouched:
`docs-linerefs.test.ts`, `check-guard-fates.mjs`'s `redOwed()`, `check-guard-fates.d.mts` and
`ci.yml` were not modified this round at all, so `WR-06`–`WR-10`, `WR-14`, `WR-19`, `WR-23`,
`WR-25`, `WR-26`, `IN-01`, `IN-04` and `IN-08` stand verbatim.

---

## Round-2 Finding Dispositions

Re-verified against the current tree this round. Round-1 ids `CR-01`–`CR-04`, `IN-06`, `IN-07`
remain closed as recorded in round 2 and are not repeated here.

| id | disposition | evidence |
|---|---|---|
| CR-05 | **Closed.** `parseArgs()` now calls `parseRootArg(argv, { script, booleanFlags: ["--all"], valueFlags: ["--row","--rows","--out"] })`; all four flags get the missing/flag-shaped/repeated rules. Spawned matrix rows cover the harness. | `audit-mutation-harness.mjs:523-546`; `audit-root.mjs:224-330`; `audit-root-args.test.ts:531-538` |
| CR-06 | **Partially closed; recurs at a new row.** The `skill-honesty-checks` case is fixed. The new arithmetic mis-fires on an overlapping `replace` → `CR-09`. | `audit-mutation-harness.mjs:332-348`; registry row `src/mcp/vice/hop-chain-comments.test.ts` |
| CR-07 | **Still stands, untouched.** The adjacency-accept loop still runs `check-skill-cli-invocations` five times (one baseline + four spellings), and that gate still `execFileSync`s `installer/scripts/sync-skills.mjs`, which `rmSync`s and repopulates `installer/skills/` while other test files read it under a parallel runner. No mitigation was added. | `audit-root-args.test.ts:928-948`; `check-skill-cli-invocations.mjs:265-270`; `installer/scripts/sync-skills.mjs:74-82` |
| CR-08 | **Closed.** Population derived from `ROOT_FLAG` over a `latin1` read of every `scripts/*.mjs`, cross-checked against an out-of-process shell glob, with a `>= 8` non-vacuity floor and typed per-row expectations. Both previously-invisible scripts are now members. | `audit-root-args.test.ts:628-681, 720-777` |
| WR-01 | **Still stands.** `timedOut: true` at `:442` is unconditional inside `if (result.error)`; ENOENT/EACCES is still reported to the operator as "The control TIMED OUT." | `audit-mutation-harness.mjs:421-443, 611` |
| WR-02 | **Still stands.** `maxBuffer` is on `porcelain()` (`:223`) only; the guard `spawnSync` at `:412-418` still keeps Node's 1 MiB default. | `audit-mutation-harness.mjs:223` vs `:412-418` |
| WR-03 | **Open, and now measured — with the wrong question asked.** A test exists, it passes, and it is blind to the latch's real defect. See `WR-27` and `CR-10`. | `restore-latch-driver.mjs:92-125`; `audit-harness-restore.test.ts:449-510` |
| WR-04 | **Still stands (latent).** No `realpathSync` anywhere in the seam or the harness; `git ls-files -s \| awk '$1=="120000"'` is still empty. | `audit-root.mjs:30-33` |
| WR-05 | **Still stands.** `resolveBin()` still maps `argv[0] === "--run"` to `npm`. Re-measured: `npm --run typecheck` prints `Unknown command: "typecheck"` and exits 1. No registry row uses the convention (0 of 61), so it is documented-but-dead. | `audit-mutation-harness.mjs:373-384` |
| WR-06 | **Still stands, untouched.** `redOwed()` requires `control.exitStatus === 0` and nothing else; no `command` equality, no `plant`, no tie to `row.newSubject`. All 35 committed rows satisfy the stricter rule (measured: 0 rows with `control.command !== command`), which remains a property of the producer. | `check-guard-fates.mjs:728-761` |
| WR-07 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged this round |
| WR-08 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged this round |
| WR-09 | **Still stands, untouched.** `docs-linerefs.test.ts` has no diff since round 2. | `git diff 05ca6c6..HEAD -- src/mcp/vice/docs-linerefs.test.ts` is empty |
| WR-10 | **Still stands, untouched.** | `ci.yml` unchanged this round |
| WR-11 | **Open by operator decision (2026-09-01).** Unchanged. | — |
| WR-12 | **Still stands.** `evidenceMarkdown()` still wraps plant strings in single backticks (`:841`) and output in bare fences. | `audit-mutation-harness.mjs:841, 745-753, 834-836, 849-851` |
| WR-13 | **Closed.** `audit-gate.mjs` is on the shared strict parser (`:1170-1180`), its hand-rolled reader is gone, and the six copied comment blocks that asserted the non-migration were corrected in place. The containment half is a recorded decision with a mechanically-armed reversal trigger (`E1`/`E2`), not an omission — but see `WR-32` for what the recorded basis leaves out. | `audit-gate.mjs:54-87, 1159-1182`; `audit-root-args.test.ts:1326-1418` |
| WR-14 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged this round |
| WR-15 | **Still stands, and drifted again.** `.gitignore:53` still cites `scripts/audit-mutation-harness.mjs:654`. Line 654 is now `revert(planted.absolute);`. The claim lives at `:758` and `:1024`. | `sed -n 654p scripts/audit-mutation-harness.mjs` |
| WR-16 | **Still stands.** `resolve(base, rootArg)` is unchanged and neither `usageLine()` nor `resolveContainedRoot`'s `@param` mentions the base. Worse this round: `audit-gate.mjs:1187` does `resolve(rootArg ?? …)` against the **process cwd**, so the eight root-accepting scripts now disagree with each other about what a relative `--root` means. | `audit-root.mjs:86`; `audit-gate.mjs:1187` |
| WR-17 | **Still stands.** `carriesSplitReadRefusal()` is still a bare `text.includes(...)`. | `audit-root-args.test.ts:614-616` |
| WR-18 | **Still stands.** `staticSrcImports()` still matches only the script's own text. | `audit-root-args.test.ts:600-604` |
| WR-19 | **Still stands, untouched.** | `docs-linerefs.test.ts` unchanged this round |
| WR-20 | **Still stands.** `generate-tool-support-table` is still a `"refuses"` row and still takes the adjacency loop, so the committed `docs/tool-support.md` is still written six times per run. | `audit-root-args.test.ts:419-427, 928-948` |
| WR-21 | **Still stands, verbatim.** Both budget notes still say "four scripts x four runs (one unflagged baseline plus three spellings) = 16" and "Total end-to-end runs: 19". The loop at `:930` iterates **four** spellings → 20 runs for the loop alone, plus three more completed runs = 23. | `audit-root-args.test.ts:44-51, 915-925, 930` |
| WR-22 | **Still stands.** `splitReadRefusalReason` is still absent from `audit-root.d.mts`; the file declares two of three exports. | `audit-root.d.mts:1-26` |
| WR-23 | **Still stands, untouched.** `check-guard-fates.d.mts` has no diff; `GuardFateObservedRed` still omits `plant`. | `check-guard-fates.d.mts:17-24` |
| WR-24 | **Still stands.** `usageLine()` still emits `[--root <dir>]` unconditionally for all eight consumers. | `audit-root.mjs:168-175` |
| WR-25 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged this round |
| WR-26 | **Still stands, untouched.** | `ci.yml`, `check-guard-fates.mjs`, `docs-linerefs.test.ts` unchanged this round |
| IN-01 | **Still stands.** | `grep -rn allowExtra scripts/ src/` |
| IN-02 | **Still stands.** `after = porcelain(root)` at `:937` precedes both writes. | `audit-mutation-harness.mjs:937-972` |
| IN-03 | **Still stands.** | `audit-mutation-harness.mjs:172-187` |
| IN-04 | **Still stands, untouched.** | `check-guard-fates.mjs` unchanged this round |
| IN-05 | **Still stands.** `grep -n unhandledRejection scripts/audit-mutation-harness.mjs` is empty. | `audit-mutation-harness.mjs:200-213` |
| IN-10 | **Still stands, and hardened into a permanent condition.** `if (!hardFailure) writeFileSync(registryPath, …)` is unchanged, and `CR-09` guarantees `hardFailure` on every `--all` run, so `--all` can never write the registry today. | `audit-mutation-harness.mjs:922, 964-966` |

---

## Narrative Findings (AI reviewer)

New ids continue from round 2 so no id is ever reused: criticals start at `CR-09`, warnings at
`WR-27`, info at `IN-11`.

## Critical Issues

### CR-09: the corrected post-condition mis-fires on an overlapping `replace`, so one committed row is still un-reproducible and `--all` can never write the registry

**File:** `scripts/audit-mutation-harness.mjs:332-348`

**Issue:** Round 2's `CR-06` fix was adopted exactly as written, including the sentence "Note the
overlap case (`replace` containing `find`, or splicing joining boundaries) is still caught by this
form." It is not caught — it is *mis-fired on*. The check is:

```js
const preExisting  = text.split(descriptor.replace).length - 1;
const afterMutation = mutated.split(descriptor.replace).length - 1;
const introduced = afterMutation - preExisting;
if (introduced !== 1) throw …
```

When `replace` textually overlaps the region it replaces, the new occurrence and the pre-existing
one share bytes and `split` counts them as one. The registry has such a row today. Its descriptor
is `find: "// src/mcp/vice -> repo root -> .planning/phases/11-.../evidence/criterion1"` and
`replace: "\n" + find` — i.e. insert a blank line. Replaying every recorded plant against the
current tree with the harness's own code:

```
$ node -e '…replay plant() arithmetic over all 61 rows…'
FAIL src/mcp/vice/hop-chain-comments.test.ts occ 1 pre 1 post 1
rows with plant: 35 failing: 1
```

`pre = 1` because the file already contains a newline immediately before the comment; `post = 1`
because after the insert it still contains exactly one `"\n// src/mcp/vice -> …"`. `introduced`
comes out `0` and the plant is refused. The bytes that would reach disk are exactly the bytes the
descriptor records; a reader applying the find/replace by hand reproduces it perfectly. The
instrument refuses its own honest evidence.

The harness header already knows this (`:626-633` names this row and says the difference "comes
out 0 … even after the post-condition arithmetic was corrected"). The response was to contain the
refusal to its own row instead of fixing the arithmetic. That containment does not remove the
consequence, because `measureRow()` sets `report.failed = true` alongside `report.plantRefused`
(`:640-641`), `main()` sets `hardFailure` from `report.failed` (`:922`), and the write-back is
gated on `!hardFailure` (`:964`). So:

- Round 2 recorded that "one of the 35 machine-captured rows can no longer be re-measured by the
  committed instrument." That is **still true**, of a different row.
- Round 2's `IN-10` ("`--all` currently cannot write the registry at all") is no longer a passing
  state — it is now a permanent property of the committed tree.

**Fix:** Stop counting occurrences at all. The invariant the assertion actually wants is "the bytes
written are the bytes a hand-applied splice of this descriptor produces", and that is an equality,
not a count:

```js
const at = text.indexOf(descriptor.find);
const expected = text.slice(0, at) + descriptor.replace + text.slice(at + descriptor.find.length);
if (mutated !== expected) {
  throw new Error(
    `row ${row.historicalPath}: plant post-condition FAILED for ${descriptor.file} -- applying ` +
      "the recorded `find`/`replace` by hand at the single match site does not produce the text " +
      "this harness would write. The row would promise a reader a reproduction that does not " +
      "reproduce. Nothing was written.",
  );
}
```

`find` is already proven to occur exactly once at `:287-295`, so `indexOf` is unambiguous. This
form is exact, is immune to overlap and to pre-existing occurrences alike, and — unlike a count —
cannot pass while the written bytes differ (see `CR-11`, which the byte-level variant of this same
comparison also closes). After fixing, re-run
`node scripts/audit-mutation-harness.mjs --row src/mcp/vice/hop-chain-comments.test.ts` and confirm
the recorded red still reproduces, then re-run `--all` and confirm the registry write-back is
reached.

---

### CR-10: `restoreAll()`'s `restored` latch never resets, so any plant made after the first restore is left on disk — including on SIGINT

**File:** `scripts/audit-mutation-harness.mjs:170-187` (the latch), `:200-213` (the handlers it
guards), `:257` and `:172` (the newly exported surface that makes it reachable)

**Issue:** The latch is a module-lifetime one-shot:

```js
let restored = false;
export function restoreAll() {
  if (restored) return;
  restored = true;
  for (const [abs, bytes] of originals) { … }
  originals.clear();
}
```

Nothing ever sets `restored` back to `false`, and `plant()` does not clear it. Once any consumer
has called `restoreAll()` — which plan 32-19's own `restore-latch-driver.mjs` does twice — the
`exit`, `SIGINT`, `SIGTERM` and `uncaughtException` handlers are all permanently disarmed.

Reproduced against the real exported API (scratch tree, no repository files touched):

```
$ node drv.mjs "$PWD"          # plant → restoreAll() → plant again → SIGINT
cycle1 after restore: "ORIGINAL_MARKER\n" pending 0
cycle2 planted: "PLANTED_TWO\n" pending 1
exit=130
FINAL ON DISK: PLANTED_TWO
```

Exit code 130 — the handler ran and reported success — with the mutation still on disk. The
ordinary path is no better:

```
$ node drv2.mjs "$PWD"         # plant → restoreAll() → plant again → normal exit
driver exit hook, pending=1
exit=0
FINAL: P2
```

This directly contradicts the file's own first WHAT-NOT-TO-DO rule ("Do not let a run leave a plant
behind … Restoration is idempotent and registered on the normal path AND on `exit`, `SIGINT`,
`SIGTERM` and `uncaughtException`") and the invariant plan 32-19 exists to have observed.

Two aggravating facts. First, the latch is not merely dangerous, it is **redundant**:
`originals.clear()` already makes a second call a no-op, so removing the latch changes nothing
about the double-fire case it was written for. Second, the CLI is safe only by accident of call
order — `measureRow()` uses `revert()` per row and `main()` calls `restoreAll()` exactly once, in
the `finally` after the loop, after which nothing plants. Plan 32-19 turned a private invariant
into a public API without re-examining it.

**Fix:** Delete the latch; `originals.clear()` is the idempotence.

```js
export function restoreAll() {
  for (const [abs, bytes] of originals) {
    try { writeFileSync(abs, bytes); } catch (err) { /* shout, keep going */ }
  }
  originals.clear();
}
```

If a latch is wanted for a different reason, scope it to the process-exit path only, or clear it in
`plant()` (`restored = false;` next to `originals.set(...)`). Then extend
`restore-latch-driver.mjs` with the case that would have caught this: `plant → restoreAll → plant →
SIGINT`, asserting the second plant is also reverted.

---

### CR-11: a non-ASCII `replace` is silently truncated to one byte by the `latin1` write, and the post-condition passes

**File:** `scripts/audit-mutation-harness.mjs:286` (read), `:304` (substitute), `:332-334`
(post-condition), `:351` (write)

**Issue:** The plant pipeline decodes the target as `latin1`, substitutes in JS-string space, and
re-encodes with `Buffer.from(mutated, "latin1")`. `latin1` encoding takes the low byte of every
code unit, so any character above U+00FF is silently truncated. The post-condition compares JS
strings and therefore cannot see it:

```
string post-condition introduced: 1
bytes written:                        …0a 92 4f 4b 0a…
bytes a hand-edit in UTF-8 would produce: …0a e2 86 92 4f 4b 0a…
```

(`→`, U+2192, written as the single byte `0x92`.) The descriptor records `→OK`; the file receives
an invalid UTF-8 byte. Every downstream consumer — the guard being run, `git diff`, and the reader
following the descriptor by hand — sees something other than what the row promises. This is the
exact record-versus-reality divergence the CR-02 post-condition block (`:306-331`) says it makes
impossible, surviving inside the post-condition itself.

The mirror case is a non-ASCII `find`: the JSON-decoded JS string will never match the `latin1`
view of the file's UTF-8 bytes, so the plant fails with "plant `find` string occurs 0 time(s)",
which blames the descriptor for what is an encoding mismatch.

Latent today — measured, 0 of the 35 descriptors carry a non-ASCII byte in `find` or `replace` — but
this repository's sources are full of `→` and typographic dashes, so the first descriptor that
targets such a line hits it, and it fails silently in the write direction.

**Fix:** Make the post-condition a byte comparison, which closes this and `CR-09` in one move:

```js
const at = text.indexOf(descriptor.find);
const expected = text.slice(0, at) + descriptor.replace + text.slice(at + descriptor.find.length);
const outBytes = Buffer.from(mutated, "latin1");
if (mutated !== expected || outBytes.toString("latin1") !== mutated) { throw … }
```

and reject a descriptor that cannot survive the transport at all, up front beside the other field
checks at `:269-276`:

```js
for (const field of ["find", "replace"]) {
  if (/[^\x00-\xff]/.test(descriptor[field])) {
    throw new Error(
      `row ${row.historicalPath}: plant descriptor field \`${field}\` carries a code point above ` +
        "U+00FF. This harness reads and writes through a byte-preserving `latin1` round trip, so " +
        "such a character cannot be matched against the file's bytes and cannot be written back " +
        "unchanged. Record the descriptor in the file's own byte encoding.",
    );
  }
}
```

---

## Warnings

### WR-27: the WR-03 latch test cannot distinguish the latch from `originals.clear()`, and is blind to the defect the latch actually has

**File:** `src/mcp/vice/fixtures/harness-signal/restore-latch-driver.mjs:92-125`;
`src/mcp/vice/audit-harness-restore.test.ts:449-510`

**Issue:** The driver's docblock states the discrimination it believes it makes: "a genuine no-op →
the sentinel SURVIVES; a second write → the sentinel is overwritten." Both branches are decided by
`originals.clear()`, not by `restored`. With the latch deleted, the second `restoreAll()` iterates
an empty map and the sentinel survives identically — so the test passes with and without the thing
it names in its title, and it proves nothing about the latch.

The property that *is* latch-specific is the one nobody asked about: whether the latch survives
into a subsequent plant. It does, and it is a defect (`CR-10`). A driver added specifically to
settle a doubt about this flag exercised the one sequence in which the flag is inert.

**Fix:** Add the discriminating sequence to the same driver — `plant → restoreAll() →
pendingRestoreCount() === 0 → plant again → pendingRestoreCount() === 1 → restoreAll() → assert the
second plant was reverted` — and restate the driver's docblock so it claims only what it measures.
Note the current claim would then need to say "both outcomes of the sentinel test are produced by
`originals.clear()`; the latch is measured by the re-plant case below."

### WR-28: the negative control's 200 ms hold races the parent's plant poll, and the poll loop cannot notice the child already exited

**File:** `src/mcp/vice/audit-harness-restore.test.ts:219, 243-250, 254-270, 280-300`

**Issue:** Two related ordering hazards in `runAttempt`, both live only on the `"none"` control,
where `holdMs = 200`.

1. The marker loop bails out on `!exited`. `'exit'` fires when the child terminates; the parent's
   `stdout` `'data'` handler may not have been called yet, because piped stdio is drained
   independently and `'close'` — not `'exit'` — is the event that guarantees the streams are done.
   So a fast control can produce "the driver exited (code 0) before emitting its planted marker"
   when the marker was in fact emitted.
2. The plant-poll loop at `:284-300` has no `exited` check at all. If the 200 ms hold elapses before
   the parent's first `readFileSync`, the harness's `exit` handler has already restored the file,
   `plantedBytes.includes(marker.replacement)` never becomes true, and the loop spins for the full
   `PLANT_POLL_DEADLINE_MS` (20 s) before failing with "The plant did not reach disk" — a diagnosis
   that is false and points a reader at `plant()`.

Not reproduced on this host: six concurrent runs of the file were 6/6 green at ~2.2 s each, and the
full `test:automated` suite (3017 tests, 50 s) was green. The exposure is a 2–4 core CI runner
executing ~120 test files under `node --test '*.test.*'`, where a 200 ms budget between a child's
`stdout.write` and the parent's first poll is not obviously safe.

**Fix:** Resolve the exit promise on `'close'`, not `'exit'`, and give the plant poll the same
liveness check the marker loop has:

```ts
const exitPromise = new Promise<void>((res) => child.on("close", (code, sig) => { … res(); }));
…
assert.ok(!exited, `${signal} attempt ${index}: the driver exited before the parent could observe ` +
  "the plant on disk — the hold is too short for this machine, not evidence about plant().");
```

and raise the control's hold to something with headroom (2000 ms), since the control is signalled
by *not* signalling and its cost is bounded by the hold only when the assertions all pass.

### WR-29: the narrowed porcelain assertion excludes `src/`, the tree a mis-contained plant would actually land in

**File:** `src/mcp/vice/audit-harness-restore.test.ts:174-187`

**Issue:** The narrowing itself is correct and well argued — a whole-repo byte comparison measures
the suite, not the subject. But the attributable set is `.planning/`, `scripts/`, and anything
containing `.harness-signal-scratch-`, justified as "the places a mis-contained harness run actually
writes are its own registry and evidence paths under `.planning/`, and `scripts/`". That misses the
harness's *primary* write: the plant. Of the 35 committed plant descriptors, 26 target
`src/mcp/vice/…`. A plant that escaped the scratch root would land in `src/`, and `src/` is not in
the filter — so the one class of escape this assertion is offered against is the one it cannot see.

**Fix:** Add the trees the harness plants into:

```ts
path.startsWith(".planning/") ||
path.startsWith("scripts/") ||
path.startsWith("src/") ||
path.startsWith("docs/") ||
path.includes(SCRATCH_PREFIX)
```

`src/` does carry concurrent-fixture churn from sibling test files, so if that proves noisy, filter
instead on the specific basenames the scratch driver writes (`plant-target.txt`,
`latch-target.txt`) plus the three prefixes — but do not leave the plant target's real home out of
the set.

### WR-30: `.gitignore`'s new entry justifies itself with an assertion the test stopped making in the same round

**File:** `.gitignore:57-66`

**Issue:** The entry says the ignore is "LOAD-BEARING rather than tidiness: that test asserts
`git status --porcelain` is byte-identical across an interrupted run, and an untracked scratch root
would appear in porcelain and make the assertion untestable." The entry landed in `b55ec3f`; commit
`e61ee28` ("scope the porcelain assertion to what this test can be responsible for") then replaced
that assertion with `attributablePorcelainDelta`, which explicitly *records* rather than asserts
byte-identity (`audit-harness-restore.test.ts:129-131, 169-173`). The stated reason is now false.

The entry is still load-bearing, for a different reason: `attributablePorcelainDelta` filters on
`path.includes(SCRATCH_PREFIX)`, and `porcelainAfter` is taken at `:332` while the scratch root
still exists on disk (`rmSync` is at `:341`), so an un-ignored scratch root would fail every attempt
as an attributable entry. That is the sentence the comment should carry. This is the second false
line-citation in the same file (`WR-15` is the first) and the second one written this round.

**Fix:** Replace the "asserts byte-identical" sentence with the real mechanism: "that test's
`attributablePorcelainDelta()` treats any porcelain entry naming this prefix as attributable, and
it reads porcelain while the scratch root still exists — so an un-ignored scratch root fails every
attempt." While there, fix `WR-15` by dropping `:654` from the entry above.

### WR-31: the population predicate keys on the literal `--root` while the docblock claims "HOWEVER IT READS IT"

**File:** `src/mcp/vice/audit-root-args.test.ts:628-681`

**Issue:** The correction to `CR-08` is right in direction and the cross-check against a shell glob
is a genuinely good piece of engineering. But the member test is `src.includes("--root")`, and the
function is documented as "Every top-level `scripts/*.mjs` that ACCEPTS a root, HOWEVER IT READS
IT." Those are different sets. A script accepting `--repo-root`, `--tree`, `--dir` or a positional
directory argument accepts a root and is invisible — `"--repo-root".includes("--root")` is `false`.
The docblock's promise is exactly the CR-08 shape (a completeness claim wider than the derivation),
one spelling narrower.

The exposure is real but small: nothing accepts a root under another spelling today, and the guard
over-selects rather than under-selects for the common cases (a script that only *mentions* `--root`
in prose becomes a member and fails loudly).

**Fix:** Either narrow the claim to what is measured — "every top-level `scripts/*.mjs` whose source
carries the literal token `--root`, however it reads it" — or widen the derivation to a regex over
directory-shaped flags, e.g. `/--(root|repo-root|tree|dir)\b/`, and say in the docblock which
spellings are in scope and that a new spelling must be added here.

### WR-32: `audit-gate`'s uncontained-by-design basis omits that it executes arbitrary code from the uncontained root

**File:** `scripts/audit-gate.mjs:66-77` (the recorded basis), `:1187-1188` and `:244-269` (the
path it omits); `src/mcp/vice/audit-root-args.test.ts:1376-1400` (where the omission is named)

**Issue:** The acceptance is recorded as: "this script performs no filesystem write … Containment
exists in `lib/audit-root.mjs` for a flag that decides which tree a script reads AND WRITES; the
trust boundary it guards is the write, and there is no write here." The direct-write half is true
and is now mechanically pinned by `E1`/`E2`. The conclusion does not follow, because `main()` does:

```js
const root = resolve(rootArg ?? join(HERE, ".."));   // uncontained, and cwd-relative
const viceDir = join(root, "src", "mcp", "vice");
…
runGuardsLive(viceDir, guardFiles);                  // spawnSync(process.execPath, ["--test", …files])
```

`docsGuardFiles(viceDir)` lists `docs-*.test.ts` from the operator-supplied tree and
`runGuardsLive` executes them with `node --test`. That is arbitrary code execution rooted at the
uncontained path, which subsumes any filesystem write the containment seam exists to bound. The
E2 assertion message names this hole precisely — "a write performed BY A SPAWNED PROCESS is outside
BOTH halves" — but that disclosure lives in a test's failure string, while the *header that records
the acceptance* states the no-write basis without it. A reader consulting the decision gets the
narrower fact and the broader conclusion.

The threat model is a local, operator-invoked CLI, so this is not an authorization boundary — but
it is an audit instrument's recorded basis being wider than its measurement, which is the class this
phase treats as a correctness defect.

**Fix:** Amend the header's basis to state both halves honestly, e.g. "performs no filesystem write
of its own (mechanically pinned by `E1`/`E2`), and DOES execute `node --test` over `docs-*.test.ts`
found under the resolved root — which is why the acceptance is scoped to an operator-supplied root
on a local CLI and would not survive this script being invoked with a root derived from any
untrusted input." Also reconcile `resolve(rootArg ?? …)` at `:1187` with the seam's repo-root base
(`WR-16`): today a relative `--root` means one thing for `audit-gate` and another for the other
seven.

### WR-33: `withoutComments()` strips from the first `//` on a line, so a write call sharing a line with a `//`-bearing literal evades E2

**File:** `src/mcp/vice/audit-root-args.test.ts:1295-1301`

**Issue:** The stripper is `line.replace(/\/\/.*$/, "")`, applied without any awareness of string,
template or regex literals. Anything after the first `//` on a line disappears, including code. So

```js
const doc = "see https://example.invalid"; writeFileSync(p, doc);
```

strips to `const doc = "see ` and E2 reports zero write calls. Stripping comments first is the right
call and its rationale (the header discusses writes in prose) is sound — but the mechanism can only
produce false *greens*, and E2 is the sole mechanical revocation of `T-32-22`. An instrument whose
only failure direction is "silently passes" is the shape this round is meant to be removing.

No live instance today: `audit-gate.mjs` has no such line.

**Fix:** Strip only lines whose *first non-whitespace* is `//` (which is what the block comment's
own rationale needs — the header and the prose are whole-line comments), and drop the
trailing-comment arm:

```ts
.map((line) => (line.trim().startsWith("//") ? "" : line))
```

then, if a trailing-comment case ever appears, handle it by moving the prose onto its own line
rather than by widening the stripper. Add a self-check asserting the stripper leaves at least one
known `FS_WRITE_APIS` token intact in a planted string, so a future widening cannot silently blind
the count.

### WR-34: a bad registry `plant.file` or `guard.cwd` is reported as a `--root` containment refusal

**File:** `scripts/audit-mutation-harness.mjs:280` and `:403`; message text at
`scripts/lib/audit-root.mjs:98-105`

**Issue:** Both call sites reuse `resolveContainedRoot()` to contain a *registry-supplied* path:

```js
const abs = resolveContainedRoot(join(root, descriptor.file), { repoRoot: root });   // :280
const cwd = resolveContainedRoot(join(root, relativeCwd), { repoRoot: root });        // :403
```

The containment check is correct and worth having. Its message is not, in this context: it is
hard-coded to begin `--root "<path>" resolves to … which is OUTSIDE the repository root`, so a
malformed `plant.file` or `guard.cwd` in the registry is reported to the operator as a problem with
the `--root` flag they may not even have passed. `resolveContainedRoot`'s own docblock promises "a
refusal is never confusable with a typo failure"; here it is confusable with a completely different
flag. In the plant case the misleading text is also copied verbatim into the evidence markdown via
`report.reason` (`:642-644`).

**Fix:** Give `resolveContainedRoot()` an optional `what` label used in place of the hard-coded
`--root`:

```js
export function resolveContainedRoot(rootArg, { repoRoot, allowExtra = [], what = "--root" } = {})
…
throw new Error(`${what} ${JSON.stringify(String(rootArg))} resolves to ${resolved}, which is …`);
```

and pass `what: \`plant.file for row ${row.historicalPath}\`` / `what: "guard.cwd"` at the two
harness call sites.

### WR-35: `guard.argv` is spawned against `process.execPath` with no allow-list, so registry text can be evaluated — contradicting the header's own rule

**File:** `scripts/audit-mutation-harness.mjs:126-128` (the rule), `:373-384` (`resolveBin`),
`:412-418` (the spawn)

**Issue:** The WHAT-NOT-TO-DO block states: "Never build a shell string. Every subprocess gets an
argv ARRAY, `shell: true` is never set, and no text read from the registry or from a scanned file is
ever evaluated, imported or shell-executed." The first two clauses hold. The third does not.
`resolveBin()` documents three conventions and then says it "branches on NOTHING else -- it spawns
exactly the argv the row carries", so `guard.argv` is handed to `node` unvalidated. `node` itself
interprets `-e` / `--eval`, `-p`, `--import`, `-r` / `--require`. A registry row with
`argv: ["-e", "<js>"]` is evaluated; a row with `argv: ["scripts/anything.mjs"]` under a
`--root`-supplied tree runs that tree's code. Both are within the spawn's reach today.

This is an operator-invoked instrument reading a committed registry, so no privilege boundary is
crossed. The finding is that a stated safety rule is false and there is nothing enforcing the three
conventions the docblock enumerates.

**Fix:** Enforce the enumerated conventions rather than documenting them, in `resolveBin()` or
beside the argv validation at `:394-401`:

```js
const a0 = descriptor.argv[0];
const ok =
  a0 === "--test" ||
  (a0 === "--run" && descriptor.argv.length === 2) ||
  (/^[\w./-]+\.(mjs|cjs|js|ts)$/.test(a0) && !a0.startsWith("-") && !a0.includes(".."));
if (!ok) throw new Error(
  `row ${row.historicalPath}: \`guard.argv[0]\` is ${JSON.stringify(a0)}, which is not one of the ` +
    "three documented conventions. A Node flag such as `-e`, `--import` or `-r` would make this " +
    "instrument evaluate registry text, which its own header forbids.",
);
```

and correct the header clause to "no text read from the registry is evaluated as source; `argv[0]`
is checked against the three conventions above before the spawn."

### WR-36: plan 32-15's three harness behaviour changes shipped with zero automated coverage

**File:** `scripts/audit-mutation-harness.mjs:332-348` (arithmetic), `:592-599` (D-05 skip),
`:636-647` (per-row plant refusal); no test file exercises any of them

**Issue:** Only two files in the tree import the harness, and both are the 32-19 signal/latch
drivers, which call `plant()`, `restoreAll()` and `pendingRestoreCount()` only. Nothing imports or
spawns `measureRow()`, `selectRows()` or `main()`. So:

- the post-condition arithmetic changed and nothing asserts it — which is why `CR-09` survived the
  change that was made to fix it;
- the `kept-unchanged` / `deleted` skip is a new branch with no test that it is driven by the
  *verdict* and not by a missing descriptor (the comment at `:586-591` states that as the
  load-bearing property);
- the "a refused plant is contained to its own row" behaviour, which is the whole point of plan
  32-15, is unobserved.

`plant()` is now exported and cheap to drive against a scratch tree, exactly as
`restore-latch-driver.mjs` does — so the coverage is available for the price of the fixture pattern
this round already established.

**Fix:** Add a `plant()` table test alongside `audit-harness-restore.test.ts`, driven through a
scratch root, covering: `find` occurring 0 / 1 / 2 times; a `replace` that overlaps the match
(the `CR-09` shape, currently refused and which must pass after the fix); a `replace` already
present elsewhere in the file (the `CR-06` shape, must pass); a non-`worktree` `kind`; and a
`plant.file` that escapes the root. Then extend it to `measureRow()`'s verdict skip and refusal
containment by exporting a `measureRow` seam or by spawning the CLI against a synthetic registry
inside a scratch root.

---

## Info

### IN-11: two `lines.push()` calls spell a fence with backslash-escaped backticks

**File:** `scripts/audit-mutation-harness.mjs:817, 819`
**Issue:** `lines.push("\`\`\`")` inside a double-quoted string. `\`` is not a recognised escape, so
JS yields a plain backtick and the output is correct — but every other fence in the same function
is `lines.push("```")` (`:745`, `:781`, `:834`, `:849`). The odd pair reads as an escaping bug on
first sight, in the one branch (`plantRefused`) that is new this round.
**Fix:** Make them `lines.push("```")` to match the other seven.

### IN-12: the six-file "CORRECTION" block is itself the duplication it condemns

**File:** `scripts/check-guard-fates.mjs:847-867`, `check-skill-cli-invocations.mjs`,
`check-skill-description-overlap.mjs:123-143`, `check-skill-fork-honesty.mjs`,
`check-skill-tool-coverage.mjs`, `generate-tool-support-table.mjs:360-383`
**Issue:** The block explains that "a justification written about one file was copied into six,
which is `IN-06` one layer up", and then says the containment reasoning is "recorded … once, there,
rather than restated in each of the six files this correction touches" — in a ~20-line paragraph
that is itself restated verbatim in all six. The next drift will therefore need six edits again.
**Fix:** Reduce five of the six to a one-line pointer at the sixth (or at `lib/audit-root.mjs`),
keeping the full account in a single place, and say which place.

### IN-13: a stale forward reference to a completed plan

**File:** `scripts/generate-tool-support-table.mjs:383`
**Issue:** `// Plan 32-11 migrates the remaining consumers.` sits directly under the correction that
records 32-16/32-17 finishing that work. There are no remaining consumers.
**Fix:** Delete the line, or replace it with "all eight consumers are on the seam as of plan 32-17".

### IN-14: the attempt-log test depends on top-level test ordering and doubles unrelated failures

**File:** `src/mcp/vice/audit-harness-restore.test.ts:512-536`
**Issue:** It asserts over a module-level `attempts` array populated by the three tests above it, so
it relies on `node:test`'s default sequential top-level execution and on all ten signalled attempts
completing. Running with `--test-name-pattern`, adding `concurrency`, or a single failed attempt
turns it into a second, confusing red on top of the real one.
**Fix:** Turn it into a `t.after()` on the last signal test, or gate it: `if (signalled.length === 0)
return;` with a comment naming the reason, so it reports only when it has something to report.

### IN-15: `parseRootArg` rejects a repeated value flag but accepts a repeated boolean flag silently

**File:** `scripts/lib/audit-root.mjs:280-284`
**Issue:** `if (booleanFlags.includes(token)) { flags[token] = true; continue; }` has no `seen`
check, so `--json --json` is accepted while `--row a --row b` is a hard error. The repeated-flag
rule's own justification ("no invocation's meaning depends on which copy the parser happened to
keep") applies equally to a boolean; the asymmetry is undocumented.
**Fix:** Either reject a repeated boolean with the same message shape, or state in the docblock that
booleans are idempotent by definition and a repeat is therefore harmless.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 3 — replaces blob `c9df889043110be9d7b573b31610fded359be9eb`_
