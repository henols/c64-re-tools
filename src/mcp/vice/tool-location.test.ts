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
// The widened, terminal environment layer (Plan 60-06, LOC-03 gap closure):
// a bare-name declared-variable value that resolves nowhere refuses by name
// (one case per declared variable, matching the two the phase verification
// named as the minimum bar), a resolving bare-name value wins for a second
// declared variable, an empty-string value is still treated as unset, a
// directory-kind value is never walked on `$PATH` whether it resolves or
// not, the file layer stays reachable after an unresolvable environment
// value (PD-14), and the `envCandidate` field is populated on both the
// resolving and refusing paths. The one shipped test that pinned the defect
// ("nothing answers") is rewritten in place, not deleted, to pin the fix
// instead.
//
// The environment layer becomes TERMINAL FOR BOTH VALUE SHAPES (Plan 60-08,
// LOC-03 gap closure, correcting plan 60-06): plan 60-06 kept a
// separator-containing unresolvable value falling through silently to the
// declared-id `$PATH` probe, on the belief that this was pre-phase-60
// behaviour. `60-VERIFICATION.md` traced that belief to be wrong -- the
// pre-phase source returned `null` with no `$PATH` walk at all for that
// shape -- so this plan closes it: a separator-containing unresolvable
// value now refuses by name exactly like a bare-name one already did, and
// the shipped case that pinned the old (regressed) fall-through is
// rewritten in place to pin the corrected contract instead.
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
import { remedyTextsFor, resolveTool, toolsFileTemplate, validateToolsFile } from "./tool-location.mts";

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
    // x64sc is an executable-kind id, so plan 59-03 Task 2's file-layer
    // executable-bit check reaches this candidate; the exec bit must be set
    // for this to remain the "file layer answers" case rather than a refusal.
    chmodSync(fileBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: {},
    });

    assert.equal(result.path, fileBin);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
    assert.equal(result.refusal, null);
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

// REWRITTEN IN PLACE (Plan 60-06, LOC-03 gap closure, deliberate): this test
// used to be named "nothing answers: path/layer/mechanism are null and tried
// lists the environment candidate first, PATH candidates last", and it
// asserted `refusal === null` plus a `tried` list ending in TWO PATH-joined
// candidates for the DECLARED id ("x64sc") built from a bare-name-shaped
// scenario. That assertion PINNED the defect 60-VERIFICATION.md's
// independent reproduction (CR-01) found: a slash-free environment-variable
// value that resolves nowhere silently fell through to a `$PATH` search for
// the declared id -- exactly the shape that could silently start a
// different binary. This gap-closure plan changes the assertion on purpose:
// the same scenario now refuses, naming the variable and its value, and
// `tried` holds no PATH-joined candidate for the declared id at all.
test("an environment variable set to a bare name that resolves nowhere refuses, and resolution never reaches the declared-id $PATH probe", () => {
  withScratch((dir) => {
    const envBin = "does-not-exist-on-path";
    // No tools.json entry for x64sc at all -- the file has nothing to say
    // about this id, which is distinct from (and falls through unlike)
    // plan 59-03 Task 2's own behaviour for an entry that NAMES a path that
    // does not exist: that is now refused, per the amended LOC-06 triad.
    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
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
    assert.ok(result.refusal && result.refusal.includes("VICE_BIN") && result.refusal.includes(envBin));
    assert.equal(result.envCandidate, envBin);
    assert.equal(result.tried[0], envBin, "the raw environment candidate is tried first");
    // The widened $PATH walk of the ENVIRONMENT VALUE ITSELF is present...
    assert.ok(result.tried.includes(join(pathDirA, envBin)));
    assert.ok(result.tried.includes(join(pathDirB, envBin)));
    // ...but no candidate was ever built by joining a PATH directory to the
    // DECLARED tool id ("x64sc") -- the declared-id probe is unreachable.
    assert.equal(result.tried.includes(join(pathDirA, "x64sc")), false, "the declared-id probe must never run once a variable was set and left unresolved");
    assert.equal(result.tried.includes(join(pathDirB, "x64sc")), false);
  });
});

// REWRITTEN IN PLACE (Plan 60-08, LOC-03 gap closure, deliberate correction):
// this case previously pinned an absolute-path environment value that
// resolves nowhere as falling through silently to the declared-id `$PATH`
// probe, on the belief that this was pre-phase-60 behaviour unchanged by
// plan 60-01's rewiring. `60-VERIFICATION.md` read the pre-phase source
// directly (`git show d54d98a1:src/mcp/vice/backend-detect.mts`) and found
// that a separator-containing `VICE_BIN` which resolved nowhere returned
// `null` with NO `$PATH` walk for the bare id at all -- `spawn()` would then
// have produced an honest `ENOENT`. Plan 60-01's unconditional declared-id
// probe turned that honest failure into a same-named binary silently
// starting instead -- so what this case pinned was itself a same-phase
// regression, not pre-phase behaviour. This case now pins the corrected
// contract: the environment layer is terminal for a declared variable's
// non-empty value WHATEVER its shape, so a stale absolute path refuses by
// name exactly like a stale bare name already does.
test("Plan 60-08 Test 2: an environment variable set to a separator-containing value that resolves nowhere refuses, naming the variable and the value, with a decoy on PATH never answering", () => {
  withScratch((dir) => {
    const envBin = join(dir, "does-not-exist-env");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
    const pathDirA = join(dir, "bin-a");
    const pathDirB = join(dir, "bin-b");
    mkdirSync(pathDirA, { recursive: true });
    mkdirSync(pathDirB, { recursive: true });
    // A decoy literally named "x64sc" on the injected PATH -- proves the
    // refusal holds even when a same-named binary is sitting right there.
    const decoyPath = join(pathDirA, "x64sc");
    writeFileSync(decoyPath, "");
    chmodSync(decoyPath, 0o755);

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { VICE_BIN: envBin, PATH: `${pathDirA}:${pathDirB}` },
    });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.ok(result.refusal && result.refusal.includes("VICE_BIN") && result.refusal.includes(envBin), "the refusal must name both the variable and the value verbatim");
    assert.equal(result.envCandidate, envBin);
    assert.equal(result.tried[0], envBin, "the raw environment candidate is tried first");
  });
});

