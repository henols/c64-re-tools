#!/usr/bin/env node
// Compare 65536-byte C64 RAM captures and classify every difference.
//
// Pure logic. This module reads files the agent already captured and does
// arithmetic over them. It contacts nothing: the mcp__plugin_c64-rc-tools_vice__* tools are the
// only route to the emulator (.claude/CLAUDE.md § Emulator Access), and
// nothing here opens a connection, reads broker state, or shells out.
//
// The classification rules are the ones c64-ram-capture/SKILL.md states, and
// they live here so they are applied identically every time instead of being
// re-derived by hand per session:
//
//   volatile   $0000-$0001, $0100-$01FF, $0200-$03FF, $D000-$DFFF -- counted,
//              reported, excluded from the verdict
//   drift      exactly one bit differs -- listed as a candidate, does not fail
//   divergence two or more bits differ -- listed, and fails the comparison
//
// $D000-$DFFF is this module's one departure from what SKILL.md said when it was
// written: that range is I/O, not RAM, so it can never be stable. See the VOLATILE
// table below and .planning/RE-FINDINGS.md (2026-08-04) for the evidence.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";

const IMAGE_BYTES = 65536;

// Volatile spans, inclusive. A difference inside these is expected on any two
// captures of the same checkpoint and never fails a comparison.
const VOLATILE = [
  [0x0000, 0x0001], // CPU port
  [0x0100, 0x01ff], // stack page
  [0x0200, 0x03ff], // KERNAL work area / BASIC input buffer
  // $D000-$DFFF is I/O, not RAM: the VIC's registers repeat every $40 across
  // $D000-$D3FF and the SID's across $D400-$D7FF, so reading this range samples
  // live hardware and two captures can never agree here. Added 2026-08-04 after
  // every divergence across all six committed gameentry pairings landed either
  // here ($D344, $D625, $D628) or in RAM under KERNAL ROM -- see
  // .planning/RE-FINDINGS.md, 2026-08-04. Confidence HIGH: structural.
  [0xd000, 0xdfff],
];

// Deliberately NOT volatile: $E000-$FFFF (RAM under KERNAL ROM when HIRAM=0).
// $FAD8 and $FC51 do differ across captures, but only 2 addresses out of 8192 --
// far too few for power-on garbage, and unexplained. Blanket-excluding 8 KB on
// two data points would hide real divergence, so these still fail and the
// capture record carries the explanation. Confidence MEDIUM, see the same entry.

const isVolatile = (a) => VOLATILE.some(([lo, hi]) => a >= lo && a <= hi);

const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n) => "$" + n.toString(16).toUpperCase().padStart(2, "0");
const bin8 = (n) => "%" + n.toString(2).padStart(8, "0");

const popcount = (n) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};

function loadImage(path) {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(
      `${path}: ${buf.length} bytes, expected ${IMAGE_BYTES} — not a full 64K image`,
    );
  }
  return buf;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * Classify every differing address between two images.
 * Returns { volatile[], drift[], divergence[], pass } — the three lists
 * SKILL.md requires, plus the verdict.
 */
function compare(a, b) {
  const volatile_ = [];
  const drift = [];
  const divergence = [];

  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = a[addr];
    const y = b[addr];
    if (x === y) continue;

    const bits = popcount(x ^ y);
    const rec = { addr, a: x, b: y, bits };

    // Volatile wins over bit-count: an address in a volatile span is excluded
    // from the verdict regardless of how many bits moved.
    if (isVolatile(addr)) volatile_.push(rec);
    else if (bits === 1) drift.push(rec);
    else divergence.push(rec);
  }

  return { volatile: volatile_, drift, divergence, pass: divergence.length === 0 };
}

const fmtRow = (r) =>
  `  ${hex4(r.addr)}  ${hex2(r.a)} ${bin8(r.a)}  ->  ${hex2(r.b)} ${bin8(r.b)}   ${r.bits} bit${r.bits === 1 ? "" : "s"}`;

function printList(title, rows, limit) {
  console.log(`\n${title}: ${rows.length}`);
  if (!rows.length) return;
  // --limit 0 means unlimited, matching the usage text. Anything else caps.
  const shown = limit ? rows.slice(0, limit) : rows;
  for (const r of shown) console.log(fmtRow(r));
  if (shown.length < rows.length) {
    console.log(`  … ${rows.length - shown.length} more (--limit 0 for all)`);
  }
}

function cmdCompare(argv) {
  const limit = limitFrom(argv);
  const paths = argv.filter((s) => !s.startsWith("--") && !/^\d+$/.test(s));
  if (paths.length !== 2) throw new Error("compare needs exactly two image paths");

  const [pa, pb] = paths;
  const a = loadImage(pa);
  const b = loadImage(pb);

  const ha = sha256(a);
  const hb = sha256(b);

  console.log(`A  ${basename(pa)}  sha256 ${ha}`);
  console.log(`B  ${basename(pb)}  sha256 ${hb}`);

  if (ha === hb) {
    console.log("\nIDENTICAL — the two images are byte-for-byte equal.");
    console.log("\nVERDICT: PASS");
    return 0;
  }

  const r = compare(a, b);

  printList("volatile (excluded from the verdict)", r.volatile, limit);
  printList("drift — exactly one bit, reported as candidates", r.drift, limit);
  printList("DIVERGENCE — two or more bits, fails the comparison", r.divergence, limit);

  const total = r.volatile.length + r.drift.length + r.divergence.length;
  console.log(`\ntotal differing addresses: ${total} of ${IMAGE_BYTES}`);
  console.log(`\nVERDICT: ${r.pass ? "PASS" : "FAIL"}`);
  if (r.pass && r.drift.length) {
    console.log("Drift candidates present — pass, but record them with the capture.");
  }
  return r.pass ? 0 : 1;
}

