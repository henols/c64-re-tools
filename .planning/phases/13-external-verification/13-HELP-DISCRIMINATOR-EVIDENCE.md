---
title: Confirming the `--help` backend discriminator against real stock and fork VICE binaries
phase: 13-external-verification
plan: 02
requirement: EXTV-02
closes_todo: .planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md
date: 2026-08-21
---

# EXTV-02: real-hardware evidence for `classifyHelpOutput()` / `probeBackend()` / `resolvedBackend()`

This document records a real run of `.claude/mcp/vice/backend-detect.mts`'s
discriminator against both real `x64sc` builds present on this host, closing
the folded todo's five numbered acceptance steps and its three enumerated
assumed sub-claims. Nothing here is a guess: every command below was actually
run on this host on 2026-08-21, and its output is reproduced or summarized
verbatim.

## 0. Binary enumeration (never assumed)

```
$ which -a x64sc
/usr/local/bin/x64sc
/usr/bin/x64sc
/bin/x64sc

$ readlink -f /usr/local/bin/x64sc
/usr/local/bin/x64sc
$ readlink -f /usr/bin/x64sc
/usr/bin/x64sc
$ readlink -f /bin/x64sc
/usr/bin/x64sc
```

Three candidate paths, but `/bin/x64sc` resolves to the identical file as
`/usr/bin/x64sc` (the usr-merge symlink) -- so there are exactly **two**
distinct real binaries reachable on this host, not three. Each candidate was
then classified by counting `-mcpserver` occurrences in its own `--help`
output (never assigned by assumption):

```
$ /usr/local/bin/x64sc --version   ->  x64sc (VICE 3.10)
$ /usr/bin/x64sc --version         ->  x64sc (VICE 3.9)

grep -c -- '-mcpserver'      fork-help-transcript.txt   -> 5
grep -c -- '-binarymonitor'  fork-help-transcript.txt   -> 2
grep -c -- '-mcpserver'      stock-help-transcript.txt  -> 0
grep -c -- '-binarymonitor'  stock-help-transcript.txt  -> 2
```

`/usr/local/bin/x64sc` (VICE 3.10) has ≥1 `-mcpserver` occurrence -> **fork**.
`/usr/bin/x64sc` (VICE 3.9) has zero `-mcpserver` occurrences -> **stock**.

## 1. Verbatim transcript capture

Captured with `spawnSync(binPath, ["--help"], { encoding: "utf8", timeout:
5000, killSignal: "SIGKILL" })` -- the exact invocation `probeBackend()`'s own
`defaultSpawnHelp()` uses -- and written verbatim to
`fixtures/backend-detect/<kind>-help-transcript.txt`.

| Binary | Kind | Exit code | stdout bytes | stderr bytes | Combined bytes written |
|---|---|---|---|---|---|
| `/usr/local/bin/x64sc` | fork | 0 | 70033 | 0 | 70033 |
| `/usr/bin/x64sc` | stock | 0 | 67176 | 0 | 67176 |

Both exit **0** with non-empty output on the first (`--help`) flag attempt.

## 2. `probeBackend()` live verdicts

```
$ node -e '(async () => {
    const m = await import("./backend-detect.mts");
    console.log(m.probeBackend("/usr/local/bin/x64sc"));  // fork
    console.log(m.probeBackend("/usr/bin/x64sc"));        // stock
  })();'

fork
stock
```

Result: `{"fork_probeBackend":"fork","stock_probeBackend":"stock"}` -- **neither
returns `unknown`**. The folded todo's step 1 is satisfied.

## 3. `resolvedBackend()` live cache round-trip

Run with `VICE_BACKEND` unset and `supervisorDir` pointed at a fresh
`mkdtempSync` directory under the OS temp dir -- never this repo's real
`.vice-supervisor/`. `resetResolvedBackendForTests()` was called between the
two binaries so the second binary's verdict is a real probe, not the first
binary's module-level memo.

Scratch dir used: `/tmp/backend-detect-live-pYwNf9` (deleted after the run).

| Binary | Call | Source | Backend | Probe count so far |
|---|---|---|---|---|
| fork (`/usr/local/bin/x64sc`) | 1st | `probe` | `fork` | 1 |
| fork (`/usr/local/bin/x64sc`) | 2nd (memo reset, cache kept) | `cache` | `fork` | 1 (unchanged -- zero additional probes) |
| stock (`/usr/bin/x64sc`) | 1st | `probe` | `stock` | 1 |
| stock (`/usr/bin/x64sc`) | 2nd (memo reset, cache kept) | `cache` | `stock` | 1 (unchanged -- zero additional probes) |

