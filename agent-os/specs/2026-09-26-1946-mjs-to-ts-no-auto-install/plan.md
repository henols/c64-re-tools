# Cleanup: `.mjs` → TypeScript, and never auto-install

## Context

Two roadmap items under **Cleanup** in `agent-os/product/roadmap.md:126-133`:

1. **Convert the remaining hand-written `.mjs` to TypeScript.** There are 45 hand-written files, about 16k lines:
   - the installer (3 files);
   - skill scripts (30 files, about 11k lines);
   - `src/mcp/vice` (12 files).

   The 22 `src/mcp/vice/resources/*.mjs` are `build.ts` output and are out of scope. So is `.agents/skills/mastra`, which is third-party.
2. **Enforce never-auto-install.** `installer/bin/cli.mjs:135-140` writes `npx -y @henols/vice-mcp@<ver>` into a consumer's `.mcp.json`. Its `--vendor` route (`:210-222`) runs `npm install --save-dev` and then wires bare `npx`, which also installs silently when there is no TTY. The shipped remedy text also tells people to run `npx -y` (`broker-endpoint.mts:492` `BROKER_START_COMMAND`, `anno-cli.ts:192` `NPX_INVOCATION`, README).

Research also found that the npm-installed server most likely does not start today. `vice-cli.mjs:205` imports `./vice-proxy.ts`, and Node refuses to strip types under `node_modules` (`vice-proxy.ts:150-160`). The plugin route (`node <root>/src/mcp/vice/vice-proxy.ts`, `.mcp.json:5`) works.

**Owner decisions (shaping):**
- **The installer stops wiring MCP.** It installs skills only. `.mcp.json` writing, `--vendor`, the dev-placeholder `@latest` fallback and the `@henols/vice-mcp` dependency all go. It prints that the MCP server comes from the Claude Code plugin.
- **No shipped text says `npx -y`.** The broker and anno remedies switch to the plugin/checkout form.
- **Skill scripts become `.ts`,** and each skill's `scripts/` directory gets a one-line `package.json` `{"type":"module"}`. A consumer's `"type":"commonjs"` then cannot break loading.
- Everything hand-written is converted, including the manual `probe-binmon` and the fixture generators. The owner prefers autonomous decisions.

Spec folder: `agent-os/specs/2026-09-26-1946-mjs-to-ts-no-auto-install/`

---

## Task 1: Save spec documentation

Create the spec folder with:
- `plan.md` (this plan);
- `shape.md` (scope, the three owner decisions above, the traps list below);
- `standards.md` (full text of the standards listed at the end);
- `references.md` (the files cited here).

Follow the format of `agent-os/specs/2026-09-26-1019-no-cross-side-paths/`.

## Task 2: Never auto-install (installer + remedy text)

- **`installer/bin/cli.mjs`:**
  - Delete `wireMcp`, `viceServerEntry`, `vendorInstall`, `--vendor` parsing and help, the version/placeholder block (`:32-85`), the `npx -y` summary line and the only `spawnSync`.
  - `--vendor` (and any unknown flag) is refused by name, and the refusal says the MCP server comes from the plugin.
  - The final summary says: MCP server = enable the Claude Code plugin (the README section).
- **`installer/package.json`:** drop `dependencies["@henols/vice-mcp"]`.
  - Update `src/mcp/vice/version.test.ts:78-88` so it no longer pins that dependency.
  - Drop the `npm pkg set dependencies…` stamping in `.github/workflows/ci.yml:244-249`.
- **`BROKER_START_COMMAND`** (`broker-endpoint.mts:492`, the skew text `:585-587`): switch to the plugin/checkout form, e.g. `node <plugin-root>/src/mcp/vice/vice-cli.mjs broker`. Verify that route starts the broker.
  - Rebuild `resources/` (`node build.ts`).
  - Update `broker-endpoint.test.ts:613,618` and `vice-proxy.test.ts:1885`.
