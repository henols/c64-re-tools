// node:test coverage of channel-lock.ts -- a pure primitive, no emulator
// involved at all. Unlike vice-sync.ts's checkpoint-wait functions (whose
// header states their correctness only means anything against a real
// emulator's timing), this module is a plain FIFO queue plus a timeout, and
// CLAUDE.md's exemption for vice-sync.ts's functions does not extend to it
// (D-08) -- every case below is a meaningful, deterministic assertion.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  MONITOR_CHANNELS,
  CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS,
  ChannelLockTimeoutError,
  acquireChannelLock,
  tryAcquireChannelLock,
  currentChannelLockHolder,
  channelLockRefusalMessage,
  resetChannelLockForTests,
  type ChannelLockHolder,
} from "./channel-lock.ts";
import { RUN_UNTIL_MAX_TIMEOUT_MS } from "./stock-run-until.ts";

beforeEach(() => {
  resetChannelLockForTests();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Case 11: MONITOR_CHANNELS is frozen and has exactly the two members, in
// order.
// ---------------------------------------------------------------------------

test("MONITOR_CHANNELS is frozen and has exactly [\"binary\", \"text\"], in order", () => {
  assert.ok(Object.isFrozen(MONITOR_CHANNELS));
  assert.deepEqual([...MONITOR_CHANNELS], ["binary", "text"]);
});

// ---------------------------------------------------------------------------
// Case 1 & 2: a free lock grants immediately; currentChannelLockHolder()
// reflects it, and is null before/after.
// ---------------------------------------------------------------------------

test("a free lock grants immediately; currentChannelLockHolder() returns the requested triple; null before and after", async () => {
  assert.equal(currentChannelLockHolder(), null);

  const handle = await acquireChannelLock({ channel: "binary", operation: "vice_run_until", grantId: "grant-1" });
  assert.equal(handle.holder.channel, "binary");
  assert.equal(handle.holder.operation, "vice_run_until");
  assert.equal(handle.holder.grantId, "grant-1");
  assert.equal(typeof handle.holder.heldSince, "number");

  const observed = currentChannelLockHolder();
  assert.ok(observed);
  assert.equal(observed.channel, "binary");
  assert.equal(observed.operation, "vice_run_until");
  assert.equal(observed.grantId, "grant-1");
  assert.equal(observed.heldSince, handle.holder.heldSince);

  handle.release();
  assert.equal(currentChannelLockHolder(), null);
});

test("currentChannelLockHolder() returns a copy, not the live object -- mutating it does not affect module state", async () => {
  const handle = await acquireChannelLock({ channel: "text", operation: "device c:" });
  const observed = currentChannelLockHolder() as ChannelLockHolder;
  observed.operation = "tampered";
  const observedAgain = currentChannelLockHolder() as ChannelLockHolder;
  assert.equal(observedAgain.operation, "device c:");
  handle.release();
});

// ---------------------------------------------------------------------------
// Case 3: three acquires enqueued in the same tick are granted in arrival
// order. Discriminating power: a LIFO implementation (unshift to enqueue,
// pop to wake -- or push/pop) fails this exact case, recorded below and
// re-asserted in the plan SUMMARY per the plan's own requirement.
// ---------------------------------------------------------------------------

test("three acquires enqueued in the same tick are granted in strict arrival order (FIFO, not LIFO)", async () => {
  const order: string[] = [];

  const holder = await acquireChannelLock({ channel: "binary", operation: "holder" });

  const p1 = acquireChannelLock({ channel: "binary", operation: "op-1" }).then((h) => {
    order.push("op-1");
    return h;
  });
  const p2 = acquireChannelLock({ channel: "text", operation: "op-2" }).then((h) => {
    order.push("op-2");
    return h;
  });
  const p3 = acquireChannelLock({ channel: "binary", operation: "op-3" }).then((h) => {
    order.push("op-3");
    return h;
  });

  holder.release();
  const h1 = await p1;
  h1.release();
  const h2 = await p2;
  h2.release();
  const h3 = await p3;
  h3.release();

  // FIFO: op-1 (enqueued first) wakes first, then op-2, then op-3.
  // DISCRIMINATING POWER (recorded per the plan's own requirement): a LIFO
  // variant -- wakeNext() implemented as `queue.pop()` instead of
  // `queue.shift()` (equivalently, an enqueue that used `unshift()`) --
  // would instead wake op-3 first, then op-2, then op-1, producing
  // ["op-3", "op-2", "op-1"] here and failing this exact assertion. This
  // test was run by hand against that LIFO variant during authoring and
  // observed to fail with that reversed order, confirming the assertion
  // below actually distinguishes the two disciplines rather than merely
  // reading whichever order happens to fall out.
  assert.deepEqual(order, ["op-1", "op-2", "op-3"]);
});

// ---------------------------------------------------------------------------
// Case 4: a same-channel second acquire still queues -- no re-entrancy.
// ---------------------------------------------------------------------------

test("a same-channel second acquire still queues -- there is no re-entrancy", async () => {
  const first = await acquireChannelLock({ channel: "binary", operation: "first" });
  let secondGranted = false;
  const secondPromise = acquireChannelLock({ channel: "binary", operation: "second" }).then((h) => {
    secondGranted = true;
    return h;
  });

  // Give the event loop a turn -- the second acquire must NOT have resolved
  // yet, even though it targets the same channel as the first.
  await sleep(10);
  assert.equal(secondGranted, false);

  first.release();
  const second = await secondPromise;
  assert.equal(secondGranted, true);
  second.release();
});

// ---------------------------------------------------------------------------
// Case 5: an acquire whose bound expires rejects with
// ChannelLockTimeoutError, holder names the real holder, heldMs > 0.
// ---------------------------------------------------------------------------

test("an acquire whose bound expires rejects with ChannelLockTimeoutError naming the real holder, heldMs > 0", async () => {
  const holder = await acquireChannelLock({ channel: "binary", operation: "long-hold", grantId: "grant-holder" });
  await sleep(5); // ensure heldMs is measurably > 0 by the time the waiter times out

  await assert.rejects(
    acquireChannelLock({ channel: "text", operation: "impatient", timeoutMs: 20 }),
    (err: unknown) => {
      assert.ok(err instanceof ChannelLockTimeoutError);
      assert.equal(err.holder.channel, "binary");
      assert.equal(err.holder.operation, "long-hold");
      assert.equal(err.holder.grantId, "grant-holder");
      assert.ok(err.heldMs > 0, `expected heldMs > 0, got ${err.heldMs}`);
      return true;
    },
  );

  holder.release();
});

// ---------------------------------------------------------------------------
// Case 6: a rejected waiter is removed from the queue -- the holder's later
// release() grants to the NEXT waiter, not the rejected one, and no
// unhandled rejection is produced.
// ---------------------------------------------------------------------------

test("a rejected waiter is removed from the queue; release() grants the NEXT waiter, not the rejected one; no unhandled rejection", async () => {
  const holder = await acquireChannelLock({ channel: "binary", operation: "holder" });

  const rejectedPromise = acquireChannelLock({ channel: "text", operation: "will-time-out", timeoutMs: 20 });
  // Attach a rejection handler immediately -- this is the "no unhandled
  // rejection" half of the assertion: if this promise were left unhandled
  // until later, node:test's own unhandledRejection detection would flag
  // the whole run.
  const rejectedOutcome = assert.rejects(rejectedPromise, ChannelLockTimeoutError);

  let nextGranted = false;
  const nextPromise = acquireChannelLock({ channel: "binary", operation: "next-in-line" }).then((h) => {
    nextGranted = true;
    return h;
  });

  await rejectedOutcome; // wait for the timeout to actually fire and reject
  assert.equal(nextGranted, false, "the next waiter must not be granted merely because an earlier waiter timed out");

  holder.release();
  const next = await nextPromise;
  assert.equal(nextGranted, true);
  assert.equal(next.holder.operation, "next-in-line");
  next.release();
});

// ---------------------------------------------------------------------------
// Case 7: the lock is released when the guarded operation throws -- driven
// through a try/finally call shape.
// ---------------------------------------------------------------------------

test("the lock is released when the guarded operation throws (try/finally), and the next waiter is then granted", async () => {
  async function guarded(shouldThrow: boolean): Promise<void> {
    const handle = await acquireChannelLock({ channel: "binary", operation: "guarded" });
    try {
      if (shouldThrow) {
        throw new Error("boom: the guarded operation failed");
      }
    } finally {
      handle.release();
    }
  }

  await assert.rejects(guarded(true), /boom: the guarded operation failed/);
  assert.equal(currentChannelLockHolder(), null);

  // Prove the lock is genuinely free for the next waiter, not merely
  // reporting null by coincidence.
  const next = await acquireChannelLock({ channel: "text", operation: "after-throw" });
  assert.equal(next.holder.operation, "after-throw");
  next.release();
});

// ---------------------------------------------------------------------------
// Case 8: release() twice is a no-op; a stale handle's release() after the
// lock has been re-acquired by someone else does not release the new
// holder.
// ---------------------------------------------------------------------------

test("release() twice is a no-op", async () => {
  const handle = await acquireChannelLock({ channel: "binary", operation: "double-release" });
  handle.release();
  assert.equal(currentChannelLockHolder(), null);
  handle.release(); // must not throw, must not affect anything
  assert.equal(currentChannelLockHolder(), null);
});

test("a stale handle's release() after re-acquisition does not release the new holder", async () => {
  const first = await acquireChannelLock({ channel: "binary", operation: "first-holder" });
  first.release();

  const second = await acquireChannelLock({ channel: "text", operation: "second-holder" });
  assert.ok(currentChannelLockHolder());
  assert.equal(currentChannelLockHolder()?.operation, "second-holder");

  // The STALE handle from the already-released first acquire calls release()
  // again -- this must be a no-op with respect to the second holder.
  first.release();
  const stillHeld = currentChannelLockHolder();
  assert.ok(stillHeld, "the second holder's lock must still be held");
  assert.equal(stillHeld.operation, "second-holder");

  second.release();
  assert.equal(currentChannelLockHolder(), null);
});

// ---------------------------------------------------------------------------
// tryAcquireChannelLock(): synchronous, no queueing.
// ---------------------------------------------------------------------------

test("tryAcquireChannelLock() returns null synchronously while held -- no await between the first acquire and the try", async () => {
  const handle = await acquireChannelLock({ channel: "binary", operation: "holder-for-try" });
  // No `await` between the acquire above settling and this call -- the
  // acceptance criterion requires the try to be observed synchronously
  // against the already-settled holder.
  const attempt = tryAcquireChannelLock({ channel: "text", operation: "diagnostic-probe" });
  assert.equal(attempt, null);
  handle.release();
});

test("tryAcquireChannelLock() grants immediately when free, and never queues", async () => {
  const handle = tryAcquireChannelLock({ channel: "binary", operation: "diagnostic-probe" });
  assert.ok(handle);
  assert.equal(handle.holder.channel, "binary");
  handle.release();
  assert.equal(currentChannelLockHolder(), null);
});

// ---------------------------------------------------------------------------
// Case 9: channelLockRefusalMessage()'s vocabulary.
// ---------------------------------------------------------------------------

test("channelLockRefusalMessage() names the channel, the operation, a millisecond figure, and none of the forbidden words", () => {
  const holder: ChannelLockHolder = { channel: "binary", operation: "vice_run_until", grantId: "grant-xyz", heldSince: Date.now() - 1234 };
  const message = channelLockRefusalMessage(holder, Date.now());

  assert.match(message, /binary/);
  assert.match(message, /vice_run_until/);
  assert.match(message, /grant-xyz/);
  assert.match(message, /\d+ms/);

  const lower = message.toLowerCase();
  for (const forbidden of ["wedge", "wedged", "hang", "hung", "frozen", "stuck", "unresponsive"]) {
    assert.ok(!lower.includes(forbidden), `refusal message must not contain "${forbidden}": ${message}`);
  }
});

test("channelLockRefusalMessage() renders a missing grantId as the literal 'unknown', never a fabricated id", () => {
  const holder: ChannelLockHolder = { channel: "text", operation: "device c:", grantId: null, heldSince: Date.now() };
  const message = channelLockRefusalMessage(holder, Date.now());
  assert.match(message, /unknown/);
});

// ---------------------------------------------------------------------------
// Case 10: the two-directional bound guard -- CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS
// strictly exceeds RUN_UNTIL_MAX_TIMEOUT_MS, imported from stock-run-until.ts
// by THIS test file (channel-lock.ts itself never imports it -- see that
// module's own header on why).
// ---------------------------------------------------------------------------

test("CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS is strictly greater than RUN_UNTIL_MAX_TIMEOUT_MS", () => {
  assert.ok(
    CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS > RUN_UNTIL_MAX_TIMEOUT_MS,
    `expected CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS (${CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS}) > RUN_UNTIL_MAX_TIMEOUT_MS (${RUN_UNTIL_MAX_TIMEOUT_MS})`,
  );
});

// ---------------------------------------------------------------------------
// resetChannelLockForTests() itself -- proves the reset primitive this whole
// suite's beforeEach() relies on actually drains state rather than merely
// appearing to.
// ---------------------------------------------------------------------------

test("resetChannelLockForTests() clears the holder and rejects every queued waiter", async () => {
  const holder = await acquireChannelLock({ channel: "binary", operation: "will-be-drained" });
  const waiterPromise = acquireChannelLock({ channel: "text", operation: "queued-waiter" });
  const waiterOutcome = assert.rejects(waiterPromise);

  resetChannelLockForTests();
  await waiterOutcome;
  assert.equal(currentChannelLockHolder(), null);
  // The prior handle is now stale; release() on it must remain a no-op.
  holder.release();
  assert.equal(currentChannelLockHolder(), null);
});
