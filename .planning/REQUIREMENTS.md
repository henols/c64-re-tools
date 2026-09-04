# Requirements: c64-re-tools — v0.8.0 Frame-Exact Capture and the Two Engines

**Defined:** 2026-09-02
**Core Value:** A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program — read and write memory, set checkpoints, capture RAM, inspect chip state — and keep
working when the emulator misbehaves.

## How to read this file

Requirements fall into two classes, and the distinction is load-bearing:

- **New ids** (`REPRO-*`, `CAP-*`, `GATE-01`, `SEAM-*`, `IMP-*`) are written here for the first
  time. None of them is covered by any carried text, and all of `REPRO-*`, `CAP-*` and `SEAM-*`
  are gates on later phases.
- **Carried ids** (`DXA-*`, `GHID-*`, `OPC-*`, `AUTO-*`, `PROOF-*`) come from v0.6.0's **held**
  Phases 24 and 26. `PROJECT.md` said they would carry forward **byte-identical**. **That is no
  longer honest for eleven of them**, and each amendment below states what changed and on what
  evidence. The original text is recoverable verbatim with
  `git show 2421f68:.planning/REQUIREMENTS.md`. Phase numbers 24 and 26 stay retired; this
  milestone's phases start at **33**.

Every claim marked MEASURED below was produced on this host on 2026-09-02 against genuine stock
VICE 3.9 (`/usr/bin/x64sc`), real ACME 0.97, real `da65 V2.18`, real dxa 0.1.5 or real Ghidra
12.1.3, with its evidence cited in `.planning/research/`. This project treats an unmeasured claim
presented as measured as a defect class, so provenance is stated rather than implied.

### Two decisions taken at the open that shape this text

1. **The text monitor's `stopwatch` is excluded by name** (owner, 2026-09-02). No requirement here
   names `stopwatch`, a constructed monotonic cycle counter, or event record/replay. The stop is
   the **reset protocol**; the stop-identity oracle is the triple `(PC, hit_count, (LIN, CYC))`
   from `REGISTERS_GET` (0x31) + `CHECKPOINT_INFO` (0x11); absolute cycle is an **optional
   VICE >= 3.10 strengthening** via `CPUHISTORY_GET` (0x86)'s uint64 clock field, never a
   requirement. Rationale: `LIN`/`CYC` are returned by `REGISTERS_GET` (`docs/phase0-binmon-findings.md`
   §1), absolute cycle has **no route at all** on the 3.9 floor, and phase 0's Route B
   reconstruction is deliberately not revived — an incidental measurement put it at 19,657
   cycles/frame against phase 0's documented 19,656, a 1-cycle-per-frame accumulating error.
2. **`memmapshow` is stated as ABSENT, and three requirements are narrowed rather than left
   naming an oracle this milestone will not have** (owner, 2026-09-02). It was the specified
   external check for `GHID-04`'s dispatch denominator, the dxa ground-truth partition behind
   `PROOF-01`, and `AUTO-04`'s bank-state validation. It is excluded twice over — the
   runtime-evidence layer is out of scope, and it lives on the excluded text channel. The cost is
   named rather than absorbed: **`PROOF-01` has no independent external check**, which is the same
   weakness that let the pivot's unreproducible `72.46%` / `0 FP` headline stand. Reversal
   condition: a binary-monitor-reachable execution oracle, or a decision to open the text channel.

## v0.8.0 Requirements

### Reproducible Runs

- [x] **REPRO-01**: Launch nondeterminism is pinned on the stock branch — `-seed` plus the three
      `raminit*` flags (`-raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0`) —
      emitted after `-default`, with the fork branch's argv left **byte-identical**. MEASURED: stock
      prints a `time()`-derived seed that differs every launch; over an untouched `$C000-$CFEF`
      window three cold boots differed at **67 of 4080 bytes**, and at **0** with `-seed 4242`; the
      `raminit*` flags took three differing 64K images to **one identical sha256**. Worth ~1,000
      false-divergence addresses per capture pair, which is the dominant term in the divergence this
      milestone exists to remove
