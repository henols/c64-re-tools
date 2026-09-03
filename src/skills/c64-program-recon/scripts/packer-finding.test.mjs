// packer-finding.test.mjs -- the committed proof that the packer recon
// finding cannot invent a name (SURF-03), and that an absent oracle is a
// VISIBLE skip rather than a silent pass.
//
// Colocated beside the module on purpose: `ci-suite-coverage.test.ts`'s
// frozen registry already proves CI runs `src/skills/*/scripts/*.test.mjs`,
// so this file needs no new CI step. It also means the file is excluded from
// both published tarballs by the same test-file exclusion every other
// colocated skill test relies on.
//
// The two assertions that matter most, and why they are here rather than
// stated in prose:
//   - THE PLANTED VIOLATION. An entropy value ABOVE the packedness threshold,
//     with the oracle forced absent, is exactly the input a "helpful"
//     implementation would answer with a guessed packer name. Driving the
//     real finding function with that input and asserting `packer` stays null
//     is what makes rule 1 a measured property instead of a comment.
//   - THE VISIBLE SKIP. An absent oracle must never read as a passing
//     SURF-03. The oracle-route test below is skipped with a stated reason
//     that names the missing tool, and a second test -- which is NEVER
//     skipped -- turns that same absence into a hard failure the moment the
//     opt-in variable is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_ORACLE_STDOUT_BYTES,
  MAX_PACKER_NAME_LENGTH,
  PACKED_ENTROPY_THRESHOLD,
  PACKER_VERDICTS,
  REQUIRE_ORACLE_ENV_VAR,
  oracleConfigurationHint,
  packerFinding,
  parseUnp64Stdout,
  probeUnp64,
  shannonEntropy,
  skipReasonForUnp64,
} from "./packer-finding.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_SRC = readFileSync(join(HERE, "packer-finding.mjs"), "utf8");

const FIXED_CLOCK = () => "2026-01-01T00:00:00.000Z";

/** Forces the oracle absent without uninstalling anything -- the injection
 * seam the module exposes precisely so this planted violation is drivable. */
const ORACLE_FORCED_ABSENT = () => ({
  available: false,
  command: null,
  version: null,
  reason: "forced absent by the colocated test, so the never-infer-a-name rule is driven directly",
});

/** An oracle that claims to be available but must never be reached by a test
 * that does not also supply a file path. */
const ORACLE_NEVER_RUN = () => {
  throw new Error("the oracle runner must not be reached on a non-oracle route");
};

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

test("the verdict set has exactly four members and is frozen", () => {
  assert.equal(PACKER_VERDICTS.length, 4);
  assert.deepEqual([...PACKER_VERDICTS].sort(), ["identified", "packed-unidentified", "unknown", "unpacked"]);
  assert.ok(Object.isFrozen(PACKER_VERDICTS));
});

// ---------------------------------------------------------------------------
// The planted violation (rule 1)
// ---------------------------------------------------------------------------

test("planted violation: an entropy value ABOVE the packedness threshold, oracle absent, never sets the name field", () => {
  const finding = packerFinding({
    filePath: "/nonexistent/does-not-matter.prg",
    entropy: PACKED_ENTROPY_THRESHOLD + 0.33,
    probe: ORACLE_FORCED_ABSENT,
    run: ORACLE_NEVER_RUN,
    now: FIXED_CLOCK,
  });

  assert.equal(finding.packer, null, "entropy must never produce a packer name -- rule 1");
  assert.equal(finding.verdict, "packed-unidentified");
  assert.equal(finding.route, "entropy-only");
  assert.notEqual(finding.confidence, "HIGH", "the high confidence level is reachable only on the oracle route -- rule 2");
  assert.ok(typeof finding.unavailableReason === "string" && finding.unavailableReason.length > 0);
  assert.equal(finding.checkedAt, "2026-01-01T00:00:00.000Z");
});

test("an entropy value BELOW the threshold is still not an identity claim: the name stays null", () => {
  const finding = packerFinding({
    entropy: 4.2,
    probe: ORACLE_FORCED_ABSENT,
    run: ORACLE_NEVER_RUN,
    now: FIXED_CLOCK,
  });
  assert.equal(finding.packer, null);
  assert.equal(finding.verdict, "unpacked");
  assert.equal(finding.route, "entropy-only");
  assert.ok(typeof finding.unavailableReason === "string" && finding.unavailableReason.length > 0);
});

