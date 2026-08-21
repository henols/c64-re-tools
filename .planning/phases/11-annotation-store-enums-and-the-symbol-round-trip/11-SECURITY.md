---
phase: 11
slug: 11-annotation-store-enums-and-the-symbol-round-trip
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-21
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This audit independently re-verified every declared mitigation against the code and, where
feasible, ran the cited tests live (including gated tests against a real `regenerator2000 0.9.20`
and real ACME). It does not accept SUMMARY.md prose as evidence by itself — each row below cites
the grep/read/test-run that produced the verdict. One finding (T-11-PATH-ESCAPE) was verified by
writing and running a proof-of-concept exploit against `resolveStorePath()` directly (no repo file
was modified; the PoC symlink and its target were both removed after the run).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| LLM-authored `tools/call` payload → `runR2000Tool()` | Arbitrary tool names, nested batch payloads, and file paths chosen by a model | Tool name, args, project path |
| a caller-supplied `.regen2000proj` path → a spawned child's argv | Path crosses into a spawned `regenerator2000` process | Filesystem path |
| a name discovered against a running machine → the annotation store → generated ACME source / rendered Markdown | An externally-observed identifier becomes a symbol in assembly source and a Markdown table cell | Label/comment text |
| `memmap.json` prose → generated ACME identifiers | OCR-damaged, human-written text becomes symbol names in assembly source that is then assembled | Register/bit descriptions |
| this repo's code → the `regenerator2000` child process | Untrusted responses, exit codes, stderr | JSON-RPC over stdio |
| a running emulator's monitor socket → this project | Stock's binary monitor serves exactly one client | Binary-monitor protocol frames |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-VACUOUS | Repudiation | `r2000-launch.test.ts` `stripCommentLines()` | mitigate | Substring-based block-close guard; planted-violation test | closed |
| T-11-FALSESUCCESS-ACME | Tampering | `r2000-verify.ts` `acmeVerdict()` | mitigate | Unanimity over ACME lines; refuses on skip/fail/multi-ok | closed |
| T-11-GATE-DRIFT | Repudiation | `r2000-test-gate.ts` | mitigate | Single seam, hard-FAIL under `R2000_BIN=/nonexistent` | closed |
| T-11-D64-TRUNC | Tampering | `r2000-d64.ts` `sectorSlice()` | mitigate | Bounds every read against `image.length`, throws naming sector | closed |
| T-11-D64-NAME | Spoofing | `r2000-d64.ts` `petsciiName()` | mitigate | Strips `0x00`/`0xa0` padding uniformly | closed |
| T-11-RAW-GUESS | Tampering | `r2000-cli.ts` flat-capture dispatch | mitigate | Extension-dispatched before length heuristic | closed |
| T-11-HONESTY-BYPASS | Repudiation | `check-skill-fork-honesty.mjs` | mitigate | Exemption scoped to one line, non-vacuity count == 1 | closed |
| T-11-PKG-CLOSURE | Denial of Service | `check-npm-packages.mjs` | mitigate | Dynamic-import closure walk + `REQUIRED_DERIVED_MODULES` | closed |
| T-11-DOC-OVERCLAIM | Spoofing | `stock-symbols.ts` header | mitigate | Claim scoped to 0.9.20 + named fixture | closed |
| T-11-DOC-DANGLE | Repudiation | ROADMAP/CONTEXT `.vsf` pointers | mitigate | All sites corrected | closed |
| T-11-DOC-DRIFT | Repudiation | CLAUDE.md line citations | mitigate | `docs-linerefs.test.ts`, 3/3 live pass | closed |
| T-11-FALSESUCCESS | Tampering | `r2000-mcp-client.ts` `saveAndVerify()` | mitigate | Independent disk-hash re-read, never trusts child text | closed |
| T-11-VICE | Denial of Service | every spawn in `r2000-mcp-client.ts` | mitigate | `assertNoViceFlag()` on all fixed-builder argv | closed |
| T-11-HANG | Denial of Service | unanswered `tools/call` | mitigate | `DEFAULT_R2000_CALL_TIMEOUT_MS`, bounded per-call | closed |
| T-11-DEMUX | Spoofing | JSON-RPC response correlation | mitigate | Correlate on `id`; unmatched id dropped, never resolved | closed |
| T-11-PHANTOM-DEP | Tampering | direct `@mcp/sdk` import | mitigate | Zero occurrences (grep-verified) | closed |
| T-11-PATH-XLATE (11-04) | Tampering | host/container path translation | mitigate | No hostpath/containerpath import; `hostpath-consumers.test.ts` 7/7 live pass | closed |
| T-11-BATCH | Elevation of Privilege | `r2000_batch_execute` `calls[]` | mitigate | `assertCuratedBatch()` recurses, refuses whole batch, zero-spawn | closed* |
| T-11-UNCURATED | Elevation of Privilege | outer tool name | mitigate | `assertCuratedTool()` is `runR2000Tool()`'s first statement | closed |
| T-11-PATH-ESCAPE | Information Disclosure | `resolveStorePath()` | mitigate | **Closed 2026-08-21 (quick 260821-a86):** `resolveStorePath()`'s ENOENT branch now walks up to the deepest EXISTING ancestor's realpath, rebuilds the candidate from the literal remaining segments, and lstat-guards each remaining segment against being an unresolved (e.g. dangling) symlink — closing the not-yet-existing-leaf bypass while preserving the create path. Pinned by `r2000-tools.test.ts`'s two planted-directory-symlink regression tests (shallow + one level deeper) plus a create-path test for an absent intermediate directory; all pre-existing `resolveStorePath` cases still pass. | closed |
| T-11-PATH-XLATE (11-05) | Tampering | host/container path translation | mitigate | `runR2000Tool()` never reaches `forwardToVice()`; `stock-dispatch.test.ts` 127/127 live pass | closed |
| T-11-FALSESUCCESS (tools) | Tampering | `r2000_save_project` on tool surface | mitigate | Routed through `saveAndVerify()` | closed |
| T-11-D32 | Spoofing | `r2000_get_address_details` | mitigate | Excluded by name + coverage-gate non-vacuity check | closed |
| T-11-PROSE | Repudiation | `r2000_*` names in skill prose | mitigate | `check-skill-tool-coverage.mjs` live run: OK | closed |
| T-11-ENUM-NAME | Tampering | `r2000-enum-gen.ts` → `r2000_create_project_enum` | mitigate | `assertLegalAcmeIdentifier()` on enum+variant names before any spawn; live 23/23 pass incl. real-ACME reassembly | closed |
| T-11-REGBITS-PROSE | Tampering | `r2000-regbits-gen.ts` identifier derivation | mitigate | Unmappable `desc` with no OVERRIDES throws naming address | closed |
| T-11-SILENT-CAP | Repudiation | `search_disassembly` `max_results` default | mitigate | Explicit `max_results` at every call site + truncation signal | closed |
| T-11-MISBIND | Spoofing | pairing pass | mitigate | Adjacent-only (A+2), no dataflow; unpaired count reported | closed |
| T-11-GEN-DRIFT | Tampering | `r2000-regbits.json` | mitigate | Banner records `memmap.json` sha256; 13/13 live pass | closed |
| T-11-GLOBAL-WRITE | Elevation of Privilege | `save_global_enum()` | mitigate | Zero references outside tests (grep-verified) | closed |
| T-11-LEAK | Information Disclosure | `QUESTION.md`/transcript leaking answer | mitigate | Zero hits of the leak-sensitive field in both files (verified) | closed |
| T-11-GUESSABLE | Spoofing | question answerable without store | mitigate | Every field is a stored human judgement (read QUESTION.md) | closed |
| T-11-SEAL-DRIFT | Repudiation | `ANSWER.sha256` vs `ANSWER.md` | mitigate | Recomputed hash matches exactly (independently re-verified) | closed |
| T-11-NESTED-SESSION (11-07) | Denial of Service | nested `claude -p` | mitigate | Structural; asserted in SUMMARY, no nested invocation found | closed-procedural |
| T-11-IMPORT-DISCARD | Repudiation | `importLabels()` | mitigate | Always pairs `--mcp-server-stdio`; disk re-export re-verification; D-28 trap regression-pinned | closed |
| T-11-LBL-SIZE | Denial of Service | `.lbl` reading | mitigate | Reuses `MAX_LABEL_FILE_BYTES`/`LINES`/`SYMBOLS`; 7/7 live pass | closed |
| T-11-LBL-PARSER-DUP | Tampering | third `al C:` parser | mitigate | Zero label-regex occurrences in `r2000-symbols.ts` (verified) | closed** |
| T-11-NAME-INJECT (11-08) | Tampering | discovered name → store → generated ACME/Markdown | mitigate | **Closed 2026-08-21 (quick 260821-a86):** the identifier policy moved to a single seam, `r2000-acme-ident.ts`'s `assertLegalAcmeIdentifier()` (re-exported from `r2000-enum-gen.ts`), now applied pre-spawn on `r2000_set_label_name` (outer dispatch AND batch-inner call, `r2000-tools.ts`'s `assertLegalLabelArg()`) and in `importLabels()` (`r2000-symbols.ts`, before `buildImportLblArgs()`) — REJECT, never sanitize. Pinned by `r2000-tools.test.ts` (six illegal-name shapes + batch smuggling) and `r2000-symbol-roundtrip.test.ts` (illegal `.lbl` name naming its line). | closed |
| T-11-MERGE-DIVERGE | Tampering | incremental `vice_symbols_load` | mitigate | `regenerateAndReload()` replace-not-merge; live walkthrough confirms exactly 2 calls | closed*** |
| T-11-CONTEXT-BLEED | Information Disclosure | plan 11-09's context | mitigate | Files-read list confirms only permitted files read | closed-procedural |
| T-11-RETROFIT | Tampering | `ANSWER.md`/`ANSWER.sha256`/`QUESTION.md` | mitigate | Single commit (21c347a) touches all three; no later edits (git log verified) | closed |
| T-11-VACUOUS-CHECK | Repudiation | comparison test | mitigate | No `existsSync` guard/try-catch; ENOENT/empty-block fails loudly | closed |
| T-11-NESTED-SESSION (11-09) | Denial of Service | nested `claude -p` | mitigate | Structural; files-read list confirms no nested invocation | closed-procedural |
| T-11-GRADE-TYPO | Spoofing | `parseConfidencePrefix()` | mitigate | Throws on non-canonical bracket token; 15/15 pass | closed |
| T-11-GEN-EDIT | Tampering | rendered memory map | mitigate | `render_digest` sha256 over sorted store results + sidecar bytes; 12/12 pass | closed |
| T-11-PLACEHOLDER | Spoofing | provenance sidecar | mitigate | `parseProvenanceHeader()` collects all problems, throws | closed |
| T-11-SKILLPATH | Denial of Service | runtime skills-tree template read | mitigate | Zero-count grep for template filename, test-enforced | closed |
| T-11-SECOND-STORE | Tampering | address-keyed sidecar JSON | mitigate | Rejected in header; grades live in r2000 comments (verified) | closed |
| T-11-TWO-DUMPS | Spoofing | walkthrough artifact | mitigate | "Absent before" precedes discovery; one numbered sequence (read in full) | closed-procedural |
| T-11-SINGLE-CLIENT | Denial of Service | stock's binary monitor | mitigate | One connection per flow (walkthrough read, no second connect) | closed-procedural |
| T-11-FLAG-ORDER | Denial of Service | stock launch argv | mitigate | `-default` before `-binarymonitor` confirmed in transcript argv | closed |
| T-11-NAME-INJECT (11-11) | Tampering | live-discovered name entering store | mitigate | **Closed 2026-08-21 (quick 260821-a86):** same root cause as the 11-08 row above, closed by the same fix — `importLabels()`'s pre-spawn `assertLegalAcmeIdentifier()` check covers exactly this route (a live-discovered name entering via a `.lbl` file). | closed |
| T-11-OVERCLAIM | Repudiation | evidence ceiling | mitigate | "What is/is not proven" section present, read in full | closed-procedural |
| T-11-PROSE-FAKE-TOOL | Spoofing | `r2000_*` names in skill prose | mitigate | `check-skill-tool-coverage.mjs` live run: OK | closed |
| T-11-PROSE-OVERCLAIM | Spoofing | capability claims in feeder skills | mitigate | `check-skill-fork-honesty.mjs` live run: OK | closed |
| T-11-TEMPLATE-HANDFILL | Tampering | `memory-map.template.md` empty rows | mitigate | Fill-in rows removed, replaced by generator pointer (read) | closed |
| T-11-STALE-TARBALL | Repudiation | `installer/skills/` | mitigate | Gitignored, `sync-skills` output diffed identical to source | closed |
| T-11-SC (×12, one per plan) | Tampering | npm/pip/cargo installs | accept | No dependency change in any phase-11 commit (`git show` on each, verified) — see Accepted Risks Log | closed-by-accept |

