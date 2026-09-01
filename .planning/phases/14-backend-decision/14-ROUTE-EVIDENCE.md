# 14-02 Route Evidence: FORK-02 point-of-use verification

Plan 14-02, Task 1. This document is the enumerated evidence for ROADMAP Phase
14 criterion 2 (FORK-02): every point-of-use mention of the three hard-loss
tools (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`)
is enumerated with a file:line citation and a per-site verdict against the
branch FORK-01 chose. No skill, doc, or source file is edited by this task.

## Branch

**Branch token: `retain`** — read from `.planning/phases/14-backend-decision/14-01-SUMMARY.md`
§ `## Decision`: "Decided by a **human**, at Task 2's `gate="blocking-human"`
checkpoint, after explicit escalation by the orchestrator."

**Sub-question B: NOT overridden.** 14-01's own text: "the plan's own stated
default (an honest, complete statement of permanent loss satisfies FORK-02 for
SID read-back and RESTORE/NMI, matching how `capability-registry.ts` already
words genuinely unbuilt losses) is what plans 14-02 through 14-05 should
read." This plan reads that default as binding — see `## The two
totally-unrecoverable cases` below.

**Sub-question A does not arise** — it is conditioned on a non-`retain`
branch (full deletion vs. deprecate-then-delete), and `retain` was chosen.

Per the plan's verdict rule for branch `retain`: **every site is
`holds-as-is`**. The fork route is real and followable today — set
`VICE_BACKEND=fork` and relaunch — and nothing in this phase, on this branch,
withdraws that route. No edits follow from this evidence file.

## Site inventory

Re-derived from the tree by grepping the three tool names across
`.claude/skills/`, `README.md`, and `docs/stock-vice-parity.md`:

```
grep -rn -E "vice_sid_get_state|vice_keyboard_matrix|vice_keyboard_restore" \
  .claude/skills/ README.md docs/stock-vice-parity.md
```

**Result: 17 matching lines across 8 files — identical to the plan-time
figure of "17 mentions across 8 files." No drift.**

| # | File | Line | Tool(s) mentioned | Annotation phrase present (same file/section) | Verdict |
|---|------|------|---------------------|-------------------------------------------------|---------|
| 1 | `.claude/skills/c64-program-recon/references/sound-and-input.md` | 64 | `vice_keyboard_matrix` | "requires the fork backend" (line 65, same paragraph) | `holds-as-is` |
| 2 | `.claude/skills/c64-program-recon/references/sound-and-input.md` | 65 | `vice_keyboard_matrix` | "requires the fork backend" (this line) | `holds-as-is` |
| 3 | `.claude/skills/c64-program-recon/references/observation-hazards.md` | 79 | `vice_sid_get_state` | "fork-only" (line 88, same section "§3") | `holds-as-is` |
| 4 | `.claude/skills/c64-program-recon/references/observation-hazards.md` | 88 | `vice_sid_get_state` | "fork-only" (this line) | `holds-as-is` |
| 5 | `.claude/skills/c64-program-recon/references/observation-hazards.md` | 103 | `vice_keyboard_matrix` | "requires the fork backend" (line 106, same section "§4") | `holds-as-is` |
| 6 | `.claude/skills/c64-program-recon/references/observation-hazards.md` | 106 | `vice_keyboard_matrix` | "requires the fork backend" (this line) | `holds-as-is` |
| 7 | `.claude/skills/c64-program-recon/references/control-flow.md` | 86 | `vice_keyboard_restore` | "requires the fork backend" (line 90, same section) | `holds-as-is` |
| 8 | `.claude/skills/c64-program-recon/references/control-flow.md` | 90 | `vice_keyboard_restore` | "requires the fork backend" (this line) | `holds-as-is` |
| 9 | `.claude/skills/c64-program-recon/references/tool-selection.md` | 18 | `vice_sid_get_state` | "requires the fork" (this line, inline) | `holds-as-is` |
| 10 | `.claude/skills/c64-ram-capture/SKILL.md` | 158 | `vice_keyboard_matrix` | "requires the fork backend" (line 159, same section) | `holds-as-is` |
| 11 | `docs/stock-vice-parity.md` | 20 | `vice_sid_get_state` | "hard loss"; "write-only in hardware"; "unrecoverable" (same section) | `holds-as-is` |
| 12 | `docs/stock-vice-parity.md` | 243 | `vice_keyboard_restore` | "confirmed unrecoverable on stock" (this line) | `holds-as-is` |
| 13 | `docs/stock-vice-parity.md` | 248 | `vice_sid_get_state`, `vice_keyboard_matrix` | "unrecoverable" (surrounding paragraph) | `holds-as-is` |
| 14 | `docs/stock-vice-parity.md` | 254 | `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` | "unrecoverable tools" (surrounding paragraph) | `holds-as-is` |
| 15 | `docs/stock-vice-parity.md` | 259 | `vice_sid_get_state` | "hard loss, item 1" (surrounding paragraph) | `holds-as-is` |
| 16 | `.claude/skills/c64-program-recon/SKILL.md` | 296 | `vice_keyboard_matrix` | "requires the fork backend" (this line, inline) | `holds-as-is` |
| 17 | `README.md` | 145 | `vice_sid_get_state`, `vice_keyboard_matrix` | "require the fork backend"; "unrecoverable on stock" (this line/paragraph) | `holds-as-is` |

**17/17 rows carry the verdict `holds-as-is`.** No row is `needs-amendment` or
`needs-rewrite` — the `retain` branch does not withdraw the fork route, so
there is nothing to flag as departing and no site whose text becomes false.

## Runtime refusal

Produced by actually calling `capabilityRefusalMessage(name, "stock")` from
`.claude/mcp/vice/capability-registry.ts` (not by reading the format string):

```
$ cd .claude/mcp/vice && node -e '
import("./capability-registry.ts").then(m => {
  for (const name of ["vice_sid_get_state","vice_keyboard_matrix","vice_keyboard_restore"]) {
    console.log("=== " + name + " ===");
    console.log(m.capabilityRefusalMessage(name, "stock"));
    console.log("");
  }
});
'
```

**`vice_sid_get_state`:**
```
vice_sid_get_state is unrecoverable on the stock backend: SID's $D400-$D418 registers are write-only in hardware, and the binary monitor exposes no SID read command. Use the fork backend instead (Set VICE_BACKEND=fork).
```

**`vice_keyboard_matrix`:**
```
vice_keyboard_matrix is unrecoverable on the stock backend: The binary monitor's KEYBOARD_FEED (0x72) only injects PETSCII buffer text; the emulator recomputes CIA port B from its own keyboard array on every read, so there is no wire command that can drive the raw matrix. Use the fork backend instead (Set VICE_BACKEND=fork). vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
```

**`vice_keyboard_restore`:**
```
vice_keyboard_restore is unrecoverable on the stock backend: RESTORE pulses the NMI line directly; it is not part of the keyboard matrix, and KEYBOARD_FEED has no way to produce it. Use the fork backend instead (Set VICE_BACKEND=fork). vice_keyboard_type / vice_keyboard_petscii inject text through the KERNAL keyboard buffer, and vice_joystick_set covers most in-game input -- but a program polling $DC00/$DC01 directly will not see buffer injection.
```

All three name their tool, contain the literal `unrecoverable`, name the fork
backend by the actionable `Set VICE_BACKEND=fork`, and the two keyboard
entries additionally render the shared `KEYBOARD_ALTERNATIVE` string
(`vice_joystick_set` / `vice_keyboard_type` / `vice_keyboard_petscii`). This is
already true on the `retain` branch — Task 2 makes no source edit; see that
task's own record in `14-02-SUMMARY.md`.

## The two totally-unrecoverable cases

Per 14-01's un-overridden sub-question B default (repeated here per this
plan's own `<flagged_assumptions>` block): for **SID read-back** and
**RESTORE/NMI**, research establishes no client-side substitute exists at
all — the loss is genuinely permanent on the stock backend, hardware-level,
not merely unbuilt. An honest, complete statement of that loss, with no
dangling promise of a future fix, is what satisfies FORK-02 for these two.
Both refusal strings above and both point-of-use skill sections (rows 3–4,
7–8, 9, 11–15, 17 above) already do exactly this: they name the loss, name
*why* it is permanent (write-only hardware register; NMI line with no wire
primitive), and name the fork as the only route — with no promise of an
eventual stock fix.

**Matrix keyboard is the exception.** `vice_keyboard_matrix` genuinely does
carry a partial route that survives every branch and does not depend on the
fork: `vice_joystick_set` (plus `vice_keyboard_type` / `vice_keyboard_petscii`
for KERNAL-buffer-reading gates), carried in the shared `KEYBOARD_ALTERNATIVE`
constant and rendered in the runtime refusal above and in every keyboard-matrix
point-of-use site (rows 1–2, 5–6, 10, 16). This is why the matrix-keyboard
sites read "requires the fork backend ... on stock, use X instead" rather than
a bare loss statement — the distinction the sites already draw is correct and
is preserved unedited on this branch.

## Guards, before

Both guard scripts run before any edit (none is made in this task), from the
repo root, verbatim stdout:

```
$ node scripts/check-skill-fork-honesty.mjs
check-skill-fork-honesty: OK -- 11 fork-only mentions across 30 files in 6 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
$ echo $?
0
```

```
$ node scripts/check-skill-tool-coverage.mjs
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 30 files across 6 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 10 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 17 entries). anno CLI verbs: 7 parsed from anno-cli.ts, 7/7 resolved (named by at least one skill file).
$ echo $?
0
```

**Baseline figures for later comparison (Task 3's "Guards, after" section
must match these exactly, since branch `retain` makes no edit):**
- `check-skill-fork-honesty.mjs`: 11 fork-only mentions, 30 files, 6 skill
  directories, 24 fork-only names from `CAPABILITY_REGISTRY`, 6 required
  README strings / 2 forbidden, 1 required parity-doc string / 5 forbidden.
- `check-skill-tool-coverage.mjs`: 37 distinct `vice_*` names, 30 files, 6
  skill directories, 31 resolved on stock manifest, 6 fork-only-unrecoverable,
  10 `anno_*` names (17 curated entries), 7/7 CLI verbs resolved.

## Task 1 result

No edit is made to any skill, doc, or source file by this task (confirmed by
`git diff --quiet -- .claude/skills README.md docs/stock-vice-parity.md
.claude/mcp/vice/capability-registry.ts` exiting 0). All 17 enumerated sites
are `holds-as-is`; Task 2 and Task 3 apply that verdict with zero source/doc
diff, recording the zero-diff outcome as the decided result of the `retain`
branch rather than an omission.

## Guards, after

Task 2 added three test assertions to `capability-registry.test.ts` (pinning
`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` refusal
strings) with **zero edit** to `capability-registry.ts` itself. Task 3 made
**zero edit** to any of the 8 skill/doc files listed in `## Site inventory`
above — every site's verdict was `holds-as-is`, so there is nothing to amend.
Both guard scripts, re-run after both tasks, from the repo root, verbatim
stdout:

