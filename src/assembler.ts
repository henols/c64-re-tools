// The assembler of a machine as the knowledge sees it: the rules that the
// knowledge checks in patch code and macro bodies, which are text in the
// assembler's own syntax. ACME (src/assembler/acme.ts) for the C64, sjasmplus
// (src/assembler/sjasmplus.ts) for the Spectrum.

export interface AssemblerDialect {
  id: "acme" | "sjasmplus";
  /** The name for a message, for example "ACME". */
  name: string;
  /** The least count of bytes that patch code assembles to, or undefined when only a build gives it. */
  leastPatchBytes(code: string): number | undefined;
}
