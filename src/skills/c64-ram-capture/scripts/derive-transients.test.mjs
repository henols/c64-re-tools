// Coverage for the per-release transient derivation: that three synthetic
// images derive exactly the address set they were built to differ at, that
// every refusal names the offending value, that the cap BOUNDARY behaves as a
// pair (64 writes, 65 voids and leaves no file), and that the artifact and the
// `check` verdict both agree with the authoritative MCP-side predicate rather
// than merely resembling it.
//
// WHY THE BOUNDARY IS TESTED AS A PAIR AND WHY THE ABSENCE OF THE FILE IS
// ASSERTED, not just the exit code. A void that still wrote a partial or
// truncated artifact would be the silent widening the void exists to prevent:
// a later comparison would pass on bytes nobody vetted, with a non-zero exit
// long since scrolled past. The exit code alone cannot see that.
//
// Portable: the agreement checks import `capture-predicate.ts` over the same
// resolution ladder `vsf-slice.mjs` uses. With the MCP tree absent they SKIP
// WITH A NAMED REASON -- never silently, because a silently skipped agreement
// test is worse than an absent one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "derive-transients.mjs");

const IMAGE_BYTES = 65536;

// ---------------------------------------------------------------------------
// The MCP-side predicate, over `vsf-slice.mjs`'s resolution ladder.
// ---------------------------------------------------------------------------

const TARGET_FILE = "capture-predicate.ts";
const TARGET_PACKAGE = "@henols/vice-mcp";

/** The same three rungs, in the same order, as `vsf-slice.mjs`'s `ladder()`:
 * `$VICE_MCP_DIR`, the in-repo relative path, then the published package. */
function predicateLadder() {
  const rungs = [];
  const override = process.env.VICE_MCP_DIR;
  if (override) rungs.push(join(resolve(override), TARGET_FILE));
  rungs.push(resolve(HERE, "..", "..", "..", "mcp", "vice", TARGET_FILE));
  try {
    rungs.push(createRequire(import.meta.url).resolve(`${TARGET_PACKAGE}/${TARGET_FILE}`));
  } catch {
    // The npm-installer rung is simply absent in a plugin checkout. Not an
    // error: the in-repo rung above is the one that resolves there.
  }
  return rungs;
}

const predicatePath = predicateLadder().find((p) => existsSync(p)) ?? null;

/** A NAMED skip reason, so a skipped agreement check says which paths it
 * tried instead of vanishing from the summary. */
const SKIP_REASON = predicatePath
  ? false
  : `${TARGET_FILE} did not resolve over the ladder (tried: ${predicateLadder().join(", ") || "no rung"}); ` +
    `set VICE_MCP_DIR to the directory holding it to run the agreement checks`;

