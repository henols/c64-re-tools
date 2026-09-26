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
