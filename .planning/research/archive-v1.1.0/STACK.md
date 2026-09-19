# Stack Research

**Domain:** CLI prerequisite doctor + tool-location config for an existing Node/TypeScript, no-build-step Claude Code plugin (`@henols/vice-mcp`)
**Researched:** 2026-09-16
**Confidence:** HIGH — every version/behavior claim below was either verified against current official Node docs (via web search, cross-checked against 2+ sources) or **measured directly in this sandbox** against three real installed Node binaries (v20.20.0, v22.13.0, v24.20.0, all via the project owner's existing `nvm` install) and npm 10.8.2. Measurements are called out explicitly below and are reproducible.

This milestone adds **zero new npm packages**. Every recommendation below is either a Node built-in, a project-authored mechanism reusing the existing `build.ts` generated-but-committed pattern, or a plain committed JSON/JSON-Schema file. That is the central finding, not an incidental one — see "What NOT to Use."

## Recommended Stack

### Core Mechanism (answers Q1 — the crux)

| Mechanism | Version floor | Purpose | Why Recommended |
|-----------|---------------|---------|------------------|
| Single `bin.vice-mcp` entry rewritten to a plain-syntax `.mjs` bootstrap shim | Node builtin, any version | Makes `vice-mcp doctor` reachable on a Node too old to parse `vice-proxy.ts` | It is the **only** mechanism that (a) preserves the documented invocation `npx -y @henols/vice-mcp doctor`, (b) is reachable before any TypeScript file is ever touched, and (c) can be tested deterministically. See "Recommended Mechanism, Verified" below. |
| `process.versions.node` string-split version gate (no library) | Node builtin, any version | Decide, inside the shim, whether to run the doctor inline or hand off to the real server | `process.versions.node` (e.g. `"20.20.0"`) has been present since Node 0.x; a `.split(".").map(Number)` gate needs no dependency and no `engines`/`engine-strict` reliance (which is unreliable — measured, see below). |
| `build.ts`'s existing "generated-but-committed" `.mts → resources/*.mjs` pipeline, extended to include the doctor's own source and the two probe modules it must call | Existing project tool, no new build step added | Lets the doctor be **authored in TypeScript** (typechecked, consistent with project conventions) while still shipping as plain, low-floor-parseable `.mjs` | `backend-detect.mts` and `host-tool.mts` — the exact modules that own `resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`, and `findAcmeLib()` — are **already** in `build.ts`'s `HOST_BOUND_ARTIFACTS` list and already compile to committed `resources/backend-detect.mjs` / `resources/host-tool.mjs` (confirmed by reading `src/mcp/vice/build.ts`). The doctor does not need a new detection path — it needs to `import` these two already-plain-JS artifacts, and joining the doctor's own source to the same `HOST_BOUND_ARTIFACTS` list is a one-line change to an existing, tested mechanism, not a new one. |
| `node:util` `styleText` for colour, existing ✓ ✗ ◆ ○ ⚠ Unicode symbols for meaning | Node builtin, stable at project floor (≥24) | Doctor report formatting | See Q5 below. Feature-detected in the shim (`typeof styleText === "function"`) so the shim degrades to plain symbols, no colour, when running on a Node old enough to lack it. |
| Plain committed `.json` for both the prerequisite declaration and the tool-location file, `readFileSync` + `JSON.parse` in low-floor code, `with { type: "json" }` import attributes permitted only in code that already assumes Node ≥24 | Node builtin (`JSON.parse` always; import attributes stable since the Node 22 line) | Config/declaration storage | See Q2/Q3 below. |
| Hand-authored JSON Schema (`tools.schema.json`) referenced via a `$schema` key, no schema-validation library | Node builtin (none needed — editors validate client-side) | Editor completion for `.c64-re-tools/tools.json` | See Q3 below. |
| Per-tool `--version`/`--help` regex extraction + a hand-rolled numeric-tuple comparator | No library | External binary version floor checks | See Q4 below. Extends the project's own existing pattern (`acme-gate.ts`'s `probeAcme()`), not a new one. |

