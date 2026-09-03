---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - src/mcp/vice/vsf-slice.ts
  - src/mcp/vice/vsf-slice.test.ts
  - src/mcp/vice/capture-predicate.ts
  - src/mcp/vice/capture-predicate.test.ts
  - src/mcp/vice/capture-seam.test.ts
  - src/mcp/vice/stop-oracle.ts
  - src/mcp/vice/stock-reproducible-run.ts
  - src/mcp/vice/stock-reproducible-run.test.ts
  - src/mcp/vice/stock-run-until.ts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/broker-launch.test.ts
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-state.mts
  - src/mcp/vice/broker-state.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/capability-registry.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/tools-manifest.stock.json
  - scripts/check-npm-packages.mjs
  - src/skills/c64-ram-capture/scripts/derive-transients.mjs
  - src/skills/c64-ram-capture/scripts/derive-transients.test.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.mjs
  - src/skills/c64-ram-capture/scripts/vsf-slice.test.mjs
  - src/skills/c64-ram-capture/SKILL.md
  - src/skills/c64-ram-capture/templates/capture-record.template.md
  - src/skills/c64-ram-capture/transients/README.md
  - src/skills/c64-ram-capture/transients/danish.json
  - src/mcp/vice/fixtures/vsf/make-fixtures.mjs
  - docs/tool-support.md
  - docs/phase33-reproducible-run-gate-findings.md
findings:
  critical: 2
  warning: 9
  info: 4
  total: 15
status: issues_found
dispositioned: 2026-09-03
disposition_report: 33-REVIEW-FIX.md
dispositions:
  fixed: 14
  accepted: 1
  wont_fix: 0
---

# Phase 33: Code Review Report

**Reviewed:** 2026-09-03
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Reviewed the reproducible-run protocol (`stock-reproducible-run.ts`, `stop-oracle.ts`,
`stock-run-until.ts`), the capture substrate (`vsf-slice.ts`, `capture-predicate.ts`,
the `.vsf` fixtures and their generator), the launch-profile plumbing across the
broker (`broker-control.mts` → `vice-broker.mts` → `broker-launch.mts` →
`broker-state.mts`, plus the container-side client), the packing gate change, and
the c64-ram-capture skill's two new scripts, template and `transients/` directory.

Independently verified, rather than taken from the evidence documents:

- `tsc --noEmit` clean; `resources/*.mjs` in sync; `node --test` green on all
  phase-33 test files (98 + 230 + 29 assertions across the three groups).
- The whole new stock argv (`-default -console -drive8type 1541 -seed 4242
  -raminitstartrandom 0 -raminitrepeatrandom 0 -raminitrandomchance 0
  +autostart-delay-random -warp -binarymonitor …`) launches genuine stock 3.9 on
  this host headless, binds the monitor, and — checked over `RESOURCE_GET`
  (0x51) — still reports `Drive8Type=1541` and `Drive8TrueEmulation=1` with
  `-console` inserted between `-default` and `-drive8type`. Every one of the five
  determinism flags exists in `x64sc -help`. Spawned instances were reaped.
- `npm pack --dry-run` on both packages: no fixtures, no test files, no
  `node_modules` — but see **CR-01**, which the packing gate does not cover.

The `.vsf` module walk holds up: every `readU32LE`/`subarray` index is bounded by
the loop condition and the `size >= MODULE_HEADER_LEN` check, progress is
guaranteed so the walk cannot spin, and the exact-end-of-file check closes the
short-walk case. The transient derivation's pairwise union is off-by-one-free
(`N(N-1)/2` pairs, `addr < IMAGE_BYTES`). No injection, no shell, no path
parameter reaches either library region.

The two Critical findings are both cases where a refusal that the code claims is
unconditional can be bypassed to produce a confident pass: a stop identity whose
frame term carries no frame information, and a derived address set that ships to
every consumer of the skill under a README that says it does not.

## Critical Issues

### CR-01: The published skill tarball ships a derived address set, under a README stating it ships nothing

**File:** `src/skills/c64-ram-capture/transients/README.md:131-136`, `src/skills/c64-ram-capture/transients/danish.json:1-8`, `scripts/check-npm-packages.mjs:91-104`

**Issue:** The shipped README states, normatively, that an installed copy of the
skill carries no artifact:

> "npm excludes a nested `.gitignore` from a published tarball, so the installed
> `transients/` directory has this README and nothing else."

That is false. Verified with `npm pack --dry-run --json` in `installer/`:

