# Phase 65: Every Skill Script Through the One Endpoint, and CI With It - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 27 (create/modify), grouped into 9 clusters
**Analogs found:** 25 / 27 (2 in "No Analog Found" — genuinely new mechanism)

This phase touches an unusually wide file set (14-module host-tool seam +
5 anno-bearing skills + CI). Every file below is either named explicitly in
`65-CONTEXT.md`'s `<canonical_refs>` or is a structurally required sibling
(a `.test.ts` beside a module it censuses, a `resources/*.mjs` mirror beside
a `.mts` source) per this project's own conventions. Files CONTEXT.md leaves
to "Claude's Discretion" (the wire-op name, the `<kind>` directory names, the
staging lifetime) are marked accordingly — the planner picks the concrete
shape; this map only supplies the closest existing precedent for each shape.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/broker-endpoint.ts` (new host-tool dial fn + staging-mint dial) | service (dial primitive) | request-response | itself: `dialFileTransfer()` (`broker-endpoint.ts:1044-1116`) | exact — same file, same shape, new function |
| **NEW** `src/mcp/vice/host-tool-cli.mts` (or equivalent compiled CLI-entry counterpart — SEAM-02 fix) | CLI entry / utility | request-response (subprocess) | `build.ts`'s dual-ship pattern; `transfer-hash.mts` → `resources/transfer-hash.mjs` | role-match — new file, established dual-ship convention |
| `src/mcp/vice/host-tool-client.ts` (route collapse) | service (dispatcher) | request-response | itself, `hostToolOverControlPlane()` (lines 144-262) vs. `hostToolOverHostRoute()` (271-314) | exact — same file, branch removed |
| `src/mcp/vice/broker-control.mts` (new pre-gate `host_tool`/staging-mint arm(s)) | controller (wire-op dispatch) | request-response | itself: `attach` arm (1361-1421), `transfer` arm (1433-1483) | exact — same file, sibling arm |
| `src/mcp/vice/host-tool.mts` (D-03 handle-naming, D-08 outDir removal, D-10 result shape, D-06 sourceDir removal) | service (host-bound executor) | file-I/O | itself: `resolveWorkspacePath()` (1137-1155), `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS` (254-370) | exact — same file, same tables |
| `src/mcp/vice/host-tool.test.ts` (D-08 outDir census, D-06 sourceDir census) | test | — | itself: "both directions" census test (line 3421) | exact |
| `src/mcp/vice/build.ts` `HOST_BOUND_ARTIFACTS` / `src/mcp/vice/tsconfig.build.json` `include` | config | — | itself, `HOST_BOUND_ARTIFACTS` array (build.ts:43-60) | exact |
| `src/mcp/vice/resources-sync.test.ts` (drift gate, unchanged mechanism, wider artifact set) | test | — | itself, existing drift assertion | exact |
| `src/skills/acme-build/scripts/acme.mjs` | utility (skill CLI) | request-response | itself: `invokeSeam()` (lines 46-81), `HOST_TOOL_CLIENT_FILE` const (line 37) | exact — same file, filename constant + outDir flag change |
| `src/skills/c64-disk-access/scripts/c1541.mjs` | utility (skill CLI) | request-response | `acme.mjs`'s `invokeSeam()`/ladder usage (near-identical shape) | exact — sibling skill script |
| `src/skills/c64-petcat/scripts/petcat.mjs` | utility (skill CLI) | request-response | `acme.mjs`'s ladder usage | exact — sibling skill script |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` | utility (skill CLI) | request-response | `acme.mjs`'s ladder usage | exact — sibling skill script |
| `src/mcp/vice/ghidra-run.ts` (D-06 sourceDir removal, D-03 handle inputs) | service (same-package caller) | request-response | itself, value-import of `runHostToolFromContainer()` | exact |
| `src/mcp/vice/dxa-run.ts` (D-03 handle inputs) | service (same-package caller) | request-response | itself, value-import of `runHostToolFromContainer()` | exact |
| `src/mcp/vice/vice-proxy.ts` (delete `ANNO_TOOL_DEFINITIONS` registration loop, D-13) | controller (MCP tool registration) | request-response | itself: the loop at line 1608, `import` at 173 | exact — same file, deletion |
| `src/mcp/vice/anno-tools.ts` (likely deleted or trimmed, D-13) | service | request-response | itself — the module being removed as a live import | exact |
| `src/mcp/vice/anno-cli.ts` (unchanged mechanism, D-12) | CLI / service | request-response | itself — already the CLI verb dispatcher `vice-cli.mjs`'s `anno` branch reaches | exact — no shape change, only reachability |
| `src/mcp/vice/stock-dispatch.test.ts` (anno_* exception narrows/drops) | test | — | itself, line ~1472 `proxyToolRegistrations()` / anno exception assertion | exact |
| `src/skills/c64-memory-mapping/SKILL.md` (14 `anno_*` refs → CLI) | doc (machine-read) | — | `src/skills/acme-build/SKILL.md:161`'s existing `anno export-asm` CLI line | role-match — wording form exists, invocation form (D-14) must change |
| `src/skills/c64-program-recon/SKILL.md` (20 `anno_*` refs → CLI) | doc (machine-read) | — | same file's own existing `anno render-memmap`/`anno export-asm` lines (277, 362) | role-match |
| `src/skills/routine-queue-walker/SKILL.md` (11 `anno_*` refs → CLI) | doc (machine-read) | — | `acme-build/SKILL.md:161` CLI-line precedent | role-match — no CLI line exists in this file yet |
| `src/skills/acme-build/SKILL.md` (2 `anno_*` refs → CLI, + D-02 broker prerequisite, + D-08 usage line) | doc (machine-read) | — | itself: line 161 (anno CLI form), `c64-ram-capture/SKILL.md:45-49` (Prerequisite convention) | exact / exact |
| `src/skills/c64-provenance-diff/SKILL.md` (2 `anno_*` refs → CLI) | doc (machine-read) | — | `acme-build/SKILL.md:161` CLI-line precedent | role-match |
| `src/skills/c64-disk-access/SKILL.md`, `src/skills/c64-petcat/SKILL.md`, `src/skills/c64-program-recon/SKILL.md` (D-02 broker prerequisite + D-08 usage-line updates) | doc (machine-read) | — | `c64-ram-capture/SKILL.md:45-49` (Prerequisite convention) | exact |
| `installer/scripts/sync-skills.mjs` (no code change — mirrors SKILL.md edits) | utility (build/sync) | file-I/O | itself, unchanged | exact (no-op consumer) |
| `.github/workflows/ci.yml` (remove/rework the three ACME-touching steps per D-01) | config (CI workflow) | — | itself, the "Install ACME" / "Assemble the acme-build scaffold" / "Test" steps (lines ~45-205) | exact — same file |
| **NEW** per-suite ephemeral-broker test harness helper (D-01, Wave 0 gap) | test utility | process spawn / event-driven | `broker-e2e.test.ts`'s `startBroker()` + `waitForBrokerJson()` (lines ~77-170) | role-match — pattern exists per-file, needs extraction/reuse across suites |
| `src/mcp/vice/skill-acme-build-cli.test.ts` (`hostRouteChildEnv()` disposition, D-01 harness) | test | — | itself: `hostRouteChildEnv()` (lines 84-89), `acme-gate.ts`'s loud-failure gate | exact |
| `src/mcp/vice/broker-e2e.test.ts` (disconnect-while-queued polling fix, folded todo) | test | — | itself: `waitFor(() => !isAlive(pidBefore), 5000)` (lines 432, 868, 1287, 1298) vs. the defective elapsed-time form (line 1058) | exact — same file, same helper, different predicate |
| `src/mcp/vice/vice-proxy.test.ts` (correct the stale `ci-guardrails.test.mjs` citation, line 207) | test (comment only) | — | itself | exact |

