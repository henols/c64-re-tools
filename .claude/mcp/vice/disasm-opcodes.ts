// disasm-opcodes.ts
//
// The committed 256-entry 6502/6510 opcode table -- one entry per opcode
// byte, indexed by that byte (`OPCODES[0xa9]` is `lda #`). Pure data, zero
// imports, zero I/O, no build step: this is a container-side `.ts` run
// directly under Node's native type-stripping (see this package's
// README/CLAUDE.md), not a host-bound `.mts` -- `build.ts` and
// `resources-sync.test.ts` do not apply to it.
//
// ---------------------------------------------------------------------------
// Attribution / provenance (D-07, criterion 5)
// ---------------------------------------------------------------------------
// Transcribed by hand from cc65's `src/da65/opc6502x.c`, fetched raw
// (`curl -s https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opc6502x.c`)
// against `master` @ commit `547d923588d870aacf0b0016c67d0f6a92a70f83`
// (2026-07-11); the table itself was last touched at commit
// `02e79d35d73efd31522b5eab986d1919e3560bba` (2025-06-19, "making da65
// produce the same mnemonics as ca65 uses"). cc65 is zlib-licensed
// (`(C) 2003-2011, Ullrich von Bassewitz` -- see the header of the source
// file itself for the full zlib licence text: free use, alteration and
// redistribution permitted, with the origin-must-not-be-misrepresented and
// altered-versions-must-be-marked obligations). This transcription satisfies
// those obligations via this comment.
//
// Cross-checked, reference-only (no code taken from either), against
// masswerk.at's 6502 instruction-set reference and
// www.oxyron.de/html/opcodes02.html for the illegal-opcode addressing modes,
// lengths and alternate mnemonics.
//
// Nothing in this file is sourced from VICE (its licence is GPL-2, incompatible with this MIT repo). No
// opcode fact, comment or naming choice here traces to any `vice/src` file,
// `monitor.c`, `mon_*.c`, or any other VICE source.
//
// `fluffy-6502`, named in ROADMAP.md and carried into
// `04-CONTEXT.md` D-06 as an MIT cross-check source, could not be located
// under that name on GitHub or the general web (04-RESEARCH.md Assumptions
// Log A1, Common Pitfalls Pitfall 5). It is recorded here as an
// **unavailable** source, not cited as one. D-06's bit-pattern derivation
// test (`disasm-opcodes.test.ts`) and 04-06's byte-exact real-ACME
// round-trip carry the entire independent cross-check burden instead.
//
// ---------------------------------------------------------------------------
// Mnemonic naming: two deliberate departures from cc65's own spelling
// ---------------------------------------------------------------------------
// cc65 spells two illegal opcodes differently from ACME's verified
// `!cpu 6510` mnemonic set (`.claude/skills/acme-build/SKILL.md`: `lax dcp
// sax slo rla sre rra isc anc alr arr sbx las tas sha shx shy jam`). This
// table follows ACME's names, not cc65's, at exactly these two opcodes, so
// that `acmeExpressible` below can be computed by simple set membership
// against that verified list:
//   - `$AB` -- cc65 calls this "lax" (an immediate-mode ANE/ATX/LXA/OAL
//     family member). Renamed here to "lxa" so it is never confused with the
//     genuine indexed-addressing LAX family (`$A3/$A7/$AF/$B3/$B7/$BF`),
//     which ACME DOES accept as "lax". 04-06's real-ACME round-trip found
//     that ACME 0.97 ("Zem") ALSO accepts "lxa" (with a documented "unstable
//     LXA #NONZERO" warning, not an error) and reproduces exactly `$AB` --
//     this entry's `acmeExpressible` is `true`, corrected from an earlier,
//     untested `false` seed.
//   - `$CB` -- cc65 calls this "axs". Renamed here to "sbx" (SBX/AXS/SAX2
//     are all names for the same opcode; masswerk.at and oxyron.de both use
//     "SBX"), matching ACME's verified list. `acmeExpressible` is `true`.
// No other mnemonic in this table differs from cc65's spelling.
//
// ---------------------------------------------------------------------------
// `acmeExpressible` corrections made by 04-06's real-ACME round-trip
// ---------------------------------------------------------------------------
// D-09 says the seed above is not the authority -- `disasm-roundtrip.test.ts`
// asserting against a real installed ACME 0.97 ("Zem") is. Two duplicate
// (mnemonic, addressing-mode) groups exist among the illegal opcodes, where
// ACME's assembler resolves the bare mnemonic to exactly ONE canonical
// opcode byte regardless of which of the several opcodes sharing that
// mnemonic+mode a decoder produced it from -- so only that one canonical
// member can be `true`; every other member of the group is unfaithful
// (ACME accepts the syntax but silently emits the WRONG opcode byte) and
// must be `false`:
//   - `jam` (implicit, no operand -- 12 opcodes: $02 $12 $22 $32 $42 $52 $62
//     $72 $92 $B2 $D2 $F2): ACME always assembles bare `jam` to `$02`.
//     Corrected: only `$02` is `true`; the other 11 are `false`.
//   - `anc` (immediate -- $0B and $2B): ACME always assembles `anc #imm` to
//     `$0B`. Corrected: `$0B` stays `true`; `$2B` is now `false`.
// A third group -- the illegal `nop` family, which spans FIVE duplicate
// (mode) subgroups (immediate: $80/$82/$89/$C2/$E2; zeropage: $04/$44/$64;
// zeropage,X: $14/$34/$54/$74/$D4/$F4; absolute,X: $1C/$3C/$5C/$7C/$DC/$FC;
// implied: $1A/$3A/$5A/$7A/$DA/$FA) -- was already ALL-`false` in the
// original seed, but for four of those five subgroups that was
// over-conservative: ACME's bare `nop <operand>` DOES faithfully reproduce
// the group's lowest-numbered member. Corrected: `$04`, `$14`, `$1C`, `$80`
// (each the lowest opcode in its subgroup) are now `true`; every other
// member of those same four subgroups stays `false`. The implied subgroup
// ($1A/$3A/.../$FA) stays entirely `false` for a different reason: ACME's
// bare `nop` mnemonic with NO operand always resolves to the pre-existing
// LEGAL opcode `$EA`, never to any illegal implied-mode member, so none of
// them can ever be faithfully expressed via the plain "nop" mnemonic.
// `nop` absolute ($0C) has no duplicate partner at all (it is the only
// illegal absolute-mode nop) and was ALSO corrected from `false` to `true`
// -- it was unconditionally byte-faithful and unambiguous; the original
// `false` was simply an untested, over-conservative seed value, not a
// disagreement about ambiguity.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// This is the one table the decoder (04-03), Phase 5's backtrace (DERIV-02)
// and Phase 6's CPU-history decode (GAIN-01) all read instruction lengths
// from. A wrong length here silently desynchronises every instruction after
// it in every one of those consumers (criterion 2's own wording) -- there is
// no runtime check downstream that would catch a transcription typo on its
// own; that is what `disasm-opcodes.test.ts`'s independent bit-pattern
// derivation is for.
//
// ---------------------------------------------------------------------------
// Correction carried from ROADMAP.md / 04-CONTEXT.md D-09
// ---------------------------------------------------------------------------
// ROADMAP.md criterion 2 and 04-CONTEXT.md D-09 both say "twelve NOP
// variants." That figure does not match any standard 6502/6510 opcode
// enumeration. The real illegal-NOP class is **27 opcodes across 6
// addressing-mode groups** (verified against cc65's live source, masswerk.at
// and oxyron.de this session):
//   implied/1-byte:     1A 3A 5A 7A DA FA          (6)
//   immediate/2-byte:   80 82 89 C2 E2             (5)
//   zeropage/2-byte:    04 44 64                   (3)
//   zeropage,X/2-byte:  14 34 54 74 D4 F4          (6)
//   absolute/3-byte:    0C                         (1)
//   absolute,X/3-byte:  1C 3C 5C 7C DC FC          (6)
// `disasm-opcodes.test.ts` asserts this corrected 27/6-group enumeration
// exhaustively, not a hardcoded "twelve".
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never add an `import` to this file. It is pure data (D-05, DISASM-07)
//     -- `disasm-opcodes.test.ts` asserts zero import statements on the
//     comment-stripped source.
//   - Never source an opcode fact from VICE.
//   - Never edit `acmeExpressible` by hand to make 04-06's real-ACME
//     assertion test pass. That test is the authority; a disagreement means
//     the seed below was wrong, not the test.
//   - Never re-derive a second opcode table anywhere else in this tree.

