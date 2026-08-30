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
 * Returns an array of human-readable problems with ONE invocation -- empty
 * when it is sound.
 *
 * It checks TWO things and only two:
 *   1. every flag is in that verb's real accepted option set, and
 *   2. every positional's file extension is one of the kinds declared for that
 *      verb's slot.
 *
 * Both `verbOptions` (the CLI's own frozen `VERB_OPTIONS`) and
 * `positionalKinds` are passed IN rather than imported here, so this module
 * stays a pure predicate with no first-party TypeScript import and no
 * filesystem access -- the property that lets the committed test call it in
 * isolation.
 *
 * A verb the CLI does not have is itself a problem: `verbOptions` IS the verb
 * set, so an unknown key is reported by name rather than skipped as
 * "nothing to check".
 *
 * A positional carrying a placeholder shape (`<store>`, `FILE`, `...`) is
 * SKIPPED rather than refused -- usage synopses are documentation, not
 * invocations, and a gate that reds on `<store>` is one nobody can keep green.
 */
export function checkInvocation(invocation, verbOptions, positionalKinds) {
  const problems = [];
  const { verb, positionals, flags, raw } = invocation;
  const where = raw ? ` (in: ${raw})` : "";

  const accepted = verbOptions?.[verb];
  if (!accepted) {
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

  const kinds = positionalKinds?.[verb] ?? [];
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
