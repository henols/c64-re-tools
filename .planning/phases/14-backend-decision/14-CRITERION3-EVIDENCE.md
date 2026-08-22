# Phase 14 Criterion 3 — Live Fork-Transport Evidence

Recorded 2026-08-22. Produced by plan 14-03, Task 2, running
`fork-live.test.ts` (committed by Task 1) with `VICE_LIVE_FORK_BIN` opted in,
in the foreground, on the host this session executed on. No nested `claude`
or `claude -p` session was used at any point.

## Branch

**FORK-01: `retain`** (decided 2026-08-22, `14-01-SUMMARY.md` → `## Decision`).
This document is the phase's criterion-3 live artifact for that decision: the
fork transport ships at the end of this phase regardless of branch, and this
is the first time its own HTTP transport has been exercised against a real
binary anywhere in this repository (14-RESEARCH.md Q3).

## Binary under test

| Field | Fork (tested) | Stock (contrast only, NOT tested here) |
|---|---|---|
| Absolute path | `/usr/local/bin/x64sc` | `/usr/bin/x64sc` |
| Reported version (`-version`) | `x64sc (VICE 3.10)` | `x64sc (VICE 3.9)` |
| File size | 20,259,104 bytes | 4,057,928 bytes |
| `--help` mentions of `mcpserver` | 6 (`-mcpserver`, `-mcpserverport`, `-mcpserverhost`, `-mcpservertoken`, `-mcpservercorsorigin`, plus the CORS description line) | 0 |
| Advertises `-mcpserver`? | **YES** | **NO** |

This is unambiguously the **fork** build — the genuine unpatched stock binary
at `/usr/bin/x64sc` was probed side by side and confirmed to advertise no
`-mcpserver` flag at all (`grep -c mcpserver` against its `--help` output
returned `0`). A bare `x64sc` on this host's `PATH` resolves to
`/usr/local/bin/x64sc` (the fork) because `/usr/local/bin` precedes
`/usr/bin` in `PATH` — both probes below used absolute paths for exactly that
reason.

Raw probe commands and their relevant output:

```
$ /usr/local/bin/x64sc --help 2>&1 | grep -i mcpserver
-mcpserver
+mcpserver
-mcpserverport <port>
-mcpserverhost <host>
-mcpservertoken <token>
-mcpservercorsorigin <origin>
	Enable CORS for one exact origin (requires MCPServerToken)

$ /usr/bin/x64sc --help 2>&1 | grep -i mcpserver
(no output)

$ /usr/local/bin/x64sc -version 2>&1 | grep -v '^\(Keymap\|Error\|Mainlock\)'
x64sc (VICE 3.10)

$ /usr/bin/x64sc -version 2>&1 | grep -v '^\(Keymap\|Error\|Mainlock\)'
x64sc (VICE 3.9)
```

## Exact argv and endpoint

