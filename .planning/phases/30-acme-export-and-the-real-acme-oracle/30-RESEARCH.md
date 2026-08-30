# Phase 30: ACME Export and the Real-ACME Oracle - Research

**Researched:** 2026-08-30
**Domain:** ACME 6510 source generation from a SQLite annotation store, plus an external-assembler byte-diff oracle
**Confidence:** HIGH (every ACME behavioural claim below was run live against the installed ACME 0.97 this session; every in-repo claim cites a file read this session)

## Summary

This phase has no upstream `CONTEXT.md` — `/gsd-discuss-phase` was not run. The settled design constraints therefore live in the ROADMAP Phase 30 section and in `REQUIREMENTS.md`'s `EXPORT-01/02/03`, and are reproduced verbatim in `## User Constraints` below. They are treated with locked-decision authority.

Three findings dominate the plan. **First, the phase is a rebuild in a healthier state than the ROADMAP implies.** `r2000-verify.ts` and `r2000-launch.ts` are genuinely gone from the tree, but the *hard* half of the export — the ACME source generator — already exists and already reassembles byte-exactly under a real ACME: `disasm-renderer.ts` emits `!cpu 6510`, substitutes `!byte $xx` for every non-expressible opcode, forces operand width with `+2`, and gates symbol substitution away from immediate and zero-page operands, and `disasm-roundtrip.test.ts` already drives it through a real `acme` process across all 256 opcodes. What is missing is a *store-driven* front end (blocks → ranges → decode → render) and the verdict layer. Plan around extending, not re-deriving.

**Second, there are four false-pass vectors, not the two the ROADMAP names, and one of them is undocumented anywhere in this repo.** ACME **leaves a pre-existing output file untouched when it fails** — a fixed output path plus a previously-successful run makes the byte-diff pass against stale bytes while ACME exits 1. The verify path must assemble into a fresh `mkdtemp` directory (or unlink and re-stat) and must require the output file to have been *created by this run*. The other three are: `spawnSync` returning `status: null` on ENOENT (so a truthiness check reads a missing assembler as a pass — reproduced live), a trusted aggregate line (the founding incident), and ACME exiting 0 on a genuinely wrong byte.

**Third, two ACME 0.97 width rules are load-bearing for criterion 4 and neither is guessable.** The number of hex digits in a symbol's *definition* decides the operand width: `zpf = $10` assembles `lda zpf` to `a5 10` (2 bytes) while `zpf = $0010` assembles it to `ad 10 00` (3 bytes). And a **forward-referenced** zero-page symbol widens to absolute with only a *Warning* and exit 0. Both silently shift every byte after the instruction. This is exactly the hazard criterion 4's `*`-assertion exists for, and the `*` assertion is the only cheap instrument that catches it — but the byte-diff is what makes it undeniable.

**Primary recommendation:** Build the exporter as a store-reading front end over the existing `disasm-decoder.ts` + `disasm-renderer.ts` pair, and build the oracle as a new test-only-or-shipped module that spawns ACME with an argv array into a fresh temp directory, derives its verdict from a byte-diff plus ACME's own per-segment `-v2` result lines, and never from an exit code, an aggregate line, or the exporter's own text.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reading blocks/labels/comments/enums | Store readers (`anno-store.ts`) | — | `listRanges`/`listLabels`/`listComments`/`listProjectEnums`/`listEnumUsage` are the only sanctioned read surface; `anno-memmap-render.ts` is the precedent renderer that reads exactly these [VERIFIED: src/mcp/vice/anno-memmap-render.ts:75] |
| Byte decode | Pure decoder (`disasm-decoder.ts`) | — | `decode(bytes, startAddress, opts)` is already the one decoder; no protocol, no I/O |
| ACME text emission | Pure renderer (`disasm-renderer.ts`) | new export module | Renderer is already `!cpu 6510`-correct and round-trip-proven; the export module adds store-driven structure (labels, comments, data blocks, `*` assertions) around it |
| Data-block emission (`!byte`/`!text`/`!word`) | new export module | — | No existing module renders a *typed data range*; `disasm-renderer.ts` only emits `!byte` as an opcode substitution |
| ACME spawn + verdict | new verify module | — | Deliberate second implementation of `src/skills/acme-build/scripts/acme.mjs`'s spawn (separate npm packages, cannot import each other) |
| Availability gate / skip-vs-fail | `acme-gate.ts` (SEAM-01) | — | Already the ONE gate; import it, never re-probe [VERIFIED: src/mcp/vice/acme-gate.ts:74-86] |
| CLI verb surface | `anno-cli.ts` | `scripts/lib/anno-cli-verbs.mjs` | Verb list is *parsed* from the dispatch switch; adding a verb moves a floor |
| Path confinement | `anno-types.ts`'s `storePathWithinWorkspace()` | — | The ONE confinement seam; `anno-cli-path-consumers.test.ts` enumerates every path argument |

## User Constraints

No `CONTEXT.md` exists for this phase. The following are copied verbatim from `ROADMAP.md` § Phase 30 and `REQUIREMENTS.md`, and carry locked-decision authority for planning.

### Locked Decisions (ROADMAP success criteria, verbatim)

1. Real ACME 0.97 assembles the export and the verdict is settled by a **byte-diff against the input** — never by an exit code, and never by a string match on the exporter's own output. The five surviving verdict rules are carried explicitly: never derive `ok` from exit status; never trust an aggregate line; require **unanimity** across ACME's own result lines with the first non-ok driving the verdict; refuse to guess when more than one authoritative line is present; and treat `"skipped"` as a **third outcome** that is never conflated with `"ok"`.
2. **Two mandatory reds, both observed against the new producer.** (1) With `ACME_BIN` bogus, export verification reports skipped-or-failed and **never** a pass, and restoring the exit-code shortcut makes the test fail. (2) A deliberately corrupted export byte makes the byte-diff **fail while ACME itself still exits 0**. Both directions were proven once before against a producer this milestone deletes; that evidence does not transfer and is re-earned here.
3. Both carried idioms are **load-bearing in that reassembly** rather than merely emitted: a self-modifying write target named by an `=*+$01` mid-instruction label reassembles byte-identically **on a fixture that actually contains self-modifying code**, and the **11** typed label prefixes come from `AUTO_NAME_PREFIX_RE` itself — so `routine-queue-walker`'s backlog signal still recognises `p_`, `j_`, `s_`, `b_`, `r_` and `zpf_`. Neither idiom exists in this codebase today; both are built, not preserved.
4. What ACME cannot express is **reported as such** rather than emitted and hoped for: an illegal opcode outside the 221 expressible under `!cpu 6510` round-trips byte-identically as `!byte $xx` with a naming comment and never as an invented mnemonic, and every block asserts `*` equals its original address so a label substituted for a zero-page literal cannot change the instruction length and shift the code after it unnoticed. An enum renders on the **immediate** operand only, with reassembly byte-identity as the control that catches the wrong-operand case.
5. A duplicate label is **refused** by the store, and with that refusal removed the export reassembles and **real ACME itself reports the duplicate-symbol error** — the external oracle confirming the internal one. That is the shape this project's own record demands: an internally-verified opcode table still shipped 14 wrong entries, caught only by running the output through a real assembler.

### Locked Decisions (ROADMAP notes, verbatim)

- **Ordering constraint 2, and where its subject now lives:** `r2000-launch.ts` was deleted in **Phase 29** (plan 29-10) under `D-01`, so the window this constraint warns about is **open now**, from the v0.7.0 Phase 29 close until this phase lands. The constraint is **honoured rather than broken**, and the mechanism is `D-02`/`D-14`: no export route was invented ahead of this phase's oracle. `export-asm`, `export-lbl`, `import-lbl` and `gen-enums` are **withdrawn** with dated notices in both skill trees and in `PROJECT.md`, so nothing makes an unverified reassembly claim inside the window — there is no claim to sit at fixture level. What this phase must therefore do is *rebuild* the route, not re-verify a surviving one.
- **The "reuse the existing `--verify` seam" premise is false, and three researchers flagged it independently as the most dangerous item in the milestone.** `r2000-verify.ts` (184 lines) imports from `r2000-launch.ts` and parses *regenerator2000's* per-assembler transcript; it never invokes ACME, and it dies with its subject. Only the **discipline** survives. Plan this as a rebuild, not a rename.
- The natural repair reopens the incident the seam exists to prevent: `spawnSync("acme", ...).status === 0` has the same hole one level over — a missing binary yields `status: null`, and a truthiness check reads a missing assembler as a pass. The recorded false pass, verbatim: `x ACME — ACME not found in PATH (skipped)` / `ok All roundtrip verifications passed.` / `EXIT=0` — exit zero, an aggregate line reading as a full pass, and the one assembler this project cares about never ran.
- Spawn ACME with an **argv array**, never a shell string, matching `src/skills/acme-build/scripts/acme.mjs`'s argv verbatim so the two agree by inspection; never treat an ACME stderr *warning* as a failure. The verify module is a **deliberate second implementation** of that spawn, because `src/mcp/vice/**` and `src/skills/**` are separate npm packages and cannot import each other.
- The committed golden witness of the target output format is `notes/dxa-ghidra-pivot-evidence/r2000.asm`, which carries four live `=*+$01` labels. The idiom was run against real ACME 0.97 during research: `smc_operand = * + $01` before `lda #$00` assembles `sta smc_operand` as `8d 02 08`, correctly targeting the operand byte.
- Re-record both pinned transcripts — the honest pass and the false-pass trap — from **real ACME output**, not from the deleted producer's. **Both were carried forward by plan 29-10 before their module was deleted and now live in `.planning/phases/29-the-mcp-surface/fixtures/`** — `verify-honest-pass.txt`, `verify-false-pass-trap.txt`, and a `README.md` recording their provenance (`regenerator2000 0.9.20` + ACME 0.97, Phase 10) and this obligation. They are carried as **the shape to reproduce, not content to assert against**: asserting against these bytes would re-pin this phase's oracle to the very producer it replaces, which is what the re-record obligation in this same sentence exists to prevent. The two statements agree deliberately.
- Run the ACME hard-fail gate from Phase 27 at this phase's boundary too. It is the cheapest red available in the milestone and it protects every claim in this phase.

