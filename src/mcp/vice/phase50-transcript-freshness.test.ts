// phase50-transcript-freshness.test.ts -- the only thing a GitHub runner can
// honestly check about Phase 50's emulator-dependent half.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Phase 50's behavioural evidence was produced against a real C64 running on
// genuine stock VICE. A GitHub runner has no C64, so it cannot re-derive any
// of it. What a runner CAN do is check whether the committed transcript still
// describes the fixture committed today.
//
// That check is the whole point. A transcript whose subject binary has since
// changed no longer describes anything in this tree -- it is STALE. A stale
// transcript is worse than no transcript, because a reader treats it as a
// current pass. Nothing else in this repository would notice.
//
// Three directions are checked, and each one is a distinct way the record can
// rot:
//
//   1. FRESHNESS. Every `prg_sha256` recorded in a transcript's frontmatter is
//      recomputed from the file on disk. A mismatch fails.
//   2. ORPHANS. A transcript naming a subject whose `.prg` no longer exists
//      fails. This is resources-sync.test.ts's own ORPHAN direction applied to
//      a document instead of a build output.
//   3. THE GREEN-ONLY REFUSAL. A transcript carrying a `## Green ...` section
//      and no `## Red ...` section fails. ROADMAP criterion 2 says outright
//      that "a green-only result is refused as evidence"; this is that rule
//      made mechanical rather than left to a reviewer's memory.
//
// WHY THE DISCOVERY PATTERN IS `phase50-*-transcript.md` AND NOT `phase50-*.md`
// ---------------------------------------------------------------------------
// `docs/` also holds `phase50-modifiability-findings.md` (a gate record) and
// `phase50-ci-boundary.md` (this plan's own boundary document). Neither is a
// transcript and neither carries a `subjects:` block. Widening the pattern to
// every `phase50-*.md` would force this file to sniff each document's content
// to decide whether it counts -- and a real transcript that LOST its
// `subjects:` block would then pass that sniff silently, which is exactly the
// quiet failure this file exists to prevent. With the narrower pattern,
// membership is decided by the file name and a matched transcript missing its
// `subjects:` block is a hard failure. A transcript added later is still
// covered with no code change, provided it is named like one.
//
// WHY EACH SUBJECT CARRIES A `prg_path`
// ---------------------------------------------------------------------------
// A recorded digest with no path is not checkable. The transcripts recorded
// `prg_sha256` per subject but named no file, and the subjects do not all live
// in one directory -- three are committed fixtures under
// `src/mcp/vice/fixtures/hazard-subject/` and `hazard-subject-rebuild` is a
// build output committed under the phase's own evidence directory. Guessing a
// path from a subject name would be a second, unwritten convention that
// resolves to the wrong file the moment two directories hold the same
// basename. Plan 50-07 therefore added an explicit `prg_path` beside each
// recorded digest, and this file refuses a subject that has none.
//
// WHAT THIS FILE DOES NOT DO
// ---------------------------------------------------------------------------
// It launches no process, starts no emulator and opens no socket. It reads
// files and hashes them, so it runs unchanged on a runner with no C64 and no
// assembler. It does not read a transcript's prose, and it does not re-derive
// any comparison result: freshness is not a re-run, and this file never claims
// otherwise. Re-deriving the comparison itself requires a real C64 running
// genuine stock VICE, which is exactly the half this runner cannot perform --
// that boundary is drawn once, for both halves, rather than repeated per file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The plain `.git`-marker walk, with no environment short-circuit -- the same
 * helper and the same reasoning as host-scripts.test.ts's copy: this gate must
 * always inspect the tree it is actually running from, so an isolated worktree
 * is never silently redirected to a shared main checkout. */
function findRepoRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no .git ancestor found above ${from}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot(HERE);
const DOCS_DIR = join(REPO_ROOT, "docs");

/** Discovery is by NAME PATTERN, never by a hardcoded list -- a transcript
 * added by a later plan is covered without touching this file. */
const TRANSCRIPT_PATTERN = /^phase50-.+-transcript\.md$/;

/** Named once, so every failure message below carries the same remedy and no
 * reader has to guess how a stale transcript is refreshed. */
const REFRESH_REMEDY =
  "REMEDY: a transcript cannot be regenerated by a build -- re-run the live capture session against " +
  "genuine stock VICE, driving the same subjects this transcript already names, until a fresh comparison " +
  "completes end to end, then commit the regenerated transcript in place of the stale one. Do NOT hand-edit " +
  "the recorded digest to match: that reinstates the stale record this check exists to catch.";

