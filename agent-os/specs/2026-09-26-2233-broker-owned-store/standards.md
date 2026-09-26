# Standards for Broker-Owned Store

The following standards apply to this work.

---

## anno/store-ownership

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
- `anno-store.ts` stays the only `node:sqlite` importer and becomes
  host-bound (see broker/host-bound-modules.md).

---

## anno/sqlite-rules

Only `anno-store.ts` imports `node:sqlite`. Everything else calls its
functions.

```ts
db.prepare("insert into anno_range(start, end_inclusive, data_type, bank) values (?, ?, ?, ?)")
  .run(start, endInclusive, dataType, bank);
```

- Bound parameters via `prepare().run()`. Never interpolate into
  `exec()`. (Sole exception: `vacuum into '<path>'`, validated and
  quote-doubled at its one site.)
- Single quotes for SQL literals. Double quotes throw `no such column`.
- Never load an extension, and never enable the constructor option.
- Never set `journal_mode` or `synchronous`. They persist in the file,
  and the default `delete` mode is the decision.
- No FTS5 table. Indexed `LIKE 'prefix%'` is faster, and removing FTS5
  later would be a migration.
- No save/flush verb. Every accepted write commits before it returns.
- Never cache a derived index/xref on disk. Recompute from the rows.
- Schema version check is strict equality, with no migration.

---

## anno/store-validators

The MCP proxy validates nothing. Every store argument goes through an
`assertX()`/`parseStoreX()` in `anno-types.ts` before it reaches SQL.

```ts
parseStoreAddress(4096)     // ok
parseStoreAddress("$1000")  // ok
parseStoreAddress("0x1000") // ok
parseStoreAddress("1024")   // throws: bare decimal refused
```

- Validators throw a named `ViceError` that includes the offending
  value and the valid form. They never return a default, because a
  default gets written into the store.
- Refuse illegal label names. Never trim, substitute or quote them:
  `init screen` -> `init_screen` silently merges two names.
- A legal name already bound elsewhere is refused, never rebound.
- Never reuse stock `parseAddress()`. It accepts bare decimal and
  depends on the installed symbol table. A mis-based store address
  persists for every later reader.
- No zod (it is only an undeclared transitive of @mastra).

---

## anno/workspace-confinement

Every caller-supplied file path (image, `--out`, `--provenance`,
sidecars, ...) goes through the one seam before any fs call. The store
DB is not a caller path. See store-ownership.md.

```ts
const out = storePathWithinWorkspace(args.out, workspaceRoot); // throws if outside
writeFileSync(out, text);
```

- Never write a second path validator. The seam follows symlinks; a
  string-prefix check lets a symlinked subdir escape.
- Inputs and outputs both count. A raw `--out` once overwrote a file
  outside the workspace.
- Never auto-pick an input or derive one path from another. Require
  each by name, and refuse if it is missing.
- Never import the host/container path-translation seams into the store.
  A host path would land writes outside the workspace.
- Don't echo file content in parse errors. That turns a refusal into
  a read oracle.

---

## broker/host-bound-modules

The broker runs on the host from compiled `resources/*.mjs`. A module
is host-bound only if it is listed in BOTH `tsconfig.build.json`
`include` AND `build.ts` `HOST_BOUND_ARTIFACTS`. (`.mts` alone does not
mean host-bound.)

```ts
import { brokerIncidentsDir } from "./broker-home.mjs";   // .mjs specifier
import type { BrokerState } from "./broker-state.mjs";   // type-only: loads unbuilt
```

- Import siblings with `.mjs` specifiers. Use `import type` when the
  module must also load unbuilt (from tests), and inject functions via
  Deps instead of value-importing them.
- Never value-import a container-side `.ts` (e.g. repo-root.ts,
  incident-record.ts). Mirror the constant or shape instead, and pin the
  agreement with a sync test.
- Run `node build.ts` after editing. Commit the regenerated `.mjs`.
  `resources-sync.test.ts` reds on drift.
- A new host-bound module goes in both lists. build() fails on any
  mismatch.
