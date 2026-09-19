# Project Research Summary: c64-re-tools v1.1.0 "The Prerequisite Doctor"

**Project:** c64-re-tools  
**Domain:** CLI prerequisite doctor + tool-location config for an existing Node/TypeScript MCP plugin  
**Researched:** 2026-09-16  
**Confidence:** HIGH — every finding is verified against official sources, the project's own tree (read directly), or measured empirically in this session

## Executive Summary

The prerequisite doctor is a low-floor diagnostic CLI that reports on the availability and location of six external tools (VICE, ACME, c1541, petcat, Ghidra, dxa) and which skills/MCP capabilities each tool unblocks. It must run on a Node too old to parse the main server's TypeScript source (a hard constraint), so it cannot be a subcommand of the existing entry point — it must be its own low-floor, compiled-to-plain-JS artifact.

**Recommended approach:** Author the doctor as a host-bound `.mts` file (mirroring `vice-broker.mts` / `host-tool.mts`), add it to the existing `build.ts` compile pipeline to emit a plain `.mjs` artifact, and wire a new `bin` entry in `package.json` to that `.mjs`. This reuses the project's existing "generated-but-committed" pattern rather than introducing new machinery. The doctor calls the *same* resolution functions (`resolvedBackend()`, `findSiblingBinary()`, etc.) the real dispatch path calls, compiled to `.mjs` alongside it, so disagreement between doctor and dispatch is structurally impossible — they use identical probes.

**Key risks and mitigations:**
- **Risk:** Doctor reports a resolution that diverges from what the code actually uses at runtime → **Mitigation:** One resolver function called by both doctor and dispatch path; same-process differential test per tool
- **Risk:** Doctor cannot run on an old Node → **Mitigation:** Plain `.mjs` entry, Node-version check as first statement, CI matrix cell exercising actual old-Node floor
- **Risk:** Tool-location config (`tools.json`) paths behave unexpectedly → **Mitigation:** Centralized resolver handling `~` expansion, relative-path base (repo root), executable checks, identity-staleness via existing `mtimeMs`/`sizeBytes` pattern
- **Risk:** Generated README section drifts from declaration → **Mitigation:** Semantic diff guard (parsed records, not bytes); planted-violation test per `ENGINEERING_RULES.md` §6

## Key Findings

### Recommended Stack

**Zero new npm packages.** The doctor reuses Node built-ins, the project's existing compiled-artifact pattern, and no external libraries.

