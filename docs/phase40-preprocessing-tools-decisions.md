---
phase: 40-the-three-preprocessing-host-tools
decision: d64-parser-supersession
date: 2026-09-08
decision_ids: [D-04, D-05, D-06, D-07, D-08, D-29]
statements_reversed:
  - document: .planning/ROADMAP.md
    location: "Phase 40 success criterion 1"
    original: >-
      d64-parse.mjs is untouched and undeprecated: c1541 is additive by
      decision, and whether it eventually supersedes the hand-written parser
      is deferred on the record rather than settled as a side effect of
      adding a tool.
    amended_at: "plan 40-07, Task 2 (in place, dated rider, criterion not renumbered)"
  - document: .planning/REQUIREMENTS.md
    location: "Excluded table — 'Superseding or deleting the hand-written .d64 parser'"
    original: >-
      PREP-01 is additive. Whether c1541 eventually replaces d64-parse.mjs is
      a real question and is deliberately deferred rather than decided as a
      side effect of adding a tool.
    amended_at: "plan 40-07, Task 2 (in place, dated rider, row not deleted)"
related_decisions: [D-30, D-31, D-32]
---

This document carries YAML frontmatter, unlike most of this project's phase-level
prose, mirroring `docs/phase39-dual-channel-coexistence-gate-findings.md` for the
same reason it was taken there: a decision that reverses a previously locked
statement needs a machine-findable record of exactly which statements it
reverses and where each was amended, not a sentence buried in phase prose that
a later reader has to re-discover. `docs/phase39-dual-channel-coexistence-gate-findings.md`
is the shape this follows; the substance here is a design decision reached
during phase discussion, not a probe verdict.

## The decision

**`d64-parse.mjs` is fully replaced and deleted. `c1541`, reached over the
existing `host_tool` control op, is the ONE `.d64` route.** Its MCP-side
duplicate, `anno-d64.ts` — itself a deliberate copy of the same disk-format
knowledge, kept only because the MCP surface could not previously reach a
container-side skill script's logic — is deleted alongside it. This reverses
two statements that had been locked as "not yet decided" (see
`statements_reversed` in the frontmatter above, and `.planning/ROADMAP.md` /
`.planning/REQUIREMENTS.md` for the amended text itself, each carrying its own
dated rider pointing back here).

The decision was reached during this phase's discussion (2026-09-08) and
**executed in the same phase**, not deferred to a follow-on. `REQUIREMENTS.md`'s
own Notes for the roadmapper had named this as one of two "decisions to be
reached and recorded, not features to be built", to be folded into whichever
phase touches the relevant code — this is that phase.

## Measured evidence for the call

The evidence is a MEASURED capability comparison, not a preference:

- **`c1541 -bam` returns a per-SECTOR allocation map** (`*` allocated, `.`
  free, one row per track) where `d64-parse.mjs` computed only per-track free
  counts. This is strictly finer-grained.
- **`c1541 -entry` returns the first track/sector, the raw 32-byte directory
  entry, and the next-directory pointer** — `d64-parse.mjs`'s own directory
  walk had no equivalent single call surfacing all three; `-dir` alone does
  not emit first track/sector at all.
- Both facts make the ported fakery detector's signature 3 (a directory entry
  naming a file whose first sector lives in a track the BAM reports 100%
  free) **sharper, not merely equivalent**: the per-sector map lets the
  detector test the exact claimed first sector, rather than only whether its
  whole containing track is free.

`c1541` therefore supplies strictly richer inputs than the parser it replaces,
which is the reasoning that made replacement rather than mere addition the
right call.

## Three costs, stated and accepted

The supersession was not free, and each cost below was named and accepted
during the 2026-09-08 discussion, not discovered afterward:

1. **The replaced parser worked whether or not the emulator was up.**
   `d64-parse.mjs`'s own header called this out explicitly — it is "pure Node
   over the disk-image bytes, which is why it works whether or not VICE
   happens to be up." The `c1541` route needs the broker and the `host_tool`
   seam reachable. **Accepted.**
2. **`d64-parse.mjs`'s `--json` fakery detector had no `c1541` equivalent and
   had to be ported.** It carried three named-reason signatures (zero block
   count; first track/sector outside the image; first track reported fully
   free by the BAM) plus a visited-set cycle guard over the directory chain
   walk. All four were ported onto `c1541`'s composed capabilities — `dir` +
   `bam` + `entry` — landing in `c64-disk-access`'s `audit` subcommand (plan
   40-04), with signature 3 sharpened to sector granularity as noted above.
