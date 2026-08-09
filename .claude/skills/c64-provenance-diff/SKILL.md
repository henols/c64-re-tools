---
name: c64-provenance-diff
description: Decide whether a byte in a cracked C64 release is original game code or something a cracker changed, by diffing two or more independently-cracked releases at an anchor-proven offset. Use when asked to diff two releases or disk images, work out which bytes the cracker patched, tell loader or cracktro code from game code, prove a byte is original, establish provenance or confidence for a memory range, regenerate the provenance ledger, or run anchor-search, count-patches or diff-images. Also use when asked whether a crack added a trainer or cheat, whether a patch changes gameplay rather than loading, whether a rebuild would inherit a cracker's gameplay alteration, or whether two releases are genuinely independent rather than sharing an ancestor.
---

# Deciding what a cracker changed

**A byte that differs between two releases is not a cracker patch.** It is a byte
that differs. This pipeline exists because the gap between those two statements is
where confident nonsense gets manufactured — `scripts/diff-images.mjs`'s own header
calls it "the step most able to produce confident nonsense". Every stage below
either proves its own precondition or refuses to emit.

**Run the four verbs in order.** `diff` is meaningless without a proven offset, and
`ledger` will not write a verdict the earlier stages did not earn.

```bash
D=.claude/skills/c64-provenance-diff/scripts/diff-images.mjs   # from the repo root

node $D anchor-search                        # 1. prove the per-release offset  [WRITES]
node $D diff                                 # 2. N-way byte diff at that offset
node $D count-patches                        # 3. CRACKER-PATCH addresses in game code
node $D ledger                                # 4. regenerate recovery/PROVENANCE.md [WRITES]

node $D diff --json                          # machine-readable, with per-range reasons
node $D diff --gap-tolerance 16              # coalescing width (default shown)
node $D anchor-search --reference <id>       # pick the reference release
node .claude/skills/c64-provenance-diff/scripts/releases.mjs list                 # the release ids in play
```

Pure Node over committed files — the `.bin` dumps, their `.map.json` manifests, and
`recovery/RELEASES.json`. It contacts nothing.

## The order

| # | Verb | Proves | Refuses to |
|---|---|---|---|
| 1 | `anchor-search` | A single global offset per release, from long distinctive byte runs located with `Buffer.indexOf` | Accept a **majority** vote — every usable anchor must agree, or there is no offset |
| 2 | `diff` | Which ranges differ, coalesced on verdict continuity | Diff at an assumed offset |
| 3 | `count-patches` | How many addresses are `CRACKER-PATCH` **and** `game`-kind | Count a patch outside game code |
| 4 | `ledger` | The generated tier of `recovery/PROVENANCE.md` | Emit rather than launder an assumption |

## Two verbs write to tracked files

`anchor-search` updates `recovery/RELEASES.json`; `ledger` rewrites
`recovery/PROVENANCE.md` and touches `RELEASES.json` too. So `git status` is
**expected** to be dirty after a run.

What matters is *what* changed. A clean re-run produces a **timestamp-only** diff —
`proven_at` and `generated_at`. Anything else is a real change:

```bash
git diff -- recovery/RELEASES.json recovery/PROVENANCE.md
```

If the only `-`/`+` pairs are those two fields, revert the churn and move on. If
`offset`, `anchor_count`, `anchors_agreeing` or `generated_tier_sha256` moved, stop
and find out why before committing — that is the pipeline telling you the evidence
changed.

## Worked example — the real corpus

Two independently-cracked releases of one title, both captured at the same
post-loader entry trigger. **The release ids below are shown as `release-a` and
`release-b`; every number is real output from a live run against a two-release
corpus, with only the ids renamed** — the tool has no opinion about what a
release is called.

```
$ node $D anchor-search
release-a -> release-b: ok=true offset=0 (all 7 usable anchor(s) agree on offset 0)

$ node $D diff
diff: 204 range(s), gap_tolerance=16, coalesced=260

$ node $D count-patches
release-a: 0
release-b: 0
```

**204 differing ranges and zero cracker patches.** The verdict tally from
`diff --json` is `{"UNKNOWN": 102, "ORIGINAL": 102}` — nothing reached
`CRACKER-PATCH` at all. That is the pipeline working, not failing.

Read it as: 102 ranges are identical across two independently-cracked releases, so
they are `ORIGINAL` with real evidence behind the word. The other 102 differ, match
no cracker signature, and are therefore `UNKNOWN` — and each carries a `reason`
naming the alternatives it ruled out:

> differs across 2 release(s) (release-a, release-b) with no recognised cracker
> signature … not a revision difference … not a `.d64` read error … not a packer
> artifact … not relocation (the anchor-proven offset for this pair is recorded
> above and used here).