**Core technologies:**
- **Node process.versions.node string check** (builtin, no library) — Gate the entry point version inline before any TypeScript is touched
- **Plain JSON** (no YAML/TOML parser) — Prerequisite declaration and `tools.json` (user-facing location override file) remain machine-parseable with `JSON.parse`, requiring no new runtime dependency
- **`build.ts` existing pipeline** — Doctor authored as `.mts`, added to `HOST_BOUND_ARTIFACTS`, compiled to committed `resources/*.mjs` exactly like `broker-launch.mts` and `host-tool.mts`
- **Existing probes** (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`, `findAcmeLib()`, Ghidra `analyzeHeadless` search) — Doctor calls these functions compiled to `.mjs`, not reimplemented; single seam, no disagreement risk
- **Hand-rolled version comparator** (numeric-tuple split/compare, ~15 lines) — Per-tool version detection via `--version`/`--help` probe, reusing the pattern `acme-gate.ts` already demonstrates; unit test guards against the exact `"3.9"` vs `"3.10"` lexicographic-compare bug CLAUDE.md already documents

**Owner decision override applied:** No VICE version-floor reporting in the doctor. The `CPUHISTORY_GET` binary-monitor opcode floor (≥3.10) is irrelevant here because shipped tools use the text-channel `chis` command instead, which has no version gate. **Report VICE presence and resolved path only.** Node ≥24 is reported as a genuine version gate (required for the MCP server itself) and must be checked/documented. **dxa is deliberately excluded from the tool-location-config override layer** because it is project-vendored and project-built; an env var or file entry could only select a binary the project did not pin.

### Expected Features

**Must have for v1.1.0 launch:**
- Single CLI entry point executable on pre-v24 Node (hard constraint: doctor must run before the server can)
- Per-tool status: OK / present-but-below-version-floor / absent-optional / absent-blocking (3–4 states, not 2)
- Capability-mapped grouping (per skill/MCP capability, not per-binary flat list) — Flutter's `[✓]` Android-toolchain pattern applies to "which skills does each tool unblock"
- Per-row resolved source tracking (env-var name / `tools.json` / `$PATH` position / sibling-probe) — matches `git config --show-origin` precedent, answers "why did I get this answer"
- `.c64-re-tools/tools.json` location file consulted in precedence order: `env var → file → $PATH/sibling probe → refuse by name`
- Exit code provably tracks worst row (0 = all green, distinct code 1 = any yellow, distinct code 2 = any red), tested against real verdicts
- Per-platform remedy text for every absent/below-floor row (already exists scattered in README + SKILL.md + refusal messages; consolidate via declaration)
- **Zero package-manager or acquisition-tool invocation** — report only, never execute a fix

**Defer to v1.1.x or later:**
- `--json` / machine-readable output (ship once a real CI/scripting consumer exists)
- `-v`/verbose mode with per-row extra detail (genuine nice-to-have, not launch-blocking)
- README table generation from declaration (ship after semantic-guard is live and proven stable)
- Multiple layered `tools.json` files (explicitly out of scope per PROJECT.md)

### Architecture Approach

The new tool-location resolver lives as a sibling to `backend-detect.mts` (a new file, e.g. `tool-location.mts`), added to `build.ts`'s `HOST_BOUND_ARTIFACTS` array, and exports a single function: `resolveToolLocation(toolId, { env?, toolsJsonPath?, ... }): { path: string | null; source: "env" | "file" | "path" | "sibling" | "vendored" | "not-found"; tried: string[] }`. It must NOT import `repo-root.ts` as a static import (module-cycle risk in a host-bound `.mts`); instead, callers pass the resolved `toolsDir` as an explicit string parameter, exactly as `backend-detect.mts` already does for `supervisorDir`.

**Doctor placement:** A separate host-bound `.mts` entry point (e.g. `doctor-cli.mts`), also added to `HOST_BOUND_ARTIFACTS`, compiled to `.mjs`, and wired as a second `bin` entry in `package.json` pointing at `resources/doctor-cli.mjs`. This is structurally identical to how `vice-broker.mts` is authored, compiled, and deployed as `resources/vice-broker.mjs`.

**Prerequisite declaration:** Plain JSON file (e.g. `tools.declaration.json`, committed alongside source) containing per-tool records: tool ID, version floor, which skill(s)/capability each tool unblocks, per-platform remedy text.

### Critical Pitfalls

1. **The doctor that lies — two probes, two verdicts** 
   - **How to avoid:** One resolver function called by both; same-process differential test per tool; test catches any future drift when someone edits one without the other

2. **The doctor that cannot run — Node-floor self-reference** 
   - **How to avoid:** Plain `.mjs` entry point with Node-version check as first statement; static import-graph guard excluding `@mastra/*`/`vice-proxy.ts`; CI matrix cell exercising actual old-Node floor

3. **Tool-location config pitfalls — `tools.json` path handling** 
   - **How to avoid:** Centralized resolver handling `~` expansion, relative paths (resolved from repo root), executable-bit checks, identity caching via `mtimeMs`/`sizeBytes`; never interpolate a path into a shell string

4. **Layered-precedence pitfalls — env → file → $PATH → refuse** 
   - **How to avoid:** One resolver function both doctor and dispatch call; resolved answer carries `source` field; precedence conformance test matrix asserts identical order

5. **Generated-documentation drift without proper guard** 
   - **How to avoid:** Semantic-structure diff guard (parse to objects, compare equality not bytes); guard runs in CI; planted-violation tests confirm it fails when facts diverge

## Implications for Roadmap

Research identifies a natural **five-phase build order based on structural dependencies:**

### Phase 1: Prerequisite Declaration (Data Only)
**Rationale:** Every other phase depends on knowing what to probe and what it unblocks. This locks the vocabulary down.

**Delivers:** Plain JSON file with per-tool vocabulary, version floors, capability mappings, and per-platform remedy text (consolidated from README, SKILL.md, refusal strings)

---

### Phase 2: Tool-Location Resolver Seam (`tool-location.mts`)
**Rationale:** Pure resolver that owns the `env → file → path/sibling → vendored → refuse` precedence order, callable by both doctor and dispatch.

**Delivers:** New module `src/mcp/vice/tool-location.mts` exporting `resolveToolLocation()`; added to `build.ts`'s `HOST_BOUND_ARTIFACTS`

**Research flag:** Whether `resolvedBackend()` gains `toolsJsonPath` parameter internally, or the new seam wraps it externally (both avoid cycles; affects phase 3 scope)

---

### Phase 3: Wire Resolver Into Existing Consumers
**Rationale:** Refactor five existing resolution callsites to use the seam; first time `resources/*.mjs` is regenerated.

**Delivers:** Refactored callsites in `backend-detect.mts` and `host-tool.mts`; updated and committed `resources/*.mjs` artifacts

**Critical:** Do not call resolver from inside `broker-launch.mts`'s synchronous `inFlight` launch guard

---

### Phase 4: Doctor CLI Entry Point
**Rationale:** Depends on phases 1–3; structurally parallel to `vice-broker.mts` — author as `.mts`, compile to `.mjs`, wire as second `bin` entry.

**Delivers:** New module `src/mcp/vice/doctor-cli.mts`; exit codes 0/1/2 tracking status; per-tool status and capability mapping; Node-version check as first statement

**Verification:** CI matrix cell running doctor under actual pre-v24 Node; same-process differential test per tool

---

### Phase 5: README Generator + Semantic Guard
**Rationale:** Consolidate install tables from declaration; ideally ship after phase 4 so both doctor and README tell consistent stories.

**Delivers:** Generator script, semantic-diff guard, bracketed section in README.md

**Verification:** Guard runs in CI; planted-violation tests confirm it fails when declaration and README diverge

---

### Phase Ordering Rationale

- Phases 1–2 are pure data/logic with zero behavioral change
- Phase 3 wires the seam into today's code paths (first real-world test)
- Phase 4 adds the user-facing diagnostic (heaviest on testing)
- Phase 5 completes the documentation feedback loop (can defer slightly if needed)

### Research Flags

**Phases needing deeper investigation during planning:**
- **Phase 2:** Open design question on resolver placement — affects phase 3 refactoring scope
- **Phase 4:** VICE version-reporting semantics novel; review against any live VICE-capability testing

**Phases with standard patterns:**
- **Phase 1:** Pure data authoring; no new patterns to research
- **Phase 3:** Mirrors existing patterns already established
- **Phase 5:** Extends existing non-vacuous-verification principle

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Verified against Node official docs, measured empirically against real binaries; zero new npm packages confirmed |
| Features | **HIGH** | Sourced from mature, real tools (Flutter, Homebrew, Claude Code, npm, git, rustup); expectations grounded in tool precedent |
| Architecture | **HIGH** | All claims cite `file:line` read from tree; one open design question explicitly flagged |
| Pitfalls | **HIGH** | Grounded in project's own incident history (fork-vs-stock PATH shadowing, triple-launch outage); generic failures sourced from real public incidents |

**Overall confidence:** **HIGH**

### Gaps to Address

1. **VICE version-reporting semantics:** Confirm live VICE-capability testing doesn't assume binary-monitor opcode availability that "presence-only" report would contradict

2. **Installer package scope:** Does installer consume declaration for "what you'll need" output, or is that purely the doctor's job?

3. **ACME prefix-list generation scope:** Whether `acme-build/SKILL.md` prefix list should be generated from declaration is explicitly out of scope for v1.1.0

4. **`tools.json` schema validation:** Defer to phase 2 planning; current evidence suggests defensive narrowing is sufficient

## Sources

### Primary (directly verified from the tree)
- `src/mcp/vice/build.ts` — `HOST_BOUND_ARTIFACTS` list, design rationale
- `src/mcp/vice/backend-detect.mts` — `resolvedBackend()` pattern, memoisation, output shape
- `src/mcp/vice/host-tool.mts` — existing probes pattern, spawn invariant
- `.planning/PROJECT.md` § "Current Milestone: v1.1.0" — scoping decisions
- `.planning/ENGINEERING_RULES.md` — test derivation bans, verification requirements
- `CLAUDE.md` — architectural constraints, never-auto-install rule

### Secondary (official/authoritative)
- Node.js official docs — `process.versions.node`, type-stripping, `util.styleText` stability
- Real shipped bugs — Flutter#108618, Homebrew#21334, npm/cli#1226

---
*Research completed: 2026-09-16*  
*Ready for roadmap: yes*
