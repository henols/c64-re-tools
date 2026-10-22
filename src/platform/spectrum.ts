// ZX Spectrum platform reference data and decoders: the spectrum-memory-map
// script, and the platform names of a Spectrum project. Names follow "The
// Complete Spectrum ROM Disassembly" (Logan and O'Hara) and the system
// variables of the Spectrum manual, with "_" for "-". Only platform facts live
// here: an address without one belongs to the application. The ROM names are
// those of the 48 BASIC ROM: the 48K's ROM, and ROM 1 of the 128K.

import { Refusal } from "../errors.ts";
import type { Entry, Lookup } from "../platform.ts";

const e = (start: number, end: number, name: string, meaning: string): Entry => ({ start, end, name, meaning });

/** The restarts, the interrupt routines and the main entry points of the 48 BASIC ROM. */
export const SPECTRUM_ROM: Entry[] = [
  e(0x0000, 0x0000, "START", "Power-on and reset: disables the interrupts and starts the RAM test."),
  e(0x0008, 0x0008, "ERROR_1", "RST $08: reports the BASIC error whose code is the byte after the RST."),
  e(0x0010, 0x0010, "PRINT_A_1", "RST $10: prints the character in A on the current channel."),
  e(0x0018, 0x0018, "GET_CHAR", "RST $18: gets the character at CH_ADD of the BASIC line."),
  e(0x0020, 0x0020, "NEXT_CHAR", "RST $20: steps CH_ADD on and gets the next character."),
  e(0x0028, 0x0028, "FP_CALC", "RST $28: runs the calculator on the literals that follow it, up to $38 (end-calc)."),
  e(0x0030, 0x0030, "BC_SPACES", "RST $30: makes BC bytes of room in the work space."),
  e(0x0038, 0x0038, "MASK_INT", "The IM 1 interrupt routine: counts FRAMES and reads the keyboard, once a frame."),
  e(0x0066, 0x0066, "RESET", "The NMI routine: jumps to the address in NMIADD when it is not zero."),
  e(0x028e, 0x028e, "KEY_SCAN", "Reads the keyboard matrix: the key code in E, the shift in D."),
  e(0x02bf, 0x02bf, "KEYBOARD", "The keyboard routine of the interrupt: decodes, repeats and stores a key in LAST_K."),
  e(0x03b5, 0x03b5, "BEEPER", "Makes a tone on the beeper: HL is the period, DE the number of cycles."),
  e(0x03f8, 0x03f8, "BEEP", "The BEEP command: duration and pitch from the calculator stack."),
  e(0x04c2, 0x04c2, "SA_BYTES", "Saves a block to tape: IX the address, DE the length, A the flag byte."),
  e(0x0556, 0x0556, "LD_BYTES", "Loads or verifies a block from tape: IX the address, DE the length, A the flag byte, carry set to load."),
  e(0x0d6b, 0x0d6b, "CLS", "Clears the screen and its attributes."),
  e(0x0daf, 0x0daf, "CL_ALL", "Clears the whole display and sets the print position to the top."),
  e(0x1601, 0x1601, "CHAN_OPEN", "Opens the stream in A: 0 and 1 the lower screen, 2 the upper screen, 3 the printer."),
  e(0x15d4, 0x15d4, "WAIT_KEY", "Waits for a key and gives its code in A."),
  e(0x1e94, 0x1e94, "FIND_INT1", "Takes the last value from the calculator stack as a byte in A."),
  e(0x1e99, 0x1e99, "FIND_INT2", "Takes the last value from the calculator stack as a 16-bit value in BC."),
  e(0x203c, 0x203c, "PR_STRING", "Prints BC characters from DE."),
  e(0x22aa, 0x22aa, "PIXEL_ADD", "Gives the screen address of a pixel: B the row, C the column."),
  e(0x22e5, 0x22e5, "PLOT_SUB", "Plots the pixel at B, C with the current OVER and INVERSE."),
  e(0x2d28, 0x2d28, "STACK_A", "Puts A on the calculator stack."),
  e(0x2d2b, 0x2d2b, "STACK_BC", "Puts BC on the calculator stack."),
  e(0x2da2, 0x2da2, "FP_TO_BC", "Takes the last value from the calculator stack as BC."),
  e(0x2dd5, 0x2dd5, "FP_TO_A", "Takes the last value from the calculator stack as A."),
  e(0x2de3, 0x2de3, "PRINT_FP", "Prints the last value of the calculator stack."),
  e(0x3d00, 0x3fff, "CHAR_SET", "The character set: 96 characters of 8 bytes, from the space."),
];