`UNKNOWN` with a rule-out list is the honest answer. Do not upgrade it to
`CRACKER-PATCH` because a byte differs. **Confidence: HIGH** — run live against the
committed corpus; `ledger` reproduced the committed
`generated_tier_sha256 dc7eb080…` byte-identically, so the classification is
deterministic.

**One qualifier on the 102, and it is the example's premise rather than its output:**
"independently-cracked" is asserted at the top of this example, not proven by it. The
determinism is HIGH; the `ORIGINAL` verdicts inherit whatever confidence that
independence claim carries. See § *The independence precondition* below before
quoting an `ORIGINAL` count as settled.

## The five kinds and the three verdicts

`bucketManifest` promotes a manifest from `ranges-only` to `bucketed`, assigning
`game` / `loader` / `cracktro` / `io` / `unused`. Verdicts are `ORIGINAL`,
`CRACKER-PATCH`, `UNKNOWN`, carrying `HIGH` or `MEDIUM-HIGH` confidence.

The two seeds are where this goes wrong, and both failure modes are on record:

- **`loader` is seeded from `RELEASES.json`'s earned `loader_ranges`** — live
  disassembly evidence — **never from `NOTES.md` prose.** Reading a loader range
  out of prose is the documented root cause of `$08F5`, a permanent joystick-poll
  instruction, once being classified as loader code.
- **`cracktro` is seeded from a crack-credit *vocabulary* scan**, not a bare
  printable-ASCII scan. A bare scan was tried and produced a real false positive
  against a real corpus: **the game's own title-screen text** is printable ASCII
  too, and it differed between the two releases. A bare scan called that cracker
  credit. It is not — a differing string is not a cracker string, and it is
  correctly left `UNKNOWN`.

`io` (`$D000-$DFFF`) and `unused` (contiguous `$00`/`$FF` power-on runs) are
assigned at capture time and kept verbatim. Everything the trace reaches is `game`.

Per D-05 the `.bin` files are **never** edited or zeroed. Classification lives in
the manifests; the bytes stay verbatim evidence.

## A `CRACKER-PATCH` in `game` code is a trainer until proven otherwise

`count-patches` counts exactly one intersection — verdict `CRACKER-PATCH`, kind
`game`. That intersection has a name the pipeline never says out loud: a **trainer**.
A cracker changing bytes *inside game code* is altering gameplay, and unlimited
lives, disabled collision or a frozen timer is the usual reason.

This matters because the three verdicts answer **who wrote a range**, not **what it
does**. A relocated loader stub and a life-decrement patched to a `NOP` both come
back `CRACKER-PATCH`. So give every patch a **function verdict** alongside its origin
verdict:

| Function | Means | Why it matters |
|---|---|---|
| `loader` | raw-sector loading, decrunch, relocation, drive code | an obstacle to get past, not a subject |
| `cracktro` | intro, scroller, music, the crack's own presentation | not the object of study |
| `gameplay` | reads or writes game state — **a trainer** | any rebuild copying these bytes inherits it |
| `unknown` | not yet attributed | scrutinise before trusting |

**A rebuild reconstructed from these bytes inherits a `gameplay` patch silently**, and
behaviour-only verification will not catch it: the baselines come from the same
cracked image, so the rebuild and its reference agree *while both differ from the
game as it shipped*.

### The independence precondition — this skill's own premise

`ORIGINAL` means "identical across two **independently**-cracked releases". Delete the
word *independently* and the verdict is worthless: two releases sharing an ancestor
are identical everywhere the ancestor was, **including everywhere the ancestor's
cracker patched**. Establish the independence. Do not infer it from two releases
carrying different group names, different loaders, or different cracktros — those are
the cheapest things for a re-cracker to replace.

Until it is established, the diff is directional, and the direction is the trap:

- A diff **hit** is informative — something was patched.
- A diff **miss** is not, and it is the miss that reads as reassurance.

So `count-patches` reporting `0` is not evidence that no trainer exists. It is
evidence that no trainer exists **in one release and not the other**. With unproven
ancestry those are different claims, and only the second one was tested.

### The detector that does not depend on the diff

A signature hunt over the canonical image, read against the coverage map rather than
against another release. None of it needs a second release at all, which is precisely
why it survives the shared-ancestor case:

1. **Writes to a consequence counter from an unexpected site.** Once the memory map
   names what the game decrements on failure — lives, timer, health — every writer
   that is not the game's own is a candidate. Search **every addressing form that can
   reach the address**, indexed included. An absolute-mode-only search is the standard
   way this hunt returns a false negative.
2. **Armed but never reached.** Code jumped to from a patched region that never
   executes across full gameplay coverage is either dead crack scaffolding or a
   trainer waiting on a trigger. Both need a verdict; neither should be reproduced
   without one.
3. **Trigger scanners.** Reads of the keyboard or joystick registers in code that is
   not the game's own input handler, and comparisons against key codes inside a range
   already marked `CRACKER-PATCH`.
