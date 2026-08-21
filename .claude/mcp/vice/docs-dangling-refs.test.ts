// docs-dangling-refs.test.ts
//
// WHY THIS EXISTS: T-11-DOC-DANGLE. Phase 10's D-03 dropped `.vsf` from
// regenerator2000's bootstrap input set but pointed the deferral at "Phase
// 11's `c64-ram-capture` extension" as `.vsf`'s eventual home. That pointer
// was wrong -- no `R2000-*` requirement covers `.vsf` as a bootstrap input
// (D-34) -- so Phase 11 plan 11-03 corrected it and filed the idea as a real
// backlog item instead.
//
// It corrected FOUR of the FIVE sites. `.planning/REQUIREMENTS.md`'s
// `R2000-08` fold entry still read "`.vsf` moves to Phase 11's
// `c64-ram-capture` extension" for a further day, through phase completion,
// verification AND a security audit, because 11-03-T1's declared verification
// was a hand-run `grep -c vsf .planning/ROADMAP.md` -- scoped to a single
// file. A one-file grep can never catch a five-file class of defect. That is
// the gap this file closes: the SAME assertion, repo-wide and mechanical.
//
// The check is deliberately scoped to the NORMATIVE, forward-looking
// documents -- the ones a future session reads for guidance about where work
// lives. Executed-phase artifacts under `.planning/phases/**` are historical
// records that legitimately quote the wrong wording while describing its
// removal, and the backlog item is the sanctioned home, so neither is
// scanned. Widening the scope to them would produce false positives and the
// guard would be switched off; keeping it narrow keeps it trusted.
//
// Like docs-linerefs.test.ts (the precedent this follows), it reads the real
// documents rather than a copy pasted into the test, and it is deliberately
// kept OUT of package.json's files[] -- it verifies planning-facing
// documentation, not runtime behaviour shipped in the tarball.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

/** The normative, forward-looking document set. A future session reads these
 * to learn where work lives; a dangling phase pointer in any of them sends
 * that session to a phase that never claimed the work. Paths are relative to
 * the repo root and are all expected to exist -- a missing one FAILS rather
 * than silently shrinking the scanned set. */
const NORMATIVE_DOCS = Object.freeze([
  ".planning/ROADMAP.md",
  ".planning/REQUIREMENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/roadmap-stock-vice.md",
  "docs/stock-vice-parity.md",
]);

/** The backlog item `.vsf` was filed as. It IS `.vsf`'s recorded home, so it
 * must keep existing -- if it is deleted, the corrected pointers in
 * NORMATIVE_DOCS all become dangling again in the other direction. */
const VSF_BACKLOG_ITEM = ".planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md";

/** Splits prose into sentence-ish units. Markdown wraps mid-sentence, so
 * splitting on lines would hide a pointer whose two halves straddle a line
 * break -- which is exactly the shape REQUIREMENTS.md's surviving instance
 * had ("...for\n  this phase; `.vsf` moves to Phase 11's..."). Newlines
 * collapse to spaces first, then split on sentence terminators. */
