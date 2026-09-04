---
phase: 35-dxa-vendored-and-parsed
reviewed: 2026-09-04T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - .gitignore
  - src/mcp/vice/dxa-blocks.ts
  - src/mcp/vice/dxa-blocks.test.ts
  - src/mcp/vice/dxa-build-gate.test.ts
  - src/mcp/vice/dxa-listing.ts
  - src/mcp/vice/dxa-listing.test.ts
  - src/mcp/vice/dxa-live.test.ts
  - src/mcp/vice/dxa-partition.ts
  - src/mcp/vice/dxa-partition.test.ts
  - src/mcp/vice/dxa-run.ts
  - src/mcp/vice/dxa-seam.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/test-gate.mjs
  - src/mcp/vice/test-gate.test.ts
  - src/mcp/vice/THIRD-PARTY-NOTICES.md
  - src/mcp/vice/vendor/dxa/build.bash
  - src/mcp/vice/vendor/dxa/README.md
  - src/mcp/vice/fixtures/dxa/README.md
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-09-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21 (`fixtures/dxa/fixture.a` is a binary ACME source file and could not be read as text; `vendor/dxa/*.c/.h/Makefile` etc. are out of scope per the workflow's own scope notes)
**Status:** issues_found

## Summary

Phase 35 vendors `dxa` 0.1.5 behind a digest-gated build script, adds a
listing parser (`dxa-listing.ts`), a two-tier ground-truth partitioner
(`dxa-partition.ts`), a `-B`/`-l` emitter (`dxa-blocks.ts`), and wires all of
it through the existing `host-tool.mts` seam via `dxa-run.ts`. The hermetic
test suite (118 cases across the six automated `dxa-*`/`host-tool*` test
files) and the four opt-in live tests against the actually-built, pinned
`vendor/dxa/dxa` binary all pass; the documented per-file sha256 provenance
in `fixtures/dxa/README.md` was independently re-verified against the files
on disk and matches exactly. `build.bash`'s digest-over-exit-status
discipline and the pin-before-fetch ordering are correctly implemented and
covered by `dxa-build-gate.test.ts`.

However, `dxa-run.ts` — the one module this phase adds that performs its own
direct filesystem I/O outside the `host-tool.mts` seam's confinement — has no
workspace-boundary check on the caller-supplied `image`/`outDir` fields
before using them in a local `readFileSync`/`writeFileSync`. This is a real,
reproduced path-traversal gap (see CR-01), inconsistent with the rest of this
project's (and this same phase's sibling module `host-tool.mts`'s) rigorous
`resolveWorkspacePath()` discipline. A second, also-reproduced defect in
`dxa-blocks.ts` lets a non-integer/`NaN` address silently corrupt the emitted
`-B` file instead of refusing by name, contradicting that module's own stated
design philosophy.

## Critical Issues

### CR-01: `dxa-run.ts` performs unconfined filesystem read and write from caller-supplied "workspace-relative" paths — reproduced path traversal

**File:** `src/mcp/vice/dxa-run.ts:118-120` (read) and `src/mcp/vice/dxa-run.ts:164-173` (write)

**Issue:** Every path-bearing field this project accepts from a caller is
supposed to be confined to the workspace root through
`resolveWorkspacePath()` (`host-tool.mts:647-670`) — the module's own header
calls this "the ONLY place a wire-supplied path becomes a real path," and
`host-tool.mts` applies it to every one of `dxa.disassemble`'s five
path-bearing keys, including `datablocksPath`/`labelsPath` when a caller
supplies them directly.

`dxa-run.ts` bypasses that confinement for its own two direct filesystem
operations, both of which run BEFORE (and independently of) the eventual
`host_tool` wire call:

1. `readLocalImageBytes()` (`dxa-run.ts:118-120`) does
   `readFileSync(join(root, relativePath))` with no check that the joined
   path stays inside `root`. It is called unconditionally at
   `dxa-run.ts:133` with the caller's raw `args.image`.
2. The `knownDataRows` branch (`dxa-run.ts:145-174`) computes
   `outDirRelative = args.outDir ?? dirname(args.image)`, builds
   `blocksRelPath`/`labelsRelPath` from it, and calls
   `emitDataBlocks(args.knownDataRows, join(root, blocksRelPath))` /
   `emitLabels(args.knownDataRows, join(root, labelsRelPath))`
   (`dxa-blocks.ts`'s `writeFileSync`) with no boundary check either.

I reproduced both directions live. A relative `outDir` of the form
`"../<sibling-dir-name>"` combined with `knownDataRows` writes an
attacker/caller-controlled `-B` file **outside** the declared workspace root:

```
wire args sent to host_tool: {
  image: 'x.prg',
  imageKind: 'prg',
  datablocksPath: '../dxa-traversal-outside-e4tdIb/x.dxa-blocks.txt',
  outDir: '../dxa-traversal-outside-e4tdIb'
}
escaped file exists outside workspace root? true
contents: 1000-1fff
```

The write happens via `dxa-blocks.ts`'s plain `writeFileSync` before the
(would-be) wire call to `host_tool` ever runs — so even though
`host-tool.mts`'s own `resolveWorkspacePath()` would separately refuse a
`datablocksPath` that escapes the root, the arbitrary write has already
landed on disk by the time that refusal could happen.

The read side is symmetric: an `image` value of `"../<sibling>/secret.prg"`
causes `readLocalImageBytes()` to read a file entirely outside the
workspace root (confirmed: `parsePrg()` successfully parsed a 4-byte file
placed in a sibling temp directory, proving the read crossed the boundary).

At this milestone `dxa-run.ts` has no wire-facing/LLM-facing entry point
(per `vendor/dxa/README.md`'s own A-06 packaging note: "no MCP tool, no
`anno` CLI verb, no skill route"), so today's blast radius is limited to
whatever in-repo/test code calls `runDxaDisassemble()` directly. But this is
exactly the kind of latent gap this project's own architecture exists to
prevent by construction (CLAUDE.md: "Any host-facing path or hostname must
go through hostpath.ts / containerpath.ts / container-guard.mts... The
project maintains a tested closed consumer set for host-path logic"), and
the scope notes for this review explicitly flag `dxa-run.ts`'s "path
handling" as a place to look closely. The very next phase that wires
`runDxaDisassemble()` behind a skill or MCP tool (Phase 37 is already named
in this module's own header as the next consumer) would inherit an
unguarded arbitrary file read/write with no test anywhere flagging it.

**Fix:** Confine `args.image`, the derived `outDirRelative`, and the derived
`blocksRelPath`/`labelsRelPath` the same way `host-tool.mts` confines every
other path-bearing field, before either the local read or the local write
happens. Concretely, add a boundary check (reusing or mirroring
`realpathOfNearestExisting()`/`resolveWorkspacePath()`'s ancestor-realpath
walk, or at minimum a `resolve()` + prefix check against `root`) in
`dxa-run.ts` itself:

```typescript
// dxa-run.ts
function resolveInsideRoot(root: string, relativePath: string): string {
  const resolved = resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(
      `runDxaDisassemble: path escapes the workspace root: ${JSON.stringify(relativePath)} resolves to ${resolved}, outside ${root}`,
    );
  }
  return resolved;
}

function readLocalImageBytes(root: string, relativePath: string): Uint8Array {
  return readFileSync(resolveInsideRoot(root, relativePath));
}
```

and apply the same check to `blocksRelPath`/`labelsRelPath` (or to
`outDirRelative` before they are built from it) before calling
`emitDataBlocks()`/`emitLabels()`. For full parity with `host-tool.mts`'s
symlink-aware confinement, consider factoring
`realpathOfNearestExisting()`/`resolveWorkspacePath()` out of `host-tool.mts`
into a shared, dependency-free helper both modules import, rather than
re-implementing a second (weaker) boundary check here.

## Warnings

### WR-01: `dxa-blocks.ts`'s `assertRowShape()` accepts non-integer/`NaN` addresses and silently emits a corrupted `-B` line instead of refusing by name

**File:** `src/mcp/vice/dxa-blocks.ts:133-144`

**Issue:** `assertRowShape()` checks `row.start`/`row.endInclusive` are
within `$0000-$ffff` and that `endInclusive >= start`, but never checks
`Number.isInteger()`. Every sibling numeric boundary check added in this
same phase (`dxa-listing.ts`'s `origin`/`imageSize`,
`dxa-partition.ts`'s `formatPercent()`'s `numerator`/`denominator`,
`partitionSourceDerived()`'s `loadAddr`/`imageSize`) does call
`Number.isInteger()` and refuses by name on a non-integer — this module is
the one exception, and the module's own header states the opposite intent
("ADJACENCY IS SEPARATION, OVERLAP IS REFUSED... refused by name, quoting
both, never merged and never silently dropped").

Because `NaN < 0` and `NaN > 0xffff` both evaluate to `false`, a `NaN`
address passes the range check entirely (it is neither less than 0 nor
greater than 0xffff), and `NaN < NaN` (the inversion check) is also `false`,
so nothing refuses it. Reproduced directly:

```
emitDataBlocks([{ start: NaN, endInclusive: NaN, dataType: "byte" }], outPath)
=> { rangesCount: 1, path: '.../out.b' }
file contents: "0NaN-0NaN\n"
```

This silently violates A-13's own stated "the `-B` grammar is the plain form
only — `xxxx-yyyy`" contract and hands dxa a malformed datablocks file whose
behaviour this module's own header already says is "unmeasured" for even the
empty-file case, let alone a garbage one. A fractional (non-`NaN`) address
such as `4096.5` produces a similarly malformed `"1000.8-yyyy"` line rather
than a clean hex range.

**Fix:** Add an integer check alongside the existing range check:

```typescript
function assertRowShape(row: KnownDataRow, context: string): void {
  if (!Number.isInteger(row.start) || !Number.isInteger(row.endInclusive)) {
    throw new Error(
      `${context}: row ${JSON.stringify({ start: row.start, endInclusive: row.endInclusive })} (dataType ${row.dataType}) has a non-integer address`,
    );
  }
  if (row.start < 0x0000 || row.start > 0xffff || row.endInclusive < 0x0000 || row.endInclusive > 0xffff) {
    // ... existing check
  }
  // ...
}
```

## Info

### IN-01: Unused import `hasDotPrefixedSegment` in `host-tool.mts` / `resources/host-tool.mjs`

**File:** `src/mcp/vice/host-tool.mts:93` (and its committed build artifact,
`src/mcp/vice/resources/host-tool.mjs:99`)

**Issue:** `hasDotPrefixedSegment` is imported from `./ghidra-project.mjs`
but never referenced anywhere in either file (confirmed by a whole-file
grep: the only two hits are the import line itself in the two identical
files). This import predates Phase 35 (it is unchanged context from Phase
34, not part of this phase's diff), but both files are in this phase's
review scope and the dead import currently ships in the committed artifact.

**Fix:** Remove the unused named import (or, if the intent was to use it for
an independent dot-segment re-check the way `buildAnalyzeHeadlessArgv()`
already does internally, wire it in and add a case proving it fires); then
rebuild `resources/host-tool.mjs` via `build.ts` so the artifact stays in
sync.

---

_Reviewed: 2026-09-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