```
$ node scripts/check-skill-fork-honesty.mjs
check-skill-fork-honesty: OK -- 11 fork-only mentions across 30 files in 6 skill directories, all section-scoped-compliant; 24 fork-only names policed from CAPABILITY_REGISTRY; no stale phase-deferral prose found; README.md carries all 6 required strings and none of the 2 forbidden ones; docs/stock-vice-parity.md carries all 1 required strings and none of the 5 forbidden ones (08-06's regression guard).
$ echo $?
0
```

```
$ node scripts/check-skill-tool-coverage.mjs
check-skill-tool-coverage: OK -- 37 distinct vice_* names extracted from 30 files across 6 skill directories; 31 resolved as advertised on the stock manifest (38 tools total). Classified: 0 proxy-local (neither manifest), 2 proxy-local-with-stock-manifest-entry, 1 deny-listed, 2 not-a-tool-name, 6 fork-only-unrecoverable, 0 pending-later-phase. anno_*: 10 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 17 entries). anno CLI verbs: 7 parsed from anno-cli.ts, 7/7 resolved (named by at least one skill file).
$ echo $?
0
```

**Every figure is byte-identical to the "Guards, before" baseline** — 11
fork-only mentions, 30 files, 6 skill directories, 24 fork-only names, 6
required README strings / 2 forbidden, 1 required parity-doc string / 5
forbidden; 37 distinct `vice_*` names, 31 resolved on stock manifest, 6
fork-only-unrecoverable, 10 `anno_*` names / 17 curated entries, 7/7 CLI
verbs resolved. This is expected and correct on the `retain` branch: no
site's verdict required an edit, so no count could have moved.

`cd .claude/mcp/vice && node --test docs-dangling-refs.test.ts
docs-linerefs.test.ts capability-registry.test.ts` — 24/24 passing (13 in
`capability-registry.test.ts`, including the 3 new hard-loss-refusal
assertions Task 2 added).

`git diff --quiet -- scripts/check-skill-fork-honesty.mjs
scripts/lib/skill-honesty-checks.mjs` exits 0 — no non-vacuity floor in the
honesty guard was touched.
