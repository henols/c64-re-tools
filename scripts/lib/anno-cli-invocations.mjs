#!/usr/bin/env node
// scripts/lib/anno-cli-invocations.mjs -- the ONE definition of how a
// documented `anno <verb> ...` invocation is extracted from skill prose and
// ARGUMENT-CHECKED against the CLI's own declarations.
//
// WHY THIS EXISTS (CR-04 and CR-05, 29-VERIFICATION.md gap 2). The phase's own
// coverage gate, `scripts/check-skill-tool-coverage.mjs`, resolves tool and
// verb NAMES and never an invocation's ARGUMENTS. That is correct at what it
// does, and it is also the structural reason TWO documented commands shipped
// DEAD while it was green:
//
//   CR-04  `anno render-memmap game.regen2000proj --provenance ...` -- the
//          positional named the retired analyser's project file, which the
//          store opener plan 29-12 gave that verb refuses outright
//          ("not an annotation store (file is not a database)", exit 1).
//          The VERB existed and was documented, so a name-only floor saw
//          nothing wrong.
//   CR-05  `anno coverage game.prg --store game.annostore` -- printed a full
//          report of zeros and exited 1, because the positional was decoded as
//          the same retired project format. Again: right verb, wrong argument,
//          invisible to a name-only check.
//
// A name-only floor cannot see a dead command. This module is the sibling that
// checks the arguments, so the NEXT re-pointing fails a gate rather than a
// review.
//
// This module is imported by BOTH `scripts/check-skill-cli-invocations.mjs`
// (the CI entry point) and `src/mcp/vice/anno-cli-invocations.test.ts` (the
// committed non-vacuity / planted-violation proof) -- one definition, two
// callers, the same split `scripts/lib/anno-cli-verbs.mjs` already uses and for
// the same recorded reason: the CI script executes its whole check AT IMPORT
// TIME, so a test importing it would re-run the live gate instead of calling
// these predicates in isolation.
//
// Lives under `scripts/lib/`, not `src/mcp/vice/`, on purpose: it has no
// runtime role in the shipped MCP server, so it must stay out of
// `src/mcp/vice/package.json`'s `files[]` (a shipped-runtime allow-list
// enforced by `scripts/check-npm-packages.mjs`), while still being tracked by
// git so `scripts/package.sh`'s `git archive` includes it.
//
// WHAT NOT TO DO:
//   - Never EXECUTE skill content. Nothing here `import()`s, `require()`s,
//     `eval()`s or spawns anything from either skill tree; skill text is
//     untrusted input that is MATCHED, never run. That is
//     `check-skill-tool-coverage.mjs`'s standing rule and this module inherits
//     it without exception (T-29-16-03).
//   - Never hand-type the accepted option set. `VERB_OPTIONS` in
//     `src/mcp/vice/anno-cli.ts` is exported and frozen precisely so a gate can
//     read the CLI's own declaration; a second copy here is the same defect
//     class as the hard-coded verb array `anno-cli-verbs.mjs` was written to
//     avoid.
//   - Never lower `ANNO_INVOCATION_FLOOR` to make a run pass. See its own
//     paragraph below.
//   - Never widen the extraction past FENCED CODE BLOCKS. A gate that fires on
//     prose is one nobody can keep green, and the corpus really does mention
//     these verbs in prose (`c64-ram-capture/SKILL.md` names
//     `vice-mcp anno render-memmap` inline while discussing the sidecar).

/**
 * The subcommand token every documented invocation goes through, renamed
 * `r2000` -> `anno` on 2026-08-29 (plan 29-09). Declared here rather than
 * imported from `anno-cli-verbs.mjs`, which embeds the same token inside a
 * template literal for a different predicate (`verbsMissingFromSkills`); if a
 * future rename moves one, grep for the other in the same commit.
 */
const ANNO_SUBCOMMAND = "anno";

