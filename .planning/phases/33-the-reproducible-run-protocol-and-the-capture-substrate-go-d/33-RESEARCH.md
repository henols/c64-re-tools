# Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) - Research

**Researched:** 2026-09-02
**Domain:** VICE 3.9 launch determinism, the binary-monitor reset protocol, `.vsf` snapshot slicing, and a pre-committed decision gate
**Confidence:** HIGH for the substrate facts (live-measured against `/usr/bin/x64sc` VICE 3.9 this session); MEDIUM for the autostarted-release protocol (measured, but only in its *failing* configuration)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states, verbatim: *"Every decision below is **Claude's discretion** — the owner
answered 'you suggest' to the gray-area selection, which under the standing autonomy
preference is a delegation of the whole discussion, not a request for a narrower menu."*

All 29 decisions are therefore reproduced here as the phase's **working decisions**, not as
owner-locked constraints. They are binding on the planner unless this research explicitly
falsifies one (three are falsified below — see `## Decisions This Research Falsifies`).

**The gate (`GATE-01`)**
- **D-01**: The decision rules are plan `33-01`, and that plan touches nothing else. Every measuring plan comes after it. **Git history is the proof** — the rules commit precedes the first measurement commit and is checkable with `git log`; no test guard. *Reversibility: one-way.*
- **D-02**: The gate takes exactly five named, machine-readable inputs, four of which are measurable before any corpus exists: `SEED_EFFECT` (`pinned|partial|unpinned`, from `REPRO-01`), `JITTER_IMMUNITY` (`immune|partial|not-immune`, from `REPRO-02`), `ORACLE_NECESSITY` (`proven|unproven`, from `REPRO-03`), `SLICER` (`validated|failed`, from `CAP-01`+`CAP-02`), `C0_CAPTURE_PAIR` (`pass|fail|not-obtained`, from `CAP-04`). `not-obtained` is an **input value**, never a reason to abstain. *Reversibility: costly.*
- **D-03**: `could-not-run` is not an emittable verdict, asserted structurally. Accepted values are exactly `go`/`degrade`/`no-go`. *Reversibility: one-way.*
- **D-04**: `degrade` narrowing is pre-mapped for `C0_CAPTURE_PAIR` and `ORACLE_NECESSITY` only. `C0_CAPTURE_PAIR: not-obtained` → Phase 38 narrows to method-only, Phases 35/36/37 narrow to fixture-only, the `REPRO-*`/`CAP-01`/`CAP-02` substrate untouched. `ORACLE_NECESSITY: unproven` → the oracle narrows to `(PC, hit_count)` with the frame term recorded but not asserted. *Reversibility: costly.*
- **D-05**: The verdict is machine-readable frontmatter in `docs/phase33-reproducible-run-gate-findings.md` — `verdict:`, `verdict_rule_applied: R<N>`, plus all five `D-02` inputs reproduced verbatim. *Reversibility: reversible.*
- **D-06**: The verdict binds Phases 34-38 through ROADMAP `Depends on` + Notes + a STATE.md pointer, with no test guard. *Reversibility: reversible.*

**Evidence and the red controls**
- **D-07**: Each "observed red" control is a committed evidence transcript in the phase findings document, produced by a named repeatable script — not a test-suite assertion. *Reversibility: reversible.*
- **D-08**: `MANUAL_ONLY_TESTS` stays at exactly nine files. Default expectation: **zero** new entries. *Reversibility: costly.*
- **D-09**: Only two things become automated tests: `CAP-03`'s structural bar and `CAP-02`'s fail-ability over a synthetic pair. *Reversibility: reversible.*
- **D-10**: Evidence scripts live under the phase directory, not `src/`. Exceptions: the slicer and the predicate (`D-15`, i.e. `D-19`). *Reversibility: reversible.*
- **D-11**: Every live run is taken with the broker stopped, and each transcript records that fact alongside the `test:automated` baseline. *Reversibility: one-way.*

**The run-protocol surface**
- **D-12**: An optional boolean `reproducible` argument on `vice_run_until`, stock-only, defaulting to absent. `runReproducible()` in a new `src/mcp/vice/stock-reproducible-run.ts`, called from `stock-run-until.ts`. Fork does not advertise it. *Reversibility: costly.*
- **D-13**: A whole-procedure switch, never composable sub-flags. No `skip_reset`, no `no_anchor`, no `reset_only`. *Reversibility: one-way.*
- **D-14**: `reproducible: true` requires a sibling `frame_anchor` address and refuses when absent. *Reversibility: costly.*
- **D-15**: Warp and headless are an additive optional `profile` object on the broker's existing `acquire` op — `{op:"acquire", id, token, profile:{warp?:true, headless?:true}}`. An absent `profile` produces argv byte-identical to today's. *Reversibility: reversible.*
- **D-16**: A pre-warmed instance whose profile does not match is ineligible; the broker launches a dedicated instance and never retro-warps. *Reversibility: costly.*
- **D-17**: The stale warp sentence is re-grounded to say both things, and `docs/tool-support.md` is regenerated in the same commit. *Reversibility: reversible.*
- **D-18**: `probeReady`'s real-time timeouts are re-checked under warp in the same plan that adds the profile. *Reversibility: reversible.*

**The capture substrate**
- **D-19**: The `.vsf` slicer is `src/mcp/vice/vsf-slice.ts` with a thin wrapper under `src/skills/c64-ram-capture/scripts/`. It reads a file and spawns nothing. No host-tool seam needed. *Reversibility: reversible.*
- **D-20**: The slicer is not promoted to an MCP tool in this phase. *Reversibility: reversible.*
- **D-21**: The slicer locates `C64MEM` by walking the module table, never a fixed byte offset, and asserts the module body is exactly `4 + 65536` bytes, refusing otherwise. *Reversibility: costly.* **← FALSIFIED, see below.**
- **D-22**: The transient allow-list is a per-release committed JSON artifact under a committed size cap of **64 addresses**. Exceeding the cap is a hard failure that voids the derivation. *Reversibility: costly.*
- **D-23**: The derivation **method** carries forward, never an address set: N >= 3 runs, same release, same protocol, same stop; the allow-list is the union of addresses differing across the pairwise comparisons; re-derived per release. *Reversibility: costly.*
- **D-24**: The `$0000`/`$0001` overlay is normalised inside the predicate, in code, by substituting the snapshot's own 4-byte port/PLA prefix over RAM `$0000`/`$0001`. Explicitly not by allow-listing them. *Reversibility: reversible.* **← FALSIFIED in its field selection, see below.**
- **D-25**: The planted-byte control is asserted red twice: corpus-free in CI over synthetic fixture buffers, and corpus-bound as a transcript. *Reversibility: reversible.*
- **D-26**: `CAP-03`'s structural bar is an automated test — the predicate module never imports the oracle module, and the oracle's comparison function takes no image-buffer argument. Use `grep -a` for any census (`anno-memmap-render.ts` contains a NUL byte). *Reversibility: one-way.*
- **D-27**: Corpus is one operator-supplied real cracked release, `.d64` or `.prg`, identified by name **and sha256**, never committed. A second release is a stretch input. *Reversibility: reversible.*
- **D-28**: The main-CPU memspace assertion is proven able to refuse, by observation — a transcript of the assertion refusing after one deliberate drive checkpoint hit. *Reversibility: reversible.*
- **D-29**: The capture record gains `REPRO-04`'s key as three new rows in its Identity table — `binary sha256`, `argv digest`, `seed` — argv digest being sha256 over the exact spawn argv array joined by NUL. Template: `src/skills/c64-ram-capture/templates/capture-record.template.md`. *Reversibility: costly.*

### Claude's Discretion

All 29 decisions above. CONTEXT.md names the three most worth a second look before `33-01`
is committed:

- **D-04** (which two inputs get pre-mapped narrowing).
- **D-22** (the size cap of 64) — "The number is reasoned from a single measurement taken under different conditions. It is a pre-commitment, so it cannot be revised upward later without cost."
- **D-14** (refusing when `frame_anchor` is absent) — "the one decision that makes the tool harder to call, deliberately."

### Deferred Ideas (OUT OF SCOPE)

- **Absolute-cycle stop identity** — an optional strengthening of `REPRO-03` via `CPUHISTORY_GET` (0x86). Blocked by the VICE 3.10 floor; this host runs 3.9. `stopwatch` is excluded by name (owner decision 2026-09-02).
- **Promoting the `.vsf` slicer to an MCP tool** — decided against by `D-20`. Revisit once a second consumer exists.
- **A second corpus release** — a stretch input under `D-27`, not a requirement.
- **A test guard on the gate's downstream binding** — deliberately declined by `D-06`.
- Reviewed-but-not-folded todos (7): vicerc scratch-dir reaping; Phase 7 Pitfall 5 overgeneralisation; the `BACK-05` live-broker test defect; the false real-corpus claim in `research/questions.md`; the Ghidra headless wrapper proposal (`resolves_phase: 36`); Phase 28 `in-02` fsync portability; Phase 28 review round 3.
- Also out of scope for this phase: absolute cycle count, the text-monitor client, the accumulating runtime-evidence layer, any `DXA-*`/`GHID-*`/`OPC-*`/`AUTO-*` work, and the host-tool execution seam (Phase 34).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPRO-01 | Launch nondeterminism pinned on the stock branch — `-seed` plus three `raminit*` flags, after `-default`, fork argv byte-identical | **REPRODUCED LIVE** this session: two cold boots without the block differ at 1092/65536 bytes and 59/4080 over `$C000-$CFEF`; with the block, **0 of 4080** over that window. Root cause identified at source level: `RAMInitRandomChance` factory default is **10** (0.1% random bit flips). See `## Measured Evidence` M1-M3 and `## Common Pitfalls` P4 for a **fourth** nondeterminism source the four named flags do not cover |
| REPRO-02 | One named single-seam procedure with the monitor-issued hard reset inside it, reached through an optional argument on `vice_run_until` | **REPRODUCED LIVE over `-binarymonitor`**: jitter 0 / 1500 / 4000 ms all stopped byte-identically (identical sha256, 0 differing bytes in all three pairwise comparisons). The exact code seam, its argument-name guard and its `WHAT NOT TO DO` constraints are enumerated in `## Code Seams` |
| REPRO-03 | Stops certified by `(PC, hit_count, (LIN, CYC))` and nothing else, frame-anchor checkpoint supplying the frame term | Register catalog enumerated live: `53:LIN(16b) 54:CYC(16b) 3:PC(16b)`. `hit_count` is at `CHECKPOINT_INFO` body offset **13** (u32LE). All four terms measured identical across the three jitter runs. `$EA31` confirmed a viable once-per-frame anchor on the `danish` release *after* its load. See M4, M6 |
| REPRO-04 | Reproducibility key is `(binary sha256, argv digest, seed)` | Source-level mechanism for *why* argv order matters found and quoted: `main.c`'s early prefix scan `break`s at the first unrecognised option and **strips the handled prefix from argv**. `-seed` is honoured by two different code paths depending on position. See P1, P5 |
| REPRO-05 | Warp and headless additive launch knobs, `-default` at index 0 ahead of `-binarymonitor`, `probeReady` timeouts re-checked under warp | `-warp` MEASURED **behaviour-neutral** under the protocol (identical sha256 to the unwarped run). Headless route identified and measured: **`-console`**, which is *position-sensitive* — see P5, the highest-impact new constraint in this document |
| CAP-01 | Flat 64K sliced from the `.vsf` `C64MEM` module body, no transcription | Full module table of a genuine 3.9 snapshot enumerated (27 modules). `C64MEM` at offset 183, v0.1, module size 65577, **body 65555** — not 65540. First module offset is **58**, not 37. See M5, P2, P3 |
| CAP-02 | Enumerated transient allow-list under a size cap, `$0000`/`$0001` normalised in code | The correct normalisation source fields identified and measured (`dir_read`/`data_read`, in the 3-byte **suffix**, not the 4-byte prefix). The existing `compare.mjs` predicate's range-shaped volatile spans and one-bit-drift-passes rule are shown to be incompatible with `CAP-02`. See P3, P6 |
| CAP-03 | The captured 64K is never a conjunct of the stop-identity oracle | The two modules that must not be coupled are named, and the existing `anno-seam.test.ts` import-census pattern is the precedent to copy. See `## Architecture Patterns` Pattern 4 |
| CAP-04 | A real cracked release captured twice, autostarted, true drive emulation in the loop, wall-clock-anchoring negative control observed red | **The corpus is already on disk** (two gitignored `.d64` images, sha256s recorded). `Drive8TrueEmulation` MEASURED **= 1** under the existing argv. `AUTOSTART` (0xdd) MEASURED working on the real `.d64`. The wall-clock-anchoring negative control was **reproduced red this session** on a real autostarted release: same instruction `$EA31`, `LIN` 157 vs 136, 300 differing bytes. See M6, M7 |
| GATE-01 | Recorded go/degrade/no-go verdict against rules committed before any measurement | Four of the five `D-02` inputs are already measurable and three are effectively measured. `C0_CAPTURE_PAIR: not-obtained` is now **unlikely** — the corpus exists. See `## Open Questions` Q1 |
</phase_requirements>

---

## Summary

This phase's substrate is far better characterised than CONTEXT.md assumed, and three of its
29 decisions are wrong in ways that would have failed at execution time. Everything material
was re-measured this session against the real host binary — genuine stock **VICE 3.9** at
`/usr/bin/x64sc` — over the real `-binarymonitor` wire, with the broker stopped.

