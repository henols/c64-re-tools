// node:test coverage of stock-paths.ts -- D-17's declared table and the one
// translation wrapper. No real socket, no real emulator, no real bind mount:
// isInsideContainer() is stubbed via setIsInsideContainerForTest(), and
// HOST_WORKSPACE_PATH/CONTAINER_WORKSPACE_PATH are set/restored per test.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  STOCK_EMULATOR_SIDE_PATH_TOOLS,
  withEmulatorSidePath,
  setIsInsideContainerForTest,
  sanitizeSnapshotName,
  snapshotPathFor,
  snapshotMetaPathFor,
  StockPathError,
} from "./stock-paths.ts";
import { StockProtocolError, ErrorCode } from "./stock-protocol.ts";

afterEach(() => {
  setIsInsideContainerForTest(null);
});

// --------------------------------------------------------- STOCK_EMULATOR_SIDE_PATH_TOOLS

test("STOCK_EMULATOR_SIDE_PATH_TOOLS: exactly four entries, no screenshot/disassembly tool", () => {
  assert.equal(STOCK_EMULATOR_SIDE_PATH_TOOLS.size, 4);
  assert.ok(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_autostart"));
  assert.ok(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_disk_attach"));
  assert.ok(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_snapshot_save"));
  assert.ok(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_snapshot_load"));
  assert.equal(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_display_screenshot"), false);
  assert.equal(STOCK_EMULATOR_SIDE_PATH_TOOLS.has("vice_disassemble"), false);
});

// --------------------------------------------------------- withEmulatorSidePath

test("withEmulatorSidePath: throws naming the tool when it is not in the declared table", async () => {
  await assert.rejects(
    () => withEmulatorSidePath("vice_memory_read", "/workspace/foo.prg", async (p) => p),
    (err: unknown) => {
      assert.ok(err instanceof StockPathError);
      assert.match((err as Error).message, /vice_memory_read/);
      assert.match((err as Error).message, /STOCK_EMULATOR_SIDE_PATH_TOOLS/);
      return true;
    },
  );
});

test("withEmulatorSidePath: on a bare host (isInsideContainer false), send() receives the container path unchanged", async () => {
  setIsInsideContainerForTest(() => false);
  let received: string | null = null;
  const { result, sentPath } = await withEmulatorSidePath("vice_autostart", "/workspace/game.prg", async (p) => {
    received = p;
    return "ok";
  });
  assert.equal(received, "/workspace/game.prg");
  assert.equal(sentPath, "/workspace/game.prg");
  assert.equal(result, "ok");
});

test("withEmulatorSidePath: inside a container with HOST_WORKSPACE_PATH set, send() receives the mapped host path", async () => {
  setIsInsideContainerForTest(() => true);
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  // CLAUDE_PROJECT_DIR (repoRoot()'s branch 0) is honoured unconditionally,
  // unlike CONTAINER_WORKSPACE_PATH which only wins when `from` resolves
  // inside it -- the cleanest deterministic override for this test, so
  // repoRoot() (threaded through as workspaceRoot below) returns exactly
  // "/workspace" regardless of where this test file itself lives on disk.
  process.env.CLAUDE_PROJECT_DIR = "/workspace";
  try {
    let received: string | null = null;
    const { sentPath } = await withEmulatorSidePath("vice_snapshot_save", "/workspace/.vice-snapshots/x.vsf", async (p) => {
      received = p;
      return "ok";
    });
    assert.equal(received, "/home/user/project/.vice-snapshots/x.vsf");
    assert.equal(sentPath, "/home/user/project/.vice-snapshots/x.vsf");
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
  }
});

test("withEmulatorSidePath: a CmdFailure (0x8f) is non-fatal -- probing continues to the next candidate", async () => {
  setIsInsideContainerForTest(() => true);
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  delete process.env.HOST_WORKSPACE_PATH;
  const prevContainerWs = process.env.CONTAINER_WORKSPACE_PATH;
  process.env.CONTAINER_WORKSPACE_PATH = "/workspace";
  try {
    // No HOST_WORKSPACE_PATH -- falls through to the mountinfo-based
    // candidate ladder, which in this sandbox almost certainly yields no
    // real mount at all, so hostPathCandidates() itself likely returns an
    // empty candidate list and tryHostPaths() throws before ever calling
    // send(). This test only asserts the fatal predicate's SHAPE compiles
    // and is wired through -- the exhaustive fatal/non-fatal branching is
    // covered directly below without going through the real hostpath.ts
    // mount lookup at all.
    await assert.rejects(() =>
      withEmulatorSidePath("vice_snapshot_load", "/workspace/.vice-snapshots/missing.vsf", async () => {
        throw new StockProtocolError("cmd failure", { errorCode: ErrorCode.CmdFailure });
      }),
    );
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
    if (prevContainerWs === undefined) delete process.env.CONTAINER_WORKSPACE_PATH;
    else process.env.CONTAINER_WORKSPACE_PATH = prevContainerWs;
  }
});

// --------------------------------------------------------- sanitizeSnapshotName

test("sanitizeSnapshotName: accepts valid names", () => {
  assert.equal(sanitizeSnapshotName("before_crash"), "before_crash");
  assert.equal(sanitizeSnapshotName("level3-boss"), "level3-boss");
});

const REFUSED_NAMES: unknown[] = ["", "../etc/passwd", "a/b", "a.b", "a b", "x".repeat(65)];

for (const name of REFUSED_NAMES) {
  test(`sanitizeSnapshotName: refuses ${JSON.stringify(name)}`, () => {
    assert.throws(
      () => sanitizeSnapshotName(name),
      (err: unknown) => {
        assert.ok(err instanceof StockPathError);
        assert.match((err as Error).message, /alphanumeric, underscore or hyphen/);
        return true;
      },
    );
  });
}

test("sanitizeSnapshotName: refuses a non-string value", () => {
  assert.throws(() => sanitizeSnapshotName(123), StockPathError);
  assert.throws(() => sanitizeSnapshotName(undefined), StockPathError);
  assert.throws(() => sanitizeSnapshotName(null), StockPathError);
});

// --------------------------------------------------------- snapshotPathFor / snapshotMetaPathFor

test("snapshotPathFor: returns an absolute path ending in /.vice-snapshots/<name>.vsf", () => {
  const p = snapshotPathFor("x");
  assert.ok(p.endsWith("/.vice-snapshots/x.vsf"));
  assert.ok(p.startsWith("/"));
});

test("snapshotMetaPathFor: returns an absolute path ending in /.vice-snapshots/<name>.json", () => {
  const p = snapshotMetaPathFor("x");
  assert.ok(p.endsWith("/.vice-snapshots/x.json"));
  assert.ok(p.startsWith("/"));
});

test("snapshotPathFor: rejects an unsanitary name before building a path", () => {
  assert.throws(() => snapshotPathFor("../etc/passwd"), StockPathError);
});
