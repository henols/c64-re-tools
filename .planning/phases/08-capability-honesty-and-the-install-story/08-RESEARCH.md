# Phase 8: Capability Honesty and the Install Story - Research

**Researched:** 2026-08-18
**Domain:** MCP tool-surface error handling, generated documentation, and package-manager install story for a two-backend (fork VICE / stock VICE) plugin
**Confidence:** HIGH — every code claim below was re-read from source this session (line numbers are current, not copied from an older doc); the install-story version claims were verified via live web fetches this session; only the VICE `-default`/flag-order finding and the exact wording the planner chooses for new refusal text are lower confidence (flagged inline)

## Summary

Phase 8 has no `CONTEXT.md` (D-A) — the ROADMAP's Phase 8 section is the locked-decision source, and this research fills in the "how." The phase closes the last five open v0.2.0 requirements (`BACK-05`, `DIST-01`, `DIST-02`, `DIST-03`, `SKILL-01`), and every one of them turns out to have a **concrete, already-half-built home** in the current codebase rather than needing new infrastructure invented from scratch:

- **`BACK-05`'s exact bug site is `vice-proxy.ts:3254-3256`** — the `CallToolRequestSchema` override's final fallback (`tools[name]` is `undefined` → `Unknown tool: ${name}`). The trimmed-per-backend manifest (D-07) means a stock user calling a fork-only tool never reaches `dispatchStock()`'s own (already excellent, but currently *unreachable*) refusal at `stock-dispatch.ts:734-738` — the name was never registered into the `tools` record in the first place, because `readManifestTools()` (`vice-proxy.ts:419-451`) reads the *active* backend's manifest only. The fix is entirely in `vice-proxy.ts`'s override, one function, one call site, mirroring the `DENY_LIST`/`denyListRefusalMessage()` precedent exactly.
- **A capability registry does not exist yet, but 3 of its ~26 needed entries already do**, verbatim, with the exact reasons this phase needs — in `scripts/check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` array (lines 141-159). That script's own header comment (line 9-11) explicitly says: *"Phase 8's DIST-01 (a support table DERIVED from the shipped manifests, not maintained by hand) is expected to reuse this same extraction rather than re-deriving it."* This is a direct, load-bearing implementation instruction left by Phase 5's own author for this phase.
- **`DIST-01`'s "derived, not hand-written" mandate (D-D) has an exact working template already in the repo**: `resources-sync.test.ts` (build a fresh copy in a scratch dir, byte-compare against the committed artifact, fail CI on any mismatch). The same shape — generate into memory, diff against a committed markdown file — is the correct mechanism for the manifest-derived support table.
- **`SKILL-01`'s work is smaller than it looks.** Of the six skills, three (`acme-build`, `c64-memory-mapping`, `c64-provenance-diff`) call no fork-only tool and need no changes. `vice-wedge-triage/SKILL.md` was already brought fully up to date by Phase 7 (stopwatch bracket, `vice_diagnose` verdict vocabulary, backend routing) — this research found no gap in it. The real work is four specific *un-annotated* mentions of `vice_keyboard_matrix` across two skills (`c64-program-recon/references/sound-and-input.md:64`, `c64-program-recon/references/observation-hazards.md:103`, `c64-program-recon/SKILL.md:171`, `c64-ram-capture/SKILL.md:158`) that name the tool with no fork-requirement sentence nearby, even though other mentions of the *same* tool and of `vice_sid_get_state`/`vice_keyboard_restore` elsewhere in the same skill tree already do this correctly.
- **`DIST-02`/`DIST-03`'s install story is close to greenfield.** None of the three README files in this repo (root, `.claude/mcp/vice/README.md`, `installer/README.md`) currently mention installing VICE itself, the `VICE_BACKEND` config value, or the fork/stock tradeoff. This is new content, not an edit. Live-checked package-manager versions (this session) confirm CLAUDE.md's existing `CPUHISTORY_GET` ≥ 3.10 claim and extend it across five more ecosystems (see `## Environment Availability`).
- **A pre-existing, repo-wide false-documentation claim was found and should likely be corrected while this phase is touching README.md**: the root `README.md` (lines 123-126) asserts two "repo-wide documentation guardrail tests" (`skill-docs.test.ts`, `vice-mcp-selector-docs.test.ts`) exist "in the originating project." Neither file exists anywhere in this repository (confirmed by repo-wide grep) — every other reference to the same filenames is itself a comment explaining that it's a **ghost reference from a predecessor project** (`QUAL-02`, deferred). This is not a Phase 8 requirement, but it is exactly the "docs claim something untrue" failure Phase 8 exists to prevent, in the same file DIST-02/03 will edit.