// The walk-gate proof beside Test 2's refusal: a separator-containing value
// is never walked on $PATH for itself (that gate is unchanged by this
// plan), and the declared-id probe never runs either (that reachability
// change is this plan's own fix). Asserted as a distinctly-named test so a
// future regression in either direction fails on its own.
test("Plan 60-08 Test 3: a separator-containing unresolvable value is never walked on $PATH for itself, and the declared-id probe never runs either", () => {
  withScratch((dir) => {
    const envBin = join(dir, "does-not-exist-env-2");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
    const pathDirA = join(dir, "bin-a2");
    const pathDirB = join(dir, "bin-b2");
    mkdirSync(pathDirA, { recursive: true });
    mkdirSync(pathDirB, { recursive: true });

    const result = resolveTool("x64sc", {
      toolsDir: dir,
      projectRoot: dir,
      env: { VICE_BIN: envBin, PATH: `${pathDirA}:${pathDirB}` },
    });

    assert.equal(result.path, null);
    assert.equal(result.tried.includes(join(pathDirA, envBin)), false, "the raw value must never be walked on $PATH -- it contains a separator");
    assert.equal(result.tried.includes(join(pathDirB, envBin)), false);
    assert.equal(result.tried.includes(join(pathDirA, "x64sc")), false, "the declared-id probe must never run once a variable was set and left unresolved, whatever its shape");
    assert.equal(result.tried.includes(join(pathDirB, "x64sc")), false);
  });
});

// The positive control beside Tests 2/3: a separator-containing value that
// DOES resolve still wins outright through the environment layer -- Test
// 2's promotion is a promotion of the REFUSAL, not a new obstacle to a value
// that was always going to answer.
test("Plan 60-08 Test 4: a separator-containing VICE_BIN naming a real executable still resolves outright through the environment layer", () => {
  withScratch((dir) => {
    const envBin = join(dir, "x64sc-real");
    writeFileSync(envBin, "");
    chmodSync(envBin, 0o755);

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } });

    assert.equal(result.path, envBin);
    assert.equal(result.layer, "env");
    assert.equal(result.mechanism, "VICE_BIN");
    assert.equal(result.refusal, null);
  });
});

// PD-14 unchanged for the newly-terminal shape: a separator-containing
// unresolvable override still lets a valid tools.json entry answer from the
// file layer -- an entry a developer wrote down is a statement of intent,
// and this plan's terminal refusal fires only once THAT layer also has
// nothing to say.
test("Plan 60-08 Test 5 (PD-14): a separator-containing unresolvable VICE_BIN still lets a valid tools.json entry answer from the file layer", () => {
  withScratch((dir) => {
    const envBin = join(dir, "does-not-exist-env-3");
    const fileBin = join(dir, "x64sc-from-tools-json");
    writeFileSync(fileBin, "");
    chmodSync(fileBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } });

    assert.equal(result.path, fileBin);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
    assert.equal(result.refusal, null);
    assert.equal(result.envCandidate, envBin, "envCandidate still names what the developer wrote, even though the file layer answered instead");
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
    chmodSync(fileBin, 0o755);
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

test("Plan 60-08 Test 6: compiled artifact -- the terminal refusal for a separator-containing value answers from resources/tool-location.mjs, not only from the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    resolveTool: typeof resolveTool;
  };

  withScratch((dir) => {
    const envBin = join(dir, "does-not-exist-compiled");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({}));
    const result = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } });
    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.equal(result.mechanism, null);
    assert.ok(result.refusal && result.refusal.includes("VICE_BIN") && result.refusal.includes(envBin));
  });
});

test("a tools.json value beginning ~/ expands against the injected HOME and resolves absolute", () => {
  withScratch((dir) => {
    const home = join(dir, "home");
    const binDir = join(home, "bin");
    mkdirSync(binDir, { recursive: true });
    const bin = join(binDir, "x64sc");
    writeFileSync(bin, "");
    chmodSync(bin, 0o755);
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
    chmodSync(bin, 0o755);
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
    chmodSync(bin, 0o755);
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
    chmodSync(bin, 0o755);
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
// Plan 60-06 (LOC-03 gap closure): the widened, terminal environment layer,
// one case per declared variable and per record kind. Test A/B below prove
// the widening is driven by the declaration's own `envVar` field for a
// SECOND declared variable (ACME_BIN), not hardcoded for VICE_BIN alone --
// the two cases 60-VERIFICATION.md itself named as the minimum bar (a
// slash-free value with no $PATH match at all, and one with a same-named
// decoy on $PATH) are the "bare name resolves"/"bare name refuses" tests
// above plus these two.
// -----------------------------------------------------------------------

test("Plan 60-06 Test A: a slash-free ACME_BIN naming an executable on the injected PATH resolves through the environment layer for acme", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const realAcme = join(pathDir, "acme-custom-name");
    writeFileSync(realAcme, "");
    chmodSync(realAcme, 0o755);

    const result = resolveTool("acme", { toolsDir: dir, projectRoot: dir, env: { ACME_BIN: "acme-custom-name", PATH: pathDir } });

    assert.equal(result.path, realAcme);
    assert.equal(result.layer, "env");
    assert.equal(result.mechanism, "ACME_BIN");
    assert.equal(result.refusal, null);
    assert.equal(result.envCandidate, "acme-custom-name");
  });
});

test("Plan 60-06 Test B: a slash-free ACME_BIN that exists nowhere, with a decoy executable literally named acme on the injected PATH, refuses and never returns the decoy", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const decoy = join(pathDir, "acme");
    writeFileSync(decoy, "");
    chmodSync(decoy, 0o755);

    const result = resolveTool("acme", { toolsDir: dir, projectRoot: dir, env: { ACME_BIN: "acme-dev-build", PATH: pathDir } });

    assert.notEqual(result.path, decoy, "a decoy match here is exactly the defect this plan exists to close");
    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("ACME_BIN") && result.refusal.includes("acme-dev-build"));
    assert.equal(result.tried.includes(decoy), false, "no candidate built by joining PATH to the declared id (acme) may appear in tried");
  });
});

