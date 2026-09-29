---
name: c64-provenance
description: Decide if a byte in a cracked C64 release is original game code or a cracker change. It compares two or more independently cracked releases at an anchor-proven offset. Use when asked to diff two releases or disk images, find which bytes the cracker patched, or tell loader or cracktro code from game code. Use when asked to prove a byte is original, establish provenance or confidence for a memory range, or regenerate the provenance ledger. Use when asked to run anchor-search, count-patches or diff-images. Also use when asked if a crack added a trainer or cheat, or if a patch changes gameplay and not only loading. Also use when asked if a rebuild would inherit a gameplay change by a cracker. Also use when asked if two releases are really independent and do not share an ancestor.
---

# Deciding what a cracker changed

**A byte that is different between two releases is not a cracker patch.** It
is a byte that is different. This pipeline exists because confident nonsense
comes from the gap between those two statements. The header of
`scripts/diff-images.ts` calls this step "the step most able to produce
confident nonsense". Each stage below proves its own precondition, or it
refuses to emit.

**Run the four verbs in order.** `diff` has no meaning without a proven
offset. `ledger` does not write a verdict that the earlier stages did not
earn.

```bash
D=skills/c64-provenance/scripts/diff-images.ts   # from the repo root

node $D anchor-search                        # 1. prove the per-release offset  [WRITES]
node $D diff                                 # 2. N-way byte diff at that offset [WRITES]
node $D count-patches                        # 3. CRACKER-PATCH addresses in game code
node $D ledger                                # 4. regenerate recovery/PROVENANCE.md [WRITES]

node $D diff --json                          # machine-readable, with per-range reasons
node $D diff --gap-tolerance 16              # coalescing width (default shown)
node $D anchor-search --reference <id>       # pick the reference release
node $D ledger --prose <path>                # project narrative (default: <data root>/PROVENANCE.prose.md)
```

The script is pure Node over committed files: the `.bin` dumps, their
`.map.json` manifests, and `recovery/RELEASES.json`. It contacts nothing. The
release ids come from the release registry. List them with `releases.ts list`
in `c64-project`.

Each release needs a dump with the label `run1`, with a `.bin` and a
`.map.json`. The script reads that dump as the primary dump of the release.
Record it with `releases.ts add-dump` in `c64-project`.

## The order

| # | Verb | Proves | Refuses to |
|---|---|---|---|
| 1 | `anchor-search` | A single global offset per release, from long distinctive byte runs located with `Buffer.indexOf` | Accept a **majority** vote. All usable anchors must agree, or there is no offset. |
| 2 | `diff` | Which ranges are different, coalesced on verdict continuity | Diff at an assumed offset. A release with no offset that `anchor-search` proved stops the verb. |
| 3 | `count-patches` | How many addresses are `CRACKER-PATCH` **and** `game`-kind | Count a patch outside game code |
| 4 | `ledger` | The generated tier of `recovery/PROVENANCE.md` | Emit an assumption as if it were evidence |

## Three verbs write to tracked files

`anchor-search` updates `recovery/RELEASES.json`. If it cannot prove an
offset for a release, it clears the stored offset of that release. `diff`
rewrites the `.map.json` range manifest of each dump. `ledger` rewrites
`recovery/PROVENANCE.md` and also changes `RELEASES.json`. So a dirty
`git status` after a run is **expected**.

What changed is the important part. A clean second run gives a
**timestamp-only** diff: `proven_at` and `generated_at`. Any other change is a
real change:

```bash
git diff -- recovery/RELEASES.json recovery/PROVENANCE.md recovery/*/dumps/*.map.json
```

If only those two fields have `-`/`+` pairs, revert the changes and continue.
If `offset`, `anchor_count`, `anchors_agreeing` or `generated_tier_sha256`
moved, stop. Find the cause before you commit. The pipeline tells you that the
evidence changed.

## Worked example: the real corpus

Two independently cracked releases of one title. Both were captured at the
same post-loader entry trigger. **This example shows the release ids as
`release-a` and `release-b`.** **Each number is real output from a live run
against a two-release corpus. Only the ids have different names.** The tool
has no opinion about the name of a release.

