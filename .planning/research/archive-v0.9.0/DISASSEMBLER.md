# 6502/6510 Disassembler: Build vs. Buy

**Milestone:** v0.2.0 switchable stock-VICE backend
**Dimension:** Stack — client-side 6502/6510 disassembler for the MCP server
**Researched:** 2026-08-12
**Confidence:** HIGH (npm registry queried live; all candidate tarballs downloaded and executed; all licenses read from source)

---

## Recommendation (short form)

**BUILD.** Write ~750 lines of TypeScript across three new sibling modules in
`.claude/mcp/vice/`. Add **zero npm dependencies**.

**Opcode-table source:** transcode **cc65 `src/da65/opc6502x.c`** (zlib license —
MIT-compatible) as the primary, cross-check every one of the 256 entries against
**`fluffy-6502@0.3.0` `dist/instructions.js`** (MIT) and **ACME's
`docs/Illegals.txt` + `src/mnemo.c`** (already a project dependency), and
**re-spell the mnemonics to ACME's `!cpu 6510` set** so output round-trips
through the `acme-build` skill.

**Do NOT use:** any npm package (all five candidates fail hard — details below),
and **do NOT copy from VICE** (`6510core.c`, `mon_disassemble.c`,
`monitor/asm6502.c`) — VICE is **GPL-2.0-or-later** and this repo is **MIT**
(`/home/henrik/dev/henrik/git/c64-re-tools/LICENSE`, `Copyright (c) 2026 Henrik
Olsson`; both `package.json` files declare `"license": "MIT"`). Copying tables or
table *arrangement* out of VICE source would be a license violation.

---

## 1. npm candidate survey (verified live against registry.npmjs.org, 2026-08-12)

Search terms used: `6502 disassembler`, `6510`, `c64 disassembler`, `6502 opcodes`,
`nes disassembler`, `6502 assembler`, `commodore 64 assembly`, plus direct 404-probes
for `6502-opcodes`, `6502-opcode-table`, `opcodes-6502`, `6510-disassembler`,
`c64-disassembler`, `@c64/disassembler`, `6502dasm`, `dasm6502`, `disasm6502`
(all 404 — no dedicated opcode-table package exists on npm).

| Package | Latest | Published | dl/wk | License | Types | Module | Deps | Illegal 6510 opcodes |
|---|---|---|---|---|---|---|---|---|
| `6502-reasm` | 1.0.0 | 2017-11-19 | 16 | MIT | ✗ none | CJS | 0 | **Full** (oxyron-derived) but renamed & mis-rendered |
| `js6502disasm` | 1.0.0 | 2021-12-30 | 9 | MIT | ✓ `.d.ts` | CJS | 0 | **None — and it is a 65C02 table** |
| `6502-disasm` | 0.0.6 | 2016-10-16 | 8 | MIT | ✓ `.d.ts` | CJS | 0 | **None** (throws / bit-pattern decode) |
| `mos6502` | 1.1.1 | 2025-02-26 | 27 | MIT | ✓ `.d.ts` | CJS | 0 | **None** (sparse 151-entry Map) |
| `fluffy-6502` | 0.3.0 | 2026-08-02 | 39 | MIT | ✓ `.d.ts` | **ESM** | 0 | **Full, modern mnemonics** — but *no disassembler*, table not exported |
| `6502.ts` | 1.1.4 | 2023-09-12 | 139 | MIT | ✗ none | CJS | **10** (incl. emscripten `dasm`) | Atari-2600 emulator, not a library |
| `@sfotty-pie/sfotty` | 0.3.0 | 2026-07-11 | 21 | MIT | ✗ none | ESM | 0 | Emulator only, no disassembler |

`romdevtools@0.116.0` (1564 dl/wk) surfaced repeatedly in searches. It is a
*competing MCP tool server* with a WASM Ghidra decompiler, not a library — out of
scope and architecturally incompatible.

### Per-candidate disqualification (evidence, not opinion)

**`js6502disasm@1.0.0` — hard disqualify, actively dangerous.**
Its `src/opcodes.ts` is a **65C02/W65C02S** table, not NMOS 6510. It contains
`bbr0..7`, `bbs0..7`, `smb0..7`, `rmb0..7`, `plx`, `phx`, `stz`, `tsb`, `trb`, and
zero illegal opcodes. Concretely: it decodes `$EF` as `bbs6` (3 bytes) where a 6510
executes `ISC $abcd` (3 bytes), and `$F7` as `smb7` (2 bytes) where a 6510 executes
`ISC $zz,X` (2 bytes). Wrong lengths desynchronise the entire remaining stream.
`parseInstruction()` **throws** `Illegal opcode $N at $addr` on any byte absent from
the table — so any real C64 memory dump aborts mid-range. It also has **no
`repository` field** on the npm record (unauditable provenance) and 9 dl/wk.

**`6502-disasm@0.0.6` — hard disqualify.**
Decodes by bit-pattern family masks (`INSTR_FAMILY_MASK`, `ADDRESSING_MODE_MASK`), so
illegals are structurally unreachable — zero illegal mnemonics in 373 lines. Its only
public method is `decode(start?, end?): string[]` — **formatted strings only**, no
instruction lengths, no addressing mode, no operand value. That alone kills it: the
`backtrace` stack-walk needs lengths, and symbol substitution would require
re-parsing formatted text. Its own README documents a method (`decodeNext()`) that
does not exist in the shipped `.d.ts`. Last published 2016.

