# Phase 42: The Text-Format Parsers and Their Two-Binary Fixtures - Research

**Researched:** 2026-09-09
**Domain:** Pure-function text parsing of VICE text-monitor command output (TypeScript, in-repo, no new runtime dependencies)
**Confidence:** HIGH

## Summary

This phase adds five pure, import-light parser modules (`memmapshow`, `prof flat`, `chis`, `bt`, `io`) that turn already-captured VICE text-monitor output into typed data, mirroring the `disasm-decoder.ts` shape this repo already has and proved out. The single biggest fact this research turned up: **the fixture batch and its loader already exist and are committed** — `src/mcp/vice/fixtures/textmon/` holds twelve real `.txt`/`.json` pairs (six command groups × two binaries, one group with zero-byte payload) captured live from genuine stock VICE 3.9 and the fork's 3.10 on 2026-09-07, and `src/mcp/vice/textmon-fixtures.ts` + `textmon-fixtures.test.ts` already implement the provenance-sidecar loader `binmon-fixtures.ts` established for the binary side. Phase 42 does not need to capture anything new to build and unit-test the five parsers; it needs to write the parsers against fixtures that are already on disk, then wire five new MCP tools.

Two load-bearing findings change how this phase should be planned. First, `TEXT_COMMAND_ALLOWLIST` in `text-protocol.ts` is a closed set of **exact literal strings with no parameters** (`"chis"`, `"prof flat"`, `"io"`, bare), but the committed fixtures were captured with **parameterized** commands (`"chis 4"`, `"prof flat 5"`, `"io $d020"`) — the allowlist mechanism itself needs a parameterization design before three of the five tools can be built safely; `memmapshow` and `bt` need no change. Second, `mon_memmap.c` (which implements `memmapshow`) and the C function backing `chis` are gated behind the **exact same** build-time C macro, `FEATURE_CPUMEMHISTORY` — contrary to the ROADMAP note's blanket claim that "the commands do not share a single guard," two of the five do, and VICE's own stub for both prints the identical string `"Disabled. configure with --enable-cpuhistory and recompile.\n"` when that flag is compiled out. `bt` and `prof flat` carry no build-time gate in the VICE source read this session; `io`'s dump path degrades to `"No details available."` / `"No I/O regs available"` rather than refusing outright.

On the `memmapshow` execute-bit question (success criterion 1, `PARSE-01`): both the committed fixture and the VICE source confirm execute is tracked as an independent bit, per column, for I/O, ROM and RAM alike (`MEMMAP_ROM_X`, `MEMMAP_RAM_X`, `MEMMAP_I_O_X`, distinct from the `_R`/`_W` bits of the same prefix). The fork binary's `mon_memmap.c` additionally carries a fourth-generation annotation (`(dummy)`, `(uninitialized read)`, `(uninitialized exec)`) not present in the plain upstream 3.8 tree read this session — a real "access class" widening exists, but the version this project's own ROADMAP note attributes it to (3.5) does not match what either NEWS file read this session actually says.

**Primary recommendation:** Build the five parsers as pure `parse(text) -> TypedResult` functions in five new sibling modules (`textmon-memmap.ts`, `textmon-profile.ts`, `textmon-cpuhistory.ts`, `textmon-backtrace.ts`, `textmon-registers.ts`, one plausible naming scheme — see Architecture Patterns), each tested directly against the already-committed fixtures via `loadTextFixture()`, before touching `TEXT_COMMAND_ALLOWLIST`'s parameterization question or wiring any new MCP tool.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Text-monitor command framing (prompt-terminated, quiescence window) | MCP server / transport (`text-protocol.ts`) | — | Already built in Phase 41; this phase never touches it |
| Parsing raw VICE text-monitor output into typed data | MCP server / pure-function layer (new `textmon-*.ts` modules) | — | Mirrors `disasm-decoder.ts`: no socket, no timing, text-in/typed-out |
| Fixture provenance and loading | MCP server / test-support (`textmon-fixtures.ts`) | — | Already built in Phase 41 (plan 39-07/41 lineage); reused, not re-derived |
| MCP tool surface for the five parsed commands | MCP server / dispatch (`stock-dispatch.ts`, `stock-derived.ts`) | Parser modules (owning handler logic) | Same registration pattern as `vice_device_console`/`vice_warp_set` |
| Build-capability probing (PARSE-04) | MCP server / dispatch or parser layer | — | Must run per-command, per-binary; caches result — no existing seam owns this yet |
| Command allowlist parameterization | Transport (`text-protocol.ts`) | — | `TEXT_COMMAND_ALLOWLIST` is currently literal-only; three of five commands need a parameter shape added here before their tools can dial VICE |

## Standard Stack

### Core

