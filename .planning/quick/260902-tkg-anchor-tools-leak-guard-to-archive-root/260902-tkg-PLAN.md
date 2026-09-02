---
task: Anchor the packaging leak guard's tools/ half to the archive root
date: 2026-09-02
mode: quick
---

# Anchor the packaging leak guard's `tools/` half to the archive root

## Context

CI's `Build installable package` step has been RED on every push since at least
2026-08-29, so no version could ship — `publish-npm`, `release-on-merge` and `release`
are all gated behind it and never ran.

The cause is a false positive, not a leak. `scripts/package.sh`'s guard matched
`/(node_modules|tools)/` anywhere in the zip listing. `git archive HEAD` packs the whole
tracked tree including `.planning/`, which carries nine committed phase-23 evidence
files under `evidence/tools/` — an ordinary directory that happens to share a name with
the thing the guard protects against. The count is identical before and after the
v0.7.0 close, confirming this predates any recent work.

## Tasks

1. Anchor the two halves separately, because they mean different things: `node_modules/`
   forbidden at ANY depth, `tools/` forbidden ONLY at the archive root (that is what the
   name means here — the gitignored `<project>/tools/` host-launcher deployment target).
2. List via `unzip -Z1` so the patterns match paths rather than a column-formatted table.
3. Make a trip name the offending paths.
4. Record the drift cause in the guard's own comment, so a future reader does not
   re-widen it.

## Verify

- `bash scripts/package.sh` exits 0 and produces the artifact.
- A **planted** `tools/` file at the archive root takes the guard RED, naming the path.
- The phase-23 evidence paths no longer trip it.