**`mos6502@1.1.1` — disqualify.**
Genuinely well-built and recently published, and it *does* export `decode` plus a
`DebugInfo` shape with `{ address, instruction: number[], disassembly: { instruction,
addressingMode, operand } }` — close to the shape we want. But its `src/decoder.ts`
matrix is a **sparse 151-entry `Map`** covering documented opcodes only, with cycle
counts. `decode($02)` returns `undefined`. For C64 RE that is a non-starter. CJS-only
(`main: dist/cjs/index.js`, no `type: module`, no `exports` map).

**`6502-reasm@1.0.0` — closest miss, still disqualify.** This is the only published
npm package with a complete 256-entry NMOS table (transcribed from oxyron.de, with a
large mnemonic-alias map). I executed it. Four independent blockers:

1. **Relative branches render as offsets, not targets.** `m.disasm([0x10,0xfe],0xc000)`
   → `"BPL -2"`. The single most important rendering behaviour for reverse engineering
   is `BPL $c00a`. Fixing this requires re-deriving the target from `bytes[1]`, i.e.
   reimplementing the interesting half.
2. **Deliberately non-standard mnemonics.** It renames `$2B` → `ANT` and `$EB` → `SBD`
   ("renamed to SBD to disambiguate", per its own comment) so its `reasm()` round-trips.
   It also emits disambiguation suffixes: `$12` → `KIL.B`, `$32` → `KIL.D`, `$1A` →
   `NOP.I`, `$3A` → `NOP.A`, `$82` → `NOP.B #$22`. **No assembler accepts any of these**,
   least of all ACME.
3. **Silently fabricates truncated instructions.** `m.disasm([0xa9],0xc000)` →
   `{assembly:"LDA #$xx", bytes:[169,null]}`; `m.disasm([0xad,0x20],0xc000)` →
   `{assembly:"LDA $xx20", bytes:[173,32,null]}`. A truncated instruction is presented
   as a complete one with a `null` in the byte array and no flag. This is exactly the
   "silent-but-observable failure" bug class that `CONVENTIONS.md` says the codebase
   "actively designs against."
4. **Output is a pre-formatted `assembly` string** with no `mode` field and no separate
   operand value — symbol substitution would mean regex-rewriting rendered text.

Plus: CJS with no types and no `exports` map (would need a hand-written `.d.ts` to
satisfy `strict` + `verbatimModuleSyntax`), 16 dl/wk, untouched since 2017.

**`fluffy-6502@0.3.0` — not buyable, but the best free cross-check.**
MIT, `"type": "module"`, typed, zero deps, published 10 days ago. Its
`dist/instructions.js` carries a **complete, modern-mnemonic NMOS table** — `jam`,
`slo`, `rla`, `sre`, `rra`, `sax`, `lax`, `lxa`, `dcp`, `isc`, `anc`, `alr`, `arr`,
`sbx`, `las`, `sha`, `shx`, `shy`, `tas`, `ane`, `usbc` — alongside a parallel `modes`
table (which even distinguishes `absolute,x` from `absolute,x fast`, i.e. page-cross
penalty). But:
- **There is no disassembler.** `grep -ril disas` over the whole tarball returns nothing.
  It is an assembler + emulator.
- **The tables are not reachable.** `package.json` declares `"exports": { ".":
  "./dist/index.js" }`, and `index.js` re-exports only `assemble`, `Machine`, `jams`,
  `LocatedError`. `modes` and `instructions` are not re-exported, and the `exports` map
  blocks `import "fluffy-6502/dist/instructions.js"`.
- 0.3.0, three published versions, single author, 39 dl/wk.

Its table remains extremely valuable as an **independent MIT-licensed verification
source** for our own table — use it that way.

### Conclusion on "buy"

There is **no package on npm** that (a) covers the NMOS 6510 illegal opcode set, (b)
returns structured records with instruction lengths, and (c) renders branch targets
correctly. The closest candidate would require reimplementing branch-target
computation, remapping ~30 mnemonics, and patching truncation handling — more work
than writing the whole thing, while adding an unmaintained 2017 CJS dependency to a
project that runs TypeScript with no build step.

---

## 2. Illegal/undocumented opcode handling — the decisive axis

C64 reverse-engineering hits illegals constantly (crunchers, crack intros,
copy-protection loops, and hand-optimised raster code use `lax`/`sax`/`slo`/`dcp`
deliberately; `jam` shows up in anti-debug traps). A disassembler that mis-sizes
them desynchronises everything after them.

**The highest-impact correctness item is not the exotic mnemonics — it is the
undocumented `NOP` variants' operand lengths.** These 12 opcodes must consume the
right number of bytes:

| Opcodes | Real behaviour | Length |
|---|---|---|
| `$1A $3A $5A $7A $DA $FA` | implied NOP | 1 |
| `$80 $82 $89 $C2 $E2` | NOP immediate ("skip byte", ACME `dop`) | 2 |
| `$04 $44 $64` | NOP zero-page | 2 |
| `$14 $34 $54 $74 $D4 $F4` | NOP zero-page,X | 2 |
| `$0C` | NOP absolute (ACME `top`) | 3 |
| `$1C $3C $5C $7C $DC $FC` | NOP absolute,X | 3 |

