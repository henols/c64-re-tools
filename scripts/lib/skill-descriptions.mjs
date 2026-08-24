#!/usr/bin/env node
// scripts/lib/skill-descriptions.mjs -- shared predicates for
// `scripts/check-skill-description-overlap.mjs` (ABS-03), proven
// non-vacuous by a committed test (`src/mcp/vice/skill-description-overlap.
// test.ts`) that this module makes possible in the first place.
//
// WHY A PREDICATE MODULE EXISTS AT ALL HERE: `check-skill-description-
// overlap.mjs` runs its whole check at import time (it is a plain top-level
// script, not a function you can call), so none of its predicates could
// ever be proven non-vacuous by a committed test -- only by re-running the
// live script and reading its exit code, which says nothing about whether
// the PREDICATE itself, in isolation, actually distinguishes a colliding
// pair from a clean one. This is the "single seam, two callers" shape
// `scripts/lib/skill-honesty-checks.mjs` and `scripts/lib/skill-corpus.mjs`
// already established in this repo, for exactly the same reason: pull the
// logic out so a test can call it directly. The live script gets ONE
// assertion in that test (it exits 0 and prints its OK line); everything
// else is proven here, against planted input.
//
// WHY IT MATTERS: a skill's `description:` IS Claude Code's trigger
// mechanism. Two descriptions contending for the same trigger is not a
// cosmetic duplication -- it is a dispatch failure, in which the wrong
// playbook fires and the right one never does. That failure is invisible to
// every other gate in this repository: `check-skill-tool-coverage.mjs`
// asks whether a named tool exists, `check-skill-fork-honesty.mjs` asks
// whether a fork requirement is stated nearby, and neither has any opinion
// about whether two skills are asking for the same job.
//
// Lives under `scripts/lib/`, not `src/mcp/vice/`, on purpose: nothing
// exported here has a runtime role in the shipped MCP server, so this file
// must stay out of `src/mcp/vice/package.json`'s `files[]` (a
// shipped-runtime allow-list enforced by `scripts/check-npm-packages.mjs`)
// while still being tracked by git so `scripts/package.sh`'s `git archive`
// includes it.
//
// Every export takes content as a STRING -- never a path this module then
// hands to a module loader or to the operating system. Skill content is
// untrusted/first-party prose that is PARSED and never executed; this
// module contains no dynamic module load, no synchronous module require, no
// dynamic evaluation and no child-process call. That absence is asserted at
// SOURCE level by 19-05-PLAN.md's own acceptance criterion, which greps this
// file for each of those four call shapes -- which is also why this comment
// describes them rather than writing them out (the same grep-gate hygiene
// 19-04 applied to packer-finding.mjs's header). Nothing here can execute
// anything it is handed.
//
// WHAT NOT TO DO: do not re-derive the corpus walk here. `walkSkills()` and
// `topLevelSkillDirs()` live in `./skill-corpus.mjs` and the runner imports
// them from there (the WR-12 lesson: two copies of one seam agree only
// until one of them changes). This module never touches the filesystem at
// all.
//
// Every pattern below is a character class or a literal `String.endsWith`
// over a bounded token, and there is no nested quantifier anywhere -- the
// catastrophic-backtracking class this repository has already paid for
// twice cannot arise from linear character-class scans over strings that
// are at most one skill description long.

// ---------------------------------------------------------------------------
// The threshold, and the measurement that fixes its value
// ---------------------------------------------------------------------------

