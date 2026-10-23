// ZX Spectrum platform reference data and decoders: the spectrum-memory-map
// script, and the platform names of a Spectrum project. Names follow "The
// Complete Spectrum ROM Disassembly" (Logan and O'Hara) and the system
// variables of the Spectrum manual, with "_" for "-". Only platform facts live
// here: an address without one belongs to the application. The ROM names are
// those of the 48 BASIC ROM: the 48K's ROM, and ROM 1 of the 128K. The 128K
// also names its system area at $5B00-$5BFF. The timing facts (contention)
// and the AY-3-8912 registers of the 128K are here too: the memory map lists
// them, and the ay tool of the MCP server decodes with spectrumDecodeAy.

import { Refusal } from "../errors.ts";
import { SPECTRUM_TIMING, type Machine, type SpectrumModel, type SpectrumTiming } from "../machine.ts";
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

/**
 * The system variables and the paging routines of the 128K ROM at
 * $5B00-$5BFF, the printer buffer of the 48K. The names and the lengths are
 * those of Paul Farrow's Spectrum 128 ROM 0 disassembly (4 February 2019,
 * fruitcake.plus.com). The ROM 0 dump of the same site has code that uses
 * each address of this table, for example LD (BANK_M),A after each OUT to
 * $7FFD. World of Spectrum confirms $5B5C. Left out: ROW23 and ROW45, which no
 * instruction of ROM 0 addresses directly, and BANK678 at $5B67, which is a
 * +2A/+3 variable: on the 128K, $5B67 is N_STR1.
 */
export const SPECTRUM128_SYSTEM: Entry[] = [
  e(0x5b00, 0x5b13, "SWAP", "A routine in RAM that pages in the other ROM: ROM 0 calls ROM 1 through it."),
  e(0x5b14, 0x5b1c, "YOUNGER", "A routine in RAM that pages ROM 0 in again after a call to ROM 1."),
  e(0x5b1d, 0x5b2e, "ONERR", "A routine in RAM that pages ROM 0 in when ROM 1 reports an error."),
  e(0x5b2f, 0x5b33, "PIN", "A routine in RAM that the RS232 input channel calls first."),
  e(0x5b34, 0x5b49, "POUT", "A routine in RAM that the RS232 output channel calls first for a token."),
  e(0x5b4a, 0x5b57, "POUT2", "A routine in RAM that the RS232 output channel calls first for a character."),
  e(0x5b58, 0x5b59, "TARGET", "The address of the ROM 1 routine that SWAP calls."),
  e(0x5b5a, 0x5b5b, "RETADDR", "The return address in ROM 0 after a call to ROM 1."),
  e(0x5b5c, 0x5b5c, "BANK_M", "The last value that a program wrote to port $7FFD. The interrupt routine and the ROM read the paging from here: a program that writes $7FFD also writes this byte."),
  e(0x5b5d, 0x5b5d, "RAMRST", "An RST $08 instruction in RAM: ROM 0 reports a BASIC error through it."),
  e(0x5b5e, 0x5b5e, "RAMERR", "The error code for the RST $08 at RAMRST."),
  e(0x5b5f, 0x5b60, "BAUD", "The bit time of the RS232 port. The default is 11."),
  e(0x5b61, 0x5b62, "SERFL", "The RS232 input: bit 0 is 1 when a second character came in, and the next byte is that character."),
  e(0x5b63, 0x5b63, "COL", "The column of the RS232 printer, from 1 to WIDTH."),
  e(0x5b64, 0x5b64, "WIDTH", "The number of columns of the RS232 printer. The default is 80."),
  e(0x5b65, 0x5b65, "TVPARS", "The number of parameters that the RS232 output still waits for, for example 2 for AT."),
  e(0x5b66, 0x5b66, "FLAGS3", "Flags of the 128K ROM. Bit 0: BASIC (1) or the editor and the menu (0). Bit 3: the RAM disk. Bits 4-7: LOAD, SAVE, MERGE and VERIFY."),
  e(0x5b67, 0x5b70, "N_STR1", "A file name of the RAM disk, and a work area of the renumber routine."),
  e(0x5b71, 0x5b71, "HD_00", "The file header of the RAM disk: the file type. The COPY, FORMAT and renumber routines also use it."),
  e(0x5b72, 0x5b73, "HD_0B", "The file header of the RAM disk: the length of the block."),
  e(0x5b74, 0x5b75, "HD_0D", "The file header of the RAM disk: the start of the block."),
  e(0x5b76, 0x5b77, "HD_0F", "The file header of the RAM disk: the length of the program without its variables."),
  e(0x5b78, 0x5b79, "HD_11", "The file header of the RAM disk: the line that starts a program."),
  e(0x5b7a, 0x5b7a, "SC_00", "A second file header of the RAM disk: the file type."),
  e(0x5b7b, 0x5b7c, "SC_0B", "A second file header of the RAM disk: the length of the block."),
  e(0x5b7d, 0x5b7e, "SC_0D", "A second file header of the RAM disk: the start of the block."),
  e(0x5b7f, 0x5b80, "SC_0F", "A second file header of the RAM disk: the length of the program without its variables."),
  e(0x5b81, 0x5b82, "OLDSP", "The stack pointer of the program while the ROM uses the stack at TSTACK."),
  e(0x5b83, 0x5b84, "SFNEXT", "The address of the first free entry of the RAM disk catalogue."),
  e(0x5b85, 0x5b87, "SFSPACE", "The number of free bytes of the RAM disk: 3 bytes, the low byte first."),
  e(0x5b88, 0x5b88, "ROW01", "The keypad: the keys of one row, and the state of the link to the keypad in bits 6 and 7."),
  e(0x5b8b, 0x5b8c, "SYNRET", "The return address of the ONERR routine."),
  e(0x5b8d, 0x5b91, "LASTV", "The last value that the calculator mode printed."),
  e(0x5b92, 0x5b93, "RNLINE", "The address of the line that the renumber routine changes."),
  e(0x5b94, 0x5b95, "RNFIRST", "The first line number of a renumber. The default is 10."),
  e(0x5b96, 0x5b97, "RNSTEP", "The step between the line numbers of a renumber. The default is 10."),
  e(0x5b98, 0x5bb7, "STRIP1", "The transfer buffer of the RAM disk, and the patterns of the stripes of the menu."),
  e(0x5bff, 0x5bff, "TSTACK", "The top of the temporary stack of the 128K ROM. The stack goes down from here."),
];

