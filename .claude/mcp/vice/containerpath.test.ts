// node:test coverage for containerpath.ts -- the host->container inverse
// beside hostpath.ts (D-7). Every test here is guard-removal-sensitive
// (D-6): each one is written so it fails if the property it covers is
// removed, not merely absent from a description.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { hostPath } from "./hostpath.ts";
import {
  hostRootCandidates,
  containerPath,
  containerPathCandidates,
  containerHost,
  containerizeRecord,
} from "./containerpath.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "containerpath.ts");
// Same derivation containerpath.ts itself uses (env-first, else four
// levels up from this directory) -- not a second, possibly-diverging guess.
const CONTAINER_WS = process.env.CONTAINER_WORKSPACE_PATH || resolve(HERE, "..", "..", "..", "..");

function firstNonInternalIPv4(): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

// ---------------------------------------------------------------- round-trip

test("round-trip: containerPath(hostPath(p)) === p, for the workspace root, a .vice-supervisor path, and an ordinary file", () => {
  const cases = [
    CONTAINER_WS,
    join(CONTAINER_WS, ".vice-supervisor", "6520", "epoch.json"),
    join(CONTAINER_WS, ".claude", "CLAUDE.md"),
  ];
  for (const p of cases) {
    const h = hostPath(p);
    assert.notEqual(
      h,
      p,
      `hostPath(${p}) must actually translate in this environment for this round-trip to be meaningful`
    );
    assert.equal(containerPath(h), p, `containerPath(hostPath(${p})) must equal ${p}`);
  }
});

// -------------------------------------------------------------------- D-3

test("D-3: containerpath.ts's own source contains no literal of the runtime-derived host root", () => {
  const { roots } = hostRootCandidates();
  assert.ok(roots.length > 0, "hostRootCandidates() must return at least one root in this environment");
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.ok(
    !source.includes(roots[0]),
    `containerpath.ts's source must not contain the runtime-derived host root (${roots[0]}) as a literal`
  );
});

// ---------------------------------------------------------- real captured grant

test("the real captured grant: all three fields translate independently, three separate assertions", () => {
  const [hostRoot] = hostRootCandidates().roots;
  const grant = {
    id: "req-842411-1785573565561-c2cef69e",
    port: 6520,
    url: "http://127.0.0.1:6520/mcp",
    epoch_file: `${hostRoot}/.vice-supervisor/6520/epoch.json`,
    supervisor_dir: `${hostRoot}/.vice-supervisor/6520`,
    granted_at: "2026-08-01T08:39:26Z",
  };
  const alias = "host.docker.internal";
  const { record, changes } = containerizeRecord(grant, {
    pathFields: ["epoch_file", "supervisor_dir"],
    urlFields: ["url"],
    alias,
  });

  // Three separate expectations -- translating two fields and forgetting the
  // third must fail this test, not just the aggregate `changes.length` below.
  assert.equal(record.url, `http://${alias}:6520/mcp`, "url host must become the alias");
  assert.equal(
    record.epoch_file,
    join(CONTAINER_WS, ".vice-supervisor", "6520", "epoch.json"),
    "epoch_file must become the container form"
  );
  assert.equal(
    record.supervisor_dir,
    join(CONTAINER_WS, ".vice-supervisor", "6520"),
    "supervisor_dir must become the container form"
  );
  assert.equal(changes.length, 3, "all three fields must be reported as changed");
  assert.equal(grant.url, "http://127.0.0.1:6520/mcp", "the input record must not be mutated");
});

// -------------------------------------------------------------- loopback matrix

test("loopback matrix: every loopback form rewrites to the alias, port and path preserved; every non-loopback form and non-URL string passes through byte-identical", () => {
  const alias = "host.docker.internal";
  const loopbackUrls = [
    "http://127.0.0.1:6520/mcp",
    "http://127.5.9.3:6520/mcp",
    "http://localhost:6520/mcp",
    "http://[::1]:6520/mcp",
  ];
  for (const u of loopbackUrls) {
    const rewritten = containerHost(u, alias);
    assert.ok(rewritten.includes(alias), `${u} must be rewritten to the alias`);
    assert.ok(rewritten.includes(":6520"), `${u}'s port must be preserved`);
    assert.ok(rewritten.endsWith("/mcp"), `${u}'s path must be preserved`);
  }

  const eth0 = firstNonInternalIPv4();
  assert.ok(eth0, "this environment must have a non-internal IPv4 address for this assertion to be meaningful");
  const passthroughUrls = [
    "http://host.docker.internal:6520/mcp",
    `http://${eth0}:6520/mcp`,
    "http://10.0.5.2:6520/mcp",
  ];
  for (const u of passthroughUrls) {
    assert.equal(containerHost(u, alias), u, `${u} is not loopback and must be returned byte-identical`);
  }

  assert.equal(
    containerHost("not a url at all", alias),
    "not a url at all",
    "an unparseable string must be returned byte-identical"
  );
});

// ------------------------------------------------------------------ passthrough

test("passthrough: a /tmp-rooted path matching no known host root is left byte-identical, with a reason", () => {
  const tmpPath = "/tmp/some-broker-dir/6520/epoch.json";

  assert.throws(() => containerPath(tmpPath), /does not match any known host root/);

  const { record, changes, untranslated } = containerizeRecord(
    { epoch_file: tmpPath },
    { pathFields: ["epoch_file"], urlFields: [], alias: "host.docker.internal" }
  );
  assert.equal(record.epoch_file, tmpPath, "a path matching no known host root must be left byte-identical");
  assert.equal(changes.length, 0, "no change should be reported for an untranslatable path");
  assert.equal(untranslated.length, 1);
  assert.equal(untranslated[0].field, "epoch_file");
  assert.ok(untranslated[0].reason && untranslated[0].reason.length > 0, "the untranslated entry must carry a reason");
});

// -------------------------------------------------------------- record purity

test("record purity: containerizeRecord() never mutates its input, tolerates missing/non-string fields, and reports changes/untranslated as arrays", () => {
  const input = { epoch_file: 12345, url: undefined, port: 6520 }; // non-string, undefined, unrelated
  const before = JSON.stringify(input);

  const result = containerizeRecord(input, {
    pathFields: ["epoch_file", "supervisor_dir"], // supervisor_dir absent entirely
    urlFields: ["url"],
    alias: "host.docker.internal",
  });

  assert.equal(JSON.stringify(input), before, "containerizeRecord() must never mutate its input record");
  assert.ok(Array.isArray(result.changes));
  assert.ok(Array.isArray(result.untranslated));
  assert.equal(result.changes.length, 0);
  assert.equal(
    result.untranslated.length,
    0,
    "absent/non-string fields must be silently skipped, never reported as untranslated"
  );
  assert.equal(result.record.port, 6520, "unrelated fields must be carried through unchanged");

  // Never throws, even called with no record at all.
  assert.doesNotThrow(() => containerizeRecord(undefined, { pathFields: ["x"], urlFields: ["y"], alias: "a" }));
});

// ----------------------------------------------------------------- CLI check

test("containerPathCandidates: non-absolute input returns no candidates with a reason", () => {
  const { candidates, reason } = containerPathCandidates("relative/looking/string");
  assert.equal(candidates.length, 0);
  assert.ok(reason && reason.length > 0);
});