```
$ node $D anchor-search
release-a -> release-b: ok=true offset=0 (all 7 usable anchor(s) agree on offset 0)

$ node $D diff
diff: 204 range(s), gap_tolerance=16, coalesced=260

$ node $D count-patches
release-a: 0
release-b: 0
```

**204 different ranges and zero cracker patches.** The verdict tally from
`diff --json` is `{"UNKNOWN": 102, "ORIGINAL": 102}`. No range got
`CRACKER-PATCH`. That is the pipeline at work. It is not a failure.

Read it like this. 102 ranges are identical across two independently cracked
releases, so they are `ORIGINAL`, with real evidence for the word. The other
102 are different, match no cracker signature, and so are `UNKNOWN`. Each one
has a `reason` that names the alternatives it ruled out:

> differs across 2 release(s) (release-a, release-b) with no recognised cracker
> signature … Ruled out: relocation (each release's anchor-proven offset is
> applied here). Not checked by this tool: a revision difference, a read error
> and a packer artifact …

`UNKNOWN` with that statement is the honest answer. The ledger prose gives
the recorded trigger of each release. It says that the images show the same
program state only when each release records the same trigger. Do not change it to
`CRACKER-PATCH` because a byte is different. **Confidence: HIGH.** The run was
live against the committed corpus. `ledger` gave the committed
`generated_tier_sha256 dc7eb080…` byte-identically, so the classification is
deterministic.

**One qualifier on the 102. It is the premise of the example, not its
output.** The example states "independently cracked" at the top. It does not
prove it. The determinism is HIGH. The `ORIGINAL` verdicts have only the
confidence of that independence claim. Read § *The independence
precondition* below before you quote an `ORIGINAL` count as settled.

## The five kinds and the three verdicts

`bucketManifest` changes a manifest from `ranges-only` to `bucketed`. It
assigns `game` / `loader` / `cracktro` / `io` / `unused`. The verdicts are
`ORIGINAL`, `CRACKER-PATCH` and `UNKNOWN`, with `HIGH` or `MEDIUM-HIGH`
confidence.

The two seeds are where this goes wrong. Both failure modes are on record:

- **`bucketManifest` seeds `loader` from the earned `loader_ranges` in
  `RELEASES.json`.** Those are live disassembly evidence. **Never seed it from
  `NOTES.md` prose.** A loader range read from prose one time classified
  `$08F5`, a permanent joystick-poll instruction, as loader code. That is the
  documented root cause.
- **`bucketManifest` seeds `cracktro` from a scan for crack-credit
  *vocabulary*.** It does not use a bare printable-ASCII scan. A bare scan gave
  a real false positive on a real corpus: **the game's own title-screen text**
  is also printable ASCII, and it was different between the two releases. The
  bare scan called that text cracker credit. It is not. A different string is
  not a cracker string, and it correctly stays `UNKNOWN`.

`io` (`$D000-$DFFF`) and `unused` (contiguous `$00`/`$FF` power-on runs) are
assigned at capture time and kept verbatim. All that the trace reaches is
`game`.

The `.bin` files are **never** edited or zeroed. The classification is in the
manifests. The bytes stay verbatim evidence.

## Carrying the verdict into the rebuild

The ledger that `ledger` writes can go into the exported ACME source as an
inline comment on each block. Excluding a range from the rebuild output is
also recorded in the annotation project. Do both with `c64-annotations`.
The verdict makes the evidence visible and decides nothing. What to reverse,
keep or leave out is always the decision of the operator, never of the tool.

## A `CRACKER-PATCH` in `game` code is a trainer until proven otherwise

`count-patches` counts exactly one intersection: verdict `CRACKER-PATCH`, kind
`game`. That intersection has a name that the pipeline never states: a
**trainer**. A cracker who changes bytes *inside game code* changes gameplay.
Unlimited lives, disabled collision or a frozen timer is the usual reason.

This is important because the three verdicts tell **who wrote a range**, not
**what it does**. A relocated loader stub and a life decrement patched to a
`NOP` both come back `CRACKER-PATCH`. So give each patch a **function
verdict** in addition to its origin verdict:

| Function | Means | Why it matters |
|---|---|---|
| `loader` | raw-sector loading, decrunch, relocation, drive code | an obstacle to get past, not a subject |
| `cracktro` | intro, scroller, music, the crack's own presentation | not the object of study |
| `gameplay` | reads or writes game state: **a trainer** | any rebuild that copies these bytes inherits it |
| `unknown` | not yet attributed | examine it before you trust it |

