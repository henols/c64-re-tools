# Phase 59 — Deferred Items (out of scope for the plan that found them)

## Pre-existing citation-ledger drift in ROADMAP.md (found during 59-01 Task 3)

**Found during:** 59-01 Task 3's full automated gate run (`npm run test:automated`).

**What:** `phase58-citation-ledger.test.ts`'s "the committed provenance document's
citation ledger is complete and every anchor resolves" test fails. It reports:

```
.planning/ROADMAP.md:1980-1983: anchor "a user missing ACME learns that" not
found in cited range; actual text: "\n**Depends on**: Phase 60 — the seam must
already BE the live resolution path\nbefore the doctor exists. A doctor built
first grows the second detection path\n`DOCTOR-05` forbids, and no amount of
discipline substitutes for the ordering."
```

The anchor text actually lives at `.planning/ROADMAP.md:1989`, not within the
cited `1980-1983` range — a line-shift, most likely from a ROADMAP.md edit made
after the citation was recorded (phase 59's planning commits inserted a "Depends
on" paragraph ahead of the cited success-criteria block).

**Why deferred, not fixed here:** Plan 59-01's `files_modified` is exactly
`tool-location.mts`, `tool-location.test.ts`, `resources/tool-location.mjs`,
`prerequisites.json`, `build.ts`, `tsconfig.build.json`. Neither `ROADMAP.md` nor
`phase58-citation-ledger.test.ts` is in that set, and this failure reproduces
identically with none of 59-01's changes present — it is a pre-existing defect in
unrelated planning documentation, not something this plan introduced or can fix
within its own scope (ENGINEERING_RULES.md Scope Discipline; gsd-executor Scope
Boundary).

**Remedy:** Re-run `gsd_run` phase-58 citation-ledger regeneration (or hand-shift
the cited line range to `1989` or nearby) the next time `.planning/ROADMAP.md` is
touched with intent, or as part of whichever phase next edits that document's
"Phase 61" section.

**Verification it is pre-existing:** `git diff` for 59-01 touches none of
`.planning/ROADMAP.md` or `src/mcp/vice/phase58-citation-ledger.test.ts`; the
failure is a function of those two files' content alone, both untouched by this
plan.
