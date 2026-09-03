---
created: 2026-09-03T20:20:00.000Z
title: CR-05 — resolveWorkspacePath() is symlink-blind, reintroducing a bug class this repo already fixed
area: host-tool-seam
severity: critical
source_review: .planning/phases/34-the-host-tool-execution-seam/34-REVIEW.md
finding_ids:
  - CR-05
files:

  - src/mcp/vice/host-tool.mts:370-386
  - src/mcp/vice/host-tool.mts:780-843
  - src/mcp/vice/host-tool.mts:1013-1017
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/anno-types.ts:1082
  - src/mcp/vice/anno-types.ts:1195-1196
---

## Why this is a todo and not a Phase 34 gap-closure plan

`CR-05` was raised by the code review that ran **after** Phase 34's gap-closure
round (`34-07`..`34-09`) had already landed and closed `CR-01`..`CR-04`. It is
not a gap in what those three plans set out to do — all four of their targets
verified closed in code. It is a **newly discovered defect in the seam they were
built on**, found only because the post-closure review looked at
`resolveWorkspacePath()` itself rather than at its callers.

Closing it is a security-boundary change with its own test requirements (a real
planted symlink on disk, per this repo's own `anno-confinement.test.ts`
discipline), so it needs a plan, not an unplanned edit folded into a
`--gaps-only` execution run. Deferring it here rather than fixing it inline is
what keeps the Phase 34 record honest: the phase closed the gaps it was given,
and this is new scope discovered at its edge.

## Problem

`resolveWorkspacePath()` is `host-tool.mts`'s own declared single seam — its
header calls it "the ONLY place a wire-supplied path becomes a real path"
(lines 34-37). It enforces the workspace boundary **lexically**:

```ts
const rootAbs = resolvePath(repoRoot);
const resolved = resolvePath(rootAbs, relative);
if (resolved !== rootAbs && !resolved.startsWith(rootAbs + sep)) {
  return { ok: false, message: `workspace path escapes the workspace root: ...` };
}
return { ok: true, path: resolved };
```

`resolvePath` is Node's `path.resolve` — pure string normalisation. It never
touches the filesystem and never follows a symbolic link. With a symlink
anywhere on the ancestor chain (`<repoRoot>/link -> /etc`), a supplied
`source: "link/hostname"` resolves lexically to `<repoRoot>/link/hostname`,
passes `startsWith(rootAbs + sep)`, and is returned as `ok: true` — while the
file the OS actually opens is `/etc/hostname`.

`grep -c realpath src/mcp/vice/host-tool.mts` is **0**.

**This repo already found and fixed this exact bug class once.**
`anno-types.ts`'s `storePathWithinWorkspace()` (`28-REVIEW.md` CR-03/CR-04)
resolves **both** the candidate and the root through
`realpathOfNearestExisting()` (`anno-types.ts:1082`, used at `:1195-1196`), an
ancestor walk that follows real links and handles the dangling case. Its own
comment at `:1159` states that both sides going through it "is the" load-bearing
property. The new seam reintroduces the vulnerable shape with none of that
mitigation.

**Blast radius is write, not just read.** All seven keys in
`HOST_TOOL_PATH_ARG_KEYS` are affected (the census at `host-tool.test.ts:1220`
pins the total at 7), and two are write destinations:

- `acme.build`'s `outDir` — becomes ACME's `-o`/`-l`/`--vicelabels`/`-r` output
  directory, so a planted symlink lets the **host broker process write**
  assembler output anywhere its user can write.
- `oracle.run`'s `source` — an arbitrary host file's bytes come back through the
  oracle's stdout capture.
- `ghidra.analyze`'s `preScript`/`postScript` — now workspace-bounded by CR-02's
  fix, but still symlink-blind, so an arbitrary host script can be selected for
  `analyzeHeadless` to execute inside the JVM session.

The word "symlink" appears in **no** file in this module family — there is no
test that plants one.

## Solution

Mirror the already-reviewed `anno-types.ts` fix: run both sides through an
ancestor-realpath walk before the prefix comparison, and return the realpath
(not the lexical join) as the `ok: true` result — the same shape
`storePathWithinWorkspace()` returns for exactly this reason.

Either export and reuse `realpathOfNearestExisting()` from `anno-types.ts`, or
implement the equivalent discipline locally. Reuse is preferable: a second
independent implementation of a security walk is a second thing to keep correct,
and this project's stated convention is one authoritative seam per concern.

Add a **live** planted-symlink test to `host-tool.test.ts` — a real link on
disk, mirroring `anno-confinement.test.ts`, not a synthetic string — covering at
least one read key (`acme.build`'s `source`) and one write key
(`acme.build`'s `outDir`), so the class is provably closed rather than asserted
closed.

Constraints to respect:

- `host-tool.mts` is `.mts`, compiled by `build.ts` into the committed
  `resources/host-tool.mjs`; `resources-sync.test.ts` fails CI on drift. Any
  edit requires regenerating and committing that artifact.
- `resolveWorkspacePath()`'s callers assume the returned path is what gets
  spawned. Returning the realpath changes what lands in argv — verify the
  `buildHostToolArgv()` ordering and no-passthrough tests added by `34-07` and
  `34-08` still hold.
- The `SEAM-02` requirement is marked Complete on the strength of the typed
  allowlist and no-argv-passthrough properties, which remain true. This finding
  is about the boundary check *behind* those properties, so re-scoring SEAM-02
  is a judgement call for whoever picks this up, not an automatic revert.

Suggested vehicle: `/gsd-quick` if scoped tightly to the seam plus its two
tests; a planned phase slice if the SEAM-02 re-scoring question is taken up at
the same time.