The argv actually spawned by `fork-live.test.ts`'s `before()` hook, produced
by `buildViceArgs(port, { backend: "fork", mcpHost: "127.0.0.1" })`
(`broker-launch.mts`'s own fork branch — not hand-written):

```
/usr/local/bin/x64sc -mcpserver -mcpserverhost 127.0.0.1 -mcpserverport <ephemeral-port>
```

The single shared transport seam (`vice.ts`'s `useInstance()`) was then
pointed at:

```
http://127.0.0.1:<ephemeral-port>/mcp
```

The child ran with `XDG_CONFIG_HOME` pointed at a per-run `mkdtempSync()`
scratch directory (`/tmp/gsd-1403-vicerc-*`), never the shared
`~/.config/vice` tree. Test 1 (`the spawned argv binds -mcpserverhost to
loopback, never all-interfaces`) asserted `-mcpserverhost` was immediately
followed by the literal `127.0.0.1` and that no argv element was
`0.0.0.0` — this passed.

## Observed results

All commands below ran through `vice.ts`'s real `call()`/`serverInfo()`
functions against the live endpoint above. Payloads are copied verbatim from
the test run's console output (`console.log`), not summarized as "worked".

| # | Test | Result | Observed payload |
|---|---|---|---|
| 1 | Bind posture (T-14-09) | **pass** | argv contained `-mcpserverhost 127.0.0.1`; no `0.0.0.0` present |
| 2 | Surface: `serverInfo()` vs `tools-manifest.json` | **pass**, with 1 finding | Manifest's `vice_*` name set: 58 (comfortably above the required non-vacuity floor of 50). Every manifest name was present in the live server's `tools/list`. The live server additionally offered `vice_snapshot_list`, which the committed manifest does not list — see Findings below. |
| 3 | Liveness: `vice_ping` | **pass** | `{"status":"ok","version":"3.10","machine":"C64SC","execution":"paused"}` |
| 4 | Registers: `vice_registers_get` | **pass** | `{"PC":64885,"A":85,"X":255,"Y":131,"SP":253,"N":false,"V":false,"B":false,"D":false,"I":true,"Z":false,"C":true}` — PC resolved as a number from this run's own answer, never a hardcoded id |
| 5 | Hard loss, end to end: `vice_sid_get_state` | **pass** | `{"voices":[{"voice":1,"frequency":0,"pulse_width":0,"noise":false,"pulse":false,"sawtooth":false,"triangle":false,"test":false,"ring_mod":false,"sync":false,"gate":false,"attack":0,"decay":0,"sustain":0,"release":0},{"voice":2,...},{"voice":3,...}],"filter_cutoff_low":0,"filter_cutoff_high":0,"filter_resonance":0,"filter_voice3":false,"filter_voice2":false,"filter_voice1":false,"filter_ext":false,"voice3_off":false,"highpass":false,"bandpass":false,"lowpass":false,"volume":0}` — a freshly-booted, never-written SID reads all zeros/false, which is the expected shape for a machine that has not yet had anything written to `$D400-$D418` |
| 6 | Session bookkeeping: `beginSession()`/`readEpoch()` | **pass** | `beginSession()` → `{"baseline":{"present":false,"epoch":null,"spawned_at":null,"pid":null,"path":".../epoch.json","reason":"epoch file absent"},...}`; `readEpoch()` on the same path returned the identical `present:false` shape — parsed cleanly, never threw, because this fixture owns no broker/supervisor epoch file |

**Run totals:** 6 passed, 0 failed, 0 skipped, 0 cancelled (`node --test`
exit code 0). Total wall time 2257ms including emulator spawn and teardown.

Post-run process check: `pgrep -f 'x64sc.*-mcpserver'` returned no genuine
match after the run completed (the single transient hit observed during
manual verification was the invoking shell command's own argv containing the
literal string `x64sc`, confirmed by `ps -p <pid>` returning nothing for that
pid moments later — not a leaked emulator).

## Provenance and limits

This is the **first live exercise of the fork backend's own `-mcpserver` HTTP
transport recorded in this repository** (14-RESEARCH.md Q3's finding,
independently confirmed by this plan's own read of `broker-e2e.test.ts`,
which stubs the binary to `/bin/sleep` by design, and of `08-HUMAN-UAT.md`,
which is scoped entirely to the stock backend). Phase 13's EXTV-01/EXTV-02
live captures ran against this same `/usr/local/bin/x64sc` binary but spoke
the **stock binary-monitor protocol** to it (`-binarymonitor`), never this
endpoint — so even those did not cover the transport this document exercises.

What this evidence establishes:
- One host, one fork build (VICE 3.10, `/usr/local/bin/x64sc`, this
  machine's specific compile), one run.
- The five tools exercised (`tools/list` surface check, `vice_ping`,
  `vice_registers_get`, `vice_sid_get_state`, plus the session-bookkeeping
  pair) answered over the real HTTP `/mcp` endpoint through the real
  `vice.ts` transport seam, with no stub anywhere in the path.
- The bind posture (loopback-only) was verified for the exact argv this
  test spawned, not merely documented as a rule.

What it does **not** establish:
- Behaviour on any other host, OS, or build of the fork binary.
- Long-running stability, concurrent-client behaviour, or behaviour under
  load — this was a single short-lived instance serving one client for one
  test run.
- Full parity of every one of the fork's ~62 tools; only the five named
  above (plus the surface-diff check) were called. The three "hard-loss"
  tools FORK-02 names are `vice_sid_get_state` (exercised here, passed),
  `vice_keyboard_matrix`-family, and RESTORE/NMI-adjacent tooling (neither of
  the latter two was exercised by this plan — this document does not
  reproduce every existing capability, only the single most load-bearing
  read for FORK-02's SID claim).
- That the emulator's answers are *correct* relative to real C64 hardware —
  only that the transport itself round-trips a real request to a real
  answer.

Following Phase 12's gate-proof provenance precedent: this document
describes exactly what ran and what it observed, and it names its own scope
boundary rather than implying broader coverage than one host/one run/five
tools can support.

## Findings

**1. The live server offers `vice_snapshot_list`, which the committed
`tools-manifest.json` does not list.** `tools-manifest.json`'s
`generated_at` timestamp is `2026-07-31T15:56:00.302Z`, generated by
`refresh-manifest.ts` from a live server on that date. Between then and this
run, the fork binary's own tool surface grew by at least one tool
(`vice_snapshot_list`) that the manifest has not been regenerated to
capture. This is a real, if minor, drift finding — the manifest is a
point-in-time snapshot, not a live source of truth, and this is the first
test that has ever diffed it against a live answer. No other name mismatch
was found in either direction: every `vice_*` name the manifest lists was
present live. Filed as a pending todo (see below) rather than fixed here,
per this plan's own instruction not to weaken or silently correct findings
mid-evidence.

No other findings. The three previously-untested calls this plan exists to
prove (`vice_ping`, `vice_registers_get`, `vice_sid_get_state`) all resolved
successfully, with `vice_sid_get_state` in particular resolving cleanly end
to end over the real transport — the FORK-02 route for SID read-back is
confirmed followable against a real build, not merely documented.

A pending todo has been filed:
`.planning/todos/pending/2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md`.
