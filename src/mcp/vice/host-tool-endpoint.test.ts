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
import { join } from "node:path";
import { connect } from "node:net";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { runHostToolOverEndpoint, walkUploadTree, HOST_TOOL_STAGE_LINE_MAX_BYTES } from "./host-tool-endpoint.mts";
import { startHarnessBroker, type HarnessBroker } from "./broker-harness.ts";
import { dialHostToolSession, dialFileTransfer } from "./broker-endpoint.ts";
import { transferFileOverEndpoint } from "./transfer-client.mts";
import { TRANSFER_MAX_BYTES } from "./transfer-hash.mts";

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