- **`anno-cli.ts:192`:** delete `NPX_INVOCATION` and keep the `PLUGIN_INVOCATION` usage line. Update `anno-cli.test.ts:190`.
- **`mcp-module.mjs:155` refusal:** replace "run the npm installer with --vendor" with "use the Claude Code plugin, or set `VICE_MCP_DIR`". Update `mcp-module.test.mjs:121`.
- **Stale comments:** fix `vice-proxy.ts:143-160`, `anno-cli.ts:3-8`, `vice-broker.mts:198` and `broker-endpoint.mts:478-480`.
- **Docs:**
  - `README.md:34-36, 201-211`;
  - `installer/README.md:20, 30`;
  - `src/mcp/vice/README.md:20, 33-34`;
  - `agent-os/product/tech-stack.md:84`;
  - `mission.md:64-66` (keep the rule; say it now binds shipped remedy text too).

## Task 3: Compiled entry points (bins loaded from `node_modules`)

Two files must be JS because they run from `node_modules`: `vice-cli` (the `vice-mcp` bin) and `installer/bin/cli` (run via `npx @henols/c64-re-tools`).

- **Add a second artifact path to `src/mcp/vice/build.ts`: `ENTRY_ARTIFACTS`.**
  - Each source `.mts` is emitted *beside itself*, not into `resources/`. It is not host-bound, and `install-resources.ts` must never deploy it.
  - Use a separate `tsconfig.entry.json` (tsc CLI; TypeScript 7 has no JS API) with no `rewriteRelativeImportExtensions`.
  - Staging and atomic rename work as `build()` does today.
  - The generated banner goes *after* the shebang line, with wording for entry points.
  - The installer targets Node 18 (`engines`), so it uses an ES2022 target and only `node:` builtins.
- **`vice-cli.mjs` → `vice-cli.mts`.**
  - Make the proxy import specifier non-literal so tsc does not pull in the whole proxy graph.
  - Delete `vice-cli.d.mts`.
  - `vice-cli.test.ts:166-181` keeps asserting bin/main = `vice-cli.mjs` and not host-bound.
  - Leave the `vice-proxy.ts`-under-`node_modules` defect as-is and keep it listed in the roadmap. Fixing it means compiling the server graph, which is out of scope.
- **`installer/bin/cli.mjs` → `installer/bin/cli.mts`,** compiled to `installer/bin/cli.mjs`. Set `installer/package.json` `files` to ship `bin/cli.mjs`, not the `.mts`.
- **Drift test:** extend `resources-sync.test.ts`, or add `entry-sync.test.ts`, so that each entry `.mjs` is byte-identical to a fresh build.
- Update `agent-os/standards/broker/host-bound-modules.md` with one line: entry artifacts are compiled but NOT host-bound.

## Task 4: Installer repo-only scripts and tests

- **`installer/scripts/sync-skills.mjs` → `.ts`** (it runs from the checkout on Node 24, with no compile step). Update the `prepack` and `sync-skills` scripts.
  - `isNonShipping` (`:84-90`) must skip `*.test.ts` and `test-corpus.ts`. Keep the `.mjs` patterns until Task 5 lands.
  - It must ship each `scripts/package.json`.
- **`installer/wire-mcp.test.mjs` → `installer/cli.test.ts`.** Behaviour tests spawn the compiled `bin/cli.mjs` against a temp directory:
  - skills are copied;
  - no `.mcp.json` is created, and an existing one is left byte-for-byte unchanged;
  - `--vendor` exits non-zero and names the remedy;
  - there are no `npm`/`npx` child processes (inject or stub `PATH` with a tripwire `npm`/`npx` that fails the test if run).
  - Set installer `npm test` to `node --test '*.test.ts'`, and update the CI step at `ci.yml:176-180`.

## Task 5: Skill scripts → `.ts`