### Claude's Discretion

- Whether the export route lands as a shipped CLI verb (`anno export-asm`), an MCP tool, a test-only oracle, or some combination — the ROADMAP names `anno export-asm` in the withdrawal notices but does not lock the shape.
- Whether the verify module ships in `package.json`'s `files[]` or stays test-only like `acme-gate.ts`. See **Pitfall 6** for the consequences of each.
- Internal module decomposition, file names, and how many plans the phase splits into.

### Deferred Ideas (OUT OF SCOPE)

- `gen-enums`, `export-lbl` and `import-lbl` as *bulk CLI verbs*. The ROADMAP's Phase 30 requirements are `EXPORT-01/02/03` only; `anno-cli.ts:24` and `scripts/lib/anno-cli-verbs.mjs`'s `ANNO_CLI_VERB_FLOOR` doc-comment both say these three "return in **Phase 30**", but no Phase 30 success criterion or requirement covers them. **Flagged as a scope ambiguity for the planner, not silently absorbed.** See Open Question 1.
- Bank-aware export. Every store row carries a reserved, uninterpreted `bank` column [VERIFIED: src/mcp/vice/anno-types.ts:257-263 — *"`bank` is reserved and interpreted by nothing: every row this store writes today has `bank` null."*]. Do not build bank handling.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | Store exports ACME source; correctness established by a real ACME actually assembling it, through a purpose-built verify path. Never trust the exit code, require unanimity, a skipped assembler is not a pass. Proven by two mandatory reds. | § Common Pitfalls 1–4 (the four false-pass vectors, all reproduced live); § Code Examples 1 (the spawn), 2 (the verdict); § Architecture Pattern 3 (`acme-gate.ts` skip-vs-fail); § Code Examples 6 (the child-process red harness) |
| EXPORT-02 | Both carried idioms load-bearing in reassembly: `=*+$01` mid-instruction label reassembles byte-identically; the **11** typed prefixes come from `AUTO_NAME_PREFIX_RE`. | § Architecture Pattern 1 (the `=*+$01` idiom, measured — placement is load-bearing); § Standard Stack row `anno-coverage.ts` (11 prefixes verified from source); § Common Pitfalls 8 |
| EXPORT-03 | Correctness never claimed from a string match on the exporter's own output; illegal opcodes ACME cannot assemble are reported as such. | § Architecture Pattern 2 (`disasm-renderer.ts`'s existing `!byte` substitution); § Standard Stack row `disasm-opcodes.ts` (221/35 split verified by count); § Don't Hand-Roll row 1 |

## Standard Stack

Everything this phase needs is already in the tree. **No new external dependency is required, and none should be added.**

### Core (in-repo, reuse verbatim)

| Module | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| `acme-gate.ts` | `src/mcp/vice/acme-gate.ts` | `ACME_BIN`, `probeAcme()`, `ACME_AVAILABLE`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()` | SEAM-01: the ONE ACME availability gate. Its header forbids a second copy by name [VERIFIED: src/mcp/vice/acme-gate.ts:5-13] |
| `disasm-opcodes.ts` | `src/mcp/vice/disasm-opcodes.ts` | 256-entry `OPCODES` table with `illegal` and `acmeExpressible` per entry | The one opcode table; header forbids a second [VERIFIED: src/mcp/vice/disasm-opcodes.ts:138 — *"Never re-derive a second opcode table anywhere else in this tree."*] |
| `disasm-decoder.ts` | `src/mcp/vice/disasm-decoder.ts` | `decode(bytes, startAddress, opts) -> Instruction[]` | Only decoder; emits `DisasmNote` = `"nmos-page-wrap" \| "truncated" \| "acme-unassemblable" \| "illegal-opcode"` [VERIFIED: src/mcp/vice/disasm-decoder.ts:51] |
| `disasm-renderer.ts` | `src/mcp/vice/disasm-renderer.ts` | `render(instructions, opts) -> string`, `renderLine()` | Already emits `!cpu 6510`, `* = $XXXX`, `!byte` substitution, `+2` width forcing, and D-11's symbol-substitution gate |
| `anno-store.ts` | `src/mcp/vice/anno-store.ts` | `openStore`, `closeStore`, `listRanges`, `listLabels`, `listComments`, `listScopes`, `listProjectEnums`, `listEnumUsage`, `listXrefs` | The store's public read surface [VERIFIED: src/mcp/vice/anno-store.ts:2360, 2861, 2917, 3023, 3258, 3389, 3471] |
| `anno-types.ts` | `src/mcp/vice/anno-types.ts` | `DATA_TYPES`, `LABEL_KINDS`, `COMMENT_TYPES`, row interfaces, `storePathWithinWorkspace()`, `MNEMONIC_DENYLIST` | The one vocabulary home |
| `anno-acme-ident.ts` | `src/mcp/vice/anno-acme-ident.ts` | `assertLegalAcmeIdentifier()`, `MAX_ACME_IDENTIFIER_LENGTH` (200), `ACME_RESERVED_MNEMONICS` | The ONE ACME identifier policy; header forbids a second regex [VERIFIED: src/mcp/vice/anno-acme-ident.ts:23-27] |
| `anno-coverage.ts` | `src/mcp/vice/anno-coverage.ts` | `AUTO_NAME_PREFIX_RE` | The 11 typed prefixes EXPORT-02 names |
| `prg-image.ts` | `src/mcp/vice/prg-image.ts` | `parsePrg()`, `flatImageOrigin()`, `decodeRawData()` | Pure `.prg`/flat-64K byte-layout knowledge, no I/O |
| `block-class.ts` | `src/mcp/vice/block-class.ts` | `BlockEntry`, `BlockClass`, `blockClassAt` | The store's block-kind boundary (SEAM-03) |

### Supporting

| Module | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `anno-memmap-render.ts` | `src/mcp/vice/anno-memmap-render.ts` | Precedent: a store-reading renderer with a `RENDERER_VERSION`, a digest banner and a `check*` drift detector | Read it as the **structural template** for the exporter — same store readers, same "generated, never hand-edited" discipline |
| `disasm-roundtrip.test.ts` | `src/mcp/vice/disasm-roundtrip.test.ts` | Precedent: real-ACME round-trip over all 256 opcodes, with the SKIP_REASON pattern | Read `assemble()` (line ~93) — it is the closest existing thing to this phase's verify spawn |
| `acme-gate.test.ts` | `src/mcp/vice/acme-gate.test.ts` | Precedent: proving a hard-FAIL by child process with `NODE_TEST_CONTEXT` deleted | The template for mandatory red #1 |
| `shipped-modules.ts` | `src/mcp/vice/shipped-modules.ts` | `shippedTsModules()`, `codeOnly()` | If a structural guard over the new modules is written, derive the module set from here |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `disasm-renderer.ts` | A new store-aware renderer that duplicates its `!byte`/`+2`/`hex4` logic | **Rejected.** Duplicating the `acmeExpressible` substitution is exactly the "second table" the opcode-table header forbids, and it would leave `disasm-roundtrip.test.ts` proving a route the exporter no longer uses. Inject store facts through `RenderOptions`-shaped parameters instead. |
| Byte-diff against a re-read `.prg` | Parsing ACME's `-r` report file | **Rejected as the primary verdict.** A report file is still ACME's *description* of what it did; the byte-diff is the artefact itself. Use `-v2`'s per-segment lines as a corroborating (not primary) authority. |
| `-f plain` for the assembled output | `-f cbm` | Use `-f cbm` when diffing against a `.prg` input (it prepends the 2-byte load address, verified live). Use `-f plain` only when diffing against a body already stripped of its load address. `-f plain` **zero-fills gaps between segments** (verified live) — a store with non-contiguous blocks will produce padding that is not in the input. |

**Installation:** none. `npm ci` in `src/mcp/vice` is already provisioned by the `SessionStart` hook.

**Version verification:** ACME probed live this session:

```
$ acme --version
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.
$ which acme
/home/henrik/.local/bin/acme
```

[VERIFIED: live `acme --version` on this host, 2026-08-30]

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every dependency is already in `src/mcp/vice/package.json` or is the ACME binary already installed on this host and already installed by `.github/workflows/ci.yml:78` (`retry_apt install -y acme`).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
  .annostore (SQLite)            image file (.prg / flat 64K .raw)
         │                                    │
         │ listRanges / listLabels /          │ parsePrg() | flatImageOrigin()
         │ listComments / listScopes /        │ (prg-image.ts)
         │ listProjectEnums / listEnumUsage   │
         │ (anno-store.ts)                    │
         ▼                                    ▼
   ┌──────────────────────────────────────────────────┐
   │  EXPORT FRONT END  (new)                         │
   │  · order ranges by start                         │
   │  · per range, decide: code block or data block   │
   │  · label index: address -> name  (kind-aware)    │
   │  · comment index: (address, line|side) -> text   │
   │  · enum index: address -> variant name           │
   └──────────────────────────────────────────────────┘
         │                              │
    code range                     data range
         │                              │
         ▼                              ▼
  decode(bytes, start)          !byte / !word / !text
  (disasm-decoder.ts)           emitter  (new)
         │                              │
         ▼                              │
  render(instructions, opts)            │
  (disasm-renderer.ts)                  │
   · !cpu 6510                          │
   · !byte for !acmeExpressible         │
   · +2 width forcing                   │
         │                              │
         └──────────────┬───────────────┘
                        ▼
        ┌───────────────────────────────────────┐
        │  ASSEMBLED SOURCE TEXT                │
        │  header: symbol definitions (2-digit  │
        │    hex for ZP, 4-digit for absolute)  │
        │  per block: * = $XXXX                 │
        │             !if * != $XXXX { !error } │
        │             <lines>                   │
        │             !if * != $YYYY { !error } │
        │  SMC: name =*+$01 BEFORE its host     │
        │       instruction line                │
        └───────────────────────────────────────┘
                        │
                        ▼  write to mkdtemp() dir
        ┌───────────────────────────────────────┐
        │  VERIFY MODULE  (new)                 │
        │  spawnSync(ACME_BIN, [argv...])       │
        │   argv array, never a shell string    │
        └───────────────────────────────────────┘
              │            │            │
       spawn error?   status/stderr  output file
              │            │            │
              ▼            ▼            ▼
        SKIPPED ──┐   Error lines?  did THIS run
        (never a  │   (stderr)      create it?
         pass)    │        │            │
                  └────────┴────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │  BYTE-DIFF          │
                  │  assembled == input │  ◄── THE VERDICT
                  └─────────────────────┘
                             │
                     ok | failed | skipped   (three outcomes, never two)
```