`js6502disasm`, `6502-disasm`, and `mos6502` all get these wrong or refuse them. This
is why the "just buy something" path fails.

### Mnemonic spelling: the three sets disagree, and it matters

I read all three tables from source. The disagreements are not cosmetic:

| Opcode | cc65 `da65` (zlib) | VICE monitor `asm6502.c` (GPL-2) | ACME `!cpu 6510` (accepted input) |
|---|---|---|---|
| `$02` etc. | `jam` | `JAM` | `jam` (**only `$02` is emittable**) |
| `$4B` | `alr` | `ASR` | **`asr`** (`alr` is not a keyword) |
| `$CB` | `axs` | `SBX` | **`sbx`** (`axs` is not a keyword) |
| `$AB` | `lax` | `LXA` | **`lxa`** (distinct from `lax`) |
| `$8B` | `ane` | `ANE` | `ane` |
| `$9B` | `tas` | `SHS` | **`tas`** |
| `$93 $9F` | `sha` | `SHA` | `sha` |
| `$E7` family | `isc` | `ISB` | **`isc`** |
| `$EB` | `sbc` | `USBC` | **no mnemonic exists** |
| `$2B` | `anc` | `ANC` | `anc`, but ACME emits `$0B` for it |
| NOP variants | `nop` + operand | `NOOP` | **`dop` / `top`** (not `nop`) |

**Consequences for the decision:**

- Adopting cc65's spellings verbatim yields output that ACME cannot assemble in
  **five** places (`alr`, `axs`, `lax @ $AB`, `sbc @ $EB`, and every `nop` with an
  operand). Since this repo ships an `acme-build` skill and users will paste
  disassembly into ACME sources, **the mnemonic set must be ACME's**.
- VICE's spellings differ from ACME's in six places. This is fine — and it is exactly
  what `docs/stock-vice-parity.md` §A.7 and PROJECT.md's Out-of-Scope entry already
  licensed: byte-identical parity with VICE's disassembler is not an acceptance bar.
  **Document the divergence table above in the tool description** so a user diffing
  against a VICE monitor `disass` is not surprised.
- `$EB` needs an explicit policy. Recommend rendering `usbc #$nn` (VICE's spelling,
  unambiguous) with a `warnings: ["not-acme-assemblable"]` flag, plus a
  `!byte $eb,$nn` alternative when `acmeReassemblable: true`.

### Rendering policy: mnemonics, not `.byte`

**Default to mnemonics for all 256 opcodes.** Rationale:

1. `.byte` output destroys instruction length, and the `backtrace` requirement
   (stack-page walk) needs lengths to validate that the word below a stack slot is a
   plausible `JSR` return address. Rendering `$03` as `!byte $03` loses the fact that
   the next instruction starts 2 bytes later.
2. C64 code containing illegals is *intentional*, not garbage. Hiding it defeats the
   tool's purpose.
3. The 12 `JAM` opcodes are the only ones where the byte form is arguably more honest;
   handle them via `flowBreak: true` + a warning instead of by changing the rendering.

Provide `illegalStyle: "mnemonic" | "byte"` as an option for the case where a user is
disassembling a data table and wants the noise suppressed. Never make `"byte"` the
default.

Mark the six genuinely unstable illegals (`ane $8B`, `lxa $AB`, `sha $93/$9F`,
`shx $9E`, `shy $9C`, `tas $9B`) with `unstable: true` so the annotation layer can
append a caution comment — those depend on an indeterminate magic constant and on
`{H+1}` behaviour that varies with page crossing.

---

## 3. Build-your-own cost and the non-obvious traps

### Size estimate (TypeScript, this codebase's comment-heavy house style)

| Module | Lines | Notes |
|---|---|---|
| `disasm-6510-table.ts` | ~330 | 256 one-line entries + 13 addressing-mode descriptors + alias map. One line per opcode (greppable, reviewable, diffable) — do **not** compress into parallel 16×16 arrays. |
| `disasm-6510.ts` | ~200 | `decodeInstruction`, `decodeRange`, target computation, warning derivation, truncation. |
| `disasm-format.ts` | ~180 | Operand templates per mode, symbol hook, annotation hook, ACME force-bit emission. |
| JSDoc / decision-record header comments | +150 (spread through the above) | Required by `CONVENTIONS.md`. |
| **Total production** | **~700–800** | |
| `disasm-6510.test.ts` | ~450 | Includes the 256-opcode coverage assertion and the ACME round-trip test below. |

That is roughly one focused work session, versus a permanent dependency on a
2017 CJS package that gets branch targets wrong.

### Trap 1 — Relative branch target

```
target = (address + 2 + int8(operand)) & 0xFFFF
```

Three separate mistakes are common, and I confirmed a published package making the
worst of them:

- **Rendering the offset instead of the target.** `6502-reasm` emits `BPL -2`. Emit
  `bpl $c00a`. The offset is an encoding detail; the address is the information.
- **Forgetting the `+2`.** The offset is relative to the address of the *next*
  instruction, not the branch opcode. A `$FE` operand is the classic self-loop
  (`bpl *`), which is only visible if the `+2` is right.
- **Missing the 16-bit wrap.** A backward branch near `$0002` or a forward branch near
  `$FFFE` wraps. On real hardware the branch is a full 16-bit PC addition (the PCL/PCH
  fixup cycle produces the arithmetically correct address), so `& 0xFFFF` is correct —
  but emit a `"branch-wraps-address-space"` warning, because a wrapping branch in real
  code is almost always a sign the disassembly is misaligned.