export interface TranscriptSubject {
  name: string;
  prgPath: string | null;
  prgSha256: string | null;
}

export interface TranscriptAuditOptions {
  /** Directory the transcripts are discovered in -- the repository's `docs/`
   * for the committed case, a scratch directory for this file's own negative
   * cases. */
  docsDir: string;
  /** Root every `prg_path` is resolved against. */
  root: string;
}

export function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Splits `---`-delimited YAML frontmatter off the body. Returns null when the
 * document has no frontmatter at all, which is itself a reported failure. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } | null {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return { frontmatter: lines.slice(1, i).join("\n"), body: lines.slice(i + 1).join("\n") };
    }
  }
  return null;
}

/** Reads the `subjects:` block out of a frontmatter string. Deliberately a
 * tiny indentation-aware reader for exactly the shape these transcripts use,
 * rather than a general YAML parser: this project ships no YAML dependency in
 * the MCP server, and a guard that needs one would be a new prerequisite for
 * the CI half -- the exact thing ROADMAP criterion 5 forbids. Returns null
 * when no `subjects:` key exists, which the caller reports as a failure. */
export function parseSubjects(frontmatter: string): TranscriptSubject[] | null {
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((l) => l === "subjects:");
  if (start < 0) return null;

  const subjects: TranscriptSubject[] = [];
  let current: TranscriptSubject | null = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) break;
    const subjectHeader = /^ {2}([^\s:]+):\s*$/.exec(line);
    if (indent === 2 && subjectHeader) {
      current = { name: subjectHeader[1], prgPath: null, prgSha256: null };
      subjects.push(current);
      continue;
    }
    const field = /^ {4}([A-Za-z0-9_]+):\s*(\S.*?)\s*$/.exec(line);
    if (indent === 4 && field && current) {
      if (field[1] === "prg_sha256") current.prgSha256 = field[2];
      if (field[1] === "prg_path") current.prgPath = field[2];
    }
    // Anything deeper (the `captures:` map) is out of this reader's scope by
    // construction: this guard checks the SUBJECT binaries, and a capture has
    // no recorded path to resolve.
  }
  return subjects;
}

/** Every `## ` heading in a markdown body, with fenced code blocks removed
 * first -- these transcripts quote real command output, and a quoted line
 * beginning `## ` must never be mistaken for a section of the document. */
