---
phase: 50-equivalence-and-modifiability
reviewed: 2026-09-16T10:38:51Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - docs/phase50-ci-boundary.md
  - docs/phase50-equivalence-transcript.md
  - docs/phase50-exported-edit-findings.md
  - docs/phase50-exported-modifiability-transcript.md
  - docs/phase50-modifiability-findings.md
  - docs/phase50-modifiability-transcript.md
  - src/mcp/vice/fixtures/hazard-subject/exported-edit.manifest.json
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-nosprite.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-align-regressed.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-dispatch-regressed.a
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-exported-edit.prg
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.allowlist.json
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.annostore.json
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-modified.prg
  - src/mcp/vice/fixtures/hazard-subject/hazard-subject-regressed.prg
  - src/mcp/vice/fixtures/hazard-subject/make-exported-edit.mjs
  - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-annostore.mjs
  - src/mcp/vice/fixtures/hazard-subject/make-hazard-subject-fixtures.mjs
  - src/mcp/vice/hazard-subject-exported-edit.test.ts
  - src/mcp/vice/hazard-subject-fixture.test.ts
  - src/mcp/vice/hazard-subject-variants.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/phase50-transcript-freshness.test.ts
  - src/mcp/vice/reassembly-gate-exported-edit-run.test.ts
  - src/mcp/vice/reassembly-gate-modified-run.test.ts
  - src/mcp/vice/stock-derived.test.ts
  - src/mcp/vice/stock-derived.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/text-protocol.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/tools-manifest.stock.json
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-disk-access/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-petcat/SKILL.md
  - src/skills/c64-program-recon/references/control-flow.md
  - src/skills/c64-program-recon/references/graphics.md
  - src/skills/c64-program-recon/references/observation-hazards.md
  - src/skills/c64-program-recon/references/reconstruction.md
  - src/skills/c64-program-recon/references/sound-and-input.md
  - src/skills/c64-program-recon/references/tool-selection.md
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-program-recon/templates/memory-map.template.md
  - src/skills/c64-provenance-diff/SKILL.md
  - src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs
  - src/skills/c64-ram-capture/scripts/compare-cross-binary.test.mjs
  - src/skills/c64-ram-capture/SKILL.md
  - src/skills/c64-ram-capture/templates/capture-record.template.md
  - src/skills/c64-ram-capture/transients/README.md
  - src/skills/routine-queue-walker/SKILL.md
  - src/skills/vice-wedge-triage/SKILL.md
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-09-16T10:38:51Z
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

## Summary

