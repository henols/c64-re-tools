#!/usr/bin/env node
// -----------------------------------------------------------------------------
// proof04-oracle-memmap.mjs -- Phase 44, plan 44-01. The ORACLE producer.
//
// WHAT IT IS FOR
// --------------
// PROOF-04 needs an independent, external check of dxa's byte-derived
// classification -- an oracle that never saw dxa's guess. This script drives
// a genuine, direct-spawned stock `/usr/bin/x64sc` through the same
// S3 frame-anchored AUTOSTART sequence EVID-06 already proved does not
// perturb the capture at anchor hit depths of 50 or below, dials
// `memmapshow` after the anchor stop, and writes the parsed access map as
// `EvidExecRow[]`-shaped observation rows. It never touches dxa, the
// byte-derived block classifier, or the annotation store -- that is the
// SUBJECT producer's exclusive domain (`proof04-subject-dxa.mjs`), and
// Criterion 2 requires the two to be structurally independent.
//
// FIXED INPUTS, IDENTICAL TO SCHEMA.md SECTION 1
// -----------------------------------------------
// Binary `/usr/bin/x64sc` (genuine unpatched stock, VICE 3.9 -- the fork at
// `/usr/local/bin/x64sc` shadows a bare `x64sc` and is never launched here).
// Release `danish.d64`, sha256
// `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`, entry
// `BRUCE LEE   (DC)`. Argv from `buildProbeArgs()` including
// `STOCK_DETERMINISM_FLAGS` unmodified, seed `4242`.
//
// THE SEQUENCE, FIXED BEFORE ANY RUN, NO ADDITIONS
// --------------------------------------------------
// preflight() -> allocPorts() -> buildProbeArgs() -> spawnVice() -> connect
// binary monitor (retry, pingReady) -> connect text monitor (retry) -> dial
// `memmapzap` inside `withTextChannelLock` during the halted pre-AUTOSTART
// window -> `armStoppingExec` at $ea31 -> AUTOSTART runAfter:true fileIndex:0
// -> assert via CheckpointList the anchor survived the power cycle ->
// countHits to the target -> sleep the 300ms text-settle window -> dial
// `memmapshow` inside `withTextChannelLock` -> `parseAccessMap` the reply.
// Arm exactly the ONE stopping Exec checkpoint at the frame anchor and
// nothing else. Never send RESET anywhere -- AUTOSTART is the only reset.
// Never take a DUMP -- this phase compares no captures.
//
// TWO DELIBERATE DIVERGENCES FROM `evid06-instrumentation-ab.mjs`'s
// `takeRun()`, BOTH REQUIRED BY SUCCESS CRITERION 3
// -------------------------------------------------------------------
//   1. A short run must NOT throw. Where `takeRun()` raises when `countHits`
//      reports `reached: false`, this producer records `ORACLE_DEPTH_REACHED`
//      as the hits actually observed, sets `ORACLE_SHORT_RUN true`, and
//      CONTINUES to the `memmapshow` read -- the answer over what was
//      reached, with the depth named, is the required outcome. Only
//      `ORACLE_DEPTH_REACHED` of `0` selects `not-exercised` (SCHEMA.md
//      section 3).
//   2. A `parseAccessMap` refusal is surfaced, never absorbed. Prints
//      `ORACLE_PARSE_REFUSAL` carrying the refusal's own code, line number
//      and offending line, writes no artifact, and exits non-zero -- a
//      drifted or malformed reply must never become a valid zero-entry map.
//
// IMPORT BOUNDARY (Criterion 2), CLOSED
// --------------------------------------
// This module imports ONLY `node:` builtins, `probe-harness.mjs`,
// `text-protocol.ts`, `textmon-memmap.ts`, `stock-protocol.ts` and
// `evid-ingest.ts`. It must NEVER import `dxa-run.ts`, `dxa-partition.ts`,
// `block-class.ts`, or any annotation-store module (`anno-store.ts`,
// `anno-tools.ts`), and it must never name the subject artifact's own
// basename (`subject-dxa.json`) anywhere outside a comment.
// -----------------------------------------------------------------------------
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const PHASE39_EVIDENCE = path.join(
  REPO_ROOT,
  ".planning",
  "phases",
  "39-the-dual-channel-coexistence-gate-go-degrade-no-go",
  "evidence",
);

const harness = await import(path.join(PHASE39_EVIDENCE, "probe-harness.mjs"));
const textProto = await import(path.join(MCP_DIR, "text-protocol.ts"));
const memmap = await import(path.join(MCP_DIR, "textmon-memmap.ts"));
const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const evidIngest = await import(path.join(MCP_DIR, "evid-ingest.ts"));

const {
  preflight,
  allocPorts,
  buildProbeArgs,
  spawnVice,
  connectWithRetry,
  pingReady,
  armStoppingExec,
  reapAll,
  ViceMonitorClient,
  VICE_STOCK,
  viceKind,
  viceVersion,
  sleep,
} = harness;
const { TextMonitorClient, withTextChannelLock } = textProto;
const { parseAccessMap } = memmap;
const { CommandType } = proto;
const { ingestAccessMap } = evidIngest;

