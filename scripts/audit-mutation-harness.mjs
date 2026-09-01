#!/usr/bin/env node
// scripts/audit-mutation-harness.mjs
//
// WHY THIS FILE EXISTS: the fate registry this phase builds records, per
// audited guard, that the guard was OBSERVED FAILING against the subject it
// was re-pointed onto. "The guard asserts it can fail" and "the guard was
// observed failing against its new subject" are different claims, and only the
// second is evidence. A hand-written transcript is not evidence either -- it
// cannot be re-run. So the evidence is produced by this committed instrument:
// plant a violation, run exactly one guard, capture a NON-ZERO exit status,
// revert, and write the raw command and the raw output back into the registry.
//
// IT IS NOT A CI JOB. It is invoked by hand, by its own file name, and it goes
// into no workflow `run:` line and no `scripts` entry in
// `src/mcp/vice/package.json`. A CI job that mutates the working tree to prove
// a point is a CI job that can leave the tree mutated.
//
// AN UNDECLARED PRECONDITION, DISCHARGED 2026-09-01 (CR-05, plan 32-17). Every
// one of the 35 observed reds this instrument recorded was sound -- but sound
// BECAUSE NOBODY USED THE `--root` FLAG, not because the flag was safe.
// Measured: `--root` appears in `guard.argv` in 0 of 61 registry rows, and all
// 35 plants are worktree plants. Until this date the reader below took
// `argv[i + 1]` with no missing-value check, so a valueless `--root` silently
// resolved to the repository root: with a real row name and `--all`, an
// operator who believed they had targeted a synthetic tree would have planted
// mutations into the REAL working tree and rewritten the REAL registry and
// evidence file. The soundness of this phase's entire observed-red corpus
// therefore rested on an operator habit rather than on the code. Reading argv
// through `parseRootArg()` makes it a property of the code: every malformed
// form of all four flags is a hard, named error raised BEFORE containment is
// consulted and long before anything is planted. The standing mechanical guard
// for it is plan 32-18's matrix row; this note is its written half.
//
// THE EXPORT COUNT IS NO LONGER ZERO, AND THAT IS DELIBERATE (2026-09-01, plan
// 32-19). Plan 32-14 measured this module's export count as 0 and treated
// keeping it at 0 as a discipline -- its own words, recorded in its SUMMARY:
// "no flag, hook or export was added to widen the window". Read alone, the
// three `export` keywords below therefore look like that discipline being
// quietly abandoned, so the reasoning is written here rather than left to be
// inferred.
//
// What plan 32-14 was disciplined ABOUT was widening THE INSTRUMENT to make an
// assertion possible. It set out to observe the advertised restore-on-signal
// invariant -- SIGINT or SIGTERM delivered while a plant is on disk exits 130
// and restores every captured original -- and it could not, in ten attempts,
// five per signal, every one of which landed inside the plant window. The
// measured cause is not a narrow window; it is the ABSENCE of one. `main()` and
// everything it calls are wholly synchronous, so Node has no opportunity to
// dispatch a JavaScript signal handler while that stack is running: the signal
// is queued, the stack unwinds, `finally { revert }` and `finally { restoreAll }`
// run, and the process exits 0 with the queued callback undelivered. Its
// conclusion, verbatim: "The verifier's four attempts did not miss a narrow
// window. There is no window."
//
// That leaves exactly two routes, and the verifier's own either-or names both:
// inject an `await` into the plant window, or create the window OUTSIDE this
// module with an in-process driver. Plan 32-19 takes the second and refuses the
// first. Injecting an `await` would change how this instrument behaves when it
// is really run, in order to test how it behaves when it is really run -- the
// precise shape of defect this phase exists against. Exporting `plant`,
// `restoreAll` and `pendingRestoreCount` changes NO code path that a real
// invocation takes:
//
//   - NO `await` was injected and none exists. The module is still WHOLLY
//     SYNCHRONOUS: in CODE, `await`, `async ` and `.then(` occur 0 times, so the
//     runtime behaviour of a real `node scripts/audit-mutation-harness.mjs`
//     invocation is byte-for-byte the behaviour plan 32-14 measured.
//
//     MEASURE IT WITH THE DISCRIMINATING FORM, NOT THE BARE ONE. Plan 32-14's
//     bare `grep -c 'await\|async \|\.then(' scripts/audit-mutation-harness.mjs`
//     returned 0 and no longer does: as of this note it returns 4, and all four
//     hits are the sentences you are reading. The note SELF-MATCHES. This is the
//     same shape as the `pgrep -af vice-broker` trap recorded in
//     `evidence/32-close-gate.md` §2b, where the bare probe found its own command
//     line and would have asserted a live broker on an idle host: a measurement
//     whose instrument is inside its own subject. Recording 4 as "an `await` was
//     injected" would be as wrong as recording 0 by rewording this paragraph
//     until the grep agreed with it. The form that measures the intended fact
//     excludes comment lines:
//
//       grep -n 'await\|async \|\.then(' scripts/audit-mutation-harness.mjs \
//         | grep -vE ':[[:space:]]*(//|\*)'
//
//     It exits 1 with no output -- zero code occurrences -- and it is the form
//     any later round should use on this file.
//   - NO flag, environment variable, hook, delay or test mode was added. The
//     five flags are still `--root`, `--row`, `--rows`, `--all`, `--out`.
//   - `main()` still runs ONLY under the `IS_ENTRY_POINT` guard at the foot of
//     this file -- the same idiom `scripts/check-guard-fates.mjs` uses -- so
//     importing this module registers the four process handlers below WITHOUT
//     running a sweep, reading the registry or writing a byte. That property is
//     what makes the real handler reachable from a driver, and it already
//     existed; this plan did not add it.
//   - The exported surface is exactly three symbols and stops there. `revert`,
//     `runGuard`, `measureRow`, `selectRows` and `main` stay private, and
//     `pendingRestoreCount()` returns the map's SIZE rather than the map, so a
//     consumer can observe the restore machinery without being able to mutate
//     it. An export surface outlives the reason it was added; this one is sized
//     to the reason.
//
// Do not widen it further to make a later test easier. If an invariant cannot be
// observed without changing this instrument's runtime behaviour, that is a
// finding to record, not a licence to change it.
//
// WHAT NOT TO DO:
//  - Do not let a run leave a plant behind. A crashed harness leaving a
//    mutation in the tree would corrupt this phase's own closing gate run,
//    which happens on that tree. Restoration is idempotent and registered on
//    the normal path AND on `exit`, `SIGINT`, `SIGTERM` and
//    `uncaughtException`.
//  - Do not skip the GREEN false-positive control. Running the guard UNPLANTED
//    and requiring exit 0 first is what makes the subsequent red mean
//    anything: a guard that is red for an unrelated reason -- or one that TIMES
//    OUT, which the fail-closed error mapping below reports as status 1 --
//    would otherwise record a false observed red, which is exactly the vacuity
//    this whole phase exists to catch. A red with no green control is recorded
//    as UNMEASURABLE, never as an observed red.
//  - Do not inherit `NODE_TEST_*` into the child. When this harness runs from
//    inside a `node --test` process, Node sets `NODE_TEST_CONTEXT` in
//    `process.env`; inherited unmodified, the NESTED `node --test` silently
//    switches its reporter to the parent-child IPC/v8-serialization protocol
//    instead of TAP on stdout, and a genuinely FAILING guard comes back as
//    exit 0 with empty output. Every planted red would then be recorded as a
//    green. The strip below is copied from the audit gate's own, where this
//    failure mode was measured directly rather than assumed.
//  - Never build a shell string. Every subprocess gets an argv ARRAY, `shell:
//    true` is never set, and no text read from the registry or from a scanned
//    file is ever evaluated, imported or shell-executed.
//  - Do not treat a zero guard exit status as a warning. It is a HARD FAILURE
//    of the harness run: it means the plant did not bite, and a fate row must
//    not be written from it.
//  - Do not silently skip a `--rows` entry that matches no row, and do not
//    silently full-run when no selector is given. A truncated or mistyped
//    sweep that quietly measures fewer rows is indistinguishable from a
//    complete one in the artifact it produces.

