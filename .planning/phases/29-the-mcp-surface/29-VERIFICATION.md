---
phase: 29-the-mcp-surface
verified: 2026-08-30T08:44:35Z
status: gaps_found
score: 4/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "ROADMAP criterion 5 / MCP-04 -- an ambiguous or unsupported request refuses by name with {available:false, reason} rather than a plausible-looking zero"
    status: failed
    reason: "REPRODUCED INDEPENDENTLY by this verifier, not taken from 29-REVIEW.md. `anno_disassemble` answers a wholly-out-of-image address with `isError:false`, `instructions:0` and an `end_address` numerically BELOW the `address` asked about. That is the exact shape criterion 5 and MCP-04 forbid. Its documented sibling `anno_read_region` refuses the same input correctly, so the two views that share `one cap, both views` disagree. Review id CR-01."
    artifacts:
      - path: "src/mcp/vice/anno-tools.ts"
        issue: "`sliceSpan()` (:1798-1803) guards only `from < 0 || to >= body.length` and never `from > to`; `dispatchDisassemble()` (:1836-1840) clamps `end = Math.min(requestedEnd, last)` BEFORE slicing, so `subarray(32768, 4)` returns an empty array rather than null and the `outsideImage()` refusal is unreachable for `start > last`."
    missing:
      - "Make `sliceSpan()` total: add `|| from > to` to the guard."
      - "Refuse on the REQUESTED span before the clamp in `dispatchDisassemble()`, so `start > last` is reported by `outsideImage()`."
      - "A test pinning that `anno_disassemble` and `anno_read_region` give the SAME verdict for an out-of-image address -- the two verbs' agreement is the property that was never asserted."
  - truth: "ROADMAP criterion 2 -- both skill trees were re-pointed onto verbs that exist, proven against the shipped copy, before the removal (29-09); REPOINT-01's five absorbed procedures run on the new surface"
    status: failed
    reason: "REPRODUCED INDEPENDENTLY. Two documented commands in the SHIPPED playbooks cannot run, in BOTH trees. (a) `anno render-memmap game.regen2000proj` is refused by the store opener that plan 29-12 gave the verb in this same phase, and the dated note at SKILL.md:263-267 asserts in the PRESENT TENSE that the verb `still reads the pre-store project file` -- the opposite of what 29-12 shipped. (b) `anno coverage game.prg --store ...` prints a full report of zeros and exits 1, because `<project>` is JSON-with-gzip whose only producer (`r2000-project.ts`) was deleted in this same phase -- so unlike (a) there is no correct spelling. Review ids CR-04, CR-05. `check-skill-tool-coverage.mjs` is green because it resolves tool and verb NAMES and never an invocation's arguments -- that is the structural reason this passed the phase's own gate."
    artifacts:
      - path: "src/skills/c64-program-recon/SKILL.md"
        issue: ":255-256 name `game.regen2000proj`; :263-267 is a falsified dated note asserting the pre-store behaviour in the present tense"
      - path: "src/skills/c64-program-recon/templates/memory-map.template.md"
        issue: ":11-12 name `game.regen2000proj` -- and this is the template an agent COPIES INTO EVERY NEW PROJECT, so the dead route propagates"
      - path: "installer/skills/c64-program-recon/SKILL.md"
        issue: "identical shipped twin at :255-256 -- REPOINT-02's `proven against the shipped copy` does not hold"
      - path: "installer/skills/c64-program-recon/templates/memory-map.template.md"
        issue: "identical shipped twin at :11-12"
      - path: "src/skills/routine-queue-walker/SKILL.md"
        issue: ":241 is the playbook's ONLY measurement instruction and it always fails; shipped twin identical"
    missing:
      - "Re-point all four `render-memmap` call sites onto `game.annostore` and DELETE the falsified dated note, replacing it with what is now true."
      - "For `coverage`: either teach `projectImage()`/`loadProject()` the two image forms `anno-tools.ts`'s `loadImage()` already dispatches, or add an explicit dated withdrawal note beside `routine-queue-walker/SKILL.md:241` naming the deleted producer."
      - "Extend `check-skill-tool-coverage.mjs` (or a sibling) to execute or at least argument-check each documented CLI invocation -- a name-only floor cannot see a dead command."
  - truth: "CLAUDE.md's standing architectural constraint -- any host-facing or caller-supplied path goes through the one confinement seam; the CLI's own headers assert this as a maintained property"
    status: failed
    reason: "REPRODUCED INDEPENDENTLY on this working tree. `--out` on `render-memmap` escaped the workspace root entirely and SILENTLY OVERWROTE a pre-existing file with no `--force` (`--force` is not in the verb's `VERB_OPTIONS` at all). `--provenance` is an arbitrary-file-read oracle with content disclosure: pointing it at a file outside the repo echoed that file's opening bytes back in the error message. Both arguments are LLM-composed by design -- the playbooks invoke this CLI through Bash. Three headers state the opposite in writing (`anno-cli.ts:41`, `:704`, `refuseOverwrite()`'s doc at :182-193). Review ids CR-02, CR-03, WR-08."
    artifacts:
      - path: "src/mcp/vice/anno-cli.ts"
        issue: ":323 takes raw `--out`; :355 `writeFileSync` with no `refuseOverwrite()`; :311-313 passes raw `provenance`; :770-771/:840 same escape on `cmdCoverage`. Headers at :41 and :704 claim confinement the code does not keep."
      - path: "src/mcp/vice/anno-memmap-render.ts"
        issue: ":316 documents `provenancePath` with silence where `storePath`'s confinement is documented in detail one line above (:311-314); :353 reads it unconfined; :362 interpolates Node's parse error, which carries a content snippet"
      - path: "src/mcp/vice/anno-confinement.test.ts"
        issue: "15 thorough tests of the PREDICATE and zero assertions over its CONSUMER SET -- the seam is proven correct and its callers are unenumerated, which is the exact hole these two findings fell through"
    missing:
      - "Run `--out` and `--provenance` through `storePathWithinWorkspace()` on both verbs."
      - "Add `--force` to `render-memmap`'s `VERB_OPTIONS` and wire the verb through `refuseOverwrite()`."
      - "A closed-consumer-set assertion for the CLI's caller-supplied paths, in the shape `hostpath-consumers.test.ts` already uses for the host-path seam -- so the next unconfined argument fails a test rather than a review."
  - truth: "MCP-04 -- edits are batchable, and the depth-capped batch behaves as its own description documents"
    status: failed
    reason: "REPRODUCED INDEPENDENTLY. A nested `anno_batch_execute` relying on the documented store inheritance is refused WHOLE, every time: `assertAnnoBatch()` recurses with the child's RAW arguments (`:1352-1355`) while `dispatchBatchExecute()` recurses with `batchArgumentsFor(bag, call)` (`:1934-1936`), so phase-one validation and phase-two execution disagree. The refusal message says `there is no ambient current store to inherit` while the tool's own description at :900-911 says the store `is named ONCE at the top level and every inner call inherits it`. `ANNO_MAX_BATCH_DEPTH = 4` therefore governs a shape unreachable at depth 2 by the documented route -- the cap has no reachable positive control. Review id CR-06."
    artifacts:
      - path: "src/mcp/vice/anno-tools.ts"
        issue: ":1352-1355 recurses on `call.arguments` instead of `batchArgumentsFor(args, call)`"
    missing:
      - "Propagate the effective arguments into the recursion, exactly as execution does."
      - "A test that a depth-2 batch relying on inheritance both VALIDATES and EXECUTES, and that depth-5 is refused by name."
  - truth: "CUT-01 -- a net ~12.4k lines of the 25,759-line r2000-*.ts surface deleted, the remaining ~12.9k surviving under new names"
    status: failed
    reason: "MEASURED BY THIS PASS for the first time -- this is the measurement `29-10-SUMMARY.md` and `REQUIREMENTS.md` both say nobody had taken. The substantive claim holds (zero `r2000-*.ts` remain under `src/mcp/vice/`, the removal gate is green tree-wide with an EMPTY temporary allow-list) but BOTH stated figures are wrong, in the same direction. Measured at the phase-start commit `8f21d77`: the surface was **26,023 lines across 35 files** (10,035 non-test + 15,988 test), not 25,759 / 10,102 / 15,657. Measured at HEAD: **15,957 lines survive** under new names (the `anno-*` descendants plus `absorbed-answer-key.test.ts`, `spawn-seam.test.ts`, `docs-absorbed-decisions.test.ts`), so the **net removal is 10,066 lines**, not ~12,400 -- and survival is ~16.0k, not ~12.9k. `CUT-01` is correctly recorded `Partial`; it must NOT be flipped to `Complete` on these numbers."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "CUT-01's sizing sentence (~12.4k removed / ~12.9k surviving / 25,759 total) is falsified by measurement in all three figures"
    missing:
      - "An owner decision: correct CUT-01's text to the measured figures (26,023 pre-phase; 10,066 net removed; 15,957 surviving) and then mark it Complete, OR record the shortfall as intended scope and leave it Partial. Do not adjust the row without changing the sentence -- that is the failure the audit gate exists against."
  - truth: "The phase closes with the regression gate no worse than 29-BASELINE.md's recorded failing-file SET"
    status: resolved_during_verification
    reason: "MEASURED, then RE-MEASURED after this report was written. First measurement: `npm run test:automated` gave 2676 tests / 2668 pass / **2 fail** / 46s, both failures with ONE cause -- the undispositioned `29-REVIEW.md` committed at `98ebf3d`. `docs-review-disposition.test.ts` was a file name NOT in the baseline set (a regression by the baseline's own rule) and `node scripts/audit-gate.mjs` REFUSED at exit 1 where the baseline recorded exit 0. Writing this report -- which the guard treats as a disposition source and which names all 20 finding ids -- discharged both: **re-ran and observed `docs-review-disposition.test.ts` 7/7, `audit-integrity.test.ts` 44/44, `audit-gate.mjs` exit 0.** Against the baseline SET the phase is now clean on the automated arm: `r2000-session.test.ts`'s 5 failures left BY CONSTRUCTION (29-10 deleted the file), which is what `29-BASELINE.md` instructs be reported rather than banked as an improvement, and `vice-proxy.test.ts` is `MANUAL_ONLY_TESTS` and was NOT measured because the full glob does not terminate on this host. Recorded as a gap-shaped entry rather than deleted, because the sequence -- red, then green only once the report existed -- is the audit trail."
    artifacts:
      - path: "src/mcp/vice/docs-review-disposition.test.ts"
        issue: "was red on 13 undispositioned ids (CR-01, CR-03, CR-04, CR-05, CR-06, WR-01, WR-04, WR-05, WR-06, WR-10, WR-11, WR-12, WR-14); GREEN as of this report"
    missing:
      - "Nothing outstanding. Re-confirm both gates after this report is committed alongside the phase artifacts."
