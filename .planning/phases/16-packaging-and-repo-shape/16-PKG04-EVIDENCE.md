---
date: 2026-08-22
phase: 16-packaging-and-repo-shape
plan: 02
task: 1
narrow_branch_considered: true
---

# PKG-04 Evidence: broker control-plane `0.0.0.0` bind

This document grounds every factual claim the PROJECT.md Key Decisions row will make,
against source read this session and against a live listener started on this host. Two
research assumptions were flagged for re-check before recording; one (A3) was wrong as
drafted and is corrected here.

## Two different control planes — do not conflate

This codebase has two independent TCP listeners that could both be described as "the
emulator control plane," and PKG-04's own wording is ambiguous between them:

1. **VICE's own binary-monitor / text-monitor port** (stock backend only). Default bind is
   `127.0.0.1` — deliberately narrow, because the binary monitor itself is unauthenticated
   by design and grants full memory read/write plus process control to anything that can
   reach it. Widening it away from loopback (`VICE_BROKER_BINMON_HOST` /
   `VICE_BROKER_REMOTEMONITOR_HOST`... resolved via `binmonHost`) emits a one-time stderr
   warning naming the resolved address and the exposure it grants.
   Source: `.claude/mcp/vice/broker-launch.mts:120-175` (JSDoc + `buildViceArgs()` body),
   specifically the default at line 165 (`binmonHost ?? process.env.VICE_BROKER_BINMON_HOST
   ?? "127.0.0.1"`) and the one-time warning at lines 166-173.
   **This half is already closed and is not this plan's subject.**

2. **The broker's own TCP control-plane listener** — acquire / release / recycle / status /
   host_state / monitor_claim / monitor_release. This is the subject of PKG-04. Its default
   bind is `0.0.0.0`, and that is the accepted-risk record this plan writes.

The fork backend's own `-mcpserver` HTTP host (`VICE_BROKER_MCP_HOST`, also defaulting to
`0.0.0.0` at `broker-launch.mts:217`) is a *third* listener (VICE's own HTTP endpoint under
the fork build) and is out of scope for PKG-04 as well — it is the fork's pre-existing
exposure already recorded in PROJECT.md's Out of Scope table ("Fixing the unauthenticated
emulator endpoint exposure ... a property of the external fork and its `0.0.0.0` bind, not
of this project's scope"), not the broker's own control plane this plan is about.

## The bind default: five citations across authored and compiled sources

The `0.0.0.0` default for the broker's own control-plane listener appears at five distinct
sites — two authored code sites, one authored doc-comment site recording the decision, and
two compiled twins that carry it forward mechanically:

