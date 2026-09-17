# Requirements: c64-re-tools — v1.1.0 "The Prerequisite Doctor"

**Defined:** 2026-09-16
**Core Value:** A Claude session can reliably drive a real C64 emulator to
reverse-engineer a program — read and write memory, set checkpoints, capture RAM,
inspect chip state — and keep working when the emulator misbehaves.

*This milestone sits entirely **upstream** of that Core Value and does not extend
it. It is about the user's first hour: making the setup step's failure modes
visible before a session drives anything. Recorded here so no requirement below
is mistaken for a Core Value claim.*

## The governing constraint

**Never auto-install.** `CLAUDE.md`'s standing owner constraint (2026-09-08)
holds unchanged and is not re-litigated by any requirement here. Every surface
this milestone adds **detects and reports**; the user runs every install command.
**No requirement below may be satisfied by code that invokes a package manager.**
The three existing carve-outs (`scripts/ensure-mcp-deps.sh`, CI's `retry_apt
install -y acme`, the installer's `--vendor`) stay exactly as they are —
withdrawing them is Phase 57's goal, and Phase 57 is not in this milestone.

## v1.1.0 Requirements

### Prerequisite Declaration

- [ ] **DECL-01**: One committed declaration names every prerequisite, and for each one records its id, which skills and MCP capabilities it unblocks, and its remedy text per platform.
- [ ] **DECL-02**: The declaration is plain JSON, adds no new runtime dependency, and is readable by a Node below the MCP server's own version floor.
- [ ] **DECL-03**: The remedy text a user sees when a tool is missing comes from the declaration at every site that emits one, so a live refusal and the doctor cannot name different remedies for the same tool.
- [x] **DECL-04**: The declaration carries a version floor only for a tool whose absence at that version makes a shipped code path refuse. Today that is Node alone — no tool carries a version-floor field that nothing enforces.
- [x] **DECL-05**: The declaration ships in the published package, so a user who installed rather than cloned gets the same remedies.

### Tool Location Resolution

- [ ] **LOC-01**: A user can record a tool's absolute path in `.c64-re-tools/tools.json` and have every code path that resolves that tool honour it.
- [ ] **LOC-02**: One resolver seam owns the precedence order — environment variable, then `tools.json`, then `$PATH` or sibling probe — and both the doctor and the live dispatch path resolve through that same seam.
- [ ] **LOC-03**: An existing `VICE_BIN`, `ACME_BIN`, `ACME` or `GHIDRA_HOME` override still wins over the file, so no current developer setup, test invocation or CI step changes behaviour.
- [ ] **LOC-04**: `c1541` and `petcat` become locatable by the user, closing a gap where they are resolvable only as siblings of `x64sc`.
- [ ] **LOC-05**: dxa stays un-overridable by file or environment, and a `tools.json` entry naming it is refused by name rather than silently ignored.
- [ ] **LOC-06**: A `tools.json` entry naming a path that is absent, not executable, or a directory is refused by name, and the refusal says the file supplied it.
- [ ] **LOC-07**: `VICE_BROKER_NODE` stays environment-only, and that exclusion is documented where a reader would otherwise expect it in the file.

### The Doctor

- [ ] **DOCTOR-01**: A user can run one command and see, per skill and per MCP capability, whether it is ready and which missing tool blocks it.
- [ ] **DOCTOR-02**: The doctor starts and delivers its Node-floor verdict on a Node too old to run the MCP server.
- [ ] **DOCTOR-03**: Every tool row names the resolved path and which source supplied it — environment variable, `tools.json`, `$PATH`, or sibling probe.
- [ ] **DOCTOR-04**: The doctor reports no version number for any tool except Node, and reports ACME's standard library as its own row separate from the ACME binary.
- [ ] **DOCTOR-05**: The doctor resolves every tool by calling the same functions the live dispatch path calls, and contains no second detection implementation that could disagree with them.
- [ ] **DOCTOR-06**: The doctor's exit code distinguishes all-ready, only-optional-missing, and blocking-missing, and a test proves the exit code agrees with what was printed.
- [ ] **DOCTOR-07**: The doctor installs nothing, offers to install nothing, and has no flag that would install anything — it prints the remedy for the user to run.
- [ ] **DOCTOR-08**: A user can have the doctor write a commented `tools.json` template that contains no path the doctor did not itself resolve.
- [ ] **DOCTOR-09**: The doctor runs as a one-shot process and is never resident, so the per-process memoisation in the probes it reuses cannot serve a stale answer.

### Generated Documentation

- [ ] **GEN-01**: `README.md`'s per-platform install tables are generated from the declaration rather than maintained by hand.
- [ ] **GEN-02**: A build-failing guard catches divergence between the declaration and the generated section by comparing parsed records, never bytes.
- [ ] **GEN-03**: The guard is proven non-vacuous by a planted divergence that makes it fail.

## Future Requirements

Acknowledged, deferred, not in this roadmap.

### The Doctor

- **DOCTOR-F1**: `--json` machine-readable output, for a CI step or another agent to consume.
- **DOCTOR-F2**: A per-user machine-level location file (`~/.config/c64-re-tools/tools.json`) layered beneath the project-local one, since tool paths vary per machine rather than per checkout.

### Declaration

- **DECL-F1**: The installer package consumes the declaration to print a "what you will need" message at install time.
- **DECL-F2**: `acme-build/SKILL.md`'s ACME prefix list generated from the declaration rather than kept in prose.
- **DECL-F3**: The declaration gains a `unp64` record for the packer-identification oracle, with `unblocks.mcp` naming `oracle.probe` and `oracle.run` and a remedy carried from the recon skill's host-install step.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-installing any tool, under any flag | Standing owner constraint (`CLAUDE.md`, 2026-09-08), not up for re-litigation |
| A `--fix` flag on the doctor | The same line in its most tempting form. Claude Code's own `/doctor` crossed it in a later version; named here so it is not re-proposed as a convenience |
| Withdrawing the three never-auto-install carve-outs | That is Phase 57's goal (`INSTALL-01`..`05`), carried forward and deliberately not taken this milestone |
| Collapsing or removing either install path | Both the npm installer and the plugin marketplace route stay as they are |
| A dxa location override | `host-tool.mts:126-131` — dxa is vendored **and built** by this project, so an override could only select a binary it did not build and did not pin |
| `VICE_BROKER_NODE` moving into `tools.json` | `vice-launcher.sh` is bash and reads it before any working Node exists to parse JSON with |
| Reporting a VICE, ACME, Ghidra or dxa version number | No shipped tool refuses on one. `vice_cpu_history` runs over the text channel (`chis`); the VICE >= 3.10 floor is on `CPUHISTORY_GET`, an opcode no shipped tool calls |
| Spawning `x64sc` to probe it | The set of modules that spawn the emulator is deliberately frozen empty (`CLAUDE.md`); a version probe would reopen it for a number nothing acts on |
| A second detection path for the doctor | The "doctor that lies" failure. `DOCTOR-05` forbids it structurally rather than by discipline |
| Byte-identical guarding of the generated README | Owner decision 2026-09-13 removes that assertion class. `ENGINEERING_RULES.md` §11 already permits "an equivalent deterministic drift check" |
| Reconciling the 2026-09-14 retirement (`260914-poo`) | Put as a candidate at this open and declined for this milestone. Still owed, still first in line for the next one |

## Traceability

Populated at roadmap creation, 2026-09-16. **Every v1.1.0 requirement maps to
exactly one phase; there are no orphans and no requirement owned twice.**

Two mappings are deliberate departures from the researched phase shape and are
reasoned in `ROADMAP.md` -> "Sequencing Rationale (v1.1.0)" rather than left to
be read as sloppiness:

- **`DECL-03` is owned by Phase 60, not by the declaration phase.** Repointing
  every live refusal at the declaration edits `host-tool.mts`, whose compiled
  `resources/*.mjs` artifact is guarded byte-identically by
  `resources-sync.test.ts`. Phase 60 exists to isolate that first regeneration,
  so the edit belongs there rather than spread across two phases.
- **`LOC-01` and `LOC-02` are owned by Phase 60, not by Phase 59 which builds the
  seam.** Both are claims about *every code path* ("have every code path that
  resolves that tool honour it"; "both the doctor and the live dispatch path
  resolve through that same seam"), and neither can be true while only the module
  exists. Phase 59 owns the seam's own refusal semantics (`LOC-05`, `LOC-06`,
  `LOC-07`); Phase 60 owns the two that become true when the shipped code
  resolves through it.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DECL-01 | Phase 58 | Gaps Found |
| DECL-02 | Phase 58 | Gaps Found |
| DECL-04 | Phase 58 | Complete |
| DECL-05 | Phase 58 | Complete |
| LOC-05 | Phase 59 | Pending |
| LOC-06 | Phase 59 | Pending |
| LOC-07 | Phase 59 | Pending |
| LOC-01 | Phase 60 | Pending |
| LOC-02 | Phase 60 | Pending |
| LOC-03 | Phase 60 | Pending |
| LOC-04 | Phase 60 | Pending |
| DECL-03 | Phase 60 | Pending |
| DOCTOR-01 | Phase 61 | Pending |
| DOCTOR-02 | Phase 61 | Pending |
| DOCTOR-03 | Phase 61 | Pending |
| DOCTOR-04 | Phase 61 | Pending |
| DOCTOR-05 | Phase 61 | Pending |
| DOCTOR-06 | Phase 61 | Pending |
| DOCTOR-07 | Phase 61 | Pending |
| DOCTOR-08 | Phase 61 | Pending |
| DOCTOR-09 | Phase 61 | Pending |
| GEN-01 | Phase 62 | Pending |
| GEN-02 | Phase 62 | Pending |
| GEN-03 | Phase 62 | Pending |

**Coverage:**

- v1.1.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

**Per phase:** Phase 58 — 4 (`DECL-01`, `DECL-02`, `DECL-04`, `DECL-05`);
Phase 59 — 3 (`LOC-05`, `LOC-06`, `LOC-07`); Phase 60 — 5 (`LOC-01`, `LOC-02`,
`LOC-03`, `LOC-04`, `DECL-03`); Phase 61 — 9 (`DOCTOR-01`..`DOCTOR-09`);
Phase 62 — 3 (`GEN-01`, `GEN-02`, `GEN-03`).

**Not in this milestone and not in this table:** `VOCAB-01`..`06`,
`DOCS-01`..`04` and `INSTALL-01`..`05`, held by the carried Phases 51, 53, 54 and

57. Their requirement text stays live in `milestones/v1.0.0-REQUIREMENTS.md` and

their ROADMAP sections stay live; no phase of this milestone may absorb one.

---
*Requirements defined: 2026-09-16*
