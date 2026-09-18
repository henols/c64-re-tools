// tool-location.test.ts
//
// Colocated test for tool-location.mts (see that module's own header for
// what it is and what it deliberately is not). Two groups of behaviours are
// proven here.
//
// The three-layer wiring itself (Task 2): the environment layer winning
// over a competing `tools.json` entry, the file layer answering when the
// environment is unset, the `$PATH` probe answering when neither of the
// first two do, the "nothing answered" case's `tried` ordering, the same
// three layers surviving compilation into resources/tool-location.mjs, and
// an unknown tool id's refusal without `tools.json` ever being touched.
//
// The file-layer path normalisation and the two no-state proofs (Task 3):
// `~/` expansion against an injected HOME, a bare `~` left un-expanded and
// joined against `projectRoot` instead, a relative value resolved against
// `projectRoot` rather than `toolsDir` or the process cwd, a non-ASCII
// segment surviving byte-identically, a directory-kind trailing separator
// resolving to the same path as one without, a binary appearing on `$PATH`
// between two calls being found by the second with no reset call, and many
// concurrent calls against one scratch tree each matching a solo call.
//
// Every fixture is a real scratch directory built with mkdtempSync, and
// every path handed to `resolveTool()` is a real file on disk -- this
// suite has no mocking library, matching this project's own convention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";
import { resolveTool, validateToolsFile } from "./tool-location.mts";

/** This test file's own directory -- used only to locate the real,
 * committed `prerequisites.json` for the two exclusion tests below, which
 * read its `reason` fields directly rather than duplicating those
 * sentences as string literals in this file. */
const HERE_DIR = dirname(fileURLToPath(import.meta.url));

function withScratch<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "tool-location-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Builds a scratch `prerequisites.json` declaring one directory-kind tool
 * id with no env var, for the trailing-separator test below -- this test
 * drives the declaration-resolution logic (`deps.here`) against a fixture
 * rather than the real file, exactly as the compiled-artifact case above
 * does for a different reason. Carries a `marker`, matching the shape
 * every real directory-kind record declares (D-07): plan 59-02's
 * kind-aware existence check requires one for a directory-kind id, and a
 * marker-less fixture would test a record shape the real declaration
 * never produces. */
function withDirectoryKindFixture<T>(fn: (here: string) => T): T {
  return withScratch((here) => {
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: {
          "test-dir-tool": { id: "test-dir-tool", location: { fileOverridable: true }, kind: "directory", marker: "marker-file" },
        },
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
      writeFileSync(join(libDir, "marker-file"), "");
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

// -----------------------------------------------------------------------
// Task 2: kind-aware resolution, the two directory-kind tool ids, and the
// two ids this project must never resolve through any layer at all.
// -----------------------------------------------------------------------

/** Builds a scratch declaration carrying one non-file-overridable tool id
 * with a caller-chosen `reason`, so a test can prove the refusal text is
 * read from the declaration at call time rather than duplicated in the
 * module -- change the reason here, and the refusal must change with it. */
function withExclusionFixture<T>(reason: string, fn: (here: string) => T): T {
  return withScratch((here) => {
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: { "test-excluded-tool": { id: "test-excluded-tool", location: { fileOverridable: false, reason }, kind: "executable" } },
      }),
    );
    return fn(here);
  });
}

test("resolveTool(\"acme-lib\", …) resolves through the environment variable to the directory itself, never the marker-joined path", () => {
  withScratch((dir) => {
    const libDir = join(dir, "acme-lib-dir");
    mkdirSync(join(libDir, "cbm", "c64"), { recursive: true });
    writeFileSync(join(libDir, "cbm", "c64", "vic.a"), "");

    const result = resolveTool("acme-lib", {
      toolsDir: dir,
      projectRoot: dir,
      env: { ACME: libDir },
    });

    assert.equal(result.path, libDir);
    assert.equal(result.layer, "env");
    assert.equal(result.mechanism, "ACME");
    assert.equal((result.path as string).endsWith("vic.a"), false);
  });
});