export function topLevelHeadings(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.*?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** The whole guard, as one pure function over a directory, so this file's own
 * negative cases drive the SAME code path the committed case drives -- never a
 * second re-derived copy of the rule. Returns the list of failures; an empty
 * list means the transcripts are fresh, complete and paired. */
export function auditPhase50Transcripts(options: TranscriptAuditOptions): string[] {
  const failures: string[] = [];

  const transcripts = readdirSync(options.docsDir).filter((f) => TRANSCRIPT_PATTERN.test(f)).sort();
  if (transcripts.length === 0) {
    // NEVER a vacuous pass. A tree whose transcripts were deleted, renamed out
    // of the pattern, or never checked out is reported, not treated as clean.
    return [
      `no phase-50 transcript was found in ${options.docsDir} -- this guard matches ${TRANSCRIPT_PATTERN} and ` +
        "matched nothing, so it checked NOTHING. Either the transcripts were deleted or renamed out of the pattern. " +
        "An empty transcript set is a failure, never a pass.",
    ];
  }

  for (const name of transcripts) {
    const transcriptPath = join(options.docsDir, name);
    const text = readFileSync(transcriptPath, "utf8");

    const split = splitFrontmatter(text);
    if (!split) {
      failures.push(`${name}: the document has no \`---\`-delimited frontmatter, so no recorded digest can be checked.`);
      continue;
    }

    // --------------------------------------------------------------------
    // Direction 1 and 2: freshness and orphans.
    // --------------------------------------------------------------------
    const subjects = parseSubjects(split.frontmatter);
    if (subjects === null) {
      failures.push(
        `${name}: the frontmatter carries no \`subjects:\` block. A transcript with no recorded subject digest ` +
          "cannot be checked for staleness at all, which is indistinguishable from a transcript that is stale."
      );
    } else if (subjects.length === 0) {
      failures.push(`${name}: the \`subjects:\` block is empty, so this transcript records nothing that can go stale.`);
    } else {
      for (const subject of subjects) {
        if (!subject.prgPath) {
          failures.push(
            `${name}: subject \`${subject.name}\` has no \`prg_path\`. A recorded digest with no path names no file ` +
              "and is therefore unverifiable. Add the repository-relative path of the subject's `.prg` beside its `prg_sha256`."
          );
          continue;
        }
        if (!subject.prgSha256) {
          failures.push(
            `${name}: subject \`${subject.name}\` has no \`prg_sha256\`. A named subject with no recorded digest ` +
              "records nothing this guard can compare against."
          );
          continue;
        }
        const absolute = join(options.root, subject.prgPath);
        if (!existsSync(absolute)) {
          failures.push(
            `${name}: ORPHAN -- subject \`${subject.name}\` names \`${subject.prgPath}\`, which does not exist in this tree. ` +
              "The transcript describes a binary that is gone, so nothing it records can be checked. " +
              REFRESH_REMEDY
          );
          continue;
        }
        const current = sha256OfFile(absolute);
        if (current !== subject.prgSha256) {
          failures.push(
            `${name}: STALE -- subject \`${subject.name}\` (\`${subject.prgPath}\`) recorded sha256 ` +
              `${subject.prgSha256} but the committed file now hashes to ${current}. The transcript describes a ` +
              "binary that no longer exists in this tree, so its recorded result must not be read as a current pass. " +
              REFRESH_REMEDY
          );
        }
      }
    }

    // --------------------------------------------------------------------
    // Direction 3: the green-only refusal (ROADMAP criterion 2).
    // --------------------------------------------------------------------
    const headings = topLevelHeadings(split.body);
    const green = headings.filter((h) => /^green\b/i.test(h));
    const red = headings.filter((h) => /^red\b/i.test(h));
    if (green.length > 0 && red.length === 0) {
      failures.push(
        `${name}: REFUSED -- this transcript carries a green section (${JSON.stringify(green)}) and no paired ` +
          "`## Red ...` control section. ROADMAP criterion 2 refuses a green-only result as evidence: an instrument " +
          "that has never been observed failing has not been shown capable of failing, so its pass means nothing. " +
          "Commit the red control section in the same transcript, or move the green result into a transcript that has one."
      );
    }
  }

  return failures;
}

// ===========================================================================
// The committed case
// ===========================================================================

test("every committed phase-50 transcript is fresh, unorphaned, and pairs its green result with a red control", () => {
  assert.deepEqual(
    auditPhase50Transcripts({ docsDir: DOCS_DIR, root: REPO_ROOT }),
    [],
    "the committed phase-50 transcripts no longer describe the tree they were written against"
  );
});

test("the committed docs/ directory really does hold at least two phase-50 transcripts", () => {
  // Guards the guard: every negative case below is meaningless if the
  // discovery pattern silently matches nothing in the real tree.
  const found = readdirSync(DOCS_DIR).filter((f) => TRANSCRIPT_PATTERN.test(f)).sort();
  assert.deepEqual(found, [
    "phase50-equivalence-transcript.md",
    "phase50-exported-modifiability-transcript.md",
    "phase50-modifiability-transcript.md",
  ]);
});

// ===========================================================================
// The negative cases -- each one constructs a broken tree in a scratch
// directory and asserts the guard reports it. This is the layer that makes
// "a broken step reddens CI" an assertion on every run rather than a
// one-off observation.
// ===========================================================================

interface ScratchSubject {
  name: string;
  prgPath?: string;
  prgSha256?: string;
}

/** Builds a scratch tree holding one transcript and (optionally) its subject
 * binaries, and returns the root. The caller removes it. */
function makeScratchTree(options: {
  transcriptName?: string;
  subjects: ScratchSubject[];
  files: Record<string, string>;
  headings: string[];
}): string {
  const root = mkdtempSync(join(tmpdir(), "phase50-freshness-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });

  for (const [rel, contents] of Object.entries(options.files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }

  const subjectLines = options.subjects.flatMap((s) => {
    const lines = [`  ${s.name}:`];
    if (s.prgSha256 !== undefined) lines.push(`    prg_sha256: ${s.prgSha256}`);
    if (s.prgPath !== undefined) lines.push(`    prg_path: ${s.prgPath}`);
    lines.push("    captures:");
    lines.push("      only-one: 0000000000000000000000000000000000000000000000000000000000000000");
    return lines;
  });

  const text = ["---", "phase: scratch", "subjects:", ...subjectLines, "---", "", "# Scratch transcript", "", ...options.headings.map((h) => `${h}\n\nbody\n`)].join("\n");
  writeFileSync(join(docsDir, options.transcriptName ?? "phase50-scratch-transcript.md"), text);
  return root;
}

const RED_AND_GREEN = ["## Red control: a planted regression is caught", "## Green: the rebuild behaves like the original"];

test("a recorded digest that no longer matches the file on disk fails, naming both digests and the remedy", () => {
  const real = "a".repeat(64);
  const root = makeScratchTree({
    subjects: [{ name: "scratch-subject", prgPath: "fixtures/scratch-subject.prg", prgSha256: real }],
    files: { "fixtures/scratch-subject.prg": "the bytes actually committed" },
    headings: RED_AND_GREEN,
  });
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    const message = failures[0];
    const current = sha256OfFile(join(root, "fixtures/scratch-subject.prg"));
    assert.match(message, /phase50-scratch-transcript\.md/, "the failure must name the transcript");
    assert.match(message, /scratch-subject/, "the failure must name the subject");
    assert.ok(message.includes(real), "the failure must carry the RECORDED digest");
    assert.ok(message.includes(current), "the failure must carry the CURRENT digest");
    assert.ok(message.includes("REMEDY"), "the failure must name the remedy");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a transcript naming a .prg that does not exist on disk fails as an ORPHAN", () => {
  const root = makeScratchTree({
    subjects: [{ name: "vanished-subject", prgPath: "fixtures/vanished-subject.prg", prgSha256: "b".repeat(64) }],
    files: {},
    headings: RED_AND_GREEN,
  });
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /ORPHAN/, "a missing subject binary must be reported as an orphan");
    assert.match(failures[0], /fixtures\/vanished-subject\.prg/, "the orphan failure must name the missing path");
    assert.match(failures[0], /phase50-scratch-transcript\.md/, "the orphan failure must name the transcript");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a transcript carrying a green section and no red control is REFUSED", () => {
  const bytes = "identical bytes";
  const root = makeScratchTree({
    subjects: [
      {
        name: "scratch-subject",
        prgPath: "fixtures/scratch-subject.prg",
        prgSha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
    files: { "fixtures/scratch-subject.prg": bytes },
    headings: ["## Green: the rebuild behaves like the original"],
  });
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /green/i, "the refusal must name the green section");
    assert.match(failures[0], /red/i, "the refusal must name the missing red control");
    assert.match(failures[0], /phase50-scratch-transcript\.md/, "the refusal must name the transcript");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the same transcript with a paired red control passes", () => {
  // The paired direction, so the case above cannot pass for the wrong reason
  // (a guard that refused every transcript would also satisfy it).
  const bytes = "identical bytes";
  const root = makeScratchTree({
    subjects: [
      {
        name: "scratch-subject",
        prgPath: "fixtures/scratch-subject.prg",
        prgSha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
    files: { "fixtures/scratch-subject.prg": bytes },
    headings: RED_AND_GREEN,
  });
  try {
    assert.deepEqual(auditPhase50Transcripts({ docsDir: join(root, "docs"), root }), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a directory holding no phase-50 transcript at all FAILS rather than passing vacuously", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-freshness-empty-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "phase50-ci-boundary.md"), "# not a transcript\n");
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /no phase-50 transcript/i, "an empty transcript set must be named as such");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a transcript subject with no prg_path fails rather than being skipped", () => {
  const root = makeScratchTree({
    subjects: [{ name: "pathless-subject", prgSha256: "c".repeat(64) }],
    files: {},
    headings: RED_AND_GREEN,
  });
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /prg_path/, "the failure must name the missing key");
    assert.match(failures[0], /pathless-subject/, "the failure must name the subject");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a transcript matching the pattern but carrying no subjects: block fails", () => {
  const root = mkdtempSync(join(tmpdir(), "phase50-freshness-nosubjects-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(
    join(root, "docs", "phase50-scratch-transcript.md"),
    ["---", "phase: scratch", "---", "", "## Red control: x", "", "## Green: y", ""].join("\n")
  );
  try {
    const failures = auditPhase50Transcripts({ docsDir: join(root, "docs"), root });
    assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(failures)}`);
    assert.match(failures[0], /subjects:/, "the failure must name the missing block");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ===========================================================================
// The helpers' own contracts
// ===========================================================================

test("topLevelHeadings ignores a `## ` line quoted inside a fenced code block", () => {
  const body = ["## Real heading", "", "```", "## Not a heading, this is captured output", "```", "", "## Second real heading"].join("\n");
  assert.deepEqual(topLevelHeadings(body), ["Real heading", "Second real heading"]);
});

test("topLevelHeadings does not mistake a ### subsection for a ## section", () => {
  assert.deepEqual(topLevelHeadings(["## Section", "### Subsection"].join("\n")), ["Section"]);
});
