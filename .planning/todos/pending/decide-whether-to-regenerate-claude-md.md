---
created: 2026-09-24T00:00:00.000Z
title: Decide whether CLAUDE.md's generated blocks are still generated, or now hand-maintained
area: docs
severity: minor
files:

  - CLAUDE.md
  - .planning/codebase/ARCHITECTURE.md
  - .planning/codebase/CONVENTIONS.md
  - .planning/codebase/STACK.md

---

# Are CLAUDE.md's GSD blocks generated or hand-maintained?

`CLAUDE.md` carries seven `<!-- GSD:<name>-start source:<file> -->` fences declaring that most
of the file is generated from `.planning/PROJECT.md`, `.planning/codebase/*.md` and
`src/skills/`. But the blocks have **visibly drifted from those sources**, which means nothing
has regenerated them in a long time. The file is, in practice, hand-maintained inside markers
that claim otherwise.

Evidence of drift, measured 2026-09-24:

- The architecture block claimed `stock-protocol.ts` is "the only module that handles
  `node:net`". `ARCHITECTURE.md` made the narrower, correct claim about the binmon wire format.
  The generated text was a lossy — and wrong — compression of its own source.
- The stack block enumerated ten host-bound modules; `STACK.md` said eight; `build.ts` had
  sixteen. Three files, three answers, no regeneration reconciling them.
- The operator-owned `docs/` rule existed **only** in the conventions block and not at all in
  `CONVENTIONS.md`, so it was never generated from anything.

## The decision

Two coherent end states; the current one is neither.

**(a) Genuinely generated.** Keep the sources authoritative, re-run the generator, accept that
it discards anything hand-written inside a fence. Requires first confirming every hand-edit has
been mirrored into its source — the 2026-09-24 pass did this for the four defects it fixed, but
has **not** audited the blocks for other edits that exist only in `CLAUDE.md`. Running the
generator before that audit would silently delete them.

**(b) Hand-maintained.** Drop or neutralise the markers so nobody is misled into thinking a
regeneration is safe or that the sources are authoritative, and maintain `CLAUDE.md` directly.
Cheaper, but the `.planning/codebase/*.md` maps then need their own reason to exist and their
own freshness discipline — they are read by planning agents independently of `CLAUDE.md`.

Which generator writes these fences is itself unconfirmed: the profile block names
`generate-claude-profile`, but nothing was found that regenerates the project, stack,
conventions or architecture blocks. **Establish that first** — if no such generator is still
installed, (b) is not a choice but a description of the status quo, and the markers are simply
lying.

## Why it is only `minor`

Nothing is currently broken by the ambiguity, and the drift now runs in the safe direction: as
of `706d633b` the sources and `CLAUDE.md` agree on all five audited claims. The risk is latent —
it fires the day somebody runs a regeneration, and what it would take out is load-bearing (the
`docs/` rule is the sole remaining enforcement of that convention, its guard having been
withdrawn).
