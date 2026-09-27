# Census: unused code removed on 2026-09-27

A file or symbol counted as used when any of these reached it: a static or
dynamic import, `new URL("./x")`, a spawn path, `resolveMcpModule("…")`,
`package.json` `files[]` or scripts, `build.ts`, a `tsconfig.*.json`,
`ci.yml`, `.mcp.json`, or a SKILL.md command. The export scan ran to a
fixpoint: a declaration used only inside other dead declarations was also
dead. Files with NUL bytes were read with `grep -a`.

Baseline before the change: `npm test` 4150 tests, 4073 pass, 0 fail,
77 skipped. `test/skills` 261 tests, 255 pass, 0 fail, 6 skipped.

## Modules deleted

| Module | Reach |
|---|---|
| `anno-symbols.ts` | none (listed in `files[]` only) |
| `dxa-proof01-compare.ts`, `dxa-partition.ts` | none (their tests were deleted in `276c15c9`) |
| `probe-binmon.ts` | none (a manual capture tool; the binmon fixtures are now frozen evidence) |
| `skills/c64-provenance/scripts/recovery-schema.ts` | `test/skills/sibling.test.ts` only; no SKILL.md runs it |
| `anno-register.ts` + `anno-register.test.ts` | tests only |
| `reassembly-gate.ts`, `-ack`, `-movement`, `-movement-subject` + six `reassembly-gate*.test.ts` | tests only |

## Declarations deleted with the tests that only exercised them

- `anno-enum-gen.mts`: the whole enum-generation pass. That is
  `generateEnumsFromStore` and everything only it reached (`fetchRegisterSearchRows`,
  `pairSearchRows`, `planEnumsForPairing`, `installPlannedEnums`,
  `buildEnumGenerationReport`, `sanitizeVariantMap`, `parseImmediateOperand`,
  `variantNameFor` and their types). Production uses only
  `decomposeRegisterValue` and `hasRegBitsEntry`.
- `anno-confidence.mts`: `formatConfidenceComment`, `searchQueryForGrade`, `VALID_TOKENS`.
- `anno-import.mts`: `CONST_WRITE_WATCHED_ADDRESSES`.
- `anno-store-export.mts`: `isDeclineComment`.
- `anno-provenance-ledger.mts`: `readProvenanceLedger`. Tests now call
  `parseProvenanceLedger(p, readProvenanceLedgerText(p))`.
- `broker-home.mts`: `brokerEpochFile`, `brokerRunsDir`.
- `broker-relay.mts`: `readAttachLine`, `MAX_ATTACH_LINE_BYTES`.
- `broker-transfer.mts`: `readTransferHeader`, `MAX_TRANSFER_HEADER_LINE_BYTES`.
  The transfer test keeps its own header reader.
- `broker-state.mts`: `countReady`, `countLaunching`, `BrokerDeps`.
- `tool-location.mts`: `validateToolsFile`, `toolsFileTemplate` and their types.
- `transfer-paths.ts`: `transferKindDir`.
- `vice-broker-client.ts`: `isValidRequestId`, `REQUEST_ID_PATTERN`.
- `stock-reproducible-run.ts`: `CHECKPOINT_INFO_HIT_COUNT_BODY_OFFSET`.
- `vsf-slice.ts`: `V01_C64MEM_BODY_LEN`.
- No importer anywhere: `PROVEN_TARGET_SOURCES`, `RelayAttachRequest`,
  `BrokerIncidentTrigger`, `resourcesStatus`, `DeployManifest`,
  `OracleTerm`, `TextCommand`, `validateHitLog`, `readJsonArtifact`.
- Skill scripts: `isSurvivorName`, `typedByFor` (their mirrors existed only to
  be unit-tested), `IO_VOLATILE`, `DumpFileField`.

## Moved to the test side (tests of live code kept)

| Symbol | From | To |
|---|---|---|
| `callStockTool` | `stock-tools.ts` | `stock-call.ts` (test helper over `STOCK_TOOLS` + `runStockTool`) |
| `crossCheckHazardFixture` + types | `anno-hazard-report.mts` | `hazard-crosscheck.ts` (the detector oracle) |
| `LENGTH_FOR_MODE` | `disasm-opcodes.mts` | `disasm-mode-lengths.ts` (the opcode-table oracle) |
| `DISPATCH_CONTEXT_SHAPES`, `DISPATCH_GATE_ROUTES`, `COVERAGE_REPORT_KEYS` | `anno-coverage.mts` | `anno-coverage.test.ts` |
| `checkRenderedMemoryMap` | `anno-memmap-render.mts` | `anno-memmap-render.test.ts` (the CLI calls `compareRenderedMemoryMap` directly) |
| `skipReasonForUnp64`, `REQUIRE_ORACLE_ENV_VAR` | `packer-finding.ts` | `packer-finding.test.ts` |
| `argvDigest` | `capture-predicate.mts` | `evid-ingest.mts`, its only production consumer |

`capture-predicate.mts` is now a test oracle only: the skill's
derive-transients agreement test checks against it. It moves with the tests.

## Kept on purpose

Test seams that reach module internals stay in production modules:
`reset*ForTest(s)`, `resetTextCapabilityCache`, `__resetRegBitsCacheForTests`,
`_snapshotState`, `_HANDLED_SIGNALS`, `_superviseDepsFor`,
`_conditionRegistryTargetsForTest`, `applyWriteWithoutCommit`,
`isLaunchInFlight`, `superviseChild`, `startControlListener` and
`renderMemoryMap`.

## Fixtures and vendor

- Deleted fixtures with no reader: `dxa/fixture.rep`,
  `ghidra/runlog-benign-base0-conflict.txt`, `ghidra/runlog-script-error.txt`,
  `hazard-subject/hazard-subject-rebuild.prg`,
  `hazard-subject/hazard-subject-modified.allowlist.json` (its only reader was
  a deleted reassembly-gate test), and the four `planted-*` files.
- `vendor/dxa/`: the 17 committed upstream files are deleted. `build.bash`
  builds from the pinned tarball and no longer compares the tarball with a
  committed copy. Its test-only `DXA_BUILD_CACHE_DIR` override is gone.
  `THIRD-PARTY-NOTICES.md` now records dxa as a build-time download, not
  incorporated source.

## Package

`files[]` lost its 91 `.ts`/`.mts` entries (103 → 12). An npm install runs
`dist/` and `resources/*.mjs` only. The six tests that asserted a `.ts` entry
ships were deleted, and `vice-cli.test.ts` now asserts that no TypeScript source
ships. `node smoke-packed.ts` passes on the new tarball.

After the change: `npm test` 3989 tests, 3912 pass, 0 fail, 77 skipped.
`test/skills` 256 tests, 250 pass, 0 fail, 6 skipped.