- [x] **REPRO-02**: The reproducible-run protocol is one **named single-seam procedure** with the
      monitor-issued hard reset inside it, reached through an optional argument on `vice_run_until`
      rather than as a second route a caller can forget. MEASURED: under *connect → set checkpoint
      while halted → `reset 1` → resume*, three runs with deliberate pre-protocol jitter of 0 / 1500
      / 4000 ms stopped byte-identically, while their pre-reset state spanned 6.7M cycles
- [x] **REPRO-03**: Two stops are certified identical by the triple **`(PC, hit_count, (LIN, CYC))`**
      and by nothing else, with a **frame-anchor checkpoint** on a once-per-frame site set alongside
      the target so `hit_count` supplies the frame term. A control asserts that `(LIN, CYC)` alone
      **passes** on two stops exactly one frame apart, so the anchor's necessity is observed rather
      than argued. MEASURED: `(LIN, CYC)` is a position *modulo the frame* — the `danish` pair
      landed on `hit_count` 1 and 2 with identical raster position and 201 divergences, `saeger` on
      1 and 1 with one
- [x] **REPRO-04**: Every capture carries a record whose reproducibility key is
      **`(binary sha256, argv digest, seed)`** — not the seed alone. MEASURED: the same seed with a
      reordered argv yielded a 76-byte-different image
- [x] **REPRO-05**: Warp and headless are **additive** launch knobs a run can request, not a
      whole-argv override, with `-default` still at index 0 ahead of `-binarymonitor` and the
      real-time timeouts in `probeReady` re-checked under warp. Warp is launch-time on stock:
      MEASURED behaviour-neutral under the reset protocol (1st and 10th hits byte-identical
      including cycle counts), but runtime toggling is on the excluded text channel. Promotes
      `todos/pending/2026-08-26-run-vice-headless-and-in-warp-mode-when-the-run-allows-it.md`,
      including the acquire-frame and warm-instance-eligibility half — a pre-warmed interactive
      instance cannot be retro-warped

### Capture Substrate

- [x] **CAP-01**: A depacked flat 64K image is produced by **slicing a VICE `.vsf` snapshot's
      `C64MEM` module body** (4 bytes of port/PLA state, then 65536 bytes of RAM) with no
      transcription step anywhere. Already validated against 23-03's own hand-transcribed hex: two
      8 KB chunks byte-identical, one differing only at `$0000`/`$0001`, the fourth localising ten
      dropped characters to `$7871`. Closes
      `todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`
- [x] **CAP-02**: Run equivalence is decided by a committed predicate with an **enumerated**
      transient allow-list under a committed **size cap**, never a range, and with the
      `$0000`/`$0001` 6510-port overlay normalised **in code** rather than in a reader's head. The
      allow-list is **re-derived per release** and the method is what carries forward, not any
      address set: MEASURED at the KERNAL `READY` prompt the transient set is 3 of 1024 addresses
      (`$00A2` jiffy-clock low byte, `$00CD` cursor-blink countdown, `$01F2` dead stack byte above
      SP) and that is an **upper bound** taken under frame-divergent conditions, but a real release's
      transients are its own frame counters, RNG, sprite positions and music-player pointers. A rule
      tolerating a page would be over-wide by three orders of magnitude
- [x] **CAP-03**: The captured 64K is **never a conjunct of the stop-identity oracle**. It is the
      dependent variable the oracle certifies, and a predicate that used it to certify its own stop
      would be circular. Asserted structurally, so the next edit cannot reintroduce it
- [x] **CAP-04**: A real cracked release is captured twice and the two captures satisfy `CAP-02` —
      the measurement Phase 23 recorded `could-not-run`, on an **autostarted** release with true
      drive emulation in the loop. This is the first thing in the milestone that is genuinely
      unverified: every probe behind `REPRO-*` ran at the `READY` prompt over the excluded text
      channel, so the protocol must be **re-instrumented over `-binarymonitor`** and re-measured
      here, with the wall-clock-anchoring negative control observed red (MEASURED to reproduce the
      original failure: same instruction, `LIN` 116 / 223 / 267)

### The Gate

- [x] **GATE-01**: The milestone carries a recorded **go / degrade / no-go** verdict against named
      rules committed to git **before** any measurement exists, with no judgement step, and the
      authority to narrow or cancel every phase after it — the Phase 23 pattern, reused because it
      worked. Its `go` inputs include the protocol's jitter-immunity and the seed's effect, both
      measurable **before** any corpus exists, so this gate cannot return `could-not-run` for want
      of a capture the way its predecessor did

