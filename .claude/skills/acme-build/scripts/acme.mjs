#!/usr/bin/env node
// ACME -> C64 assembler driver.  Target is fixed: C64, 6510 CPU, cbm output.
// Scope is assembling only: source in, .prg + symbol files out.  Running the
// result on a C64 belongs to the emulator skill.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

// The ACME library (<cbm/c64/vic.a> and friends) lives wherever the package put
// it.  Probe instead of assuming; validated by a file we actually include.
const LIB_MARKER = join("cbm", "c64", "vic.a");
function findAcmeLib() {
  const tried = [];
  for (const c of [
    process.env.ACME,
    "/usr/local/share/acme", "/usr/share/acme", "/usr/lib/acme",
    process.env.HOME && join(process.env.HOME, ".acme"),
  ].filter(Boolean)) {
    tried.push(c);
    if (existsSync(join(c, LIB_MARKER))) return { path: c, tried };
  }
  return { path: null, tried };
}
const ACME_LIB = findAcmeLib();

// How to refer to this script in hints, from wherever we were run.
function selfPath() {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

// ------------------------------------------------------------------- build

// ACME's --msvc format:  file(line) : Error (Zone <z>): message.
const MSVC = /^(.*?)\((\d+)\)\s*:\s*(Error|Warning|Serious error)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

function parseDiagnostics(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(MSVC);
    if (m) {
      out.push({
        file: m[1], line: Number(m[2]),
        severity: m[3].toLowerCase().replace(" ", "_"),
        zone: m[4] || null, message: m[5].trim(),
      });
    } else if (line.trim()) {
      out.push({ file: null, line: null, severity: "note", zone: null, message: line.trim() });
    }
  }
  return out;
}

// The symbol list marks address-typed symbols with a leading "!addr" and
// never-referenced ones with a trailing "; unused".  Both matter downstream.
function parseSymbols(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").flatMap((raw) => {
    const m = raw.match(/^(!addr\s+)?(\S+)\s*=\s*(\S+?)\s*(?:;\s*(.*))?$/);
    if (!m) return [];
    return [{
      name: m[2], value: m[3],
      isAddress: Boolean(m[1]),
      used: !/^unused/.test(m[4] || ""),
    }];
  });
}

// ACME's label file lists every global symbol, constants included, in address
// form.  A debugger reads `viccolor_WHITE = $1` as a name for address $0001 and
// relabels the 6510 processor port with it.  Keep referenced addresses only, so
// the emitted file is safe to load anywhere.
function curateLabels(vsPath, symbols) {
  if (!existsSync(vsPath)) return { kept: 0, dropped: 0 };
  const addr = new Set(symbols.filter((s) => s.isAddress && s.used).map((s) => s.name));
  const kept = [];
  let dropped = 0;
  for (const l of readFileSync(vsPath, "utf8").split("\n")) {
    const m = l.match(/^al\s+C:[0-9a-f]+\s+\.(\S+)/i);
    if (!m) continue;
    if (addr.has(m[1])) kept.push(l); else dropped++;
  }
  writeFileSync(vsPath, kept.join("\n") + (kept.length ? "\n" : ""));
  return { kept: kept.length, dropped };
}

function build(src, opts) {
  if (!existsSync(src)) die(`no such source file: ${src}`);
  // Side files follow the .prg, not the source: two -DVARIANT builds of one
  // source must not overwrite each other's symbol tables.
  const prg = opts.out || join(opts.outDir || dirname(src),
    basename(src).replace(/\.(a|asm|s)$/i, "") + ".prg");
  const outDir = dirname(prg);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const stem = prg.replace(/\.prg$/i, "");

  const args = [
    "--cpu", "6510",              // C64: enables the 6510 illegal opcodes
    "-f", opts.format || "cbm",   // cbm = 2-byte load address, what LOAD wants
    "-Wtype-mismatch",            // catches a missing '#' on an immediate
    "--strict-segments",          // overlapping segments are reported as errors
    "--msvc",                     // machine-parseable diagnostics
    "-v1",                        // report the address range actually emitted
    "-o", prg,
    "-l", `${stem}.sym`,
    "--vicelabels", `${stem}.vs`,
  ];
  if (!opts.noReport) args.push("-r", `${stem}.rep`);
  for (const d of opts.defines) args.push(`-D${d}`);
  for (const i of opts.includes) args.push("-I", i);
  if (opts.setpc) args.push("--setpc", opts.setpc);
  args.push(src);

  // `<cbm/c64/vic.a>` style includes resolve through the ACME env var, so set
  // it here rather than depending on the shell environment carrying it.
  const env = { ...process.env };
  if (ACME_LIB.path) env.ACME = ACME_LIB.path;
  const r = spawnSync("acme", args, { encoding: "utf8", env });
  if (r.error) {
    die(r.error.code === "ENOENT"
      ? "install the ACME cross assembler and put `acme` on PATH"
      : String(r.error));
  }

  const diags = parseDiagnostics(((r.stderr || "") + (r.stdout || "")).trim());
  if (diags.some((d) => /ACME.*environment variable/i.test(d.message))) {
    diags.push({
      file: null, line: null, severity: "note", zone: null,
      message: `for <...> includes, set $ACME to the directory holding ${LIB_MARKER} ` +
               `(looked in: ${ACME_LIB.tried.join(", ")})`,
    });
  }
  const errors = diags.filter((d) => d.severity.endsWith("error"));
  const ok = r.status === 0 && existsSync(prg);

  let range = null, size = null, symbols = [], labels = null;
  if (ok) {
    symbols = parseSymbols(`${stem}.sym`);
    labels = curateLabels(`${stem}.vs`, symbols);
    const buf = readFileSync(prg);
    size = buf.length;
    if ((opts.format || "cbm") === "cbm" && buf.length >= 2) {
      const load = buf[0] | (buf[1] << 8);
      range = { load, end: load + buf.length - 2, bytes: buf.length - 2 };
    }
  }
  return { ok, prg, stem, diags, errors, symbols, labels, range, size };
}

