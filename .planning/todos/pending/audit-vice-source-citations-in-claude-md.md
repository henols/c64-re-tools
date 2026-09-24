---
created: 2026-09-24T00:00:00.000Z
title: Audit CLAUDE.md's VICE-source line citations against a real VICE source tree
area: docs
severity: major
files:

  - CLAUDE.md
  - .planning/PROJECT.md

---

# Audit the VICE-source citations in CLAUDE.md

The 2026-09-24 CLAUDE.md audit checked every claim it could reach from this repo and found
five defects (fixed in `706d633b`). It could **not** reach the Protocol and Capability
bullets, which cite VICE's own C source by file and line. Those are the most load-bearing
claims in the file — they are the normative record of how the binary monitor behaves — and
none of them has been verified since it was written.

Unverified citations, as they appear in CLAUDE.md's Constraints block:

| Citation | Claim it supports |
|---|---|
| `monitor_binary.c:384-394` | `JAM` (0x61) has a zero-length body; no PC is sent |
| `mon_breakpoint.c:557-562` | `mon_breakpoint_event()` fires before `cp->stop` is checked |
| `monitor.c:3393-3396` | a drive checkpoint hit sets `default_memspace` |
| `monitor_binary.c:401-434` | wire memspace byte is not the internal enum; `0x08` rejected |
| `mon_parse.y:168` | checkpoint conditions have no operator precedence |
| `monitor.c:1597` | bare integer literals in conditions are hex |
| `monitor_binary.c:1492` | `CPUHISTORY_GET` count stored in a `uint16_t`, wraps at 65536 |
| `vsync.c:220-241` | no runtime `WarpMode` resource, deliberately |
| `drive/drive-resources.c:450` | real gate is `Drive8TrueEmulation` + non-zero `Drive8Type` |
| `c64/c64.c:1367` | three resources reach `machine_trigger_reset(POWER_CYCLE)` |

## Why this is worth doing

Line numbers are the most drift-prone citation form there is, and these point into an
external project on its own release cadence. The repo pins no VICE version for them: the
bullets variously reference 3.9 and 3.10 behaviour, and `/usr/bin/x64sc` here is 3.9 while a
3.10 exists at `/usr/local`. A citation that has silently slid by a few lines still *looks*
authoritative, which is exactly the failure the phase-58 citation ledger was built to catch
for this project's own documents — and that ledger does not cover these.

The behavioural claims are likely still correct; several were re-measured live against a
running emulator and carry MEASURED dates. The risk is the **anchors**, not the findings.

## Suggested shape

Treat it as an anchor audit, not a re-derivation: for each row, confirm the cited line range
still contains the code the claim describes, against a named VICE version. Record the version
audited against, and prefer a symbol or function name over a line number wherever one exists —
`mon_breakpoint_event()` survives a refactor that `mon_breakpoint.c:557-562` does not.

Needs a VICE source tree, which this host does not currently have; only the built binaries
are installed.
