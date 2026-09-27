# Census: byte-identity sites in the test suite

Measured 2026-09-27 on `origin/main` at `7a0d9906`, before any deletion.

## Method

- Regex (case-insensitive, `grep -a` because NUL bytes hide some hits):
  `byte[- ]?identical|byte[- ]for[- ]byte|byte[- ]exact`.
- Files: `src/mcp/vice/*.test.{ts,mts}`, `test/skills/**/*.test.ts`.
- Result: 277 hits in 77 files. Every hit was read in context. The same
  files were also searched for unlabelled comparisons of two runs of the
  same code over the same input (31 more sites), and the whole suite was
  searched by title for regeneration and drift guards.

## Classes

| Class | Meaning | Action |
|---|---|---|
| S | Sync guard: committed copy or build output against a fresh build of its source | Delete |
| T | The whole test only compares two runs, calls or parses of the same input | Delete the test |
| A | Such a comparison inside a test that checks other things | Delete the comparison only |
| R | Deleting the comparison would leave the title's claim with no assertion | Replace it with a real assertion |
| K | Byte equality against an independent reference (see `shape.md`) | Keep |
| C | Phrase only in a comment, a title or a message; not a byte comparison | No change |

## S: deleted

| Site | Test | Note |
|---|---|---|
| `src/mcp/vice/resources-sync.test.ts:50` | resources/ equals a fresh build (both directions) | Keep `:97` (no bare import specifier) |
| `src/mcp/vice/entry-sync.test.ts:16` | committed entry artifact equals a fresh build | Keep `:36` (shebang + banner) |
| `test/skills/sibling.test.ts:136` | every `sibling.ts` copy is identical, one per consumer | Keep the refuse and run tests |
| `src/mcp/vice/hazard-subject-fixture.test.ts:576` | REGENERATOR AGREEMENT (mis-aligned twin) | |
| `src/mcp/vice/hazard-subject-fixture.test.ts:599` | REGENERATOR AGREEMENT (root) | |
| `src/mcp/vice/hazard-subject-variants.test.ts:229` | REGENERATOR AGREEMENT (regressed twin) | Its helper becomes dead |
| `src/mcp/vice/hazard-subject-variants.test.ts:364` | REGENERATOR AGREEMENT (modified) | |
| `src/mcp/vice/anno-export-asm.test.ts:1546` | REGENERATOR AGREEMENT: smc.a reproduces smc.prg | |
| `src/mcp/vice/anno-regbits.test.ts:51` | fresh `buildRegBits()` deep-equals the committed JSON | Unlabelled; `:58`/`:72` stay |
| `src/mcp/vice/hazard-subject-exported-edit.test.ts:103-105` | committed .prg equals the re-derivation (A-shaped) | Keep exit 0, outcome, `byte_diff.equal` |

## T: deleted

| Site | Test |
|---|---|
| `anno-coverage-grammar.test.ts:1628` | building the corpus twice |
| `anno-coverage.test.ts:801` | idempotency: building the report twice |
| `anno-coverage.test.ts:1090` | idempotency: two consecutive reports |
| `anno-coverage.test.ts:3821` | the witness is PURE |
| `anno-export-asm.test.ts:504` | running the exporter twice |
| `anno-export-asm.test.ts:3386` | ordering: same ledger-mode export twice |
| `anno-export-asm.test.ts:3735` | exclusion ordering: two consecutive exports |
| `anno-export-asm.test.ts:4593` | tree determinism: exporting twice |
| `anno-export-asm.test.ts:4617` | tree determinism: non-vacuity for the test above |
| `anno-import.test.ts:297` | two identical transfer files give equal listXrefs |
| `anno-memmap-render.test.ts:251` | render digest identical across two renders |
| `anno-store-export.test.ts:111` | exporting the same store twice |
| `anno-regbits.test.ts:66` | banner shape twice in a row |
| `broker-endpoint.test.ts:397` | classifyHelloReply holds no state |
| `broker-endpoint.test.ts:687` | describeDialFailure is pure |
| `host-tool.test.ts:621` | buildHostToolArgv is deterministic |
| `dxa-seam.test.ts:175` | argv identical across two calls |
| `textmon-profile.test.ts:186` | two parses of the cold-profiler reply |
| `textmon-profile.test.ts:288` | a second parse of the same input |
| `textmon-profile.test.ts:295` | interleaved parses equal sequential |
| `textmon-registers.test.ts:411` | idempotency (refusal arm) |
| `textmon-registers.test.ts:508` | a second parse |
| `textmon-registers.test.ts:515` | interleaved parses |
| `tool-location.test.ts:503` | many concurrent resolveTool calls match solo |
| `tool-location.test.ts:705` | Plan 60-08 Test 11 (concurrency) |
| `hazard-subject-reassembly.test.ts:227` | two exports give identical file sets |
| `hazard-subject-reassembly.test.ts:233` | two exports give identical file contents |
| `skill-memory-map-derive-cli.test.ts:158` | vic verb determinism |
| `test/skills/c64-annotations/completeness-report.test.ts:211` | Test 5: render twice |
| `test/skills/c64-provenance/diff-images.test.ts:513` | renderLedger across two runs |

