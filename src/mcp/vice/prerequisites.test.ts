// prerequisites.test.ts -- the one authoritative structural gate over
// src/mcp/vice/prerequisites.json (DECL-01/02/04/05, phase 58 plan 01). This
// file is the single place that proves the committed prerequisite
// declaration is shaped safely: no version floor outside the `node` record,
// no field shaped so a caller could hand it straight to a process spawner,
// every `unblocks.skills`/`unblocks.mcp` value inside its closed
// vocabulary, and every citation's source resolving to something real.
//
// Every validator below is a named, exported function so the real-committed-
// document case and its planted-violation case run the SAME code -- the
// version-floor guard's planted-violation case is what keeps that guard
// from passing vacuously (a validator with no planted-violation case cannot
// tell "always passes" from "correctly passes").
//
// DECL-05's packaging proof lives HERE, not in a standalone
// scripts/check-npm-packages.mjs. That script (and its sibling
// check-no-skill-external-spawn.mjs) was retired on the owner's call in
// d0e9fb2e ("build: reduce CI to a correctness gate and make the git tag the
// version") -- the SAME day this plan was authored, for a reason unrelated
// to this file: what those two scripts enforced is now project convention,
// not a standalone mechanical gate, and scripts/ no longer exists as a
// place this phase can add to. DECL-05 itself still requires a non-vacuous,
// tarball-list-based proof -- never a repo-path `existsSync` -- so this file
// reads the packed tarball's OWN file list via `npm pack --dry-run --json`,
// the exact technique the retired script used, rather than reintroducing a
// standalone script the owner just removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
// Type-only: erased at compile time, so importing it directly from the
// host-bound `.mts` source (rather than the built `resources/host-tool.mjs`
// artifact) never triggers that module's own runtime resolution of its
// sibling `./backend-detect.mjs` -- which only exists once built. The
// RUNTIME value `HOST_TOOL_IDS` is read from the built artifact below,
// exactly as host-tool.test.ts and host-tool-oracle.test.ts already do.
import type { HostToolId } from "./host-tool.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const SKILLS_DIR = resolve(HERE, "..", "..", "skills");

// Build BEFORE importing the artifact -- host-tool.test.ts's own idiom --
// so this suite never reads a stale committed resources/host-tool.mjs.
build();
const hostTool = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  HOST_TOOL_IDS: readonly HostToolId[];
};
const { HOST_TOOL_IDS } = hostTool;

export interface RemedyEntry {
  ecosystem: string;
  text: string;
  provenance: string;
  source: string;
}

export interface ToolRecord {
  id: string;
  unblocks: { skills: string[]; mcp: string[] };
  versionFloor?: string;
  remedies?: Record<string, RemedyEntry[]>;
}

export interface PrerequisitesDoc {
  schemaVersion: number;
  tools: Record<string, ToolRecord>;
}

const PLATFORM_KEYS = new Set(["linux", "darwin", "win32", "universal"]);
const PROVENANCE_VALUES = new Set(["measured", "carried", "authored"]);

/** Reads and `JSON.parse`s the committed declaration. The one function
 * every case in this file starts from, so a future consumer copies this
 * instead of re-deriving the path. Never writes to the committed file. */
export function readPrerequisites(): PrerequisitesDoc {
  return JSON.parse(readFileSync(join(HERE, "prerequisites.json"), "utf8")) as PrerequisitesDoc;
}

/** DECL-04 / T-58-01 companion: rejects a document where any record OTHER
 * than `node` carries a `versionFloor` field. Returns the offending record
 * ids (empty = pass) rather than throwing, so both the real-file case and
 * the planted-violation case assert on the SAME shape. */
export function assertNoStrayVersionFloor(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  for (const [id, record] of Object.entries(doc.tools)) {
    if (id === "node") continue;
    if (Object.prototype.hasOwnProperty.call(record, "versionFloor")) offenders.push(id);
  }
  return offenders;
}

/** T-58-01 mitigation: rejects any structured-command-shaped key anywhere
 * in the document (a bare `argv`/`cmd`/`args` key at any depth). A remedy
 * is a prose sentence containing a command, never a key a future reader
 * could hand straight to a process spawner. */
