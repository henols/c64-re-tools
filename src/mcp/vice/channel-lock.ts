#!/usr/bin/env node
// channel-lock.ts
//
// THE ONE PLACE the cross-channel mutex, its FIFO queue, its holder record
// and its refusal text live. Phase 39's `go` verdict (rule R15) selected an
// in-process async mutex with no narrowing as the shape that serializes
// every halt-taking operation on either monitor channel -- this is that
// primitive, built fresh: there is no async mutex anywhere in this tree, and
// the only prior single-flight queue died with the retired analyser and was
// explicitly not extracted. None of the four pieces this module owns -- the
// mutex, its FIFO queue, its holder record, its refusal text -- may be
// re-derived in stock-dispatch.ts, text-protocol.ts or stock-diagnose.ts.
//
// WHY HAND-BUILT RATHER THAN TAKEN FROM A LIBRARY: a generic mutex (e.g.
// `async-mutex`) grants and releases but exposes no holder record -- it
// cannot answer "who holds this, since when, doing what". This module's
// `ChannelLockHolder` is exactly that record, and it is what makes
// contention readable to `vice_diagnose` (plan 41-04) rather than a bare
// "something is locked". `async-mutex` was considered and rejected by this
// phase's own locked decision; it is never installed, and there is no
// install task in this plan for a package-legitimacy audit to cover.
//
// WHY `MonitorChannel` IS DECLARED HERE A SECOND TIME rather than imported
// from broker-state.mts (which already has an `InstanceRecord.monitorClient`
// concept): broker-state.mts is host-bound and compiled into
// `resources/*.mjs`, so a container-side `.ts` module -- this one -- cannot
// import it at runtime. The shared thing between the two declarations is the
// two-value contract ("binary" | "text"), not the declaration itself --
// exactly as textmon-fixtures.ts reimplements the provenance contract rather
// than importing it from binmon-fixtures.ts.
//
// WHAT NOT TO DO:
//   - Never acquire this lock per wire command in a way that lets a foreign
//     command land between a resume and its checkpoint observation -- the
//     lock is acquired per LOGICAL OPERATION (see stock-dispatch.ts's
//     withChannelLockHeld() and text-protocol.ts's withTextChannelLock()),
//     spanning resume -> wait -> observe. A design that preserves the resume
//     count while destroying what the count protects is a regression, not a
//     variant.
//   - Never import stock-run-until.ts from this module. The derivation
//     comment on CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS below states the
//     relationship to RUN_UNTIL_MAX_TIMEOUT_MS in prose; importing it here
//     would invert the dependency, with the primitive importing a consumer.
//     channel-lock.test.ts cross-imports both files to assert the
//     inequality instead.
//   - Never resolve a waiter's timeout through a second admission path.
//     Both the grant-on-free branch and the enqueue branch below run
//     through one internal function (admit()) so there is exactly one place
//     a caller is ever granted the lock.
//   - Never hand the lock to the next waiter through a `setTimeout` on
//     release -- that would let timer scheduling perturb arrival order.
//     release() hands off synchronously, in the same tick.

// ---------------------------------------------------------------------------
// MonitorChannel -- the two-value contract, declared here (see header).
// ---------------------------------------------------------------------------

/** Exactly two channels exist and a third is not anticipated -- stock VICE
 * exposes precisely the binary monitor and the `-remotemonitor` text
 * channel, and this project has no plan to add a third. Frozen so a
 * consumer cannot accidentally push a third value onto it at runtime. */
export const MONITOR_CHANNELS = Object.freeze(["binary", "text"] as const);

export type MonitorChannel = (typeof MONITOR_CHANNELS)[number];

// ---------------------------------------------------------------------------
// The holder record and the lock handle.
// ---------------------------------------------------------------------------

/** A read-only snapshot of who currently holds halt authority. `grantId` is
 * `null` when the caller did not supply one (not every acquirer has a
 * broker-issued grant id to report) -- `channelLockRefusalMessage()` renders
 * that case as the literal `unknown`, never a fabricated id. */
export interface ChannelLockHolder {
  channel: MonitorChannel;
  operation: string;
  grantId: string | null;
  heldSince: number;
}

/** Returned by a successful acquire. `release()` is idempotent: a second
 * call is a no-op, and a stale handle's release() (called after the lock has
 * already been re-acquired by someone else) never releases the NEW holder's
 * lock -- both are identity-checked against a private id captured at grant
 * time, never against the holder record's own field values. */
export interface ChannelLockHandle {
  readonly holder: ChannelLockHolder;
  release(): void;
}

// ---------------------------------------------------------------------------
// CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS -- the bounded-wait default (D-06).
// ---------------------------------------------------------------------------

