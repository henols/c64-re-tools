// container-guard.test.ts
//
// Exercises all five container-detection signals in both fired and clear
// states through INJECTED dependencies (ContainerGuardDeps) -- no real
// /proc/1/cgroup or systemd-detect-virt dependency in any fired-signal
// case, per this task's own must_haves. The real-subprocess exit-code
// contract (running the emitted broker artifact directly: exit 2 with no
// escape hatch, exit 3 with --check-container) is covered separately in
// vice-broker-launch.test.ts, alongside the launcher's own container-guard
// tests.
import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateContainerSignals, containerGuardReport, containerGuardEnforce, isInsideContainer, type ContainerGuardDeps } from "./container-guard.mts";

/** A deps fixture with every signal CLEAR by default -- override individual
 * fields per test case so each signal is exercised in isolation. */
function clearDeps(overrides: Partial<ContainerGuardDeps> = {}): ContainerGuardDeps {
  return {
    fileExists: () => false,
    readFile: () => {
      throw new Error("readFile should not be called when fileExists is false");
    },
    env: {},
    runSystemdDetectVirt: () => null,
    ...overrides,
  };
}

/** Captures process.stderr.write for the duration of `fn`, restoring the
 * real implementation afterward -- keeps the FATAL/report text out of test
 * runner output while still letting a test assert on it. */