## Pattern Assignments

### `src/mcp/vice/broker-endpoint.ts` — new host-tool dial function (SEAM-03) and session-free staging-mint dial

**Analog:** `dialFileTransfer()` in the same file (`broker-endpoint.ts:1044-1116`), and `awaitTransferComplete()` (`:1199-1173+`).

**Core dial pattern** (`broker-endpoint.ts:1044-1082`):
```typescript
export function dialFileTransfer(options: DialFileTransferOptions): Promise<DialFileTransferResult> {
  const port = options.port ?? resolveEndpointPort();
  const candidates = options.candidates ?? DIAL_CANDIDATES;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
  const connectFn = options.connect ?? connect;
  const clientVersion = options.clientVersion ?? CLIENT_VERSION;

  return new Promise<DialFileTransferResult>((resolveOuter) => {
    // race every DIAL_CANDIDATES entry, keep the first completed handshake,
    // destroy the losers — see dialOneCandidate()/performTransfer() in the
    // same file for the full race shape.
```

**Completion-signal pattern, never a client-side poll** (`broker-endpoint.ts:1119-1138`, header comment): the broker's own reply line on the SAME connection is the only valid "done" signal — no `existsSync` poll, no sleep, no retry, at any call site. Any new host-tool dial or staging-mint dial must follow this exact discipline (it fixed a real 0x8f race, `.planning/debug/vice-0x8f-disk-attach-snapshot-load.md`).

**Do not build a second dialer.** `broker-endpoint.ts`'s own header (SEAM-01) forbids it by name, citing `mcpHost()`'s three-copy incident. A new host-tool dial function belongs in this SAME file, reusing `DIAL_CANDIDATES`, `resolveEndpointPort()`, and the same candidate-race shape `dialFileTransfer()`/`dialMonitorRelay()` already establish.

---

