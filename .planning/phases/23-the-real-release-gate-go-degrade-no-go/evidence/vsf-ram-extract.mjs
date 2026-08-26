#!/usr/bin/env node
// vsf-ram-extract.mjs -- extract the flat 64K RAM array from a VICE .vsf snapshot,
// and (with two snapshots) classify the byte differences between them.
//
// WHY THIS EXISTS: 23-03 could not assemble a flat 64K capture because reading 64 KB
// out of the emulator as hex and reassembling it is unreliable -- one 32 KB write
// truncated mid-payload and one 8 KB write silently dropped ten characters. A .vsf
// snapshot already contains the exact 64K, so there is no transcription step to get
// wrong. This script reads the file; it never talks to the emulator.
//
// .vsf layout: "VICE Snapshot File\x1a" (19 bytes) + 2 version bytes + 16-byte machine
// name, then modules. Each module is a 16-byte NUL-padded name, 1 major, 1 minor, and a
// 4-byte little-endian size covering the WHOLE module including its 22-byte header.
//
// The C64MEM module body is 4 bytes of port/PLA state followed by exactly 65536 bytes
// of RAM.
//
// IMPORTANT: RAM[$00] and RAM[$01] are the UNDERLYING RAM bytes. A CPU-view read of
// $0000/$0001 (vice_memory_read) returns the 6510 processor-port registers instead, so
// those two addresses are the only place a snapshot-derived image legitimately differs
// from a memory-read transcript. Verified 2026-08-26 against 23-03's own hand-transcribed
// hex: $2000-$3FFF and $4000-$5FFF byte-identical, $0000-$1FFF differing at exactly
// $0000 and $0001.
//
// Difference classification follows compare.mjs's published rule, which this script does
// not reimplement beyond the popcount split it states: exactly one differing bit is
// "drift" (passes), two or more bits is "divergence" (fails the comparison).

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MAGIC = "VICE Snapshot File\x1a";
const RAM_SIZE = 65536;
const C64MEM_PREAMBLE = 4;

export function extractRam(path) {
  const f = readFileSync(path);
  let off = MAGIC.length + 2 + 16;
  while (off + 22 <= f.length) {
    const name = f.subarray(off, off + 16).toString("latin1").replace(/\0+$/, "");
    const size = f.readUInt32LE(off + 18);
    if (!/^[\x20-\x7e]+$/.test(name) || size < 22 || off + size > f.length) { off++; continue; }
    if (name === "C64MEM") {
      const start = off + 22 + C64MEM_PREAMBLE;
      const ram = f.subarray(start, start + RAM_SIZE);
      if (ram.length !== RAM_SIZE) {
        throw new Error(`C64MEM RAM is ${ram.length} bytes, want ${RAM_SIZE} -- refusing a short read`);
      }
      return Buffer.from(ram);
    }
    off += size;
  }
  throw new Error(`C64MEM module not found in ${path}`);
}

function popcount(x) {
  let n = 0;
  while (x) { n += x & 1; x >>= 1; }
  return n;
}

export function classify(a, b) {
  const drift = [], divergence = [];
  for (let i = 0; i < RAM_SIZE; i++) {
    if (a[i] === b[i]) continue;
    (popcount(a[i] ^ b[i]) === 1 ? drift : divergence).push(i);
  }
  return { drift, divergence };
}

const hex4 = (a) => "$" + a.toString(16).padStart(4, "0");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: vsf-ram-extract.mjs <a.vsf> [b.vsf] [--write-bin <path>]");
  process.exit(2);
}

const writeIdx = args.indexOf("--write-bin");
const writeTo = writeIdx >= 0 ? args[writeIdx + 1] : null;
// Guard the -1 case explicitly: with no --write-bin, `writeIdx + 1` is 0 and a bare
// `i !== writeIdx + 1` silently drops the FIRST snapshot, turning a two-snapshot
// comparison into a one-snapshot dump with no error. Observed and fixed 2026-08-26.
const valueIdx = writeIdx >= 0 ? writeIdx + 1 : -1;
const snaps = args.filter((a, i) => !a.startsWith("--") && i !== valueIdx);
if (snaps.length === 0) {
  console.error("Error: no snapshot path given.");
  process.exit(2);
}

const first = extractRam(snaps[0]);
console.log(`SNAPSHOT_A: ${snaps[0]}`);
console.log(`SNAPSHOT_A_SIZE: ${first.length}`);
console.log(`SNAPSHOT_A_SHA256: ${createHash("sha256").update(first).digest("hex")}`);
if (writeTo) { writeFileSync(writeTo, first); console.log(`WROTE_BIN: ${writeTo}`); }

if (snaps.length > 1) {
  const second = extractRam(snaps[1]);
  console.log(`SNAPSHOT_B: ${snaps[1]}`);
  console.log(`SNAPSHOT_B_SIZE: ${second.length}`);
  console.log(`SNAPSHOT_B_SHA256: ${createHash("sha256").update(second).digest("hex")}`);
  const { drift, divergence } = classify(first, second);
  console.log(`DIFF_TOTAL_BYTES: ${drift.length + divergence.length}`);
  console.log(`DIFF_DRIFT_ONE_BIT: ${drift.length}`);
  console.log(`DIFF_DIVERGENCE_MULTI_BIT: ${divergence.length}`);
  console.log(`DIFF_DIVERGENCE_IN_IO_SHADOW: ${divergence.filter((x) => x >= 0xd000 && x <= 0xdfff).length}`);
  console.log(`DIFF_FIRST_DIVERGENCES: ${divergence.slice(0, 12).map(hex4).join(" ")}`);
  console.log(`DIFF_VERDICT: ${divergence.length === 0 ? "equivalent" : "not-equivalent"}`);
}
