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
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** A refused operation: a stable code and a message that tells what is wrong and what to do. */
export class Refusal extends Error {
  override name = "Refusal";
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** True for an Error with a code from ERROR_CODES: a refusal, whatever its class. */
export function isRefusal(error: unknown): error is Error & { code: ErrorCode } {
  const code = (error as { code?: unknown } | undefined)?.code;
  return error instanceof Error && typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code);
}
