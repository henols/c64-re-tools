#!/usr/bin/env node
// gsd-patch-uat-abstention.mjs
//
// WHY THIS EXISTS: `.claude/gsd-core/` is a VENDORED install -- untracked
// (only `.claude/settings.json` is in `git ls-files`) and overwritten wholesale
// by `/gsd-update`. The UAT abstention fix of 2026-08-29 edits one of its
// workflow files, so every update silently reverts it and leaves no trace
// explaining why UAT behaviour changed back. This script reapplies it.
//
// WHAT IT FIXES: GSD's UAT gate maps a bare Enter to `result: pass`
// (`workflows/verify-work.md`, `<philosophy>`) and its result vocabulary --
// `pass | issue | skipped | blocked` -- has no way to say "unverifiable by
// construction". An item that CANNOT be verified therefore has no truthful
// exit and the untruthful one is the default keypress. That contradicts
// `references/honest-verifier.md`, which mandates an abstained `backstop`
// truth be "`insufficient_spec`, flagged, -> `human_needed` -- **never
// `passed`**". It already wrote three false passes into phase 28's
// `28-UAT.md`. Full evidence: `.planning/notes/uat-gate-launders-abstentions.md`.
//
// Idempotent: reports `already-patched` and exits 0 if the markers are
// present. Exits 1 (without writing) if an anchor cannot be found, which means
// upstream reworded the file and the patch needs re-deriving rather than
// force-fitting.
//
// The DURABLE half of this fix is `src/mcp/vice/docs-uat-abstention.test.ts`,
// which guards the OUTCOME in tracked `.planning/` and runs in CI regardless
// of whether this patch is currently applied. This script is ergonomics: it
// stops the gate asking unanswerable questions in the first place.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, "..", ".claude", "gsd-core", "workflows", "verify-work.md");

/** Sentinel proving the patch is present. Must appear in every patched copy. */
const MARKER = "**The abstention carve-out.**";

