#!/usr/bin/env node
// Reference driver for the C64 memory map.
//
// One job: answer "what is at this address?", and apply that answer to a
// 6502 listing so bare numeric operands read as *documented* assembly. Every
// address is resolved against the published Commodore 64 memory-map tables (see
// SOURCES below). Everything here is information.
//
// Self-contained by design: no imports outside the Node standard library, no
// sibling skill, no emulator, no other tool. `lookup` and `annotate` run purely
// off the committed memmap.json, so they work offline and anywhere. Only
// `memmap`, which rebuilds that file from the four upstream sources, needs a
// network. A listing to annotate is read from a file or stdin -- whatever
// produced it is none of this script's business.
//
// Node >= 18 (global fetch). No dependencies on purpose.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// memmap.json lives at the skill root, one level up from scripts/, by decision
// (D-03): only .mjs modules move into scripts/, data files stay put.
const MEMMAP_JSON = join(HERE, "..", "memmap.json");

// Reference tables, merged into one address -> meaning index. `kind` selects the
// parser; add a row here to pull in another aay page (e.g. basromma.htm for the
// BASIC ROM) and re-run `node driver.mjs memmap`.
const SOURCES = [
  { id: "sta", kind: "staTable", url: "https://sta.c64.org/cbm64mem.html" },
  { id: "zim", kind: "zimmers", url: "https://www.zimmers.net/anonftp/pub/cbm/maps/C64.MemoryMap.txt" },
  { id: "kernal", kind: "aayList", url: "http://unusedino.de/ec64/technical/aay/c64/krnromma.htm" },
  { id: "io", kind: "c64io", url: "https://www.zimmers.net/anonftp/pub/cbm/maps/C64io.txt" },
];

// On an exact tie (several sources describe the same single address), prefer
// sta.c64.org -- its prose is the most specific ("Border color (only bits
// #0-#3)" vs "Border Color"). The other sources win wherever sta has only a
// block entry, which is all of ROM.
const SRC_RANK = { sta: 0, zim: 1, kernal: 2, io: 3 };

// Fields worth keeping from a source that loses on specificity: the canonical
// assembler symbol (zimmers) and a chip register offset like "VIC+17" (emitted
// by parseAayList, so adding vicmain.htm/sidmain.htm/ciamain.htm to SOURCES
// lights it up). Grafted onto whichever entry wins, so a single comment can
// carry prose + symbol + register.
const GRAFT_FIELDS = ["sym", "reg"];

// Entries wider than this are context, not a specific register: "$E000-$FFFF
// KERNAL ROM" inline on every branch target is pure noise. Wide hits still show
// up in the header block.
// Admits screen RAM ($0400, 1000 bytes) and the $C000-$CFFF block, but not the
// 8 KB BASIC/KERNAL ROM blocks. Only applies to non-flow instructions.
const INLINE_SPAN_MAX = 4096;

// ------------------------------------------------------------- memory-map table

// This image's python3 has no `html` stdlib module and the page is ISO-8859-1,
// so both the decode and the entity unescape are done by hand here.
function unescapeHtml(s) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "-", mdash: "-", hellip: "...", deg: "deg", times: "x", eacute: "e",
  };
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

