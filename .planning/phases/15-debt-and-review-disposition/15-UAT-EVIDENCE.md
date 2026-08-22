---
tested_artifact_sha: d526f52068099de7fa9f950eaa8cf4cdb5d09bb9
tested_artifact_route: local-checkout-HEAD
stock_binary_path: /usr/bin/x64sc
vice_version: "x64sc (VICE 3.9)"
stock_binary_package_version: "3.9+dfsg-1"
c1541_binary_path: /usr/bin/c1541
acme_version: "ACME, release 0.97 (\"Zem\"), 31 Jan 2021, Platform independent version"
node_version: v22.22.0
driven_by: agent (this plan's own executor, live opt-in node --test run plus one uncommitted ad-hoc probe script for the joystick measurement -- see § Driving mechanism)
date: 2026-08-22
scenario_1_verdict: pass
scenario_2_verdict: partial
---

# Phase 15 Plan 08 — Scenario 1 and Scenario 2 Live Evidence

Live execution of Phase 03's UAT scenarios 1 and 2 against genuine, unpatched stock
`/usr/bin/x64sc` (VICE 3.9, Debian package `3.9+dfsg-1`) through the real broker-launched
production code path (`stock-broker-live.test.ts`'s own harness: `resources/vice-broker.mjs`,
`buildViceArgs()`, `dispatchStock()` against a genuinely granted instance) -- never a hand-built
argv or an in-process shortcut for the launch under test.

## Driving mechanism

Scenario 1's three tools and scenario 2's keyboard half are each a committed, opt-in
`node --test` case in `.claude/mcp/vice/stock-broker-live.test.ts` (default-skipped,
`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-broker-live.test.ts` to run). Scenario 2's
joystick half is a **measurement, not a pass/fail** (see § Scenario 2, below), so per this plan's
own instruction it is **not** in the committed test file -- it was run via a one-off Node script
that imports the exact same production modules (`build.ts`, `vice-broker-client.ts`,
`stock-dispatch.ts`, `stock-connect.ts`, `broker-launch.mts`) and reuses the real
`resources/vice-broker.mjs` artifact, never a parallel hand-spawned emulator. That script lived
only under this session's own scratch directory (`/tmp/claude-.../scratchpad/scenario2/probe.mts`),
was never copied into the repository, and no longer exists on disk. Its full console output is
quoted verbatim below.

## Scenario 1 — `vice_autostart` / `vice_disk_attach` / `vice_snapshot_load` against real fixtures

**Verdict: PASS.** All three tools were exercised end to end against a real broker-launched
genuine-stock instance, through a real `.d64` built at run time. Two of the three legs
(`vice_disk_attach`, `vice_autostart`) were already covered by this file's own pre-existing
`.d64` test case (Task 1's own header comment traces this to audit item I-2 / phase 8.2 plan 03);
this plan added the third leg, `vice_snapshot_load`, as a new committed test case.

### Fixture provenance

The `.d64` is built at run time by the absolute-path `/usr/bin/c1541` from a synthetic `.prg`
this test file writes in-process (never a copyrighted image): 2-byte little-endian load address
(`$0801`), 2 sacrificial bytes (written `0x00 0x00`, deliberately never asserted on -- see
FINDING-D1 below), then a 16-byte verified payload of fifteen `0xEA` (NOP) bytes followed by one
`0x60` (RTS), landing at `$0803`-`$0812` after load.

**FINDING-D1 (pre-existing, this test file's own header comment, re-confirmed by this run):** a
raw machine-code `.prg` whose first two bytes at `$0801` are not a valid BASIC "next line" link
pointer does not survive VICE's own simulated-RUN autostart byte-for-byte -- the BASIC program
relink scans forward from `$0801` for a terminating zero byte and overwrites those first two
bytes with a computed value. This fixture's own first two bytes are therefore sacrificial by
design and never checked; the verified payload starts two bytes later, at `VERIFIED_PAYLOAD_ADDRESS`
= `$0803`.

### `vice_autostart`

Raw payload (from the pre-existing `.d64` case, re-run this session):

```json
{"path":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","sentPath":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","run":true,"index":0,"runState":"running"}
```

Observed delta: the verified payload region (`$0803`-`$0812`) matched
`[234,234,234,234,234,234,234,234,234,234,234,234,234,234,234,96]` (the expected NOP-run-ending-RTS
pattern) after 2 poll attempts (resume -> sleep -> read, per this file's own load-timing
discipline). **Verdict: PASS** -- the load-then-run round trip completes and lands the payload.

### `vice_disk_attach`

Raw payload:

```json
{"unit":8,"path":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","sentPath":"/tmp/stock-broker-live-kKN6BZ/brokerlive.d64","approximation":"AUTOSTART with the run flag clear (D-14)","runState":"running"}
```

**The machine WAS reset and a program WAS loaded**, consistent with Phase 13's A5 finding
(`13-PROBE-RESULTS.md` § A5: `AUTOSTART` with `runAfter=false` still performs a full machine
reset and loads a program from the attached image, contradicting the advertised "attach without
loading or running anything" approximation). This run's own `runState: "running"` in the answer
above is the same signature A5 recorded: a pure attach-only operation would leave the machine in
whatever state it already was, not report `"running"`. This is not a new finding -- it is this
run's own independent corroboration of an already-filed one
(`.planning/todos/pending/` — the `vice_disk_attach` D-14 approximation todo from Phase 13 plan
13-05, not re-filed here). **Verdict: PASS** (the call succeeds and the payload lands, per the
`vice_autostart` result immediately after it in the same test) **with the pre-existing,
already-filed caveat that its advertised approximation undersells its real side effects.**

### `vice_snapshot_load` (the new leg this plan adds)

A `vice_snapshot_save` -> perturb -> `vice_snapshot_load` round trip, added as a new committed
test case. The verdict rests on two byte comparisons, never on the absence of an error:

1. **Baseline** (before any perturbation), read from `$C000` (RAM under BASIC ROM in bank 0,
   always plain RAM regardless of banking, and outside the loaded program's own `$0801`-`$0812`
   region): `[255,255,0,0]`.
2. **`vice_snapshot_save`** raw payload:
   ```json
   {"name":"brokerlive_roundtrip","path":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","sentPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","includeRoms":false,"includeDisks":false,"metadataWritten":true,"metadataPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.json","runState":"stopped"}
   ```
3. **Perturbation**: `vice_memory_write` wrote `[222,173,190,239]` (`0xDE 0xAD 0xBE 0xEF`) to
   `$C000`; a read immediately after confirmed it stuck: `[222,173,190,239]`.
4. **`vice_snapshot_load`** raw payload:
   ```json
   {"name":"brokerlive_roundtrip","path":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","sentPath":"<repoRoot>/.vice-snapshots/brokerlive_roundtrip.vsf","programCounter":58836,"metadata":{"description":null,"createdAt":"2026-08-22T15:21:55.292Z"},"runState":"stopped"}
   ```
5. **Half 1 (restore proof):** `$C000` read back **after** the load: `[255,255,0,0]` -- exactly
   the pre-perturbation baseline, **not** the perturbed pattern. The load restored state.
6. **Half 2 (identity proof):** the program's own verified payload region (`$0803`-`$0812`) read
   back after the load: `[234,234,234,234,234,234,234,234,234,234,234,234,234,234,234,96]` --
   still byte-identical to what it was before the save/perturb/load cycle. The load restored
   *this* machine, not some other one.

**Verdict: PASS**, decided entirely by the two byte comparisons above, never by the wire calls'
own reported success.

### Cleanup

`stock-paths.ts`'s `snapshotPathFor()`/`snapshotMetaPathFor()` are fixed to
`<repoRoot()>/.vice-snapshots/<name>.{vsf,json}` with no override to redirect into this harness's
own scratch directory (by design, T-3-05: keeps every snapshot inside the workspace's
`hostpath.ts`-translatable tree). `.vice-snapshots/` is gitignored, but the test still cleans up
its own two artifacts explicitly in a `finally` block rather than leaving them on disk. Confirmed
absent after the run:

```
$ ls .vice-snapshots/
r2000_probe_vsf.json  r2000_probe_vsf.vsf  r2000_probe_vsf_v2.json  r2000_probe_vsf_v2.vsf
```

(the two `r2000_probe_vsf*` files are pre-existing, unrelated artifacts from earlier regenerator2000
work -- `brokerlive_roundtrip.vsf`/`.json` are not present.)

### Process/scratch cleanup, whole opt-in run

```
$ pgrep -af x64sc
(no output -- no x64sc process from this run)
$ pgrep -af vice-broker
676247 .../vice-broker.mjs --repo-root /tmp/fake-repo-root-singleton --state-dir /tmp/broker-control-singleton-live-JAwkm0
```

The one `vice-broker` process listed is `broker-control.test.ts`'s own long-lived singleton
fixture (confirmed via `ps -o lstart`: started ~4 hours before this session, well before this
plan's work began, and `grep -l "broker-control-singleton" *.test.ts` resolves it to that file, not
`stock-broker-live.test.ts`) -- not a process this run started or leaked. Every `withBrokerHarness()`
scratch directory (`mkdtempSync(tmpdir(), "stock-broker-live-...")`) is removed in that helper's
own `finally` block; none was found left behind by manual inspection after the run.
