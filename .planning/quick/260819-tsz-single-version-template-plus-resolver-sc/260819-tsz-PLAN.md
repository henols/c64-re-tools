---
phase: quick-260819-tsz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - VERSION
  - .claude/mcp/vice/version.ts
  - .claude/mcp/vice/version.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/package.json
  - installer/package.json
  - installer/bin/cli.mjs
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - scripts/version.mjs
  - scripts/check-npm-packages.mjs
  - .github/workflows/ci.yml
autonomous: true
requirements: [D-1, D-2, D-3, D-4, D-5]
worktree: false   # verification runs `bash scripts/package.sh` (which builds from
                  # `git archive HEAD`) and `npm pack --dry-run` in two package
                  # dirs -- whole-repo, git-state-sensitive operations that need
                  # the real repo, not a detached worktree checkout.

must_haves:
  truths:
    - "A repo-root VERSION file exists containing the template 0.2.- and is the only hand-edited version string left in the repo"
    - "`node scripts/version.mjs resolve --published 0.1.12` prints exactly 0.2.0"
    - "All six worked-example rows of CONTEXT.md's table are covered by offline unit tests that pass"
    - "`node scripts/version.mjs resolve` against the REAL published version prints a valid semver strictly greater than it, and exits non-zero if it would not"
    - "Exactly one implementation of the template-resolution algorithm exists in the repo; scripts/version.mjs imports it rather than re-deriving it"
    - "The MCP server advertises a version derived from the seam -- PROXY_VERSION no longer contains a version literal"
    - "The seam returns its own package.json version when that is a real version (published tarball) and never throws when no repo-root VERSION exists"
    - "The six derived version strings (vice pkg, installer pkg, installer's vice-mcp dep, plugin.json, marketplace.json x2) all carry the same self-evident dev placeholder, pinned by a test"
    - "`node scripts/version.mjs stamp <v>` rewrites all six derived strings, and stamping the placeholder leaves the working tree byte-identical"
    - "release-on-merge derives its version from the VERSION template instead of an inline npm-view + patch increment, and its [skip release] gate step is byte-for-byte unchanged"
    - "The v* tag `release` job stamps the real version into the plugin manifests before building the zip, so the artifact filename AND the plugin.json inside it agree"
    - "publish-npm's job body is byte-for-byte unchanged"
    - "Neither published tarball contains scripts/version.mjs or the VERSION file, asserted mechanically"
    - "Nothing in this plan pushes, tags, publishes, merges, or runs npm publish / npm version"
  artifacts:
    - path: "VERSION"
      provides: "The single hand-maintained source of truth: the version template"
      contains: "0.2.-"
    - path: ".claude/mcp/vice/version.ts"
      provides: "The ONE seam owning template parsing, D-2 resolution, and runtime version reading"
      exports: ["DEV_PLACEHOLDER", "parseTemplate", "resolveVersion", "readTemplate", "runtimeVersion"]
      min_lines: 90
    - path: ".claude/mcp/vice/version.test.ts"
      provides: "Offline table-driven coverage of all six worked examples plus the placeholder-consistency invariant"
      min_lines: 90
    - path: "scripts/version.mjs"
      provides: "CLI over the seam: resolve / stamp / check; read-only against npm"
      contains: "resolveVersion"
      min_lines: 80
  key_links:
    - from: "scripts/version.mjs"
      to: ".claude/mcp/vice/version.ts"
      via: "dynamic import of the seam (node type-stripping; verified working on node 22.22 during planning)"
      pattern: "version\\.ts"
    - from: ".claude/mcp/vice/vice-proxy.ts"
      to: ".claude/mcp/vice/version.ts"
      via: "import { runtimeVersion } and use it for PROXY_VERSION"
      pattern: "runtimeVersion"
    - from: ".claude/mcp/vice/version.ts"
      to: "VERSION"
      via: "readTemplate(repoRootDir) reading <root>/VERSION"
      pattern: "\"VERSION\""
    - from: ".github/workflows/ci.yml"
      to: "scripts/version.mjs"
      via: "release-on-merge `resolve --github-output`; release `stamp`"
      pattern: "scripts/version\\.mjs"
    - from: "scripts/check-npm-packages.mjs"
      to: ".claude/mcp/vice/version.ts"
      via: "required-module assertion plus tarball leak assertions"
      pattern: "version\\.ts"