`*` T-11-BATCH: core refusal-before-spawn property holds. Code review (WR-02/WR-03) found the
refusal surfaces as a **rejected promise**, not this codebase's usual `{isError:true}` shape, and
`assertCuratedBatch()`'s batch-nesting recursion has no depth ceiling (stack-overflow DoS on a
few-hundred-KB payload). Tracked as unregistered flags below, not a reversal of this row's CLOSED
status (no unauthorized tool ever spawns).

`**` T-11-LBL-PARSER-DUP: the "zero-count grep criterion" cited in the plan is not a committed,
standing regression test (the plan's own verification_map lists `npx tsc --noEmit` — typecheck,
not a grep gate). Re-verified independently in this audit (`grep -n "al\\s\|RegExp" r2000-symbols.ts`
→ 0 hits) — true today, but nothing prevents regression if a second parser is added later.

`***` T-11-MERGE-DIVERGE: `regenerateAndReload()` itself is correct and tested, but code review
(IN-02) found it has **no production caller** — no `r2000_*` tool, CLI verb, or skill invokes it.
The property it protects (replace-not-merge) is verified via the manual walkthrough sequence
instead (11-11, confirmed: `vice_symbols_load` occurs exactly twice, never incrementally).

*Status: open · closed · closed-procedural (artifact/assertion-based, not code-control) ·
closed-by-accept*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party — none in this phase)*

