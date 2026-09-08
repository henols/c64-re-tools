---
phase: 40-the-three-preprocessing-host-tools
reviewed: 2026-09-08T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - CLAUDE.md
  - docs/phase40-preprocessing-tools-decisions.md
  - .gitignore
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/ensure-mcp-deps.sh
  - scripts/lib/skill-descriptions.mjs
  - src/mcp/vice/build.ts
  - src/mcp/vice/containerpath.test.ts
  - src/mcp/vice/d64-single-route.test.ts
  - src/mcp/vice/docs-linerefs.test.ts
  - src/mcp/vice/dxa-live.test.ts
  - src/mcp/vice/dxa-seam.test.ts
  - src/mcp/vice/fixtures/c1541/README.md
  - src/mcp/vice/fixtures/petcat/README.md
  - src/mcp/vice/ghidra-live.test.ts
  - src/mcp/vice/ghidra-opcode-live.test.ts
  - src/mcp/vice/ghidra-project.mts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-scripts.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool-oracle.test.ts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/incident-record.test.ts
  - src/mcp/vice/incident-record.ts
  - src/mcp/vice/install-resources.test.ts
  - src/mcp/vice/install-resources.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/prg-image.ts
  - src/mcp/vice/repo-root.test.ts
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/skill-basic-trigger.test.ts
  - src/mcp/vice/skill-honesty-checks.test.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-machine.test.ts
  - src/mcp/vice/stock-paths.test.ts
  - src/mcp/vice/stock-paths.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-proxy.test.ts
  - src/mcp/vice/vice-proxy.ts
  - src/mcp/vice/vsf-slice.ts
  - src/skills/c64-disk-access/scripts/c1541.mjs
  - src/skills/c64-disk-access/scripts/c1541.test.mjs
  - src/skills/c64-disk-access/SKILL.md
  - src/skills/c64-petcat/scripts/petcat.mjs
  - src/skills/c64-petcat/SKILL.md
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-provenance-diff/scripts/recovery-schema.mjs
  - src/skills/c64-ram-capture/scripts/derive-transients.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
  - src/skills/c64-ram-capture/SKILL.md
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-09-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

Phase 40 adds five `c1541.*` host-tool ids plus `petcat.decode` behind the
existing `host_tool` execution seam, consolidates six scattered tool-written
locations under one `.c64-re-tools/` root, and deletes the two hand-written
`.d64` parsers (`anno-d64.ts`, `d64-parse.mjs`) in favour of `c1541` as the
one disk-image route. I read the new/changed argument-narrowing, path-
confinement, argv-construction and classifier code in `host-tool.mts` in
full, the two new skill scripts (`c1541.mjs`, `petcat.mjs`), the new
`d64-single-route.test.ts` mechanical guard, and cross-checked the
`.c64-re-tools/` consolidation across `repo-root.ts`, `install-resources.ts`,
`incident-record.ts`, `vice-broker.mts`, `vice-proxy.ts`, `ensure-mcp-deps.sh`
and `.gitignore`.

The security-sensitive core (`resolveWorkspacePath()`'s symlink-aware
confinement, argv-array construction with no shell, the `name`
leading-hyphen refusal, never-throw discipline, exit-status-is-never-the-
oracle) is sound and matches the header comments' own stated guarantees. No
BLOCKER-level defects were found: no injection route, no workspace escape,
no silent-mutation path. The findings below are narrower correctness/
robustness gaps: a stale-output-collision risk in `c1541.read`'s filename
slugging, an unvalidated address range in `petcat.decode`'s entry-point
resolution, an unbounded stdout accumulation for a tool spawned against
attacker-influenced disk images, and a guard added to `c1541.mjs` (fixing a
real bug discovered mid-phase) that was not carried over to the sibling
`petcat.mjs`, which has an identical structural risk.

## Warnings

### WR-01: `c1541.entry`/`chain`/`read` output filenames can collide on different CBM names, letting a failed call report a stale prior result as success

**File:** `src/mcp/vice/host-tool.mts:1590-1624`
**Issue:** The output path for `c1541.entry`/`c1541.chain`/`c1541.read` is
built from `slug = name.replace(/[^A-Za-z0-9]/g, "_").slice(0, 32)`
(`host-tool.mts:1597`), then joined as
`` `${imageStem}.${slug}.<verb>.txt` `` / `` `${imageStem}.${slug}.bin` ``.
Two different CBM names that differ only in punctuation or in characters
past the 32nd retained character (e.g. `"A:B"` and `"A B"`, or two names
that agree on their first 32 alphanumeric characters) collapse to the same
output path for the same `image`/`outDir` pair.