---

<objective>
Replace six hand-maintained, mutually-inconsistent version strings with ONE
hand-edited template file (`VERSION`) plus one resolver seam, and wire that
resolver into the CI path that actually publishes.

Purpose: today `.claude-plugin/plugin.json` says `0.1.1` and is bumped by no
automation at all, `vice-proxy.ts`'s `PROXY_VERSION` says `0.1.0` and is
advertised over MCP `initialize` twelve patches stale, and npm's latest is
`0.1.12`. After this task the only version a human ever edits is `VERSION`, and
only to bump major/minor -- patch releases count themselves, and a hand bump
resets the patch to 0 instead of inheriting the old count (D-2 rule 3, the
user's own stated requirement).

Output: `VERSION` (= `0.2.-`), the `version.ts` seam, the `scripts/version.mjs`
CLI, offline tests over CONTEXT.md's worked-example table, and three CI edits.

Nothing is released. See `<safety_rails>`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260819-tsz-single-version-template-plus-resolver-sc/260819-tsz-CONTEXT.md
@CLAUDE.md
@.github/workflows/ci.yml
@scripts/package.sh
@scripts/check-npm-packages.mjs
@.claude/mcp/vice/repo-root.ts
</context>

<safety_rails>
**Carry this into every task. It is not advisory.**

`main` is 388 commits ahead of `origin/main`. Any push triggers a real,
irreversible npm publish of two public packages.

FORBIDDEN at every step, including verification: `git push`, `git push --tags`,
creating or deleting any remote tag, `gh release create`, `npm publish`,
`npm version`, `npm dist-tag`, merging any branch into `main` by hand.

ALLOWED: `npm view <pkg> version` (read-only), `npm pack --dry-run` (writes
nothing to the registry), local file writes, `git commit` on the working branch.

`scripts/version.mjs` must itself be incapable of publishing: it may read from
npm and write local JSON files, nothing else. Put that prohibition in its header
comment and do not give it a git or publish code path.
</safety_rails>

<decisions_resolved>
Three design tensions the constraints require settling here rather than at
execution time. These are now part of the spec; implement them as written.

### R-1 -- `VERSION` stays a template forever. Nothing is committed back.

`release-on-merge` resolves the version in its ephemeral checkout, publishes,
tags, and commits nothing. `VERSION` in git therefore reads `0.2.-` before and
after every patch release; the concrete number lives only in the published
tarball (where `npm version` wrote it) and in the git tag.

Why this and not commit-back: the user's goal is "so we don't have to handle the
version numbers". A commit-back requires CI to push to `main`, which re-triggers
the same workflow -- the loop can only be broken by injecting `[skip release]`
into a bot commit subject, i.e. by adding a second CI run plus a
push-from-CI failure mode to every single release, in exchange for a number
nobody reads. A template that never changes is strictly less to handle than one
that changes on every release.

Accepted consequence: the working tree never states the current release.
`git tag --list` and `npm view` answer "what is released" -- already true today.

### R-2 -- the six derived strings become a self-evident placeholder, not a number.

`scripts/package.sh` enforces equality across SIX strings (verified against the
source during planning): `.claude-plugin/plugin.json` `.version`,
`.claude-plugin/marketplace.json` `.version` and `.plugins[0].version`,
`.claude/mcp/vice/package.json` `.version`, `installer/package.json` `.version`,
and `installer/package.json` `.dependencies["@henols/vice-mcp"]`. They cannot
hold the template (`0.2.-` is not valid semver; `npm pack` would reject it), and
any concrete number they hold goes stale the moment a release ships.

So all six become exactly `0.0.0-dev`: valid semver, unmistakably not a release,
pinned by a test so it can never drift again, and overwritten in the ephemeral
CI checkout by `npm version` (npm packages) or `scripts/version.mjs stamp`
(plugin manifests) at publish time.

### R-3 -- the pending v0.2.0 release: use `release-on-merge`; the local tag has no role.

The unpushed annotated `v0.2.0` tag sits on `93df581`, which predates this work,
so it can no longer produce a correct release. Do not push it.

With `VERSION` = `0.2.-` and npm latest `0.1.12`, rule 3 fires (literal prefix
`0.2` differs from `0.1`) and `release-on-merge` alone resolves `0.2.0`: it
publishes both packages, creates tag `v0.2.0` at the merge commit, and opens a
GitHub release with generated notes. **Recommended path: push `main`, nothing
else.** One push, zero version handling -- exactly the stated goal.

Do NOT push `main` together with the tag: `release-on-merge` and the
tag-triggered `publish-npm` would both try to publish `0.2.0`, and the loser
fails with a registry 409.

Alternative, only if the GitHub release must carry the plugin zip (auto-releases
attach no assets -- a pre-existing gap this task does not close): land this work,
push `main` with `[skip release]` in the tip commit subject, then create and push
a fresh `v0.2.0` tag at that tip, which runs `publish-npm` + `release` (the
latter now stamps the manifests before zipping, per task 3).

**This plan performs neither path.** It only makes them correct.
</decisions_resolved>

<design>
The contract every task implements. Do not improvise around it.

### Resolution algorithm (D-2), normative

A template is 3 dot-separated components, each matching `^(\d+|-)$`. Anything
else is malformed: `resolveVersion` throws, the CLI exits non-zero,
`runtimeVersion` swallows it.

`resolveVersion(template, published)` returns
`{ version, rule, template, published }`, `rule` being one of four literals:

| Condition | rule | Result |
|---|---|---|
| template contains no `-` | `"pinned"` | template verbatim |
| `published` is null / unparseable | `"no-published"` | every `-` resolves to 0 |
| some literal component differs from `published` at the same index | `"prefix-differs"` | every `-` resolves to 0 |
| every literal component equals `published` at the same index | `"prefix-matches"` | FIRST `-` becomes `published[i] + 1`; every later `-` resolves to 0 |

`published` is parsed by stripping any `-...` / `+...` suffix, then splitting on
`.` into three numbers; a non-numeric or short value is treated as null.

The six worked examples, which the tests must cover verbatim:

| Template | Published | Expected | rule |
|---|---|---|---|
| `0.2.-` | `0.1.12` | `0.2.0` | prefix-differs |
| `0.2.-` | `0.2.0` | `0.2.1` | prefix-matches |
| `0.3.-` | `0.2.7` | `0.3.0` | prefix-differs |
| `0.-.-` | `0.2.7` | `0.3.0` | prefix-matches |
| `1.0.0` | `9.9.9` | `1.0.0` | pinned |
| `0.2.-` | null | `0.2.0` | no-published |

### `.claude/mcp/vice/version.ts` -- the ONE seam (D-5)

Imports nothing but `node:fs` / `node:path`. It must NOT import `repo-root.ts`
(that module's `supervisorDir()` carries an `ensureResourcesInstalled()` side
effect, and this project's documented convention is that the workspace root
arrives as an explicit argument). Export surface:

```ts
export const DEV_PLACEHOLDER = "0.0.0-dev";
export type ResolveRule = "pinned" | "no-published" | "prefix-differs" | "prefix-matches";
export interface ResolveResult {
  version: string;
  rule: ResolveRule;
  template: string;
  published: string | null;
}

export function parseTemplate(raw: string): string[];                 // throws on malformed
export function resolveVersion(template: string, published: string | null): ResolveResult;
export function compareVersions(a: string, b: string): number;        // -1 | 0 | 1, numeric 3-tuple
export function readTemplate(repoRootDir: string): string | null;     // <root>/VERSION, trimmed; null if absent; never throws
export function runtimeVersion(opts: {
  pkgJsonPath?: string;
  repoRoot?: () => string | undefined;   // LAZY -- see below
}): string;
```

`runtimeVersion` precedence (D-4), never throwing:

1. Read `pkgJsonPath`'s `.version`. If it is a non-empty string **and not**
   `DEV_PLACEHOLDER`, return it. This is the published-tarball path: `npm
   version` stamped it, and no repo-root `VERSION` exists there.
2. Otherwise call `opts.repoRoot?.()` and, if it yields a directory,
   `readTemplate` it. A pinned template returns verbatim; a template containing
   `-` returns literals-with-each-`-`-as-`0` plus a `-dev` prerelease tag
   (`0.2.-` becomes `0.2.0-dev`), so a dev checkout never claims to be a release.
3. Otherwise return `DEV_PLACEHOLDER`.

`repoRoot` is a thunk specifically so step 2 never runs inside a published
tarball: `repoRoot()` walks for a `.git` marker and can emit a one-time stderr
note, and a published server must stay silent.

### `scripts/version.mjs` -- CLI, three subcommands

Imports the seam with `await import(<root>/.claude/mcp/vice/version.ts)` --
verified during planning on node 22.22 that a `.mjs` file can import a `.ts`
module under native type-stripping. It must not contain a second copy of the
algorithm.

- `resolve [--published <v>] [--no-npm] [--json] [--github-output]`
  - published source precedence: `--published`, then
    `npm view @henols/vice-mcp version` (read-only, in try/catch, failure means
    null), then null when `--no-npm` is given.
  - **Guard:** unless `published` is null, exit 1 unless
    `compareVersions(resolved, published) > 0`. This makes a downward hand edit
    (`0.1.-` after `0.2.0` shipped) fail loudly instead of 409-ing inside
    `npm publish`, and it *is* the external check CONTEXT.md's verification
    stance asks for -- built in, not bolted on.
  - stdout: the bare resolved version plus a newline, so `$(...)` capture is
    exact; or the whole `ResolveResult` as JSON with `--json`.
  - `--github-output`: append `version=`, `published=`, `rule=` lines to the file
    named by `$GITHUB_OUTPUT` (no-op plus a stderr warning if unset) and print
    one human-readable line to stdout.
- `stamp <version>` -- write `<version>` into all six derived strings from R-2
  via `JSON.parse`, mutate, `JSON.stringify(obj, null, 2) + "\n"`. All four files
  are already byte-identical to that serialisation (verified during planning), so
  a no-op stamp must leave a clean `git diff`. Never touches `VERSION`, never
  runs git, never publishes.
- `check` -- exit non-zero unless all six derived strings equal
  `DEV_PLACEHOLDER`, naming each offender.
</design>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: VERSION template plus the one resolver seam, tests first</name>
  <files>VERSION, .claude/mcp/vice/version.ts, .claude/mcp/vice/version.test.ts</files>
  <behavior>
    - All six rows of the worked-example table in `<design>` resolve to the stated version AND the stated rule, driven from one in-test table (a single implementation of the expectations, per this repo's no-second-list convention).
    - `parseTemplate` throws on each of: `0.2`, `0.2.-.-`, `0.x.-`, `0.2.-x`, the empty string, and a whitespace-only string.
    - `resolveVersion("0.2.-", "not-a-version")` behaves as `no-published` and yields `0.2.0`.
    - `resolveVersion("0.2.-", "0.2.0-rc.1")` strips the prerelease, resolves as `prefix-matches`, and yields `0.2.1`.
    - `compareVersions` orders `0.1.12 < 0.2.0 < 0.2.1 < 0.10.0` and reports equality for identical inputs.
    - `readTemplate` on a scratch dir whose `VERSION` has trailing whitespace and a newline returns the trimmed template; on a dir without one it returns null and does not throw.
    - `runtimeVersion({ pkgJsonPath: scratch package.json with version 0.4.7 })` returns `0.4.7` and never invokes the `repoRoot` thunk -- assert with a call counter, since that is the published-tarball silence guarantee.
    - `runtimeVersion({ pkgJsonPath: scratch package.json with version 0.0.0-dev, repoRoot: () => scratch root containing VERSION 0.2.- })` returns `0.2.0-dev`.
    - Same call with a scratch `VERSION` of `1.0.0` returns `1.0.0`.
    - `runtimeVersion({})`, a `pkgJsonPath` that does not exist, and a `repoRoot` thunk that throws all return `0.0.0-dev` without throwing.
    - The repo's real `VERSION` resolves to `0.2.0` against an injected published value of `0.1.12` (D-3) -- injected, so the unit tests stay offline.
  </behavior>
  <action>
Write `.claude/mcp/vice/version.test.ts` FIRST, covering the behaviors above, and
confirm it fails for the right reason (module absent) before writing any
implementation.

Create `VERSION` at repo root containing exactly `0.2.-` plus a trailing newline
and nothing else -- no comment header, no BOM. Per D-3 this is the initial
template; per R-1 it is the only version string a human ever edits.

Create `.claude/mcp/vice/version.ts` implementing the exact export surface,
precedence and rule literals in `<design>`. Follow this repo's file-header
convention: state WHY the file exists (six hand-maintained strings, none of them
true, plugin.json bumped by no automation at all), that it is the ONE
authoritative implementation of version resolution per D-5, and what NOT to do
(do not re-derive the algorithm in `scripts/version.mjs`, in CI YAML, or in
`installer/bin/cli.mjs`; do not import `repo-root.ts` from here, and the reason).
Style per this repo: 2-space indent, double quotes, semicolons, ES2022, explicit
`.ts` extensions on relative imports.

`runtimeVersion` must be synchronous and must never throw -- wrap its whole body
in try/catch and fall through to `DEV_PLACEHOLDER`. D-4's "the published MCP
package is standalone" requirement is exactly this: no repo-root `VERSION` exists
inside a tarball, and the fallback must degrade rather than fail.

Wire no consumer in this task.
  </action>
  <verify>
    <automated>cd .claude/mcp/vice && npm run typecheck && node --test version.test.ts && test "$(cat ../../../VERSION)" = "0.2.-"</automated>
  </verify>
  <done>`VERSION` holds `0.2.-`; `version.ts` exports the five documented names; `node --test version.test.ts` is green with every worked-example row covered; `npm run typecheck` is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: CLI over the seam; route all six derived strings and PROXY_VERSION through it</name>
  <files>scripts/version.mjs, .claude/mcp/vice/version.test.ts, .claude/mcp/vice/vice-proxy.ts, .claude/mcp/vice/package.json, installer/package.json, installer/bin/cli.mjs, .claude-plugin/plugin.json, .claude-plugin/marketplace.json</files>
  <behavior>
    - New in `version.test.ts`: a placeholder-consistency test reads all six derived strings from the real repo (find the root by walking up from the test file to the directory containing `VERSION`) and asserts each equals `DEV_PLACEHOLDER`. This is the guard that stops the four-wrong-strings problem recurring.
    - New in `version.test.ts`: `scripts/version.mjs` contains no second implementation of the algorithm -- after stripping comment lines, the source must not contain the rule literal `prefix-matches`, and must reference `resolveVersion`. Strip comments before matching; counting an unfiltered file would count its own header prose.
    - New in `version.test.ts`: `vice-proxy.ts` no longer assigns a version literal to `PROXY_VERSION` (a regex for `PROXY_VERSION\s*=\s*"` must not match) and does reference `runtimeVersion`.
  </behavior>
  <action>
**2a -- `scripts/version.mjs`.** Implement the three subcommands exactly as
specified in `<design>`. Node builtins only (`node:child_process` for the
read-only `npm view`, plus `node:fs`, `node:path`, `node:url`), with a
`#!/usr/bin/env node` shebang. Its header comment must carry the
`<safety_rails>` prohibition: this script may read from npm and write local JSON,
and must never publish, tag, push, or invoke git.

Resolve the repo root from the script's own location (it lives at
`<root>/scripts/`), import the seam from `<root>/.claude/mcp/vice/version.ts`,
and let every rule decision come from `resolveVersion`. The `stamp` writer is the
only place in the repo that knows the six derived-string locations: declare them
as one array of `{ file, path }` descriptors and drive both `stamp` and `check`
off that single array.

**2b -- neutralise the six derived strings (R-2).** Set all of them to
`0.0.0-dev`: `.claude/mcp/vice/package.json` `.version`, `installer/package.json`
`.version` and `.dependencies["@henols/vice-mcp"]`, `.claude-plugin/plugin.json`
`.version`, `.claude-plugin/marketplace.json` `.version` and
`.plugins[0].version`. Preserve key order and formatting exactly (2-space indent,
trailing newline); the cleanest route is to run your own
`node scripts/version.mjs stamp 0.0.0-dev` and then read `git diff` to confirm
the only changed lines are those six.

Also add `"version.ts"` to `.claude/mcp/vice/package.json`'s `files[]`, alongside
the other seam modules. It is imported by `vice-proxy.ts`, so
`check-npm-packages.mjs`'s transitive-closure walk fails the build if you forget
-- that is the intended safety net, not a reason to skip the entry.

**2c -- `PROXY_VERSION` (D-4 / D-5).** In `.claude/mcp/vice/vice-proxy.ts`,
replace the `const PROXY_VERSION = "0.1.0";` literal near line 263 with a
`runtimeVersion` call, passing a `pkgJsonPath` built from the file's existing
`fileURLToPath` import (line 154) and `HERE_DIR` (line 185), plus a lazy
`repoRoot: () => repoRoot()` using the `repoRoot` already imported at line 102.
Keep the surrounding comment block but correct the sentence claiming
`PROXY_VERSION` "survives unchanged" -- it no longer does. The value still feeds
`new MCPServer({ name: "vice", version: PROXY_VERSION, tools })` near line 3209;
do not change that construction site, and introduce no `await` anywhere between
it and `server.startStdio()` -- the zero-await ordering there is load-bearing
and documented in place.

**2d -- reconcile, do not duplicate, in the installer (D-5).**
`installer/bin/cli.mjs` line ~30's `SELF_VERSION` already performs precisely step
1 of the seam's precedence (own `package.json`, authoritative inside a published
tarball) and is not a second copy of the resolver. Leave the logic as-is and add
a comment above it recording: the single seam is `.claude/mcp/vice/version.ts`;
this package ships without it (its `files[]` is `bin/`, `skills/`, `README.md`)
and targets node >= 18, which cannot type-strip the seam's `.ts`, so it performs
only the seam's step 1; its number is *produced* by `scripts/version.mjs stamp`
and `npm version` at publish time; and the template-resolution algorithm must
never be reimplemented here.