const hex = (n, w = 4) => n.toString(16).padStart(w, "0");

function reportBuild(res, { json }) {
  if (json) { console.log(JSON.stringify(res, null, 2)); return; }
  for (const d of res.diags) {
    if (d.file) console.log(`${d.file}:${d.line}: ${d.severity}: ${d.message}`);
    else console.log(`  ${d.message}`);
  }
  if (!res.ok) { console.error(`build FAILED (${res.errors.length} error(s))`); return; }
  const r = res.range;
  console.log(
    `built ${res.prg} (${res.size} bytes)` +
    (r ? `  load $${hex(r.load)}-$${hex(r.end)}  ${r.bytes} bytes of code` : "")
  );
  const used = res.symbols.filter((s) => s.used).length;
  console.log(`symbols: ${res.stem}.sym (${used} used / ${res.symbols.length} total)`);
  if (res.labels) {
    console.log(`debug labels: ${res.stem}.vs (${res.labels.kept} addresses)`);
  }
}

// -------------------------------------------------------------------- verbs

function cmdBuild(argv) {
  const o = parseOpts(argv);
  const res = build(o.src, o);
  reportBuild(res, o);
  process.exit(res.ok ? 0 : 1);
}

function cmdSym(argv) {
  const o = parseOpts(argv);
  const res = build(o.src, { ...o, noReport: true });
  if (!res.ok) { reportBuild(res, o); process.exit(1); }
  const used = res.symbols.filter((s) => s.used).sort((a, b) => a.name.localeCompare(b.name));
  if (o.json) { console.log(JSON.stringify(used, null, 2)); return; }
  for (const s of used) console.log(`${s.isAddress ? "addr " : "const"} ${s.value.padStart(6)}  ${s.name}`);
}

// A skeleton that is correct on the first try: BASIC stub with a computed SYS
// target, the C64 symbol libraries, and no !to (the CLI supplies -o).
function cmdNew(argv) {
  const path = argv[0];
  if (!path) die("usage: new <file.a>");
  if (existsSync(path)) die(`${path} already exists`);
  // template.a lives at the skill root, one level up from scripts/, by
  // decision (D-03): only .mjs modules move into scripts/.
  writeFileSync(path, readFileSync(join(HERE, "..", "template.a"), "utf8"));
  console.log(`wrote ${path}`);
  console.log(`next: node ${selfPath()} build ${path}`);
}

// `toacme` ships with ACME and turns object code back into ACME source.
function cmdDisasm(argv) {
  const src = argv[0];
  if (!src) die("usage: disasm <file.prg> [out.a]");
  const out = argv[1] || src.replace(/\.prg$/i, "") + ".dis.a";
  const r = spawnSync("toacme", ["object", src, out], { encoding: "utf8" });
  if (r.error) die("install the ACME cross assembler and put `toacme` on PATH");
  if (r.status !== 0) die(`toacme: ${(r.stderr || r.stdout).trim()}`);
  const n = readFileSync(out, "utf8").split("\n").filter((l) => /^L[0-9a-f]{4}/.test(l)).length;
  console.log(`${out}: ${n} lines`);
  console.log("Read it as a linear decode: trust the instruction stream, and");
  console.log("treat strings, tables and the BASIC stub as data. To reassemble,");
  console.log("define the out-of-range labels it emits (Ld020, Lffd2, ...) and");
  console.log("indent its illegal-opcode lines to the operand column.");
}

// ------------------------------------------------------------------ options

function parseOpts(argv) {
  const o = { defines: [], includes: [], json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--no-report") o.noReport = true;
    else if (a === "-o" || a === "--out") o.out = argv[++i];
    else if (a === "--out-dir") o.outDir = argv[++i];
    else if (a === "-f" || a === "--format") o.format = argv[++i];
    else if (a === "--setpc") o.setpc = argv[++i];
    else if (a === "-D") o.defines.push(argv[++i]);
    else if (a.startsWith("-D")) o.defines.push(a.slice(2));
    else if (a === "-I") o.includes.push(argv[++i]);
    else rest.push(a);
  }
  o.src = rest[0];
  if (!o.src) die("no source file given");
  return o;
}

// --------------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym, disasm: cmdDisasm };
if (!cmd || !VERBS[cmd]) {
  console.log(`usage: node ${selfPath()} <command> [options]

  new <file.a>              scaffold a C64 program (BASIC stub + libs)
  build <file.a>            assemble -> .prg .sym .vs .rep
  sym <file.a>              list the symbols the program uses
  disasm <file.prg> [out.a] turn object code back into ACME source

options: -o FILE  --out-dir DIR  -f FORMAT  --setpc ADDR  -DSYM=VAL  -I DIR
         --no-report  --json`);
  process.exit(cmd ? 1 : 0);
}
VERBS[cmd](rest);
