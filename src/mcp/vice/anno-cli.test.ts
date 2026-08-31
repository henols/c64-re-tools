// anno-cli.test.ts -- coverage for the TWO-VERB CLI (D-14, 2026-08-29).
//
// This file used to test eight verbs. Six of them were delivery paths for the
// retired external analyser this project rented an annotation store from, and
// they went in one commit together with their tests. What is left is exactly
// what the CLI still has: `render-memmap` and `coverage`.
//
// FOUR THINGS THIS FILE PROVES, and why each earns its place:
//
//   1. THE ARGV SUBCOMMAND MECHANISM, end to end, at the bin. Spawns the real
//      `vice-proxy.ts` exactly as a consumer would (`smoke.mjs`'s harness
//      shape, including VICE_SKIP_RESOURCE_INSTALL=1 and
//      MASTRA_TELEMETRY_DISABLED=1 in the child env), and asserts no line of
//      stdout is a JSON-RPC frame -- the proof the subcommand short-circuits
//      before the MCP server ever starts.
//   2. THE NARROWING IS REAL. Each verb that is still removed is rejected, and
//      the rejection names the ones that exist. A verb removed from the
//      dispatch switch but left in USAGE, or vice versa, fails here. Five of
//      D-14's six are still gone; `export-asm` returned on 2026-08-31 as a
//      rebuild over the annotation store and moved to `SURVIVING_VERBS`.
//   3. THE OPTION CONTRACT (IN-06). `VERB_OPTIONS` and USAGE agree per verb,
//      every documented option is accepted, and every undocumented one is
//      refused with the verb's own name on the front.
//   4. THE CENSUS RE-POINT IS EQUIVALENT, not merely compiling. A store
//      populated to match a committed coverage fixture produces the verdict
//      that fixture records. That is the assertion T-29-29 exists for: a
//      vocabulary mismatch between the store's columns and the census's input
//      shapes would move a measurement with nothing red anywhere.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  runR2000Cli,
  VERB_OPTIONS,
  checkAcceptedOptions,
  symbolsFromStore,
  commentsFromStore,
  blocksFromStore,
  crossReferencesFromStore,
} from "./anno-cli.ts";
import { openStore, closeStore, setLabel, setComment, setDataType, putXref, listLabels, listComments, listRanges } from "./anno-store.ts";
import { buildCoverageReport, coverageFindings } from "./anno-coverage.ts";
import type { R2000Comment, R2000CrossReference, R2000Symbol } from "./anno-coverage.ts";
import type { BlockEntry } from "./block-class.ts";
import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The verbs D-14 removed THAT ARE STILL GONE. Hand-listed on purpose:
 * deriving it from `VERB_OPTIONS` would assert that a removed verb is removed,
 * which is a tautology. This list is what makes "the narrowing happened"
 * falsifiable.
 *
 * NARROWED FROM SIX TO FIVE on 2026-08-31: `export-asm` RETURNED, rebuilt over
 * the annotation store behind a real-ACME byte-diff oracle, and moved to
 * `SURVIVING_VERBS` in the same commit. It is removed from this list because a
 * list of removed verbs that names a verb the CLI dispatches asserts something
 * false; the removal of the other five is unchanged in force. `gen-enums`,
 * `export-lbl` and `import-lbl` did NOT come back with it and no phase
 * currently owns them. */
const REMOVED_VERBS = ["bootstrap", "verify", "gen-enums", "export-lbl", "import-lbl"];

/** The verbs the CLI really dispatches. Same reasoning, opposite polarity.
 * Grew from two to three on 2026-08-31 with `export-asm`. */
const SURVIVING_VERBS = ["render-memmap", "coverage", "export-asm"];

/** A fully-filled provenance sidecar -- `parseProvenanceHeader()` refuses a
 * missing or placeholder key by name, so any test that renders for real needs
 * every required field present. */
