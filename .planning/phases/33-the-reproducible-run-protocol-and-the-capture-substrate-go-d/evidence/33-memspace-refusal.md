# 33-memspace-refusal — the main-CPU memspace assertion, observed refusing

**Owner:** plan `33-10`. **Measured:** 2026-09-02, on this host, against genuine unpatched
stock VICE 3.9 at `/usr/bin/x64sc`. **Bound by** `evidence/README.md` § *Evidence
conventions* and `evidence/SCHEMA.md` § 3 (`MEMSPACE_ASSERTION`, domain
`refuses | did-not-refuse`).

`D-28`: prove **by observation** that the main-CPU memspace assertion can refuse, and prove
it **discriminates** by showing it pass on a clean machine first. The contaminated state has
no synthetic equivalent worth trusting, which is why this is an observation and not a unit
test — § *Why there is no unit test for this* says so in full.

The script is `evidence/capture-pair.mjs`, verb `memspace`. Route and broker narrative are
`33-capture-pair.md`'s; this file does not restate them.

`PROBE_DIR`: `/home/henrik/.cache/c64-re-tools/phase33/33-10`

---

## Preconditions, observed

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc || echo "(no x64sc)"
(no x64sc)
```

BROKER_STATE: inactive
TEST_AUTOMATED_BASELINE: 2 failing tests in 1 file (anno-register.test.ts :385, :479) — tests 3113 / pass 3105 / fail 2; the single observation is transcribed in `33-capture-pair.md` § *The observed `test:automated` baseline`, taken before any broker child in this plan existed

The `vice-broker` **unit** was `inactive` throughout, exactly as for the capture runs. The
broker actually used is the same task-scoped child process with its state directory under
`PROBE_DIR` and `VICE_BROKER_WARM_FLOOR=0`, started and stopped by the script inside the run
— see `33-capture-pair.md` § *The broker, deliberately started*. `POST_X64SC (none)` after
the run: nothing orphaned.

---

## The assertion, stated before it was run

There is **no** "read `default_memspace`" command in the binary monitor. The contaminated
state cannot be queried; it can only be observed through commands that **depend** on it.
`33-RESEARCH.md`'s pitfall `P10` names exactly two such commands, and the assertion is the
conjunction of both:

| Check | The command | Why it depends on `default_memspace` |
|---|---|---|
| **(a) stepping** | `ADVANCE_INSTRUCTIONS` (0x71), `stepOver: false`, `count: 1` | carries **no memspace byte** at all, so it acts on whatever the monitor's default memspace currently is. `P10`: after contamination it steps the **drive** CPU |
| **(b) bank condition** | `CONDITION_SET` (0x22) with the expression `(@ram:$0400 == $20)` | a `@bank:`-bearing condition is resolved against the default memspace's bank set. `P10`: after contamination it **fails outright** |

- **PASS** iff a memspace-less `ADVANCE_INSTRUCTIONS` moved the **main** CPU's `PC` **and**
  the `@bank:`-bearing condition was accepted.
- **REFUSE** iff either check fails, naming which one and what it observed.

Both sub-results are recorded separately on both sides, whatever the conjunction says, so a
reader can re-derive the verdict under a narrower definition instead of taking this one on
trust. § *What each sub-check actually did* does that re-derivation explicitly, including the
one it would change.

The condition expression is `(@ram:$0400 == $20)` — **every comparison parenthesised**,
because checkpoint conditions have **no operator precedence** (`mon_parse.y:168`) and an
unparenthesised chain silently parses into something always false; and **both literals
written with `$`**, because bare integers in a monitor condition are hex by default
(`monitor.c:1597`).

The drive checkpoint is armed on **wire memspace `0x01`** (unit 8) through
`checkpointSetBody`'s own `memspaceByte()` mapping. Never `0x08`: that is VICE's *internal*
main-memory enum value, the wire byte is a different encoding
(`monitor_binary.c:401-434`), and the monitor rejects `0x08` outright.

---

## The run

