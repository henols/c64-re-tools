# Phase 39: The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) - Pattern Map

**Mapped:** 2026-09-07
**Files analyzed:** 20 (3 gate-conventions docs, 1 totality walk, 6 probe scripts + 6 evidence outcome docs, 1 findings doc, 1 fixtures README, ~6 fixture payload+sidecar pairs, 2 new production-adjacent modules)
**Analogs found:** 20 / 20 (all files in this evidence-not-code phase have a strong structural analog already in the repo)

This phase ships almost no production code. Every "file classification" row
below is either an evidence-tree document/script (mapped to Phase 33's closed
evidence tree) or one of the two production-adjacent siblings the fixture
batch requires (mapped to `binmon-fixtures.ts`/`.test.ts`). All analog paths
below were verified tracked with `git ls-files -- <path>` before being cited.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `evidence/DECISION-RULE.md` | config (gate rules) | request-response (rule lookup over a fixed input tuple) | `.planning/phases/33-.../evidence/DECISION-RULE.md` | exact |
| `evidence/SCHEMA.md` | config (outcome-line schema) | transform (raw measurement → named value) | `.planning/phases/33-.../evidence/SCHEMA.md` | exact |
| `evidence/README.md` | config (evidence conventions) | — | `.planning/phases/33-.../evidence/README.md` | exact |
| `evidence/totality-walk.mjs` | utility (executable proof script) | batch (cross-product enumeration) | Phase 33's own prose "Totality" section in `DECISION-RULE.md` (no direct `.mjs` analog — this is new mechanism per D-04) | role-match |
| `evidence/idle-coexist-probe.mjs`, `foreign-halt-probe.mjs`, `concurrent-inflight-probe.mjs`, `cross-channel-resume-probe.mjs`, `disconnect-recovery-probe.mjs`, `hitcount-invariant-probe.mjs`, `text-single-client-probe.mjs` | utility (direct-spawn probe) | event-driven (spawn → connect → command/event → outcome line) | `.planning/phases/33-.../evidence/determinism-probe.mjs` | exact |
| `evidence/textmon-probe-client.mjs` | utility (throwaway text-channel client) | streaming (raw socket, buffer-until-prompt) | No prior text-channel client exists anywhere in this repo (first-of-kind, per RESEARCH.md); structurally closest to `determinism-probe.mjs`'s connection-retry helpers, but the wire framing itself has no analog | no analog (see below) |
| `evidence/39-idle-coexist.md`, `39-foreign-halt.md`, `39-concurrent-inflight.md`, `39-cross-channel-resume.md`, `39-disconnect-recovery.md`, `39-hitcount-invariant.md`, `39-text-single-client.md` | test/evidence transcript | request-response (transcript + column-0 outcome line) | `.planning/phases/33-.../evidence/33-repro01-determinism.md` (and siblings `33-repro02-*.md`, `33-repro03-*.md`, `33-capture-pair.md`) | exact |
| `docs/phase39-dual-channel-coexistence-gate-findings.md` | config (verdict document) | transform (transcribes column-0 lines → frontmatter verdict) | `docs/phase33-reproducible-run-gate-findings.md` | exact |
| `src/mcp/vice/fixtures/textmon/README.md` | config (per-fixture provenance table) | — | `src/mcp/vice/fixtures/binmon/README.md` | exact |
| `src/mcp/vice/fixtures/textmon/*.txt` + `*.json` sidecars | model (fixture payload + provenance sidecar) | file-I/O | `src/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json` (+ its `.bin` sibling) | exact |
| `src/mcp/vice/textmon-fixtures.ts` | service/utility (fixture loader) | file-I/O (load + validate sidecar) | `src/mcp/vice/binmon-fixtures.ts` | role-match (contract copied, frame encoding explicitly NOT copied — D-18) |
| `src/mcp/vice/textmon-fixtures.test.ts` | test | file-I/O (corpus-free assertions) | `src/mcp/vice/binmon-fixtures.test.ts` | exact |

## Pattern Assignments

