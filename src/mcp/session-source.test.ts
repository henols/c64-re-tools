import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViceSessionClient } from "../host-client/vice-session.ts";
import { WireFailure } from "../protocol/messages.ts";
import { sessionSource } from "./session-source.ts";

/** A session that the emulator answered; lose() ends it as the loss of the host connection does. */
function answeredSession(): { client: ViceSessionClient; lose: () => Promise<void> } {
  let end!: () => void;
  const fake = {
    closed: new Promise<void>((resolve) => (end = resolve)),
    lost: false,
    answered: true,
    unreportedLoss: undefined as WireFailure | undefined,
    async close() {},
  };
  return {
    client: fake as unknown as ViceSessionClient,
    async lose() {
      fake.lost = true;
      fake.unreportedLoss = new WireFailure("machine-state-lost", "The emulator and its machine state are gone.");
      end();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

const failsWith = (code: string) => (error: unknown) => error instanceof WireFailure && error.code === code;

test("after a lost session, a host of another release gives its refusal, not the lost machine state", async () => {
  const first = answeredSession();
  const opens: Array<() => Promise<ViceSessionClient>> = [
    async () => first.client,
    async () => {
      throw new WireFailure("installation-incomplete", "This client is from an older release of c64-re-tools than the host runtime.");
    },
  ];
  const source = sessionSource(() => opens.shift()!(), () => {});
  assert.equal(await source.get(), first.client);
  await first.lose();
  await assert.rejects(source.get(), (error: unknown) => failsWith("installation-incomplete")(error) && /older release/.test((error as Error).message));
  await source.close();
});

test("after a lost session, the lost machine state comes once; a new session opens for the next call", async () => {
  const first = answeredSession();
  const second = answeredSession();
  const opens: Array<() => Promise<ViceSessionClient>> = [
    async () => first.client,
    async () => {
      throw new WireFailure("machine-unavailable", "The host runtime does not run.");
    },
    async () => second.client,
  ];
  const source = sessionSource(() => opens.shift()!(), () => {});
  assert.equal(await source.get(), first.client);
  await first.lose();
  await assert.rejects(source.get(), failsWith("machine-state-lost"));
  assert.equal(await source.get(), second.client);
  await source.close();
});