// --- fixed inputs (SCHEMA.md section 1) --------------------------------------

const RELEASE_SHA256_EXPECTED = "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5";
const SEED = "4242";
const FRAME_ANCHOR = 0xea31;

/** Never inside the checkout, never `/tmp`. */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase44");

/** README.md's corpus-resolution convention, re-asserted independently of
 * the subject producer (T-44-01): `$C64_CORPUS_DIR` if set, else the
 * repo-relative Phase 23 corpus path. */
function resolveCorpusPath() {
  const envDir = process.env.C64_CORPUS_DIR;
  const candidateEnv = envDir ? path.resolve(envDir, "danish.d64") : null;
  const candidateRepo = path.join(
    REPO_ROOT,
    ".planning",
    "phases",
    "23-the-real-release-gate-go-degrade-no-go",
    "evidence",
    "corpus",
    "danish.d64",
  );
  const attempted = [];
  if (candidateEnv) {
    attempted.push(candidateEnv);
    try {
      return { path: candidateEnv, bytes: fs.readFileSync(candidateEnv) };
    } catch {
      // fall through
    }
  }
  attempted.push(candidateRepo);
  try {
    return { path: candidateRepo, bytes: fs.readFileSync(candidateRepo) };
  } catch {
    throw new Error(
      `proof04-oracle-memmap.mjs: danish.d64 not found at either attempted path: ${attempted.join(", ")}`,
    );
  }
}

/** Fresh, per-label XDG_CONFIG_HOME under this plan's cache dir. Removed and
 * recreated per run, DISPLAY/WAYLAND_DISPLAY stripped. */
function bootEnv(label) {
  const xdg = path.join(PROBE_DIR, "xdg", label);
  fs.rmSync(xdg, { recursive: true, force: true });
  fs.mkdirSync(xdg, { recursive: true });
  const env = { ...process.env, XDG_CONFIG_HOME: xdg };
  delete env.DISPLAY;
  delete env.WAYLAND_DISPLAY;
  return env;
}

/** Count `target` hits of checkpoint `cpId`, resuming EXACTLY once per
 * observed hit. Unlike `evid06-instrumentation-ab.mjs`'s own `countHits()`,
 * this NEVER throws on a short run -- it resolves `{ reached, hits }` and
 * lets the caller decide, per this script's own stated divergence 1. */
