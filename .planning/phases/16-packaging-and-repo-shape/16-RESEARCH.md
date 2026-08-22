# Phase 16: Packaging and Repo Shape - Research

**Researched:** 2026-08-22
**Domain:** Repository layout migration (npm packaging, Claude Code plugin manifest, CI), test-gate mechanics for CLI scripts, comment-hygiene grep gates, and broker network-exposure posture
**Confidence:** HIGH for layout/mechanics (verified by reading the actual source this session); MEDIUM for the PKG-04 either/or recommendation (a judgment call over a previously-decided, well-documented tradeoff, not a fact); LOW/none for anything requiring a decision only a human can make (the dev-mode story)

## Summary

This phase has two genuinely different kinds of work bolted together by the roadmap's
sequencing logic, and the plan should treat them differently. **PKG-01** (relocate the
payload under a source directory, merge `.mcp.json`) is a large, mechanical, well-understood
move: this exact codebase has already moved this exact module tree three times before
(`tools/` → `.claude/skills/vice-session/scripts/` → `.claude/skills/vice-mcp-selector/scripts/`
→ `.claude/mcp/vice/`, per `repo-root.ts`'s own header), and `repo-root.ts`'s branch-4 hop
count (`three levels up from from`) is *hard-coded to the current depth*. The pending todo's
own proposed target, `src/mcp/vice/**`, preserves that exact depth (`src`/`mcp`/`vice` = 3
segments, same as `.claude`/`mcp`/`vice`), which is almost certainly why that shape was
proposed — it is the only literal `src/mcp/vice/` phrasing that requires zero change to
`repoRoot()`'s last-resort branch or its synthetic test. **The `.mcp.json` merge problem is
already solved in this codebase** — `wireMcp()` in `installer/bin/cli.mjs:168-201` already
does exactly the merge semantics the todo asks for (refuse on invalid JSON, coerce missing
`mcpServers`, touch only the `vice` key, leave a pre-existing `vice` entry alone unless
`--force`) — the remaining work is reuse, plus resolving one open question: does the
**plugin** install route need this merge at all, or does Claude Code's own plugin loader
already layer a plugin's declared `mcpServers` alongside a project's `.mcp.json` without
ever writing to the consumer's file? That is a product-behavior question this research
cannot answer by reading this repo's source, and the planner should resolve it early (see
Open Questions).