/**
 * The measured count of documented `anno` CLI invocations across BOTH skill
 * trees -- the canonical `src/skills/` and the generated `installer/skills/`
 * -- at authoring time, 2026-08-30.
 *
 * HOW IT WAS MEASURED, so the number is reproducible rather than asserted:
 * `parseDocumentedInvocations()` over every `*.md`/`*.mjs` file both trees
 * hold, after `installer/scripts/sync-skills.mjs` had run. Five invocations
 * live in `src/skills/` -- two `render-memmap` lines in
 * `c64-program-recon/SKILL.md`, the same two in
 * `c64-program-recon/templates/memory-map.template.md`, and one `coverage`
 * line in `routine-queue-walker/SKILL.md` -- and the installer tree is a copy
 * of that tree, so the total is ten. The re-pointing was done first and
 * counted second; this is a measurement, not a target.
 *
 * IT IS A FLOOR AND IT RISES. A phase that documents another invocation raises
 * it to the new true count in the commit that adds the reference. Nothing
 * lowers it to make a regression pass: a documented command REMOVED is a scope
 * decision of the same weight as D-14, written down the same way, and only
 * then does this number come down.
 *
 * IT MUST NEVER BE DERIVED FROM DISK. A floor computed from the thing it
 * guards can never fail -- a broken extractor returning nothing would compute
 * a floor of zero and report a clean run over an empty corpus, which is
 * precisely the failure mode this constant exists against (T-29-16-05).
 */
export const ANNO_INVOCATION_FLOOR = 10;

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
//
//   export-asm <image>      -> `loadImage()` in
//                              `src/mcp/vice/anno-export-asm.ts`, whose
//                              dispatch is a `.prg` (2-byte little-endian load
//                              address then payload) or a flat capture. The
//                              SAME two artefact kinds `coverage <image>`
//                              reads, because it is the same artefact in the
//                              same slot -- and, exactly as there, the retired
//                              JSON project form is deliberately NOT listed.
//                              Added 2026-08-31 with the verb itself: the
//                              committed test asserts every key of the CLI's
//                              own `VERB_OPTIONS` appears in all three tables,
//                              so a verb cannot join the CLI while staying
//                              invisible to this gate.
//
// DECLARED HERE, NOT IN THE GATE SCRIPT, since 2026-08-30 (WR-01). It lived in
// `scripts/check-skill-cli-invocations.mjs` until then, which runs its whole
// check AT IMPORT TIME -- so nothing could import the table without running the
// live gate, and the committed test consequently declared a private COPY. The
// test then proved a fixture while CI ran the shipped map, and the two could
// drift with the suite green. This module is the import-safe home both callers
// already have, so the table moved to where the test can assert against the
// one CI actually uses. One definition, two callers -- the same split
// `scripts/lib/anno-cli-verbs.mjs` uses.
// ---------------------------------------------------------------------------
export const POSITIONAL_KINDS = Object.freeze({
  coverage: Object.freeze([".prg", ".raw", ".bin"]),
  "render-memmap": Object.freeze([".annostore", ".store"]),
  "export-asm": Object.freeze([".prg", ".raw", ".bin"]),
});

