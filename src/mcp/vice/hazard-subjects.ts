#!/usr/bin/env node
// hazard-subjects.ts
//
// WHY THIS FILE EXISTS: the one closed table of committed hazard-subject
// PRGs that `vice_program_load` may put into RAM, named by id. The client
// reads the chosen file itself and sends its bytes; the path never reaches
// the broker or the emulator.
//
// WHAT NOT TO DO:
//   - Never build a path from caller input. A caller names an id, looked up
//     here by exact membership; every row is a reviewed literal.
//   - Never send one of these paths across the socket (to the broker or to
//     a VICE monitor). Read the bytes on this side and send those.

import { join } from "node:path";

import { repoRoot } from "./repo-root.ts";

/**
 * id -> repo-relative path segments. `misaligned` is deliberately absent:
 * `hazard-subject-misaligned.prg` is only consumed offline by the
 * hazard-report gate, and a committed test asserts it stays unloadable.
 */
export const HAZARD_SUBJECT_PRG_RELPATHS = Object.freeze({
  /** The tracer-slice subject -- the original. */
  original: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject.prg"]),
  /** The regressed twin: three planted single-bit regressions at the
   * immediates feeding $D020, $D015 and $D018. */
  regressed: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject-regressed.prg"]),
  /** One behaviour removed and one added, made by hand in the fixture's
   * own source. */
  modified: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject-modified.prg"]),
  /** The original re-produced from its own committed annotation store. */
  rebuild: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject-rebuild.prg"]),
  /** The same removed/added pair as `modified`, made instead in a file
   * `exportAsmTree()` emitted, reassembled against the pre-registered byte
   * manifest `fixtures/hazard-subject/exported-edit.manifest.json`. */
  "exported-edit": Object.freeze([
    "src",
    "mcp",
    "vice",
    "fixtures",
    "hazard-subject",
    "hazard-subject-exported-edit.prg",
  ]),
} as const);

/** The only thing a caller ever names, and never a path. */
export type HazardSubjectId = keyof typeof HAZARD_SUBJECT_PRG_RELPATHS;

/** The frozen id list, in table order. */
export const HAZARD_SUBJECT_IDS: readonly HazardSubjectId[] = Object.freeze(
  Object.keys(HAZARD_SUBJECT_PRG_RELPATHS) as HazardSubjectId[],
);

/** Each row's last segment, derived from the table rather than spelled twice. */
export const HAZARD_SUBJECT_PRG_BASENAMES: Readonly<Record<HazardSubjectId, string>> = Object.freeze(
  Object.fromEntries(
    HAZARD_SUBJECT_IDS.map((id) => {
      const segments = HAZARD_SUBJECT_PRG_RELPATHS[id];
      return [id, segments[segments.length - 1]] as const;
    }),
  ) as Record<HazardSubjectId, string>,
);

/** True only for an id this table carries. `Object.keys`-derived, so an
 * inherited name ("constructor", "__proto__") never tests true. */
export function isHazardSubjectId(value: unknown): value is HazardSubjectId {
  return typeof value === "string" && (HAZARD_SUBJECT_IDS as readonly string[]).includes(value);
}

/** Absolute path to one member, for THIS process to read. */
export function hazardSubjectPrgPath(id: HazardSubjectId): string {
  return join(repoRoot(), ...HAZARD_SUBJECT_PRG_RELPATHS[id]);
}
