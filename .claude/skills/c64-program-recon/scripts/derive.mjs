#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Pure derivation over values the agent already fetched. Contacts nothing.
//
// The mcp__plugin_c64-rc-tools_vice__* tools are the only route to the emulator (.claude/CLAUDE.md
// § Emulator Access). This script therefore takes register values as arguments
// and RAM as a file, and performs only the arithmetic that a lookup table
// cannot: register bits -> concrete addresses.

const HEX = /^(?:\$|0x)?([0-9a-f]+)h?$/i;

function parseNum(s, what) {
  if (s === undefined || s === null) return undefined;
  const t = String(s).trim();
  if (/^%[01]+$/.test(t)) return parseInt(t.slice(1), 2);
  const m = HEX.exec(t);
  // A bare decimal is only decimal when it cannot be hex; callers copy values
  // out of register dumps, which are hex. Require an explicit marker for decimal.
  if (/^\d+$/.test(t) && !/^\$|^0x/i.test(t)) return parseInt(t, 16);
  if (m) return parseInt(m[1], 16);
  throw new Error(`cannot parse ${what}: ${s}`);
}

const hex = (n, w = 4) => '$' + n.toString(16).toUpperCase().padStart(w, '0');
const bin8 = (n) => '%' + n.toString(2).padStart(8, '0');

// ---------------------------------------------------------------- VIC banking

// $DD00 bits 0-1 select the bank, INVERTED. The single most common source of a
// wrong answer in C64 graphics RE: every other pointer hangs off this base.
function bankOf(dd00) {
  const sel = dd00 & 3;
  const bank = 3 - sel;
  return { bank, base: bank * 0x4000, sel };
}

// The VIC sees character ROM at $1000-$1FFF of banks 0 and 2, regardless of the
// $01 banking the CPU sees. If CB lands there, no charset exists in RAM.
function charRomShadow(bank, cb) {
  return (bank === 0 || bank === 2) && (cb === 2 || cb === 3);
}

function modeOf(d011, d016) {
  const ecm = (d011 >> 6) & 1, bmm = (d011 >> 5) & 1, mcm = (d016 >> 4) & 1;
  const names = {
    '000': 'standard text', '001': 'multicolor text',
    '010': 'standard bitmap', '011': 'multicolor bitmap',
    '100': 'extended background text',
  };
  const key = `${ecm}${bmm}${mcm}`;
  return { ecm, bmm, mcm, name: names[key] ?? 'INVALID — screen goes black', key };
}

function vic({ dd00, d018, d011, d016 }) {
  const { bank, base, sel } = bankOf(dd00);
  const vm = (d018 >> 4) & 0x0f;
  const cb = (d018 >> 1) & 0x07;
  const mode = modeOf(d011, d016);
  const screen = base + vm * 0x0400;
  const out = [];

  out.push(`$DD00 = ${hex(dd00, 2)} ${bin8(dd00)}`);
  out.push(`  bits 0-1 = %${sel.toString(2).padStart(2, '0')} (inverted) -> VIC bank ${bank}, base ${hex(base)}`);
  out.push('');
  out.push(`$D018 = ${hex(d018, 2)} ${bin8(d018)}`);
  out.push(`  VM  bits 4-7 = ${vm.toString().padStart(2)}  -> screen RAM     ${hex(screen)}-${hex(screen + 0x3e7)}`);

  if (mode.bmm) {
    // In bitmap mode only bit 3 of $D018 matters: which 8K half of the bank.
    const half = (cb & 4) ? 0x2000 : 0x0000;
    const bmp = base + half;
    out.push(`  CB  bit  3   = ${(cb & 4) ? 1 : 0}   -> bitmap         ${hex(bmp)}-${hex(bmp + 0x1f3f)}  (8000 bytes)`);
    out.push('');
    out.push(`mode: ${mode.name}  (ECM=${mode.ecm} BMM=${mode.bmm} MCM=${mode.mcm})`);
    out.push(`  video matrix at ${hex(screen)} holds COLOUR PAIRS, not character codes`);
  } else {
    const chr = base + cb * 0x0800;
    if (charRomShadow(bank, cb)) {
      out.push(`  CB  bits 1-3 = ${cb}   -> character ROM SHADOW at ${hex(chr)}`);
      out.push('');
      out.push('  *** CHARACTER ROM, NOT RAM ***');
      out.push('  The VIC sees char ROM at $1000-$1FFF in banks 0 and 2 whatever $01 says.');
      out.push('  This game uses ROM characters here. There is no charset in RAM to extract.');
    } else {
      out.push(`  CB  bits 1-3 = ${cb}   -> charset        ${hex(chr)}-${hex(chr + 0x7ff)}  (256 chars)`);
    }
    out.push('');
    out.push(`mode: ${mode.name}  (ECM=${mode.ecm} BMM=${mode.bmm} MCM=${mode.mcm})`);
  }

  if (mode.name.startsWith('INVALID')) {
    out.push('  This bit combination blanks the screen. Re-read the registers — you');
    out.push('  probably caught them mid-update inside a raster split.');
  }
  if (mode.mcm) out.push('  multicolor: bit PAIRS, half horizontal resolution');

  out.push('');
  out.push(`sprite pointers: ${hex(screen + 0x3f8)}-${hex(screen + 0x3ff)}   (screen + $03F8, 8 bytes)`);
  out.push(`colour RAM:      $D800-$DBFF   (fixed; does NOT move with the VIC bank, low nybble only)`);
  return out.join('\n');
}