**PKG-02** (tests for `acme.mjs`/`driver.mjs`/`derive.mjs`) has one real blocker worth
surfacing now rather than at execution time: `npm test` (`node --test '*.test.*'`) and
`npm run test:automated` (`test-gate.mjs`'s `automatedTestFiles()`) both glob **only the
current working directory**, non-recursively (`readdirSync(dir)`, not a walk). A test file
for a skill script must therefore live inside `.claude/mcp/vice/` (post-move, `src/mcp/vice/`)
and reach the skill script via a relative path (`spawnSync` on the real file, or an ESM
`import` if the target script is refactored to export functions) — it cannot live next to
the script under `.claude/skills/<skill>/scripts/` and still be picked up by the existing
test runner invocation.

**PKG-03** (orphaned planning references, guarded against reintroduction) requires a **new**
guard, not an extension of an existing one. The existing `docs-dangling-refs.test.ts`
explicitly and deliberately scopes its phase-pointer detection to **string/template
literals only, never comments** — its own header calls out that a comment-scanning guard
would be self-invalidating (the commit that fixes a stale pointer legitimately wants to
quote the old wording in a "what NOT to do" comment). A blanket "no comment mentions
`Phase N`" rule is unusable here: this codebase's shipped `.ts`/`.mts` files carry **137**
legitimate historical `Phase N` mentions in comments (narrating when a decision was made),
versus only 2 known real violations (both *assignment*-shaped: "is Phase 8's business",
"Phase 7, via the text monitor"). The gate must therefore detect the **assignment shape**
specifically — reusing and extending `docs-dangling-refs.test.ts`'s own `ASSIGNMENT_RES`
pattern set — not the bare presence of a phase number.

**PKG-04** (control-plane network exposure) resolves to a specific, already-answered
question once the two different "control planes" in this codebase are told apart. VICE's
own binary-monitor TCP port is *already* bound to `127.0.0.1` by default and has been since
Phase 1/2 (multiple `T-01-1x`/`T-02-0x` security-table citations, `stock-handler.ts:105-116`
runtime text) — that part of "network exposure of the emulator control plane" is closed and
not this phase's remaining work. The **broker's own TCP control-plane listener**
(`broker-control.mts`, acquire/release/recycle/monitor-claim protocol) is the piece still
bound `0.0.0.0`, and its own module header states this is **deliberate**, decided at a
2026-08-03 blocking checkpoint with "no amendments": a loopback-only bind is *structurally
unreachable* from a container dialling `host.docker.internal`, which resolves to the docker
bridge gateway address, not to loopback. Narrowing the default would break the documented
container-consumer topology this project's own container-detection code exists to serve.
The evidence points toward the **accepted-risk** branch of criterion 4, not the
**narrowed** branch — see the dedicated section below for the full argument and the
counter-considerations a planner should weigh before locking it in.

**Primary recommendation:** Treat PKG-01 as a large, mostly-mechanical `git mv` plus a
literal-path sweep (this research enumerates the closed set of hardcoded consumers and the
grep commands used to find them, re-runnable at execution time); treat PKG-02 as three new,
automated (non-manual-only) test files living inside the MCP package directory that exercise
the skill scripts as subprocesses; build PKG-03 as a new, narrowly-scoped comment-assignment
scanner rather than widening the existing string-literal guard; and record PKG-04 as an
accepted risk in PROJECT.md's Key Decisions table, in the same dated, reversal-criteria style
already used for FORK-01, rather than attempting to narrow the broker's bind default.

## Architectural Responsibility Map

This project has no browser/SSR/API/CDN tiers — it is a CLI-driven MCP server plus a
packaging/distribution pipeline. The template's tiers are mapped onto this project's actual
architecture:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payload relocation (PKG-01) | Repo source layout (`.claude/mcp/vice/`, `.claude/skills/` → `src/**`) | npm package manifests (`files[]`, `bin`) | The move is a filesystem/build-tooling concern; the npm manifests are the only thing that turns "files on disk" into "what ships" |
| `.mcp.json` merge (PKG-01) | Installer CLI (`installer/bin/cli.mjs`) | Claude Code plugin loader (out of this repo's control) | `wireMcp()` already owns the merge for the npm-install route; the plugin route's behavior is a Claude Code product question, not this repo's code |
| CLI-script tests (PKG-02) | Test suite (`.claude/mcp/vice/*.test.ts`, `node --test`) | Skill scripts themselves (`.claude/skills/*/scripts/*.mjs`) | The test *runner*'s glob scope (cwd-only, non-recursive) is the binding constraint, not the scripts' own logic |
| Orphaned reference gate (PKG-03) | Test suite (a new `*.test.ts` guard) | Source comments across `.claude/mcp/vice/*.ts`/`*.mts` | Mirrors the existing `docs-dangling-refs.test.ts` architecture: a guard test that reads real source, not a copy |
| Control-plane exposure (PKG-04) | Broker control-plane (`broker-control.mts`, host-side network listener) | PROJECT.md Key Decisions (documentation tier) | The bind address is a network-topology decision already made at a blocking checkpoint; the remaining work is documentation, not code, on the recommended branch |
| CI / release pipeline | `.github/workflows/ci.yml`, `scripts/package.sh`, `scripts/version.mjs` | npm registry (OIDC publish) | Every hardcoded working-directory and `mustExist` path in CI must track the move |

## Standard Stack

No new libraries are introduced by this phase. All work uses tooling already in the
repository: Node's built-in `node:test`/`node:assert/strict` runner, `node:child_process`
(`spawnSync`) for subprocess-based CLI testing, and the existing character-state-machine
literal/comment extraction pattern already proven in `docs-dangling-refs.test.ts`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` (built-in) | Node ≥22.18 (bundled) | Test runner for the three new CLI-script test files and the new PKG-03 comment-gate test | Already the sole test framework in this repo; no alternative was ever considered here |
| `node:child_process` `spawnSync` (built-in) | bundled | Exercising `acme.mjs`/`driver.mjs`/`derive.mjs` as real subprocesses (they export no functions except `driver.mjs`'s `lookup`) | Matches the argv-array-never-shell-string discipline `test-gate.mjs`/`r2000-cli.test.ts` already use throughout this repo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | — | — | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Subprocess (black-box) testing of the three CLI scripts | Refactor `driver.mjs`/`derive.mjs` to `export` their pure functions and unit-test directly | Unit tests are faster and give sharper failure messages, but touch shipped, user-facing skill scripts merely to add test seams, and `acme.mjs`'s core logic (`build()`) genuinely needs the `acme` binary — a pure-unit approach cannot cover it end to end anyway. Recommend: **subprocess tests for all three, uniformly**, to keep the pattern consistent and the skill scripts untouched. `driver.mjs` already exports `lookup`; a test may use that export directly for the pure-lookup cases and subprocess-drive the CLI surface (`annotate`, `memmap`'s absence-of-network-need) for the rest. |
| A comment-assignment scanner mirroring `ASSIGNMENT_RES` | A blanket "no comment names a phase number" rule | Measured this session: 137 legitimate historical comment mentions of `Phase N` exist in shipped `.claude/mcp/vice/*.ts`/`*.mts` files today. A blanket rule is not viable — see PKG-03 section. |

**Installation:** none — no packages to install.

**Version verification:** N/A — no new dependency, so no registry check applies.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. It relocates existing source,
adds test files using only Node built-ins, and edits documentation/manifests. `npm view`
was not needed and was not run against any new package name.

## PKG-01: Payload Relocation — What Moves, and the Closed Consumer Set

### What moves

The plugin payload is everything Claude Code auto-discovers or that the two published
packages ship. Enumerated by reading `.claude-plugin/plugin.json`, both packages'
`package.json` `files[]`, and a full-repo top-level listing this session:

| Current path | Contents | Proposed target (matches `repo-root.ts`'s hard-coded depth, see below) |
|---|---|---|
| `.claude/mcp/vice/` (~180 files: ~70 shipped `.ts`/`.mts` modules per `package.json` `files[]`, plus colocated `*.test.ts`, `fixtures/`, `resources/`, `node_modules/` (gitignored)) | The MCP server, its tests, and its generated-but-committed host launcher artifacts | `src/mcp/vice/` |
| `.claude/skills/` (6 skill directories: `acme-build`, `c64-memory-mapping`, `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage`) | The six shipped skills (`SKILL.md` + `scripts/*.mjs` + data files) | `src/skills/` |
| `installer/`, `scripts/`, `.mcp.json`, `.claude-plugin/*.json` | NOT proposed to move — these already sit at repo root by design (npm package root for the installer, CI/build scripts, the plugin manifest itself) | unchanged |

`installer/` (the `@henols/c64-re-tools` package) and `scripts/` (CI/build helpers) are
**not** part of "the plugin payload" in the sense the todo means — they are already outside
Claude Code's auto-discovery paths (`installer/` is a separate npm package directory;
`scripts/` is referenced only by CI and `package.sh`, never auto-loaded by Claude Code).
The todo's own files list conflates "files that reference the payload's location" with "the
payload itself" — the enumeration below separates the two.

**How this was enumerated (re-runnable at execution time):**
```bash
cat .claude-plugin/plugin.json          # skills:, mcpServers:, hooks: fields
cat .claude/mcp/vice/package.json       # files[] — the exact shipped module list
find . -maxdepth 2 -type d | sort       # confirm no other auto-discoverable dirs exist
grep -rn '"\.claude/mcp/vice"\|'"'"'\.claude/mcp/vice'"'"'' \
  --include="*.ts" --include="*.mjs" --include="*.mts" --include="*.json" \
  --include="*.sh" --include="*.yml" . | grep -v node_modules
```

### The closed set of hardcoded literal-path consumers (verified this session, file:line)

These are places the literal string `.claude/mcp/vice` (or `.claude/skills`) is used
**functionally** — in a path-construction, an assertion, a `files[]`/`mustExist` list, or a
user-facing string — as opposed to a comment mentioning it for narrative purposes only
(cosmetic; lower priority, see "Comment-only mentions" below).

| File:line | What it does | Action needed |
|---|---|---|
| `.mcp.json:5` | `"args": ["${CLAUDE_PLUGIN_ROOT}/.claude/mcp/vice/vice-proxy.ts"]` | Update to `${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts` |
| `.claude-plugin/plugin.json` | `"skills": "./.claude/skills/"` | Update to `"./src/skills/"` |
| `scripts/ensure-mcp-deps.sh` | `MCP_DIR="$PLUGIN_ROOT/.claude/mcp/vice"` | Update literal |
| `scripts/package.sh:93` (`mustExist` array) | `.claude/mcp/vice/vice-proxy.ts` in the required-files list | Update literal |
| `scripts/package.sh:97,104` | `path.join(root, ".claude/skills")`, error text `"missing .claude/skills/"` | Update literal |
| `scripts/check-npm-packages.mjs:52,127` | `packFiles(join(ROOT, ".claude/mcp/vice"))`, `const viceDir = join(ROOT, ".claude/mcp/vice")` | Update literal |
| `scripts/check-skill-tool-coverage.mjs:54` | `const SKILLS_DIR = join(ROOT, ".claude/skills")` | Update literal |
| `scripts/check-skill-fork-honesty.mjs:63,64` | `const VICE_DIR`, `const SKILLS_DIR`, both `join(ROOT, ".claude/…")` | Update literal |
| `scripts/generate-tool-support-table.mjs:45` | `const VICE_DIR = join(ROOT, ".claude/mcp/vice")` | Update literal |
| `installer/bin/cli.mjs` | writes into `<target>/.claude/skills/` — this is the **consumer's own project**, not this repo's source tree; deliberately unchanged (it is the installer's own convention for target projects, unrelated to where the installer's *source copy* of the skills lives in `SKILLS_SRC`) | No change — verify this understanding at execution time |
| `installer/scripts/sync-skills.mjs` | `const SRC = join(REPO_ROOT, ".claude", "skills")` | Update to `join(REPO_ROOT, "src", "skills")` |
| `.claude/mcp/vice/assumption-label-discipline.test.ts:71` | `const VICE_DIR = join(ROOT, ".claude/mcp/vice")` | Update literal (file itself also moves) |
| `.claude/mcp/vice/version.test.ts:352` | `readFileSync(join(root, ".claude/mcp/vice/vice-proxy.ts"), "utf8")` — note this hardcodes the directory even though the test lives *inside* it; should arguably become `join(HERE, "vice-proxy.ts")` while being touched anyway | Update literal (prefer `HERE`-relative) |
| `.claude/mcp/vice/r2000-cli.ts:64` | `PLUGIN_INVOCATION = "node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 <verb>"` — a **user-facing** string shown in CLI usage text | Update literal |
| `.claude/mcp/vice/package.json` `repository.directory` | `"directory": ".claude/mcp/vice"` (npm registry metadata) | Update to `"src/mcp/vice"` |
| `installer/package.json` `repository.directory` | `"directory": "installer"` | Unchanged (installer itself doesn't move) |
| `CLAUDE.md` | Dozens of prose mentions of `.claude/mcp/vice/*` throughout every section | Sweep as part of this phase; **the D-07 constraint's `vice-proxy.ts:2889`/`vice-proxy.ts:1368`-style citations are bare filenames, not full paths** (confirmed — see PKG-01 mechanics section below), so line numbers are unaffected by the directory move, only the prose around them |

**How this was found:**
```bash
grep -rn '"\.claude/mcp/vice"\|'"'"'\.claude/mcp/vice'"'"'\|\.claude/mcp/vice/vice-proxy\|CLAUDE_PLUGIN_ROOT.*\.claude' \
  .claude/mcp/vice/*.ts .claude/mcp/vice/*.mts .mcp.json .claude-plugin/plugin.json \
  scripts/*.mjs scripts/*.sh 2>/dev/null | grep -v node_modules
```
Re-run this (and the mirror for `.claude/skills`) at execution time — content will have
shifted since this session.

### Comment-only mentions (cosmetic, not blocking)

A repo-wide grep found **137** comment-only mentions of `Phase N` inside shipped
`.claude/mcp/vice/*.ts`/`*.mts` source (historical narration: "this decision was made in
Phase X"), and roughly 30 comment-only mentions of literal `.claude/skills/...` paths
(cross-references between modules and the skill docs/scripts they mirror or depend on,
e.g. `stock-vicii.ts:64` citing `c64-memory-mapping/memmap.json`). These do not affect
runtime behavior or any test assertion and are not part of the closed consumer set above.
They should still be swept for accuracy (this phase's own goal text says "sweep... a single
time"), but they are not gating and can be handled as a bulk find-replace pass, distinct
from the functional consumer list. **They also do not trip the PKG-03 orphaned-reference
gate** — that gate is scoped to phase-*assignment* shapes, not general path mentions (see
PKG-03 section).

A small number of these comments embed a path in **generated output text** rather than
pure narration, and those need the same care as functional literals:
`.claude/skills/c64-provenance-diff/scripts/diff-images.mjs:696,711,786` write
`.claude/skills/c64-provenance-diff/scripts/diff-images.mjs` into generated Markdown
(`<!-- GENERATED... Regenerate with: node .claude/skills/... -->`), and
`.claude/skills/c64-ram-capture/scripts/watch-loads.mjs:455` embeds a similar
self-referential path in user-facing prose. Both need updating so a regenerated artifact
names the *correct* invocation path after the move.

### Why `git mv`, not regenerate: the depth constraint

`repo-root.ts` (the ONE shared repo-root resolver every module in this tree uses) has
already survived three real relocations of this exact module family, and documents each
one in its own header comment:

> "originally, each of the three modules resolved the repo root with a fixed
> `resolve(dirname(SELF), "..", ...)`... a move put them THREE levels deeper, at
> `.claude/skills/vice-session/`'s `scripts/` directory... THIRD MOVE (quick-260731-p8a): the
> implementation relocated again... into a new, flattened, non-skill `.claude/mcp/vice/`
> directory — ONE level SHALLOWER than the old `.claude/skills/<skill>/scripts/` shape...
> Branch 4's hop count below moved from four levels to three to match."
> — `.claude/mcp/vice/repo-root.ts:8-41`

`repoRoot()`'s branch 4 (the documented last-resort fallback, never actually exercised in
this repo today because branch 2's `.git`-ancestor walk always wins first, but pinned by a
synthetic test in `repo-root.test.ts`) is **hard-coded to "three levels up from `from`"** —
this is exactly why `.claude/mcp/vice/` (`.claude`/`mcp`/`vice` = 3 segments) works today.
`src/mcp/vice/` preserves the identical depth (`src`/`mcp`/`vice` = 3 segments). **If the
planner chooses this exact target, branch 4's hop count and its comment need zero
changes.** Any other target shape (e.g. flattening to `src/vice-mcp/` at 2 levels, or
nesting one level deeper) requires updating `repoRoot()`'s branch-4 literal, its doc
comment, and the synthetic test in `repo-root.test.ts` that pins the number — all three, or
the guard silently drifts from what the code actually does.

Given this precedent (three prior successful moves of this exact tree, using this exact
mechanism), a plain `git mv .claude/mcp/vice src/mcp/vice` and `git mv .claude/skills
src/skills` — moving every file byte-identically, including the **committed generated**
`resources/*.mjs` artifacts — is sufficient. **Do not regenerate `resources/` as part of
the move.** `build.ts`'s emitted content is derived from `.mts` source content via
`HERE`-relative paths (`join(HERE, "tsconfig.build.json")`, `resolveOutDirAbs("resources")`
defaulting to a directory *relative to the module's own location*) and contains no
absolute or old-directory-relative paths baked into its bytes — moving the whole tree as a
unit preserves `resources-sync.test.ts`'s "resources/ is byte-identical to a fresh build of
its TypeScript source" invariant automatically, since both sides of that comparison move
together. **Order of operations that keeps every gate green between commits:**

1. `git mv .claude/mcp/vice src/mcp/vice` and `git mv .claude/skills src/skills` in one
   commit (a directory rename is one atomic git operation; splitting it risks an
   intermediate state where `npm test`'s cwd-relative glob finds nothing).
2. In the same commit, update the closed consumer set above (`.mcp.json`,
   `.claude-plugin/plugin.json`, the five `scripts/*.mjs` files, `scripts/package.sh`,
   `scripts/ensure-mcp-deps.sh`, `installer/scripts/sync-skills.mjs`, the two hardcoded
   `.ts` literals, `package.json`'s `repository.directory`).
3. Run `npm test`, `npm run typecheck`, `scripts/package.sh`, `scripts/check-npm-packages.mjs`,
   `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-fork-honesty.mjs` — all from
   their new working directories — before committing further prose-only sweeps.
4. Sweep `CLAUDE.md`, `README.md`, comment-only mentions, in a follow-up commit (or the same
   one if the diff stays reviewable) — these do not block any gate but are the "sweep once"
   this phase exists to do.

### Does the SessionStart hook path survive the move?

Yes, unchanged in mechanism: `ensure-mcp-deps.sh` resolves `PLUGIN_ROOT` from
`CLAUDE_PLUGIN_ROOT` (env, set by Claude Code) with a fallback to its own script location
(`$(dirname "${BASH_SOURCE[0]}")/..`) — neither depends on the *vice-mcp* directory's depth,
only on the script's own location relative to the plugin root, which is unaffected by moving
`.claude/mcp/vice`. Only its one internal literal (`MCP_DIR="$PLUGIN_ROOT/.claude/mcp/vice"`)
needs updating, per the table above.

## PKG-01: `.mcp.json` Merge — What "Merged" Concretely Means

**The merge logic already exists and already works.** `wireMcp()`
(`installer/bin/cli.mjs:168-201`) implements exactly the semantics the todo describes:

```javascript
// installer/bin/cli.mjs:168-201 (verified this session, quoted verbatim)
function wireMcp(target, { force, dryRun, vendor }) {
  const mcpPath = join(target, ".mcp.json");
  let config = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    const parsed = readJson(mcpPath);
    if (parsed === undefined) {
      console.error(
        `c64-re-tools: FAIL -- ${mcpPath} exists but is not valid JSON. ` +
          `Refusing to overwrite it; fix or remove it and re-run.`
      );
      process.exit(1);
    }
    config = parsed;
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      console.error(`c64-re-tools: FAIL -- ${mcpPath} is not a JSON object.`);
      process.exit(1);
    }
    if (typeof config.mcpServers !== "object" || config.mcpServers === null) {
      config.mcpServers = {};
    }
  }
  const existed = Object.prototype.hasOwnProperty.call(config.mcpServers, "vice");
  let action;
  if (existed && !force) {
    action = "kept"; // leave the user's existing entry alone
  } else {
    action = existed ? "updated" : "added";
    if (!dryRun) {
      config.mcpServers.vice = viceServerEntry(vendor);
      mkdirSync(dirname(mcpPath), { recursive: true });
      writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");
    }
  }
  return { mcpPath, action };
}
```

This already handles every edge case the additional-context questions named: **file
absent** (default `{mcpServers:{}}`), **malformed JSON** (`readJson` returns `undefined` →
refuse, exit 1, never overwrite), **not a JSON object / array** (refuse), **missing
`mcpServers` key** (coerced to `{}`), **existing `vice` key with different config**
(left alone unless `--force`, in which case overwritten), **other unrelated `mcpServers`
keys** (untouched — `config = parsed` preserves everything, only `config.mcpServers.vice`
is ever mutated). **JSONC/comments are not handled** — `readJson` presumably calls
`JSON.parse`, which has no comment tolerance; if a consumer's `.mcp.json` legitimately
contains JSONC comments this will report "not valid JSON" and refuse rather than corrupt
it, which is the safe failure mode, not a silent data-loss one.

**What actually needs to change for PKG-01:** per the pending todo's own Solution step 3,
"reuse `wireMcp()`... do not reimplement the merge" — this is already satisfied for the
**npm installer route** (`npx @henols/c64-re-tools`). The open question is the **plugin
route**.

### Open question the planner must resolve early: does the plugin route even need a merge?

`.claude-plugin/plugin.json` declares `"mcpServers": "./.mcp.json"` — a manifest pointer,
not an install-time file write. This research could not determine, by reading this repo's
source alone, whether Claude Code's plugin loader:

(a) reads the plugin's declared `.mcp.json` and layers its `mcpServers` entries into the
    running session's *in-memory* server registry, alongside (not overwriting) the
    consumer project's own `.mcp.json` — in which case there is **no file-merge problem
    for the plugin route at all**, only for the npm-installer route (already solved); or

(b) actually writes/copies the plugin's `.mcp.json` onto the consumer's project file at
    some point — in which case the todo's premise holds and the plugin route needs its own
    merge step, which does not currently exist anywhere in this repo (nothing routes plugin
    installs through `wireMcp()` or an equivalent).

**Recommendation:** resolve this via Claude Code's own plugin documentation (out of this
repo) or a live experiment (install this plugin from a local marketplace source into a
throwaway project that already has a `.mcp.json` with an unrelated server, and observe
whether that unrelated server keeps working) before writing tasks that assume (b). If (a)
holds, PKG-01's `.mcp.json`-merge success criterion is **already satisfied** for the
product's actual install path, and the remaining PKG-01 work is purely the layout move; the
only test gap would be a regression test on `wireMcp()` itself (does one already exist?
check `installer/bin/cli.mjs`'s own test coverage, not found under `.claude/mcp/vice/` in
this session's search — installer/ appears to have no test file at all, which is itself a
gap worth flagging to the planner even though it's not one of the four named success
criteria).

### The dev-time story (load-bearing, must be decided first, per the todo itself)

The todo names this explicitly: "Only accessible when installed correctly" directly
conflicts with this repo dogfooding its own plugin from repo-root auto-discovery paths.
Options, as the todo itself lays out:
- **(a)** Install the plugin from a local marketplace source (`marketplace.json` already
  declares `"source": "./"`) — likely near-free once the manifest paths point into `src/`.
- **(b)** A gitignored `.claude/settings.local.json` dev opt-in pointing at the relocated
  payload.
- **(c)** Accept losing in-repo autoload; drive everything through a real install.

This is exactly the kind of either/or a `/gsd-discuss-phase` pass would normally settle —
no CONTEXT.md exists for this phase, so the planner is the first place this gets decided.
Recommend **(a)**: it is described by the todo's own author as "may be nearly free" given
`marketplace.json`'s existing `"source": "./"`, and it keeps this repo's own development
loop closest to what a real consumer experiences (closing exactly the
"development-in-place and installed-consumer are indistinguishable" gap the todo opens
with). Verify this experimentally as the phase's first task, since it is genuinely
untested — this repo has never installed itself from a local marketplace source before.

## PKG-02: Tests for the Three CLI Scripts

### Exact locations and public surface

| Script | Path | Verbs | External dependency | Testable without it |
|---|---|---|---|---|
| `acme.mjs` | `.claude/skills/acme-build/scripts/acme.mjs` | `new <file>`, `build <file>`, `sym <file>` | `acme` binary on `PATH` (build/sym spawn it via `spawnSync`) | `new` (writes `template.a`, no ACME needed); argument-parsing error paths (`parseOpts`'s `die()` calls) |
| `driver.mjs` | `.claude/skills/c64-memory-mapping/scripts/driver.mjs` | `lookup <addr>...`, `annotate [--file f] [--out f] [--max-span N] [--no-header]`, `memmap` (rebuild) | `memmap` needs network (fetches 4 upstream HTML/text pages); `lookup`/`annotate` need only the already-committed `memmap.json` | `lookup`, `annotate` (both offline, off committed data) |
| `derive.mjs` | `.claude/skills/c64-program-recon/scripts/derive.mjs` | `vic --dd00.. --d018..`, `sprites --dd00.. --ptrs..`, `vectors <image.bin>` | None — pure arithmetic; `vectors` reads a file path supplied on the command line (test can supply a synthetic 65536-byte buffer) | All three verbs, fully |

None of the three scripts `export` anything except `driver.mjs`'s `lookup` function
(`export { lookup };` at `driver.mjs:534`, guarded so importing it does not also run the
CLI). `acme.mjs` and `derive.mjs` export nothing — every verb lives behind the
`if (process.argv[1] && ...)` CLI-dispatch guard equivalent, or (for `acme.mjs`) unguarded
top-level execution (`VERBS[cmd](rest);` at file scope). **This means testing `acme.mjs` and
`derive.mjs` requires spawning them as real subprocesses**; `driver.mjs`'s `lookup` alone
can be unit-tested via direct `import`.

### The real blocker: test-runner discovery is cwd-only, non-recursive

Verified this session, both mechanisms:

```javascript
// .claude/mcp/vice/test-gate.mjs:107-113 (quoted verbatim)
export function automatedTestFiles(dir) {
  const all = readdirSync(dir).filter((f) => /\.test\.[a-zA-Z0-9]+$/.test(f));
  return all.filter((f) => !MANUAL_ONLY_TESTS.includes(f)).sort();
}
```
and `package.json`'s `"test": "node --test '*.test.*'"` — a shell glob expanded relative to
the invocation's cwd (`.claude/mcp/vice`, soon `src/mcp/vice`), also non-recursive.

**Consequence:** a test file placed under `.claude/skills/acme-build/scripts/` (next to the
script it tests) will **never run** under `npm test` or `npm run test:automated`. The test
file **must** live inside `.claude/mcp/vice/` (post-move, `src/mcp/vice/`) and reach the
skill script via a relative path one level up and back down
(`join(HERE, "..", "..", "skills", "acme-build", "scripts", "acme.mjs")` post-move, given
the proposed `src/mcp/vice/` and `src/skills/` sibling layout — verify the exact relative
hop count against whatever final layout is chosen).

### Recommended shape: three new test files, subprocess-based

Following this repo's own established pattern (`r2000-cli.test.ts` and
`disasm-roundtrip.test.ts` both spawn real subprocesses/binaries and gate on an
availability check), add:
- `skill-acme-build-cli.test.ts` — spawns `acme.mjs new`/`build`/`sym` against a scratch dir
- `skill-memory-mapping-cli.test.ts` — imports `lookup` directly for pure address-lookup
  assertions, plus spawns `driver.mjs annotate --file <fixture>` for the CLI surface
- `skill-program-recon-cli.test.ts` — spawns `derive.mjs vic`/`sprites`/`vectors` with known
  register values and asserts on stdout content (e.g. VIC bank/mode decode is fully
  deterministic given `derive.mjs`'s own published formulas)

### ACME availability: reuse the existing gate seam, do not invent a new one

`acme.mjs build`/`sym` need the real `acme` binary. This repo already has exactly this
problem solved for `disasm-roundtrip.test.ts`, which imports
`ACME_BIN`/`acmeSkipReasonFor`/`assertAcmeRequiredIfEnvSet` from `r2000-test-gate.ts` (a
test-only module, deliberately excluded from `package.json`'s `files[]`), and CI already
sets `VICE_REQUIRE_ACME: "1"` on the `Test` step (turning "ACME absent" from a silent skip
into a hard failure) after a dedicated CI step installs `acme` via `apt` — see
`.github/workflows/ci.yml`'s `Install ACME cross-assembler (DISASM-03 round-trip gate)`
step. **Reuse this exact seam for the new `acme.mjs` test** rather than writing a second,
parallel ACME-availability check — this is precisely the kind of duplication
`r2000-test-gate.ts`'s own header warns against (a shared seam existing for exactly this
reason).

### Does the new test belong in `MANUAL_ONLY_TESTS`?

**No.** `MANUAL_ONLY_TESTS` is reserved for tests needing "manual host setup — a real
broker topology and a real emulator/display environment" (`test-gate.mjs`'s own header) —
none of the three CLI scripts need an emulator, a broker, or a display. `driver.mjs`'s
`memmap` verb needs network access, but the tests should exercise `lookup`/`annotate`
against the already-committed `memmap.json`, never invoke `memmap` itself (which would also
overwrite a committed file with live-fetched content — clearly wrong for a test). `acme.mjs`
needs the `acme` binary, but that dependency is already handled by the `VICE_REQUIRE_ACME`
gate pattern above, which runs the test for real in CI (not skip-by-default) — this is the
same disposition `disasm-roundtrip.test.ts` already has, and it is **not** in
`MANUAL_ONLY_TESTS` either. Adding a tenth manual-only entry when the dependency is already
solved elsewhere would be a regression from the pattern this repo has converged on.

## PKG-03: Orphaned Planning References — Precise Definition and Gate Design

### What "orphaned planning reference" means here (scoped precisely)

Two prior, related-but-distinct guards already exist in this codebase for adjacent
problems, and it is important the planner not conflate PKG-03 with either:

1. **`docs-dangling-refs.test.ts`**'s `.vsf`-specific test: sentences in **normative
   documents** (`.planning/ROADMAP.md`, `REQUIREMENTS.md`, `CLAUDE.md`, `README.md`, two
   `docs/*.md` files) that both mention `.vsf` **and** hand a topic to a numbered phase.
   Narrow by design (one topic).
2. **`docs-dangling-refs.test.ts`**'s FLOW-02 blanket test: **any shipped `.claude/mcp/vice`
   string/template literal** naming `Phase N` — deliberately **string-literal-only, never
   comments**, because a comment legitimately wants to quote old wording in a "what NOT to
   do" note, and a comment-scanning guard would fail on the very commit that fixes the
   violation it exists to prevent.

**PKG-03 is a third, new category**: a source **comment** that hands *pending/future*
work to a numbered phase using assignment-shaped language, where — unlike FLOW-02's
blanket ban — the corresponding *narration* form ("this was decided in Phase X") must stay
legal, because 137 legitimate instances of it already exist in the shipped tree.

**Precise definition to hand the planner:** an orphaned planning reference (in this phase's
scope) is a source comment in `.claude/mcp/vice/*.ts`/`*.mts` (post-move,
`src/mcp/vice/*.ts`/`*.mts`) that assigns **pending or future work** to a numbered phase —
using a possessive-noun form ("Phase N's `<responsibility>`"), an "is/belongs to" form ("is
Phase N's business/job/responsibility"), a comma-appositive form ("Phase N, via `<route>`"),
or a verb-first assignment form ("moves to/deferred to/handed to Phase N") — as opposed to a
historical-narration form ("this was built/decided/fixed in Phase N", "per Phase N's
D-something"), which remains legal.

### The two known current violations (verified this session, file:line, quoted verbatim)

```
.claude/mcp/vice/stock-cia.ts:39
//     (`docs/stock-vice-parity.md` SS A item 2) and is Phase 8's business.

.claude/mcp/vice/stock-dispatch.ts:633
 *   - `vice_disk_detach` (D-13 -- Phase 7, via the text monitor)

.claude/mcp/vice/stock-dispatch.ts:634
 *   - `vice_joystick_tap` (needs a resume plus Phase 7's timing route)
```
(Both files already carry `resolves_phase: 16` in the owning todo's frontmatter —
`.planning/todos/pending/2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md`
— which also specifies the exact fix for each: `stock-cia.ts:39` should state the permanent
protocol limitation directly rather than attribute it to a phase; `stock-dispatch.ts:614-615`
(the todo's own line numbers; verified at :633-634 this session, confirm current line
numbers at execution time since Phase 15 edited nearby content) should point
`vice_joystick_tap` at `stock-input.ts`'s own permanent-exclusion header instead of "Phase
7's timing route", and `vice_disk_detach` should either become real scoped backlog or an
explicit, recorded cut — not left pointing at a closed phase.)

### Why the existing regex patterns do not catch these violations as-is

`docs-dangling-refs.test.ts`'s `ASSIGNMENT_RES` (three regexes, quoted verbatim,
`docs-dangling-refs.test.ts:75-80`):
```javascript
const ASSIGNMENT_RES = Object.freeze([
  /\b(?:moves?|move|moved|deferred|defers?|belongs?|lands?|pushed|punted|reassigned|handed)\b[^.;]{0,80}?\bPhase\s+\d+/i,
  /\bPhase\s+\d+(?:'s|s')\s+[^.;]{0,60}?\b(?:extension|home|scope|deliverable|remit)\b/i,
  /\b(?:home|owner|owned by|covered by|claimed by|lives in)\b[^.;]{0,40}?\bPhase\s+\d+/i,
]);
```
Tested against the two known violations by inspection: `"is Phase 8's business"` matches
none of the three (pattern 2's noun list is `extension|home|scope|deliverable|remit` —
`business` is absent); `"Phase 7, via the text monitor"` matches none (no comma-appositive
pattern exists); `"Phase 7's timing route"` matches none (pattern 2's noun list lacks
`route`/`timing route`). **A new or extended pattern set is required** — either broaden
pattern 2's noun alternation (add `business|job|task|route|timing route|via`) or add a
dedicated comma-appositive pattern (`/\bPhase\s+\d+\s*,\s*via\b/i`) and an "is Phase N's"
auxiliary form. **Before finalizing the pattern, dry-run it against all 137 existing
comment mentions of `Phase N`** in the shipped tree (the false-positive risk this session's
count establishes) to confirm zero new false positives — this is the single most important
verification step for this gate, since an unusable (too-noisy) guard gets deleted, per this
codebase's own stated principle (`docs-dangling-refs.test.ts`'s comment: "a guard that
cannot be satisfied gets switched off").

### Gate design: mirror the existing comment/string extractor, invert its scope

`docs-dangling-refs.test.ts` already ships a hand-written character-state-machine literal
extractor (`extractStringLiterals()`, `docs-dangling-refs.test.ts:194-294`) that correctly
distinguishes comments from strings/templates while walking source character-by-character
(chosen over a regex extractor after a regex was *measured* to miss a real violation sitting
inside a template literal — see that function's own header). **The natural implementation
for PKG-03 is the same state machine, inverted**: capture comment content (both `//` and
`/* */` spans) instead of skipping it, while still correctly skipping over string/template
literal bodies (so a phase number that happens to appear *inside a string* is not
double-counted by this guard — FLOW-02 already owns that surface). Reusing the proven state
machine (rather than writing a second, independent one) avoids re-measuring the same
regex-blindness failure mode this codebase already paid for once.

### Where the gate runs, and file scope

A new test file (e.g. `comment-phase-pointers.test.ts`) alongside the existing
`docs-dangling-refs.test.ts`, using the same `shippedTsModules()` seam (derived from
`package.json`'s `files[]`, not hand-enumerated) so a module added later is covered
automatically. This makes it part of `npm test` and (unless a reason emerges to exclude it)
`npm run test:automated` — it needs no emulator, no broker, no ACME, nothing manual.

### Proving the gate bites: the fixture-driven pattern already established in this repo

This repo already has the exact "prove a guard is not vacuous via a planted violation"
mechanism PKG-03's success criterion asks for, built for `docs-review-disposition.test.ts`:
a committed fixture file under `.claude/mcp/vice/fixtures/` (e.g.
`fixtures/planted-review-fixture.md`, carrying synthetic finding IDs `WR-99`/`WR-98`/`IN-97`
that exist *only* to prove the parser sees them, explicitly excluded from the real scan by
living outside the real scan's path glob) plus a dedicated test asserting the scanner
detects the fixture's content. **Recommend the identical pattern for PKG-03**: a small
committed fixture (a `.ts`-shaped text fixture, not a real module, so it is never picked up
by `shippedTsModules()`'s `files[]`-derived scan) containing the exact violation shapes
(`"is Phase 8's business"`, `"Phase 7, via ..."`, `"Phase 7's timing route"`), read directly
by path from within the test file, with an assertion that the scanner flags it. This
satisfies "biting on a planted violation" as a **permanent regression test** (catches a
reintroduction forever), which is stronger than a one-time plant-and-revert transcript
(Phase 12's `12-GATE-PROOF.md` style) though the planner may choose to do both — a one-time
transcript for the phase's own acceptance evidence, plus the permanent fixture for
ongoing protection.

## PKG-04: Control-Plane Network Exposure

### Two different "control planes" exist in this codebase — do not conflate them

1. **VICE's own binary-monitor TCP port** (the actual emulator's remote-debugging
   protocol). Already bound to `127.0.0.1` **by default**, confirmed across multiple
   phases' own security tables and runtime text:
   - `stock-handler.ts:105-116`: `"The broker binds VICE's binary monitor to 127.0.0.1 by
     DEFAULT (the safe posture: the binary monitor is..."` (quoted, truncated by the source
     file's own line wrap)
   - `broker-launch.mts:168-169`: `const host = binmonHost ?? process.env.VICE_BROKER_BINMON_HOST
     ?? "127.0.0.1"; if (host !== "127.0.0.1" && !warnedBinmonBindWidened) {`
   - Multiple Phase 1/2 plan security tables (`01-04-PLAN.md:330`, `02-03-PLAN.md:266`)
     confirm this posture was deliberately established and tested early, with widening
     requiring an explicit env var and a one-time warning.

   This part of "network exposure of the emulator control plane" is **already closed** —
   it is not open work for this phase, and the many `QUAL-03`-citing security tables across
   Phases 1/2/5/14 all correctly identify it as an accepted, documented, unauthenticated
   (VICE's own protocol design, not fixable by this project) but loopback-scoped posture.

2. **The broker's own TCP control-plane listener** (`broker-control.mts` — literally named
   "the control plane" in its own header comment, implementing the acquire/release/
   recycle/status/host_state/monitor_claim/monitor_release protocol). This is bound
   `0.0.0.0` **by design**, confirmed by reading the module header this session:

   ```
   // broker-control.mts:16-20 (quoted verbatim)
   // Wire format confirmed at plan 01's blocking checkpoint:decision
   // (2026-08-03, `as-specified`, no amendments -- see .planning/RE-FINDINGS.md
   // for the full record...). Auth: per-boot capability token compared
   // constant-time, checked BEFORE any state read or write. Bind: 0.0.0.0
   // explicitly, never 127.0.0.1 -- host.docker.internal is the bridge
   // address, not loopback, so a loopback-only listener is structurally
   // unreachable from the container. Port: 19510 default via
   // VICE_BROKER_CONTROL_PORT.
   ```

   And re-confirmed independently at the dial-resolution site (`vice-broker-client.ts:184-200`):
   ```
   // (quoted verbatim)
   // `broker.json`'s `control_host` field is the broker's BIND address
   // (vice-broker.mts:782 writes `listener.host` into it, which is
   // deliberately `0.0.0.0` per broker-control.mts:16-20's own rule: "Bind:
   // 0.0.0.0 explicitly, never 127.0.0.1 -- host.docker.internal is the bridge
   // address, not loopback").
   ```

   Live-verified bind address on this host this session: `grep -n
   "process.env.VICE_BROKER_CONTROL_HOST ?? " vice-broker.mts broker-control.mts` shows the
   default literal `"0.0.0.0"` in the source at three sites (`vice-broker.mts:987`,
   `broker-control.mts:438`, `broker-control.mts:671`) — the same default flows into both
   the authored `.mts` and the compiled, committed `resources/*.mjs` twins
   (`vice-broker.mjs:833`, `broker-control.mjs:438`). This *is* the "network exposure of the
   emulator control plane" QUAL-03/PKG-04 still names as open — the todo's original v0.2.0
   definition ("Network exposure of the emulator control plane is documented or restricted")
   was written before this broker-control-plane layer existed in its current form (the
   `0.0.0.0` bind default and its rationale were established later, in the Phase 01.6-era
   broker work), which is presumably why it is still open rather than closed alongside the
   binmon-port work.

### Is narrowing viable? The evidence says no, without breaking a documented capability

The `0.0.0.0` bind exists specifically to be reachable via `host.docker.internal` from a
container. On Linux, `host.docker.internal` resolves to the Docker bridge gateway address
(e.g. `172.17.0.1`), a genuinely different local address from `127.0.0.1` — a process bound
to `127.0.0.1` only accepts connections arriving via the loopback interface, and a
connection arriving via the bridge interface is not loopback traffic even though both
addresses are "local to the host" in a loose sense. **A loopback-only bind is therefore
structurally unreachable** from exactly the topology this project's own container-detection
code (`container-guard.mts`, `hostpath.ts`/`containerpath.ts`, the "Container-in / host-out
split" architecture pattern named in `CLAUDE.md`) exists to serve: a consumer who installs
this plugin into their own devcontainer, where the MCP proxy and skills run **inside** the
container and must reach a broker running on the **host**.

This decision was made once already, at a **blocking human checkpoint**, and the module
header explicitly records "no amendments" — the same rigor this project applies to FORK-01.
Changing the *default* bind now would be reversing a decision this codebase treats as
settled, not merely writing new code.

### Recommendation: accepted risk, not narrowed — with the counter-considerations named

**Recommend recording PKG-04 as an accepted risk in PROJECT.md's Key Decisions table**, in
the same dated, reversal-criteria format already used for FORK-01 (see PROJECT.md:278 for
the precedent entry's shape). A draft entry, for the planner to refine:

> **Decision:** Accept the broker control-plane listener's `0.0.0.0` bind default as a
> documented risk rather than narrowing it.
> **Rationale:** The bind is required for `host.docker.internal` reachability from a
> devcontainer-based consumer — the primary container topology this project's own
> container-detection code exists to serve. A loopback-only bind is structurally
> unreachable from that topology (the bridge-gateway address a container dials is not the
> loopback interface). The listener is not unauthenticated: every request is gated by a
> per-boot capability token, compared constant-time, checked before any state read or
> write (`broker-control.mts`). This mirrors VICE's own binary-monitor posture (loopback by
> default, no auth by protocol design) at one remove — the broker's own protocol *does* have
> auth, unlike the thing it manages.
> **Residual risk:** any other local-network host can reach the broker's control port and,
> without the token, gets `unauthorized` on every op; with a leaked or guessed token
> (per-boot, not persisted — re-check this claim against `broker-control.mts`'s actual token
> generation before finalizing the wording), an attacker on the same network segment could
> acquire/release/recycle VICE instances. This is a materially smaller blast radius than
> "arbitrary code execution" but is a real availability/tampering exposure on an untrusted
> local network (e.g. public Wi-Fi, a shared lab network).
> **Reverses if:** a documented, tested loopback-default-with-opt-in-widen mechanism (the
> same pattern `broker-launch.mts` already uses for `VICE_BROKER_BINMON_HOST`, which warns
> once on widening) is designed for the control-plane bind too, defaulting to `127.0.0.1`
> for the (increasingly common, per this repo's own "no devcontainer in this repo" —
> host-only development is the norm here) non-container consumer, and widening only when
> `container-guard.mts`'s signals detect a container topology in play.

**Counter-consideration the planner should weigh before locking this in:** the "reverses
if" clause above sketches a real, buildable alternative — a *smart default* (loopback
unless a container is detected) rather than a permanent `0.0.0.0` default — that would
narrow the exposure for the majority case (this project's own development, and any
host-only consumer) without breaking the container case. This is more code than "accept
and document," and changes default *behavior* rather than only a bind address literal
(`container-guard.mts`'s detection runs where the broker starts, on the **host** side; the
broker doesn't currently consult it for the control-plane bind decision at all — confirm
this by reading `vice-broker.mts`'s startup sequence before assuming it's a small change).
Given this milestone's own explicit non-goal ("no new capability" — REQUIREMENTS.md → Out
of Scope) and this phase's "no amendments" precedent on the exact decision at hand,
**recommend the accepted-risk branch for this phase**, and record the smart-default
alternative as a named follow-on item (mirroring how FORK-01's reversal criteria and the
Fork Backend Follow-on section work) rather than building it now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.mcp.json` merge semantics | A second merge implementation for the plugin route | `wireMcp()` (`installer/bin/cli.mjs:168-201`) | Already correct, already tested by use (npm install route), and the todo's own Solution step 3 says so explicitly |
| Comment/string extraction for PKG-03 | A regex-based extractor | The existing character-state-machine (`docs-dangling-refs.test.ts:194-294`), inverted to capture comments | A regex extractor was *measured* in this repo to miss a real violation sitting inside a template literal; the state machine is the proven-correct approach |
| ACME availability gating for the new `acme.mjs` test | A second `command -v acme` check | `r2000-test-gate.ts`'s `ACME_BIN`/`acmeSkipReasonFor`/`assertAcmeRequiredIfEnvSet`, already used by `disasm-roundtrip.test.ts` and already wired into CI via `VICE_REQUIRE_ACME` | One seam, one CI wiring; a second implementation risks the two gates disagreeing about ACME's presence |
| Repo-root resolution after the move | A fresh relative-path calculation in any new or touched module | `repo-root.ts`'s `repoRoot()`, already depth-aware via its documented branch-4 hop count | This is the exact class of bug the file's own header describes fixing twice before ("a broken invariant with no error anywhere") |

**Key insight:** almost everything this phase needs already exists in this codebase, proven
by three prior moves of the same tree and a merge function already in production use. The
work is mostly *reuse and sweep*, not new design — except for PKG-03's comment-assignment
detector (genuinely new) and PKG-04's decision-recording (a judgment call, not code).

## Runtime State Inventory

This phase is a source-tree rename/relocation (PKG-01) plus new guards (PKG-02/03) plus a
documentation decision (PKG-04) — the rename-phase inventory below applies specifically to
PKG-01's directory move.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no database, no persistent store keys the directory path. `.vice-supervisor/`, `.vice-snapshots/`, `tools/` are all resolved via `repoRoot()`/`installTargetDir()` at **runtime**, not baked into any stored record | None |
| Live service config | None — no external service (n8n, Datadog, Tailscale, Cloudflare-style) references this repo's internal directory layout. The npm registry's published `files[]`/`bin` paths are the closest analog and are covered under "Build artifacts" below | None beyond the `files[]`/`bin` update already covered |
| OS-registered state | None — no Task Scheduler/launchd/systemd/pm2 registration anywhere in this project references `.claude/mcp/vice` by path | None |
| Secrets/env vars | None of the env vars this repo reads (`VICE_BROKER_CONTROL_HOST`, `VICE_MCP_HOST`, `CLAUDE_PLUGIN_ROOT`, etc.) encode the source directory path — they are runtime host/port/behavior toggles, unrelated to where the source tree sits on disk | None |
| Build artifacts / installed packages | **Real, load-bearing.** `@henols/vice-mcp`'s published `bin`/`main`/`files[]` paths are relative to `.claude/mcp/vice/package.json`'s own location, so they move automatically with the directory (no internal change needed inside that `package.json` beyond `repository.directory`), **but this is a breaking change for anyone who has pinned the old paths** (e.g. `require("@henols/vice-mcp/vice-proxy.ts")` — unlikely given the package's actual usage pattern, but the todo's own Solution step 7 flags this and asks for a release-semantics decision: minor-with-compat-shim vs. major bump) | Decide and document the release semantics (see Landmines) |

## Common Pitfalls

### Pitfall 1: Splitting the directory move across multiple commits
**What goes wrong:** `npm test`'s cwd-relative glob finds zero test files, or finds the old
directory's leftover files and the new directory's moved-in files simultaneously, producing
confusing duplicate-suite or zero-suite failures.
**Why it happens:** `git mv` of a whole directory is one atomic operation; manually
moving files one at a time (or moving code before manifests) creates an intermediate,
inconsistent state.
**How to avoid:** one commit per logical unit (the `git mv` itself; the manifest/script
literal-path sweep) but never leave the tree in a state where `.claude/mcp/vice/` exists
alongside a partial `src/mcp/vice/` for more than the duration of a single, immediately-
verified commit.
**Warning signs:** `npm test` reports "no test files found" or a smaller test count than the
pre-move baseline.

### Pitfall 2: Widening the FLOW-02 string-literal guard instead of building a new comment guard
**What goes wrong:** if PKG-03 is implemented by simply removing FLOW-02's "never comments"
restriction, the guard immediately fails against 137 pre-existing, legitimate comments,
forcing either a mass rewording of historically-accurate narration or an unworkable
exemption list.
**Why it happens:** it looks like the smaller diff — "just widen the existing test" — until
the false-positive count is actually measured.
**How to avoid:** build a narrowly-scoped, assignment-shape-only detector (this research's
PKG-03 section), and dry-run it against the full corpus of existing `Phase N` comments
before committing to a final pattern set.
**Warning signs:** the new test fails on more than the ~2-3 known real violations the moment
it is written against real source.

### Pitfall 3: Assuming the plugin `.mcp.json` merge needs new code without checking whether Claude Code already handles it
**What goes wrong:** the planner writes tasks to build a plugin-install-time merge step that
duplicates `wireMcp()`, when Claude Code's own plugin loader may already layer a plugin's
declared MCP servers into a session without ever touching the consumer's `.mcp.json` file at
all — in which case the new code is unnecessary and the "merge" success criterion is already
met by the existing npm-installer route.
**Why it happens:** the pending todo's own framing conflates the two install routes'
different mechanics.
**How to avoid:** resolve this experimentally (see PKG-01 Open Questions) before writing
merge-implementation tasks for the plugin route.
**Warning signs:** a task list that includes "implement `.mcp.json` merge for the plugin
install path" without a preceding verification step confirming that path actually writes to
a consumer's file at all.

### Pitfall 4: Treating PKG-04 as a code-fix phase
**What goes wrong:** attempting to narrow the broker's bind default inside this phase risks
either (a) silently breaking the container-consumer topology (if narrowed to loopback
unconditionally) or (b) scope-creeping into a "smart default" feature (detect container,
bind accordingly) that this milestone's own "no new capability" non-goal rules out.
**Why it happens:** "narrow or record as accepted" reads like two options of similar size;
they are not — one is a documentation edit, the other is a real behavior change to a
previously, deliberately, checkpoint-decided default.
**How to avoid:** default to the accepted-risk branch (this research's recommendation);
treat a smart-default narrowing as a named follow-on item for a future milestone, not
in-phase work.
**Warning signs:** a task that edits `broker-control.mts`'s or `vice-broker.mts`'s default
bind literal without an accompanying update to `container-guard.mts`'s detection being
consulted at that exact call site, and without re-running the live container-reachability
scenario this decision was originally made to serve.

## Code Examples

### The `wireMcp()` merge function (reuse, do not reimplement)
```javascript
// Source: installer/bin/cli.mjs:168-201 (this repo, verified this session)
function wireMcp(target, { force, dryRun, vendor }) {
  const mcpPath = join(target, ".mcp.json");
  let config = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    const parsed = readJson(mcpPath);
    if (parsed === undefined) {
      console.error(
        `c64-re-tools: FAIL -- ${mcpPath} exists but is not valid JSON. ` +
          `Refusing to overwrite it; fix or remove it and re-run.`
      );
      process.exit(1);
    }
    config = parsed;
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      console.error(`c64-re-tools: FAIL -- ${mcpPath} is not a JSON object.`);
      process.exit(1);
    }
    if (typeof config.mcpServers !== "object" || config.mcpServers === null) {
      config.mcpServers = {};
    }
  }
  const existed = Object.prototype.hasOwnProperty.call(config.mcpServers, "vice");
  let action;
  if (existed && !force) {
    action = "kept";
  } else {
    action = existed ? "updated" : "added";
    if (!dryRun) {
      config.mcpServers.vice = viceServerEntry(vendor);
      mkdirSync(dirname(mcpPath), { recursive: true });
      writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n");
    }
  }
  return { mcpPath, action };
}
```

### The character-state-machine extractor to invert for PKG-03
```typescript
// Source: .claude/mcp/vice/docs-dangling-refs.test.ts:194-294 (this repo, verified this
// session) -- extracts STRING/TEMPLATE literal content, skipping comments. PKG-03's new
// guard should invert this: capture comment content, skip string/template literal bodies.
function extractStringLiterals(src: string): string[] {
  // ... single-pass char state machine, tracks // and /* */ comments (skipped),
  // '...'/"..." strings (captured), and template literals with nested ${...}
  // interpolation (captured, recursively scanned) -- see full source for the
  // complete implementation.
}
```

### `repoRoot()`'s depth-aware last-resort branch (the constraint the target layout must respect)
```typescript
// Source: .claude/mcp/vice/repo-root.ts (this repo, verified this session)
// Branch 4 (last resort): "three levels up from `from`" -- hard-coded to match
// <root>/.claude/mcp/<server>/'s depth. src/mcp/vice/ preserves the identical
// depth (3 segments); any other target shape requires updating this literal,
// its comment, AND repo-root.test.ts's synthetic pinning test.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Repo root IS the plugin payload (auto-discovered at `.claude/skills/`, `.claude/mcp/vice/`) | Payload lives under `src/**`, activated only via a real install (npm or plugin-marketplace) | This phase (proposed) | Closes the "development-in-place and installed-consumer are indistinguishable" gap the todo names; requires a deliberate dev-mode route (see PKG-01 Open Questions) |
| Ad hoc phase-pointer prose reviewed by hand | Mechanical guards (`docs-dangling-refs.test.ts`'s two existing tests, plus this phase's new comment-assignment guard) | Phase 11.1 (FLOW-02) established the pattern; this phase extends it into comments | Each new guard closes one more class of "stale wording nobody re-checks" |
| Broker control-plane bind decided once (2026-08-03) and never revisited | Recorded as an accepted risk with named reversal criteria, matching FORK-01's treatment | This phase (recommended) | Makes an implicit, buried-in-a-code-comment decision visible in PROJECT.md's Key Decisions table, where a future milestone can find and reconsider it |