---

## Resolved Findings (closed 2026-08-21)

### 1. T-11-PATH-ESCAPE — `resolveStorePath()`'s symlink guard has a confirmed bypass for not-yet-existing targets (WR-01)

**File:** `.claude/mcp/vice/r2000-tools.ts:633-678`

The declared mitigation ("resolve, require `.regen2000proj` extension, refuse escape from
`repoRoot()`, `../../etc/passwd` pinned as a refusal test") is present and closes that literal
attack. But the function's own header comment promises more: "refuse anything that escapes the
workspace root either directly or via a symlink." That broader claim has a live, reproducible
bypass:

- When the final path component does not exist yet (the documented, deliberately-tolerated case —
  `r2000_save_project` creates fresh projects), `realpathSync(resolved)` throws `ENOENT` for the
  whole path. The catch block sets `real = resolved` (the literal, unresolved path) rather than
  resolving the parent directory.
- If an intermediate path component is an **existing directory symlink** already pointing outside
  the workspace root, the literal path still starts with `root`, so `isContained(real, realRoot)`
  passes and the function returns without throwing.

**Verified live** (PoC run during this audit, artifacts removed afterward):
```
symlink: <repoRoot>/wr01-poc-link -> /tmp/.../evil-target
resolveStorePath("wr01-poc-link/pwned.regen2000proj")
=> no throw, returns "<repoRoot>/wr01-poc-link/pwned.regen2000proj"
```
A file write through this path (by the spawned `regenerator2000` child) would follow the symlink
and land outside the workspace with no diagnostic — contradicting both the module's own header
comment and this threat's own "Information Disclosure" category.

**Mitigating context:** planting the symlink requires the attacker to already have write access
inside the repo working tree — at which point they could write outside the workspace directly,
without needing this bypass. Code review (WR-01) independently found and proposed a fix (resolve
the parent directory's realpath, join the literal basename, then contain-check). Rated **WARNING**
by code review, not Critical/Blocker.

**Disposition for this audit:** the mitigation is narrower than claimed in the code's own
documentation → **OPEN**, not closed. Recommend either implementing WR-01's fix, or explicitly
narrowing the module header's claim and adding an accepted-risk entry below.

**Resolution (2026-08-21, quick 260821-a86):** `resolveStorePath()` (`r2000-tools.ts`) was
rewritten so its ENOENT branch (`resolveViaDeepestExistingAncestor()`, new) walks up from the
candidate path to the deepest ancestor for which `realpathSync` succeeds, rebuilds the candidate as
that ancestor's realpath plus the literal remaining path segments, and lstat-guards every remaining
segment against being an unresolved (e.g. dangling) symlink before returning. Regression tests:
`r2000-tools.test.ts`'s two planted-directory-symlink cases (the PoC shape above, and one level
deeper) now throw naming the resolved outside target; a new create-path case proves
`r2000_save_project`'s fresh-file flow still works when an intermediate directory is also absent;
all four pre-existing `resolveStorePath` cases pass unchanged.

### 2. T-11-NAME-INJECT — label names are never validated on the way into the store (confirmed independently, both entry routes)

**Files:** `.claude/mcp/vice/r2000-symbols.ts`, `.claude/mcp/vice/r2000-tools.ts`, `.claude/mcp/vice/r2000-enum-gen.ts`

Independently re-checked per this audit's instructions, not merely relayed from 11-08-SUMMARY.md:

1. `grep -n "assertLegalAcmeIdentifier" r2000-enum-gen.ts` → all call sites are on enum names
   (`createOrUpdateEnum`) or variant names (`sanitizeVariantMap`). **Zero** call sites touch a
   label name.
2. `r2000_set_label_name`'s schema (`r2000-tools.ts`, `R2000_TOOL_DEFINITIONS`) type-checks `name`
   as `string` only — no pattern/format constraint.
3. `stock-symbols.ts`'s `VICE_LABEL_LINE_RE` (used by `parseViceLabelFile()`, which
   `r2000-symbols.ts` reuses for `importLabels()`) accepts any `\S+` after the dot — far looser
   than a legal ACME identifier.
