// host-tool-endpoint.test.ts
//
// Phase 65 (SEAM-01, tracer): the tracer's own end-to-end verify -- the one
// test that proves the WHOLE path this plan wires, not one layer of it. A
// REAL, compiled broker (via broker-harness.ts's startHarnessBroker())
// answers a REAL `acme.build` request over the fixed endpoint: the source
// crosses as bytes, the broker assembles its own per-request scratch copy,
// and the .prg comes back as bytes, written under the CALLER's own
// toolsRoot/builds/ -- never a shared filesystem path.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { runHostToolOverEndpoint } from "./host-tool-endpoint.mts";
import { startHarnessBroker, type HarnessBroker } from "./broker-harness.ts";

const SKIP_REASON = acmeSkipReasonFor("host-tool-endpoint.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

let workDir: string | undefined;

function freshDir(tag: string): string {
  if (!workDir) workDir = mkdtempSync(join(tmpdir(), "host-tool-endpoint-"));
  const dir = join(workDir, `${tag}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

after(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

async function waitForNoRequestStagingDir(brokerHome: string, deadlineMs = 5000): Promise<boolean> {
  const stagingRoot = join(brokerHome, "staging");
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    let entries: string[] = [];
    try {
      entries = readdirSync(stagingRoot);
    } catch {
      entries = [];
    }
    if (!entries.some((e) => e.startsWith("ht-"))) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
}

test("Task 1: acme.build runs through the fixed endpoint, one file in, one result back", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const clientDir = freshDir("client");
    const sourcePath = join(clientDir, "hello.a");
    const source = "* = $0801\nstart\n\trts\n";
    writeFileSync(sourcePath, source, "utf8");

    const toolsRoot = freshDir("tools-root");

    const result = await runHostToolOverEndpoint("acme.build", { source: sourcePath }, { toolsRoot, port: broker.port, candidates: ["127.0.0.1"] });

    assert.equal(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.equal(result.tool, "acme.build");
    assert.equal(result.exitStatus, 0, `expected exitStatus 0, stderrTail: ${(result as { stderrTail?: string }).stderrTail}`);
    assert.equal(result.results.length, 1);

    const resultPath = result.results[0]!.path;
    assert.ok(resultPath.startsWith(`${join(toolsRoot, "builds")}/`), `expected result under ${join(toolsRoot, "builds")}/, got ${resultPath}`);
    assert.ok(resultPath.endsWith(".prg"), `expected a .prg result, got ${resultPath}`);

    const bytes = readFileSync(resultPath);
    assert.equal(bytes[0], 0x01);
    assert.equal(bytes[1], 0x08);

    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(result.results[0]!.sha256, digest);
    assert.equal(result.results[0]!.byteLength, bytes.length);

    // D-09: the request's own scratch directory is gone once this call's
    // session closed -- poll the harness home's staging directory until no
    // `ht-` directory remains, never a fixed sleep.
    const sawNoHtDir = await waitForNoRequestStagingDir(broker.home);
    assert.ok(sawNoHtDir, "expected the host-tool request's own staging directory to be removed after the connection closed");
  } finally {
    await broker.stop();
  }
});
