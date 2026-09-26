# Install through the `skills` CLI; ship a runnable npm server

## Context

The user wants the kind of installer `/find-skills` uses: the vercel-labs `skills` CLI
(`npx skills add owner/repo`). It clones the repo, discovers `SKILL.md` folders, and
installs them into any of 79 agents, including Claude Code, Cursor and Codex. It uses
symlinks, a lock file and `skills update`. Nothing needs publishing on skills.sh. It
installs **skills only**: I checked its source, and it has no MCP or install-script
support. The MCP server and broker need their own route.

Findings that shape the work (skills CLI v1.6.0 source, cached in `~/.npm/_npx`):

- **Discovery.** Today it finds our skills only by accident. plugin.json
  `"skills": "./src/skills/"` is a string, and the CLI iterates it one character at a
  time. The CLI then falls back to a full-depth walk, only because the tracked
  `.agents/skills/mastra` is in `skills-lock.json`. A root `skills/` folder is the
  default location for both the CLI and Claude Code plugins.
- **Copying.** It copies each skill folder almost wholesale, excluding only
  `metadata.json`, `.git` and `__pycache__`. So the 11 colocated tests,
  `test-corpus.ts` and `transients/danish.json` would ship. `danish.json` is a derived
  allow-list that must never ship.
- **Subsets.** A user can install one skill (`--skill`). Seven scripts in five other
  skills statically import `c64-ram-capture` modules: acme, c1541, petcat,
  packer-finding, completeness-report, diff-images and recovery-schema. They crash with
  `ERR_MODULE_NOT_FOUND` when that skill is missing.
- **npm server.** An npm-installed `@henols/vice-mcp` cannot start: `vice-cli.mjs`
  imports `vice-proxy.ts`, and Node never strips types under `node_modules`. The server
  graph is about 80 modules. All are erasable-syntax (checked with
  `module.stripTypeScriptTypes`).

**Owner decisions**

- Standardise on the `skills` CLI and retire our `@henols/c64-re-tools` installer.
- Move `src/skills/` to a root `skills/` folder.
- Document "install all" (`--skill '*'`). A missing sibling skill gets a refusal that
  names it, not a crash.
- Move the tests and `danish.json` out of the skill folders.
- Also fix the npm package, so that `npm i -g @henols/vice-mcp` gives a working
  `vice-mcp`, `vice-mcp anno` and `vice-mcp broker`. Then `npx add-mcp vice-mcp`
  (neon-solutions/add-mcp) can wire the server into any agent.

**My decisions** (standing "you decide"):

- Compile the server into `dist/` at publish time. Don't commit it, and don't emit it
  beside the sources, which would add about 80 committed files, trip
  `load-order.test.ts`'s same-stem check, and double-count five flat scans.
- The broker stays started by hand (product rule).

**Prerequisite.** The previous spec (`.mjs` → TS) is 173 uncommitted changes. Commit it
first, with the owner's OK, so this work diffs cleanly.

Spec folder: `agent-os/specs/2026-09-26-2049-skills-cli-install/`

---

## Task 1: Save spec documentation

Create the folder with `plan.md` (this plan), `shape.md` (scope, the decisions above,
the traps below), `standards.md` and `references.md`, in the format of
`2026-09-26-1946-mjs-to-ts-no-auto-install/`.

## Task 2: Move the skills to root `skills/` and make discovery explicit

- `git mv src/skills skills`.
- **plugin.json.** Drop the `"skills"` key. Root `skills/` is Claude Code's default, and
  the CLI scans `skills/` first. Confirm with `claude plugin validate` if available.
- **Runtime path fixes:**
  - `skills/c64-ram-capture/scripts/mcp-module.ts:161-162`: the in-repo rung becomes
    `join(dirname(SKILLS_DIR), "src", "mcp", "vice")`. Otherwise every host-tool call
    refuses.
  - `src/mcp/vice/memmap-lookup.ts:51` and `anno-regbits-gen.ts:62`: drop the `"src"`
    segment. They keep 3 hops.
