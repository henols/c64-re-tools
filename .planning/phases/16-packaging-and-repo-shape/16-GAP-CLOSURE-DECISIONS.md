---
phase: 16-packaging-and-repo-shape
slug: 16-gap-closure-decisions
created: 2026-08-23
---

# Phase 16 Gap-Closure Decision Register

This document records what this gap-closure round (plans 16-08 through 16-11) deliberately
decided to leave unchanged, the outcome of the spec-less probe's flagged assumptions, the
prohibitions this round authored to keep its own fixes from recurring, and the sites this
round found that neither `16-VERIFICATION.md` nor `16-REVIEW.md` named. Every entry below
carries a reason — an entry that says only "left alone" recreates the undecided state this
document exists to close.

## Section 1 — Decided and left unchanged, with reasons

### The repo-root quick-reference assignments in four `SKILL.md` playbooks

- `src/skills/c64-memory-mapping/SKILL.md` (`D=src/skills/c64-memory-mapping/scripts/driver.mjs   # relative to the repo root`)
- `src/skills/c64-program-recon/SKILL.md` (`D=src/skills/c64-program-recon/scripts/derive.mjs   # from the repo root`)
- `src/skills/c64-provenance-diff/SKILL.md` (`D=src/skills/c64-provenance-diff/scripts/diff-images.mjs   # from the repo root`)
- `src/skills/c64-ram-capture/SKILL.md` (`S=src/skills/c64-ram-capture/scripts    # from the repo root`)

**Left unchanged, because:** commit `7295e20` (plan 16-04) classified these four
assignments as source-tree self-references, not consumer-facing output — they are labelled
as repo-root-relative in the playbook text itself, and updating them from the pre-move
`.claude/skills/...` form to the post-move `src/skills/...` form was the correct half of
that sweep. The *reason* this round does not go further is that the label itself is only
accurate for a developer working inside this repository's own checkout: on a plugin
install, the correct form of the same line would be plugin-root-relative
(`${CLAUDE_PLUGIN_ROOT}`-relative), and on an `npx @henols/c64-re-tools` installer install
it would be skills-directory-relative (`.claude/skills/<skill>/scripts/...`). Making these
four lines dual-route the way the same files already do for their MCP CLI commands (which
carry both an in-repo and an installed form) is a fresh documentation-design decision about
how a playbook should read for three different audiences at once — not a bug this gap
round is chartered to fix. **Owner:** whichever milestone next revisits skill playbook
routing. **Reversal trigger:** a report of an agent in a consumer project (plugin or
installer) that followed one of these four assignments literally and failed to find the
named script.

### `recovery-schema.mjs`'s `HERE` self-location comment

`src/skills/c64-provenance-diff/scripts/recovery-schema.mjs`'s `SCAN_DIRS` block labels
`HERE` with the comment `// src/skills/c64-provenance-diff/scripts`.