**The good news dominates.** `REPRO-02`'s reset protocol *does* reproduce over the binary
monitor: three runs with deliberate pre-protocol jitter of 0 / 1500 / 4000 ms produced one
identical 64K sha256, identical registers, identical `(PC, hit_count, (LIN, CYC))`. `-warp`
is behaviour-neutral under that protocol, to the byte. `REPRO-01`'s determinism block takes
the untouched `$C000-$CFEF` window from 59 differing bytes to **0**, and the source-level
reason is now known rather than inferred (`RAMInitRandomChance` ships at 10, i.e. 0.1% of all
bits randomly flipped at power-up). The `.vsf` module table walks cleanly and ends exactly at
the file length. The corpus `CAP-04` needs is already on disk, gitignored, with recorded
digests. `Drive8TrueEmulation` is already 1 under the argv the broker emits today.

**The bad news is concentrated in three decisions and one baseline.** `D-21`'s assertion that
the `C64MEM` body is "exactly `4 + 65536`" would refuse *every* real snapshot — the body is
**65555** bytes, because VICE writes seven more port fields and two DWORD falloff clocks
*after* the RAM array. `D-24`'s normalisation reads the wrong four bytes: the 4-byte prefix is
`(pport.data, pport.dir, EXROM, GAME)` — `data` first, so a naive prefix-over-RAM copy puts
the wrong byte at the wrong address — while the CPU-visible `$0000`/`$0001` values live in the
3-byte **suffix** after the RAM array. And the prototype slicer's `first_module_offset` of 37
is stale: it is **58** on 3.9, which the prototype survives only via a byte-by-byte resync loop
that could in principle lock onto a false `C64MEM` string inside RAM data. Separately, the
`test:automated` "clean floor of 0" that `D-11` instructs every transcript to record against
is **not true today**: the suite fails with 5 failing tests across 3 files on the current tree,
for reasons Phase 33 did not cause.

The one genuinely open risk is the **autostarted** stop. A wall-clock-anchored stop on a real
autostarted release was measured red exactly as the phase requires (same instruction, differing
`LIN`), which is the negative control in hand. But an anchor-counted variant that survives
`AUTOSTART`'s own power cycle was attempted once and did not produce a usable stop — that
sequencing is real design work for `runReproducible()`, not a research gap.

**Primary recommendation:** Build `runReproducible()` around the exact, live-verified sequence
*connect → arm anchor while halted → `RESET 1` → single `EXIT` → wait on `CHECKPOINT_INFO`
`hit_count` at body offset 13*, emit the determinism block plus `+autostart-delay-random`
unconditionally on the stock branch with `-console` (when headless) at argv index 1, and write
`vsf-slice.ts` against `first_module_offset = 58` and a body length of `4 + 65536 + 3` **at
minimum** rather than `4 + 65536` exactly.

---

## Decisions This Research Falsifies

Three working decisions are contradicted by measurement. Each is a cheap fix if caught in
planning and an expensive one if caught in execution.

| Decision | What it says | What is true | Cost if unfixed |
|---|---|---|---|
| **D-21** | "asserts the module body is exactly `4 + 65536` bytes, refusing otherwise" | The `C64MEM` body is **65555** bytes on VICE 3.9 (`4 + 65536 + 3 + 4 + 4 + 4`). `4 + 65536` = 65540 | The slicer refuses **every** real snapshot. `SLICER: failed`, and the gate's most easily-earned `go` input is lost to an arithmetic error |
| **D-24** | "substituting the snapshot's own 4-byte port/PLA prefix over RAM `$0000`/`$0001`" | The prefix is `(pport.data, pport.dir, EXROM, GAME)`. MEASURED `prefix=[231,47,0,0]`. The CPU-visible values are `dir_read`/`data_read` in the **3-byte suffix**: MEASURED `suffix3=[39,55,47]`, and the live register read gave `$00=47 $01=55` | Normalisation writes `pport.data` (231) to `$0000` and `pport.dir` (47) to `$0001` — both wrong, both silently. A "normalised" image that differs from the CPU view at exactly the two addresses the normalisation exists to fix |
| **CONTEXT.md `## Existing Code Insights`** | "`compare.mjs` … Its existing volatile / drift / divergence classification is the shape `CAP-02`'s verdict should keep" | `compare.mjs`'s volatile set is four **ranges** covering 4866 addresses, and its drift rule lets *any* single-bit difference pass anywhere. `CAP-02` requires an **enumerated** list, "never a range" | `D-25`'s planted-byte control passes trivially: plant a one-bit difference and the predicate says PASS. The fail-ability guard becomes vacuous |

A fourth item is not a falsification but a correction of scope:

| Claim | Where | Correction |
|---|---|---|
| "The three whole-argv `assert.deepEqual` assertions in `broker-launch.test.ts` are **avoidable**" | ROADMAP Notes; echoed by `D-15` | There are **five** stock whole-argv `assert.deepEqual(args, …)` assertions (lines 1775, 1789, 1907, 1919, 1929), and they are **not** avoidable: `REPRO-01`'s determinism block is unconditional on stock, so all five change. Only the *`profile`* half of `D-15` is avoidable. The three *ordering* assertions (index 0, `-drive8type` < `-binarymonitor`, `1541` immediately after `-drive8type`) do survive additions, exactly as written |
| "The clean floor for `test:automated` is **0** failures" | ROADMAP Notes; `D-11` | MEASURED 2026-09-02 on the current tree with the broker stopped: **EXIT=1, 5 failing tests in 3 files**, none caused by this phase. See P8 |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Launch nondeterminism pinning (`-seed`, `raminit*`, `+autostart-delay-random`) | Host broker daemon (`broker-launch.mts`, `buildViceArgs()`) | — | These are *launch-time* flags; nothing after `execve` can set them. Only the broker spawns the emulator |
| Warp / headless profile selection | Host broker daemon (`broker-launch.mts` + `broker-control.mts` acquire) | Container-side broker client (`vice-broker-client.ts`) threads the request | Warp is a per-instance property fixed at spawn; the container side can only *ask* |
| Warm-instance profile eligibility | Host broker daemon (`vice-broker.mts` `selectWarmInstance()`) | — | Eligibility is a property of the pool, and the pool lives host-side |
| The reproducible-run procedure (reset + anchor + wait) | Container-side MCP server (`stock-reproducible-run.ts`) | Emulator (executes) | It is a *sequence of monitor commands*; the one place that speaks the binmon wire is container-side |
| Stop-identity oracle `(PC, hit_count, (LIN, CYC))` | Container-side MCP server (`stock-registers.ts` / `stock-timing.ts` read; new oracle module compares) | — | Pure arithmetic over wire replies. Must **not** import the capture predicate (`CAP-03`) |
| `.vsf` → flat 64K slice | Container-side module (`vsf-slice.ts`) | Skill script wrapper | Reads a file already at a container-visible path via `snapshotPathFor()`. Spawns nothing, so no host-tool seam |
| Equivalence predicate + transient allow-list derivation | Container-side module + skill script | — | Pure arithmetic over two buffers plus a committed JSON artifact |
| The go/degrade/no-go verdict | Planning artifact (`docs/phase33-…-findings.md` frontmatter) | ROADMAP + STATE.md pointers | Deliberately *not* code (`D-06`): a roadmap-policy guard in a product test suite is the wrong tier |
| Corpus supply and identification | Operator (out of tree, gitignored) | Capture record (`D-29` sha256 rows) | `D-27`: never committed. Identity travels as a digest, not as bytes |

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance with. All are load-bearing for this phase.