test("Plan 60-06 Test C: an empty-string declared variable is treated as unset -- envCandidate is null and resolution falls through to the file layer and then the probe layer", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeBin = join(pathDir, "x64sc");
    writeFileSync(probeBin, "");

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "", PATH: pathDir } });

    assert.equal(result.path, probeBin);
    assert.equal(result.layer, "probe");
    assert.equal(result.refusal, null);
    assert.equal(result.envCandidate, null, "an empty string must never be reported as the developer's candidate");
  });
});

test("Plan 60-06 Test D: an unset ACME_BIN with a real acme on the injected PATH still answers from the probe layer -- the shape CI's ACME job depends on", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const probeAcme = join(pathDir, "acme");
    writeFileSync(probeAcme, "");

    const result = resolveTool("acme", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });

    assert.equal(result.path, probeAcme);
    assert.equal(result.layer, "probe");
    assert.equal(result.mechanism, "$PATH");
    assert.equal(result.envCandidate, null);
  });
});

test("Plan 60-06 Test G: a directory-kind GHIDRA_HOME set to a bare name that is not a directory is never walked on $PATH, and refuses", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    // A same-named FILE on PATH -- proves this candidate is never even
    // considered for a directory-kind record, since a $PATH search for a
    // directory is meaningless (truth: "a directory-kind variable is never
    // walked on $PATH").
    writeFileSync(join(pathDir, "ghidra-bare-name"), "");

    const result = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: { GHIDRA_HOME: "ghidra-bare-name", PATH: pathDir } });

    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("GHIDRA_HOME") && result.refusal.includes("ghidra-bare-name"));
    assert.equal(result.tried.some((t) => t.startsWith(pathDir)), false, "no PATH-joined candidate may appear in tried for a directory-kind id");
    // Plan 60-08 (WR-03 fix, PD-21): a directory-kind id has no $PATH probe
    // layer at all (D-15), so its refusal must not claim one was declined --
    // the negative half of the kind-correct justification clause.
    assert.equal(result.refusal.includes("could start a different binary"), false, "a directory-kind refusal must not assert a $PATH-shadowing protection that structurally cannot apply");
    assert.ok(result.refusal.includes("marker-file") === false, "sanity: this fixture's own record carries no 'marker-file' string to accidentally satisfy a later assertion");
  });
});

// Plan 60-08 (WR-03 fix, PD-21): the clean control beside "Plan 60-06 Test
// G"'s negative assertion above -- an executable-kind id's refusal DOES
// carry the $PATH-shadowing clause, proving the fix branches the message on
// `record.kind` rather than deleting the clause for every kind.
test("Plan 60-08 Test 7 (clean control): an executable-kind refusal still carries the $PATH-shadowing justification clause", () => {
  const result = resolveTool("x64sc", { toolsDir: "/nonexistent-tools-dir", projectRoot: "/nonexistent-project-root", env: { VICE_BIN: "x64sc-absent-everywhere" } });
  assert.equal(result.path, null);
  assert.ok(result.refusal && result.refusal.includes("could start a different binary"), "an executable-kind refusal must still carry the $PATH-shadowing clause");
});

// Plan 60-08 (WR-03 fix, PD-21): the second directory-kind id, proving the
// fix lives in the shared buildEnvLayerRefusal() builder and not in one id's
// own branch.
test("Plan 60-08 Test 8: the acme-lib directory-kind refusal (via ACME) also carries no $PATH-shadowing clause", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "acme-lib-bare-name"), "");

    const result = resolveTool("acme-lib", { toolsDir: dir, projectRoot: dir, env: { ACME: "acme-lib-bare-name", PATH: pathDir } });

    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("ACME") && result.refusal.includes("acme-lib-bare-name"));
    assert.equal(result.refusal.includes("could start a different binary"), false, "the acme-lib directory-kind refusal must not assert a $PATH-shadowing protection either");
  });
});

// Plan 60-08 Test 9: the directory-kind sentence is still USEFUL -- it names
// what was actually looked for (a directory carrying its required marker),
// so dropping the wrong clause did not leave the message uninformative.
test("Plan 60-08 Test 9: the ghidra refusal names the marker it required, even without the $PATH clause", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "ghidra-bare-name-2"), "");

    const result = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: { GHIDRA_HOME: "ghidra-bare-name-2", PATH: pathDir } });

    assert.ok(result.refusal && result.refusal.includes("support/analyzeHeadless"), "the refusal must still name the record's own marker string");
  });
});

