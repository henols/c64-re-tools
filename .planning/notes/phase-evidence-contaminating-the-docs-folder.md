---
title: "Why phase evidence ended up in docs/, and why the reason expired"
date: 2026-09-13
context: /gsd-explore — owner challenge, "docs/ is for my own docs, not phase documents"
status: cause traced and measured; remediation routed to Phase 53 (depends on Phase 51)
---

# Phase evidence in `docs/`

**Owner ruling, 2026-09-13:** `docs/` is operator-owned. Phase evidence belongs
where the planning tree already puts phase artifacts. A `docs/evidence/`
subfolder was explicitly rejected — it still contaminates the operator's tree.

## This was never GSD doing it

Nothing in the vendored GSD tree writes to `docs/`. GSD writes to `.planning/`.
Every `docs/phase*.md` was written by a plan that named the path.

Stock GSD prescribes **no evidence directory at all** — there is no
`.planning/phases/*/evidence/` string anywhere in `gsd-core/`. The `evidence/`
subdirectory is this project's own convention layered inside GSD's phase
artifact directory, and it is already the majority practice here: **17 phase
directories use it**. The `docs/phase*.md` files are the exception.

## Where the precedent came from

`docs/phase0-binmon-findings.md` was committed 2026-08-11 (`68b0a799`, "Add
Phase 0 binary-monitor de-risk findings and probe to main"). `.planning/ROADMAP.md`
did not exist until 2026-08-12. At that moment `docs/` was the only
documentation directory in the repository, so the first phase's evidence landed
there because there was nowhere else. Every later phase copied the precedent;
the rest are all `docs(NN-NN):` commits.

## What kept it alive after `.planning/` existed

`ENGINEERING_RULES.md` § 21 forbids `.planning/` paths in product source. Any
evidence that `src/**` had to cite therefore could not live in `.planning/`, and
`docs/` was the only non-planning documentation directory. The phase number rode
along in the filename.

## Why that justification has expired

§ 21.2 was tightened on 2026-09-11 on a measurement: `docs/` is packed into the
plugin zip (`scripts/package.sh` uses `git archive HEAD`) but is in **neither npm
tarball** — `@henols/vice-mcp`'s `files[]` lists 90 individual modules and
`@henols/c64-re-tools`'s lists `bin/`, `skills/`, `README.md`,
`THIRD-PARTY-NOTICES.md`. The rule concluded that a document-qualified citation
"looks like a working cross-reference and sends the reader after a file they do
not have," and banned the decision-id form.

It banned the *id*, not the *path*. So the `docs/phaseNN-*.md` pointers survived,
and they dangle for every `npx` consumer exactly as the banned form did. The
filename also carries a phase number into shipped source, which § 21's opening
sentence bans in its own right.

**The folder complaint and a live § 21 gap are the same defect.**

## Measured, 2026-09-13

- **21 of 27** files in `docs/` are `phase*`-named. The operator's own documents
  are the minority in the operator's own folder.
- **20 of the 21** map onto a live phase directory. The single orphan is
  `docs/phase0-binmon-findings.md`, which predates `.planning/` by one day, has no
  phase directory to return to, and is the most-cited of the set.
- **42 files** under `src/` and `tools/` cite `docs/phase*.md`.
- **15 of those 42** are inside Phase 51's scope (published by
  `src/mcp/vice/package.json`'s `files[]`). **27 are outside it** — tests, `.mts`
  sources, skill scripts, and the gitignored `tools/` deployment copies. Phase 51
  completing does not by itself free the files to move.

## Ordering constraint

The citation rewrite must precede the relocation. Moving the files first would
leave 42 shipped-and-unshipped files pointing into `.planning/`, which is a
straight § 21 violation — § 21.2 criterion 4 names this exact failure: repointing
at a different `.planning/` path is "the same defect one hop along." The
citations must become prose reasons, after which the files' location is free.

## Related

- `.planning/ENGINEERING_RULES.md` § 21, § 21.2
- ROADMAP Phase 51 (the shipped-module half), Phase 53 (the relocation)
- `REQUIREMENTS.md` `DOCS-01`..`DOCS-04`
