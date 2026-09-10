# Research Summary: v0.9.0 Text Channel & Runtime Evidence Layer

**Project:** c64-re-tools  
**Domain:** Reverse-engineering toolchain for Commodore 64 programs; adding a second, text-oriented VICE monitor channel and a frame-exact execution-evidence layer  
**Researched:** 2026-09-06  
**Confidence:** MEDIUM-HIGH (HIGH for stack and architecture; MEDIUM for features and pitfalls, because several are explicitly UNVERIFIED gates)

---

## Executive Summary

v0.9.0 adds a **second monitor channel** (text-based, over VICE's `-remotemonitor` port) and a **runtime execution-evidence layer** (`memmapshow`, `prof flat`, `chis`, `backtrace`, `io` parsers) that reports whether an address was observed executing. Disagreement against the static disassembly view is the design's stated highest-value output. 

The research confirms the stack is minimal (no new npm dependencies), the parser boundary is well-scoped (five fixed-format text outputs), and the architecture mirrors the proven binary-monitor client pattern exactly. **The milestone's real gate is not implementation scope — it is proving dual-channel coexistence is safe.** Two critical, unverified hazards sit before any other work: 
1. Whether interleaved halt/resume across channels corrupts state
2. Whether enabling execution tracking perturbs the frame-exact reproducibility v0.8.0 just shipped

Both require live measurement before design is finalized; both could reshape the architecture fundamentally.

---

## Key Findings

### Recommended Stack

**No new runtime dependencies.** The entire four-feature scope (`text-channel`, `memmapshow`/`prof`/`chis`/`bt`/`io` parsers, `.annostore` evidence table, `c1541`/`petcat`/`cartconv` host binaries) is covered by `node:net`, `node:sqlite`, and `node:child_process`, all already in use or built-in. `package.json` stays at two dependencies (`@mastra/mcp`, `@mastra/core`).

**Core technologies:**
- **`node:net` (builtin)** — Text-monitor TCP client (connect to `-remotemonitor` port). Mirrors existing `vice-broker-client.ts` pattern; hand-rolled prompt-terminator detection per house style.
- **`node:sqlite` `DatabaseSync` (builtin, RC-stability on Node 24)** — Runtime-evidence table inside existing `.annostore` file. Schema bump only; `anno-store.ts` stays the one `node:sqlite` consumer (enforced by `anno-seam.test.ts`).
- **`node:child_process` `spawn` (builtin)** — Invoke `c1541`, `petcat`, `cartconv` host-side. Three new `HostToolId` members in existing `host-tool.mts` seam; no new spawn primitive or shell passthrough.

### Expected Features

**Must have (table stakes, gated on H1 — text-channel coexistence proof):**
- Text-channel protocol client + five format-specific parsers with pinned fixtures
- Runtime execution oracle (joined query: disagreement-first report of "runtime says code, block table says data/undefined")
- `prof flat N` ranked by self-time, joined against store labels/ranges (turns "top addresses" into "top named regions")
- `c1541` static structural (`bam`, `chain`, `block` — disk claimed vs. actual sector chains)
- `petcat` BASIC stub SYS-entry extraction (literal `$decimal` fast path; named decline on computed arguments)
- `cartconv` CRT bank splitting into N independent images (feeds existing single-image dxa/Ghidra flow)

**Should have (post-validation, v0.9.x):**
- `-keybuf` scenario primitive (needs empirical timing/length probe first — VICE docs are silent)
- `io <addr>` as second independent register-decode oracle (only if genuine disagreement found)
- `bt` at checkpoint cross-referenced against Ghidra's static call graph

**Defer (v1.x+):**
- Scripted `JOYPORT_SET` sequences (high complexity, gated on full resolution of H1)
- Drive-side claimed-vs-actual sector-read fastloader signal (gated on `Drive8TrueEmulation` proof)
- `petcat` computed-argument SYS resolution (arguably belongs to disassembly engines)

### Architecture Approach

The text-monitor client is a **second sibling to the binary-monitor client**, not a modification of it. `text-protocol.ts` (wire framing) + `text-connect.ts` (claim/dial/handshake) mirror `stock-protocol.ts` + `stock-connect.ts` exactly, because the wire format is unrelated (11/12-byte binary frames vs. newline-terminated text commands).

The critical new component is a **dual-channel serialization seam** — `monitor-lock.ts` or broker-level equivalent — that both dispatch layers acquire before issuing any halting command. Its exact shape (`in-process mutex` vs. `broker-level lease` vs. `time-sharing connect-gate`) is **determined by the coexistence probe's verdict**, not a free design choice.

**Major components and their responsibilities:**
1. **Text protocol + connect + serialization lock** — Socket framing, monitor claim extension, dual-channel halt arbitration (shape TBD by probe)
2. **Five format-specific parsers** — Pure functions; zero socket knowledge; fixtures pinned per VICE version + binary hash
3. **Runtime-evidence table + join query** — New DDL in `anno-store.ts`; new `anno-runtime-evidence.ts` module; `classFromRuntime()` as third independent classifier
4. **Text dispatch layer** — Stock-only tool surface for five commands
5. **Host-tool executor** — Three new `HostToolId` members; same seven synchronized edits per tool; path + version logging required

### Critical Pitfalls (Top 5)

**1. Format drift is semantic, not syntactic** (CRITICAL, HIGH confidence)  
VICE 3.4 silently inverted `mc`/`ms` glyph meaning with zero layout/delimiter changes; VICE 3.0 widened `chis`'s cycle column; VICE 3.5 added new `memmapshow` access class. A parser fixture pinned before 3.4 would silently report inverse truth with no exception.  
**Prevention:** Treat each parser as pinned to exact `(binary sha256, VICE version)` pair. Capture fixtures against ≥2 real VICE binaries. Parse into closed enums; fail loudly on unknown values.

**2. The probe gate is the spine** (CRITICAL, MEDIUM confidence — specifically UNVERIFIED for interleaving)  
Coexistence probe determines whether dual-channel lock is in-process mutex, broker-level lease, or time-sharing connect-gate. None of the architecture for features B–E should proceed until probe returns GO/DEGRADE/NO-GO.  
**Prevention:** Run five specific experiments (idle coexistence, foreign-halt visibility, concurrent in-flight commands, cross-channel resume visibility, abrupt-disconnect recovery) before designing `monitor-lock.ts`.

**3. Instrumentation vs frame-exact reproducibility** (CRITICAL, UNVERIFIED)  
v0.8.0 proved frame-exact reproducibility. Enabling `memmapshow`/`prof`/`chis` tracking might perturb instruction-level timing or alter nondeterminism baseline.  
**Prevention:** Run A/B diff at existing `REPRO-01..05` anchor sequence with tracking on vs off. Treat as **gate with explicit pass/fail rule**, not assumption.

**4. Interleaved halt/resume corruption** (CRITICAL, UNVERIFIED)  
Both channels halt machine globally. Text-channel halt while binary side believes running could corrupt the "poll on hit_count, never on paused state" invariant.  
**Prevention:** Probe specifically tests this; block all architecture work on probe result.

**5. Wedge-triage skill misdiagnosis regression** (CRITICAL, HIGH confidence)  
The `vice-wedge-triage` skill has fixed verdict vocabulary built for one channel. Text-channel halt the binary side doesn't see reads as exactly the `wedged` signature (two cycle brackets = 0) and triggers `vice_recycle`, destroying healthy instance.  
**Prevention:** Update skill's evidence table to include "text-channel hold" field and corresponding verdict **in same phase** text channel ships, not later.

---

## Implications for Roadmap

### Phase Structure (with Dependencies)

**Phase 1: Coexistence Probe (BLOCKING GATE)**
- **Deliverable:** Live experiment result (GO / DEGRADE / NO-GO) with proof of five specific measurements
- **Rationale:** Determines `monitor-lock.ts` shape. Building lock before probe returns = rework risk.
- **Addresses:** Pitfall 3 (interleaving), Pitfall 6 (text-server single-client), architecture sub-q3
- **Research flags:** This phase IS research. Five experiments are the research output.

**Phase 2A: Host-Tool Executor (`c1541`/`petcat`/`cartconv`) — PARALLEL with 1 & 2B**
- **Deliverable:** Three new `HostToolId` members; path + version resolution + logging for each
- **Rationale:** Zero dependencies on text-channel or probe outcome.
- **Addresses:** FEATURES §E (disk analysis), §F (BASIC stub), §G (cartridge splitting)
- **Avoids:** Pitfall 11 (PATH shadowing), Pitfall 12 (destructive-write evidence)
- **Research flags:** Minimal. Standard pattern extending existing seam.

**Phase 2B: Text Protocol + Connect + Serialization Lock — DEPENDS ON PHASE 1**
- **Deliverable:** `text-protocol.ts`, `text-connect.ts`, `monitor-lock.ts` (shape TBD by probe), `HeldLease` extension for `remoteMonitorPort` surface
- **Rationale:** Cannot design lock until phase 1 verdict. Must wire broker-side port surfacing before text client can dial.
- **Addresses:** ARCHITECTURE sub-q1 (where text client lives), sub-q2 (dual-channel controller), FEATURES §A
- **Avoids:** Pitfall 2 (frame-delimiter), Pitfall 4 (`default_memspace` races)
- **Research flags:** Prompt-terminator regex confirmed live; planted test splitting prompt across TCP segments required.

**Phase 3: Format-Specific Parsers + Fixtures — DEPENDS ON PHASE 1 samples**
- **Deliverable:** Five `text-parse-*.ts` modules; `textmon-fixtures.ts` with same `REQUIRED_PROVENANCE_KEYS` as `binmon-fixtures.ts`; fixtures captured against ≥2 real VICE binaries
- **Rationale:** Starts when phase 1's probe harness produces raw text. Parallel with phase 2B; both deliver independently.
- **Addresses:** FEATURES §B (runtime oracle), §D (profiling), architecture sub-q5
- **Avoids:** Pitfall 1 (format drift), Pitfall 10 (per-command capability probing)
- **Research flags:** Second real VICE binary test is REQUIRED, not optional.

**Phase 4: Text Dispatch Layer + Live Ingest Wiring**
- **Deliverable:** `text-dispatch.ts` tool surface; live wiring from text protocol → parser → dispatch → ingest verb
- **Rationale:** Depends on both phases 2B and 3.
- **Research flags:** None — mechanical wiring.

**Phase 5: Runtime-Evidence Schema + Join Query + `anno-runtime-evidence.ts` — PARALLEL DESIGN**
- **Deliverable:** New `anno_runtime_observation` table in DDL; `classFromRuntime()` function; join query (disagree-first); new `anno_*` verbs
- **Rationale:** Can be designed and unit-tested against synthetic rows in parallel with phase 4, but live wiring depends on phase 4.
- **Addresses:** FEATURES §B–C, architecture sub-q4
- **Avoids:** Pitfall 7 (soundness-asymmetry violations)
- **Research flags:** Three-state join rendering must be tested; plant a test proving disagreement state is reachable and visibly distinct.

**Phase 6: Instrumentation-vs-Reproducibility Measurement (BLOCKING GATE)**
- **Deliverable:** A/B diff at existing `REPRO-01..05` anchor sequence (tracking on vs off); explicit pass/fail decision
- **Rationale:** Must be resolved before evidence-layer capture is trusted as frame-exact-comparable.
- **Addresses:** Pitfall 9 (instrumentation collision)
- **Research flags:** This IS a gate. Decide pass/fail rule before running. If FAIL, evidence and reproducibility runs separate and explicitly labeled.

**Phase 7: Wedge-Triage Skill Update + `vice_diagnose` Evidence Field — PARALLEL with 4–5**
- **Deliverable:** `vice_diagnose` extended with text-channel-hold detection; `vice-wedge-triage` SKILL.md updated; live reproduction of two-channel contention signature
- **Rationale:** Ships in same phase as text-channel code, not later. Un-updated skill is actively dangerous.
- **Addresses:** Pitfall 5 (misdiagnosis regression)
- **Research flags:** Two-channel contention signature must be reproduced live and recorded in skill's provenance table (same HIGH-confidence discipline as existing verdicts).

**Phase 8: `.annostore` Schema Bump Decision (PLANNING ONLY)**
- **Deliverable:** Decision record: continue "refuse outright" on version mismatch, or add migration arm?
- **Rationale:** STACK flagged v3 bump's basis ("no store exists") likely stale after two milestones of real use.
- **Addresses:** STACK's recommendation to re-examine the precedent
- **Research flags:** Factual: do real projects' `.annostore` files exist? If yes, measure migration-arm cost/benefit vs. permanent breakage.

**Phase 9: `c1541` Supersession Question (PLANNING ONLY)**
- **Deliverable:** Decision record: keep `d64-parse.mjs` additive and `c1541` as complementary tool, or eventually supersede?
- **Rationale:** STACK says additive-only; ARCHITECTURE explicitly defers decision.

**Phase 10: Integration Test + Proof-01 Validation**
- **Deliverable:** End-to-end test (capture → parse → ingest → join) against real fixtures; `PROOF-01` independent check
- **Rationale:** Last — consumes finished, live runtime-evidence layer.
- **Research flags:** None — verification.

### Critical Decision Points

**1. Format-Drift Boundary (Resolved, implemented in Phase 3)**  
STACK found byte-for-byte identical output between stock 3.9 and fork 3.10. PITFALLS found historical SEMANTIC drift. Parser boundary must defend against future versions even though immediate measured risk is LOWER than potential risk. Implementation: pin fixtures to `(sha256, version)` pairs; fail on unrecognized enum values; re-test against second real VICE binary.

**2. Serialization Shape (Depends on Phase 1 probe)**  
Three verdicts:
- **GO** → in-process async mutex (thin, cheap)
- **DEGRADE** → broker-level per-operation halt-authority lease (more correct for multi-process)
- **NO-GO** → time-sharing connect-gate (channels never simultaneous live)

Only probe result should determine which gets built.

**3. Instrumentation Cost Gate (Phase 6)**  
If A/B measurement shows instrumentation perturbs frame-exact timing, evidence-layer captures cannot key on reproducibility. Decision: either separate runs explicitly, or accept evidence does NOT produce frame-exact-comparable captures. Decide rule before measuring.

**4. `.annostore` Migration Arm (Planning decision)**  
v3 bump basis ("no store exists") likely stale. **If real projects' `.annostore` files exist, this decision MUST be made; do not default silently.** Cost: one SQL `CREATE TABLE` per version, inside existing transactions. Benefit: existing projects remain usable.

**5. Wedge-Triage Skill Regression (Phase 7, ships with text channel)**  
Do not slip skill update to later phase. Un-updated skill actively encourages wrong remedy (recycle) for healthy, merely-contended instance. Evidence table field + live reproduction both required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | No new deps; measured against repo source + live VICE binaries (stock 3.9, fork 3.10). Five commands byte-identical on measured pair. |
| Features | **MEDIUM-HIGH** | Structure clear; dependencies well-mapped. Three features depend on unverified Pitfall 3 (interleaving safety). |
| Architecture | **MEDIUM-HIGH** | Text-client pattern mirrors binary-client (HIGH). Three lock shapes clearly articulated. Sub-q3 (probe) explicitly unresolved; everything downstream depends on it. |
| Pitfalls | **MEDIUM** | Several HIGH (format drift history, T-server single-client limit exists for binary, wedge-triage structure). Three UNVERIFIED gates: interleaving (P3), text-server limit (P6), instrumentation (P9). All three are blocking. |

**Overall: MEDIUM** — Work is well-scoped and well-understood IF three gates resolve favorably (GO, single-client limit exists, instrumentation doesn't perturb timing). If any gate returns unexpected result, significant re-architecture needed.

### Gaps to Address During Planning / Execution

1. **Interleaved halt/resume behaviour** (Pitfall 3) — UNVERIFIED, Phase 1 measurement required
2. **Text-server single-client limit** (Pitfall 6) — UNVERIFIED, Phase 1 measurement required
3. **Instrumentation timing impact** (Pitfall 9) — UNVERIFIED, Phase 6 measurement required before evidence-layer integration
4. **Format drift across VICE versions beyond 3.9/3.10** — Not measured, second real VICE binary test in Phase 3 required
5. **Real-world `.annostore` file existence** — Not confirmed, decision point Phase 8 requires factual check
6. **Two-channel contention signature in `vice_diagnose`** — Needs live reproduction before verdict added (Phase 7)

---

## Sources & Confidence Breakdown

### Primary (HIGH confidence)
- **STACK.md** — Measured against repo source + live VICE binaries (stock 3.9, fork 3.10)
- **ARCHITECTURE.md** — Cited against specific source lines; mirrors proven binary-monitor pattern
- **FEATURES.md** — Grounded in VICE manual and comparable toolchains (radare2, Ghidra)
- **PITFALLS.md** — Mixed: several items sourced against VICE changelog/`configure.ac` (HIGH); three explicitly UNVERIFIED gates
- **PROJECT.md** — Milestone context and decision history

### Secondary (MEDIUM confidence)
- **Live probe results** (`.planning/notes/text-monitor-channel-live-probe.md`) — Bind-time coexistence confirmed; interleaved command behaviour explicitly "not tested"
- **Existing skill provenance** (`vice-wedge-triage` SKILL.md) — Verdict vocabulary assessed against Pitfall 5

### Tertiary (LOW-MEDIUM confidence, noted as gaps)
- **VICE changelog / `configure.ac`** — Version-drift history and build flag polarity; should be re-confirmed against raw files before load-bearing use

---

*Research synthesis completed: 2026-09-06*  
*Ready for roadmap creation.*