For `c1541.entry`/`c1541.chain` this is harmless in practice because
`runHostTool()` unconditionally `writeFileSync`s the *current* invocation's
captured stdout to that path before digesting it (`host-tool.mts:2604-2613`),
so a colliding call always overwrites with its own fresh (possibly empty)
output.

For `c1541.read`, however, the output file is written by the **child
process itself** (`argv: ["-attach", imagePath, "-read", name, outputPath]`,
`host-tool.mts:1624`) — this module never pre-clears `outputPath` before
spawning. If a prior successful `c1541.read` call for a different `name`
that collides on the same `slug` left a valid, non-empty file at that exact
path, and a later call for the colliding name fails inside `c1541` (e.g.
because that name does not actually exist) without `c1541` truncating or
recreating the file, `classifyC1541ReadOutput()` will find a pre-existing
file at `outputPath` with `byteLength > 0` and report `ok: true` — silently
attributing a previous, unrelated read's bytes to the new, failed request.
This is exactly the "report success having asserted nothing real" failure
mode this codebase's own header comments elsewhere name as unacceptable
(e.g. `host-tool.mts:766-767`).
**Fix:** Unlink `outputPath` (best-effort, ignoring `ENOENT`) immediately
before spawning the `c1541.read` child, so a failed run can never be
digested as a stale success:
```ts
if (request.tool === "c1541.read") {
  try { rmSync(outputPath, { force: true }); } catch { /* best-effort */ }
}
```
placed in `runHostTool()` just before `spawnHostTool()` is called for this
tool, or alternatively derive the slug from a hash of the full `name` rather
than a truncated character-class filter, to remove the collision itself.

### WR-02: `petcat.decode`'s resolved `SYS` entry point is not range-checked against the C64's 16-bit address space

