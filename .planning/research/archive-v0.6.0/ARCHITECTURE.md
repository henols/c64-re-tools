# Architecture Research — v0.5.0 "The rebuild half"

**Domain:** Integrating a persistent static-analysis session and a binary-to-rebuildable-source
pipeline into an existing MCP-tool-surface + CLI-verb + skill architecture
**Researched:** 2026-08-23
**Confidence:** HIGH for everything grounded in a real source read or a live probe against the
installed `the external analyser` 0.9.20 binary this session; MEDIUM where noted (mostly: the exact
upstream mechanism for packer identification, and whether to re-render ACME text ourselves vs.
post-process the external analyser's own `--export_asm` output).

This file is written against `.planning/PROJECT.md`'s v0.5.0 scope and `.planning/ARCHITECTURE.md`'s
Rules A1–A20, which are NORMATIVE and not re-derived here. Every new component proposed below is
checked against those rules explicitly, not merely placed by convenience.

## 0. What was verified live this session

- `analyser --help` (0.9.20, `~/.cargo/bin/analyser`): confirms `--mcp-server`
  (HTTP, fixed port 3000, no `--mcp-port`/`--mcp-bind`) vs. `--mcp-server-stdio` (stdio, headless,
  **no port, no single-instance limitation** — this project already uses stdio, so the "only one
  project served at a time" constraint in `PROJECT.md` applies to the HTTP mode this project does
  **not** use, not to the route the persistent session will extend).
- Live `tools/list` against a real synthesized `.regen2000proj` returned exactly **28** tool names,
  matching `PROJECT.md`'s count and `anno-tools.test.ts:66`'s pin.
- `anno_read_region`'s live schema: `{start_address, end_address, view: "disasm"|"hexdump"}`,
  required `[start_address, end_address]` — a plain read, trivially safe to curate (same shape
  discipline as the other 6 read-only curated tools).
- `anno_unpack_binary`'s live description: **"WARNING: This is a DESTRUCTIVE action! All existing
  comments, labels, and blocks will be completely deleted."** This is the only tool in the 28 whose
  name plausibly carries the "packer signature database" capability the milestone names. No
  separate "identify packer" read-only tool exists in the 28 — packer identification, if exposed at
  all as data rather than only as a side effect of unpacking, most likely surfaces through
  `anno_get_binary_info`'s entropy hint plus stderr/log text emitted during `anno_unpack_binary`
  or an equivalent `--headless` CLI run. **This needs a short live-source spike before Phase 19 is
  planned in detail** — flagged as MEDIUM confidence, not asserted as settled.
- No `.agent/skills/` directory exists anywhere in the unpacked crate source
  (`~/.cargo/registry/src/.../analyser-0.9.20/`) — confirms `PROJECT.md`'s claim that the
  five upstream analyze procedures live only in the GitHub repository, not the published crate, and
  that absorption (reading the procedure text once, at the pinned 0.9.20 tag, and rewriting it into
  this project's own skills) is the only route that does not create a live dependency on
  `.agent/skills/`.

## 1. System Overview — updated topology

```text
Claude Code / MCP client
        |
        v
stdio MCP proxy (vice-proxy.ts)
        |
        +---------------------------+------------------------------+
        |                           |                              |
        v                           v                              v
  vice_* tools                 anno_* tools                  vice-mcp anno <verb>
  (forwardToVice/call())       (buildViceTool(), never         CLI verbs (anno-cli.ts)
        |                       reaches forwardToVice())              |
        v                           |                                 |
  backend selection                 v                                 v
  (stock / fork VICE)      +--------------------+          one-shot the external analyser
        |                  | anno-session.ts   |  <--NEW  spawn via
        v                  | (module-level,     |          anno-mcp-client.ts's
  host VICE process        |  single-owner,     |          withAnnoSession()
  (broker-managed)         |  long-lived        |          (UNCHANGED lifecycle —
                           |  session handle)   |           spawn->calls->exit,
                           +--------------------+           once per CLI invocation)
                                     |
                                     v
                     anno-mcp-client.ts's spawn/
                     protocol primitives (EXTENDED,
                     not replaced, to support a
                     session that outlives one call)
                                     |
                                     v
                     the external analyser --mcp-server-stdio <project>
                     (container-side, same side as the MCP proxy;
                      NEVER launched with --vice — D-R1/D-07, unchanged)
```

New rebuild-pipeline components sit downstream of the annotation store, entirely on the
container side, and reuse the CLI-verb pattern rather than the MCP-tool pattern (see §3):

```text
.regen2000proj (annotation store)
        |
        v  (read-only, via a session)
anno-rebuild-export.ts  --------->  one .a file per subsystem (anno scope)
        |                             + one .a per data table
        v
anno-hazards.ts  ----------------->  hazard-report.json / .md
        |
        v
anno-provenance-carry.ts  <-------  recovery/RELEASES.json, recovery/PROVENANCE.md
        |                             (c64-provenance-diff's existing committed artifacts)
        v
acme-build's acme.mjs build  -------> game.prg  (via ACME !source across the split files)
        |
        v
vice_* tools (existing)  -----------> running program in VICE
        |
        v
c64-ram-capture's compare.mjs  -----> behavioural verdict vs. the original's capture
```

## 2. Component Responsibilities — new vs. modified

| Component | File(s) | Status | Responsibility |
|---|---|---|---|
| Persistent session owner | `src/mcp/vice/anno-session.ts` | **NEW** | Single-owner, module-level long-lived `analyser --mcp-server-stdio` handle per project path; owns spawn-on-first-use, health/crash detection, transparent restart, one-in-flight-call serialization, and clean shutdown on proxy exit. Does **not** own save timing (see §2 below). |
| Long-lived spawn/protocol primitive | `src/mcp/vice/anno-mcp-client.ts` | **MODIFIED** | Extended (not replaced) to expose a session primitive that does not close stdin/exit after one `fn()` — `withAnnoSession()`'s one-shot contract stays for CLI-verb callers; a new export (e.g. `openAnnoSession()` / `AnnoSession` class) is added for `anno-session.ts` to build on. Keeps this module the **one** spawn/parse site — no third spawn call site is introduced. |
| Curated tool surface | `src/mcp/vice/anno-tools.ts` | **MODIFIED** | Add `anno_read_region` (read-only) to `ANNO_TOOL_DEFINITIONS`/`CURATED_ANNO_TOOLS`/`READ_ONLY_ANNO_TOOLS`, each addition carrying a named criterion per the file's own discipline. Re-decide `anno_get_address_details`'s D-32 refusal against the live 64K `OutOfRange` defect. `runAnnoTool()` is rewired to call through `anno-session.ts` instead of directly through `anno-mcp-client.ts`'s one-shot path, but its save-per-mutation behavior is preserved byte-for-byte (see §2 below). |
| Spawn-seam regression guard | `src/mcp/vice/spawn-seam.test.ts` | **MODIFIED** | Must still assert exactly the guarded spawn-site set. Since the recommended design keeps `anno-mcp-client.ts` as the sole spawn site, this guard's enumerated set is unchanged in shape but its live-transcript fixtures need a session-reuse case added. |
| CLI verb layer | `src/mcp/vice/anno-cli.ts` | **MODIFIED** | New verbs `export-source` and `hazard-report` (see §3), following the exact option-parsing/refusal conventions (`parseArgs`-shaped, `VERB_OPTIONS`, `checkAcceptedOptions`) already used by `bootstrap`/`export-asm`/`verify`/`gen-enums`/`export-lbl`/`import-lbl`/`render-memmap`. |
| Subsystem-split, symbol-only ACME exporter | `src/mcp/vice/anno-rebuild-export.ts` | **NEW** | Reads blocks/scopes/symbols/comments/cross-references via a session, renders one `.a` file per anno **scope** (the existing subsystem unit — `anno_add_scope` already models exactly this boundary) plus separate files for data tables, every branch/JSR/JMP/data reference through a symbol. Same "read via session, render in pure Node, write files" shape as `anno-enum-gen.ts`/`anno-memmap-render.ts`. |
| Relocation-hazard reporter | `src/mcp/vice/anno-hazards.ts` | **NEW** | Reads blocks/cross-references/scopes via a session; flags address-typed blocks referenced by computed jumps (jump tables), code blocks that are also write-targets of `sta`/`stx`/`sty` elsewhere (self-modifying code), data blocks whose consumers require alignment, and raster-IRQ-adjacent code (heuristic, human-confirmed). Emits a report a later gate step parses mechanically, not just prose. |
| Provenance-carry adapter | `src/mcp/vice/anno-provenance-carry.ts` | **NEW** | Reads `recovery/RELEASES.json`'s earned `loader_ranges`/verdict data (the committed, machine-readable artifact `c64-provenance-diff` already produces) and marks/excludes cracker-patched ranges at export time — an explicit adapter, per Rule A20's "flow through explicit conversion/adapter code, never parse the other side's internal representation directly." |
| Coverage measurement | `src/mcp/vice/anno-coverage.ts` (name indicative) | **NEW** | Computes and reports (never asserts) the fraction of the binary still `Undefined`, unnamed entry points (`p_XXXX`/`l_XXXX`), and undocumented non-hardware address references — the "measured, not asserted" instrument the milestone requires, and per this project's culture, built **before** the full decomposition pass it gates. |
| Routine-queue-walk skill | `src/skills/c64-annotate-routines/SKILL.md` (name indicative) | **NEW** | Walks a routine queue and documents each one — the job with no current owner (see §4). |
| Rebuild skill | `src/skills/c64-rebuild/SKILL.md` (name indicative) | **NEW** | Orchestrates export → hazard-report → provenance-carry → `acme-build` → VICE run → `compare.mjs` — the second job with no current owner (see §4). |
| `c64-program-recon` | `src/skills/c64-program-recon/SKILL.md`, `scripts/derive.mjs` | **MODIFIED** | Absorbs upstream's `analyze-blocks` (block classification sequencing) and packer identification as a recon finding. |
| `c64-memory-mapping` | `src/skills/c64-memory-mapping/SKILL.md`, `scripts/driver.mjs` | **MODIFIED** | Absorbs upstream's `analyze-symbol` (per-address semantic documentation sequencing). |

## 3. Answers to the six sub-questions

### Q1 — Where does a persistent analyser session live?

**Recommendation: (a), inside the proxy process — a new `src/mcp/vice/anno-session.ts` holding
module-level mutable state, built on an *extended* `anno-mcp-client.ts`.** Reject (b) and (c).

**Why not (b), the host-side broker.** `vice-broker.mts` is host-side by construction (Rule A16:
"container-side static analysis remains container-side"); `the external analyser` runs container-side
specifically so no path translation applies (D-R4). Routing a persistent anno session through the
broker would (i) cross the container/host boundary for a resource that needs no host-side access at
all — no port, no display, no host filesystem — and (ii) conflate two structurally different
lifecycles: the broker's whole reason to exist is pooling *emulator* instances behind a TCP
control-plane protocol built around acquire/release/recycle semantics for a VICE process talking
the binary monitor. A `the external analyser` child talking stdio JSON-RPC is not that shape, and forcing
it into the broker's model would require a second protocol bolted onto a control plane that was
built and hardened (Rule A11's single-owner launch guard, the 2026-08-01 triple-launch incident)
around a different problem. Reusing it buys nothing and imports a large, unrelated surface.

**Why not (c), a new container-side supervisor process.** This solves a problem the milestone does
not have. The whole benefit sought is "stop respawning the binary per tool call" and "keep in-memory
cursor state alive across calls" — both are satisfiable by holding one already-spawned child process
alive inside the *already-running* `vice-proxy.ts` process, which is itself a long-lived, single Node
process per Claude Code session (per `.planning/codebase/ARCHITECTURE.md` and this repo's own
description of `vice-proxy.ts` as launched once per session). Standing up a second supervisor
process adds its own IPC surface, its own crash-recovery story, and a second "is it wedged" question
this project would then need its own `vice-wedge-triage`-shaped playbook for — duplicated complexity
for zero new capability.

**Why (a) is the right fit.** `vice.ts` already establishes the precedent this project uses for
exactly this shape of problem: "Global state: `vice.ts` holds mutable module-level transport state"
(`.planning/PROJECT.md`'s Architectural Constraints, echoed in `.planning/codebase/ARCHITECTURE.md`).
an external analyser session is the same kind of thing — one long-lived resource, owned by one process,
with restart-on-crash semantics analogous to `vice.ts`'s `MachineRestartedError`/epoch detection.
Placing it as a sibling module (`anno-session.ts`) rather than inline in `vice-proxy.ts` also
satisfies Rule A4 ("keep derived implementations outside the proxy monolith") and this project's own
convention (every `anno-*.ts` module is already a dedicated sibling, never inline in
`vice-proxy.ts`).

**What `anno-session.ts` must own:**

- **Spawn.** Lazily, on first tool call needing it (or an explicit open), via the extended
  `anno-mcp-client.ts` primitive — never a second, independent spawn call site (see the note on
  `spawn-seam.test.ts` below).
- **Health.** Listen for the child's `exit` event at all times, not only mid-request — a crash
  between two tool calls must be detected before the *next* call is attempted, not discovered as a
  broken pipe write.
- **Restart.** On detected crash (or on an explicit `anno_session_close`/idle-timeout), discard the
  dead handle; the next call transparently spawns a fresh session against the same project path. No
  data can be lost by this restart *if* the save-discipline invariant in Q2 holds — that is the
  entire point of designing Q1 and Q2 together.
- **Save discipline** is explicitly **not** this module's job — it stays where it already lives,
  in `runAnnoTool()`'s call/save sequencing (`anno-tools.ts`). `anno-session.ts` only supplies a
  session handle; it never decides when to flush.
- **Serialization.** Exactly one in-flight logical operation per session at a time — a coarse
  mutex/queue, mirroring Rule A11's "synchronous check-and-set with no `await` between" discipline
  applied to a different resource. This prevents two mutating calls from interleaving their own
  mutate-then-save sequences non-deterministically.
- **Shutdown.** A clean-exit hook so the proxy process's own exit does not orphan a live
  the external analyser child.
- **Scope, deliberately narrow for v0.5.0.** Track at most one open session at a time (keyed by
  project path is available for free since `--mcp-server-stdio` carries no port limitation, but
  promising concurrent multi-project sessions is explicitly out of scope here — smaller surface,
  consistent with this project's stated preference for minimal fields over speculative capability).

**This is a deliberate reversal of D-17/D-18** (`anno-mcp-client.ts`'s own header: "Never keep a
child alive between logical operations (D-17)"), which `PROJECT.md` already names as intentional.
Per `.planning/ARCHITECTURE.md`'s Architecture Change Procedure, the plan that implements this must:
identify D-17/D-18 by name, explain why session-model mismatch (cursor-shaped tools, and the
per-call respawn cost `c64-program-recon`'s own text already concedes) makes the old rule
unworkable for the absorbed procedures, name the alternative that preserves the original safety
property (the save-per-mutation invariant, Q2), and update `anno-mcp-client.ts`'s own header prose
— its current claim ("once per `withAnnoSession()` call") becomes false the moment a second,
longer-lived primitive is added beside it, and that prose must be corrected in the same change, not
left to drift the way `CLAUDE.md`'s own line-reference guard exists to catch elsewhere.

**Integration point to touch, concretely:** `src/mcp/vice/spawn-seam.test.ts` "derives the full
production-module set, finds every the external analyser spawn call site in it, and FAILS if... a third,
unguarded site ever appears." The recommended design deliberately avoids introducing a third spawn
site (by extending `anno-mcp-client.ts` rather than spawning again from `anno-session.ts`), so this
guard's enumerated site count should stay the same — but its fixtures need at least one new live
transcript proving the long-lived primitive still calls `assertNoViceFlag()` before spawning, exactly
like the one-shot path does today.

### Q2 — The save-discipline problem, and how to test it

**The invariant:** *persistence, not liveness, is what a caller is owed.* Concretely: **every
mutating `anno_*` call must still be followed by a save, over the *same* session, before that tool
call resolves to its caller — identically to today's per-call spawn-mutate-save-exit contract —
regardless of whether the underlying process is torn down afterward.** The persistent session
changes *process lifetime*, not *save timing*. `runAnnoTool()`'s existing logic already has this
shape (`anno-tools.ts`: every mutating tool, except `anno_save_project` itself, calls the tool then
calls `anno_save_project` inside the same session before returning) — the fix for the persistent
session is to keep that sequencing exactly as-is and only change what happens to the child process
*after* the save: today it exits; under the persistent session it stays alive for the next call.

This directly answers the concrete Phase 9 failure named in the milestone ("three separate MCP
client connections produced a `.vsf` that did NOT contain a written label"): that failure was a
**multi-owner** race — several independent connections to one running process, no single place
enforcing "mutate implies save before anyone else observes state." This project's design is a
**single-owner** session from the start (`anno-session.ts` is the *only* thing that ever holds a
handle to the child; `runAnnoTool()` is the *only* caller of that handle) — the multi-connection
race class is closed by construction, the same way `anno-mcp-client.ts`'s header already claims for
the one-shot path ("No other module may spawn `--mcp-server-stdio`..."). The save-per-mutation
invariant above closes the *second*, narrower race: a crash between two calls, or between a mutation
and its own save, must never lose an already-acknowledged mutation.

**Batched mutations remain sanctioned via `anno_batch_execute`**, unchanged: its own inner calls
already run inside one session with one save at the end (`anno-tools.ts`'s existing comment on
`anno_batch_execute`'s handling). The routine-queue-walk skill (§4) should prefer batching several
related annotations (label + comment + scope for one routine) into one `anno_batch_execute` call
rather than issuing them as separate single-mutation calls — this keeps the durability story
identical to today (one save per logical unit of work) while still benefiting from the persistent
session's cursor continuity and reduced respawn cost between routines.

**How to test it, concretely — proven non-vacuous by a planted violation, matching this project's
own culture** (`spawn-seam.test.ts`'s "proven to fail under live reintroduction mutations,"
`docs-*.test.ts`'s planted-violation gates, the `--vice` guard's dual enforcement):

1. **The green-path assertion.** Open a persistent session against a real (or the existing stub-server
   harness already used in `anno-mcp-client.test.ts`) the external analyser process. Issue one mutating
   call (e.g. `anno_set_label_name`) through `runAnnoTool()`. The instant that call resolves,
   `SIGKILL` the underlying child directly — bypassing `anno-session.ts`'s own graceful-close path
   entirely, simulating the exact "crash between calls" class this design must survive. Re-open a
   **fresh** session (or read the `.regen2000proj` file directly from disk, independent of any
   session) and assert the label is present. This proves persistence survived a crash that happened
   *after* the tool call the label came from had already returned.
2. **The planted-violation half, which is the non-vacuity proof.** Temporarily short-circuit the
   auto-save step inside the same code path under test (e.g. a test-only injection point, or
   literally comment out the `await call("anno_save_project", {})` line the way this project's other
   planted-violation tests reintroduce a known-bad mutation) and re-run step 1 unchanged. Assert the
   test **now fails** — the label is absent after the kill. If the test still passes with the save
   step removed, the test was vacuous (it never exercised the invariant it claims to guard) and must
   be rewritten before it is trusted. This is exactly the shape `spawn-seam.test.ts` already
   uses for the `--vice` guard: a guard is only real once someone has watched it catch the bug it was
   built for.
3. **A second scenario worth the same treatment:** kill the child **mid-call**, between the mutating
   `tools/call` and its own internal save call (i.e., simulate the crash landing inside the exact
   window `anno-mcp-client.ts`'s own `AnnoChildExitError`/`AnnoSessionFailedError` classes already
   exist to name). Assert the tool call itself surfaces a named, distinguishable error to its caller
   (never a silent success) and that the file on disk is unchanged (not partially written) — proving
   the mid-window crash is a loud, attributable failure rather than a second silent-loss class hiding
   behind the first fix.

This is concrete enough to plan directly: it names the exact call sequence (mutate → kill → reopen →
re-read), the exact planted violation (remove the internal save, watch the test go red), and the
exact classes already available to assert on (`AnnoChildExitError`, `AnnoSessionFailedError`,
`AnnoSaveNotPersistedError` from `anno-mcp-client.ts`).

### Q3 — Where the rebuild/export pipeline sits

**Follow the existing CLI-verb precedent — do not add new `anno_*` MCP tools for this.**
`anno-cli.ts`'s own header states the reason directly: it is "the thin CLI ergonomics layer... " and
"the CLI is how skills reach heavier operations," reached identically across the plugin route and
both npm-installer routes because `installer/bin/cli.mjs`'s `viceServerEntry()` always launches the
server via `npx`. The rebuild pipeline's shape — read a whole annotated project, transform, write
several files, optionally chain to an external tool (ACME) — is exactly the shape of the six
existing verbs (`bootstrap`, `export-asm`, `verify`, `gen-enums`, `export-lbl`, `import-lbl`,
`render-memmap`), not the shape of the interactive, per-call `anno_*` MCP tools (which exist so an
LLM can make one small, live mutation to the annotation store mid-conversation).

Concretely, two new verbs on `vice-mcp anno`:

- **`export-source <project> --out-dir DIR [--provenance FILE]`** — the multi-file, symbol-only,
  subsystem-split exporter. New module `anno-rebuild-export.ts`.
- **`hazard-report <project> [--out FILE]`** — the relocation-hazard enumerator. New module
  `anno-hazards.ts`.

Both should follow `render-memmap`'s exact shape (`anno-cli.ts::cmdRenderMemmap`,
`anno-memmap-render.ts`): read structured data via a session (a **one-shot** session is fine here —
these are still one-shot CLI-process invocations, not something that benefits from Q1's persistent
session, since the CLI process itself is short-lived per invocation), render/compute in pure Node,
write file(s), and report a coverage-shaped summary line rather than a bare exit code. `--provenance
FILE` is a **reused** flag name and shape — `render-memmap` already establishes exactly this
convention (`--provenance FILE`, required, validated to exist before use) — `export-source` should
accept the same flag, feeding it to the new `anno-provenance-carry.ts` adapter, consuming the
already-committed `recovery/RELEASES.json` produced by `c64-provenance-diff`.

**One design fork worth naming rather than silently picking:** the external analyser's own `--export_asm
<PATH>` is single-file, whole-project (confirmed live: `--help` shows no range/scope argument on
that flag). Splitting into subsystem files therefore cannot be done by asking the external analyser to
split its own output — it must be done by *this project's own renderer* reading `anno_get_blocks`/
`anno_get_symbols`/`anno_get_comments`/`anno_get_cross_references` per **scope** (the scope
boundary from `anno_add_scope` already **is** the subsystem unit the requirement asks for — no new
concept needed, only a walk over existing scopes) and emitting our own ACME text. This is consistent
with precedent (`anno-enum-gen.ts`/`anno-memmap-render.ts` already render Markdown/enum text from
structured reads rather than post-processing the external analyser's own text output) and lower-risk than
depending on the private formatting of `--export_asm`'s output, which is not a documented, stable
contract. `PROJECT.md`'s own "byte-identical is nothing I care about" stance removes any pressure to
match the external analyser's own single-file exporter's formatting byte-for-byte.

`acme-build` is **not modified** to know about subsystem splitting — ACME's own `!source` directive
already threads multiple files into one assemble from the entry file, so the split output is
consumed by `acme-build`'s existing `acme.mjs build` unchanged (single-responsibility preserved:
export produces source, `acme-build` assembles it, exactly as today).

### Q4 — Skill topology

| Upstream job | Owner | Status |
|---|---|---|
| `analyze-blocks` | `src/skills/c64-program-recon/SKILL.md` | **absorbed, modified** |
| `analyze-symbol` | `src/skills/c64-memory-mapping/SKILL.md` | **absorbed, modified** |
| `analyze-basic` | *(none — deliberately not absorbed)* | out of scope, named explicitly |
| `analyze-routine` + the routine-queue half of `analyze-program`'s orchestration | **new skill** | no existing owner |
| the rebuild itself | **new skill** | no existing owner |

**New skill 1 — routine-queue walker** (indicative name `c64-annotate-routines`). Job: given a
program whose blocks are already classified (code vs. data) and whose scopes/entry points are
already known from `c64-program-recon`, walk every routine (code block with a defined entry) and
produce a label, a purpose comment, and — where warranted — a scope for it, one routine at a time or
via a bounded queue. This is the direct absorption of `analyze-routine`, driven by the
queue-walking half of `analyze-program`'s own orchestration (the "rolling window of up to 7
concurrent subagents" shape is a *concurrency policy* for driving multiple routine-documentation
passes at once — worth naming in the skill's playbook as an optional acceleration, not a hard
requirement, since this project's own architecture serializes calls through one persistent session
per Q1 and concurrent *subagents* issuing tool calls against the same session must still queue behind
that session's own single-in-flight-call discipline).

Draft `description` frontmatter (must not overlap `c64-program-recon`'s trigger, which is about
*discovering* structure, nor `c64-memory-mapping`'s, which is about *looking up* known semantics):

> Walk every routine an analysed C64 program's block classification has already identified and
> document each one — name it, describe its purpose, and scope it — one routine at a time or via a
> bounded queue, until none is left undocumented. Use when asked to document all routines, annotate
> every function, finish coverage on an analysed program, walk the routine queue, or work through a
> list of undocumented code blocks. Requires block classification to already exist — run
> `c64-program-recon` first if it does not.

**New skill 2 — the rebuild** (indicative name `c64-rebuild`). Job: given a fully (or
measurably-mostly) documented project, produce rebuildable, subsystem-split, symbol-only ACME
source with a relocation-hazard report, carry provenance, assemble via `acme-build`, run in VICE, and
prove behavioural equivalence via `c64-ram-capture`'s `compare.mjs`. This is new orchestration over
new CLI verbs (§3) plus three existing skills' tools (`acme-build`, `c64-provenance-diff`,
`c64-ram-capture`) — it does not duplicate any of their internal logic, only sequences them.

Draft `description` frontmatter (must not overlap `acme-build`'s trigger, which only assembles and
never decides structure, `c64-provenance-diff`'s, which decides byte-level provenance but never
emits source, nor `c64-program-recon`/`c64-memory-mapping`'s, which analyze but never emit
rebuildable output):

> Turn a fully-annotated C64 analysis project into rebuildable, subsystem-split ACME source with a
> relocation-hazard report, assemble it, and prove the rebuild behaves like the original in VICE. Use
> when asked to rebuild a C64 game from analysis, export subsystem-split or symbol-only source, make
> a binary's source modifiable, generate a relocation-hazard report, or demonstrate that a change to
> rebuilt source takes effect. Requires an already-documented `.regen2000proj` — run the analysis
> skills first if one does not exist yet.

**Contention check.** The six existing descriptions and the two drafted above were compared
pairwise for trigger overlap:

- `c64-program-recon` triggers on *discovering* structure ("find the main loop", "identify a game
  state machine") — does not claim "document every routine" or "rebuild," so it does not compete
  with either new skill.
- `c64-memory-mapping` triggers on *looking up* a known address's meaning or *annotating a listing
  someone hands it* — does not claim "walk a queue of undocumented routines" (a program-wide sweep,
  not a lookup), so no overlap with the new routine-walker.
- `c64-annotate-routines` (new) explicitly requires block classification to already exist and never
  claims to *discover* structure — the boundary with `c64-program-recon` is "recon decides what a
  block is; this skill documents blocks already decided to be routines."
- `c64-rebuild` (new) explicitly requires an already-documented project and never claims to *analyze*
  or *assemble in isolation* — the boundary with `acme-build` is "acme-build only ever assembles
  source handed to it; this skill decides what that source looks like and hands it over," and the
  boundary with `c64-provenance-diff` is "provenance-diff decides a verdict per byte range; this
  skill consumes that verdict, it never re-derives one."
- Packer identification is folded into `c64-program-recon`'s existing trigger surface (already
  covers "reverse engineer a C64 game," which a packed binary is a special case of) rather than
  spawning a third new skill — it is one more recon finding, not a separate job.

### Q5 — Data flow end to end

| Stage | Real file(s)/module(s) | Status |
|---|---|---|
| packed `.prg` | user input | — |
| packer identification | `anno_get_binary_info` (entropy hint, curated) + `anno_unpack_binary` (uncurated today) | **NEW** — mechanism needs the Q0 spike; likely folds into `c64-program-recon`, no new tool name confirmed yet |
| depack | `anno_unpack_binary` (28-tool surface, not yet curated; destructive by upstream design) | **NEW** — curation + a safe orchestration point (must run before any other annotation work, since it wipes existing comments/labels/blocks) |
| project bootstrap | `src/mcp/vice/anno-cli.ts::cmdBootstrap`, `anno-project.ts::synthesizeProject` | **EXISTS** (v0.3.0 Phase 10) |
| block classification | `anno_set_data_type`, `anno_disassemble`, `anno_add_scope`, `anno_get_blocks` (all curated) | **EXISTS at tool level**; sequencing/coverage-measurement orchestration is **NEW**, owned by `c64-program-recon` |
| routine documentation | `anno_set_label_name`, `anno_set_comment`, `anno_add_scope`, `anno_get_cross_references`, `anno_search_disassembly`, `anno_read_region` (new curation), `anno_batch_execute` | **NEW orchestration** (queue-walk), owned by the new `c64-annotate-routines` skill; needs the persistent session (Q1) to be affordable at program scale |
| symbol documentation | `anno_get_symbols`, `anno_apply_enum_usage`, `anno-enum-gen.ts` (`gen-enums` verb) | **EXISTS at tool level** (v0.3.0 Phase 11); coverage-measured sweep is **NEW**, owned by `c64-memory-mapping` |
| subsystem split | `src/mcp/vice/anno-rebuild-export.ts` (new), driven off `anno_add_scope`'s existing scope boundaries | **NEW** |
| symbolised multi-file export | same module as above (`export-source` verb) | **NEW** |
| hazard report | `src/mcp/vice/anno-hazards.ts` (new), `hazard-report` verb | **NEW** |
| provenance carry | `src/mcp/vice/anno-provenance-carry.ts` (new), consuming `recovery/RELEASES.json`/`recovery/PROVENANCE.md` (`src/skills/c64-provenance-diff/scripts/diff-images.mjs`'s existing committed output) | **NEW adapter, EXISTING data source** |
| ACME assemble | `src/skills/acme-build/scripts/acme.mjs build`, via ACME's `!source` | **EXISTS**, unmodified |
| run in VICE | `vice_autostart`/`vice_disk_attach` etc. (existing `vice_*` tool surface) | **EXISTS**, unmodified |
| behavioural compare against the original | `src/skills/c64-ram-capture/scripts/compare.mjs` (`compare`/`floor` verbs, drift classification) | **EXISTS at tool level**; using it to compare a *rebuild's* capture against the *original's* capture is a **NEW application**, owned by the new `c64-rebuild` skill |

### Q6 — Suggested build order

Numbering continues from Phase 17 per `PROJECT.md` (this milestone starts at **Phase 18**). Two
"instrument before the work it gates" placements are deliberate, mirroring v0.4.0's Phase 12
audit-gate-first precedent: the save-discipline guard is built and proven *before* anything else
depends on the persistent session, and the coverage/hazard instruments are built *before* the passes
they measure are declared complete.

**Phase 18 — The enabler: persistent session + its own proof, first.**
- Extend `anno-mcp-client.ts` with the long-lived session primitive (§Q1); add `anno-session.ts`.
- Rewire `runAnnoTool()` (`anno-tools.ts`) to use it, preserving save-per-mutation exactly.
- Build and land the Q2 planted-violation test **before** any downstream skill is written to depend
  on the persistent session — this is the phase's own go/no-go gate, not a checkbox at the end.
- Curate `anno_read_region` (every absorbed procedure needs it — named explicitly in `PROJECT.md`
  as the concrete gap).
- Re-decide D-32 (`anno_get_address_details`) against the live 64K defect — small, independent, and
  touches the same file already being modified.
- Update `spawn-seam.test.ts`'s fixtures for the long-lived path.
- **Why first:** every later phase's skills assume a session that survives across many small calls;
  building them against the old per-call lifecycle first would mean rewriting them a second time.

**Phase 19 — Absorb the procedures; build the coverage instrument before running the sweep.**
- Read upstream's five `.agent/skills/` procedures at the pinned 0.9.20 GitHub tag (external
  reference read, not a live dependency).
- Modify `c64-program-recon` (absorbs `-blocks`, packer-id framing) and `c64-memory-mapping`
  (absorbs `-symbol`).
- Write the new `c64-annotate-routines` skill (absorbs `-routine` + the queue-walk half of
  `-program`'s orchestration).
- Build `anno-coverage.ts` (the "measured, not asserted" instrument) **before** running any full
  decomposition pass with it — so the pass has a target to run against rather than a claim made
  after the fact.
- Resolve the Q0 packer-identification mechanism spike here, before it's load-bearing.
- **Depends on Phase 18** (needs the persistent session and `anno_read_region` to make the
  queue-walk affordable; needs D-32 resolved since the absorbed procedures may reach for
  `get_address_details`-shaped answers and need a documented alternative route).

**Phase 20 — Run decomposition to closure on synthetic fixtures.**
- Execute the absorbed procedures via the new skills against the milestone's committed synthetic
  `.prg` fixtures, driven by `anno-coverage.ts`'s report, until nothing is left `Undefined`, every
  entry point is named, and every hardware write renders as an enum.
- **Depends on Phase 19** (needs the instrument and the skills to exist first).

**Phase 21 — The rebuild/export pipeline, and its own gate, before the rebuild skill needs it.**
- Build `anno-rebuild-export.ts` (`export-source`), `anno-hazards.ts` (`hazard-report`),
  `anno-provenance-carry.ts`.
- Build the "reassembly plus a clean hazard report gates every phase" mechanism *here*, as the
  instrument, so Phase 22's work runs under it rather than being checked against it after the fact —
  the same instrument-before-work sequencing as Phase 18/19.
- **Depends on Phase 20** (needs a fully-documented fixture project to export against).

**Phase 22 — The rebuild skill, modifiability demonstration, and behavioural comparison.**
- Write the new `c64-rebuild` skill, wiring `export-source` → `hazard-report` →
  `provenance-carry` → `acme-build` → VICE run → `compare.mjs`.
- Demonstrate modifiability against a synthetic fixture: one behaviour removed, one added,
  reassembled, both observed taking effect in VICE — the milestone's only acceptance criterion that
  can fail structurally-clean source that is still miserable to change.
- Run `compare.mjs`'s drift-floor classification between the rebuild's capture and the original's —
  the milestone's final bar, explicitly not byte-identity.
- **Depends on Phase 21's gate** (this phase's work is exactly what that gate exists to check).

## 4. Anti-patterns to avoid, specific to this integration

### Re-deriving the save-discipline invariant per call site

Every future mutating `anno_*` tool (or CLI verb, if one is ever added that mutates) must route its
save timing through the same single seam `runAnnoTool()` already establishes, never re-implement
"call, then save" locally. A second, slightly different save-timing policy is exactly the kind of
drift this project's "one authoritative place" convention (`anno-tools.ts`'s own header) exists to
prevent.

### Treating the persistent session as a license to relax save timing

The whole value of Q1's design is that persistence changes *process lifetime*, not *durability
contract*. A future change that defers saves "for performance" across multiple mutating calls without
routing through the already-sanctioned `anno_batch_execute` batching mechanism reopens exactly the
class of bug Phase 9 found, this time inside a single-owner session rather than across multiple
connections — arguably harder to notice because there is no second connection to blame.

### Letting the rebuild pipeline depend on the external analyser's own `--export_asm` formatting

Post-processing the single-file exporter's text output (rather than reading structured data via
`anno_get_blocks`/`anno_get_symbols`/etc. and rendering ACME text directly) would make the
subsystem split fragile against upstream formatting changes with no contract protecting it — prefer
the structured-read-and-render pattern this project already uses successfully in
`anno-enum-gen.ts`/`anno-memmap-render.ts`.

### Adding a new `anno_*` MCP tool for a batch/file-producing operation

Per Q3, the CLI-verb precedent exists for a reason (heavier, file-producing operations reached by
skills through the CLI, not through the live-mutation tool surface an LLM drives mid-conversation).
Adding `anno_export_source` as an MCP tool would also reopen the "no `tools_call`-shaped meta-tool"
concern `anno-tools.ts`'s own header names for `anno_batch_execute` — a large orchestration
behind one tool name is the wrong shape for this surface.

## Sources

- `.planning/PROJECT.md` (Current Milestone v0.5.0 section, Active requirements, Key Decisions,
  Constraints) — read in full this session.
- `.planning/ARCHITECTURE.md` (Rules A1–A20, Architecture Change Procedure) — read in full.
- `src/mcp/vice/anno-tools.ts`, `src/mcp/vice/anno-cli.ts`, `src/mcp/vice/anno-mcp-client.ts`,
  `src/mcp/vice/anno-launch.ts`, `src/mcp/vice/anno-project.ts` — read in full or substantially
  this session, ground truth for every claim about existing curation, argv builders, and the
  spawn/save contracts.
- Live probe this session: `analyser --help` (0.9.20); a live `tools/list` call against a
  freshly synthesized `.regen2000proj`, confirming the 28-tool surface and the exact schemas of
  `anno_read_region`, `anno_get_binary_info`, `anno_get_address_details`, `anno_unpack_binary`.
- `find`/`grep` over `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/analyser-0.9.20/`
  — confirmed no `.agent/skills/` directory ships in the published crate.
- `src/skills/*/SKILL.md` frontmatter (all six) — read in full for the contention check in §Q4.
- `src/skills/c64-provenance-diff/SKILL.md`, `src/skills/c64-ram-capture/SKILL.md` — read for the
  real artifact names (`recovery/RELEASES.json`, `recovery/PROVENANCE.md`, `compare.mjs`'s
  `compare`/`floor` verbs) cited in §Q5.

---
*Architecture research for: c64-re-tools v0.5.0 rebuild-pipeline integration*
*Researched: 2026-08-23*
