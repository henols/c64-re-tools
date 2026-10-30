// The start screen of a captured stage from the entry state of the capture:
// the mode, the addresses and the colours from the VIC-II and the VIC bank,
// and the colour RAM; refusals for a capture that shows no start screen.

import assert from "node:assert/strict";
import { test } from "node:test";

import { capturedColourRam, coloursOfCapture, startScreenOfCapture, startScreenOfStage } from "./start-screen.ts";

/** An entry state with the VIC-II values, $dd00 and the colour RAM: colour n at place n mod 16, one colour for all, or none. */
function captured(values: { d011: number; d016: number; d018: number; dd00: number; colour?: false | number }): Record<string, unknown> {
  const vic = new Uint8Array(0x2f);
  vic[0x11] = values.d011;
  vic[0x16] = values.d016;
  vic[0x18] = values.d018;
  vic[0x20] = 0xf3; // the high bits of a colour register read as 1
  vic[0x21] = 0xf1;
  const io: Record<string, { from: string; bytes: string }> = {
    vic: { from: "$d000", bytes: Buffer.from(vic).toString("hex") },
    cia2: { from: "$dd00", bytes: Buffer.from([values.dd00, 0x3f]).toString("hex") },
  };
  const { colour } = values;
  if (colour !== false) io.colour = { from: "$d800", bytes: Buffer.from(Array.from({ length: 1000 }, (_, index) => 0xf0 | (colour ?? index & 0x0f))).toString("hex") };
  return { registers: { pc: "$9000" }, io };
}

test("a multicolour bitmap in VIC bank 3, a text screen with its charset and a hires bitmap come from the VIC-II and the VIC bank", () => {
  // Exploding Fist: $dd00 bits 0-1 are 0 (bank 3), $d018 = $38: the screen at $cc00 and the bitmap at $e000.
  assert.deepEqual(startScreenOfStage(captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0x00 }), "bank1"), { mode: "multicolour", screen: 0xcc00, bitmap: 0xe000, border: 3, background: 1, colourRam: true });
  // Bank 0 with the screen at $0400 and the character ROM at $1000.
  assert.deepEqual(startScreenOfStage(captured({ d011: 0x1b, d016: 0x08, d018: 0x14, dd00: 0x03 }), "bank1"), { mode: "text", screen: 0x0400, charset: 0x1000, border: 3, background: 1, colourRam: true });
  // A hires bitmap has no colour RAM: it needs none, also when the capture has none.
  assert.deepEqual(startScreenOfStage(captured({ d011: 0x3b, d016: 0x08, d018: 0x78, dd00: 0x02, colour: false }), "bank1"), { mode: "hires", screen: 0x5c00, bitmap: 0x6000, border: 3, background: 1 });
});

test("the colour RAM of a capture has 1000 colours of 4 bits", () => {
  const colours = capturedColourRam(captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0 }))!;
  assert.equal(colours.length, 1000);
  assert.deepEqual([...colours.subarray(0, 3)], [0, 1, 2]);
  assert.equal(capturedColourRam(captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0, colour: false })), undefined);
});

test("a capture that shows no start screen is refused by name", () => {
  assert.throws(() => startScreenOfStage(undefined, "bank1"), /no entry state with the VIC-II and CIA 2\. Capture the stage again while it shows the screen/);
  assert.throws(() => startScreenOfStage(captured({ d011: 0x0b, d016: 0x18, d018: 0x38, dd00: 0 }), "bank1"), /the display off \(\$d011 = \$0b\)/);
  assert.throws(() => startScreenOfStage(captured({ d011: 0x5b, d016: 0x08, d018: 0x14, dd00: 3 }), "bank1"), /extended colour mode/);
  assert.throws(() => startScreenOfStage(captured({ d011: 0x1b, d016: 0x18, d018: 0x14, dd00: 3 }), "bank1"), /multicolour text screen/);
  assert.throws(() => startScreenOfStage(captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0, colour: false }), "bank1"), /has no colour RAM: it is from an older version/);
});

test("a capture of the program gives the screen, and its colours as 1000 bytes of the program or as one colour", () => {
  const state = captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0x00 });
  assert.deepEqual(startScreenOfCapture(state, "c/image.json"), { mode: "multicolour", screen: 0xcc00, bitmap: 0xe000, border: 3, background: 1 });
  assert.throws(() => startScreenOfCapture(undefined, "c/image.json"), /The capture c\/image\.json has no entry state with the VIC-II and CIA 2\. Capture the program again while it shows the screen/);
  // The colours at $4000 with other high bits; the copy at $3000 differs in its last byte, and the one at $d000 is in the I/O area.
  const program = new Map<number, number>();
  for (let index = 0; index < 1000; index++) {
    program.set(0x3000 + index, index === 999 ? 0 : index & 0x0f);
    program.set(0x4000 + index, 0x50 | (index & 0x0f));
    program.set(0xd000 + index, index & 0x0f);
  }
  assert.deepEqual(coloursOfCapture(state, "c/image.json", (address) => program.get(address)), { colours: 0x4000 });
  for (let index = 0; index < 1000; index++) program.delete(0x4000 + index);
  assert.throws(() => coloursOfCapture(state, "c/image.json", (address) => program.get(address)), /has more than one colour, and the program of the knowledge has no 1000 bytes with these colours/);
  assert.deepEqual(coloursOfCapture(captured({ d011: 0x3b, d016: 0x18, d018: 0x38, dd00: 0x00, colour: 6 }), "c/image.json", () => undefined), { colour: 6 });
});