**Deprecated/outdated:** none — this phase does not deprecate any existing mechanism, it
relocates and extends.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code's plugin loader does NOT write to a consumer's `.mcp.json` file (layers `mcpServers` in-memory instead), meaning the plugin route needs no new merge code | PKG-01, `.mcp.json` merge | If wrong, PKG-01's merge success criterion is unmet for the plugin route and new merge code (routed through `wireMcp()`) is needed there too — a real, sizeable gap in the plan if assumed away |
| A2 | `readJson()` in `installer/bin/cli.mjs` uses plain `JSON.parse` (no JSONC/comment tolerance) | PKG-01, `.mcp.json` merge edge cases | Low risk either way — the failure mode (refuse rather than corrupt) is safe regardless of which it is; only affects whether a JSONC `.mcp.json` is supported or rejected |
| A3 | The broker control-plane token is generated per-boot and not persisted to disk (stated in the accepted-risk draft's Residual risk paragraph) | PKG-04, accepted-risk rationale | If the token is actually persisted or predictable, the residual-risk characterization understates the exposure and the accepted-risk entry's wording needs correcting before it is recorded as a considered decision |
| A4 | `container-guard.mts`'s detection signals are not currently consulted by the broker's control-plane bind decision at startup (stated as a reason the "smart default" alternative is more than a small change) | PKG-04, counter-consideration | If wrong (i.e., if wiring it in actually is small), the smart-default alternative may be cheap enough to reconsider building in-phase rather than deferring |
| A5 | The proposed `src/mcp/vice/` and `src/skills/` target directories do not already exist and carry no naming conflicts with anything else under a hypothetical `src/` (verified this session: no `src/` directory exists at all yet) | PKG-01, target layout | Low risk — directly verified `ls` this session found no `src/` at repo root |

## Open Questions

1. **Does Claude Code's plugin loader write to a consumer's `.mcp.json`, or layer `mcpServers` in-memory?**
   - What we know: the npm-installer route (`installer/bin/cli.mjs`) already merges correctly via `wireMcp()`. The plugin route only declares `"mcpServers": "./.mcp.json"` in `.claude-plugin/plugin.json` — a manifest pointer, not an observed file-write in this repo's own code.
   - What's unclear: whether Claude Code's own (out-of-repo) plugin-loading mechanism ever writes to or overwrites a consumer project's `.mcp.json`, or purely reads the plugin's declared file and merges server entries into the running session.
   - Recommendation: verify via Claude Code's own documentation or a live local-marketplace install experiment before writing any plugin-route merge-implementation tasks (see Pitfall 3).

2. **What is the final target directory shape, and does it preserve `repoRoot()`'s hard-coded depth?**
   - What we know: `src/mcp/vice/` (3 segments) exactly matches the depth `repoRoot()`'s branch 4 already assumes; the pending todo proposes exactly this shape.
   - What's unclear: whether the planner (or a human decision point) might prefer a different shape for other reasons (e.g. `src/vice-mcp/` flattened, or grouping skills differently) — any such choice must be checked against `repoRoot()`'s branch-4 literal and `repo-root.test.ts`'s synthetic pinning test.
   - Recommendation: default to `src/mcp/vice/` + `src/skills/` unless a specific reason argues otherwise; if a different shape is chosen, add a task explicitly updating `repoRoot()`'s branch-4 hop count, its comment, and the synthetic test.

3. **Does `installer/` have any existing test coverage for `wireMcp()`?**
   - What we know: this session's search for test files did not find one under `.claude/mcp/vice/` covering `installer/bin/cli.mjs` (the two directories are entirely separate npm packages with separate test setups — `installer/package.json` declares no `test` script at all).
   - What's unclear: whether this gap is pre-existing and out of this phase's four named success criteria (likely — none of PKG-01..04 name installer test coverage), or worth a drive-by fix given the phase is already touching `wireMcp()`'s call sites.
   - Recommendation: treat as out of scope unless the planner decides the merge-reuse work (PKG-01) is incomplete without at least one regression test proving `wireMcp()`'s non-clobbering behavior — the pending todo's own Solution step 4 explicitly asks for exactly this test ("a test asserting the installer preserves pre-existing non-`vice` `mcpServers` keys... and still refuses invalid JSON").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything in this phase | ✓ | v22.22.0 (verified this session) | — |
| `acme` cross-assembler | New `acme.mjs` test (build/sym verbs) | Not verified on this exact host this session (the acme-build skill probes `$ACME`/`/usr/local/share/acme`/etc.; CI installs it via `apt` in a dedicated step) | — | The existing `r2000-test-gate.ts` ACME-gate seam already degrades gracefully (skip locally without `VICE_REQUIRE_ACME`, hard-fail in CI where it's provisioned) |
| Network access | `driver.mjs memmap` verb only | Not needed for the recommended tests (which use `lookup`/`annotate` against the already-committed `memmap.json`) | — | N/A — tests should not invoke `memmap` |
| A running VICE emulator / broker | None of PKG-01..04 | N/A | — | Not needed this phase |

**Missing dependencies with no fallback:** none identified.

**Missing dependencies with fallback:** ACME (test degrades via the existing gate seam,
matching `disasm-roundtrip.test.ts`'s established disposition).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (via `node --test`) |
| Config file | `.claude/mcp/vice/tsconfig.json` (typecheck-only; post-move `src/mcp/vice/tsconfig.json`) |
| Quick run command | `npm run test:automated` (in the vice-mcp package directory) |
| Full suite command | `npm test` (the `*.test.*` glob CI actually runs — deliberately wider than `test:automated`, per `ci-guardrails.test.mjs`'s own pinned invariant) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | Both tarballs contain exactly the right files after the move | integration/script | `node scripts/check-npm-packages.mjs` | ✅ (needs literal-path updates, not a new file) |
| PKG-01 | `.mcp.json` merge preserves unrelated keys, refuses invalid JSON | unit | new test in `installer/` (currently no test infra there — see Open Question 3) | ❌ Wave 0 gap if the planner takes this on |
| PKG-02 | `acme.mjs`/`driver.mjs`/`derive.mjs` each have a passing test | unit/integration (subprocess) | `node --test skill-acme-build-cli.test.ts skill-memory-mapping-cli.test.ts skill-program-recon-cli.test.ts` | ❌ Wave 0 — all three are new files this phase creates |
| PKG-03 | Zero orphaned planning references in source comments, gate bites on a planted violation | unit (guard test + fixture) | `node --test comment-phase-pointers.test.ts` (name illustrative) | ❌ Wave 0 — new file, plus a new fixture under `fixtures/` |
| PKG-04 | Control-plane exposure narrowed or recorded as accepted risk | manual/documentation | N/A if accepted-risk branch is chosen (a PROJECT.md edit, no test); `ss -tlnp \| grep 19510` or equivalent live bind-address check if narrowed | N/A (documentation-only on the recommended branch) |
| (all) | `resources-sync.test.ts` and byte-pinned manifests still pass after relocation | integration | `npm test` (full glob, from the new working directory) | ✅ existing file, needs zero content changes if the whole-directory-move approach is followed |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run test:automated` from the (possibly new)
  vice-mcp package directory.
- **Per wave merge:** `npm test` (full glob, matching CI exactly) plus
  `scripts/package.sh`, `scripts/check-npm-packages.mjs`,
  `scripts/check-skill-tool-coverage.mjs`, `scripts/check-skill-fork-honesty.mjs`.
- **Phase gate:** full `npm test` green from the moved tree, `scripts/package.sh` green
  (this IS success criterion 1's `check-npm-packages.mjs` plus criterion 5's
  `resources-sync.test.ts`/manifest pins), and the PKG-03 planted-violation demonstration
  performed and recorded.

### Wave 0 Gaps
- [ ] `skill-acme-build-cli.test.ts` (or equivalent name) — covers PKG-02 for `acme.mjs`
- [ ] `skill-memory-mapping-cli.test.ts` — covers PKG-02 for `driver.mjs`
- [ ] `skill-program-recon-cli.test.ts` — covers PKG-02 for `derive.mjs`
- [ ] `comment-phase-pointers.test.ts` (or equivalent name) — covers PKG-03, plus its
      companion fixture file under `fixtures/`
- [ ] A `wireMcp()` regression test in `installer/` — optional, see Open Question 3; no
      existing test infrastructure in that package to build on (no `test` script in
      `installer/package.json`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Marginal | The broker control-plane's per-boot capability token (`broker-control.mts`) is the only authentication surface this phase touches, and only in the PKG-04 accepted-risk writeup — no new auth code is added |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | Marginal | Same as V2 — the broker's single-client/token-gated model is pre-existing and documented, not modified here (on the recommended accepted-risk branch) |
| V5 Input Validation | Yes (pre-existing) | `wireMcp()`'s JSON-parse-and-refuse-on-invalid pattern already covers the one new-ish input surface (a consumer's `.mcp.json`) this phase's reused code touches |
| V6 Cryptography | No | The control-plane token comparison is `timingSafeEqual` (already implemented, `broker-control.mts` imports `timingSafeEqual, randomBytes` from `node:crypto`) — not modified by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| An attacker on the same local network segment reaches the broker's `0.0.0.0`-bound control port | Tampering / Denial of Service | Per-boot capability token, `timingSafeEqual`-compared, checked before any state read/write (pre-existing); this phase's recommended action is to *document* this as an accepted risk, not to add new mitigation |
| A malformed or maliciously-crafted `.mcp.json` in a consumer's project causes the installer to corrupt or misconfigure it | Tampering | `wireMcp()` already refuses (does not overwrite) on invalid JSON or a non-object root — this phase reuses, not weakens, that behavior |
| A relocated source tree silently ships a stale or missing file in the published npm tarball | Information Disclosure (of the wrong kind — omission, not exposure) / Repudiation-adjacent (a broken release with no clear cause) | `scripts/check-npm-packages.mjs`'s transitive-closure-from-`vice-proxy.ts` assertion already catches an unreachable-but-required module; re-run it as this phase's own gate, not a new mechanism |

## Sources

### Primary (HIGH confidence — read directly this session)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/PROJECT.md` — phase scope, requirement text, decision-log format precedent, deferred-items history
- `.planning/todos/pending/2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md`, `.planning/todos/pending/2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md` — the two promoted todos this phase owns, read in full
- `.claude/mcp/vice/repo-root.ts`, `repo-root.test.ts` — depth-aware last-resort branch and its history of three prior moves
- `.claude/mcp/vice/build.ts`, `resources-sync.test.ts` — generated-artifact build/verify mechanism
- `.claude/mcp/vice/docs-dangling-refs.test.ts` (full file) — the FLOW-02 string-literal guard, its character-state-machine extractor, and the `.vsf`-specific `ASSIGNMENT_RES` pattern set
- `.claude/mcp/vice/docs-linerefs.test.ts` — confirms CLAUDE.md's line-number citations use bare filenames, not full paths
- `.claude/mcp/vice/docs-review-disposition.test.ts`, `fixtures/planted-review-fixture.md` — the fixture-driven planted-violation pattern
- `.claude/mcp/vice/test-gate.mjs` — confirmed cwd-only, non-recursive test discovery
- `.claude/mcp/vice/broker-control.mts`, `vice-broker-client.ts`, `stock-handler.ts`, `broker-launch.mts` — the two-control-planes distinction and the `0.0.0.0`/`127.0.0.1` rationale
- `installer/bin/cli.mjs` (`wireMcp()`), `installer/scripts/sync-skills.mjs` — merge semantics and skill-sync mechanism
- `scripts/package.sh`, `scripts/check-npm-packages.mjs`, `scripts/ensure-mcp-deps.sh` — CI/packaging literal-path consumers
- `.claude/skills/acme-build/scripts/acme.mjs`, `.claude/skills/c64-memory-mapping/scripts/driver.mjs`, `.claude/skills/c64-program-recon/scripts/derive.mjs` (full files) — public surface and dependency analysis for PKG-02
- `.github/workflows/ci.yml` (full file) — ACME provisioning, `VICE_REQUIRE_ACME`, `npm test` vs `test:automated` disposition
- `.gitignore`, `.claude/mcp/vice/package.json`, `installer/package.json`, `.mcp.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — full contents read directly
- `.planning/config.json` — confirmed `nyquist_validation: true`, `security_enforcement: true`, `use_worktrees: false`

### Secondary (MEDIUM confidence)
- None — no external web sources were needed for this phase; it is entirely an internal-codebase research task.

### Tertiary (LOW confidence)
- The Claude Code plugin-loader `.mcp.json` merge behavior (Open Question 1) — this repo's own source cannot answer it; flagged as unresolved rather than guessed at.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all mechanisms read directly from source
- Architecture (PKG-01 layout, PKG-02 test-runner mechanics, PKG-03 gate design): HIGH — verified against actual source files and their line numbers this session
- PKG-04 recommendation: MEDIUM — the underlying facts (bind address, rationale, comments) are HIGH confidence (read directly), but the accepted-risk-vs-narrow judgment call is a recommendation, not a fact, and the planner/human should weigh the counter-consideration named
- Pitfalls: HIGH — each is grounded in a specific, cited mechanism already observed in this codebase (either directly or via the 137-comment false-positive measurement)

**Research date:** 2026-08-22
**Valid until:** This phase's own scope is a one-time sweep; the enumerated file:line
citations should be re-verified at execution time (re-run the grep commands given) since
Phase 15's own work already shifted some line numbers this session found (e.g.
`stock-dispatch.ts`'s cited lines moved from the todo's original 614-615 to 633-634).
Treat any mismatch as expected drift to re-verify, not as evidence this research is wrong.