// Plan 60-08 Test 10 (the generalized invariant, LOC-03/DECL-03-adjacent):
// enumerated from the committed declaration itself rather than a hand-typed
// id list, so a newly declared id with an envVar is covered the day it is
// added -- for every declared id carrying a `location.envVar`, an
// unresolvable value of EITHER shape refuses, and never yields a path from
// a different mechanism.
test("Plan 60-08 Test 10 (invariant, enumerated from prerequisites.json): every declared id with an envVar refuses for both an unresolvable bare name and an unresolvable separator-containing value", () => {
  const declPath = join(HERE_DIR, "prerequisites.json");
  const decl = JSON.parse(readFileSync(declPath, "utf8")) as { tools: Record<string, { location?: { envVar?: string } }> };
  const idsWithEnvVar = Object.keys(decl.tools).filter((toolId) => typeof decl.tools[toolId]?.location?.envVar === "string");
  assert.ok(idsWithEnvVar.length >= 4, "sanity: the declaration must name at least the four known env-backed ids");

  for (const toolId of idsWithEnvVar) {
    const envVar = decl.tools[toolId]!.location!.envVar as string;
    withScratch((dir) => {
      const pathDir = join(dir, "bin");
      mkdirSync(pathDir, { recursive: true });

      // pathDir is real but deliberately empty -- the bare value must name
      // nothing $PATH can answer for, so this proves the REFUSAL, not a
      // resolution.
      const bareValue = `${toolId}-bare-unresolvable`;
      const bareResult = resolveTool(toolId, { toolsDir: dir, projectRoot: dir, env: { [envVar]: bareValue, PATH: pathDir } });
      assert.equal(bareResult.path, null, `${toolId}: a bare unresolvable ${envVar} must refuse`);
      assert.equal(bareResult.layer, null, `${toolId}: layer must be null`);
      assert.equal(bareResult.mechanism, null, `${toolId}: mechanism must be null`);
      assert.ok(bareResult.refusal, `${toolId}: a non-null refusal is required`);
      assert.equal(bareResult.tried.includes(join(pathDir, toolId)), false, `${toolId}: no PATH-joined candidate for the declared id itself may appear in tried`);

      const separatorValue = join(dir, `${toolId}-separator-unresolvable`);
      const sepResult = resolveTool(toolId, { toolsDir: dir, projectRoot: dir, env: { [envVar]: separatorValue, PATH: pathDir } });
      assert.equal(sepResult.path, null, `${toolId}: a separator-containing unresolvable ${envVar} must refuse`);
      assert.equal(sepResult.layer, null, `${toolId}: layer must be null`);
      assert.equal(sepResult.mechanism, null, `${toolId}: mechanism must be null`);
      assert.ok(sepResult.refusal, `${toolId}: a non-null refusal is required`);
    });
  }
});

// Plan 60-08 Test 11 (LOC-03 concurrency edge): many concurrent resolutions
// of a separator-containing unresolvable value each match a solo call --
// the seam gains no cache, no memo and no reset hatch from this plan.
test("Plan 60-08 Test 11 (concurrency): many concurrent resolutions of a separator-containing unresolvable value each return the same fields as a solo call", async () => {
  await withScratch(async (dir) => {
    const envBin = join(dir, "does-not-exist-concurrent");
    const deps = { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } };

    const solo = resolveTool("x64sc", deps);
    const concurrent = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(resolveTool("x64sc", deps))));
    for (const r of concurrent) {
      assert.equal(r.path, solo.path);
      assert.equal(r.layer, solo.layer);
      assert.equal(r.mechanism, solo.mechanism);
      assert.equal(r.refusal, solo.refusal);
    }
  });
});

// Plan 60-08 Test 12: the kind-correct refusal and the invariant both hold
// through the freshly built resources/tool-location.mjs, not only the
// unbuilt source.
test("Plan 60-08 Test 12: compiled artifact -- the kind-correct refusal (no $PATH clause for a directory-kind id) answers from resources/tool-location.mjs", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    resolveTool: typeof resolveTool;
  };

  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    writeFileSync(join(pathDir, "ghidra-compiled-bare-name"), "");

    const result = compiled.resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: { GHIDRA_HOME: "ghidra-compiled-bare-name", PATH: pathDir } });
    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("GHIDRA_HOME"));
    assert.equal(result.refusal.includes("could start a different binary"), false);
  });
});

test("Plan 60-06 Test I (PD-14): a declared variable set to an unresolvable bare name still lets a valid tools.json entry answer from the file layer", () => {
  withScratch((dir) => {
    const fileBin = join(dir, "x64sc-from-tools-json");
    writeFileSync(fileBin, "");
    chmodSync(fileBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: fileBin }));

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "definitely-not-on-any-path" } });

    assert.equal(result.path, fileBin);
    assert.equal(result.layer, "file");
    assert.equal(result.mechanism, "tools.json");
    assert.equal(result.refusal, null);
    assert.equal(result.envCandidate, "definitely-not-on-any-path", "envCandidate still names what the developer wrote, even though the file layer answered instead");
  });
});

test("Plan 60-06 Test K (no memo): a bare-name environment value whose target does not yet exist refuses; once the binary is created on the injected PATH, the very next call in the same process resolves it, with no reset", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const deps = { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "not-yet-on-path", PATH: pathDir } };

    const first = resolveTool("x64sc", deps);
    assert.equal(first.path, null);
    assert.ok(first.refusal);

    const laterBin = join(pathDir, "not-yet-on-path");
    writeFileSync(laterBin, "");

    const second = resolveTool("x64sc", deps);
    assert.equal(second.path, laterBin);
    assert.equal(second.layer, "env");
    assert.equal(second.refusal, null);
  });
});

test("Plan 60-06 Test K (concurrency): many concurrent resolveTool calls for a slash-free environment value against one scratch tree each match the same call made alone", async () => {
  await withScratch(async (dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const realBin = join(pathDir, "custom-x64sc-name");
    writeFileSync(realBin, "");
    const deps = { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "custom-x64sc-name", PATH: pathDir } };

    const solo = resolveTool("x64sc", deps);
    assert.equal(solo.path, realBin);
    assert.equal(solo.layer, "env");
    const concurrent = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(resolveTool("x64sc", deps))));

    for (const result of concurrent) {
      assert.deepEqual(result, solo);
    }
  });
});