```
skills/c64-ram-capture/transients/danish.json
skills/c64-ram-capture/transients/README.md
```

`danish.json` — 49 enumerated addresses derived from *this project's* three
jitter runs of one specific release, on one host, at one argv digest — is
installed into every consumer project. The same README, four paragraphs earlier,
states the rule the artifact then breaks: "**no address set is ever inherited
between releases**", and "an allow-list borrowed from another release cannot be
distinguished afterwards from one honestly derived, so a contaminated ledger has
no cheap repair". Nothing in `danish.json` marks it as reference-only, nothing
in `check` refuses an allow-list whose release does not match the images, and
`derive`'s `--force` guard actively *encourages* reuse by refusing to overwrite
it. A consumer running the documented

```bash
node $T check --allow-list transients/danish.json runA.bin runB.bin
```

gets a predicate widened at 49 addresses nobody in their project vetted — the
exact widening route (`T-33-26`) `parseAllowList()`'s refusals exist to close,
arriving through the one input that is not validated at all: which release the
list came from. `assertLeanTarball()` has no assertion covering it, so the
packing gate is green on the leak.

**Fix:** Pick one of the two consistent answers and assert it mechanically.

Preferred — do not ship derived address sets at all:

```js
// installer/scripts/sync-skills.mjs, in shouldCopy()'s non-shipping set
// A derived per-release allow-list is this repo's own measurement of its own
// captures. Shipping one installs an inherited address set into a consumer's
// project, which the directory's README forbids by name.
base === "transients" && <parent is a skill dir> ||   // or, narrower:
(parentBase === "transients" && base.endsWith(".json"))
```

and add to `scripts/check-npm-packages.mjs`:

```js
const inheritedLists = inst.files.filter((f) => /^skills\/[^/]+\/transients\/.+\.json$/.test(f));
need(inheritedLists.length === 0,
  `c64-re-tools: a derived per-release transient allow-list leaked into the tarball -- ${inheritedLists.join(", ")}`);
```

If the artifact is instead meant to ship as a worked example, then the README's
"this README and nothing else" sentence must be corrected in the same commit,
`danish.json` must be renamed to something a `--allow-list` argument cannot be
pointed at by accident (`danish.example.json`), and `check` should refuse an
allow-list carrying a `release` the caller did not name explicitly.

