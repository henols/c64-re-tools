# Broker-Owned Store — Shaping Notes

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

- **Report engine (step 2b).** `anno-reports.ts` answers all six report verbs
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
