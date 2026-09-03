# 34-transport-cap — the inline line cap, observed red against the real listener

**Owner:** plan `34-02`. **Measured:** 2026-09-03, on this host, against the real
`startControlListener()` in `src/mcp/vice/broker-control.mts` at HEAD. No VICE instance, no
broker process, and no network beyond loopback were needed for anything below.

This is the transcript SEAM-03 and ROADMAP success criterion 2 ask for: the >64 KiB inline
disconnect, produced against the real listener rather than read out of source, plus the
exact boundary one step either side.

---

## Provenance

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc || echo "(no output)"
(no output)
```

BROKER_STATE: inactive

TEST_AUTOMATED_BASELINE (measured this session, `cd src/mcp/vice && npm run test:automated`,
broker stopped): 2 failing tests in 1 file (`anno-register.test.ts` — "DIRECTION 5 (basis
integrity)" and "planted violation (the negative control)"), unchanged before and after this
plan's own commits. Cause: three register entries cite `STORE-01`, `STORE-06` and `MCP-04`,
which are not declared in `.planning/REQUIREMENTS.md` — recorded as a pre-existing baseline,
not this plan's own defect.

---

## The probe run

```
$ node .planning/phases/34-the-host-tool-execution-seam/evidence/64k-cap-probe.mjs
PROBE_LISTENING port=35757
PROBE_CONNECTED
PROBE_LINE_BYTES=70050
PROBE_CLOSE hadError=false gotData=false
PROBE_BOUNDARY_AT_CAP hadError=false gotData=false closed=false
PROBE_BOUNDARY_OVER_CAP hadError=false gotData=false closed=true
```

**Primary observation** (34-RESEARCH.md Finding 1's own byte count, reproduced exactly): a
single JSON line of 70050 bytes with NO trailing newline, dialed against the real listener,
produces a bare disconnect — `close` fires with `hadError=false`, and the client receives
**zero bytes** of any kind. No error frame, no `bad_request` frame, no partial JSON — nothing
at all crosses the socket before the destroy.

**Boundary, exact.** `PROBE_BOUNDARY_AT_CAP closed=false`: a line of exactly the cap's own
byte count (read from `broker-control.mts`'s own source text — `MAX_LINE_BYTES = 65536` at
the time of this run — never hand-copied as a literal into either the probe or its automated
counterpart) is **not** destroyed; the connection is still open at the end of the probe's
bounded wait. `PROBE_BOUNDARY_OVER_CAP closed=true`: one byte more than the cap **is**
destroyed, with the same `hadError=false gotData=false` signature as the primary
observation. The boundary is exact to the byte.

Full command-line verification, exactly as `34-02-PLAN.md`'s own `<verify>` block specifies:

```
$ E=.planning/phases/34-the-host-tool-execution-seam/evidence
$ node --check "$E/64k-cap-probe.mjs" && node "$E/64k-cap-probe.mjs" > /tmp/probe-out.txt \
    && grep -q 'PROBE_CLOSE hadError=false gotData=false' /tmp/probe-out.txt \
    && grep -q 'PROBE_BOUNDARY_AT_CAP' /tmp/probe-out.txt \
    && grep -q 'PROBE_BOUNDARY_OVER_CAP' /tmp/probe-out.txt \
    && echo PROBE_RUNS_RED
PROBE_LISTENING port=41802
PROBE_CONNECTED
PROBE_LINE_BYTES=70050
PROBE_CLOSE hadError=false gotData=false
PROBE_BOUNDARY_AT_CAP hadError=false gotData=false closed=false
PROBE_BOUNDARY_OVER_CAP hadError=false gotData=false closed=true
PROBE_RUNS_RED
```

---

## Verdicts

INLINE_OVER_CAP_CONTROL: red

Derived exactly as SEAM-03 requires it: a bare disconnect (`close`, `hadError=false`) with
zero response bytes of any kind, produced against the real, unmocked `startControlListener()`
— not asserted from reading `broker-control.mts:266,474-480`, but actually dialed and
observed, matching 34-RESEARCH.md Finding 1's own transcript byte-for-byte
(`PROBE_LINE_BYTES=70050`, `PROBE_CLOSE hadError=false gotData=false`).

BOUNDARY_CONTROL: exact

A line of exactly the cap's own byte count survives (`closed=false`) and a line one byte over
it does not (`closed=true`), with the cap value read out of `broker-control.mts`'s own source
text at run time rather than hand-copied into this probe or into its automated counterpart —
so a future change to the constant cannot leave either side of this file's own claim stale.

---

## TEST_COUNTERPART

TEST_COUNTERPART: `src/mcp/vice/host-tool-transport.test.ts` asserts the identical
observations this transcript records, against the same real `startControlListener()`, as
automated `node --test` cases:

- `"a 70050-byte inline line (34-RESEARCH.md Finding 1's own observed byte count), no
  trailing newline, sent to the real listener: the connection is destroyed with
  hadError=false and zero response bytes of any kind"` — the primary observation above.
- `` `a line of exactly the cap's own byte count (${CAP}), no trailing newline, is NOT
  destroyed -- the connection stays open for at least a short bounded wait` `` — the
  `PROBE_BOUNDARY_AT_CAP` observation above.
- `` `a line of the cap's own byte count plus one, no trailing newline, IS destroyed:
  hadError=false and zero response bytes` `` — the `PROBE_BOUNDARY_OVER_CAP` observation
  above.
- `"a line whose JavaScript .length is below the cap but whose UTF-8 byte length is above it
  IS destroyed -- the cap is bytes, not characters"` — the byte-vs-character contract this
  transcript's own boundary observations depend on holding in general, not only at the
  exact byte counts probed here.

Additionally, `host-tool-transport.test.ts` asserts the host_tool result-by-reference shape
(`{ path, sha256, byteLength }`, and only those three keys) by recursive key enumeration,
including the zero-byte-result edge case and two overlapping requests over the real control
plane — the constraint this transcript's own closing paragraph explains the reasoning for.

---

## Why this makes SEAM-03 a contract, not a workaround

A real reverse-engineering artifact from this project's own later phases — a Ghidra export,
a depacked flat 64K capture — runs to hundreds of kilobytes or megabytes. The inline line cap
measured above is 64 KiB. If a host-tool response ever carried its result as inline bytes on
this same control-plane socket instead of a `{ path, sha256, byteLength }` reference, any
result larger than the cap would not fail loudly with a decodable error the caller could
retry against — it would fail exactly the way this transcript shows: a bare TCP disconnect,
zero response bytes, no error frame, indistinguishable from a hang or a crash. That failure
mode would not surface during small-fixture testing (a two-line diagnostic response fits
comfortably under 64 KiB) and would only appear in production, at scale, on precisely the
artifacts this project's whole reverse-engineering purpose produces. Observing the cap red
against the real listener, at the exact boundary, is what turns "return paths, not payloads"
from a preference this project happens to follow into a constraint a future change cannot
silently violate without a committed test going red first.
