#!/usr/bin/env node
// Mechanical check behind REPOINT-01 and REPOINT-02: every documented
// `anno <verb> ...` invocation in BOTH skill trees is ARGUMENT-CHECKED --
// every flag against the verb's real accepted option set, and every positional
// against the file kinds that verb actually reads.
//
// WHY A SECOND SKILL GATE (29-VERIFICATION.md gap 2, review ids CR-04/CR-05).
// `scripts/check-skill-tool-coverage.mjs` resolves tool and verb NAMES. It is
// correct at that, and it is also why two documented commands shipped DEAD
// while it was green: `anno render-memmap game.regen2000proj --provenance ...`
// (the positional named a file the store opener refuses, exit 1) and
// `anno coverage game.prg --store ...` (the positional was decoded as the same
// retired format, printing a report of zeros, exit 1). Right verb, wrong
// argument, invisible to a name-only floor. A gate that cannot see a dead
// command is the structural reason the next re-pointing would ship the same
// way, so this is the sibling that checks the arguments.
//
// This script only ever `readFileSync()`s and matches skill content, and
// imports exactly one first-party TypeScript module from `src/mcp/vice/`
// (`anno-cli.ts`, for its own exported `VERB_OPTIONS` -- Node's native
// type-stripping resolves it with no build step and no flag, exactly as the
// sibling gate already imports `capability-registry.ts`). It never
// `import()`s, `require()`s, `eval()`s or spawns anything from either skill
// tree: skill content is untrusted input that is MATCHED, never executed
// (T-29-16-03).
//
// The one child process it does start is FIRST-PARTY and is not skill content:
// `installer/scripts/sync-skills.mjs`, run first so the SHIPPED copy scanned is
// current rather than stale. `installer/skills/` is generated and gitignored;
// without the sync this gate would silently check half the corpus and still
// clear its floor.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VERB_OPTIONS } from "../src/mcp/vice/anno-cli.ts";
import { parseDocumentedInvocations, checkInvocation, ANNO_INVOCATION_FLOOR } from "./lib/anno-cli-invocations.mjs";
import { walkSkills } from "./lib/skill-corpus.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const errors = [];
const need = (cond, msg) => {
  if (!cond) errors.push(msg);
};

// ---------------------------------------------------------------------------
// The per-verb positional kinds.
//
// ONE FROZEN MAP, and it MIRRORS two functions rather than inventing a third
// truth. A future image or store format is added HERE and in the function
// named beside it, in the same commit:
//
//   coverage <program>      -> `loadProjectImage()` in
//                              `src/mcp/vice/anno-coverage.ts`, whose dispatch
//                              is `.prg` (load address plus payload) or an
//                              exactly-65536-byte flat capture named `.raw` or
//                              `.bin`. The retired `.regen2000proj`/`.project`
//                              JSON form is still ACCEPTED by that function so
//                              an existing file is not broken, but it has no
//                              producer left in this repo, so it is
//                              deliberately NOT listed as a kind a playbook
//                              may document: a gate that blessed it would let
//                              CR-05 be re-documented verbatim.
//
//   render-memmap <store>   -> `openStore()` in `src/mcp/vice/anno-store.ts`.
//                              That function enforces no extension at all --
//                              it opens a SQLite database by path -- so this
//                              entry pins the shipped CONVENTION rather than a
//                              code check, and its job is to catch a positional
//                              naming a different ARTEFACT KIND in the store
//                              slot. That is exactly CR-04:
//                              `game.regen2000proj` in the store slot, refused
//                              at runtime with "not an annotation store".
// ---------------------------------------------------------------------------
const POSITIONAL_KINDS = Object.freeze({
  coverage: Object.freeze([".prg", ".raw", ".bin"]),
  "render-memmap": Object.freeze([".annostore", ".store"]),
});

// ---------------------------------------------------------------------------
// The corpus: BOTH trees.
// ---------------------------------------------------------------------------
try {
  execFileSync(process.execPath, [join(ROOT, "installer/scripts/sync-skills.mjs")], { cwd: ROOT, stdio: "pipe" });
} catch (err) {
  errors.push(`could not regenerate installer/skills/ -- the shipped copy cannot be checked: ${err instanceof Error ? err.message : String(err)}`);
}

const TREES = [
  { name: "src/skills", dir: join(ROOT, "src/skills") },
  { name: "installer/skills", dir: join(ROOT, "installer/skills") },
];

const invocations = [];
const filesWithFences = new Set();
let filesScanned = 0;

for (const tree of TREES) {
  const files = walkSkills(tree.dir);
  need(files.length > 0, `non-vacuity: no skill files found under ${tree.name} -- the corpus walk or the tree itself has regressed`);
  for (const file of files) {
    filesScanned++;
    const parsed = parseDocumentedInvocations(readFileSync(file, "utf8"));
    // `null` means "no fenced block at all", which is a legitimate state for a
    // prose-only file. It is NOT the same as an empty array, and conflating
    // them is how a broken extractor reads as a clean tree.
    if (parsed === null) continue;
    filesWithFences.add(file);
    for (const invocation of parsed) invocations.push({ file: file.slice(ROOT.length + 1), invocation });
  }
}

// ---------------------------------------------------------------------------
// The non-vacuity floor, asserted BEFORE any per-invocation result.
//
// Order is load-bearing: a broken extractor must fail LOUDLY here rather than
// report a clean run over zero invocations (T-29-16-05).
// ---------------------------------------------------------------------------
need(
  invocations.length >= ANNO_INVOCATION_FLOOR,
  `non-vacuity: expected at least ${ANNO_INVOCATION_FLOOR} documented anno CLI invocations across both skill trees, got ${invocations.length} -- ` +
    "the extractor, the skill playbooks or installer/skills/'s regeneration may have regressed. Do NOT lower the floor to make this pass.",
);

for (const { file, invocation } of invocations) {
  for (const problem of checkInvocation(invocation, VERB_OPTIONS, POSITIONAL_KINDS)) {
    need(false, `${file}: ${problem}`);
  }
}

// --- Report ----------------------------------------------------------------
if (errors.length) {
  console.error("check-skill-cli-invocations: FAIL");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const verbsCovered = [...new Set(invocations.map((i) => i.invocation.verb))].sort();
console.log(
  `check-skill-cli-invocations: OK -- ${invocations.length} documented anno CLI invocation(s) extracted from ` +
    `${filesWithFences.size} of ${filesScanned} skill file(s) across ${TREES.length} trees (${TREES.map((t) => t.name).join(", ")}); ` +
    `${verbsCovered.length} verb(s) covered (${verbsCovered.join(", ")}); ` +
    `every flag checked against anno-cli.ts's own VERB_OPTIONS and every positional against the kinds its loader reads.`,
);
