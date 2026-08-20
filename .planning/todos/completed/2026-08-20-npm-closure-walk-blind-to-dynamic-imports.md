---
created: 2026-08-20
source: phase-10 execution (plan 10-05 deviation)
severity: latent
---

# check-npm-packages.mjs's closure walk is blind to dynamic imports

`scripts/check-npm-packages.mjs:129` collects reachable modules with
`/^\s*import\s[^;]*?from\s+"(\.\/[^"]+)"/gm` — **static imports only**.

`vice-proxy.ts:218` reaches the r2000 seam via `await import("./r2000-cli.ts")`, a
dynamic import. The walk therefore never traverses `r2000-cli.ts`, `r2000-launch.ts`,
`r2000-project.ts`, `r2000-d64.ts` or `r2000-verify.ts`.

**Current state is correct, not broken:** all five modules are present in
`package.json` `files[]` and their import graph is closed. Verified 2026-08-20 at
phase-10 wave 3. The risk is that `files[]` is kept in sync **by hand** while the
guard that exists to catch drift cannot see these files — a future r2000 module
omitted from `files[]` would pass CI and ship a tarball that breaks at runtime for
both npm-installer routes (which launch via `npx`).

Not fixed in Phase 10: no plan in the phase owns `check-npm-packages.mjs`, and
widening plan 10-05's scope to cover it was declined deliberately.

**Fix options:** extend the regex to also match `import\s*\(\s*"\.\/…"\)`, or add an
explicit "these modules must be in files[]" assertion listing the dynamic-import
entry points.

## Resolution

Closed by plan `11-02` (Task 3). `check-npm-packages.mjs`'s closure walk now also
matches `import\s*\(\s*"(\.\/[^"]+)"\s*\)`, and `["r2000-cli.ts", "R2000-09"]` was
added to `REQUIRED_DERIVED_MODULES` so a future r2000 module omitted from
`files[]` fails the check by construction rather than passing silently.
