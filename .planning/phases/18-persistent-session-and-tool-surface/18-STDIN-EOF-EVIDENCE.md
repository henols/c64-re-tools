# D18-23: stdin-EOF orphan measurement

**Plan:** 18-04, task 3(b)
**Date:** 2026-08-24
**Binary:** `the external analyser` at `/home/henrik/.cargo/bin/analyser`
**`--version` output:** `the external analyser 0.9.20`

## Question

If `vice-proxy.ts` (the process holding a long-lived `the external analyser
--mcp-server-stdio` child, per `anno-session.ts`) itself dies via `SIGKILL` —
i.e. with NO exit hook of any kind running, not even this project's own
`onTeardown()` — does the orphaned `the external analyser` child notice its stdin
reaching EOF and terminate on its own, or does it survive indefinitely,
holding the project file open?

This is D18-23's own open question. It is answered here by measurement
against the real binary, not assumed either way.

## Method

Reproduces the real shape directly, at the OS level, rather than through
`vice-proxy.ts` itself (so the measurement isolates the CHILD's own behaviour
from anything this project's own code does or does not do on the way out):

1. A short-lived Node "parent" process (`measure-stdin-eof-parent.mjs`) spawns
   a real `analyser --mcp-server-stdio <project>` child with
   `stdio: ["pipe", "pipe", "pipe"]` — the exact same stdio shape
   `anno-mcp-client.ts`'s `openAnnoSession()` uses — against a scratch
   `.regen2000proj` synthesized with the real, shipped `synthesizeProject()`.
   It writes the child's pid to a file once spawn is confirmed, then does
   nothing else (no signal handlers, no further stdio wiring) and idles
   forever.
2. A driver (`measure-stdin-eof-driver.mjs`) spawns that parent, waits for the
   pid file, confirms the child is alive, then delivers `SIGKILL` **to the
   parent** (never to the child directly) — the OS closes the parent's file
   descriptors, including its end of the child's stdin pipe, exactly as
   happens when a real `vice-proxy.ts` process is killed with a held session.
3. The driver polls (200ms interval, 15s bound) whether the child process is
   still alive, and records the elapsed time from the `SIGKILL` to the child's
   own exit — or, had it survived to the bound, that it survived.
4. Any child still alive at the 15s bound is explicitly killed by the driver
   before it exits, so a failed/ambiguous measurement never leaks a live
   `the external analyser` process out of this run either way.

## Exact command sequence

```bash
The external analyser --version
# the external analyser 0.9.20

cd .planning/phases/18-persistent-session-and-tool-surface/evidence
node measure-stdin-eof-driver.mjs
```

(`measure-stdin-eof-driver.mjs` internally invokes
`measure-stdin-eof-parent.mjs <projectPath> <pidFile> the external analyser` as a
detached child, then `process.kill(parentPid, "SIGKILL")`.)

## Observed outcome

Run four times in immediate succession for reproducibility:

| Run | Parent pid | Child pid | Self-terminated? | Elapsed until child exit |
|-----|-----------|-----------|-------------------|---------------------------|
| 1   | 3034489   | 3034496   | yes               | ~200ms (first poll tick after `SIGKILL`) |
| 2   | 3034796   | 3034803   | yes               | ~201ms (first poll tick after `SIGKILL`) |
| 3   | 3034850   | 3034857   | yes               | ~201ms (first poll tick after `SIGKILL`) |
| 4   | 3034927   | 3034934   | yes               | ~201ms (first poll tick after `SIGKILL`) |

**The child self-terminates on its own once its stdin reaches EOF.** All four
runs report `childSelfTerminatedOnParentDeath: true`, consistently, at the
first 200ms poll tick — the poll interval is the measurement's own
granularity floor (finer timing was not needed to answer the yes/no
question), not evidence of a slow shutdown; a `pgrep -af 'mcp-server-stdio'`
immediately after each run found no surviving process. No run left an
orphaned `the external analyser` process behind.

Raw JSON from run 1 (representative):

```json
{
  "ok": true,
  "bin": "the external analyser",
  "version": "the external analyser 0.9.20",
  "parentPid": 3034489,
  "childPid": 3034496,
  "pollBoundMs": 15000,
  "childSelfTerminatedOnParentDeath": true,
  "elapsedMsUntilChildExit": 200,
  "date": "2026-08-24T10:41:12.722Z"
}
```

## Decision

**No startup sweep is needed.** `the external analyser 0.9.20` observes stdin EOF
(delivered by its parent's file descriptors closing, whether the parent exited
cleanly or was `SIGKILL`ed with no exit hook running at all) and terminates
on its own, promptly. D18-23's assumption — that a `SIGKILL`ed
`vice-proxy.ts` would not leave a permanently-orphaned `the external analyser`
process holding a project file — is now a measured fact, with this document
as its evidence, not an assumption carried forward.

This does not make `vice-proxy.ts`'s own synchronous teardown hook (task 3(a),
`closeAnnoSessionSync()` wired into the `TEARDOWN-REGION`) redundant: that
hook covers the SIGINT/SIGTERM/stdin-close paths, where `vice-proxy.ts` gets a
chance to act and closing the child immediately (rather than waiting on the
child's own EOF-detection latency) is strictly better. This measurement
covers the one path where `vice-proxy.ts` gets NO chance to act at all
(`SIGKILL` on the proxy itself) — and confirms that path is also safe,
independent of anything this project's own code does.

## Reproducing this measurement

```bash
cd .planning/phases/18-persistent-session-and-tool-surface/evidence
node measure-stdin-eof-driver.mjs
```

Requires `the external analyser` on `PATH` (or `ANNO_BIN` pointing at it). Exits
with a non-zero status and a `{"ok": false, "reason": ...}` line if the
binary cannot be spawned or the measurement cannot otherwise be performed —
this document's own verdict is not to be recorded from an assumed result if
that happens on a future re-run.
