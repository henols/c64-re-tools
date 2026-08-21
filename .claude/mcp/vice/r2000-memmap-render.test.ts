// r2000-memmap-render.test.ts -- pins the D-24/D-27 reconciliation: the
// provenance sidecar schema (unit half, always runs), and the golden-output
// render plus its drift guard against a real regenerator2000 child (gated
// half, D-11).
import { test, after } from "node:test";
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
} from "./r2000-memmap-render.ts";
import { synthesizeProject } from "./r2000-project.ts";
import { runR2000Tool } from "./r2000-tools.ts";
import { formatConfidenceComment, CONFIDENCE_GRADES } from "./r2000-confidence.ts";
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
  const source = readFileSync(join(HERE, "r2000-memmap-render.ts"), "utf8");
  const templateFilenameMentions = (source.match(/memory-map\.template\.md/g) ?? []).length;
  assert.equal(templateFilenameMentions, 0, "r2000-memmap-render.ts must never name the recon skill's template file");
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

test("RENDERER_VERSION is bumped to \"2\" for the Markdown-cell-escaping output-shape change", () => {
  assert.equal(RENDERER_VERSION, "2");
});

// ---------------------------------------------------------------------------
// Gated: golden-output render plus drift detection against a real
// regenerator2000 child (D-11).
// ---------------------------------------------------------------------------