export function assertNoExecutableShape(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  const EXEC_KEY_RE = /^(argv|cmd|args)$/;
  function walk(node: unknown, path: string): void {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (EXEC_KEY_RE.test(k)) offenders.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    }
  }
  walk(doc, "$");
  return offenders;
}

/** D-08 mitigation: every `unblocks.skills` value must name a real
 * directory under `src/skills/`; every `unblocks.mcp` value must be a
 * member of `HOST_TOOL_IDS`; every `remedies` platform key must be one of
 * the four permitted keys. Both vocabularies are asserted as a subset
 * relation, never a record count. */
export function assertClosedVocabularies(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  const skillDirs = new Set(readdirSync(SKILLS_DIR));
  const hostToolIds = new Set<string>(HOST_TOOL_IDS);
  for (const [id, record] of Object.entries(doc.tools)) {
    for (const s of record.unblocks.skills) {
      if (!skillDirs.has(s)) offenders.push(`${id}.unblocks.skills:${s}`);
    }
    for (const m of record.unblocks.mcp) {
      if (!hostToolIds.has(m)) offenders.push(`${id}.unblocks.mcp:${m}`);
    }
    for (const platform of Object.keys(record.remedies ?? {})) {
      if (!PLATFORM_KEYS.has(platform)) offenders.push(`${id}.remedies:${platform}`);
    }
  }
  return offenders;
}

/** D-03 / T-58-04 mitigation: every `carried`/`measured` source's path part
 * must resolve to a file present in the repository; every `authored`
 * source must be an https URL. A record may not claim a provenance it
 * cannot point at. */
export function assertSourcesResolve(doc: PrerequisitesDoc): string[] {
  const offenders: string[] = [];
  for (const [id, record] of Object.entries(doc.tools)) {
    for (const [platform, entries] of Object.entries(record.remedies ?? {})) {
      for (const entry of entries) {
        if (!PROVENANCE_VALUES.has(entry.provenance)) {
          offenders.push(`${id}.${platform}.${entry.ecosystem}: unknown provenance ${entry.provenance}`);
          continue;
        }
        if (entry.provenance === "authored") {
          if (!/^https:\/\//.test(entry.source)) {
            offenders.push(`${id}.${platform}.${entry.ecosystem}: authored source is not https -- ${entry.source}`);
          }
          continue;
        }
        const filePart = entry.source.replace(/:[0-9-]+$/, "");
        if (!existsSync(join(REPO_ROOT, filePart))) {
          offenders.push(`${id}.${platform}.${entry.ecosystem}: ${entry.provenance} source does not resolve -- ${entry.source}`);
        }
      }
    }
  }
  return offenders;
}

test("readPrerequisites: schemaVersion is 1 and tools carries x64sc", () => {
  const doc = readPrerequisites();
  assert.equal(doc.schemaVersion, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(doc.tools, "x64sc"));
});

test("tools.x64sc.id equals its own key", () => {
  const doc = readPrerequisites();
  assert.equal(doc.tools.x64sc!.id, "x64sc");
});

test("tools.x64sc.unblocks.skills/mcp are arrays inside their closed vocabularies", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertClosedVocabularies(doc), []);
  assert.ok(Array.isArray(doc.tools.x64sc!.unblocks.skills));
  assert.ok(Array.isArray(doc.tools.x64sc!.unblocks.mcp));
});

test("tools.x64sc.remedies has exactly linux/darwin/win32, linux in README row order", () => {
  const doc = readPrerequisites();
  const remedies = doc.tools.x64sc!.remedies!;
  assert.deepEqual(new Set(Object.keys(remedies)), new Set(["linux", "darwin", "win32"]));
  assert.deepEqual(
    remedies.linux!.map((e) => e.ecosystem),
    ["debian-trixie", "debian-forky", "ubuntu-2510", "arch", "fedora-rpmfusion", "alpine-edge", "homebrew"],
  );
});

