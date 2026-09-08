// Coverage for the skill-side `.vsf` wrapper: that it reaches the ONE
// authoritative layout module over its documented resolution ladder, that it
// refuses by name when no rung resolves, and that a refusal from that module
// reaches the caller in the module's own words.
//
// WHAT THIS FILE IS NOT TESTING: the `.vsf` layout. Every layout assertion
// lives in `src/mcp/vice/vsf-slice.test.ts`, next to the module that owns the
// layout. Asserting body lengths here would create the second copy this
// wrapper exists not to have -- in the test rather than in the code, where it
// would be no less binding and considerably harder to notice.
//
// Portable: the fixtures live in the MCP tree, which the plugin distribution
// keeps in the same checkout. With that tree absent the fixture-driven checks
// skip rather than fail, matching this project's other live-test files'
// (e.g. `dxa-live.test.ts`'s) posture towards a corpus or binary they
// cannot assume.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WRAPPER = join(HERE, "vsf-slice.mjs");
const MCP_DIR = resolve(HERE, "..", "..", "..", "mcp", "vice");
const FIXTURES = join(MCP_DIR, "fixtures", "vsf");

/** The flat-image size the whole route exists to produce. Stated here as the
 * ONE number this file carries, because it is the wrapper's observable
 * contract with its caller and not a snapshot layout fact. */
const IMAGE_BYTES = 65536;

const haveFixtures = existsSync(join(FIXTURES, "wellformed-minor1.vsf"));

/** Runs the wrapper and returns `{ status, stdout, stderr }`. `env` is merged
 * over the current environment so a case can set or clear `VICE_MCP_DIR`. */
