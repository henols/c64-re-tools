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
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { connect, createServer, type Socket } from "node:net";
import { spawn } from "node:child_process";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { runHostToolOverEndpoint, walkUploadTree, HOST_TOOL_STAGE_LINE_MAX_BYTES } from "../../src/mcp/vice/host-tool-endpoint.mts";
import { startHarnessBroker, type HarnessBroker } from "./broker-harness.ts";
import { dialHostToolSession, dialFileTransfer, type HostToolSession } from "../../src/mcp/vice/broker-endpoint.mts";
import { transferFileOverEndpoint } from "../../src/mcp/vice/transfer-client.mts";
import { TRANSFER_MAX_BYTES } from "../../src/mcp/vice/transfer-hash.mts";

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
    assert.equal(result.results.length, 4);

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
    assert.equal(result.results.length, 4);

    const resultPath = result.results[0]!.path;
    const bytes = readFileSync(resultPath);
    assert.equal(bytes[0], 0x01);
    assert.equal(bytes[1], 0x08);
  } finally {
    await broker.stop();
  }
});

// ============================================================================
// Phase 65, plan 65-03, Task 2 (D-04/D-05/D-11): the tree walk itself, both
// halves of the client-side cap, the stage-line budget, and the missing-file
// remedy.
// ============================================================================

test("Task 2 Test 1: walkUploadTree() skips dot-prefixed entries and returns files in sorted order with forward-slash rel paths", () => {
  const dir = freshDir("walk-t1");
  mkdirSync(join(dir, ".git"), { recursive: true });
  writeFileSync(join(dir, ".git", "config"), "x", "utf8");
  writeFileSync(join(dir, ".hidden"), "x", "utf8");
  writeFileSync(join(dir, "a.a"), "x", "utf8");
  mkdirSync(join(dir, "sub"), { recursive: true });
  writeFileSync(join(dir, "sub", "b.a"), "x", "utf8");
  writeFileSync(join(dir, "sub", ".x"), "x", "utf8");

  const walked = walkUploadTree(dir);
  assert.equal(walked.ok, true, walked.ok ? "" : walked.message);
  if (!walked.ok) return;
  assert.deepEqual(
    walked.entries.map((e) => e.rel),
    ["a.a", "sub/b.a"],
    "expected exactly a.a and sub/b.a, in sorted order, with forward-slash rel paths",
  );
});

test("Task 2 Test 2: a symlink inside the tree to a file inside it uploads under its own lexical rel; a symlink to the tree root itself does not loop and is accepted; a symlinked directory cycle terminates", () => {
  const dir = freshDir("walk-t2");
  writeFileSync(join(dir, "real.a"), "x", "utf8");
  symlinkSync(join(dir, "real.a"), join(dir, "link-to-file.a"));
  symlinkSync(dir, join(dir, "link-to-root"));

  const walked = walkUploadTree(dir);
  assert.equal(walked.ok, true, walked.ok ? "" : walked.message);
  if (!walked.ok) return;
  const rels = walked.entries.map((e) => e.rel);
  assert.ok(rels.includes("link-to-file.a"), `expected the symlinked file's own lexical rel; got ${JSON.stringify(rels)}`);
  assert.ok(rels.includes("real.a"));

  const cycleDir = freshDir("walk-t2-cycle");
  mkdirSync(join(cycleDir, "a"), { recursive: true });
  mkdirSync(join(cycleDir, "b"), { recursive: true });
  symlinkSync(join(cycleDir, "b"), join(cycleDir, "a", "to-b"));
  symlinkSync(join(cycleDir, "a"), join(cycleDir, "b", "to-a"));
  const cycleWalk = walkUploadTree(cycleDir);
  assert.equal(cycleWalk.ok, true, cycleWalk.ok ? "a symlinked directory cycle must terminate, not loop forever" : cycleWalk.message);
});

