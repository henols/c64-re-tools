#!/usr/bin/env node
// acme.ts -- ACME -> C64 assembler driver.  Target is fixed: C64, 6510 CPU, cbm output.
// Scope is assembling only: source in, .prg + symbol files out.  Running the
// result on a C64 belongs to the c64-emulator skill.
//
// The assembler is reached ONLY through the host-tool execution seam: this
// script runs container-side, `acme` lives host-side, and there is no
// container PATH to find it on. The spawn and the `<...>`-include library
// probe live in `src/mcp/vice/host-tool.mts`'s `acme.build` allowlist entry.
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
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, realpathSync } from "node:fs";
import { dirname, join, basename, relative, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HostToolResponse, InvokeHostToolOptions } from "../../c64-project/scripts/mcp-module.ts";
import { loadSibling } from "./sibling.ts";

/** invokeHostTool() from the c64-project skill, loaded when first used so a
 * missing sibling skill is a named refusal, not a crash at import. */
async function invokeHostTool(tool: string, args: object, opts: InvokeHostToolOptions): Promise<HostToolResponse> {
  const mcp = await loadSibling(() => import("../../c64-project/scripts/mcp-module.ts"), "mcp-module.ts", "c64-assembler");
  return mcp.ok ? mcp.mod.invokeHostTool(tool, args, opts) : { ok: false, message: mcp.message };
}

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

// How to refer to this script in hints, from wherever we were run.
function selfPath() {
  const r = relative(process.cwd(), SELF);
  return !r || r.startsWith("..") || isAbsolute(r) ? SELF : r;
}

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string; [key: string]: unknown };

/** A refusal that stops the verb. `main()` turns it into `{ ok: false, message }`. */
class Refusal extends Error {}
const die = (m: string): never => { throw new Refusal(m); };

// ------------------------------------------------------------------- types

interface Diagnostic {
  file: string | null;
  line: number | null;
  severity: string;
  zone: string | null;
  message: string;
}

interface SymbolEntry {
  name: string;
  value: string;
  isAddress: boolean;
  used: boolean;
}

interface LabelCounts {
  kept: number;
  dropped: number;
}

/** Parsed CLI options. `src` is set by parseOpts() before it returns. */
interface BuildOpts {
  defines: string[];
  includes: string[];
  json: boolean;
  noReport?: boolean;
  out?: string;
  outDir?: string;
  format?: string;
  setpc?: string;
  src?: string;
}

/** The typed `acme.build` request this script sends through the seam. */
interface AcmeBuildRequest {
  source: string;
  format?: string;
  setpc?: string;
  defines?: string[];
  includes?: string[];
  noReport?: boolean;
}

interface LoadRange {
  load: number;
  end: number;
  bytes: number;
}

interface BuildResult {
  ok: boolean;
  prg: string;
  stem: string;
  diags: Diagnostic[];
  errors: Diagnostic[];
  symbols: SymbolEntry[];
  labels: LabelCounts | null;
  range: LoadRange | null;
  size: number | null;
}

// ------------------------------------------------------------------- build

// ACME's --msvc format:  file(line) : Error (Zone <z>): message.
const MSVC = /^(.*?)\((\d+)\)\s*:\s*(Error|Warning|Serious error)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

