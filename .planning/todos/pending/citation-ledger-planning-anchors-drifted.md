---
title: Repair five drifted .planning/ citation-ledger anchors (suite is 2-fail until then)
date: 2026-09-19
priority: high
source: /gsd-execute-phase 61 — measured pre-dispatch and re-measured at phase close
---

# The citation ledger cites five `.planning/` anchors that no longer resolve

`src/mcp/vice/phase58-citation-ledger.test.ts` exits 1. Two of its tests fail, across five
anchors. **Every one cites a `.planning/` file. None cites README.md.** This predates Phase 61's
execution and was carried forward at its close by owner decision (see `61-UAT.md`), on the
grounds that Phase 61's own D-08 concern — README-pointing citations staying honest — was met.

Measured: pre-phase 4032 tests / 3949 pass / 2 fail / 81 skipped. Post-phase 4051 / 3968 / 2 fail
/ 81 skipped. The failing set is byte-identical across both. The project's floor is zero
failures, so this is the only thing standing between the tree and a green suite.

## Four are line drift — mechanical

The Phase 61 planning commits grew `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`. Each
anchor's text still exists verbatim, at a shifted line:

| Ledger citation | Anchor | Now at |
|---|---|---|
| `.planning/REQUIREMENTS.md:86` | "No shipped tool refuses on one." | 114 |
| `.planning/ROADMAP.md:1959` | "the **first** regeneration of the committed" | 1963 |
| `.planning/ROADMAP.md:1939-1942` | "The precedence order exists in exactly one place." | 1943 |
| `.planning/ROADMAP.md:1947` | "`resources-sync.test.ts` is green against **regenerated and committed**" | 1951 |

The citing documents are `docs/phase58-declaration-provenance.md` and the phase59 placement
document. Each has **three surfaces that must agree** — the ledger JSON block, the document body,
and the YAML frontmatter. A previous repair in this project fixed only two of the three; check
all three. Re-verify the line numbers above at fix time, since any further `.planning/` edit
moves them again.

## One is a deleted target — needs a decision, not a line bump

`.planning/ROADMAP.md:2002-2005`, anchor **"a user missing ACME learns that"**.

`git show 67a0d810 -- .planning/ROADMAP.md` shows the sentence deleted by
`67a0d810 docs(61): drop the doctor phase at owner decision`. It was present at
`67a0d810^:.planning/ROADMAP.md:2004` and appears nowhere in the ROADMAP now — it lived in the
dropped doctor phase's success criteria.

Re-pointing this citation at some other line would be fabrication. The honest options are:

1. Re-cite a surviving statement that genuinely makes the same claim, if one exists; or
2. Record that the support was withdrawn when the doctor phase was dropped, and amend the claim
   in the citing document accordingly.

Phase 58 refused to leave a known-false claim standing one section further down (D-07); the same
refusal applies here.

## Why no Phase 61 plan fixed it

None of 61-01, 61-02 or 61-03 declared `.planning/ROADMAP.md` or `.planning/REQUIREMENTS.md` in
`files_modified`, so repairing them was outside every executor's sanctioned scope. All three were
told explicitly not to touch them, and all three complied.