### `evidence/DECISION-RULE.md`, `evidence/SCHEMA.md`, `evidence/README.md` (config, D-07 three-file layout)

**Analog:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/{DECISION-RULE,SCHEMA,README}.md`

**Frozen-pre-commitment header pattern** (`DECISION-RULE.md` lines 1-16):
```markdown
# Phase 33 — The binding decision rule (GATE-01)

**Binding. Stated here, before the run, so the verdict is derived and not judged.**
Read the inputs from the evidence files, **never from a summary's paraphrase**, then
evaluate the rules **in order** and take the first that matches. Record which rule fired.

This document's commit precedes every measurement commit in this phase. `git log` is the
proof; see `README.md` § *Ordering proof*.

**Status: pre-commitment, frozen.** Nothing in this file may be edited, refined, re-scoped
or "clarified" after the first measurement commit lands ...
```
Phase 39's `DECISION-RULE.md` copies this verbatim structurally, retargeting
to the seven `D-02` inputs and the `R1..Rn` rules named in `39-CONTEXT.md`
(`IDLE_COEXIST` is `R1`/`R2`'s sole `no-go` trigger per `D-09`).

**Inputs table + distinguishing-property paragraph** (`DECISION-RULE.md` lines 33-63):
```markdown
| Input | Domain | Corpus-free | Source line | Source file |
|---|---|---|---|---|
| `SEED_EFFECT` | `pinned` / `partial` / `unpinned` | yes | `SEED_EFFECT:` | `evidence/33-repro01-determinism.md` |
...
**The distinguishing property of this gate (D-02).** Four of the five inputs —
... are **corpus-free** ... The fifth, `C0_CAPTURE_PAIR`, is corpus-bound, and
`C0_CAPTURE_PAIR: not-obtained` is an input **value**, never a reason to abstain.
```
Phase 39's own distinguishing property (RESEARCH.md's "Summary") is the
inverse framing: all seven inputs are corpus-free, so the abstention risk is
an *untakeable experiment*, absorbed by `D-03`'s explicit `not-taken` member.
State this inversion explicitly in `DECISION-RULE.md`'s own version of this
paragraph — do not silently drop the "distinguishing property" section.

**Outcome-line conventions** (`SCHEMA.md` lines 16-34) — copy **verbatim**, per
`D-07`'s explicit instruction ("The transcription rule carries over verbatim"):
```markdown
Every rule input and every recorded fact is a bare `NAME: value` at **column 0** of a named
evidence file. Never indented, never inside a fenced block ...
- **Final occurrence wins.** ...
- **One declared source file per line.** ...
- **Absence.** For the **five gate inputs** an absent line is not a pass, not a default and
  not a defensible state — it is an incomplete phase ...
