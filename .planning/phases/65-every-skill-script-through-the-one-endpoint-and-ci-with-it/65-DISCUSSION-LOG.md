# Phase 65: Every Skill Script Through the One Endpoint, and CI With It - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 65-every-skill-script-through-the-one-endpoint-and-ci-with-it
**Areas discussed:** CI ACME route, Input files over socket, Where outputs land, Cap for host-tool bytes, Anno off the MCP surface

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Anno off MCP surface | Remove 25 anno_* tools from tools/list; reach them via a stateless broker call | ✓ |
| Remove pre-warm | Launch VICE only on first request (possibly stale; warm_floor recorded as deleted) | ✓ |
| Queued-disconnect flake | broker-e2e.test.ts samples once after a fixed deadline instead of polling | ✓ |

**User's choice:** All three folded (recommendation was none).
**Notes:** Pre-warm was then measured as already retired; its fold is verify-and-close. Anno needed its own area (added as area 5).

---

## CI ACME route

| Option | Description | Selected |
|--------|-------------|----------|
| Test-owned broker | Suite starts the compiled broker on an ephemeral port with a temp VICE_BROKER_HOME, kills it in teardown | ✓ |
| Workflow step, port 19510 | ci.yml starts a throwaway broker before the job | |
| Manual-only gate | Move the tests to MANUAL_ONLY_TESTS | |

**User's choice:** Test-owned broker (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse + SKILL.md | ENDPOINT-04 refusal plus a broker prerequisite in each affected SKILL.md | ✓ |
| Refuse by name only | Runtime refusal alone | |

**User's choice:** Refuse + SKILL.md (Recommended)

---

## Input files over socket

| Option | Description | Selected |
|--------|-------------|----------|
| Source dir + -I trees | Upload the source's directory tree and each -I tree, relative layout preserved | ✓ |
| Named files + --with list | Upload only the source plus explicitly listed files | |
| Client-side directive scan | Parse !source/!binary client-side to compute the closure | |

**User's choice:** Source dir + -I trees (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Broker's own copy | Broker installs the Ghidra extension from its own vendored tree; wire key removed | ✓ |
| Upload like any input | Keep sourceDir path-bearing and upload the tree | |

**User's choice:** Broker's own copy (Recommended)

---

## Where outputs land

| Option | Description | Selected |
|--------|-------------|----------|
| Caller's outDir | Keep today's semantics; validate broker-supplied names against that dir | |
| Always .c64-re-tools/<kind>/ | Follow XFER-01 literally; -o/outDir stop meaning anything | ✓ |

**User's choice:** Always .c64-re-tools/<kind>/ — AGAINST the recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| Only declared results | Only runHostTool()'s results[] come back; broker scratch deleted at request end | ✓ |
| Everything in the out dir | Mirror the broker's whole output directory back | |

**User's choice:** Only declared results (Recommended)

---

## Cap for host-tool bytes

| Option | Description | Selected |
|--------|-------------|----------|
| Remove, refuse by name | Delete -o/--out-dir/outDir; refusal names the flag and the new location | ✓ |
| Keep as a post-copy | Land under .c64-re-tools then copy to the old destination | |
| Ignore with a warning | Accept the flags, warn on stderr | |

**User's choice:** Remove, refuse by name (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 16 MiB per file + request | Reuse Phase 64's constant, per file and per request aggregate | ✓ |
| Raise to 64 MiB everywhere | One raised constant across the whole transport | |
| 16 MiB file, 64 MiB aggregate | Separate larger aggregate for uploaded trees | |

**User's choice:** 16 MiB per file + request (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Dot-entries + refuse escaping links | Skip dot-prefixed entries, refuse symlinks leaving the tree | ✓ |
| Upload everything, cap decides | No exclusions | |

**User's choice:** Dot-entries + refuse escaping links (Recommended)

---

## Anno off the MCP surface

| Option | Description | Selected |
|--------|-------------|----------|
| Client-local CLI | Skills call `vice-mcp anno <verb>`; store stays in the project | ✓ |
| Broker executes, store broker-side | Literal directive; stateless anno verb on the endpoint, store under VICE_BROKER_HOME | |
| Remove now, route later | Remove tools now, decide broker routing in a later phase | |

**User's choice:** Client-local CLI (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete outright | Gone from tools/list in the same change that moves the five skills | ✓ |
| One-release alias | Keep advertised as deprecated for one release | |

**User's choice:** Delete outright (Recommended)

---

## Claude's Discretion

- Subprocess vs dynamic `import()` for skill scripts reaching the resolved module
- `<kind>` directory naming and same-name result collisions
- Coexistence of the new endpoint `host_tool` arm with the legacy token-gated op until Phase 66
- Per-request staging lifetime for host-tool uploads

## Deferred Ideas

- Anno routed through the broker (literal directive reading)
- Caller-chosen result destinations (restoring -o/outDir)
- CR-01 at text-protocol.ts:850 (carried debt, untouched)