/** The memory areas of the CPU view. */
export const SPECTRUM_AREAS: Array<{ name: string; start: number; end: number; meaning: string }> = [
  { name: "rom", start: 0x0000, end: 0x3fff, meaning: "The ROM: the 48 BASIC ROM, or on the 128K the ROM that port $7FFD selects." },
  { name: "screen", start: 0x4000, end: 0x57ff, meaning: "The screen bitmap: three thirds of 64 rows, the row address 010T TSSS LLLC CCCC." },
  { name: "attributes", start: 0x5800, end: 0x5aff, meaning: "The colours of the screen: one byte per 8 x 8 cell, FLASH, BRIGHT, PAPER and INK." },
  { name: "printer-buffer", start: 0x5b00, end: 0x5bff, meaning: "The printer buffer on the 48K. On the 128K, the paging routines and the system variables of the 128K ROM: in a 128K project, list system gives their names." },
  { name: "system-variables", start: 0x5c00, end: 0x5cb5, meaning: "The system variables of BASIC." },
  { name: "ram", start: 0x5cb6, end: 0xffff, meaning: "The channels, BASIC and its variables, and the free memory, up to RAMTOP. On the 128K, $C000-$FFFF is the RAM bank that port $7FFD selects." },
];

/** The I/O ports. A port is decoded by some of its address bits; the address is one that works. */
export const SPECTRUM_PORTS: Array<{ port: number; name: string; meaning: string }> = [
  { port: 0x00fe, name: "ULA", meaning: "Any even port. OUT: bits 0-2 the border, bit 3 MIC, bit 4 the beeper. IN: bits 0-4 the keys of the half-rows whose bit is 0 in the high byte, bit 6 EAR." },
  {
    port: 0x7ffd,
    name: "PAGING",
    meaning:
      "128K, write only. The port decodes each address with bits 1 and 15 at 0. Bits 0-2: the RAM bank at $C000. Bit 3: the screen in bank 7. Bit 4: ROM 1 (48 BASIC). Bit 5: locks the paging until a reset. " +
      "Keep the last value in BANK_M ($5B5C): the ROM reads the paging from there. Each access to RAM bank 1, 3, 5 or 7 waits for the ULA.",
  },
  { port: 0xfffd, name: "AY_SELECT", meaning: "128K: OUT selects an AY-3-8912 register, IN reads it." },
  { port: 0xbffd, name: "AY_DATA", meaning: "128K: OUT writes the selected AY-3-8912 register." },
  { port: 0x001f, name: "KEMPSTON", meaning: "A Kempston joystick interface, IN: bit 0 right, bit 1 left, bit 2 down, bit 3 up, bit 4 fire." },
];