### Recommended Mechanism, Verified (Q1 detail)

**The concrete recommendation:** change `package.json`'s `bin.vice-mcp` from `"vice-proxy.ts"` to a small, hand-authored plain-JS (or `.mts`-authored/`build.ts`-compiled) bootstrap script, e.g. `resources/vice-mcp-cli.mjs`. That script:

1. Reads `process.versions.node`, splits on `.`, compares the major number against the floor (24) — pure arithmetic, zero imports beyond what it already needs for step 3.
2. If the floor is unmet: runs the doctor's full capability-mapped report **inline**, using only the already-compiled, already-low-floor-safe `resources/backend-detect.mjs` / `resources/host-tool.mjs` artifacts, and reports "Node is too old" as one row of that same report (not a special-cased crash path) — then exits.
3. If the floor is met: `await import("../vice-proxy.ts")` and hands off exactly as today.

This was chosen over three alternatives the question asked me to evaluate, each **measured** or **verified** false/unworkable:

**1. Multiple `bin` entries (a second `vice-mcp-doctor` bin).** Rejected. Verified against current npm docs and cross-checked: npx's bin-resolution only auto-selects a bin whose name matches the (unscoped) package name; a second, differently-named bin requires `npx -p @henols/vice-mcp vice-mcp-doctor` or similar — it cannot be reached by the milestone's own target invocation `npx -y @henols/vice-mcp doctor`, because `doctor` there is an **argument to the resolved bin**, not a bin-name selector. Two bin entries do not multiplex on argv; npx resolves one bin file per invocation, then passes the rest of argv straight through.

