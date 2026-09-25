---
phase: 65-every-skill-script-through-the-one-endpoint-and-ci-with-it
plan: 01
subsystem: infra
tags: [broker, endpoint, host-tool, transfer, acme, seam-01, seam-03]

requires:
  - phase: 64-files-as-bytes-both-directions
    provides: broker-transfer.mts's staging primitives (stageFileSlot/resolveStagedFile/clearStagingForSession), broker-endpoint.ts's dialFileTransfer()/awaitTransferComplete(), and transfer-paths.ts's validateContainedDestination()
provides:
  - runHostToolOverEndpoint() (host-tool-endpoint.mts) -- one file in, one result back, through the fixed endpoint, with no shared filesystem
  - host_tool_stage/host_tool_run wire ops (broker-control.mts), answered ahead of the token gate, bound to their own connection
  - dialHostToolSession() (broker-endpoint.ts) -- the one dialer for a host-tool session connection
  - transfer-client.mts -- transferFileOverEndpoint() (moved from stock-connect.ts) and validateContainedDestination() (moved from transfer-paths.ts), both re-exported unchanged from their prior homes
  - broker-harness.ts -- a test-only real-broker harness (startHarnessBroker())
affects: [65-02, 65-03, 65-04, 65-05, 66-*]

actuals:
  tokens: 50000
  tasks: 2
  commits: 2
  plan_head_before: c906ae7d9954c06a69a4859cfd0feb4dc259c93a

tech-stack:
  added: []
  patterns:
    - "Fixed-endpoint session dialer with multiple JSON-line round trips over one kept-alive socket (dialHostToolSession()'s stage()/run()), a plain string accumulator rather than performAttach()/performTransfer()'s byte-level terminator search, because neither reply carries a trailing binary payload."
    - "Request-scoped broker scratch root, passed as HostToolDeps.repoRoot, so every path a host tool resolves is confined to <brokerStagingDir()>/<requestKey>/ rather than the broker's own --repo-root."

key-files:
  created:
    - src/mcp/vice/host-tool-endpoint.mts
    - src/mcp/vice/transfer-client.mts
    - src/mcp/vice/broker-harness.ts
    - src/mcp/vice/host-tool-endpoint.test.ts
  modified:
    - src/mcp/vice/broker-transfer.mts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/broker-endpoint.ts
    - src/mcp/vice/stock-connect.ts
    - src/mcp/vice/transfer-paths.ts
    - src/mcp/vice/host-tool-client.ts
    - src/mcp/vice/package.json
    - src/mcp/vice/hostpath-consumers.test.ts
    - .planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/evidence/phase58-declaration-provenance.md
    - .planning/phases/59-the-tool-location-seam-and-its-precedence-order/evidence/phase59-tool-location-placement.md

key-decisions:
  - "Wire vocabulary: two NEW literals, host_tool_stage and host_tool_run, answered ahead of the token gate; the legacy host_tool arm is untouched, no field-discriminator on the old literal (per the plan's own Discretion item)."
  - "The handle-mint (host_tool_stage) is session-free and runs on the SAME connection as host_tool_run; the byte-moving transfer op is reused unchanged for both directions."
  - "Staging lifetime is per-connection: the request key is bound to the connection that ran host_tool_stage, and that connection's close is the end of the request -- reuses broker-transfer.mts's existing clearStagingForSession()."
  - "bindStagedInputs() (host-tool.mts) refuses outDir/sourceDir/includes/scriptPath/exportPath by name on the endpoint route rather than binding them -- results land under the client's own toolsRoot/<kind>/ instead of a broker-chosen directory."

patterns-established:
  - "A host-tool session connection carries multiple JSON-line round trips (stage then run) rather than one request/response pair or a permanent splice -- a third connection shape alongside the existing hello-race-then-one-line (transfer) and hello-race-then-splice (attach) shapes."

requirements-completed: [SEAM-01, SEAM-03]

