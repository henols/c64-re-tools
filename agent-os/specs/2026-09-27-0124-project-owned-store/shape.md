# Project-Owned Store — Shaping Notes

## Scope

This replaces the broker-owned store (`2026-09-26-2233-broker-owned-store/`)
on the day it closed, before any release shipped it.

The owner's call (2026-09-27): **the annotation database is an artifact of
the analysed project**, checked in with everything else under the project's
`.c64-re-tools/` folder. It is not machine state, so the broker does not own
it.

- Each project has one SQLite file: `<project>/.c64-re-tools/annotations.db`.
- The client opens it in-process for each call, as it did before the
  broker-owned milestone.
- The broker holds no annotation database and never loads the store.

## Decisions

- **The literal SQLite file is the committed artifact, and the client owns
  it (owner).** The owner weighed two alternatives and rejected both:
  - a committed text export with the database as a working copy;
  - a committed database that the broker opens by path.
  The costs are accepted: the file is binary in git, so it has no diffs, and
  a merge conflict means picking one side.
- **`project.json` goes away.** The database identifies itself. It holds
  exactly one project, and that project's id is the one row in
  `anno_project`. Two files that could disagree became one.
  - A read with no `annotations.db` is refused by name and creates nothing.
  - The first write creates the file and its project.
  - A file that holds more than one project is refused, not guessed at.
- **Schema v6 stays unchanged.** The `project_id` column and the `$pid`
  scoping still guard every statement. In a one-project file they cost
  nothing, and removing them would be a schema change with no gain.
- **Worktrees and clones each carry their own file.** Each checkout has its
  own copy, so two worktrees never write into one project.
- **The broker seam is removed:** `anno_run`, `unknown_project`, the anno
  worker thread and host, `dialAnnoSession`, and `brokerAnnoDbPath`. The
  annotation engine leaves `HOST_BOUND_ARTIFACTS`, except for modules the
  broker reaches for other reasons.
- **The call surface keeps what the milestone gained:**
  - no `store` argument;
  - staged `{ $file }` references into a path-free engine;
  - `--out` required on render-memmap and export-asm;
  - `--fixture` on decomp-completeness;
  - the backup verbs, which now serve as text copies and fixture exports.
- **The runner stays injectable.** A call runs through
  `runAnno({mode, kind, name, args, files})`. The default opens the
  workspace's `annotations.db`, and a test passes a database path instead.
- **The structural test inverts.** No broker module (the host-bound closure)
  may reach `anno-store` or name `node:sqlite`. The planted proofs are kept.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:**
  - Reverse-engineering results version with the program they describe:
    branches, clones and review.
  - The broker owns machine state only: emulators, host tools and
    transfers.

## Standards Applied

- **anno/store-ownership:** rewritten for the project-owned store.
- **anno/sqlite-rules:** `anno-store` stays the only `node:sqlite` importer.
- **anno/workspace-confinement:** the database path derives from the
  workspace root and never from a caller argument.
- **global/injectable-deps:** the `runAnno` runner and its `dbPath` override.
- **skills/refuse-never-guess:** never create a project on a read, and never
  pick one of several projects.

### Decided during implementation

- **Steps 1 and 2 shipped as one commit (`e7d52a9f`).** The inverted
  boundary test can only pass once the broker seam is gone, and a commit
  whose own test fails was not worth splitting out.
- **The broker files were restored from their pre-seam versions.**
  `broker-control`, `broker-endpoint`, `broker-home`, `vice-broker` and their
  tests had been touched only by the seam commit (`de049ca8`), so restoring
  them from `de049ca8^` removed the seam exactly.
- **A measured closure decided which modules leave the host-bound set.**
  Starting from the host-bound modules that predate the engine, the broker
  reaches none of the 37 engine modules. All of them left
  `HOST_BOUND_ARTIFACTS`, `tsconfig.build.json` and `resources/`, and so did
  the `memmap.json` / `anno-regbits.json` data files. The client imports the
  `.mts` sources directly.
- **The runner is `runAnno({mode, kind, name, args, files})`**, with the
  default `workspaceStoreRunner()`. A report answer carries the project id,
  so the printed labels (`project <id>`) are unchanged. The one refusal code
  this adds is `no_project`, and the client turns it into the familiar
  "`<verb>` refused: this workspace has no annotation project yet".
- **`soleProjectStore()` repeats its check under `begin immediate`.** A
  process-level race test never overlapped (the mutant survived 6 runs out
  of 6), so the test is a worker thread instead. The worker holds an
  uncommitted insert, and the main thread must adopt the worker's project
  once it commits. That test fails on the mutant.
- **export-asm refuses an `--out` that is, or contains, the annotation
  store** again (T-47-14). The store is back inside the workspace, so
  `--out .c64-re-tools` would put the tree among the annotations.
- **The boundary scan follows `.mjs`-spelled imports into their `.mts`
  sources.** Host-bound modules import each other under the names the build
  emits. Without the mapping the walk silently stopped at the first hop; a
  planted `node:sqlite` import behind `broker-home` proves it now follows
  them.
- **Test support** is `workspace-store-fixture.ts` (`openTestProject`,
  `seedWorkspaceProject`) and `project-race-holder.ts`. Neither name starts
  with `anno-`, and neither ships.
