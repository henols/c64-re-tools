#!/usr/bin/env node
// anno-memmap-check.mts
//
// WHY THIS FILE EXISTS: the one comparison behind `render-memmap --check` --
// a committed memory map's text against a fresh render -- with no store and no
// filesystem. The CLI reads the committed file and passes both texts in.
//
// WHAT NOT TO DO:
//   - Never import the store here, directly or through another module: the
//     client loads this file.
//   - Never auto-fix. The check reports the first differing line and stops.

export type CheckRenderedMemoryMapResult =
  | { status: "in-sync" }
  | { status: "drifted"; line: number; expected: string; actual: string };

/** Compares a rendered file's text with a fresh render, naming the first
 * differing line. Never auto-fixes. */
export function compareRenderedMemoryMap(onDisk: string, markdown: string): CheckRenderedMemoryMapResult {
  if (onDisk === markdown) {
    return { status: "in-sync" };
  }

  const diskLines = onDisk.split("\n");
  const freshLines = markdown.split("\n");
  const max = Math.max(diskLines.length, freshLines.length);
  for (let i = 0; i < max; i++) {
    if (diskLines[i] !== freshLines[i]) {
      return {
        status: "drifted",
        line: i + 1,
        expected: freshLines[i] ?? "(end of file)",
        actual: diskLines[i] ?? "(end of file)",
      };
    }
  }
  // Unreachable in practice (the strings already compared unequal above),
  // kept only as a defensive fallback.
  return { status: "drifted", line: max + 1, expected: "(no further lines)", actual: "(no further lines)" };
}
