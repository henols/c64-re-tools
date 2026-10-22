// sjasmplus, the assembler of the Spectrum. Its patch rule comes with the
// source generation for the Z80; until then only the build of a switch gives
// the length of patch code.

import type { AssemblerDialect } from "../assembler.ts";

export const SJASMPLUS: AssemblerDialect = { id: "sjasmplus", name: "sjasmplus", leastPatchBytes: () => undefined };