3. **The duplicate module's blast radius reached further than a single
   file.** Deleting `anno-d64.ts` and `d64-parse.mjs` (plan 40-06) touched:
   three LIVE tests that had imported `anno-d64.ts`'s pure functions directly
   (`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `dxa-live.test.ts`) —
   each re-pointed onto the seam and each now carries a broker dependency it
   did not have before, a genuine behaviour change accepted knowingly, not
   bookkeeping; `module-classification.ts`'s registration entry, which
   carried a pinned symbol-and-line reference; two npm packaging surfaces
   (`package.json`'s `files[]`, `scripts/check-npm-packages.mjs`'s packaged-
   import set); and a committed test (`vsf-slice.test.mjs`) that asserted the
   *presence* of a citation to the file being deleted, which had to be
   re-pointed to what the rewritten citation now states rather than simply
   removed.

## The fixture circularity, acknowledged

Cross-validating `c1541`'s own output needed a synthetic `.d64` fixture, and
authoring one needs *mutating* `c1541` verbs (`-format`, `-write`) that this
phase deliberately never ships (`D-03`: no mutating `c1541` verb ships on the
shipped seam). The fixture was authored once by a throwaway command, outside
the seam, and committed — the same resolution this project has already used
for evidence-that-needed-a-mutation before (Phases 23, 33, Phase 39's `D-10`/
`D-13`: "throwaway probe scripts are evidence, not deliverables").

**The circularity is acknowledged rather than hidden: the tool under test
built its own fixture, so the format-correctness claim over that fixture
rests on `c1541` agreeing with itself.** This is accepted as adequate for the
extract/chain code paths. The mitigation is a second, independent assertion
that does NOT depend on the synthetic fixture: `c64-disk-access`'s
`c1541.test.mjs` carries a LIVE-gated cross-validation against Phase 23's
real, independently-produced `danish.d64` corpus image (plan 40-04, Task 3),
checking the directory listing's block-count trailer, an entry's own claimed
first track/sector, and that entry's independently-walked sector chain all
agree on real data nothing in this phase produced.

## Two deliberate divergences

Recorded here because a future reader re-deriving them from first principles
would otherwise reasonably re-propose both:

1. **Version probing was dropped, even though `.planning/ROADMAP.md`'s own
   Notes for Phase 40 ask for it.** The owner dropped the version half of
   that request on 2026-09-08. It is a Notes bullet, not a success criterion,
   so it was the owner's to overrule, and it was overruled for a measured
   reason: `c1541 --version` is unimplemented (`Unimplemented version
   '-version'`), and version probing for the (now-removed) third tool was
   unreliable in the same way. Only path resolution and per-call path
   logging were built. **A planner must not re-add version probing on the
   strength of the ROADMAP note alone** — the note is a live, recorded
   divergence, not an oversight.
2. **No mutating `c1541` verb ships on the production seam, even though
   mutating verbs were used once, outside the seam, to author the fixture
   described above.** The two facts do not contradict each other: `D-03`
   excludes mutating verbs from the *shipped* `host_tool` id set; the fixture
   authoring script is a throwaway, uncommitted-as-a-tool, one-time command
   whose OUTPUT (the fixture file) is what is committed, not the mutating
   call itself.

## Cartridge removal (dated, 2026-09-08)

**Separate from the `.d64` supersession above.** `cartconv` is **not built**
and `PREP-03` — the requirement covering cartridge bank recovery — **leaves
the roadmap**, by a hard direction from the project owner given during this
phase's discussion on 2026-09-08. No `cartconv.*` tool id, no per-bank
images, no bank output contract, no cartridge work of any kind in this phase
or any that follows unless a new requirement is written.

This is **not** a deferral to a named future phase — unlike the runtime-
correlation work (explicitly deferred to Phase 41 and beyond), the cartridge
capability simply leaves scope. If it returns, it returns as a new
requirement, decided fresh, not as a resumption of `PREP-03`.

`PREP-03`'s own line in `.planning/REQUIREMENTS.md` is struck in place with a
dated rider rather than deleted (per this project's `D-29`/`D-31` amend-in-
place convention, following the eleven ids the v0.7.0 milestone corrected the
same way), a new row is appended to the Excluded table recording the removal,
and the pre-existing bank-qualified-addressing exclusion row — which had
justified itself by reference to `PREP-03` — carries its own separate dated
rider rather than being folded into the new row, because the two facts are
independent: bank-qualified addressing stays excluded from the store
regardless of `PREP-03`'s fate. `.planning/ROADMAP.md`'s Phase 40 goal
sentence, its former success criterion 3, and success criterion 4's "each of
the three" phrasing are amended the same way — struck in place, never
deleted, each rider pointing back at this document and at 2026-09-08.

Recorded because `cartconv`'s own measured behaviour is the strongest
argument for `PREP-04`'s positive-shape failure oracle, and that reasoning
must survive the tool's removal from scope: `cartconv -f <non-cartridge>`
produced **zero bytes and exit 0** during this phase's discussion-time
measurement — no error text at all, nothing a phrase-matcher could ever
catch. The oracle design decided against a negative error-phrase check partly
on the strength of that measurement, and the measurement is worth keeping on
record even though the tool it describes was never built.