**Hard architectural rules**
- **Single seam per concern.** Re-deriving a cross-cutting seam locally is a named anti-pattern. `runReproducible()` and the port normalisation both must be one owning site.
- **Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`.** The host-path consumer set is *closed* to five production modules (`containerpath.ts`, `install-resources.ts`, `stock-paths.ts`, `vice-proxy.ts`, `vice-sync.ts`), pinned by `hostpath-consumers.test.ts`. **`vsf-slice.ts` must not import `hostpath.ts`** — it receives an already-translated container path from `snapshotPathFor()`.
- **The broker's single-owner `inFlight` launch guard must stay a synchronous check-and-set with no `await` between.** `D-16`'s eligibility check sits inside the acquire path this guard protects. Regression-tested; exists because of the 2026-08-01 triple-launch outage.
- **Derived tools must be intercepted before `forwardToVice()`, not behind `call()`** (MCP-02). Not reached by this phase — `vice_run_until` is a stock-dispatch tool, and the slicer is not a tool at all (`D-20`).
- **Node ≥ 24, native type-stripping, no build step for the shipped server.** Host-bound `.mts` files must be compiled by `build.ts` into committed `resources/*.mjs`; `resources-sync.test.ts` fails CI on drift. `build.ts`'s `HOST_BOUND_ARTIFACTS` is a fixed eight-entry list and **throws** on an unlisted host-bound `.mts`.
- **`vice-sync.ts`'s checkpoint-wait invariants must be preserved in stock-native form:** exactly one resume per wait; poll on `hit_count`, never on paused state.

**Protocol facts this phase depends on**
- 11-byte request header / 12-byte response header, all multi-byte values little-endian.
- **Five** unsolicited message types arrive at request-id `0xffffffff`: `STOPPED` (0x62), `RESUMED` (0x63), `JAM` (0x61), `CHECKPOINT_INFO` (0x11), `REGISTER_INFO` (0x31). The last two **share a response type with a legitimate command reply** — demux must key on request-id and never resolve a pending request with an event. *(Independently re-observed this session: the connect handshake alone emitted `0x31` then `0x62`, both at `0xffffffff`.)*
- `JAM` (0x61) has a **zero-length body**.
- A non-stopping checkpoint emits a `CHECKPOINT_INFO` per hit **synchronously from inside the CPU loop**.
- Stock's binary monitor services **exactly one client**. A second `connect()` sits unserviced with no reply and no EOF.
- **`default_memspace` contamination has no remedy over the binary monitor** (`monitor.c:3393-3396`). Reachable here because true drive emulation is in the loop.
- The wire memspace byte is **not** the internal enum: `0x00` = main, `0x01`–`0x04` = units 8–11. `0x08` is rejected.
- Conditions use `RL`/`CY` (uppercase), have **no operator precedence**, and bare integer literals are **hex**.
- **Three resources power-cycle the machine one call deep** — `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency`. Any resource-set tool exposed to an LLM must deny these.
- **`-default` must precede `-binarymonitor`** or the monitor never binds. *(Now explained at source level — see P1.)*
- SID `$D400–$D418` read-back and the matrix keyboard are unrecoverable on stock.

**Workflow rules**
- GSD worktree isolation is **on** (stock). A plan delivering `STATE.md`/`ROADMAP.md` content gets `USE_WORKTREES_FOR_PLAN=false`. `cleanup-wave` refuses any branch whose diff contains a deletion.
- GSD is a vendored, gitignored install carrying **zero** local customisations. Never edit a file under the vendored tree.
- `build_command`: `cd src/mcp/vice && npm run typecheck`. `test_command`: `cd src/mcp/vice && npm run test:automated`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` / `node:crypto` / `node:net` / `node:child_process` | Node ≥ 24 built-ins | `.vsf` reading, sha256 digests, binmon socket, emulator spawn | The container-side server has **zero third-party runtime dependencies** by policy. `stock-schema-check.ts`'s header states this explicitly and names the "pull in `ajv`" alternative as the over-engineering the posture argues against [VERIFIED: src/mcp/vice/stock-schema-check.ts:4-13] |
| `node:test` | Node ≥ 24 built-in | The two new automated tests (`D-09`) | No separate framework; `npm test` is `node --test '*.test.*'` and the automated subset is `node test-gate.mjs` [VERIFIED: src/mcp/vice/test-gate.mjs:1-3] |
| stock VICE `x64sc` | **3.9** at `/usr/bin/x64sc` | The emulator under measurement | `x64sc --version` → `x64sc (VICE 3.9)` [VERIFIED: live probe 2026-09-02]. GTK3 UI build (`ldd` shows `libgtk-3.so.0`, no SDL) [VERIFIED: live probe] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/mcp/vice/stock-protocol.ts` | in-tree | The **one** place that frames and demultiplexes the binmon wire | Always. Never hand-assemble a request body — `checkpointSetBody`, `cpNumBody`, `dumpBody`, `resetBody` already exist [VERIFIED: src/mcp/vice/stock-protocol.ts:381-598, 876-898] |
| `src/mcp/vice/stock-timing.ts` | in-tree | `registerCatalogFor()`, `readCycleBaseline()`'s `frame_position` route | For `LIN`/`CYC`. It already refuses when a build enumerates neither by name, and documents that `LIN`/`CYC` are exact only within one frame [VERIFIED: src/mcp/vice/stock-timing.ts:268-330] |
| `.planning/phases/23-…/evidence/vsf-ram-extract.mjs` | in-tree (evidence) | The already-validated slicer prototype | **Read it before writing `vsf-slice.ts`**, but do not port its `first_module_offset` (see P2) |
| `src/skills/c64-ram-capture/scripts/compare.mjs` | in-tree | `digest` / `compare` / `floor` verbs | Reuse the *reporting vocabulary* and the `digest` verb. Do **not** inherit its volatile ranges or its drift rule (P6) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `-console` for headless | `Xvfb` / `xvfb-run` | `xvfb-run` is **not installed** on this host [VERIFIED: `command -v xvfb-run` empty]. `-console` is in-binary, needs nothing installed, and was measured to bind the monitor with `DISPLAY` and `WAYLAND_DISPLAY` both unset |
| `-console` for headless | A VICE headless build (`USE_HEADLESSUI`) | Would mean building VICE — the exact dependency this milestone exists to avoid. `main.c:191-193` shows `default_settings_requested` is `#ifndef USE_HEADLESSUI`, so a headless build also changes `-default`'s behaviour [CITED: vice-3.8/src/main.c:191-193] |
| A frame anchor at `$EA31` | `RL`/`CY` checkpoint conditions | Conditions have **no operator precedence** and bare literals are hex — a two-term condition is a documented trap. An exec checkpoint plus `hit_count` needs no condition at all |
| Absolute cycles for the frame term | `CPUHISTORY_GET` (0x86) | Requires VICE ≥ 3.10; this host is 3.9. Deferred with a named trigger |

**Installation:** none. This phase adds **no external package** to either `package.json`.

**Version verification:** `npm view` / `pip index` / `cargo search` not applicable — no package is added.

---

## Package Legitimacy Audit

**Not applicable to this phase.** No external package is installed by any requirement in
`REPRO-01`..`REPRO-05`, `CAP-01`..`CAP-04` or `GATE-01`. The container-side server's
zero-third-party-runtime-dependency posture is enforced by policy and by
`stock-schema-check.ts`'s existence as a hand-rolled alternative to `ajv`.

- **Packages removed due to [SLOP] verdict:** none
- **Packages flagged as suspicious [SUS]:** none

If a plan proposes adding any package, it must run the legitimacy gate first and it must
justify the departure from the zero-dependency posture, which is a documented project
constraint rather than an accident.

---

## Measured Evidence

Everything in this section was produced on this host on 2026-09-02, against genuine stock
VICE 3.9 (`/usr/bin/x64sc`), with **no broker running** (`pgrep -af "vice-broker|x64sc"`
empty, `systemctl --user is-active vice-broker` → `inactive`). Probe scripts are in the
session scratchpad; a plan that wants them as committed evidence should re-author them under
the phase directory per `D-10`.

### M1 — The four flags are accepted, and `-console`/`+autostart-delay-random` exist

`/usr/bin/x64sc -help` output, verbatim entries [VERIFIED: live probe 2026-09-02]:

```
-console
	Console mode (for music playback)
-seed <value>
	Set random seed (for debugging)
-warp
	Initially enable warp mode
+warp
	Do not initially enable warp mode (default)
-raminitstartrandom <num of bytes>
-raminitrepeatrandom <num of bytes>
-raminitrandomchance <value>
-autostart-delay-random
	Enable random initial autostart delay.
+autostart-delay-random
	Disable random initial autostart delay.
-autostart <Name>
	Attach and autostart tape/disk image <name>
-default
	Restore default settings
-limitcycles <value>
	Specify number of cycles to run before quitting with an error.
```

### M2 — Resource defaults under `-default -drive8type 1541`, read over `RESOURCE_GET` (0x51)

[VERIFIED: live probe 2026-09-02, genuine stock 3.9, `RESOURCE_GET` replies]

| Resource | Value | Consequence |
|---|---|---|
| `Drive8TrueEmulation` | **1** | `CAP-04`'s "true drive emulation in the loop" is already satisfied by today's argv. `broker-launch.mts`'s Assumption A3 note holds on this build |
| `Drive8Type` | **1541** | The `-drive8type 1541` fix is effective |
| `AutostartDelayRandom` | **1** | **A nondeterminism source the four named flags do not cover.** See P4 |
| `AutostartDelay` | 0 | Uses the compiled-in default seconds |
| `RAMInitRandomChance` | **10** | 0.1% of all RAM bits randomly flipped at power-up. This is the dominant term `REPRO-01` removes |
| `RAMInitStartRandom` | 0 | Already the default; the flag is defensive against a `vicerc` |
| `WarpMode` | **`err=0x01` OBJECT_MISSING** | **There is genuinely no runtime `WarpMode` resource on stock 3.9.** `D-17`'s re-grounding is correct on this half |
| `VirtualDevice8` | 0 | Present on 3.9 |
| `TrapDevice8` | **`err=0x01` OBJECT_MISSING** | Confirms the rename direction: 3.9 has `VirtualDevice8`, not `TrapDevice8` |

### M3 — `REPRO-01` reproduced over `-binarymonitor`

Two cold boots each, `RESET 1` then a 4000 ms wall-clock wait then `DUMP`, `C64MEM` RAM sliced
and compared [VERIFIED: live probe 2026-09-02]:

```
NOSEED_DIFF_TOTAL_64K   1092
NOSEED_DIFF_C000_CFEF   59 of 4080   first=$c025 $c094 $c169 $c1b7 $c22c $c245 $c26e $c2a9
BLOCK_DIFF_TOTAL_64K    1242         first=$0003 $0004 $0005 $0006 $0007 $0008 $000d $0016
BLOCK_DIFF_C000_CFEF    0 of 4080
```

`REPRO-01`'s measurement (67 of 4080 → 0) is reproduced in shape and magnitude (59 → 0). Note
the second row: **with the block fully applied, the whole 64K still differs at 1242 bytes**,
starting in zero page — because that stop was wall-clock-anchored. Pinning launch
nondeterminism is necessary and *not* sufficient; the reset protocol plus a frame anchor is
what closes the remaining 1242. This pair is itself a usable transcript for
`REPRO-01`'s red control **and** a second instance of the wall-clock-anchoring control.

### M4 — `REPRO-02` reproduced over `-binarymonitor`, jitter-immune

Protocol per run, exactly `REPRO-02`'s stated order: launch with the determinism block →
free-run for `3000 + J` ms → connect (which halts) → `CHECKPOINT_SET` exec at `$EA31`
stop=true while halted → `RESET` hard (`0xcc`, body `[0x01]`) → **one** `EXIT` (`0xaa`) →
wait for that checkpoint's `CHECKPOINT_INFO` → `REGISTERS_GET` → `DUMP`
[VERIFIED: live probe 2026-09-02]:

```
RUN j0     jitter=0     bodyLen=65555 prefix=[231,47,0,0] suffix3=[39,55,47] sha=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN j1500  jitter=1500  bodyLen=65555 prefix=[231,47,0,0] suffix3=[39,55,47] sha=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
RUN j4000  jitter=4000  bodyLen=65555 prefix=[231,47,0,0] suffix3=[39,55,47] sha=0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b
PAIR j0 vs j1500: diffs=0
PAIR j0 vs j4000: diffs=0
PAIR j1500 vs j4000: diffs=0
```

Registers identical in all three runs: `PC=$ea31 LIN=257 CYC=57 $00=47 $01=55 A=0 X=249 Y=132 SP=249 FL=7`,
and `hit_count = 1` at all three. That is `REPRO-03`'s exact triple `(PC, hit_count, (LIN, CYC))`
measured identical under the protocol at three jitter values.

**`-warp` added to the same argv reproduces the identical sha256 `0999713e…` and identical
registers** — `REPRO-05`'s behaviour-neutrality claim, confirmed over binmon.

Register catalog from `REGISTERS_AVAILABLE` (0x83) on this build, verbatim:

```
3:PC(16b) 0:A(8b) 1:X(8b) 2:Y(8b) 4:SP(8b) 55:00(8b) 56:01(8b) 5:FL(8b) 53:LIN(16b) 54:CYC(16b)
```

### M5 — The real `.vsf` layout on VICE 3.9

Header hexdump of a genuine 3.9 snapshot [VERIFIED: live probe 2026-09-02]:

```
00000000: 5649 4345 2053 6e61 7073 686f 7420 4669  VICE Snapshot Fi
00000010: 6c65 1a02 0043 3634 5343 0000 0000 0000  le...C64SC......
00000020: 0000 0000 0056 4943 4520 5665 7273 696f  .....VICE Versio
00000030: 6e1a 0309 0000 0000 0000 4d41 494e 4350  n.........MAINCP
00000040: 5500 0000 0000 0000 0000 0104 7d00 0000  U...........}...
```

Decoded, byte-exact:

| Offset | Size | Field | Value in this file |
|---:|---:|---|---|
| 0 | 19 | magic `"VICE Snapshot File\x1a"` | `SNAPSHOT_MAGIC_LEN 19` [CITED: vice-3.8/src/snapshot.c:64,67] |
| 19 | 1 | snapshot major | `0x02` |
| 20 | 1 | snapshot minor | `0x00` |
| 21 | 16 | machine name, NUL-padded | `"C64SC"` — `SNAPSHOT_MACHINE_NAME_LEN 16` [CITED: vice-3.8/src/snapshot.h:33] |
| 37 | 13 | version magic `"VICE Version\x1a"` | `SNAPSHOT_VERSION_MAGIC_LEN 13` [CITED: vice-3.8/src/snapshot.c:65,68] |
| 50 | 4 | VICE version bytes | `03 09 00 00` → 3.9.0.0 |
| 54 | 4 | SVN revision (u32LE) | `0` |
| **58** | — | **first module offset** | `"MAINCPU"` starts here |

Module header is 22 bytes: `name(16, NUL-padded) major(1) minor(1) size(u32LE)`, and `size`
covers the **whole module including its own 22-byte header**
[CITED: vice-3.8/src/snapshot.c:693-701].

Full module table of that snapshot, walked strictly with no resync, ending exactly at the
file length of 193261 [VERIFIED: live probe 2026-09-02]:

```
off=58     name=MAINCPU      v=1.4 size=125    body=103
off=183    name=C64MEM       v=0.1 size=65577  body=65555
off=65760  name=C64CART      v=0.1 size=23     body=1
off=65783  name=CIA1         v=2.5 size=99     body=77
off=65882  name=CIA2         v=2.5 size=99     body=77
off=65981  name=SID          v=1.5 size=58     body=36
off=66039  name=SIDEXTENDED  v=1.4 size=155    body=133
off=66194  name=DRIVE8       v=2.0 size=167    body=145
off=66361  name=DRIVE9       v=2.0 size=167    body=145
off=66528  name=DRIVE10      v=2.0 size=167    body=145
off=66695  name=DRIVE11      v=2.0 size=167    body=145
off=66862  name=DRIVECPU0    v=1.3 size=2174   body=2152
off=69036  name=1541VIA1D0   v=2.2 size=50     body=28
off=69086  name=VIA2D0       v=2.2 size=50     body=28
off=69136  name=FSDRIVE      v=0.0 size=280    body=258
off=69416  name=VIC-II       v=1.3 size=123437 body=123415
off=192853 name=GLUE         v=1.0 size=25     body=3
off=192878 name=C64MEMHACKS  v=0.0 size=23     body=1
off=192901 name=TAPEPORT     v=1.0 size=24     body=2
off=192925 name=DATASETTE    v=1.5 size=100    body=78
off=193025 name=KEYBOARD     v=1.1 size=118    body=96
off=193143 name=JOYPORT0     v=0.0 size=23     body=1
off=193166 name=JOYSTICK0    v=1.2 size=24     body=2
off=193190 name=JOYPORT1     v=0.0 size=23     body=1
off=193213 name=JOYSTICK1    v=1.2 size=24     body=2
off=193237 name=USERPORT     v=1.0 size=24     body=2
end off 193261 (== file length)
```

The `C64MEM` body layout, quoted verbatim from the source comment
[CITED: vice-3.8/src/c64/c64memsnapshot.c:180-198]:

```
   type  | name                | version | description
   ---------------------------------------------------
   BYTE  | pport data          |   0.0+  | CPU port data register
   BYTE  | pport dir           |   0.0+  | CPU port direction register
   BYTE  | EXROM               |   0.0+  | EXROM line state
   BYTE  | GAME                |   0.0+  | GAME line state
   ARRAY | RAM                 |   0.0+  | 65536 BYTES of RAM data
   BYTE  | pport data out      |   0.0+  | CPU port data out lines state
   BYTE  | pport data read     |   0.0+  | CPU port data in lines state
   BYTE  | pport dir read      |   0.0+  | CPU port direction in lines state
   DWORD | pport bit6 clock    |   0.1   | CPU port bit 6 falloff clock
   DWORD | pport bit7 clock    |   0.1   | CPU port bit 7 falloff clock
   BYTE  | pport bit 6         |   0.1   | CPU port bit 6 state
   BYTE  | pport bit 7         |   0.1   | CPU port bit 7 state
   BYTE  | pport bit 6 falloff |   0.1   | CPU port bit 6 discharge flag
   BYTE  | pport bit 7 falloff |   0.1   | CPU port bit 7 discharge flag
```

`4 + 65536 + 3 + 4 + 4 + 4 = 65555` — matching the measured `body=65555` exactly, at
`SNAP_MAJOR 0 / SNAP_MINOR 1` [CITED: vice-3.8/src/c64/c64memsnapshot.c:200-202].
`C64_RAM_SIZE` is `0x10000` [CITED: vice-3.8/src/c64/c64mem.h:36].

The reader accepts minor 0 too, in which case the four trailing fields are absent and the body
is `4 + 65536 + 3 = 65543` [CITED: vice-3.8/src/c64/c64memsnapshot.c:267-292].

### M6 — The wall-clock-anchoring negative control, on a real autostarted release, RED

`danish.d64` (sha256 `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5`),
autostarted over `AUTOSTART` (0xdd) with `-drive8type 1541`, then a **20-second wall-clock
wait**, then an `$EA31` anchor armed and counted to 400 hits
[VERIFIED: live probe 2026-09-02]:

```
RUN auto-j0     jitter=0     asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=157 CYC=18 $00=47 $01=55 sha=dc0fe351…
RUN auto-j2500  jitter=2500  asErr=0 cpErr=0 hits=400 PC=$ea31 LIN=136 CYC=37 $00=47 $01=55 sha=8b951862…
PAIR diffs=300  first=$0001 $00a2 $00a4 $00ae $00af $01f1 $01f2 $01f3 $2f5f $2f60 $2f61 $2f62 $2f63 $2f64 $2f65 $2f66 $2f67 $2f68 $2f69 $2f6a
```

**Same instruction (`$EA31`), same `hit_count` (400), differing `LIN` (157 vs 136)** — the
exact failure signature `CAP-04` requires observed red, reproduced on a real cracked release
with true drive emulation in the loop. The divergence set is structurally informative: `$0001`,
the jiffy clock and load pointers (`$00A2`, `$00A4`, `$00AE`, `$00AF`), dead stack
(`$01F1`–`$01F3`), and a contiguous run from `$2F5F` — a load still in progress.

Two riders that de-risk the phase:
- `AUTOSTART` (0xdd) on a real `.d64` returns `err=0x00` and the release loads. `mon_autostart` → `reboot_for_autostart` → `machine_trigger_reset(MACHINE_RESET_MODE_POWER_CYCLE)` [CITED: vice-3.8/src/autostart.c:1437], so **`AUTOSTART` itself power-cycles**.
- `$EA31` is **still executing after the load on `danish`** (400 hits reached), so the KERNAL IRQ is a viable frame anchor for this release at this point in the run. Do not generalise it: `D-14`'s refusal-when-absent stands.

**300 differing addresses is 4.7× `D-22`'s cap of 64.** Under `D-22` this derivation is
correctly *voided* rather than tolerated. That is the cap working as designed, and it means
the cap of 64 is a real gate on frame-exactness, not a formality.

### M7 — The corpus already exists on disk

[VERIFIED: `git ls-files` + `git check-ignore -v` + `sha256sum`, 2026-09-02]

```
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64   174848 bytes
  sha256 1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5
.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/saeger.d64   174848 bytes
  sha256 b45e53e602fe94654934beffaa483f59989a6d3973ef054afaeea4ea4bc2b8f5
```

Both are **gitignored** (`corpus/.gitignore:13` = `*.d64`) and correctly untracked — `git
ls-files` on that directory returns only `.gitignore` and `corpus-intake.txt`. `D-27`'s "never
committed" rule holds, and `D-27`'s "one operator-supplied release" is conservative: **two**
are present, so `D-23`'s cross-release method claim is exercisable and the "stretch input" is
already in hand.

---

## Architecture Patterns

### System Architecture Diagram

```
                                 ┌───────────────────────────────────────┐
  Claude session                  │  CONTAINER SIDE (Node ≥ 24, no build) │
       │                          │                                       │
       │ tools/call               │  ┌─────────────────┐                  │
       ▼                          │  │  vice-proxy.ts  │ stdio MCP entry  │
  ┌─────────┐   stdio JSON-RPC    │  └────────┬────────┘                  │
  │  MCP    ├─────────────────────┼──────────►│ stock-dispatch.ts         │
  │ client  │                     │           ▼                           │
  └─────────┘                     │  ┌──────────────────┐                 │
                                  │  │ stock-run-until  │◄─ reproducible? │
                                  │  │  handleRunUntil  │   + frame_anchor│
                                  │  └────────┬─────────┘                 │
                                  │      NEW  ▼                           │
                                  │  ┌──────────────────────────┐         │
                                  │  │ stock-reproducible-run   │         │
                                  │  │      runReproducible()   │         │
                                  │  │  1 arm anchor (halted)   │         │
                                  │  │  2 arm target (halted)   │         │
                                  │  │  3 RESET hard (0xcc/1)   │         │
                                  │  │  4 EXIT  ── exactly once │         │
                                  │  │  5 wait CHECKPOINT_INFO  │         │
                                  │  │     on hit_count @ +13   │         │
                                  │  │  6 REGISTERS_GET → triple│         │
                                  │  └────────┬─────────────────┘         │
                                  │           │ stock-protocol.ts         │
                                  │           │ (the ONE wire seam)       │
                                  │  ┌────────▼─────────┐                 │
                                  │  │ vice-broker-     │  acquire        │
                                  │  │ client.ts        │  + profile{}    │
                                  │  └────────┬─────────┘                 │
                                  └───────────┼───────────────────────────┘
                                              │ newline-delimited JSON
                                              │ over TCP control plane
  ┌───────────────────────────────────────────▼───────────────────────────┐
  │  HOST SIDE (bare node, resources/*.mjs compiled from *.mts)           │
  │                                                                       │
  │   broker-control.mts ──── op:"acquire" ──► vice-broker.mts            │
  │        (+ profile)                          selectWarmInstance()      │
  │                                              │  profile eligible?     │
  │                                              │  no → cold launch      │
  │                                              ▼                        │
  │                                        broker-launch.mts              │
  │                                        tryLaunchOne()  [inFlight]     │
  │                                              │                        │
  │                                        buildViceArgs(port, {…})       │
  │                                        stock branch, in ORDER:        │
  │                                          -default              idx 0  │
  │                                          -console?             idx 1  │
  │                                          -drive8type 1541             │
  │                                          -seed N                      │
  │                                          -raminit*×3                  │
  │                                          +autostart-delay-random      │
  │                                          -warp?                       │
  │                                          -binarymonitor …             │
  │                                              │ spawn                  │
  └──────────────────────────────────────────────┼────────────────────────┘
                                                 ▼
                                        /usr/bin/x64sc  (VICE 3.9)
                                                 │ DUMP (0x41)
                                                 ▼
                       <repoRoot>/.vice-snapshots/<name>.vsf     ← snapshotPathFor()
                                                 │ container-visible by construction
  ┌──────────────────────────────────────────────▼────────────────────────┐
  │  CAPTURE SUBSTRATE (container side, reads files, spawns nothing)      │
  │                                                                       │
  │   vsf-slice.ts                                                        │
  │     walk module table from offset 58                                  │
  │     find "C64MEM", require body >= 65543                              │
  │     ram = body[4 .. 4+65536]                                          │
  │     ports = { dir_read: body[65542], data_read: body[65541] }         │
  │                    │                                                  │
  │                    ▼                                                  │
  │   capture-predicate.ts   ── normalise $0000/$0001 in code             │
  │     enumerated allow-list (JSON, per release, cap 64)                 │
  │     verdict: equivalent | not-equivalent                              │
  │                    │           ▲ MUST NOT import ─────┐               │
  │                    ▼           │        (CAP-03)      │               │
  │   capture record (D-29)        │                stop-oracle.ts        │
  │     + binary sha256            └────────────── (PC, hit_count,        │
  │     + argv digest                               (LIN, CYC))           │
  │     + seed                                      takes NO image buffer │
  └───────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
   GATE-01: docs/phase33-reproducible-run-gate-findings.md
     frontmatter: verdict, verdict_rule_applied, 5 inputs
     rules committed in 33-01, BEFORE any measurement commit
```

### Recommended Project Structure

```
src/mcp/vice/
├── stock-reproducible-run.ts        # NEW — runReproducible(), the one named seam (D-12)
├── stock-reproducible-run.test.ts   # NEW — unit-testable parts only (see Validation)
├── vsf-slice.ts                     # NEW — .vsf module-table walk + C64MEM slice (D-19)
├── vsf-slice.test.ts                # NEW — synthetic .vsf fixtures, refusal cases
├── capture-predicate.ts             # NEW — equivalence predicate + port normalisation
├── capture-predicate.test.ts        # NEW — D-25's corpus-free planted-byte control
├── capture-seam.test.ts             # NEW — D-26's CAP-03 structural bar (grep -a census)
├── stock-run-until.ts               # EDIT — RUN_UNTIL_KEYS + the two new args
├── broker-launch.mts                # EDIT — buildViceArgs(): determinism block + profile
├── broker-control.mts               # EDIT — acquire's optional profile field
├── broker-state.mts                 # EDIT — InstanceRecord carries its profile
├── vice-broker.mts                  # EDIT — selectWarmInstance() profile eligibility
├── vice-broker-client.ts            # EDIT — thread profile through acquire()
├── capability-registry.ts           # EDIT — D-17's re-grounded warp sentence
├── tools-manifest.stock.json        # EDIT — vice_run_until's two new optional properties
└── fixtures/vsf/                    # NEW — synthetic snapshot fixtures

src/skills/c64-ram-capture/
├── scripts/vsf-slice.mjs            # NEW — thin wrapper importing vsf-slice.ts
├── scripts/derive-transients.mjs    # NEW — D-23's N>=3 union derivation, cap 64
├── templates/capture-record.template.md   # EDIT — D-29's three Identity rows
└── transients/<release>.json        # NEW — per-release committed allow-list (D-22)

docs/
├── phase33-reproducible-run-gate-findings.md   # NEW — D-05's verdict document
└── tool-support.md                             # REGENERATE with capability-registry.ts

.planning/phases/33-…/evidence/
└── *.mjs                            # evidence scripts, NOT deliverables (D-10)
```

### Pattern 1: Optional-and-absent-by-default, to add a field without breaking a frozen contract

**What:** New arguments and new record fields default to *absent*, so every pre-existing
caller, test stub and manifest consumer keeps working byte-identically.
**When to use:** `D-12`'s `reproducible`, `D-14`'s `frame_anchor`, `D-15`'s `profile`,
`D-16`'s per-instance profile.
**The worked in-tree precedent:** `tryLaunchOne`'s widened `spawn` signature, whose own JSDoc
states the reasoning [VERIFIED: src/mcp/vice/broker-launch.mts:225-232]:

```ts
  /** I-1 rider (08.2-02-PLAN.md, Task 2): widened to an optional third
   * `options` argument so `spawnAndRecordInstance()` below can thread a
   * scratch `XDG_CONFIG_HOME` through for stock launches. The parameter is
   * optional, so every pre-existing 2-arg caller and every pre-existing
   * 2-arg test stub keeps compiling and behaving identically -- JS/TS
   * function-type compatibility allows a function that ignores its extra
   * argument to satisfy a type that offers one. */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