```
Retarget "five gate inputs" to "seven gate inputs" — the only substantive edit
this paragraph needs.

**Evidence conventions numbered list** (`README.md` lines 44-92) — the
transcript convention, `PROBE_DIR` (never `/tmp`), `BROKER_STATE:` /
`TEST_AUTOMATED_BASELINE:` (D-16 — retarget the stated baseline count to "2
failing tests in `anno-register.test.ts` alone," never "clean floor: 0"),
voided-run recording, final-occurrence-wins, and "values transcribed, never
remembered." All seven numbered rules carry over unchanged in spirit; only the
baseline-count sentence (rule 4) needs the phase-39-specific number.

**Ordering proof commands** (`README.md` lines 95-99, continuing past the read
window; full commands also reproduced in RESEARCH.md Pattern 3):
```bash
$ git log --oneline -- .planning/phases/39-.../evidence
(no output)
$ git rev-list --count HEAD -- .planning/phases/39-.../evidence
0
```
then, after landing:
```bash
E=.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence
RULES=$(git log --diff-filter=A --format=%H -- "$E/DECISION-RULE.md" | tail -1)
git rev-list --count "$RULES" -- "$E"      # must print 1
```

**Files table shape** (`README.md` lines 13-41) — one row per artifact, "Owner
/ What it is / What it proves" columns. Phase 39's `README.md` should carry
the equivalent table for its own artifact list (`DECISION-RULE.md`,
`SCHEMA.md`, `README.md`, `totality-walk.mjs`, the seven probe scripts, the
seven `39-*.md` evidence docs, the findings doc) with the same three-column
discipline.

---

### `evidence/totality-walk.mjs` (utility, batch cross-product enumeration)

**Analog:** No direct script-form analog exists (Phase 33 discharged totality
in prose, per `DECISION-RULE.md`'s own "## Totality" section, at 108 tuples).
D-04 requires this phase's totality proof to be **executable** because 3,888
tuples exceeds what a reader can check by hand. RESEARCH.md's own "Pattern 4"
section (this phase's own research artifact, not a prior codebase file) is
the closest thing to a template and should be used near-verbatim:

```javascript
const DOMAINS = {
  IDLE_COEXIST: ["clean", "corrupts", "not-taken"],
  FOREIGN_HALT_VISIBILITY: ["visible", "invisible", "corrupts", "not-taken"],
  CONCURRENT_INFLIGHT: ["clean", "degraded", "corrupts", "not-taken"],
  CROSS_CHANNEL_RESUME: ["clean", "corrupts", "not-taken"],
  DISCONNECT_RECOVERY: ["recovers", "leaves-halted", "not-taken"],
  HITCOUNT_INVARIANT_HOLDS: ["holds", "breaks", "not-taken"],
  TEXT_SINGLE_CLIENT: ["single", "multi", "not-taken"],
};

function* crossProduct(domains) { /* ... */ }

const RULES = [/* R1, R2, ... in the exact order DECISION-RULE.md states -- authored
                  in 39-01, never invented here */];

let total = 0;
const hits = Object.fromEntries(RULES.map((r) => [r.id, 0]));
for (const tuple of crossProduct(DOMAINS)) {
  total += 1;
  const matched = RULES.find((r) => r.test(tuple));
  if (!matched) throw new Error(`tuple ${JSON.stringify(tuple)} matched NO rule -- totality violated`);
  hits[matched.id] += 1;
}
console.log(`TOTAL_TUPLES ${total}`);
for (const [id, n] of Object.entries(hits)) console.log(`RULE_HIT ${id} ${n}`);
```
Must be committed in the **same commit** as `DECISION-RULE.md` (D-04's "The
script is committed in `39-01`, so the walk itself predates every
measurement"). Column-0 output (`TOTAL_TUPLES`, `RULE_HIT <id> <n>`) follows
the same outcome-line convention `SCHEMA.md` fixes for everything else.

---

### `evidence/idle-coexist-probe.mjs` and the other six probe scripts (utility, direct-spawn probes)

**Analog:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/determinism-probe.mjs`