/** The system variables at $5C00-$5CB5. */
export const SPECTRUM_SYSTEM: Entry[] = [
  e(0x5c00, 0x5c07, "KSTATE", "The state of the keyboard reading: two sets of four bytes."),
  e(0x5c08, 0x5c08, "LAST_K", "The last key that the keyboard routine read."),
  e(0x5c09, 0x5c09, "REPDEL", "The time in frames before a held key repeats."),
  e(0x5c0a, 0x5c0a, "REPPER", "The time in frames between the repeats of a held key."),
  e(0x5c0b, 0x5c0c, "DEFADD", "The address of the arguments of a user function, when one runs."),
  e(0x5c0d, 0x5c0d, "K_DATA", "The second byte of a colour control code from the keyboard."),
  e(0x5c0e, 0x5c0f, "TVDATA", "The bytes of a colour or AT and TAB control code for the screen."),
  e(0x5c10, 0x5c35, "STRMS", "The offsets of the channel of each stream, -3 to 15, in CHANS."),
  e(0x5c36, 0x5c37, "CHARS", "256 less than the address of the character set. Default $3C00."),
  e(0x5c38, 0x5c38, "RASP", "The length of the warning buzz."),
  e(0x5c39, 0x5c39, "PIP", "The length of the keyboard click."),
  e(0x5c3a, 0x5c3a, "ERR_NR", "The error code less one. IY points here while BASIC runs."),
  e(0x5c3b, 0x5c3b, "FLAGS", "Flags of BASIC."),
  e(0x5c3c, 0x5c3c, "TV_FLAG", "Flags of the screen."),
  e(0x5c3d, 0x5c3e, "ERR_SP", "The address on the machine stack of the error return."),
  e(0x5c3f, 0x5c40, "LIST_SP", "The return address of an automatic listing."),
  e(0x5c41, 0x5c41, "MODE", "The cursor mode: K, L, C, E or G."),
  e(0x5c42, 0x5c43, "NEWPPC", "The line to jump to."),
  e(0x5c44, 0x5c44, "NSPPC", "The statement in the line to jump to."),
  e(0x5c45, 0x5c46, "PPC", "The number of the line that runs."),
  e(0x5c47, 0x5c47, "SUBPPC", "The number of the statement that runs in its line."),
  e(0x5c48, 0x5c48, "BORDCR", "The border colour times 8, and the attribute of the lower screen."),
  e(0x5c49, 0x5c4a, "E_PPC", "The number of the current line of the listing."),
  e(0x5c4b, 0x5c4c, "VARS", "The address of the variables (the end of the program)."),
  e(0x5c4d, 0x5c4e, "DEST", "The address of a variable in an assignment."),
  e(0x5c4f, 0x5c50, "CHANS", "The address of the channel data."),
  e(0x5c51, 0x5c52, "CURCHL", "The address of the channel in use."),
  e(0x5c53, 0x5c54, "PROG", "The address of the BASIC program."),
  e(0x5c55, 0x5c56, "NXTLIN", "The address of the next line of the program."),
  e(0x5c57, 0x5c58, "DATADD", "The address of the end of the last DATA item."),
  e(0x5c59, 0x5c5a, "E_LINE", "The address of the line that is edited."),
  e(0x5c5b, 0x5c5c, "K_CUR", "The address of the cursor."),
  e(0x5c5d, 0x5c5e, "CH_ADD", "The address of the next character of BASIC to interpret."),
  e(0x5c5f, 0x5c60, "X_PTR", "The address of the character after a syntax error."),
  e(0x5c61, 0x5c62, "WORKSP", "The address of the temporary work space."),
  e(0x5c63, 0x5c64, "STKBOT", "The bottom of the calculator stack."),
  e(0x5c65, 0x5c66, "STKEND", "The top of the calculator stack: the start of the free memory."),
  e(0x5c67, 0x5c67, "BREG", "The B register of the calculator."),
  e(0x5c68, 0x5c69, "MEM", "The address of the memory of the calculator (MEMBOT)."),
  e(0x5c6a, 0x5c6a, "FLAGS2", "More flags of BASIC: CAPS LOCK in bit 3."),
  e(0x5c6b, 0x5c6b, "DF_SZ", "The number of lines of the lower screen."),
  e(0x5c6c, 0x5c6d, "S_TOP", "The number of the top line of an automatic listing."),
  e(0x5c6e, 0x5c6f, "OLDPPC", "The line that CONTINUE goes to."),
  e(0x5c70, 0x5c70, "OSPPC", "The statement that CONTINUE goes to."),
  e(0x5c71, 0x5c71, "FLAGX", "Flags of INPUT and of assignments."),
  e(0x5c72, 0x5c73, "STRLEN", "The length of a string in an assignment."),
  e(0x5c74, 0x5c75, "T_ADDR", "The address of the next item in the syntax table."),
  e(0x5c76, 0x5c77, "SEED", "The seed of RND, set by RANDOMIZE."),
  e(0x5c78, 0x5c7a, "FRAMES", "The frame counter: 3 bytes, the low byte first, one more each interrupt."),
  e(0x5c7b, 0x5c7c, "UDG", "The address of the first user graphic. Default $FF58 on the 48K."),
  e(0x5c7d, 0x5c7e, "COORDS", "The x and y of the last point that PLOT or DRAW drew."),
  e(0x5c7f, 0x5c7f, "P_POSN", "The column of the printer position."),
  e(0x5c80, 0x5c81, "PR_CC", "The address of the next position in the printer buffer."),
  e(0x5c82, 0x5c83, "ECHO_E", "The column and line of the end of the input buffer."),
  e(0x5c84, 0x5c85, "DF_CC", "The screen address of the print position of the upper screen."),
  e(0x5c86, 0x5c87, "DF_CCL", "The screen address of the print position of the lower screen."),
  e(0x5c88, 0x5c89, "S_POSN", "The column and line of the print position of the upper screen."),
  e(0x5c8a, 0x5c8b, "S_POSNL", "The column and line of the print position of the lower screen."),
  e(0x5c8c, 0x5c8c, "SCR_CT", "The number of scrolls before the scroll? question."),
  e(0x5c8d, 0x5c8d, "ATTR_P", "The permanent colours: the attribute that INK, PAPER and the like set."),
  e(0x5c8e, 0x5c8e, "MASK_P", "The bits of the permanent attribute that are transparent."),
  e(0x5c8f, 0x5c8f, "ATTR_T", "The temporary colours."),
  e(0x5c90, 0x5c90, "MASK_T", "The bits of the temporary attribute that are transparent."),
  e(0x5c91, 0x5c91, "P_FLAG", "Flags of OVER, INVERSE, INK 9 and PAPER 9."),
  e(0x5c92, 0x5caf, "MEMBOT", "The memory of the calculator: six values of 5 bytes."),
  e(0x5cb0, 0x5cb1, "NMIADD", "The address that the NMI routine jumps to, when it is not zero."),
  e(0x5cb2, 0x5cb3, "RAMTOP", "The top of the memory that BASIC uses; CLEAR sets it."),
  e(0x5cb4, 0x5cb5, "P_RAMT", "The last address of the RAM."),
];

