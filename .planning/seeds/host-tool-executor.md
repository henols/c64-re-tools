---
title: "Host-tool executor — one seam for every stateless host binary, reached the way the vice MCP reaches the host"
trigger_condition: "Before any of c1541 / petcat / cartconv is integrated, and before any new skill script spawns an external binary. Independent of the text-monitor work — this seam is needed whether or not the runtime-evidence layer is built."
planted_date: 2026-08-28
---

# Host-tool executor

## The rule (stated by Henrik, 2026-08-28)

> All stateless operations like the disk tool must be skills that have a script
> that can communicate with the orchestrator like the vice MCP does. It must be
> this way since the RE project might be running inside a devcontainer and all
> the applications it is using are installed on the host computer and can't be
> directly accessed.

Stateless host operations are **not MCP tools** — they get their own namespaced
channel into the broker over the same socket port, dialed with a short-lived
open/send/close connection.

A skill script runs **container-side**. `c1541`, `petcat`, `cartconv`, `acme`,
and external unpackers live **host-side**. There is no local PATH to find them
on. They must be reached over the same container-out seam the VICE MCP already
uses: container-side client → TCP control channel → host process.

## This is an existing hole, not a forward-looking rule

**Two skill scripts spawn host binaries in-process today.** Both fail in a
devcontainer:

- `src/skills/acme-build/scripts/acme.mjs:124` — `spawnSync("acme", args, …)`,
  with a PATH-probe ladder over `$ACME`, `/usr/local/share/acme`,
  `/usr/share/acme`, `/usr/lib/acme`, `~/.acme`. Every one of those paths is a
  *container* path.
- `src/skills/c64-program-recon/scripts/packer-finding.mjs:247,306` — probes a
  command with `--version`, then runs it against a file path.

**And the project already paid the cost of the missing seam.**
`src/skills/c64-ram-capture/scripts/d64-parse.mjs` is a hand-written pure-JS
`.d64` parser — BAM, directory chain, the four sector-count zones — whose header
describes it as *"the permanent, sanctioned replacement for the forbidden
`vice_disk_list` tool … pure Node over the disk-image bytes, which is why it
works whether or not VICE happens to be up."* That is `c1541`'s job,
reimplemented in-container because the host copy was unreachable. Adding `c1541`
naively would either duplicate it or break exactly where the rule points.

**No seam exists to reuse.** The broker control protocol carries only
VICE-instance-lifecycle ops — `acquire`, `release`, `recycle`, `status`,
`monitor_claim`, `monitor_release` (`vice-broker-client.ts:372-1015`). Nothing
runs a host binary.

## Shape (refined by Henrik, 2026-08-28)

**Not MCP tools.** Stateless host operations are *not* exposed on the MCP tool
surface. They get their own channel into the broker, **over the same socket
port** the VICE control plane already uses.

**Short-lived, per-request connections.** A skill script opens a connection,
sends one request, reads the response, and closes. No lease, no session, no
warm state.

**Namespaced ops for routing.** Every request carries a prefix naming the
subsystem, so the broker routes without inspecting semantics — VICE lifecycle,
disk tools, disassembly tools, and whatever comes next each get their own
namespace. The current dispatch is a flat `if (req.op === "acquire") … else if …`
chain over a closed 7-member union `ControlRequestKind` (`broker-control.mts:30,534-655`),
terminating in `unknown op` → `bad_request`. Prefixed `op` values slot into that
chain directly.

## Design constraints the existing control plane imposes

These are established from the code, not assumed. Each one shapes the design.

**1. External work must not be able to interfere with the emulator at all — and
that is a structural requirement, not a discipline one (Henrik, 2026-08-28).**
A disk or disassembly call has nothing to do with the emulator and must not be
*able* to reach its state. Three separate couplings exist in the current design,
and each needs its own structural answer:

- **Shared connection state.** `broker-control.mts:388-397` states *"Connection
  close IS the release — including on the client's own SIGKILL"*, firing
  `onRelease` whenever `requestIdForThisConnection` is set (set only by a
  successful `acquire`). An open/send/close host-tool connection is harmless
  today *by accident of that guard*. **Answer:** route on the namespace prefix at
  the top of `handleLine`, before any lease-bearing path, and hand the host-tool
  handler its own deps object containing **none** of the seven VICE callbacks
  (`onAcquire`, `onRelease`, `onRecycle`, `onStatus`, `onHostState`,
  `onMonitorClaim`, `onMonitorRelease` — `broker-control.mts:143-181`). It cannot
  touch lease state because it is never handed anything that reaches it.
  Capability-passing is already this module's idiom, so this is close to free.

- **Shared process fate — the decisive one.** `broker-kill.mts:367-374` registers
  `uncaughtException` and `unhandledRejection` handlers that log and then
  `run(…, 1)`: the kill-and-exit path. This is deliberate and correct for a
  supervisor — never orphan emulators — but it means **any unhandled throw
  anywhere in the broker process tears down the entire VICE pool**. Running a
  host tool inline makes every live emulator hostage to a `c1541` bug.
  **Answer:** host-tool work runs in a child process, never in the broker's own.
  A failure there is a failed response frame, not a broker fault. Without this
  layer, the routing above is insufficient.