Sign extension: `const delta = (operand ^ 0x80) - 0x80;` or `(operand << 24) >> 24`.
Do not write `operand > 0x7f ? operand - 0x100 : operand` inline in three places —
put it in one helper, per the "one authoritative seam" convention.

### Trap 2 — `JMP ($xxFF)` NMOS page-boundary bug

The *rendering* is unremarkable: `jmp ($02ff)`. The trap is everything downstream.
On NMOS 6502/6510, `JMP ($xxFF)` fetches the low byte from `$xxFF` and the high byte
from **`$xx00`**, not `$xx+1,$00`. So:

- Never resolve the indirect target and present it as the jump destination unless you
  actually read the vector *with the wrap applied*.
- Set `warnings: ["nmos-jmp-indirect-page-wrap"]` whenever `$6C` has `operand & 0xFF
  === 0xFF`. This is high-value: it is a real bug source in C64 code and a real
  divergence between NMOS and 65C02, and flagging it is a genuine value-add over
  VICE's own disassembler.
- `operandRole` for `$6C` must be `"pointer"`, not `"jumpTarget"` — otherwise the
  symbol layer will substitute a code label for what is actually a pointer address.

### Trap 3 — Zero-page vs absolute disambiguation

Direction matters. The **opcode** determines the mode; the operand value never does.
The real traps:

- **Always print absolute operands with four hex digits**, even when the high byte is
  `$00`. `AD 10 00` is `lda $0010` (4 cycles, absolute). Printing `lda $10` re-assembles
  to `A5 10` — a different opcode, different cycle count, different byte count. When
  `acmeReassemblable: true`, emit ACME's force-bit postfix: **`lda+2 $0010`** (verified
  from ACME `docs/AddrModes.txt`; the postfixes are `+1`/`+2`/`+3` and take highest
  priority). cc65's `da65` solves the identical problem with its `flAbsOverride` flag
  and an `a:` prefix — evidence the trap is real, not theoretical.
- **Zero-page always prints two digits**: `$10`, never `$0010`.
- **Do not forget zero-page,Y.** `$96 $97 $B6 $B7` are `sty/sax/ldx/lax` zero-page,**Y** —
  a mode several published tables omit or mislabel as zero-page,X.
- **Zero-page wraparound is an execution fact, not a rendering fact.** `lda ($ff,X)`
  with `X=1` reads the pointer from `$00`/`$01`, not `$0100`. Don't try to render the
  effective address for indexed modes at all — leave `effectiveAddress` undefined for
  `izx`/`izy`/`zpx`/`zpy`/`abx`/`aby`, because it depends on runtime register values.
  Only `abs`, `zp`, `rel`, and `ind` have a statically knowable address.

### Trap 4 — Partial instruction at the end of the requested range

Two things to get right, and one of them is a protocol-level insight:

1. **Never fabricate.** Return a discriminated `{ kind: "truncated", address, bytes,
   opcode, missingBytes }` row. Do not emit `lda $xx20` (which is what `6502-reasm`
   does — and note the `xx` lands in the *high* nibble position, so the rendered
   operand is actively misleading). Per `CONVENTIONS.md`, prefer a structured result
   that tells the caller *which* part failed over a plausible-looking guess.
2. **Prevent it at the source.** The `vice_disassemble` tool should over-read: ask
   `MEM_GET` for `length + 2` bytes, decode, then drop any instruction whose *start*
   address lies past the user's requested end. Then truncation only ever happens at a
   genuine memspace boundary (`$FFFF`), not as an artefact of range slicing. State this
   explicitly in the phase plan — it is easy to miss and it eliminates the entire
   failure mode for normal use.

### Trap 5 — Alignment honesty

A disassembler entered mid-instruction produces confident garbage for several
instructions before self-resynchronising. Do not attempt heuristic resynchronisation
in v1. Do include the raw bytes on every row so the human can see `AD` where they
expected an opcode, and note in the tool description that `start` must be an
instruction boundary.

### Trap 6 — Bank/memspace, not a disassembler bug but adjacent

Disassembling `$D000–$DFFF` yields completely different results depending on whether
`MEM_GET` was issued against the I/O bank or the RAM bank. The disassembler is
bank-agnostic by design; the *tool* must pass through and echo the bank it read, so
the output is reproducible. Worth a line in the phase plan.

### Deferred: cycle counts

cc65's `OpcDesc` carries `{ Mnemo[6], Size, Flags, Handler }` — **no cycle counts**
(verified in `src/da65/opcdesc.h`). `fluffy-6502` encodes timing implicitly in its
emulator loop rather than as a table. So an ACME/cc65-sourced table gives us
mnemonic + mode + length but not cycles.

No v0.2.0 requirement needs cycle counts (PROJECT.md's cycle constraint is about
reconstructing absolute cycles from the text monitor's `stopwatch`, not about static
per-instruction timing). **Ship without them**; reserve an optional `cycles?` and
`pageCrossPenalty?` field in `OpcodeDesc` so adding them later is not a breaking
change. If they are needed: take them from oxyron.de and cross-check against the
"No More Secrets" appendix — both are factual hardware data, but neither carries a
license grant, so transcribe rather than copy formatting.

