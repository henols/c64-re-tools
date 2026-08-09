#!/usr/bin/env node
// The project's checkpoint-synchronisation primitives -- the third module in
// this skill, alongside tools/vice.mjs (the resilient transport seam) and
// vice-probe.mjs (the deliberately-fragile liveness probe). Those two must
// never be merged, for the reasons vice-probe.mjs's own header already
// records; synchronisation is a third such job -- different concern, own
// module, structurally isolated. Land here cold and know not to fold this
// into either of them: the seam retries transport failures until a call
// eventually succeeds, the probe answers one fast yes/no question, and this
// module decides WHERE in emulated time the machine stops and therefore what
// bytes become a captured artifact -- a different, load-bearing job from
// either.
//
// Three measurements shaped every function below. Re-verify them against
// .planning/STATE.md rather than trusting this comment if they ever need
// re-checking:
//   - `vice_execution_run` is the call the host server dies on -- six
//     outages in one session, the last three all on that call. The resume
//     count is therefore the risk every wait here minimises.
//   - `vice_ping` is the one call measured NON-pausing -- 986,693 cycles/s
//     while ping-polling versus 991,569 fully quiet. Every other
//     state-reading vice_* call pauses the emulator and does not resume it.
//   - The machine is usually ALREADY paused when a checkpoint is armed
//     (every checkpoint stop leaves it paused, and every state read pauses
//     it), which is why every wait keys on the checkpoint's own hit count
//     rather than on whether execution is paused.
//
// Three invariants a maintainer must not break:
//   1. Exactly one resume (`vice_execution_run`) per wait.
//   2. Never poll on whether execution is paused -- poll on the
//      checkpoint's own `hit_count`.
//   3. Never delete a checkpoint VICE marked `temporary`.
//
// These three invariants are also precisely why 01.6.1-06 cannot cover
// readCheckpoint()/waitCheckpointHit()/runToCheckpoint()/reset()/
// screenshot() with a unit test: each is only meaningful against a real
// emulator's timing (a stub server answering fast and deterministically
// would prove nothing about a resume count or a hit_count race), and
// mcp__vice__* is this project's only permitted route to that emulator --
// a test process cannot open its own connection (CLAUDE.md's hard rule).
// vice-sync.test.ts records this as five named `todo` entries rather than
// faking it with a stub. Everything else below (addrNum, hex4, the two
// timing constants, the armedCheckpoints tracker) is pure or near-pure and
// IS covered for real.
//
// `tryHostPaths` (used by screenshot() below) comes from the sibling
// `devcontainer-host-path` skill -- and that is not a new dependency this
// module introduces. This module tree's own resource-deployment path already
// pulls it in: `vice.mjs` statically imports `repo-root.ts`, which statically
// imports `install-resources.ts`, which imports
// `../../skills/devcontainer-host-path/scripts/hostpath.mjs` -- a mandatory
// edge on every entry into this tree. screenshot() is simply its second
// consumer. A future maintainer should neither believe this module introduced
// that edge nor "fix" it by hand-rolling a second path translator.
//
// This module's OWN `repo-root.ts` import (below) is new as of 01.6.1-02
// (RESEARCH §3.4 Option B): hostpath.ts no longer resolves the workspace
// root itself, so every caller of tryHostPaths()/hostPath() now threads it
// through explicitly. vice-sync.mjs is NOT a member of the repo-root cycle
// (repo-root.ts -> install-resources.ts -> hostpath.ts -> repo-root.ts)
// -- it only calls repoRoot() lazily, inside screenshot(), well after every
// cycle member has already finished evaluating -- but this import is exactly
// the kind of fresh route load-order.test.ts's module-scope call-site guard
// (Part 3, added in 01.6.1-02) exists to police: a future top-level,
// unguarded `repoRoot()` call added here would rebuild the TDZ hazard by a
// new path even though the three-module cycle itself is gone.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { call } from "./vice.ts";
import { tryHostPaths } from "./hostpath.ts";
import { repoRoot } from "./repo-root.ts";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Normalise an address to a number, accepting either a number or a string in
 * "$08B1" / "08B1" / "0x08B1" form. Addresses cross a JSON boundary (the
 * registry stores them as "$08B1" strings for human readability) and a raw
 * hex4() over a string silently produces "$$08B1", which VICE rejects with
 * "invalid hex address" -- so every address entering a vice_* call goes
 * through here first.
 */
