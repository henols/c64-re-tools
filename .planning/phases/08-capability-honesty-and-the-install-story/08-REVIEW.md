---
phase: 08-capability-honesty-and-the-install-story
reviewed: 2026-08-18T21:20:22Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .claude/mcp/vice/capability-registry.ts
  - .claude/mcp/vice/capability-registry.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/vice-proxy.test.ts
  - .claude/mcp/vice/tool-support-table.test.mjs
  - .claude/mcp/vice/package.json
  - scripts/generate-tool-support-table.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/check-npm-packages.mjs
  - docs/tool-support.md
  - docs/stock-vice-parity.md
  - README.md
  - .github/workflows/ci.yml
  - .claude/skills/c64-program-recon/SKILL.md
  - .claude/skills/c64-program-recon/references/control-flow.md
  - .claude/skills/c64-program-recon/references/observation-hazards.md
  - .claude/skills/c64-program-recon/references/sound-and-input.md
  - .claude/skills/c64-ram-capture/SKILL.md
findings:
  critical: 2
  warning: 14
  info: 0
  total: 16
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-18T21:20:22Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The mechanical spine of this phase holds up under direct probing. I verified live, not by
reading:

- `node scripts/generate-tool-support-table.mjs` reproduces `docs/tool-support.md`
  byte-identically; both lint scripts exit 0; `npm run typecheck` is clean; the 15 tests in
  `capability-registry.test.ts` + `tool-support-table.test.mjs` pass.
- The `DENY_LIST`-before-capability-refusal ordering in `vice-proxy.ts:3237-3277` is correct,
  and `tools_call`/`initialize`/etc. are additionally never keys in `tools` at all
  (`vice-proxy.ts:3189`), so the ordering is belt-and-braces. **No defect here.**
- Determinism of the generator is sound on the axes that usually break byte-identity guards:
  the row sort uses an explicit code-unit comparator (`generate-tool-support-table.mjs:167`),
  not `localeCompare`; the only timestamps embedded are read out of the two *committed*
  manifests, not `Date.now()`; no absolute path, hostname or PID reaches the output. I found
  no locale-, Node-version- or machine-dependent output.
- `capability-registry.ts` genuinely is the only *literal* copy of the 26-entry name/reason
  data. The old hardcoded array in `check-skill-tool-coverage.mjs` is really gone and really
  derived now. That dedup is not partial.

What the review did find is a **runtime capability-honesty bug that the whole phase exists to
prevent** (CR-01: the `alternative` route is silently dropped from every refusal that has
one), a **factually incomplete backend-selection instruction in README.md that the repo's own
error text contradicts** (CR-02), and a cluster of gate-strength problems: two of the three
"one source of truth" claims are undermined by *smaller* hand-maintained lists that survived
the consolidation (WR-05, WR-08), and both lint scripts have detection rules that are weaker
than their comments claim (WR-06, WR-09, WR-10, WR-11).

---

## Critical Issues

### CR-01: `CapabilityEntry.alternative` is dead at runtime — every refusal that has a stock route drops it

**File:** `.claude/mcp/vice/capability-registry.ts:356-369` (also `88`, `91-94`)

**Issue:** `capabilityRefusalMessage()` renders `entry.alternative` **only** in the
`"descoped"` branch (line 364). But every entry that actually carries an `alternative` is
category `"hardware"`, and the hardware branch (lines 356-361) never reads the field. Proven
by execution, not inspection:

```
entries with alternative: vice_keyboard_matrix[hardware], vice_keyboard_restore[hardware],
                          vice_keyboard_chord[hardware], vice_keyboard_key_press[hardware],
                          vice_keyboard_key_release[hardware]
descoped entries with alternative: 0

capabilityRefusalMessage("vice_keyboard_matrix", "stock") ==>
  "vice_keyboard_matrix is unrecoverable on the stock backend: The binary monitor's
   KEYBOARD_FEED (0x72) only injects PETSCII buffer text; ... Use the fork backend instead
   (Set VICE_BACKEND=fork)."
contains "vice_joystick_set"? false
```

So the field is set on exactly the five entries whose branch ignores it, and consumed by the
one branch no entry ever reaches. Consequences:

1. A stock user calling `vice_keyboard_matrix` is told only "unrecoverable, switch backends" —
   the actionable route (`vice_keyboard_type` / `vice_keyboard_petscii` / `vice_joystick_set`)
   that the registry *holds*, that `docs/tool-support.md` prints, that all four touched skill
   files print, and that README.md alludes to, is the one thing the runtime refusal omits.
   That is precisely the "indistinguishable and unhelpful" failure BACK-05 was written to fix,
   reintroduced one layer down.
