# One Endpoint Client — Shaping Notes

## Scope

This is roadmap v2.0.0 "One Broker, One Socket", step 1. Every host-tool caller reaches the broker through the one fixed endpoint, using a compiled endpoint client. The callers are the four skill scripts (`acme.mjs`, `c1541.mjs`, `petcat.mjs`, `packer-finding.mjs`) plus the MCP-side `ghidra-run.ts` and `dxa-run.ts`.

The step also:
- removes the `outDir`/`sourceDir` tool arguments;
- has the broker install the Ghidra extension from its own vendored tree;
- gives CI's ACME test its own broker.

Out of scope: deleting `host-tool-client.ts`, the legacy `host_tool` op and the bare-host branch. That is roadmap step 2, the deletion cutover.

## Decisions

- `broker-endpoint.ts` and `version.ts` are renamed to `.mts`, following the host-bound convention and `build.ts`'s `.mjs`-only output.
- The endpoint client gets a `run` CLI that prints one JSON line (the `{ok, …}` envelope) and exits 0 or 1.
- The client version is read from `package.json` beside the module, then one directory up (the `resolveBrokerVersion` precedent). This keeps a compiled `resources/` copy from reporting `0.0.0-dev`.
- Results land under `<project>/.c64-re-tools/<kind>/`. The skill scripts move them to `-o`/`--out-dir` afterwards, so user-facing flags keep working.
- `vendor/` joins `package.json` `files[]`. The broker locates `vendor/ghidra-ext` the way `findDxaBinary` locates dxa, and `ghidra.installExtension` takes only `{ moduleName }`.
- In the npm installer's default npx mode, where no MCP module is resolvable, the skill scripts refuse at the point of use and name the remedy: `--vendor` or the plugin. Nothing is installed automatically.
- Skill scripts stay `.mjs` in this step. The `.ts` conversion is a separate roadmap item.
- Nothing under `.planning/` is touched.

### Decided during implementation

- Skill scripts download results into a staging directory inside their own
  output directory (`mcp-module.mjs` `invokeHostTool()`), then move them into
  place, not under `<project>/.c64-re-tools/`. `projectRoot()` walks up from
  the script, which fails in plugin mode, and a same-filesystem move needs no
  copy.
- `outDir` is replaced by `HostToolDeps.outputDir`, an executor option no
  request can set. The broker sets it to the request's scratch `out/`, and
  in-process callers name their own.
- `acme.build` declares `.sym`, `.vs` and `.rep` as outputs, because only
  declared outputs cross back on the endpoint route.
- The transfer dial pauses the socket when it hands it over, fixing an
  intermittent 0-byte download.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:** one broker per machine on fixed TCP 19510. Files cross the socket as bytes behind opaque handles, and neither side names a path the other must open. Skill scripts never spawn external binaries. Node ≥ 24. Plugin dependencies come from a manual `npm ci`.

## Standards Applied

- **broker/host-bound-modules:** the endpoint client becomes host-bound and is compiled into `resources/`.
- **skills/cross-package-reach:** skill scripts reach the client through `resolveMcpModule` plus `process.execPath`.
- **skills/script-results:** the last-line `{ok, message}` envelope.
- **skills/refuse-never-guess:** refuse when the client or an input is missing; never guess a path.
- **global/injectable-deps:** tests inject `dialSession`/`transferFile` rather than stubbing the client.
- **global/module-header:** short headers on new or changed modules.