function parseDiagnostics(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
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
function parseSymbols(path: string): SymbolEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").flatMap((raw): SymbolEntry[] => {
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
function curateLabels(vsPath: string, symbols: SymbolEntry[]): LabelCounts {
  if (!existsSync(vsPath)) return { kept: 0, dropped: 0 };
  const addr = new Set(symbols.filter((s) => s.isAddress && s.used).map((s) => s.name));
  const kept: string[] = [];
  let dropped = 0;
  for (const l of readFileSync(vsPath, "utf8").split("\n")) {
    const m = l.match(/^al\s+C:[0-9a-f]+\s+\.(\S+)/i);
    if (!m) continue;
    if (addr.has(m[1])) kept.push(l); else dropped++;
  }
  writeFileSync(vsPath, kept.join("\n") + (kept.length ? "\n" : ""));
  return { kept: kept.length, dropped };
}

async function build(src: string, opts: BuildOpts): Promise<BuildResult> {
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

  const args: AcmeBuildRequest = { source: srcAbs };
  if (opts.format) args.format = opts.format;
  if (opts.setpc) args.setpc = opts.setpc;
  if (opts.defines && opts.defines.length) args.defines = opts.defines;
  if (opts.includes && opts.includes.length) args.includes = opts.includes;
  if (opts.noReport) args.noReport = true;

  // Results come back under the SOURCE's own basename (the executor's
  // naming). They land in a staging directory of their own, so a build with
  // `-o other.prg` never overwrites an existing `<source>.prg`; each result
  // is then renamed to the requested stem with its extension.
  const staging = mkdtempSync(join(desiredOutDirAbs, ".acme-"));
  let response: HostToolResponse;
  try {
    response = await invokeHostTool("acme.build", args, { destDir: staging });
    // A seam-level refusal (unresolvable client, unreachable broker, a bad
    // request) -- never a local fallback that spawns the assembler itself.
    if (!response.ok) return die(response.message);
    for (const result of response.results ?? []) {
      const ext = (basename(result.path).match(/\.(prg|sym|vs|rep)$/i) ?? [])[0];
      if (ext) renameSync(result.path, `${desiredStem}${ext.toLowerCase()}`);
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  const stem = desiredStem;
  const prg = desiredPrg;

  const diags = parseDiagnostics((response.stderrTail || "").trim());
  const errors = diags.filter((d) => d.severity.endsWith("error"));
  const ok = response.exitStatus === 0 && existsSync(prg);

  let range: LoadRange | null = null, size: number | null = null, symbols: SymbolEntry[] = [], labels: LabelCounts | null = null;
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

const hex = (n: number, w = 4) => n.toString(16).padStart(w, "0");

function reportBuild(res: BuildResult) {
  for (const d of res.diags) {
    if (d.file) console.log(`${d.file}:${d.line}: ${d.severity}: ${d.message}`);
    else console.log(`  ${d.message}`);
  }
  if (!res.ok) return;
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

async function cmdBuild(argv: string[]): Promise<ScriptResult> {
  const o = parseOpts(argv);
  const res = await build(o.src, o);
  if (!o.json) reportBuild(res);
  if (res.ok) return { ...res, ok: true };
  return { ...res, ok: false, message: buildFailure(res) };
}

function buildFailure(res: BuildResult): string {
  return `build FAILED (${res.errors.length} error(s))${res.errors[0] ? `: ${res.errors[0].message}` : ""}`;
}

async function cmdSym(argv: string[]): Promise<ScriptResult> {
  const o = parseOpts(argv);
  const res = await build(o.src, { ...o, noReport: true });
  if (!res.ok) {
    if (!o.json) reportBuild(res);
    return { ...res, ok: false, message: buildFailure(res) };
  }
  const used = res.symbols.filter((s) => s.used).sort((a, b) => a.name.localeCompare(b.name));
  if (!o.json) for (const s of used) console.log(`${s.isAddress ? "addr " : "const"} ${s.value.padStart(6)}  ${s.name}`);
  return { ok: true, symbols: used };
}

// A skeleton that is correct on the first try: BASIC stub with a computed SYS
// target and no !to (the CLI supplies -o).
function cmdNew(argv: string[]): ScriptResult {
  const path = argv[0];
  if (!path) return die("usage: new <file.a>");
  if (existsSync(path)) return die(`${path} already exists`);
  // template.a lives at the skill root, one level up from scripts/.
  writeFileSync(path, readFileSync(join(HERE, "..", "template.a"), "utf8"));
  console.log(`wrote ${path}`);
  console.log(`next: node ${selfPath()} build ${path}`);
  return { ok: true, path };
}

// ------------------------------------------------------------------ options

function parseOpts(argv: string[]): BuildOpts & { src: string } {
  const o: BuildOpts = { defines: [], includes: [], json: false };
  const rest: string[] = [];
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
  if (!o.src) return die("no source file given");
  return { ...o, src: o.src };
}

// --------------------------------------------------------------------- main

const VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym } satisfies Record<string, (argv: string[]) => ScriptResult | Promise<ScriptResult>>;

function usage(): string {
  return `usage: node ${selfPath()} <command> [options]

  new <file.a>              scaffold a C64 program (BASIC stub, no libraries needed)
  build <file.a>            assemble -> .prg .sym .vs .rep
  sym <file.a>              list the symbols the program uses

options: -o FILE  --out-dir DIR  -f FORMAT  --setpc ADDR  -DSYM=VAL  -I DIR
         --no-report  --json
The last stdout line is one JSON result.`;
}

/** The whole CLI as a function. Never rejects. */
export async function main(argv: string[]): Promise<ScriptResult> {
  const [cmd, ...rest] = argv;
  if (!cmd || !Object.hasOwn(VERBS, cmd)) {
    return { ok: false, message: cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage()}` : usage() };
  }
  try {
    return await VERBS[cmd as keyof typeof VERBS](rest);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// True when this file is the process entry point, also when it runs through a symlink.
const invokedDirectly = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const result = await main(process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