export function addrNum(a: number | string): number {
  if (typeof a === "number") return a;
  if (typeof a === "string") {
    const s = a.trim().replace(/^\$/, "").replace(/^0x/i, "");
    const n = parseInt(s, 16);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`addrNum: cannot interpret ${JSON.stringify(a)} as an address`);
}

export const hex4 = (n: number | string): string => `$${addrNum(n).toString(16).toUpperCase().padStart(4, "0")}`;

// Each poll cycle is: read state (which PAUSES the machine), resume, then let
// it run for one window. The window is not idle waiting -- it is the only
// interval in which the emulated CPU actually advances, so a short window
// starves the machine and the trigger appears to "never fire". A KERNAL cold
// boot plus a turbo-loader disk load needs tens of emulated seconds.
//
// Progressively longer run windows, in ms. Rationale, and it is not just about
// speed: a `stop:true` checkpoint halts the machine exactly at the trigger
// whether we notice 2 seconds later or 30, so POLLING FREQUENCY HAS NO EFFECT
// ON WHERE THE MACHINE STOPS. Polling rarely is therefore strictly better --
// identical determinism, an order of magnitude fewer monitor enter/exit
// transitions. That matters because the host server has dropped its connection
// five times in one session, always during a monitor transition
// (`vice_execution_run` or checkpoint work), so transition count is the one
// risk factor we control. This schedule spans ~150s of emulated running in 8
// round-trips instead of ~60.
//
// Typed as a readonly array (01.6.1-06): a later mutation (push/splice/index
// assignment) is now a compile error rather than a silent runtime change to
// a timing contract other code reasons about.
export const POLL_WINDOWS_MS: readonly number[] = [3000, 6000, 12000, 20000, 25000, 28000, 28000, 28000];
// How often to ask `vice_ping` whether the machine has stopped yet. Ping is
// free (it does not pause the machine), so this only costs a round-trip.
export const PING_INTERVAL_MS: number = 1000;

// NOTE: a `waitPaused()` helper used to live here, polling vice_ping until
// execution reported "paused". It is deliberately DELETED, not kept "just in
// case". It was wrong in a way that produced a silently-wrong capture point:
// the machine is normally ALREADY paused when we arm a checkpoint (every
// checkpoint stop leaves it paused, and every state read pauses it), so the
// poll returned instantly without any transition having occurred, and the
// caller then read hit_count 0 and either refused or captured from the wrong
// place. Wait on the checkpoint's own hit_count instead -- see
// waitCheckpointHit below. Do not reintroduce a paused-poll.

/** The shape of one entry from vice_checkpoint_list/vice_checkpoint_add --
 * loosely typed (`start` accepts either form addrNum() itself accepts,
 * unknown fields pass through) since this module only ever reads
 * checkpoint_num/start/hit_count/temporary off it, never asserts a closed
 * shape. */
export interface Checkpoint {
  checkpoint_num: number;
  start?: number | string;
  hit_count?: number;
  temporary?: boolean;
  [key: string]: unknown;
}

// Checkpoints this harness itself armed for its own reasons (a boot gate, the
// dump trigger), tracked here so assertSameMachine()'s checkpoint-fallback
// probe (D-3) has something to check when no supervisor epoch file exists --
// the ONLY identity signal available in that case. This costs no NEW
// checkpoints: arming a sentinel checkpoint purely for identity-probing was
// rejected because checkpoint work is itself one of the two leading crash
// suspects recorded in STATE.md's HAZARD CANDIDATE entry. Added on
// vice_checkpoint_add success, removed on successful vice_checkpoint_delete.
//
// A SINGLETON object, not a bare Set and not a factory: there is one machine
// per process, and both this module's runToCheckpoint() and
// tools/recover.mjs's capture() -- which deliberately hand-rolls its own
// arm/wait/delete so it can interleave the identity check and the held-key
// release between the wait and the delete -- must register ids in the same
// place. One source of truth, both callers writing through one door.
const armedCheckpointIds = new Set<number>();

