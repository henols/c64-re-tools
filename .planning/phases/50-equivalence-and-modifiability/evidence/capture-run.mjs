#!/usr/bin/env node
// capture-run.mjs -- Phase 50 plan 50-04 Task 2/3 live capture driver.
//
// WHY THIS FILE EXISTS
// --------------------
// Plan 50-04's live half must load a committed .prg into a running stock VICE
// by route-d (the text monitor's own `load` verb, LOAD-ROUTE.md), stop it at a
// named logical checkpoint, and capture a full 64K image plus a chip-state
// sidecar in the SAME paused window. The obvious route -- call the `vice_*`
// MCP tools one at a time from an agent session -- could not be taken, for one
// measured reason:
//
//   The broker's release path is KILL-NEVER-RECYCLE. `handleRelease()`
//   (vice-broker.mts) calls verifiedKill() and deleteInstanceRecord() on the
//   granted instance. The connection IS the lease, so a process that acquires,
//   loads a program, and then exits DESTROYS the machine it just loaded into.
//   A split "script loads, MCP session captures" flow therefore cannot work:
//   the second acquire gets a freshly booted machine with no program in it.
//
// So the whole sequence -- load, checkpoint, run, capture, delete, resume --
// must happen inside ONE held lease, in ONE process. This file is that process.
//
// It does NOT reimplement any tool. It calls `dispatchStock()`, the project's
// own dispatch seam (stock-dispatch.ts), with the same deps object
// vice-proxy.ts's own `dispatchStockFor()` builds. Every emulator operation
// therefore runs through exactly the shipped handler the MCP tool of the same
// name would have run. The only thing this file supplies that vice-proxy.ts
// would otherwise have supplied is the lease provider, built from
// vice-broker-client.ts's own EXPORTED control-plane API
// (`openBrokerControl()` / `session.acquire()`) -- not a re-derived broker
// protocol.
//
// A SECOND, INDEPENDENT REASON this route was necessary: `vice_program_load`
// was added to `tools-manifest.stock.json` in commit 494b512c. An already
// running MCP server process reads that manifest exactly once, at startup, so
// the agent session driving this plan could not see or call that tool at all.
// Dispatch does not consult the manifest, so calling `dispatchStock()`
// in-process reaches the shipped handler regardless. This is route 2 of the
// two routes 50-04-SUMMARY.md names, taken through the dispatch seam rather
// than through a raw TextMonitorClient, which is strictly closer to "the
// sanctioned tool surface" than driving the socket by hand.
//
// PLAN 50-05 CHANGED EXACTLY ONE THING about the sequence below: which
// committed subject is loaded. `vice_program_load` now selects one member of
// text-protocol.ts's closed HAZARD_SUBJECT_PRG_BASENAMES table by ENUMERATED
// ID (still never a caller-supplied filename), so this script takes
// --subject-id and passes it through. Every emulator step -- the ping retry,
// the route-d load, the checkpoint, the PC set, the resume, the poll, the
// capture, the deletion, the enumeration and the single final resume -- is
// unchanged, in the same order, through the same dispatchStock() seam. That
// is what makes a capture taken here comparable with plan 50-04's.
//
// WHAT NOT TO DO: do not add a second acquire anywhere in this file, and do
// not release between the load and the capture. Both would destroy the machine
// mid-run (see the kill-never-recycle note above).

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const VICE_DIR = join(REPO_ROOT, "src", "mcp", "vice");

const { openBrokerControl, brokerRootDir } = await import(join(VICE_DIR, "vice-broker-client.ts"));
const { dispatchStock } = await import(join(VICE_DIR, "stock-dispatch.ts"));
const { isInsideContainer } = await import(join(VICE_DIR, "container-guard.mts"));
const { hazardSubjectPrgPath, isHazardSubjectId, HAZARD_SUBJECT_IDS } = await import(join(VICE_DIR, "text-protocol.ts"));

// ---------------------------------------------------------------- args

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const LABEL = arg("label", "a");
const OUT_DIR = arg("out-dir", join(HERE, "captures"));
const CHECKPOINT_NAME = arg("checkpoint-name", "hazard_raster_entry");
const CHECKPOINT_ADDR = Number(arg("checkpoint-address", "0"));
const ENTRY_ADDR = Number(arg("entry-address", "0"));

// WHICH SUBJECT (plan 50-05). Plan 50-04 loaded one committed fixture and
// this script took its path as a string. text-protocol.ts now carries a
// CLOSED id -> path table, and `vice_program_load` selects by id, so this
// script takes the ID and derives the path from that same table. That is
// deliberate and load-bearing: a separate --subject path argument alongside
// an id could disagree with what the emulator actually loaded, and the
// sha256 recorded in the bundle would then attest to the WRONG binary --
// silently, in a document that later becomes evidence. One source, no
// possible disagreement. An omitted id is "original", exactly plan 50-04's
// behaviour.
const SUBJECT_ID = arg("subject-id", "original");
if (!isHazardSubjectId(SUBJECT_ID)) {
  throw new Error(`--subject-id must be one of ${HAZARD_SUBJECT_IDS.join(", ")} (got ${JSON.stringify(SUBJECT_ID)})`);
}
if (process.argv.includes("--subject")) {
  throw new Error("--subject (a path) is refused: pass --subject-id instead, so the loaded file and the recorded sha256 cannot disagree");
}
const SUBJECT_PRG = hazardSubjectPrgPath(SUBJECT_ID);