- Entry artifacts (`build.ts` `ENTRY_ARTIFACTS`, `tsconfig.entry.json`)
  are compiled too, but emitted beside their `.mts` source and never
  host-bound: the package bin `vice-cli`, which runs from `node_modules`.
  `entry-sync.test.ts` reds on drift.

---

## global/files-travel-as-bytes

A tool or skill script that works on a file the project owns (a program, disk
image, snapshot, source tree, analysis result) takes a path on the client
side. The client reads the file and streams its bytes to the broker. A path
never crosses the socket in either direction.

```ts
const localPath = resolve(path);                                  // client-side path
const staged = await brokerControl.stageFile({ targetId, slot }); // broker mints a handle
await transferFile({ direction: "upload", handle: staged.handle, sourcePath: localPath });
```

- Stage the file (`stageFile` + `transferFile`), then pass the broker-minted
  name verbatim to the VICE command that already does the job
  (`vice_autostart`, `vice_disk_attach`, `vice_snapshot_load`, and
  `vice_program_load` through the text monitor's own `load`), or to the host
  tool.
- Prefer the capability VICE already implements over re-creating it on the
  client.
- Results come back the same way: download by handle into the project's
  `.c64-re-tools/<kind>/`.
- Never send a client path to the broker or the emulator, and never read a
  path the broker names. The broker's own state (epoch files, staging,
  Ghidra projects) is reached only through a reply on the socket.
- Never replace a path argument with a fixed list of known files. The caller
  names the file.

---

## global/injectable-deps

A module that touches processes, sockets, clocks or the filesystem
takes an optional `XDeps` object. Each field defaults to the real one:

```ts
export interface VerifiedKillDeps {
  isAlive?: (pid: number) => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  sleepMs?: (ms: number) => Promise<void>;
}

const isAlive = deps.isAlive ?? defaultIsAlive;
const kill = deps.kill ?? defaultKill;
```

- Production call sites pass no deps.
- Tests inject fakes for the side-effecting leaves only. Never stub the
  function under test or the seam that wires it.
- Paths get an explicit `dir` override so tests never write the real
  machine-level root.

---

## global/atomic-state-files

Write state/record files atomically, owner-only:

```ts
const tmp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
writeFileSync(tmp, "");
chmodSync(tmp, 0o600);        // tighten BEFORE content lands
writeFileSync(tmp, content);
renameSync(tmp, path);
```

- Readers see no file or a complete file, never a partial one.
- mkdir with `{ recursive: true }` only. Never check-then-create, because
  concurrent brokers race on it.
- Read host-written files back as untrusted: parse in try/catch,
  validate every field's type, ignore unknown fields, and never open a
  path taken from the content.
- An absent file is a normal state. Return `{ present: false, reason }`
  and don't throw.

---

## global/module-header

Every non-test module opens with this header:

```ts
#!/usr/bin/env node
// stock-address.ts
//
// WHY THIS FILE EXISTS: the one address parser for stock handlers, so
// no family module re-derives decimal/$hex/0x parsing or range checks.
//
// WHAT NOT TO DO:
//   - Never re-derive an address regex in a family module.
//   - Never treat a bare decimal string as hex here.
```

- Keep it short: the file's one job, then the concrete mistakes it prevents.
- No history, no plan/decision/review ids (D-07, WR-06, 64-12).
  Those go in git.

## Import cycles

- Shared types and helpers go in a leaf module that both sides import
  (e.g. stock-handler.ts). Never import the dispatcher back.
- Types-only back-edges use `import type`, which erases at compile time.
- Inside a known runtime cycle, export `function` declarations, never
  `const` arrows. A const in the cycle throws ReferenceError at load.

---

## skills/refuse-never-guess

When a required fact or input is missing or ambiguous, refuse and name
why. Never substitute a fallback.

```json
{ "ok": false, "message": "no literal SYS address in line 10 (SYS PEEK(43)+...)" }
```

- Never auto-pick an input file. Require it by name.
- Never guess an entry point, handover address or offset. A wrong value
  is spent downstream (disassembly, diffs) and is expensive to find.
- Pass the tool's decline reason through verbatim.
- "I don't know" is a valid, reportable result. A plausible default
  is not.