// ---------------------------------------------------------------------- sprites

function sprites({ dd00, d018, d015, ptrs }) {
  const { bank, base } = bankOf(dd00);
  const vm = (d018 >> 4) & 0x0f;
  const screen = base + vm * 0x0400;
  const out = [];
  out.push(`VIC bank ${bank} (${hex(base)}), screen ${hex(screen)}, pointer block ${hex(screen + 0x3f8)}`);
  out.push(`$D015 = ${hex(d015, 2)} ${bin8(d015)}`);
  out.push('');
  out.push('spr  enabled  ptr   data address    note');
  for (let i = 0; i < 8; i++) {
    const on = (d015 >> i) & 1;
    const p = ptrs[i];
    const addr = p === undefined ? undefined : base + p * 64;
    const note = on ? '' : 'DISABLED — other registers are stale, do not decode';
    out.push(
      `  ${i}     ${on ? 'yes' : 'no '}    ` +
      `${p === undefined ? ' -- ' : hex(p, 2).padEnd(4)}  ` +
      `${addr === undefined ? '   --------- ' : `${hex(addr)}-${hex(addr + 62)}`}  ${note}`
    );
  }
  out.push('');
  out.push('63 bytes used of each 64-byte block. $D010 carries X bit 8 for X>255.');
  return out.join('\n');
}

// ---------------------------------------------------------------------- vectors