/** The model of the Spectrum of a machine: the 128K for a 128K project, else the 48K. */
export function spectrumModelOf(machine: Machine): SpectrumModel {
  return machine.id === "spectrum128" ? "128k" : "48k";
}

/** The system variables of a model: on the 128K, also those of the 128K ROM at $5B00-$5BFF. */
export function spectrumSystem(model: SpectrumModel): Entry[] {
  return model === "128k" ? [...SPECTRUM128_SYSTEM, ...SPECTRUM_SYSTEM] : SPECTRUM_SYSTEM;
}

const entriesOf = (model: SpectrumModel) => [...SPECTRUM_ROM, ...spectrumSystem(model)];

/** The names of the Spectrum for a listing or a source: each name once, symbol-safe. The model decides what $5B00-$5BFF is. */
export function spectrumPlatformNames(model: SpectrumModel): Array<{ address: number; end: number; name: string; meaning: string }> {
  return entriesOf(model).map((entry) => ({ address: entry.start, end: entry.end, name: entry.name, meaning: entry.meaning }));
}

/** What an address of the CPU view is on a model of the Spectrum. */
export function spectrumLookup(address: number, model: SpectrumModel): Lookup {
  const area = SPECTRUM_AREAS.find((item) => address >= item.start && address <= item.end)!;
  const entry = entriesOf(model).find((item) => address >= item.start && address <= item.end);
  if (entry !== undefined) {
    return { address, kind: "platform", area: area.name, name: entry.name, meaning: entry.meaning, ...(entry.start === address ? {} : { entryStart: entry.start }) };
  }
  if (area.name === "ram") return { address, kind: "application", area: area.name, meaning: "No platform meaning: the address belongs to the program." };
  return { address, kind: "platform", area: area.name, meaning: area.meaning };
}

// ---------------------------------------------------------------------------
// Timing and contention

/** The wait in t-states of a contended access, by its t-state in each group of 8 from contentionStart. */
export const CONTENTION_PATTERN = [6, 5, 4, 3, 2, 1, 0, 0] as const;
/** The t-states at the start of each picture line where the pattern applies. */
export const CONTENDED_LINE_TSTATES = 128;
export const PICTURE_LINES = 192;
/** The RAM banks of the 128K whose accesses wait for the ULA: at $C000-$FFFF when port $7FFD pages one of them in. Bank 5 is always at $4000. */
export const CONTENDED_BANKS = [1, 3, 5, 7] as const;

/** The contention of an address of the CPU view: always at $4000-$7FFF, and on the 128K at $C000-$FFFF when a contended bank is paged in. */
export function spectrumContention(address: number, model: SpectrumModel): { contended?: true; contendedBanks?: number[] } {
  if (address >= 0x4000 && address <= 0x7fff) return { contended: true };
  if (model === "128k" && address >= 0xc000) return { contendedBanks: [...CONTENDED_BANKS] };
  return {};
}

/** The contended banks in words: "1, 3, 5 or 7". */
const BANKS_TEXT = CONTENDED_BANKS.slice(0, -1).join(", ") + " or " + CONTENDED_BANKS.at(-1);