const RENDER_SIDECAR = {
  capturePath: "/tmp/capture.raw",
  captureSha256: "a".repeat(64),
  port01: "$35",
  dd00: "$06",
  vicBank: "0 ($0000-$3FFF)",
  screenRam: "$0400",
  charsetOrBitmap: "$1000 (ROM shadow)",
  mode: "text, multicolor off",
  videoStandard: "PAL",
  liveVectorPair: "$0314/$0315",
  vectorHandler: "$EA31",
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

async function withCapturedConsole<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const outLines: string[] = [];
  const errLines: string[] = [];
  console.log = (...args: unknown[]) => {
    outLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errLines.push(args.map(String).join(" "));
  };
  try {
    const result = await fn();
    return { result, stdout: outLines.join("\n"), stderr: errLines.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "anno-cli-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** A temp directory INSIDE the workspace root.
 *
 * `coverage` confines both of its caller-supplied paths with
 * `storePathWithinWorkspace()` against `repoRoot()`, so a system tmpdir path
 * is refused BY DESIGN -- that refusal is the mitigation for T-29-28, not an
 * inconvenience to route around. Any test that drives the coverage verb for
 * real must therefore work inside the tree, exactly as the store's own tests
 * do. */
function withWorkspaceTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(HERE, ".anno-cli-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// ---------------------------------------------------------------------------
// Bin-level tests -- the end-to-end proof that the subcommand short-circuits
// before the MCP server starts.
// ---------------------------------------------------------------------------

const VICE_PROXY = join(HERE, "vice-proxy.ts");
const CLI_ENV = {
  ...process.env,
  VICE_SKIP_RESOURCE_INSTALL: "1",
  MASTRA_TELEMETRY_DISABLED: "1",
};
const CLI_TIMEOUT_MS = 20_000;

function spawnCli(args: string[]) {
  // `process.execPath`, never a bare "node" (WR-20). This site is
  // pre-existing and is the one that made the newer site in
  // `anno-cli-path-consumers.test.ts` look like a precedent; both moved in one
  // commit. The reason is the same at both: the shipped server has no build
  // step and runs `.ts` through Node's native type-stripping (Node >= 22.18),
  // so a PATH-resolved `node` need not be a runtime that can start it at all.
  return spawnSync(process.execPath, [VICE_PROXY, ...args], {
    encoding: "utf8" as const,
    env: CLI_ENV,
    timeout: CLI_TIMEOUT_MS,
  });
}

let helpResult: ReturnType<typeof spawnCli>;
let unknownVerbResult: ReturnType<typeof spawnCli>;

before(() => {
  helpResult = spawnCli(["anno", "--help"]);
  unknownVerbResult = spawnCli(["anno", "no-such-verb"]);
});

test("bin: `vice-mcp anno --help` exits 0, prints both invocation forms, and emits no JSON-RPC frame", () => {
  assert.equal(helpResult.status, 0, `stdout: ${helpResult.stdout} stderr: ${helpResult.stderr}`);
  assert.match(helpResult.stdout, /npx -y @henols\/vice-mcp anno <verb>/);
  assert.match(helpResult.stdout, /node <plugin-root>\/src\/mcp\/vice\/vice-proxy\.ts anno <verb>/);

  // The load-bearing assertion: no line of stdout parses as a JSON object
  // carrying a `jsonrpc` key -- proof the subcommand short-circuits before
  // the MCP server (and its stdio JSON-RPC wire protocol) ever starts.
  for (const line of helpResult.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const isJsonRpcFrame = !!parsed && typeof parsed === "object" && "jsonrpc" in (parsed as Record<string, unknown>);
    assert.equal(
      isJsonRpcFrame,
      false,
      `stdout line parses as a JSON-RPC frame, proving the dispatch fell through into the server: ${trimmed}`,
    );
  }
});

// ---------------------------------------------------------------------------
// WR-21: the `coverage` USAGE paragraph versus `loadProjectImage()`'s real
// branch order.
//
// The text this replaces said `<image>` is "dispatched BY EXTENSION FIRST and
// never by byte length" and then, three lines later, named a byte-length
// dispatch (`ext !== ".prg" && bytes.length === 65536`). It also listed the
// three forms `.prg` first, while the code tries `.raw`/`.bin` first -- and
// order is the whole SUBJECT of that paragraph, because running the extension
// check before any length check is what keeps `flatImageOrigin()`'s named
// refusal reachable for a truncated capture (the WR-07 incident).
//
// This guard compares the ORDER the shipped `--help` text names the forms in
// against the ORDER `loadProjectImage()`'s own source branches on, so the two
// cannot drift apart again silently. It deliberately compares ORDER rather
// than prose: a guard that pinned wording would fight every future edit.
// ---------------------------------------------------------------------------

/** The three live image forms, each with the pattern that locates it in
 * `anno-coverage.ts`'s dispatch and the pattern that locates it in the
 * shipped USAGE text. The legacy JSON branch is excluded: it is the fallthrough
 * and has no `ext ===` test to locate. */
const COVERAGE_IMAGE_FORMS = [
  {
    name: ".raw/.bin, by extension",
    inCode: /ext === "\.raw" \|\| ext === "\.bin"/,
    inUsage: /a \.raw or \.bin is read as a flat capture BY EXTENSION/,
  },
  {
    name: "the exactly-65536-byte non-.prg fallback",
    inCode: /ext !== "\.prg" && bytes\.length === 65536/,
    inUsage: /is NOT a \.prg and\s+is exactly 65536 bytes/,
  },
  {
    name: ".prg",
    inCode: /if \(ext === "\.prg"\)/,
    inUsage: /then a \.prg, whose first/,
  },
] as const;

/** The order `patterns` first occur in `text`, as form names. Asserts every
 * pattern matches -- a guard that silently dropped an unmatched form would
 * compare a shorter list against a shorter list and pass. */
function orderOfForms(text: string, which: "inCode" | "inUsage"): string[] {
  return COVERAGE_IMAGE_FORMS.map((form) => {
    const at = text.search(form[which]);
    assert.notEqual(at, -1, `${which}: could not locate the ${form.name} branch -- this guard is blind until its pattern is repaired`);
    return { name: form.name, at };
  })
    .sort((a, b) => a.at - b.at)
    .map((f) => f.name);
}

test("WR-21: the coverage USAGE names the image forms in loadProjectImage()'s OWN branch order", () => {
  const loaderSource = readFileSync(join(HERE, "anno-coverage.ts"), "utf8");
  const loaderStart = loaderSource.indexOf("export function loadProjectImage(");
  assert.notEqual(loaderStart, -1, "precondition: loadProjectImage() is still the dispatcher this text describes");
  const loaderBody = loaderSource.slice(loaderStart, loaderSource.indexOf("// The retired project form", loaderStart));
  assert.ok(loaderBody.length > 0, "precondition: the loader body was sliced, not emptied");

  const usageStart = helpResult.stdout.indexOf("coverage <image>");
  assert.notEqual(usageStart, -1, "precondition: the coverage synopsis is still in --help");
  const usageBlock = helpResult.stdout.slice(usageStart, helpResult.stdout.indexOf("Prints three separately named", usageStart));
  assert.ok(usageBlock.length > 0, "precondition: the coverage USAGE block was sliced, not emptied");

  assert.deepEqual(
    orderOfForms(usageBlock, "inUsage"),
    orderOfForms(loaderBody, "inCode"),
    "the order --help names the image forms in must be the order loadProjectImage() actually tries them",
  );
});

test("WR-21: the coverage USAGE no longer claims dispatch is NEVER by byte length, because one branch is", () => {
  // The specific false absolute, asserted as an absence. Deleting the
  // specificity would also satisfy the order test above, so this half names
  // what must NOT come back -- and its positive control names what must stay.
  const usageStart = helpResult.stdout.indexOf("coverage <image>");
  const usageBlock = helpResult.stdout.slice(usageStart, helpResult.stdout.indexOf("Prints three separately named", usageStart));
  assert.doesNotMatch(usageBlock, /never by byte length/i, "one branch IS a byte-length dispatch (ext !== '.prg' && bytes.length === 65536)");
  assert.match(usageBlock, /65536/, "and the byte-length branch must still be named, not deleted");
  assert.match(usageBlock, /order is load-bearing/i, "the reason the order matters must stay on screen for a --help reader");
});

test("bin: `vice-mcp anno no-such-verb` exits non-zero and prints a usage block", () => {
  assert.notEqual(unknownVerbResult.status, 0);
  const combined = `${unknownVerbResult.stdout}${unknownVerbResult.stderr}`;
  assert.match(combined, /usage \(npm install\)/);
});

test("bin: `vice-mcp anno --help` lists exactly the surviving verbs", () => {
  for (const verb of SURVIVING_VERBS) {
    assert.match(helpResult.stdout, new RegExp(`\\b${verb}\\b`), `USAGE must document the surviving verb ${verb}`);
  }
});

test("bin: both invocations terminate on their own within the timeout, not via spawnSync's timeout kill", () => {
  assert.equal(
    helpResult.signal,
    null,
    "r2000 --help was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
  assert.equal(
    unknownVerbResult.signal,
    null,
    "r2000 no-such-verb was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
});

// ---------------------------------------------------------------------------
// The narrowing itself (D-14). Six verbs are GONE, not disabled.
// ---------------------------------------------------------------------------

test("each removed verb is still rejected, and the rejection names the verbs that exist", async () => {
  for (const verb of REMOVED_VERBS) {
    const { result: code, stdout, stderr } = await withCapturedConsole(() => runR2000Cli([verb, "some.project"]));
    assert.notEqual(code, 0, `the removed verb "${verb}" must be rejected, not dispatched`);
    assert.match(stderr, new RegExp(`unknown verb "${verb}"`), `the refusal must name the verb the caller typed`);
    for (const survivor of SURVIVING_VERBS) {
      assert.match(
        `${stderr}\n${stdout}`,
        new RegExp(`\\b${survivor}\\b`),
        `the refusal for "${verb}" must point the caller at the surviving verb ${survivor}`,
      );
    }
  }
});

test("USAGE names neither the removed verbs nor their options", () => {
  const usage = helpResult.stdout;
  for (const verb of REMOVED_VERBS) {
    assert.doesNotMatch(usage, new RegExp(`^ {2}${verb}\\b`, "m"), `USAGE still documents the removed verb ${verb}`);
  }
  for (const gone of ["--entry", "--max-results"]) {
    assert.doesNotMatch(usage, new RegExp(gone.replace(/-/g, "\\-")), `USAGE still documents ${gone}, which no surviving verb reads`);
  }
});

test("VERB_OPTIONS carries exactly the surviving verbs", () => {
  assert.deepEqual(Object.keys(VERB_OPTIONS).sort(), [...SURVIVING_VERBS].sort());
});

// ---------------------------------------------------------------------------
// render-memmap: argument-level refusals. The verb's own rendering behaviour
// is proven in `anno-memmap-render.test.ts`; what is proven here is that the
// CLI never guesses on the caller's behalf.
//
// The positional argument is an ANNOTATION STORE (D-17) and it goes through
// `storePathWithinWorkspace()`, exactly as `coverage`'s two paths do -- so
// every test that gets far enough to have its path confined works INSIDE the
// tree via `withWorkspaceTempDir()`. A system tmpdir path is refused by
// design, and routing around that refusal would test a confinement that is
// not the shipped one.
// ---------------------------------------------------------------------------

test("render-memmap: --help lists the verb, states the output is generated, and states --check catches a hand edit", () => {
  assert.match(helpResult.stdout, /\brender-memmap\b/);
  assert.match(helpResult.stdout, /GENERATED|generated/);
  assert.match(helpResult.stdout, /--check.*hand edit/is);
});

test("render-memmap: a missing annotation store is refused rather than CREATED", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const missing = join(dir, "does-not-exist.annostore");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", missing, "--provenance", join(dir, "sidecar.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /annotation store not found/i);
    assert.match(stderr, /refusing to CREATE one/i);
    assert.equal(existsSync(missing), false, "the refusal must not have created the store it refused to find");
  });
});

test("render-memmap: a store path outside the workspace root is refused by the ONE confinement seam", async () => {
  await withTempDir(async (dir) => {
    const outside = join(dir, "escaped.annostore");
    writeFileSync(outside, "");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", outside, "--provenance", join(dir, "sidecar.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /outside the workspace root/i);
  });
});

test("render-memmap: a missing --provenance is refused", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "game.annostore");
    writeFileSync(storePath, "");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["render-memmap", storePath]));
    assert.notEqual(code, 0);
    assert.match(stderr, /--provenance.*required/i);
  });
});

test("render-memmap: a nonexistent --provenance file is refused", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "game.annostore");
    writeFileSync(storePath, "");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", join(dir, "does-not-exist.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /provenance sidecar not found/i);
  });
});

test("render-memmap: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.project", "--provenance", "x.json", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("render-memmap: --provenance with no value is refused", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["render-memmap", "some.project", "--provenance"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--provenance requires a value/i);
});

