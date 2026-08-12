---
phase: 01-corrected-ground-truth
reviewed: 2026-08-12T15:57:05Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .claude/mcp/vice/probe-binmon.mjs
  - .claude/mcp/vice/containerpath.test.ts
  - .claude/mcp/vice/install-resources.test.ts
  - .claude/mcp/vice/vice-broker-client.test.ts
  - .claude/mcp/vice/vice-broker-launch.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-12T15:57:05Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

`probe-binmon.mjs` correctly implements the normative wire format (11-byte
request / 12-byte response header, all-LE fields, five event types keyed on
request-id `0xffffffff`, JAM's zero-length body). The `--selftest` mode and
its builders/parsers check out against the layouts in `docs/phase0-binmon-findings.md`
and `01-PATTERNS.md`, and the real recorded run (`docs/phase1-probe-results.md`)
corroborates the framing/demux logic holds up even under an 18-frame
`CHECKPOINT_INFO` burst on the fork build.

Two classes of real defects were found, both tracing to the same root
cause — **checkpoint/condition cleanup that is not exception-safe** — and a
**diagnostic mislabeling bug that has already corrupted the checked-in
ground-truth record** (`docs/phase1-probe-results.md` contains fabricated "PC="
values for every `CHECKPOINT_INFO`/`REGISTER_INFO` event in both raw
transcripts). The four test-file diffs are sound: each replaces an
environment-coupled assertion (devcontainer-only exit codes, a hardcoded
directory-depth constant, a `notEqual` that only held by accident) with one
that is still guard-removal-sensitive and now portable to a bare host.

## Critical Issues

### CR-01: Check 10's checkpoint cleanup is not exception-safe — a leaked, enabled, full-range `stop=1` checkpoint can keep re-firing after any later command in the check throws

**File:** `.claude/mcp/vice/probe-binmon.mjs:677-713`

**Issue:** Check 10 creates a `$0000`-`$FFFF`, `stop=1`, non-temporary exec
checkpoint (line 678-679), then — still inside the *same* `try` — sets two
conditions (687-688), relaxes to `(RL == $64)` (697), calls `EXIT` to resume
the machine (698), waits 500 ms, and only *then* calls `CHECKPOINT_GET` (700)
followed by `CHECKPOINT_DELETE` (709). If **any** call after `EXIT` throws —
most obviously `CHECKPOINT_GET` timing out, which is exactly what the fork
run hit (`docs/phase1-probe-results.md:285`, "`FAILED (timeout waiting for
response to cmd 0x11)`") — control jumps straight to the `catch` at
711-713, which only logs `FAILED` and never runs the delete at line 709. The
checkpoint that was made *enabled* and resumed via `EXIT` at that point is a
full-address-range, `stop=1` exec breakpoint: once leaked, it will refire on
essentially the very next instruction the CPU executes, for the remainder of
the connection. This is consistent with the observed fork-build outcome: after
check 10's timeout, checks 11 (`RESOURCE_GET`, line 717), 12
(`ADVANCE_INSTRUCTIONS`, line 754) and 13 all timed out too
(`docs/phase1-probe-results.md:286-288`), and the operator had to kill both
the probe process and the target `x64sc` process by PID
(`docs/phase1-probe-results.md:307-311`). The code's own comment at
708 ("cleanup: conditions cannot be read back or cleared and leak with their
checkpoint, so delete it now before any later check runs") states the
invariant this bug violates.

**Fix:** Delete the checkpoint in a `finally`, independent of whether the
fire-test steps succeeded:
```js
let cpNum = null;
try {
  const rSet = await mon.send(CMD.CHECKPOINT_SET, fullRange);
  if (rSet.errCode !== 0x00) {
    console.log(`10. RL/CY CONDITION -> CHECKPOINT_SET FAILED (${ERR_NAME[rSet.errCode] || rSet.errCode})`);
  } else {
    cpNum = parseCheckpointInfo(rSet.body).checkpointNum;
    // ... conditions, EXIT, sleep, CHECKPOINT_GET, as today ...
  }
} catch (e) {
  console.log(`10. RL/CY CONDITION -> FAILED (${e.message})`);
} finally {
  if (cpNum !== null) {
    try {
      await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(cpNum));
    } catch { /* best effort: connection may already be wedged */ }
  }
}
```

## Warnings

### WR-01: Async-event handler reinterprets `CHECKPOINT_INFO`/`REGISTER_INFO` bodies as a 2-byte PC, producing fabricated data already baked into `docs/phase1-probe-results.md`

**File:** `.claude/mcp/vice/probe-binmon.mjs:119-127`

**Issue:** The generic event branch does:
```js
const pc = body.length >= 2 ? body.readUInt16LE(0) : null;
```
for **every** unsolicited event, regardless of `respType`. This is correct
for `STOPPED`/`RESUMED` (body = 2-byte PC per `docs/phase0-binmon-findings.md`
§4) and correctly falls back to `null` for `JAM`'s zero-length body — but
`CHECKPOINT_INFO` (0x11) and `REGISTER_INFO` (0x31) bodies are entirely
different structures (`parseCheckpointInfo` starts with a 4-byte
`checkpointNum`; `REGISTER_INFO`'s body is a register-count-prefixed list).
Reading their first two bytes as a "PC" produces a plausible-looking but
meaningless value. This already happened for real: both raw transcripts in
`docs/phase1-probe-results.md` show `REGISTER_INFO PC=$000a` verbatim dozens
of times and `CHECKPOINT_INFO PC=$0001` on every one of the fork's 18 flood
events (lines 179, 187, 195, ..., 267-284) — `$000a`/`$0001` are the low 16
bits of unrelated fields (a register-block size / the checkpoint number),
not a program counter. This is now permanently recorded in the project's
checked-in ground-truth artifact as if it were real telemetry.

**Fix:**
```js
if (reqId === EVENT_ID) {
  const name = RESP_NAME[respType] || `0x${respType.toString(16)}`;
  const pc = (respType === 0x62 || respType === 0x63) && body.length >= 2
    ? body.readUInt16LE(0)
    : null; // CHECKPOINT_INFO/REGISTER_INFO/JAM bodies are not PC-shaped
  this.events.push({ name, pc });
  ...
}
```

### WR-02: Check 9's checkpoint cleanup is likewise not exception-safe

**File:** `.claude/mcp/vice/probe-binmon.mjs:646-673`

**Issue:** If the second `CHECKPOINT_SET` call (`r9`, line 661) throws, the
`cpNum8` checkpoint created at line 648 is never deleted (the deletes at
669-670 sit after the point of failure, inside the same `try`), contradicting
the comment at 645 ("both are deleted immediately so nothing leaks into
later checks"). Lower impact than CR-01 since both checkpoints here are
created `enabled: 0` — a leaked one is inert, just an orphaned entry in the
target's checkpoint table for the rest of the session — but it is the same
missing-`finally` pattern and should be fixed the same way.

**Fix:** Track both `cpNum8`/`cpNum9` outside the try and delete whichever
were created in a `finally`, mirroring CR-01's fix.

### WR-03: Check 13's catch block blames the destructive write for failures that occur before the write is even attempted

**File:** `.claude/mcp/vice/probe-binmon.mjs:776-815`

**Issue:** The `else` branch (782-808) issues a baseline `MEM_GET` (783),
then the destructive `MEM_SET` (786), then a verification `MEM_GET` (794) —
all inside one `try` whose `catch` (810-814) unconditionally prints "`the
drive-ROM write crashed or hung the target ... this IS the answer to
UNVERIFIED item 3, not a probe defect`" and records
`results.driveRomWrite = "crashed-or-hung"`. If the **baseline** read at 783
throws (e.g. a transient timeout, or fallout from an earlier check's
lingering checkpoint per CR-01) — before any byte has been written — this
still gets attributed to "the drive-ROM write crashed the target," corrupting
the causal claim this check exists to establish for UNVERIFIED item 3.

**Fix:** Isolate the baseline read from the destructive write/verify so a
pre-write failure is distinguishable:
```js
const before = await mon.send(CMD.MEM_GET, memGetBody({ start: 0xc000, end: 0xc000, memspace: 0x01 }));
const beforeByte = before.body.subarray(2, 2 + before.body.readUInt16LE(0))[0];
try {
  const setR = await mon.send(CMD.MEM_SET, memSetBody({ ... }));
  ... // write + verify only, inside this try
} catch (e) {
  console.log(`13. MEM_SET drive ROM -> the write itself crashed or hung the target (${e.message})`);
  results.driveRomWrite = "crashed-or-hung";
}
```

### WR-04: `_onData`'s frame loop has no bound on a corrupted `bodyLen`, so a bogus header can stall all further parsing without any resync

**File:** `.claude/mcp/vice/probe-binmon.mjs:100-134`

**Issue:** `bodyLen = this.buf.readUInt32LE(2)` is trusted unconditionally
once `this.buf[0] === STX` (109); `total = 12 + bodyLen` (110) is then used
as the "wait for more bytes" threshold (111). If the byte at offset 0
happens to be `0x02` but is not actually the start of a real frame (e.g. a
`0x02` byte inside some earlier body content, reached only if the stream was
already desynced by one byte for any reason), `bodyLen` can be read as an
arbitrarily large 32-bit value. The loop then `break`s forever waiting for
`total` bytes that will never arrive, and every subsequent legitimately
framed response sits queued behind that stuck cursor — `pending` sends time
out one by one with no diagnostic pointing at the real cause (buffer
desync), and the one-byte resync at 104-108 never gets a chance to run
because the `while` loop never gets back to evaluating `this.buf[0]` at the
now-wrong offset. This is a latent robustness gap, not observed in either
recorded run, but it is exactly the class of issue the demux is supposed to
be resilient to given the fork's own propensity for unusual event bursts.

**Fix:** Cap `bodyLen` at a sane maximum (e.g. the largest expected
`DISPLAY_GET` frame) and fall back to the one-byte resync path if exceeded,
rather than trusting an arbitrary 32-bit length unconditionally.

## Info

### IN-01: Check 8's hardcoded `(4,4)` sample coordinate reliably lands outside the visible border and prints an uncaveated `MISMATCH`

**File:** `.claude/mcp/vice/probe-binmon.mjs:624-630`

**Issue:** `disp.buffer[4 * disp.dw + 4]` samples the debug frame at a fixed
`(4,4)`. Given the reported `xo=136, yo=51` (both recorded runs), this pixel
is in pre-visible blanking padding, not the rendered border — both runs print
`MISMATCH` (`docs/phase1-probe-results.md:192, 256`). `01-04-SUMMARY.md`
already diagnoses this as a probe-coordinate issue rather than a
`PALETTE_GET`/`DISPLAY_GET` fault, but that context lives only in planning
docs, not in the script: a future run of the bare probe reproduces the same
uncaveated `MISMATCH` line with nothing telling the reader it's expected.
The centre-pixel check two lines below (633-636) already carries exactly
this kind of caveat ("informational only; may land on a glyph") — the border
check has none.

**Fix:** Sample at `(xo + n, yo + n)` for a small `n` instead of the fixed
`(4, 4)`, or at minimum add the same kind of caveat to the border line's
console output.

### IN-02: `vice-broker-launch.test.ts`'s stub binary directory is never removed

**File:** `.claude/mcp/vice/vice-broker-launch.test.ts:68-70`

**Issue:** `STUB_DIR` is created once at module load via `mkdtempSync` and
the stub script written into it, but unlike every `deployDir` in this file
(each cleaned up with `rmSync` in a `finally`), `STUB_DIR` has no matching
cleanup anywhere in the file. Harmless functionally, but it leaves a
`vice-broker-launch-stubbin-*` directory under the OS tmpdir after every test
run.

**Fix:** Register a `process.on("exit", ...)` cleanup or an equivalent
`after()` hook to `rmSync(STUB_DIR, { recursive: true, force: true })`.

### IN-03: `probe-binmon.mjs`'s connect-timeout path does not tear down the socket

**File:** `.claude/mcp/vice/probe-binmon.mjs:469-473`

**Issue:** On a connect timeout, the promise rejects but the underlying
`net.Socket` returned by `net.createConnection` is never `.destroy()`ed, and
the `"error"` listener registered for the connect race stays attached. In
this script `main().catch()` calls `process.exit(1)` immediately afterward,
so it's not currently observable, but if this connect logic is ever reused
in a longer-lived context (e.g. lifted into a shared module) the dangling
socket/listener would leak.

**Fix:** `s.destroy()` inside the timeout callback before rejecting.

---

_Reviewed: 2026-08-12T15:57:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
