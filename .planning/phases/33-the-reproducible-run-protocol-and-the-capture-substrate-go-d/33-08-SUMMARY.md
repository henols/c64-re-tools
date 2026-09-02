---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 08
subsystem: testing
tags: [c64, skills, transient-allow-list, reproducibility-key, sha256, argv-digest, capture-record, node-test]

requires:
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "33-07's capture-predicate.ts — TRANSIENT_ALLOW_LIST_CAP, parseAllowList(), compareCaptures(), argvDigest()"
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "33-05's broker-launch.mts — STOCK_DETERMINISM_SEED, STOCK_DETERMINISM_FLAGS"
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "33-03's measured jitter sweep — 48 differing addresses for the reported pair, 66 at jitter 4000, i.e. an OBSERVED over-cap outcome"
  - phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
    provides: "33-04's vsf-slice.mjs — the cross-package module resolution ladder this plan's test reuses"
provides:
  - "src/skills/c64-ram-capture/scripts/derive-transients.mjs — the named, repeatable derivation: verbs `derive` and `check`, N>=3 pairwise union, cap that VOIDS"
  - "A committed artifact shape that round-trips through parseAllowList() with no translation step"
  - "The three-field reproducibility key (binary sha256, argv digest, seed) as Identity rows in the capture record, with the 76-byte counterexample quoted inline"
  - "A `capture route` Identity row, and a $D000-$DFFF volatility rule made conditional on it with both route halves retained"
  - "src/skills/c64-ram-capture/transients/ — the per-release artifact directory, refusing every image byte form before the first derivation exists"
affects: [33-09, 33-10, 33-11, 33-12, c64-ram-capture, capture-predicate, GATE-01]

actuals:
  tokens: 20900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Skill-side second implementation of a STABLE, TINY rule (set membership) with agreement to the authoritative module asserted by test — the d64-parse.mjs answer, chosen over vsf-slice.mjs's spawn-a-CLI answer because capture-predicate.ts has no CLI entry point"
    - "A narrowing-only knob: `--cap` refuses any value above the committed cap, so the flag cannot launder an overflow into a pass"
    - "Cap boundary tested as a PAIR with the artifact's ABSENCE asserted at N+1, not merely the exit code"
    - "A route-conditional documentation rule: the record names which transcription route produced it, and the volatility rule is read off that row"

key-files:
  created:
    - src/skills/c64-ram-capture/scripts/derive-transients.mjs
    - src/skills/c64-ram-capture/scripts/derive-transients.test.mjs
    - src/skills/c64-ram-capture/transients/README.md
    - src/skills/c64-ram-capture/transients/.gitignore
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/deferred-items.md
  modified:
    - src/skills/c64-ram-capture/templates/capture-record.template.md
    - src/skills/c64-ram-capture/SKILL.md

key-decisions:
  - "The deliverable is the derivation METHOD, never an address set — re-deriving over an existing artifact is refused without an explicit --force, with the no-inheritance rule in the refusal text"
  - "Over the cap of 64 the derivation VOIDS: non-zero exit, NO artifact written, message states the stop is not frame-exact, and the word 'warning' appears nowhere in the script"
  - "TRANSIENT_COUNT is printed on BOTH the success and the void path, because on the void path the count IS the finding a measuring plan has to transcribe"
  - "`check` carries its own comparison rather than delegating: capture-predicate.ts has no CLI entry point and a static cross-package import fails the pack check, so agreement is asserted by test against the imported compareCaptures() instead"
  - "`--cap` narrows only — a value above 64 is refused by name (a hardening beyond the plan's letter, closing the one route by which the flag could have raised the cap)"
  - "The $D000-$DFFF note is conditional on a new `capture route` row, with BOTH halves retained — the memory-read half still governs records already taken on that route"

patterns-established:
  - "Refuse-by-name over ignore: range-shaped keys, duplicate basenames, wrong-length images and over-committed caps each name the offending value"
  - "The .gitignore for an artifact directory ships BEFORE the first artifact does, and the shipped README says so — a directory that starts refusing images afterwards has already had one commit's worth of opportunity to leak"

