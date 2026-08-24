# Phase 18: Persistent Session and Tool Surface - Research

**Researched:** 2026-08-24
**Domain:** MCP client session-lifecycle management (Node `child_process`/stdio JSON-RPC), curated tool-surface maintenance, for a single-owner `regenerator2000 --mcp-server-stdio` child inside `vice-proxy.ts`
**Confidence:** HIGH — every codebase claim below was read directly from the named file this session (with line ranges and verbatim quotes); milestone-level architecture/pitfalls/stack claims are inherited from `.planning/research/{ARCHITECTURE,PITFALLS,STACK,SUMMARY}.md` (all dated 2026-08-23, itself HIGH confidence per those files' own live-probe work) and cited, not re-derived.

## Summary

Phase 18 reverses two named project-wide decisions (D-17/D-18: "spawn, load, mutate, save, exit, once per operation") and replaces them with one long-lived `regenerator2000 --mcp-server-stdio` child held by a new module, `r2000-session.ts`, alongside two independent tool-surface fixes (`r2000_read_region` curated; `r2000_get_address_details`'s D-32 refusal re-decided). CONTEXT.md has already made every architecturally consequential call (D18-01 through D18-36) — this research does not re-litigate them. What it adds is the exact current shape of every file the plan will touch, so the planner can write tasks against real line numbers and real function signatures rather than the shapes research described in the abstract.

The single most load-bearing fact this research adds beyond CONTEXT.md and the milestone research is this: **`r2000-project.ts` has no function today that forces settings on an *already-existing* project file.** `synthesizeProject()` (the only settings-writing code in the file) only ever builds a brand-new project object from raw bytes — it has no read-JSON-mutate-JSON-rewrite path at all. D18-32/D18-33's "ensure settings" function is therefore new code extracted *in shape only* from `synthesizeProject()`'s forcing convention, not a literal extraction of an existing function. Second: `docs/tool-support.md` structurally **excludes** the `r2000_*` family by design (`generate-tool-support-table.mjs` explicitly skips the `r2000_*` loop-registration variable) — regenerating it after curating two more `r2000_*` tools will produce a byte-identical file, so D18-31's "regenerate docs/tool-support.md" step is a no-op verification, not a content change. The real SURF-01 drift risk is three *prose* mentions of "the 17 curated r2000_* tools" in `vice-proxy.test.ts` (lines 533, 594, 858) that CONTEXT.md's touched-files list does not name — the assertions themselves are computed from `CURATED_R2000_TOOLS.length`/`...CURATED_R2000_TOOLS` and will not fail, but the comment prose will silently lie about the count once it moves to 19.

**Primary recommendation:** Build `r2000-session.ts` as a thin state-holder over one new export from `r2000-mcp-client.ts` (a `class`/closure exposing the same `R2000Call` shape `withR2000Session()`'s callback already receives, minus the auto-close), reusing every one of the four existing named error classes unchanged, adding exactly one new one for the exhausted-restart-budget case (D18-14), and wiring the coarse mutex (D18-15/D18-18) around the *session's* call surface rather than the transport layer — so `runR2000Tool()`'s call-then-save sequencing (`r2000-tools.ts:905-909`, unchanged per D18-08) is naturally inside the same critical section without being rewritten.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Long-lived child process ownership | API/Backend (in-proxy, container-side) | — | `vice-proxy.ts` is a single long-lived Node process per Claude Code session (D18-01); the child is its direct subprocess, no IPC boundary exists to cross (CLAUDE.md's derived-tool interception note; `.planning/research/ARCHITECTURE.md` §Q1). |
| Spawn/protocol framing (stdio JSON-RPC) | API/Backend | — | `r2000-mcp-client.ts` remains the sole spawn/parse seam (D18-02) — unchanged tier, only a new export alongside the existing one. |
| Save-timing / durability | API/Backend | — | `runR2000Tool()` (`r2000-tools.ts`) owns save sequencing today and continues to (D18-08); `r2000-session.ts` explicitly does NOT own this (research §Q1 lists it as an explicit non-responsibility). |
| Concurrency serialisation (mutex/queue) | API/Backend | — | New, owned by whichever of `r2000-session.ts`/`r2000-mcp-client.ts` the plan picks (D18-15/D18-18; planner's discretion which file, not which tier). |
| Tool-surface curation (`r2000_read_region`, D-32 re-decision) | API/Backend | — | `r2000-tools.ts`'s existing `R2000_TOOL_DEFINITIONS`/`CURATED_R2000_TOOLS`/`READ_ONLY_R2000_TOOLS` — same tier, same file, additive entries only. |
| Project-settings forcing at session open | API/Backend | Storage (the `.regen2000proj` file itself) | Reads/patches JSON on disk before spawn (D18-32) — no network/host boundary; `r2000-project.ts` is the existing settings-authorship seam to extend. |
| Process-exit cleanup (D18-22) | API/Backend | — | `vice-proxy.ts`'s existing `onTeardown()`/`TEARDOWN-REGION` (lines 3156–3179) is the mechanically-guarded hook point; no new tier. |
| Drive/emulator interaction | — | — | Explicitly out of scope: regenerator2000 never touches VICE (D-R4, Rule A16); this phase adds zero code on the `vice_*`/broker path. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | Session stays open across many tool calls without an unguarded spawn site | §"Exact current shapes" below (`r2000-mcp-client.ts`'s `withR2000Session()`, `r2000-spawn-seam.test.ts`'s `EXPECTED_R2000_SPAWN_SITES`) — extend the existing sole async spawn site, add zero new sites. |
| SESS-02 | Crash/wedge detected between calls, transparent restart | `.planning/research/ARCHITECTURE.md` §Q1 (health/restart design); `r2000-mcp-client.ts`'s existing `child.once("exit", ...)` handler (lines 346–364) and its four named error classes are the primitives to reuse, not reinvent. |
| SESS-03 | Save-per-mutation survives a hard kill, proven by planted violation | `.planning/research/ARCHITECTURE.md` §Q2 gives the exact 3-scenario test shape; `r2000-tools.ts:890-909`'s existing save sequencing is the invariant to preserve byte-for-byte. |
| SESS-04 | Write-capable calls serialised through one owner | `broker-launch.mts`'s `inFlight` guard (lines 372–380, 450–458) is the pattern to port (D18-20); `.planning/research/PITFALLS.md` Pitfall 9/11 name the failure class this closes. |
| SURF-01 | `r2000_read_region` curated; count/doc drift guards updated with no drift | `r2000-tools.test.ts:45-73` (the 17-name pin), `vice-proxy.test.ts:533,594,858` (undeclared drift risk found this session), `docs/tool-support.md`'s structural exclusion of `r2000_*` (found this session). |
| SURF-02 | D-32 refusal re-decided against the live `u16` overflow | `.planning/research/STACK.md`'s D-32 paragraph (live-reconfirmed `handler.rs:1894`); `r2000-tools.ts:148-156`'s existing `ADDRESS_DETAILS_REFUSAL` text to retire per D18-27/D18-28/D18-29. |

## Standard Stack

No new runtime dependency is required for this phase — fully confirmed by `.planning/research/STACK.md`'s "Headline finding" `[CITED: .planning/research/STACK.md]`, itself grounded in a live read of the installed `regenerator2000` 0.9.20 crate source this milestone's research already performed. This phase only extends existing hand-rolled primitives (`node:child_process`, `node:readline`, `node:crypto`) already imported by `r2000-mcp-client.ts:68-71`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `node:child_process` (`spawn`) | Node builtin (repo floor ≥ 22.18) | Long-lived child handle | Already used by `withR2000Session()` (`r2000-mcp-client.ts:332`); the session primitive holds the same `ChildProcessWithoutNullStreams` value longer, not a new API. `[VERIFIED: src/mcp/vice/r2000-mcp-client.ts:68,332]` — `import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";` / `const child = spawn(bin, argv, { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;` |
| `node:readline` (`createInterface`) | Node builtin | Frames newline-delimited JSON-RPC from the child's stdout | Already used, unchanged shape. `[VERIFIED: src/mcp/vice/r2000-mcp-client.ts:69,366]` |
| `node:crypto` (`createHash`) | Node builtin | `saveAndVerify()`'s file-hash proof | Unchanged by this phase — `saveAndVerify()` is reused as-is (D18-08 names it explicitly unchanged). `[VERIFIED: src/mcp/vice/r2000-mcp-client.ts:71,555-557]` |

### Supporting
No new supporting libraries. `@mastra/mcp`'s `MCPClient` and a direct `@modelcontextprotocol/sdk` import remain explicitly rejected for the persistent session, for the same reason the one-shot client rejected them (missing exit-code-after-close reachability) — `[CITED: .planning/research/STACK.md §1]`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-proxy `r2000-session.ts` module (D18-01) | Route through `vice-broker.mts`'s TCP control plane | Rejected — no container/host boundary exists to justify it; would import `PKG-04`'s accepted bind-exposure risk shape for nothing (`.planning/research/ARCHITECTURE.md` §Q1, `.planning/research/STACK.md` §2). Already decided, not open for replanning. |
| Hand-rolled persistent client | `@mastra/mcp`'s `MCPClient` | Rejected — same missing-exit-code-reachability gap that ruled it out for the one-shot client, worse for a long-lived child (`.planning/research/STACK.md` §1). |

**Installation:** none — no `npm install` needed.

**Version verification:** `regenerator2000 --version` on this host resolves to 0.9.20 per `.planning/research/STACK.md`'s live probe this milestone; no version change is required or recommended for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. `[VERIFIED: .planning/research/STACK.md §"Headline finding"]` — "No new runtime dependency is needed for either half of this milestone's enabler work."

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code (MCP client)
        |
        v
vice-proxy.ts (long-lived Node process, one per Claude Code session)
        |
        +-- tools/list --> R2000_TOOL_DEFINITIONS (19 after this phase, static, no spawn cost)
        |
        +-- tools/call "r2000_*" --> runR2000Tool(name, args)   [r2000-tools.ts]
                                            |
                                 1. assertCuratedTool(name, args)   -- refuse before any I/O
                                 2. resolveStorePath(args.project)  -- refuse before any spawn
                                 3. acquire the session for this project path
                                            |
                                            v
                                 r2000-session.ts (NEW)
                                 - single slot, keyed by resolved project path (D18-04)
                                 - synchronous check-and-set launch guard (D18-20, ports
                                   broker-launch.mts's `inFlight` pattern)
                                 - coarse mutex: exactly one in-flight logical op (D18-15)
                                 - tracks child.on("exit") at ALL times, not just mid-call (D18-10)
                                 - on a call: if session dead -> transparently respawn (D18-11);
                                   if session dies MID-call -> fail loud, discard handle (D18-12)
                                 - bounded restart count, then a named refusal (D18-14)
                                            |
                                            v (first acquire only, or a project-path change)
                                 "ensure settings" (NEW, D18-32/33) reads .regen2000proj JSON,
                                 forces use_illegal_opcodes=true, refuses on a system mismatch,
                                 THEN spawns
                                            |
                                            v
                                 r2000-mcp-client.ts (EXTENDED, not replaced)
                                 - existing: withR2000Session() -- one-shot, unchanged (D18-07),
                                   used by r2000-cli.ts / enum-gen / memmap-render
                                 - NEW: a long-lived session primitive built from the SAME
                                   spawn(bin, buildMcpServerStdioArgs(...)) call this file
                                   already makes at line 332 -- no second spawn call site
                                            |
                                            v (assertNoViceFlag(argv) -- unchanged guard, r2000-launch.ts)
                                 regenerator2000 --mcp-server-stdio <project>.regen2000proj
                                 (container-side child, stays alive across calls)
```

### Recommended Project Structure
```
src/mcp/vice/
├── r2000-mcp-client.ts   # MODIFIED: adds a long-lived session export beside withR2000Session()
├── r2000-session.ts      # NEW: single-owner lifecycle (spawn-on-first-use, health, restart, mutex)
├── r2000-tools.ts        # MODIFIED: runR2000Tool() rewired through r2000-session.ts; +2 tool defs
├── r2000-project.ts      # MODIFIED: settings-forcing logic generalised to an "ensure settings"
│                         #   function callable against an EXISTING file, not only at synthesis
├── r2000-launch.ts       # UNCHANGED: assertNoViceFlag()/buildMcpServerStdioArgs() reused as-is
├── r2000-spawn-seam.test.ts     # MODIFIED: fixtures gain a session-reuse live transcript
├── r2000-tools.test.ts          # MODIFIED: EXPECTED_CURATED_NAMES 17 -> 19
├── r2000-verb-coverage.test.ts  # LIKELY UNCHANGED (see "SURF-01 drift" section below)
└── vice-proxy.ts         # MODIFIED: onTeardown() gains a synchronous r2000-session kill call
```

### Pattern 1: Single-owner synchronous check-and-set launch guard (D18-20)
**What:** A module-level boolean, checked and set with no `await` between, guarding the launch path.
**When to use:** Any time two `r2000_*` calls could race to spawn against the same (or no) session simultaneously.
**Example (the pattern to port, verbatim structure):**
```typescript
// Source: src/mcp/vice/broker-launch.mts:372-380 (read this session)
export function tryLaunchOne(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord | null {
  if (inFlight) return null;
  inFlight = true;
  try {
    return spawnAndRecordInstance(reason, port, deps);
  } finally {
    inFlight = false;
  }
}
```
The load-bearing property (per CLAUDE.md's own pinned rule, "must stay a synchronous check-and-set with no `await` between") is that the check and the set are two statements with **zero `await` between them** — a second concurrent caller sees `inFlight === true` before the first caller's own `await` ever yields. `r2000-session.ts`'s acquire path must reproduce this exact shape, not a `Promise`-based mutex whose check-then-set can itself interleave.

### Pattern 2: Save-then-hold, not save-then-exit (D18-08, the load-bearing preservation)
**What:** `runR2000Tool()`'s existing sequencing already does "call, then save, inside one session" — this phase changes only what happens to the child *after*.
**Current shape (unchanged by this phase, quoted in full for the planner's contract):**
```typescript
// Source: src/mcp/vice/r2000-tools.ts:900-910 (read this session)
    // A mutating tool (including r2000_batch_execute, whose own inner calls
    // all run inside this SAME session per regenerator2000's own
    // batch_execute implementation): call, then save PLAINLY (no hash
    // verification -- see the block comment above), before the session
    // exits.
    const result = await withR2000Session(projectPath, async (call) => {
      const callResult = await call(name, rest);
      await call("r2000_save_project", {});
      return callResult;
    });
```
The plan's rewrite replaces `withR2000Session(projectPath, async (call) => {...})` with the equivalent call against `r2000-session.ts`'s acquired session — the *body* (call, then plain save) must not move or change, per D18-08.

### Pattern 3: Named, distinguishable error classes — reuse, extend by exactly one
**What:** `r2000-mcp-client.ts` already has the taxonomy SESS-02/SESS-03 need.
**Existing classes to reuse unchanged** `[VERIFIED: src/mcp/vice/r2000-mcp-client.ts:101-240]`:
- `R2000ClientError` (base, line 101)
- `R2000SpawnError` (ENOENT / spawn failure, line 115)
- `R2000ProtocolError` (JSON-RPC error / `isError: true`, line 133)
- `R2000TimeoutError` ("child alive, never answered", line 154)
- `R2000ChildExitError` ("child gone, request(s) still pending", line 175) — this IS the class SESS-02's "dead mid-call" and D18-12's fail-loud path resolve to.
- `R2000SessionFailedError` ("every call succeeded, final exit was non-zero", line 201)
- `R2000SaveNotPersistedError` (`saveAndVerify()`'s hash-mismatch refusal, line 228)

**One new class needed** (D18-14's exhausted-restart-budget case has no existing analogue): name it in the same file (`r2000-mcp-client.ts`) or in `r2000-session.ts` — the planner's call which module owns it, but it must extend the same `R2000ClientError` base and carry the crash count, matching this repo's own `R2000UncuratedToolError`/`R2000LabelNameError` convention of a dedicated public field (never buried in message text only).

### Anti-Patterns to Avoid
- **A second save-timing policy.** Any code path that defers the internal save "to batch it with the next call" reopens the exact class of bug Phase 9 found, this time with no second connection to blame (`.planning/research/ARCHITECTURE.md` §4, `.planning/research/PITFALLS.md` Pitfall 9). D18-08 is explicit: this phase changes process lifetime, never durability.
- **A `Promise`-based mutex with an `await` between check and set.** Defeats D18-15/D18-20's whole point — see Pattern 1 above.
- **Porting `vice-probe.ts`'s liveness-probe shape.** It is HTTP-specific (`fetch()` against a port) — `[VERIFIED: src/mcp/vice/vice-probe.ts:1-10,146-165]` its own header states it exists because "the host supervisor died... acquire() had handed out a port based only on the registry CLAIMING an instance existed" — a TCP-accept-while-blocked failure mode. `r2000-session.ts`'s child has no accept step; D18-13's scope note in CONTEXT.md already forbids reaching for this pattern on the strength of Pitfall 9(2) alone.
- **Adding an `await` (or `.then(`, or an `async function`) inside `vice-proxy.ts`'s teardown region.** `vice-proxy.test.ts:2550-2577`'s structural guard asserts zero promise-awaiting constructs between the `TEARDOWN-REGION-BEGIN`/`END` markers — see "Concrete integration points" below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| "Is another launch already in flight" | A new promise-queue/semaphore abstraction | The synchronous boolean check-and-set (Pattern 1) | Already battle-tested against a real dated incident (2026-08-01 triple-launch, per CLAUDE.md); a new abstraction has zero regression coverage. |
| "Prove a save actually landed" | A second hash-check function | `saveAndVerify()` (`r2000-mcp-client.ts:581-596`), unchanged | Already exists, already proves persistence independently of the child's own text response — reimplementing it risks a second, subtly different verification with none of the existing tests. |
| "Is the curated tool set drifting from its count pin" | A new drift-detection mechanism | `r2000-tools.test.ts`'s existing hardcoded `EXPECTED_CURATED_NAMES` array (line 45) plus `docs-*` guards already in the repo | The existing pattern (derive `CURATED_R2000_TOOLS` from `R2000_TOOL_DEFINITIONS`, then separately hand-pin the expected name list) already catches drift in both directions — extend the array, do not add a parallel checker. |

**Key insight:** every mechanism this phase needs (single-owner guard, hash-verified save, named error taxonomy, drift-pinning test) already exists somewhere in this repo for a structurally identical problem. The work is porting the *pattern*, and in exactly two cases (the settings-forcing generalisation, and the restart-budget error class) writing a small amount of genuinely new code — not designing new mechanisms from scratch.

## Common Pitfalls

### Pitfall 1: Treating `r2000-project.ts`'s `synthesizeProject()` as reusable for D18-32/33
**What goes wrong:** A plan task reads "extract the forcing logic from `r2000-project.ts`" (D18-33's literal wording) and looks for an existing function to lift out.
**Why it happens:** `synthesizeProject()` (`r2000-project.ts:121-150`) does force `use_illegal_opcodes: true` and an explicit `system` string — but only as two object-literal keys inside a function that builds a **brand-new** project object from raw bytes (`gzipSync(bytes).toString("base64")`, line 133). There is no code anywhere in this file that reads an *existing* `.regen2000proj`'s JSON, patches its `settings` object, and rewrites it. `[VERIFIED: src/mcp/vice/r2000-project.ts:121-150]` — the full body of `synthesizeProject()` was read this session; it takes `bytes: Uint8Array` and always constructs `{ origin, raw_data_base64, blocks: [], settings: { use_illegal_opcodes: true, system } }` from scratch — never a `readFileSync`/`JSON.parse` of an existing file anywhere in the module.
**How to avoid:** Budget a genuinely new function (e.g. `ensureProjectSettings(projectPath): void` or similar) that (1) reads the existing `.regen2000proj` bytes, (2) `JSON.parse`s it, (3) checks/forces `settings.use_illegal_opcodes === true` and refuses on a `settings.system` mismatch (D18-34), (4) rewrites the file — sharing only the *forced-values convention* (the two settings keys and their forced values) with `synthesizeProject()`, not its code. `[VERIFIED: src/mcp/vice/r2000-project.ts:71-75,140-146]` — `export const R2000_SYSTEM_C64 = "Commodore 64";` and the forced-settings object literal `{ use_illegal_opcodes: true, system }` are exactly the two values D18-33's shared function must reproduce identically for both callers.
**Warning signs:** A plan task phrased as "move `synthesizeProject`'s settings block into a shared function" — there is no such extractable block; it must be written new, then called from both the synthesiser and the session-open path.

### Pitfall 2: Believing `docs/tool-support.md` needs new content for SURF-01
**What goes wrong:** A task is written to "update docs/tool-support.md to include r2000_read_region."
**Why it happens:** CONTEXT.md's D18-31 names `docs/tool-support.md` as something to "regenerate," and the file's generator lives in `scripts/generate-tool-support-table.mjs`.
**How to avoid:** `[VERIFIED: scripts/generate-tool-support-table.mjs:107-123]` — the generator explicitly detects the `r2000_*` loop-registration variable in `vice-proxy.ts` (`R2000_LOOP_VAR_RE`, matched against `for (const r2000Def of R2000_TOOL_DEFINITIONS)`) and skips it: `if (ident === r2000LoopVar) continue; // the r2000_* family's own loop registration -- not a VICE capability at all`. Independently confirmed live: `grep -n "r2000" docs/tool-support.md` returns zero matches against the current 82-line file, which documents only 63 `vice_*` tools. Regenerating the file after this phase's tool-count change will therefore produce a **byte-identical** file — the task is "run the generator and prove it emits the same bytes" (a non-event, useful only as a regression check), never "add rows for r2000_read_region."
**Warning signs:** A diff on `docs/tool-support.md` after this phase's changes that is non-empty — that would itself indicate an unrelated regression, not a legitimate SURF-01 update.

### Pitfall 3: Missing the undeclared drift site in `vice-proxy.test.ts`
**What goes wrong:** SURF-01's "no drift" clause is satisfied by editing only the two files CONTEXT.md's touched-file list names (`r2000-tools.test.ts`, `docs/tool-support.md`), while `vice-proxy.test.ts` keeps saying "17."
**Why it happens:** `[VERIFIED: src/mcp/vice/vice-proxy.test.ts:533,594,858]` — three separate comments read, verbatim: `// vice_diagnose (plan 01.3-02), and the 17 curated r2000_* tools (plan` (line 533), `// the 17 curated r2000_* tools (plan 11-05) are not sourced from the` (line 594), and `"the wire tools/list name set must be exactly the manifest (minus DENY_LIST) plus the three synthetics plus the 17 curated r2000_* tools -- no tool missing, none extra"` (line 858, inside an `assert.deepEqual` message string). The *assertions themselves* at these sites use `CURATED_R2000_TOOLS.length` and `...CURATED_R2000_TOOLS` (confirmed at lines 538, 599) — dynamically derived, so none of these tests will fail when the curated count moves to 19. The three "17" mentions are prose only (two comments, one assertion-failure message string) and will not be caught by any existing test-failure signal.
**How to avoid:** Add a task to update these three literal "17" occurrences to "19" in `vice-proxy.test.ts`, even though CONTEXT.md's own file list omits this file — this is exactly the kind of drift `docs-dangling-refs.test.ts`-style guards exist to catch elsewhere in this repo, but no existing guard scans comment prose for a stale tool count.
**Warning signs:** `grep -n "17 curated" src/mcp/vice/*.ts` returning any hit after this phase closes.

### Pitfall 4: Forgetting the teardown region's structural constraints when adding D18-22's exit hook
**What goes wrong:** D18-22's clean-exit hook is added as `await r2000Session.close()` inside `onTeardown()`, breaking a pre-existing structural test.
**Why it happens:** `[VERIFIED: src/mcp/vice/vice-proxy.ts:3156-3179]` — `onTeardown()` already exists, bounded by `// TEARDOWN-REGION-BEGIN` (line 3150) and `// TEARDOWN-REGION-END` (line 3179) markers, and today does exactly one thing: `releaseLeaseNow(trigger)`, which calls `controlSession.release().catch(...)` — never `await`s it. `[VERIFIED: src/mcp/vice/vice-proxy.test.ts:2550-2577]` — a committed test slices the source between these two literal marker strings and asserts, over that slice only: `assert.doesNotMatch(region, /\bawait\b/, ...)`, `assert.doesNotMatch(region, /\.then\s*\(/, ...)`, `assert.doesNotMatch(region, /\basync\s+function\b|\basync\s*\(/, ...)`, and exactly one `controlSession.release()` call-site match.
**How to avoid:** Any r2000-session kill call added to (or reachable synchronously from) this region must be fire-and-forget-synchronous — e.g. `r2000Session.killSync()` calling `child.kill("SIGKILL")` directly (itself synchronous, matching `killAfter()`'s own `child.kill("SIGKILL")` call at `r2000-mcp-client.ts:525`), never an `await`ed close. If the plan needs an async close attempt first (per `.planning/research/STACK.md`'s "attempt `saveAndVerify()` with a short timeout before a forced kill" suggestion), that attempt must NOT be awaited inside this region — either fire it with `.catch()` the same way `releaseLeaseNow()` does, or (more honestly, since a save cannot be meaningfully attempted synchronously on a process about to die) skip the save-attempt at teardown entirely and rely on D18-08's per-call save discipline having already flushed everything a caller is owed.
**Warning signs:** `npm test` (specifically `vice-proxy.test.ts`'s "teardown region" test) failing after this phase's changes — the test's assertion messages name exactly which constraint broke.

### Pitfall 5: The five inherited session-lifecycle failure modes from Pitfall 9 (`.planning/research/PITFALLS.md`)
`[CITED: .planning/research/PITFALLS.md §Pitfall 9]` — summarised here only to point at what this phase must specifically NOT re-derive lighter/buggier versions of: unsaved-annotation loss on crash (closed by D18-08/D18-09), a wedged child that looks alive (closed by D18-13's passive-timeout answer, explicitly not a per-call probe), zombie processes across Claude Code restarts (closed by D18-04's single-slot + D18-22's exit hook + D18-23's stdin-EOF measurement), concurrent-subagent corruption (closed by D18-15/D18-17/D18-19), and stale in-memory state after an external `.regen2000proj` edit (closed by D18-32's before-spawn-only forcing rule). Every one of these already has a CONTEXT.md decision; the risk this research flags is a plan that re-solves one of them differently than its named decision, not that the decision is missing.

## Code Examples

### The extension point in `r2000-mcp-client.ts` (where the new export attaches)
```typescript
// Source: src/mcp/vice/r2000-mcp-client.ts:322-334 (read this session, current signature)
export async function withR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: WithR2000SessionOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_R2000_CALL_TIMEOUT_MS;
  const bin = opts.bin ?? process.env.R2000_BIN ?? "regenerator2000";
  const argv = opts.argv ?? buildMcpServerStdioArgs({ projectPath });
  assertNoViceFlag(argv);

  const child = spawn(bin, argv, { stdio: ["pipe", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;

  await waitForSpawn(child);
```
The new long-lived primitive needs the identical `spawn(bin, argv, ...)` call, the identical `assertNoViceFlag(argv)` guard placement (before spawn), and the identical `waitForSpawn()` helper — these three lines are the part `r2000-spawn-seam.test.ts`'s guard-before-spawn check (line 335) and its new session-reuse fixture must both see reproduced, not reinvented, in whatever function the plan adds beside `withR2000Session()`.

### The exact spawn-seam guard the new code must satisfy
```typescript
// Source: src/mcp/vice/r2000-spawn-seam.test.ts:302-305 (read this session, current frozen set)
const EXPECTED_R2000_SPAWN_SITES: Readonly<Record<string, string>> = Object.freeze({
  "r2000-launch.ts": "sync CLI seam -- runR2000()'s blocking spawnSync",
  "r2000-mcp-client.ts": "async MCP session -- withR2000Session()'s long-lived spawn",
});
```
`r2000-session.ts` must contain **zero** matches of `discoverR2000SpawnSites()`'s scan (`spawnSync|spawn|execFileSync|execFile|exec` called with a regenerator2000-binary-shaped first argument) — it must call into `r2000-mcp-client.ts`'s new export rather than spawning itself, or this test's set-equality check (line 309) fails by picking up a third, unlisted site.

### The exact allow-list gate two new tools must pass through unchanged
```typescript
// Source: src/mcp/vice/r2000-tools.ts:656-673 (read this session, current body)
export function assertCuratedTool(name: string, args?: unknown): void {
  if (name === "r2000_get_address_details") {
    throw new R2000UncuratedToolError(ADDRESS_DETAILS_REFUSAL, { toolName: name });
  }
  if (!CURATED_R2000_TOOLS.includes(name)) {
    throw new R2000UncuratedToolError(
      `"${name}" is not part of the curated r2000_* tool surface. Resolution routes: implement it and ` +
        "add it to R2000_TOOL_DEFINITIONS with a named criterion, or remove the caller reference.",
      { toolName: name },
    );
  }
  if (name === "r2000_set_label_name") {
    assertLegalLabelArg(args);
  }
  if (name === "r2000_batch_execute") {
    assertCuratedBatch(args);
  }
}
```
D18-27's decision (compose `r2000_get_address_details` client-side, never forward to upstream's tool of the same name) means the **first `if` block above must be deleted** — the hardcoded refusal for that exact name is precisely what D-32 currently enforces (`ADDRESS_DETAILS_REFUSAL`, quoted next) and precisely what D18-30's supersession removes. The name then needs a **new entry** in `R2000_TOOL_DEFINITIONS`/`CURATED_R2000_TOOLS` whose `run` callback (in `runR2000Tool()`, not `assertCuratedTool()`) composes the answer from `r2000_get_symbols`/`r2000_get_comments`/`r2000_get_blocks`/`r2000_get_cross_references` rather than calling upstream's same-named tool.

### The refusal text D18-30 supersedes (verbatim, so the plan's replacement can reference the exact upstream issue it retires)
```typescript
// Source: src/mcp/vice/r2000-tools.ts:148-156 (read this session, current text)
const ADDRESS_DETAILS_REFUSAL =
  "r2000_get_address_details is not on the curated r2000_* surface (D-32): on a full 64K project " +
  "(exactly what c64-ram-capture produces) it returns {\"type\":\"OutOfRange\"} for EVERY address, " +
  "because handler.rs:1894's `raw_data.len() as u16` wraps 65536 to 0. Filed upstream as " +
  "https://github.com/ricardoquesada/regenerator2000/issues/42. Its answer is a composite of " +
  "instruction semantics, cross-references, labels, comments and block type -- all independently " +
  "reachable through r2000_get_binary_info, r2000_get_cross_references, r2000_get_symbols, " +
  "r2000_get_comments, r2000_get_blocks and r2000_disassemble, every one of which was measured " +
  "working on a 64K project.";
```
D18-30 requires this constant (or its replacement) to name the **next project-wide `D-nn`** and state it supersedes D-32 — the plan must allocate that ID; this research does not (no authority to mint project-wide decision IDs outside a plan).

### The 17-name pin the plan must widen to 19
```typescript
// Source: src/mcp/vice/r2000-tools.test.ts:45-66 (read this session, current list and count)
const EXPECTED_CURATED_NAMES = [
  "r2000_set_label_name", "r2000_set_comment", "r2000_set_data_type", "r2000_add_scope",
  "r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks", "r2000_get_cross_references",
  "r2000_search_disassembly", "r2000_disassemble", "r2000_get_binary_info",
  "r2000_create_project_enum", "r2000_update_project_enum", "r2000_delete_project_enum",
  "r2000_apply_enum_usage", "r2000_save_project", "r2000_batch_execute",
];

test("CURATED_R2000_TOOLS has exactly 17 members, matching the plan's objective table (set-equality, both directions)", () => {
  assert.equal(CURATED_R2000_TOOLS.length, 17, `expected exactly 17 curated tools, got ${CURATED_R2000_TOOLS.length}`);
```
Adding `r2000_read_region` and `r2000_get_address_details` requires: appending both names to `EXPECTED_CURATED_NAMES`, changing the literal `17` to `19` in both the `assert.equal` call and its own message string, and updating the test's title text (which also says "17").

### `r2000_read_region`'s live-verified schema (do not re-derive this shape)
`[CITED: .planning/research/ARCHITECTURE.md §0]` — confirmed live against a real `regenerator2000 --mcp-server-stdio` child this milestone: `{start_address, end_address, view: "disasm"|"hexdump"}`, required `[start_address, end_address]`. This research did not re-run that live probe (no reason to distrust a same-session, same-binary-version live capture one day old); the planner should treat this shape as `[CITED]`, not `[VERIFIED]` by this document, and may re-confirm live in the same manner `r2000-tools.test.ts`'s gated integration test already does if independent confirmation is wanted before writing `R2000_TOOL_DEFINITIONS`'s new entry.

### The read-only classification the new tools must be correctly sorted into
```typescript
// Source: src/mcp/vice/r2000-tools.ts:851-858 (read this session, current set)
const READ_ONLY_R2000_TOOLS: ReadonlySet<string> = new Set([
  "r2000_get_symbols", "r2000_get_comments", "r2000_get_blocks",
  "r2000_get_cross_references", "r2000_search_disassembly", "r2000_get_binary_info",
]);
```
`r2000_read_region` is a plain read (per its live schema above) and belongs in this set — omitting it would make `runR2000Tool()` wastefully call `r2000_save_project` after every read-region call (harmless but wrong per this file's own documented rationale for the set's existence, lines 826-849). `r2000_get_address_details`'s client-side composition (D18-27) is *also* read-only by construction (it only calls other read-only tools) — but since it never reaches `runR2000Tool()`'s `withR2000Session(...)`/`READ_ONLY_R2000_TOOLS.has(name)` branch at all (its own dedicated composition code path bypasses the single-tool dispatch), whether it is added to this literal `Set` is a matter of consistency/documentation rather than correctness; the planner should decide based on how the composition is wired into `runR2000Tool()`'s dispatch, which this research leaves as an implementation-shape decision for the plan.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Spawn, load, mutate, save, exit — once per `r2000_*` call (D-17/D-18, per `r2000-mcp-client.ts:42-46`'s own header) | One long-lived child, spawned lazily, held across the whole working session (D18-01..D18-06) | This phase (v0.5.0 Phase 18) | Every later phase's absorbed procedures (Phase 19+) can issue many small `r2000_*` calls without paying a re-spawn cost per call — the stated reason this phase is sequenced first. |
| `r2000_get_address_details` excluded outright (D-32) | Composed client-side from four already-curated reads, never calling upstream's same-named tool (D18-27..D18-30) | This phase | The upstream `u16` overflow (`handler.rs:1894`) becomes unreachable by construction rather than merely detected-and-refused. |

**Deprecated/outdated:**
- `r2000-mcp-client.ts`'s own header prose, lines 42-46 (quoted below) — becomes false the moment the new export lands and must be corrected in the same change (D18-07, D18-36 step 6):
  `[VERIFIED: src/mcp/vice/r2000-mcp-client.ts:42-46]` — "Never keep a child alive between logical operations (D-17). The lifecycle is spawn -> initialize -> call(s) -> (optional save) -> stdin close -> exit, once per `withR2000Session()` call. There is no long-lived child, no supervision, and no second wedge class to add to this project's existing stock-VICE one."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `r2000_read_region`'s live schema (`{start_address, end_address, view}`) is unchanged since the milestone research's live probe one day prior | Code Examples | Low — a schema change would surface immediately when the plan's own gated integration test (mirroring `r2000-tools.test.ts`'s existing pattern) runs against the real binary; tagged `[CITED]` rather than `[VERIFIED]` above for exactly this reason. |
| A2 | Whether `r2000_get_address_details`'s client-side composition should be added to `READ_ONLY_R2000_TOOLS`'s literal `Set` is left to the plan, since its dispatch path may not go through the same `runR2000Tool()` branch at all | Code Examples | Low — a wrong choice here is cosmetic (an extra harmless save call, or a set membership that documents nothing meaningful) not a correctness defect, given D18-28's one-code-path rule. |
| A3 | The new restart-budget error class's exact name and which file (`r2000-mcp-client.ts` vs. `r2000-session.ts`) owns it is left to the plan | Code Examples/Pattern 3 | Low — either placement satisfies D18-14's requirement; this is a naming/ownership choice, not an architectural one already decided by CONTEXT.md. |

**If this table is empty:** N/A — three low-risk implementation-detail assumptions are logged above; none require user confirmation before planning, since CONTEXT.md's decisions already bound the architecturally consequential choices.

## Open Questions

1. **Does `r2000_get_address_details`'s composed answer need its own `R2000ToolDefinition` entry distinct from a "virtual" dispatch inside `runR2000Tool()`?**
   - What we know: D18-29 requires the tool to keep its upstream name; D18-27/D18-28 require it never to reach upstream's real tool.
   - What's unclear: whether `assertCuratedTool()`'s current hardcoded-refusal branch for this exact name (quoted above) is simply deleted and the name added to `CURATED_R2000_TOOLS` normally, with `runR2000Tool()` special-casing the name before its generic dispatch (mirroring how `r2000_save_project` is already special-cased at `r2000-tools.ts:889-892`) — or whether some other dispatch shape is cleaner.
   - Recommendation: follow the `r2000_save_project` special-case precedent already in `runR2000Tool()` (an `if (name === "r2000_get_address_details") { ...compose and return... }` branch before the generic `READ_ONLY_R2000_TOOLS.has(name)` check) — it is the smallest diff and reuses an already-proven dispatch pattern in the same function.

2. **Exact mutex/queue data structure for D18-15/D18-17/D18-19.**
   - What we know: coarse mutex, FIFO, bounded wait becoming a named error (D18-17); the critical section spans the mutating call plus its own save (D18-18).
   - What's unclear: whether a hand-rolled promise chain (`let tail: Promise<unknown> = Promise.resolve(); function enqueue(fn) { tail = tail.then(fn, fn); return tail; }`-shaped) suffices, or whether an explicit bounded-wait timeout requires a more structured queue (array of `{resolve, reject, enqueuedAt}` records, checked against a timer).
   - Recommendation: a promise-chain mutex is the standard, minimal shape for "exactly one in-flight operation, FIFO" in Node and needs no new dependency; the bounded-wait timeout (D18-17) is then a `Promise.race` against the queued operation's own turn, mirroring `killAfter()`'s existing `Promise.race(...)` idiom at `r2000-mcp-client.ts:457,482`. This is a small enough implementation detail to leave to the plan/executor rather than over-specify here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|-----------|
| `regenerator2000` (installed binary) | Every live test this phase's discretion section prefers (D18-09/D18-23/D18-02's live transcripts) | ✓ (per `.planning/research/STACK.md`'s live probe this milestone, and `r2000-test-gate.ts`'s existing `probeR2000()` gate mechanism already in the repo) | 0.9.20 | Existing stub-server harness in `r2000-mcp-client.test.ts` (`STUB_SOURCE`, already models `never-answers-call`/`exit-mid-call`/`exit-with-stderr`/`wrong-id-response` modes) for protocol-shape tests where the live binary is not the thing under test. |
| Node.js | Everything in this phase | ✓ | ≥ 22.18 (repo floor, unchanged) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none beyond the existing stub-vs-live split already established by this repo's own D-11 gating convention (`r2000-test-gate.ts`), which this phase reuses rather than reinventing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework — `[VERIFIED: src/mcp/vice/package.json:106]` `"test": "node --test '*.test.*'"` |
| Config file | none — glob-driven, colocated `*.test.ts` files |
| Quick run command | `node --test r2000-session.test.ts` (new file, once it exists) or any single named file under `src/mcp/vice/` |
| Full suite command | `npm test` (run from `src/mcp/vice/`) — per this project's own `test:automated hides CI failures` lesson, the FULL suite (not a filtered subset) must be green before the phase gate, since `MANUAL_ONLY_TESTS`-shaped filtering is a known trap in this repo |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SESS-01 | No third spawn site; long-lived path still guards before spawn | unit (structural scan) | `node --test r2000-spawn-seam.test.ts` | ✅ (needs a new fixture case, not a new file) |
| SESS-02 | Crash-between-calls transparently respawns; crash-mid-call fails loud | integration (live-preferred per Claude's Discretion) | `node --test r2000-session.test.ts` (new) | ❌ Wave 0 |
| SESS-03 | Planted-violation save-discipline (3 scenarios, `SIGKILL`) | integration (live-preferred) | `node --test r2000-session.test.ts` (new) | ❌ Wave 0 |
| SESS-04 | Concurrent mutating calls serialise; lost-update planted violation | integration | `node --test r2000-session.test.ts` (new) | ❌ Wave 0 |
| SURF-01 | `r2000_read_region` curated; count/doc drift guards hold | unit | `node --test r2000-tools.test.ts` | ✅ (needs literal-count edits, not a new file) |
| SURF-02 | D-32 refusal retired; composed answer matches a real 64K project | unit + gated integration | `node --test r2000-tools.test.ts` | ✅ (extend the existing gated integration test block, lines 468-559) |

### Sampling Rate
- **Per task commit:** the single named test file the task touched (`node --test <file>.test.ts`).
- **Per wave merge:** `npm test` (full suite), from `src/mcp/vice/`.
- **Phase gate:** full suite green, including the live-gated tests (this phase's own Claude's-Discretion note defaults to live testing for exactly the claims this phase makes about the external binary — a SKIP is acceptable only when `regenerator2000` is genuinely absent from the environment, never as a substitute for running it when it IS present, per this project's own `test:automated hides CI failures` lesson).

### Wave 0 Gaps
- [ ] `src/mcp/vice/r2000-session.test.ts` — new file, covers SESS-02/SESS-03/SESS-04. Should reuse `r2000-mcp-client.test.ts`'s existing `STUB_SOURCE` stub-server harness for protocol-shape assertions (extending its `STUB_MODE` set with whatever new scenarios the session-reuse tests need), and gate its live scenarios through the existing `r2000-test-gate.ts` seam (`skipReasonFor`/`assertR2000RequiredIfEnvSet`), exactly like `r2000-tools.test.ts`'s gated integration test already does.
- [ ] No new shared fixture files identified as required beyond the existing `probe-illegal.prg` fixture already used by `r2000-tools.test.ts`'s gated test (path: `.planning/phases/09-the-assumption-probe-go-no-go/evidence/fixture/probe-illegal.prg`).
- [ ] Framework install: none — `node --test` is already wired.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V1 Architecture | yes | Single-owner session, container-side only (D18-01/D-R4) — no new trust boundary is crossed; the existing "regenerator2000 never touches the host-path/container-path translation modules" structural assertion (`hostpath-consumers.test.ts`) is unaffected since this phase adds no new consumer of those modules. |
| V5 Input Validation | yes (unchanged) | `resolveStorePath()` (`r2000-tools.ts:774-823`, unchanged by this phase) already refuses path escapes and non-`.regen2000proj` extensions before any spawn; `assertCuratedTool()`/`assertLegalLabelArg()` already refuse illegal tool names and label identifiers pre-spawn. New code (the two curated tools) must call through these same existing gates, never bypass them. |
| V6 Cryptography | no (n/a) | No cryptographic operation is added; `saveAndVerify()`'s SHA-256 hash use is unchanged and pre-existing. |
| V2/V3/V4 (Auth/Session/Access Control) | no | This phase has no network-facing session concept — the "session" here is an internal process handle, not an authenticated user session; no new attack surface of this shape is introduced. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A second, unguarded spawn site smuggled into `r2000-session.ts` | Elevation of Privilege (a path to launch regenerator2000 with `--vice`, crossing into VICE's single-client binary monitor) | `r2000-spawn-seam.test.ts`'s existing discovery-based guard (unchanged mechanism, extended fixture set) — already closes this by construction if the new code calls into `r2000-mcp-client.ts` rather than spawning independently. |
| A lost-update race under concurrent mutating calls (SESS-04) | Tampering (silent overwrite of one caller's write by another) | The coarse mutex (D18-15/D18-18), proven by the D18-19 planted-violation lost-update test. |
| An external direct-JSON edit of `.regen2000proj` while a session owns the file | Tampering (silently reverted settings) | D18-32's before-spawn-only forcing rule — the "ensure settings" function (Pitfall 1 above) only ever runs before a spawn, never while a session has the file open, closing the exact race `.planning/research/PITFALLS.md` Pitfall 9(6) names. |

## Sources

### Primary (HIGH confidence)
- `src/mcp/vice/r2000-mcp-client.ts` (full file read this session) — error classes, `withR2000Session()`, `saveAndVerify()`, spawn/guard placement, all quoted with line numbers above.
- `src/mcp/vice/r2000-tools.ts` (full file read this session) — `R2000_TOOL_DEFINITIONS`, `CURATED_R2000_TOOLS`, `assertCuratedTool()`, `READ_ONLY_R2000_TOOLS`, `runR2000Tool()`, `ADDRESS_DETAILS_REFUSAL`.
- `src/mcp/vice/r2000-launch.ts` (full file read this session) — `assertNoViceFlag()`, `FORBIDDEN_R2000_FLAGS`, `buildMcpServerStdioArgs()`.
- `src/mcp/vice/r2000-project.ts` (full file read this session) — `synthesizeProject()`'s forced-settings shape; confirmed no existing "patch an existing file" function.
- `src/mcp/vice/r2000-spawn-seam.test.ts` (full file read this session) — `EXPECTED_R2000_SPAWN_SITES`, discovery mechanism.
- `src/mcp/vice/r2000-tools.test.ts` (full file read this session) — `EXPECTED_CURATED_NAMES`, the 17-count pin, D-32 refusal test.
- `src/mcp/vice/r2000-verb-coverage.test.ts` (full file read this session) — confirms this file's scope is CLI verbs (unaffected by this phase's tool-surface change) not MCP tool names.
- `src/mcp/vice/vice-proxy.ts` (targeted reads: R2000 registration at lines 193-194, 3383-3384; teardown region lines 3150-3179) — registration point, teardown-region structure.
- `src/mcp/vice/vice-proxy.test.ts` (targeted reads: lines 520-560, 566-610, 840-870, 2550-2577) — the undeclared "17" drift sites, and the teardown-region structural test.
- `src/mcp/vice/broker-launch.mts` (targeted reads: lines 360-520) — `tryLaunchOne()`/`acquirePortAndLaunch()`'s `inFlight` single-owner guard.
- `src/mcp/vice/broker-kill.mts` (targeted read of header/identity-check comments) — PID+identity-verified kill pattern (cited, not reproduced in full — D18-21 makes it structurally unnecessary for this phase's kill-by-handle design).
- `src/mcp/vice/vice-probe.ts` (full file read this session) — confirms the fragile no-retry probe is HTTP-specific, not directly portable (supports CONTEXT.md's own D18-13 scope note).
- `src/mcp/vice/vice.ts` (targeted read: lines 245-290) — `ViceError`/`MachineRestartedError` pattern, cited as the general "restart-detection error class" precedent.
- `scripts/generate-tool-support-table.mjs` (targeted read: lines 1-40, 95-123) — confirms `docs/tool-support.md` structurally excludes `r2000_*`.
- `docs/tool-support.md` (full file read this session) — confirmed zero `r2000` mentions, 82 lines, 63 `vice_*` tools only.
- `src/mcp/vice/r2000-test-gate.ts` (targeted read: lines 1-60) — the D-11 live/skip gating convention to reuse for new live tests.
- `src/mcp/vice/r2000-mcp-client.test.ts` (targeted read: `STUB_SOURCE`, lines 127-170) — the existing stub-server harness's modeled failure scenarios.
- `src/mcp/vice/package.json` (targeted read: `files[]`, `test` script) — confirms `r2000-session.ts` does not yet exist and would need adding to `files[]`.
- `src/skills/c64-program-recon/SKILL.md` (targeted read: line 143) — the "batching is what makes that affordable under the per-call spawn-load-mutate-save-exit lifecycle" quote D18-36 names as evidence for the Architecture Change Procedure's step 2.
- `.planning/phases/18-persistent-session-and-tool-surface/18-CONTEXT.md` (full file, required reading) — every D18-nn decision.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (full/partial read, required reading) — requirement text, project history/decisions.

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md`, `.planning/research/SUMMARY.md` (all full files read this session, dated 2026-08-23) — milestone-level research this document builds on and cites rather than re-deriving; their own confidence is HIGH per their own metadata, cited here as `[CITED]` since this session did not independently re-run their live probes.

### Tertiary (LOW confidence)
- None — every claim above is either directly read from source this session or cited to the prior research session's own HIGH-confidence live work.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every primitive already in use and read directly this session.
- Architecture: HIGH for codebase-grounded claims (exact file shapes, line numbers, quoted text); the underlying architectural decisions themselves are CONTEXT.md's, not re-derived here.
- Pitfalls: HIGH for the three pitfalls sourced from this session's own direct file reads (Pitfalls 1-4); MEDIUM (inherited) for Pitfall 5's milestone-level session-lifecycle failure modes.

**Research date:** 2026-08-24
**Valid until:** next `git mv`/rename of any of the ~12 primary-source files above, or the next `regenerator2000` version bump on this host — whichever comes first. Line numbers cited above are exact as of this session and will drift with any edit to the named files; treat a mismatch at planning/execution time as drift to re-verify, not as evidence a cited invariant changed (mirroring CLAUDE.md's own stated convention for its `vice-proxy.ts` line citations).