**Primary recommendation:** Build one new runtime-importable module, `.claude/mcp/vice/capability-registry.ts` (naming is the planner's call), seeded from `check-skill-tool-coverage.mjs`'s existing `FORK_ONLY_UNRECOVERABLE` entries and extended to the full ~26-tool manifest delta; wire it into `vice-proxy.ts`'s `CallToolRequestSchema` override (`BACK-05`) and into a new `resources-sync.test.ts`-shaped drift-checked generator for the support table (`DIST-01`); fix the four unannotated `vice_keyboard_matrix` mentions (`SKILL-01`); and write new, currently-nonexistent VICE-install + backend-selection content into `README.md` (`DIST-02`/`DIST-03`).

## Orchestrator Constraints (from `/gsd-plan-phase 8` invocation — no CONTEXT.md exists, per D-A)

Copied verbatim from the phase-research task brief, since no `CONTEXT.md` exists for this phase and these decisions play the same "do not re-open" role a locked `CONTEXT.md` decision would:

- **D-A**: No `CONTEXT.md` for this phase. Plan from ROADMAP notes + `REQUIREMENTS.md` + this research. The ROADMAP Phase 8 section carries the locked decisions.
- **D-B**: Phase 8 stays regenerator2000-free. `R2000-16` is NOT pulled forward. Do not research regenerator2000, do not name it in install docs or playbooks, do not treat v0.3.0 as a dependency. (Confirmed: this research names no regenerator2000 content anywhere below.)
- **D-C**: `VERIF-03` (two-process cross-backend parity harness) is out of scope. Byte-identical parity is an explicit non-goal in `PROJECT.md`.
- **D-D**: Criterion 4 must be **derived** from `tools-manifest.json` / `tools-manifest.stock.json`, not hand-written. This research confirms `resources-sync.test.ts`'s generate-and-byte-diff pattern is the right shape and that no comparable guardrail test already exists (the two files README.md claims exist do not — see Summary).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| `BACK-05` | Calling a tool the active backend does not advertise returns an error naming the capability, the reason, and which backend provides it | Exact bug site identified (`vice-proxy.ts:3254-3256`); existing precedent pattern identified (`DENY_LIST`/`denyListRefusalMessage()`, `vice.ts:201-243`); the "already excellent but unreachable" `dispatchStock()` refusal identified as a decoy (`stock-dispatch.ts:732-741`) so the planner does not spend effort there |
| `DIST-01` | Full tool inventory documented with per-backend availability, derived from shipped manifests, including tools absent from the trimmed manifest | Manifest pair fully diffed (62 fork / 38 stock, 24 real fork-only + 2 real stock-only after excluding registration-only artifacts); `resources-sync.test.ts` identified as the drift-check template; `check-skill-tool-coverage.mjs` identified as the reusable classification seed (per its own header comment) |
| `DIST-02` | New user can read what VICE they need, where to get it, and what differs per version, including the fork-required SID/matrix-keyboard exceptions | Package-manager versions verified live across 7 ecosystems this session (`## Environment Availability`); all three existing README files confirmed to currently say nothing about VICE installation or backend choice |
| `DIST-03` | Installing the plugin + stock VICE from a package manager is sufficient to drive the emulator | `VICE_BACKEND` config value confirmed as the one switch (`BACK-01`, already shipped); flag-order gotcha (`-default` before `-binarymonitor`) surfaced from project memory, flagged MEDIUM confidence, relevant to any smoke-test command the install docs give a user |
| `SKILL-01` | Skills whose method depends on fork-only capabilities name the stock route or the fork requirement, at point of use, for `vice_sid_get_state` and `vice_keyboard_matrix` explicitly | Full grep of all six skills for `vice_sid_get_state`/`vice_keyboard_matrix`/`vice_keyboard_restore`; three skills confirmed to need zero changes; four specific under-annotated call sites identified with file:line; `vice-wedge-triage/SKILL.md` confirmed already compliant (Phase 7 work) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runtime capability-honest refusal (`BACK-05`) | MCP proxy (stdio server, `vice-proxy.ts`) | — | The refusal must happen before any transport is touched — it is a dispatch-table lookup miss, not an emulator-side failure. No backend/broker involvement. |
| Capability registry (source of truth for reasons + backend ownership) | MCP proxy source tree (`.claude/mcp/vice/*.ts`) | Root-level `scripts/` (consumer, not owner) | Must be runtime-importable (by `vice-proxy.ts`) AND importable by a plain Node script (the doc generator and the skill-coverage check) — the registry lives in the package that ships it; scripts/ consumes it, never redefines it. |
| Manifest-derived support table (`DIST-01`) | Root-level `scripts/` (generator) + repo docs (`docs/` or `README.md`, output) | `.claude/mcp/vice/` (data source: the two manifest JSON files) | Generation belongs beside `check-skill-tool-coverage.mjs`/`check-npm-packages.mjs`, the existing repo-root doc/package guardrail scripts; the manifests themselves are already `.claude/mcp/vice/`-owned and must not be duplicated. |
| Install documentation (`DIST-02`/`DIST-03`) | Repo docs (`README.md`, package READMEs) | — | User-facing, pre-install content; no code tier owns it. |
| Skill playbook corrections (`SKILL-01`) | Skills layer (`.claude/skills/*/SKILL.md`, `references/*.md`) | — | Playbooks are their own layer per `ARCHITECTURE.md`; they consume the tool surface but are not part of it. |

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md` directly binding on this phase's work (verified current against source this session where a line number is cited):

- **D-07 (Compatibility)**: the stdio MCP surface is trimmed per backend; a tool advertised on both keeps the same name/argument shape; the fork's list is unchanged from v0.1.x. Phase 8 must not widen either manifest to "fix" the divergence — the divergence is the shipped design, and BACK-05/SKILL-01 exist because of it, not to erase it.
- **Architecture (single seam)**: derived tools are intercepted before `forwardToVice()` (currently `vice-proxy.ts:2889`, re-verify at plan time — CLAUDE.md itself notes this drifts) and `gatherWedgeEvidence()`'s own `rewriteArguments()` call (`vice-proxy.ts:1368`, also re-verify). Not directly touched by this phase (no new derived tool is added), but the new capability-registry lookup must sit in the `CallToolRequestSchema` override **before** any tool execution — never inside a handler that could reach `call()`.
- **Testing**: `vice-sync.ts`'s checkpoint-wait functions stay deliberately un-unit-tested (not relevant to this phase's own new code, which is pure string/data lookup and fully unit-testable).
- **Tech stack**: Node ≥ 22.18 native type-stripping, no build step for `vice-proxy.ts` and its siblings. A new `capability-registry.ts` module follows the exact conventions of every other sibling module in `.claude/mcp/vice/` (2-space indent, double quotes, explicit `.ts` extensions on relative imports).
- **GSD Workflow Enforcement**: file-changing work in this repo goes through a GSD command; this research does not itself write code, only documents what the planner needs.

## Standard Stack

No new runtime dependency is needed anywhere in this phase.

- The capability registry, the refusal function, and the doc generator are all pure data/string manipulation over already-parsed JSON (`tools-manifest.json`/`tools-manifest.stock.json`) and Node built-ins (`node:fs`, `node:path`). `DISASM-07`'s "no new runtime dependency" precedent (enforced by `check-npm-packages.mjs`'s dependency-set assertion, `.claude/mcp/vice/package.json:14-24` region) extends naturally here — do not add a markdown-templating library or a diffing library; string templates and `fs.readFileSync`/`assert.equal` are what every existing guardrail script in this repo already uses.
- No documentation-generator framework (e.g. a static-site tool) is warranted — the artifact is one markdown table, generated by one script, following the `resources-sync.test.ts` pattern exactly.

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external package in any ecosystem. All new code is Node built-ins plus existing in-repo modules. Per the package-legitimacy protocol's graceful-degradation clause, this section is intentionally empty rather than fabricated — there is nothing to run `slopcheck`/`npm view` against.

## Architecture Patterns

### System Architecture Diagram

```text
tools/call "vice_sid_get_state" (stock backend active)
        |
        v
vice-proxy.ts: CallToolRequestSchema override (~line 3219)
        |
        +--> DENY_LIST.includes(name)?  --no-->
        |
        v
   tools[name] exists? (tools = manifestTools registered via
   buildBackendAwareTool(), keyed from the ACTIVE backend's manifest only --
   tools-manifest.stock.json on stock, 38 entries)
        |
        +-- YES --> tool.execute() --> dispatchStock()/forwardToVice() (existing, unchanged path)
        |
        +-- NO  --> [NEW] capability-registry lookup(name)
                       |
                       +-- found (known capability, wrong backend)
                       |      --> structured refusal: names the tool, the
                       |          reason, and the OTHER backend that provides it
                       |          (BACK-05)
                       |
                       +-- not found (genuinely unknown tool name / typo)
                              --> unchanged "Unknown tool: ${name}" (regression-
                                  guarded: this path must still fire for real typos)

docs/tool-support.md (or similar, DIST-01)
        ^
        |
scripts/generate-tool-support-table.mjs  (NEW, modelled on
  scripts/check-skill-tool-coverage.mjs's own manifest-read + classification code)
        |
        +-- reads tools-manifest.json (62 tools)
        +-- reads tools-manifest.stock.json (38 tools)
        +-- reads the SAME capability-registry.ts the runtime refusal uses
        |
        v
one generated markdown table: tool | fork | stock | note
        ^
        |
tool-support-table.test.ts (NEW, modelled on resources-sync.test.ts):
  regenerate into memory, byte-diff against the committed docs/tool-support.md,
  fail CI on drift
```

### Recommended Project Structure (new files only; everything else is pre-existing)

```
.claude/mcp/vice/
├── capability-registry.ts       # NEW: name -> {reason, providedByBackend, category}
├── capability-registry.test.ts  # NEW: unit tests for the lookup + message shape
├── vice-proxy.ts                # EDIT: CallToolRequestSchema override gains one lookup
├── vice-proxy.test.ts           # EDIT: add end-to-end refusal-shape assertions
├── package.json                 # EDIT: add "capability-registry.ts" to files[] (Rule 2)
scripts/
├── check-skill-tool-coverage.mjs        # EDIT or left as-is: see Open Question 1
├── generate-tool-support-table.mjs      # NEW: reads both manifests + the registry
docs/
├── tool-support.md              # NEW: generated, committed artifact
├── stock-vice-parity.md         # EDIT: correct the stale vice_joystick_tap
│                                 #   "deferred to Phase 7" note (see Sharp Edges)
README.md                        # EDIT: new "Backend and VICE install" section
```

### Pattern 1: Structured, keyed refusal function (BACK-05)

**What:** One exported function, `capabilityRefusalMessage(name, activeBackend)`, returning `string | undefined` (undefined = "not a known cross-backend capability, fall through to the generic Unknown-tool message"). Mirrors `denyListRefusalMessage()` exactly: one array/map, one message-rendering function, reused at every call site (today: one call site, the `CallToolRequestSchema` override; `dispatchStock()`'s own dead-code refusal at `stock-dispatch.ts:734-738` could optionally be repointed at the same function for consistency, though it is currently unreachable given the bidirectional manifest/dispatch-table agreement test at `stock-dispatch.test.ts:315-323`).

**When to use:** Only at the point where a `tools/call` name lookup misses in the currently-registered `tools` record — never inside a handler, never as a second check duplicating `DENY_LIST`.

**Example (existing precedent to model against, `vice.ts:229-243`):**
```typescript
// Source: .claude/mcp/vice/vice.ts:229-243 (read this session)
export function denyListRefusalMessage(toolName: string): string {
  if (toolName === "vice_disk_list") {
    return (
      `${toolName} is permanently forbidden -- it is known to crash the shared host VICE MCP server ` +
      `(see CLAUDE.md's hazard note). Recovery requires a manual, host-side restart. Refusing to ` +
      `serialise this request; retrying will not help.`
    );
  }
  return (
    `${toolName} is permanently forbidden -- it is a generic-surface meta-tool that can carry a ` +
    `forbidden tool name as a nested argument, bypassing this exact outer-name-only guard (see ` +
    `.planning/todos/pending/2026-08-05-generic-surface-deny-list-gap-tools-call-nested-vice-disk-list.md). ` +
    `It does not itself crash the host. Refusing to serialise this request; retrying will not help.`
  );
}
```
A `BACK-05` analogue should follow the exact same shape — keyed by hazard/reason category, not one wording for all 26 entries — since (per `denyListRefusalMessage()`'s own doc comment) "telling an agent the wrong hazard shape for what is otherwise the same permanent refusal invites a pointless retry."

**Existing "already excellent, but unreachable" reference for wording tone** (`stock-dispatch.ts:734-738`, read this session):
```typescript
// Source: .claude/mcp/vice/stock-dispatch.ts:732-741
export async function dispatchStock(name: string, args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  const handler = stockHandlerFor(name);
  if (!handler) {
    return isErrorText(
      `${name} is not implemented by the stock backend -- the fork backend provides this tool. ` +
        `Set VICE_BACKEND=fork to use it there, or wait for a later phase to extend the stock dispatch table.`,
    );
  }
  return handler(args, deps);
}
```
This wording already names the tool and the providing backend, and even gives the actionable next step (`Set VICE_BACKEND=fork`). It is missing only "the reason" (BACK-05's third required element) — the new function should extend this exact tone/shape with a reason clause per registry entry, and should work symmetrically (stock→fork *and* fork→stock, for `vice_execution_until_return`/`vice_registers_available`).

### Pattern 2: Generate-then-byte-diff for a committed derived artifact (DIST-01)

**What:** `resources-sync.test.ts` already solves exactly this shape for a different artifact (compiled `.mjs` under `resources/`). Read in full this session (`.claude/mcp/vice/resources-sync.test.ts:1-127`):
- `build({ outDir: scratchDir })` regenerates into a `mkdtempSync(tmpdir())` scratch directory.
- Direction 1: every freshly-generated file must byte-match its committed counterpart ("stale committed build").
- Direction 2: every committed generated-looking file must still be reproducible ("orphan").
- The failure messages name the exact fix (`Run \`node build.ts\` and commit the result.`).

**When to use:** For `DIST-01`'s support table, replace `build()` with the new table-generator's exported function, replace the file-tree walk with a single-file read, and replace "generated extension" classification with "this one committed markdown file." A test written this way gives criterion 4 the same CI guarantee `resources-sync.test.ts` gives criterion 3 in Phase "01.6" — this is D-D's requirement satisfied mechanically, not by code review discipline.

### Anti-Patterns to Avoid

- **Do not hand-maintain a second copy of the fork/stock delta.** `scripts/check-skill-tool-coverage.mjs`'s own header comment (line 9-11) explicitly earmarks its extraction for reuse by this phase. Writing a second, independent classification (even with good intentions) creates the exact "two sources of truth" failure `07-REVIEW.md`'s WR-11 finding already burned this project on once (`check-skill-tool-coverage.mjs:104-112`'s own comment narrates that incident).
- **Do not put the capability registry only in a root-level `scripts/*.mjs` file.** It must be runtime-importable by `vice-proxy.ts` (a `.claude/mcp/vice/*.ts` module governed by `package.json`'s `files[]` allow-list and the transitive-closure check in `check-npm-packages.mjs`). If it lives only under `scripts/`, the shipped npm package cannot use it and BACK-05's refusal degrades back to the generic message in production.
- **Do not widen either manifest to close the gap.** D-07 is a standing constraint; the phase's job is honesty about the gap, not erasing it.
- **Do not treat `vice_diagnose`/`vice_recycle` as fork-only-missing capabilities.** They are absent from `tools-manifest.json` (the raw fork file) only because they are registered as **synthetic, proxy-local tools** on both backends (`RECYCLE_TOOL`/`DIAGNOSE_TOOL` literals, `vice-proxy.ts:368-408`, always injected via `buildBackendAwareTool()` regardless of which manifest file is active). A naive JSON set-difference over the two manifest files will surface these two names as "stock-only" — they are not a capability gap at all, and including them in the BACK-05 registry or the DIST-01 support table as a divergence would be a factual error. See "Capability Delta Registry" below for the corrected accounting.

## Capability Delta Registry (the data BACK-05 and DIST-01 both need)

### Step 1: raw manifest diff (mechanically reproducible any time)

```
fork manifest (tools-manifest.json):  62 tools, generated_at 2026-07-31T15:56:00.302Z
stock manifest (tools-manifest.stock.json): 38 tools, generated_at 2026-08-14T00:00:00.000Z
```
Command used this session (repeatable): `python3 -c "import json; ..."` reading both files and set-diffing `name` fields. Raw diff: 28 names in fork-only, 4 names in stock-only.

### Step 2: correct for registration artifacts (not real capability gaps)

Of the 4 "stock-only" names, **2 are registration-mechanism artifacts, not capability gaps**:
- `vice_diagnose`, `vice_recycle` — synthetic proxy-local tools present on **both** backends via `vice-proxy.ts:3201-3202`'s `buildBackendAwareTool()`, never listed in either raw manifest JSON file. Exclude from the registry entirely.

The remaining 2 are **genuine stock-only capabilities** (no fork equivalent exists — confirmed absent from `tools-manifest.json` and not synthetic):
- `vice_execution_until_return` — native `EXECUTE_UNTIL_RETURN` (0x73); the fork's custom HTTP API has no equivalent RPC.
- `vice_registers_available` — native `REGISTERS_AVAILABLE` (0x83); the fork has no equivalent enumeration call.

Of the 28 "fork-only" names, **4 are the generic MCP meta-tools already covered by `DENY_LIST`** (`initialize`, `notifications_initialized`, `tools_call`, `tools_list`, `vice.ts:201-207`) — these already get a refusal (a bypass-hazard message, not a capability message) and must not be double-classified. Exclude from the capability registry; they are handled entirely by the pre-existing `DENY_LIST` check, which runs *before* the capability-registry lookup would in the override's control flow.

That leaves **24 genuine fork-only tools** needing a BACK-05/DIST-01 registry entry.

### Step 3: reason categorisation for the 24 fork-only + 2 stock-only entries

Grounded in `docs/stock-vice-parity.md` (read in full this session, `§A` items 1-7, `§B`) and `REQUIREMENTS.md`'s CUT annotations. Three reason categories, matching what the project's own docs already distinguish:

| Category | Meaning | BACK-05 refusal tone |
|---|---|---|
| **HARDWARE (unrecoverable)** | No 1:1 opcode can ever exist because of a hardware/firmware property (write-only register, per-read recomputation, no monitor command for a physical line) | "…is unrecoverable on the stock backend: {reason}. Use the fork backend." — no "wait for a later phase" framing, since none is coming |
| **PROTOCOL/DESCOPED (not built)** | Theoretically buildable client-side (an opcode or equivalent exists) but cut from v0.2.0 scope because no skill calls it | "…is not implemented on the stock backend ({one-line why it was descoped}). Use the fork backend, or …" |
| **STOCK-ONLY GAIN** | Reverse direction: stock has it, fork's custom API does not | "…is not implemented on the fork backend: {one-line why the fork's API lacks it}. Use the stock backend." |

| Tool | Category | Reason (for the registry) | Skill-called? |
|---|---|---|---|
| `vice_sid_get_state` | HARDWARE | SID `$D400-$D418` is write-only in hardware; the binary monitor has no SID command. Read-back is unrecoverable. | **Yes** (SKILL-01 named tool) |
| `vice_keyboard_matrix` | HARDWARE | `read_ciapb()` recomputes from `keyarr` on every read (`monitor_binary.c`); `KEYBOARD_FEED` (0x72) only injects PETSCII buffer text. | **Yes** (SKILL-01 named tool) |
| `vice_keyboard_restore` | HARDWARE | RESTORE pulses the NMI line directly; it is not in the keyboard matrix and `KEYBOARD_FEED` cannot produce it. | Yes (found by 05-08's sweep, same family) |
| `vice_keyboard_chord` | HARDWARE | Same family as `matrix`/`restore` — `KEYBOARD_FEED` cannot hold multiple keys for N frames. | No |
| `vice_keyboard_key_press` / `vice_keyboard_key_release` | HARDWARE | Same family — no hold/release primitive over the wire, only whole-string injection. | No |
| `vice_disk_detach` | PROTOCOL/DESCOPED | No detach opcode exists on the stock binary monitor; attaching a different image covers the real workflow (CUT 2026-08-17, `DIRECT-06` remainder). | No |
| `vice_disk_read_sector` | PROTOCOL/DESCOPED | Would require parsing the `.d64` file client-side rather than a live-drive opcode; CUT 2026-08-17, no skill calls it. | No |
| `vice_display_screenshot` / `vice_display_get_dimensions` | PROTOCOL/DESCOPED | `DISPLAY_GET` (0x84) exists on stock (INDEXED8 + `PALETTE_GET`); the PNG client-side encoder was cut wholesale (`SHOT-01`..`05`, 2026-08-17) because no skill calls it and `gatherWedgeEvidence()`'s `captureStep()` already degrades cleanly without it. | No |
| `vice_backtrace` | PROTOCOL/DESCOPED | No skill calls it (`DERIV-02`, cut). | No |
| `vice_checkpoint_group_add` / `_create` / `_list` / `_toggle` | PROTOCOL/DESCOPED | No skill calls any `vice_checkpoint_group_*` (`DERIV-03`, cut). | No |
| `vice_checkpoint_set_ignore_count` | PROTOCOL/DESCOPED (design constraint, not just "uncalled") | No native wire ignore-count exists; the only implementation would require resuming the machine on every ignored hit, which violates D-05's absolute no-unrequested-resume policy. `CHECKPOINT_INFO`'s reply does still report an existing ignore count read-only. | No |
| `vice_cia_set_state` / `vice_vicii_set_state` / `vice_sprite_set` | PROTOCOL/DESCOPED | Write halves of tools whose read halves shipped in Phase 5; no skill calls the write half. | No |
| `vice_memory_fill` | PROTOCOL/DESCOPED | No skill calls it (`DERIV-01` narrowed 2026-08-17). | No |
| `vice_sid_set_state` | PROTOCOL/DESCOPED — **note: this one is NOT a hardware loss** | SID *writes* work fine over `MEM_SET`/`$D400-$D418` (only reads are write-only in hardware); simply not implemented because no skill calls it. Do not conflate with `vice_sid_get_state`'s hard loss — a reader could otherwise wrongly assume all SID tools are unrecoverable. | No |
| `vice_machine_config_get` / `vice_machine_config_set` | PROTOCOL/DESCOPED | Full resource get/set was Phase 6's `GAIN-08`/`09`, cut wholesale; today's tool is a hand-curated whitelist subset that ships on the fork only. If ever built on stock, the three power-cycling resources (`MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency`) must be denied per CLAUDE.md's Safety constraint. | No |
| `vice_joystick_tap` | PROTOCOL/DESCOPED — **sharp edge, see below** | Requires the machine to run for a measured interval (hold-then-release), which needed Phase 7's timing route to exist first. `docs/stock-vice-parity.md:195-203` says it is "deferred to Phase 7," but Phase 7 was narrowed to exactly two tools (`vice_cycles_stopwatch`, `vice_run_until`) and never built it. No skill calls it, so it is not a SKILL-01 concern, but the parity doc's "deferred to Phase 7" note is now stale and should be corrected (see Sharp Edges). | No |
| `vice_execution_until_return` | STOCK-ONLY GAIN | Native `EXECUTE_UNTIL_RETURN` (0x73); the fork's custom HTTP API never exposed an equivalent RPC. | N/A (stock advertises it; fork lacks it) |
| `vice_registers_available` | STOCK-ONLY GAIN | Native `REGISTERS_AVAILABLE` (0x83); the fork has no equivalent enumeration call. | N/A |

**Excluded from the registry entirely** (registration artifacts, not capability gaps): `vice_diagnose`, `vice_recycle` (both present on both backends via synthetic registration; see Anti-Patterns). **Excluded** (already covered by `DENY_LIST`, different hazard shape): `initialize`, `notifications_initialized`, `tools_call`, `tools_list`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fork/stock tool-name delta computation | A hand-maintained "supported tools" table in a doc or in code comments | Mechanical set-diff of `tools-manifest.json` vs `tools-manifest.stock.json`, computed fresh by the generator/test every run | This is D-D's explicit mandate; a hand list drifts the first time a tool is added, exactly the failure the whole Phase 8 doc effort exists to prevent |
| Reason text per unavailable tool | Re-deriving reasons from first principles | `docs/stock-vice-parity.md` §A (already has every reason this phase needs, written and reviewed across Phases 3, 5, 7) and `scripts/check-skill-tool-coverage.mjs`'s `FORK_ONLY_UNRECOVERABLE` array (already has the exact wording for the 3 skill-called tools) | Both are existing, reviewed, cited-with-VICE-source-lines content; re-deriving it risks a subtly different (and unreviewed) claim about VICE internals |
| Committed-artifact freshness checking | A manual "remember to regenerate" convention, or a code-review checklist item | `resources-sync.test.ts`'s generate-into-scratch-dir-and-byte-diff pattern, copied for the one new markdown file | This project has already paid the cost of learning this lesson once (the resources/ drift problem the test exists to prevent) — do not re-learn it for docs |
| Skill-text lint (does every fork-only-tool mention carry the requirement) | A manually-maintained checklist re-read by a human every phase | A grep-based script in the same family as `check-skill-tool-coverage.mjs` (walks `.claude/skills/`, regex-extracts `vice_[a-z0-9_]+`, asserts proximity to a fork/stock-requirement sentence) | `check-skill-tool-coverage.mjs` already proves this mechanism works and is CI-wired (`.github/workflows/ci.yml:89`) |

**Key insight:** every mechanism this phase needs already has a proven, reviewed, CI-wired sibling in this repo. The risk in this phase is *not* "no template exists" — it is duplicating an existing single source of truth into a second, silently-diverging one.

## Common Pitfalls

### Pitfall 1: Fixing the wrong "unknown tool" site
**What goes wrong:** A plan patches `dispatchStock()`'s refusal (`stock-dispatch.ts:734-738`) believing that is where a stock user's fork-only call lands.
**Why it happens:** That refusal reads correctly and even matches BACK-05's spirit almost exactly, so it is a very plausible (but wrong) target.
**How to avoid:** The tool name must be a **registered key in the `tools` record** (`vice-proxy.ts:3178-3202`) before `dispatchStock()` is ever reached. A name absent from the active manifest never gets registered, so it hits `vice-proxy.ts:3254-3256`'s "Unknown tool" fallback first — and `dispatchStock()`'s branch is provably unreachable today, guarded by `stock-dispatch.test.ts:315-323`'s bidirectional agreement test (every manifest entry has a handler, every handler has a manifest entry).
**Warning signs:** A "fix" that only touches `stock-dispatch.ts` and does not touch `vice-proxy.ts`'s `CallToolRequestSchema` override will not change any observable behaviour — the existing bidirectional test would need to fail for the new code to ever execute.

### Pitfall 2: Treating the manifest set-difference as the whole truth
**What goes wrong:** A generator (or a human) computes `forkNames - stockNames` and reports `vice_diagnose`/`vice_recycle` as stock-missing-on-fork or fork-missing-on-stock capabilities.
**Why it happens:** Both names are genuinely absent from `tools-manifest.json` (the raw file), which looks like "fork doesn't have it."
**How to avoid:** Cross-check against `vice-proxy.ts:3201-3202`'s synthetic registration before classifying a delta entry — a name absent from *both* raw manifest files but present in `tools/list` on both backends (via `buildBackendAwareTool()`/`resolveAdvertisedToolDefinition()`) is not a divergence at all.
**Warning signs:** A support table row claiming `vice_diagnose` or `vice_recycle` is fork-only or stock-only.

### Pitfall 3: Conflating "hardware-unrecoverable" with "not yet built"
**What goes wrong:** `vice_sid_set_state` (a write, which works fine over `MEM_SET`) gets bucketed with `vice_sid_get_state` (a read, which is a genuine hardware loss) under one "SID is fork-only" reason.
**Why it happens:** Both share the string "SID" and both are currently absent from the stock manifest.
**How to avoid:** Use the three-category scheme above (HARDWARE / PROTOCOL-DESCOPED / STOCK-ONLY-GAIN); a reader (or an agent) told "SID is fork-only, unrecoverable" will incorrectly conclude a *write*-based SID workaround is also impossible, when the actual constraint is read-only.
**Warning signs:** Any registry entry whose reason text is shared verbatim across a read tool and its write counterpart.

### Pitfall 4: `-default`/`-binarymonitor` flag order in any smoke-test command the install docs give a user
**What goes wrong:** Install documentation includes a "verify your install" command like `x64sc -binarymonitor -default ...` (or omits `-default` when one is later added), and the binary monitor silently never binds — indistinguishable from a wedge given the single-client constraint.
**Why it happens:** `-default` resets VICE resources to their compiled-in defaults, which clobbers the binary-monitor enable flag if `-binarymonitor` was processed first. Discovered empirically during this project's own live testing (project memory, 2026-08-17, dated two days old relative to this research — **MEDIUM confidence, not independently re-verified in this session** since it required relaunching a live VICE process against a stale `vicerc`, which was out of this research's budget).
**How to avoid:** If any install-verification command in the new README content includes `-default`, it must precede `-binarymonitor`. Note that the broker's own `buildViceArgs()` (`broker-launch.mts:173`) never emits `-default` at all today, so this landmine only matters for a user-facing manual smoke-test command, not for anything the broker itself launches.
**Warning signs:** A support request where a user says "the monitor never responds" after following an install doc's own suggested manual launch command.

### Pitfall 5: Stale "deferred to Phase X" prose surviving a scope cut
**What goes wrong:** `docs/stock-vice-parity.md:195-203` still says `vice_joystick_tap` is "deferred to Phase 7," but Phase 7's actual scope (locked by the 2026-08-17 cut and its own `CONTEXT.md`) never included it — the phase built exactly two tools. The sentence is now factually wrong and nothing currently catches it.
**Why it happens:** Prose written at Phase 3 authoring time (forward-looking) was never revisited after a later scope decision (Phase 5's cut) narrowed the target it referenced.
**How to avoid:** Since DIST-01's support table is manifest-derived rather than prose-derived, this exact drift class cannot recur in the *table* — but it can and does still exist in prose elsewhere in the repo. Worth a search-and-fix pass while this phase is already auditing every "which backend has X" claim in the docs, though it is not itself named by any Phase 8 requirement.
**Warning signs:** Any doc sentence naming a future phase number as the home for a capability, once that phase has actually landed with a different scope than the sentence assumed.

## Code Examples

### Existing precedent: DENY_LIST + denyListRefusalMessage (the pattern to replicate)
```typescript
// Source: .claude/mcp/vice/vice.ts:201-243 (read this session)
export const DENY_LIST: readonly string[] = [
  "vice_disk_list",
  "tools_list",
  "tools_call",
  "initialize",
  "notifications_initialized",
];

export function denyListRefusalMessage(toolName: string): string {
  // ... keyed by hazard shape, not one wording for every entry
}
```
Consumed at two call sites today (`vice.ts:698-700`'s `call()` guard, and `vice-proxy.ts:3227-3232`'s `CallToolRequestSchema` override) — the exact "one array, one function, N call sites" shape the new capability registry should follow, with a third call site.

### Existing precedent: manifest-derived reason data, already partially built
```javascript
// Source: scripts/check-skill-tool-coverage.mjs:141-159 (read this session)
const FORK_ONLY_UNRECOVERABLE = [
  [
    "vice_sid_get_state",
    "SID $D400-$D418 is write-only in hardware and the binary monitor has no SID command; read-back is unrecoverable on stock. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_matrix",
    "KEYBOARD_FEED (0x72) injects PETSCII buffer text only; it cannot drive the raw keyboard matrix. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
  [
    "vice_keyboard_restore",
    "The RESTORE key pulses the NMI line and is not in the keyboard matrix; KEYBOARD_FEED cannot produce it. Route: BACK-05 (runtime error), SKILL-01 (playbook note), both Phase 8.",
  ],
];
```
This array's own reason strings already literally say "Route: BACK-05 ... SKILL-01, both Phase 8" — it was written by Phase 5's author *for* this phase to consume.

### Existing precedent: the generate-then-byte-diff test (DIST-01's template)
```typescript
// Source: .claude/mcp/vice/resources-sync.test.ts:50-95 (read this session, abbreviated)
test("resources/ is byte-identical to a fresh build of its TypeScript source", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "resources-sync-"));
  try {
    build({ outDir: scratchDir });
    // Direction 1: every freshly-built file matches the committed one, byte-for-byte
    // Direction 2: every committed generated-looking file is still reproducible (no orphans)
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fork-only tool surface (v0.1.x), one manifest, one backend | Two backends, two manifests, D-07's trimmed-per-backend design | Phase 2 (2026-08-13), locked as a standing constraint | A tool name absent from the active manifest is now a first-class, expected outcome (not a bug) — Phase 8 is the phase that makes that outcome legible to the caller |
| `docs/stock-vice-parity.md` as the sole record of the capability gap | Same document, now also the seed data for a generated, CI-checked table (this phase) | Phase 8 (proposed by this research) | Prose stays the narrative explanation; the table becomes the mechanically-verified summary — neither replaces the other |
| README with zero VICE-install content | README with a stated backend choice + VICE version table (this phase) | Phase 8 | Closes `DIST-02`/`DIST-03`; currently the only way to learn this is to read `CLAUDE.md`'s Constraints section or the planning docs, neither of which ships to an end user |

**Deprecated/outdated:**
- `docs/stock-vice-parity.md:195-203`'s "deferred to Phase 7" note for `vice_joystick_tap` — Phase 7 never built it; the note should name it as simply not-yet-built rather than pointing at a phase that has already closed without it (Pitfall 5).
- Root `README.md:123-126`'s claim that `skill-docs.test.ts`/`vice-mcp-selector-docs.test.ts` exist "in the originating project" — both filenames are confirmed absent from this entire repository; every other reference to them in-tree is itself a comment documenting that they are a ghost reference (`QUAL-02`, deferred quality work, not a Phase 8 requirement but directly adjacent to the file Phase 8 edits).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `-default` must precede `-binarymonitor` or the binary monitor never binds | Common Pitfalls #4 | If wrong (e.g. only true under a specific stale `vicerc` condition, not universally), an install doc's smoke-test command could carry an unnecessary caveat, or a genuinely-needed caveat could be dropped if the planner over-corrects and removes it as "unverified." Sourced from project memory (2 days old at research time), not independently reproduced this session. LOW-MEDIUM risk: the broker's own launch path never emits `-default` today, so this only affects doc prose, not shipped behaviour. |
| A2 | Fedora ships VICE only via RPM Fusion Non-Free, not Fedora's own base/updates repos | Environment Availability | If wrong, install docs could tell Fedora users an unnecessary extra-repo step, or (worse) omit a genuinely-required one. Sourced from a single `rpmfind.net` fetch this session (WebFetch, not an authoritative Fedora page); MEDIUM confidence. |
| A3 | Flatpak's `net.sf.VICE` current version and sandboxing implications for reaching `127.0.0.1` from a sandboxed process | Environment Availability | Not resolved this session (search returned no current version). If the planner's install docs recommend Flatpak, this needs a fresh check — flagged as an Open Question below rather than asserted. |
| A4 | The exact wording/threshold for "proximity" between a `vice_keyboard_matrix` mention and a fork-requirement sentence, for a lint-style SKILL-01 check | Validation Architecture | If too strict, a legitimate mention (e.g. in a table cell referencing a different file) could false-positive; if too loose, a genuinely bare mention could pass. This is a planner/implementer judgment call, not verified against an existing script (no such lint exists yet). |

## Open Questions (RESOLVED)

> All four were resolved during Phase 8 planning. Each carries an inline resolution
> note below, for future-phase traceability. Nothing here is still open.

1. **Should `capability-registry.ts` be imported directly by `scripts/*.mjs` (cross-boundary `.ts` import from a plain Node script), or should `check-skill-tool-coverage.mjs` keep its own copy with a drift test asserting the two stay in sync?**
   - What we know: Node's native type-stripping (already required project-wide, ≥22.18) supports a `.mjs` file importing a sibling `.ts` file with an explicit extension; no root-level `package.json`/`engines` field constrains `scripts/`'s own Node version separately from the rest of the repo.
   - What's unclear: whether a direct cross-package import (`scripts/generate-tool-support-table.mjs` importing `../.claude/mcp/vice/capability-registry.ts`) is desirable stylistically, versus keeping `scripts/` fully dependency-free of the npm-packaged `.claude/mcp/vice/` tree (its current posture — every existing `scripts/*.mjs` only ever `readFileSync`s/`JSON.parse`s `.claude/mcp/vice/` files, never imports TS from it).
   - Recommendation: prefer the direct import (simpler, single source of truth, no drift risk) unless the planner finds a concrete reason `scripts/` must stay import-free of `.claude/mcp/vice/`'s TypeScript; if the planner instead keeps two copies, add a `resources-sync.test.ts`-style byte/structural comparison test between them, never leave them silently divergent.
   - **RESOLVED — direct cross-boundary import.** `scripts/generate-tool-support-table.mjs` imports `CAPABILITY_REGISTRY` from `../.claude/mcp/vice/capability-registry.ts` directly; empirically verified working under Node 22.22 with no flag. This satisfies **D-E** (one source of truth) with no second copy and therefore no sync test. It is a new precedent for `scripts/`, recorded in the generator's header comment. Owned by plan 08-03 Task 1.

2. **Does `vice_diagnose`'s reason "route" note in `check-skill-tool-coverage.mjs`'s comments (`PROXY_LOCAL_WITH_STOCK_MANIFEST_ENTRY`, lines ~74-83) need any Phase 8 change at all?**
   - What we know: this classification is already correct and already excludes these two tools from the "capability gap" accounting (Pitfall 2's fix is already partially applied in this one script).
   - What's unclear: whether the NEW capability-registry module needs to duplicate this exclusion explicitly (so the runtime refusal function never wrongly fires for `vice_diagnose`/`vice_recycle`), or whether it's structurally impossible for the refusal to fire for them anyway (since they are *always* registered into `tools` regardless of backend, per `buildBackendAwareTool()`, so the "miss" branch the refusal lives in can never see these two names).
   - Recommendation: verify this structurally in a unit test (e.g., "no synthetic proxy-local tool name ever reaches the capability-registry lookup") rather than relying on it being true by construction and undocumented.
   - **RESOLVED — a test, not a runtime guard.** The refusal genuinely cannot fire for these names by construction (they are always registered into `tools` regardless of backend), so no runtime guard is added. The structural fact is pinned instead by plan 08-01 Task 2's synthetic-tool guard assertion in `capability-registry.test.ts`. Note that plan 08-03 additionally discovers a *third* proxy-local synthetic tool, `vice_result_continue`, which is in neither manifest and so never enters the manifest-divergence set this question is about.

3. **Should `docs/tool-support.md` (or wherever the generated table lands) ship inside the `@henols/vice-mcp` npm tarball, or stay a GitHub-only doc?**
   - What we know: `.claude/mcp/vice/package.json`'s `files[]` is an explicit allow-list (Rule 2); `check-npm-packages.mjs`'s transitive-closure check only walks imports reachable from `vice-proxy.ts`, so a markdown file with no code importing it would need an explicit `files[]` entry, not just "being importable."
   - What's unclear: whether an npm-installed user (versus a GitHub-browsing user) needs this table locally, given the primary entry points (`README.md`, GitHub) already exist outside the tarball.
   - Recommendation: default to GitHub-only (repo-root `docs/`), matching every other `docs/*.md` file's current placement (none of `docs/phase0-binmon-findings.md`, `docs/stock-vice-parity.md`, etc. are in `files[]` today) — ship it in the tarball only if the planner has a concrete reason an offline/npm-only user needs it.
   - **RESOLVED by D-H — GitHub-only.** The table lives at repo-root `docs/tool-support.md`, linked from `README.md`, and is **not** added to either tarball's `files[]`. Plan 08-01 confirms `scripts/check-npm-packages.mjs` still passes unchanged; plan 08-03 asserts no `docs/` entry was added to `package.json`'s `files[]`.

4. **Flatpak/Snap sandboxing and the binary monitor's `127.0.0.1` bind.**
   - What we know: this repo defaults the binary-monitor bind to `127.0.0.1` (`broker-launch.mts:163`), and warns once if widened.
   - What's unclear: whether VICE installed via Flatpak (network-namespaced by default in some Flatpak sandboxes) can be reached at `127.0.0.1` by a broker running outside the sandbox — not verified this session (Flatpak's current VICE version wasn't even confirmed, see A3).
   - Recommendation: if the install docs mention Flatpak as an option, either verify this live or explicitly flag it as untested/"package-manager installs (apt, dnf, pacman, brew) are the tested path; Flatpak/Snap are unverified" — do not silently imply parity.
   - **RESOLVED by D-I — out of scope.** No Flatpak or Snap claim is made. Plan 08-05 either omits them entirely or marks them explicitly unverified alongside the tested package-manager paths (apt, dnf, pacman, brew); it never asserts either works. Assumption A3 therefore stays unverified by design rather than blocking the phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fixes CPUHISTORY_GET gate (≥3.10)? | Fallback / Note |
|------------|------------|-----------|---------|---|---|
| Debian 13 "trixie" `vice` package | `DIST-02`/`03` install path | ✓ | `3.9+dfsg-1` | ✗ | Below the 3.10 gate — matches CLAUDE.md's existing claim, re-verified live this session (`packages.debian.org/trixie/amd64/vice`) |
| Debian "forky" (testing) `vice` package | same | ✓ | `3.9+dfsg-1+b1` | ✗ | Same gap; re-verified live this session |
| Ubuntu 25.10 "Questing Quokka" `vice` (multiverse) | same | ✓ | `3.9+dfsg-1` | ✗ | Re-verified live this session (`ubuntuupdates.org`) |
| Arch Linux `extra/vice` | same | ✓ | `3.10-3` | ✓ | Updated 2026-07-17; clears the gate. Re-verified live this session (`archlinux.org/packages/extra/x86_64/vice`) |
| Fedora (via RPM Fusion **Non-Free**, not Fedora's own base repos) | same | ✓ (extra repo required) | `3.10-4` (F45/devel) · `3.10-3` (F44) · `3.10-2` (F43 updates) · `3.9-4` (F43 base) | ✓ once on the updates channel | **Not in base Fedora repos at all** — requires enabling RPM Fusion Non-Free first (`[ASSUMED]`/A2, MEDIUM confidence, single-source `rpmfind.net` fetch) |
| Alpine Linux `vice` | same | Partial | `3.10-r0`, edge/testing only, built 2026-03-16 | ✓ (where available) | **Not present in any stable Alpine release branch** (3.20/3.21/3.22 etc.) — only `edge`+`testing` repo enablement gets it |
| Homebrew (`brew install vice`), macOS + Linux | same | ✓ | `3.10` (stable formula), bottles for macOS tahoe/sequoia/sonoma + Linux arm64/x86_64 | ✓ | Clears the gate; matches CLAUDE.md's existing "Homebrew and official builds are fine" claim |
| Official VICE downloads (`vice-emu.sourceforge.io`) — Windows binaries | same | ✓ | `3.9` (GTK3/SDL2 win64 zips) — **the official site's own release announcement says 3.10 released 2026-12-24 2025, but the Windows binaries page still only offers 3.9 zips** | ✗ (as currently packaged for Windows) | **Sharp edge**: Windows users following the official download page do not get 3.10 even though it exists — worth stating explicitly rather than assuming "official = latest" |
| MSYS2 (`packages.msys2.org`) | Windows alternative install path | ✗ | No `vice`/`mingw-w64-*-vice` package found in a live package search this session | N/A | No MSYS2/pacman path exists; Windows users must use the official SourceForge zips (currently 3.9) or build from source |
| Flatpak (`net.sf.VICE`) | Linux alternative install path | Unverified | Not resolved this session (A3) | Unknown | Flag as untested in install docs rather than asserting either way |
| Docker/devcontainer | N/A (project's own container awareness) | ✓ | — | — | Not a VICE-install path; VICE always runs on the host per this project's own architecture, container detection is for the MCP proxy side only |

**Missing dependencies with no fallback:** None — every ecosystem checked has *a* path to VICE; the gate is whether that path clears ≥3.10 (only Arch and Homebrew do, out of the ecosystems checked live this session), and the fallback for a sub-3.10 build is the existing, already-shipped graceful degradation (`CPUHISTORY_GET` absent → Route B of `vice_cycles_stopwatch`, per Phase 7).

**Missing dependencies with fallback:** Debian/Ubuntu/Fedora-base/Alpine-stable users on VICE < 3.10 lose Route A's exact cycle-stopwatch and gain Route B's honest "within-one-frame" approximation instead — already shipped, already documented in `docs/stock-vice-parity.md` §A.4. This is not a new gap Phase 8 needs to close; it needs to be **stated** in the install docs (DIST-02: "what differs per version").

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `.claude/mcp/vice/package.json:58`'s `"test": "node --test '*.test.*'"` |
| Quick run command | `cd .claude/mcp/vice && node --test capability-registry.test.ts` (new file, once it exists) |
| Full suite command | `cd .claude/mcp/vice && node test-gate.mjs` (the automated, non-manual subset — see `test-gate.mjs:1-50`, read this session) |
| Repo-root doc/package guardrails | `node scripts/check-skill-tool-coverage.mjs`, `node scripts/check-npm-packages.mjs` (both already CI-wired, `.github/workflows/ci.yml:89` and `:82`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| `BACK-05` | Calling a fork-only tool name on the stock backend returns a refusal naming the tool, the reason, and "fork" | unit | `node --test capability-registry.test.ts` (assert `capabilityRefusalMessage("vice_sid_get_state", "stock")` contains all three elements) | ❌ new file, Wave 0 |
| `BACK-05` (reverse direction) | Calling a stock-only tool name on the fork backend returns a refusal naming "stock" | unit | same file, `capabilityRefusalMessage("vice_execution_until_return", "fork")` | ❌ new file, Wave 0 |
| `BACK-05` (regression guard) | A genuinely unknown tool name still returns the plain "Unknown tool: X" message, unchanged | unit | same file, `capabilityRefusalMessage("vice_totally_made_up_xyz", "stock")` returns `undefined` | ❌ new file, Wave 0 |
| `BACK-05` (end-to-end wiring) | The real stdio proxy, spawned as a subprocess with `VICE_BACKEND=stock`, answers a live `tools/call` for `vice_sid_get_state` with `isError:true` and the structured text | integration | extend `vice-proxy.test.ts` using its own existing `startProxy()`/`handshake()` harness (see `vice-proxy.test.ts:5174-5199`'s existing `tools_call`-refusal test for the exact pattern to copy) | Harness exists (✓); new test case ❌, Wave 0 |
| `DIST-01` | The generated support table is byte-identical to a fresh regeneration from both manifests + the registry | unit (drift guard) | `node --test tool-support-table.test.ts`, modelled line-for-line on `resources-sync.test.ts:50-95` | ❌ new file, Wave 0 |
| `DIST-01` | The support table's per-tool "fork"/"stock" columns are mechanically derived, never hand-typed | structural | same test asserts the generator's own output was produced from `JSON.parse(tools-manifest*.json)`, not a literal string constant (e.g. assert changing a manifest's tool count changes the generated table's row count, driven by a scratch-manifest fixture) | ❌ new file, Wave 0 |
| `SKILL-01` | Every mention of `vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore` across all six skills is within a bounded proximity of a fork-requirement sentence | lint/mechanical | new `scripts/check-skill-fork-honesty.mjs` (sibling to, and reusing the manifest-read code of, `check-skill-tool-coverage.mjs`) — CI-wired the same way (`.github/workflows/ci.yml`, new step beside line 89) | ❌ new file, Wave 0 |
| `DIST-02`/`DIST-03` | README states the `VICE_BACKEND` config value and the SID/matrix-keyboard fork exceptions | lint (presence check) | a cheap grep-based assertion (could live in the same new lint script, or `vice-proxy.test.ts`) that `README.md` contains the literal strings `VICE_BACKEND`, `vice_sid_get_state`, `vice_keyboard_matrix` | ❌ new assertion, Wave 0 |
| `DIST-02`/`DIST-03` | A real user, following only the README, can install stock VICE and run one skill successfully | **manual only** | No automated command exists or can reasonably exist for "did a human successfully follow prose instructions on a clean machine" | N/A — see below |

### Sampling Rate
- **Per task commit:** `node --test capability-registry.test.ts` (or whatever the new unit test file is named) — sub-second, no emulator.
- **Per wave merge:** `node test-gate.mjs` (the full automated, non-manual suite) plus `node scripts/check-skill-tool-coverage.mjs` and the new `check-skill-fork-honesty.mjs`.
- **Phase gate:** full automated suite green, plus the one manual item below, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `.claude/mcp/vice/capability-registry.ts` + `capability-registry.test.ts` — the core BACK-05 data/function and its unit tests
- [ ] A new assertion in `.claude/mcp/vice/vice-proxy.test.ts` exercising the real `CallToolRequestSchema` override end-to-end (reuse `startProxy()`/`handshake()`, modelled on the existing `tools_call`-refusal test at line 5174)
- [ ] `scripts/generate-tool-support-table.mjs` + `.claude/mcp/vice/tool-support-table.test.ts` (or wherever the planner places the drift test) for DIST-01
- [ ] `scripts/check-skill-fork-honesty.mjs` for SKILL-01's mechanical check, CI-wired alongside the existing `check-skill-tool-coverage.mjs` step
- [ ] A presence-check assertion that README.md's new content actually contains the required literal strings (`VICE_BACKEND`, the two named tool names) — can be folded into the same new lint script rather than a separate file

### The one genuinely manual item
**Criterion 3 ("a user installs the plugin and a working VICE from a package manager by following the documentation")** cannot be fully automated — it is a claim about a human successfully following prose on a machine this project does not control. The mechanical checks above (presence of the right strings, correct per-tool tables) are a strong proxy but not proof. Record this explicitly as the phase's one human-verification item, analogous to how Phase 7 tracked its broker-mediated-verdict item in `07-HUMAN-UAT.md` — e.g. "a human runs `apt install vice`, sets `VICE_BACKEND=stock`, and successfully runs `c64-ram-capture`'s entry-point procedure end to end" on a clean or containerized Debian/Ubuntu box.

## Security Domain

`security_enforcement` is enabled in `.planning/config.json`. This phase's changes are documentation and string-matching/lookup logic; the ASVS surface is minimal, but not zero:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase adds no auth surface |
| V3 Session Management | No | No session concept touched |
| V4 Access Control | No | The capability registry is a read-only lookup, not an authorization boundary — it runs strictly after the pre-existing `DENY_LIST` check, never in place of it |
| V5 Input Validation | Marginal-yes | `capabilityRefusalMessage(name, backend)`'s `name` parameter is the exact same untrusted `request.params.name` string every other lookup in `vice-proxy.ts` already handles as a plain object-key/map lookup (never `eval`'d, never used to construct a path or a shell command) — no new validation is needed beyond what a plain string-keyed lookup already provides, but the registry must not, e.g., be interpolated into a template that is later executed or used to build a filesystem path (it is purely a message-text input) |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted `name` string used to probe internal registry contents (information disclosure about unbuilt/future tool names) | Information Disclosure | Low severity — the registry only ever reveals information already public in `docs/stock-vice-parity.md` and this project's own public GitHub repo; no secret or credential is stored in it. Do not add anything to the registry beyond what is already publicly documented. |
| Confused-deputy via a generic-surface tool carrying a forbidden name as a nested argument (the exact hazard `DENY_LIST`'s `tools_call`/`initialize` entries close) | Spoofing/Elevation | **Already closed, pre-existing** (`vice-proxy.ts:3227-3232`) — the capability-registry lookup must run strictly *after* the existing `DENY_LIST` check in the override's control flow, never before or in place of it, so this phase does not reopen that closed bypass. |

## Sources

### Primary (HIGH confidence — read directly from source this session)
- `.claude/mcp/vice/vice-proxy.ts` (lines 395-451, 2884-2900 region, 3020-3288) — the `CallToolRequestSchema` override, `readManifestTools()`, `buildBackendAwareTool()`, `RECYCLE_TOOL`/`DIAGNOSE_TOOL` synthetic registration
- `.claude/mcp/vice/vice.ts` (lines 183-243, 693-700) — `DENY_LIST`, `denyListRefusalMessage()`, `call()`'s guard
- `.claude/mcp/vice/stock-dispatch.ts` (lines 84-140, 445-741) — `manifestPathForBackend()`, `resolveAdvertisedToolDefinition()`, `dispatchStock()`'s (unreachable) refusal
- `.claude/mcp/vice/broker-launch.mts` (lines 100-190) — `buildViceArgs()`, confirming no `-default` flag is ever emitted by this project's own launch path
- `.claude/mcp/vice/resources-sync.test.ts` (full file, 127 lines) — the generate-then-byte-diff template
- `.claude/mcp/vice/test-gate.mjs` (lines 1-50) — manual-only test disposition and the automated-gate concept
- `scripts/check-skill-tool-coverage.mjs` (full file, 348 lines) — the classification arrays, the extraction regex, the CI-wired coverage assertion, and its own header comment explicitly earmarking reuse by this phase
- `scripts/check-npm-packages.mjs` (full file) — the transitive-closure/`files[]` allow-list mechanism a new `capability-registry.ts` module must satisfy
- `docs/stock-vice-parity.md` (full file, 484 lines) — the authoritative, already-reviewed reason text for every capability divergence
- `README.md`, `.claude/mcp/vice/README.md`, `installer/README.md` (full files) — confirmed absence of any VICE-install/backend-selection content, and the ghost-reference finding
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/phases/07-.../07-CONTEXT.md`, `07-VERIFICATION.md` — locked decisions, phase history, requirement status
- `.github/workflows/ci.yml` (lines 40-120 region) — confirms `check-skill-tool-coverage.mjs` and `check-npm-packages.mjs` are both already blocking CI steps

### Secondary (MEDIUM confidence — WebFetch/WebSearch this session, cross-checked where possible)
- `packages.debian.org/trixie/amd64/vice`, `packages.debian.org/forky/amd64/vice` — Debian versions, fetched live
- `ubuntuupdates.org/package/core/questing/multiverse/base/vice` — Ubuntu 25.10 version, fetched live
- `archlinux.org/packages/extra/x86_64/vice/` — Arch version + update date, fetched live
- `formulae.brew.sh/formula/vice` — Homebrew stable version + bottle platforms, fetched live
- `vice-emu.sourceforge.io` front page and `windows.html` — official release date/version and Windows binary version mismatch, fetched live
- `rpmfind.net` search results — Fedora/RPM-Fusion version table (single source, not cross-checked against a second authoritative Fedora page — see Assumption A2)
- `pkgs.alpinelinux.org` — Alpine edge/testing-only availability, fetched live

### Tertiary (LOW confidence, flagged for validation)
- Project memory `stock-vice-binarymonitor-flag-order.md` — the `-default` ordering claim (Assumption A1), not independently reproduced this session
- Flatpak `net.sf.VICE` current version — search returned no usable version data (Open Question 4 / Assumption A3)
- MSYS2 package search — returned no `vice` package at all; treated as "does not exist" on the strength of one search-UI query, not a second confirming source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, trivially verified (nothing to verify)
- Architecture / BACK-05 design: HIGH — every code claim re-read this session with current line numbers; the exact bug site and the exact dead-code decoy are both confirmed by reading, not inferred
- DIST-01 design: HIGH — the generator template (`resources-sync.test.ts`) and the seed data (`check-skill-tool-coverage.mjs`) both exist and were read in full
- SKILL-01 gap list: HIGH — full grep of all six skills for the three named tools, cross-checked against which skills call any fork-only tool at all
- DIST-02/03 install-story version data: MEDIUM-HIGH — five ecosystems verified live this session with dated sources; Fedora and Flatpak are single-source or unresolved (flagged)
- The `-default` flag-order pitfall: MEDIUM — sourced from project memory, not re-verified live this session (would require relaunching VICE against a deliberately-stale `vicerc`, judged out of research budget)

**Research date:** 2026-08-18
**Valid until:** Package-manager version claims: ~30 days (distro repos update); code-site line numbers: until the next phase touches `vice-proxy.ts`/`stock-dispatch.ts` (re-verify per CLAUDE.md's own drift-tolerance note); reason-categorisation table: stable until a future phase builds one of the currently-descoped tools (at which point its row should move out of the registry, mirroring `PENDING_LATER_PHASE`'s drift-guard pattern in `check-skill-tool-coverage.mjs`).
