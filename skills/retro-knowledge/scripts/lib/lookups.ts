// The lookups that the commands give to a listing and to the writes that
// check an operand against the program: the knowledge of a space, and the
// platform names of the machine of the project.

import type { DatabaseSync } from "node:sqlite";

import { operandText } from "#src/knowledge/expression.ts";
import { operandImages as programImages, programCoverage, requireProgram } from "#src/knowledge/program.ts";
import { mainSpaceOf, machineOf } from "#src/knowledge/project-machine.ts";
import { analyzerNamesAt, commentsAt, listRegions, operandAt, referencesFrom, referencesTo, symbolAt } from "#src/knowledge/read.ts";
import { isSemantic } from "#src/knowledge/schema.ts";
import type { OperandImage } from "#src/knowledge/write.ts";
import { platformNamesOfSpace } from "#src/platform.ts";
import type { ListingSource } from "./listing.ts";

/** The lookups of a listing: the program and the coverage in the knowledge, the knowledge of the space and the platform names of its machine. */
export function listingSource(db: DatabaseSync | undefined, space: string): ListingSource {
  const image = requireProgram(db, space);
  const coverage = programCoverage(db, space)?.map;
  const inside = (at: number) => image.segments.some((segment) => at >= segment.start && at <= segment.end);
  const names = platformNamesOfSpace(space);
  const platform = new Map(names.map((entry) => [entry.address, entry.name]));
  const entries = names.filter((entry) => entry.end > entry.address);
  return {
    cpu: machineOf(db).cpu,
    byteAt: (at) => (inside(at) ? image.byteAt(at) : undefined),
    entryStart: (at) => (inside(at) ? undefined : entries.find((entry) => at > entry.address && at <= entry.end)?.address),
    // A user or LLM name, else the platform name; an analyzer name in symbols (knowledge from an older version) gives way to it.
    nameOf: (at) => {
      const own = symbolAt(db, at, space);
      return own !== undefined && isSemantic(own.origin) ? own.name : (platform.get(at) ?? own?.name);
    },
    knownNameOf: (at) => symbolAt(db, at, space)?.name,
    secondNames: (at) => analyzerNamesAt(db, at, space).map((row) => row.name),
    regions: listRegions(db, undefined, undefined, undefined, space),
    comments: (at) => {
      const rows = commentsAt(db, at, space);
      const side = rows.find((row) => row.placement === "side")?.text;
      return { line: rows.filter((row) => row.placement === "line").flatMap((row) => row.text.split(/\r?\n/)), ...(side === undefined ? {} : { side }) };
    },
    operand: (at) => {
      const row = operandAt(db, at, space);
      return row === undefined ? undefined : operandText(row);
    },
    references: (at) => ({ in: referencesTo(db, at, space).length, out: referencesFrom(db, at, space).length }),
    ...(coverage === undefined ? {} : { coverage }),
  };
}

/** The programs that operand, patch and macro use writes are checked against, with the platform names of the project machine. */
export function operandImages(db: DatabaseSync): (space: string) => OperandImage {
  return programImages(db, new Map(platformNamesOfSpace(mainSpaceOf(db)).map((entry) => [entry.name, entry.address])));
}