/** The timing facts of both models, for a list: a value of each model and its meaning. */
export function spectrumTimingFacts(): Array<{ name: string; "48k": number | string; "128k": number | string; meaning: string }> {
  const fact = (name: keyof SpectrumTiming, meaning: string) => ({ name, "48k": SPECTRUM_TIMING["48k"][name], "128k": SPECTRUM_TIMING["128k"][name], meaning });
  return [
    fact("cpuHz", "The CPU clock in Hz."),
    fact("lineTstates", "The t-states of one line: the picture, the border and the retrace."),
    fact("frameLines", "The lines of one frame."),
    fact("frameTstates", "The t-states of one frame. The interrupt comes at the start of each frame, at t-state 0."),
    fact("linesBeforePicture", "The lines from the interrupt to the first line of the picture."),
    fact("contentionStart", "The first t-state of the frame where an access to contended memory waits for the ULA. The count is the t-state count of the emulator session, from 0 at the interrupt."),
    {
      name: "contentionPattern",
      "48k": CONTENTION_PATTERN.join(","),
      "128k": CONTENTION_PATTERN.join(","),
      meaning:
        "The wait in t-states of an access to contended memory, by the t-state of the access in each group of 8. The pattern starts at contentionStart. " +
        "It applies to the first " + CONTENDED_LINE_TSTATES + " t-states of each of the " + PICTURE_LINES + " picture lines. In the other t-states, an access does not wait.",
    },
    {
      name: "contendedMemory",
      "48k": "$4000-$7FFF",
      "128k": "$4000-$7FFF, and $C000-$FFFF when port $7FFD pages in bank " + BANKS_TEXT,
      meaning: "The memory where the CPU waits for the ULA when it reads an opcode or data, or writes data. Code and data in this memory run slower during the picture lines.",
    },
    {
      name: "ioContention",
      "48k": "high byte $40-$7F",
      "128k": "high byte $40-$7F, and $C0-$FF when port $7FFD pages in bank " + BANKS_TEXT,
      meaning:
        "An IN or an OUT waits for the ULA by its port address. An even port, for example $FE, waits after its first t-state. " +
        "When the high byte of the port is in contended memory, the port also waits at its first t-state. An odd port with such a high byte waits at each of its 4 t-states. " +
        "An odd port with a high byte out of contended memory does not wait. Thus an IN from port $FE during the picture lines can take more t-states.",
    },
    {
      name: "im2",
      "48k": "I x 256",
      "128k": "I x 256",
      meaning:
        "In interrupt mode 2, the I register gives the high byte of a table of 257 bytes. The low byte comes from the data bus and is not known. " +
        "Thus a program fills the 257 bytes with one value, and puts its interrupt routine at the address of two such bytes.",
    },
  ];
}

// ---------------------------------------------------------------------------
// The AY-3-8912 of the 128K

/** The clock of the AY-3-8912 of the 128K in Hz: half the CPU clock. */
export const AY_CLOCK_HZ = SPECTRUM_TIMING["128k"].cpuHz / 2;

const tone = (channel: string, register: number) => [
  { register, name: "TONE_" + channel + "_FINE", meaning: "The tone period of channel " + channel + ": bits 0-7. The tone is the AY clock / (16 x period) Hz. A period of 0 gives the tone of period 1." },
  { register: register + 1, name: "TONE_" + channel + "_COARSE", meaning: "The tone period of channel " + channel + ": bits 8-11, in bits 0-3." },
];
const volume = (channel: string, register: number) => ({ register, name: "VOLUME_" + channel, meaning: "The volume of channel " + channel + ": bits 0-3 the level 0-15. When bit 4 is 1, the envelope gives the level." });

/** The registers of the AY-3-8912: R0 to R15. Port $FFFD selects a register, port $BFFD writes it. */
export const SPECTRUM_AY: Array<{ register: number; name: string; meaning: string }> = [
  ...tone("A", 0),
  ...tone("B", 2),
  ...tone("C", 4),
  { register: 6, name: "NOISE_PERIOD", meaning: "The noise period: bits 0-4. The noise is the AY clock / (16 x period) Hz. A period of 0 gives the noise of period 1." },
  { register: 7, name: "MIXER", meaning: "Bits 0-2: when 1, no tone on channel A, B, C. Bits 3-5: when 1, no noise on channel A, B, C. Bit 6: port A is an output (1) or an input (0). Bit 7: the same for port B." },
  volume("A", 8),
  volume("B", 9),
  volume("C", 10),
  { register: 11, name: "ENVELOPE_FINE", meaning: "The envelope period: bits 0-7. One ramp of the envelope takes 256 x period AY clock cycles." },
  { register: 12, name: "ENVELOPE_COARSE", meaning: "The envelope period: bits 8-15." },
  { register: 13, name: "ENVELOPE_SHAPE", meaning: "The envelope shape: bit 0 hold, bit 1 alternate, bit 2 attack, bit 3 continue. A write starts the envelope again." },
  { register: 14, name: "PORT_A", meaning: "The I/O port A. On the 128K, it drives the RS232 port, the MIDI port and the keypad." },
  { register: 15, name: "PORT_B", meaning: "The I/O port B. The AY-3-8912 has no pins for port B." },
];

