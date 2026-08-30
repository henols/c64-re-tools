---
phase: 29-the-mcp-surface
verified: 2026-08-30T15:20:00Z
status: gaps_found
score: 4/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  previous_verified: 2026-08-30T08:44:35Z
  gaps_closed:
    - "MCP-04 / criterion 5 -- `anno_disassemble` now refuses an out-of-image address with `{available:false, reason}`, the SAME verdict `anno_read_region` gives (old CR-01). Re-executed through `runAnnoTool()`, not read from a summary."
    - "MCP-04 -- a nested `anno_batch_execute` relying on the documented store inheritance now VALIDATES and EXECUTES at depth 2, and depth 5 is refused by name (old CR-06). Re-executed."
    - "CLAUDE.md's confinement constraint -- `--out` and `--provenance` on both CLI verbs now refuse a path outside the workspace root, `render-memmap` has `--force` and reaches `refuseOverwrite()`, and the sidecar parse failure no longer echoes the file's bytes (old CR-02/CR-03/WR-08). All four re-executed against the shipped CLI."
    - "REPOINT-01/02 (a) -- all four `render-memmap` invocations in both trees name `game.annostore`, the falsified present-tense dated note is DELETED and replaced with a correct dated correction (old CR-04)."
    - "REPOINT-01/02 (b) -- `anno coverage game.prg --store <store>` now runs and exits 0 with a decoded payload; `loadProjectImage()` dispatches `.prg`/`.raw`/`.bin` (old CR-05). Re-executed end to end."
  gaps_remaining:
    - "CUT-01's surviving-line figure -- the row was moved to Complete against a figure that does not re-derive under the requirement's OWN documented predicate. Re-measured independently this pass."
  regressions:
    - "NEW BLOCKER: `render-memmap --check` reports `drifted` for a byte-identical store, sidecar and rendered file whenever the checkout's absolute path differs, while printing the SAME render_digest. Reproduced independently. Three shipped user-facing texts (CLI USAGE, the copy-forward template, the recon playbook) assert a two-cause drift semantics this falsifies."
gaps:
  - truth: "ROADMAP criterion 2 -- both skill trees are re-pointed onto verbs that exist and behave as the SHIPPED copy documents; REPOINT-01/REPOINT-02's absorbed procedures run on the new surface"
    status: partial
    reason: "REPRODUCED INDEPENDENTLY, and it is a defect this phase shipped rather than one it inherited. The two dead commands from the previous round are genuinely alive (verified by execution). What replaces them is a THIRD documented invocation that returns a wrong verdict: `render-memmap --check` compares the on-disk file against a fresh render BYTE FOR BYTE (`anno-memmap-render.ts:601-603`) while the banner it compares carries ABSOLUTE paths (`:462-463`), so an identical store + identical sidecar + identical rendered file reports `drifted` as soon as the checkout sits at a different absolute path. Measured on this machine: two byte-identical trees, `render_digest` 0bc87b17... in BOTH, verdict `{\"status\":\"drifted\",\"line\":3}`. The drift gate contradicts its own artifact's digest. This repo runs GSD with worktree isolation ON and the artifact is meant to be committed, so a differing checkout path is the NORMAL case, not an edge. The `store:` half predates plan 29-14 (the CLI already realpath'd the store at `e776be7^`); 29-14 extended it to the `sidecar:` line. Three shipped texts state the falsified semantics in the present tense -- `anno-cli.ts:130-131` USAGE, `templates/memory-map.template.md:16-19` (the file an agent COPIES INTO EVERY NEW PROJECT) and `c64-program-recon/SKILL.md:259` -- and the template's documented remedy ('the fix is always to re-run the generator') writes machine-specific absolute paths into a committed file, so the next machine reds again. That is the same class as the old CR-04 note this round deleted. Review id CR-01 (2026-08-30T14:05Z review)."
    artifacts:
      - path: "src/mcp/vice/anno-memmap-render.ts"
        issue: ":462-463 write `storePath`/`provenancePath` verbatim into the compared banner; `:601-603` compares byte for byte. `computeRenderDigest()` deliberately does NOT cover the paths, so the digest and the verdict disagree by construction."
      - path: "src/mcp/vice/anno-cli.ts"
        issue: ":383/:410/:425 pass the realpaths returned by `storePathWithinWorkspace()` into the renderer; USAGE at :125 says 'beside the project' (code says beside the STORE), :136 spells the coverage positional `<project>` (after 29-16 it is an image), :130-131 states the two-cause drift claim this defect falsifies (WR-05)."
      - path: "src/mcp/vice/anno-memmap-render.test.ts"
        issue: ":378 ASSERTS the banner contains the absolute `provenancePath`, and :439 asserts the markdown includes it -- the suite pins the defect. No test renders under root A and re-checks the same bytes under root B, which is why this shipped green."
      - path: "src/skills/c64-program-recon/templates/memory-map.template.md"
        issue: ":16-19 tells every new project that a non-zero `--check` means a hand edit or a store change, and that the fix is always to re-run the generator."
      - path: "scripts/lib/anno-cli-invocations.mjs"
        issue: "the new invocation gate checks flag membership and positional extensions only -- it never checks a REQUIRED flag's presence. Planted `anno coverage game.prg` (no `--store`) at routine-queue-walker/SKILL.md:241 and the gate reported OK, exit 0, for a command that exits 1. Reverted; tree clean. Review id WR-01."
    missing:
      - "Make the banner path-independent: `relative(workspaceRoot, storePath)` / `relative(workspaceRoot, provenancePath)`. `workspaceRoot` is already a required option on both `RenderMemoryMapOptions` and `CheckRenderedMemoryMapOptions`, so no signature changes."
      - "A test that renders under root A, copies the bytes to root B and asserts `--check` reports `in-sync` -- and re-point `anno-memmap-render.test.ts:378`/`:439`, which currently pin the absolute path."
      - "Correct all three user-facing texts that state the two-cause drift semantics (CLI USAGE, the copy-forward template, `c64-program-recon/SKILL.md`), plus WR-05's other two USAGE drifts (`<project>` -> `<image>` with the three accepted forms; 'beside the project' -> 'beside the store'; the undecodable-payload exit)."
      - "Close WR-01's hole in the new gate: declare each verb's REQUIRED flags beside `POSITIONAL_KINDS` and check them, with a planted omitted-required-flag control -- otherwise the gate built to catch a dead command still cannot see the exact shape (CR-05) it was built for."
  - truth: "CUT-01 -- the r2000 surface's sizing claim is stated in figures that re-derive from the record's own predicate"
    status: failed
    reason: "MEASURED INDEPENDENTLY THIS PASS, with the predicate stated. The requirement was moved to `[x] Complete` on the owner's recorded 2026-08-30 decision and its sentence was rewritten in the same edit (29-17's prohibition honored literally). But the sentence now asserts as measured a figure the record ITSELF says does not re-derive. My predicate, which is the requirement's own: pre-phase set = `git ls-tree -r --name-only 8f21d77 -- src/mcp/vice` filtered `^src/mcp/vice/r2000-.*\\.ts$`; surviving set = the `anno-*` name-descendants of that set plus `absorbed-answer-key.test.ts`, `spawn-seam.test.ts`, `docs-absorbed-decisions.test.ts`; counting `git show <commit>:<path> | wc -l` summed. PRE-PHASE RE-DERIVES EXACTLY: 26,023 = 10,035 non-test + 15,988 test across 35 files at `8f21d77`. SURVIVING DOES NOT: 19,714 at `f16d0b1` (20 descendants = 18,728, plus the three named files = 986), 19,714 at `d30b63e`, 20,960 at HEAD -- so net removal is 6,309, not 10,066. I swept EVERY commit from `8f21d77` to `d30b63e` under this predicate: the surviving figure is never 15,957 at any commit of the phase, so it is not commit drift. Two alternative definitions also miss: all `anno-*.ts` at `d30b63e` = 36,905 over 36 files; content-survival (old lines minus lines deleted across the 20 rename pairs) = 11,611, giving 14,412 removed. No predicate I tried yields 15,957 or 10,066. The SUBSTANTIVE claim is confirmed and is not in dispute: zero `r2000-*.ts` remain under `src/mcp/vice/`, the removal gate is green tree-wide with an EMPTY temporary allow-list. What fails is that a requirement whose whole stated purpose is 'its numbers are the measured ones' carries two numbers that the same entry admits do not reproduce, under a `Complete` checkbox."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: ":128 states 'a net 10,066 lines ... the remaining 15,957 lines surviving under new names' as measured; :132 states in the same entry that the surviving end does NOT re-derive and yields 19,714. The row at :242 reads Complete. A reader cannot act on both halves."
    missing:
      - "Either state the predicate under which 15,957 IS the answer (none of the four tried here produces it), or correct the sentence to the figures that re-derive under the predicate the entry already documents -- 19,714 surviving / 6,309 net removed at `f16d0b1` -- in the same edit that touches the row."
      - "If the owner prefers to keep the decision as made, record it as an explicit verification override (`overrides:` in this file's frontmatter) naming the accepted non-reproducing figure, rather than as a measurement. An override is a documented deviation; a non-reproducing measurement presented as a measurement is not."
