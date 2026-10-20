// The one list of error codes and the one refusal class. Every part of the
// repository may import this file: the scripts, the MCP server, the host and
// the knowledge all report a failure as a code from this list and a message.

export const ERROR_CODES = [
  "invalid-input",
  "machine-running",
  "machine-unavailable",
  "machine-state-lost",
  "not-found",
  "media-error",
  "limit-exceeded",
  "unsupported-in-space",
  "installation-incomplete",
  "operation-failed",
  "conflict",
  "stale-revision",
  "invalid-database",
  "unsupported-schema",
  "not-implemented",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * A refused operation: a stable code and a message that tells what is wrong
 * and what to do. The optional hint holds the "what to do" apart; without it,
 * a script splits the message after its first sentence (splitMessage).
 */
export class Refusal extends Error {
  override name = "Refusal";
  readonly code: ErrorCode;
  readonly hint?: string;

  constructor(code: ErrorCode, message: string, options: { hint?: string } = {}) {
    super(message);
    this.code = code;
    if (options.hint !== undefined) this.hint = options.hint;
  }
}

/**
 * Splits a message into what is wrong (the first sentence) and what to do (the
 * rest). A sentence ends at ". " before a capital letter, a backtick, a $, a
 * quote or --. With a given hint, the whole message is the error.
 */
export function splitMessage(message: string, hint?: string): { error: string; hint?: string } {
  const flat = message.trim();
  if (hint !== undefined) return { error: flat, hint };
  const cut = /\.\s+(?=[A-Z`$"'(]|--)/.exec(flat);
  const error = cut === null ? flat : flat.slice(0, cut.index + 1);
  const rest = cut === null ? "" : flat.slice(cut.index + cut[0].length).trim();
  return rest === "" ? { error } : { error, hint: rest };
}

/** True for an Error with a code from ERROR_CODES: a refusal, whatever its class. */
export function isRefusal(error: unknown): error is Error & { code: ErrorCode } {
  const code = (error as { code?: unknown } | undefined)?.code;
  return error instanceof Error && typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code);
}