test("render-memmap: --out followed by a flag-shaped token is refused (not silently consumed as the value)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.project", "--provenance", "x.json", "--out", "--check"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--out requires a value/i);
});

// ---------------------------------------------------------------------------
// coverage: argument-level refusals, including the TWO-PATH contract.
// ---------------------------------------------------------------------------

test("coverage: a missing project positional is refused with the two-path usage line", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /usage: coverage <image> --store FILE/);
});

test("coverage: --store is REQUIRED and is never derived from <project> (D-02: this CLI does not guess)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage", "some.project"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--store FILE is required/);
  assert.match(stderr, /will not derive its path from <project>/);
});

test("coverage: --store with no value is refused, not silently given the next token", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage", "some.project", "--store"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--store requires a value/i);
});

test("coverage: --store followed by a flag-shaped token is refused (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "--force"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--store requires a value/i);
});

test("coverage: an unknown option is refused with a non-zero exit code", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "s.store", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("coverage: --sample must be a positive integer", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "s.store", "--sample", "0"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--sample must be a positive integer/);
});

test("coverage: a path outside the workspace root is refused by the ONE confinement seam (T-29-28)", async () => {
  await withTempDir(async (dir) => {
    const outside = join(dir, "elsewhere.project");
    writeFileSync(outside, "{}");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", outside, "--store", join(dir, "elsewhere.store")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /outside the workspace root/i);
  });
});

test("coverage: an absent store is refused BY NAME rather than created (gone and empty must not read the same)", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const projectPath = join(dir, "game.project");
    writeFileSync(projectPath, JSON.stringify({ origin: 0x0810, raw_data_base64: "" }));
    const storePath = join(dir, "annotations.store");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /annotation store not found/i);
    assert.match(stderr, /refusing to CREATE one/);
    assert.equal(existsSync(storePath), false, "a refused run must not leave a store behind at the named path");
  });
});

test("coverage: an absent project file is refused before the store is opened", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    closeStore(openStore(storePath, { workspaceRoot: repoRoot() }));
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", join(dir, "nope.project"), "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /project file not found/i);
  });
});

// ---------------------------------------------------------------------------
// THE CENSUS RE-POINT, PROVEN EQUIVALENT (T-29-29).
//
// The committed coverage fixtures each carry two files: a project file with
// the payload bytes, and a `store.json` recording the four census input shapes
// PLUS the verdict that fixture exists to pin. Before this phase the CLI read
// those four shapes out of the retired analyser's project JSON. It now reads
// them out of this project's own annotation store.
//
// The proof that the re-point did not move a measurement is therefore not
// "it compiles" and not "the columns look right": it is populating a REAL
// store from a fixture's own recorded facts, reading it back through the four
// adapter functions, and asserting the census reaches the verdict the fixture
// records. A vocabulary mismatch at any of the four shapes -- most easily the
// block-type column, whose two vocabularies `block-class.ts` alone reconciles
// -- changes that verdict.
// ---------------------------------------------------------------------------

interface FixtureStore {
  control: string;
  expect_clean: boolean;
  expect_measure: string | null;
  symbols: R2000Symbol[];
  comments: R2000Comment[];
  blocks: BlockEntry[];
  cross_references: R2000CrossReference[];
}

const FIXTURE_ROOT = join(HERE, "fixtures", "coverage");

function fixtureDirs(): string[] {
  return readdirSync(FIXTURE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** The fixtures are spelled in the CAPITALISED vocabulary the retired analyser
 * emitted; the store's own `dataType` column is lowercase. The translation is
 * written out here, in the test, rather than reached for in production code:
 * `block-class.ts` is the only module allowed to reconcile the two
 * vocabularies at runtime, and this is a fixture-loading concern. Everything
 * outside the two spellings the fixtures actually use is refused loudly rather
 * than defaulted, so a fixture gaining a third block type fails here instead
 * of being silently typed as bytes. */
const FIXTURE_BLOCK_TYPE_TO_STORE_DATA_TYPE: Readonly<Record<string, string>> = Object.freeze({
  Code: "code",
  Byte: "byte",
  Undefined: "undefined",
});

/** Populates a real store with a fixture's own recorded facts. The cross
 * references go in as stored rows, which is the one of `crossReferencesTo()`'s
 * three sources that carries a caller nothing can recover from the bytes --
 * exactly what a fixture's recorded `cross_references` list is. */
function populateStoreFromFixture(storePath: string, fixture: FixtureStore): void {
  const handle = openStore(storePath, { workspaceRoot: repoRoot() });
  try {
    for (const block of fixture.blocks) {
      const dataType = FIXTURE_BLOCK_TYPE_TO_STORE_DATA_TYPE[block.type];
      assert.ok(dataType, `fixture block type ${JSON.stringify(block.type)} has no store spelling in this test's table`);
      setDataType(handle, { start: block.start_address, endInclusive: block.end_address, dataType });
    }
    for (const symbol of fixture.symbols) {
      setLabel(handle, { address: symbol.address, name: symbol.name, kind: symbol.kind });
    }
    for (const comment of fixture.comments) {
      setComment(handle, { address: comment.address, commentType: comment.type, text: comment.comment });
    }
    for (const xref of fixture.cross_references) {
      for (const caller of xref.callers) {
        putXref(handle, { fromAddress: caller, toAddress: xref.address, accessKind: "COMPUTED_JUMP" });
      }
    }
  } finally {
    closeStore(handle);
  }
}

for (const dir of fixtureDirs()) {
  const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, dir, "store.json"), "utf8")) as FixtureStore;
  const verdictWord = fixture.expect_clean ? "CLEAN" : "non-clean";
  test(`census re-point equivalence: control ${fixture.control} (${dir}) still produces a ${verdictWord} result when its facts come from a real store`, async () => {
    await withWorkspaceTempDir(async (dir2) => {
      const projectPath = join(dir2, "project.regen2000proj");
      copyFileSync(join(FIXTURE_ROOT, dir, "project.regen2000proj"), projectPath);
      const storePath = join(dir2, "annotations.store");
      populateStoreFromFixture(storePath, fixture);

      const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: true });
      let report;
      try {
        const symbols = symbolsFromStore(listLabels(handle));
        const comments = commentsFromStore(listComments(handle));
        const blocks = blocksFromStore(listRanges(handle));
        // The store round trip must not lose a row: a silently empty read
        // would make every verdict below trivially reproducible.
        assert.equal(symbols.length, fixture.symbols.length, `${dir}: label rows did not survive the store round trip`);
        assert.equal(comments.length, fixture.comments.length, `${dir}: comment rows did not survive the store round trip`);
        assert.equal(blocks.length, fixture.blocks.length, `${dir}: range rows did not survive the store round trip`);

        const project = JSON.parse(readFileSync(projectPath, "utf8")) as { origin: number; raw_data_base64: string };
        const bytes = Uint8Array.from(Buffer.from(project.raw_data_base64, "base64"));
        const crossReferences = crossReferencesFromStore(handle, bytes, project.origin, symbols);
        report = buildCoverageReport({ projectPath, symbols, comments, blocks, crossReferences });
      } finally {
        closeStore(handle);
      }

      const findings = coverageFindings(report);
      assert.equal(
        findings.clean,
        fixture.expect_clean,
        `${dir} expected clean=${fixture.expect_clean} but got clean=${findings.clean}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
      );
      if (fixture.expect_measure) {
        assert.ok(
          findings.findings.some((f) => f.measure === fixture.expect_measure),
          `${dir} was caught, but not by ${fixture.expect_measure}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
        );
      }
    });
  });
}

test("non-vacuity: the equivalence set above is the whole committed control set, and it contains BOTH a clean and a non-clean control", () => {
  const dirs = fixtureDirs();
  assert.ok(dirs.length >= 12, `expected at least 12 committed control fixtures, found ${dirs.length}: ${dirs.join(", ")}`);
  const verdicts = dirs.map((d) => (JSON.parse(readFileSync(join(FIXTURE_ROOT, d, "store.json"), "utf8")) as FixtureStore).expect_clean);
  assert.ok(verdicts.includes(true), "no CLEAN control -- the equivalence proof would then be a machine that only fails");
  assert.ok(verdicts.includes(false), "no non-clean control -- the equivalence proof would then be a machine that only passes");
});