### Host-Tool Execution Seam

- [x] **SEAM-01**: Host binaries are reached over a **typed namespaced control op** on the existing
      broker socket, routed **before** any lease-bearing path, so a stateless tool invocation never
      consumes an emulator lease. Discharges the rule stated by the project owner on 2026-08-28 in
      `seeds/host-tool-executor.md`: a skill script runs container-side, the binaries live host-side,
      and there is no container PATH to find them on
- [x] **SEAM-02**: Each tool is invoked through a **typed per-tool allowlist** with no argv
      passthrough anywhere, as a child process, with the invocation and its exit status recorded
- [x] **SEAM-03**: Results cross the boundary as **path plus digest plus length** through
      `containerpath.ts`, never as payload. MEASURED constraint: the control channel has a 64 KiB
      line cap while Ghidra exports run to megabytes, so files are forced regardless — this makes
      that a contract rather than a workaround. (The >64 KiB inline disconnect is READ-IN-SOURCE,
      not yet observed; observing it is a cheap red control for this phase)
- [x] **SEAM-04**: Ghidra runs with **one project directory per run id** and `-deleteProject`, and
      the **no-dot project-path refusal is enforced in code** rather than documented. MEASURED:
      `analyzeHeadless` refuses a project directory containing a dot-prefixed path element, so
      `.planning/...` fails; and it does not create the project *location* directory. Per-run
      directories make the single-writer lock unreachable, which is a better answer than guarding it
- [x] **SEAM-05**: The two existing violations are migrated in this phase and a **whole-tree grep
      gate** bans the reintroduction of an external-binary spawn from a skill script, observed biting
      on a planted violation — `src/skills/acme-build/scripts/acme.mjs` (`spawnSync("acme", …)` with
      a PATH ladder of five *container* paths) and
      `src/skills/c64-program-recon/scripts/packer-finding.mjs`. The gate can only be written once
      nothing violates it, which is why this precedes dxa and Ghidra rather than following them
- [x] **SEAM-06**: The new module family is inside the closed-consumer discipline rather than beside
      it, with a non-vacuity floor proven by a real on-disk positive control. MEASURED structural
      blind spot: `hostpath-consumers.test.ts`'s floor is pinned over the `anno-*` prefix, so a
      `ghidra-*` / `dxa-*` family is **outside its scan entirely** — and adding the module to the
      declared list is precisely how the discipline decays
- [x] **SEAM-07**: The JVM lifetime binding is a **recorded decision with its measurement**, not an
      inherited default. MEASURED: JVM startup is 12.6–17.4 s before any analysis, which is what
      makes per-request `analyzeHeadless` untenable; four independent comparable projects converge
      on one resident JVM behind a localhost socket, structurally the same design as this project's
      own VICE broker. Whichever way it is decided, the reversal condition is recorded

### Discovery Engine

- [x] **DXA-01**: dxa is vendored at a pinned version with its GPLv2+ notice in
      `THIRD-PARTY-NOTICES.md` and is built by this project rather than assumed present on `$PATH`.
      **AMENDED** — the vendored build is real work, not setup: MEASURED, dxa is **not installed
      anywhere on this host**, and the tarball contains **no `LICENSE`/`COPYING` file** (GPL-2.0-or-later
      appears only in C headers, two-party copyright, no upstream signature), so the notice is quoted
      from the source headers and this project supplies the GPL-2.0 text. Digest gate written
      **before** the fetch; `sha256` re-verified against Phase 23's pin byte-for-byte and the build
      reproduces the same binary digest
- [x] **DXA-02**: dxa's human-readable listing is parsed into a machine-readable code/data map, and
      the parser's failure mode is a **refusal rather than a silent mis-parse** — dxa has no
      machine-readable output, so this parser is this project's to own and maintain, over the five
      measured line shapes of `-a dump`. **AMENDED** — the loud failure must come from **this project's parser,
      by name** — refusing, or explicitly reporting the unknown form so it is never silently
      absorbed (AMENDED again 2026-09-04 after Phase 35 verification: `A-04` made
      `dxa-listing.ts` report a real out-of-window over-read rather than refuse, and both real
      anomalies found land inside the declared window, so a refusal was unreachable by
      construction; a silent mis-parse is what this forbids) — not dxa's exit status: MEASURED, `-d strict` exited **0** on an inconsistent
      fixture. It must be provoked by a real unknown listing form from an actual run and not only by a
      hand-planted malformed line; and overlapping decodes (`jsr` into a mid-instruction target) yield
      **unclassified with a stated reason**, never a winner, because a byte-per-address map
      structurally cannot represent them
