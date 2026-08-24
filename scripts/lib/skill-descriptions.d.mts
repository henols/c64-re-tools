// Type declarations for skill-descriptions.mjs, so the colocated test that
// imports it (src/mcp/vice/skill-description-overlap.test.ts, Phase 19/
// ABS-03) typechecks under strict mode -- the same shape
// scripts/lib/skill-corpus.d.mts, scripts/lib/skill-honesty-checks.d.mts and
// scripts/lib/r2000-cli-verbs.d.mts already establish. This file is a
// CI-only helper with no runtime role, so it stays out of
// src/mcp/vice/package.json's files[] like its .mjs sibling.
export interface SkillFrontmatter {
  name: string;
  description: string;
}

export interface ComparableClause {
  clause: string;
  tokens: Set<string>;
}

export interface PairScore {
  a: string;
  b: string;
  score: number;
  clauseA: string;
  clauseB: string;
  identical: boolean;
}

export interface AllowlistEntry {
  a: string;
  b: string;
  clause: string;
  reason: string;
  decidedOn: string;
}

export interface AllowlistAudit {
  uncovered: PairScore[];
  stale: AllowlistEntry[];
  malformed: AllowlistEntry[];
}

export declare const DESCRIPTION_OVERLAP_THRESHOLD: number;
export declare const COLLISION_ALLOWLIST: AllowlistEntry[];
export declare const FUNCTION_STOP_WORDS: string[];
export declare const DOMAIN_STOP_WORDS: string[];
export declare function parseSkillFrontmatter(content: string): SkillFrontmatter;
export declare function splitTriggerClauses(description: string): string[];
export declare function normaliseClause(clause: string): string[];
export declare function clauseTokens(clause: string): Set<string>;
export declare function jaccard(a: Set<string>, b: Set<string>): number;
export declare function comparableClauses(description: string): ComparableClause[];
export declare function skillsWithNoComparableClauses(map: Record<string, string>): string[];
export declare function pairScores(map: Record<string, string>): PairScore[];
export declare function descriptionCollisions(
  map: Record<string, string>,
  options?: { threshold?: number }
): PairScore[];
export declare function entryCoversCollision(entry: AllowlistEntry, collision: PairScore): boolean;
export declare function allowlistAudit(
  collisions: PairScore[],
  allowlist?: AllowlistEntry[]
): AllowlistAudit;
export declare function expectedPairCount(n: number): number;
