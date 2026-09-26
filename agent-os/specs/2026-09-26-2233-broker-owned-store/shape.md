# Broker-Owned Store — Shaping Notes

> **Superseded on 2026-09-27 for where the store lives:** the owner ruled the
> annotation database a committed project artifact. See
> `../2026-09-27-0124-project-owned-store/`. The call-surface decisions here
> (no `store` argument, staged file references, the required `--out`,
> `--fixture`, the backup verbs) still stand.

## Scope

This is the last v2.0.0 milestone before the tag. It builds the roadmap's
"Planned / Later" annotation store, following `standards/anno/store-ownership.md`.

- The broker owns ONE annotation SQLite DB for the machine, under the broker
  home.
- Every row carries a `project_id`. The broker binds it from the request into
  every read and write.
- The calling script creates the id on first write in
  `<project>/.c64-re-tools/project.json` and reads it after that.

Today every `anno` call names a client-local `.annostore` file and opens it
in-process, which breaks the v2 rule that the broker owns machine state. After
this milestone the client never opens SQLite, and the `store` argument is gone
from all 28 `anno call` tools and all 6 report verbs.

## Decisions

- **Everything runs broker-side (owner).** This covers the 28 tools and the 6
  report verbs (render-memmap, coverage, export-asm, evid-disagreements,
  decomp-completeness, hazard-report).
  - The client confines paths, uploads input bytes and sends the project id with
    an args handle.
  - It downloads result files by handle and writes them where `--out` says.
  - No client-side module imports `anno-store` or `node:sqlite`.
- **`project.json` stays gitignored (owner).** A fresh clone or new worktree is
  a new, empty project. Data moves with `export-project` / `import-project`.
- **The snapshot ring is dropped (owner).** No tool exposed revert.
  - Deleted: `vacuum into`, the 32-revision ring, `revertTo`, `anno_snapshot`,
    and the prune/reconcile/stage code.
  - Backup is `export-project`. Per-project CAS on `base_revision` stays.
- **Ships inside the unreleased 2.0.0 (owner).** The handshake magic does not
  change. An older dev broker answers `unknown op: anno_run`, and the client
  turns that into "restart the broker from this checkout".
- **Schema v6, strict equality, no migration.**
  - `anno_meta(id=1, schema_version)` stays one row for the whole DB.
  - New table `anno_project(project_id primary key, revision)`.
  - Every other table gets `project_id text not null`, and every UNIQUE and
    every index leads with it.
- **The handle is `{db, projectId}`, bound when it is created.** Store
  functions take no project argument, so no caller can widen or override the
  scope.
- **One worker thread owns the only `DatabaseSync`.** This keeps a large import
  or report off the broker's event loop, and it serialises every writer on the
  machine.
- **Arguments always travel as a staged `args.json`.** Client files are staged
  beside it on the `host_tool_stage` and transfer route. The `anno_run` line
  carries only handles, so the 64 KiB input-line cap never applies.
- **Only a write verb creates `project.json`.**
  - The order is: dial and hello, mint the id, register it with the broker,
    persist the file, then run the call.
  - A read with no `project.json` refuses and creates nothing.
  - An id the broker does not know gets `unknown_project`, never a silent new
    project.
  - A malformed file is refused by name, never regenerated.
- **Report outputs:**
  - `--out` is required on render-memmap and export-asm.
  - `render-memmap --check` compares the bytes on the client.
  - The banner names the `project_id` instead of a store path.
- **No migration verb.** No production path ever created a store.
- **Fixtures:** the export document goes to v2. It adds `excludedRanges` and
  drops `store`. The fixture file names stay the same.

### Decided during implementation

- **Scoping is enforced at prepare time (step 1).**
  - Every project-table statement goes through `scopeOf(handle)`. It binds the
    handle's id as the named parameter `$pid`, and it refuses any SQL that does
    not name `$pid`.
  - The refusal is needed because SQLite binds an unsupplied named parameter as
    NULL without complaint (measured on Node 24). An unscoped read would quietly
    return nothing, and an unscoped write would insert rows that no project
    owns.
  - `anno_meta` and `anno_project` are the only tables reached through the raw
    connection.
