// Type declarations for check-guard-fates.mjs, so its colocated test
// (src/mcp/vice/guard-fates.test.ts) typechecks under strict mode. This file is
// a CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling -- the same
// arrangement scripts/lib/anno-cli-verbs.d.mts already uses.
//
// Declares exactly the symbols that test imports, and nothing more.

/** The evidence half of a fate row: the same guard run UNPLANTED. */
export interface GuardFateControl {
  command?: string;
  cwd?: string;
  exitStatus?: number;
  excerpt?: string;
}

/** The machine-captured observed red for a re-pointed or superseded row. */
export interface GuardFateObservedRed {
  command?: string;
  cwd?: string;
  exitStatus?: number;
  excerpt?: string;
  control?: GuardFateControl | null;
}

/** One recorded fate. `historicalPath` is the primary key: the path at the
 * pinned audit commit, NOT the path on the current tree. */
export interface GuardFateRow {
  historicalPath: string;
  verdict: string;
  newSubject?: string | null;
  removalTrigger?: string;
  removingCommit?: string;
  observedRed?: GuardFateObservedRed | null;
}

export interface GuardFateRegistry {
  auditCommit?: string;
  auditEnd?: string;
  setAFloor?: number;
  setBFloor?: number;
  setCFloor?: number;
  totalFloor?: number;
  derivationNote?: string;
  rows: GuardFateRow[];
}

/** What `checkGuardFates` consumes: the four derived arrays and nothing else. */
export interface AuditedSetMembership {
  setA: string[];
  setB: string[];
  setC: string[];
  union: string[];
}

/** What `deriveAuditedSet` returns: the membership plus its provenance. */
export interface DerivedAuditedSet extends AuditedSetMembership {
  auditCommit: string;
  auditEnd: string;
  listedAtAuditCommit: number;
  setBCandidates: string[];
  setBClaimed: string[];
  forwardSamePath: string[];
  forwardRenamed: Array<{ historicalPath: string; newSubject: string; via: string }>;
  forwardGone: string[];
  setCTokens: string[];
  setCNoteLine: number;
}

export interface DeferredFateNote {
  note: string;
  tokens: string[];
  noteStartLine: number;
  noteEndLine: number;
}

export interface ResolvedSetC extends DeferredFateNote {
  members: string[];
}

export declare const AUDIT_COMMIT: string;
export declare const AUDIT_END: string;
export declare const SET_A_FLOOR: number;
export declare const SET_B_FLOOR: number;
export declare const SET_C_FLOOR: number;
export declare const TOTAL_FLOOR: number;

export declare function deriveAuditedSet(options: {
  root: string;
  roadmapText?: string;
}): DerivedAuditedSet;

export declare function resolveSetC(options: {
  roadmapText: string;
  trackedPaths: string[];
}): ResolvedSetC;

export declare function parseDeferredFateNote(roadmapText: string): DeferredFateNote;

export declare function checkGuardFates(args: {
  derived: AuditedSetMembership;
  registry: GuardFateRegistry;
  exists: (relPath: string) => boolean;
}): string[];