import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRootArg, resolveContainedRoot } from "./lib/audit-root.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

const PHASE_DIR = ".planning/phases/32-the-deletion-and-the-grep-gate";
const REGISTRY_REL_PATH = `${PHASE_DIR}/guard-fates.json`;

/** The default evidence sink. The TRACER run is the only invocation with no
 * explicit `--out`; every sweep plan passes its own file, which is how one
 * sweep's evidence does not overwrite another's. */
const DEFAULT_OUT_REL_PATH = `${PHASE_DIR}/evidence/32-tracer-observed-red.md`;

/** Bounds each guard subprocess. `spawnSync` reports a timeout through
 * `result.error` (`ETIMEDOUT`) and the mapping below turns that into status 1,
 * which every caller reads as red -- fail-closed comes for free, and the green
 * control is what stops that fail-closed red being MISTAKEN for evidence. */
const GUARD_RUN_TIMEOUT_MS = 15000;

/** How much captured output goes into the evidence excerpt line. */
const EXCERPT_MAX = 4000;

// ---------------------------------------------------------------------------
// RESTORE-ON-EXIT
// ---------------------------------------------------------------------------

/** absolute path -> original bytes, captured BEFORE the first write. */
const originals = new Map();

export function restoreAll() {
  for (const [abs, bytes] of originals) {
    try {
      writeFileSync(abs, bytes);
    } catch (err) {
      // Last-resort visibility: a failed restore must be shouted about, but
      // it must not stop the remaining restores from being attempted.
      process.stderr.write(
        `audit-mutation-harness: FAILED TO RESTORE ${abs} -- ${err?.message ?? String(err)}\n`,
      );
    }
  }
  originals.clear();
}

/**
 * How many captured originals are still pending restoration. Read-only BY
 * CONSTRUCTION: it returns the map's SIZE, never the map, so a consumer can
 * observe that a restore happened without acquiring the ability to add, drop or
 * rewrite an entry in the restore machinery. See the 2026-09-01 header note.
 */
export function pendingRestoreCount() {
  return originals.size;
}

// `finally` and `exit` can both fire, so a second call must be harmless. THE
// MECHANISM THAT MAKES IT HARMLESS IS `originals.clear()` AT THE END OF
// `restoreAll()`, AND NOTHING ELSE (2026-09-01, plan 32-20). A second call
// iterates an empty map and writes nothing. There is no flag, counter, set or
// size check anywhere on this path, and none must be added: two mechanisms for
// one property is how the defect below came back once already.
//
// WHAT THIS REPLACED, AND WHY IT HAD TO GO. Until this date the same property
// was supplied by a module-level boolean that `restoreAll()` read and set on
// entry. It was set on the FIRST call and never reset. That was harmless while
// nothing outside this file could call `restoreAll()` -- and it stopped being
// harmless the moment plan 32-19 exported the plant and restore-all functions so
// an in-process driver could reach the four handlers below. From then on, any
// consumer that completed ONE restore cycle permanently no-opped the `exit`,
// `SIGINT`, `SIGTERM` and `uncaughtException` handlers for the rest of the
// process: the handler still ran and still exited 130, but it restored nothing,
// so a plant captured after that cycle was left on disk.
//
// MEASURED, not inferred. The round-3 verifier reproduced it against a scratch
// root with its own driver -- plant, restore, plant again, SIGINT -- and
// recorded `EXIT=130`, `pendingRestoreCount()` = 1, and the second plant still on
// disk. Carried as `CR-10` and as gap 2 of that round's verification report.
//
// THE SHIPPED CLI PATH WAS NEVER AFFECTED, and this note must not be read as
// saying otherwise. `main()` reverts per row from inside the row loop, and that
// per-row revert deletes its entry from the captured-originals map without ever
// consulting any latch; `restoreAll()` itself is called exactly once, in the
// `finally` after that loop. So the latch could never be set while a plant was
// on disk during a real sweep, and the verifier's own 61-row `--all` run
// finished `tree: restored byte-identical to the baseline`.
//
// WHY THE COMMITTED TEST DID NOT CATCH IT (`WR-27`). The sentinel case in
// `src/mcp/vice/audit-harness-restore.test.ts` writes a hand-made sentinel
// between two `restoreAll()` calls and asserts it survives. That distinguishes a
// no-op from a re-write, which is exactly what `WR-03` asked, and it is green
// either way here -- it cannot distinguish a latch from the map clear. The case
// that CAN is the second-window pair in the same file, added with this change and
// watched failing against a deliberately re-introduced latch before it was
// trusted.
process.on("exit", restoreAll);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restoreAll();
    process.exit(130);
  });
}
process.on("uncaughtException", (err) => {
  restoreAll();
  process.stderr.write(
    `audit-mutation-harness: uncaught exception -- ${err?.stack ?? String(err)}\n`,
  );
  process.exit(1);
});

// ---------------------------------------------------------------------------
// TREE CLEANLINESS
// ---------------------------------------------------------------------------

