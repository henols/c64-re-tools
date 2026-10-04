// C64 platform reference data and decoders for the c64-memory-map script.
// Names follow "Mapping the Commodore 64". Only platform facts live here:
// an address without one belongs to the application.

export interface Entry {
  start: number;
  end: number;
  name: string;
  meaning: string;
}

export interface Lookup {
  address: number;
  kind: "platform" | "application";
  area: string;
  name?: string;
  meaning: string;
  /** For an I/O register mirror: the register it repeats. */
  mirrorOf?: number;
  /** The first address of a multi-byte entry. */
  entryStart?: number;
}

const e = (start: number, end: number, name: string, meaning: string): Entry => ({ start, end, name, meaning });

/** Zero page and the system area $0100-$03FF. */
export const SYSTEM: Entry[] = [
  e(0x00, 0x00, "D6510", "Processor port data direction register. Default $2F."),
  e(0x01, 0x01, "R6510", "Processor port. Bits 0-2 (LORAM, HIRAM, CHAREN) select the memory configuration; bits 3-5 control the cassette."),
  e(0x03, 0x04, "ADRAY1", "Vector to the routine that converts a floating-point number to an integer."),
  e(0x05, 0x06, "ADRAY2", "Vector to the routine that converts an integer to a floating-point number."),
  e(0x0d, 0x0d, "VALTYP", "BASIC data type flag: $FF string, $00 number."),
  e(0x0e, 0x0e, "INTFLG", "BASIC number type flag: $80 integer, $00 floating point."),
  e(0x13, 0x13, "CHANNL", "Current BASIC I/O channel (logical file number)."),
  e(0x14, 0x15, "LINNUM", "Integer value: a line number, or the address for PEEK, POKE, SYS and WAIT."),
  e(0x22, 0x25, "INDEX", "BASIC temporary pointers."),
  e(0x2b, 0x2c, "TXTTAB", "Start of the BASIC program text. Default $0801."),
  e(0x2d, 0x2e, "VARTAB", "Start of the BASIC variables (end of the program)."),
  e(0x2f, 0x30, "ARYTAB", "Start of the BASIC arrays."),
  e(0x31, 0x32, "STREND", "End of the BASIC arrays."),
  e(0x33, 0x34, "FRETOP", "Bottom of the BASIC string storage."),
  e(0x37, 0x38, "MEMSIZ", "Top of the memory that BASIC uses."),
  e(0x39, 0x3a, "CURLIN", "Current BASIC line number."),
  e(0x41, 0x42, "DATPTR", "Address of the next DATA item."),
  e(0x61, 0x66, "FAC1", "Floating-point accumulator 1."),
  e(0x69, 0x6e, "FAC2", "Floating-point accumulator 2."),
  e(0x73, 0x8a, "CHRGET", "The CHRGET routine that BASIC copies from ROM; reads the next character of BASIC text."),
  e(0x7a, 0x7b, "TXTPTR", "Pointer to the current character of BASIC text (inside CHRGET)."),
  e(0x8b, 0x8f, "RNDX", "Seed of the BASIC RND function."),
  e(0x90, 0x90, "STATUS", "KERNAL I/O status byte (BASIC ST)."),
  e(0x91, 0x91, "STKEY", "STOP key flag: $7F when STOP is pressed."),
  e(0x93, 0x93, "VERCK", "KERNAL flag: 0 for LOAD, 1 for VERIFY."),
  e(0x98, 0x98, "LDTND", "Number of open files."),
  e(0x99, 0x99, "DFLTN", "Default input device (0 = keyboard)."),
  e(0x9a, 0x9a, "DFLTO", "Default output device (3 = screen)."),
  e(0x9d, 0x9d, "MSGFLG", "KERNAL message control: bit 7 for direct-mode messages, bit 6 for error messages."),
  e(0xa0, 0xa2, "TIME", "Jiffy clock, 1/60 s, most significant byte first (BASIC TI)."),
  e(0xae, 0xaf, "EAL", "End address of the last LOAD or SAVE."),
  e(0xb2, 0xb3, "TAPE1", "Pointer to the cassette buffer."),
  e(0xb7, 0xb7, "FNLEN", "Length of the current file name."),
  e(0xb8, 0xb8, "LA", "Current logical file number."),
  e(0xb9, 0xb9, "SA", "Current secondary address."),
  e(0xba, 0xba, "FA", "Current device number (8 = first disk drive)."),
  e(0xbb, 0xbc, "FNADR", "Pointer to the current file name."),
  e(0xc1, 0xc2, "STAL", "Start address for LOAD and SAVE."),
  e(0xc3, 0xc4, "MEMUSS", "Load address of a KERNAL LOAD."),
  e(0xc5, 0xc5, "LSTX", "Matrix code of the last key pressed."),
  e(0xc6, 0xc6, "NDX", "Number of characters in the keyboard buffer."),
  e(0xc7, 0xc7, "RVS", "Reverse character flag."),
  e(0xcb, 0xcb, "SFDX", "Matrix code of the current key ($40 = no key)."),
  e(0xcc, 0xcc, "BLNSW", "Cursor blink enable: 0 blinks the cursor."),
  e(0xcd, 0xcd, "BLNCT", "Countdown to the next cursor blink."),
  e(0xce, 0xce, "GDBLN", "Character under the cursor."),
  e(0xcf, 0xcf, "BLNON", "Cursor blink phase."),
  e(0xd1, 0xd2, "PNT", "Pointer to the screen line of the cursor."),
  e(0xd3, 0xd3, "PNTR", "Cursor column on the logical line."),
  e(0xd4, 0xd4, "QTSW", "Quote mode flag."),
  e(0xd5, 0xd5, "LNMX", "Length of the logical screen line (39 or 79)."),
  e(0xd6, 0xd6, "TBLX", "Cursor row."),
  e(0xd8, 0xd8, "INSRT", "Number of pending inserts."),
  e(0xd9, 0xf2, "LDTB1", "Screen line link table."),
  e(0xf3, 0xf4, "USER", "Pointer to the color RAM line of the cursor."),
  e(0xf5, 0xf6, "KEYTAB", "Pointer to the keyboard decode table."),
  e(0xf7, 0xf8, "RIBUF", "Pointer to the RS-232 input buffer."),
  e(0xf9, 0xfa, "ROBUF", "Pointer to the RS-232 output buffer."),
  e(0xfb, 0xfe, "FREEZP", "Free zero page: the system does not use these bytes."),
  e(0xff, 0xff, "BASZPT", "Temporary byte for floating-point to string conversion."),
  e(0x0100, 0x01ff, "STACK", "6510 stack. BASIC also uses $0100-$010A to convert numbers to text."),
  e(0x0200, 0x0258, "BUF", "BASIC input buffer."),
  e(0x0259, 0x0262, "LAT", "Table of logical file numbers of the open files."),
  e(0x0263, 0x026c, "FAT", "Table of device numbers of the open files."),
  e(0x026d, 0x0276, "SAT", "Table of secondary addresses of the open files."),
  e(0x0277, 0x0280, "KEYD", "Keyboard buffer."),
  e(0x0281, 0x0282, "MEMSTR", "Start of the memory for the operating system."),
  e(0x0283, 0x0284, "MEMSIZ", "Top of the memory for the operating system."),
  e(0x0286, 0x0286, "COLOR", "Current text color."),
  e(0x0287, 0x0287, "GDCOL", "Color under the cursor."),
  e(0x0288, 0x0288, "HIBASE", "High byte of the screen memory address for the screen editor. Default 4 ($0400)."),
  e(0x0289, 0x0289, "XMAX", "Largest number of characters in the keyboard buffer (10)."),
  e(0x028a, 0x028a, "RPTFLG", "Key repeat control: $80 repeats all keys."),
  e(0x028d, 0x028d, "SHFLAG", "SHIFT, C= and CTRL key flags."),
  e(0x028f, 0x0290, "KEYLOG", "Vector to the keyboard table setup routine."),
  e(0x0291, 0x0291, "MODE", "Lock of the SHIFT and C= character set switch."),
  e(0x02a6, 0x02a6, "PALNTS", "Video standard flag: 0 NTSC, 1 PAL."),
  e(0x0300, 0x0301, "IERROR", "Vector to the BASIC error message routine."),
  e(0x0302, 0x0303, "IMAIN", "Vector to the BASIC main loop (warm start)."),
  e(0x0304, 0x0305, "ICRNCH", "Vector to the BASIC tokenizer."),
  e(0x0306, 0x0307, "IQPLOP", "Vector to the BASIC LIST token printer."),
  e(0x0308, 0x0309, "IGONE", "Vector to the BASIC statement executor."),
  e(0x030a, 0x030b, "IEVAL", "Vector to the BASIC expression element evaluator."),
  e(0x030c, 0x030c, "SAREG", "A register for SYS, and A after SYS returns."),
  e(0x030d, 0x030d, "SXREG", "X register for SYS."),
  e(0x030e, 0x030e, "SYREG", "Y register for SYS."),
  e(0x030f, 0x030f, "SPREG", "Status register for SYS."),
  e(0x0310, 0x0310, "USRPOK", "JMP instruction of the BASIC USR function."),
  e(0x0311, 0x0312, "USRADD", "Address that the BASIC USR function calls."),
  e(0x0314, 0x0315, "CINV", "IRQ vector. Default $EA31 (the KERNAL IRQ handler)."),
  e(0x0316, 0x0317, "CBINV", "BRK vector. Default $FE66."),
  e(0x0318, 0x0319, "NMINV", "NMI vector. Default $FE47."),
  e(0x031a, 0x031b, "IOPEN", "Vector of the KERNAL OPEN routine."),
  e(0x031c, 0x031d, "ICLOSE", "Vector of the KERNAL CLOSE routine."),
  e(0x031e, 0x031f, "ICHKIN", "Vector of the KERNAL CHKIN routine."),
  e(0x0320, 0x0321, "ICKOUT", "Vector of the KERNAL CHKOUT routine."),
  e(0x0322, 0x0323, "ICLRCH", "Vector of the KERNAL CLRCHN routine."),
  e(0x0324, 0x0325, "IBASIN", "Vector of the KERNAL CHRIN routine."),
  e(0x0326, 0x0327, "IBSOUT", "Vector of the KERNAL CHROUT routine."),
  e(0x0328, 0x0329, "ISTOP", "Vector of the KERNAL STOP routine."),
  e(0x032a, 0x032b, "IGETIN", "Vector of the KERNAL GETIN routine."),
  e(0x032c, 0x032d, "ICLALL", "Vector of the KERNAL CLALL routine."),
  e(0x032e, 0x032f, "USRCMD", "User-defined vector."),
  e(0x0330, 0x0331, "ILOAD", "Vector of the KERNAL LOAD routine."),
  e(0x0332, 0x0333, "ISAVE", "Vector of the KERNAL SAVE routine."),
  e(0x033c, 0x03fb, "TBUFFR", "Cassette buffer. Programs often use it when no tape is in use."),
  e(0x0400, 0x07e7, "VICSCN", "Default screen memory (40 x 25 characters)."),
  e(0x07f8, 0x07ff, "SPRPTR", "Default sprite pointers (for screen memory at $0400)."),
];