/**
 * Default bound (milliseconds) on how long acquireChannelLock() will queue
 * behind a holder before rejecting. Overridable via
 * VICE_CHANNEL_LOCK_TIMEOUT_MS for a test or a deliberately narrowed
 * deployment.
 *
 * DERIVATION (stated in prose, never imported -- see header): the longest
 * legitimate hold on this lock is a stock wait path bounded by
 * stock-run-until.ts's `RUN_UNTIL_MAX_TIMEOUT_MS` (600000ms). This default
 * is that bound plus a 30000ms margin -- 630000ms -- so the queued-wait
 * bound always EXCEEDS the longest legitimate hold and never fires on
 * healthy operation. A bound below the longest legitimate hold would fire
 * while the machine is doing exactly what it was asked to do, which is
 * precisely the self-inflicted-DoS failure this constant exists to prevent
 * (T-41-06). A waiting caller's own MCP client timeout (150000ms,
 * `.mcp.json`) will surface first for THAT caller regardless -- that is a
 * timeout on their call, not a wedge diagnosis of the instance.
 */
export const CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS: number = (() => {
  const raw = process.env.VICE_CHANNEL_LOCK_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 630000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 630000;
})();

// ---------------------------------------------------------------------------
// The refusal wording -- the ONE place it is composed.
// ---------------------------------------------------------------------------

/**
 * The ONE refusal wording produced when a caller cannot be granted the lock
 * (either an immediate `tryAcquireChannelLock()` miss reported by a caller,
 * or a `ChannelLockTimeoutError`'s own message). Names the other channel,
 * the operation it is running, the hold duration in whole milliseconds, and
 * the holder's grant id (or the literal `unknown` when there is none --
 * never a fabricated id, matching claimMonitor()'s own posture for a
 * malformed holder payload).
 *
 * This reads as a legitimate ownership statement -- the same register
 * broker-control.mts's MONITOR_OWNERSHIP_DENIAL/`monitor_owned` refusal
 * already establishes for the broker's own monitor-claim conflict -- and
 * must NEVER contain the words wedge, wedged, hang, hung, frozen, stuck or
 * unresponsive, nor otherwise suggest the emulator itself has stopped
 * answering. A hold the OTHER channel cannot see would otherwise read as
 * exactly the `wedged` triage signature, whose recommended remedy is
 * destructive (T-41-06's threat-register entry).
 */
export function channelLockRefusalMessage(holder: ChannelLockHolder, nowMs: number): string {
  const heldMs = Math.max(0, nowMs - holder.heldSince);
  const grantId = holder.grantId ?? "unknown";
  return (
    `channel-lock: the ${holder.channel} channel currently holds halt authority ` +
    `(operation "${holder.operation}", grant ${grantId}, held for ${heldMs}ms) -- ` +
    `this call must wait for that channel to release before it can proceed`
  );
}

/**
 * Thrown by acquireChannelLock() when a queued waiter's bound
 * (CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS by default, or an explicit override)
 * expires before the lock reaches it. Carries the holder record that was
 * blocking it and the measured hold/wait durations as public fields, with
 * `message` produced by channelLockRefusalMessage() -- callers must never
 * re-word this message, only pass it through verbatim.
 */
export class ChannelLockTimeoutError extends Error {
  readonly holder: ChannelLockHolder;
  readonly heldMs: number;
  readonly waitedMs: number;

  constructor(holder: ChannelLockHolder, waitedMs: number, nowMs: number = Date.now()) {
    super(channelLockRefusalMessage(holder, nowMs));
    this.name = "ChannelLockTimeoutError";
    this.holder = holder;
    this.heldMs = Math.max(0, nowMs - holder.heldSince);
    this.waitedMs = waitedMs;
  }
}

// ---------------------------------------------------------------------------
// The mutex itself: one holder, one FIFO queue, one admission path.
// ---------------------------------------------------------------------------

interface QueueEntry {
  readonly id: symbol;
  readonly channel: MonitorChannel;
  readonly operation: string;
  readonly grantId: string | null;
  readonly arrivedAt: number;
  timer: NodeJS.Timeout | null;
  readonly resolve: (handle: ChannelLockHandle) => void;
  readonly reject: (err: unknown) => void;
}

let currentHolder: ChannelLockHolder | null = null;
/** Identity of the handle that currently owns `currentHolder` -- distinct
 * from the holder record's own field values, so a stale handle (one whose
 * release() runs after the lock has already passed to someone else) can
 * never be mistaken for the live one even if the new holder happens to
 * share the same channel/operation/grantId. */
let currentHolderHandleId: symbol | null = null;

/** Plain array, used strictly FIFO: push() to enqueue, shift() to wake --
 * per this module's own implementation requirement, never a priority queue,
 * never a LIFO stack. */
let queue: QueueEntry[] = [];

function removeFromQueueById(id: symbol): QueueEntry | null {
  const idx = queue.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const [entry] = queue.splice(idx, 1);
  return entry;
}

/** The ONE place a caller is granted the lock, whether immediately (queue
 * was empty) or via wakeNext() below (queue had waiters). Builds a fresh
 * holder record and a fresh handle identity every time -- there is no
 * second admission path. */