test("every remedy entry carries all four fields, a valid provenance, and no platform key maps to an empty array", () => {
  const doc = readPrerequisites();
  for (const record of Object.values(doc.tools)) {
    for (const entries of Object.values(record.remedies ?? {})) {
      assert.ok(entries.length > 0, "a remedies platform key must never map to an empty array");
      for (const entry of entries) {
        assert.equal(typeof entry.ecosystem, "string");
        assert.equal(typeof entry.text, "string");
        assert.equal(typeof entry.source, "string");
        assert.ok(PROVENANCE_VALUES.has(entry.provenance), `unexpected provenance ${entry.provenance}`);
      }
    }
  }
});

test("the debian-trixie remedy text, backticks stripped, matches README.md line 101 character for character", () => {
  const doc = readPrerequisites();
  const entry = doc.tools.x64sc!.remedies!.linux!.find((e) => e.ecosystem === "debian-trixie")!;
  const readmeLine = readFileSync(join(REPO_ROOT, "README.md"), "utf8").split("\n")[100]!;
  const cell = readmeLine.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")[1]!.trim().replace(/`/g, "");
  assert.equal(entry.text, cell);
});

test("assertSourcesResolve: every carried/measured source resolves on disk; every authored source is https", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertSourcesResolve(doc), []);
});

test("tools.x64sc has no versionFloor key", () => {
  const doc = readPrerequisites();
  assert.equal(Object.prototype.hasOwnProperty.call(doc.tools.x64sc, "versionFloor"), false);
});

test("DECL-04: tools.node.versionFloor is byte-equal to vice's own engines.node, and it is the ONLY versionFloor field in the whole document", () => {
  const doc = readPrerequisites();
  const enginesNode = (JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { engines: { node: string } }).engines.node;
  assert.equal(doc.tools.node!.versionFloor, enginesNode);

  const floorCarriers = Object.entries(doc.tools).filter(([, r]) => Object.prototype.hasOwnProperty.call(r, "versionFloor"));
  assert.deepEqual(
    floorCarriers.map(([id]) => id),
    ["node"],
    "exactly one record may carry a versionFloor field, and it must be the node record",
  );

  const raw = readFileSync(join(HERE, "prerequisites.json"), "utf8");
  assert.equal((raw.match(/"versionFloor"\s*:/g) ?? []).length, 1);
});

test("all eight required tool ids are present (subset relation over the required set, never a record count)", () => {
  const doc = readPrerequisites();
  const required = ["x64sc", "c1541", "petcat", "acme", "acme-lib", "ghidra", "dxa", "node"];
  const have = new Set(Object.keys(doc.tools));
  const missing = required.filter((id) => !have.has(id));
  assert.deepEqual(missing, []);
});

test("D-06: x64sc/c1541/petcat share one OS package -- their linux remedy ecosystem order and text are byte-identical in all three pairwise directions", () => {
  const doc = readPrerequisites();
  const linuxOf = (id: string) => doc.tools[id]!.remedies!.linux!;
  const ecosystems = (id: string) => linuxOf(id).map((e) => e.ecosystem);
  const texts = (id: string) => linuxOf(id).map((e) => e.text).join(" ");

  assert.deepEqual(ecosystems("x64sc"), ecosystems("c1541"));
  assert.deepEqual(ecosystems("c1541"), ecosystems("petcat"));
  assert.deepEqual(ecosystems("petcat"), ecosystems("x64sc"));

  assert.equal(texts("x64sc"), texts("c1541"));
  assert.equal(texts("c1541"), texts("petcat"));
  assert.equal(texts("petcat"), texts("x64sc"));
});

test("D-07: acme and acme-lib are two distinct records with different remedy sources", () => {
  const doc = readPrerequisites();
  const acmeSource = doc.tools.acme!.remedies!.universal![0]!.source;
  const acmeLibSource = doc.tools["acme-lib"]!.remedies!.universal![0]!.source;
  assert.notEqual(acmeSource, acmeLibSource);
});