Sequence: launch and acquire → connect → `PING` readiness → resolve register ids **by name**
on both memspaces → arm the `$EA31` frame anchor → `AUTOSTART` → count 60 anchor hits so the
drive is genuinely working → **step 1 clean control** → **step 2 contaminate** → **step 3 the
same assertion again**.

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs memspace --label memspace-v2 --target 60
RUN_LABEL memspace-v2
PROBE_DIR /home/henrik/.cache/c64-re-tools/phase33/33-10
DATE_UTC 2026-09-02T22:39:01.534Z
RELEASE_SHA256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
BANK_CONDITION (@ram:$0400 == $20)
PREFLIGHT_BROKER inactive
PREFLIGHT_X64SC (none)
BROKER_START_ENV VICE_BIN=/usr/bin/x64sc VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1
BROKER_START_CMD /home/henrik/.nvm/versions/node/v24.20.0/bin/node /home/henrik/dev/henrik/git/c64-re-tools/src/mcp/vice/resources/vice-broker.mjs --repo-root /home/henrik/dev/henrik/git/c64-re-tools --state-dir /home/henrik/.cache/c64-re-tools/phase33/33-10/broker-state
BROKER_START_AT 2026-09-02T22:39:01.664Z
BROKER_JSON pid=441271 control=0.0.0.0:19510 warm_floor=0 max=1
BROKER_BACKEND stock binary=/usr/bin/x64sc
GRANT id=req-441258-1788388742083-7e9d22a3 port=6600
SPAWN_ARGV ["/usr/bin/x64sc","-default","-console","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]
CONNECTED_AFTER_MS 164
OPEN_EVENTS (none)
MONITOR_READY_AFTER_PINGS 1
REGISTER_CATALOG_MAIN 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
REGISTER_CATALOG_DRIVE8 3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
RESOURCE Drive8TrueEmulation=1
RESOURCE Drive8Type=1541
ARMED_ANCHOR cp=1 start=$ea31
AUTOSTART err=0x00
COUNTED reached=true hits=60 target=60 reason=-
--- STEP 1: the CLEAN control -- no drive checkpoint hit yet ---
MEMSPACE_ASSERTION_CLEAN advance_err=0x00
  (a) stepping: main  PC $ea31 -> $ffea moved=true
  (a) stepping: drive PC $d125 -> $d127 moved=true (recorded, NOT a pass condition -- see the header)
  (a) VERDICT pass: a memspace-less ADVANCE_INSTRUCTIONS moved the MAIN CPU ($ea31 -> $ffea)
  (b) bank condition 1/2 on cp=2: err=0x00
  (b) bank condition 2/2 on cp=3: err=0x00
  (b) VERDICT pass: the condition `(@ram:$0400 == $20)` was accepted on both attempts
  CLEAN ASSERTION PASS -- PASS: a memspace-less command still reaches the main CPU (check a) and a @bank:-bearing condition is still accepted (check b)
--- STEP 2: contaminate with ONE drive-memspace checkpoint hit (wire memspace 0x01) ---
ARMED_DRIVE_CHECKPOINT cp=4 start=$e000 end=$ffff memspace=0x01 stop=true err=0x00
CHECKPOINT_INFO_VERBATIM {"type":"checkpoint_info","requestId":4294967295,"errorCode":0,"checkpoint":{"id":4,"currentlyHit":true,"start":57344,"end":65535,"stopWhenHit":true,"enabled":true,"operation":4,"temporary":false,"hitCount":1,"ignoreCount":0,"hasCondition":false}}
CHECKPOINT_INFO id=4 currentlyHit=true start=$e000 end=$ffff stop=true enabled=true op=0x4 temporary=false hit_count=1 ignore_count=0 hasCondition=false
--- STEP 3: the SAME assertion, after exactly one drive checkpoint hit ---
MEMSPACE_ASSERTION_CONTAMINATED advance_err=0x00
  (a) stepping: main  PC $ee85 -> $eea9 moved=true
  (a) stepping: drive PC $e92d -> $e9c8 moved=true (recorded, NOT a pass condition -- see the header)
  (a) VERDICT pass: a memspace-less ADVANCE_INSTRUCTIONS moved the MAIN CPU ($ee85 -> $eea9)
  (b) bank condition 1/2 on cp=5: THREW -- binary monitor returned error code 0x8f for response type 0x00
  (b) bank condition 2/2 on cp=6: THREW -- binary monitor returned error code 0x8f for response type 0x00
  (b) VERDICT REFUSAL: the condition `(@ram:$0400 == $20)` was REFUSED
  CONTAMINATED ASSERTION REFUSES -- REFUSAL: a @bank:-bearing condition was refused (check b): binary monitor returned error code 0x8f for response type 0x00; binary monitor returned error code 0x8f for response type 0x00. default_memspace is contaminated: a drive checkpoint hit set it (monitor.c:3393-3396) and NO binary-monitor command resets it, so the monitor's default target is no longer the main CPU and nothing over this wire can put it back.
DERIVED_MEMSPACE_ASSERTION refuses
SUBCHECK_STEPPING clean=pass contaminated=pass discriminates=false
SUBCHECK_BANK_CONDITION clean=pass contaminated=refuse discriminates=true
BROKER_STOP_AT 2026-09-02T22:39:09.858Z
POST_X64SC (none)
MEMSPACE_RECORD /home/henrik/.cache/c64-re-tools/phase33/33-10/memspace-v2.memspace.json
```

### The contamination frame, verbatim

The `CHECKPOINT_INFO` (0x11) frame for the **one** drive-memspace hit, exactly as the shipped
`stock-protocol.ts` parser produced it, with nothing summarised:

```
{"type":"checkpoint_info","requestId":4294967295,"errorCode":0,"checkpoint":{"id":4,"currentlyHit":true,"start":57344,"end":65535,"stopWhenHit":true,"enabled":true,"operation":4,"temporary":false,"hitCount":1,"ignoreCount":0,"hasCondition":false}}
```

`requestId` is `4294967295` = `0xffffffff`, the broadcast id every unsolicited message
arrives at. `hit_count` is **1** — exactly one hit, which is what `D-28` asks for. `start`
`57344` / `end` `65535` are `$E000`/`$FFFF`, the 1541 DOS ROM window, armed as a range so the
drive's own loop hits it whatever entry point that loop happens to use. `operation` `4` is
`Exec`. `stopWhenHit` is `true`, so the machine halted on the hit — the state the assertion
is then run against.

The drive checkpoint was **deleted** immediately after the hit, so nothing in step 3 can be
attributed to it still being armed. Deleting it does **not** reset `default_memspace`; that
is the whole point.

---

## What each sub-check actually did — including the one that did not discriminate

This is the part a reader most needs, because the two checks did **not** behave the same way
and the verdict would change under a narrower definition.

| Sub-check | Clean machine | After one drive checkpoint hit | Discriminates? |
|---|---|---|---|
| **(a) stepping** — a memspace-less `ADVANCE_INSTRUCTIONS` moves the main `PC` | **pass** — main `$ea31 → $ffea` | **pass** — main `$ee85 → $eea9` | **no** |
| **(b) bank condition** — `(@ram:$0400 == $20)` is accepted | **pass** — `err=0x00` on both of two independently armed checkpoints | **REFUSED** — error `0x8f` on both of two independently armed checkpoints | **yes** |

**Check (a) did not discriminate on this build, and that is a finding, not an omission.**
`P10` predicts that after contamination `ADVANCE_INSTRUCTIONS` steps the drive CPU rather
than the main one. Measured here on stock 3.9, after exactly one drive-memspace checkpoint
hit, a memspace-less `ADVANCE_INSTRUCTIONS` **still moved the main CPU's `PC`**
(`$ee85 → $eea9`). So either this build's `ADVANCE_INSTRUCTIONS` path does not read
`default_memspace`, or one drive checkpoint hit is not sufficient to retarget it. This
measurement does not distinguish those two, and does not claim to. **Had the assertion been
defined over check (a) alone, this file would record
`MEMSPACE_ASSERTION: did-not-refuse`.** That is stated here so nobody has to infer it, and
`did-not-refuse` was a live outcome of this run rather than a branch that could not be
reached.

**Check (b) discriminated cleanly, twice on each side.** The `@bank:`-bearing condition is
accepted (`err=0x00`) before the hit and refused (`0x8f`) after it, with the expression
byte-identical, the probe checkpoint armed the same way at the same address (`$0326`) on the
same main memspace, and the **only** intervening event being the one drive checkpoint hit.
Each side ran the check on **two independently armed checkpoints** precisely so a single
failure could not be blamed on "the second `CONDITION_SET` of a session fails"; both attempts
agree on both sides.

**What the conjunction is therefore resting on.** One of the two symptoms `P10` names, and
the more specific one: `@bank:` resolution is exactly the mechanism that has to consult the
default memspace's bank set, whereas instruction stepping apparently does not on this build.
The assertion refuses, and it refuses for an observed reason with a named error code.

MEMSPACE_ASSERTION: refuses

### The two downstream symptoms `P10` names

| `P10` symptom | Observed in this session? |
|---|---|
| `ADVANCE_INSTRUCTIONS` steps the drive CPU rather than the main one | **not observed** — the main `PC` moved on both sides (see check (a) above). Recorded as not observed rather than assumed present |
| a `@bank:` condition fails outright | **observed** — `err=0x00` clean, `0x8f` contaminated, twice each |

`EXECUTE_UNTIL_RETURN` (0x73), the third command `P10` mentions, was **not** exercised: it
runs the machine to a return and would leave the session in a state the two checks above
could no longer be attributed against. Recorded as not exercised rather than left to look
like an oversight.

---

## Why there is no unit test for this

`D-28` calls for an observation, and the reason is a property of the state rather than a
preference about testing style.

`default_memspace` has **no synthetic equivalent worth trusting**. There is no
binary-monitor command that reads it, so a fake cannot be asserted against the real thing;
and there is **no binary-monitor command that resets it** (`monitor.c:3393-3396` sets it on a
drive checkpoint hit and nothing puts it back), so the contaminated state is not reachable,
inspectable or reversible from any surface a test could stand on. A unit test would have to
mock the very thing whose behaviour is in question, and would then pass whether or not stock
VICE behaves as `P10` says. The only way to see the refusal is to contaminate a real machine
and watch — which is what happened above.

This is also why the **clean control ran first**. Without it, a refusal on the contaminated
machine is indistinguishable from an assertion that always refuses. That is not a
hypothetical concern here: it happened, and the control caught it — see § *Voided runs*.

`stock-reproducible-run.ts` is unaffected by any of this and remains immune **by
construction**, which this measurement supports rather than undermines: every command that
procedure sends carries an explicit memspace byte (`0x00`, through the encoders' own mapping)
or no memspace at all, and it never sends `ADVANCE_INSTRUCTIONS`, `EXECUTE_UNTIL_RETURN` or a
`@bank:`-bearing condition. Check (b) failing after contamination is exactly the failure that
module's *WHAT NOT TO DO* list forbids reintroducing.

---

## Voided runs

**VOIDED RUN M1** — `memspace --label memspace --target 60`, `2026-09-02T22:36:52.976Z`.
**Reason: the assertion under test was mis-defined, so the run measured the definition rather
than the machine.** An earlier draft of `assertMainCpuMemspace()` passed only when the main
`PC` moved **and** the drive `PC` did not. Its clean control refused:

```
$ node .planning/phases/33-.../evidence/capture-pair.mjs memspace --label memspace --target 60
--- STEP 1: clean control (no drive checkpoint hit yet) ---
MEMSPACE_ASSERTION_CLEAN advance_err=0x00
  main  PC $ea31 -> $ffea moved=true
  drive PC $d125 -> $d127 moved=true
  REFUSAL: a memspace-less ADVANCE_INSTRUCTIONS did not step the main CPU. main PC stayed at $ea31, unit 8 moved $d125 -> $d127. ...
```

Read the numbers against the message: the main `PC` **did** move (`$ea31 → $ffea`) and the
message says it stayed. The `!driveMoved` clause was wrong, and wrong in a way that could
never come right: with `Drive8TrueEmulation=1` the drive CPU runs concurrently with the main
one, so advancing the main CPU advances emulated time and the drive `PC` moves too. That
draft was an **assertion that always refuses** on any true-drive-emulation machine, and it
would have produced a `refuses` verdict in step 3 for entirely the wrong reason.

**This is the clean control earning its place.** `D-28` requires it precisely so a refusal is
proven discriminating rather than assumed to be, and the first thing it did was catch a
defect in the assertion it was controlling for. Had the clean control been skipped, this file
would have recorded `MEMSPACE_ASSERTION: refuses` on a measurement that proved nothing.

The whole of run M1 is discarded, not repaired: its step-3 refusal is not quoted anywhere as
evidence, and the retained run above is a fresh launch with the corrected assertion.
Everything the corrected run reports was re-observed from scratch. Run M1 orphaned nothing
(`POST_X64SC (none)`).

Fixed at the cause: `assertMainCpuMemspace()` now passes on `mainMoved` alone for check (a),
records the drive `PC` as evidence rather than as a pass condition, and carries the measured
reason in its own header so the clause cannot be reintroduced by someone who thinks a
concurrent drive CPU ought to hold still.

No other run in this file was voided, and no run was retried to make the outcome come out a
particular way — the corrected run was taken once and is reported once.
