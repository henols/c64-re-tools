# Phase 40: The Three Preprocessing Host Tools - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Reach VICE's standalone preprocessing binaries from a container-side skill
script over the typed `host_tool` control op v0.8.0 shipped, so a disk's real
structure and a BASIC stub's handover point are available before any
disassembler is spent on the image — with **each tool's own output, never its
exit status**, deciding pass/fail.

**The phase is now TWO tools, not three.** `cartconv` is **not built** and
`PREP-03` **leaves the roadmap** — a hard direction given by the owner during
this discussion (2026-09-08). See `D-30`..`D-32`.

**Delivered:**

- `c1541` reached over `host_tool` as five per-capability tool ids, covering
  `.d64` BAM, directory, raw directory entry, sector chain and single-file
  read (`PREP-01`).
- `petcat` reached over `host_tool` as one tool id, resolving a BASIC stub's
  `SYS` handover point or issuing a **named decline** when the argument is
  computed (`PREP-02`).
- A positive-shape failure oracle per capability, host-side in the seam, with
  a per-tool non-vacuous control (`PREP-04`).
- **The `.d64` supersession decision, reached and executed rather than
  deferred**: `d64-parse.mjs` AND `anno-d64.ts` are deleted and `c1541`
  becomes the only `.d64` route.
- **The `.c64-re-tools/` path consolidation**, all six writers, clean break —
  a folded pending todo.
- **Two new skills** (`c1541` disk access; `petcat`), with the two existing
  overlapping skill descriptions re-cut.
- Two carried fixes: `WR-03` and the unowned `mkdtemp` scratch-fixture fix.

**NOT delivered (scope anchors):**

- **No `cartconv`, no cartridge banking, no per-bank images.** `PREP-03` is
  excluded, not deferred-in-place. Nothing in this phase may reach for it.
- **No runtime correlation** of a file's claimed sector chain against the
  sectors a loader really reads. That needs drive-side checkpoints, which need
  the `default_memspace` reset only `device c:` provides — Phase 41 — and is
  additionally gated on `Drive8TrueEmulation` plus a non-zero `Drive8Type`,
  since drive memory reads with true drive emulation off return **silent
  zeros, not an error**. `PREP-01`'s text is static structure only. A plan
  here that reaches for it is out of scope.
- **No mutating `c1541` verb on the shipped seam** (`D-03`).
- **No bank-qualified addressing in the store** — the v0.8.0 exclusion is
  carried unchanged and is now moot for this phase anyway.

</domain>

<decisions>
## Implementation Decisions

### Tool-id granularity

- **D-01:** **One `host_tool` id per capability**, not per binary and not one
  batched survey. Follows `acme.build` / `ghidra.analyze` /
  `dxa.disassemble` exactly. The rejected per-binary-with-a-typed-verb-field
  shape was rejected on a named ground: it turns `HOST_TOOL_ARG_KEYS` into a
  union across verbs, so a key valid for one verb is accepted for all,
  weakening the refuse-unknown-keys-BY-NAME discipline `host-tool.mts`'s own
  header calls authoritative.
  — **Reversibility:** costly — each id is seven synchronized edit sites
  (`HostToolId`, `HOST_TOOL_IDS`, `HOST_TOOL_ARG_KEYS`,
  `HOST_TOOL_PATH_ARG_KEYS`, `HOST_TOOL_TIMEOUT_MS`, the narrowing arm, the
  argv builder) plus census-test entries; collapsing them later means
  unpicking all of that.

