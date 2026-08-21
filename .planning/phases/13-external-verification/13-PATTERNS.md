# Phase 13: External Verification - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 13 (modify) + 2 (create, new fixture set)
**Analogs found:** 13 / 15 exact-self-analog (this is a verification phase — most
"analogs" are the file's own neighbouring precedent, not a different file);
2 net-new fixture files use `fixtures/binmon/`'s convention as analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `fixtures/binmon/display-get.{bin,json}` | fixture | file-I/O | `fixtures/binmon/cpuhistory-get.json` (real-capture sidecar, same dir) | exact |
| `fixtures/binmon/event-interleaved.{bin,json}` | fixture | file-I/O / event-driven | `fixtures/binmon/cpuhistory-get-multi.json` | exact |
| `fixtures/binmon/checkpoint-list.{bin,json}` | fixture | file-I/O | `fixtures/binmon/cpuhistory-get.json` | exact |
| `fixtures/binmon/README.md` | config/docs | — | itself (existing provenance table) | exact (self) |
| `probe-binmon.mjs` | utility (probe script) | request-response, live socket | its own `captureCheckpointListCase` / `CAPTURE_CASES` machinery | exact (self, extend) |
| `binmon-fixtures.test.ts` | test | file-I/O | its own WR-09/WR-10 tests | exact (self) |
| `stock-protocol.test.ts` | test | request-response | its own `correlat:` tests | exact (self) |
| `backend-detect.test.ts` | test | request-response (string classify) | its own ASSUMED-fixture block | exact (self); new real-hardware block mirrors it |
| `fixtures/backend-detect/{stock,fork}-help-transcript.txt` + sidecar | fixture | file-I/O | `fixtures/binmon/*.json` sidecar shape | role-match (new subsystem dir, same convention) |
| `broker-launch.mts:140` (A1 label) | config/utility | request-response (argv construction) | itself, comment-only edit | exact (self) |
| `stock-execution.ts:227` (A2 label) | controller/handler | request-response | itself | exact (self) |
| `stock-protocol.ts:742` (A2), `:791`+`:785-795` (A3), `:847` (A5) | service (encoder) | request-response (byte encoding) | itself, plus the module's own `:400-415` convention comment | exact (self) |
| `stock-input.ts:161,166` (A3 label + `JOYPORT_BITS`) | service/constant | request-response | itself | exact (self) |
| `docs/phase2-backend-probe-evidence.md` §1/§2 | docs | — | itself | exact (self) |
| `.planning/phases/03-direct-tools/03-RESEARCH.md` (A1/A2/A3/A5 rows) | docs | — | itself | exact (self) |
| `.planning/phases/03-direct-tools/03-VALIDATION.md` (Manual-Only table) | docs | — | itself | exact (self) |
| `docs/stock-vice-parity.md` §A item 7 | docs | — | itself | exact (self) |

## Pattern Assignments

### `fixtures/binmon/{display-get,event-interleaved,checkpoint-list}.json` (fixture, file-I/O)

**Analog:** `fixtures/binmon/cpuhistory-get.json` (real capture, plan 07-12 precedent)

**Exact sidecar key set to match** (verbatim, real capture — no `specSections`/`note` required, `note` optional/historical only):
```json
{
  "capturedFrom": "stock:/usr/local/bin/x64sc",
  "viceVersion": "3.10.0.0",
  "capturedAt": "2026-08-18T10:54:55.500Z",
  "command": "CPUHISTORY_GET (0x86) count=1",
  "synthetic": false,
  "note": "Real capture from a genuine VICE 3.10 build. Hand-decoded byte by byte ..."
}
```
`REQUIRED_PROVENANCE_KEYS` (`binmon-fixtures.ts:231` area) is
`["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"]` — all
five must be present; `synthetic` must literally be `false` (boolean, not
string) this time. **IMPORTANT provenance correction to apply, not copy
verbatim:** `cpuhistory-get.json`'s own `capturedFrom` value
(`"stock:/usr/local/bin/x64sc"`) is itself a known mislabel — that binary is
the fork, per CLAUDE.md and this session's live `--help` grep. D-13-01
requires the NEW three sidecars to say `"fork:/usr/local/bin/x64sc"` (or
whatever the actually-resolved first-in-PATH binary's kind + path is),
**not** to copy the pre-existing `"stock:..."` string. Do not propagate the
old mislabel into new fixtures.

**Current synthetic sidecar being replaced** (for contrast — these keys/values
must be fully removed, not merged):
```json
{
  "capturedFrom": "synthesized-fallback",
  "viceVersion": "N/A -- synthetic, not observed from any real VICE_INFO reply",
  "capturedAt": "2026-08-13T08:38:06.104Z",
  "command": "DISPLAY_GET (0x84) [synthesized, not a live capture]",
  "synthetic": true,
  "specSections": ["..."],
  "note": "Synthesized because no stock VICE binary is reachable ..."
}
```

**Capture command pattern** (`probe-binmon.mjs`'s own header + `runCapture()`'s env reads, lines ~1476-1480):
```bash
cd .claude/mcp/vice
CAPTURE_BACKEND_KIND=fork VICE_BIN=/usr/local/bin/x64sc \
  VICE_BINMON=127.0.0.1:6502 node probe-binmon.mjs --capture all
```
`capturedFrom` is built as `` `${process.env.CAPTURE_BACKEND_KIND || "unknown"}:${process.env.VICE_BIN || `${host}:${port}`}` `` — set both env vars explicitly and correctly (`CAPTURE_BACKEND_KIND=fork`, matching D-13-01) rather than relying on defaults.

**Runner shape already present, unchanged, no new case needed** (`probe-binmon.mjs:110-117`, `1399-1406`):
```js
const CAPTURE_CASES = [
  "display-get", "event-interleaved", "checkpoint-list",
  "cpuhistory-get", "cpuhistory-get-multi", "cpuhistory-get-unsupported",
];
const CAPTURE_RUNNER_BY_CASE = {
  "display-get": captureDisplayGetCase,
  "event-interleaved": captureEventInterleavedCase,
  "checkpoint-list": captureCheckpointListCase,
  ...
};
```

---

### `fixtures/binmon/README.md` (docs, self-analog)

**Exact wording to correct** (D-13-06's "genuine build" mislabel, currently in
the Source-paths intro and table):
> "Added 2026-08-18 by plan 07-12, off genuine builds (`/usr/local/bin/x64sc`
> VICE 3.10 for the first two, ...)"

Must become something that names `/usr/local/bin/x64sc` as the **patched
fork build**, not merely "genuine" — mirroring CLAUDE.md's own framing
("custom, non-upstream VICE fork"). The three-row "Synthetic (3)" paragraph
and its matching table rows (`display-get`/`event-interleaved`/
`checkpoint-list`, all currently `**synthesized-fallback**`, `N/A -- synthetic`)
must flip to the real-capture row shape already used two rows below for the
`cpuhistory-get*` entries, e.g.:
```
| `display-get.bin` / `.json` | `display-get` | **real capture** -- `fork:/usr/local/bin/x64sc` | 3.10.0.0 | <date> | `binmon-fixtures.test.ts`, `stock-protocol.test.ts` |
```

---

### `probe-binmon.mjs` (utility, extend for EXTV-03 probes, D-13-07)

**Analog:** its own `captureCheckpointListCase()` (lines ~1329-1365) — the
existing pattern for "send request(s), inspect reply/errCode, clean up in
`finally`":
```js
async function captureCheckpointListCase(mon) {
  let cpNumA = null;
  let cpNumB = null;
  try {
    return await withFrameCapture(mon, async () => {
      const rA = await mon.send(CMD.CHECKPOINT_SET, checkpointSetBody({ ... }));
      cpNumA = rA.errCode === 0x00 ? parseCheckpointInfo(rA.body).checkpointNum : null;
      ...
    });
  } finally {
    for (const n of [cpNumA, cpNumB]) {
      if (n === null) continue;
      try { await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(n)); }
      catch { console.log(`    (could not delete capture checkpoint #${n} ...)`); }
    }
  }
}
```
New A1/A2/A3/A5 probes should follow this shape: send request, check
`errCode` against `InvalidLength`/`InvalidParameter`/`InvalidType` (wire-shape
check), then — for A2/A3 specifically, per Pitfall 6 in RESEARCH.md — an
additional behavioural read-back (`MEM_GET`/register read) rather than
stopping at "accepted". These are **script additions**, not test additions
(D-13-07) — no new `*.test.ts` file should depend on a live socket.

**A3's exact bit constant to probe against** (`stock-input.ts:174`):
```ts
export const JOYPORT_BITS = { up: 0x01, down: 0x02, left: 0x04, right: 0x08, fire: 0x10 } as const;
```

---

### `binmon-fixtures.test.ts` (test, self-analog — must edit in place)

**WR-09 test, current hardcoded `cases` array** (lines 303-322) — the three
target entries must flip `synthetic: true` → `false`:
```ts
const cases = [
  { name: "display-get", synthetic: true },        // -> false
  { name: "event-interleaved", synthetic: true },  // -> false
  { name: "checkpoint-list", synthetic: true },     // -> false
  { name: "cpuhistory-get", synthetic: false },
  { name: "cpuhistory-get-multi", synthetic: false },
  { name: "cpuhistory-get-unsupported", synthetic: false },
];
```

**WR-10 test (lines 326-331) — its entire premise inverts, must be rewritten
not tweaked:**
```ts
test("WR-10: the three committed fixtures report synthetic: true, matching the recorded 2026-08-13 D-19 override", () => {
  for (const caseName of ["display-get", "event-interleaved", "checkpoint-list"] as const) {
    const loaded = loadCapturedFixture(caseName);
    assert.equal(loaded.synthetic, true, `${caseName} is spec-synthesized, not hardware-recorded -- it must say so`);
    assert.equal(loaded.provenance.capturedFrom, "synthesized-fallback");
  }
});
```
Rewrite to assert `synthetic === false` and `capturedFrom` matches the
`fork:...` (or resolved-binary) pattern, with a new name (not "WR-10:
synthetic: true...").

**WR-10 header-regex test (lines 333-343) — must be rewritten alongside the
module header, not left to pass by literal accident:**
```ts
test("WR-10: binmon-fixtures.ts's own header does not claim the three fixtures are real captures", () => {
  const source = readFileSync(...);
  const header = source.slice(0, source.indexOf("import "));
  assert.ok(!/are captured for real/.test(header), "...");
  assert.match(header, /NOT currently real captures/, "...");
  assert.match(header, /re-record-binmon-fixtures-against-real-stock-vice/, "...");
});
```
This regex must invert to assert the header states all six fixtures ARE real
captures (new substring, new test name), edited together with
`binmon-fixtures.ts:1-56`'s "PROVENANCE — MIXED, per fixture" header comment.

**Assert style to copy for any new assertion** — every `assert` call carries a
descriptive third-argument message; note the long, sentence-style test names
(`"WR-09: every committed sidecar under fixtures/binmon/ STATES its
provenance, and the three CPUHISTORY_GET captures state it as real"`).