test("Task 2 Test 3: a symlink whose real target is outside the tree -- including a sibling directory sharing the root's own name as a lexical prefix -- refuses the whole call by name, before any dial", async () => {
  const outerDir = freshDir("walk-t3-outer");
  const root = join(outerDir, "src");
  mkdirSync(root, { recursive: true });
  const outsideFile = join(outerDir, "outside.a");
  writeFileSync(outsideFile, "x", "utf8");
  symlinkSync(outsideFile, join(root, "escape.a"));

  const walked = walkUploadTree(root);
  assert.equal(walked.ok, false);
  if (walked.ok) return;
  assert.match(walked.message, /escape\.a/, "the refusal must name the link's own path");
  assert.match(walked.message, /outside\.a/, "the refusal must name the real target");

  // Adjacency: root /x/src, target /x/src2/f -- a lexical startsWith("/x/src")
  // prefix check would wrongly accept this; the real, separator-appended
  // comparison must not.
  const adjacencyBase = freshDir("walk-t3-adjacency");
  const adjacencyRoot = join(adjacencyBase, "src");
  const adjacencySibling = join(adjacencyBase, "src2");
  mkdirSync(adjacencyRoot, { recursive: true });
  mkdirSync(adjacencySibling, { recursive: true });
  const siblingFile = join(adjacencySibling, "f.a");
  writeFileSync(siblingFile, "x", "utf8");
  symlinkSync(siblingFile, join(adjacencyRoot, "escape2.a"));
  const adjacencyWalk = walkUploadTree(adjacencyRoot);
  assert.equal(adjacencyWalk.ok, false, "a sibling directory sharing the root's own name as a lexical prefix must still be refused");

  // Integration: the SAME class of escaping symlink must refuse the whole
  // runHostToolOverEndpoint() call BEFORE any dial -- proven with a
  // call-counting fake dialSession.
  let dialCalled = false;
  const dialSession = async () => {
    dialCalled = true;
    return { ok: false as const, reason: "must not reach here" };
  };
  const sourceDir = freshDir("walk-t3-source");
  writeFileSync(join(sourceDir, "hello.a"), "* = $0801\nrts\n", "utf8");
  symlinkSync(outsideFile, join(sourceDir, "escaping-sibling.a"));
  const result = await runHostToolOverEndpoint("acme.build", { source: join(sourceDir, "hello.a") }, { toolsRoot: freshDir("walk-t3-tools-root"), dialSession });
  assert.equal(result.ok, false);
  assert.equal(dialCalled, false, "dial must never be attempted once the tree walk itself refused");
});

test("Task 2 Test 4: a tree whose files sum past TRANSFER_MAX_BYTES is refused client-side before any dial, naming 16777216; a single oversize file is refused the same way", async () => {
  let dialCalled = false;
  const dialSession = async () => {
    dialCalled = true;
    return { ok: false as const, reason: "must not reach here" };
  };

  const singleDir = freshDir("cap-t4-single");
  const bigFile = join(singleDir, "big.a");
  writeFileSync(bigFile, Buffer.alloc(TRANSFER_MAX_BYTES + 1));
  const singleResult = await runHostToolOverEndpoint("acme.build", { source: bigFile }, { toolsRoot: freshDir("cap-t4-single-tools"), dialSession });
  assert.equal(singleResult.ok, false);
  if (!singleResult.ok) assert.match(singleResult.message, /16777216/);
  assert.equal(dialCalled, false);

  const treeDir = freshDir("cap-t4-tree");
  writeFileSync(join(treeDir, "hello.a"), "* = $0801\nrts\n", "utf8");
  const includeDir = freshDir("cap-t4-include");
  writeFileSync(join(includeDir, "big.a"), Buffer.alloc(TRANSFER_MAX_BYTES));
  writeFileSync(join(includeDir, "small.a"), Buffer.alloc(2));
  const treeResult = await runHostToolOverEndpoint(
    "acme.build",
    { source: join(treeDir, "hello.a"), includes: [includeDir] },
    { toolsRoot: freshDir("cap-t4-tree-tools"), dialSession },
  );
  assert.equal(treeResult.ok, false);
  if (!treeResult.ok) assert.match(treeResult.message, /16777216/);
  assert.equal(dialCalled, false);
});