```

**Where the pattern does NOT save you:** `REPRO-01`'s determinism block is *unconditional* on
stock. No amount of optionality keeps the five whole-argv assertions green — see P7.

### Pattern 2: The already-existing `acquire` op takes an eighth field, not an eighth op

The control protocol is newline-delimited JSON with seven request kinds
[VERIFIED: src/mcp/vice/broker-control.mts:30]:

```ts
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release";
```

`ControlRequest` already carries `[key: string]: unknown`
[VERIFIED: src/mcp/vice/broker-control.mts:33-39], so an added `profile` field parses today
without a schema change. There are **two** client write sites to thread it through
[VERIFIED: src/mcp/vice/vice-broker-client.ts:372, 867]:

```ts
      socket.write(`${JSON.stringify({ op: "acquire", id: requestId, token })}\n`);
...
    const raw = await sendAndAwaitLine({ op: "acquire", id: requestId, token }, opts.timeoutMs ?? ACQUIRE_TIMEOUT_MS);
```

Missing either one means the profile silently never arrives — the same class of defect as a
tool argument that is accepted and dropped.

### Pattern 3: Walk the module table; never resync, never fixed-offset

`D-21` is right that a fixed offset is fragile. But the *prototype* also carries a
byte-by-byte resync loop, and that is the more dangerous of the two failure modes — see P2.
The correct shape is a strict walk from a computed `first_module_offset`, refusing on the
first malformed header rather than scanning past it.

### Pattern 4: `CAP-03`'s structural bar, using the existing import-census precedent

`anno-seam.test.ts` already asserts that `node:sqlite` is named by exactly one shipped module —
the same shape `D-26` needs. Two assertions:

1. The predicate module's source contains no import of the oracle module (and vice versa).
2. The oracle's comparison function's signature accepts no `Buffer`/`Uint8Array` parameter.

**Census hazard, verified as a live property of this tree:** `anno-memmap-render.ts` contains a
NUL byte and is invisible to a plain `grep`. Use `grep -a`, or read files with `readFileSync`
in the test rather than shelling out. A plain-`grep` census silently under-covers and has
already produced one false decision in this project.

### Anti-Patterns to Avoid

- **Re-deriving a cross-cutting seam locally.** Named anti-pattern in `CLAUDE.md`. The port normalisation, the argv builder and the wire framing each have exactly one home.
- **Killing/relaunching preemptively to serve a newer request.** Named anti-pattern; `D-16`'s eligibility rule must *not* become "recycle the warm instance to re-warp it".
- **Wrapping the three `stock-run-until` cleanup paths in one undifferentiated `finally { delete }`.** This module's own header calls it "this design space's documented first-draft mistake (Pitfall 4)". `runReproducible()` wraps `handleRunUntil`'s primitives; it must not flatten them.
- **A second wire-error converter.** `stock-run-until.ts`'s header forbids it explicitly; arming failures go through `convertWireError()`, resume/wait failures propagate to `withStockSession`'s single converter.
- **Shipping a "protocol without the reset" argument.** `D-13`. The reset-removed control is an evidence script calling the pieces directly.
- **Allow-listing `$0000`/`$0001`.** `D-24`. It would spend two of 64 slots hiding a divergence that might be real.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binmon request framing | A local header builder in `stock-reproducible-run.ts` | `encodeRequestHeader()` / `checkpointSetBody()` / `cpNumBody()` / `resetBody()` in `stock-protocol.ts` | It is the one place this tree frames *and demultiplexes* the protocol, and the demux is what keeps `CHECKPOINT_INFO`/`REGISTER_INFO` events from resolving a pending request |
| Parsing `CHECKPOINT_INFO` | Your own offsets | `stock-protocol.ts`'s existing parse branch | `hit_count` is at body offset **13**, not 12. This research's own first probe read 12 and got `256` instead of `1` — a plausible-looking wrong number, which is the worst kind |
| Reading `LIN`/`CYC` | Hardcoded register ids | `registerCatalogFor()` / `readCycleBaseline()` in `stock-timing.ts` | Ids are build-dependent; the module already refuses by name when a build enumerates neither, and `stock-timing.ts`'s header says "Never hardcode a register id for LIN/CYC/PC" |
| Waiting for a checkpoint | A wall-clock sleep | `stock-run-until.ts`'s event-driven wait | Measured, twice, this session: a wall-clock-anchored stop diverges (M3: 1242 bytes; M6: 300 bytes with differing `LIN`) |
| sha256 digests | Anything but `node:crypto` | `createHash("sha256")` | `compare.mjs`'s `digest` verb already exists and the capture record already cites it |
| JSON-Schema validation of the new tool args | `ajv` | `stock-schema-check.ts` | Zero-dependency posture; its header names `ajv` as the rejected alternative and bounds the supported subset |
| Host/container path translation for the `.vsf` | A path join in `vsf-slice.ts` | `snapshotPathFor()` in `stock-paths.ts` | `vsf-slice.ts` **must not** import `hostpath.ts` — the consumer set is closed to five modules and pinned by `hostpath-consumers.test.ts` |
| Headless display | `Xvfb`, a virtual framebuffer, or a VICE rebuild | `-console` | Measured: binds the monitor with `DISPLAY` and `WAYLAND_DISPLAY` both unset. `xvfb-run` is not installed here |

**Key insight:** every hand-rolled shortcut in this domain fails *quietly with a plausible
number* rather than loudly. A wrong `hit_count` offset yields 256; a fixed `.vsf` offset yields
garbage that is still 65536 bytes long; a wall-clock stop yields a capture that compares as
"only 300 bytes different". The whole phase exists to remove exactly this class of failure, so
its own implementation cannot afford to reintroduce it.

---

## Runtime State Inventory

This is not a rename phase, but it does touch real runtime state that no grep will find.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `<repoRoot>/.vice-snapshots/*.vsf` + `*.json` sidecars, written by `vice_snapshot_save` through `snapshotPathFor()`. Two real `.d64` corpus images on disk under `.planning/phases/23-…/evidence/corpus/`, **gitignored**, sha256s in M7 | None to migrate. The snapshot directory is the slicer's input; the corpus is `CAP-04`'s input. Record both digests in the capture record (`D-29`) |
| Live service config | `.vice-supervisor/` holds per-port state directories (`6600`–`6624` present from a 2026-08-26 session). `broker.json` carries `control_host`/`control_port`/`control_token`. Broker is currently **not running** | `D-16`'s profile becomes part of `InstanceRecord` — a broker restarted mid-phase reads a state directory whose records have no `profile` field. Treat absent as "profile-less", which is exactly the warm floor's current behaviour |
| OS-registered state | A `vice-broker` **systemd user unit exists** and is `inactive` (memory: the broker must run as a systemd unit, since `setsid`/`nohup` dies with the session and voids captures in flight) | `D-11` requires the broker stopped for every measurement, so the unit stays inactive during this phase. Any plan that needs a long capture must start it deliberately and record that it did |
| Secrets / env vars | `XDG_CONFIG_HOME` is already redirected to a fresh `mkdtemp` scratch per stock launch (the I-1 rider), so the user's `~/.config/vice/vicerc` is never read. `VICE_ARGS` short-circuits the whole argv builder ahead of both backend branches | The scratch `XDG_CONFIG_HOME` plus `-default` are **belt and braces** for determinism — record that, because it means `RAMInitStartRandom`/`RAMInitRepeatRandom` are already 0 and the two flags are defensive rather than corrective |
| Build artifacts | `resources/*.mjs`, compiled from the eight `HOST_BOUND_ARTIFACTS`. `build.ts` **throws** on an unlisted host-bound `.mts`; `resources-sync.test.ts` fails in both directions | Editing `broker-launch.mts`/`broker-control.mts`/`broker-state.mts`/`vice-broker.mts` means running `node build.ts` and committing the regenerated `resources/*.mjs` **in the same commit**. **Do not add a new host-bound `.mts`** in this phase — `stock-reproducible-run.ts` and `vsf-slice.ts` are container-side `.ts`, correctly |

**Nothing found in category:** none — all five categories have real content here.

---

## Common Pitfalls

### P1 — `main.c`'s early argv scan is prefix-only and `break`s, and it *strips* what it handles

**What goes wrong:** A flag that must be seen before UI/config initialisation is placed later
in argv and is silently handled too late, or not at all.

**Why it happens:** VICE handles a small set of options in a pre-scan before anything else,
and that loop terminates at the first option it does not recognise
[CITED: vice-3.8/src/main.c:184-192], verbatim:

```c
    /* Check for some options at the beginning of the commandline before
       initializing the user interface or loading the config file.
       -default => use default config, do not load any config
       -config  => use specified configuration file
       -console => no user interface
       -verbose => more verbose logging
       -silent => no logging
       -seed => set the random seed
    */
