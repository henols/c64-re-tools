#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof02-enumerate-sites.mjs -- the Ghidra-independent candidate
// indirect-dispatch site enumerator, plan 38-03 (PROOF-02).
//
// THE D-06 CIRCULARITY GUARD, STATED HERE BEFORE ANYTHING ELSE
// --------------------------------------------------------------
// PROOF-02 asks whether Ghidra resolves a COMPUTED indirect-dispatch table.
// If the candidate site LIST that question is checked against comes from
// Ghidra's own export, the criterion silently degrades to "Ghidra resolved
// the dispatch that Ghidra found" -- a tautology, not a measurement. This
// file is the independent half that makes the question answerable: it
// decides WHICH addresses are candidate sites by a route Ghidra had no part
// in, and NOTHING downstream may add a site to its output.
//
//   * This file NEVER opens, reads or parses a Ghidra export file.
//   * This file NEVER imports `parseGhidraExport` or any Ghidra-export
//     reader, and never will -- reaching for one here would be exactly the
//     circularity this guard exists to prevent.
//   * The only external input this file reads, besides the raw image bytes
//     themselves, is an OPTIONAL dxa `-a dump` listing (`--dump`), and that
//     listing is used ONLY as an annotation on already-enumerated sites
//     (never as a filter, never as a source of new sites -- see "Cross-check,
//     never a filter" below).
//
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// ---------------------------------------------------------
// The dxa cross-check, when requested, goes through `dxa-listing.ts`'s
// `parseDumpListing()` -- never a hand-rolled regex over dxa's own text
// output. This file imports NO Node child-process module at all: it never
// invokes dxa or Ghidra itself. A caller that wants the dxa listing (plan
// `38-04`'s own driver, or the Task 2 transcript in this plan) obtains it
// separately, through `dxa-run.ts`'s `runDxaDisassemble()` (the Phase 34
// host-tool seam), and passes the resulting listing TEXT FILE PATH to this
// script's `--dump` flag.
//
// ENUMERATION METHOD (emitted verbatim as PROOF02_SITES_METHOD below): a
// linear byte scan for opcode $6C, the NMOS 6502 `JMP (abs)` -- the ONLY
// indirect control transfer the NMOS 6502 has ($7C `JMP (abs,X)` is a 65C02
// opcode and does not exist on this target). For each $6C site, this script
// reads its 16-bit little-endian operand as the pointer address, then walks
// backward through a bounded 48-byte window, using a full NMOS 6502
// instruction-length table (including illegal/undocumented opcodes -- this
// project's own corpus is real cracker code and MEASURED to contain them,
// Phase 36's `NOP $d6` / `ISC ($20,X)` / `ISC ($a2,X)` findings), to
// classify how the pointer bytes were written and how any indexing register
// feeding an indexed load was itself last set. See `classifySite()` below
// for the four-bucket vocabulary.
//
// CROSS-CHECK, NEVER A FILTER. When `--dump <path>` is supplied, every
// enumerated site is annotated with whatever `parseDumpListing()` says dxa
// classified that address as (`code` / `data` / `unclassified` / absent from
// the listing entirely). A site dxa calls `data` is NOT removed from the
// report -- a `$6C` byte sitting inside a data region is a false site, and
// saying so plainly is part of the record, not a reason to hide it.
//
// DETERMINISM. Given the same input bytes and the same flags, this script's
// stdout and any `--json` output are byte-identical across runs. No
// timestamp, no absolute path, no environment-derived value and no argv
// value (other than the ones that change the ANALYSIS, not merely where
// output is written) is ever printed.
// -----------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