/**
 * DESCRIPTION_OVERLAP_THRESHOLD -- the contention bar, in max-pairwise-clause
 * Jaccard.
 *
 * MEASURED, NOT CHOSEN. 19-RESEARCH.md section 4.3 scored all 55 unordered
 * pairs over this project's six skills plus all five upstream regenerator2000
 * analyze procedures, using exactly the normalisation below:
 *
 *   - The clean project inventory's observed CEILING was 0.250, from
 *     `c64-program-recon` :: `c64-provenance-diff` ("reverse engineer a C64
 *     game" :: "cracktro code from game code").
 *   - Two further real pairs sat just under it at 0.200:
 *     `acme-build` :: `c64-memory-mapping` ("list the symbols a program
 *     uses" :: "document a disassembly listing"), and
 *     `c64-ram-capture` :: `vice-wedge-triage` ("capture a memory image at a
 *     checkpoint" :: "when a checkpoint never fires").
 *   - Upstream's own two most-similar siblings, `r2000-analyze-routine` ::
 *     `r2000-analyze-symbol`, scored 0.261 -- ABOVE this project's clean
 *     ceiling. That single number is why the absorbed descriptions were
 *     rewritten on absorption rather than carried verbatim (19-02): carrying
 *     them would have breached the measured baseline on the day they landed.
 *
 * 0.35 sits above the observed ceiling with real headroom and well below
 * what a genuine near-duplicate produces (an exact duplicate scores 1.0; a
 * reworded duplicate scores in the 0.5-0.8 band). It is a measured choice
 * with headroom, deliberately NOT a round number picked by taste -- 0.5
 * would be vacuous on this corpus, and 0.25 would fire on the clean tree.
 *
 * WHAT WOULD JUSTIFY CHANGING IT: a RE-MEASURED ceiling over a changed
 * inventory, recorded here the way this comment records the current one.
 * Never a failing pair. Raising the threshold to make a real collision pass
 * is the exact failure mode this gate exists to prevent, and 19-05-PLAN.md
 * carries it as a prohibition against ABS-03.
 */
export const DESCRIPTION_OVERLAP_THRESHOLD = 0.35;

/**
 * COLLISION_ALLOWLIST -- entries of the shape
 *   { a, b, clause, reason, decidedOn }
 * naming BOTH skills, quoting the colliding clause VERBATIM, giving a reason
 * and an ISO date.
 *
 * DESIGNED TO SHRINK BY FAILING, following the doctrine
 * `scripts/check-skill-tool-coverage.mjs`'s header already states for
 * `FORK_ONLY_UNRECOVERABLE`/`PENDING_LATER_PHASE`: "An allowlist that can
 * only ever grow is how a coverage check rots into a permanent exemption."
 * Every entry here is asserted STILL LIVE by the runner -- if the collision
 * it covers no longer occurs, the entry is stale and the check FAILS until
 * the entry is deleted. An entry is legitimate only for a collision that is
 * genuinely correct behaviour; a real collision is resolved by SHARPENING a
 * description, never by adding an entry here.
 *
 * Empty as of 2026-08-24: the seven-skill inventory passes on sharpened
 * descriptions, with no exemption of any kind.
 */
export const COLLISION_ALLOWLIST = [];

// ---------------------------------------------------------------------------
// Stop-lists
// ---------------------------------------------------------------------------

/** Function words: grammar, not meaning. Present in every description. */
export const FUNCTION_STOP_WORDS = [
  "the", "a", "an", "to", "of", "for", "and", "or", "when", "asked", "use",
  "in", "on", "at", "is", "it", "this", "that", "any", "every", "its", "as",
  "with", "by", "from", "what", "which", "how", "do", "does", "not",
];

/**
 * Domain words: the shared vocabulary of a C64 reverse-engineering
 * toolkit. WITHOUT this list every skill here collides with every other on
 * "C64", "memory", "program" and "byte" -- words that say what the project
 * is about and nothing at all about which skill should fire. Dropping them
 * is what makes the remaining overlap mean something.
 */
export const DOMAIN_STOP_WORDS = [
  "c64", "commodore", "6502", "6510", "vice", "address", "memory",
  "program", "code", "byte", "bytes",
];

/** The trigger phrase that separates the capability sentence from the
 * trigger clauses. Every description in this repository is written in this
 * shape; a description without it yields no trigger clauses and is reported
 * as a failure rather than passing silently. */
const TRIGGER_PHRASE = "use when";

