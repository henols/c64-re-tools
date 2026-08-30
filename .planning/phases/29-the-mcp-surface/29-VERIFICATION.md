---
phase: 29-the-mcp-surface
verified: 2026-08-30T17:46:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  round: 3
  previous_status: gaps_found
  previous_score: 4/6
  previous_verified: 2026-08-30T15:20:00Z
  gaps_closed:
    - "ROADMAP criterion 2 / REPOINT-01 + REPOINT-02 -- `render-memmap --check` no longer reports `drifted` for byte-identical inputs at a different absolute path. RE-EXECUTED end to end: rendered under `wsA`, copied the bytes to `wsB`, `--check` under `wsB` returns `in sync`, exit 0. The banner records workspace-relative locations through the new `workspaceRelativePath()` seam (`anno-types.ts:1245`, consumed at `anno-memmap-render.ts:467-468`). All FOUR `missing` items under that gap are closed."
    - "Gap 1 missing item 2 -- the suite that PINNED the defect is re-pointed and a cross-root regression exists (`anno-memmap-render.test.ts:559`, `:642`): renders under rootA, `cpSync` to rootB, asserts `in-sync`. The old absolute-path assertions are replaced by an ABSENCE assertion at `:485-490`."
    - "Gap 1 missing item 3 -- all three falsified user-facing texts corrected and now TRUE against the shipped verb, checked by executing each documented cause. CLI USAGE (`anno --help`), `templates/memory-map.template.md:15-21` and `c64-program-recon/SKILL.md:260-265` all name the five-cause set and state the negative (`Relocating the checkout is not drift`). WR-05's other two USAGE drifts are also gone: `--out` says `beside the STORE`, the coverage positional is `<image>` with its three accepted forms."
    - "Gap 1 missing item 4 / WR-01 -- the invocation gate now sees an omitted REQUIRED flag. RE-EXECUTED the verifier's own round-2 plant (`anno coverage game.prg` at `routine-queue-walker/SKILL.md:241`): gate exits 1 naming `--store is required and is missing`. Three further plants also bite (`--store game.prg` -> flag-value-kind; `--store` with no value -> flag-value-missing; `anno constructor` -> unknown-verb, no longer a `TypeError`). Tree restored, `git status` unchanged."
    - "CUT-01 -- the surviving-line figure now re-derives EXACTLY under the requirement's own documented predicate. RE-MEASURED INDEPENDENTLY from the git object store this pass, not accepted from 29-21: 26,023 pre-phase at `8f21d77` (35 files, 10,035 non-test + 15,988 test); 19,714 surviving at `f16d0b1` (23 files = 20 `anno-*` name-descendants at 18,728 + the three named renames at 986); net 6,309. Also confirmed the secondary correction: the same predicate yields 19,714 at `d30b63e` (the entry previously quoted the 18,728 descendant subtotal as the total there) and 20,960 at `6715a75`. The descendant map is injective: 20 survive + 15 removed outright = 35."
  gaps_remaining: []
  regressions: []
  history:
    - round: 1
      verified: 2026-08-30T08:44:35Z
      status: gaps_found
      score: 4/6
    - round: 2
      verified: 2026-08-30T15:20:00Z
      status: gaps_found
      score: 4/6
      note: "A DIFFERENT 4/6 -- five of round 1's six gaps closed, CUT-01 remained, and a new BLOCKER (CR-01, the cross-root false drift) was reproduced from scratch. Round 2's own re_verification block recorded five closures against round 1 and is preserved by reference here rather than restated."
required_follow_up:
  - item: "REPOINT-01 and REPOINT-02 are SATISFIED by this verdict and their rows must now move."
    detail: "Plans 29-18/29-19/29-20/29-21 deliberately held both at `Gaps Found` on the stated reasoning that a status row must not move ahead of the re-verification verdict that scores it. That reasoning was correct and the hold is not a defect. This verdict is that verdict. Two sites each, plus a dated paragraph per REQUIREMENTS.md's own standing rule: the checkboxes at `.planning/REQUIREMENTS.md:118` and `:119`, and the traceability rows at `:238` and `:239`. Neither requirement appears in the `MCP-*`/`STORE-06` status table at `:263-270`, so unlike MCP-04 this is a two-site edit, not a four-site one."
  - item: "WR-17 -- RENDERER_VERSION should be bumped to \"4\", in the phase that next owns anno-memmap-render.ts."
    detail: "Adjudicated below as a WARNING with a named follow-up, NOT a Phase-29 blocker. See the WR-17 section for the full reasoning and the exact coupled change."
deferred:
  - truth: "WR-14 -- five shipped modules have no production consumer (anno-d64.ts, anno-symbols.ts, anno-enum-gen.ts, anno-regbits-gen.ts, anno-register.ts)"
    addressed_in: "Phase 30"
    evidence: "`scripts/lib/anno-cli-verbs.mjs:57-60` names the return date in terms; ROADMAP Phase 30 is 'ACME Export and the Real-ACME Oracle'. Re-confirmed unchanged this pass."
  - truth: "CUT-06 -- no living document points a user at a deleted route"
    addressed_in: "Phase 32"
    evidence: "ROADMAP Phase 32 criterion 2 names CUT-06 over all seven skill playbooks. Round 2 kept the CR-01 drift-semantics texts OUT of this deferral because they misdescribed a LIVE verb; those texts are now corrected and executed against, so the distinction no longer has anything riding on it."
  - truth: "WR-15 -- the removal gate's `exemptionFor()` short-circuits inside the class loop"
    addressed_in: "deferred on record"
    evidence: "`29-16-PLAN.md:138` names it 'explicitly NOT folded in'. Correct today by array order only."
  - truth: "WR-16 -- retired vocabulary survives in two internal identifiers (`runR2000Cli`, `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`)"
    addressed_in: "deferred on record"
    evidence: "`29-16-PLAN.md` § `<wr14_scope_decision>`. Their real consumer set is a ~26-call-site rename in `anno-cli.test.ts`; their home is a pass that owns that file."
  - truth: "STORE-03's traceability status contradicts its own prose (Phase 28, pre-existing)"
    addressed_in: "Phase 28 verification or a milestone audit"
    evidence: "`deferred-items.md` item 1. Not introduced by this phase; a Phase-29 executor may not move a Phase-28 row."
  - truth: "`repo-root.test.ts`'s 'not under .claude' assertion fails inside a GSD worktree"
    addressed_in: "whoever owns repo-root.test.ts"
    evidence: "`deferred-items.md` item 2. Confirmed a worktree-location artifact: 0 failures in the primary checkout this pass."
