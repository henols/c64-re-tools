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
import { isAbsolute, join } from "node:path";

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

/** Builds a scratch `prerequisites.json` declaring one directory-kind tool
 * id with no env var, for the trailing-separator test below -- the real
 * committed declaration carries no directory-kind record until plan 59-02,
 * so this test drives the declaration-resolution logic (`deps.here`)
 * against a fixture rather than the real file, exactly as the compiled-
 * artifact case above does for a different reason. */
function withDirectoryKindFixture<T>(fn: (here: string) => T): T {
  return withScratch((here) => {
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: { "test-dir-tool": { id: "test-dir-tool", location: { fileOverridable: true }, kind: "directory" } },
      }),
    );
    return fn(here);
  });
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

test("a tools.json value beginning ~/ expands against the injected HOME and resolves absolute", () => {
  withScratch((dir) => {
    const home = join(dir, "home");
    const binDir = join(home, "bin");
    mkdirSync(binDir, { recursive: true });
    const bin = join(binDir, "x64sc");
    writeFileSync(bin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: "~/bin/x64sc" }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { HOME: home },
    });

    assert.equal(result.path, bin);
    assert.equal(isAbsolute(result.path as string), true);
    assert.equal(result.layer, "file");
  });
});

test("a bare ~ with no separator is joined against projectRoot rather than expanded", () => {
  withScratch((dir) => {
    const projectRoot = join(dir, "project");
    const bin = join(projectRoot, "~");
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(bin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: "~" }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot,
      env: { HOME: join(dir, "should-not-be-used") },
    });

    assert.equal(result.path, bin);
  });
});

test("a relative tools.json value resolves against projectRoot, not toolsDir and not process cwd", () => {
  withScratch((dir) => {
    const toolsDir = join(dir, "tools-dir-unrelated");
    const projectRoot = join(dir, "project-root");
    mkdirSync(toolsDir, { recursive: true });
    mkdirSync(join(projectRoot, "vendor"), { recursive: true });
    const bin = join(projectRoot, "vendor", "x64sc");
    writeFileSync(bin, "");
    writeFileSync(join(toolsDir, "tools.json"), JSON.stringify({ x64sc: "vendor/x64sc" }));

    const result = resolveTool("x64sc", {
      toolsDir,
      projectRoot,
      env: {},
    });

    assert.equal(result.path, bin);
  });
});

test("a non-ASCII tools.json path segment round-trips byte-identically", () => {
  withScratch((dir) => {
    const segment = "båt-åäö";
    const binDir = join(dir, segment);
    mkdirSync(binDir, { recursive: true });
    const bin = join(binDir, "x64sc");
    writeFileSync(bin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: join(dir, segment, "x64sc") }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: {},
    });

    assert.equal(result.path, bin);
    assert.ok(result.path && result.path.includes(segment));
  });
});

test("a directory-kind candidate with a trailing separator resolves to the same path as one without", () => {
  withDirectoryKindFixture((here) => {
    withScratch((dir) => {
      const libDir = join(dir, "lib");
      mkdirSync(libDir, { recursive: true });
      writeFileSync(join(dir, "tools.json"), JSON.stringify({ "test-dir-tool": `${libDir}/` }));

      const withSlash = resolveTool("test-dir-tool", { toolsDir: dir, projectRoot: dir, env: {}, here });

      writeFileSync(join(dir, "tools.json"), JSON.stringify({ "test-dir-tool": libDir }));
      const withoutSlash = resolveTool("test-dir-tool", { toolsDir: dir, projectRoot: dir, env: {}, here });

      assert.equal(withSlash.path, libDir);
      assert.equal(withSlash.path, withoutSlash.path);
    });
  });
});

test("no cache: a binary appearing on the injected PATH between two calls is found by the second call", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "x64sc");

    const first = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });
    assert.equal(first.path, null);

    writeFileSync(probeBin, "");

    const second = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });
    assert.equal(second.path, probeBin);
  });
});

test("many concurrent resolveTool calls against one scratch tree each match the same call made alone", async () => {
  await withScratch(async (dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "x64sc");
    writeFileSync(probeBin, "");
    const deps = { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } };

    const solo = resolveTool("x64sc", deps);
    const concurrent = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(resolveTool("x64sc", deps))));

    for (const result of concurrent) {
      assert.deepEqual(result, solo);
    }
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