1. `.claude/mcp/vice/vice-broker.mts:987` — `const controlHost = process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";` (the value passed into `startControlListener()`'s `host` option).
2. `.claude/mcp/vice/broker-control.mts:22-26` — the module header's own recorded rule: "Bind: 0.0.0.0 explicitly, never 127.0.0.1 -- host.docker.internal is the bridge address, not loopback, so a loopback-only listener is structurally unreachable from the container. Port: 19510 default via VICE_BROKER_CONTROL_PORT."
3. `.claude/mcp/vice/broker-control.mts:671` — `const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";` inside `startControlListener()` (the module's own fallback, reached whenever a caller does not pass `host` explicitly).
4. `.claude/mcp/vice/resources/broker-control.mjs:438` — the compiled twin of site 3, byte-for-byte the same default.
5. `.claude/mcp/vice/resources/vice-broker.mjs:833` — the compiled twin of site 1, byte-for-byte the same default.

The compiled `resources/*.mjs` twins are generated-but-committed artifacts (`build.ts`
compiles the authored `.mts` host-bound launchers into them); they move with their sources
and are named here so the record does not undercount the surface by citing authored files
only.

## The reachability fact this bind exists for

`host.docker.internal`, dialed from inside a container, resolves on Linux to the Docker
bridge gateway address — not to the loopback interface. A listener bound to `127.0.0.1`
accepts only connections arriving on the loopback interface, so it is structurally
unreachable from a container dialing `host.docker.internal`. This is exactly the topology
`container-guard.mts`'s five-signal detector exists to recognize on the *consumer* side
(the container-side proxy resolving where to dial). The `0.0.0.0` bind on the *broker* side
is the other half of making that reachability real. Narrowing the bind default to
`127.0.0.1` without adding a replacement reachability path would silently break every
containerized consumer's control-plane access.

## The compensating control (corrected from research draft)

Research assumption A3 characterized the capability token as "per-boot, not persisted."
**That is incorrect and is corrected here against source, not carried forward:**

- `newControlToken()` (`.claude/mcp/vice/broker-control.mts:238-240`) returns
  `randomBytes(32).toString("hex")` — 32 cryptographically random bytes (256 bits of CSPRNG
  entropy) rendered as a 64-character hex string. Minted once per broker boot (called once
  in `vice-broker.mts:986`, `const token = newControlToken();`).
- The token IS persisted, for the entirety of the broker's running lifetime, into
  `broker.json`. `writeBrokerRecordFile()` (`vice-broker.mts:237-246`) writes the file via a
  tmp-sibling, then `chmodSync(tmpPath, 0o600)` (`vice-broker.mts:242`) — mode owner-read-write
  only — **before** the JSON content (containing `control_token: token`,
  `vice-broker.mts:1133`) is ever written to it. The record is written unconditionally on a
  successful bind (`vice-broker.mts:1121-1141`) and refreshed on every heartbeat.
- **Live confirmation, this session:** a real broker was started on this host (see "Live
  observation" below) and its `broker.json` was inspected directly:
  ```
  -rw------- 1 henrik henrik 433 22 aug 23.46 .../.vice-supervisor/broker.json
  $ stat -c '%a' .../.vice-supervisor/broker.json
  600
  ```
  with file content containing `"control_token": "a44904d4495de01b10bf5c893aa99498caaf7e89fca8f5c65636978fc697f104"` — a persisted, non-empty 64-hex-character value, exactly matching the source's documented shape. This is the concrete proof that "per-boot, not persisted" understates the exposure: the token lives on disk, mode 0600, for as long as the broker process runs, not merely in the minting call's stack frame.
- The token is compared with `tokensMatch()` (`broker-control.mts:267-272`): buffers built
  from `candidate`/`expected`, a length-equality pre-check (an unequal length is refused
  without ever calling `timingSafeEqual`, since that primitive throws on a length mismatch),
  then `timingSafeEqual(a, b)` — a constant-time comparison over equal-length buffers.
- Every request is gated before any state read or write: `attachControlProtocol()`
  (`broker-control.mts:518-526`) checks `tokensMatch(token, opts.token)` immediately on
  parsing the request line, before dispatching on `req.op`. A missing or mismatched token
  gets a single `unauthorized` error code and the socket is destroyed — the refusal message
  ("missing or invalid control token") does not distinguish "absent" from "wrong," so it
  leaks nothing about which failure occurred.
- The token is never logged and never placed in an error message
  (`broker-control.mts:236-237`'s own doc comment; `vice-broker.mts:1133`'s inline comment
  `// never logged -- T-01.6.2-02`).

**Correction recorded:** the research draft's "memory-only, per-boot" wording would have
understated the exposure — a leaked `broker.json` (e.g. via an over-permissive parent
directory, a backup tool that ignores file modes, or a co-tenant with root) exposes a
control-plane credential valid for the broker's entire uptime, not a value that vanishes
when the minting call returns. The PROJECT.md row states the corrected, persisted
characterization.

## Port and override

Default control port is `19510` (`broker-control.mts:25-26`, `resolveControlPort()` at
`broker-control.mts:254-259`), overridable via `VICE_BROKER_CONTROL_PORT`. The bind host
itself is independently overridable via `VICE_BROKER_CONTROL_HOST` (both `vice-broker.mts:987`
and `broker-control.mts:671` check this same env var before falling back to `0.0.0.0`). The
accepted risk in this record is specifically about the **default**, not about the absence of
a narrowing knob — an operator who wants `127.0.0.1` today can already set
`VICE_BROKER_CONTROL_HOST=127.0.0.1`.

## Assumption A4: is `container-guard.mts`'s detector consulted at the bind decision?

**No.** Verified by reading `vice-broker.mts`'s startup sequence (`main()` at
`vice-broker.mts:1187-1213` and `run()` from line ~980 on):

- `containerGuardEnforce()` (`vice-broker.mts:1202`, called from `main()` before `run()`) is
  a *pre-flight refusal*: it stops the broker itself from launching if the broker process is
  running **inside** a container (the broker must run on the host, per this project's
  container/host split). If that check fails, `run()` — the function that resolves
  `controlHost` and calls `startControlListener()` — never executes at all.
- `controlHost` (`vice-broker.mts:987`) is resolved unconditionally from
  `process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0"` inside `run()`, with no branch on any
  container-signal value. The five-signal detector's output is not read anywhere between
  `run()`'s start and the `startControlListener()` call.

So the container detector's only current role is "should this broker process itself be
allowed to start at all" — a binary refuse/allow gate on the broker's own execution
environment — not "what address should this broker bind." **This means the smart-default
follow-on (bind loopback unless a container topology is detected) is a real design change,
not a small wiring fix**: today's detector answers a different question than the one a
smart default would need answered (is a *consumer* reaching this broker from inside a
container — a fact about a not-yet-connected peer — versus is *this process* inside a
container). Sizing the follow-on item accordingly.

## Residual risk (unsoftened)

Any host reachable on the same local network segment as the broker can open a TCP connection
to the control port. Without a valid token, every operation returns `unauthorized` and no
state is read or written. With a leaked token, an attacker on that segment can acquire,
release, and recycle emulator instances through the same protocol a legitimate consumer
uses — materially smaller than arbitrary code execution, but a real tampering and
availability exposure on an untrusted segment (public Wi-Fi, a shared lab network, a
multi-tenant host). The exposure is bounded by the token gate but not eliminated by it: a
compromised token file, an over-broad firewall rule, or a segment shared with an untrusted
peer are all live paths to that exposure.

## Live observation

A real broker was started on this host (dry-run instance launch, to avoid needing a live
target beyond confirming the bind) using this repository's own compiled launcher:

```
$ node .claude/mcp/vice/resources/vice-broker.mjs \
    --repo-root <scratch-dir> --state-dir <scratch-dir>/.vice-supervisor --dry-run
vice-broker: detected backend "fork" for x64sc (source: probe, binary: /usr/local/bin/x64sc)
vice-broker: wrote <scratch-dir>/.vice-supervisor/broker.json (node v22.22.0); control listener bound on 0.0.0.0:19510
vice-broker: launching x64sc -mcpserver -mcpserverhost 0.0.0.0 -mcpserverport 6645
```

```
$ ss -tln | grep -E ':19510|:6645'
LISTEN 0      511          0.0.0.0:19510      0.0.0.0:*
LISTEN 0      4096         0.0.0.0:6645       0.0.0.0:*
```

Both the broker's own control-plane port (19510) and the fork's `-mcpserver` HTTP port
(6645, launched by the broker under the fork backend this host resolved to) bound
`0.0.0.0`, exactly as the source predicts. No genuine stock backend / binary-monitor
instance was exercised in this run (this host's `x64sc` resolves to the fork build), so no
side-by-side `127.0.0.1`-bound binary-monitor observation was captured live this session —
that half of the claim rests on the source citation in "Two different control planes" above
(`broker-launch.mts:165`), not on a live observation, and is stated as such rather than
implied to have been observed.

The broker process was stopped (`kill`) after the observation, the scratch state directory
was removed, and the repository's own `.vice-supervisor/` directory was untouched
throughout (`git status --porcelain .vice-supervisor` shows no change from before this
task).

## Summary of corrected facts feeding the PROJECT.md row

| Claim | Status |
|---|---|
| Bind default is `0.0.0.0` at 5 sites (2 authored code + 1 authored doc comment + 2 compiled twins) | Confirmed, cited above |
| Reachability rationale (`host.docker.internal` → bridge gateway, not loopback) | Confirmed via source comment, matches this project's documented container-detection purpose |
| Token: 256-bit CSPRNG, minted per boot | Confirmed |
| Token: persisted to `broker.json`, mode 0600, for the broker's lifetime | Confirmed live — corrects research A3's "not persisted" |
| Comparison: `timingSafeEqual` over equal-length buffers, pre-gated on length | Confirmed |
| Gate runs before any state read/write; refusal code `unauthorized`, no absent/wrong distinction leaked | Confirmed |
| Narrowing knob (`VICE_BROKER_CONTROL_HOST`) already exists per-invocation | Confirmed |
| Container detector consulted at bind decision | **No** — corrects/confirms research A4; smart-default follow-on is a real design change |
| Live bind observed | Confirmed (`0.0.0.0:19510`, `0.0.0.0:6645`); binary-monitor side is source-cited only, not live-observed this session |

No source file under `.claude/mcp/vice` was edited to produce this evidence.