let predicate = null;
if (predicatePath) predicate = await import(predicatePath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scratchDir() {
  return mkdtempSync(join(tmpdir(), "derive-transients-"));
}

function run(argv, { cwd = HERE } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], {
    cwd,
    encoding: "utf8",
    timeout: 120000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** A full 64K image of `fill`, with `overrides` (addr -> byte) applied. */
function image(fill, overrides = {}) {
  const buf = Buffer.alloc(IMAGE_BYTES, fill);
  for (const [addr, value] of Object.entries(overrides)) buf[Number(addr)] = value;
  return buf;
}

/**
 * Three images where exactly `addresses` differ across the set: `a` and `c`
 * are identical, `b` carries a different byte at each listed address. The
 * union over the three pairings is therefore exactly `addresses`, and each
 * entry differed in exactly the `a vs b` and `b vs c` pairings.
 */
function tripletDifferingAt(dir, addresses) {
  const overrides = {};
  for (const addr of addresses) overrides[addr] = 0x22;
  const paths = {
    a: join(dir, "a.bin"),
    b: join(dir, "b.bin"),
    c: join(dir, "c.bin"),
  };
  writeFileSync(paths.a, image(0x11));
  writeFileSync(paths.b, image(0x11, overrides));
  writeFileSync(paths.c, image(0x11));
  return [paths.a, paths.b, paths.c];
}

/** N distinct addresses, spread across the space rather than contiguous, so a
 * derivation that accidentally collapsed a run of addresses into a span could
 * not pass by luck. */
function spreadAddresses(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push((i * 613 + 7) & 0xffff);
  return out;
}

// ---------------------------------------------------------------------------
// The derivation itself
// ---------------------------------------------------------------------------

test("derive: three images differing at a known set produce exactly that set, ascending, with pair attributions", () => {
  const dir = scratchDir();
  try {
    // Deliberately NOT in ascending order on the way in, so the ascending
    // assertion below is about the derivation and not about the input.
    const wanted = [0x1000, 0x0002, 0xffff, 0x00a4];
    const imgs = tripletDifferingAt(dir, wanted);
    const out = join(dir, "list.json");

    const r = run(["derive", "--release", "synthetic", "--out", out, ...imgs]);
    assert.equal(r.status, 0, r.stderr);

    const artifact = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(artifact.release, "synthetic");
    assert.equal(artifact.pair_count, 3, "three images make three pairings");
    assert.deepEqual(artifact.derived_from, ["a.bin", "b.bin", "c.bin"]);

    const ascending = [...wanted].sort((x, y) => x - y);
    assert.deepEqual(
      artifact.entries.map((e) => e.address),
      ascending,
      "the entries are exactly the differing set, ascending",
    );

    for (const entry of artifact.entries) {
      assert.deepEqual(
        entry.pairs,
        ["a.bin vs b.bin", "b.bin vs c.bin"],
        `address ${entry.address} must record the two pairings it differed in, by basename`,
      );
      assert.deepEqual(entry.values, ["$11", "$22"], "both distinct byte values seen are recorded");
      assert.equal(entry.attribution, "", "the attribution is present and empty, for a human to fill");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: TRANSIENT_COUNT is printed at column 0 on the success path", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x0400, 0x0401, 0x0402]);
    const r = run(["derive", "--release", "synthetic", "--out", join(dir, "list.json"), ...imgs]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^TRANSIENT_COUNT: 3$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: an identical triplet derives an empty allow-list rather than refusing", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, []);
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "synthetic", "--out", out, ...imgs]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^TRANSIENT_COUNT: 0$/m);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")).entries, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

test("derive: two images are refused, naming the count and the minimum of three", () => {
  const dir = scratchDir();
  try {
    const [a, b] = tripletDifferingAt(dir, [0x1234]);
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "synthetic", "--out", out, a, b]);
    assert.notEqual(r.status, 0, "two images must not derive an allow-list");
    assert.match(r.stderr, /2 image\(s\) given, minimum 3/);
    assert.match(r.stderr, /N >= 3/);
    assert.equal(existsSync(out), false, "a refused derivation must write no artifact");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: a wrong-length image is refused, naming the path and the length", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x1234]);
    const short = join(dir, "short.bin");
    writeFileSync(short, Buffer.alloc(1024, 0));
    const out = join(dir, "list.json");

    const r = run(["derive", "--release", "synthetic", "--out", out, imgs[0], imgs[1], short]);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.includes(short), `the refusal must name the path:\n${r.stderr}`);
    assert.match(r.stderr, /1024 bytes, expected exactly 65536/);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: two images sharing a basename are refused, because pair attributions are written by basename", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x1234]);
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "synthetic", "--out", out, imgs[0], imgs[1], imgs[0]]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /share the basename "a\.bin"/);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: re-deriving over an existing artifact is refused, stating the list is re-derived per release", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x2000]);
    const out = join(dir, "list.json");

    assert.equal(run(["derive", "--release", "first", "--out", out, ...imgs]).status, 0);
    const before = readFileSync(out, "utf8");

    const second = run(["derive", "--release", "second", "--out", out, ...imgs]);
    assert.notEqual(second.status, 0, "an existing artifact must not be silently replaced");
    assert.match(second.stderr, /re-derived per release/);
    assert.match(second.stderr, /no address set is ever inherited between releases/);
    assert.match(second.stderr, /--force/);
    assert.equal(readFileSync(out, "utf8"), before, "the refused re-derivation must not touch the artifact");

    // And --force is the explicit override, so the rule is a gate rather than
    // a wall: a genuine re-derivation of the same release stays possible.
    const forced = run(["derive", "--release", "second", "--out", out, "--force", ...imgs]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(JSON.parse(readFileSync(out, "utf8")).release, "second");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: --cap above the committed cap is refused -- the flag only ever narrows", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x3000]);
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "synthetic", "--out", out, "--cap", "128", ...imgs]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /above the committed cap of 64/);
    assert.match(r.stderr, /only ever NARROWS/);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The cap boundary, as a pair
// ---------------------------------------------------------------------------

test("derive: exactly 64 addresses writes the artifact and exits 0", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, spreadAddresses(64));
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "at-the-cap", "--out", out, ...imgs]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^TRANSIENT_COUNT: 64$/m);
    assert.equal(JSON.parse(readFileSync(out, "utf8")).entries.length, 64);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derive: 65 addresses VOIDS the derivation -- non-zero, no file at --out, and the reason is the stop", () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, spreadAddresses(65));
    const out = join(dir, "list.json");
    const r = run(["derive", "--release", "over-the-cap", "--out", out, ...imgs]);

    assert.notEqual(r.status, 0, "an over-cap derivation must not exit 0");
    assert.match(r.stderr, /VOID/);
    assert.match(r.stderr, /65 differing addresses, above the cap of 64/);
    // The reason stated is the STOP, not the threshold. This is the whole
    // difference between a measurement and an excuse.
    assert.match(r.stderr, /NOT FRAME-EXACT/i);
    assert.equal(
      /warning/i.test(r.stderr + r.stdout),
      false,
      "a void is not a warning -- a warning is a fact that can be scrolled past",
    );
    // The absence of the file, asserted. A partial or truncated artifact would
    // silently widen every later comparison.
    assert.equal(existsSync(out), false, "a void must leave NO artifact behind, not even a partial one");
    // The count is still reported, because on the void path the count IS the
    // finding and a measuring plan has to transcribe it.
    assert.match(r.stdout, /^TRANSIENT_COUNT: 65$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Agreement with the authoritative MCP-side predicate
// ---------------------------------------------------------------------------

test("the script's default cap is the MCP-side TRANSIENT_ALLOW_LIST_CAP, not a second copy of 64", { skip: SKIP_REASON }, () => {
  const src = readFileSync(SCRIPT, "utf8");
  const m = src.match(/^const TRANSIENT_ALLOW_LIST_CAP = (\d+);$/m);
  assert.ok(m, "the script must declare its cap as one named constant");
  assert.equal(
    Number(m[1]),
    predicate.TRANSIENT_ALLOW_LIST_CAP,
    "the derivation's cap must equal the predicate's committed cap",
  );
});

test("a derived artifact round-trips through parseAllowList unmodified", { skip: SKIP_REASON }, () => {
  const dir = scratchDir();
  try {
    const wanted = spreadAddresses(12);
    const imgs = tripletDifferingAt(dir, wanted);
    const out = join(dir, "list.json");
    assert.equal(run(["derive", "--release", "round-trip", "--out", out, ...imgs]).status, 0);

    // Parsed straight off disk with NOTHING edited in between -- the point is
    // that the shipped artifact is already the shape the predicate accepts,
    // rather than needing a translation step that could drift.
    const parsed = predicate.parseAllowList(JSON.parse(readFileSync(out, "utf8")));
    assert.equal(parsed.release, "round-trip");
    assert.deepEqual(
      parsed.addresses,
      [...wanted].sort((x, y) => x - y),
      "the predicate derives the same address set from the artifact",
    );
    assert.equal(parsed.entries.length, wanted.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The two implementations were asserted to agree on VERDICTS but not on PARSE
// STRICTNESS -- which is where a deliberate duplicate drifts first (33 review
// IN-01). A hand-edited artifact with a non-string `attribution` passed the
// skill-side `check` and was refused by the MCP-side predicate, so the two
// disagreed about whether the ledger was even readable.
// 33 review IN-04: the JSON.parse sat outside parseArtifact(), so a syntax
// error surfaced through the outer catch as a bare `error: Unexpected token …`
// naming no file -- unlike every other refusal in this script.
test("check: a syntactically invalid allow-list names the FILE that failed to parse", { skip: SKIP_REASON }, () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x0300]);
    const bad = join(dir, "not-json.json");
    writeFileSync(bad, '{ "release": "oops", entries: [ }');

    const r = run(["check", "--allow-list", bad, imgs[0], imgs[1]]);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.includes(bad), `the refusal must name the path it was reading; got: ${r.stderr}`);
    assert.match(r.stderr, /not valid JSON/);
    assert.doesNotMatch(r.stdout, /CHECK_VERDICT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed artifact is refused by BOTH implementations, not just the predicate", { skip: SKIP_REASON }, () => {
  const dir = scratchDir();
  try {
    const imgs = tripletDifferingAt(dir, [0x0300]);
    const list = join(dir, "list.json");
    assert.equal(run(["derive", "--release", "strictness", "--out", list, ...imgs]).status, 0);

    // Hand-edit exactly the field the two parsers disagreed on.
    const json = JSON.parse(readFileSync(list, "utf8"));
    json.entries[0].attribution = 5;
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify(json, null, 2));

    // The MCP-side predicate refuses it.
    assert.throws(
      () => predicate.parseAllowList(JSON.parse(readFileSync(bad, "utf8"))),
      /non-string attribution/,
      "the predicate has always refused this",
    );

    // And so does the skill-side CLI -- naming the same defect, so an operator
    // reading either transcript learns the same thing.
    const r = run(["check", "--allow-list", bad, imgs[0], imgs[1]]);
    assert.notEqual(r.status, 0, "the CLI must refuse the artifact the predicate refuses");
    assert.match(r.stderr, /non-string attribution/);
    assert.doesNotMatch(r.stdout, /CHECK_VERDICT/, "no verdict may be printed for an unreadable artifact");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check: the verdict agrees with compareCaptures on a synthetic pair, both ways", { skip: SKIP_REASON }, () => {
  const dir = scratchDir();
  try {
    // Derive from a triplet, then re-check a pair against the derivation.
    const allowed = [0x0300, 0x0301];
    const imgs = tripletDifferingAt(dir, allowed);
    const list = join(dir, "list.json");
    assert.equal(run(["derive", "--release", "agreement", "--out", list, ...imgs]).status, 0);

    const parsed = predicate.parseAllowList(JSON.parse(readFileSync(list, "utf8")));

    // Case 1: the pair differs only at allow-listed addresses -> equivalent.
    const equivA = join(dir, "eq-a.bin");
    const equivB = join(dir, "eq-b.bin");
    const bufEqA = image(0x11);
    const bufEqB = image(0x11, { 0x0300: 0x22, 0x0301: 0x22 });
    writeFileSync(equivA, bufEqA);
    writeFileSync(equivB, bufEqB);

    const cliEquiv = run(["check", "--allow-list", list, equivA, equivB]);
    const libEquiv = predicate.compareCaptures(new Uint8Array(bufEqA), new Uint8Array(bufEqB), parsed);
    assert.match(cliEquiv.stdout, /^CHECK_VERDICT: equivalent$/m);
    assert.equal(libEquiv.verdict, "equivalent");
    assert.equal(cliEquiv.status, 0);

    // Case 2: ONE BIT flipped outside the allow-list -> not-equivalent. A
    // one-bit plant is the plant that a bit-count tolerance would pass, so
    // this is the case that proves the tolerance is genuinely absent from both
    // implementations rather than merely unmentioned.
    const divA = join(dir, "div-a.bin");
    const divB = join(dir, "div-b.bin");
    const bufDivA = image(0x11);
    const bufDivB = image(0x11, { 0x0300: 0x22, 0x4000: 0x10 }); // 0x11 ^ 0x10 = 0x01, one bit
    writeFileSync(divA, bufDivA);
    writeFileSync(divB, bufDivB);

    const cliDiv = run(["check", "--allow-list", list, divA, divB]);
    const libDiv = predicate.compareCaptures(new Uint8Array(bufDivA), new Uint8Array(bufDivB), parsed);
    assert.match(cliDiv.stdout, /^CHECK_VERDICT: not-equivalent$/m);
    assert.equal(libDiv.verdict, "not-equivalent");
    assert.notEqual(cliDiv.status, 0, "a non-equivalent check must exit non-zero");
    assert.deepEqual(libDiv.differing, [0x4000]);
    assert.ok(cliDiv.stdout.includes("$4000"), `the CLI must list the divergent address:\n${cliDiv.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// `check`'s own refusals
// ---------------------------------------------------------------------------

test("check: an over-cap artifact is refused rather than used, with the void reason", () => {
  const dir = scratchDir();
  try {
    const list = join(dir, "wide.json");
    writeFileSync(
      list,
      JSON.stringify({
        release: "hand-widened",
        entries: spreadAddresses(65).map((address) => ({ address, pairs: ["x vs y"] })),
      }),
    );
    const a = join(dir, "a.bin");
    const b = join(dir, "b.bin");
    writeFileSync(a, image(0x11));
    writeFileSync(b, image(0x11));

    const r = run(["check", "--allow-list", list, a, b]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /65 addresses, above the committed cap of 64/);
    assert.match(r.stderr, /VOIDS the derivation/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check: a range-shaped entry is refused BY NAME rather than having its extra keys ignored", () => {
  const dir = scratchDir();
  try {
    const list = join(dir, "ranged.json");
    writeFileSync(
      list,
      JSON.stringify({
        release: "ranged",
        entries: [{ address: 0x0300, start: 0x0300, end: 0x03ff, pairs: ["x vs y"] }],
      }),
    );
    const a = join(dir, "a.bin");
    const b = join(dir, "b.bin");
    writeFileSync(a, image(0x11));
    writeFileSync(b, image(0x11));

    const r = run(["check", "--allow-list", list, a, b]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /range-shaped key "start"/);
    assert.match(r.stderr, /ENUMERATED and is never a range/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// CLI shape
// ---------------------------------------------------------------------------

test("an unknown flag is refused by name, listing what the verb accepts", () => {
  const r = run(["derive", "--release", "x", "--out", "y", "--volatile", "$D000-$DFFF"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown flag --volatile/);
});

test("an unknown verb is answered by this script's usage", () => {
  const r = run(["floor", "a.bin", "b.bin"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage: node derive-transients\.mjs <command>/);
});

// The verbs the named-verb case above could not catch (33 review WR-04). The
// dispatch table was a plain object literal, so it inherited
// Object.prototype: `commands["toString"]` was a truthy FUNCTION, the
// known-verb test passed, and the member was CALLED -- usage never printed,
// and the failure surfaced as `The "code" argument must be of type number.
// Received type string ('[object Object]')` out of process.exit().
for (const verb of ["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"]) {
  test(`an unknown verb that is an Object.prototype member (${verb}) is ALSO answered by this script's usage`, () => {
    const r = run([verb, "a.bin", "b.bin"]);
    assert.notEqual(r.status, 0, "a nonexistent verb must not exit 0");
    assert.match(r.stderr, /usage: node derive-transients\.mjs <command>/);
    assert.doesNotMatch(r.stderr, /"code" argument must be of type/);
  });
}

test("no verb at all prints usage and exits 0", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /usage: node derive-transients\.mjs <command>/);
});

test("the script neither spawns a process nor reaches the network", () => {
  const src = readFileSync(SCRIPT, "utf8");
  for (const forbidden of ["spawnSync", "spawn(", "execFile", "node:child_process", "node:net", "node:http", "fetch("]) {
    assert.equal(
      src.includes(forbidden),
      false,
      `derive-transients.mjs must not reference ${forbidden} -- it is pure arithmetic over images already on disk`,
    );
  }
});