function porcelain(root) {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Compares `git status --porcelain` against a baseline captured ONCE at
 * process start. Deliberately NOT compared against the empty string: a
 * developer tree legitimately carries untracked scratch files, and comparing
 * against empty would fail every row's precondition on every real machine.
 * What matters is that the harness itself changed nothing.
 */
function assertTreeClean(root, baseline, when) {
  const now = porcelain(root);
  if (now !== baseline) {
    throw new Error(
      `tree cleanliness (${when}): \`git status --porcelain\` differs from the baseline captured ` +
        "at harness start. The harness must leave the tree byte-identical to how it found it.\n" +
        `--- baseline ---\n${baseline}--- now ---\n${now}`,
    );
  }
  return now;
}

// ---------------------------------------------------------------------------
// PLANTING
// ---------------------------------------------------------------------------

/**
 * Applies a row's plant descriptor. Reads the target's ORIGINAL BYTES FIRST,
 * with no encoding argument, so the buffer restored later is byte-identical
 * even for a NUL-carrying file; the find/replace itself goes through a
 * `latin1` round-trip, which is byte-preserving for every code unit including
 * NUL, rather than a UTF-8 decode that would rewrite invalid sequences.
 */
export function plant(root, row) {
  const descriptor = row.plant;
  if (descriptor === null || typeof descriptor !== "object") {
    throw new Error(`row ${row.historicalPath}: no \`plant\` descriptor.`);
  }
  if (descriptor.kind !== "worktree") {
    throw new Error(
      `row ${row.historicalPath}: plant kind ${JSON.stringify(descriptor.kind)} is not ` +
        'implemented. Only "worktree" (read original bytes, substitute, restore) exists so far; ' +
        "a synthetic-fixture route lands with the sweep plans that need it.",
    );
  }
  for (const field of ["file", "find", "replace"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].length === 0) {
      throw new Error(
        `row ${row.historicalPath}: plant descriptor field \`${field}\` must be a non-empty ` +
          "string.",
      );
    }
  }

  // CR-11 (2026-09-01, plan 32-21): REFUSE A DESCRIPTOR THAT CANNOT BE WRITTEN
  // FAITHFULLY, and refuse it HERE -- after the non-empty-string field loop
  // above, and BEFORE the containment call and every read and write below.
  //
  // The mutated text is written through a `latin1` buffer at the foot of this
  // function, and that encoding TRUNCATES any code point above U+00FF (U+2014
  // EM DASH becomes the single byte 0x14). The post-condition further down
  // compares STRINGS, so it would compare the untruncated value and agree with
  // itself while the bytes reaching disk differ from the bytes the row records.
  // The divergence would be SILENT -- which is the one property that separates
  // this from every other refusal in this function.
  //
  // ONLY THE DESCRIPTOR CAN CAUSE IT. The pre-mutation text is itself obtained
  // by decoding the original bytes as `latin1`, so every code point in it is
  // already inside the range by construction; that leaves this row's own `find`
  // and `replace` as the only possible sources.
  //
  // MEASURED BASIS, so this reads as a hardening rather than a guess: 35
  // committed plant descriptors, 0 of them carrying any code point above
  // U+00FF. Nothing is wrong on disk today and this refusal must therefore move
  // no current row's outcome -- a claim the whole-set sweep confirms rather than
  // asserts. Fail-closed and no wider: no normalisation step, no transcoding
  // fallback, no warning-only mode and no per-row opt-out. A descriptor that
  // cannot be written faithfully is refused, which is the same rule the rest of
  // this instrument uses.
  for (const field of ["find", "replace"]) {
    const value = descriptor[field];
    if (Buffer.from(value, "latin1").toString("latin1") === value) continue;
    let offendingIndex = -1;
    let offendingCodePoint = 0;
    let cursor = 0;
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      if (cp > 0xff) {
        offendingIndex = cursor;
        offendingCodePoint = cp;
        break;
      }
      cursor += ch.length;
    }
    throw new Error(
      `row ${row.historicalPath}: plant descriptor field \`${field}\` is NOT ` +
        "latin1-representable -- code point U+" +
        `${offendingCodePoint.toString(16).toUpperCase().padStart(4, "0")} at index ` +
        `${offendingIndex}. The mutated text is written through a latin1 buffer, which would ` +
        "TRUNCATE it, while the post-condition below compares the untruncated string -- so the " +
        "bytes on disk would differ from the bytes this row records and NOTHING would say so. " +
        "Refused before any path resolution and before any read or write (CR-11).",
    );
  }

  // Contain the plant target: a registry value must not be able to name a path
  // outside the tree this run was pointed at.
  //
  // WR-34 (2026-09-01, plan 32-21): THE CHECK IS RIGHT; ITS ATTRIBUTION WAS NOT.
  // `resolveContainedRoot()` speaks in the vocabulary of the `--root` FLAG,
  // because that is what it was written for and what its five other callers pass
  // it. Here the path comes from a REGISTRY ROW, so a wrong registry value was
  // reported as a refusal of a command-line argument the operator never passed,
  // pointing them at the wrong thing to fix. This is a MESSAGE CHANGE ONLY:
  // same resolver, same arguments, same containment decision, same repository
  // reference, and the underlying refusal is carried VERBATIM as the cause. The
  // containment check is correct and load-bearing and nothing about it moves --
  // the `bad-plant-target-attribution` case in
  // `src/mcp/vice/audit-harness-restore.test.ts` asserts the refusal happens in
  // BOTH the before and after states for exactly that reason, so a nicer message
  // cannot be mistaken for, or quietly become, a relaxation.
  let abs;
  try {
    abs = resolveContainedRoot(join(root, descriptor.file), { repoRoot: root });
  } catch (err) {
    throw new Error(
      `row ${row.historicalPath}: this row's \`plant.file\` field names a path ` +
        `(${JSON.stringify(descriptor.file)}) that is outside the tree this run was pointed at. ` +
        "The path came from the REGISTRY, not from a `--root` argument, so the row is what needs " +
        `correcting. Containment refusal, verbatim: ${err?.message ?? String(err)} (WR-34)`,
    );
  }
  if (!existsSync(abs)) {
    throw new Error(`row ${row.historicalPath}: plant target ${abs} does not exist.`);
  }

  const originalBytes = readFileSync(abs);
  const text = originalBytes.toString("latin1");
  const occurrences = text.split(descriptor.find).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `row ${row.historicalPath}: plant \`find\` string occurs ${occurrences} time(s) in ` +
        `${descriptor.file}, expected exactly 1. A plant that matches zero times changes nothing ` +
        "(and the guard's green would be meaningless); a plant that matches more than once is " +
        "ambiguous about what it proved.",
    );
  }

  // CR-02: substitute through a REPLACER FUNCTION, never a replacement STRING.
  // `String.prototype.replace` interprets `$$`, `$&`, `` $` ``, `$'`, `$n` and
  // `$<name>` inside a replacement STRING, while the occurrence check above
  // counts with `split`, which is literal. The two therefore disagreed, and a
  // descriptor could record one mutation while a different one reached disk.
  // A replacer function is passed the match and its return value is used
  // verbatim, so no pattern in it is interpreted.
  const mutated = text.replace(descriptor.find, () => descriptor.replace);

  // CR-02, the POST-CONDITION -- and WHY it exists, not just what it does. A
  // plant descriptor is a PROMISE TO A READER that they can reproduce the
  // mutation by hand: open `file`, find `find`, replace it with `replace`, run
  // the guard, see the same red. Until this assertion existed the harness could
  // keep that promise or break it with nobody finding out, because the only
  // thing checked was that `find` matched -- never that the bytes written were
  // the bytes recorded. Row `src/mcp/vice/r2000-enum-gen.test.ts` broke it for
  // an entire phase before a verifier noticed by reading the captured excerpt.
  // A divergence between record and reality is now a HARD FAILURE, not a quiet
  // one, and it is caught BEFORE any byte is written.
  //
  // CR-06 (2026-09-01): the reasoning above is unchanged and was never the
  // defect; the ARITHMETIC under it was. The first form counted TOTAL
  // occurrences of `replace` in the mutated text and demanded exactly 1. That
  // conflates two different facts that happen to share a string: an occurrence
  // the mutation INTRODUCED, and an occurrence that was ALREADY IN THE FILE
  // before a byte was written. Row `scripts/lib/skill-honesty-checks.mjs` is the
  // case that exposed it -- its `find` occurs exactly once and the un-negated
  // `replace` form already occurs once elsewhere in the same file, so an HONEST
  // descriptor computed 2 and threw. That aborted every whole-set sweep at that
  // row and, worse, told the operator to edit the recorded evidence to satisfy
  // the check. The count became INTRODUCED occurrences -- post-mutation minus
  // pre-existing -- which is the quantity the assertion always meant.
  //
  // CR-09 (2026-09-01, plan 32-21): AND THAT SECOND FORM WAS BLIND IN ITS TURN.
  // A subtraction of whole-file TOTALS cannot see a replacement that textually
  // OVERLAPS its own pre-existing occurrence: the two share bytes rather than
  // merely coinciding in value, so the total does not move and the difference
  // comes out 0. The measured case is the committed row
  // `src/mcp/vice/hop-chain-comments.test.ts`, which plants into
  // `src/mcp/vice/absorbed-answer-key.test.ts` with a recorded replacement equal
  // to its recorded `find` with one newline prepended. Measured: `find` occurs
  // 1 time, the replacement occurs 1 time BEFORE the mutation and 1 time AFTER
  // it, the difference is 0 -- and the mutation is REAL, changing the file by
  // exactly +1 byte. So an HONEST descriptor was REFUSED; and because a refused
  // plant sets the run's hard-failure flag, the whole-set registry write-back
  // could not be reached at all while that row stood.
  //
  // WHERE THAT DEFECT CAME FROM, recorded rather than quietly corrected. The
  // sentence that used to close the paragraph above -- asserting that the
  // narrowing to introduced occurrences was free of cost -- was adopted VERBATIM
  // from round 2's own gap text, which promised the overlap case was still
  // caught by that form. It was not caught; it was REFUSED. The defect is
  // INHERITED from the gap text rather than invented by the executor who applied
  // it, and it was that executor who found it, recorded it in this file's own
  // refusal comment and filed it as an open `unmet-truth` (`.planning/WINDOWS.md`
  // entry 35) before any review existed. The sentence is DELETED rather than
  // reworded, and it is deliberately not re-quoted here, because this file's own
  // census greps for it.
  //
  // THE PER-SITE FORM BELOW IS EXACT UNDER OVERLAP. It stops counting totals and
  // measures the introduction AT ITS SITE, from two facts that hold for an
  // overlapping and a non-overlapping replacement alike: the mutated text begins
  // with the recorded replacement at the unique match position, and the length
  // delta is exactly the replacement's length minus the find's. Both are
  // computed BEFORE any byte is written and both remain HARD throws.
  //
  // AND IT IS NOT A TAUTOLOGY, though a reader could reasonably suspect one.
  // While the substitution goes through a replacer FUNCTION both facts hold BY
  // CONSTRUCTION -- which is the point rather than an objection, because the
  // check is a standing PIN on the CR-02 fix immediately above it. Revert that
  // fix to a replacement STRING, and give a descriptor a replacement carrying a
  // match-substitution pattern, and the position assertion goes FALSE while the
  // length delta diverges from the expected one, so this post-condition is what
  // reports the regression. The standing guard is the `substitution-is-verbatim`
  // case in `src/mcp/vice/audit-harness-restore.test.ts`, watched failing
  // against exactly that reverted form before it was trusted.
  //
  // The occurrence check above has already asserted that `find` matches exactly
  // once, so the position below is unique BY CONSTRUCTION. It is taken with the
  // literal index-of operation and never with a regular expression: a pattern
  // here would reopen the very interpretation hole CR-02 closed.
  const matchIndex = text.indexOf(descriptor.find);
  const expectedLengthDelta = descriptor.replace.length - descriptor.find.length;
  const actualLengthDelta = mutated.length - text.length;
  const landedAtMatchIndex = mutated.startsWith(descriptor.replace, matchIndex);
  if (!landedAtMatchIndex || actualLengthDelta !== expectedLengthDelta) {
    throw new Error(
      `row ${row.historicalPath}: plant post-condition FAILED for ${descriptor.file} -- the ` +
        "recorded `replace` string did not land verbatim at the unique match position. At index " +
        `${matchIndex} the mutated text ${landedAtMatchIndex ? "DOES" : "does NOT"} begin with ` +
        `the recorded replacement, and the mutation changes the text by ${actualLengthDelta} ` +
        `character(s) where an exact substitution would change it by ${expectedLengthDelta}. ` +
        "Either fact failing means the bytes this harness would write are not the bytes this row " +
        "records -- the CR-02 divergence class -- so the row would promise a reader a " +
        "hand-reproducible find/replace that does not reproduce. Nothing was written. Do NOT " +
        "edit the recorded evidence to satisfy this check: the descriptor is the record and the " +
        "instrument is what moves (CR-02, CR-06, CR-09).",
    );
  }

  if (!originals.has(abs)) originals.set(abs, originalBytes);
  writeFileSync(abs, Buffer.from(mutated, "latin1"));

  return {
    kind: descriptor.kind,
    file: descriptor.file,
    find: descriptor.find,
    replace: descriptor.replace,
    absolute: abs,
  };
}