- **Order:** convert the hub `c64-ram-capture/scripts/mcp-module` first. It is imported by acme, c1541, petcat, packer-finding, vsf-slice and completeness-report. Then convert `project-paths`, `releases` and `watch-loads`, then each skill in turn.
- **Per file:**
  - `git mv` to `.ts` and change relative specifiers to `.ts`.
  - Add strict types; no `@ts-nocheck`.
  - Use the module header from `standards/global/module-header.md`.
  - Keep `resolveMcpModule("resources/host-tool-endpoint.mjs")` targets as `.mjs`, since they are compiled vice-mcp files.
- **Add `src/skills/<skill>/scripts/package.json` = `{"type":"module"}`** to all 8 skills.
- **Typecheck coverage:**
  - Extend `src/mcp/vice/tsconfig.json` `include` with `../../skills/*/scripts/*.ts` and the installer `.mts`/`.ts`, so `npm run typecheck` (CI `ci.yml:43`) covers them.
  - Remove the three `@ts-expect-error` imports (`anno-export-asm.test.ts:121`, `anno-provenance-ledger.test.ts:56`, `skill-memory-mapping-cli.test.ts:43`).
- **Traps to fix explicitly:**
  - `recovery-schema.mjs:285-293`: `listMjsFiles` filters `.mjs`. Change it to `.ts`, or it scans 0 files and reports OK.
  - `packer-finding.mjs:635`: its main guard checks the extension. Use the standard `resolve(argv[1]) === fileURLToPath(import.meta.url)` guard, and use it for `completeness-report` (`:463`) too.
  - Source-regex tests that type annotations could trip: `packer-finding.test.mjs:239-257`, `derive-transients.test.mjs:563-569` and `vsf-slice.test.mjs:195-225`. Keep the matched lines intact, typing via `satisfies` or separate type aliases, and do not loosen the tests.
  - Hard-coded filenames in usage strings, generated consumer text, and the tests that pin them: `diff-images` `:699/714/789`, `watch-loads` `:461`, `compare`, `compare-cross-binary`, `derive-transients`, `vsf-slice`, `driver`, `derive` (`USAGE_MARKER` in `skill-program-recon-cli.test.ts:68`), `acme` (`skill-acme-build-cli.test.ts:54-163`, `template.a:2,14`).
  - The vice tests that spawn scripts by path: `anno-decomp-closure.test.ts:73`, `reassembly-gate-modified-run.test.ts:456`, `path-seam-absent.test.ts:155`.
- **CI:** change `ci.yml:192` to `node --test 'src/skills/*/scripts/*.test.ts'`.
  - Before the rename, `ls` the matched set. After the rename, confirm the count matches, because `node --test` silently skips globs that match nothing.
- **Docs:**
  - every `SKILL.md` invocation or line reference, plus the `references/` and `templates/` files the research listed;
  - `transients/README.md` and `.gitignore`;
  - `standards/skills/cross-package-reach.md:17` (`mcp-module.mjs` → `.ts`).
  - Also fix the pre-existing broken pointer: `c64-provenance-diff/SKILL.md:28,301` names `c64-provenance-diff/scripts/releases.mjs`, but that file is in `c64-ram-capture`.

## Task 6: `src/mcp/vice` repo-only `.mjs` → `.ts`

These run from the checkout only, so each becomes plain `.ts` with no compile step.

- **`test-gate.mjs`:**
  - Update `package.json` `test:automated`/`test:manual` and `ci.yml:148`.
  - Delete the orphan `test-gate.d.mts`.
  - Fix its stale "thirteen/fourteenth" and deleted-drift-guard comments.
- **`smoke.mjs`:** update the `smoke` script and CI `ci.yml:168-170`.
- **`anno-durability-mutator.mjs` and `anno-schema-v2-fixture.mjs`:** rename without the `anno-` prefix (e.g. `store-durability-mutator.ts`, `store-schema-v2-fixture.ts`). Otherwise `anno-seam.test.ts:67-69` requires them in `files[]`. Update `anno-durability.test.ts:62` and `anno-store.test.ts:2419,4566,4804`.
- **`probe-binmon.mjs`** (2454 lines):
  - It reads `process.env.VICE_BIN` (`:2339`), which `tool-location-consumers.test.ts:132-146` forbids for top-level `.ts`. Resolve x64sc through the `tool-location` resolver instead, following the one-resolver rule.
  - Update `binmon-fixtures.ts:267`, and the `probe-binmon.mjs:NNN` line references in `stock-protocol.ts` comments.
