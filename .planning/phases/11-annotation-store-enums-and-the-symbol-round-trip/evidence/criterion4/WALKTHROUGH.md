# Criterion 4 walkthrough: the symbol round trip, live, on a real emulator

Phase 11, plan 11-11. One ordered transcript -- numbered steps, in the order they
actually ran, each with the exact command/tool call and its exact output. The
ordering itself is the evidence that this is one closed loop, not two independent
one-way dumps (T-11-TWO-DUMPS): step 8 proves a name is **absent** from the store
before step 11 discovers it **live** against the running machine, and step 15
proves it ends up back in the store.

## Subject resolution (the objective's ordered rule)

Branch (1) -- a real release resolved through `.claude/skills/c64-ram-capture/scripts/releases.mjs`
-- does not apply on this host: `project-paths.mjs`'s `registryFile()` resolves to
`<repo>/recovery/RELEASES.json`, which does not exist (checked directly: `ls
recovery/RELEASES.json` -> "No such file or directory"). No consuming project with
a registered release is present.

Branch (2) applies: plan 11-07's committed `evidence/criterion1/fixture/recon-subject.prg`
(102 bytes, `sha256 eca741911c38c9d5f9398027aa59d781cd27b7a7018aba02e1c0525e734ca4a5`,
re-verified below) and its already-bootstrapped `evidence/criterion1/recon-subject.regen2000proj`
(7 pre-existing user labels from 11-07's recon session). Both were copied into
this plan's own `evidence/criterion4/` as `subject.prg` / `subject.regen2000proj`
so this walkthrough's own mutations never touch 11-07's evidence artifact.

**Evidence ceiling, stated up front (ENGINEERING_RULES.md §8):** this walkthrough
proves the mechanism end to end against a real emulator and a real regenerator2000
0.9.20, on a small purpose-built recon fixture. It does not prove behaviour on a
commercial release's size, packing or self-modification. See the closing section
for the full statement.

## Banners

```
$ /usr/bin/x64sc --version
x64sc (VICE 3.9)

$ /usr/bin/x64sc --help | grep -c mcpserver
0

$ /usr/local/bin/x64sc --version
x64sc (VICE 3.10)

$ regenerator2000 --version
regenerator2000 0.9.20
```

`/usr/bin/x64sc` is genuine unpatched stock (zero `mcpserver` occurrences in its
own `--help` text); `/usr/local/bin/x64sc` is the fork build (has `-mcpserver`)
and SHADOWS stock on `$PATH` -- a bare `x64sc` would resolve to the fork, so every
launch below names `/usr/bin/x64sc` by absolute path. Both facts are also
re-confirmed at the moment of launch (Step 9) via the binary's own size on disk
and, on connect, the binary monitor's own `VICE_INFO` wire response.

---

## Step 1 -- `[2026-08-20T23:34:35Z]` subject identity re-verified

```
$ sha256sum evidence/criterion4/subject.prg
eca741911c38c9d5f9398027aa59d781cd27b7a7018aba02e1c0525e734ca4a5  subject.prg
```

Matches 11-07-SUMMARY.md's recorded hash exactly -- the copy is byte-identical to
the committed fixture.

## Step 2 -- `[2026-08-20T23:37:06Z]` baseline: `r2000_get_symbols`, before ANY mutation this plan makes

```js
runR2000Tool("r2000_get_symbols", { project: "evidence/criterion4/subject.regen2000proj" })
```

```json
[
  {"address":2,"kind":"Auto","name":"zpa_02","type":"ZeroPageAbsoluteAddress"},
  {"address":788,"kind":"Auto","name":"a_0314","type":"AbsoluteAddress"},
  {"address":789,"kind":"Auto","name":"a_0315","type":"AbsoluteAddress"},
  {"address":2064,"kind":"User","name":"init_screen_and_irq","type":"UserDefined"},
  {"address":2095,"kind":"User","name":"poll_table_and_dispatch","type":"Jump"},
  {"address":2105,"kind":"Auto","name":"b_0839","type":"Branch"},
  {"address":2118,"kind":"Auto","name":"b_0846","type":"Branch"},
  {"address":2124,"kind":"User","name":"border_bump_up","type":"Subroutine"},
  {"address":2128,"kind":"User","name":"border_bump_down","type":"Subroutine"},
  {"address":2132,"kind":"User","name":"raster_sample_isr","type":"UserDefined"},
  {"address":2140,"kind":"User","name":"dispatch_selector_bytes","type":"Field"},
  {"address":2148,"kind":"User","name":"routine_vector_table","type":"UserDefined"},
  {"address":59953,"kind":"Auto","name":"e_EA31","type":"ExternalJump"}
]
```

Two addresses that matter later already carry an AUTO branch label
(`b_0839`/2105, `b_0846`/2118, `kind: "Auto"`) but no USER label. A baseline
`export-lbl` from this exact project (run separately as a sanity check, not
counted as a walkthrough step) confirms these auto names are never exported: only
the 7 `kind: "User"` entries appear in a `.lbl` file, matching `r2000-symbols.ts`'s
documented measured fact that `--export_lbl` emits user labels only.

## Step 3 -- `[2026-08-20T23:38:18Z]` the outbound leg: write ONE user label into the store

Address 2105 (`$0839`) is the re-entry point the running program's own `bne`
jumps to when its dispatch counter wraps back to 0 -- a real address the program
uses, chosen from source-level knowledge of the fixture (this is OUR OWN label,
not a "discovery" claim).

```js
runR2000Tool("r2000_set_label_name", {
  project: "evidence/criterion4/subject.regen2000proj",
  address: 2105,
  name: "counter_wrap_reentry",
})
```

```json
{"content":[{"text":"Label set at $0839","type":"text"}],"isError":false}
```

## Step 4 -- `[2026-08-20T23:38:25Z]` `vice-mcp r2000 export-lbl` (the real CLI verb)

```
$ node vice-proxy.ts r2000 export-lbl evidence/criterion4/subject.regen2000proj --out evidence/criterion4/outbound.lbl
export-lbl: wrote evidence/criterion4/outbound.lbl (8 symbol(s))
```

`outbound.lbl`, full contents:

```
al C:0810 .init_screen_and_irq
al C:082f .poll_table_and_dispatch
al C:0839 .counter_wrap_reentry
al C:084c .border_bump_up
al C:0850 .border_bump_down
al C:0854 .raster_sample_isr
al C:085c .dispatch_selector_bytes
al C:0864 .routine_vector_table
```

8 lines: the 7 pre-existing user labels plus the one just written. Zero
`a_`-prefixed (or any Auto-kind) lines -- confirmed by `grep -c "\.a_"` returning
no match.

## Step 5 -- `[2026-08-20T23:38:29Z]` snapshot the project BEFORE the discovery leg

```
$ cp evidence/criterion4/subject.regen2000proj evidence/criterion4/subject-copy.regen2000proj
```

This copy is used later (Step 16) to exercise the `--import_lbl` leg
independently of the canonical `r2000_set_label_name` path -- it freezes the
project's state at "outbound label present, discovered label NOT yet present."

## Step 6 -- `[2026-08-20T23:38:46Z]` ABSENT BEFORE, negative result #1: the store

```js
runR2000Tool("r2000_get_symbols", {
  project: "evidence/criterion4/subject.regen2000proj",
  start_address: 2118,
  end_address: 2118,
})
```

```json
[{"address":2118,"kind":"Auto","name":"b_0846","type":"Branch"}]
```

**Absent before:** the only entry at address 2118 is regenerator2000's own
auto-generated branch label (`kind: "Auto"`), which Step 4 already proved is
never exported. No **user** label exists at this address in the store.

## Step 7 -- `[2026-08-20T23:38:46Z]` ABSENT BEFORE, negative result #2: the exported file

```js
/0846/i.test(readFileSync("evidence/criterion4/outbound.lbl", "utf8"))  // => false
```

```
outbound.lbl contains "0846": false
```

**Absent before:** no `0846` line anywhere in the file this plan has exported so
far. Both negative results (Steps 6 and 7) are on the record BEFORE the live
discovery step below -- this is the assertion 11-08-SUMMARY.md names as "the one a
shortened version of this test could omit and still look green."

Restated plainly, with the literal words this transcript is required to carry: the
discovered name's address (2118 / `$0846`) was proven **absent before** the live
discovery step below -- absent from the store's user labels (Step 6's negative
result) and absent from the exported `outbound.lbl` (Step 7's negative result).

## Step 8 -- `[2026-08-20T23:41:01.554Z]` stock binary identity, re-confirmed immediately before launch

```json
{
  "requestedPath": "/usr/bin/x64sc",
  "realPath": "/usr/bin/x64sc",
  "sizeBytes": 4057928
}
```

Not a symlink, absolute path, and a size (4,057,928 bytes) already distinct from
the fork build at `/usr/local/bin/x64sc` measured earlier.

## Step 9 -- `[2026-08-20T23:41:01.559Z]` launch genuine stock, exact argv

```json
{
  "binPath": "/usr/bin/x64sc",
  "argv": ["-default", "-drive8type", "1541", "-binarymonitor", "-binarymonitoraddress", "ip4://127.0.0.1:43255"]
}
```

`-default` first (VICE's reset-to-compiled-in-defaults instruction -- anything
placed before it is silently clobbered back to its compiled-in value),
`-drive8type 1541` immediately after it (see the deviation logged below: without
this flag, `AUTOSTART` on ANY program -- disk or bare `.prg` alike -- fails), both
before `-binarymonitor` (or the monitor never binds, per this project's own
documented flag-order incident).

## Step 10 -- `[2026-08-20T23:41:03.069Z]` `stockConnect()` -- the real wire handshake

```json
{"versionQuad": "3.9.0.0", "capabilities": {"cpuHistory": "absent"}}
```

This is `VICE_INFO` read directly off the binary-monitor wire by this project's
own protocol client (`stock-protocol.ts`/`stock-connect.ts`) -- not a CLI
`--version` string. `vice_ping` immediately afterward corroborates it end to end
through the real dispatch table:

```json
{"status":"ok","backend":"stock","viceVersion":"VICE 3.9.0.0","resolvedBinaryPath":"/usr/bin/x64sc","resolvedBinaryPathIsResolved":true,"capabilities":{"cpuHistory":"absent"},"runState":"unknown"}
```

## Step 11 -- `[2026-08-20T23:41:03.091Z]` `vice_autostart` -- load and run the subject on the live machine

```js
dispatchStock("vice_autostart", { path: "evidence/criterion4/subject.prg", run: true }, deps)
```

```json
{"path":".../subject.prg","sentPath":".../subject.prg","run":true,"index":0,"runState":"running"}
```

Then a real 3000ms wall-clock wait for AUTOSTART's simulated KERNAL keystrokes to
reach a stable running point (`[2026-08-20T23:41:06.094Z]`), before any memory
read.

## Step 12 -- `[2026-08-20T23:41:06.097Z]` `vice_symbols_load(outbound.lbl)` -- call #1, and `vice_symbols_lookup` the outbound name

```json
{"path":".../outbound.lbl","format":"vice","symbolCount":8,"skippedLines":1,"duplicateNames":0,"lineCount":9,"replaced":false,"runState":"unknown"}
```

```json
{"query":{"name":"counter_wrap_reentry"},"found":true,"symbolCount":8,"name":"counter_wrap_reentry","address":2105,"runState":"unknown"}
```

**2105 matches exactly the address written into the store in Step 3.**

## Step 13 -- `[2026-08-20T23:41:06.128Z]` live-emulator proof for the outbound address

```js
dispatchStock("vice_disassemble", { address: "$0839", count: 3 }, deps)
```

```
!cpu 6510
dispatch_selector_bytes = $085c
* = $0839
        lda dispatch_selector_bytes,x
        cmp #$ff
        beq $0846
```

Real bytes read off the running machine at the outbound label's own address --
not a number merely asserted into the store, but genuine code the emulator is
actually executing (this program's `lda byte_table,x` / `cmp #$ff` / `beq
take_two` sequence).

## Step 14 -- `[2026-08-20T23:41:06.129Z]` the discovery: disassemble `main_loop` live and observe the branch target

```js
dispatchStock("vice_disassemble", { address: "$082f", count: 9 }, deps)
```

```
!cpu 6510
counter_wrap_reentry = $0839
border_bump_up = $084c
dispatch_selector_bytes = $085c
* = $082f
        ldx $02
        cpx #$08
        bne counter_wrap_reentry
        ldx #$00
        stx $02
        lda dispatch_selector_bytes,x
        cmp #$ff
        beq $0846
        jsr border_bump_up
```

The live disassembler reports `beq $0846` with `"resolvedTarget":2118` in its raw
JSON -- a genuine observation of the running program's own branch target, not a
name read off the source file. `$0846` = 2118, the SAME address Steps 6-7 already
proved carries no user label and no exported line.

## Step 15 -- `[2026-08-20T23:41:06.131Z]` disassemble the discovered address itself, live

```js
dispatchStock("vice_disassemble", { address: "$0846", count: 3 }, deps)
```

```
!cpu 6510
poll_table_and_dispatch = $082f
border_bump_down = $0850
* = $0846
        jsr border_bump_down
        jmp poll_table_and_dispatch
        inc $d020
```

Real, reachable code sits there: `jsr border_bump_down` then `jmp
poll_table_and_dispatch` -- confirming this is genuinely executed program logic
(reached whenever the dispatch-selector byte hits `$FF`), not dead residue. This
independently resolves the exact ambiguity 11-07's own recon session flagged at
this address ("`[unknown]` ... not yet confirmed whether this path is exercised by
the intended program flow or is dead residue") -- now settled by a live
observation, not by re-reading the source.

## Step 16 -- `[2026-08-20T23:41:06.150Z]` name it, based on the live observation, and write it into the store FIRST

```js
runR2000Tool("r2000_set_label_name", {
  project: "evidence/criterion4/subject.regen2000proj",
  address: 2118,
  name: "selector_ff_handler",
})
```

```json
{"content":[{"text":"Label set at $0846","type":"text"}],"isError":false}
```

## Step 17 -- `[2026-08-20T23:41:06.162Z]` regenerate the WHOLE label file (D-29)

```js
exportLabels({ projectPath, outPath: "evidence/criterion4/regenerated.lbl" })
```

```json
{"path":".../regenerated.lbl","symbolCount":9,"symbols":[
  {"name":"init_screen_and_irq","address":2064},
  {"name":"poll_table_and_dispatch","address":2095},
  {"name":"counter_wrap_reentry","address":2105},
  {"name":"selector_ff_handler","address":2118},
  {"name":"border_bump_up","address":2124},
  {"name":"border_bump_down","address":2128},
  {"name":"raster_sample_isr","address":2132},
  {"name":"dispatch_selector_bytes","address":2140},
  {"name":"routine_vector_table","address":2148}
]}
```

9 symbols -- strictly more than `outbound.lbl`'s 8 -- and includes BOTH the
outbound name and the discovered name.

## Step 18 -- `[2026-08-20T23:41:06.163Z]` `vice_symbols_load(regenerated.lbl)` -- call #2, and the ONLY call on this file

```json
{"path":".../regenerated.lbl","format":"vice","symbolCount":9,"skippedLines":1,"duplicateNames":0,"lineCount":10,"replaced":true,"runState":"unknown"}
```

**`vice_symbols_load` occurrence count in this transcript: 2 total** -- call #1
on `outbound.lbl` (Step 12), call #2 on `regenerated.lbl` (this step). The
regenerated (fully-regenerated, replace-not-merge) file is loaded **exactly
once**, never incrementally, matching D-29.

## Step 19 -- `[2026-08-20T23:41:06.163Z]` both names resolve live, after the reload

```json
{"query":{"name":"counter_wrap_reentry"},"found":true,"symbolCount":9,"name":"counter_wrap_reentry","address":2105,"runState":"unknown"}
```
```json
{"query":{"name":"selector_ff_handler"},"found":true,"symbolCount":9,"name":"selector_ff_handler","address":2118,"runState":"unknown"}
```

## Step 20 -- `[2026-08-20T23:41:06.163Z]`-`[...164Z]` clean shutdown

```
stockDisconnect() -- session closed cleanly
emulator killed (SIGKILL) and scratch XDG_CONFIG_HOME removed
```

Confirmed separately: `pgrep -af x64sc` returned no process after this step.

## Step 21 -- `[2026-08-20T23:41:32Z]` the `--import_lbl` leg, explicitly (R2000-15's own wording)

Pre-import baseline, from the Step 5 snapshot (`subject-copy.regen2000proj`):

```
$ node vice-proxy.ts r2000 export-lbl evidence/criterion4/subject-copy.regen2000proj --out evidence/criterion4/copy-pre-import.lbl
export-lbl: wrote evidence/criterion4/copy-pre-import.lbl (8 symbol(s))
```

8 symbols -- `selector_ff_handler` absent, confirmed by `grep -c
selector_ff_handler copy-pre-import.lbl` returning 0.

## Step 22 -- `[2026-08-20T23:41:25Z]` `vice-mcp r2000 import-lbl` (the real CLI verb)

```
$ node vice-proxy.ts r2000 import-lbl evidence/criterion4/subject-copy.regen2000proj evidence/criterion4/regenerated.lbl
import-lbl: imported 9 name(s): init_screen_and_irq, poll_table_and_dispatch, counter_wrap_reentry, selector_ff_handler, border_bump_up, border_bump_down, raster_sample_isr, dispatch_selector_bytes, routine_vector_table
import-lbl: persisted by an explicit r2000_save_project call over the same --mcp-server-stdio session (D-28) -- verified by re-reading the project from disk in a fresh process, not merely trusted from the child's own success text.
```

Exit code 0 -- disk-verified confirmation printed, per the D-28 path
(`--import_lbl` + `--mcp-server-stdio` + explicit `r2000_save_project`, proven by
a fresh re-export from disk in a brand-new process, never trusted from the
child's own success text alone).

## Step 23 -- `[2026-08-20T23:41:38Z]` fresh `export-lbl` from the imported copy contains the discovered name

```
$ node vice-proxy.ts r2000 export-lbl evidence/criterion4/subject-copy.regen2000proj --out evidence/criterion4/copy-post-import.lbl
export-lbl: wrote evidence/criterion4/copy-post-import.lbl (9 symbol(s))
```

```
al C:0810 .init_screen_and_irq
al C:082f .poll_table_and_dispatch
al C:0839 .counter_wrap_reentry
al C:0846 .selector_ff_handler
al C:084c .border_bump_up
al C:0850 .border_bump_down
al C:0854 .raster_sample_isr
al C:085c .dispatch_selector_bytes
al C:0864 .routine_vector_table
```

`al C:0846 .selector_ff_handler` is present -- the discovered name, imported via
`--import_lbl` into an INDEPENDENT copy of the project, confirmed by a fresh
export from that copy. The canonical loop (Steps 16-19) used
`r2000_set_label_name` directly; this step additionally demonstrates the
`--import_lbl` route R2000-15 names explicitly, on a separate project copy so
neither leg's evidence depends on the other.

---

## Verdict

**What was absent:** a USER label at address 2118 (`$0846`) -- confirmed absent
from the store (Step 6, only the non-exported Auto label present) AND from the
exported `outbound.lbl` (Step 7), both immediately before the live discovery.

**What was discovered live:** the running program's own `beq` in `main_loop`
branches to `$0846` (Step 14, `resolvedTarget: 2118` read directly off the live
disassembler), and that address holds real, reachable code -- `jsr
border_bump_down` / `jmp poll_table_and_dispatch` (Step 15) -- read from the
actual running machine, not asserted from source.

**What is now in the store:** `selector_ff_handler` at address 2118, written via
`r2000_set_label_name` (Step 16), present in the regenerated `.lbl` (Step 17),
loaded into and resolved by the live emulator (Steps 18-19), AND separately
confirmed importable via the `--import_lbl` route into an independent project
copy (Steps 21-23).

**Which fact is witnessed by which step:** absence -> Steps 6-7; live discovery ->
Steps 14-15; store mutation -> Step 16; regenerated-file mutation -> Step 17;
live resolution -> Steps 18-19; the independent `--import_lbl` proof -> Steps
21-23. The ordering across all 23 steps -- absence proven before discovery,
discovery before naming, naming before regeneration, regeneration before the
single reload -- is what makes this one closed loop rather than two independent
one-way dumps.

## Deviation logged during this walkthrough

**[Rule 3 -- blocking issue] Missing `-drive8type 1541` in the initial launch argv.**
The first launch attempt used `-default -binarymonitor -binarymonitoraddress
...` (no drive-type flag) and `vice_autostart` failed outright: `"the command
failed inside the monitor with no further diagnostic ... (binary monitor
returned error code 0x8f for response type 0x00)"`. This is exactly the
documented FINDING-C1 defect (`broker-launch.mts`'s own header comment,
Phase 8.1/8.2): a stock `x64sc` boots with `Drive8Type=0` by default, so
`AUTOSTART` fails for ANY program load, disk or bare `.prg` alike, and no stock
MCP tool can correct it after boot. Fixed by adding `-drive8type 1541`
immediately after `-default` (matching `broker-launch.mts:198`'s own fixed
argv exactly) and re-running the launch from scratch -- the first, failed
attempt's memory reads (which returned all-zero/`brk` bytes, since the program
was never actually loaded) were discarded rather than reported, and are not
part of the numbered transcript above. No files outside this walkthrough's own
scratch script were touched by this fix; the emulator argv construction
(`broker-launch.mts`) was not modified -- this walkthrough's own launch script
was corrected to match its already-fixed pattern.

## Evidence ceiling

**Subject and branch used:** plan 11-07's committed `recon-subject.prg` (102
bytes, hash-verified in Step 1) via the objective's branch (2) -- no consuming
project with a registered real release exists on this host (branch (1) does not
apply, verified directly against `recovery/RELEASES.json`).

