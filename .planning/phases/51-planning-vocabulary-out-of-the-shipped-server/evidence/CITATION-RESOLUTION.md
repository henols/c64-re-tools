# Citation Resolution — Phase 51

**Purpose:** Resolve, once and centrally, what the recurring planning citations
in `src/mcp/vice/**` (plus the eight `.mts` sources behind `resources/*.mjs`
and `installer/bin/cli.mjs`) actually meant, so that fourteen sweep plans
consume one index instead of each independently re-deriving the same lookups.

**How this was built.** Every figure below comes from importing the guard's
own `scanForPlanningVocabulary()` (from `skills-planning-vocabulary.test.ts`)
and `shippedScanSurface()` (from `shipped-modules.ts`) into a throwaway script
run from the session scratch directory, never committed, and driving them over
the live tree at HEAD as of 2026-09-14 (after Plan 51-01 landed). No figure
here is hand-rolled with `grep` and none is copied from `51-CONTEXT.md` or
`51-RESEARCH.md` without being re-measured against the real tree first.

**A note on `grep -a`.** Every grep this task's own author ran while producing
this document — including the ones quoted verbatim in Section E below — carries
`-a`. `src/mcp/vice/anno-memmap-render.ts` contains a NUL byte and a plain
`grep` treats it as binary and silently skips it, which has already produced
one wrong decision in this project (a census that undercounted the shipped
surface without reporting the omission). `-a` forces text mode regardless of
what a file's contents look like to `grep`'s own binary heuristic.

**The fresh, whole-tree measurement (2026-09-14, post-51-01):** the guard's
own predicate reports **102 dirty files** (of 158 files in the four-source
scan surface) carrying **3876 total hits**, exactly matching the `RATCHET`
ledger `51-01-PLAN.md` froze. Category breakdown, measured fresh rather than
carried forward from `51-CONTEXT.md`'s three-days-earlier count:

| Category | Occurrences |
|---|---|
| requirement id | 1280 |
| decision or gap id | 1176 |
| plan citation | 664 |
| phase citation | 426 |
| planning artifact filename | 209 |
| `.planning` path | 47 |
| phase evidence document path | 45 |
| planning document cross-reference | 24 |
| gsd command or product name | 5 |
| **Total** | **3876** |

(`51-CONTEXT.md`'s 2026-09-11 count — 1088 / 914 / 451 / 289 / 156 / 38 / — / 22
/ 5 — predates both three more days of concurrent edits from other in-flight
phases AND the ninth category `51-01` added. Both documents measure the same
underlying tree with the same tool at different, honestly-labelled moments;
neither is "wrong", and this document supersedes neither's timestamp, only
its own **currency** as of the moment `51-02` ran.)

## Section A — Originating-phase map

One row per file carrying at least one hit (102 rows — every dirty file the
scan surface currently has). For each file, `git log --follow --format=%s`
was run restricted to that path; the parenthesised `(NN-MM)` / `(NN)` /
`(quick-NNNNNN-xxx)` commit-subject scopes were tallied, and the top two or
three by frequency are listed with the `.planning/phases/` (or
`.planning/quick/`) directory they resolve to. **This is the section that
makes a phase-scoped id (a `D-NN`, a `CR-NN`, a `WR-NN`) resolvable at all** —
see Section B for why a bare id search cannot do this alone.