function countHits(client, cpId, target, { budgetMs = 180000 } = {}) {
  return new Promise((resolve) => {
    let last = 0;
    const resume = () => {
      client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
    };
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const onEvent = (frame) => {
      if (frame.type === "jam") {
        finish({ reached: false, hits: last, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
        return;
      }
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      last = frame.checkpoint.hitCount;
      if (last >= target) {
        finish({ reached: true, hits: last, reason: null });
        return;
      }
      resume();
    };
    const timer = setTimeout(
      () => finish({ reached: false, hits: last, reason: `budget ${budgetMs} ms exhausted at ${last} of ${target} hits` }),
      budgetMs,
    );
    client.on("event", onEvent);
    resume();
  });
}

function parseArgs(argv) {
  const out = { depth: 10, label: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--depth" && argv[i + 1]) out.depth = Number(argv[++i]);
    else if (argv[i] === "--label" && argv[i + 1]) out.label = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out.out = path.resolve(argv[++i]);
  }
  if (!out.label) out.label = `depth-${out.depth}`;
  if (!out.out) out.out = path.join(PROBE_DIR, out.label, "oracle-memmap.json");
  return out;
}

async function takeOracleRun({ depth, label, outPath }) {
  // Sequence step 1, fixed by SCHEMA.md / this script's own header: preflight
  // first, before anything else -- refuses in code, never by habit.
  const preflightResult = preflight();
  console.log(`ORACLE_BROKER_STATE ${preflightResult.broker}`);

  const { path: corpusPath, bytes: releaseBytes } = resolveCorpusPath();
  const releaseSha256 = createHash("sha256").update(releaseBytes).digest("hex");
  if (releaseSha256 !== RELEASE_SHA256_EXPECTED) {
    throw new Error(
      `proof04-oracle-memmap.mjs: release identity REFUSAL: ${corpusPath} digests to ${releaseSha256}, expected ${RELEASE_SHA256_EXPECTED}`,
    );
  }
  console.log(`ORACLE_RELEASE_SHA256 ${releaseSha256}`);

  const kind = viceKind(VICE_STOCK);
  if (kind !== "stock") {
    throw new Error(`proof04-oracle-memmap.mjs: viceKind(${VICE_STOCK}) reported "${kind}", expected "stock" -- refusing`);
  }
  console.log(`ORACLE_VICE_BINARY ${VICE_STOCK}`);
  console.log(`ORACLE_VICE_VERSION ${viceVersion(VICE_STOCK)}`);

  const { binaryPort, textPort } = await allocPorts();
  const args = buildProbeArgs({ binaryPort, textPort });
  const fullArgv = [VICE_STOCK, ...args];
  console.log(`ORACLE_SPAWN_ARGV ${JSON.stringify(fullArgv)}`);
  spawnVice(VICE_STOCK, args, { env: bootEnv(label) });

  const binClient = new ViceMonitorClient();
  const textClient = new TextMonitorClient();

  let depthReached = 0;
  let shortRun = true;
  let mapEntries = 0;
  let parseRefusalCode = "none";
  let ingestResult = null;

  try {
    await connectWithRetry(binClient, binaryPort);
    await pingReady(binClient);
    await connectWithRetry(textClient, textPort);

    // Dial memmapzap while the machine is still halted from launch, BEFORE
    // AUTOSTART.
    await withTextChannelLock(`${label}-zap`, () => textClient.command("memmapzap"));

    // Arm exactly the ONE stopping Exec checkpoint at the frame anchor.
    const armed = await armStoppingExec(binClient, { address: FRAME_ANCHOR });
    const cpId = armed.checkpoint.id;

    // AUTOSTART -- this IS the reset. No RESET appears anywhere.
    await binClient.send(
      CommandType.AutoStart,
      proto.autostartBody({ runAfter: true, fileIndex: 0, filename: corpusPath }),
      { timeoutMs: 60000 },
    );

    // Assert the anchor survived AUTOSTART's power cycle.
    const survived = await binClient.send(CommandType.CheckpointList, Buffer.alloc(0));
    if (survived.total === 0) {
      throw new Error(`${label}: the frame anchor did not survive AUTOSTART's power cycle`);
    }

    const counted = await countHits(binClient, cpId, depth);
    depthReached = counted.hits;
    shortRun = !counted.reached;
    console.log(`ORACLE_DEPTH_TARGET ${depth}`);
    console.log(`ORACLE_DEPTH_REACHED ${depthReached}`);
    console.log(`ORACLE_SHORT_RUN ${shortRun}`);
    console.log(`ORACLE_DEPTH_LABEL ${depthReached <= 50 ? "frame-exact-region" : "narrowed"}`);

    if (depthReached === 0) {
      // not-exercised branch: the emulator never reached the anchor stop at
      // all. Still dial memmapshow so the record is honest about what was
      // (not) captured, but nothing downstream treats this as coverage.
      console.log("ORACLE_MAP_ENTRIES 0");
      console.log("ORACLE_EXEC_OBSERVATIONS 0");
      console.log(`ORACLE_PARSE_REFUSAL ${parseRefusalCode}`);
      return;
    }

    const TEXT_SETTLE_MS = 300;
    await sleep(TEXT_SETTLE_MS);
    let parsed;
    await withTextChannelLock(`${label}-show`, async () => {
      const reply = await textClient.command("memmapshow");
      parsed = parseAccessMap(reply);
    });

    if (!parsed.ok) {
      parseRefusalCode = parsed.refusal.code;
      console.log(
        `ORACLE_PARSE_REFUSAL ${parseRefusalCode} line=${parsed.refusal.lineNumber} offending=${JSON.stringify(parsed.refusal.line)} message=${JSON.stringify(parsed.refusal.message)}`,
      );
      process.exitCode = 1;
      return;
    }

    mapEntries = parsed.value.entries.length;
    console.log(`ORACLE_MAP_ENTRIES ${mapEntries}`);
    console.log(`ORACLE_PARSE_REFUSAL ${parseRefusalCode}`);
    console.log(`ORACLE_SEED ${SEED}`);

    ingestResult = ingestAccessMap(parsed, { imageSha256: releaseSha256, argv: fullArgv, seed: SEED });
    if (!ingestResult.ok) {
      throw new Error(`proof04-oracle-memmap.mjs: ingestAccessMap refused: ${ingestResult.message}`);
    }
    console.log(`ORACLE_ARGV_DIGEST ${ingestResult.runIdentity.argvDigest}`);
    console.log(`ORACLE_EXEC_OBSERVATIONS ${ingestResult.observations.length}`);
  } finally {
    await textClient.disconnect().catch(() => {});
    try {
      binClient.disconnect?.();
    } catch {
      // best-effort
    }
    reapAll();
  }

  if (!ingestResult) return;

  // Rows are EvidExecRow-shaped: the join reads only `address` and
  // `sourceBank` from each -- `id`/`imageSha256`/`argvDigest`/`seed` travel
  // for provenance only.
  const observations = ingestResult.observations.map((obs, i) => ({
    id: i + 1,
    imageSha256: ingestResult.runIdentity.imageSha256,
    argvDigest: ingestResult.runIdentity.argvDigest,
    seed: ingestResult.runIdentity.seed,
    address: obs.address,
    sourceBank: obs.sourceBank,
  }));

  const artifact = {
    label,
    depthTarget: depth,
    depthReached,
    shortRun,
    parseRefusal: parseRefusalCode,
    observations,
  };
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, artifactBytes);
  const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
  console.log(`ORACLE_ARTIFACT_SHA256 ${artifactSha256}`);
  console.log(`ORACLE_ARTIFACT_PATH ${outPath}`);
}

async function main() {
  const { depth, label, out } = parseArgs(process.argv.slice(2));
  await takeOracleRun({ depth, label, outPath: out });
}

await main();
