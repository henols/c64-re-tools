// anno-memmap-render.test.ts -- pins the D-24/D-27 reconciliation: the
// provenance sidecar schema, the render digest, and the golden-output render
// plus its drift guard. All of it runs everywhere now -- D-17 re-pointed the
// renderer onto this project's own store, so the once-gated half builds rows.
//
// WHAT WAS REMOVED FROM THE END OF THIS FILE, AND WHY (plan 29-10, D-01 with
// D-11 named as its authority, 2026-08-30). This file used to end in an
// UNGATED availability assertion for the retired external analyser -- one
// that ran on every single suite invocation, not behind any environment
// variable -- plus the `SKIP_REASON` constant feeding it. Both are GONE, with
// the gate module they called. D-01's own words are that the retired
// integration must "never be included in any tests"; an assertion that
// interrogates whether that integration is installed is the most literal
// possible violation of that, and it could not have survived in a skipped or
// `todo` form either, since a gated test whose subject no longer exists is
// still a test that includes it.
//
// THE THREE RENDER TESTS WERE NOT DELETED WITH IT, and looking for them by
// their old gated names is the mistake this paragraph exists to prevent.
// D-17 gave them a substrate: plan 29-12 CONVERTED them at wave 6 into
// ungated tests over a real Phase 28 store, keeping every assertion and
// dropping only the child that used to supply the rows. They are the golden
// render, the `[unknown]`/malformed-confidence case and the pipe-plus-newline
// escaping case, all above. D-01 required the dependency to go, not the
// coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseProvenanceHeader,
  AnnoProvenanceHeaderError,
  renderMemoryMap,
  checkRenderedMemoryMap,
  escapeMarkdownCell,
  RENDERER_VERSION,
} from "./anno-memmap-render.ts";
import { openStore, closeStore, setDataType, setLabel, setComment } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { AnnoCommentError } from "./anno-types.ts";
import { formatConfidenceComment, CONFIDENCE_GRADES } from "./anno-confidence.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// parseProvenanceHeader -- no binary needed.
// ---------------------------------------------------------------------------