Paths without a directory are under `src/mcp/vice/`.

## A: comparison deleted, test kept

| Site | What the test still checks |
|---|---|
| `anno-cli.test.ts:1815-1816` | both runs exit 0; see R for `--out` |
| `anno-confinement.test.ts:483` | refused on both calls, listing unchanged, nothing outside the root |
| `anno-coverage-grammar.test.ts:2152-2157` | ascending and unique address lists |
| `anno-coverage.test.ts:4076-4078` | store sha256 unchanged (read-only, K) |
| `anno-export-asm.test.ts:3659` | zero excluded ranges, no marker |
| `anno-export-asm.test.ts:4662` | each run's order against the expected order |
| `anno-import.test.ts:365` | `commentsChanged==0`, reopen count |
| `anno-import.test.ts:508` | line and fact floors, port values |
| `anno-join.test.ts:91` | `commentsChanged==0`, reopen count |
| `anno-join.test.ts:213` | ascending order |
| `anno-join.test.ts:490` | range count, three lines, ascending |
| `anno-memmap-render.test.ts:714` | lowest differing line |
| `ghidra-live.test.ts:1421` | fact kinds, CONCAT11, accounting identity, reference kinds, dispatch |
| `textmon-registers.test.ts:393` | refusal code, field names in order, real captures parse |
| `tool-location.test.ts:795` | solo path and layer |
| `tool-location.test.ts:1300` | count and key order |
| `tool-location.test.ts:1658` | trailing newline |
| `tool-location.test.ts:1754` | declaration order |
| `capture-predicate.test.ts:188` | order sensitivity, hex format, empty refusal |
| `skill-memory-map-cli.test.ts:179-182` | status 0 and the annotated line |
| `test/skills/c64-provenance/diff-images.test.ts:349` | the patch counts |
| `test/skills/c64-provenance/diff-images.test.ts:483-487` | the kept-ranges checks at 479-482 |

## R: comparison replaced

| Site | New assertion |
|---|---|
| `dxa-blocks.test.ts:146` | the second emit equals `"1000-1fff\n4000-4fff\n"` (replace, never append) |
| `anno-export-asm.test.ts:4530` | the `force: true` tree has the file set that the scopes define |
| `anno-cli.test.ts:1797` | the root file exists in the `--out` directory |
| `ghidra-live.test.ts:472` | GATE 3 runs once and keeps the fixture sha256-against-README check |

## K and C: unchanged

All other hits are K or C. The notable K sites are these:
- ACME reassembly against the image (`anno-export-asm`, `disasm-roundtrip`, `hazard-subject-reassembly`)
- transfer integrity (`broker-relay*`, `broker-transfer`, `transfer-disjoint-roots`, `vice-broker-staging`, `stock-machine`)
- the T-63-17 refusal indistinguishability (`broker-control:3112`)
- refusals that leave a file unchanged (`anno-cli:1503`, `anno-confinement:566`, `anno-store:2080`, `install-resources:95`)
- tool outputs that report identical images (`compare-cross-binary`, `capture-predicate`)

Per-file regex hits before the change:

| File | Hits |
|---|---|
| `src/mcp/vice/acme-verify.test.ts` | 3 |
| `src/mcp/vice/anno-cli-smoke.test.ts` | 1 |
| `src/mcp/vice/anno-cli.test.ts` | 4 |
| `src/mcp/vice/anno-confinement.test.ts` | 5 |
| `src/mcp/vice/anno-coverage-grammar.test.ts` | 4 |
| `src/mcp/vice/anno-coverage.test.ts` | 6 |
| `src/mcp/vice/anno-derivation.test.ts` | 2 |
| `src/mcp/vice/anno-derive.test.ts` | 2 |
| `src/mcp/vice/anno-durability.test.ts` | 2 |
| `src/mcp/vice/anno-enum-gen.test.ts` | 1 |
| `src/mcp/vice/anno-export-asm.test.ts` | 55 |
| `src/mcp/vice/anno-import.test.ts` | 1 |
| `src/mcp/vice/anno-index.test.ts` | 1 |
| `src/mcp/vice/anno-join.test.ts` | 5 |
| `src/mcp/vice/anno-memmap-render.test.ts` | 5 |
| `src/mcp/vice/anno-overlap.test.ts` | 3 |
| `src/mcp/vice/anno-provenance-ledger.test.ts` | 1 |
| `src/mcp/vice/anno-store-export.test.ts` | 4 |
| `src/mcp/vice/anno-store.test.ts` | 10 |
| `src/mcp/vice/anno-tools.test.ts` | 3 |
| `src/mcp/vice/anno-types.test.ts` | 4 |
| `src/mcp/vice/broker-control.test.ts` | 6 |
| `src/mcp/vice/broker-endpoint.test.ts` | 5 |
| `src/mcp/vice/broker-relay.test.ts` | 12 |
| `src/mcp/vice/broker-relay-text.test.ts` | 4 |
| `src/mcp/vice/broker-state.test.ts` | 1 |
| `src/mcp/vice/broker-transfer.test.mts` | 1 |
| `src/mcp/vice/build-atomic.test.ts` | 1 |
| `src/mcp/vice/capture-predicate.test.ts` | 2 |
| `src/mcp/vice/disasm-roundtrip.test.ts` | 4 |
| `src/mcp/vice/dxa-blocks.test.ts` | 2 |
| `src/mcp/vice/dxa-seam.test.ts` | 1 |
| `src/mcp/vice/entry-sync.test.ts` | 1 |
| `src/mcp/vice/ghidra-live.test.ts` | 12 |
| `src/mcp/vice/ghidra-opcode-live.test.ts` | 6 |
| `src/mcp/vice/hazard-subject-exported-edit.test.ts` | 1 |
| `src/mcp/vice/hazard-subject-fixture.test.ts` | 2 |
| `src/mcp/vice/hazard-subject-reassembly.test.ts` | 3 |
| `src/mcp/vice/hazard-subject-variants.test.ts` | 2 |
| `src/mcp/vice/host-tool-endpoint.test.ts` | 1 |
| `src/mcp/vice/host-tool.test.ts` | 1 |
| `src/mcp/vice/install-resources.test.ts` | 2 |
| `src/mcp/vice/join-image-controls.test.ts` | 3 |
| `src/mcp/vice/memmap-lookup-controls.test.ts` | 4 |
| `src/mcp/vice/prerequisites.test.ts` | 1 |
| `src/mcp/vice/reassembly-gate-exported-edit-run.test.ts` | 3 |
| `src/mcp/vice/reassembly-gate-movement.test.ts` | 2 |
| `src/mcp/vice/repo-root.test.ts` | 3 |
| `src/mcp/vice/resources-sync.test.ts` | 2 |
| `src/mcp/vice/skill-memory-map-cli.test.ts` | 1 |
| `src/mcp/vice/skill-memory-map-derive-cli.test.ts` | 3 |
| `src/mcp/vice/stock-broker-live.test.ts` | 1 |
| `src/mcp/vice/stock-checkpoints.test.ts` | 1 |
| `src/mcp/vice/stock-condition.test.ts` | 1 |
| `src/mcp/vice/stock-connect.test.ts` | 1 |
| `src/mcp/vice/stock-live-relay.test.ts` | 2 |
| `src/mcp/vice/stock-machine.test.ts` | 3 |
| `src/mcp/vice/stock-session.test.ts` | 3 |
| `src/mcp/vice/stock-tools.test.ts` | 1 |
| `src/mcp/vice/text-connect.test.ts` | 1 |
| `src/mcp/vice/text-monitor-live.test.ts` | 1 |
| `src/mcp/vice/textmon-profile.test.ts` | 1 |
| `src/mcp/vice/textmon-registers.test.ts` | 2 |
| `src/mcp/vice/text-protocol.test.ts` | 3 |
| `src/mcp/vice/text-tools.test.ts` | 4 |
| `src/mcp/vice/tool-location.test.ts` | 3 |
| `src/mcp/vice/transfer-disjoint-roots.test.ts` | 4 |
| `src/mcp/vice/vice-broker-client.test.ts` | 2 |
| `src/mcp/vice/vice-broker-staging.test.ts` | 1 |
| `src/mcp/vice/vice-cli.test.ts` | 3 |
| `src/mcp/vice/vice-proxy.test.ts` | 14 |
| `src/mcp/vice/vsf-slice.test.ts` | 2 |
| `test/skills/c64-annotations/completeness-report.test.ts` | 2 |
| `test/skills/c64-provenance/diff-images.test.ts` | 2 |
| `test/skills/c64-ram-capture/compare-cross-binary.test.ts` | 2 |
| `test/skills/c64-unpacker/packer-finding.test.ts` | 1 |
| `test/skills/sibling.test.ts` | 2 |

## Baseline test counts (before the change)

Every run exited 0, with zero failures:

| Command | tests | pass | fail | skipped |
|---|---|---|---|---|
| `VICE_REQUIRE_ACME=1 npm test` (in `src/mcp/vice`) | 4186 | 4109 | 0 | 77 |
| `node --test 'test/skills/**/*.test.ts'` | 264 | 258 | 0 | 6 |
| `npm run test:automated` | 4039 | 4030 | 0 | 9 |

## After the change

Every run exited 0, with zero failures. The drop equals the deleted tests
(36 server, 3 skill). Comparing test names: 58 server names are gone
(36 deleted + 22 retitled) and 22 are new (the retitles). For the skill
tests, 5 are gone (3 deleted + 2 retitled) and 2 are new.

| Command | tests | pass | fail | skipped |
|---|---|---|---|---|
| `VICE_REQUIRE_ACME=1 npm test` (in `src/mcp/vice`) | 4150 | 4073 | 0 | 77 |
| `node --test 'test/skills/**/*.test.ts'` | 261 | 255 | 0 | 6 |
| `npm run test:automated` | 4003 | 3994 | 0 | 9 |
| `VICE_LIVE_GHIDRA=1 VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-live.test.ts` | 25 | 25 | 0 | 0 |

`npm run typecheck` exits 0. The census regex now finds 227 hits in 62
files. Every remaining test title with a hit is a K or C site.