function revert(abs) {
  const bytes = originals.get(abs);
  if (bytes === undefined) return;
  writeFileSync(abs, bytes);
  originals.delete(abs);
}

// ---------------------------------------------------------------------------
// GUARD EXECUTION
// ---------------------------------------------------------------------------

/**
 * Resolves the binary for a guard descriptor's argv. Three conventions, and
 * the harness branches on NOTHING else -- it spawns exactly the argv the row
 * carries:
 *   - `["--test", "<basename>"]`               -> this same Node binary
 *   - `["scripts/<name>.mjs", ...flags]`       -> this same Node binary
 *   - `["--run", "typecheck"]`                 -> the npm client
 */
function resolveBin(argv) {
  if (argv[0] === "--run") return "npm";
  return process.execPath;
}

function runGuard(root, row, label) {
  const descriptor = row.guard;
  if (descriptor === null || typeof descriptor !== "object") {
    throw new Error(`row ${row.historicalPath}: no \`guard\` descriptor.`);
  }
  if (!Array.isArray(descriptor.argv) || descriptor.argv.length === 0) {
    throw new Error(`row ${row.historicalPath}: \`guard.argv\` must be a non-empty array.`);
  }
  for (const element of descriptor.argv) {
    if (typeof element !== "string") {
      throw new Error(
        `row ${row.historicalPath}: every \`guard.argv\` element must be a string; the argv is ` +
          "spawned as an ARRAY and is never interpolated into a shell string.",
      );
    }
  }
  const relativeCwd = descriptor.cwd ?? ".";
  const cwd = resolveContainedRoot(join(root, relativeCwd), { repoRoot: root });
  const bin = resolveBin(descriptor.argv);

  // HAZARD: strip every NODE_TEST_* key. See this file's header.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST_")) delete env[key];
  }

  const result = spawnSync(bin, descriptor.argv, {
    cwd,
    encoding: "utf8",
    env,
    timeout: GUARD_RUN_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });

  const command = `${bin === "npm" ? "npm" : "node"} ${descriptor.argv.join(" ")}`;
  if (result.error) {
    let stderr = `${result.stderr ?? ""}\n${
      result.error.message ?? String(result.error)
    }`.trim();
    if (result.error.code === "ETIMEDOUT") {
      stderr =
        `${stderr}\nguard run was killed after exceeding the ${GUARD_RUN_TIMEOUT_MS}ms timeout ` +
        "-- treated as red rather than hanging the caller. NOTE: a timeout red is NOT evidence; " +
        "the green control is what separates the two.";
    }
    return {
      label,
      command,
      // The registry and the evidence record the ROOT-RELATIVE cwd: an
      // absolute path pins the artifact to the machine that produced it, and
      // this evidence has to stay re-runnable from any clone.
      cwd: relativeCwd,
      cwdAbsolute: cwd,
      status: 1,
      stdout: result.stdout ?? "",
      stderr,
      timedOut: true,
    };
  }
  // CR-04: a child TERMINATED BY A SIGNAL never reached a verdict, and must not
  // be coerced into one. `spawnSync` reports that shape as `status === null`
  // with `signal` set -- SIGKILL from an out-of-memory reaper, SIGSEGV from a
  // native crash, SIGBUS -- and the old `result.status ?? 1` turned every one of
  // them into a recorded exit status of 1, i.e. into a RED.
  //
  // WHY that is dangerous rather than merely imprecise: the green false-positive
  // control runs BEFORE the plant, so a control that passed offers no protection
  // at all against a kill that happens DURING the planted run. The pair "green
  // control, red planted run" -- the exact shape this harness treats as proof
  // that a guard is non-vacuous -- would be manufactured out of a process nobody
  // measured. And this is a LIVE path, not a theoretical one: this host runs
  // earlyoom and the guard suites are `node --test` runs that are memory-hungry.
  //
  // Kept SEPARATE from the timeout branch above on purpose. A run that exceeded
  // its budget and a run that was killed are different facts about a run, and
  // each has to stay independently reportable.
  if (result.status === null && result.signal !== null && result.signal !== undefined) {
    return {
      label,
      command,
      cwd: relativeCwd,
      cwdAbsolute: cwd,
      status: null,
      signal: result.signal,
      terminatedBySignal: true,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      timedOut: false,
    };
  }

  return {
    label,
    command,
    cwd: relativeCwd,
    cwdAbsolute: cwd,
    status: result.status ?? 1,
    signal: null,
    terminatedBySignal: false,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: false,
  };
}

