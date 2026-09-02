# Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 22 (7 new source/test, 11 edits, 2 new fixtures/artifacts, 2 new docs)
**Analogs found:** 20 / 22

Every path named below was verified git-tracked with `git ls-files -- <path>` (non-empty).
No gitignored install/runtime mirror path appears in this document.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/mcp/vice/stock-reproducible-run.ts` (NEW) | service (procedure seam) | request-response over binmon wire | `src/mcp/vice/stock-run-until.ts` | exact |
| `src/mcp/vice/stock-run-until.ts` (EDIT) | controller/handler | request-response | itself (lines 145-186 arg gate) | exact (self) |
| `src/mcp/vice/vsf-slice.ts` (NEW) | utility (pure binary parser) | file-I/O → transform | `src/mcp/vice/anno-d64.ts` (strict walk) + `src/mcp/vice/prg-image.ts` (pure byte module, refusals) | exact |
| `src/mcp/vice/vsf-slice.test.ts` (NEW) | test | transform over fixtures | `src/mcp/vice/anno-d64.test.ts` + `binmon-fixtures.ts` loader | role-match |
| `src/mcp/vice/capture-predicate.ts` (NEW) | utility (predicate) | transform (two buffers → verdict) | `src/skills/c64-ram-capture/scripts/compare.mjs` (vocabulary only — rules explicitly NOT inherited) + `prg-image.ts` (module shape) | role-match |
| `src/mcp/vice/capture-predicate.test.ts` (NEW) | test | transform | `src/mcp/vice/prg-image.test.ts` | role-match |
| `src/mcp/vice/capture-seam.test.ts` (NEW) | test (structural census) | batch source census | `src/mcp/vice/anno-seam.test.ts` (+ `shipped-modules.ts`) | exact |
| `src/mcp/vice/broker-launch.mts` (EDIT) | config/argv builder (host-bound) | transform | itself, `buildViceArgs()` lines 155-218 | exact (self) |
| `src/mcp/vice/broker-launch.test.ts` (EDIT) | test | transform | itself, the five stock whole-argv `deepEqual`s (1775/1789/1907/1919/1929) | exact (self) |
| `src/mcp/vice/broker-control.mts` (EDIT) | middleware (control-plane protocol) | request-response over TCP JSONL | itself, `ControlRequestKind` line 30 + acquire handler ~line 534 | exact (self) |
| `src/mcp/vice/broker-state.mts` (EDIT) | model (record) | stored state | itself, `InstanceRecord` lines 19-32 + the "optional five" precedent at 33-41 | exact (self) |
| `src/mcp/vice/vice-broker.mts` (EDIT) | service (pool manager, host-bound) | event-driven | itself, `selectWarmInstance()` lines 473-505 | exact (self) |
| `src/mcp/vice/vice-broker-client.ts` (EDIT) | service (broker client) | request-response | itself, the TWO acquire write sites (lines ~372, ~867) | exact (self) |
| `src/mcp/vice/resources/*.mjs` (REGENERATE) | build artifact | generated | `src/mcp/vice/build.ts` `HOST_BOUND_ARTIFACTS` lines 42-51 | exact |
| `src/mcp/vice/capability-registry.ts` (EDIT) | config (message-text registry) | CRUD-free lookup | itself, `vice_machine_config_set` entry lines 277-286 | exact (self) |
| `docs/tool-support.md` (REGENERATE) | generated doc | generated | `scripts/generate-tool-support-table.mjs` + `src/mcp/vice/tool-support-table.test.mjs` (byte-identity guard) | exact |
| `src/mcp/vice/tools-manifest.stock.json` (EDIT) | config | schema | itself, `vice_run_until` entry (no `required` array) | exact (self) |
| `src/mcp/vice/test-gate.mjs` / `test-gate.test.ts` (EDIT, only if a live suite appears) | config + test | batch | themselves — `MANUAL_ONLY_TESTS` (test-gate.mjs:95-105) and the nine-file `deepEqual` (test-gate.test.ts:16-30) | exact (self) |
| `src/mcp/vice/fixtures/vsf/` (NEW) | fixture | file-I/O | `src/mcp/vice/fixtures/binmon/` (`*.bin` + `*.json` provenance sidecar) + `fixtures/README.md` | exact |
| `src/skills/c64-ram-capture/scripts/vsf-slice.mjs` (NEW) | script (skill wrapper) | file-I/O CLI | `src/skills/c64-ram-capture/scripts/compare.mjs` / `d64-parse.mjs` | role-match (see **Hazard 1**) |
| `src/skills/c64-ram-capture/scripts/derive-transients.mjs` (NEW) | script | batch transform | `src/skills/c64-ram-capture/scripts/compare.mjs` `cmdFloor()` (lines 159-210) | exact |
| `src/skills/c64-ram-capture/templates/capture-record.template.md` (EDIT) | template | doc | itself, the Identity table (lines 7-15) | exact (self) |
| `docs/phase33-reproducible-run-gate-findings.md` (NEW) | doc (verdict artifact) | — | `docs/phase23-real-release-gate-findings.md` (frontmatter lines 1-39) | exact |
| `.planning/phases/33-…/evidence/*.mjs` (NEW) | evidence scripts | — | Phase 23 evidence dir, `.planning/phases/23-…/evidence/vsf-ram-extract.mjs` | exact |

No analog: `33-01`'s decision-rules document (a planning artifact; Phase 23's
`DECISION-RULE.md` is the closest precedent but lives under a phase dir, not `src/`), and the
per-release allow-list JSON at `src/skills/c64-ram-capture/transients/<release>.json` (no
per-release committed data artifact exists in this tree today; `RELEASES.json.example` is the
nearest shape).

---

## Pattern Assignments

### `src/mcp/vice/stock-reproducible-run.ts` (service, request-response)

**Analog:** `src/mcp/vice/stock-run-until.ts` (400 lines; read in full)

**Header pattern** (lines 1-36) — copy this *shape*, including a `WHAT NOT TO DO` block that
names the specific past mistake. The analog's four bullets are the exact constraints
`runReproducible()` inherits:

```ts
// WHAT NOT TO DO:
//   - Never wrap the three cleanup paths (hit / timeout / restarted) in one
//     undifferentiated `finally { delete }` -- that is this design space's
//     documented first-draft mistake (Pitfall 4). Each path takes its OWN,
//     distinct action, and only the timeout path ever issues a delete.
//   - Never call registerTraceCheckpoint() here -- that guard exists for
//     `stop:false` trace checkpoints (stock-checkpoints.ts), and the
//     checkpoint this file arms always stops.
//   - Never send a second resume for one wait -- exactly one resume per
//     call, matching vice-sync.ts's own "exactly one resume per wait"
//     invariant, ported here in its stock-native (event-driven, not
//     polling) form.
//   - Never invent a second wire-error converter -- an arming failure goes
//     through convertWireError() directly ...
```

**Imports pattern** (lines 37-51) — all wire encoders come from `stock-protocol.ts`, never
hand-assembled; register reads from `stock-timing.ts`:

```ts
import {
  CommandType,
  CheckpointOperation,
  checkpointSetBody,
  cpNumBody,
  ErrorCode,
  StockProtocolError,
  type ParsedCheckpointInfoResponse,
  type ResolvedResponse,
  type ViceMonitorClient,
} from "./stock-protocol.ts";
import { parseAddress } from "./stock-address.ts";
import { stockAnswer, isErrorText, convertWireError, type StockSessionHandler } from "./stock-handler.ts";
import { readProgramCounter } from "./stock-timing.ts";
import { runStateFor } from "./stock-runstate.ts";
```

`RESET` needs `resetBody()` from the same module (`stock-protocol.ts:876-898`), and the
memspace byte must go through `checkpointSetBody({..., memspace: 0x00 })`, which routes it
through `memspaceByte()` (`stock-protocol.ts:588-591`) — never `body[8]` (P10).

**Core pattern — the arm/resume/wait triple** (analog lines 227-262). Note the deliberate
`temporary: true` divergence and its cited justification; `runReproducible()` arms the frame
anchor with `temporary: false` and the target with `temporary: true`:

```ts
  const body = checkpointSetBody({
    start: address,
    end: address,
    stop: true,
    enabled: true,
    operation: CheckpointOperation.Exec,
    temporary: true,
    memspace: 0x00,
  });

  let response: ResolvedResponse;
  try {
    response = await session.client.send(CommandType.CheckpointSet, body);
  } catch (err) {
    return convertWireError("vice_run_until", err);
  }
  if (response.type !== "checkpoint_info") {
    return isErrorText(`vice_run_until: unexpected reply type "${response.type}" from CHECKPOINT_SET`);
  }
  const checkpointId = response.checkpoint.id;

  // No try/catch around the wait itself: a MachineRestartedError ... propagates
  const outcome = await waitForCheckpointHit(session.client, checkpointId, timeoutMs);
```

**Error handling / cleanup pattern** (analog lines 291-306) — the timeout branch's
single delete, with `ObjectMissing` tolerated as benign and any other wire error *recorded on
the answer, never thrown*:

```ts
  let cleanup: "deleted" | "already_gone" | "delete_failed" = "deleted";
  let cleanupError: string | undefined;
  try {
    await session.client.send(CommandType.CheckpointDelete, cpNumBody(checkpointId));
  } catch (err) {
    if (err instanceof StockProtocolError && err.errorCode === ErrorCode.ObjectMissing) {
      cleanup = "already_gone";
    } else {
      cleanup = "delete_failed";
      cleanupError = convertWireError("vice_run_until", err).content[0]!.text;
    }
  }
```

**Never-hardcode-derived-state pattern** (analog lines 308-340) — the `machineHalted`
derivation. `runReproducible()`'s answer must derive, not literal, for the same stated reason
("a hand-passed state flag drifts from reality the moment a call site changes"):

```ts
  const deleteWasAnswered = cleanup !== "delete_failed";
  const machineHalted = deleteWasAnswered && session.client.connected ? true : runStateFor(session.client) === "stopped";
```

**Answer-shape pattern** (analog lines 276-289) — `stockAnswer(session.client, payload)` with
a `requested:` discriminator and an explanatory `*Note` string alongside every boolean a
caller could misread.

---

### `src/mcp/vice/stock-run-until.ts` — EDIT (controller, request-response)

**Analog:** itself, lines 155-161. `RUN_UNTIL_KEYS` is the by-name unexpected-argument gate
(P9). Both new keys go here **and** into `tools-manifest.stock.json` in the same commit:

```ts
  const RUN_UNTIL_KEYS = ["address", "cycles", "timeout_ms"];
  const unexpectedKeys = Object.keys(args).filter((key) => !RUN_UNTIL_KEYS.includes(key));
  if (unexpectedKeys.length > 0) {
    return isErrorText(
      `vice_run_until: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes only ${RUN_UNTIL_KEYS.join(", ")}`,
    );
  }
```

**Validation pattern for `D-14`'s refusal** — copy the `cycles`-refusal shape (lines 174-186),
which refuses *whenever the argument is present* and explains why refusing beats dropping:

```ts
  if (args.cycles !== undefined) {
    return isErrorText(
      args.address === undefined
        ? "vice_run_until: cycles-only mode not yet implemented; provide an address"
        : "vice_run_until: cycles-only mode not yet implemented; \"cycles\" is not supported alongside \"address\" either -- it would be " +
          "silently ignored, so it is refused rather than dropped. Remove \"cycles\" and bound the wait with \"timeout_ms\" instead.",
    );
  }
```

`D-14`'s message must name *why the frame term cannot be supplied*, in this register.

**Numeric-argument validation pattern** (lines 208-241) — refuse non-finite/non-positive
naming the offending value and valid range; `Math.trunc` **after** the finiteness check; clamp
rather than refuse at a ceiling and surface `timeoutClamped: true`. Reuse verbatim if
`runReproducible()` gains any numeric knob.

---

### `src/mcp/vice/vsf-slice.ts` (utility, file-I/O → transform)

**Analog A — module shape and refusal discipline:** `src/mcp/vice/prg-image.ts` (119 lines).

```ts
// prg-image.ts -- the ONE authoritative place in this repo holding pure C64
// image byte-layout knowledge ...
//
// This module performs NO filesystem and NO network I/O: every function takes
// bytes (or a base64 string) and returns values. Callers obtain and persist
// the bytes themselves.
//
// WHAT NOT TO DO:
//   - Never give any function here a filesystem PATH parameter. ... For the
//     same reason this module imports nothing from either of this repo's two
//     host/container path-translation seams; that absence is asserted
//     structurally by `hostpath-consumers.test.ts`, not merely stated here.
```

This is the exact posture RESEARCH.md requires for `vsf-slice.ts` (must **not** import
`hostpath.ts`; the closed consumer set is pinned by `hostpath-consumers.test.ts`). Prefer the
byte-taking signature; let the skill wrapper do `readFileSync`.

Its refusal style (lines 88-115) is the model for `D-21`'s length assertion:

```ts
export function flatImageOrigin(bytes: Uint8Array): number {
  if (bytes.length !== 65536) {
    throw new Error(
      `flatImageOrigin: input is ${bytes.length} byte(s) -- a flat 64K capture must be exactly 65536 bytes`,
    );
  }
  return 0;
}
```

**Analog B — the strict walk:** `src/mcp/vice/anno-d64.ts` `listEntries()` (lines 143-200).
Copy the visited-set cycle guard, the bounds check before every read, and the
throw-rather-than-resync discipline (which is exactly RESEARCH.md P2's warning about the
prototype's `off++; continue;` resync):

```ts
export function listEntries(image: Uint8Array): D64Entry[] {
  const entries: D64Entry[] = [];
  const visited = new Set<string>();
  ...
    if (visited.has(key)) {
      throw new Error(
        `listEntries: directory chain revisited ${key} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`,
      );
    }
    visited.add(key);
    if (!isInImage(track, sector)) {
      throw new Error(`listEntries: directory chain pointer ${key} is outside the image -- stopped`);
    }
```

And its no-guessing rule (lines 216-234), which maps onto "refuse on the first malformed module
header; never scan past it" and onto refusing when `C64MEM` is absent or duplicated:

```ts
  if (matches.length === 0) {
    const available = entries.map((e) => e.name).join(", ") || "(no entries)";
    throw new Error(
      `extractEntry: no entry named "${entryName}" found. Available entries: ${available}`,
    );
  }
```

`anno-d64.ts`'s header also carries the cross-package constraint that bears on `D-19` — see
**Hazard 1**.

**Constants:** use RESEARCH.md P3's named constants (`RAM_OFFSET = 4`, `RAM_SIZE = 65536`,
`MIN_BODY_LEN = 65543`, `V01_BODY_LEN = 65555`) and `first_module_offset = 58` computed from
named magic/name-length constants, not literal 58.

---

### `src/mcp/vice/capture-predicate.ts` (utility, transform)

**Analog:** `src/skills/c64-ram-capture/scripts/compare.mjs` — **vocabulary and reporting
only**. Its rules are explicitly *not* inheritable (RESEARCH.md P6): the `VOLATILE` ranges
(lines 30-41) and the "one bit differs → passes" rule are incompatible with `CAP-02`.

Reusable — the header-states-the-rules convention (lines 9-20) and the report vocabulary:

```js
//   volatile   $0000-$0001, $0100-$01FF, $0200-$03FF, $D000-$DFFF -- counted,
//              reported, excluded from the verdict
//   drift      exactly one bit differs -- listed as a candidate, does not fail
//   divergence two or more bits differ -- listed, and fails the comparison
```

Reusable helpers to copy in kind (lines 52-77): `hex4`/`hex2`/`bin8`/`popcount`, and the
exact-size load refusal:

```js
function loadImage(path) {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(
      `${path}: ${buf.length} bytes, expected ${IMAGE_BYTES} — not a full 64K image`,
    );
  }
```

Not reusable, and the plan must say so in the new module's header: the four ranges, the
drift-passes rule, and the `$D000-$DFFF` note in the capture-record template (which is
transcription-route-specific — the `.vsf` route reads `mem_ram[]`, so the 4096-address
exclusion disappears).

**Module shape** follows `prg-image.ts`: pure, byte-taking, no path parameter, exported named
functions with refusals in their own messages.

---

### `src/mcp/vice/capture-seam.test.ts` (test, batch source census)

**Analog:** `src/mcp/vice/anno-seam.test.ts` (764 lines — read the census helpers and the
planted-violation controls; do not re-read the prose).

**Imports pattern** (lines 14-25) — the census must use `shippedTsModules()` + `codeOnly()`
from `shipped-modules.ts`, and `readFileSync`, **never** a shelled-out `grep` (this is what
sidesteps the `anno-memmap-render.ts` NUL-byte hazard by construction):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { codeOnly, shippedTsModules } from "./shipped-modules.ts";
```

**Core census pattern** (lines 124-147):

```ts
 * The scanned set is `shippedTsModules()` -- NOT a local `readdirSync`.
 ...
  return shippedTsModules()
    .filter((name) => namesNodeSqlite(stripForSpecifierScan(readFileSync(join(HERE, name), "utf8"))))
...
test("node:sqlite is named by exactly one module of the shipped module set (STORE-07)", () => {
  ...
  assert.deepEqual(importers, [THE_ONE_SEAM], "exactly one shipped module may name the SQLite builtin");
```

For `CAP-03`, the two assertions become: (a) `capture-predicate.ts`'s `codeOnly()` source
names no oracle-module specifier and vice versa; (b) the oracle's comparison function
signature accepts no `Buffer`/`Uint8Array` parameter.

**Planted-violation control pattern** (lines 171-172) — every census assertion is paired with
a planted positive control, so the census is proven non-vacuous:

```ts
test("planted violation, route (c): a dynamic import() is reported", () => {
  const planted = 'export async function useIt() {\n  const { DatabaseSync } = await import("node:sqlite");\n  return DatabaseSync;\n}\n';
```

**Non-vacuity pattern** (lines 224-233) — assert the scanned set is substantial and contains
the new modules by name, so a helper that silently returns `[]` cannot pass.

---

### `src/mcp/vice/broker-launch.mts` — EDIT (config/argv builder, host-bound)

**Analog:** itself, `buildViceArgs()` at lines 155-218. The determinism block and the optional
`-console`/`-warp` go on the **stock branch only**, and the `VICE_ARGS` short-circuit stays
ahead of both branches:

```ts
  const rawViceArgs = viceArgsEnv ?? process.env.VICE_ARGS;
  if (typeof rawViceArgs === "string" && rawViceArgs.trim() !== "") {
    return rawViceArgs.trim().split(/\s+/);
  }
  if (backend === "stock") {
    ...
    const args = ["-default", "-drive8type", "1541", "-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`];
```

Per RESEARCH.md P5 the new order is `-default`, optional `-console`, `-drive8type 1541`, the
determinism block, optional `-warp`, then `-binarymonitor …`. The fork branch's final line
(`["-mcpserver", ...]`) must stay byte-identical.

**Comment pattern to extend, not replace:** the existing 20-line block above `args` (lines
177-204) explains *why* `-default` is first and cites the live probe that proved it. Add the
`-console` prefix-scan reason (`main.c:184-192`) in the same register rather than a bare flag
push.

**Optional-and-absent-by-default pattern** (lines 225-232) — the worked in-tree precedent for
`D-15`/`D-16`:

```ts
  /** I-1 rider (08.2-02-PLAN.md, Task 2): widened to an optional third
   * `options` argument ... The parameter is
   * optional, so every pre-existing 2-arg caller and every pre-existing
   * 2-arg test stub keeps compiling and behaving identically -- JS/TS
   * function-type compatibility allows a function that ignores its extra
   * argument to satisfy a type that offers one. */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
