---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
reviewed: 2026-09-09T10:19:03Z
depth: standard
files_reviewed: 57
files_reviewed_list:
  - CLAUDE.md
  - docs/phase41-text-channel-live-evidence.md
  - docs/tool-support.md
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-e2e.test.ts
  - src/mcp/vice/broker-kill.mts
  - src/mcp/vice/broker-kill.test.ts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/broker-launch.test.ts
  - src/mcp/vice/broker-state.mts
  - src/mcp/vice/broker-state.test.ts
  - src/mcp/vice/capability-registry.test.ts
  - src/mcp/vice/capability-registry.ts
  - src/mcp/vice/channel-lock.test.ts
  - src/mcp/vice/channel-lock.ts
  - src/mcp/vice/docs-linerefs.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-tool.mts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/host-tool-transport.test.ts
  - src/mcp/vice/install-resources.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-kill.mjs
  - src/mcp/vice/resources/broker-launch.mjs
  - src/mcp/vice/resources/broker-state.mjs
  - src/mcp/vice/resources/host-tool.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-a4-checkpoint-flood.test.ts
  - src/mcp/vice/stock-broker-live.test.ts
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-derived.test.ts
  - src/mcp/vice/stock-derived.ts
  - src/mcp/vice/stock-diagnose.test.ts
  - src/mcp/vice/stock-diagnose.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/stock-live-broker-monitor.test.ts
  - src/mcp/vice/test-gate.mjs
  - src/mcp/vice/test-gate.test.ts
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/text-connect.ts
  - src/mcp/vice/text-monitor-live.test.ts
  - src/mcp/vice/text-protocol.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/tools-manifest.stock.json
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-supervision.test.ts
  - src/mcp/vice/vice-proxy.ts
  - src/skills/vice-wedge-triage/SKILL.md
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-09-09T10:19:03Z
**Depth:** standard
**Files Reviewed:** 57 (files actually authored/changed in this phase's diff, cross-referenced against the full required-reading set)
**Status:** issues_found

## Summary

This phase adds a second emulator-control surface (VICE's `-remotemonitor` text channel) alongside the existing binary monitor, plus `channel-lock.ts`, a hand-built cross-channel mutex that serializes halt authority between the two. I read the new/changed surface (`channel-lock.ts`, `text-protocol.ts`, `text-connect.ts`, `text-tools.ts`) in full, diffed and read the changed portions of `broker-launch.mts`, `broker-control.mts`, `vice-broker.mts`, `vice-broker-client.ts`, `stock-dispatch.ts`, `stock-diagnose.ts`, `stock-connect.ts`, `vice-proxy.ts`, `host-tool.mts`, `install-resources.ts`, and `broker-kill.mts`, and cross-checked the manifest/docs/capability-registry entries for the two new tools against their implementations. I ran the relevant test files (`channel-lock`, `text-protocol`, `text-connect`, `text-tools`, `stock-dispatch`, `stock-diagnose`, `broker-launch`, `broker-control`, `docs-linerefs`, `hostpath-consumers`, `capability-registry`, `resources-sync`) — all 557+ assertions across those files pass.

Overall this is unusually well-defended code: every acquire/release pairing I traced is wrapped in `finally`, the mutex identity-checks stale handles, the "fail the whole acquire rather than degrade" discipline around the mandatory text port is enforced at the one construction site and has a dedicated failure-path test, and the priority areas named in the review brief (`channel-lock.ts` acquisition/release, `text-protocol.ts`'s framing, `text-tools.ts`'s lock lifecycle, `broker-launch.mts`'s second-port failure path, `stock-diagnose.ts`'s contention guard) all held up under inspection and under the existing test suite. I found one genuine correctness gap (WARNING) in `text-protocol.ts`'s passive banner-drain path, and two INFO-level observations. No BLOCKER-level issues found.

## Warnings

### WR-01: Passive banner drain bypasses the quiescence-window protection that the same class treats as load-bearing for command responses

**File:** `src/mcp/vice/text-protocol.ts:473-489` (the `!this.#pending` branch of `#onData()`)

**Issue:** `TextMonitorClient`'s own header comment and `TEXT_QUIESCENCE_MS`'s doc comment both state, as a hard invariant, that a tail match against `PROMPT_RE` must survive a quiescence window before being accepted as the real terminator — otherwise "prompt-shaped text occurring mid-stream" (Control 2) can be mistaken for the end of the response, per the module's own explicit "never a guess" framing at the top of the file (lines 54-57). This protection is applied when a command is outstanding (lines 491-501: a tail match arms `#quiescenceTimer` and only resolves via `#finishPending()` after the window elapses with no further bytes), but it is **not** applied to the passive banner-drain path (D-13(b), lines 473-489): the moment `bufferEndsWithPrompt(this.#buffer)` is true with no command pending, the buffer is drained, counted, and emitted immediately — no quiescence timer is armed at all.

The comment directly above this branch names the concrete real-world source of these passive bytes: "a passively-arriving banner (e.g. a binary-owned checkpoint-hit notification pushed to this same text console)". Checkpoint-hit / `BREAK:` notification text is exactly the kind of monitor output that can legitimately contain a `(C:$xxxx) ` shaped substring before its own real trailing prompt (the same shape Control 2's fixture already demonstrates for the command-response path, at `text-protocol.test.ts:226-273`). If that happens on the banner-drain path:

1. The buffer is prematurely reset to empty at the false match, splitting one logical banner into two `banner` events (the second carrying only the tail of the real notification).
2. Worse, if a real command is issued (via `withTextChannelLock()`) in the narrow window between the false match and the arrival of the banner's true remaining bytes, those trailing bytes land in `#onData()` while `this.#pending` is now set, and get silently concatenated into what the client treats as the *command's own* response buffer — corrupting `vice_device_console`'s or `vice_warp_set`'s reported `response` text with residue from an unrelated, earlier notification.

This is a narrower and more forgiving discipline than the one the module explicitly claims to enforce everywhere else in its own header ("A response that cannot be honestly framed refuses by name ... never a guess"). The existing D-13(b) test (`text-protocol.test.ts:277-301`) only exercises a banner delivered as a single, cleanly-terminated chunk, so it does not exercise this gap.

**Fix:** Route the banner-drain branch through the same `#quiescenceTimer` arm/finalize discipline the pending-command branch already uses, with a small helper (e.g. `#finishBanner()`) mirroring `#finishPending()`, so both paths agree that a tail match must survive `TEXT_QUIESCENCE_MS` before being treated as final:

```ts
if (!this.#pending) {
  if (bufferEndsWithPrompt(this.#buffer)) {
    this.#quiescenceTimer = setTimeout(() => {
      this.#quiescenceTimer = null;
      this.#finishBanner();
    }, this.#quiescenceMs);
    if (typeof this.#quiescenceTimer.unref === "function") this.#quiescenceTimer.unref();
    return;
  }
  this.#checkCap();
  return;
}
```

with `#finishBanner()` performing the same drain/count/emit `#finishPending()`'s banner-branch used to do inline. Add a test mirroring Control 2 but for the no-command-outstanding case (prompt-shaped text embedded mid-banner, followed by the banner's real tail) to lock the fix in.

## Info

### IN-01: `desync` event on `TextMonitorClient` has no production listener

**File:** `src/mcp/vice/text-protocol.ts:538-542` (`#checkCap()`, the no-`pending` branch)

**Issue:** When `TEXT_MAX_BUFFERED_LEN` is exceeded while draining a banner (no command outstanding), the client emits `"desync"` rather than rejecting a pending promise. Neither `text-connect.ts` nor `text-tools.ts` (the only two production consumers of `TextMonitorClient` today) attach a `"desync"` listener, so this failure mode is currently silent outside of tests (`Buffer` is dropped, a `TextFramingError` is constructed, but nothing observes it). This mirrors `stock-protocol.ts`'s own `"desync"` convention deliberately, and `EventEmitter` does not throw for an unlistened non-`"error"` event, so this is not a crash risk — it is a diagnosability gap: a genuinely desynced text channel (accumulating >4MiB with no prompt, while idle) currently produces no operator-visible signal at all until the next real command is issued against it.

**Fix:** Either wire a `console.error`-based default listener in `text-connect.ts`'s `textConnect()` (mirroring the stub pattern already used for the `transport-error`/`close` posture elsewhere in this tree), or note explicitly in the module header that `"desync"` is currently unconsumed by design pending a future plan that exposes the banner stream to a caller.

### IN-02: `spawnAndRecordInstance()`'s D-16 stock-record invariant guard is unreachable from any current production call site

**File:** `src/mcp/vice/broker-launch.mts:474-478`

**Issue:** The `if (backend === "stock" && deps.remoteMonitorPort === undefined) throw ...` guard is described in its own comment as defending against "a call site that bypassed that guarantee" — but `superviseChild()` (the one function that can reach `spawnAndRecordInstance()` with `backend: "stock"` and an omitted `remoteMonitorPort`, per its own doc comment at lines 1636-1647) states plainly that this is "not a production stock first-launch path today (only `acquirePortAndLaunch()` is) — it exists for this module's own unit tests to drive a supervised first launch directly". This is not a bug (the guard is legitimate defense-in-depth against a future caller), but it is worth flagging so a future editor who adds a second production caller of `superviseChild()` for `backend: "stock"` (e.g. a future manual "start supervised instance" entry point) knows they must thread `remoteMonitorPort` through from their own allocation, or they will trip this throw at runtime rather than at review time.

**Fix:** No code change required. Consider a one-line note at `superviseChild()`'s call-site type (or a lint/test guard analogous to the existing structural tests in this file) if a second production caller is ever added, so the D-16 invariant is verified before the caller ships rather than discovered by the throw.

---

_Reviewed: 2026-09-09T10:19:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
