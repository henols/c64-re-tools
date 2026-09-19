## Deferred Items

- `phase58-citation-ledger.test.ts` fails: `.planning/PROJECT.md:2083: anchor "a user missing ACME should learn that" not found in cited range`
  status: open
  **What:** Pre-existing citation-ledger drift in `.planning/PROJECT.md`, unrelated to plan 62-01's files (`broker-control.mts`, `broker-endpoint.ts`, and their tests). Confirmed present when running `phase58-citation-ledger.test.ts` in isolation, on a tree where `.planning/PROJECT.md` carries no uncommitted changes and was last touched by a commit (`b45892c3`) that predates this phase entirely. Out of scope for plan 62-01 per the executor's scope-boundary rule — not fixed here.