- **The handle keeps the raw `db`.** It is used for the two unscoped tables
  and for the tests that plant corruption. In step 4 the handle stops leaving
  the broker, so no client ever holds it.
- **The revision is read inside `begin immediate`.** The old "revision moved
  under us" refusal (a failed compare-and-swap) cannot happen any more, so it
  is gone. A stale `base_revision` keeps its exact refusal text.
- **Step-1 shim:** `openStore(path)` binds `FILE_STORE_PROJECT_ID` (a fixed
  UUID), so every existing caller keeps working until the cutover.
- **Export document v2:** `scopes` and `excludedRanges` are required, and
  `store` is gone. A v1 document is refused by version, as any unknown
  version is.
- **Tests:**
  - The ring and revert tests are deleted: about 30 cases, plus the orphan-file
    durability case.
  - The SIGKILL proof now pairs the row with the project's revision.
  - New `anno-project-scope.test.ts`: a pragma-driven structure check, an
    isolation check and a generic round trip, each with a planted proof.

- **Staged file references (step 2a).**
  - A file argument reaches the engine as `{ "$file": "<slot>" }`, and the
    bytes travel in a slot map beside the call. Each slot carries the client's
    name for the file.
  - That name is echoed as `image` and `transferPath`, and it drives the
    extension-first image dispatch.
  - `clientFileKeys(name)` reads the `clientFile: true` markers off the
    definitions.
- **An unreadable file refuses the whole call, a batch included.** Its bytes
  travel with the call, so a missing file means the call cannot be sent. Before
  this change a missing inner image failed only its own batch entry.
- **The client deletes a consumed Ghidra transfer file.** It does so only after
  the engine's answer shows that import succeeded, and it walks the batch
  results to find nested imports.
  - It then records `transferDeleted` (and `transferDeleteError` when the
    delete fails) on that answer.
  - `importGhidraExport` now takes `{exportName, exportBytes}` and touches no
    file.
- **Engine answers carry no `store`.** The broker's database path must never
  cross the socket, and a client-side prepend could not reach nested batch
  answers.
  - `anno_evid_disagreements` keeps `disagreements` as its first key.
- **Step 2a scaffolding:** until the cutover, the client still takes `store`,
  opens it through the shim, and strips the argument before calling the engine.

- **Report engine (step 2b).** `anno-reports.mts` answers all six report verbs
  through `runAnnoReportOnHandle(handle, name, args, inputs)`, which returns
  `{json, files}`.
  - `anno-cli.ts` confines the paths and reads the inputs. It stages each
    input under the argument key the report expects (`image`, `sidecar`,
    `ledger`, `disagreements`, `fixture_image`), then writes or prints the
    answer. It reaches the store only through `runReport()`, the one call the
    cutover makes remote.
  - An `AnnoReportRefusal` is printed verbatim. Any other error is printed
    after the verb, so every existing refusal line is unchanged.
- **The labels the reports print are the client's.** The client sends the
  render banner's locations, export-asm's store name and decomp-completeness's
  store label as arguments.
- **decomp-completeness splits at the manifest.** The client parses the
  manifest, matches the store's stem, and stages the fixture image from
  `fixtures/<entry.path>` when it exists. The engine validates the
  disagreement document and the run identity and computes the measures. The
  one visible effect: when both inputs are bad, the manifest refusal now comes
  first.
- **The path-based library functions stay as thin wrappers** over the new
  cores, because `acme-verify.ts` and many tests call them:
  `renderMemoryMap` over `renderMemoryMapFrom`, `exportAsm`/`exportAsmTree`
  over `exportAsmFrom` + `planExportAsmTree` + `writeExportAsmTree`, and
  `buildCoverageReport({project})`. They move client-side at the cutover.
  - The export-asm ledger text is a thunk. A store with no ranges is then
    still refused before a named ledger is read, as it was before.