Touch no `.mts` file in this task. If you do, run `node build.ts` in
`.claude/mcp/vice` or `resources-sync.test.ts` will red the build.
  </action>
  <verify>
    <automated>cd .claude/mcp/vice && npm run typecheck && npm run test:automated && cd ../../.. && node scripts/version.mjs check && test "$(node scripts/version.mjs resolve --published 0.1.12)" = "0.2.0" && test "$(node scripts/version.mjs resolve --published 0.2.0)" = "0.2.1" && test "$(node scripts/version.mjs resolve --no-npm)" = "0.2.0" && node scripts/version.mjs stamp 0.0.0-dev && git diff --quiet -- .claude-plugin installer/package.json .claude/mcp/vice/package.json && bash scripts/package.sh</automated>
  </verify>
  <done>`scripts/version.mjs resolve/stamp/check` all behave per `<design>`; a no-op stamp leaves a clean `git diff`; `package.sh`'s six-way equality check passes on the placeholder; `test:automated` is green with no regression against the 1671-pass / 0-fail / 5-todo baseline (the new tests raise the pass count); typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: wire the resolver into CI, and prove it against the real registry</name>
  <files>.github/workflows/ci.yml, scripts/check-npm-packages.mjs</files>
  <action>
Three publish paths exist. Their dispositions are fixed here; do not improvise.

