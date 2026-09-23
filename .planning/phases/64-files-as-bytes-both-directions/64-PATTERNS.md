# Phase 64: Files as Bytes, Both Directions - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 10 (4 new modules/pairs + 4 migrated handlers + 2 support edits)
**Analogs found:** 10 / 10 (every file has at least a role-match or exact analog; the one
genuinely new primitive — the streaming hash+cap `Transform` — has no in-repo precedent for
its *body*, but a precedent for its *composition rules*, both cited below)

This phase's own research (`64-RESEARCH.md`) already did most of this agent's job at the
architecture level — it named `dialMonitorRelay()`, the Buffer-carry line reader, the
`attach` dispatch arm, `sanitizeSnapshotName()`, `digestOutputFile()`, the five (now six)
`renameSync` sites, and the handle-minting comment as the analogs to copy. This document
turns those citations into per-file assignments with exact line numbers, confirms two things
the research pass flagged as open (`stock-machine.test.ts` exists; `broker-kill.mts`'s
`reapOrphanedInstances()` is the D-07/D-08 sweep analog), and adds one analog the research
pass did not name: `broker-kill.mts`'s startup reap is the closest existing shape for
XFER-07's crash sweep, not just for D-08's vicerc relocation.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/broker-endpoint.ts` (+ `dialFileTransfer()`, new export, same file) | service (dial/handshake) | streaming | `dialMonitorRelay()` / `performAttach()` in the same file, `broker-endpoint.ts:639-693,706-779` | exact — same module, same two-candidate-hello-then-one-line shape |
| `src/mcp/vice/broker-control.mts` (extend `ControlRequestKind`, new dispatch arm) | controller (protocol dispatch) | request-response → streaming handoff | the `attach` arm, `broker-control.mts:1359-1396`, and `ControlRequestKind`'s own extension comments, `:63-96` | exact — literally the same union and the same "twelfth arm on an existing switch" the research pass named |
| `src/mcp/vice/broker-transfer.mts` (new sibling module; planner may rename) | service (streaming byte transfer, host-bound) | streaming | `broker-relay.mts` (splice/framing rules) `broker-relay.mts:1-107`, header prohibitions | role-match — same seam family (`.mts`, host-bound, owns bytes crossing one socket), new because Phase 63's relay never hashes/caps |
| `src/mcp/vice/transfer-hash.ts` (new; streaming `Transform`, D-04) | utility (transform stream) | streaming, transform | `host-tool.mts:2269-2283` `digestOutputFile()` (digest idiom, wrong shape — one-shot not streaming) | role-match only — no streaming precedent exists in this repo (confirmed by research's own repo-wide grep); compose `node:crypto`'s streaming `Hash` with `node:stream`'s `Transform` per Node's own documented contract |
| `src/mcp/vice/transfer-paths.ts` (new; pure containment validator, D-13/XFER-03) | utility (pure validation, no I/O) | transform | `sanitizeSnapshotName()`, `stock-paths.ts:160-169` | exact — same refuse-not-sanitise posture, same allow-list-regex style, same `StockPathError`-style throw |
| `src/mcp/vice/stock-machine.ts` (`handleSnapshotSave`, `handleSnapshotLoad`, `handleAutostart`, `handleDiskAttach`) | controller (stock tool handler) | request-response → file transfer | itself, unchanged handlers in the same file, `stock-machine.ts:104-368` | exact — same file, same four functions, only the file-path plumbing inside each changes |
| `src/mcp/vice/broker-launch.mts` (D-08: relocate vicerc scratch dir) | service (spawn helper) | file-I/O | itself, `broker-launch.mts:537-554` | exact — same function, same call site, only the `tmpdir()` root moves to `brokerHome()` |
| `src/mcp/vice/broker-kill.mts` (D-08: live-pid-guarded vicerc reap, folded todo) | service (kill/recycle + startup sweep) | event-driven / batch | `reapOrphanedInstances()`, `broker-kill.mts:556-634`, and `verifiedKill()`, `:126-180` | exact — same file already owns "identity-verified, only-when-actually-gone" cleanup; this is a second reap in the same module, not a new seam |
| staging directory lifecycle (session-close + XFER-07 startup sweep; likely lands in `vice-broker.mts` and/or `broker-transfer.mts`, planner's call) | service (lifecycle/sweep) | batch / event-driven | `reapOrphanedInstances()`, `broker-kill.mts:556-634` (startup-only sweep shape) + `brokerHome()`, `broker-home.mts:95-100` (root resolution) | role-match — same "enumerate on-disk records, act only where a live check licenses it" shape, applied to a directory tree instead of a pid |
| `*.test.ts` / `*.test.mts` for every module above | test | — | `stock-machine.test.ts` (DI-stub session pattern), `broker-endpoint.test.ts:78` / `broker-control.test.ts:173` (ephemeral-port convention) | exact — colocated `node --test` files, same DI/no-mocking-library convention |

## Pattern Assignments

### `src/mcp/vice/broker-endpoint.ts` — new `dialFileTransfer()` (service, streaming)

**Analog:** `dialMonitorRelay()` / `performAttach()`, same file, `broker-endpoint.ts:639-779`

**Imports already in file** (no new imports needed — `Socket`, `connect` already present):
```typescript
// broker-endpoint.ts's existing top-of-file imports (not re-quoted; dialFileTransfer()
// is a new export added below dialMonitorRelay(), reusing DIAL_CANDIDATES,
// DEFAULT_CONTROL_PORT, dialOneCandidate(), classifyHelloReply(), describeDialFailure()
// already defined above in this same file — do not re-import or re-derive any of these.
```

**Two-candidate dial, keep the winner** (`broker-endpoint.ts:706-778`, `dialMonitorRelay()` body — copy verbatim, change only the tag and what `performAttach`'s sibling does after the reply):
```typescript
export function dialMonitorRelay(options: DialMonitorRelayOptions): Promise<DialMonitorRelayResult> {
  const port = options.port ?? DEFAULT_CONTROL_PORT;
  const candidates = options.candidates ?? DIAL_CANDIDATES;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  const connectFn = options.connect ?? connect;
  const clientVersion = options.clientVersion ?? CLIENT_VERSION;
  const tag = options.channel === "text" ? RELAY_TAG_TEXT : RELAY_TAG_BINARY;

  return new Promise<DialMonitorRelayResult>((resolveOuter) => {
    // ... candidate racing, destroyLosers(), performAttach() on the winner ...
  });
}
```

**Reply read — byte-level terminator search, never a whole-buffer string decode** (`broker-endpoint.ts:662-683`, `performAttach()`'s `"data"` handler — this IS D-02's framing template: after this reply line, `dialFileTransfer()` diverges from `dialMonitorRelay()` by starting the payload phase instead of handing the socket back for a splice):
```typescript
socket.on("data", (chunk: Buffer) => {
  carry = Buffer.concat([carry, chunk]);
  const idx = carry.indexOf(0x0a);
  if (idx === -1) return; // keep accumulating -- bounded by the reply timer, not a byte cap
  const lineText = carry.subarray(0, idx).toString("utf8");
  const pending = carry.subarray(idx + 1);
  let parsed: unknown = null;
  try { parsed = JSON.parse(lineText); } catch { parsed = null; }
  if (typeof parsed === "object" && parsed !== null && (parsed as Record<string, unknown>).kind === "attached") {
    finish({ ok: true, socket, host, port, pending });
    return;
  }
  const message = /* ... refuse-by-name from parsed.message, or a generic unrecognisable-reply text ... */;
  finish({ ok: false, reason: `vice: ${message}` });
});
```

**Never-throw settle discipline** (`broker-endpoint.ts:643-660`): a `finish()` closure that clears the reply timer, strips every listener, destroys the socket on `!result.ok`, and settles the outer promise exactly once — copy this scaffolding verbatim for `dialFileTransfer()`'s own settle function.

---

### `src/mcp/vice/broker-control.mts` — new `ControlRequestKind` member + dispatch arm (controller, request-response → streaming handoff)

**Analog:** the `attach` arm, `broker-control.mts:1359-1396`, and the union's own extension-comment convention, `:63-96`

**The union to extend** (`broker-control.mts:96`, quoted verbatim — the exact line the new member is added to):
```typescript
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release" | "host_tool" | "hello" | "attach" | "operation";
// + a twelfth member for the file transfer, e.g. "transfer" (exact literal is the
// planner's/executor's choice per RESEARCH.md Assumption A3 — no decision record picks one)
```

**Extension-comment convention** (`broker-control.mts:78-95`, copy this style — name the phase, name the ordinal, name what does and does not gate it): the `attach` member's own comment ("Phase 63 (SESS-02) -- UNLIKE `hello`, it sits AFTER the token gate ... this listener answers it once, then that socket's own line reader stops running") is the template; the new member's comment must state which of `relayMode`'s two behaviours (deaf-forever vs. resumable) the transfer arm follows.

**Dispatch arm — handle-only authority, NOT gated by `ownsTarget()`** (`broker-control.mts:1359-1396`, copy this shape verbatim, this IS D-01's shipped precedent, T-63-01):
```typescript
} else if (req.op === "attach") {
  // Phase 63 (SESS-02). Deliberately NOT gated by ownsTarget(): this
  // connection is a brand-new relay socket, never the one that ran
  // monitor_claim, so requestIdForThisConnection is null on it -- the
  // per-claim `handle` presented below is the ONLY authority this
  // arm can check (T-63-01). Sits AFTER the token gate, unlike
  // `hello` -- see ControlRequestKind's own comment on this op.
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  const presentedHandle = typeof req.handle === "string" ? req.handle : "";
  if (targetId === "" || presentedHandle === "") {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "attach requires target_id and handle" });
    return;
  }
  // ... channel/kind resolution, refuse-by-name on an unrecognised value ...
  relayMode = true; // or an equivalent transfer-mode flag -- flipped BEFORE the callback
  const outcome = opts.onRelayAttach(targetId, channel, presentedHandle, socket, remainderAfterLine);
  if (outcome.ok) {
    writeLine(socket, { kind: "attached" });
  } else {
    relayMode = false; // the attach FAILED -- resume this socket's own line reader
    writeLine(socket, { kind: "error", code: outcome.code, message: `attach refused: ${outcome.code}` });
  }
}
```
The new arm's callback (`onFileTransfer` or similar) is a new field on `StartControlListenerOptions`, mirroring `onRelayAttach`'s own shape — the planner should add it beside `onRelayAttach`/`onOperation`, not inline the transfer logic into `broker-control.mts` itself (the module owns *dispatch*, `broker-transfer.mts` owns *streaming*).

**Buffer-carry line reader — already present, needs NO framing rework on the receiving side** (`broker-control.mts:940-988`, quoted verbatim, this is D-03's "satisfied by construction" claim made concrete):
```typescript
let carry: Buffer = Buffer.alloc(0);
let requestIdForThisConnection: string | null = null;
let relayMode = false;