/** The first failing-assertion-shaped line from the captured output, or the
 * captured output's head when nothing matches. */
function excerptOf(run) {
  const text = `${run.stdout}\n${run.stderr}`;
  const lines = text.split("\n");
  const start = lines.findIndex((l) =>
    /(not ok |AssertionError|Expected values to be|failing tests|FAIL)/.test(l),
  );
  const slice = start === -1 ? lines.slice(0, 40) : lines.slice(start, start + 40);
  const joined = slice.join("\n").trim();
  const head = joined.length > 0 ? joined : text.trim();
  return head.length > EXCERPT_MAX ? `${head.slice(0, EXCERPT_MAX)}\n... [truncated]` : head;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// ARGV IS READ THROUGH THE SHARED SEAM, not here (plan 32-17). The loop this
// replaces took `argv[i + 1]` with no missing-value check, so a valueless
// `--root` yielded `undefined`, which `resolveContainedRoot()` maps to the
// repository root with NO message -- and the run went on to read the real
// registry while the operator believed they had pointed it at a synthetic
// tree. `--row`, `--rows` and `--out` carried the identical hole, and the
// trailing-flag form swallowed the NEXT flag as a value. The three rules for a
// malformed value now come from `parseRootArg()`, which is why `valueFlags`
// exists: restating them here would have recreated `IN-06` inside the very
// file the seam was extracted from.
//
// What stays here is the one rule the parser has no business knowing: the
// exactly-one-of selector rule is about THIS instrument's semantics, not about
// argv shape.
function parseArgs(argv) {
  const parsed = parseRootArg(argv, {
    script: "audit-mutation-harness",
    booleanFlags: ["--all"],
    valueFlags: ["--row", "--rows", "--out"],
  });

  const root = parsed.root;
  const row = parsed.values["--row"];
  const rows = parsed.values["--rows"];
  const all = parsed.flags["--all"] === true;
  const out = parsed.values["--out"];

  const selectors = [row !== undefined, rows !== undefined, all].filter(Boolean).length;
  if (selectors !== 1) {
    throw new Error(
      `row selection must be EXACTLY ONE of --row, --rows or --all; got ${selectors}. Zero is ` +
        "not a silent full run and more than one is not a merge: a sweep whose selector was " +
        "mistyped must fail rather than quietly measure a different set of rows than its plan " +
        "claims.",
    );
  }
  return { root, row, rows, all, out };
}

function selectRows(registry, { row, rows, all }) {
  const available = Array.isArray(registry.rows) ? registry.rows : [];
  if (all) return available;
  const wanted = row !== undefined ? [row] : String(rows).split(",").map((s) => s.trim());
  const selected = [];
  for (const entry of wanted) {
    if (entry.length === 0) {
      throw new Error("row selection: an empty entry was given in the selector list.");
    }
    // Matched against `historicalPath` ONLY. Matching loosely against
    // `newSubject` too would let one entry select two rows.
    const matches = available.filter((r) => r.historicalPath === entry);
    if (matches.length !== 1) {
      throw new Error(
        `row selection: ${JSON.stringify(entry)} matched ${matches.length} registry row(s) by ` +
          "`historicalPath`, expected exactly 1. An entry that matches no row is a HARD FAILURE " +
          "naming the offending entry, never a silent skip.",
      );
    }
    selected.push(matches[0]);
  }
  return selected;
}

function measureRow(root, row, baseline) {
  const report = { historicalPath: row.historicalPath, verdict: row.verdict };

  // D-05: rows are TYPED, and the VERDICT decides what evidence the row owes.
  // `re-pointed` owes an observed red. `kept-unchanged` owes proof its subject
  // still exists untouched, and `deleted` owes proof of absence plus the commit
  // that removed it -- evidence that lives in the row's `removalTrigger` and its
  // recorded classification, not in a planted guard run. Those rows therefore
  // carry no `plant` and no `guard` BY DESIGN. Running the guard on them anyway
  // threw `no \`guard\` descriptor` and aborted every whole-set sweep at registry
  // index 22, before the sweep could reach a single later row (CR-06). They are
  // reported as SKIPPED, in their own position in registry order, and never
  // filtered out of the report -- an omitted row and a row that owes nothing are
  // different facts and a reader has to be able to tell them apart.
  //
  // The opposite direction stays STRICT and must not be weakened. The skip is
  // driven by the VERDICT, never by the absence of a descriptor: a `re-pointed`
  // row that has lost its `plant` or `guard` falls straight through to the
  // existing hard failure below, so a missing descriptor can never disappear
  // into this branch.
  if (row.verdict === "kept-unchanged" || row.verdict === "deleted") {
    report.skipped = true;
    report.reason =
      `verdict \`${row.verdict}\` owes no observed-red evidence (D-05); its evidence is the ` +
      "recorded removal trigger and classification, not a planted guard run. Not measured, and " +
      "not silently omitted.";
    return report;
  }

  assertTreeClean(root, baseline, `before row ${row.historicalPath}`);

  // 1b. The GREEN false-positive control, BEFORE any plant.
  const control = runGuard(root, row, "control (unplanted)");
  if (control.status !== 0) {
    report.unmeasurable = true;
    report.reason =
      "the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the " +
      "plant. Recorded as UNMEASURABLE rather than as an observed red." +
      (control.timedOut ? " The control TIMED OUT." : "") +
      // CR-04: name the signal rather than reporting "did not exit 0" for a
      // child that never exited at all.
      (control.terminatedBySignal
        ? ` The control was TERMINATED BY ${control.signal} and never exited.`
        : "");
    report.control = control;
    return report;
  }

  // 2. Plant.
  //
  // A REFUSED plant is a HARD FAILURE of the run, and it stays one: nothing was
  // written (every throw in `plant()` fires before the write), the registry
  // write-back is suppressed, and the process still exits 1. What changed is its
  // BLAST RADIUS. Thrown out of the row loop, one bad descriptor aborted the
  // whole sweep at its own index and left every later row unmeasured AND
  // unreported -- so a whole-set run could never complete, and the state of the
  // other 60 rows was hidden behind the first refusal (IN-10; and measured again
  // in plan 32-15, where a THIRD row -- `src/mcp/vice/hop-chain-comments.test.ts`,
  // whose `replace` is its own `find` prefixed with a newline, so the introduced
  // occurrence textually OVERLAPS the pre-existing one and the difference comes
  // out 0 -- aborted the sweep even after the post-condition arithmetic was
  // corrected). Reported against the row instead, with the refusal's own message
  // carried verbatim. The assertion is not weakened and the row is not skipped:
  // it is attempted, refused, and named.
  let planted;
  try {
    planted = plant(root, row);
  } catch (err) {
    report.failed = true;
    report.plantRefused = true;
    report.reason =
      "the plant descriptor was REFUSED before any byte was written, so no guard run was " +
      `attempted for this row and no evidence can be recorded from it: ${err?.message ?? String(err)}`;
    report.control = control;
    return report;
  }
  let planted_run;
  try {
    // 3. Run only that guard.
    planted_run = runGuard(root, row, "planted");
  } finally {
    // 6a. Revert -- even if the run threw.
    revert(planted.absolute);
  }

  // 6b. Tree back to baseline.
  assertTreeClean(root, baseline, `after row ${row.historicalPath}`);

  // 3b. CR-04. A PLANTED run that was killed by a signal is UNMEASURABLE, never
  // a red. Checked BEFORE the zero-exit branch below and before any write-back,
  // because a signal-terminated child carries no exit status at all: it proves
  // nothing about the plant in either direction.
  //
  // WHY the green control does not already cover this: the control runs BEFORE
  // the plant, so it says nothing about a kill that lands during the planted
  // run. On this host that kill is a live possibility -- earlyoom is installed
  // and the guard suites are memory-hungry `node --test` runs -- and without
  // this branch it would manufacture exactly the false observed red this phase
  // exists to prevent. Not retried: a silent retry would hide the kill, and the
  // fact that a measurement could not be taken is itself the thing to report.
  if (planted_run.terminatedBySignal) {
    report.unmeasurable = true;
    report.reason =
      `the PLANTED guard run was TERMINATED BY ${planted_run.signal} and never exited, so it ` +
      "carries no exit status. A signal-killed child proves nothing about the plant: it was " +
      "killed, not failed. Recorded as UNMEASURABLE rather than as an observed red, and NOT " +
      "retried -- re-run the row once the cause of the kill (an out-of-memory reaper, a native " +
      "crash) is understood (CR-04).";
    report.control = control;
    report.planted = planted_run;
    return report;
  }

  // 4. A zero status is a HARD FAILURE of the harness run.
  if (planted_run.status === 0) {
    report.failed = true;
    report.reason =
      "the guard exited 0 WITH the violation planted. The plant did not bite. Do not weaken the " +
      "guard: choose a different mutation against the same new subject and record in the " +
      "evidence file which mutation was tried and why it did not bite.";
    report.control = control;
    report.planted = { ...planted_run, plant: planted };
    return report;
  }

  // 5. Record.
  report.observedRed = {
    command: planted_run.command,
    cwd: planted_run.cwd,
    plant: {
      kind: planted.kind,
      file: planted.file,
      find: planted.find,
      replace: planted.replace,
    },
    exitStatus: planted_run.status,
    excerpt: excerptOf(planted_run),
    control: {
      command: control.command,
      cwd: control.cwd,
      exitStatus: control.status,
      excerpt: excerptOf(control),
    },
  };
  report.control = control;
  report.planted = planted_run;
  return report;
}

function evidenceMarkdown({ root, reports, baseline, after, measuredAt }) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const lines = [];
  lines.push("# Phase 32 — observed-red evidence (machine-captured)");
  lines.push("");
  lines.push(
    "Written by `scripts/audit-mutation-harness.mjs`. Every field below is a captured " +
      "`spawnSync` result, not a transcription. Re-run the command in each row's " +
      "**planted command** line after applying that row's plant to reproduce it.",
  );
  lines.push("");
  lines.push(`- **Commit measured:** \`${head}\``);
  lines.push(`- **Measured at:** ${measuredAt}`);
  lines.push(`- **Root:** \`${root}\``);
  const skippedCount = reports.filter((r) => r.skipped).length;
  lines.push(
    `- **Rows selected:** ${reports.length} (${reports.length - skippedCount} measured, ` +
      `${skippedCount} skipped)`,
  );
  lines.push("");
  lines.push("## Tree state");
  lines.push("");
  lines.push("`git status --porcelain` BEFORE the run (the baseline every row is compared to):");
  lines.push("");
  lines.push("```");
  lines.push(baseline.trimEnd());
  lines.push("```");
  lines.push("");
  lines.push("`git status --porcelain` AFTER the run:");
  lines.push("");
  lines.push("```");
  lines.push(after.trimEnd());
  lines.push("```");
  lines.push("");
  lines.push(
    after === baseline
      ? "**Byte-identical.** Every plant was reverted."
      : "**DIFFERENT — the harness did not restore the tree. This run's evidence is void.**",
  );
  lines.push("");

  for (const report of reports) {
    lines.push(`## \`${report.historicalPath}\` — verdict \`${report.verdict}\``);
    lines.push("");
    // D-05. A skipped row carries no control and no planted run; it keeps its
    // place in the report so the reader can reconcile the section count against
    // the registry's row count without recomputing anything.
    if (report.skipped) {
      lines.push(`**SKIPPED.** ${report.reason}`);
      lines.push("");
      continue;
    }
    if (report.unmeasurable) {
      lines.push(`**UNMEASURABLE.** ${report.reason}`);
      lines.push("");
      lines.push(`Control command: \`${report.control.command}\` (cwd \`${report.control.cwd}\`)`);
      lines.push(`Control exit status: \`${report.control.status}\``);
      lines.push("");
      lines.push("Raw control output:");
      lines.push("");
      lines.push("```");
      lines.push(`${report.control.stdout}\n${report.control.stderr}`.trimEnd());
      lines.push("```");
      lines.push("");
      // CR-04. When the row became UNMEASURABLE because the PLANTED run was
      // killed, the planted run's captured output is the whole subject of the
      // record and must not be dropped just because there is no `observedRed`.
      if (report.planted) {
        lines.push(`Planted command: \`${report.planted.command}\` (cwd \`${report.planted.cwd}\`)`);
        lines.push(
          report.planted.terminatedBySignal
            ? `Planted run outcome: **TERMINATED BY \`${report.planted.signal}\`** — no exit status.`
            : `Planted exit status: \`${report.planted.status}\``,
        );
        lines.push("");
        lines.push("Raw planted output:");
        lines.push("");
        lines.push("```");
        lines.push(`${report.planted.stdout}\n${report.planted.stderr}`.trimEnd());
        lines.push("```");
        lines.push("");
      }
      continue;
    }
    if (report.failed) {
      lines.push(`**HARNESS FAILURE.** ${report.reason}`);
      lines.push("");
    }
    // A refused plant has a green control and NO planted run. Render what exists
    // rather than dereferencing a run that was never made.
    if (report.plantRefused) {
      lines.push(`Control command: \`${report.control.command}\` (cwd \`${report.control.cwd}\`)`);
      lines.push(`Control exit status: \`${report.control.status}\` (must be 0)`);
      lines.push("");
      lines.push("Raw control output:");
      lines.push("");
      lines.push("\`\`\`");
      lines.push(`${report.control.stdout}\n${report.control.stderr}`.trimEnd());
      lines.push("\`\`\`");
      lines.push("");
      lines.push("**No planted run was made.** The plant was refused, so there is nothing to report.");
      lines.push("");
      continue;
    }
    const red = report.observedRed;
    lines.push("### Green false-positive control (run BEFORE any plant)");
    lines.push("");
    lines.push(`- **Command:** \`${report.control.command}\``);
    lines.push(`- **cwd:** \`${report.control.cwd}\``);
    lines.push(`- **Exit status:** \`${report.control.status}\` (must be 0)`);
    lines.push("");
    lines.push("Raw output:");
    lines.push("");
    lines.push("```");
    lines.push(`${report.control.stdout}\n${report.control.stderr}`.trimEnd());
    lines.push("```");
    lines.push("");
    lines.push("### Planted run");
    lines.push("");
    if (red) {
      lines.push(`- **Plant:** \`${red.plant.file}\`: \`${red.plant.find}\` → \`${red.plant.replace}\``);
      lines.push(`- **Planted command:** \`${red.command}\``);
      lines.push(`- **cwd:** \`${red.cwd}\``);
      lines.push(`- **Exit status:** \`${red.exitStatus}\` (must be non-zero)`);
      lines.push("");
    }
    lines.push("Raw output:");
    lines.push("");
    lines.push("```");
    lines.push(`${report.planted.stdout}\n${report.planted.stderr}`.trimEnd());
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    // An ARGUMENT REJECTION. The message already begins with
    // `BAD ARGUMENTS --` when it came from the shared parser, and with the
    // selector rule's own text when it came from this file. Either way it
    // exits 1, like the containment REFUSAL below: the seam's own header
    // records that an argv rejection must not mint a new exit code, and that
    // the two classes are separated by their MESSAGE rather than by their
    // status. This script was the one consumer violating that: until plan
    // 32-17 it printed a bespoke usage-word prefix of its own and exited 2.
    // The literal is not reproduced here, so a census for it returns a real
    // zero rather than matching this comment.
    console.error(`audit-mutation-harness: ${err?.message ?? String(err)}`);
    process.exit(1);
  }

  let root;
  try {
    root = resolveContainedRoot(args.root, { repoRoot: REPO_ROOT });
  } catch (err) {
    console.error(`audit-mutation-harness: REFUSED -- ${err?.message ?? String(err)}`);
    process.exit(1);
  }
  if (!existsSync(root)) {
    console.error(
      `audit-mutation-harness: FAIL -- --root resolves to ${root}, which does not exist (a typo, ` +
        "not a containment refusal).",
    );
    process.exit(1);
  }

  const registryPath = join(root, REGISTRY_REL_PATH);
  if (!existsSync(registryPath)) {
    console.error(`audit-mutation-harness: FAIL -- no registry at ${registryPath}`);
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));

  let selected;
  try {
    selected = selectRows(registry, args);
  } catch (err) {
    console.error(`audit-mutation-harness: FAIL -- ${err?.message ?? String(err)}`);
    process.exit(1);
  }
  if (selected.length === 0) {
    console.error(
      "audit-mutation-harness: FAIL -- the selection matched zero rows. An empty measurement is " +
        "not a green.",
    );
    process.exit(1);
  }

  const measuredAt = new Date().toISOString();
  const baseline = porcelain(root);
  const reports = [];
  let hardFailure = false;

  try {
    for (const row of selected) {
      const report = measureRow(root, row, baseline);
      reports.push(report);
      // A REFUSED plant reaches this line through `report.failed`, which is what
      // suppresses the registry write-back below. That is a DECISION, taken
      // 2026-09-01 and recorded in full at the suppression-cause enumeration
      // further down -- read it there before changing this line.
      if (report.unmeasurable || report.failed) hardFailure = true;
      if (report.observedRed) {
        // Write the captured evidence back into the row in memory; the whole
        // registry is rewritten once, below.
        row.observedRed = report.observedRed;
      }
    }
  } catch (err) {
    restoreAll();
    console.error(`audit-mutation-harness: FAIL -- ${err?.message ?? String(err)}`);
    process.exit(1);
  } finally {
    restoreAll();
  }

  const after = porcelain(root);

  const skippedCount = reports.filter((r) => r.skipped).length;
  const measuredCount = reports.length - skippedCount;

  // A selection every one of whose rows was SKIPPED measured nothing, and an
  // empty measurement is not a green -- the same rule the zero-row check above
  // enforces, applied to the case where the selector DID match. Kept as a
  // separate message on purpose: "your selector matched nothing" and "your
  // selector matched only rows that owe nothing" are different mistakes with
  // different remedies, and folding them together would hide which one happened.
  const allSkipped = reports.length > 0 && measuredCount === 0;
  if (allSkipped) hardFailure = true;

  // THE WRITE-BACK DECISION, RECORDED 2026-09-01 (plan 32-21, gap 1). A REFUSED
  // PLANT BLOCKS THE WHOLE-SET REGISTRY WRITE-BACK, and the refused-plant flag
  // is NOT separated from the failed flag. The round-3 verifier traced the chain
  // -- a refusal sets the row's failed flag, which sets this run's hard-failure
  // flag, which suppresses the write-back -- and asked that it be settled
  // explicitly rather than left as an unexamined consequence. It is settled the
  // way it stands, on these grounds:
  //
  //  1. THE BASIS. This instrument's entire product is non-vacuity evidence. A
  //     PARTIAL write-back would produce a registry mixing freshly-measured
  //     evidence for some rows with committed evidence for others, with nothing
  //     in the file recording which is which -- so a reader could not tell a
  //     re-measured row from a stale one. That is precisely the laundering this
  //     phase exists against, and it would be introduced by the instrument whose
  //     job is to prevent it.
  //  2. THE PRECEDENT. This repository's gate design carries no relaxation
  //     hatches by standing decision, and this instrument already applies the
  //     same fail-closed rule twice within twenty lines of here: to a selection
  //     that matched zero rows, and to a selection every row of which was
  //     skipped -- both on the stated ground that an empty measurement is not a
  //     green. A refused plant is the same shape of non-measurement.
  //  3. REACHABILITY, PROVEN RATHER THAN ARGUED. This path was never
  //     PERMANENTLY unreachable by POLICY. It was unreachable because of the
  //     post-condition arithmetic defect that refused an honest descriptor
  //     (CR-09, corrected in the plant function above). With that corrected, the
  //     whole-set `--all` run recorded in
  //     `.planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-gap1-overlap-and-writeback.md`
  //     reaches this branch and writes the registry. That run is the proof; the
  //     argument is not.
  //  4. THE REJECTED BRANCH, NAMED. Separating the refused-plant flag from the
  //     failed flag -- so that a refusal reports against its row without
  //     suppressing the write-back for the others -- was considered and is
  //     REJECTED on ground 1, not on effort. The suppression-cause enumeration
  //     below therefore stays exactly as it is, with the refusal remaining a
  //     SEPARATELY NAMED cause, so a suppressed write-back always tells the
  //     operator which of the four fired.
  //
  // REVERSIBILITY: reversible. The rejected branch is a two-line change at this
  // same site; no on-disk format changes, no published contract breaks, and the
  // registry's own bytes are unaffected by the choice. Recorded here rather than
  // only in a SUMMARY so a later reader finds the reasoning where the code is.
  //
  // The line that reports the SUPPRESSED write-back has to name the reason that
  // actually fired. There are now four, and printing one of them for all four
  // would be the instrument stating something it did not measure.
  const suppressionCauses = [];
  if (allSkipped) suppressionCauses.push("every selected row was skipped");
  if (reports.some((r) => r.plantRefused)) suppressionCauses.push("a row's plant was refused");
  if (reports.some((r) => r.unmeasurable)) suppressionCauses.push("a row was unmeasurable");
  if (reports.some((r) => r.failed && !r.plantRefused)) {
    suppressionCauses.push("a row's guard exited 0 with the violation planted");
  }

  // Registry write-back. Only reached when every selected row produced a
  // captured, non-zero-exit observed red.
  if (!hardFailure) {
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  }

  const outPath = resolveContainedRoot(join(root, args.out ?? DEFAULT_OUT_REL_PATH), {
    repoRoot: root,
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, evidenceMarkdown({ root, reports, baseline, after, measuredAt }));

  console.log(`audit-mutation-harness: selected ${reports.length} row(s)`);
  for (const report of reports) {
    // D-05. Printed in the row's own position in registry order, so the report
    // reconciles line-for-line against the registry rather than silently
    // shrinking to the measured subset.
    if (report.skipped) {
      console.log(
        `  SKIPPED       ${report.historicalPath}: verdict ${report.verdict} -- owes no ` +
          "observed-red evidence (D-05)",
      );
      continue;
    }
    if (report.unmeasurable) {
      console.log(`  UNMEASURABLE  ${report.historicalPath}: ${report.reason}`);
      continue;
    }
    if (report.plantRefused) {
      console.log(`  PLANT REFUSED ${report.historicalPath}: ${report.reason}`);
      continue;
    }
    if (report.failed) {
      console.log(`  ZERO-EXIT     ${report.historicalPath}: ${report.reason}`);
      continue;
    }
    console.log(
      `  OBSERVED RED  ${report.historicalPath}: guard exit status ` +
        `${report.observedRed.exitStatus} (control exit status ` +
        `${report.observedRed.control.exitStatus})`,
    );
    console.log(`                command: ${report.observedRed.command}`);
  }
  console.log(
    `  counts: measured=${measuredCount} skipped=${skippedCount} total=${reports.length}`,
  );
  if (allSkipped) {
    console.error(
      `audit-mutation-harness: FAIL -- all ${reports.length} selected row(s) were SKIPPED. Every ` +
        "one of them carries a verdict that owes no observed-red evidence (D-05), so this run " +
        "measured nothing, and an empty measurement is not a green. This is a DIFFERENT failure " +
        "from a selector that matched zero rows: the selector matched, and everything it matched " +
        "owes nothing.",
    );
  }
  console.log(`  evidence: ${outPath}`);
  console.log(
    `  registry: ${
      hardFailure ? `NOT written (${suppressionCauses.join("; ")})` : registryPath
    }`,
  );
  console.log(
    `  tree: ${after === baseline ? "restored byte-identical to the baseline" : "DIRTY -- EVIDENCE VOID"}`,
  );

  if (hardFailure || after !== baseline) process.exit(1);
}

const IS_ENTRY_POINT =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY_POINT) main();