**3a -- `release-on-merge` (push to main): replace its version computation.**
Leave the `Decide whether to release` gate step byte-for-byte untouched --
including its comment, its `git log -1 --pretty=%s` subject-only read, and its
`grep -qiF '[skip release]'`. That gate is the only way to land on main without
publishing, and its exact wording is load-bearing.

Replace ONLY the `Compute next patch version` step (currently an inline
`npm view` plus a `node -e` patch increment). Keep its `id: ver` and its
`if: steps.gate.outputs.release == 'true'` condition, rename it to reflect that
the version now comes from the `VERSION` template, and reduce its `run:` body to
`set -euo pipefail` followed by a single `node scripts/version.mjs resolve
--github-output`. The step's comment must state: the repo-root `VERSION` template
is the single source of truth; the script reads npm READ-ONLY for the published
version; and it never publishes, tags, or pushes.

The script writes `version=`, `published=` and `rule=` into `$GITHUB_OUTPUT`, so
`steps.ver.outputs.version` keeps working for the two publish steps below it.
The old step also set a `current` output used only by its own echo line -- with
`published=` replacing it, confirm by grep that no other step references
`steps.ver.outputs.current`. Leave both `Publish` steps and the
`Create tag + GitHub release` step unchanged; the `npm version` calls in them are
D-4's stamping mechanism.