/** KERNAL jump table, ROM routines and hardware vectors. */
export const ROM: Entry[] = [
  ...[
    ["CINT", "Initializes the screen editor and the VIC-II."],
    ["IOINIT", "Initializes the CIAs and the I/O devices."],
    ["RAMTAS", "Tests RAM and sets the memory pointers."],
    ["RESTOR", "Sets the standard KERNAL vectors at $0314-$0333."],
    ["VECTOR", "Reads or sets the KERNAL vectors."],
    ["SETMSG", "Sets the KERNAL message control."],
    ["SECOND", "Sends a secondary address after LISTEN."],
    ["TKSA", "Sends a secondary address after TALK."],
    ["MEMTOP", "Reads or sets the top of memory."],
    ["MEMBOT", "Reads or sets the bottom of memory."],
    ["SCNKEY", "Scans the keyboard."],
    ["SETTMO", "Sets the IEEE timeout flag."],
    ["ACPTR", "Reads a byte from the serial bus."],
    ["CIOUT", "Writes a byte to the serial bus."],
    ["UNTLK", "Sends UNTALK on the serial bus."],
    ["UNLSN", "Sends UNLISTEN on the serial bus."],
    ["LISTEN", "Sends LISTEN on the serial bus."],
    ["TALK", "Sends TALK on the serial bus."],
    ["READST", "Reads the I/O status byte."],
    ["SETLFS", "Sets the logical file, device and secondary address."],
    ["SETNAM", "Sets the file name."],
    ["OPEN", "Opens a logical file."],
    ["CLOSE", "Closes a logical file."],
    ["CHKIN", "Selects a file as the input channel."],
    ["CHKOUT", "Selects a file as the output channel."],
    ["CLRCHN", "Restores the default I/O channels."],
    ["CHRIN", "Reads a character from the input channel."],
    ["CHROUT", "Writes the character in A to the output channel."],
    ["LOAD", "Loads or verifies a file into memory."],
    ["SAVE", "Saves memory to a file."],
    ["SETTIM", "Sets the jiffy clock."],
    ["RDTIM", "Reads the jiffy clock."],
    ["STOP", "Tests the STOP key."],
    ["GETIN", "Reads a character from the keyboard buffer or the input channel."],
    ["CLALL", "Closes all files."],
    ["UDTIM", "Increments the jiffy clock."],
    ["SCREEN", "Returns the screen size in columns and rows."],
    ["PLOT", "Reads or sets the cursor position."],
    ["IOBASE", "Returns the I/O base address ($DC00)."],
  ].map(([name, meaning], index) => e(0xff81 + index * 3, 0xff83 + index * 3, name!, `KERNAL jump table: ${meaning}`)),
  e(0xa000, 0xa001, "BASIC cold start vector", "Points to the BASIC cold start ($E394)."),
  e(0xa002, 0xa003, "BASIC warm start vector", "Points to the BASIC warm start ($E37B)."),
  e(0xa474, 0xa474, "READY", "BASIC: prints READY. and waits for a line."),
  e(0xa7ae, 0xa7ae, "NEWSTT", "BASIC: executes the next statement."),
  e(0xab1e, 0xab1e, "STROUT", "BASIC: prints the zero-terminated string at A (low) and Y (high)."),
  e(0xbdcd, 0xbdcd, "LINPRT", "BASIC: prints the 16-bit number in A (high) and X (low)."),
  e(0xe37b, 0xe37b, "BASIC warm start", "BASIC warm start (RUN/STOP-RESTORE)."),
  e(0xe394, 0xe394, "BASIC cold start", "BASIC cold start: initializes BASIC and prints the start message."),
  e(0xe544, 0xe544, "CLRSCR", "KERNAL: clears the screen."),
  e(0xe566, 0xe566, "HOME", "KERNAL: moves the cursor to the top left corner."),
  e(0xe716, 0xe716, "SCRNOUT", "KERNAL: writes the character in A to the screen."),
  e(0xea31, 0xea31, "IRQ handler", "Standard KERNAL IRQ handler (jiffy clock, cursor, keyboard), at the default IRQ vector."),
  e(0xea7e, 0xea7e, "IRQ end with CIA ack", "Reads $DC0D to acknowledge the CIA 1 interrupt, then continues at $EA81."),
  e(0xea81, 0xea81, "IRQ end", "Restores Y, X and A from the stack and returns from the interrupt."),
  e(0xfce2, 0xfce2, "RESET", "KERNAL reset routine (the reset vector)."),
  e(0xfd15, 0xfd15, "RESTOR body", "Sets the standard KERNAL vectors."),
  e(0xfd50, 0xfd50, "RAMTAS body", "Clears the system areas and tests RAM."),
  e(0xfda3, 0xfda3, "IOINIT body", "Initializes the CIAs and the SID volume."),
  e(0xfe43, 0xfe43, "NMI entry", "KERNAL NMI entry (the NMI hardware vector): continues through $0318."),
  e(0xfe47, 0xfe47, "NMI handler", "Standard KERNAL NMI handler (RESTORE key, RS-232)."),
  e(0xfe66, 0xfe66, "BRK handler", "Standard KERNAL BRK handler: warm start."),
  e(0xff48, 0xff48, "IRQ/BRK entry", "Saves A, X and Y, then continues through $0314 (IRQ) or $0316 (BRK)."),
  e(0xff5b, 0xff5b, "CINT body", "Initializes the screen editor and the VIC-II."),
  e(0xfffa, 0xfffb, "NMI vector", "Hardware NMI vector ($FE43 in the KERNAL ROM)."),
  e(0xfffc, 0xfffd, "RESET vector", "Hardware reset vector ($FCE2 in the KERNAL ROM)."),
  e(0xfffe, 0xffff, "IRQ vector", "Hardware IRQ and BRK vector ($FF48 in the KERNAL ROM)."),
];