// Every indirection a C64 program can be sitting behind, grouped by block.
// Defaults are the stock KERNAL/BASIC values; `null` means the location is not
// a KERNAL-maintained vector, so "retargeted" is not a meaningful verdict there.
// `hook` marks a vector a cracker has a specific reason to divert — those are
// read as provenance signals, not merely as structure.
const VECTOR_BLOCKS = [
  ['BASIC indirects ($0300-$030B) — only meaningful with BASIC banked in', [
    ['$0300/$0301', 0x0300, 0xe38b, 'IERROR — print BASIC error message'],
    ['$0302/$0303', 0x0302, 0xa483, 'IMAIN  — BASIC warm start / input loop'],
    ['$0304/$0305', 0x0304, 0xa57c, 'ICRNCH — tokenise a BASIC line'],
    ['$0306/$0307', 0x0306, 0xa71a, 'IQPLOP — list a tokenised line'],
    ['$0308/$0309', 0x0308, 0xa7e4, 'IGONE  — execute next BASIC token'],
    ['$030A/$030B', 0x030a, 0xae86, 'IEVAL  — evaluate an expression'],
  ]],
  ['KERNAL IRQ/BRK/NMI ($0314-$0319)', [
    ['$0314/$0315', 0x0314, 0xea31, 'CINV  — KERNAL IRQ (RAM, indirect)'],
    ['$0316/$0317', 0x0316, 0xfe66, 'CBINV — BRK'],
    ['$0318/$0319', 0x0318, 0xfe47, 'NMINV — NMI (music players retarget this)'],
  ]],
  ['KERNAL I/O indirects ($031A-$0333)', [
    ['$031A/$031B', 0x031a, 0xf34a, 'IOPEN'],
    ['$031C/$031D', 0x031c, 0xf291, 'ICLOSE'],
    ['$031E/$031F', 0x031e, 0xf20e, 'ICHKIN'],
    ['$0320/$0321', 0x0320, 0xf250, 'ICKOUT'],
    ['$0322/$0323', 0x0322, 0xf333, 'ICLRCH'],
    ['$0324/$0325', 0x0324, 0xf157, 'IBASIN'],
    ['$0326/$0327', 0x0326, 0xf1ca, 'IBSOUT'],
    ['$0328/$0329', 0x0328, 0xf6ed, 'ISTOP  — STOP key check', 'hook'],
    ['$032A/$032B', 0x032a, 0xf13e, 'IGETIN'],
    ['$032C/$032D', 0x032c, 0xf32f, 'ICLALL'],
    ['$032E/$032F', 0x032e, 0xfe66, 'USRCMD — unused by the KERNAL'],
    ['$0330/$0331', 0x0330, 0xf4a5, 'ILOAD  — LOAD', 'hook'],
    ['$0332/$0333', 0x0332, 0xf5ed, 'ISAVE  — SAVE', 'hook'],
  ]],
  ['Autostart / cartridge block ($8000-$8008)', [
    ['$8000/$8001', 0x8000, null, 'cartridge cold-start entry'],
    ['$8002/$8003', 0x8002, null, 'cartridge NMI entry'],
  ]],
  ['BASIC ROM entry ($A000-$A003) — check $01 LORAM first', [
    ['$A000/$A001', 0xa000, null, 'BASIC cold-start ($E394 in stock ROM)'],
    ['$A002/$A003', 0xa002, null, 'BASIC warm-start ($E37B in stock ROM)'],
  ]],
  ['Hardware vectors ($FFFA-$FFFF) — live when the KERNAL is banked out', [
    ['$FFFA/$FFFB', 0xfffa, null, 'hardware NMI'],
    ['$FFFC/$FFFD', 0xfffc, null, 'hardware RESET'],
    ['$FFFE/$FFFF', 0xfffe, null, 'hardware IRQ/BRK'],
  ]],
];

// $8004-$8008 holds "CBM80" in PETSCII when a cartridge/autostart block is
// present, and the KERNAL only honours $8000/$8002 when it does. Without the
// signature those two words are just whatever is in RAM there.
const CBM80 = [0xc3, 0xc2, 0xcd, 0x38, 0x30];

// A target inside a ROM window is ambiguous from a static image alone: the byte
// range it names is either ROM or the RAM underneath, decided by $01 at the
// moment the vector is taken. Resolving it needs two live reads (see below).
const ROM_WINDOWS = [
  [0xa000, 0xbfff, 'BASIC ROM window'],
  [0xd000, 0xdfff, 'I/O — or char ROM, or RAM'],
  [0xe000, 0xffff, 'KERNAL ROM window'],
];

function romWindowOf(addr) {
  for (const [lo, hi, label] of ROM_WINDOWS) if (addr >= lo && addr <= hi) return label;
  return null;
}

function decodePort(v) {
  const loram = v & 1, hiram = (v >> 1) & 1, charen = (v >> 2) & 1;
  return { loram, hiram, charen };
}