---

## 4. Authoritative opcode-table sources and their licenses

| Source | Content | License | Verdict |
|---|---|---|---|
| **cc65 `src/da65/opc6502x.c`** | 256 entries: mnemonic, size, `flUseLabel`/`flAbsOverride` flags, addressing handler. Header comment: *"Base table from opc6502.c with illegal opcodes from http://www.oxyron.de/html/opcodes02.html"* | **zlib** (verified: `cc65/LICENSE` and the file's own header, © 2000-2011 Ullrich von Bassewitz) | ✅ **PRIMARY.** Permissive, MIT-compatible, community-authoritative (it is the C64 toolchain's own disassembler), and structured exactly like the table we need. |
| **`fluffy-6502@0.3.0` `dist/instructions.js`** | 256-entry mnemonic array + parallel `modes` array with page-cross distinction | **MIT** (verified in registry metadata and tarball `package.json`) | ✅ **CROSS-CHECK.** Independent derivation, modern mnemonics. Unusable as a runtime dep (not exported) but ideal as a second opinion. |
| **ACME `docs/Illegals.txt` + `src/mnemo.c`** | The exact mnemonics and addressing-mode/opcode matrix ACME *accepts* | **GPL-2** (ACME itself) — but we consume it as an **interface specification**, not as code | ✅ **MNEMONIC AUTHORITY.** We must match ACME's accepted keywords for round-tripping; the keyword strings are an interface, and ACME is already an external non-npm project dependency for the `acme-build` skill. No code or table is copied. |
| **oxyron.de/html/opcodes02.html** | The classic 16×16 matrix with illegals *and cycle counts* | **No license statement** | ⚠️ Reference/verification only. Facts about hardware are not copyrightable; the page's *arrangement* is. Do not reproduce its layout. Fine to verify against. |
| **masswerk.at/6502/6502_instruction_set.html** and `/nowgobang/2021/6502-illegal-opcodes` | Prose reference plus illegal-opcode survey with the community mnemonic-alias landscape | **No license statement** (fetched and checked — no copyright notice, no terms of use). No machine-readable JSON exists (`6502_instruction_set.json` and `opcodes.json` both 404) | ⚠️ Reference only. Excellent for the alias map's *content*, not for copying. |
| **"NMOS 6510 Unintended Opcodes — No More Secrets"** (groepaz/hitmen, latest v0.99, 2024-12-24) | The definitive treatment of illegal-opcode semantics, including the de-capped analysis of the "unstable" ones | Marked *"all rights reversed"* — a joke, not an operative license grant | ⚠️ **Read it, cite it, do not copy from it.** Use it to get `unstable` classification and the `{H+1}` semantics right. |
| **VICE `src/6510core.c`, `src/monitor/mon_disassemble.c`, `src/monitor/asm6502.c`** | VICE's own tables and disassembler | **GPL-2.0-or-later** (verified: `vice/COPYING` is GPL v2; `asm6502.c` header reads *"either version 2 of the License, or (at your option) any later version"*) | 🚫 **DO NOT COPY. LICENSE-INCOMPATIBLE.** |

### GPL contamination: explicit finding

This repository is **MIT** (`LICENSE`: `MIT License / Copyright (c) 2026 Henrik
Olsson`; `.claude/mcp/vice/package.json:34` and `installer/package.json:20` both
declare `"license": "MIT"`), and both packages are published to the public npm
registry. Copying VICE's opcode tables, its mnemonic array, or its addressing-mode
dispatch structure into `@henols/vice-mcp` would create a GPL-2.0-or-later derivative
work distributed under an MIT declaration — a license violation and a
misrepresentation to every downstream consumer.

**What is safe:**
- *Reading* VICE source to understand behaviour and to build the divergence table in
  §2 (facts about which mnemonic VICE prints are not protected expression).
- Driving a running VICE process over its binary monitor (arm's-length use, no linking,
  no copying).

**What is not safe:**
- Transcribing `asm6502.c`'s mnemonic array, even reformatted.
- Reproducing `6510core.c`'s macro-per-opcode structure.

**Practical hygiene for the zlib-sourced table.** The zlib license requires that the
notice not be removed from source distributions and that altered versions be plainly
marked. Comply cheaply: put a header comment in `disasm-6510-table.ts` that (a)
attributes cc65 / Ullrich von Bassewitz and the oxyron table, (b) states this is a
*transcoded and modified* derivation (renamed fields, ACME mnemonic spellings, added
`unstable`/`jams`/`aliases`), and (c) reproduces the zlib notice. Add a
`docs/third-party-notices.md` entry. There is a defensible argument that
opcode→(mnemonic, mode, length) is uncopyrightable fact, so no attribution is strictly
required — but attribution costs three comment lines and removes all doubt.

### No free oracle from the binary monitor — confirmed

I checked `vice/src/monitor/monitor_binary.c` for a text-command passthrough opcode
that could give us VICE's `disass` output for free. **There is none.** The command
enum runs `MEM_GET 0x01` … `USERPORT_SET 0xb2`, `EXIT 0xaa`, `QUIT 0xbb`,
`RESET 0xcc`, `AUTOSTART 0xdd` — `0xaa` is `EXIT`, not "execute monitor command."
This independently reconfirms PROJECT.md's decision that the client must ship its
own disassembler, and it means the verification oracle has to be offline.

