# Standards for Project-Owned Store

The following standards apply to this work. Each is rewritten or confirmed
in step 3.

---

## anno/store-ownership

Rewritten by this milestone. The annotation database is a project artifact at
`<project>/.c64-re-tools/annotations.db`, one project per file, opened
in-process by the client and committed with the project. The broker holds
none.

---

## anno/sqlite-rules

Unchanged in substance. `anno-store.mts` is the only `node:sqlite` importer.
Every statement on a project table binds `$pid` through `scopeOf(handle)`.
The schema version check is strict equality, with no migration.

---

## anno/workspace-confinement

Every caller-supplied path goes through the one seam. The database path is
derived from the workspace root and never taken from a caller.

---

## global/injectable-deps

The runner (`runAnno`) is injected, and tests pass a database path instead
of the workspace default.