deferred:
  - truth: "WR-09 -- five modules with no production consumer are still shipped in the npm tarball (anno-d64.ts, anno-symbols.ts, anno-enum-gen.ts, anno-regbits-gen.ts, anno-register.ts)"
    addressed_in: "Phase 30"
    evidence: "Verified independently: four of the five have NO non-test importer (`anno-regbits-gen.ts` is imported only by the orphaned `anno-enum-gen.ts`; `anno-register.ts` is a committed record whose test-only consumer is by design, per 29-08). `scripts/lib/anno-cli-verbs.mjs:57-60` names the return date in terms: 'three of the six -- the enum generator and the two halves of the VICE-label round trip -- return in **Phase 30** as rebuilds over the annotation store, alongside the ACME export oracle.' ROADMAP Phase 30 is 'ACME Export and the Real-ACME Oracle'."
  - truth: "CUT-06 -- no living document points a user at a deleted route"
    addressed_in: "Phase 32"
    evidence: "ROADMAP Phase 32 criterion 2 names CUT-06 over 'all seven skill playbooks'. NOTE: this only PARTIALLY overlaps the CR-04/CR-05 gap above, which is kept as a real Phase-29 gap and NOT deferred -- REPOINT-01 and REPOINT-02 are recorded Complete against Phase 29 and criterion 2 makes the 'proven against the shipped copy' claim for Phase 29, so a Phase-32 sweep cannot retroactively make that claim true."