Note this job needs no `npm ci`: `scripts/version.mjs` uses only node builtins,
and `npm view` needs no install.

**3b -- `release` (v* tag, GitHub Release assets): add a stamp step.** Insert a
step between `actions/setup-node` and `Build installable package` that runs
`node scripts/version.mjs stamp` with the tag minus its leading `v`
(`${GITHUB_REF_NAME#v}`), then commits that change LOCALLY in the ephemeral
runner checkout with an inline `git -c user.name=... -c user.email=...` identity
and no push. The local commit is required, not decorative: `scripts/package.sh`
builds the zip with `git archive HEAD`, so without it the artifact filename would
carry the real release version while the `plugin.json` inside the zip still said
`0.0.0-dev`. Comment the step to say exactly that, and to say the commit is
ephemeral and never pushed. This step is what finally makes plugin.json bumped by
automation, closing the D-1 row that no automation ever touched.

**3c -- `publish-npm` (v* tag or workflow_dispatch): unchanged.** Do not edit
this job. Its `Derive version` step is authoritative from the tag name or the
dispatch input, and its `npm version` calls already stamp each tarball's
`package.json`, which is precisely what D-4 relies on. Record in the summary that
it was deliberately left byte-for-byte identical.

**3d -- tarball leak assertions.** In `scripts/check-npm-packages.mjs`, add to
the existing `need(...)` assertions, in the style already there (reading
`vice.files` / `inst.files`, never a filesystem path): neither tarball may
contain any path under `scripts/` or a path named `VERSION`, and the vice tarball
must contain `version.ts`. Add `version.ts` to the `REQUIRED_DERIVED_MODULES`
list with the requirement tag `D-5` so the existing loop reports it by name.