Raw result JSON from the live run:

```json
{
  "fork_call1": { "backend": "fork", "source": "probe", "binPath": "/usr/local/bin/x64sc", "binPathResolved": true, "probeCallsSoFar": 1 },
  "fork_cacheFileAfterCall1": "{\n  \"version\": 1,\n  \"resolvedPath\": \"/usr/local/bin/x64sc\",\n  \"mtimeMs\": 1785347571949.4683,\n  \"sizeBytes\": 20259104,\n  \"backend\": \"fork\",\n  \"probedAt\": \"2026-08-21T23:24:25.482Z\"\n}\n",
  "fork_call2": { "backend": "fork", "source": "cache", "binPath": "/usr/local/bin/x64sc", "binPathResolved": true, "probeCallsTotalAfterCall2": 1 },
  "stock_call1": { "backend": "stock", "source": "probe", "binPath": "/usr/bin/x64sc", "binPathResolved": true, "probeCallsSoFar": 1 },
  "stock_cacheFileAfterCall1": "{\n  \"version\": 1,\n  \"resolvedPath\": \"/usr/bin/x64sc\",\n  \"mtimeMs\": 1735517185000,\n  \"sizeBytes\": 4057928,\n  \"backend\": \"stock\",\n  \"probedAt\": \"2026-08-21T23:24:25.546Z\"\n}\n",
  "stock_call2": { "backend": "stock", "source": "cache", "binPath": "/usr/bin/x64sc", "binPathResolved": true, "probeCallsTotalAfterCall2": 1 },
  "scratchDir": "/tmp/backend-detect-live-pYwNf9"
}
```

The `backend.json` written during this exercise lived under
`/tmp/backend-detect-live-pYwNf9/backend.json`, a scratch directory created by
`mkdtempSync`, and was deleted at the end of the run along with its parent
directory. `git status --porcelain .vice-supervisor` was checked immediately
after the exercise and reported nothing:

```
$ git status --porcelain .vice-supervisor
$ echo "exit:$?"
exit:0
```

The folded todo's step 5 is satisfied: the cache round-trips the correct
verdict on a second call with zero additional probes, and the exercise wrote
nothing into this repo's real supervisor tree.

## 4. The three assumed sub-claims, answered

**(1) Does each build's `--help` actually list the flag as a literal
substring?** Yes, for both builds, unambiguously:
- Fork (`/usr/local/bin/x64sc`): `-mcpserver` appears 5 times (the base flag
  plus `-mcpserverport`, `-mcpserverhost`, `-mcpservertoken`,
  `-mcpservercorsorigin`) and `-binarymonitor` appears 2 times (the base flag
  plus `-binarymonitoraddress`). This build's own VICE tree is 3.10-based and
  genuinely ships both surfaces.
- Stock (`/usr/bin/x64sc`): `-mcpserver` appears 0 times; `-binarymonitor`
  appears 2 times (same pair as above). No collapsed usage line, no
  truncation, no omission of either build's custom flags from `--help` was
  observed.

**(2) What is each build's `--help` exit status, and what does that mean for
the `-help`/`-?` fallback ladder?** Both builds exit **0** with non-empty
combined output on the first attempted flag (`--help`). `probeBackend()`'s
fallback loop only tries the next candidate flag (`-help`, then `-?`) when
the previous attempt `exitedZero === false` **and** produced empty text; a
zero-exit, non-empty `--help` satisfies the loop's break condition
immediately. **Finding: on this host, against both real builds, the
`-help`/`-?` fallback branches are never reached -- they remain
*unexercised*, not *confirmed*, by this evidence.** Nothing about this run
demonstrates what a real stock or fork build does when given an unrecognized
flag or an empty-output failure mode; it only demonstrates that `--help`
itself always succeeds on both builds tested here.