test("coverage end to end: the verb runs against a real store and prints all three named measures, exiting 0", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "store.json"), "utf8")) as FixtureStore;
    const projectPath = join(dir, "project.regen2000proj");
    copyFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "project.regen2000proj"), projectPath);
    const storePath = join(dir, "annotations.store");
    populateStoreFromFixture(storePath, fixture);

    const outPath = join(dir, "report.json");
    const { result: code, stdout } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath]),
    );
    assert.equal(code, 0, stdout);
    assert.match(stdout, /MEASURE 1 of 3 -- structural byte census/);
    assert.match(stdout, /MEASURE 2 of 3 -- label figures/);
    assert.match(stdout, /MEASURE 3 of 3 -- sampled reproducibility/);
    assert.match(stdout, /comment vacuity/);
    assert.match(stdout, /divergence sub-report/);
    // COV-01's own rule, asserted at the point of display: no aggregate.
    assert.doesNotMatch(stdout, /overall score|combined score|total coverage/i);
    assert.ok(existsSync(outPath), "the JSON report must be written when --out is given");

    // The cross-reference answer is now COMPLETE. The bounded-lookup note the
    // round-trip ceiling used to print is gone, and its absence is asserted so
    // a truncation cannot creep back in silently.
    assert.doesNotMatch(stdout, /cross-reference lookups were bounded/);
  });
});

test("coverage: --out refuses to clobber an existing file unless --force is given", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "store.json"), "utf8")) as FixtureStore;
    const projectPath = join(dir, "project.regen2000proj");
    copyFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "project.regen2000proj"), projectPath);
    const storePath = join(dir, "annotations.store");
    populateStoreFromFixture(storePath, fixture);

    const outPath = join(dir, "report.json");
    writeFileSync(outPath, "PRE-EXISTING");
    const { result: refused, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath]),
    );
    assert.notEqual(refused, 0);
    assert.match(stderr, /refusing to overwrite/i);
    assert.equal(readFileSync(outPath, "utf8"), "PRE-EXISTING");

    const { result: forced } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath, "--force"]),
    );
    assert.equal(forced, 0);
    assert.notEqual(readFileSync(outPath, "utf8"), "PRE-EXISTING");
  });
});

test("the four adapters map the store's own columns onto the census's shapes, with no field invented and none dropped", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    const handle = openStore(storePath, { workspaceRoot: repoRoot() });
    try {
      setDataType(handle, { start: 0x0810, endInclusive: 0x081f, dataType: "code" });
      setDataType(handle, { start: 0x0820, endInclusive: 0x082f, dataType: "byte" });
      setLabel(handle, { address: 0x0810, name: "entry_point", kind: "User" });
      setComment(handle, { address: 0x0810, commentType: "line", text: "[confirmed-code] entry" });

      assert.deepEqual(symbolsFromStore(listLabels(handle)), [{ address: 0x0810, name: "entry_point", kind: "User" }]);
      assert.deepEqual(commentsFromStore(listComments(handle)), [
        { address: 0x0810, type: "line", comment: "[confirmed-code] entry" },
      ]);
      assert.deepEqual(blocksFromStore(listRanges(handle)), [
        { start_address: 0x0810, end_address: 0x081f, type: "code" },
        { start_address: 0x0820, end_address: 0x082f, type: "byte" },
      ]);
    } finally {
      closeStore(handle);
    }
  });
});

