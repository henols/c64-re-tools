---
title: MCP tool redundancy census — the live surface, and what "unreferenced" actually means
date: 2026-09-11
context: /gsd-explore "check all MCP tools and all the skills and their scripts for redundant functions"
confidence: MEASURED for the counts and the reference sets (grep over the tree, 2026-09-11); REASONED for the domination candidates
---

# What was measured

Question put: which MCP tools and skill-script functions are redundant enough to remove, so an
agent has fewer ways to pick the same operation?

Everything below is a grep/count over the tree at 2026-09-11, except where marked REASONED.

## The live surface is 72 tools ON STOCK, and both manifests are correct

- **Live advertised (stock backend, this session)**: 46 `vice_*` + 26 `anno_*` = **72**.
- `tools-manifest.stock.json` holds **46** tool entries. All 46 are live. The only live `vice_*`
  tool absent from it is `vice_result_continue`, registered proxy-locally at
  `vice-proxy.ts:3403` and never served via a manifest. **Zero drift.**
- `tools-manifest.json` holds **62** and describes the **fork**, which is a different surface by
  design (D-07 per-backend trimming).

The two files have opposite natures, and this is the load-bearing distinction:

**`tools-manifest.stock.json` is hand-authored source and CANNOT drift.** `refresh-manifest.ts`
carries an assertion refusing to ever write it: *"this function regenerates the manifest from a
LIVE fork host's tools/list, so its output path must NEVER be tools-manifest.stock.json -- that
file is the hand-authored, separately committed stock surface (D-07/D-09) … a future `--stock`
flag pointing this generator at the stock file has to edit this line deliberately, not merely
change a default."* It is pinned to the dispatch table mechanically —
`stock-dispatch.test.ts:3042` asserts *"every tool in tools-manifest.stock.json must have exactly
one conformanceTest() case, and vice versa"*, alongside tests that no `DENY_LIST` name, no
decision-trimmed tool and no curated `anno_*` name appears in it.

**`tools-manifest.json` is a snapshot of an EXTERNAL fork's live `tools/list`.** `refresh-manifest.ts`
is its only writer and needs a running custom-fork host. The fork (`barryw/vice-mcp`) is not this
project's repo, so its tool list cannot be derived from this tree — snapshotting is the only
route, and hand-authoring 62 schemas the project does not own would be worse.

The residual weakness is inherent, not a defect to fix: the fork manifest is the one committed
artifact whose content depends on whichever fork build the operator had running, and nothing
verifies it — nothing offline *can*. Contrast `resources-sync.test.ts`, which fails CI on drift
for the compiled `.mjs`. This disappears with the fork rather than being repairable.

## WITHDRAWN: the "manifest drift" claim

An earlier pass of this note asserted `tools-manifest.json` was "stale in both directions" —
listing ~22 tools that are not advertised and omitting the whole `anno_*` family plus every
derived tool. **That was an error of baseline, and it is retracted.**

The fork manifest was being compared against a **stock** session's advertised list. Those are
*supposed* to differ:

- The ~22 "listed but not advertised" tools (`vice_sid_get_state`, the `vice_checkpoint_group_*`
  family, `vice_memory_fill`, the `vice_keyboard_*` matrix family, `vice_display_*`, …) are the
  fork's real tools. They are advertised when running on the fork, and trimmed on stock. That is
  D-07 working.
- The `anno_*` and derived-tool omissions are correct **and mechanically enforced**:
  `stock-dispatch.test.ts:1671` asserts every curated `anno_*` name is absent from BOTH manifests,
  and `:215` asserts proxy-local tool names are absent from the fork manifest.

**There is no manifest drift.** Any later work must not re-derive this false finding; the todo
that carried it was deleted rather than corrected.

## One real defect found while checking the above

`capability-registry.ts`'s header says `vice_diagnose` and `vice_recycle` are *"never listed in
either raw manifest JSON file."* Both ARE in `tools-manifest.stock.json`. MEASURED:

    vice_diagnose         fork: no    stock: YES
    vice_recycle          fork: no    stock: YES
    vice_result_continue  fork: no    stock: no

The paragraph's argument survives — both tools are synthetic and proxy-local, and a naive
set-difference does misclassify them — but the supporting detail went stale when the stock
manifest was authored. `vice_result_continue` is the tool actually in neither. Captured as
`.planning/todos/pending/capability-registry-manifest-claim-stale.md`.

## 16 of 72 live tools are named in no shipped skill — from THREE different causes

Measured by `grep -r <tool> src/skills/`. The split matters more than the count: only the third
bucket is a redundancy signal at all.