**A rebuild made from these bytes inherits a `gameplay` patch silently.**
Behaviour-only verification does not find it. The baselines come from the
same cracked image, so the rebuild and its reference agree *while both are
different from the game as it shipped*.

### The independence precondition: the premise of this skill

`ORIGINAL` means "identical across two **independently** cracked releases".
Without the word *independently* the verdict has no value. Two releases with a
shared ancestor are identical everywhere the ancestor was, **including all
places that the ancestor's cracker patched**. Establish the independence. Do
not infer it from different group names, different loaders or different
cracktros. Those are the easiest things for a re-cracker to replace.

Until you establish it, the diff is directional, and the direction is the trap:

- A diff **hit** is informative: something was patched.
- A diff **miss** is not informative, and the miss is what looks like
  reassurance.

So a `0` from `count-patches` is not evidence that no trainer exists. It is
evidence that no trainer exists **in one release and not in the other**. With
unproven ancestry these are different claims, and the diff tested only the
second one.

### The detector that does not use the diff

This is a signature hunt over the canonical image. Read it against the
coverage map, not against another release. None of it needs a second
release. That is why it works in the shared-ancestor case:

1. **Writes to a consequence counter from an unexpected site.** When the
   memory map names what the game decrements on failure (lives, timer,
   health), each writer that is not the game's own is a candidate. Search
   **every addressing form that can reach the address**, indexed forms
   included. A search in absolute mode only is the standard way this hunt
   gives a false negative.
2. **Armed but never reached.** Code that a jump from a patched region
   reaches, but that never runs across full gameplay coverage, is dead crack
   scaffolding or a trainer that waits for a trigger. Both need a verdict. Do
   not reproduce either one without a verdict.
3. **Trigger scanners.** Reads of the keyboard or joystick registers in code
   that is not the game's own input handler. Comparisons against key codes
   inside a range already marked `CRACKER-PATCH`.
4. **`NOP` sleds and inverted branches.** The cheapest trainer is a check that
   is patched out: `EA EA EA` where a `JSR` or a decrement was, or a
   `BEQ`↔`BNE` flip on a collision or life test. These are a few bytes inside
   code that is otherwise original. It is the pattern that is easiest to
   dismiss as noise, and the one that is most important.

**A negative is a result, and it must state its limits.** "No trainer found, by
these four signatures, at this coverage level" is an answer. "The diff was
clean" is not an answer.

## Before you trust a verdict

- **Coverage is incomplete, and the ledger says so.** A load-coverage record
  is not a complete coverage claim until you visited every game state. An
  on-demand-loaded region (bytes that appear only after a room or state that
  nobody visited) is **not in the primary dumps that this skill compares**.
  Each verdict applies to "the addresses visible at the post-loader
  game-entry point", not to the whole running game. That is why the ledger can
  be regenerated: a more complete `LOADING.md` opens it again.
- **Never resolve the `kind` of a range from its `start` address.**
  Coalescing groups on *verdict* continuity, not *kind* continuity, so one
  range can cross several kind zones. `splitRangeByManifestKind` exists for
  this. This bug occurred in a live run: a wide `ORIGINAL` range went through
  a `loader` sub-range inside it. Resolving from `start` silently gives the
  wrong label to each address after the first boundary.
- **`--gap-tolerance` is sensitive to off-by-one, by design.** A gap of
  identical bytes *strictly shorter* than N coalesces. A run of *exactly* N
  stays its own row.
- **Only more agreeing independent releases increase the confidence.** Two
  releases can establish `ORIGINAL`. They cannot establish intent. And
  *agreeing* counts only when *independent* is proven. Releases with a shared
  ancestor also agree on the ancestor's patches. So unproven ancestry makes
  each `ORIGINAL` verdict conditional, not earned.

The last line on stdout is one JSON result: `{"ok": true, ...}` with exit
code 0, or `{"ok": false, "message": "..."}` with exit code 1. `--json` gives
only that line, with the full data (`diff --json` adds each range). Without
`--json`, short text lines come first.