### Recommended verification strategy (test design)

1. **256-entry completeness assertion.** Every opcode `$00–$FF` decodes to a defined
   `OpcodeDesc` with `length ∈ {1,2,3}`. No holes, no throws. This one test is what
   every disqualified package fails.
2. **Three-way table agreement fixture.** A committed JSON fixture asserting
   `opcode → { mnemonic, mode, length }`, built from cc65 `opc6502x.c` and verified
   line-by-line against `fluffy-6502`'s `instructions`/`modes` arrays and ACME's
   `Illegals.txt` matrix. Record the ACME-spelling substitutions as explicit, commented
   exceptions rather than silent divergences.
3. **ACME round-trip test** — the highest-value test available, and free, because ACME
   is already a documented project dependency on `$PATH`. Disassemble a synthetic blob
   covering all opcodes, emit with `acmeReassemblable: true` under `!cpu 6510`,
   re-assemble, compare bytes. Byte-exact round-trip holds for the 151 documented
   opcodes and most illegals. **Expect and encode these exclusions:** `$EB` (no ACME
   mnemonic); `$2B` (ACME emits `anc` as `$0B`); the 11 non-canonical `JAM` opcodes
   (`$12 $22 $32 $42 $52 $62 $72 $92 $B2 $D2 $F2` — ACME only emits `$02`); and the
   non-canonical `dop`/`top` encodings which collapse to canonical opcodes. For those,
   assert mnemonic+mode against the fixture instead. Guard the whole test with an ACME
   presence check so CI without ACME skips rather than fails.
4. **Golden-file regression** on one real disassembly range so formatting changes are
   visible in diffs.

---

## 5. API shape for symbol substitution, annotation, and backtrace

### Design principle

**Separate decoding from formatting into two modules.** The decoder returns structured
records; the formatter turns a record into text and is the *only* place symbol
substitution and annotation happen. Every disqualified package above collapses these
two, which is precisely why none of them can support symbol substitution.

This also satisfies the milestone's other consumer: `backtrace` calls
`decodeInstruction` and reads `.length` / `.opcode.mnemonic` and never touches the
formatter at all.

### Concrete TypeScript

```ts
// disasm-6510-table.ts — the ONE authoritative 6510 opcode table.
// Transcoded from cc65 src/da65/opc6502x.c (zlib, (C) 2000-2011 Ullrich von
// Bassewitz), illegal opcodes originally from oxyron.de; mnemonics re-spelled to
// ACME's `!cpu 6510` keyword set so output round-trips through the acme-build
// skill. This is an altered version, plainly marked as such per the zlib license.
// Do NOT source any entry from VICE (GPL-2) -- see .planning/research/DISASSEMBLER.md §4.

/** The 13 NMOS 6510 addressing modes. `acc` is split from `imp` because ACME
 *  renders it as a bare mnemonic but its operand semantics differ, and `zpy`
 *  is called out because several published tables omit it entirely. */
export type AddressingMode =
  | "imp" | "acc" | "imm"
  | "zp"  | "zpx" | "zpy"
  | "izx" | "izy"
  | "abs" | "abx" | "aby"
  | "ind" | "rel";

export interface OpcodeDesc {
  readonly opcode: number;              // 0x00..0xff
  readonly mnemonic: string;            // lowercase, ACME `!cpu 6510` spelling
  readonly mode: AddressingMode;
  readonly length: 1 | 2 | 3;
  readonly illegal: boolean;            // not in the documented 151
  readonly unstable: boolean;           // ane/lxa/sha/shx/shy/tas -- magic-constant dependent
  readonly jams: boolean;               // the 12 JAM/KIL opcodes
  readonly acmeAssemblable: boolean;    // false for $eb and the non-canonical duplicates
  readonly aliases: readonly string[];  // ["alr"], ["axs","sax"], ["isb","ins"] -- for search + symbol-file import
  readonly cycles?: number;             // reserved, not populated in v1 (see §3)
  readonly pageCrossPenalty?: boolean;  // reserved
}

/** Dense 256-entry table. Indexing is total: OPCODES[b] is never undefined. */
export const OPCODES: readonly OpcodeDesc[];

/** Bytes of operand for a mode (0, 1, or 2). One seam, no inline switch duplication. */
export function operandBytes(mode: AddressingMode): 0 | 1 | 2;
```

