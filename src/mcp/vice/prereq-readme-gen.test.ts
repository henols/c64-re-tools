// prereq-readme-gen.test.ts -- the drift guard for README.md's generated
// prerequisite regions.
//
// WHAT A ROW SHOULD CONTAIN MUST NEVER EXIST IN TWO IMPLEMENTATIONS. This
// guard imports `prereq-readme-gen.ts`'s own derive functions and calls them
// on the real declaration; it only writes its own reader for what the
// committed README.md ACTUALLY contains, then compares the two as parsed
// records -- never as rendered bytes (D-10, mirroring resources-sync.test.ts's
// own "the banner text must never exist in two implementations" rule).
//
// WHAT NOT TO DO: do not re-derive what a row "should" contain here. If a
// row's expected shape needs to change, that is a change to
// `prereq-readme-gen.ts`'s derive functions, never a parallel calculation in
// this file.
//
// A permanently-green test is not evidence (ENGINEERING_RULES.md §6). The
// GEN-03 cases below plant a real divergence in a scratch copy of the real
// pair and watch the guard fail and name what moved; the tolerance cases
// prove the opposite direction -- a change that alters no fact leaves the
// guard green (roadmap criterion 4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync as writeFileSyncNode,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ECOSYSTEM_REGION,
  ECOSYSTEM_TABLE_COLUMNS,
  OVERVIEW_REGION,
  OVERVIEW_TABLE_COLUMNS,
  REGENERATE_COMMAND,
  VICE_PACKAGE_TOOL_IDS,
  deriveEcosystemRows,
  deriveOverviewRows,
  readDeclarationFile,
  regionMarkers,
} from "./prereq-readme-gen.ts";
import type { ToolDeclaration, ToolDeclarationRecord } from "./prereq-readme-gen.ts";

/** The plain `.git`-marker walk, copied from `phase58-citation-ledger.test.ts`
 * (itself mirrored from `phase50-findings-contract.test.ts`) -- this is
 * already the third copy in the tree (61-CONTEXT.md's Reusable Assets
 * note). `repo-root.ts`'s `repoRoot()` was checked first and rejected for
 * the same reason `prereq-readme-gen.ts` rejects it: its `CLAUDE_PROJECT_DIR`
 * branch can name a different tree than the one being generated and guarded. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(HERE);
const DECL_PATH = join(HERE, "prerequisites.json");
const README_PATH = join(REPO_ROOT, "README.md");

/** One parsed generated region: its header row's cells, its data rows'
 * cells, and any structural errors found while parsing. Never throws. */
export interface ParsedRegion {
  header: string[] | null;
  rows: string[][];
  errors: string[];
}

/** Splits one markdown table row into its cells: removes one leading and one
 * trailing pipe, then splits on `|`, trimming only each cell's surrounding
 * padding. No Unicode normalisation, no case folding, no inner-whitespace
 * collapsing, no backtick stripping -- the audit below must see exactly what
 * is on disk. */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cell.trim());
}

/** True when every cell of a row is a markdown table separator cell
 * (`---`, `:--`, `--:`, `:-:`, of any dash length). */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** Slices `markdownText` strictly between the named region's markers, keeps
 * only lines whose trimmed form starts with `|`, drops the separator row,
 * and treats the first remaining row as the header and the rest as data.
 * Never slices heading-to-EOF -- the install section is not the file's
 * final section. Never throws; a missing/duplicated marker pair or an empty
 * region is reported through `errors`. */