### Recommended Project Structure

```
src/mcp/vice/
├── anno-export-asm.ts       # NEW: store -> ACME source text (pure; no spawn, no I/O beyond reads)
├── anno-export-asm.test.ts  # NEW: shape/structure tests, no ACME needed
├── acme-verify.ts           # NEW: the ONE ACME spawn + byte-diff verdict (second impl of acme.mjs's spawn)
├── acme-verify.test.ts      # NEW: the two mandatory reds + the verdict-rule tests
└── (unchanged) acme-gate.ts, disasm-*.ts, anno-store.ts, anno-types.ts, anno-acme-ident.ts
.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/
├── verify-honest-pass.txt        # RE-RECORDED from the new producer's real output
├── verify-false-pass-trap.txt    # RE-RECORDED: the trap provoked against the NEW route
└── README.md                     # provenance: ACME 0.97 "Zem", this host, Phase 30
```

### Pattern 1: The `=*+$01` mid-instruction label — placement is load-bearing

**What:** A self-modifying-code write target is named by assigning a symbol to `* + $01` on the line **immediately before** the instruction whose operand byte is being named.

**When to use:** whenever the store holds a label whose address falls strictly inside a decoded instruction (i.e. `address > instr.address && address < instr.address + instr.length`).

**Measured, both directions** [VERIFIED: live ACME 0.97 run this session]:

```asm
; CORRECT — label BEFORE the host instruction
!cpu 6510
* = $0801
smc_operand = * + $01
        lda #$00
        sta smc_operand
        rts
```
→ `a9 00 8d 02 08 60`. `sta smc_operand` assembles as `8d 02 08`, targeting `$0802`, the operand byte of the `lda #$00` at `$0801`. This reproduces the ROADMAP's stated `8d 02 08` exactly.

```asm
; WRONG — label AFTER the host instruction
!cpu 6510
* = $0801
        lda #$00
smc_operand = * + $01
        sta smc_operand
        rts
```
→ `a9 00 8d 04 08`. The label now names `$0804`, the operand of the *next* instruction. ACME exits **0** in both cases. **Only a byte-diff distinguishes them.**

The golden witness uses the compact spelling with no spaces and the label on its own line above its host:

```asm
f_0900 =*+$01
f_08FF              ora (zpp_10,x)       ; x-ref: $083e
```
[VERIFIED: .planning/notes/dxa-ghidra-pivot-evidence/r2000.asm:202-203]

**Correction to the ROADMAP note:** it says the witness "carries four live `=*+$01` labels". It carries **six** — at lines 51, 81, 135, 145, 202 and 205 [VERIFIED: `grep -n '\* *+ *\$01' .planning/notes/dxa-ghidra-pivot-evidence/r2000.asm`]. Also, the file's real path is `.planning/notes/dxa-ghidra-pivot-evidence/r2000.asm`; the ROADMAP note's `notes/dxa-ghidra-pivot-evidence/r2000.asm` does not resolve from the repo root. Both are documentation drift, not design drift.

The witness reassembles cleanly under its own header command:
```
$ acme --cpu 6510 --format cbm -o r2000.prg r2000.asm
EXIT=0   # 281 bytes, load address 01 08
```
[VERIFIED: live ACME 0.97 run this session]

### Pattern 2: The illegal-opcode `!byte` substitution already exists — reuse it

`disasm-renderer.ts` already implements exactly what criterion 4 demands, and its header names the rule:

> `D-09`: every opcode ACME's `!cpu 6510` cannot express goes out as `!byte` with all its bytes, never as a mnemonic ACME would reject.

The rendered form is `!byte $xx  ; <mnemonic operand>  [<note text>]`, where the note vocabulary is fixed:
```
"acme-unassemblable": "not expressible in ACME !cpu 6510"
"illegal-opcode":     "illegal opcode"
```
[VERIFIED: src/mcp/vice/disasm-renderer.ts:112-117]

**The 221/35 split is real and verified from source, not from the ROADMAP:** `disasm-opcodes.ts` contains **221** `acmeExpressible: true` entries and **35** `acmeExpressible: false` entries across 256 opcodes; **105** are `illegal: true` [VERIFIED: `grep -c` over src/mcp/vice/disasm-opcodes.ts]. Measured live: `jam` assembles to `$02` regardless of which of the twelve JAM opcodes it was decoded from, while `!byte $12` yields exactly `$12`.

The "14 wrong entries" record is the header of that same file: two `jam`/`anc` duplicate groups plus four `nop` subgroups were corrected from an untested seed by 04-06's real-ACME round-trip [VERIFIED: src/mcp/vice/disasm-opcodes.ts:66-100]. `REQUIREMENTS.md:110` and `.planning/research/PITFALLS.md:956` both cite it.

### Pattern 3: skip-vs-fail — import the gate, never re-probe

```ts
import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";

const SKIP_REASON: string | false = acmeSkipReasonFor("acme-verify.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);   // never skipped; hard FAIL under VICE_REQUIRE_ACME
});

test("...", { skip: SKIP_REASON }, () => { /* ... */ });
```

This is the project's convention, stated in `disasm-roundtrip.test.ts`'s header: *"SKIP_REASON is computed ONCE at module scope … never a hand-rolled `if (!available) return` (which would report a false PASS rather than a SKIP)."* [VERIFIED: src/mcp/vice/disasm-roundtrip.test.ts:20-25]

CI sets `VICE_REQUIRE_ACME: "1"` on the Test step and installs ACME [VERIFIED: .github/workflows/ci.yml:78, :140-141], so a skip is a local-only state, never a CI state. **This is the Phase 27 ACME hard-fail gate the ROADMAP note tells this phase to run at its boundary** — it is `acme-gate.ts`, and running it means importing `assertAcmeRequiredIfEnvSet()` into every new ACME-dependent test file, plus `npm test` (not `test:automated`) with `VICE_REQUIRE_ACME=1` at the phase boundary.

### Pattern 4: `*`-assertion syntax that actually works

```asm
!cpu 6510
* = $0801
!if * != $0801 { !error "block A origin drifted: expected $0801, got ", * }
        lda #$00
        rts
!if * != $0804 { !error "block A end drifted: expected $0804, got ", * }
```
Exit 0, silent, when the assertion holds [VERIFIED: live]. On failure:
```
assertfail.a(5) : Error (Zone <untitled>): !error: block end drifted: expected $0899, got 2052 (0x804)
```
Exit 1, on **stderr**, and **no output file is produced** [VERIFIED: live]. Note that interpolating `*` renders as `<decimal> (0x<hex>)`, not as `$hex` — the message text should say the expected value in `$` form itself rather than relying on ACME's rendering.

`!pseudopc` is **not** an alternative: it errors with `Program counter undefined.` unless `*` has already been set [VERIFIED: live].

### Anti-Patterns to Avoid

