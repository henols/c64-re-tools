#!/usr/bin/env node
// gsd-reapply-local.mjs
//
// WHY THIS EXISTS: `.claude/gsd-core/` and its sibling installed dirs are a
// VENDORED GSD install -- ~700 files, stamped with this machine's absolute
// paths at install time, regenerated wholesale by `/gsd-update`, and (since
// this commit) gitignored so that updating GSD never changes the repo.
//
// The cost of that choice is that local customisations to the install are not
// preserved by git. There are two, both load-bearing, and `/gsd-update`
// silently reverts each one:
//
//   1. agents/gsd-executor.md -- grants `mcp__vice__*` and `effort: high`.
//      Without the tool grant a gsd-executor CANNOT call the VICE MCP surface,
//      which is most of what this project's phases do. The failure mode is an
//      executor that mysteriously cannot drive the emulator.
//   2. gsd-core/workflows/verify-work.md -- the UAT abstention carve-out
//      (`result: unverified`). Delegated to gsd-patch-uat-abstention.mjs,
//      which owns that patch and is idempotent.
//
// Run after `/gsd-update`. Also wired as a SessionStart hook in
// .claude/settings.json so a reverted install self-heals at the start of the
// next session rather than failing mid-phase.
//
// CONTRACT: exit 0 and print nothing actionable when the install is absent.
// Nothing in this repo may require GSD to be present -- CI and fresh clones
// have no `.claude/gsd-core/`, and that is a supported state, not an error.
// Exits 1 only when the install IS present and a patch could not be applied,
// which means upstream reworded an anchor and the patch needs re-deriving.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const EXECUTOR = join(ROOT, ".claude", "agents", "gsd-executor.md");
const GSD_CORE = join(ROOT, ".claude", "gsd-core");

/** Tool grant the executor needs to reach the VICE MCP surface. */
const VICE_TOOLS = "mcp__vice__*";
/** Reasoning effort this project runs executors at. */
const EFFORT_LINE = "effort: high";

let failed = false;

function patchExecutor() {
  if (!existsSync(EXECUTOR)) {
    console.log("skip: .claude/agents/gsd-executor.md absent (GSD not installed here)");
    return;
  }
  const src = readFileSync(EXECUTOR, "utf8");
  const end = src.indexOf("\n---", 4);
  if (!src.startsWith("---\n") || end === -1) {
    console.error("FAIL: gsd-executor.md has no parseable frontmatter -- re-derive this patch");
    failed = true;
    return;
  }
  let front = src.slice(0, end);
  const body = src.slice(end);
  let changed = false;

  if (!front.includes(VICE_TOOLS)) {
    const tools = front.match(/^tools: .*$/m);
    if (!tools) {
      console.error("FAIL: gsd-executor.md has no `tools:` line -- re-derive this patch");
      failed = true;
      return;
    }
    front = front.replace(tools[0], `${tools[0]}, ${VICE_TOOLS}`);
    changed = true;
  }

  if (!/^effort:/m.test(front)) {
    front = `${front}\n${EFFORT_LINE}`;
    changed = true;
  }

  if (!changed) {
    console.log("already-applied: gsd-executor.md carries the vice tool grant and effort");
    return;
  }
  writeFileSync(EXECUTOR, front + body);
  console.log("applied: gsd-executor.md -- restored mcp__vice__* grant / effort: high");
}

function patchUatGate() {
  const patcher = join(HERE, "gsd-patch-uat-abstention.mjs");
  if (!existsSync(patcher)) return;
  if (!existsSync(GSD_CORE)) {
    console.log("skip: .claude/gsd-core absent (GSD not installed here)");
    return;
  }
  const r = spawnSync(process.execPath, [patcher], { encoding: "utf8" });
  process.stdout.write(r.stdout ?? "");
  if (r.status !== 0) {
    process.stderr.write(r.stderr ?? "");
    console.error("FAIL: UAT abstention patch could not be applied -- see above");
    failed = true;
  }
}

patchExecutor();
patchUatGate();
process.exit(failed ? 1 : 0);