- **The vice tests that build skill paths:**
  - `join(HERE,"..","..","skills")` gains one `".."`. Sites: `path-seam-absent.test.ts:21,155`,
    `prerequisites.test.ts:45`, `anno-cli-path-consumers.test.ts:551`,
    `anno-decomp-closure.test.ts:73`, `reassembly-gate-modified-run.test.ts:456`,
    `skill-acme-build-cli.test.ts:54`, `skill-memory-mapping-cli.test.ts:51-52`,
    `skill-program-recon-cli.test.ts:39`.
  - `..,..,..,"src","skills"` drops `"src"`. Sites: `anno-regbits.test.ts:96`,
    `join-image-controls.test.ts:73`, `memmap-lookup-controls.test.ts:37`, and the three
    live tests.
  - Scratch-layout copies change from `tmp/src/skills/...` to `tmp/skills/...`.
  - Relative imports change from `../../skills/` to `../../../skills/` in
    `anno-export-asm.test.ts:118`, `anno-provenance-ledger.test.ts:56` and
    `skill-memory-mapping-cli.test.ts:37`.
- **Trap: negative path assertions.** Three tests forbid the source path while requiring
  `.claude/skills/...`: `diff-images.test.ts:530`, `watch-loads.test.ts:361` and
  `skill-acme-build-cli.test.ts:163`. The new forbidden string `skills/<skill>/...` is a
  substring of the required one. Anchor it, e.g. `(^|[\s\`'"(])skills/`, and never drop
  the check.
