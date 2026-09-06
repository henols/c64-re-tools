# Architecture Research

**Domain:** Integrating a frame-exact emulator stop and a dxa + Ghidra-headless analysis
pipeline into an existing, mature container-in / host-out MCP architecture
**Researched:** 2026-09-02
**Tree state:** every `file:line` below was read at HEAD `36f8c7c` — see § Citation Ledger
**Confidence:** HIGH on integration points and guard breakage (read from the tree);
MEDIUM on the frame-exact mechanism (reasoned from settled protocol constraints, not
probed this session); LOW on Ghidra-in-CI cost (nothing probed)

---

## Executive Answer

Four findings reframe the question before any of (a)–(e) is answered. Each is read from
the tree, not inferred.

1. **`vice-sync.ts` has zero importers anywhere in the repository.** `grep -rn 'from
   "./vice-sync'` over `src/mcp/vice/*.ts` and `*.mts` returns exactly one hit —
   `vice-sync.test.ts:22` — and `grep -rn "vice-sync\|runToCheckpoint\|waitCheckpointHit"
   src/skills/` returns nothing. It is in `package.json`'s `files[]` (line 13) and is
   pinned into the 5-member host-path consumer set (`hostpath-consumers.test.ts:144`), but
   no live tool call reaches it. Its two invariants are **doctrine carried by comment
   citation** across at least five sibling modules, not behaviour on any hot path.
   *Consequence:* "both invariants must survive" does not mean "edit `vice-sync.ts`
   carefully". It means every new wait is written against the same two rules, in the
   idiom of the module it lives in.

2. **The live stock wait already ports invariant 1 into a stock-native form, and already
   supersedes invariant 2.** `stock-run-until.ts:6` — "resumes the machine exactly once,
   waits **event-driven** for THAT checkpoint's own `CHECKPOINT_INFO`" — with its own
   header at `:26-27` naming `vice-sync.ts`'s rule by quotation. There is no polling at
   all, so "poll on `hit_count`, never on paused state" is satisfied *a fortiori*: it
   waits on the checkpoint's own event, keyed by checkpoint id, never on paused state.
   This is the precedent the frame-exact stop follows.

3. **The frame arithmetic is already built.** `stock-timing.ts` holds
   `readCycleBaseline()` (`:274` — Route A reads `CPUHISTORY_GET`'s newest entry's
   monotonic uint64 `cycle`, exact for any bracket on VICE ≥ 3.10; Route B reconstructs
   from `LIN`/`CYC` and refuses across a proven frame boundary),
   `resolveVideoStandard()` (`:147`), `VIDEO_STANDARDS` with `cyclesPerLine` /
   `screenLines` per standard (`:70-73`), and `positionWithinFrame()` (`:200`). A frame
   index is `absoluteCycle / (cyclesPerLine * screenLines)` over values this module
   already produces. Nothing new has to be measured to *compute* a frame.

4. **The measured nondeterminism was measured on the fork, and the fork's stop is
   asynchronous by construction.** The todo's table is fork evidence: "The fork's
   stopping exec checkpoint reports its hit but pauses roughly a frame later, at a
   wall-clock-determined instruction." CLAUDE.md records, from stock source, that a
   stock checkpoint is evaluated **synchronously from inside the CPU loop**
   (`mon_breakpoint.c:557-562`, `mon_breakpoint_event()` called before `cp->stop` is
   checked). Those are different stop mechanisms with different determinism properties,
   and **no measurement of the stock stop's frame reproducibility exists in this
   repository.** *Consequence:* step zero of the frame-exact phase is a re-measurement on
   stock. It may find the capability already present, or already one refinement away.

The rest of this document answers (a)–(e) on those four facts.

---

## System Overview — where the two new subsystems attach

```
┌──────────────────────── CONTAINER SIDE (or host, undifferentiated) ─────────────────┐
│                                                                                      │
│  Claude Code / MCP client                                                            │
│         │ stdio JSON-RPC                                                             │
│         v                                                                            │
│  vice-proxy.ts  ── tools/list from manifest, tools/call dispatch                    │
│    ├─ manifest loop ──> buildBackendAwareTool ──> forwardToVice() :2985             │
│    │                                                 │ rewriteArguments() :3050      │
│    │                                                 v                               │
│    │                                            vice.ts call() :697                  │
│    │                                            DENY_LIST :201                       │
│    ├─ RESULT_CONTINUE_TOOL ──> buildViceTool  (bypass #1)                            │
│    └─ anno_* loop :3388     ──> buildViceTool  (bypass #2)                           │
│                                    │                                                 │
│                                    v                                                 │
│                              anno-store.ts openStore() :432   ── .annostore           │
│                              (the ONE node:sqlite namer)                             │
│                                                                                      │
│  vice-broker-client.ts ── { op:"acquire", id, token } :372 / :867                    │
│         │                                                                            │
└─────────┼────────────────────────────────────────────────────────────────────────────┘
          │  TCP control channel, newline-JSON, MAX_LINE_BYTES = 65536
          │  (broker-control.mts:242) · per-boot token, tokensMatch() :267
          v
┌──────────────────────── HOST SIDE ──────────────────────────────────────────────────┐
│  vice-broker.mjs (compiled from .mts by build.ts, deployed to <root>/tools)          │
│    broker-control.mts handleLine() :508 ── flat if/else over ControlRequestKind :30  │
│    broker-launch.mts  buildViceArgs() :153 · maintainWarmFloor() :953 · inFlight :78 │
│    vice-broker.mts    selectWarmInstance() :473 · handleRelease() :929               │
│    broker-kill.mts    verifiedKill() :126 · uncaughtException -> kill+exit :367-374  │
│         │                                                                            │
│         v                                                                            │
│    x64sc  (stock binary monitor  |  fork -mcpserver)                                 │
│                                                                                      │
│  ┌── NEW in v0.8.0 ────────────────────────────────────────────────────────────┐     │
│  │  dxa (vendored C, pinned, built)      Ghidra analyzeHeadless (JVM)          │     │
│  │        │                                     │                              │     │
│  │        └── code/data map ───────────────────>│ pre-script: volatile carve   │     │
│  │                                              │ post-script: DecompInterface │     │
│  │                                              v                              │     │
│  │                                    program.json / .asm / .c  (host FS)      │     │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## (a) Where the frame-exact stop lives

### The three candidate homes, and which is wrong

| Candidate | Verdict | Why |
|-----------|---------|-----|
| Edit `vice-sync.ts` | **Wrong home** | Zero importers (finding 1). Editing it changes no behaviour and cannot be tested — its five emulator-dependent primitives are five machine-visible `todo` entries at `vice-sync.test.ts:107-143`, deliberately. It is the doctrine document. |
| New sibling in the stock family, next to `stock-run-until.ts` | **Right home for the mechanism** | `stock-run-until.ts:145` (`handleRunUntil`) already owns the live stopping-checkpoint wait, already resumes exactly once, already waits event-driven on `CHECKPOINT_INFO` (`waitForCheckpointHit()` at `:113`), and already reuses `stock-timing.ts`'s cycle primitives' sibling pattern. |
| `buildViceArgs()` + the acquire protocol | **Only if the mechanism is launch-time** | That is the full structural cost the headless todo already priced. See below. |

### The mechanism, and why it probably is not launch-time

**Recommended primary mechanism — cycle-aligned refinement, entirely runtime.**

```
1. arm stopping exec checkpoint at addr          (existing: stock-run-until.ts:244)
2. one resume, wait for CHECKPOINT_INFO          (existing: :113, invariant 1 preserved)
3. read absolute cycle                           (existing: readCycleBaseline() :274)
4. compute frame index + intra-frame position     (existing: positionWithinFrame() :200,
                                                    VIDEO_STANDARDS :70-73)