**Structured file-header pattern** (lines 1-60) — copy the three-part header
shape ("WHY IT SPAWNS x64sc DIRECTLY", "WHAT IT DOES *NOT* RETYPE", "WHAT NOT
TO DO") into every one of the seven probe scripts, retargeted per experiment:
```javascript
#!/usr/bin/env node
// -----------------------------------------------------------------------------
// <name>-probe.mjs -- Phase 39, plan 39-NN, Task N (`<GATE_INPUT_NAME>`).
//
// WHAT THIS MEASURES, AND WHY
// ----------------------------
// <input name> is <derivation from SCHEMA.md>...
//
// WHY IT SPAWNS x64sc DIRECTLY AND NOT THROUGH THE BROKER
// ------------------------------------------------------
// The broker never surfaces `remoteMonitorPort` to a container-side caller
// (CHAN-02, MEASURED zero grep hits) -- direct execve is the only route that
// can reach a chosen text port at all. Recorded as a trust boundary in this
// plan's threat model (D-12).
//
// WHAT IT DOES *NOT* RETYPE
// -------------------------
//   - The determinism block / stock argv. Imported from broker-launch.mts's
//     exported STOCK_DETERMINISM_FLAGS (T-33-36 precedent), never retyped.
//   - The wire encoders. Every binary-channel command body comes from
//     stock-protocol.ts (D-14). The probe hand-rolls no binary frames.
//   - (Text channel only) the throwaway textmon-probe-client.mjs helper is
//     imported/reused across all seven probes, not reimplemented per script.
//
// WHAT NOT TO DO
// --------------
//   - Never add a passthrough argv parameter.
//   - Never run without preflight() (D-16 -- enforced in code, not habit).
//   - Never single-shot connect() after spawn on EITHER port (Pitfall 4).
// -----------------------------------------------------------------------------
```

**Import-shipped-seams pattern** (lines 61-84):
```javascript
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const launch = await import(path.join(MCP_DIR, "broker-launch.mts"));

const { CommandType, CheckpointOperation, ResetMode, ViceMonitorClient } = proto;
const { STOCK_DETERMINISM_FLAGS, STOCK_DETERMINISM_SEED } = launch;
```
Phase 39's probes import the same two modules; additionally each probe must
resolve **both** `VICE_BIN` candidates by absolute path (`/usr/bin/x64sc`
stock baseline per D-15, `/usr/local/bin/x64sc` fork for criterion 5's
second-binary capture) and record which one answered — never bare `x64sc`.

**Preflight-refusal-in-code pattern** (verified, from RESEARCH.md's own
excerpt of the same file, lines 123-152):
```javascript
function preflight() {
  const broker = systemdBrokerState();
  const alive = aliveX64sc();
  log(`PREFLIGHT_BROKER ${broker}`);
  log(`PREFLIGHT_X64SC ${alive.length ? alive.join(",") : "(none)"}`);
  if (broker !== "inactive") {
    throw new Error(`D-11 REFUSAL: the vice-broker unit is "${broker}", expected "inactive". Measurement not taken.`);
  }
  if (alive.length) {
    throw new Error(`D-11 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}). Measurement not taken.`);
  }
}
```
Copy this verbatim (or extract a shared helper imported by all seven probes) —
D-16 makes this a phase-wide rule.

**Stock argv, exactly as shipped** — read-only analog for what every probe's
spawn call must reproduce (`src/mcp/vice/broker-launch.mts:357-379`):
```typescript
const args = ["-default"];
if (profile?.headless) { args.push("-console"); }
args.push("-drive8type", "1541");
args.push(...STOCK_DETERMINISM_FLAGS);
if (profile?.warp) { args.push("-warp"); }
args.push("-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`);
if (typeof remoteMonitorPort === "number") {
  args.push("-remotemonitor", "-remotemonitoraddress", `ip4://${host}:${remoteMonitorPort}`);
}
```
`-default` must be argv[0]; `-remotemonitor` block goes last, per the
MEASURED-vs-UNVERIFIED ordering distinction RESEARCH.md's Pitfall 2 states.
**This file is read-only for this phase** — no probe may edit
`broker-launch.mts`; every probe reproduces this argv shape by hand in its own
spawn call, importing only `STOCK_DETERMINISM_FLAGS`.

---

### `evidence/textmon-probe-client.mjs` (utility, throwaway text-channel client — no analog)

**No prior analog exists.** Nothing in this repository has ever opened a
socket to `-remotemonitor` (RESEARCH.md: "the exact greeting/prompt byte
sequence is not present anywhere in this repository"). Build per D-13's
explicit authorization, illustrative shape only (not copied from an existing
file — this is genuinely new mechanism, unlike everything else in this
phase):
```javascript
import net from "node:net";

function connectTextMonitor(port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: "127.0.0.1", port }, () => resolve(sock));
    sock.once("error", reject);
  });
}