Do not run any workflow. YAML validity plus a local dry-run of each command the
workflow invokes is the verification.
  </action>
  <verify>
    <automated>node -e 'const s=require("fs").readFileSync(".github/workflows/ci.yml","utf8");const g=s.match(/name: Decide whether to release[\s\S]*?steps\.gate/);if(!g)throw new Error("gate step altered or missing");if(!/scripts\/version\.mjs resolve --github-output/.test(s))throw new Error("release-on-merge not wired");if(!/scripts\/version\.mjs stamp/.test(s))throw new Error("release job stamp missing");if(/npm view @henols\/vice-mcp version 2>\/dev\/null \|\| echo 0\.0\.0/.test(s))throw new Error("old inline increment still present");if(/steps\.ver\.outputs\.current/.test(s))throw new Error("dangling current output reference");if(!/Derive version/.test(s))throw new Error("publish-npm Derive version step lost");console.log("ci.yml wiring OK")' && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml parses')" && GITHUB_OUTPUT=/tmp/tsz-gho.txt node scripts/version.mjs resolve --github-output && grep -E '^version=0\.2\.0$' /tmp/tsz-gho.txt && PUB=$(npm view @henols/vice-mcp version) && RES=$(node scripts/version.mjs resolve --published "$PUB") && node -e 'const [p,r]=process.argv.slice(1);const n=v=>v.split(".").map(Number);const a=n(p),b=n(r);if(!/^\d+\.\d+\.\d+$/.test(r))throw new Error("resolved is not plain semver: "+r);const gt=b[0]>a[0]||(b[0]===a[0]&&(b[1]>a[1]||(b[1]===a[1]&&b[2]>a[2])));if(!gt)throw new Error(`resolved ${r} is not > published ${p}`);console.log(`external check OK: published ${p} -> resolved ${r}`)' "$PUB" "$RES" && node scripts/check-npm-packages.mjs && cd .claude/mcp/vice && npm run test:automated</automated>
  </verify>
  <done>`ci.yml` parses as YAML; the `[skip release]` gate step is unchanged; `release-on-merge` calls `resolve --github-output` and the old inline increment is gone; the `release` job stamps before packaging; `publish-npm` is untouched; `--github-output` writes `version=0.2.0` against the live registry; the resolved version is plain semver strictly greater than the real published `0.1.12`; `check-npm-packages.mjs` passes with the new leak and required-module assertions.</done>
