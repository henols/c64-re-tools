// requirement-ids.ts -- the ONE place that resolves "which requirement ids
// does this project actually declare".
//
// WHY THIS FILE EXISTS: a milestone close moves the live requirements
// document to an archived, versioned snapshot and removes the live copy (the
// live document is a `git rm`, so the history is kept, not a deletion of the
// record). Between that close and the next milestone's open, the live
// document does not exist at all -- a designed, recurring state, not an
// error condition. Two guards independently derived a set of declared ids by
// reading the live document only, with a same-shaped fallback to the single
// newest archived snapshot when the live document was absent. That is not
// enough: an id that was live during a PAST milestone and cited by
// already-shipped code is real and declared, but resolves nowhere once a
// later milestone closes and only the newest snapshot is consulted -- a
// correct tree goes red purely because a milestone rotated. The fix is to
// union every source that has ever legitimately held the live document: the
// current live file, if present, plus every archived snapshot, not just the
// newest one.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: parsing bold `**FAMILY-NN**`
// requirement-id declarations out of the live requirements document and
// every archived requirements snapshot, and returning the union as one set.
// A caller that needs to know whether a cited id is real calls this instead
// of re-deriving its own reader.
//
// WHAT NOT TO DO: do not relax the membership check this module backs into a
// shape check (matching the id's `FAMILY-NN` pattern without checking it is
// actually declared anywhere). The entire point of a caller checking
// membership against this module's result is that a cited id is a REAL one --
// a plausible-looking id that nothing declares is exactly the rubber stamp
// this kind of register exists to prevent. Widening the sources this module
// reads is fine and expected as the project grows more archived snapshots;
// weakening what counts as "declared" is not.
//
// Dependency-free: node:fs and node:path only, so nothing that imports this
// pulls in anything heavier than the filesystem.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A requirement id in this project's own `FAMILY-NN` shape. */
const REQUIREMENT_ID_RE = /\*\*([A-Z][A-Z0-9]*(?:-[0-9]+)+)\*\*/g;

export interface DeclaredRequirementIdsResult {
  /** Every requirement id declared, bolded, in any source this function read. */
  ids: ReadonlySet<string>;
  /** Every document actually read to build `ids`, in read order -- for a
   * caller's own assertion/error messages, so a reader is pointed at every
   * document that is authoritative rather than at a single path that is no
   * longer the whole truth. */
  sources: readonly string[];
}

/**
 * Resolves the full set of declared requirement ids for the project rooted at
 * `root` -- the live `.planning/REQUIREMENTS.md` (when present) UNION every
 * archived `.planning/milestones/v*-REQUIREMENTS.md` snapshot.
 *
 * `root` is taken as an explicit argument rather than resolved internally,
 * matching this project's existing convention for path-taking helpers
 * (`hostpath.ts`, `containerpath.ts` both take the workspace root explicitly
 * rather than deriving it themselves).
 *
 * Throws, naming both locations, when NEITHER the live document nor any
 * archived snapshot exists. An absent set would make every membership check
 * against it vacuously true, which is the failure this whole resolver exists
 * to prevent -- so a caller with no source to read is a loud error, never a
 * silent empty set.
 */
export function declaredRequirementIds(root: string): DeclaredRequirementIdsResult {
  const sources: string[] = [];
  const ids = new Set<string>();

  const livePath = join(root, ".planning", "REQUIREMENTS.md");
  if (existsSync(livePath)) {
    sources.push(livePath);
    collectIds(ids, readFileSync(livePath, "utf8"));
  }

  const archiveDir = join(root, ".planning", "milestones");
  const archived = existsSync(archiveDir)
    ? readdirSync(archiveDir)
        .filter((name) => /^v.*-REQUIREMENTS\.md$/.test(name))
        .sort()
    : [];
  for (const name of archived) {
    const path = join(archiveDir, name);
    sources.push(path);
    collectIds(ids, readFileSync(path, "utf8"));
  }

  if (sources.length === 0) {
    throw new Error(
      `no requirements document found: ${livePath} is absent and ${archiveDir} holds no v*-REQUIREMENTS.md snapshot. ` +
        "One of the two must exist -- an absent set would make every membership check against it vacuous.",
    );
  }

  return { ids, sources };
}

function collectIds(into: Set<string>, text: string): void {
  for (const match of text.matchAll(REQUIREMENT_ID_RE)) into.add(match[1]);
}
