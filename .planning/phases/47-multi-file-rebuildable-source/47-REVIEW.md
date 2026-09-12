---
phase: 47-multi-file-rebuildable-source
reviewed: 2026-09-12T18:47:35Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - scripts/lib/anno-cli-invocations.mjs
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-export-asm.test.ts
  - src/mcp/vice/anno-export-asm.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/resources/host-tool.mjs
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-program-recon/SKILL.md
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-09-12T18:47:35Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase makes `anno export-asm` write a tree of ACME source files (`root.a`, `symbols.a`,
per-scope files, `unscoped.a`, `.bin` siblings) instead of one file, and threads a server-derived
`cwd` through `buildHostToolArgv()`/`spawnHostTool()`/`runHostTool()` so ACME's `!source` directives
resolve against the tree's own directory rather than the broker's working directory.

The two areas the task brief called out as highest-risk were checked directly against the diff
against `03cfbb61f07ab5e1a25ef3aa693c5658376b417d^`:

- **`cwd` threading (`host-tool.mts`/`host-tool.mjs`)**: confirmed non-caller-controllable. `cwd` is
  computed server-side as `dirname(sourcePath)` from the already-`resolveWorkspacePath()`-confined
  `sourcePath`, is absent from both `HOST_TOOL_ARG_KEYS["acme.build"]` and
  `HOST_TOOL_PATH_ARG_KEYS["acme.build"]`, and a wire request naming an explicit `cwd` key is refused
  as an unknown key by `normaliseHostToolRequest()` (test-verified). Every other tool's `cwd` stays
  `undefined`, spawning exactly as before. The compiled `resources/host-tool.mjs` is a faithful,
  line-for-line match of the `.mts` source for this change — no drift.
- **`exportAsmTree()`'s output-directory contract**: refuses a non-empty directory without `--force`,
  and with `--force` refuses (never deletes) any pre-existing entry that is not one of this export's
  own file names. The full placement pass (block → scope/unscoped) runs to completion, and the whole
  `namesToWrite` set is computed, *before* any file is written, so a thrown refusal never leaves a
  half-written tree. `root.a` is written last via a same-directory temp file + `renameSync`. The CLI
  (`anno-cli.ts`) additionally refuses when `--out` *is or contains* any of the three inputs
  (store/image/ledger), via a proper path-segment-bounded comparison (`pathIsOrContains()`, not a bare
  `startsWith()`), and `--force` does not lift that refusal. This looks solid and is well covered by
  both `anno-export-asm.test.ts` and `anno-cli.test.ts`.
- **In-tree reference bypass**: the code path (`referencedAddress()`/`isInTree()`) and the new
  split-address-table path (`emitSplitAddressLines()`) both read the *same* `blocks`/`labelIndex` and
  feed the *same* `unresolvedReferences`/`inTreeReferenceCount` totals, so the two cannot disagree
  about what counts as an unresolved in-tree reference. No bypass found.

Two lower-severity gaps were found, both in the same family as defects this project has already
fixed in this file for other columns (`assertDataTypeForExport`, `assertExportableCommentText`):
a store-file-supplied invariant (split-address range byte-parity) that is enforced on every *write*
path but not re-checked at the *export* boundary, and an unhandled non-directory `outDir` case in
`exportAsmTree()`'s directory contract. Neither is reachable through the CLI's own normal write path.

## Warnings

### WR-01: Split-address range byte-parity is not re-checked at the export boundary, unlike every sibling store-supplied value in this file

**File:** `src/mcp/vice/anno-export-asm.ts:548-605` (also `1824-1840`)

