# v2.0.0 step 1: every host-tool caller through one endpoint client

## Context

This is the roadmap's In Progress milestone, v2.0.0 "One Broker, One Socket", step 1. Every host-tool caller should reach the broker through the one fixed endpoint (TCP 19510, `hello` handshake, files as bytes behind opaque handles).

Today nothing in production does. `runHostToolOverEndpoint()` in `src/mcp/vice/host-tool-endpoint.mts` has only test callers. Every real caller goes through `host-tool-client.ts`, which has two branches, chosen by `isInsideContainer()`:
- **Container branch:** reads broker.json and sends the legacy `host_tool` op, which uses host paths. It also ignores `--repo-root`.
- **Bare-host branch:** spawns `resources/host-tool.mjs` directly, with no broker.

Three more gaps:
- `ghidra.installExtension` cannot run over the endpoint at all, because it needs `sourceDir`, which that route refuses.
- `vendor/` is not shipped in the package.
- CI's ACME CLI test uses the bare-host branch and never starts a broker.

Outcome of this step:
- All 4 skill scripts and the MCP-side Ghidra/dxa callers use a compiled endpoint client.
- `outDir`/`sourceDir` are gone from the tool arguments.
- The broker installs the Ghidra extension from its own vendored tree.
- CI's ACME test runs against its own broker.

Deleting `host-tool-client.ts`, the legacy op and the bare-host branch is step 2 of the roadmap, not this one.

Decisions made in shaping:
- `broker-endpoint.ts` and `version.ts` are renamed to `.mts`.
- The client version is looked up beside the module, then one directory up, the way `resolveBrokerVersion` does it.
- Results land under the project's `.c64-re-tools/<kind>/`. Each skill script then moves them to its `-o`/`--out-dir` destination, so those flags keep working for users.
- `vendor/` joins `files[]`, and the broker resolves the tree the way `findDxaBinary` does (`host-tool.mts:2682`).
- In the npm default (npx) mode the skill scripts refuse, naming the remedy (`--vendor` or the plugin). Nothing is installed automatically.
- Skill scripts stay `.mjs` for now. Converting them to `.ts` is a separate roadmap item.
- `.planning/` is not touched.

## Task 1: Save spec documentation

Create `agent-os/specs/2026-09-25-1853-one-endpoint-client/` with:
- **plan.md**: this plan.
- **shape.md**: scope, the decisions above, context (no visuals; product constraints: one broker, fixed port, bytes over the socket, skill scripts never spawn binaries, Node 24, manual `npm ci`) and the standards applied.
- **standards.md**: the full text of `broker/host-bound-modules`, `skills/cross-package-reach`, `skills/script-results`, `skills/refuse-never-guess`, `global/injectable-deps` and `global/module-header`.
- **references.md**:
  - `host-tool-endpoint.mts` and `runHostToolOverEndpoint` (the client);
  - `broker-endpoint.ts` `dialHostToolSession` and `transfer-client.mts` (dial and transfer);
  - `vice-broker.mts` `handleHostToolStage`/`handleHostToolRun` and `broker-transfer.mts` `stageHostToolRequest` (the broker side);
  - `broker-harness.ts` `startHarnessBroker` (the test broker);
  - `host-tool-endpoint.test.ts` (an existing end-to-end test);
  - `findDxaBinary` (the pattern for locating vendored files);
  - `resolveBrokerVersion` (`broker-control.mts:762`, the version lookup).

## Task 2: Make the endpoint client compile and give it a CLI

- Rename `broker-endpoint.ts` to `.mts` and `version.ts` to `.mts`. Rewrite every import of them (about 14 files, including tests). Update `package.json` `files[]`.
- Add a `run --tool <id> --args <json> [--tools-root <dir>] [--base-dir <dir>]` entry to `host-tool-endpoint.mts`:
  - it prints one JSON line (the `{ok, …}` envelope) and exits 0 or 1;
  - it never throws;
  - `toolsRoot` defaults to `<project>/.c64-re-tools`, where the project is the first `.git` ancestor of `baseDir`, or `C64RE_PROJECT_ROOT`. This matches how the skill scripts' `project-paths.mjs` resolves it.
- Client version: `broker-endpoint`'s `CLIENT_VERSION` reads `package.json` beside the module, then one directory up, so `resources/` resolves the real version.
- Add `host-tool-endpoint`, `transfer-client`, `broker-endpoint` and `version` to `tsconfig.build.json` `include` and to `build.ts` `HOST_BOUND_ARTIFACTS`. Run `node build.ts` and commit `resources/*.mjs`. Keep `broker-endpoint.test.ts`'s "never touches the filesystem" rule true for the dial path; the version read is a separate module-load concern, so check the test's scope.

## Task 3: Resolve the compiled client from skill scripts