const VALID_HEADER = {
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

test("parseProvenanceHeader accepts a fully-filled valid header", () => {
  const parsed = parseProvenanceHeader(VALID_HEADER);
  assert.equal(parsed.capturePath, "/tmp/capture.raw");
  assert.equal(parsed.captureSha256, "a".repeat(64));
  assert.equal(parsed.videoStandard, "PAL");
  assert.equal(parsed.rasterPositions, undefined);
});

test("parseProvenanceHeader accepts an optional rasterPositions array", () => {
  const parsed = parseProvenanceHeader({ ...VALID_HEADER, rasterPositions: ["$FA", "$19"] });
  assert.deepEqual(parsed.rasterPositions, ["$FA", "$19"]);
});

test("parseProvenanceHeader({}) throws listing ALL missing required keys in one message", () => {
  assert.throws(
    () => parseProvenanceHeader({}),
    (err: unknown) => {
      assert.ok(err instanceof AnnoProvenanceHeaderError);
      const typed = err as AnnoProvenanceHeaderError;
      const requiredKeys = [
        "capturePath",
        "captureSha256",
        "port01",
        "dd00",
        "vicBank",
        "screenRam",
        "charsetOrBitmap",
        "mode",
        "videoStandard",
        "liveVectorPair",
        "vectorHandler",
      ];
      for (const key of requiredKeys) {
        assert.match(typed.message, new RegExp(`${key}: missing`), `expected message to mention ${key}`);
      }
      assert.equal(typed.problems.length, requiredKeys.length);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a template-placeholder captureSha256 and videoStandard, naming both", () => {
  assert.throws(
    () => parseProvenanceHeader({ ...VALID_HEADER, captureSha256: "<hash>", videoStandard: "<PAL/NTSC>" }),
    (err: unknown) => {
      assert.ok(err instanceof AnnoProvenanceHeaderError);
      const typed = err as AnnoProvenanceHeaderError;
      assert.match(typed.message, /captureSha256:.*placeholder/);
      assert.match(typed.message, /videoStandard:.*placeholder/);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a bad hash length", () => {
  assert.throws(
    () => parseProvenanceHeader({ ...VALID_HEADER, captureSha256: "deadbeef" }),
    (err: unknown) => {
      assert.ok(err instanceof AnnoProvenanceHeaderError);
      assert.match((err as Error).message, /captureSha256:.*64 hex/);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC", () => {
  assert.throws(
    () => parseProvenanceHeader({ ...VALID_HEADER, videoStandard: "SECAM" }),
    (err: unknown) => {
      assert.ok(err instanceof AnnoProvenanceHeaderError);
      assert.match((err as Error).message, /videoStandard:.*PAL.*NTSC/);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a malformed rasterPositions", () => {
  assert.throws(() => parseProvenanceHeader({ ...VALID_HEADER, rasterPositions: "not-an-array" }), AnnoProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader({ ...VALID_HEADER, rasterPositions: [1, 2] }), AnnoProvenanceHeaderError);
});

test("parseProvenanceHeader refuses a non-object payload", () => {
  assert.throws(() => parseProvenanceHeader(null), AnnoProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader([1, 2]), AnnoProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader("a string"), AnnoProvenanceHeaderError);
});

// ---------------------------------------------------------------------------
// The layout must never be read from the skills tree at runtime (Phase 10 D-06).
// ---------------------------------------------------------------------------

test("the renderer's layout is embedded in TypeScript, never read from the recon skill's template at runtime", () => {
  const source = readFileSync(join(HERE, "anno-memmap-render.ts"), "utf8");
  const templateFilenameMentions = (source.match(/memory-map\.template\.md/g) ?? []).length;
  assert.equal(templateFilenameMentions, 0, "anno-memmap-render.ts must never name the recon skill's template file");
});

// ---------------------------------------------------------------------------
// escapeMarkdownCell (WR-04) -- no binary needed.
// ---------------------------------------------------------------------------

test("escapeMarkdownCell escapes a pipe character", () => {
  assert.equal(escapeMarkdownCell("a|b"), "a\\|b");
});

test("escapeMarkdownCell collapses \\n, \\r\\n and a bare \\r into <br>", () => {
  assert.equal(escapeMarkdownCell("one\ntwo"), "one<br>two");
  assert.equal(escapeMarkdownCell("one\r\ntwo"), "one<br>two");
  assert.equal(escapeMarkdownCell("one\rtwo"), "one<br>two");
});

test("escapeMarkdownCell returns a plain string unchanged", () => {
  assert.equal(escapeMarkdownCell("plain evidence text"), "plain evidence text");
});

test("escapeMarkdownCell returns an empty string unchanged", () => {
  assert.equal(escapeMarkdownCell(""), "");
});

test("RENDERER_VERSION is bumped to \"3\" for the store re-point -- the digest's canonical input is store rows, not the three wire shapes", () => {
  // Version 2 pinned the Markdown-cell-escaping output-shape change (WR-04).
  // Version 3 pins D-17: `computeRenderDigest()` canonicalises the store's own
  // `RangeRow`/`LabelRow`/`CommentRow` instead of the three
  // `anno_get_*` wire shapes, so the SAME underlying annotations hash
  // differently either side of that commit. An unchanged version across that
  // boundary would let two incompatible renderings compare as ordinary drift.
  assert.equal(RENDERER_VERSION, "3");
});

// ---------------------------------------------------------------------------
// The render digest, over a real store. No child, no project file.
// ---------------------------------------------------------------------------

/** A store built by hand plus a valid sidecar beside it, both under THIS
 * directory -- which is inside the workspace root, so `openStore()`'s
 * confinement accepts it and a system tmpdir would (correctly) be refused.
 * Every store-backed test below builds its input this way: explicit rows a
 * reader can check against the expected Markdown, with no disassembly step in
 * between. */
function withRenderFixture<T>(
  opts: { prefix: string; fill: (handle: AnnoStoreHandle) => void; provenance?: Record<string, unknown> },
  fn: (paths: { dir: string; storePath: string; provenancePath: string }) => T | Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(HERE, `.${opts.prefix}-`));
  const built = buildStoreFixture({ root: dir, fill: opts.fill, provenance: opts.provenance });
  return Promise.resolve(fn(built)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** Builds a store plus its sidecar at a FIXED relative location beneath an
 * ARBITRARY workspace root, and returns the three paths.
 *
 * Extracted out of `withRenderFixture()` rather than duplicated beside it,
 * because the cross-root regression below needs the SAME builder pointed at
 * two different roots -- two trees built by two different code paths would be
 * "similar", and the property under test is that they are IDENTICAL. Naming
 * the relative location explicitly is the other half of that: the whole point
 * of the workspace-relative banner is that the same tree at two absolute paths
 * renders the same bytes, which is only a meaningful claim when the store sits
 * at the same place beneath each root. */
function buildStoreFixture(opts: {
  root: string;
  relDir?: string;
  fill: (handle: AnnoStoreHandle) => void;
  provenance?: Record<string, unknown>;
}): { dir: string; storePath: string; provenancePath: string } {
  const dir = opts.relDir ? join(opts.root, opts.relDir) : opts.root;
  mkdirSync(dir, { recursive: true });
  const storePath = join(dir, "probe.annostore");
  const handle = openStore(storePath, { workspaceRoot: opts.root });
  try {
    opts.fill(handle);
  } finally {
    closeStore(handle);
  }
  const provenancePath = join(dir, "capture.provenance.json");
  writeFileSync(provenancePath, JSON.stringify(opts.provenance ?? VALID_HEADER, null, 2));
  return { dir, storePath, provenancePath };
}

/** The rows the digest tests below perturb, one at a time. */
function fillBaselineStore(handle: AnnoStoreHandle): void {
  setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
  setLabel(handle, { address: 0x0810, name: "init_screen", kind: "User" });
  setComment(handle, { address: 0x0810, commentType: "line", text: formatConfidenceComment("confirmed-code", "observed executing at boot") });
}

test("the render digest is identical across two renders of the same store and the same sidecar", async () => {
  await withRenderFixture({ prefix: "anno-memmap-digest-stable", fill: fillBaselineStore }, async ({ storePath, provenancePath }) => {
    const first = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    const second = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    assert.match(first.renderDigest, /^[0-9a-f]{64}$/);
    assert.equal(first.renderDigest, second.renderDigest);
    assert.equal(first.markdown, second.markdown);
  });
});

test("changing a LABEL in the store changes the render digest -- the digest covers the store, not just the sidecar", async () => {
  await withRenderFixture({ prefix: "anno-memmap-digest-label", fill: fillBaselineStore }, async ({ storePath, provenancePath }) => {
    const before = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    // Re-opened WRITABLE: `mustExist` opens read-only (it exists to JUDGE an
    // existing image), so a perturbation must not ask for it.
    const handle = openStore(storePath, { workspaceRoot: HERE });
    try {
      setLabel(handle, { address: 0x0812, name: "raster_split", kind: "User" });
    } finally {
      closeStore(handle);
    }
    const after = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    assert.notEqual(after.renderDigest, before.renderDigest);
  });
});

test("changing a COMMENT in the store changes the render digest", async () => {
  await withRenderFixture({ prefix: "anno-memmap-digest-comment", fill: fillBaselineStore }, async ({ storePath, provenancePath }) => {
    const before = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    // Re-opened WRITABLE: `mustExist` opens read-only (it exists to JUDGE an
    // existing image), so a perturbation must not ask for it.
    const handle = openStore(storePath, { workspaceRoot: HERE });
    try {
      setComment(handle, { address: 0x0810, commentType: "line", text: formatConfidenceComment("probable-code", "reclassified") });
    } finally {
      closeStore(handle);
    }
    const after = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    assert.notEqual(after.renderDigest, before.renderDigest);
  });
});

test("changing a RANGE in the store changes the render digest", async () => {
  await withRenderFixture({ prefix: "anno-memmap-digest-range", fill: fillBaselineStore }, async ({ storePath, provenancePath }) => {
    const before = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    // Re-opened WRITABLE: `mustExist` opens read-only (it exists to JUDGE an
    // existing image), so a perturbation must not ask for it.
    const handle = openStore(storePath, { workspaceRoot: HERE });
    try {
      setDataType(handle, { start: 0x2000, endInclusive: 0x2007, dataType: "byte" });
    } finally {
      closeStore(handle);
    }
    const after = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    assert.notEqual(after.renderDigest, before.renderDigest);
  });
});

test("changing the SIDECAR BYTES alone changes the render digest, even when the parsed object is equivalent", async () => {
  await withRenderFixture({ prefix: "anno-memmap-digest-sidecar", fill: fillBaselineStore }, async ({ storePath, provenancePath }) => {
    const before = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    // Re-serialised with different whitespace: same parsed header, different
    // bytes. The digest covers the RAW bytes, so this must still register.
    writeFileSync(provenancePath, JSON.stringify(VALID_HEADER));
    const after = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
    assert.notEqual(after.renderDigest, before.renderDigest);
  });
});

test("the surviving measurement-provenance paragraph STATES the version-2 wire shapes inline, rather than pointing at declarations that no longer exist", () => {
  // Read as BYTES and search in-process. This module carries a literal NUL, so
  // GNU grep classifies it as binary and prints "binary file matches" instead
  // of lines -- the blindness that produced three false "zero local imports"
  // measurements before D-17. What is pinned HERE is that the paragraph still
  // has a live subject; the removal gate that separately pinned the count and
  // line of its one exempted mention has since been retired.
  const bytes = readFileSync(join(HERE, "anno-memmap-render.ts"));
  assert.ok(bytes.includes(0x00), "the NUL byte that makes this a grep-blind file must still be here");
  const source = bytes.toString("utf8");

  const heading = "WHAT THE VERSION-2 DIGEST HASHED";
  assert.ok(source.includes(heading), "the provenance paragraph must still name the lineage it records");

  // It must CARRY the three shapes, because the three `interface` blocks it
  // used to sit above are gone -- a comment above a hole is not a record.
  for (const spelling of [
    "anno_get_blocks",
    "{start_address, end_address, type}",
    "anno_get_symbols",
    "{address, name, kind, type}",
    "anno_get_comments",
    "{address, comment, type}",
  ]) {
    assert.ok(source.includes(spelling), `the paragraph must state ${spelling} inline`);
  }
  for (const declaration of ["interface AnnoBlock", "interface AnnoSymbol", "interface AnnoComment"]) {
    assert.ok(!source.includes(declaration), `${declaration} must be gone -- the digest no longer names it`);
  }

  // And it must explain the bump it exists for.
  assert.match(source, /RENDERER_VERSION.{0,400}"2" -> "3"/s);
});
// ---------------------------------------------------------------------------
// The store-backed render tests. All three used to carry the availability
// gate: each synthesized an external project file, drove a real child process
// to disassemble it, and skipped entirely when no binary was installed. D-17
// re-pointed the renderer onto this project's own annotation store, so each
// now writes the rows it needs directly and runs EVERYWHERE. The assertions
// are unchanged in substance -- removing a dependency and deleting coverage
// are different acts, and only the first is what D-01 asks for.
// ---------------------------------------------------------------------------

test("renders a golden memory map from a hand-built store plus a fixture sidecar, exact bytes except the digest line", async () => {
  await withRenderFixture(
    {
      prefix: "anno-memmap-render-golden",
      // The rows a real disassembly of `lda #$1b ; sta $d011` at $0810 used to
      // produce, written explicitly: one code range spanning the five bytes,
      // one user label at the entry, and the two graded line comments. Stating
      // them here is strictly more legible than the two-step it replaces --
      // nothing below depends on knowing what a disassembler would have done.
      fill: (handle) => {
        setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
        setLabel(handle, { address: 0x0810, name: "init_screen", kind: "User" });
        setComment(handle, {
          address: 0x0810,
          commentType: "line",
          text: formatConfidenceComment("confirmed-code", "observed executing at boot"),
        });
        setComment(handle, {
          address: 0x0812,
          commentType: "line",
          text: formatConfidenceComment("unknown", "not yet classified"),
        });
      },
      provenance: { ...VALID_HEADER, rasterPositions: ["$FA", "$19"] },
    },
    async ({ dir, storePath, provenancePath }) => {
      // The workspace root is the fixture's OWN temp tree, which is how
      // `cmdRenderMemmap()` arranges things: `workspaceRoot` is `repoRoot()`
      // and the store is confined beneath it. That makes the two banner
      // locations below stable literal strings rather than an interpolated
      // absolute path -- which is the whole property this golden test now
      // pins (CR-01).
      const result = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: dir });
      assert.equal(result.rowCount, 1, "expected exactly one block row (the single code range)");
      assert.equal(result.unknownCount, 1, "expected exactly one [unknown]-graded comment");
      assert.match(result.renderDigest, /^[0-9a-f]{64}$/, "render digest must be 64 hex characters");

      // Golden expectation, hand-assembled from the rows written above rather
      // than derived from calling renderMemoryMap() itself. Every line is
      // asserted exactly except the render_digest line, checked by format.
      const expectedLines = [
        "<!--",
        "  GENERATED by `vice-mcp anno render-memmap` -- do not hand-edit; re-run the generator.",
        // Workspace-RELATIVE, and spelled out literally rather than
        // interpolated: with the fixture's own tree as the workspace root
        // these are the file names, and nothing in the compared bytes is a
        // function of where this checkout sits.
        "  store: probe.annostore",
        "  sidecar: capture.provenance.json",
        `  render_digest: ${result.renderDigest}`,
        "  The digest covers the sorted listRanges/listLabels/listComments results, the raw provenance",
        "  sidecar bytes, and this renderer's version constant. `render-memmap --check` reports drift when, and",
        "  only when, one of these changed: this file was hand-edited; a store row changed (a range, a label, a",
        "  comment, or a comment's confidence grade); the provenance sidecar's bytes changed; the store or the",
        "  sidecar moved to a different location RELATIVE TO THE WORKSPACE ROOT; or the renderer changed.",
        "  Relocating the checkout is NOT drift -- the same tree at a different absolute path renders these same",
        "  bytes, because the two locations above are workspace-relative. That matters because this file is meant",
        "  to be committed and read on a machine that did not produce it.",
        "-->",
        "",
        "# Memory map — /tmp/capture.raw",
        "",
        "Capture: `/tmp/capture.raw`  ·  SHA-256 `" + "a".repeat(64) + "`",
        "`$01` = `$35`  ·  VIC bank `0 ($0000-$3FFF)` (`$DD00` = `$06`)  ·  video standard `PAL`",
        "Live vector pair: `$0314/$0315` → `$EA31`",
        "",
        "Every row carries a confidence. Do not promote a row by editing its grade -- re-verify and restate",
        "the evidence, so the record of when something stopped being a guess survives.",
        "",
        "| Range | Contents | Confidence | Evidence |",
        "|---|---|---|---|",
        // The Contents cell carries the STORE'S OWN data-type spelling now --
        // lowercase `code`, one of the frozen twelve -- not a capitalised
        // block type from a retired analyser's Rust `Display`.
        "| `$0810-$0814` | code | CONFIRMED CODE | observed executing at boot |",
        "",
        "Confidence vocabulary — the project's HIGH / MEDIUM / LOW scale, applied to classification:",
        "",
        "| Grade | Means |",
        "|---|---|",
        ...CONFIDENCE_GRADES.map((g) => `| **${g.phrase}** | ${g.meaning} |`),
        "",
        "## Graphics chain",
        "",
        "| What | Address | Derived from |",
        "|---|---|---|",
        "| VIC bank | 0 ($0000-$3FFF) | `$DD00` bits 0-1, inverted |",
        "| Screen RAM (VM) | $0400 | `$D018` bits 4-7 |",
        "| Charset / bitmap (CB) | $1000 (ROM shadow) | `$D018` bits 1-3 |",
        "| Mode | text, multicolor off | `$D011` bits 5-6, `$D016` bit 4 |",
        "",
        "## Interrupts",
        "",
        "| | Address | Notes |",
        "|---|---|---|",
        "| Live IRQ handler | $EA31 | via $0314/$0315 |",
        "| Raster positions | $FA, $19 | one per `$D012` write on the way out of a handler |",
        "",
        "## Routines",
        "",
        "| Address | Provisional name | Confirmed by | Confidence |",
        "|---|---|---|---|",
        "| $0810 | init_screen | observed executing at boot | CONFIRMED CODE |",
        "",
        "## Open questions",
        "",
        "- $0812: not yet classified",
        "",
      ];
      assert.deepEqual(result.markdown.split("\n"), expectedLines);

      // The first block: banner contains the mandated phrases and both
      // locations -- now the WORKSPACE-RELATIVE spellings. These two used to
      // name the raw absolute `storePath`/`provenancePath`; that is what
      // `29-VERIFICATION.md` records as the suite PINNING the defect, and it
      // is why it shipped green.
      assert.match(result.markdown, /do not hand-edit/);
      assert.ok(result.markdown.includes("  store: probe.annostore"));
      assert.ok(result.markdown.includes("  sidecar: capture.provenance.json"));

      // THE NEGATIVE, and its absence is why the defect shipped green. The
      // suite asserted the two paths were PRESENT and never that the ABSOLUTE
      // ones were absent, so nothing here could tell a workspace-relative
      // location from a machine-specific one.
      const absoluteLeakMessage =
        "CR-01: an ABSOLUTE path in the banner makes the `--check` drift verdict a function of the CHECKOUT LOCATION " +
        "rather than of the content -- the same tree at another absolute path would then report `drifted` while its " +
        "own render_digest reported identical. The banner records workspace-relative locations only.";
      assert.ok(!result.markdown.includes(storePath), absoluteLeakMessage);
      assert.ok(!result.markdown.includes(provenancePath), absoluteLeakMessage);
      assert.ok(!result.markdown.includes(dir), absoluteLeakMessage);

      // ---------------------------------------------------------------------
      // checkRenderedMemoryMap: in-sync, hand-edit drift, store-change drift,
      // and missing.
      // ---------------------------------------------------------------------
      const renderedPath = join(dir, "memory-map.md");
      writeFileSync(renderedPath, result.markdown);

      const inSync = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: dir });
      assert.deepEqual(inSync, { status: "in-sync" });

      const corrupted = result.markdown.replace("init_screen", "init_screeX");
      writeFileSync(renderedPath, corrupted);
      const drifted = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: dir });
      assert.equal(drifted.status, "drifted");
      if (drifted.status === "drifted") {
        assert.match(drifted.actual, /init_screeX/);
        assert.match(drifted.expected, /init_screen \|/);
      }

      // Restore the file to exactly what was rendered, then change the STORE
      // (not the file) -- the digest must cover the store, not just the file.
      writeFileSync(renderedPath, result.markdown);
      const reclassify = openStore(storePath, { workspaceRoot: dir });
      try {
        setComment(reclassify, {
          address: 0x0810,
          commentType: "line",
          text: formatConfidenceComment("probable-code", "reclassified"),
        });
      } finally {
        closeStore(reclassify);
      }

      const storeDrift = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: dir });
      assert.equal(storeDrift.status, "drifted", "a store-side change with the rendered file untouched must still register as drift");
      if (storeDrift.status === "drifted") {
        assert.match(storeDrift.expected, /render_digest:/, "the digest line itself is expected to be the first differing line here");
        assert.notEqual(storeDrift.expected, storeDrift.actual);
      }

      const missing = await checkRenderedMemoryMap({
        storePath,
        provenancePath,
        renderedPath: join(dir, "does-not-exist.md"),
        workspaceRoot: dir,
      });
      assert.deepEqual(missing, { status: "missing", path: join(dir, "does-not-exist.md") });
    },
  );
});

// ---------------------------------------------------------------------------
// The cross-root regression (CR-01 / `29-VERIFICATION.md` gap 1). This is the
// test that could not exist before the banner became workspace-relative, and
// its absence is why the defect shipped green: nothing rendered under one root
// and re-checked the identical bytes under another.
//
// Named for the PROPERTY rather than the mechanism. The defect was not "the
// banner holds an absolute path" -- that is the cause. The defect is that the
// artifact's own digest said the content was identical while the gate over the
// same artifact said it had drifted, and both were correct about the different
// things they measured.
// ---------------------------------------------------------------------------

test("the render digest and the --check verdict AGREE: the identical tree at a different absolute path is in-sync, not drifted", async () => {
  const outer = mkdtempSync(join(HERE, ".anno-memmap-cross-root-"));
  try {
    const rootA = join(outer, "rootA");
    const rootB = join(outer, "rootB");

    // Build under A, then COPY the whole tree to B -- rather than building
    // twice -- so the two are byte-identical by construction. A store is a
    // SQLite file; two independent creations of "the same" store are not
    // guaranteed to be byte-equal, and this test would then be measuring the
    // wrong thing.
    const a = buildStoreFixture({ root: rootA, relDir: "annotations", fill: fillBaselineStore });
    cpSync(rootA, rootB, { recursive: true });
    const b = {
      dir: join(rootB, "annotations"),
      storePath: join(rootB, "annotations", "probe.annostore"),
      provenancePath: join(rootB, "annotations", "capture.provenance.json"),
    };
    assert.deepEqual(readFileSync(a.storePath), readFileSync(b.storePath), "the two stores must be byte-identical inputs");
    assert.deepEqual(
      readFileSync(a.provenancePath),
      readFileSync(b.provenancePath),
      "the two sidecars must be byte-identical inputs",
    );

    const renderA = await renderMemoryMap({
      storePath: a.storePath,
      provenancePath: a.provenancePath,
      workspaceRoot: rootA,
    });
    const renderB = await renderMemoryMap({
      storePath: b.storePath,
      provenancePath: b.provenancePath,
      workspaceRoot: rootB,
    });

    // The artifact half: the two renders agree on every byte, not merely on
    // the digest. A digest that matched while the bytes differed is exactly
    // the contradiction this closes.
    assert.equal(renderA.renderDigest, renderB.renderDigest, "identical inputs must produce an identical digest");
    assert.equal(
      renderA.markdown,
      renderB.markdown,
      "identical inputs at two absolute paths must render byte-identical markdown -- if this fails, machine identity is back in the banner",
    );

    // The gate half: write A's bytes, copy them verbatim into B, and ask B.
    const renderedA = join(a.dir, "memory-map.md");
    writeFileSync(renderedA, renderA.markdown);
    const renderedB = join(b.dir, "memory-map.md");
    writeFileSync(renderedB, readFileSync(renderedA));
    assert.deepEqual(readFileSync(renderedA), readFileSync(renderedB), "the copied rendered file must be byte-identical");

    const verdict = await checkRenderedMemoryMap({
      storePath: b.storePath,
      provenancePath: b.provenancePath,
      renderedPath: renderedB,
      workspaceRoot: rootB,
    });
    assert.deepEqual(
      verdict,
      { status: "in-sync" },
      "relocating the checkout is not drift -- the compared bytes must be a function of content and workspace-relative location only (CR-01)",
    );

    // And the gate has not merely been blunted: a real hand edit under root B
    // is still caught. A control that only ever passes is worth nothing.
    writeFileSync(renderedB, renderA.markdown.replace("init_screen", "init_screeX"));
    const handEdit = await checkRenderedMemoryMap({
      storePath: b.storePath,
      provenancePath: b.provenancePath,
      renderedPath: renderedB,
      workspaceRoot: rootB,
    });
    assert.equal(handEdit.status, "drifted", "a hand edit must still be caught at the second root");
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});

test("a store with ZERO ranges, labels and comments renders a banner and a digest, and that file cross-root checks in-sync -- a zero-row render is a RESULT, never a refusal", async () => {
  const outer = mkdtempSync(join(HERE, ".anno-memmap-empty-"));
  try {
    const rootA = join(outer, "rootA");
    const rootB = join(outer, "rootB");

    // Nothing written into the store at all: no range, no label, no comment.
    const a = buildStoreFixture({ root: rootA, relDir: "annotations", fill: () => {} });
    cpSync(rootA, rootB, { recursive: true });
    const b = {
      dir: join(rootB, "annotations"),
      storePath: join(rootB, "annotations", "probe.annostore"),
      provenancePath: join(rootB, "annotations", "capture.provenance.json"),
    };

    const render = await renderMemoryMap({
      storePath: a.storePath,
      provenancePath: a.provenancePath,
      workspaceRoot: rootA,
    });

    // A RESULT, not a refusal: nothing threw, the banner exists, the digest is
    // well-formed, and the counts are honestly zero rather than absent.
    assert.equal(render.rowCount, 0, "zero blocks must render as zero rows, not as an error");
    assert.equal(render.unknownCount, 0);
    assert.match(render.renderDigest, /^[0-9a-f]{64}$/, "an empty store still produces a well-formed 64-hex digest");
    assert.ok(render.markdown.includes("  store: annotations/probe.annostore"));
    assert.ok(render.markdown.includes("| Range | Contents | Confidence | Evidence |"), "the block table header is still emitted");
    assert.match(render.markdown, /## Open questions\n\n- \(none\)/);

    const renderedA = join(a.dir, "memory-map.md");
    writeFileSync(renderedA, render.markdown);
    const renderedB = join(b.dir, "memory-map.md");
    writeFileSync(renderedB, readFileSync(renderedA));

    const verdict = await checkRenderedMemoryMap({
      storePath: b.storePath,
      provenancePath: b.provenancePath,
      renderedPath: renderedB,
      workspaceRoot: rootB,
    });
    assert.deepEqual(verdict, { status: "in-sync" }, "the empty case is path-independent too, not merely the populated one");
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});

test("--check names the LOWEST differing line when the file differs on several, and two runs over the same inputs name the same line", async () => {
  await withRenderFixture(
    { prefix: "anno-memmap-lowest-line", fill: fillBaselineStore },
    async ({ dir, storePath, provenancePath }) => {
      const render = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: dir });
      const renderedPath = join(dir, "memory-map.md");

      // Two edits, deliberately applied to lines FAR apart and written in the
      // reverse order of their line numbers, so a check that returned "the
      // last difference found" or "the most recently edited line" would name
      // the higher one.
      const lines = render.markdown.split("\n");
      const lowerIndex = lines.findIndex((l) => l.startsWith("| `$0810-$0814`"));
      const upperIndex = lines.findIndex((l) => l.startsWith("| $0810 | init_screen"));
      assert.ok(lowerIndex > 0 && upperIndex > lowerIndex, "fixture assumption: the block row precedes the routine row");

      lines[upperIndex] = lines[upperIndex]!.replace("init_screen", "init_screeX");
      lines[lowerIndex] = lines[lowerIndex]!.replace("| code |", "| data |");
      writeFileSync(renderedPath, lines.join("\n"));

      const first = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: dir });
      assert.equal(first.status, "drifted");
      if (first.status !== "drifted") return;
      assert.equal(first.line, lowerIndex + 1, "the LOWEST differing line is the one named, not the last or the largest");

      // Stable: the same inputs name the same line, because both sides come
      // from the same deterministic sort rather than from iteration order.
      const second = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: dir });
      assert.deepEqual(second, first, "two runs over identical inputs must return the identical verdict");
    },
  );
});

