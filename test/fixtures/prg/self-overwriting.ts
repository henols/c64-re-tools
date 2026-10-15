// A release in the shape of a cracked game (F-17): a "1993 SYS π*656" line
// with the start code right after it and no end marker; a stub that copies a
// mover to $0340 and jumps there; the mover copies the payload to $0801, over
// the stub; the payload copies its last part over its own start code and
// jumps to it. The stages are $080c, $0340, $0801 and $0801 again.

const MOVER = 0x081c;
const MOVER_SIZE = 64;
const PAYLOAD = MOVER + MOVER_SIZE;

const pad = (bytes: number[], size: number) => [...bytes, ...new Array<number>(size - bytes.length).fill(0xea)];

/** Runs at $0340: copies 256 payload bytes to $0801 and jumps there. */
const mover = pad(
  [
    0xa2, 0x00, // $0340 LDX #$00
    0xbd, PAYLOAD & 0xff, PAYLOAD >> 8, // $0342 LDA payload,X
    0x9d, 0x01, 0x08, // $0345 STA $0801,X
    0xe8, // $0348 INX
    0xd0, 0xf7, // $0349 BNE $0342
    0x4c, 0x01, 0x08, // $034b JMP $0801
  ],
  MOVER_SIZE,
);

/** The last program: it counts the border colour up. */
const last = pad([0xee, 0x20, 0xd0, 0x4c, 0x01, 0x08], 0x40);

/** Runs at $0801: copies the last program from $0880 over $0801-$0840 with a loop at $0850, then jumps to $0801. */
const payload = new Array<number>(256).fill(0xea);
payload.splice(0x00, 3, 0x4c, 0x50, 0x08); // $0801 JMP $0850
payload.splice(0x4f, 16, 0xa2, 0x00, 0xbd, 0x80, 0x08, 0x9d, 0x01, 0x08, 0xe8, 0xe0, 0x40, 0xd0, 0xf5, 0x4c, 0x01, 0x08); // $0850
payload.splice(0x7f, last.length, ...last); // $0880

export const selfOverwritingPrg = Uint8Array.from([
  0x01, 0x08, // load address $0801
  0x0c, 0x08, 0xc9, 0x07, 0x9e, 0xff, 0xac, 0x36, 0x35, 0x36, 0x00, // 1993 SYS π*656
  0xa2, 0x00, // $080c LDX #$00
  0xbd, MOVER & 0xff, MOVER >> 8, // $080e LDA mover,X
  0x9d, 0x40, 0x03, // $0811 STA $0340,X
  0xe8, // $0814 INX
  0xe0, MOVER_SIZE, // $0815 CPX #size
  0xd0, 0xf5, // $0817 BNE $080e
  0x4c, 0x40, 0x03, // $0819 JMP $0340
  ...mover, // $081c
  ...payload, // $085c
]);