const VIC: Entry[] = [
  ...Array.from({ length: 8 }, (_, sprite) => [
    e(0xd000 + sprite * 2, 0xd000 + sprite * 2, `SP${sprite}X`, `Sprite ${sprite} X position, bits 0-7 (bit 8 is in $D010).`),
    e(0xd001 + sprite * 2, 0xd001 + sprite * 2, `SP${sprite}Y`, `Sprite ${sprite} Y position.`),
  ]).flat(),
  e(0xd010, 0xd010, "MSIGX", "Bit 8 of the X position of each sprite (bit n = sprite n)."),
  e(0xd011, 0xd011, "SCROLY", "Control 1: vertical scroll (bits 0-2), 25/24 rows (bit 3), display enable (bit 4), bitmap mode (bit 5), extended color mode (bit 6), raster line bit 8 (bit 7)."),
  e(0xd012, 0xd012, "RASTER", "Read: raster line bits 0-7. Write: raster interrupt line bits 0-7."),
  e(0xd013, 0xd013, "LPENX", "Light pen X position."),
  e(0xd014, 0xd014, "LPENY", "Light pen Y position."),
  e(0xd015, 0xd015, "SPENA", "Sprite enable (bit n = sprite n)."),
  e(0xd016, 0xd016, "SCROLX", "Control 2: horizontal scroll (bits 0-2), 40/38 columns (bit 3), multicolor mode (bit 4)."),
  e(0xd017, 0xd017, "YXPAND", "Sprite double height (bit n = sprite n)."),
  e(0xd018, 0xd018, "VMCSB", "Memory setup: character or bitmap base (bits 1-3), screen memory (bits 4-7), inside the VIC-II bank."),
  e(0xd019, 0xd019, "VICIRQ", "Interrupt flags: raster (bit 0), sprite-background (bit 1), sprite-sprite (bit 2), light pen (bit 3), any (bit 7). Write 1 to clear a flag."),
  e(0xd01a, 0xd01a, "IRQMSK", "Interrupt enable: raster (bit 0), sprite-background (bit 1), sprite-sprite (bit 2), light pen (bit 3)."),
  e(0xd01b, 0xd01b, "SPBGPR", "Sprite behind the background (bit n = sprite n)."),
  e(0xd01c, 0xd01c, "SPMC", "Sprite multicolor mode (bit n = sprite n)."),
  e(0xd01d, 0xd01d, "XXPAND", "Sprite double width (bit n = sprite n)."),
  e(0xd01e, 0xd01e, "SPSPCL", "Sprite-sprite collision (bit n = sprite n). Reading clears it."),
  e(0xd01f, 0xd01f, "SPBGCL", "Sprite-background collision (bit n = sprite n). Reading clears it."),
  e(0xd020, 0xd020, "EXTCOL", "Border color (bits 0-3)."),
  e(0xd021, 0xd021, "BGCOL0", "Background color 0 (bits 0-3)."),
  e(0xd022, 0xd022, "BGCOL1", "Background color 1 (multicolor and extended color modes)."),
  e(0xd023, 0xd023, "BGCOL2", "Background color 2 (multicolor and extended color modes)."),
  e(0xd024, 0xd024, "BGCOL3", "Background color 3 (extended color mode)."),
  e(0xd025, 0xd025, "SPMC0", "Sprite multicolor 0."),
  e(0xd026, 0xd026, "SPMC1", "Sprite multicolor 1."),
  ...Array.from({ length: 8 }, (_, sprite) => e(0xd027 + sprite, 0xd027 + sprite, `SP${sprite}COL`, `Sprite ${sprite} color.`)),
];