4. **Export-side control checked (per this audit's explicit instruction 4):** none exists. Neither
   `exportLabels()` (`r2000-symbols.ts`) nor `--export_asm`'s own generation path applies
   `assertLegalAcmeIdentifier()` or any equivalent to a label name before it reaches generated ACME
   source. The only identifier check anywhere in the phase is enum/variant-scoped
   (`r2000-enum-gen.ts`).
5. **Blast radius is wider than 11-08-SUMMARY.md recorded.** Independent code review (WR-04, this
   audit cross-checked `r2000-memmap-render.ts:384-431` directly) found `renderMemoryMap()` also
   interpolates `sym.name` and comment `evidence` text into Markdown table cells with **no
   escaping** of `|` or embedded newlines — and `r2000_set_comment`'s own schema documents
   multi-line support, so this is not a hypothetical shape. A label or comment containing `|` or a
   newline corrupts the generated `memory-map.md`'s table structure silently (the drift check would
   catch a *later* re-render as "changed," but never flags the *initial* malformed output as
   broken).

**Severity assessment for this project (ASVS L1):** local dev tool; the untrusted-input source is
either (a) an LLM-chosen tool argument to `r2000_set_label_name`, or (b) a `.lbl` line from a
discovered symbol during live emulator recon. Realistic impact is breaking ACME reassembly or
corrupting a generated Markdown doc — not remote code execution, and not exploitable by a network
attacker (there is no network-facing entry point in this phase). This matches the project's own
verification chain, which rated it **WARNING/non-blocking** three times (11-08-SUMMARY.md,
11-11-SUMMARY.md, 11-VERIFICATION.md) — this audit concurs with that severity assessment but,
per the "narrower-than-claimed" adversarial standard, still reports the underlying register row's
disposition (`mitigate`) as **OPEN**, since the declared mitigation (assertLegalAcmeIdentifier as
"the export-time control") does not exist for the label-name path. This is not a new discovery —
it is the project's own most consistently-tracked residual finding, surfaced independently in three
prior documents and re-confirmed here by direct source read.