human_verification:
  - test: "Decide CUT-01's disposition: correct the requirement text to the measured figures (26,023 pre-phase / 10,066 net removed / 15,957 surviving) and mark it Complete, or accept the shortfall and leave it Partial with a recorded reason."
    expected: "One of the two, recorded in REQUIREMENTS.md in the same edit that moves (or holds) the row."
    why_human: "The requirement's sizing sentence is a claim the owner made about intended scope. A verifier can measure the tree; it cannot decide whether a 10.1k removal instead of a 12.4k one is the outcome that was wanted."
---

# Phase 29: The MCP Surface — Verification Report

**Phase Goal:** The store is reachable through a tool family **derived from** Phase 19's `upstream-procedure-manifest.json`, registered proxy-locally and shaped for an agent rather than a cursor — and the family it replaces is **deleted in this same phase**, safely, because every guard that breaks on registration, on the rename and on the deletion moved with the change that broke it, and the removal gate was built and observed biting first.

**Verified:** 2026-08-30T08:44:35Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Denominator is the five ROADMAP Success Criteria (the contract) plus `CUT-01`'s sizing claim, which is an in-scope phase requirement no criterion restates.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC-1** Every `curated`/`adapt-to-address-input` verb has a route, every `omit` verb is absent, `r2000_delete_project_enum` is not carried, and the derivation is checked **mechanically** | ✓ VERIFIED | Independently re-derived the manifest classification: **15 curated + 1 adapt + 4 omit** across 5 procedures. Surface carries 19 `anno_*` verbs; `anno_delete_project_enum` and the bare `delete_project_enum` are both absent. `anno-derivation.test.ts` is genuinely mechanical in **both** directions (forward: route-or-fail, omit-under-two-spellings, unknown disposition FAILS rather than skips; backward: every unclassified verb needs a register entry citing a requirement id), is order-independent over reversed copies of both sides, and carries non-vacuity floors 16/4. Ran it: **8 pass, 1 skip** (the skip is the live upstream re-hash, gated on `R2000_UPSTREAM_CLONE`, correctly reported). |
| 2 | **SC-2** The new family is registered and the retired one is deleted in this same phase, with the removal gate built and observed biting first, each guard moved with the change that broke it, **both skill trees re-pointed onto verbs that exist proven against the shipped copy before the removal**, and no interception to forget | ✗ FAILED | Registration, deletion, ordering and the by-construction path-translation claim are all **VERIFIED**; the skill-re-pointing clause is **FALSE**. Detail below. |
| 3 | **SC-3** Backend-agnosticism reads out of the ordered `BACKEND_SEAM_BYPASS_KEYS`, not `capability-registry.ts`; neither manifest gains an entry; `docs/tool-support.md` regenerates byte-identical | ✓ VERIFIED | `stock-dispatch.test.ts:1510` is a two-entry ordered array with `annoDef.name` at position 2 and an order-sensitive `deepEqual`, plus a `registrations.length >= 5` floor so an empty set fails rather than reads as agreement. `capability-registry.ts` has zero `anno_` entries. A test loops every `CURATED_ANNO_TOOLS` name against **both** manifests; measured directly: 0 `anno_` hits in `tools-manifest.json`. Regenerated `docs/tool-support.md` — md5 `bb47448…` unchanged, byte-identical. |
| 4 | **SC-4** Registration-time gates move in the registering commit; the three named gates green **with nothing deleted**; the generator regex and its two duplicate witnesses move together with none refactored into a shared helper; the module floor re-pointed, **raised**, positive control on real new filenames | ✓ VERIFIED | Commit `65a28f3` (`feat(29-01): register the anno_* tool surface and move every registration-time guard`) has **zero deletions** (`--diff-filter=D` empty) and moves five guards. The three bounding witnesses each keep a distinct technique in a distinct file (`generate-tool-support-table.mjs:107` regex, `capability-registry.test.ts:163` its own regex, `stock-dispatch.test.ts:1560` a body-slice needle) — none shares a helper. `ANNO_MODULE_FLOOR = 15 + 1` replaces `R2000_MODULE_FLOOR = 14`, a literal raise, with an explicit "never derive from disk" rationale and a pinned-equals-measured companion. Positive control substitutes `anno-store.ts` for INT-01's deleted fourth name, so all four are real current files. All three gates exit 0 today. |
| 5 | **SC-5** Cross-references and search derived on every query and never cached; `max_results` required with no default; count returned so truncation is detectable; explicit address, no cursor; a repeated edit **succeeds** reporting no change; a batch pre-validates every inner name and returns per-item status; an ambiguous or unsupported request **refuses by name** rather than a plausible-looking zero | ✗ FAILED | Six of the seven clauses verified behaviourally (see Behavioural Spot-Checks). The seventh is false: `anno_disassemble` returns a plausible-looking zero. Detail below. |
| 6 | **CUT-01** A net ~12.4k lines of the 25,759-line surface deleted, ~12.9k surviving under new names | ✗ FAILED | Measured for the first time. Pre-phase surface **26,023 lines / 35 files**; **15,957 lines survive**; net removal **10,066 lines**. All three stated figures are wrong. The row is correctly `Partial`. |

**Score:** 4/6 truths verified (0 present, behavior-unverified)

---

### Truth 2 in detail — what holds and what does not

**Holds (independently verified, not taken from any SUMMARY):**