5. advance to the next frame boundary            (existing wire op: ADVANCE_INSTRUCTIONS
                                                    0x71, advanceInstructionsBody()
                                                    stock-protocol.ts:751; handler
                                                    stock-execution.ts:257)
6. re-read cycle; assert landed position         (new: the alignment assertion)
```

Steps 1–5 are existing code. Only step 6 and the loop around 5 are new. This mechanism
needs **no launch flag, no acquire-frame field, and no warm-floor change**, which is
decisive: it sidesteps the entire structural blocker the headless todo documents.

**Why not VICE event record/replay.** It is launch-time (`-eventstart` / `-eventplayback`),
so it drags in every cost the headless todo enumerates — a mode field on the acquire
frame, mode-aware warm-instance eligibility, a launch-mode field on `InstanceRecord`, and
a decision about what `maintainWarmFloor()` pre-warms. It also cannot be retrofitted to a
warm instance, so `selectWarmInstance()` (`vice-broker.mts:473`) would hand a
record/replay-requesting caller a plain interactive instance silently — the one outcome
the todo says to rule out. Recommend against it as the primary mechanism, and re-evaluate
only if the re-measurement in step zero shows the cycle-aligned refinement cannot close
the gap.

**Two hard preconditions on the recommended mechanism, both from settled constraints.**

- **VICE ≥ 3.10 for Route A.** `CPUHISTORY_GET` (0x86) does not exist on 3.9 —
  Debian trixie/forky/sid and all current Ubuntu ship 3.9. Route B (`LIN`/`CYC`) is exact
  only *within* one frame and refuses across a proven boundary
  (`stock-timing.ts:15-18`), which is precisely the measurement a frame-exact stop needs.
  So on 3.9 the honest answer is a **named refusal**, matching `capability-registry.ts`'s
  established idiom (Rule A7), not a degraded guess. Do not "guess a `+ k * cyclesPerFrame`
  correction" — `stock-timing.ts:30-31` forbids it by name.
- **`default_memspace` contamination breaks step 5 outright.** CLAUDE.md's settled
  constraint: a drive checkpoint hit sets `default_memspace` (`monitor.c:3393-3396`) and
  nothing resets it, after which `ADVANCE_INSTRUCTIONS` steps the **drive** CPU. Since
  `buildViceArgs()` emits `-drive8type 1541` unconditionally on stock
  (`broker-launch.mts:202`), drive emulation is always live. Any alignment loop built on
  `ADVANCE_INSTRUCTIONS` must therefore either prove no drive checkpoint was ever armed in
  the session, or fail closed. This is the single most likely silent-wrong-answer in the
  whole mechanism.

### The invariants, restated as obligations on the new module

| Invariant | How it survives | Where it is checked |
|-----------|-----------------|---------------------|
| Exactly one resume per wait | Step 2 resumes once; steps 5's `ADVANCE_INSTRUCTIONS` is a step, **not** a resume — it is opcode 0x71, not `EXIT`/run. State this in the module header the way `stock-run-until.ts:26-27` states it. | Header prose + a unit assertion counting `CommandType.Exit` sends, which `stock-run-until.test.ts` already establishes as an idiom |
| Poll on `hit_count`, never on paused state | Do not poll. Wait event-driven on `CHECKPOINT_INFO`, keyed on request-id-first demux (Rule A8) — `CHECKPOINT_INFO` (0x11) shares a response type with a legitimate command reply, noted at `stock-run-until.ts:79` | The demux is already guarded; the new module inherits it by using `session.client.send()` |
| Never delete a VICE-marked `temporary` checkpoint | `stock-run-until.ts` arms a temporary checkpoint and takes a **different cleanup action on each of three paths** (hit / timeout / restarted) — only the timeout path deletes (`:20-24`). Copy that shape; do not add an undifferentiated `finally { delete }`. | `stock-run-until.test.ts` |

### The tool-surface decision, and the cheap route

Two ways to expose it, with very different guard costs:

- **Cheap (recommended): an optional `align` argument on the existing `vice_run_until`.**
  SKILL-01 permits exactly this — "stock may add optional parameters but never removes,
  retypes, or newly-requires one" — and `manifest-arg-compat.test.ts` is the guard that
  encodes it. No new tool name, no change to the 38 or 62 counts, no new manifest entry,
  no new registration line in `vice-proxy.ts`. On the fork the argument refuses by name.
- **Expensive: a new `vice_frame_stop` tool.** Reddens `stock-dispatch.test.ts:1167` and
  `:1173-1174` (the table's key count is asserted `=== 38` three ways) and requires a
  `tools-manifest.stock.json` entry plus a regenerated `docs/tool-support.md`. Only take
  this if the semantics genuinely cannot ride `vice_run_until`.

**Do not create a third proxy-local family for it.** `stock-dispatch.test.ts:1510` pins
`BACKEND_SEAM_BYPASS_KEYS = ["RESULT_CONTINUE_TOOL.name", "annoDef.name"]` in an
**order-sensitive** `deepEqual`, with its own comment at `:1508-1509`: "A THIRD entry
collides here rather than being absorbed into a superset." That is a deliberate speed
bump, not a bug.

### If headless *is* also wanted (it is a separate, additive concern)

The guard shapes prescribe the design. `broker-launch.test.ts:1761`, `:1773-1776` and
`:1787-1797` are three whole-argv `assert.deepEqual` assertions; `:1799` and `:1806` are
ordering assertions written to *survive* additions. So:

- The mode must be an **optional field that defaults to absent**, so the no-mode argv
  stays byte-identical and all three `deepEqual` assertions keep passing unchanged. This
  also preserves the fork's byte-identical-argv promise (a Validated v0.2.0 requirement).
- `InstanceRecord` already has the exact precedent: `remoteMonitorPort?: number` at
  `broker-state.mts:142`, whose own comment (`:117-127`) says "Optional — additive, same
  convention as every field group above". Add `launchMode?` the same way.
- Any new flag goes **after** `-default` (index 0, or `-drive8type` is silently clobbered
  back to its compiled-in value — `broker-launch.mts:182-192`).
- **Warp is not a launch dimension.** The premise was corrected and verified live on
  2026-08-27 against `/usr/bin/x64sc`: the text monitor's `warp on` / `warp off` works,
  and `broker-launch.mts:213` already appends `-remotemonitor` on every stock launch with
  the port recorded at `broker-state.mts:142` — and **nothing in the tree dials it.** Warp
  is a runtime operation on an existing, allocated, unused channel.

---

## (b) Where a JVM-scale host tool executes — three architectures, costed

### Shared constraints all three must satisfy (read from the tree, not assumed)

| Constraint | Source | Consequence |
|-----------|--------|-------------|
| 64 KiB hard line cap, socket `destroy()`ed on overflow with no error frame | `broker-control.mts:242`, `:376` | Megabyte exports **cannot** ride the socket inline in any option. Overflow is indistinguishable from a connection drop. |
| Any unhandled throw in the broker process kills the whole VICE pool | `broker-kill.mts:367-374` (`uncaughtException` / `unhandledRejection` → `run(…, 1)`) | Host-tool work runs in a **child process**, never inline, in all three options. Non-negotiable. |
| Single-threaded event loop | broker is plain Node | A multi-minute synchronous run would stall acquires, the warm floor and monitor claims. Async spawn only. |
| The connection IS the lease | `broker-control.mts:388-397` — `socket.on("close")` fires `onRelease` when `requestIdForThisConnection` is set | A host-tool connection must be routed **before** any lease-bearing path and handed a deps object containing none of the seven VICE callbacks (`broker-control.mts:145-180`). |
| `ControlRequestKind` is a byte-exact-pinned 7-member union | type at `broker-control.mts:30`; guard at `broker-control.test.ts:877-890` asserts the **exact declaration string** | Adding *any* op is a reviewed decision that reds a committed guard. Identical cost in all three options — this is not a discriminator. |
| Wire skew between separately-deployed halves | `build.ts` → committed `resources/*.mjs`, deployed by `install-resources.ts` into `<root>/tools` | A running broker can be older than the client dialing it. The 7 unprefixed ops cannot be renamed. |

### Option B1 — widen the existing `host-tool-executor` seam to cover stateful tools

| | |
|---|---|
| **NEW** | `host-tool-exec.mts` (host-side, child-spawning executor) + its compiled `resources/host-tool-exec.mjs`; a container-side `host-tool-client.ts`; a typed per-tool allowlist (seed constraint 5); a token-discovery route for skill scripts (seed constraint 3) |
| **MODIFIED** | `broker-control.mts` (`ControlRequestKind` + a namespace-prefixed branch at the top of `handleLine()` `:508`, before the token gate at `:528` reads lease state); `build.ts`'s `HOST_BOUND_ARTIFACTS` (`:42-50`, exact-set assertion); `package.json` `files[]`; `acme.mjs` + `packer-finding.mjs` (the seed's retroactive scope) |
| **Cost** | The seed's own framing is *stateless, short-lived open/send/close*. Ghidra is a JVM with a persistent project directory, a multi-minute run and a megabyte export. Widening the seam to cover it means the same seam now carries two lifetime models — the exact "half-migrated seam is the state that rots" failure the seed argues against, applied to itself. |
| **Benefit** | One seam, one grep gate banning `spawnSync` of an external binary in `src/skills/*/scripts/`, one token-discovery answer, four cheap first consumers (`petcat`, `c1541`, `cartconv`, `acme`) get a home. |

### Option B2 — a leased Ghidra subsystem alongside the VICE pool

| | |
|---|---|
| **NEW** | A second pool manager reusing `inFlight`'s shape (`broker-launch.mts:78-93`, `:373-378`, `:452-457`), `verifiedKill()` (`broker-kill.mts:126`), a persisted `ghidra.json` mirroring `broker.json` (`vice-broker.mts:239`, `:965`), and a fragile no-retry probe mirroring `vice-probe.ts:51`'s 1500 ms budget; a `ghidra.*` op namespace |
| **MODIFIED** | `broker-control.mts` (union + dispatch + a second deps object); `broker-kill.mts` (a second kill-and-exit subject); `build.ts` artifact set; `host-scripts.test.ts` if a launch wrapper is a `.sh` |
| **Cost** | **The lease has no subject.** A VICE instance is leased because it is a *stateful long-lived process with one binary-monitor client* (Rule A10). Phase 23's own recorded `analyzeHeadless` command line used `-deleteProject` — the project directory is created and destroyed per run. If the project dir is derived deterministically from the image content hash and deleted at the end, there is **no cross-call state to lease**. Building the lease machinery for a stateless-between-runs subsystem is the most expensive of the three and buys the least. |
| **Benefit** | Real if — and only if — a *warm* Ghidra JVM is later wanted to amortise JVM startup across many runs. That is a measured optimisation, not a starting design. `.planning/ARCHITECTURE.md`'s Rule A21 is the dated record of this project already choosing a long-lived child once and reversing it on measured grounds; its reversal condition ("if per-call open/close is measured to be the dominant cost") is the right bar here too. |

### Option B3 — filesystem handoff, control messages only over the socket

| | |
|---|---|
| **NEW** | A container-side `ghidra-run.ts` that sends one control request and reads a *path*; the pre-script and post-script as committed `.java` files; the SLEIGH extension as committed `.slaspec`; a container-side importer for the export |
| **MODIFIED** | `broker-control.mts` (union + one namespaced op returning `{ ok, outPath, logPath, exitCode }`, all far under 64 KiB); `install-resources.ts`'s deploy set (**by walk, no code change** — see below); `hostpath.ts` / `containerpath.ts` consumer set |
| **Cost** | The path must be translated in both directions (`hostPath()` at `hostpath.ts:209`, `containerPath()` at `containerpath.ts:151`), which reddens `hostpath-consumers.test.ts:144` — a reviewed 5-member set. Requires the shared mount to actually exist; on a host-native install (this repo's own common case, per seed constraint 7) it is a no-op. |
| **Benefit** | **This is what the seed's own constraint 2 already prescribes**: "Bulk results must be written to a file host-side and returned as a path (translated back through `containerpath.ts`)". And it is what the pivot prototype already *did* — `ExportAnalysis.java:13` writes via `PrintWriter(new FileWriter(...))`; `autoannotate2.mjs:1-3` reads it with `readFileSync`. Primary evidence from an executed run, not a design sketch. |

### Recommendation

**B3 for the artifact, B1's namespace for the control message.** Not a compromise — the
two options answer different questions. Ghidra's statefulness is a *host filesystem* fact
(a project directory), not a *protocol* fact, so it needs no lease; its bulk output is a
*file*, so it must not ride the socket. What remains on the socket is a short request and
a short reply, which is exactly the shape the host-tool executor was designed for. Take
B1's seam and namespace, add `ghidra` and `dxa` as named ops with typed argument shapes
(never argv passthrough — seed constraint 5), and let the answer be a path.

**One unexpectedly clean delivery channel, verified.** `install-resources.ts` deploys
`resources/` to `<root>/tools` by a **recursive walk** (`:99-114`), explicitly so "a file
added under `resources/lib/` later deploys with no code change here" (`:96-98`). And
`resources-sync.test.ts` scopes its byte-identity comparison to
`GENERATED_EXTENSIONS = [".mjs"]` (`:34`), with its own comment at `:30-32`: "everything
else (the shell scripts, `lib/`) is hand-authored and outside the comparison set BY
CONSTRUCTION". So a committed `.java` post-script or a `.slaspec` under `resources/` is
**auto-deployed host-side and outside resources-sync's scope** — an existing, tested,
container→host file-delivery channel with no new mechanism. Caveat: a `.sh` there *is*
caught, by `host-scripts.test.ts:202-209`.

**Reject B2's lease for now, and record the reversal condition** the way Rule A21 records
its own: reintroduce a leased warm JVM only if per-run JVM startup is *measured* to
dominate a real analysis session.

---

## (c) Where the recovered facts land

### The two candidates

- **(i)** Ghidra post-script writes `program.json` / `analysis.json`; a container-side
  importer reads it into `.annostore`.
- **(ii)** The post-script writes into the store directly.

### Option (ii) is structurally unavailable, on this project's own rules

| Rule | How (ii) violates it |
|------|----------------------|
| Single seam per concern | `anno-seam.test.ts` asserts `node:sqlite` is named by **exactly one** module of the shipped set (`THE_ONE_SEAM = "anno-store.ts"`, `:28`), with a *second* declared list for test files precisely because "outside the scope of the guard is how a dependency spreads unnoticed" (`:33-46`). A Java SQLite writer is outside every guard's scope entirely — not a violation the guard catches, a violation it cannot see. |
| Confinement | `openStore()` (`anno-store.ts:432-450`) refuses a store path outside `workspaceRoot` **before** resolution and long before `new DatabaseSync`, and its escape hatch is deliberately named `unconfinedModuleDerivedPath` so a grep finds it. `anno-confinement.test.ts:5-13` records a real escape reproduced through a symlink. A Java writer would have to re-implement that, plus the narrowest-range-wins paint index (proven exact at all 65,536 addresses against an independent oracle), plus the revert journal. |
| Container-in / host-out | The store lives container-side; the JVM runs host-side. (ii) requires the `.annostore` file itself on a shared mount, writable by a host process — inverting the split and making the store's durability guarantee (proven across a real `SIGKILL` in a separate OS process) a claim about two processes in two languages on two sides of a mount. |

### Option (i) is right, and its drift objection has a structural answer

The todo's own sharpest question is whether `program.json` "should be an intermediate at
all, or whether … making `.asm` a rendering of the store rather than a third parallel
output that can drift from it." The answer is a role assignment, not a file-count
decision:

| Artifact | Role | Drift risk |
|----------|------|-----------|
| `program.json` (Ghidra export) | **Transient evidence** of one run, with a recorded content hash. Never read after import. Belongs in the evidence tree, not a deliverable set. | None — it is not a model, so nothing can drift *from* it |
| `.annostore` | **The one authoritative model.** Every fact the importer accepts becomes a store row. | n/a |
| `program.asm` | A **rendering of the store**, via the already-shipped `anno export-asm` (EXPORT-01..03, under a real-ACME byte-diff oracle) | None — derived on demand |
| `program.c` | Decompiler output. **Not a model and not derivable from the store.** Keep it as evidence beside `program.json`, with the same hash discipline. | None, provided nothing reads it back as input |

That preserves the three-output *contract* the proposal contributes (its genuinely new
idea) while destroying the drift hazard: two of the three outputs are evidence, one is a
rendering, and the model is the store.

**The importer is cheap, and this is the one surface that is extensible without a guard
fight.** The `anno_*` tool count is deliberately **not** pinned — `anno-tools.test.ts:208`
and `anno-derivation.test.ts:477` both assert only `ANNO_TOOL_DEFINITIONS.length > 0`.
Adding tools flows through the existing single registration loop at `vice-proxy.ts:3388`,
so it adds **no** entry to `BACKEND_SEAM_BYPASS_KEYS` and keeps MCP-02 satisfied by
construction. (Observation: `ANNO_TOOL_DEFINITIONS.length` reads **19** at HEAD, where
`PROJECT.md` says 18 — a stale prose count, not a guard failure, since nothing pins it.)

**Two obligations the importer inherits, both from Phase 23's measured evidence.**

1. `analyzeHeadless` **exits 0 even when a post-script throws**. The importer must grep
   the run log for `ERROR REPORT SCRIPT ERROR` or every assertion built on its output is
   worthless. This belongs in the *importer*, container-side, not in the post-script.
2. Cross-references must carry their access kind (`READ` / `WRITE` / `READ_WRITE` /
   `COMPUTED_JUMP`) — the pivot's own three decisive facts are all kind-bearing. The
   store's `STORE-06` cross-reference union already produces a sorted de-duplicated list;
   the import must not flatten kind out on the way in.

---

## (d) Suggested build order, with the dependency edges named

```
  P-A  Frame-exact stop                    P-B  Snapshot 64K extraction
       (re-measure on stock first)              (.vsf C64MEM slice, method proven)
         │                                        │
         │  ── both feed ──>  P-C  Real-corpus capture ── the substrate
         │                          │
         │                          │   [gate: pre-committed go/degrade/no-go rules,
         │                          │    committed to git BEFORE any measurement]
         v                          v
  P-D  Host-tool executor seam  ──> P-E  dxa vendored + map parser
       (B1 namespace + child-proc)         (DXA-01..03)
                                            │
                                            │ dxa's map is what makes Ghidra
                                            │ work at all — 0 functions, 0 code
                                            │ bytes with zero hints
                                            v
                                     P-F  SLEIGH extension
                                          (OPC-01..03; source already exists,
                                           766 lines, docs/undocumented-opcodes-ghidra.md)
                                            │
                                            │ MUST precede the acceptance run
                                            v
                                     P-G  Ghidra harness + volatile carve
                                          (GHID-01..05; control observed RED)
                                            │
                                            v
                                     P-H  Importer: export -> .annostore
                                            │
                                            v
                                     P-I  Automatic annotation join
                                          (AUTO-01..07)
                                            │
                                            v
                                     P-J  PROOF-01..03 on real cracked code