requirements-completed: [REPRO-04, CAP-02]

coverage:
  - id: D1
    description: "derive-transients.mjs `derive`: N>=3 pairwise union, one enumerated entry per address carrying its pair attributions and the distinct values seen, written as the shape parseAllowList already accepts"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#derive: three images differing at a known set produce exactly that set, ascending, with pair attributions"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#a derived artifact round-trips through parseAllowList unmodified"
        status: pass
      - kind: integration
        ref: "node src/skills/c64-ram-capture/scripts/derive-transients.mjs derive --release probe --out probe.json a.bin b.bin c.bin | grep -Eq '^TRANSIENT_COUNT: [0-9]+$' (plan verify → DERIVE_CLI_OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cap of 64 VOIDS rather than warns: 64 addresses writes the artifact and exits 0; 65 exits non-zero, prints VOID, states the stop is not frame-exact, and leaves NO file at --out"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#derive: exactly 64 addresses writes the artifact and exits 0"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#derive: 65 addresses VOIDS the derivation -- non-zero, no file at --out, and the reason is the stop"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#derive: --cap above the committed cap is refused -- the flag only ever narrows"
        status: pass
    human_judgment: false
  - id: D3
    description: "No address set is inherited between releases: re-deriving over an existing artifact is refused without --force, with the no-inheritance reason in the message, and the artifact is left untouched"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#derive: re-deriving over an existing artifact is refused, stating the list is re-derived per release"
        status: pass
    human_judgment: false
  - id: D4
    description: "`check` re-checks one pair against a committed derivation and agrees with the MCP-side compareCaptures(), including on a ONE-BIT plant outside the allow-list"
    requirement: "CAP-02"
    verification:
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#check: the verdict agrees with compareCaptures on a synthetic pair, both ways"
        status: pass
      - kind: unit
        ref: "src/skills/c64-ram-capture/scripts/derive-transients.test.mjs#the script's default cap is the MCP-side TRANSIENT_ALLOW_LIST_CAP, not a second copy of 64"
        status: pass
    human_judgment: false
  - id: D5
    description: "The capture record's Identity table carries binary sha256 / argv digest / seed / capture route, the 76-byte counterexample is quoted inline, and two new checklist boxes fail a record with any key field blank"
    requirement: "REPRO-04"
    verification:
      - kind: integration
        ref: "plan verify: grep for 'binary sha256' 'argv digest' 'capture route' '76-byte' 'argvDigest' 'STOCK_DETERMINISM_SEED' in capture-record.template.md → TEMPLATE_KEY_OK"
        status: pass
    human_judgment: false
  - id: D6
    description: "The $D000-$DFFF volatility note is re-grounded as a two-row route table conditional on the `capture route` row, with the memory-read half retained"
    verification:
      - kind: manual_procedural
        ref: "src/skills/c64-ram-capture/templates/capture-record.template.md § `$D000-$DFFF`: the rule depends on the `capture route` row"
        status: pass
    human_judgment: true
    rationale: "Whether the two halves are stated correctly and neither is silently privileged is a reading judgment, not a grep. The grep only proves the word `snapshot` is present; a reader has to confirm the memory-read half was retained rather than replaced."
  - id: D7
    description: "The per-release artifact directory refuses every image byte form by .gitignore before the first derivation exists, does not refuse JSON, and its README carries the method, the artifact shape, the cap's reasoning and four measured reference points"
    requirement: "CAP-02"
    verification:
      - kind: integration
        ref: "plan verify: seven image patterns present in transients/.gitignore, no *.json pattern, README carries 64 / 1242 / 300 → TRANSIENTS_DIR_OK"
        status: pass
      - kind: integration
        ref: "cd installer && npm pack --dry-run --json — ships transients/README.md and derive-transients.mjs, ships no *.test.mjs"
        status: pass
    human_judgment: false
  - id: D8
    description: "SKILL.md documents both verbs, the void-on-overflow behaviour, and the snapshot-route volatility difference, with both skill guards green"
    verification:
      - kind: integration
        ref: "node scripts/check-skill-tool-coverage.mjs && node scripts/check-skill-cli-invocations.mjs (both exit 0)"
        status: pass
      - kind: integration
        ref: "node --test src/mcp/vice/anno-verb-coverage.test.ts#the shipped skill tree's markdown is byte-identical to the source tree's"
        status: pass
    human_judgment: false