**Recommendation:** either (a) implement a label-name identifier check (reject/sanitize/quote
policy decision, explicitly deferred by 11-08 as "a project-wide scope decision"), or (b) formally
downgrade this row to `accept` with a rationale entered in the Accepted Risks Log below, closing the
open state without silently absorbing it.

**Resolution (2026-08-21, quick 260821-a86):** implemented option (a), REJECT policy, per the
Remediation Decision below. The identifier policy was extracted into one seam,
`r2000-acme-ident.ts`'s `assertLegalAcmeIdentifier()` (re-exported from `r2000-enum-gen.ts` for its
existing consumers), and wired into both entry routes named in finding 4 above: `r2000-tools.ts`'s
`assertLegalLabelArg()` runs pre-spawn from both `assertCuratedTool()` (the outer
`r2000_set_label_name` dispatch) and `assertCuratedBatch()` (the batch-inner call, refusing the
whole batch and naming `calls[i]`); `r2000-symbols.ts`'s `importLabels()` validates every name in
the parsed `.lbl` before `buildImportLblArgs()` is called, naming the offending 1-based line number
and its own text. WR-04's separate render-leg finding (point 5 above) was closed independently:
`r2000-memmap-render.ts`'s new `escapeMarkdownCell()` escapes `|` and collapses `\r\n`/`\n`/`\r` to
`<br>` on every store-derived Markdown interpolation (comment evidence, symbol names), and
`RENDERER_VERSION` was bumped `"1"` → `"2"`. Regression tests: `r2000-tools.test.ts` (six illegal
ACME-identifier shapes refused pre-spawn, one legal name accepted, one batch-smuggling case),
`r2000-symbol-roundtrip.test.ts` (an illegal `.lbl` name refused naming its line), and
`r2000-memmap-render.test.ts` (unit cases for `escapeMarkdownCell()` plus a gated case proving
pipe-and-newline-bearing evidence renders as one well-formed row with content preserved).