- **Registered proxy-locally.** `vice-proxy.ts:194` imports `ANNO_TOOL_DEFINITIONS, runAnnoTool`; `:3388-3389` registers each through `buildViceTool()` in a two-line loop. Nothing appended to the file's tail.
- **Deleted in this same phase.** Zero `r2000-*.ts` remain under `src/mcp/vice/`. Only two `r2000`-named files survive anywhere in tracked source, and both are the removal gate itself (`scripts/check-no-regenerator2000.{mjs,d.mts}`).
- **The removal gate was built and observed biting FIRST.** `git merge-base --is-ancestor` confirms both `4bfafe4` (`feat(29-02): the removal gate…`) and `0e31252` (`test(29-02): observe the removal gate bite…`) are ancestors of `1d40ad0` (`feat(29-10): delete the glue…`). The ordering is a fact of the DAG, not a narrative.
- **The gate is green with an empty allow-list.** 387 files scanned (357 tracked outside `.planning/` + 30 shipped-but-untracked installer paths, floor 350), 157 permanently-exempt occurrences across 12 exact-pinned classes, **0 temporarily allow-listed across 0 entries**.
- **By construction, no interception to forget.** The body-slice assertion over `runAnnoTool`'s body is present and real (`stock-dispatch.test.ts:1558-1565`) and forbids all three of `forwardToVice` / `ensureViceSession` / `rewriteArguments`. Measured independently: **no `anno-*.ts` module imports `hostpath.ts`** — every one of the 8 textual hits is a comment saying not to.

**Does not hold:** the clause "both skill trees were re-pointed onto verbs that exist, proven against the shipped copy, before the removal (29-09)". Two shipped commands are dead in both trees; see gap 2. `check-skill-tool-coverage.mjs`'s greenness does not contradict this — it resolves 18 `anno_*` names and 2 CLI verbs and never looks at an invocation's arguments.