```

The loop's terminal branch is `} else { break; }`, immediately followed by
[CITED: vice-3.8/src/main.c:232-238]:

```c
    /* remove the already handled items from the commandline, else they will
       get parsed again later, which causes surprising effects. */
    for (n = 1; i < argc; n++, i++) {
        argv[n] = argv[i];
    }
```

**How to avoid:** treat `-default` and `-console` as *prefix-run* flags. `-default` at index 0
is not a superstition — it is the only position from which `loadconfig = false` is guaranteed,
and `broker-launch.mts`'s existing comment about it is now source-confirmed.

**Warning signs:** a `vicerc` value leaking into a "default" launch; a headless launch dying
with a GTK message.

### P2 — The prototype slicer's `first_module_offset` is 37; the real value on 3.9 is 58

**What goes wrong:** `off = MAGIC.length + 2 + 16` = 37 lands inside the `"VICE Version\x1a"`
block, not on a module header. Read strictly, the first "module" has
`size = 1291845632` and the walk aborts.

**Why it happens:** `snapshot_create()` writes a *second* magic block after the machine name —
`"VICE Version\x1a"` (13 bytes) + 4 version bytes + a 4-byte SVN dword
[CITED: vice-3.8/src/snapshot.c:833-849] — so `first_module_offset` is
`19 + 2 + 16 + 13 + 4 + 4 = 58`. MEASURED: `"MAINCPU"` begins at 58 (M5).

**How to avoid:** compute 58 from named constants, and **do not** carry the prototype's
resync fallback. `.planning/phases/23-…/evidence/vsf-ram-extract.mjs` survives the stale offset
only because of this line:

```js
    if (!/^[\x20-\x7e]+$/.test(name) || size < 22 || off + size > f.length) { off++; continue; }
```

A byte-by-byte scan for a 16-byte printable field followed by a plausible u32 length can lock
onto a false `C64MEM` string inside 64 KB of RAM data — and would then return "a 65536-byte
image" that is garbage. That is `D-21`'s own stated worst failure mode, reintroduced by the
recovery path rather than by the offset.

**Warning signs:** `SNAP_SIZE` plausible but the module walk not ending exactly at file length.
A correct walk on this build ends at **193261 == file length** (M5).

### P3 — The `C64MEM` body is 65555 bytes, and the port bytes you want are *after* the RAM

**What goes wrong (two ways):**
1. `D-21`'s `body.length === 4 + 65536` assertion refuses every real snapshot.
2. `D-24`'s prefix-over-RAM normalisation writes the wrong values to the wrong addresses.

**Why it happens:** the prefix is `(pport.data, pport.dir, EXROM, GAME)` — `data` **first**,
while the addresses are `$0000` = direction and `$0001` = data. And the CPU-visible values are
neither of those: `zero_read()` returns `pport.dir_read` for `$0000` and `pport.data_read` for
`$0001` [CITED: vice-3.8/src/c64/c64memsc.c:251-292], and those two fields live in the 3-byte
suffix immediately after the RAM array.

MEASURED, same snapshot, three independent readings agreeing (M4):

```
prefix   = [231, 47, 0, 0]     # pport.data=0xE7, pport.dir=0x2F, EXROM=0, GAME=0
suffix3  = [39, 55, 47]        # data_out=0x27, data_read=0x37, dir_read=0x2F
registers: 55:"00" = 47        # CPU view of $0000  == dir_read
           56:"01" = 55        # CPU view of $0001  == data_read
```

So `pport.data` is **231**, but the CPU sees **55** at `$0001`. Using the prefix gives a
"normalised" value that is wrong by 176.

**How to avoid:**

```ts
const RAM_OFFSET   = 4;
const RAM_SIZE     = 65536;
const MIN_BODY_LEN = RAM_OFFSET + RAM_SIZE + 3;   // 65543, snapshot minor 0
const V01_BODY_LEN = MIN_BODY_LEN + 4 + 4 + 4;    // 65555, snapshot minor 1
// CPU-visible port values, for D-24's in-code normalisation:
const dataRead = body[RAM_OFFSET + RAM_SIZE + 1]; // -> $0001
const dirRead  = body[RAM_OFFSET + RAM_SIZE + 2]; // -> $0000
```

Assert `body.length >= MIN_BODY_LEN` and refuse below it; accept 65543 and 65555 and state
which minor produced which.

**Warning signs:** a normalised image that still differs from a `vice_memory_read` transcript
at exactly `$0000`/`$0001` — the one place the normalisation was supposed to fix.

### P4 — `AutostartDelayRandom` ships **on**, adds up to 10 frames of jitter, *and* changes the RUN path

**What goes wrong:** `CAP-04` autostarts a real release. Every autostart draws a random initial
delay, so two "identical" autostarted runs begin at different cycles.

**Why it happens:** factory default **1** [CITED: vice-3.8/src/autostart.c:359-360; VERIFIED live via `RESOURCE_GET`, M2], and:

```c
    resources_get_int("AutostartDelayRandom", &rnd);
    if (rnd) {
        /* additional random delay of up to 10 frames */
        autostart_initial_delay_cycles += lib_unsigned_rand(1, (int)machine_get_cycles_per_frame() * 10);
    }
```
[CITED: vice-3.8/src/autostart.c:1432-1436]

There is a **second, non-timing** effect that is easy to miss
[CITED: vice-3.8/src/autostart.c:882-886]:

```c
        if (AutostartDelayRandom) {
            kbdbuf_feed_runcmd(AutostartRunCommand);
        } else {
            kbdbuf_feed(AutostartRunCommand);
        }