/** The memory areas of the CPU view. */
export const SPECTRUM_AREAS: Array<{ name: string; start: number; end: number; meaning: string }> = [
  { name: "rom", start: 0x0000, end: 0x3fff, meaning: "The ROM: the 48 BASIC ROM, or on the 128K the ROM that port $7FFD selects." },
  { name: "screen", start: 0x4000, end: 0x57ff, meaning: "The screen bitmap: three thirds of 64 rows, the row address 010T TSSS LLLC CCCC." },
  { name: "attributes", start: 0x5800, end: 0x5aff, meaning: "The colours of the screen: one byte per 8 x 8 cell, FLASH, BRIGHT, PAPER and INK." },
  { name: "printer-buffer", start: 0x5b00, end: 0x5bff, meaning: "The printer buffer on the 48K; on the 128K the paging routines and variables of its ROM." },
  { name: "system-variables", start: 0x5c00, end: 0x5cb5, meaning: "The system variables of BASIC." },
  { name: "ram", start: 0x5cb6, end: 0xffff, meaning: "The channels, BASIC and its variables, and the free memory, up to RAMTOP; on the 128K, $C000-$FFFF is the RAM bank that port $7FFD selects." },
];

/** The I/O ports. A port is decoded by some of its address bits; the address is one that works. */
export const SPECTRUM_PORTS: Array<{ port: number; name: string; meaning: string }> = [
  { port: 0x00fe, name: "ULA", meaning: "Any even port. OUT: bits 0-2 the border, bit 3 MIC, bit 4 the beeper. IN: bits 0-4 the keys of the half-rows whose bit is 0 in the high byte, bit 6 EAR." },
  { port: 0x7ffd, name: "PAGING", meaning: "128K, write only: bits 0-2 the RAM bank at $C000, bit 3 the screen in bank 7, bit 4 ROM 1 (48 BASIC), bit 5 locks the paging until a reset." },
  { port: 0xfffd, name: "AY_SELECT", meaning: "128K: OUT selects an AY-3-8912 register, IN reads it." },
  { port: 0xbffd, name: "AY_DATA", meaning: "128K: OUT writes the selected AY-3-8912 register." },
  { port: 0x001f, name: "KEMPSTON", meaning: "A Kempston joystick interface, IN: bit 0 right, bit 1 left, bit 2 down, bit 3 up, bit 4 fire." },
];