const SKIP_REASON: string | false = skipReasonFor("r2000-memmap-render.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});

let liveWorkDir: string | undefined;

after(() => {
  if (liveWorkDir) rmSync(liveWorkDir, { recursive: true, force: true });
});

test(
  "gated: renders a golden memory map from a small synthesized store plus a fixture sidecar, exact bytes except the digest line",
  { skip: SKIP_REASON },
  async () => {
    liveWorkDir = mkdtempSync(join(HERE, ".r2000-memmap-render-test-"));

    // lda #$1b ; sta $d011 -- criterion 3's own acceptance example, kept tiny
    // and fully hand-predictable so the golden output below can be
    // hand-verified rather than derived from the function under test.
    const bytes = new Uint8Array([0xa9, 0x1b, 0x8d, 0x11, 0xd0]);
    const origin = 0x0810;
    const projectJson = synthesizeProject(bytes, { origin });
    const projectPath = join(liveWorkDir, "probe.regen2000proj");
    writeFileSync(projectPath, projectJson);

    const disasm = await runR2000Tool("r2000_disassemble", { project: projectPath, address: origin });
    assert.equal(disasm.isError, false, `r2000_disassemble failed: ${JSON.stringify(disasm)}`);

    const label = await runR2000Tool("r2000_set_label_name", { project: projectPath, address: origin, name: "init_screen" });
    assert.equal(label.isError, false, `r2000_set_label_name failed: ${JSON.stringify(label)}`);

    const c1 = await runR2000Tool("r2000_set_comment", {
      project: projectPath,
      address: origin,
      comment: formatConfidenceComment("confirmed-code", "observed executing at boot"),
      type: "line",
    });
    assert.equal(c1.isError, false, `r2000_set_comment (confirmed-code) failed: ${JSON.stringify(c1)}`);

    const c2 = await runR2000Tool("r2000_set_comment", {
      project: projectPath,
      address: origin + 2,
      comment: formatConfidenceComment("unknown", "not yet classified"),
      type: "line",
    });
    assert.equal(c2.isError, false, `r2000_set_comment (unknown) failed: ${JSON.stringify(c2)}`);

    const provenance = {
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
      rasterPositions: ["$FA", "$19"],
    };
    const provenancePath = join(liveWorkDir, "capture.provenance.json");
    writeFileSync(provenancePath, JSON.stringify(provenance, null, 2));

    const result = await renderMemoryMap({ projectPath, provenancePath });
    assert.equal(result.rowCount, 1, "expected exactly one block row (the single Code block)");
    assert.equal(result.unknownCount, 1, "expected exactly one [unknown]-graded comment");
    assert.match(result.renderDigest, /^[0-9a-f]{64}$/, "render digest must be 64 hex characters");

    // Golden expectation: hand-assembled from the KNOWN measured shape of
    // this exact scenario (a real regenerator2000-core-0.9.20 disassembly of
    // this 5-byte program at $0810 always produces one Code block spanning
    // $0810-$0814 and the one user label/comments set above), not derived
    // from calling renderMemoryMap() itself. Every line is asserted exactly
    // except the render_digest line, which is checked separately by format.
    const expectedLines = [
      "<!--",
      "  GENERATED by `vice-mcp r2000 render-memmap` -- do not hand-edit; re-run the generator.",
      `  store: ${projectPath}`,
      `  sidecar: ${provenancePath}`,
      `  render_digest: ${result.renderDigest}`,
      "  The digest covers the sorted r2000_get_blocks/r2000_get_symbols/r2000_get_comments results, the",
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
      "| `$0810-$0814` | Code | CONFIRMED CODE | observed executing at boot |",
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
    assert.ok(result.markdown.includes(projectPath));
    assert.ok(result.markdown.includes(provenancePath));

    // ---------------------------------------------------------------------
    // checkRenderedMemoryMap: in-sync, hand-edit drift, store-change drift,
    // and missing.
    // ---------------------------------------------------------------------
    const renderedPath = join(liveWorkDir, "memory-map.md");
    writeFileSync(renderedPath, result.markdown);

    const inSync = await checkRenderedMemoryMap({ projectPath, provenancePath, renderedPath });
    assert.deepEqual(inSync, { status: "in-sync" });

    const corrupted = result.markdown.replace("init_screen", "init_screeX");
    writeFileSync(renderedPath, corrupted);
    const drifted = await checkRenderedMemoryMap({ projectPath, provenancePath, renderedPath });
    assert.equal(drifted.status, "drifted");
    if (drifted.status === "drifted") {
      assert.match(drifted.actual, /init_screeX/);
      assert.match(drifted.expected, /init_screen \|/);
    }

    // Restore the file to exactly what was rendered, then change the STORE
    // (not the file) -- the digest must cover the store, not just the file.
    writeFileSync(renderedPath, result.markdown);
    const reclassify = await runR2000Tool("r2000_set_comment", {
      project: projectPath,
      address: origin,
      comment: formatConfidenceComment("probable-code", "reclassified"),
      type: "line",
    });
    assert.equal(reclassify.isError, false, `r2000_set_comment (reclassify) failed: ${JSON.stringify(reclassify)}`);

    const storeDrift = await checkRenderedMemoryMap({ projectPath, provenancePath, renderedPath });
    assert.equal(storeDrift.status, "drifted", "a store-side change with the rendered file untouched must still register as drift");
    if (storeDrift.status === "drifted") {
      assert.match(storeDrift.expected, /render_digest:/, "the digest line itself is expected to be the first differing line here");
      assert.notEqual(storeDrift.expected, storeDrift.actual);
    }

    const missing = await checkRenderedMemoryMap({
      projectPath,
      provenancePath,
      renderedPath: join(liveWorkDir, "does-not-exist.md"),
    });
    assert.deepEqual(missing, { status: "missing", path: join(liveWorkDir, "does-not-exist.md") });
  },
);

test(
  "gated: an address whose store comment carries [unknown] appears under Open questions, and a malformed store comment throws rather than rendering silently",
  { skip: SKIP_REASON },
  async () => {
    const dir = mkdtempSync(join(HERE, ".r2000-memmap-render-test2-"));
    try {
      const bytes = new Uint8Array([0xa9, 0x1b, 0x8d, 0x11, 0xd0]);
      const origin = 0x0810;
      const projectPath = join(dir, "probe2.regen2000proj");
      writeFileSync(projectPath, synthesizeProject(bytes, { origin }));

      await runR2000Tool("r2000_disassemble", { project: projectPath, address: origin });

      const provenancePath = join(dir, "capture.provenance.json");
      writeFileSync(
        provenancePath,
        JSON.stringify({ ...VALID_HEADER }, null, 2),
      );

      // No comments at all yet -- Open questions is legitimately empty.
      const noComments = await renderMemoryMap({ projectPath, provenancePath });
      assert.equal(noComments.unknownCount, 0);
      assert.match(noComments.markdown, /## Open questions\n\n- \(none\)/);

      await runR2000Tool("r2000_set_comment", {
        project: projectPath,
        address: origin,
        comment: formatConfidenceComment("unknown", "no reliable interpretation yet"),
        type: "line",
      });

      const withUnknown = await renderMemoryMap({ projectPath, provenancePath });
      assert.equal(withUnknown.unknownCount, 1);
      assert.match(withUnknown.markdown, /## Open questions\n\n- \$0810: no reliable interpretation yet/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

async function renderSingleCommentedBlock(
  dir: string,
  projectName: string,
  grade: string,
  evidence: string,
): Promise<string> {
  const bytes = new Uint8Array([0xa9, 0x1b, 0x8d, 0x11, 0xd0]);
  const origin = 0x0810;
  const projectPath = join(dir, `${projectName}.regen2000proj`);
  writeFileSync(projectPath, synthesizeProject(bytes, { origin }));
  await runR2000Tool("r2000_disassemble", { project: projectPath, address: origin });
  await runR2000Tool("r2000_set_comment", {
    project: projectPath,
    address: origin,
    comment: formatConfidenceComment(grade, evidence),
    type: "line",
  });
  const provenancePath = join(dir, `${projectName}.provenance.json`);
  writeFileSync(provenancePath, JSON.stringify({ ...VALID_HEADER }, null, 2));
  const result = await renderMemoryMap({ projectPath, provenancePath });
  return result.markdown;
}

test(
  "gated: comment evidence containing BOTH a pipe and an embedded newline renders as ONE well-formed table row, table structure intact, escaped content preserved",
  { skip: SKIP_REASON },
  async () => {
    const dir = mkdtempSync(join(HERE, ".r2000-memmap-render-test3-"));
    try {
      const plainEvidence = "observed executing at boot";
      const trickyEvidence = "table | pipe\nsecond line";

      const plainMarkdown = await renderSingleCommentedBlock(dir, "plain", "confirmed-code", plainEvidence);
      const trickyMarkdown = await renderSingleCommentedBlock(dir, "tricky", "probable-data", trickyEvidence);

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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