- **Config and text:**
  - `src/mcp/vice/tsconfig.json` include becomes `../../../skills/*/scripts/*.ts`.
  - `packer-finding.ts:633` USAGE, `prerequisites.json` `source` citations (then rebuild
    `resources/prerequisites.json`).
  - Every `S=src/skills/...` line in `SKILL.md`, `README.md` (Layout, "Developing this
    repo"), `CLAUDE.md:21`, `standards/skills/skill-md-shape.md:15`.
  - Comments found by a `git grep src/skills` sweep. Leave
    `fixtures/upstream-procedure-manifest.json` `destination` alone: it is a historical
    record.

## Task 3: Move tests and evidence out of the skill folders

- **Tests.** `git mv skills/<skill>/scripts/<name>.test.ts test/skills/<skill>/<name>.test.ts`
  for all 11, plus `test-corpus.ts` to `test/skills/c64-ram-capture/test-corpus.ts`.
  - Add a `SCRIPT_DIR` constant (`<repo>/skills/<skill>/scripts`) wherever a test uses
    `HERE` for the script location. That covers spawn targets, source reads, the
    vsf-slice scratch copy list, and `diff-images` `SKILLS_ROOT`.
  - Imports become `../../../skills/<skill>/scripts/X.ts` and `../../../src/mcp/vice/X.ts`.
  - Repo-root hops go from 4 to 3. Delete the unused `REPO_ROOT` constants in
    `dump-artifacts.test.ts` and `watch-loads.test.ts`.
- **Silent-skip traps.** A wrong `MCP_DIR` in `vsf-slice.test.ts`, the predicate ladder
  in `derive-transients.test.ts`, or `diff-images.test.ts` pairs silently skips instead
  of failing. Compare the skip count to the baseline (6).
- **Wider import-rule regex.** Widen the rule in `diff-images.test.ts:655-690` and
  `watch-loads.test.ts:268-290` to also match `import("...")`, so a guarded dynamic load
  (Task 4) stays checked.
- **Other scans:**
  - Add `test/` to the root list in `anno-cli-path-consumers.test.ts:551`, so moved tests
    are still scanned for `spawn("node"`.
  - Add `../../../test/**/*.ts` to the tsconfig include.
- **CI.** `ci.yml` "Test the skills" becomes `node --test 'test/skills/*/*.test.ts'`.
  `ls` before and after, and match the count (11 files, 220 tests).
- **Evidence.** Move `skills/c64-ram-capture/transients/danish.json` to
  `evidence/transients/danish.json`, with a short README saying it is repo-only.
  - `c64-ram-capture/SKILL.md` `TD=` and `transients/README.md` currently tell users to
    write derived lists into the skill folder, which `skills update` would overwrite.
    Point `TD` at the project data root (`dataRoot()`/transients).
  - Fix README :132-137: the skills CLI does copy the nested `.gitignore`.

## Task 4: Refuse by name when a sibling skill is missing

- Add a small `scripts/sibling.ts` to each consuming skill: acme-build, c64-disk-access,
  c64-petcat, c64-program-recon, c64-provenance-diff and routine-queue-walker. It holds
  `loadSibling(skill, () => import("../../c64-ram-capture/scripts/X.ts"), expectedPath, why)`.
  - It returns `{ok:true, mod}`, or `{ok:false, message}` only for an
    `ERR_MODULE_NOT_FOUND` naming `expectedPath`. It re-throws anything else, such as
    `projectRoot()` failing inside `releases.ts`.
  - The message names the missing skill and the install command
    (`npx skills add henols/c64-re-tools --skill c64-ram-capture`).
  - Keep the literal specifier so tsc still types the module. Leave `import type` lines
    alone, since they erase at runtime.
- **Where each script loads:**
  - acme, c1541, petcat: lazily inside the async verbs, just before `invokeHostTool`,
    returning `{ok:false,message}` into the existing report path.
  - packer-finding, completeness-report: store the result from a top-level await, and
    fold it into the existing absent/throw paths. The exported API is unchanged, and
    nothing calls `process.exit` on import.
  - diff-images, recovery-schema: they call `projectRoot()`/`dataRoot()` at module top.
    Make those lazy inside the verbs, then load siblings in the verbs.
- **Test.** For each consumer, copy the consuming skill alone into a scratch `skills/`
  tree, run one verb, and assert exit 1 plus a message naming `c64-ram-capture`.
- **Standard.** Write the rule into `standards/skills/cross-package-reach.md`: sibling
  reach is guarded, and skills are installed from git with no npm package line.

## Task 5: Retire the npm installer

- Delete `installer/` and the `.gitignore` entries `/installer/skills/`, `*.tgz` and
  `/.audit-root-synth-*/`.
- **build.ts.** Remove the installer from `ENTRY_ARTIFACTS` and from
  `tsconfig.entry.json` `include`, in the same change: `buildEntries()` asserts the set.
  Also drop the installer includes in `src/mcp/vice/tsconfig.json`.
- **Tests:**
  - `version.test.ts:78,83-84`: drop the installer assertions.
  - `no-handwritten-mjs.test.ts`: use non-installer sample paths.
  - `entry-sync.test.ts`: fix the comment.
- **broker-endpoint.mts.** Drop `INSTALLER_PACKAGE_NAME` and the "published together"
  wording in the rank-4 skew message, then rebuild. Update
  `broker-endpoint.test.ts:648-662`.
- **`vsf-slice.ts` header** mentions `@henols/c64-re-tools`. Change it together with
  `vsf-slice.test.ts:219`, which asserts that header.
- **CI:**
  - Delete "Generate the shipped skills tree", "Test the installer",
    "Publish @henols/c64-re-tools" and the `decl-02-node18-proof` job. Its only reasons
    were the installer's Node 18 floor and a dropped doctor command.
  - Reword the "both packages" comments.
  - Delete the obsolete `check-npm-token.yml` (publishing is OIDC).
- **Docs:**
  - README section A becomes `npx skills add henols/c64-re-tools --skill '*'`, noting
    `-a claude-code`, `-g`, `DISABLE_TELEMETRY=1`, and that the user runs it themselves.
  - Update "The two published packages" and the Publishing section.
  - `CLAUDE.md`, `mission.md`, `roadmap.md`, `tech-stack.md`,
    `standards/broker/host-bound-modules.md`.
  - Delete the `c64-program-recon/SKILL.md:316-322` "generated twin" paragraph.
  - Fix `c64-memory-mapping` "Node ≥ 18" to ≥ 24.
- **Out of repo.** `npm deprecate @henols/c64-re-tools` is a manual step for the owner.
  I will print the command, not run it.

## Task 6: Make an npm-installed `@henols/vice-mcp` run

- **Compile the graph** with a new `tsconfig.server.json`:
  - roots: `vice-proxy.ts`, `vsf-slice.ts`, and `tool-location.mts` (reached only
    through backend-detect's `createRequire`);
  - `rewriteRelativeImportExtensions`, `outDir: dist`.
  - New `buildServer()` in `build.ts`, using the same staging, assert and rename
    discipline, with a `SERVER_ARTIFACTS` set asserted.
  - `dist/` stays gitignored and is built by a `prepack` script.
  - The publish job gains `npm ci` before `npm publish`.
- **`vice-cli.mts`.** The non-broker route imports `./dist/vice-proxy.js` when present.
  Otherwise it imports `./vice-proxy.ts`, which keeps the checkout and plugin routes
  working. Rebuild the entry artifact.
- **Make lookups layout-tolerant** with the existing two-candidate `[HERE, HERE/..]`
  idiom (`broker-endpoint.mts:138`, `tool-location.mts:282`):
  - `vice-proxy.ts:254,362` package.json version (currently a silent `0.0.0-dev`);
  - `vice-proxy.ts:471` `tools-manifest.stock.json` (currently a startup failure);
  - `install-resources.ts:90` `RESOURCES_DIR`;
  - `anno-enum-gen.ts:143` and `anno-cli.ts:2032` `anno-regbits.json`;
  - `repo-root.ts` 3-hop fallback.
- **Ship `memmap.json`** in the package: copy it at build time into both the package
  root and `dist/`, as `HOST_BOUND_DATA_FILES` does. `memmap-lookup.ts` tries its
  package-local copy first, then the repo skill path.
- **Startup deploy.** When the module path is under `node_modules`, skip
  `ensureResourcesInstalled`. It deploys the obsolete launcher, and on a global install
  it would write into `<prefix>/lib`.
- **Skill reach.** `mcp-module.ts` rung 3 (published package) resolves compiled targets.
  `vsf-slice.ts` maps to `dist/vsf-slice.js`, and completeness-report uses
  `vice-cli.mjs anno` instead of `vice-proxy.ts`. Do not add an `exports` map to
  `package.json`: rung 3 relies on subpath resolution.
- **package.json.** Add `files += "dist/", "memmap.json"`, declare
  `@modelcontextprotocol/sdk` (imported at `vice-proxy.ts:122`, currently only
  transitive), and add `"prepack": "node build.ts --server"`.
- **Proof** in a new `smoke-packed.ts`, run as a CI step after Test:
  1. `node --no-experimental-strip-types vice-cli.mjs`, through smoke's
     `initialize`/`tools/list`, plus `anno --help`. Any `.ts` load fails.
  2. `npm pack`, then extract as real files into
     `<scratch>/node_modules/@henols/vice-mcp`, with its `node_modules` symlinked to the
     repo's. Run the bin: MCP handshake, `anno --help`, and `broker --help`. Do not start
     a broker.
  3. Clean up the scratch directory: `/tmp` is RAM on this host.
- **Remedy text and docs:**
  - `BROKER_START_COMMAND` names both forms: `vice-mcp broker` (npm) and
    `node <plugin-root>/src/mcp/vice/vice-cli.mjs broker`.
  - README MCP section:
    - **Claude Code:** the plugin (plus `npm ci --prefix`).
    - **Other agents:** `npm i -g @henols/vice-mcp`, then
      `npx add-mcp vice-mcp --env MASTRA_TELEMETRY_DISABLED=1`. Never `add-mcp @henols/vice-mcp`,
      which would write an `npx` launch that installs on first run.
    - **Broker:** started by hand.
  - Remove the roadmap Known-defect entry, the `vice-proxy.ts:142-147` header note and
    `README` lines 19-21. Widen `cross-package-reach.md:15` (compiled `dist/` or
    `resources/`).

## Task 7: Roadmap, standards, memory

- **Roadmap.** Move the installer and npm-server items to Implemented. The "dedicated
  test folder" cleanup is done for skills; the vice tests stay colocated.
- **Standards:** update `script-results.md` and `cross-package-reach.md`.
- **Memory:** update `typescript-only` (dist is build output).

## Verification

- `cd src/mcp/vice && node build.ts && npm run typecheck`: clean. `resources/` changes
  only as intended.
- **Full suites,** redirected, reading `$?` on the same line:
  - vice `npm test`, compared to the baseline 4166/0 fail/77 skip. The installer's 10
    tests are gone; new tests are added.
  - `node --test 'test/skills/*/*.test.ts'`: 220 tests, 0 fail, 6 skip. A higher skip
    count means a silent path break.
- **`npm run smoke` and `node smoke-packed.ts`** exit 0.
- **The real CLI:**
  - `npx skills add ./ --list` from the checkout (the user's own CLI, local path)
    lists exactly the 8 skills, not mastra or asd-ste100.
  - In a scratch project, `npx skills add <checkout> --skill '*' -a claude-code -y --copy`:
    the installed tree has no `*.test.ts`, no `test-corpus.ts`, no `danish.json`, and
    has `scripts/package.json`.
  - Then install `--skill c64-petcat` alone and run it: a named refusal.
- **Leftover references:** `git grep -n 'src/skills\|@henols/c64-re-tools\|installer/'`
  returns only intended hits (history records, specs).
- **Nothing left running:** no broker is left running, and the scratch dirs are removed.