// --- a full NMOS 6502 instruction-length table (256 entries), including the
// documented illegal/undocumented opcodes -- REQUIRED so a backward decode
// walk over real cracker code (which this project has already measured to
// contain illegal opcodes) does not misalign the instant it steps over one.
// `KIL`/`JAM` (the undocumented halt opcodes) are given length 1 -- they
// never appear as a genuine preceding instruction in working code, so their
// exact length is irrelevant to correctness here; they exist in this table
// only so every byte value has SOME length to skip.
const LEN = new Array(256).fill(1);
function setLen(opcodes, len) {
  for (const op of opcodes) LEN[op] = len;
}
// 1-byte, implied/accumulator opcodes (everything not explicitly widened
// below keeps the default length of 1 -- this covers every implied opcode,
// including the illegal NOPs/KILs that are also 1 byte).
setLen(
  [
    0x00, // BRK (2 bytes on real hardware: opcode + signature byte)
  ],
  2,
);
// 2-byte opcodes: immediate, zero page, zero-page-indexed, (zp,X), (zp),Y,
// relative branches -- every opcode whose operand is a single byte. Built
// explicitly, opcode by opcode, so every entry is traceable to a documented
// NMOS 6502 addressing mode rather than inferred from a pattern that could
// silently mis-cover an illegal opcode.
const LEN2 = [
  0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x09, 0x0b, // row 0x0_
  0x10, 0x11, 0x13, 0x14, 0x15, 0x16, 0x17, // row 0x1_ (no 0x19 here, abs,Y is 3)
  0x21, 0x23, 0x24, 0x25, 0x26, 0x27, 0x29, 0x2b, // row 0x2_
  0x30, 0x31, 0x33, 0x34, 0x35, 0x36, 0x37, // row 0x3_
  0x41, 0x43, 0x44, 0x45, 0x46, 0x47, 0x49, 0x4b, // row 0x4_
  0x50, 0x51, 0x53, 0x54, 0x55, 0x56, 0x57, // row 0x5_
  0x61, 0x63, 0x64, 0x65, 0x66, 0x67, 0x69, 0x6b, // row 0x6_
  0x70, 0x71, 0x73, 0x74, 0x75, 0x76, 0x77, // row 0x7_
  0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x89, // row 0x8_
  0x90, 0x91, 0x93, 0x94, 0x95, 0x96, 0x97, // row 0x9_
  0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa9, 0xab, // row 0xa_
  0xb0, 0xb1, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, // row 0xb_
  0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc9, 0xcb, // row 0xc_
  0xd0, 0xd1, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, // row 0xd_
  0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe9, 0xeb, // row 0xe_
  0xf0, 0xf1, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, // row 0xf_
];
setLen(LEN2, 2);
// 3-byte opcodes: absolute, absolute-indexed, indirect -- every opcode whose
// operand is a two-byte address.
const LEN3 = [
  0x0c, 0x0d, 0x0e, 0x0f,
  0x19, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
  0x20, 0x2c, 0x2d, 0x2e, 0x2f,
  0x39, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
  0x4c, 0x4d, 0x4e, 0x4f,
  0x59, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
  0x6c, 0x6d, 0x6e, 0x6f,
  0x79, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
  0x8c, 0x8d, 0x8e, 0x8f,
  0x99, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
  0xac, 0xad, 0xae, 0xaf,
  0xb9, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf,
  0xcc, 0xcd, 0xce, 0xcf,
  0xd9, 0xdb, 0xdc, 0xdd, 0xde, 0xdf,
  0xec, 0xed, 0xee, 0xef,
  0xf9, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
];
setLen(LEN3, 3);

const JMP_IND_OPCODE = 0x6c;
const WINDOW_BYTES = 48;

/** Opcodes that load a fixed-address (never indexed) zero-page or absolute
 * byte into the accumulator without any indexing -- used to trace the
 * accumulator's own value backward when a `TAX`/`TAY` feeds the index
 * register (spec: "$A9 LDA #imm followed by $AA TAX / $A8 TAY"). */
const LDA_MEM_DIRECT = new Set([0xad, 0xa5, 0xb5, 0xbd, 0xb9, 0xa1, 0xb1, 0xaf, 0xa7, 0xb7, 0xa3, 0xb3, 0xbf]);
/** Opcodes that apply arithmetic to the accumulator itself, between an
 * immediate seed and a TAX/TAY transfer -- any of these intervening makes
 * the transferred value computed, never a pure immediate. */
