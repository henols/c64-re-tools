---
phase: "36"
slug: "the-sleigh-language-and-the-ghidra-harness"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `36-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled by `/gsd-validate-phase` once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner (`node --test`) — no separate framework |
| **Config file** | none — `src/mcp/vice/package.json:58`'s `test` script is the whole config |
| **Quick run command** | `cd src/mcp/vice && node --test host-tool.test.ts ghidra-project.test.ts host-tool-transport.test.ts` |
| **Full suite command** | `cd src/mcp/vice && npm run test:automated` |
| **Estimated runtime** | ~5s quick · ~3min full |

**Recorded baseline, not a gate.** `npm run test:automated` does not start from
zero failures. The last recorded floor is **2 failing tests in 1 file
(2026-09-03, one named bookkeeping cause)**. Do **not** pin that number in an
assertion — **measure the floor immediately before the phase's first commit and
again after the last**, and record both readings. A residual failure at the
measured baseline is not caused by this phase.

**Three known environment effects on the suite:**

- A **live VICE broker deterministically reds the BACK-05 test.** Stop the broker
  before trusting any suite result.
- `npm test` (the full glob) **blocks indefinitely** on `vice-proxy.test.ts`.
  Use `test:automated` for all routine sampling.
- `test:automated` skips the `MANUAL_ONLY_TESTS` set — **exactly ten files today**
  (READ-IN-SOURCE `src/mcp/vice/test-gate.test.ts:16-32`; `dxa-live.test.ts` was
  the tenth, added by Phase 35). This phase adds the **eleventh**, and that costs
  two edits in one commit, not one — see the placement guard below.

**Ghidra is a host prerequisite, not a vendored dependency.** Every live-Ghidra
assertion in this phase needs `GHIDRA_HOME` pointing at a real 12.1.3 install
(`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/` on this host, an unpinned
probe unpack) and a JDK ≥ 21 (OpenJDK 21.0.12.1 measured present). `host-tool.mts`
already refuses by name when `GHIDRA_HOME` is unset or `support/analyzeHeadless`
is missing at the resolved path. **CI has no Ghidra provisioning step** — that
cost is carried from Phase 34's Assumption A3 and is explicitly out of this
phase's scope, which is exactly why every live assertion below routes to the
manual tier rather than to `test:automated`.

---

## Sampling Rate

- **After every task commit:** the quick run command, scoped to the files touched
- **After every plan wave:** `npm run test:automated`, compared against the measured baseline
- **After any wave touching the SLEIGH source:** the `sleigh` compile gate — it is
  hermetic and needs no live `analyzeHeadless`, so it belongs in the per-commit tier
- **Before `/gsd-verify-work`:** `test:automated` at the measured baseline, plus
  `npm run typecheck` and `node scripts/check-npm-packages.mjs` both green, **plus**
  every new live-Ghidra suite run at least once with its run log inspected for the
  exact literal `ERROR REPORT SCRIPT ERROR`
- **Max feedback latency:** ~5 seconds (quick), ~180 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test route (from RESEARCH.md § Validation Architecture)

| Req ID | Behaviour | Test Type | Route | File Exists? |
|--------|-----------|-----------|-------|-------------|
| — (seam prerequisite) | `buildAnalyzeHeadlessArgv()` emits `-processor`, `-loader`, `-loader-baseAddr`, `-scriptPath`, `-noanalysis` and per-script args; every new wire field typed in `normaliseHostToolRequest()`'s allowlist, unknown keys refused **by name**; argv stays an **array** never a shell string | unit, hermetic | extend `host-tool.test.ts` / `ghidra-project.test.ts` (both exist) | ✅ exists |
| OPC-01 | `sleigh` compile gate: exit 0 **AND** a produced `.sla` **AND** mtime strictly newer than **every** input (`.slaspec`, every `@include`d `.sinc`, the `6502.pspec`/`6502.cspec` it depends on) | unit/hermetic | `sleigh-compile-gate.test.ts` (new) | ❌ Wave 0 |
| OPC-01 | The gate is observed **red before** the sized-local fix and **green after** — reverting one fix reddens it | unit/hermetic, planted-violation | same file; the revert is the assertion, not a comment | ❌ Wave 0 |
| OPC-01 | All 105 opcode bytes stock `6502.slaspec` omits decode under the new language | live-Ghidra | new live suite (synthetic opcode sweep) | ❌ Wave 0 |
| OPC-02 | `XAA $8b`, immediate `LAX`/`LXA $ab`, `AHX`/`TAS`/`SHX`/`SHY` decode to **opaque userops** (`define pcodeop`), never to plausible p-code | live-Ghidra | new live suite — asserts the decoded form, not merely that the byte decoded | ❌ Wave 0 |
| OPC-02 | Loading `65c02.slaspec` in the same installation still yields **its** documented meanings for the bytes both claim (the new language is a separate `.ldefs` id, so `65C02` does not inherit the illegal bytes through `@include "6502.slaspec"`) | live-Ghidra | new live suite, non-collision check | ❌ Wave 0 |
| OPC-03 | Real corpus decoder-output **before/after** difference recorded, against `danish.d64`'s flat-64K capture — not only a synthetic sweep | live-Ghidra, manual | new live suite + committed evidence artifact under the phase evidence dir | ❌ Wave 0 |
| OPC-04 | The run log's `Using Language/Compiler:` line names the **new** id; the acceptance run under `6502:LE:16:default` is observed **FAILING** the 105-byte assertion | live-Ghidra, planted-violation | new live suite — the failing control is the assertion | ❌ Wave 0 |
| GHID-01 | Gate 1: a wrong expected count fires the **exact literal** `ERROR REPORT SCRIPT ERROR` while `analyzeHeadless`'s own exit status is still **0** | unit for the grep logic; live-Ghidra for the firing | `ghidra-harness-gates.test.ts` (new, string-literal half) + new live suite | ❌ Wave 0 |
| GHID-01 | Gate 2: classification count asserted as the **block total** from `mem.getBlocks()`, **not** the image size, on **both** import routes (`.prg`: 4887 lines vs 279 image bytes — the numbers differ by ~17x, which is why a weakened `> 0` check asserts nothing) | live-Ghidra, both routes | new live suite | ❌ Wave 0 |
| GHID-01 | Gate 3: the run is reproducible from a **committed** script, with Ghidra declared as a host prerequisite **by version** | structural + live | version-declaration assertion is hermetic; reproduction is live | ❌ Wave 0 |
| GHID-02 | Volatile carve proven **by disappearance**: removing the flag from `$0000-$0001` / `$D000-$DFFF` makes hardware writes **vanish** from the reference dump — observed red on the `.prg` route **and** the flat-64K route | live-Ghidra, planted-violation, both routes | new live suite; MEASURED reference dump to match: `4002 -> d020 WRITE`, `4007 -> d020 WRITE`, `400a -> 0001 READ`, `400e -> 0001 WRITE` | ❌ Wave 0 |
| GHID-03 | A loader-owned block at the same address has the flag set on the **existing** block (`mem.getBlock(addr)` first, `createUninitializedBlock` only on null) and is proven not to fall back to non-volatile through a swallowed `MemoryConflictException` | live-Ghidra, both routes | new live suite — the route-dependence **is** the finding; a one-route test structurally cannot cover this | ❌ Wave 0 |
| GHID-04 | Five structural facts exported through **`DecompInterface`**: an array bound, the split-pointer `CONCAT11` idiom (`PcodeOp.PIECE`, opcode 62), a record stride, ≥1 resolved computed jump, ≥1 self-modifying write target | live-Ghidra, real corpus | new live suite | ❌ Wave 0 |
| GHID-04 | `attempted == decompiled + timedOut` per function under a **committed** timeout ceiling (`DecompileResults.isTimedOut()` is distinct from `decompileCompleted()` — VERIFIED by `javap` against real 12.1.3 jars) | live-Ghidra | new live suite — this is the accounting that catches a silent short-fall | ❌ Wave 0 |
| GHID-04 | Unresolved dispatch reported as a **count and a list with NO denominator** — asserting the *absence* of a denominator, because `C2_SITES_ENUMERATED` is stated absent (`memmapshow` excluded by owner decision) | structural | assertion on the export's shape, hermetic against a captured fixture | ❌ Wave 0 |
| GHID-04 | Committed **control**: the same export routed through `DataTypeManager` returns essentially nothing, on the **same image** as the acceptance run | live-Ghidra, planted-violation | new live suite — the control runs on the same image or the comparison is not real | ❌ Wave 0 |
| GHID-05 | Cross-references carry their **access kind** (`RefType.READ` / `WRITE` / `READ_WRITE` / `FlowType.COMPUTED_JUMP` — VERIFIED as real constants by `javap -p -constants` against `SoftwareModeling.jar`) through to the transfer file | unit for the transfer-file shape; live for the extraction | hermetic shape test + new live suite | ❌ Wave 0 |
| V5 (ASVS) | Every new path-bearing wire field routes through `resolveWorkspacePath()` (`host-tool.mts:647-670`, incl. its symlink-aware ancestor-realpath walk); `processor` is a **language-id string, not a path** — validated against an anchored pattern (mirroring `RUN_ID_PATTERN`, `ghidra-project.mts:87`), never passed through unchecked | unit, hermetic | extend `host-tool.test.ts` | ✅ exists |

---

## Wave 0 Requirements

- [ ] `src/mcp/vice/sleigh-compile-gate.test.ts` — OPC-01's compile gate. Copy
      `dxa-build-gate.test.ts`'s **hermetic-scratch-tree** discipline but **not** its
      pass/fail signal: dxa gates on a **digest**, this gates on **exit 0 + artifact
      present + mtime newer than every input**. The distinction is load-bearing — a
      failed `sleigh` leaves the pre-shipped `6502.sla` (5094 bytes) in place, which a
      digest comparison against a moving target cannot catch.
- [ ] `src/mcp/vice/ghidra-harness-gates.test.ts` — the hermetic half of GHID-01: the
      exact-literal grep for `ERROR REPORT SCRIPT ERROR`, and the proof that a naive
      `error`/`fail` grep false-fires on the flat-64K route's benign `ZERO_PAGE`/`STACK`
      INFO lines. Both are string-logic assertions and need no Ghidra.
- [ ] Extension of `src/mcp/vice/host-tool.test.ts` and `ghidra-project.test.ts` — the
      seam-argv surface gap: `buildAnalyzeHeadlessArgv()` today emits only
      `[projectLocation, projectName, -import, importPath, -deleteProject, -preScript?,
      -postScript?]` with **no** `-processor`, `-loader`, `-loader-baseAddr`,
      `-scriptPath`, `-noanalysis` or per-script-argument support. `OPC-04` requires the
      `-processor` change in the **same commit** as the new `.ldefs` id, so this seam
      extension is the phase's first engineering task.
- [ ] One new live-Ghidra suite (name set by the plan) covering everything above marked
      live: `OPC-01`'s 105-byte decode, `OPC-02`, `OPC-03`, `OPC-04`'s criterion 1,
      `GHID-01`'s three gates, `GHID-02`/`GHID-03`'s carve on both routes, and
      `GHID-04`/`GHID-05`'s export plus its `DataTypeManager` control.
- [ ] `ci.yml` step for whichever new test file the above adds —
      `ci-suite-coverage.test.ts` asserts a committed test file has a matching CI step in
      the same commit.
- [ ] Framework install: **none** — Node's built-in runner already covers this phase.

**Placement guard — the eleventh `MANUAL_ONLY_TESTS` entry costs TWO edits in ONE
commit.** The array lives in `src/mcp/vice/test-gate.mjs` (hand-authored, not generated —
it has a `test-gate.d.mts` beside it, and `build.ts` does not emit it, so
`resources-sync.test.ts` is not in play). But `test-gate.test.ts:16` asserts the set
"contains exactly the **ten** dispositioned files" — that word and that array literal both
change, or the gate reds. Add the file, the array entry, and the assertion together, or the
new live suite silently runs inside `test:automated` and fails on every machine without
`GHIDRA_HOME`.

**Placement guard — keep every committed test under `src/mcp/vice/`.**
`ci-suite-coverage.test.ts` has no vendor/extension-tree skip and reds on a committed test
file in a directory with no matching `ci.yml` step. It also descends into
`.claude/worktrees/agent-*/`, so measure test counts **after** wave cleanup, never during.

**Naming guard — never put a phase number in a shipped string.**
`docs-dangling-refs.test.ts:355-375`'s FLOW-02 state machine scans shipped TS **string
literals** for phase numbers. A `.java` filename is not itself scanned, but the moment a
shipped `.ts` module names it as a `-postScript` argument, that literal is. Name the
promoted scripts for their **function** — `GhidraStructExport.java`, `VolatileCarve.java` —
not for phase 23. This is a name-it-right-from-the-start decision, not a rename-on-promotion
chore.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 105 opcode bytes decode; the unstable ones decode to opaque userops | OPC-01, OPC-02 | Needs a real `analyzeHeadless` run and a real Ghidra install; CI has no Ghidra provisioning step (Phase 34 Assumption A3, out of scope here) | Build the extension, install into `$GHIDRA_HOME`, run the harness over a synthetic opcode sweep under the new `-processor` id, assert each of the 105 bytes decodes and that `$8b` / `$ab` / `AHX` / `TAS` / `SHX` / `SHY` render as declared unknowns |
| `65c02.slaspec` non-collision | OPC-02 | Requires loading a second language in the same live installation | Load `65C02:LE:16:default` in the same install, decode the bytes both languages claim, assert the 65C02 documented meanings are unchanged |
| Language-used assertion, and the same run **failing** under the stock language | OPC-04 | The assertion reads `analyzeHeadless`'s own run log | Grep the run log's `Using Language/Compiler:` line for the new id; re-run with `-processor 6502:LE:16:default` and record the 105-byte assertion **failing** — a green run here would mean the gate asserts nothing |
| Before/after decompiler output on real cracked code | OPC-03 | The criterion is explicitly "real code containing illegal opcodes, not only a synthetic sweep" — a synthetic input structurally cannot satisfy it | Run the harness over `danish.d64`'s flat-64K capture under both languages, diff the decompiler output, commit the diff to the phase evidence dir. Each flat-64K image carries the `D-04` two-term-oracle statement in its own capture record |
| Volatile carve disappearance, **both** routes | GHID-02, GHID-03 | Planted-violation proof needs a real analysis pass; the `MemoryConflictException` path is MEASURED route-dependent, so one route is not evidence for the other | Run with the flag, capture the reference dump (expect `4002 -> d020 WRITE`, `4007 -> d020 WRITE`, `400a -> 0001 READ`, `400e -> 0001 WRITE`); remove the flag, observe those writes vanish. Repeat on the flat-64K route, where the image already occupies `$0000-$01FF` and collides with the language's own `ZERO_PAGE`/`STACK` blocks |
| `DecompInterface` export + `DataTypeManager` control | GHID-04, GHID-05 | Needs a real decompiler on a real binary; the control's whole point is comparison on the **same image** | Export the five fact kinds and the typed xrefs; re-run the same export routed through `DataTypeManager` on the same image; record that it returns essentially nothing. Record attempted/decompiled/timedOut and assert the identity under the committed ceiling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] Baseline measured before first commit **and** after last commit, both recorded
- [ ] The eleventh `MANUAL_ONLY_TESTS` entry landed with its array edit **and** the
      `"exactly the ten"` assertion update in the same commit
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
