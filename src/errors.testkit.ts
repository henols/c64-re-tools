// Checks of refusals for assert.throws and assert.rejects.

import { Refusal } from "./errors.ts";

/** Matches a refusal (also a WireFailure) with this code, and with a message that `message` matches when it is given. */
export const failsWith = (code: string, message?: RegExp) => (error: unknown) =>
  error instanceof Refusal && error.code === code && (message === undefined || message.test(error.message));
