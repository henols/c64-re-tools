// Decodes C64 chip registers (VIC-II, CIA, SID) into the protocol's chip state shapes.
// Input bytes are register values as VICE's monitor reads them from the I/O
// bank without side effects; the SID's write-only registers read back as
// last written.

import { d018Offsets, vicBankBase } from "../../c64.ts";
import type { CiaState, SidState, SpriteState, ViciiMode, ViciiState } from "../../protocol.ts";

export function viciiMode(d011: number, d016: number): ViciiMode {
  const ecm = (d011 & 0x40) !== 0;
  const bmm = (d011 & 0x20) !== 0;
  const mcm = (d016 & 0x10) !== 0;
  if (!ecm && !bmm) return mcm ? "multicolor-text" : "text";
  if (!ecm && bmm) return mcm ? "multicolor-bitmap" : "bitmap";
  if (ecm && !bmm && !mcm) return "extended-color-text";
  return "invalid";
}

/** `vic` holds $d000-$d02e; `cia2` holds $dd00-$dd0f. */
export function decodeVicii(vic: Uint8Array, cia2: Uint8Array): ViciiState {
  const d011 = vic[0x11]!;
  const d016 = vic[0x16]!;
  const offsets = d018Offsets(vic[0x18]!);
  const mode = viciiMode(d011, d016);
  const base = vicBankBase(cia2[0x00]!, cia2[0x02]!);
  const bitmap = mode === "bitmap" || mode === "multicolor-bitmap";
  return {
    rasterLine: ((d011 & 0x80) << 1) | vic[0x12]!,
    mode,
    screenAddress: base + offsets.screen,
    graphicsAddress: base + (bitmap ? offsets.bitmap : offsets.characters),
    scrollX: d016 & 0x07,
    scrollY: d011 & 0x07,
    borderColor: vic[0x20]! & 0x0f,
    backgroundColors: [vic[0x21]! & 0x0f, vic[0x22]! & 0x0f, vic[0x23]! & 0x0f, vic[0x24]! & 0x0f],
  };
}

/** `pointers` holds the eight sprite pointer bytes at screen + $3f8. */
export function decodeSprite(index: number, vic: Uint8Array, cia2: Uint8Array, pointers: Uint8Array): SpriteState {
  const bit = (register: number) => (vic[register]! & (1 << index)) !== 0;
  return {
    index,
    x: vic[index * 2]! + (bit(0x10) ? 256 : 0),
    y: vic[index * 2 + 1]!,
    enabled: bit(0x15),
    color: vic[0x27 + index]! & 0x0f,
    multicolor: bit(0x1c),
    expandX: bit(0x1d),
    expandY: bit(0x17),
    behindBackground: bit(0x1b),
    dataAddress: vicBankBase(cia2[0x00]!, cia2[0x02]!) + pointers[index]! * 64,
  };
}

function bcd(value: number): number {
  return (value >> 4) * 10 + (value & 0x0f);
}

/** `registers` holds $dc00-$dc0f or $dd00-$dd0f. TOD hours become 0-23. */
export function decodeCia(id: 1 | 2, registers: Uint8Array): CiaState {
  const word = (low: number) => registers[low]! | (registers[low + 1]! << 8);
  const hourRegister = registers[0x0b]!;
  const pm = (hourRegister & 0x80) !== 0;
  return {
    id,
    portA: registers[0x00]!,
    portB: registers[0x01]!,
    ddrA: registers[0x02]!,
    ddrB: registers[0x03]!,
    timerA: word(0x04),
    timerB: word(0x06),
    controlA: registers[0x0e]!,
    controlB: registers[0x0f]!,
    interruptStatus: registers[0x0d]!,
    tod: {
      hours: (bcd(hourRegister & 0x1f) % 12) + (pm ? 12 : 0),
      minutes: bcd(registers[0x0a]! & 0x7f),
      seconds: bcd(registers[0x09]! & 0x7f),
      tenths: registers[0x08]! & 0x0f,
    },
  };
}

/** `registers` holds $d400-$d418. */
export function decodeSid(registers: Uint8Array): SidState {
  const voices = [0, 1, 2].map((voice) => {
    const at = voice * 7;
    return {
      index: voice + 1,
      frequency: registers[at]! | (registers[at + 1]! << 8),
      pulseWidth: registers[at + 2]! | ((registers[at + 3]! & 0x0f) << 8),
      control: registers[at + 4]!,
      attackDecay: registers[at + 5]!,
      sustainRelease: registers[at + 6]!,
    };
  });
  return {
    voices,
    filter: {
      cutoff: (registers[0x15]! & 0x07) | (registers[0x16]! << 3),
      resonance: registers[0x17]! >> 4,
      routing: registers[0x17]! & 0x0f,
      mode: registers[0x18]! >> 4,
    },
    volume: registers[0x18]! & 0x0f,
  };
}
