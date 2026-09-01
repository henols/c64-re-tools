#!/usr/bin/env node
// measure-stdio-multiplexing.mjs -- plan 19-01 task 3 (D18-16). Answers, by
// measurement against the real binary, whether the external analyser's
// `--mcp-server-stdio` handler multiplexes concurrent requests or reads its
// stdin serially. D18-16 deferred a reader-writer upgrade of
// `anno-session.ts`'s coarse FIFO mutex "pending measurement"; this is that
// measurement.
//
// THE SHAPE THAT MAKES THE ANSWER MEAN SOMETHING: both requests are written
// in ONE burst, back to back, into the child's stdin pipe -- so both are
// sitting in the child's own buffer simultaneously before it has answered
// either. Anything less (write, await, write) would measure THIS client's
// serialism, not the child's. A trivial `anno_get_binary_info` queued behind
// a long `anno_batch_execute` either comes back in single-digit milliseconds
// (the child multiplexes) or cannot come back until the batch finishes (it
// does not).
//
// Usage: node measure-stdio-multiplexing.mjs
//   ANNO_BIN                    -- binary to spawn (default: The external analyser)
//   ANNO_MEASURE_INNER_CALLS    -- inner calls in the slow batch (default 3000)
//
// Prints EXACTLY ONE JSON line on stdout. Exits non-zero with an explicit
// `{"ok": false, "reason": ...}` when the binary cannot be spawned or a
// response never arrives -- so a future re-run can never record an assumed
// result. Every wait below is explicitly bounded; nothing polls unbounded.
//
// Deliberately NOT named `*.test.*`: `ci-suite-coverage.test.ts` collects the
// `src/mcp/vice` suite by that glob, and this is a measurement driver, not a
// test. The two Phase 18 drivers established the same convention.
//
// The child is spawned with an argv ARRAY, never a shell string, and its
// stdout is read as untrusted text (parsed as JSON, never evaluated).
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Bound on the initialize handshake. Generous; the handshake is trivial. */
const INIT_BOUND_MS = 15_000;
/** Settle time between `notifications/initialized` and the burst, so the
 * measurement is not racing the child's own startup. Matches the ~400ms the
 * Phase 19 research runs used. */
const SETTLE_MS = 400;
/** Bound on both burst responses arriving. The slow batch is deliberately
 * expensive (each inner call triggers a re-analysis inside the child), so
 * this must comfortably exceed the observed 6-14s. */
const BURST_BOUND_MS = 180_000;

const bin = process.env.ANNO_BIN || "the external analyser";
const innerCalls = Number(process.env.ANNO_MEASURE_INNER_CALLS || 3000);

/** Origin and payload of the scratch project: NOPs terminated by RTS, the
 * same trivially-analysable shape Phase 18's drivers used. */
const ORIGIN = 0x0810;
const PAYLOAD_BYTES = 8192;