test("locally computed entropy takes the same route and is recorded as a DIFFERENT evidence source", () => {
  const flat = new Uint8Array(4096); // every byte identical -- minimum entropy
  const finding = packerFinding({ bytes: flat, probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
  assert.equal(finding.packer, null);
  assert.equal(finding.verdict, "unpacked");
  const entry = finding.evidence.find((e) => e.source === "local-shannon-entropy");
  assert.ok(entry, "a locally measured entropy must say so, never masquerade as the curated tool's value");
  assert.equal(entry.threshold, PACKED_ENTROPY_THRESHOLD);
  assert.equal(shannonEntropy(flat), 0);
  assert.equal(shannonEntropy(new Uint8Array(0)), null, "zero bytes is an absent measurement, not a measurement of zero");
});

// ---------------------------------------------------------------------------
// Rules 2, 3 and 4
// ---------------------------------------------------------------------------

test("rule 3: an unknown verdict always carries a non-empty reason", () => {
  const finding = packerFinding({ probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
  assert.equal(finding.verdict, "unknown");
  assert.equal(finding.packer, null);
  assert.equal(finding.route, "none");
  assert.equal(typeof finding.unavailableReason, "string");
  assert.ok(finding.unavailableReason.trim().length > 0);
  assert.ok(/no packer-identity route/.test(finding.unavailableReason));
});

test("rule 2: the high confidence level appears on NO non-oracle route, over every non-oracle input", () => {
  const inputs = [
    { entropy: PACKED_ENTROPY_THRESHOLD + 0.5 },
    { entropy: PACKED_ENTROPY_THRESHOLD },
    { entropy: 0 },
    { bytes: new Uint8Array([1, 2, 3, 4]) },
    {},
  ];
  for (const input of inputs) {
    const finding = packerFinding({ ...input, probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
    assert.notEqual(finding.confidence, "HIGH", `input ${JSON.stringify(input)} must not reach the high confidence level`);
    assert.equal(finding.packer, null, `input ${JSON.stringify(input)} must not name a packer`);
  }
});

test("rule 4: every returned verdict is a member of the four-verdict set, over every non-oracle input", () => {
  const inputs = [{ entropy: 7.9 }, { entropy: 1.1 }, { bytes: new Uint8Array([9, 9, 9]) }, {}];
  for (const input of inputs) {
    const finding = packerFinding({ ...input, probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
    assert.ok(PACKER_VERDICTS.includes(finding.verdict), `verdict "${finding.verdict}" is outside the four-verdict set`);
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(finding.confidence));
  }
});

// ---------------------------------------------------------------------------
// The standard-output parser (T-19-19)
// ---------------------------------------------------------------------------

test("the parser rejects empty, non-string, truncated and unrecognised input without throwing", () => {
  assert.equal(parseUnp64Stdout(""), null);
  assert.equal(parseUnp64Stdout(undefined), null);
  assert.equal(parseUnp64Stdout(null), null);
  assert.equal(parseUnp64Stdout(42), null);
  assert.equal(parseUnp64Stdout("Packer:"), null, "a truncated marker line names nothing");
  assert.equal(parseUnp64Stdout("Packer:   "), null);
  assert.equal(parseUnp64Stdout("scanning...\nno idea what this is\n"), null);
  assert.equal(parseUnp64Stdout("\n\n   \n"), null);
});

test("the parser rejects over-long input and over-long names, both by an explicit cap", () => {
  const oversized = "Packer: Exomizer\n" + "x".repeat(MAX_ORACLE_STDOUT_BYTES);
  assert.ok(oversized.length > MAX_ORACLE_STDOUT_BYTES);
  assert.equal(parseUnp64Stdout(oversized), null, "past the byte cap nothing is even scanned");

  const longName = `Packer: ${"A".repeat(MAX_PACKER_NAME_LENGTH + 1)}\n`;
  assert.equal(parseUnp64Stdout(longName), null);
});

test("the parser accepts only a narrow character set, so a hostile line cannot reach the report", () => {
  assert.equal(parseUnp64Stdout("Packer: Exomizer 2.0\n"), "Exomizer 2.0");
  assert.equal(parseUnp64Stdout("scanning\nDetected packer: ByteBoozer 2\ndone\n"), "ByteBoozer 2");
  assert.equal(parseUnp64Stdout("Packer: <script>alert(1)</script>\n"), null);
  assert.equal(parseUnp64Stdout("Packer: name`with`backticks\n"), null);
  assert.equal(parseUnp64Stdout("Packer: ;rm -rf /\n"), null);
});

// ---------------------------------------------------------------------------
// The probe (T-19-18)
// ---------------------------------------------------------------------------

// Phase 34, plan 34-08 (CR-01): this script sends no oracle configuration
// across the seam any more -- the three cases below replace the old
// configured-path probe case, which exercised a client-side existence check
// that no longer exists (host-tool.mts's resolveOracleCommand() decides the
// oracle's location host-side now; see host-tool.test.ts).

test("oracleConfigurationHint: null when no oracle variable is set, and a non-empty hint naming the variable and the host broker environment (never the value) when one is", () => {
  assert.equal(oracleConfigurationHint({}), null);
  const hint = oracleConfigurationHint({ UNP64: "/x/unp64" });
  assert.equal(typeof hint, "string");
  assert.ok(hint.length > 0);
  assert.ok(/UNP64/.test(hint), "the hint must name WHICH variable was set");
  assert.ok(/host broker/i.test(hint), "the hint must say the host broker process's own environment is what the seam consults");
  assert.ok(!hint.includes("/x/unp64"), "the hint must never echo the variable's value");
});

test("probeUnp64: a bogus container-side oracle value never appears in the serialised result, on either availability branch", () => {
  const bogus = "/nonexistent/definitely-not-here/unp64-abcdef";
  const result = probeUnp64({ UNP64: bogus });
  assert.equal(typeof result.available, "boolean");
  assert.ok(!JSON.stringify(result).includes(bogus), "a container-side value must never be interpolated anywhere, not even into a message -- on EITHER branch");
});

test("source level: no oracle-path existence check remains, and the probe's seam call forwards no oracle configuration", () => {
  assert.ok(!/existsSync\(\s*configured\s*\)/.test(MODULE_SRC), "no client-side existence check on a configured oracle path");
  const plantedExistenceCheck = `${MODULE_SRC}\nif (!existsSync(configured)) { /* planted violation */ }\n`;
  assert.ok(/existsSync\(\s*configured\s*\)/.test(plantedExistenceCheck), "non-vacuity: the planted existence-check control must be caught by the same pattern");

  const emptyArgsCalls = MODULE_SRC.match(/invokeSeamSync\("oracle\.probe",\s*\{\}\)/g) ?? [];
  assert.equal(emptyArgsCalls.length, 1, "the probe's seam call must pass an empty argument object literal at exactly one site");

  const nonEmptyArgsCalls = MODULE_SRC.match(/invokeSeamSync\("oracle\.probe",\s*\{[^}]+\}\)/g) ?? [];
  assert.equal(nonEmptyArgsCalls.length, 0, "no seam call for oracle.probe may carry a non-empty (configured) argument object");
  const plantedConfiguredCall = `${MODULE_SRC}\ninvokeSeamSync("oracle.probe", { command: configured });\n`;
  const plantedNonEmptyArgsCalls = plantedConfiguredCall.match(/invokeSeamSync\("oracle\.probe",\s*\{[^}]+\}\)/g) ?? [];
  assert.equal(plantedNonEmptyArgsCalls.length, 1, "non-vacuity: a planted call forwarding configuration must be caught by the same pattern");
});

// ---------------------------------------------------------------------------
// Source-level structure -- the rules as measured properties (T-19-18/T-19-20)
// ---------------------------------------------------------------------------

test("source level: no command-interpreter invocation anywhere in the module", () => {
  assert.ok(!/shell:\s*true/.test(MODULE_SRC), "no child process may be launched through a command interpreter");
  assert.ok(!/execSync\(/.test(MODULE_SRC));
  assert.ok(!/\bexec\(/.test(MODULE_SRC));
  assert.ok(/shell:\s*false/.test(MODULE_SRC), "the interpreter must be disabled EXPLICITLY, not merely left at its default");
});

test("source level: the packer name is assigned at exactly one site, and the high confidence level at exactly one", () => {
  const nameAssignments = MODULE_SRC.match(/packer:\s*(?!null)[A-Za-z_$]/g) ?? [];
  assert.equal(nameAssignments.length, 1, `expected exactly one non-null packer assignment, found ${nameAssignments.length}`);

  const highAssignments = MODULE_SRC.match(/confidence:\s*CONFIDENCE_HIGH/g) ?? [];
  assert.equal(highAssignments.length, 1, `expected exactly one high-confidence assignment, found ${highAssignments.length}`);

  // Non-vacuity: the same scan over a planted source that DOES set a name
  // from entropy must report two, so a stubbed regex cannot pass silently.
  const planted = `${MODULE_SRC}\nconst planted = { packer: guessedFromEntropy };\n`;
  assert.equal((planted.match(/packer:\s*(?!null)[A-Za-z_$]/g) ?? []).length, 2);
});

test("source level: no transcribed packer signature bytes and no hedged vocabulary", () => {
  assert.ok(!/0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}, *0x[0-9a-fA-F]{2}/.test(MODULE_SRC), "signature bytes must not be transcribed here");
  const hedges = MODULE_SRC.match(/probably|likely|maybe|percent/gi) ?? [];
  assert.deepEqual(hedges, [], `hedged vocabulary is forbidden by rule 4, found: ${hedges.join(", ")}`);
});

// ---------------------------------------------------------------------------
// The live gate. Absence is a VISIBLE skip, never a pass.
// ---------------------------------------------------------------------------

const PROBED = probeUnp64();
const SKIP_REASON = skipReasonForUnp64(PROBED);

test("the skip is VISIBLE, not silent: an absent oracle yields a non-empty reason that names it", () => {
  const forced = skipReasonForUnp64({ available: false, reason: "forced absent for this assertion" });
  assert.equal(typeof forced, "string");
  assert.ok(forced.length > 0);
  assert.ok(/unp64/i.test(forced), "the skip reason must name the missing oracle");
  assert.ok(/EXPECTED SKIP/.test(forced), "the reason must say plainly that this is not a pass");
  assert.ok(forced.includes(REQUIRE_ORACLE_ENV_VAR), "the reason must name the variable that turns it into a failure");
  assert.equal(skipReasonForUnp64({ available: true, reason: null }), false);
});

test(
  "the oracle route reports a name ONLY when a real external oracle stated one",
  { skip: SKIP_REASON },
  () => {
    const finding = packerFinding({ filePath: fileURLToPath(import.meta.url), probe: () => PROBED, now: FIXED_CLOCK });
    assert.ok(PACKER_VERDICTS.includes(finding.verdict));
    if (finding.packer !== null) {
      assert.equal(finding.route, "unp64");
      assert.equal(finding.confidence, "HIGH");
      assert.equal(finding.verdict, "identified");
      const raw = finding.evidence.find((e) => e.source === "unp64" && typeof e.raw === "string");
      assert.ok(raw, "a reported name must carry the oracle output it came from");
    } else {
      assert.notEqual(finding.confidence, "HIGH");
      assert.ok(typeof finding.unavailableReason === "string" && finding.unavailableReason.length > 0);
    }
  },
);

test(`never skipped: ${REQUIRE_ORACLE_ENV_VAR} turns an absent oracle into a hard FAILURE, never a silent pass`, () => {
  if (process.env[REQUIRE_ORACLE_ENV_VAR]) {
    assert.equal(
      PROBED.available,
      true,
      `${REQUIRE_ORACLE_ENV_VAR} is set but no external packer identifier was found (${PROBED.reason ?? "reason not recorded"}) -- ` +
        "a maintainer who sets this variable expects a hard FAIL, never a SKIP, when the oracle is actually missing.",
    );
  } else {
    // Unset: this test is a no-op by design, and the sibling test above is
    // the one that reports the absence as a visible skip.
    assert.ok(SKIP_REASON === false || typeof SKIP_REASON === "string");
  }
});
