# Backend-detect `--help` transcript fixtures

Verbatim `--help` transcripts captured from two real `x64sc` builds on this
host, used to prove `classifyHelpOutput()`/`probeBackend()` (`../../backend-detect.mts`)
against real hardware rather than against author-constructed guesses.
`EXTV-02` closes `.planning/todos/pending/2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`.

**These are real captures, not synthesized.** Each transcript is the
byte-for-byte combined stdout+stderr output of `spawnSync(binPath, ["--help"],
{ encoding: "utf8" })` -- exactly the invocation `probeBackend()`'s own
`defaultSpawnHelp()` uses -- against the binary named in its own sidecar.
Nothing here was trimmed, re-wrapped, redacted, or otherwise edited after
capture.

**Never merge these with, or present these as the same class of evidence as,**
the author-constructed `ASSUMED` fixture strings inline in
`../../backend-detect.test.ts`. Those are guesses at what a real build's
`--help` might contain, explicitly labelled as such; the two files here are
what a real build actually printed on 2026-08-21. D-13-03 requires the two
classes stay visibly separate -- no shared array, no shared helper, no test
name that omits which is which.

## What is in this directory

| File | What it is |
|---|---|
| `stock-help-transcript.txt` | Verbatim `--help` output of the genuine, unpatched upstream stock build |
| `stock-help-transcript.json` | Its provenance sidecar |
| `fork-help-transcript.txt` | Verbatim `--help` output of the patched, non-upstream fork build (see `CLAUDE.md`'s framing of that binary) |
| `fork-help-transcript.json` | Its provenance sidecar |

## Provenance table

| File | Binary path | Kind | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|
| `stock-help-transcript.txt` / `.json` | `/usr/bin/x64sc` | genuine unpatched stock | `x64sc (VICE 3.9)` | 2026-08-21T23:23:35Z | `backend-detect.test.ts` (real-hardware block) |
| `fork-help-transcript.txt` / `.json` | `/usr/local/bin/x64sc` | patched, non-upstream fork | `x64sc (VICE 3.10)` | 2026-08-21T23:23:35Z | `backend-detect.test.ts` (real-hardware block) |

`which -a x64sc` on the capturing host listed three candidate paths
(`/usr/local/bin/x64sc`, `/usr/bin/x64sc`, `/bin/x64sc`); `/bin/x64sc` resolves
(`readlink -f`) to the identical file as `/usr/bin/x64sc` (a usr-merge
symlink), so there are exactly **two** distinct real binaries on this host,
not three. Each candidate's kind was derived from its own `--help` output
(counting `-mcpserver` occurrences), never assigned by assumption -- see
`.planning/phases/13-external-verification/13-HELP-DISCRIMINATOR-EVIDENCE.md`
for the full enumeration.

Each `.json` sidecar carries `capturedFrom` (literally the string
`"real hardware"` -- the D-13-03-required label, deliberately NOT the binmon
`<kind>:<path>` form those sidecars use, because a different consumer reads
these), `binaryPath`, `viceVersion`, `capturedAt`, `command` (the exact
invocation run), `exitCode`, and `backendExpected` (`stock` or `fork`).

## A known source of non-determinism (read before re-capturing)

Re-running either binary's recorded `command` does **not** reliably produce a
byte-identical transcript. `x64sc --help` prints several one-time startup
diagnostics before its usage text -- a keyboard-mapping banner and, notably, a
`VSP Bug: safe channels are: <permutation>` line whose digit ordering was
observed to change across back-to-back invocations of the *identical*
command with no arguments changed. This was confirmed by capturing the same
command four times in a row and diffing: the discriminator-relevant lines
(`-mcpserver*`, `-binarymonitor*`) never moved or changed; only the
startup-diagnostic lines did. See
`13-HELP-DISCRIMINATOR-EVIDENCE.md` for the full diff evidence.

This means: re-capturing and comparing with `cmp` is expected to report a
difference confined to that one diagnostic line, not evidence that this
directory's committed transcript is stale or was mis-captured. The
classification-relevant substrings are what this fixture set exists to pin,
and those are stable.

## Regenerating

There is no capture script for this directory (unlike `../binmon/`, which has
`probe-binmon.mjs --capture`). To re-capture either transcript by hand, run
the exact `command` recorded in its sidecar with combined stdout+stderr and
overwrite the matching `.txt` verbatim; update the sidecar's `capturedAt`,
`viceVersion` (re-run `--version`), and `exitCode` to match. Do not hand-edit
the `.txt` content itself.
