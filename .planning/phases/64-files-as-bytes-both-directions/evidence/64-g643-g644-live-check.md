# G-64-3 and G-64-4 live check — plan 64-14

The measured record of both plans 64-12 and 64-13's fixes, live, against the absolute
`/usr/bin/x64sc` (VICE 3.9) and a broker started as a transient systemd user unit: a cold
session's first `vice_ping`/`vice_warp_set` succeeds on its first attempt with no retry, and
the upload-then-command race behind the intermittent `0x8f` (G-64-3, "condition syntax
error") no longer reproduces across the exact loop the diagnosis measured.

## Environment

| Item | Value |
|---|---|
| Host | `ho-laptop`, Linux 6.12.107+deb13-amd64 |
| `/usr/bin/x64sc --version` | `x64sc (VICE 3.9)` |
| `/usr/bin/c1541 -version` | `c1541 (VICE 3.9)` |
| `/usr/bin/petcat -version` | `petcat (VICE 3.9)` |
| Node | `v24.20.0` |
| Absolute node path | `/home/henrik/.nvm/versions/node/v24.20.0/bin/node` |
| `systemctl --user` | usable |
| Pre-flight | `vice-broker.service`/`vice-broker-g641.service`/`vice-broker-g6434.service` all absent from `systemctl --user list-units 'vice-broker*' --all`; no `vice-cli.mjs broker\|vice-broker\|x64sc` process; no listener on 19510 or any 66xx port; `~/.c64-re-tools/supervisor/broker.json` was a STALE record (pid 25566, no longer alive) -- all clear before this run started |
| Incident-directory marker | newest file before this run: `20260923231109635-port45699-epochunknown.md` -- every scan below counts only records strictly newer than this |
| `node --test resources-sync.test.ts` (src/mcp/vice) | 2/2 pass, exit 0 -- the broker runs the fixed, committed code |

## The exact unit command

```
systemd-run --user --unit=vice-broker-g6434 --collect \
  --working-directory=/home/henrik/dev/henrik/git/c64-re-tools \
  --setenv=VICE_BIN=/usr/bin/x64sc \
  --setenv=MASTRA_TELEMETRY_DISABLED=1 \
  -- /home/henrik/.nvm/versions/node/v24.20.0/bin/node \
     /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/vice-cli.mjs broker
```

No `--repo-root`, no `VICE_BROKER_HOME`, no `VICE_POOL_DIR` -- same shape as plan 64-11's own
unit command, executed directly against this checkout (with plans 64-12/64-13 merged) rather
than a published tarball. The journal confirms `vice-broker: backend "stock" (binary:
/usr/bin/x64sc)` and `bound control listener on: 127.0.0.1, 172.25.0.1, 172.17.0.1 (port
19510)`.

## Task 1 -- cold sessions on both channels

Subjects built exactly as plan 64-11 did (lowercase `poke` in the BASIC source --
`petcat -w2`'s tokenizer is case-sensitive on keywords, a gotcha that plan's own evidence
already recorded): `10 poke 49152,201` tokenized to `subject.prg`, written to `subject.d64`
via `c1541 -format ... -write`, plus a separately formatted `blank.d64`. One empty scratch
client-project directory per proxy session, all outside the repository tree.

`evidence/64-g643-g644-live-run.mjs` imports `spawnLiveDriverSession()`/`parsedContentOf()`
from the committed `64-g641-live-driver.mjs` (one spawn/transcript implementation, never a
second) and drove the `cold` and `cold-text` phases: 5 fresh sessions calling `vice_ping`
exactly once (no retry), 2 fresh sessions calling `vice_warp_set({enabled:false})` exactly
once, each session closed and its process confirmed gone before the next one started.

| Session | First call | isError | Elapsed | `launching` journal time |
|---|---|---|---|---|
| cold 1 | `vice_ping` | `false` | 2085ms | 01:17:54 |
| cold 2 | `vice_ping` | `false` | 1553ms | 01:17:57 |
| cold 3 | `vice_ping` | `false` | 1460ms | 01:17:59 |
| cold 4 | `vice_ping` | `false` | 1517ms | 01:18:01 |
| cold 5 | `vice_ping` | `false` | 1597ms | 01:18:03 |
| cold-text 1 | `vice_warp_set` | `false` | 1478ms | 01:18:05 |
| cold-text 2 | `vice_warp_set` | `false` | 1354ms | 01:18:08 |

**Every one of the 7 cold sessions' first call returned `isError: false` on its only
attempt, with no retry.** This is the exact opposite of `.planning/debug/cold-launch-relay-attach-race.md`'s own baseline (0/9 first-attempt success on the unmodified broker) -- plan
64-12's gated relay attach (`dialEmulatorLeg()`) closes G-64-4 live.

Journal scan for the run window: `grep -acF 'launching'` = **7** (exactly one per session, no
extra cold launches); `grep -aE 'relay death' | grep -acF 'relay_error'` = **0**. Incident
scan: `ls .../incidents/` newer than the pre-flight marker = **0 records** -- no spurious
evidence was written while proving this.

`node --check evidence/64-g643-g644-live-run.mjs` exits 0.

## Task 2 -- the recycle's first attach, and the save/load/attach loop

### Recycle

One fresh session: `vice_ping` (cold) -> `vice_recycle` -> `vice_ping` -> one further
`vice_ping`, all four recorded verbatim.

| Step | Tool | isError | Elapsed | Text (verbatim) |
|---|---|---|---|---|
| 1 (cold-ping) | `vice_ping` | `false` | 1459ms | `{"status":"ok","backend":"stock","viceVersion":"VICE 3.9.0.0",...}` |
| 2 (recycle) | `vice_recycle` | `false` | 587ms | `{"recycled":true,...,"killStage":"sigterm","runState":"stopped"}` |
| 3 (post-recycle-ping) | `vice_ping` | **`true`** | 20ms | `vice_ping: the emulator's identity could not be proven across a reconnect (baseline epoch 1, current epoch 2) -- treat every result since the previous call as void and retry.` |
| 4 (extra-ping) | `vice_ping` | `false` | 1459ms | `{"status":"ok","backend":"stock",...}` |

Step 3's text does **not** carry G-64-4's signature (`"stock handshake failed"` together with
`"abandoned"`) -- `containsAbandoned: false` on the raw text. This is exactly the "by-design
identity refusal after the respawn" the plan's own action anticipated: a genuine, separate
epoch-mismatch guard (baseline epoch 1 vs. current epoch 2, i.e. the recycle's own respawn
was correctly detected as a NEW emulator identity), not the cold-launch race. Step 4's
further `vice_ping` succeeded. Journal for the recycle window shows `launching` immediately
after `recycle on target ... tore down live relay session(s) ... ahead of the kill`, with
**zero** `relay_error` relay deaths anywhere in the run.

### Loop -- 15 iterations, zero 0x8f

One fresh session, 15 iterations of `{3 x (vice_memory_read @$C000 size 1 + vice_execution_run), vice_snapshot_save("g6434_loop"), vice_snapshot_load("g6434_loop"), vice_disk_attach(unit 8, blank.d64)}` -- the exact loop `.planning/debug/vice-0x8f-disk-attach-snapshot-load.md` measured.

| Tool | Calls | isError false | isError true | 0x8f count |
|---|---|---|---|---|
| `vice_memory_read` | 45 | 45 | 0 | 0 |
| `vice_execution_run` | 45 | 45 | 0 | 0 |
| `vice_snapshot_save` | 15 | 15 | 0 | 0 |
| `vice_snapshot_load` | 15 | 15 | 0 | 0 |
| `vice_disk_attach` | 15 | 15 | 0 | 0 |
| **Total** | **135** | **135** | **0** | **0** |

**Compared with the diagnosis's own baselines:** the unmodified production proxy failed 20 of
30 upload-then-command calls (`snapshot_load` 8/15, `disk_attach` 12/15); the instrumented
"wait for the staged file" mode (the fix's own shape) measured 0 of 30. This run, against the
real, unmodified (post-64-13) production code, measured **0 of 135** -- confirming G-64-3's
completion-reply-gated resolution (`awaitTransferComplete()`) closes the race live, at more
than 4x the call volume the diagnosis itself used.

### Autostart burst

Same kind of session, 5 calls of `vice_autostart(subject.d64, run:true, index:0)`:

| Attempt | isError | Elapsed | 0x8f | runState |
|---|---|---|---|---|
| 1 | `false` | 1597ms | `false` | `running` |
| 2 | `false` | 61ms | `false` | `running` |
| 3 | `false` | 61ms | `false` | `running` |
| 4 | `false` | 61ms | `false` | `running` |
| 5 | `false` | 61ms | `false` | `running` |

**Every one of the 5 calls returned `isError: false` with no `0x8f`.** After the last call, a
bounded poll of `vice_memory_read` at `$C000` (90s ceiling, 2s interval, 46 attempts) did
**not** find the sentinel (`hex` stayed `"ff"`, `runState` stayed `"stopped"` throughout) --
recorded exactly as instructed ("record which"), not silently retried or softened. This is
disclosed as an open, unexplained observation, not chased further: the plan's own pass rule
for this phase is the burst's `isError`/`0x8f` result (both clean), and production-code
changes are out of scope here. A plausible but UNVERIFIED explanation, offered for whoever
investigates next: five `AUTOSTART` commands issued roughly 60ms apart may each interrupt the
previous command's own in-progress reset/load/keystroke-injection sequence before it reaches
the READY prompt, so the fifth (last) call's own load may never actually complete -- this is
speculation, not a measured root cause, and is unrelated to G-64-3/G-64-4 (neither of which
concerns the autostart keystroke-injection sequence itself).

### Host-side checks after Task 2

Staging directory (`~/.c64-re-tools/staging/`) held nothing for the closed sessions
(directory listing showed 0 entries). Incident scan: 0 records newer than the pre-flight
marker with any trigger. `journalctl` for the full run window: `grep -aE 'relay death' |
grep -acF 'relay_error'` = **0**. The broker unit stayed `active` throughout both tasks.

## Task 3 -- teardown and the full suite

```
systemctl --user stop vice-broker-g6434.service   # exit 0
```

| Check | Result |
|---|---|
| `systemctl --user is-active vice-broker-g6434.service` | `inactive` |
| `ps -eo pid,args \| grep -E 'vice-cli\.mjs broker\|vice-broker\|x64sc'` | 0 matches |
| listener on 19510 | 0 |
| listener on any 66xx | 0 |
| `systemctl --user list-units --all 'vice-broker-g6434*'` | `0 loaded units listed` (the `--collect` unit unloaded itself) |

The scratch directory was removed after this evidence was assembled from its data.

Only with the broker confirmed down, the full-glob suite ran from `src/mcp/vice`:

```
npm test
```

Result: **`4441 tests, 4357 pass, 0 fail, 84 skipped`**, exit 0 -- unchanged from plan
64-13's own post-dispatch baseline (`4441/4357/0/84`). No regressions.

## Correction to `64-g641-live-check.md`

That file's "Live defect 1" traced the cold-launch first-attach failure to "the broker's
kill-never-recycle release policy" killing a still-booting instance on a failed retry. The
corrected mechanism, found and fixed by plans 64-12/64-13 and confirmed live above, is in
`.planning/debug/cold-launch-relay-attach-race.md`: the broker's `attach` acknowledgement was
answered as soon as the emulator-leg dial was ISSUED, not when it CONNECTED (an order
violation between the grant/attach acknowledgement and the real emulator's own bind), and a
separate, sibling upload-publish race (G-64-3) behind the intermittent `0x8f`. The
kill-never-recycle release policy is real and unchanged, but it was not the root cause of the
first-call failure itself -- it only determined what happened to an instance AFTER a failed
attach. `64-g641-live-check.md` is left as-is, as the record of what was believed at the time
G-64-1 closed; this file is the corrected record.

## What this does not prove

- One host (`ho-laptop`) and one VICE build (the absolute `/usr/bin/x64sc`, VICE 3.9) -- this
  host also carries a 3.10 at `/usr/local/bin/x64sc` (also stock), not exercised here.
- A bare host only, not a devcontainer -- this project's own CLAUDE.md records there is no
  devcontainer in this repository; plan 64-10's own evidence covers the container case.
- A same-host broker: the loopback relay is fast, which is exactly the condition that exposed
  both G-64-3 and G-64-4 in the first place. A slow network path between client and broker,
  or between broker and emulator, is not measured by this run.
- The loaded-host bind latency beyond this machine: `.planning/debug/cold-launch-relay-attach-race.md`'s own bind-latency numbers (55-142ms) were measured on this host, under this
  session's own load; a busier or quieter host was not measured here either.
- The autostart burst's sentinel-timeout observation (see above) is disclosed, not explained
  or fixed -- it is neither a G-64-3 nor a G-64-4 regression signal by this plan's own pass
  rule (the burst's `isError`/`0x8f` result), but a reader should not read the clean burst as
  proof the subject program actually ran to completion in this specific run.

## Human-check queued for the owner

Per this plan's own `<human-check>`: after this phase merges, reconnect the vice MCP server
(or start a new session) so it loads the fixed code; start the broker as a systemd user unit
by the documented route with `VICE_BIN=/usr/bin/x64sc`; confirm your session's very first
`vice_ping` succeeds without a retry; run `vice_snapshot_save`, `vice_snapshot_load` and
`vice_disk_attach` a few times each and confirm none returns `0x8f`; then stop the broker and
confirm no `vice-broker`/`x64sc` process and no 19510/66xx listener remain. **Not performed by
this executor** -- recorded here as pending for the owner's own in-session re-run.