test("an address whose store comment carries [unknown] appears under Open questions, and a malformed confidence prefix throws rather than rendering silently", async () => {
  await withRenderFixture(
    {
      prefix: "anno-memmap-render-unknown",
      fill: (handle) => {
        setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
      },
    },
    async ({ storePath, provenancePath }) => {
      // No comments at all yet -- Open questions is legitimately empty.
      const noComments = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
      assert.equal(noComments.unknownCount, 0);
      assert.match(noComments.markdown, /## Open questions\n\n- \(none\)/);

      const graded = openStore(storePath, { workspaceRoot: HERE });
      try {
        setComment(graded, {
          address: 0x0810,
          commentType: "line",
          text: formatConfidenceComment("unknown", "no reliable interpretation yet"),
        });
      } finally {
        closeStore(graded);
      }

      const withUnknown = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
      assert.equal(withUnknown.unknownCount, 1);
      assert.match(withUnknown.markdown, /## Open questions\n\n- \$0810: no reliable interpretation yet/);

      // A near-miss bracket token that survived whatever wrote it must THROW,
      // not render as an ungraded row -- the assertion this test's own name
      // has always made. `formatConfidenceComment()` refuses to compose one,
      // so the malformed text is written directly, which is exactly how such
      // a comment reaches a store in the first place.
      const malformed = openStore(storePath, { workspaceRoot: HERE });
      try {
        setComment(malformed, { address: 0x0812, commentType: "line", text: "[confirmed_code] underscore, not a hyphen" });
      } finally {
        closeStore(malformed);
      }
      await assert.rejects(
        () => renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE }),
        /not a valid confidence grade/,
      );
    },
  );
});

