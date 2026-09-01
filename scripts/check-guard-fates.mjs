#!/usr/bin/env node
// scripts/check-guard-fates.mjs
//
// WHY THIS FILE EXISTS: the previous milestone re-pointed a large set of
// guards and CI scripts off a subject that has since been deleted. Each move
// was proven non-vacuous individually, at the commit that moved it. What was
// never done is the MECHANICAL SWEEP over the whole set at once, on a settled
// tree: for every guard that was pinned to the deleted subject, is there a
// RECORDED, NON-VACUOUS fate -- re-pointed onto a live subject and observed
// failing against it, deleted with its removing commit named, superseded, or
// deliberately kept with an explicit future removal trigger? A guard that was
// quietly left asserting nothing is invisible to every other check in this
// repo, because a vacuous guard is GREEN.
//
// This file answers exactly one question: does the fate registry at
// `.planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json` carry
// a well-formed, evidence-backed row for every member of the audited set, and
// nothing else?
//
// WHAT NOT TO DO:
//  - Do not hand-type a list of member paths anywhere in this file. The
//    audited set is DERIVED, from the git object store at two pinned commits
//    and from one committed document. A hand-typed list is precisely how a
//    guard silently drops out of the set this script protects -- and this
//    script exists because that already happened once.
//  - Do not add a waiver file, an environment-variable override, a skip flag
//    or any other relaxation hatch. There is deliberately no such thing here.
//    Testability comes from the `--root <dir>` flag, contained by
//    `scripts/lib/audit-root.mjs`.
//  - Do not let an absent pinned commit degrade into a cached or partial list.
//    CI's `actions/checkout@v4` step has no `with:` block, so the runner's
//    clone is shallow and NEITHER pinned commit is present until that step
//    grows `fetch-depth: 0`. That state must be a loud, named failure, not a
//    smaller set.
//  - Never evaluate, dynamically import or shell-execute any text this script
//    reads -- not registry values, not document text, not git output. The only
//    subprocess it spawns is `git`, always with an argv ARRAY, never a shell
//    string.
//  - Do not spell the deleted subject's full name in this file. It lives
//    inside the removal gate's scope (`git ls-files` minus the `.planning/`
//    prefix) and that gate asserts EXACT per-exemption hit counts, so a single
//    mention here -- in a name, a comment, an error message or a sample path
//    -- reds an unrelated gate on this file's own landing commit. Where the
//    removal gate must be referred to, it is referred to BY ROLE.
//
// PRE-DECLARED RED: from its landing commit until the registry is complete,
// this script is EXPECTED to exit non-zero, naming the members that have no
// row. It is deliberately not wired into CI until the registry is complete and
// green. Nothing in this phase is recorded green over it while it is red.
//
// Exported surface (all directory-parameterised; no globals, no env reads):
// `AUDIT_COMMIT`, `AUDIT_END`, `SET_A_FLOOR`, `SET_B_FLOOR`, `SET_C_FLOOR`,
// `TOTAL_FLOOR`, `VERDICTS`, `deriveAuditedSet`, `resolveSetC`,
// `parseDeferredFateNote`, `nameDescendantCandidates`, `checkGuardFates`,
// `REGISTRY_REL_PATH`.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRootArg, resolveContainedRoot } from "./lib/audit-root.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

// ---------------------------------------------------------------------------
// The two pinned commits
// ---------------------------------------------------------------------------

/** The milestone open. Both of the audited requirement's historical figures
 * (32 test files, 11 `scripts/` files) reproduce against this tree exactly. */
export const AUDIT_COMMIT = "0394cbc";

/** The settled tree the forward map is measured against: after the
 * re-pointing milestone closed and before this phase's own commits. */
export const AUDIT_END = "345d5c4";

/** Where the registry lives, relative to the run's root. */
export const REGISTRY_REL_PATH =
  ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json";

/** The document that mandates set C, relative to the run's root. */
const ROADMAP_REL_PATH = ".planning/ROADMAP.md";

/** The heading that opens this phase's section of that document. */
const ROADMAP_SECTION_RE = /^### Phase 32\b/;

/** The sentence that opens the deferred-fates note inside that section. */
const DEFERRED_NOTE_MARKER = "Two guard fates were DEFERRED";

// ---------------------------------------------------------------------------
// FLOORS
//
// Each floor is asserted with `!==`, not `>=`, for its own set: this registry's
// job is a BIJECTION between the derived set and the rows, and a derivation
// that silently shrinks is the exact failure mode the audit exists to catch. A
// set that grows is equally a signal -- it means the object store or the
// mandating document changed under a pinned commit, which cannot happen by
// accident.
//
// A floor moves ONLY in the same commit that changes the derivation predicate
// it measures, with the new figure re-measured against these same two pinned
// commits and the command that produced it recorded in the phase's
// reconciliation document. Copying a figure out of a research or context
// document without re-running its command is how this milestone has already
// had to correct numbers twice.
// ---------------------------------------------------------------------------