/**
 * The 13 6502/6510 addressing modes this table distinguishes. `indirect`
 * covers only `JMP ($xxxx)` ($6C) -- there is no other indirect-without-
 * index addressing mode on this CPU.
 */
export type AddressingMode =
  | "implicit"
  | "accumulator"
  | "immediate"
  | "zeropage"
  | "zeropage_x"
  | "zeropage_y"
  | "absolute"
  | "absolute_x"
  | "absolute_y"
  | "indirect"
  | "indirect_x"
  | "indirect_y"
  | "relative";

/**
 * The canonical instruction length, in bytes, for each addressing mode.
 * Every `OpcodeEntry.length` below must equal `LENGTH_FOR_MODE[entry.mode]`
 * -- `disasm-opcodes.test.ts`'s shape suite asserts this for all 256
 * entries.
 */
export const LENGTH_FOR_MODE: Readonly<Record<AddressingMode, 1 | 2 | 3>> = {
  implicit: 1,
  accumulator: 1,
  immediate: 2,
  zeropage: 2,
  zeropage_x: 2,
  zeropage_y: 2,
  indirect_x: 2,
  indirect_y: 2,
  relative: 2,
  absolute: 3,
  absolute_x: 3,
  absolute_y: 3,
  indirect: 3,
};

/** One 6502/6510 opcode's decode facts. */
export interface OpcodeEntry {
  /** Lowercase three-letter canonical 6502/6510 mnemonic (ACME source is
   * lowercase, and the renderer (04-04) emits this verbatim). */
  mnemonic: string;
  mode: AddressingMode;
  length: 1 | 2 | 3;
  /** `true` for every opcode outside the documented NMOS 6502 set. */
  illegal: boolean;
  /**
   * Whether ACME's `!cpu 6510` accepts `mnemonic` in this addressing mode.
   * This field is a SEED, not an authority: 04-06's substitution-membership
   * assertion test against a real installed ACME is the authority for every
   * value here (D-09 -- "the exact set is determined by the assertion test
   * against the installed ACME, not by this list"). 04-06 corrects any
   * entry ACME disagrees with; never hand-edit this field to force that
   * test to pass.
   */
  acmeExpressible: boolean;
}

