#!/usr/bin/env node
// fork-live.test.ts
//
// OPT-IN, MANUAL-ONLY. The fork backend's own `-mcpserver` HTTP transport
// has never been live-exercised in this repository. `broker-e2e.test.ts`
// deliberately stubs the emulator binary to `/bin/sleep` (its own header
// says so explicitly: no real emulator, no real connection to host VICE).
// The one genuine live end-to-end capture on file, the phase 8 human
// walkthrough, is scoped entirely to the STOCK backend. Even the fork
// *binary* live captures recorded elsewhere spoke the stock binary-monitor
// protocol (`-binarymonitor`) to it, never the fork's own HTTP endpoint.
// This file closes that gap: it drives the SAME transport seam production
// uses (`useInstance()` + `call()` + `serverInfo()` in ./vice.ts) against a
// REAL fork build's REAL `-mcpserver` HTTP endpoint.
//
// Two environment facts, established by stock-live.test.ts's own header and
// not re-discovered here:
//   - /usr/local/bin/x64sc (the FORK build, has -mcpserver) SHADOWS
//     /usr/bin/x64sc (genuinely unpatched stock, no -mcpserver at all) on
//     PATH. A bare `x64sc` would resolve to the fork -- which is what this
//     file wants -- but the binary is still named by absolute path
//     (VICE_LIVE_FORK_BIN, defaulting to /usr/local/bin/x64sc), never a bare
//     command name, so a reader of this file never has to guess which
//     binary actually answered.
//   - Both builds can share $HOME/.config/vice/vicerc and cross-write it,
//     which can raise a modal "Configuration file version mismatch" dialog
//     on a mismatched launch. XDG_CONFIG_HOME is pointed at a per-run
//     mkdtempSync() scratch dir for the spawned child only, never the
//     shared config.
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and
// CI has no VICE. SKIP_REASON is computed once, and EVERY test in this file
// passes it through node:test's own `{ skip }` option -- never a hand-rolled
// early return, which would report a false PASS rather than a SKIP. It is
// registered in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list -- see that
// file's own header) as the eighth manual-only file, so
// `npm run test:automated` never runs it either. It is also deliberately
// excluded from package.json's `files[]` -- it verifies live emulator
// behaviour, not runtime code shipped in the tarball.
//
// Opt in with:
//   VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc node --test fork-live.test.ts
//
// WHAT NOT TO DO:
//   - Never stub the binary (that is broker-e2e.test.ts's job, and the
//     opposite of this file's purpose).
//   - Never acquire the child process or point the transport seam anywhere
//     outside the before()/after() pair below -- teardown must run even
//     when a test throws (T-14-11).
//   - Never bind -mcpserverhost beyond 127.0.0.1 -- the fork's HTTP endpoint
//     is unauthenticated full machine control, exactly like the binary
//     monitor (T-14-09).
//   - Never pass -mcpservertoken. That flag makes the server REQUIRE a
//     bearer token, and vice.ts's call() sends no Authorization header --
//     passing it would guarantee every request is rejected (T-14-13,
//     accepted risk: loopback binding is the control here, not a token).
//   - Never hardcode a register id/name/value recorded by an earlier run --
//     resolve everything from THIS run's own live answers.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

import { useInstance, call, serverInfo, beginSession, readEpoch } from "./vice.ts";
import { buildViceArgs } from "./broker-launch.mts";
import { DELIBERATELY_DELETED_FORK_TOOLS } from "./fork-deleted-tools.ts";

// ---------------------------------------------------------------------------
// Opt-in gate
// ---------------------------------------------------------------------------

const VICE_LIVE_FORK_BIN_DEFAULT = "/usr/local/bin/x64sc";
const resolvedBinPath = process.env.VICE_LIVE_FORK_BIN ?? VICE_LIVE_FORK_BIN_DEFAULT;

/** Computed exactly once. Every test in this file passes this through
 * node:test's own `{ skip }` option -- never a hand-rolled early return,
 * which would report a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = !process.env.VICE_LIVE_FORK_BIN
  ? `fork-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_FORK_BIN=/usr/local/bin/x64sc ` +
    `(or another real fork VICE binary's absolute path, i.e. one whose --help output advertises ` +
    `-mcpserver) to run it. ${VICE_LIVE_FORK_BIN_DEFAULT} is only a default for an UNSET variable -- an ` +
    `empty value counts as unset, and a set-but-wrong path is reported by the next branch, not defaulted ` +
    `away. A bare "x64sc" on PATH resolves to the fork build at /usr/local/bin/x64sc, while genuine ` +
    `unpatched stock (no -mcpserver at all) lives at /usr/bin/x64sc -- always name the fork binary by ` +
    `absolute path.`
  : !existsSync(resolvedBinPath)
    ? `VICE_LIVE_FORK_BIN="${resolvedBinPath}" does not exist on disk -- opt-in requires a real fork ` +
      `VICE binary at that absolute path (e.g. /usr/local/bin/x64sc). Genuine unpatched stock lives at ` +
      `/usr/bin/x64sc and does not advertise -mcpserver at all.`
    : false;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

interface LiveFixture {
  child: ChildProcess;
  scratchDir: string;
  argv: string[];
  url: string;
}

let fixture: LiveFixture | null = null;

/** Binds a throwaway server to 127.0.0.1:0, reads the OS-assigned port, and
 * closes it -- the standard "free ephemeral port" idiom, matching
 * stock-live.test.ts's own freeEphemeralPort(). */