export function parseGeneratedRegion(markdownText: string, regionName: string): ParsedRegion {
  const { start, end } = regionMarkers(regionName);
  const startIdx = markdownText.indexOf(start);
  const endIdx = markdownText.indexOf(end);
  const startCount = (markdownText.match(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const endCount = (markdownText.match(new RegExp(end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;

  if (startCount !== 1 || endCount !== 1) {
    return {
      header: null,
      rows: [],
      errors: [
        `region "${regionName}": expected exactly one start marker and one end marker, found ${startCount} start / ${endCount} end`,
      ],
    };
  }
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { header: null, rows: [], errors: [`region "${regionName}": markers not found in the expected order`] };
  }

  const region = markdownText.slice(startIdx + start.length, endIdx);
  const tableLines = region
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (tableLines.length === 0) {
    return { header: null, rows: [], errors: [`region "${regionName}": no table rows found between markers`] };
  }

  const parsedRows = tableLines.map(splitTableRow).filter((cells) => !isSeparatorRow(cells));
  if (parsedRows.length === 0) {
    return { header: null, rows: [], errors: [`region "${regionName}": region carries zero data rows`] };
  }

  const [header, ...rows] = parsedRows;
  return { header: header!, rows, errors: [] };
}

/** Audits the ecosystem region: parses the committed README's region into
 * records with `parseGeneratedRegion`, derives the expected records with
 * `deriveEcosystemRows` (the generator's own function, never re-derived
 * here), and compares the two sides. Returns a `string[]` of named
 * failures, empty meaning pass -- mirroring `auditProvenanceCitations()`'s
 * never-throw contract. Every failure names the ecosystem id, both sides of
 * the disagreement, and `REGENERATE_COMMAND`. */
export function auditGeneratedReadme({ declPath, readmePath }: { declPath: string; readmePath: string }): string[] {
  const failures: string[] = [];

  let declaration: ToolDeclaration;
  try {
    declaration = readDeclarationFile({ declPath });
  } catch (err) {
    failures.push(`could not read/parse declaration at ${declPath}: ${(err as Error).message}`);
    return failures;
  }

  let readmeText: string;
  try {
    readmeText = readFileSync(readmePath, "utf8");
  } catch (err) {
    failures.push(`could not read README at ${readmePath}: ${(err as Error).message}`);
    return failures;
  }

  const parsed = parseGeneratedRegion(readmeText, ECOSYSTEM_REGION);
  if (parsed.errors.length > 0) {
    failures.push(...parsed.errors.map((e) => `${ECOSYSTEM_REGION}: ${e} -- run \`${REGENERATE_COMMAND}\``));
    return failures;
  }

  if (JSON.stringify(parsed.header) !== JSON.stringify(ECOSYSTEM_TABLE_COLUMNS)) {
    failures.push(
      `${ECOSYSTEM_REGION}: header row is ${JSON.stringify(parsed.header)}, expected ${JSON.stringify(ECOSYSTEM_TABLE_COLUMNS)} -- run \`${REGENERATE_COMMAND}\``,
    );
  }

  const expectedRows = deriveEcosystemRows(declaration);
  const expectedByEco = new Map(expectedRows.map((row) => [row.ecosystem, row]));
  const actualByEco = new Map<string, { platforms: string; text: string }>();
  for (const row of parsed.rows) {
    const [ecosystem, platforms, text] = row;
    if (ecosystem === undefined) continue;
    actualByEco.set(ecosystem, { platforms: platforms ?? "", text: text ?? "" });
  }

  for (const [ecosystem, expected] of expectedByEco) {
    const actual = actualByEco.get(ecosystem);
    if (!actual) {
      failures.push(
        `${ECOSYSTEM_REGION}: ${ecosystem}: declared in prerequisites.json but has no row in README.md -- run \`${REGENERATE_COMMAND}\``,
      );
      continue;
    }
    const expectedPlatforms = expected.platforms.join(", ");
    if (actual.platforms !== expectedPlatforms) {
      failures.push(
        `${ECOSYSTEM_REGION}: ${ecosystem}: platforms mismatch -- declaration says "${expectedPlatforms}", README says "${actual.platforms}" -- run \`${REGENERATE_COMMAND}\``,
      );
    }
    if (actual.text !== expected.text) {
      failures.push(
        `${ECOSYSTEM_REGION}: ${ecosystem}: install command mismatch -- declaration says ${JSON.stringify(expected.text)}, README says ${JSON.stringify(actual.text)} -- run \`${REGENERATE_COMMAND}\``,
      );
    }
  }

  for (const ecosystem of actualByEco.keys()) {
    if (!expectedByEco.has(ecosystem)) {
      failures.push(
        `${ECOSYSTEM_REGION}: ${ecosystem}: row in README names an ecosystem prerequisites.json does not declare -- run \`${REGENERATE_COMMAND}\``,
      );
    }
  }

  failures.push(...auditOverviewRegion(readmeText, declaration));

  return failures;
}

/** Audits the prerequisite overview region with the same relations
 * `auditGeneratedReadme` already applies to the ecosystem region: marker
 * well-formedness, an exact header match against `OVERVIEW_TABLE_COLUMNS`, a
 * non-empty data-row set, every declared record id present as a row, every
 * row id present in the declaration, and per-id equality of all four
 * remaining cells. Never throws; every failure names `REGENERATE_COMMAND`. */
function auditOverviewRegion(readmeText: string, declaration: ToolDeclaration): string[] {
  const failures: string[] = [];

  const parsed = parseGeneratedRegion(readmeText, OVERVIEW_REGION);
  if (parsed.errors.length > 0) {
    return parsed.errors.map((e) => `${OVERVIEW_REGION}: ${e} -- run \`${REGENERATE_COMMAND}\``);
  }

  if (JSON.stringify(parsed.header) !== JSON.stringify(OVERVIEW_TABLE_COLUMNS)) {
    failures.push(
      `${OVERVIEW_REGION}: header row is ${JSON.stringify(parsed.header)}, expected ${JSON.stringify(OVERVIEW_TABLE_COLUMNS)} -- run \`${REGENERATE_COMMAND}\``,
    );
  }

  const expectedRows = deriveOverviewRows(declaration);
  const expectedById = new Map(expectedRows.map((row) => [row.id, row]));
  const actualById = new Map<string, { skills: string; mcp: string; remedy: string; locationOverride: string }>();
  for (const row of parsed.rows) {
    const [id, skills, mcp, remedy, locationOverride] = row;
    if (id === undefined) continue;
    actualById.set(id, {
      skills: skills ?? "",
      mcp: mcp ?? "",
      remedy: remedy ?? "",
      locationOverride: locationOverride ?? "",
    });
  }

  for (const [id, expected] of expectedById) {
    const actual = actualById.get(id);
    if (!actual) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: declared in prerequisites.json but has no row in README.md -- run \`${REGENERATE_COMMAND}\``,
      );
      continue;
    }
    const expectedSkills = expected.skills.length > 0 ? expected.skills.join(", ") : "none";
    const expectedMcp = expected.mcp.length > 0 ? expected.mcp.join(", ") : "none";
    if (actual.skills !== expectedSkills) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: skills mismatch -- declaration says "${expectedSkills}", README says "${actual.skills}" -- run \`${REGENERATE_COMMAND}\``,
      );
    }
    if (actual.mcp !== expectedMcp) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: mcp mismatch -- declaration says "${expectedMcp}", README says "${actual.mcp}" -- run \`${REGENERATE_COMMAND}\``,
      );
    }
    if (actual.remedy !== expected.remedy) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: remedy mismatch -- declaration says ${JSON.stringify(expected.remedy)}, README says ${JSON.stringify(actual.remedy)} -- run \`${REGENERATE_COMMAND}\``,
      );
    }
    if (actual.locationOverride !== expected.locationOverride) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: location override mismatch -- declaration says ${JSON.stringify(expected.locationOverride)}, README says ${JSON.stringify(actual.locationOverride)} -- run \`${REGENERATE_COMMAND}\``,
      );
    }
  }

  for (const id of actualById.keys()) {
    if (!expectedById.has(id)) {
      failures.push(
        `${OVERVIEW_REGION}: ${id}: row in README names a record prerequisites.json does not declare -- run \`${REGENERATE_COMMAND}\``,
      );
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Fixture and mutation helpers shared by the GEN-03 (planted-divergence),
// tolerance and round-trip cases below. Every case that touches a filesystem
// path builds its own scratch pair and tears it down in a `finally` block --
// never a shared fixture -- per the fixture-per-case discipline
// `phase58-citation-ledger.test.ts` already follows (D-12).
// ---------------------------------------------------------------------------

/** Builds a fresh `mkdtempSync(tmpdir())` scratch pair seeded from the real,
 * committed `prerequisites.json` and `README.md` -- never a hand-written toy
 * fixture (D-12). `realpathSync` wraps the mkdtemp result because `/tmp` can
 * itself be a symlink on some hosts (see `host-tool.test.ts`'s identical
 * wrapper and its comment explaining why the bare call is not enough). The
 * caller MUST invoke `cleanup()` in a `finally` block. */
function withScratchPair(): { declPath: string; readmePath: string; cleanup: () => void } {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "prereq-readme-gen-")));
  const declPath = join(scratch, "prerequisites.json");
  const readmePath = join(scratch, "README.md");
  copyFileSync(DECL_PATH, declPath);
  copyFileSync(README_PATH, readmePath);
  return { declPath, readmePath, cleanup: () => rmSync(scratch, { recursive: true, force: true }) };
}