test("resolveTool(\"ghidra\", …) resolves through tools.json to the directory when its marker is present", () => {
  withScratch((dir) => {
    const ghidraHome = join(dir, "ghidra-home");
    mkdirSync(join(ghidraHome, "support"), { recursive: true });
    writeFileSync(join(ghidraHome, "support", "analyzeHeadless"), "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ ghidra: ghidraHome }));

    const result = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(result.path, ghidraHome);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
  });
});

test("resolveTool(\"ghidra\", …) refuses a tools.json directory that exists but lacks its marker", () => {
  withScratch((dir) => {
    const ghidraHome = join(dir, "ghidra-home-no-marker");
    mkdirSync(ghidraHome, { recursive: true });
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ ghidra: ghidraHome }));

    const result = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.length > 0);
    assert.ok(result.refusal.includes("ghidra"));
  });
});

test("resolveTool(\"c1541\", …) consults no environment variable at all", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "c1541");
    writeFileSync(probeBin, "");

    const withRandomEnv = resolveTool("c1541", {
      toolsDir: dir,
      projectRoot: dir,
      env: { C1541_BIN: join(dir, "should-never-be-read"), PATH: pathDir },
    });
    const withNoEnv = resolveTool("c1541", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });

    assert.equal(withRandomEnv.path, probeBin);
    assert.equal(withRandomEnv.layer, "probe");
    assert.deepEqual(withRandomEnv, withNoEnv);
  });
});

test("resolveTool(\"dxa\", …) refuses through every layer with the declared reason, even when tools.json, env and PATH all name real files", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "dxa"), "");
    const fileBin = join(dir, "dxa-file");
    writeFileSync(fileBin, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ dxa: fileBin }));

    const result = resolveTool("dxa", {
      toolsDir: dir,
      projectRoot: dir,
      env: { PATH: pathDir },
    });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.deepEqual(result.tried, []);
    assert.ok(result.refusal && result.refusal.includes("dxa is vendored and built by this project"));
  });
});

test("resolveTool(\"node\", …) refuses through every layer with the declared reason, even when VICE_BROKER_NODE names a real executable", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "node"), "");
    const brokerNode = join(dir, "broker-node");
    writeFileSync(brokerNode, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ node: brokerNode }));

    const result = resolveTool("node", {
      toolsDir: dir,
      projectRoot: dir,
      env: { VICE_BROKER_NODE: brokerNode, PATH: pathDir },
    });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.deepEqual(result.tried, []);
    assert.ok(result.refusal && result.refusal.includes("vice-launcher.sh is bash"));
  });
});

test("a directory-kind id is not walked on $PATH: no environment and no file entry leaves tried with no PATH candidate", () => {
  withScratch((dir) => {
    const resultAcmeLib = resolveTool("acme-lib", { toolsDir: dir, projectRoot: dir, env: { PATH: join(dir, "bin") } });
    const resultGhidra = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: { PATH: join(dir, "bin") } });

    assert.equal(resultAcmeLib.path, null);
    assert.deepEqual(resultAcmeLib.tried, []);
    assert.equal(resultGhidra.path, null);
    assert.deepEqual(resultGhidra.tried, []);
  });
});

test("the exclusion refusal is read from the declaration at call time, not duplicated in the module", () => {
  const reasonA = "reason-A for the record.";
  const reasonB = "a completely different reason-B for the record.";

  withExclusionFixture(reasonA, (hereA) => {
    const resultA = resolveTool("test-excluded-tool", { toolsDir: hereA, projectRoot: hereA, env: {}, here: hereA });
    assert.ok(resultA.refusal && resultA.refusal.includes(reasonA));
  });

  withExclusionFixture(reasonB, (hereB) => {
    const resultB = resolveTool("test-excluded-tool", { toolsDir: hereB, projectRoot: hereB, env: {}, here: hereB });
    assert.ok(resultB.refusal && resultB.refusal.includes(reasonB));
  });
});