---

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-09 — five modules shipped with no production consumer | Phase 30 | `scripts/lib/anno-cli-verbs.mjs:57-60` names Phase 30 in terms; ROADMAP Phase 30 is the ACME export rebuild. Independently confirmed the orphaning: 4 of 5 have no non-test importer. |
| 2 | CUT-06 — no living document points a user at a deleted route | Phase 32 | ROADMAP Phase 32 criterion 2. **Partial overlap only** — CR-04/CR-05 are kept as a Phase-29 gap because REPOINT-01/02 are recorded `Complete` against Phase 29. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-tools.ts` | The one authoritative curated surface + never-throw runner | ⚠️ WIRED, TWO DEFECTS | 2,060 lines, 19 verbs, imported and looped by `vice-proxy.ts`. `runAnnoTool`'s `try`/`finally` is correct and the allow-list gate runs before any argument is read. CR-01 (`sliceSpan` not total) and CR-06 (batch recursion drops `store`) live here. |
| `src/mcp/vice/anno-derivation.test.ts` | MCP-01 made mechanical, both directions | ✓ VERIFIED | 478 lines; forward + backward + ordering + zero-caller; 8 pass / 1 gated skip. |
| `src/mcp/vice/anno-register.ts` | Committed register justifying non-manifest verbs | ✓ VERIFIED | 235 lines; consumed by the backward derivation check, which fails a verb citing no requirement id. |
| `src/mcp/vice/anno-derive.ts` | Derived xref + search, never cached | ✓ VERIFIED | `crossReferencesTo()` unions three sources, two derived fresh from bytes and one stored (`listXrefs`, only for references unrecoverable from bytes — the apparent `anno_xref`/STORE-05 conflict is resolved in the DDL comment and holds). `NOTHING IS WRITTEN`. |
| `src/mcp/vice/anno-cli.ts` | Two-verb CLI, all caller paths confined | ✗ CONFINEMENT NOT KEPT | `--out` and `--provenance` bypass the seam on both verbs; `render-memmap` never calls `refuseOverwrite()` and has no `--force` option. Three headers claim otherwise. |
| `scripts/check-no-regenerator2000.mjs` | The removal gate | ✓ VERIFIED | Byte-level reads (no binary skip — handles the NUL-byte file), exact counts in both directions, non-vacuity floor, empty temporary allow-list. Observed biting on four separate plants by this pass. |
| `src/mcp/vice/hostpath-consumers.test.ts` | Module floor re-pointed and raised | ✓ VERIFIED | 14 → 15 → 16, hand-pinned as a relation, with an explicit prohibition on deriving it from disk. |
| `src/skills/**` + `installer/skills/**` | Re-pointed onto verbs that exist | ✗ TWO DEAD COMMANDS | See gap 2. 18 `anno_*` names resolve; two documented invocations do not run. |
| `docs/tool-support.md` | Regenerates byte-identical, no `anno_` entry | ✓ VERIFIED | Regenerated; md5 unchanged; 0 `anno_` hits. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `vice-proxy.ts` | `anno-tools.ts` | `import` at :194 + loop at :3388-3389 through `buildViceTool()` | ✓ WIRED | Two-line substitution; `docs-linerefs.test.ts` citations preserved. |
| `anno-tools.ts` (`runAnnoTool`) | `anno-store.ts` (`openStore`) | direct call, closed in a `finally` | ✓ WIRED | Exercised end to end by this pass against a real store. |
| `anno-tools.ts` | `forwardToVice()` / `rewriteArguments()` | — | ✓ ABSENT BY CONSTRUCTION | Body-slice assertion + verified zero `hostpath.ts` imports. |
| `anno-derivation.test.ts` | `upstream-procedure-manifest.json` | `readFileSync` at :68-72 | ✓ WIRED | Path resolves; independently re-parsed; counts agree with the pinned floors. |
| `anno-cli.ts` (`--out`, `--provenance`) | `storePathWithinWorkspace()` | — | ✗ NOT WIRED | The link the file's own headers assert exists. Both arguments reach `writeFileSync`/`readFileSync` raw. |
| skill playbooks | live CLI verbs | Bash invocation with agent-composed arguments | ⚠️ PARTIAL | Verb NAMES resolve; two invocations' arguments name a format whose producer was deleted this phase. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `anno_get_symbols` | `symbols`, `returned`, `matched`, `truncated` | `anno_label` table via `openStore` | Yes — returned a written label after a write | ✓ FLOWING |
| `anno_search` | `corpora.{labels,comments,instructions}` | decoders + store, computed per query | Yes — `entries: 3` on a populated store | ✓ FLOWING |
| `anno_get_cross_references` | `callers`, `total`, `truncated` | `crossReferencesTo()`, three sources, none written | Yes | ✓ FLOWING |
| `anno_get_binary_info` | `origin`, `last_address`, `entropy` | `parsePrg` on the real image | Yes — `origin 4096`, `last_address 4099`, `entropy 2` | ✓ FLOWING |
| `anno_disassemble` | `instructions`, `end_address` | `sliceSpan()` on the image | **No for out-of-image input** — an empty slice reported as a successful empty listing with an incoherent range | ✗ HOLLOW |
| store on disk | `anno_xref` | only non-derivable rows | N/A — `STORE-06 never-cached control` test asserts the store is byte-identical across repeated derived queries; ran it, green | ✓ FLOWING |

---

### Behavioural Spot-Checks

Driven through the production entry point `runAnnoTool()` against a real store and a real `.prg`.

| Behavior | Command | Result | Status |
|---|---|---|---|
| `max_results` is REQUIRED with no default | `anno_get_symbols {store}` | `isError:true` — `"max_results" must be a positive integer, got undefined -- it is REQUIRED and has no default on this surface` | ✓ PASS |
| Count returned so truncation is detectable | `anno_get_symbols {store, max_results:10}` | `{"returned":0,"matched":0,"truncated":false}` | ✓ PASS |
| A repeated edit SUCCEEDS reporting no change | `anno_set_label_name` twice, same args | 1st `changed:true`, 2nd `isError:false, changed:false` | ✓ PASS |
| Batch returns per-item status | `anno_batch_execute` with 2 valid calls | `results:[{index:0,…,status:"success"},…]` | ✓ PASS |
| Batch pre-validates every inner name | `anno_batch_execute` with `anno_nope` first | `refused WHOLE: calls[0].name "anno_nope" is outside the curated anno_* tool surface (D-33)` | ✓ PASS |
| Explicit addressing, no cursor | `anno_get_address_details {address}` | Answers by address; no cursor verb on the surface | ✓ PASS |
| Ambiguous/unsupported refuses by name | `anno_read_region {start_address:$9000,end_address:$9010}` on a `$1000..$1003` image | `{"available":false,"reason":"…not entirely inside the image…"}` | ✓ PASS |
| **Same input, sibling verb** | `anno_disassemble {address:$9000}` on the same image | `isError:false` — `{"address":36864,"end_address":4099,"instructions":0}` | ✗ **FAIL (CR-01)** |
| **Nested batch with documented inheritance** | `anno_batch_execute{store, calls:[{name:"anno_batch_execute", arguments:{calls:[…]}}]}` | `isError:true` — refusal names the grandchild and states the opposite of the tool's description | ✗ **FAIL (CR-06)** |
| **`--out` escapes the workspace and overwrites silently** | `anno render-memmap <store> --provenance <ok.json> --out /tmp/…/VICTIM.md` | `render-memmap: wrote /tmp/…/VICTIM.md` — pre-existing content destroyed, no `--force`, no refusal | ✗ **FAIL (CR-02)** |
| **`--provenance` reads any file and echoes its bytes** | `anno render-memmap <store> --provenance /tmp/…/secret.env` | `…is not valid JSON: Unexpected token 'S', "SECRET_TOK"… ` | ✗ **FAIL (CR-03)** |
| **Shipped playbook's `render-memmap` command** | `anno render-memmap game.regen2000proj --provenance …` | `not an annotation store (file is not a database)`, exit 1 | ✗ **FAIL (CR-04)** |
| **Shipped playbook's only measurement command** | `anno coverage game.prg --store game.annostore` | Full report of zeros, `payload UNAVAILABLE … is not valid JSON`, exit 1 | ✗ **FAIL (CR-05)** |
| Derived queries never cache | `STORE-06 never-cached control` in `anno-derive.test.ts` | 29/29 pass | ✓ PASS |
| Mechanical derivation | `anno-derivation.test.ts` | 8 pass / 1 gated skip | ✓ PASS |
| Removal gate non-vacuity | `removal-gate.test.ts` | 8/8 pass | ✓ PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no PLAN or SUMMARY declares one. The phase's runnable-check equivalents are the six single-command CI gates, executed below.

| Gate | Command | Result | Status |
|---|---|---|---|
| Removal gate | `node scripts/check-no-regenerator2000.mjs` | exit **0** — 387 files, 157 permanent exemptions, **0 temporary allow-list entries** | ✓ PASS |
| Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | exit **0** — 37 `vice_*` / 18 `anno_*` (all curated) / 2 CLI verbs, 2/2 resolved | ✓ PASS |
| npm package contents | `node scripts/check-npm-packages.mjs` | exit **0** — vice-mcp 78 files, c64-re-tools 34 files / 7 skills | ✓ PASS |
| Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | exit **0** — 11 fork-only mentions, 24 names policed, README assertions intact | ✓ PASS |
| Skill description overlap | `node scripts/check-skill-description-overlap.mjs` | exit **0** — 21 pairs, max 0.250 vs threshold 0.35 | ✓ PASS |
| Docs/audit gate | `node scripts/audit-gate.mjs` | exit **1** before this report existed (9 red docs guards while 5 milestone audits declare a gated status; root cause the undispositioned `29-REVIEW.md`) → **exit 0 after**, re-run and observed | ✓ PASS (after) |
| Table byte-identity | `node scripts/generate-tool-support-table.mjs` then md5 | md5 unchanged (`bb47448…`) | ✓ PASS |
| Regression suite | `npm run test:automated` | 2676 tests, 2668 pass, **2 fail**, 46s — both the disposition guard and its cascade, both since re-run GREEN (`docs-review-disposition` 7/7, `audit-integrity` 44/44) | ✓ PASS (after) |
| Typecheck | (covered by the automated gate's own preconditions) | not separately re-run | ? SKIP |

**Planted-violation controls re-observed by this pass (each reverted; working tree left clean):**

| Plant | Gate response | Verdict |
|---|---|---|
| Delete an ABS-02 attribution block from `src/skills/c64-memory-mapping/SKILL.md` | exit 1 — `expected exactly 5 exempted occurrence(s) … got 3. … a LOWER count means the attribution prose CUT-03 exists to protect has been deleted`, naming **both** `src/skills/` and `installer/skills/` | ✓ CUT-03 non-vacuous |
| Reintroduce the subject in a `.ts` (`anno-store.ts`) | exit 1 | ✓ CUT-02 bites |
| Reintroduce in a `docs/` file (`tool-support.md`) | exit 1 | ✓ CUT-02 bites |
| Reintroduce in a `scripts/` file (`check-npm-packages.mjs`) | exit 1 | ✓ CUT-02 bites |
| Reintroduce directly in `installer/skills/acme-build/SKILL.md` | exit **0** | ⚠️ Not a gap — the gate runs `prepack`/`sync-skills` before scanning, which regenerates `installer/skills/` from `src/skills/`. The tree is covered (the attribution plant above reported the installer twin) but it cannot be covered *independently*. Noted so a future reader does not mistake this for coverage of a hand-edited installer tree. |

---

### Requirements Coverage

All twelve declared requirement IDs are claimed by at least one plan; **no orphans**. Cross-referenced against `.planning/REQUIREMENTS.md`.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| MCP-01 | 29-03, 29-06, 29-08 | ✓ SATISFIED | Derivation independently re-computed and the mechanical check independently run in both directions with live non-vacuity floors. |
| MCP-02 | 29-01, 29-11, 29-10 | ✓ SATISFIED | `buildViceTool()` loop at `vice-proxy.ts:3388`; body-slice assertion present; zero `hostpath.ts` imports measured. |
| MCP-03 | 29-01, 29-11 | ✓ SATISFIED | Ordered two-entry allow-list with a length floor; zero entries in either manifest; table byte-identical on regeneration. |
| MCP-04 | 29-03, 29-06 | ✗ **BLOCKED** | Explicit addressing, idempotence and per-item batch status all hold — but CR-01 delivers exactly the "plausible-looking zero" this requirement names, and CR-06 makes the batch's documented nesting unusable with a message contradicting the tool's own description. |
| MCP-05 | 29-01, 29-02, 29-05, 29-07, 29-08, 29-09 | ✓ SATISFIED | `65a28f3` moves five registration-time guards and deletes nothing; rename guards moved in `c59fcef`; deletion guards with `1d40ad0`; floors raised not lowered; three witnesses kept distinct. |
| STORE-06 | 29-04, 29-07, 29-11 | ✓ SATISFIED | Three-source derivation computed per query, `NOTHING IS WRITTEN`, byte-identity control green; `max_results` required with counts returned. |
| REPOINT-01 | 29-09 | ✗ **BLOCKED** | Two of the absorbed procedures' documented steps do not run (CR-04, CR-05). |
| REPOINT-02 | 29-09 | ✗ **BLOCKED** | The shipped `installer/` twin carries both dead commands verbatim — "proven against the shipped copy" does not hold for the invocations, only for the names. |
| CUT-01 | 29-10, 29-12 | ⚠️ **PARTIAL — correctly recorded** | Measured: 26,023 pre-phase → 15,957 surviving → 10,066 net removed. All three of the requirement's figures are falsified. Do NOT flip to Complete. |
| CUT-02 | 29-02 | ✓ SATISFIED | Three plants in the three named scope classes each observed biting by this pass. |
| CUT-03 | 29-02 | ✓ SATISFIED | Attribution-block deletion planted and observed biting, with the refusal naming both trees and both directions. |
| CUT-05 | 29-09 | ✓ SATISFIED | `check-skill-fork-honesty.mjs:533` now pins `"anno export-asm"`; `acme-build/SKILL.md:137-138,194` carries the dated withdrawal notice naming that literal. Gate exit 0. |

**REPOINT-03 — scored on request, though it maps to Phase 31.** Its second half is **already done and greener than expected**: `routine-queue-walker/SKILL.md:3`'s YAML `description:` no longer names regenerator2000 (it now reads "an existing C64 annotation store's backlog"), the change is substantive rather than an exemption, and the re-triggered `ABS-03` pairwise collision check is green (21 pairs, max 0.250 vs threshold 0.35, allowlist size 0). The attribution chain itself survives and is **provably non-vacuous** — the planted deletion above tripped the gate on both trees. What is NOT yet verified is the specific count REPOINT-03 asserts ("5 blocks in 3 files … plus their 5 synced twins, 10 instances"); measured today there are **4 files per tree** carrying the subject (3 `SKILL.md` + `packer-finding.mjs`), with per-file exact pins of 5/4/3/1. Recommend Phase 31 re-derive the count rather than inherit it.

---

### Decision Coverage

All 17 `29-CONTEXT.md` `<decisions>` entries (`D-01`…`D-17`) are traceable into shipped source or scripts — every one has code-comment hits, and `D-01`, `D-02`, `D-06`, `D-08`, `D-09`, `D-11`, `D-13`, `D-16`, `D-17` additionally appear in two or more SUMMARYs. `D-17` (the `render-memmap` rebuild) is the most cited at 5 SUMMARYs — which sharpens gap 2 rather than softening it: the phase knew it had rebuilt the verb and shipped a playbook asserting the opposite in the present tense.

**Honored:** 17/17. **Not honored:** none. *(Non-blocking gate; recorded for drift tracking.)*

---

### Test Quality Audit

| Area | Finding | Verdict |
|---|---|---|
| Disabled tests on requirements | Zero `it.skip` / `describe.skip` / `{skip:true}` / `todo:true` anywhere in `anno-*.test.ts` or `removal-gate.test.ts`. The one skip in the whole automated run is `anno-derivation.test.ts`'s live upstream re-hash, correctly gated on `R2000_UPSTREAM_CLONE` and reported with a reason. | ✓ CLEAN |
| Circular expected values | `writeFileSync` in 9 `anno-*.test.ts` files is temp-store and fixture-image construction, not expected-value capture. No "capture"/"baseline"/"snapshot" generator scripts import a system under test to produce assertions. | ✓ CLEAN |
| Assertion strength | Value- and behaviour-level throughout: `deepEqual` on ordered arrays, exact counts in both directions, refusal messages matched on their literal text. | ✓ STRONG |
| Coverage quantity | `ANNO_MODULE_FLOOR` pinned-equals-measured; derivation floors 16/4; removal-gate per-class exact counts. Floors are one-sided **plus** an equality companion, so both directions of drift are caught. | ✓ STRONG |
| **Coverage of consumer sets** | The one structural weakness. `anno-confinement.test.ts` has 15 thorough tests of `storePathWithinWorkspace()` and **zero** assertions enumerating its CLI consumers — which is precisely how CR-02 and CR-03 shipped past a green suite. Contrast `hostpath-consumers.test.ts`, which does exactly this for the host-path seam. | ⚠️ WARNING → folded into gap 3 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` debt markers across all 59 non-test files this phase modified | — | **None found.** Also zero `TODO` / `HACK` / `PLACEHOLDER`. |
| `src/mcp/vice/anno-cli.ts` | 41, 704, 182-193 | Header asserts a maintained property the code does not keep ("Both caller-supplied paths are confined", "the ONE confinement seam", "overwrite safety stays uniform") | 🛑 BLOCKER | Gap 3. A comment naming a guarantee the code does not provide is worse than silence — the next maintainer has a written warrant not to check. |
| `src/mcp/vice/anno-memmap-render.ts` | 311-316 | Documents `storePath`'s confinement in four lines and says nothing about `provenancePath` one line below | 🛑 BLOCKER | Gap 3. The silence is what let CR-03 through. |
| `src/mcp/vice/anno-tools.ts` | 900-911 vs 1352-1355 | Tool description and refusal message state opposite facts about store inheritance | 🛑 BLOCKER | Gap 4 / CR-06. |
| `src/skills/c64-program-recon/SKILL.md` | 263-267 | Dated note asserts in the **present tense** the behaviour this same phase replaced | 🛑 BLOCKER | Gap 2 / CR-04. |
| `src/mcp/vice/anno-store.ts` | 290-296, 3332-3337 | `unique(address, bank)` enforces nothing while `bank` is null (SQLite treats NULLs as distinct); the comment cites it by name as the reason "ONE ADDRESS CARRIES AT MOST ONE ENUM" | ⚠️ WARNING | WR-01. Invariant currently rests on the guarded write path alone. |
| `src/mcp/vice/anno-store.ts` | 293, 3389-3403 | `references anno_enum(id)` inert without `pragma foreign_keys=ON`; `listEnumUsage()`'s inner join would silently drop an unresolved row | ⚠️ WARNING | WR-02. |
| `src/mcp/vice/anno-derive.ts` | 459-462 | `corpusEnabled()` returns `flag !== false`, so the string `"false"` ENABLES a corpus | ⚠️ WARNING | WR-03. A JSON string where a boolean was meant is a common LLM argument error. |
| `src/mcp/vice/anno-tools.ts` | 1608, 1647-1689 | Four structural collections returned whole, ungoverned by `max_results`, in a family the file's own comment says is not chunked | ⚠️ WARNING | WR-04. |
| `src/mcp/vice/anno-tools.ts` | 407-426 | Schema says "workspace-relative"; resolution is against `process.cwd()` | ⚠️ WARNING | WR-05. Fails safe but names a path the caller never typed. |
| `src/mcp/vice/anno-derive.ts` | 565-571 | `corpora.<name>.entries` means "true size" for two corpora and "0 because unmeasured" for the third | ⚠️ WARNING | WR-06. |
| `src/mcp/vice/prg-image.ts` | 30-36 | Reachability rationale names an import that no longer exists (`anno-cli.ts:82` imports only `decodeRawData`) | ⚠️ WARNING | WR-07. |
| `src/mcp/vice/package.json` | 56-73 | Five modules with no production consumer still in `files[]` | ⚠️ WARNING | WR-09 — **deferred to Phase 30**, with the return date already recorded in `anno-cli-verbs.mjs:57-60`. |
| `src/mcp/vice/anno-tools.ts` | 1700-1710 | `dispatchSaveProject()` reads the revision twice, so the field and the prose can name different revisions | ⚠️ WARNING | WR-10. On the one verb whose output is used as a compare-and-swap guard. |
| `src/mcp/vice/anno-tools.ts` | 1495-1514 | Inode guard compares `ino` without `dev` | ⚠️ WARNING | WR-11. One field, in a repo built around bind mounts. |
| `src/mcp/vice/prg-image.ts` | 69-78 | `parsePrg()` accepts a load address whose payload runs past `$FFFF`; the overflow reaches result bodies as a five-hex-digit "address" | ⚠️ WARNING | WR-12. |
| `scripts/check-no-regenerator2000.mjs` | 782-789 | `exemptionFor()` `return null`s inside the class loop instead of `continue`ing, so a class appended after the block-scoped ones is unreachable | ⚠️ WARNING | WR-13. Correct today only by array order. |
| `src/mcp/vice/anno-cli.ts`, `vice-proxy.ts`, `scripts/lib/anno-cli-verbs.mjs`, `scripts/check-npm-packages.mjs` | :866/:893/:902, :300, :62, :236-239 | Mechanical rename left user-facing strings and cross-references on the retired vocabulary (`r2000: unknown verb`, `runR2000Cli`, `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`, `extractedR2000.size >= 10`) | ⚠️ **PARTLY DISCHARGED** | WR-14. **Sites 2, 4 and 5 SHIPPED in plan 29-16** — the two user-facing `r2000:` message prefixes in `anno-cli.ts` are now `anno:`, `anno-cli-verbs.mjs`'s stale precedent citation names the real `extractedAnno.size >= 18`, and `check-npm-packages.mjs`'s historical sentence is marked past-tense with the pre-deletion module names. **Sites 1 and 3 REMAIN OPEN** — the exported entry function `runR2000Cli` and the test hatch `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`, dropped from that round on a measured decision: the rename's consumer set is not the one dynamic import the original scope assumed but a ~26-call-site rename in `anno-cli.test.ts` plus a guarded-record update in `module-classification.ts:674`/`:676`, in a wave-3 plan already carrying gap 2b. Their correct home is a pass that owns `anno-cli.test.ts` as its subject. Full reasoning: plan `29-16-PLAN.md` § `<wr14_scope_decision>`. |

**Blocker anti-patterns:** 4 (all folded into gaps 2-4). **Warnings:** 14. **Debt markers:** 0.

---

### Human Verification Required

This is predominantly an infrastructure/tooling phase, and its user-facing surface (the shipped skill playbooks) is already covered by gap 2 rather than by a manual step. One item genuinely needs a human decision:

#### 1. CUT-01's disposition

**Test:** Read the measured figures — pre-phase surface **26,023 lines / 35 files** (`10,035` non-test + `15,988` test), **15,957 lines surviving** under new names, **10,066 lines net removed** — against `CUT-01`'s stated `~12.4k removed / ~12.9k surviving / 25,759 total`.
**Expected:** Either the requirement text is corrected to the measured figures and the row moves to `Complete`, or the shortfall is accepted as intended and the row stays `Partial` with a recorded reason.
**Why human:** The sizing sentence is a claim about *intended* scope. A verifier can measure the tree; it cannot decide whether removing 10.1k instead of 12.4k is the outcome that was wanted. Adjusting the row without changing the sentence is precisely the failure the audit gate exists against.

---

### Gaps Summary

The phase's **structural** work is genuinely done and genuinely well guarded, and this pass confirmed it by re-running the mechanisms rather than by reading the SUMMARYs. The derivation is mechanical in both directions with live non-vacuity floors. The registration is a two-line substitution through `buildViceTool()` and the path-translation constraint is satisfied by construction — measured, not asserted: no `anno-*` module imports `hostpath.ts` at all. The ordering the goal names as its safety argument is a fact of the commit DAG: the removal gate was built and observed biting in commits that are ancestors of the deletion, and the registering commit deletes nothing. The removal gate is green tree-wide with an **empty** temporary allow-list, and this pass re-observed it biting on four independent plants including the CUT-03 attribution-block deletion.

What fails is the **boundary around** that core, and two of the four failures land directly on the goal's own words.

**"Shaped for an agent rather than a cursor"** is falsified by CR-01. `anno_disassemble` answers an address outside the image with `isError:false`, `instructions:0` and an `end_address` below the address asked about. An agent that mis-derived a routine's address is told the routine is empty rather than that it named the wrong image — the exact reading criterion 5 and MCP-04 forbid. That the sibling `anno_read_region` refuses the identical input correctly makes this a disagreement between two views the file documents as sharing one cap, not an oversight at the edge.

**"Both skill trees re-pointed onto verbs that exist, proven against the shipped copy"** is falsified by CR-04 and CR-05. Two documented commands cannot run in either tree; one of them is the only measurement instruction `routine-queue-walker` has, and its input format's only producer was deleted in this same phase, so there is no correct spelling to move to. A copy-forward template propagates one of them into every new project. The phase's own gate could not see this because `check-skill-tool-coverage.mjs` resolves names and never arguments — worth fixing as part of the closure, because otherwise the next re-pointing has the same blind spot.

**The CLI's confinement** (CR-02, CR-03) is a third class: not a roadmap criterion, but a violation of `CLAUDE.md`'s standing architectural constraint that every host-facing or caller-supplied path goes through one seam, on arguments that are LLM-composed by design. Three separate headers assert the property the code does not keep. The seam itself is excellently tested — 15 cases — and its consumer set is unenumerated, which is the whole mechanism of the failure and the thing worth fixing rather than the two call sites alone.

**CUT-01** was, as the record honestly said, never measured. It is measured now, and all three of its figures are wrong in the same direction. The `Partial` row was the correct call and this pass ratifies it; what remains is an owner decision about which of the two sentences is corrected.

**One regression against `29-BASELINE.md`'s failing-file set**, with a single cause: `docs-review-disposition.test.ts` reds on 13 undispositioned `29-REVIEW.md` ids and `audit-gate.mjs` refuses in cascade, where the baseline recorded exit 0. `r2000-session.test.ts`'s 5 baseline failures left the set **by construction** — 29-10 deleted the file — which is exactly what the baseline instructed be reported rather than banked as an improvement. This report names all twenty finding ids, which the guard treats as a disposition source — and re-running both after writing it observed `docs-review-disposition.test.ts` **7/7**, `audit-integrity.test.ts` **44/44** and `audit-gate.mjs` **exit 0**. That regression is therefore closed, and the red-then-green sequence is kept in the record as its audit trail rather than deleted.

Every finding id in `29-REVIEW.md` is dispositioned here: **CR-01** gap 1, **CR-02**/**CR-03** gap 3, **CR-04**/**CR-05** gap 2, **CR-06** gap 4, **WR-01**, **WR-02**, **WR-03**, **WR-04**, **WR-05**, **WR-06**, **WR-07**, **WR-08**, **WR-10**, **WR-11**, **WR-12**, **WR-13**, **WR-14** recorded as warnings in the anti-pattern table above, and **WR-09** deferred to Phase 30 on its own recorded evidence.

---

_Verified: 2026-08-30T08:44:35Z_
_Verifier: Claude (gsd-verifier)_