```

So the flag also selects *which* keyboard-buffer feed injects `RUN`. Turning it off is a
behavioural change, not only a timing one.

**How to avoid:** emit `+autostart-delay-random` in the determinism block. Note this is a
**fifth** flag beyond `REPRO-01`'s four; `REPRO-01`'s text names only `-seed` plus the three
`raminit*`. Record the addition explicitly rather than smuggling it in — and pin it once,
never toggle it between runs of a pair.

**A partial mitigation worth knowing:** the delay is drawn from the *seeded* RNG
(`lib_unsigned_rand` → `rand_uint32`, seeded by `lib_rand_seed` → `srand`
[CITED: vice-3.8/src/lib.c:935-944, 970-974]), so `-seed` pins it *provided* the RNG
consumption order upstream is identical. That is a weaker guarantee than disabling the draw,
which is why disabling it is the recommendation.

### P5 — `-console` is position-sensitive: at index ≥ 2 the process **dies** headless

**What goes wrong:** `profile.headless` appends `-console` after `-drive8type 1541`, and the
launch dies with `Gtk-WARNING: cannot open display:` — surfacing to the broker as a launch
that never became ready.

**Why it happens:** `-console` is handled in the prefix scan (P1), and `console_mode` gates GTK
initialisation at `main.c:301` (`ui_init_with_args`) and `main.c:340` (`ui_init`), both of
which run **before** `initcmdline_check_args()` at `main.c:334`
[CITED: vice-3.8/src/main.c:296-345]. A `-console` seen only by the late parser
(`initcmdline.c:421` → `cmdline_console` → `console_mode = 1`) arrives after GTK has already
tried and failed.

MEASURED, three variants, `DISPLAY` and `WAYLAND_DISPLAY` both unset
[VERIFIED: live probe 2026-09-02]:

```
[-default -console -binarymonitor]                    alive=yes bound=1
[-default -drive8type 1541 -console -binarymonitor]   alive=no  bound=0   Gtk-WARNING **: cannot open display:
[-default -console -drive8type 1541 -binarymonitor]   alive=yes bound=1
```

And with a display present but **no** `-console`, the process runs; with **no** display and no
`-console`, it dies. So `-console` is the headless route, and it must sit at **argv index 1**.

**How to avoid:** build the stock argv as `-default`, then the optional `-console`, then
`-drive8type 1541`, then the rest. All three existing *ordering* assertions still hold:
`-default` at index 0, `-drive8type` before `-binarymonitor`, and `"1541"` immediately after
`-drive8type` [VERIFIED: src/mcp/vice/broker-launch.test.ts:1799-1812].

**Warning signs:** an instance that stays `launching` forever with a GTK message in its boot
log. Also: in one observation a `-console` launch had not bound its monitor port at 3000 ms but
had at 5000 ms — which is exactly the class of misjudgement `D-18` asks `probeReady` to be
re-checked for. Treat that as one observation, not a measured latency.

### P6 — `compare.mjs`'s predicate is range-shaped and passes any single-bit difference

**What goes wrong:** `D-25`'s planted-byte control is written against a predicate inherited
from `compare.mjs`, the plant is a one-bit flip, and the control passes — proving nothing.

**Why it happens:** `compare.mjs`'s rules, verbatim from its own header
[VERIFIED: src/skills/c64-ram-capture/scripts/compare.mjs:13-16]:

```
//   volatile   $0000-$0001, $0100-$01FF, $0200-$03FF, $D000-$DFFF -- counted,
//              reported, excluded from the verdict
//   drift      exactly one bit differs -- listed as a candidate, does not fail
//   divergence two or more bits differ -- listed, and fails the comparison
```

and its span table [VERIFIED: same file:30-41]:

```js
const VOLATILE = [
  [0x0000, 0x0001], // CPU port
  [0x0100, 0x01ff], // stack page
  [0x0200, 0x03ff], // KERNAL work area / BASIC input buffer
  [0xd000, 0xdfff],
];
```

That is 4866 addresses excluded by *range*, plus an unbounded one-bit tolerance everywhere
else. `CAP-02` requires an enumerated list, "never a range", and a planted byte outside it to
**fail**.

**How to avoid:** the new predicate is a replacement in kind, not an extension. Keep
`compare.mjs`'s reporting vocabulary and its `digest` verb; drop the ranges and drop the
drift-passes rule. If `D-25`'s CI control must survive a hostile reading, plant a **one-bit**
difference — a predicate that passes a one-bit plant has not been proven able to fail.

**A genuine simplification the snapshot route buys you:** `$D000-$DFFF` is volatile *only on the
transcription route*, because `vice_memory_read` samples live I/O. The `.vsf` `C64MEM` array is
`mem_ram[]` — RAM under I/O, not the register image — so on the snapshot route the entire
4096-address exclusion **disappears**. The capture-record template's standing note ("Any
divergence inside `$D000-$DFFF` is not a divergence") is transcription-route-specific and must
be re-grounded, not copied.

### P7 — Five stock whole-argv assertions change, and optionality cannot save them

**What goes wrong:** the plan budgets for "three avoidable assertions" and finds five failing,
in two files.

**Why it happens:** `REPRO-01`'s determinism block is unconditional on the stock branch.
[VERIFIED: src/mcp/vice/broker-launch.test.ts:1775, 1789, 1907, 1919, 1929 — five
`assert.deepEqual(args, …)` calls carrying `"-default"`], with test names:

- `buildViceArgs: stock backend defaults to a loopback binary-monitor bind` (1773)
- `buildViceArgs (I-2): stock backend emits the exact fixed argv shape …` (1787)
- `buildViceArgs: stock backend honours an explicit binmonHost override` (1905)
- `buildViceArgs (D-13): stock backend WITHOUT a remoteMonitorPort returns exactly the current argv, byte-identical` (1917)
- `buildViceArgs (D-13): stock backend WITH a remoteMonitorPort appends -remotemonitor and its address …` (1927)

Plus `stock-broker-live.test.ts` references `-drive8type` in 6 places — it is in
`MANUAL_ONLY_TESTS` so it will not red CI, but leaving it stale is a trap for the next live run.

**How to avoid:** update all five in the same commit as `buildViceArgs()`, and preserve the two
**fork** whole-argv assertions (1763, 1924) byte-identical — that is a Validated v0.2.0
requirement, not merely a test.

### P8 — `test:automated` is **not** at zero on the current tree

**What goes wrong:** a plan adopts "`test:automated` green" as an acceptance criterion and
fails its own verification for five reasons it did not cause.

**Why it happens:** MEASURED 2026-09-02, broker stopped, current `HEAD`:
`npm run test:automated` → **EXIT=1**, `pass 3019 / fail 5`, `duration_ms 98065`. The five, with
root causes:

| Failing test | File | Root cause |
|---|---|---|
| `DIRECTION 5 (basis integrity)` | `anno-register.test.ts:385` | `STORE-01`, `STORE-04`, `STORE-06`, `MCP-04` are cited by the anno tool register but are no longer declared in `.planning/REQUIREMENTS.md` — the file was rewritten for v0.8.0 and the v0.7.0 ids are gone |
| `planted violation (the negative control)` | `anno-register.test.ts:479` | Same root cause (`STORE-06`) |
| `AUDIT-04 direction B` | `docs-deferred-ledger.test.ts:123` | Two **completed** todos still listed as Pending in `STATE.md`'s Deferred Items: `2026-08-31-phase-32-review-twenty-five-open-findings`, `2026-09-01-phase-32-review-round-4-nine-open-findings` |
| `planted violation: both predicates fire …` | `docs-deferred-ledger.test.ts` | Same root cause |
| `no milestone audit declares a gated status while any docs guard is red (D-12-02)` | `audit-integrity.test.ts:234` | **Cascade** from the two above: it re-runs every docs guard and reds because `docs-deferred-ledger` is red while 5 milestone audits declare a gated status |

**How to avoid:** either fix the two root causes first (they are small: two `STATE.md` row
removals, and reconciling four requirement ids) or state the baseline as **5 failures in 3
files** in every transcript, as `D-11` actually requires ("records that fact alongside the
`test:automated` baseline it was taken against"). Do **not** write "clean floor: 0" into an
acceptance criterion. Note also that the *ledger* fix interacts with `D-08`'s two-directional
guard: resolving the three folded todos moves their `STATE.md` rows in the same commit, and
those rows exist today at `.planning/STATE.md:1304`, `:1305`, `:1307`.

### P9 — `vice_run_until` refuses unknown argument names, by name

**What goes wrong:** `reproducible: true` is passed and the tool answers
`vice_run_until: unexpected argument(s): reproducible -- this tool takes only address, cycles, timeout_ms`.

**Why it happens:** [VERIFIED: src/mcp/vice/stock-run-until.ts:155-161]:

```ts
  const RUN_UNTIL_KEYS = ["address", "cycles", "timeout_ms"];
  const unexpectedKeys = Object.keys(args).filter((key) => !RUN_UNTIL_KEYS.includes(key));
  if (unexpectedKeys.length > 0) {
    return isErrorText(
      `vice_run_until: unexpected argument(s): ${unexpectedKeys.join(", ")} -- this tool takes only ${RUN_UNTIL_KEYS.join(", ")}`,
    );
  }
```

**How to avoid:** extend `RUN_UNTIL_KEYS` to
`["address", "cycles", "timeout_ms", "reproducible", "frame_anchor"]` **and** add both
properties to `tools-manifest.stock.json`'s `vice_run_until.inputSchema.properties` in the same
commit. That schema has **no `required` array** today
[VERIFIED: src/mcp/vice/tools-manifest.stock.json, `vice_run_until` entry], so both additions
are pure widenings and `manifest-arg-compat.test.ts` stays green — it forbids only removing a
fork-declared property, retyping a shared one, or making a shared one newly required.

### P10 — `default_memspace` contamination is reachable here, and nothing resets it

**What goes wrong:** after one drive checkpoint hit, `ADVANCE_INSTRUCTIONS` and
`EXECUTE_UNTIL_RETURN` step the **drive** CPU and `@bank:` conditions fail outright — and
`runReproducible()` reports a confident stop against the wrong CPU.

**Why it happens:** `monitor.c:3393-3396` sets it on a drive checkpoint hit and no
binary-monitor command resets it. With `Drive8TrueEmulation = 1` (MEASURED, M2) and an
autostarted `.d64`, this is reachable rather than theoretical.

**How to avoid:** `D-28`'s main-CPU memspace assertion, and the wire memspace byte mapping
(`0x00` = main; `0x01`–`0x04` = units 8–11; `0x08` **rejected**). `checkpointSetBody()` already
routes `memspace` through `memspaceByte()`
[VERIFIED: src/mcp/vice/stock-protocol.ts:588-591], so use it rather than writing `body[8]`.

### P11 — The `AUTOSTART` power cycle sits inside the protocol, not before it

**What goes wrong:** the protocol issues `RESET 1` on an already-autostarted release, wiping
the loaded program, and the "reproducible" stop happens in the KERNAL rather than in the game.

**Why it happens:** `mon_autostart` → `reboot_for_autostart` →
`machine_trigger_reset(MACHINE_RESET_MODE_POWER_CYCLE)`
[CITED: vice-3.8/src/autostart.c:1437]. `AUTOSTART` **is** a hard reset plus a load. A separate
`RESET 1` afterwards therefore undoes the autostart.

**How to avoid:** for an autostarted release the load-bearing reset is `AUTOSTART`'s own power
cycle, and the anchor must be counted from that power cycle rather than from a wall-clock
moment after it. This research attempted the ordering *arm anchor while halted → `RESET 1` →
`AUTOSTART` → count hits* once and it did **not** produce a usable stop (both runs ended at
`PC=$FD75`/`$FD70`, `LIN=0`, `hits=0` — inside the KERNAL reset routine, with the resume/wait
loop finding no `CHECKPOINT_INFO`). That is a sequencing problem to solve in
`runReproducible()`, not a research gap — but it is the phase's largest single unknown and
should be an early task rather than a late one. See Q2.

---

## Code Examples

### The reproducible-run sequence, exactly as measured green (M4)

```ts
// Source: live-verified sequence, 2026-09-02, genuine stock VICE 3.9.
// Wire encoders from src/mcp/vice/stock-protocol.ts -- never hand-assembled.
//
// 1. The session already halted the machine (connecting opens the monitor:
//    REGISTER_INFO 0x31 then STOPPED 0x62 both arrive at requestId 0xffffffff).
// 2. Arm the frame anchor AND the target while halted.
await session.client.send(
  CommandType.CheckpointSet,
  checkpointSetBody({ start: frameAnchor, end: frameAnchor, stop: true, enabled: true,
                      operation: CheckpointOperation.Exec, temporary: false, memspace: 0x00 }),
);
await session.client.send(
  CommandType.CheckpointSet,
  checkpointSetBody({ start: target, end: target, stop: true, enabled: true,
                      operation: CheckpointOperation.Exec, temporary: true, memspace: 0x00 }),
);
// 3. Monitor-issued HARD reset -- RESET (0xcc), body [0x01].
await session.client.send(CommandType.Reset, resetBody({ mode: ResetMode.Hard }));
// 4. EXACTLY ONE resume (vice-sync.ts's invariant, in stock-native form).
await session.client.send(CommandType.Exit);
// 5. Wait event-driven for THAT checkpoint's own CHECKPOINT_INFO.
//    hit_count is at body offset 13 (u32LE) -- NOT 12.
// 6. Read the triple from ONE REGISTERS_GET reply, ids resolved via the catalog:
//    3:PC(16b)  53:LIN(16b)  54:CYC(16b)   -- never hardcode these.
```

MEASURED result of exactly this sequence, three jitter values: identical sha256
`0999713eedf0e09f4a3ea1c8cd444cee5f4857d45b09398559dd01a594099f7b`, 0 differing bytes,
`PC=$ea31 hit_count=1 LIN=257 CYC=57`.

### The `.vsf` module-table walk, strict, no resync

```ts
// Source: MEASURED against a genuine VICE 3.9 snapshot, 2026-09-02.
// Constants CITED: vice-3.8/src/snapshot.c:64-68, snapshot.h:33, snapshot.c:693-701
const MAGIC                = "VICE Snapshot File\x1a";   // SNAPSHOT_MAGIC_LEN 19
const MACHINE_NAME_LEN     = 16;                          // SNAPSHOT_MACHINE_NAME_LEN
const VERSION_MAGIC        = "VICE Version\x1a";          // SNAPSHOT_VERSION_MAGIC_LEN 13
const FIRST_MODULE_OFFSET  = 19 + 2 + MACHINE_NAME_LEN + 13 + 4 + 4;   // === 58
const MODULE_HEADER_LEN    = 22;                          // name(16) major(1) minor(1) size(u32LE)

let off = FIRST_MODULE_OFFSET;
while (off + MODULE_HEADER_LEN <= file.length) {
  const name  = file.subarray(off, off + 16).toString("latin1").replace(/\0+$/, "");
  const size  = file.readUInt32LE(off + 18);              // covers the 22-byte header too
  if (size < MODULE_HEADER_LEN || off + size > file.length) {
    throw new Error(`vsf-slice: malformed module header at offset ${off} (name=${JSON.stringify(name)}, size=${size}) -- refusing rather than resyncing`);
  }
  if (name === "C64MEM") { /* slice, see below */ }
  off += size;                                            // NEVER off++
}
```

A correct walk on this build visits 27 modules and ends at `off === file.length` (M5). Assert
that terminal equality — it is the cheapest possible integrity check on the whole file.

### The `C64MEM` slice and `D-24`'s in-code port normalisation, with the right fields

```ts
// Source: layout CITED vice-3.8/src/c64/c64memsnapshot.c:180-198;
// field identity VERIFIED live 2026-09-02 (prefix=[231,47,0,0], suffix3=[39,55,47],
// REGISTERS_GET id 55 "00"=47, id 56 "01"=55).
const RAM_OFFSET   = 4;                                   // pport.data, pport.dir, EXROM, GAME
const RAM_SIZE     = 65536;
const MIN_BODY_LEN = RAM_OFFSET + RAM_SIZE + 3;           // 65543 (snapshot minor 0)
const V01_BODY_LEN = MIN_BODY_LEN + 4 + 4 + 4;            // 65555 (snapshot minor 1)

