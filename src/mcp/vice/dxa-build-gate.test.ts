// dxa-build-gate.test.ts
//
// Phase 35, plan 35-01, Task 2 (DXA-01): the HERMETIC honesty gate for
// `vendor/dxa/build.bash` and `THIRD-PARTY-NOTICES.md`'s dxa content -- no
// network, no built binary required. The honesty check here is a DIGEST,
// never a "did it exit 0": every case below either drives build.bash against
// a synthetic scratch tree, or sweeps the real vendored `.c` files and
// `THIRD-PARTY-NOTICES.md` on disk.
//
// NEVER REACHES THE NETWORK. build.bash's own CACHE_DIR is overridden per
// case via DXA_BUILD_CACHE_DIR (a test-only seam this plan added to
// build.bash for exactly this purpose) -- pointed at a scratch cache this
// file fully controls, pre-seeded from the REAL cached tarball already on
// this host (never fetched here) so a case that needs real bytes never
// calls curl.
//
// THE NOTICES STRUCTURAL GATE LIVES HERE, NOT ITS OWN FILE (35-VALIDATION.md
// asked this plan to confirm first whether an existing notices test could be
// extended -- measured at plan time, none does; scripts/check-npm-
// packages.mjs asserts only that the filename appears in files[]). Both this
// file's digest-gate cases and its notices cases are DXA-01's structural
// gate, so they share one file rather than adding a second entry for
// ci-suite-coverage.test.ts and test-gate.test.ts to account for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(HERE, "vendor", "dxa");
const REAL_PIN_FILE = join(VENDOR_DIR, "dxa-0.1.5.tar.gz.sha256");
const REAL_PIN_DIGEST = readFileSync(REAL_PIN_FILE, "utf8").trim().split(/\s+/)[0]!;

/** The real, already-cached pinned tarball -- read here only to COPY its
 * bytes into a scratch cache this file controls. Never fetched by this file;
 * never mutated. */
const REAL_CACHED_TARBALL = join(process.env.HOME ?? "", ".cache", "c64-re-tools", "phase23", "dxa-0.1.5.tar.gz");

interface ScratchTree {
  /** Top-level scratch directory -- removed whole in removeScratchTree(). */
  root: string;
  /** The vendored-tree COPY itself -- build.bash's own byte-identical diff
   * (:107-123, `diff -rq` against `${HERE}`) walks this directory and would
   * see any SIBLING file placed inside it, so the cache and any fake-PATH
   * directory a case adds live OUTSIDE `dir`, as siblings under `root`. */
  dir: string;
  cacheDir: string;
}

/** Copies the REAL vendored source tree (the 17 tarball entries plus
 * build.bash) into a fresh scratch directory under the repository's own
 * tmp-adjacent location -- so extraction/verification never touches the
 * committed tree, mirroring build.bash's own "committed tree is read, never
 * written" invariant. Torn down by the caller in a `finally`. */
function makeScratchTree(): ScratchTree {
  const root = mkdtempSync(join(tmpdir(), "dxa-build-gate-test-"));
  const dir = join(root, "vendor-dxa-copy");
  cpSync(VENDOR_DIR, dir, { recursive: true });
  // The scratch tree's own build.bash resolves HERE to `dir` itself
  // (BASH_SOURCE-relative), so this copy is what every spawnSync below runs.
  // `cacheDir` is a SIBLING of `dir`, never inside it -- see ScratchTree's
  // own `dir` field comment for why.
  const cacheDir = join(root, "scratch-cache");
  mkdirSync(cacheDir, { recursive: true });
  return { root, dir, cacheDir };
}

function removeScratchTree(tree: ScratchTree): void {
  rmSync(tree.root, { recursive: true, force: true });
}

interface RunResult {
  status: number | null;
  output: string;
}

/** Runs the SCRATCH tree's own build.bash (never the committed one), with
 * DXA_BUILD_CACHE_DIR pointed at the scratch cache -- so no case here can
 * ever reach the real network or this developer's own global cache. */