- **The engine is host-bound (step 2c).** `anno-tools`, `anno-reports` and
  their whole import closure -- 32 modules, all self-contained, types included
  -- are renamed to `.mts` and compiled into `resources/`. That brings
  `HOST_BOUND_ARTIFACTS` to 54.
  - The rename rewrote 1183 references in 174 files. Past specs were left
    alone as history.
  - `build()` now puts its banner after a leading shebang, because the
    engine sources start with `#!/usr/bin/env node` and the banner was
    landing above it.
  - `HOST_BOUND_DATA_FILES` now carries a source path per file, so
    `memmap.json` (from `skills/c64-memory-mapping/`) and `anno-regbits.json`
    sit beside the compiled engine, where memmap-lookup and anno-enum-gen look
    first. The packed smoke test reads 959 memmap entries from the package.

- **One op for every annotation call (step 3).** `anno_run` carries `kind`:
  `register`, `tool` or `report`. Registration is its own kind, so the client
  can register a project, persist `project.json`, and only then write.
  - The backup verbs in step 5 go through the same op, so no separate
    `anno_export`/`anno_import` kinds were added. `ControlRequestKind` is now
    14 members.
- **Staging reuses `host_tool_stage`.**
  - Tree 0 is `args.json`, and each input file gets a tree of its own, so two
    inputs with the same basename never collide.
  - `anno_run` presents the connection's bound request key, as
    `host_tool_run` does.
  - A staged file travels under its basename, and that basename is the
    engine's file name: an image's extension dispatch and the answer's
    `image` echo both see only the basename.
- **Report files come back as download handles**, written into the request's
  own scratch `out/` and registered with `registerHostToolResult()`. The
  client downloads them into a per-call temp directory and removes it in a
  `finally`.
- **The worker thread holds the only `DatabaseSync`.** It chains requests so
  none interleave, and `AnnoHost` starts it lazily and turns a crash into
  `internal` for every waiting request.
  - Store refusals name the database's path, so the worker writes its own
    `unknown_project` message and replaces the database path with
    `<annotation database>` in every message and tool answer it posts.
- **`unknown_project` is a `ControlErrorCode`.** `sendHostToolLineAwaitReply`
  now passes the broker's error `code` through, so the client tells "gone"
  apart from a malformed call.
- **`project.json` is created by a temp file plus `linkSync`** (create-if-absent),
  owner-only. On `EEXIST` the loser adopts the winner's id. A malformed file is
  refused and never rewritten.
- **Test note:** the socket-tee proof needs `allowHalfOpen` on both of its
  legs. A transfer client half-closes after its payload and still reads the
  broker's `transfer_complete`, so a default server socket closed that too
  early.

- **The cutover (step 4).** Every verb and every `anno call` goes through
  `anno_run`. No client module loads `anno-store` or names `node:sqlite`,
  directly or transitively. `anno-client-boundary.test.ts` proves this by
  walking each shipped client root's value imports.
  - The scan's first run found a real leak: an inline
    `import { type ConstWriteFact }` in `anno-tool-defs.mts`. Once types are
    stripped that becomes `import {} from`, which still loads
    `anno-import.mts` and, through it, the store. It is now `import type`,
    and the scan treats inline type imports as value imports.
- **`openStore(path)` stays, as an engine and test utility, not a shim to
  delete.** It is how tests build a database file and how the path wrappers
  (`exportAsm`, `renderMemoryMap`) that `acme-verify.ts` and the engine tests
  call open one. No client module reaches it. The in-process test broker
  serves such a file as a workspace's project under `FILE_STORE_PROJECT_ID`,
  so a test can populate the project with `openStore` and inspect what the
  verbs wrote.
- **decomp-completeness takes `--fixture NAME`**, the fixture's manifest path
  (or its bare stem). The earlier plan said `--export <fixture>.annostore.json`.
  But the project already holds the fixture's annotations, so the only thing
  the verb needs is which manifest entry, and therefore which image, it is
  answering for. The routine-queue-walker gate script forwards `--fixture`
  unchanged.
- **The report answers name the project.** evid-disagreements `--json` and
  decomp-completeness carry `project` (the id), and the rendered reports head
  with it. Tool answers carry no `project` echo, because the caller already
  knows which workspace it called from.