2. It contradicts this file's own documented contract: line 80-81 says `alternative` "names a
   concrete route that exists on the OTHER backend today", with no carve-out saying hardware
   refusals suppress it.
3. Zero test coverage in either direction. `capability-registry.test.ts:27` exercises hardware
   via `vice_sid_get_state` (**no** `alternative`) and line 36 exercises descoped via
   `vice_memory_fill` (**no** `alternative`), so the rendering path is untested and the
   dead-field state is invisible to the automated gate.

**Fix:** hoist the alternative-append out of the category branches so it applies uniformly,
and add the missing coverage:

```ts
export function capabilityRefusalMessage(
  name: string,
  activeBackend: ViceBackend,
): string | undefined {
  const entry = capabilityEntryFor(name);
  if (!entry) return undefined;
  if (entry.providedBy === activeBackend) return undefined;

  const alt = entry.alternative ? ` ${entry.alternative}` : "";

  if (entry.category === "hardware") {
    return (
      `${entry.name} is unrecoverable on the ${activeBackend} backend: ${entry.reason} ` +
      `Use the ${entry.providedBy} backend instead (Set VICE_BACKEND=${entry.providedBy}).${alt}`
    );
  }
  if (entry.category === "descoped") {
    return (
      `${entry.name} is not implemented on the ${activeBackend} backend: ${entry.reason} ` +
      `Use the ${entry.providedBy} backend instead (Set VICE_BACKEND=${entry.providedBy}).${alt}`
    );
  }
  return (
    `${entry.name} is not implemented on the fork backend: ${entry.reason} ` +
    `Use the stock backend instead (Set VICE_BACKEND=stock).${alt}`
  );
}
```

Then add to `capability-registry.test.ts` a test that closes the hole permanently — not one
that just pins today's five names:

```ts
test("every entry carrying an `alternative` renders it in the refusal, in every category", () => {
  for (const entry of CAPABILITY_REGISTRY) {
    if (!entry.alternative) continue;
    const other = entry.providedBy === "fork" ? "stock" : "fork";
    const message = capabilityRefusalMessage(entry.name, other)!;
    assert.ok(
      message.includes(entry.alternative),
      `${entry.name} (${entry.category}) carries an alternative route that the refusal drops`,
    );
  }
});
```

### CR-02: README.md's backend-selection instruction is incomplete and is contradicted by the proxy's own error text

**File:** `README.md:109-112`

**Issue:** README says:

> The backend is selected by **one config value**, `VICE_BACKEND`, set to `stock` or `fork` in
> the `vice` MCP server's environment — the `env` block of the `vice` entry in `.mcp.json`.

`vice-proxy.ts:2297` says the opposite, in the user-facing failure it emits when the reader
follows that instruction:

```
Set VICE_BACKEND=${brokerBackend} for THIS process as well -- it must be set for both --
and restart the MCP server so its advertised tool list matches.
```

`VICE_BACKEND` is read per *process* (`backend-detect.mts:461`), and the two processes that
must agree are the container-side MCP server **and** the host-side broker (`vice-broker.mts`,
which resolves the backend once at its own startup from its own environment). `.mcp.json`'s
`env` block reaches only the first. In the devcontainer topology this project is architected
around ("container-in / host-out split", CLAUDE.md), the container has no `x64sc` at all, so
the proxy's own probe classifies `unknown` and degrades to `fork` — meaning a reader who
installs stock VICE and sets `VICE_BACKEND=stock` in `.mcp.json` alone gets the hard
`backend mismatch` refusal on the first real tool call, and README.md offers no route out of
it. This is DIST-03's exact subject matter, so an instruction the repo's own code refutes is a
defect in this phase, not a nitpick.

Secondary: README.md:114-121 lists "Consequences of the choice" but not the *failure* mode of
choosing inconsistently, which is the one a reader will actually hit.

**Fix:** replace "one config value ... the `env` block of the `vice` entry in `.mcp.json`"
with the two-process truth, e.g.:

```markdown
The backend is selected by `VICE_BACKEND` (`stock` or `fork`). It is read **per process**, and
two processes must agree: the `vice` MCP server (set it in the `env` block of the `vice` entry
in `.mcp.json`) **and** the host-side broker (set it in the environment the broker is started
from). When the two disagree, the first tool call is refused with a `backend mismatch` error
naming both verdicts — the broker's is authoritative, because it is what the emulator was
actually launched with.

When `VICE_BACKEND` is unset, each process probes the configured binary's `--help` output once
and caches the verdict; an indeterminate probe falls back to `fork`. A container that has no
`x64sc` on its own PATH always probes indeterminate, which is why setting it explicitly in
both places is the reliable configuration.
```