test("Plan 60-06 Test L (compiled artifact): the widened environment layer answers from resources/tool-location.mjs too, not only from the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    resolveTool: typeof resolveTool;
  };

  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const realBin = join(pathDir, "compiled-custom-x64sc");
    writeFileSync(realBin, "");
    const hit = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "compiled-custom-x64sc", PATH: pathDir } });
    assert.equal(hit.path, realBin);
    assert.equal(hit.layer, "env");
    assert.equal(hit.mechanism, "VICE_BIN");

    const decoy = join(pathDir, "x64sc");
    writeFileSync(decoy, "");
    const miss = compiled.resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: "compiled-absent-name", PATH: pathDir } });
    assert.notEqual(miss.path, decoy);
    assert.equal(miss.path, null);
    assert.ok(miss.refusal && miss.refusal.includes("VICE_BIN"));
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
    // The amended-triad control (LOC-06 CRITERION AMENDMENT): a directory
    // is the CORRECT state for this id and must never be refused for being
    // one -- this is the assertion that keeps the amendment honest.
    assert.equal(result.refusal, null);
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
    assert.ok(result.refusal.includes("support/analyzeHeadless"), "the refusal must name the missing marker");
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

test("an id shaped like an inherited Object.prototype member is refused by name like any other undeclared id, and tools.json is never touched to answer it (planted violation); a real declared id in the same file still resolves (clean control)", () => {
  withScratch((dir) => {
    for (const prototypeShapedId of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      const result = resolveTool(prototypeShapedId, {
        toolsDir: dir,
        projectRoot: dir,
        env: {},
        exists: () => {
          throw new Error(`resolveTool must not check any tools.json-related candidate for "${prototypeShapedId}"`);
        },
        readFile: () => {
          throw new Error(`resolveTool must not read tools.json for "${prototypeShapedId}"`);
        },
      });

      assert.equal(result.path, null, `expected "${prototypeShapedId}" to be refused, not resolved`);
      assert.equal(result.layer, null);
      assert.equal(result.mechanism, null);
      assert.ok(
        result.refusal && result.refusal.includes(prototypeShapedId),
        `expected a named refusal naming "${prototypeShapedId}", got ${JSON.stringify(result.refusal)}`,
      );
    }

    // Clean control: tools.json genuinely NAMES "constructor" (the exact
    // hazard the review measured -- a real entry sitting under a
    // prototype-shaped key must never be read back as that key's answer),
    // alongside a real declared id. The prototype-shaped key must still
    // refuse and the real id must still resolve through the same file.
    const x64scBin = join(dir, "x64sc-real");
    writeFileSync(x64scBin, "");
    chmodSync(x64scBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ constructor: "/should-never-be-read", x64sc: x64scBin }));

    const stillRefused = resolveTool("constructor", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(stillRefused.path, null);
    assert.ok(stillRefused.refusal && stillRefused.refusal.includes("constructor"));

    const cleanControl = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(cleanControl.path, x64scBin);
    assert.equal(cleanControl.layer, "file");
    assert.equal(cleanControl.refusal, null);
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

// -----------------------------------------------------------------------
// Plan 59-03, Task 2: the file layer's refusal contract inside
// `resolveTool()` -- the amended LOC-06 triad (absent, wrong kind, missing
// marker), the executable-bit check scoped to the file layer alone, and
// the one-bad-entry-refuses-one-tool blast radius.
// -----------------------------------------------------------------------

test("resolveTool(\"x64sc\", …) refuses a tools.json entry naming a path that does not exist, and the refusal names the file", () => {
  withScratch((dir) => {
    const missingBin = join(dir, "does-not-exist");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: missingBin }));

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(result.path, null);
    assert.equal(result.layer, null);
    assert.ok(result.refusal, "expected a refusal");
    assert.ok(result.refusal!.includes("x64sc"));
    assert.ok(result.refusal!.includes(missingBin));
    assert.ok(result.refusal!.includes("tools.json"));
  });
});

test("resolveTool(\"x64sc\", …) refuses a tools.json entry naming an existing directory, because the record declares an executable file", () => {
  withScratch((dir) => {
    const dirAsFile = join(dir, "x64sc-is-a-dir");
    mkdirSync(dirAsFile, { recursive: true });
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: dirAsFile }));

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("x64sc"));
  });
});

test("resolveTool(\"x64sc\", …) refuses a tools.json entry with no executable bit (planted violation), and resolves once the bit is set (clean control)", () => {
  withScratch((dir) => {
    const bin = join(dir, "x64sc-file");
    writeFileSync(bin, "");
    chmodSync(bin, 0o644);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: bin }));

    const refused = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(refused.path, null);
    assert.ok(refused.refusal && refused.refusal.includes("x64sc"));

    chmodSync(bin, 0o755);
    const resolved = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(resolved.path, bin);
    assert.equal(resolved.layer, "file");
    assert.equal(resolved.refusal, null);
  });
});

test("resolveTool(\"ghidra\", …) refuses a tools.json entry naming an existing regular file, because the record declares a directory", () => {
  withScratch((dir) => {
    const fileNotDir = join(dir, "ghidra-is-a-file");
    writeFileSync(fileNotDir, "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ ghidra: fileNotDir }));

    const result = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(result.path, null);
    assert.ok(result.refusal && result.refusal.includes("ghidra"));
  });
});

test("a directory-kind entry's own permission bits are never executable-bit checked: mode 0o555 and 0o755 both resolve", () => {
  withScratch((dir) => {
    const ghidraHome = join(dir, "ghidra-home-perm");
    mkdirSync(join(ghidraHome, "support"), { recursive: true });
    writeFileSync(join(ghidraHome, "support", "analyzeHeadless"), "");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ ghidra: ghidraHome }));

    chmodSync(ghidraHome, 0o555);
    const restrictive = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: {} });

    chmodSync(ghidraHome, 0o755);
    const permissive = resolveTool("ghidra", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(restrictive.path, ghidraHome);
    assert.equal(restrictive.refusal, null);
    assert.equal(permissive.path, ghidraHome);
    assert.equal(permissive.refusal, null);
  });
});