if (body.length < MIN_BODY_LEN) {
  throw new Error(`vsf-slice: C64MEM body is ${body.length} bytes, need at least ${MIN_BODY_LEN} -- refusing a short read`);
}
const ram = Buffer.from(body.subarray(RAM_OFFSET, RAM_OFFSET + RAM_SIZE));

// The CPU-visible values, from the SUFFIX -- not from the 4-byte prefix.
const dataOut  = body[RAM_OFFSET + RAM_SIZE + 0];
const dataRead = body[RAM_OFFSET + RAM_SIZE + 1];         // CPU view of $0001
const dirRead  = body[RAM_OFFSET + RAM_SIZE + 2];         // CPU view of $0000

// D-24: normalise in code, in ONE place, never in a reader's head.
// Note the ADDRESS order: $0000 is the DIRECTION register, $0001 is DATA.
function normalisePorts(image: Buffer, dirRead: number, dataRead: number): Buffer {
  const out = Buffer.from(image);
  out[0x0000] = dirRead;
  out[0x0001] = dataRead;
  return out;
}
```

Why RAM `$0000`/`$0001` need this at all: every store to `$00`/`$01` overwrites `mem_ram[0]`
/`mem_ram[1]` with `vicii_read_phi1()` — the VIC's phi1 bus value at that instant
[CITED: vice-3.8/src/c64/c64memsc.c, `zero_store` cases 0 and 1]. Those two RAM bytes are
therefore a raster-position artefact, not program state, which is exactly why they are the one
legitimate divergence pair and exactly why allow-listing them (rather than normalising) would
hide a real difference.

### The stock argv, in the order every measured constraint requires

```ts
// Source: buildViceArgs() at src/mcp/vice/broker-launch.mts:153-219 (current shape),
// plus this session's measurements. -console position VERIFIED live; -warp neutrality
// VERIFIED live; +autostart-delay-random rationale CITED vice-3.8/src/autostart.c:1432-1436.
const args = [
  "-default",                                   // MUST be index 0 (main.c prefix scan)
  ...(profile?.headless ? ["-console"] : []),   // MUST be in the prefix run -> index 1
  "-drive8type", "1541",                        // Drive8TrueEmulation is already 1 (MEASURED)
  "-seed", String(seed),                        // REPRO-01
  "-raminitstartrandom", "0",                   // REPRO-01 (already 0 at factory; defensive)
  "-raminitrepeatrandom", "0",                  // REPRO-01 (already 0 at factory; defensive)
  "-raminitrandomchance", "0",                  // REPRO-01 -- factory is 10, this is the load-bearing one
  "+autostart-delay-random",                    // NOT in REPRO-01's text; factory is 1. See P4
  ...(profile?.warp ? ["-warp"] : []),          // position-free (VERIFIED)
  "-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`,
];
// The fork branch stays byte-identical:
//   ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)]
```

### `D-22`/`D-23`'s derivation, and why the cap must void rather than warn

```
Method (committed, per D-23):
  N >= 3 runs of the SAME release, SAME protocol, SAME stop.
  allow-list = union of addresses differing across the pairwise comparisons.
  Each entry records: address, which run pairs it differed in, one-line attribution if known.
  Re-derived per release. No address set is ever inherited between releases.

Cap (committed, per D-22): 64 addresses. Exceeding it VOIDS the derivation.

Why that is the right shape, MEASURED:
  READY prompt, frame-exact stop (M4)             ->   0 differing addresses
  READY prompt, wall-clock stop, block on (M3)    -> 1242 differing addresses
  real release, autostarted, wall-clock stop (M6) ->  300 differing addresses
The cap does not distinguish "a few transients" from "a lot of transients".
It distinguishes "the stop is frame-exact" from "the stop is not", which is
the fact GATE-01 must hear.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VICE event record/replay as the reproducibility mechanism | The **reset protocol** plus pinned launch nondeterminism | 2026-09-02, MEASURED | `event.c` registers exactly six event options and none is `-record`/`-recordevents`; `x64sc -record` returns `Unknown option`, exit 255. **Do not re-research this** — CONTEXT.md says so and this research did not revisit it |
| Transcribing 64K out as hex | Slicing the `.vsf` `C64MEM` body | v0.7.0 → this phase (`CAP-01`) | Removes the error source: one 32 KB write truncated mid-payload, one 8 KB write dropped ten characters localised to `$7871` |
| `$D000-$DFFF` treated as volatile | Not volatile at all on the snapshot route | This research | The snapshot holds `mem_ram[]`, not the I/O read view. A 4096-address exclusion disappears |
| `vsf-ram-extract.mjs`'s `first_module_offset = 37` | **58** | This research | 37 predates (or overlooks) the `"VICE Version\x1a"` block. The prototype only worked via a resync loop |
| `TrapDevice8` | `VirtualDevice8` on 3.9 | pre-3.10 | Confirmed live: `TrapDevice8` → `OBJECT_MISSING`, `VirtualDevice8` → 0 |
| "warp on stock is a launch-time flag, not a resource that can be toggled while running" | "no runtime `WarpMode` resource exists; runtime toggling exists only on the text monitor, which this project does not dial" | `D-17`, this phase | The first clause is now **live-verified** (`WarpMode` → `OBJECT_MISSING`); only the "not togglable at all" implication was wrong |

**Deprecated / outdated:**
- Phase 0's Route B reconstructed cycle clock: deliberately not revived (19,657 vs 19,656 cycles/frame, a 1-cycle-per-frame accumulating error). Incidentally corroborated this session — VICE's own boot log prints `"MOS8565" (63 cycles per line, 312 raster lines)`, and 63 × 312 = **19656**.
- `-limitcycles` as a capture route: it quits **with an error**, no snapshot, and kills the process the broker supervises. It exists (M1) and is fine as a flag-acceptance smoke test, nothing more.
- Text-monitor `bsave` as a capture route: writes host-side from inside the emulator, bypassing `hostpath.ts`/`containerpath.ts`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VICE **3.8** source is a faithful guide to **3.9** behaviour for `main.c`'s prefix scan, `autostart.c`'s random delay, `ram.c`'s factory defaults, `c64memsnapshot.c`'s module layout and `c64memsc.c`'s `zero_read`/`zero_store`. No 3.9 source tree exists on this host | throughout | LOW in practice: every 3.8-derived claim in this document that could be checked against the 3.9 binary **was** and agreed (module layout, body length 65555, resource defaults 1/10/1541, `-console` position sensitivity, `WarpMode` absence). Treat any *un-cross-checked* 3.8 citation as `[ASSUMED]` |
| A2 | `-console` is safe to combine with `-binarymonitor` for a *full capture run*, not merely for binding the port | P5, argv example | Observed alive-and-bound at 5 s in two configurations, but a full `-console` capture run was **not** completed (one attempt hit `ECONNREFUSED` at 3 s and 8 s in a differently-ordered argv). Verify before shipping `profile.headless` |
| A3 | `+autostart-delay-random` is the right pin rather than relying on `-seed` to make the draw reproducible | P4 | If wrong, the flag is merely redundant. Low risk, and it is a one-word argv addition |
| A4 | The `.vsf` snapshot's own version (`2.0` on this build) will not change the header geometry within the VICE 3.x line | P2, code example | A future VICE could add a third magic block. Mitigation: assert the walk ends exactly at file length, which catches any geometry change loudly |
| A5 | `hit_count` at `CHECKPOINT_INFO` body offset 13 is correct | Don't Hand-Roll, code example | Cross-checked two ways: the project's own parser reads `body.readUInt32LE(13)`, and reading 12 instead produced `256` where the truth was `1`. Confidence HIGH |
| A6 | An `$EA31` anchor generalises to other releases | M6 | It held on `danish` *after its load*, and `D-14` already refuses to guess. Do not promote it to a default |
| A7 | The two `.d64` images on disk are the same artefacts Phase 23 measured, and are legally usable as this milestone's corpus | M7 | Digests are recorded so the identity is checkable. Licensing risk is owner-accepted and must not be flagged or gated |
| A8 | `docs/tool-support.md`'s drift guard is `tool-support-table.test.mjs` and the generator is `scripts/generate-tool-support-table.mjs` | `D-17` | Located by filename search, not by reading the guard's assertions. Read both before editing `capability-registry.ts` |
| A9 | `broker-state.mts`'s `InstanceRecord` is the right home for `D-16`'s per-instance profile | Structure, Runtime State | Inferred from `selectWarmInstance()` reading `state.instances` records. Confirm against `broker-state.mts` before planning the field |

---

## Open Questions

1. **Will `C0_CAPTURE_PAIR` actually be `not-obtained`?**
   - What we know: the corpus is on disk (M7), `AUTOSTART` works on it, `Drive8TrueEmulation` is 1, and `$EA31` is a live anchor on `danish` after its load. `D-04` pre-maps a `not-obtained` narrowing that costs Phases 35/36/37/38 their real-image exercise.
   - What's unclear: whether a *frame-exact* autostarted stop is achievable in this phase (Q2 below). `not-obtained` is now much less likely than `D-04` assumes, but `fail` has become correspondingly more likely.
   - Recommendation: keep `D-04`'s pre-mapping exactly as written — it is a pre-commitment and its value comes from being written before the answer is known. But do **not** let the plan treat `not-obtained` as the expected branch; the corpus exists.

2. **What is the correct anchor-counted sequence for an autostarted release?**
   - What we know: `AUTOSTART` power-cycles (`autostart.c:1437`). A wall-clock-anchored stop after it is measured red (M6). One attempt at *arm-while-halted → `RESET 1` → `AUTOSTART` → count hits* produced no usable stop (`PC=$FD75`, `LIN=0`, `hits=0`).
   - What's unclear: whether a pre-armed stopping checkpoint survives `AUTOSTART`'s power cycle; whether the autostart state machine needs the machine free-running through the load before any stopping checkpoint may be armed; whether the anchor should instead be armed *after* the load using a hit-count offset recorded from the `AUTOSTART` reply.
   - Recommendation: make this the phase's **first measuring plan** after `33-01`, ahead of everything else in the `REPRO-*` half. It is the only unknown that can turn `C0_CAPTURE_PAIR` into `fail`. Probe `CHECKPOINT_LIST` (0x14) immediately after `AUTOSTART` to settle the survival question in one call.

3. **Should the two pre-existing `test:automated` failures be fixed inside this phase?**
   - What we know: 5 failures, 3 files, 2 root causes, none caused by Phase 33 (P8). One root cause is two stale `STATE.md` rows; the other is four requirement ids the v0.8.0 rewrite dropped.
   - What's unclear: whether reconciling `STORE-01`/`STORE-04`/`STORE-06`/`MCP-04` belongs to this phase at all — they are v0.7.0 store ids and the fix might legitimately be a `REQUIREMENTS.md` carried-ids section rather than a code change.
   - Recommendation: fix the **two `STATE.md` rows** in this phase (they are two lines, they unblock the `audit-integrity` cascade, and the three folded todos touch that same section anyway). File the four requirement ids as a separate concern rather than absorbing it. Either way, state the real baseline in every transcript.

4. **Does `D-22`'s cap of 64 survive its first real frame-exact derivation?**
   - What we know: 0 transients at a frame-exact READY-prompt stop; 300 at a wall-clock autostarted stop. Nothing measured between.
   - What's unclear: a real release at a frame-exact stop has its own frame counters, RNG, sprite positions and music-player pointers. There is no measurement of that number.
   - Recommendation: leave 64 as the pre-commitment. If the first frame-exact derivation overflows it, that is `GATE-01` hearing a fact — record the overflow and the actual count as gate evidence rather than raising the cap.

5. **Does `probeReady` need a different budget under `-console`, under `-warp`, or both?**
   - What we know: `-warp` is behaviour-neutral to the byte (M4). One `-console` launch had not bound at 3000 ms but had at 5000 ms.
   - What's unclear: whether that was startup variance or a systematic `-console` cost. `D-18` names only warp.
   - Recommendation: widen `D-18`'s re-check to cover `-console` as well as `-warp`. It is the same plan and the same probe.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| stock `x64sc` | every `REPRO-*` and `CAP-04` measurement | ✓ | VICE **3.9**, `/usr/bin/x64sc`, GTK3 build, 4057928 bytes | none needed |
