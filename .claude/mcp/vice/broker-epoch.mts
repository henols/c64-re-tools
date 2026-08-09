// broker-epoch.mts
//
// B / D-04: the per-instance epoch.json writer, held to the frozen
// eight-field contract captured in fixtures/ (task 1, before the bash
// writer that produced them is deleted later in this phase). Ports
// write_epoch()'s exact field shape and its atomic tmp-sibling-then-rename
// discipline -- the tmp file is created empty, mode tightened to
// owner-read-write BEFORE any content reaches it, content written, then
// renamed -- matching writeBrokerRecord()'s own choke point in
// vice-broker.mts exactly.
//
// Plan 03, Task 1 completes this module: the path derivations
// (epochPathFor/instanceLogDirFor, both built on the SAME private
// per-instance-directory helper so the epoch record's `log` field and the
// file actually written under that directory can never disagree) and the
// epoch-increment derivation (nextEpochFor) the per-child supervisor
// (broker-launch.mts, Task 2) needs to bump an instance's epoch on every
// respawn.
//
// T-01.6.2-17 (tampering, epoch record contents): the `pid` field is the
// emulator CHILD's own pid -- NEVER this broker's own pid. A recycle
// request resolves its target through this exact field (the grant -> its
// recorded epoch_file -> that file's pid chain, per
// handle_recycle_request()'s bash original), so a wrong value here would
// signal the wrong process. This module never fills that field itself (the
// caller -- broker-launch.mts's spawn+record path -- supplies it from the
// actually-spawned child's own pid); this comment exists so no future
// change quietly starts passing this broker's own process.pid instead.
import { writeFileSync, chmodSync, renameSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The exact eight fields the bash writer's write_epoch() emits, unchanged
 * in this port (D-04: "contract unchanged, writer moved"). */
export interface EpochRecord {
  epoch: number;
  spawned_at: string;
  /** The emulator CHILD's own pid -- see this module's header comment
   * (T-01.6.2-17). Never this broker's own process.pid. */
  pid: number;
  supervisor_pid: number;
  vice_bin: string;
  vice_args: string[];
  log: string;
  dry_run: boolean;
}

export interface WriteEpochOptions {
  supervisorDir: string;
  record: EpochRecord;
}

/** The one place that knows the epoch file's name relative to its
 * per-instance directory -- writeEpochRecord() and nextEpochFor() both call
 * THIS, so the writer and the reader-for-increment can never name two
 * different files. */
function epochFileIn(supervisorDir: string): string {
  return join(supervisorDir, "epoch.json");
}

/** The one shared per-instance directory derivation -- stateDir + port,
 * exactly matching vice-broker.mts's own `join(stateDir, String(port))`
 * (Plan 01/02). epochPathFor() and instanceLogDirFor() below both build on
 * THIS, so a caller deriving one from the other (as broker-launch.mts's
 * per-child supervisor does for the epoch record's own `log` field) can
 * never observe the two disagree. Not exported: callers that already have a
 * `stateDir`/`port` pair use epochPathFor()/instanceLogDirFor() directly;
 * a caller that already has a resolved `supervisorDir` (e.g.
 * writeEpochRecord()'s own caller) never needs to re-derive it. */
function instanceDirFor(stateDir: string, port: number): string {
  return join(stateDir, String(port));
}

/** Resolves the epoch file's path for a given instance directly from the
 * state directory and port -- the exact per-instance directory shape
 * vice-broker.mts's launch paths already build inline
 * (`join(stateDir, String(port))`), named here as one function so a second,
 * independently-drifted derivation never needs to exist. */
export function epochPathFor(stateDir: string, port: number): string {
  return epochFileIn(instanceDirFor(stateDir, port));
}

/** Resolves the per-instance logs directory -- the `logs/` subdirectory
 * under the SAME per-instance directory epochPathFor() derives from, so a
 * caller building the epoch record's `log` field (a path relative to the
 * instance directory, e.g. `logs/x64sc-<ts>.log`) and the caller that
 * actually opens that log file are guaranteed to agree on where `logs/`
 * lives. */
export function instanceLogDirFor(stateDir: string, port: number): string {
  return join(instanceDirFor(stateDir, port), "logs");
}

/** Writes supervisorDir/epoch.json. Per RESEARCH assumption A4,
 * supervisor_pid has no consumer that reads it for behaviour -- the field
 * is kept and pointed at THIS broker's own pid, so a human reading the file
 * by hand still finds a supervising process to look up, even though this
 * broker spawns the emulator directly and there is no separate per-instance
 * supervisor process any more. */
export function writeEpochRecord({ supervisorDir, record }: WriteEpochOptions): string {
  mkdirSync(supervisorDir, { recursive: true });
  const finalPath = epochFileIn(supervisorDir);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, "");
  chmodSync(tmpPath, 0o600);
  writeFileSync(tmpPath, JSON.stringify(record, null, 2) + "\n");
  renameSync(tmpPath, finalPath);
  return finalPath;
}

/** The epoch-increment derivation the per-child supervisor calls on every
 * respawn (and on an instance's very first launch): reads supervisorDir's
 * current epoch.json if one is present, using the SAME never-throw posture
 * already established for untrusted reads elsewhere in this codebase
 * (readBrokerRecordMaybe() in vice-broker.mts, readEpoch() in vice.ts) --
 * absence, an unreadable file, malformed JSON, a non-object shape, or a
 * non-integer `epoch` field are ALL treated as "no usable prior record"
 * rather than an error. A fresh instance must be able to start over an
 * unreadable file; refusing to write because the OLD record looks wrong
 * would strand the instance permanently. Returns one more than the epoch
 * found, or 1 when there is no usable prior record -- matching
 * read_prev_epoch()'s own "start at 0 so the first write becomes 1"
 * behaviour exactly. */
export function nextEpochFor(supervisorDir: string): number {
  const path = epochFileIn(supervisorDir);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return 1;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 1;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return 1;
  }
  const epoch = (parsed as Record<string, unknown>).epoch;
  if (!Number.isInteger(epoch)) {
    return 1;
  }
  return (epoch as number) + 1;
}