export interface ArmedCheckpointTracker {
  track(id: number): void;
  untrack(id: number): void;
  ids(): number[];
  clear(): void;
}

export const armedCheckpoints: ArmedCheckpointTracker = {
  track(id: number): void {
    armedCheckpointIds.add(id);
  },
  untrack(id: number): void {
    armedCheckpointIds.delete(id);
  },
  ids(): number[] {
    return [...armedCheckpointIds];
  },
  clear(): void {
    armedCheckpointIds.clear();
  },
};

/**
 * Arm an exec checkpoint at `addr`, resume, and wait for the machine to stop
 * ON THAT CHECKPOINT -- verified via its own hit_count, not inferred from the
 * mere fact that execution paused. Returns the checkpoint id so the caller can
 * delete it; leaving stale checkpoints armed would contaminate the next stage.
 *
 * This is the project's one synchronisation primitive. Every wait in this file
 * is a checkpoint hit, never an elapsed duration -- a duration cannot be
 * re-armed, and success criterion 1's byte-identical claim depends on the stop
 * point being re-armable.
 *
 * NOT unit-tested (01.6.1-06): needs a real emulator's vice_checkpoint_list
 * to exercise meaningfully; see vice-sync.test.ts's named todo entry.
 */
export async function readCheckpoint(cpId: number | null, addr: number): Promise<Checkpoint | undefined> {
  const { checkpoints } = (await call("vice_checkpoint_list", {})) as { checkpoints: Checkpoint[] };
  return (
    checkpoints.find((c) => c.checkpoint_num === cpId) ||
    checkpoints.find((c) => c.start !== undefined && addrNum(c.start) === addr)
  );
}

/**
 * Wait for a checkpoint using exactly ONE resume.
 *
 * `vice_execution_run` is the call this host server dies on -- six outages in
 * one session, the last three all on that call -- so the resume count is the
 * risk we minimise. The lever is a measurement from the speed trials:
 * `vice_ping` does NOT pause the machine (ping-polling sustained 986,693
 * cycles/s against 991,569 for a completely quiet machine), whereas
 * `vice_checkpoint_list` does. So we can watch progress with ping, for free,
 * and resume only once instead of once per window -- an ~8x cut in the
 * offending call.
 *
 * Order matters and is the fix for an earlier bug: check hit_count BEFORE
 * resuming (the machine is often already stopped on the checkpoint, and blindly
 * resuming would run straight past the dump point), then resume, then wait for
 * `paused`, then CONFIRM via hit_count that the stop was actually this
 * checkpoint rather than something else.
 *
 * NOT unit-tested (01.6.1-06): the exactly-one-resume and poll-on-hit_count
 * invariants only mean something against a real emulator's timing; see
 * vice-sync.test.ts's named todo entry.
 */
export async function waitCheckpointHit(cpId: number | null, addr: number, label: string): Promise<Checkpoint> {
  // Already fired? Then we are standing on the trigger -- never resume past it.
  const pre = await readCheckpoint(cpId, addr);
  if (pre && (pre.hit_count ?? 0) >= 1) return pre;

  await call("vice_execution_run", {}); // the single resume
  const budgetMs = POLL_WINDOWS_MS.reduce((a, b) => a + b, 0);
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    await sleep(PING_INTERVAL_MS);
    const p = (await call("vice_ping", {})) as { execution?: string };
    if (p.execution !== "paused") continue;
    const cp = await readCheckpoint(cpId, addr);
    if (cp && (cp.hit_count ?? 0) >= 1) return cp;
    // Paused for some other reason: resume and keep waiting. Rare, and we
    // deliberately do not treat a bare pause as the trigger.
    await call("vice_execution_run", {});
  }
  // Deadline passed -- one last read before giving up, in case the checkpoint
  // fired between the final ping and now.
  const last = await readCheckpoint(cpId, addr);
  if (last && (last.hit_count ?? 0) >= 1) return last;

  throw new Error(
    `waitCheckpointHit(${label} ${hex4(addr)}): checkpoint never fired within ${budgetMs / 1000}s. ` +
      `vice_run_until's cycles argument is documented as "not yet implemented" so there is no ` +
      `server-side timeout backing this. Recovery is a HOST-SIDE restart, which this container ` +
      `cannot perform -- run tools/vice-launcher.sh on the HOST; its on-demand broker launches a ` +
      `boot-fresh instance, supervises it, and respawns a crashed one with backoff, logging the ` +
      `crash for the still-open root-cause investigation (see .planning/STATE.md).`
  );
}

