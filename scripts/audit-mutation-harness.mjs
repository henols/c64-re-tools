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

import { resolveContainedRoot } from "./lib/audit-root.mjs";

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
let restored = false;

function restoreAll() {
  if (restored) return;
  restored = true;
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

// `finally` and `exit` can both fire; `restored` makes the second call a no-op.
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
function plant(root, row) {
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

  // Contain the plant target: a registry value must not be able to name a path
  // outside the tree this run was pointed at.
  const abs = resolveContainedRoot(join(root, descriptor.file), { repoRoot: root });
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

  if (!originals.has(abs)) originals.set(abs, originalBytes);
  writeFileSync(abs, Buffer.from(text.replace(descriptor.find, descriptor.replace), "latin1"));

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
  return {
    label,
    command,
    cwd: relativeCwd,
    cwdAbsolute: cwd,
    status: result.status ?? 1,
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

function parseArgs(argv) {
  let root;
  let row;
  let rows;
  let all = false;
  let out;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      root = argv[i + 1];
      i += 1;
    } else if (a === "--row") {
      row = argv[i + 1];
      i += 1;
    } else if (a === "--rows") {
      rows = argv[i + 1];
      i += 1;
    } else if (a === "--all") {
      all = true;
    } else if (a === "--out") {
      out = argv[i + 1];
      i += 1;
    } else {
      throw new Error(
        `unrecognised argument ${JSON.stringify(a)}. Usage: node ` +
          "scripts/audit-mutation-harness.mjs (--row <historicalPath> | --rows <p,p,...> | " +
          "--all) [--root <dir>] [--out <file>]",
      );
    }
  }
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

  assertTreeClean(root, baseline, `before row ${row.historicalPath}`);

  // 1b. The GREEN false-positive control, BEFORE any plant.
  const control = runGuard(root, row, "control (unplanted)");
  if (control.status !== 0) {
    report.unmeasurable = true;
    report.reason =
      "the UNPLANTED control did not exit 0, so a subsequent red would prove nothing about the " +
      "plant. Recorded as UNMEASURABLE rather than as an observed red." +
      (control.timedOut ? " The control TIMED OUT." : "");
    report.control = control;
    return report;
  }

  // 2. Plant.
  const planted = plant(root, row);
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
  lines.push(`- **Rows measured:** ${reports.length}`);
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
      continue;
    }
    if (report.failed) {
      lines.push(`**HARNESS FAILURE.** ${report.reason}`);
      lines.push("");
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
    console.error(`audit-mutation-harness: USAGE -- ${err?.message ?? String(err)}`);
    process.exit(2);
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

  console.log(`audit-mutation-harness: measured ${reports.length} row(s)`);
  for (const report of reports) {
    if (report.unmeasurable) {
      console.log(`  UNMEASURABLE  ${report.historicalPath}: ${report.reason}`);
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
  console.log(`  evidence: ${outPath}`);
  console.log(
    `  registry: ${hardFailure ? "NOT written (a row was unmeasurable or exited 0)" : registryPath}`,
  );
  console.log(
    `  tree: ${after === baseline ? "restored byte-identical to the baseline" : "DIRTY -- EVIDENCE VOID"}`,
  );

  if (hardFailure || after !== baseline) process.exit(1);
}

const IS_ENTRY_POINT =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY_POINT) main();