prohibitions:
  - statement: "29-13: Never answer a question the surface cannot answer with a number that reads like an answer (a zero, an empty list or a clamped range where the honest answer is 'that is not a question I can answer about this image')."
    status: honored
    verification: judgment
    evidence: "Re-executed this pass. `anno_disassemble` and `anno_read_region` return the SAME `{available:false, reason}` for `$9000` against a `$1000..$1003` image, each naming the image, its load address and its end. No clamped range survives. Round 2 FLAGGED this at the CLI because `render-memmap --check` returned `drifted` -- a verdict that reads like an answer -- for a store that had not changed; that flag is DISCHARGED: the verdict is now a function of content and workspace-relative location only, proven by execution in two roots plus three negative controls. Non-authoritative LLM-judge verdict."
  - statement: "29-14: Never write, keep or restore a comment that asserts a guarantee the code does not provide."
    status: honored
    verification: judgment
    evidence: "All THREE of round 2's recorded counts are discharged, each re-checked against the shipped text rather than the summary. (1) The USAGE drift claim now names five causes and states the negative -- and I executed all five plus the negative; every one behaves as written. (2) `--out` says 'beside the STORE'; the coverage positional is `<image>` with its real three-branch dispatch order spelled out (WR-21 also corrected the self-contradiction about byte-length dispatch). (3) The three `anno-cli.ts` headers at `:64`, `:375` and `:874` now state the aggregate-count limit in terms ('It does not associate a particular argument with a particular call site (WR-02)') and `anno-cli-path-consumers.test.ts:39-52` carries the same admission as a WHAT-THIS-FILE-DOES-NOT-CHECK block. Non-authoritative LLM-judge verdict."
  - statement: "29-17: Never move a requirement's status row without changing the sentence that row scores."
    status: honored
    verification: judgment
    evidence: "Honored in letter AND in substance this round, which is the half that failed in round 2. `7a49a3d` moved CUT-01's checkbox, sizing sentence, both provenance paragraphs and traceability row in ONE commit touching only `.planning/REQUIREMENTS.md`, and the sentence it moved now carries figures I re-derived exactly from the git object store. `5692265` did the same for MCP-04 across all four of its sites in one commit. Non-authoritative LLM-judge verdict."
  - statement: "29-18: the phase's ROADMAP stopping rule -- if round 3 again finds new defects in PLAN-DERIVED truths while all five success criteria plus CUT-01 read verified, the phase seals on the contract with its residuals stated."
    status: not_triggered
    verification: judgment
    evidence: "The rule did not need to fire. This round scored the ROADMAP's five success criteria plus CUT-01 and nothing else, found no new defect in any of them, and found none in the plan-derived space either -- the four plans' own must-haves were verified by execution rather than accumulating new scope. Recorded because a stopping rule that is never checked is not a stopping rule."
---

# Phase 29: The MCP Surface — Verification Report (round 3, after gap-closure round 2, plans 29-18..29-21)

**Phase Goal:** The store is reachable through a tool family **derived from** Phase 19's `upstream-procedure-manifest.json`, registered proxy-locally and shaped for an agent rather than a cursor — and the family it replaces is **deleted in this same phase**, safely, because every guard that breaks on registration, on the rename and on the deletion moved with the change that broke it, and the removal gate was built and observed biting first.

**Verified:** 2026-08-30T17:46:00Z at `bada5aa`
**Status:** **passed** — 6/6
**Re-verification:** Yes, **round 3**. Supersedes the 2026-08-30T15:20Z report (4/6, `gaps_found`), which itself superseded the 2026-08-30T08:44:35Z report (4/6, `gaps_found`). Same six must-haves, same denominator, all three rounds.