const SID_VOICE = ["FRELO", "FREHI", "PWLO", "PWHI", "VCREG", "ATDCY", "SUREL"] as const;
const SID_VOICE_MEANING: Record<(typeof SID_VOICE)[number], string> = {
  FRELO: "frequency, low byte",
  FREHI: "frequency, high byte",
  PWLO: "pulse width, low byte",
  PWHI: "pulse width, high nybble",
  VCREG: "control: gate (bit 0), sync (bit 1), ring modulation (bit 2), test (bit 3), waveform triangle/saw/pulse/noise (bits 4-7)",
  ATDCY: "attack (bits 4-7) and decay (bits 0-3)",
  SUREL: "sustain (bits 4-7) and release (bits 0-3)",
};
const SID: Entry[] = [
  ...[0, 1, 2].flatMap((voice) =>
    SID_VOICE.map((name, index) => e(0xd400 + voice * 7 + index, 0xd400 + voice * 7 + index, `${name}${voice + 1}`, `SID voice ${voice + 1} ${SID_VOICE_MEANING[name]}. Write only.`)),
  ),
  e(0xd415, 0xd415, "CUTLO", "SID filter cutoff, bits 0-2. Write only."),
  e(0xd416, 0xd416, "CUTHI", "SID filter cutoff, bits 3-10. Write only."),
  e(0xd417, 0xd417, "RESON", "SID filter resonance (bits 4-7) and the voices through the filter (bits 0-3). Write only."),
  e(0xd418, 0xd418, "SIGVOL", "SID volume (bits 0-3) and filter mode (bits 4-7). Write only."),
  e(0xd419, 0xd419, "POTX", "Paddle X value. Read only."),
  e(0xd41a, 0xd41a, "POTY", "Paddle Y value. Read only."),
  e(0xd41b, 0xd41b, "RANDOM", "Voice 3 oscillator output, often a random number source. Read only."),
  e(0xd41c, 0xd41c, "ENV3", "Voice 3 envelope output. Read only."),
];