| Node | everything | ✓ | ≥ 24 (native type-stripping in use) | none |
| An X/Wayland display | windowed launches | ✓ | `DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0` | `-console` (measured working with both unset) |
| `xvfb-run` | an alternative headless route | ✗ | — | `-console`, which is strictly better here |
| Real cracked-release corpus | `CAP-04` | ✓ | `danish.d64`, `saeger.d64` — 174848 bytes each, sha256s in M7, both gitignored | none needed |
| VICE **3.10** | `CPUHISTORY_GET` (0x86), absolute-cycle strengthening | ✗ | host is 3.9 | Deferred with a named trigger; `(LIN, CYC)` + the 64K comparison is the 3.9-floor oracle |
| VICE **source** for citation | source-level claims | ✓ (3.8) | `/home/henrik/Downloads/vice-3.8/src` | 3.9 source not present — see Assumption A1 |
| `vice-broker` systemd user unit | long captures | ✓ but `inactive` | — | `D-11` requires it stopped for measurements |
| ACME | not used by this phase | ✓ | 0.97 (per project docs) | — |
| Ghidra / dxa | Phases 35-36, not this one | n/a | — | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- VICE 3.10 → the deferred absolute-cycle strengthening stays deferred.
- `xvfb-run` → `-console`, which is the better answer anyway.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section applies.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no third-party framework |
| Config file | `src/mcp/vice/test-gate.mjs` — the single source of truth for `MANUAL_ONLY_TESTS` and `automatedTestFiles()` |
| Quick run command | `cd src/mcp/vice && node --test <file>.test.ts` |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (**never** `npm test` — the whole-glob run does not terminate unaided) |
| Typecheck | `cd src/mcp/vice && npm run typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPRO-01 | Stock argv carries the determinism block after `-default`; fork argv byte-identical; `-default` at index 0; `-console` at index 1 when headless | unit | `node --test broker-launch.test.ts` | ✅ (5 stock whole-argv assertions to update, 3 ordering assertions to extend) |
| REPRO-01 | Divergence without the block, zero with it | **transcript** (`D-07`) | — corpus-free, live emulator | ❌ Wave 0 — evidence script under the phase dir |
| REPRO-02 | `reproducible`/`frame_anchor` accepted; unknown names still refused; the procedure is reached from exactly one call site | unit | `node --test stock-reproducible-run.test.ts` | ❌ Wave 0 |
| REPRO-02 | Jitter 0/1500/4000 stop identically; reset-removed control red | **transcript** | — | ❌ Wave 0 |
| REPRO-03 | Oracle compares exactly the triple; refuses on a non-main memspace | unit | `node --test stock-reproducible-run.test.ts` | ❌ Wave 0 |
| REPRO-03 | `(LIN, CYC)` alone **passes** one frame apart; memspace assertion refuses after a drive hit | **transcript** | — | ❌ Wave 0 |
| REPRO-04 | Capture record template carries the three Identity rows; argv digest is sha256 over NUL-joined argv | unit | `node --test capture-predicate.test.ts` | ❌ Wave 0 |
| REPRO-05 | `profile` absent → byte-identical argv; `profile.warp` appends `-warp`; `profile.headless` puts `-console` at index 1; warm eligibility rejects a mismatched instance | unit | `node --test broker-launch.test.ts broker-control.test.ts` | ✅ / ❌ Wave 0 (new cases) |
| CAP-01 | Module walk finds `C64MEM` from offset 58; refuses a malformed header rather than resyncing; refuses a body below 65543; walk ends at file length | unit | `node --test vsf-slice.test.ts` | ❌ Wave 0 (needs `fixtures/vsf/`) |
| CAP-02 | Predicate fails on a byte planted outside the allow-list — including a **one-bit** plant (`D-25`, corpus-free) | unit | `node --test capture-predicate.test.ts` | ❌ Wave 0 |
| CAP-02 | Allow-list over the cap voids the derivation; port normalisation uses `dir_read`/`data_read` | unit | `node --test capture-predicate.test.ts` | ❌ Wave 0 |
| CAP-03 | Predicate module never imports the oracle module; oracle's compare takes no image buffer (`grep -a`-safe census) | unit | `node --test capture-seam.test.ts` | ❌ Wave 0 |
| CAP-04 | Real release captured twice, pair satisfies `CAP-02`; wall-clock control red | **transcript** (corpus-bound) | — | ❌ Wave 0 |
| GATE-01 | Verdict frontmatter parses; `verdict` ∈ `{go,degrade,no-go}`; all five inputs present | manual-only / doc | git-order proof via `git log` (`D-01`) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run typecheck` plus `node --test` on the touched file(s).
- **Per wave merge:** `npm run test:automated`, compared against the **measured baseline of 5 failures in 3 files** (P8) — not against zero.
- **Phase gate:** `npm run test:automated` at or below the baseline, plus `node build.ts` clean with `resources/*.mjs` committed, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/mcp/vice/vsf-slice.test.ts` — covers CAP-01
- [ ] `src/mcp/vice/fixtures/vsf/` — synthetic `.vsf` fixtures: a well-formed one, one with a malformed module header, one with a short `C64MEM` body, one at snapshot minor 0 (body 65543)
- [ ] `src/mcp/vice/capture-predicate.test.ts` — covers CAP-02 (`D-25`) and REPRO-04
- [ ] `src/mcp/vice/capture-seam.test.ts` — covers CAP-03 (`D-26`)
- [ ] `src/mcp/vice/stock-reproducible-run.test.ts` — covers REPRO-02/REPRO-03's unit-testable parts
- [ ] New cases in `broker-launch.test.ts` and `broker-control.test.ts` — covers REPRO-01/REPRO-05
- [ ] Evidence scripts under `.planning/phases/33-…/evidence/` for the five transcripts (`D-07`, `D-10`)
- [ ] Framework install: **none needed**

**`D-08` compliance:** every file above is corpus-free and terminates, so `MANUAL_ONLY_TESTS`
stays at exactly nine and the nine-file `assert.deepEqual` in `test-gate.test.ts` is untouched.
That is the default expectation `D-08` states, and this test map is designed to hold it.

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level` is 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user-facing auth surface. The broker control plane's `token` is an existing capability token read from `broker.json`; this phase adds a field to an already-authenticated op |
| V3 Session Management | no | The broker lease *is* the connection; no session tokens are minted here |
| V4 Access Control | **yes** | The binary monitor is unauthenticated by design and grants full memory read/write plus process control. Keep `binmonHost` defaulting to `127.0.0.1`, and preserve the existing one-time widened-bind stderr note. `profile` must never widen a bind |
| V5 Input Validation | **yes** | Two new untrusted-input parsers. See below |
| V6 Cryptography | **yes** (narrow) | sha256 only, via `node:crypto`. Never hand-roll a digest; `compare.mjs digest` already exists |
| V7 Error Handling & Logging | **yes** | The refusal messages must name the offending value and the valid range, matching this tree's convention. Never swallow a malformed `.vsf` into a plausible image |
| V12 Files & Resources | **yes** | The `.vsf` is read from `snapshotPathFor()`, which is deliberately confined inside the workspace ("keeping it inside the workspace makes workspace escape structurally impossible rather than merely checked"). `vsf-slice.ts` must not accept an arbitrary caller-supplied absolute path without going through that seam |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/hostile `.vsf` drives an out-of-bounds read or an enormous allocation | Denial of Service | Bound-check **every** wire-derived offset before using it. `size < 22 || off + size > file.length` → refuse. Never `subarray` on an unvalidated length; a short `subarray` silently returns fewer bytes than asked |
| Malformed `.vsf` yields a plausible-but-garbage 64K image | Tampering | Strict walk with no resync (P2), plus the terminal `off === file.length` assertion. A wrong image poisons every downstream number and the corpus would have to be re-derived (`D-21`'s stated cost) |
| Container-supplied `profile` field is trusted structurally | Tampering / Elevation | The control plane's `ControlRequest` has an index signature, so *anything* parses. Validate `profile` explicitly: object or absent; `warp`/`headless` boolean or absent; **reject unknown keys by name**, matching `RUN_UNTIL_KEYS`' own discipline. An unvalidated `profile` is an argv-injection surface into `buildViceArgs()` |
| `profile` used to smuggle argv | Elevation of Privilege | `profile` must map to a **fixed set of literal flags**, never to a passthrough string. No `profile.extraArgs`, ever. `VICE_ARGS` already exists as the deliberate, operator-only whole-argv override and short-circuits ahead of both branches |
| A resource-set path reaching a power-cycling resource | Denial of Service | `MachineVideoStandard`, `VICIIModel`, `MachinePowerFrequency` reach `machine_trigger_reset(POWER_CYCLE)` one call deep. This phase adds no resource-set surface; keep it that way |
| Widened binmon bind exposing the emulator | Information Disclosure / Elevation | Loopback default preserved; the one-time stderr note preserved verbatim |
| Corpus bytes leaking into git | Information Disclosure | `D-27`: never committed. Already enforced by `corpus/.gitignore:13` (`*.d64`). Any new capture output directory needs the same treatment before the first capture, not after |
| Broker-stopped discipline silently violated, poisoning evidence | Repudiation | `D-11`: every transcript records the broker state and the `test:automated` baseline. A measurement against a live broker is unrepairable and must be discarded |

---

## Sources

### Primary (HIGH confidence)

- **Live probes against genuine stock VICE 3.9 (`/usr/bin/x64sc`), 2026-09-02, broker stopped** — `-help` flag enumeration; `RESOURCE_GET` (0x51) reads of 9 resources; `REGISTERS_AVAILABLE` (0x83) catalog; `.vsf` header hexdump and full 27-module table walk; the jitter 0/1500/4000 reset-protocol triple; the `-warp` neutrality run; the `-console` position-sensitivity matrix; the autostarted `danish.d64` wall-clock-anchored pair. All numbers in `## Measured Evidence`.
- **`npm run test:automated`, 2026-09-02, current `HEAD`, broker stopped** — EXIT=1, `pass 3019 / fail 5`, 3 files, root causes named in P8.
- In-tree source, read this session: `broker-launch.mts:153-232` (`buildViceArgs`), `broker-launch.test.ts:1761-1960` (argv assertions), `stock-run-until.ts:1-161`, `stock-protocol.ts:375-598, 876-915, 1365-1374`, `stock-machine.ts:48-122`, `stock-paths.ts:61-191`, `broker-control.mts:30-58, 534`, `vice-broker-client.ts:372, 867`, `vice-broker.mts:473-556`, `test-gate.test.ts:16-55`, `test-gate.mjs:1-40`, `build.ts:42-62`, `capability-registry.ts:265-290`, `stock-schema-check.ts:1-50`, `manifest-arg-compat.test.ts:1-60`, `fork-manifest-surface.test.ts:1-40`, `docs-deferred-ledger.test.ts:1-55`, `tools-manifest.stock.json` (`vice_run_until`), `compare.mjs:1-60`, `capture-record.template.md`, `.planning/phases/23-…/evidence/vsf-ram-extract.mjs`.
- **VICE 3.8 source** at `/home/henrik/Downloads/vice-3.8/src` — `main.c:176-345`, `snapshot.c:64-68, 693-701, 800-870`, `snapshot.h:33-34`, `c64/c64memsnapshot.c:175-240, 267-292`, `c64/c64mem.h:36`, `c64/c64memsc.c` (`zero_read`, `zero_store`), `autostart.c:197-201, 355-362, 450-457, 875-886, 1418-1437`, `ram.c:42-53, 136-195`, `ram.h:33`, `lib.c:930-1000`, `resources.h` (`resource_int_s`), `initcmdline.c:315-320, 402, 418-427`, `monitor/monitor_binary.c:114-145, 695-760, 1622-1633`. **Version caveat: 3.8, not 3.9 — see Assumption A1.**
- `docs/phase0-binmon-findings.md` §5 — the settled normative wire format and confirmed opcode set.

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` §"v0.8.0 Requirements" — the ten requirement texts and their MEASURED annotations.
- `.planning/ROADMAP.md` Phase 33 entry — five success criteria and eight Notes.
- `.planning/phases/33-…/33-CONTEXT.md` — the 29 decisions, reproduced in `<user_constraints>`.
- `CLAUDE.md` §Constraints, §Conventions, §Architecture — reproduced in `## Project Constraints`.
- `docs/phase23-real-release-gate-findings.md` (referenced for the verdict frontmatter shape).
- `src/skills/c64-ram-capture/SKILL.md` and `RELEASES.json.example` (referenced, not fully read).

### Tertiary (LOW confidence)

- `scripts/generate-tool-support-table.mjs` and `tool-support-table.test.mjs` — located by filename search only; not read. See Assumption A8.
- `broker-state.mts`'s `InstanceRecord` shape — inferred from `selectWarmInstance()`'s usage. See Assumption A9.

**No WebSearch or external-documentation lookup was performed.** Every claim in this document
is grounded in either a live measurement on this host, in-tree source, or the VICE source tree
on this host. That is deliberate: the phase's entire subject is the behaviour of one specific
binary on one specific machine, and a web result about "VICE" in general would be weaker
evidence than a probe.

---

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — no new dependency; every reused module read this session.
- **Launch determinism (`REPRO-01`, `REPRO-05`):** HIGH — reproduced live, with source-level root causes and one new nondeterminism source found (`AutostartDelayRandom`).
- **The reset protocol at the READY prompt (`REPRO-02`, `REPRO-03`):** HIGH — reproduced live at three jitter values, byte-identical, with the register triple measured.
- **The reset protocol on an autostarted release (`CAP-04`):** MEDIUM — the *failing* configuration is measured red (which is itself a required deliverable), but no frame-exact autostarted stop has been achieved. This is Q2 and the phase's largest risk.
- **`.vsf` slicing (`CAP-01`):** HIGH — module table walked byte-exactly against a real 3.9 snapshot; two of `D-21`/`D-24`'s specifics falsified with measured counter-values.
- **Equivalence predicate (`CAP-02`):** MEDIUM-HIGH — the mechanics and the correct normalisation fields are measured; the transient *count* at a frame-exact stop on a real release is unmeasured (Q4).
- **Pitfalls:** HIGH — nine of eleven are backed by a live observation or a quoted source line; P8 by a full suite run.
- **Guards and baselines:** HIGH — all guard files read; the suite baseline measured rather than assumed.

**Research date:** 2026-09-02
**Valid until:** 2026-10-02 for the VICE-behaviour findings (a stable 3.9 binary on a fixed
host — these do not drift). **7 days** for the `test:automated` baseline in P8 and the
`STATE.md`/`REQUIREMENTS.md` reconciliation state, both of which change with the next commit
to `.planning/`.
