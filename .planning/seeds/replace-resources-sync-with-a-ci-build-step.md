---
title: Wire `node build.ts` into CI to replace what resources-sync.test.ts used to catch
trigger_condition: When the byte-identical removal lands, or the first time a committed `resources/*.mjs` is found stale against its `.mts` source — whichever comes first.
planted_date: 2026-09-13
---

# The stale-build hole the byte-identical removal opens

Owner decision 2026-09-13: every byte-identical assertion is removed, `resources-sync.test.ts`
included. This seed records what that specific removal costs and the cheapest way to get the
property back WITHOUT a byte-comparison test, since those are no longer wanted.

## What it caught

`resources/*.mjs` is **committed build output**, not authored source — `build.ts` compiles the
host-bound `.mts` modules into it because the host side runs on a bare Node that cannot be
assumed to type-strip (see [[typescript-everywhere-and-the-node-floor]]). The test drove
`build.ts`'s own `build()` entry point into a scratch directory and compared.

Its own header states the scenario it existed for, verbatim: *"developer edits .mts, forgets to
rebuild, commits the stale resources/ tree"* — making a stale committed build "a test FAILURE
rather than a silent bad deploy."

That path is real and is exercised routinely: the node-interpreter quick task (`260913-o1w`)
edited `vice-broker.mts` and had to rebuild and commit `vice-broker.mjs` in the same commit.

## What replaces it, without a byte-identical assertion

Run the build in CI and fail on a dirty tree:

```yaml
- run: node build.ts
  working-directory: src/mcp/vice
- run: git diff --exit-code -- src/mcp/vice/resources/
```

This is not a byte-identical *test*; it is the build itself plus a working-tree cleanliness
check, which is the ordinary way generated-and-committed artifacts are guarded. It gives the
same protection with no comparison assertion in the suite, and it catches the case the test
could not: a build that is non-deterministic across environments.

Note the ordering constraint if both land: CI must run `node build.ts` from `src/mcp/vice/`,
and the committed tree must be regenerated and committed first, or the very first CI run after
the change goes red on pre-existing drift rather than on anything new.

## The residual either way

Nothing in this arrangement notices a `.mts` edit that is committed WITHOUT running the build
locally, until CI says so. That is a slower feedback loop than the test provided. Accepted as
part of the removal decision, recorded here rather than left to be rediscovered.
