// packer-finding.test.ts -- the committed proof that the packer recon
// finding cannot invent a name, and that an absent oracle is a
// VISIBLE skip rather than a silent pass.
//
// It lives in test/skills/, outside the skill folder, so it ships in neither
// published tarball, and CI's test/skills step runs it with no step of its own.
//
// The assertions that matter most:
//   - THE PLANTED VIOLATION. An entropy value ABOVE the packedness threshold,
//     with the oracle forced absent, is exactly the input a "helpful"
//     implementation would answer with a guessed packer name. Driving the
//     real finding function with that input and asserting `packer` stays null
//     is what makes never-infer-a-name a measured property instead of a comment.
//   - THE VISIBLE SKIP. An absent oracle is a reported skip with a stated
//     reason, and it is a failure when VICE_REQUIRE_UNP64 is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_ORACLE_STDOUT_BYTES,
  MAX_PACKER_NAME_LENGTH,
  PACKED_ENTROPY_THRESHOLD,
  PACKER_VERDICTS,
  main,
  oracleConfigurationHint,
  packerFinding,
  parseUnp64Stdout,
  probeUnp64,
  shannonEntropy,
} from "../../../skills/c64-unpacker/scripts/packer-finding.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The opt-in variable that turns an absent oracle from an expected skip into
 * a hard failure, by the established `VICE_REQUIRE_*` precedent. */
const REQUIRE_ORACLE_ENV_VAR = "VICE_REQUIRE_UNP64";

// The scripts under test live in the skill folder; this test lives in test/skills/.
const SCRIPT_DIR = join(HERE, "..", "..", "..", "skills", "c64-unpacker", "scripts");

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

// ---------------------------------------------------------------------------
// The packer name comes only from the oracle
// ---------------------------------------------------------------------------

test("an entropy value ABOVE the packedness threshold, oracle absent, never sets the name field", () => {
  const finding = packerFinding({
    filePath: "/nonexistent/does-not-matter.prg",
    entropy: PACKED_ENTROPY_THRESHOLD + 0.33,
    probe: ORACLE_FORCED_ABSENT,
    run: ORACLE_NEVER_RUN,
    now: FIXED_CLOCK,
  });

  assert.equal(finding.packer, null, "entropy must never produce a packer name");
  assert.equal(finding.verdict, "packed-unidentified");
  assert.equal(finding.route, "entropy-only");
  assert.notEqual(finding.confidence, "HIGH", "the high confidence level is reachable only on the oracle route");
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
// Confidence, reasons and the verdict set
// ---------------------------------------------------------------------------

test("an unknown verdict always carries a non-empty reason", () => {
  const finding = packerFinding({ probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
  assert.equal(finding.verdict, "unknown");
  assert.equal(finding.packer, null);
  assert.equal(finding.route, "none");
  assert.ok(typeof finding.unavailableReason === "string");
  assert.ok(finding.unavailableReason.trim().length > 0);
  assert.ok(/no packer-identity route/.test(finding.unavailableReason));
});

test("the high confidence level appears on NO non-oracle route, over every non-oracle input", () => {
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

test("every returned verdict is a member of the four-verdict set, over every non-oracle input", () => {
  const inputs = [{ entropy: 7.9 }, { entropy: 1.1 }, { bytes: new Uint8Array([9, 9, 9]) }, {}];
  for (const input of inputs) {
    const finding = packerFinding({ ...input, probe: ORACLE_FORCED_ABSENT, run: ORACLE_NEVER_RUN, now: FIXED_CLOCK });
    assert.ok(PACKER_VERDICTS.includes(finding.verdict), `verdict "${finding.verdict}" is outside the four-verdict set`);
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(finding.confidence));
  }
});

// ---------------------------------------------------------------------------
// The standard-output parser
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
// The probe
// ---------------------------------------------------------------------------

// This script sends no oracle configuration
// across the seam any more -- the three cases below replace the old
// configured-path probe case, which exercised a client-side existence check
// that no longer exists (host-tool.mts's resolveOracleCommand() decides the
// oracle's location host-side now; see host-tool.test.ts).

test("oracleConfigurationHint: null when no oracle variable is set, and a non-empty hint naming the variable and the host broker environment (never the value) when one is", () => {
  assert.equal(oracleConfigurationHint({}), null);
  const hint = oracleConfigurationHint({ UNP64: "/x/unp64" });
  assert.ok(typeof hint === "string");
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

// ---------------------------------------------------------------------------
// The live gate. Absence is a VISIBLE skip, never a pass.
// ---------------------------------------------------------------------------

test("the oracle route reports a name ONLY when a real external oracle stated one", (t) => {
  const probed = probeUnp64();
  if (probed.available !== true) {
    if (process.env[REQUIRE_ORACLE_ENV_VAR]) {
      assert.fail(`${REQUIRE_ORACLE_ENV_VAR} is set but no external packer identifier was found (${probed.reason ?? "reason not recorded"})`);
    }
    t.skip(`no external packer identifier was found (${probed.reason ?? "reason not recorded"}). Set ${REQUIRE_ORACLE_ENV_VAR} to turn this skip into a failure.`);
    return;
  }
  const finding = packerFinding({ filePath: fileURLToPath(import.meta.url), probe: () => probed, now: FIXED_CLOCK });
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
});

// ---------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------

test("the command line refuses a bad --entropy value or a missing value by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "packer-cli-"));
  try {
    const file = join(dir, "x.bin");
    writeFileSync(file, Buffer.from([1, 2, 3, 4]));
    for (const argv of [[file, "--entropy", "7.8abc"], [file, "--entropy"], [file, "--entropy", "--other"], [file, "--bogus"]]) {
      const r = main(argv);
      assert.equal(r.ok, false, argv.join(" "));
      assert.match((r as { message: string }).message, /--entropy|--bogus/);
    }
    assert.equal(main([file, "--entropy", "7.83"]).ok, true);
    assert.equal(main([join(dir, "missing.bin")]).ok, false);
    assert.equal(main([]).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the command line prints one JSON line whose ok field is true and that carries the finding", () => {
  const dir = mkdtempSync(join(tmpdir(), "packer-cli-"));
  try {
    const file = join(dir, "x.bin");
    writeFileSync(file, Buffer.alloc(64));
    const r = spawnSync(process.execPath, [join(SCRIPT_DIR, "packer-finding.ts"), file, "--entropy", "7.9"], { encoding: "utf8", timeout: 60_000 });
    const lines = r.stdout.trim().split("\n");
    assert.equal(lines.length, 1);
    const result = JSON.parse(lines[0]);
    assert.equal(result.ok, true);
    assert.ok(PACKER_VERDICTS.includes(result.verdict));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