---

### `stock-protocol.test.ts` (test, self-analog)

**`correlat:` checkpoint-list test (lines 852-873) — `initialRequestId: 4` is
the exact value that must be replaced with whatever the real capture's
terminal reply actually carries** (Pitfall 1 — decode bytes 8-11 u32LE of the
`.bin`'s terminal frame after re-capture, do not guess):
```ts
test("correlat: the captured checkpoint-list fixture resolves exactly once, with every interim CHECKPOINT_INFO frame accumulated into related[]", async () => {
  const { bytes } = loadCapturedFixture("checkpoint-list");
  await withStubNetServer(
    (socket) => socket.on("data", () => socket.write(bytes)),
    async (port) => {
      const client = new ViceMonitorClient({ initialRequestId: 4 }); // <- replace
      ...
      const result = await client.send(CommandType.CheckpointList);
      ...
      assert.equal(events.length, 2);
      await client.disconnect();
    },
  );
});
```

**`correlat:` event-interleaved test (lines 876-891) — same pattern, `initialRequestId: 2`:**
```ts
test("correlat: the captured event-interleaved fixture resolves the command it contains and emits at least one event, in that order", async () => {
  const { bytes } = loadCapturedFixture("event-interleaved");
  ...
  const client = new ViceMonitorClient({ initialRequestId: 2 }); // <- verify/replace
  ...
  assert.equal((result as { requestId: number }).requestId, 2); // <- must match replaced id
  assert.ok(order.filter((entry) => entry === "event").length >= 1);
  assert.equal(order[order.length - 1], "resolved");
  ...
});
```
Both tests are order/count-agnostic beyond the id match, so per RESEARCH.md
Pitfall 5 they will likely survive a `[RESUMED, REGISTER_INFO, STOPPED]`
real order unchanged — only `initialRequestId` (and any request-id equality
assertion) needs updating, confirmed by reading the real `.bin` bytes.

---

### `backend-detect.test.ts` (test, self-analog — add a parallel real-hardware block)

**Existing ASSUMED fixture pattern to keep separate, never merge into**
(module header lines 12-20, plus each test lines 68-95):
```ts
// Every fixture string fed to classifyHelpOutput() below is labelled
// ASSUMED: it is an author-constructed guess at what a real build's --help
// output might contain (per D-02's discriminator tokens), NOT a captured
// transcript from any real binary. ...

test("classifyHelpOutput: returns 'fork' when the ASSUMED fixture text contains -mcpserver", () => {
  const assumedForkHelpText = "usage: x64sc [options]\n  -mcpserver          Enable MCP server\n";
  assert.equal(classifyHelpOutput(assumedForkHelpText), "fork");
});
```
New tests should follow the exact same `assert.equal(classifyHelpOutput(...), "fork"|"stock")` shape, but read the committed real transcript file instead of an inline string, and be named/commented to say `REAL HARDWARE` / `capturedFrom: "real hardware"` explicitly, with its own header comment analogous to the ASSUMED block's, e.g.:
```ts
// Every fixture string fed to classifyHelpOutput() in THIS block is a
// verbatim --help transcript captured from a real x64sc binary (EXTV-02,
// 2026-08-22) -- see fixtures/backend-detect/README.md. Kept in a separate
// block from the ASSUMED fixtures above; never merged or presented as the
// same class of evidence (D-13-03).
```

---

### `broker-launch.mts:140`, `stock-execution.ts:227`, `stock-protocol.ts:742/791/847`, `stock-input.ts:161-172` (label sites, D-13-04)

**A1 label** (`broker-launch.mts:140-144`, inside a larger doc comment):
```
* `-remotemonitoraddress`'s exact spelling is
* `[ASSUMED]` by symmetry with `-binarymonitoraddress` (RESEARCH.md
* Assumption A1) and is filed as probe debt under
* `.planning/todos/pending/`.
```

**A2 labels** — two sites, both must come off together:
`stock-execution.ts:224-227`:
```ts
 * `stepOver: true`'s runtime semantic (skip a JSR's subroutine as one step)
 * is [ASSUMED] -- RESEARCH.md Assumptions Log row A2 -- never probed against
 * a real JSR. See `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`
 * for the outstanding probe debt. This is NOT claimed as verified here.
```
`stock-protocol.ts:744-748`:
```ts
 * `stepOver = true`'s runtime meaning (skip a `JSR`'s subroutine as one
 * step, matching the fork's own `stepOver` field name) is [ASSUMED] --
 * RESEARCH.md Assumptions Log row A2 -- never probed against a real `JSR`.
 * See `.planning/todos/pending/` for the outstanding probe debt.
```

**A3 labels** — `stock-input.ts:161-166` (the constant's own doc comment) and `stock-protocol.ts:791-795`:
```ts
// stock-input.ts:161-166
/**
 * JOYPORT_SET's `value` bit layout. **[ASSUMED]** -- RESEARCH.md
 * Assumptions Log row A3: derived from general VICE joystick-driver
 * knowledge, never confirmed against the manual or a probe run against a
 * real binary. Probe debt filed at
 * .planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md.
 * Do not remove the [ASSUMED] label until that todo's acceptance check
 * closes it -- do not write a comment claiming this mapping is verified.
 */
```
```ts
// stock-protocol.ts:791-795
 * The body SHAPE is cited; the BIT MEANING of `value` (which bit is
 * up/down/left/right/fire) is [ASSUMED] -- RESEARCH.md Assumptions Log row
 * A3 -- and is mapped in stock-input.ts, not here.
```

**A5 label** — `stock-protocol.ts:847-848` (single site):
```ts
 * `fileIndex`'s behaviour when `runAfter` is false is [ASSUMED] --
 * RESEARCH.md Assumptions Log row A5.
```

**Module-level convention comment to re-check after any label removal**
(`stock-protocol.ts:407-409`):
```
// docs/phase0-binmon-findings.md §5; every encoder whose runtime BEHAVIOUR
// (not wire shape) is unconfirmed against a real binary says so explicitly
// in its own JSDoc as [ASSUMED], naming the RESEARCH.md Assumptions Log
// row -- never silently claimed as verified.
```
Removing a label must leave this convention statement still true (no
lingering assumption claimed verified, no orphaned `[ASSUMED]` twin).

---

### Docs: exact current wording to change

**`docs/phase2-backend-probe-evidence.md` §1 (line 10)** — heading + framing to
correct once D-13-06 lands (currently states fixtures are "synthetic, not
captured" as a still-open override; must record it as closed/resolved):
```
## 1. D-19 override: the three VERIF-02 fixtures are synthetic, not captured
```

**`docs/phase2-backend-probe-evidence.md` §2 (lines 111, 131)** — the OPEN verdict D-13-03 resolves:
```
## 2. `--help` discriminator evidence (RESEARCH.md A1 / Open Question 2): NOT GATHERED
...
**Verdict: OPEN, not resolved either way.** This document does not claim
`--help` introspection works, and does not claim it fails.
```
Must become a resolved-verdict section citing the committed transcripts and
the live grep results (`0`/`2` stock, `5`/`2` fork).

**`.planning/phases/03-direct-tools/03-RESEARCH.md` Assumptions Log, lines
658-662** — A1/A2/A3/A5 rows, each needs its status updated post-probe (row
text quoted above under Pitfall 6/probe recipe); A4's row (not quoted, out of
scope, line ~661) must be left untouched.

**`.planning/phases/03-direct-tools/03-VALIDATION.md` line 148**, Manual-Only
Verifications table row:
```
| New encoders are byte-for-byte accepted by a real VICE binary | DIRECT-01..09 | No live stock VICE in this environment. ... A2), `JOYPORT_SET`'s bit layout (A3), `-remotemonitoraddress`'s spelling (A1) and `AUTOSTART`'s `fileIndex` with the run flag clear (A5) are `[ASSUMED]` | Follow `.planning/todos/pending/2026-08-14-probe-phase3-assumed-wire-details.md`'s numbered acceptance procedure. **Not a Phase 3 blocker** |
```
Must be updated to state which of A1/A2/A3/A5 are now confirmed (A4 remains
open, named explicitly).

**`docs/stock-vice-parity.md` §A item 7 (heading at line 161)**:
```
7. **Expected divergences licensed by design (Phase 3 — D-01, D-03, D-05, D-14)**
```
Per RESEARCH.md's Component Responsibilities note, this item currently has no
warning that a *wrong* A2/A3/A5 would produce a silently wrong answer (as
opposed to a licensed, known divergence) — add that caveat here if any
assumption is confirmed/corrected, scoped to a sentence, not a rewrite.

## Shared Patterns

### Provenance sidecar contract
**Source:** `binmon-fixtures.ts`'s `REQUIRED_PROVENANCE_KEYS` /
`loadCapturedFixture()` (~lines 222-301) and `probe-binmon.mjs`'s
`buildSidecar()` (~lines 1423-1452, "the ONE place a live sidecar is
constructed", always emits `synthetic: false`).
**Apply to:** all three re-recorded EXTV-01 fixtures and the two new
EXTV-02 transcript sidecars.

### `[ASSUMED]` label discipline
**Source:** `stock-protocol.ts:407-409`'s module-level convention comment
("never silently claimed as verified") plus each label site quoted above.
**Apply to:** every EXTV-03 correction — a label comes off only when every
site carrying it comes off together (D-13-04); a contradicted assumption
gets a regression test capturing the corrected behaviour BEFORE its label
is removed.

### Test naming/assert-message convention
**Source:** `binmon-fixtures.test.ts` test names ("WR-09: every committed
sidecar under fixtures/binmon/ STATES its provenance...") and every
`assert.equal(..., ..., "<why this matters>")` third-argument message.
**Apply to:** every new/edited test in `binmon-fixtures.test.ts`,
`stock-protocol.test.ts`, `backend-detect.test.ts`.

### D-13-07 script-vs-test split
**Source:** the plan 07-12 precedent — `probe-binmon.mjs`'s
`CAPTURE_RUNNER_BY_CASE` holds all live-emulator logic; only
`loadCapturedFixture()`-driven, offline, byte-replaying tests are committed
to the automated gate.
**Apply to:** all EXTV-03 probe additions (script-only) versus any new
offline fixture-driven assertion (test-only).

## No Analog Found

None — every file in scope is either a self-analog (an existing file edited
in place, following its own established convention) or a new fixture file
following `fixtures/binmon/`'s established sidecar convention. No file in
this phase's scope requires inventing a pattern from a different subsystem.

## Metadata

**Analog search scope:** `.claude/mcp/vice/` (all files named in
CONTEXT.md/RESEARCH.md's "Files the phase touches" and D-13-04's label-site
table), `.claude/mcp/vice/fixtures/binmon/`, `docs/`,
`.planning/phases/03-direct-tools/`.
**Files scanned:** 15 read directly this session (targeted, non-overlapping
ranges), plus 2 net-new fixture files scoped by analogy.
**Pattern extraction date:** 2026-08-22