function cia(base: number, number: 1 | 2): Entry[] {
  const prefix = number === 1 ? "CIA" : "CI2";
  const port =
    number === 1
      ? ["Port A: keyboard columns (write) and joystick 2 (read).", "Port B: keyboard rows (read) and joystick 1 (read)."]
      : ["Port A: VIC-II bank (bits 0-1, inverted), serial bus and RS-232.", "Port B: user port."];
  const names = [`${prefix}PRA`, `${prefix}PRB`, `${prefix}DDRA`, `${prefix}DDRB`, `${prefix}TALO`, `${prefix}TAHI`, `${prefix}TBLO`, `${prefix}TBHI`, `${prefix}TOD10`, `${prefix}TODS`, `${prefix}TODM`, `${prefix}TODH`, `${prefix}SDR`, `${prefix}ICR`, `${prefix}CRA`, `${prefix}CRB`];
  const meanings = [
    port[0]!,
    port[1]!,
    "Data direction of port A (1 = output).",
    "Data direction of port B (1 = output).",
    "Timer A, low byte.",
    "Timer A, high byte.",
    "Timer B, low byte.",
    "Timer B, high byte.",
    "Time of day, tenths of seconds (BCD).",
    "Time of day, seconds (BCD).",
    "Time of day, minutes (BCD).",
    "Time of day, hours (BCD, bit 7 = PM).",
    "Serial shift register.",
    `Interrupt control: read gives the sources and clears them; write sets (bit 7 = 1) or clears (bit 7 = 0) the enable bits. Its interrupt goes to the ${number === 1 ? "IRQ" : "NMI"} line.`,
    "Control A: start (bit 0), PB6 output (bit 1), toggle (bit 2), one-shot (bit 3), force load (bit 4), count CNT (bit 5), serial output (bit 6), TOD 50 Hz (bit 7).",
    "Control B: start (bit 0), PB7 output (bit 1), toggle (bit 2), one-shot (bit 3), force load (bit 4), input (bits 5-6), TOD alarm write (bit 7).",
  ];
  return names.map((name, index) => e(base + index, base + index, name, `CIA ${number}: ${meanings[index]}`));
}