**How this pass earned its verdict.** Nothing below is carried on a SUMMARY's word, and specifically not on 29-21's. The CUT-01 figures were re-derived from the git object store with the predicate stated and the removed/surviving sets enumerated. The cross-root drift property was proven by rendering in one workspace root, copying the bytes to a second at a different absolute path, and running `--check` there — followed by three negative controls to prove the gate did not simply stop detecting drift. The invocation gate was re-tested with the *exact* plant round 2 used to falsify it, plus three more. Every documented playbook invocation was executed. The tree was left byte-identical to how it was found (`git status` unchanged; one gitignored `installer/skills/` twin that a gate's own pre-scan sync had picked up a plant from was restored with `sync-skills.mjs` and re-verified `diff`-clean).

---

## Goal Achievement

### Observable Truths

The six must-haves are the ROADMAP's five Success Criteria plus `CUT-01`, a requirement named on this phase's own `**Requirements**:` line. No plan-derived must-have is scored here — round 1's self-generated-scope failure mode is deliberately not repeated.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC-1** Every `curated`/`adapt-to-address-input` verb has a route, every `omit` verb is absent, `r2000_delete_project_enum` is not carried, and the derivation is checked **mechanically** | ✓ VERIFIED | Regression: `node --test anno-derivation.test.ts` → **8 pass / 0 fail / 1 gated skip** (the live upstream re-hash behind `R2000_UPSTREAM_CLONE`, reported with its reason). `check-skill-tool-coverage` independently: 18 distinct `anno_*` names extracted from the skill trees, **all curated**, against 19 entries in `CURATED_ANNO_TOOLS`. Unchanged by both gap rounds. |
| 2 | **SC-2** The family is registered and the retired one deleted in this same phase, gate built and observed biting first, each guard moved with the change that broke it, **both skill trees re-pointed onto verbs that exist proven against the shipped copy**, no interception to forget | ✓ **VERIFIED (was FAILED)** | The blocker that held this down is **closed and re-executed**: identical bytes at a different absolute path now report `in sync`, exit 0, and the three real drift causes still bite. The gate that was blind to an omitted REQUIRED flag now bites on the verifier's own plant. All three falsified user-facing texts are corrected and were checked by *executing each cause they name*. Detail below. |
| 3 | **SC-3** Backend-agnosticism reads out of the ordered `BACKEND_SEAM_BYPASS_KEYS`; neither manifest gains an entry; `docs/tool-support.md` regenerates byte-identical | ✓ VERIFIED | Re-measured at HEAD: `stock-dispatch.test.ts:1510` is still the ordered two-entry array; `capability-registry.ts` and `tools-manifest.json` each contain **0** `anno_` occurrences; regenerated the table — md5 `bb4744890855e58887142e5a97f44fc0` **identical before and after**, `git diff` empty. |
| 4 | **SC-4** Registration-time gates move in the registering commit; the three named gates green with nothing deleted; the generator regex and its two duplicate witnesses move together; the module floor re-pointed and **raised** | ✓ VERIFIED | `git show --diff-filter=D --name-only 65a28f3` is **empty** — the registering commit still deletes nothing. `ANNO_MODULE_FLOOR = 15 + 1` at `hostpath-consumers.test.ts:245` with its pinned-equals-measured companion at `:279`. All three named gates exit 0 (table below). |
| 5 | **SC-5** Derived-not-cached xref/search; `max_results` required with no default; count returned; explicit address, no cursor; a repeated edit **succeeds** reporting no change; a batch pre-validates and returns per-item status; an ambiguous request **refuses by name** rather than a plausible-looking zero | ✓ VERIFIED | All seven clauses re-executed this pass through `runAnnoTool()` against a real store and a real `.prg` (spot-check table). Notably: `changed:true` then `changed:false` on the repeated edit; `max_results` refused as `REQUIRED and has no default`; `{returned, matched, truncated}` returned; `{available:false, reason}` from **both** read verbs on an out-of-image address; batch depth cap with a working positive control at 4 and refusal-by-name at 5 and 6. |
| 6 | **CUT-01** The r2000 surface's sizing claim is stated in figures that re-derive from the record's own predicate | ✓ **VERIFIED (was FAILED)** | **Re-measured independently, not accepted from 29-21.** Both ends now re-derive exactly, and so does the subtraction. Full derivation below. |

**Score:** 6/6 truths verified (0 present-but-behaviour-unverified, 0 overrides applied)

---

### Truth 6 in detail — CUT-01, re-measured from the object store

The predicate is the requirement's own, quoted from `.planning/REQUIREMENTS.md:130`. I ran it rather than reading 29-21's transcript of it.

| Measurement | Command | Result | Entry's claim | Agrees |
|---|---|---|---|---|
| Pre-phase file set | `git ls-tree -r --name-only 8f21d77 -- src/mcp/vice` filtered `^src/mcp/vice/r2000-.*\.ts$` | **35 files** | 35 | ✓ |
| Pre-phase lines | `git show 8f21d77:<path> \| wc -l`, summed | **26,023** = 10,035 non-test + 15,988 test | 26,023 / 10,035 / 15,988 | ✓ |
| Surviving at `f16d0b1` | the `anno-*` name-descendants + `absorbed-answer-key.test.ts`, `spawn-seam.test.ts`, `docs-absorbed-decisions.test.ts` | **19,714** across **23 files** (20 descendants = **18,728**, three named = **986**) | 19,714 / 23 / 18,728 / 986 | ✓ |
| Net removal | 26,023 − 19,714 | **6,309** | 6,309 | ✓ |
| Same predicate at `d30b63e` | — | **19,714** | 19,714 (corrected from the 18,728 misquote) | ✓ |
| Same predicate at `6715a75` | — | **20,960** | 20,960 | ✓ |
| Injectivity of the descendant map | 20 survive + 15 removed outright | **= 35**, no survivor counted twice | injective | ✓ |

The fifteen removed outright, enumerated so the split is checkable rather than asserted: `r2000-answer-key.test.ts`, `r2000-launch.test.ts`, `r2000-launch.ts`, `r2000-mcp-client.test.ts`, `r2000-mcp-client.ts`, `r2000-project.test.ts`, `r2000-project.ts`, `r2000-session.test.ts`, `r2000-session.ts`, `r2000-spawn-seam.test.ts`, `r2000-symbol-roundtrip.test.ts`, `r2000-test-gate.ts`, `r2000-upstream-audit.test.ts`, `r2000-verify.test.ts`, `r2000-verify.ts`.

**Why this now passes where round 2 failed it.** Round 2's objection was never the substantive claim — it was that a requirement whose whole stated purpose is *"its numbers are the measured ones"* carried, under a `Complete` checkbox, two numbers the same entry admitted did not reproduce. `7a49a3d` replaced them with figures that do, in one commit touching only `.planning/REQUIREMENTS.md` and moving the checkbox, the sizing sentence, both provenance paragraphs and the traceability row together. The sentence now **names its commit** (`f16d0b1`) rather than floating with HEAD — which is what makes it re-derivable by a later reader at all, since the same predicate returns 20,960 at `6715a75` and **21,372 at today's HEAD** (measured here; the `anno-*` files keep growing with ordinary work, exactly as the entry says). **No `overrides:` entry was written, and that was correct**: round 2 offered one and the owner declined it, because accepting a non-reproducing figure as decided would defeat this requirement's own purpose. The substantive claim is unchanged and re-confirmed: **zero** `r2000-*.ts` under `src/mcp/vice/` (`ls` reports no match), removal gate exit 0 with the temporary allow-list asserted **empty**.

---

### Truth 2 in detail — the blocker, closed by execution

**The cross-root property, proven end to end through the shipped CLI in two real workspace roots.**

```
render in wsA:   render-memmap: wrote .../wsA/memory-map.md (1 row(s), 0 [unknown],
                 digest 224ec25cb9e25937b8d74de36a85031f8f97507bc7888727eed407bb95db8a2e)
banner in wsA:     store: game.annostore          <- workspace-relative, was absolute
                   sidecar: sidecar.json          <- workspace-relative, was absolute
check in wsA:    render-memmap: in sync                                          exit 0
cp store+sidecar+md -> wsB (a DIFFERENT absolute path); cmp reports byte-identical
check in wsB:    render-memmap: in sync (.../wsB/memory-map.md)                  exit 0
```

Round 2 measured `{"status":"drifted","line":3}` on exactly this shape, with an identical `render_digest` printed beside it. That is gone.

**Three negative controls, because a gate that stopped reporting drift would also pass the test above.** Each was run in `wsB` against the same fixture:

| Control | Verdict | Exit |
|---|---|---|
| Append `HAND EDIT` to the rendered file | `drifted at line 64`, `expected: <blank>` / `actual: HAND EDIT` | 1 |
| Rename a store label (`entry` → `renamed_handler`) | `drifted at line 5`, and it is the **`render_digest` line** that differs | 1 |
| Move the store to a different location **relative to the workspace root** (`./` → `sub/`) | `drifted at line 3`, `expected: store: sub/game.annostore` / `actual: store: game.annostore` | 1 |

That is the five-cause set the corrected texts name, minus the sidecar-bytes cause (covered by the digest, same mechanism as control 2), plus the negative. **The shipped documentation is now true of the shipped verb, checked by running every cause it names**, which is the property REPOINT-01/02 actually assert.

**The mechanism, read off the source rather than the summary.** `workspaceRelativePath()` is a new single seam at `anno-types.ts:1245`; it resolves both sides through `realpathOfNearestExisting()`, spells the result POSIX-normalised, and **throws** rather than emitting a `../` escape — because a `..` hop count is machine identity wearing a different spelling. `anno-memmap-render.ts:467-468` is its only consumer in the renderer, and the module header at `:459-466` states in terms why the banner must not carry an absolute path. `checkRenderedMemoryMap()`'s own doc block at `:617-638` now enumerates what reaches `drifted` **and the negative**, naming CR-01. The header is not a claim ahead of the code: I executed each enumerated cause.

**The regression that could not exist before.** `anno-memmap-render.test.ts:559` renders under `rootA`, `cpSync`s the tree to `rootB` and asserts `in-sync`; `:642` is its empty-store sibling. The two assertions that **pinned** the defect in round 2 (`:378`, `:439`, which asserted the absolute `provenancePath` into the banner) are replaced by an **absence** assertion at `:485-490` naming CR-01 by id. The file runs 107 tests, 106 pass, 1 gated skip, 0 fail.

**WR-01 — the gate that could not see an omitted REQUIRED flag.** Re-planted round 2's exact case and three more, each at `routine-queue-walker/SKILL.md:241`, running `node scripts/check-skill-cli-invocations.mjs` after each:

| Plant | Gate verdict | Exit |
|---|---|---|
| `anno coverage game.prg` (round 2's plant; gate previously reported **OK, exit 0**) | `--store is required and is missing -- the command exits non-zero at runtime without it` | **1** |
| `anno coverage game.prg --store game.prg` (CR-04 verbatim, one token right) | `--store value game.prg has extension .prg, which is not one this flag reads (.annostore, .store)` | **1** |
| `anno coverage game.prg --store` | `--store takes a value and was documented with none` | **1** |
| `anno constructor game.prg` (WR-19's prototype-key crash) | `no such verb -- the CLI's own VERB_OPTIONS declares coverage, render-memmap` — **a named refusal, not a `TypeError`** | **1** |

Each plant fired in **both** trees, because the gate syncs `installer/skills/` before scanning it — which is also how REPOINT-02's shipped-copy property is enforced rather than hoped for. All plants reverted; the gitignored twin was re-synced and re-verified `diff`-clean; `git status` is identical to session start. `REQUIRED_FLAGS`, `POSITIONAL_KINDS` and `FLAG_KINDS` now live in the same import-safe lib the committed test reads, so the gate cannot re-declare a table locally.

**The three user-facing texts.** All corrected, all now true:

- **CLI USAGE** (`anno --help`, executed): names the five causes in order, states *"Relocating the checkout is NOT drift"*, says `--out` defaults *"beside the STORE -- in the store's own directory"*, and spells the coverage positional `<image>` with its real three-branch dispatch order (extension → 65536-byte length → `.prg`) plus the legacy JSON fallthrough.
- **`templates/memory-map.template.md:15-21`** — the file copied into every new project. Same five causes, same negative, and the remedy now says the fix is *safe to follow on any machine* because re-running in a different checkout no longer rewrites absolute paths.
- **`c64-program-recon/SKILL.md:260-265`**, plus a dated correction at `:267-274` that names the superseded two-cause wording rather than silently replacing it.

Both copy-forward texts are byte-identical to their `installer/skills/` twins (`diff -q` clean). Zero `regen2000proj` occurrences remain in either tree.

---

### Escalated decision — WR-17: `RENDERER_VERSION` was not bumped

**Verdict: the reviewer is right on the rule and wrong on the severity. Record it as a WARNING with a named follow-up in the phase that next owns `anno-memmap-render.ts`. It is NOT a Phase-29 blocker and does not move the score.**

*What is uncontested.* The constant's own doc block at `anno-memmap-render.ts:277-289` reads: *"Bumped whenever this renderer's OUTPUT SHAPE **or its digest's canonical INPUT** changes."* Plan 29-18 changed the output shape — the `store:`/`sidecar:` lines moved from absolute to workspace-relative and the banner prose grew by six lines — and left the constant at `"3"`. `computeRenderDigest()` at `:309-316` hashes the sorted store rows, the sidecar bytes and `RENDERER_VERSION`, none of which moved. So by the letter of its own rule a bump was due and did not happen. 29-18's counter-reading — that the rule governs the *digest's* canonical input, which genuinely did not move — is a real reading of the second disjunct, but the rule is a disjunction and the **first** disjunct fired. I do not accept the counter-reading as sound; I accept the decision as *defensible in its consequences*, which is a different thing and is the ground I rule on.

*Why it is nevertheless not the same defect as CR-01, which is the reviewer's central claim.* CR-01 was a **false positive**: nothing had changed — same content, same location relative to the root, same file — and the gate said `drifted`, permanently, once per machine, forever. WR-17 is a **true positive with a poor diagnostic**: the renderer genuinely changed, the artifact on disk genuinely is stale relative to its generator, `drifted` is the correct verdict, and it clears on one re-render and never returns. Calling these the same defect overstates the finding. What *is* genuinely lost is the constant's stated purpose clause — *"so a re-render under a new renderer version is distinguishable from drift under the same one"* — which is falsified for exactly this change: `--check` reports `drifted at line 3`, which is the **store location line**, so the naive read of the shipped cause set is "someone moved my store", the one wrong diagnosis available. A bump would have moved line 5 as well and made the cause attributable. That cost is real and I am not discounting it.

*Why it does not block this phase.* Four reasons, each checked rather than assumed. (1) None of the six must-haves turns on it: criterion 2 and REPOINT-01/02 demand that the shipped copy documents what the verb does, and it does — I executed all five documented causes and the negative and every one behaved as written. (2) The discrimination the constant would have supplied mechanically is currently supplied by **dated prose in the right place**: `templates/memory-map.template.md:30-34` (the file that ships into consuming projects) and `c64-program-recon/SKILL.md:276-280` both carry a *"One-time drift after upgrading, 2026-08-30"* note naming this exact cause and calling it *"a one-time, self-clearing banner correction — not a bug, and not a migration"*. Prose is weaker than a mechanism and it ages; it is not nothing, and it is in the file the affected reader actually opens. (3) The blast radius **inside this repository is zero**: `git ls-files | grep memory-map` returns the template and four unrelated files, and **no committed rendered `memory-map.md` exists** — the exposure is entirely to external consumers upgrading the published package. (4) The fix is a coupled change to shipped behaviour *and* to documentation that was written, reviewed and verified in this same round, plus two test pins (`anno-memmap-render.test.ts` pins `RENDERER_VERSION === "3"` twice, one of them a source-text match on `/RENDERER_VERSION.{0,400}"2" -> "3"/s`). Making that change from a verification seat, after the prose it would falsify has already shipped, is the shape of edit this project's own conventions exist to prevent.

*The follow-up, stated so it can be picked up rather than rediscovered.* Bump to `"4"` with a `Version 4 (CR-01, 29-18)` entry beside the two existing bump records; re-point **both** playbook notes at the version bump (*"the banner's `render_digest` changes too, which is how you tell an upgrade from a hand edit"*); move the two test pins; and add the guard the reviewer names — a test that **fails when the banner lines change without the constant moving**, which is the mechanism whose absence is the actual defect here, since without it the same omission recurs on the next banner edit. `anno-memmap-render.ts` carries a raw NUL byte, so use `grep -a`. The natural owner is whichever of Phase 30 or Phase 32 next edits this module.

---

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-14 — five shipped modules with no production consumer | Phase 30 | `scripts/lib/anno-cli-verbs.mjs:57-60` names the return in terms; ROADMAP Phase 30 is the ACME export rebuild. Re-confirmed unchanged. |
| 2 | CUT-06 — no living document points a user at a deleted route | Phase 32 | ROADMAP Phase 32 criterion 2. Round 2 held the CR-01 texts out of this deferral because they misdescribed a **live** verb; those texts are now correct, so nothing rides on the distinction any more. |
| 3 | WR-15 — `exemptionFor()` short-circuits inside the class loop | deferred on record | `29-16-PLAN.md:138`. Correct today by array order only. |
| 4 | WR-16 — retired vocabulary in two internal identifiers | deferred on record | `29-16-PLAN.md` § `<wr14_scope_decision>`. `runR2000Cli` still at `vice-proxy.ts:307`, so the remainder is real and correctly described. |
| 5 | STORE-03's row contradicts its own prose | Phase 28 / milestone audit | `deferred-items.md` item 1. A Phase-29 executor may not move a Phase-28 row. |
| 6 | `repo-root.test.ts` fails inside a GSD worktree | owner of `repo-root.test.ts` | `deferred-items.md` item 2. Confirmed a worktree artifact — **0 failures** in the primary checkout this pass. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-tools.ts` | Curated surface + never-throw runner | ✓ VERIFIED | Re-executed: out-of-image refusal on both read verbs with identical verdicts; nested batch validates AND executes to depth 4 and refuses by name at 5 and 6; `max_results` required; batch refused whole on an uncurated inner name (D-33). |
| `src/mcp/vice/anno-types.ts` | `workspaceRelativePath()` — the new location seam | ✓ VERIFIED | `:1245`. Resolves both sides, POSIX-normalises, refuses an escaping spelling by name rather than emitting `../`. Nineteen tests in `anno-confinement.test.ts` incl. root-equality, separator normalisation, escape refusal and symlinked-root cases. |
| `src/mcp/vice/anno-memmap-render.ts` | Store-backed renderer + a drift gate whose verdict is a function of content only | ✓ **VERIFIED (was DEFECTIVE)** | Banner consumes the seam at `:467-468`; `checkRenderedMemoryMap()`'s cause enumeration at `:617-638` matches executed behaviour on all five causes plus the negative. Still carries the literal NUL byte (WR-04, warning). |
| `src/mcp/vice/anno-memmap-render.test.ts` | A suite that can FAIL on the cross-root case | ✓ **VERIFIED (was PINNING THE DEFECT)** | `:559` / `:642` are the cross-root regressions; `:485-490` asserts the ABSENCE the old `:378`/`:439` pinned. 107 tests, 106 pass, 1 gated skip. |
| `src/mcp/vice/anno-cli.ts` | Confinement seam on every caller path; `--force`; USAGE true | ✓ VERIFIED | `--help` re-read this pass: all three WR-05 drifts corrected, plus WR-21's dispatch-order self-contradiction. The three headers citing `anno-cli-path-consumers.test.ts` now claim exactly what it checks and name the residual. |
| `scripts/lib/anno-cli-invocations.mjs` + `scripts/check-skill-cli-invocations.mjs` | Argument-check every documented CLI invocation | ✓ **VERIFIED (was PARTIAL)** | Six problem kinds in a declared `PROBLEM_ORDER`; `REQUIRED_FLAGS` / `POSITIONAL_KINDS` / `FLAG_KINDS` all in the import-safe lib the committed test reads; own-property reads at all three verb-keyed lookups. Four plants observed biting, all reverted. Wired into CI at `.github/workflows/ci.yml`. |
| `src/mcp/vice/anno-cli-path-consumers.test.ts` | Closed consumer set for the CLI's paths | ✓ VERIFIED (limit named) | Now derives positionals from each verb's `--help` synopsis (direction 3b) as well as flags from `VERB_OPTIONS`, both directions. The aggregate-count limit is stated in the file's own header rather than credited away — WR-02's substance. |
| `src/mcp/vice/anno-coverage.ts` | Coverage reads the live image forms | ✓ VERIFIED | Documented invocation run end to end on a real `.prg`: exit 0, `payload decoded`, full three-measure census. |
| `scripts/check-no-regenerator2000.mjs` | The removal gate | ✓ VERIFIED | exit 0; temporary allow-list printed and **empty**. Still cites the NUL offset as `:12862 (line 291)`; measured at HEAD it is **byte 15097, line 315** (WR-04, warning — the citation drifted further this round). |
| `docs/tool-support.md` | Regenerates byte-identical, no `anno_` entry | ✓ VERIFIED | md5 `bb474489…` identical before/after; `git diff` empty. |
| `src/skills/**` + `installer/skills/**` | Re-pointed onto verbs that exist, proven against the SHIPPED copy | ✓ **VERIFIED (was PARTIAL)** | Both documented invocations executed end to end; all three drift texts corrected; both trees `diff`-clean on all three changed files; `check-npm-packages` exit 0 (78 / 34 files, 7 skills). |
| `.planning/REQUIREMENTS.md` (CUT-01) | Figures that re-derive | ✓ **VERIFIED (was FAILED)** | All six figures re-derived independently this pass. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `vice-proxy.ts` | `anno-tools.ts` | `import` + registration loop through `buildViceTool()` | ✓ WIRED | Unchanged two-line substitution. |
| `anno-*.ts` | `forwardToVice()` / `rewriteArguments()` / `hostpath.ts` | — | ✓ ABSENT BY CONSTRUCTION | CLAUDE.md's four cited offsets re-checked at HEAD and still **exact**: `forwardToVice` `:2985`, `rewriteArguments` `:3050`, `gatherWedgeEvidence` `:1505`, its `rewriteArguments` `:1529`. |
| `anno-memmap-render.ts` banner | `checkRenderedMemoryMap()` byte comparison | `workspaceRelativePath()` | ✓ **WIRED CORRECTLY** (was WIRED WRONG) | Machine identity no longer reaches the compared bytes. Proven in two roots, with three negative controls. |
| `anno-cli.ts` (`--out`, `--provenance`, positionals) | `storePathWithinWorkspace()` | direct call before any filesystem touch | ✓ WIRED | Six inventoried arguments, six confinement sites; positional half now derived from `--help` rather than hand-declared. |
| `check-skill-cli-invocations.mjs` | `VERB_OPTIONS` / `POSITIONAL_KINDS` / `REQUIRED_FLAGS` / `FLAG_KINDS` | shared import-safe lib | ✓ **WIRED** (was PARTIAL) | Required-flag presence, flag-value presence and flag-value kind all checked; own-property reads at every verb-keyed lookup. |
| `src/skills/` | `installer/skills/` | `sync-skills.mjs`, run by the gates before they scan | ✓ WIRED | Observed directly: a plant in the canonical tree appeared in the twin's report in the same run. |
| CI | the five phase gates | `.github/workflows/ci.yml` | ✓ WIRED | All five run in CI; all five exit 0 here. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `anno_get_symbols` | `symbols`, `returned`, `matched`, `truncated` | store, via `openStore` | Yes — the label written moments earlier, `revision` advancing 3 → 4 | ✓ FLOWING |
| `anno_search` | `corpora.{labels,comments,instructions}`, `results` | decoders + store, per query, nothing cached | Yes — 2 hits across two corpora, `instructions` corpus searched with 2 entries | ✓ FLOWING |
| `anno_get_cross_references` | `callers`, `total`, `truncated` | `crossReferencesTo()`, nothing written | Yes | ✓ FLOWING |
| `anno_get_address_details` | `labels`, `comments`, composed record | store + `parsePrg` | Yes | ✓ FLOWING |
| `anno_disassemble` | `available`/`reason`, or `instructions` + listing | `sliceSpan()` made total | Yes — refusal out of image; real ACME listing with a truncation note in image | ✓ FLOWING |
| `anno coverage` | three-measure census | `loadProjectImage()` on a real `.prg` | Yes — `origin $1000, 6 byte(s), payload decoded`, 6 of 6 censused | ✓ FLOWING |
| `render-memmap --check` | `status` verdict | fresh render vs disk, **content and workspace-relative location only** | Yes — verdict independent of checkout location, still sensitive to all three real causes | ✓ **FLOWING (was HOLLOW)** |

---

### Behavioural Spot-Checks

Driven through the production entry points — `runAnnoTool()` and `node src/mcp/vice/vice-proxy.ts anno …` — against real stores and a real `.prg`. All probe files were written under `src/mcp/vice/.tmp-verify29/`, `src/mcp/vice/.verify29cov/` and a scratch dir, all removed; `git status` is identical to session start.

| Behavior | Command | Result | Status |
|---|---|---|---|
| **Cross-root drift (the round-2 BLOCKER)** | render in `wsA`, copy bytes to `wsB`, `--check` in `wsB` | `in sync`, **exit 0**, byte-identical file | ✓ **PASS (was FAIL)** |
| Negative control — hand edit | append a line, `--check` | `drifted at line 64`, exit 1 | ✓ PASS |
| Negative control — store row changed | rename a label, `--check` | `drifted at line 5` (the `render_digest` line), exit 1 | ✓ PASS |
| Negative control — location changed **relative to root** | move store to `sub/`, `--check` | `drifted at line 3`, `expected: sub/game.annostore` | ✓ PASS |
| **Invocation gate vs omitted REQUIRED flag (WR-01)** | plant `anno coverage game.prg` at `routine-queue-walker/SKILL.md:241`, run gate | `--store is required and is missing`, **exit 1** | ✓ **PASS (was FAIL)** |
| Gate vs wrong flag-value kind (WR-18) | plant `--store game.prg` | `extension .prg … not one this flag reads (.annostore, .store)`, exit 1 | ✓ PASS |
| Gate vs valueless flag (WR-18) | plant `--store` with no value | `--store takes a value and was documented with none`, exit 1 | ✓ PASS |
| Gate vs prototype key (WR-19) | plant `anno constructor game.prg` | named `no such verb` refusal, **not** a `TypeError`, exit 1 | ✓ PASS |
| Playbook's `render-memmap` line, extracted not retyped | `bash 29-15-e2e.sh` | `PASS -- the documented invocation ran end to end`; all corroborating checks green; exit 0 | ✓ PASS |
| Playbook's `coverage` line | `anno coverage game.prg --store game.annostore` | exit 0, `payload decoded`, three named measures | ✓ PASS |
| Out-of-image refusal, region verb | `anno_read_region {$9000..$9010}` on a `$1000..$1003` image | `{available:false, reason:"…not entirely inside the image…"}` | ✓ PASS |
| Out-of-image refusal, disassemble verb | `anno_disassemble {address:$9000}` | **same verdict, same shape** as its sibling | ✓ PASS |
| In-image disassemble still answers | `anno_disassemble {address:$1000}` | `instructions:2`, real ACME listing with a truncation note | ✓ PASS |
| `max_results` REQUIRED, no default | `anno_get_symbols {store}` | `"max_results" must be a positive integer, got undefined -- it is REQUIRED and has no default on this surface` | ✓ PASS |
| Count returned so truncation is detectable | `anno_get_symbols {store, max_results:10}` | `{returned:1, matched:1, truncated:false}` | ✓ PASS |
| Repeated edit SUCCEEDS reporting no change | `anno_set_label_name` twice, same args | 1st `changed:true` rev 3; 2nd `changed:false` rev 4 | ✓ PASS |
| Batch refuses whole on an uncurated inner name | valid call + `anno_nope` | `refused WHOLE: calls[0].name "anno_nope" is outside the curated anno_* tool surface (D-33)` | ✓ PASS |
| Batch pre-validates inner ARGUMENTS, not just names | valid call + `anno_get_symbols` with no `max_results` | `anno_get_symbols refused (calls[1])` — refused before anything opened, naming the index | ✓ PASS |
| Nested batch positive control | depth 2, 3, 4 with documented store inheritance | executes; per-item `status:"success"`, `executed/succeeded/failed` counts at every level | ✓ PASS |
| Nested batch depth cap | depth 5 and depth 6 | `nesting deeper than 4 levels -- refused BY NAME rather than walked` | ✓ PASS |
| Search derived per query, never cached | `anno_search {image, query, max_results}` | three corpora each reporting `searched` + `entries`; `returned/total/truncated` | ✓ PASS |
| Explicit addressing, no cursor | `anno_get_address_details {address}` | answers by address; no cursor verb exists on the surface | ✓ PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository. The phase's declared runnable checks are its CI gates plus the committed end-to-end script; each was executed in this verifier's own process.

| Probe / Gate | Command | Result | Status |
|---|---|---|---|
| Documented-invocation e2e | `bash .planning/phases/29-the-mcp-surface/29-15-e2e.sh` | `ALL CHECKS PASSED`, exit **0** | ✓ PASS |
| Removal gate | `node scripts/check-no-regenerator2000.mjs` | exit **0** — temporary allow-list printed **EMPTY** | ✓ PASS |
| Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | exit **0** — 18 `anno_*` names, all curated | ✓ PASS |
| Skill CLI invocations | `node scripts/check-skill-cli-invocations.mjs` | exit **0** — 10 invocations, 2 verbs, 2 trees, four checks named | ✓ PASS |
| npm package contents | `node scripts/check-npm-packages.mjs` | exit **0** — 78 / 34 files, 7 skills, 55-module closure clean | ✓ PASS |
| Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | exit **0** — 11 fork-only mentions, 24 names policed | ✓ PASS |
| Skill description overlap | `node scripts/check-skill-description-overlap.mjs` | exit **0** — 21 pairs, max 0.250 vs 0.35 | ✓ PASS |
| Table byte-identity | `node scripts/generate-tool-support-table.mjs` then md5 | `bb474489…` unchanged; `git diff` empty | ✓ PASS |
| Docs / audit gate | `node scripts/audit-gate.mjs` | exit **0** — 9 docs guards green, 7 milestone audits scanned | ✓ PASS |
| Typecheck | `npm run typecheck` | exit **0**, no diagnostics | ✓ PASS |
| Regression suite (run **once**) | `npm run test:automated` | **2771 tests / 2765 pass / 0 fail** / 1 skipped / 5 todo | ✓ PASS |
| Derivation check | `node --test anno-derivation.test.ts` | 8 pass / 0 fail / 1 gated skip | ✓ PASS |

**On the suite baseline.** Round 2 had to discharge two red assertions caused by its own not-yet-written report. That condition does not recur: `29-REVIEW-FIX.md` dispositions `WR-17`..`WR-21` (four fixed, WR-17 deferred and now adjudicated here), so `docs-review-disposition.test.ts` and `audit-integrity.test.ts` were already green before this report existed. `29-BASELINE.md`'s two failing files are accounted for: `r2000-session.test.ts` is gone **by construction** (29-10 deleted it) and `audit-integrity.test.ts` is green. `vice-proxy.test.ts` is in `MANUAL_ONLY_TESTS` and is not measured — the full glob does not terminate on this host. `repo-root.test.ts` is green here because this is the primary checkout, exactly as `deferred-items.md` item 2 predicts.

---

### Requirements Coverage

All twelve declared IDs are claimed by at least one plan; **no orphans**, and no plan declares an ID outside the phase's twelve. Cross-referenced against `.planning/REQUIREMENTS.md` and against ROADMAP § Phase 29's `**Requirements**:` line.

| Requirement | Source plan(s) | Status | Evidence |
|---|---|---|---|
| MCP-01 | 29-03, 29-06, 29-08 | ✓ SATISFIED | Derivation checked mechanically in both directions, 8/8; 18 `anno_*` names all curated. |
| MCP-02 | 29-01, 29-10, 29-11 | ✓ SATISFIED | Registration through `buildViceTool()`; zero `hostpath.ts` imports in any `anno-*` module; CLAUDE.md's four line citations exact at HEAD. |
| MCP-03 | 29-01, 29-11 | ✓ SATISFIED | Ordered allow-list with a length floor; **0** `anno_` in either manifest; table byte-identical. |
| MCP-04 | 29-03, 29-06, 29-13, **29-21** | ✓ SATISFIED | **Promotion audited and confirmed warranted.** The row's own recorded rule was *"moves back UP only on a re-verification verdict"*; round 2's 15:20Z verdict is exactly that condition and nothing else. `5692265` moved all four sites — checkbox `:99`, traceability row `:232`, status-table status cell **and its evidence cell** `:268` — in one commit touching only `.planning/REQUIREMENTS.md`, and explicitly recorded *"REPOINT-01 and REPOINT-02 stay Gaps Found"*. The substantive clauses were re-executed again this pass and all hold. |
| MCP-05 | 29-01, 29-02, 29-05, 29-07, 29-08, 29-09, 29-11 | ✓ SATISFIED | `65a28f3` still deletes nothing; module floor raised not lowered; every named gate green. |
| STORE-06 | 29-04, 29-07, 29-11 | ✓ SATISFIED | Derived per query, nothing written to disk; `max_results` required with counts returned; three corpora each reporting their own `searched`/`entries`. |
| REPOINT-01 | 29-09, 29-14, 29-15, 29-16, **29-18**, **29-19**, **29-20** | ✓ **SATISFIED (was PARTIAL, then BLOCKED)** | All three previously-broken documented routes now run and are documented truthfully. Both playbook invocations executed end to end; all five documented drift causes plus the negative executed and correct; the argument-checking gate sees the shape it was built for. **Row still reads `Gaps Found` — this verdict unblocks it; see `required_follow_up`.** |
| REPOINT-02 | 29-09, 29-15, 29-16, **29-18**, **29-19**, **29-20** | ✓ **SATISFIED (was PARTIAL, then BLOCKED)** | The shipped twin is byte-identical to the canonical tree on all three changed files, and the corrected texts — not the falsified ones — are what `check-npm-packages` ships. Observed directly that a plant in the canonical tree reaches the twin's gate report in the same run, so the sync is a mechanism rather than a hope. **Row still reads `Gaps Found` — this verdict unblocks it.** |
| CUT-01 | 29-10, 29-12, 29-17, **29-21** | ✓ **SATISFIED (was BLOCKED)** | Six figures re-derived independently from the object store; all six agree. Row reads `Complete`; the checkbox, sentence, both paragraphs and row moved in one commit. |
| CUT-02 | 29-02 | ✓ SATISFIED | Gate green with an empty temporary allow-list; three scope-class plants observed biting in round 1 and the gate is unchanged since. |
| CUT-03 | 29-02 | ✓ SATISFIED | Attribution non-vacuity assertion intact; gate exit 0 with its exemption census printed. |
| CUT-05 | 29-09 | ✓ SATISFIED | Fork-honesty gate exit 0 with the re-pointed README assertion. |

---

### Decision Coverage

Non-blocking gate. `gsd-tools query check.decision-coverage-verify` over `29-CONTEXT.md`: **total 17, honored 17, not_honored []**. Both gap rounds added no new decisions and retired none. `D-17` (the `render-memmap` rebuild) was the sharpest through two rounds — the phase rebuilt the verb, corrected the playbook that lied about it, and then shipped a drift gate its own documentation misdescribed. That last half is now closed by execution, and `D-17` is honored without a caveat for the first time.

---

### Test Quality Audit

| Area | Finding | Verdict |
|---|---|---|
| Disabled tests on requirements | Zero `it.skip` / `describe.skip` / `todo` in any `anno-*.test.ts`. The single skip in the 2771-test run is `anno-derivation.test.ts`'s live upstream re-hash, gated on `R2000_UPSTREAM_CLONE` and reported with its reason. The 5 `todo` entries are outside this phase's files. | ✓ CLEAN |
| Circular expected values | `writeFileSync` in the `anno-*` tests builds temp stores and fixture images only; no generator script imports a system under test to produce assertions. `FLAG_KINDS`, `REQUIRED_FLAGS` and `POSITIONAL_KINDS` are grounded in the code they mirror, entry by entry, with the grounding written beside each entry. | ✓ CLEAN |
| Assertion strength | Value- and behaviour-level. This round's new tests assert verdicts and absences, not shapes: *"the identical tree at a different absolute path is in-sync, not drifted"*, and an explicit ABSENCE assertion naming CR-01 that no absolute path appears in the banner. | ✓ STRONG |
| **The test that pinned the defect** | Round 2's 🛑 BLOCKER — `anno-memmap-render.test.ts:378`/`:439` asserting the absolute path into the banner — is **gone**, replaced by the absence assertion at `:485-490` and the two cross-root regressions at `:559`/`:642`. | ✓ **RESOLVED** |
| Controls observed red before green | `29-REVIEW-FIX.md` records the pre-fix runs (26/5 → 31/0 for WR-19; 34/4 → green for WR-18) and names which controls were green throughout as controls rather than plants. I re-observed the WR-18/WR-19 shapes biting directly rather than reading those numbers. | ✓ STRONG |
| **A gate weaker than its citations** | Round 2's WR-02 warning: `anno-cli-path-consumers.test.ts` is still an aggregate count with no per-argument association — but the three headers that credited it with more are corrected, the file's own header states the limit and why closing it needs static analysis, and the positional half is now **derived** from `--help` rather than hand-declared. The unchecked property is now a named residual instead of an unearned warrant. | ⚠️ WARNING (named, not blocking) |
| Guard weakness worth recording | `module-classification.ts`'s citation guard still degrades to existence-and-non-blank when a prose site does not name its symbol on the same line — the mechanism by which WR-04's stale NUL offset persists. Not a Phase-29 gap; a standing weakness for a later phase. | ℹ️ INFO |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| every non-`.planning/` file changed in `8f21d77..HEAD` | — | `TBD` / `FIXME` / `XXX` | — | **None found.** Every `XXX` hit is a `$XXXX` hex-address placeholder in a skill playbook or a hex-format doc comment. Debt-marker gate clean. |
| `src/mcp/vice/anno-memmap-render.ts` | 290 | `RENDERER_VERSION` not bumped across an output-shape change, contrary to its own doc rule | ⚠️ WARNING | **WR-17 — adjudicated above.** Follow-up named; not blocking. |
| `src/mcp/vice/anno-memmap-render.ts` | 315 (byte **15097**) | A literal NUL byte in a shipped source file; `check-no-regenerator2000.mjs:66` and `:815` both cite it as `:12862 (line 291)` | ⚠️ WARNING | WR-04. Re-measured this pass — the citation drifted **further** (was 15074 in round 2). A plain `grep` silently skips this file; use `grep -a`. |
| `src/mcp/vice/anno-cli-path-consumers.test.ts` | 281-294 | Aggregate call-site count, no per-argument association | ⚠️ WARNING | WR-02. Now named in the file's own header and in all three citing headers. |
| `scripts/check-npm-packages.mjs` | 161-171, 394 | Whole gate behind an unasserted entry-point heuristic whose failure mode is silence + exit 0 | ⚠️ WARNING | WR-03. Verified passing today (exit 0). |
| `src/mcp/vice/anno-derive.ts` | 459-462 | `corpusEnabled()` returns `flag !== false`, so the string `"false"` ENABLES a corpus | ⚠️ WARNING | WR-06. |
| `src/mcp/vice/anno-derive.ts` | 565-571 | `corpora.<name>.entries` means "true size" for two corpora and "0 because unmeasured" for the third | ⚠️ WARNING | WR-07. |
| `src/mcp/vice/anno-store.ts` | 290-296 | `unique(address, bank)` enforces nothing while `bank` is null | ⚠️ WARNING | WR-08. |
| `src/mcp/vice/anno-store.ts` | 293, 3389-3403 | `references anno_enum(id)` inert without `pragma foreign_keys=ON` | ⚠️ WARNING | WR-09. |
| `src/mcp/vice/anno-tools.ts` | 1608, 1647-1689 | Four structural collections returned whole, ungoverned by `max_results` | ⚠️ WARNING | WR-10. |
| `src/mcp/vice/anno-tools.ts` | 407-426 | Schema says "workspace-relative"; resolution is against `process.cwd()` | ⚠️ WARNING | WR-11. Fails safe. |
| `src/mcp/vice/anno-tools.ts` | 1495-1514 | Inode guard compares `ino` without `dev` | ⚠️ WARNING | WR-12. |
| `src/mcp/vice/prg-image.ts` | 69-78 | `parsePrg()` accepts a load address whose payload runs past `$FFFF` | ⚠️ WARNING | WR-13. |
| `src/mcp/vice/package.json` | 56-73 | Five modules with no production consumer still in `files[]` | ⚠️ WARNING | WR-14 — deferred to Phase 30 on shipped evidence. |
| `scripts/check-no-regenerator2000.mjs` | 782-789 | `exemptionFor()` `return null`s inside the class loop instead of `continue`ing | ⚠️ WARNING | WR-15 — deferred on record. |
| `src/mcp/vice/vice-proxy.ts`, `src/mcp/vice/anno-cli.ts` | `:307`, the `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` hatch | Retired vocabulary in two INTERNAL identifiers | ⚠️ WARNING | WR-16 — deferred on record. |

**Blockers: 0** (round 2 had 4). **Warnings: 15.** **Debt markers: 0.**

---

### Code Review Disposition — the five findings new in the 18:40Z pass

The seventeen earlier ids (`CR-01`, `WR-01`..`WR-16`) were dispositioned in round 2 and their dispositions stand except where this round closed them, which is recorded above. The five new ids:

| Id | Subject | Disposition |
|---|---|---|
| **WR-17** | `RENDERER_VERSION` not bumped across an output-shape change | **ADJUDICATED — OPEN-AS-WARNING with a named follow-up.** The rule was broken by the letter; the consequence is a one-time, self-clearing true positive with a poor diagnostic, mitigated by dated prose in both copy-forward texts, with zero in-repo blast radius. Full reasoning in its own section above. It is **not** a re-run of CR-01 and does not move the score. |
| **WR-18** | The gate reported OK for four documented commands that exit 1 | **CLOSED — verified by execution.** Two of the four shapes re-planted here (`--store game.prg`, `--store` with no value); both now exit 1 with a named problem. `FLAG_KINDS` lives in the import-safe lib, grounded entry by entry. |
| **WR-19** | An `Object.prototype` key in the verb slot crashed the gate with an unhandled `TypeError` | **CLOSED — verified by execution.** `anno constructor game.prg` now produces a named `no such verb` refusal, exit 1, no stack trace. Own-property reads at all three verb-keyed lookups, not just the first. |
| **WR-20** | The new `--help` capture spawned a bare `"node"` | **CLOSED.** Both sites now pass `process.execPath`; a source guard over `src/mcp/vice/` and `scripts/` forbids a spawn whose first argument is the literal `"node"`, scoped to the first argument so the playbooks' documented `node <plugin-root>/…` *string* still passes. |
| **WR-21** | The `coverage` USAGE contradicted itself about `<image>` dispatch | **CLOSED — verified by reading the shipped `--help` against `loadProjectImage()`'s branches.** USAGE now states the real order, names the one branch that does dispatch on byte length, and keeps the WR-07 reason on screen. Two order-comparing guards added; the collateral `module-classification.ts` citation drift was repaired in the same commit. |

---

### Human Verification Required

**None.** This is an infrastructure/tooling phase; its user-facing surface is the shipped playbooks and the CLI's own `--help`, and every one of those was **executed** this pass rather than read — both documented invocations end to end, all five documented drift causes plus the negative, four planted gate defects, and every clause of criterion 5 through `runAnnoTool()`. No truth is left present-but-behaviour-unverified: every behaviour-dependent claim (the cross-root invariant, the drift-cause set, the batch depth cap, edit idempotency) has a passing behavioural observation taken in this verifier's own process.

The one item that needed a **decision** rather than a test — WR-17 — was escalated to this verifier and is **decided above**, not left open.

---

### Gaps Summary

**Both remaining gaps are closed, and this pass proved each by re-running the failing case rather than by reading the fix.**

**Gap 1 — criterion 2 / REPOINT-01 + REPOINT-02.** Round 2's blocker was a drift gate that contradicted its own artifact: byte-identical inputs at a different absolute path reported `drifted` while both runs printed the same `render_digest`. That is gone, and the fix is structural rather than local — one new `workspaceRelativePath()` seam in `anno-types.ts`, consumed once in the renderer, with an escape refused by name rather than spelled `../` (which would have been machine identity in a new costume). I proved it the way it should be proved: rendered in one root, copied the bytes to a second at a different absolute path, and got `in sync`. Then I proved the gate had not merely gone blind — a hand edit, a store row change and a *relative* location move all still bite, each at the line the corrected documentation predicts. All **four** of the gap's `missing` items are closed: the banner is path-independent; a cross-root regression exists and the two assertions that pinned the defect are replaced with an absence assertion naming CR-01; all three falsified texts are corrected and every cause they name was executed; and the invocation gate now fails on the verifier's own round-2 plant, plus three more shapes it could not previously see. The gate's blind spot was the one thing that could have let this recur, and it is the item that most needed closing on its own terms rather than by inspection.

**Gap 2 — CUT-01.** Re-measured from the git object store under the requirement's own predicate, with the removed and surviving sets enumerated and the descendant map checked injective. Every one of the six figures re-derives: 26,023 / 10,035 / 15,988 across 35 files at `8f21d77`; 19,714 across 23 files at `f16d0b1`; net 6,309; 19,714 at `d30b63e`; 20,960 at `6715a75`. The secondary correction 29-21 made is also right — the entry previously quoted 18,728, the 20-descendant *subtotal*, as the total at `d30b63e`. And the sentence now **names its commit**, which is what makes it re-derivable at all: the same predicate returns 21,372 at today's HEAD, so a HEAD-relative figure was never going to survive. No `overrides:` entry was written and none should be; the owner declined one, and accepting a non-reproducing number as decided would have defeated the requirement's own stated purpose.

**MCP-04's promotion was warranted and correctly executed.** Its recorded rule was that the row moves up *only* on a re-verification verdict, never on the completion of the plans that address the findings and never on an executor's reading of its own work. Round 2's 15:20Z verdict is exactly that condition; `5692265` moved all four sites in one commit touching only `REQUIREMENTS.md` and explicitly declined to move anything else. I re-executed the substantive clauses again this pass; they hold.

**Two records are now behind this verdict rather than ahead of it, and that is the correct direction.** `REPOINT-01` and `REPOINT-02` still read `Gaps Found`. All four plans held them there deliberately, on the reasoning that a status row must not move ahead of the verification that scores it — the same discipline that made MCP-04's promotion trustworthy. **This verdict scores both ✓ SATISFIED and unblocks them**; the two-site edit each is named in `required_follow_up`. A row that under-claims pending a verdict is a discipline working; the round-2 failure was the opposite shape, a row over-claiming ahead of its evidence.

**One escalated decision, decided.** `WR-17` — the un-bumped `RENDERER_VERSION` — is a genuine breach of the constant's own rule and I am not softening that: the output shape changed and the constant did not move, so the rule's *purpose* clause ("a re-render under a new renderer version is distinguishable from drift under the same one") is falsified for exactly this change, and an upgrading consumer's `drifted at line 3` points at the store-location line, which is the one wrong diagnosis available. But it is a one-time, self-clearing **true** positive, not CR-01's permanent machine-dependent **false** one; the discrimination is currently supplied by dated prose in both copy-forward files; this repository ships no rendered memory map at all so the in-repo blast radius is zero; and the fix would falsify documentation written and verified in this same round. It is a WARNING with a named follow-up — bump to `"4"`, re-point both notes, move the two pins, and add the guard that makes the banner and the constant unable to move apart — owed by whichever phase next edits `anno-memmap-render.ts`. Deciding it any other way would mean a verification seat rewriting shipped user-facing text on a reading of a doc comment, which is precisely the move this project's conventions exist to stop.

**The phase's own stopping rule did not need to fire.** It said a round 3 finding new defects in *plan-derived* truths, while the five criteria plus `CUT-01` read verified, should seal the phase on its contract. This round found no new defect in either space. The structural core is unregressed across all three rounds: derivation mechanical 8/8, registration a two-line substitution with zero `hostpath.ts` imports and CLAUDE.md's four line citations still exact, the removal gate green with an empty allow-list, the tool-support table byte-identical, the registering commit still deleting nothing, and 2765 of 2771 tests passing with **zero** failures.

**Phase goal achieved. 6/6.**

---

_Verified: 2026-08-30T17:46:00Z at `bada5aa`_
_Verifier: Claude (gsd-verifier), round 3_