**(3) Does either transcript contain both discriminator tokens, and if so
which branch of the fork-wins rule fires?** Yes -- the **fork** transcript
contains both `-mcpserver` and `-binarymonitor` (see (1) above), so
`classifyHelpOutput()`'s `hasFork` check (checked first, deliberately) is
what actually decides this transcript's classification: it returns `"fork"`
because `hasFork` is true, without ever needing to consult `hasStock`. The
**stock** transcript contains only `-binarymonitor` and takes the plain
`hasStock` branch. Both are exercised for real by these two transcripts --
this is not a theoretical corner case, it is exactly the fork binary's own
day-to-day `--help` output on this host.

## 5. A confirmed, unplanned finding: `x64sc --help`'s own startup diagnostics are not byte-reproducible

The plan's acceptance criteria ask that re-running the recorded command and
comparing with `cmp` reports no difference. Re-capturing was attempted
multiple times as part of this evidence-gathering exercise, using the exact
same invocation recorded in each sidecar's `command` field, run four times in
a row against the stock binary with nothing else changed on the host:

```
$ for i in 1 2 3 4; do node -e '<spawnSync capture identical to defaultSpawnHelp()>' > /tmp/node-stock-$i.txt; done
$ cmp /tmp/node-stock-1.txt /tmp/node-stock-2.txt && echo "1 vs 2 same"
1 vs 2 same
$ cmp /tmp/node-stock-2.txt /tmp/node-stock-3.txt && echo "2 vs 3 same"
2 vs 3 same
$ cmp /tmp/node-stock-3.txt /tmp/node-stock-4.txt
/tmp/node-stock-3.txt /tmp/node-stock-4.txt differ: byte 528, line 9
$ diff /tmp/node-stock-3.txt /tmp/node-stock-4.txt
9c9
< [97;40mMainlock[0m: VSP Bug: safe channels are: 012357. Emulation of memory corruption is disabled.
---
> [97;40mMainlock[0m: VSP Bug: safe channels are: 012367. Emulation of memory corruption is disabled.
```

`x64sc --help` prints a one-time startup diagnostic block before its usage
text, including a `VSP Bug: safe channels are: <permutation>` line whose
digit ordering genuinely changes between otherwise-identical invocations --
this is a real property of the binary's own startup code, not an artifact of
how the transcript was captured (the same `spawnSync` invocation was used for
every run, matching `probeBackend()`'s own `defaultSpawnHelp()` exactly, and
an earlier attempt using a bash `2>&1` redirect surfaced the same
non-determinism plus ANSI escape-code differences driven by TTY detection).

**Disposition (documented per the executor's deviation protocol, not a
silent skip):** the committed transcripts are each a single, genuine,
verbatim capture and satisfy that half of the requirement exactly. The
stronger claim -- that re-running the recorded command reproduces the
committed bytes exactly via `cmp` -- does not hold, and cannot be made to
hold, because the non-determinism lives inside the real binary's own startup
code, not in anything this plan's capture method controls. This does not
weaken the evidence this document exists to provide: the two discriminator
substrings (`-mcpserver*`, `-binarymonitor*`) are part of the binary's static
`--help` usage table and were confirmed stable across every repeated capture
in this exercise -- only the unrelated startup-diagnostic line moved.
`fixtures/backend-detect/README.md` carries this same finding so a future
reader attempting to re-verify byte-identity does not mistake the expected
diagnostic-line drift for a corrupted or stale fixture.

## Summary verdict

| Todo acceptance step | Result |
|---|---|
| 1. `probeBackend()` returns `stock`/`fork`, not `unknown` | **Confirmed** -- see §2 |
| 2. If `unknown`, capture + correct + re-add | N/A -- neither binary classified `unknown` |
| 3. Re-verify the fallback-ladder exit-code assumption | **Answered**: unexercised on this host, both builds exit 0 with output on `--help` alone; see §4(2) |
| 4. Update the backend-probe-evidence doc's verdict | See §6 below |
| 5. Exercise `resolvedBackend()` end to end, cache round-trip | **Confirmed** -- see §3 |

## 6. Cross-reference: `docs/phase2-backend-probe-evidence.md` §2

That document's §2 verdict (OPEN, not resolved either way) predates this
plan and describes plan 02-07's own environment, which had no real binary
reachable. This document is the real-hardware confirmation that section
asked for: `classifyHelpOutput()`/`probeBackend()` are now VERIFIED against
both real builds present on this host, with no correction needed to either
function -- see §2 and §4 above. `docs/phase2-backend-probe-evidence.md`
itself is left unedited by this plan (out of this plan's stated file list);
a reader following it forward from §2 lands here.