// ---------------------------------------------------------------------------
// The per-verb REQUIRED flags.
//
// WHY THIS EXISTS (WR-01, 29-VERIFICATION.md gap 1, `missing` item 4). The
// invocation gate was built so that "a name-only floor cannot see a dead
// command" could not ship twice. It then reported
// `check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) ...`,
// exit 0, for a planted `anno coverage game.prg` at
// `routine-queue-walker/SKILL.md:241` -- a documented command that exits 1.
// Flag MEMBERSHIP and positional EXTENSION were both checked thoroughly; flag
// PRESENCE was not checked at all. That is the same failure mode as the seam
// it was written against: a guard proven on the wrong axis.
//
// EVERY VALUE IS READ OFF THE CLI'S OWN REFUSAL BRANCH, quoted, never guessed:
//
//   coverage       -> `src/mcp/vice/anno-cli.ts`:
//                     "coverage: --store FILE is required -- the annotation
//                      store holds the labels, comments and typed ranges, and
//                      this verb will not derive its path from <project>."
//
//   render-memmap  -> `src/mcp/vice/anno-cli.ts`:
//                     "render-memmap: --provenance FILE is required"
//
//   export-asm     -> `src/mcp/vice/anno-cli.ts`:
//                     "export-asm: --store FILE is required -- the annotation
//                      store holds the ranges, labels, comments and enums, and
//                      this verb will not derive its path from <image>."
//
// A VERB WITH NO VISIBLE REFUSAL BRANCH GETS `[]`, DELIBERATELY AND EXPLICITLY.
// An absent key and an empty array must not read the same: the committed test
// asserts every key of the CLI's own `VERB_OPTIONS` appears here, so a verb
// added later cannot join the gate with its required flags merely undeclared.
// Do not add an entry a refusal branch does not support -- a required-flag
// claim the CLI does not make would red a playbook that is actually correct,
// and a gate nobody can keep green gets switched off.
// ---------------------------------------------------------------------------
export const REQUIRED_FLAGS = Object.freeze({
  coverage: Object.freeze(["--store"]),
  "render-memmap": Object.freeze(["--provenance"]),
  "export-asm": Object.freeze(["--store"]),
});

// ---------------------------------------------------------------------------
// The per-verb, per-flag VALUE kinds.
//
// WHY THIS EXISTS (WR-18, 2026-08-30). `WR-01`'s own proposed fix named this
// map alongside `REQUIRED_FLAGS`; only the latter shipped. The gate therefore
// checked kinds for POSITIONALS and for nothing else, and reported OK for
//
//   anno coverage game.prg --store game.prg
//
// which is `CR-04` VERBATIM -- an artefact of the wrong kind in the store slot,
// refused at runtime with "not an annotation store" -- with the mistake moved
// one token to the right, out of the positional slot and into the flag slot.
// The same class of defect, invisible to the gate built to catch it, because
// the check was bound to a SLOT rather than to the ARGUMENT.
//
// WHAT EACH ENTRY IS GROUNDED IN, read off the code, never guessed:
//
//   coverage --store       -> `openStore()` in `src/mcp/vice/anno-store.ts`.
//                             Same function and same two kinds as
//                             `POSITIONAL_KINDS["render-memmap"]`, because it
//                             is the same artefact reached through a different
//                             slot. Like that entry, this pins the shipped
//                             CONVENTION rather than a code check: `openStore()`
//                             enforces no extension, it opens a SQLite database
//                             by path. Its job is to catch a different
//                             ARTEFACT KIND in the store slot.
//
//   coverage --out         -> `anno-cli.ts`, the report write:
//                             `writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n")`.
//                             A JSON report; USAGE calls it "the JSON report".
//
//   render-memmap --provenance -> the sidecar is JSON-parsed
//                             (`anno-memmap-render.ts`'s sidecar branch, whose
//                             syntax failure is the CR-03 digit-only offset
//                             extractor). A non-JSON file exits 1.
//
//   render-memmap --out    -> the generated Markdown memory map; the verb's own
//                             derived default is `memory-map.md` beside the
//                             store (`anno-cli.ts`, `join(dirname(storePath),
//                             "memory-map.md")`).
//
//   export-asm --store     -> `openStore()` again, same artefact through a
//                             different slot, same two kinds and the same
//                             shipped-CONVENTION caveat as `coverage --store`.
//
//   export-asm --out       -> ACME source text. `.a` is this repo's own
//                             spelling for it -- `src/skills/acme-build/`
//                             assembles `.a` files and the exporter's own
//                             derived default is the image's basename with a
//                             `.a` extension (`anno-cli.ts`,
//                             `defaultExportAsmOut()`). `.asm` is accepted
//                             alongside it because the acme-build playbook
//                             names both spellings as sources it assembles, so
//                             a documented `--out foo.asm` is a live command
//                             rather than a mistake.
//
// A FLAG WITH NO ENTRY IS A FLAG THIS MAP MAKES NO CLAIM ABOUT, and there are
// two deliberate absences rather than oversights: `--force` and `--check` are
// BOOLEAN (they take no value at all), and `--sample N` takes an INTEGER, not a
// path -- an extension table has nothing to say about either. `--sample abc` is
// still refused only at runtime, and that is named in `checkInvocation()`'s own
// list of what it does not check.
//
// A VERB WITH NO VALUE-TAKING FLAG GETS `{}`, DELIBERATELY AND EXPLICITLY, for
// the reason `REQUIRED_FLAGS` gives at length: an absent key and an empty entry
// must not read the same, and the committed test asserts every key of the CLI's
// own `VERB_OPTIONS` appears here.
// ---------------------------------------------------------------------------
export const FLAG_KINDS = Object.freeze({
  coverage: Object.freeze({
    "--store": Object.freeze([".annostore", ".store"]),
    "--out": Object.freeze([".json"]),
  }),
  "render-memmap": Object.freeze({
    "--provenance": Object.freeze([".json"]),
    "--out": Object.freeze([".md"]),
  }),
  "export-asm": Object.freeze({
    "--store": Object.freeze([".annostore", ".store"]),
    "--out": Object.freeze([".a", ".asm"]),
  }),
});

