// Enforces the dependency rules between the parts of the repository by
// scanning every import in src/, skills/ and distribution/.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCANNED = ["src", "skills", "distribution"];
const AP_SDK = "@jalco/ap-sdk";

/** The ownership area of a repository-relative path, or undefined outside every area. */
function areaOf(path: string): string | undefined {
  const parts = path.split("/");
  if (parts[0] === "src") {
    if (parts.length === 2) {
      const leaf = parts[1]!.replace(/(\.test|\.testkit)?\.ts$/, "");
      return ["address", "assembler", "build-name", "c64-keys", "c64", "compare", "cpu", "errors", "graphics", "machine", "media", "opcodes", "package", "platform", "project", "script", "spectrum", "time", "trace", "vsf", "zip"].includes(leaf) ? leaf : undefined;
    }
    const dir = parts[1]!;
    return ["mcp", "host-client", "host", "knowledge", "cli", "assembler", "cpu", "native", "platform", "protocol"].includes(dir) ? dir : undefined;
  }
  if (parts[0] === "skills" && parts.length > 2) return `skill:${parts[1]}`;
  // The one-off conversion of an old knowledge.db is no part of the package edge.
  if (parts[0] === "distribution") return parts[1] === "convert-knowledge.ts" ? "convert" : "distribution";
  return undefined;
}

/** Areas each area may import besides itself. */
const ALLOWED: Record<string, readonly string[]> = {
  // The error codes and the refusal class import nothing.
  errors: [],
  // Addresses as text, ranges, tables of addresses: every area uses them.
  address: [],
  c64: [],
  // The name of a build and of its symbols file: c64-assembler and retro-source name a program by what it is.
  "build-name": [],
  // The byte check of a PRG against a reference: the build of c64-assembler and the unpack of c64-packer.
  compare: ["c64"],
  // The ACME spelling of each 6510 opcode: retro-source and the listing of retro-knowledge decode with one table.
  opcodes: ["c64"],
  // The platform memory maps: names and meanings of the addresses of each machine.
  platform: ["c64", "cpu", "machine"],
  // The CPU of a machine for the analysis: instruction lengths, flow and text (6502, Z80), and the coverage flows.
  cpu: ["opcodes"],
  // The assembler of a machine: the rules for patch code and macro bodies in its syntax.
  assembler: ["opcodes"],
  // ZX Spectrum media and snapshots: TAP and TZX blocks, .z80 and .sna.
  spectrum: [],
  // A machine: its CPU, its spaces, its assembler and its Ghidra language.
  machine: ["cpu", "assembler"],
  // Indexed images: the PNG encoder of emulator frames, and sprites and bitmaps as images.
  graphics: [],
  // The one time format (ISO 8601 at +01:00).
  time: [],
  // A zip archive of files given as bytes: the package of an exported project.
  zip: [],
  // The opt-in trace of a process, for people. Every program may write to it.
  trace: ["time"],
  project: ["c64"],
  protocol: ["c64", "c64-keys", "machine"],
  // The package name and channel: the npx command in refusals and help texts.
  package: [],
  // Media file signatures and sizes: the host checks a file before VICE gets it, and c64-disk reads it.
  media: [],
  // The keys of the keyboard matrix: the press of VICE, of the replay core and of the play page.
  "c64-keys": [],
  // The modules of a VICE snapshot file, and the changes that press keys in it.
  vsf: ["media"],
  "host-client": ["protocol", "c64", "c64-keys", "cpu", "project", "trace", "package", "machine"],
  mcp: ["host-client", "protocol", "c64", "c64-keys", "cpu", "trace", "package", "machine"],
  host: ["native", "protocol", "c64", "c64-keys", "cpu", "graphics", "opcodes", "trace", "package", "media", "vsf", "machine", "spectrum"],
  // opcodes: one rule for a name that ACME can take as a label.
  knowledge: ["c64", "cpu", "machine", "project", "time", "opcodes"],
  // The call contract of the skill scripts: the command line, the values, the envelope.
  script: ["protocol", "project", "trace", "c64", "machine"],
  // Running native tools (processes, workspaces, ACME, DXA, Ghidra): shared by the host and the skill scripts.
  native: ["protocol", "c64", "trace", "cpu", "machine"],
  // The installation and status edge: host tool status through the host-client, local tool status through native.
  cli: ["host-client", "native", "protocol", "script", "distribution", "trace", "package", "machine"],
  distribution: ["package", "machine"],
  convert: ["knowledge"],
};
const SKILL_ALLOWED = ["build-name", "c64-keys", "c64", "compare", "cpu", "graphics", "host-client", "knowledge", "machine", "media", "native", "opcodes", "package", "platform", "project", "script", "spectrum", "time", "vsf", "zip"];