/**
 * Writes one `line` comment, INCLUDING one that carries an embedded line break.
 *
 * `assertCommentText()` refuses an embedded line break at the store's write
 * boundary (Phase 30 plan 30-03), so `setComment()` can no longer put one on
 * disk. This renderer's cell escaping is precisely the defence-in-depth for a
 * store written BEFORE that refusal existed -- so the fixture reproduces that
 * state directly rather than the escaping test being deleted along with the
 * only way to reach it. The public verb is still used for every other column,
 * and for the text itself whenever the text is one the store accepts.
 */
function writeCommentIncludingLegacyLineBreaks(handle: AnnoStoreHandle, address: number, text: string): void {
  try {
    setComment(handle, { address, commentType: "line", text });
    return;
  } catch (err) {
    if (!(err instanceof AnnoCommentError) || err.reason !== "embedded newline") throw err;
  }
  // The row is created through the public verb with the line breaks collapsed,
  // so every other column is validated, and only the text column is then put
  // back to what a pre-refusal store would hold.
  setComment(handle, { address, commentType: "line", text: text.replace(/[\n\r\u2028\u2029]/g, " ") });
  handle.db.prepare("update anno_comment set text = ? where address = ? and comment_type = ?").run(text, address, "line");
}

/** Renders a one-range store whose single line comment carries `grade` and
 * `evidence`, and returns the Markdown. The escaping test below compares two
 * of these against each other. */