test("one malformed acme entry refuses acme by name; x64sc still resolves through the same file in the same call sequence (D-09 blast radius)", () => {
  withScratch((dir) => {
    const x64scBin = join(dir, "x64sc-good");
    writeFileSync(x64scBin, "");
    chmodSync(x64scBin, 0o755);
    const missingAcme = join(dir, "does-not-exist-acme");
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ acme: missingAcme, x64sc: x64scBin }));

    const acmeResult = resolveTool("acme", { toolsDir: dir, projectRoot: dir, env: {} });
    const x64scResult = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(acmeResult.path, null);
    assert.ok(acmeResult.refusal && acmeResult.refusal.includes("acme"));
    assert.equal(x64scResult.path, x64scBin);
    assert.equal(x64scResult.layer, "file");
    assert.equal(x64scResult.refusal, null);
  });
});

test("an environment override naming a file with no executable bit still resolves, unchanged from plan 59-01's behaviour (D-08)", () => {
  withScratch((dir) => {
    const envBin = join(dir, "x64sc-env-noexec");
    writeFileSync(envBin, "");
    chmodSync(envBin, 0o644);

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { VICE_BIN: envBin } });

    assert.equal(result.path, envBin);
    assert.equal(result.layer, "env");
    assert.equal(result.refusal, null);
  });
});

test("resolveTool(\"x64sc\", …) refuses a whole-file JSON parse failure by name, naming the file, and never falls through to $PATH for it (planted violation); valid JSON is a clean control", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const pathBin = join(pathDir, "x64sc");
    writeFileSync(pathBin, "");
    chmodSync(pathBin, 0o755);
    const filePath = join(dir, "tools.json");
    writeFileSync(filePath, "{ this is not json");

    const broken = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });

    assert.equal(broken.path, null);
    assert.equal(broken.layer, null);
    assert.equal(broken.mechanism, null);
    assert.ok(broken.refusal, "expected a refusal for a whole-file parse failure");
    assert.ok(broken.refusal!.includes(filePath));
    assert.ok(!broken.tried.includes(pathBin), "must never fall through to $PATH after a whole-file parse failure");

    writeFileSync(filePath, "{}");
    const clean = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });
    assert.equal(clean.path, pathBin);
    assert.equal(clean.layer, "probe");
    assert.equal(clean.refusal, null);
  });
});

test("resolveTool(\"x64sc\", …) refuses a non-object tools.json top level by name (planted violation); an object top level is a clean control", () => {
  withScratch((dir) => {
    const filePath = join(dir, "tools.json");
    writeFileSync(filePath, "[]");

    const arrayTop = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(arrayTop.path, null);
    assert.ok(arrayTop.refusal && arrayTop.refusal.includes(filePath));

    writeFileSync(filePath, "{}");
    const clean = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(clean.refusal, null);
    assert.equal(clean.path, null);
    assert.equal(clean.layer, null);
  });
});

test("resolveTool(\"x64sc\", …) refuses a non-string tools.json entry for the requested id by name (planted violations); a real string entry is a clean control", () => {
  withScratch((dir) => {
    const filePath = join(dir, "tools.json");

    for (const badValue of [null, false, 0, [], {}]) {
      writeFileSync(filePath, JSON.stringify({ x64sc: badValue }));
      const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
      assert.equal(result.path, null, `expected a refusal for value ${JSON.stringify(badValue)}`);
      assert.equal(result.layer, null);
      assert.ok(result.refusal && result.refusal.includes("x64sc"), `expected a named refusal for value ${JSON.stringify(badValue)}`);
    }

    const goodBin = join(dir, "x64sc-good");
    writeFileSync(goodBin, "");
    chmodSync(goodBin, 0o755);
    writeFileSync(filePath, JSON.stringify({ x64sc: goodBin }));
    const clean = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });
    assert.equal(clean.path, goodBin);
    assert.equal(clean.layer, "file");
    assert.equal(clean.refusal, null);
  });
});

test("one non-string acme entry refuses acme by name; a well-formed x64sc entry in the same file still resolves (one-bad-entry blast radius)", () => {
  withScratch((dir) => {
    const x64scBin = join(dir, "x64sc-good");
    writeFileSync(x64scBin, "");
    chmodSync(x64scBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ acme: 12345, x64sc: x64scBin }));

    const acmeResult = resolveTool("acme", { toolsDir: dir, projectRoot: dir, env: {} });
    const x64scResult = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: {} });

    assert.equal(acmeResult.path, null);
    assert.ok(acmeResult.refusal && acmeResult.refusal.includes("acme"));
    assert.equal(x64scResult.path, x64scBin);
    assert.equal(x64scResult.layer, "file");
    assert.equal(x64scResult.refusal, null);
  });
});

test("resolveTool: an absent tools.json, a zero-byte one, and a bare {} one each keep falling through silently with no refusal", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const pathBin = join(pathDir, "x64sc");
    writeFileSync(pathBin, "");
    chmodSync(pathBin, 0o755);
    const deps = { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } };

    const absent = resolveTool("x64sc", deps);
    assert.equal(absent.refusal, null);
    assert.equal(absent.path, pathBin);

    writeFileSync(join(dir, "tools.json"), "");
    const zeroByte = resolveTool("x64sc", deps);
    assert.equal(zeroByte.refusal, null);
    assert.equal(zeroByte.path, pathBin);

    writeFileSync(join(dir, "tools.json"), "{}");
    const emptyObject = resolveTool("x64sc", deps);
    assert.equal(emptyObject.refusal, null);
    assert.equal(emptyObject.path, pathBin);
  });
});

