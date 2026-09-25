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
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { runHostToolOverEndpoint } from "./host-tool-endpoint.mts";
import { startHarnessBroker, type HarnessBroker } from "./broker-harness.ts";
import { dialHostToolSession, dialFileTransfer } from "./broker-endpoint.ts";
import { transferFileOverEndpoint } from "./transfer-client.mts";

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

// ============================================================================
// Task 2, behaviours 6-10 -- against the real, compiled broker (the Task 1
// harness). Behaviours 1-5 live in broker-control.test.ts, against a stub
// listener; these five need a REAL transfer connection and a REAL
// runHostTool() run, which only a real broker provides.
// ============================================================================

async function waitForDirAbsent(path: string, deadlineMs = 5000): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    if (!existsAt(path)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 25));
  }
}

function existsAt(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** A minimal RAW line client for Test 10 -- unlike dialHostToolSession(),
 * this keeps every reply line as an un-parsed STRING, so the test can
 * assert on the raw bytes the broker actually wrote, not a JS object that
 * has already forgotten which substring the wire text used. */
function makeRawHostToolClient(port: number, host = "127.0.0.1") {
  const socket = connect({ port, host });
  const lines: string[] = [];
  const waiters: Array<(v: string) => void> = [];
  let buffer = "";
  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim() === "") continue;
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else lines.push(line);
    }
  });
  return {
    send(obj: Record<string, unknown>): void {
      socket.write(`${JSON.stringify(obj)}\n`);
    },
    nextLine(timeoutMs = 5000): Promise<string> {
      if (lines.length > 0) return Promise.resolve(lines.shift()!);
      return new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error(`no line within ${timeoutMs}ms`)), timeoutMs);
        waiters.push((v) => {
          clearTimeout(timer);
          resolvePromise(v);
        });
      });
    },
    close(): void {
      socket.destroy();
    },
  };
}

test("Test 6: through the harness broker, an upload whose transfer line declares a byteLength that differs from the manifest is refused denied before transfer_ready", { skip: SKIP_REASON }, async () => {
  const broker = await startHarnessBroker();
  try {
    const dialResult = await dialHostToolSession({ port: broker.port, candidates: ["127.0.0.1"] });
    assert.ok(dialResult.ok, `expected the host-tool dial to succeed, got ${JSON.stringify(dialResult)}`);
    if (!dialResult.ok) return;
    const { session } = dialResult;
    try {
      const stageResult = await session.stage([{ tree: 0, rel: "a.a", byteLength: 10 }]);
      assert.ok(stageResult.ok, `expected the stage to succeed, got ${JSON.stringify(stageResult)}`);
      if (!stageResult.ok) return;
      const handle = stageResult.files[0]!;

      // A raw `transfer` (upload) declaring a DIFFERENT byteLength than the
      // manifest's own declared 10 -- refused before transfer_ready, never
      // reaching a payload byte.
      const transferResult = await dialFileTransfer({
        handle,
        direction: "upload",
        byteLength: 999,
        sha256: "0".repeat(64),
        port: broker.port,
        candidates: ["127.0.0.1"],
      });
      assert.equal(transferResult.ok, false, `expected the mismatched-byteLength upload to be refused, got ${JSON.stringify(transferResult)}`);
      if (!transferResult.ok) {
        assert.match(transferResult.reason, /declared byteLength/i);
      }
    } finally {
      session.close();
    }
  } finally {
    await broker.stop();
  }
});

test("Test 7: closing the host-tool connection after a successful stage removes the request's own staging directory, and the minted handle then answers unknown transfer handle", { skip: SKIP_REASON }, async () => {
  const broker = await startHarnessBroker();
  try {
    const dialResult = await dialHostToolSession({ port: broker.port, candidates: ["127.0.0.1"] });
    assert.ok(dialResult.ok);
    if (!dialResult.ok) return;
    const { session } = dialResult;

    const stageResult = await session.stage([{ tree: 0, rel: "a.a", byteLength: 10 }]);
    assert.ok(stageResult.ok);
    if (!stageResult.ok) return;
    const requestKey = stageResult.request;
    const handle = stageResult.files[0]!;

    session.close();

    const requestDir = join(broker.home, "staging", requestKey);
    const removed = await waitForDirAbsent(requestDir);
    assert.ok(removed, `expected ${requestDir} to be removed once the host-tool connection closed`);

    const downloadResult = await dialFileTransfer({ handle, direction: "download", port: broker.port, candidates: ["127.0.0.1"] });
    assert.equal(downloadResult.ok, false);
    if (!downloadResult.ok) {
      assert.match(downloadResult.reason, /unknown transfer handle/i);
    }
  } finally {
    await broker.stop();
  }
});

test("Test 8: two concurrent host-tool connections receive distinct request keys, and each connection's host_tool_run refuses the other's key", { skip: SKIP_REASON }, async () => {
  const broker = await startHarnessBroker();
  try {
    const dialA = await dialHostToolSession({ port: broker.port, candidates: ["127.0.0.1"] });
    const dialB = await dialHostToolSession({ port: broker.port, candidates: ["127.0.0.1"] });
    assert.ok(dialA.ok);
    assert.ok(dialB.ok);
    if (!dialA.ok || !dialB.ok) return;
    const { session: sessionA } = dialA;
    const { session: sessionB } = dialB;
    try {
      const stageA = await sessionA.stage([]);
      const stageB = await sessionB.stage([]);
      assert.ok(stageA.ok);
      assert.ok(stageB.ok);
      if (!stageA.ok || !stageB.ok) return;
      assert.notEqual(stageA.request, stageB.request, "two concurrent host-tool connections must mint distinct request keys");

      // Connection A presents connection B's own request key -- refused,
      // never reaching a real run.
      const crossRun = await sessionA.run("oracle.probe", {}, stageB.request);
      assert.equal(crossRun.ok, false, `expected connection A presenting connection B's key to be refused, got ${JSON.stringify(crossRun)}`);

      // Connection B presents connection A's own request key -- refused too.
      const crossRunReverse = await sessionB.run("oracle.probe", {}, stageA.request);
      assert.equal(crossRunReverse.ok, false, `expected connection B presenting connection A's key to be refused, got ${JSON.stringify(crossRunReverse)}`);
    } finally {
      sessionA.close();
      sessionB.close();
    }
  } finally {
    await broker.stop();
  }
});

