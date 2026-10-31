// Polling for tests: wait for a state, never a fixed sleep.

/** Polls `condition` until it holds; throws with `what` when it does not hold within `timeoutMs`. */
export async function waitFor(condition: () => boolean | Promise<boolean>, what: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`${what}: not reached in ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
