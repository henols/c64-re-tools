#!/usr/bin/env node
// r2000-acme-ident.ts -- the ONE authoritative place in this repo for the
// ACME identifier policy (T-11-ENUM-NAME / T-11-NAME-INJECT): what makes a
// string a legal ACME symbol/label name, and the single check function that
// decides it.
//
// WHY THIS MODULE EXISTS: this policy started life inside r2000-enum-gen.ts,
// consumed only by its own `createOrUpdateEnum()`/`sanitizeVariantMap()`.
// T-11-NAME-INJECT widened the finding to a SECOND entry route --
// `r2000_set_label_name` (both outer and batch-inner) in r2000-tools.ts, and
// `importLabels()` in r2000-symbols.ts -- and `r2000-enum-gen.ts` statically
// imports `runR2000Tool` FROM `r2000-tools.ts`, so `r2000-tools.ts` cannot
// import the policy back from `r2000-enum-gen.ts` without forming a module
// cycle. This module has no import from anywhere else in this repo, so
// every one of those consumers (and any future one) can import it directly.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: `MAX_ACME_IDENTIFIER_LENGTH`,
// `ACME_IDENT_RE`, `ACME_RESERVED_MNEMONICS` and `assertLegalAcmeIdentifier()`
// -- the complete, only definition of "legal ACME identifier" in this repo.
// `r2000-enum-gen.ts` re-exports `assertLegalAcmeIdentifier` /
// `MAX_ACME_IDENTIFIER_LENGTH` from here so its own existing consumers and
// tests keep their current import path; it does not hold a second copy.
//
// WHAT NOT TO DO, named concretely:
//   - Never add a second identifier regex anywhere in this repo. The
//     `r2000-regbits-gen.ts` / `r2000-regbits.test.ts` copies of
//     `ACME_IDENT_RE` predate this module and are out of this plan's scope
//     (260821-a86) to consolidate -- but no NEW copy should be added; import
//     this module's `assertLegalAcmeIdentifier()` instead.
//   - Never sanitize, quote, or auto-correct an illegal identifier here or
//     in any caller. This function's contract is REJECT, per
//     T-11-REGBITS-PROSE and T-11-ENUM-NAME precedent: a malformed name is a
//     bug to surface, never silently rewritten into something else -- the
//     caller-visible name must never diverge from what actually gets
//     exported into ACME source.
//   - Never import anything from this repo into this module. It must stay
//     importable by both `r2000-tools.ts` and `r2000-enum-gen.ts` (which
//     imports `runR2000Tool` FROM `r2000-tools.ts`) without a cycle.
export const MAX_ACME_IDENTIFIER_LENGTH = 200;

const ACME_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The 6502/6510 instruction mnemonics -- the ONLY category of reserved word
 * actually measured to collide with a bare identifier in real ACME 0.97.
 * Verified live on this host: `LDA = $05` is REJECTED ("No value given." /
 * "Garbage data at end of statement" -- ACME parses `LDA` positionally as
 * the opcode, not as an assignable symbol), while `A = $05` is ACCEPTED
 * (register-letter shorthand is not reserved as a bare symbol name). This
 * list is therefore a measured, not a guessed, reservation.
 */
const ACME_RESERVED_MNEMONICS: ReadonlySet<string> = new Set([
  "ADC", "AND", "ASL", "BCC", "BCS", "BEQ", "BIT", "BMI", "BNE", "BPL", "BRK", "BVC",
  "BVS", "CLC", "CLD", "CLI", "CLV", "CMP", "CPX", "CPY", "DEC", "DEX", "DEY", "EOR",
  "INC", "INX", "INY", "JMP", "JSR", "LDA", "LDX", "LDY", "LSR", "NOP", "ORA", "PHA",
  "PHP", "PLA", "PLP", "ROL", "ROR", "RTI", "RTS", "SBC", "SEC", "SED", "SEI", "STA",
  "STX", "STY", "TAX", "TAY", "TSX", "TXA", "TXS", "TYA",
]);

/**
 * Refuses `id` (naming it as `what` in the thrown message) unless it is a
 * legal ACME identifier: matches `^[A-Za-z_][A-Za-z0-9_]*$`, is no longer
 * than `MAX_ACME_IDENTIFIER_LENGTH`, and does not collide (case-
 * insensitively) with a reserved 6502/6510 mnemonic (see
 * `ACME_RESERVED_MNEMONICS`'s own header comment for how that specific list
 * was measured, not assumed).
 *
 * T-11-ENUM-NAME (the highest-value threat in this phase): regenerator2000
 * validates only the ENUM name server-side
 * (`app_state.rs:443`, `validate_new_enum_name`) and performs ZERO
 * validation on variant names -- they flow straight into
 * `format!("{}_{}", enum_name, variant)` at export time
 * (`formatter_acme.rs:367-369`). This function is called on BOTH the enum
 * name and every variant name, and is called BEFORE any
 * `r2000_create_project_enum`/`r2000_update_project_enum` call reaches
 * `runR2000Tool()` -- proven zero-spawn in `r2000-enum-gen.test.ts`.
 */
export function assertLegalAcmeIdentifier(id: string, what: string): void {
  if (id.length === 0) {
    throw new Error(`${what}: identifier must not be empty`);
  }
  if (id.length > MAX_ACME_IDENTIFIER_LENGTH) {
    throw new Error(
      `${what}: identifier "${id.slice(0, 40)}..." is ${id.length} characters, exceeding the ` +
        `${MAX_ACME_IDENTIFIER_LENGTH}-character ceiling`,
    );
  }
  if (!ACME_IDENT_RE.test(id)) {
    throw new Error(`${what}: "${JSON.stringify(id)}" is not a legal ACME identifier -- must match ${ACME_IDENT_RE}`);
  }
  if (ACME_RESERVED_MNEMONICS.has(id.toUpperCase())) {
    throw new Error(
      `${what}: "${id}" collides with the reserved 6502/6510 mnemonic ${id.toUpperCase()} (verified rejected ` +
        `by real ACME 0.97 -- see this module's ACME_RESERVED_MNEMONICS header comment)`,
    );
  }
}