Phase 50's TypeScript core (`text-protocol.ts`, `text-tools.ts`, `stock-dispatch.ts`,
`stock-derived.ts`) is heavily documented, defensively coded, and backed by an
unusually thorough test suite (deterministic stub-server framing tests, planted
RED/GREEN controls, closed-table membership proofs, a CI freshness gate that
re-hashes every transcript's subject binary on every run). The reassembly-gate
and hazard-subject fixture/test scaffolding (`make-exported-edit.mjs`,
`hazard-subject-exported-edit.test.ts`, `reassembly-gate-exported-edit-run.test.ts`,
etc.) is internally consistent, refuses rather than guesses at every step, and
its claims are independently re-derived by the test suite rather than merely
asserted in prose.

One genuine correctness defect was found and confirmed by reading both the
implementation and every call site: `TextMonitorClient.command()`
(`text-protocol.ts`) declares a `timeoutMs` option but never reads it, so six
call sites in `text-tools.ts` that pass `{ timeoutMs: 30000 }` believing they
bound the wait get no such bound — a text-monitor command that never receives
its terminating prompt hangs the call, and the channel lock it holds, forever.
One additional correctness gap was found in `compare-cross-binary.mjs`
(register comparison silently skipped when one side's `registers` sidecar is
empty, with no diagnostic that this happened).

**Scope note on the two lower-priority tiers**, stated rather than glossed
over: three of the listed fixtures are binary `.prg` images
(`hazard-subject-exported-edit.prg`, `hazard-subject-modified.prg`,
`hazard-subject-regressed.prg`) — these were not decoded byte-by-byte; instead
their provenance was checked against the generator scripts and the dedicated
re-derivation tests that hash and byte-compare them on every run
(`hazard-subject-exported-edit.test.ts`, `reassembly-gate-*-run.test.ts`,
`phase50-transcript-freshness.test.ts`), which is a stronger check than a
manual read would have been. The `.a` assembly fixtures were read as text and
found internally consistent with their own header comments and with the
generator scripts that consume them. The 17 `src/skills/**` markdown files
entered scope only through the git-diff cross-check against
`diff_base`, not through any Phase 50 plan artifact, and the prompt's own note
confirms most of that diff is a concurrent Phase 51 planning-vocabulary sweep;
they were pattern-scanned (no TODO/FIXME/secrets/dangerous-function hits) but
not read end-to-end at this file's priority, and no finding below is drawn
from them.

## Critical Issues

### CR-01: `TextMonitorClient.command()`'s `timeoutMs` option is silently ignored — six call sites believe a 30s bound exists and get none

**File:** `src/mcp/vice/text-protocol.ts:847`
**Issue:**

```ts
command(cmd: string, _opts: TextCommandOptions = {}): Promise<string> {
  ...
  const socket = this.#socket;
  return new Promise<string>((resolve, reject) => {
    this.#pending = { resolve, reject, command: cmd };
    socket.write(`${cmd}\n`);
  });
}
```

The second parameter is named `_opts` (the underscore-prefix convention this
codebase uses to mark a parameter deliberately unread) and `TextCommandOptions.timeoutMs`
is never referenced anywhere in `command()`'s body, nor anywhere else in the
class. No timer is armed for the outstanding command; the returned promise
resolves only when `#finishPending()` runs (a tail match against `PROMPT_RE`
that survives the quiescence window), or rejects on `disconnect()`/`close`/`error`,
or (only if enough garbage bytes accumulate) via `#checkCap()`'s
`TEXT_MAX_BUFFERED_LEN` (4 MiB) refusal.

Six call sites in `src/mcp/vice/text-tools.ts` pass `{ timeoutMs: 30000 }`
specifically to bound this wait:

```
text-tools.ts:305   client.command("memmapshow", { timeoutMs: 30000 })
text-tools.ts:394   client.command("memmapzap",  { timeoutMs: 30000 })
text-tools.ts:395   client.command("memmapshow", { timeoutMs: 30000 })
text-tools.ts:523   client.command(command,      { timeoutMs: 30000 })   (chis)
text-tools.ts:575   client.command(command,      { timeoutMs: 30000 })   (prof flat)
text-tools.ts:651   client.command("bt",          { timeoutMs: 30000 })
text-tools.ts:734   client.command(command,      { timeoutMs: 30000 })   (io)
```

If VICE stops sending bytes for one of these commands after the write (a
genuine wedge, a chip-decode routine that never returns, the machine halted
mid-response) and never sends enough garbage to trip the 4 MiB cap, the
`await client.command(...)` call inside `withTextTool()` never settles. That
call happens *inside* `withTextChannelLock()`'s `fn()` — the mutex's
`release()` (in a `finally`) never runs because the awaited promise never
returns control. Every subsequent text-channel operation queues behind the
held lock and only fails once `CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS` (~630s
default) elapses; the *original* hung call, and whatever ultimately awaited
the top-level MCP tool invocation, never resolves or rejects at all — this is
exactly the wedge class `docs/`/`CLAUDE.md` and the `vice-wedge-triage` skill
otherwise take great care to make diagnosable, reachable here with no
diagnostic at all.

This is not a hypothetical: `text-protocol.test.ts`'s own test suite never
exercises `timeoutMs` (every `client.command(...)` call in that file omits
the option entirely), so there is no test anywhere in the reviewed set that
would catch this regressing further or catch it existing today.

**Fix:** Wire `_opts.timeoutMs` into `command()`'s promise executor — arm a
timer alongside `this.#pending`, and on expiry reject with a named
`TextFramingError`-style error (observed elapsed time, the outstanding
command) and clear `this.#pending`, mirroring the discipline `disconnect()`
and `#checkCap()` already use for their own rejection paths:

```ts
command(cmd: string, opts: TextCommandOptions = {}): Promise<string> {
  ...
  const socket = this.#socket;
  return new Promise<string>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    if (opts.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        this.#pending = null;
        reject(new ViceError(`text-protocol: command ${JSON.stringify(cmd)} timed out after ${opts.timeoutMs}ms`));
      }, opts.timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    }
    this.#pending = {
      resolve: (v) => { if (timer) clearTimeout(timer); resolve(v); },
      reject:  (e) => { if (timer) clearTimeout(timer); reject(e); },
      command: cmd,
    };
    socket.write(`${cmd}\n`);
  });
}
```

At minimum, add a test in `text-protocol.test.ts` that drives a stub server
which never sends a prompt and asserts `command()` with a short `timeoutMs`
actually rejects within that bound — the same "prove the framing rather than
assert it" discipline this file already applies to Controls 1 and 2.

## Warnings

### WR-01: `compare-cross-binary.mjs` silently skips register-domain comparison when only one side's chip-state sidecar carries register data

**File:** `src/skills/c64-ram-capture/scripts/compare-cross-binary.mjs:315`
**Issue:**

```js
if (regMapA && regMapB && regMapA.size && regMapB.size) {
  // ... only path that ever compares register-domain addresses
}
```

`regMapA`/`regMapB` are always `Map` instances (truthy) once `--state` is
supplied — `normalizeRegisters()` returns an empty `Map` rather than `null`
when a sidecar's `registers` key is absent or `{}`. The gate is really
`regMapA.size && regMapB.size`: if *either* side's sidecar was captured
without a `registers` block (or with an empty one) while the other side's
carries real values, register-domain comparison is skipped in its entirety —
silently. The tool's own stated purpose is catching a rebuild regression a
one-bit register difference would reveal (the whole reason `compare.mjs`'s
"drift" tolerance was rejected for this sibling module, per this file's own
header), yet an asymmetric sidecar (one capture procedure step forgotten)
degrades straight back to image-only comparison with no printed warning that
register comparison did not run. The printed report (`VERDICT`, the three
`printList()` sections, `total differing addresses`) gives no indication a
whole comparison domain was skipped versus genuinely checked-and-clean.

**Fix:** Either (a) refuse the run by name when the two `--state` sidecars
disagree on whether they carry `registers` data (mirroring the existing
route/checkpoint-mismatch refusals in `cmdCross()`), or (b) print an explicit
`REGISTERS_COMPARED: no (A carries N, B carries 0)`-shaped line whenever the
comparison is skipped for this reason, so a transcript reader — or the
freshness/CI machinery that reads printed output in this phase's other
guards — cannot mistake "not checked" for "checked and equal."

### WR-02: `TextCommandOptions`/`_opts` naming pattern makes a genuinely dead parameter look intentionally unused rather than unfinished

**File:** `src/mcp/vice/text-protocol.ts:729-731, 847`
**Issue:** This codebase's own convention (seen elsewhere, e.g. unused
handler args) is that an underscore-prefixed parameter name signals
"deliberately unread, kept for shape compatibility." Here that same
convention is applied to `_opts: TextCommandOptions = {}` even though the
type carries a single field (`timeoutMs`) that six production call sites
populate expecting an effect (see CR-01) — nothing in the surrounding
150-line block of documentation above `command()` (which otherwise names
every deliberate design choice explicitly, down to citing `RESEARCH.md`
pitfall numbers) states that the timeout is intentionally not enforced yet.
The naming convention that elsewhere signals "reviewed and inert by design"
here signals a scaffolded-but-never-wired feature, which is exactly the kind
of ambiguity this codebase's own comment discipline is normally built to rule
out.
**Fix:** Once CR-01 is fixed this resolves itself (the parameter becomes
`opts`, genuinely read). If the fix is deferred, rename to `_opts` →
`opts` and add a header note stating explicitly that `timeoutMs` is accepted
but not yet enforced and why, so a reader does not have to trace six call
sites to discover the gap.

## Info

### IN-01: Skills markdown (17 files) reviewed only by pattern scan, provenance noted

**File:** `src/skills/**/*.md` (17 files listed in the config's `files:` block)
**Issue:** Per the task's own scoping note, these files entered review scope
through the `diff_base` git-diff cross-check rather than through any Phase 50
plan/SUMMARY artifact, and most of their diff is a concurrent Phase 51
planning-vocabulary sweep unrelated to this phase's `EQUIV-04`/modifiability
work. They were grepped for the standard anti-pattern set (hardcoded
secrets, `eval`/`exec`/`innerHTML`, `TODO`/`FIXME`/`HACK`, empty catch) with
no hits, but were not read end-to-end at the same depth as the Phase 50
TypeScript/test/doc core above. No finding in this report is drawn from
their content; a reviewer scoping a future Phase 51 code review should not
assume this pass constitutes coverage of them.
**Fix:** N/A — disclosure only, so this pass is not mistaken for review
coverage of that concurrent work.

---

_Reviewed: 2026-09-16T10:38:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
