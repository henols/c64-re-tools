#!/usr/bin/env node
// ghidra-run-cli.test.ts -- the CLI entry of ghidra-run.ts, hermetic.
//
// runGhidraCli() is driven with the module's own test seams (`run`,
// `runLogText`), so no broker and no Ghidra is needed. Every case passes
// --project-root and --tools-root under a scratch directory, so nothing is
// written into this checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { parseGhidraCli, runGhidraCli, type GhidraRunFn } from "../../src/mcp/vice/ghidra-run.ts";
import { VICE_DIR } from "./paths.ts";

const LOG_OK = "INFO  Using Language/Compiler: 6502:LE:16:nmos:default (ProgramLoader)\n";

/** A .prg that loads at $0801: `lda #$00`, `rts`. */
const PRG_0801 = Uint8Array.from([0x01, 0x08, 0xa9, 0x00, 0x60]);

/** Runs `fn` in a scratch directory that holds `g.prg` (PRG_0801). */
function withScratch(fn: (dir: string) => Promise<void> | void): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "ghidra-run-cli-"));
    writeFileSync(join(dir, "g.prg"), PRG_0801);
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

const BASE = ["--run-id", "g", "--import-path", "g.prg", "--processor", "6502:LE:16:nmos", "--import-route", "prg"];

test("parseGhidraCli: each required flag is refused by name when missing", () => {
  for (const name of ["--run-id", "--import-path", "--processor", "--import-route"]) {
    const i = BASE.indexOf(name);
    const argv = [...BASE.slice(0, i), ...BASE.slice(i + 2)];
    const r = parseGhidraCli(argv, "/work");
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.message, new RegExp(`${name} is required and has no default`));
  }
});

test("parseGhidraCli: an unknown flag and a bad route are refused", () => {
  assert.equal(parseGhidraCli([...BASE, "--frob", "x"], "/work").ok, false);
  const route = parseGhidraCli(["--run-id", "g", "--import-path", "g.prg", "--processor", "p:q", "--import-route", "bin"], "/work");
  assert.match(route.ok ? "" : route.message, /--import-route must be/);
});

test("parseGhidraCli: input paths resolve against cwd; the export name is passed as given", () => {
  const r = parseGhidraCli(
    [...BASE, "--pre-script", "s/Pre.java", "--post-script", "s/Post.java", "--entrypoints-path", "ep", "--data-ranges-path", "dr", "--export-path", "g.export.txt", "--noanalysis", "--loader-base-addr", "0x7ff", "--expected-classification-lines", "12", "--project-root", "proj", "--tools-root", "t", "--port", "6510"],
    "/work",
  );
  assert.ok(r.ok, r.ok ? "" : r.message);
  assert.deepEqual(r.args, {
    runId: "g",
    importPath: "/work/g.prg",
    processor: "6502:LE:16:nmos",
    importRoute: "prg",
    loaderBaseAddr: "0x7ff",
    noanalysis: true,
    preScript: "/work/s/Pre.java",
    postScript: "/work/s/Post.java",
    entrypointsPath: "/work/ep",
    exportPath: "g.export.txt",
    dataRangesPath: "/work/dr",
    expectedClassificationLines: 12,
  });
  assert.deepEqual(r.opts, { repoRoot: "/work/proj", toolsRoot: "/work/t", port: 6510 });
});

test(
  "runGhidraCli: a clean run returns ok:true with the export path and the flattened language",
  withScratch(async (dir) => {
    const seen: { tool: string; args: Record<string, unknown> }[] = [];
    const run: GhidraRunFn = async (tool, args) => {
      seen.push({ tool, args });
      return {
        ok: true,
        tool,
        exitStatus: 0,
        results: [
          { path: join(dir, "g.ghidra-run.log"), sha256: "aa", byteLength: 10 },
          { path: join(dir, "g.export.txt"), sha256: "bb", byteLength: 20 },
        ],
        stderrTail: "",
      };
    };
    const r = await runGhidraCli([...BASE, "--export-path", "g.export.txt", "--post-script", "Post.java", "--project-root", dir, "--tools-root", dir], { run, runLogText: LOG_OK }, dir);
    assert.deepEqual(r, {
      ok: true,
      runLogPath: join(dir, "g.ghidra-run.log"),
      sha256: "aa",
      byteLength: 10,
      exportPath: join(dir, "g.export.txt"),
      exitStatus: 0,
      language: "6502:LE:16:nmos",
    });
    assert.equal(seen[0]?.tool, "ghidra.analyze");
    assert.equal(seen[0]?.args.importPath, join(dir, "g.prg"));
  }),
);

/** A runner that records each request and returns a clean run. */
function recordingRun(dir: string, seen: Record<string, unknown>[]): GhidraRunFn {
  return async (tool, args) => {
    seen.push(args);
    return { ok: true, tool, exitStatus: 0, results: [{ path: join(dir, "l.log"), sha256: "", byteLength: 0 }], stderrTail: "" };
  };
}