test("D-14/D-15: exactly one remedy entry in the whole document is graded measured, and it points at the one command CI executes", () => {
  const doc = readPrerequisites();
  const measured: string[] = [];
  for (const record of Object.values(doc.tools)) {
    for (const entries of Object.values(record.remedies ?? {})) {
      for (const entry of entries) {
        if (entry.provenance === "measured") measured.push(entry.source);
      }
    }
  }
  assert.deepEqual(measured, [".github/workflows/ci.yml:78"]);
});

test("tools.dxa.remedies has the single key universal with exactly one entry naming the vendored build command", () => {
  const doc = readPrerequisites();
  const remedies = doc.tools.dxa!.remedies!;
  assert.deepEqual(Object.keys(remedies), ["universal"]);
  assert.equal(remedies.universal!.length, 1);
  const entry = remedies.universal![0]!;
  assert.match(entry.text, /vendor\/dxa\/build\.bash build/);
  assert.match(entry.source, /^src\/mcp\/vice\/host-tool\.mts:/);
});

test("assertNoStrayVersionFloor: passes on the real, unmodified document", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertNoStrayVersionFloor(doc), []);
});

test("structural (T-58-01): assertNoStrayVersionFloor's planted violation is reported and the real document is not (non-vacuity)", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertNoStrayVersionFloor(doc), [], "the real, unmodified document must pass");

  const mutated = structuredClone(doc);
  (mutated.tools.x64sc as ToolRecord).versionFloor = ">=99.0.0";
  const offenders = assertNoStrayVersionFloor(mutated);
  assert.deepEqual(offenders, ["x64sc"], "a version-floor field planted on a non-node record must be reported");
});

test("structural (T-58-01): assertNoExecutableShape passes on the real document and rejects a planted argv key (non-vacuity)", () => {
  const doc = readPrerequisites();
  assert.deepEqual(assertNoExecutableShape(doc), [], "the real, unmodified document must pass");

  const mutated = structuredClone(doc) as unknown as { tools: Record<string, ToolRecord & { argv?: string[] }> };
  mutated.tools.x64sc = { ...mutated.tools.x64sc!, argv: ["sudo", "apt", "install", "vice"] };
  const offenders = assertNoExecutableShape(mutated as unknown as PrerequisitesDoc);
  assert.ok(offenders.some((o) => o.endsWith(".argv")), "a planted argv key must be reported");
});

test("no key anywhere in the committed document is a structured-command key (grep-shaped census)", () => {
  const raw = readFileSync(join(HERE, "prerequisites.json"), "utf8");
  assert.equal((raw.match(/"(argv|cmd|args)"\s*:/g) ?? []).length, 0);
});

test("encoding: prerequisites.json has no UTF-8 BOM and every key is ASCII-only", () => {
  const buf = readFileSync(join(HERE, "prerequisites.json"));
  assert.notEqual(buf.subarray(0, 3).toString("hex"), "efbbbf");
  const raw = buf.toString("utf8");
  const keys = [...raw.matchAll(/"([^"]*)"\s*:/g)].map((m) => m[1]!);
  const nonAsciiKeys = keys.filter((k) => /[^\x00-\x7f]/.test(k));
  assert.deepEqual(nonAsciiKeys, []);
});

// ---------------------------------------------------------------------------
// DECL-05 packaging proof (T-58-02 mitigation). Reads the PACKED tarball's
// OWN file list via `npm pack --dry-run --json` -- never a repo-path
// `existsSync` -- so a `files[]` entry that does not survive packing is
// caught here rather than by an end user who installed rather than cloned.
// See this file's header for why this lives here instead of the retired
// scripts/check-npm-packages.mjs.
// ---------------------------------------------------------------------------

function packedFileList(): string[] {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: HERE, encoding: "utf8" });
  const parsed = JSON.parse(out) as Array<{ files: Array<{ path: string }> }>;
  return parsed[0]!.files.map((f) => f.path);
}

test("packaging (DECL-05): prerequisites.json is present in the packed tarball's own file list", () => {
  const files = packedFileList();
  assert.ok(
    files.includes("prerequisites.json"),
    "vice-mcp: missing prerequisites.json in the packed tarball -- DECL-05 requires the same remedies to reach a user who installed rather than cloned",
  );
});
