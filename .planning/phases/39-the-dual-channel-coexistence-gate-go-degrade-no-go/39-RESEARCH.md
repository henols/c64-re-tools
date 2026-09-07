# Phase 39: The Dual-Channel Coexistence Gate (Go/Degrade/No-Go) - Research

**Researched:** 2026-09-07
**Domain:** Live VICE binary-monitor + text-monitor (`-remotemonitor`) coexistence measurement; pre-committed gate evidence (no production code)
**Confidence:** HIGH for everything read directly from source this session; UNVERIFIED called out explicitly where no file or live measurement exists

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

`D-01` through `D-20`, all locked by the owner at `/gsd-discuss-phase 39`
(2026-09-07). Full text is reproduced in
`.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/39-CONTEXT.md`
and is treated as binding in this research pass, not re-litigated. Summary of
the load-bearing ones (read the CONTEXT.md file itself for full text and
reversibility notes):

- **D-01:** The rules/schema/evidence conventions are plan `39-01`, touching
  nothing else. Git order (not a test guard) is the proof.
- **D-02:** Exactly seven named, machine-readable gate inputs — `IDLE_COEXIST`,
  `FOREIGN_HALT_VISIBILITY`, `CONCURRENT_INFLIGHT`, `CROSS_CHANNEL_RESUME`,
  `DISCONNECT_RECOVERY`, `HITCOUNT_INVARIANT_HOLDS`, `TEXT_SINGLE_CLIENT` — see
  CONTEXT.md's table for each one's domain and source experiment.
- **D-03:** `could-not-run` is not an emittable verdict; every input carries an
  explicit `not-taken` member instead.
- **D-04:** Totality is discharged by a committed executable walk, not prose.
- **D-05:** The verdict is machine-readable YAML frontmatter in
  `docs/phase39-dual-channel-coexistence-gate-findings.md`, same key order as
  Phase 33's findings doc.
- **D-06:** The verdict binds Phases 41-44 through ROADMAP `Depends on` +
  Notes + a STATE.md pointer, with no test guard.
- **D-07:** The evidence layout mirrors Phase 33's exactly (`DECISION-RULE.md`,
  `SCHEMA.md`, `README.md` as three files).
- **D-08:** `TEXT_SINGLE_CLIENT` gates nothing on its own; it is a recorded
  fact for Phase 41's connection management, not a rule antecedent.
- **D-09:** `IDLE_COEXIST` is the sole `no-go` trigger, firing on both
  `corrupts` and `not-taken` via two separately numbered rules.
- **D-10:** `DISCONNECT_RECOVERY: leaves-halted` is a `degrade` whose fix is
  named in the verdict, pre-mapped in `39-01`.
- **D-11:** Pre-mapped `degrade` narrowing is authored for
  `DISCONNECT_RECOVERY` and `HITCOUNT_INVARIANT_HOLDS` only; the other five
  inputs narrow at verdict time, Phase 9 style.
- **D-12:** The probe spawns `x64sc` directly, `-default` first, never through
  the broker. Recorded as a trust boundary in the plan's threat model.
- **D-13:** The text-channel client is a throwaway probe helper; nothing from
  it survives into Phase 41. Crude, deliberate prompt framing only.
- **D-14:** The binary half of every experiment is driven through the shipped
  `stock-protocol.ts` encoders, never hand-rolled frames. *(Claude's
  discretion — not put to the owner.)*
- **D-15:** Measured on genuine stock 3.9 at `/usr/bin/x64sc`; VICE version is
  provenance, never a gate input. Every probe resolves its binary by absolute
  path (PATH hazard: fork 3.10 shadows stock).
- **D-16:** Every live run is taken with the broker stopped, recording
  `BROKER_STATE:` and the `test:automated` baseline beside it. **Never write
  "clean floor: 0"** — the measured floor is 2 failing tests in
  `anno-register.test.ts` alone.
- **D-17:** Only parseable command outputs become committed fixtures; the
  coexistence experiments stay transcripts.
- **D-18:** Text fixtures live in `src/mcp/vice/fixtures/textmon/` with their
  own sibling loader module; `binmon-fixtures.ts` is not extended.
- **D-19:** Exactly one corpus-free automated test guards the loader;
  `MANUAL_ONLY_TESTS` is unchanged by default. Default expectation: zero new
  entries.
- **D-20:** When a command is unsupported on a binary, the refusal itself is
  committed as a fixture, following `cpuhistory-get-unsupported.json`'s model.

### Claude's Discretion

Everything not enumerated as a locked decision above: plan decomposition,
which experiments run concurrently, the concurrent in-flight experiment's
timing method, evidence file naming. `D-14` was Claude's discretion, not put
to the owner. Three decisions are named by CONTEXT.md as most worth a second
look before `39-01` is committed: `D-09`'s `not-taken` → `no-go` arm (context
extended the owner's answer rather than recording it verbatim), `D-02`'s
seven-input value domains (indicative until `SCHEMA.md` fixes them), and
`D-11`'s choice of which two inputs get pre-mapped narrowing.

### Deferred Ideas (OUT OF SCOPE)

- `CHAN-02`'s port surfacing (making `remoteMonitorPort` reachable from the
  container) — mapped to Phase 41.
- `CHAN-03`'s reliable framing (a prompt terminator surviving split TCP
  segments) — mapped to Phase 41.
- `monitor-lock.ts` in any of its three shapes — the whole point of the
  verdict; Phase 41.
- A text-monitor client module in `src/` — declined by D-13; Phase 41 writes
  it against the shape the verdict selects.
- A test guard on the gate's downstream binding — declined by D-06.
- A live text-capture suite in `MANUAL_ONLY_TESTS` — declined by D-19.
- VICE's text-monitor `a`/`d` (assemble/disassemble) and `x64` ↔ `x64sc` mode
  switching — declined by the owner at the milestone open (2026-09-06), not
  revisited here.