/** Reads a scratch declaration, applies `mutate` to the parsed object in
 * place, and writes the result back with the same
 * `JSON.stringify(decl, null, 2)` shape the generator itself would produce. */
function mutateScratchDeclaration(declPath: string, mutate: (decl: ToolDeclaration) => void): void {
  const decl = readDeclarationFile({ declPath });
  mutate(decl);
  writeFileSyncNode(declPath, JSON.stringify(decl, null, 2), "utf8");
}

/** Strips every data row out of `regionName` in `readmeText`, leaving the
 * banner comment, the header row and the separator row untouched -- an
 * emptied region must still be reported as a failure, never pass silently. */
function stripDataRows(readmeText: string, regionName: string): string {
  const { start, end } = regionMarkers(regionName);
  const startIdx = readmeText.indexOf(start);
  const endIdx = readmeText.indexOf(end);
  const before = readmeText.slice(0, startIdx + start.length);
  const region = readmeText.slice(startIdx + start.length, endIdx);
  const after = readmeText.slice(endIdx);

  let sepSeen = false;
  const kept = region.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) return true;
    const cells = splitTableRow(trimmed);
    if (isSeparatorRow(cells)) {
      sepSeen = true;
      return true;
    }
    return !sepSeen;
  });
  return before + kept.join("\n") + after;
}