interface IoBlock {
  start: number;
  end: number;
  area: string;
  /** Registers repeat every `period` bytes. */
  period: number;
  registers: Entry[];
}

export const IO: IoBlock[] = [
  { start: 0xd000, end: 0xd3ff, area: "VIC-II registers", period: 0x40, registers: VIC },
  { start: 0xd400, end: 0xd7ff, area: "SID registers", period: 0x20, registers: SID },
  { start: 0xdc00, end: 0xdcff, area: "CIA 1 registers", period: 0x10, registers: cia(0xdc00, 1) },
  { start: 0xdd00, end: 0xddff, area: "CIA 2 registers", period: 0x10, registers: cia(0xdd00, 2) },
];

const AREAS: Array<{ start: number; end: number; area: string; kind: Lookup["kind"]; meaning: string }> = [
  { start: 0x0000, end: 0x00ff, area: "zero page", kind: "platform", meaning: "Zero page. The system uses most of it; $FB-$FE are free." },
  { start: 0x0100, end: 0x03ff, area: "system area", kind: "platform", meaning: "Stack and system variables." },
  { start: 0x0400, end: 0x07ff, area: "screen memory", kind: "platform", meaning: "Default screen memory and sprite pointers." },
  { start: 0x0800, end: 0x9fff, area: "BASIC program RAM", kind: "application", meaning: "RAM for programs; a BASIC program starts at $0801. The application decides what is here." },
  { start: 0xa000, end: 0xbfff, area: "BASIC ROM or RAM", kind: "application", meaning: "BASIC ROM when $01 bits 0 and 1 are set, else RAM. RAM under the ROM is application memory." },
  { start: 0xc000, end: 0xcfff, area: "free RAM", kind: "application", meaning: "Free RAM. The application decides what is here." },
  { start: 0xd800, end: 0xdbff, area: "color RAM", kind: "platform", meaning: "Color RAM: one 4-bit color for each screen character (I/O visible)." },
  { start: 0xde00, end: 0xdeff, area: "I/O 1", kind: "platform", meaning: "I/O area 1 for cartridges and expansions." },
  { start: 0xdf00, end: 0xdfff, area: "I/O 2", kind: "platform", meaning: "I/O area 2 for cartridges and expansions." },
  { start: 0xe000, end: 0xffff, area: "KERNAL ROM or RAM", kind: "platform", meaning: "KERNAL ROM when $01 bit 1 is set, else RAM." },
];