/**
 * The order `checkInvocation()` reports problems in, declared rather than left
 * to fall out of the control flow -- an implicit order is one a refactor
 * changes silently, and `REPOINT-01`'s probe asks whether output order is
 * specified and stable when elements compare equal.
 *
 * `unknown-verb` SHORT-CIRCUITS: when it fires it is the only problem
 * returned, because every later check reads a verb-keyed table that has no
 * entry to read. The remaining five accumulate in this order.
 */
export const PROBLEM_ORDER = Object.freeze([
  "unknown-verb",
  "flag-membership",
  "positional-kind",
  "required-flag",
  // The two WR-18 additions, placed AFTER the three that preceded them so an
  // existing failure's reported order is unchanged by their arrival.
  "flag-value-missing",
  "flag-value-kind",
]);

/**
 * Returns every fenced code block's body in `text`, as an array of strings,
 * or `null` when the text contains NO fence at all.
 *
 * A single-pass LINE scanner rather than a regex over the whole document: a
 * regex with a lazy body between two fences is the classic
 * catastrophic-backtracking shape, and this walks untrusted (if first-party)
 * skill text (T-29-16-04). Unterminated blocks are tolerated -- the trailing
 * body is returned -- because a truncated fence in prose must not make a whole
 * file invisible to the gate.
 */
function fencedBlocks(text) {
  const lines = String(text).split("\n");
  const blocks = [];
  let sawFence = false;
  let open = false;
  let current = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      sawFence = true;
      if (open) {
        blocks.push(current.join("\n"));
        current = [];
        open = false;
      } else {
        open = true;
      }
      continue;
    }
    if (open) current.push(line);
  }
  if (open) blocks.push(current.join("\n"));
  return sawFence ? blocks : null;
}

/**
 * Extracts every documented `anno` CLI invocation from ONE skill file's text.
 *
 * Returns an array of `{ verb, positionals, flags, raw }` records, where
 * `flags` is an array of `{ flag, value }` (`value` is `null` for a flag with
 * none). Returns **`null` -- never an empty array --** when `text` contains no
 * fenced block at all, so a caller MUST treat "nothing to parse" as distinct
 * from "zero invocations". That is the same discipline `switchVerbBody()`
 * records in `anno-cli-verbs.mjs`, and for the same reason: conflating the two
 * is how a broken extractor reads as a clean tree.
 *
 * SCOPED TO FENCED BLOCKS ONLY. Prose that MENTIONS a verb is not an
 * invocation, and the shipped corpus contains exactly that case.
 *
 * MATCHES FROM THE SUBCOMMAND TOKEN RIGHTWARD and ignores whatever launcher
 * precedes it, because the two documented routes (`npx -y @henols/vice-mcp
 * anno ...` and `node <plugin-root>/src/mcp/vice/vice-proxy.ts anno ...`) share
 * nothing but that token.
 *
 * THE ONE DOCUMENTED IMPRECISION: a token immediately following a `--flag` is
 * read as that flag's VALUE, never as a positional. This reproduces the CLI's
 * own `parseCoverageArgs`/`parseRenderArgs` behaviour for every flag those
 * parsers actually take a value for, and mis-reads only an invocation that
 * places a positional directly after a BOOLEAN flag (`--force`, `--check`) --
 * which no documented invocation does. The failure direction is a missed
 * positional check, never a false accusation.
 */
