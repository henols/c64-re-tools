# Project-owned store: `<project>/.c64-re-tools/annotations.db`, committed

## Context

The broker-owned store closed on 2026-09-26/27 (commits `de049ca8`,
`00682975`, `b93adeac`). The owner then ruled that the annotation database is
a project artifact, checked in under the project's `.c64-re-tools/`, and chose
the literal SQLite file, owned by the client (see `shape.md`).

## Steps

### Task 0: save this spec
Also add an "In progress" block to the roadmap.

### Step 1: a client-owned store behind the existing runner seam
- A new client module, `anno-workspace-store.ts`:
  - `annoDbPath(root)` returns `join(toolsDirUnder(root), "annotations.db")`;
  - `workspaceStoreRunner({ workspaceRoot?, dbPath? })`, the default runner.
- It answers `{ mode, kind, name, args, files }` in-process:
  1. Read mode with no file: refuse naming the path. Write mode: create the
     directory and the database, and mint the single project.
  2. Read the staged files' bytes by slot.
  3. Run `runAnnoToolOnHandle` or `runAnnoReportOnHandle`. A report refusal
     is `refused`; any other report error is `failed`.
- `anno-call-client.ts` and `anno-cli.ts` drop `workspaceProject` and
  `project.json`, and call the runner with the mode they already compute.
- Delete `anno-project.ts` and `anno-remote.ts`, with their tests.
- `inproc-anno-broker.ts` becomes a thin test helper over the real runner
  with a `dbPath`.

### Step 2: remove the broker seam
- Delete `anno-host.mts` and `anno-worker.mts`. Remove from
  `broker-control.mts`: the `anno_run` kind and arm, `unknown_project`, and
  `onAnnoRun`. Remove `handleAnnoRun` and `annoHost` from `vice-broker.mts`,
  `ANNO_TAG`/`dialAnnoSession` from `broker-endpoint.mts`, and
  `brokerAnnoDbPath` from `broker-home.mts`.
- Remove from `HOST_BOUND_ARTIFACTS`, `tsconfig.build.json` and
  `HOST_BOUND_DATA_FILES` every module the broker's closure no longer
  reaches. Measure that closure; don't guess it. Rebuild `resources/`.
- Tests: move the op-kind and export pins back, and point the harness-broker
  tests (smoke, `call` spawns, decomp-closure, gate control 2) at the local
  store.

### Step 3: invert the boundary test, update the docs, close
- `anno-client-boundary.test.ts` becomes `anno-broker-boundary.test.ts`: no
  host-bound module reaches `anno-store` or `node:sqlite`, with the same
  planted proofs.
- Docs:
  - Rewrite the standards (store-ownership, sqlite-rules,
    workspace-confinement), plus tech-stack, mission, the roadmap, README,
    the skill docs and the CLI USAGE text.
  - Tell consumers to commit `.c64-re-tools/annotations.db`.
- Record the implementation decisions in `shape.md`.

## Verification
- After each step, run the full vice suite and the skills suite, redirected,
  reading `$?` on the same line. Compare the failing SET: the floor is zero.
- After step 2: `node build.ts` succeeds, and the opt-in broker live suites
  run alone under timeouts with nothing left running.