const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

/** The platform meaning of one address, or its application area. */
export function lookup(address: number): Lookup {
  for (const block of IO) {
    if (address < block.start || address > block.end) continue;
    const base = block.start + ((address - block.start) % block.period);
    const register = block.registers.find((entry) => entry.start === base);
    const mirror = base !== address ? { mirrorOf: base } : {};
    if (register === undefined) return { address, kind: "platform", area: block.area, meaning: `Unused register (${hex(base)}): reads give no useful value.`, ...mirror };
    return { address, kind: "platform", area: block.area, name: register.name, meaning: register.meaning, ...mirror };
  }
  const entry = [...SYSTEM, ...ROM].find((candidate) => address >= candidate.start && address <= candidate.end);
  const area = AREAS.find((candidate) => address >= candidate.start && address <= candidate.end)!;
  if (entry !== undefined) {
    return { address, kind: "platform", area: area.area, name: entry.name, meaning: entry.meaning, ...(entry.start !== address ? { entryStart: entry.start } : {}) };
  }
  return { address, kind: area.kind, area: area.area, meaning: area.meaning };
}

export type Decoded = Record<string, unknown>;

const bits = (value: number) => [0, 1, 2, 3, 4, 5, 6, 7].filter((bit) => (value & (1 << bit)) !== 0);

