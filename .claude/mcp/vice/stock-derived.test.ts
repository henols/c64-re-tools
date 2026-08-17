// node:test coverage of stock-derived.ts -- D-02 mechanism 1 (criterion 1
// verbatim): the simulated-container behavioural test proving a derived
// tool's handler is reached before forwardToVice() ever runs
// rewriteArguments(), with a non-vacuity control proving translation WOULD
// have visibly rewritten the path had it been (wrongly) applied.
import { test } from "node:test";
import assert from "node:assert/strict";

import { STOCK_DERIVED_TOOLS, derivedContainerPath, DerivedToolError } from "./stock-derived.ts";
import { withDerivedTool, type StockDispatchDeps } from "./stock-dispatch.ts";
import { hostPath } from "./hostpath.ts";

// --------------------------------------------------------- STOCK_DERIVED_TOOLS

test("STOCK_DERIVED_TOOLS: exactly five entries -- vice_disassemble plus Phase 5's DERIV-01/DERIV-04 quartet", () => {
  assert.equal(STOCK_DERIVED_TOOLS.size, 5);
  assert.ok(STOCK_DERIVED_TOOLS.has("vice_disassemble"));
  assert.ok(STOCK_DERIVED_TOOLS.has("vice_memory_search"));
  assert.ok(STOCK_DERIVED_TOOLS.has("vice_memory_compare"));
  assert.ok(STOCK_DERIVED_TOOLS.has("vice_symbols_load"));
  assert.ok(STOCK_DERIVED_TOOLS.has("vice_symbols_lookup"));
});

// --------------------------------------------------------- derivedContainerPath

test("derivedContainerPath: throws naming the tool and STOCK_DERIVED_TOOLS when the tool is not declared", () => {
  assert.throws(
    () => derivedContainerPath("vice_memory_read", "/workspace/x.png"),
    (err: unknown) => {
      assert.ok(err instanceof DerivedToolError);
      assert.match((err as Error).message, /vice_memory_read/);
      assert.match((err as Error).message, /STOCK_DERIVED_TOOLS/);
      return true;
    },
  );
});

test("derivedContainerPath: returns a declared tool's container path unchanged", () => {
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  try {
    assert.equal(derivedContainerPath("vice_disassemble", "/workspace/out.png"), "/workspace/out.png");
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
  }
});

// ---------------------------------------------------------------------------
// D-02 mechanism 1 (criterion 1 verbatim): a derived handler dispatched
// through withDerivedTool() receives the CONTAINER path, never the
// host-translated one, in a simulated-container environment that WOULD
// visibly rewrite the path if translation were (wrongly) applied.
// ---------------------------------------------------------------------------

test("D-02 mechanism 1: a derived handler receives the container path verbatim, proven against a working non-vacuity control", async () => {
  const prevHostWs = process.env.HOST_WORKSPACE_PATH;
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const prevContainerWs = process.env.CONTAINER_WORKSPACE_PATH;
  process.env.HOST_WORKSPACE_PATH = "/home/user/project";
  process.env.CLAUDE_PROJECT_DIR = "/workspace";
  process.env.CONTAINER_WORKSPACE_PATH = "/workspace";
  try {
    const CONTAINER_PATH = "/workspace/out.png";

    // The non-vacuity control FIRST: prove that, in this exact environment,
    // hostpath.ts's own translator WOULD produce a DIFFERENT string for the
    // same input. Without this control, the behavioural assertion below
    // could pass simply because translation was never configured to do
    // anything in this environment -- the CR-07 failure shape, where a
    // structural test passed while three synthetic tools reached the fork's
    // HTTP transport on stock. If hostPath() cannot produce a differing
    // value here, the control has failed to establish itself and this test
    // must fail loudly rather than silently skip.
    const translated = hostPath(CONTAINER_PATH, { workspaceRoot: "/workspace" });
    assert.notEqual(
      translated,
      CONTAINER_PATH,
      "non-vacuity control failed: hostPath() did not produce a different string for the same input under the " +
        "same environment -- the behavioural assertion below would prove nothing",
    );
    assert.equal(translated, "/home/user/project/out.png");

    // Now the real assertion: a derived handler dispatched through
    // withDerivedTool() must receive the CONTAINER path, never the
    // translated one computed above.
    let receivedArgs: Record<string, unknown> | undefined;
    const wrapped = withDerivedTool("vice_disassemble", { needsSession: false }, async (args) => {
      receivedArgs = args;
      return { content: [{ type: "text", text: "{}" }], isError: false };
    });
    const deps: StockDispatchDeps = {
      ensureLease: async () => {
        throw new Error("ensureLease must never be called for a needsSession:false derived tool");
      },
    };
    const result = await wrapped({ path: CONTAINER_PATH }, deps);
    assert.equal(result.isError, false);
    assert.deepEqual(receivedArgs, { path: CONTAINER_PATH }, "the derived handler must receive the container path verbatim");
    assert.equal(derivedContainerPath("vice_disassemble", CONTAINER_PATH), CONTAINER_PATH);
  } finally {
    if (prevHostWs === undefined) delete process.env.HOST_WORKSPACE_PATH;
    else process.env.HOST_WORKSPACE_PATH = prevHostWs;
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
    if (prevContainerWs === undefined) delete process.env.CONTAINER_WORKSPACE_PATH;
    else process.env.CONTAINER_WORKSPACE_PATH = prevContainerWs;
  }
});
