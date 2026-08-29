// anno-memmap-render.test.ts -- pins the D-24/D-27 reconciliation: the
// provenance sidecar schema, the render digest, and the golden-output render
// plus its drift guard. All of it runs everywhere now -- D-17 re-pointed the
// renderer onto this project's own store, so the once-gated half builds rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseProvenanceHeader,
  R2000ProvenanceHeaderError,
  renderMemoryMap,
  checkRenderedMemoryMap,
  escapeMarkdownCell,
  RENDERER_VERSION,
} from "./anno-memmap-render.ts";
import { openStore, closeStore, setDataType, setLabel, setComment } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { formatConfidenceComment, CONFIDENCE_GRADES } from "./anno-confidence.ts";
import { skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";

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
      assert.ok(err instanceof R2000ProvenanceHeaderError);
      const typed = err as R2000ProvenanceHeaderError;
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
      assert.ok(err instanceof R2000ProvenanceHeaderError);
      const typed = err as R2000ProvenanceHeaderError;
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
      assert.ok(err instanceof R2000ProvenanceHeaderError);
      assert.match((err as Error).message, /captureSha256:.*64 hex/);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a videoStandard value that is neither a placeholder nor PAL/NTSC", () => {
  assert.throws(
    () => parseProvenanceHeader({ ...VALID_HEADER, videoStandard: "SECAM" }),
    (err: unknown) => {
      assert.ok(err instanceof R2000ProvenanceHeaderError);
      assert.match((err as Error).message, /videoStandard:.*PAL.*NTSC/);
      return true;
    },
  );
});

test("parseProvenanceHeader refuses a malformed rasterPositions", () => {
  assert.throws(() => parseProvenanceHeader({ ...VALID_HEADER, rasterPositions: "not-an-array" }), R2000ProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader({ ...VALID_HEADER, rasterPositions: [1, 2] }), R2000ProvenanceHeaderError);
});

