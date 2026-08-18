# Stock VICE parity: what changes for the tool surface

A two-way gap analysis for the migration from the custom `x64sc -mcpserver` to
stock VICE's binary monitor (see `docs/roadmap-stock-vice.md`). Grounded in the
current tool descriptions (`tools-manifest.json`) and VICE's own source
(`VICE-Team/svn-mirror`: `monitor_binary.c`, `mon_register.c`).

**Net:** ~85–90% of the surface ports cleanly or reimplements client-side. The two
things genuinely **lost** are **SID state read-back** and **low-level/matrix
keyboard**; the two things genuinely **gained** are **CPU-history tracing** and
**1541 drive-CPU debugging**.

## A. What can't be replicated exactly (losses)

Ranked by impact. (On-demand pause was retired from this list on 2026-08-12:
`monitor_startup_trap()` fires on any inbound byte, so `vice_execution_pause`
is not degraded on stock — see `docs/phase0-binmon-findings.md` §4. The list
below is renumbered to stay contiguous.)

1. **SID state read-back — `vice_sid_get_state` (voices, filter) → hard loss.**
   SID registers `$D400–$D418` are **write-only in hardware**, so a memory read
   won't return what was written. The current server reads VICE's *internal* SID
   struct; the binary monitor has no SID command and can't read write-only
   registers. Current voice frequency/waveform/ADSR/filter/volume are
   **unrecoverable** from memory (only `$D419–$D41C` — paddles, OSC3, ENV3 — are
   readable). `set` still works. Partial mitigation: the client can *shadow* the
   writes it issues, but never the writes the running program makes.