/**
 * Drift floor across N captures of the same checkpoint: every address that
 * differed in ANY pairing. Reported as a floor, never as a complete set —
 * more captures can only widen it.
 */
function cmdFloor(argv) {
  const limit = limitFrom(argv);
  const paths = argv.filter((s) => !s.startsWith("--") && !/^\d+$/.test(s));
  if (paths.length < 2) throw new Error("floor needs at least two image paths");

  const imgs = paths.map((p) => ({ path: p, buf: loadImage(p) }));
  for (const i of imgs) console.log(`${basename(i.path)}  sha256 ${sha256(i.buf)}`);

  const floor = new Map(); // addr -> Set of distinct values seen
  let worstPair = null;

  for (let i = 0; i < imgs.length; i++) {
    for (let j = i + 1; j < imgs.length; j++) {
      const r = compare(imgs[i].buf, imgs[j].buf);
      for (const rec of [...r.volatile, ...r.drift, ...r.divergence]) {
        if (!floor.has(rec.addr)) floor.set(rec.addr, new Set());
        floor.get(rec.addr).add(rec.a);
        floor.get(rec.addr).add(rec.b);
      }
      const label = `${basename(imgs[i].path)} vs ${basename(imgs[j].path)}`;
      console.log(
        `\n${label}: ${r.volatile.length} volatile, ${r.drift.length} drift, ${r.divergence.length} divergence -> ${r.pass ? "PASS" : "FAIL"}`,
      );
      if (!r.pass && (!worstPair || r.divergence.length > worstPair.n)) {
        worstPair = { label, n: r.divergence.length };
      }
    }
  }

  const addrs = [...floor.keys()].sort((x, y) => x - y);
  const vol = addrs.filter(isVolatile).length;

  console.log(`\nDRIFT FLOOR: ${addrs.length} addresses (${vol} inside volatile spans)`);
  const shown = limit === 0 ? addrs : addrs.slice(0, limit || 40);
  for (const a of shown) {
    const vals = [...floor.get(a)].sort((p, q) => p - q).map(hex2).join(" / ");
    console.log(`  ${hex4(a)}${isVolatile(a) ? "  [volatile]" : "            "}  ${vals}`);
  }
  if (shown.length < addrs.length) {
    console.log(`  … ${addrs.length - shown.length} more (--limit 0 for all)`);
  }

  console.log(
    "\nThis is a FLOOR, not a complete set — more captures of the same checkpoint can only widen it.",
  );
  if (worstPair) {
    const n = worstPair.n;
    console.log(`Worst pairing: ${worstPair.label} (${n} divergence${n === 1 ? "" : "s"}).`);
  }
  return 0;
}

/** SHA-256 and size of each image, for recording alongside a capture. */
function cmdDigest(argv) {
  const paths = argv.filter((s) => !s.startsWith("--"));
  if (!paths.length) throw new Error("digest needs at least one image path");
  for (const p of paths) {
    const buf = readFileSync(p);
    const ok = buf.length === IMAGE_BYTES;
    console.log(
      `${sha256(buf)}  ${buf.length} bytes${ok ? "" : "  *** NOT 65536 — not a full image ***"}  ${basename(p)}`,
    );
  }
  return 0;
}

function limitFrom(argv) {
  const i = argv.indexOf("--limit");
  if (i < 0) return undefined;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 0) throw new Error("--limit needs a non-negative integer");
  return n;
}

const commands = { compare: cmdCompare, floor: cmdFloor, digest: cmdDigest };

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.error(`usage: node compare.mjs <command>

  compare <a.bin> <b.bin> [--limit N]   classify every difference, print a verdict
  floor <a.bin> <b.bin> [...] [--limit N]   drift floor across N captures of one checkpoint
  digest <image.bin>...                 sha256 + size, for the capture record

Volatile (counted, excluded from the verdict): $0000-$0001, $0100-$01FF, $0200-$03FF, $D000-$DFFF.
$D000-$DFFF is I/O, not RAM — reading it samples live hardware, so it can never be stable.
One differing bit is drift and passes; two or more is divergence and fails.
--limit 0 prints every row. Exit status is 1 on a FAIL verdict.

Images come from the capture procedure in this skill's SKILL.md, via mcp__plugin_c64-rc-tools_vice__*.
This script contacts nothing.`);
  process.exit(cmd ? 1 : 0);
}

try {
  process.exit(commands[cmd](rest));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