- `anchor-search` gives `ok: false` when any release has no proven offset,
  and names that release. It refuses a registry with fewer than two
  releases (`anchor-search needs at least two releases in the registry`) and
  an unknown `--reference` (`unknown reference release "<id>"`).
- `diff`, `count-patches` and `ledger` refuse a release that has no offset
  proven against the recorded reference (`no anchor-proven offset against
  reference "<id>" for release(s) …`). They never use 0 in place of a
  missing offset.
- `--gap-tolerance` with no value, or with a value that is not a
  non-negative integer, gives a refusal that names the flag.
- A dump that is not exactly 65536 bytes stops the run with
  `readImage: <path> is <n> bytes, expected exactly 65536`.
- `ledger` refuses to emit with `renderLedger: refusing to emit -- …` when
  an `UNKNOWN` range has an empty reason, when an `ORIGINAL` range has fewer
  than 2 agreeing releases, or when the generated tier has a gap, an
  overlap, or does not reach `$FFFF`.
- `ledger` without a project prose file prints `ledger: no project prose at
  <path> -- emitting the derived prose only.` and continues.
- No verb or an unknown verb gives `ok: false` with the usage text.

## What this skill does NOT do

- **No capture.** A verified 64K image, or proof that two captures are
  equivalent, is `c64-ram-capture`.
- **No release registry edits by hand.** Listing and adding releases is
  `c64-project`.
- **No address meanings.** What an address or bit means is `c64-memory-map`.
- **No RE method.** Which address to read next, and what the answer rules out,
  is `c64-reverse-engineering`.
- **No annotation writes.** Carrying the ledger into exported source, and
  recording an excluded range, is `c64-annotations`.

## Troubleshooting

| Symptom | Correct |
|---|---|
| `no anchor-proven offset against reference "<id>" for release(s) …` | Run `anchor-search`. If it cannot prove the offset, capture the release again. |
| `anchor-search` reports `ok=false` | The anchors did not agree, so there is no single offset. Do **not** use the majority. The images are not the same fully loaded state, or one capture is bad. Capture again. Do not force it. |
| `git status` dirty after a run | Expected: two verbs write. Diff the two files. If only `proven_at`/`generated_at` moved, `git checkout --` them. |
| `generated_tier_sha256` changed | The classification changed, not only a timestamp. Find the cause before you commit. The digest is the determinism check. |
| `count-patches` reports 0 | Usually correct. It counts addresses that are `CRACKER-PATCH` **and** `game`-kind. With two releases and no signature match, no address qualifies. Check the `diff --json` tally before you call it a bug. But do not read it as "no trainer". See the next two rows. |
| Asked if the crack added a trainer | `count-patches` is the diff-side answer: `CRACKER-PATCH` ∧ `game` **is** the trainer count. It is necessary but not sufficient. It cannot see a trainer that both releases have. Also do the signature hunt. |
| Asked to prove a release has no trainer | A diff alone cannot prove that, and that statement is the answer. A clean diff rules out only a trainer in *one* release and not in the other. With unproven ancestry that claim is weaker than it seems. Report the signature-hunt result with its coverage limits. |
| Two releases agree everywhere suspicious | Suspect a shared ancestor before you conclude `ORIGINAL`. Different group names, loaders and cracktros are the easiest things for a re-cracker to replace. They prove nothing about independence. |
| Everything is `UNKNOWN` | Also usually correct. `UNKNOWN` means "different, no recognised signature, alternatives ruled out". Read the `reason` field of the range. |
| The `kind` of a range looks wrong after its start | You resolved `kind` from `start`. Use `splitRangeByManifestKind`. Coalescing does not respect kind boundaries. |
| A loader range disagrees with `NOTES.md` | The `loader_ranges` in `RELEASES.json` win, because live disassembly evidence earned them. Prose is how `$08F5` got the wrong class. |
| Title-screen text shows up as cracktro | You used a bare printable-run scan. The vocabulary scan exists because `$4771-$4779` is the game's own text. |
| `unknown release "x" -- known releases: …` | Run `releases.ts list` in `c64-project` for the valid ids. |
| `primaryDumpEntry: release "x" has no run1 dump with a .bin recorded` | Record the `write-set` result of the release as its `run1` dump: `releases.ts add-dump` in `c64-project`. |