/** Set A: members derived at `AUDIT_COMMIT`. 32 test files (19 name-carrying
 * plus 13 that reference the subject in content) + 11 `scripts/` files = 43.
 * A LOWER count means the ls-tree walk or the content predicate has broken and
 * is finding almost nothing -- a vacuous audit. A HIGHER count means the
 * predicate widened without its floor moving. */
export const SET_A_FLOOR = 43;

/** Set B: net-new members created between the two pinned commits, after the
 * adjacency subtraction. MEASURED 16, not the 15 this plan's own arithmetic
 * predicted: the plan subtracted 7 already-claimed successors from 22 raw
 * candidates, but one of those 7 (`scripts/lib/anno-cli-verbs.d.mts`) is not
 * among the 22 -- its content at `AUDIT_END` carries no mention of the subject,
 * so the set-B content predicate never admits it, so there is nothing to
 * subtract it from. 22 - 6 = 16. See this phase's
 * `evidence/32-audited-set-reconciliation.md` for the commands. */
export const SET_B_FLOOR = 16;

/** Set C: the guard fates the roadmap explicitly DEFERS to this phase. They
 * are pinned to the deleted subject through twelve committed coverage fixtures
 * rather than through their own text, so neither the set-A nor the set-B
 * content predicate reaches them. */
export const SET_C_FLOOR = 2;

/** 43 + 16 + 2. The union INCLUDES set C: an arithmetic that omits it
 * contradicts this constant and reds the guard for a reason that has nothing
 * to do with the audit. */
export const TOTAL_FLOOR = 61;

/** The four fates a row may record. Exactly these, no others: an unrecognised
 * verdict is a structural failure, because the evidence a row OWES is decided
 * by its verdict and an unknown verdict owes nothing. */
export const VERDICTS = ["re-pointed", "deleted", "superseded", "kept-unchanged"];

/** Matches the deleted subject's SHORT form, which is what both content
 * predicates key on. Deliberately not the full literal (see the name
 * discipline note in this file's header). */
const SUBJECT_RE = /r2000/i;

/** The short-form prefix a name-carrying member's basename starts with. */
const SUBJECT_PREFIX = "r2000-";

/** The prefixes a renamed successor's basename may carry instead. Both were
 * used by the re-pointing milestone; the empty string covers the successors
 * that dropped the prefix entirely. */
const SUCCESSOR_PREFIXES = ["anno-", "absorbed-", ""];

/** In-scope test paths at either commit. */
const TEST_PATH_RE = /^src\/mcp\/vice\/.*\.test\.[a-z]+$/;

/** The planted-fixture prefix set B also admits. */
const PLANTED_FIXTURE_RE = /^src\/mcp\/vice\/fixtures\/planted-/;

/** The other in-scope tree. */
const SCRIPTS_RE = /^scripts\//;

// ---------------------------------------------------------------------------
// git access -- argv arrays only, never a shell string
// ---------------------------------------------------------------------------

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Content of `path` at `commit`, or `""` when the object does not exist.
 * Read as UTF-8: a NUL byte survives the decode as U+0000 and the regex
 * below still matches around it, which is the property a `grep`-backed
 * implementation does NOT have on a NUL-carrying file. */
function showAt(root, commit, path) {
  try {
    return git(root, ["show", `${commit}:${path}`]);
  } catch {
    return "";
  }
}