duration: 40 min
completed: 2026-09-02
status: complete
---

# Phase 33 Plan 08: The Allow-List Derivation Method and the Three-Field Reproducibility Key Summary

**The transient allow-list is now a named, repeatable derivation — pairwise union over N≥3 runs, one enumerated entry per address, and a cap of 64 that VOIDS with no artifact left behind — and every capture record carries `(binary sha256, argv digest, seed)` as one key with the measured 76-byte counterexample quoted inline.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-02T20:52Z
- **Completed:** 2026-09-02T21:31Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- **The method is the deliverable, and the address set never is.** `derive-transients.mjs derive` takes N≥3 captures of one release at one stop and writes the union of addresses differing across *every* pairwise comparison — N(N−1)/2 pairs, not adjacent ones — with each entry recording the address, which pairings it differed in (by basename), the distinct bytes seen, and an empty attribution line. Re-deriving over an existing artifact is **refused** without `--force`, with the no-inheritance rule in the refusal text, because an inherited list cannot be distinguished afterwards from an honestly derived one.
- **Over the cap the derivation voids, and the void leaves nothing behind.** 64 addresses writes and exits 0; 65 exits non-zero, prints `VOID`, states that **the stop is not frame-exact**, and writes no file at all. The test asserts the file's *absence*, not merely the exit code — a partial or truncated artifact would be exactly the silent widening the void exists to prevent. The word "warning" appears nowhere in the script. `--cap` was additionally made **narrowing-only**: a value above 64 is refused by name, closing the one route by which the flag could have raised the committed cap.
- **The derived artifact needs no translation step.** It parses through the MCP-side `parseAllowList()` straight off disk, asserted by a round-trip test that imports `capture-predicate.ts` over the same three-rung resolution ladder `vsf-slice.mjs` uses (`$VICE_MCP_DIR` → in-repo path → `@henols/vice-mcp`), skipping with a **named** reason listing every path tried if the MCP tree is absent.
- **`check` agrees with the authoritative predicate on a one-bit plant.** The agreement case flips a single bit at `$4000`, outside the allow-list, and asserts both implementations return `not-equivalent` — the plant a bit-count tolerance would pass, which is what makes the absence of that tolerance proven rather than merely documented.
- **The reproducibility key is three rows, and the counterexample is inline.** The Identity table gains `binary sha256` (identifies the release by its bytes, not its filename), `argv digest` (naming `argvDigest()` and stating the digest is order-sensitive by construction and refuses an empty array), `seed` (citing `STOCK_DETERMINISM_SEED`, not a loose 4242), and `capture route`. A block below states the key is the **triple**, quotes the measurement — the same seed with a reordered argv yielded a **76-byte-different image** — and rules that captures whose argv digests differ are different keys and must not be compared as a pair. Two new checklist boxes fail a record with any key field or the route row blank.
- **The `$D000-$DFFF` note is re-grounded, not copied.** It is now a two-row table read off the `capture route` row: volatile on the `memory-read` route because `vice_memory_read` samples live I/O; **not** volatile on the `snapshot` route, whose `C64MEM` array is `mem_ram[]` — RAM under I/O, not the register read view. Both halves are retained, because records already taken on the memory-read route still need the first.
- **The artifact directory refuses image bytes before the first artifact exists.** `transients/.gitignore` refuses flat captures, disk/tape images, cartridges, `.vsf` snapshots and archives, and deliberately does not refuse JSON. Its README carries the verbatim method, the artifact shape, the cap's reasoning, and **four** measured reference points rather than three.

## Task Commits

