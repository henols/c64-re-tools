# Stack Research

**Domain:** MCP session-lifecycle management + multi-file ACME source emission (v0.5.0, "The rebuild half")
**Researched:** 2026-08-23
**Confidence:** HIGH — every claim below is either read directly from the installed `the external analyser` 0.9.20 crate source at `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/`, the installed binary's live `--help` output, this repo's own committed source, or ACME 0.97 "Zem"'s own shipped documentation (`/usr/share/doc/acme/*.txt`). No claim below is from memory of prior LLM training data about these tools.

## Headline finding

**No new runtime dependency is needed for either half of this milestone's enabler work.** The persistent session is built by extending `src/mcp/vice/anno-mcp-client.ts`'s existing hand-rolled `node:child_process`/`node:readline` client (same libraries it already uses) to survive across calls instead of one-shot. The multi-file ACME emission is built entirely in this repo's own TypeScript over the external analyser's existing `anno_read_region`/`anno_get_symbols`/`anno_get_comments`/`anno_get_cross_references` tools and ACME's already-supported `!source` mechanism — `src/skills/acme-build/scripts/acme.mjs` needs **zero code changes** to assemble the result. This keeps the milestone inside `ENGINEERING_RULES.md` §4's dependency bar (no new dependency to justify) and inside the "no build step for the shipped server" constraint.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `analyser --mcp-server-stdio` | 0.9.20 (installed, `analyser --version` confirmed live) | The persistent-session transport | The **only** collision-free option. `--mcp-server` hardcodes HTTP port 3000 with no CLI override — confirmed by reading `main.rs:397`, `regeneratoanno_core::mcp::http::run_server(3000, mcp_req_tx)`, a literal `3000` passed to a function whose own signature (`http.rs:153`, `pub async fn run_server(port: u16, ...)`) *could* take a different port — the CLI simply never exposes one. `--mcp-server-stdio` has no port at all: it is a plain `spawn()`ed child reading newline-delimited JSON from stdin and writing to stdout (`stdio.rs`'s `run_headless_stdio_loop`), so N concurrent projects/containers each get their own private pipe with no shared listener to collide on. |
| `node:child_process` (`spawn`, not `spawnSync`) | Node ≥ 22.18 built-in | Spawns and holds the long-lived the external analyser child | Already the mechanism `anno-mcp-client.ts`'s `withAnnoSession()` uses. No change of primitive — only a change to *how long the process is held open* (see Session-lifecycle section below). |
| `node:readline` (`createInterface`) | Node ≥ 22.18 built-in | Frames the child's newline-delimited JSON-RPC stdout | Already used in `anno-mcp-client.ts`. The external analyser's own stdio loop is confirmed (read live in `stdio.rs`) to emit exactly one JSON object per `println!` per response — no framing ambiguity to solve. |
| ACME | 0.97 "Zem" (31 Jan 2021), on `$PATH` | Assembles the multi-file, `!source`-wired rebuild output | Already the project's fixed assembler (`acme-build` skill). No version change and no new flags needed — `!source` and `-I` are already exercised by `acme.mjs`. |

### Supporting Libraries (all already-dependencies, none newly added)

| Library | Version (as installed in this repo) | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@mastra/mcp` | 1.15.0 (`src/mcp/vice/package.json`) | Declared dependency that transitively vendors the MCP TypeScript SDK | Do **not** call its `MCPClient` for the persistent session (see Alternatives Considered). Its stdio server side (used by `vice-proxy.ts` to *serve* Claude Code) is unaffected by this milestone. |
| `@modelcontextprotocol/sdk` | 1.30.0 (confirmed via `node_modules/@modelcontextprotocol/sdk/package.json`, hoisted transitively; `^1.29.0` pinned as a peer/transitive range in `package-lock.json`) | The package `StreamableHTTPClientTransport` lives in | **Not imported directly anywhere in this repo today**, and this milestone should not be the first to do so — `anno-mcp-client.ts`'s own header already forbids it: "Never import the underlying MCP TypeScript SDK package directly. It is reachable today only as an undeclared transitive dependency of `@mastra/mcp`... a direct import here would be an ENGINEERING_RULES.md §4 phantom-dependency violation waiting for a dedup change to break it." That reasoning is unchanged by persistence. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node's built-in test runner (`node --test`) | Testing the new persistent-session module and the multi-file emitter | No new framework. A persistent-session test needs a stub external-analyser-shaped child (same technique `anno-mcp-client.test.ts` presumably already uses via `ANNO_BIN`/`bin` override) — plus, per `ENGINEERING_RULES.md` §9 (Live-Test Policy) and this project's own repeated "internal check standing in for an external one" lesson, a live test gated behind the real installed binary, mirroring `spawn-seam.test.ts`'s existing pattern. |
| Real ACME 0.97 | Verifying multi-file emission actually reassembles | `acme.mjs build <entry>.a -I <dir>` against a synthesized multi-file fixture, exactly as `disasm-roundtrip.test.ts`/`ANNO-06`'s `--verify` gate already does for the single-file case. |

## Installation

No `npm install` is required for this milestone's stack — everything above is either already declared in `src/mcp/vice/package.json`, a Node built-in, or an external binary (`the external analyser`, `acme`) already documented as a prerequisite.

```bash
# Nothing new. Confirm the existing prerequisites are present:
The external analyser --version   # the external analyser 0.9.20 (verified live on this host)
acme --version               # This is ACME, release 0.97 ("Zem"), 31 Jan 2021 (verified live)
node --version                # >= 22.18
```

## Detailed Answers

### 1. Session transport — hand-roll a persistent stdio client; reject HTTP and `MCPClient`

**Use `--mcp-server-stdio`, and extend the existing hand-rolled client rather than adopting `StreamableHTTPClientTransport` or `@mastra/mcp`'s `MCPClient`.**

Live-verified facts driving this:

- `analyser --help` (run on this host) lists `--mcp-server` as *"Run MCP server (HTTP port 3000)"* and `--mcp-server-stdio` as *"Run MCP server (stdio, headless)"* — no `--mcp-port` / `--mcp-bind` flag exists in either the help text or the CLI's `clap` arg struct (`main.rs`, `mcp_server`/`mcp_server_stdio` fields only).
- The HTTP path's port is a **literal `3000`** baked into the CLI binary, not a configurable default: `main.rs:397` calls `regeneratoanno_core::mcp::http::run_server(3000, mcp_req_tx)`. The underlying library function (`external-analyser-core`'s `http.rs:153`, `pub async fn run_server(port: u16, sender: Sender<McpRequest>)`) *does* accept a port — this is the "known unlanded upstream PR" the milestone context refers to: a five-line CLI change (thread a flag through to the existing parameter) that has not shipped. Until it does, **every concurrently-running `--mcp-server` process on a host collides on `127.0.0.1:3000`**, confirmed structurally, not merely documented.
- `--mcp-server-stdio` has no such surface at all: `stdio.rs`'s `run_headless_stdio_loop` is a private-pipe `read_line`/`println!` loop with no network listener whatsoever. Each spawned child is a private, per-caller channel by construction — the collision class does not exist for it. This matches CLAUDE.md's existing project-wide preference for solving concurrency by construction, not by detection (compare the `--vice` guard).
- Both transports dispatch through the **same** `handle_request()` function in `handler.rs` — the Phase 9 probe's live HTTP measurement (28 tools via `StreamableHTTPClientTransport`) and this project's existing stdio client see an identical tool surface. Choosing stdio costs nothing in capability.

**The prior "hand-roll vs. `MCPClient`" decision still applies, and applies with equal or greater force to a persistent session.** That decision (`anno-mcp-client.ts`'s header, and `docs/phase9-external-analyser-probe-findings.md`'s live measurement is a separate, HTTP-specific data point, not the client-shape decision itself) measured five properties against `@mastra/mcp` 1.15.0's `MCPClient` and found it lacking exactly one: **no member exists on `MCPClient`'s reflected prototype for retrieving a spawned child's exit code once its session has closed.** For a *persistent* session this property does not become less important — it becomes the load-bearing one. A session that lives across "a whole working session instead of being respawned per tool call" (this milestone's own wording) is a session that can crash, hang, or be killed hours into a recon session; the caller needs exactly the same "is this an unanswered-but-alive call, a dead child, or a clean exit" three-way distinction `AnnoTimeoutError`/`AnnoChildExitError`/`AnnoSessionFailedError` already encode — the failure surface **grows** with session lifetime, it does not shrink. Recommend: keep the existing three-way distinction, reuse it verbatim, and add a fourth state the current one-shot model has no use for — "session is alive and idle, ready for the next call" — which only a genuinely long-lived client needs to represent at all.

Concretely, this means evolving `anno-mcp-client.ts` (or a new sibling module, see below) so that:
- `spawn()` happens once per working session (or once per acquire, if a pool-of-one abstraction is used) instead of once per `withAnnoSession()` call.
- The `pending` map, `nextId` counter, and `readline` interface become held state across many `call()` invocations, not torn down after one.
- `child.once("exit", ...)` still fires the same `AnnoChildExitError` rejection for anything in flight — unchanged from today — but now it also needs to flip a `sessionAlive` flag the next `call()` checks *before* attempting a write, giving a `AnnoChildExitError`-shaped early rejection instead of a silent `EPIPE` on a dead stdin.
- `saveAndVerify()`'s file-hash-based "prove it, don't trust the child's own text" pattern is unchanged and remains the correct check for a persistent session's saves.

### 2. Process lifecycle — do not reuse the broker; build a much smaller in-process supervisor

**Do not route the persistent analyser session through `vice-broker.mts` or the TCP control plane.** The broker's entire reason to exist is a boundary analyser case does not have:

- The broker manages **host-side** `x64sc` processes from **container-side** callers — that is why it needs a TCP control plane at all (`vice-broker-client.ts` dials `host.docker.internal`/`127.0.0.1` across the container boundary), why it needs port allocation (many emulator instances, each needing its own binary-monitor port), and why crash supervision is a separate always-running daemon process (`vice-broker.mts`) rather than inline code in the same process that needs the emulator.
- the external analyser is **container-side, same side as the MCP proxy** (`ANNO-02`, CLAUDE.md's derived-tool constraint note, and independently re-confirmed live in this research: the `anno_*` family registers through `buildViceTool()` and never reaches `forwardToVice()`/`hostpath.ts`/`containerpath.ts`). There is no boundary to cross. A persistent the external analyser session is a plain child of the *same Node process* that is already running `vice-proxy.ts` — the same relationship `anno-mcp-client.ts` already has with it today, just held open longer.
- Reusing the broker's machinery here would mean building a TCP listener, a capability-token auth scheme, and a `broker.json`-shaped state file for a process that never leaves the container and is only ever addressed from inside that same container's own event loop — solving a problem (cross-process, cross-machine addressing) that does not exist for this case, while inheriting a real cost this project has already had to accept once and reason carefully about (`PKG-04`'s `0.0.0.0` control-plane bind risk). Building a second listener with the same risk shape for no structural reason would be a regression, not reuse.

**What genuinely is worth borrowing — as a pattern, not as shared code:**

- **The single-owner, synchronous-check-and-set launch guard.** `broker-launch.mts`'s `inFlight` guard exists because of a real dated outage (2026-08-01, triple-launch) and CLAUDE.md pins it as "must stay a synchronous check-and-set with no `await` between." The identical race is possible here: two `anno_*` tool calls arriving close together, both seeing "no session yet," both calling `spawn()` against the same project file. The fix is the same shape — a module-level boolean (or a promise-of-the-in-progress-launch, so a second caller awaits the first's result rather than racing it) checked and set synchronously before the first `await`. This is a two-line pattern to copy, not a reason to depend on the broker module.
- **Incident-before-kill discipline.** `incident-record.ts`'s "write state before any destructive action" principle applies directly if this milestone ever needs to recycle a wedged analyser session — `saveAndVerify()` should be attempted (with a short timeout) before any forced kill, so an in-progress annotation is not silently lost. This is a principle to apply inside the new module, not a dependency on `incident-record.ts` itself (that module is shaped around VICE snapshots specifically).

**Recommended shape:** a new sibling module (e.g. `anno-session.ts`, next to `anno-mcp-client.ts` in `src/mcp/vice/`) that owns exactly one live the external analyser child per project path, exposing `acquire(projectPath) -> AnnoCall`-shaped access, built from the primitives `anno-mcp-client.ts` already has (`spawn`, `readline`, the `pending`/`nextId` correlation, the four named error classes), plus the synchronous launch guard above. No new package, no new protocol, no new listener.

**One header comment needs to change as part of this, not be silently outdated:** `anno-mcp-client.ts`'s own file-level comment states as a settled invariant, "Never keep a child alive between logical operations (D-17)... There is no long-lived child, no supervision, and no second wedge class to add to this project's existing stock-VICE one." This milestone's own opening context calls the reversal of D-17/D-18 out explicitly ("a deliberate reversal of D-17/D-18"). Whichever plan does this work must update that comment (and the "second wedge class" framing needs an honest answer, not silence — a long-lived the external analyser child genuinely *is* a second thing that can wedge, and the existing `vice-wedge-triage` skill's playbook does not cover it).

### 3. Multi-file ACME emission — supported by ACME today, unsupported by the external analyser's exporter; the split is this repo's own new code

**the external analyser has no multi-file export of any kind.** Read directly: `exporter/asm.rs`'s `export_asm()` builds one `output: String` and writes it to one `path: PathBuf` — `state.scopes` is threaded into the `DisassemblyContext` only to feed the same single-stream disassembler formatter (e.g. scope-boundary comments), never to decide "start a new file here." There is no per-scope or per-subsystem output path anywhere in `exporter/`. **The one-file-per-subsystem split is entirely new code this project must write** — most naturally as a post-processing pass that, for each subsystem `!zone`/scope, calls `anno_read_region` (or a symbol-only equivalent built from `anno_get_symbols`/`anno_get_comments`) over that scope's address range and writes the result to its own `.a` file, rather than trying to slice the external analyser's single flat `--export_asm` output textually after the fact.

**ACME 0.97 itself imposes no obstacle to this — confirmed directly against its own shipped documentation, not inferred:**

- **`!source FILENAME` (alias `!src`)** — "Assemble another source code file. After having processed the new file, ACME continues processing the old one." (`AllPOs.txt`, Section: File stuff). Loads relative to the current directory in `"..."` quoting, or from a library path in `<...>` quoting resolved via `-I`/`$ACME` — exactly the mechanism `acme.mjs` already threads through (`-I DIR` → `args.push("-I", i)`). **`acme.mjs` needs zero changes**; the "multi-file project" is just an entry `.a` file whose body is a sequence of `!source "subsystem-x.a"` lines, passed to the existing `build` verb exactly as today.
- **`* = EXPRESSION` (origin) is a plain statement, valid anywhere a statement is valid — including inside an included file.** ACME's own canonical multi-file example (`AllPOs.txt`, Section: Segment assembly) is literally `!to`, `* = $0801`, `!src "basicmacros.a"`, `+basic_header`, `!src "main.a"`, `* = $1000`, `!bin "music.b"`, `* = $8000`, `!bin "pic.b"` — origin changes interleaved with includes, in the assembler's own reference material. Nothing restricts `*=` to the top-level/entry file.
- **Label scope crosses `!source` boundaries by default — `!source` does *not* implicitly start a new zone.** Global labels (leading letter/underscore) "can be accessed throughout the whole assembly" regardless of which file defines or references them (`QuickRef.txt`, Section: Example). Local labels (leading `.`) and anonymous labels (`+`/`-`) are scoped to "the current zone" (`!zone`) or macro, **not to the file** — so two subsystem files each using `.loop` as a local label name are safe *only if* each is wrapped in its own `!zone` (or each subsystem's globally-visible entry point is a distinct global name and everything else stays local within an explicit per-file `!zone` block). "Cheap locals" (`@name`) are a third option, automatically scoped between the previous and next *global* label rather than by file or zone, which may suit small per-routine temporaries inside a subsystem file without needing an explicit `!zone` wrapper at all.
- **Forward references across files are fully supported.** ACME "always takes as many passes as are needed" (`QuickRef.txt`) — a global symbol referenced in a file `!source`d *before* the file that defines it resolves correctly. This is the property that makes "wire subsystem files together with `!source`, referencing each other's exported symbols regardless of load order" actually work, and it needs no special handling from this project beyond making every cross-subsystem-referenced symbol global rather than local.
- **One `!to`/`-o` output assembled from many `!source`d files is not an edge case — it is the documented, intended use of `!source`.** No special ACME flag or mode is needed; the existing `acme.mjs build <entry>.a -I <libdir>` invocation already produces exactly one `.prg`/`.sym`/`.vs`/`.rep` set regardless of how many files the entry `!source`s.

**Recommendation for how scopes map to files:** treat each the external analyser `scope` (`anno_add_scope`'s `start_address..end_address`, the literal "subsystem" grouping the milestone names) as one `!source`d `.a` file, wrapped in its own `!zone <scope-name>` so each subsystem's internal local/anonymous labels cannot collide with another subsystem's, with every symbol meant to be referenced *across* subsystem boundaries (every entry point, every shared data table) emitted as a plain global label rather than a local one. Data tables get their own files under the same rule (the milestone's own wording — "data tables in their own files").

### 4. Symbolisation and relocation-hazard detection — nothing exists; this must be built

**Direct, unhedged answer: no npm package, no Rust crate, and no feature of the external analyser itself converts absolute-addressed disassembly into symbol-only movable source or detects relocation hazards.** Confirmed by exhaustive source search of the installed `external-analyser-core-0.9.20` crate (`grep -rn "jump_table\|JumpTable\|self.modif\|SelfModif\|page_align\|PageAlign\|relocat\|Relocat"` across the whole crate returned **zero matches**) — the external analyser has no concept of a relocation hazard at all. There is no npm ecosystem equivalent either; disassembler-to-source "symbolisation" tools in this space (IDA, Ghidra, capstone-based scripts) are not npm/crates.io packages and are out of scope for this project's dependency policy regardless.

**What the external analyser does give this project, as building blocks it must assemble itself:**

| Primitive | What it is | How it feeds hazard detection |
|-----------|-------------|-------------------------------|
| `anno_get_blocks` / `BlockType` enum | Confirmed enum values (`state/types.rs:314`): `Code`, `DataByte`, `DataWord`, `Address`, `PetsciiText`, `ScreencodeText`, `LoHiAddress`, `HiLoAddress`, `LoHiWord`, `HiLoWord`, `ExternalFile`, `Undefined` | `Address`/`LoHiAddress`/`HiLoAddress`-typed blocks are the closest existing primitive to "this is a jump table's entries" — a contiguous run of `Address`-typed words inside a `Code`-adjacent region, cross-referenced by an indirect `JMP (table,x)`-style site, is the detectable shape. `Undefined` is directly the milestone's own coverage metric ("nothing left `Undefined`" is measured, not asserted, precisely by counting this enum value across `anno_get_blocks`'s output). |
| `anno_get_cross_references` | Who references a given address, in both directions | The substrate for **self-modifying-code detection**: cross-reference a `Code`-typed address against every *write*-instruction operand target (`STA`/`STX`/`STY`, decoded from `anno_read_region`'s disassembly text) landing on that same address. No such check exists in the external analyser itself — this project must decode operand targets and intersect them against code ranges. |
| `anno_add_scope` / `scopes` (`BTreeMap<Addr, Addr>`) | Named subsystem regions | The natural unit both for the multi-file split (§3) and for scoping a hazard report per subsystem rather than per address, matching the milestone's "relocation-hazard report enumerates what blocks movement" wording. |
| `anno_get_symbols` / `anno_get_comments` | Every label/comment, queryable | The symbol-only rendering substrate: emitting a branch/`JSR`/`JMP`/data-reference target as its symbol name rather than its raw address (the milestone's "every branch, `JSR`/`JMP` and data reference goes through a symbol") is a direct lookup against this, not a new analysis. |
| `packer_signatures.rs` / `state.detected_packer` | A real signature scanner (Exomizer 1.x/2.x/3.x, and others per its module) already shipped in external-analyser-core | This is the one piece of the milestone's target list ("which packer a binary used") that the external analyser *does* already solve — surface `detected_packer`/the equivalent MCP field as a recon finding rather than reimplementing signature scanning. |

None of the four named hazard classes in this milestone (jump tables with baked-in addresses, self-modifying code, page-alignment dependence, cycle-exact raster code) has a canned detector anywhere in this stack. Each is bespoke analysis code, one narrow heuristic at a time, built on the four primitives above plus `c64-memory-mapping`'s existing register/enum data (for the "is this a raster-timing-sensitive VIC-II write" question specifically — `$D011`/`$D012`/`$D019` etc. are already named there). Say this plainly to whoever plans the phase: **budget it as new analysis code, not as "wire up library X."**

### 5. What NOT to add

Following this project's own repeatedly-applied discipline ("does a shipped skill call it, or does something a skill calls depend on it?" — 17 cuts in v0.2.0, 4 more in v0.3.0):

- **Do not add `StreamableHTTPClientTransport` / `--mcp-server` (HTTP) as the persistent-session transport.** Structurally disqualified by the hardcoded port-3000 collision (confirmed at `main.rs:397`), not merely inconvenient. No measured advantage over stdio exists for a single in-process child — the Phase 9 probe's HTTP measurement was answering a different question (does the tool surface work at all over MCP), not choosing a transport for this milestone.
- **Do not adopt `@mastra/mcp`'s `MCPClient` for the persistent session.** The disqualifying property from the original five-property measurement (no exit-code reachability after session close) applies with *more* force to a long-lived child, not less — this is the client most likely to need to tell a crash apart from a hang, months into a real recon session.
- **Do not import `@modelcontextprotocol/sdk` directly**, for the persistent client or anything else in this milestone. It remains an undeclared transitive dependency; a direct import is a phantom-dependency violation under `ENGINEERING_RULES.md` §4, independent of the functional argument above.
- **Do not route the persistent analyser session through `vice-broker.mts` / its TCP control plane / port allocation / warm floor.** That machinery solves a container-to-host boundary crossing that does not exist for a container-side child of the same process. Building a second control-plane listener here would import PKG-04's already-accepted bind-exposure risk shape for a problem that has no boundary to guard.
- **Do not build a general-purpose, pluggable relocation-hazard framework.** Build exactly the four named checks (jump tables, self-modifying code, page alignment, cycle-exact raster) as narrow heuristics over the primitives in §4's table. A generic framework has no measured caller yet and this project's own history (17 + 4 cuts) is explicit that "might be useful generally" is not the bar.
- **Do not add multi-assembler output (64tass/ca65/KickAssembler).** the external analyser supports all three natively, but this project's fixed target has always been ACME/`!cpu 6510`/cbm format (`acme-build`'s whole reason to exist). Scope creep here has no shipped-skill caller.
- **Do not attempt BASIC token decoding** (`analyze-basic`). Explicitly named "not in this milestone" in `PROJECT.md`'s own Current Milestone section.
- **Do not pursue either of the two standing upstream PRs** (`KEYBOARD_MATRIX_SET` for VICE's binary monitor; the external analyser's `--mcp-port`/`--mcp-bind`) as part of this milestone's stack work. Both remain out-of-repo asks, unchanged from v0.4.0's Out of Scope, and the port-flag one specifically is *why* stdio is this milestone's answer rather than something to wait for.
- **Do not silently leave `anno-mcp-client.ts`'s D-17 header comment standing** once a persistent-session path exists beside it. It currently asserts as settled fact exactly what this milestone reverses ("There is no long-lived child, no supervision"); leaving it unedited would let a future reader trust a now-false invariant — this is a same-shape mistake to the "stale claim confidently restated" lesson `PROJECT.md`'s own Context section names twice this project already learned the hard way.
- **Do not trust `anno_get_address_details`'s `OutOfRange` verdict for a full-64K project without a client-side workaround.** The upstream `u16`-overflow defect (`raw_data.len() as u16` wrapping 65536→0) is still present in the installed 0.9.20 build — re-confirmed live at `handler.rs:1894` in this research session, not merely carried from the Phase 9 finding. D-32's current refusal is a reasonable stopgap; re-deciding it (the milestone's own stated goal) most likely means a small client-side special-case (detect the full-64K case and answer from `anno_get_blocks`/`anno_get_binary_info` instead of trusting the tool's own range check) rather than a new dependency or an upstream wait.

## Alternatives Considered

| Recommended | Alternative | When the alternative would be right |
|-------------|-------------|--------------------------------------|
| Extend the hand-rolled stdio client into a persistent-session module | `@mastra/mcp`'s `MCPClient` over stdio | Only if a future `@mastra/mcp` release adds exit-code-after-close to `MCPClient`'s public surface — re-measure the same five properties before switching, do not assume this changed. |
| `--mcp-server-stdio`, one child per project | `--mcp-server` (HTTP, port 3000) + `StreamableHTTPClientTransport` | Only once the upstream `--mcp-port`/`--mcp-bind` PR lands *and* this project decides multiple simultaneous HTTP sessions are worth the added listener-per-project bookkeeping HTTP would still require even with a port flag — stdio would still be simpler even then, since it needs no port bookkeeping at all. |
| A small new in-process supervisor for the persistent session | Reusing `vice-broker.mts`'s TCP control plane | Only if the external analyser ever needs to run **host-side** (it never will — `--vice` is permanently forbidden and ANNO-02 keeps it container-side by construction) or if this project ever needs a genuine pool of *N* simultaneous the external analyser sessions rather than one-per-project (no stated requirement for this exists). |
| Bespoke hazard-detection heuristics over `anno_get_blocks`/`anno_get_cross_references` | Waiting for/proposing upstream relocation-hazard detection in the external analyser | Only as a separate, explicitly out-of-repo follow-up (same shape as the two existing upstream-PR items already tracked) — not a blocker for this milestone, since the external analyser's issue tracker was not the target of this research and no such feature is close to landing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `--mcp-server` (HTTP, port 3000) as the persistent-session transport | Hardcoded port, confirmed via `main.rs:397`; collides across concurrent projects/containers on the same host network namespace | `--mcp-server-stdio`, one private pipe per project |
| `@mastra/mcp`'s `MCPClient` | Missing exit-code-after-close, the exact property a long-lived, occasionally-crashing child needs most | The existing hand-rolled client in `anno-mcp-client.ts`, extended to persist |
| Direct `@modelcontextprotocol/sdk` import | Undeclared transitive dependency; phantom-dependency violation per `ENGINEERING_RULES.md` §4 | Same as above — no SDK import needed at all |
| `vice-broker.mts` / TCP control plane for the external analyser supervision | Solves a container/host boundary this process does not have; imports the broker's own accepted attack surface for no structural reason | A small new in-process module borrowing only the *pattern* of the single-owner synchronous launch guard |
| A generic relocation-hazard-detection framework | No measured caller beyond the four named checks; this project's discipline explicitly rejects speculative generality | Four narrow, named heuristics built directly against `anno_get_blocks`/`anno_get_cross_references`/`anno_read_region` |

## Stack Patterns by Variant

**If a future milestone needs more than one the external analyser project open simultaneously in the same process** (no current requirement):
- Generalize the new session module to a small keyed map (`projectPath -> session`), still with the same synchronous single-owner guard *per key*.
- Still do not reach for the broker's TCP control plane — the boundary that justifies it (cross-process/cross-machine) still would not exist.

**If the external analyser ever ships `--mcp-port`/`--mcp-bind` upstream** (tracked, not scheduled — same status as `KEYBOARD_MATRIX_SET`):
- Re-run the same five-property `MCPClient` measurement against the HTTP transport before switching anything — a port flag fixes the collision problem but does not by itself fix `MCPClient`'s missing exit-code-after-close property, which is a client-library gap, not a transport gap.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `the external analyser` 0.9.20 | rustc ≥ 1.90 (verified floor, not the Cargo.lock-pin-derived 1.88 or the edition-2024 1.85 readings — both superseded, per `docs/phase9-external-analyser-probe-findings.md`) | Install-time only; irrelevant to this milestone's runtime work since the binary is already installed on this host. |
| `analyser --mcp-server-stdio`/`--mcp-server` | Both dispatch through the same `handle_request()` in `handler.rs` | Tool surface is identical (28 tools) regardless of transport chosen — choosing stdio for concurrency safety costs nothing in capability, confirmed by reading the shared dispatch function, not inferred. |
| `@mastra/mcp` 1.15.0 | `@modelcontextprotocol/sdk` `^1.29.0` (transitive; `1.30.0` resolved in this repo's `node_modules`) | Unrelated to this milestone's recommendation — noted only because the SDK's `StreamableHTTPClientTransport` is what the Phase 9 probe's throwaway harness used to *measure* the HTTP surface, not what this milestone should adopt. |
| ACME 0.97 "Zem" | This repo's `!cpu 6510` / cbm-format convention, unchanged | `!source`/`!zone`/`*=` behavior confirmed directly against the installed 0.97 binary's own shipped docs (`/usr/share/doc/acme/{QuickRef,AllPOs}.txt`), not a newer/older ACME release — do not assume a newer ACME's `!source` semantics without re-checking, per this project's own standing "re-checked against ACME release 0.97" convention in `acme-build/SKILL.md`. |

## Sources

- `analyser --version` / `analyser --help` — run live on this host, 2026-08-23. Confirms `0.9.20`, the exact CLI flag set (`--mcp-server`, `--mcp-server-stdio`, no port flags), and supported file types.
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/analyser-0.9.20/src/main.rs` — read directly: `run_server(3000, ...)` at line 397, CLI flag definitions with the literal "HTTP port 3000" doc comment.
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/src/mcp/{http,stdio,handler}.rs` — read directly: `run_server(port: u16, ...)`'s signature vs. the CLI's hardcoded call site; `run_headless_stdio_loop`'s per-line JSON-RPC loop; the full `anno_*` tool dispatch table; `get_address_details_impl`'s live `u16`-overflow at line 1894, re-confirmed present in this session.
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/src/state/types.rs` — read directly: `BlockType` enum's full variant list.
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/src/exporter/asm.rs` — read directly: confirms `export_asm()` writes one flat file, no per-scope split.
- `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/external-analyser-core-0.9.20/src/packer_signatures.rs` — read directly: confirms real Exomizer signature detection already shipped.
- Full-crate `grep` for `jump_table|JumpTable|self.modif|SelfModif|page_align|PageAlign|relocat|Relocat` across `external-analyser-core-0.9.20/src/` — zero matches, run live this session.
- `/usr/share/doc/acme/QuickRef.txt` and `/usr/share/doc/acme/AllPOs.txt` (from ACME 0.97 "Zem"'s own shipped documentation, extracted this session) — `!source`/`!src`, `!zone`, `*=`/segment assembly, global/local/cheap-local/anonymous label scoping, all read verbatim.
- `acme --version` — run live on this host, confirms `ACME, release 0.97 ("Zem"), 31 Jan 2021` matches the version the docs above describe.
- `src/mcp/vice/anno-launch.ts`, `src/mcp/vice/anno-mcp-client.ts` — this repo's own source, read in full; the five-property `MCPClient` decision, the D-17 one-session-per-operation header comment, the `--vice` guard, and the exact error-class taxonomy.
- `src/skills/acme-build/SKILL.md`, `src/skills/acme-build/scripts/acme.mjs` — this repo's own source; confirms `-I`/entry-file invocation shape needs no change for multi-file `!source` projects.
- `docs/phase9-external-analyser-probe-findings.md` — this repo's own prior live-verified research; cited for the HTTP-mode 28-tool confirmation and the still-open `OutOfRange` defect note, both independently re-confirmed against source in this session rather than merely cited.
- `.planning/PROJECT.md` — this repo's own project record; Current Milestone (v0.5.0 scope, target features, explicit non-goals), Constraints (the external analyser dependency/architecture bullets), Key Decisions (the hand-rolled-client precedent), Out of Scope (the two standing upstream PRs, the two prior cut rounds).
- `.planning/ENGINEERING_RULES.md` §4 (Dependency Policy) — governs the "no new dependency" stance taken throughout this document.

---
*Stack research for: c64-re-tools v0.5.0 — persistent the external analyser session + multi-file ACME rebuild pipeline*
*Researched: 2026-08-23*
