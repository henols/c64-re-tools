#!/usr/bin/env node
// broker-harness.ts
//
// Phase 65 (SEAM-01, D-01): a minimal, TEST-ONLY harness that spawns a REAL,
// compiled broker (`resources/vice-broker.mjs`) on a freshly allocated port
// and a fresh, throwaway `VICE_BROKER_HOME`, and resolves once the broker
// actually answers a `hello` -- never on a fixed sleep. This is the tracer's
// own end-to-end verify's own dependency: host-tool-endpoint.test.ts's
// acme.build case needs a REAL broker on the other end of a REAL socket to
// prove the whole path, not a stub.
//
// THIS MODULE MUST NEVER APPEAR IN package.json's `files[]` -- it is a
// test-only helper (mirrors `acme-gate.ts`'s own posture), and it spawns the
// COMPILED artifact under bare `node`, never the TypeScript source, the same
// precedent `broker-e2e.test.ts`'s own `startBroker()` already established.
//
// WHAT NOT TO DO:
//   - Never poll on a fixed sleep as the readiness signal. `dialBrokerEndpoint()`
//     against the real candidate is the ONLY readiness proof this module
//     accepts.
//   - Never bind or dial port 19510 (the production default) from this
//     module or its own tests -- every broker this harness starts gets a
//     freshly allocated port (`VICE_BROKER_CONTROL_PORT`), read back from
//     the kernel, never the fixed default.
//   - Never write the double-quoted tools-dir literal in this file --
//     repo-root.test.ts's own census counts it, and this module has no
//     legitimate reason to reference that directory at all.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dialBrokerEndpoint } from "./broker-endpoint.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BROKER_ARTIFACT = join(HERE, "resources", "vice-broker.mjs");

/** Allocates a free TCP port by binding to 127.0.0.1 port 0, reading back
 * whatever the kernel assigned, then closing -- never a hardcoded or
 * fixed-default port (see this file's own header). There is a narrow window
 * between this function returning and the harness's own spawn binding the
 * SAME port, but that window is inherent to "ask the kernel for a free
 * port, then hand it to a child process" and is the same shape
 * `broker-e2e.test.ts`'s own env (`VICE_BROKER_CONTROL_PORT: "0"`) avoids by
 * letting the CHILD pick its own port -- this harness instead picks the
 * port itself, because `startHarnessBroker()`'s own caller needs to know
 * the port BEFORE the child has started, to dial it. */
async function allocateFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : null;
      server.close(() => {
        if (port === null) {
          reject(new Error("broker-harness: could not read back an allocated port"));
          return;
        }
        resolvePort(port);
      });
    });
  });
}

async function waitFor(predicate: () => Promise<boolean> | boolean, deadlineMs: number, pollMs = 25): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= deadline) return await predicate();
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

export interface StartHarnessBrokerOptions {
  /** Defaults to `resources/vice-broker.mjs` beside this file -- the
   * COMPILED artifact, never the `.mts` source. */
  brokerArtifact?: string;
  /** Passed as `--repo-root` when present; omitted from argv entirely
   * otherwise (BROKER-01/BROKER-06: `--repo-root` is optional). */
  repoRoot?: string;
  /** How long to wait for the broker to answer a `hello` before giving up. */
  readyTimeoutMs?: number;
  /** How many times to retry with a freshly allocated port when the child
   * exits early naming the port as already in use. */
  maxPortRetries?: number;
  /** Extra environment for the BROKER process only (e.g. `ACME: ""` to make
   * the broker's own ACME library lookup come up empty). Applied after the
   * inherited environment and before the harness's own keys. */
  env?: Record<string, string>;
}

export interface HarnessBroker {
  port: number;
  home: string;
  pid: number;
  /** A copy of `process.env` with `VICE_BROKER_CONTROL_PORT` set to this
   * harness's own allocated port -- for a spawned CLIENT (e.g. a CLI
   * subprocess under test) that must dial this exact broker. */
  childEnv: NodeJS.ProcessEnv;
  stop(): Promise<void>;
}

