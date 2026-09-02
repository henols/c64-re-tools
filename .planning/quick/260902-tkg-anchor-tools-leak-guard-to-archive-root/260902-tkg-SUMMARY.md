---
task: Anchor the packaging leak guard's tools/ half to the archive root
date: 2026-09-02
status: complete
commit: 5071e24
---

# Summary

The release build is unblocked. `scripts/package.sh` exits 0 and produces a 1576-file
artifact; the guard still bites on a real leak.

## What was wrong

The guard matched `/(node_modules|tools)/` anywhere in the `unzip -l` listing. Since
`git archive HEAD` packs `.planning/`, the nine phase-23 evidence files under
`evidence/tools/` were in **every** artifact, so the step failed on every push. Measured
at both HEAD and the last-pushed commit `c8da604`: **9 matching paths each** — identical,
which is what established this as pre-existing rather than fallout from the v0.7.0 close
or the name erasure that preceded it.

## The fix

The two halves mean different things and are now anchored differently:

- **`node_modules/` — forbidden at ANY depth.** A vendored dependency tree is never
  legitimate in this artifact wherever it sits.
- **`tools/` — forbidden ONLY at the archive root.** That is what the name means here:
  `<project>/tools/` is the gitignored directory `install-resources.ts` deploys the host
  launcher scripts into. A directory called `tools` nested anywhere else is an ordinary
  directory.

Listing moved from `unzip -l` to `unzip -Z1` (zipinfo mode, one bare path per line), so
the patterns match **paths** rather than a rendered table. A trip now prints the
offending paths: a guard that cannot say what it found is a guard that gets switched off,
which is exactly the pressure this one was under.

The drift cause is recorded in the guard's own comment block, so the next reader does not
re-widen it back to the substring match.

## Evidence

| Check | Result |
|---|---|
| `bash scripts/package.sh` | exit 0, 1576 files |
| Planted `tools/PLANTED-LEAK.mjs` at archive root | **exit 1**, both paths named |
| Predicate vs. 8 synthetic paths | 4 trip (root `tools/`, its dir entry, `node_modules/` at 2 depths), 4 pass (2 phase-23 evidence paths, `docs/tool-support.md`, `anno-tools.ts`) |

The planted proof ran on a throwaway branch: a real leak needs a **tracked** file and
`tools/` is gitignored, so the plant required a commit. Branch deleted afterwards,
`dist/` removed, and `tools/`'s nine real deployment scripts verified intact.

## Notes

- Local packaging is separately blocked by `.claude/skills/` existing at the repo root —
  the layout validator rejects its presence so the payload cannot activate by repo-root
  auto-discovery. It is gitignored and CI never has it. It was moved aside for each local
  run and restored immediately; it is **not** a defect in this script.
- Not verified: that CI now goes green end to end. The step is proven locally and by the
  planted red, but the next push is what confirms the release actually publishes.