```ts
// disasm-6510.ts — decoding only. No formatting, no symbols, no I/O.

/** What the operand *means*, so the symbol layer can decide whether a code
 *  label, a data label, or nothing at all is appropriate. Note that `ind`
 *  ($6c) is "pointer", never "jumpTarget" -- substituting a code label there
 *  would be wrong, and on NMOS the vector fetch wraps within its page. */
export type OperandRole =
  | "none"          // imp, acc
  | "immediate"     // imm -- a literal, never a symbol address
  | "memory"        // zp/zpx/zpy/abs/abx/aby/izx/izy -- data reference
  | "branchTarget"  // rel
  | "jumpTarget"    // jmp abs
  | "callTarget"    // jsr
  | "pointer";      // jmp (abs)

export type DisasmWarning =
  | "nmos-jmp-indirect-page-wrap"   // $6c with low operand byte $ff
  | "unstable-illegal-opcode"       // ane/lxa/sha/shx/shy/tas
  | "absolute-in-zeropage-range"    // abs operand < $0100: needs ACME `+2` force bit
  | "branch-wraps-address-space"    // rel target wrapped past $ffff / below $0000
  | "not-acme-assemblable";         // $eb, non-canonical jam/dop/top duplicates

export interface DecodedInstruction {
  readonly kind: "instruction";
  readonly address: number;                 // 0..0xffff
  readonly bytes: readonly number[];        // exactly `length` bytes, never sparse
  readonly length: 1 | 2 | 3;
  readonly opcode: OpcodeDesc;
  /** The literal as encoded: 8-bit for zp/imm/rel/izx/izy, 16-bit for abs/ind.
   *  Undefined for imp/acc. This is what was in memory, not a resolved target. */
  readonly operandValue?: number;
  /** Statically knowable target address, already wrapped to 16 bits: the branch
   *  target for `rel`, the absolute/zero-page address for abs/zp/ind. Deliberately
   *  UNDEFINED for all indexed and indirect-indexed modes and for `imm`, because
   *  those depend on runtime register values -- see DISASSEMBLER.md §3 trap 3. */
  readonly effectiveAddress?: number;
  readonly operandRole: OperandRole;
  readonly nextAddress: number;             // (address + length) & 0xffff
  readonly flowBreak: boolean;              // jmp, rts, rti, brk, jam
  readonly flowTargets: readonly number[];  // static successors, for backtrace / CFG
  readonly warnings: readonly DisasmWarning[];
}

/** A requested range ended mid-instruction. NEVER rendered as a complete
 *  instruction with placeholder digits -- see DISASSEMBLER.md §3 trap 4. */
export interface TruncatedInstruction {
  readonly kind: "truncated";
  readonly address: number;
  readonly bytes: readonly number[];   // the 1 or 2 bytes actually available
  readonly opcode: OpcodeDesc;
  readonly missingBytes: 1 | 2;
}

export type DisasmRow = DecodedInstruction | TruncatedInstruction;

export interface DecodeRangeOptions {
  /** Address the first byte of `bytes` lives at. */
  readonly startAddress: number;
  /** Stop after this many instructions. Omit to consume `bytes`. */
  readonly maxInstructions?: number;
  /** Stop after the first flowBreak instruction. Default false. */
  readonly stopAtFlowBreak?: boolean;
}

export function decodeInstruction(
  bytes: Uint8Array | readonly number[],
  offset: number,
  address: number,
): DisasmRow;

export function decodeRange(
  bytes: Uint8Array | readonly number[],
  options: DecodeRangeOptions,
): readonly DisasmRow[];
```

```ts
// disasm-format.ts -- the ONE place symbols and annotations are layered on.

/** Called for every operand that has a resolvable address. Returns a symbol name
 *  or undefined to fall back to hex. NEVER throws -- a resolver miss is normal.
 *  `role` lets the symbol store distinguish a code label from a data label;
 *  `width` (1 = zero-page byte, 2 = 16-bit word) lets it refuse to substitute a
 *  16-bit symbol into a zero-page slot, which would change the encoding. */
export type SymbolResolver = (
  address: number,
  role: OperandRole,
  width: 1 | 2,
) => string | undefined;

/** Called once per decoded instruction. This is the hook the c64-memory-mapping
 *  skill layers on: it receives the whole record, so it can key on
 *  `effectiveAddress` AND `operandRole` (annotate "$d020 = border colour" only when
 *  the role is "memory", not when $d020 happens to be a branch target). Returns
 *  trailing comment text without the comment marker, or undefined for no comment. */
export type Annotator = (row: DecodedInstruction) => string | undefined;

export interface FormatOptions {
  readonly resolveSymbol?: SymbolResolver;
  readonly annotate?: Annotator;
  /** Prefix each line with `addr: hh hh hh  `. Default true. */
  readonly showBytes?: boolean;
  /** Uppercase mnemonics. Default false (ACME house style is lowercase). */
  readonly uppercase?: boolean;
  /** Emit ACME `+2` force bits for absolute-in-zero-page-range, `dop`/`top` for
   *  the NOP variants, and `!byte` for non-assemblable opcodes. Default false. */
  readonly acmeReassemblable?: boolean;
  /** How to render the 105 illegal opcodes. Default "mnemonic" -- "byte" loses
   *  instruction length, which backtrace depends on. */
  readonly illegalStyle?: "mnemonic" | "byte";
  /** Comment marker. Default ";" (ACME). */
  readonly commentMarker?: string;
}

export function formatRow(row: DisasmRow, options?: FormatOptions): string;
export function formatRows(rows: readonly DisasmRow[], options?: FormatOptions): string;
```

### Why this shape works for each consumer

| Consumer | What it uses |
|---|---|
| `vice_disassemble` tool | `decodeRange` + `formatRows` with both hooks wired |
| `symbols lookup` substitution | `resolveSymbol(address, role, width)` — role prevents labelling immediates and `jmp ()` pointers; width prevents encoding-changing substitutions; `undefined` return falls back to hex with no throw |
| `c64-memory-mapping` skill | `annotate(row)` gets `effectiveAddress` + `operandRole` + `opcode`, enough to emit `; $d020 border colour` only where it makes sense |
| `backtrace` (stack-page walk) | `decodeInstruction(...).length` and `.opcode.mnemonic === "jsr"` to validate that the byte(s) below a candidate return address are a real 3-byte `JSR` — never touches the formatter |
| CPU-history tracing (stock-only gain) | `decodeInstruction` per history entry; the same table, no second implementation |
| Future MCP structured output | Return `DisasmRow[]` as JSON directly — Claude gets machine-readable fields instead of having to parse text |

