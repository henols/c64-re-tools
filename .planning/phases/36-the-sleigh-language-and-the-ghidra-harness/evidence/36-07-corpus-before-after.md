# Phase 36 Plan 07 -- Real-Corpus Before/After Evidence

Recorded from a real live run against Ghidra 12.1.3 (`GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`), `VICE_LIVE_GHIDRA=1 VICE_LIVE_GHIDRA_CORPUS=1 node --test ghidra-opcode-live.test.ts --test-name-pattern=CORPUS`. The scratch workspace was built via `mkdtemp` outside this repository and torn down in a `finally`; `git status --porcelain` was confirmed to show no `.d64` file and no extracted `.prg` at the time this record was written.

## Release identity

- **Release image**: `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64` (gitignored, never committed; D-04, that directory's own `README.md` convention 10).
- **Release sha256**: `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` -- matches the canonical corpus release recorded in `docs/phase33-reproducible-run-gate-findings.md`'s own frontmatter (`corpus.releases[0]`, `canonical: true`).
- **Extracted entry**: the image's own first directory entry, `"BRUCE LEE   (DC)"`, extracted through `anno-d64.ts`'s `listEntries()`/`extractEntry()` -- the SAME directory-and-entry route `dxa-live.test.ts`'s own corpus case established (D-36-18); no second extraction path was written.
- **Extracted entry length**: 45074 bytes, `.prg` header bytes `$01,$08` (load address `$0801`).

**Capture-record caveat, carried per this project's own convention.** This task produced and consumed NO capture pair. The `anno-d64.ts` route reads the corpus `.d64`'s directory and one entry's byte contents directly off disk -- no VICE, no broker, no checkpoint, no runtime observation of any kind, and therefore nothing for the two-term `(PC, hit_count)` oracle (with the frame term `(LIN, CYC)` recorded but not asserted, per `D-04`'s pre-mapped narrowing of rule R6) to apply to. Stated explicitly, beside the release identity, rather than left implicit.

## Sequencing

This exercise ran AFTER the `sleigh` compile gate (plan 36-01, `evidence/36-01-sleigh-gate-red.md` -- the gate observed RED on a reverted fix and GREEN on the committed tree, commit `55a758c8`) and AFTER the language-used assertion (plan 36-01, `evidence/36-01-language-used.md` -- the same commit `55a758c8`), and it ran BEFORE the acceptance run (this plan's own Task 2/3, `evidence/36-07-acceptance-run.md`, committed after this file). The three plans in between (36-02 seam-argv, 36-03 Java scripts, 36-04 live suites, 36-05 volatile carve, 36-06 opcode sweep) all land, in commit order, before this task's own commit -- `git log --oneline` over this phase's directory shows the full chain in that order.

## The exercise: presence, then the two-language diff

**Presence established first.** A raw byte scan over the extracted program's own body (the `.prg`'s content after its 2-byte header) against the derived 105-byte set found **all 105 bytes present** somewhere in the 45072-byte body -- expected for a program this size, and recorded here as the search performed rather than assumed. Presence alone does not prove any of them are exercised as CODE; that is what the two-language run establishes next.

**Entry points, MEASURED this plan** (recorded in full in `ghidra-opcode-live.test.ts`'s own `CORPUS_ENTRY_POINTS` comment, reproduced here): `$081b` (the BASIC stub's own `SYS 2073` call, `2073` decimal `= $0819`, shifted +2 for the `.prg` route's own `BinaryLoader` header-inclusion -- the same rule `ghidra-live.test.ts`'s `PRG_ROUTE_ENTRYPOINT` documents against `bank.prg`, re-confirmed here against this release's own `$01,$08` header), `$b70a` (reached from `$081b`'s own direct `JMP`, seeded explicitly too), `$b74c` and `$b7e7` (the depacker's own two self-relocating copy-loop SOURCE addresses, read directly off `$b70a`'s own decompiled text), and `$b790` (the depacker's own second real routine, reached at runtime via the relocated code at `$0152` = `$0110+0x42`, whose static SOURCE is `$b74c+0x42=$b78e`; `$b790` is that routine's own real entry, immediately after a `PLA`/`RTS` stub at `$b78e`-`$b78f`).

**Two runs, everything else identical.** Both wire requests (`ghidra.analyze`, via `runGhidraAnalyze()`), differing only in `processor`/`runId`/`exportPath`:

```json
{
  "runId": "corpus-default",
  "importPath": "release.prg",
  "processor": "6502:LE:16:default",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "release.entrypoints",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "corpus-default-export.txt"
}
```

```json
{
  "runId": "corpus-nmos",
  "importPath": "release.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "release.entrypoints",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "corpus-nmos-export.txt"
}
```

Both runs exited 0; `## CLASSIFICATION_LINES` was **49682 in both** (identical block layout -- the language does not affect which addresses exist, only how they classify).

**The before/after difference, MEASURED**: comparing the two exports' `## CLASSIFICATION` sections address by address:

| Direction | Count |
|---|---|
| `undef` -> `code` | 99 |
| `undef` -> `data` | 3 |
| `code` -> `undef` | 1 |
| **Total changed** | **103** |

The changed-address count is asserted greater than zero in the committed test (`ghidra-opcode-live.test.ts`, the `CORPUS` case). Of these 103, **32** have their own raw byte (at the address's own file offset, converted via `address - 0x801 - 2`) equal to a member of the derived 105-byte set -- asserted in the same case as non-empty, so the difference is attributable to the illegal bytes' own offsets and not merely coincidental with them.

**A named sample of at least three addresses undefined under the stock language and code under the new one, with the decoded instruction at each** (all three confirmed members of both the "changed" set and the "attributed" set, i.e. `default != code`, `nmos == code`, and the address's own raw byte is in the derived 105-byte set):

| Address | Byte | Mnemonic (from the committed `.sinc`) | Decoded instruction (nmos) |
|---|---|---|---|
| `$8ae1` | `$04` | `:NOP imm8` (zero page, reads memory, discards) | `NOP $d6` |
| `$a660` | `$e3` | `:ISC UOP` ((zp,X) form -- INC memory then SBC, a genuine read-modify-write) | `ISC ($20,X)` |
| `$a663` | `$e3` | `:ISC UOP` ((zp,X) form, second occurrence) | `ISC ($a2,X)` |

`$a660`'s own `ISC` decompiles (in `## DECOMPILED_TEXT`, `FUN_a660`) to a `CONCAT11`-built pointer dereference and increment -- this is the SAME function `evidence/36-07-acceptance-run.md` Part 1 cites for the `SPLIT_POINTER` structural fact, so this task's own before/after difference and the acceptance run's own structural-fact recovery are the SAME real code, observed from two angles.

## Not a substitution

Per this task's own prohibition: the search for the 105-byte set was performed (recorded above) and found all 105 present; the two-language run was performed over the SAME extracted program on the SAME route with the SAME entry points, differing only in `processor`; no synthetic sweep image stands in for any part of this record.

## Working-tree check

`git status --porcelain | grep -c '\.d64$'` printed `0` after the run; no release image or extracted `.prg` was left tracked or staged.