test("the cross-reference adapter answers over the WHOLE population, with no ceiling and no truncation note", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    const handle = openStore(storePath, { workspaceRoot: repoRoot() });
    try {
      // Far more labels than the 512-lookup ceiling the retired round-trip
      // loop carried. The point of the assertion is the COUNT: a surviving cap
      // would silently answer for the lowest 512 addresses only.
      const symbols: R2000Symbol[] = [];
      for (let i = 0; i < 600; i++) {
        const address = 0x1000 + i;
        setLabel(handle, { address, name: `lbl_${i}`, kind: "User" });
        symbols.push({ address, name: `lbl_${i}`, kind: "User" });
      }
      setLabel(handle, { address: 0xc000, name: "sys_label", kind: "System" });
      symbols.push({ address: 0xc000, name: "sys_label", kind: "System" });

      const derived = crossReferencesFromStore(handle, new Uint8Array(64), 0x0810, symbols);
      assert.equal(derived.length, 600, "every non-System label must get an answer -- 600 is deliberately above the retired 512 ceiling");
      assert.ok(
        !derived.some((x) => x.address === 0xc000),
        "System labels are excluded from every label figure already, so deriving their callers would buy the census nothing",
      );
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// IN-06 -- a verb refuses an option it does not implement instead of silently
// dropping it. `VERB_OPTIONS` (one frozen map in `anno-cli.ts`) plus
// `checkAcceptedOptions()`'s single pre-dispatch call site refuse any
// `--flag`-shaped token a verb does not accept, for every verb uniformly.
// ---------------------------------------------------------------------------

// The verb count here is a count site that MOVES with the dispatch switch,
// alongside `ANNO_CLI_VERB_FLOOR` and `anno-verb-coverage.test.ts`'s own verb
// list. Kept as a hand-maintained literal on purpose: deriving it from
// `Object.keys(VERB_OPTIONS).length` would assert that a number equals itself.
test("the verb-options map agrees with USAGE's own per-verb option lists, for every verb (IN-06)", () => {
  const usage = helpResult.stdout;
  const verbs = Object.keys(VERB_OPTIONS);
  assert.equal(verbs.length, 3, `expected exactly 3 verbs in VERB_OPTIONS, found ${verbs.length}: ${verbs.join(", ")}`);

  for (const verb of verbs) {
    const lineMatch = new RegExp(`^ {2}${verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`, "m").exec(usage);
    assert.ok(lineMatch, `expected a USAGE line for verb "${verb}"`);
    const documented = new Set(lineMatch![0].match(/--[a-zA-Z-]+/g) ?? []);
    const mapped = new Set(VERB_OPTIONS[verb]);
    assert.deepEqual(
      documented,
      mapped,
      `verb "${verb}": USAGE documents ${JSON.stringify([...documented])} but VERB_OPTIONS accepts ${JSON.stringify([...mapped])}`,
    );
  }
});

test("every verb's own documented options are still accepted, one assertion per verb (IN-06 regression guard)", async () => {
  // Built directly from VERB_OPTIONS (the map's own ground truth) rather than
  // hand-typed per verb, so this test cannot silently drift from the map it is
  // proving.
  const placeholderValue: Record<string, string> = {
    "--out": "some-out-path",
    "--force": "",
    "--provenance": "some-provenance.json",
    "--check": "",
    "--sample": "4",
    "--store": "some.store",
  };
  for (const [verb, options] of Object.entries(VERB_OPTIONS)) {
    const argv: string[] = [verb, "some.project"];
    for (const opt of options) {
      argv.push(opt);
      const value = placeholderValue[opt];
      if (value) argv.push(value);
    }
    const { stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.doesNotMatch(
      stderr,
      /is not accepted by this verb/,
      `verb "${verb}" with its own documented options ${JSON.stringify(options)} must not be refused by checkAcceptedOptions(); argv=${JSON.stringify(argv)}, stderr=${stderr}`,
    );
  }
});

test("an unaccepted option is refused for every verb it does not belong to (IN-06 generalisation)", async () => {
  for (const verb of Object.keys(VERB_OPTIONS)) {
    const argv = [verb, "some.project", "--totally-not-a-real-flag"];
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.notEqual(code, 0, `verb "${verb}" must refuse an unaccepted flag`);
    assert.match(stderr, new RegExp(`^${verb}:`), `verb "${verb}"'s refusal must be prefixed with its own name`);
    assert.match(stderr, /--totally-not-a-real-flag/);
  }
});

// ---------------------------------------------------------------------------
// 30-REVIEW CR-01 -- an `Object.prototype` key used as a verb crashed the CLI
// with an unhandled `TypeError`, breaking the never-throw contract stated in
// `anno-cli.ts`'s own header AND in `checkAcceptedOptions()`'s own JSDoc.
//
// `VERB_OPTIONS` is an object literal, so `VERB_OPTIONS["hasOwnProperty"]`
// resolved to a truthy inherited FUNCTION, sailed past the
// `if (!accepted) return undefined` short-circuit, and `accepted.includes(...)`
// threw. Reproduced against the committed code before the fix:
//
//   $ node -e 'import("./anno-cli.ts").then(m => m.runR2000Cli(["hasOwnProperty","game.prg","--force"]))'
//   TypeError: accepted.includes is not a function
//
// The identical defect was found and fixed one directory over in this same
// phase (`scripts/lib/anno-cli-invocations.mjs`'s `own()` helper), and
// `anno-cli-invocations.test.ts:530-596` carries five controls for it -- one
// quoting THIS file's variable name verbatim. The hardening stopped at the
// checker and never reached the CLI the checker models.
//
// The list is deliberately every inherited key a plausible typo or a hostile
// argv could produce, not just the one that was reproduced first: a fix that
// hardened one key would leave the shape armed under the next.
const OBJECT_PROTOTYPE_KEYS = [
  "hasOwnProperty",
  "toString",
  "constructor",
  "valueOf",
  "__proto__",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
] as const;

test("an Object.prototype key used as a verb is refused, not thrown (30-REVIEW CR-01)", async () => {
  for (const key of OBJECT_PROTOTYPE_KEYS) {
    let code: number | undefined;
    let stderr = "";
    let thrown: unknown;
    try {
      const captured = await withCapturedConsole(() => runR2000Cli([key, "game.prg", "--force"]));
      code = captured.result;
      stderr = captured.stderr;
    } catch (err) {
      thrown = err;
    }
    assert.equal(
      thrown,
      undefined,
      `runR2000Cli(["${key}", ...]) threw instead of returning an exit code -- ` +
        `the never-throw contract is broken for inherited keys again: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    );
    assert.equal(code, 1, `verb "${key}" must return exit code 1`);
    assert.match(
      stderr,
      new RegExp(`unknown verb "${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `verb "${key}" must fall through to the unknown-verb refusal, naming the token the caller typed`,
    );
  }
});

test("checkAcceptedOptions() returns undefined for every inherited key, and never throws (30-REVIEW CR-01)", () => {
  for (const key of OBJECT_PROTOTYPE_KEYS) {
    assert.equal(
      checkAcceptedOptions(key, ["--force", "--not-a-real-flag"]),
      undefined,
      `checkAcceptedOptions("${key}", ...) must treat an inherited key as "not a verb I know" and fall through`,
    );
  }
  // Paired positive control: the predicate still refuses for a REAL verb, so a
  // checkAcceptedOptions() that returned undefined unconditionally would fail
  // here rather than pass the loop above vacuously.
  assert.match(
    checkAcceptedOptions("export-asm", ["--not-a-real-flag"]) ?? "",
    /--not-a-real-flag/,
    "a real verb must still have its unaccepted flags refused",
  );
});

// ---------------------------------------------------------------------------
// WR-09 (D-11.1-04) -- the never-throw contract on the verbs' file writes,
// plus a structural guard pinning it so an unguarded write cannot be added
// silently.
//
// The structural guard reads anno-cli.ts's own source, strips comments and
// string/template-literal bodies (so neither can produce a false brace/paren
// match), then for every `writeFileSync(` occurrence walks BACKWARD through
// the stripped text one character at a time, tracking brace depth, until it
// reaches the nearest unmatched `{` (skipping any it can already prove is
// matched by a `}` seen along the way). That unmatched `{` is classified by
// the token immediately preceding it: `try` means the call is guarded;
// `else`/`finally`/`do`, or a `(...)`-headed block whose header keyword is
// `if`/`for`/`while`/`switch`/`catch`, is a same-function block the scan
// keeps climbing past; anything else (a `function`/method header, an arrow
// `=>`, or reaching column 0 with nothing left to climb) is a function
// boundary or module scope, and the call is reported unguarded. This is a
// brace-depth scan "from each match backwards to the nearest enclosing
// `try {` in the same function" exactly as specified, not a "the file
// contains the word try" substring check -- proven below by a planted
// violation (a bare call at function top level, which the scan must reach
// module scope for and report unguarded) alongside a wrapped control (which
// it must stop climbing at on the very first brace and report guarded).
//
// THE TWO NAMED POSITIVE-CONTROL SITES MOVED WITH THE NARROWING. Before D-14
// they were the project-file write and the Markdown write; the project-file
// write went with its verb, and the surviving pair is `cmdRenderMemmap()`'s
// Markdown write and `cmdCoverage()`'s JSON-report write. The FLOOR OF TWO is
// unchanged, and that is not a coincidence to be tidied away: it is the
// measured count of write sites this file still has.
// ---------------------------------------------------------------------------

const R2000_CLI_SOURCE_PATH = join(HERE, "anno-cli.ts");

/**
 * Blanks every line comment, block comment, quoted string and template
 * literal body to a same-length run of spaces (newlines preserved), so a
 * brace or paren living only inside a comment or a message string can never
 * be mistaken for real control-flow structure. Deliberately does not track
 * `${...}` interpolation specially inside a template literal -- the whole
 * span between backticks is blanked regardless of nesting, which is correct
 * for this file (no `writeFileSync(` call lives inside a template
 * interpolation anywhere in it) and simpler than a fully general JS
 * tokenizer would need to be.
 */
function stripCommentsAndLiterals(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && source[i] !== "\n") {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out[i] = " ";
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "`") {
      out[i] = " ";
      i++;
      while (i < n && source[i] !== "`") {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join("");
}

/** The word (identifier characters only) ending at, and including, index
 * `endIdxInclusive` in `stripped`. */
function wordEndingAt(stripped: string, endIdxInclusive: number): string {
  let start = endIdxInclusive;
  while (start >= 0 && /[A-Za-z0-9_$]/.test(stripped[start]!)) start--;
  start++;
  return stripped.slice(start, endIdxInclusive + 1);
}

type BraceKind = "try" | "block" | "function" | "module";

/** Classifies an open brace at `braceIdx` in `stripped` by the token
 * immediately preceding it (skipping whitespace). See this section's header
 * comment for the full classification rule. */
function classifyBrace(stripped: string, braceIdx: number): BraceKind {
  let j = braceIdx - 1;
  while (j >= 0 && /\s/.test(stripped[j]!)) j--;
  if (j < 0) return "module";
  if (stripped[j] === ">" && stripped[j - 1] === "=") return "function"; // arrow `=> {`
  if (stripped[j] === ")") {
    // Walk back to this `)`'s matching `(`, then classify by the keyword (if
    // any) immediately before THAT -- distinguishes `if (...) {` / `for
    // (...) {` / `catch (...) {` (same-function block) from a function or
    // method definition's own `(...) {` (a function boundary).
    let depth = 1;
    let k = j - 1;
    while (k >= 0 && depth > 0) {
      if (stripped[k] === ")") depth++;
      else if (stripped[k] === "(") depth--;
      k--;
    }
    let m = k;
    while (m >= 0 && /\s/.test(stripped[m]!)) m--;
    if (m < 0) return "function";
    const word = wordEndingAt(stripped, m);
    if (word === "if" || word === "for" || word === "while" || word === "switch" || word === "catch") {
      return "block";
    }
    return "function";
  }
  const word = wordEndingAt(stripped, j);
  if (word === "try") return "try";
  if (word === "else" || word === "finally" || word === "do") return "block";
  return "function";
}

/**
 * Walks backward from `callIdx` (the index of a `writeFileSync(` match) in
 * `stripped`, one enclosing brace at a time, until it either finds a `try`
 * (guarded, returns true) or hits a function boundary / module scope
 * (unguarded, returns false). Braces already matched by a `}` encountered
 * during the walk are skipped via a simple depth counter, exactly as if
 * scanning a balanced-bracket stack from the top down.
 */
function isWriteGuarded(stripped: string, callIdx: number): boolean {
  let i = callIdx - 1;
  let depth = 0;
  while (i >= 0) {
    const c = stripped[i];
    if (c === "}") {
      depth++;
      i--;
      continue;
    }
    if (c === "{") {
      if (depth === 0) {
        const kind = classifyBrace(stripped, i);
        if (kind === "try") return true;
        if (kind === "function" || kind === "module") return false;
        // "block" (if/for/while/switch/catch/else/finally/do) -- this brace
        // is consumed; keep climbing toward the next enclosing brace.
        i--;
        continue;
      }
      depth--;
      i--;
      continue;
    }
    i--;
  }
  return false;
}

/** Every `writeFileSync(` call-site index in `source`, found against the
 * comment/literal-stripped text so neither can produce a false match. */
function findWriteFileSyncCalls(source: string): { stripped: string; indices: number[] } {
  const stripped = stripCommentsAndLiterals(source);
  const re = /\bwriteFileSync\s*\(/g;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) indices.push(m.index);
  return { stripped, indices };
}

test("structural (WR-09): every writeFileSync( in anno-cli.ts is inside a try block, with a non-vacuous floor and named positive-control sites", () => {
  const source = readFileSync(R2000_CLI_SOURCE_PATH, "utf8");
  const { stripped, indices } = findWriteFileSyncCalls(source);

  // Non-vacuity floor -- a scanner that silently found zero call sites would
  // trivially "pass" a guard that asserts nothing. Two named sites are known
  // to exist right now (cmdRenderMemmap()'s Markdown write and cmdCoverage()'s
  // JSON-report write); the floor is exactly that measured count, so a THIRD
  // write added later raises it rather than silently slipping through
  // unguarded.
  assert.ok(indices.length >= 2, `expected at least 2 writeFileSync( call sites, found ${indices.length}`);

  // Positive control: the scanner must actually be looking at the real content
  // at each site, not merely returning a fixed answer. Assert each known call
  // site's own arguments are visible in the matched text.
  const contexts = indices.map((idx) => source.slice(idx, idx + 60));
  assert.ok(
    contexts.some((c) => c.includes("outPath, rendered.markdown")),
    `expected to see cmdRenderMemmap()'s own write site among: ${JSON.stringify(contexts)}`,
  );
  // `outPath`, not `out`: CR-02 confined `coverage`'s output argument through
  // `storePathWithinWorkspace()`, and the write now takes the RETURNED
  // realpath rather than the raw caller string. Updating this control to the
  // confined name is deliberate -- pinning `out,` here would keep the control
  // green only for as long as the escape it was written beside stayed open.
  assert.ok(
    contexts.some((c) => c.includes("outPath, JSON.stringify(report")),
    `expected to see cmdCoverage()'s own write site among: ${JSON.stringify(contexts)}`,
  );

  for (const idx of indices) {
    assert.ok(
      isWriteGuarded(stripped, idx),
      `writeFileSync( at source offset ${idx} (${JSON.stringify(source.slice(idx, idx + 60))}) is not inside a try block`,
    );
  }
});

test("structural (WR-09): the guard's planted violation is reported and its wrapped control is not (non-vacuity)", () => {
  const wrapped = `
function foo() {
  try {
    writeFileSync(p, s);
  } catch (err) {
    console.error(err);
  }
}
`;
  const bare = `
function foo() {
  writeFileSync(p, s);
}
`;

  const { stripped: wrappedStripped, indices: wrappedIndices } = findWriteFileSyncCalls(wrapped);
  assert.equal(wrappedIndices.length, 1);
  assert.ok(isWriteGuarded(wrappedStripped, wrappedIndices[0]!), "a try/catch-wrapped writeFileSync must be reported as guarded");

  const { stripped: bareStripped, indices: bareIndices } = findWriteFileSyncCalls(bare);
  assert.equal(bareIndices.length, 1);
  assert.ok(
    !isWriteGuarded(bareStripped, bareIndices[0]!),
    "a bare, function-top-level writeFileSync must be reported as NOT guarded -- the planted violation this guard exists to catch",
  );
});

test("in-process (WR-09): render-memmap with --out inside a non-existent directory fails with a one-line message naming the path, never a stack trace", async () => {
  await withWorkspaceTempDir(async (dir) => {
    // A REAL store and a VALID sidecar, so the render succeeds and the only
    // thing left to fail is the write itself -- which is the failure this
    // guard exists to observe. A junk file here would fail earlier, in
    // openStore(), and the guard would silently stop testing WR-09.
    const storePath = join(dir, "game.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    try {
      setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
    } finally {
      closeStore(handle);
    }
    const provenancePath = join(dir, "sidecar.json");
    writeFileSync(provenancePath, JSON.stringify(RENDER_SIDECAR, null, 2));
    const outPath = join(dir, "no-such-dir", "memory-map.md");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /^render-memmap:/);
    assert.match(stderr, /could not write/i, "the failure must be the WRITE, not something earlier on the path");
    assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
  });
});

// ---------------------------------------------------------------------------
// CR-02 / CR-03 / WR-08: EVERY caller-supplied path is confined, and the
// refusals disclose nothing.
//
// WHAT THESE REPRODUCE. The phase verifier drove the shipped CLI on this very
// working tree and got three escapes, all on arguments the shipped playbooks
// tell an agent to compose in a Bash invocation:
//
//   1. `render-memmap --out <path outside the workspace>` exited 0, printed
//      `render-memmap: wrote /tmp/.../PRECIOUS.md`, and silently replaced that
//      pre-existing file's bytes. `--force` was not in the verb's option set
//      at all and the verb never reached `refuseOverwrite()` (CR-02).
//   2. `render-memmap --provenance <file outside the workspace>` was an
//      arbitrary-file READ oracle WITH CONTENT DISCLOSURE: the sidecar parse
//      failure interpolated Node's own parse error, and that error carries a
//      snippet of the file. Observed verbatim: `... is not valid JSON:
//      Unexpected token 'T', "TOKEN-ZZQQ"... is not valid JSON` (CR-03).
//   3. `coverage --out <path outside the workspace>` took the same escape as
//      1 -- checked for overwrite and then written, both against the raw
//      caller string (CR-02).
//
// WHY THE CONTENT ASSERTION IS SEPARATE FROM THE EXIT-CODE ASSERTION. Case 2
// already exited non-zero BEFORE the fix. A test asserting only the exit code
// would have been green over a live disclosure oracle. The planted distinctive
// token, asserted ABSENT from combined stdout+stderr, is the half that
// actually sees the property.
//
// EVERY REFUSAL HERE IS PAIRED WITH AN OVER-REFUSAL CONTROL. A verb that can
// never write satisfies every refusal test above and is useless; the
// in-workspace write, the `--force` overwrite and the default-output-path
// cases are what make the refusals mean something.
// ---------------------------------------------------------------------------

/** A real store carrying one typed range, so a render actually produces rows. */
function makeRenderableStore(dir: string): string {
  const storePath = join(dir, "game.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
  } finally {
    closeStore(handle);
  }
  return storePath;
}

/** A fully-filled sidecar on disk -- `parseProvenanceHeader()` refuses a
 * missing or placeholder key by name, so a render that must SUCCEED needs
 * every required field present. */
function makeSidecar(dir: string, name = "sidecar.json"): string {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(RENDER_SIDECAR, null, 2));
  return p;
}

test("CR-02 (A): render-memmap --out outside the workspace root is refused by the ONE seam, and creates nothing there", async () => {
  await withWorkspaceTempDir(async (ws) => {
    await withTempDir(async (outside) => {
      const storePath = makeRenderableStore(ws);
      const provenancePath = makeSidecar(ws);
      const escaped = join(outside, "memory-map.md");
      const { result: code, stdout, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", escaped]),
      );
      assert.notEqual(code, 0, "an --out outside the workspace root must not succeed");
      assert.match(stderr, /outside the workspace root/i, "the refusal must name the confinement, not some downstream symptom");
      assert.equal(existsSync(escaped), false, "the refusal must not have written the file it refused to write");
      assert.doesNotMatch(stdout, /wrote/i, "a refused run must not report a write");
    });
  });
});

test("CR-03 (B): render-memmap --provenance outside the workspace root is refused, and the refusal contains NONE of that file's bytes", async () => {
  await withWorkspaceTempDir(async (ws) => {
    await withTempDir(async (outside) => {
      const storePath = makeRenderableStore(ws);
      // THE TOKEN IS EXACTLY TEN CHARACTERS, AND THAT IS LOAD-BEARING.
      // Node truncates its own JSON parse-error snippet at ten characters
      // (`Unexpected token 'T', "TOKEN-ZZQQ"... is not valid JSON` -- the
      // verifier's own reproduction, from a 26-character plant). A longer
      // token is therefore NEVER fully present in the message, so asserting
      // its absence would pass vacuously against the live oracle this test
      // exists to catch. Measured, not assumed: this assertion was confirmed
      // RED against the unfixed code before the fix landed.
      const secret = join(outside, "secret.txt");
      const token = "QQZZORACLE";
      writeFileSync(secret, `${token}\nmore private lines\n`);
      const { result: code, stdout, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", storePath, "--provenance", secret]),
      );
      assert.notEqual(code, 0);
      assert.match(stderr, /outside the workspace root/i, "the read must be refused BY THE CONFINEMENT, before the file is opened at all");
      assert.ok(
        !`${stdout}\n${stderr}`.includes(token),
        `the combined output disclosed the target file's contents -- found ${JSON.stringify(token)} in:\n${stdout}\n${stderr}`,
      );
    });
  });
});

test("CR-02/WR-08 (C): render-memmap refuses to overwrite an existing in-workspace --out without --force, leaving its bytes untouched", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = makeSidecar(ws);
    const outPath = join(ws, "memory-map.md");
    const original = "ORIGINAL-CONTENTS-DO-NOT-DESTROY\n";
    writeFileSync(outPath, original);
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /refusing to overwrite the existing file/i);
    assert.ok(stderr.includes(outPath), "the refusal must name the file it refused to overwrite");
    assert.match(stderr, /--force/, "the refusal must name the opt-in that would allow it");
    assert.equal(readFileSync(outPath, "utf8"), original, "a refused overwrite must leave the file byte-identical");
  });
});