### Module placement (per `CONVENTIONS.md` and `CONCERNS.md`)

Create **three new sibling modules** in `.claude/mcp/vice/`:
`disasm-6510-table.ts`, `disasm-6510.ts`, `disasm-format.ts`, plus co-located
`disasm-6510.test.ts` / `disasm-format.test.ts`.

- **Do not append to `vice-proxy.ts`** — it is already 3,093 lines and the concerns
  audit explicitly warns that group-B client-side derivations belong in sibling
  modules.
- Use `.ts`, **not** `.mts`. These run container-side under Node's type-stripping and
  are **not** in `tsconfig.build.json`'s `include` list, so they must not enter the
  `resources/*.mjs` build set (which would trip `resources-sync.test.ts`).
- Named exports only; no default export; no barrel/`index.ts`.
- Relative imports with explicit `.ts` extensions.
- Long decision-record header comments with `D-N` labels, per house style. In
  particular the table module's header should carry the zlib attribution, the
  "never source from VICE (GPL-2)" prohibition, and a pointer to this research file.
- Dependency injection for testability: `formatRow` takes its hooks as options
  defaulting to no-ops — no mocking library needed, matching the `repoRoot({ from, env })`
  idiom.

---

## 6. Phase-plan implications

**Suggested requirement wording:**
> The MCP server ships its own 6510 disassembler covering all 256 opcodes including
> the undocumented set, returning structured records (address, bytes, length,
> mnemonic, addressing mode, operand, resolved target, flow flags) that symbol
> substitution and memory-map annotation layer onto, with zero new npm dependencies.

**Ordering:** the disassembler is a pure function with no protocol dependency. It can
be built and fully tested **before or in parallel with** the binary-monitor client —
it needs no emulator. It is a good early phase (de-risks the largest group-B
reimplementation with zero protocol coupling) and it **blocks** `backtrace` and
CPU-history tracing, both of which need instruction lengths from the same table.

**Research flag:** LOW. The remaining unknowns are the four ACME round-trip
exclusions listed in §4 (verifiable in minutes with a local ACME run) and the
`$EB` rendering policy. No further ecosystem research needed.

**Explicit non-goals to record in the phase plan:**
- No cycle counts in v1 (field reserved).
- No heuristic resynchronisation from a mid-instruction start address.
- No byte-identical parity with VICE's `disass` (already Out of Scope in PROJECT.md;
  the §2 divergence table documents exactly where and why it differs).

---

## Sources

**HIGH confidence (live registry / source read directly):**
- npm registry `registry.npmjs.org` package documents and `api.npmjs.org` download
  points for all seven candidates, queried 2026-08-12; tarballs downloaded, extracted,
  and (for `6502-reasm`) executed.
- `https://raw.githubusercontent.com/cc65/cc65/master/LICENSE` — zlib.
- `https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opc6502x.c` — 308 lines,
  256-entry table, header attributing oxyron.de.
- `https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opcdesc.h` — `OpcDesc`
  fields and `flAbsOverride`; confirms no cycle-count field.
- `https://raw.githubusercontent.com/VICE-Team/svn-mirror/main/vice/COPYING` — GPL v2.
- `https://raw.githubusercontent.com/VICE-Team/svn-mirror/main/vice/src/monitor/asm6502.c`
  — GPL-2-or-later header; VICE's mnemonic set.
- `https://raw.githubusercontent.com/VICE-Team/svn-mirror/main/vice/src/monitor/monitor_binary.c`
  — command enum; confirms no text-command passthrough opcode.
- `https://raw.githubusercontent.com/meonwax/acme/master/docs/Illegals.txt` — ACME's
  illegal-opcode matrix and aliases.
- `https://raw.githubusercontent.com/meonwax/acme/master/src/mnemo.c` — ACME's actual
  accepted keywords (`asr` not `alr`, `sbx` not `axs`, `lxa` not `lax` at `$AB`,
  `dop`/`top`, `jam`).
- `https://raw.githubusercontent.com/meonwax/acme/master/docs/AddrModes.txt` — `+1`/`+2`/`+3`
  force-bit postfix syntax.
- `/home/henrik/dev/henrik/git/c64-re-tools/LICENSE` — MIT.

**MEDIUM confidence:**
- `https://www.masswerk.at/6502/6502_instruction_set.html` and
  `https://www.masswerk.at/nowgobang/2021/6502-illegal-opcodes` — fetched; no license
  statement present; no machine-readable JSON (probed 404).
- `http://www.oxyron.de/html/opcodes02.html` — cited by cc65's own header as its
  illegal-opcode source; no license statement.

**"No More Secrets" (reference only, "all rights reversed"):**
- v0.99 (2024-12-24): `https://zxe.io/depot/documents/technical/NMOS 6510 Unintended Opcodes - No More Secrets v0.99 (2024-12-24)(groepaz)(en)[!].pdf`
- v0.91: `https://hitmen.c02.at/files/docs/c64/NoMoreSecrets-NMOS6510UnintendedOpcodes-20162412.pdf`