- **Deriving `ok` from `spawnSync(...).status`.** Reproduced live: ENOENT yields `status: null`, and `!r.status` evaluates `true` — a missing assembler reads as a pass. `r.status === 0` is safe against ENOENT specifically, but is still not the verdict (see Pitfall 3 and 4).
- **A fixed output path across runs.** See Pitfall 1 — this is the undocumented fourth false-pass vector.
- **Asserting the rebuilt parser against `.planning/phases/29-the-mcp-surface/fixtures/verify-*.txt`.** The README forbids it explicitly: *"A green test against them proves the new parser can read the deleted tool's format, which is precisely the evidence Phase 30 does not need and must not claim to have."*
- **Naming a local `binPath` in the verify module.** `spawn-seam.test.ts` discovers emulator spawn sites by scanning shipped modules for `/\bVICE_BIN\b|\bx64sc\b|\bbinPath\b|\bviceBin\b/` and asserts the discovered set is **exactly one entry** (`backend-detect.mts`) in both directions [VERIFIED: src/mcp/vice/spawn-seam.test.ts:179, 263-296]. A shipped module that spawns something it calls `binPath` reds that test. Name it `acmeBin` / `ACME_BIN`.
- **Restating the 11 prefixes.** `anno-types.ts:93-99` forbids it by name: *"NEVER restate the eleven auto-generated-name prefixes here. They live in exactly one place, `anno-coverage.ts`'s `AUTO_NAME_PREFIX_RE`, and `EXPORT-02` names the exact failure a short reimplementation causes."*
- **Treating an ACME stderr warning as a failure.** ACME 0.97 emits `Warning (Zone <untitled>): Assembling unstable LXA #NONZERO instruction` and `Assembling buggy JMP($xxff) instruction` on legal, byte-correct output, exit 0 [VERIFIED: live].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Which opcodes ACME can express | A new expressibility list, or an exclusion list of "known bad" mnemonics | `disasm-opcodes.ts`'s `OPCODES[b].acmeExpressible` | 14 entries were wrong in the internally-verified seed; the table is now real-ACME-corrected and its header forbids a second copy |
| 6510 instruction decode | A length table or a mnemonic switch | `disasm-decoder.ts`'s `decode()` | One wrong length desynchronises every instruction after it, silently |
| ACME line emission | A new `!byte`/`+2`/`hex4` emitter | `disasm-renderer.ts`'s `render()` / `renderLine()` | Already round-trip-proven across all 256 opcodes against real ACME |
| "Is this a legal ACME symbol name" | A second identifier regex | `anno-acme-ident.ts`'s `assertLegalAcmeIdentifier()` | Its header forbids a second regex; it already encodes the *measured* mnemonic reservation (`LDA = $05` is rejected by real ACME, `A = $05` is accepted) |
| ACME availability / skip reason | A local `spawnSync(acme, ["--version"])` | `acme-gate.ts` | Three hand-copied probes is how the gate diverged before; SEAM-01 exists for exactly this |
| Path confinement for `--out` / store / image | A local `resolve()` + `startsWith()` | `anno-types.ts`'s `storePathWithinWorkspace()` | Phase 29 found **three** live escapes on arguments the shipped playbooks tell an agent to compose; `anno-cli-path-consumers.test.ts` now enumerates every path argument and fails when the inventory and the surface disagree |
| `.prg` load-address handling | Inline `bytes[0] | bytes[1] << 8` | `prg-image.ts`'s `parsePrg()` / `flatImageOrigin()` | Its refusal message texts are a user-visible contract matched by tests on two routes |
| Auto-name prefix detection | A five-prefix regex | `anno-coverage.ts`'s `AUTO_NAME_PREFIX_RE` | EXPORT-02 names the exact failure: a short copy silently under-counts and breaks `routine-queue-walker`'s backlog while every test keeps passing |

**Key insight:** almost every "build it" instinct in this phase has a module in this tree whose *header comment* forbids the second copy by name. The phase's genuine new construction is narrow: a store-driven block iterator, a typed-data-range emitter, the `*`-assertion wrapper, the `=*+$01` insertion rule, and the verify/verdict module.

## Runtime State Inventory

Not a rename/refactor/migration phase — this phase adds a route rather than moving one. Two items nonetheless need naming because they are *removals that already happened* and this phase reverses part of one:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — the store schema is unchanged by this phase; export is read-only. Verified: `anno-store.ts`'s `DDL` needs no new table for export. | none |
| Live service config | **None** — no emulator, no broker, no external service participates in export. | none |
| OS-registered state | **None.** | none |
| Secrets/env vars | `ACME_BIN` and `VICE_REQUIRE_ACME` already exist and are bound **by exact name** in `.github/workflows/ci.yml:140`. `acme-gate.ts` forbids renaming either [VERIFIED: src/mcp/vice/acme-gate.ts:46-51]. | none — reuse, never rename |
| Build artifacts | **None** — every new module is a container-side `.ts` run under Node type-stripping; no `.mts` → `resources/*.mjs` build applies. If any new module were `.mts`, `build.ts` and `resources-sync.test.ts` would apply — **avoid `.mts` for this phase.** | none |
| Withdrawn-verb documentation | `anno export-asm` is named as withdrawn-returning-in-Phase-30 in **six** shipped files across two trees: `src/skills/acme-build/SKILL.md:138,194`, `src/skills/c64-program-recon/SKILL.md:303,662`, `src/skills/c64-program-recon/references/tool-selection.md:33`, plus the four `installer/skills/` twins. `scripts/check-skill-fork-honesty.mjs:533` asserts the acme-build twin contains the literal `anno export-asm`. | If the verb lands, update **both trees** in the same commit (`REPOINT-02`: `installer/skills/` is gitignored yet shipped) |
| CLI verb floor | `scripts/lib/anno-cli-verbs.mjs`'s `ANNO_CLI_VERB_FLOOR = 2`, and `anno-verb-coverage.test.ts:178` asserts `assert.equal(ANNO_CLI_VERB_FLOOR, 2)` **exactly**. | If a verb lands, raise the constant **and** the equality assertion in the same commit; the floor's own doc-comment says "Each verb that lands there raises this floor to the new true count, in the commit that adds it" |
| `files[]` closure | `scripts/check-npm-packages.mjs` walks the static **and** dynamic import closure from `vice-proxy.ts` and fails the pack when a reachable module is missing from `package.json`'s `files[]`. | If a new module is reachable from `vice-proxy.ts` (directly or via `anno-cli.ts`'s `await import`), add it to `files[]` in the same commit |

## Common Pitfalls

### Pitfall 1: The stale output file — the fourth false-pass vector, undocumented anywhere in this repo

**What goes wrong:** ACME fails, exits 1, prints an error — and **leaves a pre-existing output file completely untouched**. A verify path that assembles to a fixed path (`build/export.prg`) and byte-diffs against the input will find yesterday's correct bytes and report a pass.

**Reproduced live this session:**
```
$ printf 'STALE' > stale.bin
$ acme -f plain --msvc -o stale.bin dup.a
dup.a(4) : Error (Zone <untitled>): Symbol already defined.
EXIT=1
$ xxd stale.bin
00000000: 5354 414c 45                             STALE
```

**Why it happens:** ACME opens the output file only after a successful final pass. Nothing truncates it on failure.