/** Fail-closed presence check for both pinned commits. */
function assertPinnedCommitsPresent(root) {
  for (const commit of [AUDIT_COMMIT, AUDIT_END]) {
    let type = "";
    try {
      type = git(root, ["cat-file", "-t", commit]).trim();
    } catch (err) {
      throw new Error(
        `pinned commit ${commit} is not present in this clone's object store ` +
          `(${err?.message ?? String(err)}). The audited set is DERIVED from it, so this is a ` +
          "hard failure rather than a smaller set. On CI this means the checkout step needs " +
          "`fetch-depth: 0`: `actions/checkout@v4` has no `with:` block in this repo's workflow, " +
          "so the runner's clone is shallow (depth 1) and neither pinned commit exists.",
      );
    }
    if (type !== "commit") {
      throw new Error(
        `pinned ref ${commit} resolves to a git object of type "${type}", not a commit. The ` +
          "derivation refuses to run against anything else rather than silently deriving from a " +
          "tree or a tag it was not measured against.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Set A -- derived at AUDIT_COMMIT
// ---------------------------------------------------------------------------

function deriveSetA(root) {
  // `--full-tree` makes the pathspec repo-root-relative rather than
  // cwd-relative, so a `--root` pointing at a subdirectory still derives the
  // same set instead of silently deriving the empty set.
  const listed = git(root, [
    "ls-tree",
    "-r",
    "--full-tree",
    "--name-only",
    AUDIT_COMMIT,
    "--",
    "src/mcp/vice",
    "scripts",
  ])
    .split("\n")
    .filter(Boolean);

  const members = [];
  for (const path of listed) {
    const base = path.slice(path.lastIndexOf("/") + 1);
    if (TEST_PATH_RE.test(path)) {
      if (base.startsWith(SUBJECT_PREFIX) || SUBJECT_RE.test(showAt(root, AUDIT_COMMIT, path))) {
        members.push(path);
      }
    } else if (SCRIPTS_RE.test(path)) {
      if (SUBJECT_RE.test(path) || SUBJECT_RE.test(showAt(root, AUDIT_COMMIT, path))) {
        members.push(path);
      }
    }
  }
  return { members: members.sort(), listedCount: listed.length };
}

// ---------------------------------------------------------------------------
// The forward map -- what each set-A member became
//
// This is what the adjacency subtraction below needs, and it must be
// MECHANICAL: deriving it from the registry's own `newSubject` fields would
// make the derived set shrink as rows are added, so the same tree would report
// a different set size at every stage of the sweep and no floor could ever
// hold. Two mechanisms, in order:
//
//  1. git's own rename detection between the two pinned commits. It resolves
//     8 of the renames.
//  2. the name-descendant predicate for the ones git's similarity heuristic
//     scores as a delete plus an unrelated add: same directory, basename with
//     the subject prefix replaced by a successor prefix (or dropped). This is
//     the predicate the previous milestone's own verification document already
//     established, and it is AUTHORITATIVE over git's output where the two
//     disagree.
// ---------------------------------------------------------------------------

/** The candidate successor paths for a name-carrying member, in preference
 * order. Exported so the reconciliation document and the test drive the same
 * predicate the derivation does. */
export function nameDescendantCandidates(path) {
  const cut = path.lastIndexOf("/");
  const dir = path.slice(0, cut + 1);
  const base = path.slice(cut + 1);
  if (!base.startsWith(SUBJECT_PREFIX)) return [];
  const stem = base.slice(SUBJECT_PREFIX.length);
  return SUCCESSOR_PREFIXES.map((prefix) => `${dir}${prefix}${stem}`);
}

function deriveForwardMap(root, setA) {
  const atEnd = new Set(
    git(root, ["ls-tree", "-r", "--full-tree", "--name-only", AUDIT_END])
      .split("\n")
      .filter(Boolean),
  );

  const gitRenames = new Map();
  for (const line of git(root, ["diff", "-M", "--name-status", AUDIT_COMMIT, AUDIT_END])
    .split("\n")
    .filter(Boolean)) {
    const parts = line.split("\t");
    if (parts[0].startsWith("R") && parts.length >= 3) gitRenames.set(parts[1], parts[2]);
  }

  const samePath = [];
  const renamed = new Map();
  const gone = [];
  for (const member of setA) {
    if (atEnd.has(member)) {
      samePath.push(member);
      continue;
    }
    const viaGit = gitRenames.get(member);
    if (viaGit !== undefined && atEnd.has(viaGit)) {
      renamed.set(member, { newSubject: viaGit, via: "git-rename-detection" });
      continue;
    }
    const viaName = nameDescendantCandidates(member).find((c) => c !== member && atEnd.has(c));
    if (viaName !== undefined) {
      renamed.set(member, { newSubject: viaName, via: "name-descendant" });
      continue;
    }
    gone.push(member);
  }
  return { samePath, renamed, gone, atEnd };
}

// ---------------------------------------------------------------------------
// Set B -- net-new members between the two pinned commits
// ---------------------------------------------------------------------------

function deriveSetB(root, claimedNewSubjects) {
  // No pathspec: a pathspec on `git diff` is cwd-relative and there is no
  // `--full-tree` for it, so the scope filter below does the same job in a
  // cwd-independent way.
  const added = git(root, [
    "diff",
    "--name-only",
    "--diff-filter=A",
    AUDIT_COMMIT,
    AUDIT_END,
  ])
    .split("\n")
    .filter(Boolean);

  const candidates = [];
  for (const path of added) {
    const inScope =
      TEST_PATH_RE.test(path) || PLANTED_FIXTURE_RE.test(path) || SCRIPTS_RE.test(path);
    if (!inScope) continue;
    if (SUBJECT_RE.test(path) || SUBJECT_RE.test(showAt(root, AUDIT_END, path))) {
      candidates.push(path);
    }
  }
  candidates.sort();
  // THE ADJACENCY RULE. A path that is both a set-A member's successor and a
  // set-B candidate gets exactly ONE row -- the set-A row that already claims
  // it. Without this subtraction a renamed member would be audited twice, once
  // under its historical path and once under its new one, and the second row
  // would owe evidence nobody can supply.
  const claimed = candidates.filter((p) => claimedNewSubjects.has(p));
  const members = candidates.filter((p) => !claimedNewSubjects.has(p));
  return { members, candidates, claimed };
}

// ---------------------------------------------------------------------------
// Set C -- parsed out of the document that mandates it
// ---------------------------------------------------------------------------

/**
 * Isolates this phase's section of the roadmap, then the deferred-fates note
 * inside it, then every backticked token in that note that names a source
 * file. Throws -- never returns a smaller set -- when the section or the note
 * cannot be found, so a note that is reworded past the parse is LOUD.
 */
export function parseDeferredFateNote(roadmapText) {
  const lines = String(roadmapText ?? "").split("\n");
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (ROADMAP_SECTION_RE.test(lines[i])) {
      sectionStart = i;
      break;
    }
  }
  if (sectionStart === -1) {
    throw new Error(
      `set C: ${ROADMAP_REL_PATH} has no section matching ${ROADMAP_SECTION_RE} -- the document ` +
        "that MANDATES the deferred guard fates is the authority for them, so a heading that " +
        "moved must fail here rather than yield an empty set C.",
    );
  }
  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]) || /^### Phase \d+/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  let noteStart = -1;
  for (let i = sectionStart; i < sectionEnd; i++) {
    if (lines[i].includes(DEFERRED_NOTE_MARKER)) {
      noteStart = i;
      break;
    }
  }
  if (noteStart === -1) {
    throw new Error(
      `set C: no note beginning ${JSON.stringify(DEFERRED_NOTE_MARKER)} was found inside ` +
        `${ROADMAP_REL_PATH}'s Phase 32 section (lines ${sectionStart + 1}-${sectionEnd}). That ` +
        "note is the ONLY source for the deferred guard fates. A reworded note must be a hard " +
        "failure naming the note, never a silently smaller set C.",
    );
  }
  // The note is the bullet plus its indented sub-bullets: it ends at the next
  // TOP-LEVEL list item, which is the only thing that reliably closes it.
  let noteEnd = sectionEnd;
  for (let i = noteStart + 1; i < sectionEnd; i++) {
    if (/^- /.test(lines[i])) {
      noteEnd = i;
      break;
    }
  }
  const note = lines.slice(noteStart, noteEnd).join("\n");
  const tokens = [...note.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((t) => /\.(ts|mjs|d\.mts)$/.test(t));

  return { note, tokens, noteStartLine: noteStart + 1, noteEndLine: noteEnd };
}

/**
 * Resolves the note's tokens against the tracked file list, requiring EXACTLY
 * ONE match per token (the note names one member by bare basename and one by
 * full path) and exactly `SET_C_FLOOR` tokens.
 */
export function resolveSetC({ roadmapText, trackedPaths }) {
  const parsed = parseDeferredFateNote(roadmapText);
  const { note, tokens } = parsed;
  if (tokens.length !== SET_C_FLOOR) {
    throw new Error(
      `set C: the deferred-fates note parsed to ${tokens.length} source-file token(s), expected ` +
        `exactly ${SET_C_FLOOR} (${JSON.stringify(tokens)}). The note is the authority and a ` +
        "parse that finds a different number must be loud, not silent. The note as parsed was:\n" +
        note,
    );
  }
  const members = [];
  for (const token of tokens) {
    const matches = trackedPaths.filter((p) => p === token || p.endsWith(`/${token}`));
    if (matches.length !== 1) {
      throw new Error(
        `set C: token \`${token}\` from the deferred-fates note resolved to ${matches.length} ` +
          `tracked path(s) (${JSON.stringify(matches)}), expected exactly 1. Zero means the note ` +
          "names something that is no longer tracked; more than one means the token is ambiguous " +
          "and the note must name it by full path.",
      );
    }
    members.push(matches[0]);
  }
  return { members: members.sort(), tokens, note, ...parsed };
}

// ---------------------------------------------------------------------------
// THE DERIVATION
// ---------------------------------------------------------------------------

/**
 * Derives the audited set from the object store at the two pinned commits plus
 * the one document that mandates set C.
 *
 * @param {{ root: string, roadmapText?: string }} options
 *        `roadmapText` is a TEST SEAM, not a hatch: it is never supplied by the
 *        CLI, and every value it can take either leaves the derivation
 *        unchanged or makes `resolveSetC` THROW. It cannot make a red run
 *        green.
 */
export function deriveAuditedSet({ root, roadmapText } = {}) {
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("deriveAuditedSet: `root` is required and must be a non-empty path.");
  }
  assertPinnedCommitsPresent(root);

  // Set C first: it is cheap, and it is the half a reworded document breaks,
  // so failing here costs one file read rather than a full object-store walk.
  const trackedPaths = git(root, ["ls-files", "-z", "--full-name"])
    .split("\0")
    .filter(Boolean);
  const roadmap =
    roadmapText !== undefined ? roadmapText : readFileSync(join(root, ROADMAP_REL_PATH), "utf8");
  const setCParse = resolveSetC({ roadmapText: roadmap, trackedPaths });

  const { members: setA, listedCount } = deriveSetA(root);
  const forward = deriveForwardMap(root, setA);
  const claimedNewSubjects = new Set([...forward.renamed.values()].map((r) => r.newSubject));
  const setBParse = deriveSetB(root, claimedNewSubjects);

  // The adjacency subtraction applies to set C too. Measured: it removes
  // neither member, but the subtraction is unconditional so a future note
  // naming a path that is already some set-A member's successor still yields
  // one row rather than two.
  const setBSet = new Set(setBParse.members);
  const setC = setCParse.members.filter((p) => !claimedNewSubjects.has(p) && !setBSet.has(p));

  const union = [...new Set([...setA, ...setBParse.members, ...setC])].sort();

  return {
    auditCommit: AUDIT_COMMIT,
    auditEnd: AUDIT_END,
    setA,
    setB: setBParse.members,
    setC,
    union,
    // Provenance, for the reconciliation document and the report line.
    listedAtAuditCommit: listedCount,
    setBCandidates: setBParse.candidates,
    setBClaimed: setBParse.claimed,
    forwardSamePath: forward.samePath,
    forwardRenamed: [...forward.renamed.entries()].map(([historicalPath, r]) => ({
      historicalPath,
      ...r,
    })),
    forwardGone: forward.gone,
    setCTokens: setCParse.tokens,
    setCNoteLine: setCParse.noteStartLine,
  };
}

// ---------------------------------------------------------------------------
// THE PREDICATE
// ---------------------------------------------------------------------------

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonZeroInteger(v) {
  return typeof v === "number" && Number.isInteger(v) && v !== 0;
}

/**
 * The membership-and-evidence predicate. PURE: no filesystem and no git. The
 * one thing it needs from the outside world -- "does this path exist on the
 * working tree" -- is injected as `exists`, so the colocated test drives THIS
 * function rather than a re-implementation of it.
 *
 * @param {{ derived: object, registry: object, exists?: (relPath: string) => boolean }} args
 * @returns {string[]} accumulated error messages; empty means the registry is
 *          a well-formed bijection over the derived set with every row's owed
 *          evidence present.
 */
export function checkGuardFates({ derived, registry, exists } = {}) {
  const errors = [];
  const need = (cond, msg) => {
    if (!cond) errors.push(msg);
  };

  if (derived === null || typeof derived !== "object") {
    return ["checkGuardFates: `derived` must be the object deriveAuditedSet() returns."];
  }
  if (registry === null || typeof registry !== "object") {
    return [`checkGuardFates: ${REGISTRY_REL_PATH} did not parse to an object.`];
  }
  if (typeof exists !== "function") {
    return [
      "checkGuardFates: `exists` (relPath => boolean) is required. It is injected rather than " +
        "read from the filesystem here so this predicate stays pure and its own test drives it " +
        "directly; defaulting it to a function that always returns true would silently pass " +
        "every working-tree assertion below.",
    ];
  }

  const setA = Array.isArray(derived.setA) ? derived.setA : [];
  const setB = Array.isArray(derived.setB) ? derived.setB : [];
  const setC = Array.isArray(derived.setC) ? derived.setC : [];
  const union = Array.isArray(derived.union) ? derived.union : [];
  const rows = Array.isArray(registry.rows) ? registry.rows : [];

  // --- (5) structural emptiness, checked FIRST so a vacuous run cannot read
  // --- as a pass on the strength of "no discrepancies found".
  need(
    union.length !== 0,
    "structural: the derived audited set is EMPTY. An empty set makes every membership check " +
      "below vacuously true, so it is a hard failure rather than a pass. Either the object-store " +
      "walk broke or both derivation predicates stopped matching.",
  );
  need(
    rows.length !== 0,
    `structural: ${REGISTRY_REL_PATH} carries ZERO rows. An empty registry is a structural ` +
      "failure, never a green: the whole point of this check is that every audited guard has a " +
      "recorded fate.",
  );

  // --- (4) floors -------------------------------------------------------
  need(
    setA.length === SET_A_FLOOR,
    `floor: set A derived ${setA.length} member(s), expected exactly ${SET_A_FLOOR}. A LOWER ` +
      "count means the ls-tree walk or the content predicate has broken and the audit is " +
      "measuring almost nothing; a HIGHER count means the predicate widened without its floor " +
      "moving in the same commit.",
  );
  need(
    setB.length === SET_B_FLOOR,
    `floor: set B derived ${setB.length} member(s), expected exactly ${SET_B_FLOOR}. A LOWER ` +
      "count means the added-file diff or the adjacency subtraction has broken; a HIGHER count " +
      "means net-new in-scope files landed between the pinned commits without this floor moving.",
  );
  need(
    setC.length === SET_C_FLOOR,
    `floor: set C derived ${setC.length} member(s), expected exactly ${SET_C_FLOOR}. A LOWER ` +
      "count means the mandating note was reworded past the parse or the adjacency subtraction " +
      "swallowed a member; a HIGHER count means the note grew a fate whose row nobody added.",
  );
  need(
    union.length >= TOTAL_FLOOR,
    `floor: the derived union is ${union.length}, below the recorded floor ${TOTAL_FLOOR} ` +
      `(${SET_A_FLOOR} + ${SET_B_FLOOR} + ${SET_C_FLOOR}). A union below the floor means the ` +
      "derivation shrank; a union that omits set C entirely contradicts this constant and reds " +
      "this check for a reason that has nothing to do with the audit.",
  );

  // --- registry header agrees with the constants -------------------------
  const headerPins = [
    ["auditCommit", registry.auditCommit, AUDIT_COMMIT],
    ["auditEnd", registry.auditEnd, AUDIT_END],
    ["setAFloor", registry.setAFloor, SET_A_FLOOR],
    ["setBFloor", registry.setBFloor, SET_B_FLOOR],
    ["setCFloor", registry.setCFloor, SET_C_FLOOR],
    ["totalFloor", registry.totalFloor, TOTAL_FLOOR],
  ];
  for (const [field, actual, expected] of headerPins) {
    need(
      actual === expected,
      `registry header: \`${field}\` is ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(expected)}. The registry and this script must pin the SAME numbers; a ` +
        "registry that records a different total is contradicting the derivation it is supposed " +
        "to be a bijection with.",
    );
  }
  need(
    isNonEmptyString(registry.derivationNote),
    "registry header: `derivationNote` is missing or empty. One sentence naming the two " +
      "derivation predicates is what lets a later reader tell a legitimate set change from a " +
      "broken walk.",
  );

  // --- (1) every derived member has a row -------------------------------
  const rowsByHistorical = new Map();
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const key = row.historicalPath;
    if (!isNonEmptyString(key)) continue;
    if (!rowsByHistorical.has(key)) rowsByHistorical.set(key, []);
    rowsByHistorical.get(key).push(row);
  }
  for (const member of union) {
    need(
      rowsByHistorical.has(member),
      `no recorded fate: ${member} is in the derived audited set but has no row in ` +
        `${REGISTRY_REL_PATH}. Every audited guard owes a fate; a guard with no row is exactly ` +
        "the invisible-because-green case this check exists to surface.",
    );
  }

  // --- (2) every row names a derived member (the INVERSE direction) -----
  const unionSet = new Set(union);
  for (const row of rows) {
    const key = row?.historicalPath;
    if (!isNonEmptyString(key)) {
      need(
        false,
        `registry row: a row has no non-empty \`historicalPath\` (${JSON.stringify(row)}). The ` +
          "historical path at the pinned commit is the row's primary key.",
      );
      continue;
    }
    need(
      unionSet.has(key),
      `stranger row: ${REGISTRY_REL_PATH} names \`${key}\`, which is NOT in the derived audited ` +
        "set. This direction is what stops the registry drifting into a hand-typed second list " +
        "of members: a row nobody derived is either a typo or an audit of something outside " +
        "scope.",
    );
  }

  // --- (3) duplicates ---------------------------------------------------
  for (const [key, group] of rowsByHistorical) {
    need(
      group.length === 1,
      `duplicate row: \`historicalPath\` ${key} appears ${group.length} times. The primary key ` +
        "is the historical path at the pinned commit and it must appear exactly once -- a path " +
        "that is both a member's successor and a net-new candidate gets ONE row, which is what " +
        "the adjacency subtraction in the derivation guarantees.",
    );
  }
  const newSubjectCounts = new Map();
  for (const row of rows) {
    const ns = row?.newSubject;
    if (!isNonEmptyString(ns)) continue;
    newSubjectCounts.set(ns, (newSubjectCounts.get(ns) ?? 0) + 1);
  }
  for (const [ns, count] of newSubjectCounts) {
    need(
      count === 1,
      `duplicate newSubject: \`${ns}\` is claimed by ${count} rows. Two historical members ` +
        "cannot both have been re-pointed onto the same subject without one of them being a " +
        "double-count; if the merge was deliberate, one row's verdict is `superseded`.",
    );
  }

  // --- (6) and (7) per-verdict evidence rules ---------------------------
  for (const row of rows) {
    const key = isNonEmptyString(row?.historicalPath) ? row.historicalPath : "<unnamed row>";
    const verdict = row?.verdict;
    if (!VERDICTS.includes(verdict)) {
      need(
        false,
        `row ${key}: \`verdict\` is ${JSON.stringify(verdict)}, which is not one of ` +
          `${VERDICTS.join(" | ")}. The verdict decides what evidence the row OWES, so an ` +
          "unrecognised verdict owes nothing and is a structural failure.",
      );
      continue;
    }

    // (7) removalTrigger is owed by every verdict except `deleted`.
    if (verdict !== "deleted") {
      need(
        isNonEmptyString(row.removalTrigger),
        `row ${key}: verdict \`${verdict}\` owes a non-empty \`removalTrigger\` -- the named ` +
          "future condition under which this guard should be removed. Without it a guard that " +
          "outlives its purpose has no recorded exit.",
      );
    }

    const red = row.observedRed;
    const redOwed = (label) => {
      if (red === null || typeof red !== "object") {
        need(
          false,
          `row ${key}: verdict \`${verdict}\` owes an \`observedRed\` object (${label}), got ` +
            `${JSON.stringify(red)}. "The guard asserts it can fail" and "the guard was observed ` +
            'failing against its new subject" are different claims; only the second is evidence.',
        );
        return;
      }
      need(
        isNonZeroInteger(red.exitStatus),
        `row ${key}: \`observedRed.exitStatus\` is ${JSON.stringify(red.exitStatus)}. A recorded ` +
          "fate needs a NON-ZERO integer exit status captured from the guard actually running; " +
          "zero, absent, or a non-integer means no red was observed.",
      );
      need(
        isNonEmptyString(red.command),
        `row ${key}: \`observedRed.command\` is missing or empty. The evidence must carry the ` +
          "literal command a later reader re-runs, not a description of it.",
      );
      need(
        isNonEmptyString(red.excerpt),
        `row ${key}: \`observedRed.excerpt\` is missing or empty. The failing assertion's own ` +
          "text is what distinguishes a genuine red from a guard that failed to start.",
      );
      need(
        red.control !== null && typeof red.control === "object" && red.control.exitStatus === 0,
        `row ${key}: \`observedRed.control.exitStatus\` must be exactly 0. Without a GREEN ` +
          "false-positive control -- the same guard run UNPLANTED, exiting 0 -- a red proves " +
          "nothing: a guard that is red for an unrelated reason, or one that timed out, would " +
          "record a false observed red.",
      );
    };

    if (verdict === "re-pointed") {
      need(
        isNonEmptyString(row.newSubject),
        `row ${key}: verdict \`re-pointed\` owes a non-empty \`newSubject\`.`,
      );
      if (isNonEmptyString(row.newSubject)) {
        need(
          exists(row.newSubject),
          `row ${key}: \`newSubject\` ${row.newSubject} is not on the working tree. A guard ` +
            "cannot be re-pointed onto something that does not exist.",
        );
      }
      redOwed("the re-pointed guard observed failing against its new subject");
    } else if (verdict === "superseded") {
      need(
        isNonEmptyString(row.newSubject),
        `row ${key}: verdict \`superseded\` owes a non-empty \`newSubject\` naming the ` +
          "replacement.",
      );
      if (isNonEmptyString(row.newSubject)) {
        need(
          exists(row.newSubject),
          `row ${key}: the superseding \`newSubject\` ${row.newSubject} is not on the working ` +
            "tree.",
        );
      }
      redOwed("the REPLACEMENT observed failing against its own subject");
    } else if (verdict === "deleted") {
      need(
        row.newSubject === null,
        `row ${key}: verdict \`deleted\` requires \`newSubject: null\`, got ` +
          `${JSON.stringify(row.newSubject)}. A deleted guard has no successor; if it has one, ` +
          "the verdict is `re-pointed` or `superseded`.",
      );
      need(
        !exists(key),
        `row ${key}: verdict \`deleted\` but the historical path is still on the working tree. ` +
          "Either the file was not deleted or the verdict is wrong.",
      );
      need(
        isNonEmptyString(row.removingCommit),
        `row ${key}: verdict \`deleted\` owes a non-empty \`removingCommit\`. The commit that ` +
          "removed it IS the evidence; without it the deletion is a claim rather than a record.",
      );
    } else {
      // kept-unchanged
      need(
        row.newSubject === key,
        `row ${key}: verdict \`kept-unchanged\` requires \`newSubject\` to equal ` +
          `\`historicalPath\`, got ${JSON.stringify(row.newSubject)}.`,
      );
      need(
        exists(key),
        `row ${key}: verdict \`kept-unchanged\` but the path is not on the working tree.`,
      );
      need(
        row.observedRed === undefined || row.observedRed === null,
        `row ${key}: verdict \`kept-unchanged\` owes NO \`observedRed\` -- nothing moved, so ` +
          "there is no re-pointing to prove. Its evidence is the `removalTrigger` instead.",
      );
    }
  }

  return errors;
}