**What this walkthrough proves:** the full R2000-14/R2000-15 mechanism, as ONE
closed loop, against a real, genuine, unpatched stock `x64sc` (VICE 3.9) driven
through this project's own real binary-monitor client and dispatch table, and
against a real `regenerator2000 0.9.20` binary -- including the launch-argv
ordering constraint, the absence-before-discovery invariant, the
replace-not-merge `vice_symbols_load` semantics, and the `--import_lbl` D-28
persistence path. It also re-confirms, live, that BACK-02's fork backend is
unregressed by this phase's changes (`BACK-02-GATE.md` §7).

**What this walkthrough does NOT prove:** behaviour on a commercial release's
size, packing or self-modification -- the subject fixture is 102 bytes with no
packing, no self-modifying code, and no copy protection. It also does not extend
regenerator2000-version coverage beyond the single `0.9.20` binary installed on
this host; nothing here bears on any other version's behaviour, matching the
same scoping caveat ROADMAP.md already applies to Phase 9's criterion 3(3)
`pass`.

**What would raise the ceiling:** running this same numbered procedure against a
release registered in a consuming project's `recovery/RELEASES.json` (branch (1)
of the objective's own resolution rule) -- a real commercial release's size,
loader structure and any packing it carries, rather than a purpose-built
fixture.

## T-11-NAME-INJECT residual (noted, not re-covered)

11-08-SUMMARY.md already recorded that a label name is NOT validated on entry via
either `r2000_set_label_name` or `--import_lbl` -- `assertLegalAcmeIdentifier()`
is called only on enum/variant names, never on a label name. Both names this
walkthrough introduced (`counter_wrap_reentry`, `selector_ff_handler`) are
ordinary, well-formed identifiers chosen deliberately to stay inside that gap
rather than probe it -- this walkthrough exercises the mechanism, not the
residual. The gap itself remains open and is not re-covered here, per the plan's
own instruction to note it rather than restate it as covered.