async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port === null) reject(new Error("freeEphemeralPort: could not read an ephemeral port from address()"));
        else resolve(port);
      });
    });
  });
}

/** Polls the fork's own HTTP endpoint with a bare JSON-RPC "initialize"
 * POST until it answers (any parseable response, success or JSON-RPC-level
 * error, counts as "the endpoint is up") or the deadline elapses. Runs
 * BEFORE useInstance() redirects the shared transport seam, deliberately --
 * this is a plain readiness probe, not a session. */
async function waitForEndpointReady(url: string, deadlineMs = 20000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "fork-live-probe", version: "1.0" } },
        }),
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok || res.status < 500) return;
      lastErr = new Error(`endpoint answered with HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    `waitForEndpointReady: ${url} (fork binary ${resolvedBinPath}) never answered within ${deadlineMs}ms ` +
      `(last error: ${String(lastErr)})`,
  );
}

before(async () => {
  if (SKIP_REASON) return;

  const port = await freeEphemeralPort();
  const scratchDir = mkdtempSync(join(tmpdir(), "gsd-1403-vicerc-"));

  // The exact argv buildViceArgs()'s fork branch produces (broker-launch.mts:218) --
  // never a hand-rolled array -- with the bind host forced to loopback
  // regardless of that function's own 0.0.0.0 default (T-14-09): the fork's
  // HTTP endpoint is unauthenticated full machine control, exactly like the
  // binary monitor, and this test asserts the bind stayed loopback below.
  const argv = buildViceArgs(port, { backend: "fork", mcpHost: "127.0.0.1" });

  const child = spawn(resolvedBinPath, argv, {
    stdio: "ignore",
    env: { ...process.env, XDG_CONFIG_HOME: scratchDir },
  });
  child.once("error", (err) => {
    console.error(`fork-live.test.ts: spawned emulator process error: ${String(err)}`);
  });

  const url = `http://127.0.0.1:${port}/mcp`;
  try {
    await waitForEndpointReady(url);
  } catch (err) {
    // T-14-11: teardown must run even when setup itself fails partway.
    child.kill("SIGKILL");
    rmSync(scratchDir, { recursive: true, force: true });
    throw err;
  }

  // Redirect the ONE shared transport seam at the live endpoint. epochFile
  // points at a path that will never exist in this scratch dir -- this
  // fixture owns no broker/supervisor, so readEpoch() is expected to report
  // "absent", which it does without throwing (test 6 below).
  useInstance({ port, url, epochFile: join(scratchDir, "epoch.json") });

  fixture = { child, scratchDir, argv, url };
});

after(async () => {
  if (!fixture) return;
  const { child, scratchDir } = fixture;
  fixture = null;
  child.kill("SIGKILL");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  rmSync(scratchDir, { recursive: true, force: true });
});

