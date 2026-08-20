# Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 10 new/modified (Wave 0 list) + 5 documentation/CI-gate files + 1 open-design file
**Analogs found:** 9 / 10 (the skill-side entry point is an open design question in RESEARCH.md, not a locked target — mapped to its own recommendation section below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `.claude/mcp/vice/r2000-launch.ts` | utility (guarded CLI-shell-out seam) | request-response (spawnSync, no lifecycle) | `.claude/mcp/vice/vice.ts` (`DENY_LIST`/`denyListRefusalMessage`/`call()` guard) | role-match (deny pattern is exact; spawn shape borrows from `acme.mjs`) |
| `.claude/mcp/vice/r2000-launch.test.ts` | test | unit | `.claude/mcp/vice/hostpath-consumers.test.ts` (regex-over-source-text assertion style) + `vice.ts`'s own would-be deny-list test convention | role-match |
| `.claude/mcp/vice/r2000-project.ts` | utility (pure data transform: gzip+base64+JSON) | transform | *(none — genuinely new, no in-repo precedent)* | no analog (see "No Analog Found") |
| `.claude/mcp/vice/r2000-project.test.ts` | test | unit + integration | `.claude/mcp/vice/disasm-roundtrip.test.ts` (real-subprocess proof pattern, for the integration half only) | partial match |
| `.claude/mcp/vice/r2000-verify.test.ts` | test | integration (gated subprocess) | `.claude/mcp/vice/disasm-roundtrip.test.ts` (SKIP_REASON / `VICE_REQUIRE_ACME` shape — **mirror only, do not edit**) | exact-shape match, different file |
| `.claude/mcp/vice/hostpath-consumers.test.ts` (extend) | test | unit (structural absence assertion) | itself — extend existing negative-assertion test | exact (same file, new test block) |
| `.d64` named-entry extraction (extend `d64-parse.mjs`) | utility (pure byte-level parse) | transform | `d64-parse.mjs`'s own `parseDirectory()`/`tsToOffset()` (sector-chain walk already implemented) | exact — same module, new export |
| Skill-side entry point reaching the D-06 seam | route / CLI dispatch | request-response (subprocess bridge) | `.claude/mcp/vice/smoke.mjs` (spawns the published bin, works across install routes) + `probe-binmon.mjs` (standalone CLI-with-flags shape) | role-match, mechanism unlocked |
| `.claude/skills/acme-build/scripts/acme.mjs` (delete `cmdDisasm`) | skill script (CLI verb dispatch) | request-response | itself — `cmdNew`/`cmdBuild`/`cmdSym` remain as the pattern for what stays | exact (deletion within existing file) |
| `.claude/skills/acme-build/SKILL.md` (delete sections) | documentation | n/a | itself | exact |
| `.claude/skills/c64-program-recon/SKILL.md` (add pointer) | documentation | n/a | `acme-build/SKILL.md`'s "Which skill does what" cross-reference table | role-match |
| `scripts/check-skill-fork-honesty.mjs` (D-13 array move) | config/CI gate | batch (static analysis over prose) | itself — `REQUIRED_README_SUBSTRINGS`/`FORBIDDEN_README_SUBSTRINGS` tuple shape | exact |
| `.claude/mcp/vice/package.json` (`files[]`, conditional) | config | n/a | itself — existing flat `files[]` array | exact |
| `README.md` (R2000-03 install story) | documentation | n/a | `README.md`'s existing "Installing VICE, and choosing a backend" section | role-match |
| `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` (dual-license notice) | documentation | n/a | itself — existing "Existing runtime dependencies" / "Build/CI tools — not incorporated" sections | exact |

## Pattern Assignments

### `.claude/mcp/vice/r2000-launch.ts` (utility, request-response)

**Analog:** `.claude/mcp/vice/vice.ts` (deny pattern) + `.claude/skills/acme-build/scripts/acme.mjs` (spawn shape)

**Header-comment convention to match** (verified from `.claude/mcp/vice/containerpath.ts:1-20` and `vice.ts:1-13`) — every module in this directory opens with: why the file exists (what incident/requirement demanded it), what it is the ONE authoritative place for, and what NOT to do, naming the specific past mistake:
```typescript
// .claude/mcp/vice/vice.ts:1-13
#!/usr/bin/env node
// Single MCP client seam for the host VICE MCP server.  Every emulator
// interaction in this project goes through `call()` -- no other file speaks
// MCP JSON-RPC or raw HTTP to the VICE endpoint directly.
//
// Why a seam at all: Phase 1 tooling and Phase 3's verify/runner.mjs both
// depend on this one transport.  If the handshake shape ever needs to change
// (session header, SSE framing, a curl fallback), it changes here once.
//
// The deny-list is the other reason this file exists: vice_disk_list crashes
// the shared host MCP server (see CLAUDE.md's hazard note and STATE.md's
// blocker entry).  The guard below runs *before* any request is serialised,
// so no caller -- however indirect -- can reach that tool by accident.
```
`r2000-launch.ts`'s header should state: why a seam at all (D-06 — this is where the closed-consumer-set test machinery runs, and where Phase 11's `r2000_*` MCP tools will land), and why the deny guard exists (`--vice` would make regenerator2000 itself a second, unserviced binary-monitor client — CLAUDE.md's single-client constraint).

**Deny-by-construction + deny-by-scan pattern to mirror** (verified `.claude/mcp/vice/vice.ts:201-207, 229-243, 690-700`):
```typescript
// .claude/mcp/vice/vice.ts:201-207
export const DENY_LIST: readonly string[] = [
  "vice_disk_list",
  "tools_list",
  "tools_call",
  "initialize",
  "notifications_initialized",
];

// .claude/mcp/vice/vice.ts:229-243
export function denyListRefusalMessage(toolName: string): string {
  if (toolName === "vice_disk_list") {
    return (
      `${toolName} is permanently forbidden -- it is known to crash the shared host VICE MCP server ` +
      `(see CLAUDE.md's hazard note). Recovery requires a manual, host-side restart. Refusing to ` +
      `serialise this request; retrying will not help.`
    );
  }
  return (
    `${toolName} is permanently forbidden -- it is a generic-surface meta-tool that can carry a ` +
    `forbidden tool name as a nested argument, bypassing this exact outer-name-only guard ...`
  );
}

