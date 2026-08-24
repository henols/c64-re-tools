// Derive the graphics memory map from the VIC pointer values Ghidra recovered.
// Inputs are exactly what appeared in the decompiler output for vic.a.
const dd00_written = 0b10;   // from: DAT_dd00 = bVar1 & 0xfc | 2
const d018        = 0x18;    // from: DAT_d018 = 0x18
const d011_bmm    = false;   // from: DAT_d011 = bVar1 & 0xdf  (bit5 cleared)

// $DD00 bits 0-1 select the VIC bank, INVERTED.
const bank = (3 - (dd00_written & 3)) * 0x4000;

// $D018 bits 4-7 = screen matrix, in $0400 steps within the bank.
const screen = bank + ((d018 >> 4) & 0x0f) * 0x0400;
// $D018 bits 1-3 = charset base, in $0800 steps. In bitmap mode bit 3 alone
// selects the bitmap in $2000 steps instead.
const charset = bank + ((d018 >> 1) & 0x07) * 0x0800;
const bitmap  = bank + (((d018 >> 3) & 1) * 0x2000);

const hex = n => "$" + n.toString(16).padStart(4,"0");
console.log(`VIC bank      ${hex(bank)}-${hex(bank+0x3fff)}`);
console.log(`screen matrix ${hex(screen)}-${hex(screen+999)}   (1000 bytes)  -> mark DATA`);
if (d011_bmm) console.log(`bitmap        ${hex(bitmap)}-${hex(bitmap+0x1f3f)}  (8000 bytes) -> mark DATA`);
else          console.log(`charset       ${hex(charset)}-${hex(charset+0x07ff)}   (2048 bytes) -> mark DATA`);
console.log(`sprite ptrs   ${hex(screen+0x03f8)}-${hex(screen+0x03ff)}   (8 bytes, screen+$3F8)`);