4. **`NOP` sleds and inverted branches.** The cheapest trainer is a patched-out check
   — `EA EA EA` where a `JSR` or a decrement was, or a `BEQ`↔`BNE` flip on a collision
   or life test. These show as a few bytes inside otherwise-original code: the pattern
   most easily dismissed as noise, and the one that matters most.

**A negative is a result, and must state its own limits.** "No trainer found, by these
four signatures, at this coverage level" is an answer. "The diff was clean" is not.

## Before you trust a verdict

- **Coverage is incomplete, and the ledger says so out loud.**
  a load-coverage record is not a finished coverage claim until every game state
  has actually been visited. An on-demand-loaded
  region — bytes that only appear after reaching a room or state nobody visited —
  is by construction **absent from the primary dumps this diffs**. Every verdict is
  scoped to "the addresses visible at the post-loader game-entry point", not to the
  whole running game. This is exactly why the ledger is regenerable: a more
  complete `LOADING.md` reopens it.
- **Never resolve a range's `kind` from its `start` address.** Coalescing groups on
  *verdict* continuity, not *kind* continuity, so one range can span several kind
  zones. `splitRangeByManifestKind` exists for this, and the bug was found live:
  a wide `ORIGINAL` range was found running straight through a `loader` sub-range
  nested inside it. Resolving from `start` silently mislabels every address after
  the first boundary.
- **`--gap-tolerance` is off-by-one sensitive by design.** A gap of identical bytes
  *strictly shorter* than N coalesces; a run of *exactly* N stays its own row.
- **More agreeing independent releases is the only thing that raises confidence.**
  Two releases can establish `ORIGINAL`; they cannot establish intent. And *agreeing*
  only counts once *independent* is proven — releases sharing an ancestor agree on
  the ancestor's patches too, so unproven ancestry makes every `ORIGINAL` verdict
  conditional rather than earned.

## Which skill does what

This one answers "is this byte original?". It does not capture images or read
addresses.

| Need | Go to |
|---|---|
| A verified 64K image, or proving two captures equivalent | `c64-ram-capture` |
| Which address to read next, and what the answer rules out | `c64-program-recon` |
| What a specific address or bit means | `c64-memory-mapping` — `node … lookup '$D018'` |
| Assembling, or a first-pass dead listing | `acme-build` |
| **Whether a byte is original, cracker-changed, or unknown** | here |

Findings that make RE faster go in `.planning/RE-FINDINGS.md` **at the moment you
find them**, graded with `Evidence:` and `Confidence:`. Promote by re-logging with
the new evidence, never by editing a grade in place. File-changing work enters
through a GSD command (`/gsd-quick`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `anchor-search` reports `ok=false` | Anchors disagreed, so there is no single offset. Do **not** pick the majority — the images are not the same fully-loaded state, or one capture is bad. Re-capture rather than force it. |
| `git status` dirty after a run | Expected — two verbs write. Diff the two files; if only `proven_at`/`generated_at` moved, `git checkout --` them. |
| `generated_tier_sha256` changed | The classification changed, not just a timestamp. Find the cause before committing; the digest is the determinism check. |
| `count-patches` reports 0 | Usually correct. It counts `CRACKER-PATCH` **and** `game`-kind addresses; with two releases and no signature match, nothing qualifies. Check the `diff --json` tally before treating it as a bug. But do not read it as "no trainer" — see the next two rows. |
| Asked whether the crack added a trainer | `count-patches` is the diff-side answer: `CRACKER-PATCH` ∧ `game` **is** the trainer count. It is necessary and not sufficient — it cannot see a trainer both releases carry. Run the signature hunt too. |
| Asked to confirm a release has no trainer | You cannot confirm that from a diff alone, and saying so is the answer. A clean diff only rules out a trainer in *one* release and not the other; with unproven ancestry that is a weaker claim than it sounds. Report the signature-hunt result with its coverage limits. |
| Two releases agree everywhere suspicious | Suspect shared ancestry before concluding `ORIGINAL`. Different group names, loaders and cracktros are the cheapest things for a re-cracker to swap and prove nothing about independence. |
| Everything is `UNKNOWN` | Also usually correct. `UNKNOWN` means "differs, no recognised signature, alternatives ruled out". Read the range's `reason` field. |
| A range's `kind` looks wrong past its start | You resolved `kind` from `start`. Use `splitRangeByManifestKind`; coalescing does not respect kind boundaries. |
| A loader range disagrees with `NOTES.md` | `RELEASES.json`'s `loader_ranges` wins — it is earned from disassembly. Prose is how `$08F5` got misclassified. |
| Title-screen text shows up as cracktro | You used a bare printable-run scan. The vocabulary scan exists because `$4771-$4779` is the game's own text. |
| `unknown release "x" -- known releases: …` | `node .claude/skills/c64-provenance-diff/scripts/releases.mjs list` for the valid ids. |