- **Shared event loop.** The broker is single-threaded Node. A synchronous
  `c1541 -extract` or a headless disassembler run stalls acquires, the warm floor
  and monitor claims for its whole duration. **Answer:** async spawn only, never
  `spawnSync`. Not corruption, but interference all the same.

What legitimately stays shared: the port, the line framing, and the token gate —
transport and authentication, carrying no emulator state.

**2. 64 KiB hard line cap — bulk output cannot ride inline.** `MAX_LINE_BYTES =
65536` (`broker-control.mts:242`), and on overflow the socket is `destroy()`ed
with no error frame — from the client it is indistinguishable from a connection
drop. Newline-delimited JSON at 64 K/line is fine for `petcat`'s SYS-stub answer
and a `c1541` directory listing; it is **not** fine for a disassembly dump, a
`c1541 -extract`, or a `prof flat` over a large binary. Bulk results must be
written to a **file host-side and returned as a path** (translated back through
`containerpath.ts`), or the channel needs chunked framing. Choose deliberately —
inheriting the cap silently is how this fails in production on the first large
image.

**3. Per-boot capability token on every op.** Auth is a per-boot token,
constant-time compared (`broker-control.mts:262-267`), required before any
handler runs. Skill scripts become a **new class of token consumer**, reading it
from the `.vice-supervisor/` state dir — which they do not do today. Token
discovery from a skill script, in-container, is its own small design problem.

**4. Wire-compat across separately-deployed halves.** The container-side client
and the host-side broker are versioned and deployed independently (`build.ts` →
committed `resources/*.mjs`, installed into the consuming project). A running
broker can be older than the client that just dialed it. So the 7 existing
unprefixed ops cannot simply be renamed: either the broker grandfathers
unprefixed `op` as the VICE namespace, or the skew is handled through the
existing epoch mechanism. Decide this before writing the first prefixed op.

**5. A typed allowlist of named tools, never a shell or argv passthrough.** A
generic run-host-command op over TCP is a remote-execution seam. Each tool gets a
named op with a typed argument shape; the executor constructs the argv. This
project already has the discipline — `DENY_LIST` in `vice.ts`, the power-cycle
resource denials — and the same single-checked-seam rule applies.

**6. Path translation in both directions.** Every path argument in, and every
produced artifact out, through `hostpath.ts` / `containerpath.ts`. Note the
CLAUDE.md derived-tool constraint about `rewriteArguments()` running inside
`forwardToVice()`: host-tool paths need translation deliberately placed, not
inherited by accident.

**7. Graceful non-container operation.** The common case today is host-developed
with no container at all (this repo included). The seam must not force a broker
round-trip where a direct spawn is correct — but the *decision* must live in one
place, not be re-derived per script.

## Retroactive scope (decided 2026-08-28)

The executor becomes the single seam for **every** host binary. `acme.mjs`'s PATH
ladder and `packer-finding.mjs`'s probe/run both move behind it.

Rationale: a half-migrated seam is the state that rots, and a retroactive
migration is what makes the rule **mechanically enforceable** — a grep gate can
ban `spawnSync`/`execFile` of an external binary in `src/skills/*/scripts/`, in
the same spirit as `scripts/check-skill-tool-coverage.mjs`. Forward-only leaves
two known-broken-in-container paths and no way to stop the next script doing the
same thing.

Deliberately **not** decided here: whether `d64-parse.mjs` stays as the
in-container fast path or defers to host `c1541` once reachable. `c1541` sees BAM
and sector-chain divergence a directory-chain parser cannot — which is precisely
the fastloader/protection signal worth having — but the module is explicitly
marked permanent and sanctioned, so changing its status needs its own decision
record. Keep it, and let `c1541` be additive, until that record exists.

## First consumers

- **`petcat`** — decode a BASIC stub to recover the `SYS` entry point. This is
  literally step 1 of `c64-program-recon`, currently done by hand.
- **`c1541`** — `chain` and BAM: what the directory *claims* is a file versus
  what sectors the loader *actually* reads. The divergence is where fastloaders,
  protections and hidden data live.
- **`cartconv`** — CRT identification and bank structure, so a banked cartridge
  starts analysis as banks rather than as a flat `$8000-$9FFF`.
- **`acme`** and the unpacker probe — the retroactive migrations above.

These four capability claims come from `docs/vice-mcp-ideas.md`, which is an
LLM-authored summary, **not a primary source, and not probed**. Unlike the
text-monitor findings in [[text-monitor-channel-live-probe]], nothing here was
verified against a real binary. Verify each tool's actual subcommands and output
format against the installed host copy before planning against them.

Related: [[text-monitor-channel-live-probe]], [[runtime-evidence-layer]].