deferred:
  - truth: "WR-14 (was WR-09) -- five shipped modules have no production consumer, and one has no consumer at all (anno-d64.ts, anno-symbols.ts, anno-enum-gen.ts, anno-regbits-gen.ts, anno-register.ts)"
    addressed_in: "Phase 30"
    evidence: "`scripts/lib/anno-cli-verbs.mjs:57-60` names the return date in terms -- the enum generator and the two halves of the VICE-label round trip return in Phase 30 as rebuilds over the annotation store, alongside the ACME export oracle. ROADMAP Phase 30 is 'ACME Export and the Real-ACME Oracle'. Confirmed unchanged this pass."
  - truth: "CUT-06 -- no living document points a user at a deleted route"
    addressed_in: "Phase 32"
    evidence: "ROADMAP Phase 32 criterion 2 names CUT-06 over all seven skill playbooks. NOTE: this does NOT absorb the CR-01 drift-semantics texts above, which are kept as a Phase-29 gap -- they do not point at a DELETED route, they misdescribe a LIVE one this phase built, and REPOINT-01/02 are recorded Complete against Phase 29."
prohibitions:
  - statement: "29-13: Never answer a question the surface cannot answer with a number that reads like an answer (a zero, an empty list or a clamped range where the honest answer is 'that is not a question I can answer about this image')."
    status: honored_on_the_mcp_surface_flagged_at_the_cli
    verification: judgment
    evidence: "Re-executed: both read verbs now return `{available:false, reason}` for an out-of-image address and no clamped range survives. FLAGGED, not clean: `render-memmap --check` returns `drifted` -- a verdict that reads like an answer -- for a store that has not changed, which is the same class one layer out. Non-authoritative LLM-judge verdict; human review recommended."
  - statement: "29-14: Never write, keep or restore a comment that asserts a guarantee the code does not provide."
    status: violated
    verification: judgment
    evidence: "VIOLATED at HEAD on three counts, each independently checked: (1) `anno-cli.ts:130-131` USAGE names two causes for a non-zero `--check` and a third exists (path move); (2) `anno-cli.ts:125`/`:136` describe an option default and a positional the code no longer has (WR-05); (3) three headers credit `anno-cli-path-consumers.test.ts` with failing 'when one of them reaches a filesystem call without passing through the seam' while its central assertion is a call-site COUNT with no argument association and no positional coverage (WR-02). Human review recommended -- this is the plan's own prohibition, breached by sites the same round did not sweep."
  - statement: "29-17: Never move a requirement's status row without changing the sentence that row scores."
    status: honored_literally_flagged_in_substance
    verification: judgment
    evidence: "The sentence, the paragraph, the checkbox and the traceability row all moved in one edit -- literally honored. Flagged because the rewritten sentence carries a figure the same entry records as non-reproducing, which re-creates the disagreement the prohibition exists against, inside one entry rather than between two."
---

# Phase 29: The MCP Surface — Verification Report (round 2, after gap closure 29-13..29-17)

**Phase Goal:** The store is reachable through a tool family **derived from** Phase 19's `upstream-procedure-manifest.json`, registered proxy-locally and shaped for an agent rather than a cursor — and the family it replaces is **deleted in this same phase**, safely, because every guard that breaks on registration, on the rename and on the deletion moved with the change that broke it, and the removal gate was built and observed biting first.

**Verified:** 2026-08-30T15:20:00Z
**Status:** gaps_found
**Re-verification:** Yes — this replaces the 2026-08-30T08:44:35Z report (4/6, `gaps_found`). Same six must-haves, same denominator.