test("compiled artifact: the two directory-kind ids and the two excluded ids behave the same as the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    resolveTool: typeof resolveTool;
  };

  withScratch((dir) => {
    const libDir = join(dir, "acme-lib-dir");
    mkdirSync(join(libDir, "cbm", "c64"), { recursive: true });
    writeFileSync(join(libDir, "cbm", "c64", "vic.a"), "");
    const result = compiled.resolveTool("acme-lib", { toolsDir: dir, projectRoot: dir, env: { ACME: libDir } });
    assert.equal(result.path, libDir);
    assert.equal(result.layer, "env");
  });

  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "dxa"), "");
    const result = compiled.resolveTool("dxa", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });
    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("dxa is vendored and built by this project"));
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

// -----------------------------------------------------------------------
// Plan 59-03, Task 1: `validateToolsFile()` -- the file judged alone, with
// no resolution performed. The real declaration read here is the committed
// `prerequisites.json`, unless a case uses `withExclusionFixture`/`here`.
// -----------------------------------------------------------------------

test("validateToolsFile: an absent tools.json, a zero-byte one and a bare {} one each return no problems", () => {
  withScratch((dir) => {
    const absent = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(absent, []);

    writeFileSync(join(dir, "tools.json"), "");
    const emptyBytes = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(emptyBytes, []);

    writeFileSync(join(dir, "tools.json"), "{}");
    const emptyObject = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(emptyObject, []);
  });
});

test("validateToolsFile: unparseable JSON is exactly one file-level problem naming the file path (planted violation), and valid JSON is a clean control", () => {
  withScratch((dir) => {
    const filePath = join(dir, "tools.json");
    writeFileSync(filePath, "{");

    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });

    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.toolId, null);
    assert.ok(problems[0]!.message.includes(filePath));

    writeFileSync(filePath, "{}");
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: a non-object top level (array) is exactly one file-level problem (planted violation); an object top level is a clean control", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), "[]");
    const arrayTop = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(arrayTop.length, 1);
    assert.equal(arrayTop[0]!.toolId, null);

    writeFileSync(join(dir, "tools.json"), "{}");
    const objectTop = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(objectTop, []);
  });
});

test("validateToolsFile: an unknown key is one problem naming it (planted violation); a declared id with a valid value is a clean control", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ vice: "/some/path" }));
    const unknown = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(unknown.length, 1);
    assert.equal(unknown[0]!.key, "vice");
    assert.ok(unknown[0]!.message.includes("vice"));

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: "/opt/vice/bin/x64sc" }));
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: a key beginning with an underscore is never reported as unknown, whatever its value", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ _readme: "hello", _viceBrokerNode: 42, _anything: null }));
    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(problems, []);
  });
});

test("validateToolsFile: a case-variant, whitespace-padded, or decomposed-Unicode key is reported as unknown rather than silently matched (planted violations); the exact declared id is a clean control", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ X64SC: "/x" }));
    const caseVariant = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(caseVariant.length, 1);
    assert.equal(caseVariant[0]!.key, "X64SC");

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ "x64sc ": "/x" }));
    const whitespacePadded = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(whitespacePadded.length, 1);
    assert.equal(whitespacePadded[0]!.key, "x64sc ");

    const decomposed = "acme-lib".replace("a", "á"); // combining acute accent, never a real id
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ [decomposed]: "/x" }));
    const decomposedResult = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(decomposedResult.length, 1);
    assert.equal(decomposedResult[0]!.key, decomposed);

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: "/x" }));
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: a JavaScript-prototype-shaped key is reported as unknown with no separate branch (planted violation)", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), '{"__proto__":"/x"}');
    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.key, "__proto__");

    // Prose (a comment) is allowed to name "__proto__" to explain the
    // exemption's shape; a CODE branch keyed on the literal is not. This
    // greps for the code-shaped forms specifically, never the bare
    // substring, so a comment mentioning the name does not fail this check.
    const moduleSource = readFileSync(new URL("./tool-location.mts", import.meta.url), "utf8");
    assert.ok(
      !/[=!]==?\s*["']__proto__["']/.test(moduleSource),
      "the module must contain no comparison branch keyed on the literal __proto__",
    );
  });
});