function runWrapper(argv, { script = WRAPPER, cwd = HERE, env = {} } = {}) {
  const r = spawnSync(process.execPath, [script, ...argv], {
    cwd,
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function scratchDir() {
  return mkdtempSync(join(tmpdir(), "vsf-slice-wrapper-"));
}

// ---------------------------------------------------------------------------
// The route works: the wrapper reaches the layout module and produces a full
// image.
// ---------------------------------------------------------------------------

test("slice: reaches the layout module over the in-repo rung and writes a full 64K image", { skip: !haveFixtures }, () => {
  const dir = scratchDir();
  try {
    const out = join(dir, "image.bin");
    // VICE_MCP_DIR deliberately CLEARED, so rung 1 cannot be what resolved:
    // this case is specifically about the in-repo rung.
    const r = runWrapper(["slice", join(FIXTURES, "wellformed-minor1.vsf"), "--out", out], {
      env: { VICE_MCP_DIR: "" },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(out).length, IMAGE_BYTES);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("slice: the VICE_MCP_DIR rung resolves too, and is preferred over the in-repo path", { skip: !haveFixtures }, () => {
  const dir = scratchDir();
  try {
    const out = join(dir, "image.bin");
    const r = runWrapper(["slice", join(FIXTURES, "wellformed-minor1.vsf"), "--out", out], {
      env: { VICE_MCP_DIR: MCP_DIR },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(out).length, IMAGE_BYTES);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("digest: prints a sha256 and the image length without writing a file", { skip: !haveFixtures }, () => {
  const r = runWrapper(["digest", join(FIXTURES, "wellformed-minor1.vsf")]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^[0-9a-f]{64} {2}65536 bytes {2}/);
});

// ---------------------------------------------------------------------------
// The refusals. Both are first-class: a resolution failure and a malformed
// snapshot must each produce a named refusal, never an image.
// ---------------------------------------------------------------------------

test("no rung resolves: exits non-zero naming EVERY path tried and telling the caller to set VICE_MCP_DIR", () => {
  // Run a COPY of the wrapper from a scratch directory, so the in-repo rung
  // has nothing above it to find and the package rung has no node_modules to
  // resolve through. VICE_MCP_DIR points at an empty directory, so rung 1
  // fails on a real, named path rather than on being unset.
  const dir = scratchDir();
  try {
    const script = join(dir, "vsf-slice.mjs");
    copyFileSync(WRAPPER, script);
    // 34-04: the wrapper now imports its ladder from a sibling mcp-module.mjs
    // (extracted so acme.mjs/packer-finding.mjs share it too), so a bare copy
    // of the wrapper alone would fail to resolve that import before ever
    // reaching the ladder this test means to exercise. Copy the sibling too.
    copyFileSync(join(HERE, "mcp-module.mjs"), join(dir, "mcp-module.mjs"));
    const empty = join(dir, "empty");
    mkdirSync(empty);

    const r = runWrapper(["slice", "whatever.vsf", "--out", join(dir, "out.bin")], {
      script,
      cwd: dir,
      env: { VICE_MCP_DIR: empty },
    });

    assert.notEqual(r.status, 0, "an unresolvable target must not exit 0");
    assert.match(r.stderr, /could not resolve vsf-slice\.ts/);
    // Every rung named, by path -- which is what makes this a refusal rather
    // than a shrug.
    assert.match(r.stderr, /VICE_MCP_DIR/);
    assert.ok(r.stderr.includes(join(empty, "vsf-slice.ts")), `rung 1's path is missing from:\n${r.stderr}`);
    assert.ok(r.stderr.includes(join(dir, "mcp")) || /in-repo relative path/.test(r.stderr), `rung 2 is missing from:\n${r.stderr}`);
    assert.match(r.stderr, /@henols\/vice-mcp/);
    assert.match(r.stderr, /Set VICE_MCP_DIR/);
    // And nothing was produced. A resolution failure that wrote a file would
    // be the exact substitution this ladder exists to prevent.
    assert.equal(existsSync(join(dir, "out.bin")), false, "a refused run must write no image");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed snapshot: stderr carries the layout module's OWN refusal message, unmodified", { skip: !haveFixtures }, () => {
  const dir = scratchDir();
  try {
    const out = join(dir, "image.bin");
    const r = runWrapper(["slice", join(FIXTURES, "malformed-header.vsf"), "--out", out]);
    assert.notEqual(r.status, 0, "a malformed snapshot must not exit 0");
    // Verbatim: the message begins with the library function's own name, with
    // nothing prefixed by either the CLI or this wrapper.
    assert.match(r.stderr.trim(), /^listSnapshotModules: malformed module header at offset/);
    assert.match(r.stderr, /[Rr]efusing rather than rescanning/);
    assert.equal(existsSync(out), false, "a refused slice must leave no output file behind");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown verb is answered by THIS script's usage, not by a subprocess's", () => {
  const r = runWrapper(["extract", "x.vsf"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage: node vsf-slice\.mjs <command>/);
});

// The same claim for the verbs that used to slip through (33 review WR-04).
// The dispatch table was a plain object literal, so it inherited
// Object.prototype and `commands["constructor"]` was a truthy FUNCTION: the
// known-verb test passed and the prototype member was then CALLED. The
// documented usage was never printed, and the failure surfaced as
// `The "code" argument must be of type number. Received an instance of Array`
// from process.exit(). So the test above held only for verbs that are not
// prototype members -- exactly the gap a named-verb list cannot notice.
for (const verb of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
  test(`an unknown verb that is an Object.prototype member (${verb}) is ALSO answered by this script's usage`, () => {
    const r = runWrapper([verb, "x.vsf"]);
    assert.notEqual(r.status, 0, "a nonexistent verb must not exit 0");
    assert.match(r.stderr, /usage: node vsf-slice\.mjs <command>/);
    assert.doesNotMatch(
      r.stderr,
      /"code" argument must be of type number/,
      "the prototype member must not be dispatched to and its return value fed to process.exit()",
    );
  });
}

test("no verb at all prints usage and exits 0", () => {
  const r = runWrapper([]);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /usage: node vsf-slice\.mjs <command>/);
});

// ---------------------------------------------------------------------------
// The structural half: the wrapper holds no layout knowledge. This is the
// assertion that keeps route (b) actually being route (b) -- a wrapper that
// slowly acquired its own offsets would be route (a) with extra steps.
// ---------------------------------------------------------------------------

test("the wrapper carries no snapshot layout constant of its own", () => {
  const src = readFileSync(WRAPPER, "utf8");
  // Every number and name that IS the layout: the first module offset (and
  // the stale value that predates the second magic block), the RAM array
  // size, both accepted body lengths, the falsified length, the measured
  // module size, and the module name itself.
  for (const token of ["58", "37", "65536", "65540", "65543", "65555", "65577", "C64MEM"]) {
    const re = new RegExp(`\\b${token}\\b`);
    assert.equal(
      re.test(src),
      false,
      `vsf-slice.mjs must not carry the layout token ${token} -- the layout lives in vsf-slice.ts`,
    );
  }
});

test("the wrapper's header records the cross-package constraint and why route (b) was taken", () => {
  const src = readFileSync(WRAPPER, "utf8");
  // The decision has to be findable, or the next reader sees an oversight
  // where a choice was made.
  assert.match(src, /Phase 40 plan 40-06/, "the header must cite the retired precedent that recorded the constraint");
  assert.match(src, /@henols\/vice-mcp/);
  assert.match(src, /@henols\/c64-re-tools/);
  assert.match(src, /two independent copies/, "the header must name the two-copies precedent it declined");
  assert.match(src, /\(b\)/, "the header must name which of the two answers was taken");
});

test("the wrapper reaches no external host binary: it spawns the running interpreter only", () => {
  const src = readFileSync(WRAPPER, "utf8");
  const spawnCalls = [...src.matchAll(/spawnSync\(([^,]*),/g)].map((m) => m[1].trim());
  assert.deepEqual(
    spawnCalls,
    ["process.execPath"],
    "the only permitted spawn target is the interpreter already running this script",
  );
});
