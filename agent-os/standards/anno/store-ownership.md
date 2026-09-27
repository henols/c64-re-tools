# Store Ownership

A project's annotations are an artifact of that project. They live in ONE
SQLite file per project, committed with everything else under the
project's tool folder:

```
<project>/.c64-re-tools/annotations.db   (annoDbPath() in anno-workspace-store.ts)
```

- The client opens it in-process for one call and closes it
  (`workspaceStoreRunner()`). The broker owns machine state only
  (emulators, host tools, transfers) and never loads the store.
  `anno-broker-boundary.test.ts` enforces this.
- The file holds exactly ONE project. Its id is the one row in
  `anno_project` (`soleProjectStore()`). A file holding more than one
  project is refused, never picked from. There is no project.json: the
  file identifies itself.
- Only a write creates the file and its project, and the check-and-insert
  runs under `begin immediate`, so two racing first writes agree. A read
  with no file is refused by name and creates nothing.
- No call takes a store path. The path derives from the workspace root and
  is confined like any other path.
- Every project table still has a `project_id` column, bound through
  `scopeOf(handle)`. In a one-project file this costs nothing and keeps
  every statement scoped.
- The file is binary in git. `anno export-project` writes a text copy (the
  fixtures' format) that diffs and reviews; `anno import-project` fills an
  empty project from one, in one transaction, and never merges.
- `anno-store.mts` is the only `node:sqlite` importer.
- The file sits at the ROOT of `.c64-re-tools/`, the folder for committed
  project artifacts. Everything machine-specific or regenerable goes in
  `.c64-re-tools/local/`, which `ensureLocalDir()` (project-local.mts)
  creates with a `.gitignore` of `*`, so a project commits `.c64-re-tools/`
  wholesale.