/** Minimum surviving tokens for a clause to be comparable at all. A
 * one-token clause Jaccards to 0 or 1 against everything and carries no
 * signal either way. */
const MIN_CLAUSE_TOKENS = 2;

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Parses a SKILL.md's YAML frontmatter for `name:` and `description:`,
 * TEXTUALLY -- this repository ships no YAML parser and must not add one
 * (the runtime dependency set is pinned and enforced by
 * `scripts/check-npm-packages.mjs`). Handles the folded-continuation shape
 * (an indented line following `description:`) defensively even though every
 * description in this repository today is a single line.
 *
 * Returns `{ name, description }`, either of which may be `""` when the
 * key is absent -- callers decide what an empty one means, since "no
 * frontmatter at all" and "a description that normalises to nothing" are
 * different failures with different messages.
 *
 * @param {string} content SKILL.md source as a STRING. Never a path.
 */
export function parseSkillFrontmatter(content) {
  const out = { name: "", description: "" };
  if (typeof content !== "string") return out;
  if (!content.startsWith("---")) return out;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return out;
  const block = content.slice(content.indexOf("\n") + 1, end);
  const lines = block.split("\n");
  let key = null;
  const buf = { name: [], description: [] };
  for (const line of lines) {
    const m = /^([a-zA-Z_-]+):[ \t]*(.*)$/.exec(line);
    if (m) {
      key = m[1] === "name" || m[1] === "description" ? m[1] : null;
      if (key) buf[key].push(m[2]);
      continue;
    }
    // Continuation line: indented, belongs to the key above it.
    if (key && /^[ \t]+\S/.test(line)) buf[key].push(line.trim());
  }
  out.name = buf.name.join(" ").trim();
  out.description = buf.description.join(" ").trim();
  return out;
}

// ---------------------------------------------------------------------------
// Clause splitting
// ---------------------------------------------------------------------------

/**
 * Splits a description into comparable CLAUSES.
 *
 * Cuts at the FIRST case-insensitive occurrence of the trigger phrase
 * ("use when"): the head is the capability sentence and stays whole, the
 * tail is split on commas, the standalone word "or", full stops and
 * semicolons. Clauses are compared, not whole descriptions, because a
 * description is a list of independent triggers and a whole-description
 * similarity dilutes one exactly-duplicated trigger into noise -- which is
 * the collision that actually breaks dispatch.
 *
 * A description with no trigger phrase yields the capability sentence
 * alone; the runner treats "zero COMPARABLE clauses" as a failure.
 *
 * @param {string} description The description text as a STRING.
 * @returns {string[]} Trimmed, non-empty clause strings.
 */
