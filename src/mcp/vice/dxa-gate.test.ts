// dxa-gate.test.ts
//
// WHY THIS FILE EXISTS: the dxa availability gate's whole value is that a
// missing vendored binary under VICE_REQUIRE_DXA produces a hard FAIL rather
// than a named SKIP. This file makes that observation a fact re-made on
// every suite run, mirroring acme-gate.test.ts's own SEAM-01 shape.
//
// WHY THIS FILE NEEDS NO CHILD PROCESS, UNLIKE acme-gate.test.ts: the ACME
// gate's `ACME_AVAILABLE` is a module-load `const` derived from an
// env-overridable `ACME_BIN`, so proving the FAIL direction requires a fresh
// module load under a changed environment -- which only a child process can
// give. `findDxaBinary()` (host-tool.mts) takes NO path override at all
// (its own header states this rule explicitly), so this gate's `available`
// input is never environment-derived; both directions are observable
// in-process against the pure core (`assertDxaRequired(available, assert)`)
// at a fraction of the child-process cost. Recording this here rather than
// leaving the departure from the ACME precedent unexplained.
//
// This file verifies test-harness discipline, not shipped runtime behaviour,
// so `dxa-gate.ts` stays OUT of `package.json`'s `files[]` -- asserted below
// -- and this file is deliberately never added to `MANUAL_ONLY_TESTS`
// (`test-gate.mjs`'s glob auto-discovers a new `*.test.ts`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DXA_AVAILABLE,
  DXA_BINARY_CANDIDATES,
  assertDxaRequired,
  assertDxaRequiredIfEnvSet,
  dxaSkipReasonFor,
} from "./dxa-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE_PATH = join(HERE, "dxa-gate.ts");

/** The gate's own refusal wording, read out of the module source rather than
 * retyped here from memory -- retyping it is how a test ends up passing for
 * the wrong reason. */
const REFUSAL_PREFIX = "VICE_REQUIRE_DXA is set but no real vendored dxa binary was found";

test("the refusal wording asserted below is really present in dxa-gate.ts (so this file cannot pass for the wrong reason)", () => {
  const src = readFileSync(GATE_PATH, "utf8");
  assert.ok(
    src.includes(REFUSAL_PREFIX),
    `dxa-gate.ts no longer contains the refusal wording this file matches on ` +
      `(${JSON.stringify(REFUSAL_PREFIX)}) -- update both together, never only one`
  );
});

test("FAIL direction: assertDxaRequired(false, assert) throws, and the thrown message contains the gate's own refusal wording", () => {
  assert.throws(
    () => assertDxaRequired(false, assert),
    (err: unknown) => err instanceof Error && err.message.includes(REFUSAL_PREFIX),
    "expected assertDxaRequired(false, ...) to throw an error naming the gate's own refusal wording"
  );
});

test("control direction: assertDxaRequired(true, assert) does not throw", () => {
  assert.doesNotThrow(() => assertDxaRequired(true, assert));
});

test("control direction: assertDxaRequiredIfEnvSet is a no-op with VICE_REQUIRE_DXA deleted from the environment, even with the binary unavailable", () => {
  const had = Object.prototype.hasOwnProperty.call(process.env, "VICE_REQUIRE_DXA");
  const prior = process.env.VICE_REQUIRE_DXA;
  delete process.env.VICE_REQUIRE_DXA;
  try {
    // Deliberately unset (never blanked to "") -- the gate's actual unset
    // behaviour is what is being asserted, independent of DXA_AVAILABLE's
    // real value on this host.
    assert.doesNotThrow(() => assertDxaRequiredIfEnvSet(assert));
  } finally {
    if (had) process.env.VICE_REQUIRE_DXA = prior;
  }
});

test("non-vacuity: DXA_AVAILABLE equals existsSync of the real vendored path (holds on a runner too, where both sides are false)", () => {
  const realPath = join(HERE, "vendor", "dxa", "dxa");
  assert.ok(DXA_BINARY_CANDIDATES.includes(realPath), `expected the real vendored path among the probed candidates: ${DXA_BINARY_CANDIDATES.join(", ")}`);
  assert.equal(DXA_AVAILABLE, existsSync(realPath));
});

test("dxaSkipReasonFor names the caller's file and the build.bash remedy", () => {
  const reason = dxaSkipReasonFor("x.test.ts");
  if (DXA_AVAILABLE) {
    assert.equal(reason, false, "expected no skip reason when the real binary is available");
  } else {
    assert.ok(typeof reason === "string");
    assert.match(reason as string, /x\.test\.ts/);
    assert.match(reason as string, /bash vendor\/dxa\/build\.bash build/);
  }
});

test("dxa-gate.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("dxa-gate.ts"),
    false,
    "dxa-gate.ts is test-only and must never ship in the published npm tarball"
  );
});
