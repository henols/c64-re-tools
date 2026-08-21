---
created: 2026-08-20T20:30:00.000Z
title: .vsf as a bootstrap input for regenerator2000 — filed as backlog, not a phase deliverable
area: general
files:
  - .planning/ROADMAP.md:187
  - .planning/ROADMAP.md:291
  - .planning/ROADMAP.md:424
  - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md:458
  - .planning/REQUIREMENTS.md:66
  - .planning/REQUIREMENTS.md:140
  - docs/phase9-regenerator2000-probe-findings.md
  - .claude/mcp/vice/docs-dangling-refs.test.ts
---

## Problem

Phase 10's D-03 correctly dropped `.vsf` from that phase's regenerator2000 input set,
but its own Deferred Ideas entry pointed the deferral at "Phase 11's `c64-ram-capture`
extension, `R2000-14`/`R2000-15`" as `.vsf`'s eventual home. That pointer was wrong:
`R2000-14`/`R2000-15` are about the symbol round trip (export/import VICE label files),
not about accepting `.vsf` snapshots as a regenerator2000 bootstrap input. Phase 11 (D-34)
confirmed no `R2000-*` requirement actually covers this, so the dangling forward reference
is corrected at its sites and the idea is captured here instead.

Plan 11-03 corrected four of them (ROADMAP.md's standing constraint, Phase 10 criterion 3's
parenthetical, the cut-table `R2000-08` row, and `10-CONTEXT.md`'s Deferred Ideas entry) but
missed two more in `.planning/REQUIREMENTS.md` — `R2000-09`'s own requirement text and the
`R2000-08` fold entry — which survived phase completion, verification and a security audit
because 11-03-T1's declared check was a hand-run `grep -c vsf .planning/ROADMAP.md`, scoped to
a single file. The Phase 11 validation audit (2026-08-21) fixed both and replaced the one-file
grep with a repo-wide mechanical guard, `.claude/mcp/vice/docs-dangling-refs.test.ts`, which
runs in CI. **If this backlog item is ever deleted, that guard fails** — the corrected pointers
all send the reader here.

## Why it's still deferred

Three real reasons, none of them resolved by simply picking a later phase:

1. **No `R2000-*` requirement covers it.** `R2000-14` is "symbols annotated in
   regenerator2000 export as VICE label files into the symbol store", `R2000-15` is the
   inverse (names discovered live flow back). Neither is about accepting a `.vsf` snapshot
   as a *project bootstrap input* — that is a different capability than the symbol round
   trip and was never actually scoped anywhere in the 12 in-scope `R2000-*` requirements.

2. **Phase 9 found `.vsf` machine-type auto-detection unreliable.**
   `docs/phase9-regenerator2000-probe-findings.md` § Accepted limits, entry 2:
   regenerator2000's `file_io.rs` `suggested_system` match recognises only the four literal
   strings `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"`; a genuine stock-VICE C64 snapshot
   writes `"C64SC"`, which matches none of them, so the displayed machine-type is always a
   fallback default rather than a genuine read. RAM content and start address remain
   reliable from a `.vsf` — only the machine-type field is affected.

3. **The D-01 synthesis route never hands regenerator2000 a container format.** Project
   bootstrap builds the `.regen2000proj` directly in Node from a `.prg`/`.d64`/flat-64K
   input (Phase 10, D-01/D-03). Parsing VICE snapshots ourselves to extract memory, machine
   type and start address would be new work this project has never built, whose only real
   payoff — machine-type and start-address auto-detection — Phase 9 already proved
   unreliable for the field that would matter most (machine type).

## What would change the decision

A consumer who has **only** `.vsf` captures of a program and cannot re-capture it as
`.raw`/flat-64K (for example, a rescued snapshot from years ago, or a case where the
program's runtime state can no longer be reproduced to re-capture). That consumer would
need regenerator2000 to accept a VICE snapshot directly — at which point the machine-type
auto-detection limit above would need to be worked around (verify or explicitly set the
system field, the same technique already used for `use_illegal_opcodes` in Phase 10's
generated projects) rather than trusted.