// The snapshot's own scratch name. Defaults to exactly the string plan 50-04
// used, so an unchanged invocation still produces an unchanged name; a
// non-original subject passes its own, because a .vsf called
// "phase50-original-…" holding the regressed twin would misdescribe itself
// in the one place a reader looks to check what was captured.
const SNAPSHOT_NAME = arg("snapshot-name", `phase50-original-${LABEL}`);

if (!Number.isInteger(CHECKPOINT_ADDR) || CHECKPOINT_ADDR <= 0) {
  throw new Error("--checkpoint-address is required and must be a positive integer (read it from a real ACME --symbollist run)");
}
if (!Number.isInteger(ENTRY_ADDR) || ENTRY_ADDR <= 0) {
  throw new Error("--entry-address is required and must be a positive integer (read it from a real ACME --symbollist run)");
}

const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");

// ---------------------------------------------------------------- log

const LOG = [];
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function note(line) {
  const s = `[${stamp()}] ${line}`;
  console.log(s);
  LOG.push({ at: stamp(), kind: "note", text: line });
}

function textOf(result) {
  return (result?.content ?? []).map((c) => c.text).join("\n");
}

// ---------------------------------------------------------------- lease

const opened = await openBrokerControl();
if (!opened.ok) throw new Error(`openBrokerControl failed: ${opened.kind} ${opened.message ?? ""}`);
const session = opened.session;

const acquired = await session.acquire();
if (!acquired.ok) {
  await session.release();
  throw new Error(`acquire failed: ${acquired.kind} ${acquired.message ?? ""}`);
}
const grant = acquired.grant;

// This process is the CONSUMER, and on this host it is also the HOST -- there
// is no container (container-guard.mts's own five-signal detector says so, and
// it is asserted rather than assumed here). vice-proxy.ts would otherwise run
// the grant through containerizeGrant() at this point; with no container split
// that translation is identity, and asserting the precondition is honest where
// silently skipping it would not be.
const inContainer = isInsideContainer();
if (inContainer) {
  await session.release();
  throw new Error(
    "capture-run.mjs is running inside a container. It uses the grant's host-local coordinates directly, " +
      "which is only valid on a host-developed checkout. Route the grant through vice-proxy.ts's " +
      "containerizeGrant() seam before using this script in a container.",
  );
}
note(`container detected: ${inContainer} (grant coordinates used as-is)`);

const lease = {
  host: new URL(grant.url).hostname.replace(/^\[(.+)\]$/, "$1"),
  port: grant.port,
  targetId: grant.id,
  brokerControl: session,
  epochFile: grant.epoch_file,
  supervisorDir: brokerRootDir(),
  ...(grant.remote_monitor_port === undefined ? {} : { remoteMonitorPort: grant.remote_monitor_port }),
};

note(`grant ${grant.id} url=${grant.url} binary-port=${grant.port} text-port=${grant.remote_monitor_port ?? "(none)"}`);

const deps = { ensureLease: async () => ({ ok: true, lease }) };

// ---------------------------------------------------------------- call

async function call(name, args = {}, { allowError = false } = {}) {
  const at = stamp();
  const result = await dispatchStock(name, args, deps);
  const text = textOf(result);
  const entry = { at, kind: "call", tool: name, args, isError: Boolean(result?.isError), text };
  LOG.push(entry);
  console.log(`\n[${at}] CALL ${name} ${JSON.stringify(args)}`);
  console.log(text.length > 4000 ? text.slice(0, 4000) + `\n… (${text.length} bytes total)` : text);
  if (result?.isError && !allowError) {
    throw new Error(`${name} failed: ${text}`);
  }
  return { result, text };
}