| File | Hits | Top originating commit scopes | Phase directory to check first |
|---|---|---|---|
| `src/mcp/vice/anno-bank.ts` | 16 | `37-06` (1) | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `src/mcp/vice/anno-cli.ts` | 164 | `48` (2), `45-04` (2), `30` (2) | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject`; `.planning/phases/45-decomposition-to-closure-disagreement-first`; `.planning/phases/30-acme-export-and-the-real-acme-oracle` |
| `src/mcp/vice/anno-confidence.ts` | 2 | `16-04` (2), `29-05` (1), `11-10` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/29-the-mcp-surface`; `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip` |
| `src/mcp/vice/anno-coverage.ts` | 51 | `29-16` (2), `29-05` (2), `19-12` (2) | `.planning/phases/29-the-mcp-surface`; `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument` |
| `src/mcp/vice/anno-derive.ts` | 6 | `29-04` (1) | `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/anno-details.ts` | 3 | `29-04` (1) | `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/anno-enum-gen.ts` | 66 | `45-03` (2), `45-review` (1), `45-04` (1) | `.planning/phases/45-decomposition-to-closure-disagreement-first` |
| `src/mcp/vice/anno-export-asm.ts` | 146 | `30` (6), `30-03` (3), `47-02` (2) | `.planning/phases/30-acme-export-and-the-real-acme-oracle`; `.planning/phases/47-multi-file-rebuildable-source` |
| `src/mcp/vice/anno-graphics.ts` | 18 | `37-07` (1) | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `src/mcp/vice/anno-hazard-report.ts` | 2 | `48-03` (4), `48-05` (2), `48-01` (1) | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject` |
| `src/mcp/vice/anno-import.ts` | 21 | `37-01` (2), `37` (1), `37-02` (1) | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `src/mcp/vice/anno-index.ts` | 6 | `28-01` (1) | `.planning/phases/28-the-store-core` |
| `src/mcp/vice/anno-join.ts` | 50 | `37-03` (2), `37-08` (1), `37-06` (1) | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `src/mcp/vice/anno-memmap-render.ts` | 25 | `29-12` (2), `29-18` (1), `29-14` (1) | `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/anno-provenance-ledger.ts` | 4 | `46-01` (2), `46` (1), `46-02` (1) | `.planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry` |
| `src/mcp/vice/anno-regbits-gen.ts` | 13 | `16-04` (2), `29-05` (1), `16-01` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/anno-register.ts` | 63 | `48-01` (1), `46-04` (1), `43-06` (1) | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject`; `.planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry`; `.planning/phases/43-the-runtime-evidence-layer` |
| `src/mcp/vice/anno-store-export.ts` | 12 | `48` (1), `48-04` (1), `45-review` (1) | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject` |
| `src/mcp/vice/anno-store.ts` | 126 | `28-20` (3), `28-16` (3), `28-13` (3) | `.planning/phases/28-the-store-core` |
| `src/mcp/vice/anno-symbols.ts` | 11 | `16-04` (2), `30-06` (1), `29-10` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/30-acme-export-and-the-real-acme-oracle`; `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/anno-tools.ts` | 85 | `29-13` (3), `29-06` (3), `43` (2) | `.planning/phases/29-the-mcp-surface`; `.planning/phases/43-the-runtime-evidence-layer` |
| `src/mcp/vice/anno-types.ts` | 50 | `43-02` (2), `52-03` (1), `46-03` (1) | `.planning/phases/43-the-runtime-evidence-layer`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry` |
| `src/mcp/vice/backend-detect.mts` | 28 | `02-07` (2), `52-06` (1), `16-04` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/block-class.ts` | 3 | `29-07` (1), `29-05` (1), `28-03` (1) | `.planning/phases/29-the-mcp-surface`; `.planning/phases/28-the-store-core` |
| `src/mcp/vice/broker-control.mts` | 80 | `02` (3), `41-05` (2), `52-06` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/broker-epoch.mts` | 2 | `16-04` (1) | `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/broker-kill.mts` | 31 | `41-05` (1), `16-04` (1), `02` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/02-stock-backend-connection` |
| `src/mcp/vice/broker-launch.mts` | 186 | `41-05` (2), `08.2-02` (2), `03-04` (2) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/broker-state.mts` | 43 | `41-05` (3), `41-03` (1), `33-06` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d` |
| `src/mcp/vice/build.ts` | 2 | `40-01` (1), `34-03` (1), `34-01` (1) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/34-the-host-tool-execution-seam` |
| `src/mcp/vice/capture-predicate.ts` | 14 | `33` (3), `33-07` (1) | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d` |
| `src/mcp/vice/channel-lock.ts` | 3 | `41-02` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content` |
| `src/mcp/vice/container-guard.mts` | 3 | `16-04` (1) | `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/containerpath.ts` | 7 | `16-04` (1) | `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/disasm-decoder.ts` | 21 | `16-07` (1), `16-04` (1), `quick-260817-n6p` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/quick/260817-n6p-fix-wr-01-bound-startaddress-to-0xffff-i` |
| `src/mcp/vice/disasm-opcodes.ts` | 20 | `16-04` (2), `16-07` (1), `04-06` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/04-client-side-tool-seam-and-6510-disassembler` |
| `src/mcp/vice/disasm-renderer.ts` | 22 | `16-07` (1), `16-04` (1), `04-04` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/04-client-side-tool-seam-and-6510-disassembler` |
| `src/mcp/vice/evid-ingest.ts` | 9 | `52-03` (1), `43-05` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/43-the-runtime-evidence-layer` |
| `src/mcp/vice/evid-reconcile.ts` | 14 | `43-04` (1) | `.planning/phases/43-the-runtime-evidence-layer` |
| `src/mcp/vice/ghidra-project.mts` | 64 | `36` (2), `34-03` (2), `40` (1) | `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness`; `.planning/phases/34-the-host-tool-execution-seam`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/host-tool-client.ts` | 11 | `34-09` (1), `34-04` (1), `34-01` (1) | `.planning/phases/34-the-host-tool-execution-seam` |
| `src/mcp/vice/host-tool.mts` | 325 | `40` (3), `36` (3), `40-02` (2) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness` |
| `src/mcp/vice/hostpath.ts` | 2 | `16-04` (1) | `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/incident-record.ts` | 12 | `40-01` (1), `16-04` (1) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/install-resources.ts` | 22 | `41-05` (1), `40-06` (1), `40-01` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/memmap-lookup.ts` | 21 | `37-03` (1), `37-01` (1) | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `src/mcp/vice/prg-image.ts` | 7 | `29-16` (2), `29-05` (2), `40-06` (1) | `.planning/phases/29-the-mcp-surface`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/repo-root.ts` | 12 | `16-04` (2), `40-10` (1), `40-01` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/resources/backend-detect.mjs` | 16 | `02-07` (2), `52-06` (1), `40-01` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/resources/broker-control.mjs` | 38 | `02` (3), `41-05` (2), `52-06` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/resources/broker-epoch.mjs` | 1 | `40-01` (1), `16-04` (1) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/resources/broker-kill.mjs` | 30 | `41-05` (1), `40-01` (1), `16-04` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/resources/broker-launch.mjs` | 138 | `41-05` (2), `08.2-02` (2), `52-06` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/resources/broker-state.mjs` | 8 | `41-05` (1), `41-03` (1), `40-01` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/resources/container-guard.mjs` | 3 | `40-01` (1), `16-04` (1) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/resources/ghidra-project.mjs` | 59 | `34-03` (3), `36` (2), `40` (1) | `.planning/phases/34-the-host-tool-execution-seam`; `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/resources/host-tool.mjs` | 238 | `40` (3), `36` (3), `40-02` (2) | `.planning/phases/40-the-three-preprocessing-host-tools`; `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness` |
| `src/mcp/vice/resources/vice-broker.mjs` | 126 | `41-05` (3), `08.2-06` (2), `03` (2) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/stock-address.ts` | 20 | `52-03` (1), `16-07` (1), `16-04` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-checkpoints.ts` | 28 | `03-08` (3), `03` (2), `16-04` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-cia.ts` | 26 | `16-04` (2), `05` (2), `05-12` (2) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/05-skill-critical-derived-tools` |
| `src/mcp/vice/stock-condition.ts` | 13 | `03-03` (2), `52-03` (1), `16-07` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-connect.ts` | 42 | `02` (3), `52-03` (1), `41-03` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content` |
| `src/mcp/vice/stock-derived.ts` | 59 | `04-02` (2), `52-04` (1), `52-03` (1) | `.planning/phases/04-client-side-tool-seam-and-6510-disassembler`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/stock-diagnose.ts` | 49 | `07` (5), `07-15` (2), `07-06` (2) | `.planning/phases/07-cycle-timing-and-wedge-triage` |
| `src/mcp/vice/stock-disassemble.ts` | 21 | `16-04` (1), `04-05` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/04-client-side-tool-seam-and-6510-disassembler` |
| `src/mcp/vice/stock-dispatch.ts` | 101 | `02` (4), `52-07` (2), `03-12` (2) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/stock-execution.ts` | 24 | `03-09` (2), `16-04` (1), `13-04` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/13-external-verification` |
| `src/mcp/vice/stock-handler.ts` | 12 | `52-03` (1), `16-04` (1), `05-02` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/05-skill-critical-derived-tools` |
| `src/mcp/vice/stock-input.ts` | 8 | `03-11` (2), `16-07` (1), `16-04` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-machine.ts` | 19 | `03-10` (2), `16-07` (1), `16-04` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-memory-search.ts` | 24 | `05-01` (2), `16-04` (1), `05` (1) | `.planning/phases/05-skill-critical-derived-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-memory.ts` | 20 | `05` (2), `16-04` (1), `05-09` (1) | `.planning/phases/05-skill-critical-derived-tools`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-paths.ts` | 12 | `52-04` (1), `52-03` (1), `40-01` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/40-the-three-preprocessing-host-tools` |
| `src/mcp/vice/stock-petscii.ts` | 2 | `52-03` (1), `16-04` (1), `03-11` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/stock-protocol.ts` | 102 | `02` (5), `13-04` (2), `07-12` (2) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/13-external-verification`; `.planning/phases/07-cycle-timing-and-wedge-triage` |
| `src/mcp/vice/stock-recycle.ts` | 15 | `07` (2), `55-02` (1), `52-03` (1) | `.planning/phases/07-cycle-timing-and-wedge-triage`; `.planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/stock-registers.ts` | 11 | `03-07` (2), `16-04` (1), `15` (1) | `.planning/phases/03-direct-tools`; `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/15-debt-and-review-disposition` |
| `src/mcp/vice/stock-reproducible-run.ts` | 9 | `33` (3), `52-03` (1), `33-09` (1) | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/stock-run-until.ts` | 23 | `33-09` (2), `07` (2), `07-14` (2) | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d`; `.planning/phases/07-cycle-timing-and-wedge-triage` |
| `src/mcp/vice/stock-runstate.ts` | 13 | `16-04` (1), `07` (1), `03-01` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/07-cycle-timing-and-wedge-triage`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/stock-sprites.ts` | 20 | `16-04` (2), `05-10` (2), `05-05` (2) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/05-skill-critical-derived-tools` |
| `src/mcp/vice/stock-symbols.ts` | 16 | `52-03` (2), `05-11` (2), `29-05` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/05-skill-critical-derived-tools`; `.planning/phases/29-the-mcp-surface` |
| `src/mcp/vice/stock-timing.ts` | 23 | `07` (4), `16-04` (2), `07-05` (2) | `.planning/phases/07-cycle-timing-and-wedge-triage`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/stock-vicii.ts` | 7 | `16-04` (2), `05-09` (1), `05-03` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/05-skill-critical-derived-tools` |
| `src/mcp/vice/stop-oracle.ts` | 5 | `33-07` (1) | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d` |
| `src/mcp/vice/text-capability-probe.ts` | 23 | `42-15` (2), `52-07` (1), `52-06` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/text-connect.ts` | 13 | `52-03` (1), `41-03` (1), `41-01` (1) | `.planning/phases/52-remove-the-fork-backend`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content` |
| `src/mcp/vice/text-protocol.ts` | 43 | `41` (2), `41-01` (2), `52-03` (1) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/text-tools.ts` | 31 | `42-13` (2), `42-07` (2), `43-03` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures`; `.planning/phases/43-the-runtime-evidence-layer` |
| `src/mcp/vice/textmon-backtrace.ts` | 10 | `42-02` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures` |
| `src/mcp/vice/textmon-cpuhistory.ts` | 10 | `42-02` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures` |
| `src/mcp/vice/textmon-memmap.ts` | 9 | `42-01` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures` |
| `src/mcp/vice/textmon-profile.ts` | 14 | `42-13` (1), `42-09` (1), `42-03` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures` |
| `src/mcp/vice/textmon-registers.ts` | 26 | `42-11` (1), `42-10` (1), `42-03` (1) | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures` |
| `src/mcp/vice/THIRD-PARTY-NOTICES.md` | 11 | `16-04` (2), `04-07` (2), `35-01` (1) | `.planning/phases/16-packaging-and-repo-shape`; `.planning/phases/04-client-side-tool-seam-and-6510-disassembler`; `.planning/phases/35-dxa-vendored-and-parsed` |
| `src/mcp/vice/tools-manifest.stock.json` | 34 | `07` (6), `05` (3), `05-12` (2) | `.planning/phases/07-cycle-timing-and-wedge-triage`; `.planning/phases/05-skill-critical-derived-tools` |
| `src/mcp/vice/version.ts` | 10 | `quick-260819-tsz` (6), `16-04` (1) | `.planning/quick/260819-tsz-single-version-template-plus-resolver-sc`; `.planning/phases/16-packaging-and-repo-shape` |
| `src/mcp/vice/vice-broker-client.ts` | 99 | `02` (4), `52-03` (2), `52-06` (1) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/vice-broker.mts` | 147 | `41-05` (3), `08.2-06` (2), `03` (2) | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content`; `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough`; `.planning/phases/03-direct-tools` |
| `src/mcp/vice/vice-proxy.ts` | 107 | `02` (5), `55-01` (2), `52-07` (2) | `.planning/phases/02-stock-backend-connection`; `.planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel`; `.planning/phases/52-remove-the-fork-backend` |
| `src/mcp/vice/vsf-slice.ts` | 4 | `33-04` (3), `33` (2), `40-06` (1) | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d`; `.planning/phases/40-the-three-preprocessing-host-tools` |

## Section B — The tier partition, in its corrected form

This REPARTITIONS membership inside the locked five-tier ladder (D-07/D-08);
it does not replace the ladder's own shape.

- **Tier 0, cheapest — a `Plan NN-MM` or `Phase NN` citation.** A filename
  search under `.planning/phases` (`find .planning/phases -iname "*NN-MM*"`)
  resolves it directly to a plan or summary document whose own prose can
  usually be quoted or paraphrased. No `git blame` step needed at all. This is
  cheaper than a `.planning/` grep, not merely comparable to one.
- **Tier 1 — a bare parenthetical sitting beside prose that already states the
  reason.** Drop the parenthetical and stop. Measured (per `51-CONTEXT.md`) at
  roughly 43% of all sites (1637 of the pre-51-01 population). This is the
  largest class and needs no lookup at all.
- **Tier 2 — a genuinely global id.** A real requirement id, declared exactly
  once in `.planning/REQUIREMENTS.md` or an archived milestone's own
  `*-REQUIREMENTS.md`, and a gap id (`G-NN-N`), whose literal form embeds its
  own originating phase number so no disambiguation step is needed at all. One
  search each. **Measured this task, fresh:** of 150 distinct
  requirement-id-*shaped* tokens in the current shipped surface, only **107**
  (626 occurrences) are genuinely tier 2 — see Section C. The other 43 (652
  occurrences) share the id's regex shape (`[A-Z]{2,8}-\d{2}`) but are NOT
  requirement ids at all; they are phase-scoped code-review finding ids
  (`CR-NN`, `WR-NN`, and the rarer `IN-NN`/`DIRECT-NN`/`AUDIT-NN` families)
  that happen to fit the same pattern the guard's "requirement id" category
  matches. Only **one** gap id (`G-40-1`, 9 occurrences) exists in the current
  shipped surface at all.
- **Tier 3 — a phase-scoped id: decision ids AND code-review finding ids
  alike.** Use Section A's originating phase for the citing FILE, then read
  that phase's `CONTEXT.md`, `PLAN.md`, `REVIEW.md` and `SUMMARY.md`. **Check
  the SUMMARY as well as the REVIEW**: the fullest explanation of a review
  finding sometimes lives in the plan that FIXED it (which says what was
  actually done and why) rather than in the review that states the finding
  tersely. This tier was WALKED END TO END during research on two real sites
  in `anno-store.ts` and confirmed to work exactly as described (see
  `51-RESEARCH.md` § "Tier 3 — confirmed to work, walked end to end").

  **The correction, stated explicitly and visibly:** decision ids (`D-NN`)
  were originally placed in tier 2 on the premise that they are
  globally-unique alongside real requirement ids. **Measurement contradicts
  that premise.** `D-13` alone is independently DEFINED — not merely cited —
  in at least six unrelated contexts across 188 files in `.planning/`: phase
  02's own `02-CONTEXT.md`, phase 16's `16-07-SUMMARY.md`, phase 27's
  `27-CONTEXT.md`, phase 29's own `D-13`, quick-task `260819-rop`, and
  quick-task `260913-p6b` — each numbering its own, unrelated decision list
  fresh, per phase and per quick task, exactly the way `/gsd-discuss-phase`
  numbers `D-01..D-10` fresh in this very phase's own `51-CONTEXT.md`. A bare
  `.planning/` grep for a `D-NN` id therefore returns candidate files, not an
  authoritative paragraph — the SAME ambiguity D-07's original text attributed
  only to `CR-NN`/`WR-NN`. So `D-NN` sits in tier 3 alongside the review-finding
  ids, not in tier 2. This task measured 37 distinct `D-NN` tokens across the
  current shipped surface (1167 occurrences) — every one of them needs the
  SAME per-site `git blame` → Section A's originating phase → that phase's
  documents walk that tier 3 already describes for `CR-NN`/`WR-NN`.
- **Tier 4, the bottom — nothing recoverable.** Rewrite the comment to a
  weaker but TRUE statement and name the site in the owning plan's summary.
  Never delete the comment. Upper bound measured (per `51-CONTEXT.md`,
  pre-51-01): 246 sites (6.4%) have little or no prose on the line, and that
  is a LINE-LEVEL heuristic, so the true figure is lower — the comment block
  above a sparse line often carries the reason. Section E below is this
  task's own fresh, whole-tree re-derivation of the tokens that land in this
  tier with NO recoverable reason anywhere in `.planning/`, as opposed to the
  much larger tier-3 population that merely needs the git-blame walk.


## Section C — Globally resolvable tokens

**150 distinct tokens** match the "requirement id" category's shape
(`[A-Z]{2,8}-\d{2}`) across the current shipped surface. Of these, **107**
(626 occurrences) resolve to exactly one genuine declaration — a checkbox line
(`- [ ]`/`- [x]`/`- [-]` followed by `**TOKEN**:`, including the `- [-]
**CUT ...** — Original: **TOKEN**:` form archived milestones use for a cut
requirement) or a `## Traceability` table row, in `.planning/REQUIREMENTS.md`
or an archived `.planning/milestones/*-REQUIREMENTS.md`. These are genuinely
tier 2 and genuinely cheap — one search resolves each:

| Token | Occurrences | Files | Declared in |
|---|---|---|---|
| `AUTO-07` | 28 | 6 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:321 |
| `FORKRM-01` | 27 | 11 | `.planning/REQUIREMENTS.md`:77 |
| `EVID-04` | 21 | 7 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:57 |
| `PROTO-08` | 19 | 11 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:45 |
| `BACK-04` | 18 | 8 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:33 |
| `REPRO-05` | 17 | 8 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:83 |
| `BUILD-05` | 16 | 6 | `.planning/REQUIREMENTS.md`:64 |
| `BUILD-07` | 16 | 5 | `.planning/REQUIREMENTS.md`:66 |
| `EVID-03` | 12 | 4 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:56 |
| `EVID-01` | 11 | 5 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:54 |
| `SEAM-01` | 11 | 7 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:80 |
| `SEAM-05` | 11 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:148 |
| `PREP-02` | 11 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:64 |
| `PARSE-03` | 11 | 5 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:49 |
| `COV-01` | 10 | 4 | `.planning/milestones/v0.5.0-REQUIREMENTS.md`:66 |
| `COV-02` | 10 | 2 | `.planning/milestones/v0.5.0-REQUIREMENTS.md`:69 |
| `STORE-06` | 10 | 4 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:96 |
| `REPRO-01` | 10 | 2 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:60 |
| `AUTO-04` | 9 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:299 |
| `AUTO-05` | 9 | 5 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:309 |
| `BROK-02` | 9 | 8 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:109 |
| `DERIV-04` | 9 | 6 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:64 |
| `PARSE-02` | 9 | 6 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:48 |
| `DERIV-07` | 8 | 6 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:67 |
| `REPRO-02` | 8 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:68 |
| `BUILD-03` | 8 | 1 | `.planning/REQUIREMENTS.md`:62 |
| `STORE-01` | 8 | 3 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:91 |
| `SEAM-04` | 8 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:143 |
| `DERIV-05` | 8 | 5 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:65 |
| `STORE-03` | 7 | 4 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:93 |
| `ANNO-13` | 7 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:357 |
| `EVID-05` | 7 | 5 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:58 |
| `OPC-04` | 7 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:257 |
| `PREP-01` | 7 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:63 |
| `BUILD-02` | 6 | 2 | `.planning/REQUIREMENTS.md`:61 |
| `SEAM-03` | 6 | 4 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:83 |
| `DISASM-06` | 6 | 3 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:76 |
| `GHID-01` | 6 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:199 |
| `DERIV-01` | 6 | 4 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:61 |
| `DERIV-06` | 6 | 4 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:66 |
| `CHAN-04` | 6 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:42 |
| `PARSE-04` | 6 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:50 |
| `AUTO-06` | 5 | 2 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:316 |
| `IMP-01` | 5 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:271 |
| `IMP-02` | 5 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:278 |
| `STORE-02` | 5 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:92 |
| `AUTO-01` | 5 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:285 |
| `BACK-03` | 5 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:32 |
| `DXA-01` | 5 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:167 |
| `SEAM-02` | 5 | 3 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:81 |
| `TIME-04` | 5 | 4 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:104 |
| `TIME-03` | 5 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:103 |
| `DISASM-01` | 4 | 3 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:71 |
| `MCP-01` | 4 | 1 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:105 |
| `STORE-04` | 4 | 3 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:94 |
| `STORE-05` | 4 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:95 |
| `REPRO-04` | 4 | 4 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:80 |
| `DISASM-05` | 4 | 3 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:75 |
| `TIME-01` | 4 | 3 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:101 |
| `CHAN-03` | 4 | 3 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:41 |
| `DIRECT-01` | 4 | 4 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:49 |
| `SHOT-01` | 4 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:81 |
| `SHOT-05` | 4 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:85 |
| `STORE-07` | 3 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:97 |
| `MCP-02` | 3 | 3 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:106 |
| `ANNO-14` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:361 |
| `ANNO-15` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:362 |
| `MCP-04` | 3 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:108 |
| `EVID-02` | 3 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:55 |
| `DERIV-02` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:62 |
| `GAIN-01` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:89 |
| `OPC-01` | 3 | 3 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:234 |
| `AUTO-02` | 3 | 1 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:290 |
| `DIRECT-03` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:51 |
| `TIME-02` | 3 | 3 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:102 |
| `FORKRM-05` | 3 | 1 | `.planning/REQUIREMENTS.md`:81 |
| `DIRECT-09` | 3 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:57 |
| `EXPORT-01` | 2 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:117 |
| `EXPORT-02` | 2 | 2 | `.planning/milestones/v0.7.0-REQUIREMENTS.md`:118 |
| `BROK-03` | 2 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:110 |
| `CAP-02` | 2 | 1 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:100 |
| `CAP-03` | 2 | 2 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:109 |
| `DISASM-04` | 2 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:74 |
| `DXA-02` | 2 | 1 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:175 |
| `PREP-04` | 2 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:66 |
| `AUTO-08` | 2 | 1 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:328 |
| `GAIN-06` | 2 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:94 |
| `PARSE-01` | 2 | 2 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:47 |
| `DIRECT-04` | 2 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:52 |
| `DIRECT-05` | 2 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:53 |
| `DIRECT-07` | 2 | 2 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:55 |
| `GATE-01` | 2 | 1 | `.planning/milestones/v0.4.0-REQUIREMENTS.md`:64 |
| `DECOMP-01` | 1 | 1 | `.planning/REQUIREMENTS.md`:53 |
| `AUTO-03` | 1 | 1 | `.planning/milestones/v0.8.0-REQUIREMENTS.md`:296 |
| `BUILD-04` | 1 | 1 | `.planning/REQUIREMENTS.md`:63 |
| `DISASM-07` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:77 |
| `ANNO-06` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:347 |
| `CHAN-05` | 1 | 1 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:43 |
| `DIRECT-02` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:50 |
| `DIRECT-08` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:56 |
| `GAIN-03` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:91 |
| `PROTO-05` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:42 |
| `VERIF-02` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:125 |
| `PROTO-02` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:39 |
| `PROTO-03` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:40 |
| `ANNO-16` | 1 | 1 | `.planning/milestones/v0.2.0-REQUIREMENTS.md`:366 |
| `EVID-06` | 1 | 1 | `.planning/milestones/v0.9.0-REQUIREMENTS.md`:59 |