/**
 * Checks one import. `from` is the repository-relative importing file.
 * Returns a violation message, or undefined when the import is allowed.
 */
function checkImport(from: string, specifier: string): string | undefined {
  const source = areaOf(from);
  if (source === undefined) return undefined;

  if (specifier.startsWith("#src/")) return checkTarget(from, source, `src/${specifier.slice("#src/".length)}`);
  if (!specifier.startsWith(".")) {
    if (specifier === AP_SDK || specifier.startsWith(`${AP_SDK}/`)) {
      return source === "cli" || source === "distribution"
        ? undefined
        : `${from}: ${AP_SDK} is allowed only in the CLI and distribution edge`;
    }
    return undefined;
  }

  const target = relative(ROOT, resolve(ROOT, dirname(from), specifier)).split(sep).join("/");
  // An installed skill holds its own scripts and a copy of src/ reached through #src/*.
  if (source.startsWith("skill:") && areaOf(target) !== source) return `${from}: a skill reaches src/ through #src/, never through ${specifier}`;
  return checkTarget(from, source, target);
}

function checkTarget(from: string, source: string, target: string): string | undefined {
  const targetArea = areaOf(target);
  if (targetArea === undefined) return `${from}: imports ${target}, which is outside every source area`;
  if (targetArea === source) return undefined;
  // The one list of error codes and the one refusal class: every area reports failures with them.
  // The one address format: every area reads and writes addresses with it.
  if (targetArea === "errors" || targetArea === "address") return undefined;

  const allowed = source.startsWith("skill:") ? SKILL_ALLOWED : (ALLOWED[source] ?? []);
  return allowed.includes(targetArea) ? undefined : `${from}: ${source} must not import ${targetArea} (${target})`;
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function importsOf(text: string): string[] {
  const found: string[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of text.matchAll(pattern)) found.push(match[1]!);
  }
  return found;
}

function* typescriptFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* typescriptFiles(path);
    else if (entry.name.endsWith(".ts")) yield path;
  }
}

test("checkImport refuses every forbidden direction", () => {
  const refused: Array<[string, string]> = [
    ["src/host/server.ts", "../mcp/server.ts"],
    ["src/host/vice/session.ts", "../../knowledge/read.ts"],
    ["src/host/tools/acme.ts", "../../knowledge/write.ts"],
    ["src/host/server.ts", "../host-client/connect.ts"],
    ["src/mcp/tools/memory.ts", "../../host/vice/session.ts"],
    ["src/mcp/server.ts", "../knowledge/read.ts"],
    ["src/mcp/server.ts", "../project.ts"],
    ["src/knowledge/read.ts", "../host/server.ts"],
    ["src/knowledge/read.ts", "../mcp/server.ts"],
    ["src/knowledge/read.ts", "../host-client/tools.ts"],
    ["src/knowledge/read.ts", "../protocol/messages.ts"],
    ["src/host-client/tools.ts", "../knowledge/read.ts"],
    ["src/c64.ts", "./protocol/messages.ts"],
    ["src/protocol/messages.ts", "../host/server.ts"],
    ["src/host/server.ts", "../../skills/c64-disk/scripts/disk.ts"],
    ["skills/c64-disk/scripts/disk.ts", "../../c64-basic/scripts/basic.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/host/tools/c1541.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/mcp/server.ts"],
    ["skills/c64-disk/scripts/disk.ts", "../../../src/host-client/tools.ts"],
    ["src/mcp/server.ts", AP_SDK],
    ["skills/c64-disk/scripts/disk.ts", AP_SDK],
    ["src/cli/main.ts", "../mcp/server.ts"],
    ["src/cli/main.ts", "../host/server.ts"],
    ["src/cli/main.ts", "../knowledge/read.ts"],
    ["src/cli/main.ts", "../project.ts"],
    ["distribution/plugin.ts", "../src/c64.ts"],
    ["distribution/plugin.ts", "../src/project.ts"],
    ["src/script.ts", "./knowledge/database.ts"],
    ["src/script.ts", "./host-client/tools.ts"],
    ["src/script.ts", "./knowledge/read.ts"],
    ["src/mcp/server.ts", "../script.ts"],
    ["src/host/server.ts", "../script.ts"],
    ["src/knowledge/database.ts", "../script.ts"],
    ["src/protocol/vice.ts", "../host/server.ts"],
    ["src/protocol/vice.ts", "../script.ts"],
    ["src/knowledge/read.ts", "../protocol/vice.ts"],
    ["src/c64.ts", "./protocol/framing.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/protocol/messages.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/protocol/tools.ts"],
    ["src/trace.ts", "./protocol/messages.ts"],
    ["src/time.ts", "./trace.ts"],
    ["src/c64.ts", "./trace.ts"],
    ["src/knowledge/write.ts", "../trace.ts"],
    ["distribution/plugin.ts", "../src/trace.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/trace.ts"],
    ["src/graphics.ts", "./host/vice/screen.ts"],
    ["src/mcp/server.ts", "../graphics.ts"],
  ];
  for (const [from, specifier] of refused) {
    assert.notEqual(checkImport(from, specifier), undefined, `${from} -> ${specifier} must be refused`);
  }
});