// .claude/mcp/vice/vice.ts:690-700 -- the guard is the FIRST line of the function body,
// deliberately, so it is enforced even if a future edit reorders the rest:
export async function call(toolName: string, args: Record<string, unknown> = {}, opts: RpcOptions = {}): Promise<unknown> {
  if (DENY_LIST.includes(toolName)) {
    throw new ViceError(denyListRefusalMessage(toolName));
  }
  ...
}
```
D-07's analog: argv is built ONLY by fixed per-verb builder functions (never a caller-supplied passthrough array) — that is the "unreachable by construction" half. Then, immediately before `spawnSync`, scan the fully-built `string[]` argv for an exact-token match on `"--vice"` (never a substring match against a joined command line — a filename containing the substring must not false-positive) and `throw` a named error (e.g. `class R2000ViceFlagError extends Error`, following `vice.ts:250-260`'s `ViceError` constructor shape) if found. Never strip silently.

**Error class shape to copy** (verified `.claude/mcp/vice/vice.ts:245-260`):
```typescript
export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

export class ViceError extends Error {
  code?: number | string;
  data?: unknown;

  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
}
```
Follow this for any `R2000...Error` subclass: named `.name`, plain public fields, options-object constructor.

**Spawn shape to copy — argv array, never a shell string** (verified `.claude/skills/acme-build/scripts/acme.mjs:93-129`):
```javascript
// .claude/skills/acme-build/scripts/acme.mjs:103-129
const args = [
  "--cpu", "6510",
  "-f", opts.format || "cbm",
  ...
];
...
const r = spawnSync("acme", args, { encoding: "utf8", env });
if (r.error) {
  die(r.error.code === "ENOENT"
    ? "install the ACME cross assembler and put `acme` on PATH"
    : String(r.error));
}
```
`r2000-launch.ts`'s spawn wrapper should mirror this "probe the ENOENT case with a specific, actionable message" convention, and `disasm-roundtrip.test.ts:44,111-120`'s explicit rule: never interpolate any test/caller input into a shell command string — always an argv array to `spawnSync`/`spawn`.

**Deliberate absence:** must NOT import `hostpath.ts` / `containerpath.ts` (D-08) — this absence is what `hostpath-consumers.test.ts`'s new negative assertion checks structurally.

---

### `.claude/mcp/vice/r2000-launch.test.ts` (test, unit)

**Analog:** No direct sibling test exists for `vice.ts`'s own `DENY_LIST` (it's exercised indirectly through `call()`'s integration tests) — the closest concrete shape to mirror is `hostpath-consumers.test.ts`'s "assert an absence/presence structurally, never by convention" style plus `disasm-roundtrip.test.ts`'s "argv array, never a shell string" assertion habit.

Two things this test must assert (per D-07, both — not either/or):
1. **Unreachable by construction:** every exported argv-builder function has a fixed parameter list with no generic "extra args"/"passthrough" parameter — assert this at the type level (no `...rest: string[]` reaching the builder) or by asserting the builder's return array never contains a caller-supplied string verbatim.
2. **Denied by scan:** feed a fabricated/mutated argv (simulating a future regression that reintroduces a passthrough) directly into the scan-and-throw function and assert it throws a named error (`R2000ViceFlagError` or similar) — never assert on a silently-stripped array.

---

### `.claude/mcp/vice/r2000-project.ts` (utility, transform — NO ANALOG, see below)

**No close analog exists in this codebase.** This is the one genuinely new piece of mechanism this phase introduces (RESEARCH.md's own "Don't Hand-Roll" table names it as the sole exception). Build from first principles per D-01/D-04/D-05:

- Pure function: `synthesize(bytes: Buffer, opts: { origin: number; system: string }) -> Buffer` (or `-> string`, if returning JSON text directly) — no filesystem/network I/O inside the function itself (I/O happens at the call site, keeping this testable without a real file).
- Shape, per CONTEXT.md D-01 (re-verify field names directly against `~/.cargo/registry/src/index.crates.io-*/regenerator2000-core-0.9.20/src/state/project.rs:41-96` before writing — RESEARCH.md's Assumption A1 flags this as not independently re-verified this pass):
  ```
  { origin: <number>, raw_data_base64: gzip(bytes).toString("base64"), blocks: [],
    settings: { use_illegal_opcodes: true, system: <explicit string> } }
  ```
- Node's built-in `node:zlib` `gzipSync` is the gzip step (D-01's own evidence: "a first attempt writing uncompressed bytes failed with `Error loading file: invalid gzip header`; gzipping the payload fixed it").
- **No version pin, no `--version` allow-list** (D-04) — write only the three required fields plus the two deliberately-forced settings; everything else is `#[serde(default)]` on the Rust side, so omission is the compatibility strategy, not a fallback.
- Header comment should state the WHY (D-01's rejected keystroke/pty alternative and why synthesis was chosen instead — tmux as an avoided prerequisite, the post-edit avoided) and the ONE-authoritative-place claim (nothing else in this repo should ever hand-build a `.regen2000proj`).

**Style precedent for a pure-transform module's shape** (verified `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs:60-64` — small, single-purpose, documented-limits-in-comment style):
```javascript
/**
 * Directory/disk-name bytes are PETSCII, padded with $A0. Every byte this
 * project's two disks actually use in a name ... sits at the same code
 * point in PETSCII as in ASCII/Latin-1, so only the $A0 padding needs
 * stripping -- there is no general PETSCII<->ASCII table here, on purpose,
 * since one is not needed for what these disks contain.
 */
```
Mirror this "state the deliberate scope limit inline, don't just implement it silently" convention for `r2000-project.ts`'s own minimal-field choice.

---

### `.claude/mcp/vice/r2000-project.test.ts` (test, unit + integration)

**Analog:** `disasm-roundtrip.test.ts`'s real-subprocess-proof shape, for the integration half only (see `r2000-verify.test.ts` below for the full gate pattern — this file's integration test can reuse the same `SKIP_REASON`/`R2000_AVAILABLE` computation, or import it from a shared small helper if the planner wants to avoid duplicating the probe).