**Issue:** `emitSplitAddressLines()` computes `const half = slice.length / 2;` and then loops
`for (let i = 0; i < half; i++)`, reading `slice[i]` and `slice[half + i]`. This is correct only when
`slice.length` is even. Evenness is enforced on every *write* path into the store
(`assertRangeShape()`, called from `anno-tools.ts`, `anno-store.ts`, `anno-types.ts`), but this
module's own established pattern is to **re-check** every store-derived value it is about to
interpolate into ACME source text at the export boundary, precisely because a store file edited
outside the normal write path (already an accepted threat model in this same file — see
`assertDataTypeForExport()`'s and `assertExportableCommentText()`'s own doc comments, both of which
say "reachable through a store file somebody edited") can carry a value no write-path validator ever
saw. `assertDataTypeForExport()` was added specifically to close this exact class of gap for the
`dataType` column (30-REVIEW WR-03). The identical class of gap exists here for range byte-count
parity on the two split-*address* data types, and is not closed: an odd-length `lo_hi_address`/
`hi_lo_address` range (reachable only via a hand-edited store — a range table with no even-length
guarantee upheld) makes `half` a non-integer, so `slice[half + i]` reads a non-existent fractional
index (`undefined` on a `Uint8Array`), and `high << 8` / `low | (high << 8)` silently coerce that
`undefined` through `NaN`/`ToInt32` to `0` — producing a **silently wrong emitted address pair with no
thrown refusal at all**, the exact failure mode this project has repeatedly hardened against
elsewhere in this same function (WR-02, WR-03, CR-01, CR-02 in the history recorded in this file).
Unlike the `dataType`/`commentType` cases, there is no test in `anno-export-asm.test.ts` covering an
odd-length split-address range reaching `exportAsm()`.

**Fix:** Re-check parity at the export boundary, mirroring `assertDataTypeForExport()`'s placement
and messaging style, before calling `emitSplitAddressLines()`:
```ts
if (isSplitAddressDataType(block.dataType) && slice.length % 2 !== 0) {
  throw new Error(
    `exportAsm: the range ${hex4(block.start)}..${hex4(block.endExclusive - 1)} (inclusive) has data type ` +
      `${JSON.stringify(block.dataType)}, which requires an EVEN byte count for its low/high split, but this range ` +
      `has ${slice.length} bytes. assertRangeShape() enforces this on every write path; a store edited outside it ` +
      `can still hold an odd-length split-address range. Refusing rather than silently mispairing the halves.`,
  );
}
```

### WR-02: `exportAsmTree()`'s output-directory contract does not distinguish "outDir exists as a non-directory" from "outDir exists as a directory"

**File:** `src/mcp/vice/anno-export-asm.ts:2309`

**Issue:** `const existingEntries = existsSync(outDir) ? readdirSync(outDir) : [];` assumes that if
`outDir` exists, it is a directory. If a caller (or a stale artifact) leaves a plain *file* at the
`--out` path, `readdirSync(outDir)` throws `ENOTDIR`, which is caught by `cmdExportAsm()`'s generic
`catch (err) { console.error(`export-asm: ${errMsg(err)}`) }` and surfaces as a raw Node error message
(`ENOTDIR: not a directory, scandir '...'`) rather than one of this module's own named refusals. Every
other refusal in this function (`already holds N entries`, `holds [...], which this export would NOT
write`) is deliberately phrased to say what happened and what to do about it; this one case falls
through to an unstyled runtime error instead. Not a data-loss risk (the write still fails, nothing is
overwritten), but it is an inconsistency with the rest of this function's own stated design goal, and
it is untested — no test in `anno-export-asm.test.ts` covers `outDir` existing as a non-directory.

**Fix:**
```ts
if (existsSync(outDir) && !statSync(outDir).isDirectory()) {
  throw new Error(
    `exportAsmTree: the output path "${outDir}" already exists and is not a directory -- refusing to write a tree ` +
      `into it. Pass a different --out, or remove the file at this path.`,
  );
}
const existingEntries = existsSync(outDir) ? readdirSync(outDir) : [];
```

## Info

### IN-01: `module-classification.ts` line-number citation was updated correctly, but is a drift-prone pattern

**File:** `src/mcp/vice/module-classification.ts:127`

**Issue:** The only change to this file in this phase is a line-number citation
(`anno-cli.ts:409` → `anno-cli.ts:422`), kept accurate because `checkAcceptedOptions()` moved when
`anno-cli.ts` grew for this phase's tree-export changes. This particular update is correct (verified:
`checkAcceptedOptions` is declared at line 422 in the current `anno-cli.ts`), so this is not a defect
in this diff — flagged only as a maintenance note: a bare line-number citation to another file is
exactly the kind of reference that goes stale silently on the next unrelated edit to `anno-cli.ts`,
with nothing in the test suite that would catch it (unlike the file's own stated preference for named,
resolvable citations over bare pointers).

**Fix:** No action required for this diff. If this comment is touched again, consider citing the
function name alone (`` `anno-cli.ts`'s `checkAcceptedOptions()` ``) without a line number, removing
the drift vector entirely.

---

_Reviewed: 2026-09-12T18:47:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