test("validateToolsFile: a non-string value for a declared id is one problem per shape (planted violations); a non-empty string is the clean control", () => {
  withScratch((dir) => {
    for (const badValue of [null, false, 0, [], {}, ""]) {
      writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: badValue }));
      const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
      assert.equal(problems.length, 1, `expected exactly one problem for value ${JSON.stringify(badValue)}`);
      assert.equal(problems[0]!.toolId, "x64sc");
    }

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: "/opt/vice/bin/x64sc" }));
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: naming the vendored disassembler is one problem quoting the declaration's own reason verbatim (planted violation); omitting it is a clean control", () => {
  withScratch((dir) => {
    const prereq = JSON.parse(readFileSync(join(HERE_DIR, "prerequisites.json"), "utf8")) as {
      tools: Record<string, { location?: { reason?: string } }>;
    };
    const dxaReason = prereq.tools.dxa!.location!.reason!;

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ dxa: "/some/dxa" }));
    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.toolId, "dxa");
    assert.ok(problems[0]!.message.includes(dxaReason));

    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: naming the Node interpreter is one problem quoting the declaration's own reason verbatim (planted violation); omitting it is a clean control", () => {
  withScratch((dir) => {
    const prereq = JSON.parse(readFileSync(join(HERE_DIR, "prerequisites.json"), "utf8")) as {
      tools: Record<string, { location?: { reason?: string } }>;
    };
    const nodeReason = prereq.tools.node!.location!.reason!;

    writeFileSync(join(dir, "tools.json"), JSON.stringify({ node: "/some/node" }));
    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.toolId, "node");
    assert.ok(problems[0]!.message.includes(nodeReason));

    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
    const clean = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(clean, []);
  });
});

test("validateToolsFile: pointing `here` at a scratch declaration with different reason strings changes both exclusion messages, proving neither sentence is a literal in the module", () => {
  withScratch((here) => {
    const reasonA = "reason-A, unique to this scratch declaration.";
    const reasonB = "a completely different reason-B, also unique to this scratch declaration.";
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: {
          "test-dxa": { id: "test-dxa", location: { fileOverridable: false, reason: reasonA }, kind: "executable" },
          "test-node": { id: "test-node", location: { fileOverridable: false, reason: reasonB }, kind: "executable" },
        },
      }),
    );

    withScratch((dir) => {
      writeFileSync(join(dir, "tools.json"), JSON.stringify({ "test-dxa": "/x", "test-node": "/y" }));
      const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir, here });

      assert.equal(problems.length, 2);
      const dxaProblem = problems.find((p) => p.key === "test-dxa");
      const nodeProblem = problems.find((p) => p.key === "test-node");
      assert.ok(dxaProblem && dxaProblem.message.includes(reasonA));
      assert.ok(nodeProblem && nodeProblem.message.includes(reasonB));
    });
  });
});

test("validateToolsFile: one unknown key plus one valid entry returns exactly one problem, naming the unknown key", () => {
  withScratch((dir) => {
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ vice: "/some/path", x64sc: "/opt/vice/bin/x64sc" }));
    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.equal(problems.length, 1);
    assert.equal(problems[0]!.key, "vice");
  });
});

test("validateToolsFile: several distinct problems are returned one per problem, in file key order, deterministically across repeated calls", () => {
  withScratch((dir) => {
    writeFileSync(
      join(dir, "tools.json"),
      JSON.stringify({ unknown_first: "/x", x64sc: null, dxa: "/y", acme: "/opt/acme" }),
    );
    const first = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    const second = validateToolsFile({ toolsDir: dir, projectRoot: dir });

    assert.equal(first.length, 3);
    assert.deepEqual(
      first.map((p) => p.key),
      ["unknown_first", "x64sc", "dxa"],
    );
    assert.deepEqual(second, first);
  });
});