const ACC_ARITH = new Set([0x29, 0x0a, 0x4a, 0x69]);
/** Opcodes that write the accumulator from somewhere other than an
 * immediate or a direct memory load (transfers, stack pull) -- treated as
 * computed since their own origin is not traced further. */
const ACC_OTHER_WRITE = new Set([0x8a, 0x98, 0x68]);

/** Every opcode that writes X, and how: `imm` (LDX #imm), `mem` (a memory
 * load, always computed), or `xfer` (TAX, trace the accumulator further). */
const X_WRITERS = {
  0xa2: "imm", // LDX #imm
  0xe8: "arith", // INX
  0xca: "arith", // DEX
  0xa6: "mem", // LDX zp
  0xae: "mem", // LDX abs
  0xb6: "mem", // LDX zp,Y
  0xbe: "mem", // LDX abs,Y
  0xa3: "mem", // LAX (zp,X) -- illegal, loads A and X from memory
  0xa7: "mem", // LAX zp -- illegal
  0xab: "mem", // LAX #imm -- illegal, unstable; still memory-adjacent, not a clean immediate
  0xaf: "mem", // LAX abs -- illegal
  0xb3: "mem", // LAX (zp),Y -- illegal
  0xb7: "mem", // LAX zp,Y -- illegal
  0xbf: "mem", // LAX abs,Y -- illegal
  0xaa: "xfer", // TAX
  0xba: "mem", // TSX -- from the stack pointer, treated as computed (not a fixed constant)
};
/** Same shape as `X_WRITERS`, for Y. */
const Y_WRITERS = {
  0xa0: "imm", // LDY #imm
  0xc8: "arith", // INY
  0x88: "arith", // DEY
  0xa4: "mem", // LDY zp
  0xac: "mem", // LDY abs
  0xb4: "mem", // LDY zp,X
  0xbc: "mem", // LDY abs,X
  0xa8: "xfer", // TAY
};

/** Indexed LDA opcodes that can feed a pointer byte: `$BD`/`$B9` (abs,X /
 * abs,Y), `$B5` (zp,X), `$B1` ((zp),Y). Maps opcode -> which register it
 * indexes. */
const INDEXED_LDA_REGISTER = { 0xbd: "X", 0xb9: "Y", 0xb5: "X", 0xb1: "Y" };

/** Direct (never indexed) STA opcodes whose effective address is knowable
 * statically from the operand alone: `$85` (zp, 2 bytes), `$8D` (abs, 3
 * bytes). Indexed STA forms are deliberately excluded -- their effective
 * address depends on a runtime register value this static walk cannot
 * resolve, so they never count as "the pointer was written here". */
function directStaTarget(opcode, operandLow, operandHigh) {
  if (opcode === 0x85) return operandLow; // STA zp
  if (opcode === 0x8d) return operandLow | (operandHigh << 8); // STA abs
  return null;
}

/**
 * Decodes forward from `start` to (but not including) `target`, using the
 * NMOS instruction-length table. Returns the ordered instruction list
 * (`{ offset, opcode, operandLow, operandHigh }`) iff the decode lands
 * EXACTLY on `target` with no overshoot; returns `null` otherwise.
 */
function decodeForward(body, start, target) {
  const list = [];
  let pos = start;
  while (pos < target) {
    if (pos < 0 || pos >= body.length) return null;
    const opcode = body[pos];
    const len = LEN[opcode];
    if (pos + len > target) return null;
    list.push({
      offset: pos,
      opcode,
      operandLow: len >= 2 ? body[pos + 1] : undefined,
      operandHigh: len >= 3 ? body[pos + 2] : undefined,
    });
    pos += len;
  }
  return pos === target ? list : null;
}

/**
 * Finds the backward-aligned instruction list ending exactly at
 * `jmpOffset`, within a window of at most `WINDOW_BYTES` bytes. Tries every
 * candidate start offset in the window and keeps the one using the MOST of
 * the window (the smallest start) among those that decode cleanly to the
 * target -- deterministic (all candidates are checked; the choice does not
 * depend on iteration order) and maximises available context for the
 * register-history walk below.
 */