```

### Edges, each named

| Edge | Why it is real |
|------|----------------|
| P-A → P-C | The frame-exact stop is "the single gate" on securing a corpus. Without it two runs of the same release diverge at 201 multi-bit addresses, measured snapshot-to-snapshot with no transcription anywhere. |
| P-B → P-C | Removes the *other* capture blocker (hex transcription lost a 32 KB write to truncation and an 8 KB write to ten dropped characters). Method already validated against `danish_r2_handoff.vsf`. Independent of P-A — **can run in parallel.** |
| P-D → P-E, P-D → P-G | Both engines are host binaries. Reaching them by `spawnSync` from a skill script is the recorded prohibition, and two skill scripts already violate it (`acme.mjs:124`, `packer-finding.mjs:247,306`). Building the executor after the engines means writing the violation twice and migrating it. |
| P-E → P-G | Load-bearing, and the strongest edge in the graph: Ghidra alone with zero hints produced **0 functions and 0 code bytes** on the pivot fixture. "The map from dxa is not an optimisation; it is what makes Ghidra work at all on a headerless 6502 image." |
| P-F → P-G's acceptance run | Explicitly sequenced by the roadmap: GHID-04's acceptance is "structural facts recovered from *real cracked code*", which "is not honestly claimable while 105 opcode bytes are undecodable, because crack and packer code is exactly where that gap bites." Integration of P-F is cheap (the SLEIGH source exists in full); its *verification* needs P-G's harness, which is why they stay in one phase group with F ahead of G's acceptance. |
| P-G → P-H | Nothing to import until the export exists. |
| P-H → P-I | AUTO-01's criterion reads annotations back **out of the store**, not out of the pipeline's stdout. |
| P-C → P-J | PROOF-01..03 are "real measurements on real cracked code rather than `could-not-run`". |

### Two ordering choices worth arguing explicitly

- **P-A's first task is a measurement, not an implementation.** Re-measure two runs on
  the **stock** backend before writing any alignment code. Finding 4: the recorded
  divergence is fork evidence, and stock's checkpoint fires synchronously from inside the
  CPU loop. This could collapse P-A to a verification phase, or narrow it to step 6 alone.
  Building the refinement loop first and then discovering it was unnecessary is the
  avoidable version of this — and it is the same failure class this project has recorded
  six times: an internal check standing in for an external one.
- **P-D before P-E/P-G, not after.** Tempting to inline `spawnSync("dxa", …)` "just for
  the measurement phase" and migrate later. The seed's own rationale refuses it: "a
  half-migrated seam is the state that rots, and a retroactive migration is what makes the
  rule mechanically enforceable." The grep gate that bans the pattern can only be written
  once nothing violates it.

---

## (e) Guards and tests that will go red

Ordered by how surprising the breakage is. "Mechanical" = update the pinned set in the
same commit that changes the subject. "Reviewed decision" = the guard exists to force an
argument, and papering over it is the defect.

### Reviewed decisions — the guard is the point

| Guard | Location | Trips on | Note |
|-------|----------|----------|------|
| `ControlRequestKind` byte-exact declaration | `broker-control.test.ts:877-890` (subject: `broker-control.mts:30`) | **Any** new control-plane op — `dxa.*`, `ghidra.*`, `tool.*` | Asserts the exact union string with the message "the union must be exactly … plus plan 05's `monitor_claim`/`monitor_release`". Unavoidable in all three (b) options. |
| `BACKEND_SEAM_BYPASS_KEYS` — 2 entries, order-sensitive | `stock-dispatch.test.ts:1510` | A third proxy-local tool family registered via `buildViceTool()` | Its own comment: "A THIRD entry collides here rather than being absorbed into a superset." **Avoid by extending `ANNO_TOOL_DEFINITIONS` instead of adding a family.** |
| `EXPECTED_IMPORTERS` — 5-member host-path consumer set | `hostpath-consumers.test.ts:144` | Any new module importing `hostpath.ts` — i.e. anything translating a Ghidra/dxa artifact path | Header `:15-24`: "Widening the five-member list below is a REVIEWED DECISION, not a mechanical fix for a failing test." Also forbids adding any `STOCK_DERIVED_TOOLS` member to it. |
| `EXPECTED_EMULATOR_SPAWN_SITES` — exactly 1 entry | `spawn-seam.test.ts:263-297` | **A trap:** the discovery predicate matches `\bbinPath\b` (`EMULATOR_BIN_SHAPE` at `:179`, `identNamesEmulatorBinary()` at `:191`). A host-tool executor that writes `spawnSync(binPath, [...])` for *Ghidra* is discovered as an "emulator spawn site" and reds the `=== 1` assertion at `:293-295`. | Avoid by naming the local something else (`toolPath`, `ghidraPath`), or widen the set deliberately. |
| `MANUAL_ONLY_TESTS` — exactly nine files | `test-gate.test.ts:16` | A new live suite (live Ghidra, live frame-exact) not added to the list | Consequence: it silently runs in `test:automated` and fails on any machine without Ghidra. |

### Mechanical, but easy to miss

| Guard | Location | Trips on |
|-------|----------|----------|
| Whole-argv `assert.deepEqual` × 3 | `broker-launch.test.ts:1761`, `:1773-1776`, `:1787-1797` | Any unconditional new launch flag. **Avoidable**: an optional field defaulting to absent keeps all three green, and `:1799`/`:1806` are written to survive additions. |
| Fork argv byte-identity | `broker-launch.test.ts:1761` | Any change to the fork branch — this is a Validated v0.2.0 promise, not just a test |
| `HOST_BOUND_ARTIFACTS` — exact emitted set | `build.ts:42-50`; drift checked by `resources-sync.test.ts` | A new host-bound `.mts` (`host-tool-exec.mts`, a ghidra launcher). `build()` **throws** on an unexpected or missing artifact; the committed `resources/*.mjs` must be rebuilt and committed in the same change. |
| `EXPECTED_TRACKED_SHELL_SCRIPTS` — repo-wide `git ls-files -- *.sh`, 5 entries | `host-scripts.test.ts:202-220` | **Any** new `.sh` anywhere in the tree — a dxa `build.sh`, a `analyzeHeadless` wrapper. Repo-wide set equality; nothing scopes it to `src/`. |
| `REAL_VERBS` + skill-documentation coverage | `anno-verb-coverage.test.ts:53`, scanning **both** `src/skills/` and `installer/skills/` (`:227`) | A new CLI verb (`anno import-ghidra`, `dxa map`) undocumented in either skill tree |
| `check-skill-tool-coverage.mjs` | `scripts/check-skill-tool-coverage.mjs` | Its allowlists are designed to "SHRINK BY FAILING": `PENDING_LATER_PHASE` entries are asserted **absent** from the stock manifest, so landing one fails until the stale entry is deleted |
| `check-skill-cli-invocations.mjs` | `scripts/` | A documented invocation whose arguments do not actually work (29-REVIEW.md CR-04) |
| `shippedTsModules()` throws on a `files[]` entry missing from disk | `shipped-modules.ts:151-162`; `shipped-modules.test.ts:55` | Adding a module to `files[]` before it exists, or renaming without updating it. Cascades into every structural guard that scans the shipped set. |
| `scripts/check-npm-packages.mjs` leak checks | `:92-105` — `node_modules/`, `*.test.*`, `fixtures/`, `test-corpus.mjs` | Committing Ghidra/dxa **fixtures** under `fixtures/`. Vendored C source under `vendor/` is *not* caught — decide `files[]` membership deliberately. |
| `ci-suite-coverage.test.ts` | whole file | A committed test file in a directory with no matching step in `ci.yml`'s `build` job. A new `vendor/dxa/` or Ghidra script test dir needs a CI step in the same commit. |
| `docs-deferred-ledger.test.ts` — fails in **both** directions | `:101`, `:116` | Resolving the frame-exact / headless / vsf / Ghidra-proposal todos without moving their `STATE.md` Deferred Items rows, and vice versa |
| `docs-linerefs.test.ts` | reads CLAUDE.md | Any edit shifting `vice-proxy.ts`'s `rewriteArguments()` call sites. Verified correct at HEAD: `:3050` / `:2985` / `:1529` / `:1505`. **Note the historical pattern** — these citations were stale twice before, and the second time only because the guard read CLAUDE.md and not `PROJECT.md`'s copy. Adding an interception near `forwardToVice()` shifts all four. |
| `docs-dangling-refs.test.ts` | whole file | A shipped string literal naming a phase number. Phase 23's evidence scripts are `ExportAnalysis23.java` / `FlatVolatile.java` — **rename on promotion out of `.planning/phases/`**; the guard is scoped to normative documents, but the naming habit is the hazard. |
| `absorbed-answer-key.test.ts` | reads `.planning/phases/11-*/evidence/` with no existence guard | Any phase archival. Independently recorded: phase dirs accumulate by design. |
| `audit-integrity.test.ts` | `:28` cites `vice-sync.ts`'s untested waits by name | Retiring or restructuring `vice-sync.ts` |

### A stale claim this milestone must correct, and what correcting it costs

`capability-registry.ts:280-286` states, inside `vice_machine_config_set`'s reason: "warp
on stock is a launch-time flag, not a resource that can be toggled while running." That
was **refuted live** on 2026-08-27 (`warp` / `warp on` / `warp off` all answered on stock
3.9's text monitor). `docs/tool-support.md:54` reproduces the sentence verbatim because it
is **generated** from the registry, under a byte-identity drift guard
(`tool-support-table.test.mjs`). So the correction is one commit touching two files —
registry text plus regenerated table — and skipping the regeneration reds the drift guard.

### Two known-red baselines to establish before trusting any run

- **Stop the broker first.** A live broker reddens the BACK-05 assertion
  deterministically. That is not a flake, and a phase measuring against a live-broker run
  will read a false baseline.
- **Use `npm run test:automated`, not `npm test`.** The whole-glob run does not terminate
  unaided (`vice-proxy.test.ts` leaks two LISTEN sockets), and `test:automated` skips the
  nine `MANUAL_ONLY_TESTS`. The clean floor for `test:automated` is **0** failures.

---

## Anti-Patterns specific to this integration

### Anti-Pattern 1: Putting the frame-exact stop behind `vice.ts`'s `call()`

**What people do:** implement the alignment loop as a helper called from behind `call()`.
**Why it's wrong:** MCP-02. `rewriteArguments()` runs at `vice-proxy.ts:3050`, inside
`forwardToVice()` (`:2985`) and before `call()`. Anything behind `call()` receives
host-translated paths. The alignment loop takes no paths *today*, which is exactly how
this becomes a latent bug the day someone adds a snapshot-on-align argument.
**Do this instead:** live in the stock family (`stock-dispatch.ts`'s
`withDerivedTool(...)`), or ride `vice_run_until`'s existing dispatch. Never a new
proxy-local family (`stock-dispatch.test.ts:1510`).

### Anti-Pattern 2: Running the JVM inline in the broker process

**What people do:** `await spawn(...)` the analyser from a control handler.
**Why it's wrong:** two independent failures. `broker-kill.mts:367-374` turns any
unhandled throw into kill-and-exit for the **entire VICE pool** — a Ghidra bug becomes a
lost capture in flight. And the single-threaded loop stalls acquires, the warm floor and
monitor claims for the run's whole multi-minute duration.
**Do this instead:** a child process, async spawn, its failure a response frame.

### Anti-Pattern 3: Letting the export ride the socket

**What people do:** return `program.json` inline as newline-JSON.
**Why it's wrong:** `MAX_LINE_BYTES = 65536` (`broker-control.mts:242`) and overflow
`destroy()`s the socket at `:376` **with no error frame** — client-side it is
indistinguishable from a connection drop, i.e. from a wedge. This fails in production on
the first real image, not in testing on the fixture.
**Do this instead:** write host-side, return a path, translate through
`containerpath.ts:151`.

### Anti-Pattern 4: Writing the structural export against `DataTypeManager`

**What people do:** the obvious Ghidra-scripting route.
**Why it's wrong:** measured on the pivot fixture, `getAllComposites()` and
`getDefinedData()` return essentially nothing on 6502. `DecompInterface` yields the index
bound, the split-pointer `CONCAT11` idiom and the record stride directly. Recorded as "the
single most expensive mistake available in this design."
**Do this instead:** `DecompInterface`, with a committed control asserting the
`DataTypeManager` route returns essentially nothing, so the mistake cannot be re-made
silently.

### Anti-Pattern 5: Asserting the volatile carve is present

**What people do:** a test that checks `setVolatile(true)` was called.
**Why it's wrong:** the failure is silent — Ghidra deletes hardware writes as dead stores
with no warning. Measured on `bank.a`: three of four `$01` writes and a `$d020` write
eliminated under defaults. An assertion that the fix is present proves nothing about
whether it is *measuring* the deletion.
**Do this instead:** a control that removes the flag and observes the writes
*disappearing* — red without the fix, green with it. Set it via `mem.getBlock(addr)` +
`setVolatile(true)` on the **existing** block; creating a conflicting block throws
`MemoryConflictException` and drops the whole run back to non-volatile.

### Anti-Pattern 6: Trusting a green `analyzeHeadless` exit code

**What people do:** check `exitCode === 0`.
**Why it's wrong:** it exits 0 even when a post-script throws. Recorded in Phase 23's
`instrument-provenance.txt` alongside two siblings: it **refuses** a project directory
containing a dot-prefixed path element (so `.planning/...` as a project path fails), and
on the `.prg` route the classification line count is the **block total**, not the image
size.
**Do this instead:** grep the run log for `ERROR REPORT SCRIPT ERROR`, container-side, in
the importer.

---

## Internal Boundaries — summary of what is NEW vs MODIFIED

| Boundary | New | Modified |
|----------|-----|----------|
| Frame-exact stop | `stock-frame-stop.ts` (or ~40 lines inside `stock-run-until.ts`) | `stock-dispatch.ts` (arg schema only, if riding `vice_run_until`); `tools-manifest.stock.json` only if a new tool name is chosen |
| Snapshot 64K extraction | a `.vsf` module-walking slicer (pure, container-side, no emulator) | `c64-ram-capture/SKILL.md` |
| Host-tool executor | `host-tool-exec.mts` + `resources/host-tool-exec.mjs`; `host-tool-client.ts`; typed allowlist; skill-side token discovery | `broker-control.mts` (union + top-of-`handleLine` routing + a callback-free deps object); `build.ts:42-50`; `package.json` `files[]`; `acme.mjs`; `packer-finding.mjs` |
| dxa | `vendor/dxa/` at a pinned version; a listing parser that refuses by name; `THIRD-PARTY-NOTICES.md` GPLv2+ entry | `ci.yml` (build step) |
| Ghidra | pre-script + post-script `.java` under `resources/` (auto-deployed by walk); `.slaspec` extension; a container-side runner | `ci.yml`; `capability-registry.ts` warp text + regenerated `docs/tool-support.md:54` |
| Fact landing | an importer module + 1–3 new `ANNO_TOOL_DEFINITIONS` entries | nothing structural — the loop at `vice-proxy.ts:3388` already covers it, and the tool count is unpinned |
| Automatic annotation join | a join module (the pivot's `autoannotate2.mjs` / `vicderive.mjs` are the prototypes) | `memmap.json` becomes a pipeline data source rather than a skill input |

---

## Citation Ledger

Every `file:line` in this document was read at HEAD `36f8c7c`. Paths are relative to
`src/mcp/vice/` unless prefixed.

| Claim | Citation | Verified |
|-------|----------|----------|
| `rewriteArguments()` inside `forwardToVice()`, before `call()` | `vice-proxy.ts:3050` / `:2985` | ✅ matches CLAUDE.md |
| Second `rewriteArguments()` site in `gatherWedgeEvidence()` | `vice-proxy.ts:1529` / `:1505` | ✅ matches CLAUDE.md |
| `anno_*` registered via `buildViceTool()` | `vice-proxy.ts:3388` | ✅ |
| `buildViceTool` definition | `vice-proxy.ts:3250` | ✅ |
| `vice.ts` transport seam / deny-list | `vice.ts:697` / `:201` | ✅ |
| `buildViceArgs()` / `VICE_ARGS` short-circuit / stock argv | `broker-launch.mts:153` / `:163` / `:202` / `:213` | ✅ |
| Warm floor default / `maintainWarmFloor()` / `inFlight` | `broker-launch.mts:850` / `:953` / `:78`, `:373-378`, `:452-457` | ✅ |
| Acquire frame — **two** sites, not one | `vice-broker-client.ts:372` **and `:867`** | ✅ (the todo names only `:372`) |
| `selectWarmInstance()` / `handleRelease()` / backend param | `vice-broker.mts:473` / `:929` / `:404` | ✅ |
| `remoteMonitorPort` additive-optional precedent | `broker-state.mts:117-141` | ✅ |
| 64 KiB cap + silent destroy | `broker-control.mts:242` / `:376` | ✅ |
| `ControlRequestKind` 7-member union | `broker-control.mts:30` | ✅ |
| Seven VICE callbacks in deps | `broker-control.mts:145-180` | ✅ |
| Token gate before any state read | `broker-control.mts:267`, `:528` | ✅ |
| Connection close IS the release | `broker-control.mts:388-397` | ✅ |
| `unknown op` → `bad_request` | `broker-control.mts:655` | ✅ |
| `verifiedKill()` / kill-and-exit handlers | `broker-kill.mts:126` / `:367-374` | ✅ |
| `broker.json` arbiter | `vice-broker.mts:239`, `:965` | ✅ |
| `vice-sync.ts` invariants block | `vice-sync.ts:28-32` | ✅ |
| `waitCheckpointHit` / `runToCheckpoint` / `readCheckpoint` | `vice-sync.ts:227` / `:262` / `:197` | ✅ |
| Five `todo` entries, no stub | `vice-sync.test.ts:107-143` | ✅ |
| `vice-sync.ts` has no importer in the shipped tree | `grep -rn 'from "./vice-sync' *.ts *.mts` → only `vice-sync.test.ts:22` | ✅ |
| `stock-run-until.ts` event-driven, one resume | `:6`, `:26-27`, `:113`, `:145` | ✅ |
| Cycle baseline / video standard / frame arithmetic | `stock-timing.ts:274` / `:147` / `:70-73` / `:200` | ✅ |
| `ADVANCE_INSTRUCTIONS` encode + handler | `stock-protocol.ts:751`; `stock-execution.ts:257` | ✅ |
| `openStore()` confinement-by-default | `anno-store.ts:432-450` | ✅ |
| `node:sqlite` named by exactly one shipped module | `anno-seam.test.ts:28`, `:33-46` | ✅ |
| Confinement escape reproduced via symlink | `anno-confinement.test.ts:5-13` | ✅ |
| `ANNO_TOOL_DEFINITIONS.length` unpinned (`> 0`) | `anno-tools.test.ts:208`; `anno-derivation.test.ts:477` | ✅ (actual length 19) |
| Stock tool count pinned three ways | `stock-dispatch.test.ts:1167`, `:1173-1174` | ✅ |
| Fork surface pinned at 62 | `fork-manifest-surface.test.ts:58-65` | ✅ |
| `BACKEND_SEAM_BYPASS_KEYS`, order-sensitive, 2 entries | `stock-dispatch.test.ts:1508-1510` | ✅ |
| `proxyToolRegistrations()` regex-scans `tools[...] =` lines | `stock-dispatch.test.ts:1486-1493` | ✅ |
| 5-member host-path consumer set | `hostpath-consumers.test.ts:144`; header `:15-24` | ✅ |
| `HOST_BOUND_ARTIFACTS` exact-set assertion | `build.ts:42-50`, `:101-102` | ✅ |
| `resources-sync` scoped to `.mjs` only | `resources-sync.test.ts:34`, `:25-33` | ✅ |
| `install-resources.ts` deploys by recursive walk | `install-resources.ts:87-114` | ✅ |
| `EXPECTED_TRACKED_SHELL_SCRIPTS`, 5 entries, repo-wide | `host-scripts.test.ts:202-220` | ✅ |
| `EXPECTED_EMULATOR_SPAWN_SITES` = 1, matches `binPath` | `spawn-seam.test.ts:263`, `:179`, `:191`, `:293-295` | ✅ |
| `MANUAL_ONLY_TESTS` = nine files | `test-gate.test.ts:16` | ✅ |
| Whole-argv `deepEqual` × 3; ordering tests survive additions | `broker-launch.test.ts:1761`, `:1773-1776`, `:1787-1797`, `:1799`, `:1806` | ✅ |
| Deferred ledger fails both directions | `docs-deferred-ledger.test.ts:101`, `:116` | ✅ |
| `shippedTsModules()` from `files[]`, throws on missing | `shipped-modules.ts:151-162` | ✅ |
| Tarball leak checks | `scripts/check-npm-packages.mjs:92-105` | ✅ |
| Test-only host oracle absent from `files[]` (the pattern) | `acme-verify.test.ts:1649-1655` | ✅ |
| `VICE_REQUIRE_ACME=1` hard-fail in CI (the pattern) | `.github/workflows/ci.yml:167`; `acme-gate.test.ts:146` | ✅ |
| Refuted warp claim, and its generated copy | `capability-registry.ts:280-286`; `docs/tool-support.md:54` | ✅ |
| Ghidra export written as a file, read by Node | `.planning/notes/dxa-ghidra-pivot-evidence/ExportAnalysis.java:13`; `autoannotate2.mjs:1-3`, `:21` | ✅ |
| Ghidra alone: 0 functions, 0 code bytes | `.planning/notes/dxa-ghidra-pivot.md` measurement table | ✅ |
| Narrowest-range / in-image-skip / bank-first rules | `.planning/notes/auto-annotation-from-ghidra-xrefs.md` | ✅ |

**Unverified this session (declared, not asserted):** VICE's event-record flag names and
their interaction with `-binarymonitor`; the actual cost of installing Ghidra + a JVM in
GitHub Actions; whether stock's synchronous checkpoint is in fact frame-reproducible
(finding 4 — this is P-A's first task, not a claim). Nothing in the build order depends on
resolving these before P-A's measurement.

---
*Architecture research for: frame-exact capture + dxa/Ghidra pipeline integration into c64-re-tools*
*Researched: 2026-09-02 · tree state HEAD `36f8c7c`*
