# Store Ownership

> Target design, not yet implemented. Code today uses one store file
> per project. New store work moves toward this.

The broker owns ONE annotation DB for the machine, under the broker
home (broker-home.mts). No store file lives in a project, and clients
never open the DB.

Every anno call carries the project reference. The calling script
creates it on first use and reads it after that:

```json
// <project>/.c64-re-tools/project.json
{ "project_id": "3f0c9a4e-..." }   // randomUUID()
```

- Every table has a `project_id` column. The broker binds it from the
  request into every read and write.
- A caller can never omit, override or widen it. There is no
  cross-project query.
- Never derive the id from a path or git remote. A persisted UUID
  survives moves and never collides.
- A missing project.json creates a new id, which means a new, empty
  project. Never guess an existing one.
- `anno-store.mts` stays the only `node:sqlite` importer and becomes
  host-bound (see broker/host-bound-modules.md).