function grantLock(channel: MonitorChannel, operation: string, grantId: string | null): ChannelLockHandle {
  const id = Symbol("channel-lock-handle");
  const holder: ChannelLockHolder = { channel, operation, grantId, heldSince: Date.now() };
  currentHolder = holder;
  currentHolderHandleId = id;
  let released = false;
  return {
    holder,
    release: () => {
      if (released) return;
      released = true;
      // Identity check: a stale handle whose lock has already been handed
      // to a new holder (this handle's `id` no longer matches
      // currentHolderHandleId) must not clear the NEW holder's state.
      if (currentHolderHandleId !== id) return;
      currentHolder = null;
      currentHolderHandleId = null;
      wakeNext();
    },
  };
}

/** Hands the lock to the next queued waiter, synchronously -- never through
 * a setTimeout, so release-to-grant handoff cannot be reordered by timer
 * scheduling. No-op when the queue is empty. */
function wakeNext(): void {
  const next = queue.shift();
  if (!next) return;
  if (next.timer) {
    clearTimeout(next.timer);
    next.timer = null;
  }
  const handle = grantLock(next.channel, next.operation, next.grantId);
  next.resolve(handle);
}

/** The ONE internal admission function both acquireChannelLock() and its
 * queueing path run through -- grants immediately when free, otherwise
 * enqueues and resolves later via wakeNext(). */
function admit(channel: MonitorChannel, operation: string, grantId: string | null, timeoutMs: number): Promise<ChannelLockHandle> {
  if (currentHolder === null) {
    return Promise.resolve(grantLock(channel, operation, grantId));
  }
  return new Promise<ChannelLockHandle>((resolve, reject) => {
    const id = Symbol("channel-lock-waiter");
    const arrivedAt = Date.now();
    const entry: QueueEntry = { id, channel, operation, grantId, arrivedAt, timer: null, resolve, reject };
    entry.timer = setTimeout(() => {
      const removed = removeFromQueueById(id);
      if (!removed) {
        // Already granted or already drained by resetChannelLockForTests()
        // between the timer firing and this callback running -- nothing
        // left to reject. Unreachable in the single-threaded JS event loop
        // under normal operation, but defensive rather than assumed.
        return;
      }
      // Invariant: a queued entry can only exist while the lock is held --
      // every release() immediately drains the queue via wakeNext() when
      // non-empty, and admit() only enqueues when currentHolder !== null.
      // So currentHolder is guaranteed non-null here.
      const holder = currentHolder;
      if (holder === null) {
        reject(
          new Error(
            "channel-lock: internal invariant violation -- a queued waiter's timeout fired while no holder was recorded",
          ),
        );
        return;
      }
      reject(new ChannelLockTimeoutError(holder, Date.now() - arrivedAt));
    }, timeoutMs);
    if (typeof entry.timer.unref === "function") entry.timer.unref();
    queue.push(entry);
  });
}

export interface AcquireChannelLockOptions {
  channel: MonitorChannel;
  operation: string;
  grantId?: string | null;
  timeoutMs?: number;
}

/**
 * Grants the lock immediately when free; otherwise appends to the FIFO
 * queue and resolves when the lock reaches this caller. On expiry of
 * `timeoutMs` (default CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS) removes its own
 * entry from the queue (by identity, so a later release() can never wake an
 * already-rejected waiter) and rejects with ChannelLockTimeoutError carrying
 * the holder record and the measured hold/wait durations.
 */
export function acquireChannelLock(opts: AcquireChannelLockOptions): Promise<ChannelLockHandle> {
  return admit(opts.channel, opts.operation, opts.grantId ?? null, opts.timeoutMs ?? CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS);
}

export interface TryAcquireChannelLockOptions {
  channel: MonitorChannel;
  operation: string;
  grantId?: string | null;
}

/**
 * Fully synchronous, no `await` anywhere: grants and returns a handle when
 * free, returns `null` immediately when held -- never queues. This is the
 * entry point a diagnostic uses so that diagnosing contention never queues
 * behind the holder it is diagnosing (consumed by vice_diagnose, plan
 * 41-04).
 */
export function tryAcquireChannelLock(opts: TryAcquireChannelLockOptions): ChannelLockHandle | null {
  if (currentHolder !== null) return null;
  return grantLock(opts.channel, opts.operation, opts.grantId ?? null);
}

/** A read-only COPY of the holder record -- never the live object, so a
 * caller cannot mutate module state by holding onto what this returns.
 * `null` when nothing holds the lock. */
export function currentChannelLockHolder(): ChannelLockHolder | null {
  if (currentHolder === null) return null;
  return { ...currentHolder };
}

/**
 * Clears the holder and drains the queue by rejecting every waiter --
 * exists only so a test file can start from a known state, in the register
 * stock-dispatch.ts's own clearHeldStockSession() already establishes.
 * Never called from production code.
 */
export function resetChannelLockForTests(): void {
  currentHolder = null;
  currentHolderHandleId = null;
  const pending = queue;
  queue = [];
  for (const entry of pending) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.reject(new Error("channel-lock: resetChannelLockForTests() drained this waiter"));
  }
}