test("CR-02/WR-08 (D, over-refusal control): render-memmap --force DOES overwrite -- so C is not satisfied by a verb that can never write", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = makeSidecar(ws);
    const outPath = join(ws, "memory-map.md");
    writeFileSync(outPath, "ORIGINAL-CONTENTS-DO-NOT-DESTROY\n");
    const { result: code, stdout } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath, "--force"]),
    );
    assert.equal(code, 0, "--force must be an ACCEPTED option of this verb and must succeed");
    assert.match(stdout, /wrote/i);
    const after = readFileSync(outPath, "utf8");
    assert.notEqual(after, "ORIGINAL-CONTENTS-DO-NOT-DESTROY\n", "--force must actually overwrite");
    assert.match(after, /Range/, "the overwritten file must be the rendered memory map");
  });
});

test("CR-02/WR-08: --force is a declared accepted option of render-memmap in VERB_OPTIONS", () => {
  assert.ok(
    VERB_OPTIONS["render-memmap"]!.includes("--force"),
    "refuseOverwrite()'s doc claims overwrite safety is uniform across every verb that WRITES an output file -- render-memmap writes one",
  );
});

test("CR-02 (E): coverage --out outside the workspace root is refused, and creates nothing there", async () => {
  await withWorkspaceTempDir(async (ws) => {
    await withTempDir(async (outside) => {
      const projectPath = join(ws, "game.project");
      writeFileSync(projectPath, JSON.stringify({ origin: 0x0810, raw_data_base64: "" }));
      const storePath = join(ws, "annotations.store");
      closeStore(openStore(storePath, { workspaceRoot: ws }));
      const escaped = join(outside, "coverage.json");
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", escaped]),
      );
      assert.notEqual(code, 0);
      assert.match(stderr, /outside the workspace root/i);
      assert.equal(existsSync(escaped), false, "the refusal must not have written the report it refused to write");
    });
  });
});