/** The names of the Spectrum for a listing or a source: each name once, symbol-safe. */
export function spectrumPlatformNames(): Array<{ address: number; end: number; name: string; meaning: string }> {
  return [...SPECTRUM_ROM, ...SPECTRUM_SYSTEM].map((entry) => ({ address: entry.start, end: entry.end, name: entry.name, meaning: entry.meaning }));
}

/** What an address of the CPU view is on the Spectrum. */
export function spectrumLookup(address: number): Lookup {
  const area = SPECTRUM_AREAS.find((item) => address >= item.start && address <= item.end)!;
  const entry = [...SPECTRUM_ROM, ...SPECTRUM_SYSTEM].find((item) => address >= item.start && address <= item.end);
  if (entry !== undefined) {
    return { address, kind: "platform", area: area.name, name: entry.name, meaning: entry.meaning, ...(entry.start === address ? {} : { entryStart: entry.start }) };
  }
  if (area.name === "ram") return { address, kind: "application", area: area.name, meaning: "No platform meaning: the address belongs to the program." };
  return { address, kind: "platform", area: area.name, meaning: area.meaning };
}

/** The decoded value of a port or an attribute: OUT to the ULA, a write to $7FFD, or an attribute byte. */
export function spectrumDecode(what: "ula" | "paging" | "attribute", value: number): Record<string, unknown> {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Refusal("invalid-input", `${value} is no byte value: give 0 to 255 or $00 to $ff.`);
  if (what === "ula") return { border: value & 7, mic: (value & 0x08) !== 0, beeper: (value & 0x10) !== 0 };
  if (what === "paging") return { ramBank: value & 7, screenBank: value & 0x08 ? 7 : 5, rom: value & 0x10 ? 1 : 0, locked: (value & 0x20) !== 0 };
  return { ink: value & 7, paper: (value >> 3) & 7, bright: (value & 0x40) !== 0, flash: (value & 0x80) !== 0 };
}