// Blocks the CPU cannot currently be dispatching through, given $01. Their
// bytes are real, but nothing maintains them, so "retargeted" says nothing.
function dormantReason(title, { loram, hiram }, cbm80) {
  if (title.startsWith('BASIC indirects') && !loram) return 'BASIC ROM banked out — nothing maintains these';
  if (title.startsWith('BASIC ROM entry') && !loram) return 'BASIC ROM banked out — this is RAM';
  if (title.startsWith('KERNAL') && !hiram) return 'KERNAL ROM banked out — nothing maintains these';
  if (title.startsWith('Autostart') && !cbm80) return 'no CBM80 signature — the KERNAL ignores these words';
  if (title.startsWith('Hardware') && hiram) return 'KERNAL ROM banked in — the ROM vectors, not the program\'s';
  return null;
}

function vectorRow(buf, [name, addr, def, meaning, hook]) {
  const v = buf[addr] | (buf[addr + 1] << 8);
  const window = romWindowOf(v);
  let status;
  if (def === null) status = 'no default';
  else if (v === def) status = 'default';
  else status = '*** RETARGETED ***';
  return { name, addr, def, meaning, hook: hook === 'hook', value: v, status, window };
}

function renderRows(rows) {
  const out = ['vector        value   default   status'];
  for (const r of rows) {
    out.push(`${r.name}  ${hex(r.value)}   ${r.def === null ? '  --   ' : hex(r.def) + ' '}  ${r.status}`);
    out.push(`              ${r.meaning}${r.window ? `   [target in ${r.window} — bank-ambiguous]` : ''}`);
  }
  return out;
}

function vectors(buf, portOverride, showAll) {
  const out = [];
  const port = portOverride !== undefined ? portOverride : buf[0x0001];
  const banking = decodePort(port);
  const { loram, hiram, charen } = banking;
  const cbm80 = CBM80.every((b, i) => buf[0x8004 + i] === b);

  out.push(`$01 = ${hex(port, 2)} ${bin8(port)}`);
  out.push(`  bit 0 LORAM  = ${loram}  BASIC ROM  ${loram ? 'in' : 'out (RAM at $A000-$BFFF)'}`);
  out.push(`  bit 1 HIRAM  = ${hiram}  KERNAL ROM ${hiram ? 'in' : 'out (RAM at $E000-$FFFF)'}`);
  out.push(`  bit 2 CHAREN = ${charen}  ${charen ? 'I/O at $D000-$DFFF' : 'character ROM at $D000-$DFFF'}`);
  out.push('');
  out.push(`LIVE VECTOR PAIR: ${hiram ? '$0314/$0315 (KERNAL path — the RAM vectors are live)'
    : '$FFFE/$FFFF (KERNAL banked OUT — the hardware vectors are live)'}`);
  out.push(`CBM80 SIGNATURE:  ${cbm80
    ? 'PRESENT at $8004 — $8000/$8002 survive a reset and the KERNAL honours them'
    : 'absent — nothing catches a reset here'}`);

  const hooks = [];        // live block, hook site, diverted — an actual signal
  const retargeted = [];   // live block, diverted, not a hook site
  const residue = [];      // dormant block, non-default — leftover bytes, NOT a divert

  for (const [title, block] of VECTOR_BLOCKS) {
    const dormant = dormantReason(title, banking, cbm80);
    const rows = block.map((v) => vectorRow(buf, v));
    for (const r of rows) {
      if (r.status !== '*** RETARGETED ***') continue;
      if (dormant) residue.push(r);
      else if (r.hook) hooks.push(r);
      else retargeted.push(r);
    }
    const spine = title.startsWith('KERNAL IRQ') || title.startsWith('Hardware');
    if (!showAll && !spine) continue;
    out.push('');
    out.push(`## ${title}`);
    if (dormant) out.push(`   DORMANT: ${dormant}. Read it, do not act on it.`);
    out.push(...renderRows(rows));
  }

  if (hooks.length) {
    out.push('');
    out.push('*** CRACKER-HOOK SITES DIVERTED ***');
    for (const r of hooks) out.push(`  ${r.name} -> ${hex(r.value)}   ${r.meaning}`);
    out.push('  A diverted LOAD/SAVE is a custom loader bypassing the KERNAL; a diverted');
    out.push('  STOP is anti-tamper. Both are provenance signals — see c64-provenance-diff.');
  }
  if (retargeted.length && !showAll) {
    out.push('');
    out.push('Other retargeted vectors in LIVE blocks (--all for the full table):');
    for (const r of retargeted) out.push(`  ${r.name} -> ${hex(r.value)}   ${r.meaning}`);
  }
  if (residue.length) {
    out.push('');
    out.push(`Non-default bytes in DORMANT blocks: ${residue.length}. These are NOT diverted`);
    out.push('vectors. Nothing maintains a block whose ROM is banked out, so the bytes are');
    out.push('whatever was last written there — usually the KERNAL\'s own boot-time values,');
    out.push('partly overwritten. Do not read a hook into them. A byte here that DIFFERS');
    out.push('BETWEEN TWO RELEASES is a provenance question, not a structural one — take it');
    out.push('to c64-provenance-diff, which can prove whether a cracker wrote it.');
    if (showAll) for (const r of residue) out.push(`  ${r.name} -> ${hex(r.value)} (default ${hex(r.def)})   ${r.meaning}`);
    else out.push('  --all lists them.');
  }

  out.push('');
  out.push('A retargeted $0314 is the per-frame handler. Confirm it live: the handler');
  out.push('that runs exactly once per frame is the one that matters, whatever the');
  out.push('listing suggests. $FFFA-$FFFF read out of a RAM capture are the RAM bytes');
  out.push('under KERNAL ROM — which is exactly what runs when HIRAM = 0.');
  out.push('');
  out.push('A target marked bank-ambiguous is NOT resolved by this image. Read it twice');
  out.push('live — mcp__plugin_c64-rc-tools_vice__vice_memory_read with the default bank, then again with');
  out.push('bank:"ram" — and compare. Differing from stock ROM at that address means the');
  out.push('program has its own code hidden under ROM.');
  return out.join('\n');
}

