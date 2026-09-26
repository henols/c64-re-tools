# v2.0.0 broker-owned store: one annotation DB per machine

## Context

v2.0.0 "One Broker, One Socket" closed with all four steps done. It is still
untagged: v1.1.0 is the latest tag, 311 commits behind HEAD. The roadmap's only
planned feature is the broker-owned annotation store
(`agent-os/product/roadmap.md` "Planned / Later",
`agent-os/standards/anno/store-ownership.md`, which is marked "Target design, not
yet implemented").

**What happens today:**
- Every `anno` call names a client-local `.annostore` SQLite file.
- The client opens that file in-process through `anno-store.ts`.
- Every write snapshots the whole file.

This breaks the v2 rule that the broker owns machine state and the client never
opens it.

**Outcome:**
- The broker owns one SQLite DB under the broker home.
- Every row carries a `project_id`, which the broker binds from the request.
  The client never touches SQLite, not even for reports.
- The `store` argument disappears from all 28 `anno call` tools and all 6 report
  verbs.

**This ships inside the unreleased 2.0.0.** The handshake magic does not change.
An older dev broker answers `unknown op: anno_run`, and the client turns that into
"restart the broker from this checkout".

## Owner decisions (settled)

- **Everything runs broker-side.** The 28 tools and the 6 report verbs
  (render-memmap, coverage, export-asm, evid-disagreements, decomp-completeness,
  hazard-report) all run in the broker.
  - The client confines paths, uploads input bytes, sends
    `{project_id, name, args-handle}`, then downloads result files by handle and
    writes them where `--out` says.
  - No client-side module imports `anno-store` or `node:sqlite`.
- **`project.json` stays gitignored.** A fresh clone or a new worktree gets a
  new, empty project. Data moves with `export-project` / `import-project`.
- **The snapshot ring is dropped.** This removes `vacuum into`, the 32-revision
  ring, `revertTo`, `anno_snapshot` and the prune/reconcile/stage code. The
  backup route is `export-project`. Per-project CAS on `base_revision` stays.
- **The milestone ships in 2.0.0.**

## Design decisions (mine, following the standing "you decide")

- **Schema v6, strict equality, no migration.**
  - `anno_meta(id=1, schema_version)` stays one row for the whole DB.
  - A new table `anno_project(project_id text primary key, revision integer not null)`.
  - Every other table gets `project_id text not null`, leads every UNIQUE with
    it, and gets an index that starts with `project_id`.
- **The store handle is `{db, projectId}`, bound when it is created.** Store
  functions take no project argument, so no caller can widen or override the
  scope. `runWriteSequence` becomes:
  1. `begin immediate`
  2. read this project's revision
  3. check it against `base_revision`
  4. run the mutation
  5. add 1 to the revision
  6. `commit`
- **The engine runs in one worker thread** (`node:worker_threads`). The worker
  holds the only `DatabaseSync`. Because `DatabaseSync` is synchronous, running it
  on the broker's main thread would block relay and transfer traffic. One
  connection also serialises every writer on the machine. If the worker dies, the
  request is refused by name and the worker restarts on the next request.
- **Arguments always travel as a staged `args.json`, with no inline form.**
  - Each client file argument (`image`, `export_path`, report inputs) is staged
    too. This reuses `host_tool_stage` and the transfer connections.
  - Input lines to the broker are capped at 64 KiB (`broker-control.mts:577`), so
    the `anno_run` line carries only handles.
  - Tool definitions mark their file keys `clientFile: true`. The engine refuses
    a plain string for any such key.
- **`project.json` is handled by a new client module, `anno-project.ts`.**
  - The path is `join(toolsDirUnder(repoRoot()), "project.json")`. It adds no
    new literal, so the `repo-root.test.ts` census stays unchanged.
  - It is created atomically with mode 0600: write a temp file, then
    `linkSync`. On EEXIST, re-read the winner's id.
  - A malformed file or an id that is not a UUID is refused by name. It is never
    regenerated.
  - **Only a write verb creates it.** The order is: dial and hello, mint the id,
    call `anno_run(create:true)` to register it, persist the file, then run the
    call.
  - A read with no `project.json` refuses and creates nothing.
  - An id the broker does not know gets the new `ControlErrorCode`
    `unknown_project`. The remedy names `import-project`, or deleting
    `project.json`.
- **Report outputs:**
  - The broker returns result files by handle: one file for render-memmap, a
    manifest plus files for export-asm. The client writes them at `--out`.
  - `--out` is required on render-memmap and export-asm. The old default of
    writing beside the store goes away.
  - `render-memmap --check` downloads a fresh render and compares the bytes on
    the client.
  - The banner records the `project_id` instead of a store path.
  - decomp-completeness keys its manifest on `--export <fixture>.annostore.json`.
- **Echoes:** tool answers no longer echo `store`. The client adds `project`,
  plus the caller's own `image` string.
- **Migration: none.** No production path ever created a store.
  `c64-program-recon/SKILL.md:184` claims the first write creates one, but
  `anno-tools.ts:2139` refuses; this milestone fixes that mismatch.
- **Fixtures:** the export document goes to v2. It adds `excludedRanges` and
  drops `store`. The 12 `*.annostore.json` files are rewritten mechanically and
  keep their names.
- **Tests:**
  - Transport tests spawn a broker through `startHarnessBroker`
    (`broker-harness.ts`), which uses a dynamic port and a temp
    `VICE_BROKER_HOME`.
  - All other tests run the broker-side handler in-process over a temp DB, via
    an injected `runRemote`. That handler is the real transport leaf, not a stub.

## Steps (each committable, in order)

### Task 0: save the spec
Create `agent-os/specs/2026-09-26-2233-broker-owned-store/` with `shape.md`,
`plan.md`, `standards.md` and `references.md`, in the same shape as
`2026-09-26-1019-no-cross-side-paths/`. `shape.md` gets a
`### Decided during implementation` section. Add an "In progress" block to the
roadmap.

### Step 1: schema v6, project-scoped, no snapshot ring (in-process)

**Files:**
- `anno-store.ts`: DDL at :270, `openStore` at :476, `runWriteSequence` at
  :1553; delete the ring code (:653-1388 region) and `revertTo` at :2502.
- `anno-types.ts:338`: `SCHEMA_VERSION = 6`.
- `anno-store-export.ts`: export document v2.
- `fixtures/**/*.annostore.json`
- Tool texts that mention the "32-deep snapshot ring": `anno-tools.ts:612,640`
  and `anno-register.ts:155,238`.
- A temporary shim, `openStore(path)`, which serves one project under a fixed
  id. Step 4 deletes it.

**Tests:**
- New `anno-project-scope.test.ts`, driven by pragma queries:
  - every scoped table has `project_id NOT NULL`;
  - column 0 of every unique index is `project_id`.
  - Planted-violation proof: the same check must fail on a DB built from mutated
    DDL.
- Isolation between two projects:
  - the same label name, comment key and enum name do not collide;
  - every `list*` returns only the caller's own rows;
  - CAS on one project leaves the other untouched.
- The export document round-trips losslessly. The check compares every table in
  `sqlite_schema` generically. Planted proof: omitting one table must fail.
- Adapt the SIGKILL test in `anno-durability.test.ts`. Delete the ring tests.

### Step 2: host-bound, path-free engine and report core

**Files:**
- Rename the import closure to `.mts`: the store closure, the `anno-tools`
  engine, and the report cores (`anno-memmap-render`, `anno-export-asm`,
  `anno-coverage`, `anno-hazard-report`, provenance-ledger, store-export). `build()`
  accepts only `.mjs` output (`build.ts:233-253`).
- Drop `repo-root` from the closure. Update `tsconfig.build.json` `include` and
  `HOST_BOUND_ARTIFACTS` (`build.ts:47`). Add data files (`memmap.json`,
  `anno-regbits.json`) to `HOST_BOUND_DATA_FILES`. Update `package.json` `files`.

**Split:**
- **Engine** (broker-side): `runAnnoTool(handle, name, args, inputs)` and
  `runAnnoReport(handle, name, args, inputs) → {json, files[]}`. The engine does
  no fs reads, no unlinks and no repo-root lookups. Today's only fs touch points
  are `anno-tools.ts:2689-2696` and `anno-import.ts:391,415`; they become
  byte inputs.
- **Client** (new `anno-call-client.ts`): confines paths, reads bytes, deletes a
  consumed `export_path` after success, writes the `--out` files, and adds the
  echoes.
- The path handling in `anno-cli.ts` stays on the client side. The computation
  moves into the engine.

**Build:** run `node build.ts` and commit `resources/`.

**Tests:**
- The existing resources-sync and build-set checks.
- New data-driven tests over `ANNO_TOOL_DEFINITIONS`:
  - no definition has a `store` property;
  - the engine refuses a string for every `clientFile` key (planted proof: a
    synthetic definition);
  - no engine answer carries a `store` key.

### Step 3: broker anno seam (the CLI is not switched yet)

**Files:**
- `broker-home.mts`: `brokerAnnoDir()`.
- New host-bound modules `anno-worker.mts` and `anno-host.mts`.
- `broker-control.mts`:
  - kinds `anno_run` (tools and reports, with a `create` flag) and
    `anno_export`/`anno_import`;
  - `unknown_project`;
  - reply variants;
  - `onAnno*` callbacks.
- `vice-broker.mts`: wiring near :2281. Reuse `stageHostToolRequest`,
  `resolveStagedFile` and `registerHostToolResult` (:1220-1343).
- `broker-endpoint.mts`: `ANNO_TAG` and `dialAnnoSession()` on top of
  `dialKeptSocket`.
- Client: new `anno-remote.ts` and `anno-project.ts`.

**Tests:**
- Raise the op-kind pins in `broker-control.test.ts` (:1830, :2315, :2617, :3049)
  and classify the new kinds.
- New harness e2e file:
  - the first write registers the project;
  - a read before any write refuses;
  - two projects stay isolated over the wire;
  - `unknown_project`;
  - disassemble reads a staged image;
  - arguments over 64 KiB succeed;
  - of two parallel writers with a stale `base_revision`, one is refused;
  - a report's result files come back by handle.
- Socket tee: a unique marker in the temp project path never appears in any byte
  the client sends. Planted proof: a variant that puts the path in `args` must
  fail.

### Step 4: cutover

**Files:**
- `anno-cli.ts`: every verb goes through `anno-remote`. `--out` is required and
  `--export` is added.
- `anno-tools.ts`: delete `assertStorePresent` and the inode guard.
- Delete the step-1 shim.
- Update the 4 SKILL.md files (c64-program-recon, c64-provenance-diff,
  acme-build, routine-queue-walker) and `memory-map.template.md`.
- `skills/routine-queue-walker/scripts/completeness-report.ts:536-571`.

**Tests:**
- Move the anno-cli tests to the injected `runRemote`, plus about 4 CLI smoke
  cases against the harness broker.
- A data-driven check that no verb accepts `--store` or a store positional
  (planted proof).
- A structural test: no module outside `HOST_BOUND_ARTIFACTS` value-imports
  `anno-store` or names `node:sqlite`. Planted proof: a synthetic client file.
  This also restores the `node:sqlite` confinement scan that Phase 56 dropped
  (`anno-seam.test.ts:1-5`).
- Refusal cases:
  - no broker answering, and `project.json` is not created;
  - an old broker (`unknown op`);
  - a malformed `project.json`.

### Step 5: backup verbs and close

- Add `anno export-project --out FILE` and `anno import-project FILE`. Import is
  allowed into an empty or new project only; a non-empty target is refused.
- Rewrite these docs:
  - `store-ownership.md`: drop "not yet implemented".
  - `sqlite-rules.md`: the ring's `exec` exception is gone.
  - `workspace-confinement.md`.
  - `tech-stack.md`: the store section.
  - `mission.md:39`.
- Close the milestone: move it to Implemented on the roadmap and record the
  implementation decisions in `shape.md`.

## Verification

- **Each step:** run `npm test > file 2>&1; echo $?` on the same line, never
  piped. Compare the failing **set** against the pre-step baseline; the floor is
  zero.
- **`node --test` on a single file:** run `ls` on the file first, because a
  typo'd name still exits 0.
- **After step 2:** `node build.ts` succeeds and resources-sync is green.
- **After steps 3 and 4:** a live check.
  1. Start the broker by hand from this checkout with a temp `VICE_BROKER_HOME`.
  2. In a scratch project, run `anno call anno_set_label_name` to confirm it
     creates `project.json`.
  3. Run `get_symbols`, `render-memmap --out`, and `export-asm --out`.
  4. Run the same flow from a second scratch project and confirm the two are
     isolated.
  5. Stop the broker afterwards and confirm no child processes are left.
- **Opt-in live suites** (real `/usr/bin/x64sc`): run each alone under a timeout
  after step 4, because the broker binary changed.