Consider also adding `"VICE_BACKEND"` to `check-skill-fork-honesty.mjs`'s
`REQUIRED_README_SUBSTRINGS` in a form that pins the two-process claim (e.g. requiring the
substring `must be set for both` or `broker`), so this specific honesty gap cannot silently
reopen.

---

## Warnings

### WR-01: README.md's "pick stock unless you need SID read-back or the raw keyboard matrix" understates 24 fork-only tools — and contradicts README.md itself

**File:** `README.md:69-71` (contradicting `README.md:9`)

**Issue:** Line 69-71 tells the reader to pick stock "unless you specifically need SID register
read-back or the raw keyboard matrix". `docs/tool-support.md`, generated in this same phase,
says **Fork-only: 24** — including `vice_display_screenshot`, `vice_display_get_dimensions`,
`vice_backtrace`, all four `vice_checkpoint_group_*`, `vice_memory_fill`, `vice_sprite_set`,
`vice_vicii_set_state`, `vice_cia_set_state`, `vice_sid_set_state`,
`vice_machine_config_get/set`, `vice_disk_detach`, `vice_disk_read_sector`,
`vice_joystick_tap`, `vice_checkpoint_set_ignore_count`, and the whole low-level keyboard
family. Reducing that to two named tools in the sentence a reader uses to make the decision is
the same "indistinguishable and unhelpful" shape CR-01 concerns.

It is also internally inconsistent: `README.md:9` — sixty lines earlier, added by this same
phase — already flags **screenshots** as "fork backend only, see below", and "below" then does
not mention them.

**Fix:** name the count and the shape, and point at the generated table for the enumeration:

```markdown
- **Stock upstream VICE**, driven through its binary monitor. Install it from any package
  manager; no build step required. **Pick this one** unless you need one of the 24 fork-only
  tools — the hardware-unrecoverable ones (SID register read-back, the low-level keyboard
  family) or the not-yet-built ones (screenshots, checkpoint groups, the chip/sprite *write*
  halves, resource get/set). [`docs/tool-support.md`](docs/tool-support.md) is the full,
  generated per-tool answer.
```

### WR-02: README.md's "verified" stock-install command omits the two launch mitigations the repo's own tests record as required

**File:** `README.md:135-142`

**Issue:** README presents

```
x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```

as an "exact command ... run live ... and observed to bind its monitor port". Two omissions
against the repo's own recorded ground truth:

1. `stock-live.test.ts:204-208` states, in the imperative: "`-default` MUST precede
   `-binarymonitor` in the spawned argv or the monitor never binds (MEMORY: 'Stock VICE flag
   order') — the shared fixture's own `before()` above omits `-default` and **must NOT be
   taken as the pattern here**." README reproduces exactly the pattern that comment warns
   against.
2. Every stock-launch site in the repo's tests sets a scratch `XDG_CONFIG_HOME`
   (`stock-live.test.ts:216-231`, annotated T-03-16-04) specifically to suppress the
   shared-`vicerc` version-mismatch dialog. README does not mention it.

I reproduced the README command live against `/usr/bin/x64sc` (genuine stock VICE 3.9) with a
fresh `XDG_CONFIG_HOME` and it **did** bind within 1s — so the claim is not false on a clean
config. But that is exactly the point: the reader most likely to run this verification step is
someone who already has a fork build and therefore a populated `~/.config/vice/vicerc`, which
is the condition the `-default` note exists for. A verification step that can fail for a
config reason the README never mentions teaches the reader the wrong conclusion ("my stock
VICE is broken").

**Fix:**

```markdown
```
XDG_CONFIG_HOME=$(mktemp -d) x64sc -default -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
```

`-default` must come **before** `-binarymonitor` (it resets every resource to its documented
default, and a stale `vicerc` can otherwise leave the monitor unbound), and the throwaway
`XDG_CONFIG_HOME` avoids the shared-`vicerc` version-mismatch dialog. Both are what this
project's own live test harness does.
```

### WR-03: `vice-proxy.test.ts` cites a "source-offset assertion" that does not exist, and the ordering invariant has no assertion in the automated gate

**File:** `.claude/mcp/vice/vice-proxy.test.ts:6281-6283`

**Issue:** The comment reads "complementing **Task 1's source-offset assertion** with a
wire-level observation of the same invariant." No such assertion exists. I grepped every
`*.test.*` in `.claude/mcp/vice/` for `indexOf(` structural-ordering checks: the pattern is
used in `broker-kill.test.ts:429-431`, `broker-kill.test.ts:905-906` and
`stock-dispatch.test.ts:1536-1537`, none of which touch `DENY_LIST` vs. the capability
refusal. Nothing in the tree asserts their relative source position.

Compounding it: all four new BACK-05 tests live in `vice-proxy.test.ts`, which
`test-gate.mjs:64` lists in `MANUAL_ONLY_TESTS`. They therefore do **not** run under
`npm run test:automated`. They do run in CI today only because `.github/workflows/ci.yml:65`
uses the wider `npm test` glob — and the repo already carries a pending todo to narrow CI to
the gate (`ci.yml:68-73` names
`.planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`). When
that todo lands, the load-bearing ordering invariant loses its only coverage silently.

**Fix:** either delete the false citation, or land the assertion it claims exists, in an
automated-set file (e.g. `stock-dispatch.test.ts`, which already reads
`VICE_PROXY_SOURCE`):

```ts
test("structural: the DENY_LIST refusal precedes the capability refusal in the tools/call override", () => {
  const start = VICE_PROXY_SOURCE.indexOf("setRequestHandler(CallToolRequestSchema");
  assert.ok(start > 0, "could not locate the tools/call override");
  const body = VICE_PROXY_SOURCE.slice(start);
  const denyAt = body.indexOf("DENY_LIST.includes(name)");
  const capAt = body.indexOf("capabilityRefusalMessage(");
  assert.ok(denyAt > -1 && capAt > -1, "both refusal sites must be present");
  assert.ok(
    denyAt < capAt,
    "DENY_LIST (a confused-deputy bypass hazard) must be checked strictly before the " +
      "capability refusal (a capability-gap hazard) -- 01.4-01 / BACK-05",
  );
});
```

### WR-04: the generator emits registry prose into markdown table cells with no `|`/newline escaping

**File:** `scripts/generate-tool-support-table.mjs:189-190`, `224`

**Issue:** `note = \`${label}: ${entry.reason}\`` (+ `entry.alternative`) is interpolated
straight into `| ${row.name} | ${forkCell} | ${stockCell} | ${row.note} |`. A single `|` in a
future `reason` or `alternative` splits the row into extra cells; an embedded `\n` splits it
into two lines and silently drops the tail out of the table. No entry contains either
character today, so this is latent — but the byte-identity drift guard makes it *worse*, not
better: the guard would happily lock in the corrupted rendering as the new expected bytes, and
nothing in `tool-support-table.test.mjs` inspects cell counts.

**Fix:** escape at the single emission point, and assert the invariant:

```js
/** Markdown table cells cannot contain a raw pipe or newline -- registry prose is
 * user-facing and may acquire either. Escaped here, at the ONE emission point. */
const cell = (text) => text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
...
lines.push(`| ${cell(row.name)} | ${forkCell} | ${stockCell} | ${cell(row.note)} |`);
```

and in `tool-support-table.test.mjs`:

```js
test("every table row has exactly 4 cells -- no registry prose can split a row", () => {
  for (const line of generateToolSupportTable().split("\n")) {
    if (!/^\|\s*vice_/.test(line)) continue;
    assert.equal(line.split("|").length - 2, 4, `row has the wrong cell count: ${line}`);
  }
});
```

### WR-05: `capability-registry.test.ts` hardcodes the synthetic-tool set — a second copy of data the generator derives mechanically, already incomplete

**File:** `.claude/mcp/vice/capability-registry.test.ts:100`

**Issue:**

```ts
const SYNTHETIC = new Set(["vice_diagnose", "vice_recycle"]);
```

This is the *only* hand-maintained copy of a fact that
`generate-tool-support-table.mjs:87-116` goes to considerable trouble to derive mechanically
from `vice-proxy.ts` — and it is already wrong: the mechanical discovery returns **three**
names (`vice_diagnose`, `vice_recycle`, **`vice_result_continue`**, from
`vice-proxy.ts:3196/3206/3207`), and this set omits the third.

Harmless today only because `vice_result_continue` is absent from both manifests, so it never
enters the symmetric difference this test computes. The moment `vice_result_continue` (or any
future synthetic) gains a manifest entry — exactly what happened to `vice_recycle`/
`vice_diagnose` in Phase 7 per `check-skill-tool-coverage.mjs:137-147` — the completeness test
will demand a `CAPABILITY_REGISTRY` entry for a synthetic tool, i.e. it will *enforce* the
research Pitfall-2 misclassification its own header comment (lines 12-15) says it exists to
prevent. This is the D-E anti-pattern surviving inside the test that guards D-E.

**Fix:** import the mechanical discovery rather than re-typing its answer:

```ts
import { discoverSyntheticToolNames } from "../../../scripts/generate-tool-support-table.mjs";
...
const SYNTHETIC = new Set(discoverSyntheticToolNames(readFileSync(join(HERE, "vice-proxy.ts"), "utf8")));
```

(If importing the generator from a `.ts` test is unacceptable under `tsconfig.json`'s
`allowJs: false` — see `tool-support-table.test.mjs`'s own header on TS7016 — move the
completeness test into a `.mjs` sibling rather than keeping the literal.)

### WR-06: the registry-echo assertions in `check-skill-tool-coverage.mjs` are tautologies that can never fail

**File:** `scripts/check-skill-tool-coverage.mjs:284-292`

**Issue:** `FORK_ONLY_UNRECOVERABLE` is built at line 193-195 by
`CAPABILITY_REGISTRY.filter(e => e.category === "hardware" && e.providedBy === "fork")`. Lines
284-292 then assert, for each derived member, that its registry entry's `category` is
`"hardware"` and its `providedBy` is `"fork"` — the exact predicates it was filtered on. These
two `need()` calls are unfalsifiable by construction.

That would be harmless dead weight, except the comment at lines 271-278 presents them as the
substantive replacement for the (correctly) removed `BACK-05`/`SKILL-01` reason check:
"Replaced with three checks that hold against the registry itself". Two of the three are
vacuous, so the real net effect of the change is that one assertion was replaced by one
assertion (`reason.length >= 40`), while the comment claims three. A future reader trusts
guards that are not there.

**Fix:** delete lines 288-292 and drop the "three checks" wording, or — better — make them
non-vacuous by asserting the *cardinality* the surrounding comments rely on:

```js
// Non-vacuous: pins that the projection actually selected the registry's hardware/fork set,
// so a category retag in capability-registry.ts is visible here rather than silently
// shrinking this classification to zero.
const registryHardwareForkCount = CAPABILITY_REGISTRY.filter(
  (e) => e.category === "hardware" && e.providedBy === "fork"
).length;
need(
  FORK_ONLY_UNRECOVERABLE.length === registryHardwareForkCount && registryHardwareForkCount >= 6,
  `FORK_ONLY_UNRECOVERABLE must project every hardware/fork registry entry (got ${FORK_ONLY_UNRECOVERABLE.length} of ${registryHardwareForkCount}, expected >= 6)`
);
```

### WR-07: the D-E consolidation silently doubled the coverage script's core-check allowlist

**File:** `scripts/check-skill-tool-coverage.mjs:193-195`, `360-364`

**Issue:** `FORK_ONLY_UNRECOVERABLE` went from 3 hand-typed names to **6** derived names, and
it feeds `allowlistedNames` at line 360-364, which short-circuits the core check at line
370-380. So `vice_keyboard_chord`, `vice_keyboard_key_press` and `vice_keyboard_key_release`
became core-check-exempt as a side effect of the refactor, not as a decision anyone made.

It is currently caught by `EXPECTED_SKILL_REFERENCED_HARDWARE_TOOLS` (lines 331-335), which is
a good instinct — but that is now a **third** hand-maintained list of the same three-tool fact
(after `CAPABILITY_REGISTRY` and ROADMAP.md's criterion-5 parenthetical), i.e. the refactor
removed one hardcoded list and added another. And the exemption it grants is broad: the
set-equality check only fires on the *name*, so a skill can add a bare, unannotated mention of
one of those three and get a `check-skill-tool-coverage` failure whose remedy message
explicitly invites widening the expected set ("add it to the expected set").

**Fix:** narrow the allowlist to the names that are actually skill-referenced, so the core
check keeps its teeth for the other three, and derive the expected set from the registry
instead of re-typing it:

```js
// Only the hardware/fork entries a skill actually references are core-check-exempt; the rest
// must still fail the core check if a playbook starts naming them bare.
const allowlistedNames = new Set(
  [
    ...PROXY_LOCAL_TOOLS, ...DENY_LISTED_TOOLS, ...NOT_A_TOOL_NAMES, ...PENDING_LATER_PHASE,
    ...FORK_ONLY_UNRECOVERABLE.filter(([n]) => extracted.has(n)),
  ].map(([n]) => n)
);
```

### WR-08: `discoverSyntheticToolNames()`'s declaration regex can silently resolve to the *wrong* tool name

**File:** `scripts/generate-tool-support-table.mjs:103-105` (mirrored at
`.claude/mcp/vice/tool-support-table.test.mjs:69`)

**Issue:**

```js
const declRe = new RegExp(
  `const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{[\\s\\S]*?name:\\s*"([^"]+)"`,
);
```

`[\s\S]*?` is unbounded. It is lazy, so it stops at the *first* `name: "..."` after the
declaration opener — but nothing constrains that match to stay inside the declaration's own
braces. Two failure modes:

1. If a `ToolDefinition` declaration ever puts `description`/`inputSchema` before `name`, and
   `inputSchema.properties` contains a property literally called `name` with a string value,
   the wrong string is captured.
2. If a declaration has no `name:` at all (a spread, a computed key, a helper-built
   definition), the regex walks past the closing brace and captures the `name:` of a *later*
   declaration — producing a plausible-looking wrong tool name instead of the loud throw the
   header comment (lines 78-83) promises: "Any OTHER captured identifier that resolves to
   neither ... throws -- a silently dropped identifier is the same incompleteness failure ...
   and worse, because it leaves no trace to notice."

All three current declarations (`vice-proxy.ts:349`, `373`, `399`) put `name` first, so this
is latent. But the "independent re-derivation" in `tool-support-table.test.mjs:69` uses the
identical regex, so the two would agree on the same wrong answer — defeating the whole point
of writing it twice.

**Fix:** bound the search to the declaration's own body before extracting the name:

```js
const declStart = proxySource.search(new RegExp(`const\\s+${ident}\\s*:\\s*ToolDefinition\\s*=\\s*\\{`));
if (declStart === -1) throw new Error(/* ...existing message... */);
// Stop at the next top-level `const `/`function ` so the name can never be borrowed from a
// LATER declaration -- a wrong-but-plausible name is worse than the throw below.
const declEnd = proxySource.slice(declStart + 1).search(/\n(const|function|export)\s/);
const declBody = proxySource.slice(declStart, declEnd === -1 ? undefined : declStart + 1 + declEnd);
const declMatch = declBody.match(/^[^{]*\{\s*name:\s*"([^"]+)"/);
```

### WR-09: the stale-forward-reference lint's detection depends on where the author happened to wrap the line

**File:** `scripts/check-skill-fork-honesty.mjs:145-146`, `165-175`

**Issue:** The check requires `PHASE_POSSESSIVE_RE` (`/Phase\s+\d+['’]s/`) **and**
`STALE_WORDS_RE` to match **the same physical line**. Skill markdown in this repo is
hard-wrapped at ~95 columns, so whether a two-clause sentence lands both signals on one line
is an accident of wrapping.

The one defect it was written to catch demonstrates this. Pre-fix `control-flow.md` read:

```
PETSCII text into the buffer) cannot produce it. This call is unavailable on stock; Phase 8's
`BACK-05` is what reports the absence at runtime.
```

`unavailable` and `Phase 8's` share line 1 **by luck**. Had the author wrapped one word
earlier — `...unavailable on stock;` / `Phase 8's \`BACK-05\`...` — the identical defect would
pass the gate. The lint also only recognises the possessive idiom, so `deferred to Phase 9`,
`Phase 9 will report the absence`, and `not yet built (Phase 9)` are all invisible.

**Fix:** run the two signals against a normalised paragraph rather than a line, and report the
line of the phase mention:

```js
// Paragraph scope, not line scope: markdown prose is hard-wrapped, so whether two signals
// share a physical line is an accident of wrapping, not of meaning.
const PHASE_REF_RE = /Phase\s+\d+(['’]s)?/;
for (const para of splitParagraphs(raw)) {          // blank-line delimited, carries startLine
  const flat = para.text.replace(/\s+/g, " ");
  if (PHASE_REF_RE.test(flat) && STALE_WORDS_RE.test(flat)) {
    need(false, `${rel}:${para.startLine}: stale forward reference to a numbered phase -- state the current truth instead, and name no future phase`);
  }
}
```

### WR-10: the fork-honesty annotation rule is section-wide and matches bare `fork backend` / `VICE_BACKEND`

**File:** `scripts/check-skill-fork-honesty.mjs:102`, `178-206`

**Issue:** A section is deemed compliant when *anywhere* in it matches
`/(fork-only|requires the fork backend|requires the fork|fork backend|VICE_BACKEND)/i`, with
no association between the annotation and the tool name it is supposed to annotate. Two
consequences:

1. **Per-section, not per-tool.** In a section mentioning two fork-only tools, an annotation
   naming only the first licenses a bare mention of the second. I confirmed all 7 currently
   flagged sections happen to contain exactly one distinct fork-only name each, so the hole is
   latent — but `c64-program-recon/SKILL.md`'s `Troubleshooting` section is 13 lines and grows
   by rows, and `sound-and-input.md`'s `Three CIA hazards` is 23 lines.
2. **Incidental matches silence a whole section.** Prose like "the fork backend is faster
   here" or an unrelated `VICE_BACKEND` mention marks the section compliant. The two loosest
   alternatives (`fork backend`, `VICE_BACKEND`) are strict superstrings of the two precise
   ones (`requires the fork backend`, `fork-only`), so they only ever *weaken* the rule.

**Fix:** require the annotation to name the tool, which is what the requirement actually asks
for, and drop the two loose alternatives:

```js
const ANNOTATION_RE = /(fork-only|requires the fork\b)/i;
...
for (const name of names) {
  // Per-TOOL, not per-section: an annotation about tool A must not license a bare mention of
  // tool B in the same section.
  const nearName = new RegExp(
    `${name}[^\\n]{0,200}(fork-only|requires the fork)|` +
    `(fork-only|requires the fork)[^\\n]{0,200}${name}`, "i");
  if (nearName.test(sectionText) || ANNOTATION_RE.test(sectionText) && names.length === 1) continue;
  need(false, /* ...existing message... */);
}
```

(Keep the existing positive controls — `tool-selection.md` and `control-flow.md` both annotate
inline on/near the mention, so they stay compliant under the tighter rule.)

### WR-11: unannotated-section reports point every name at the first mention's line number

**File:** `scripts/check-skill-fork-honesty.mjs:190-206`

**Issue:** `lineNo` is computed once, from `forkMentionsInSection[0]`, then the loop at line
197 emits it for **every** distinct name in the section. For a section with 2+ unannotated
names, all but one error message cites a line where that name does not appear, sending the
fixer to the wrong place. Same class of problem as WR-10 (per-section instead of per-tool
bookkeeping) and best fixed together.

**Fix:** compute the offset per name:

```js
for (const m of forkMentionsInSection) {
  if (!reported.add(m[0])) continue;                     // first mention of each name
  const lineNo = section.startLine + cleaned.slice(0, m.index).split("\n").length - 1;
  ...
}
```

### WR-12: the skills-walk and tool-name-extraction seam is now duplicated verbatim across two CI-gating scripts

**File:** `scripts/check-skill-fork-honesty.mjs:47-83`, `98-99` vs.
`scripts/check-skill-tool-coverage.mjs:53-99`

**Issue:** `walkSkills()`, `MCP_PREFIX_RE`, `TOOL_NAME_RE`, the `topLevelDirs` /
`dirsWithAFileRead` non-vacuity block and the `need()` helper are byte-for-byte copies; the new
file's own comment admits it ("Copied from `scripts/check-skill-tool-coverage.mjs`'s
`walkSkills()`"). Both scripts are blocking CI steps (`ci.yml:87-97`) whose whole purpose is to
agree about which skill text exists and which tool names it contains. A change to one — a new
skill file extension, a new `mcp__*` prefix shape, a symlinked reference directory — silently
desynchronises the two gates, and the desynchronisation manifests as one gate passing while the
other should have failed. This is precisely CLAUDE.md's "re-deriving a cross-cutting seam
locally" anti-pattern, in the same phase that consolidated the capability data to avoid it.

**Fix:** extract one module, e.g. `scripts/lib/skill-corpus.mjs`, exporting
`walkSkills(dir)`, `MCP_PREFIX_RE`, `TOOL_NAME_RE`, `extractToolNames(text)` and
`topLevelSkillDirs(dir)`, and have both scripts import it. Both scripts already import
`capability-registry.ts` across the same boundary, so the precedent is set.

### WR-13: `dispatchStock()` carries a competing capability-refusal wording that violates `capability-registry.ts`'s stated contract

**File:** `.claude/mcp/vice/stock-dispatch.ts:735-738` (reached from the reviewed
`vice-proxy.ts` dispatch seam)

**Issue:** `capability-registry.ts:335-346` documents the refusal contract: hardware losses get
"**No 'wait for a later phase' framing** -- none is coming for a hardware loss", and the
providing backend is read from `entry.providedBy`. `dispatchStock()`'s miss branch says:

```ts
`${name} is not implemented by the stock backend -- the fork backend provides this tool. ` +
`Set VICE_BACKEND=fork to use it there, or wait for a later phase to extend the stock dispatch table.`
```

Two problems: it hardcodes "the fork backend provides this tool", which is false for the two
`stock-only-gain` names; and it uses exactly the "wait for a later phase" framing the registry
forbids. This is a second `Set VICE_BACKEND=...` refusal text outside the module the phase
declares the ONE authoritative place (`capability-registry.ts:8-13`).

I confirmed it is **unreachable today** — every one of the 38 tools in
`tools-manifest.stock.json` has a `stockHandlerFor()` entry — so this is a latent
divergence, not a live bug. But an unreachable branch with the wrong wording is exactly what
survives a consolidation unnoticed.

**Fix:** route the miss through the registry, and fall back only when there is no entry:

```ts
if (!handler) {
  return isErrorText(
    capabilityRefusalMessage(name, "stock") ??
      `${name} is advertised on the stock backend's manifest but has no handler in the stock ` +
        `dispatch table -- this is an internal inconsistency, not a capability gap; please file an issue.`,
  );
}
```

### WR-14: the skill prose overstates `vice_joystick_set` as the stock route for a matrix-polling gate

**File:** `.claude/skills/c64-program-recon/references/observation-hazards.md:110`,
`.claude/skills/c64-program-recon/references/sound-and-input.md:68`,
`.claude/skills/c64-ram-capture/SKILL.md:162`

**Issue:** All three added passages say to use "`vice_joystick_set` **when it polls the matrix
directly**", and `observation-hazards.md:110-111` goes further: "a matrix-polling gate must be
driven by the joystick or not at all". `vice_joystick_set` drives joystick lines, not the
keyboard matrix. A program doing a real matrix scan (write a row mask to `$DC00`, read column
bits from `$DC01`) is not satisfied by a joystick line, and the registry's own wording — the
one this phase declares authoritative — is carefully hedged and never makes that claim:

> `vice_joystick_set` covers **most in-game input** -- but a program polling `$DC00`/`$DC01`
> directly will not see buffer injection.
> (`capability-registry.ts:91-94`)

So the skill prose is strictly stronger than its own source of truth. In a phase whose subject
is capability honesty, telling a reader that a route exists where the registry deliberately
declines to is the same defect class as CR-01 in the opposite direction. (Fixing CR-01 makes
this worse, because the runtime refusal will then quote the hedged registry text right next to
the skill's unhedged claim.)

**Fix:** track the registry's hedge in all three places:

```markdown
On stock, use `vice_keyboard_type` / `vice_keyboard_petscii` when the gate reads the KERNAL
buffer. When it scans the matrix itself (`$DC00` row select, `$DC01` column read), there is no
stock route: `vice_joystick_set` drives the joystick lines that share those registers and
covers most in-game input, but it cannot present a keyboard row/column, and buffer injection
is invisible to a matrix scan. Such a gate needs the fork backend.
```

---

## Non-findings, recorded so they are not re-litigated

- **`DENY_LIST` ordering (`vice-proxy.ts:3237-3277`):** correct, and doubly protected by the
  construction-time skip at line 3189. See WR-03 for the *coverage* gap, not a logic gap.
- **Generator determinism:** explicit code-unit comparator at line 167; `.sort()` at line 116
  is spec-defined code-unit order, not locale; no `Date.now()`, no `process.cwd()`, no
  hostname, no absolute path in the output. Verified reproducible on Node 22.22.0. The only
  embedded timestamps come from the committed manifests. The one residual platform risk is
  CRLF: `writeFileSync` emits LF and the drift test compares raw bytes, so a Windows checkout
  with `core.autocrlf=true` would red the guard — out of scope given CI is `ubuntu-latest`,
  but worth a `.gitattributes` `docs/tool-support.md text eol=lf` line if Windows dev is ever
  supported.
- **D-E dedup in `check-skill-tool-coverage.mjs`:** the literal array is genuinely gone and
  genuinely derived. WR-06/WR-07 are about the *assertions and allowlist width* around it, not
  about a surviving copy of the reason text.
- **`docs/stock-vice-parity.md`'s claim that ROADMAP.md was amended:** verified true —
  `.planning/ROADMAP.md:304` carries the dated (2026-08-17) parenthetical naming all three
  unrecoverable tools.
- **`c64-program-recon/SKILL.md`'s cross-reference to "`observation-hazards.md` § 4":**
  verified — § 4 is "The keyboard buffer is not how games read keys", the correct section.
- **`installer/skills/` staleness:** not a risk. It is gitignored (`.gitignore:35`) and
  rebuilt from `.claude/skills/` by `installer/scripts/sync-skills.mjs` on every `prepack`; I
  confirmed the sync runs during `node scripts/check-npm-packages.mjs`.
- **`package.json` / `check-npm-packages.mjs` additions:** correct. `capability-registry.ts`
  is in `files`, and the pre-existing transitive-closure check ("42 modules, clean") already
  covered it, so the new `REQUIRED_DERIVED_MODULES` row is belt-and-braces rather than load-
  bearing. The plugin zip uses `git archive HEAD`, so the committed file ships there too.
- **Minor cosmetics not raised as findings:** `README.md:170` says "(see below)" for
  `docs/tool-support.md` but the section is above it; `scripts/check-skill-fork-honesty.mjs:35`
  declares an unused `VICE_DIR`; `scripts/check-skill-tool-coverage.mjs:34` imports an unused
  `statSync` and line 53 carries an unused `dirsSeen` parameter;
  `scripts/generate-tool-support-table.mjs:248`'s direct-invocation guard compares `argv[1]` to
  the realpath of `import.meta.url`, so invoking the script through a symlink silently no-ops
  with exit 0.

---

_Reviewed: 2026-08-18T21:20:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