/**
 * All 256 6502/6510 opcodes, indexed by opcode byte -- `OPCODES[0xa9]` is
 * `lda #`. No sparse holes, no `undefined`.
 */
export const OPCODES: readonly OpcodeEntry[] = [
  { mnemonic: "brk", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $00
  { mnemonic: "ora", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $01
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: true }, // $02
  { mnemonic: "slo", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $03
  { mnemonic: "nop", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $04 (04-06: canonical zeropage nop, ACME's "nop $xx" always yields this byte)
  { mnemonic: "ora", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $05
  { mnemonic: "asl", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $06
  { mnemonic: "slo", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $07
  { mnemonic: "php", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $08
  { mnemonic: "ora", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $09
  { mnemonic: "asl", mode: "accumulator", length: 1, illegal: false, acmeExpressible: true }, // $0a
  { mnemonic: "anc", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $0b
  { mnemonic: "nop", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $0c (04-06: unique, unambiguous, ACME reproduces exactly)
  { mnemonic: "ora", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $0d
  { mnemonic: "asl", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $0e
  { mnemonic: "slo", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $0f
  { mnemonic: "bpl", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $10
  { mnemonic: "ora", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $11
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $12 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "slo", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $13
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $14 (04-06: canonical zeropage,x nop)
  { mnemonic: "ora", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $15
  { mnemonic: "asl", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $16
  { mnemonic: "slo", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $17
  { mnemonic: "clc", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $18
  { mnemonic: "ora", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $19
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $1a
  { mnemonic: "slo", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $1b
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $1c (04-06: canonical absolute,x nop)
  { mnemonic: "ora", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $1d
  { mnemonic: "asl", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $1e
  { mnemonic: "slo", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $1f
  { mnemonic: "jsr", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $20
  { mnemonic: "and", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $21
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $22 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "rla", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $23
  { mnemonic: "bit", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $24
  { mnemonic: "and", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $25
  { mnemonic: "rol", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $26
  { mnemonic: "rla", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $27
  { mnemonic: "plp", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $28
  { mnemonic: "and", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $29
  { mnemonic: "rol", mode: "accumulator", length: 1, illegal: false, acmeExpressible: true }, // $2a
  { mnemonic: "anc", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $2b (04-06: "anc #imm" always assembles to $0b, not this byte)
  { mnemonic: "bit", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $2c
  { mnemonic: "and", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $2d
  { mnemonic: "rol", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $2e
  { mnemonic: "rla", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $2f
  { mnemonic: "bmi", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $30
  { mnemonic: "and", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $31
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $32 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "rla", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $33
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: false }, // $34
  { mnemonic: "and", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $35
  { mnemonic: "rol", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $36
  { mnemonic: "rla", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $37
  { mnemonic: "sec", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $38
  { mnemonic: "and", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $39
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $3a
  { mnemonic: "rla", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $3b
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: false }, // $3c
  { mnemonic: "and", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $3d
  { mnemonic: "rol", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $3e
  { mnemonic: "rla", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $3f
  { mnemonic: "rti", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $40
  { mnemonic: "eor", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $41
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $42 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "sre", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $43
  { mnemonic: "nop", mode: "zeropage", length: 2, illegal: true, acmeExpressible: false }, // $44
  { mnemonic: "eor", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $45
  { mnemonic: "lsr", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $46
  { mnemonic: "sre", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $47
  { mnemonic: "pha", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $48
  { mnemonic: "eor", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $49
  { mnemonic: "lsr", mode: "accumulator", length: 1, illegal: false, acmeExpressible: true }, // $4a
  { mnemonic: "alr", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $4b
  { mnemonic: "jmp", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $4c
  { mnemonic: "eor", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $4d
  { mnemonic: "lsr", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $4e
  { mnemonic: "sre", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $4f
  { mnemonic: "bvc", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $50
  { mnemonic: "eor", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $51
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $52 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "sre", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $53
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: false }, // $54
  { mnemonic: "eor", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $55
  { mnemonic: "lsr", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $56
  { mnemonic: "sre", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $57
  { mnemonic: "cli", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $58
  { mnemonic: "eor", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $59
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $5a
  { mnemonic: "sre", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $5b
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: false }, // $5c
  { mnemonic: "eor", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $5d
  { mnemonic: "lsr", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $5e
  { mnemonic: "sre", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $5f
  { mnemonic: "rts", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $60
  { mnemonic: "adc", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $61
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $62 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "rra", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $63
  { mnemonic: "nop", mode: "zeropage", length: 2, illegal: true, acmeExpressible: false }, // $64
  { mnemonic: "adc", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $65
  { mnemonic: "ror", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $66
  { mnemonic: "rra", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $67
  { mnemonic: "pla", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $68
  { mnemonic: "adc", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $69
  { mnemonic: "ror", mode: "accumulator", length: 1, illegal: false, acmeExpressible: true }, // $6a
  { mnemonic: "arr", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $6b
  { mnemonic: "jmp", mode: "indirect", length: 3, illegal: false, acmeExpressible: true }, // $6c
  { mnemonic: "adc", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $6d
  { mnemonic: "ror", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $6e
  { mnemonic: "rra", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $6f
  { mnemonic: "bvs", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $70
  { mnemonic: "adc", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $71
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $72 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "rra", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $73
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: false }, // $74
  { mnemonic: "adc", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $75
  { mnemonic: "ror", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $76
  { mnemonic: "rra", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $77
  { mnemonic: "sei", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $78
  { mnemonic: "adc", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $79
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $7a
  { mnemonic: "rra", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $7b
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: false }, // $7c
  { mnemonic: "adc", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $7d
  { mnemonic: "ror", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $7e
  { mnemonic: "rra", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $7f
  { mnemonic: "nop", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $80 (04-06: canonical immediate nop)
  { mnemonic: "sta", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $81
  { mnemonic: "nop", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $82
  { mnemonic: "sax", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $83
  { mnemonic: "sty", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $84
  { mnemonic: "sta", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $85
  { mnemonic: "stx", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $86
  { mnemonic: "sax", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $87
  { mnemonic: "dey", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $88
  { mnemonic: "nop", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $89
  { mnemonic: "txa", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $8a
  { mnemonic: "ane", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $8b (04-06: ACME accepts "ane #imm" with a documented "unstable" warning, not an error, and reproduces $8b exactly)
  { mnemonic: "sty", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $8c
  { mnemonic: "sta", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $8d
  { mnemonic: "stx", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $8e
  { mnemonic: "sax", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $8f
  { mnemonic: "bcc", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $90
  { mnemonic: "sta", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $91
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $92 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "sha", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $93
  { mnemonic: "sty", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $94
  { mnemonic: "sta", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $95
  { mnemonic: "stx", mode: "zeropage_y", length: 2, illegal: false, acmeExpressible: true }, // $96
  { mnemonic: "sax", mode: "zeropage_y", length: 2, illegal: true, acmeExpressible: true }, // $97
  { mnemonic: "tya", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $98
  { mnemonic: "sta", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $99
  { mnemonic: "txs", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $9a
  { mnemonic: "tas", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $9b
  { mnemonic: "shy", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $9c
  { mnemonic: "sta", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $9d
  { mnemonic: "shx", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $9e
  { mnemonic: "sha", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $9f
  { mnemonic: "ldy", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $a0
  { mnemonic: "lda", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $a1
  { mnemonic: "ldx", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $a2
  { mnemonic: "lax", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $a3
  { mnemonic: "ldy", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $a4
  { mnemonic: "lda", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $a5
  { mnemonic: "ldx", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $a6
  { mnemonic: "lax", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $a7
  { mnemonic: "tay", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $a8
  { mnemonic: "lda", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $a9
  { mnemonic: "tax", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $aa
  { mnemonic: "lxa", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $ab (04-06: ACME accepts "lxa #imm" with a documented "unstable" warning, not an error, and reproduces $ab exactly)
  { mnemonic: "ldy", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ac
  { mnemonic: "lda", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ad
  { mnemonic: "ldx", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ae
  { mnemonic: "lax", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $af
  { mnemonic: "bcs", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $b0
  { mnemonic: "lda", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $b1
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $b2 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "lax", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $b3
  { mnemonic: "ldy", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $b4
  { mnemonic: "lda", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $b5
  { mnemonic: "ldx", mode: "zeropage_y", length: 2, illegal: false, acmeExpressible: true }, // $b6
  { mnemonic: "lax", mode: "zeropage_y", length: 2, illegal: true, acmeExpressible: true }, // $b7
  { mnemonic: "clv", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $b8
  { mnemonic: "lda", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $b9
  { mnemonic: "tsx", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $ba
  { mnemonic: "las", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $bb
  { mnemonic: "ldy", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $bc
  { mnemonic: "lda", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $bd
  { mnemonic: "ldx", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $be
  { mnemonic: "lax", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $bf
  { mnemonic: "cpy", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $c0
  { mnemonic: "cmp", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $c1
  { mnemonic: "nop", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $c2
  { mnemonic: "dcp", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $c3
  { mnemonic: "cpy", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $c4
  { mnemonic: "cmp", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $c5
  { mnemonic: "dec", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $c6
  { mnemonic: "dcp", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $c7
  { mnemonic: "iny", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $c8
  { mnemonic: "cmp", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $c9
  { mnemonic: "dex", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $ca
  { mnemonic: "sbx", mode: "immediate", length: 2, illegal: true, acmeExpressible: true }, // $cb
  { mnemonic: "cpy", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $cc
  { mnemonic: "cmp", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $cd
  { mnemonic: "dec", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ce
  { mnemonic: "dcp", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $cf
  { mnemonic: "bne", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $d0
  { mnemonic: "cmp", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $d1
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $d2 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "dcp", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $d3
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: false }, // $d4
  { mnemonic: "cmp", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $d5
  { mnemonic: "dec", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $d6
  { mnemonic: "dcp", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $d7
  { mnemonic: "cld", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $d8
  { mnemonic: "cmp", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $d9
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $da
  { mnemonic: "dcp", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $db
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: false }, // $dc
  { mnemonic: "cmp", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $dd
  { mnemonic: "dec", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $de
  { mnemonic: "dcp", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $df
  { mnemonic: "cpx", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $e0
  { mnemonic: "sbc", mode: "indirect_x", length: 2, illegal: false, acmeExpressible: true }, // $e1
  { mnemonic: "nop", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $e2
  { mnemonic: "isc", mode: "indirect_x", length: 2, illegal: true, acmeExpressible: true }, // $e3
  { mnemonic: "cpx", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $e4
  { mnemonic: "sbc", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $e5
  { mnemonic: "inc", mode: "zeropage", length: 2, illegal: false, acmeExpressible: true }, // $e6
  { mnemonic: "isc", mode: "zeropage", length: 2, illegal: true, acmeExpressible: true }, // $e7
  { mnemonic: "inx", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $e8
  { mnemonic: "sbc", mode: "immediate", length: 2, illegal: false, acmeExpressible: true }, // $e9
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $ea
  { mnemonic: "sbc", mode: "immediate", length: 2, illegal: true, acmeExpressible: false }, // $eb
  { mnemonic: "cpx", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ec
  { mnemonic: "sbc", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ed
  { mnemonic: "inc", mode: "absolute", length: 3, illegal: false, acmeExpressible: true }, // $ee
  { mnemonic: "isc", mode: "absolute", length: 3, illegal: true, acmeExpressible: true }, // $ef
  { mnemonic: "beq", mode: "relative", length: 2, illegal: false, acmeExpressible: true }, // $f0
  { mnemonic: "sbc", mode: "indirect_y", length: 2, illegal: false, acmeExpressible: true }, // $f1
  { mnemonic: "jam", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $f2 (04-06: bare "jam" always assembles to $02, not this byte)
  { mnemonic: "isc", mode: "indirect_y", length: 2, illegal: true, acmeExpressible: true }, // $f3
  { mnemonic: "nop", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: false }, // $f4
  { mnemonic: "sbc", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $f5
  { mnemonic: "inc", mode: "zeropage_x", length: 2, illegal: false, acmeExpressible: true }, // $f6
  { mnemonic: "isc", mode: "zeropage_x", length: 2, illegal: true, acmeExpressible: true }, // $f7
  { mnemonic: "sed", mode: "implicit", length: 1, illegal: false, acmeExpressible: true }, // $f8
  { mnemonic: "sbc", mode: "absolute_y", length: 3, illegal: false, acmeExpressible: true }, // $f9
  { mnemonic: "nop", mode: "implicit", length: 1, illegal: true, acmeExpressible: false }, // $fa
  { mnemonic: "isc", mode: "absolute_y", length: 3, illegal: true, acmeExpressible: true }, // $fb
  { mnemonic: "nop", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: false }, // $fc
  { mnemonic: "sbc", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $fd
  { mnemonic: "inc", mode: "absolute_x", length: 3, illegal: false, acmeExpressible: true }, // $fe
  { mnemonic: "isc", mode: "absolute_x", length: 3, illegal: true, acmeExpressible: true }, // $ff
];
