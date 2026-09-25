#!/usr/bin/env node
// ACME -> C64 assembler driver.  Target is fixed: C64, 6510 CPU, cbm output.
// Scope is assembling only: source in, .prg + symbol files out.  Running the
// result on a C64 belongs to the emulator skill.
//
// The assembler is reached ONLY through the host-tool execution seam -- the
// project owner's rule of 2026-08-28 is that this script runs container-side,
// `acme` lives host-side, and there is no container PATH to find it on. This file used to spawn `acme` directly (a synchronous
// `spawnSync("acme", args, { env })`) and probed FOUR fixed HOST paths
// (`/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`)
// for its `<...>`-include library -- both are exactly what the owner's rule
// says cannot work from inside a container. The spawn and the library probe
// both moved to `src/mcp/vice/host-tool.mts`'s `acme.build` allowlist entry.
// This file constructs a TYPED request and hands it to the compiled endpoint
// client, which uploads the source's directory to the broker over the fixed
// endpoint and downloads the produced files into a per-build staging
// directory beside the output; they are then moved to their final names.
//
// WHAT NOT TO DO: never reintroduce a local child-process call to the
// assembler as a fallback when the seam is unreachable -- a fallback that
// works on the developer's own host and silently fails inside a container is
// the exact failure this seam exists to remove. A seam refusal is reported
// and the build fails; it is never retried by spawning `acme` here.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join, basename, relative, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { invokeHostTool } from "../../c64-ram-capture/scripts/mcp-module.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

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

async function build(src, opts) {
  if (!existsSync(src)) die(`no such source file: ${src}`);

  const srcAbs = resolve(src);
  // Side files follow the .prg, not the source: two -DVARIANT builds of one
  // source must not overwrite each other's symbol tables.
  const desiredPrg = opts.out
    ? resolve(opts.out)
    : join(resolve(opts.outDir || dirname(src)), basename(src).replace(/\.(a|asm|s)$/i, "") + ".prg");
  const desiredOutDirAbs = dirname(desiredPrg);
  if (!existsSync(desiredOutDirAbs)) mkdirSync(desiredOutDirAbs, { recursive: true });
  const desiredStem = desiredPrg.replace(/\.prg$/i, "");

  const args = { source: srcAbs };
  if (opts.format) args.format = opts.format;
  if (opts.setpc) args.setpc = opts.setpc;
  if (opts.defines && opts.defines.length) args.defines = opts.defines;
  if (opts.includes && opts.includes.length) args.includes = opts.includes;
  if (opts.noReport) args.noReport = true;

  // Results come back into the output directory under the SOURCE's own
  // basename (the executor's naming); each is then renamed to the requested
  // stem with its extension.
  const response = await invokeHostTool("acme.build", args, { destDir: desiredOutDirAbs });
  // A seam-level refusal (unresolvable client, unreachable broker, a bad
  // request) -- never a local fallback that spawns the assembler itself.
  if (!response.ok) die(response.message);
  for (const result of response.results ?? []) {
    const ext = (basename(result.path).match(/\.(prg|sym|vs|rep)$/i) ?? [])[0];
    const target = ext ? `${desiredStem}${ext.toLowerCase()}` : null;
    if (target && target !== result.path) renameSync(result.path, target);
  }

  const stem = desiredStem;
  const prg = desiredPrg;

  const diags = parseDiagnostics((response.stderrTail || "").trim());
  const errors = diags.filter((d) => d.severity.endsWith("error"));
  const ok = response.exitStatus === 0 && existsSync(prg);

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

async function cmdBuild(argv) {
  const o = parseOpts(argv);
  const res = await build(o.src, o);
  reportBuild(res, o);
  process.exit(res.ok ? 0 : 1);
}

async function cmdSym(argv) {
  const o = parseOpts(argv);
  const res = await build(o.src, { ...o, noReport: true });
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
  // decision: only .mjs modules move into scripts/.
  writeFileSync(path, readFileSync(join(HERE, "..", "template.a"), "utf8"));
  console.log(`wrote ${path}`);
  console.log(`next: node ${selfPath()} build ${path}`);
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
const VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym };
if (!cmd || !VERBS[cmd]) {
  console.log(`usage: node ${selfPath()} <command> [options]

  new <file.a>              scaffold a C64 program (BASIC stub, no libraries needed)
  build <file.a>            assemble -> .prg .sym .vs .rep
  sym <file.a>              list the symbols the program uses

options: -o FILE  --out-dir DIR  -f FORMAT  --setpc ADDR  -DSYM=VAL  -I DIR
         --no-report  --json`);
  process.exit(cmd ? 1 : 0);
}
await VERBS[cmd](rest);
