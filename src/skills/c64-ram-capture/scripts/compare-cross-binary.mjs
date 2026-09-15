#!/usr/bin/env node
// Cross-binary RAM/chip-state comparison: classify every difference between
// two captures of DIFFERENT binaries and print a single VERDICT line.
//
// Pure logic. This module reads files the agent already produced and does
// arithmetic over them. It contacts nothing: the mcp__plugin_c64-re-tools_vice__*
// tools are the only route to the emulator (.claude/CLAUDE.md § Emulator
// Access), and nothing here opens a connection, reads broker state, or shells
// out.
//
// The narrowed volatile mask below is committed here, in this commit, before
// any rebuild is compared under it (ROADMAP Phase 50 criterion 1). The mask
// may be narrowed further later. It must never be widened just to make a
// rebuild pass -- the same discipline `compare.mjs` and `derive-transients.mjs`
// already carry for their own masks/allow-lists.
//
// This is a SIBLING of `compare.mjs`, not an extension of it. `compare.mjs`'s
// own rules -- a blanket $D000-$DFFF mask and a one-bit "drift" tolerance --
// are correct for its own job: two captures of the SAME binary at the same
// checkpoint. Both rules are wrong for this module's job, which is two
// captures of DIFFERENT binaries, where a one-bit difference at a masked
// address (e.g. `lda #$02` -> `lda #$03` ahead of `sta $d020`) is exactly the
// kind of regression a rebuild must not be allowed to hide. This module does
// not import from, edit, or re-export `compare.mjs`; its rules stay frozen
// for its own, still-correct, same-binary job. The three-bucket shape and the
// classification core are duplicated here DELIBERATELY, not shared, so a
// future edit to one module's rules cannot silently change the other's.
//
// Three rule departures from compare.mjs, each load-bearing:
//
//   (a) NO DRIFT BUCKET. Across two different binaries a one-bit difference
//       is a real difference. `drift` exists to absorb sampling noise between
//       two runs of the SAME binary; applied across binaries it would absorb
//       an `lda #$02` to `lda #$03` regression whole. Every non-volatile
//       difference is a divergence here, regardless of bit count.
//   (b) NARROWED I/O MASK. `compare.mjs` masks $D000-$DFFF entirely. This
//       module masks only the addresses and register fields that genuinely
//       cannot be stable, listed individually below with a reason each.
//   (c) ROUTE AWARENESS. A capture carries a declared route of "snapshot" or
//       "memory-read". On the snapshot route the bytes at $D000-$DFFF in the
//       image are RAM under I/O, not the register read view (SKILL.md,
//       "Slice the image out of a snapshot instead of transcribing it"); on
//       the memory-read route they are the register read view. Comparing one
//       against the other is meaningless, so this module refuses the pair.
//
// Departure from compare.mjs's own CLI-dispatch shape: the dispatch tail at
// the bottom of this file is GUARDED
// (`if (process.argv[1] === fileURLToPath(import.meta.url))`), unlike
// compare.mjs's unguarded tail. This module exports IMAGE_VOLATILE and
// IO_VOLATILE for reuse by this file's own test file and by later Phase 50
// plans; an unguarded tail would call process.exit() the instant anything
// imports this module, killing whatever process did the importing.
// `dump-artifacts.mjs`, the newer script in this same directory, already
// carries the identical guard for the identical reason.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_BYTES = 65536;

// ---------------------------------------------------------------- IMAGE_VOLATILE

// Spans of the 64K image that are excluded from the verdict on every route.
// Carried forward from compare.mjs's own VOLATILE table, same reasons.
export const IMAGE_VOLATILE = [
  { lo: 0x0000, hi: 0x0001, reason: "CPU port" },
  { lo: 0x0100, hi: 0x01ff, reason: "stack page" },
  { lo: 0x0200, hi: 0x03ff, reason: "KERNAL work area / BASIC input buffer" },
];

// ------------------------------------------------------------------- IO_VOLATILE

// Register offsets and ranges that stay excluded, each with its own one-line
// hardware reason. The VIC-II only decodes 6 address bits, so its registers
// at $D000-$D02E mirror every $40 bytes across the whole $D000-$D3FF window
// -- entries here for that window are expressed as the CANONICAL address in
// the first $D000-$D03F block and folded across all sixteen mirrors by
// (addr & 0x3f) in isIoVolatile()/imageMaskEntryFor() below, so a regression
// at $D020 is caught at $D020 and at all fifteen of its mirrors.
//
// Everything else in $D000-$D3FF -- $D000-$D010, $D013-$D018, $D01A-$D01D
// and $D020-$D02E -- is deliberately NOT masked. $D015, $D018 and $D020 are
// the three ROADMAP criterion 1 names inside that carve-out.
const VIC_MIRRORED_VOLATILE = [
  {
    lo: 0xd011,
    hi: 0xd011,
    reason: "bit 7 is the raster counter's ninth bit, so the whole byte is masked",
  },
  { lo: 0xd012, hi: 0xd012, reason: "the raster counter" },
  { lo: 0xd019, hi: 0xd019, reason: "the interrupt latch" },
  { lo: 0xd01e, hi: 0xd01f, reason: "the collision latches, cleared by reading them" },
];