---

## Unregistered Flags (WARNING — new attack surface found during code review, not blocking)

These surfaced during the phase's own code review (`11-REVIEW.md`) and were independently
re-checked against source during this audit. None maps cleanly to an existing threat-register row;
none was found to allow an unauthorized tool to execute or a child process to be spawned outside
the curated surface (the core STRIDE properties of T-11-BATCH/T-11-UNCURATED/T-11-VICE still hold).

| Flag | File | Description |
|------|------|-------------|
| WR-02: refusal-shape inconsistency | `.claude/mcp/vice/r2000-tools.ts:735-737` (`runR2000Tool`) | `assertCuratedTool()`/`resolveStorePath()` run before the function's own `try` block, so a refused call **rejects** the returned promise instead of resolving with this codebase's usual `{content, isError:true}` shape. If the MCP SDK's wrapper does not catch a rejected `execute()`, the call may hang unresolved from the calling agent's view rather than failing cleanly (confirmed structurally; not exercised against a live MCP client in this audit). |
| WR-03: unbounded batch-recursion depth | `.claude/mcp/vice/r2000-tools.ts:544-578` (`assertCuratedBatch`) | Recursion into nested `r2000_batch_execute` payloads has no depth ceiling — a payload nesting a few hundred `r2000_batch_execute` layers deep can throw `RangeError: Maximum call stack size exceeded` instead of a named refusal, compounding with WR-02's escape from `runR2000Tool()`'s own `try/catch`. |
| WR-05: no `"error"` listener on regenerator2000 child post-spawn | `.claude/mcp/vice/r2000-mcp-client.ts:489-516` (`waitForSpawn`) | The one-shot `"error"` listener is removed on successful spawn and never replaced. A post-spawn `"error"` (e.g. a failed `kill()`) becomes an uncaught exception on an EventEmitter with zero listeners; the global handler keeps the process alive but the specific `withR2000Session()` call never resolves/rejects cleanly. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-11-01 | T-11-SC (all 12 plan instances) | Phase-wide Package Legitimacy Audit (RESEARCH.md) recorded "no new package" for the entire phase; independently verified in this audit via `git show <commit> -- package.json` on every phase-11 commit that touched `package.json` — every diff adds only a `files[]` entry, never a `dependencies`/`devDependencies` change. No `[ASSUMED]`/`[SUS]` legitimacy checkpoint applies. | gsd-security-auditor (this audit) | 2026-08-21 |