The remaining **43 tokens** (652 occurrences) match the same regex shape but
resolve to NO genuine declaration in `.planning/REQUIREMENTS.md` or any
archived milestone requirements document. **These are NOT requirement ids —
they are phase-scoped code-review finding ids** (`CR-NN`, `WR-NN`, and the
rarer `IN-NN` review-internal-finding family, plus two singletons —
`DIRECT-06` and `AUDIT-01`, each a name coined inside one specific phase's own
review or a `docs-review-disposition.test.ts`-style self-referential defect
name — that happen to fit the same two-to-eight-letter-plus-two-digit shape).
Every one of them needs the SAME tier-3 git-blame walk Section B describes for
`CR-NN`/`WR-NN` generally — **except one: `PD-03`, which resolves to NOTHING
anywhere in `.planning/`, in any form, and belongs in Section E's dangling set
instead of the tier-3 bucket.**

| Token | Occurrences | Files |
|---|---|---|
| `CR-01` | 90 | 25 |
| `CR-02` | 76 | 21 |
| `WR-02` | 69 | 20 |
| `WR-01` | 53 | 17 |
| `WR-03` | 48 | 15 |
| `CR-03` | 42 | 11 |
| `CR-04` | 26 | 10 |
| `WR-05` | 19 | 7 |
| `CR-05` | 17 | 5 |
| `WR-07` | 15 | 11 |
| `WR-08` | 15 | 6 |
| `DIRECT-06` | 15 | 8 |
| `WR-13` | 14 | 6 |
| `CR-08` | 13 | 1 |
| `WR-04` | 12 | 7 |
| `WR-14` | 11 | 4 |
| `WR-06` | 11 | 6 |
| `CR-06` | 9 | 5 |
| `WR-09` | 8 | 4 |
| `CR-07` | 8 | 2 |
| `WR-18` | 7 | 2 |
| `CR-10` | 7 | 2 |
| `WR-22` | 7 | 3 |
| `IN-04` | 5 | 2 |
| `WR-15` | 5 | 4 |
| `WR-10` | 5 | 2 |
| `WR-11` | 5 | 2 |
| `IN-06` | 4 | 2 |
| `IN-05` | 4 | 2 |
| `IN-03` | 4 | 3 |
| `IN-02` | 4 | 3 |
| `PD-03` | 4 | 4 |
| `WR-16` | 3 | 1 |
| `WR-12` | 3 | 2 |
| `WR-25` | 2 | 1 |
| `WR-24` | 2 | 1 |
| `CR-09` | 2 | 1 |
| `WR-17` | 2 | 2 |
| `IN-01` | 2 | 2 |
| `WR-31` | 1 | 1 |
| `WR-28` | 1 | 1 |
| `WR-19` | 1 | 1 |
| `AUDIT-01` | 1 | 1 |

**The one gap id (`G-NN-N`) in the current shipped surface:**

| Token | Occurrences | Files | Declared in |
|---|---|---|---|
| `G-40-1` | 9 | 7 | `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/notes/ghidra-dot-path-check-semantics.md` |

