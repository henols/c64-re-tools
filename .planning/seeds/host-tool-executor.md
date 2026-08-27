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

## Shape

- A host-side executor reached over the **same** control channel, so there is one
  container-out mechanism rather than two. The `resources/*.mjs` build-and-commit
  pattern (`build.ts` compiling host-bound `.mts` into banner-marked `.mjs`, with
  `resources-sync.test.ts` failing CI on drift) already exists for exactly this
  kind of host-side code.
- **A typed allowlist of named tools, never a shell or argv passthrough.** A
  generic "run host command" op over TCP is a remote-execution seam. Each tool
  gets a named op with a typed argument shape; the executor constructs the argv.
  This project already has the discipline — `DENY_LIST` in `vice.ts`, the
  power-cycle resource denials — and the same single-checked-seam rule applies.
- **Path translation on both directions.** Every path argument in, and every
  produced artifact out, goes through `hostpath.ts` / `containerpath.ts`. Note
  the CLAUDE.md derived-tool constraint about `rewriteArguments()` running inside
  `forwardToVice()`: host-tool paths need translation deliberately placed, not
  inherited by accident.
- **Graceful non-container operation.** The common case today is host-developed
  with no container at all (this repo included). The seam must not add a broker
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