- [x] **DXA-03**: Known-data ranges are handed to dxa as `-b` data blocks, so a caller can exclude
      graphics regions from discovery — with the store's existing 12-member vocabulary as the source
      and the `-B` / `-l` store-to-dxa emitters as the route
- [x] **DXA-04**: *(new this milestone)* The ground-truth partition every dxa rate is measured against
      is derived by a **committed script, before the tool runs**. **Stated without an external
      oracle** — it is derived from the image bytes, not from execution, `memmapshow` being stated
      absent (decision 2, above). MEASURED reason this matters: the pivot's 141/138 partition was not
      source-derivable and flattered dxa exactly where its `0 false positives` headline lived

### Semantic Engine

- [x] **GHID-01**: Ghidra runs headless under this project's harness against a `.prg` or flat 64K
      image, given dxa's map as hints, reproducible from a committed script rather than a documented
      click-path. **AMENDED** — Ghidra becomes a **declared host prerequisite by version**: MEASURED,
      12.1.3 exists here only as an unpinned out-of-tree probe unpack at `/home/henrik/dev/_ghidra-probe/`,
      not vendored and not on `$PATH`; JDK floor is 21 with no ceiling. Adds three independent gates
      per run, because MEASURED `analyzeHeadless` **exits 0 even when a post-script throws**: the
      harness greps for the **exact literal** `ERROR REPORT SCRIPT ERROR` (a naive `error`/`fail`
      grep false-fires on the flat-64K route's benign `ZERO_PAGE`/`STACK` INFO lines), and asserts
      the classification count as the **block total, not the image size**, on **both** import routes
- [ ] **GHID-02**: `$0000-$0001` and `$D000-$DFFF` are marked volatile before `analyzeAll()`, proven
      by a planted-violation test — remove the flag and hardware writes must **disappear** from the
      output. MEASURED on the committed `bank.a` fixture: three of four `$01` writes and a `$d020`
      write eliminated under defaults, silently, with no warning. Applied to a raster loop this
      deletes the entire visible effect of the program and reports success
- [ ] **GHID-03**: A loader-owned block at the same address is handled by setting the flag on the
      **existing** block, so a run cannot fall back to non-volatile through a swallowed
      `MemoryConflictException`. **AMENDED** — the control is observed red on **both** import routes,
      not one: MEASURED, the conflict path is route-dependent, so a pre-script tested on the `.prg`
      fixture and shipped for the flat-64K corpus meets a conflict the test never saw
- [ ] **GHID-04**: Structural facts are exported through `DecompInterface` — array bounds, the
      split-pointer `CONCAT11` idiom, record strides, resolved computed jumps, self-modifying write
      targets — and **not** through `DataTypeManager`, which returns essentially nothing on 6502,
      with that control run on the **same image** as the acceptance run. **AMENDED** — adds
      per-function **attempted / decompiled / timedOut** accounting with `attempted == decompiled +
      timedOut` under a committed timeout ceiling, because a timed-out function yields no facts and
      no error, failing short in exactly the same shape as the `DataTypeManager` failure this
      criterion exists to catch. **NARROWED** — unresolved dispatch is reported as a **count and a
      list with no denominator**: the specified `C2_SITES_ENUMERATED` drew on `memmapshow`, stated
      absent (decision 2)
- [ ] **GHID-05**: Typed cross-references are exported with their access kind preserved (`READ` /
      `WRITE` / `READ_WRITE` / `COMPUTED_JUMP`), since the annotation join consumes the kind and not
      only the address

### Opcode Coverage

- [ ] **OPC-01**: All 105 opcode bytes stock Ghidra's `6502.slaspec` omits are decodable under a
      SLEIGH extension. **AMENDED from "integrate and verify" to "FIX, COMPILE, integrate and
      verify"** — the carried claim that the source "already exists in full … this phase integrates
      and verifies it; it does not write it" is **FALSIFIED**. MEASURED twice independently against
      real Ghidra 12.1.3's `support/sleigh`: the committed source in
      `docs/undocumented-opcodes-ghidra.md` produces **8 failing constructors** and
      `ERROR No output produced`, exit 2, against a clean control compile of stock `6502.slaspec` in
      the same scratch directory. One root cause for all eight: an unsized value where SLEIGH needs
      an explicit size. Fix verified (explicitly sized locals). A `sleigh` **compile gate** — exit 0
      **and** a produced `.sla` **and** an mtime newer than every input — is the earliest task in
      the phase
- [ ] **OPC-02**: The electrically unstable opcodes (`XAA` `$8b`, immediate `LAX`/`LXA` `$ab`) and
      the page-crossing-dependent ones (`AHX`, `TAS`, `SHX`, `SHY`) are modelled as **declared
      unknowns** — opaque userops — rather than given plausible p-code, and loading `65c02.slaspec`
      in the same installation still yields **its** documented meanings for the bytes both claim. A
      confident wrong semantic is worse than an admitted gap. Note the eight compile failures are at
      exactly these instructions plus `SBC $eb` and `NOP $0c`, so `OPC-01`'s fix and this criterion
      are the same work seen from two sides
- [ ] **OPC-03**: The extension is verified against **real code containing illegal opcodes** — a
      cracked or packed release from this milestone's corpus — not only against a synthetic opcode
      sweep, with the before/after difference in decompiler output recorded. Sequenced **after**
      `OPC-01`'s compile gate and `OPC-04`'s language assertion, and **ahead of** `GHID-04`'s
      acceptance run, because crack and packer code is exactly where the 105-byte gap bites
- [ ] **OPC-04**: *(new this milestone)* The extension is installed as its **own Ghidra language**
      with a new `.ldefs` `id`, the `-processor` change made in the **same commit**, and the phase's
      **first** criterion asserting the language **the run log says it used**. MEASURED silent failure
      this prevents: `6502.ldefs` declares only `6502:LE:16:default` and `65C02:LE:16:default`, every
      existing artifact in this repo names the **stock** language, and a failed `sleigh` leaves the
      pre-shipped `6502.sla` in place — so an unchecked build yields a **green run on a language that
      decodes none of the 105 bytes**. MEASURED good news that makes this cheap: a drop-in language
      extension needs **no Gradle and no Ghidra rebuild** (`-processor 6502:LE:16:nmos` ran headless
      to exit 0). A separate language is also what makes `OPC-02`'s non-collision check meaningful at
      all, since READ-IN-SOURCE `65c02.slaspec:1` is `@include "6502.slaspec"` — appending to the
      base would make `65C02` inherit the illegal bytes rather than avoid them

### The Importer

- [ ] **IMP-01**: Recovered facts land in the store through a **container-side importer** reading a
      host-written transfer file, with access kinds preserved and the store's single seam respected.
      The alternative — a Ghidra post-script writing `.annostore` directly — is **structurally
      unavailable**, not merely discouraged: `anno-seam.test.ts` asserts `node:sqlite` is named by
      exactly one shipped module, so a Java writer would sit outside every guard's scope, an
      invisible violation rather than a caught one, and `openStore()`'s confinement, the paint index
      and the revert journal would all need re-implementing in Java against a container-side store
- [ ] **IMP-02**: The transfer file is **transient evidence, not a model** — carrying a digest,
      consumed and deleted in the same command that imports it — so no fourth artifact can drift from
      the store. `.annostore` is the model; `.asm` is a rendering of it through the shipped
      `anno export-asm`. Prior art is unanimous on this split

### Automatic Annotation

- [ ] **AUTO-01**: Machine addresses are annotated mechanically by joining recovered typed
      cross-references against `memmap.json`, with **no agent call, no queue walk and no skill
      invocation** anywhere in the loop, reporting how many addresses were annotated and how many
      skipped — and the annotations are read back **out of the store**, not out of the pipeline's own
      stdout
- [ ] **AUTO-02**: The join selects the **narrowest containing range**, breaking ties toward the
      entry carrying a `sym`. A committed control asserts `$D020` annotates as the 1-byte
      border-colour entry and **not** as the 4096-byte I/O-area entry, and that switching selection to
      first-match or longest-description makes that control go **red**. This rule was got wrong on
      the first attempt during the pivot and produced plausible, confident, wrong comments rather than
      an error — a criterion that only asserted the fix would be worthless
- [ ] **AUTO-03**: An address inside the loaded image is treated as a program address and never looked
      up in `memmap.json`, with a control that goes red if the image-range check is removed — the first
      attempt annotated two ordinary loop-back branches as machine features
- [ ] **AUTO-04**: Bank state is resolved **before** the address — `$01` bits 0-2 (LORAM / HIRAM /
      CHAREN) decoded and carried per program point — so a `$d020` write under `$34` is not labelled
      the border colour and a `$d000` read under `$33` is not labelled sprite-0-X, with a control that
      goes red when the decode is bypassed. **AMENDED** — recorded as **unvalidated, not narrowed**
      (`R1` fired under first-match-wins, so `R7`'s pre-mapped narrowing was never evaluated), and it
      requires a **synthetic two-caller path-dependent `$01` fixture built as an early task**: MEASURED,
      the existing `bank.a` fixture has no path-dependent site, so "the join declines on the fixture" is
      not a usable control. **NARROWED** — the `memmapshow` external check is stated absent (decision 2),
      so this rests on the synthetic fixture alone. Hard dependency: no volatile carve → no recovered
      `$01` literals → no bank state, so `GHID-02` gates this
- [ ] **AUTO-05**: Where bank state is path-dependent — computed, or set inside a routine reached from
      several banking contexts — the join emits **no annotation and says why**, rather than carrying one
      value forward and being confidently wrong. Also **unvalidated, not narrowed**. Note there is no
      prior art to copy or validate against: MEASURED survey — SVD-Loader, radare2's SVD import and
      IDA's device definitions all annotate **unconditionally** from a flat device description, because
      their domain has no path-dependent address meaning. That is the strongest available argument for
      the control-observed-red discipline here
- [ ] **AUTO-06**: Graphics areas are derived from the VIC pointers rather than from cross-references
      (`$DD00` bits 0-1 inverted for the VIC bank, `$D018` for screen and charset-or-bitmap, `$D011`
      bit 5 for the mode, screen + `$3F8` for sprite pointers), because the VIC fetches by DMA and a
      charset may be referenced by **no instruction anywhere in the program** — the case
      cross-references structurally cannot find
- [ ] **AUTO-07**: Derived graphics ranges are fed back to dxa as `-b` data blocks and to Ghidra as
      data. **AMENDED** — the before/after ordering is explicit and **exercised**, not merely built:
      phantom labels shown **present before** the feedback and **absent after**. This is the
      containment for the pipeline's most dangerous failure, and it is not a review step: graphics
      bytes decoded as instructions mint phantom labels indistinguishable in form from genuine ones, a
      phantom routine inside a charset gets promoted to a function, yields phantom xrefs, feeds the
      join, and emerges as a confident wrong comment the next pass treats as established
- [ ] **AUTO-08**: Every derived row carries `memmapSha256` provenance, so a later reader can tell
      which map version produced an annotation

### The Proofs

- [ ] **PROOF-01**: dxa's data-recovery rate and false-positive count are measured on real cracked
      releases, reported as numbers against a **named binary** — and stated **beside** the fixture
      figures rather than silently replacing them. **AMENDED** — every rate carries its **denominator
      and positive class**, and the pivot's published `72.46%` / `0 FP` may appear only beside the
      source-derived `FIXTURE_FALSE_POSITIVES: 3` / `FIXTURE_DATA_RECOVERY_PCT: 72.39 (97/134)` /
      `FIXTURE_REPRODUCED: no`, with the non-reproduction cause attached as a hypothesis. **NARROWED** —
      there is **no independent external check** available, `memmapshow` being stated absent (decision
      2); this is a named weakness of the measurement, recorded rather than absorbed
- [ ] **PROOF-02**: Ghidra's indirect-dispatch resolution is tested where the dispatch index is
      **computed** rather than an immediate `ldx #$02` — the case the pivot fixture never exercised —
      with the result recorded whichever way it comes out. Note the distinction Phase 23 was emphatic
      about: this was `could-not-run`, **not** `not-exercised` — no corpus was ever searched for a
      computed dispatch, so nothing is known about whether the construct is even present
- [ ] **PROOF-03**: The `memmap.json` join is run against code that banks ROM in and out, and the point
      where a single forward-carried `$01` value becomes wrong is **established rather than assumed**.
      **AMENDED** — stated as **unmeasured in BOTH directions**, with the fixture that will measure it
      named. Nothing is known about where forward-carrying stops being correct, in either direction;
      path-dependent bank state is the highest-risk item on the pivot's own record

## Future Requirements

### The rebuild half (v0.9.0 — text unchanged in `milestones/v0.5.0-REQUIREMENTS.md`)

- **DECOMP-01..04**, **BUILD-01..06**, **EQUIV-01..04**. Re-mapped from v0.7.0 to v0.9.0 on
  2026-08-26: each is written against a substrate v0.7.0 built, and `DECOMP-01` is precisely what
  `STORE-01`'s 12-member vocabulary is sized for.

### The runtime-evidence layer (seed stays planted)

- A text-monitor client with the `channel: "binary" | "text"` discriminator, and `memmapshow` /
  `prof` / `chis` as a **third independent classifier** accumulating execution evidence keyed by run
  identity, joined against the byte-derived blocks with **disagreement** as the output.
  `seeds/runtime-evidence-layer.md`. Out of scope by owner decision 2026-09-02; `stopwatch`
  additionally excluded by name. Its hard prerequisite — that a text client and a binary client can
  be connected simultaneously without one's halt/resume corrupting the other's view — remains this
  repo's long-standing **unprobed** item and was not closed by any of this milestone's research.

### Withdrawn capabilities no phase owns

- **`ANNO-13`** (generated bit-name enums) and **`ANNO-14`** / **`ANNO-15`** (the symbol round trip)
  remain Validated-with-no-route, withdrawn by the v0.7.0 removal under the 2026-08-26 "no parity is
  owed" decision. Not scoped here.

### Deferred with a named trigger

- **The `KEYBOARD_MATRIX_SET` upstream contribution** — a pull request against a project this repo
  does not own. Coupled to `FORK-01`: if it lands upstream, one of the three reasons to keep the fork
  backend disappears. Trigger tracked manually.
- **Absolute-cycle stop identity** — an optional strengthening of `REPRO-03` via `CPUHISTORY_GET`
  (0x86)'s uint64 clock field, available only at VICE >= 3.10. This host runs 3.9, and Debian
  trixie/forky/sid plus all current Ubuntu ship 3.9.

## Out of Scope

Explicitly excluded, with reasoning, to prevent re-adding.

| Feature | Reason |
|---------|--------|
| The text monitor's `stopwatch`, in any form | Owner decision 2026-09-02. It was proposed as the monotonic frame counter and therefore as *the* mechanism for the frame-exact stop; the reset protocol plus `(PC, hit_count, (LIN, CYC))` replaces it entirely on the binary monitor at the 3.9 floor |
| Dialing the `-remotemonitor` text channel at all this milestone | Follows from the above and from the runtime-evidence layer being out of scope. Stock's monitor services exactly **one** client, so opening it collides with the binary monitor unless the simultaneous-clients question is settled first — and that question is unprobed |
| VICE event record/replay as the reproducibility mechanism | **Does not exist.** MEASURED: `event.c` registers exactly six event options and none is `-record`/`-recordevents`; `x64sc -record` returns `Unknown option`, exit 255; `event_record_start()` has no non-UI caller; no binary-monitor opcode addresses it. The text monitor's `record`/`playback` are monitor-command file scripting, not event history — which is the trap that makes the belief plausible |
| Reviving phase 0's Route B reconstructed cycle clock | A reconstructed clock accumulates error: MEASURED incidentally at 19,657 cycles/frame against phase 0's documented 19,656, a 1-cycle-per-frame drift. Phase 0's decision to drop it stands |
| A `da65 .info` generator, and a ca65+ld65 rebuild route | **Anti-feature**, five of six grounds MEASURED against installed `da65 V2.18`: the type vocabulary is nine values with no struct/split/pointer members, so a split lo/hi pair renders as two unrelated `.byte` runs; `LABEL { ADDR; COMMENT; }` without `NAME` is a **hard error**, so a comment cannot exist without minting a symbol — fatal for a feature whose entire output is comments on machine addresses; and `TYPE SKIP` emits **no directive at all**, so a rebuild **assembled cleanly and produced a wrong binary** (an 18-byte hole collapsed, `lda tab_lo,x` resolved to `$100E` instead of `$1020`). Proposed in the untracked `docs/dissambler-workflow.md`; this project already has an ACME exporter verified by a real assembler |
| A persisted `program.json` as a parallel model | The store is the one authoritative model. The transfer file is transient evidence with a digest, consumed and deleted on import (`IMP-02`). Prior art is unanimous — SourceGen's `.dis65` stores metadata only; Mesen's CDL is pure evidence kept outside the model |
| A Ghidra post-script writing `.annostore` directly | **Structurally unavailable**, not merely discouraged — see `IMP-01`. A Java writer sits outside every guard's scope, which is an invisible violation rather than a caught one |
| Vendoring Ghidra into this repository | 543 MiB. Declared as a host prerequisite by version with a digest, fetched or installed out of tree |
| Bank-qualified addressing as a modelled store feature | `PROOF-03` is unmeasured in both directions and `memmap.json` is flat. `STORE-05` reserves the field; nothing interprets it |
| Sprite **bitmap** locations, and the second `$DD00` VIC banking axis | Carried gaps, unowned, and no plan may quietly promise either. Sprite pointer values are program data usually written at runtime, so they are not register values Ghidra recovers |
| `-limitcycles` as a capture route | MEASURED: stock 3.9's own help says it runs before quitting **with an error**. No snapshot, no RAM, and it kills the process the broker supervises |
| Text-monitor `bsave` as a capture route | It writes on the host filesystem from inside the emulator, bypassing `hostpath.ts` / `containerpath.ts`, and gives the CPU view rather than RAM |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REPRO-01 | Phase 33 | Complete |
| REPRO-02 | Phase 33 | Complete |
| REPRO-03 | Phase 33 | Complete |
| REPRO-04 | Phase 33 | Complete |
| REPRO-05 | Phase 33 | Complete |
| CAP-01 | Phase 33 | Complete |
| CAP-02 | Phase 33 | Complete |
| CAP-03 | Phase 33 | Complete |
| CAP-04 | Phase 33 | Complete |
| GATE-01 | Phase 33 | Complete |
| SEAM-01 | Phase 34 | Complete |
| SEAM-02 | Phase 34 | Complete |
| SEAM-03 | Phase 34 | Complete |
| SEAM-04 | Phase 34 | Complete |
| SEAM-05 | Phase 34 | Complete |
| SEAM-06 | Phase 34 | Complete |
| SEAM-07 | Phase 34 | Complete |
| DXA-01 | Phase 35 | Complete |
| DXA-02 | Phase 35 | Complete |
| DXA-03 | Phase 35 | Complete |
| DXA-04 | Phase 35 | Complete |
| GHID-01 | Phase 36 | Complete |
| GHID-02 | Phase 36 | Pending |
| GHID-03 | Phase 36 | Pending |
| GHID-04 | Phase 36 | Pending |
| GHID-05 | Phase 36 | Pending |
| OPC-01 | Phase 36 | Pending |
| OPC-02 | Phase 36 | Pending |
| OPC-03 | Phase 36 | Pending |
| OPC-04 | Phase 36 | Pending |
| IMP-01 | Phase 37 | Pending |
| IMP-02 | Phase 37 | Pending |
| AUTO-01 | Phase 37 | Pending |
| AUTO-02 | Phase 37 | Pending |
| AUTO-03 | Phase 37 | Pending |
| AUTO-04 | Phase 37 | Pending |
| AUTO-05 | Phase 37 | Pending |
| AUTO-06 | Phase 37 | Pending |
| AUTO-07 | Phase 37 | Pending |
| AUTO-08 | Phase 37 | Pending |
| PROOF-01 | Phase 38 | Pending |
| PROOF-02 | Phase 38 | Pending |
| PROOF-03 | Phase 38 | Pending |

**Coverage:**

- v0.8.0 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-02*
*Last updated: 2026-09-02 at the v0.8.0 open*