/** NOT unit-tested (01.6.1-06): composes readCheckpoint()/waitCheckpointHit()
 * against a real emulator; see vice-sync.test.ts's named todo entry. */
export async function runToCheckpoint(addr: number, label: string): Promise<{ id: number | null; hitCount?: number }> {
  const added = (await call("vice_checkpoint_add", { start: hex4(addr), exec: true, stop: true })) as {
    checkpoint_num?: number;
    checkpoint?: { checkpoint_num?: number };
  };
  const id = added.checkpoint_num ?? added.checkpoint?.checkpoint_num ?? null;
  if (id != null) armedCheckpoints.track(id);
  // No resume here: waitCheckpointHit owns the single resume, so that the
  // vice_execution_run count stays at exactly one per wait.
  const cp = await waitCheckpointHit(id, addr, label);
  if (id != null) {
    await call("vice_checkpoint_delete", { checkpoint_num: id });
    armedCheckpoints.untrack(id);
  }
  return { id, hitCount: cp.hit_count };
}

/**
 * The clean-slate ritual, and a step of `recover` -- not an optional
 * courtesy. No bulk-clear checkpoint tool exists, so each returned id is
 * enumerated and deleted individually.
 *
 * NOT unit-tested (01.6.1-06): the never-delete-a-temporary-checkpoint
 * invariant needs a real emulator's own `temporary` checkpoint flag; see
 * vice-sync.test.ts's named todo entry.
 */
export async function reset(): Promise<void> {
  // Any checkpoint id tracked from a PRIOR run in this same process (e.g.
  // reproduce()'s second recover() call) is no longer valid once we're about
  // to delete every checkpoint the server knows about -- clear it here so a
  // later assertSameMachine() probe never gets tripped up by a stale id.
  armedCheckpoints.clear();
  const { checkpoints } = (await call("vice_checkpoint_list", {})) as { checkpoints: Checkpoint[] };
  for (const cp of checkpoints) {
    // Never delete a checkpoint VICE marked `temporary`: those are created and
    // auto-reaped by vice_run_until, so by the time we enumerate them the id
    // may already be gone, and deleting a stale id is one of the two leading
    // suspects for the host-server crashes recorded in STATE.md. Leave them to
    // the hard reset, which clears them anyway.
    if (cp.temporary) continue;
    try {
      await call("vice_checkpoint_delete", { checkpoint_num: cp.checkpoint_num });
    } catch (e) {
      console.error(`warn: checkpoint_delete ${cp.checkpoint_num} failed (continuing): ${(e as Error).message}`);
    }
  }
  for (const unit of [8, 9, 10, 11]) {
    try {
      await call("vice_disk_detach", { unit });
    } catch (e) {
      console.error(`warn: disk_detach unit ${unit} failed (continuing): ${(e as Error).message}`);
    }
  }
  await call("vice_machine_reset", { mode: "hard", run_after: false });
}

/**
 * VICE writes screenshots itself, on the HOST -- so the path handed to
 * vice_display_screenshot must be a host path, exactly like the one handed to
 * vice_disk_attach. Passing the container path silently fails with
 * "Failed to save screenshot".
 *
 * NOT unit-tested (01.6.1-06): needs a real emulator to prove the host-path
 * translation actually lands a screenshot; see vice-sync.test.ts's named
 * todo entry.
 */
export async function screenshot(containerPath: string): Promise<string> {
  mkdirSync(dirname(containerPath), { recursive: true });
  const { hostPath } = await tryHostPaths(
    containerPath,
    (p: string) => call("vice_display_screenshot", { path: p }),
    { workspaceRoot: repoRoot() }
  );
  return hostPath;
}