test(
  "runGhidraCli: with no loader base, a .prg run sends the base two bytes below the image's load address",
  withScratch(async (dir) => {
    const seen: Record<string, unknown>[] = [];
    const run = recordingRun(dir, seen);
    const opts = ["--project-root", dir, "--tools-root", dir];
    const r = await runGhidraCli([...BASE, ...opts], { run, runLogText: LOG_OK }, dir);
    assert.equal(r.ok, true, r.ok ? "" : r.message);
    assert.equal(seen[0]?.loaderBaseAddr, "0x7ff");

    writeFileSync(join(dir, "hi.prg"), Uint8Array.from([0x00, 0xc0, 0x60]));
    const hi = await runGhidraCli(["--run-id", "g", "--import-path", "hi.prg", "--processor", "6502:LE:16:nmos", "--import-route", "prg", ...opts], { run, runLogText: LOG_OK }, dir);
    assert.equal(hi.ok, true, hi.ok ? "" : hi.message);
    assert.equal(seen[1]?.loaderBaseAddr, "0xbffe");
  }),
);

test(
  "runGhidraCli: an explicit loader base is sent as given, and the flat64k route sends none",
  withScratch(async (dir) => {
    const seen: Record<string, unknown>[] = [];
    const run = recordingRun(dir, seen);
    const opts = ["--project-root", dir, "--tools-root", dir];
    await runGhidraCli([...BASE, "--loader-base-addr", "0x1000", ...opts], { run, runLogText: LOG_OK }, dir);
    assert.equal(seen[0]?.loaderBaseAddr, "0x1000");
    await runGhidraCli(["--run-id", "g", "--import-path", "g.bin", "--processor", "6502:LE:16:nmos", "--import-route", "flat64k", ...opts], { run, runLogText: LOG_OK }, dir);
    assert.equal("loaderBaseAddr" in seen[1]!, false);
  }),
);

test(
  "runGhidraCli: a .prg with no load address to read is refused before any request",
  withScratch(async (dir) => {
    const seen: Record<string, unknown>[] = [];
    const run = recordingRun(dir, seen);
    const opts = ["--project-root", dir, "--tools-root", dir];
    writeFileSync(join(dir, "short.prg"), Uint8Array.from([0x01, 0x08]));
    const short = await runGhidraCli(["--run-id", "g", "--import-path", "short.prg", "--processor", "6502:LE:16:nmos", "--import-route", "prg", ...opts], { run }, dir);
    assert.match(short.ok ? "" : short.message, /not a \.prg: 2 byte\(s\)/);
    const missing = await runGhidraCli(["--run-id", "g", "--import-path", "none.prg", "--processor", "6502:LE:16:nmos", "--import-route", "prg", ...opts], { run }, dir);
    assert.match(missing.ok ? "" : missing.message, /cannot read the \.prg image/);
    assert.equal(seen.length, 0);
  }),
);

test(
  "runGhidraCli: a thrown script and a language mismatch are refusals, never ok:true",
  withScratch(async (dir) => {
    const run: GhidraRunFn = async (tool) => ({ ok: true, tool, exitStatus: 0, results: [{ path: join(dir, "l.log"), sha256: "", byteLength: 0 }], stderrTail: "" });
    const opts = [...BASE, "--project-root", dir, "--tools-root", dir];
    const threw = await runGhidraCli(opts, { run, runLogText: LOG_OK + "ERROR REPORT SCRIPT ERROR: boom\n" }, dir);
    assert.equal(threw.ok, false);
    assert.match(threw.ok ? "" : threw.message, /a script threw/);
    const other = await runGhidraCli(opts, { run, runLogText: "INFO  Using Language/Compiler: 6502:LE:16:default:default (ProgramLoader)\n" }, dir);
    assert.match(other.ok ? "" : other.message, /language mismatch/);
    const refused = await runGhidraCli(opts, { run: async () => ({ ok: false, message: "no broker" }) }, dir);
    assert.deepEqual(refused, { ok: false, message: "runGhidraAnalyze: ghidra.analyze refused: no broker" });
  }),
);

test(
  "the guarded entry: run as a script, the last stdout line is one ok:false JSON object and the exit is 1",
  withScratch((dir) => {
    const r = spawnSync(process.execPath, [join(VICE_DIR, "ghidra-run.ts"), "--run-id", "g"], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
    assert.equal(r.status, 1);
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines.length, 1, `stdout carries only the result line:\n${r.stdout}`);
    const parsed = JSON.parse(lines[0]!);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /--import-path is required/);
  }),
);

/** Spawns ghidra-run.ts from `cwd` with no project-root variables set. */
function spawnGhidraRun(cwd: string, script: string, args: string[]) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.C64RE_PROJECT_ROOT;
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", timeout: 30_000, env });
}

test(
  "the entry runs when the script is reached through a symlink",
  withScratch((dir) => {
    const link = join(dir, "ghidra-run-link.ts");
    symlinkSync(join(VICE_DIR, "ghidra-run.ts"), link);
    const r = spawnGhidraRun(dir, link, ["--run-id", "g"]);
    assert.equal(r.status, 1);
    assert.match(JSON.parse(r.stdout.trim()).message, /--import-path is required/);
  }),
);

test(
  "the CLI with no --project-root uses the project found from the current directory",
  withScratch((dir) => {
    mkdirSync(join(dir, ".git"));
    // Port 1 refuses the connection, so the run fails after the tools root is made.
    const r = spawnGhidraRun(dir, join(VICE_DIR, "ghidra-run.ts"), [...BASE, "--port", "1"]);
    assert.equal(r.status, 1, r.stderr);
    assert.ok(existsSync(join(dir, ".c64-re-tools", "local")), "the tools root is under the project found from the cwd");
  }),
);