No new external packages are needed for this phase. Every dependency the parsers need already ships in `src/mcp/vice/package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (native, no build step) | project floor (Node ≥ 24) | Pure parser modules | Matches `disasm-decoder.ts`'s existing shape exactly |
| `node:test` | Node built-in | Unit tests against committed fixtures | Matches every other `*.test.ts` in this package |

### Supporting

None. This phase is pure text parsing over already-captured strings; it needs no HTTP, no regex library beyond built-in `RegExp`, no charset library (the one high-byte concern — U+202F thousands separators in `flat-profile`'s output — is native JS string/Buffer handling, not a library problem).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written line-oriented parsers per format | A generic parser-combinator library | Rejected: five small, fixed-width/fixed-delimiter VICE outputs do not justify a combinator dependency; `disasm-decoder.ts`'s own precedent is hand-rolled, bounded loops |

**Installation:** none required.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `npm view`/`pip index`/`cargo search` were not run because there is nothing to look up; every module this phase adds lives under `src/mcp/vice/` and imports only sibling in-repo modules plus Node built-ins, matching `disasm-decoder.ts`'s own "no `node:` builtin" discipline for the pure-parsing core.

## The five text formats, verbatim, with column layout

All five samples below are quoted **exactly** from the committed fixtures at `src/mcp/vice/fixtures/textmon/*-stock.txt`, opened and read this session. `[VERIFIED: src/mcp/vice/fixtures/textmon/*-stock.txt, read in full this session]` for every quoted line below; provenance for each fixture is the five-key sidecar (`capturedFrom`, `viceVersion`, `capturedAt`, `command`, `synthetic: false`) in the matching `.json`, also read this session.

### 1. `memmapshow` -> `access-map-stock.txt` (1,624,557 bytes, 43,358 lines)

```
(C:$e5d1) addr: IO  ROM RAM
0000: --- --- rw- (dummy)
0001: --- --- rw-
...
d000: -w- --- ---
...
a000: --- r-- -w-
...
ab2b: --- r-x ---
...
ff58: --- --x ---
...
fffc: --- r-- ---
fffd: --- r-- ---
fffe: --- r-- ---
ffff: --- r-- ---
(C:$e5d1) 
```

Header line: `addr: IO  ROM RAM`. Each data line: `<4-hex-digit addr>: <3-char IO glyph> <3-char ROM glyph> <3-char RAM glyph>` optionally followed by ` (dummy)` on stock, and (on the fork build only — see below) ` (uninitialized read)` / ` (uninitialized exec)`. **Only addresses with at least one recorded access bit are emitted** — a bare `continue` in VICE's own C loop skips zero-access addresses, so a parser must not assume all 65,536 addresses appear.

**Framing note (from the fixture batch's own README, itself read this session):** `memmapshow`'s reply is the **only** one of the five that carries a *leading* entry-echo prompt (`(C:$e5d1) ` at the very start, before the header line) in addition to the trailing exit prompt — the other four begin directly with their own output. A parser (or its caller) must strip both, and must not assume every reply has the leading form.

### 2. `prof flat 5` -> `flat-profile-stock.txt` (509 bytes)

```
        Total      %          Self      %
------------- ------ ------------- ------
2 326 151  98,5% 2 326 151  98,5% ffcf                                    
     34 897   1,5%      17 031   0,7% ff48                                    
      8 968   0,4%       8 968   0,4% ea87                                    
      8 671   0,4%       8 671   0,4% ffea                                    
          161   0,0%           161   0,0% ea1c                                    
(C:$e5d1) 
```

Fixed columns: `Total` cycles, `%`, `Self` cycles, `%`, then a 4-hex-digit address, right/left-padded with spaces. **The thousands separator inside the cycle-count numbers is `U+202F` (NARROW NO-BREAK SPACE), encoded as the three UTF-8 bytes `e2 80 af` — not an ASCII space** `[VERIFIED: src/mcp/vice/fixtures/textmon/README.md, "## Encoding" section, read this session]`. The percent sign uses a comma decimal separator (`98,5%`), consistent with a non-`C` locale on the capturing host. A parser must decode the raw byte buffer (`textmon-fixtures.ts`'s `TextFixture.buffer`), not a lossily-decoded string, or these separators corrupt the numeric parse. `TextMonitorClient` itself already decodes the full response with `utf8` exactly once (`text-protocol.ts:523`, `#finishPending()`), so the parser receives a proper JS string with `U+202F` intact — the byte-vs-string caveat applies to fixture loading in tests, not to the live-wire path.

### 3. `chis 4` -> `cpu-history-stock.txt` (326 bytes)

```
.C:e5d1  8D 92 02    STA $0292      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302187
.C:e5d4  F0 F7       BEQ $E5CD      A:00 X:00 Y:0a SP:f3 ..-...Z.     11302191
.C:e5cd  A5 C6       LDA $C6        A:00 X:00 Y:0a SP:f3 ..-...Z.     11302194
.C:e5cf  85 CC       STA $CC        A:00 X:00 Y:0a SP:f3 ..-...Z.     11302197
(C:$e5d1) 
```

Per-entry columns: `.C:<addr>`, raw opcode bytes (space-separated hex), disassembled mnemonic+operand, `A:.. X:.. Y:.. SP:..`, an 8-character flag string (`..-...Z.` — NV-BDIZC order with `.` for unset), then a right-aligned decimal cycle count. This confirms `PARSE-02`'s "per-entry cycle counts on 3.9" claim directly: the fixture's `.json` sidecar states `"viceVersion": "x64sc (VICE 3.9)"` and every line above carries its own trailing cycle number.

### 4. `bt` -> `backtrace-stock.txt` (335 bytes)

```
             PC        .C:e5d1   8D 92 02    STA $0292
e112 -> ffcf [SP +  3] .C:e112   20 CF FF    JSR $FFCF
a562 -> e112 [SP +  5] .C:a562   20 12 E1    JSR $E112
a483 -> a560 [SP +  7] .C:a483   20 60 A5    JSR $A560
e39a -> e422 [SP + 11] .C:e39a   20 22 E4    JSR $E422
RST  -> fce2 [SP +-241] .C:3139   00          BRK
(C:$e5d1) 
```

First line is the current PC, unindented, no arrow. Each following line: `<caller addr or RST/IRQ/NMI> -> <callee addr> [SP +<signed decimal>] .C:<addr>   <raw bytes>    <mnemonic>`. The SP offset field can be negative (`[SP +-241]` above, verbatim — note the literal `+-` rather than a re-signed `-241`) and the reconstructed chain terminates at a reset/interrupt vector name (`RST`, and presumably `IRQ`/`NMI` per the same code path — not observed in this fixture, since it captured an idle KERNAL loop).

### 5. `io $d020` -> `register-decode-stock.txt` (1001 bytes)

```
VIC-II:
>C:d000  00 00 00 00  00 00 00 00  00 00 00 00  00 00 00 00   @@@@@@@@@@@@@@@@
>C:d010  00 9b 37 00  00 00 c8 00  15 71 f0 00  00 00 00 00   @.7@@@H@uQ.@@@@@
>C:d020  fe f6 f1 f2  f3 f4 f0 f1  f2 f3 f4 f5  f6 f7 fc ff   ................
>C:d030  ff ff ff ff  ff ff ff ff  ff ff ff ff  ff ff ff ff   ................

Raster cycle/line: 0/311 IRQ: 311
Mode: Standard Text (ECM/BMM/MCM=0/0/0)
Colors: Border: e BG: 6 
Scroll X/Y: 0/3, RC 7, Idle: 1, 40x25
VC $3e8, VCBASE $3e8, VMLI  0, Phi1 $ff
Video $0400, Charset $1000 (CharROM)

Sprites: S.0 S.1 S.2 S.3 S.4 S.5 S.6 S.7
Enabled:  no  no  no  no  no  no  no  no
DMA/dis:  /   /   /   /   /   /   /   / 
Pointer: $00 $00 $ff $ff $ff $ff $00 $00
MC:      $00 $00 $00 $00 $00 $00 $00 $00
MCBASE:  $00 $00 $00 $00 $00 $00 $00 $00
X-Pos:  $000$000$000$000$000$000$000$000
Y-Pos:     0   0   0   0   0   0   0   0
X/Y-Exp:  /   /   /   /   /   /   /   / 
Pri./MC: s/  s/  s/  s/  s/  s/  s/  s/ 
Color:     1   2   3   4   5   6   7   c
(C:$d040) 
```

Three sections: a raw hex+ASCII register dump (`>C:<addr>  <16 hex bytes in 4 groups of 4>   <ASCII>`); free-form decoded-semantics lines (raster position, mode, colors, scroll, VC/VCBASE/VMLI/Phi1, video/charset base); then a fixed 8-sprite table (enabled, DMA, pointer, MC, MCBASE, X/Y position, X/Y expand, priority/multicolor, color), one row per field, one column per sprite S.0–S.7. **Note the exit prompt for this one command is `(C:$d040)`, not `(C:$e5d1)` like the other four** — the address the CPU happens to be paused at when the monitor re-enters differs per command in this capture; a parser must not hard-code the prompt's address, only its `(C:$xxxx)` shape (already `text-protocol.ts`'s `PROMPT_RE` job, not the parser's).

## Inventory: what's already captured vs. what Phase 42 must capture

**Nothing new needs to be captured to build and unit-test all five parsers.** The full inventory, cross-checked against `src/mcp/vice/fixtures/textmon/` (`ls`, read this session) and `src/mcp/vice/fixtures/textmon/README.md` (read in full this session):

| Command group | Stock (3.9) fixture | Fork (3.10) fixture | Loader case names |
|---|---|---|---|
| `access-map` (`memmapshow`) | ✅ `access-map-stock.{txt,json}` | ✅ `access-map-fork.{txt,json}` | `access-map-stock`, `access-map-fork` |
| `flat-profile` (`prof flat 5`) | ✅ `flat-profile-stock.{txt,json}` | ✅ `flat-profile-fork.{txt,json}` | `flat-profile-stock`, `flat-profile-fork` |
| `cpu-history` (`chis 4`) | ✅ `cpu-history-stock.{txt,json}` | ✅ `cpu-history-fork.{txt,json}` | `cpu-history-stock`, `cpu-history-fork` |
| `backtrace` (`bt`) | ✅ `backtrace-stock.{txt,json}` | ✅ `backtrace-fork.{txt,json}` | `backtrace-stock`, `backtrace-fork` |
| `register-decode` (`io $d020`) | ✅ `register-decode-stock.{txt,json}` | ✅ `register-decode-fork.{txt,json}` | `register-decode-stock`, `register-decode-fork` |
| `connect-banner` (no command) | ✅ 0 bytes | ✅ 0 bytes | `connect-banner-stock`, `connect-banner-fork` |

All twelve pairs (six groups × two binaries) exist, are `"synthetic": false`, and are loadable today via `loadTextFixture(caseName)` from `src/mcp/vice/textmon-fixtures.ts` (also already committed, with its own `textmon-fixtures.test.ts`). `[VERIFIED: src/mcp/vice/fixtures/textmon/ directory listing and file contents, read this session]`.

**What this phase's own PARSE-03 requirement still needs beyond this batch:** the ROADMAP's success criterion 4 requires "a planted fixture carrying an unrecognised enum value" to prove the refusal path — that is a synthetic, deliberately-corrupted fixture the phase must construct itself (see "Common Pitfalls" / "the unrecognised-value refusal control" below), not a second live capture. The existing batch's own README states plainly: `FIXTURE_UNSUPPORTED: none` — no command in this batch ever refused, on either binary — so a live PARSE-04 build-capability-missing fixture is also not obtainable from this batch and would need either a `--disable-cpuhistory` VICE rebuild (out of scope / not requested) or a synthetic fixture carrying VICE's own known stub string (see PARSE-04 findings below), the latter being the pragmatic route.

## `memmapshow`'s access-class encoding: execute confirmed as its own bit, for both RAM and ROM

**MEASURED from VICE upstream source, read in full this session** (`/home/henrik/Downloads/vice-3.8/src/monitor.h:250-258`, a locally-present, unmodified VICE 3.8 checkout — not this project's own repo, but the authoritative C source the wire behaviour is generated from):

```
#define MEMMAP_I_O_R    (1 << 8)
#define MEMMAP_I_O_W    (1 << 7)
#define MEMMAP_I_O_X    (1 << 6)
#define MEMMAP_ROM_R    (1 << 5)
#define MEMMAP_ROM_W    (1 << 4)
#define MEMMAP_ROM_X    (1 << 3)
#define MEMMAP_RAM_R    (1 << 2)
#define MEMMAP_RAM_W    (1 << 1)
#define MEMMAP_RAM_X    (1 << 0)
```

Nine independent bits, three per column (I/O, ROM, RAM), each with its own `_R`/`_W`/`_X` suffix. The print function (`/home/henrik/Downloads/vice-3.8/src/monitor/mon_memmap.c:307-317`, read this session) emits each bit as its own glyph character, in fixed `rwx` order, `-` when absent:

```
mon_out(line_fmt, addr,
        (b & MEMMAP_I_O_R) ? 'r' : '-',
        (b & MEMMAP_I_O_W) ? 'w' : '-',
        (b & MEMMAP_I_O_X) ? 'x' : '-',
        (b & MEMMAP_ROM_R) ? 'r' : '-',
        (b & MEMMAP_ROM_W) ? 'w' : '-',
        (b & MEMMAP_ROM_X) ? 'x' : '-',
        (b & MEMMAP_RAM_R) ? 'r' : '-',
        (b & MEMMAP_RAM_W) ? 'w' : '-',
        (b & MEMMAP_RAM_X) ? 'x' : '-');
```

This is independently reconfirmed by the committed fixture itself — every distinct 9-character glyph combination that appears in `access-map-stock.txt`, extracted this session with a column-wise scan:

```
IO=--- ROM=--- RAM=r--
IO=--- ROM=--- RAM=rw-
IO=--- ROM=r-- RAM=---
IO=--- ROM=r-- RAM=-w-
IO=--- ROM=r-x RAM=---
IO=--- ROM=--x RAM=---
IO=r-- ROM=--- RAM=---
IO=rw- ROM=--- RAM=---
IO=-w- ROM=--- RAM=---
```

`ROM=r-x` (56 occurrences) and `ROM=--x` (execute recorded with **no** accompanying read, 3 occurrences at `a408`/`a40a`/`a434`) both appear in this single capture — direct, live proof that ROM's execute bit is tracked independently of its read bit, not folded in. **RAM's execute bit did not fire in this particular capture** (the machine was idle at a KERNAL loop the whole window, executing only ROM) — its independence is established by the same C source (`MEMMAP_RAM_X = 1 << 0`, structurally identical to `MEMMAP_ROM_X`) but is not itself directly evidenced by this specific fixture's byte content. This is worth flagging to the planner as a residual gap: **the committed fixture batch alone does not contain a RAM-execute example**, so a parser test asserting RAM-execute decoding correctly will need either a synthetic fixture line (cheap, and matches this project's existing "synthetic literal line, not a synthetic whole-file fixture" pattern used elsewhere) or a supplementary capture that runs code from RAM (e.g. during a `.prg` autostart) before issuing `memmapshow`.

**The fork build carries a fourth generation of annotation not present in the plain upstream 3.8 tree.** `/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor/mon_memmap.c:349-352` (read this session):

```
(b & MEMMAP_RAM_R) && (!(b & MEMMAP_REGULAR_READ)) ? " (dummy)" : "",
(b & MEMMAP_UNINITIALIZED_READ) ? " (uninitialized read)" : "",
(b & MEMMAP_UNINITIALIZED_EXEC) ? " (uninitialized exec)" : ""
```

`MEMMAP_REGULAR_READ` is defined at `/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor.h:255` as `(1 << 9)   /* NOT just a dummy read */`. The committed `access-map-stock.txt` fixture already exercises the `(dummy)` suffix (677 occurrences, `[VERIFIED: grep -c '(dummy)' access-map-stock.txt, read this session]`) but **not** `(uninitialized read)`/`(uninitialized exec)` — neither string appears in either committed fixture (`grep` over both `access-map-{stock,fork}.txt` this session returned zero matches for both). A parser built only against the committed fixtures will therefore never see these two suffixes in its own test data; a hand-written synthetic fixture line is the only way to exercise that branch before it occurs naturally.

## Drift citations: re-verified against raw VICE source this session — one confirmed exactly, two need correction

Two full VICE source/NEWS trees are present on this host and were read this session:
- `/home/henrik/Downloads/vice-3.8/` — an unmodified upstream VICE 3.8 checkout (`NEWS`, 6390 lines, sections for every release back to 0.11.0)
- `/home/henrik/dev/henrik/git/vice-mcp/vice/` — this project's fork source tree, at `VICE_VERSION_MAJOR 3` / `VICE_VERSION_MINOR 10` per `src/version.h:31-38` (read this session), whose `NEWS` file additionally has the "3.10" section covering what the upstream 3.8 tree cannot show

**mc/ms glyph inversion — CONFIRMED at VICE 3.4, exact wording matches the ROADMAP's claim.** `[VERIFIED: /home/henrik/Downloads/vice-3.8/NEWS:1768-1769, read this session]`, independently reconfirmed in the fork's own copy at `[VERIFIED: /home/henrik/dev/henrik/git/vice-mcp/vice/NEWS:2213-2214, read this session]`. Both trees carry the identical line, inside the `* Changes in Vice 3.4` section (header confirmed at `NEWS:1638` in the 3.8 tree, `NEWS:2083` in the fork tree):

> `in mc/ms commands show asterisk for 1s and dots for 0s, not the other way around`

This is the exact semantic-inversion-with-no-syntax-change shape the ROADMAP describes, and the version attribution (3.4) is correct.

**chis's cycle-column widening — the ROADMAP's "3.0" attribution is NOT supported by either NEWS file read this session; the real events are at 3.5–3.7.** No occurrence of `chis` or "cycle" appears anywhere inside the VICE 3.0 section of either tree (`[VERIFIED: sed -n over NEWS:2371-2664 (3.8 tree) and NEWS:2816-3109 (fork tree), both read this session, zero matches for "chis" or "cycle"]`). What the NEWS files actually record, all confirmed by section-header line numbers read this session:

- VICE 3.5 (`NEWS:1185` in the 3.8 tree): `` `chis` shows the cycle count as well now `` — the cycle count's first appearance.
- VICE 3.6 (`NEWS:780` in the 3.8 tree): `'chis' command now prints a 12 digit cycle counter.` — the actual *widening* (to 12 digits).
- VICE 3.7 (`NEWS:334` in the 3.8 tree): `Fix cycle count stored into the cpu history (only x64sc)` — a correctness fix, not a widening.

**memmapshow access-class addition — the ROADMAP's "3.5" attribution is NOT supported by either NEWS file read this session; the fork's NEWS dates the actual addition to 3.9/3.10.** No occurrence of "memmap" appears inside the VICE 3.5 section of either tree (`[VERIFIED: sed -n over the 3.5 section boundaries in both trees, read this session, zero matches]`). What does exist: the fork's own `NEWS:413` (inside the `* Changes in Vice 3.10` section, header at `NEWS:26`, with no separate 3.9 section in this tree — read this session) states:

> `memmap extension: show reads of non initialized ram.`

This is the real upstream event behind the `(uninitialized read)`/`(uninitialized exec)` annotations confirmed in the fork's `mon_memmap.c` above — it exists and is real, but at 3.9/3.10, not 3.5. The only NEWS mention of "memmap" at all in the 3.8 tree is the *original* feature's introduction at VICE 2.0 (`NEWS:3642`, inside the `* Changes in VICE 2.0` section header at `NEWS:3479`): "New memmap feature which allows tracking of memory accesses, activated by the configure option --enable-memmap" — a different, much older event (the feature's birth, not an access-class widening).

**What this means for the phase.** The ROADMAP's underlying *thesis* — that format drift across VICE releases is real, semantic, and has hit exactly these three commands (`mc`/`ms`, `chis`, `memmapshow`) — is now MEASURED-confirmed for two of the three (chis and memmapshow drift are real, just at different version numbers than stated) and exactly confirmed for the third (`mc`/`ms` at 3.4). The specific version numbers "3.0" and "3.5" in the ROADMAP note should be corrected to "3.5–3.6" and "3.9–3.10" respectively before they are quoted in any shipped user-facing documentation this phase produces — the ROADMAP's own note already flagged them as not-yet-quotable pending this re-check, and this re-check found real corrections, not confirmation.

## PARSE-04: the build-capability probe, per command — what was MEASURED vs INFERRED

Two of the five commands share a **single** build-time guard; the other three carry no build-time guard found in the source read this session.

**`memmapshow` and `chis` (MEASURED, source-level, same file/macro).** `/home/henrik/Downloads/vice-3.8/src/monitor/mon_memmap.c:52` opens `#ifdef FEATURE_CPUMEMHISTORY`, closing at line 330; the `#else` stub block runs from line 422 to 459 and implements **both** `mon_memmap_show()` (backs `memmapshow`) and `mon_cpuhistory()` (backs `chis`) as calls to the same helper:

```
static void mon_memmap_stub(void)
{
    mon_out("Disabled. configure with --enable-cpuhistory and recompile.\n");
}
```

`[VERIFIED: /home/henrik/Downloads/vice-3.8/src/monitor/mon_memmap.c:422-459, read this session]`. Both commands, if the build lacks the feature, print the **exact same string** (`"Disabled. configure with --enable-cpuhistory and recompile.\n"`) — this is the observable signal a PARSE-04 probe keys on for these two commands, and it is the same string for both, contrary to the ROADMAP note's framing that no two commands share a guard. The build flag itself is confirmed opt-**out** by default: `/home/henrik/Downloads/vice-3.8/configure.ac:120` (`VICE_ARG_ENABLE_LIST(cpuhistory, [--disable-cpuhistory disable the 65xx cpu history feature])`) and line 521 (`AS_IF([test x"$enable_cpuhistory" != "xno"], [AC_DEFINE(FEATURE_CPUMEMHISTORY,...)])`) — the feature is compiled in unless the builder explicitly passes `--disable-cpuhistory`, confirming the "opt-out at build time" polarity CLAUDE.md's own narrowed constraint already states, now traced to the exact macro and configure flag.

**`bt` (backtrace) — no build-time guard found (MEASURED, absence).** `mon_backtrace()` (`/home/henrik/Downloads/vice-3.8/src/monitor/monitor.c:1156`) has no `#ifdef` around it, and reads from `callstack_size`/`callstack_pc_src`/`callstack_pc_dst`/`callstack_sp`, all defined unconditionally in `profiler.c` (`[VERIFIED: /home/henrik/Downloads/vice-3.8/src/profiler.c:49-51, read this session, no #ifdef anywhere in the file]`). This command is always built; PARSE-04 has nothing to probe for it beyond "the tool call succeeded."