function sentences(markdown: string): string[] {
  return markdown
    .replace(/\s*\n\s*/g, " ")
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Reads a phase-assignment pointer: prose that hands a topic to a numbered
 * phase as its home. Both orderings are covered -- the verb-first shape
 * ("moves to Phase 11", "deferred to Phase 12") and the possessive shape
 * ("Phase 11's c64-ram-capture extension"). */
const ASSIGNMENT_RES = Object.freeze([
  /\b(?:moves?|move|moved|deferred|defers?|belongs?|lands?|pushed|punted|reassigned|handed)\b[^.;]{0,80}?\bPhase\s+\d+/i,
  /\bPhase\s+\d+(?:'s|s')\s+[^.;]{0,60}?\b(?:extension|home|scope|deliverable|remit)\b/i,
  /\b(?:home|owner|owned by|covered by|claimed by|lives in)\b[^.;]{0,40}?\bPhase\s+\d+/i,
]);

function isPhaseAssignment(sentence: string): boolean {
  return ASSIGNMENT_RES.some((re) => re.test(sentence));
}

/** Every sentence in the normative docs that both mentions `.vsf` and hands
 * a topic to a numbered phase. Returned as `{ doc, sentence }` so a failure
 * message names the file to edit. */
function danglingVsfPointers(): { doc: string; sentence: string }[] {
  const hits: { doc: string; sentence: string }[] = [];
  for (const doc of NORMATIVE_DOCS) {
    const path = join(ROOT, doc);
    assert.ok(existsSync(path), `${doc} is in NORMATIVE_DOCS but does not exist -- update the list rather than letting the scanned set shrink silently`);
    for (const sentence of sentences(readFileSync(path, "utf8"))) {
      if (!/\bvsf\b/i.test(sentence)) continue;
      if (isPhaseAssignment(sentence)) hits.push({ doc, sentence });
    }
  }
  return hits;
}

test("no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)", () => {
  const hits = danglingVsfPointers();
  assert.deepEqual(
    hits,
    [],
    "dangling `.vsf` phase pointer(s) found. No `R2000-*` requirement covers `.vsf` as a regenerator2000 " +
      `bootstrap input (D-34) -- point at ${VSF_BACKLOG_ITEM} instead of at a phase:\n` +
      hits.map((h) => `  ${h.doc}: ${h.sentence}`).join("\n"),
  );
});

test("the `.vsf` backlog item still exists and still records why it is deferred", () => {
  const path = join(ROOT, VSF_BACKLOG_ITEM);
  assert.ok(existsSync(path), `${VSF_BACKLOG_ITEM} is missing -- it is where the corrected pointers in ${NORMATIVE_DOCS.join(", ")} send the reader. Deleting it re-creates the dangling reference in the other direction.`);
  const body = readFileSync(path, "utf8");
  assert.match(body, /vsf/i, "the backlog item must still be about `.vsf`");
  assert.match(body, /R2000-\d+/, "the backlog item must still name the requirement IDs it establishes do NOT cover `.vsf` -- that is the reason it is backlog and not a phase");
});

test("non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it", () => {
  // A rewording that removed every `.vsf` mention from the normative docs
  // would make the guard above pass by finding nothing to check -- the
  // vacuity WR-02 and T-11-VACUOUS exist to catch. Assert there is real
  // subject matter being scanned.
  assert.ok(NORMATIVE_DOCS.length >= 4, `expected a meaningful normative document set, got ${NORMATIVE_DOCS.length}`);
  const mentioning = NORMATIVE_DOCS.filter((doc) => /\bvsf\b/i.test(readFileSync(join(ROOT, doc), "utf8")));
  assert.ok(mentioning.length >= 2, `expected at least two normative documents to discuss \`.vsf\` (so the guard has something to check); only ${mentioning.length} do: ${mentioning.join(", ")}`);
});

test("planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic", () => {
  // Verbatim from `.planning/REQUIREMENTS.md`'s R2000-08 fold entry as it
  // read from plan 11-03 (2026-08-20) until the Phase 11 validation audit
  // (2026-08-21) -- including the line break it straddled, which is why the
  // scanner joins lines before splitting sentences.
  const survived = "Flat 64K (`.raw`) is the surviving non-`.prg`/`.d64` route for\n  this phase; `.vsf` moves to Phase 11's `c64-ram-capture` extension.";
  const flagged = sentences(survived).filter((s) => /\bvsf\b/i.test(s) && isPhaseAssignment(s));
  assert.ok(flagged.length >= 1, `the guard failed to flag the exact wording it exists to catch -- it is vacuous. Sentences seen: ${JSON.stringify(sentences(survived))}`);

  // And the corrected wording must NOT be flagged, or the guard is
  // unsatisfiable and would just get deleted.
  const corrected = "`.vsf` has **no** later phase as its home — no `R2000-*` requirement covers it as a bootstrap input (confirmed by D-34), so it is filed as backlog rather than pointed at a phase.";
  const falsePositives = sentences(corrected).filter((s) => /\bvsf\b/i.test(s) && isPhaseAssignment(s));
  assert.deepEqual(falsePositives, [], "the corrected wording must not be flagged -- a guard that cannot be satisfied gets switched off");
});

// ---------------------------------------------------------------------------
// Second, independent section: the SAME defect class (a dangling phase
// pointer) one layer down, in SHIPPED SOURCE STRINGS rather than the
// normative documents above. FLOW-02 (D-11.1-01) is the founding instance:
// `r2000-cli.ts` told a user that closing the `.vsf` gap "is Phase 11's
// job" in both its USAGE text and its live `bootstrap` refusal, and the
// test that pinned the claim (`assert.match(stderr, /Phase 11/)`) never
// caught it -- it certified the falsehood green. This section generalises
// that instance into a mechanical, repo-wide guard over every shipped
// `.claude/mcp/vice/` module's string literals.
//
// SCOPE: string/template literals only, NEVER comments. A comment-scoped
// guard would be self-invalidating -- the commit that fixes a dangling
// phase pointer legitimately wants to name the old wording in a "what NOT
// to do" comment (this repo's established register; see r2000-cli.ts's and
// r2000-project.ts's FLOW-02 comments), and a guard that scanned comments
// would fail on the very commit that satisfies it. CLAUDE.md's grep-gate
// hygiene rule names exactly this hazard. KNOWN, ACCEPTED GAP:
// `r2000-project.ts`'s `.vsf` header comment carried this repo's third
// FLOW-02 site and was corrected by hand in plan 11.1-01's Task 1; this
// guard does not, and by design will not, hold that comment. A future
// regression there would only be caught by re-reading the file.
//
// EXTRACTOR: a hand-written character state machine, not a regex. Measured
// during planning: a regex-alternation extractor silently failed to see
// r2000-cli.ts's `USAGE` template literal -- the exact site FLOW-02 lived
// at -- and reported only 2 of the 3 literal fragments the pre-fix source
// actually carried. A guard blind at the one site that mattered is worse
// than no guard, so `extractStringLiterals()` below carries its own
// positive-control test proving it sees that template.

/**
 * Extracts the CONTENT of every string and template literal in `src`, via a
 * single-pass character state machine (never a regex -- see this section's
 * header for the measured blindness that ruled a regex out). Tracks line
 * comments, block comments, single- and double-quoted strings, and template
 * literals, including nested `${ ... }` interpolation (itself scanned for
 * further comments/strings/nested templates) and backslash escapes in every
 * quoted form.
 *
 * Escape sequences are returned verbatim (not decoded) in the literal's
 * content -- irrelevant to this guard's `/\bPhase\s+\d/i` predicate, and
 * decoding is surface this guard does not need. Regex-literal bodies are
 * not specially recognised (this guard has no reason to enter one; none of
 * this repo's shipped modules put phase-pointer prose inside a regex).
 */
function extractStringLiterals(src: string): string[] {
  const literals: string[] = [];
  const n = src.length;
  let i = 0;

  // One entry per currently-open template literal (innermost last), so a
  // template nested inside another's `${ ... }` interpolation is tracked
  // independently of its parent.
  interface TemplateFrame {
    buf: string;
    /** True while scanning inside this frame's `${ ... }` interpolation
     * rather than its literal text. */
    inInterp: boolean;
    /** Brace nesting depth within the current interpolation -- needed
     * because the interpolation's own code can contain object literals,
     * blocks, etc. with unrelated `{`/`}` pairs. Reaching 0 closes the
     * interpolation and returns to accumulating literal text. */
    interpBraceDepth: number;
  }
  const templateStack: TemplateFrame[] = [];

  while (i < n) {
    const c = src[i];
    const top = templateStack.length > 0 ? templateStack[templateStack.length - 1] : undefined;

    if (top && !top.inInterp) {
      // Accumulating this template literal's own text (not inside `${ }`).
      if (c === "\\") {
        top.buf += c + (src[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (c === "`") {
        literals.push(top.buf);
        templateStack.pop();
        i++;
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        top.inInterp = true;
        top.interpBraceDepth = 1;
        i += 2;
        continue;
      }
      top.buf += c;
      i++;
      continue;
    }

    // Top-level code, OR inside a template literal's `${ ... }`
    // interpolation (both scan for comments/strings/nested templates the
    // same way; only the brace-depth tracking below differs).
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let buf = "";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          buf += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        buf += src[i];
        i++;
      }
      i++; // skip closing quote
      literals.push(buf);
      continue;
    }
    if (c === "`") {
      templateStack.push({ buf: "", inInterp: false, interpBraceDepth: 0 });
      i++;
      continue;
    }
    if (top && top.inInterp) {
      if (c === "{") {
        top.interpBraceDepth++;
        i++;
        continue;
      }
      if (c === "}") {
        top.interpBraceDepth--;
        i++;
        if (top.interpBraceDepth === 0) top.inInterp = false;
        continue;
      }
    }
    i++;
  }
  return literals;
}

/** The shipped module set this guard scans: every `package.json` `files[]`
 * entry ending `.ts`/`.mts`. Derived, not enumerated -- the guard-first
 * principle this phase's CONTEXT.md organises around -- so a module added
 * to `files[]` by a later phase is scanned automatically, with no edit
 * here. A `files[]` entry that does not exist on disk FAILS this function
 * rather than silently shrinking the scanned set (the INT-01 lesson applied
 * preemptively). */
function shippedTsModules(): string[] {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    assert.ok(
      existsSync(join(HERE, entry)),
      `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
    );
  }
  return entries;
}

/** Every literal, from every shipped module, whose content names a phase
 * number. Blanket inside literals -- no exemption list, no verb heuristics
 * (a phase number is a planning artifact; a string literal is, or may
 * become, user-facing). */
function danglingPhaseLiterals(): { file: string; literal: string }[] {
  const hits: { file: string; literal: string }[] = [];
  for (const file of shippedTsModules()) {
    const src = readFileSync(join(HERE, file), "utf8");
    for (const literal of extractStringLiterals(src)) {
      if (/\bPhase\s+\d/i.test(literal)) hits.push({ file, literal });
    }
  }
  return hits;
}

test("no shipped .claude/mcp/vice/ string literal names a phase number (FLOW-02)", () => {
  const hits = danglingPhaseLiterals();
  assert.deepEqual(
    hits,
    [],
    "shipped string literal(s) name a phase number -- a phase is a planning artifact, never a " +
      "durable user-facing remediation path (D-11.1-01). Reword to name a backlog file or drop the " +
      "phase reference entirely:\n" +
      hits.map((h) => `  ${h.file}: ${h.literal.slice(0, 160)}`).join("\n"),
  );
});

test("positive control: the scanner captures the literals this guard exists to police", () => {
  // The anti-blindness control: without this, the test above can pass by
  // seeing nothing, exactly like the measured regex-alternation failure
  // this section's header describes.
  const literals = extractStringLiterals(readFileSync(join(HERE, "r2000-cli.ts"), "utf8"));
  assert.ok(
    literals.some((l) => /usage \(npm install\)/.test(l)),
    "the scanner did not capture r2000-cli.ts's USAGE template literal -- exactly the blindness a regex-alternation extractor was measured to have",
  );
  assert.ok(
    literals.some((l) => /\.vsf input is not supported/.test(l)),
    "the scanner did not capture the .vsf bootstrap refusal literal",
  );
});

test("non-vacuity: the scanned set and the extracted literal volume are real", () => {
  // Floors set below the numbers actually measured on 2026-08-21 (58
  // modules, 4928 literals) -- never a floor equal to a number that was
  // never measured (ENGINEERING_RULES.md §6).
  const modules = shippedTsModules();
  assert.ok(modules.length >= 40, `expected at least 40 shipped .ts/.mts modules, got ${modules.length}`);

  let total = 0;
  for (const file of modules) {
    total += extractStringLiterals(readFileSync(join(HERE, file), "utf8")).length;
  }
  assert.ok(total >= 500, `expected at least 500 string/template literals across the shipped set, got ${total}`);
});

test("planted-violation: the verbatim pre-fix wording is flagged, and the corrected wording is not", () => {
  // (a) the pre-fix USAGE paragraph, verbatim, inside a template literal
  // with a `${x}` interpolation before it -- the exact construct the regex
  // extractor was measured to miss.
  const preFixUsage =
    'const x = "ctx";\n' +
    "const USAGE = `header ${x} more\n" +
    ".vsf input is not supported by any verb. Phase 9 found its machine-type\n" +
    "field only reads correctly by coincidence; closing that gap for real is\n" +
    "Phase 11's job, not this CLI's. Convert to .prg, .d64 or a flat 64K capture.\n" +
    "`;\n";

  // (b) the pre-fix bootstrap refusal, verbatim, as the three-part `"…" +
  // "…" + "…"` concatenation it actually was.
  const preFixRefusal = `if (ext === ".vsf") {
    console.error(
      "bootstrap: .vsf input is not supported -- Phase 9 found its machine-type field only reads " +
        'correctly by coincidence ("C64SC" falls through to regenerator2000\\'s own default, matching ' +
        "none of its literal System arms). Closing that gap for real is Phase 11's job, not this CLI's. " +
        "Convert to .prg, .d64 or a flat 64K capture instead.",
    );
    return { code: 1 };
  }
`;

  const preFixHits = extractStringLiterals(preFixUsage + preFixRefusal).filter((l) => /\bPhase\s+\d/i.test(l));
  assert.equal(
    preFixHits.length,
    3,
    `expected exactly 3 flagged literal fragments (the USAGE template plus two of the refusal's three concatenated parts), got ${preFixHits.length}: ${JSON.stringify(preFixHits)}`,
  );

  // The corrected wording (this repo's actual, current r2000-cli.ts) must
  // NOT be flagged -- a guard that cannot be satisfied gets switched off
  // (this file's other planted-violation test makes the same point).
  const correctedHits = extractStringLiterals(readFileSync(join(HERE, "r2000-cli.ts"), "utf8")).filter((l) =>
    /\bPhase\s+\d/i.test(l),
  );
  assert.deepEqual(correctedHits, [], "the corrected r2000-cli.ts must not be flagged -- the fix would be self-invalidating otherwise");
});