`G-40-1` is genuinely global — its own literal form embeds phase 40, and it is
declared in `.planning/PROJECT.md`, `.planning/STATE.md`, and
`.planning/notes/ghidra-dot-path-check-semantics.md` (the Ghidra
non-dotted-path-handle gap this project's `container-guard.mts` and
`ghidra-project.mts` both cite). No `git blame` step needed.

**Technical-token collisions — marked as NOT citations.** Two `UTF-16` sites
match the "requirement id" category's regex shape purely by coincidence of
form (`UTF` reads as a 2-8 letter prefix, `-16` as a two-digit suffix):

- `src/mcp/vice/anno-types.ts:106`
- `src/mcp/vice/stock-protocol.ts:764`

Of the 37 distinct id prefixes appearing anywhere in the shipped tree, `UTF`
is the ONLY one that is not a declared project id prefix. Both sites are
rewritten to "16-bit code units" — accurate, standard phrasing for what
`String.length` counts — rather than exempted. **No exemption mechanism is
added.** A one-entry escape hatch has already been withdrawn from this guard
once, after it whitelisted five unrelated citations as collateral
(`c1541.test.mjs`'s former by-path exemption, ENGINEERING_RULES.md § 21.1); a
second one-entry hatch for `UTF-16` would repeat exactly that failure mode for
the sake of two sites cheaper to just rewrite.


## Section D — The plan-and-phase citations, resolved

**Every distinct `Plan NN-MM` / `plan NN-MM` / `quick-NNNNNN-xxx` token**
(normalised to its bare `NN-MM` or `quick-NNNNNN-xxx` form; both `Plan` and
`plan` casings are folded together, since the guard's own category matches
both — see the guard's own comment on why two adjacent categories must not
disagree about case) in the current shipped surface, with its occurrence
count and the plan/summary document(s) it resolves to, or an explicit
"resolves nowhere" verdict:

| Token | Occurrences | Files | Resolves to |
|---|---|---|---|
| `41-05` | 66 | 14 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-05-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-05-SUMMARY.md` |
| `33-06` | 40 | 9 | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-06-PLAN.md`; `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-06-SUMMARY.md` |
| `41-03` | 34 | 11 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-03-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-03-SUMMARY.md` |
| `36-02` | 32 | 4 | `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-02-PLAN.md`; `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-02-SUMMARY.md` |
| `40-02` | 30 | 2 | `.planning/phases/40-the-three-preprocessing-host-tools/40-02-PLAN.md`; `.planning/phases/40-the-three-preprocessing-host-tools/40-02-SUMMARY.md` |
| `37-08` | 28 | 5 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-08-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-08-SUMMARY.md` |
| `36-01` | 26 | 4 | `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-01-PLAN.md`; `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/36-01-SUMMARY.md` |
| `52-06` | 24 | 12 | `.planning/phases/52-remove-the-fork-backend/52-06-PLAN.md`; `.planning/phases/52-remove-the-fork-backend/52-06-SUMMARY.md` |
| `40-03` | 20 | 2 | `.planning/phases/40-the-three-preprocessing-host-tools/40-03-PLAN.md`; `.planning/phases/40-the-three-preprocessing-host-tools/40-03-SUMMARY.md` |
| `34-01` | 16 | 7 | `.planning/phases/34-the-host-tool-execution-seam/34-01-PLAN.md`; `.planning/phases/34-the-host-tool-execution-seam/34-01-SUMMARY.md` |
| `33-05` | 14 | 2 | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-05-PLAN.md`; `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-05-SUMMARY.md` |
| `03-04` | 13 | 5 | `.planning/phases/03-direct-tools/03-04-PLAN.md`; `.planning/phases/03-direct-tools/03-04-SUMMARY.md` |
| `35-01` | 13 | 2 | `.planning/phases/35-dxa-vendored-and-parsed/35-01-PLAN.md`; `.planning/phases/35-dxa-vendored-and-parsed/35-01-SUMMARY.md` |
| `41-01` | 12 | 7 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-01-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-01-SUMMARY.md` |
| `43-06` | 10 | 2 | `.planning/phases/43-the-runtime-evidence-layer/43-06-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-06-SUMMARY.md` |
| `47-03` | 10 | 1 | `.planning/phases/47-multi-file-rebuildable-source/47-03-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-03-SUMMARY.md` |
| `02-10` | 10 | 2 | `.planning/phases/02-stock-backend-connection/02-10-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-10-SUMMARY.md` |
| `29-10` | 9 | 2 | `.planning/phases/29-the-mcp-surface/29-10-PLAN.md`; `.planning/phases/29-the-mcp-surface/29-10-SUMMARY.md` |
| `47-01` | 9 | 3 | `.planning/phases/47-multi-file-rebuildable-source/47-01-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-01-SUMMARY.md` |
| `02-06` | 9 | 1 | `.planning/phases/02-stock-backend-connection/02-06-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-06-SUMMARY.md` |
| `45-05` | 8 | 3 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-05-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-05-SUMMARY.md` |
| `02-08` | 8 | 3 | `.planning/phases/02-stock-backend-connection/02-08-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-08-SUMMARY.md` |
| `42-07` | 8 | 4 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-07-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-07-SUMMARY.md` |
| `43-01` | 7 | 5 | `.planning/phases/43-the-runtime-evidence-layer/43-01-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-01-SUMMARY.md` |
| `52-07` | 7 | 5 | `.planning/phases/52-remove-the-fork-backend/52-07-PLAN.md`; `.planning/phases/52-remove-the-fork-backend/52-07-SUMMARY.md` |
| `41-02` | 7 | 3 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-02-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-02-SUMMARY.md` |
| `47-02` | 6 | 2 | `.planning/phases/47-multi-file-rebuildable-source/47-02-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-02-SUMMARY.md` |
| `34-03` | 6 | 4 | `.planning/phases/34-the-host-tool-execution-seam/34-03-PLAN.md`; `.planning/phases/34-the-host-tool-execution-seam/34-03-SUMMARY.md` |
| `40-09` | 6 | 4 | `.planning/phases/40-the-three-preprocessing-host-tools/40-09-PLAN.md`; `.planning/phases/40-the-three-preprocessing-host-tools/40-09-SUMMARY.md` |
| `42-01` | 6 | 6 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-01-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-01-SUMMARY.md` |
| `47-04` | 5 | 1 | `.planning/phases/47-multi-file-rebuildable-source/47-04-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-04-SUMMARY.md` |
| `43-03` | 5 | 4 | `.planning/phases/43-the-runtime-evidence-layer/43-03-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-03-SUMMARY.md` |
| `02-07` | 5 | 3 | `.planning/phases/02-stock-backend-connection/02-07-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-07-SUMMARY.md` |
| `34-04` | 5 | 3 | `.planning/phases/34-the-host-tool-execution-seam/34-04-PLAN.md`; `.planning/phases/34-the-host-tool-execution-seam/34-04-SUMMARY.md` |
| `01.1-04` | 5 | 2 | **resolves nowhere** |
| `07-09` | 5 | 3 | `.planning/phases/07-cycle-timing-and-wedge-triage/07-09-PLAN.md`; `.planning/phases/07-cycle-timing-and-wedge-triage/07-09-SUMMARY.md` |
| `07-12` | 5 | 1 | `.planning/phases/07-cycle-timing-and-wedge-triage/07-12-PLAN.md`; `.planning/phases/07-cycle-timing-and-wedge-triage/07-12-SUMMARY.md` |
| `45-01` | 4 | 1 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-01-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-01-SUMMARY.md` |
| `47-05` | 4 | 2 | `.planning/phases/47-multi-file-rebuildable-source/47-05-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-05-SUMMARY.md` |
| `47-06` | 4 | 1 | `.planning/phases/47-multi-file-rebuildable-source/47-06-PLAN.md`; `.planning/phases/47-multi-file-rebuildable-source/47-06-SUMMARY.md` |
| `37-01` | 4 | 3 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-01-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-01-SUMMARY.md` |
| `41-06` | 4 | 3 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-06-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-06-SUMMARY.md` |
| `03-06` | 4 | 3 | `.planning/phases/03-direct-tools/03-06-PLAN.md`; `.planning/phases/03-direct-tools/03-06-SUMMARY.md` |
| `03-12` | 4 | 2 | `.planning/phases/03-direct-tools/03-12-PLAN.md`; `.planning/phases/03-direct-tools/03-12-SUMMARY.md` |
| `02-04` | 4 | 1 | `.planning/phases/02-stock-backend-connection/02-04-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-04-SUMMARY.md` |
| `45-04` | 3 | 1 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-04-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-04-SUMMARY.md` |
| `45-06` | 3 | 1 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-06-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-06-SUMMARY.md` |
| `45-03` | 3 | 2 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-03-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-03-SUMMARY.md` |
| `43-05` | 3 | 3 | `.planning/phases/43-the-runtime-evidence-layer/43-05-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-05-SUMMARY.md` |
| `41-04` | 3 | 3 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-04-PLAN.md`; `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-04-SUMMARY.md` |
| `40-06` | 3 | 2 | `.planning/phases/40-the-three-preprocessing-host-tools/40-06-PLAN.md`; `.planning/phases/40-the-three-preprocessing-host-tools/40-06-SUMMARY.md` |
| `01.3-03` | 3 | 1 | **resolves nowhere** |
| `07-07` | 3 | 1 | `.planning/phases/07-cycle-timing-and-wedge-triage/07-07-PLAN.md`; `.planning/phases/07-cycle-timing-and-wedge-triage/07-07-SUMMARY.md` |
| `42-09` | 3 | 2 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-09-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-09-SUMMARY.md` |
| `42-04` | 3 | 1 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-04-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-04-SUMMARY.md` |
| `42-11` | 3 | 2 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-11-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-11-SUMMARY.md` |
| `01.6.2-07` | 3 | 2 | **resolves nowhere** |
| `01.2-03` | 3 | 1 | **resolves nowhere** |
| `37-06` | 2 | 2 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-06-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-06-SUMMARY.md` |
| `45-02` | 2 | 2 | `.planning/phases/45-decomposition-to-closure-disagreement-first/45-02-PLAN.md`; `.planning/phases/45-decomposition-to-closure-disagreement-first/45-02-SUMMARY.md` |
| `29-16` | 2 | 2 | `.planning/phases/29-the-mcp-surface/29-16-PLAN.md`; `.planning/phases/29-the-mcp-surface/29-16-SUMMARY.md` |
| `29-14` | 2 | 1 | `.planning/phases/29-the-mcp-surface/29-14-PLAN.md`; `.planning/phases/29-the-mcp-surface/29-14-SUMMARY.md` |
| `37-07` | 2 | 1 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-07-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-07-SUMMARY.md` |
| `37-02` | 2 | 1 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-02-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-02-SUMMARY.md` |
| `37-05` | 2 | 2 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-05-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-05-SUMMARY.md` |
| `16-01` | 2 | 1 | `.planning/phases/16-packaging-and-repo-shape/16-01-PLAN.md`; `.planning/phases/16-packaging-and-repo-shape/16-01-SUMMARY.md` |
| `08.2-06` | 2 | 2 | `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough/08.2-06-PLAN.md`; `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough/08.2-06-SUMMARY.md` |
| `01.3-01` | 2 | 2 | **resolves nowhere** |
| `quick-260730-q4b` | 2 | 2 | **resolves nowhere** |
| `37-04` | 2 | 1 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-04-PLAN.md`; `.planning/phases/37-the-importer-and-the-automatic-annotation-join/37-04-SUMMARY.md` |
| `40-08` | 2 | 2 | `.planning/phases/40-the-three-preprocessing-host-tools/40-08-PLAN.md`; `.planning/phases/40-the-three-preprocessing-host-tools/40-08-SUMMARY.md` |
| `15-09` | 2 | 2 | `.planning/phases/15-debt-and-review-disposition/15-09-PLAN.md`; `.planning/phases/15-debt-and-review-disposition/15-09-SUMMARY.md` |
| `42-10` | 2 | 1 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-10-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-10-SUMMARY.md` |
| `01.6.3-02` | 2 | 1 | **resolves nowhere** |
| `quick-260819-tsz` | 2 | 1 | `.planning/quick/260819-tsz-single-version-template-plus-resolver-sc` |
| `29-01` | 2 | 1 | `.planning/phases/29-the-mcp-surface/29-01-PLAN.md`; `.planning/phases/29-the-mcp-surface/29-01-SUMMARY.md` |
| `01.1-03` | 2 | 1 | **resolves nowhere** |
| `07-16` | 2 | 1 | `.planning/phases/07-cycle-timing-and-wedge-triage/07-16-PLAN.md`; `.planning/phases/07-cycle-timing-and-wedge-triage/07-16-SUMMARY.md` |
| `48-03` | 1 | 1 | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-03-PLAN.md`; `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-03-SUMMARY.md` |
| `48-05` | 1 | 1 | `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-05-PLAN.md`; `.planning/phases/48-the-movement-hazard-report-and-its-purpose-built-subject/48-05-SUMMARY.md` |
| `28-08` | 1 | 1 | `.planning/phases/28-the-store-core/28-08-PLAN.md`; `.planning/phases/28-the-store-core/28-08-SUMMARY.md` |
| `28-06` | 1 | 1 | `.planning/phases/28-the-store-core/28-06-PLAN.md`; `.planning/phases/28-the-store-core/28-06-SUMMARY.md` |
| `43-07` | 1 | 1 | `.planning/phases/43-the-runtime-evidence-layer/43-07-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-07-SUMMARY.md` |
| `quick-260804-o09` | 1 | 1 | **resolves nowhere** |
| `43-04` | 1 | 1 | `.planning/phases/43-the-runtime-evidence-layer/43-04-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-04-SUMMARY.md` |
| `43-02` | 1 | 1 | `.planning/phases/43-the-runtime-evidence-layer/43-02-PLAN.md`; `.planning/phases/43-the-runtime-evidence-layer/43-02-SUMMARY.md` |
| `38-01` | 1 | 1 | `.planning/phases/38-proof-01-03-on-real-cracked-code/38-01-PLAN.md`; `.planning/phases/38-proof-01-03-on-real-cracked-code/38-01-SUMMARY.md` |
| `quick-260731-p8a` | 1 | 1 | **resolves nowhere** |
| `13-03` | 1 | 1 | `.planning/phases/13-external-verification/13-03-PLAN.md`; `.planning/phases/13-external-verification/13-03-SUMMARY.md` |
| `03-10` | 1 | 1 | `.planning/phases/03-direct-tools/03-10-PLAN.md`; `.planning/phases/03-direct-tools/03-10-SUMMARY.md` |
| `03-02` | 1 | 1 | `.planning/phases/03-direct-tools/03-02-PLAN.md`; `.planning/phases/03-direct-tools/03-02-SUMMARY.md` |
| `07-06` | 1 | 1 | `.planning/phases/07-cycle-timing-and-wedge-triage/07-06-PLAN.md`; `.planning/phases/07-cycle-timing-and-wedge-triage/07-06-SUMMARY.md` |
| `42-13` | 1 | 1 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-13-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-13-SUMMARY.md` |
| `42-02` | 1 | 1 | `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-02-PLAN.md`; `.planning/phases/42-the-text-format-parsers-and-their-two-binary-fixtures/42-02-SUMMARY.md` |
| `02-09` | 1 | 1 | `.planning/phases/02-stock-backend-connection/02-09-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-09-SUMMARY.md` |
| `01.6.3-01` | 1 | 1 | **resolves nowhere** |
| `quick-260801-ccn` | 1 | 1 | **resolves nowhere** |
| `10-04` | 1 | 1 | `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-04-PLAN.md`; `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-04-SUMMARY.md` |
| `29-07` | 1 | 1 | `.planning/phases/29-the-mcp-surface/29-07-PLAN.md`; `.planning/phases/29-the-mcp-surface/29-07-SUMMARY.md` |
| `01.3-02` | 1 | 1 | **resolves nowhere** |
| `52-04` | 1 | 1 | `.planning/phases/52-remove-the-fork-backend/52-04-PLAN.md`; `.planning/phases/52-remove-the-fork-backend/52-04-SUMMARY.md` |
| `02-03` | 1 | 1 | `.planning/phases/02-stock-backend-connection/02-03-PLAN.md`; `.planning/phases/02-stock-backend-connection/02-03-SUMMARY.md` |

**`Plan 41-05` and `plan 40-03`, named in `51-CONTEXT.md` as the two largest
entries in its own dangling list, both RESOLVE.** `Plan 41-05` / `plan 41-05`
(both casings folded together) appears **66 times** across 14 files and
resolves to
`.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-05-PLAN.md`
and its `41-05-SUMMARY.md`. `plan 40-03` appears **20 times** across 2 files
and resolves to
`.planning/phases/40-the-three-preprocessing-host-tools/40-03-PLAN.md` and
its `40-03-SUMMARY.md`. Both plan documents exist on disk, and (per
`51-RESEARCH.md`'s own spot check) their content matches exactly what the
citing comments say they are for — `41-05` is the "warm floor" retirement /
`InstanceRecord` / `promoteLaunchingInstances()` plan, and every citing
comment even self-labels `"(folded todo)"`, matching that plan's own
description of itself. **These are NOT dangling.** See Section E for the
tokens that measure as genuinely dangling instead.

**Every distinct `Phase NN(.MM...)` token**, with its occurrence count and the
phase directory it resolves to (after correctly zero-padding a single-digit
phase number — `Phase 2` cites the directory `02-stock-backend-connection`,
not a literal `2-*` match), or an explicit "resolves nowhere" verdict:

| Token | Occurrences | Files | Resolves to |
|---|---|---|---|
| `Phase 33` | 58 | 10 | `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d` |
| `Phase 36` | 58 | 4 | `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness` |
| `Phase 40` | 56 | 3 | `.planning/phases/40-the-three-preprocessing-host-tools` |
| `Phase 47` | 38 | 5 | `.planning/phases/47-multi-file-rebuildable-source` |
| `Phase 37` | 30 | 9 | `.planning/phases/37-the-importer-and-the-automatic-annotation-join` |
| `Phase 3` | 29 | 15 | `.planning/phases/03-direct-tools` |
| `Phase 34` | 21 | 9 | `.planning/phases/34-the-host-tool-execution-seam` |
| `Phase 5` | 20 | 9 | `.planning/phases/05-skill-critical-derived-tools` |
| `Phase 35` | 14 | 3 | `.planning/phases/35-dxa-vendored-and-parsed` |
| `Phase 45` | 13 | 4 | `.planning/phases/45-decomposition-to-closure-disagreement-first` |
| `Phase 46` | 13 | 3 | `.planning/phases/46-the-lossless-export-invariant-and-the-provenance-carry` |
| `Phase 4` | 9 | 7 | `.planning/phases/04-client-side-tool-seam-and-6510-disassembler` |
| `Phase 01.6.2` | 8 | 5 | **resolves nowhere** |
| `Phase 7` | 7 | 3 | `.planning/phases/07-cycle-timing-and-wedge-triage` |
| `Phase 29` | 6 | 2 | `.planning/phases/29-the-mcp-surface` |
| `Phase 2` | 6 | 5 | `.planning/phases/02-stock-backend-connection` |
| `Phase 01.6.2.1` | 5 | 3 | **resolves nowhere** |
| `Phase 41` | 4 | 2 | `.planning/phases/41-the-text-channel-its-serialization-authority-and-the-content` |
| `Phase 01.2` | 4 | 3 | **resolves nowhere** |
| `Phase 9` | 3 | 2 | `.planning/phases/09-the-assumption-probe-go-no-go` |
| `Phase 11` | 2 | 1 | `.planning/phases/11-annotation-store-enums-and-the-symbol-round-trip` |
| `Phase 10` | 2 | 1 | `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal` |
| `Phase 8.1` | 2 | 2 | `.planning/phases/08.1-close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift` |
| `Phase 39` | 2 | 2 | `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go` |
| `Phase 8` | 2 | 2 | `.planning/phases/08-capability-honesty-and-the-install-story` |
| `Phase 15` | 2 | 2 | `.planning/phases/15-debt-and-review-disposition` |
| `Phase 01.6.3` | 2 | 1 | **resolves nowhere** |
| `Phase 43` | 1 | 1 | `.planning/phases/43-the-runtime-evidence-layer` |
| `Phase 28` | 1 | 1 | `.planning/phases/28-the-store-core` |
| `Phase 19` | 1 | 1 | `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument` |
| `Phase 32` | 1 | 1 | `.planning/phases/32-the-deletion-and-the-grep-gate` |
| `Phase 38` | 1 | 1 | `.planning/phases/38-proof-01-03-on-real-cracked-code` |
| `Phase 16` | 1 | 1 | `.planning/phases/16-packaging-and-repo-shape` |
| `Phase 13` | 1 | 1 | `.planning/phases/13-external-verification` |
| `Phase 01.6.1` | 1 | 1 | **resolves nowhere** |
| `Phase 8.2` | 1 | 1 | `.planning/phases/08.2-close-v0-2-0-blockers-drive-config-test-gate-walkthrough` |
| `Phase 01.1` | 1 | 1 | **resolves nowhere** |

## Section E — The RE-DERIVED dangling set

**`51-CONTEXT.md` claimed 33 distinct dangling tokens, ~135 occurrences, and
named only five of them by example** (its two largest, `Plan 41-05` and
`plan 40-03`, plus three smaller spot-checked examples: `01.6.2.1-REVIEW.md`,
`Phase 01.6.2.1`, `PD-03`). Since the full 33-token list was never enumerated
by name in either `51-CONTEXT.md` or `51-RESEARCH.md`, this task does not
merely re-verify five named examples — it independently re-derives the WHOLE
set, by running every distinct plan-citation, phase-citation, and
planning-artifact-filename token the fresh scan found (Sections C and D
above) against the real `.planning/` tree with `find`, and additionally
checking every requirement-id-shaped token from Section C's "no genuine
declaration" bucket for a plausible git-blame path. This is a STRICTER method
than CONTEXT's own (a superset check across every citation the scan surface
actually contains), not merely a re-run of its named examples.

**The measured result: 30 distinct tokens, 76 total occurrences — roughly
44% of CONTEXT's claimed token count and roughly 56% of its claimed occurrence
count.** The gap is explained almost entirely by CONTEXT's own two largest
entries, `Plan 41-05` (66 real occurrences, not dangling) and `plan 40-03`
(20 real occurrences, not dangling), which together account for 86 of the
occurrences CONTEXT counted toward "dangling" — this document's own Section D
corrects that. **Do not carry CONTEXT's 33/~135 figures forward as fact; the
measured numbers below are what should be cited from this point on.**

| Category | Token | Occurrences | Citing files (with per-file note) |
|---|---|---|---|
| plan citation | `01.1-04` | 5 | `src/mcp/vice/repo-root.ts`, `src/mcp/vice/vice-proxy.ts` |
| plan citation | `01.3-03` | 3 | `src/mcp/vice/incident-record.ts` |
| plan citation | `01.6.2-07` | 3 | `src/mcp/vice/vice-broker-client.ts`, `src/mcp/vice/vice-proxy.ts` |
| plan citation | `01.2-03` | 3 | `src/mcp/vice/vice-proxy.ts` |
| plan citation | `01.3-01` | 2 | `src/mcp/vice/incident-record.ts`, `src/mcp/vice/vice-proxy.ts` |
| plan citation | `quick-260730-q4b` | 2 | `src/mcp/vice/install-resources.ts`, `src/mcp/vice/repo-root.ts` |
| plan citation | `01.6.3-02` | 2 | `src/mcp/vice/vice-proxy.ts` |
| plan citation | `01.1-03` | 2 | `src/mcp/vice/vice-proxy.ts` |
| plan citation | `quick-260804-o09` | 1 | `src/mcp/vice/build.ts` |
| plan citation | `quick-260731-p8a` | 1 | `src/mcp/vice/repo-root.ts` |
| plan citation | `01.6.3-01` | 1 | `src/mcp/vice/vice-proxy.ts` |
| plan citation | `quick-260801-ccn` | 1 | `src/mcp/vice/vice-proxy.ts` |
| plan citation | `01.3-02` | 1 | `src/mcp/vice/vice-proxy.ts` |
| phase citation | `Phase 01.6.2` | 8 | `src/mcp/vice/broker-launch.mts`, `src/mcp/vice/broker-state.mts`, `src/mcp/vice/resources/broker-launch.mjs`, `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/vice-broker.mts` |
| phase citation | `Phase 01.6.2.1` | 5 | `src/mcp/vice/broker-control.mts`, `src/mcp/vice/resources/broker-control.mjs`, `src/mcp/vice/vice-broker-client.ts` |
| phase citation | `Phase 01.2` | 4 | `src/mcp/vice/containerpath.ts`, `src/mcp/vice/vice-broker-client.ts`, `src/mcp/vice/vice-proxy.ts` |
| phase citation | `Phase 01.6.3` | 2 | `src/mcp/vice/vice-proxy.ts` |
| phase citation | `Phase 01.6.1` | 1 | `src/mcp/vice/vice-broker-client.ts` |
| phase citation | `Phase 01.1` | 1 | `src/mcp/vice/vice-proxy.ts` |
| planning artifact filename | `01.6.2.1-REVIEW.md` | 6 | `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/vice-broker.mts` |
| planning artifact filename | `01.6.2-CONTEXT.md` | 4 | `src/mcp/vice/broker-launch.mts`, `src/mcp/vice/resources/broker-launch.mjs` |
| planning artifact filename | `01.6.2.1-VERIFICATION.md` | 4 | `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/vice-broker.mts` |
| planning artifact filename | `01.6-RESEARCH.md` | 3 | `src/mcp/vice/build.ts`, `src/mcp/vice/hostpath.ts`, `src/mcp/vice/vice-proxy.ts` |
| planning artifact filename | `01.6-PATTERNS.md` | 2 | `src/mcp/vice/vice-proxy.ts` |
| planning artifact filename | `01.6.1-RESEARCH.md` | 1 | `src/mcp/vice/hostpath.ts` |
| planning artifact filename | `01.6.1-PATTERNS.md` | 1 | `src/mcp/vice/incident-record.ts` |
| planning artifact filename | `01.6-CONTEXT.md` | 1 | `src/mcp/vice/install-resources.ts` |
| planning artifact filename | `01.2-PATTERNS.md` | 1 | `src/mcp/vice/vice-broker-client.ts` |
| planning artifact filename | `01.1-RESEARCH.md` | 1 | `src/mcp/vice/vice-proxy.ts` |
| requirement-id-shaped (two-letter prefix) | `PD-03` | 4 | `src/mcp/vice/container-guard.mts`, `src/mcp/vice/resources/container-guard.mjs`, `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/vice-broker.mts` |

**Three tokens independently spot-checked in `51-RESEARCH.md` as genuinely
dangling are RE-CONFIRMED here, by fresh measurement rather than by
assumption:**

- **A review filename with a four-part phase number:** `01.6.2.1-REVIEW.md` —
  6 occurrences, across `src/mcp/vice/resources/vice-broker.mjs` and
  `src/mcp/vice/vice-broker.mts`. `find .planning -iname "*01.6.2.1-REVIEW*"`
  returns nothing.
- **The matching four-part phase citation:** `Phase 01.6.2.1` — 5
  occurrences, across `src/mcp/vice/broker-control.mts`,
  `src/mcp/vice/resources/broker-control.mjs`, and
  `src/mcp/vice/vice-broker-client.ts`. No `01.6.2.1-*` (nor `01.6.2-*`, nor
  `01.6.1-*`, nor `01.6.3-*`, nor `01.6-*`, nor `01.1-*`/`01.2-*`/`01.3-*`)
  phase directory has ever existed anywhere in `.planning/phases/` or
  `.planning/milestones/` — confirmed by `git log --all` returning zero
  commits scoped to any `01.1`/`01.2`/`01.3`/`01.6.*` phase number.
- **An id whose two-letter prefix is declared in no requirements or review
  document anywhere:** `PD-03` — 4 occurrences, across
  `src/mcp/vice/container-guard.mts`, `src/mcp/vice/resources/container-guard.mjs`,
  `src/mcp/vice/resources/vice-broker.mjs`, and `src/mcp/vice/vice-broker.mts`.
  `grep -a -rn "PD-03" .planning/` returns only this phase's OWN planning
  documents discussing the fact that `PD-03` is dangling (`51-CONTEXT.md`,
  `51-RESEARCH.md`, `51-DISCUSSION-LOG.md`) — nothing that DEFINES a `PD-03`
  anywhere, at any point in this project's history.

**Why the whole dangling set is one family, and what that means for the
rewrite.** Every one of the 30 dangling tokens belongs to a single "`01.x`"
sub-phase-numbering scheme (`01.1`, `01.2`, `01.3`, `01.6.1`, `01.6.2`,
`01.6.2.1`, `01.6.3`, plus their corresponding artifact filenames and four
`quick-NNNNNN-xxx` tokens: `quick-260730-q4b`, `quick-260731-p8a`,
`quick-260801-ccn`, `quick-260804-o09`) that this project's OWN git history
never contains. **Every citing file traces back to this repository's very
first substantive commit** (`b0975f4c`, 2026-08-09, "Add c64-rc-tools plugin:
vice MCP server + C64 RE/ACME skills" — confirmed via `git log --follow
--diff-filter=A` on `vice-proxy.ts`), and the four dangling `quick-` tokens
carry dates (2026-07-30, 2026-07-31, 2026-08-01, 2026-08-04) that PREDATE that
first commit entirely. This corroborates, with a fresh independent
measurement, what this guard's own header comment already states about
`.planning/RE-FINDINGS.md`: this repository's initial commit carried source
"extracted from another GSD-managed project" whose OWN `Phase 01` was
decomposed into `01.1`/`01.2`/`01.3`/`01.6.1`/`01.6.2`/`01.6.2.1`/`01.6.3`
sub-phases and had its own quick-task history — none of which this project
ever had, or could ever recover, because it was never this project's own
history to begin with. **This is why nothing here is recoverable: there is no
missing `.planning/` document to find, because the document in question was
never part of this repository.** Per D-08, every citing comment in the tables
above is rewritten to a weaker but TRUE statement (describing the mechanism
or behaviour in its own right, with no citation to an unrecoverable donor
phase) rather than deleted, and each site is named in its sweep plan's own
summary.

## How to use this document

1. Find your file in **Section A**. Its "top originating commit scopes"
   column names the phase(s) whose `CONTEXT.md`/`PLAN.md`/`REVIEW.md`/
   `SUMMARY.md` most likely explain most of that file's citations — read those
   first, not `.planning/` at large.
2. For each citation site in that file, classify it by **Section B**'s tier:
   - `Plan NN-MM` / `Phase NN` → tier 0, resolve via **Section D**.
   - A real requirement id or `G-NN-N` → tier 2, resolve via **Section C**'s
     global table.
   - A `D-NN`, a `CR-NN`/`WR-NN`/`IN-NN` (or `DIRECT-06`/`AUDIT-01`) → tier 3;
     walk Section A's phase directory's own documents, checking the SUMMARY as
     well as the REVIEW.
   - Anything appearing in **Section E**'s table → tier 4; nothing resolves it
     because the citation predates this repository's own history. Rewrite to a
     weaker but true statement per D-08 and name the site in your plan's
     summary.
3. Write the REASON into the comment, never a shorter pointer (§ 21.2) — and
   never a repointed `.planning/` path (success criterion 4 names that as the
   same defect one hop along).

---
*Evidence document for Phase 51 Plan 02. Built 2026-09-14 by importing the
guard's own `scanForPlanningVocabulary()`/`shippedScanSurface()` and driving
them over the live tree from a throwaway, uncommitted scratch script.*
