---
created: 2026-08-26T07:58:10.287Z
title: Correct the false real-corpus claim in research/questions.md
area: planning
severity: major
files:

  - .planning/research/questions.md:14-16
  - .planning/ROADMAP.md (Phase 23 Notes — the contradicting, correct statement)
  - src/skills/c64-provenance-diff/SKILL.md:31-32

audit_acknowledged:
  milestone: v0.7.0
  at: 2026-09-01
---

## Problem

`.planning/research/questions.md`, under "Does dxa + Ghidra hold up on a real
cracked release?", tells the reader:

> Answerable against the existing `c64-provenance-diff` fixtures — real
> releases, already committed, already provenance-classified.

That is false for this repository, and it was written as the framing for the
question Phase 23 exists to answer.

**Verified 2026-08-26 during `/gsd-discuss-phase 23`:**

- `c64-provenance-diff` is pure Node over a **consuming** project's `recovery/`
  tree — `recovery/RELEASES.json` plus `.bin` dumps and their `.map.json`
  manifests (`SKILL.md:31-32`, `scripts/recovery-schema.mjs`). The skill ships
  scripts and a playbook; it ships no releases. There is no `recovery/` tree in
  this repo.
- A `find` over the whole tree for `*.prg` / `*.d64` / `*.t64` returns three
  `.prg` files, all synthetic probe fixtures:
  `.planning/phases/09-.../evidence/fixture/probe-illegal.prg`,
  `.planning/phases/11-.../evidence/criterion1/fixture/recon-subject.prg`,
  `.planning/phases/11-.../evidence/criterion4/subject.prg`.
  The `.bin` files under `src/mcp/vice/fixtures/binmon/` are recorded binary-
  monitor wire frames, not C64 images.

**Why it matters.** Phase 23 is the v0.6.0 gate, and both `gsd-phase-researcher`
and `gsd-planner` read `.planning/research/` as input. A researcher that trusts
this sentence plans measurements against a corpus that is not there, and the
error is only caught after a research pass has been spent. The whole point of
`PROOF-01` is to stop measuring on a self-authored fixture; a stale pointer to a
corpus that does not exist is the most likely way that defect gets reproduced
by accident.

ROADMAP.md's Phase 23 Notes already state the correct position ("nothing in this
repository is a real release ... If real, independently-cracked releases cannot
be obtained, measuring on another self-authored fixture reproduces the exact
defect `PROOF-01` exists to remove"). So the repo currently contradicts itself,
with the wrong version sitting in the file researchers read first.

## Solution

Rewrite the "Answerable against..." paragraph in `.planning/research/questions.md`
to say what is actually true:

- the corpus is **not** in this repo and must be supplied by the operator;
- `c64-provenance-diff` describes the *shape* a corpus should have
  (`RELEASES.json`, provenance-classified ranges, `CRACKER-PATCH` vs game code),
  which is the reason it was cited — keep that, drop the claim that instances
  exist here;
- point at ROADMAP.md Phase 23 Notes as the authoritative statement rather than
  restating it, so the two cannot drift apart again.

Do it before `/gsd-plan-phase 23` runs. Cheap fix, and the phase directly
downstream of it is the one it would mislead.

Consider whether a guard is warranted — the repo has precedent for pinning
normative prose with a test (`docs-linerefs.test.ts`, `docs-core-value-decision.test.ts`).
Probably not worth it for a one-line correction, but note that this is the second
time a research/planning doc has asserted an external artifact exists locally.