/** Deletes one occurrence of a named region's marker (`"start"` or `"end"`)
 * from `readmeText` -- the "removed marker" GEN-03 case. */
function deleteRegionMarker(readmeText: string, regionName: string, which: "start" | "end"): string {
  const marker = regionMarkers(regionName)[which];
  const idx = readmeText.indexOf(marker);
  return readmeText.slice(0, idx) + readmeText.slice(idx + marker.length);
}

// ---------------------------------------------------------------------------
// Existing coverage from plan 61-01.
// ---------------------------------------------------------------------------

test("the committed declaration/README pair audits clean", () => {
  assert.deepEqual(auditGeneratedReadme({ declPath: DECL_PATH, readmePath: README_PATH }), []);
});

test("all three VICE_PACKAGE_TOOL_IDS derive identical ecosystem rows", () => {
  const declaration = readDeclarationFile({ declPath: DECL_PATH });
  const [first, ...rest] = VICE_PACKAGE_TOOL_IDS;
  const firstRows = deriveEcosystemRows(declaration, { toolId: first });
  assert.ok(firstRows.length > 0, "x64sc must derive at least one ecosystem row");
  for (const toolId of rest) {
    assert.deepEqual(
      deriveEcosystemRows(declaration, { toolId }),
      firstRows,
      `${toolId} must derive the same ecosystem rows as ${first} -- rendering the VICE remedy tree once is only justified if all three package members agree`,
    );
  }
});

test("every declared record id has exactly one overview row, and every overview row id is a declared record", () => {
  const declaration = readDeclarationFile({ declPath: DECL_PATH });
  const declaredIds = Object.keys(declaration.tools);
  const overviewRows = deriveOverviewRows(declaration);
  const rowIds = overviewRows.map((row) => row.id);
  assert.deepEqual(new Set(rowIds), new Set(declaredIds), "the overview's row-id set must equal the declaration's own id set");
  assert.equal(rowIds.length, declaredIds.length, "no declared id may produce more than one overview row");
});

test("the committed overview region audits clean", () => {
  const readmeText = readFileSync(README_PATH, "utf8");
  const declaration = readDeclarationFile({ declPath: DECL_PATH });
  assert.deepEqual(auditOverviewRegion(readmeText, declaration), []);
});

test("prereq-readme-gen.ts is absent from package.json's files[] array (repo tooling, never shipped)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("prereq-readme-gen.ts"),
    false,
    "prereq-readme-gen.ts is repo tooling that generates README.md; it must never ship in the published npm tarball (D-13)",
  );
});

// ---------------------------------------------------------------------------
// GEN-03: planted-divergence cases. Each builds its own scratch pair from
// the real committed files (D-12), mutates one side only, and asserts the
// returned failure array names the record/ecosystem that diverged and the
// exact command that fixes it -- never merely that the array is non-empty.
// ---------------------------------------------------------------------------

test("GEN-03: a planted divergence in a scratch copy is caught, the diverged ecosystem is named, and the fix command is named", () => {
  const { declPath, readmePath, cleanup } = withScratchPair();
  try {
    mutateScratchDeclaration(declPath, (decl) => {
      const linuxEntries = decl.tools.x64sc!.remedies.linux!;
      const target = linuxEntries.find((e) => e.ecosystem === "debian-trixie")!;
      target.text = "MUTATED FOR TEST";
    });
    // The scratch README is left unregenerated -- it still names the
    // original text, which is what the guard must catch.

    const failures = auditGeneratedReadme({ declPath, readmePath });
    assert.ok(failures.length > 0, "a planted divergence must be caught, never pass silently");
    assert.ok(
      failures.some((f) => f.includes("debian-trixie")),
      `the guard must NAME the diverged ecosystem; got ${JSON.stringify(failures)}`,
    );
    assert.ok(
      failures.some((f) => f.includes(REGENERATE_COMMAND)),
      `a red run must tell a developer what to run; got ${JSON.stringify(failures)}`,
    );
  } finally {
    cleanup();
  }
});