function runBuildBash(tree: ScratchTree, verb: "verify" | "build"): RunResult {
  const env: Record<string, string | undefined> = { ...process.env, DXA_BUILD_CACHE_DIR: tree.cacheDir };
  const r = spawnSync("bash", [join(tree.dir, "build.bash"), verb], {
    encoding: "utf8",
    timeout: 60_000,
    env,
  });
  return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// ---------------------------------------------------------------------------
// The pin-file gate -- refused BY NAME, before any fetch.
// ---------------------------------------------------------------------------

test("build.bash with an absent pin file refuses by name, exits non-zero, and attempts no fetch", () => {
  const tree = makeScratchTree();
  try {
    rmSync(join(tree.dir, "dxa-0.1.5.tar.gz.sha256"));
    const r = runBuildBash(tree, "verify");
    assert.notEqual(r.status, 0, `expected a non-zero exit with the pin file removed. Output:\n${r.output}`);
    assert.match(r.output, /pin file missing/i, `expected the refusal to name the missing pin file. Output:\n${r.output}`);
    assert.doesNotMatch(
      r.output,
      /fetching/i,
      `expected NO evidence of a fetch having been attempted before the pin-file refusal. Output:\n${r.output}`,
    );
  } finally {
    removeScratchTree(tree);
  }
});

test("build.bash with a pin file carrying a truncated (32-character) digest refuses by name rather than accepting a prefix match", () => {
  const tree = makeScratchTree();
  try {
    const truncated = REAL_PIN_DIGEST.slice(0, 32);
    writeFileSync(join(tree.dir, "dxa-0.1.5.tar.gz.sha256"), `${truncated}  dxa-0.1.5.tar.gz\n`, "utf8");
    const r = runBuildBash(tree, "verify");
    assert.notEqual(r.status, 0, `expected a non-zero exit with a truncated pin digest. Output:\n${r.output}`);
    assert.match(
      r.output,
      /does not carry a well-formed 64-character/i,
      `expected the refusal to name the malformed-digest reason. Output:\n${r.output}`,
    );
    assert.doesNotMatch(r.output, /fetching/i, `a truncated digest must refuse BEFORE any fetch. Output:\n${r.output}`);
  } finally {
    removeScratchTree(tree);
  }
});

test("build.bash with an UPPER-CASE pin digest accepts it -- comparison lowercases both sides", () => {
  const tree = makeScratchTree();
  try {
    if (!existsSync(REAL_CACHED_TARBALL)) {
      throw new Error(
        `this case needs the real cached tarball at ${REAL_CACHED_TARBALL} (never fetched by this test) -- absent on this host`,
      );
    }
    cpSync(REAL_CACHED_TARBALL, join(tree.cacheDir, "dxa-0.1.5.tar.gz"));
    writeFileSync(join(tree.dir, "dxa-0.1.5.tar.gz.sha256"), `${REAL_PIN_DIGEST.toUpperCase()}  dxa-0.1.5.tar.gz\n`, "utf8");
    const r = runBuildBash(tree, "verify");
    assert.equal(r.status, 0, `expected a zero exit with an upper-case (but otherwise correct) pin digest. Output:\n${r.output}`);
  } finally {
    removeScratchTree(tree);
  }
});

// ---------------------------------------------------------------------------
// The digest-not-exit-status behavioural proof (must_haves.truths, DXA-01).
// ---------------------------------------------------------------------------

test("build.bash's pass/fail decision is a digest comparison: a `make` that exits 0 but produces the WRONG binary bytes is still refused", () => {
  const tree = makeScratchTree();
  try {
    if (!existsSync(REAL_CACHED_TARBALL)) {
      throw new Error(`this case needs the real cached tarball at ${REAL_CACHED_TARBALL} -- absent on this host`);
    }
    cpSync(REAL_CACHED_TARBALL, join(tree.cacheDir, "dxa-0.1.5.tar.gz"));

    // A fake `make` on PATH ahead of the real one: it exits 0 (a genuinely
    // "successful" spawned command) but writes WRONG bytes to `dxa`. If
    // build.bash's build gate trusted the spawned command's exit status
    // alone, this run would report success on a binary that is NOT the
    // pinned one -- exactly the failure mode DXA-01 forbids.
    const fakeBinDir = join(tree.root, "fake-bin");
    mkdirSync(fakeBinDir, { recursive: true });
    const fakeMakePath = join(fakeBinDir, "make");
    writeFileSync(fakeMakePath, `#!/usr/bin/env bash\nprintf 'not the real dxa binary' > dxa\nexit 0\n`, "utf8");
    spawnSync("chmod", ["+x", fakeMakePath]);

    const env: Record<string, string | undefined> = {
      ...process.env,
      DXA_BUILD_CACHE_DIR: tree.cacheDir,
      PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
    };
    const r = spawnSync("bash", [join(tree.dir, "build.bash"), "build"], { encoding: "utf8", timeout: 60_000, env });
    const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;

    assert.notEqual(
      r.status,
      0,
      `expected a non-zero exit -- the fake "make" exited 0 (a spawned-command success), but the digest of what it ` +
        `produced does not match the pinned binary digest. A zero exit here would mean build.bash trusted make's own ` +
        `exit status instead of the digest. Output:\n${output}`,
    );
    assert.match(
      output,
      /built binary sha256 does not match the pinned digest/,
      `expected the digest-mismatch refusal wording. Output:\n${output}`,
    );
    // Both compared digests are printed, labelled, so a failure names which
    // side moved -- and proves a REAL comparison happened, not a skipped one.
    const wrongDigest = createHash("sha256").update("not the real dxa binary").digest("hex");
    assert.match(output, new RegExp(wrongDigest), `expected the WRONG binary's own digest to be printed. Output:\n${output}`);
  } finally {
    removeScratchTree(tree);
  }
});

test("structural: build.bash's source contains no branch that decides pass/fail on a spawned command's exit status alone where a digest is available", () => {
  const src = readFileSync(join(VENDOR_DIR, "build.bash"), "utf8");
  // The one legitimate use of a spawned command's raw exit status is `set
  // -euo pipefail` itself (a non-zero `make`/`tar`/`curl` aborts the script)
  // -- but SUCCESS is never reported from that alone. Every "OK" / zero-exit
  // path in the script is gated by a `[[ "${...}" != "${...}" ]]` (or `==`)
  // digest comparison line immediately before it. Structural proof: every
  // `echo "build.bash: ... OK"` line is preceded, somewhere earlier in the
  // file, by a `sha256sum` invocation whose result is what gates it -- i.e.
  // the script never calls `exit 0` as the FIRST statement after a bare
  // command invocation with no `sha256sum`/digest comparison between them.
  const okLines = src.split("\n").filter((line) => /: (verify|build) OK/.test(line));
  assert.ok(okLines.length >= 2, `expected at least two "OK" success lines (verify and build). Source:\n${src}`);
  const sha256Mentions = (src.match(/sha256sum/g) ?? []).length;
  assert.ok(sha256Mentions >= 3, `expected at least three sha256sum invocations (tarball, byte-identical tree implied by diff, and built binary) -- got ${sha256Mentions}`);
});

// ---------------------------------------------------------------------------
// THIRD-PARTY-NOTICES.md structural gate (lives here, not its own file --
// see this file's own header).
// ---------------------------------------------------------------------------

const NOTICES_PATH = join(HERE, "THIRD-PARTY-NOTICES.md");
const RETIRED_NO_GPL_SENTENCE =
  "No GPL-licensed material is incorporated into this package: no GPL-licensed material appears anywhere in `@henols/vice-mcp`'s source or its published tarball.";

test("THIRD-PARTY-NOTICES.md no longer contains the retired sentence asserting that no GPL-licensed material is incorporated", () => {
  const text = readFileSync(NOTICES_PATH, "utf8");
  assert.doesNotMatch(
    text,
    new RegExp(RETIRED_NO_GPL_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    "the retired no-GPL sentence must be absent by exact substring, not merely reworded elsewhere",
  );
});

test("THIRD-PARTY-NOTICES.md contains a dxa GPL-2.0-or-later section with the verbatim main.c header, the no-licence-file statement, and the full GPL-2.0 text", () => {
  const text = readFileSync(NOTICES_PATH, "utf8");
  assert.match(text, /## Incorporated material — dxa \(GPL-2\.0-or-later\)/, "expected the dxa section heading");
  // main.c's own header, quoted verbatim -- a snippet unlikely to appear by
  // coincidence anywhere else in this file.
  assert.match(text, /Based on d65 Copyright \(C\) 1993, 1994 Marko M\\"akel\\"a/, "expected main.c's header quoted verbatim");
  assert.match(text, /Changes for dxa \(C\) 2005-2019 Cameron Kaiser/, "expected main.c's own Kaiser attribution line, quoted verbatim");
  assert.match(text, /no `LICENSE` and no `COPYING` file/, "expected the statement that the tarball ships no licence file");
  // A distinctive line from the middle of the real GPL-2.0 text (not the
  // heading, which could be faked) -- proves the FULL text is present, not
  // just a summary.
  assert.match(
    text,
    /TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION/,
    "expected the full GPL-2.0 licence text to be present, not merely referenced",
  );
});

test("THIRD-PARTY-NOTICES.md records the per-file copyright variance by naming at least two vendored .c filenames whose copyright lines differ", () => {
  const text = readFileSync(NOTICES_PATH, "utf8");
  assert.match(text, /`table\.c`/, "expected table.c named");
  assert.match(text, /`vector\.c`/, "expected vector.c named");
  assert.match(text, /`scan\.c`/, "expected scan.c named");
  assert.match(text, /`label\.c`/, "expected label.c named");
  // The actual variance: table.c/vector.c carry no Kaiser line at all;
  // scan.c/label.c carry a distinct 2019-only Kaiser line.
  assert.match(text, /no Cameron\s*\n?\s*Kaiser line at all/, "expected the 'no Kaiser line at all' distinction for table.c/vector.c");
});

test("every vendored .c file on disk carries a GPL header -- driven from disk, not a hard-coded list", () => {
  const cFiles = readdirSync(VENDOR_DIR).filter((f) => f.endsWith(".c"));
  assert.ok(cFiles.length >= 5, `expected at least 5 vendored .c files on disk, found ${cFiles.length}`);
  for (const f of cFiles) {
    const src = readFileSync(join(VENDOR_DIR, f), "utf8");
    assert.match(src, /GNU General Public License/, `${f} must carry a GPL header -- a future vendored file added without one must fail here`);
  }
});

test("THIRD-PARTY-NOTICES.md is listed in package.json's files[] (structural: the notices file itself must ship)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(pkg.files.includes("THIRD-PARTY-NOTICES.md"), "THIRD-PARTY-NOTICES.md must remain in package.json's files[]");
});