One folded todo is in scope:
`.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md`
(`resolves_phase: 39`), requiring `STATE.md`'s Deferred Items row to move in
the **same commit** as the file move to `.planning/todos/completed/` —
`docs-deferred-ledger.test.ts` fails in both directions otherwise (verified
this session, see Sources).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| CHAN-01 | A pre-committed go / degrade / no-go gate answers, from live measurement against genuine stock VICE, whether a text-monitor client and a binary-monitor client can drive the same emulator without corrupting each other — covering at minimum idle coexistence, whether one channel's halt is visible to the other, concurrent in-flight commands, cross-channel resume, and recovery from an abrupt disconnect. The gate's rules and its pass/fail rule are committed before any measurement is taken, and the verdict selects which serialization shape is built rather than confirming one already chosen. *(Settles the milestone's two blocking UNVERIFIED items.)* | Pattern 3 (three-file evidence layout + ordering proof) and Pattern 4 (totality-walk arithmetic, 3,888 tuples) give the mechanical shape for the pre-commitment half. Patterns 1/2/5 plus the Common Pitfalls section give the mechanical shape for the seven live measurements (five named experiments + two blocking UNVERIFIED items) using the shipped `stock-protocol.ts` encoders for the binary half and a throwaway crude client for the text half. The Code Examples section gives the verbatim five-key fixture sidecar shape and the loader-refusal test shape criterion 5 needs. |
</phase_requirements>

## Summary

This phase ships zero production modules. Its whole deliverable is three
committed artifacts: (1) a pre-committed rule set + schema + evidence
conventions (`39-01`, mirroring Phase 33's three-file layout exactly), (2) seven
measured gate-input values recorded as column-0 outcome lines across the five
named experiments plus the two blocking UNVERIFIED items, and (3) a first
text-channel fixture batch with the same five-key provenance discipline the
binary-monitor fixtures already carry.

Every piece of shipped code the probe touches already exists and is verified in
this research pass: `buildViceArgs()`'s exact stock-branch argv order
(`src/mcp/vice/broker-launch.mts:357-379`), the exported `STOCK_DETERMINISM_FLAGS`
array, the `stock-protocol.ts` wire encoders the binary half of every experiment
must use (never hand-rolled), and `binmon-fixtures.ts`'s provenance contract
(`REQUIRED_PROVENANCE_KEYS` at line 228, `loadCapturedFixture()`'s refusal
behaviour) that the new sibling text-fixture loader (D-18) must reimplement for
its own five keys without importing the binary frame encoder. Phase 33's
`determinism-probe.mjs` is the structural template for every probe script this
phase writes: direct `execve` of `/usr/bin/x64sc`, D-11 preflight-refusal-in-code,
committed-not-recalled transcripts, and a "WHAT IT DOES NOT RETYPE" header.

The one genuinely new mechanical problem this phase must solve that Phase 33
did not: **the text-monitor half of every experiment has no shipped encoder at
all** — nothing in this repo has ever opened a socket to `-remotemonitor`. D-13
deliberately keeps that half throwaway and crude (a raw `net.Socket`, framed by
watching for the `(C:$xxxx) ` prompt substring in accumulated buffered text),
which is appropriate for a phase whose text client must not survive into
Phase 41. The exact greeting/prompt byte sequence is **not present anywhere in
this repository** — it was observed in a one-off manual session recorded in
`.planning/notes/text-monitor-channel-live-probe.md`, which captured command
*behaviour* but not a byte-exact transcript. The first probe run this phase
executes is therefore also the first time the literal bytes are captured to a
committed file — treat that capture as **the** deliverable of Task 1, not as a
formality.

**Primary recommendation:** Structure `39-01` exactly like `33-01`
(`DECISION-RULE.md` + `SCHEMA.md` + `README.md`, one commit, nothing else) and
verify the ordering proof the same way (`git rev-list --count <rules-sha> --
evidence/` = `1`). Structure every subsequent probe script after
`determinism-probe.mjs`'s shape: import `STOCK_DETERMINISM_FLAGS` and
`ViceMonitorClient`/encoders from the shipped modules for the binary half,
hand-roll only the text half, and never let the binary channel's readiness
probe or checkpoint-wait logic diverge from the shipped `awaitHit`-style
event-driven pattern. Compute the totality walk (7 inputs, sizes 3×4×4×3×3×3×3 =
**3,888** tuples — verified by multiplication against the domains D-02 states,
not read from a committed schema since `SCHEMA.md` does not exist yet) as an
executable script committed in `39-01`, not prose — Phase 33's own 108-tuple
prose walk is explicitly named in `D-04` as already at the limit of what a
reader can check by hand, and 3,888 is roughly 36× that.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Rule/schema/evidence-convention authoring | Planning artifact (evidence/*.md) | — | D-01: git-order-as-proof, no runtime component |
| Emulator process lifecycle for the probe | Host process (direct `execve`, bypassing the broker) | — | D-12: the broker cannot surface `remoteMonitorPort` to a container-side caller (MEASURED zero grep hits, confirmed this session); the probe owns both ports itself |
| Binary-channel wire protocol | `src/mcp/vice/stock-protocol.ts` (shipped encoders) | — | D-14: never hand-rolled; a future encoder edit must change what the probe sends |
| Text-channel wire protocol | Throwaway probe helper (evidence dir only) | — | D-13: crude, deliberate, does not survive into Phase 41 (`CHAN-03` owns the real framing) |
| Serialization authority (mutex / lease / connect-gate) | **Not built this phase** | — | Explicitly out of scope; the verdict selects the shape for Phase 41 |
| Fixture storage + loader | `src/mcp/vice/fixtures/textmon/` + sibling loader module | — | D-18: single seam per concern; `binmon-fixtures.ts` stays binary-only |
| Verdict binding to downstream phases | ROADMAP `Depends on` + Notes + STATE.md pointer | — | D-06: no test guard, matching Phase 9/23/33 precedent |

## Standard Stack

### Core

No new runtime dependency is installed by this phase. Every piece the probe
needs is either a Node builtin or already shipped in `src/mcp/vice/`:

| Module | Version/Source | Purpose | Why standard here |
|---|---|---|---|
| `node:net`, `node:child_process`, `node:fs`, `node:crypto` | Node builtin (project requires Node ≥ 24) | Direct socket + process control for both channels | Same builtins `determinism-probe.mjs` uses; no wrapper library exists or is needed for two localhost sockets |
| `src/mcp/vice/stock-protocol.ts` | in-repo, 2390 lines | Binary-channel wire encoders (`CommandType`, `memGetBody`, `checkpointSetBody`, `advanceInstructionsBody`, `resetBody`, `cpNumBody`, …) | D-14: mandatory, not optional — "never hand-rolled frames" |
| `src/mcp/vice/broker-launch.mts` (`STOCK_DETERMINISM_FLAGS`, `buildViceArgs` doc comments) | in-repo | Import, not retype, the shipped argv shape | Matches Phase 33's `T-33-36` precedent exactly |
| `src/mcp/vice/binmon-fixtures.ts` | in-repo | Contract to reimplement for text (`REQUIRED_PROVENANCE_KEYS` shape), never import directly | D-18 |
| Node's built-in test runner (`node --test`) | project standard | The one new automated test (D-19) | No separate framework anywhere in this repo |

### Supporting

None. This phase adds no library dependency at all — it is a probe-and-record
phase.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Raw `net.Socket` for the text channel | A small line-oriented telnet-style npm package | Rejected by D-13 on its own terms: the client is throwaway and crude *by design*, and a dependency here would be a Phase-41-shaped investment in code meant to be discarded |
| Direct `execve` of x64sc (D-12) | Going through the broker's acquire path | Rejected: the broker never surfaces `remoteMonitorPort` to a container-side caller (CHAN-02, unclosed until Phase 41); direct spawn is the only route that can reach a chosen text port at all |

**Installation:** None required — no `npm install` for this phase.

**Version verification:** N/A — no package is added. The two binaries under
measurement are verified by absolute path and `--version`, not by a package
registry: `/usr/bin/x64sc` (genuine stock, MEASURED `VICE 3.9` per this
project's memory and `.planning/notes/text-monitor-channel-live-probe.md`) and
`/usr/local/bin/x64sc` (the fork, VICE 3.10, shadows stock on bare `$PATH`).
**Every probe script must resolve the binary by absolute path, never by bare
`x64sc`**, exactly as `determinism-probe.mjs`'s own `VICE_BIN` constant does
(`.planning/phases/33-.../evidence/determinism-probe.mjs:90`).

## Package Legitimacy Audit

**Not applicable — this phase installs no external package.** Every module the
probe imports is either a Node builtin or an in-repo file already present on
disk (`stock-protocol.ts`, `broker-launch.mts`, `binmon-fixtures.ts`'s
*contract*, reimplemented rather than imported). No `npm install` command
belongs in any plan this phase produces.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │   probe script (Node, evidence/ dir)     │
                     │   execve() -- NOT through the broker     │
                     └───────────────┬───────────────────────────┘
                                     │ spawns
                                     ▼
                     ┌─────────────────────────────────────────┐
                     │  /usr/bin/x64sc  (genuine stock 3.9)     │
                     │  argv: -default [-console] -drive8type   │
                     │  1541 <STOCK_DETERMINISM_FLAGS> [-warp]  │
                     │  -binarymonitor -binarymonitoraddress    │
                     │  ip4://127.0.0.1:<portA>                 │
                     │  -remotemonitor -remotemonitoraddress    │
                     │  ip4://127.0.0.1:<portB>                 │
                     └───────┬───────────────────┬───────────────┘
                             │                   │
              binary channel │                   │ text channel
              (portA)        │                   │ (portB)
                             ▼                   ▼
              ┌───────────────────────┐  ┌─────────────────────────┐
              │ stock-protocol.ts     │  │ throwaway text-client    │
              │ ViceMonitorClient-    │  │ helper (raw net.Socket,  │
              │ style encoders        │  │ frames on `(C:$xxxx) `)  │
              │ (D-14: no hand-rolled │  │ (D-13: crude, deliberate,│
              │  frames)              │  │  does not survive phase)│
              └───────────┬───────────┘  └────────────┬─────────────┘
                          │                            │
                          └──────────────┬─────────────┘
                                         ▼
                      ┌───────────────────────────────────┐
                      │ seven column-0 outcome lines,      │
                      │ one per named evidence .md file    │
                      └───────────────┬────────────────────┘
                                      ▼
                      ┌───────────────────────────────────┐
                      │ DECISION-RULE.md rules R1..Rn      │
                      │ (first-match-wins, committed        │
                      │  before any of the above ran)       │
                      └───────────────┬────────────────────┘
                                      ▼
                      ┌───────────────────────────────────┐
                      │ docs/phase39-...-findings.md       │
                      │ verdict: go|degrade|no-go           │
                      └───────────────┬────────────────────┘
                                      ▼
                ROADMAP Depends-on + Notes for Phases 41/43 + STATE.md pointer
```

### Recommended Project Structure

```
.planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/
└── evidence/
    ├── DECISION-RULE.md          # 39-01: rules, first-match-wins, totality
    ├── SCHEMA.md                 # 39-01: line names, domains, derivations
    ├── README.md                 # 39-01: artifact table + evidence conventions
    ├── totality-walk.mjs         # 39-01: committed executable walk (D-04)
    ├── textmon-probe-client.mjs  # throwaway text-channel helper (D-13)
    ├── idle-coexist-probe.mjs    # experiment 1 (IDLE_COEXIST)
    ├── 39-idle-coexist.md
    ├── foreign-halt-probe.mjs    # experiment 2 (FOREIGN_HALT_VISIBILITY)
    ├── 39-foreign-halt.md
    ├── concurrent-inflight-probe.mjs   # experiment 3 (CONCURRENT_INFLIGHT)
    ├── 39-concurrent-inflight.md
    ├── cross-channel-resume-probe.mjs  # experiment 4 (CROSS_CHANNEL_RESUME)
    ├── 39-cross-channel-resume.md
    ├── disconnect-recovery-probe.mjs   # experiment 5 (DISCONNECT_RECOVERY)
    ├── 39-disconnect-recovery.md
    ├── hitcount-invariant-probe.mjs    # blocking item 1 (HITCOUNT_INVARIANT_HOLDS)
    ├── 39-hitcount-invariant.md
    ├── text-single-client-probe.mjs    # blocking item 2 (TEXT_SINGLE_CLIENT)
    └── 39-text-single-client.md

src/mcp/vice/fixtures/textmon/     # new sibling to fixtures/binmon/
├── README.md                     # mirrors fixtures/binmon/README.md's shape
├── memmapshow.txt / .json
├── prof-flat.txt / .json
├── chis.txt / .json
├── bt.txt / .json
├── io.txt / .json
└── prompt.txt / .json            # the bare `(C:$xxxx) ` capture itself

src/mcp/vice/textmon-fixtures.ts       # new sibling loader (D-18)
src/mcp/vice/textmon-fixtures.test.ts  # new, one test (D-19)

docs/phase39-dual-channel-coexistence-gate-findings.md   # D-05 verdict doc
```

### Pattern 1: Direct-spawn probe with an in-code preflight refusal

**What:** Every probe script starts with a `preflight()` function that checks
`systemctl --user is-active vice-broker` (expect `inactive`) and `pgrep -x
x64sc` (expect none), and **throws** rather than warns if either check fails.

**When to use:** Every one of this phase's live-measurement scripts (D-16).

**Example (verified against the actual file):**
```javascript
// Source: .planning/phases/33-.../evidence/determinism-probe.mjs:123-152
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
Phase 39's plans must reuse this shape verbatim (or import a shared helper if
one is extracted) — D-16 makes it a phase-wide rule, not merely a Phase 33
habit, and the memory ledger independently confirms a live broker reddens
`BACK-05` deterministically.

### Pattern 2: The stock-branch argv, exactly as shipped (verified this session)

**What:** The load-bearing flag order for a probe that wants **both** ports.

**Verified source (`src/mcp/vice/broker-launch.mts:357-379`):**
```typescript
const args = ["-default"];
if (profile?.headless) {
  args.push("-console");
}
args.push("-drive8type", "1541");
args.push(...STOCK_DETERMINISM_FLAGS);   // -seed 4242 -raminitstartrandom 0
                                          // -raminitrepeatrandom 0 -raminitrandomchance 0
                                          // +autostart-delay-random
if (profile?.warp) {
  args.push("-warp");
}
args.push("-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`);
if (typeof remoteMonitorPort === "number") {
  args.push("-remotemonitor", "-remotemonitoraddress", `ip4://${host}:${remoteMonitorPort}`);
}
```
`-default` **must** be argv[0] (VICE's reset-to-compiled-in-defaults
instruction; anything before it is silently clobbered, and it must precede
`-binarymonitor` or the monitor never binds — CLAUDE.md's documented
constraint, re-verified live 2026-09-03 per the comment at
`broker-launch.mts:274-291`). **The same ordering constraint for
`-remotemonitor` is UNVERIFIED, not measured** — nothing has ever dialed that
port before this project's one exploratory session, and that session's own
launch command (`.planning/notes/text-monitor-channel-live-probe.md:31-33`)
put `-remotemonitor` *after* `-binarymonitor`, which is consistent with but
does not prove the ordering is load-bearing the same way `-default` is. Keep
`-remotemonitor` last, as shown, and record the assumption rather than assert
it as fact — this is exactly the CONTEXT.md-flagged risk.

The probe should **import** `STOCK_DETERMINISM_FLAGS` from
`broker-launch.mts` (D-12's own citation, matching `determinism-probe.mjs`'s
own `T-33-36` precedent at line 84 of that file: `const { STOCK_DETERMINISM_FLAGS,
STOCK_DETERMINISM_SEED } = launch;`), not retype it.

### Pattern 3: The three-file evidence layout + ordering proof (D-07)

**What:** `DECISION-RULE.md` (rules, totality), `SCHEMA.md` (line names,
domains, derivations), `README.md` (artifact table + evidence conventions +
banked ordering proof), landed in **one commit** that touches nothing else.

**Example — the ordering-proof commands to bank in `39-01`'s `README.md`
(copied structurally from `33-.../evidence/README.md:95-159`, paths
retargeted):**
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

### Pattern 4: The totality walk as committed, executable code (D-04)

**What:** With 7 inputs of domain sizes `[3,4,4,3,3,3,3]` (`IDLE_COEXIST`,
`FOREIGN_HALT_VISIBILITY`, `CONCURRENT_INFLIGHT`, `CROSS_CHANNEL_RESUME`,
`DISCONNECT_RECOVERY`, `HITCOUNT_INVARIANT_HOLDS`, `TEXT_SINGLE_CLIENT` — the
indicative domains stated verbatim in `39-CONTEXT.md`'s `D-02` table), the
cross-product is:

```
3 × 4 × 4 × 3 × 3 × 3 × 3 = 3,888 tuples
```
(arithmetic verified this session by direct multiplication of the domain
sizes stated in `39-CONTEXT.md` — `SCHEMA.md` does not exist yet, so this is
computed from the context document, not read from a committed schema; the
schema `39-01` writes must reproduce these same sizes or the number changes.)

This is roughly 36× Phase 33's 108-tuple product, and `D-04` is explicit that
108 was "already at the limit of what a reader can check [in prose]" — so a
hand-walked prose table is not viable here; the walk **must** be an executable
script, following Phase 33's own arithmetic-as-code idiom
(`DECISION-RULE.md`'s § *Totality*, reproduced structurally below) but
computed rather than hand-tabulated:

```javascript
// Skeleton only -- the real rule predicates come from DECISION-RULE.md and
// must be authored in 39-01, in the same commit, so the walk cannot exist
// before the rules do.
const DOMAINS = {
  IDLE_COEXIST: ["clean", "corrupts", "not-taken"],
  FOREIGN_HALT_VISIBILITY: ["visible", "invisible", "corrupts", "not-taken"],
  CONCURRENT_INFLIGHT: ["clean", "degraded", "corrupts", "not-taken"],
  CROSS_CHANNEL_RESUME: ["clean", "corrupts", "not-taken"],
  DISCONNECT_RECOVERY: ["recovers", "leaves-halted", "not-taken"],
  HITCOUNT_INVARIANT_HOLDS: ["holds", "breaks", "not-taken"],
  TEXT_SINGLE_CLIENT: ["single", "multi", "not-taken"],
};

function* crossProduct(domains) {
  const keys = Object.keys(domains);
  function* rec(i, acc) {
    if (i === keys.length) { yield { ...acc }; return; }
    for (const v of domains[keys[i]]) yield* rec(i + 1, { ...acc, [keys[i]]: v });
  }
  yield* rec(0, {});
}

// RULES: an ordered array of { id, test(tuple) => boolean, verdict }.
// Mirrors DECISION-RULE.md's prose 1:1 -- authored in 39-01, never invented here.
const RULES = [/* R1, R2, ... in the exact order DECISION-RULE.md states */];

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
The script asserts **every** tuple matches **exactly one** rule (via
`Array.prototype.find`, which returns the first match under
first-match-wins — matching `DECISION-RULE.md`'s own "Rules, first match wins"
convention) and emits the tuple count plus a per-rule histogram as column-0
outcome lines, satisfying `D-04`'s literal text.

### Pattern 5: Crude text-monitor prompt framing (D-13, throwaway only)

**What:** A raw `net.Socket`, buffering incoming chunks and treating the
substring `(C:$xxxx) ` (any four hex digits) appearing anywhere in the
accumulated buffer as "response complete." **Deliberately does not** handle
the prompt splitting across TCP segments correctly beyond simple buffering,
and does not distinguish a prompt substring appearing inside command *output*
from the real terminator — `CHAN-03` owns solving that properly in Phase 41.

```javascript
// Illustrative only -- no such client exists in this repo yet; this is what
// D-13 authorizes building as throwaway evidence-directory code.
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
      if (PROMPT_RE.test(buf)) {
        clearTimeout(timer);
        sock.off("data", onData);
        resolve(buf);
      }
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
**The exact prompt regex above is UNVERIFIED against this repository** — no
committed transcript shows the literal greeting or prompt bytes; the
`(C:$xxxx) ` shape is asserted MEASURED in `39-CONTEXT.md` from a prior manual
session whose raw bytes were not saved to any file this research could read.
**The first probe run must capture the raw connect banner and first prompt
verbatim into a fixture before trusting this pattern further** — this is
exactly what criterion 5's fixture batch is for.

### Anti-Patterns to Avoid

- **Building `monitor-lock.ts` in any shape, including "just a stub."**
  Explicitly forbidden (D-13, ROADMAP "Not in this phase, in any shape"). The
  verdict selects the shape; writing any of the three prematurely wastes the
  phase.
- **Letting the text-channel client survive as a module under `src/`.**
  Declared out of scope (D-13); if a plan's task list includes a file under
  `src/mcp/vice/textmon-client.ts` (as opposed to a fixture loader or the
  evidence-dir throwaway helper), that is scope creep.
- **Editing `DECISION-RULE.md`/`SCHEMA.md` after the first measurement
  commit.** One-way per D-01/D-03; an ambiguity found later is an `##
  ACCEPTED LIMIT` in the measuring plan's own evidence file, never a rules
  edit.
- **Treating `not-taken` as a fallback default rather than an explicit written
  value.** D-03: every input **must** have a value; an absent line is an
  incomplete phase, never a default.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Binary-monitor wire frames | A second hand-rolled encoder for `MemoryGet`/`CheckpointSet`/etc. | `src/mcp/vice/stock-protocol.ts`'s exported functions (`memGetBody`, `checkpointSetBody`, `advanceInstructionsBody`, `resetBody`, `cpNumBody`, `memspaceBody`) | D-14; a future encoder edit must change what the probe sends, not leave it measuring a stale copy |
| The stock launch argv | A retyped literal argv array | Import `STOCK_DETERMINISM_FLAGS` from `broker-launch.mts` and reproduce the surrounding order from its own doc comments | Matches Phase 33's `T-33-36` precedent; a drift between the probe's copy and the shipped block would silently invalidate every measurement |
| Fixture provenance validation | A second bespoke "check these 5 keys" inline in a new test | Reimplement `binmon-fixtures.ts`'s `REQUIRED_PROVENANCE_KEYS` **contract** (same 5 keys, same refuse-on-missing behaviour) in a sibling `textmon-fixtures.ts` | D-18: the *contract* is shared, the frame layout is not; widening the binary loader would falsify its own file-header claim of being the ONE binary-frame loader |
| Totality verification | A hand-typed prose table (Phase 33's own 108-row style) | An executable script asserting exactly-one-match per tuple over the full 3,888-tuple cross-product | D-04; 3,888 is far past what Phase 33 itself called "the limit of what a reader can check" at 108 |

**Key insight:** Every reusable piece in this domain already exists in this
repository and has its own committed precedent to copy structurally
(Phase 33's evidence layout, `stock-protocol.ts`'s encoders,
`binmon-fixtures.ts`'s contract). The only place this phase is genuinely
first is the text-channel wire itself, which is why D-13 deliberately keeps
that one piece crude and throwaway rather than trying to build it well the
first time.

## Common Pitfalls

### Pitfall 1: Treating "bind-time coexistence" as "operational coexistence"
**What goes wrong:** Assuming that because both servers can be bound
simultaneously (already MEASURED, both builds), commands issued on one
channel are automatically safe while the other is connected.
**Why it happens:** The two servers are separate `BinaryMonitorServer` /
`MonitorServer` resources both polled from `monitor_vsync_hook()` — coexisting
at the socket level says nothing about serialization at the command level.
**How to avoid:** This is precisely why `IDLE_COEXIST` is D-09's sole `no-go`
trigger — treat it as a real open question, not a formality to wave through.
**Warning signs:** A plan that skips `IDLE_COEXIST` or assumes it passes
without measurement.

### Pitfall 2: Assuming `-remotemonitor`'s flag order is unconstrained
**What goes wrong:** Placing `-remotemonitor`/`-remotemonitoraddress` anywhere
in argv without regard to `-default`, on the assumption that only
`-binarymonitor` needed the ordering constraint.
**Why it happens:** The `-default` → `-binarymonitor` ordering constraint is
MEASURED and documented (CLAUDE.md, `broker-launch.mts:253-261`); no
equivalent measurement exists for `-remotemonitor` because nothing has ever
dialed that port from this project before.
**How to avoid:** Keep `-default` first and `-remotemonitor` after
`-binarymonitor` (matching the one exploratory session's own working
command), and **record this as an assumption in the probe's own header
comment**, not as fact.
**Warning signs:** A probe script with no comment distinguishing measured
from assumed ordering.

### Pitfall 3: Measuring against a live broker or a stray x64sc
**What goes wrong:** A live `vice-broker` systemd unit reddens `BACK-05`
deterministically (independently confirmed project memory,
`live-broker-reddens-back-05-test.md`), and a stray `x64sc` process from a
previous voided run can answer a "new" connection unexpectedly.
**Why it happens:** No shell habit enforces this; Phase 33's own postmortem
(`33-03 ran it as a habit, orphaned five emulators, and had to void sixteen
subsequent runs whose numbers then MOVED` — `determinism-probe.mjs`'s own
header) is the exact incident this guards against.
**How to avoid:** `preflight()` in code, not a manual step (D-16, Pattern 1
above).
**Warning signs:** A probe script with no `preflight()` call before the first
spawn.

### Pitfall 4: A single-shot `connect()` measuring spawn, not readiness
**What goes wrong:** `execve` returning does not mean either monitor's
listener has bound yet; a bare `connect()` immediately after spawn measures
the OS scheduler, not the monitor.
**Why it happens:** `x64sc`'s two monitor listeners bind some time after
process start, non-deterministically.
**How to avoid:** `connectWithRetry` with a budget (see
`determinism-probe.mjs:215-233`), for **both** ports independently — the text
port has no separate MEASURED bind-time budget on file, so retry rather than
assume its readiness matches the binary port's.
**Warning signs:** A probe that connects once and treats a `ECONNREFUSED` as
fatal rather than retryable.

### Pitfall 5: The second `connect()` to a single-client server looks exactly
like a wedge
**What goes wrong:** `TEXT_SINGLE_CLIENT`'s experiment is *designed* to
produce this symptom on the binary side (already documented in CLAUDE.md); if
the text side behaves the same way, a probe with a short, un-budgeted timeout
will misreport `not-taken` (timed out) rather than the real `single` result.
**Why it happens:** A second `connect()` sitting unserviced in the backlog
gives no reply and no EOF — indistinguishable from a genuine hang without a
long enough budget and an explicit distinguishing test.
**How to avoid:** Give this specific experiment a generous, explicitly-stated
timeout and record which outcome (accepted-and-served / accepted-then-silent /
refused outright) was actually observed, not just "did/didn't respond."
**Warning signs:** `TEXT_SINGLE_CLIENT: not-taken` recorded with no reason
distinguishing "genuinely could not attempt this" from "timed out and gave
up."

### Pitfall 6: `chis`/`CPUHISTORY_GET` version-sensitivity confusion
**What goes wrong:** Assuming the text-monitor `chis` command shares the
binary `CPUHISTORY_GET` (0x86)'s `VICE ≥ 3.10` requirement.
**Why it happens:** CLAUDE.md's own constraint documents the binary opcode
gate; the live-probe note (`.planning/notes/text-monitor-channel-live-probe.md`
lines 75-78) already corrects this for the *capability*: `chis` returned
per-entry cycle counts on genuine stock **3.9** over the text channel. The
opcode gate is binary-only.
**How to avoid:** Do not import the `>= 3.10` framing into any text-channel
finding; if a text command *is* unsupported on a given build (D-20), capture
that refusal as its own fixture with the polarity noted (opt-**out** at build
time, not a version floor).
**Warning signs:** A finding that says "chis needs 3.10" without qualifying
"the *binary* `CPUHISTORY_GET` opcode does."

## Code Examples

### Resolving the correct binary by absolute path (verified pattern)
```javascript
// Source: .planning/phases/33-.../evidence/determinism-probe.mjs:88-90
/** Genuine unpatched stock VICE 3.9. The fork shadows a bare `x64sc` at
 *  /usr/local/bin, so the absolute path is load-bearing. */
const VICE_BIN = "/usr/bin/x64sc";
```
For this phase, both binaries matter (D-15: 3.9 is the gate baseline, the
second binary is provenance-only) — record `capturedFrom` naming which
absolute path answered, per criterion 5.

### The five-key provenance sidecar shape a text fixture must carry (verified)
```json
// Source: src/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json (verbatim, D-20's model for an unsupported-command fixture)
{
  "capturedFrom": "stock:/usr/bin/x64sc",
  "viceVersion": "3.9.0.0",
  "capturedAt": "2026-08-18T10:56:06.002Z",
  "command": "CPUHISTORY_GET (0x86) count=1 against a build without FEATURE_CPUMEMHISTORY",
  "synthetic": false,
  "note": "Real capture from a genuine VICE 3.9 build (/usr/bin/x64sc), which has no 0x86 case at all: the reply is an INVALID_TYPE (0x83) error frame. REQUIRES A 3.9-CLASS BUILD to re-record..."
}
```
The five **required** keys are `capturedFrom`, `viceVersion`, `capturedAt`,
`command`, `synthetic` — verbatim from
`src/mcp/vice/binmon-fixtures.ts:228`:
```typescript
const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"] as const;
```
`note` is additive, not required, and is exactly how D-20's "which capability
is missing and on which binary" is expressed.

### The refusal-on-missing-key test shape D-19 copies (verified)
```typescript
// Source: src/mcp/vice/binmon-fixtures.test.ts:326-336
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
`textmon-fixtures.test.ts`'s one new automated test (D-19) should assert: (a)
the loader refuses a sidecar missing any of the five keys, (b) every
committed sidecar carries `synthetic: false` with `capturedFrom` naming the
binary's kind and absolute path — the same two properties, reimplemented for
text captures.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| `-remotemonitor` port opened on every stock launch since Phase 3, never dialed | This phase dials it for the first time | This phase (39) | First byte-exact text-channel capture in the project's history |
| Text monitor believed reachable "only from the interactive console" (07-RESEARCH.md Pitfall 5) | Corrected: reachable over TCP via `-remotemonitor`; the narrow binary-port claim survives, the generalization does not | Folded todo, resolved in this phase | Unblocks `chis`, `memmapshow`, `prof`, `bt`, `io`, `warp on/off`, `device c:` on stock without requiring VICE ≥ 3.10 |

**Deprecated/outdated:** None — no library or API in this domain has changed
version; the "state of the art" here is entirely this project's own prior
(incorrect) documentation, corrected by the folded todo.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `-remotemonitor`/`-remotemonitoraddress` must follow the same `-default`-first, `-binarymonitor`-precedes ordering discipline as the binary monitor | Pattern 2 / Pitfall 2 | The text monitor never binds, and every experiment reports `not-taken`, triggering D-09's `no-go` cascade for a reason unrelated to real incompatibility |
| A2 | The `(C:$xxxx) ` prompt regex (`/\(C:\$[0-9a-fA-F]{4}\)\s*$/`) correctly identifies response-complete in the crude throwaway client | Pattern 5 | Every text-channel experiment either hangs (false timeout) or reads a truncated response as complete, corrupting every downstream outcome line |
| A3 | The greeting banner on connect does not itself require framing before the first command can be sent | Pattern 5 | The first send could race an unconsumed banner and desync the crude buffer from the start |
| A4 | `-remotemonitor`'s bind-time budget (time-to-listen after `execve`) is the same order of magnitude as `-binarymonitor`'s (Phase 33 measured `WARP_TIME_TO_BIND_MS_MAX`/`CONSOLE_TIME_TO_BIND_MS_MAX` for the binary port only) | Pitfall 4 | An under-budgeted `connectWithRetry` on the text port reports a false `not-taken` |
| A5 | `TEXT_SINGLE_CLIENT`'s "accepted then silent" backlog behaviour (if it occurs) is distinguishable in a bounded time from a genuine crash/wedge, without a broker's existing wedge-triage tooling in the loop | Pitfall 5 | `TEXT_SINGLE_CLIENT` records `not-taken` when the real answer was `multi` (served) or vice versa |

**None of these are optional decisions Claude is making on the project's
behalf** — each is a fact this phase's own experiments settle by measurement.
They are logged here because the *research* pass could not verify them
against any committed file, not because they are open design choices.

## Open Questions

1. **Does `prof flat 5` require an explicit `prof on` earlier in the same
   session, or does profiling run unconditionally?**
   - What we know: the live-probe note lists `prof on` / `prof off` / `prof
     flat 5` as three distinct commands with `prof flat 5` reporting ranked
     self/total cycles.
   - What's unclear: whether `CONCURRENT_INFLIGHT`'s experiment needs a `prof
     on` step before the machine resumes and runs, or whether `prof flat`
     alone triggers collection.
   - Recommendation: the executing plan should issue `prof on`, resume,
     let it run briefly, halt, then `prof flat 5` — record the actual
     sequence used in the evidence file's transcript regardless.

2. **What produces genuinely overlapping in-flight instants between the two
   channels, given VICE polls both servers from one `monitor_vsync_hook()`?**
   - What we know: `ADVANCE_INSTRUCTIONS` (binary, 0x71) and a halting text
     command are both requests the single-threaded emulator processes from
     its one poll loop; true nanosecond-level concurrency at the C level may
     not be achievable from two Node sockets on localhost.
   - What's unclear: whether "concurrent in-flight" for the purposes of this
     gate means literal simultaneous arrival, or simply "issue command B on
     channel 2 before channel 1's in-flight command A has been acknowledged."
   - Recommendation: use `Promise.all([sendOnBinary(), sendOnText()])` (fire
     both before awaiting either) as the practical technique, and record the
     actual wall-clock gap between the two `write()` calls in the transcript
     so a reader can judge how tight the overlap really was — this is a
     measurement caveat to record, not a blocker.

3. **Whether the abrupt-disconnect experiment's `SIGKILL` should target a
   separate child process or a same-process socket.**
   - What we know: the binary side's "connection close IS the release" fires
     on **any** socket close, including one from the OS reclaiming an fd
     after `SIGKILL` (`broker-control.mts:520-527`); Phase 33's own supervisor
     pattern kills a child process and waits bounded for exit
     (`stock-live-triage.test.ts:257-287`).
   - What's unclear: whether a same-process `socket.destroy()` (a clean
     application-level close) is meaningfully different from a genuine
     `SIGKILL` of a separate client process, for VICE's own purposes.
   - Recommendation: spawn the text client as its own child process (a small
     Node script) so `SIGKILL` prevents any client-side cleanup code from
     running at all — this is the literal, defensible reading of "SIGKILL the
     text client" and keeps the emulator (a third, independent process)
     untouched.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| `/usr/bin/x64sc` | Gate baseline (D-15) | ✓ (confirmed by project memory + `.planning/notes/text-monitor-channel-live-probe.md`) | 3.9 | — |
| `/usr/local/bin/x64sc` | Criterion 5's second-binary fixture batch | ✓ (confirmed, shadows stock on bare `$PATH`) | 3.10 | — |
| Node ≥ 24 | Every probe script (native TS stripping) | ✓ (project-wide requirement, `src/mcp/vice/package.json:29`) | — | — |
| `vice-broker` systemd unit | Must be **inactive** during every measurement (D-16) | Verify with `systemctl --user is-active vice-broker` before each run | — | Stop it if active; do not proceed otherwise |

**Missing dependencies with no fallback:** None identified — both binaries are
confirmed present on this host.

**Missing dependencies with fallback:** None applicable.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), project-wide standard |
| Config file | none — matches every other `*.test.ts` in `src/mcp/vice/` |
| Quick run command | `node --test src/mcp/vice/textmon-fixtures.test.ts` |
| Full suite command | `npm run test:automated` (per `src/mcp/vice/test-gate.mjs`) — **never** `npm test` (whole-glob run does not terminate; project memory `full-glob-suite-outlives-bash-timeout.md`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| CHAN-01 | Gate rules exist before measurements (ordering) | manual/git-log check, no test guard (D-06) | `git rev-list --count <rules-sha> -- evidence/` (must print 1) | N/A by design |
| CHAN-01 | Seven gate inputs recorded as column-0 outcome lines | manual transcript verification | grep-based, per `SCHEMA.md`'s own conventions | ❌ Wave 0 — files don't exist until `39-01`+ |
| CHAN-01 (fixture batch, criterion 5) | Text-fixture loader refuses a sidecar missing a required key | unit (corpus-free) | `node --test src/mcp/vice/textmon-fixtures.test.ts` | ❌ Wave 0 — new file |

**No live-capture suite is added to `MANUAL_ONLY_TESTS`** by default (D-19's
explicit expectation: "zero new `MANUAL_ONLY_TESTS` entries"). If a plan
nevertheless writes one, it must add the file to
`src/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` array **and** update the
exact-12-entries assertion in `src/mcp/vice/test-gate.test.ts` **in the same
commit** — both were verified this session (`test-gate.mjs` currently lists
exactly twelve names; `test-gate.test.ts` asserts that literal list plus a
union/no-overlap check against every on-disk `*.test.*` file). Missing either
half reds the suite.

### Sampling Rate

- **Per task commit:** `node --test src/mcp/vice/textmon-fixtures.test.ts` (once that file exists)
- **Per wave merge:** `npm run test:automated`
- **Phase gate:** No new automated gate beyond the existing baseline —
  **do not write "clean floor: 0" anywhere.** The measured floor this session
  (per project memory, matching D-16's own text) is **2 failing tests in
  `anno-register.test.ts`**, unrelated to this phase, taken with the broker
  stopped. Every evidence transcript must record `BROKER_STATE: inactive` and
  the observed `test:automated` count/file names beside it (Phase 33's
  README.md § *Evidence conventions* 3-4 pattern, reused verbatim by D-07).

### Wave 0 Gaps

- [ ] `src/mcp/vice/fixtures/textmon/` — does not exist; created by this
      phase's own fixture-capture plan
- [ ] `src/mcp/vice/textmon-fixtures.ts` — sibling loader, does not exist
      (D-18)
- [ ] `src/mcp/vice/textmon-fixtures.test.ts` — the one new automated test
      (D-19), does not exist
- [ ] `.planning/phases/39-.../evidence/{DECISION-RULE,SCHEMA,README}.md` —
      do not exist; `39-01`'s entire deliverable

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | No | Neither monitor protocol has any auth concept; both are unauthenticated by design (CLAUDE.md, re-confirmed for text in `broker-launch.mts`'s own stderr-note text at line ~371) |
| V3 Session Management | No | No session concept; a TCP connection IS the session for both channels |
| V4 Access Control | Partial | Both binds stay `127.0.0.1`-only for this phase's probes (no widened-bind path exercised); no production access-control code is written |
| V5 Input Validation | Yes, narrowly | The fixture loader's five-required-key check (D-19) is the one piece of input validation this phase ships |
| V6 Cryptography | No | No cryptographic material anywhere in this domain |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Probe argv built from an externally-derived string | Elevation of Privilege | Fixed literal flag list, only the port numbers interpolated — same discipline as `T-33-04` in Phase 33's own threat model (`.../33-06-PLAN.md:323`); no `extraArgs`, no passthrough parameter, ever |
| Unauthenticated monitor ports reachable beyond loopback | Elevation of Privilege / Information Disclosure | Both probe-launched ports bind `127.0.0.1` explicitly; the shipped `buildViceArgs()` already emits a one-time stderr warning on any wider bind (`broker-launch.mts:368-376`) — the probe should not exercise or need a widened bind at all |
| A killed text-client process leaving the machine permanently halted | Denial of Service | D-10's own pre-mapped narrowing: this is a **missing mechanism**, not proof of incompatibility, and becomes named Phase 41 scope in the verdict rather than being silently absorbed |
| A crude prompt-matching client mistaking a prompt-shaped substring inside command output for the real terminator | Tampering (mis-parsed protocol boundary) | Explicitly accepted as a throwaway-phase risk by D-13; the real fix (`CHAN-03`) is Phase 41 scope, not this phase's |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/mcp/vice/broker-launch.mts` (lines 1-140, 211-383, remotemonitor block, `STOCK_DETERMINISM_FLAGS`) — exact stock-branch argv order
- `src/mcp/vice/stock-protocol.ts` (lines 1-1260) — `CommandType`, `CheckpointOperation`, `ResetMode`, all body encoders
- `src/mcp/vice/binmon-fixtures.ts` (whole file, 298 lines) — `REQUIRED_PROVENANCE_KEYS` at line 228, `loadCapturedFixture()`
- `src/mcp/vice/binmon-fixtures.test.ts` (lines 280-354) — the assertion shape D-19 copies
- `src/mcp/vice/fixtures/binmon/cpuhistory-get-unsupported.json` — D-20's model sidecar
- `src/mcp/vice/fixtures/binmon/README.md` — the per-fixture provenance table shape
- `src/mcp/vice/test-gate.mjs` (whole file) — `MANUAL_ONLY_TESTS`, exactly twelve entries verified
- `src/mcp/vice/test-gate.test.ts` (whole file) — the two-directional union guard verified
- `src/mcp/vice/docs-deferred-ledger.test.ts` (lines 1-80) — the two-directional ledger guard the folded todo trips
- `src/mcp/vice/docs-linerefs.test.ts` (`SCANNED_DOCS = ["CLAUDE.md", ".planning/PROJECT.md"]`, lines 64-67) — confirms this phase's CLAUDE.md edits (folded todo) do not touch the `rewriteArguments()` bullet this guard checks
- `src/mcp/vice/resources-sync.test.ts` (lines 1-40) — confirms this phase touches no `.mts` host-launcher source, so this guard is unaffected
- `src/mcp/vice/broker-control.mts` (lines 505-527) — "Connection close IS the release," verbatim
- `.planning/phases/33-.../evidence/determinism-probe.mjs` (whole file, 624 lines) — the structural probe template
- `.planning/phases/33-.../evidence/DECISION-RULE.md`, `SCHEMA.md`, `README.md` (whole files) — the three-file gate layout, totality-walk shape, ordering-proof commands
- `.planning/notes/text-monitor-channel-live-probe.md` (whole file) — the only record of the live text-channel session's observed command behaviour
- `.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md` — the folded todo's exact required edits
- `.planning/phases/39-.../39-CONTEXT.md` — all 20 locked decisions, verbatim
- `.planning/REQUIREMENTS.md` — `CHAN-01` verbatim (line 30)
- `.planning/ROADMAP.md` line 850 — Phase 39 entry confirmed at the stated location
- `grep` confirmation: zero `remoteMonitorPort` occurrences in `vice-broker-client.ts` or `vice-proxy.ts` — confirms CHAN-02's "zero grep hits" claim independently

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` (grepped sections around lines 8, 213-227, 1975-2497) — current position, operator next steps, confirms Phase 39 not yet planned

### Tertiary (LOW confidence / UNVERIFIED, flagged explicitly)
- The exact greeting-banner and `(C:$xxxx) ` prompt byte sequence — asserted MEASURED in `39-CONTEXT.md` from a prior manual session, but no byte-exact transcript exists in any committed file this research could read. Treat as the first thing the probe must capture, not as a known fact.
- `-remotemonitor`'s own bind-ordering sensitivity relative to `-default` — no measurement on file; carried as Assumption A1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every shipped module cited was read directly this session
- Architecture (probe structure, evidence layout): HIGH — copied structurally from Phase 33's committed, closed-phase precedent
- Text-channel protocol specifics (prompt bytes, greeting): LOW — UNVERIFIED against any committed file; this phase's own job to close
- Totality-walk arithmetic (3,888 tuples): HIGH — computed directly from `39-CONTEXT.md`'s stated domains this session
- Pitfalls: HIGH for binary-side pitfalls (all measured/documented elsewhere in this repo); MEDIUM for text-side pitfalls (reasoned from the one live-probe note, not independently re-measured)

**Research date:** 2026-09-07
**Valid until:** This phase's own measurements supersede parts of this document immediately upon being taken (the whole point of the gate) — treat this RESEARCH.md as valid for planning purposes only until `39-01` lands; anything under "Assumptions Log" is expected to be resolved, not still open, by the time the phase closes.