test("GEN-03: a changed universal remedy is caught and names the diverged record, proving the failure direction reaches the overview region too", () => {
  const { declPath, readmePath, cleanup } = withScratchPair();
  try {
    mutateScratchDeclaration(declPath, (decl) => {
      const universal = decl.tools.ghidra!.remedies.universal!;
      universal[0]!.text = "MUTATED UNIVERSAL REMEDY FOR TEST";
    });

    const failures = auditGeneratedReadme({ declPath, readmePath });
    assert.ok(failures.length > 0, "a planted divergence in a universal remedy must be caught");
    assert.ok(
      failures.some((f) => f.includes("ghidra")),
      `the guard must NAME the diverged record; got ${JSON.stringify(failures)}`,
    );
    assert.ok(
      failures.some((f) => f.includes(REGENERATE_COMMAND)),
      `a red run must tell a developer what to run; got ${JSON.stringify(failures)}`,
    );
  } finally {
    cleanup();
  }
});

test("GEN-03: a removed record leaves an orphaned row the declaration no longer carries", () => {
  const { declPath, readmePath, cleanup } = withScratchPair();
  try {
    mutateScratchDeclaration(declPath, (decl) => {
      const tools = decl.tools as Record<string, ToolDeclarationRecord | undefined>;
      delete tools.dxa;
    });
    // The scratch README is left unregenerated -- it still carries dxa's row.

    const failures = auditGeneratedReadme({ declPath, readmePath });
    assert.ok(failures.length > 0, "a removed record must produce a failure, never pass silently");
    assert.ok(
      failures.some((f) => f.includes("dxa") && f.includes(REGENERATE_COMMAND)),
      `the guard must name the orphaned record and the fix command; got ${JSON.stringify(failures)}`,
    );
  } finally {
    cleanup();
  }
});

test("GEN-03: an emptied ecosystem region -- markers and header intact, zero data rows -- is reported rather than passing silently", () => {
  const { declPath, readmePath, cleanup } = withScratchPair();
  try {
    const text = readFileSync(readmePath, "utf8");
    writeFileSyncNode(readmePath, stripDataRows(text, ECOSYSTEM_REGION), "utf8");
    // The scratch declaration is left untouched -- D-12's planted divergence
    // this time is on the README side only.

    const failures = auditGeneratedReadme({ declPath, readmePath });
    assert.ok(failures.length > 0, "an emptied generated region must never audit as clean");
    assert.ok(
      failures.some((f) => f.includes(REGENERATE_COMMAND)),
      `an emptied region's failure must still name the fix command; got ${JSON.stringify(failures)}`,
    );
  } finally {
    cleanup();
  }
});

test("GEN-03: a removed end marker is reported as a malformed region and never throws", () => {
  const { declPath, readmePath, cleanup } = withScratchPair();
  try {
    const text = readFileSync(readmePath, "utf8");
    writeFileSyncNode(readmePath, deleteRegionMarker(text, OVERVIEW_REGION, "end"), "utf8");

    const failures = auditGeneratedReadme({ declPath, readmePath });
    assert.ok(failures.length > 0, "a malformed marker pair must be reported, never pass silently");
    assert.ok(
      failures.some((f) => f.includes(OVERVIEW_REGION)),
      `the malformed region must be named; got ${JSON.stringify(failures)}`,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scratch hygiene: runs last, after every fixture case above has built and
// torn down its own scratch tree, and asserts none of them leaked a path
// into the repository tree itself (T-61-05/T-61-06).
// ---------------------------------------------------------------------------

test("no untracked scratch path leaks under the repository tree after every fixture case above has run", () => {
  const output = execFileSync("git", ["-C", REPO_ROOT, "status", "--porcelain"], { encoding: "utf8" });
  const untracked = output.split("\n").filter((line) => line.startsWith("??"));
  const leaked = untracked.filter((line) => line.includes("prereq-readme-gen-"));
  assert.deepEqual(
    leaked,
    [],
    `no untracked path from this file's scratch prefix may remain after the run; got ${JSON.stringify(untracked)}`,
  );
});