/** Spawns a real, compiled broker on a freshly allocated port and a fresh
 * `mkdtempSync` `VICE_BROKER_HOME`, and resolves once `dialBrokerEndpoint()`
 * against `127.0.0.1:<port>` completes a real handshake -- never on a fixed
 * sleep. Retries once with a fresh port if the child exits early naming the
 * port as already in use (a rare collision between `allocateFreePort()`'s
 * own bind-then-close and the child's own bind); any OTHER early exit
 * rejects with the child's own stderr tail. */
export async function startHarnessBroker(options: StartHarnessBrokerOptions = {}): Promise<HarnessBroker> {
  const brokerArtifact = options.brokerArtifact ?? DEFAULT_BROKER_ARTIFACT;
  const readyTimeoutMs = options.readyTimeoutMs ?? 10_000;
  const maxPortRetries = options.maxPortRetries ?? 3;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxPortRetries; attempt++) {
    const port = await allocateFreePort();
    const home = mkdtempSync(join(tmpdir(), "vice-broker-harness-"));

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      VICE_BROKER_HOME: home,
      VICE_BROKER_CONTROL_PORT: String(port),
      VICE_SUPERVISOR_ALLOW_CONTAINER: "1",
    };
    delete env.VICE_POOL_DIR;
    delete env.VICE_BROKER_CONTROL_DIAL_HOST;

    const argv = options.repoRoot !== undefined ? [brokerArtifact, "--repo-root", options.repoRoot] : [brokerArtifact];
    const child = spawn(process.execPath, argv, { env }) as ChildProcessWithoutNullStreams;

    let stderrTail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail += chunk.toString("utf8");
    });

    let exitedEarly = false;
    let exitInfo: { code: number | null; signal: NodeJS.Signals | null } = { code: null, signal: null };
    child.once("exit", (code, signal) => {
      exitedEarly = true;
      exitInfo = { code, signal };
    });

    const ready = await waitFor(async () => {
      if (exitedEarly) return true; // stop waiting -- the caller below classifies the exit
      const dialResult = await dialBrokerEndpoint({ port, candidates: ["127.0.0.1"] });
      return dialResult.ok;
    }, readyTimeoutMs);

    if (exitedEarly) {
      rmSync(home, { recursive: true, force: true });
      const portInUse = /EADDRINUSE/i.test(stderrTail);
      if (portInUse && attempt < maxPortRetries) {
        lastError = new Error(`broker-harness: port ${port} was already in use, retrying with a fresh port`);
        continue;
      }
      throw new Error(
        `broker-harness: broker exited early (code=${exitInfo.code ?? "null"}, signal=${exitInfo.signal ?? "null"}) before answering a hello -- stderr tail:\n${stderrTail}`,
      );
    }

    if (!ready) {
      child.kill("SIGKILL");
      rmSync(home, { recursive: true, force: true });
      throw new Error(`broker-harness: broker did not answer a hello within ${readyTimeoutMs}ms -- stderr tail:\n${stderrTail}`);
    }

    const childEnv: NodeJS.ProcessEnv = { ...process.env, VICE_BROKER_CONTROL_PORT: String(port) };

    return {
      port,
      home,
      pid: child.pid ?? -1,
      childEnv,
      stop: async (): Promise<void> => {
        if (child.exitCode !== null || child.signalCode !== null) {
          rmSync(home, { recursive: true, force: true });
          return;
        }
        child.kill("SIGTERM");
        const exited = await waitFor(() => child.exitCode !== null || child.signalCode !== null, 3000);
        if (!exited) {
          child.kill("SIGKILL");
          await waitFor(() => child.exitCode !== null || child.signalCode !== null, 2000);
        }
        rmSync(home, { recursive: true, force: true });
      },
    };
  }

  throw lastError ?? new Error("broker-harness: exhausted port retries");
}