function textify(frag) {
  let t = frag
    .replace(/<a\b[^>]*>.*?<\/a>/gis, " ")
    .replace(/<(li|p|ul|\/ul|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  t = unescapeHtml(t)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return t.trim();
}

/** First sentence — short enough to sit at the end of an asm line. */
function shortLabel(desc) {
  let m = desc.match(/^(.{0,90}?[.:])(\s|$)/);
  let lab = (m ? m[1] : desc.slice(0, 90)).replace(/[.:]+$/, "").trim();
  // "$D012 -> Read" is useless: some entries open with a bare access-mode word
  // and put the actual meaning after the colon. Reach past it.
  if (/^(read|write|bits?|values?)$/i.test(lab)) {
    const rest = desc.slice(desc.indexOf(":") + 1).trim();
    const m2 = rest.match(/^(.{0,80}?[.:])(\s|$)/);
    lab = `${lab}: ${(m2 ? m2[1] : rest.slice(0, 80)).replace(/[.:]+$/, "").trim()}`;
  }
  // Trim to a word boundary rather than mid-word.
  if (lab.length > 88) lab = lab.slice(0, 88).replace(/\s+\S*$/, "") + "...";
  return lab;
}

// The "All About Your 64" pages are flat lists of single addresses:
//   <a href="vic17.htm">$D011/53265/VIC+17</a>   Control Register 1
//   <a href="rome000.htm">$E000/57344</a>        EXP continued From BASIC ROM
// The chip/offset token is optional (the KERNAL listing omits it). Descriptions
// run to end of line.
const AAY_RE =
  /<a\s+href="[^"]*">\$([0-9A-F]{4})\/\d+(?:\/([A-Za-z0-9]+\+\d+))?<\/a>\s*([^\n|<]*)/gi;

// zimmers.net C64.MemoryMap.txt, section 1 — plain text, space-aligned:
//   LABEL     HEX         DEC     DESCRIPTION
//   TXTTAB    002B-002C   43      Pointer: Start of BASIC Text Area ($0801).
//   ADRAY1    0003-0004   3       Jump Vector: Convert FAC to Integer in (A/Y)
//                                 ($B1AA).            <- continuation line
// The label is this file's unique contribution: the canonical assembler symbol
// names, which none of the other sources carry. The label is optional (block
// rows like "0800-9FFF Normal BASIC Program space." have none).
const ZIM_ROW = /^([A-Z0-9]{1,9})?\s+([0-9A-F]{4})(?:-([0-9A-F]{4}))?\s+\d+\s+(\S.*)$/;

function parseZimmers(txt, section) {
  const lines = txt.split("\n");
  // Section 2 ("INPUT/OUTPUT ASSIGNMENTS") is deliberately skipped: it is
  // tab-separated bit-level detail already covered by the aay chip pages, and it
  // carries OCR damage ("DEOO-DEFF", "Sprite O X Pos") that would inject bogus
  // addresses.
  const stop = lines.findIndex((l) => /INPUT\/OUTPUT ASSIGNMENTS/i.test(l));
  const body = lines.slice(0, stop === -1 ? lines.length : stop);

  const entries = [];
  for (const line of body) {
    if (!line.trim()) continue;
    // An inline listing of the CHRGET routine sits mid-table; its rows look like
    // "  ,0073  INC $7A" and must not be read as addresses.
    if (/,[0-9A-F]{4}\s/.test(line)) continue;
    const m = line.match(ZIM_ROW);
    if (m) {
      const start = parseInt(m[2], 16);
      entries.push({
        start,
        end: m[3] ? parseInt(m[3], 16) : start,
        sym: m[1] || null,
        desc: m[4].trim(),
        section,
      });
    } else if (/^\s{20,}\S/.test(line) && entries.length) {
      entries[entries.length - 1].desc += " " + line.trim();
    }
  }
  for (const e of entries) {
    e.desc = e.desc.replace(/\s+/g, " ").trim();
    e.label = shortLabel(e.desc);
  }
  return entries;
}

// zimmers.net C64io.txt — the I/O map, tab-separated with a variable number of
// tabs, so fields are split and empties dropped rather than column-sliced:
//   D011		53265		VIC Control Register
//   			7	Raster Compare: (Bit 8)	See 53266     <- bit row
//   			2-0	Smooth Scroll to Y Dot-Position (0-7)
// Its edge over a plain register list is the per-bit breakdown, kept on the
// register entry and printed by `lookup`.
const IO_ADDR = /^([0-9A-F]{4})(?:-([0-9A-F]{4}))?$/;
const IO_BIT = /^[0-7](?:-[0-7])?$/;

function parseC64io(txt) {
  const entries = [];
  let section = null;
  let last = null;
  for (const line of txt.split("\n")) {
    if (!line.trim() || line.trim().startsWith(";")) continue;
    const f = line.split("\t").map((x) => x.trim()).filter(Boolean);
    if (!f.length) continue;

    const am = f[0].match(IO_ADDR);
    if (am && f.length >= 2) {
      const start = parseInt(am[1], 16);
      const end = am[2] ? parseInt(am[2], 16) : start;
      const desc = f.slice(2).join(" ").trim();
      // A range row spanning a whole chip is a section header; it is also a
      // legitimate (wide) entry, so keep it AND use it as the section.
      if (am[2]) section = desc;
      if (!desc) continue;
      last = { start, end, desc, label: shortLabel(desc), section, bits: [] };
      entries.push(last);
    } else if (IO_BIT.test(f[0]) && last) {
      last.bits.push({ bit: f[0], desc: f.slice(1).join(" ").trim() });
    } else if (last && f.length === 1) {
      // Wrapped description text.
      if (last.bits.length) last.bits[last.bits.length - 1].desc += " " + f[0];
      else {
        last.desc += " " + f[0];
        last.label = shortLabel(last.desc);
      }
    }
  }
  for (const e of entries) if (!e.bits.length) delete e.bits;
  return entries;
}

function parseAayList(htmlText, section) {
  const entries = [];
  for (const m of htmlText.matchAll(AAY_RE)) {
    const desc = unescapeHtml(m[3]).replace(/\s+/g, " ").trim();
    if (!desc || desc === "-") continue; // a few rows are placeholders
    const addr = parseInt(m[1], 16);
    entries.push({
      start: addr, end: addr,
      label: desc, desc,
      reg: m[2] || null, // e.g. "VIC+17"
      section,
    });
  }
  return entries;
}

function parseStaTable(htmlText) {
  const entries = [];
  let section = null;
  for (const row of htmlText.split(/<TR\b/i).slice(1)) {
    const sec = row.match(/<TD[^>]*COLSPAN=2[^>]*>\s*<B>([\s\S]*?)<\/B>/i);
    if (sec) {
      section = textify(sec[1]);
      continue;
    }
    const m = row.match(/<TD[^>]*>\s*\$([0-9A-F]{4})(?:-\$([0-9A-F]{4}))?\s*<BR>/i);
    if (!m) continue;
    const start = parseInt(m[1], 16);
    const end = m[2] ? parseInt(m[2], 16) : start;
    const tds = row.split(/<TD[^>]*>/i);
    const desc = tds.length > 2 ? textify(tds.slice(2).join(" ")) : "";
    entries.push({ start, end, label: shortLabel(desc), section, desc });
  }
  entries.sort((a, b) => a.start - b.start || a.end - b.end);
  return entries;
}

const SECTION_FOR = {
  zim: "C64 memory map (labelled)",
  kernal: "KERNAL ROM routine",
};

// Every page here is served as ISO-8859-1 / Latin-1 in practice; decoding as
// UTF-8 mangles the entities. Decode explicitly.
async function fetchLatin1(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return new TextDecoder("iso-8859-1").decode(new Uint8Array(await res.arrayBuffer()));
}

async function cmdMemmap() {
  const all = [];
  for (const s of SOURCES) {
    process.stderr.write(`fetching ${s.url} ... `);
    const htmlText = await fetchLatin1(s.url);
    const parsers = {
      staTable: () => parseStaTable(htmlText),
      zimmers: () => parseZimmers(htmlText, SECTION_FOR[s.id]),
      c64io: () => parseC64io(htmlText),
      aayList: () => parseAayList(htmlText, SECTION_FOR[s.id]),
    };
    const got = parsers[s.kind]();
    if (!got.length) throw new Error(`no entries from ${s.url} — layout changed?`);
    got.forEach((e) => (e.src = s.id));
    process.stderr.write(`${got.length} entries\n`);
    all.push(...got);
  }
  // Per-source emptiness above is the real guard; this only catches a broad collapse.
  if (all.length < 600) throw new Error(`only ${all.length} entries total — layout changed?`);
  all.sort((a, b) => a.start - b.start || a.end - b.end);
  writeFileSync(MEMMAP_JSON, JSON.stringify({ sources: SOURCES, entries: all }, null, 1));
  console.log(`${all.length} entries from ${SOURCES.length} sources -> ${MEMMAP_JSON}`);
}

let MEMMAP = null;
function memmap() {
  if (MEMMAP) return MEMMAP;
  if (!existsSync(MEMMAP_JSON)) {
    throw new Error(`no ${MEMMAP_JSON}; run: node driver.mjs memmap`);
  }
  MEMMAP = JSON.parse(readFileSync(MEMMAP_JSON, "utf8")).entries;
  // Several sources describe the same address with different strengths. Whoever
  // wins on specificity keeps its prose, but the symbol name and register offset
  // from the others are grafted on so one comment carries all three. Keyed on
  // the exact range so a block entry never inherits a register's symbol.
  for (const f of GRAFT_FIELDS) {
    const at = new Map();
    for (const e of MEMMAP) if (e[f]) at.set(`${e.start}-${e.end}`, e[f]);
    for (const e of MEMMAP) if (!e[f]) e[f] = at.get(`${e.start}-${e.end}`) ?? null;
  }
  return MEMMAP;
}

/**
 * All entries covering `addr`, most specific first: narrowest span wins, then
 * the richer source. This ordering is what makes ROM addresses resolve to a
 * named routine instead of "KERNAL ROM (8192 bytes)".
 */
function lookup(addr) {
  return memmap()
    .filter((e) => e.start <= addr && addr <= e.end)
    .sort(
      (a, b) =>
        a.end - a.start - (b.end - b.start) ||
        (SRC_RANK[a.src] ?? 9) - (SRC_RANK[b.src] ?? 9)
    );
}

// --------------------------------------------------------- operand extraction

const hex = (n, w = 4) => "$" + n.toString(16).toUpperCase().padStart(w, "0");

/**
 * Pull the address an instruction actually *touches* out of a line of listing
 * text. Returns {addr, note} or null.
 *
 * Deliberately returns null for immediates: in `LDA #$D0` the $D0 is a value,
 * not a location, and annotating it "processor port" is actively misleading.
 */
const MNEMONICS = ("ADC AND ASL BCC BCS BEQ BIT BMI BNE BPL BRK BVC BVS CLC CLD CLI CLV CMP " +
  "CPX CPY DEC DEX DEY EOR INC INX INY JMP JSR LDA LDX LDY LSR NOP ORA PHA PHP PLA PLP " +
  "ROL ROR RTI RTS SBC SEC SED SEI STA STX STY TAX TAY TSX TXA TXS TYA").split(" ");

// Anchoring on the real opcode set (rather than /[A-Z]{3}/) is what lets one
// regex cope with every listing style without being told which it is: a
// disassembler's "$EA34: AD 12 D0  LDA $D012", a bare "lda $d012", and
// hand-written "loop  lda $d012" / "loop:  lda $d012" alike. The \b after the
// mnemonic is load-bearing: it stops "sta" from matching inside the label
// "start".
const INSTR_RE = new RegExp(`\\b(${MNEMONICS.join("|")})\\b\\s*([^;]*)`, "i");

function operandAddr(instruction) {
  const m = instruction.match(INSTR_RE);
  if (!m) return null;
  const [, mnemonic, rawOperand] = m;
  const op = rawOperand.trim();
  if (!op || op === "A") return null;
  if (op.startsWith("#")) return null; // immediate — a value, not an address

  // ($xx),Y  ($xx,X)  ($xxxx)  -> the pointer itself is the interesting location
  let ind = op.match(/^\(\$([0-9A-F]{2,4})\s*(?:,\s*X)?\)\s*(?:,\s*Y)?$/i);
  if (ind) {
    return { addr: parseInt(ind[1], 16), note: "pointer", mnemonic };
  }
  // $xx  $xxxx  optionally ,X / ,Y
  let abs = op.match(/^\$([0-9A-F]{2,4})\s*(?:,\s*[XY])?$/i);
  if (abs) {
    const idx = /,\s*[XY]/i.test(op);
    return { addr: parseInt(abs[1], 16), note: idx ? "indexed" : null, mnemonic };
  }
  return null;
}

const FLOW = new Set(["JMP", "JSR", "BNE", "BEQ", "BCC", "BCS", "BMI", "BPL", "BVC", "BVS", "RTS", "RTI"]);

// ------------------------------------------------------------------- annotate

function annotate(lines, { maxSpan = INLINE_SPAN_MAX, noHeader = false } = {}) {
  const out = [];
  const referenced = new Map();

  // Each line is passed through byte-for-byte -- indentation, labels,
  // directives, blank lines and existing comments -- and only a trailing `;`
  // comment is appended, so documenting a .asm file never reformats it.
  // INSTR_RE finds the mnemonic wherever in the line it sits, which is why the
  // whole line can be handed to the operand parser unsliced.
  for (const body of lines) {
    if (!body.trim()) {
      out.push(body);
      continue;
    }
    const o = operandAddr(body);
    let comment = "";
    if (o) {
      const hits = lookup(o.addr);
      if (hits.length) {
        const best = hits[0];
        const span = best.end - best.start;
        // Record every hit for the header, even the wide ones.
        if (!referenced.has(best.start)) referenced.set(best.start, best);
        // A branch into "$E000-$FFFF KERNAL ROM" teaches nobody anything, so
        // flow instructions only get a comment when the hit is a specific
        // vector. Data instructions are the opposite: `STA $0400,X` -> "screen
        // memory (1000 bytes)" is exactly what a reader wants, so wide hits
        // stay, up to maxSpan (which by default admits screen RAM and the
        // $C000 block but not the 8 KB ROM blocks).
        const isFlow = FLOW.has(o.mnemonic.toUpperCase());
        if (isFlow ? span <= 2 : span <= maxSpan) {
          const which = best.start === best.end ? hex(best.start) : `${hex(best.start)}-${hex(best.end)}`;
          const tags = [best.sym, best.reg, o.note].filter(Boolean).join(", ");
          comment = `; ${which}${tags ? ` (${tags})` : ""} = ${best.label}`;
        }
      }
    }
    out.push(comment ? `${body.padEnd(44)}${comment}` : body);
  }

  const header = [];
  if (referenced.size && !noHeader) {
    header.push(";; ------------------------------------------------------------------");
    header.push(";; Addresses referenced by this listing");
    for (const s of SOURCES) header.push(`;;   ${s.url}`);
    header.push(";; ------------------------------------------------------------------");
    for (const e of [...referenced.values()].sort((a, b) => a.start - b.start)) {
      const which = e.start === e.end ? hex(e.start) : `${hex(e.start)}-${hex(e.end)}`;
      const tags = [e.sym, e.reg].filter(Boolean).join(", ");
      header.push(`;; ${which.padEnd(14)}${e.label}${tags ? ` (${tags})` : ""}`);
      if (e.section) header.push(`;; ${"".padEnd(14)}  [${e.section}]`);
    }
    header.push(";; ------------------------------------------------------------------");
    header.push("");
  }
  return header.concat(out).join("\n");
}

// -------------------------------------------------------------------- commands

// An address is accepted however the source it was copied from happened to write
// it, so no one has to convert by hand:
//
//   $D011  $d011  0xD011  0XD011  D011h  d011H  D011  d011   hex
//   %1101000000010001                                        binary
//   53265                                                    decimal
//
// A base marker ($, 0x, trailing h, %) settles the base outright. Without one,
// two unambiguous readings remain: a token containing A-F can only be hex, and a
// plain run of decimal digits is read as decimal -- which is how the published
// tables print addresses ("53265  VIC Control Register"), so a number copied
// straight out of one lands on the right register. `#` is tolerated in front,
// for pasting an operand across as-is.
//
// Tried in order, so a marker always beats the markerless readings below it.
const ADDR_FORMS = [
  [/^\$([0-9a-f]+)$/i, 16],
  [/^0x([0-9a-f]+)$/i, 16],
  [/^([0-9a-f]+)h$/i, 16],
  [/^%([01]+)$/, 2],
  [/^(\d+)$/, 10],
  [/^([0-9a-f]+)$/i, 16],
];

const ADDR_MAX = 0xffff;

function parseAddr(s) {
  if (s == null) throw new Error("address required");
  const t = String(s).trim().replace(/^#/, "").replace(/[_\s]/g, "");
  for (const [re, base] of ADDR_FORMS) {
    const m = t.match(re);
    if (!m) continue;
    const n = parseInt(m[1], base);
    if (!Number.isFinite(n)) break;
    if (n > ADDR_MAX) {
      // Digits that overflow as hex but fit as decimal are almost always a
      // decimal address that picked up a `$` on the way in.
      const asDec = base === 16 && /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NaN;
      const hint =
        asDec <= ADDR_MAX ? ` For decimal ${m[1]}, drop the marker: ${m[1]} = ${hex(asDec)}.` : "";
      throw new Error(
        `${s} reads as ${n}, past the top of the 64K address space ` +
          `($0000-${hex(ADDR_MAX)}).${hint}`
      );
    }
    return n;
  }
  throw new Error(
    `bad address: ${s}\n` +
      `  hex $D011 / 0xD011 / D011h / D011, binary %1101000000010001, decimal 53265`
  );
}

function flag(argv, name, def = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}

const commands = {
  memmap: cmdMemmap,

  /** Full prose for an address — the "what is $D011 again?" command. */
  async lookup(argv) {
    for (const a of argv) {
      const addr = parseAddr(a);
      const hits = lookup(addr);
      console.log(`\n=== ${hex(addr)} ===`);
      if (!hits.length) {
        console.log("(not in memory map)");
        continue;
      }
      for (const e of hits) {
        const which = e.start === e.end ? hex(e.start) : `${hex(e.start)}-${hex(e.end)}`;
        const tags = [e.sym, e.reg].filter(Boolean).join(", ");
        console.log(`${which}${tags ? ` (${tags})` : ""}  [${e.section || "-"}]  <${e.src}>`);
        console.log(e.desc.replace(/(.{1,96})(\s|$)/g, "  $1\n").trimEnd());
        for (const b of e.bits || []) console.log(`    bit ${b.bit.padEnd(4)} ${b.desc}`);
      }
    }
  },

  /**
   * annotate --file listing.asm [--out f.asm]   document a listing on disk
   * annotate [--out f.asm]                      ... or one piped in on stdin
   *
   * The input is any text carrying 6502 mnemonics: hand-written source, or a
   * listing from whichever disassembler produced it. Every line, blank ones
   * included, is kept.
   */
  async annotate(argv) {
    const outFile = flag(argv, "out");
    const inFile = flag(argv, "file");
    const maxSpan = Number(flag(argv, "max-span", INLINE_SPAN_MAX));
    // A presence test, not `flag()`: `flag()` returns the argv element *following*
    // the named flag, which for a valueless flag would silently swallow whatever
    // comes next (e.g. `--no-header --file game.asm` would read "--file" as the
    // value of `--no-header`).
    const noHeader = argv.includes("--no-header");

    // `--file -` and a bare `annotate` both mean stdin; fd 0 reads it whole.
    const src = !inFile || inFile === "-" ? 0 : inFile;
    const lines = readFileSync(src, "utf8").replace(/\n$/, "").split("\n");

    const text = annotate(lines, { maxSpan, noHeader });
    if (outFile) {
      writeFileSync(outFile, text + "\n");
      console.log(`wrote ${outFile} (${text.split("\n").length} lines)`);
    } else {
      console.log(text);
    }
  },

};

// `lookup` is exported so anything else that needs to name an address can reuse
// this table instead of reimplementing it. Guarding the CLI dispatch below keeps
// such an import from also running the CLI.
export { lookup };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) {
    console.error(`usage: node driver.mjs <command>

  lookup <addr>...                  full memory-map prose for an address
  annotate --file <listing>         document a listing or .asm file
            [--out f.asm] [--max-span N] [--no-header]
  annotate                          ... the same, reading stdin
  memmap                            (re)build memmap.json from the four sources
                                    (the only command needing a network)`);
    process.exit(cmd ? 1 : 0);
  }
  commands[cmd](rest).catch((e) => {
    console.error(`error: ${e.message}`);
    process.exit(1);
  });
}