// Ranges outside the VIC-II mirrored window. These do not mirror the same
// way -- SID/colour-RAM/CIA/expansion each occupy their own flat span -- so
// no offset-folding applies; the whole range is excluded.
const FLAT_VOLATILE = [
  { lo: 0xd400, hi: 0xd7ff, reason: "SID is write-only in hardware, read-back is unrecoverable" },
  { lo: 0xd800, hi: 0xdbff, reason: "colour RAM whose high nibble is open bus" },
  {
    lo: 0xdc00,
    hi: 0xdcff,
    reason: "CIA1 -- timers, time-of-day and interrupt-control registers all move without the program touching them",
  },
  {
    lo: 0xdd00,
    hi: 0xddff,
    reason: "CIA2 -- timers, time-of-day and interrupt-control registers all move without the program touching them",
  },
  { lo: 0xde00, hi: 0xdfff, reason: "I/O expansion area and reads open bus" },
];

export const IO_VOLATILE = [...VIC_MIRRORED_VOLATILE, ...FLAT_VOLATILE];

function ioMaskEntryFor(addr) {
  if (addr >= 0xd000 && addr <= 0xd3ff) {
    const canonical = 0xd000 + (addr & 0x3f);
    return VIC_MIRRORED_VOLATILE.find(({ lo, hi }) => canonical >= lo && canonical <= hi) ?? null;
  }
  return FLAT_VOLATILE.find(({ lo, hi }) => addr >= lo && addr <= hi) ?? null;
}

export function isIoVolatile(addr) {
  return ioMaskEntryFor(addr) !== null;
}

function imageMaskEntryFor(addr, route) {
  const base = IMAGE_VOLATILE.find(({ lo, hi }) => addr >= lo && addr <= hi);
  if (base) return base;
  if (route === "memory-read" && addr >= 0xd000 && addr <= 0xdfff) {
    return ioMaskEntryFor(addr);
  }
  // snapshot route: $D000-$DFFF in the image is ordinary RAM under I/O, not
  // the register read view -- not masked at all. See SKILL.md, "Slice the
  // image out of a snapshot instead of transcribing it".
  return null;
}

export function isImageVolatile(addr, route) {
  return imageMaskEntryFor(addr, route) !== null;
}

// -------------------------------------------------------------------- format

const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n) => "$" + n.toString(16).toUpperCase().padStart(2, "0");
const bin8 = (n) => "%" + n.toString(2).padStart(8, "0");

function loadImage(path) {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(`${path}: ${buf.length} bytes, expected ${IMAGE_BYTES} — not a full 64K image`);
  }
  return buf;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ---------------------------------------------------------------------- state

// --state <a.state.json> loads a per-capture sidecar this module defines its
// own way -- distinct from, but inspired by, `dump-artifacts.mjs`'s
// chip-state output shape (`registers`/`sprites`/`cpu`), since no committed
// chip-state sidecar carries $Dxxx register values directly today. The shape
// this module reads:
//
//   {
//     "route": "snapshot" | "memory-read",
//     "registers": { "$D011": 27, "53272": 21, "0xD020": 14 }
//   }
//
// `registers` keys may be a "$Dxxx" hex string, a "0xNNNN" hex string, or a
// bare decimal string -- whatever the caller already has to hand. Every key
// must parse as an address or the sidecar is refused by name. `registers` is
// optional: a capture with no chip-state evidence compares on the image
// alone.
function loadState(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseAddrKey(k) {
  if (/^\$[0-9a-fA-F]+$/.test(k)) return parseInt(k.slice(1), 16);
  if (/^0x[0-9a-fA-F]+$/i.test(k)) return parseInt(k, 16);
  if (/^\d+$/.test(k)) return parseInt(k, 10);
  return null;
}

function normalizeRegisters(stateDoc, path) {
  const map = new Map();
  const raw = stateDoc?.registers;
  if (!raw) return map;
  for (const [k, v] of Object.entries(raw)) {
    const addr = parseAddrKey(k);
    if (addr === null) {
      throw new Error(`${path}: register key "${k}" is not a parseable address -- refused`);
    }
    map.set(addr, v);
  }
  return map;
}

// -------------------------------------------------------------- classification

/**
 * Classify every differing address between two captures -- image bytes plus,
 * when both sides carry a chip-state sidecar, register values. Precedence is
 * volatile first, then divergence -- the same "mask wins over everything
 * else" precedence compare.mjs already uses for isVolatile. There is no
 * fourth bucket and no bit-count branch: every non-volatile difference is a
 * divergence, one bit or many.
 */
export function classify({ imgA, imgB, route, regMapA, regMapB }) {
  const volatile_ = [];
  const divergence = [];

  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = imgA[addr];
    const y = imgB[addr];
    if (x === y) continue;

    const rec = { addr, a: x, b: y, domain: "image" };
    if (isImageVolatile(addr, route)) {
      volatile_.push(rec);
      continue;
    }
    divergence.push(rec);
  }

  if (regMapA && regMapB && regMapA.size && regMapB.size) {
    const addrs = new Set([...regMapA.keys(), ...regMapB.keys()]);
    for (const addr of [...addrs].sort((p, q) => p - q)) {
      const x = regMapA.get(addr);
      const y = regMapB.get(addr);
      // Present on only one side -- not comparable, not counted either way.
      if (x === undefined || y === undefined) continue;
      if (x === y) continue;

      const rec = { addr, a: x, b: y, domain: "register" };
      if (isIoVolatile(addr)) {
        volatile_.push(rec);
        continue;
      }
      divergence.push(rec);
    }
  }

  return { volatile: volatile_, divergence, pass: divergence.length === 0 };
}