2. **Low-level keyboard — `matrix`, `chord`, `key_press/release`, `restore` → loss.**
   `KEYBOARD_FEED` (0x72) only injects PETSCII **text into the buffer**. It cannot
   hold keys down, drive the raw matrix (games that scan the keyboard directly),
   press chords for N frames, or pulse the RESTORE/**NMI** line. `type`/`petscii`
   survive. Fragile workaround: poke CIA matrix registers / the KERNAL buffer via
   `MEM_SET` — not equivalent for matrix-scanning games.

3. **`vice_run_until` "for N cycles" → approximate, and now bounded on stock
   (Phase 7, TIME-02).**
   Run-until-*address* is exact (checkpoint) on both backends. Halting after
   *exactly* N cycles is still not native — the `cycles` argument is refused in
   the fork's own words on both backends, unchanged. What Phase 7 adds is a
   **stock-only optional `timeout_ms`** (default 30000, clamped to a ceiling of
   600000) bounding the wait for an *address* to be reached: an unreachable
   address returns an explicit `timedOut: true` answer, with the temporary
   stopping checkpoint cleaned up (`CHECKPOINT_DELETE`, tolerating `ObjectMissing`
   as an already-gone race), rather than hanging indefinitely. The fork has no
   equivalent — a `vice_run_until` targeting an address that never executes is
   unbounded there, and looks exactly like a wedge (see
   `vice-wedge-triage/SKILL.md`). Live-confirmed against both genuine unpatched
   stock VICE 3.9 and VICE 3.10: a real KERNAL address ($EA31) reached within its
   timeout, and an unreached one ($C000) timing out with the checkpoint deleted.

4. **`vice_cycles_stopwatch` → dual-route, refuses rather than approximates
   across a frame boundary (Phase 7, TIME-01/TIME-03).**
   Route A (`CPUHISTORY_GET`'s monotonic uint64 cycle field, **VICE >= 3.10**)
   is exact for any bracket length. Below 3.10, Route B reconstructs the
   within-frame position from `LIN`/`CYC` (`REGISTERS_GET`) against the
   resolved `MachineVideoStandard` (all four standards' cycles-per-line/
   lines-per-frame constants); this route is exact **only when no frame
   boundary is crossed between reset and read** — the position is labelled
   `exactness: "within-one-frame-unverified"` with an explicit `caveat`, and the
   moment a wraparound is *proven* (the within-frame position goes backwards),
   the answer **refuses by name** — `measurable: false` with a reason, carrying
   no `cycles` key at all, never a fabricated number and never `0`. The
   previously-proposed alternative fallback — a frame-counter
   reconstruction (a non-stopping exec checkpoint plus `frames * cyclesPerFrame
   + Δ(LIN*cyclesPerLine+CYC)`), once described as a second route always ready
   regardless of build — was **rejected outright**, not shipped: that
   checkpoint fires far above this client's own trace-hazard guard
   (`TRACE_HITS_PER_SECOND_LIMIT = 20` in `stock-checkpoints.ts`), which would
   auto-disable it — see the SUPERSEDED note in `docs/phase0-binmon-findings.md`
   §1. There is no hardware stopwatch reset on either route, so "atomic
   reset_and_read" is client-side baseline math regardless of route. Live-
   confirmed on genuine stock VICE 3.9 (Route B, including a live wraparound
   refusal) and VICE 3.10 (Route B measurable within one frame; Route A's
   wire-layout mismatch recorded here as unresolved was root-caused and fixed
   by **07-12** and live-proven by **07-13** against `/usr/local/bin/x64sc`
   (VICE 3.10.0.0) — see the `probeCpuHistory()` correction below and
   `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md`'s
   resolution note for "Route A live decode mismatch").

5. **`vice_vicii_get_state` ("internal") / `vice_cia_get_state` (timers) → partial loss, and a stock GAIN in the same breath (Phase 5, DERIV-05).**
   Phase 5 shipped both tools reading their chip's memory-mapped register block
   with **one `sidefx: false` `MEM_GET`** (VIC-II `$D000-$D02E`, 47 bytes; CIA1
   `$DC00-$DC0F` / CIA2 `$DD00-$DD0F`, 16 bytes each); every readable field is
   decoded and named. Truly *internal* state (raster-IRQ latch, timer **latch**
   vs. current count, internal flip-flops) isn't in the register map and can't be
   read — reported as `{ available: false, reason }`, six fields on VIC-II
   (`rasterIrqLine`, `videoCounter`, `rowCounter`, `badLineCondition`,
   `borderFlipFlops`, `spriteDmaState`) and five on CIA (`timerALatch`,
   `timerBLatch`, `interruptEnableMask`, `todAlarmTime`, `todLatchState`) —
   **never as `0` and never as an absent key**, pinned in the stock manifest with
   `enum: [false]` so the answer-conformance harness enforces it, never only a
   hand-written decoder test. `$D018`'s pointers are reported bank-relative;
   `vice_sprite_get` resolves the absolute `screenBase`/`dataAddress` form
   (DERIV-06).

   **Which memory view the answer read, and why it matters.** The chip-state and
   sprite tools resolve their bank from the emulator's own `BANKS_AVAILABLE`
   enumeration: the **`io`** bank for `$D000-$D02E`, `$DC00-$DC0F` and
   `$DD00-$DD0F`, and the **`ram`** bank for the sprite pointer table and the
   63-byte sprite data block — the view the VIC-II chip itself fetches, since the
   chip never sees I/O or cartridge ROM. Every answer names the view it read:
   `vice_vicii_get_state` and `vice_cia_get_state` report `bank: { id, name: "io"
   }`; `vice_sprite_get` and `vice_sprite_inspect` report `registerBank` and
   `dataBank`. The stock manifest pins those names with `enum`, so the
   answer-conformance harness enforces them rather than only a hand-written test.
   A build whose catalog reports no `io` (or no `ram`) bank gets an explicit
   **refusal** naming the banks it did report — never a guess, and never a
   fallback to the CPU view. Dated hazard record (**2026-08-17**): before this,
   all four tools read wire bank `0x0000` — the **CPU view**, which follows
   `$00`/`$01` banking. With I/O banked out (`$01 = $34`/`$35`, routine in
   loaders, depackers and IRQ handlers) they returned the RAM underneath the I/O
   area as fully-"available" register values with an empty `unavailable` set:
   plausible, wrong, and worse than the `0` the criterion was written to forbid.
   The `{available:false, reason}` mechanism could not catch it because the
   defect arrived through the address/bank argument, not the field registry; the
   regression is now pinned by a live case in `stock-live.test.ts` that sets
   `$01 = $34`. One further note for the sprite half: an address resolved into
   `$D000-$DFFF` while VIC bank 3 is selected now carries an explicit
   **I/O window** note, alongside the pre-existing char-ROM-window note for
   banks 0 and 2.

   **The DERIV-05 stock GAIN.** `sidefx: false` is hardcoded with no argument
   able to override it — **VERIFIED**, asserted on the wire body by a regression
   test for both chips. Whether stock VICE's `MEM_GET` read path actually honours
   `side_effects = 0` for `$D01E`/`$D01F`/`$DC0D`/`$DD0D` — i.e. that the
   emulator's own read path does not clear those registers — is **ASSUMED**, with
   no probe recorded in this repo. The fork's own chip-state read path is, per
   this project's own skill docs
   (`c64-program-recon/references/observation-hazards.md`: "Whether the VICE
   monitor's own read path is side-effect-free is **unverified**: treat it as
   verify-don't-assume rather than taking it on faith"), likewise unverified —
   so the stock side is no worse, and is now explicit about which part is
   proven and which is assumed. Reading `$D01E`/`$D01F`/`$DC0D`/`$DD0D` through
   the stock tools is therefore, on current evidence, no more likely to steal a
   collision flag or an unserviced interrupt than the fork's own path — record
   it as a gain, not only a partial loss.

6. **Reproducible but not byte-identical (reimplementation, not lost capability):**
   `vice_disassemble` (ship a client 6502 disassembler; formatting/illegal opcodes
   won't match VICE's exactly — see item 7's D-09/D-13/D-12/D-14 bullets below for
   the specific, enumerated divergences Phase 4 landed) · `vice_display_screenshot`
   (INDEXED8 framebuffer + `PALETTE_GET` → encode PNG client-side — **CUT from
   scope 2026-08-17** as `SHOT-01`..`SHOT-05`; no skill calls it, see
   ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)") · `vice_disk_read_sector`
   (parse the `.d64` file, not the live drive — **CUT from scope 2026-08-17**;
   no skill calls it, see ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)") ·
   `vice_snapshot_save` metadata/`mcp_snapshots/`
   (DUMP writes state; JSON metadata + list is client bookkeeping).
   `vice_checkpoint_set_ignore_count` is **not** in this reproducible list —
   see item 7 (D-15): there is no native ignore count on the wire, and the
   only implementation would require the client to resume the machine on
   each ignored hit, a carve-out in D-05's absolute no-unrequested-resume
   policy that this milestone does not take. The tool is **trimmed** from the
   stock manifest, not reimplemented. DIRECT-03 is therefore met **except**
   for ignore counts, and BACK-05 reports the absence in Phase 8. Note that
   `CHECKPOINT_INFO`'s reply *does* carry a read-only `ignoreCount` field, so
   listing a checkpoint still reports whatever ignore count exists — only
   *setting* one is unavailable.

7. **Expected divergences licensed by design (Phase 3 — D-01, D-03, D-05, D-14)**
   - **Every stock answer is stock-native (D-01).** A tool present on both
     backends does not reproduce the fork's JSON answer shape. The fork
     manifest carries no `outputSchema` on any tool, so there is no
     documented fork shape to reproduce; the stock manifest declares an
     `outputSchema` on every entry (D-02) and that schema is the contract. A
     skill that parses fork answer *fields* breaks on stock — SKILL-01
     (Phase 8) must cover answer-shape drift, not only capability gaps.
   - **Every stock answer carries a `runState` field (D-06).** Values
     `running`, `stopped`, `unknown`, derived only from the
     `STOPPED`/`RESUMED`/`JAM` event stream. `unknown` is the honest
     post-connect value and is not a failure.
   - **Reading memory halts the machine, and the answer says so (D-05).** On
     stock, `monitor_startup_trap()` fires on any inbound byte, so *every*
     command halts the emulated machine and resume is a separate explicit
     `EXIT`. The client never issues an `EXIT` the agent did not ask for.
     **This is the single biggest behavioural divergence in the milestone.**
     Name `c64-ram-capture` and `c64-program-recon` explicitly as the two
     skills whose documented methodology reads memory mid-run and assumes
     the machine keeps running — SKILL-01 (Phase 8) owns the playbook
     revision; it is not Phase 3 work.
   - **`vice_machine_reset`'s `run_after` default flips from `true` to
     `false` (D-03/D-05).** `RESET` (0xcc) has no run-after field on the
     wire, so honouring `run_after: true` means the client sends a follow-up
     `EXIT` — fine when the agent asked for it, but a *default* of true would
     resume a machine nobody asked to resume. Explicit `run_after: true` is
     honoured; the omitted default is `false` on stock.
   - **`vice_memory_read`'s `encoding` default is `hex` on stock.** Both
     documented values (`array`, `hex`) are accepted so the fork's call still
     works; only the omitted default differs.
   - **`vice_keyboard_type` / `vice_keyboard_petscii` inject into the
     keyboard buffer of a machine that is now halted.** Nothing consumes the
     buffer until the agent resumes. The answer's `runState` reports
     `stopped`; this is D-05's divergence applied to input, not a failure.
   - **`vice_joystick_tap` is absent from the stock manifest** and is
     deferred to Phase 7. A tap is "hold for N frames, then release", which
     requires the machine to *run* for a measured interval — an unrequested
     resume (D-05) plus a cycle/frame measurement that does not exist on
     stock until Phase 7's timing route lands. `vice_joystick_set` (hold /
     release / centre) ships in Phase 3 and satisfies DIRECT-07's joystick
     half. BACK-05 reports the absence in Phase 8. Record this as the same
     class of decision as D-15's ignore-count trim, reached by the same
     reasoning.
   - **`vice_disk_detach` is absent from the stock manifest** and ships in
     Phase 7 through the text monitor (D-13). Phase 3 ships only the
     `-remotemonitor` launch flag and a second broker-allocated port; it
     builds no text client and dials nothing on that port.
   - **`vice_memory_compare`'s `mode: 'snapshot'` is refused by name (D-05-01,
     Phase 5).** No memory-only snapshot producer exists on either backend;
     `vice_snapshot_save` writes a whole-machine `.vsf`. The alternatives were
     a destructive restore or an unverified `.vsf` parse. `snapshot_name`/
     `start`/`end` remain **declared** in the stock `inputSchema` for D-03
     argument compatibility — the trim is a runtime refusal named in the
     description, not a missing argument. Exact refusal text: "`vice_memory_compare:
     mode:'snapshot' is not implemented on the stock backend -- there is no
     memory-only snapshot producer tool on either backend (vice_snapshot_save
     writes a whole-machine .vsf), so serving it would mean either
     destructively restoring the machine to read memory out of it, or parsing
     an unverified binary snapshot format. Use mode:'ranges' to compare two
     live ranges captured at different points in time, or use the
     c64-ram-capture skill's own full-image diff.`"
   - **`vice_symbols_load`'s `format: 'kickasm'` and `format: 'simple'` are
     refused by name (D-05-02, Phase 5).** No in-repo producer emits either.
     `'auto'` and `'vice'` parse the confirmed `al C:xxxx .Name` VICE
     label-file syntax; a 0-symbol load is an explained success, not an
     error. `regenerator2000`'s `--export_lbl` is **assumed** to emit the same
     syntax, unverified pending `R2000-16(c)`, and the parser skips
     unrecognised lines rather than refusing the file because of it.
   - **`vice_sprite_inspect`'s `format: 'png_base64'` is omitted from the
     stock enum and refused by name (D-05-03, Phase 5).** Same "no skill
     calls it" reasoning that cut `SHOT-01`..`SHOT-05` from this milestone.
     The `format` property stays declared with `type: "string"`; only the
     enum and description narrow. Also, per D-05-04, the ASCII grid renders
     at native resolution per mode (24x21 hi-res, 12x21 multicolour) and is
     **not** scaled by the `$D017`/`$D01D` expansion bits.
   - **Criterion 5's exception count is three, not two (D-05-08, Phase 5).**
     `vice_keyboard_restore` is a third skill-called tool that is confirmed
     unrecoverable on stock — it is in the same hard-loss family as `matrix`
     and `chord` (item 2 above), and
     `c64-program-recon/references/control-flow.md` calls it. The ROADMAP's
     Phase 5 criterion 5 names only two confirmed-unrecoverable tools
     (`vice_sid_get_state`, `vice_keyboard_matrix`); the extraction behind
     `scripts/check-skill-tool-coverage.mjs` finds a third. It routes to
     Phase 8 exactly like the other two (`BACK-05` for the runtime error,
     `SKILL-01` for the playbook note). The ROADMAP's criterion text is
     **not** amended by this correction — that is a developer decision,
     flagged here for Phase 8 planning.
   - **Also absent from the stock manifest, permanently or until a later
     phase:** `vice_checkpoint_set_ignore_count` (D-15), `vice_snapshot_list`
     (D-16, deleted from **both** manifests), the low-level keyboard family
     (`key_press`/`key_release`/`restore`/`matrix`/`chord` — hard loss, item
     2), `vice_sid_get_state` (hard loss, item 1), `vice_disk_read_sector`
     (**CUT from scope 2026-08-17** — no skill calls it; see ROADMAP.md "Cut
     from scope (v0.2.0, 2026-08-17)"), `vice_machine_config_get`/`set`
     (**CUT from scope 2026-08-17** along with the whole of Phase 6; see
     ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)").
   - **Two stock-only tool names with no fork counterpart:**
     `vice_execution_until_return` (`EXECUTE_UNTIL_RETURN` 0x73) and
     `vice_registers_available` (`REGISTERS_AVAILABLE` 0x83). Permitted by
     Phase 2's D-07 (the two backends' advertised lists are genuinely
     different). Phase 8's parity harness must expect these on stock only.
   - **Disk attach is `AUTOSTART` with the run flag clear (D-14).**
     `vice_disk_attach` on stock is `AUTOSTART` (0xdd) with the run flag
     clear — a documented approximation, not an exact port. `AUTOSTART` has
     **no drive-unit field at all**, so the fork's required `unit` argument
     (8-11) can only be honoured for unit 8. Units 9-11 are **refused with an
     explanation naming this exact protocol limit** — never a silent no-op
     and never a silent retarget to unit 8. Likewise `vice_autostart`'s
     optional `program` argument (load-by-name from a disk image) has no
     wire equivalent — `AUTOSTART` supports only a numeric `fileIndex` — and
     is refused when supplied rather than silently dropped.
   - **`vice_disassemble`'s illegal-opcode rendering (Phase 4 D-09).** Every
     opcode ACME's `!cpu 6510` cannot express renders as `!byte` with all its
     bytes and the decoded mnemonic in a trailing comment, so the following
     instruction still lands at the correct address and the output
     reassembles byte-exactly with zero exclusions. The exact opcode set the
     installed ACME 0.97 ("Zem") rejected, copied verbatim from
     04-06-SUMMARY.md (35 opcodes): `$12, $1A, $22, $2B, $32, $34, $3A, $3C,
     $42, $44, $52, $54, $5A, $5C, $62, $64, $72, $74, $7A, $7C, $82, $89,
     $92, $B2, $C2, $D2, $D4, $DA, $DC, $E2, $EB, $F2, $F4, $FA, $FC`. This
     set is determined by an assertion test against a real ACME
     (`disasm-roundtrip.test.ts` Suite C), not by a static list, so it may
     shrink as ACME gains mnemonics — re-run that suite against a newer ACME
     before trusting this list as current. Also note the D-11 forced-16-bit
     form (`lda+2 $0080`) that appears wherever an absolute-family operand is
     below `$0100`, which the fork does not emit.
   - **`vice_disassemble`'s answer shape (Phase 4 D-13).** The stock answer
     carries `instructions[]` (address, bytes, mnemonic, operand,
     resolvedTarget, notes) **and** a rendered `listing` string, plus
     `symbolsApplied`, `limitReached`/`nextAddress` and the standard
     `runState` tail — under a declared `outputSchema`. The fork's entry has
     no `outputSchema` at all, so there is no fork shape to reproduce. The
     answer is bounded at 100 instructions.
   - **`vice_disassemble`'s optional `end` argument (Phase 4 D-12).** A
     stock-only optional extra permitted by Phase 3 D-03; the fork's
     `address`/`count`/`show_symbols` are unchanged in name, type and
     default. Supplying both `end` and `count` is **mutually exclusive** and
     **refused**, never silently resolved in favour of one. Note the
     over-read-by-two rule (the handler reads two bytes past `end` so the
     last instruction can be fully decoded) and that instructions starting
     past `end` are dropped rather than returned.
   - **`vice_disassemble`'s `show_symbols` with no symbol store (Phase 4
     D-14).** On stock this is
     a successful no-op that says so on the answer (`symbolsApplied: false`
     plus an explanatory note), matching `parseAddress()`'s existing "no
     symbol table is loaded" wording — never an error. Phase 5's DERIV-04
     installs the real store and nothing about the disassembler changes.
   - **`vice_memory_search`/`vice_memory_compare` take a stock-only optional
     `bank` argument, and both answers name the view they read (WR-06, Phase
     5).** Another stock-only optional extra permitted by D-03, resolved
     through the same `resolveBank()` seam `vice_memory_read`'s `bank` uses;
     the fork's required arguments are unchanged. Omitting it keeps the
     previous behaviour — wire bank 0, the CPU view — which is a defensible
     default for a general search, unlike a chip-state read, where the CPU
     view is forbidden and an absent `io` bank is a refusal (CR-01). What
     changed is that the default is no longer invisible: every answer carries
     `bank` (`{id,name}` when a name was resolved, the bare wire id
     otherwise) plus a plain-language `bankView` saying which view produced
     the bytes, because a search across `$D000-$DFFF` returns register bytes
     or the RAM underneath depending on the halted program's `$01` and the
     answer used to look identical either way. `vice_memory_compare` applies
     the one `bank` to **both** ranges: it compares two ranges in one halted
     machine, so two views would be two different questions.
   - **`vice_diagnose`'s verdict set differs by one, deliberately (Phase 7,
     D-03).** Stock answers five verdicts (`restarted`, `checkpoint_trap`,
     `wedged`, `monitor_held_elsewhere`, `live`); `stale_read_path` is absent.
     On the fork, that verdict describes a state where one read path is stale
     while another advances, which requires the fork's non-pausing `vice_ping`
     alongside pausing reads. On stock every read pauses the machine
     uniformly, so the stale-versus-fresh distinction is **unreachable by
     construction**, not merely unimplemented. Stock also gains a verdict the
     fork has no name for — `monitor_held_elsewhere` — because stock VICE's
     binary monitor services exactly one client: a second `connect()` sits
     unserviced in the backlog with no reply and no EOF, and the instance is
     healthy, just claimed elsewhere. It is **never** a reason to recycle.
   - **`vice_recycle`'s stock incident record carries no screenshot (Phase 7,
     D-01).** Stock has no screenshot tool and `SHOT-*` is out of this
     milestone's scope, so the stock record carries four evidence items
     (a liveness bracket, registers, armed checkpoints, the resolved IRQ
     handler) instead of the fork's six. The record is still written **before**
     the destructive recycle RPC on both backends — that record-before-RPC
     ordering is not a divergence, and is itself proven live by a test that
     observes the incidents directory from inside the RPC stub at call time.
   - **A stock correctness history worth reading in order, not smoothed over
     (Phase 7, `probeCpuHistory()`, CR-01).** The stock connect handshake's
     `CPUHISTORY_GET` capability probe originally sent `count=0`, which real
     VICE rejects with `InvalidParameter` (`0x81`) — `monitor_binary.c`
     requires `requested_count >= 1`. 07-01 fixed that by probing with
     `count=1` (the minimum VICE accepts). That fix exposed a worse failure
     on any build that actually *supports* the opcode: the real
     `CPUHISTORY_GET` reply could not be decoded by this client's parser, the
     resulting `StockFramingError` was not classified as a capability answer,
     and it propagated out of `resolveCapabilities()` as a fatal error — so
     the **entire stock handshake failed on any genuine VICE >= 3.10**
     (finding CR-01, live-reproduced independently twice: once in
     `07-REVIEW.md`, once in `07-VERIFICATION.md` against a freshly-launched,
     unmodified `/usr/local/bin/x64sc`). A previous version of this paragraph
     claimed the opposite of that finding — that the capability "now actually
     resolves to `available` ... live-confirmed against the fork's own
     genuine VICE 3.10.0.0 build" — and that claim was **wrong**: at the time
     it was written, the connect failed before any capability value existed.
     Two fixes closed CR-01. **07-11** made a `CPUHISTORY_GET` decode failure
     (`StockFramingError`, `StockDesyncError`, `StockResponseMismatchError`)
     answer a capability value (`"absent"`) instead of rethrowing, and
     guarded `resolveCapabilities()`'s probe call site so no uninterpreted
     error can reach `stockConnect()`'s fatal catch — only real
     transport/instance failures (`StockConnectionClosedError`,
     `StockRequestTimeoutError`, `MachineRestartedError`) still reject the
     handshake. **07-12** re-derived the real per-entry wire layout from
     `monitor_binary_process_cpuhistory()` (`monitor_binary.c`) against three
     committed real captures from genuine VICE 3.10 and 3.9 binaries: after
     the 4-byte `count(u32LE)`, each entry is a 1-byte `item_size` (the byte
     count of everything below it in that entry), a `regCount(u16LE)` plus
     that many 4-byte register items, an 8-byte `cycle(u64LE)`, a 1-byte
     `instruction_length`, and that many instruction data bytes.
     `instruction_length` is a **hardcoded constant 4 in VICE**
     (`monitor_binary.c:1468`) — it is not a decoded instruction size. 07-12
     also corrected a second, previously never-live-verified claim: the real
     multi-entry capture decodes to strictly ascending cycle values, so
     `entries[0]` is the **OLDEST** of the returned window, not the newest as
     this document previously claimed — functionally inert for Route A's
     shipped behaviour, which always requests `count:1`. It further
     established that genuine VICE 3.9 answers the unrecognized
     `CPUHISTORY_GET` opcode with `INVALID_TYPE` (`0x83`), not `CMD_FAILURE`
     (`0x8f`) — the opcode itself, not merely the history feature, is
     unrecognized on 3.9. **07-13's live status**, verbatim, against
     freshly-launched, genuine, unmodified binaries: `stockConnect()`
     resolves against `/usr/bin/x64sc` (VICE 3.9.0.0) with
     `cpuHistory: "absent"`, and against `/usr/local/bin/x64sc` (VICE
     3.10.0.0) with `cpuHistory: "available"` — the exact inversion of the
     CR-01 failure. A real ~500ms Route A bracket on the VICE 3.10.0.0 build,
     dispatched through the real `dispatchStock()` seam, measured **511,061**
     exact cycles on one run and **530,713** on another — both
     `route: "cpu_history"`, `exactness: "exact"`, both inside the documented
     sanity band. So the capability now genuinely resolves to `"available"`
     where the build supports it, live-confirmed against
     `/usr/local/bin/x64sc` (VICE 3.10.0.0) by **07-13** — not, as this
     paragraph previously and falsely claimed, by the original 07-01 fix
     alone.
   - **`vice_diagnose`'s `diagnosis_unavailable` outcome (Phase 7, 07-15).**
     Every non-verdict failure of `vice_diagnose` — a CR-01-class decode
     error, a lost connection, a request timeout, a session-acquisition
     timeout/refusal, or a failure gathering evidence — now answers a
     classified, greppable `isError:true` outcome whose text begins
     `vice_diagnose: diagnosis_unavailable (<reason>)`, naming one of seven
     reason classes: `protocol_decode_failure`, `connection_lost`,
     `request_timeout`, `monitor_acquisition_timeout`, `session_refused`,
     `evidence_gathering_failed`, `unknown`. This is **not** a sixth verdict
     — D-03's verdict set stays exactly the five named above (`restarted`,
     `checkpoint_trap`, `wedged`, `monitor_held_elsewhere`, `live`), and
     `diagnosis_unavailable` never appears in the manifest's `verdict` enum.
     It means the emulated machine's state is UNKNOWN, and it is never on its
     own grounds to `vice_recycle` — the message says so explicitly.
   - **`vice_run_until`'s honest race resolution and halted-machine reporting
     (Phase 7, 07-14).** A timed-out call whose cleanup delete lands on an
     already-gone race (`cleanup: "already_gone"`) no longer asserts
     `reached: false` outright (WR-01) — it reads the program counter and
     reports `reached: true`/`false` if that resolves the race, or omits
     `reached` entirely and reports `reachedUnknown: true` if the PC read
     itself fails. Every non-error answer, hit or timeout, now carries
     `machineHalted: true` plus a `machineHaltedNote` naming
     `vice_execution_run` as the resume call (WR-02) — so `reached` is no
     longer unconditionally present on stock, and an absent `reached` is not
     "false".
   - **The advertised stock schema now reaches `tools/list` (Phase 7, WR-07,
     07-16).** `vice-proxy.ts` previously overwrote `vice_diagnose`'s and
     `vice_recycle`'s manifest entries with the fork's own synthetic tool
     definitions unconditionally, so an agent reading the schema `tools/list`
     serves on stock saw the fork's verdict vocabulary — including
     `stale_read_path`, a verdict stock cannot produce — and was missing
     `monitor_held_elsewhere`, one it can. `resolveAdvertisedToolDefinition()`
     now selects the stock manifest's own corrected entry per backend, so the
     schema an agent reads on stock matches what the handler actually emits.

## B. Extra stock features worth exposing (things stock does *more*)

Present in the binary monitor, absent from today's tool surface — genuine upside.

1. **CPU instruction-history trace (`CPUHISTORY_GET` 0x86)** — a ring buffer of the
   last N executed instructions *with registers and cycle timestamps*, still a
   future gain for the tracing feature set itself: reconstructing what ran
   before a hang/IRQ, timing analysis, and trace-through are **not built** —
   the tracing tool set cut from Phase 6's scope (`GAIN-*`) remains unbuilt.
   What Phase 7 *does* consume is this opcode's monotonic cycle field, as
   Route A of `vice_cycles_stopwatch`'s dual-route stopwatch (§A.4) — so this
   capability is no longer purely theoretical, it has one real consumer. It
   requires **VICE >= 3.10**: Debian and all current Ubuntu ship 3.9 and lack
   the opcode entirely, returning `INVALID_TYPE` (`0x83`); a >= 3.10 build with
   the feature genuinely disabled returns `CMD_FAILURE` (`0x8f`). Detect via
   `VICE_INFO` (0x85)'s version quad, never the SVN revision field. This
   capability is unavailable on the most common `apt install vice` path.
2. **1541 drive-CPU debugging** — the monitor addresses drive CPUs (8–11) as
   separate *memspaces*: checkpoints, registers, and memory on the drive's own
   6502. Gold for fastloader / copy-protection / disk-routine RE. Current tooling
   is main-CPU only.
3. **Full resource get/set (`RESOURCE_GET/SET` 0x51/0x52)** — `machine_config` today
   is a whitelisted subset; the monitor reaches **every** VICE resource (drive
   true-emulation, all video/SID/filter knobs, joystick mapping, …).
4. **Raster/cycle-precise checkpoint conditions** — conditions can reference the
   pseudo-registers `RL` (raster line) and `CY` (cycle within line), uppercase
   only — **not** the `REGISTERS_GET` names `LIN`/`CYC`, which lex as `BANKNAME`
   in `COND_MODE` and fail with `0x8f` and no diagnostic (`mon_lex.l:559-560`).
   No operator precedence (`mon_parse.y:168`), so every comparison must be
   parenthesised; bare integer literals are hex by default (`monitor.c:1597`),
   so `RL == 100` means line 256. Named tokens let you break at an exact raster
   position (demo/raster-effect RE).
5. **`PALETTE_GET` (0x91)** — the exact emulator palette, for faithful color
   reproduction/analysis.
6. **`USERPORT_SET` (0xb2)** — inject userport state, beyond joystick.
7. **`VICE_INFO` (0x85)** — detect build/version so the client degrades gracefully
   (e.g., auto-detect CPU-history support).
8. **No-side-effect memory reads** — `MEM_GET` can read I/O without triggering side
   effects; cleaner introspection than a naive peek.

## C. What the VICE MCP does *more than raw stock* (the value-add to port)

The MCP's worth isn't new emulator power — it's **ergonomics layered on
primitives**: decoded chip/sprite state, disassembly + symbol resolution, sprite
ASCII rendering, memory search/compare/fill, named checkpoint groups, backtrace,
ready-to-use PNG screenshots, snapshot metadata — plus the broker/multi-instance
management and the MCP protocol surface Claude talks to. Stock gives the
primitives; the MCP gives the convenience. Going stock means porting all of this
into a client, and accepting the A-list losses (chiefly SID read-back and
low-level keyboard).