test("after a file-layer refusal, tried contains no candidate built from a PATH directory for that call", () => {
  withScratch((dir) => {
    const pathDir = join(dir, "bin");
    mkdirSync(pathDir, { recursive: true });
    const pathBin = join(pathDir, "x64sc");
    writeFileSync(pathBin, "");
    chmodSync(pathBin, 0o755);
    writeFileSync(join(dir, "tools.json"), JSON.stringify({ x64sc: join(dir, "does-not-exist") }));

    const result = resolveTool("x64sc", { toolsDir: dir, projectRoot: dir, env: { PATH: pathDir } });

    assert.equal(result.path, null);
    assert.ok(result.refusal);
    assert.ok(!result.tried.includes(pathBin), "no PATH-built candidate must appear in tried after a file-layer refusal");
  });
});

test("a tools.json rewritten between calls yields one complete state or the other, never a merge (backstop, T-59-13)", async () => {
  await withScratch(async (dir) => {
    const binA = join(dir, "x64sc-a");
    writeFileSync(binA, "");
    chmodSync(binA, 0o755);
    const binB = join(dir, "x64sc-b");
    writeFileSync(binB, "");
    chmodSync(binB, 0o755);

    const toolsJsonPath = join(dir, "tools.json");
    const writeStateA = () => writeFileSync(toolsJsonPath, JSON.stringify({ x64sc: binA }));
    const writeStateB = () => writeFileSync(toolsJsonPath, JSON.stringify({ x64sc: binB }));

    const deps = { toolsDir: dir, projectRoot: dir, env: {} };

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        (i % 2 === 0 ? writeStateA : writeStateB)();
        return Promise.resolve(resolveTool("x64sc", deps));
      }),
    );

    for (const result of results) {
      const isStateA = result.path === binA && result.refusal === null;
      const isStateB = result.path === binB && result.refusal === null;
      const isParseRefusal = result.path === null && typeof result.refusal === "string";
      assert.ok(isStateA || isStateB || isParseRefusal, `unexpected mixed result: ${JSON.stringify(result)}`);
    }
  });
});

// -----------------------------------------------------------------------
// Plan 59-05, Task 1: `toolsFileTemplate()` -- the exported template the
// doctor (Phase 61, DOCTOR-08) will write, never a committed static example.
// -----------------------------------------------------------------------

test("toolsFileTemplate({}) returns exactly the three reserved keys and no tool id", () => {
  const parsed = JSON.parse(toolsFileTemplate({})) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["_dxa", "_readme", "_viceBrokerNode"]);
});

test("toolsFileTemplate with one resolved id emits it as a bare string alongside the three reserved keys, and nothing else", () => {
  const parsed = JSON.parse(toolsFileTemplate({ x64sc: "/opt/vice/bin/x64sc" })) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["_dxa", "_readme", "_viceBrokerNode", "x64sc"]);
  assert.equal(parsed.x64sc, "/opt/vice/bin/x64sc");
});

test("toolsFileTemplate: _viceBrokerNode quotes the node record's declared reason verbatim and names VICE_BROKER_NODE as the route instead", () => {
  const prereq = JSON.parse(readFileSync(join(HERE_DIR, "prerequisites.json"), "utf8")) as {
    tools: Record<string, { location?: { reason?: string } }>;
  };
  const nodeReason = prereq.tools.node!.location!.reason!;
  const parsed = JSON.parse(toolsFileTemplate({})) as Record<string, string>;
  assert.ok(parsed._viceBrokerNode.includes(nodeReason));
  assert.ok(parsed._viceBrokerNode.includes("VICE_BROKER_NODE"));
});

test("toolsFileTemplate: _dxa quotes the dxa record's declared reason verbatim", () => {
  const prereq = JSON.parse(readFileSync(join(HERE_DIR, "prerequisites.json"), "utf8")) as {
    tools: Record<string, { location?: { reason?: string } }>;
  };
  const dxaReason = prereq.tools.dxa!.location!.reason!;
  const parsed = JSON.parse(toolsFileTemplate({})) as Record<string, string>;
  assert.ok(parsed._dxa.includes(dxaReason));
});

test("toolsFileTemplate: pointing here at a scratch declaration with different reason strings changes both prose values, proving neither sentence is a literal in the module", () => {
  withScratch((here) => {
    const reasonA = "reason-A-template, unique to this scratch declaration.";
    const reasonB = "reason-B-template, also unique to this scratch declaration.";
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: {
          dxa: { id: "dxa", location: { fileOverridable: false, reason: reasonA }, kind: "executable" },
          node: { id: "node", location: { fileOverridable: false, reason: reasonB }, kind: "executable" },
        },
      }),
    );

    const parsed = JSON.parse(toolsFileTemplate({}, { here })) as Record<string, string>;
    assert.ok(parsed._dxa.includes(reasonA));
    assert.ok(parsed._viceBrokerNode.includes(reasonB));
  });
});

test("toolsFileTemplate: an id the declaration says may not be named by the file is omitted even when present in resolved", () => {
  const parsed = JSON.parse(toolsFileTemplate({ dxa: "/somewhere/dxa", node: "/somewhere/node" })) as Record<string, unknown>;
  assert.equal("dxa" in parsed, false);
  assert.equal("node" in parsed, false);
});

test("toolsFileTemplate: an id the declaration does not know at all is silently omitted, not emitted", () => {
  const parsed = JSON.parse(toolsFileTemplate({ "not-a-real-tool": "/x" })) as Record<string, unknown>;
  assert.equal("not-a-real-tool" in parsed, false);
});

test("toolsFileTemplate: the returned string ends with a newline and two calls with identical inputs return identical strings", () => {
  const first = toolsFileTemplate({ x64sc: "/opt/vice/bin/x64sc" });
  const second = toolsFileTemplate({ x64sc: "/opt/vice/bin/x64sc" });
  assert.ok(first.endsWith("\n"));
  assert.equal(first, second);
});

