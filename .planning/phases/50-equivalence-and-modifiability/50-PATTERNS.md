# Phase 50: Equivalence and Modifiability - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 6 new/modified files (from RESEARCH.md "Recommended file layout" + VALIDATION.md Wave 0)
**Analogs found:** 6 / 6 (all tracked source, verified with `git ls-files`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` (or extension of `compare.mjs`) | utility (pure classifier) | transform (batch, offline) | `src/skills/c64-ram-capture/scripts/compare.mjs` | exact — same role, same data flow, sibling file in same directory |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.a` + `.prg` + `.annostore.json` | fixture / test data + generator | file-I/O (generate, deterministic) | `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` + `make-hazard-subject-fixtures.mjs` + `make-hazard-subject-annostore.mjs` | exact — literal sibling-fixture pattern already established in the same directory |
| new gate-run test/script driving `runReassemblyGate()` against the modified subject | test (integration) | event-driven (rule-table lookup over pre-resolved inputs) | `src/mcp/vice/reassembly-gate-run.test.ts` (+ `reassembly-gate.ts`, `acme-verify.ts`) | exact — same producer chain, only the subject tree changes |
| `docs/phase50-*.md` transcript(s) | documentation | request-response (recorded live-emulator session) | `docs/phase41-text-channel-live-evidence.md` (session-log shape); `docs/phase49-the-reassembly-gate-findings.md` (frontmatter-verdict shape) | exact — two distinct existing shapes to combine, both in `docs/` |
| CI freshness test (transcript fixture-hash vs. current fixture hash) | test (CI, automated) | transform (hash compare) | `src/mcp/vice/resources-sync.test.ts` | role-match — same "stale-committed-artifact-as-red" pattern, different artifact kind |
| disk-image write capability (`c1541.write`, if chosen — Open Question 1) | utility / host-tool capability | file-I/O (mutating) | `src/skills/c64-disk-access/scripts/c1541.mjs` (read-only sibling) + `src/mcp/vice/host-tool.mts` (capability registry) | role-match — same tool family, opposite mutability; no writing analog exists anywhere in the tree |

## Pattern Assignments

### `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs` (utility, transform)

**Analog:** `src/skills/c64-ram-capture/scripts/compare.mjs` (258 lines, read in full)

**Header/contract pattern** (lines 1-21): a top-of-file comment states (a) this is pure logic, contacts nothing, the `mcp__plugin_c64-re-tools_vice__*` tools are the only route to the emulator; (b) the exact classification rule text that mirrors `SKILL.md`; (c) one explicit, dated departure from the original spec with its own reasoning. A cross-binary variant must carry the equivalent up front: state the new mask is committed *before* any rebuild is compared under it (criterion 1), and that the mask can be narrowed but never widened to pass a rebuild (see Anti-Patterns).

**Volatile-span table** (lines 30-47):
```javascript
const VOLATILE = [
  [0x0000, 0x0001], // CPU port
  [0x0100, 0x01ff], // stack page
  [0x0200, 0x03ff], // KERNAL work area / BASIC input buffer
  [0xd000, 0xdfff],  // I/O -- VIC/SID register mirroring, never stable
];
const isVolatile = (a) => VOLATILE.some(([lo, hi]) => a >= lo && a <= hi);
```
The cross-binary module needs a second table alongside this one: an **allowlist** of specific addresses/ranges that are *expected* to differ because of the intentional modification (not because they are volatile hardware). Model it as a second array with the same `[lo, hi]` shape, each entry commented with **why** it is intentional — mirroring how every `VOLATILE` entry above already carries a dated, evidenced reason. Do not fold allowlist entries into `VOLATILE` — they are semantically different (hardware noise vs. deliberate diff) and criterion 2 requires the distinction be visible in the record.

**Classification core** (lines 81-102):
```javascript
function compare(a, b) {
  const volatile_ = [];
  const drift = [];
  const divergence = [];
  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = a[addr], y = b[addr];
    if (x === y) continue;
    const bits = popcount(x ^ y);
    const rec = { addr, a: x, b: y, bits };
    if (isVolatile(addr)) volatile_.push(rec);
    else if (bits === 1) drift.push(rec);
    else divergence.push(rec);
  }
  return { volatile: volatile_, drift, divergence, pass: divergence.length === 0 };
}
```
Cross-binary mode reuses this exact three-bucket taxonomy and adds a fourth bucket, `allowlisted`, checked ahead of `drift`/`divergence` the same way `isVolatile` is checked ahead of bit-count — "allowlist wins over bit-count" is the same precedence rule this file already uses for "volatile wins over bit-count".

**CLI dispatch pattern** (lines 233-258): a flat `commands = { compare, floor, digest }` object, `process.argv.slice(2)` dispatch, a usage string printed to stderr on no/unknown command, `try { process.exit(commands[cmd](rest)) } catch (e) { console.error(...); process.exit(1) }`. A new `compare-cross-binary.mjs` (or a new verb inside `compare.mjs`, e.g. `cross`) should reuse this exact dispatch shape rather than inventing an argument parser.

**Exit code contract** (line 151, line 250): exit 1 on FAIL, exit 0 on PASS — this is what EQUIV-01's automated test asserts against (`node compare.mjs compare <original>.bin <regression>.bin` expected to exit 1). Preserve this contract exactly for the new mode.

---

### `src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.a` (+ `.prg` + `.annostore.json`) (fixture, file-I/O)

**Analog:** `src/mcp/vice/fixtures/hazard-subject/hazard-subject.a` (root, pulls in `hazard-subject-align.a`, `hazard-subject-dispatch.a`, `hazard-subject-smc.a`, `hazard-subject-raster.a` via `!source`) + its generators `make-hazard-subject-fixtures.mjs` and `make-hazard-subject-annostore.mjs`.

**Generator-not-hand-committed-blob pattern** (`make-hazard-subject-fixtures.mjs` lines 1-40, read in full): the `.prg` is only trustworthy evidence while it is exactly what the `.a` sources assemble to. The generator (a) is deterministic — no timestamp, no random value, no host-dependent path; running it twice leaves `git status --porcelain` empty over the fixture directory; (b) refuses rather than writing a partial fixture — on missing/failing assembler it prints the reason, exits non-zero, and does not touch the committed `.prg`; (c) sets its own working directory so bare-filename `!source "..."` lines resolve without a directory component; (d) carries no `*.test.mjs` suffix so it is not picked up as a suite directory, matching the sibling `export-asm`/`coverage` fixture generators.

A `hazard-subject-modified.a` sibling must follow the identical generator discipline: either amend the existing generator to also emit the modified triple, or add a sibling generator script with the same refuse-rather-than-partial-write and determinism guarantees. This directly satisfies RESEARCH.md's Assumption A2 choice ("NEW sibling file... the existing regenerator scripts" pattern) — the existing tree already establishes sibling `.a` files (`hazard-subject-align-misaligned.a` alongside `hazard-subject-align.a`) as the precedent for "a deliberately-varied twin fixture, committed alongside the original, generated by the same script family".

**Anchor discipline** (RESEARCH.md Pitfall 4, cross-checked against `docs/phase49-the-reassembly-gate-findings.md` re-measurement section): whatever byte is removed/added in the modified `.a` must land at one of the five named finding addresses/mechanisms already established for this subject (`$081C` stack-return-dispatch, `$0825` store-target-in-instruction-opcode-byte, `$0881` charset-base-pinned-by-register, `$088B` sprite-pointer-names-aligned-base, `$10C2` timer-reload-in-vectored-handler) or the movement subject's relocated range — never an unrelated constant.

**annostore regeneration**: `make-hazard-subject-annostore.mjs` is the paired generator for `.annostore.json`; both generators must run against the modified `.a`/`.prg` the same way they already run against the unmodified subject, producing the triple RESEARCH.md's file layout section calls for.

---

### Gate-run test against the modified subject (test, integration/event-driven)

**Analog:** `src/mcp/vice/reassembly-gate-run.test.ts` (drives `runReassemblyGate()` from real producers) + `src/mcp/vice/reassembly-gate.ts` (the frozen rule table itself) + `src/mcp/vice/acme-verify.ts` (the one legitimate ACME-spawn/byte-diff oracle).

**Gate module's own constraints, stated in its header** (`reassembly-gate.ts` lines 1-41, read in full):
```typescript
// - Never read an exit status, open a file, or spawn a child process here.
//   Every input this module reads is already a resolved token by the time
//   it arrives...
// - Never reorder, merge, drop or "simplify" a rule...
// - Never let a missing or out-of-domain input throw...
```
The new work must NOT modify `reassembly-gate.ts` itself — RESEARCH.md is explicit that "the gate module needs zero changes, only its inputs change." The new test/harness supplies a `GateInput` (7 fields: `TREE_REBUILD`, `MOVEMENT_REBUILD`, `HAZARD_DISPOSITION`, `DIFF_SCOPE_COVERAGE`, `RED_CONTROLS`, `SECOND_PATH_GUARD`, `ORDERING_PROOF`) computed from the modified subject through the same real producer chain `reassembly-gate-run.test.ts` already uses for the unmodified one.

**Spawn-site freeze warning — CORRECTED 2026-09-15 at planning time.** `acme-seam.test.ts` and its frozen `ACME_SPAWN_SITES` / `EXPECTED_BYTES_COMPARISON_SITES` sets were DELETED in commit `276c15c9`, which removed 43 non-qualifying tests together with `module-classification.ts`. No tree-wide freeze survives. The new gate-run work must still call the existing `verifyAcmeAssemblesTree()` in `acme-verify.ts` and must write no launch of its own. The surviving guards are `acme-verify.test.ts`, which pins that the oracle holds exactly one real assembler launch spelled `spawnSync(assemblerBin, ...)`, and CI's `scripts/check-no-skill-external-spawn.mjs`.

---

### `docs/phase50-*.md` transcript(s) (documentation, request-response)

**Analog A — session-log shape:** `docs/phase41-text-channel-live-evidence.md` (dated command lines, raw excerpts, MEASURED-tag-per-claim style, genuine stock `/usr/bin/x64sc` VICE 3.9 citations).

**Analog B — machine-readable-verdict shape:** `docs/phase49-the-reassembly-gate-findings.md` (YAML frontmatter carrying `phase`, `requirement`, `probe_date`, `verdict`, `verdict_rule_applied`, `inputs:` block; body opens with "The transcription rule" — every value taken from a literal outcome line at column 0 of a named evidence file, final occurrence wins, nothing from memory, a mechanical checker (`transcription-check.mjs`) confirms every value against its evidence file and against `runReassemblyGate()`'s own recomputation).

For EQUIV-02/03's paired transcripts, combine both shapes: frontmatter carrying the fixture hash (so the CI freshness test in the next section has something to compare against) and the gate verdict, body carrying the dated live-emulator session log in Analog A's style. The **paired red+green** requirement (criterion 2, Pitfall 1) has no existing single-file precedent in this repo but both cited docs already show a "re-measurement" pattern (`phase49`'s "Re-measurement (2026-09-13)" section documents a prior `red` run superseded by a later `acknowledged` run in the SAME file) — reuse that structure: one section per condition (planted-regression FAIL, real-rebuild PASS), not two separate untracked documents.

---

### CI freshness test (test, CI/automated, transform)

**Analog:** `src/mcp/vice/resources-sync.test.ts` (126 lines, read in full).

**Drift-guard pattern** (lines 50-95): build fresh into a scratch `mkdtempSync(tmpdir())` directory, then compare byte-for-byte in **both directions** — (1) every freshly-produced file must match the committed one at the same relative path, with a specific "STALE, run X and commit" failure message; (2) every already-committed generated-looking file must have been reproduced by the fresh build, or it is flagged as an ORPHAN.

For the phase-50 freshness check, the two directions become: (1) the transcript's **recorded fixture hash** must equal the **current fixture's actual hash** (recompute via `compare.mjs digest` or `createHash("sha256")` directly, same as `compare.mjs`'s own `sha256()` helper at line 74); (2) optionally, every committed `docs/phase50-*.md` transcript must reference a fixture that still exists (no orphaned transcript for a deleted/renamed fixture). Model the failure message on `resources-sync.test.ts`'s exact phrasing style: name the file, name the mismatch, name the remedy command.

```typescript
// Source: src/mcp/vice/resources-sync.test.ts:50-76 (excerpted for the pattern)
test("...", () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "..."));
  try {
    // produce/recompute fresh value
    assert.ok(freshValue === committedRecordedValue,
      "committed transcript's recorded fixture hash does not match the fixture's current hash -- " +
      "the transcript is STALE. Re-run the live-emulator session and commit a fresh transcript.");
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
```

This test file belongs in `src/mcp/vice/` (colocated `*.test.ts`, `node --test`), not under `docs/`, matching every other test file's location convention in this codebase.

---

### Disk-image write capability (Open Question 1 — utility/host-tool, file-I/O, mutating)

**No usable write analog exists.** `src/skills/c64-disk-access/scripts/c1541.mjs` is read-only **by design**, stated in its own header (`[VERIFIED: src/skills/c64-disk-access/scripts/c1541.mjs:1-4]`, quoted in RESEARCH.md: "Read-only: directory, block allocation map, ... No write, format, delete or any other mutating verb is reachable from this script — deliberately"). `src/mcp/vice/host-tool.mts`'s `HOST_TOOL_NAMES` list exposes only five `c1541.*` read capabilities.

**Closest structural analog for adding a new capability:** the existing `c1541.*` capability registration pattern in `host-tool.mts` itself (the frozen-list discipline — same family as `ACME_SPAWN_SITES` in `acme-seam.test.ts`). Any new `c1541.write` capability must (a) go through the container-out seam (`hostpath.ts`/`containerpath.ts`/`container-guard.mts`) per this project's standing constraint, (b) never `spawnSync` directly from a skill script (`scripts/check-no-skill-external-spawn.mjs` enforces this in CI), and (c) never auto-install `c1541` — it is already resolved as an `x64sc` sibling via `findSiblingBinary()`, detect-and-refuse-by-name if absent.

**RESEARCH.md's own alternative** (equally valid, Claude's-discretion per A1): skip the new capability entirely and author the `.d64` once by hand, committing only the resulting binary — the same undocumented route the four existing `.d64` fixtures (`danish.d64`, `saeger.d64`, `fixtures/c1541/synthetic.d64`) appear to have taken, since no generator script for any of them was found in the repo. If this path is chosen, there is no code pattern to map — it is a one-time manual artifact commit, not a new module.

## Shared Patterns

### Pre-commitment discipline (mask/allowlist committed before measurement)
**Source:** `.planning/phases/49-.../SCHEMA.md` + `DECISION-RULE.md` (committed alone, in the first two commits of Phase 49, before any evidence file existed) — already the established gate pattern across Phases 9/23/33/39/49.
**Apply to:** the new cross-binary mask/allowlist module. Criterion 1 requires it committed as its own artifact before any rebuild is compared under it — do not fold mask commits and comparison-result commits into one change.

### ACME-availability gate
**Source:** `src/mcp/vice/acme-gate.ts` — `probeAcme()`, `ACME_AVAILABLE`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()`.
```typescript
// Pattern used by every ACME-dependent test file, e.g.
// src/mcp/vice/hazard-subject-reassembly.test.ts:19-24,52-54
```
**Apply to:** any new test file this phase adds that spawns real ACME against the modified subject (the gate-run test, the fixture generator's own test if any). With `VICE_REQUIRE_ACME=1` (CI sets this), a missing assembler is a hard FAIL rather than a silent skip.

### Checkpoint-based memory capture (not screen capture)
**Source:** `src/skills/c64-ram-capture/SKILL.md`, "Capture at a trigger address" section.
**Pattern:** `vice_checkpoint_add` (stop=true) → `vice_execution_run` → poll `vice_ping` until hit → 16× `vice_memory_read` (4096 bytes each) in the same paused window → assemble via `dump-artifacts.mjs` → digest via `compare.mjs digest`.
**Apply to:** EQUIV-02/03's "observed taking effect" evidence for every live-emulator transcript this phase writes. Do NOT design this evidence around `-exitscreenshot` — Phase 48's `FIXTURE-DESIGN.md` measured that route as program-blind for this specific subject (four cycle counts tried, all null).

### Frozen-set structural guards
**Source — CORRECTED 2026-09-15:** this pattern's cited source, `acme-seam.test.ts`, was deleted in `276c15c9`. The surviving equivalents are `acme-verify.test.ts`'s single-launch assertion and CI's `scripts/check-no-skill-external-spawn.mjs`.
**Apply to:** any new module that spawns ACME or performs an expected-vs-actual byte comparison — it must either call through the existing sanctioned site (`acme-verify.ts`) or be added to the frozen set as a deliberate, reviewed edit, never a silent second implementation.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Reusable VICE transcript-writer module | utility | file-I/O | Prior phases (39/41/45/49) each hand-wrote a `docs/phaseNN-*.md` file directly; no shared module extracts the common shape. RESEARCH.md lists this as one of three genuinely new pieces. Use the two documented shapes above (Analog A + B) as the template rather than inventing a fresh structure. |
| `c1541.write` host-tool capability | utility / host-tool | file-I/O (mutating) | No write-capable analog exists anywhere in the tree; `c1541.mjs` is read-only by explicit design. This is the phase's one true gap (RESEARCH.md's Open Question 1) — size it as its own task, do not treat it as a one-line addition to `host-tool.mts`. |

## Metadata

**Analog search scope:** `src/skills/c64-ram-capture/scripts/`, `src/mcp/vice/` (reassembly-gate family, acme-verify/acme-gate/acme-seam, resources-sync.test.ts, host-tool.mts), `src/mcp/vice/fixtures/hazard-subject/`, `docs/` (phase39/41/45/49 transcripts).
**Files scanned:** 6 read in full (`compare.mjs`, `resources-sync.test.ts`, `reassembly-gate.ts` header, `make-hazard-subject-fixtures.mjs` header, `phase49-the-reassembly-gate-findings.md` head, RESEARCH.md + VALIDATION.md in full); several more grepped/listed for existence checks (`c1541.mjs`, `host-tool.mts`, `acme-seam.test.ts`, `reassembly-gate-run.test.ts`).
**Tracked-source gate:** all 6 primary analog paths confirmed via `git ls-files` — none is a gitignored install/runtime mirror.
**Pattern extraction date:** 2026-09-15