// ===========================================================================
// THE DRIVER -- runs only when this file is the process entry point, so the
// colocated test can import the predicates above without triggering an
// object-store walk and a process.exit() from inside an `import` statement.
// ===========================================================================

// THIS FILE HAS NO ARGV READER OF ITS OWN, BY DESIGN. It had one -- the same
// nine lines that were copy-pasted verbatim into six scripts, so the same
// defect shipped six times (`IN-06`): the loop matched only the exact token
// `--root` and took `argv[i + 1]`, which meant `--root=<dir>`, a valueless
// `--root` and every typo were SILENTLY DISCARDED and the invocation fell
// through to the default root. On THIS file -- the blocking CI fate gate --
// that meant `--root=/tmp` produced a full green report about the REAL
// repository: the audit instrument vouching for a tree it was told not to
// read. `parseRootArg()` in `lib/audit-root.mjs` is now the single argv seam,
// as `resolveContainedRoot()` is the single containment seam.
//
// CORRECTION (2026-09-01, phase 32 gap-closure round 2, plan 32-16).
// `scripts/audit-gate.mjs` IS now on the shared strict parser: it reads its
// arguments through `parseRootArg()` too, declaring `--json` and `--hook` as
// `booleanFlags`, and its own hand-rolled reader is gone. The note that stood
// here SAID that file had deliberately not been migrated (`WR-13`), and gave
// as its reason that the file carried five further flags with their own
// exactly-one-selector rule. That reason was FALSE when it was written.
// Measured: `audit-gate.mjs` accepts three flags in total -- `--root`,
// `--json` and `--hook` -- and has no selector rule at all. The description
// belonged to `scripts/audit-mutation-harness.mjs`, which does carry five
// flags (`--root`, `--row`, `--rows`, `--all`, `--out`) and does enforce an
// exactly-one-of-`--row`/`--rows`/`--all` rule. A justification written about
// one file was copied into six, which is `IN-06` one layer up: the same
// copy-a-claim-without-checking-it failure, in the comments rather than in the
// code. It is corrected here rather than deleted, because a note recording how
// a wrong claim spread is the cheapest protection against it spreading again.
//
// `audit-gate.mjs` is on the argv seam but deliberately NOT on the containment
// seam. The measurement behind that asymmetry, and its named reversal trigger,
// are recorded in that file's own header -- once, there, rather than restated
// in each of the six files this correction touches.
//
// `--root <dir>` and `--json` remain this gate's only surface: there is
// deliberately no environment-variable override, no skip flag and no waiver
// file anywhere in it (the no-relaxation-hatch rule recorded in
// `scripts/audit-gate.mjs`'s header). A root that cannot be honoured REFUSES;
// it never degrades into a silent read of the default root.