function backwardAlignedInstructions(body, jmpOffset) {
  const windowStart = Math.max(0, jmpOffset - WINDOW_BYTES);
  let best = null;
  for (let s = windowStart; s < jmpOffset; s++) {
    const list = decodeForward(body, s, jmpOffset);
    if (list && (best === null || s < best.start)) {
      best = { start: s, list };
    }
  }
  return best ? best.list : null;
}

/** Walks `list` backward from `uptoIndex` (exclusive) looking for the
 * nearest write to the accumulator, classifying it `immediate` or
 * `computed`. Used only when a `TAX`/`TAY` is the nearest write to the
 * index register itself. */
function resolveAccumulatorSeed(list, uptoIndex) {
  let sawArith = false;
  for (let i = uptoIndex - 1; i >= 0; i--) {
    const { opcode } = list[i];
    if (opcode === 0xa9) {
      // LDA #imm
      return sawArith ? "computed" : "immediate";
    }
    if (LDA_MEM_DIRECT.has(opcode)) return "computed";
    if (ACC_ARITH.has(opcode)) {
      sawArith = true;
      continue;
    }
    if (ACC_OTHER_WRITE.has(opcode)) return "computed";
  }
  return "none";
}

/** Walks `list` backward from `uptoIndex` (exclusive) looking for the
 * nearest write to register `reg` (`"X"` or `"Y"`), classifying it
 * `"immediate"`, `"computed"` or `"none"` (no write found in the window). */
function resolveRegisterSeed(list, uptoIndex, reg) {
  const table = reg === "X" ? X_WRITERS : Y_WRITERS;
  for (let i = uptoIndex - 1; i >= 0; i--) {
    const kind = table[list[i].opcode];
    if (kind === undefined) continue;
    if (kind === "imm") return "immediate";
    if (kind === "arith" || kind === "mem") return "computed";
    if (kind === "xfer") return resolveAccumulatorSeed(list, i);
  }
  return "none";
}

/**
 * Classifies one `$6C` site into one of four buckets: `immediate-index`,
 * `computed-index`, `vector` or `unknown`. See this file's own header for
 * the full rule statement.
 */
function classifySite(body, jmpOffset, pointer) {
  if (pointer >= 0xfffa && pointer <= 0xffff) {
    return { classification: "vector", reason: `pointer operand $${hex4(pointer)} is a hardware vector address` };
  }

  const list = backwardAlignedInstructions(body, jmpOffset);
  if (list === null) {
    return {
      classification: "unknown",
      reason: `no backward instruction decode within ${WINDOW_BYTES} bytes aligned exactly on this site`,
    };
  }

  // Find every direct STA writing pointer's low byte (address === pointer)
  // or high byte (address === pointer + 1), in forward (file) order.
  const staMatches = [];
  for (let i = 0; i < list.length; i++) {
    const insn = list[i];
    const target = directStaTarget(insn.opcode, insn.operandLow, insn.operandHigh);
    if (target === null) continue;
    if (target === pointer) staMatches.push({ index: i, byte: "lo" });
    else if (target === ((pointer + 1) & 0xffff)) staMatches.push({ index: i, byte: "hi" });
  }

  if (staMatches.length === 0) {
    return {
      classification: "vector",
      reason: `no direct write to $${hex4(pointer)} or $${hex4((pointer + 1) & 0xffff)} found in the ${WINDOW_BYTES}-byte backward window -- pointer never written in window`,
    };
  }

  // The latest (closest to the jmp) STA match determines the classification
  // -- its own immediately-preceding instruction is what fed the pointer
  // byte the CPU actually used at dispatch time.
  const latest = staMatches[staMatches.length - 1];
  const staIndex = latest.index;
  if (staIndex === 0) {
    return { classification: "unknown", reason: "the pointer-writing STA has no preceding instruction in the aligned window" };
  }
  const preceding = list[staIndex - 1];
  const indexReg = INDEXED_LDA_REGISTER[preceding.opcode];
  if (indexReg === undefined) {
    return {
      classification: "unknown",
      reason: `the instruction preceding the pointer-writing STA (opcode $${preceding.opcode.toString(16).padStart(2, "0")}) is not one of the four indexed-load forms this classifier recognises`,
    };
  }

  const seed = resolveRegisterSeed(list, staIndex - 1, indexReg);
  if (seed === "immediate") {
    return { classification: "immediate-index", reason: `index register ${indexReg} was last set by an immediate load` };
  }
  if (seed === "computed") {
    return { classification: "computed-index", reason: `index register ${indexReg} was last set from memory or arithmetic` };
  }
  return {
    classification: "unknown",
    reason: `no write to index register ${indexReg} found in the ${WINDOW_BYTES}-byte backward window`,
  };
}