function fail(reason) {
  console.log(JSON.stringify({ ok: false, reason, bin }));
  process.exitCode = 1;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!Number.isInteger(innerCalls) || innerCalls < 1) {
    fail(`ANNO_MEASURE_INNER_CALLS must be a positive integer, got "${process.env.ANNO_MEASURE_INNER_CALLS}"`);
    return;
  }

  let versionOutput;
  try {
    versionOutput = execFileSync(bin, ["--version"], { encoding: "utf8", timeout: 15_000 }).trim();
  } catch (err) {
    fail(`cannot spawn "${bin} --version": ${err && err.message ? err.message : String(err)}`);
    return;
  }

  const annoProjectPath = join(HERE, "..", "..", "..", "..", "src", "mcp", "vice", "anno-project.ts");
  const { synthesizeProject } = await import(pathToFileURL(annoProjectPath).href);

  const dir = mkdtempSync(join(tmpdir(), "d18-16-stdio-mux-"));
  const projectPath = join(dir, "measure.regen2000proj");
  const payload = new Uint8Array(PAYLOAD_BYTES).fill(0xea);
  payload[payload.length - 1] = 0x60; // RTS
  writeFileSync(projectPath, synthesizeProject(payload, { origin: ORIGIN }));

  const spawnedAt = Date.now();
  const child = spawn(bin, ["--mcp-server-stdio", projectPath], { stdio: ["pipe", "pipe", "pipe"] });

  const cleanup = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    rmSync(dir, { recursive: true, force: true });
  };

  let spawnError = null;
  child.on("error", (err) => {
    spawnError = err;
  });

  /** id -> { id, arrivedAtMs (relative to spawn), isError } for every
   * response line the child emits. */
  const arrivals = new Map();
  const waiters = new Map();

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const arrivedAtMs = Date.now() - spawnedAt;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return; // untrusted text: a non-JSON line is not a response
    }
    if (parsed === null || typeof parsed !== "object" || parsed.id === undefined) return;
    const record = {
      id: String(parsed.id),
      arrivedAtMs,
      isError: Boolean(parsed.error) || Boolean(parsed.result && parsed.result.isError),
    };
    arrivals.set(record.id, record);
    const waiter = waiters.get(record.id);
    if (waiter) {
      waiters.delete(record.id);
      waiter(record);
    }
  });

  function send(obj) {
    child.stdin.write(JSON.stringify(obj) + "\n");
  }

  function awaitResponse(id, boundMs, label) {
    const known = arrivals.get(id);
    if (known) return Promise.resolve(known);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(id);
        reject(new Error(`${label} (id ${id}) produced no response within ${boundMs}ms`));
      }, boundMs);
      waiters.set(id, (record) => {
        clearTimeout(timer);
        resolve(record);
      });
    });
  }

  try {
    if (spawnError) throw new Error(`spawn failed: ${spawnError.message}`);

    send({
      jsonrpc: "2.0",
      id: "INIT",
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "d18-16-measure", version: "0" } },
    });
    await awaitResponse("INIT", INIT_BOUND_MS, "initialize");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });

    await sleep(SETTLE_MS);

    // The burst. Both request lines are concatenated into a SINGLE write, so
    // both sit in the child's stdin pipe before it has answered either.
    const calls = [];
    for (let i = 0; i < innerCalls; i += 1) {
      calls.push({
        name: "anno_set_comment",
        arguments: { address: ORIGIN + (i % (PAYLOAD_BYTES - 1)), comment: `d18-16 probe ${i}`, type: "line" },
      });
    }
    const slow = {
      jsonrpc: "2.0",
      id: "SLOW-BATCH",
      method: "tools/call",
      params: { name: "anno_batch_execute", arguments: { calls } },
    };
    const fast = {
      jsonrpc: "2.0",
      id: "FAST-INFO",
      method: "tools/call",
      params: { name: "anno_get_binary_info", arguments: {} },
    };
    const burstAtMs = Date.now() - spawnedAt;
    child.stdin.write(JSON.stringify(slow) + "\n" + JSON.stringify(fast) + "\n");

    const [slowRec, fastRec] = await Promise.all([
      awaitResponse("SLOW-BATCH", BURST_BOUND_MS, "the slow batch"),
      awaitResponse("FAST-INFO", BURST_BOUND_MS, "the trivial binary-info query"),
    ]);

    // The trivial query was written into the same burst as the slow batch.
    // How long it waited is the whole measurement.
    const fastWaitedMs = fastRec.arrivedAtMs - burstAtMs;
    // The child multiplexes only if the trivial query came back BEFORE the
    // slow batch it was queued behind. Same-millisecond arrival is not
    // multiplexing -- it is the trivial request being handled the instant the
    // batch ahead of it finished.
    const multiplexes = fastRec.arrivedAtMs < slowRec.arrivedAtMs;

    const result = {
      ok: true,
      bin,
      version: versionOutput,
      innerCalls,
      origin: ORIGIN,
      payloadBytes: PAYLOAD_BYTES,
      settleMs: SETTLE_MS,
      burstBoundMs: BURST_BOUND_MS,
      burstWrittenAtMs: burstAtMs,
      responses: [
        { id: slowRec.id, arrivedAtMs: slowRec.arrivedAtMs, isError: slowRec.isError },
        { id: fastRec.id, arrivedAtMs: fastRec.arrivedAtMs, isError: fastRec.isError },
      ],
      fastWaitedMs,
      fastMinusSlowMs: fastRec.arrivedAtMs - slowRec.arrivedAtMs,
      multiplexes,
      verdict: multiplexes ? "multiplexes-concurrent-requests" : "serial-one-request-at-a-time",
      date: new Date().toISOString(),
    };
    console.log(JSON.stringify(result));
  } catch (err) {
    fail(err && err.message ? err.message : String(err));
  } finally {
    rl.close();
    cleanup();
  }
}

main().catch((err) => {
  fail(`driver threw: ${err && err.message ? err.message : String(err)}`);
});