**How this pass earned its verdict.** Every one of the five claimed closures was re-executed against the shipped code — through `runAnnoTool()` for the two MCP-surface repairs, through `node vice-proxy.ts anno …` for the four CLI repairs, and by re-deriving the CUT-01 figures from the git object store with the predicate stated. The new BLOCKER was reproduced from scratch rather than carried on the reviewer's word. No SUMMARY claim is load-bearing anywhere below.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC-1** Every `curated`/`adapt-to-address-input` verb has a route, every `omit` verb is absent, `r2000_delete_project_enum` is not carried, and the derivation is checked **mechanically** | ✓ VERIFIED | Regression check: `anno-derivation.test.ts` **8 pass / 0 fail / 1 gated skip** (the skip is the live upstream re-hash behind `R2000_UPSTREAM_CLONE`, reported with its reason). Unchanged by the gap round. |
| 2 | **SC-2** The family is registered and the retired one deleted in this same phase, gate built and observed biting first, each guard moved with the change that broke it, **both skill trees re-pointed onto verbs that exist proven against the shipped copy**, no interception to forget | ✗ FAILED | The two clauses that failed last round now **hold** — both dead commands execute. But a **third** documented invocation of the same verb returns a wrong verdict, reproduced here: `render-memmap --check` says `drifted` for byte-identical inputs at a different absolute path while printing the same `render_digest`, and three shipped texts assert the semantics that falsifies. Gap 1. |
| 3 | **SC-3** Backend-agnosticism reads out of the ordered `BACKEND_SEAM_BYPASS_KEYS`; neither manifest gains an entry; `docs/tool-support.md` regenerates byte-identical | ✓ VERIFIED | Re-measured: `stock-dispatch.test.ts:1510` is still the ordered two-entry array with `annoDef.name` second and an order-sensitive `deepEqual` plus a `registrations.length >= 5` floor. `capability-registry.ts` **0** `anno_` hits; `tools-manifest.json` **0** `anno_` hits. Regenerated the table — md5 `bb474489…` **identical before and after**, `git diff` empty. |
| 4 | **SC-4** Registration-time gates move in the registering commit; the three named gates green with nothing deleted; the generator regex and its two duplicate witnesses move together; the module floor re-pointed and **raised** | ✓ VERIFIED | Regression check: `git show --diff-filter=D --name-only 65a28f3` is **empty** — the registering commit still deletes nothing. `ANNO_MODULE_FLOOR = 15 + 1` with its pinned-equals-measured companion at `hostpath-consumers.test.ts:245`/`:279`. All named gates exit 0 (table below). |
| 5 | **SC-5** Derived-not-cached xref/search; `max_results` required with no default; count returned; explicit address, no cursor; a repeated edit **succeeds** reporting no change; a batch pre-validates and returns per-item status; an ambiguous request **refuses by name** rather than a plausible-looking zero | ✓ VERIFIED | The seventh clause — the one that failed last round — is **closed and re-executed**: `anno_disassemble` on an out-of-image address now returns `{available:false, reason:"…not entirely inside the image…"}`, the identical verdict `anno_read_region` gives, and the incoherent `end_address`/`instructions:0` pair is **structurally absent**. All six other clauses re-executed and hold (spot-check table). |
| 6 | **CUT-01** The r2000 surface's sizing claim is stated in figures that re-derive | ✗ FAILED | Pre-phase re-derives **exactly** (26,023 / 10,035 / 15,988 at `8f21d77`). Surviving does **not**: 19,714 at `f16d0b1` and at `d30b63e`, 20,960 at HEAD, never 15,957 at **any** commit in the phase. Row reads `Complete`. Gap 2. |

**Score:** 4/6 truths verified (0 present-but-behavior-unverified)

---

### Truth 2 in detail — what closed, and what replaced it

**Closed, by execution rather than by reading the fix:**

- **`render-memmap` on the documented input.** All four invocations in both trees name `game.annostore` (`c64-program-recon/SKILL.md:255-256`, `templates/memory-map.template.md:11-12`, and the `installer/` twins byte-identical by `diff -q`). Ran it: `render-memmap: wrote …/memory-map.md (1 row(s), 0 [unknown], digest 8550f89a…)`, exit 0.
- **The falsified dated note is DELETED, not amended.** `SKILL.md:271-280` now carries a dated correction that says in terms the earlier note "asserted in the PRESENT TENSE that this verb still read a project file; it was already false when it shipped, and it is DELETED here rather than amended". Zero `regen2000proj` occurrences remain in either tree.
- **`anno coverage <image.prg> --store <store>`.** Ran it end to end on a real `.prg`: exit **0**, `origin $1000, 4 byte(s), payload decoded`, a full three-measure census. Last round this printed a report of zeros and exited 1.
- **Both trees are in sync.** `installer/skills/` is gitignored and regenerated at package time (correct by design); `diff -q` on all three changed files reports no difference.

**What replaced it — reproduced from scratch on this machine:**

```
A digest: 0bc87b17889d51f8057e6ca0be13b638addfbf0beb943470c850ae41d4f97ba7
check in A: {"status":"in-sync"}
B digest: 0bc87b17889d51f8057e6ca0be13b638addfbf0beb943470c850ae41d4f97ba7   <- SAME digest
check in B (identical bytes, different abs path): {"status":"drifted","line":3,
  "expected":"  store: …/wsB/game.annostore","actual":"  store: …/wsA/game.annostore"}
```

Two byte-identical trees, the same content digest printed by both, and a `drifted` verdict. The gate contradicts its own artifact. `computeRenderDigest()` covers the store rows, the sidecar bytes and `RENDERER_VERSION` — deliberately **not** the paths — while `checkRenderedMemoryMap()` compares the whole file byte for byte including the banner that carries them. Three shipped texts tell the reader that a non-zero `--check` means a hand edit **or** a store change; here it means neither, and the template's stated remedy ("the fix is always to re-run the generator") writes this machine's absolute paths into a file meant to be committed.

**Attribution, stated precisely because the record should not blame the wrong round.** The `store:` half is **not** new: at `e776be7^` (pre-29-14) `cmdRenderMemmap()` already passed `storePathWithinWorkspace(store, …)` — a realpath — and the banner already pushed it verbatim. Plan 29-14 extended the same defect to the `sidecar:` line by confining `--provenance` (a correct, necessary fix). So this is a Phase-29 defect present since 29-12 built the verb, **widened** by the gap round, and surfaced by it. It is scored against criterion 2 and against REPOINT-01/REPOINT-02, because those are the claims that carry "the shipped copy documents what the verb does".