async function renderSingleCommentedBlock(prefix: string, grade: string, evidence: string): Promise<string> {
  return withRenderFixture(
    {
      prefix,
      fill: (handle) => {
        setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
        writeCommentIncludingLegacyLineBreaks(handle, 0x0810, formatConfidenceComment(grade, evidence));
      },
    },
    async ({ storePath, provenancePath }) => (await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE })).markdown,
  );
}

test("comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved", async () => {
  const plainEvidence = "observed executing at boot";
  const trickyEvidence = "table | pipe\nsecond line";

  const plainMarkdown = await renderSingleCommentedBlock("anno-memmap-render-plain", "confirmed-code", plainEvidence);
  const trickyMarkdown = await renderSingleCommentedBlock("anno-memmap-render-tricky", "probable-data", trickyEvidence);

  const rangeRowPrefix = "| `$0810-$0814`";
  const plainRow = plainMarkdown.split("\n").find((l) => l.startsWith(rangeRowPrefix));
  const trickyRows = trickyMarkdown.split("\n").filter((l) => l.startsWith(rangeRowPrefix));

  assert.ok(plainRow, "expected to find the plain-evidence block row");
  // (a) exactly one row for the tricky-evidence block, never split
  // across lines by the embedded newline.
  assert.equal(trickyRows.length, 1, "the tricky-evidence block must render as exactly ONE line");
  const trickyRow = trickyRows[0]!;
  assert.ok(!trickyRow.includes("\n"), "a rendered line can never itself contain a literal newline");

  // (b) the row's STRUCTURAL pipe count (delimiters, not escaped data
  // pipes) is unchanged from a row with plain evidence -- i.e. the
  // table survives as well-formed Markdown. Splitting on an unescaped
  // "|" (not preceded by a backslash) recovers the structural cells.
  const structuralCells = (line: string) => line.split(/(?<!\\)\|/).length;
  assert.equal(
    structuralCells(trickyRow),
    structuralCells(plainRow!),
    "the tricky row must have the same number of structural (unescaped) pipe delimiters as a plain row",
  );

  // (c) escaping did not drop content -- the escaped evidence string is
  // present verbatim, pipe escaped and newline collapsed to <br>.
  assert.ok(trickyRow.includes(escapeMarkdownCell(trickyEvidence)));
  assert.ok(trickyRow.includes("table \\| pipe<br>second line"));
});