function requireFixture(): LiveFixture {
  if (!fixture) {
    throw new Error("fork-live.test.ts: fixture is not initialised -- SKIP_REASON should have prevented this test from running at all");
  }
  return fixture;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test(
  "fork-live: the spawned argv binds -mcpserverhost to loopback, never all-interfaces (T-14-09)",
  { skip: SKIP_REASON },
  () => {
    const { argv } = requireFixture();
    const hostFlagIndex = argv.indexOf("-mcpserverhost");
    assert.ok(hostFlagIndex >= 0, `spawned argv must contain -mcpserverhost, got: ${JSON.stringify(argv)}`);
    const boundHost = argv[hostFlagIndex + 1];
    assert.equal(boundHost, "127.0.0.1", `-mcpserverhost must be exactly 127.0.0.1, got "${boundHost}"`);
    assert.ok(
      !argv.includes("0.0.0.0"),
      `spawned argv must not bind to the all-interfaces address, got: ${JSON.stringify(argv)}`,
    );
  },
);

test(
  "fork-live: serverInfo() lists every vice_* tool the committed manifest names",
  { skip: SKIP_REASON },
  async () => {
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(join(import.meta.dirname, "tools-manifest.json"), "utf8")) as {
      tools: Array<{ name: string }>;
    };
    const manifestNames = new Set(manifest.tools.map((t) => t.name).filter((n) => n.startsWith("vice_")));
    assert.ok(
      manifestNames.size >= 50,
      `tools-manifest.json's vice_* name set must be non-vacuous (>=50) -- got ${manifestNames.size}. An empty ` +
        `or mis-parsed manifest must fail loudly here, not pass silently.`,
    );

    const info = (await serverInfo()) as { tools?: Array<{ name: string }> };
    assert.ok(Array.isArray(info.tools), `serverInfo() must return a tools array, got: ${JSON.stringify(info)}`);
    const liveNames = new Set(info.tools!.map((t) => t.name));

    const missingFromLive = [...manifestNames].filter((n) => !liveNames.has(n));
    assert.deepEqual(
      missingFromLive,
      [],
      `the manifest names vice_* tools the LIVE server does not offer: ${missingFromLive.join(", ")}`,
    );

    const extraLiveVice = [...liveNames].filter((n) => n.startsWith("vice_") && !manifestNames.has(n));
    const deletedSet = new Set(DELIBERATELY_DELETED_FORK_TOOLS);
    const deliberatelyDeleted = extraLiveVice.filter((n) => deletedSet.has(n));
    const genuinelyUnexpected = extraLiveVice.filter((n) => !deletedSet.has(n));

    if (deliberatelyDeleted.length > 0) {
      console.log(
        `fork-live: the live server still offers ${deliberatelyDeleted.join(", ")}, which the manifest ` +
          `deliberately omits (D-16: deleted with no consumer anywhere in the repo, a documented single ` +
          `exception to BACK-02, reconciled in ROADMAP.md) -- this is NOT staleness. Regenerating the ` +
          `manifest against this live server would silently re-add it; fork-manifest-surface.test.ts's own ` +
          `count and name assertions are what would catch that if it ever happened.`,
      );
    }
    if (genuinelyUnexpected.length > 0) {
      console.log(
        `fork-live: the live server offers vice_* tool(s) the committed manifest lacks (a real finding, ` +
          `not asserted as failure -- the manifest is generated by refresh-manifest.ts from a live server): ` +
          `${genuinelyUnexpected.join(", ")}`,
      );
    }
  },
);

test("fork-live: vice_ping resolves with a non-empty payload", { skip: SKIP_REASON }, async () => {
  const result = (await call("vice_ping")) as unknown;
  console.log(`fork-live: vice_ping -> ${JSON.stringify(result)}`);
  assert.ok(result !== null && result !== undefined, "vice_ping must resolve to a non-empty payload");
  if (typeof result === "object") {
    assert.ok(Object.keys(result as Record<string, unknown>).length > 0, "vice_ping's object payload must not be empty");
  } else if (typeof result === "string") {
    assert.ok(result.length > 0, "vice_ping's string payload must not be empty");
  }
});

test("fork-live: vice_registers_get resolves and carries a program counter", { skip: SKIP_REASON }, async () => {
  const result = (await call("vice_registers_get")) as Record<string, unknown>;
  console.log(`fork-live: vice_registers_get -> ${JSON.stringify(result)}`);
  const registers = (result.registers ?? result) as Record<string, unknown>;
  // Resolved from THIS run's own answer -- never a hardcoded id/name.
  const pcKey = Object.keys(registers).find((k) => k.toUpperCase() === "PC");
  assert.ok(pcKey, `vice_registers_get's payload must carry a PC entry, got keys: ${Object.keys(registers).join(", ")}`);
  assert.equal(typeof registers[pcKey!], "number", `PC must be a number, got ${typeof registers[pcKey!]}`);
});

test(
  "fork-live: vice_sid_get_state resolves and returns SID state -- the load-bearing FORK-02 hard-loss assertion",
  { skip: SKIP_REASON },
  async () => {
    const result = (await call("vice_sid_get_state")) as Record<string, unknown>;
    console.log(`fork-live: vice_sid_get_state -> ${JSON.stringify(result)}`);
    assert.ok(result !== null && typeof result === "object", "vice_sid_get_state must resolve to an object payload");
    assert.ok(Object.keys(result).length > 0, "vice_sid_get_state's payload must not be empty");
  },
);

test("fork-live: beginSession()/readEpoch() parse against the live instance without throwing", { skip: SKIP_REASON }, () => {
  const session = beginSession();
  console.log(`fork-live: beginSession() -> ${JSON.stringify(session)}`);
  assert.ok(session.baseline, "beginSession() must return a baseline");
  // No broker/supervisor owns this fixture's epoch file, so it is expected
  // to be reported absent -- the point of this test is that readEpoch()
  // parses that state cleanly (never throws), not that a value exists.
  const epoch = readEpoch(session.epochPath);
  console.log(`fork-live: readEpoch(${session.epochPath}) -> ${JSON.stringify(epoch)}`);
  assert.equal(epoch.present, false, "no broker/supervisor owns this fixture's epoch file -- it must report absent, not throw");
});