test("(F) over-refusal control: an in-workspace --out still writes on BOTH verbs, and --check still reports missing / in-sync / drifted", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = makeSidecar(ws);
    const outPath = join(ws, "rendered.md");

    // --check BEFORE anything is rendered: "missing".
    const missing = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath, "--check"]),
    );
    assert.notEqual(missing.result, 0);
    assert.match(missing.stderr, /missing/i);
    assert.equal(existsSync(outPath), false, "--check must never write");

    // The write itself.
    const wrote = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath]),
    );
    assert.equal(wrote.result, 0, wrote.stderr);
    assert.equal(existsSync(outPath), true);
    assert.ok(wrote.stdout.includes(outPath), "the success line must name the file that was actually written");

    // --check against the freshly written file: "in sync".
    const inSync = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath, "--check"]),
    );
    assert.equal(inSync.result, 0, inSync.stderr);
    assert.match(inSync.stdout, /in sync/i);

    // A hand edit: "drifted".
    const onDisk = readFileSync(outPath, "utf8").split("\n");
    onDisk[onDisk.length - 2] = "a hand edit that was never rendered";
    writeFileSync(outPath, onDisk.join("\n"));
    const drifted = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", outPath, "--check"]),
    );
    assert.notEqual(drifted.result, 0);
    assert.match(drifted.stderr, /drifted at line/i);

    // The coverage verb's in-workspace --out still writes too.
    const projectPath = join(ws, "game.project");
    writeFileSync(projectPath, JSON.stringify({ origin: 0x0810, raw_data_base64: "" }));
    const covOut = join(ws, "coverage.json");
    const cov = await withCapturedConsole(() => runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", covOut]));
    assert.equal(existsSync(covOut), true, "an in-workspace coverage --out must still be written");
    assert.ok(cov.stdout.includes(covOut), "the coverage 'wrote' line must name the file that was actually written");
  });
});

test("(G) over-refusal control: the DEFAULT output path (no --out) still resolves through the seam and still writes", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = makeSidecar(ws);
    const { result: code, stdout, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath]),
    );
    assert.equal(code, 0, stderr);
    const derived = join(ws, "memory-map.md");
    assert.equal(existsSync(derived), true, "the derived default must still be written beside the store");
    assert.match(stdout, /wrote/i);
    // Confining the DEFAULT too is deliberate: a derived path is confined by
    // the same rule as a caller-supplied one rather than trusted because it
    // was derived.
    assert.ok(stdout.includes(derived));
  });
});

// ---------------------------------------------------------------------------
// CR-03, one layer down: the sidecar parse failure names the failure without
// echoing the file's bytes. Asserted HERE, at the CLI boundary, because that
// is the surface an agent actually composes an invocation against.
// ---------------------------------------------------------------------------

test("CR-03 (H): an in-workspace sidecar that is not JSON fails naming the path and the failure, and discloses NONE of its bytes", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    // Ten characters, at the file's opening -- see test B's note: Node's
    // parse-error snippet truncates at ten, so a longer token would make this
    // assertion vacuous rather than protective.
    const token = "WWXXLEAKED";
    const provenancePath = join(ws, "sidecar.json");
    writeFileSync(provenancePath, `${token}\nnot json at all\n`);
    const { result: code, stdout, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath]),
    );
    assert.notEqual(code, 0);
    assert.ok(stderr.includes(provenancePath), "the failure must still NAME the sidecar it could not parse");
    assert.match(stderr, /not valid JSON/i, "the failure must still say WHAT went wrong");
    assert.ok(
      !`${stdout}\n${stderr}`.includes(token),
      `the parse failure disclosed the sidecar's contents -- found ${JSON.stringify(token)} in:\n${stdout}\n${stderr}`,
    );
  });
});

test("CR-03 (I): a sidecar that IS valid JSON but is not a valid provenance header still fails through the HEADER PARSER, naming the fields", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = join(ws, "sidecar.json");
    // Valid JSON, wrong schema. A schema failure names FIELDS THE CALLER
    // SUPPLIED and is not a disclosure route, so blurring it into the syntax
    // failure would lose the diagnostic this verb depends on.
    writeFileSync(provenancePath, JSON.stringify({ capturePath: "/tmp/x.raw" }));
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath]),
    );
    assert.notEqual(code, 0);
    assert.doesNotMatch(stderr, /not valid JSON/i, "a SCHEMA failure must not be reported as a SYNTAX failure");
    assert.match(stderr, /captureSha256/, "the header parser's own message names the missing required keys");
  });
});

test("CR-03 (J, over-refusal control): a valid sidecar still renders", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const storePath = makeRenderableStore(ws);
    const provenancePath = makeSidecar(ws);
    const { result: code, stdout, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", storePath, "--provenance", provenancePath, "--out", join(ws, "ok.md")]),
    );
    assert.equal(code, 0, stderr);
    assert.match(stdout, /wrote/i);
    assert.match(readFileSync(join(ws, "ok.md"), "utf8"), /Range/);
  });
});

// ---------------------------------------------------------------------------
// `export-asm` -- the third verb (EXPORT-01), added 2026-08-31.
//
// Everything here runs INSIDE the workspace root through
// `withWorkspaceTempDir()`, for the reason the render-memmap section above
// already records: all three of this verb's paths go through
// `storePathWithinWorkspace()` against `repoRoot()`, so a system tmpdir path is
// refused BY DESIGN. The two tests that WANT that refusal use `withTempDir()`
// deliberately, and say so.
//
// Both temp helpers remove their directory with
// `rmSync(..., { recursive: true, force: true })` in a `finally` (T-30-07):
// `/tmp` is RAM-backed on this project's development host, so a leaked
// directory is leaked memory rather than leaked disk.
// ---------------------------------------------------------------------------

/** A store plus the image it annotates, both inside `dir`.
 *
 * The image is a `.prg`: two little-endian load-address bytes then the payload.
 * The payload is three real instructions (`lda #$01`, `sta $d020`, `rts`), so
 * the export has something to DECODE rather than a single byte that would make
 * every assertion below hold trivially. */