coverage:
  - id: D1
    description: "acme.build runs through the fixed endpoint end to end: source uploaded as bytes, broker assembles its own scratch copy, .prg downloaded as bytes and written under the caller's toolsRoot/builds/, request scratch removed on connection close"
    requirement: SEAM-01
    verification:
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Task 1: acme.build runs through the fixed endpoint, one file in, one result back"
        status: pass
    human_judgment: false
  - id: D2
    description: "The new host_tool_stage/host_tool_run ops coexist with the legacy token-gated host_tool op without shadowing or weakening it"
    requirement: SEAM-03
    verification:
      - kind: integration
        ref: "broker-control.test.ts#Test 1: a host_tool line with no token answers unauthorized and destroys the connection; the same line with the real token reaches onHostTool -- the legacy op is unchanged"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#Test 2: host_tool_stage and host_tool_run sent with no token are answered (not unauthorized), proving they sit ahead of the gate"
        status: pass
    human_judgment: false
  - id: D3
    description: "A request key is bound to the connection that staged it: no prior stage, or a key minted on another connection, is refused denied"
    requirement: SEAM-01
    verification:
      - kind: integration
        ref: "broker-control.test.ts#Test 3: host_tool_run on a fresh connection with no prior stage answers denied; a request minted on connection A is refused denied when presented on connection B"
        status: pass
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Test 8: two concurrent host-tool connections receive distinct request keys, and each connection's host_tool_run refuses the other's key"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-request staging lifetime: closing the host-tool connection removes the request's scratch directory and every staging registry entry keyed to it"
    requirement: SEAM-01
    verification:
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Test 7: closing the host-tool connection after a successful stage removes the request's own staging directory, and the minted handle then answers unknown transfer handle"
        status: pass
    human_judgment: false
  - id: D5
    description: "An upload whose transfer line declares a byteLength different from the stage manifest's declared byteLength is refused before a payload byte is written (D-11)"
    requirement: SEAM-01
    verification:
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Test 6: through the harness broker, an upload whose transfer line declares a byteLength that differs from the manifest is refused denied before transfer_ready"
        status: pass
    human_judgment: false
  - id: D6
    description: "No broker-side filesystem path reaches the wire on the host_tool_run reply (T-65-06); a zero-file request (oracle.probe) still completes stage then run"
    requirement: SEAM-01
    verification:
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Test 10: the raw host_tool_run reply line, read off the socket, contains no occurrence of the harness home path"
        status: pass
      - kind: e2e
        ref: "host-tool-endpoint.test.ts#Test 9: an oracle.probe request stages an empty manifest, runs, and returns the executor's own oracle.probe response shape through runHostToolOverEndpoint()"
        status: pass
    human_judgment: false
  - id: D7
    description: "A stage entry with an unsafe rel (traversal segment, absolute path, backslash, empty, NUL) is refused bad_request before any staging directory is created"
    requirement: SEAM-01
    verification:
      - kind: integration
        ref: "broker-control.test.ts#Test 5: a stage entry whose rel is unsafe is refused bad_request, and onHostToolStage sees it"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-09-25
status: complete
---

# Phase 65 Plan 01: The Fixed-Endpoint Host-Tool Tracer Summary

**A real `acme.build` runs end to end through the fixed endpoint -- upload, remote assembly against a per-request broker scratch copy, download, and local write under the caller's own `toolsRoot/builds/`, with the legacy token-gated `host_tool` route left untouched.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-09-25T06:50:00Z (approximate)
- **Completed:** 2026-09-25T08:14:48Z
- **Tasks:** 2
- **Files modified:** 17 (4 created, 13 modified) in Task 1's commit; 6 modified in Task 2's commit (2 of which are pre-existing evidence documents repaired for citation drift)

## Accomplishments

- `runHostToolOverEndpoint()` (host-tool-endpoint.mts) drives a full host-tool
  run through the fixed endpoint: stage every declared file input, upload each
  over `transferFileOverEndpoint()`, run the tool with upload handles
  substituted for local paths, validate and download every declared result
  under the caller's own `toolsRoot/<kind>/`, closing the session in a
  `finally` on every path.
- Two new wire ops, `host_tool_stage`/`host_tool_run` (broker-control.mts),
  answered ahead of the token gate and bound to their own connection
  (T-65-04) -- the legacy `host_tool` op is dispatched exactly as before,
  after the token gate, from its own separate function.
- `broker-transfer.mts` gains `stageHostToolRequest()`/`listHostToolUploads()`/
  `resolveHostToolTree()`/`registerHostToolResult()`/`refuseUnsafeRelativePath()`,
  reusing the existing `handleIndex`/`clearStagingForSession()` machinery so a
  host-tool request's own D-09 cleanup is the SAME connection-close-removes-
  the-directory mechanism a monitor upload already has.
- `host-tool.mts` gains `bindStagedInputs()`, the server-side request
  transform that turns an upload handle into a scratch-relative path per
  `HOST_TOOL_PATH_ARG_KEYS[tool]`, refusing `outDir`/`sourceDir`/`includes`/
  `scriptPath`/`exportPath` by name on this route.