export function parseDocumentedInvocations(text) {
  const blocks = fencedBlocks(text);
  if (blocks === null) return null;

  const invocations = [];
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      const at = tokens.indexOf(ANNO_SUBCOMMAND);
      if (at === -1) continue;
      const rest = tokens.slice(at + 1);
      if (rest.length === 0) continue;
      const [verb, ...args] = rest;
      const positionals = [];
      const flags = [];
      for (let i = 0; i < args.length; i++) {
        const token = args[i];
        if (token.startsWith("--")) {
          const next = args[i + 1];
          if (next !== undefined && !next.startsWith("-")) {
            flags.push({ flag: token, value: next });
            i++;
          } else {
            flags.push({ flag: token, value: null });
          }
        } else {
          positionals.push(token);
        }
      }
      invocations.push({ verb, positionals, flags, raw: line.trim() });
    }
  }
  return invocations;
}

/**
 * Reads `key` off `table` ONLY when it is an OWN property -- `undefined` for
 * anything inherited, and for a `table` that is not an object at all.
 *
 * WHY THIS EXISTS (WR-19, 2026-08-30). Every table `checkInvocation()` reads is
 * keyed by a VERB TAKEN FROM SKILL TEXT, and every one of them is a plain
 * object literal, which inherits from `Object.prototype`. Bare bracket access
 * therefore resolved `constructor`, `toString`, `valueOf`, `hasOwnProperty` and
 * `__proto__` to TRUTHY inherited values, so the unknown-verb short-circuit did
 * not fire and the next read crashed. All three sites, reproduced against the
 * shipped tables before this helper existed:
 *
 *   `anno constructor game.prg`            -> TypeError: kinds.includes is not a function
 *   `anno toString game.prg --store x`     -> TypeError: function is not iterable
 *   `anno hasOwnProperty game.prg --force` -> TypeError: accepted.includes is not a function
 *
 * `scripts/check-skill-cli-invocations.mjs` calls `checkInvocation()` bare
 * inside its loop, so the gate died with a stack trace instead of the named
 * problem message its whole reporting path is built around -- while this
 * module's own header says three times that skill content is untrusted input
 * that is MATCHED, never executed. An input-derived key reaching a prototype
 * lookup is that posture broken.
 *
 * ONE PREDICATE, THREE CALL SITES, deliberately: a fix that hardened only the
 * verb lookup would leave the finding armed one table over, and the crash the
 * required-flag loop produced was itself a SECOND site added after the first
 * existed. Every new verb-keyed table read in this function goes through here.
 */