*No other risks are accepted. T-11-PATH-ESCAPE and T-11-NAME-INJECT were both FIXED (2026-08-21,
quick 260821-a86), not accepted — see Resolved Findings above for what changed and which tests pin
each fix.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|----------------|--------|------|--------|
| 2026-08-21 | 69 | 66 | 3 (T-11-PATH-ESCAPE ×1, T-11-NAME-INJECT ×2 duplicate rows, same root cause) | gsd-security-auditor |
| 2026-08-21 | 69 | 69 | 0 | quick 260821-a86 remediation (WR-01 / T-11-NAME-INJECT / WR-04) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed — both previously-open root causes (T-11-PATH-ESCAPE's
      symlink-of-nonexistent-leaf gap, T-11-NAME-INJECT's unvalidated label name on both entry
      routes plus WR-04's Markdown-render leg) were FIXED, not accepted, closing all three
      registered `open` rows (2026-08-21, quick 260821-a86)
- [x] `status: verified` — set; all three fixes landed with regression tests pinning each, per the
      Remediation Decision below

**Approval:** approved via this remediation (2026-08-21, quick 260821-a86) — `/gsd-secure-phase 11`
may be re-run to confirm `threats_open: 0` independently

## Remediation Decision (2026-08-21)

**Path chosen: FIX BOTH** (option 1 of the Recommendation below). Recorded at the
`/gsd-secure-phase 11` gate; neither open finding is being accepted.

| Finding | Action | Scope |
|---------|--------|-------|
| T-11-PATH-ESCAPE (WR-01) | Fix | `resolveStorePath()` resolves the **parent** directory's realpath, joins the literal basename, then contain-checks — closing the not-yet-existing-leaf case while preserving `r2000_save_project`'s create path. Regression test plants an intermediate directory symlink pointing outside the workspace and asserts a named refusal. |
| T-11-NAME-INJECT (11-08 / 11-11) | Fix | A label-name identifier policy applied on **both** entry routes (`r2000_set_label_name`, `importLabels()`), plus WR-04's Markdown-cell escaping in `renderMemoryMap()`. |

**Recommended policy for the label-name decision that 11-08 deferred: REJECT, not sanitize or
quote.** Rationale — it matches the control this codebase already chose for the same threat class
one register row over (T-11-REGBITS-PROSE: an unmappable `desc` with no `OVERRIDES` entry *throws
naming the address*; no placeholder, no silent skip), and it matches T-11-ENUM-NAME's
`assertLegalAcmeIdentifier()`, which refuses rather than mangles. Silently sanitizing a label name
would make the store's printed name differ from the exported symbol — the exact
printed-name-vs-selectable-name divergence T-11-D64-NAME was raised to close. A malformed name from
an LLM tool argument is a bug to surface; a malformed name from a `.lbl` line should name the
offending line and refuse.

Note that WR-04's Markdown escaping is a **separate** control, not part of the identifier policy:
comment `evidence` text legitimately contains `|` and newlines (`r2000_set_comment`'s own schema
documents multi-line support), so the render path must *escape*, never reject.

The three unregistered flags (WR-02 refusal shape, WR-03 unbounded batch recursion, WR-05 missing
post-spawn `"error"` listener) are not part of this remediation and remain WARNING/non-blocking.

**Landed (2026-08-21, quick 260821-a86):** both fixes were implemented exactly as scoped above, plus
WR-04's Markdown-cell escaping. `threats_open` is now **0** and `status` is **verified**. Re-run
`/gsd-secure-phase 11` to have the auditor independently confirm this closure.

---

### Recommendation

Neither open finding blocks on exploitability grounds alone (both require either pre-existing
repo write access, or an LLM/live-discovery source choosing a deliberately malformed identifier,
in a local, non-network-facing dev tool) — but per this audit's mandate, a `mitigate`-dispositioned
threat whose declared control is absent from the code must be reported OPEN, not silently closed on
the strength of low real-world exploitability. Two paths forward, either is sufficient to reach
`threats_open: 0`:

1. **Fix:** implement WR-01's parent-realpath fix for `resolveStorePath()`, and decide + implement
   a label-name identifier policy (reject/sanitize/quote) for `r2000_set_label_name` and
   `importLabels()`, extending it to `renderMemoryMap()`'s Markdown-cell escaping (WR-04).
2. **Accept:** add both to the Accepted Risks Log above with an explicit rationale and owner,
   changing their register disposition from `mitigate` to `accept`, then re-run this audit.