- `transfer-client.mts` (new) holds `transferFileOverEndpoint()` (moved
  verbatim from `stock-connect.ts`) and `validateContainedDestination()`
  (moved verbatim from `transfer-paths.ts`), both re-exported unchanged from
  their prior homes so every existing caller/test is unaffected.
- `broker-harness.ts` (new, test-only) spawns a real, compiled broker on a
  freshly allocated port and a fresh `mkdtempSync` home, resolving readiness
  via a real `dialBrokerEndpoint()` handshake, never a fixed sleep.
- Ten behaviours proven: five against a stub listener (broker-control.test.ts)
  and five against the real harness broker (host-tool-endpoint.test.ts) --
  coexistence with the legacy op, per-connection request-key binding, a
  size-lie refusal before any payload byte moves, D-09 cleanup on connection
  close, adjacency (two concurrent connections), a zero-file request, and
  path-freedom of the wire reply.

## Task Commits

1. **Task 1: End-to-end "acme.build through the one endpoint"** - `6a75b24f` (feat)
2. **Task 2: The new arms coexist with the legacy op, bind to their connection, and clean up** - `a38f81e9` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, sequential mode)

## Files Created/Modified

- `src/mcp/vice/host-tool-endpoint.mts` - `runHostToolOverEndpoint()`, `HOST_TOOL_FILE_INPUT_KEYS`, `HOST_TOOL_KIND_DIR`, and the five symbols moved from `host-tool-client.ts`
- `src/mcp/vice/transfer-client.mts` - `transferFileOverEndpoint()` and `validateContainedDestination()`, moved from `stock-connect.ts`/`transfer-paths.ts`
- `src/mcp/vice/broker-harness.ts` - test-only `startHarnessBroker()`
- `src/mcp/vice/host-tool-endpoint.test.ts` - the tracer's own end-to-end acme.build case plus Task 2's Tests 6-10
- `src/mcp/vice/broker-transfer.mts` - host-tool staging primitives, `declaredByteLength` on `StagedFileEntry`
- `src/mcp/vice/broker-control.mts` - `host_tool_stage`/`host_tool_run` dispatch arms, per-connection request-key binding, `onHostToolEnd` close hook
- `src/mcp/vice/broker-control.test.ts` - Tests 1-5, census/classification updates for the two new `ControlRequestKind` members
- `src/mcp/vice/vice-broker.mts` - `handleHostToolStage()`/`handleHostToolRun()`/`handleHostToolEnd()`, the declared-byteLength upload check, wiring
- `src/mcp/vice/host-tool.mts` - `bindStagedInputs()`, D-10 header amendment
- `src/mcp/vice/broker-endpoint.ts` - `dialHostToolSession()`, `HOST_TOOL_TAG`, `DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS`
- `src/mcp/vice/stock-connect.ts` - imports `transferFileOverEndpoint()` as its `transferFile` default, re-exports the three transfer types
- `src/mcp/vice/transfer-paths.ts` - re-exports `validateContainedDestination()`/`ContainedDestinationResult` from `transfer-client.mts`
- `src/mcp/vice/host-tool-client.ts` - re-exports the five symbols moved to `host-tool-endpoint.mts`
- `src/mcp/vice/package.json` - `files[]` gains `transfer-client.mts`/`host-tool-endpoint.mts`
- `src/mcp/vice/hostpath-consumers.test.ts` - `HOST_TOOL_FAMILY_FLOOR` 9 -> 10 (new `host-tool-endpoint.mts` module)
- Two phase 58/59 evidence documents - citation-ledger line numbers repaired after `host-tool.mts`/`package.json` line shifts

## Decisions Made

See `key-decisions` in the frontmatter. All four were already recorded in
the plan's own objective/Discretion-items section; this plan implemented
them rather than deciding them fresh.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `handleHostToolRun()`'s `!response.ok` branch could not read `.message` for every response shape**
- **Found during:** Task 1, `npm run typecheck`
- **Issue:** `runHostTool()`'s `oracle.run` response variant has `ok: boolean` (not a literal), so TypeScript could not narrow `response.message` away after `!response.ok`.
- **Fix:** Read `response.message` through the already-cast `Record<string, unknown>` view instead of the narrowed union.
- **Files modified:** `src/mcp/vice/vice-broker.mts`
- **Verification:** `npm run typecheck` exits 0.
- **Commit:** `6a75b24f` (Task 1 commit)

