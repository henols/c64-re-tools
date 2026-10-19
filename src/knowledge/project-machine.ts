// The machine of a project: the one current row of the machine table, else
// the C64. The answer is kept for each open index until a write changes it.

import type { DatabaseSync } from "node:sqlite";

import { DEFAULT_MACHINE, isMachineId, MACHINES, type Machine, type Space } from "../machine.ts";

const known = new WeakMap<DatabaseSync, Machine>();

/** The machine that the knowledge names; the C64 when it names none or when there is no knowledge. */
export function machineOf(db: DatabaseSync | undefined): Machine {
  if (db === undefined) return DEFAULT_MACHINE;
  const cached = known.get(db);
  if (cached !== undefined) return cached;
  const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = 'current_machine'").get();
  const row = hasTable === undefined ? undefined : (db.prepare("SELECT machine FROM current_machine").get() as { machine: unknown } | undefined);
  const machine = row !== undefined && isMachineId(row.machine) ? MACHINES[row.machine] : DEFAULT_MACHINE;
  known.set(db, machine);
  return machine;
}

/** The space of the CPU view of the project's machine: the default space of every query and write. */
export function mainSpaceOf(db: DatabaseSync | undefined): Space {
  return machineOf(db).spaces.main;
}

/** Forgets the machine of an index after a write or a load changed it. */
export function forgetMachine(db: DatabaseSync): void {
  known.delete(db);
}