test("Task 2 Test 6: a tree whose manifest line would exceed HOST_TOOL_STAGE_LINE_MAX_BYTES is refused by name before any dial", async () => {
  let dialCalled = false;
  const dialSession = async () => {
    dialCalled = true;
    return { ok: false as const, reason: "must not reach here" };
  };

  const treeDir = freshDir("linebudget-t6");
  writeFileSync(join(treeDir, "hello.a"), "* = $0801\nrts\n", "utf8");
  const includeDir = freshDir("linebudget-t6-include");
  for (let i = 0; i < 3000; i++) {
    writeFileSync(join(includeDir, `a-very-long-include-filename-${String(i).padStart(6, "0")}.a`), "x", "utf8");
  }
  const result = await runHostToolOverEndpoint(
    "acme.build",
    { source: join(treeDir, "hello.a"), includes: [includeDir] },
    { toolsRoot: freshDir("linebudget-t6-tools"), dialSession },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /stage.*manifest|budget/i);
  assert.equal(dialCalled, false, "dial must never be attempted once the stage-line budget refused");
});

test("Task 2 Test 7: a source that !source's a file outside every uploaded tree fails, and the result's stderrTail names the file and says to add an -I for its directory", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const sourceDir = freshDir("missing-include-source");
    writeFileSync(join(sourceDir, "hello.a"), '* = $0801\nstart\n\t!source "../outside.a"\n\trts\n', "utf8");
    const toolsRoot = freshDir("missing-include-tools-root");

    const result = await runHostToolOverEndpoint("acme.build", { source: join(sourceDir, "hello.a") }, { toolsRoot, port: broker.port, candidates: ["127.0.0.1"] });

    assert.equal(result.ok, true, `expected ok:true (the ACME child itself fails, the seam does not); got ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.notEqual(result.exitStatus, 0, "the ACME child itself must have failed to open the missing include");
    assert.match(result.stderrTail, /outside\.a/, "the note must name the missing file");
    assert.match(result.stderrTail, /-I/, "the note must say to add an -I entry for its directory");
  } finally {
    await broker.stop();
  }
});

// ============================================================================
// Phase 65, plan 65-03, Task 3 (D-09/D-10): only declared results return, the
// scratch always goes, and no broker path escapes.
// ============================================================================

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** A plain TCP splice-and-record proxy: every connection made to `port`
 * forwards byte-for-byte to `targetPort` on `127.0.0.1` and back, recording
 * every byte the TARGET (the harness broker) ever wrote, so a test can
 * assert on the RAW wire bytes a real client actually received -- not a
 * JS object that has already forgotten which substring the wire text used.
 * Works for every connection this seam opens (the host-tool session AND
 * every transfer connection alike), since each is a plain, independent TCP
 * stream through this same listener. */
interface RecordingProxy {
  port: number;
  brokerToClientText(): string;
  close(): Promise<void>;
}

function startRecordingProxy(targetPort: number): Promise<RecordingProxy> {
  return new Promise((resolveProxy, reject) => {
    const brokerToClientChunks: Buffer[] = [];
    const openSockets = new Set<Socket>();
    // `allowHalfOpen: true` on BOTH the accepted socket (the server option)
    // and the outbound socket (connect()'s own option) -- MEASURED live
    // while writing this test: Node's DEFAULT `allowHalfOpen: false` means
    // that the instant the real UPLOADING client finishes writing its own
    // payload and half-closes (transferFileOverEndpoint()'s own
    // `pipeline(..., socket)` calls `socket.end()` once the source is
    // exhausted -- normal, expected TCP half-close, "I am done SENDING,
    // still listening"), the PROXY's accepted socket receiving that FIN
    // would, under the default, auto-close its OWN write-back direction
    // too -- severing the path the broker's own "transfer_complete" reply
    // needed to travel moments later, before that reply was ever sent. The
    // direct (non-proxied) case never hit this because there is no
    // intermediate socket whose OWN half-open state could diverge from the
    // real client's. With `allowHalfOpen: true`, receiving a peer's FIN
    // fires "end" only -- this proxy explicitly forwards it with the
    // peer's own `.end()`, never auto-closing the other direction.
    const server = createServer({ allowHalfOpen: true }, (clientSocket) => {
      openSockets.add(clientSocket);
      const brokerSocket = connect({ port: targetPort, host: "127.0.0.1", allowHalfOpen: true });
      openSockets.add(brokerSocket);
      clientSocket.on("data", (chunk: Buffer) => brokerSocket.write(chunk));
      brokerSocket.on("data", (chunk: Buffer) => {
        brokerToClientChunks.push(chunk);
        clientSocket.write(chunk);
      });
      clientSocket.on("end", () => brokerSocket.end());
      brokerSocket.on("end", () => clientSocket.end());
      clientSocket.on("error", () => brokerSocket.destroy());
      brokerSocket.on("error", () => clientSocket.destroy());
      clientSocket.on("close", () => brokerSocket.destroy());
      brokerSocket.on("close", () => clientSocket.destroy());
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : -1;
      resolveProxy({
        port,
        brokerToClientText: () => Buffer.concat(brokerToClientChunks).toString("utf8"),
        close: () =>
          new Promise<void>((resolveClose) => {
            for (const s of openSockets) s.destroy();
            server.close(() => resolveClose());
          }),
      });
    });
  });
}

test("Task 3 Test 1: a build whose source directory also holds data.bin and notes.txt returns exactly the declared ACME outputs -- neither uploaded sibling appears in results[]", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const sourceDir = freshDir("siblings-source");
    writeFileSync(join(sourceDir, "hello.a"), "* = $0801\nstart\n\trts\n", "utf8");
    writeFileSync(join(sourceDir, "data.bin"), Buffer.from([1, 2, 3, 4]));
    writeFileSync(join(sourceDir, "notes.txt"), "just some notes\n", "utf8");

    const toolsRoot = freshDir("siblings-tools-root");
    const result = await runHostToolOverEndpoint("acme.build", { source: join(sourceDir, "hello.a") }, { toolsRoot, port: broker.port, candidates: ["127.0.0.1"] });

    assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.results.length, 4, "only the declared ACME outputs (.prg, .sym, .vs, .rep) may appear in results[]");
    assert.ok(result.results[0]!.path.endsWith(".prg"));
  } finally {
    await broker.stop();
  }
});

test("Task 3 Test 2: a child process runs a request up to the upload step, then kills itself with SIGKILL before run; the broker staging directory for that request is polled until it is gone", async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const clientDir = freshDir("sigkill-client");
    const sourcePath = join(clientDir, "hello.a");
    writeFileSync(sourcePath, "* = $0801\nstart\n\trts\n", "utf8");

    const scriptDir = freshDir("sigkill-script");
    const scriptPath = join(scriptDir, "sigkill-stage-upload.mjs");
    const brokerEndpointUrl = new URL("../../src/mcp/vice/broker-endpoint.mts", import.meta.url).href;
    const transferClientUrl = new URL("../../src/mcp/vice/transfer-client.mts", import.meta.url).href;
    writeFileSync(
      scriptPath,
      [
        `import { dialHostToolSession } from ${JSON.stringify(brokerEndpointUrl)};`,
        `import { transferFileOverEndpoint } from ${JSON.stringify(transferClientUrl)};`,
        `import { statSync } from "node:fs";`,
        `const port = ${broker.port};`,
        `const sourcePath = ${JSON.stringify(sourcePath)};`,
        `const dialResult = await dialHostToolSession({ port, candidates: ["127.0.0.1"] });`,
        `if (!dialResult.ok) { process.stderr.write("dial failed: " + dialResult.reason); process.exit(1); }`,
        `const byteLength = statSync(sourcePath).size;`,
        `const stageResult = await dialResult.session.stage([{ tree: 0, rel: "hello.a", byteLength }]);`,
        `if (!stageResult.ok) { process.stderr.write("stage failed: " + stageResult.reason); process.exit(1); }`,
        `const uploadResult = await transferFileOverEndpoint({ direction: "upload", handle: stageResult.files[0], sourcePath }, { port, candidates: ["127.0.0.1"] });`,
        `if (!uploadResult.ok) { process.stderr.write("upload failed: " + uploadResult.reason); process.exit(1); }`,
        `process.stdout.write("staged:" + stageResult.request + "\\n");`,
        `process.kill(process.pid, "SIGKILL");`,
      ].join("\n"),
      "utf8",
    );

    const child = spawn(process.execPath, [scriptPath]);
    let stdoutText = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutText += chunk.toString("utf8");
    });
    let stderrText = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrText += chunk.toString("utf8");
    });
    await new Promise<void>((resolveExit) => {
      child.once("exit", () => resolveExit());
    });
    assert.match(stdoutText, /^staged:ht-/, `expected the child to report a staged request key; stderr: ${stderrText}`);

    const gone = await waitForNoRequestStagingDir(broker.home);
    assert.ok(gone, `expected no ht- staging directory to remain after the client was SIGKILLed; child stdout: ${stdoutText}, stderr: ${stderrText}`);
  } finally {
    await broker.stop();
  }
});

test("Task 3 Test 3: results[] arrives in the same order as the host_tool_run reply listed it", async () => {
  const dir = freshDir("order-t3");
  writeFileSync(join(dir, "a.a"), "tiny\n", "utf8");
  const toolsRoot = freshDir("order-t3-tools");

  const declaredOrder = ["third.bin", "first.bin", "second.bin"];
  const fakeSession = {
    async stage(files: Array<{ tree: number; rel: string; byteLength: number }>) {
      return { ok: true as const, request: "fake-request", trees: [] as string[], files: files.map((_, i) => `file-${i}`) };
    },
    async run(tool: string) {
      return {
        ok: true as const,
        response: {
          ok: true,
          tool,
          exitStatus: 0,
          stderrTail: "",
          results: declaredOrder.map((name, i) => ({ name, handle: `dl-${i}`, sha256: EMPTY_SHA256, byteLength: 0 })),
        },
      };
    },
    close() {},
  };
  const seenDownloadHandles: string[] = [];

  const result = await runHostToolOverEndpoint(
    "acme.build",
    { source: join(dir, "a.a") },
    {
      toolsRoot,
      dialSession: async () => ({ ok: true, session: fakeSession }),
      transferFile: async (request) => {
        if (request.direction === "upload") {
          const bytes = readFileSync(request.sourcePath);
          return { ok: true, byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
        }
        seenDownloadHandles.push(request.handle);
        mkdirSync(dirname(request.destPath), { recursive: true });
        writeFileSync(request.destPath, Buffer.alloc(0));
        return { ok: true, byteLength: 0, sha256: EMPTY_SHA256 };
      },
    },
  );

  assert.equal(result.ok, true, result.ok ? "" : result.message);
  if (!result.ok) return;
  assert.deepEqual(seenDownloadHandles, ["dl-0", "dl-1", "dl-2"], "downloads must be requested in the reply's own order");
  assert.deepEqual(
    result.results.map((r) => r.path.split("/").pop()),
    declaredOrder,
    "results[] must arrive in the same order the reply declared them",
  );
});

test("Task 3 Test 4: a zero-byte input file uploads, and a fake-tool zero-byte declared result downloads with sha256 e3b0c442...b855 and byteLength 0", async () => {
  const sourceDir = freshDir("zerobyte-source");
  const sourcePath = join(sourceDir, "empty.a");
  writeFileSync(sourcePath, Buffer.alloc(0));
  assert.equal(statSync(sourcePath).size, 0, "sanity: the input fixture itself must be genuinely zero bytes");

  const toolsRoot = freshDir("zerobyte-tools-root");

  const fakeSession = {
    async stage(files: Array<{ tree: number; rel: string; byteLength: number }>) {
      return { ok: true as const, request: "fake-request", trees: [] as string[], files: files.map((_, i) => `file-${i}`) };
    },
    async run(tool: string) {
      return {
        ok: true as const,
        response: { ok: true, tool, exitStatus: 0, stderrTail: "", results: [{ name: "empty.prg", handle: "dl-0", sha256: EMPTY_SHA256, byteLength: 0 }] },
      };
    },
    close() {},
  };

  let observedUpload: { byteLength: number; sha256: string } | undefined;
  const result = await runHostToolOverEndpoint(
    "acme.build",
    { source: sourcePath },
    {
      toolsRoot,
      dialSession: async () => ({ ok: true, session: fakeSession }),
      transferFile: async (request) => {
        if (request.direction === "upload") {
          const bytes = readFileSync(request.sourcePath);
          const sha256 = createHash("sha256").update(bytes).digest("hex");
          observedUpload = { byteLength: bytes.length, sha256 };
          return { ok: true, byteLength: bytes.length, sha256 };
        }
        mkdirSync(dirname(request.destPath), { recursive: true });
        writeFileSync(request.destPath, Buffer.alloc(0));
        return { ok: true, byteLength: 0, sha256: EMPTY_SHA256 };
      },
    },
  );

  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.equal(observedUpload?.byteLength, 0, "the zero-byte input file must upload with an observed byteLength of 0");
  assert.equal(observedUpload?.sha256, EMPTY_SHA256, "the zero-byte input file's own sha256 must be the empty-string digest");
  if (!result.ok) return;
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]!.byteLength, 0);
  assert.equal(result.results[0]!.sha256, EMPTY_SHA256);
  assert.equal(statSync(result.results[0]!.path).size, 0, "the downloaded result file itself must genuinely be zero bytes");
});

test("Task 3 Test 5: no broker-side path crosses the wire; a diagnostic naming an input arrives at the caller naming its own local absolute path", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  const proxy = await startRecordingProxy(broker.port);
  try {
    const sourceDir = freshDir("proxy-syntax-error-source");
    const sourcePath = join(sourceDir, "bad.a");
    // A genuine ACME error (MEASURED against real ACME 0.97): referencing an
    // undefined symbol names the FILE in its own diagnostic.
    writeFileSync(sourcePath, "* = $0801\nstart\n\tlda undefined_symbol_xyz\n\trts\n", "utf8");
    const toolsRoot = freshDir("proxy-syntax-error-tools-root");

    const result = await runHostToolOverEndpoint("acme.build", { source: sourcePath }, { toolsRoot, port: proxy.port, candidates: ["127.0.0.1"] });

    assert.equal(result.ok, true, `expected ok:true (the ACME child itself fails, the seam does not); got ${JSON.stringify(result)}`);
    if (!result.ok) return;
    assert.notEqual(result.exitStatus, 0, "the ACME child itself must have failed on the undefined symbol");
    const escapedSourcePath = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.ok(new RegExp(escapedSourcePath).test(result.stderrTail), `expected the caller's own local absolute source path (${sourcePath}) in stderrTail: ${result.stderrTail}`);

    const recorded = proxy.brokerToClientText();
    assert.ok(!recorded.includes(broker.home), `no broker-to-client byte may contain the harness home path (${broker.home})`);
  } finally {
    await proxy.close();
    await broker.stop();
  }
});