export function splitTriggerClauses(description) {
  if (typeof description !== "string" || description.trim() === "") return [];
  const lower = description.toLowerCase();
  const idx = lower.indexOf(TRIGGER_PHRASE);
  const head = idx === -1 ? description : description.slice(0, idx);
  const tail = idx === -1 ? "" : description.slice(idx);
  const clauses = [];
  const headTrimmed = head.trim();
  if (headTrimmed !== "") clauses.push(headTrimmed);
  if (tail !== "") {
    // Split on ", " / ";" / ". " / standalone " or ". Each separator is a
    // literal or a bounded character class -- no nested quantifier.
    for (const piece of tail.split(/[,;.]|\bor\b/)) {
      const t = piece.trim();
      if (t !== "") clauses.push(t);
    }
  }
  return clauses;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Crude stemmer, tokens longer than four characters only. String
 * `endsWith` throughout: no regex, so no backtracking of any kind. */
function stem(token) {
  if (token.length <= 4) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.endsWith("ing")) return token.slice(0, -3);
  if (token.endsWith("ed")) return token.slice(0, -2);
  if (token.endsWith("es")) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/**
 * The stop-set, STEMMED with the same stemmer the tokens go through.
 * Building it this way is what makes `bytes` and `byte` both drop: the
 * description token `bytes` stems to `byt`, and so does the stop-list entry
 * `bytes`, while the four-character `byte` is below the stemmer's length
 * gate and stays itself. A stop-list compared UNSTEMMED would silently miss
 * every plural it lists.
 */
const STOP_SET = new Set(
  [...FUNCTION_STOP_WORDS, ...DOMAIN_STOP_WORDS].flatMap((w) => [w, stem(w)])
);

/**
 * Normalises one clause to its surviving token list, performing exactly
 * these steps in this order:
 *
 *   1. lowercase
 *   2. strip backticks and the emphasis markers `*` and `_`
 *   3. map both dash forms (em and en) to a plain hyphen
 *   4. drop every character outside the safe set [a-z0-9$ -]
 *   5. split on whitespace and hyphens
 *   6. crude-stem tokens longer than four characters
 *   7. drop members of the two stop-lists
 *
 * Step 4's safe set keeps `$` so `$d020` survives as the distinguishing
 * token it is. Every step is pinned individually by the colocated test, so
 * a silent change to any one of them fails.
 *
 * @param {string} clause A clause as a STRING.
 * @returns {string[]} Surviving tokens, in order, duplicates included.
 */
export function normaliseClause(clause) {
  if (typeof clause !== "string") return [];
  const cleaned = clause
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9$ -]/g, " ");
  const out = [];
  for (const raw of cleaned.split(/[\s-]/)) {
    if (raw === "") continue;
    const t = stem(raw);
    if (t === "" || STOP_SET.has(t)) continue;
    out.push(t);
  }
  return out;
}

/**
 * The token-set builder: `normaliseClause()` with duplicates collapsed.
 * Jaccard is a set measure, so this is the shape every comparison uses.
 *
 * @param {string} clause A clause as a STRING.
 * @returns {Set<string>}
 */
export function clauseTokens(clause) {
  return new Set(normaliseClause(clause));
}

/**
 * Jaccard similarity: |intersection| / |union|. Two empty sets score 0
 * rather than 1 -- "nothing in common with nothing" is not evidence of
 * contention, and returning 1 there would make every unparseable
 * description collide with every other.
 *
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} 0..1
 */
export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Comparable clauses for one description: those with at least
 * MIN_CLAUSE_TOKENS surviving tokens, each carried alongside its own token
 * set so the reported collision can quote the clause VERBATIM. */
export function comparableClauses(description) {
  const out = [];
  for (const clause of splitTriggerClauses(description)) {
    const tokens = clauseTokens(clause);
    if (tokens.size < MIN_CLAUSE_TOKENS) continue;
    out.push({ clause, tokens });
  }
  return out;
}

/** Names, from `map`, whose description yields ZERO comparable clauses.
 * The runner FAILS on a non-empty result: a description nothing can compare
 * is not a clean description, it is an unmeasured one, and letting it pass
 * silently is how this gate would go vacuous one skill at a time. */
export function skillsWithNoComparableClauses(map) {
  const bad = [];
  for (const name of Object.keys(map)) {
    if (comparableClauses(map[name]).length === 0) bad.push(name);
  }
  return bad.sort();
}

/**
 * Scores EVERY unordered pair in `map`, each exactly once.
 *
 * The score is the maximum pairwise Jaccard over the two descriptions'
 * comparable clause token-sets; `clauseA`/`clauseB` are the two clauses
 * that produced it, verbatim. `identical` is true when those two clauses
 * have the same normalised token set -- a fact that means contention
 * REGARDLESS of the threshold.
 *
 * Returned sorted by descending score, then by the two names
 * alphabetically, so a report is stable under input reordering.
 *
 * @param {Record<string,string>} map skill name -> description
 * @returns {{a:string,b:string,score:number,clauseA:string,clauseB:string,identical:boolean}[]}
 */