**How to avoid:** assemble into a fresh `mkdtempSync(join(tmpdir(), "acme-verify-"))` per invocation, removed in a `finally` (this host's `/tmp` is RAM-backed). Additionally require `existsSync(outPath)` to have been `false` before the spawn and `true` after — "did *this run* create it" is the property, not "does a file exist".

**Warning signs:** a verify that passes on a tree where you have just broken the exporter; a verify whose pass rate depends on whether `build/` was cleaned.

### Pitfall 2: The `!r.status` truthiness hole — reproduced exactly as the ROADMAP records it

**Reproduced live this session:**

| `ACME_BIN` | `status` | `error.code` | `r.status === 0` | `!r.status` |
|---|---|---|---|---|
| `acme` | `0` | `null` | `true` | `true` |
| `acme-does-not-exist` | `null` | `ENOENT` | `false` | **`true`** ← the hole |
| `/nonexistent/acme` | `null` | `ENOENT` | `false` | **`true`** |
| `/etc/hostname` | `null` | `EACCES` | `false` | **`true`** |

**How to avoid:** the verdict has **three** outcomes. `r.error !== undefined || r.status === null` ⇒ `"skipped"`, which is never `"ok"`. Only a byte-identical diff of a file this run created yields `"ok"`.

**Note a precision issue in the ROADMAP note:** it says `spawnSync("acme", ...).status === 0` "has the same hole one level over". Measured, `=== 0` is *safe against ENOENT specifically* (it evaluates `false`). The hole is truthiness (`!r.status`, `r.status != 1`), and separately the exit code is not the verdict *even when it is 0* (Pitfall 3). Plan the test to red on the truthiness form, and keep the "never derive `ok` from exit status" rule independently.

### Pitfall 3: ACME exits 0 on a genuinely wrong byte

**Reproduced live this session:** `lda #$00` vs `lda #$01`, both assemble, both exit 0, bytes differ at offset 4 (`a9 00` vs `a9 01`). Mandatory red #2 is exactly this shape and needs no contrivance.

### Pitfall 4: A forward-referenced zero-page symbol widens to absolute — with only a Warning

**What goes wrong:**
```asm
!cpu 6510
* = $0801
        lda zpf      ; zpf not yet defined
        rts
zpf = $10
```
→ `f1.a(3) : Warning (Zone <untitled>): Using oversized addressing mode.` / **EXIT=0** / bytes `ad 10 00 60` — **4 bytes where the original was 3**. Everything after it shifts.

Same source with `zpf = $10` moved **above** `* = $0801` → `a5 10 60`, 3 bytes, silent.

**How to avoid:** emit **every** symbol definition in a header block before the first `* =`, exactly as the golden witness does (`.planning/notes/dxa-ghidra-pivot-evidence/r2000.asm:19-42` is an "EXTERNAL LABELS" block). Then assert `*` at both ends of every block so a widening is caught even if a definition is ever missed.

### Pitfall 5: The symbol *definition's hex-digit count* decides the operand width

**Measured, all four forms, live this session** (`lda zpf` at `* = $0801`, `-f plain`):

| Definition | Assembled | Length |
|---|---|---|
| `zpf = $10` | `a5 10` | 2 (zeropage) |
| `zpf = 16` | `a5 10` | 2 (zeropage) |
| `zpf = $0010` | `ad 10 00` | **3 (absolute)** |
| `lda+1 zpf` with `zpf = $0010` | `a5 10` | 2 (forced) |

`disasm-renderer.ts` currently emits every symbol definition through `hex4()` — `${name} = ${hex4(address)}` [VERIFIED: src/mcp/vice/disasm-renderer.ts, `render()`]. That is safe **today only because** D-11 forbids substituting a symbol into any zeropage-family or immediate operand. An exporter that wants zero-page labels (`zpp_00`, `zpa_FB` — which the golden witness has) **must** emit those definitions with two hex digits, or force with `+1`. This is the single most likely way to ship an export that ACME accepts and that produces the wrong bytes.

### Pitfall 6: Where the verify module lives changes which guards fire

- **Test-only (like `acme-gate.ts`, absent from `files[]`):** `spawn-seam.test.ts` cannot see it at all (it derives its scan set from `files[]` via `shippedTsModules()`), and `check-npm-packages.mjs`'s closure walk never reaches it. But then `anno export-asm` has no runtime way to self-verify, and the oracle is a test rather than a route.
- **Shipped (in `files[]`):** `check-npm-packages.mjs` requires it to be listed if reachable from `vice-proxy.ts`; `spawn-seam.test.ts` will scan it (harmless as long as no local is named `binPath`/`viceBin`/`VICE_BIN`/`x64sc`); and `acme-gate.test.ts`'s "`acme-gate.ts` is absent from `files[]`" assertion means the *gate* cannot be imported by a shipped module — so a shipped verify module must resolve `ACME_BIN` itself rather than import the gate, which is a second copy of the env-var name. **This tension is real and the planner must resolve it explicitly.**

### Pitfall 7: `-f plain` zero-fills the gaps between blocks

**Measured live:** a source with `* = $0801 / nop`-style block A and `* = $0810` block B emits **16 contiguous bytes**, padding `$0804`–`$080F` with `$00`. A byte-diff of a multi-block export against a sparse input will fail on padding that is not a real disagreement. Either export one contiguous span, or diff per block, or use `-f cbm` against a `.prg` whose extent matches.

`--strict-segments` turns an **overlapping** segment from a Warning into an Error (`Segment starts inside another one, overwriting it.`, exit 1) [VERIFIED: live] — worth passing, since a store with overlapping ranges would otherwise silently overwrite.

### Pitfall 8: `AUTO_NAME_PREFIX_RE`'s eleven prefixes — the exact source, and what is deliberately absent

```ts
export const AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/;
```
[VERIFIED: src/mcp/vice/anno-coverage.ts:1393]

That is **11** alternatives: `zpf_`, `f_`, `zpa_`, `a_`, `p_`, `zpp_`, `e_`, `j_`, `s_`, `b_`, `r_`. The requirement's "11" is confirmed from the source, and every prefix the ROADMAP criterion names (`p_`, `j_`, `s_`, `b_`, `r_`, `zpf_`) is present.

**`L_` is deliberately absent** and must stay absent: *"Upstream assigns `L_` to `Predefined`, `UserDefined` AND `LocalUserDefined` alike … it cannot distinguish an auto-generated name from a user-chosen one"* [VERIFIED: src/mcp/vice/anno-coverage.ts:1382-1391]. `anno-coverage.test.ts:1413-1422` asserts both the absence of `L_` and that all eleven example names match, and that matching is **ASCII case-sensitive** (`S_0820` must not match).

**Consumers** (the complete set on this tree): `anno-coverage.ts:1442` (`computeLabelRatio`, feeding `autoPrefixNamesRemaining`/`autoPrefixNameAddresses`), `anno-coverage.test.ts:39,1413-1421`, and — as prose, not code — `module-classification.ts:149-155`, which records that `EXPORT-02`'s prefix clause anchors the **census** entry rather than the ACME-identifier module. `routine-queue-walker/SKILL.md` consumes the prefixes as *documented vocabulary* (`s_`, `p_`, `b_`, `zpp_`, `zpf_`, `zpa_`, `f_`, `a_` at lines 128-181, 220-226), never by importing the regex — so the coupling is by convention and would break silently.

### Pitfall 9: The duplicate-label refusal already exists, and the store's message is specific

`setLabel()` refuses a name already bound to a **different** address:

> `label name "X" is already bound to address N ($NNNN) and cannot also name address M ($MMMM) -- the write is REFUSED rather than rebinding the name or inventing a variant of it, because either would silently merge or move a name somebody chose on purpose`

[VERIFIED: src/mcp/vice/anno-store.ts:2833-2842]

The DDL also carries `name text not null unique` on `anno_label` [VERIFIED: src/mcp/vice/anno-store.ts:266], so the refusal is belt-and-braces. Criterion 5's "with that refusal removed" therefore means *removing the `existing && existing.address !== address` guard in a scratch/planted-violation harness*, not editing the schema — the `unique` constraint would still fire.

**Real ACME's own duplicate-symbol error, measured live, both spellings:**
```
Error - File dup.a, line 4 (Zone <untitled>): Symbol already defined.        # default
dup.a(4) : Error (Zone <untitled>): Symbol already defined.                  # with --msvc
EXIT=1
```
It fires identically for a repeated `=` assignment and for a repeated label. **On stderr.**

### Pitfall 10: Which stream is which

**Measured live:**

| Output | Stream |
|---|---|
| `Error` / `Warning` / `Serious error` diagnostics (both default and `--msvc` form) | **stderr** |
| `-v1` `Saving N (0xN) bytes (0xA - 0xB exclusive).` | **stdout** |
| `-v2` `First pass.` / `Segment size is N (0xN) bytes (0xA - 0xB exclusive).` | **stdout** |

A verdict that reads only `stderr` misses ACME's own authoritative result lines; one that reads only `stdout` misses every error.

## Code Examples

### 1. The ACME spawn — argv array, fresh temp dir

`src/skills/acme-build/scripts/acme.mjs`'s exact argv, read this session [VERIFIED: src/skills/acme-build/scripts/acme.mjs, `build()`]:

```js
const args = [
  "--cpu", "6510",              // C64: enables the 6510 illegal opcodes
  "-f", opts.format || "cbm",   // cbm = 2-byte load address, what LOAD wants
  "-Wtype-mismatch",            // catches a missing '#' on an immediate
  "--strict-segments",          // overlapping segments are reported as errors
  "--msvc",                     // machine-parseable diagnostics
  "-v1",                        // report the address range actually emitted
  "-o", prg,
  "-l", `${stem}.sym`,
  "--vicelabels", `${stem}.vs`,
];
if (!opts.noReport) args.push("-r", `${stem}.rep`);
for (const d of opts.defines) args.push(`-D${d}`);
for (const i of opts.includes) args.push("-I", i);
if (opts.setpc) args.push("--setpc", opts.setpc);
args.push(src);

const r = spawnSync("acme", args, { encoding: "utf8", env });
```

**Three divergences the plan must decide about, not inherit blindly:**

1. `acme.mjs` spawns the **literal string `"acme"`**, not `ACME_BIN`. Mandatory red #1 requires `ACME_BIN` to be overridable. The verify module must use `ACME_BIN` from `acme-gate.ts` (or resolve the same env var). "Matching the argv verbatim" means the **flag list**, not the binary token.
2. `acme.mjs` derives `ok` as `r.status === 0 && existsSync(prg)` — correct *for a build driver*, and **explicitly not the verdict rule for this phase**. Do not carry that line across.
3. `-Wtype-mismatch` is **load-bearing, not decorative**: measured live, it is the flag that makes ACME emit the `!addr` marker in the `-l` symbol file. Without it every line starts with a bare tab and `acme.mjs`'s own `parseSymbols()` regex `^(!addr\s+)?(\S+)\s*=\s*(\S+?)\s*(?:;\s*(.*))?$` matches **zero** lines (verified live: 0/3 with the flag omitted, 2/3 with it present). If the verify module reads symbol files at all, keep the flag.

Existing in-tree precedent for the minimal round-trip spawn [VERIFIED: src/mcp/vice/disasm-roundtrip.test.ts, `assemble()`]:

```ts
const r = spawnSync(ACME_BIN, ["-f", "plain", "-o", outPath, srcPath], { encoding: "utf8" });
const ok = r.status === 0 && existsSync(outPath);
```
Note this is the *round-trip test's* helper, not a verdict — and it is the one place in the tree that already carries the "never treat a warning as a failure" rule in its header.

### 2. The three-outcome verdict skeleton

```ts
export type AcmeOutcome = "ok" | "failed" | "skipped";

export interface AcmeVerifyResult {
  outcome: AcmeOutcome;
  /** Never consulted for the verdict. Recorded so a human can read what happened. */
  exitStatus: number | null;
  /** ACME's OWN result lines (stdout, -v2 "Segment size is ..." / "Saving ..."). */
  acmeResultLines: string[];
  /** ACME's diagnostics (stderr, --msvc form). Warnings never fail. */
  diagnostics: string[];
  /** The verdict's actual basis. */
  byteDiff: { equal: boolean; firstDifferingOffset: number | null; expectedLength: number; actualLength: number } | null;
  reason: string;
}
```

Rules, in the order the ROADMAP states them:

1. `r.error !== undefined || r.status === null` ⇒ `"skipped"`. **Never `"ok"`, never silently folded into `"failed"`.**
2. Never read `exitStatus` to decide `outcome`.
3. Never read an aggregate/summary line.
4. Unanimity across ACME's own result lines, **first non-ok drives the verdict**.
5. More than one authoritative line disagreeing ⇒ refuse to guess (`"failed"` with a reason naming the disagreement).
6. `"ok"` requires: the output file did not exist before the spawn, exists after, and its bytes equal the input's exactly.

**What "ACME's own result lines" means for a direct spawn.** With regenerator2000 gone there is no per-assembler transcript. The direct-spawn analogue, measured live with `-v2`:

```
First pass.
Segment size is 3 (0x3) bytes (0x801 - 0x804 exclusive).
Segment size is 1 (0x1) bytes (0x810 - 0x811 exclusive).
Saving 16 (0x10) bytes (0x801 - 0x811 exclusive).
```

The `Segment size is …` lines are ACME's own per-block statement of what it emitted and where; the `Saving …` line is the aggregate. **The `Saving` line is the aggregate that must never be trusted alone** — it is structurally the same object as the `✓ All roundtrip verifications passed.` line that lied in the carried trap. Per-segment lines are the unanimity subject.

### 3. The `*`-assertion block wrapper

```ts
function emitBlock(startAddress: number, endExclusive: number, lines: string[]): string[] {
  const at = (n: number) => `$${n.toString(16).padStart(4, "0")}`;
  return [
    `* = ${at(startAddress)}`,
    `!if * != ${at(startAddress)} { !error "block origin drifted: expected ${at(startAddress)}" }`,
    ...lines,
    `!if * != ${at(endExclusive)} { !error "block end drifted: expected ${at(endExclusive)}" }`,
  ];
}
```
Note `endExclusive`: measured live, `* = $0801` + `lda #$00` + `rts` leaves `*` at `$0804`, i.e. one past the last emitted byte. The store's `RangeRow` uses `endInclusive` [VERIFIED: src/mcp/vice/anno-types.ts:250-263 — *"`endInclusive` is INCLUSIVE … so a range's length is `endInclusive - start + 1`"*], so the conversion is `endExclusive = row.endInclusive + 1` and it is an off-by-one waiting to happen. `.planning/research/SUMMARY.md:162` records inclusive-end off-by-one as a carried project hazard with **six** conversion boundaries.

### 4. The `=*+$01` insertion rule

```ts
// For each decoded instruction, any store label whose address falls STRICTLY
// INSIDE the instruction gets a `name =*+$NN` line emitted IMMEDIATELY BEFORE
// the instruction's own line. Measured: placing it after names the NEXT
// instruction's operand and ACME exits 0 either way.
for (const label of labelsInside(instr)) {
  const offset = label.address - instr.address;             // 1 or 2
  out.push(`${label.name} =*+$${offset.toString(16).padStart(2, "0")}`);
}
out.push(renderLine(instr, renderOpts));
```

### 5. Enum on the immediate operand only

Measured live, all three cases:

```asm
viccolor_WHITE = $01
        lda #viccolor_WHITE     ; -> a9 01   byte-identical to `lda #$01`
        sta $d020               ; -> 8d 20 d0
```
```asm
        lda #$01
        sta viccolor_WHITE      ; WRONG OPERAND -> 85 01 (zeropage, 2 bytes!)
```
The wrong-operand case changes both the bytes **and the instruction length**, and ACME exits 0. Byte-diff catches it; nothing else does. A symbol whose value exceeds `$ff` on an immediate operand is a hard error: `Number does not fit in 8 bits.`, exit 1 — so an enum mis-attached to a 16-bit value fails loudly, but the zero-page case does not.

### 6. The mandatory-red harness (child process, `NODE_TEST_CONTEXT` deleted)

`ACME_AVAILABLE` and `ACME_BIN` are module-load `const`s, so **no in-process test can prove mandatory red #1**. The template is `acme-gate.test.ts`:

```ts
const env = { ...process.env, ACME_BIN: "/nonexistent/acme-bogus", VICE_REQUIRE_ACME: "1" };
// MEASURED TRAP: Node sets NODE_TEST_CONTEXT in every process it runs a test
// file in, and a child `node --test` that inherits it refuses to run any file
// at all -- it prints "run() is being called recursively within a test file.
// skipping running files" and exits ZERO.
delete env.NODE_TEST_CONTEXT;
const r = spawnSync(process.execPath, ["--test", probePath], { encoding: "utf8", timeout: 30_000, env });
```
[VERIFIED: src/mcp/vice/acme-gate.test.ts:113-125]

Two directions are mandatory, not optional: the same child run repeated with `VICE_REQUIRE_ACME` **deleted** (not set to `""`) must exit **zero**, or the FAIL observation cannot be distinguished from a broken harness [VERIFIED: src/mcp/vice/acme-gate.test.ts:20-26]. Write the probe file under `mkdtempSync(tmpdir())`, never in the module directory — a stray `*.test.*` there breaks `test-gate.test.ts`'s "every on-disk test file lands in exactly one set" assertion.

### 7. Real ACME output the verdict parser must handle, verbatim

```
# duplicate symbol (--msvc), stderr, exit 1
dup.a(4) : Error (Zone <untitled>): Symbol already defined.

# failed !error assertion (--msvc), stderr, exit 1, NO output file written
assertfail.a(5) : Error (Zone <untitled>): !error: block end drifted: expected $0899, got 2052 (0x804)

# warnings on byte-correct output, stderr, exit 0
warn.a(3) : Warning (Zone <untitled>): Assembling unstable LXA #NONZERO instruction
warn.a(4) : Warning (Zone <untitled>): Assembling buggy JMP($xxff) instruction

# forward-referenced ZP symbol silently widening, stderr, exit 0
f1.a(3) : Warning (Zone <untitled>): Using oversized addressing mode.

# missing !cpu 6510 for an illegal opcode, stderr, exit 1
cpu2.a(2) : Warning (Zone <untitled>): Label name not in leftmost column.
cpu2.a(2) : Error (Zone <untitled>): Syntax error.

# overlapping segments under --strict-segments, stderr, exit 1
ovl.a(5) : Error (Zone <untitled>): Segment starts inside another one, overwriting it.

# ACME's own result lines (-v2), STDOUT, exit 0
First pass.
Segment size is 3 (0x3) bytes (0x801 - 0x804 exclusive).
Saving 16 (0x10) bytes (0x801 - 0x811 exclusive).
```
All [VERIFIED: live ACME 0.97 runs this session]

`acme.mjs`'s MSVC regex, reusable verbatim [VERIFIED: src/skills/acme-build/scripts/acme.mjs]:
```js
const MSVC = /^(.*?)\((\d+)\)\s*:\s*(Error|Warning|Serious error)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `r2000-verify.ts` parses regenerator2000's per-assembler transcript | Direct ACME spawn + byte-diff; only the **discipline** survives | Phase 29 plan 29-10, 2026-08-30 (commit `1d40ad0`) | The module and its test are gone from disk; only comment references remain in `block-class.test.ts:18`, `module-classification.ts:603,618,690`, `scripts/check-npm-packages.mjs:240-249` [VERIFIED: `grep -rn 'r2000-verify\|r2000-launch'` over `src/`, `scripts/`, `docs/`] |
| Eight `anno` CLI verbs | **Two** (`coverage`, `render-memmap`) | Phase 29 plan 29-07, D-14, 2026-08-29 | `ANNO_CLI_VERB_FLOOR` dropped 8 → 2 as a *replacement over a new subject*, with a documented obligation to raise it per verb that lands |
| `r2000_*` MCP tools | 19 `anno_*` tools, registered through `buildViceTool()` directly | Phase 29 | See § MCP-02 below |
| The subcommand token `r2000` | `anno` | Phase 29 plan 29-09 | `scripts/lib/anno-cli-verbs.mjs`'s header names three halves that must move together |

**Deprecated/outdated in the phase brief itself:**
- ROADMAP: "`notes/dxa-ghidra-pivot-evidence/r2000.asm`" → the real path is `.planning/notes/dxa-ghidra-pivot-evidence/r2000.asm`.
- ROADMAP: "four live `=*+$01` labels" → there are **six**.
- ROADMAP: "`spawnSync("acme", ...).status === 0` has the same hole" → measured, `=== 0` is safe against ENOENT; the hole is truthiness. The *rule* stands regardless.
- `scripts/lib/anno-cli-verbs.mjs` and `anno-cli.ts:24` say `gen-enums`/`export-lbl`/`import-lbl` "return in **Phase 30**", but no Phase 30 requirement or criterion covers them. See Open Question 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exporter should be built on `disasm-decoder.ts` + `disasm-renderer.ts` rather than a fresh emitter. | Architectural Responsibility Map, Standard Stack | Low. Both are pure and already round-trip-proven; the risk is that store-driven labels/comments need renderer changes the current `RenderOptions` shape cannot express, forcing a widening of that interface. |
| A2 | No new MCP tool is needed — the export lands as a CLI verb. | Deferred Ideas, Open Question 1 | Medium. If an MCP tool is wanted, `ANNO_TOOL_DEFINITIONS` and `CURATED_ANNO_TOOLS` grow, `check-skill-tool-coverage.mjs`'s `extractedAnno.size >= 18` floor moves, and skill prose must document the new name. |
| A3 | `-f cbm` against a `.prg` input is the right diff shape for the common case. | Alternatives Considered, Pitfall 7 | Low-medium. A flat 64K capture (`flatImageOrigin()` ⇒ origin 0) diffs differently; the plan needs both shapes. |
| A4 | The five verdict rules map onto `-v2`'s per-segment lines as "ACME's own result lines". | Code Examples 2 | Medium. This is my mapping of a rule written for a different producer onto the new one. An alternative reading is that with a direct spawn the *byte-diff per block* is itself the result-line set and `-v2` is corroboration only. **The planner should state which reading it adopts, explicitly.** |
| A5 | Criterion 5's "with that refusal removed" means a planted-violation harness against `setLabel()`'s guard, not a schema change. | Pitfall 9 | Low. The `unique` DDL constraint would still fire on a schema-level removal, so the harness reading is the only one that produces the intended ACME-side observation. |
| A6 | The "fixture that actually contains self-modifying code" (criterion 3) can be the golden witness `r2000.asm` or a purpose-built minimal fixture. | Pattern 1 | Low. The witness has six live `=*+$01` labels and reassembles clean, so it satisfies the letter; a minimal fixture is easier to reason about. Either works; the plan should pick one and say why. |
| A7 | The `28-*` and `29-*` phase artifacts contain no further binding constraint on export beyond what is quoted here. | throughout | Low-medium. I read `29-RESEARCH.md`'s Phase-30 references and `module-classification.ts`'s two relevant entries, not all 44 SUMMARY files. |

## Open Questions

1. **Do `gen-enums`, `export-lbl` and `import-lbl` land in this phase?**
   - *What we know:* `anno-cli.ts:24`, `scripts/lib/anno-cli-verbs.mjs`'s `ANNO_CLI_VERB_FLOOR` doc-comment, `src/skills/c64-program-recon/SKILL.md:224,247` and `src/skills/c64-memory-mapping/SKILL.md:209` all say these three return "in Phase 30". `29-RESEARCH.md:2067-2072` flags it as *"a scope decision the plan cannot silently absorb"*. The supporting machinery already exists: `anno-symbols.ts` still exports `validateLabelFileForImport()` and the `ExportLabels*`/`ImportLabels*` types; `anno-enum-gen.ts` still exports `planEnumsForPairing()`, `buildEnumGenerationReport()`, `sanitizeVariantMap()`.
   - *What's unclear:* **no Phase 30 requirement or success criterion mentions any of them.** `EXPORT-01/02/03` are entirely about the ACME oracle.
   - *Recommendation:* treat them as **out of scope for Phase 30 unless the user says otherwise**, and raise it as the first thing in planning. Absorbing three verbs silently is the exact failure `29-RESEARCH.md` warned about.

2. **Does the export route become an MCP tool as well as a CLI verb?**
   - *What we know:* `MCP-02` is satisfied for the whole `anno_*` family by construction (see below). Adding `anno_export_asm` would inherit that. The withdrawal notices all name the **CLI verb** `anno export-asm`, never a tool.
   - *Recommendation:* CLI verb only. It writes a file and takes minutes-scale work; it is a poor fit for a tool call, and the 19-tool surface was derived from a manifest rather than chosen.

3. **Does the verify module ship, or stay test-only?**
   - See Pitfall 6. Both options have a mechanical consequence. Recommend: **ship the exporter, keep the verify module test-only** for the phase, mirroring `acme-gate.ts`. That keeps `spawn-seam.test.ts` and the `files[]` closure untouched, and the oracle still stands and is still exercised on every suite run — which is what "standing and exercised before the deletion window opens" asks for.

4. **What exactly is "the input" for the byte-diff on a store whose ranges are sparse?**
   - See Pitfall 7. Contiguous-span export, per-block diff, and `-f cbm` against a `.prg` all give different answers. Recommend per-block diff, since criterion 4's per-block `*` assertion already establishes block as the unit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | the whole phase | ✓ | 0.97 "Zem", 31 Jan 2021, `/home/henrik/.local/bin/acme` | none needed; CI installs it (`.github/workflows/ci.yml:78`) |
| Node.js | everything | ✓ | required `>= 22.18` per `src/mcp/vice/package.json` engines | none |
| ACME `<cbm/c64/vic.a>` library | **not needed by this phase** | ✗ (`ACME=` is set empty in CI's scaffold step, `.github/workflows/ci.yml:99-100`) | — | The exporter emits self-contained source with zero external declarations, exactly as `disasm-renderer.ts` already does; never emit a `!source <...>` |
| VICE emulator | **not needed by this phase** | n/a | — | Export reads a store and an image file; no emulator participates |
| `node:sqlite` `DatabaseSync` | store reads | ✓ (Node builtin, already used by `anno-store.ts`) | — | none |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the ACME stdlib, which this phase must not depend on.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`); no external framework |
| Config file | none — `src/mcp/vice/test-gate.mjs` is the automated-subset seam |
| Quick run command | `cd src/mcp/vice && npm run test:automated` |
| Full suite command | `cd src/mcp/vice && npm test` (full `*.test.*` glob — **CI's command**, with `VICE_REQUIRE_ACME=1`) |

**Measured baseline this session** (`npm run test:automated`, no broker running):
```
# tests 2771
# suites 24
# pass 2765
# fail 0
# cancelled 0
# skipped 1
# todo 5
# duration_ms 45369
```
[VERIFIED: live run, 2026-08-30]. **The clean floor is 0 failures.** Any red introduced by this phase is this phase's. Note the standing hazard from project memory: a **live VICE broker reddens the BACK-05 test deterministically** — stop the broker before trusting any suite result.

Test files are colocated `*.test.ts` next to the module. `test-gate.mjs`'s `automatedTestFiles()` globs `*.test.*` and subtracts `MANUAL_ONLY_TESTS` (nine entries); a new test file is auto-discovered — **do not add it to `MANUAL_ONLY_TESTS`**, and `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | With `ACME_BIN` bogus, verification reports skipped-or-failed and never a pass | integration (child process) | `node --test acme-verify.test.ts` | ❌ Wave 0 |
| EXPORT-01 | Restoring the exit-code shortcut makes that test fail (non-vacuity control) | planted violation | same file | ❌ Wave 0 |
| EXPORT-01 | A corrupted export byte fails the byte-diff while ACME exits 0 | integration (real ACME) | same file, `{ skip: SKIP_REASON }` | ❌ Wave 0 |
| EXPORT-01 | `assertAcmeRequiredIfEnvSet()` hard-FAILs under `VICE_REQUIRE_ACME` | never-skipped gate | one test per new ACME-dependent file | ✅ `acme-gate.ts` exists; call sites are new |
| EXPORT-01 | Verdict never reads `exitStatus`; `"skipped"` is a third outcome | unit | `node --test acme-verify.test.ts` | ❌ Wave 0 |
| EXPORT-02 | `=*+$01` on a real SMC fixture reassembles byte-identically | integration (real ACME) | `node --test anno-export-asm.test.ts` | ❌ Wave 0 |
| EXPORT-02 | The exporter reads `AUTO_NAME_PREFIX_RE` rather than restating prefixes | structural (source scan) | same file | ❌ Wave 0 |
| EXPORT-02 | All eleven prefixes survive a round trip through the export | integration | same file | ❌ Wave 0 |
| EXPORT-03 | Every `acmeExpressible: false` opcode exports as `!byte` and round-trips | integration (real ACME), table-driven from `OPCODES` | same file | ✅ precedent: `disasm-roundtrip.test.ts` Suite C |
| EXPORT-03 | Correctness is never claimed from a string match on export text | structural (the verdict function has no `.includes()` on its own output) | `node --test acme-verify.test.ts` | ❌ Wave 0 |
| criterion 4 | Every block asserts `*` equals its original address | unit (emitted text) + integration (a planted zero-page label substitution makes it red) | `node --test anno-export-asm.test.ts` | ❌ Wave 0 |
| criterion 4 | Enum renders on the immediate operand only; wrong-operand case caught by byte-diff | integration (real ACME) | same file | ❌ Wave 0 |
| criterion 5 | The store refuses a duplicate label; with the refusal removed, real ACME reports `Symbol already defined.` | integration (planted violation + real ACME) | `node --test acme-verify.test.ts` | ✅ store guard exists (`anno-store.ts:2833`); the ACME-side observation is new |

### Sampling Rate

- **Per task commit:** `cd src/mcp/vice && npm run test:automated` (~45 s, floor 0 failures)
- **Per wave merge:** same, plus `npm run typecheck`
- **Phase gate:** `cd src/mcp/vice && VICE_REQUIRE_ACME=1 npm test` (the full glob, CI's command — this is the Phase 27 hard-fail gate at the boundary), plus `node scripts/check-npm-packages.mjs`, `node scripts/check-no-regenerator2000.mjs`, `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-skill-cli-invocations.mjs`, `node scripts/check-skill-fork-honesty.mjs`

### Wave 0 Gaps

- [ ] `src/mcp/vice/anno-export-asm.test.ts` — covers EXPORT-02, EXPORT-03, criterion 4
- [ ] `src/mcp/vice/acme-verify.test.ts` — covers EXPORT-01 (both mandatory reds), criterion 1, criterion 5
- [ ] `.planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/` — the two **re-recorded** transcripts plus a README recording ACME 0.97 provenance and stating that the Phase 29 fixtures were read for shape only
- [ ] A self-modifying-code fixture with a known-good byte image (criterion 3 requires *"a fixture that actually contains self-modifying code"*)
- [ ] Framework install: **none** — `node --test` is already in use

## Security Domain

`security_enforcement` is `true`, `security_asvs_level` 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication surface; the CLI and MCP surface are local |
| V3 Session Management | no | No sessions |
| V4 Access Control | **yes** — filesystem confinement | `anno-types.ts`'s `storePathWithinWorkspace()`, the ONE seam. Every caller-supplied path (store, image, `--out`) goes through it, and the **realpath it returns** is used, never the raw caller string [VERIFIED: src/mcp/vice/anno-types.ts:1192-1203; the "never use the RAW caller string" rule at src/mcp/vice/anno-cli.ts:~82] |
| V5 Input Validation | **yes** | Addresses via `parseStoreAddress`, ranges via `assertRangeShape`, data types via `assertDataType`, label names via `assertLegalLabel` + `assertLegalAcmeIdentifier` (REJECT, never sanitise), comment text via `assertCommentText` (byte-measured via `TextEncoder`, not `String.length`) |
| V6 Cryptography | no | None used |
| V12 Files & Resources | **yes** | Assemble into `mkdtempSync(tmpdir())`, `rmSync(..., {recursive:true, force:true})` in a `finally` — this host's `/tmp` is RAM-backed and a leaked directory is leaked memory |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection through `ACME_BIN` or a source path | Elevation of Privilege | `spawnSync(bin, argvArray)` — **never** a shell string, never string interpolation of the binary path. `acme-gate.ts`'s header states the rule and says the file *"is grepped mechanically for exactly this, so the guard cannot rot"* |
| Path traversal via `--out` writing outside the workspace | Tampering | `storePathWithinWorkspace()`. **Phase 29 found three live escapes of exactly this shape** — `render-memmap --out` and `coverage --out` reached `writeFileSync` as raw caller strings, one silently replacing a pre-existing file outside the workspace root and exiting 0 [VERIFIED: src/mcp/vice/anno-cli.ts header, "THIS PARAGRAPH WAS FALSE WHEN IT WAS FIRST WRITTEN"] |
| Arbitrary-file read oracle via an input path | Information Disclosure | Same seam. Phase 29's third escape was `render-memmap --provenance` reaching `readFileSync` raw and disclosing the file's opening bytes through an interpolated parse error — **do not interpolate file content into an error message** |
| A new path argument bypassing the seam | Tampering | `anno-cli-path-consumers.test.ts` enumerates every caller-supplied path argument from `VERB_OPTIONS` and each verb's `--help` synopsis, and fails when the inventory and the surface disagree in either direction. A new `export-asm` flag joins the audit automatically — but only if it is declared in `VERB_OPTIONS` and the synopsis |
| Label-name injection into generated ACME source | Tampering | `assertLegalAcmeIdentifier()` — `^[A-Za-z_][A-Za-z0-9_]*$`, ≤ 200 chars, no reserved-mnemonic collision. **REJECT, never sanitise:** `anno-types.ts:84-92` records that a space-to-underscore substitution merges `init screen` and `init_screen` into one name, silently and permanently |
| Comment-text injection breaking out of a `;` comment | Tampering | Comments must be emitted with newlines stripped or refused. `assertCommentText()` already refuses a leading `';'`; **verify it also refuses embedded newlines** — an embedded `\n` in a stored comment would emit arbitrary ACME source. *This is the one control I could not confirm from the source this session; the plan must check it.* |

## MCP-02 (CLAUDE.md constraint) — explicit answer

**MCP-02 is satisfied by construction and this phase changes nothing about it, provided the export route does not become a manifest tool.**

The `anno_*` family is registered through `buildViceTool()` **directly**, in its own loop, deliberately not through the manifest loop's `buildBackendAwareTool()`:

```ts
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
[VERIFIED: src/mcp/vice/vice-proxy.ts:3388-3390, with the reasoning at :3374-3387 — *"so no anno_* runner can ever reach forwardToVice(), call(), or ensureViceSession() — CLAUDE.md's 'derived tools must be intercepted before forwardToVice()' constraint is satisfied by construction for this family, not by an interception, because the runner is never wired to forwardToVice() in the first place."*]

`anno-tools.ts:49-60` states the same thing from the other side and adds the corollary that binds this phase: **the module must never import `hostpath.ts`**, because both the store path and the image path are **proxy-local** filesystem paths and translating either would point the code at a file on the wrong side of the container boundary. `hostpath-consumers.test.ts` keeps that consumer set at exactly five modules and names `anno-tools.ts` as forbidden.

**Concretely for Phase 30:**
- If the export lands as a **CLI verb only**, `forwardToVice()` is not on any path it takes — `runR2000Cli()` is reached through `vice-proxy.ts`'s subcommand branch, not the tool dispatcher. Nothing to do.
- If an `anno_export_asm` **tool** is added to `ANNO_TOOL_DEFINITIONS`, it inherits the family's construction-level satisfaction automatically, **and inherits the prohibition**: it must not import `hostpath.ts`/`containerpath.ts`, and every path it handles is container-side already.
- Either way, **do not import `hostpath.ts` into any new module in this phase.** `hostpath-consumers.test.ts` will red, and the failure will look unrelated.

The two `rewriteArguments()` line citations in CLAUDE.md (`vice-proxy.ts:3050`, `:1529`) are mechanically checked by `docs-linerefs.test.ts`. This phase should not touch `forwardToVice()` or `gatherWedgeEvidence()`; if it does, re-verify those four line numbers.

## Sources

### Primary (HIGH confidence)

- **Live ACME 0.97 "Zem" runs on this host, 2026-08-30** — every behavioural claim about ACME in this document. Fixtures in `/tmp/claude-1000/.../scratchpad/acme/`. Covered: `=*+$01` placement (both directions), duplicate-symbol error text (both spellings, both `--msvc` and default), `!if`/`!error` `*` assertions (pass and fail), `!pseudopc` PC-undefined error, warnings-with-exit-0 (LXA, JMP($xxff), oversized addressing mode), the stale-output-on-failure trap, `-f plain` gap zero-filling, `-f cbm` load-address prefix, `!cpu 6510` in-source vs `--cpu` flag, `--strict-segments` overlap promotion, symbol-definition hex-digit width rule (4 forms), forward-reference widening, `+1`/`+2` size forcing, enum-on-immediate byte-identity, enum-on-address divergence, `Number does not fit in 8 bits.`, `jam` → `$02` vs `!byte $12` → `$12`, `-v1`/`-v2` stdout vs diagnostics stderr, `-Wtype-mismatch` gating the `!addr` symbol-file marker, `spawnSync` `status: null` on ENOENT/EACCES, and a full clean reassembly of the golden witness.
- **Files read this session** — `src/mcp/vice/`: `acme-gate.ts`, `acme-gate.test.ts` (header + child-probe region), `anno-acme-ident.ts`, `anno-cli.ts` (header), `anno-coverage.ts:1340-1470`, `anno-coverage.test.ts:1400-1430`, `anno-store.ts` (DDL, `setLabel`, `listLabels`, exports index), `anno-types.ts` (vocabularies, row shapes, `storePathWithinWorkspace`), `anno-tools.ts:40-100`, `block-class.ts`, `disasm-opcodes.ts:1-210`, `disasm-renderer.ts` (full), `disasm-roundtrip.test.ts:1-140`, `module-classification.ts:130-200,595-720`, `prg-image.ts` (full), `shipped-modules.ts` (exports), `spawn-seam.test.ts:1-80,160-300`, `test-gate.mjs` (full), `vice-proxy.ts:3370-3395`, `package.json`; plus `src/skills/acme-build/scripts/acme.mjs` (full), `scripts/lib/anno-cli-verbs.mjs` (full), `scripts/check-npm-packages.mjs:230-270`, `.github/workflows/ci.yml:37-170`, `.planning/notes/dxa-ghidra-pivot-evidence/r2000.asm`, `.planning/phases/29-the-mcp-surface/fixtures/{README.md,verify-honest-pass.txt,verify-false-pass-trap.txt}`.
- **Live suite run** — `npm run test:automated`, 2771 tests / 2765 pass / 0 fail / 1 skip / 5 todo / 45 s.

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` § Phase 30, `.planning/REQUIREMENTS.md` §§ ACME Export, `.planning/STATE.md` (Phase 27 decision rows), `.planning/research/PITFALLS.md:956,970`, `.planning/research/SUMMARY.md:162`, `.planning/phases/29-the-mcp-surface/29-RESEARCH.md` (Phase-30 references) — project record, not independently re-derived.

### Tertiary (LOW confidence)

- None. No external web source was needed; ACME's behaviour was measured rather than looked up.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every module cited was opened and read this session; no package is added.
- ACME behaviour: **HIGH** — measured live against ACME 0.97 on this host, both directions on every claim that has one.
- Architecture: **HIGH** for the reuse map (`disasm-*` + `anno-store` readers are unambiguous); **MEDIUM** for the verdict-rule mapping onto `-v2` result lines (assumption A4).
- Pitfalls: **HIGH** — every pitfall in this document was reproduced live, including the stale-output trap that appears nowhere in the project record.
- Scope: **MEDIUM** — Open Question 1 (three withdrawn verbs) is a genuine, documented ambiguity between the ROADMAP requirements and four in-tree comments, and it must be settled before planning proceeds.

**Research date:** 2026-08-30
**Valid until:** 2026-09-29 (stable — ACME 0.97 is from 2021 and the in-repo modules are settled; re-verify only if `disasm-*` or `anno-store.ts` change)