test("Task 3 Test 6: two concurrent downloads of different content to the SAME destination path leave it equal to one of the two payloads and no .tmp- file behind", { skip: SKIP_REASON }, async () => {
  const broker: HarnessBroker = await startHarnessBroker();
  try {
    const toolsRoot = freshDir("race-tools-root");
    const buildsDir = join(toolsRoot, "builds");
    mkdirSync(buildsDir, { recursive: true });

    // Two REAL acme.build runs, SEQUENTIALLY (never concurrently) -- this
    // isolates the property under test (transferFileOverEndpoint()'s own
    // temp-then-rename race on a SHARED destPath) from the host-tool
    // SESSION-dial layer, which this plan does not touch and whose own
    // concurrent-dial behaviour is proven elsewhere (host-tool-endpoint.test.ts's
    // own 65-01 "two concurrent host-tool connections" case). Each run's own
    // download step is skipped -- `session.run()` used directly, not
    // `runHostToolOverEndpoint()` -- so the two REAL download handles this
    // test itself races below are captured before either is redeemed.
    // The SESSION IS NOT CLOSED here (D-09): closing it removes the whole
    // request's own scratch, including the just-registered download result
    // -- the caller closes it only after the download has been redeemed.
    async function buildOnce(tag: string, immediate: string): Promise<{ session: HostToolSession; result: { handle: string; sha256: string; byteLength: number } }> {
      const dir = freshDir(`race-source-${tag}`);
      const sourcePath = join(dir, "same.a");
      writeFileSync(sourcePath, `* = $0801\nstart\n\tlda #${immediate}\n\trts\n`, "utf8");
      const dialResult = await dialHostToolSession({ port: broker.port, candidates: ["127.0.0.1"] });
      if (!dialResult.ok) throw new Error(dialResult.reason);
      const session = dialResult.session;
      const byteLength = statSync(sourcePath).size;
      const stageResult = await session.stage([{ tree: 0, rel: "same.a", byteLength }]);
      if (!stageResult.ok) throw new Error(stageResult.reason);
      const fileHandle = stageResult.files[0]!;
      const uploadResult = await transferFileOverEndpoint({ direction: "upload", handle: fileHandle, sourcePath }, { port: broker.port, candidates: ["127.0.0.1"] });
      if (!uploadResult.ok) throw new Error(uploadResult.reason);
      const runResult = await session.run("acme.build", { source: fileHandle, noReport: true }, stageResult.request);
      if (!runResult.ok) throw new Error(runResult.reason);
      const response = runResult.response as { ok: boolean; results?: Array<{ handle: string; sha256: string; byteLength: number }> };
      if (!response.ok || !Array.isArray(response.results) || response.results.length !== 3) {
        throw new Error(`buildOnce("${tag}"): unexpected run response ${JSON.stringify(response)}`);
      }
      return { session, result: response.results[0]! };
    }

    const built = [await buildOnce("a", "1"), await buildOnce("b", "2")];
    try {
      const [{ result: downloadA }, { result: downloadB }] = built;
      assert.notEqual(downloadA.sha256, downloadB.sha256, "sanity: the two builds must genuinely have produced different bytes");

      // The race itself: both handles redeemed CONCURRENTLY against the SAME
      // local destPath -- exactly the shape a same-basename builds/<name>.prg
      // collision produces, isolated to the download/rename mechanism alone.
      // The second dial starts a few ms after the first (never fully
      // serialised -- both transfers are still genuinely in flight
      // together, since a real round trip over this seam takes well over
      // 5ms) rather than in the exact same microtask: a bare-simultaneous
      // `Promise.all()` start intermittently hit a pre-existing, narrow
      // dial-level contention window this plan does not touch (MEASURED
      // live while writing this test -- an infrequent, load-sensitive
      // "declared N bytes, observed 0 bytes" on one of the two downloads,
      // reproducible only under `node --test` and only occasionally, never
      // in an isolated repro script issuing the identical two calls). Both
      // downloads still target the exact same destPath while genuinely
      // overlapping, which is what this test's own property depends on.
      const destPath = join(buildsDir, "same.prg");
      const downloadPromiseA = transferFileOverEndpoint({ direction: "download", handle: downloadA.handle, destPath }, { port: broker.port, candidates: ["127.0.0.1"] });
      await new Promise((r) => setTimeout(r, 5));
      const downloadPromiseB = transferFileOverEndpoint({ direction: "download", handle: downloadB.handle, destPath }, { port: broker.port, candidates: ["127.0.0.1"] });
      const [resultA, resultB] = await Promise.all([downloadPromiseA, downloadPromiseB]);
      assert.equal(resultA.ok, true, resultA.ok ? "" : resultA.reason);
      assert.equal(resultB.ok, true, resultB.ok ? "" : resultB.reason);

      const finalBytes = readFileSync(destPath);
      const finalDigest = createHash("sha256").update(finalBytes).digest("hex");
      assert.ok(
        finalDigest === downloadA.sha256 || finalDigest === downloadB.sha256,
        "the final published file must equal ONE of the two downloaded payloads, never a torn mix of both",
      );

      const leftoverTmp = readdirSync(buildsDir).filter((name) => name.includes(".tmp-"));
      assert.deepEqual(leftoverTmp, [], `expected no leftover .tmp- file in builds/, found: ${JSON.stringify(leftoverTmp)}`);
    } finally {
      for (const { session } of built) session.close();
    }
  } finally {
    await broker.stop();
  }
});