socket.on("data", (chunk: Buffer) => {
  if (relayMode) return;
  const combined = Buffer.concat([carry, chunk]);
  if (combined.length > MAX_LINE_BYTES) {
    socket.destroy();
    return;
  }
  let cursor = combined;
  let newlineIdx: number;
  while ((newlineIdx = cursor.indexOf(0x0a)) !== -1) {
    const lineBuf = cursor.subarray(0, newlineIdx);
    const remainder = cursor.subarray(newlineIdx + 1);
    handleLine(lineBuf.toString("utf8"), remainder);
    if (relayMode) return; // remainder already handed to the splice/transfer, never re-examined
    cursor = remainder;
  }
  carry = cursor;
});
```

**Ownership check on the command connection, not the transfer connection** (D-01): the existing `ownsTarget()` predicate at `broker-control.mts:1030-1032`, already used by `monitor_claim`/`monitor_release`/`recycle`/`operation` (`:1245,1292,1339,1411`), is what the *command* (`AUTOSTART`/`DUMP`/`UNDUMP`) arm keeps calling — copy the same `if (!ownsTarget(targetId)) { writeLine(socket, { kind: "error", code: "denied" ... }); return; }` guard shape from any of those four call sites. The *new* transfer arm must NOT call it, per the `attach` precedent above.

---

### `src/mcp/vice/broker-transfer.mts` — new module (service, host-bound, streaming)

**Analog:** `broker-relay.mts`, full module (`broker-relay.mts:1-107` read; header prohibitions apply to the whole file)

**Module header convention to copy** (`broker-relay.mts:1-29`, adapt the WHY and the WHAT-NOT-TO-DO list to the transfer case — same three prohibitions, reworded for "a payload has a known length and a digest to verify" instead of "a splice has neither"):
```typescript
// broker-transfer.mts
//
// Phase 64 (XFER-01..08): a file payload crosses this connection as one JSON
// header line, then exactly N raw bytes -- never re-parsed as JSON, never
// decoded to a string past the header. [... state D-01/D-02's shape ...]
//
// WHAT NOT TO DO:
//   - Never call `.toString("utf8")` (or any other string decode) on a
//     payload chunk. The one and only string decode in this file is the
//     header line's own decode, strictly before its terminator.
//   - Never hand-roll the byte copy loop. `Socket.prototype.pipe()` /
//     `stream/promises`' `pipeline()` own backpressure end to end.
//   - Never buffer the whole payload before hashing or cap-checking it --
//     enforce the cap and compute the digest INSIDE the streaming Transform,
//     as bytes arrive (D-04, D-11).
```

**Header-line read** (`broker-relay.mts:88-107`, `readAttachLine()` — copy this exact byte-level-terminator-search shape for reading the transfer header line off the front of a fresh connection):
```typescript
export function readAttachLine(chunk: Buffer, carry: Buffer = Buffer.alloc(0)): ReadAttachLineResult {
  const combined = Buffer.concat([carry, chunk]);
  const idx = combined.indexOf(0x0a);
  if (idx === -1) {
    return { remainder: combined, overflow: combined.length > MAX_ATTACH_LINE_BYTES };
  }
  return {
    line: combined.subarray(0, idx).toString(),
    remainder: combined.subarray(idx + 1),
    overflow: false,
  };
}
```

**Streaming, backpressure-owning byte path** (`pipe()`, per the header's own standing prohibition — no direct in-repo call site to copy since this is genuinely new; the composition is dictated by `64-RESEARCH.md`'s Pattern 2/3, reproduced here as the shape to implement):
```typescript
// Upload (client -> broker) or download (broker -> client): identical shape,
// direction only changes which side is createReadStream/createWriteStream
// and which is the socket.
await pipeline(source, hashAndCountTransform, destination); // node:stream/promises
```

---

### `src/mcp/vice/transfer-hash.ts` — new module (utility, streaming transform, D-04)

**Analog (digest idiom only, NOT the streaming shape):** `digestOutputFile()`, `host-tool.mts` (targeted read, ~2269-2283):
```typescript
function digestOutputFile(path: string): HostToolFileResult | null {
  try {
    const contents = readFileSync(path);
    const sha256 = createHash("sha256").update(contents).digest("hex");
    return { path, sha256, byteLength: contents.length };
  } catch {
    return null;
  }
}
```
**Do not copy this function's shape wholesale** — it reads the whole file into memory first (Pitfall 3 in `64-RESEARCH.md`). Reuse only `createHash("sha256")` as the digest algorithm and the `{ path/byteLength/sha256 }` result shape; wrap `hash.update(chunk)` inside a `Transform`'s `_transform`, never a one-shot `readFileSync`.

**No streaming precedent exists in this repo** (confirmed by this phase's own research: a repo-wide `grep -rn "node:stream\|Transform\|createReadStream"` over non-test `*.ts`/`*.mts` returned zero hits). The `Transform` contract itself is Node's own documented stdlib shape, not a project convention to imitate — implement per Node's `stream.Transform({ transform, flush })` documentation, composing:
- `node:crypto`'s streaming `Hash` object (`createHash("sha256")`, `.update(chunk)`, `.digest("hex")` — same algorithm as `digestOutputFile()`, applied incrementally)
- a running byte counter, compared against the cap on every chunk (D-11: enforced as bytes arrive)
- `callback(err)` the instant the cap is exceeded, never after accumulating the whole payload

**Mid-stream abort naming precedent** (D-11's "detect, then refuse by name with the remedy" — `broker-relay.mts`'s own `MAX_ATTACH_LINE_BYTES` overflow-refusal style, `:68-69`, and the project's Phase 62 D-07 "four distinct sentences" principle cited in `64-CONTEXT.md`'s specifics): the refusal message must read like `"vice: transfer exceeds the 16 MiB cap (16777216 bytes); received at least ${seen} bytes"` — a number a person can act on, never "too large".

---

### `src/mcp/vice/transfer-paths.ts` — new module (utility, pure validation, D-13/XFER-03)

**Analog:** `sanitizeSnapshotName()`, `stock-paths.ts:160-169`, quoted verbatim:
```typescript
const SNAPSHOT_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function sanitizeSnapshotName(name: unknown): string {
  if (typeof name !== "string" || !SNAPSHOT_NAME_RE.test(name)) {
    throw new StockPathError(
      `sanitizeSnapshotName: name must be 1-64 characters of alphanumeric, underscore or hyphen only ` +
        `(matching ${SNAPSHOT_NAME_RE}) -- it is used to build a filename, so path separators, ".." and absolute ` +
        `paths are rejected outright. Got ${JSON.stringify(name)}.`,
    );
  }
  return name;
}
```

**Shape to write instead — refuse, do not throw, per XFER-03's own required fixtures** (`64-RESEARCH.md`'s own Code Examples section, reproduced here as the shape, field names are the planner's choice):
```typescript
export function validateContainedDestination(candidate: string, rootDir: string): { ok: true; resolved: string } | { ok: false; reason: string } {
  if (candidate.includes("\0")) return { ok: false, reason: "destination name contains a NUL byte" };
  if (candidate.includes("..")) return { ok: false, reason: "destination name contains a traversal segment ('..')" };
  if (isAbsolute(candidate)) return { ok: false, reason: "destination name is an absolute path" };
  if (candidate.includes("/") || candidate.includes("\\")) return { ok: false, reason: "destination name contains a path separator" };
  return { ok: true, resolved: join(rootDir, candidate) };
}
```
Required fixtures (D-13, verbatim): `../../etc/passwd`, `/etc/passwd`, `C:\`, a NUL-embedded name — all refused, never sanitised. No I/O in this function (pure, tested against fixture strings only).

**Error class convention, if a throwing variant is preferred over the discriminated-result shape above:** `StockPathError extends ViceError`, `stock-paths.ts:50-55` — `ViceError` is this codebase's base class (`CLAUDE.md` Errors convention); a subclass adds no new fields here, matching `StockAddressError`'s own precedent named in the same file's header.

---

### `src/mcp/vice/stock-machine.ts` — four handlers migrate off `withEmulatorSidePath()` (controller, request-response → file transfer)

**Analog:** the file's own current shape — `handleSnapshotSave`/`handleSnapshotLoad`, `stock-machine.ts:219-368`; `handleAutostart`/`handleDiskAttach`, `:104-201`. This is a same-file, same-function migration, not a new-analog situation.

**What every handler currently does that must change** (`stock-machine.ts:37`, the import to drop; `:133-135`, `:189-191`, `:258-261`, `:339-343`, the four `withEmulatorSidePath()` call sites):
```typescript
import { withEmulatorSidePath, snapshotPathFor, snapshotMetaPathFor, sanitizeSnapshotName } from "./stock-paths.ts";
// ...
const { sentPath } = await withEmulatorSidePath("vice_autostart", containerPath, (hostPath) =>
  session.client.send(CommandType.AutoStart, autostartBody({ runAfter: run, fileIndex: index, filename: hostPath })),
);
return stockAnswer(session.client, { path: containerPath, sentPath, run, index });
```
This import and all four call sites are what the convergence metric (D-18, 6 → 4) counts dropping. `stock-paths.ts` itself is untouched (D-13/D-18: `sanitizeSnapshotName()`/`snapshotPathFor()`/`snapshotMetaPathFor()` are KEPT — the client-side name/path owner survives per D-13; only `withEmulatorSidePath` and the `STOCK_EMULATOR_SIDE_PATH_TOOLS` import are dropped from this file).

**What replaces the dropped import:** `dialFileTransfer()` from `broker-endpoint.ts` (new) plus the streaming write/read helpers from `broker-transfer.mts`/`transfer-hash.ts` (new) — for upload (`vice_autostart`, `vice_disk_attach`: `resolve(path)` stays unrestricted per D-14, `createReadStream(containerPath)` streams to the broker) and for download (`vice_snapshot_save`'s result, `vice_snapshot_load`'s source: staged bytes stream back and land under `.c64-re-tools/snapshots/` via the atomic-publish pattern below).

**Result shape change — `sentPath` becomes the opaque handle** (D-15): every `stockAnswer(session.client, { ..., sentPath, ... })` call in the four handlers replaces `sentPath` (a broker-side path) with a handle field (an opaque token) — same object-literal shape, different value/field name (`handle` is the vocabulary `broker-endpoint.ts:583-586`'s own `DialMonitorRelayOptions.handle` already uses; reuse the name for continuity rather than inventing a new one).

**D-16's accepted-loss wording lands in `handleDiskAttach`'s result** (`stock-machine.ts:192-197`, the `approximation` field's own existing pattern is the template — `DISK_ATTACH_APPROXIMATION` is an exported string constant so a pinning test derives its expectation from the constant, never re-typing the sentence; the same shape applies to a new exported constant naming D-16's write-loss).

**`toolsDir()`-rooted client write target** (`repo-root.ts:282-284`, quoted verbatim — the root every downloaded file's local write target is a subdirectory of):
```typescript
export function toolsDir(opts: RepoRootOptions = {}): string {
  return join(repoRoot(opts), ".c64-re-tools");
}
```
Snapshots currently land at `join(toolsDir(), "snapshots", ...)` (`stock-paths.ts:181-183`) — this phase's downloaded-bytes write path reuses that same per-kind subdirectory convention, not a new top-level directory.

---

### `src/mcp/vice/broker-launch.mts` — D-08's vicerc relocation (service, file-I/O)

**Analog:** itself, `broker-launch.mts:511-554`, the exact block to edit:
```typescript
let spawnOptions: SpawnOptionsWithoutStdio | undefined;
let logLine = `vice-broker: launching ${viceBin} ${viceArgs.join(" ")}`;
if (backend === "stock") {
  const scratchConfigDir = mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"));
  spawnOptions = { env: { ...process.env, XDG_CONFIG_HOME: scratchConfigDir } };
  logLine += ` (XDG_CONFIG_HOME=${scratchConfigDir})`;
}
```
Change: `tmpdir()` → a directory under `brokerHome()` (`broker-home.mts:95-100`'s `brokerHome()` export — already exists, already host-bound, no new import boundary crossed). The header comment immediately above (`:537-544`, "Scratch-dir lifetime: this function deliberately does NOT clean the directory up ... If reaping them is ever worth doing, the broker's own kill/recycle path is the component that would own it") must be rewritten in the SAME change per D-08 — it becomes actively misleading once `broker-kill.mts` grows the reap described below.

**Build-artifact coupling:** `broker-launch.mts` is in `build.ts`'s `HOST_BOUND_ARTIFACTS` array (`build.ts:47`) — the regenerated `resources/broker-launch.mjs` ships in the same commit, or `resources-sync.test.ts` fails CI.

---

### `src/mcp/vice/broker-kill.mts` — D-08's live-pid-guarded vicerc reap + XFER-07's staging sweep (service, event-driven/batch)

**Analog:** `reapOrphanedInstances()`, `broker-kill.mts:556-634`, and `verifiedKill()`, `:126-180` — this is the load-bearing analog the research pass flagged as unread; it is now read and is the correct template for BOTH D-08's vicerc reap and the staging-directory startup sweep (XFER-07/D-07), because it already implements exactly "enumerate on-disk records, act on each only where a liveness check licenses it, log the found/killed counts including the zero case, never throw past one record's own failure":
```typescript
export async function reapOrphanedInstances(options: ReapOrphanedInstancesOptions): Promise<ReapResult> {
  const kill = options.kill ?? verifiedKill;
  const log = options.log ?? defaultLog;
  const basePort = resolveBasePortForReap(options.basePort);
  const listInstanceDirs = options.listInstanceDirs ?? defaultListInstanceDirs;

  const ports = listInstanceDirs(options.stateDir);
  let found = 0;
  let killed = 0;
  for (const port of ports) {
    if (port < basePort) continue;
    const epochFields = readExistingEpochFieldsMaybe(options.epochPathFor(options.stateDir, port));
    const pid = epochFields?.pid;
    if (typeof pid === "number" && Number.isFinite(pid) && pid > 0) {
      const expectedIdentity = typeof epochFields?.vice_bin === "string" ? epochFields.vice_bin : "";
      if (expectedIdentity === "") {
        log(`vice-broker: startup reap -- port ${port} records pid ${pid} but no vice_bin ...`);
      } else {
        found++;
        const stage = await kill({ pid, expectedIdentity });
        if (stage === "sigterm" || stage === "sigkill") killed++;
      }
    }
    bumpEpochForInstanceDir(options, options.stateDir, port);
  }
  log(`vice-broker: startup reap found ${found} process(es) in the emulator port band, terminated ${killed}`);
  return { found, killed };
}
```

**Identity-verified kill, the live-pid guard D-08 makes mandatory** (`broker-kill.mts:126-180`, `verifiedKill()` — a vicerc dir's reap must check "is the pid this dir's record names still alive AND still running the SAME binary" before removing the dir, exactly this function's `isAlive`/`expectedIdentity` posture, not a bare `existsSync`/`rmSync`):
```typescript
export async function verifiedKill({ pid, expectedIdentity, deps = {} }: VerifiedKillOptions): Promise<KillStage> {
  const isAlive = deps.isAlive ?? defaultIsAlive;
  // ... pid-reuse-aware identity check before any signal ...
}
```

**D-08's two-opposite-lifetime-rules constraint (do not violate):** a vicerc scratch dir must survive as long as its emulator's pid is alive (guard with `isAlive`, mirroring `verifiedKill`'s own check, BEFORE removing); a staged upload directory (D-06) must NOT survive past its session's close — its trigger is the session-close EVENT (Phase 63's `SESS-03`/`SESS-04`), not a pid check at all. Write two reap passes (or one function with two clearly separated branches) inside this module — never one shared rule applied to both, per D-08's own explicit prohibition.

**XFER-07's startup-only staging sweep** reuses this same file's "enumerate on-disk directories under a root, log found/removed including the zero case" shape, called once at broker startup alongside (not instead of) `reapOrphanedInstances()` — a session-scoped `<VICE_BROKER_HOME>/staging/<session>/` directory with no matching live session record is removed unconditionally (no pid check needed here, since a staging dir is not itself a process).

---

## Shared Patterns

### Never-throw, never-string-decode-a-payload-byte boundary
**Source:** `broker-relay.mts:1-29` (header), `broker-control.mts:940-952` (Buffer-carry comment), `broker-endpoint.ts:629-638` (`performAttach()`'s own doc comment)
**Apply to:** `broker-endpoint.ts`'s new dial function, `broker-control.mts`'s new dispatch arm, `broker-transfer.mts`, `transfer-hash.ts` — every module that touches a byte on either side of the header-line terminator.
```typescript
// The ONE string decode permitted anywhere in this call chain: the header
// line itself, strictly before its own 0x0a terminator.
const lineText = carry.subarray(0, idx).toString("utf8");
const payloadBytes = carry.subarray(idx + 1); // raw Buffer, NEVER decoded, from here on
```

### Handle-only authority on a stateless, non-owning connection (D-01, T-63-01)
**Source:** `broker-control.mts:1360-1363` (comment) + `:1366-1396` (arm)
**Apply to:** `broker-control.mts`'s new transfer dispatch arm.
The transfer connection is never checked with `ownsTarget()`; the broker-minted handle (D-04/XFER-04, minted the same way `monitorClients[channel].handle` is — `broker-state.mts:168-171`, `node:crypto randomBytes`-derived, 16-byte random hex) is the only authority it can present. Ownership is checked ONCE, on the command connection that requested the transfer, using the SAME `ownsTarget()` predicate every other target-naming op uses (`broker-control.mts:1030-1032`).

### Atomic publish — temp write, then same-filesystem `renameSync`
**Source:** six sites, all read this session or the prior research pass: `broker-epoch.mts:96-104`, `broker-incident.mts:222`, `vice-broker.mts:349`, `anno-store.ts:1469` (`publishSnapshot()`), `anno-store.ts:2668`, `anno-export-asm.ts:2390`
**Apply to:** the client-side write of any downloaded file (`vice_snapshot_save`'s result under `.c64-re-tools/snapshots/`), and the broker-side staged-file publish after upload.
```typescript
const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
writeFileSync(tmpPath, "");           // broker-epoch.mts's own two-step: create, then chmod/fill
// ... stream bytes into tmpPath, verify digest+length against the header ...
renameSync(tmpPath, finalPath);       // same filesystem, never EXDEV
// on any failure before renameSync: rmSync(tmpPath, { force: true }) -- never leave a
// half-written file visible at its final name (criterion 3)
```

### Detect, then refuse by name with the remedy in the message
**Source:** `CLAUDE.md`'s own standing convention, applied throughout this codebase (e.g. `stock-machine.ts:178-184`'s unit-9-11 refusal, `stock-paths.ts:162-166`'s snapshot-name refusal)
**Apply to:** the size-cap refusal (XFER-06: name the 16 MiB limit and the observed size), the containment-validator refusal (XFER-03: name which rule the candidate violated), the transfer-op dispatch refusals (bad `target_id`/`handle`, matching the `attach` arm's own `bad_request` messages).

### Ephemeral test ports, never the literal `19510`
**Source:** `broker-endpoint.test.ts:78`, `broker-control.test.ts:173,1672,2432`
**Apply to:** every new test file this phase writes (Pitfall 6 in `64-RESEARCH.md` — a machine-level broker is now an *expected* background process, so a test dialling the real port collides with it).
```typescript
const listener = await startControlListener({ port: 0, host: "127.0.0.1", ...opts });
const assignedPort = listener.port; // read back, never assumed
```

### DI-stub session, no mocking library
**Source:** `stock-machine.test.ts:1-60`, `makeSession()`
**Apply to:** any new/extended test of `stock-machine.ts`'s four handlers.
```typescript
function makeSession(responder?: (commandType: number, body: Buffer) => unknown): { session: StockConnectSession; sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  const emitter = new EventEmitter();
  (emitter as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    sends.push({ commandType, body });
    return responder ? responder(commandType, body) : undefined;
  };
  // ...
}
```
Note: `stock-machine.test.ts` already stubs `isInsideContainer()` false via `setIsInsideContainerForTest()` from `stock-paths.ts` — once the four handlers stop importing `stock-paths.ts`, this stub call is dropped from the test file too (do not leave a dangling import of a function the module under test no longer needs).

## No Analog Found

None outright — every file has at least a role-match analog. The one item worth flagging
explicitly for the planner:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `transfer-hash.ts`'s `Transform` body (the composition of streaming `Hash` + cap-check inside `_transform`) | utility | transform/streaming | No in-repo streaming precedent exists at all (confirmed by a repo-wide grep this phase's research already ran and this agent did not need to repeat). The two *halves* being composed each have a precedent (`createHash("sha256")` one-shot at `host-tool.mts:2269-2283`; `Stream.pipe()`'s backpressure guarantee is *cited*, never used, by `broker-relay.mts`'s header) — implement per Node's own documented `Transform` contract, not by pattern-matching a sibling file that does not exist yet. |

## Metadata

**Analog search scope:** `src/mcp/vice/` only (per phase directory scope) — `broker-endpoint.ts`,
`broker-control.mts`, `broker-relay.mts`, `broker-launch.mts`, `broker-kill.mts`,
`broker-state.mts`, `broker-home.mts`, `stock-machine.ts`, `stock-paths.ts`, `host-tool.mts`,
`repo-root.ts`, `anno-store.ts`, `anno-export-asm.ts`, `broker-epoch.mts`, `vice-broker.mts`
(grep only), `broker-incident.mts` (grep only), `stock-machine.test.ts`,
`broker-endpoint.test.ts`, `broker-control.test.ts`.
**Files scanned:** 19 read/grepped directly this session (in addition to the ~15 the phase's
own research pass already read, whose citations are reused rather than re-fetched where the
line ranges were already quoted verbatim in `64-RESEARCH.md`).
**Pattern extraction date:** 2026-09-23
**Confirmed open items from research, now resolved:**
- `stock-machine.test.ts` **exists** (16.7 KB, `src/mcp/vice/stock-machine.test.ts`) and already
  covers all four migrating handlers with a DI-stub session pattern — extend it, do not
  replace it, and drop its `setIsInsideContainerForTest()` stub once the handlers stop
  importing `stock-paths.ts` for that purpose.
- `broker-kill.mts` **read this session** — `reapOrphanedInstances()` (`:556-634`) and
  `verifiedKill()` (`:126-180`) are the concrete D-08/XFER-07 sweep analogs the research pass
  named only by file, not by function.