function own(table, key) {
  return table !== null && typeof table === "object" && Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * Returns an array of human-readable problems with ONE invocation -- empty
 * when it is sound.
 *
 * It checks FIVE things:
 *   1. every flag is in that verb's real accepted option set,
 *   2. every positional's file extension is one of the kinds declared for that
 *      verb's slot,
 *   3. every flag the verb REQUIRES is present (WR-01 -- until 2026-08-30 this
 *      one was missing, and the gate reported OK for a documented command that
 *      exits 1),
 *   4. every VALUE-TAKING flag actually carries a value (WR-18), and
 *   5. every flag value's file extension is one of the kinds declared for that
 *      FLAG (WR-18 -- until 2026-08-30 kinds were checked for the positional
 *      SLOT and for nothing else, so `--store game.prg` was `CR-04` moved one
 *      token to the right and invisible).
 *
 * Check 4's "value-taking" set is DERIVED, not a fourth table: a flag is
 * value-taking when `flagKinds` declares kinds for it (an extension table only
 * makes sense for a flag that takes a path) or when `requiredFlags` names it.
 * The second half matters for a future required flag that takes a non-path
 * value; today the two sets coincide. A flag in neither -- `--force`,
 * `--check`, `--sample` -- is never reported for a missing value.
 *
 * AND TWO THINGS IT STILL DOES NOT CHECK, named so this comment does not
 * acquire a new false guarantee the moment it stops being a list of two. Both
 * are named with the case where being unchecked actually MATTERS, which is
 * what the previous version of this list got wrong: it illustrated the
 * flag-value gap with the harmless `--sample abc` while a documented
 * `--store game.prg` was equally unchecked and fatal.
 *   - a flag value that is not a PATH. `--sample abc` passes here and is
 *     refused only at runtime, by the CLI's own "must be a positive integer"
 *     branch, so a documented `--sample abc` is a dead command this gate does
 *     not see. Closing it needs a value-SHAPE notion this module does not have.
 *   - a verb's argument ARITY. Two positionals where the verb reads one are
 *     each checked for KIND and neither is reported as one too many, so a
 *     documented `coverage a.prg b.prg --store s.annostore` passes here and
 *     exits 1 at runtime.
 *
 * All four tables -- `verbOptions` (the CLI's own frozen `VERB_OPTIONS`),
 * `positionalKinds`, `requiredFlags` and `flagKinds` -- are passed IN as
 * parameters rather than read from module scope, so this stays a pure
 * predicate a caller can hand a deliberately-wrong table to, which is exactly
 * what the committed planted controls do. Three of the four are also DECLARED
 * in this module (see `POSITIONAL_KINDS`, `REQUIRED_FLAGS` and `FLAG_KINDS`
 * above) so the gate and its test can import the same definition; declaring
 * frozen DATA adds no first-party TypeScript import and no filesystem access,
 * so the property that lets the committed test call this in isolation is
 * unchanged. `verbOptions` is never declared here -- see this file's "never
 * hand-type the accepted option set".
 *
 * PROBLEMS COME BACK IN THE DECLARED `PROBLEM_ORDER`, not in whatever order
 * the control flow happens to produce.
 *
 * A verb the CLI does not have is itself a problem: `verbOptions` IS the verb
 * set, so an unknown key is reported by name rather than skipped as
 * "nothing to check". It SHORT-CIRCUITS -- every later check is keyed by verb
 * and would have no entry to read. That sentence is true for an INHERITED key
 * too (`constructor`, `toString`, `__proto__`) only because every table read
 * here goes through `own()`; until 2026-08-30 those keys crashed the gate with
 * an unhandled `TypeError` instead (WR-19).
 *
 * A positional OR A FLAG VALUE carrying a placeholder shape (`<store>`,
 * `FILE`, `...`) is SKIPPED rather than refused -- usage synopses are
 * documentation, not invocations, and a gate that reds on `<store>` or on
 * `--store FILE` is one nobody can keep green. The required-flag PRESENCE
 * check needs no placeholder rule at all: presence is a property of the flag
 * TOKEN, so a synopsis spelling the flag with a placeholder value
 * (`--provenance FILE`) is present by construction. A flag at END OF LINE is
 * the case that reasoning does NOT cover, and it is not a synopsis: it is a
 * dead command, which is why check 4 exists (WR-18).
 */
export function checkInvocation(invocation, verbOptions, positionalKinds, requiredFlags, flagKinds) {
  const problems = [];
  const { verb, positionals, flags, raw } = invocation;
  const where = raw ? ` (in: ${raw})` : "";

  // WR-19: OWN-property reads throughout. A verb is untrusted skill text, and
  // every table below is a plain object literal.
  const accepted = own(verbOptions, verb);
  if (!Array.isArray(accepted)) {
    problems.push(
      `anno ${verb}: no such verb -- the CLI's own VERB_OPTIONS declares ${Object.keys(verbOptions ?? {}).sort().join(", ") || "nothing"}${where}`,
    );
    return problems;
  }

  for (const { flag } of flags) {
    if (!accepted.includes(flag)) {
      problems.push(`anno ${verb}: flag ${flag} is not in this verb's accepted option set (${accepted.join(", ")})${where}`);
    }
  }

  const kinds = own(positionalKinds, verb) ?? [];
  for (const positional of positionals) {
    if (isPlaceholder(positional)) continue;
    const ext = extensionOf(positional);
    if (kinds.length === 0) {
      problems.push(`anno ${verb}: takes no positional argument, but ${positional} was supplied${where}`);
      continue;
    }
    if (!kinds.includes(ext)) {
      problems.push(
        `anno ${verb}: positional ${positional} has extension ${ext || "(none)"}, which is not one this verb reads (${kinds.join(", ")})${where}`,
      );
    }
  }

  // WR-01. Presence, not membership: the flag may be spelled with a real value
  // or a synopsis placeholder, and either way the TOKEN is what is required.
  const required = own(requiredFlags, verb) ?? [];
  const present = new Set(flags.map(({ flag }) => flag));
  for (const flag of required) {
    if (!present.has(flag)) {
      problems.push(
        `anno ${verb}: ${flag} is required and is missing -- the command exits non-zero at runtime without it${where}`,
      );
    }
  }

  // WR-18, check 4. A flag at END OF LINE (or followed by another flag) parses
  // with `value === null`. For a BOOLEAN flag that is the correct spelling; for
  // a value-taking one it is a dead command -- `coverage: --store requires a
  // value`, exit 1 -- and the presence check above cannot see it, because the
  // TOKEN is there.
  const kindsByFlag = own(flagKinds, verb) ?? {};
  const takesValue = (flag) => Object.hasOwn(kindsByFlag, flag) || required.includes(flag);
  for (const { flag, value } of flags) {
    if (value === null && takesValue(flag)) {
      problems.push(
        `anno ${verb}: ${flag} takes a value and was documented with none -- the command exits non-zero at runtime${where}`,
      );
    }
  }

  // WR-18, check 5. The positional check bound to the ARGUMENT rather than to
  // the SLOT: `--store game.prg` is CR-04's artefact-kind mistake one token to
  // the right.
  for (const { flag, value } of flags) {
    const valueKinds = own(kindsByFlag, flag);
    if (valueKinds === undefined || value === null || isPlaceholder(value)) continue;
    const ext = extensionOf(value);
    if (!valueKinds.includes(ext)) {
      problems.push(
        `anno ${verb}: ${flag} value ${value} has extension ${ext || "(none)"}, which is not one this flag reads (${valueKinds.join(", ")})${where}`,
      );
    }
  }

  return problems;
}

/** `<store>`, `FILE`, `N`, `...` and friends: a synopsis placeholder, not a
 * real path. Deliberately conservative -- anything with a lowercase extension
 * is treated as a real path and checked. */
function isPlaceholder(token) {
  if (token.startsWith("<") || token.startsWith("[")) return true;
  if (token === "...") return true;
  return /^[A-Z][A-Z0-9_]*$/.test(token);
}

/** The lowercase extension of `token`, INCLUDING the dot, or `""` when the
 * final path segment carries none. A plain string operation, deliberately not
 * `node:path` -- this module does no filesystem work and takes no real path. */
function extensionOf(token) {
  const segment = token.slice(token.lastIndexOf("/") + 1);
  const dot = segment.lastIndexOf(".");
  return dot <= 0 ? "" : segment.slice(dot).toLowerCase();
}
