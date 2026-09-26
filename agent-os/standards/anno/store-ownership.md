# Store Ownership

The broker owns ONE annotation DB for the machine, at
`<broker home>/anno/annotations.db` (`brokerAnnoDbPath()` in
broker-home.mts). No store file lives in a project, and clients never
open the DB. The broker's worker thread (anno-worker.mts) holds the only
connection and runs one call at a time.

Every anno call carries the project reference, read from:

```json
// <project>/.c64-re-tools/project.json   (gitignored, mode 0600)
{ "project_id": "3f0c9a4e-..." }   // randomUUID()
```

- Every call is one `anno_run` op: `register`, `tool` or `report`.
  Arguments and input files are staged as bytes. Result files come back
  by download handle. No path crosses the socket.
- Every project table has a `project_id` column. The broker binds it
  from the request into every read and write. A caller can never omit,
  override or widen it, and there is no cross-project query.
- Never derive the id from a path or git remote. A persisted UUID
  survives moves and never collides.
- Only a write creates project.json: it registers a new id with the
  broker FIRST, then persists it. A read with no project.json is refused
  and creates nothing. Never guess an existing id.
- An id the broker does not hold is refused as `unknown_project`. A
  malformed project.json is refused and never rewritten.
- A fresh clone or worktree starts with an empty project. Data moves
  with `anno export-project --out FILE` and `anno import-project FILE`.
  Import fills an empty project only, in one transaction, and never
  merges.
- `anno-store.mts` is the only `node:sqlite` importer, and it is
  host-bound (see broker/host-bound-modules.md). No shipped client
  module reaches it; `anno-client-boundary.test.ts` enforces this.
