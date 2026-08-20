# Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 10-adoption-boundaries-automated-bootstrap-and-the-removal
**Areas discussed:** Todo folding, Bootstrap mechanism, Guard seam location, Reassembly proof, Disasm replacement surface

---

## Todo folding

| Option | Description | Selected |
|--------|-------------|----------|
| Second-binmon-client doc + guard | `resolves_phase: 10` explicitly; its item 3 *is* criterion 1 (a real `--vice` guard mirroring `vice.ts`'s `DENY_LIST`). Items 1-2 are the wedge-triage table entry and the positive one-holder rule in the install docs. | ✓ |
| ACME `cbm/c64` library gap | `template.a` won't assemble on either documented ACME route; CI only probes `acme --version`. | ✓ |
| Neither — leave both pending | Keep Phase 10 to its five stated criteria. | |

**User's choice:** both folded.
**Notes:** Multi-select; both land in CONTEXT.md's Folded Todos with an explicit statement of how each fits scope.

---

## Bootstrap mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Synthesise the JSON ourselves | Write the `.regen2000proj` in Node from the binary's bytes — proven working live. No pty/tmux/modal/keystrokes; 0.12s on full 64K. Sets `system` and `use_illegal_opcodes` at birth. Cost: depends on the project-file schema. | (deferred to Claude) |
| Keystroke pty route as probed | What Phase 9 proved end-to-end. No schema knowledge needed, but costs tmux as a prerequisite plus a JSON post-edit anyway. | |
| Synthesise, keystroke as fallback | Both paths, both test suites, tmux still needed for the fallback to be real. | |

**User's choice:** *"im not sure its your job to figure that out"* — the mechanism decision was handed back.
**Notes:** Recorded as **D-01** in CONTEXT.md, decided from live evidence rather than left open, so the planner does not re-litigate it. The research that informed it was gathered during this discussion: `ProjectState`'s three required fields, the plain-JSON-with-gzipped-payload format (a first attempt failed on `invalid gzip header`), a working synthesised project exporting all six illegal opcodes correctly, and a 0.12s full-64K export. Read as a standing instruction not to bring mechanism choices back to the user in this phase.

---

## Bootstrap inputs

| Option | Description | Selected |
|--------|-------------|----------|
| `.prg` and flat 64K `.raw` | The two shapes this repo already produces; sidesteps `.vsf` parsing and the machine-type amendment. | |
| Add `.vsf` by handing it to r2000 | Keeps ROADMAP's `.vsf` preference, but `.vsf` is not headless-loadable, so it forces the pty route regardless. | |
| Add `.vsf` by parsing it ourselves | One code path, but means owning a VICE snapshot parser. | |

**User's choice:** Other — *"it must handle prg and d64 files"*.
**Notes:** `.d64` was in none of the offered options and is absent from ROADMAP criterion 3's wording. Captured as **D-02**/**D-03**. Flat 64K was *kept* on top of the user's two formats because `R2000-06`'s own text names it and D-01 makes it a two-line case — dropping it would leave that requirement partly unmet; the assumption is stated explicitly in CONTEXT.md. `.vsf` dropped, with the ROADMAP wording reconciliation flagged for the planner.

---

## Schema/version tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Round-trip test on a real binary | Synthesise, run real r2000, assert the export and the illegal-opcode decode. Catches a schema break as a red test. | |
| Pin the version and assert it | Probe `--version`, refuse outside a known-good range. Cheap, but detects a version change rather than an actual break, and blocks users on newer builds. | |
| Both | Runtime version probe plus the live round-trip test. | |

**User's choice:** Other — *"i want the simplest and cleverest way to support any versions of regenerator2000"*.
**Notes:** Read as an explicit rejection of version pinning. Captured as **D-04**: tolerance comes from *minimality* — write only the three non-`#[serde(default)]` fields plus the settings we deliberately force, so the file is forward-compatible by construction — plus proving it loaded by running r2000 once. No version table, no allow-list.

---

## Forced settings (`use_illegal_opcodes`, `system`)

| Option | Description | Selected |
|--------|-------------|----------|
| Always forced, pinned by a test | Matches Phase 9's amendments literally; no knob to get wrong. | ✓ (by delegation) |
| Forced, but overridable by flag | Same defaults with escape hatches; more surface. | |
| You decide | Planner's call. | ✓ |

**User's choice:** "You decide".
**Notes:** Decided as forced-and-pinned (**D-05**). Making illegal-opcode decoding optional would reintroduce, as a configuration choice, the exact defect the `toacme` caveats existed for.

---

## Guard seam location

| Option | Description | Selected |
|--------|-------------|----------|
| A module under `.claude/mcp/vice/` | Inherits `hostpath-consumers.test.ts`'s absence-assertion machinery and the CI test run; mirrors `DENY_LIST`. Tension: non-MCP code in the MCP directory. | ✓ (by delegation) |
| A skill script, `acme.mjs`'s shape | Matches "Tier 1 = same shape as acme-build calling acme" literally, but needs new test machinery *and* wiring skill tests into CI. | |
| Seam in mcp/vice, thin skill wrapper | Guard and both tests where the gates already reach; small skill script for CLI ergonomics. | ✓ |

**User's choice:** "you decide".
**Notes:** Decided as **D-06** — seam plus thin wrapper. The deciding fact was found during the discussion: `ci.yml` runs `npm test` only inside `.claude/mcp/vice`, so **no skill-side `*.test.mjs` runs in CI today** (`d64-parse`, `diff-images`, `watch-loads`, `dump-artifacts` are all unrun). A guard test in a skill script would be green-by-absence, and criteria 1 and 2 both say "pinned by a test". `hostpath-consumers.test.ts` also enumerates only that one directory. Phase 11 needs the seam there anyway.

---

## Reassembly proof

| Option | Description | Selected |
|--------|-------------|----------|
| Our own test; r2000 absent skips it | `disasm-roundtrip.test.ts`'s shape, with a `VICE_REQUIRE_R2000` gate. CI does not install r2000. | |
| Our own test, and CI installs r2000 | Every merge re-proves criterion 4; costs a Rust toolchain and ~5 minutes per run. | |
| Lean on r2000's own `--verify` | Already spawns a real `acme`; reported `✓ ACME — byte-identical (44 bytes)`. Cheapest — but it is r2000 checking its own export. | ✓ |

**User's choice:** "Lean on r2000's own `--verify`".
**Notes:** The internal-check caveat was stated in the option text and chosen anyway — recorded as the user's decision (**D-09**). A follow-up live check then found a real trap and it is captured as **D-10** without reversing the choice: with `ca65` present and ACME absent, `--verify` prints `✗ ACME — ACME not found in PATH (skipped)` followed by `✓ All roundtrip verifications passed.` and **exits 0**. With no assembler at all it correctly exits 1. Since criterion 4 is specifically about ACME/`!cpu 6510`, the check must key on the parsed ACME line and fail on `skipped`, never on the exit code. CI not installing r2000 (**D-11**) follows from the "cheapest" rationale.

---

## Disasm replacement surface

| Option | Description | Selected |
|--------|-------------|----------|
| New r2000 script, verb deleted | `disasm` leaves `acme.mjs` entirely; respects that file's assembling-only scope. | ✓ (in part) |
| Same verb, new engine | `node $A disasm` keeps working over r2000; nothing to relearn, but puts an r2000 dependency in an assembling-only file and hides the engine swap. | |
| A new skill of its own | Gives Phase 11's annotation store a home; costs a 7th skill across installer sync, plugin manifest and `check-skill-tool-coverage.mjs`. | |

**User's choice:** "You decide, i want it to be flexeble and simple without duplicating functionallity, use the best way".
**Notes:** Decided as **D-12** — verb, caveat section and `toacme` prerequisite all deleted; one implementation behind the D-06 seam; **no 7th skill**; both `acme-build` and `c64-program-recon` point at the single route rather than each carrying a copy. `acme.mjs` ends up wrapping `acme` alone, keeping its own stated scope true.

---

## Claude's Discretion

Delegated by the user and recorded as decisions rather than left open: **D-01**
(bootstrap mechanism), **D-05** (forced settings), **D-06** (seam location),
**D-12** (replacement surface). **D-11** (CI does not install r2000) follows from
the `--verify` choice.

Left genuinely open for research: how the skill-side entry reaches the seam
across the package boundary; whether `.d64` extraction extends `d64-parse.mjs`
in place; the CLI verb names.

## Deferred Ideas

- `.vsf` as a bootstrap input → Phase 11's `c64-ram-capture` extension.
- **`--mcp-server-stdio` for Phase 11** — found during this discussion; a stdio
  MCP transport would sidestep the fixed-port collision behind the
  one-project-at-a-time limit (`R2000-04`) entirely. Phase 11 should evaluate it
  before building against the HTTP transport.
- The `r2000_get_address_details` u16 overflow (`handler.rs:1894`) — upstream
  report; Phase 11 workaround.
- Non-ACME export formats (`64tass`, `ca65`, `kick`) — not scope.
- Two-project-limit *detection* — permanently out by the `R2000-04` fold.
- `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md` — semver-major, not
  this phase.