- **D-02:** The shipped id set is **six ids**: `c1541.bam`, `c1541.dir`,
  `c1541.entry`, `c1541.chain`, `c1541.read`, `petcat.decode`.
  - `c1541.bam` / `c1541.dir` / `c1541.chain` are `PREP-01`'s three named
    outputs (BAM, directory, named file's sector chain).
  - `c1541.entry` was added during discussion because it is the ONLY route to
    a directory entry's `first_track`/`first_sector` — MEASURED: `c1541 -dir`
    does not emit them, `c1541 -entry` returns `T/S: 17/0, 178 blocks`, the
    raw 32-byte entry in hex, and `Next directory T/S`. Without it the
    fakery detector (`D-06`) cannot be ported.
  - `c1541.read` was added because `extractEntry()`'s three live-test callers
    need one named file's bytes out of the image (`D-07`).
  - `HOST_TOOL_ARG_KEYS`, `HOST_TOOL_PATH_ARG_KEYS` and
    `HOST_TOOL_TIMEOUT_MS` all gain six entries;
    `host-tool.test.ts:1915`'s pinned declared-path-key total of **17** moves
    and must be updated with the real new number, not a guess.

- **D-03:** **No mutating `c1541` verb ships.** Every shipped id is read-only,
  so the ROADMAP's "if any mutating verb ships, it writes its evidence before
  it writes the disk" clause is satisfied vacuously and stays on the record
  for whoever adds one later. `c1541.read` writes a **host** file, not the
  disk image, so it is not a mutating verb under that clause.
  — **Reversibility:** reversible.

### The `.d64` supersession — reached, not deferred

- **D-04:** **`d64-parse.mjs` is fully replaced this phase and deleted.**
  `c1541` becomes the only `.d64` route. This **reverses two locked
  statements** and both are amended in-phase (`D-29`):
  - ROADMAP Phase 40 success criterion 1: *"`d64-parse.mjs` is untouched and
    undeprecated: `c1541` is additive by decision, and whether it eventually
    supersedes the hand-written parser is deferred on the record rather than
    settled as a side effect of adding a tool."*
  - REQUIREMENTS.md line 109 (Excluded): *"Superseding or deleting the
    hand-written `.d64` parser — `PREP-01` is additive."*

  REQUIREMENTS.md's own Notes name this as one of two *"decisions to be
  reached and recorded, not features to be built"*, and say to fold it into
  the phase that touches the relevant code. This is that phase. The decision
  was taken with three costs stated and accepted:
  1. `d64-parse.mjs`'s header calls it *"pure Node over the disk-image bytes,
     which is why it works whether or not VICE happens to be up"* — the
     `c1541` route needs the broker and the seam up. **Accepted** (`D-05`).
  2. Its `--json` fakery detector has no `c1541` equivalent and must be
     ported (`D-06`).
  3. `anno-d64.ts` is a deliberate MCP-side duplicate naming `d64-parse.mjs`
     as *"the skill-side owner of the algorithm"* — it goes too (`D-08`).

  The evidence that made this the right call, MEASURED during discussion:
  `c1541` supplies **strictly richer inputs** than `d64-parse.mjs` computes —
  `-bam` returns a **per-sector** allocation map (`*` allocated, `.` free)
  where `d64-parse.mjs` had only per-track free counts, and `-entry` returns
  the first T/S plus the raw entry bytes plus the next-directory pointer.
  — **Reversibility:** one-way — two source files and their tests are
  deleted; undoing means restoring both from git and re-pointing every
  consumer back, and the published skill surface changes in a released
  package.

- **D-05:** **No fallback when the seam is unreachable.** A seam refusal is
  reported and the operation fails with its reason. No byte-level fallback
  path is retained. `acme.mjs`'s own header states the rule this follows:
  *"never reintroduce a local child-process call to the assembler as a
  fallback when the seam is unreachable — a fallback that works on the
  developer's own host and silently fails inside a container is the exact
  failure this seam exists to remove."*
  — **Reversibility:** reversible.

- **D-06:** **The fakery detector is ported onto `c1541`'s inputs, not
  dropped.** It is the load-bearing part of `d64-parse.mjs` and must survive
  the replacement. What it does, from
  `src/skills/c64-ram-capture/scripts/d64-parse.mjs:164-171`: flags each
  directory entry `suspicious` with **named reasons, never a bare boolean**,
  on three signatures —
  1. `block count is 0`
  2. `first track/sector T/S is outside the image`
  3. `first track T is reported entirely free by the BAM (0 sectors
     allocated) — the file cannot really start there`

  Signature 3 is the real one: it cross-references the **directory's claim**
  against the **BAM's accounting**, so a directory entry naming a file whose
  first sector lives in a track the BAM says is 100% empty is a *fabricated*
  entry — a filename a cracker put in the directory for a file never written.
  On a cracked release that is a load-bearing provenance signal.

  Plus a fourth, structural: `parseDirectory()` carries a **visited-set cycle
  guard**, so a self-referential or cyclic next-sector pointer stops the walk
  and reports `chain_error` instead of hanging. This must be reproduced
  against `c1541 -entry`'s `Next directory T/S` output — `c1541`'s own
  directory walk reports no cycle guard.

  Note the port makes signature 3 **sharper**, not merely equivalent:
  `c1541 -bam`'s per-sector map allows testing the exact first sector rather
  than only whether its whole track is free.
  — **Reversibility:** costly — the detector's output shape is what
  downstream provenance consumers read.

- **D-07:** **`c1541.read` is the single-file byte-extraction route**, not
  `c1541.extract`. `-read <cbm-name> <host-path>` mirrors
  `extractEntry(image, entryName)`'s signature one-for-one, so the three live
  tests re-point with minimal change. `-extract` (whole image) was declined:
  a caller wanting one `.prg` would pay for the whole disk and then have to
  find its file among N host files whose names came from PETSCII — a
  name-mangling surface the per-file route avoids. Outputs cross as
  `{ path, sha256, byteLength }`, never bytes.
  — **Reversibility:** reversible.

- **D-08:** **`anno-d64.ts` is deleted too**, confirmed after its blast radius
  was measured rather than before. One `.d64` route, no exceptions. Measured
  consumers, all of which must be re-pointed:
  - `anno-d64.test.ts` (its own test)
  - **three LIVE tests** — `ghidra-live.test.ts:59`,
    `ghidra-opcode-live.test.ts:38`, `dxa-live.test.ts:48` — all importing
    `listEntries` / `extractEntry` to pull a real `.prg` out of a `.d64`.
    `dxa-live.test.ts:231` states this explicitly. **These three acquire a
    broker dependency they do not have today.** That is a behaviour change,
    not bookkeeping, and it was confirmed knowingly.
  - `module-classification.ts:405-418` — a registered entry with a **pinned
    symbol-and-line reference** (`sectorsPerTrack`, line 10) plus a consumer
    list. Goes red until updated.
  - `src/mcp/vice/package.json:58` — `files[]` membership.
  - `scripts/check-npm-packages.mjs:234` — names it in the packaged-import set.
  - `src/skills/c64-ram-capture/scripts/vsf-slice.mjs:12,24` — header prose
    citing it, **and `vsf-slice.test.mjs:213` asserts the header cites it** —
    a test that fails on the deletion of a file it only mentions in prose.
  - `prg-image.ts:39`, `vsf-slice.ts:395`, `ghidra-live.test.ts:1073` — prose
    references to its header's recorded constraints.
  — **Reversibility:** one-way — same as `D-04`, plus a `files[]` change in a
  published package.

### The failure oracle (`PREP-04`)

- **D-09:** **Positive signal per capability.** Each id declares the SHAPE its
  success output must have; **absence of that shape is the failure.** Neither
  a negative error-phrase matcher nor a both-directions check.

  This is decided on MEASURED evidence gathered during the discussion, and the
  measurements are what make the alternatives wrong rather than merely
  weaker:
  - **`c1541` prints `OPENCBM: opening dynamic library libopencbm.so
    failed!` on EVERY call on this host** — so "stderr non-empty means
    failure" would fail 100% of calls. A positive-shape check ignores it for
    free, because noise is simply not the expected shape.
  - **`c1541` exits `0` on error**, printing `cannot open file '<path>'` and
    `Error - Cannot open file '<path>'.`
  - **`petcat` exits `1` only for a missing file**; garbage input gives
    **exit `0` with junk output**. Its non-zero exit covers one class, not
    "error".
  - (Recorded because it is why the rule is shaped this way even though the
    tool is now out of scope: **`cartconv -f` on a non-cartridge produced
    ZERO bytes and exit 0** — no error text at all. No phrase-matcher can
    catch that. It was the decisive case for positive-shape and remains the
    strongest argument on the record.)

  Concrete shapes to declare: `c1541.chain` must yield at least one `(t,s) ->
  (t,s)` arrow pair; `c1541.dir` must yield the `N blocks free` trailer;
  `c1541.entry` must yield a `T/S:` line; `petcat.decode` must yield the
  `;<path> ==<hex>==` banner line.
  — **Reversibility:** costly — the declared shapes are pinned to fixtures
  and every id has one.

- **D-10:** **The shape check lives host-side, in the seam.** `runHostTool()`
  applies it, so the response crossing the wire is already
  `{ ok: false, reason }` on failure and every caller — skill script, test,
  future MCP tool — gets the same verdict with no chance of one forgetting to
  check. Follows `dxa.disassemble`'s existing precedent, which already
  *"never [reads] the dxa process's own exit status, which is not the
  pass/fail signal for a listing"* (`host-tool.mts:1238-1241`) and digests
  the FILE instead. The container-side alternative was declined as the named
  *"Re-deriving a cross-cutting seam locally"* anti-pattern.
  — **Reversibility:** costly — moving it later means every caller grows the
  check.

- **D-11:** **Exit status is recorded in the log line and never consulted —
  for all tools, `petcat` included.** One oracle discipline, one code path.
  Using `petcat`'s exit 1 as an extra veto was declined: it introduces a
  per-tool asymmetry every future reader must re-learn and buys nothing the
  shape check does not already catch, and trusting it would give false
  confidence on exactly the garbage-input case `PREP-02`'s decline path cares
  about.
  — **Reversibility:** reversible.

- **D-12:** **`PREP-04`'s non-vacuous control is a test assertion per tool**,
  not a one-time evidence document. For each binary, ONE test runs the planted
  failure fixture and asserts **both directions in the same test**: the
  positive-shape oracle refuses, AND a deliberately-written exit-status-only
  predicate returns "pass" on that identical output. Two-directional, in the
  suite, and it goes red if anyone ever "simplifies" the oracle back to an
  exit check. Follows the project's existing two-directional guard convention
  (`test-gate`'s union, the deferred ledger, the resources sync).
  — **Reversibility:** reversible.

### Binary resolution and the shadowing hazard (Pitfall 11)

- **D-13:** **Each binary is resolved alongside the resolved `x64sc`** — from
  the directory of whichever `x64sc` `backend-detect.mts` already resolved —
  with a PATH fallback that records a warning. The ROADMAP's own reasoning:
  these *"are small binaries that ship ALONGSIDE `x64sc` from the same
  package"*. This guarantees the tools and the emulator are the same VICE
  build, which matters because a 3.9 `c1541` and a 3.10 `x64sc` can disagree
  about formats.

  Pitfall 11 is live on this host, not theoretical — MEASURED during
  discussion: **both builds of all three binaries exist**, `/usr/bin/`
  (VICE 3.9, dated 30 Dec 2024) and `/usr/local/bin/` (fork, dated 26 Aug
  2026), and a bare-name resolve silently picks the fork.
  — **Reversibility:** reversible.

- **D-14:** **Path only, no version probing. DELIBERATE DIVERGENCE from the
  ROADMAP.** The Phase 40 Notes bullet asks to *"Probe availability and
  version once per process, capture the probe output as a fixture with the
  same provenance keys, and log path and version per call"*. The owner
  dropped the version half on 2026-09-08. Recorded here as a divergence, not
  an omission — **a planner must not re-add it.**

  It is a Notes bullet rather than a success criterion, so it is the owner's
  to overrule. Version probing is also genuinely awkward here, MEASURED:
  `c1541 --version` is **unimplemented** (`Unimplemented version '-version'`
  / `command '-version' unrecognized`), and `cartconv --version` printed
  `Error: no output filename` **beside** `cartconv (VICE 3.9)`.
  — **Reversibility:** reversible.

- **D-15:** **Availability is established once per process and memoised.**
  Resolve and existence-check on first use; every later call reuses it. This
  is `backend-detect.mts`'s own stated posture (*"do not call
  resolvedBackend()/probeBackend() per acquire, per launch"*). A missing
  binary produces a clean named refusal citing the path tried, following
  `dxa.disassemble`'s existing message shape (*"the vendored dxa binary does
  not exist (tried: ...)"*).
  — **Reversibility:** reversible.

- **D-16:** **Every per-call log line carries the resolved absolute path**,
  alongside the tool id, exit status and elapsed ms `host-tool.mts:1566`
  already emits. Makes "which build answered" recoverable from any transcript
  with no extra machinery, and satisfies the ROADMAP note's path half.
  Logging only on the first (memoised) resolution was declined: a log line
  read in isolation must still say which binary produced it.
  — **Reversibility:** reversible.

### Skill surface and ownership

- **D-17:** **Two new skills, six → eight.** The owner's own framing:
  `c1541` is *"access and extracting data"* and belongs with format access;
  `petcat` is PETSCII/ASCII/BASIC *conversion* and gets its own skill.
  - **A new disk-access skill** owning `.d64` access via `c1541` — BAM,
    directory, entry, chain, read. This is where `d64-parse.mjs`'s
    replacement lands. Originally scoped as `c1541` + `cartconv` "container
    access"; `cartconv`'s removal (`D-30`) collapsed the container theme but
    the new skill was **kept anyway** (`D-32`), because it keeps "get data
    out of a disk image" separate from "capture a running machine's RAM".
  - **A new `petcat` skill** owning both halves of `PREP-02` — PETSCII/ASCII
    and BASIC detokenization, AND reading the `SYS` target out of the
    detokenized line plus issuing the named decline. One tool, one skill, one
    owner of its oracle. `c64-program-recon` gains a **pointer** to it at the
    "before disassembling anything" step, not the logic.
  — **Reversibility:** costly — both npm and plugin packaging routes ship
  skills, and a skill name is a discovery surface users come to depend on.

- **D-18:** **One script per binary**, not one per capability. Each exposes
  its binary's capabilities as subcommands, the way `d64-parse.mjs` already
  does with `directory` and `bam`. The `host_tool` id set stays
  per-capability regardless (`D-01`); this is only file layout. Per-capability
  scripts were declined: they multiply the files both packaging routes must
  sync and the spawn gate must scan, for capabilities sharing all their
  argument handling and all their output judgement.
  — **Reversibility:** reversible.

- **D-19:** **The two existing overlapping skill descriptions are re-cut in
  the same phase.** `skill-description-overlap.test.ts` scores pairwise
  description overlap (and asserts *"at least 6"* skills, so the count itself
  is safe — the pin is relation-based, not a magic number). The new disk skill
  will compete with `c64-ram-capture`'s description (both say `.d64`) and
  `c64-program-recon`'s (both say "before disassembling"). Handled by making
  the descriptions **actually true**, not by tuning wording around a
  threshold: `c64-ram-capture` drops its `.d64` claims (it no longer owns
  them — `SKILL.md:62`, `:81`, `:422` all cite `d64-parse.mjs`), and
  `c64-program-recon` points at the new skills for stub work rather than
  describing it.
  — **Reversibility:** reversible.

- **D-20:** **Both new skills are silent on backend.** VERIFIED during
  discussion rather than assumed: `check-skill-fork-honesty.mjs` fires on
  mentions of **fork-only `vice_*` tools**, derived from
  `capability-registry.ts`'s `CAPABILITY_REGISTRY` (every entry whose
  `providedBy` is `"fork"`). Both new skills name no `vice_*` tool at all —
  they reach the seam through `host-tool-client.ts` — so the gate is silent
  by construction and needs no declaration. The recommended
  "backend-agnostic, broker-required" wording was NOT taken.
  — **Reversibility:** reversible.

### `PREP-02`'s decline shape

- **D-21:** **A resolved "no" is a SUCCESS: `ok: true`, `entrypoint: null`,
  plus a named reason.** The tool detokenized the stub correctly and correctly
  concluded the entry point is not statically resolvable — that is a real
  answer. The reason names what it saw (e.g. `SYS argument is an expression:
  SYS PEEK(43)+256*PEEK(44)`). This keeps `ok: false` meaning "the tool did
  not work", which is exactly what `D-09`'s shape-based oracle uses it for;
  conflating the two would make `PREP-04`'s oracle and `PREP-02`'s decline
  indistinguishable. A required verdict enum was considered and declined as a
  wider response type than the requirement needs.
  — **Reversibility:** costly — the response shape is a wire contract every
  caller switches on.

- **D-22:** **The detokenized listing goes to a workspace file, the verdict
  crosses inline.** The listing is returned as `{ path, sha256, byteLength }`,
  per the seam's stated rule that *"No inline byte payload on a host-tool
  response, at any result size"*. Consistent with `dxa.disassemble`, which
  captures stdout, writes it to one `outputs[]` path and digests the FILE. A
  stub is usually one line — the measured fixture is literally `10 sys2064` —
  but a multi-line loader stub is not, and the rule has no size exemption.
  — **Reversibility:** reversible.

- **D-23:** **The computed-`SYS` fixture is authored, not found.** Build a tiny
  `.prg` whose BASIC stub does a computed `SYS`, via the `acme.build` seam
  this project already owns, or by hand-assembling the ~20 tokenized bytes.
  Deterministic, tiny, committed, and its provenance is explicitly "we wrote
  it to carry exactly this case". It sits beside
  `src/mcp/vice/fixtures/dxa/basic-stub.prg`, which already covers the literal
  fast path — MEASURED working during discussion: `petcat -2` on it returns
  `10 sys2064`.
  — **Reversibility:** reversible.

- **D-24:** **`petcat`'s BASIC dialect is fixed at `-2` server-side**, in
  `buildHostToolArgv()`, like `dxa`'s fixed flag block. No wire field, no
  validation, no way for a caller to request a dialect that produces a wrong
  detokenization silently. This project's target is fixed to C64 everywhere
  already — `acme.mjs`: *"Target is fixed: C64, 6510 CPU, cbm output."*
  — **Reversibility:** reversible.

### Fixtures

- **D-25:** **A synthetic `.d64` is authored with `c1541` and committed**
  under `src/mcp/vice/fixtures/`, pinned by sha256 — `-format` then `-write` a
  known `.prg` onto it. This replaces the three live tests' current route of
  reading Phase 23's corpus image through `anno-d64.ts`.

  **The tension, and its resolution, on the record:** authoring the image
  needs *mutating* `c1541` verbs, which `D-03` excludes from the shipped id
  set. Resolved the way this project already resolves that shape — the fixture
  is authored **once by a throwaway command and committed**, exactly as
  *"throwaway probe scripts are evidence, not deliverables"* (Phases 23, 33,
  and Phase 39's `D-10`/`D-13`). **No mutating id ships.**

  The mild circularity is acknowledged: the tool under test builds its own
  fixture, so the format-correctness claim rests on `c1541` agreeing with
  itself. Acceptable for the extract/chain paths. Keeping one assertion
  against the real corpus image in a live-gated test is the stated
  mitigation and is Claude's discretion to place.
  — **Reversibility:** reversible.

### Carried items

- **D-26:** **`WR-03` is taken here.** It carries `resolves_phase: 40`
  explicitly. Two holes in `host-tool.mts`'s own stated invariant that
  *"NOTHING throws out of this function"*:
  1. `runOracleRun()`'s `mkdirSync(scratchDir, { recursive: true })` at
     `host-tool.mts:1039-1040` sits **outside** its own `try`. A full disk or
     a permission error on the `tools/oracle-runs/` parent throws
     synchronously out of `runHostTool()`.
  2. The standalone CLI entry point (`host-tool.mts:1117-1121`) has **no
     `.catch()`**, so a rejection is an unhandled rejection in the standalone
     `host-tool.mjs` process — the one CI and `hostToolOverHostRoute()` use —
     surfacing as an opaque *"host-tool.mjs produced no output on stdout"*.

  `host-tool-client.ts:419-427` already does this correctly; **mirror it
  rather than inventing a second shape**. It matters more now than when filed:
  this phase adds six ids to that module. Requires a `build.ts` re-run —
  `resources-sync.test.ts` fails CI on drift.
  — **Reversibility:** reversible.

- **D-27:** **The unowned `mkdtemp` fix is taken here.** The ROADMAP made it
  eligible for this phase specifically because the phase touches skill-script
  trees; culprit and remedy are both already named and no pass owns it, and it
  has been carried twice. Taking it removes a recurring false signal: an
  intermittent 4-fail suite run on this repo traces to this race
  (a scratch-file ENOENT inside a walked tree), not to a regression. A third
  carry means a fourth.
  — **Reversibility:** reversible.

- **D-28:** **Two pending todos are folded; one is not.** The owner expressed
  no preference; this is **Claude's decision, recorded as such**:
  - **Folded — consolidate paths** (`D-33`): a consequence of `D-33`, not a
    choice.
  - **Folded — installer self-ignore its deployed `tools/`**: the migration
    moves deployed artifacts from `tools/` to `.c64-re-tools/bin/`, so leaving
    it out ships a half-rewritten gitignore story.
  - **NOT folded — reap vicerc scratch dirs**: a broker kill/recycle change
    this phase never opens, and `D-35` deliberately left retention policy to
    it.
  — **Reversibility:** reversible.

- **D-29:** **The `.d64` supersession decision gets a decisions doc AND
  in-place amendments.** `docs/phase40-preprocessing-tools-decisions.md`
  carries the decision and its measured reasoning (`c1541`'s per-SECTOR BAM,
  first T/S from `-entry`, real sector chains; the broker dependency accepted
  knowingly), and ROADMAP criterion 1 plus REQUIREMENTS line 109 are amended
  **in place with dated riders stating what changed and on what evidence**.
  Follows the project's own precedent: v0.8.0's eleven amended ids were dated
  and corrected in place, not deleted.
  — **Reversibility:** reversible.

### `cartconv` and `PREP-03` — removed (hard direction, 2026-09-08)

- **D-30:** **`cartconv` is NOT built and `PREP-03` leaves the roadmap.** A
  hard direction from the owner, given during this discussion. No cartridge
  work, no `cartconv.*` tool id, no per-bank images, no bank output contract.
  A plan that reaches for any of it is out of scope.
  — **Reversibility:** reversible — nothing is built, so re-adding it later
  costs only the requirement's reinstatement.

- **D-31:** **`PREP-03`'s disposition is Excluded, with a dated rider — not
  deleted.** Its line stays in REQUIREMENTS.md struck as removed with a rider
  saying it was dropped at the Phase 40 discussion on 2026-09-08 by owner
  decision, and a row is added to the Excluded table. Coverage becomes
  **19 total / 19 mapped / 0 unmapped**. Matches the amend-in-place
  convention; deleting it outright would leave the `20/20` claims as
  unexplained edits rather than dated corrections.

  MEASURED: `PREP-03` is referenced in exactly **six** places, all prose and
  tables — `REQUIREMENTS.md:56`, `:108`, `:137`, `:143`, `:148-149` and
  `ROADMAP.md:924`, `:929`, plus the `20/20` claims at `ROADMAP.md:16`,
  `:537`, `:1282`. **No code and no test pins the requirement count**, so the
  removal is bookkeeping, not a guard cascade.
  — **Reversibility:** reversible.

- **D-32:** **The new disk-access skill survives `cartconv`'s removal.**
  Scoped originally as `c1541` + `cartconv` "container access"; with
  `cartconv` gone the container theme collapses, but the skill is kept as a
  `c1541`-only disk-access skill. It is still where `d64-parse.mjs`'s
  replacement lands and still the boundary re-cut `D-19` approves. One new
  skill for disks instead of two for containers; the `petcat` skill is
  unaffected.
  — **Reversibility:** costly — see `D-17`.

### The `.c64-re-tools/` path consolidation

- **D-33:** **`.c64-re-tools/` is adopted now — all six writers, clean
  break.** This began as the answer to "where do bank images land" and
  **survives `cartconv`'s removal on its own merits** (`D-34`). One
  `toolsDir()` in `repo-root.ts` that the other four derive from; the todo's
  proposed layout:

  ```
  .c64-re-tools/
    supervisor/   # was .vice-supervisor/  (broker state, pool, epoch file)
    snapshots/    # was .vice-snapshots/   (.vsf + .json sidecars)
    bin/          # was tools/*.mjs, vice-launcher.sh, .vice-deployed.json
    runs/ghidra/  # was tools/ghidra-runs/
    incidents/    # was .planning/incidents/
    cache/        # was mcp-deps.lock.sha256
  ```

  **Clean break, already owner-confirmed at capture time (2026-09-07):**
  *"minor, but no support/fallback for the old structure."* No dual-read, no
  migration shim, no opt-back-in env var, no code looking for
  `.vice-supervisor/` if `.c64-re-tools/supervisor/` is absent. Old
  `.gitignore` stanzas are **removed**, not kept alongside. A pre-existing
  old-layout tree is ignored and left where it is; release notes tell people
  to delete it.

  **Operational note that intersects this host's setup:** any live broker
  started under the old layout **must be stopped before the upgrade** — the
  version boundary is not hot-swappable, because `.vice-supervisor/` is the
  rendezvous point between the container-side client and the host daemon.

  Sites the migration touches, from the todo's own constraint list:
  `repo-root.ts:186-189`, `stock-paths.ts:178-184`, `incident-record.ts:36`
  (+ its header comment about `.planning/incidents/README.md`),
  `install-resources.ts`, `ghidra-project.mts`, `vice-broker.mts:123` **and**
  its compiled `resources/vice-broker.mjs:83` (so `build.ts` must be re-run;
  `resources-sync.test.ts` fails CI on drift), `scripts/ensure-mcp-deps.sh`,
  `.gitignore` (collapses to a single `/.c64-re-tools/`), and `CLAUDE.md`'s
  configuration section. `host-scripts.test.ts`'s two-way `/tools/` parity
  gate matches on the literal prefix and moves with the artifacts — and the
  `ghidra-runs/` leading-slash `.gitignore` workaround can then be deleted
  outright, since scratch no longer shares a root with deployed artifacts.
  `VICE_POOL_DIR` / `VICE_EPOCH_FILE` / `VICE_SUPERVISOR_DIR` keep working and
  keep winning over the new default. Five test files pin the old literal:
  `containerpath.test.ts:55,112,117`, `repo-root.test.ts:246`,
  `host-tool.test.ts:1080`, `vice-proxy.test.ts:2963`.
  — **Reversibility:** one-way — it is a published-path change with no
  back-compat by explicit decision; a consumer who upgrades cannot go back
  without deleting state.

- **D-34:** **The migration stands on its own after `cartconv`'s removal.** It
  was chosen as a deliberate fold of the consolidate-paths todo, not as a
  means to a `cartconv` path. Its justification — six scattered write
  locations, ~40 lines of `.gitignore` explaining them, a consumer needing one
  directory to delete — is untouched. It simply no longer has a
  `runs/cartconv/` subdirectory.
  — **Reversibility:** see `D-33`.

- **D-35:** **No retention or cleanup policy is invented here.** Per-run
  directories accumulate exactly as `runs/ghidra/` does today; the single
  `.c64-re-tools/` root is what makes "delete it all" a one-line answer. A
  reaper would invent a retention policy no requirement asks for, and the
  general problem belongs with the vicerc-reaper todo (`D-28`).
  — **Reversibility:** reversible.

### Hard ordering constraints

- **D-36:** **CONTEXT.md states the ordering constraints the planner cannot
  infer**, and only those. Three, each with a named cause:
  1. **The `.c64-re-tools/` migration lands before anything writes new
     output**, so new writers are correct from their first commit.
  2. **The two deletions (`d64-parse.mjs`, `anno-d64.ts`) land LAST, and
     their branch is merged BY HAND** — `cleanup-wave` refuses any branch
     whose diff contains a deletion, unconditionally
     (`worktree-safety.cjs`'s cleanup-wave deletion check). This is stock GSD
     behaviour, not local policy, and is not a reason to disable isolation.
  3. **The ROADMAP / REQUIREMENTS amendments (`D-29`, `D-31`) go in a plan
     carrying `USE_WORKTREES_FOR_PLAN=false`** — worktree executors may not
     touch `ROADMAP.md`, and the commit strips it. `REQUIREMENTS.md` is
     unaffected by that carve-out, but the two edits belong together.

  Everything else about decomposition is Claude's discretion.
  — **Reversibility:** reversible.

### Claude's Discretion

The owner answered every question put to them except the todo-folding one
(`D-28`), which is recorded above as Claude's decision with its reasoning.

Everything not enumerated above is Claude's discretion: plan decomposition
beyond `D-36`'s three constraints, exact new-skill directory and script
names, the new skills' frontmatter description wording (subject to `D-19`'s
re-cut), test placement and naming, where the shape declarations physically
live inside `host-tool.mts`, the `runId` derivation, and how the
`D-25` live-gated corpus assertion is placed.

The three decisions most worth a second look before the first plan is
committed:

- **`D-04`/`D-08` together delete two source files, three prose-citing
  headers and one assertion about a header.** They reverse a locked ROADMAP
  criterion and put three live tests behind the broker. Every consequence
  above was measured and accepted in discussion, but this is the largest
  irreversible step in the phase.
- **`D-33`'s clean break has no back-compat by explicit decision.** A
  consumer who upgrades and dislikes it has no route back except deleting
  state. The owner confirmed "no support/fallback" at the todo's capture and
  again by choosing the full migration here.
- **`D-14`'s divergence from the ROADMAP note.** A planner reading the
  ROADMAP Notes bullet directly will see a version-probe requirement that
  the owner has dropped. It must not be re-added.

### Folded Todos

Two pending todos are folded into this phase's scope.

- **Consolidate all tool-written files under `.c64-re-tools`**
  (`.planning/todos/pending/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md`)
  — folded by `D-33`. Six writers each pick their own top-level location under
  the resolved project root, so a consumer using more than one tool gets five
  or six unrelated entries in their repo root, each needing its own
  `.gitignore` stanza (~40 lines today). Two are actively confusing rather
  than untidy: `tools/` mixes deployed program artifacts with runtime scratch
  (`ghidra-runs/`), and `.planning/incidents/` writes product output into the
  *consumer's* GSD planning tree.
- **`WR-03` — `host-tool.mts`'s "nothing throws" contract has two holes**
  (`.planning/todos/pending/2026-09-03-wr-03-host-tool-never-throws-contract-has-two-holes.md`)
  — folded by `D-26`. Already carries `resolves_phase: 40`.
- **Installer must self-ignore its deployed `tools/` in the consumer repo**
  (`.planning/todos/pending/2026-09-07-installer-must-self-ignore-its-deployed-tools-in-the-consumer-repo.md`)
  — folded by `D-28`, because `D-33` moves the very directory it is about.

**Both-directions guard on resolving any of them:**
`docs-deferred-ledger.test.ts` fails in **both** directions, so resolving a
todo requires moving its `STATE.md` Deferred Items row in the **same commit**
as moving the file to `.planning/todos/completed/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 40 entry at lines ~916-941: the goal, the
  `Depends on` line ("Nothing in this milestone"), four success criteria
  (criterion 3 is `cartconv`'s and is being removed per `D-30`/`D-31`;
  criterion 1 is being amended per `D-04`/`D-29`), and five Notes bullets —
  the seven-synchronized-edit-sites note, the `backend-detect.mts` version
  precedent, the mutating-verb evidence rule, the runtime-correlation
  exclusion, and the eligible carried `mkdtemp` fix. Also `:16`, `:537`,
  `:1282` carry the `20/20 requirements mapped` claims that `D-31` corrects.
- `.planning/REQUIREMENTS.md` — `PREP-01`..`PREP-04` at lines 54-57;
  the Excluded table at `:108-109` (bank-qualified addressing; the `.d64`
  parser supersession that `D-04` reverses); Traceability at `:135-138`;
  Coverage at `:143-149`; and Notes for the roadmapper at `:164-176`, which
  name the two "decisions to be reached and recorded".
- `.planning/STATE.md` — current position, milestone scope as decided at the
  v0.9.0 open, and the Deferred Items table whose rows `D-28`'s folds must
  move in the same commit as the todo files.

### The host-tool seam (this phase's integration surface)
- `src/mcp/vice/host-tool.mts` — THE authoritative module. Its header names
  the three things that may not be re-derived anywhere else and the
  prohibitions each guards. Specific sites: `HostToolId` / `HOST_TOOL_IDS` at
  `:139-148`; the seven-synchronized-edits note at `:129-138`;
  `HOST_TOOL_ARG_KEYS` at `:179`; `HOST_TOOL_PATH_ARG_KEYS` at `:252`;
  `HOST_TOOL_TIMEOUT_MS` at `:1324` and `DEFAULT_HOST_TOOL_TIMEOUT_MS` at
  `:1305`; `dxa.disassemble`'s output-decides-outcome precedent at
  `:1238-1241`; the log line at `:1566`; and `WR-03`'s two holes at
  `:1039-1040` and `:1117-1121`.
- `src/mcp/vice/host-tool-client.ts` — the container-side half. `:419-427` is
  the already-correct `.catch()` shape `D-26` must mirror rather than
  reinvent.
- `src/mcp/vice/host-tool.test.ts` — the both-directions census. `:1819` is
  the census header; `:1915` pins the declared path-key total at **17**, which
  `D-02`'s six new ids move.
- `src/mcp/vice/backend-detect.mts` — the `--help` probe precedent the
  ROADMAP names as the one to copy, and the memoise-once posture `D-15`
  follows (`:15-45`, `probeBackend()` at `:145`).
- `src/mcp/vice/capability-registry.ts` — the ONE place per-backend
  capability data lives; `check-skill-fork-honesty.mjs` derives its fork-only
  tool list from it, which is why `D-20` is safe.

### The code being replaced and deleted
- `src/skills/c64-ram-capture/scripts/d64-parse.mjs` — deleted by `D-04`. Its
  header states the works-with-nothing-running property; `parseBam()` at
  `:69`, `parseDirectory()` at `:124`, and the three fakery signatures at
  `:164-171` that `D-06` must port.
- `src/skills/c64-ram-capture/scripts/d64-parse.test.mjs` — the
  synthetic-plus-real fixture posture `D-25` references.
- `src/mcp/vice/anno-d64.ts` — deleted by `D-08`. Exports `sectorsPerTrack`,
  `tsToOffset`, `listEntries`, `extractEntry`, `assertPlainImage`. Its header
  (`:7-46`) records the deliberate-duplication decision and the inherited
  limits.
- `src/mcp/vice/module-classification.ts:405-418` — the registered entry with
  a pinned symbol-and-line reference to `anno-d64.ts`, plus `:696`'s consumer
  list. Both go red until updated.
- `src/skills/c64-ram-capture/SKILL.md` — `:18`, `:62`, `:81`, `:422` all cite
  `d64-parse.mjs`; rewritten by `D-19`.

### The path migration
- `.planning/todos/pending/2026-09-07-consolidate-all-tool-written-files-under-c64-re-tools.md`
  — the folded todo. Carries the current-locations table, the proposed layout,
  the owner's clean-break confirmation, and the full constraint list `D-33`
  reproduces.
- `src/mcp/vice/repo-root.ts` — owns `supervisorDir()`; gains the one
  `toolsDir()` the other four derive from (`:186-189`).
- `src/mcp/vice/stock-paths.ts:178-184`, `src/mcp/vice/incident-record.ts:36`,
  `src/mcp/vice/install-resources.ts`, `src/mcp/vice/ghidra-project.mts`,
  `src/mcp/vice/vice-broker.mts:123`,
  `src/mcp/vice/resources/vice-broker.mjs:83`,
  `scripts/ensure-mcp-deps.sh`, `.gitignore`, `CLAUDE.md` — the other writers
  and their docs.
- `src/mcp/vice/host-scripts.test.ts` — the two-way `/tools/` parity gate
  whose literal prefix moves with the deployed artifacts.

### Guards this phase must not red (and must re-run rather than assume)
- `scripts/check-no-skill-external-spawn.mjs` — SEAM-05's closing gate. Its
  header states the two-route scope (npm tarball AND plugin tree), the
  interpreter exemption for `process.execPath`, the no-allowlist discipline,
  and the concurrency warning about `packFiles()`. ROADMAP criterion 1
  requires its **planted-violation controls be re-run, not assumed still
  valid**.
- `src/mcp/vice/skill-external-spawn-gate.test.ts` — its companion test.
- `src/mcp/vice/skill-description-overlap.test.ts:309` — the "at least 6"
  relation-based assertion plus the pairwise overlap scoring `D-19` addresses.
- `scripts/check-skill-fork-honesty.mjs` — documentation honesty over
  first-party prose; `D-20` verified it does not fire here.
- `scripts/check-skill-tool-coverage.mjs`, `scripts/lib/skill-descriptions.mjs`
  — both carry "six skills" prose that `D-17` makes stale.
- `src/mcp/vice/resources-sync.test.ts` — fails CI on `.mts` → `resources/*.mjs`
  drift. Triggered by BOTH `D-26` (host-tool.mts) and `D-33`
  (vice-broker.mts).
- `scripts/check-npm-packages.mjs` — validates both tarballs' exact file sets;
  `:234` names `anno-d64.ts` in the packaged-import set.
- `docs-deferred-ledger.test.ts` — fails in both directions on todo
  resolution.
- Five files pinning the old path literal: `containerpath.test.ts:55,112,117`,
  `repo-root.test.ts:246`, `host-tool.test.ts:1080`,
  `vice-proxy.test.ts:2963`.

### Precedent for the decision record
- `.planning/milestones/v0.8.0-REQUIREMENTS.md` — how eleven amended
  requirement ids were corrected **in place with dated riders** rather than
  deleted. The pattern `D-29` and `D-31` follow.
- `docs/phase39-dual-channel-coexistence-gate-findings.md` — the
  machine-readable-verdict-in-a-findings-doc shape, for the decisions doc's
  format.

### Prior phase context
- `.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/39-CONTEXT.md`
  — the immediately prior phase. Its `<specifics>` carry the flag-order fact,
  the `/usr/bin` vs `/usr/local/bin` shadowing fact, and the
  throwaway-probes-are-evidence pattern `D-25` invokes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`host-tool.mts`'s six existing ids** are the template for all six new
  ones. `dxa.disassemble` is the closest analogue: fixed flags first in a
  fixed order, optional resolved paths next, input path last, stdout captured
  to one `outputs[]` path, and the FILE digested — **never the child's exit
  status**. Copy that branch's shape rather than inventing one.
- **`host-tool-client.ts:419-427`** — the correct never-reject `.catch()`
  shape. `D-26` mirrors it; `acme.mjs`'s `invokeSeam()` is the skill-side
  counterpart (*"Never rejects: a resolution failure, a spawn failure, or
  unparseable output all resolve to `{ ok: false, message }`"*).
- **`acme.mjs`** — the worked example of a skill script that reaches a host
  binary ONLY through the seam. Its header records what it used to do
  (`spawnSync("acme", …)` plus four fixed host-path probes) and why both are
  impossible from a container. The two new skills' scripts should copy its
  structure, including the WHAT-NOT-TO-DO block.
- **`d64-parse.mjs`'s CLI shape** — `<directory|bam> --image <path> [--json]`.
  `D-18`'s one-script-per-binary layout keeps this subcommand idiom even
  though the implementation moves to the seam.
- **`ghidra-project.mts`'s per-run directory convention** — the `runId`
  layout `.c64-re-tools/runs/ghidra/` inherits, and the pattern any future
  per-run output follows.
- **`backend-detect.mts`'s `HELP_FLAG_CANDIDATES` ladder** (`--help`, then
  `-help`, then `-?`, only on non-zero exit) — the shape of a probe that
  copes with tools disagreeing about their own flags. Relevant even though
  `D-14` drops version probing, because availability (`D-15`) still probes.

### Established Patterns
- **Single seam per concern.** Every cross-cutting responsibility has exactly
  one owning file; re-deriving it locally is a named anti-pattern. `D-10`
  follows it by putting the oracle in the seam, and `D-33` follows it by
  adding ONE `toolsDir()` the other writers derive from rather than letting
  callers join `.c64-re-tools` themselves.
- **Two-directional guards.** `test-gate`'s union, the deferred ledger, the
  resources sync, and `host-tool.test.ts`'s census all fail in both
  directions — each turns a half-finished bookkeeping edit into a red suite
  rather than a silent drift. `D-12` adds one more.
- **Output decides, exit status does not.** Already established by
  `dxa.disassemble`. `D-09`/`D-11` generalise it to two more binaries with
  fresh measured justification.
- **Structured "WHAT NOT TO DO" file headers naming the specific past
  mistake.** Every new module and script in this phase is expected to carry
  one; `D-14`'s divergence and `D-25`'s circularity are exactly the kind of
  thing those headers exist to record.
- **Throwaway probes are evidence, not deliverables** (Phases 23, 33, 39).
  `D-25` invokes it to author a fixture with verbs that never ship.
- **Amend in place with a dated rider, never delete.** v0.8.0's eleven
  corrected ids. `D-29` and `D-31` both follow it.
- **No inline byte payload on a host-tool response, at any result size.**
  `D-22` follows it even for a one-line BASIC stub.

### Integration Points
- Container-side skill script → `host-tool-client.ts` → broker control op
  `host_tool` → `host-tool.mts`'s `runHostTool()` → resolved absolute
  `c1541` / `petcat` path (derived from the resolved `x64sc`, `D-13`) →
  positive-shape oracle (`D-09`, host-side) → `{ ok, path, sha256,
  byteLength }` or `{ ok: false, reason }` back.
- `backend-detect.mts`'s resolved `x64sc` path → `D-13`'s sibling-binary
  derivation. This is a NEW dependency edge from the host-tool seam onto the
  backend detector.
- `repo-root.ts`'s new `toolsDir()` → the five other path-owning modules
  (`stock-paths.ts`, `incident-record.ts`, `install-resources.ts`,
  `ghidra-project.mts`, `vice-broker.mts`) → `hostpath.ts` /
  `containerpath.ts` on both sides of the bind mount.
- `c1541.entry` + `c1541.bam` outputs → the ported fakery detector (`D-06`) →
  the provenance consumers that read `suspicious` / `suspicious_reasons`
  today.
- `c1541.read` → the three live tests' `.prg` extraction, replacing
  `extractEntry()` (`D-08`).
- `petcat.decode` → the two new skills' scripts and `c64-program-recon`'s
  pointer at its "before disassembling anything" step.

</code_context>

<specifics>
## Specific Ideas

- **The measurements taken during this discussion are the phase's evidence
  base, and a researcher should not re-derive them.** All on this host,
  2026-09-08, against `/usr/bin` (stock VICE 3.9):
  - `c1541 -attach <img> -dir` → `OPENCBM: opening dynamic library
    libopencbm.so failed!` on **every** call, then the recognised/attached
    lines, then the directory, then `486 blocks free.`, then the detached
    line. **Exit 0.**
  - `c1541 -attach <img> -chain "*"` → a `(17, 0) -> (17,10) -> …` arrow
    chain terminated by a bare byte count (`-> 117`). **Exit 0.**
  - `c1541 -attach <img> -entry "*"` → the raw 32-byte directory entry as hex
    rows, then `Next directory T/S: 0/255`, `Type: 0x82: prg`,
    `T/S: 17/0,  178 blocks`, `Name: <hex>`, side-sector, `@`-replacement and
    GEOS fields. **This is the only route to first T/S.**
  - `c1541 -attach <img> -bam` → a **per-sector** grid, `*` = allocated,
    `.` = free, one row per track. Strictly finer than `d64-parse.mjs`'s
    per-track free counts.
  - `c1541 -attach /nonexistent.d64 -dir` → `cannot open file '<path>'` and
    `Error - Cannot open file '<path>'.` **Exit 0.**
  - `c1541 --version` → `Unimplemented version '-version'` /
    `command '-version' unrecognized.  Try 'help'`. **No version route.**
  - `petcat -2 fixtures/dxa/basic-stub.prg` → `;<path> ==0801==` then
    `   10 sys2064`. **The literal-`SYS` fast path is confirmed working.**
  - `petcat -2 <64 random bytes>` → the banner plus PETSCII junk. **Exit 0.**
  - `petcat -2 /nonexistent.prg` → `Can't open file`. **Exit 1 — the only
    non-zero exit any of these produces, and it covers ONE class.**
  - Both builds of all three binaries exist: `/usr/bin/` (30 Dec 2024, VICE
    3.9) and `/usr/local/bin/` (26 Aug 2026, fork). **Pitfall 11 is live.**
- **`cartconv`'s measured behaviour is recorded even though it is out of
  scope**, because it is the strongest argument for `D-09`'s positive-shape
  oracle and the reasoning must survive the tool's removal:
  `cartconv -f <non-cartridge>` produced **zero bytes and exit 0** — no error
  text at all, nothing for any phrase-matcher to catch. `cartconv --version`
  printed `Error: no output filename` **beside** `cartconv (VICE 3.9)`.
- **The `OPENCBM` line is the concrete reason a negative oracle is wrong
  here**, not a hypothetical. Any "stderr non-empty means failure" predicate
  fails every `c1541` call on this host.
- **`c1541` accepts multiple commands in one invocation**
  (`-attach X -dir -chain Y`). `D-01`'s per-capability ids deliberately do
  NOT exploit this — one id, one verb, one declared output shape.
- **The phase shrank during discussion and grew at the same time.** It lost
  `cartconv` and `PREP-03` entirely; it gained a full six-writer path
  migration, two deletions with a measured blast radius, two new skills, and
  two carried fixes. A planner should size it from the decisions, not from
  the ROADMAP's four criteria.

</specifics>

<deferred>
## Deferred Ideas

- **`cartconv` and all cartridge/bank work** — removed by owner direction
  (`D-30`), `PREP-03` excluded with a dated rider (`D-31`). Not deferred to a
  named phase; if it returns it returns as a new requirement.
- **Bank-qualified addressing as a modelled store feature** — carried
  unchanged from v0.8.0's exclusions, and moot for this phase now that
  `cartconv` is gone.
- **`c1541.extract` (whole-image extraction)** — declined by `D-07` in favour
  of the per-file `c1541.read`. No requirement asks for a bulk route.
- **Any mutating `c1541` verb on the shipped seam** (`-format`, `-write`,
  `-bwrite`, `-delete`) — declined by `D-03`. The ROADMAP's
  evidence-before-write clause stays on the record for whoever adds one.
  `D-25` uses mutating verbs once, outside the seam, as a throwaway.
- **Version probing for the host tools** — dropped by `D-14`. The ROADMAP
  Notes bullet asking for it is a live divergence, not a gap to close.
- **Runtime correlation of claimed vs. actually-read sectors** — needs
  drive-side checkpoints, the `device c:` `default_memspace` reset (Phase 41),
  and `Drive8TrueEmulation` plus a non-zero `Drive8Type`. The drive-side
  fastloader signal is deferred beyond this milestone.
- **A `petcat` BASIC dialect option** — declined by `D-24`; the target is
  fixed to C64 BASIC 2.0 everywhere in this project.
- **A retention or cleanup policy for per-run directories** — declined by
  `D-35`; belongs with the vicerc-reaper todo.
- **Whether `c64-ram-capture` should be renamed** now that it no longer owns
  `.d64` work — not raised, not decided. `D-19` only re-cuts its
  *description*.

### Reviewed Todos (not folded)

Ten todos matched Phase 40 in the cross-reference scan; three were folded
(see `<decisions>`), and seven were reviewed and left where they are:

- **Reap vicerc scratch dirs in broker kill/recycle path** (score 0.6) —
  explicitly declined by `D-28`. A broker kill/recycle change this phase never
  opens, and `D-35` deliberately routed retention policy to it.
- **BACK-05 D-G ordering test fails deterministically on a live-broker host**
  (score 0.6) — real and load-bearing for this phase's *practice* (a live
  broker reddens it deterministically, so stop the broker before trusting any
  suite result), but fixing the test is in no `PREP-*` requirement. Phases 33
  and 39 both declined it on this ground.
- **Correct the false real-corpus claim in `research/questions.md`**
  (score 0.6) — matched on keywords; `D-25` deliberately moves AWAY from
  corpus dependence.
- **Move all tests into a separate test folder** (score 0.6) — a tree-wide
  refactor. This phase adds tests in the existing colocated convention and
  must not be the wedge for changing it.
- **Remove pre-warm; launch VICE only on first request** (score 0.6) — a
  broker-lifecycle change; unrelated, though it touches the same
  `.c64-re-tools/supervisor/` tree `D-33` moves.
- **Phase 28 review: `in-02` fsync portability on Windows** (score 0.6) and
  **Phase 28 review round 3, five open findings** (score 0.6) —
  annotation-store review findings from v0.7.0; no relation to this phase's
  domain.

</deferred>

---

*Phase: 40-The Three Preprocessing Host Tools*
*Context gathered: 2026-09-08*