test("Test 9: an oracle.probe request stages an empty manifest, runs, and returns the executor's own oracle.probe response shape through runHostToolOverEndpoint()", { skip: SKIP_REASON }, async () => {
  const broker = await startHarnessBroker();
  try {
    const toolsRoot = freshDir("tools-root-oracle");
    const result = await runHostToolOverEndpoint("oracle.probe", {}, { toolsRoot, port: broker.port, candidates: ["127.0.0.1"] });
    assert.equal(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.equal((result as unknown as { tool: string }).tool, "oracle.probe");
    assert.equal(typeof (result as unknown as { available: unknown }).available, "boolean");
  } finally {
    await broker.stop();
  }
});

test("Test 10: the raw host_tool_run reply line, read off the socket, contains no occurrence of the harness home path", { skip: SKIP_REASON }, async () => {
  const broker = await startHarnessBroker();
  const client = makeRawHostToolClient(broker.port);
  try {
    client.send({ op: "hello", tag: "host-tool" });
    const helloLine = await client.nextLine();
    assert.match(helloLine, /"kind":"hello"/);

    const clientDir = freshDir("raw-client");
    const sourcePath = join(clientDir, "raw.a");
    writeFileSync(sourcePath, "* = $0801\nstart\n\trts\n", "utf8");
    const byteLength = statSync(sourcePath).size;

    client.send({ op: "host_tool_stage", files: [{ tree: 0, rel: "raw.a", byteLength }] });
    const stageLine = await client.nextLine();
    const stageParsed = JSON.parse(stageLine) as { kind: string; request: string; files: string[] };
    assert.equal(stageParsed.kind, "host_tool_staged");
    const handle = stageParsed.files[0]!;
    const requestKey = stageParsed.request;

    const uploadResult = await transferFileOverEndpoint({ direction: "upload", handle, sourcePath }, { port: broker.port, candidates: ["127.0.0.1"] });
    assert.ok(uploadResult.ok, `expected the upload to succeed, got ${JSON.stringify(uploadResult)}`);

    client.send({ op: "host_tool_run", tool: "acme.build", args: { source: handle }, request: requestKey });
    const runLine = await client.nextLine(30_000);
    assert.ok(!runLine.includes(broker.home), `the raw host_tool_run reply line must not contain the harness home path (${broker.home}); got: ${runLine}`);
  } finally {
    client.close();
    await broker.stop();
  }
});

// ============================================================================
// Phase 65, plan 65-03, Task 1 Test 6 (D-03/D-04): a real, multi-file
// acme.build assembles through the fixed endpoint end to end -- the whole
// source directory (including a subdirectory `!source`d file) uploads as
// its own tree, and a separate `-I` directory uploads as a second tree, with
// no ACME parsing on the client at any point.
// ============================================================================

test("Task 1 Test 6: acme.build with a subdirectory !source and a separate -I tree assembles through runHostToolOverEndpoint()", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const clientDir = freshDir("multi-file-client");

    // The main source tree: hello.a at the root, !source-ing lib/inc.a --
    // both cross as bytes under the SAME uploaded tree (tree 0), so ACME
    // resolves the relative !source with no client-side parsing at all.
    const sourceDir = join(clientDir, "src");
    mkdirSync(join(sourceDir, "lib"), { recursive: true });
    writeFileSync(join(sourceDir, "lib", "inc.a"), "included:\n\trts\n", "utf8");
    const sourcePath = join(sourceDir, "hello.a");
    writeFileSync(sourcePath, '* = $0801\nstart\n\t!source "lib/inc.a"\n', "utf8");

    // A second, SEPARATE directory tree for an -I include -- a file this
    // source references only via its OWN bare filename, resolvable ONLY
    // because acme's own -I search path (built server-side from the
    // uploaded tree's scratch-relative directory) includes it.
    const includeDir = join(clientDir, "extra-include");
    mkdirSync(includeDir, { recursive: true });
    writeFileSync(join(includeDir, "extra.a"), "extra:\n\trts\n", "utf8");
    writeFileSync(sourcePath, '* = $0801\nstart\n\t!source "lib/inc.a"\n\t!source "extra.a"\n', "utf8");

    const toolsRoot = freshDir("multi-file-tools-root");

    const result = await runHostToolOverEndpoint(
      "acme.build",
      { source: sourcePath, includes: [includeDir] },
      { toolsRoot, port: broker.port, candidates: ["127.0.0.1"] },
    );

    assert.equal(result.ok, true, `expected ok:true, got ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.equal(result.exitStatus, 0, `expected exitStatus 0, stderrTail: ${(result as { stderrTail?: string }).stderrTail}`);
    assert.equal(result.results.length, 1);

    const resultPath = result.results[0]!.path;
    const bytes = readFileSync(resultPath);
    assert.equal(bytes[0], 0x01);
    assert.equal(bytes[1], 0x08);
  } finally {
    await broker.stop();
  }
});