**Left unchanged, because:** this label names this repository's own location for the
constant it annotates, and the comment directly above it (`2026-08-22 (plan 16-01): ...
Rebuilt HERE-relative instead -- correct in both this dev checkout and a consumer's
install`) already acknowledges both trees explicitly — the *code* beside the label is
location-agnostic by construction (`HERE`-relative, never hop-counted), so the label is
accurate in the one tree it actually describes (this repository's checkout) without making
any claim about a consumer's tree. There is nothing to reclassify: the reason this label is
correct as-is is that its own neighboring comment already carries the dual-tree caveat the
label itself does not need to repeat.

### `project-paths.mjs`'s install-location narration

`src/skills/c64-ram-capture/scripts/project-paths.mjs`'s header comment states the reasons
the module walks up for a `.git` marker rather than counting hops.

**Left unchanged, because:** the sentence exists to say the install location *varies* — it
names an example location, and that example is now this repository's own layout
(`src/skills/<skill>/scripts/`) rather than a hypothetical consumer's — but this is a
wording preference with no functional consequence, because the module resolves by walking
up for a repository marker and never counts hops. Changing which example the header cites
changes prose, not behavior; there is no defect here to reclassify, only a choice of which
tree to use as the illustrative case, and the reason it is left as-is is that either choice
would be equally correct since the code itself is depth-agnostic.

### `repo-root.test.ts`'s deliberate pre-relocation-shape assertion

`src/mcp/vice/repo-root.test.ts:133-150` (the test titled `repoRoot() last-resort fallback
pins the HOP COUNT as a property of depth, not of one particular directory name: the OLD
.claude/mcp/vice three-segment shape also still climbs three levels`).

**Left unchanged, because:** this test exists specifically to pin the hop count as a
property of *depth* (three segments below the repository root) rather than of one
particular directory name — plan 16-04 added it for exactly that reason, alongside the
sibling test for the new `src/mcp/vice` shape, so that a future relocation to yet another
three-segment name still has a template assertion to follow. It is therefore correct as
written, and reclassifying or "fixing" it would remove the property it was written to
prove. It is out of scope for any path-reference sweep, including this one.

### The review's `IN-01` finding — renamed, not left

`16-REVIEW.md`'s `IN-01` raised `src/mcp/vice/r2000-regbits.test.ts:91,220`'s synthetic
scratch-directory segment names (`path.join(tmpDir, "claude", "mcp", "vice")`), which named
the pre-move `.claude/mcp/vice` shape while the adjacent comment claimed to mirror "the real
repo shape". **This round did NOT leave this one alone: plan 16-09 renamed both scratch
segment lists** to the current `src/mcp/vice` shape, matching what the adjacent comment
actually claims. The only load-bearing property of these scratch trees — depth, three
segments below the scratch root, which is what the copied `MEMMAP_PATH` hop-count formula
depends on — is unchanged, proven behaviour-neutral by the drift guard's own unequal
before/after digests recorded in `16-09-SUMMARY.md`. `IN-01` asked for an explicit decision
either way; this is that decision, made and executed, not deferred.

## Section 2 — The spec-less probe's flagged assumptions

This phase has no `SPEC.md`, so both the edge-coverage and prohibition sections that a
`SPEC.md` would normally seed were absent, and the deterministic edge probe ran over
`PKG-01`..`PKG-04` as its fallback. The probe surfaced four items. Recorded here verbatim in
the terms the probe itself uses, so the outcome is traceable rather than reconstructed:

- **Two `concurrency` rows (`PKG-01`, `PKG-04`)** were resolved with explicit acceptance
  criteria and authored as plain `must_haves.truths` — `PKG-01`'s in plan `16-08`, `PKG-04`'s
  in this plan, `16-11`.
- **Two `unclassified` rows (`PKG-02`, `PKG-03`)** remain `unresolved` and are carried as
  explicit flagged assumptions, not resolved: `PKG-02`'s in plan `16-08`'s own "Flagged
  Assumptions (spec-less probe fallback)" section, `PKG-03`'s in plan `16-09`'s equivalent
  section.

**The no-silent-drop equality, stated explicitly:** four probe items surfaced, and all four
are accounted for — **four surfaced equals two authored (as plain truths) plus two flagged
(still `unresolved`)**. Nothing was auto-dismissed, and nothing was resolved with a
backstop: both `unclassified` rows remain labelled `unresolved` in their owning plans, not
quietly marked closed or given a default resolution the probe itself never reached.

## Section 3 — The recalled prohibitions

Three prohibitions were authored into this round's plans' `must_haves.prohibitions` blocks,
each recalling a specific way this phase's own gaps were introduced in the first place:

| Prohibition | Carried by |
|---|---|
| Do not close a gap by weakening the gate, assertion or requirement text that exposed it | `16-08`, `16-09`, `16-10` (each plan's own wording, scoped to its own gate) |
| Do not present an unexecuted committed test suite as coverage | `16-08` ("MUST NOT record a committed test suite as coverage when nothing in CI executes it") |
| Do not ship documentation or generated output instructing a consumer to run a path that does not exist in their installed project | `16-10` ("MUST NOT ship documentation or generated output that instructs a consumer to run a path that does not exist in their installed project") |

**Canon-referral breadcrumb.** Path-traversal and arbitrary-write exposure in the
installer's copy and merge routines (`installer/scripts/sync-skills.mjs`'s `cpSync`,
`installer/bin/cli.mjs`'s `wireMcp()`) is canon security work, owned by the project's
security review process and by each plan's own threat model — not a defect this
gap-closure round found and not a class this round is chartered to mitigate. It was
deliberately **not** minted as a bespoke prohibition in any of `16-08`/`16-09`/`16-10`'s
`must_haves.prohibitions` blocks, since doing so would duplicate coverage the canon process
already owns rather than close a gap specific to this round's own work.

## Section 4 — New sites this round found that the two gap inputs did not name

Recorded with provenance, so the record shows what came from `16-VERIFICATION.md`, what
came from `16-REVIEW.md`'s code review, and what came from re-verifying the tree during
planning:

| Site | Found via | Closed by |
|---|---|---|
| The `renderLoading` consumer-path literal in `src/skills/c64-ram-capture/scripts/watch-loads.mjs` (the absence-as-evidence paragraph naming `watch-loads.mjs`/`dump-artifacts.mjs` at the wrong tree) | Re-verifying the tree during planning, alongside `16-REVIEW.md`'s `CR-01` finding for the sibling `diff-images.mjs` case | Plan `16-10` |
| The `; Build:` instruction in `src/skills/acme-build/template.a`, copied verbatim into every file `acme.mjs new` writes for a user | Re-verifying the tree during planning, the same consumer-path defect class as `CR-01` | Plan `16-10` |
| The stale canonical-source comment in `.gitignore` (naming the no-longer-existing `.claude/skills/` instead of `src/skills/`, the directory `installer/scripts/sync-skills.mjs`'s `SRC` constant actually reads) | Re-verifying the tree during planning | Plan `16-09` |
| The self-contradictory scratch-shape comment in `src/mcp/vice/r2000-regbits.test.ts` (`16-REVIEW.md`'s `IN-01`) | `16-REVIEW.md`'s code review | Plan `16-09` |
| The four `src/skills/*/scripts/*.test.mjs` skill test suites plus `installer/wire-mcp.test.mjs`, all committed but not executed by any CI step (`16-REVIEW.md`'s `WR-01`, and the durability half of `PKG-02`'s `unclassified` probe row) | `16-REVIEW.md`'s code review, corroborated by the probe's `PKG-02` row | Plan `16-08` |

Every site above is named with the plan that closed it — no site is recorded as still open
by this document.

## Section 5 — Round-2 code review (post-gap-closure), and its disposition

After plans `16-08`..`16-11` landed, the execute-phase code-review gate re-reviewed the
tree. Because a review already existed at the deterministic `16-REVIEW.md` path, round 1
was first archived to `16-REVIEW-round1-2026-08-23.md` — a filename that deliberately does
**not** match `docs-review-disposition.test.ts`'s `^[0-9][0-9.]*-REVIEW\.md$` gate, so the
archive preserves the record without minting duplicate disposition obligations.

Round 2 was scoped to the **18-file gap-closure delta** rather than the whole phase. Round 1
had already reviewed all 98 files at the same `standard` depth, and the code-review workflow
itself warns that a scope above 50 files produces a superficial pass; the delta is the only
code in this phase that had never been reviewed.

**Result: 0 critical, 2 warnings, 0 info.** Both were the defect class this round exists to
eliminate — *a verification that cannot fail* — so both were **fixed, not deferred**
(commit `f1fb821`). Shipping the round with two known-toothless guards would have left the
phase in the condition it was created to fix.

| Finding | Site | Disposition |
|---|---|---|
| `WR-05` | `src/mcp/vice/ci-suite-coverage.test.ts` — the `FROZEN_REGISTRY` proof check was a bare `step.includes("run: npm test")`, satisfied by any command merely *starting* with the proof (e.g. `npm test -- --test-name-pattern=…`, a realistic way to silently narrow what CI runs). For the `installer` entry this weak check was the only guard. | **Fixed** in `f1fb821`. Replaced with `runsExactly()`, requiring the command to be the whole rest of its physical line — generalizing the already-correct `/run:\s*npm test\b/` shape from the sibling `ci-guardrails.test.mjs`. Proven RED-then-GREEN against the real `ci.yml` with a byte-identical revert. |
| `WR-06` | `hop-chain-comments.test.ts` scanned only `*.ts`/`*.mts` directly under `src/mcp/vice/`, so it was structurally blind to `src/skills/*/scripts/*.mjs` — and those files carried the very half-swept chain the guard was built this same round to eliminate. | **Fixed** in `f1fb821`. The review named two sites; a tree-wide sweep found a **third** (`dump-artifacts.test.mjs:16`) that neither gap input nor the review had named. All three corrected and each verified to resolve four hops to the real repo root, **and** the scan widened via `enumeratedSkillScriptFiles()` so the guard can see that half of the corpus at all. Fixing only the three sites would have left the guard blind to the next one. Proven RED-then-GREEN by planting the chain back into a skill script the old guard could not see. |

**A note on the widened guard flagging itself.** Adding the skill-scripts half made the guard
report its own new documentation comment, which quoted the forbidden pattern verbatim. The
assertion's own failure message forbids per-file exemptions, and its predicate is
per-physical-line, so the comment was reworded so no single line carries the full shape —
the same property `repo-root.test.ts` already relies on. No exemption was added.

**Orchestrator-level correction also made this round.** `deferred-items.md`'s `16-08` entry
predicted that its two out-of-scope test failures would be closed by plan `16-11`. That
attribution was wrong: both cascaded from then-undispositioned `16-REVIEW.md` findings and
so were closed by `16-09` and `16-10` dispositioning those findings, before `16-11` ran.
`16-11`'s executor spotted the misattribution but correctly declined to edit a file outside
its declared `files_modified`; the orchestrator corrected it in commit `2d579e6`.
