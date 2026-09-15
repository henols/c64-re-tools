# Phase 50: Equivalence and Modifiability - Research

**Researched:** 2026-09-15
**Domain:** Driving existing, committed VICE-comparison and reassembly-gate machinery in a mode it has not been run in yet, plus CI wiring for a synthetic-fixture pipeline. No new library, no new external tool.
**Confidence:** HIGH for what exists on disk. Every claim below is `Read`/`grep`-verified this session. MEDIUM-LOW for how the emulator behaves when driven in the new mode. One committed document already records an unexplained, disclosed anomaly in exactly this area — see "The single biggest planning risk" below.

## Summary

Phase 50 is almost entirely composition, not invention. `compare.mjs` (the
RAM-image classifier), the reassembly gate (`reassembly-gate.ts` + its three
producer siblings), and the committed hazard subject from Phase 48 all
already exist and are already tested. Together they already produced one
real, committed verdict (`acknowledged`, rule `R10`) against the
*unmodified* subject. Three things do **not** exist yet:

- **(a) A cross-binary comparison mode for `compare.mjs`.** No allowlist for
  intentional differences exists. No per-binary checkpoint pairing exists.
  Only a same-image drift-floor precedent exists.
- **(b) A working way to load the bare `hazard-subject.prg` through the
  project's own sanctioned `vice_autostart` MCP tool.** That tool's AUTOSTART
  wire command defaults to a disk-image-guessing mode. Phase 48's own live
  investigation already proved that mode fails on a raw `.prg`. **No
  committed disk-image writer exists** to work around it.
- **(c) A reusable VICE transcript module.** Prior phases established the
  *pattern* (a `docs/phaseNN-*.md` file with dated command lines and raw
  excerpts) but never a reusable module.

The single largest planning risk is not tooling. It is behavior. Phase 48's
own `FIXTURE-DESIGN.md` records a disclosed and *not* re-investigated
finding: the combined hazard subject's on-screen effects (border color,
sprite, custom glyph, raster split) **revert to the default BASIC screen
before any settled capture**. Phase 48's own investigation could not pin down the reason. Four different
mid-execution cycle counts also failed to catch the effects. A plan that assumes "assemble it, autostart it, screenshot
it" will silently reproduce that same unexplained blank result.

Phase 48 itself already validated a way out: checkpoint/memory-based capture
(the existing `c64-ram-capture` procedure), not screen capture. This research
recommends the planner design EQUIV-02/03's "observed taking effect" evidence
around `vice_checkpoint_add` + `vice_memory_read`. Phase 48's own
isolated-construction tests, run without the raster construction, DID show
real, direct, visible effects this way. Do not design that evidence around
`-exitscreenshot`.