test("parseProvenanceHeader refuses a non-object payload", () => {
  assert.throws(() => parseProvenanceHeader(null), R2000ProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader([1, 2]), R2000ProvenanceHeaderError);
  assert.throws(() => parseProvenanceHeader("a string"), R2000ProvenanceHeaderError);
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
  // `r2000_get_*` wire shapes, so the SAME underlying annotations hash
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
  const storePath = join(dir, "probe.annostore");
  const handle = openStore(storePath, { workspaceRoot: HERE });
  try {
    opts.fill(handle);
  } finally {
    closeStore(handle);
  }
  const provenancePath = join(dir, "capture.provenance.json");
  writeFileSync(provenancePath, JSON.stringify(opts.provenance ?? VALID_HEADER, null, 2));
  return Promise.resolve(fn({ dir, storePath, provenancePath })).finally(() => rmSync(dir, { recursive: true, force: true }));
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
  // measurements before D-17. The COUNT and LINE of the one exempted mention
  // are pinned by the removal gate and by removal-gate.test.ts; what is pinned
  // HERE is that the paragraph still has a live subject, which is the only
  // thing that entitles it to a permanent exemption.
  const bytes = readFileSync(join(HERE, "anno-memmap-render.ts"));
  assert.ok(bytes.includes(0x00), "the NUL byte that makes this a grep-blind file must still be here");
  const source = bytes.toString("utf8");

  const heading = "WHAT THE VERSION-2 DIGEST HASHED";
  assert.ok(source.includes(heading), "the provenance paragraph must still name the lineage it records");

  // It must CARRY the three shapes, because the three `interface` blocks it
  // used to sit above are gone -- a comment above a hole is not a record.
  for (const spelling of [
    "r2000_get_blocks",
    "{start_address, end_address, type}",
    "r2000_get_symbols",
    "{address, name, kind, type}",
    "r2000_get_comments",
    "{address, comment, type}",
  ]) {
    assert.ok(source.includes(spelling), `the paragraph must state ${spelling} inline`);
  }
  for (const declaration of ["interface R2000Block", "interface R2000Symbol", "interface R2000Comment"]) {
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
      const result = await renderMemoryMap({ storePath, provenancePath, workspaceRoot: HERE });
      assert.equal(result.rowCount, 1, "expected exactly one block row (the single code range)");
      assert.equal(result.unknownCount, 1, "expected exactly one [unknown]-graded comment");
      assert.match(result.renderDigest, /^[0-9a-f]{64}$/, "render digest must be 64 hex characters");

      // Golden expectation, hand-assembled from the rows written above rather
      // than derived from calling renderMemoryMap() itself. Every line is
      // asserted exactly except the render_digest line, checked by format.
      const expectedLines = [
        "<!--",
        "  GENERATED by `vice-mcp anno render-memmap` -- do not hand-edit; re-run the generator.",
        `  store: ${storePath}`,
        `  sidecar: ${provenancePath}`,
        `  render_digest: ${result.renderDigest}`,
        "  The digest covers the sorted listRanges/listLabels/listComments results, the",
        "  raw provenance sidecar bytes, and this renderer's version constant -- so either a hand edit or a",
        "  store-side change (e.g. a comment's confidence grade) is detected by `render-memmap --check`.",
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

      // The first block: banner contains the mandated phrases and both paths.
      assert.match(result.markdown, /do not hand-edit/);
      assert.ok(result.markdown.includes(storePath));
      assert.ok(result.markdown.includes(provenancePath));

      // ---------------------------------------------------------------------
      // checkRenderedMemoryMap: in-sync, hand-edit drift, store-change drift,
      // and missing.
      // ---------------------------------------------------------------------
      const renderedPath = join(dir, "memory-map.md");
      writeFileSync(renderedPath, result.markdown);

      const inSync = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: HERE });
      assert.deepEqual(inSync, { status: "in-sync" });

      const corrupted = result.markdown.replace("init_screen", "init_screeX");
      writeFileSync(renderedPath, corrupted);
      const drifted = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: HERE });
      assert.equal(drifted.status, "drifted");
      if (drifted.status === "drifted") {
        assert.match(drifted.actual, /init_screeX/);
        assert.match(drifted.expected, /init_screen \|/);
      }

      // Restore the file to exactly what was rendered, then change the STORE
      // (not the file) -- the digest must cover the store, not just the file.
      writeFileSync(renderedPath, result.markdown);
      const reclassify = openStore(storePath, { workspaceRoot: HERE });
      try {
        setComment(reclassify, {
          address: 0x0810,
          commentType: "line",
          text: formatConfidenceComment("probable-code", "reclassified"),
        });
      } finally {
        closeStore(reclassify);
      }

      const storeDrift = await checkRenderedMemoryMap({ storePath, provenancePath, renderedPath, workspaceRoot: HERE });
      assert.equal(storeDrift.status, "drifted", "a store-side change with the rendered file untouched must still register as drift");
      if (storeDrift.status === "drifted") {
        assert.match(storeDrift.expected, /render_digest:/, "the digest line itself is expected to be the first differing line here");
        assert.notEqual(storeDrift.expected, storeDrift.actual);
      }

      const missing = await checkRenderedMemoryMap({
        storePath,
        provenancePath,
        renderedPath: join(dir, "does-not-exist.md"),
        workspaceRoot: HERE,
      });
      assert.deepEqual(missing, { status: "missing", path: join(dir, "does-not-exist.md") });
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

/** Renders a one-range store whose single line comment carries `grade` and
 * `evidence`, and returns the Markdown. The escaping test below compares two
 * of these against each other. */
async function renderSingleCommentedBlock(prefix: string, grade: string, evidence: string): Promise<string> {
  return withRenderFixture(
    {
      prefix,
      fill: (handle) => {
        setDataType(handle, { start: 0x0810, endInclusive: 0x0814, dataType: "code" });
        setComment(handle, { address: 0x0810, commentType: "line", text: formatConfidenceComment(grade, evidence) });
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

// ---------------------------------------------------------------------------
// The regenerator2000 availability gate itself (D-11). Nothing above it is
// gated any more -- this is the one test left in this file that consults the
// gate at all, and it is what keeps `assertR2000RequiredIfEnvSet()`
// observable now that the surrounding suite runs everywhere.
//
// `SKIP_REASON` survives with no consumer above it ON PURPOSE. It is not
// dead weight to tidy away: this file's allow-list entry is discharged by
// plan 29-10, which deletes the gate module and this test together, and
// removing either here would discharge that entry inside a plan the entry
// does not cite.
// ---------------------------------------------------------------------------

const SKIP_REASON: string | false = skipReasonFor("anno-memmap-render.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});
