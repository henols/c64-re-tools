// tool-location.test.ts
//
// Colocated test for tool-location.mts (see that module's own header for
// what it is and what it deliberately is not). Six behaviours are proven
// here: the environment layer winning over a competing `tools.json` entry,
// the file layer answering when the environment is unset, the `$PATH`
// probe answering when neither of the first two do, the "nothing answered"
// case's `tried` ordering, the same three layers surviving compilation into
// resources/tool-location.mjs, and an unknown tool id's refusal without
// `tools.json` ever being touched.
//
// Every fixture is a real scratch directory built with mkdtempSync, and
// every path handed to `resolveTool()` is a real file on disk -- this
// suite has no mocking library, matching this project's own convention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build } from "./build.ts";
import { resolveTool } from "./tool-location.mts";

function withScratch<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "tool-location-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("environment layer wins over a competing tools.json entry", () => {
  withScratch((dir) => {
    const envBin = join(dir, "x64sc-env");
    writeFileSync(envBin, "");
    const fileBin = join(dir, "x64sc-file");
    writeFileSync(fileBin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { VICE_BIN: envBin },
    });

    assert.equal(result.path, envBin);
    assert.equal(result.layer, "env");
    assert.equal(result.mechanism, "VICE_BIN");
    assert.equal(result.refusal, null);
  });
});

test("file layer answers when the environment variable is unset", () => {
  withScratch((dir) => {
    const fileBin = join(dir, "x64sc-file");
    writeFileSync(fileBin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: {},
    });

    assert.equal(result.path, fileBin);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
  });
});

test("$PATH probe answers when neither the environment nor tools.json do", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "x64sc");
    writeFileSync(probeBin, "");

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { PATH: pathDir },
    });

    assert.equal(result.path, probeBin);
    assert.equal(result.layer, "probe");
    assert.equal(result.mechanism, "$PATH");
  });
});

test("nothing answers: path/layer/mechanism are null and tried lists the environment candidate first, PATH candidates last", () => {
  withScratch((dir) => {
    const envBin = join(dir, "does-not-exist-env");
    const fileBin = join(dir, "does-not-exist-file");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));
    const pathDirA = join(dir, "bin-a");
    const pathDirB = join(dir, "bin-b");
    mkdirSync(pathDirA, { recursive: true });
    mkdirSync(pathDirB, { recursive: true });

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { VICE_BIN: envBin, PATH: `${pathDirA}:${pathDirB}` },
    });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.equal(result.refusal, null);
    assert.equal(result.tried[0], envBin);
    assert.deepEqual(result.tried.slice(-2), [join(pathDirA, "x64sc"), join(pathDirB, "x64sc")]);
  });
});

test("compiled artifact: the same three layers answer from resources/tool-location.mjs, not only from the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    resolveTool: typeof resolveTool;
  };

  withScratch((dir) => {
    const envBin = join(dir, "x64sc-env");
    writeFileSync(envBin, "");
    const result = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } });
    assert.equal(result.path, envBin);
    assert.equal(result.layer, "env");
    assert.equal(result.mechanism, "VICE_BIN");
  });

  withScratch((dir) => {
    const fileBin = join(dir, "x64sc-file");
    writeFileSync(fileBin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));
    const result = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(result.path, fileBin);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
  });

  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "x64sc");
    writeFileSync(probeBin, "");
    const result = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });
    assert.equal(result.path, probeBin);
    assert.equal(result.layer, "probe");
    assert.equal(result.mechanism, "$PATH");
  });
});

test("an undeclared tool id is refused by name, and tools.json is never touched to answer it", () => {
  withScratch((dir) => {
    const result = resolveTool("not-a-real-tool", {
      toolsDir: dir,
      projectRoot: dir,
      env: {},
      exists: () => {
        throw new Error("resolveTool must not check any tools.json-related candidate for an id it does not know");
      },
      readFile: () => {
        throw new Error("resolveTool must not read tools.json for an id it does not know");
      },
    });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.ok(result.refusal && result.refusal.includes("not-a-real-tool"));
  });
});
