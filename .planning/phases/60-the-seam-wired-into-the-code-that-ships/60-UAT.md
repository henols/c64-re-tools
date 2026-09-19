---
status: passed
phase: 60-the-seam-wired-into-the-code-that-ships
source: [60-VERIFICATION.md]
started: 2026-09-18T22:25:00Z
updated: 2026-09-18T22:32:00Z
executed_by: orchestrator (live, on the project owner's own host)
host: ho-laptop, Linux 6.12.107+deb13-amd64, Node v24.20.0
audit_acknowledged:
  milestone: v1.1.0
  at: 2026-09-19
  gap_snapshot: "passed::scenarios=0"
---

## Why this file exists

Round-3 verification (`60-VERIFICATION.md`) scored 5/5 must-haves VERIFIED but returned
`human_needed` because two live-hardware checks had been carried forward, unrun, by every
plan from 60-03/60-05 onward through three gap-closure rounds. Both were runnable on this
host. Both were run. Both pass.

This host is the ideal subject for these checks, not merely an available one: a fork build
genuinely shadows stock VICE on `$PATH` here (`command -v x64sc` -> `/usr/local/bin/x64sc`,
while genuine unpatched stock sits at `/usr/bin/x64sc`). The substitution hazard the whole
phase exists to close is therefore real on this machine rather than simulated.

## Test 1 -- ACME_BIN at a nonexistent absolute path

**Run against** the shipped compiled artifact `src/mcp/vice/resources/host-tool.mjs`, not
the unbuilt `.mts` source -- so this exercises what actually ships.

| Case | Setup | Result |
|------|-------|--------|
| A | `ACME_BIN=/definitely/does/not/exist/acme` | PASS |
| B | `ACME_BIN` unset, ACME genuinely absent (`PATH` emptied) | PASS |
| C | control: `ACME_BIN` unset, real ACME on `$PATH` | PASS -- argv built |

**Case A** returned, verbatim:

```
host_tool "acme.build" refuses: "acme"'s ACME_BIN environment variable is set to
"/definitely/does/not/exist/acme", which did not resolve to an executable file (tried:
/definitely/does/not/exist/acme); the seam will not fall back to searching $PATH for
"acme" itself, because that could start a different binary than the one ACME_BIN named
```

This is the UPDATED expectation this round introduced. Asserted and confirmed: the refusal
names `ACME_BIN`; it quotes the value verbatim; and it carries NO remedy (a wrong override
is not a "missing tool", so the declaration's install prose would be the wrong advice).
Before plan 60-08 this case fell through to a `$PATH` probe for the literal id.

**Case B** returned the "not found" refusal WITH the declaration's remedy appended,
confirming the two refusal shapes stay distinct.

## Test 2 -- real stock x64sc via tools.json, broker as a systemd unit

**Broker lifecycle:** started with `systemd-run --user` (a real transient systemd unit), not
`setsid`/`nohup`. Stopped and reset at the end; no unit, broker or emulator process was left
running, and the repo tree was left byte-identical to how it was found.

Incidental confirmation on first start: with systemd's own `PATH` (Node v20 at
`/usr/bin/node`), the launcher **refused by name before exec**, naming the resolved
interpreter, its version, the required floor, and both remedies -- including
`VICE_BROKER_NODE`. Exit code 4, distinct from the container-guard codes. This is the
"detect, then refuse by name with the remedy" pattern working unprompted.

| Case | Setup | Resolved / spawned | Verdict |
|------|-------|--------------------|---------|
| A | `.c64-re-tools/tools.json` records `/usr/bin/x64sc`, `VICE_BIN` unset | `/usr/bin/x64sc` | PASS |
| B | no `tools.json`, `VICE_BIN=x64sc` (bare name) | `/usr/local/bin/x64sc` | PASS |

**Case A -- the decisive one.** The broker's own startup log line read:

```
vice-broker: backend "stock" (binary: /usr/bin/x64sc)
```

and the emulator it then spawned was confirmed at the OS level, three independent ways:

- instance record `epoch.json`: `"vice_bin": "/usr/bin/x64sc"`
- `/proc/<pid>/cmdline` argv[0]: `/usr/bin/x64sc`
- `/proc/<pid>/exe` (the kernel's own record of what it executed): `-> /usr/bin/x64sc`

against `command -v x64sc` -> `/usr/local/bin/x64sc`, which is what `$PATH` would have
given. The recorded path won over a same-named binary earlier on `$PATH`. This is LOC-01
proven end-to-end through the real shipped stack -- MCP surface, broker, `resolvedBackend()`,
`spawn()` -- on a host where the hazard is genuine.

Also observed in the spawned argv: `-default` precedes `-binarymonitor`, the documented
required flag order.

**Case B** resolved the bare name to the first `x64sc` on `$PATH`, which on this host is the
fork shadow. This is correct and intended: a separator-free value on an `executable`-kind id
IS a `$PATH` walk. The project warns about this hazard rather than silently preventing it,
and `tools.json` (case A) is the documented recovery.

## Finding raised (non-blocking, not a phase-60 regression)

`prerequisites.json`'s `acme` declaration carries the identical remedy string
`sudo apt-get install -y acme` under BOTH its `linux`/`ubuntu` and `linux`/`debian`
entries. `remedyTextsFor()` returns platform entries in declaration order, so a Linux user
reading a refusal sees that same apt line printed twice before the universal
`Install ACME.`:

```
... -- sudo apt-get install -y acme; sudo apt-get install -y acme; Install ACME.
```

This is redundant declaration DATA, not a seam defect, and the ordering behaviour is exactly
what plan 60-08's own DECL-03 ordering must-have specifies. DECL-03 still holds: the remedy
comes from the declaration, and a live refusal and the doctor cannot name *different*
remedies -- they name the same one twice. Cosmetic; worth de-duplicating in a later pass.

## Verdict

Both carried-forward human-verification items PASS. No gaps. Nothing blocks phase 60.