**2. `engines` / `engine-strict` as the enforcement gate.** Rejected, and **measured false as a reliable gate** in this session, not just cited from docs:
   - Built a throwaway package (`engine-test-pkg`) with `"engines": {"node": ">=24.0.0"}` and a shebang `.mjs` bin, packed it, and ran `npm install` / `npx --yes` against it under Node 20.20.0 + npm 10.8.2 (PATH scoped so both `npx` itself and the shebang's `env node` resolved to the same old binary — an earlier attempt without this scoping silently re-executed under Node 24, a confound worth flagging to anyone re-running this test).
   - With no `engine-strict` configured: `npm warn EBADENGINE` was printed, but install **and execution proceeded anyway** (exit 0).
   - With `engine-strict=true` set in the **consumer's own project `.npmrc`** (the only place a package author cannot control but a user could set to protect themselves): install **still succeeded with no error and no warning at all** — this reproduces a known npm/cli defect (`npm/cli#2175`, "npm install ignores engines + engine-strict=true"), found via web search and consistent with what was measured here on npm 10.8.2.
   - Conclusion, stated precisely: `engines` is metadata that `npm install`/`npx` read and may warn about; it is **never** a hard runtime or install-time block under the npm version measured here, even in the one configuration (`engine-strict=true`) documentation suggests should block it. Nothing in the install pipeline will ever stop an old-Node user from reaching the bin script — the bin script itself is the only place a check can live.

**3. A bare `.mjs` shim that always attempts `import("./vice-proxy.ts")` and relies on `catch` to detect an old Node.** Works, but is not the primary recommendation — it is a **fallback safety net**, not the main mechanism. Measured directly on Node 20.20.0 in this session:
   - `node vice-proxy.ts` style **direct execution** of a `.ts` file (i.e. what happens today when the current `bin` entry is invoked) throws `TypeError [ERR_UNKNOWN_FILE_EXTENSION]` **uncaught**, dumps a full stack trace, and exits 1. This is a hard crash from the caller's point of view — no graceful message, no doctor output, nothing this project controls.
   - A **dynamic** `import("./sample.ts")` from inside a plain `.mjs` wrapper, wrapped in `try { await import(...) } catch {}`, **is** catchable: the same `ERR_UNKNOWN_FILE_EXTENSION` arrives as a normal rejected promise, the process survives, and code after the `catch` block runs (exit 0 achieved).
   - Given this, `import()`-and-catch *would* work as the sole mechanism. It is still the weaker design: it means every attempt to run *anything* — including plain `vice-mcp <some-command-unrelated-to-doctor>` — pays the cost of attempting (and catching) a doomed import before it can report the real problem, and it means the "Node too old" code path is only ever exercised via exception handling rather than an explicit, first-line check. **Recommendation: check the version explicitly first; keep the catch as defense in depth, not as the primary mechanism.**

### Supporting Libraries

None recommended for addition. See "What NOT to Use."

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `build.ts` (existing) | Compiles the doctor's `.mts` source (and, if the probes need widened exports, `host-tool.mts`/`backend-detect.mts`) into committed `resources/*.mjs` | Extend `HOST_BOUND_ARTIFACTS` (currently 10 entries, confirmed by reading the file) by exactly the doctor's own module(s). `resources-sync.test.ts` already fails CI on drift — no new guard needed, the existing one covers an added entry. |
| `tsc --noEmit` (existing, typecheck-only) | Typechecks the doctor's `.mts` source like every other host-bound module | No change needed; `tsconfig.build.json`'s `include` already governs which sources are host-bound-compiled. |
| `node --test` (existing) | Tests the doctor's logic, and a dedicated regression test asserting `bin.vice-mcp`'s target file contains no TypeScript-only syntax (an `erasableSyntaxOnly`-shaped guard, mirroring `build.ts`'s own header comment about staying inside that restriction) | Recommend a small new test file only — no new test framework. |

## Installation

```bash
# No new runtime dependencies. Nothing to install.
# The only "installation" step is a package.json edit:
#   "bin": { "vice-mcp": "resources/vice-mcp-cli.mjs" }   (was: "vice-proxy.ts")
# plus adding the doctor's .mts source (and its resources/*.mjs twin) to
# build.ts's HOST_BOUND_ARTIFACTS list, and adding the two new committed
# JSON files (prerequisite declaration + tools.json JSON Schema) to
# package.json's "files" array so they ship in the published tarball.
```

## Q2 / Q3 detail — file format for the prerequisite declaration and `tools.json`

**Recommendation: plain `.json` for both files.** Not JSONC, not TOML, not YAML.

- **Node has no built-in TOML or YAML parser at 24 or 25** (verified by search against current Node 24 release coverage and the Node stdlib module list — no such module exists; only third-party packages like `iarna-toml`, `js-toml`, `js-yaml` provide this, and adding any of them is a new runtime dependency this milestone's framing explicitly wants to avoid).
- **Node has no built-in JSONC (JSON-with-comments) parser either.** `tsconfig.json`'s comment support lives inside `tsc`'s own compiler code, not `node`; adopting JSONC here would mean either hand-rolling a comment-stripping pre-pass (a second, non-standard parser to maintain) or adding a dependency (`jsonc-parser` et al.) — rejected for the same reason as TOML/YAML.
- **Node's built-in JSON support is real and sufficient, but has two distinct forms with different floors — this is the integration-critical nuance:**
  - `JSON.parse(readFileSync(path, "utf8"))` — available on every Node version this project will ever encounter, including whatever "too old" version the doctor's low-floor shim runs on. **This is the only form the low-floor shim may use.**
  - `import data from "./file.json" with { type: "json" }` (or the dynamic form) — ES2025 import-attributes syntax, standardized and stable in the Node 22 line onward. Safe to use anywhere in the normal TypeScript module graph that already assumes Node ≥24 (i.e. inside `vice-proxy.ts` and its non-host-bound imports), but **must not** be used inside the low-floor shim or any module the shim imports before its version check, since it is not guaranteed to parse on an arbitrarily old Node.
- **The milestone's "commented template" requirement** (the doctor writes a starter `tools.json` "the user edits") is better served by **not** putting prose inside the JSON file at all: keep the file itself clean, machine-parseable JSON with a `$schema` key (below) for structural help, and put the explanatory text in the doctor's own stdout when it writes the template — this matches the project's existing convention of putting explanations in refusal *messages*, not in data files (`CLAUDE.md`'s "detect, then refuse by name with the remedy in the message" pattern already does this for every other tool). If inline comments in the file itself are judged necessary later, the zero-dependency fallback is the well-known idiom of a `"//"`-named string value (valid JSON, ignored by every consumer that doesn't look for it) — not a JSONC parser.

## Q3 detail — JSON Schema for editor completion, at zero runtime cost

- A `$schema` key pointing at a local JSON Schema file gives VS Code (and other editors with JSON language support) full autocomplete, hover docs, and inline validation **with no extension and no project dependency** — this is the editor's own built-in JSON language service reading the schema client-side; it costs the project nothing at runtime.
- Recommend: author `tools.schema.json` (JSON Schema, Draft 2020-12) once, committed alongside the prerequisite declaration, and have the doctor **deploy a copy into `.c64-re-tools/`** alongside the generated `tools.json` template — this mirrors the existing `install-resources.ts` pattern of deploying artifacts into the consuming (gitignored) project directory, so the `$schema` reference can be a plain relative path (`"./tools.schema.json"`) rather than a network URL that would need to track published versions.
- **No schema-validation library (ajv, zod, etc.) is needed at runtime.** `.c64-re-tools/tools.json` is a flat map of a handful of known tool names to path strings — the doctor already has to write code that reads and uses every field to do anything useful with it, so a hand-written shape-check function (mirroring `host-tool.mts`'s existing `normaliseHostToolRequest()` — a small, explicit, discriminated-result validator already living in this codebase for exactly this class of untrusted-input problem) covers runtime validation with no new dependency and no schema-interpretation code path to trust.

## Q4 detail — version detection of external binaries

- **No established Node library is worth adding.** The project already has a working, in-repo pattern to extend, not replace:
  - `acme-gate.ts`'s `probeAcme()`: `spawnSync(bin, ["--version"])`, falls back to `--help`, tests the combined `stdout+stderr` with a small case-insensitive regex. Never throws — a spawn error means "not available."
  - `host-tool.mts`'s `spawnHostTool(command, ["--version"], timeoutMs)` (used by the oracle probe) — the same idea, async and timeout-bounded.
- **A generic semver library (`semver` et al.) does not fit this problem.** None of the six external tools (`x64sc`/VICE, `c1541`, `petcat`, ACME, Ghidra's `analyzeHeadless`, `dxa`) emit strict semver in their version banners — VICE prints something like `3.9`, ACME `0.97 "Zem"`, Ghidra a build-qualified string. `semver`'s coercion helpers can be made to work on some of these with extra glue code, but that glue code is exactly the same size as just hand-rolling the comparison — adding the dependency buys nothing.
- **Recommend:** one small per-tool extraction regex (as `probeAcme()` already has) feeding a tiny hand-rolled numeric-tuple comparator: split each version string on `.`, `Number()` each segment, compare element-wise. This is a ~10–15 line function, easily unit-tested, with no dependency.
- **Sharp edge to name explicitly, because this project has already been bitten by it once:** `CLAUDE.md`'s own documented VICE constraint states that `CPUHISTORY_GET` needs VICE ≥3.10 while Debian ships 3.9 — a **naive string compare** of `"3.9"` vs `"3.10"` is wrong (`"3.9" > "3.10"` lexicographically), and would silently mis-gate the doctor's own version-floor check the same way. Whoever implements the doctor's version comparator must use the numeric-tuple form, not a string comparison, and a unit test asserting `compare("3.9", "3.10") < 0` is cheap insurance against reintroducing this exact class of bug in a second code path.

## Q5 detail — terminal output: colour, symbols, NO_COLOR, non-TTY

- `util.styleText` (in `node:util`) was added experimentally in the Node 20.12.0 line and promoted to **Stable** (stability index 2) via `nodejs/node#56265`; secondary sources place the stable landing in the Node 22 LTS line (cited variously as 22.8.0–22.13.0 across the sources checked — I could not pin the exact patch version beyond that range, but it is immaterial here: the project's floor is Node ≥24, well past any of these markers, so `styleText` is unconditionally stable everywhere the full server itself runs).
- **Measured directly in this session on Node 24.20.0** (the project's actual dev/floor version):
  - `styleText('red', 'hi')` on a real TTY emits ANSI codes as expected.
  - With `NO_COLOR=1` set, `styleText('red', 'hello (NO_COLOR=1)')` returns the **plain, unmodified string** — confirmed by inspecting the JSON-stringified output, no escape sequences present.
  - With stdout **not** a TTY (this sandbox's piped bash output), `styleText('red', 'hi')` also returns the plain string — confirmed by checking the returned string's exact length (`2`, i.e. no ANSI bytes), not just visual inspection.
  - **Conclusion: no extra handling code is needed for either `NO_COLOR` or non-TTY output — both are automatic, built into `styleText` itself.**
- The project already emits `✓ ✗ ◆ ○ ⚠` symbols elsewhere; nothing new is needed there — the doctor report should reuse the same symbol vocabulary for consistency, with `styleText` layering optional colour on top when available.
- **Integration hazard specific to this milestone (the reason this is not a trivial "just use styleText" answer):** `styleText` does not exist at all on a Node old enough to lack it (pre-20.12), and the doctor's bootstrap shim is explicitly required to run on Node versions below this project's own floor of 24 — the exact scenario the milestone exists to handle. The shim must feature-detect (`typeof styleText === "function"` after `const { styleText } = await import("node:util")` or equivalent) rather than assume its presence, and fall back to the plain Unicode symbols with no colour when it is missing. This is a cheap, local guard — not a reason to add a fallback colour library (see below).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Single-bin plain-`.mjs` bootstrap shim, version-gated inline | A second `vice-mcp-doctor` bin entry | Only if the documented invocation surface were `npx -p @henols/vice-mcp vice-mcp-doctor` instead of `npx -y @henols/vice-mcp doctor` — not the case here (measured: npx bin resolution does not multiplex on argv). |
| Explicit `process.versions.node` check before ever touching the `.ts` path | `import().catch()` as the sole detection mechanism | If the codebase later needs the doctor to also cope with *unpredictable* module-load failures beyond version (e.g. a corrupted install) — worth keeping as defense-in-depth, not primary logic. |
| Plain `.json` + a local JSON Schema for editor completion | YAML + `js-yaml`, or TOML + a TOML parser | Only if a future milestone needs genuinely human-authored multi-line values or deep nesting where JSON's syntax becomes painful — not the shape of either file here (flat maps / small records). |
| Hand-rolled per-tool version regex + numeric-tuple compare | The `semver` npm package | If a tool in this set ever adopts strict, guaranteed semver output (none currently do) *and* the number of tools grows enough that the per-tool regex maintenance cost exceeds one dependency's cost — not the case at 6 tools. |
| `util.styleText` + existing Unicode symbols | `chalk` / `kleur` / `picocolors` | If the project ever needs colour on a Node version below `styleText`'s stable floor as a **hard requirement** rather than a graceful degrade — not the case; the low-floor shim degrading to plain symbols is an acceptable, arguably *better* UX (a "too old" message shouldn't need colour to be legible). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Relying on `engines`/`engine-strict` to stop an old-Node invocation | **Measured false** in this session: npm 10.8.2 installed and executed a package declaring `engines.node: ">=24.0.0"` on Node 20.20.0 with no block, even with `engine-strict=true` in the consumer's own project `.npmrc` (matches known defect `npm/cli#2175`). It is metadata/documentation, not enforcement. | An explicit `process.versions.node` check inside the bin script itself, before any TypeScript file is touched. |
| A second `vice-mcp-doctor` bin entry | Doesn't match `npx -y @henols/vice-mcp doctor` — npx resolves one bin per invocation and passes `doctor` through as an argument, not a bin selector; reaching a second bin needs `-p`/`--package` gymnastics the milestone's target invocation doesn't use. | Single bin, subcommand dispatch inside the shim (`argv[2] === "doctor"`). |
| `js-yaml`, `iarna-toml`, `js-toml`, `toml`, or any YAML/TOML parser | Node has no built-in support for either format at 24 or 25 (verified); adding one is a new runtime dependency solely to store what is, in both files, a flat record/map — exactly what JSON already expresses natively. | Plain `.json`. |
| `jsonc-parser` or a hand-rolled JSONC comment-stripper | Same reasoning as YAML/TOML — a second, non-standard parsing code path for a feature (inline comments) that can be avoided by keeping explanatory text in CLI output instead of the data file. | Plain `.json`; explanatory prose in the doctor's stdout / README, not the file. |
| `ajv`, `zod`, or any JSON-Schema-interpreting validation library | The `$schema` key already buys editor-side completion for free (client-side, editor's own JSON language service); runtime validation of a small flat map is cheaper and more explicit as hand-written code that the doctor needs to write anyway to *use* the values. | A small hand-written validator, in the same shape as `host-tool.mts`'s existing `normaliseHostToolRequest()`. |
| `semver` or `compare-versions` | These tools' version banners are not strict semver (`3.9`, `0.97 "Zem"`, build-qualified Ghidra strings); a generic semver parser needs as much per-tool glue code as a hand-rolled comparator, for no benefit. | A ~10–15 line numeric-tuple comparator (split on `.`, `Number()`, compare element-wise) — and a unit test guarding against the exact `"3.9"` vs `"3.10"` lexicographic-compare bug this project's own `CLAUDE.md` already documents as a real VICE-version pitfall. |
| `command-exists`, `which`, or any PATH-probing library | The project already owns this exact responsibility across `resolvedBackend()` (`backend-detect.mts`), `findSiblingBinary()`/`findDxaBinary()`/`findAcmeLib()` (`host-tool.mts`) — the milestone's own decision record explicitly warns against "minting a second detection path" that could disagree with the one the real refusal paths use. | Call the existing probes; widen their exports (`function` → `export function`) if the doctor needs one that is currently module-private. |
| `chalk`, `kleur`, `picocolors`, or any terminal-colour dependency | `util.styleText` (stable at this project's floor) plus the project's existing ✓ ✗ ◆ ○ ⚠ symbol set already cover the full requirement at zero cost; Node's own migration guide frames `styleText` as the built-in chalk replacement. | `node:util`'s `styleText`, feature-detected for the low-floor shim. |
| `commander`, `yargs`, or any CLI-argument-parsing library, for the doctor's own flags | The doctor's argument surface is tiny (a subcommand plus maybe one or two flags); `node:util`'s built-in `parseArgs` (stable since the Node 20 line) already covers this with zero dependency, and the low-floor shim's own dispatch needs nothing more than `argv[2] === "doctor"`. | `node:util`'s `parseArgs`, or a raw `process.argv` check, in code that already assumes a high-enough floor to use it; the shim itself needs nothing more than a raw `argv` index check. |

## Stack Patterns by Variant

**If the invoking Node is at or above the project's floor (≥24):**
- The bootstrap shim hands off via `await import("../vice-proxy.ts")` exactly as today's `bin` entry already effectively does — no behavior change for the common case.
- All modern Node builtins (`styleText`, JSON import attributes, etc.) are safe to use anywhere in this path.

**If the invoking Node is below the project's floor:**
- The shim must never attempt to load anything TypeScript-flavored (verified: a raw `.ts` load crashes uncaught with `ERR_UNKNOWN_FILE_EXTENSION` and a full stack dump — exactly what today's `bin.vice-mcp` does on old Node, and exactly what this milestone exists to prevent).
- The shim runs the doctor's report using only already-compiled `resources/*.mjs` artifacts, `JSON.parse`/`readFileSync` for config, and `styleText` only if feature-detected present.
- "Node is too old" is reported as one row of the same capability-mapped report the doctor produces for every other prerequisite — not a special-cased error path — per the milestone's own decision record (target feature: "Capability-mapped output that names its own sources").

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|------------------|-------|
| `bin.vice-mcp` bootstrap shim | Any Node version the plugin's users plausibly run (measured down to Node 20.20.0 in this session) | Must stay inside plain, low-floor JS syntax — no TS-only syntax, no import-attribute JSON imports, no unconditional `styleText` use. |
| `node:util` `styleText` | Stable at Node ≥22 (per multiple sources; exact patch version within the 22 line not independently pinned, but immaterial — this project's floor is ≥24), **absent** below ~Node 20.12 | Feature-detect before use in the shim; unconditionally safe in the rest of the codebase, which already assumes Node ≥24. |
| JSON import attributes (`with { type: "json" }`) | Stable in the Node 22 line onward (ES2025 import attributes) | Safe in code that already assumes Node ≥24; **must not** be used in the low-floor shim — use `JSON.parse(readFileSync(...))` there instead. |
| `build.ts`'s `HOST_BOUND_ARTIFACTS` compile set | Existing mechanism, no version dependency of its own | Already includes `backend-detect.mts`/`host-tool.mts` (compiled to `resources/*.mjs`) — the doctor's probes are already on this path; only the doctor's own new source needs adding to the list. |
| npm 10.8.2 `engines`/`engine-strict` | Verified unreliable as an enforcement gate at this version, on both a plain and an `engine-strict=true`-configured install | Do not design around it; a code-level version check is the only mechanism that was actually verified to work in every tested configuration. |

## Sources

- `src/mcp/vice/package.json` — the real, current `bin`/`engines`/`files` fields (read directly).
- `src/mcp/vice/build.ts` — read directly; confirmed `HOST_BOUND_ARTIFACTS` already includes `backend-detect.mjs` and `host-tool.mjs` as compiled, committed artifacts.
- `src/mcp/vice/backend-detect.mts`, `src/mcp/vice/host-tool.mts`, `src/mcp/vice/acme-gate.ts` — read directly; confirmed the existing probe functions (`resolvedBackend()`, `findSiblingBinary()`, `findDxaBinary()`, `findAcmeLib()`, `probeAcme()`) and their spawn/regex version-detection pattern.
- `.planning/PROJECT.md` (`## Current Milestone: v1.1.0 The Prerequisite Doctor`, `## Constraints`) — read directly for scope and the five standing decisions.
- Empirical measurements performed in this session, against real installed binaries (`~/.nvm/versions/node/{v20.20.0,v22.13.0,v24.20.0}`, system `npm` 10.8.2): direct `.ts` execution crash behavior, dynamic-`import()` catchability, `engines`/`engine-strict` enforcement (default, `engine-strict=true` via consumer `.npmrc`, `--engine-strict` CLI flag, and PATH-scoped npx invocation), and `styleText`'s `NO_COLOR`/non-TTY behavior. Reproduction commands are straightforward re-runs of `npm pack` + `npm install`/`npx --yes` against a throwaway local package and are not repeated verbatim here.
- Web search, cross-checked against 2+ independent results each: Node type-stripping timeline (23.6 default-on, 22.18 LTS backport, 24.12/25.2 stable without a flag); `util.styleText` experimental-to-stable timeline and its framing as chalk's built-in replacement; npm bin-resolution behavior for multi-bin packages; JSON import-attribute (`with { type: "json" }`) standardization and Node support; absence of any built-in Node TOML/YAML module; `$schema`-key editor completion being client-side/zero-dependency; the `npm/cli#2175` engine-strict defect.
- `github.com/nodejs/node` commit `f6d0c01303` ("doc: stabilize util.styleText", PR #56265) — fetched directly for the stability-index change.

---
*Stack research for: CLI prerequisite doctor / tool-location config, `@henols/vice-mcp` v1.1.0*
*Researched: 2026-09-16*