**`prof flat` — no build-time guard found (MEASURED, absence).** `mon_profile.c` carries no `#ifdef` at all (`[VERIFIED: grep -n "#if" mon_profile.c, read this session, zero matches]`). Same conclusion as `bt`.

**`io` (register decode) — no build-time guard found; the observable failure mode is a text message, not a refusal (MEASURED, absence + code path).** The command is registered unconditionally in the base command table (`/home/henrik/Downloads/vice-3.8/src/monitor/mon_command.c:502`). Its dump path (`mon_ioreg_add_list()`/the iterator around it, `monitor.c:1980-2000`, read this session) degrades gracefully per-chip: `"No details available.\n"` when a specific register has no dump function, or `"No I/O regs available\n"` when the list itself is empty for the current bank — neither is a hard refusal, and on a real C64 target with VIC-II support (always built for `x64sc`) this path is not expected to fire at all. **INFERRED, not measured live:** this project did not build a VICE binary with `--disable-cpuhistory` this session (out of scope per the live-probing rules — no destructive rebuild was performed), so the *runtime* string was traced from source, not observed over a live socket. A future plan should still capture this live if a `--disable-cpuhistory` build becomes available, but source-level tracing is a strong signal here since the string is a fixed literal with no formatting.

**Consequence for PARSE-04's design:** the probe cannot be "one guard per command" as literally stated, nor "one guard for all five" — it is closer to "one shared guard for two commands (`memmapshow`/`chis`), no guard for two more (`bt`/`prof flat`), and a graceful-degradation text signal rather than a refusal for the fifth (`io`)." A PARSE-04 implementation should probe and cache **per command, per binary** as the ROADMAP already directs, but a parser (or the probe layer above it) can special-case the shared string so a `memmapshow`-disabled build is not separately re-probed from a `chis`-disabled build if both come back with the identical text — though probing both independently is also correct and simpler; this is a design choice, not a correctness requirement, since the two commands are always compiled together (same macro) in practice.

## Existing seam patterns this phase must mirror

### The transport boundary: `text-protocol.ts` (already built, do not modify its framing discipline)

`src/mcp/vice/text-protocol.ts` (606 lines) is the one place that frames text-monitor bytes. Two facts constrain this phase directly:

1. **`TEXT_COMMAND_ALLOWLIST` is a closed set of exact literal strings, currently with no parameters** (`text-protocol.ts:90-99`, read this session):
   ```
   export const TEXT_COMMAND_ALLOWLIST = Object.freeze([
     "device c:",
     "warp on",
     "warp off",
     "memmapshow",
     "prof flat",
     "chis",
     "bt",
     "io",
   ] as const);
   ```
   `command(cmd)` (`text-protocol.ts:373-423`) checks `isAllowlistedTextCommand(cmd)` against this exact array — no substring or prefix matching. The committed fixtures were captured with `chis 4`, `prof flat 5`, and `io $d020` (all with parameters), which are **not** members of this array today. **This is the single largest open architecture question for this phase**, flagged explicitly in the file's own header comment: "a ninth entry is a conscious edit here, never a speculative widening" (`text-protocol.ts:86-88`) — the comment anticipates the array growing, but says nothing about parameterization. `memmapshow` and `bt` need no parameter and can be issued as-is; `chis`, `prof flat`, and `io` need a validated-parameter design (e.g., a bounded count for `chis`/`prof flat`, a 16-bit hex address for `io`) added to `text-protocol.ts` before their tools can dial VICE with anything other than defaults. This decision belongs to this phase, not a prerequisite Phase 41 already resolved — `41-CONTEXT.md`'s own D-02 confirms "the two remedy tools ship now; the five Phase-42 commands stay behind the internal allowlist," with no parameter design recorded there.

2. **Never call `command()` outside `withTextChannelLock()`.** Every new tool handler this phase adds must follow `text-tools.ts`'s existing `withTextTool()` wrapper pattern (below) rather than calling `TextMonitorClient.command()` directly.

### The pure-function shape: `disasm-decoder.ts` (the model to copy)

`src/mcp/vice/disasm-decoder.ts` (272 lines) is the closest existing analogue named in the ROADMAP, and its shape is worth copying almost mechanically:

- Single exported `decode(bytes, startAddress, opts) -> Instruction[]` function, no class.
- **Never throws** — malformed input returns `[]` or a structured `notes` array (e.g. `"truncated"`), never an exception (`disasm-decoder.ts:142-150`).
- Imports only its sibling `disasm-opcodes.ts` — no `node:` builtin, no transport module (`disasm-decoder.ts:44`, and the file's own header states this as a hard rule).
- A closed union type for structured notes (`DisasmNote`, `disasm-decoder.ts:51`) rather than a free string, so a consumer can switch exhaustively.
- Test file colocated: `disasm-decoder.test.ts`.
- A companion pure renderer (`disasm-renderer.ts`) that turns the decoded structure back into text — the parser/renderer split is a precedent worth following if any of the five formats need a round-trip or display path, though nothing in this phase's requirements demands one.

**Recommended per-format module naming**, following this repo's existing `disasm-*`/`stock-*`/`text-*` prefix conventions and the sibling `textmon-fixtures.ts` module already using the `textmon-` prefix: `textmon-memmap.ts`, `textmon-profile.ts`, `textmon-cpuhistory.ts`, `textmon-backtrace.ts`, `textmon-registers.ts`. Each takes the already-framed, prompt-stripped string `TextMonitorClient.command()` returns (or a fixture's `.text`/`.buffer`) and returns a typed structure or throws a single, named `TextParseError`-style refusal (mirroring `TextFramingError`'s own naming pattern in `text-protocol.ts:132`) for an unrecognised value — never a plausible-looking wrong answer. `[VERIFIED: src/mcp/vice/disasm-decoder.ts, full file read this session]`.

### Provenance and fixtures: `textmon-fixtures.ts` (already built — reuse, do not re-derive)

`src/mcp/vice/textmon-fixtures.ts` (209 lines) already implements everything PARSE-03's fixture-provenance requirement needs:

- `loadTextFixture(caseName, { dir })` — throws `MissingTextFixtureError` naming the expected path and the regenerating command if either file is missing, malformed, or missing a required provenance key.
- `REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"]` (`textmon-fixtures.ts:51`) — the same five keys `binmon-fixtures.ts` already established for the binary side, reimplemented (not imported) per that file's own documented reason (D-18: "the CONTRACT is shared, the module is not").
- `listTextFixtures({ dir })` — every case with both a `.txt` and a `.json` present.
- Returns `{ buffer, provenance, text, synthetic }` — `buffer` is the authoritative byte-exact payload (needed for `flat-profile`'s `U+202F` separators); `text` is a UTF-8 convenience decode.

Test file: `textmon-fixtures.test.ts` (already committed). **This phase's parser tests should import `loadTextFixture` from this module directly** rather than hand-rolling a second loader.

### The closed-consumer-set / single-seam enforcement pattern: `hostpath-consumers.test.ts`

CLAUDE.md's "Architecture" bullet requires host-path logic to have a tested closed consumer set; `hostpath-consumers.test.ts` (684 lines) is where that discipline lives and is the concrete mechanism the planner should point to for PARSE-03's "exactly one owning module, asserted structurally" requirement. Key reusable shapes, all read in full this session:

1. **`topLevelProductionModules()` + a family-prefix regex + a hand-pinned, non-vacuity floor.** The `anno-` family uses `ANNO_MODULE_FLOOR` (a hand-pinned integer, never derived from disk, with an explicit "raised, never lowered" discipline and a companion "pinned equals measured" test that catches the count drifting either direction). The host-tool-execution-seam family (`host-tool*`, `ghidra*`, `dxa*`) uses the identical two-test pattern (`HOST_TOOL_FAMILY_FLOOR` + its own pinned-equals-measured companion) over a **second, independently pinned floor**, specifically because a family outside the first glob's prefix would otherwise be invisible to it (`hostpath-consumers.test.ts:440-446`). **A third such family floor for `textmon-*.ts` is the direct precedent this phase should follow** if the planner wants a structural, mechanically-enforced "one owning module per format" guard rather than convention alone.
2. **Named-absence-before-existence tests.** `hostpath-consumers.test.ts:207-212` and `:565-570` assert that specific module names *that do not exist yet* are absent from a consumer set — "the constraint is asserted before there is anything to violate it." This is the exact shape PARSE-03's "nothing outside the owning module reads the raw text" requirement wants: name the five new `textmon-*.ts` modules (and anything that must *not* import them, e.g. asserting only the parser's own test file and its designated MCP handler import it) before they exist.
3. **Planted-violation controls, run against the real predicate.** `hostpath-consumers.test.ts:383-392` and `:572-580` construct a synthetic source string that *does* violate the rule and assert the shared predicate catches it — proving the absence assertions above are capable of failing, not merely present. This is the general shape (a synthetic violating input run through the real checking function) PARSE-03's own "nothing outside the owning module reads the raw text" structural guard should copy, separate from the unrecognised-value refusal control described below.

**A parser-specific single-seam guard is a smaller, more direct fit than the full closed-consumer-set machinery above**, though: since each `textmon-*.ts` module is the *only* place that should call `String.prototype` methods, `RegExp`, etc. against a raw text-monitor payload, a simpler structural test — "the only files importing `textmon-fixtures.ts`'s fixture text (or receiving a `TextMonitorClient.command()` return value) for `<command>` are `textmon-<command>.ts` and its own test file" — is likely sufficient and cheaper to write than a full family-floor pattern; the planner should decide based on how many call sites five new modules realistically accumulate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading a captured text-monitor fixture with provenance validation | A second sidecar-JSON loader | `loadTextFixture()` (`textmon-fixtures.ts`) | Already built, already tested, already enforces the five required provenance keys |
| Deciding whether a byte string is a real capture or synthetic | A `capturedFrom`-string heuristic | `TextFixture.synthetic` (a real boolean, required key — a sidecar that omits it throws rather than silently reading `false`) | `textmon-fixtures.ts`'s own WR-09-mirrored discipline, ported from `binmon-fixtures.ts` |
| Framing a text-monitor reply (prompt detection, quiescence, banner-vs-command distinction) | Any regex/timeout scheme inside a parser module | `text-protocol.ts`'s `TextMonitorClient` | Already solved, with two planted RED/GREEN controls proving it; a parser must never see raw socket bytes at all — only the already-framed string |
| Thousands-separator-aware number parsing for `flat-profile` | A locale-aware `Intl.NumberFormat` guess | A literal `U+202F` strip/split on the known byte sequence, confirmed by the fixture | The separator is VICE's own fixed choice, not the host locale's — treating it as locale-dependent would break on a different capturing host |

**Key insight:** every piece of infrastructure below "parse this specific string shape" already exists in this repo and was purpose-built for exactly this phase by Phase 39 and Phase 41's own plans (`39-07`'s fixture batch, `41-0x`'s `textmon-fixtures.ts`). The actual net-new work in this phase is narrow: five parse functions, the allowlist parameterization decision, the per-command build-capability probe, and wiring five MCP tools through the existing `withDerivedTool`/`STOCK_DERIVED_TOOLS` registration pattern `vice_device_console`/`vice_warp_set` already demonstrate.

## Architecture Patterns

### System Architecture Diagram

```
 MCP tool call (vice_memmap_show, vice_prof_flat, vice_chis, vice_bt, vice_io_registers)
        |
        v
 stock-dispatch.ts: withDerivedTool(name, {needsSession:false}, handler)
        |
        v
 new tool handler (in each textmon-*.ts, or a thin wrapper in text-tools.ts
 calling into it) -- mirrors handleDeviceConsole()/handleWarpSet()
        |
        v
 withTextTool() (text-tools.ts) -- resolves lease, textConnect(), then:
        |
        v
 withTextChannelLock() (text-protocol.ts) -- acquires channel-lock.ts's mutex
        |
        v
 TextMonitorClient.command(cmd) -- cmd must be in (a possibly widened,
 possibly parameterized) TEXT_COMMAND_ALLOWLIST -- returns a raw, framed,
 prompt-stripped string. NO knowledge of what the string means.
        |
        v
 textmon-<format>.ts :: parse(text) -> TypedResult   <-- THIS PHASE'S NEW CODE
   (pure function: no socket, no timing, no channel-lock, no lease)
   - recognised value -> typed structure
   - unrecognised/drifted value -> named refusal (never a silent wrong guess)
        |
        v
 tool handler formats TypedResult into the MCP tool's JSON answer
        |
        v
 Claude session receives structured data (access map, profile, CPU history,
 backtrace, decoded registers) instead of a text blob to eyeball
```

Test-time path (no socket at all): `loadTextFixture(caseName)` (`textmon-fixtures.ts`) -> `.text` or `.buffer` -> `textmon-<format>.ts :: parse()` -> assert on the typed result. This is the path that should carry the bulk of this phase's own test suite, since it requires no live VICE and no broker.

### Recommended Project Structure

```
src/mcp/vice/
├── text-protocol.ts          # EXISTING -- framing, TEXT_COMMAND_ALLOWLIST (widen here)
├── text-tools.ts             # EXISTING -- withTextTool(), existing 2 handlers (add 5 more, or thin wrappers)
├── textmon-fixtures.ts       # EXISTING -- fixture loader, reuse as-is
├── textmon-memmap.ts         # NEW -- parse(text) -> AccessMap (per-address IO/ROM/RAM r/w/x)
├── textmon-memmap.test.ts    # NEW -- against access-map-{stock,fork} fixtures + planted unrecognised-glyph control
├── textmon-profile.ts        # NEW -- parse(text) -> ProfileEntry[] (ranked self/total cycles)
├── textmon-profile.test.ts   # NEW
├── textmon-cpuhistory.ts     # NEW -- parse(text) -> CpuHistoryEntry[] (per-entry cycle counts)
├── textmon-cpuhistory.test.ts# NEW
├── textmon-backtrace.ts      # NEW -- parse(text) -> BacktraceFrame[] (JSR chain, SP offsets)
├── textmon-backtrace.test.ts # NEW
├── textmon-registers.ts      # NEW -- parse(text) -> DecodedRegisters (VIC-II semantic view)
├── textmon-registers.test.ts # NEW
└── fixtures/textmon/          # EXISTING -- 12 real fixture pairs, reused unmodified
```

### Pattern 1: Pure parse(), never-throw-on-recognised-drift-but-refuse-on-unrecognised

**What:** Each `parse()` function processes line-by-line or via a small number of fixed regexes, and distinguishes two failure modes precisely: a value it can recognise but that looks unusual is still parsed (VICE's own output is trusted structurally); a value **outside the closed enum this parser knows about** (e.g. a memmap glyph other than `r`/`w`/`x`/`-`) throws a named error rather than guessing.

**When to use:** Every one of the five parsers, per PARSE-03's success criterion 4 ("a drifted format fails loudly instead of returning an inverted answer").

**Example (illustrative shape, not verbatim source — no such module exists yet in this repo):**
```typescript
// Source: pattern derived from disasm-decoder.ts's own never-throw-on-malformed-input
// discipline, inverted for the specific "must refuse on unrecognised enum" requirement
// PARSE-03 states explicitly (drift must be loud, not silently absorbed).
export class TextParseError extends Error {
  constructor(message: string, public readonly offendingLine: string) {
    super(message);
    this.name = "TextParseError";
  }
}

const GLYPH_RE = /^[rwx-]$/;

function parseAccessGlyph(ch: string): { read: boolean; write: boolean; execute: boolean } {
  // Recognised glyphs only: 'r', 'w', 'x', '-'. Anything else -- a future
  // VICE build using a different character for a new access class -- must
  // refuse rather than silently mapping to false.
  if (ch !== "r" && ch !== "-") throw new TextParseError(`unrecognised access glyph: ${JSON.stringify(ch)}`, ch);
  // ... (illustrative only)
}
```

### Anti-Patterns to Avoid

- **Building a generic `parseViceText(command, text)` dispatcher:** the five formats share nothing structurally (fixed columns vs. free-form sections vs. per-entry repeating blocks) — a shared dispatcher would immediately need a `switch` on command name anyway, at which point the "shared" abstraction is pure overhead. Five separate modules, matching `disasm-decoder.ts`'s own precedent of one file per concern, is simpler and testable in isolation.
- **Parsing `flat-profile`'s numbers as an ASCII string:** the `U+202F` thousands separator will silently corrupt a naive `parseInt` on a lossily-decoded string if the decode step ever changes; always confirm the parser is working from the full UTF-8-decoded string (which `TextMonitorClient` already guarantees) or the raw buffer, never a Latin-1/ASCII-only decode.
- **Assuming every reply has a leading entry-echo prompt:** only `memmapshow` does, in this fixture batch. A parser (or its caller) that unconditionally strips a leading `(C:$xxxx) ` from every command's reply will corrupt the other four formats' first line.

## Runtime State Inventory

**Not applicable — this is a greenfield phase, not a rename/refactor/migration.** No existing stored state, service config, OS-registered state, secrets, or build artifacts carry the string(s) this phase introduces (`memmapshow`/`prof flat`/`chis`/`bt`/`io` parser module names are new). Skipped per the trigger condition in the verification protocol.

## Common Pitfalls

### Pitfall 1: Treating `TEXT_COMMAND_ALLOWLIST`'s current entries as sufficient

**What goes wrong:** A plan that wires `vice_chis`/`vice_prof_flat`/`vice_io_registers` tools by calling `client.command("chis")` (bare, matching today's allowlist entry) will get VICE's *default* count/address rather than a caller-chosen one, silently limiting the tool's usefulness, or will attempt `client.command("chis 4")` and get refused outright by `isAllowlistedTextCommand()` since that exact string is not in the frozen array.
**Why it happens:** The allowlist's "ninth entry is a conscious edit" comment invites adding more literals but doesn't flag that literals can't carry runtime-chosen parameters at all.
**How to avoid:** Design and implement the parameter-handling extension to `text-protocol.ts` (bounded numeric count, or a validated 16-bit hex address, checked *before* any byte reaches the socket, matching `command()`'s existing "refuse before writing" discipline for the control-character check) as an explicit early task in this phase, before the three affected tool handlers are written.
**Warning signs:** A tool handler that only ever calls `chis`/`prof flat`/`io` with no arguments, or one that string-concatenates a caller-supplied value into a command string bypassing the allowlist check entirely (the exact anti-pattern `text-protocol.ts`'s own header comment forbids: "Never accept a caller-supplied, free-text command string").

### Pitfall 2: Assuming the fixture batch alone proves execute-as-own-bit for RAM

**What goes wrong:** A test suite that only asserts against `access-map-{stock,fork}.txt` will never exercise the RAM-execute (`--x` or `r-x` in the RAM column) decode path, since neither committed fixture contains one (the capture happened during an idle KERNAL loop, executing only ROM).
**Why it happens:** The fixture batch was captured for framing/coexistence purposes (Phase 39's `CHAN-01` gate), not specifically to exercise every access-class combination.
**How to avoid:** Add at least one synthetic, hand-constructed fixture line (or a small synthetic fixture file, following this repo's existing synthetic-fixture convention for cases "no live emulator can produce" — `binmon-fixtures.ts`'s own header names this exact rationale) asserting RAM-execute decodes correctly, alongside the real captures.
**Warning signs:** 100% pass rate against the committed fixtures with zero test coverage of a RAM-execute glyph combination.

### Pitfall 3: Missing the shared `FEATURE_CPUMEMHISTORY` guard between `memmapshow` and `chis`

**What goes wrong:** A PARSE-04 implementation that probes each of the five commands with a bespoke, per-command "missing capability" message will produce two different user-facing messages for what is, at the VICE source level, the exact same missing build feature — confusing rather than clarifying which single `./configure` flag would fix both.
**Why it happens:** The ROADMAP note's framing ("the commands do not share a single guard") is accurate for three of the five but not for `memmapshow`/`chis`, which this research found do share one.
**How to avoid:** When both `memmapshow` and `chis` return VICE's own literal string `"Disabled. configure with --enable-cpuhistory and recompile."`, a PARSE-04 message can name both commands and the one remedy (`--enable-cpuhistory`) together, rather than implying two independent gaps.
**Warning signs:** A capability-probe design with five entirely independent code paths and five independently-worded user messages when two of them are provably the same underlying gap.

### Pitfall 4: The unrecognised-value refusal control — where the established shape lives

**What it should look like, established precedent:** `text-protocol.test.ts` (Phase 41) already implements the exact "planted RED, without the fix" / "fixed, GREEN" A/B pattern PARSE-03's success criterion 4 asks for, for a **different** invariant (quiescence-window framing, not enum recognition) — see `text-protocol.test.ts:229-269` ("Control 2 (planted RED, without the fix)" paired with "Control 2 (fixed, GREEN)"), read this session. The shape to copy for PARSE-03: construct a synthetic fixture text carrying a glyph or field VICE has never emitted in any committed fixture (e.g. a `memmapshow` line using `z` instead of `r`/`w`/`x`/`-`, or a `chis` flag-string character outside `NV-BDIZC.`), assert the real parser throws its named refusal error on it, and pair it with a second assertion that the same parser accepts every real committed fixture without throwing — proving the control is discriminating (it would have failed against a version of the parser that maps every unrecognised character to `false`/absent, exactly the "silently absorbed" failure mode the requirement names).

## Code Examples

### Loading a committed fixture in a new parser's test file

```typescript
// Source: src/mcp/vice/textmon-fixtures.ts (already committed), read this session
import { loadTextFixture } from "./textmon-fixtures.ts";

const stockFixture = loadTextFixture("access-map-stock");
const forkFixture = loadTextFixture("access-map-fork");
// stockFixture.text -- UTF-8 convenience string
// stockFixture.buffer -- authoritative bytes (needed for flat-profile's U+202F separators)
// stockFixture.provenance -- { capturedFrom, viceVersion, capturedAt, command, synthetic }
// stockFixture.synthetic === false -- real hardware capture, not a hand-written fixture
```

### The existing derived-tool registration pattern, to mirror for the five new tools

```typescript
// Source: src/mcp/vice/stock-derived.ts:117-118 and stock-dispatch.ts:830-831, read this session
// STOCK_DERIVED_TOOLS (stock-derived.ts):
//   "vice_device_console", // Plan 41-06, CHAN-03 -- text-channel remedy tool, needsSession:false (text-tools.ts)
//   "vice_warp_set",       // Plan 41-06, CHAN-03 -- text-channel remedy tool, needsSession:false (text-tools.ts)
// stock-dispatch.ts's dispatch table:
//   vice_device_console: withDerivedTool("vice_device_console", { needsSession: false }, handleDeviceConsole),
//   vice_warp_set: withDerivedTool("vice_warp_set", { needsSession: false }, handleWarpSet),
```
Every new tool this phase adds (`vice_memmap_show`, `vice_prof_flat`, `vice_chis`, `vice_bt`, `vice_io_registers`, or whatever names the planner settles on) needs a matching entry in `STOCK_DERIVED_TOOLS`, a matching dispatch-table entry using `withDerivedTool(name, { needsSession: false }, handler)` (the same `needsSession: false` configuration `vice_device_console`/`vice_warp_set`/`vice_diagnose`/`vice_symbols_load` already use — the file's own comment explains why: a text-channel handler wrapped in `needsSession: true`'s binary-channel mutex would self-deadlock), and a corresponding entry in `hostpath-consumers.test.ts`'s `DERIVED_TOOL_MODULES` map (`hostpath-consumers.test.ts:642-658`) naming which module implements it, plus a `D-05-12`-style test confirming that module's filename exists on disk.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `chis`'s cycle count absent | `chis` shows cycle count | VICE 3.5 (NEWS-confirmed, this session) | Any parser targeting pre-3.5 VICE would need a fallback path with no cycle field — out of scope; this project targets 3.9/3.10 only |
| `chis`'s cycle count at unspecified width | 12-digit cycle counter | VICE 3.6 (NEWS-confirmed, this session) | Column-width assumptions in a parser should not assume a fixed digit count below 12 |
| `mc`/`ms` glyphs: 1=dot, 0=asterisk (or vice versa — the pre-3.4 polarity is not itself quoted in the NEWS entry) | asterisk for 1s, dots for 0s | VICE 3.4 (NEWS-confirmed, this session) | Not directly relevant to this phase's five commands (`mc`/`ms` are out of scope per ROADMAP's "Out of Scope" table — this project declined the text-monitor assembler/disassembler), but is the concrete proof-of-concept for "semantic drift, no syntax change" the whole PARSE-03 refusal defence is built around |
| `memmapshow` with r/w/x bits only | `memmapshow` additionally annotates `(dummy)`/`(uninitialized read)`/`(uninitialized exec)` | VICE 3.9/3.10 (fork NEWS-confirmed, this session — not 3.5 as the ROADMAP note stated) | A parser built only against upstream-3.8-shaped output (no annotations) would silently drop information the fork build actually emits; both committed fixtures already carry `(dummy)`, so a parser ignoring the suffix entirely would already be measurably incomplete against fixtures on disk today |

**Deprecated/outdated:** Nothing in this phase's own scope is deprecated; the drift table above documents version *additions*, not removals.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `io`'s build-time failure mode (`"No details available."` / `"No I/O regs available"`) was traced from source, not observed live against a `--disable-cpuhistory`-style rebuild targeting `io` specifically (no such flag exists for `io`; this describes a different, always-reachable degradation path) — no live counter-example was run | PARSE-04 findings | If a future VICE build guards `io` behind a flag this research didn't find, a probe keyed only on the two degradation strings named here would misclassify a genuine "command unsupported" state as "chip has no registers here" |
| A2 | The recommended module names (`textmon-memmap.ts`, `textmon-profile.ts`, etc.) and the five new MCP tool names (`vice_memmap_show`, `vice_prof_flat`, etc.) are this research's own suggestion, following existing naming conventions, not a decision already locked anywhere in ROADMAP.md, REQUIREMENTS.md, or a CONTEXT.md (none exists for this phase) | Architecture Patterns / Code Examples | The planner should treat these as a starting proposal, not a fixed contract — a different naming choice does not violate any research finding |
| A3 | `TEXT_COMMAND_ALLOWLIST`'s parameterization needs a *design decision* this phase must make (bounded count vs. hex address validation shape); no prior phase recorded one | Existing seam patterns / Pitfall 1 | If a parameterization design already exists somewhere this research did not find (e.g. a discarded draft in an earlier phase's discussion log), redesigning from scratch would be wasted effort — worth a quick grep before starting |

## Open Questions

1. **Should the five new tools' parameter validation (count bounds, address range) live in `text-protocol.ts` (widening the allowlist mechanism itself) or in each `textmon-*.ts` module (validate, then hand a literal-safe string to a possibly-unwidened allowlist check)?**
   - What we know: `text-protocol.ts`'s own header comment anticipates the array widening ("a ninth entry...") but the file's existing design is built around exact-literal-string membership, not a parameterized-pattern check.
   - What's unclear: whether widening `isAllowlistedTextCommand()` to accept a per-verb validator function is an acceptable structural change to a file whose header explicitly warns "never re-implement text-wire framing" elsewhere, or whether the safer path is keeping `TEXT_COMMAND_ALLOWLIST` purely literal and having each tool handler select from a small, pre-enumerated set of literal command strings (e.g. `chis 1` through `chis 65535` is clearly infeasible to enumerate, so some validated-parameter mechanism is unavoidable for at least `chis`/`prof flat`/`io`).
   - Recommendation: this is exactly the kind of design decision that should go through `/gsd-discuss-phase 42` before planning locks it in, since it changes a file two other phases (39, 41) already built and tested carefully.

2. **Does PARSE-04's probe result get cached at the broker/instance level, the process level, or per-call?**
   - What we know: the ROADMAP requires "the answer cached per binary" — implying the probe should not re-run on every tool call.
   - What's unclear: whether "per binary" means keyed by the resolved absolute path (`stock:/usr/bin/x64sc` vs `fork:/usr/local/bin/x64sc`, mirroring `fixture-capture.mjs`'s own `capturedFrom` derivation approach) or by some other identity, and whether the cache should live in the MCP proxy process (reset on restart) or persist under `.c64-re-tools/` (surviving restarts).
   - Recommendation: reuse the `capturedFrom` derivation pattern (`stock:<resolved-path>` / `fork:<resolved-path>`, never operator-supplied) as the cache key, matching the fixture batch's own already-proven approach to avoiding the binmon side's historical two-month mislabelling incident (named in `fixtures/textmon/README.md`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Genuine stock VICE (`x64sc`) | Building/testing parsers against real output; a fresh fixture capture if the planner wants to extend the batch | ✓ | `x64sc (VICE 3.9)`, `/usr/bin/x64sc` | — |
| Fork VICE (`x64sc`) | Same, for the second binary of the two-binary requirement | ✓ | `x64sc (VICE 3.10)`, shadows stock on `$PATH`, resolved by absolute path in this project's own tooling | — |
| VICE upstream source tree (for drift verification) | Re-confirming NEWS/source citations | ✓ | `/home/henrik/Downloads/vice-3.8/` (unmodified upstream 3.8 checkout) | — |
| VICE fork source tree (for drift verification, 3.9/3.10-era changes) | Confirming the fork-only `mon_memmap.c` annotations and 3.10-section NEWS entries | ✓ | `/home/henrik/dev/henrik/git/vice-mcp/vice/` (`VICE_VERSION_MINOR 10`) | — |
| `node:test` / Node ≥ 24 | Running the new parser test files | ✓ | project floor, already in use throughout `src/mcp/vice/` | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none — everything this phase needs to build and test the five parsers against real data is already present on this host and already committed to the repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (no separate framework — matches every other file in `src/mcp/vice`) |
| Config file | none — invoked directly via `node --test` |
| Quick run command | `cd src/mcp/vice && node --test textmon-memmap.test.ts textmon-profile.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-registers.test.ts` (per-file, once these exist) |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (`node test-gate.mjs`, the project's own MANUAL_ONLY_TESTS-aware gate — per this user's own recorded floor, this hides some pre-existing failures unrelated to this phase; do not treat a non-zero floor as this phase's own regression without diffing against the pre-existing count first) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | `memmapshow` parses to a per-address access map with execute as its own bit, RAM and ROM alike | unit | `node --test textmon-memmap.test.ts` | ❌ Wave 0 |
| PARSE-02 | `prof flat`/`chis`/`bt`/`io` parse to structured results (ranked cycles, per-entry cycle counts, JSR chain, decoded registers) | unit | `node --test textmon-profile.test.ts textmon-cpuhistory.test.ts textmon-backtrace.test.ts textmon-registers.test.ts` | ❌ Wave 0 |
| PARSE-03 | Exactly one owning module per format; nothing else reads raw text; two-binary fixture provenance; unrecognised value refuses loudly | unit + structural | `node --test textmon-*.test.ts hostpath-consumers.test.ts` (extended) | ❌ Wave 0 (new structural assertions in `hostpath-consumers.test.ts` or a sibling) |
| PARSE-04 | Missing build capability named, per command, per binary; probed independently, cached | unit (probe logic against synthetic "disabled" strings) + a live smoke check if a `--disable-cpuhistory` build is ever available | `node --test` against a new probe module's test file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new test file(s) the task touches
- **Per wave merge:** `npm run test:automated`
- **Phase gate:** Full suite green (against the pre-existing baseline, not zero) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `textmon-memmap.ts` + `textmon-memmap.test.ts` — covers PARSE-01
- [ ] `textmon-profile.ts` + `textmon-profile.test.ts` — covers half of PARSE-02
- [ ] `textmon-cpuhistory.ts` + `textmon-cpuhistory.test.ts` — covers half of PARSE-02
- [ ] `textmon-backtrace.ts` + `textmon-backtrace.test.ts` — covers half of PARSE-02
- [ ] `textmon-registers.ts` + `textmon-registers.test.ts` — covers half of PARSE-02
- [ ] A structural single-owning-module test (new file or extension to `hostpath-consumers.test.ts`) — covers PARSE-03's third clause
- [ ] At least one synthetic (hand-constructed) fixture line per format exercising an unrecognised value, proving the refusal control is discriminating — covers PARSE-03's fourth clause
- [ ] At least one synthetic fixture exercising RAM-execute decode for `memmapshow` (absent from the real captured fixtures — see Pitfall 2)
- [ ] A build-capability probe module + test file — covers PARSE-04
- [ ] `TEXT_COMMAND_ALLOWLIST` parameterization design and implementation in `text-protocol.ts` — a prerequisite for `chis`/`prof flat`/`io` tools to dial VICE with a non-default parameter (see Open Question 1)

Framework install: none — `node:test` ships with Node ≥ 24, already the project floor.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | This phase adds no auth surface |
| V3 Session Management | no | Reuses `text-tools.ts`'s existing `withTextTool()` session handling unchanged |
| V4 Access Control | no | No new access-control boundary |
| V5 Input Validation | **yes** | Every new tool's caller-supplied parameter (a `chis`/`prof flat` count, an `io` address) must be validated (bounded, type/shape-checked) *before* being used to build any command string, matching `text-protocol.ts`'s existing "refuse before a byte reaches the socket" discipline for `FORBIDDEN_COMMAND_CHARS_RE` |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Command injection via a caller-supplied count/address concatenated into a text-monitor command string | Tampering / Elevation of Privilege | Never string-concatenate a raw caller value into a command; validate against a strict numeric/hex-address shape and either (a) reject anything outside the expected domain before touching the socket, or (b) build the final command from a small closed set of pre-validated literal strings — exactly the discipline `text-protocol.ts`'s own header comment already states as a hard rule for this same channel ("VICE's text monitor accepts arbitrary monitor commands and is UNAUTHENTICATED — it can `load` and `save` host files") |
| A drifted/unrecognised VICE output value silently mapped to a plausible-but-wrong structured result | Tampering (of the derived evidence, not the wire) | The refusal-on-unrecognised-value discipline this phase's PARSE-03 already mandates as a functional requirement — treat it as a security control too, since a silently-wrong "code vs. data" answer is exactly the kind of corrupted evidence a reverse-engineering session could act on incorrectly |
| Resource exhaustion via an unbounded `memmapshow` result (1.6+ MB per capture, confirmed by the fixture) | Denial of Service | Already mitigated at the transport layer by `TEXT_MAX_BUFFERED_LEN` (4 MiB cap, `text-protocol.ts:162`) — this phase's parsers should not add their own unbounded buffering on top, but can rely on the transport's existing cap |

## Sources

### Primary (HIGH confidence — files read in full or in relevant part this session)
- `src/mcp/vice/text-protocol.ts` (606 lines, full file)
- `src/mcp/vice/text-tools.ts` (195 lines, full file)
- `src/mcp/vice/textmon-fixtures.ts` (209 lines, full file)
- `src/mcp/vice/binmon-fixtures.ts` (298 lines, full file)
- `src/mcp/vice/disasm-decoder.ts` (272 lines, full file)
- `src/mcp/vice/disasm-renderer.ts` (header/shape, ~40 lines)
- `src/mcp/vice/hostpath-consumers.test.ts` (684 lines, full file)
- `src/mcp/vice/fixtures/textmon/README.md` (200 lines, full file)
- `src/mcp/vice/fixtures/textmon/*-stock.txt` (all five command-group fixtures plus the connect-banner pair, read this session)
- `src/mcp/vice/fixtures/textmon/*.json` (all sidecars read this session)
- `src/mcp/vice/stock-derived.ts`, `stock-dispatch.ts` (grep + targeted reads for the registration pattern)
- `/home/henrik/Downloads/vice-3.8/NEWS` (6390 lines, targeted section reads: 3.0, 3.4, 3.5, 3.6, 3.7, 2.0 sections)
- `/home/henrik/Downloads/vice-3.8/src/monitor.h` (MEMMAP_* bit definitions, lines 250-265)
- `/home/henrik/Downloads/vice-3.8/src/monitor/mon_memmap.c` (full print/store logic, ifdef structure, stub text)
- `/home/henrik/Downloads/vice-3.8/src/profiler.c`, `src/monitor/monitor.c` (`mon_backtrace`, targeted reads)
- `/home/henrik/Downloads/vice-3.8/configure.ac` (`--disable-cpuhistory` flag, lines 120, 521)
- `/home/henrik/dev/henrik/git/vice-mcp/vice/NEWS` (targeted section reads: 3.10, 3.5, 3.4, 3.0 sections)
- `/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor/mon_memmap.c` (the `(dummy)`/`(uninitialized read/exec)` annotations)
- `/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor.h` (`MEMMAP_REGULAR_READ` definition)
- `/home/henrik/dev/henrik/git/vice-mcp/vice/src/version.h` (fork version confirmation, 3.10)
- `.planning/REQUIREMENTS.md` (full file)
- `docs/phase39-dual-channel-coexistence-gate-findings.md` (full file, 556 lines)
- `docs/phase41-text-channel-live-evidence.md` (full file, 224 lines)
- `.planning/phases/41-.../41-CONTEXT.md` (targeted sections: domain boundary, D-01/D-02/D-03)
- `.planning/STATE.md` (targeted sections around the Phase 41→42 transition)

### Secondary (MEDIUM confidence)
- none used beyond the primary sources above — no web search or external documentation lookup was needed; this phase's entire domain is this project's own already-committed code plus locally-present VICE source trees

### Tertiary (LOW confidence)
- The `io` command's live behaviour under a `--disable-cpuhistory`-style build was traced from source, not observed live (no such build was constructed this session) — flagged explicitly as `A1` in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, verified by reading the existing package.json and every sibling module's own import list
- Architecture: HIGH — every pattern cited was read in full or in relevant part this session, from this project's own already-committed code
- The five text formats: HIGH — every sample quoted verbatim from committed fixtures read this session
- `memmapshow`'s execute-bit encoding: HIGH — confirmed both from the committed fixture's own byte content and from VICE's upstream C source, independently
- Drift citations: HIGH for the confirmation/correction itself (both NEWS files were read directly, exact line numbers cited); the underlying claim about *why* VICE made each change carries only the NEWS file's own one-line description, not a deeper design rationale
- PARSE-04 build-capability signals: HIGH for `memmapshow`/`chis` (shared macro, exact stub string, confirmed source-level) and for `bt`/`prof flat` (absence of any guard, confirmed source-level); MEDIUM for `io` (source-level tracing only, not live-observed against a disabled build)
- Pitfalls: HIGH — each pitfall is grounded in a specific file:line or fixture-content observation made this session, not general domain knowledge

**Research date:** 2026-09-09
**Valid until:** 30 days (stable domain — this project's own already-committed code and locally-checked-out VICE source do not change on their own; re-verify only if this repo's `text-protocol.ts`/`textmon-fixtures.ts` change before this phase is planned, or if the fixture batch is regenerated against different VICE binaries)