- In `src/skills/c64-ram-capture/scripts/mcp-module.mjs`, callers now ask for `resources/host-tool-endpoint.mjs`. The existing rungs (`VICE_MCP_DIR`, the in-repo path, `@henols/vice-mcp`) resolve it in plugin and `--vendor` modes.
- When no rung resolves, `refusalMessage()` names the remedy: install with `--vendor`, or use the plugin.
- Update `mcp-module.test.mjs`.

## Task 4: Move acme-build onto the endpoint (first caller)

In `src/skills/acme-build/scripts/acme.mjs`:
- Drop `commonAncestorDir`, `--repo-root` and `outDir`.
- Send `source`/`includes` relative to the base directory, and spawn the compiled client with `process.execPath`.
- After download, move the `.prg`/`.sym`/`.vs`/`.rep` outputs from `<toolsRoot>/builds/` to the `-o` stem or `--out-dir`, keeping the current naming and the `.vs` rewrite.

CI gets its own broker:
- Add an `env` option to `startHarnessBroker` (`broker-harness.ts`), so the test can set the library-free `ACME=""` and `ACME_BIN` on the broker's environment.
- `skill-acme-build-cli.test.ts` starts a harness broker and runs `acme.mjs` under `broker.childEnv`. It asserts the same output placement as today.
- `.github/workflows/ci.yml`'s scaffold step needs no new step, because the test starts its own broker. Fix the stale `ci-guardrails.test.mjs` comment.

## Task 5: Move the remaining skill scripts

- **`c1541.mjs`** (`c1541.*`): it reads results by handle download instead of `results[0].path`, and moves them to `--out-dir` when given.
- **`petcat.mjs`** (`petcat.decode`): the same pattern.
- **`packer-finding.mjs`** (`oracle.probe`/`oracle.run`): it uses only the `stdout` field. Keep `execFileSync`, which must stay synchronous, pointed at the compiled client CLI.
- Update `c1541.test.mjs`, `petcat.test.mjs` and `packer-finding.test.mjs` where they assert paths or `--repo-root`.
- Update the `--out-dir` wording in `acme-build`, `c64-disk-access` and `c64-petcat` `SKILL.md` if their behaviour text changes.

## Task 6: Move the MCP-side Ghidra and dxa callers

- **`ghidra-run.ts`:** default to `runHostToolOverEndpoint` instead of `runHostToolFromContainer`, and read the run log from the downloaded result.
- **`dxa-run.ts`:** the same. Write the `knownDataRows` block and label files to a local scratch directory under `toolsRoot` and upload them as inputs, not through `outDir`.
- Update the live tests `dxa-live`, `ghidra-live` and `ghidra-opcode-live` from their `{repoRoot}` option to a harness broker. They are manual-only and default to skip.

## Task 7: Remove outDir/sourceDir; the broker installs the Ghidra extension itself

In `host-tool.mts`:
- Remove `outDir` from the argument tables, interfaces, narrowing and resolution for `acme.build`, `dxa.disassemble`, `c1541.*` and `petcat.decode`. Outputs always land in the scratch `out/` and come back as handles.
- Reduce `ghidra.installExtension` to `{ moduleName }`. The executor locates `vendor/ghidra-ext` beside its own module (`HERE/vendor`, then `HERE/../vendor`, like `findDxaBinary`), and the `repoRoot`-relative check at about line 3095 goes.
- Delete `HOST_TOOL_REFUSED_STAGED_INPUT_KEYS`, since there is nothing left to refuse.
- Add `vendor/` (`ghidra-ext` and `dxa`) to `src/mcp/vice/package.json` `files[]`.
- Update the tests: `host-tool.test.ts` (the census around lines 2975-2999, 3378 and 3418, the `installExtension` case at 2380-2416, and the `bindStagedInputs` refusal at 4191), plus `hostpath-consumers.test.ts`'s family floor if the file set changes. Keep `sleigh-compile-gate.test.ts`'s six-file assertion.

## Verification

1. `npm run typecheck` is clean, and `node build.ts` leaves `resources-sync.test.ts` green.
2. `npm test` is redirected to a file and its exit code read. The failing set must equal the current baseline: WR-20 plus the pre-existing `PROJECT.md` citation anchor.
3. `node --test skill-acme-build-cli.test.ts host-tool-endpoint.test.ts host-tool.test.ts mcp-module.test.mjs` passes, with `VICE_REQUIRE_ACME=1`, against a harness broker. Run `ls` on each file first, because `node --test` silently skips missing files.
4. Real run: start the broker as a systemd user unit, then from a scratch project run `node src/skills/acme-build/scripts/acme.mjs build <src> -o <out>`. Confirm the `.prg` bytes land at `<out>` and the answer is `ok`. Then stop the broker and check that no `vice-broker` or `x64sc` processes are left.
5. `npm pack --dry-run`: `resources/host-tool-endpoint.mjs` and `vendor/ghidra-ext/**` are listed.
6. Do not run the known-broken live VICE suites.
