---
phase: 59-the-tool-location-seam-and-its-precedence-order
decision: placement-of-the-tool-location-seam
date: 2026-09-18
decision_ids: [D-01, D-02, D-12, D-13, D-14, D-15, D-16, D-17]
related_decisions: [DECL-01]
---

This file answers ROADMAP criterion 5 for Phase 59 in writing, rather than leaving it to be
inferred from a diff: which shape the tool-location seam took, why, and what that choice costs
Phase 60 in refactoring scope. It also records the six decisions Phase 59's plans added on top of
the eleven `59-CONTEXT.md` already recorded, in the same shape that document records its own, so a
reversal is recorded the same way a decision is.

## The answer

**The seam wraps the existing resolver externally, and Phase 59 edits no existing host-bound
module.** `src/mcp/vice/tool-location.mts` is a wholly new file. It owns the environment and
`.c64-re-tools/tools.json` layers for every one of the eight declared ids itself, and it exports
its own `$PATH` walk (`resolveOnPath()`) rather than calling `resolvedBackend()` in
`backend-detect.mts`. A location query therefore stays read-only: it writes no on-disk capability
cache and inherits no process-lifetime memo. Nothing calls this seam yet — that absence is correct,
not an oversight, and it is Phase 60's whole purpose to close it.

## Why this shape rather than the internal one

The rejected alternative was teaching `resolvedBackend()` the `tools.json` step internally and
letting it stay the sole `x64sc` authority. Both alternatives avoid the module cycle a location
query would otherwise create with `backend-detect.mts`; what they differ on is which phase pays for
the work.

Phase 60 calls itself, in its own cross-cutting constraints, "the **first** regeneration of the
committed `resources/*.mjs`
artifacts" (`.planning/ROADMAP.md:1959`), and scopes itself to treat "the byte-level sync guard as a
deliverable of this phase, not as a hazard discovered during it." Any Phase 59 edit to
`backend-detect.mts` would regenerate `resources/backend-detect.mjs` early, taking that
first-regeneration deliverable off Phase 60 in a phase this milestone's roadmap otherwise scopes as
"a module with tests." Adding a *new* artifact to `build.ts`'s `HOST_BOUND_ARTIFACTS` list — which
is all Phase 59 does — is an addition; regenerating an *existing* one is Phase 60's, and only
Phase 60's.

## What this costs Phase 60

1. **The precedence order for `x64sc` lived in two places until Phase 60 removed the second.**
   `resolvedBackend()` kept its own `env.VICE_BIN ?? "x64sc"` read for its direct callers — the
   broker's own launch path chief among them — because Phase 59 does not touch that file at all.
   Phase 60's own criterion 2, "the precedence order exists in exactly one place"
   (`.planning/ROADMAP.md:1939-1942`), was therefore a real deliverable of that phase, not
   something Phase 59 left already true. **Closed by Phase 60 plan 60-01:** that read is gone —
   `resolvedBackend()` now resolves through the seam and keeps no ordering of its own
   (`src/mcp/vice/backend-detect.mts:404-418`), and `broker-launch.mts` became a pure consumer of
   the one resolved string.

2. **Three `$PATH`-walk implementations coexisted for exactly one phase.** The seam's own exported
   `resolveOnPath()` (`src/mcp/vice/tool-location.mts:256-271`) was the third. The first two were
   untouched by Phase 59: `defaultResolveBinPath()` (`src/mcp/vice/backend-detect.mts:278-280`) and
   the fallback loop inside `findSiblingBinary()` (`src/mcp/vice/host-tool.mts:2273-2311`), whose
   own comment already says it "mirrors `defaultResolveBinPath()`'s own algorithm." Phase 60
   collapses all three into one when it rewires the live callsites — named work rather than
   rediscovered duplication. **Plan 60-01 collapsed the first:** `defaultResolveBinPath()` is now a
   one-line delegation to the seam's `resolveOnPath()`. The `findSiblingBinary()` loop is plan
   60-04's.

3. **`resolvedBackend()`'s final role is an open question Phase 59 deliberately does not pre-empt.**
   Phase 60 must decide there whether it is reduced to identity and capability caching over a path
   handed to it, or keeps a location role of its own
   (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-CONTEXT.md:55-57`).

4. **Three of the six mechanisms this tree uses are not produced by the seam yet.** Phase 59's
   probe layer is the `$PATH` walk and nothing else; the sibling-of-`x64sc` probe, the fixed-prefix
   list, and the vendored path are not implemented here, even though the seam's own `mechanism`
   type already declares all six literals so Phase 60 adds no type change when it supplies the rest
   (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:145`). Phase
   60's own criterion 4 already scopes this as "the sibling probe is **widened, not replaced**."

5. **Phase 60 regenerates both pre-existing compiled artifacts.** `resources/backend-detect.mjs`
   and `resources/host-tool.mjs` are both regenerated when Phase 60 rewires their live callsites
   through the seam, and `resources-sync.test.ts` must be green against that **regenerated and
   committed** output (`.planning/ROADMAP.md:1947`) as measured evidence, not an assertion.

## The six decisions this phase added

`59-CONTEXT.md` recorded eleven decisions (D-01 through D-11) before any plan was written. Six more
had to be settled, across plans 59-01 through 59-03, to make the seam writable at all. All six are
recorded here in the same shape `59-CONTEXT.md` records its own, so that a future reversal is
recorded the same way the original choice was.