// ------------------------------------------------------------------- printing

const fmtDiffRow = (r) =>
  `  ${hex4(r.addr)}  ${hex2(r.a)} ${bin8(r.a)}  ->  ${hex2(r.b)} ${bin8(r.b)}   [${r.domain}]`;

function printList(title, rows, limit) {
  console.log(`\n${title}: ${rows.length}`);
  if (!rows.length) return;
  // --limit 0 means unlimited, matching the usage text. Anything else caps.
  const shown = limit ? rows.slice(0, limit) : rows;
  for (const r of shown) console.log(fmtDiffRow(r));
  if (shown.length < rows.length) {
    console.log(`  … ${rows.length - shown.length} more (--limit 0 for all)`);
  }
}

// ---------------------------------------------------------------------- cross

function parseCrossArgs(argv) {
  const positional = [];
  let statePaths = null;
  let routeAssert = null;
  let limit;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--state") {
      statePaths = [argv[++i], argv[++i]];
    } else if (a === "--route") {
      routeAssert = argv[++i];
    } else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) throw new Error("--limit needs a non-negative integer");
      limit = n;
    } else {
      positional.push(a);
    }
  }

  if (positional.length !== 2) throw new Error("cross needs exactly two image paths");
  return { imagePaths: positional, statePaths, routeAssert, limit };
}

function cmdCross(argv) {
  const opts = parseCrossArgs(argv);
  const [pa, pb] = opts.imagePaths;
  const imgA = loadImage(pa);
  const imgB = loadImage(pb);

  const stateA = opts.statePaths ? loadState(opts.statePaths[0]) : null;
  const stateB = opts.statePaths ? loadState(opts.statePaths[1]) : null;

  const routeA = stateA?.route ?? opts.routeAssert ?? "memory-read";
  const routeB = stateB?.route ?? opts.routeAssert ?? "memory-read";
  if (routeA !== routeB) {
    throw new Error(
      `capture routes differ -- A declares "${routeA}", B declares "${routeB}". Comparing a ` +
        `snapshot-route capture against a memory-read-route capture is meaningless; refused.`,
    );
  }
  const route = routeA;

  const regMapA = stateA ? normalizeRegisters(stateA, opts.statePaths[0]) : null;
  const regMapB = stateB ? normalizeRegisters(stateB, opts.statePaths[1]) : null;

  const haA = sha256(imgA);
  const haB = sha256(imgB);

  console.log(`A  ${basename(pa)}  sha256 ${haA}`);
  console.log(`B  ${basename(pb)}  sha256 ${haB}`);

  const r = classify({ imgA, imgB, route, regMapA, regMapB });

  printList("volatile (excluded from the verdict)", r.volatile, opts.limit);
  printList("DIVERGENCE — fails the comparison", r.divergence, opts.limit);

  const total = r.volatile.length + r.divergence.length;
  console.log(`\ntotal differing addresses (image + register): ${total}`);
  console.log(`\nVERDICT: ${r.pass ? "PASS" : "FAIL"}`);
  return r.pass ? 0 : 1;
}

// -------------------------------------------------------------------- dispatch

const commands = { cross: cmdCross };

function usage() {
  return `usage: node compare-cross-binary.mjs <command>

  cross <a.bin> <b.bin> [--state <a.state.json> <b.state.json>]
        [--route <snapshot|memory-read>] [--limit N]
    classify every difference between two captures of DIFFERENT binaries and
    print a single VERDICT line.

No drift bucket here: every non-volatile difference fails, regardless of bit
count -- unlike compare.mjs, which is for two captures of the SAME binary.
Volatile registers (excluded): $D011, $D012, $D019, $D01E-$D01F, $D400-$D7FF,
$D800-$DBFF, $DC00-$DCFF, $DD00-$DDFF, $DE00-$DFFF (mirrored across
$D000-$D3FF where applicable). $D015, $D018 and $D020 are deliberately NOT
masked.
--limit 0 prints every row. Exit status is 1 on a FAIL verdict, non-zero on
any refusal (mismatched route, a malformed image).

Captures come from the procedure in c64-ram-capture/SKILL.md, via
mcp__plugin_c64-re-tools_vice__*. This script contacts nothing.`;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) {
    console.error(usage());
    process.exit(cmd ? 1 : 0);
    return;
  }
  try {
    process.exit(commands[cmd](rest));
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
