// Coverage for skills/c64-memory-map/scripts/driver.ts -- the
// c64-memory-map skill's address-lookup and listing-annotation driver.
//
// The script guards its CLI dispatch behind an entry-point check
// (`if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(...))`)
// and exports its `lookup` function specifically so an in-process import is
// safe. Pure address-number lookups are therefore asserted in process; the
// CLI surface (`lookup` and `annotate` as invoked from a shell) has no
// export, so it is driven as a subprocess with an argument vector, exactly
// like the other two PKG-02 test files.
//
// driver.ts's `lookup <addr>...` verb parses address STRINGS through an
// internal `parseAddr()` helper that is NOT exported (only `lookup(addr:
// number)` is). Every case below that needs string-form address parsing --
// the documented-form equivalence, the overflow messages, and the
// malformed-address message -- is therefore driven through that CLI verb as
// a subprocess, not through the in-process import. See the dedicated test
// below for the one behaviour this leaves unreachable
// (`parseAddr`'s `s == null` branch).
//
// This file lives in src/mcp/vice/, not next to driver.ts, for the same
// non-recursive-discovery reason as its two siblings (see
// skill-memory-map-derive-cli.test.ts's header). It never invokes the `memmap`
// verb: that verb fetches four upstream pages over the network and
// overwrites the committed memmap.json, which would both corrupt the
// repository's own data and make this suite depend on four third-party
// pages staying up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// driver.ts is a typed skill script, checked by this package's typecheck.
import { lookup } from "../../skills/c64-memory-map/scripts/driver.ts";
import { REPO_ROOT } from "./paths.ts";

interface MemMapEntry {
  start: number;
  end: number;
  label: string;
  desc: string;
  section: string | null;
  src?: string;
  sym?: string | null;
  reg?: string | null;
}

const SCRIPT_PATH = join(REPO_ROOT, "skills", "c64-memory-map", "scripts", "driver.ts");
const MEMMAP_JSON_PATH = join(REPO_ROOT, "skills", "c64-memory-map", "memmap.json");

test("driver.ts is resolved at the expected relative path", () => {
  assert.ok(existsSync(SCRIPT_PATH), `expected driver.ts at ${SCRIPT_PATH}`);
});

// ---------------------------------------------------------------------------
// In-process: the exported `lookup(addr: number)` -- pure numeric lookups.
// The script's entry-point guard is what makes this import safe; a test
// asserts that guard's effect directly (no usage/exit text on import).
// ---------------------------------------------------------------------------

test("the exported lookup, called in process with a well-known register address ($D020), returns a result naming that register and its documented meaning", () => {
  const hits = lookup(0xd020) as MemMapEntry[];
  assert.ok(hits.length > 0, "expected at least one memory-map entry covering $D020");
  const bySta = hits.find((h) => h.src === "sta");
  assert.ok(bySta, "expected the sta.c64.org entry for $D020 among the hits");
  assert.match(bySta!.label, /Border color/i);
});

test("importing the module does not run the CLI: the import completed above without emitting usage text or exiting", () => {
  // If this test file's own process is still running at all, the entry-point
  // guard held -- a CLI run would have called process.exit() before this
  // point. Also assert the imported symbol is exactly the function the
  // script documents exporting, not some CLI side effect's return value.
  assert.equal(typeof lookup, "function");
});

// ---------------------------------------------------------------------------
// Subprocess: the CLI surface (`lookup`, `annotate`), argument vector only.
// ---------------------------------------------------------------------------

function runDriver(args: string[], input?: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    input,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** The last stdout line, parsed: a refusal is one JSON line. */
function lastJson(stdout: string): { ok: boolean; message?: string } {
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!);
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "mmap-cli-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the CLI with no arguments prints usage and exits 0", () => {
  const r = runDriver([]);
  assert.equal(r.status, 0);
  // The usage text is the command's output, so it goes to stdout.
  assert.match(r.stdout, /usage: node driver\.ts <command>/);
});

test("the CLI with an unknown verb refuses with a JSON line carrying the usage and exits 1", () => {
  const r = runDriver(["bogus-verb"]);
  assert.equal(r.status, 1);
  const j = lastJson(r.stdout);
  assert.equal(j.ok, false);
  assert.match(j.message ?? "", /unknown command[\s\S]*usage: node driver\.ts <command>/);
});

test("lookup accepts every documented address form for $D020 -- dollar-prefixed hex, 0x-prefixed hex, trailing-h hex, binary and decimal -- and all resolve to the same result", () => {
  const dollar = runDriver(["lookup", "$D020"]);
  const hex0x = runDriver(["lookup", "0xD020"]);
  const trailingH = runDriver(["lookup", "D020h"]);
  const binary = runDriver(["lookup", "%1101000000100000"]);
  const decimal = runDriver(["lookup", "53280"]);

  assert.equal(dollar.status, 0);
  // Compared against each other, not a hardcoded expected block, so this
  // case stays true if the rendered format is ever reformatted.
  assert.equal(hex0x.stdout, dollar.stdout);
  assert.equal(trailingH.stdout, dollar.stdout);
  assert.equal(binary.stdout, dollar.stdout);
  assert.equal(decimal.stdout, dollar.stdout);
});