function hex4(address) {
  return address.toString(16).padStart(4, "0");
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Enumerates every `$6C` site in `body` (addressed from `origin`), returning
 * one record per site, sorted ascending by address. Pure function: no
 * filesystem I/O, no process spawn -- the whole enumeration decision lives
 * here, over raw bytes only.
 */
function enumerateSites(body, origin) {
  const sites = [];
  for (let offset = 0; offset < body.length; offset++) {
    if (body[offset] !== JMP_IND_OPCODE) continue;
    if (offset + 2 >= body.length) continue; // truncated operand, not a real site
    const pointer = body[offset + 1] | (body[offset + 2] << 8);
    const address = origin + offset;
    const { classification, reason } = classifySite(body, offset, pointer);
    const windowStart = Math.max(0, offset - WINDOW_BYTES);
    const windowHex = Array.from(body.subarray(windowStart, offset))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    sites.push({ address, pointer, classification, reason, windowHex });
  }
  return sites; // byte offset ascends, so address ascends too -- already sorted
}

/** The one-line D-06 circularity statement, emitted verbatim as
 * `PROOF02_CIRCULARITY_GUARD`. */
const CIRCULARITY_GUARD_TEXT =
  "sites are enumerated and recorded from a linear raw-byte $6C opcode scan, " +
  "BEFORE any check of what Ghidra resolved -- this script reads no Ghidra export, " +
  "ever, and nothing downstream may add a site to its output (the D-06 guard)";

/** The one-line method statement, emitted verbatim as `PROOF02_SITES_METHOD`. */
const SITES_METHOD_TEXT =
  "linear byte scan for opcode $6C (NMOS 6502 JMP (abs), the only indirect " +
  "control transfer this target has), classified by a bounded 48-byte backward " +
  "instruction-length-table walk";

function classifyAgainstDump(sites, dumpMap) {
  if (dumpMap === null) return sites.map((s) => ({ ...s, dxaClass: null }));
  return sites.map((s) => {
    let dxaClass = "absent";
    if (dumpMap.code.has(s.address)) dxaClass = "code";
    else if (dumpMap.data.has(s.address)) dxaClass = "data";
    else if (dumpMap.unclassified.has(s.address)) dxaClass = "unclassified";
    return { ...s, dxaClass };
  });
}

function renderReport({ imageSha256, imageBytes, imageOrigin, sites, dumpUsed }) {
  const lines = [];
  lines.push(`IMAGE_SHA256: ${imageSha256}`);
  lines.push(`IMAGE_BYTES: ${imageBytes}`);
  lines.push(`IMAGE_ORIGIN: $${hex4(imageOrigin)}`);
  lines.push(`PROOF02_SITES_METHOD: ${SITES_METHOD_TEXT}`);
  lines.push(`PROOF02_CIRCULARITY_GUARD: ${CIRCULARITY_GUARD_TEXT}`);
  lines.push("");
  lines.push("SITES (address, pointer, classification, dxa-class, backward-window bytes):");
  for (const s of sites) {
    lines.push(
      `  $${hex4(s.address)}  ptr=$${hex4(s.pointer)}  ${s.classification}  dxa=${s.dxaClass ?? "n/a"}  window=${s.windowHex}`,
    );
  }
  lines.push("");
  const counts = { "immediate-index": 0, "computed-index": 0, vector: 0, unknown: 0 };
  for (const s of sites) counts[s.classification] += 1;
  lines.push(
    `COUNTS: immediate-index=${counts["immediate-index"]} computed-index=${counts["computed-index"]} ` +
      `vector=${counts.vector} unknown=${counts.unknown} total=${sites.length}`,
  );
  if (dumpUsed) {
    const dxaCounts = { code: 0, data: 0, unclassified: 0, absent: 0 };
    for (const s of sites) dxaCounts[s.dxaClass] += 1;
    lines.push(
      `DXA_CLASS_COUNTS: code=${dxaCounts.code} data=${dxaCounts.data} ` +
        `unclassified=${dxaCounts.unclassified} absent=${dxaCounts.absent}`,
    );
  }
  return lines.join("\n") + "\n";
}

function parseArgs(argv) {
  const args = { prg: undefined, flat64k: undefined, dump: undefined, json: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prg") args.prg = argv[++i];
    else if (a === "--flat64k") args.flat64k = argv[++i];
    else if (a === "--dump") args.dump = argv[++i];
    else if (a === "--json") args.json = argv[++i];
    else throw new Error(`proof02-enumerate-sites.mjs: unrecognised argument "${a}"`);
  }
  if (args.prg === undefined && args.flat64k === undefined) {
    throw new Error("proof02-enumerate-sites.mjs: exactly one of --prg or --flat64k is required");
  }
  if (args.prg !== undefined && args.flat64k !== undefined) {
    throw new Error("proof02-enumerate-sites.mjs: --prg and --flat64k are mutually exclusive");
  }
  return args;
}

async function runEnumerate(argv) {
  const args = parseArgs(argv);

  let origin;
  let body;
  let imageBytes;
  if (args.prg !== undefined) {
    const raw = readFileSync(args.prg);
    imageBytes = raw;
    if (raw.length < 3) {
      throw new Error(`proof02-enumerate-sites.mjs: ${args.prg} is ${raw.length} byte(s) -- a .prg needs at least 3`);
    }
    origin = raw[0] | (raw[1] << 8);
    body = new Uint8Array(raw.subarray(2));
  } else {
    const raw = readFileSync(args.flat64k);
    imageBytes = raw;
    if (raw.length !== 65536) {
      throw new Error(`proof02-enumerate-sites.mjs: ${args.flat64k} is ${raw.length} byte(s) -- a flat 64K image must be exactly 65536`);
    }
    origin = 0;
    body = new Uint8Array(raw);
  }

  const imageSha256 = sha256Hex(imageBytes);

  let dumpMap = null;
  if (args.dump !== undefined) {
    const { parseDumpListing } = await import(path.join(MCP_DIR, "dxa-listing.ts"));
    const text = readFileSync(args.dump, "utf8");
    dumpMap = parseDumpListing(text, { origin, imageSize: body.length });
  }

  const rawSites = enumerateSites(body, origin);
  const sites = classifyAgainstDump(rawSites, dumpMap);

  const report = renderReport({ imageSha256, imageBytes: imageBytes.length, imageOrigin: origin, sites, dumpUsed: dumpMap !== null });
  console.log(report);

  if (args.json !== undefined) {
    const jsonObj = {
      imageSha256,
      imageBytes: imageBytes.length,
      imageOrigin: origin,
      method: SITES_METHOD_TEXT,
      circularityGuard: CIRCULARITY_GUARD_TEXT,
      sites: sites.map((s) => ({
        address: s.address,
        pointer: s.pointer,
        classification: s.classification,
        reason: s.reason,
        dxaClass: s.dxaClass,
        windowHex: s.windowHex,
      })),
      counts: (() => {
        const c = { "immediate-index": 0, "computed-index": 0, vector: 0, unknown: 0 };
        for (const s of sites) c[s.classification] += 1;
        return c;
      })(),
    };
    writeFileSync(args.json, JSON.stringify(jsonObj, null, 2) + "\n");
  }

  return { imageSha256, sites };
}

async function main(argv) {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "enumerate") {
    throw new Error(`proof02-enumerate-sites.mjs: unknown subcommand "${subcommand}" -- only "enumerate" is supported`);
  }
  await runEnumerate(rest);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

export { enumerateSites, classifySite, backwardAlignedInstructions, decodeForward, parseArgs, main };