**Disposition:** **fixed** — `e18e44d`. Took the do-not-ship arm: `danish.json` stays in the repo (33-10's committed evidence, cited by other artifacts) and is excluded from the tarball, which makes the README's existing "this README and nothing else" sentence true rather than editing the sentence to match a leak. `isNonShipping()` is now path-aware — a basename-only predicate cannot express `<skill>/transients/*.json` — and `assertLeanTarball()` asserts it, shaped as "any `.json` under any skill's `transients/`" so the next release's list is covered the day it is derived rather than the day someone widens the pattern. Verified both directions with `npm pack --dry-run --json`: with the rule the tarball carries `transients/README.md` and no `.json`; with it reverted the gate fails naming `danish.json`.

### CR-02: `runReproducible()` certifies a four-term stop identity whose frame term is 0 when the anchor never fired

**File:** `src/mcp/vice/stock-reproducible-run.ts:605-635`

**Issue:** On the hit path the frame term is read unconditionally from the
anchor's `CHECKPOINT_GET`:

```ts
const anchorHitCount = anchorInfo.checkpoint.hitCount;
…
const identity: StopIdentity = { pc, hitCount: anchorHitCount, line, cycle };
```

If the target executes before the frame anchor ever does — entirely reachable:
the anchor is a release-specific once-per-frame site (the module refuses to
guess one precisely because a cracked release may relocate or never reach it),
while the target may be a loader address hit during boot — then
`anchorHitCount === 0` and `wait.anchorHitsObserved === 0`. Nothing checks
either. The answer is emitted with `reproducibleStop: true`, a complete
four-term identity, and `hitCount: 0`.

`compareStopIdentity()` then reports `identical: true, frameTermAsserted: true`
for any two such stops, however many frames apart they are — which is precisely
the confusion the module's own header says the frame term exists to prevent
("two stops one whole frame apart can carry identical `(LIN, CYC)`; `PC` and
`hit_count` are what distinguish them"). The self-check at :620 cannot catch it:
`0` is a finite integer, so `requireTerms()` passes, and comparing a record
against itself is satisfied by any value.

The timeout path is careful here — it emits *no* oracle term rather than
zero-filling, and `stock-reproducible-run.test.ts:512-516` asserts that. The hit
path has no equivalent guard and no test at `anchorHitCount === 0` (the suite's
`greenSendImpl` defaults to `anchorHitCount = 1` and its cases use 1, 3 and 42).

**Fix:** Refuse, in the register the rest of the module uses — a frame term that
counted no frames is not a term:

```ts
const anchorHitCount = anchorInfo.checkpoint.hitCount;
if (anchorHitCount === 0) {
  await deleteCheckpoint(session, anchorCheckpointId);
  return refuse(
    `vice_run_until: the target stopped at ${anchorHex(address)} before the frame anchor at ` +
      `${anchorHex(frameAnchor)} had executed even once, so the frame term is 0 and carries no frame ` +
      `information -- two stops any number of frames apart would both report hit_count 0 and certify as ` +
      `the same stop. Refusing rather than reporting a four-term identity whose frame term is vacuous. ` +
      `Pick a frame_anchor this release reaches BEFORE the target address.`,
  );
}
```

Add the positive control to `stock-reproducible-run.test.ts` beside the existing
`anchorHitCount: 42` case: a `greenSendImpl({ anchorHitCount: 0 })` run must be
an error result, not an answer with `reproducibleStop: true`.

**Disposition:** **fixed** — `edb5d7f`. `anchorHitCount === 0` is now an explicit refusal naming the cause, why 0 is not a term, and the corrective action, following the timeout path's existing precedent of emitting no oracle term rather than zero-filling one. The anchor is deleted before refusing, so no `stop: true` checkpoint is left armed. The test observes the refusal end to end and additionally asserts that neither `"reproducibleStop": true` nor `"hitCount": 0` appears in the output, so a regression fails even if the message is reworded; confirmed red with the guard short-circuited.

## Warnings

### WR-01: The anchor-stopped-first refusal burns the entire deadline instead of returning immediately

**File:** `src/mcp/vice/stock-reproducible-run.ts:257-280`

**Issue:** When the anchor's `CHECKPOINT_INFO` arrives, the listener counts it
and returns, keeping the wait alive:

```ts
if (item.checkpoint.id === anchorCheckpointId) {
  anchorHitsObserved += 1;
  anchorHitCountObserved = item.checkpoint.hitCount;
  return;
}
```

But the anchor is armed `stop: true` (deliberately, `armCheckpoint():315`), and
the procedure sends exactly one `EXIT` and never a second (deliberately, the
module's WHAT NOT TO DO). So once the anchor fires, the machine is halted, no
further instructions execute, and the target's frame can never arrive. The state
is deterministically terminal *and already observed* — yet the code waits out
`timeoutMs`, up to the 600 000 ms ceiling `RUN_UNTIL_MAX_TIMEOUT_MS` allows.
`.mcp.json`'s `timeout: 150000` means the caller's request dies first, so the
carefully written `anchorStoppedFirstNote` explaining the refusal never reaches
the caller on any realistic timeout setting. The tests only see this path
because they pass `timeout_ms: 40`.

**Fix:** Resolve on the first anchor hit, keeping the existing timeout shape so
the answer body is unchanged:

```ts
if (item.checkpoint.id === anchorCheckpointId) {
  anchorHitsObserved += 1;
  anchorHitCountObserved = item.checkpoint.hitCount;
  // The anchor is armed stop:true and this procedure sends exactly ONE resume,
  // so the machine is now halted and the target can never fire. Terminal:
  // settle now rather than waiting out a deadline whose outcome is known.
  resolve({ status: "timeout", anchorHitsObserved, anchorHitCountObserved });
  return;
}
```

**Disposition:** **fixed, with the fix adapted** — `f00446b`. The finding is real and the deadline burn is fixed. The suggested patch was NOT applied as written: resolving on every first anchor hit breaks `frameAnchor === address`, a documented legitimate configuration (step 4 deliberately arms two distinct checkpoints) where both match the same instruction, so one stop emits both frames and the target's arrives from that same stop needing no further execution. An ungated settle would turn that configuration's successful stop into a spurious refusal, so the settle is gated on non-adjacency. One pre-existing test drove a distinct-address anchor frame first and then required a confident stop anyway — not physically realisable with a `stop: true` anchor and one resume, and passing only because the fake emitted both frames back to back regardless of machine state. Restated as the stronger claim that an anchor frame never certifies a stop. T-33-31 untouched: `"hit"` still resolves on the target's id alone.

### WR-02: A resume/wait failure on a live socket leaves the non-temporary, stopping anchor armed

**File:** `src/mcp/vice/stock-reproducible-run.ts:472-482`

**Issue:** The comment justifies taking no cleanup action on this path with a
premise that only holds for one of its causes:

> "a MachineRestartedError (or any other failure) surfacing from the resume/wait
> step propagates straight out, uncaught. … when the machine has restarted, the
> instance and every checkpoint on it are already gone, so there is nothing to
> clean up"

`client.send(CommandType.Exit)` can reject for reasons that are not a restart —
a `StockProtocolError` carrying a non-zero error code from the `EXIT` reply, or
the client's own per-request timeout — with the socket and the instance still
alive. In that case the frame anchor (`temporary: false`, `stop: true`, armed at
a once-per-frame address) is left armed on a live instance. Every subsequent
resume on that session halts within one frame, which is indistinguishable from a
wedge to `vice-wedge-triage` and poisons the instance for every later tool call.

**Fix:** Distinguish the restarted case from the rest, and clean up the anchor
when the instance is still there:

```ts
let wait: ReproducibleWaitOutcome;
try {
  wait = await waitForReproducibleStop(session.client, targetCheckpointId, anchorCheckpointId, timeoutMs);
} catch (err) {
  // Cleanup path 3 of 3. A restarted machine has already taken every
  // checkpoint with it -- nothing to own, nothing to delete. Any OTHER
  // failure leaves this session's non-temporary, stop:true anchor armed on a
  // live instance, which halts every later resume within one frame.
  if (!(err instanceof MachineRestartedError) && session.client.connected) {
    await deleteCheckpoint(session, anchorCheckpointId);
  }
  throw err; // the ONE converter seam still produces the answer
}
```

**Disposition:** **fixed** — `d49a8ce`. Keyed on `client.connected`, the observable that says whether a delete could even be answered, with the error-class test preserving the restarted path exactly as it was. `deleteCheckpoint()` reports dispositions and never throws, so it cannot mask the error, which still propagates uncaught so the one existing converter seam produces the wording. `MachineRestartedError` is imported from `vice.ts` rather than redefined, matching `stock-connect.ts`'s normative "reused — never redefined here". Both directions tested; the live-socket case confirmed red with the condition short-circuited.

### WR-03: `profile` is accepted, recorded on the instance, and silently ignored on the fork backend

**File:** `src/mcp/vice/broker-control.mts:328-352`, `src/mcp/vice/broker-launch.mts:333-341`, `src/mcp/vice/broker-launch.mts:515`, `src/mcp/vice/vice-broker.mts:476-479`

**Issue:** `buildViceArgs`'s profile handling lives entirely inside the `backend
=== "stock"` branch, so on the fork backend `-warp`/`-console` are never
emitted. But nothing on the path refuses or drops the profile:
`normaliseLaunchProfile()` has no backend gate, `handleAcquire` threads it
through unchanged, and `spawnAndRecordInstance():515` mirrors it onto the
`InstanceRecord` regardless of backend. The result on fork is:

- the caller asks for `{warp:true}`, receives a confident grant, and gets an
  unwarped machine — no field in the response says so;
- the record claims `profile: {warp:true}` while its own `viceArgs` contain no
  `-warp`, so `profileEligible()` will later hand that instance to another warp
  request as a match;
- `selectWarmInstance()` skips every profile-less warm instance for no
  behavioural difference at all, forcing a needless dedicated cold launch.

That is the same "undetectable lie" `profileEligible()`'s own banner and `D-16`
are written to exclude, reintroduced one backend over. The fork backend is still
the sole production backend across v0.1.x, so this is the branch most callers
are on.

**Fix:** Refuse at the one narrowing site, which is where the wire boundary
already answers `bad_request`, and pass the backend in:

```ts
// broker-control.mts -- the profile maps to stock-only launch flags. On fork it
// would be accepted and IGNORED while the grant still succeeded and the record
// still claimed it, which is the mismatch D-16 exists to make impossible.
if (backend !== "stock" && (profile.warp === true || profile.headless === true)) {
  return { ok: false, message:
    `profile is stock-only: this broker's backend is "${backend}", whose argv has no -warp/-console route. ` +
    `Refused rather than accepted and ignored.` };
}
```

Alternatively gate the record mirror at `broker-launch.mts:515` on `backend ===
"stock"` so a record can never claim a knob its argv does not carry — but the
refusal is the better answer, because the caller currently has no way to learn
its request was dropped.

**Disposition:** **fixed** — `38b4bb1`, plus `0061337` for test fallout. Refused at the single narrowing site, which is also the wire boundary that already answers `bad_request`, so the caller learns its request was dropped instead of having to infer it; gating the record mirror instead would stop the record lying but leave the caller no way to find out. The refusal lands before `onAcquire`, so no port is allocated, nothing is spawned, and no record is written. Scoped to `=== true`, so an empty `{}` and an explicit `{warp:false}` — which ask for nothing fork cannot deliver — still grant. Follow-up the review did not predict: four pre-existing tests across `broker-control.test.ts` and `vice-broker-client.test.ts` drove profile-bearing acquires against shared fork-backed default `onHostState` stubs, and two of them did worse than fail — the refused acquire waited for a grant that would never come, blocking until the 120 s `CONTROL_ACQUIRE_TIMEOUT_MS`. All four moved to stock stubs; the properties they assert are backend-independent and unchanged.

### WR-04: Prototype-key confusion in three CLI dispatchers; one exits 0 having done nothing

**File:** `src/mcp/vice/fixtures/vsf/make-fixtures.mjs:196-205`, `src/skills/c64-ram-capture/scripts/vsf-slice.mjs:166-187`, `src/skills/c64-ram-capture/scripts/derive-transients.mjs:503-537`

**Issue:** All three dispatch on a plain object literal, so `Object.prototype`
members pass the "is this a known verb / known fixture" test.

`make-fixtures.mjs` is the damaging one — it uses `in`, which walks the
prototype chain:

```js
const unknown = wanted.filter((n) => !(n in FIXTURES));   // 'toString' in FIXTURES === true
…
for (const [name, spec] of Object.entries(FIXTURES).filter(([n]) => wanted.includes(n)))
```

`node make-fixtures.mjs toString` therefore passes validation, matches no entry,
writes nothing, prints nothing, and **exits 0** — a silent pass on a fixture
name that does not exist, in the generator whose whole job is checkable
provenance.

The two skill scripts index rather than use `in`, and their outer `try/catch`
turns the result into exit 1, but the message is wrong and the documented
behaviour is not delivered. Measured on Node 24.20:

```
$ node vsf-slice.mjs constructor
error: The "code" argument must be of type number. Received an instance of Array   (exit 1)
```

`vsf-slice.test.mjs`'s "an unknown verb is answered by THIS script's usage, not
by a subprocess's" therefore holds only for verbs that are not prototype members.

**Fix:** In `make-fixtures.mjs` use own-key membership and refuse the empty
selection:

```js
const unknown = wanted.filter((n) => !Object.hasOwn(FIXTURES, n));
```

In both skill scripts, dispatch off a prototype-less map:

```js
const commands = Object.assign(Object.create(null), { slice: forward, digest: forward });
```

(`derive-transients.mjs` already uses `Object.create(null)` for its flag bag at
:152 — the same idiom, applied one level up.)

**Disposition:** **fixed** — `2a42989`. All three behaviours reproduced first, exactly as measured. `make-fixtures.mjs` now uses `Object.hasOwn`, plus a second guard refusing a selection that matched nothing — "wrote nothing" and "wrote what you asked for" must never share an exit code in a provenance generator. Both skill scripts dispatch off `Object.create(null)`, the idiom `derive-transients.mjs` already used for its flag bag one level down. The pre-existing unknown-verb tests held only for verbs that are not prototype members, so each is now paired with a loop over `constructor`/`toString`/`valueOf`/`hasOwnProperty`/`__proto__`. The generator gains a refusal test that also asserts the four fixtures are byte-unchanged; only the refusal path is driven, since a run with real names would rewrite the committed corpus with a fresh `capturedAt`.

### WR-05: The `CAP-03` import census is blind to a template-literal specifier

**File:** `src/mcp/vice/capture-seam.test.ts:99-115`

**Issue:** The census claims route-completeness across "static and dynamic"
imports, and lists the shapes it covers ("a dynamic `import()`, a bare
side-effect `import "..."`, a `require()` and `process.getBuiltinModule()`").
Its literal scanner only recognises two quote characters:

```ts
return [...code.matchAll(/["']([^"'\n]*)["']/g)]
```

A template-literal specifier is a legal dynamic import and is invisible to it:

```ts
const oracle = await import(`./stop-oracle.ts`);          // census: no hit
const oracle = await import(`./${"stop-oracle"}.ts`);     // census: no hit
```

`isModuleSpecifierShaped()` compounds it by requiring a `/`, so even a quoted
bare specifier would be skipped. This is the one guard standing between the
predicate and the oracle in both directions; a bypass in it produces exactly the
silent pass the test's own header says a comment cannot notice.

**Fix:** Include backticks in the literal scan, and assert the plant:

```ts
return [...code.matchAll(/["'`]([^"'`\n]*)["'`]/g)]
```

Add a planted positive control alongside the existing ones: a copy of
`stop-oracle.ts` carrying `await import(\`./capture-predicate.ts\`)` must make
the census red. If interpolated specifiers are considered out of scope, refuse
them by name instead — an `import(` whose argument starts with a backtick in
either module should fail the test outright rather than be scanned for a
specifier it cannot have.

**Disposition:** **fixed** — `9d2d4c6`. Backticks added to the literal scan; `isModuleSpecifierShaped()` no longer requires a `/`, which compounded the gap by skipping even a quoted bare specifier — a whitespace-free literal carrying a module extension now qualifies, and the extension requirement preserves the property the measured narrowing was protecting; and an interpolated specifier is refused by shape rather than scanned, since it names its target only at runtime and reporting "no hit" would be indistinguishable from a clean module. Two planted positive controls added beside the existing four, both confirmed red against the old scanner.

### WR-06: Three documented commands cannot run from the cwd the skill documents

**File:** `src/skills/c64-ram-capture/SKILL.md:17,33,296,337-338`, `src/skills/c64-ram-capture/templates/capture-record.template.md:17`

**Issue:** `SKILL.md:17` fixes the working directory (`S=src/skills/c64-ram-capture/scripts    # from the repo root`) and every pre-existing command uses the `$S`-derived variables. Three new commands break it, and all three fail rather than misbehave subtly:

- `:33` and `:296` — `node $T derive … --out transients/<id>.json …`. From the
  repo root `transients/` does not exist; `writeFileSync` throws `ENOENT` after
  the derivation has already been computed. (Confirmed: `ls transients` →
  "No such file or directory".)
- `:337-338` — `node scripts/vsf-slice.mjs slice …`. There is no
  `scripts/vsf-slice.mjs` at the repo root; the section also never defines a
  `$S`-style variable for it, unlike every other script in the file.
- `templates/capture-record.template.md:17` repeats the same wrong path inside
  the `capture route` row an operator is meant to copy.

`transients/README.md:37-45` gets this right (`T=src/skills/c64-ram-capture/transients`), which is the wording to propagate.

**Fix:** Add `V=$S/vsf-slice.mjs` and `TD=src/skills/c64-ram-capture/transients`
to the quick-reference block at `:17-21`, then use `node $V slice …` and
`--out $TD/<id>.json` at all four sites, including the template row.

**Disposition:** **fixed, with the template handled differently** — `4c72cd0`. `SKILL.md` gained `V=$S/vsf-slice.mjs` and `TD=src/skills/c64-ram-capture/transients` in the quick-reference block, used at all four sites, plus two new quick-reference lines so the slicer is discoverable where every other script is; `transients/README.md:37-45`'s wording is what was propagated. The template was NOT rewritten as suggested: all five of its `node scripts/…` citations share that shape, only one is phase 33's, and the template states no cwd at all, so `scripts/` there reads naturally as relative to the skill directory. Rewriting one row into a different style would have made it internally inconsistent. The cwd the shorthand is relative to is instead stated once, which resolves the ambiguity for all five and points repo-root callers at the `$S` variables.

### WR-07: `vsf-slice.ts`'s header names an importer that does not exist

**File:** `src/mcp/vice/vsf-slice.ts:411-413`

**Issue:**

> "importing this module still performs no I/O. `capture-predicate.ts` imports
> it, and so does the structural census."

`capture-predicate.ts` imports only `node:crypto` (`:79`). A repo-wide grep
finds no non-test module importing `vsf-slice.ts` at all. In a codebase where
these headers are treated as normative and are cited by other files' comments,
a false statement about the import graph is a live hazard: the entry-point guard
at `:604-612` is justified by "`capture-predicate.ts` imports it", so a future
editor may conclude the guard is exercised by a real importer and relax it.

**Fix:** State what is true — that the module's only non-test consumers today
are its own CLI (invoked by `src/skills/c64-ram-capture/scripts/vsf-slice.mjs`)
and `shippedTsModules()`'s structural census, and that the guard therefore has
to hold for the census alone.

**Disposition:** **fixed** — `4c5797c`. Confirmed independently: `capture-predicate.ts` imports only `node:crypto` and names this module in comments alone, and no non-test module imports `vsf-slice.ts` at all. The correction states what is true and why it matters — the entry-point guard was justified by that false premise, so the comment now records that the guard has to hold for `shippedTsModules()`'s census alone, with the CLI reached as a subprocess rather than an import.

### WR-08: The authoritative capture predicate and the whole launch-profile chain have no production consumer

**File:** `src/mcp/vice/capture-predicate.ts:1-554`, `src/mcp/vice/vice-broker-client.ts:333-372`

**Issue:** Two seams landed with no reachable caller:

- `capture-predicate.ts` — `compareCaptures`, `parseAllowList`, `normalisePorts`,
  `argvDigest`, `formatComparison` — is imported by nothing outside its own
  tests and `derive-transients.test.mjs`. It exposes no CLI, so unlike
  `vsf-slice.ts` there is no route to it from the skill side either. The only
  *runnable* equivalence check in the phase is the deliberate second
  implementation in `derive-transients.mjs`. The module the headers call "the
  authoritative predicate" and "the ONE normalisation site (`D-24`)" is
  therefore authoritative over nothing that executes, and `normalisePorts()` —
  the sole reason `sliceC64Mem()` returns the port bytes at all — is never
  called on a real capture.
- The launch profile threads client → wire → narrowing → eligibility → argv →
  record, with tests at every hop, but no production call site passes one:
  `acquireOverControlPlane()` and `BrokerControlSession.acquire()` are only ever
  invoked without `opts.profile`. `-warp` and `-console` are unreachable in
  production today.

Both are defensible as substrate for a later plan, but neither is marked as
such, and the gap is what makes CR-01's inheritance route matter — the shipped
duplicate is the implementation an operator actually runs.

**Fix:** Either wire them (give `capture-predicate.ts` a CLI region behind the
same `CLI_REGION_BEGIN` marker `vsf-slice.ts` uses, so `derive-transients.mjs`
can forward to it the way `vsf-slice.mjs` does, and add one profile-passing call
site), or record the pending-consumer status in each module header so a later
reader does not read "authoritative" as "in use".

**Disposition:** **accepted** — `d7e6b8f`. An absent consumer is the expected state, not a defect: phase 33 deliberately built the capture substrate ahead of phases 34-38 consuming it, so neither inventing a call site to satisfy a census nor deleting working substrate is correct. This is the review's own recorded-status alternative. What WAS actionable is that neither module was MARKED as pending while `capture-predicate.ts`'s header calls it "the ONE authoritative place" and "the ONE normalisation site (D-24)", which reads as "in use" to anyone who has not grepped. Both headers now record the status: `capture-predicate.ts` restates "authoritative" as a design constraint on future callers and names `normalisePorts()` as never having run against a real capture; `vice-broker-client.ts` records that no production site passes a profile so `-warp`/`-console` are unreachable today, and that the first real consumer must be on stock since WR-03 now refuses the profile on fork. Both paragraphs say what should happen to them when a consumer lands.

### WR-09: Two normative comments in `buildViceArgs()` now contradict each other on `-drive8type` adjacency

**File:** `src/mcp/vice/broker-launch.mts:253-258` vs `:273-291`, `:333-336`

**Issue:** The pre-existing I-2 comment states the rule as a hard constraint:

> "`-drive8type 1541` therefore has to come immediately after `-default`"

The new `-console` block inserts a token between them whenever
`profile.headless` is set, and cites a measurement (`alive=yes bound=1`) as its
justification. That measurement does not cover the property the older comment
exists for: the I-2 finding was that `Drive8Type` silently reverts to 0 (NONE)
while the monitor still binds fine, so `alive`/`bound` cannot distinguish the
good case from the failure it guards against.

I verified the behaviour is in fact correct — launching genuine stock 3.9 with
`-default -console -drive8type 1541 …` and reading `RESOURCE_GET` (0x51) over
the binary monitor returns `Drive8Type = 1541` and `Drive8TrueEmulation = 1`.
So this is a comment defect, not a launch defect; but it is the kind this
codebase pays for, since the next editor reading `:253-258` will find code that
violates it and has to re-derive which comment is authoritative.

**Fix:** Reconcile `:253-258` to say what is actually load-bearing — `-default`
must precede everything it resets, and `-drive8type` must come *after*
`-default` (not immediately after) — and note that the ordering was re-verified
over `RESOURCE_GET` with `-console` interposed, so the citation covers the
resource and not only liveness.

**Disposition:** **fixed** — `31d3643`. Reconciled to what is load-bearing: `-default` precedes everything it resets, and `-drive8type` comes after `-default`, not immediately after. Re-verified live rather than taken from the review, because the `-console` block's `alive=yes bound=1` citation cannot cover I-2's property — its failure mode is `Drive8Type` reverting to 0 (NONE) while the monitor still binds, so liveness cannot distinguish the good case from the failure being guarded against. Probed 2026-09-03 against genuine unpatched stock `/usr/bin/x64sc` (VICE 3.9) with `DISPLAY` and `WAYLAND_DISPLAY` unset: `-default -console -drive8type 1541 <determinism> -binarymonitor` gives `alive=yes bound=1`, `Drive8Type=1541`, `Drive8TrueEmulation=1` read over `RESOURCE_GET` (0x51). Comment defect only; spawned instances reaped, postflight `pgrep` clean.

## Info

### IN-01: The two allow-list parsers disagree on `attribution`

**File:** `src/skills/c64-ram-capture/scripts/derive-transients.mjs:399-435` vs `src/mcp/vice/capture-predicate.ts:318-323`

**Issue:** `parseAllowList()` refuses a non-string `attribution`;
`parseArtifact()` does not check the field at all. A hand-edited artifact with
`"attribution": 5` passes `check` and is refused by the MCP-side predicate — the
two implementations are asserted to agree on *verdicts*
(`derive-transients.test.mjs:366`) but not on parse strictness, which is where a
deliberate duplicate is most likely to drift. `parseArtifact()` also ignores
`schema_version` and the artifact's own `cap` field.

**Fix:** Add the `attribution` type check to `parseArtifact()` and extend the
round-trip test to a malformed-artifact case asserted to be refused by both.

**Disposition:** **fixed** — `f016dc6`. `parseArtifact()` gained the `attribution` type check, and the round-trip test is extended with a malformed-artifact case asserted refused by BOTH implementations and printing no verdict. Parse strictness is where a deliberate duplicate drifts first, because an artifact one accepts and the other rejects is a disagreement about whether the ledger is readable at all.

### IN-02: `vsf-slice.ts`'s `--out` accepts a flag as its value

**File:** `src/mcp/vice/vsf-slice.ts:457-465`

**Issue:** `parseCliArgs()` takes `argv[i + 1]` unconditionally, so
`slice a.vsf --out --json` writes a 64K file literally named `--json` and
silently drops the JSON output the caller asked for. `derive-transients.mjs`'s
parser refuses exactly this (`:172`, "needs a value" when the next token starts
with `--`).

**Fix:** Mirror the sibling's check: `if (value === undefined || value.startsWith("--")) throw new VsfSliceError("vsf-slice: --out needs a path");`

**Disposition:** **fixed** — `9d52cdd`. Mirrors the sibling parser's check, so the two CLIs answer the same mistake the same way. The test asserts no file is written under the flag's own name, not merely that the exit code is non-zero.

### IN-03: A negative `limit` silently means "print everything"

**File:** `src/mcp/vice/capture-predicate.ts:506-513`

**Issue:** `limit > 0 ? rows.slice(0, limit) : rows` treats `-1` as "no limit",
same as `0`. On a not-equivalent verdict that is up to 65 536 formatted rows
into a caller's transcript.

**Fix:** Refuse a negative limit, or document `<= 0` as unlimited in the doc
comment (the parameter is currently documented only by its default).

**Disposition:** **fixed** — `9d52cdd`. Refuses a negative or non-integer limit and documents `0` as unlimited — the parameter previously had no documented semantics beyond its default, which is why "negative means unlimited" was reachable by accident. The test pins both surviving meanings (0 unlimited, positive truncates with the `... N more` tail) alongside the refusals, so the fix cannot be mistaken for a behaviour change.

### IN-04: A malformed allow-list JSON is reported without the path

**File:** `src/skills/c64-ram-capture/scripts/derive-transients.mjs:484`

**Issue:** `JSON.parse(readFileSync(listPath, "utf8"))` sits outside
`parseArtifact()`, so a syntax error surfaces through the outer catch as
`error: Unexpected token …` with no mention of which file was being read —
unlike every other refusal in the script, which names the path.

**Fix:** Wrap the parse and name the file:
`try { json = JSON.parse(...) } catch (e) { throw new Error(\`${listPath}: not valid JSON -- ${e.message}\`) }`

**Disposition:** **fixed** — `f016dc6`. Parse wrapped and the file named. On a route whose whole subject is which artifact says what, which file failed to parse is the first thing an operator needs.

---

_Reviewed: 2026-09-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