function captureStderr(fn: () => void): string {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

test("all five signals clear on a deps fixture with nothing fired", () => {
  const signals = evaluateContainerSignals(clearDeps());
  assert.equal(signals.length, 5);
  assert.ok(
    signals.every((s) => !s.fired),
    JSON.stringify(signals),
  );
});

test("signal 1: /.dockerenv exists", () => {
  const deps = clearDeps({ fileExists: (p) => p === "/.dockerenv" });
  const signals = evaluateContainerSignals(deps);
  const sig = signals.find((s) => s.description === "/.dockerenv exists");
  assert.ok(sig?.fired);
});

test("signal 2: /run/.containerenv exists (podman)", () => {
  const deps = clearDeps({ fileExists: (p) => p === "/run/.containerenv" });
  const signals = evaluateContainerSignals(deps);
  const sig = signals.find((s) => s.description === "/run/.containerenv exists (podman)");
  assert.ok(sig?.fired);
});

test("signal 3: CONTAINER_WORKSPACE_PATH is set", () => {
  const deps = clearDeps({ env: { CONTAINER_WORKSPACE_PATH: "/workspaces/bruce_lee" } });
  const signals = evaluateContainerSignals(deps);
  const sig = signals.find((s) => s.description === "CONTAINER_WORKSPACE_PATH is set (this devcontainer sets it)");
  assert.ok(sig?.fired);
  assert.equal(sig?.evidence, "/workspaces/bruce_lee");
});

test("signal 4: systemd-detect-virt --container reports a virtualization technology", () => {
  const deps = clearDeps({ runSystemdDetectVirt: () => "docker" });
  const signals = evaluateContainerSignals(deps);
  const sig = signals.find((s) => s.description === "systemd-detect-virt --container");
  assert.ok(sig?.fired);
  assert.match(sig?.evidence ?? "", /docker/);
});

test("signal 4 stays clear when systemd-detect-virt reports 'none' or the binary is absent", () => {
  const noneSignals = evaluateContainerSignals(clearDeps({ runSystemdDetectVirt: () => "none" }));
  const absentSignals = evaluateContainerSignals(clearDeps({ runSystemdDetectVirt: () => null }));
  assert.ok(!noneSignals.find((s) => s.description === "systemd-detect-virt --container")?.fired);
  assert.ok(!absentSignals.find((s) => s.description === "systemd-detect-virt --container")?.fired);
});

test("signal 5: /proc/1/cgroup path names a container (docker/lxc/kubepods/libpod)", () => {
  const deps = clearDeps({
    fileExists: (p) => p === "/proc/1/cgroup",
    readFile: () => "0::/system.slice/docker-abc123.scope\n",
  });
  const signals = evaluateContainerSignals(deps);
  const sig = signals.find((s) => s.description === "/proc/1/cgroup path names a container");
  assert.ok(sig?.fired);
});

test("signal 5 stays clear for a systemd host's /init.scope and the Docker daemon's own service cgroup", () => {
  const hostDeps = clearDeps({
    fileExists: (p) => p === "/proc/1/cgroup",
    readFile: () => "0::/init.scope\n",
  });
  const daemonDeps = clearDeps({
    fileExists: (p) => p === "/proc/1/cgroup",
    readFile: () => "0::/system.slice/docker.service\n",
  });
  const rootDeps = clearDeps({
    fileExists: (p) => p === "/proc/1/cgroup",
    readFile: () => "0::/\n",
  });
  assert.ok(!evaluateContainerSignals(hostDeps).find((s) => s.description.includes("cgroup"))?.fired);
  assert.ok(!evaluateContainerSignals(daemonDeps).find((s) => s.description.includes("cgroup"))?.fired);
  assert.ok(!evaluateContainerSignals(rootDeps).find((s) => s.description.includes("cgroup"))?.fired);
});

test("containerGuardReport: returns 0 and prints a HOST verdict when every signal is clear", () => {
  let rc = -1;
  const out = captureStderr(() => {
    rc = containerGuardReport(clearDeps());
  });
  assert.equal(rc, 0);
  assert.match(out, /verdict: HOST/);
  // One report line per signal, fired or clear.
  assert.equal((out.match(/\[clear\]|\[FIRED\]/g) ?? []).length, 5);
});

test("containerGuardReport: returns 3 and names the fired signal when one fires", () => {
  const deps = clearDeps({ fileExists: (p) => p === "/.dockerenv" });
  let rc = -1;
  const out = captureStderr(() => {
    rc = containerGuardReport(deps);
  });
  assert.equal(rc, 3);
  assert.match(out, /verdict: CONTAINER/);
  assert.match(out, /\[FIRED\] \/\.dockerenv exists/);
});

test("containerGuardEnforce: returns 0 and writes nothing on a clear host verdict", () => {
  let rc = -1;
  const out = captureStderr(() => {
    rc = containerGuardEnforce(clearDeps());
  });
  assert.equal(rc, 0);
  assert.equal(out, "");
});

test("containerGuardEnforce: returns 2 and writes a FATAL block naming every fired signal when signals fire", () => {
  const deps = clearDeps({ fileExists: (p) => p === "/.dockerenv" || p === "/run/.containerenv" });
  let rc = -1;
  const out = captureStderr(() => {
    rc = containerGuardEnforce(deps);
  });
  assert.equal(rc, 2);
  assert.match(out, /FATAL: vice-broker refuses to run inside a container/);
  assert.match(out, /\/\.dockerenv exists/);
  assert.match(out, /\/run\/\.containerenv exists \(podman\)/);
  assert.match(out, /VICE_SUPERVISOR_ALLOW_CONTAINER=1/);
});

test("containerGuardEnforce: escape hatch VICE_SUPERVISOR_ALLOW_CONTAINER=1 returns 0 even with signals fired", () => {
  const deps = clearDeps({
    fileExists: (p) => p === "/.dockerenv",
    env: { VICE_SUPERVISOR_ALLOW_CONTAINER: "1" },
  });
  let rc = -1;
  const out = captureStderr(() => {
    rc = containerGuardEnforce(deps);
  });
  assert.equal(rc, 0);
  assert.equal(out, "");
});

test("containerGuardEnforce: escape hatch is exact-match only -- any other value still enforces", () => {
  const deps = clearDeps({
    fileExists: (p) => p === "/.dockerenv",
    env: { VICE_SUPERVISOR_ALLOW_CONTAINER: "true" },
  });
  let rc = -1;
  captureStderr(() => {
    rc = containerGuardEnforce(deps);
  });
  assert.equal(rc, 2);
});

// isInsideContainer() -- the environment PREDICATE, as opposed to the two
// refuse-to-run entry points above. Driven entirely through injected deps, so
// neither branch depends on the environment the test itself runs in: the
// non-container branch must be provable from inside this container.

test("isInsideContainer(): false when no signal fires -- the HOST verdict", () => {
  assert.equal(isInsideContainer(clearDeps()), false);
});

test("isInsideContainer(): true when any single signal fires -- the same >=1 rule containerGuardReport()/Enforce() use", () => {
  // One case per signal, so a future change that drops a signal from the
  // predicate's view (without dropping it from the guard's) fails here.
  assert.equal(isInsideContainer(clearDeps({ fileExists: (p) => p === "/.dockerenv" })), true);
  assert.equal(isInsideContainer(clearDeps({ fileExists: (p) => p === "/run/.containerenv" })), true);
  assert.equal(isInsideContainer(clearDeps({ env: { CONTAINER_WORKSPACE_PATH: "/workspaces/bruce_lee" } })), true);
  assert.equal(isInsideContainer(clearDeps({ runSystemdDetectVirt: () => "docker" })), true);
  assert.equal(
    isInsideContainer(
      clearDeps({
        fileExists: (p) => p === "/proc/1/cgroup",
        readFile: () => "0::/docker/abc123\n",
      }),
    ),
    true,
  );
});

test("isInsideContainer(): explicit deps never consult or populate the memoised default verdict, so call order cannot leak", () => {
  // Deliberately alternates. A cache that explicit deps could write to would
  // make the second assertion in each pair return the first's answer.
  for (let i = 0; i < 3; i += 1) {
    assert.equal(isInsideContainer(clearDeps({ runSystemdDetectVirt: () => "docker" })), true);
    assert.equal(isInsideContainer(clearDeps()), false);
  }
});