// -------------------------------------------------------------------------- cli

function flag(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

const USAGE = `usage:
  derive.mjs vic     --dd00 3E --d018 18 --d011 1B --d016 C8
  derive.mjs sprites --dd00 3E --d018 18 --d015 FF --ptrs 20,21,22,23,24,25,26,27
  derive.mjs vectors <image.bin> [--port 35] [--all]

Values are hex by default ($3E, 0x3E, 3E all work); %00111110 for binary.
Register values come from mcp__plugin_c64-rc-tools_vice__vice_vicii_get_state / vice_memory_read.
<image.bin> is a 65536-byte capture (see the c64-ram-capture skill).`;

function main(argv) {
  const verb = argv[0];
  try {
    if (verb === 'vic') {
      const g = (n, d) => {
        const raw = flag(argv, n);
        if (raw === undefined && d === undefined) throw new Error(`missing --${n}`);
        return raw === undefined ? d : parseNum(raw, `--${n}`);
      };
      console.log(vic({ dd00: g('dd00'), d018: g('d018'), d011: g('d011', 0x1b), d016: g('d016', 0xc8) }));
    } else if (verb === 'sprites') {
      const raw = flag(argv, 'ptrs');
      const ptrs = raw === undefined ? [] : raw.split(',').map((s) => parseNum(s, '--ptrs'));
      console.log(sprites({
        dd00: parseNum(flag(argv, 'dd00'), '--dd00'),
        d018: parseNum(flag(argv, 'd018'), '--d018'),
        d015: parseNum(flag(argv, 'd015') ?? 'FF', '--d015'),
        ptrs,
      }));
    } else if (verb === 'vectors') {
      const path = argv[1];
      if (!path || path.startsWith('--')) throw new Error('vectors needs an image path');
      const buf = readFileSync(path);
      if (buf.length !== 65536) throw new Error(`expected a 65536-byte image, got ${buf.length}`);
      const p = flag(argv, 'port');
      console.log(vectors(buf, p === undefined ? undefined : parseNum(p, '--port'), argv.includes('--all')));
    } else {
      console.log(USAGE);
      process.exit(verb === undefined || verb === '--help' || verb === '-h' ? 0 : 2);
    }
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}

main(process.argv.slice(2));