**2. [Rule 3 - Blocking] `hostpath-consumers.test.ts`'s SEAM-06 hand-pinned floor no longer matched disk**
- **Found during:** Task 2, full-glob `npm test`
- **Issue:** `HOST_TOOL_FAMILY_FLOOR` was pinned at 9; this plan's new `host-tool-endpoint.mts` is the tenth host-tool-family production module, so the pinned-equals-measured companion test failed by design (it exists to catch exactly this).
- **Fix:** Raised the pin to 10, with a new comment paragraph naming this plan and the module, per the test's own "re-derive deliberately, never adjust to fit" instruction.
- **Files modified:** `src/mcp/vice/hostpath-consumers.test.ts`
- **Verification:** `node --test hostpath-consumers.test.ts` exits 0 (22/22).
- **Commit:** `a38f81e9` (Task 2 commit)

**3. [Rule 1 - Bug] Citation-ledger drift in two phase evidence documents**
- **Found during:** Task 2, full-glob `npm test`
- **Issue:** Task 1's edits to `host-tool.mts` (inserting `bindStagedInputs()` and amending the header) and `package.json` (two new `files[]` entries) shifted every line number below the insertion points. Two committed provenance documents (`.planning/phases/58-.../evidence/phase58-declaration-provenance.md`, `.planning/phases/59-.../evidence/phase59-tool-location-placement.md`) cite specific `file:line` ranges in those files, each backed by a re-verified text anchor; eight citations across the two documents drifted off their anchor text.
- **Fix:** Derived the exact line-shift per insertion point from `git diff` hunk headers (a uniform `+107` for every citation below `host-tool.mts`'s insertion point, `+2` for `package.json`), then updated every affected citation (both the prose mentions and the JSON ledger entries) in both documents to the new, anchor-verified line numbers.
- **Files modified:** `.planning/phases/58-.../evidence/phase58-declaration-provenance.md`, `.planning/phases/59-.../evidence/phase59-tool-location-placement.md`
- **Verification:** `node --test phase58-citation-ledger.test.ts` -- the two document-specific cases (`phase58-declaration-provenance.md`, `phase59-tool-location-placement.md`) now pass; the file's third case (`.planning/PROJECT.md:2109`) is the pre-existing, out-of-scope baseline failure `run_context` names (item 4) and was left untouched.
- **Commit:** `a38f81e9` (Task 2 commit)

**4. [Rule 3 - Blocking] `broker-control.mts`'s own three structural census tests would have failed against the new `ControlRequestKind` union**
- **Found during:** Task 2, `node --test broker-control.test.ts`
- **Issue:** Three pre-existing structural tests read `ControlRequestKind`'s declaration verbatim off the source and assert an exact member count/list (13 members). Adding `host_tool_stage`/`host_tool_run` in Task 1 made all three fail until updated -- this is the census mechanism working as designed, not a bug in the mechanism itself.
- **Fix:** Updated all three tests' expected member counts/lists (13 -> 15) and added `host_tool_stage`/`host_tool_run` to `KNOWN_NON_TARGET_NAMING_OPS` (neither reads `target_id`).
- **Files modified:** `src/mcp/vice/broker-control.test.ts`
- **Verification:** `node --test broker-control.test.ts` exits 0 (131/131).
- **Commit:** `a38f81e9` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bug fixes, 2 Rule 3 blocking fixes). **Impact on plan:** All four were necessary to keep the suite green and the citation ledger honest; none represents scope creep beyond what Task 1's own edits required downstream.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Every code path this plan ships is real: a real ACME assembly, a real
broker, a real transfer connection.

## Next Phase Readiness

The tracer is proven end to end on `acme.build`. `runHostToolOverEndpoint()`,
`dialHostToolSession()`, `bindStagedInputs()` and the frozen kind/file-input-key
tables are ready for the remaining plans in this wave (65-02 through 65-05) to
move the other skill callers onto this route. The legacy `host_tool` op and
both container/host routes in `host-tool-client.ts` are untouched and remain
green, so no caller migration is forced by this plan.

---
*Phase: 65-every-skill-script-through-the-one-endpoint-and-ci-with-it*
*Completed: 2026-09-25*

## Self-Check: PASSED

- `src/mcp/vice/host-tool-endpoint.mts`, `src/mcp/vice/transfer-client.mts`,
  `src/mcp/vice/broker-harness.ts`, `src/mcp/vice/host-tool-endpoint.test.ts`
  all confirmed present on disk with `[ -f ]`.
- Both task commits (`6a75b24f`, `a38f81e9`) confirmed present via
  `git log --oneline --all --grep="65-01"`.
- Full-glob `npm test`: 4464 tests, 4379 pass, 1 fail (pre-existing,
  out-of-scope `.planning/PROJECT.md:2109` citation drift per run_context
  item 4), 84 skipped -- no regression beyond the pre-existing baseline.