- **D-12: a `tools.json` value is a bare string.** `{"x64sc": "/opt/vice/bin/x64sc"}`, never
  `{"x64sc": {"path": "..."}}`
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:115`). It is
  what a hand-written file most likely contains and what a doctor-emitted template most naturally
  produces for a human to read. **Cost:** `DOCTOR-F2`'s deferred per-machine layering would have
  wanted a per-entry field; adding one later means either a second file or a shape migration, and
  that migration is not silent because the file validator already refuses a non-string value by
  name. **Reversibility: one-way** — this is a user-facing file format, locked at a decision
  checkpoint rather than defaulted into.

- **D-13: the compiled-artifact proof is two proofs, and neither is a new gate.**
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:125`) The
  *runtime* half — the compiled `resources/tool-location.mjs` actually resolving
  `prerequisites.json` from its own, one-directory-deeper location — lives in the seam's own
  colocated test, using the `build()`-then-dynamic-import idiom `prerequisites.test.ts` already
  established. The *packaging* half — the artifact reaching a user who installed rather than
  cloned — extends `prerequisites.test.ts`'s existing `packedFileList()` case instead of adding a
  third npm-pack-driven test. **Cost:** none beyond the discipline of keeping both proofs in their
  existing homes rather than inventing a third.

- **D-14: the module is `src/mcp/vice/tool-location.mts`, a new `tool-location-*` domain prefix.**
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:134`) Not
  `host-tool-*` — that domain is the MCP dispatch surface, not location. **Cost:** none; this is a
  naming choice with no consumer-visible surface to migrate later.

- **D-15: this phase's probe layer is the `$PATH` walk and nothing else.** D-02 already says the
  seam owns the walk as a named export and that the two existing private copies stay untouched, so
  exactly three coexist for one phase; adding the fixed-prefix list or the vendored path here would
  have made a fourth copy and made Phase 60's collapse harder. **Cost to Phase 60:** it must supply
  the `sibling-of-x64sc`, `fixed-prefix-list` and `vendored-path`
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:145`)
  implementations when it collapses `findAcmeLib()`, `findDxaBinary()` and `findSiblingBinary()`
  into the seam — already itemised above as this section's fourth bill item.

- **D-16: an id declared `fileOverridable: false` is never resolved by this seam at all** — not
  through the environment, not through the file, not through `$PATH`
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:149`).
  `resolveTool("dxa", …)` and `resolveTool("node", …)` return `path: null`, `layer: null`,
  `mechanism: null`, `tried: []`, and the declared `reason`. A `$PATH` walk for `dxa` would hand
  back precisely the binary this project did not build and did not pin — the substitution `LOC-05`
  exists to refuse. **Cost:** none to Phase 60; this narrows what the seam will ever answer for
  these two ids, which Phase 60's rewiring must simply respect rather than route around.

- **D-17: the seam takes `toolsDir` and `projectRoot` as two separate required strings.**
  (`.planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:157`) The
  caller resolves both; the seam derives neither from the other and imports no static
  `repo-root.ts`. Deriving the project root by taking the parent of the tools directory would embed
  a layout assumption `repo-root.ts` already owns. **Cost:** every future caller — Phase 60's
  rewired callsites and Phase 61's doctor alike — must resolve and pass both strings explicitly;
  none may take the shortcut of deriving one from the other.

## Citation ledger

This ledger is machine-read by `src/mcp/vice/phase58-citation-ledger.test.ts`, which now audits
this document in addition to `docs/phase58-declaration-provenance.md`. Every distinct `file:line`
citation in this document's body must have a matching entry below, carrying an `anchor` — the exact
substring the cited line range must contain. The anchor is re-asserted against the cited file's
live text on every run.

```json
[
  { "citation": ".planning/ROADMAP.md:1959", "anchor": "the **first** regeneration of the committed" },
  { "citation": "src/mcp/vice/backend-detect.mts:404-418", "anchor": "viceBin = \"x64sc\";" },
  { "citation": ".planning/ROADMAP.md:1939-1942", "anchor": "The precedence order exists in exactly one place." },
  { "citation": "src/mcp/vice/tool-location.mts:256-271", "anchor": "export function resolveOnPath(bin: string, env: NodeJS.ProcessEnv): { path: string | null; tried: string[] } {" },
  { "citation": "src/mcp/vice/backend-detect.mts:278-280", "anchor": "function defaultResolveBinPath(bin: string, env: NodeJS.ProcessEnv): string | null {" },
  { "citation": "src/mcp/vice/host-tool.mts:2273-2311", "anchor": "function findSiblingBinary(binaryName: string, resolvedX64scPath: string, log?: (line: string) => void): { path: string | null; tried: string[] } {" },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-CONTEXT.md:55-57", "anchor": "Phase 60 must decide there whether `resolvedBackend()` is reduced to" },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:145", "anchor": "the `sibling-of-x64sc`, `fixed-prefix-list` and `vendored-path` implementations when it collapses" },
  { "citation": ".planning/ROADMAP.md:1947", "anchor": "`resources-sync.test.ts` is green against **regenerated and committed**" },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:115", "anchor": "D-12: a `tools.json` value is a bare string." },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:125", "anchor": "D-13: the compiled-artifact proof is two proofs, and neither is a new gate." },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:134", "anchor": "D-14: the module is `src/mcp/vice/tool-location.mts`." },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:149", "anchor": "D-16: an id declared `fileOverridable: false` is never resolved by this seam at all" },
  { "citation": ".planning/phases/59-the-tool-location-seam-and-its-precedence-order/59-01-PLAN.md:157", "anchor": "D-17: the seam takes `toolsDir` and `projectRoot` as two separate required strings." }
]
```