</task>

</tasks>

<verification>
Run from the repo root after all three tasks:

1. `cd .claude/mcp/vice && npm run typecheck` -- clean.
2. `cd .claude/mcp/vice && npm run test:automated` -- 0 failures, pass count at
   or above the 1671 baseline, todo count still 5.
3. `node scripts/version.mjs check` -- all six derived strings are the placeholder.
4. `node scripts/version.mjs stamp 0.0.0-dev && git diff --quiet -- .claude-plugin installer/package.json .claude/mcp/vice/package.json`
   -- a no-op stamp is byte-identical (proves `stamp` cannot reformat manifests).
5. `node scripts/version.mjs stamp 9.9.9 && bash scripts/package.sh` -- the zip is
   named `c64-re-tools-9.9.9.zip` and package.sh's six-way equality passes; then
   `git checkout -- .claude-plugin installer/package.json .claude/mcp/vice/package.json`
   to restore the placeholder, and re-run step 3.
6. `node scripts/check-npm-packages.mjs` -- OK, with no `scripts/` or `VERSION`
   path in either tarball and `version.ts` present in the vice tarball.
7. External check (CONTEXT.md's verification stance): `node scripts/version.mjs
   resolve` against the live registry prints plain semver strictly greater than
   `npm view @henols/vice-mcp version`. Read-only; asserted in task 3's verify.
8. Negative check on the guard: `node scripts/version.mjs resolve --published
   0.9.9` must exit non-zero (template `0.2.-` would resolve backwards).
9. `git status --porcelain` shows only the twelve planned files, and
   `git log origin/main..HEAD --oneline | wc -l` is unchanged from before the task
   plus the commits this task made -- i.e. nothing was pushed.
</verification>

<success_criteria>
- One hand-edited version string remains in the repo: `VERSION` = `0.2.-`.
- One implementation of the resolution algorithm exists; the CLI, the MCP server
  and CI all reach it through `.claude/mcp/vice/version.ts` (D-5).
- All six CONTEXT.md worked examples pass as offline unit tests, by rule as well
  as by value.
- `PROXY_VERSION` carries no literal and reports the real version in a published
  tarball, `0.2.0-dev` in this checkout (D-4).
- The six derived strings are a single self-evident placeholder, pinned by a test.
- `release-on-merge` resolves from `VERSION`; its `[skip release]` gate is
  unchanged; the `release` job stamps before zipping; `publish-npm` is untouched.
- Nothing was pushed, tagged, published, or merged.
</success_criteria>

<risks>
1. **`npm install` inside `installer/` now fails** for a developer, because the
   `@henols/vice-mcp` dependency pin becomes `0.0.0-dev`, which is not published.
   Nothing in CI does this (CI installs only `.claude/mcp/vice`, and
   `npm pack --dry-run` resolves no dependencies). Escape hatch:
   `node scripts/version.mjs stamp <a published version>`, install, then
   `git checkout` the manifests. Accepted as the price of R-2 -- a loud, honest
   placeholder over a number that silently rots.
2. **Auto-releases still attach no plugin zip** to the GitHub release
   (`release-on-merge` calls `gh release create` with no assets, and its
   GITHUB_TOKEN tag push deliberately does not re-trigger the tag jobs). This is
   pre-existing, not introduced here, and R-3's alternative path exists for when
   the asset matters. Not closed by this task.
3. **`VERSION` never states what shipped** (R-1). Deliberate. `git tag --list`
   and `npm view` remain the source of that answer.
4. **Disagreement with the spec, recorded as required, planned to as written:**
   D-2 rule 3 fires on ANY literal-prefix difference, including a downward hand
   edit -- `0.1.-` after `0.2.0` has shipped resolves to `0.1.0`, which is
   already published. The spec has no rule for that case. Rather than change the
   spec, the CLI's strictly-greater guard turns it into a loud non-zero exit
   before `npm publish` is ever reached. If the user later wants downward edits
   to publish a patch on the older line, that is a follow-up decision, not a
   silent behaviour here.
5. **Type-stripping dependency**: `scripts/version.mjs` importing a `.ts` seam
   requires node >= 22.18 on whatever runs it. CI pins node 22 in every job, and
   the repo already requires >= 22.18 for the MCP server. The installer package
   (node >= 18) deliberately does not import it -- see task 2d.
</risks>

<output>
Create `.planning/quick/260819-tsz-single-version-template-plus-resolver-sc/260819-tsz-SUMMARY.md` when done.

The summary must state, explicitly: which release path the user should use for
v0.2.0 (R-3), that the local `v0.2.0` tag has no role and should not be pushed,
and that nothing was pushed, tagged, or published by this task.
</output>