test("toolsFileTemplate: writing its output to a scratch tools.json whose named path exists and satisfies its kind yields zero problems from validateToolsFile()", () => {
  withScratch((dir) => {
    const bin = join(dir, "x64sc-bin");
    writeFileSync(bin, "");
    chmodSync(bin, 0o755);

    const template = toolsFileTemplate({ x64sc: bin });
    writeFileSync(join(dir, "tools.json"), template);

    const problems = validateToolsFile({ toolsDir: dir, projectRoot: dir });
    assert.deepEqual(problems, []);
  });
});

test("compiled artifact: toolsFileTemplate produces the same three reserved keys as the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    toolsFileTemplate: typeof toolsFileTemplate;
  };

  const parsed = JSON.parse(compiled.toolsFileTemplate({})) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["_dxa", "_readme", "_viceBrokerNode"]);

  const withOne = JSON.parse(
    compiled.toolsFileTemplate({ x64sc: "/opt/vice/bin/x64sc" }),
  ) as Record<string, unknown>;
  assert.equal(withOne.x64sc, "/opt/vice/bin/x64sc");
});

// -----------------------------------------------------------------------
// Plan 60-02, Task 1: `remedyTextsFor()` -- the declaration's FIRST runtime
// reader of the `remedies` arrays (DECL-03). The real declaration read here
// is the committed `prerequisites.json`, unless a case points `here` at a
// scratch declaration.
// -----------------------------------------------------------------------

interface RemedyEntryFixture {
  ecosystem: string;
  text: string;
  provenance: string;
  source: string;
}

interface PrerequisitesDocFixture {
  tools: Record<string, { remedies?: Record<string, RemedyEntryFixture[]> }>;
}

function readCommittedPrerequisites(): PrerequisitesDocFixture {
  return JSON.parse(readFileSync(join(HERE_DIR, "prerequisites.json"), "utf8")) as PrerequisitesDocFixture;
}

test("remedyTextsFor(\"dxa\") against the real committed declaration returns exactly one string, byte-identical to remedies.universal[0].text", () => {
  const prereq = readCommittedPrerequisites();
  const declaredText = prereq.tools.dxa!.remedies!.universal![0]!.text;

  const result = remedyTextsFor("dxa");

  assert.deepEqual(result, [declaredText]);
});

test("non-vacuity (DECL-03): pointing here at a scratch declaration with a distinctive dxa remedy sentence returns that sentence, proving the string is not a literal inside the module", () => {
  withScratch((here) => {
    const distinctiveSentence = "run scratch-declaration-only-remedy-9f3c to rebuild dxa, never the real one.";
    writeFileSync(
      join(here, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: {
          dxa: {
            id: "dxa",
            location: { fileOverridable: false, reason: "scratch reason" },
            kind: "executable",
            remedies: { universal: [{ ecosystem: "generic", text: distinctiveSentence, provenance: "carried", source: "scratch" }] },
          },
        },
      }),
    );

    const result = remedyTextsFor("dxa", { here });

    assert.deepEqual(result, [distinctiveSentence]);
  });
});

test("remedyTextsFor(\"acme\", { platform: \"linux\" }) returns the two linux entries in declaration order followed by the universal entry, stable across repeated calls", () => {
  const prereq = readCommittedPrerequisites();
  const acme = prereq.tools.acme!.remedies!;
  const expected = [...acme.linux!.map((e) => e.text), ...acme.universal!.map((e) => e.text)];

  const first = remedyTextsFor("acme", { platform: "linux" });
  const second = remedyTextsFor("acme", { platform: "linux" });

  assert.deepEqual(first, expected);
  assert.deepEqual(second, first);
});

test("empty cases: a record with no remedies block returns [], a platform with no matching key returns only universal entries, and an undeclared id returns [] without throwing", () => {
  withScratch((dir) => {
    writeFileSync(
      join(dir, "prerequisites.json"),
      JSON.stringify({
        schemaVersion: 1,
        tools: {
          "no-remedies-tool": { id: "no-remedies-tool", location: { fileOverridable: true }, kind: "executable" },
        },
      }),
    );

    assert.deepEqual(remedyTextsFor("no-remedies-tool", { here: dir }), []);
  });

  const prereq = readCommittedPrerequisites();
  const acmeUniversalTexts = prereq.tools.acme!.remedies!.universal!.map((e) => e.text);
  assert.deepEqual(remedyTextsFor("acme", { platform: "win32" }), acmeUniversalTexts);

  assert.doesNotThrow(() => remedyTextsFor("not-a-real-tool"));
  assert.deepEqual(remedyTextsFor("not-a-real-tool"), []);
});

test("encoding: the c1541 linux entry containing a non-ASCII em dash is returned intact, with its string length unchanged from the parsed declaration's own value", () => {
  const prereq = readCommittedPrerequisites();
  const emDashEntry = prereq.tools.c1541!.remedies!.linux!.find((e) => e.text.includes("—"));
  assert.ok(emDashEntry, "expected the committed c1541 declaration to carry an em-dash remedy entry");

  const result = remedyTextsFor("c1541", { platform: "linux" });

  assert.ok(result.includes(emDashEntry!.text));
  const returned = result.find((t) => t === emDashEntry!.text)!;
  assert.equal(returned.length, emDashEntry!.text.length);
  assert.equal(returned.includes("—"), true);
});

test("compiled artifact: importing the regenerated resources/tool-location.mjs and calling remedyTextsFor returns the same answer as the unbuilt source", async () => {
  build();
  const compiled = (await import(new URL("./resources/tool-location.mjs", import.meta.url).href)) as unknown as {
    remedyTextsFor: typeof remedyTextsFor;
  };

  const fromSource = remedyTextsFor("dxa");
  const fromCompiled = compiled.remedyTextsFor("dxa");

  assert.deepEqual(fromCompiled, fromSource);
  assert.ok(fromCompiled.length > 0);
});