**Primary recommendation:** Build EQUIV-01/02/03 around the existing
`compare.mjs`/checkpoint capture pipeline (RAM-image diffing, not screen
capture), reuse `reassembly-gate.ts` and its producers unmodified against a
newly modified hazard-subject variant, and budget explicit time for the
disk-image-wrapping gap (no committed `.d64` writer exists) before assuming
`vice_autostart` will "just work" on the modified `.prg`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RAM-image classification (volatile/drift/divergence) | Pure logic (`compare.mjs`, Node script) | — | Already a standalone, contact-nothing module. Stays that way per its own header |
| Cross-binary volatile mask + allowlist (NEW) | Pure logic (new module or `compare.mjs` extension) | — | Same tier as the existing classifier. Must be committed as data/code before any rebuild is compared under it (criterion 1's "committed before any rebuild is compared under it") |
| Reassembly verdict (gate) | Pure logic (`reassembly-gate.ts`) | — | Reads no exit status, opens no file, spawns nothing. Inputs arrive pre-resolved. Unchanged from Phase 49 |
| Gate input producers (tree rebuild, movement, hazard disposition) | MCP-adjacent Node modules (`acme-verify.ts`, `reassembly-gate-movement.ts`, `reassembly-gate-ack.ts`) | Host tool (spawns real ACME) | Already exist, already tested against the hazard subject |
| Emulator control / transcript capture | `vice_*` MCP tools over the binary monitor | Broker (launch, warm floor) | The ONLY sanctioned route (`SKILL.md`'s own rule). No direct x64sc CLI invocation for the "artifact of record" |
| Disk-image authoring (wrapping the modified `.prg` for autostart) | Host tool (`c1541`, real binary) | — | **Gap**: the only committed `c1541` wrapper (`c1541.mjs`) is read-only by design. No write path exists in the host-tool seam today |
| CI freshness check (transcript vs. fixture hash) | Node test file, in-repo | GitHub Actions runner | Follows the existing `resources-sync.test.ts` drift-guard pattern. No emulator needed on the runner |

## Standard Stack

No new library and no new external tool. Every piece of machinery this
phase composes is already committed TypeScript/Node inside
`src/mcp/vice/` or `src/skills/`. `## Package Legitimacy Audit` is
therefore not applicable — no `npm install` for this phase.

### Core (existing, reused)

| Module | Path | Purpose | Provenance |
|---|---|---|---|
| `compare.mjs` | `src/skills/c64-ram-capture/scripts/compare.mjs` | 64K RAM-image classifier: `compare`/`floor`/`digest` verbs | `[VERIFIED: src/skills/c64-ram-capture/scripts/compare.mjs]` — read in full this session |
| `derive-transients.mjs` | `src/skills/c64-ram-capture/scripts/derive-transients.mjs` | Per-**release** transient allow-list derivation (`derive`/`check` verbs) — the closest existing precedent for "an allowlist", but for same-binary drift across runs, never cross-binary intentional differences | `[VERIFIED: src/skills/c64-ram-capture/scripts/derive-transients.mjs:311,336,489,524]` |
| `reassembly-gate.ts` | `src/mcp/vice/reassembly-gate.ts` | The 7-input, 12-rule, first-match-wins gate (`runReassemblyGate()`) | `[VERIFIED: src/mcp/vice/reassembly-gate.ts]` — read in full this session |
| `reassembly-gate-movement.ts` | `src/mcp/vice/reassembly-gate-movement.ts` | `relocateSubject()`, produces `MovementResult` | `[VERIFIED: 49-04-SUMMARY.md, cross-checked against reassembly-gate.ts's MovementResult type]` |
| `reassembly-gate-ack.ts` | `src/mcp/vice/reassembly-gate-ack.ts` | `matchHazardAcknowledgements()`, `disposeHazardReport()` → `HazardAcknowledgementResult` | `[VERIFIED: 49-05-SUMMARY.md, cross-checked against reassembly-gate.ts's HazardAcknowledgementResult type]` |
| `anno-hazard-report.ts` | `src/mcp/vice/anno-hazard-report.ts` | `buildHazardReport()` (line 1125), `HazardFinding`/`HazardReport` types | `[VERIFIED: src/mcp/vice/anno-hazard-report.ts:182,357,1125]` |
| `acme-verify.ts` | `src/mcp/vice/acme-verify.ts` | `verifyAcmeAssembles()`/`verifyAcmeAssemblesTree()` — the one real-ACME byte-diff oracle | `[VERIFIED: 49-02-SUMMARY.md]` |
| `acme-gate.ts` | `src/mcp/vice/acme-gate.ts` | `probeAcme()`, `ACME_AVAILABLE`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()` — the shared ACME-availability-gate pattern every ACME-dependent test file uses | `[VERIFIED: src/mcp/vice/acme-gate.ts:71,77,89,99,115]` |
| `resources-sync.test.ts` | `src/mcp/vice/resources-sync.test.ts` | The existing "drift guard" pattern (rebuild from source, byte-compare against committed artifact) — model for criterion 5's transcript-freshness check | `[VERIFIED: src/mcp/vice/resources-sync.test.ts:1-50]` |

### What must be newly written this phase

- A cross-binary volatile mask + allowlist module (extends or sits beside `compare.mjs`). Criterion 1 requires it **committed before** any rebuild is compared under it.
- The disk-image wrapper for autostarting the modified subject (see "Don't Hand-Roll" / gap below).
- The committed VICE transcript(s) themselves. No reusable transcript-writer module exists yet — prior phases hand-wrote `docs/phaseNN-*.md` files.
- A CI-adjacent test asserting transcript freshness against the fixture's hash.

## Package Legitimacy Audit

Not applicable — this phase installs no external package. `npm install acme`
is a CI-only, already-existing step (`.github/workflows/ci.yml:45-81`). This
phase's own work introduces no new dependency.

## Architecture Patterns

### System Architecture Diagram

```
 Phase 48 subject                Phase 49 gate (already green/acknowledged
 (hazard-subject.a/.prg,          for the UNMODIFIED subject)
 hazard-subject.annostore.json)        │
        │                              │ reused, unmodified
        │  one behaviour removed,      ▼
        │  one behaviour added   ┌─────────────────────────┐
        ▼                        │ reassembly-gate.ts        │
 modified hazard-subject.a  ───▶ │  + acme-verify.ts         │──▶ GateVerdict
 (new .a source, re-derived     │  + reassembly-gate-        │   (green | acknowledged | red)
  .prg + .annostore via the     │    movement.ts             │
  existing regenerator scripts) │  + reassembly-gate-ack.ts  │
        │                        └─────────────────────────┘
        │  wrapped in a .d64 (NEW — no writer exists)
        ▼
 vice_disk_attach / vice_autostart (MCP, binary monitor)
        │
        ▼
 vice_checkpoint_add + vice_execution_run + vice_memory_read
 (NOT vice_registers_get + -exitscreenshot — see risk note)
        │
        ▼
 64K RAM image  ──▶  compare.mjs (original image) vs (rebuilt/modified image)
        │                  │
        │          NEW: narrowed volatile mask (committed first)
        │          NEW: allowlist for intentional differences
        │          NEW: per-binary logical checkpoints
        ▼
 committed transcript (docs/phase50-*.md, following the phase41/49 pattern)
        │
        ▼
 CI: npm test / npm run test:automated (already runs the store→export→
     assemble→gate→byte-diff segment for the UNMODIFIED subject via
     hazard-subject-reassembly.test.ts + reassembly-gate-run.test.ts;
     NEW work extends this to the modified subject and adds a transcript-
     freshness-vs-fixture-hash check)
```

### Recommended file layout for new work

```
src/mcp/vice/fixtures/hazard-subject/
├── hazard-subject-modified.a          # NEW: the +1/-1 behaviour variant, OR
│                                        an in-place amendment of hazard-subject.a
│                                        (the plan must decide which; see Open Questions)
├── hazard-subject-modified.prg         # NEW: regenerated via the existing
│                                        make-hazard-subject-fixtures.mjs pattern
├── hazard-subject-modified.annostore.json  # NEW: via make-hazard-subject-annostore.mjs pattern
src/skills/c64-ram-capture/scripts/
├── compare-cross-binary.mjs (or an extension of compare.mjs)  # NEW: narrowed mask + allowlist
docs/
├── phase50-equivalence-findings.md     # NEW: the gate verdict for the MODIFIED subject
├── phase50-vice-transcript-*.md        # NEW: the committed emulator transcripts (criteria 2, 3, 4)
```

### Pattern 1: The pre-commitment gate pattern (already established, Phases 9/23/33/39/49)

**What:** `SCHEMA.md` + `DECISION-RULE.md` committed together, before any
measurement evidence file exists in the same directory.
**When to use:** Criterion 1 explicitly requires the narrowed volatile mask
"committed before any rebuild is compared under it". This is the identical
discipline, already proven four times in this repo.
**Example:** `.planning/phases/49-.../evidence/SCHEMA.md` +
`DECISION-RULE.md`, committed alone in the first two commits of Phase 49
(`[VERIFIED: 49-01-SUMMARY.md]`).

### Pattern 2: ACME-availability gate (already established)

**What:** One always-run "ACME availability gate" test per file
(`assertAcmeRequiredIfEnvSet(assert)`), computed once via
`acmeSkipReasonFor(testFileName)`. With `VICE_REQUIRE_ACME=1` (CI sets this),
a missing assembler is a hard FAIL, not a silent skip.
**When to use:** Any new test file this phase adds that spawns real ACME
against the modified subject.
**Example:** `[VERIFIED: src/mcp/vice/hazard-subject-reassembly.test.ts:19-24,52-54]`

### Pattern 3: Checkpoint-based memory capture (established, `c64-ram-capture` SKILL.md)

**What:** `vice_checkpoint_add` (stop=true) → `vice_execution_run` → poll
`vice_ping` until hit → 16× `vice_memory_read` (4096 bytes each) in the
**same paused window** → assemble via `dump-artifacts.mjs` → digest via
`compare.mjs digest`.
**When to use:** For EQUIV-02/03's "observed taking effect" evidence. This is
the ONLY capture technique Phase 48's own investigation found actually
shows a planted effect (isolated border-write and sprite constructions,
captured this way, were directly visible) — screen capture at settle was
not.
**Example:** `[VERIFIED: src/skills/c64-ram-capture/SKILL.md, "Capture at a trigger address" section, read in full this session]`

### Anti-Patterns to Avoid

- **Relying on `-exitscreenshot` / a settled-screen capture as the criterion-2/3/4 "observed taking effect" evidence for the combined subject**. Phase 48's own `FIXTURE-DESIGN.md` read this route as **program-blind by construction** (`## On-screen observations`, read in full this session). The document tried four cycle counts (2M/6M/12M/20M), plus a fully-settled capture. At every one of them, the aligned build, the mis-aligned build, and an unrelated control program produced identical or cursor-blink-only-differing captures. None of the four predicted effects (sprite, custom glyph, colour split, border change) ever became visible once the raster construction was present. This is a disclosed, investigated, *unresolved* finding, not folklore. Do not re-attempt the identical technique expecting a different result.
- **Widening the volatile mask until a rebuild passes.** The ROADMAP's own phase notes name this explicitly as the failure mode to avoid. Criterion 2 names it too ("a difference is resolved by naming it in the allowlist with why it is intentional, never by widening the mask"). The existing `derive-transients.mjs` module already refuses a re-derivation without `--force`
  (`[VERIFIED: src/skills/c64-ram-capture/SKILL.md "Re-deriving over an existing artifact is refused without --force"]`). That refusal sets the precedent for taking this seriously in code, not just in prose.
- **Re-deriving a second byte-diff or second hazard-report call.** `acme-seam.test.ts` already freezes the exact set of modules permitted to spawn ACME. It also freezes the exact set permitted to compare expected-vs-actual bytes (`ACME_SPAWN_SITES`, `EXPECTED_BYTES_COMPARISON_SITES`). A new module that does either is a defect this guard will catch (`[VERIFIED: 49-06-SUMMARY.md]`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| RAM-image byte classification | A second differ | `compare.mjs`'s `compare()` | Already pure, tested, and the volatile/drift/divergence taxonomy is exactly what criterion 1 needs extended, not replaced |
| Reassembly verdict logic | A second decision table | `reassembly-gate.ts`'s `runReassemblyGate()` | Frozen 12-rule table, already exhaustively tested (864-combination proof, `[VERIFIED: 49-05-SUMMARY.md]`) |
| ACME spawning | A third spawn site | `acme-verify.ts` (via `verifyAcmeAssemblesTree()`) | `acme-seam.test.ts` structurally forbids a second spawn site anywhere in the tree |
| Hazard-report finding | A second detector | `buildHazardReport()` (`anno-hazard-report.ts:1125`) | Already covers all 4 planted classes. Reused unmodified against a modified subject, it is exactly what criterion 4 asks for ("cross-referenced to a hazard-report finding") |

**Key insight:** Nothing in this phase's core mechanics is a hand-roll risk
— the risk is entirely in the one thing that is genuinely new:
cross-binary volatile-mask/allowlist design, and the disk-image-authoring
gap below.

## The gap this research found: no committed `.d64` writer

`vice_autostart` (`src/mcp/vice/stock-machine.ts:104-140`,
`[VERIFIED: read in full this session]`) sends the binary-monitor AUTOSTART
(0xdd) wire command via `autostartBody()`
(`[VERIFIED: src/mcp/vice/stock-protocol.ts:855-864]`), which carries no
format-selection field at all — `runAfter`, `fileIndex`, `filename` only.
Phase 48's own live investigation drove this exact wire command against a
bare `.prg` and it **failed with monitor error code `0x8f`**
(`[VERIFIED: src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md, "A second, independent attempt to load..." paragraph, read in full this session]`),
matching the CLI's own default `-autostartprgmode 2` ("disk image") failure
mode the same document measured. The only route Phase 48 found that
successfully loads a bare `.prg` is the CLI flag `-autostartprgmode 1`
(direct RAM injection) at **process launch time** — which is not how
`vice_autostart` works, and which the broker's own launcher
(`broker-launch.mts`) does not currently pass (`[VERIFIED: grep of
broker-launch.mts and vice-launcher.sh found no "autostartprgmode" anywhere
in this session]`).

The normal, everyday working route in this project is `vice_disk_attach` +
`vice_autostart` against a real `.d64` — that is how `c64-ram-capture`
`SKILL.md`'s own "Boot a disk" procedure works, and it is what every
existing corpus/fixture image (`danish.d64`, `saeger.d64`,
`fixtures/c1541/synthetic.d64`) already relies on. But:

- The only committed `c1541` wrapper, `c1541.mjs`, is **read-only by
  design** — its own header states "Read-only: directory, block allocation
  map, ... No write, format, delete or any other mutating verb is reachable
  from this script — deliberately"
  (`[VERIFIED: src/skills/c64-disk-access/scripts/c1541.mjs:1-4]`).
- The host-tool seam (`host-tool.mts`) only exposes five `c1541.*`
  capabilities, all read (`bam`/`dir`/`entry`/`chain`/`read`) — no write
  capability exists anywhere in the frozen `HOST_TOOL_NAMES` list
  (`[VERIFIED: src/mcp/vice/host-tool.mts:174-192]`).
- No generator script for any committed `.d64` fixture was found
  (`find . -iname "*.d64"` plus a grep for a matching generator name turned
  up only the four already-committed images with no producer script in the
  repository).

**This means Phase 50 needs either a small, new, scoped write capability
(most consistent with the project's existing seam discipline: a
`c1541.write` host-tool capability, following `never auto-install external
tools` — `c1541` is already resolved as an `x64sc` sibling by
`findSiblingBinary()`) or a documented decision to author the `.d64` once,
by hand, outside the committed tooling, and commit only the resulting
binary** (the same undocumented route the four existing `.d64` fixtures
appear to have taken). Either way, this is real, unbudgeted-for scope the
ROADMAP's phase description does not mention and the planner must size
explicitly.

## Common Pitfalls

### Pitfall 1: Trusting a green-only result (criterion 2's own named trap)

**What goes wrong:** Running `compare.mjs`/the new cross-binary mode only
against the real rebuild, seeing PASS, and calling it proof.
**Why it happens:** A green result alone cannot distinguish "the mask
correctly excludes only volatile bytes" from "the mask is wide enough to
hide a real regression."
**How to avoid:** Criterion 2 requires a **paired red transcript** — plant a
deliberate `$D020`/`$D015`/`$D018` regression in a rebuild copy and commit
its observed-FAIL transcript alongside the real PASS transcript, produced by
the identical mechanism.
**Warning signs:** A PLAN.md task that only runs the comparison once.

### Pitfall 2: Reusing the settled-screen capture technique without reading `FIXTURE-DESIGN.md` first

**What goes wrong:** A plan re-derives the exact `-autostart` /
`-exitscreenshot` sequence Phase 48 already tried and already found
program-blind, burning a wave discovering the same null result.
**Why it happens:** The failure is not in this project's own code — it is an
emulator-level phenomenon (interrupt-vector/VIC-CIA state resets before a
settled screen), so a plan that has not read the prior document has no
reason to expect it.
**How to avoid:** Design the "observed taking effect" evidence around
`vice_checkpoint_add` + `vice_memory_read` at a checkpoint set **inside or
immediately after** the modified routine — before whatever mechanism causes
the reversion — mirroring the isolated-construction captures that DID show
real effects.
**Warning signs:** Any task action naming `-exitscreenshot` or a "settled
screen" as the evidence for a specific planted behaviour.

### Pitfall 3: Treating the Phase 49 `acknowledged` verdict as still valid for the modified subject

**What goes wrong:** Citing `docs/phase49-the-reassembly-gate-findings.md`'s
`acknowledged`/`R10` verdict as satisfying criterion 4 without re-running the
gate against the actually-modified subject.
**Why it happens:** The ROADMAP's own dependency line ("Phase 49's gate, run
for real and green or explicitly acknowledged") is satisfied for the
*unmodified* subject already — it is tempting to read that as "the gate is
done."
**How to avoid:** Criterion 4 explicitly requires the modified source
"reassembled through Phase 49's gate" — meaning `runReassemblyGate()` (via
the same producer chain `reassembly-gate-run.test.ts` already demonstrates)
must be re-driven against the modified tree, and its own new verdict
recorded. The gate module itself needs zero changes. Only its inputs change.
**Warning signs:** A plan task that reads the existing findings doc instead
of running the gate again.

### Pitfall 4: Picking a modification that isn't cross-referenceable

**What goes wrong:** Removing/adding a trivial, unrelated constant (e.g., a
title-screen colour never touched by any hazard finding or moved range)
satisfies "one removed, one added" mechanically but not the ROADMAP's own
stated intent ("so the demonstration touches decomposed and rebuilt code
rather than an already-easy already-symbolised constant").
**Why it happens:** The five real hazard findings (below) are the harder,
more entangled candidates — a plan under time pressure may reach for an
easier, unrelated byte instead.
**How to avoid:** Anchor each change to one of the five committed findings
or the movement subject's own relocated range: `indexed-dispatch` at `$081C`
(`stack-return-dispatch`), `self-modifying-code` at `$0825`
(`store-target-in-instruction-opcode-byte`), `page-alignment` at `$0881`
(`charset-base-pinned-by-register`), `page-alignment` at `$088B`
(`sprite-pointer-names-aligned-base`), `cycle-exact-raster` at `$10C2`
(`timer-reload-in-vectored-handler`) — all five addresses and mechanism
strings quoted verbatim from
`[VERIFIED: docs/phase49-the-reassembly-gate-findings.md:147-156]`.
**Warning signs:** A diff whose changed bytes fall outside every named
finding's anchor/blocked address and outside the movement subject's own
relocated range.

## Code Examples

### Compare two RAM images and read the verdict programmatically

```javascript
// Source: src/skills/c64-ram-capture/scripts/compare.mjs (read in full this session)
node compare.mjs compare original.bin rebuild.bin --limit 0
// exits 1 on FAIL (any divergence: 2+ bits differing outside the volatile spans)
```

### The gate's exact input contract (all 7 fields required, compiler-enforced)

```typescript
// Source: src/mcp/vice/reassembly-gate.ts (read in full this session)
export interface GateInput {
  TREE_REBUILD: RebuildOutcome;        // "ok" | "failed" | "skipped"
  MOVEMENT_REBUILD: MovementOutcome;   // RebuildOutcome | "refused"
  HAZARD_DISPOSITION: HazardDisposition; // "clean" | "acknowledged" | "blocked"
  DIFF_SCOPE_COVERAGE: DiffScopeCoverage; // "complete" | "incomplete"
  RED_CONTROLS: RedControlsObservation;   // "all-observed" | "partial" | "none"
  SECOND_PATH_GUARD: GuardObservation;    // "held" | "breached"
  ORDERING_PROOF: GuardObservation;       // "held" | "breached"
}
const verdict = runReassemblyGate(input); // { outcome, rule, inputs, reason }
```

### The already-real run harness to imitate for the modified subject

```typescript
// Source: 49-07-SUMMARY.md, describing reassembly-gate-run.test.ts
// (produces TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, and both
// DIFF_SCOPE_COVERAGE occurrences from real machinery: real ACME, the
// committed subject, a real relocation via reassembly-gate-movement-subject.ts,
// the real hazard report, and disposeHazardReport() against a frozen
// per-finding acknowledgement array)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Same-binary drift-floor comparison only (`derive-transients.mjs`) | Cross-binary comparison with a committed, narrowed mask + allowlist (this phase) | Phase 50 (new) | `compare.mjs`'s existing classifier is reused. Only the mask/allowlist/checkpoint-pairing layer around it is new |
| Screen-capture-based "does it look right" (Phase 48's own investigation) | Checkpoint/memory-read-based capture | Established by Phase 48's own disclosed finding, 2026-09-13 | Screen capture is proven unreliable for this specific subject. Memory reads are the fallback this research recommends |

**Deprecated/outdated:** None — no library or protocol changed. The
"outdated" item above is a technique this project's own prior phase already
measured as unreliable for this specific fixture, not an industry
deprecation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new `c1541.write` host-tool capability (rather than a hand-authored, undocumented `.d64` commit) is the right way to close the disk-image gap | Don't Hand-Roll / gap section | If wrong, the plan instead documents a manual, one-time `.d64` authoring step outside committed tooling — smaller scope but less reproducible. Either is viable. This is Claude's-discretion-shaped, not locked |
| A2 | The modified hazard-subject variant should be a NEW sibling file (`hazard-subject-modified.a`) rather than amending `hazard-subject.a` in place | Recommended file layout | If wrong (in-place amendment preferred), the plan instead re-uses the existing regenerator scripts against the same file, and Phase 48's own committed subject becomes the "before" state in git history rather than a byte-identical sibling — a real design choice with downstream effects on how "before/after" transcripts cite paths |
| A3 | The checkpoint/memory-read technique will actually observe the two chosen behaviours (removed + added) before whatever caused Phase 48's reversion recurs | Pitfall 2 | If wrong, the plan needs its own investigation pass mirroring Phase 48's isolated-construction testing before committing to this technique as the criterion-4 evidence route |

**None of the machinery claims above (compare.mjs's interface, the gate's
rule table, the hazard findings' addresses, the autostart failure mode) are
assumed — each is tagged `[VERIFIED: <path>]` against a file this session
opened directly.** The three items above are the only genuinely open design
choices this research surfaces.

## Open Questions

1. **Should the disk-image gap be closed with a new host-tool write
   capability, or worked around entirely?**
   - What we know: no committed writer exists. `c1541.mjs` is read-only by
     design. The working CLI-flag route (`-autostartprgmode 1`) is not how
     `vice_autostart` operates, and the broker does not currently pass it.
   - What's unclear: whether adding write capability to the host-tool seam
     is in scope for a phase framed as "equivalence and modifiability", or
     whether it is a prerequisite quick-task/gap-closure item.
   - Recommendation: the planner should size this explicitly as its own
     task/wave rather than assume it is a one-line fix. It touches
     `host-tool.mts`'s frozen capability list, which has its own guard
     discipline (`ACME_SPAWN_SITES`-style frozen sets are common in this
     codebase, and a new capability may need a matching one).

2. **Which two of the five committed hazard findings (or the movement
   subject's own relocated range) are the best "one removed, one added"
   pair?**
   - What we know: all five are real, addressed, and mechanism-named
     (quoted above). The self-modifying-code and cycle-exact-raster
     findings are the two whose effects Phase 48 could NOT get to show on a
     settled screen when combined. The alignment and dispatch findings were
     more directly observable in isolation.
   - What's unclear: whether "removed" and "added" should be a byte-level
     change to an EXISTING finding's construction, or a genuinely new
     behaviour placed at the movement subject's relocated range.
   - Recommendation: prefer a finding whose effect is directly readable from
     RAM state at a checkpoint (e.g. the self-modifying routine's border
     write, or the alignment routine's sprite-pointer byte) over one that
     depends on cycle-exact raster timing, which is inherently harder to
     verify from a single checkpoint read.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | Reassembly gate, tree rebuild | ✓ (per repo's own CI/local convention. `acme-gate.ts` probes and skip-reasons rather than assuming) | 0.97 "Zem" per `FIXTURE-DESIGN.md`'s own provenance section | `acmeSkipReasonFor()` names the skip locally. CI's `VICE_REQUIRE_ACME=1` fails loudly instead |
| Stock VICE (`x64sc`) | Live emulator transcripts | Per project standing convention, detected not installed by this project | `x64sc (VICE 3.9)` observed in Phase 48/49's own live evidence | None. This is the load-bearing external dependency — no fallback exists for criteria 2/3/4 |
| `c1541` (real binary) | Disk-image authoring (new gap) | Resolved as an `x64sc` sibling via `findSiblingBinary()` per project convention (not independently re-probed this session) | — | None documented for a WRITE capability specifically |

**Missing dependencies with no fallback:** A committed `.d64`-writing route
(see the gap section above) — this blocks the sanctioned-tool-surface path
to autostarting the modified subject.

**Missing dependencies with fallback:** None beyond the above. ACME and
stock VICE are both standing, already-relied-upon project dependencies.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — colocated `*.test.ts` files, `[VERIFIED: package.json "test" script]` |
| Quick run command | `npm run test:automated` (from `src/mcp/vice/`) — runs `automatedTestFiles()`, every `*.test.*` file minus the 12-entry `MANUAL_ONLY_TESTS` list |
| Full suite command | `npm test` (from `src/mcp/vice/`) — the bare `*.test.*` glob, including manual-only files (which self-skip locally with no real emulator/broker opted in) |

**Known hazard, verified this session:** `ci.yml`'s own comments
(`[VERIFIED: .github/workflows/ci.yml:158-178]`) state CI deliberately runs
the WIDE glob (`npm test`, not `npm run test:automated`) because "two
suites... hang locally outside a devcontainer" — i.e., the full glob is
known to hang in a local, non-devcontainer environment. Use
`npm run test:automated` for local iteration during this phase. Reserve
`npm test` for CI or a devcontainer.

**MANUAL_ONLY_TESTS, verified this session (12 entries,
`[VERIFIED: src/mcp/vice/test-gate.mjs:141-154]`):**
`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`,
`stock-live.test.ts`, `stock-live-triage.test.ts`,
`stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`,
`stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`,
`ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`,
`text-monitor-live.test.ts`. None of the hazard-subject or reassembly-gate
test files are on this list (`[VERIFIED: grep -c "hazard-subject\|reassembly-gate" test-gate.mjs → 0]`)
— they already run under `npm run test:automated`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| EQUIV-01 | Cross-binary `compare.mjs` mode catches a planted `$D020`/`$D015`/`$D018` regression | unit + live-emulator | `node compare.mjs compare <original>.bin <regression>.bin` (exit 1 expected) | ❌ Wave 0 — new mask/allowlist module and its unit tests |
| EQUIV-02 | Real-vs-real comparison passes with a committed transcript. A broken control fails first | live-emulator (manual-only by nature) | Committed transcript under `docs/phase50-*.md`, following the `docs/phase41-text-channel-live-evidence.md` pattern | ❌ Wave 0 — no phase50 transcript exists yet |
| EQUIV-03 | One behaviour removed, one added, both observed via checkpoint/memory-read, reassembled through the real gate | integration + live-emulator | `npm run test:automated` (gate/reassembly portion) + a committed transcript | ❌ Wave 0 — modified subject, its `.a`/`.prg`/`.annostore`, and the new gate run all new |
| EQUIV-04 | CI runs the assemble→gate→byte-diff segment on committed fixtures alone. A stale transcript is caught | CI (automated) + freshness unit test | `npm test` (already runs `hazard-subject-reassembly.test.ts` + `reassembly-gate-run.test.ts` under `VICE_REQUIRE_ACME=1`). NEW: a `resources-sync.test.ts`-style freshness check | Partially ✓ (existing subject already covered) / ❌ (modified subject + freshness check are new) |

### Sampling Rate

- **Per task commit:** `npm run test:automated` (from `src/mcp/vice/`)
- **Per wave merge:** `npm test` in a devcontainer/CI context only (known local hang otherwise). Or `npm run test:automated` plus an explicit, opted-in single run of any new live-emulator test.
- **Phase gate:** `npm test` green under CI's own `VICE_REQUIRE_ACME=1` environment before `/gsd-verify-work`. Live-emulator transcript evidence is committed separately, not asserted by the automated suite. Transcripts are manual-only artifacts per the ROADMAP's own criterion 5 framing — CI checks their **freshness**, not their content.

### Wave 0 Gaps

- [ ] A committed, narrowed volatile mask + allowlist module for cross-binary comparison (criterion 1) — does not exist
- [ ] A modified hazard-subject `.a`/`.prg`/`.annostore` triple (criterion 3/4) — does not exist
- [ ] A disk-image write path for autostarting the modified `.prg` through the sanctioned `vice_*` tool surface (see Open Question 1) — does not exist
- [ ] `docs/phase50-*.md` transcript(s) for criteria 2, 3, 4 — do not exist
- [ ] A CI freshness check comparing a committed transcript's recorded fixture hash against the fixture's current hash — does not exist (model: `resources-sync.test.ts`)

## Security Domain

Not applicable in the ASVS sense — this phase touches no authentication,
session, or network-input surface. The one security-adjacent concern already
covered by standing project convention: any new host-tool capability
(the disk-write gap) must go through the existing container-out seam
discipline (`host-tools-must-go-through-a-container-out-seam`, already
enforced by `scripts/check-no-skill-external-spawn.mjs` in CI,
`[VERIFIED: .github/workflows/ci.yml:211-212]`) — never a direct `spawn()`
of `c1541` from a skill script.

## Sources

### Primary (HIGH confidence — files opened directly this session)
- `src/skills/c64-ram-capture/scripts/compare.mjs` — full read
- `src/skills/c64-ram-capture/scripts/derive-transients.mjs` — grep + SKILL.md cross-check
- `src/skills/c64-ram-capture/SKILL.md` — full read
- `src/mcp/vice/reassembly-gate.ts` — full read
- `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md` — full read
- `docs/phase49-the-reassembly-gate-findings.md` — full read
- `.planning/phases/48-.../48-0{1..6}-SUMMARY.md` — read
- `.planning/phases/49-.../49-0{1..7}-SUMMARY.md` — read
- `src/mcp/vice/stock-machine.ts` — read (`handleAutostart`)
- `src/mcp/vice/stock-protocol.ts` — read (`autostartBody`)
- `src/skills/c64-disk-access/scripts/c1541.mjs` — read (header)
- `src/mcp/vice/host-tool.mts` — grep (capability list)
- `.github/workflows/ci.yml` — full read
- `src/mcp/vice/test-gate.mjs` — read (`MANUAL_ONLY_TESTS`)
- `src/mcp/vice/resources-sync.test.ts` — read (pattern model)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — read

### Secondary (MEDIUM confidence)
- None used — this phase required no external documentation lookup. Everything relevant is in-repo.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack (what already exists): HIGH — every module cited was opened and read this session.
- Architecture (how the new pieces compose): HIGH for the machinery, MEDIUM for the disk-image gap resolution (genuinely open, flagged as Open Question 1).
- Pitfalls: HIGH. Three of four come straight from a committed document in this same codebase (Phase 48's `FIXTURE-DESIGN.md`, Phase 49's findings doc), not from inference.

**Research date:** 2026-09-15
**Valid until:** No external dependency drift risk exists — nothing here depends on a library version. Treat this research as valid until the modified hazard-subject fixture or the gate module itself changes.