test("checkImport accepts every allowed direction", () => {
  const accepted: Array<[string, string]> = [
    ["src/mcp/server.ts", "../host-client/vice-session.ts"],
    ["src/host/vice/session.ts", "../../graphics.ts"],
    ["skills/retro-docs/scripts/docs.ts", "#src/graphics.ts"],
    ["src/mcp/tools/memory.ts", "../../c64.ts"],
    ["src/host-client/connect.ts", "../protocol/messages.ts"],
    ["src/host-client/transfer.ts", "../project.ts"],
    ["src/host/vice/session.ts", "../../protocol/vice.ts"],
    ["src/host/vice/session.ts", "./process.ts"],
    ["src/knowledge/read.ts", "../project.ts"],
    ["src/host-client/connect.test.ts", "../protocol/framing.testkit.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/host-client/tools.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/knowledge/write.ts"],
    ["skills/c64-disk/scripts/disk.ts", "./helpers.ts"],
    ["distribution/plugin.ts", AP_SDK],
    ["src/cli/main.ts", "../../distribution/plugin.ts"],
    ["src/host/server.ts", "node:net"],
    ["src/script.ts", "./protocol/messages.ts"],
    ["src/script.ts", "./project.ts"],
    ["src/script.ts", "./c64.ts"],
    ["src/knowledge/read.ts", "../errors.ts"],
    ["src/c64.ts", "./errors.ts"],
    ["src/cli/main.ts", "../script.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/script.ts"],
    ["src/protocol/framing.testkit.ts", "./messages.ts"],
    ["src/protocol/vice.ts", "./framing.ts"],
    ["src/protocol/vice.ts", "../c64.ts"],
    ["src/mcp/tools/memory.ts", "../../protocol/vice.ts"],
    ["src/host/server.ts", "../protocol/tools.ts"],
    ["src/host-client/connect.ts", "../protocol/framing.ts"],
    ["src/native/run.ts", "../protocol/tools.ts"],
    ["src/cli/main.ts", "../protocol/tools.ts"],
    ["src/trace.ts", "./time.ts"],
    ["src/knowledge/write.ts", "../time.ts"],
    ["src/host/server.ts", "../trace.ts"],
    ["src/host-client/connect.ts", "../trace.ts"],
    ["src/native/run.ts", "../trace.ts"],
    ["src/script.ts", "./trace.ts"],
    ["skills/c64-disk/scripts/disk.ts", "#src/time.ts"],
  ];
  for (const [from, specifier] of accepted) {
    assert.equal(checkImport(from, specifier), undefined);
  }
});

test("every import in the tree follows the dependency rules", () => {
  const violations: string[] = [];
  let scanned = 0;
  for (const top of SCANNED) {
    const dir = join(ROOT, top);
    if (!existsSync(dir)) continue;
    for (const file of typescriptFiles(dir)) {
      scanned++;
      const from = relative(ROOT, file).split(sep).join("/");
      for (const specifier of importsOf(readFileSync(file, "utf8"))) {
        const violation = checkImport(from, specifier);
        if (violation !== undefined) violations.push(violation);
      }
    }
  }
  assert.ok(scanned > 0, "no source files were scanned");
  assert.deepEqual(violations, []);
});