**Cause 1 — documentation lag (7).** Phase 41–43 text-channel tools; the capability is new and
the skills were never updated. Nothing redundant; the remedy is skill text, not removal.

    vice_memmap_show  vice_cpu_history  vice_profile_flat  vice_backtrace
    vice_io_registers  vice_device_console  vice_warp_set

**Cause 2 — load-bearing primitives no skill happens to name (5).** Obviously required; absence
from skill prose says nothing about value.

    vice_memory_write  vice_registers_set  vice_snapshot_save  vice_snapshot_load
    anno_update_project_enum

**Cause 3 — genuine overlap candidates (4).** REASONED, not yet proven dominated.

    vice_execution_until_return   overlaps the 5-tool stepping cluster
    vice_registers_available      overlaps vice_registers_get
    vice_checkpoint_set_condition overlaps vice_checkpoint_add
    vice_result_continue          proxy-local; unclear whether an agent should ever select it

Collapsing these three causes into one "unused tools" list is exactly the error
`capability-registry.ts` already warns about for `vice_diagnose`/`vice_recycle`: *"a naive
set-difference over the two manifests misclassifies them as a divergence; they are not one, and
including them here would be a factual error."*

# Two candidates REFUTED by the measurement

**`vice_ping` is not removable, despite reading as a duplicate of `vice_diagnose`.** It is
`PROBE_TOOL` (`vice-probe.ts:47`), the broker's launch liveness gate
(`broker-launch.mts:868`), and the poll primitive in `vice-sync.ts` and `vice-proxy.ts:1267`.
It is deliberately the fragile, no-retry probe that `vice_diagnose` is not — the two answer
different questions and the codebase depends on the difference.

**The skill scripts hold no duplication worth removing.** 18 non-test `.mjs` across 8 skills.
They already cross-import instead of reimplementing: `c64-provenance-diff/scripts/diff-images.mjs`
imports `releases.mjs`, `watch-loads.mjs` and `project-paths.mjs` from `c64-ram-capture/scripts/`.
The one pair that looks duplicated is not: `compare.mjs` classifies volatile/drift/divergence
across two 65536-byte RAM captures for reproducibility; `diff-images.mjs` does N-way
anchor-proven provenance diffing with gap-tolerant coalescing. Different questions, different
outputs. **The skill-script half of the original question has no action.**

# The asymmetry that explains the whole finding

The two families have opposite description discipline.

`anno_*` descriptions disambiguate themselves — each names its neighbour and says which to pick:

- `anno_read_region`: *"`view: 'disasm'` is what routine documentation wants … the SAME cap
  governs `anno_disassemble` — one cap, both views, so there is no per-view rule to get subtly
  wrong."*
- `anno_get_address_details`: *"composed from four reads … the body carries `composed_client_side`
  and a `composed_from` list naming all four sources, so a composition is never mistaken for
  something the store held whole."*
- `anno_save_project`: *"IT PERFORMS NO WRITE, and it exists to say so"* — a tool whose entire
  purpose is to intercept a wrong mental model.

`vice_*` descriptions are terse one-liners inherited from the fork's manifest, and that is where
the coin-flips are. `vice_watch_add` self-describes as *"shorthand for checkpoint with
store/load"* — an alias announced in its own description with no guidance on when to prefer it.

**So: `anno_*` overlaps are documented and deliberate; `vice_*` overlaps are undocumented and
accidental.** Removal pressure belongs almost entirely on the `vice_*` side, and even there it is
a short list — the larger defect is missing selection guidance, not excess tools.

# Where selection guidance lives today, and why that is the real problem

`src/skills/c64-program-recon/references/tool-selection.md` (65 lines) is a genuine
question-to-call mapping and is the right idea. Its four limits are structural, not cosmetic:

1. **Prose, not data** — nothing can lint it against the advertised surface, so it cannot go
   stale loudly.
2. **Scoped to one skill** — it sits under `c64-program-recon/references/`; the other eight
   skills cannot see it.
3. **Partial and dated** — self-declared `Curated 2026-08-01, Confidence: MEDIUM`, covering
   roughly 20 of 72 tools, and it still routes to `vice_sid_get_state`, which the live surface
   does not advertise.
4. **A hand-maintained partial copy of registry data** — precisely the
   "re-deriving a cross-cutting seam locally" anti-pattern `CLAUDE.md` names, and precisely what
   `capability-registry.ts`'s own header forbids: *"do not hand-maintain a second copy of this
   data anywhere else in the repo."*

`capability-registry.ts` answers **"which backend has this."** Nothing in the tree answers
**"which of these two should I pick."** That missing seam is the finding.

See [[tool-selection-registry]] (seed), [[capability-registry-manifest-claim-stale]] (todo), and the domination
question appended to `.planning/research/questions.md`.