- **Fixture generators** (`fixtures/{export-asm,hazard-subject,vsf,coverage}/make-*.mjs`):
  - Keep their names free of `.test.`.
  - Keep lines that source-reading tests match intact, using `satisfies`: `hazard-subject-fixture.test.ts:566-573`, `hazard-subject-variants.test.ts:239-245,438-446`.
  - Update the spawn paths: `hazard-subject-exported-edit.test.ts:38`, `vsf-slice.test.ts:525`.
  - `vsf-slice.test.ts:489` pins `make-fixtures.mjs` in the committed `fixtures/vsf/*.json` sidecars. Regenerate the sidecars and check that the `.vsf` bytes are unchanged; only `command`/`capturedAt` may move.
  - Fix the READMEs that name the generators.

## Task 7: Guard, roadmap, standards

- **Structural test `no-handwritten-mjs.test.ts`.** This is a filename check, not a scan of source text.
  - Every tracked `*.mjs`/`*.js` outside `node_modules` and `.agents/` must be one of: `build.ts` `HOST_BOUND_ARTIFACTS`, `ENTRY_ARTIFACTS`, or a test's own scratch output.
  - Include a planted-violation proof, as `path-seam-absent.test.ts` does, so the check cannot pass vacuously.
  - Add an installer-side assertion that `installer/package.json` has no `dependencies` and that no `npx` appears in the compiled CLI's written output (behavioural, from Task 4).
- **`roadmap.md`:**
  - Move both cleanup items to Implemented.
  - Add a Known-defects entry: "npm-installed `vice-mcp` cannot start: `vice-proxy.ts` is not stripped under `node_modules`; the plugin is the supported MCP route."
- **`standards/skills/script-results.md`:** mention `scripts/package.json` `{"type":"module"}`.

## Verification

- `cd src/mcp/vice && node build.ts && npm run typecheck`: clean, and `git status` shows `resources/` unchanged except `broker-endpoint.mjs`.
- `npm test > log 2>&1; echo $?`: read the exit code on the same line and compare the failing *set* against a baseline taken before the change. Do not pipe to `tail`.
- `node --test 'src/skills/*/scripts/*.test.ts'`: the same test count as the pre-change `*.test.mjs` run.
- `cd installer && npm test`, then `npm pack --dry-run`. The tarball lists `bin/cli.mjs`, `skills/**/scripts/*.ts` and `scripts/package.json`, and no `*.test.ts`, `test-corpus.ts` or `.mts`.
- **Manual installer run:** `node installer/bin/cli.mjs <tmpdir>`. Skills land, no `.mcp.json` is written, and `--vendor` is refused. Run one converted skill script from `<tmpdir>/.claude/skills/c64-petcat/scripts/petcat.ts` with a `<tmpdir>/package.json` of `{"type":"commonjs"}`, to prove the per-skill `package.json` works.
- **Remedy check:** start the broker with the new remedy command (`node src/mcp/vice/vice-cli.mjs broker`) under a timeout, confirm it binds, and stop it. Never leave it running.
- `grep -rn 'npx -y\|--vendor' --exclude-dir=node_modules --exclude-dir=graphify-out --exclude-dir=agent-os/specs .` should return nothing in shipped code or docs.

## Standards applied

- **skills/script-results:** `.ts` scripts and the `{ok,message}` envelope are unchanged.
- **skills/cross-package-reach:** no static imports across packages, and `.mjs` targets stay compiled.
- **broker/host-bound-modules:** `broker-endpoint.mts` is rebuilt; entry artifacts are not host-bound.
- **global/module-header:** header on every converted non-test module.
- **skills/skill-md-shape:** `SKILL.md` invocation lines.
- **skills/refuse-never-guess:** `--vendor` and unknown flags are refused, not ignored.