test("lookup of an address above the top of the address space throws, naming both the parsed value and the valid range", () => {
  // $ABCDE parses as pure hex (703710) with no plausible decimal reading
  // (its digits are not all decimal), so no decimal hint applies here --
  // that case is pinned separately below.
  const r = runDriver(["lookup", "$ABCDE"]);
  assert.equal(r.status, 1);
  const j = lastJson(r.stdout);
  assert.equal(j.ok, false);
  assert.match(j.message ?? "", /\$ABCDE reads as 703710, past the top of the 64K address space \(\$0000-\$FFFF\)/);
});

test("lookup of a value that overflows as hex but fits as decimal: the message additionally offers the decimal reading", () => {
  // $10000's digits (1,0,0,0,0) are all decimal digits, so parseAddr's
  // overflow branch offers the alternate decimal reading: 10000 = $2710.
  const r = runDriver(["lookup", "$10000"]);
  assert.equal(r.status, 1);
  const j = lastJson(r.stdout);
  assert.equal(j.ok, false);
  assert.match(j.message ?? "", /\$10000 reads as 65536, past the top of the 64K address space \(\$0000-\$FFFF\)/);
  assert.match(j.message ?? "", /decimal 10000, drop the marker: 10000 = \$2710/);
});

test("lookup of a malformed address throws with the documented bad-address message listing the accepted forms", () => {
  const r = runDriver(["lookup", "hello"]);
  assert.equal(r.status, 1);
  const j = lastJson(r.stdout);
  assert.equal(j.ok, false);
  assert.match(j.message ?? "", /bad address: hello/);
  assert.match(j.message ?? "", /hex \$D011 \/ 0xD011 \/ D011h \/ D011, binary %1101000000010001, decimal 53265/);
});

test("lookup with an absent address value throws the documented required-address message (closest reachable proxy: parseAddr's `s == null` branch is unreachable through the shipped CLI, since argv elements are always defined strings and only `lookup` -- not `parseAddr` -- is exported; an empty-string argument is the nearest real input and is pinned to its OBSERVED result, the malformed-address message, not the required-address one)", () => {
  const r = runDriver(["lookup", ""]);
  assert.equal(r.status, 1);
  const j = lastJson(r.stdout);
  assert.equal(j.ok, false);
  assert.match(j.message ?? "", /bad address: $/m);
});

test("the lookup verb with two equal addresses emits one block per argument, in argument order -- count and order both asserted, not just presence", () => {
  const r = runDriver(["lookup", "$D020", "$D020"]);
  assert.equal(r.status, 0);
  const headers = [...r.stdout.matchAll(/=== \$([0-9A-F]{4}) ===/g)].map((m) => m[1]);
  assert.deepEqual(headers, ["D020", "D020"], "expected exactly 2 header blocks, in the same order as the 2 arguments");
});

// ---------------------------------------------------------------------------
// annotate -- file, stdin, no-header, empty input.
// ---------------------------------------------------------------------------

const FIXTURE_LISTING = ["        lda $d020", "        sta $d021", "        rts"].join("\n") + "\n";

test("the annotate verb against a small fixture listing exits 0 and emits annotated output", () => {
  withTempDir((dir) => {
    const fixturePath = join(dir, "fixture.asm");
    writeFileSync(fixturePath, FIXTURE_LISTING);
    const first = runDriver(["annotate", "--file", fixturePath]);
    assert.equal(first.status, 0);
    assert.match(first.stdout, /lda \$d020\s+; \$D020 = Border color/);
  });
});

test("the annotate verb reading from standard input produces the same output as the same content passed as a file", () => {
  withTempDir((dir) => {
    const fixturePath = join(dir, "fixture.asm");
    writeFileSync(fixturePath, FIXTURE_LISTING);
    const viaFile = runDriver(["annotate", "--file", fixturePath]);
    const viaStdin = runDriver(["annotate"], FIXTURE_LISTING);
    assert.equal(viaFile.status, 0);
    assert.equal(viaStdin.status, 0);
    assert.equal(viaStdin.stdout, viaFile.stdout);
  });
});

test("the annotate verb with the no-header flag omits the header the default run emits", () => {
  withTempDir((dir) => {
    const fixturePath = join(dir, "fixture.asm");
    writeFileSync(fixturePath, FIXTURE_LISTING);
    const withHeader = runDriver(["annotate", "--file", fixturePath]);
    const noHeader = runDriver(["annotate", "--file", fixturePath, "--no-header"]);
    assert.equal(withHeader.status, 0);
    assert.equal(noHeader.status, 0);
    assert.match(withHeader.stdout, /Addresses referenced by this listing/);
    assert.doesNotMatch(noHeader.stdout, /Addresses referenced by this listing/);
  });
});

test("the annotate verb with empty input produces the documented empty result and exits 0", () => {
  withTempDir((dir) => {
    const emptyPath = join(dir, "empty.asm");
    writeFileSync(emptyPath, "");
    const r = runDriver(["annotate", "--file", emptyPath]);
    assert.equal(r.status, 0);
    // Observed, pinned: an empty file annotates to a single blank line
    // (no header, since nothing was referenced).
    assert.equal(r.stdout, "\n");
  });
});

// ---------------------------------------------------------------------------
// The rebuild (`memmap`) verb is mechanically excluded, and the committed
// data file it would overwrite is proven unmodified.
// ---------------------------------------------------------------------------

const MEMMAP_JSON_BEFORE = readFileSync(MEMMAP_JSON_PATH, "utf8");

test("the committed memmap.json is unmodified after this suite runs", () => {
  const after = readFileSync(MEMMAP_JSON_PATH, "utf8");
  assert.equal(after, MEMMAP_JSON_BEFORE, "memmap.json changed during this test run -- the memmap verb must never be invoked");
});
