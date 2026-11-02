// Polling for tests: wait for a state, never a fixed sleep.

/**
 * Polls `condition` every `intervalMs` until it holds; throws with `what` when
 * it does not hold within `timeoutMs`. A poll of a real VICE stops its machine
 * while the monitor answers, so such a poll waits longer between its calls.
 */
export async function waitFor(condition: () => boolean | Promise<boolean>, what: string, timeoutMs = 5_000, intervalMs = 10): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`${what}: not reached in ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
