#!/usr/bin/env node
// dxa-run-cli.test.ts -- the CLI entry of dxa-run.ts, hermetic.
//
// runDxaCli() is driven with the module's own test seams (`run`,
// `imageBytes`, `listingText`), so no broker and no dxa is needed. Every
// case passes --project-root and --tools-root under a scratch directory, so
// nothing is written into this checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseDxaCli, runDxaCli, type DxaRunFn } from "./dxa-run.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A 3-byte body at $0801 (`lda #$00`, `rts`) and the dump listing dxa
 * would print for it. */
const IMAGE = Uint8Array.from([0x01, 0x08, 0xa9, 0x00, 0x60]);
const LISTING = "0801 a9 00  lda #$00\n0803 60  rts\n";

function withScratch(fn: (dir: string) => Promise<void> | void): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "dxa-run-cli-"));
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test("parseDxaCli: --image and --image-kind are required, and the kind is checked", () => {
  const noImage = parseDxaCli(["--image-kind", "prg"], "/work");
  assert.match(noImage.ok ? "" : noImage.message, /--image is required and has no default/);
  const noKind = parseDxaCli(["--image", "g.prg"], "/work");
  assert.match(noKind.ok ? "" : noKind.message, /--image-kind is required and has no default/);
  const badKind = parseDxaCli(["--image", "g.prg", "--image-kind", "bin"], "/work");
  assert.match(badKind.ok ? "" : badKind.message, /--image-kind must be/);
  assert.equal(parseDxaCli(["--image", "g.prg", "--image-kind", "prg", "extra"], "/work").ok, false);
});

test("parseDxaCli: paths resolve against cwd", () => {
  const r = parseDxaCli(
    ["--image", "g.prg", "--image-kind", "flat64k", "--entrypoints-path", "ep", "--datablocks-path", "b", "--labels-path", "l", "--project-root", "p", "--tools-root", "t", "--port", "1"],
    "/work",
  );
  assert.ok(r.ok, r.ok ? "" : r.message);
  assert.deepEqual(r.args, { image: "/work/g.prg", imageKind: "flat64k", entrypointsPath: "/work/ep", datablocksPath: "/work/b", labelsPath: "/work/l" });
  assert.deepEqual(r.opts, { repoRoot: "/work/p", toolsRoot: "/work/t", port: 1 });
});

test(
  "parseDxaCli: --known-data-rows reads a JSON array of rows and refuses anything else",
  withScratch((dir) => {
    writeFileSync(join(dir, "rows.json"), JSON.stringify([{ start: 0x0900, endInclusive: 0x09ff, dataType: "byte", sym: "tbl" }]));
    const r = parseDxaCli(["--image", "g.prg", "--image-kind", "prg", "--known-data-rows", "rows.json"], dir);
    assert.ok(r.ok, r.ok ? "" : r.message);
    assert.deepEqual(r.args.knownDataRows, [{ start: 0x0900, endInclusive: 0x09ff, dataType: "byte", sym: "tbl" }]);

    writeFileSync(join(dir, "obj.json"), JSON.stringify({ start: 1 }));
    const obj = parseDxaCli(["--image", "g.prg", "--image-kind", "prg", "--known-data-rows", "obj.json"], dir);
    assert.match(obj.ok ? "" : obj.message, /must hold a JSON array/);
    const missing = parseDxaCli(["--image", "g.prg", "--image-kind", "prg", "--known-data-rows", "nope.json"], dir);
    assert.match(missing.ok ? "" : missing.message, /cannot read --known-data-rows/);
  }),
);

test(
  "runDxaCli: a clean run returns the listing facts and $-hex ranges",
  withScratch(async (dir) => {
    const seen: Record<string, unknown>[] = [];
    const run: DxaRunFn = async (tool, args) => {
      seen.push(args);
      return { ok: true, tool, exitStatus: 0, results: [{ path: join(dir, "g.dxa-dump.lst"), sha256: "cc", byteLength: LISTING.length }], stderrTail: "" };
    };
    const r = await runDxaCli(["--image", "g.prg", "--image-kind", "prg", "--project-root", dir, "--tools-root", dir], { run, imageBytes: IMAGE, listingText: LISTING }, dir);
    assert.ok(r.ok, r.ok ? "" : r.message);
    assert.equal(r.listingPath, join(dir, "g.dxa-dump.lst"));
    assert.equal(r.codeBytes, 3);
    assert.equal(r.dataBytes, 0);
    assert.equal(r.firstAddress, "$0801");
    assert.equal(r.lastAddress, "$0803");
    assert.deepEqual(r.ranges, [
      { class: "code", start: "$0801", end: "$0802" },
      { class: "code", start: "$0803", end: "$0803" },
    ]);
    assert.deepEqual(r.unclassified, []);
    assert.deepEqual(r.outOfWindow, []);
    assert.deepEqual(seen, [{ image: join(dir, "g.prg"), imageKind: "prg" }]);
  }),
);

test(
  "runDxaCli: known-data rows become per-run -B/-l files that are removed after the run",
  withScratch(async (dir) => {
    writeFileSync(join(dir, "rows.json"), JSON.stringify([{ start: 0x0803, endInclusive: 0x0803, dataType: "byte", sym: "tbl" }]));
    let blocksText = "";
    let blocksPath = "";
    const run: DxaRunFn = async (tool, args) => {
      blocksPath = String(args.datablocksPath);
      blocksText = readFileSync(blocksPath, "utf8");
      return { ok: true, tool, exitStatus: 0, results: [{ path: join(dir, "g.lst"), sha256: "", byteLength: 0 }], stderrTail: "" };
    };
    const listing = "0801 a9 00  lda #$00\n0803 60  .byt $60\n";
    const r = await runDxaCli(
      ["--image", "g.prg", "--image-kind", "prg", "--known-data-rows", "rows.json", "--project-root", dir, "--tools-root", dir],
      { run, imageBytes: IMAGE, listingText: listing },
      dir,
    );
    assert.ok(r.ok, r.ok ? "" : r.message);
    assert.equal(blocksText, "0803-0803\n");
    assert.equal(existsSync(blocksPath), false, "the per-run input file is removed when the run ends");
    assert.equal(r.dataBytes, 1);
  }),
);

test(
  "runDxaCli: a seam refusal and a listing that does not cover the image are refusals",
  withScratch(async (dir) => {
    const argv = ["--image", "g.prg", "--image-kind", "prg", "--project-root", dir, "--tools-root", dir];
    const refused = await runDxaCli(argv, { run: async () => ({ ok: false, message: "dxa missing" }), imageBytes: IMAGE }, dir);
    assert.deepEqual(refused, { ok: false, message: "runDxaDisassemble: dxa.disassemble refused: dxa missing" });
    const run: DxaRunFn = async (tool) => ({ ok: true, tool, exitStatus: 0, results: [{ path: join(dir, "g.lst"), sha256: "", byteLength: 0 }], stderrTail: "" });
    const short = await runDxaCli(argv, { run, imageBytes: IMAGE, listingText: "0801 a9 00  lda #$00\n" }, dir);
    assert.equal(short.ok, false);
  }),
);

test(
  "the guarded entry: run as a script, the last stdout line is one ok:false JSON object and the exit is 1",
  withScratch((dir) => {
    const r = spawnSync(process.execPath, [join(HERE, "dxa-run.ts"), "--image", "g.prg"], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
    assert.equal(r.status, 1);
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines.length, 1, `stdout carries only the result line:\n${r.stdout}`);
    const parsed = JSON.parse(lines[0]!);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /--image-kind is required/);
  }),
);
