---
created: 2026-09-13T00:00:00.000Z
title: vice-proxy.test.ts leaks scratch dirs into the .planning/ root
area: testing
severity: minor
files:

  - src/mcp/vice/vice-proxy.test.ts:4720-4728
---

# `vice-proxy-evidence-test-*` accumulates in `.planning/`

Found during `/gsd-explore` on 2026-09-13, while auditing generated artifacts
landing in curated trees. Same contamination class as phase evidence in `docs/`,
different tree.

**Observed:** 14 `vice-proxy-evidence-test-*` directories sitting in the
`.planning/` root. All empty, all untracked, and **none of them gitignored** —
`git check-ignore` exits 1 on them, so they show up as noise in `git status` and
in any tree walk over `.planning/`.

**Writer:** `tmpWorkspaceIncidentsDir()` at `src/mcp/vice/vice-proxy.test.ts:4720`.
It calls `mkdtempSync(join(repoRoot(), ".planning", "vice-proxy-evidence-test-"))`.
The base must be inside the resolved workspace root because these fixtures need a
real path translation to succeed end to end — that part is deliberate and correct.

**Why they survive:** the helper's own comment says "Cleaned up by the caller's
own finally block, same as `tmpIncidentsDir()`." A `finally` block does not run
when the process is killed, and this suite is the known hanger — `npm test` over
the full glob blocks forever on `vice-proxy.test.ts`, so the practical workflow
is to interrupt it. Every interrupted run strands another directory. Confirm this
is the mechanism before fixing; the alternative is a caller that simply lacks the
`finally`.

**Candidate remedies, in preference order:**

1. Best-effort reap of stale `vice-proxy-evidence-test-*` at suite startup, so an
   interrupted run self-heals on the next one. A `finally` cannot cover a kill;
   a startup sweep can.
2. Move the base under `.c64-re-tools/` — the project's existing tool-written root
   — if a path there still satisfies the workspace-root translation the fixtures
   need. That tree is already gitignored, which removes the `git status` noise too.
3. Failing both, gitignore the pattern. Weakest option: it hides the leak rather
   than stopping it, and leaves real directories accumulating on disk.

Note the related standing hazard: `/tmp` on this host is a tmpfs whose cleanup is
disabled, so relocating the scratch to `/tmp` trades a visible leak for an
invisible RAM one. Do not take that route.

**Also delete the 14 existing directories** — they are untracked and empty, so
removal is safe, but check for non-empty ones first.

## Resolution

Closed 2026-09-15 as MOOT, not as corrected.

Commit `d8ed053e` ("test(55-03): delete the proxy-local recycle test block,
paired to its successors") deleted the writer this file's frontmatter names,
`tmpWorkspaceIncidentsDir()`. Nothing recreates `vice-proxy-evidence-test-*`
directories now.

A repository-wide grep for the identifier `tmpWorkspaceIncidentsDir`, over
`*.ts`, `*.mts` and `*.mjs`, outside `node_modules`, returns nothing. A
separate grep for an `mkdtemp` call rooted at `.planning`, over the same file
types, also returns nothing.

All three candidate remedies this file proposed are therefore moot: the
startup reap, the relocated base, and the gitignore rule. None is needed
because the writer that would have required any of them no longer exists.

A quick task's Task 1 checked the 19 directories that had accumulated by
2026-09-15 as empty, one emptiness check per directory, and deleted all 19.
That closes this file's own final instruction ("Also delete the 14 existing
directories").

Nobody added the pattern to `.gitignore`. With no writer, there is nothing
left to ignore, and an ignore rule would only hide a real recurrence instead
of surfacing one.