### **NEW** compiled CLI-entry counterpart for `host-tool-client.ts` (Critical Finding 1 / SEAM-02)

**Problem this file solves:** `host-tool-client.ts` is plain `.ts`, resolved on ladder rung 3 (`require.resolve()` against `@henols/vice-mcp/host-tool-client.ts`) and spawned via `process.execPath <resolved> run ...` by all four skill scripts. Node refuses to type-strip any `.ts` file whose resolved path contains a `node_modules` segment (measured, `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, no override flag). D-14 scopes the fix to these four skill scripts only.

**Analog — the dual-shipped module pattern, already established twice:**

1. `transfer-hash.mts` (raw source, in `package.json`'s `files[]`) → `resources/transfer-hash.mjs` (compiled, listed in `build.ts`'s `HOST_BOUND_ARTIFACTS`, `build.ts:58`). Container-side code imports the `.mts` raw source (`stock-connect.ts:83`); host-bound code imports the compiled `.mjs` (`broker-transfer.mts:60`).
2. `host-tool.mts` → `resources/host-tool.mjs` (`build.ts:52`) — the executor itself already follows this shape.

**Build-list pattern to extend** (`build.ts:43-60`):
```typescript
export const HOST_BOUND_ARTIFACTS: string[] = [
  "vice-broker.mjs",
  "container-guard.mjs",
  "broker-state.mjs",
  "broker-launch.mjs",
  "broker-kill.mjs",
  "broker-epoch.mjs",
  "broker-control.mjs",
  "backend-detect.mjs",
  "host-tool.mjs",
  "ghidra-project.mjs",
  "tool-location.mjs",
  "broker-home.mjs",
  "broker-relay.mjs",
  "broker-incident.mjs",
  "transfer-hash.mjs",
  "broker-transfer.mjs",
];
```
A new CLI-entry artifact name (e.g. `host-tool-cli.mjs`) is added here AND to `tsconfig.build.json`'s `include`, in the SAME commit — `build()`'s own emitted-file-set assertion (`build.ts:220-233`) fails loudly on a mismatch either way, so this is self-enforcing.

**Caveat the planner must resolve explicitly, not silently:** `host-tool-client.ts` imports `vice-broker-client.ts`, `containerpath.ts`, `container-guard.mts` (already compiled) and `repo-root.ts` — none but `container-guard.mts` are currently `.mts`-sourced/compiled. Whatever the new CLI-entry source file is (a NEW `.mts` file, or `host-tool-client.ts` itself converted), its own import graph must resolve entirely inside `HOST_BOUND_ARTIFACTS` for `tsc` to emit a working `.mjs`. This is exactly the kind of "constraint outside the offered options" `65-CONTEXT.md` instructs the planner to record rather than silently absorb.

**The ladder's filename argument is the only thing that changes** (mirrors research's own conclusion) — see `mcp-module.mjs` pattern below; SEAM-02 forbids touching the ladder mechanism itself.

---

### `src/mcp/vice/host-tool-client.ts` — route collapse (SEAM-03)

**Analog:** the file's own two existing routes, `hostToolOverControlPlane()` (lines 144-262) and `hostToolOverHostRoute()` (lines 271-314), and `runHostToolFromContainer()` (338-361) which currently branches between them.

**Route-selection pattern to collapse** (`host-tool-client.ts:341-361`):
```typescript
export async function runHostToolFromContainer(
  tool: string,
  args: Record<string, unknown>,
  opts: RunHostToolFromContainerOptions = {},
): Promise<HostToolClientResult> {
  if (isInsideContainer()) {
    const raw = await hostToolOverControlPlane(opts.dir ?? brokerRootDir(), tool, args);
    return translateHostToolResponse(raw);
  }
  return hostToolOverHostRoute(opts.repoRoot ?? repoRoot({ from: HERE }), tool, args);
}
```
Target shape: always dial the fixed endpoint via `broker-endpoint.ts` (mirroring `hostToolOverControlPlane()`'s own request/response shape at lines 144-262 — the JSON-line-in, JSON-line-out pattern, connect+request two-timer split at lines 173-212), with `hostToolOverHostRoute()` left in the file, UNREACHABLE from this function, until Phase 66 deletes it (per "explicitly NOT in this phase").

**Response-translation pattern, unchanged** (`host-tool-client.ts:320-326`):
```typescript
function translateHostToolResponse(response: HostToolClientResult): HostToolClientResult {
  if (!response.ok) return response;
  return {
    ...response,
    results: response.results.map((result) => ({ ...result, path: containerPath(result.path) })),
  };
}
```
D-10's amended result shape (`{ path, sha256, byteLength }` no longer a broker-side path once results download via transfer) changes what `containerPath()` is translating, not whether this wrapper exists.

**CLI entry point, unchanged shape** (`host-tool-client.ts:386-434`): argv parsing (`--tool`, `--args`, `--repo-root`), one JSON line to stdout, exit 0/1 on `ok`. This is the shape the NEW compiled CLI-entry counterpart (above) must reproduce byte-for-byte in its own dispatch, since the four skill scripts' own invocation (`spawn(process.execPath, [resolved, "run", "--tool", tool, "--args", json, "--repo-root", repoRoot])`, `mcp-module.mjs`-resolved) is unchanged (SEAM-02).

---

### `src/mcp/vice/broker-control.mts` — new pre-gate `host_tool` arm and session-free staging-mint op

**Analog:** the `attach` arm (lines 1361-1421) and `transfer` arm (lines 1433-1483) in the SAME file — both already answered ahead of the token gate (line 1492-1497), both authorized by an opaque handle alone, neither calling `ownsTarget()`.

**Pre-gate positioning pattern** (`broker-control.mts:1320-1361`, header comment reproduced):
```
// Answered UNCONDITIONALLY, ahead of the token gate below -- BY DESIGN...
// `hello` is no longer the ONLY op this listener answers before the gate --
// `attach` and `transfer`, below, now join it (Phase 64 gap G-64-1, owner
// decision 5)...
if (req.op === "attach") {
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  const presentedHandle = typeof req.handle === "string" ? req.handle : "";
  if (targetId === "" || presentedHandle === "") {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "attach requires target_id and handle" });
    return;
  }
  ...