export function pairScores(map) {
  const names = Object.keys(map).sort();
  const clauses = new Map();
  for (const n of names) clauses.set(n, comparableClauses(map[n]));
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      let best = { score: 0, clauseA: "", clauseB: "", identical: false };
      for (const ca of clauses.get(a)) {
        for (const cb of clauses.get(b)) {
          const score = jaccard(ca.tokens, cb.tokens);
          const identical =
            ca.tokens.size === cb.tokens.size && score === 1;
          if (score > best.score || (identical && !best.identical)) {
            best = { score, clauseA: ca.clause, clauseB: cb.clause, identical };
          }
        }
      }
      pairs.push({ a, b, ...best });
    }
  }
  return sortRecords(pairs);
}

function sortRecords(records) {
  return records.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.a !== y.a) return x.a < y.a ? -1 : 1;
    if (x.b !== y.b) return x.b < y.b ? -1 : 1;
    return 0;
  });
}

/**
 * The collision detector: every pair in contention, empty when clean.
 *
 * CONTENTION RULE, fixed here and nowhere else: a pair collides when its
 * maximum pairwise clause score is greater than OR EQUAL TO the threshold,
 * OR when the two clauses have an identical normalised token set regardless
 * of the threshold. The comparison is INCLUSIVE -- a pair landing exactly
 * on the threshold collides. A strict `>` would make the threshold's own
 * value the one score that passes, which is not a bar anyone means to set.
 *
 * Each record carries both skill names, both colliding clauses verbatim,
 * and the score. Sorted by descending score then by the two names
 * alphabetically; each unordered pair appears exactly once.
 *
 * @param {Record<string,string>} map skill name -> description
 * @param {{threshold?: number}} [options]
 */
export function descriptionCollisions(map, options = {}) {
  const threshold =
    typeof options.threshold === "number"
      ? options.threshold
      : DESCRIPTION_OVERLAP_THRESHOLD;
  return sortRecords(
    pairScores(map).filter((p) => p.identical || p.score >= threshold)
  );
}

// ---------------------------------------------------------------------------
// Allowlist audit
// ---------------------------------------------------------------------------

/** True when `entry` names the same unordered pair as `collision` and
 * quotes one of its two colliding clauses verbatim. Order-insensitive on
 * the names: an entry written `{a: x, b: y}` covers the pair reported as
 * `{a: y, b: x}`. */
export function entryCoversCollision(entry, collision) {
  const samePair =
    (entry.a === collision.a && entry.b === collision.b) ||
    (entry.a === collision.b && entry.b === collision.a);
  if (!samePair) return false;
  return entry.clause === collision.clauseA || entry.clause === collision.clauseB;
}

/**
 * Audits `allowlist` against the live `collisions`:
 *   - `uncovered`: collisions no entry covers -- the check FAILS on these.
 *   - `stale`: entries covering no live collision -- the check FAILS on
 *     these too, and instructs that they be DELETED. This is the
 *     shrink-by-failing half, and it is the half that stops the list
 *     becoming a permanent exemption.
 *   - `malformed`: entries missing any of the five required fields.
 */
export function allowlistAudit(collisions, allowlist = COLLISION_ALLOWLIST) {
  const uncovered = collisions.filter(
    (c) => !allowlist.some((e) => entryCoversCollision(e, c))
  );
  const stale = allowlist.filter(
    (e) => !collisions.some((c) => entryCoversCollision(e, c))
  );
  const malformed = allowlist.filter(
    (e) =>
      !e ||
      typeof e.a !== "string" || e.a === "" ||
      typeof e.b !== "string" || e.b === "" ||
      typeof e.clause !== "string" || e.clause === "" ||
      typeof e.reason !== "string" || e.reason === "" ||
      typeof e.decidedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.decidedOn)
  );
  return { uncovered, stale, malformed };
}

/** n*(n-1)/2 -- the number of unordered pairs for `n` skills. Exported so
 * the runner asserts a RELATION against its own scanned count rather than a
 * literal (project memory: census assertions pinned to an exact number go
 * red on a correct tree). */
export function expectedPairCount(n) {
  return (n * (n - 1)) / 2;
}