function sendAndAwaitPrompt(sock, command, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const PROMPT_RE = /\(C:\$[0-9a-fA-F]{4}\)\s*$/;
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      if (PROMPT_RE.test(buf)) { clearTimeout(timer); sock.off("data", onData); resolve(buf); }
    };
    const timer = setTimeout(() => {
      sock.off("data", onData);
      reject(new Error(`no prompt within ${timeoutMs} ms; buffer so far: ${JSON.stringify(buf)}`));
    }, timeoutMs);
    sock.on("data", onData);
    sock.write(`${command}\n`);
  });
}
```
The regex is explicitly UNVERIFIED (RESEARCH.md Assumption A2) — the first
probe run that connects must capture the raw banner+prompt bytes into a
committed fixture before trusting this pattern further (see
`textmon-fixtures.ts` below). This file must carry the same "WHAT NOT TO DO"
header discipline as the probe scripts, naming explicitly: no reliable
framing (that's `CHAN-03`, Phase 41), no survival past this phase (D-13), no
promotion to `src/`.

---

### `evidence/39-idle-coexist.md` and the other six evidence transcripts (test/evidence transcript)

**Analog:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-repro01-determinism.md` (and its siblings `33-repro02-reset-removed.md`, `33-repro03-frame-anchor.md`, `33-capture-pair.md`)