function parseJsonish(text) {
  try {
    return JSON.parse(text);
  } catch {
    const i = text.indexOf("{");
    const j = text.lastIndexOf("}");
    if (i !== -1 && j > i) {
      try {
        return JSON.parse(text.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

let exitCode = 0;
try {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. The machine answers at all. The broker issues the grant as soon as it
  //    has SPAWNED x64sc, which is before x64sc has bound its binary-monitor
  //    port -- measured here as `connect ECONNREFUSED 127.0.0.1:6600` on a
  //    ping sent in the same second as the launch log line. So the first ping
  //    is retried until the emulator is actually listening; a connect refusal
  //    during this window is a booting machine, not a wedge.
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const p = await call("vice_ping", {}, { allowError: true });
    if (!p.result?.isError) {
      ready = true;
      note(`emulator answered vice_ping on attempt ${i + 1}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error("emulator never answered vice_ping within 30s of the grant");

  // 2. Route-d: the text monitor's own `load` verb, device 0 (host filesystem).
  //    No filename is passed -- the committed fixture path is baked into the
  //    verb's own frozen identity in text-protocol.ts.
  await call("vice_program_load", { device: 0, subject: SUBJECT_ID });

  // 3. Arm the logical checkpoint, execute-break, stopping enabled.
  const cpAdd = await call("vice_checkpoint_add", { start: hex4(CHECKPOINT_ADDR), exec: true, stop: true });

  // 4. The text-monitor `load` places the bytes but never starts the program,
  //    and it does not update BASIC's end-of-program pointers, so `RUN` has
  //    nothing valid to run. The machine-code entry point is set directly
  //    instead. Both addresses come from the SAME real ACME --symbollist run
  //    (see the transcript); neither is transcribed by hand.
  await call("vice_registers_set", { register: "PC", value: ENTRY_ADDR });
  await call("vice_registers_get");

  // 5. Resume and wait for the checkpoint to trap.
  await call("vice_execution_run");

  let hit = false;
  let pingText = "";
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const p = await call("vice_ping", {}, { allowError: true });
    pingText = p.text;
    const list = await call("vice_checkpoint_list", {}, { allowError: true });
    if (/"hitCount"\s*:\s*[1-9]/.test(list.text)) {
      hit = true;
      note(`checkpoint reports a hit on poll ${i + 1}`);
      break;
    }
    if (/stopped|paused/i.test(pingText) && i > 2) {
      note(`ping reports a stopped machine on poll ${i + 1}; checking registers`);
      const r = await call("vice_registers_get", {}, { allowError: true });
      if (r.text.includes(CHECKPOINT_ADDR.toString(16).toUpperCase()) || r.text.includes(String(CHECKPOINT_ADDR))) {
        hit = true;
        break;
      }
    }
  }
  if (!hit) throw new Error(`checkpoint at ${hex4(CHECKPOINT_ADDR)} never reported a hit after 40 polls`);

  // 6. Capture in the SAME paused window. Snapshot route first.
  const snapName = SNAPSHOT_NAME;
  const snap = await call("vice_snapshot_save", {
    name: snapName,
    description: `Phase 50 ${CHECKPOINT_NAME} capture ${LABEL} (subject ${SUBJECT_ID})`,
  });

  // 7. Chip state, same paused window.
  const vicii = await call("vice_vicii_get_state");
  const sprites = await call("vice_sprite_get", {}, { allowError: true });
  const regs = await call("vice_registers_get");
  const m0001 = await call("vice_memory_read", { address: "$0001", size: 1 });
  const mdd00 = await call("vice_memory_read", { address: "$DD00", size: 1 });
  const md018 = await call("vice_memory_read", { address: "$D018", size: 1 });

  // 8. Remove the checkpoint and ENUMERATE the removal. The enumeration is the
  //    proof, not the delete call's own say-so (c64-ram-capture/SKILL.md).
  const cpDoc = parseJsonish(cpAdd.text);
  const cpNumber = cpDoc?.id ?? cpDoc?.checkpoint_number ?? cpDoc?.number ?? null;
  if (cpNumber !== null) {
    await call("vice_checkpoint_delete", { checkpoint_num: cpNumber }, { allowError: true });
  } else {
    note("checkpoint_add did not report a number in a shape this script recognises -- see its raw text in the log");
  }
  const listAfter = await call("vice_checkpoint_list", {}, { allowError: true });

  // 9. Resume once, at the end.
  await call("vice_execution_run", {}, { allowError: true });

  const subjectSha = createHash("sha256").update(readFileSync(SUBJECT_PRG)).digest("hex");

  const bundle = {
    label: LABEL,
    subject_id: SUBJECT_ID,
    checkpoint_name: CHECKPOINT_NAME,
    checkpoint_address: CHECKPOINT_ADDR,
    entry_address: ENTRY_ADDR,
    subject_prg: SUBJECT_PRG,
    subject_prg_sha256: subjectSha,
    snapshot: parseJsonish(snap.text),
    vicii: parseJsonish(vicii.text),
    sprites: parseJsonish(sprites.text),
    cpu: parseJsonish(regs.text),
    port01_raw: m0001.text,
    dd00_raw: mdd00.text,
    d018_raw: md018.text,
    checkpoint_list_after_delete: listAfter.text,
  };
  writeFileSync(join(OUT_DIR, `run-${LABEL}.bundle.json`), JSON.stringify(bundle, null, 2) + "\n");
  note(`wrote run-${LABEL}.bundle.json`);
} catch (err) {
  exitCode = 1;
  note(`FAILED: ${err.message}`);
} finally {
  writeFileSync(join(OUT_DIR, `run-${LABEL}.log.json`), JSON.stringify(LOG, null, 2) + "\n");
  note(`wrote run-${LABEL}.log.json`);
  await session.release();
  note("lease released (this kills the instance -- kill-never-recycle)");
}

process.exit(exitCode);
