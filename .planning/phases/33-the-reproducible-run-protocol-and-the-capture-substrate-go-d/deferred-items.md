# Deferred items — Phase 33

Out-of-scope discoveries logged rather than fixed, per the executor's scope
boundary (only auto-fix what the current task's changes caused).

## D1 — `scripts/check-npm-packages.mjs` is RED, from plan 33-06

**Found during:** plan 33-08, task 2 verification (the plan's packaging check).

**Symptom:**

```
$ node scripts/check-npm-packages.mjs   # exit 1
check-npm-packages: FAIL

  - vice-mcp: broker-launch.mts is imported by vice-broker-client.ts but is not
    in the published tarball -- Rule 2 (see 6801cf5, 897faf6)
```

**Cause, traced:** commit `11f897d` (*feat(33-06): thread the launch profile from
the acquire op to argv, with D-16 eligibility*) added
`import type { LaunchProfile } from "./broker-launch.mts";` at
`src/mcp/vice/vice-broker-client.ts:39`. `vice-broker-client.ts` is in
`src/mcp/vice/package.json`'s `files[]`; `broker-launch.mts` is not — it is one
of the host-bound `.mts` sources compiled into the committed `resources/*.mjs`,
and those `.mts` sources are deliberately unpublished. The checker's transitive
closure walk over `files[]` therefore fails the pack.

**Why it is not fixed here:** `src/mcp/vice/package.json` is not among plan
33-08's declared files, the import was introduced two waves earlier, and the
repair is a real design choice rather than a typo — either publish
`broker-launch.mts` alongside the two `.mts` siblings already in `files[]`
(`container-guard.mts`, `backend-detect.mts`), or teach the checker that a
type-only import is erased by Node's type-stripping and reaches nothing at
runtime. Choosing between those belongs to whoever owns the packaging contract.

**Blast radius today:** none at runtime. `import type` is erased, so the
published `@henols/vice-mcp` works. What is broken is the *gate*, which is now
red for every later plan in this phase and will mask a genuine packaging leak
until it is cleared.

**Verified independent of 33-08:** the plan's own contribution to that tarball
was checked directly —
`npm pack --dry-run --json` in `installer/` ships
`skills/c64-ram-capture/scripts/derive-transients.mjs` and
`skills/c64-ram-capture/transients/README.md`, and ships **no** `*.test.mjs`
file. Nothing this plan added leaks.

**RESOLVED 2026-09-03 — closed by plan 33-09, commit `fc199e7`.** The gate is
green (`node scripts/check-npm-packages.mjs` exit 0). The repair was **not** the
obvious one: adding `broker-launch.mts` to `files[]` cascades, because the
host-bound `.mts` broker family imports its siblings by their *compiled* `.mjs`
specifiers, which exist only under `resources/` and never at the package root —
so listing it demands three entries no file can satisfy. The actual defect was
the closure walk treating a statement-level `import type` (fully erased under
`verbatimModuleSyntax`) as a shipping edge; `fc199e7` stops walking those while
still walking inline `import { type Foo, Bar }`, which does emit an import. A
negative control confirmed the walk still catches a genuinely missing file.

Recorded here rather than deleted: this entry is the provenance for why
`check-npm-packages.mjs` has an `import type` carve-out at all.
  status: acknowledged