**File:** `src/mcp/vice/host-tool.mts:2016-2034`
**Issue:** `derivePetcatEntrypoint()` accepts any all-decimal-digit `SYS`
argument as a literal entry point via `Number(argument)`
(`host-tool.mts:2022-2026`) with no upper-bound check. A BASIC program can
legally contain `SYS 999999` or an even larger decimal literal; `Number()`
will happily convert an arbitrarily long digit string (with silent
precision loss past 2^53, e.g. `Number("99999999999999999999")` yields
`1e20`), and the response's `entrypoint` field is documented and consumed
downstream (`c64-petcat/SKILL.md`, `c64-program-recon/SKILL.md`) as "the
address the program hands over to" — i.e. it is expected to be spent
directly on a disassembler. An out-of-range or precision-lossy value passed
through as a real entry point without a stated reservation is a bug of
exactly the same shape `LOADER_BASE_ADDR_PATTERN`/`RUN_ID_PATTERN` exist
elsewhere in this file to prevent for other numeric/opaque fields.
**Fix:** Bound the accepted literal to `0..65535` (the C64's real address
space) and report anything outside that range through the same
`entrypointReason` decline path used for a non-literal expression, e.g.:
```ts
if (/^\d+$/.test(argument)) {
  const value = Number(argument);
  if (Number.isSafeInteger(value) && value >= 0 && value <= 0xffff) {
    return { entrypoint: value, entrypointReason: `literal SYS argument on BASIC line ${basicLine}: sys${argument}` };
  }
  return { entrypoint: null, entrypointReason: `SYS argument on BASIC line ${basicLine} (${argument}) is outside the C64's 16-bit address space and cannot be a real entry point` };
}
```

### WR-03: `spawnHostTool()`'s stdout accumulation is unbounded, and `c1541.chain`/`c1541.bam` run directly against untrusted, possibly-corrupt disk images

**File:** `src/mcp/vice/host-tool.mts:2115-2117`, `1848-1855`
**Issue:** `child.stdout.on("data", ...)` appends every chunk to an
in-memory string with no size cap; the only bound on a runaway child is the
20s `DEFAULT_HOST_TOOL_TIMEOUT_MS` wall-clock kill. The code's own comment
at `host-tool.mts:1848-1855` already flags this as a known gap
("`spawnHostTool()`'s own stdout accumulation has no explicit bound today,
and a sector chain (`c1541.chain`) is the first disk-image-driven input
that could make it large") but only caps the *classifier's* read window
(`STDOUT_CLASSIFY_CAP_BYTES`), not the accumulation itself. This project's
own audit tooling (`c1541.mjs`'s `runAudit()`) explicitly exists to detect
disk images with *fabricated or cyclic directory structures* — i.e. this
tool is routinely pointed at adversarial or corrupted `.d64` images by
design. If `c1541 -chain` does not itself guard against a cyclic **data**
sector chain (distinct from the *directory* chain guard this project's own
`auditEntries()` implements client-side), a crafted image could drive
`c1541` to print output for the full 20-second timeout window, growing the
buffered string without bound in that time.
**Fix:** Cap the accumulated `stdout`/`stderr` buffers in `spawnHostTool()`
at a fixed ceiling (e.g. drop/stop appending past `STDOUT_CLASSIFY_CAP_BYTES`
or a slightly larger hard ceiling, keeping the tail since that is what the
classifiers and `stderrTail` already consume), independent of the timeout,
so a pathological child cannot grow unbounded memory even within its
allotted time budget.

### WR-04: `petcat.mjs` is missing the entry-point guard `c1541.mjs` needed for the identical reason

**File:** `src/skills/c64-petcat/scripts/petcat.mjs:189-204`
**Issue:** `c1541.mjs` has an explicit guard around its CLI dispatch
(`c1541.mjs:547`): `if (process.argv[1] && resolve(process.argv[1]) ===
fileURLToPath(import.meta.url)) { ... }`, with a comment explaining this was
a **fix for a real bug discovered mid-execution** in this same phase (plan
40-04): without it, importing the module for its pure exported functions
(as `c1541.test.mjs` does) would execute the CLI dispatch as an import side
effect, using the test runner's own `process.argv` and calling
`process.exit(0)` before any test ever registers.

`petcat.mjs` has the exact same shape — a top-level `const [cmd, ...rest] =
process.argv.slice(2); ... await VERBS[cmd](rest);` with no entry-point
guard (`petcat.mjs:189-204`) — but was never given the fix. Today nothing
imports `petcat.mjs` as a module (confirmed by grep across `src/` and
`scripts/`), so this is latent rather than live, but the lesson that
produced the `c1541.mjs` fix applies here verbatim, and the omission means
the next person who writes a `petcat.test.mjs` importing
`derivePetcatEntrypoint`-equivalent helpers (there are none exported today,
but a natural next step) reintroduces the exact bug this phase already
found and fixed once.
**Fix:** Add the same guard to `petcat.mjs`, mirroring `c1541.mjs` verbatim:
```js
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const VERBS = { decode: (argv) => runDecode(argv) };
  if (!cmd || !VERBS[cmd]) { /* usage */ process.exit(cmd ? 1 : 0); }
  await VERBS[cmd](rest);
}
```

## Info

### IN-01: `petcat.mjs` has no dedicated test file, unlike its sibling `c1541.mjs`

**File:** `src/skills/c64-petcat/scripts/petcat.mjs`
**Issue:** `c1541.mjs` ships with a substantial `c1541.test.mjs` (pure-unit
tier plus two live-gated tiers). `petcat.mjs` — added in the same phase,
wrapping the same host-tool seam pattern — has no test file at all in the
required-reading set or on disk (confirmed: no `petcat.test.mjs` exists
under `src/skills/c64-petcat/`). The parsing logic it would need to cover
(`derivePetcatEntrypoint`'s regex-based SYS-argument extraction) lives
host-side in `host-tool.mts` and is tested there, but the skill script's own
CLI plumbing (`parseOpts`, `report`, `runDecode`) is untested.
**Fix:** Add a `petcat.test.mjs` mirroring `c1541.test.mjs`'s tier
separation (pure CLI-option parsing tests that need no `petcat` binary, plus
a live-gated end-to-end case against the committed fixtures under
`fixtures/petcat/`).

### IN-02: `c1541.entry`/`chain`/`read`'s `name` validation refuses a leading hyphen but not other c1541-CLI-significant characters

**File:** `src/mcp/vice/host-tool.mts:895-904`
**Issue:** `normaliseHostToolRequest()` refuses `name.startsWith("-")` to
stop `c1541`'s own CLI from reading a caller-supplied name as a flag. This
covers the specific argument-injection vector the comment names, but is a
narrow, single-character heuristic rather than a general validation of what
a CBM filename/glob can legitimately contain. It is not a security gap
(argv is an array, never shell-interpreted, so this is scoped to
`c1541`'s *own* argument parser misreading a value, not to the OS shell),
but a value that is empty after CBM-to-slug normalization, or one
containing control characters, is passed straight through to `c1541`
unexamined beyond the hyphen check.
**Fix:** Consider whether `c1541`'s own CLI has any other flag-introducing
sentinel besides a leading hyphen (e.g. does it ever treat a bare `--` or an
argument matching a known verb name specially); if not, no change is
needed beyond documenting that the hyphen check is deliberately the only
one, which the current comment already does reasonably well.

---

_Reviewed: 2026-09-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