/** The form of each envelope shape, R13 bits 0-3. The shapes 0-7 all go to 0 after one ramp. */
const ENVELOPE_FORMS = [
  ...Array<string>(4).fill("falls one time, then stays at 0"),
  ...Array<string>(4).fill("rises one time, then stays at 0"),
  "falls again and again",
  "falls one time, then stays at 0",
  "falls and rises again and again",
  "falls one time, then stays at 15",
  "rises again and again",
  "rises one time, then stays at 15",
  "rises and falls again and again",
  "rises one time, then stays at 0",
];

export const SPECTRUM_DECODERS = ["ula", "paging", "attribute", "ay-mixer", "ay-volume", "ay-shape"] as const;
export type SpectrumDecoder = (typeof SPECTRUM_DECODERS)[number];

const isByte = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xff;
const channels = (value: number, shift: number) => ({ a: (value & (1 << shift)) === 0, b: (value & (2 << shift)) === 0, c: (value & (4 << shift)) === 0 });
const direction = (output: boolean) => (output ? "output" : "input");

/** The decoded value of a port, a register or an attribute: OUT to the ULA, a write to $7FFD, an attribute byte, or the AY mixer, a volume or the envelope shape. */
export function spectrumDecode(what: SpectrumDecoder, value: number): Record<string, unknown> {
  if (!isByte(value)) throw new Refusal("invalid-input", value + " is no byte value: give 0 to 255 or $00 to $ff.");
  if (what === "ula") return { border: value & 7, mic: (value & 0x08) !== 0, beeper: (value & 0x10) !== 0 };
  if (what === "paging") return { ramBank: value & 7, screenBank: value & 0x08 ? 7 : 5, rom: value & 0x10 ? 1 : 0, locked: (value & 0x20) !== 0 };
  if (what === "ay-mixer") return { tone: channels(value, 0), noise: channels(value, 3), portA: direction((value & 0x40) !== 0), portB: direction((value & 0x80) !== 0) };
  if (what === "ay-volume") return { level: value & 15, envelope: (value & 0x10) !== 0 };
  if (what === "ay-shape") {
    const shape = value & 15;
    return { shape, continue: (shape & 8) !== 0, attack: (shape & 4) !== 0, alternate: (shape & 2) !== 0, hold: (shape & 1) !== 0, form: ENVELOPE_FORMS[shape] };
  }
  return { ink: value & 7, paper: (value >> 3) & 7, bright: (value & 0x40) !== 0, flash: (value & 0x80) !== 0 };
}

const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * The meaning of the 16 AY registers, R0 first, at the clock of the 128K:
 * the tone of each channel in Hz with its mixer and volume, the noise, the
 * envelope and the port directions. A tone or noise period of 0 counts as 1,
 * and an envelope period of 0 as half of 1, as the chip does (see the notes
 * of MAME's ay8910.cpp).
 */
export function spectrumDecodeAy(registers: readonly number[], clockHz = AY_CLOCK_HZ): Record<string, unknown> {
  if (registers.length !== 16 || !registers.every(isByte)) throw new Refusal("invalid-input", "The AY has 16 registers of 0 to 255, not " + registers.length + " values: " + registers.join(", ") + ".");
  const r = registers;
  const mixer = spectrumDecode("ay-mixer", r[7]!) as { tone: Record<string, boolean>; noise: Record<string, boolean>; portA: string; portB: string };
  const noisePeriod = r[6]! & 31;
  const envelopePeriod = (r[12]! << 8) | r[11]!;
  return {
    clockHz,
    channels: (["a", "b", "c"] as const).map((channel, index) => {
      const period = ((r[index * 2 + 1]! & 15) << 8) | r[index * 2]!;
      const level = spectrumDecode("ay-volume", r[8 + index]!) as { level: number; envelope: boolean };
      return { channel: channel.toUpperCase(), tonePeriod: period, toneHz: hundredths(clockHz / (16 * Math.max(period, 1))), tone: mixer.tone[channel], noise: mixer.noise[channel], level: level.level, envelope: level.envelope };
    }),
    noise: { period: noisePeriod, hz: hundredths(clockHz / (16 * Math.max(noisePeriod, 1))) },
    envelope: { period: envelopePeriod, rampMs: hundredths((256 * (envelopePeriod === 0 ? 0.5 : envelopePeriod) * 1000) / clockHz), ...spectrumDecode("ay-shape", r[13]!) },
    portA: { direction: mixer.portA, value: r[14] },
    portB: { direction: mixer.portB, value: r[15] },
  };
}
