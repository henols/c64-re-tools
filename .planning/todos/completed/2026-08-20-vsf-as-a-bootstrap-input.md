---
created: 2026-08-20T20:30:00.000Z
title: .vsf as a bootstrap input for the external analyser — filed as backlog, not a phase deliverable
area: general
files:
  - .planning/ROADMAP.md:187
  - .planning/ROADMAP.md:291
  - .planning/ROADMAP.md:424
  - .planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md:458
  - .planning/REQUIREMENTS.md:66
  - .planning/REQUIREMENTS.md:140
  - docs/phase9-external-analyser-probe-findings.md
  - .claude/mcp/vice/docs-dangling-refs.test.ts
---

## Problem

Phase 10's D-03 correctly dropped `.vsf` from that phase's the external analyser input set,
but its own Deferred Ideas entry pointed the deferral at "Phase 11's `c64-ram-capture`
extension, `ANNO-14`/`ANNO-15`" as `.vsf`'s eventual home. That pointer was wrong:
`ANNO-14`/`ANNO-15` are about the symbol round trip (export/import VICE label files),
not about accepting `.vsf` snapshots as an external analyser bootstrap input. Phase 11 (D-34)
confirmed no `ANNO-*` requirement actually covers this, so the dangling forward reference
is corrected at its sites and the idea is captured here instead.

Plan 11-03 corrected four of them (ROADMAP.md's standing constraint, Phase 10 criterion 3's
parenthetical, the cut-table `ANNO-08` row, and `10-CONTEXT.md`'s Deferred Ideas entry) but
missed two more in `.planning/REQUIREMENTS.md` — `ANNO-09`'s own requirement text and the
`ANNO-08` fold entry — which survived phase completion, verification and a security audit
because 11-03-T1's declared check was a hand-run `grep -c vsf .planning/ROADMAP.md`, scoped to
a single file. The Phase 11 validation audit (2026-08-21) fixed both and replaced the one-file
grep with a repo-wide mechanical guard, `.claude/mcp/vice/docs-dangling-refs.test.ts`, which
runs in CI. **If this backlog item is ever deleted, that guard fails** — the corrected pointers
all send the reader here.

## Why it's still deferred

Three real reasons, none of them resolved by simply picking a later phase:

1. **No `ANNO-*` requirement covers it.** `ANNO-14` is "symbols annotated in
   the external analyser export as VICE label files into the symbol store", `ANNO-15` is the
   inverse (names discovered live flow back). Neither is about accepting a `.vsf` snapshot
   as a *project bootstrap input* — that is a different capability than the symbol round
   trip and was never actually scoped anywhere in the 12 in-scope `ANNO-*` requirements.

2. **Phase 9 found `.vsf` machine-type auto-detection unreliable.**
   `docs/phase9-external-analyser-probe-findings.md` § Accepted limits, entry 2:
   The external analyser's `file_io.rs` `suggested_system` match recognises only the four literal
   strings `"C64"`/`"C128"`/`"VIC20"`/`"PET"`/`"PLUS4"`; a genuine stock-VICE C64 snapshot
   writes `"C64SC"`, which matches none of them, so the displayed machine-type is always a
   fallback default rather than a genuine read. RAM content and start address remain
   reliable from a `.vsf` — only the machine-type field is affected.

3. **The D-01 synthesis route never hands the external analyser a container format.** Project
   bootstrap builds the `.regen2000proj` directly in Node from a `.prg`/`.d64`/flat-64K
   input (Phase 10, D-01/D-03). Parsing VICE snapshots ourselves to extract memory, machine
   type and start address would be new work this project has never built, whose only real
   payoff — machine-type and start-address auto-detection — Phase 9 already proved
   unreliable for the field that would matter most (machine type).

## What would change the decision

A consumer who has **only** `.vsf` captures of a program and cannot re-capture it as
`.raw`/flat-64K (for example, a rescued snapshot from years ago, or a case where the
program's runtime state can no longer be reproduced to re-capture). That consumer would
need the external analyser to accept a VICE snapshot directly — at which point the machine-type
auto-detection limit above would need to be worked around (verify or explicitly set the
system field, the same technique already used for `use_illegal_opcodes` in Phase 10's
generated projects) rather than trusted.

## Resolution

**Closed `wont-fix` (Phase 15, plan 15-12), quoting the pre-existing decision already
recorded in `.planning/REQUIREMENTS.md`'s Out of Scope table verbatim rather than
inventing a new rationale:**

> `.vsf` as an external analyser bootstrap input | Covered by `DEBT-01` as a disposition, not
> as a build. D-34 stands unless a consumer has `.vsf` captures and cannot re-capture as
> `.raw`.

This is the same reversal condition this todo's own "What would change the decision"
section already names above — a consumer who has *only* `.vsf` captures and cannot
re-capture as `.raw`/flat-64K. No such consumer has surfaced across three milestones
(v0.2.0, v0.3.0, v0.4.0/Phase 15), and none of `anno-*`'s 12 in-scope requirements
covers `.vsf` as a project bootstrap input (confirmed above: `ANNO-14`/`ANNO-15` are
the symbol round trip, not this). Phase 9's `.vsf` machine-type auto-detection limit
(`docs/phase9-external-analyser-probe-findings.md` § Accepted limits, entry 2) stands
unresolved and would need to be worked around, not merely noted, the day this reverses.

`docs-dangling-refs.test.ts`'s repo-wide guard (which fails if this backlog item is ever
deleted, since the corrected pointers all send the reader here) remains satisfied — this
file stays in `.planning/todos/completed/`, never deleted, per DEBT-01's own prohibition
against deleting a pending todo file.