function makeExportableProject(dir: string, imageName = "game.prg"): { storePath: string; imagePath: string } {
  const imagePath = join(dir, imageName);
  writeFileSync(imagePath, Buffer.from([0x00, 0xc0, 0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x60]));
  const storePath = join(dir, "game.annostore");
  const handle = openStore(storePath, { workspaceRoot: dir });
  try {
    setDataType(handle, { start: 0xc000, endInclusive: 0xc005, dataType: "code" });
    setLabel(handle, { address: 0xc000, name: "start", kind: "User" });
  } finally {
    closeStore(handle);
  }
  return { storePath, imagePath };
}

test("export-asm: --help lists the verb and states, in as many words, that it does NOT assemble", () => {
  assert.match(helpResult.stdout, /^ {2}export-asm <image> --store FILE \[--out FILE\] \[--force\]$/m);
  assert.match(helpResult.stdout, /DOES NOT ASSEMBLE/);
  // The claim this verb must never make. `--help` is the only channel by which
  // a caller learns what the command does, so the absence has to hold there.
  assert.doesNotMatch(
    helpResult.stdout.slice(helpResult.stdout.indexOf("  export-asm <image>")),
    /\bverified\b|\bverification passed\b/i,
    "nothing in the export-asm block may read as a verification result -- the byte-diff oracle is test-only",
  );
});

test("export-asm: writes ACME source to the derived default path beside the STORE and exits 0", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath, imagePath } = makeExportableProject(ws);
    const { result: code, stdout, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", storePath]),
    );
    assert.equal(code, 0, stderr);

    // The derived default: the IMAGE's basename with a `.a` extension, in the
    // STORE's own directory.
    const outPath = join(ws, "game.a");
    assert.ok(existsSync(outPath), `expected the derived default output at ${outPath}; stdout: ${stdout}`);

    const source = readFileSync(outPath, "utf8");
    assert.equal(source.split("\n")[0], "!cpu 6510", "the first line is the CPU directive the exporter emits");
    assert.match(source, /^start = \$C000$/m, "the store's label reaches the source");

    // The summary line names the CONFINED path -- the file that is actually on
    // disk, never whatever the caller typed.
    const lines = stdout.split("\n").filter((l) => l.length > 0);
    assert.equal(lines.length, 2, `expected exactly two printed lines, got ${JSON.stringify(lines)}`);
    assert.match(lines[0]!, /^export-asm: wrote /);
    assert.ok(lines[0]!.includes(outPath), `the summary must name the confined path; got ${lines[0]}`);
    assert.match(lines[0]!, /1 block\(s\), 1 symbol\(s\)/);

    // The second line, asserted for its MEANING rather than as a slogan: the
    // command must state that it assembled nothing.
    assert.match(lines[1]!, /has NOT been assembled/);
    assert.match(lines[1]!, /runs no assembler/);
  });
});

test("export-asm: --out overrides the destination, and both runs produce byte-identical source", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath, imagePath } = makeExportableProject(ws);
    const chosen = join(ws, "chosen.a");
    const first = await withCapturedConsole(() => runR2000Cli(["export-asm", imagePath, "--store", storePath, "--out", chosen]));
    assert.equal(first.result, 0, first.stderr);
    const firstBytes = readFileSync(chosen);

    // Re-running over an unchanged store and image writes the same bytes. The
    // property is DETERMINISM, so it is asserted on the bytes rather than on a
    // count that could coincide.
    const second = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", storePath, "--out", chosen, "--force"]),
    );
    assert.equal(second.result, 0, second.stderr);
    assert.deepEqual(readFileSync(chosen), firstBytes, "a second export over an unchanged store must be byte-identical");
  });
});

test("export-asm: an existing destination is refused without --force, and the file is left untouched", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath, imagePath } = makeExportableProject(ws);
    const outPath = join(ws, "occupied.a");
    writeFileSync(outPath, "PRECIOUS\n");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", storePath, "--out", outPath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /refusing to overwrite the existing file/i);
    assert.match(stderr, /--force/);
    assert.equal(readFileSync(outPath, "utf8"), "PRECIOUS\n", "the refusal must not have touched the file it refused to replace");

    // And the opposite direction, so the refusal is a discrimination rather
    // than a blanket one.
    const forced = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", storePath, "--out", outPath, "--force"]),
    );
    assert.equal(forced.result, 0, forced.stderr);
    assert.match(readFileSync(outPath, "utf8"), /^!cpu 6510/);
  });
});

test("export-asm: a --store outside the workspace root is refused by the ONE seam, and nothing is created there", async () => {
  await withTempDir(async (outside) => {
    // Deliberately a SYSTEM tmpdir: this test wants the confinement refusal,
    // which is precisely what a path outside the workspace root produces.
    await withWorkspaceTempDir(async (ws) => {
      const { imagePath } = makeExportableProject(ws);
      const escaped = join(outside, "escaped.annostore");
      const escapedOut = join(outside, "escaped.a");
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["export-asm", imagePath, "--store", escaped, "--out", escapedOut]),
      );
      assert.notEqual(code, 0);
      assert.match(stderr, /outside the workspace root/i);
      assert.equal(existsSync(escaped), false, "the refusal must not have created a store outside the root");
      assert.equal(existsSync(escapedOut), false, "and must not have written the export there either");
    });
  });
});

test("export-asm: an --out outside the workspace root is refused even when both INPUTS are legal", async () => {
  await withTempDir(async (outside) => {
    await withWorkspaceTempDir(async (ws) => {
      const { storePath, imagePath } = makeExportableProject(ws);
      const escapedOut = join(outside, "PRECIOUS.a");
      writeFileSync(escapedOut, "PRECIOUS\n");
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["export-asm", imagePath, "--store", storePath, "--out", escapedOut, "--force"]),
      );
      assert.notEqual(code, 0);
      assert.match(stderr, /outside the workspace root/i);
      // T-30-02's exact shape: a pre-existing file outside the root must not be
      // replaced, and `--force` must not be a way past the seam.
      assert.equal(readFileSync(escapedOut, "utf8"), "PRECIOUS\n", "a file outside the workspace root must be untouched");
    });
  });
});

test("export-asm: a missing annotation store is refused rather than CREATED", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { imagePath } = makeExportableProject(ws);
    const missing = join(ws, "does-not-exist.annostore");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", missing]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /annotation store not found/i);
    assert.match(stderr, /refusing to CREATE one/i);
    assert.equal(existsSync(missing), false, "the refusal must not have created the store it refused to find");
  });
});

test("export-asm: a nonexistent image is refused by name", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath } = makeExportableProject(ws);
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", join(ws, "no-such.prg"), "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /image not found/i);
  });
});

test("export-asm: a missing --store, and a --store with no value, are each refused by their OWN message", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { imagePath } = makeExportableProject(ws);

    const absent = await withCapturedConsole(() => runR2000Cli(["export-asm", imagePath]));
    assert.notEqual(absent.result, 0);
    assert.match(absent.stderr, /--store FILE is required/);
    assert.match(absent.stderr, /will not derive its path from <image>/);

    const noValue = await withCapturedConsole(() => runR2000Cli(["export-asm", imagePath, "--store"]));
    assert.notEqual(noValue.result, 0);
    assert.match(noValue.stderr, /--store requires a value/);

    // A flag-shaped "value" is a missing value, not a path called `--force`.
    const flagShaped = await withCapturedConsole(() => runR2000Cli(["export-asm", imagePath, "--store", "--force"]));
    assert.notEqual(flagShaped.result, 0);
    assert.match(flagShaped.stderr, /--store requires a value/);
  });
});

test("export-asm: an unknown option is refused by checkAcceptedOptions() BEFORE the verb runs", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath, imagePath } = makeExportableProject(ws);
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, "--store", storePath, "--nonsense"]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /^export-asm: unknown option "--nonsense"/);
    assert.match(stderr, /not accepted by this verb/);
    // Nothing was written: the shared pre-dispatch check runs before
    // `cmdExportAsm()` is ever entered.
    assert.equal(existsSync(join(ws, "game.a")), false);
  });
});

test("export-asm: more than one positional is refused rather than silently ignored", async () => {
  await withWorkspaceTempDir(async (ws) => {
    const { storePath, imagePath } = makeExportableProject(ws);
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", imagePath, imagePath, "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /usage: export-asm <image>/);
  });
});
