// Every date and time the code writes is ISO 8601 at the fixed CET offset
// +01:00, also in summer: no timestamp repeats when the clocks go back, and
// the text of two timestamps sorts in time order.

const CET_OFFSET_MS = 60 * 60 * 1000;

/** `time` as `2026-10-09T14:03:21.123+01:00`. */
export function isoCet(time: Date = new Date()): string {
  return `${new Date(time.getTime() + CET_OFFSET_MS).toISOString().slice(0, -1)}+01:00`;
}

/** `time` to the second, for a file name: `2026-10-09T14-03-21`. A colon is not allowed in a name on Windows. */
export function fileStampCet(time: Date = new Date()): string {
  return isoCet(time).slice(0, 19).replace(/:/g, "-");
}