---

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-14 (was WR-09) — five shipped modules with no production consumer | Phase 30 | `scripts/lib/anno-cli-verbs.mjs:57-60` names the return in terms; ROADMAP Phase 30 is the ACME export rebuild. Re-confirmed unchanged. |
| 2 | CUT-06 — no living document points a user at a deleted route | Phase 32 | ROADMAP Phase 32 criterion 2. **Does not absorb gap 1**: those texts misdescribe a LIVE verb this phase built, not a deleted route. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/mcp/vice/anno-tools.ts` | Curated surface + never-throw runner, both MCP-04 defects repaired | ✓ VERIFIED | Re-executed: out-of-image refusal on both read verbs, nested batch validates+executes at depth 2, depth 5 refused by name. Tests exist and are named for the findings (`:823`, `:846`, `:1352`, `:1409`). |
| `src/mcp/vice/anno-cli.ts` | Every caller-supplied path through the one confinement seam; `--force`; no content disclosure | ✓ WIRED (prose stale) | Four escapes re-tested and all refused. `--force` present and gating. **USAGE is stale** (WR-05) and states the falsified drift semantics — folded into gap 1, not scored as a separate artifact failure. |
| `src/mcp/vice/anno-memmap-render.ts` | Store-backed renderer + drift gate | ✗ DEFECTIVE | Banner (`:462-463`) carries absolute paths into a byte comparison (`:601-603`). Also carries the literal NUL byte (WR-04). |
| `src/mcp/vice/anno-coverage.ts` | Coverage reads the live image forms | ✓ VERIFIED | `.prg`/`.raw`/`.bin` dispatch; four named tests (`:4843`, `:4855`, `:4867`, `:4898`) including an agreement test against `anno-tools`' own `loadImage()`. |
| `scripts/check-skill-cli-invocations.mjs` + `scripts/lib/anno-cli-invocations.mjs` | Argument-check every documented CLI invocation | ⚠️ PARTIAL | Exists, wired into CI at `.github/workflows/ci.yml:215`, exit 0, 10 invocations across 2 trees. **Blind to an omitted REQUIRED flag** — planted `anno coverage game.prg` and the gate stayed green (WR-01). Closes the previous round's "missing" item only in part. |
| `src/mcp/vice/anno-cli-path-consumers.test.ts` | Closed consumer set for the CLI's paths | ⚠️ WEAKER THAN CITED | 9 tests, but the central assertion is a call-site **count** (`6 >= 6`) with no argument association and no positional derivation. Three headers credit it with more (WR-02). |
| `scripts/check-no-regenerator2000.mjs` | The removal gate | ✓ VERIFIED | exit 0, empty temporary allow-list. Cites the NUL-byte offset as `anno-memmap-render.ts:12862`; measured offset is **byte 15074, line 315** (WR-04). |
| `docs/tool-support.md` | Regenerates byte-identical, no `anno_` entry | ✓ VERIFIED | md5 identical before/after regeneration; `git diff` empty. |
| `src/skills/**` + `installer/skills/**` | Re-pointed onto verbs that exist | ⚠️ PARTIAL | Both previously-dead commands run. The `--check` line in three files describes behaviour the code does not have. |
| `.planning/REQUIREMENTS.md` (CUT-01) | Figures that re-derive | ✗ FAILED | Two of three do not reproduce under the entry's own predicate. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `vice-proxy.ts` | `anno-tools.ts` | `import` at `:194`, loop at `:3388-3389` through `buildViceTool()` | ✓ WIRED | Unchanged two-line substitution. |
| `anno-tools.ts` | `forwardToVice()` / `rewriteArguments()` / `hostpath.ts` | — | ✓ ABSENT BY CONSTRUCTION | Re-measured: **zero** `anno-*.ts` modules import `hostpath.ts`. CLAUDE.md's four cited offsets still exact at HEAD: `forwardToVice` `:2985`, `rewriteArguments` `:3050`, `gatherWedgeEvidence` `:1505`/`:1529`. |
| `anno-cli.ts` (`--out`, `--provenance`, positionals) | `storePathWithinWorkspace()` | direct call before any filesystem touch | ✓ WIRED | The link that was NOT wired last round. Re-tested all four escape shapes; all refused by name. |
| `anno-memmap-render.ts` banner | `checkRenderedMemoryMap()` byte comparison | absolute paths written into the compared bytes | ✗ WIRED WRONG | The link that should not exist. Machine identity leaks into a content comparison. |
| `check-skill-cli-invocations.mjs` | `anno-cli.ts`'s `VERB_OPTIONS` / `POSITIONAL_KINDS` | flag + extension check | ⚠️ PARTIAL | No required-flag edge. |
| CI | `check-skill-cli-invocations.mjs` | `.github/workflows/ci.yml:215` | ✓ WIRED | Runs in CI. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `anno_get_symbols` | `symbols`, `returned`, `matched`, `truncated` | `anno_label` via `openStore` | Yes — a written label read back, `revision` advancing | ✓ FLOWING |
| `anno_search` | `corpora.{labels,comments,instructions}` | decoders + store, per query | Yes | ✓ FLOWING |
| `anno_get_cross_references` | `callers`, `total`, `truncated` | `crossReferencesTo()`, nothing written | Yes | ✓ FLOWING |
| `anno_get_address_details` | `labels`, composed record | store + `parsePrg` | Yes — returned the label written moments earlier | ✓ FLOWING |
| `anno_disassemble` | `available`, `reason` (out of image) | `sliceSpan()` made total | Yes — refusal, no fabricated range | ✓ FLOWING (was HOLLOW) |
| `anno coverage` | census over payload bytes | `loadProjectImage()` on a real `.prg` | Yes — `payload decoded`, 4 of 4 bytes censused | ✓ FLOWING (was DISCONNECTED) |
| `render-memmap --check` | `status` verdict | fresh render vs disk, **including machine paths** | **No** — verdict determined by checkout location, not content | ✗ HOLLOW |

---

### Behavioural Spot-Checks

Driven through the production entry points (`runAnnoTool()` and `node vice-proxy.ts anno …`) against a real store and a real `.prg`. All probes were written under `.tmp-verify/`, which was removed; `git status` is unchanged from session start.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Out-of-image refusal, region verb | `anno_read_region {$9000..$9010}` on a `$1000..$1003` image | `{"available":false,"reason":"…not entirely inside the image…"}` | ✓ PASS |
| **Out-of-image refusal, disassemble verb (old CR-01)** | `anno_disassemble {address:$9000}` on the same image | `{"available":false,"reason":"anno_disassemble was asked for …not entirely inside the image…"}` — **same verdict as its sibling** | ✓ **PASS (was FAIL)** |
| In-image disassemble still answers | `anno_disassemble {address:$1000}` | `instructions:2`, real ACME listing with a truncation note | ✓ PASS |
| **Nested batch with documented inheritance (old CR-06)** | `anno_batch_execute{store, calls:[{name:"anno_batch_execute", …}]}` | `isError:false`, inner and grandchild both `status:"success"`, store inherited | ✓ **PASS (was FAIL)** |
| Depth cap refuses by name | 5-deep nest | `refused: nesting deeper than 4 levels -- refused BY NAME rather than walked` | ✓ PASS |
| **`--out` escape (old CR-02)** | `render-memmap … --out /tmp/…/VICTIM.md` | `store path "…VICTIM.md" is outside the workspace root … refusing`, exit 1, **victim file untouched** | ✓ **PASS (was FAIL)** |
| **`--provenance` read oracle (old CR-03)** | `render-memmap … --provenance /tmp/…/secret.env` | refused by the seam, exit 1 | ✓ **PASS (was FAIL)** |
| **Parse-failure content disclosure (old CR-03)** | `--provenance <non-JSON file INSIDE the workspace>` | `is not valid JSON. The underlying parser message is deliberately NOT included -- it quotes the file's own bytes (CR-03).` | ✓ **PASS (was FAIL)** |
| **Overwrite safety (old WR-08)** | `render-memmap` twice to the same `--out` | 2nd: `refusing to overwrite … pass --force`, exit 1; with `--force`: exit 0 | ✓ **PASS (was FAIL)** |
| `coverage --out` escape | `coverage … --out /tmp/…` | refused by the seam, exit 1 | ✓ PASS |
| **Playbook's `render-memmap` command (old CR-04)** | `anno render-memmap <store> --provenance <sidecar>` | `wrote …/memory-map.md (1 row(s), 0 [unknown], digest 8550f89a…)`, exit 0 | ✓ **PASS (was FAIL)** |
| **Playbook's only measurement command (old CR-05)** | `anno coverage game.prg --store <store>` | exit **0**, `payload decoded`, full three-measure census | ✓ **PASS (was FAIL)** |
| `max_results` REQUIRED, no default | `anno_get_symbols {store}` | `"max_results" must be a positive integer, got undefined -- it is REQUIRED and has no default on this surface` | ✓ PASS |
| Count returned so truncation is detectable | `anno_get_symbols {store, max_results:10}` | `{"returned":0,"matched":0,"truncated":false}` | ✓ PASS |
| Repeated edit SUCCEEDS reporting no change | `anno_set_label_name` twice, same args | 1st `changed:true`, 2nd `isError:false, changed:false` | ✓ PASS |
| Batch pre-validates every inner name | valid call + `anno_nope` | `refused WHOLE: calls[1].name "anno_nope" is outside the curated anno_* tool surface (D-33)` | ✓ PASS |
| Explicit addressing, no cursor | `anno_get_address_details {address}` | answers by address; no cursor verb on the surface | ✓ PASS |
| **`--check` on identical bytes at a different path** | render under root A, copy, `--check` under root B | `{"status":"drifted","line":3}` with **identical `render_digest`** in both | ✗ **FAIL (CR-01, NEW)** |
| **Invocation gate vs omitted required flag** | plant `anno coverage game.prg` at `routine-queue-walker/SKILL.md:241`, run the gate | `check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) …`, exit **0** | ✗ **FAIL (WR-01)** |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no PLAN or SUMMARY declares one. The phase's runnable-check equivalents are its CI gates, each executed in this verifier's own process.

| Gate | Command | Result | Status |
|---|---|---|---|
| Removal gate | `node scripts/check-no-regenerator2000.mjs` | exit **0** — temporary allow-list asserted EMPTY | ✓ PASS |
| Skill tool coverage | `node scripts/check-skill-tool-coverage.mjs` | exit **0** | ✓ PASS |
| **Skill CLI invocations (new this round)** | `node scripts/check-skill-cli-invocations.mjs` | exit **0** — 10 invocations, 2 verbs, 2 trees | ✓ PASS (hole: WR-01) |
| npm package contents | `node scripts/check-npm-packages.mjs` | exit **0** — 78 / 34 files, 7 skills | ✓ PASS |
| Skill fork honesty | `node scripts/check-skill-fork-honesty.mjs` | exit **0** — 11 fork-only mentions, 24 names policed | ✓ PASS |
| Skill description overlap | `node scripts/check-skill-description-overlap.mjs` | exit **0** — 21 pairs, max 0.250 vs 0.35 | ✓ PASS |
| Table byte-identity | `node scripts/generate-tool-support-table.mjs` then md5 | `bb474489…` unchanged; `git diff` empty | ✓ PASS |
| Docs/audit gate | `node scripts/audit-gate.mjs` | exit **1** before this report existed (cascade of the undispositioned `29-REVIEW.md`); re-run after writing it: **exit 0** — 9 docs guards green, 7 milestone audits scanned | ✓ PASS (after) |
| Regression suite | `npm run test:automated` | 2734 tests, **2726 pass / 2 fail** before this report existed; re-run after writing it: **2728 pass / 0 fail**, and `docs-review-disposition.test.ts` 7/7 | ✓ PASS (after) |
| Derivation check | `node --test anno-derivation.test.ts` | 8 pass / 0 fail / 1 gated skip | ✓ PASS |

**The two suite failures and their discharge.** `not ok 674` (D-12-02, milestone audit gated while a docs guard is red) and `not ok 1110` (AUDIT-01, every REVIEW.md finding id has a recorded disposition) have **one** cause, which I isolated rather than assumed: running the guard alone names exactly **`WR-15` and `WR-16`** as the undispositioned ids — every other id in `29-REVIEW.md` was already named in a phase artifact. This is the documented self-discharging condition: `dispositionTextForPhase()` treats `*-VERIFICATION.md` as a disposition source, so naming both ids below clears it. The identical suite is 0/2734 at the commit before the REVIEW.md commit — no code regression. **Against `29-BASELINE.md`'s failing-file SET the phase is clean on the automated arm**, with `r2000-session.test.ts`'s 5 baseline failures gone **by construction** (29-10 deleted the file), reported rather than banked, and `vice-proxy.test.ts` in `MANUAL_ONLY_TESTS` and not measured (the full glob does not terminate on this host without a live broker; the broker was DOWN, which is the correct state for measurement).

---

### Requirements Coverage

All twelve declared IDs are claimed by at least one plan; **no orphans**, and no plan declares an ID outside the phase's twelve.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| MCP-01 | 29-03, 29-06, 29-08 | ✓ SATISFIED | Derivation check re-run mechanically in both directions, 8/8. |
| MCP-02 | 29-01, 29-10, 29-11 | ✓ SATISFIED | Registration loop at `vice-proxy.ts:3388-3389`; zero `hostpath.ts` imports measured; CLAUDE.md's four line citations still exact. |
| MCP-03 | 29-01, 29-11 | ✓ SATISFIED | Ordered allow-list with a length floor; 0 `anno_` in either manifest; table byte-identical. |
| MCP-04 | 29-03, 29-06, **29-13** | ✓ SATISFIED (was BLOCKED) | Both defects re-executed and closed; named tests exist for each (`anno-tools.test.ts:823`, `:846`, `:1352`, `:1409`). |
| MCP-05 | 29-01, 29-02, 29-05, 29-07, 29-08, 29-09 | ✓ SATISFIED | `65a28f3` still deletes nothing; floors raised not lowered; gates green. |
| STORE-06 | 29-04, 29-07, 29-11 | ✓ SATISFIED | Derived per query, nothing written; `max_results` required with counts returned. |
| REPOINT-01 | 29-09, **29-14**, **29-15**, **29-16** | ⚠️ **PARTIAL** (was BLOCKED) | Both dead commands now run — the specific blockage is gone. Not full: a third documented invocation of the same verb (`--check`) returns a wrong verdict and three shipped texts describe it wrongly. |
| REPOINT-02 | 29-09, **29-15**, **29-16** | ⚠️ **PARTIAL** (was BLOCKED) | The shipped twin is byte-identical to the canonical tree (`diff -q` clean), so the corrected commands ARE in the shipped copy — and so is the falsified `--check` prose, including in the template copied into every new project. |
| CUT-01 | 29-10, 29-12, **29-17** | ✗ **BLOCKED** | Row reads `Complete`; two of its three figures do not re-derive under its own predicate. Gap 2. |
| CUT-02 | 29-02 | ✓ SATISFIED | Gate green with an empty temporary allow-list; three scope-class plants were observed biting last round and the gate is unchanged. |
| CUT-03 | 29-02 | ✓ SATISFIED | Attribution non-vacuity assertion intact; gate exit 0. |
| CUT-05 | 29-09 | ✓ SATISFIED | Fork-honesty gate exit 0 with the re-pointed assertion. |

---

### Decision Coverage

Non-blocking gate. All 17 `29-CONTEXT.md` decisions (`D-01`…`D-17`) remain traceable into shipped source, scripts or artifacts; the gap round added no new decisions and retired none. **Honored: 17/17. Not honored: none.** `D-17` (the `render-memmap` rebuild) is again the sharpest: the phase rebuilt the verb, corrected the playbook that lied about it, and still ships a drift gate whose own documentation asserts a semantics the code does not have.

---

### Test Quality Audit

| Area | Finding | Verdict |
|---|---|---|
| Disabled tests on requirements | Zero `it.skip` / `describe.skip` / `todo` in any `anno-*.test.ts`. The single skip in the whole automated run is `anno-derivation.test.ts`'s live upstream re-hash, gated on `R2000_UPSTREAM_CLONE` and reported with a reason. | ✓ CLEAN |
| Circular expected values | `writeFileSync` in the `anno-*` tests builds temp stores and fixture images; no generator script imports a system under test to produce assertions. | ✓ CLEAN |
| Assertion strength | Value- and behaviour-level. The gap round's new tests are named for the findings they close and assert the verdict, not the shape — e.g. "both read verbs return the SAME `{available:false}` verdict", "the incoherent range is STRUCTURALLY absent", "a depth-1 nested batch … validates AND executes". | ✓ STRONG |
| **A test that pins the defect** | `anno-memmap-render.test.ts:378` asserts the banner equals `  sidecar: ${provenancePath}` (an absolute path) and `:439` asserts the markdown *includes* it. The suite therefore **locks in** the machine-dependence CR-01 reports, and no test renders under one root and checks under another. This is the mechanism by which the blocker shipped green. | 🛑 BLOCKER → gap 1 |
| **A gate weaker than its citations** | `anno-cli-path-consumers.test.ts`'s central assertion is `seamCallCount(src) >= CLI_PATH_ARGUMENTS.length` — a count that cannot distinguish "six arguments each confined once" from "five confined, one twice, one raw", and derives only flags (from `VERB_OPTIONS`), never positionals. Three headers credit it with per-argument association. | ⚠️ WARNING (WR-02) |
| **A gate blind to its own class** | The new invocation gate reported OK for a planted documented command missing a REQUIRED flag. | ⚠️ WARNING (WR-01) → folded into gap 1 |
| Guard weakness worth recording | `module-classification.ts`'s citation guard degrades to existence-and-non-blank when a prose site does not name its symbol on the same line — found independently by 29-15 and 29-16 this round. This is the mechanism by which citation rot (WR-04's stale NUL offset, WR-05's stale USAGE) passes green. Not a Phase-29 gap; a standing weakness a later phase should close. | ℹ️ INFO |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| all 22 non-`.planning/` files changed since `d30b63e` | — | `TBD` / `FIXME` / `XXX` | — | **None found.** Debt-marker gate clean. |
| `src/mcp/vice/anno-memmap-render.ts` | 462-463, 601-603 | Machine identity written into a content comparison | 🛑 BLOCKER | Gap 1 / CR-01. |
| `src/mcp/vice/anno-cli.ts` | 125, 130-131, 136-153 | USAGE asserts an option default, a positional and a drift semantics the code does not have | 🛑 BLOCKER | Gap 1 / WR-05. `--help` is the only route by which a CLI caller learns what to pass. |
| `src/skills/c64-program-recon/templates/memory-map.template.md` | 16-19 | The falsified drift claim, in the file copied into every new project, with a remedy that churns the artifact | 🛑 BLOCKER | Gap 1 / CR-01. |
| `.planning/REQUIREMENTS.md` | 128 vs 132 | A `Complete` row whose sentence states a figure the same entry records as non-reproducing | 🛑 BLOCKER | Gap 2. |
| `src/mcp/vice/anno-memmap-render.ts` | 315 (byte 15074) | A literal NUL byte in a shipped source file; the removal gate cites the offset as `:12862` at `check-no-regenerator2000.mjs:815` and again in its header | ⚠️ WARNING | WR-04. Measured both numbers this pass. A plain `grep` silently skips this file. |
| `scripts/lib/anno-cli-invocations.mjs` | 216-251 | Required flags unchecked, flag values unkinded | ⚠️ WARNING | WR-01. |
| `src/mcp/vice/anno-cli-path-consumers.test.ts` | 131-141, 229-243 | Aggregate count credited as per-argument association | ⚠️ WARNING | WR-02. |
| `scripts/check-npm-packages.mjs` | 161-171, 394 | Whole gate behind an unasserted entry-point heuristic whose failure mode is silence + exit 0 | ⚠️ WARNING | WR-03. Correct today (verified exit 0, 78/34 files). |
| `src/mcp/vice/anno-derive.ts` | 459-462 | `corpusEnabled()` returns `flag !== false`, so the string `"false"` ENABLES a corpus | ⚠️ WARNING | WR-06. A JSON string where a boolean was meant is a common LLM argument error. |
| `src/mcp/vice/anno-derive.ts` | 565-571 | `corpora.<name>.entries` means "true size" for two corpora and "0 because unmeasured" for the third | ⚠️ WARNING | WR-07. |
| `src/mcp/vice/anno-store.ts` | 290-296 | `unique(address, bank)` enforces nothing while `bank` is null | ⚠️ WARNING | WR-08. Invariant rests on the guarded write path alone. |
| `src/mcp/vice/anno-store.ts` | 293, 3389-3403 | `references anno_enum(id)` inert without `pragma foreign_keys=ON`; `listEnumUsage()`'s inner join hides it | ⚠️ WARNING | WR-09. |
| `src/mcp/vice/anno-tools.ts` | 1608, 1647-1689 | Four structural collections returned whole, ungoverned by `max_results` | ⚠️ WARNING | WR-10. |
| `src/mcp/vice/anno-tools.ts` | 407-426 | Schema says "workspace-relative"; resolution is against `process.cwd()` | ⚠️ WARNING | WR-11. Fails safe. |
| `src/mcp/vice/anno-tools.ts` | 1495-1514 | Inode guard compares `ino` without `dev` | ⚠️ WARNING | WR-12. One field, in a repo built around bind mounts. |
| `src/mcp/vice/prg-image.ts` | 69-78 | `parsePrg()` accepts a load address whose payload runs past `$FFFF` | ⚠️ WARNING | WR-13. |
| `src/mcp/vice/package.json` | 56-73 | Five modules with no production consumer still in `files[]` | ⚠️ WARNING | WR-14 — **deferred to Phase 30** on recorded evidence. |
| `scripts/check-no-regenerator2000.mjs` | 782-789 | `exemptionFor()` `return null`s inside the class loop instead of `continue`ing | ⚠️ WARNING | WR-15 — **deferred on record** (`29-16-PLAN.md:138`, explicitly not folded in). |
| `src/mcp/vice/vice-proxy.ts`, `src/mcp/vice/anno-cli.ts` | `:307` (`runR2000Cli`), the `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` hatch | Retired vocabulary in two INTERNAL identifiers | ⚠️ WARNING | WR-16 — **deferred on record**. The user-facing half and both stale cross-references shipped in 29-16; the two renames were dropped on a measured decision (`29-16-PLAN.md` § `<wr14_scope_decision>`) because their real consumer set is a ~26-call-site rename in `anno-cli.test.ts` plus a guarded record in `module-classification.ts`. Their correct home is a pass that owns `anno-cli.test.ts`. |

**Blockers:** 4 (folded into gaps 1-2). **Warnings:** 16. **Debt markers:** 0.

---

### Code Review Disposition — every finding id in `29-REVIEW.md` (1 BLOCKER / 16 WARNING / 0 INFO)

The two red suite assertions named exactly **WR-15** and **WR-16** as undispositioned. All seventeen are dispositioned here, each to one of four outcomes: **OPEN-AS-GAP**, **OPEN-AS-WARNING** (recorded, not blocking this phase), **DEFERRED-ON-RECORD** (a prior recorded decision, cited), or **DEFERRED-TO-PHASE**.

| Id | Subject | Disposition |
|---|---|---|
| **CR-01** | `render-memmap --check` reports drift on an unmodified store at a different absolute path | **OPEN-AS-GAP (gap 1).** Independently reproduced by this verifier: identical bytes, identical `render_digest`, `{"status":"drifted","line":3}`. Blocking. |
| **WR-01** | Invocation gate cannot see an omitted REQUIRED flag | **OPEN-AS-GAP (gap 1, `missing` item 4).** Independently reproduced by planting `anno coverage game.prg`; gate green, exit 0. Reverted. |
| **WR-02** | `anno-cli-path-consumers.test.ts` is a call-site count, blind to positionals | **OPEN-AS-WARNING.** Confirmed by reading: `seamCallCount()` + `confinesAtLeast(6)`, `Object.entries(VERB_OPTIONS)` is flags-only. No slack today (6 real sites, verified), so not blocking — but the property three headers credit it with is not the property it checks. |
| **WR-03** | `check-npm-packages.mjs` behind an unasserted entry-point heuristic | **OPEN-AS-WARNING.** Gate verified passing today (exit 0). The objection is the silent-exit-0 failure mode, not the current value. |
| **WR-04** | A literal NUL byte in a shipped source file; the gate cites a stale offset twice | **OPEN-AS-WARNING.** Measured this pass: NUL at **byte 15074, line 315**; the gate cites `:12862` at `check-no-regenerator2000.mjs:815` and repeats the hazard in its header at `:65-67`. Cheap to fix (escape sequence in the separator literal, then re-pin the citation). Recorded because a plain `grep` silently skips this file and that has already produced one false decision in this repo. |
| **WR-05** | USAGE drifted from the code 29-12 and 29-16 changed | **OPEN-AS-GAP (gap 1).** Verified verbatim at `anno-cli.ts:125` ("beside the project"), `:136` (`coverage <project>`) and `:130-131` (the two-cause drift claim). Folded into gap 1 because the third bullet is CR-01's prose half. |
| **WR-06** | `search_*` flags accept any non-`false` value | **OPEN-AS-WARNING** (was WR-03 in the prior report; carried forward unchanged). |
| **WR-07** | `corpora.<name>.entries` means two different things | **OPEN-AS-WARNING** (was WR-06; carried forward). |
| **WR-08** | `unique(address, bank)` enforces nothing for the rows this code writes | **OPEN-AS-WARNING** (was WR-01; carried forward). |
| **WR-09** | `references anno_enum(id)` inert; `listEnumUsage()`'s inner join hides it | **OPEN-AS-WARNING** (was WR-02; carried forward). |
| **WR-10** | Four structural collections ungoverned by `max_results` | **OPEN-AS-WARNING** (was WR-04; carried forward). |
| **WR-11** | `store`/`image` documented workspace-relative, resolved against `process.cwd()` | **OPEN-AS-WARNING** (was WR-05; carried forward; fails safe). |
| **WR-12** | Inode guard compares `ino` without `dev` | **OPEN-AS-WARNING** (was WR-11; carried forward). |
| **WR-13** | `parsePrg()` accepts a payload running past `$FFFF` | **OPEN-AS-WARNING** (was WR-12; reproduced by the reviewer against the current tree; carried forward). |
| **WR-14** | Five shipped modules with no production consumer | **DEFERRED-TO-PHASE 30** (was WR-09). Return date already recorded in shipped code at `scripts/lib/anno-cli-verbs.mjs:57-60`; ROADMAP Phase 30 is the rebuild. |
| **WR-15** | The removal gate's `exemptionFor()` short-circuits inside the class loop | **DEFERRED-ON-RECORD** (was WR-13). `29-16-PLAN.md:138` names it "explicitly NOT folded in". Correct today only by array order; harmless until a class is appended after the block-scoped ones. Not open, not silently dropped. |
| **WR-16** | Retired vocabulary survives in two internal identifiers (`runR2000Cli`, `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`) | **DEFERRED-ON-RECORD** (was WR-14, partially discharged). The user-facing prefixes and both stale cross-references shipped in 29-16 (verified: `runR2000Cli` still at `vice-proxy.ts:307`, so the remainder is real and correctly described). The two renames were dropped on the measured decision in `29-16-PLAN.md` § `<wr14_scope_decision>`; their home is a pass owning `anno-cli.test.ts`. |

---

### Human Verification Required

None as a separate list. This is an infrastructure/tooling phase; its user-facing surface is the shipped playbooks, and every issue there is scored as a gap above rather than as a manual step. No truth is left present-but-behaviour-unverified — every behavioural claim in this report was exercised by running the code.

Two items need an **owner decision** rather than a test, and both live inside the gaps so they cannot be lost:

1. **CUT-01 (gap 2).** Correct the sentence to figures that re-derive under the entry's own predicate (19,714 surviving / 6,309 net removed at `f16d0b1`), or record an explicit `overrides:` entry accepting 15,957/10,066 as a decided-but-unreproducing figure. The row and the sentence must move together, which is the entry's own prohibition.
2. **CR-01's scope (gap 1).** Whether the banner records workspace-relative paths (the reviewer's fix, and the one that makes a committed memory map checkable in CI and in a worktree) or the paths move to stderr entirely.

**Suggested override, if the owner judges CUT-01's figure acceptable as decided:**

```yaml
overrides:
  - must_have: "CUT-01 -- the r2000 surface's sizing claim is stated in figures that re-derive"
    reason: "The 15,957 surviving / 10,066 net figures are the owner's 2026-08-30 decision on the first verification's as-measured numbers. They do not re-derive under any predicate tried (19,714 file-based, 11,611 content-based); accepted as a decided figure with the divergence recorded in REQUIREMENTS.md:132 and 29-17-SUMMARY.md rather than reconciled."
    accepted_by: "henrik"
    accepted_at: "<ISO timestamp>"
```

---

### Gaps Summary

**Four of the five gaps this round set out to close are genuinely closed, and this pass proved it by running the previously-failing case rather than by reading the fix.** `anno_disassemble` now gives the same `{available:false, reason}` verdict as `anno_read_region` for an out-of-image address, with the incoherent range structurally absent. The nested batch validates on the arguments it executes, so the documented store inheritance works at depth and the depth cap has a reachable positive control. All four confinement escapes refuse by name, `--force` gates the overwrite, and the sidecar parse error now says in terms that it withholds the file's bytes. Both documented playbook commands run end to end, in both trees, with the falsified dated note deleted rather than amended. The structural core the last pass praised is unregressed: derivation mechanical 8/8, registration a two-line loop with zero `hostpath.ts` imports, the removal gate green with an empty allow-list, the tool-support table byte-identical, the registering commit still deleting nothing.

**The fifth gap is not closed, and the reason is worth stating precisely.** CUT-01's row moved to `Complete` and its sentence moved with it — 29-17's own prohibition honored to the letter. But the sentence asserts 15,957 surviving and 10,066 removed, and under the predicate the entry itself documents I measure **19,714** at the phase HEAD, at the verification commit, and **20,960** at today's HEAD. I swept every commit in the phase: 15,957 appears at none of them, so this is not commit drift. Two other definitions — all `anno-*.ts` (36,905) and content-survival across the rename pairs (11,611) — miss in both directions. The entry is honest about the divergence, which is to its credit, but honesty about a non-reproducing number does not convert it into a measured one, and the checkbox says it is. **CUT-01 may not stand as `Complete` on this figure.** The fix is cheap and does not touch code: state the predicate that yields 15,957, or correct the sentence to 19,714/6,309 in the same edit as the row.

**And one new BLOCKER, which the gap round widened and this pass reproduced from scratch.** `render-memmap --check` — the drift detector that is the whole point of a generated, committed artifact — reports `drifted` for a byte-identical store, sidecar and rendered file whenever the checkout sits at a different absolute path, while printing the *same* `render_digest` in both runs. The gate contradicts its own artifact. The `store:` half predates plan 29-14; 29-14 correctly confined `--provenance` and thereby extended the same machine-dependence to the `sidecar:` line, so this is a Phase-29 defect that the gap round widened rather than one it invented. What makes it blocking rather than cosmetic is the documentation: three shipped texts — the CLI's own `--help`, the recon playbook, and the template an agent **copies into every new project** — tell the reader a non-zero `--check` means a hand edit or a store change, and prescribe re-running the generator, which writes the current machine's paths into a file meant to be committed so the next machine reds again. That is the same defect class as the CR-04 note this very round deleted for being false in the present tense, and this repo runs GSD with worktree isolation ON, so a differing checkout path is the normal case. The suite could not catch it because `anno-memmap-render.test.ts:378` **asserts** the absolute path into the banner — the test pins the defect.

**Two gate weaknesses ride along and are named rather than absorbed.** The new invocation gate — built precisely to close the previous round's "a name-only floor cannot see a dead command" — went green for a planted documented command missing a REQUIRED flag, which is exactly CR-05's shape one level up. And `anno-cli-path-consumers.test.ts`, cited in three headers as the mechanism that fails when a path reaches a filesystem call unconfined, is an aggregate count with no argument association and no positional coverage. Both are the same failure mode as the seam that shipped CR-02/CR-03: a guard proven thoroughly on the wrong axis.

---

_Verified: 2026-08-30T15:20:00Z_
_Verifier: Claude (gsd-verifier), round 2_
