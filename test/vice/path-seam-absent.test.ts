// The host/container seam is gone, not merely unused. The broker runs on the
// host, clients reach it on the fixed endpoint with a `hello` (no discovery
// file, no token), and files cross the socket as bytes, so no module
// translates a path between the two sides.
//
// This test proves the deleted modules stay deleted: none is on disk, none is
// shipped or compiled, no production source names one, and no production
// source uses an identifier that belonged to the seam. Each scan keeps a
// planted-violation proof, and the scanned set has a pinned floor, so the
// test cannot pass by scanning nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, relative, sep } from "node:path";

import { HOST_BOUND_ARTIFACTS } from "../../src/mcp/vice/build.ts";
import { STOCK_TOOLS } from "../../src/mcp/vice/stock-tools.ts";
import { REPO_ROOT, VICE_DIR } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(REPO_ROOT, "skills");

/** The deleted modules, by stem. */
const DELETED_STEMS = ["hostpath", "containerpath", "stock-paths", "host-tool-client"];

/** Identifiers that belonged to the seam. Matched against comment-stripped
 * source, so a header that explains the history does not count. */
const SEAM_IDENTIFIERS: { name: string; re: RegExp }[] = [
  { name: "hostPath", re: /\bhostPath\b/ },
  { name: "hostPathCandidates", re: /\bhostPathCandidates\b/ },
  { name: "tryHostPaths", re: /\btryHostPaths\b/ },
  { name: "containerPath", re: /\bcontainerPath\b/ },
  { name: "containerizeRecord", re: /\bcontainerizeRecord\b/ },
  { name: "containerizeGrant", re: /\bcontainerizeGrant\b/ },
  { name: "withEmulatorSidePath", re: /\bwithEmulatorSidePath\b/ },
  { name: "SET_ENV_HINT", re: /\bSET_ENV_HINT\b/ },
  { name: 'op: "host_tool"', re: /\bop:\s*["']host_tool["']/ },
  { name: "a HOST_WORKSPACE_PATH read", re: /\.HOST_WORKSPACE_PATH\b|\[\s*["']HOST_WORKSPACE_PATH["']\s*\]/ },
  { name: "mcpHost", re: /\bmcpHost\b/ },
  { name: "isInsideContainer", re: /\bisInsideContainer\b/ },
  { name: "openBrokerControl", re: /\bopenBrokerControl\b/ },
  { name: "acquireOverControlPlane", re: /\bacquireOverControlPlane\b/ },
  { name: "readBrokerLiveness", re: /\breadBrokerLiveness\b/ },
  { name: "newControlToken", re: /\bnewControlToken\b/ },
  { name: "broker.json", re: /\bbroker\.json\b/ },
  { name: "control_token", re: /\bcontrol_token\b/ },
  { name: "ensureGhidraRunsHandle", re: /\bensureGhidraRunsHandle\b/ },
  { name: "ghidraRunsRoot", re: /\bghidraRuns(Real)?Root\b/ },
  { name: "GHIDRA_RUNS_HANDLE_*", re: /\bGHIDRA_RUNS_HANDLE_\w+/ },
];

/** A string literal naming a deleted module with any source or compiled
 * extension. Covers static imports, dynamic imports, and a skill script's
 * `resolveMcpModule("x.ts")` in one rule. */
const DELETED_MODULE_RE = new RegExp(`["'\`][^"'\`\\n]*\\b(${DELETED_STEMS.join("|")})\\.(ts|mts|mjs)["'\`]`);

/** Drops `//` whole-line comments and `/* ... *\/` block comments. A
 * trailing `//` comment on a code line is kept, as in anno-launch.test.ts. */
function stripComments(src: string): string {
  const out: string[] = [];
  let inBlock = false;
  function segment(text: string): void {
    if (inBlock) {
      const close = text.indexOf("*/");
      if (close === -1) return;
      inBlock = false;
      segment(text.slice(close + 2));
      return;
    }
    if (text.trim().startsWith("/*")) {
      const open = text.indexOf("/*");
      const close = text.indexOf("*/", open + 2);
      if (close === -1) {
        inBlock = true;
        return;
      }
      segment(text.slice(close + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return;
    out.push(text);
  }
  for (const line of src.split("\n")) segment(line);
  return out.join("\n");
}

/** Every violation in one comment-stripped source, as readable labels. */
function violationsIn(src: string): string[] {
  const stripped = stripComments(src);
  const found: string[] = [];
  const mod = DELETED_MODULE_RE.exec(stripped);
  if (mod) found.push(`names deleted module ${mod[1]}.${mod[2]}`);
  for (const { name, re } of SEAM_IDENTIFIERS) {
    if (re.test(stripped)) found.push(`uses ${name}`);
  }
  return found;
}

function isTestFile(name: string): boolean {
  return /\.test\.[a-z]+$/.test(name);
}

/** Production sources: top-level `.ts`/`.mts` under src/mcp/vice, the
 * compiled `resources/*.mjs`, and every skill script `.mjs`/`.ts`. */
function scannedFiles(): string[] {
  const files: string[] = [];
  for (const name of readdirSync(VICE_DIR)) {
    if (/\.(ts|mts)$/.test(name) && !isTestFile(name)) files.push(join(VICE_DIR, name));
  }
  const resources = join(VICE_DIR, "resources");
  for (const name of readdirSync(resources)) {
    if (name.endsWith(".mjs")) files.push(join(resources, name));
  }
  for (const skill of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const scripts = join(SKILLS_DIR, skill.name, "scripts");
    if (!existsSync(scripts)) continue;
    for (const name of readdirSync(scripts)) {
      if (/\.(mjs|ts)$/.test(name) && !isTestFile(name)) files.push(join(scripts, name));
    }
  }
  return files.sort();
}

/** Measured 2026-09-25: 155 files. A floor, not an equality, so an ordinary
 * new module never reds this test; it fails only if the walk breaks. */
const SCANNED_FILE_FLOOR = 150;

test("the deleted modules and the broker.json fixture are absent from src/mcp/vice and resources/", () => {
  for (const stem of DELETED_STEMS) {
    for (const file of [`${stem}.ts`, `${stem}.mts`, `${stem}.test.ts`, join("resources", `${stem}.mjs`)]) {
      assert.equal(existsSync(join(VICE_DIR, file)), false, `${file} must stay deleted`);
    }
  }
  assert.equal(existsSync(join(HERE, "fixtures", "bash-broker.json")), false, "the frozen broker.json fixture must stay deleted");
});

test("no production source names a deleted module or uses a seam identifier", () => {
  const files = scannedFiles();
  const offenders: string[] = [];
  for (const file of files) {
    for (const v of violationsIn(readFileSync(file, "utf8"))) {
      offenders.push(`${relative(VICE_DIR, file)}: ${v}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the scanned set meets its floor and includes all three kinds of source", () => {
  const files = scannedFiles();
  assert.ok(files.length >= SCANNED_FILE_FLOOR, `expected at least ${SCANNED_FILE_FLOOR} scanned files, found ${files.length}`);
  const rel = files.map((f) => relative(VICE_DIR, f));
  assert.ok(rel.includes("vice-proxy.ts"), "a top-level module must be scanned");
  assert.ok(rel.includes(join("resources", "vice-broker.mjs")), "a compiled resource must be scanned");
  assert.ok(rel.includes(join("..", "..", "..", "skills", "c64-project", "scripts", "mcp-module.ts")), "a skill script must be scanned");
});

test("planted violations: each deleted-module shape and each seam identifier is caught", () => {
  const planted = [
    'import { hostPath } from "./hostpath.ts";',
    "import {\n  containerizeRecord,\n} from './containerpath.mjs';",
    'const m = await import("./stock-paths.ts");',
    'const mod = resolveMcpModule("host-tool-client.ts");',
    "hostPathCandidates(x);",
    "tryHostPaths(x);",
    "const containerPath = p;",
    "containerizeGrant(g);",
    "withEmulatorSidePath(a);",
    "log(SET_ENV_HINT);",
    'send({ op: "host_tool", tool });',
    "const root = process.env.HOST_WORKSPACE_PATH;",
    'const root = env["HOST_WORKSPACE_PATH"];',
    "const host = mcpHost();",
    "if (isInsideContainer()) return;",
    "await openBrokerControl(dir);",
    "await acquireOverControlPlane(dir);",
    "readBrokerLiveness(path);",
    "const token = newControlToken();",
    'const path = join(dir, "broker.json");',
    "record.control_token = token;",
    "ensureGhidraRunsHandle(root);",
    "const dir = ghidraRunsRealRoot(root);",
    "symlinkSync(GHIDRA_RUNS_HANDLE_TARGET, link);",
  ];
  for (const src of planted) {
    assert.notDeepEqual(violationsIn(src), [], `planted source must be caught: ${src}`);
  }
});

test("planted non-violations: comments, the live host_tool_* ops and look-alike names are not caught", () => {
  const clean = [
    "// hostPath() used to translate this; see hostpath.ts",
    "/* containerizeGrant() is gone,\n   and so is stock-paths.ts */",
    'send({ op: "host_tool_stage", files });',
    'send({ op: "host_tool_run", tool });',
    "const hostPathname = url.pathname;",
    'const file = "transfer-paths.ts";',
    "delete env.HOST_WORKSPACE_PATH_UNRELATED;",
    "const session = await dialControlSession({ port });",
    'const path = join(dir, "backend.json");',
    "// broker.json and control_token were removed",
  ];
  for (const src of clean) {
    assert.deepEqual(violationsIn(src), [], `clean source must not be caught: ${src}`);
  }
});

// The grant names no broker-side path, and the client never reads the
// broker's epoch file: it asks for the epoch over the control connection.
// The wire keys are forbidden everywhere; the camelCase names only on the
// client side, because the broker keeps its own epoch file internally.

/** Wire keys that named a broker-side path in the grant. */
const GRANT_PATH_KEYS: { name: string; re: RegExp }[] = [
  { name: "epoch_file", re: /\bepoch_file\b/ },
  { name: "supervisor_dir", re: /\bsupervisor_dir\b/ },
];

/** Client-side names for reading the broker's epoch file. */
const CLIENT_EPOCH_FILE_NAMES: { name: string; re: RegExp }[] = [
  { name: "epochFile", re: /\bepochFile\b/ },
  { name: "epochPath", re: /\bepochPath\b/ },
  { name: "readEpoch", re: /\breadEpoch\b/ },
];

function epochViolationsIn(src: string, clientSide: boolean): string[] {
  const stripped = stripComments(src);
  const rules = clientSide ? [...GRANT_PATH_KEYS, ...CLIENT_EPOCH_FILE_NAMES] : GRANT_PATH_KEYS;
  return rules.filter(({ re }) => re.test(stripped)).map(({ name }) => `uses ${name}`);
}

/** True when the file is not compiled into a host-bound broker artifact. */
function isClientSide(file: string): boolean {
  if (relative(VICE_DIR, file).startsWith(`resources${sep}`)) return false;
  return !HOST_BOUND_ARTIFACTS.includes(basename(file).replace(/\.(ts|mts|mjs)$/, ".mjs"));
}

test("no production source puts a broker-side path in the grant, and no client-side source reads the broker's epoch file", () => {
  const files = scannedFiles();
  const offenders: string[] = [];
  let clientFiles = 0;
  for (const file of files) {
    const clientSide = isClientSide(file);
    if (clientSide) clientFiles++;
    for (const v of epochViolationsIn(readFileSync(file, "utf8"), clientSide)) {
      offenders.push(`${relative(VICE_DIR, file)}: ${v}`);
    }
  }
  assert.deepEqual(offenders, []);
  const rel = files.filter(isClientSide).map((f) => relative(VICE_DIR, f));
  assert.ok(rel.includes("stock-connect.ts") && rel.includes("vice-proxy.ts") && rel.includes("vice-broker-client.ts"), "the client modules that carried the epoch path must be scanned as client-side");
  assert.ok(!files.filter(isClientSide).some((f) => f.endsWith("broker-state.mts")), "broker-state.mts is host-bound and keeps its epoch file");
  assert.ok(rel.includes("install-resources.ts"), "a module whose name merely contains \"resources\" is still client-side");
  assert.ok(clientFiles > 50, `expected the client-side set to be most of the tree, found ${clientFiles}`);
});

test("planted violations: the grant path keys are caught everywhere, and the epoch-file names on the client side only", () => {
  for (const src of ['writeLine(socket, { kind: "grant", epoch_file: f });', "const dir = String(line.supervisor_dir);"]) {
    assert.notDeepEqual(epochViolationsIn(src, false), [], `caught on the broker side too: ${src}`);
    assert.notDeepEqual(epochViolationsIn(src, true), [], `caught on the client side: ${src}`);
  }
  for (const src of ["const { epochFile } = activeInstance();", "deps.epochPath = p;", "const r = readEpoch(p);"]) {
    assert.notDeepEqual(epochViolationsIn(src, true), [], `caught on the client side: ${src}`);
    assert.deepEqual(epochViolationsIn(src, false), [], `allowed on the broker side: ${src}`);
  }
  for (const src of ["// the grant used to carry epoch_file", "const baseline = await readEpochSafely(deps);", "const epochFiles = [];"]) {
    assert.deepEqual(epochViolationsIn(src, true), [], `clean source must not be caught: ${src}`);
  }
});

test("files[], tsconfig.build.json and HOST_BOUND_ARTIFACTS name no deleted module", () => {
  const pkg = JSON.parse(readFileSync(join(VICE_DIR, "package.json"), "utf8")) as { files: string[] };
  const tsconfig = JSON.parse(readFileSync(join(VICE_DIR, "tsconfig.build.json"), "utf8")) as { include: string[] };
  const lists: [string, string[]][] = [
    ["package.json files[]", pkg.files],
    ["tsconfig.build.json include", tsconfig.include],
    ["HOST_BOUND_ARTIFACTS", HOST_BOUND_ARTIFACTS],
  ];
  for (const [label, entries] of lists) {
    assert.ok(entries.length > 0, `${label} must not be empty`);
    for (const entry of entries) {
      const stem = entry.replace(/^.*\//, "").replace(/\.(ts|mts|mjs)$/, "");
      assert.equal(DELETED_STEMS.includes(stem), false, `${label} still names ${entry}`);
    }
  }
});

// Every derived tool's module is named explicitly, so a typo fails loudly
// instead of passing vacuously, and each one is proven to be in the scanned
// set above.
const DERIVED_TOOL_MODULES: Record<string, string> = {
  vice_disassemble: "stock-disassemble.ts",
  vice_memory_search: "stock-memory-search.ts",
  vice_memory_compare: "stock-memory-search.ts",
  vice_symbols_load: "stock-symbols.ts",
  vice_symbols_lookup: "stock-symbols.ts",
  vice_vicii_get_state: "stock-vicii.ts",
  vice_cia_get_state: "stock-cia.ts",
  vice_sprite_get: "stock-sprites.ts",
  vice_sprite_inspect: "stock-sprites.ts",
  vice_cycles_stopwatch: "stock-timing.ts",
  vice_run_until: "stock-run-until.ts",
  vice_device_console: "text-tools.ts",
  vice_warp_set: "text-tools.ts",
  vice_memmap_show: "text-tools.ts",
  vice_memmap_zap: "text-tools.ts",
  vice_cpu_history: "text-tools.ts",
  vice_profile_flat: "text-tools.ts",
  vice_backtrace: "text-tools.ts",
  vice_io_registers: "text-tools.ts",
  vice_program_load: "text-tools.ts",
};

test("every DERIVED_TOOL_MODULES key is a STOCK_TOOLS name, and every pure tool is a key", () => {
  const toolNames = new Set(STOCK_TOOLS.map((t) => t.name));
  for (const name of Object.keys(DERIVED_TOOL_MODULES)) {
    assert.ok(toolNames.has(name), `${name} is in DERIVED_TOOL_MODULES but not in STOCK_TOOLS`);
  }
  for (const tool of STOCK_TOOLS.filter((t) => t.kind === "pure")) {
    assert.ok(tool.name in DERIVED_TOOL_MODULES, `pure tool ${tool.name} has no DERIVED_TOOL_MODULES entry`);
  }
});

test("every derived tool's module exists and is in the scanned set", () => {
  const scanned = new Set(scannedFiles().map((f) => relative(VICE_DIR, f)));
  for (const [toolName, moduleName] of Object.entries(DERIVED_TOOL_MODULES)) {
    assert.ok(existsSync(join(VICE_DIR, moduleName)), `${moduleName} (implementing ${toolName}) must exist`);
    assert.ok(scanned.has(moduleName), `${moduleName} (implementing ${toolName}) must be scanned`);
  }
});