Split per the Wave-0 note ("unit (pure synthesis) + integration (real r2000 load)"):
- **Unit tests** (always run, no gating): assert the exact JSON shape from fixed inputs — three required fields present, `settings.use_illegal_opcodes === true`, `settings.system` is the explicit value passed in (never inferred), `raw_data_base64` round-trips through gzip decode back to the original bytes.
- **Integration test** (gated, mirrors D-11's shape): actually run `regenerator2000 --headless --export_asm <tmp> --assembler acme` against a synthesized project and assert exit 0 + the exported `.a` file exists — this is D-04's "prove it loaded by actually running r2000 once" requirement, not a version table.

---

### `.claude/mcp/vice/r2000-verify.test.ts` (test, integration, gated — NEW FILE, mirror shape only)

**Analog:** `.claude/mcp/vice/disasm-roundtrip.test.ts` — **copy the SKIP/FAIL-gate shape into a new file; do not edit this file.** It is Phase 4's protected stock-disassembler round-trip test (ROADMAP.md Standing Constraint), unrelated to `acme-build`'s deleted `disasm` verb beyond a name collision.

**Availability-gate pattern to mirror exactly** (verified `.claude/mcp/vice/disasm-roundtrip.test.ts:58-100`):
```typescript
// disasm-roundtrip.test.ts:62-75
const ACME_BIN = process.env.ACME_BIN ?? "acme";

function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8" });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8" });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

const ACME_AVAILABLE = probeAcme();

// disasm-roundtrip.test.ts:81-88 -- computed ONCE at module scope, never a
// hand-rolled `if (!available) return` (that reports a false PASS, not a SKIP)
const SKIP_REASON: string | false = ACME_AVAILABLE
  ? false
  : `disasm-roundtrip.test.ts's ACME-dependent suites are skipped -- no real ACME cross-assembler ` +
    `was found at ACME_BIN="${ACME_BIN}". ... CI's build job installs it before this file runs ` +
    `(.github/workflows/ci.yml's "Install ACME cross-assembler" step) and sets VICE_REQUIRE_ACME=1 ` +
    `so a missing ACME there FAILS instead of skipping ...`;

// disasm-roundtrip.test.ts:90-100 -- exactly ONE test always runs, never skipped
test("ACME availability gate (D-08)", () => {
  if (process.env.VICE_REQUIRE_ACME) {
    assert.ok(
      ACME_AVAILABLE,
      `VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="${ACME_BIN}" ...`,
    );
  }
});
```
`r2000-verify.test.ts` renames every `ACME_*`/`VICE_REQUIRE_ACME` symbol to `R2000_*`/`VICE_REQUIRE_R2000`, probes `regenerator2000 --version`/`--help` instead of `acme`, and — per D-11 — CI never sets `VICE_REQUIRE_R2000`, so the availability-gate test passes trivially in CI while still failing hard for any future maintainer who sets the env var locally without r2000 installed.

**D-10's parsing rule (the reason this can't just check exit code)** — verified live output shape (RESEARCH.md § Code Examples, Phase 9 evidence):
```
✗ ACME — ACME not found in PATH (skipped)
✓ All roundtrip verifications passed.
EXIT=0
```
The test must parse stdout for a line matching `✓ ACME — byte-identical` (or equivalent success text) and explicitly **fail** on any `ACME — ... (skipped)` line, independent of exit code. `disasm-roundtrip.test.ts:38-41`'s companion rule — "never treat an ACME stderr WARNING as a failure" — applies here too if `--verify`'s stderr carries benign warnings.

**Spawn shape:** argv array (`spawnSync("regenerator2000", ["--headless", "--verify", ...], { encoding: "utf8" })`), never a shell string — same rule as everywhere else in this codebase.

---

### `.claude/mcp/vice/hostpath-consumers.test.ts` (extend, unit)

**Analog:** itself — extend with a new negative-assertion test block, exactly mirroring the existing disassembler-modules absence test.

**Exact template to copy** (verified `.claude/mcp/vice/hostpath-consumers.test.ts:89-104`):
```typescript
test("the disassembler modules (not yet reachable from stock-dispatch.ts in this wave) are absent from the consumer set", () => {
  const importers = hostpathImporters();
  for (const name of [
    "stock-disassemble.ts", "disasm-opcodes.ts", "disasm-decoder.ts", "disasm-renderer.ts",
    "stock-memory-search.ts", "stock-symbols.ts", "stock-vicii.ts", "stock-cia.ts", "stock-sprites.ts",
  ]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});
```
Add a sibling test naming `r2000-launch.ts` and `r2000-project.ts` (or whatever the seam module family is actually called) in an identical `assert.equal(importers.includes(name), false, ...)` list.

**CRITICAL — what NOT to touch:** `EXPECTED_IMPORTERS` (line 77) is an exact five-element **positive** array (`["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"]`), asserted with `assert.deepEqual` plus `assert.equal(importers.length, 5)` (lines 79-83). The r2000 modules belong ONLY on the negative/absence side — never added here. This is the one pitfall the research flags explicitly (Pitfall/D-08 note): a planner reading only "extend the closed consumer set" prose might reach for the positive array by mistake.

---

### `.d64` named-entry extraction (extend `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs`)

**Analog:** itself — `parseDirectory()` already follows the sector chain (verified `d64-parse.mjs:110-194`); the new export follows an entry's OWN chain (starting at `first_track`/`first_sector` from a directory entry, not the fixed directory-chain start) and concatenates sector payload bytes, stripping the standard 2-byte next-track/next-sector header from every sector except handling the final sector's used-byte-count convention (1541 DOS: the final sector's second header byte holds the count of used bytes in that sector, not a next-sector pointer — track byte 0 signals "last sector").

**Cycle-guard pattern to reuse exactly** (verified `d64-parse.mjs:124-148`):
```javascript
// d64-parse.mjs:132-148
for (;;) {
  const key = `${track}/${sector}`;
  if (visited.has(key)) {
    chainError = `directory chain revisited ${key} -- stopped to avoid an infinite loop (self-referential or cyclic next-sector pointer)`;
    break;
  }
  visited.add(key);
  if (!isInImage(track, sector)) {
    chainError = `directory chain pointer ${key} is outside the image -- stopped`;
    break;
  }
  const off = tsToOffset(track, sector);
  const sec = buffer.subarray(off, off + 256);
  const nextTrack = sec[0];
  const nextSector = sec[1];
  ...
  if (nextTrack === 0) break; // end of chain, by DOS convention
  track = nextTrack;
  sector = nextSector;
}
```
The new `extractFile(buffer, entry)` (or similarly named) export should reuse `tsToOffset()`/`isInImage()`/`sectorsPerTrack()` (already exported) and apply this identical visited-set guard against a malicious/corrupt chain, per this module's own established defensive posture — never a bare `while(track !== 0)` loop with no revisit guard.

**D-02's fail-loud contract belongs in the CALLER** (the new r2000-bootstrap route), not in `d64-parse.mjs` itself: `d64-parse.mjs` stays a pure, offline parser (no `process.exit`, no "which entry did you mean" prompt logic) — the caller uses `parseDirectory()` to print the listing and `extractFile()` to pull the named entry's bytes, and is the layer that enforces "no name given → print listing, exit non-zero."

**Module's documented, inherited limits** (verified header, `d64-parse.mjs:6-11`): plain 174848-byte, 35-track images only, no error-info bytes, no 40-track variant — D-02's `.d64` support inherits these as-is; do not silently extend scope to 40-track images in this phase.

---

### Skill-side entry point reaching the D-06 seam (route/CLI dispatch — mechanism unlocked, recommendation only)

**Analog:** `.claude/mcp/vice/smoke.mjs` (spawns the published bin exactly as a real consumer would, across install routes) and `probe-binmon.mjs` (standalone `.mjs` CLI with its own flag parsing, run directly by a human or skill).

RESEARCH.md's own recommendation (Open Question 1 / Assumption A2, MEDIUM confidence, not verified end-to-end): give the existing `vice-mcp` bin (`vice-proxy.ts`) an argv-subcommand branch that short-circuits before the Mastra MCP-stdio server starts — e.g. `npx @henols/vice-mcp r2000-bootstrap <file>` — because that bin is the ONE surface proven to resolve identically across all three install routes (Claude Code plugin, npm-installer default, npm-installer `--vendor`); `installer/bin/cli.mjs:129-132`'s `viceServerEntry()` confirms `.claude/mcp/vice/*.ts` are never plain files on disk in either npm-installer mode:
```javascript
// installer/bin/cli.mjs:129-132
function viceServerEntry(vendor) {
  return {
    command: "npx",
    args: vendor ? [MCP_PKG] : ["-y", `${MCP_PKG}@${MCP_VERSION}`],
    ...
  };
}
```
**Smoke-test precedent to extend, not re-invent** (verified `smoke.mjs:1-25`): the same "spawn the bin exactly as a consumer would" harness that already proves the stdio MCP handshake works should gain (or be joined by a sibling test) a case proving the new subcommand short-circuits correctly, per RESEARCH.md's own explicit flag ("Not yet verified end-to-end against a real npx-resolved install — flag for the plan to include a smoke test analogous to smoke.mjs's existing pattern before relying on it").

**Do not put this inside `acme.mjs`** (per D-12's explicit "no second binary dependency" constraint) — a separate thin skill-side script, or a direct pointer from both `acme-build/SKILL.md` and `c64-program-recon/SKILL.md` to the `.claude/mcp/vice/` seam's CLI entry, consistent with D-06's "thin skill-side entry point for CLI ergonomics" wording.

---

### `.claude/skills/acme-build/scripts/acme.mjs` (delete `cmdDisasm`)

**Analog:** itself. Delete exactly this function and its two other references (verified full function at `acme.mjs:208-222`):
```javascript
// acme.mjs:208-222 -- DELETE THIS FUNCTION IN FULL
// `toacme` ships with ACME and turns object code back into ACME source.
function cmdDisasm(argv) {
  const src = argv[0];
  if (!src) die("usage: disasm <file.prg> [out.a]");
  const out = argv[1] || src.replace(/\.prg$/i, "") + ".dis.a";
  const r = spawnSync("toacme", ["object", src, out], { encoding: "utf8" });
  if (r.error) die("install the ACME cross assembler and put `toacme` on PATH");
  if (r.status !== 0) die(`toacme: ${(r.stderr || r.stdout).trim()}`);
  const n = readFileSync(out, "utf8").split("\n").filter((l) => /^L[0-9a-f]{4}/.test(l)).length;
  console.log(`${out}: ${n} lines`);
  console.log("Read it as a linear decode: trust the instruction stream, and");
  console.log("treat strings, tables and the BASIC stub as data. To reassemble,");
  console.log("define the out-of-range labels it emits (Ld020, Lffd2, ...) and");
  console.log("indent its illegal-opcode lines to the operand column.");
}
```
Two other sites to edit in the same file:
```javascript
// acme.mjs:250 -- remove the "disasm: cmdDisasm" entry
const VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym, disasm: cmdDisasm };
// becomes:
const VERBS = { new: cmdNew, build: cmdBuild, sym: cmdSym };
```
```javascript
// acme.mjs:257 -- remove the usage line
  disasm <file.prg> [out.a] turn object code back into ACME source
```
Also update the file's own top-of-file scope comment (`acme.mjs:2-4`) — currently "Scope is assembling only" is already accurate, but `acme-build/SKILL.md:19` explicitly says "wraps `acme` and `toacme` and nothing else" and must be corrected to name only `acme` (see next entry).

---

### `.claude/skills/acme-build/SKILL.md` (delete sections, add pointer)

**Analog:** itself. Exact deletions (verified against the file read in full):
- Line 16 (opening synopsis): `node $A disasm game.prg       # object code back into ACME source`
- Line 19: `` `toacme` `` → the sentence becomes "The script wraps `acme` and nothing else — **assembling only**."
- Lines 134-176 (`## Disassembly` section in full — fenced example, "Read it as a linear decode..." prose, the `.dis.a`→`.dis.asm` workaround, the "define the out-of-range labels" and "indent the illegal-opcode lines" instructions)
- Line 180 (`## Setup`): `Put `acme` and `toacme` on `$PATH`.` → `Put `acme` on `$PATH`.`

Add, in the vacated `## Disassembly` section's place, a short pointer to the new route — model it on the file's own existing cross-reference table style (verified `acme-build/SKILL.md:191-200`):
```markdown
## Which skill does what

...
| Need | Go to |
|---|---|
| Where to start on an unknown program, and which address to read next | `c64-program-recon` |
...
```

---

### `.claude/skills/c64-program-recon/SKILL.md` (add pointer — new documentation, not a deletion)

**Analog:** `acme-build/SKILL.md`'s own "Which skill does what" table (same file, cross-referenced above) — this skill currently has no mention of `disasm`/`toacme`/`regenerator2000` at all (confirmed by RESEARCH.md's grep). Add a short section pointing at the same D-06 seam/entry point acme-build now points at — per D-12, both point at the single implementation, neither carries its own copy.

---

### `scripts/check-skill-fork-honesty.mjs` (D-13 array-move edit)

**Analog:** itself — move one tuple between two existing, structurally-identical arrays.

**Current (wrong) placement** (verified `check-skill-fork-honesty.mjs:252-262`):
```javascript
const FORBIDDEN_README_SUBSTRINGS = [
  ["regenerator2000", "D-B: this phase's install docs must stay regenerator2000-free"],
  ["skill-docs.test.ts", "this ghost guardrail-test file does not exist anywhere in this repository -- claiming it exists is a false statement about this repo"],
  ["vice-mcp-selector-docs.test.ts", "this ghost guardrail-test file does not exist anywhere in this repository -- claiming it exists is a false statement about this repo"],
];
```
**Target array and exact tuple shape to match** (verified `check-skill-fork-honesty.mjs:230-248`):
```javascript
const REQUIRED_README_SUBSTRINGS = [
  ["VICE_BACKEND", "a reader cannot select a backend at all"],
  ["vice_sid_get_state", "a stock user is not warned this tool requires the fork before they design a method around it"],
  ["vice_keyboard_matrix", "a stock user is not warned this tool requires the fork before they design a method around it"],
  ["docs/tool-support.md", "the reader loses their route to the full per-tool answer"],
  ["3.10", "the reader cannot tell what an `apt install` of VICE gives them relative to the version gate"],
];
for (const [needle, whatIsLost] of REQUIRED_README_SUBSTRINGS) {
  need(
    readmeSource.includes(needle),
    `README.md is missing the required string "${needle}" -- without it, ${whatIsLost}.`
  );
}
```
D-13's edit: remove `["regenerator2000", ...]` from `FORBIDDEN_README_SUBSTRINGS` and add `["regenerator2000", "<a fresh whatIsLost string reflecting criterion 5's requirement that the name appear>"]` to `REQUIRED_README_SUBSTRINGS`, in the exact same `[needle, whatIsLost]` tuple shape. **Also required in the same commit** (Pitfall 4): update the file's header comment (line 14) — "the regenerator2000 name Phase 8 removed" is now stale and self-contradicting once the array flips.

---

### `.claude/mcp/vice/package.json` (`files[]`, conditional on reachability)

**Analog:** itself — flat array, no globs, every top-level module listed by exact name (verified full array, `package.json:10-61`). If (and only if) `r2000-launch.ts`/`r2000-project.ts` become reachable from `vice-proxy.ts`'s own import closure (e.g. via the argv-subcommand dispatch), add their exact filenames to this array in the same commit — `scripts/check-npm-packages.mjs`'s transitive-closure walk (verified header comment, `check-npm-packages.mjs:15-18`, and completion log line `check-npm-packages.mjs:141`) will otherwise fail loudly at pack-time, not at `npm test` time. If the modules stay unreachable from `vice-proxy.ts` (e.g. because the skill-side route shells out to a wholly separate script that never imports them into the bin's own closure), no `files[]` change is needed — but they must still ship if referenced by any published surface; verify against `check-npm-packages.mjs` directly before deciding.

---

### `README.md` (R2000-03 install story)

**Analog:** `README.md`'s own existing "## Installing VICE, and choosing a backend" section (verified `README.md:63-127`) — same structure to replicate for regenerator2000: a short "what it is and why you need it" lead-in, a table of the measured facts (per D-15: `cargo install regenerator2000` toolchain floor `rustc >= 1.90`, no upstream release assets, container cost figures if relevant, the one-project-per-namespace limit stated not detected), and an explicit statement of what breaks/degrades without it (mirroring this section's own "### What a sub-3.10 VICE costs" subsection pattern, verified lines 99-105).

**CI gate that enforces this doc's honesty:** `scripts/check-skill-fork-honesty.mjs`'s `REQUIRED_README_SUBSTRINGS` (D-13, above) — the new `regenerator2000` entry there is what makes an incomplete README fail CI rather than silently ship.

---

### `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` (dual-license notice, D-14/D-15)

**Analog:** itself — the file's own existing per-source notice sections (verified in full). Model the new regenerator2000 entry on the "## Build/CI tools — not incorporated" section's own style (verified `THIRD-PARTY-NOTICES.md:66-76`):
```markdown
## Build/CI tools — not incorporated

The ACME cross-assembler (GPL) is invoked as a **subprocess in tests only**
(`disasm-roundtrip.test.ts`), against a real, locally- or CI-installed ACME
binary ... **No ACME source, header, data table or output is included in
this repository or in the published package**, so ACME's licence does not
attach to anything shipped. ACME never appears in `.claude/mcp/vice/package.json`'s
`files[]`, `dependencies`, or `devDependencies` -- it is an apt/CI-installed
tool, never an npm package.
```
regenerator2000's notice needs the **correct** license statement per D-14 — `MIT OR Apache-2.0` (dual), both `LICENSE-MIT` and `LICENSE-APACHE` ship in the crate — not the stale Apache-2.0-only claim `09-RESEARCH.md:55`/`.planning/notes/regenerator2000-integration.md:253` still carry. Root `THIRD-PARTY-NOTICES.md` is a 4-line pointer (verified in full) to this canonical file and needs no separate edit.

## Shared Patterns

### Deny-by-construction plus deny-by-scan (D-07)
**Source:** `.claude/mcp/vice/vice.ts:201-243, 690-700` (`DENY_LIST`, `denyListRefusalMessage()`, `call()`'s first-line guard)
**Apply to:** `r2000-launch.ts` and `r2000-launch.test.ts`
```typescript
export const DENY_LIST: readonly string[] = [ /* ... */ ];
export function denyListRefusalMessage(toolName: string): string { /* ... */ }
if (DENY_LIST.includes(toolName)) {
  throw new ViceError(denyListRefusalMessage(toolName));
}
```
The r2000 analog scans an argv array for an exact `"--vice"` token (not a name lookup) and throws a named error before spawn — never strips silently.

### Closed consumer set as a structural absence proof (D-08)
**Source:** `.claude/mcp/vice/hostpath-consumers.test.ts:89-104` (negative-assertion shape) and `:77-83` (the untouchable positive `EXPECTED_IMPORTERS`)
**Apply to:** the `hostpath-consumers.test.ts` extension only — no new test file
```typescript
test("... are absent from the consumer set", () => {
  const importers = hostpathImporters();
  for (const name of [ /* new r2000 module names */ ]) {
    assert.equal(importers.includes(name), false, `${name} must not import hostpath.ts, whether or not it exists yet`);
  }
});
```

### Availability-gated, never-silently-skipped CI proof (D-11)
**Source:** `.claude/mcp/vice/disasm-roundtrip.test.ts:62-100` (`probeAcme()`, `SKIP_REASON`, the always-running gate test) — **shape only, new file**
**Apply to:** `r2000-verify.test.ts` (renaming every `ACME_*`/`VICE_REQUIRE_ACME` symbol to the r2000 equivalent)
```typescript
const R2000_AVAILABLE = probeR2000();
const SKIP_REASON: string | false = R2000_AVAILABLE ? false : `... set VICE_REQUIRE_R2000=1 to hard-fail ...`;
test("regenerator2000 availability gate", () => {
  if (process.env.VICE_REQUIRE_R2000) {
    assert.ok(R2000_AVAILABLE, `VICE_REQUIRE_R2000 is set but no real regenerator2000 was found ...`);
  }
});
```
D-11: CI never sets `VICE_REQUIRE_R2000`, unlike `VICE_REQUIRE_ACME` which `.github/workflows/ci.yml:94` sets unconditionally for the ACME gate — this is a deliberate asymmetry, not an oversight to "fix" by copying the CI env var too.

### Argv array, never a shell string
**Source:** `.claude/skills/acme-build/scripts/acme.mjs:124` (`spawnSync("acme", args, ...)`) and `disasm-roundtrip.test.ts:44,111-120`'s explicit rule
**Apply to:** `r2000-launch.ts`, `r2000-verify.test.ts`, and any code that shells out to `regenerator2000`
Every project-wide subprocess call already follows this convention with no exception; the new seam must not be the first to break it.

### Header-comment convention (WHY / ONE authoritative place / WHAT NOT TO DO)
**Source:** `.claude/mcp/vice/vice.ts:1-13`, `.claude/mcp/vice/containerpath.ts:1-33`
**Apply to:** `r2000-launch.ts`, `r2000-project.ts` (both new modules under `.claude/mcp/vice/`)
Every existing module in this directory states why it exists (what incident/requirement demanded it), what it is the one authoritative place for, and what NOT to do naming the specific past mistake or hazard. The two new r2000 modules should match this density, not a bare functional comment.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.claude/mcp/vice/r2000-project.ts` (the `.regen2000proj` synthesis function itself) | utility | transform | Genuinely new mechanism — no prior code in this repo gzips+base64s+JSON-encodes a project file for an external tool. Build from `ProjectState`'s field analysis (CONTEXT.md D-01, re-verify against `project.rs:41-96` directly per RESEARCH.md Assumption A1) rather than an in-repo pattern. The *style* conventions (pure function, documented scope limits inline, no version pinning) come from `d64-parse.mjs` and D-04's own reasoning, cited above, but the actual gzip/base64/JSON shape has no precedent to copy. |
| Skill-side entry point / argv-subcommand dispatch mechanism | route | request-response | RESEARCH.md's own Open Question 1 / Assumption A2 — a recommendation (argv-subcommand on the existing `vice-mcp` bin), not a verified, locked pattern. `smoke.mjs`/`probe-binmon.mjs` are the closest *shape* precedents (spawn-the-published-bin, standalone-CLI-with-flags) but neither is a subcommand-dispatch-inside-an-existing-bin precedent — this is new wiring, not a copy. |

## Deletion Blast Radius (R2000-05, criterion 4)

Full-repo grep for `disasm`/`toacme` performed (cross-checked against RESEARCH.md's own equivalent table); every consumer that must change, with exact locations:

| File:Line | What must change |
|-----------|-------------------|
| `.claude/skills/acme-build/scripts/acme.mjs:208-222` | Delete `cmdDisasm()` in full (the function whose header comment is `// \`toacme\` ships with ACME and turns object code back into ACME source.`) |
| `.claude/skills/acme-build/scripts/acme.mjs:250` | Remove the `disasm: cmdDisasm` entry from the `VERBS` dispatch object |
| `.claude/skills/acme-build/scripts/acme.mjs:257` | Remove the `disasm <file.prg> [out.a] turn object code back into ACME source` usage line |
| `.claude/skills/acme-build/scripts/acme.mjs:2-4` (header) | Confirm "Scope is assembling only" stays accurate; no `toacme` mention exists here to remove, but re-read after the deletion to be sure |
| `.claude/skills/acme-build/SKILL.md:16` | Delete the `node $A disasm game.prg ...` synopsis line |
| `.claude/skills/acme-build/SKILL.md:19` | Change "wraps `acme` and `toacme` and nothing else" → "wraps `acme` and nothing else" |
| `.claude/skills/acme-build/SKILL.md:134-176` | Delete the entire `## Disassembly` section (fenced examples, "linear decode" prose, `.dis.a`→`.dis.asm` workaround, out-of-range-label / illegal-opcode-indent instructions) |
| `.claude/skills/acme-build/SKILL.md:180` | Change "Put `acme` and `toacme` on `$PATH`." → "Put `acme` on `$PATH`." |
| `.claude/skills/acme-build/SKILL.md` (in the vacated section's place) | Add a short pointer to the new r2000 route |
| `.claude/skills/c64-program-recon/SKILL.md` | No existing `disasm`/`toacme`/`regenerator2000` mention (confirmed) — add a NEW pointer to the same route (D-12: no duplicated copy) |
| `installer/skills/acme-build/*` | **No manual edit** — gitignored, regenerated from `.claude/skills/` by `installer/scripts/sync-skills.mjs`'s `prepack` hook (`git check-ignore -v installer/skills/acme-build/SKILL.md` matches `.gitignore:43`) |
| `scripts/check-npm-packages.mjs` | No reference to `disasm`/`toacme` — confirmed by grep; no change needed for the deletion itself |
| `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md` | Historical/requirement-tracking prose (e.g. `PROJECT.md:65,247`) — backward-looking, closes naturally when R2000-05 is marked satisfied; no separate edit task |
| `docs/*.md`, other `SKILL.md` files | No other file mentions `disasm`/`toacme` as a live capability (confirmed by grep across `.md`/`.ts`/`.mts`/`.mjs`/`.json`) |
| `.claude/mcp/vice/disasm-roundtrip.test.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts`, `stock-disassemble.ts` | **Must NOT be touched** — Phase 4's unrelated, standing-constraint-protected stock live-disassembler family; a diff touching any of these in a Phase 10 plan is a scope error (RESEARCH.md Pitfall 1) |

## Metadata

**Analog search scope:** `.claude/mcp/vice/` (all top-level `.ts`/`.mts` + `*.test.*`), `.claude/skills/acme-build/`, `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs`, `.claude/skills/c64-program-recon/SKILL.md`, `scripts/check-skill-fork-honesty.mjs`, `scripts/check-npm-packages.mjs`, `.claude/mcp/vice/package.json`, `.claude/mcp/vice/THIRD-PARTY-NOTICES.md`, root `THIRD-PARTY-NOTICES.md`, `README.md`, `installer/bin/cli.mjs`, `.github/workflows/ci.yml`
**Files scanned/read in full or targeted ranges:** `vice.ts` (imports, DENY_LIST, ViceError, call() guard), `hostpath-consumers.test.ts` (full), `disasm-roundtrip.test.ts` (header + gate logic, lines 1-120), `acme.mjs` (full), `d64-parse.mjs` (full), `acme-build/SKILL.md` (full), `c64-program-recon/SKILL.md` (header), `check-skill-fork-honesty.mjs` (header + REQUIRED/FORBIDDEN arrays), `package.json` (full), `check-npm-packages.mjs` (transitive-walk header, grep-located), `THIRD-PARTY-NOTICES.md` both (full), `README.md` (Install VICE section), `installer/bin/cli.mjs` (viceServerEntry, grep-located), `resources-sync.test.ts` (header + GENERATED_EXTENSIONS, confirms `.ts` files under `.claude/mcp/vice/` need no `resources/*.mjs` artifact — only `.mts` host-bound launchers do, per `build.ts`'s own source list), `.github/workflows/ci.yml` (ACME install + Test steps), `containerpath.ts` (header style), `smoke.mjs` / `probe-binmon.mjs` (headers)
**Pattern extraction date:** 2026-08-20