const EDITS = [
  {
    name: "philosophy: carve the abstention out of the empty->pass default",
    old: `- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"`,
    new: `- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"

**The abstention carve-out.** The empty→pass default above is only sound for a test a
human can actually run. An item that is unverifiable BY CONSTRUCTION — one carrying
\`insufficient_spec\` from \`references/honest-verifier.md\`, or sourced from a truth tagged
\`verification: backstop\` / \`verification: judgment\` — has no truthful answer at this
prompt, so its default keypress silently manufactures a verification. \`honest-verifier.md\`
is explicit that such an item is "**abstain** → ⚠️ \`insufficient_spec\`, flagged, →
\`human_needed\` — **never \`passed\`**", and it must not be laundered here. Those items are
resolved as \`result: unverified\` at file-creation time and are NEVER presented as a
checkpoint (see \`create_uat_file\`). \`unverified\` is a definitive result: it does not block
session completion, and it is not a gap.`,
  },
  {
    name: "template summary: add the unverified counter",
    old: `## Summary

total: [N]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps`,
    new: `## Summary

total: [N]
passed: 0
issues: 0
unverified: 0
pending: [N]
skipped: 0

## Gaps`,
  },
  {
    name: "create_uat_file: pre-resolve abstentions, never present them",
    old: `The \`source: automated\` marker is additive — existing consumers that read only \`result:\` are unaffected.`,
    new: `The \`source: automated\` marker is additive — existing consumers that read only \`result:\` are unaffected.

**Abstained entries — pre-resolved as \`unverified\`, never presented.** Apply the same
write-a-resolved-result-without-asking mechanism to the opposite disposition. An item is
abstained when ANY of these hold:

- it arrives carrying \`reason: insufficient_spec\` (the honest-verifier abstention);
- its source truth is tagged \`verification: backstop\` or \`verification: judgment\`;
- it is a carried-forward \`behavior_unverified\` item from the phase's \`*-VERIFICATION.md\`;
- its \`why_human\` states the precondition cannot be constructed here (fault injection, a
  host-level crash, a physical device, an out-of-process observable).

Write it pre-resolved and do NOT present it:

\`\`\`
### N. [item description]
expected: [expected]
result: unverified
reason: insufficient_spec | judgment | fault_injection_required
why: [the item's own why_human, verbatim]
carried: true
\`\`\`

Pick \`reason\` from the item's own tag: \`insufficient_spec\` for a honest-verifier
abstention or a \`backstop\` truth, \`judgment\` for a \`verification: judgment\` prohibition
verdict, \`fault_injection_required\` when the blocker is a precondition no in-process test
can construct. Preserve \`why_human\` verbatim into \`why\` — the reason an item is
unverifiable is the whole payload, and re-wording it loses the specificity a later
held-out test would be written from.

**Why pre-resolve rather than ask:** presenting these costs a stop and returns no
information, because the human has no move that makes the item verified — the only exit
the prompt offers is the one \`honest-verifier.md\` forbids. Recording the abstention
truthfully preserves the signal that upstream measured cutting confident-false-passes on
blind-spot checks from 100% to 17%.`,
  },
  {
    name: "process_response: the explicit unverified branch",
    old: `**If response is anything else:**
- Treat as issue description`,
    new: `**If response indicates the item cannot be verified (not merely untested):**
- "unverifiable", "can't be verified", "no way to test this", "needs fault injection",
  "no in-process observable", "judgment call", "carry it"

Distinct from \`skipped\` (which reads downstream as *chose not to*) and from \`blocked\`
(which asserts an environmental blocker that will later clear). \`unverified\` asserts that
no run of this session could have resolved the item.

Update Tests section:
\`\`\`
### {N}. {name}
expected: {expected}
result: unverified
reason: insufficient_spec | judgment | fault_injection_required
why: "{verbatim user response}"
\`\`\`

Do NOT append to \`## Gaps\` — an abstention is not a code defect and must never spawn a
fix plan. Continue to the next test.

**If response is anything else:**
- Treat as issue description`,
  },
  {
    name: "complete_session: unverified is definitive and is surfaced",
    old: `\`\`\`
if pending_count > 0 OR blocked_count > 0 OR skipped_no_reason > 0:
  status: partial
  # Session ended but not all tests resolved
else:
  status: complete
  # All tests have a definitive result (pass, issue, or skipped-with-reason)
\`\`\``,
    new: `- \`unverified_count\`: tests with \`result: unverified\`

\`\`\`
if pending_count > 0 OR blocked_count > 0 OR skipped_no_reason > 0:
  status: partial
  # Session ended but not all tests resolved
else:
  status: complete
  # All tests have a definitive result (pass, issue, skipped-with-reason, or unverified)
\`\`\`

\`unverified\` is DEFINITIVE — it does not hold the session at \`partial\`. It is also never
silent: when \`unverified_count > 0\` the completion line reads

\`\`\`
complete — {unverified_count} unverified ({breakdown by reason})
\`\`\`

which is the interactive counterpart of the autonomous wording \`references/honest-verifier.md\`
already specifies ("the completion line reads 'complete with N unverified non-inferable
checks'; the run neither silently passes the blind spot nor hard-halts").`,
  },
];

if (!existsSync(TARGET)) {
  console.log(`skip: ${TARGET} not present (gsd-core is not installed here) — nothing to patch.`);
  process.exit(0);
}

let text = readFileSync(TARGET, "utf8");

if (text.includes(MARKER)) {
  console.log("already-patched: verify-work.md carries the abstention carve-out.");
  process.exit(0);
}

const missing = EDITS.filter((e) => text.split(e.old).length - 1 !== 1);
if (missing.length > 0) {
  console.error("ERROR: anchors not found (or not unique) for:");
  for (const m of missing) console.error(`  - ${m.name}`);
  console.error(
    "\nUpstream almost certainly reworded verify-work.md. Re-derive the patch against the new\n" +
      "text rather than force-fitting it. The outcome guard\n" +
      "(src/mcp/vice/docs-uat-abstention.test.ts) still protects the tracked artifacts meanwhile.",
  );
  process.exit(1);
}

for (const e of EDITS) text = text.replace(e.old, e.new);
writeFileSync(TARGET, text, "utf8");
console.log(`patched: ${EDITS.length} edits applied to ${TARGET}`);