```

**Handle-only authorization pattern, no `ownsTarget()` call** (`broker-control.mts:1433-1483`, the `transfer` arm):
```typescript
if (req.op === "transfer") {
  const handle = typeof req.handle === "string" ? req.handle : "";
  const direction = resolveTransferDirection(req.direction);
  if (handle === "" || direction === "bad_request") {
    writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: 'transfer requires handle and direction ("upload" or "download")' });
    return;
  }
  // ...checked purely by `handle`, no targetId, no ownsTarget()
```

**Wire-op collision hazard (Pitfall 3, research-verified):** `ControlRequestKind` (`broker-control.mts:134`) already contains the literal `"host_tool"`, consumed by the LEGACY, post-gate, token-checked arm at line 1507:
```typescript
if (req.op === "host_tool") {
  opts
    .onHostTool(req)
    .then((result) => {
      if (!socket.destroyed) writeHostToolLine(socket, result);
    })
```
A new pre-gate arm placed earlier using the SAME `"host_tool"` literal would shadow the legacy arm entirely (top-to-bottom `if`-chain, exact-string dispatch). **The planner must pick and record a distinct wire vocabulary** (a new literal, e.g. `host_tool_stateless`, or a field-discriminator design checked before falling through) — this is Claude's Discretion per CONTEXT.md, not resolved here.

**Session-free staging mint:** `stage_file`'s existing shape (`onStageFile?: (targetId, slot) => StageFileOutcome`, gated by `ownsTarget(targetId)`) does NOT fit — a skill-script call is stateless (SESS-01), no `targetId`. The new minting op needs the SAME pre-gate, handle-only positioning as `attach`/`transfer` above, but a NEW callback signature that takes no `targetId`. `transfer`'s own dial primitive (`dialFileTransfer()`) is reusable UNCHANGED once a handle exists — only the minting step is new.

---

### `src/mcp/vice/host-tool.mts` — D-03 (handle-naming for inputs), D-08 (outDir removal), D-10 (result shape), D-06 (sourceDir removal)

**Analog:** the file's own `resolveWorkspacePath()` (lines 1137-1155) being replaced/paralleled by handle resolution, and the existing `outDir` census across `HOST_TOOL_ARG_KEYS`/`HOST_TOOL_PATH_ARG_KEYS` (lines 254-370).

**D-05's symlink-safe real-path pattern to reuse for the D-04 tree walk** (`host-tool.mts:1061-1100`, `realpathOfNearestExisting()`):
```typescript
function realpathOfNearestExisting(p: string): { ok: true; path: string } | { ok: false; message: string } {
  const resolved = resolvePath(p);
  const tail: string[] = [];
  let current = resolved;
  // ...walks up until an existing entry is found, then checks if it's a
  // dangling symlink, following up to MAX_SYMLINK_HOPS — the exact
  // "compare REAL paths, never lexical joins" lesson D-05 cites by name.
```
Its call site, `resolveWorkspacePath()` (`host-tool.mts:1137-1155`):
```typescript
export function resolveWorkspacePath(repoRoot: string, relative: string): ResolveWorkspacePathResult {
  if (typeof relative !== "string" || relative === "") {
    return { ok: false, message: `workspace path must be a non-empty relative string; got ${describe(relative)}` };
  }
  if (isAbsolute(relative)) {
    return { ok: false, message: `workspace path must be relative to the workspace root, not absolute: ${describe(relative)}` };
  }
  const rootAbs = resolvePath(repoRoot);
  const walkedRoot = realpathOfNearestExisting(rootAbs);
  ...
  const walkedCandidate = realpathOfNearestExisting(resolvePath(walkedRoot.path, relative));
```
D-05's symlink refusal for the uploaded tree walk (source dir + `-I` trees) must follow this SAME two-step "walk root, walk candidate, compare walked paths" shape, not a lexical prefix check.

**Refuse-unknown-key pattern already established for D-06/D-08's removals** (`host-tool.mts:584-589`, one of six near-identical `outDir` narrowing blocks — this exact shape is what gets DELETED, replaced by a refusal):
```typescript
if ("outDir" in argsObj) {
  const outDir = argsObj.outDir;
  if (typeof outDir !== "string" || outDir === "") {
    return { ok: false, message: `host_tool "acme.build" args.outDir must be a non-empty string; got ${describe(outDir)}` };
  }
  args.outDir = outDir;
}
```
D-08 replaces this with a refusal keyed on the KEY's presence (`normaliseHostToolRequest()`'s own "refuse unknown keys BY NAME" discipline, stated in this file's own header). D-08 touches SIX tool ids (`acme.build`, `dxa.disassemble`, `c1541.bam`/`dir`/`entry`/`chain`/`read`, `petcat.decode`) at THREE locations each (`HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS`, the per-id args type's own `outDir?: string` field) — enumerate via `grep -n "outDir" host-tool.mts` (57 hits measured this session) rather than relying on memory (Pitfall 5).

**D-06's `sourceDir` removal for `ghidra.installExtension`** follows the identical shape: `HOST_TOOL_ARG_KEYS["ghidra.installExtension"]` currently `["moduleName", "sourceDir"]` (asserted at `host-tool.test.ts:2972-2973`) loses `"sourceDir"`; the executor switches to the broker's own vendored extension tree.

**Byte-payload prohibition to amend (D-10)** — the file's own header (lines ~55-58, reproduced in canonical_refs as "`:64-65`"): clause one ("no inline bytes, only a handle") survives verbatim; clause two (the `{ path, sha256, byteLength }` shape where `path` is a broker-side path) must be rewritten to describe a downloadable handle instead.

---

### Skill scripts: `acme.mjs`, `c1541.mjs`, `petcat.mjs`, `packer-finding.mjs`

**Analog:** `acme.mjs` itself is the reference shape all three siblings already mirror near-identically.

**Ladder + invocation pattern, UNCHANGED mechanism, only the filename constant changes** (`acme.mjs:27-61`):
```javascript
import { resolveMcpModule, refusalMessage } from "../../c64-ram-capture/scripts/mcp-module.mjs";
...
const HOST_TOOL_CLIENT_FILE = "host-tool-client.ts";

function invokeSeam(tool, args, repoRoot) {
  return new Promise((resolvePromise) => {
    const resolved = resolveMcpModule(HOST_TOOL_CLIENT_FILE);
    if (!resolved.ok) {
      resolvePromise({ ok: false, message: refusalMessage(HOST_TOOL_CLIENT_FILE, resolved.rungs) });
      return;
    }
    const cliArgs = [resolved.path, "run", "--tool", tool, "--args", JSON.stringify(args), "--repo-root", repoRoot];
    let child;
    try {
      child = spawn(process.execPath, cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { ... }
```
If the SEAM-02 fix introduces a new compiled CLI-entry filename (e.g. `host-tool-cli.mjs`), the ONLY change in each of these four scripts is the `HOST_TOOL_CLIENT_FILE` constant's value — the ladder call, the spawn shape, and the response parsing (lines 63-80) stay exactly as-is (SEAM-02 forbids touching the ladder mechanism).

**D-08 outDir removal touches each script's own CLI surface too** — `acme.mjs:337`'s usage string, `c1541.mjs`'s six `--out-dir` usage lines (556-565), `petcat.mjs`'s usage lines (212-217), plus each script's own `o.outDir ? resolve(o.outDir) : dirname(imageAbs)` default-computation logic (e.g. `c1541.mjs:382-385`, `461-468`; `petcat.mjs:137-144`) — all removed together with the wire-level `outDir` argument, per D-08's own instruction to update every SKILL.md usage line and `acme.mjs:337`'s usage string in the SAME change.

---

### Anno CLI reachability (D-12/D-13) — `vice-proxy.ts`, SKILL.md files

**Analog:** `vice-proxy.ts`'s existing `ANNO_TOOL_DEFINITIONS` registration loop (`vice-proxy.ts:1608-1610`) is the thing being deleted:
```typescript
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
```
The import at line 173 (`import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";`) is removed in the same change. `stock-dispatch.test.ts:1472-1477`'s existing "curated anno_* absent from STOCK manifest" assertion and the `vice_result_continue`/`anno_*` transport-exception assertion cited in CONTEXT.md both need their anno half retired or rewritten.

**Existing CLI-form precedent already in SKILL.md, but in the BROKEN `npx -y` shape** (`acme-build/SKILL.md:161`, `c64-program-recon/SKILL.md:277,362`, `c64-ram-capture/SKILL.md:388`):
```
npx -y @henols/vice-mcp anno export-asm game.prg --store game.annostore --out game-src
npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json
```
Per D-14, this EXACT `npx -y @henols/vice-mcp anno ...` invocation form crashes today (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, `vice-cli.mjs` dynamically imports `vice-proxy.ts`, a raw `.ts`). D-14 is explicit that Phase 65 does NOT fix this route — every SKILL.md line touched by D-13's anno migration (all five skills) must use a form that runs TODAY instead: the in-repo/plugin invocation `.mcp.json` already uses successfully —
```json
"command": "node",
"args": ["${CLAUDE_PLUGIN_ROOT}/src/mcp/vice/vice-proxy.ts"]
```
— i.e. `node "$CLAUDE_PLUGIN_ROOT"/src/mcp/vice/vice-proxy.ts anno <verb> ...` (plugin route) or the in-repo-checkout equivalent, never the `npx -y` form, until a follow-up todo fixes the npm route.

**Machine-read prose discipline for the new prerequisite/CLI text** (CLAUDE.md "Machine-read prose", cited by D-02 and applicable to D-13's anno-line rewrites too): one instruction per sentence, active voice, no semicolons.

---

### `src/skills/{acme-build,c64-disk-access,c64-petcat,c64-program-recon}/SKILL.md` — D-02's broker prerequisite

**Analog:** `c64-ram-capture/SKILL.md:45-49`, the existing "Prerequisite:" convention:
```markdown
**Prerequisite: a resolvable project root.** `scripts/project-paths.mjs` uses
`C64RE_PROJECT_ROOT` when you set it, and otherwise walks up from the toolkit's
own location for the nearest ancestor directory containing a `.git` entry. A
scratch project has neither by default, so `git init` it first or set the
variable — the thrown error names both when this fails.
```
D-02's four SKILL.md edits follow this SAME heading shape (`**Prerequisite: ...**`), stating the broker as the prerequisite and reusing `describeDialFailure()`/`BROKER_START_COMMAND`'s EXISTING refusal wording (`broker-endpoint.ts:500,607-616`) — never a second, independently-worded refusal.

**Refusal text to cite verbatim, not reword** (`broker-endpoint.ts:500`):
```typescript
export const BROKER_START_COMMAND = "npx -y @henols/vice-mcp broker";
```
(Note: this ONE command is the `broker` subcommand — unaffected by Critical Finding 1, since `vice-cli.mjs broker` dynamically imports the already-compiled `resources/vice-broker.mjs`, confirmed working.)

---

### `.github/workflows/ci.yml` — D-01's per-suite broker harness replaces the three ACME steps

**Analog:** the file's own existing three steps (measured line ranges: "Install ACME" ~45-81, "Assemble the acme-build scaffold" ~83-122, "Test" ~143-192), all already parameterised by `VICE_REQUIRE_ACME: "1"`.

**Loud-failure gate pattern to extend for D-01's "harness broker that fails to start is a FAIL, never a skip"** — `acme-gate.ts`'s existing shape (full file read):
```typescript
export function acmeSkipReasonFor(testFileName: string): string | false {
  if (ACME_AVAILABLE) return false;
  return (
    `${testFileName}'s ACME-dependent tests are skipped -- no real ACME was found at ` + ...
  );
}

export function assertAcmeRequiredIfEnvSet(assertLib: typeof import("node:assert/strict")): void {
  if (process.env.VICE_REQUIRE_ACME) {
    assertLib.ok(
      ACME_AVAILABLE,
      `VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="${ACME_BIN}" -- a maintainer (and ` +
        `CI, which sets this) expects a hard FAIL, never a SKIP, when the binary is actually missing.`
    );
  }
}
```
D-01's harness-boot-required assertion should follow this EXACT shape (a never-skipped `test()` registered per importing file, gated on the SAME `VICE_REQUIRE_ACME` env var — not a new env var), reusing `acme-gate.ts` rather than writing a parallel gate for "the harness broker itself failed to boot."

**Per-suite ephemeral broker — the shared helper to extract:** `broker-e2e.test.ts`'s own `startBroker()`/`waitForBrokerJson()` (lines ~77-170, not fully reproduced here — read directly before extracting) is the ONLY existing precedent for "spawn the compiled broker artifact under bare node, `VICE_BROKER_CONTROL_PORT=0`, wait for `broker.json`, kill in teardown." D-01's own text says "no shared helper for this" exists yet (Wave 0 gap) — this file is the source to extract it FROM, not a fresh design. `VICE_BIN`/`VICE_ARGS` stubbed to `/bin/sleep` for a harmless real pid is this file's own established technique for getting a real spawned instance without touching `x64sc`.

**`hostRouteChildEnv()` disposition (Neighbouring cleanup, D-01):** `skill-acme-build-cli.test.ts:84-89`
```typescript
function hostRouteChildEnv(opts: { libraryFree?: boolean } = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (opts.libraryFree) env.ACME = "";
  delete env.CONTAINER_WORKSPACE_PATH;
  return env;
}
```
exists to keep a child on the (soon dormant) host route. Under D-01 the host route has no live caller — the planner must record what this helper (and its never-skipped contract test at lines 97-115) now protects, or retire it, in writing, per CONTEXT.md's explicit instruction.

**`ci-guardrails.test.mjs` does not exist (Pitfall 6, confirmed this session via `find`).** Only a stale comment at `vice-proxy.test.ts:207` cites it (`... ci-guardrails.test.mjs, which fails if that ledger and this file's actual state ever drift apart.`). `git log --all --oneline -- '**/ci-guardrails*'` names the deleting commit (`276c15c9`, "delete 43 non-qualifying tests and module-classification.ts"). The planner must correct this comment (treat it as a dangling citation) rather than plan a task that edits a file that is not there.

---

### `src/mcp/vice/broker-e2e.test.ts` — the folded `disconnect-while-queued` flake

**Analog:** the SAME file's own correct pattern used four other places (lines 432, 868, 1287, 1298):
```typescript
const gone = await waitFor(() => !isAlive(pidBefore), 5000);
```
**The defective pattern to replace** (line 1058, polls elapsed WALL-CLOCK TIME, then samples the real condition exactly once, OUTSIDE the poll):
```typescript
const disconnectedAt = Date.now();
await waitFor(() => Date.now() - disconnectedAt >= POLL_MS * 2 + 250, POLL_MS * 2 + 1000);

const portDirs = readdirSync(stateDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
assert.equal(portDirs.length, 1, ...);
```
**The fix, following the SAME file's own `waitFor()` helper (lines 62-69) correctly:**
```typescript
async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 25): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}
```
Move the `readdirSync(stateDir, ...).filter(...)` computation INSIDE the predicate passed to `waitFor()`, polling `portDirs.length === 1` directly instead of polling elapsed time and sampling once after.

## Shared Patterns

### Dual-shipped module (source + compiled), never a second copy
**Source:** `transfer-hash.mts` (raw, `package.json` `files[]`) / `resources/transfer-hash.mjs` (compiled, `build.ts:58`); `host-tool.mts` / `resources/host-tool.mjs` (`build.ts:52`).
**Apply to:** the new SEAM-02 compiled CLI-entry counterpart; any `.mts` edit this phase makes to `host-tool.mts`, `broker-control.mts`, `broker-endpoint.ts` (if it becomes host-bound) must regenerate its `resources/*.mjs` mirror in the SAME commit, verified by `resources-sync.test.ts`.

### Pre-token-gate, handle-only-authority op arm
**Source:** `broker-control.mts`'s `attach` arm (1361-1421) and `transfer` arm (1433-1483), both answered ahead of the token check at 1492-1497, both authorized purely by a broker-minted opaque `handle`, neither calling `ownsTarget()`.
**Apply to:** the new fixed-endpoint `host_tool` arm and the new session-free staging-mint op — SAME positioning, SAME handle-only check, but a DISTINCT wire-op literal from the legacy `"host_tool"` (Pitfall 3) and a NEW callback signature (no `targetId`) distinct from `onStageFile`.

### Refuse-by-name for a removed or unknown wire key
**Source:** `host-tool.mts`'s per-key narrowing blocks (e.g. lines 584-589, the `outDir` block reproduced above) and the file's own header discipline ("refuse unknown keys BY NAME, never coerce a type, never drop a key silently").
**Apply to:** D-06's `sourceDir` removal, D-08's `outDir` removal on six tool ids — a caller presenting either key gets a REFUSAL naming the key, never a silent drop.

### Refuse-not-sanitise destination/path validation, pure function, no fs access
**Source:** `transfer-paths.ts:83-103`, `validateContainedDestination()` — six ordered checks (NUL byte, empty, `.`/`..`, a `..` segment, `isAbsolute()`, any `/`/`\`), each REJECTING the whole candidate.
**Apply to:** D-07's first live wiring of this function (broker names each result's filename, client validates before writing under `transferKindDir(kind)`, `transfer-paths.ts:167-169`, itself just-added and currently callerless).

### Real-path (not lexical) symlink-escape confinement
**Source:** `host-tool.mts:1061-1100`, `realpathOfNearestExisting()`, and its call site `resolveWorkspacePath()` (1137-1155) — walks BOTH the root and the candidate to their real paths before comparing, per the project's own measured incident (a lexical prefix check was defeated by a planted symlink).
**Apply to:** D-05's tree-walk symlink refusal for `acme.build`'s uploaded source/`-I` trees.

### The one resolution ladder, never a second copy
**Source:** `mcp-module.mjs`'s `resolveMcpModule()`/`ladder()`/`refusalMessage()` (full file, 175 lines) — three rungs (`VICE_MCP_DIR` override, in-repo relative path, `require.resolve()` against `@henols/vice-mcp`), unchanged mechanism per SEAM-02.
**Apply to:** all four skill scripts (`acme.mjs`, `c1541.mjs`, `petcat.mjs`, `packer-finding.mjs`) — only the FILENAME argument passed to `resolveMcpModule()` may change (to whatever the SEAM-02 fix names its compiled CLI entry), never the ladder itself.

### Poll the real condition, never elapsed time then a single sample
**Source:** `broker-e2e.test.ts:62-69`'s own `waitFor(predicate, deadlineMs, pollMs)` helper, used correctly at lines 432/868/1287/1298 (`waitFor(() => !isAlive(pid), ...)`) and incorrectly at line 1058 (predicate checks elapsed time, not the real condition).
**Apply to:** the disconnect-while-queued fix (folded todo) AND any new D-01 per-suite broker harness test that waits for a broker to boot, a port file to appear, or a child to exit — always pass the REAL condition as the predicate.

### Loud-failure (never-silent-skip) gate under an explicit env var
**Source:** `acme-gate.ts` (full file) — `ACME_AVAILABLE` probed once at module load, `acmeSkipReasonFor()` for the normal SKIP path, `assertAcmeRequiredIfEnvSet()` registered as one never-skipped `test()` per importing file, gated on `VICE_REQUIRE_ACME`.
**Apply to:** D-01's "a harness broker that fails to start is a FAIL, never a skip, under `VICE_REQUIRE_ACME`" requirement — reuse this SAME env var and this SAME two-function shape (probe-once + never-skipped assertion), not a new gate module.

### Machine-read prose discipline for skill-facing text
**Source:** CLAUDE.md "Machine-read prose" (SKILL.md `description:` frontmatter, tool `description` strings, refusal `reason` strings) — one instruction per sentence, active voice naming the actor, no semicolons, a list for 3+ conditions.
**Apply to:** every SKILL.md edit this phase makes: D-02's four broker-prerequisite additions, D-13's ~49 `anno_*` → CLI reference rewrites across five skills, D-08's outDir-removal usage-line rewrites.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Session-free staging-mint control op (new callback shape, `onStageFile`'s sibling with no `targetId`) | controller (wire-op) | request-response | `stage_file`'s existing shape is fundamentally session-scoped (`ownsTarget(targetId)`); no existing broker op in this codebase mints a handle with ZERO session context. The closest precedent (`attach`/`transfer`'s handle-only CHECK, not MINT) is cited above as the authorization-model analog, but the mint step itself is genuinely new — Critical Finding 2 in 65-RESEARCH.md. |
| Real-`npm install`-of-tarball EXECUTION test (SEAM-02 Wave 0 gap) | test | integration | `prerequisites.test.ts`'s `packedFileList()` (lines 705-709) only runs `npm pack --dry-run --json` (a file-LIST proof, no real install, no execution). No existing test in this tree performs a genuine `npm install` of the packed tarball into a fresh `node_modules` and then EXECUTES a resolved file — this is the gap Critical Finding 1 names explicitly, and the 64-g641-state-dir-agreement evidence (cited by research as the closest prior attempt) itself used a plain scratch directory rather than a literal `node_modules` path, so it could not have caught this. Build this test from scratch, following `prerequisites.test.ts`'s general `execFileSync("npm", [...], { cwd: HERE })` invocation style as the nearest available shape, not as a direct analog. |

## Metadata

**Analog search scope:** `src/mcp/vice/**/*.ts`, `src/mcp/vice/**/*.mts`, `src/skills/**/*.mjs`, `src/skills/**/SKILL.md`, `.github/workflows/ci.yml`, `build.ts`/`tsconfig.build.json`.
**Files scanned (read or grepped this session):** `broker-endpoint.ts`, `host-tool-client.ts` (full), `host-tool.mts` (targeted), `broker-control.mts` (targeted), `transfer-paths.ts` (full), `transfer-hash.mts` (cited via research), `build.ts` (full), `mcp-module.mjs` (full), `acme.mjs`/`c1541.mjs`/`petcat.mjs`/`packer-finding.mjs` (targeted greps), `vice-proxy.ts` (targeted), `vice-cli.mjs` (targeted), `.mcp.json`, `acme-gate.ts` (full), `skill-acme-build-cli.test.ts` (targeted), `broker-e2e.test.ts` (targeted, incl. `waitFor()` definition and all 13 call sites), `host-tool.test.ts` (targeted greps), `stock-dispatch.test.ts` (targeted), `vice-proxy.test.ts` (targeted), `ci.yml` (targeted), five SKILL.md files (targeted greps), `c64-ram-capture/SKILL.md` (targeted).
**Pattern extraction date:** 2026-09-25