/** The VIC-II bank from a $DD00 value. */
export function vicBank(dd00: number): { bank: number; start: number; end: number } {
  const bank = 3 - (dd00 & 0x03);
  return { bank, start: bank * 0x4000, end: bank * 0x4000 + 0x3fff };
}

/** What a value in a platform register means. `dd00` gives the VIC-II bank for $D018. */
export function decode(register: number, value: number, dd00?: number): Decoded {
  switch (register) {
    case 0x01: {
      const config = value & 0x07;
      const ram = "RAM";
      const a000 = (config & 0x03) === 0x03 ? "BASIC ROM" : ram;
      const d000 = (config & 0x03) === 0 ? ram : config & 0x04 ? "I/O" : "character ROM";
      const e000 = config & 0x02 ? "KERNAL ROM" : ram;
      return { loram: (value & 1) === 1, hiram: (value & 2) === 2, charen: (value & 4) === 4, $a000: a000, $d000: d000, $e000: e000, note: "Valid when $00 sets bits 0-2 as outputs (default $2F)." };
    }
    case 0xd011: {
      return {
        yScroll: value & 0x07,
        rows: value & 0x08 ? 25 : 24,
        displayEnabled: (value & 0x10) !== 0,
        bitmapMode: (value & 0x20) !== 0,
        extendedColorMode: (value & 0x40) !== 0,
        rasterBit8: (value & 0x80) >> 7,
      };
    }
    case 0xd016:
      return { xScroll: value & 0x07, columns: value & 0x08 ? 40 : 38, multicolorMode: (value & 0x10) !== 0 };
    case 0xd018: {
      const screen = ((value >> 4) & 0x0f) * 0x400;
      const characters = ((value >> 1) & 0x07) * 0x800;
      const bitmap = value & 0x08 ? 0x2000 : 0x0000;
      const result: Decoded = { screenOffset: hex(screen), characterOffset: hex(characters), bitmapOffset: hex(bitmap) };
      if (dd00 !== undefined) {
        const bank = vicBank(dd00);
        result.bank = bank.bank;
        result.screen = hex(bank.start + screen);
        result.characters = hex(bank.start + characters);
        result.bitmap = hex(bank.start + bitmap);
        if (bank.bank === 0 || bank.bank === 2) result.note = "In banks 0 and 2 the VIC-II sees the character ROM at offsets $1000-$1FFF.";
      } else {
        result.note = "Offsets are inside the VIC-II bank; give --bank with the $DD00 value for addresses.";
      }
      return result;
    }
    case 0xdd00: {
      const bank = vicBank(value);
      return { vicBank: bank.bank, vicAddresses: `${hex(bank.start)}-${hex(bank.end)}` };
    }
    case 0xd015:
    case 0xd017:
    case 0xd01b:
    case 0xd01c:
    case 0xd01d:
    case 0xd01e:
    case 0xd01f:
    case 0xd010:
      return { sprites: bits(value) };
    case 0xd019:
    case 0xd01a: {
      const names = ["raster", "sprite-background collision", "sprite-sprite collision", "light pen"];
      const result: Decoded = { sources: bits(value & 0x0f).map((bit) => names[bit]) };
      if (register === 0xd019) result.anyInterrupt = (value & 0x80) !== 0;
      return result;
    }
    case 0xdc0d:
    case 0xdd0d: {
      const names = ["timer A", "timer B", "TOD alarm", "serial port", "FLAG line"];
      const sources = bits(value & 0x1f).map((bit) => names[bit]);
      return {
        read: { sources, interruptOccurred: (value & 0x80) !== 0 },
        write: { [(value & 0x80) !== 0 ? "enables" : "disables"]: sources },
        line: register === 0xdc0d ? "IRQ" : "NMI",
      };
    }
    default:
      throw new RangeError(`no decoder for ${hex(register)}; decoders exist for $0001, $d010, $d011, $d015-$d01f (sprite and interrupt bits), $d016, $d018, $dc0d, $dd00 and $dd0d`);
  }
}