1. **Task 1: Three synthetic images in, one committed allow-list artifact out — and 65 addresses void it** — `f318ece` (feat)
2. **Task 2: The three-row reproducibility key in the capture record, and the re-grounded volatility note** — `4b9adc7` (feat)

**Plan metadata:** the branch-tip `docs(33-08): …` commit (this SUMMARY, `deferred-items.md`, `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `WINDOWS.md`).

## Files Created/Modified

- `src/skills/c64-ram-capture/scripts/derive-transients.mjs` (new, 541 lines) — verbs `derive` and `check`; flags `--release`, `--out`, `--cap`, `--force`, `--allow-list`, `--limit`; outcome lines `TRANSIENT_COUNT:` and `CHECK_VERDICT:`. Pure arithmetic: no network, no process spawn, no path-translation seam.
- `src/skills/c64-ram-capture/scripts/derive-transients.test.mjs` (new, 499 lines) — 19 tests, `fail 0`. The cap boundary as a pair with the file's absence asserted, the round-trip, the `check`/`compareCaptures` agreement on a one-bit plant, and a structural assertion that the script references no spawn or network API.
- `src/skills/c64-ram-capture/transients/README.md` (new) — the committed method, the artifact shape, the cap's reasoning with four measured reference points, and the consumer note that npm strips the sibling `.gitignore` from the tarball.
- `src/skills/c64-ram-capture/transients/.gitignore` (new) — seventeen image/archive patterns, no JSON pattern, with the timing argument in its header.
- `src/skills/c64-ram-capture/templates/capture-record.template.md` — four new Identity rows, the triple block with the inline counterexample, two new checklist boxes, and the route-conditional volatility table.
- `src/skills/c64-ram-capture/SKILL.md` — a new `## Derive a per-release transient allow-list` section, the `$T` script alias and two invocations in the quick block, the reproducibility-key cross-reference in the capture procedure, and two new References rows.
- `.planning/phases/33-…/deferred-items.md` (new) — the one out-of-scope discovery, traced to its introducing commit.

## Decisions Made

1. **`check` carries its own comparison rather than delegating to the MCP-side predicate.** `vsf-slice.mjs`'s route — spawn `process.execPath` on an in-tree CLI entry point — is unavailable, because `capture-predicate.ts` is a pure library with no CLI entry point, and a static cross-package import resolves on neither npm-installer route and would fail `check-npm-packages.mjs`'s transitive closure walk. So this took the `d64-parse.mjs` answer instead: a second implementation of a rule that is **stable and tiny** (set membership over differing addresses, no ranges, no tolerances, no version-sensitive layout). The agreement is not left to trust — the test imports `compareCaptures()` and asserts it. Recorded in the script's header as a choice, not an oversight.
2. **`TRANSIENT_COUNT` prints on the void path too.** On an over-cap derivation the count *is* the finding, and `33-10` has to transcribe it into an evidence file rather than paraphrase it. The void path still exits non-zero and still writes nothing.
3. **`--cap` narrows only.** The plan required the default to match `TRANSIENT_ALLOW_LIST_CAP`; refusing any larger value by name is what actually enforces that, and it means no derived artifact can exceed what `parseAllowList()` accepts.
4. **Four reference points in the README, not three.** The plan named 0 / 1242 / 300. `33-03`'s clean sweep measured **66 at jitter 4000** on a frame-anchored autostarted stop, which is the row that makes over-cap an *observed* outcome rather than a hypothetical — and it is the row `33-10` will be closest to. Adding it strengthens the plan's own reasoning rather than substituting for it.
5. **Duplicate image basenames are refused.** Pair attributions are written by basename, so a collision makes an entry's provenance unreadable, and passing the same path twice would add a pairing that differs nowhere and inflate the pair count with a comparison of an image against itself.
6. **A real flag parser, not the sibling's filter idiom.** `compare.mjs`'s `argv.filter(s => !s.startsWith("--"))` treats a flag's *value* as a positional; with value-taking flags in the signature that would have derived from four images, one of which is a JSON path. Unknown flags are refused by name, listing what the verb accepts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical control] `--cap` could have raised the committed cap**

- **Found during:** Task 1
- **Issue:** The plan specified `--cap` defaulting to 64 and "must match `TRANSIENT_ALLOW_LIST_CAP`", but a flag that accepts any integer lets an operator write `--cap 128` and turn a void into a pass — the exact laundering `D-22` forbids, reachable from the command line.
- **Fix:** `capFrom()` refuses any value above `TRANSIENT_ALLOW_LIST_CAP` by name, stating that the cap is a pre-commitment and that `--cap` only ever narrows.
- **Files modified:** `src/skills/c64-ram-capture/scripts/derive-transients.mjs`
- **Verification:** `derive: --cap above the committed cap is refused -- the flag only ever narrows` (asserts non-zero exit, both message fragments, and no artifact)
- **Committed in:** `f318ece`

**2. [Rule 1 — Stale documentation] SKILL.md said "All three modules" of five**

- **Found during:** Task 2
- **Issue:** The line following the quick-command block read "All three modules read only committed files…" while the block already listed four scripts, and this plan added a fifth.
- **Fix:** Rewritten as "Every module above reads only committed files…", which stays correct as the block grows.
- **Files modified:** `src/skills/c64-ram-capture/SKILL.md`
- **Verification:** Both skill guards green; the shipped-tree drift test green.
- **Committed in:** `4b9adc7`

**3. [Rule 2 — Missing critical disclosure] The shipped `transients/` directory has no `.gitignore`**

- **Found during:** Task 2 (packaging verification)
- **Issue:** `npm pack` excludes a nested `.gitignore` from the tarball, so a consumer installing the skill gets `transients/README.md` and nothing else. The refusal that this plan deliberately committed *before* the first capture does not travel with the skill — and silence about that would leave a consumer believing it did.
- **Fix:** A closing paragraph in `transients/README.md` (which does ship) states that the `.gitignore` did not come with the install and tells the reader to add the same refusals before the first capture.
- **Files modified:** `src/skills/c64-ram-capture/transients/README.md`
- **Verification:** `npm pack --dry-run --json` in `installer/` confirms `transients/README.md` ships and `.gitignore` does not.
- **Committed in:** `4b9adc7`

---

**Total deviations:** 3 auto-fixed (2 × Rule 2 missing-critical, 1 × Rule 1 bug/stale-doc)
**Impact on plan:** None negative. Two of the three close routes by which a committed control could have been bypassed or believed present when absent; the third is a one-line accuracy fix in a file the plan already edits. No scope creep — every change lands in a file the plan declared.

## Deferred Issues

**Out of scope, logged and not fixed** — see `deferred-items.md` D1 in this phase directory, and the `.planning/WINDOWS.md` ledger entry.

`node scripts/check-npm-packages.mjs` exits **1** with one finding:

```
vice-mcp: broker-launch.mts is imported by vice-broker-client.ts but is not in
the published tarball -- Rule 2
```

Traced to commit `11f897d` (*feat(33-06): thread the launch profile…*), which added
`import type { LaunchProfile } from "./broker-launch.mts"` at
`vice-broker-client.ts:39`. Not this plan's territory: `src/mcp/vice/package.json`
is not among its declared files, and the repair is a design choice (publish the
`.mts` alongside the two siblings already in `files[]`, or teach the checker that a
type-only import is erased by Node's type-stripping) rather than a typo.

**No runtime impact** — `import type` is erased, so the published package works.
What is broken is the gate, which is red for every later plan in this phase.

**This plan's own contribution to that tarball was verified directly instead:**
`npm pack --dry-run --json` in `installer/` ships
`skills/c64-ram-capture/scripts/derive-transients.mjs` and
`skills/c64-ram-capture/transients/README.md`, and ships **no** `*.test.mjs` file.
Nothing this plan added leaks.

## Issues Encountered

**The shipped-skill-tree drift test raced a same-run sync.** `anno-verb-coverage.test.ts`'s
byte-identical assertion went red on `transients/README.md` on the first suite run, then
green on re-run with no source change — `installer/skills/` is regenerated by
`sync-skills.mjs`, which other in-run tooling invokes, so the drift assertion can observe
a tree mid-sync. Resolved by running `node installer/scripts/sync-skills.mjs` explicitly
after the last source edit and re-running: the test file passes 10/10 standalone and in
the full suite. `installer/skills/` is gitignored, so nothing was committed for it. The
race is pre-existing behaviour and is **not** logged as a defect of this plan, but it is
worth knowing: after editing a skill file, sync before trusting a suite result.

## Verification

| Check | Result |
|---|---|
| `node --check derive-transients.mjs` | pass |
| `node --test derive-transients.test.mjs` | **tests 19 / pass 19 / fail 0** |
| `node --test 'src/skills/c64-ram-capture/scripts/*.test.mjs'` | **tests 83 / pass 76 / fail 0 / skipped 7** (skips are pre-existing corpus-absent cases in sibling files) |
| Plan verify — `DERIVE_CLI_OK` | pass |
| Plan verify — `TEMPLATE_KEY_OK` | pass |
| Plan verify — `TRANSIENTS_DIR_OK` | pass |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 |
| `node scripts/check-skill-cli-invocations.mjs` | exit 0 |
| `npm run typecheck` (`src/mcp/vice`) | exit 0 |
| `npm run test:automated` (broker + `x64sc` confirmed stopped via `pgrep -x x64sc`) | **tests 3088 / pass 3080 / fail 2** — exactly the disclosed baseline, both in `anno-register.test.ts` (`:385`, `:479`). No regression. |
| `scripts/check-npm-packages.mjs` | exit 1 — one **pre-existing** finding from 33-06 (see Deferred Issues); this plan's own tarball contribution verified clean |
| Frozen files (`evidence/DECISION-RULE.md`, `SCHEMA.md`, `README.md`) | `git diff f3f9eb5..HEAD -- evidence/` empty — unmodified |
| Deletions in this plan's commits | `git diff --diff-filter=D` empty — none |

## Known Stubs

None. Every artifact this plan ships is complete and exercised: the derivation and both its
verbs are covered by 19 passing tests, the template's new rows are populated with real
values and real "How obtained" routes, and the `transients/` directory ships with its method
documented. The `attribution` field in a derived entry is deliberately an **empty string
awaiting a human**, which is data rather than a stub — the field's presence is what makes an
unattributed transient visibly unattributed instead of absent.

## Next Phase Readiness

**Ready for `33-09` and `33-10`.**

`33-10` is the plan this one exists to serve, and two things it must carry:

1. **The derivation may VOID, and that is a legitimate recorded outcome.** `33-03` measured
   66 differing addresses at jitter 4000 on a frame-anchored autostarted stop — 2 over the
   cap — and 300 on a wall-clock autostarted stop on a real release. `derive` prints
   `TRANSIENT_COUNT: <n>` at column 0 on both paths, so the count is transcribable either
   way. **Do not retry until the list fits, and do not raise the cap** — record the jitter
   each run was taken at and let the void stand if it stands.
2. **The artifact needs no translation.** Write it with `--out` under
   `src/skills/c64-ram-capture/transients/<release>.json` and it parses through
   `parseAllowList()` as-is.

**No blockers introduced.** One inherited blocker to be aware of: the packaging gate is red
from 33-06 (Deferred Issues above), so a later plan cannot use `check-npm-packages.mjs` as a
clean signal until that is cleared.

---
*Phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d*
*Completed: 2026-09-02*

## Self-Check: PASSED

All 8 declared files exist on disk. Both task commits resolve in
`git log --all` (`f318ece`, `4b9adc7`), and this SUMMARY is carried by the plan
metadata commit at the branch tip. `transients/.gitignore` and
`transients/README.md` are both tracked (the directory's own ignore rules do
not shadow them). Working tree carries no uncommitted change from this plan.