```

---

### `src/mcp/vice/broker-control.mts` — EDIT (middleware, JSONL request-response)

**Analog:** itself. `D-15` is a field on an existing op, not an eighth op (lines 30-39):

```ts
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release";

export interface ControlRequest {
  op: string;
  id?: string;
  token?: string;
  target_id?: string;
  [key: string]: unknown;
}
```

**Field-narrowing pattern** in the handler (lines ~526-540) — every incoming field is narrowed
by `typeof` with a default, never trusted:

```ts
      const token = typeof req.token === "string" ? req.token : "";
      ...
      if (req.op === "acquire") {
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
        void attemptAcquire(requestId).then((settled) => {
          if (!settled) {
            enqueueAcquire(pendingAcquires, { requestId, attempt: () => attemptAcquire(requestId) });
          }
        });
```

`profile` must be narrowed the same way (object with two optional booleans; anything else →
treated as absent, or a `bad_request` error using the existing `ControlErrorCode` vocabulary).

**Error-response pattern** (same handler) — `writeLine(socket, { kind: "error", code: "…" as ControlErrorCode, message: "…" })`;
`bad_request` already exists for a malformed `profile`.

---

### `src/mcp/vice/broker-state.mts` + `src/mcp/vice/vice-broker.mts` — EDIT (model + pool service)

**`InstanceRecord`** (broker-state.mts:19-32) gains an optional `profile`. The precedent for
"optional means a record written by an older path stays valid" is stated in the file at lines
33-41 — reuse that wording, because RESEARCH.md's Runtime State Inventory notes a broker
restarted mid-phase reads records with no `profile` field (absent ≡ profile-less, which is the
warm floor's current behaviour):

```ts
  // Plan 03 (C2/D-23): the per-child supervisor's own bookkeeping fields.
  // Optional -- a record created through a path that does not supervise
  // (e.g. a caller with its own lifecycle) remains a valid InstanceRecord
  // without them; broker-launch.mts's superviseChild() is the one writer
  // that always sets all five together, immediately after every launch.
```

**`selectWarmInstance()`** (vice-broker.mts:473-505) is where `D-16`'s eligibility check goes.
Copy the existing loop's discipline exactly — the `continue` filter comes *before* the probe,
and the post-`await` re-check of both `record.state` and map membership is load-bearing (CR-01):

```ts
  for (const record of Array.from(state.instances.values())) {
    if (record.state !== "ready") continue;

    const isReady = await deps.probe(record.port);

    // A sibling acquire may have granted OR dropped this exact candidate
    // while this probe was in flight. ... so map membership must be rechecked
    // too, not merely the state field (CR-01, ...).
    if (record.state !== "ready" || state.instances.get(record.port) !== record) {
      continue;
    }
```

Add the profile-eligibility test as a pure synchronous `continue` filter next to
`record.state !== "ready"` — i.e. **before** the `await deps.probe(...)`. That keeps the
single-owner `inFlight` check-and-set free of any new `await`, and it must not become "recycle
the warm instance to re-warp it" (named anti-pattern).

The doc comment at lines 549-566 states the two-arm contract (`selectWarmInstance()` first,
`atCapacity()` gates only the cold arm, both arms converge on exactly one `state.grants.set()`
call, which a structural test counts). An ineligible-profile miss must fall through to the cold
arm without adding a second `grants.set()`.

---

### `src/mcp/vice/vice-broker-client.ts` — EDIT (service, request-response)

**Analog:** itself. **Two** write sites, both must carry `profile` or it silently never arrives
(lines ~372 and ~867):

```ts
      socket.write(`${JSON.stringify({ op: "acquire", id: requestId, token })}\n`);
...
    const raw = await sendAndAwaitLine({ op: "acquire", id: requestId, token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
```

---

### `src/mcp/vice/capability-registry.ts` — EDIT + `docs/tool-support.md` REGENERATE

**Analog:** the entry being edited, lines 277-286:

```ts
  {
    name: "vice_machine_config_set",
    category: "descoped",
    providedBy: "fork",
    reason:
      "Full resource get/set access was descoped; the fork's tool is a hand-curated whitelist " +
      "subset that never shipped on stock. Its advertised WarpMode resource is fork-only: stock " +
      "has no runtime warp resource at all, and warp on stock is a launch-time flag, not a " +
      "resource that can be toggled while running.",
  },
```

`D-17` replaces the last clause with the both-things statement (no runtime `WarpMode`
resource — MEASURED `err=0x01 OBJECT_MISSING`; runtime toggling exists only on the text
monitor, which this project does not dial).

**Generated-artifact pattern:** the table is produced by `scripts/generate-tool-support-table.mjs`
and guarded byte-identically by `src/mcp/vice/tool-support-table.test.mjs`, whose header states
the drift contract and the deliberate `.mjs` extension reason:

```js
// This is the byte-identity drift guard for docs/tool-support.md (T-08-03-01)
// PLUS the structural proof that the table's row set is not hand-typed
// ... the derived-union equality test below computes
// its own expected row set independently from the same three inputs the
// generator uses, using the test's own code -- never by importing the
// generator's discoverSyntheticToolNames()
```

Regenerate in the **same commit** as the registry edit or the guard reds.

Same rule for `resources/*.mjs`: any edit to `broker-launch.mts` / `broker-control.mts` /
`broker-state.mts` / `vice-broker.mts` requires `node build.ts` and committing the regenerated
artifacts. `build.ts:42-51` is the fixed list, and it **throws** on an unlisted host-bound
`.mts`:

```ts
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
];
```

Do **not** add an entry: `stock-reproducible-run.ts` and `vsf-slice.ts` are container-side
`.ts`, correctly.

---

### `src/mcp/vice/fixtures/vsf/` (NEW fixture) + `vsf-slice.test.ts`

**Analog:** `src/mcp/vice/fixtures/binmon/` and its loader `src/mcp/vice/binmon-fixtures.ts`.

**Fixture layout pattern:** `<case>.bin` plus a `<case>.json` provenance sidecar:

```json
{
  "capturedFrom": "fork:/usr/local/bin/x64sc",
  "viceVersion": "3.10.0.0",
  "capturedAt": "2026-08-21T23:02:34.003Z",
  "command": "DISPLAY_GET (0x84)",
  "synthetic": false
}
```

**Loader pattern** (`binmon-fixtures.ts:255-299`) — required provenance keys, and a corrupt
sidecar getting the same named error as an absent one, with the regeneration command in the
message:

```ts
  if (!existsSync(binPath) || !existsSync(jsonPath)) {
    throw new MissingFixtureError(
      `Captured fixture "${caseName}" is missing at ${binPath} -- regenerate it with: ${command}`,
      { path: binPath, command },
    );
  }
  ...
  const missingKeys = REQUIRED_PROVENANCE_KEYS.filter((k) => !(k in provenance));
```

The module header's provenance discipline is the standard to meet — "in a codebase whose
review standard is *provenance that lies is the thing not to produce*, the module that LOADS
the fixtures is the worst possible place for a stale blanket claim in either direction". A
synthetic `.vsf` fixture must declare `"synthetic": true`; a real 3.9 snapshot slice must
declare its `viceVersion` and `capturedFrom`.

Also copy `src/mcp/vice/fixtures/README.md`'s "These are FROZEN EVIDENCE" section shape if any
fixture is a real capture.

Note: `binmon-fixtures.ts` is deliberately **outside** `package.json`'s `files[]`
(test-support only). Any vsf fixture loader should follow that, while `vsf-slice.ts` itself
must be **in** `files[]` (see `prg-image.ts`'s "THIS MODULE MUST BE LISTED IN files[]"
paragraph and `scripts/check-npm-packages.mjs`'s closure walk).

---

### `src/skills/c64-ram-capture/scripts/derive-transients.mjs` (script, batch)

**Analog:** `src/skills/c64-ram-capture/scripts/compare.mjs`.

**CLI pattern** (lines 235-257) — verb dispatch table, `process.exit(commands[cmd](rest))`,
`--limit` parsed by `limitFrom(argv)`, positional paths filtered out of the flag list:

```js
const [cmd, ...rest] = process.argv.slice(2);
...
process.exit(commands[cmd](rest));
```

**N-way union pattern:** `cmdFloor(argv)` (lines 159-210) already takes 3+ images and computes
a pairwise-derived floor — that is structurally `D-23`'s union derivation. Copy its shape and
add the hard cap: exceeding 64 addresses **voids** the derivation (non-zero exit, no artifact
written), never a warning.

**Header pattern** (lines 1-21) — the "Pure logic. This module reads files the agent already
captured and does arithmetic over them. It contacts nothing" paragraph, and the explicit note
of where the module departs from SKILL.md with the evidence citation.

---

### `src/skills/c64-ram-capture/templates/capture-record.template.md` — EDIT

**Analog:** itself, lines 7-15. `D-29`'s three rows go into this exact table shape
(`| Field | Value | How obtained |`), alongside the existing sha256 row that already cites
`node scripts/compare.mjs digest`:

```markdown
| sha256 | `<64 hex chars>` | `node scripts/compare.mjs digest <name>.bin` |
| checkpoint / trigger address | `$____` | the address armed for this capture |
```

Also re-ground the trailing `$D000-$DFFF` note (lines 55-59) — it is transcription-route
specific and must not be copied onto the snapshot route (RESEARCH.md P6).

---

### `docs/phase33-reproducible-run-gate-findings.md` (NEW doc)

**Analog:** `docs/phase23-real-release-gate-findings.md`, frontmatter lines 1-39.

```yaml
---
phase: 23-the-real-release-gate-go-degrade-no-go
requirement: [PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05]
probe_date: 2026-08-26
verdict: no-go
verdict_rule_applied: R1
corpus:
  releases:
    - release: "danish"
      file_sha256: "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5"
      capture_sha256: "could-not-run"
      canonical: true
criteria:
  c0_corpus: partial
  c1_adjudicated_fraction: could-not-run   # no evidence file; 23-05/23-07 not dispatched
---
```

Copy the field layout and the *inline comment per input* convention (each input says where it
was transcribed from, or why it has no evidence file). Under `D-02`/`D-03` the phase-33
document must have **no `could-not-run` value in the verdict field** and must use the five
named inputs with their enumerated domains, `not-obtained` included as a legitimate value.
The prose paragraph immediately after the frontmatter (explaining why frontmatter exists at
all, and that a prose sentence in the body is not a machine-readable verdict) is worth
carrying forward.

---

## Shared Patterns

### Structured `WHAT NOT TO DO` file header naming the specific past mistake
**Sources:** `src/mcp/vice/stock-run-until.ts:18-36`, `src/mcp/vice/prg-image.ts:52-79`,
`src/mcp/vice/anno-d64.ts:29-41`, `src/mcp/vice/capability-registry.ts:15-19`
**Apply to:** every new module — `stock-reproducible-run.ts`, `vsf-slice.ts`,
`capture-predicate.ts`, and the three new tests.
Each header states (1) WHY the file exists, naming the incident or requirement, (2) what it is
the ONE authoritative place for, (3) what not to do, with the past mistake named.

### Single seam, and never re-derive it locally
**Sources:** `src/mcp/vice/capability-registry.ts:15-19`, `src/mcp/vice/binmon-fixtures.ts:1-6`
```ts
// WHAT NOT TO DO: do not hand-maintain a second copy of this data anywhere
// else in the repo (D-E; see CLAUDE.md's "re-deriving a cross-cutting seam
// locally" anti-pattern). If a consumer needs this data in a different
// shape, import CAPABILITY_REGISTRY and reshape it there
```
**Apply to:** wire framing (`stock-protocol.ts` only), register ids (`stock-timing.ts` only),
`.vsf` layout knowledge (`vsf-slice.ts` only), port normalisation (`capture-predicate.ts`
only), argv construction (`buildViceArgs()` only), snapshot paths (`stock-paths.ts` only).

### Optional-and-absent-by-default to widen a frozen contract
**Source:** `src/mcp/vice/broker-launch.mts:225-232`
**Apply to:** `reproducible` / `frame_anchor` on `vice_run_until`, `profile` on `acquire`,
`profile` on `InstanceRecord`, the three new template rows.

### Generated-but-committed artifacts under two-directional drift guards
**Sources:** `src/mcp/vice/build.ts:42-51` + `resources-sync.test.ts`;
`scripts/generate-tool-support-table.mjs` + `src/mcp/vice/tool-support-table.test.mjs`
**Apply to:** every plan editing a `*.mts` (run `node build.ts`, commit `resources/*.mjs`) and
the `capability-registry.ts` edit (regenerate `docs/tool-support.md`) — same commit, always.

### Source census by `readFileSync` + `codeOnly()`, never by shelled-out grep
**Source:** `src/mcp/vice/anno-seam.test.ts:21`, `:131-132`; helpers in
`src/mcp/vice/shipped-modules.ts:151` (`shippedTsModules`) and `:206` (`codeOnly`, with the
`keepLiteralBodies` flag at `:190-205`)
**Apply to:** `capture-seam.test.ts` (`CAP-03`). This structurally avoids the
`anno-memmap-render.ts` NUL-byte blind spot — a plain `grep` census silently under-covers.

### Every census/guard is paired with a planted positive control
**Source:** `src/mcp/vice/anno-seam.test.ts:171-172`, `:224-233` (non-vacuity)
**Apply to:** `capture-seam.test.ts` and `capture-predicate.test.ts` (`D-25`'s corpus-free
plant — plant a **one-bit** difference, per RESEARCH.md P6, or the control proves nothing).

### The nine-file manual/automated gate
**Sources:** `src/mcp/vice/test-gate.mjs:95-105`, `src/mcp/vice/test-gate.test.ts:16-30`
**Apply to:** any new test file. All three new tests are corpus-free and belong in the
automated set with **no** `test-gate.mjs` edit (`D-08`, default expectation zero new entries).
If a live suite is written, both lists change in the same commit — the union must equal the
on-disk set exactly, and a file in one side only reds immediately.

---

## Hazards Found During Mapping

**Hazard 1 — `D-19`'s skill-side wrapper importing `vsf-slice.ts` may not resolve.**
`src/mcp/vice/anno-d64.ts:7-20` records this as a measured constraint, and no skill script in
the tree imports the MCP tree today (`grep -rn "mcp/vice" src/skills/*/scripts/*.mjs` →
empty):

```
// WHY THIS FILE EXISTS HERE, AND NOT AS AN EXTENSION OF
// `src/skills/c64-ram-capture/scripts/d64-parse.mjs`: ... this MCP server ships as
// `@henols/vice-mcp`, whose `files[]` in `package.json` lists only
// `src/mcp/vice/` contents, while `src/skills/**` ships in the *other* package
// (`@henols/c64-re-tools`). An import from this seam into a skill script
// cannot resolve on either npm-installer route ... and
// `scripts/check-npm-packages.mjs`'s transitive-closure walk over `files[]`
// would fail the pack the moment a reachable module sat outside the listed set.
```

The planner must choose deliberately between (a) a self-contained skill-side script (the
`d64-parse.mjs` / `anno-d64.ts` precedent: two independent copies, each documented as such),
or (b) an MCP-side CLI entry point the skill invokes. Do not plan a plain cross-package import.

**Hazard 2 — `compare.mjs` is a vocabulary analog only.** Inheriting its `VOLATILE` ranges or
its drift-passes rule makes `D-25`'s control vacuous (RESEARCH.md P6). The new predicate is a
replacement in kind; say so in its header.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `33-01`'s decision-rules document | planning artifact | — | Phase 23's own `DECISION-RULE.md` under `.planning/phases/23-…/` is the precedent, but it is a planning artifact, not source; the planner should read it directly rather than pattern-match a code analog |
| `src/skills/c64-ram-capture/transients/<release>.json` | committed data artifact | stored data | No per-release committed data artifact exists in this tree. `src/skills/c64-ram-capture/RELEASES.json.example` is the nearest shape (release identity by name + sha256) |

---

## Metadata

**Analog search scope:** `src/mcp/vice/` (126 `*.test.*` files, ~190 source modules),
`src/skills/c64-ram-capture/`, `src/skills/c64-provenance-diff/`, `scripts/`, `docs/`
**Files read in full or in targeted ranges:** `stock-run-until.ts`, `prg-image.ts`,
`anno-d64.ts`, `anno-seam.test.ts` (targeted), `binmon-fixtures.ts` (targeted),
`broker-launch.mts` (targeted), `broker-control.mts` (targeted), `broker-state.mts`
(targeted), `vice-broker.mts` (targeted), `build.ts` (targeted), `capability-registry.ts`
(targeted), `tool-support-table.test.mjs` (targeted), `test-gate.mjs`/`test-gate.test.ts`,
`compare.mjs`, `capture-record.template.md`, `stock-paths.ts` (targeted),
`docs/phase23-real-release-gate-findings.md` (targeted), `fixtures/README.md`
**Tracked-source verification:** `git ls-files --` run on all 20 analog paths; all tracked
**Pattern extraction date:** 2026-09-02