const IS_ENTRY_POINT =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_ENTRY_POINT) {
  let rootArg;
  let json = false;
  try {
    const parsed = parseRootArg(process.argv.slice(2), {
      script: "check-guard-fates",
      booleanFlags: ["--json"],
    });
    rootArg = parsed.root;
    json = parsed.flags["--json"] === true;
  } catch (err) {
    // An ARGUMENT REJECTION. Reported before anything is derived or read, and
    // kept at exit 1 like the refusal below: the two are separated by their
    // message (`BAD ARGUMENTS --` versus `REFUSED --`), never by their status.
    console.error(`check-guard-fates: ${err?.message ?? String(err)}`);
    process.exit(1);
  }

  // A REFUSAL (an out-of-repository --root) and a TYPO (a --root that is
  // inside the repository but does not exist, or a tree with no git object
  // store) exit with the same code, so they are separated by their message.
  let root;
  try {
    root = resolveContainedRoot(rootArg, { repoRoot: REPO_ROOT });
  } catch (err) {
    console.error(`check-guard-fates: REFUSED -- ${err?.message ?? String(err)}`);
    process.exit(1);
  }

  let derived;
  let registry;
  try {
    // WR-03: a MISTYPED --root that happens to be inside the repository must
    // be diagnosable as a typo, not surface as a confusing downstream error
    // (before this check, a nonexistent cwd made `git` fail with ENOENT and
    // the run reported "pinned commit is not present", which points a reader
    // at CI's checkout depth instead of at their own typo).
    if (!existsSync(root)) {
      throw new Error(
        `--root resolves to ${root}, which does not exist. This is a TYPO, not a containment ` +
          "refusal: the path is inside the repository root but there is no such directory.",
      );
    }
    derived = deriveAuditedSet({ root });
    const registryPath = join(root, REGISTRY_REL_PATH);
    if (!existsSync(registryPath)) {
      throw new Error(
        `the fate registry is missing at ${registryPath}. It is the artifact this check reads; ` +
          "an absent registry is a hard failure, not an empty one.",
      );
    }
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (err) {
    console.error(
      `check-guard-fates: FAIL (could not derive or load) -- ${err?.message ?? String(err)}`,
    );
    process.exit(1);
  }

  const errors = checkGuardFates({
    derived,
    registry,
    exists: (relPath) => existsSync(join(root, relPath)),
  });

  const measured = {
    setA: derived.setA.length,
    setB: derived.setB.length,
    setC: derived.setC.length,
    total: derived.union.length,
    rows: Array.isArray(registry.rows) ? registry.rows.length : 0,
    floors: {
      setA: SET_A_FLOOR,
      setB: SET_B_FLOOR,
      setC: SET_C_FLOOR,
      total: TOTAL_FLOOR,
    },
  };
  const measuredLine =
    `setA=${measured.setA} setB=${measured.setB} setC=${measured.setC} ` +
    `total=${measured.total} rows=${measured.rows} ` +
    `(floors setA=${SET_A_FLOOR} setB=${SET_B_FLOOR} setC=${SET_C_FLOOR} total=${TOTAL_FLOOR})`;

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: errors.length === 0,
          auditCommit: AUDIT_COMMIT,
          auditEnd: AUDIT_END,
          measured,
          errors,
        },
        null,
        2,
      ),
    );
    process.exit(errors.length === 0 ? 0 : 1);
  }

  if (errors.length) {
    console.error(`check-guard-fates: FAIL -- ${measuredLine}`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }

  console.log(`check-guard-fates: OK -- ${measuredLine}`);
  console.log(
    `  derived from ${derived.listedAtAuditCommit} path(s) at ${AUDIT_COMMIT}; forward map ` +
      `${derived.forwardSamePath.length} same-path / ${derived.forwardRenamed.length} renamed / ` +
      `${derived.forwardGone.length} gone; set B ${derived.setBCandidates.length} raw candidate(s) ` +
      `minus ${derived.setBClaimed.length} already-claimed successor(s); set C parsed from ` +
      `${ROADMAP_REL_PATH} line ${derived.setCNoteLine}.`,
  );
}