- **coverage restores the caller's image path client-side.** The broker only
  sees the staged basename, so the client sets `report.project.path` to the
  confined path it read. The report reads the same as before the cutover.
- **The render banner no longer names a store.** It records only the
  sidecar's workspace-relative location, so a relocated checkout still
  renders the same bytes, and nothing machine-specific (such as a project id)
  enters a committed file.
- **A render sidecar's parse failure names its workspace-relative
  location**, the only name the broker ever learns, never the client's
  absolute path.
- **`--out` is required on render-memmap and export-asm.** The old defaults
  (beside the store) have no anchor any more. The path-consumer inventory
  dropped from 17 arguments to 11, and its seam count now credits
  `anno-cli.ts`'s one `confine()` wrapper, with a check that the wrapper
  really calls the predicate.
- **Tests that spawn the real CLI use a harness broker.** A helper,
  `seedBrokerProject(home, workspace, seed)` in the test-only
  `inproc-anno-broker.ts`, seeds a project straight into that broker's database.
  The decomp-closure fixtures and the gate's planted control 2 use it.
  `anno call` write-then-read and the smoke cases start from an empty
  workspace, and their first write registers the project. Step 5's `import-project` is the
  user-facing route for the same thing.
  - The helper is named `inproc-anno-broker.ts`, not `anno-test-broker.ts`.
    `anno-seam.test.ts` derives the shipped set from every `anno-*` module
    on disk, so an `anno-` prefix would have demanded that a test helper
    ship.

- **The backup verbs are two more reports (step 5).** `export-project` and
  `import-project` go through the same `anno_run` report kind, so no new op
  was added. `import-project` asks for the project in write mode: in a
  workspace with no project it registers one first, as any write does.
  That project stays, empty, if the import is then refused.
- **An import is one transaction.** The store gained `applyAtomically(handle,
  body)`. Every write on that handle inside `body` joins one
  `begin immediate` and commits together, or everything rolls back.
  `commitTransaction` is still the single commit site.
  `importStoreDocument` now always applies its plan this way, so a document
  that passes validation but that the store refuses part-way leaves the
  project exactly as it was. A test with a mutation proof covers this: a
  clashing label name after a range and a first label.
- **Import fills an empty project only.** A project holding any row is
  refused. The refusal names the counts it holds and the remedy (export,
  delete `project.json`, import into the new project). Merging two sets of
  annotations is a decision about which is right, and the verb does not make
  it.
- **The export document is the fixture format** (`JSON.stringify(doc, null,
  2)` plus a newline), so an exported project can be committed as a fixture.
  Exporting, importing elsewhere and exporting again gives identical bytes.
  The smoke test checks this against the real bin.
- **A non-JSON import document is refused by byte offset only.**
  `jsonParsePosition` is now exported from `anno-memmap-render.mts` and
  reused, so no byte of the file reaches the message.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:**
  - One machine-level broker owns machine state.
  - Files travel as bytes, and no path crosses the socket.
  - Refusals happen at the point of use, never through a doctor command, and
    nothing is auto-started.

## Standards Applied

- **anno/store-ownership:** the design this milestone builds. The "not yet
  implemented" note is removed at close.
- **anno/sqlite-rules:** `anno-store` stays the only `node:sqlite` importer. The
  `vacuum into` exception goes away with the ring.
- **anno/store-validators:** the engine refuses a plain string for any
  `clientFile` key.
- **anno/workspace-confinement:** stays client-side. The broker only ever sees
  staged basenames.
- **broker/host-bound-modules:** the engine and the report cores move to `.mts`
  and into `resources/`.
- **global/files-travel-as-bytes:** inputs are uploaded, and results come back by
  handle.
- **global/injectable-deps:** `runRemote` and a `dir` override keep tests off the
  real broker home.
- **global/atomic-state-files:** `project.json` is created with mode 0600, as a
  temp file linked into place.
- **global/module-header:** every new module gets the short header.
- **skills/refuse-never-guess:** never guess a project id, and never create one
  on a read.