Each Phase 39 evidence file must carry: the `$ <command>` transcript
convention (append the exact command line, then its real stdout/stderr
verbatim — README.md § *Evidence conventions* rule 1), `BROKER_STATE:
inactive` and the observed `test:automated` failing-test count/names (rule 3,
per D-16 — never "clean floor: 0"), any voided run recorded with its reason
(rule 5), and the file's own column-0 outcome line (e.g. `IDLE_COEXIST:
clean`) as the final line, honoring final-occurrence-wins.

---

### `docs/phase39-dual-channel-coexistence-gate-findings.md` (config, verdict document)

**Analog:** `docs/phase33-reproducible-run-gate-findings.md`

Per D-05: "Same key order as `docs/phase33-reproducible-run-gate-findings.md`" — read that file's YAML frontmatter key order directly before authoring Phase 39's frontmatter (`verdict`, `verdict_rule_applied`, then the input fields, each citing its evidence file + line). The document body reproduces the full rule set and walks the actual outcome values through it mechanically, matching Phase 33's own structure (one section per input, transcribed values cited by path).

---

### `src/mcp/vice/fixtures/textmon/README.md` (config, per-fixture provenance table)

**Analog:** `src/mcp/vice/fixtures/binmon/README.md`

**Provenance table shape** (lines 51-60):
```markdown
| Fixture | Case | Captured from | VICE version | Captured at | Asserted by |
|---|---|---|---|---|---|
| `display-get.bin` / `.json` | `display-get` | **real capture** -- `fork:/usr/local/bin/x64sc` | 3.10.0.0 | 2026-08-21 | `binmon-fixtures.test.ts`, `stock-protocol.test.ts` |
```
Phase 39's `fixtures/textmon/README.md` reuses this table verbatim in shape,
one row per committed text capture (`memmapshow`, `prof-flat`, `chis`, `bt`,
`io`, `prompt`, plus any unsupported-command refusal per D-20), each row's
"Captured from" naming `stock:/usr/bin/x64sc` (the 3.9 baseline, D-15) or the
second binary for the two-binary provenance requirement.

**"Bounded by design" / regeneration section** (lines 84-132) — the
"regenerate, never hand-edit" discipline and any version-gating note (only
applicable here if a text command is version-sensitive the way
`CPUHISTORY_GET` is on the binary side — per RESEARCH.md Pitfall 6, `chis` is
explicitly **not** gated the same way, so this section should state that
distinction rather than import the `>= 3.10` framing).

---

### `src/mcp/vice/fixtures/textmon/*.json` sidecars, including the unsupported-command case (model, fixture provenance sidecar)

**Analog:** `src/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json` (verbatim, per D-20's own citation as "exactly what this JSON already does")
```json
{
  "capturedFrom": "stock:/usr/bin/x64sc",
  "viceVersion": "3.9.0.0",
  "capturedAt": "2026-08-18T10:56:06.002Z",
  "command": "CPUHISTORY_GET (0x86) count=1 against a build without FEATURE_CPUMEMHISTORY",
  "synthetic": false,
  "note": "Real capture from a genuine VICE 3.9 build (/usr/bin/x64sc), which has no 0x86 case at all: the reply is an INVALID_TYPE (0x83) error frame. REQUIRES A 3.9-CLASS BUILD to re-record..."
}
```
The five **required** keys, verbatim from `binmon-fixtures.ts:228`:
```typescript
const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"] as const;
```
`textmon-fixtures.ts` reimplements this exact array (own copy, not imported —
D-18: the shared part is the sidecar contract, not the loader). For any
unsupported text-monitor command (D-20), the `note` field must name both the
missing capability and the binary, matching this file's pattern exactly.

---

### `src/mcp/vice/textmon-fixtures.ts` (service/utility, fixture loader)

**Analog:** `src/mcp/vice/binmon-fixtures.ts`

**Structured file-header pattern** (lines 1-53) — the "WHY THIS FILE EXISTS /
what it is the ONE place for / WHAT NOT TO DO" convention, retargeted:
```typescript
// Test-support module: a loader for the captured text-monitor fixtures this
// phase commits under fixtures/textmon/. This is the ONE place any test in
// this package loads a text-monitor capture's provenance sidecar -- no test
// file should hand-roll its own key-presence check.
//
// WHY THIS FILE EXISTS: binmon-fixtures.ts's whole contract is byte-exact
// binary-monitor response FRAMES -- STX, api_version, the 12-byte header.
// Text captures share none of that beyond the five provenance keys (D-18).
// Widening binmon-fixtures.ts would falsify its own file-header claim of
// being the ONE binary-frame loader and would invite a text test to reach
// for a frame encoder it has no business touching.
//
// WHAT NOT TO DO: never import anything from binmon-fixtures.ts's frame-
// encoding surface here (encodeResponseFrame, VICE_STX, RESPONSE_HEADER_LEN,
// etc.) -- the shared part is the sidecar validation CONTRACT, reimplemented
// below with the same five keys, not the frame layout. Never widen
// binmon-fixtures.ts to accept text payloads instead of adding this sibling.
```

**Required-keys + refusal pattern** (lines 219-298, contract reimplemented, not imported):
```typescript
const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"] as const;

export class MissingFixtureError extends Error {
  path?: string;
  command?: string;
  constructor(message: string, { path, command }: MissingFixtureErrorOptions = {}) {
    super(message);
    this.name = "MissingFixtureError";
    this.path = path;
    this.command = command;
  }
}

export function loadCapturedFixture(caseName: string, { dir }: LoadCapturedFixtureOptions = {}): CapturedFixture {
  const baseDir = dir ?? join(HERE, "fixtures", "textmon");
  const textPath = join(baseDir, `${caseName}.txt`);   // raw text payload, not .bin
  const jsonPath = join(baseDir, `${caseName}.json`);
  // ... same existsSync -> MissingFixtureError, JSON.parse -> MissingFixtureError,
  // missingKeys = REQUIRED_PROVENANCE_KEYS.filter(...) -> MissingFixtureError shape
  return { text, provenance, synthetic: provenance.synthetic === true };
}
```
Only the payload extension (`.txt` raw text, not `.bin` wire bytes) and the
returned field name (`text` vs `bytes`) differ from the binary analog; the
error class, the required-keys check, and the refusal messages copy the shape
directly.

---

### `src/mcp/vice/textmon-fixtures.test.ts` (test, corpus-free loader guard)

**Analog:** `src/mcp/vice/binmon-fixtures.test.ts:326-336`

**Refuse-on-missing-key / synthetic-false assertion shape** (verbatim structure):
```typescript
test("EXTV-01: the three re-recorded fixtures report synthetic: false, with a capturedFrom naming the kind and path of the binary that actually answered", () => {
  for (const caseName of ["display-get", "event-interleaved", "checkpoint-list"] as const) {
    const loaded = loadCapturedFixture(caseName);
    assert.equal(loaded.synthetic, false, `${caseName} is now a real, hardware-recorded capture -- it must say so`);
    assert.match(
      String(loaded.provenance.capturedFrom),
      /^(fork|stock):\//,
      `${caseName}.json's capturedFrom must name a real binary's kind and absolute path, not the retired "synthesized-fallback" placeholder`,
    );
  }
});
```
Per D-19, `textmon-fixtures.test.ts` needs exactly this shape twice: (a) one
test asserting the loader throws `MissingFixtureError` when a sidecar is
missing any of the five required keys, and (b) one test iterating every
committed text fixture asserting `synthetic === false` and `capturedFrom`
matches `/^(fork|stock):\//`. **No emulator needed** — this test joins
`automatedTestFiles()` (Node's `--test` runner) and `MANUAL_ONLY_TESTS` in
`src/mcp/vice/test-gate.mjs` stays unchanged (zero new entries, per D-19's
explicit default expectation).

## Shared Patterns

### Structured "WHY / ONE-PLACE / WHAT-NOT-TO-DO" file header
**Source:** `src/mcp/vice/binmon-fixtures.ts:1-53`, `.planning/phases/33-.../evidence/determinism-probe.mjs:1-60`
**Apply to:** every new `.mjs` probe script, `textmon-probe-client.mjs`, and `textmon-fixtures.ts`
```
// WHY THIS FILE EXISTS: <the problem/incident that motivated it>
// WHAT IT IS THE ONE PLACE FOR: <the single seam>
// WHAT NOT TO DO: <the specific past mistake named, or the specific
//   temptation this phase must resist -- e.g. "never build monitor-lock.ts
//   in any shape">
```

### Column-0 outcome-line transcription discipline
**Source:** `.planning/phases/33-.../evidence/SCHEMA.md` §1, `.planning/phases/33-.../evidence/README.md` § *Evidence conventions*
**Apply to:** every evidence `.md` file, `DECISION-RULE.md`, `SCHEMA.md`, `totality-walk.mjs`'s own stdout, and `docs/phase39-...-findings.md`
```
NAME: value        <- bare, column 0, never indented, never in a table cell or fence
```
Final occurrence wins; one declared source file per line; absence is an
incomplete phase, never a default.

### Preflight-refusal-in-code before every live spawn
**Source:** `.planning/phases/33-.../evidence/determinism-probe.mjs:123-152` (quoted in full above)
**Apply to:** all seven probe scripts — refuse in code (throw), not as a shell habit, checking both `systemctl --user is-active vice-broker` (expect `inactive`) and `pgrep -x x64sc` (expect none).

### Import-not-retype for shipped constants
**Source:** `.planning/phases/33-.../evidence/determinism-probe.mjs:67-84`, `src/mcp/vice/broker-launch.mts:357-379`
**Apply to:** every probe script — import `STOCK_DETERMINISM_FLAGS` from `broker-launch.mts` and the wire encoders from `stock-protocol.ts`; never hand-roll either.

### Five-key fixture provenance contract
**Source:** `src/mcp/vice/binmon-fixtures.ts:228` (`REQUIRED_PROVENANCE_KEYS`)
**Apply to:** every `fixtures/textmon/*.json` sidecar and `textmon-fixtures.ts`'s own reimplemented constant — `capturedFrom`, `viceVersion`, `capturedAt`, `command`, `synthetic`, all required, refuse-on-missing.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `evidence/textmon-probe-client.mjs` | utility | streaming | First text-monitor socket client in the project's history (RESEARCH.md: "nothing in this repo has ever opened a socket to `-remotemonitor`"); build per D-13's illustrative shape in RESEARCH.md Pattern 5, not from any existing file |
| `evidence/totality-walk.mjs` | utility | batch | Phase 33 discharged totality in prose (108 tuples); no prior script-form totality walk exists in this repo. Use RESEARCH.md's own "Pattern 4" skeleton as the template instead of a codebase analog |

## Metadata

**Analog search scope:** `.planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/`, `.planning/phases/38-proof-01-03-on-real-cracked-code/evidence/`, `src/mcp/vice/binmon-fixtures.ts`, `src/mcp/vice/binmon-fixtures.test.ts`, `src/mcp/vice/fixtures/binmon/`, `src/mcp/vice/broker-launch.mts`, `docs/phase33-reproducible-run-gate-findings.md`
**Files scanned:** 12 read directly (all verified git-tracked via `git ls-files`)
**Pattern extraction date:** 2026-09-07
