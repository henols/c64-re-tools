# Phase 64: the boundaries this phase deliberately did not cross

**What this records:** for each boundary `64-CONTEXT.md`'s `<domain>` "Phase
Boundary" block and D-03/D-19 declared, the check performed, the command or
file read that produced it, and the result — confirmed rather than assumed,
per this plan's own Task 3.

## 1. `vice_symbols_load` and `vice_program_load` received no transport work

Both were verified NOT file-carrying before this phase began (`64-CONTEXT.md`):
`vice_program_load` refuses a filename outright and takes an enumerated
subject id; `vice_symbols_load` reads client-side with `readFileSync` under
`needsSession: false`.

**Check performed (2026-09-23):**

```bash
git log --oneline --all --grep="64-0" -- src/mcp/vice/text-tools.ts src/mcp/vice/stock-symbols.ts
```

Result: **empty** — no Phase 64 commit (any plan) touches either file.

`git diff --name-only origin/main -- src/mcp/vice/stock-symbols.ts` is also
empty (zero diff against the stale baseline). `text-tools.ts` DOES appear in
the equivalent diff against `origin/main`, but that diff traces to a single
pre-Phase-64 commit, `b28d59b9` ("fix(63-08): declare the text operation only
after the shared lock is granted"), already merged onto this branch before
this session began — `origin/main` itself is 154+ commits behind this
branch's HEAD (the same stale-baseline artifact `64-06-SUMMARY.md`'s own
"Issues Encountered" section already recorded for the identical file).
Confirmed via `git log --oneline -3 -- src/mcp/vice/text-tools.ts`: the top
commit is `b28d59b9`, dated before Phase 64 opened.

**Result: confirmed.** Neither tool gained transport work in this phase.

## 2. `host_tool` was not touched, and `host-tool.mts`'s byte-payload prohibition is unchanged

D-19 assigns `host_tool`'s own transport work entirely to Phase 65.

**Check performed:** `git diff --name-only origin/main -- src/mcp/vice/host-tool.mts`
→ empty (zero diff). Read `host-tool.mts` lines 64-65 directly:

> `// - No inline byte payload on a host-tool response, at any result size --`
> `//   every result crosses as `{ path, sha256, byteLength }`, never bytes.`

This is the exact text D-19 cites, unchanged, at the same lines.

**The prohibition's two clauses, and their different fates (D-19's own framing, restated for this phase's close-out):**

- **Clause one — "no inline byte payload, at any result size" — survives the
  whole milestone.** Under D-01 (this phase's own decision), a file payload
  rides a short-lived, stateless transfer connection, never the response
  body of the command that names it. A host-tool response under this same
  design would carry a *handle*, never bytes — the design HONOURS clause one
  rather than contradicting it. Nothing about Phase 64 makes this untrue.
- **Clause two — "every result crosses as `{ path, sha256, byteLength }`" —
  goes stale only when Phase 65 replaces `path` (a broker-side path today)
  with a handle.** Nothing at THIS phase's exit makes clause two untrue,
  because Phase 64 never touches `host_tool` at all (confirmed above: zero
  diff against `host-tool.mts`). Phase 65 amends clause two in the same
  change that makes it untrue — rule and reality move together, per D-19's
  own instruction.

**Result: confirmed.** `host_tool` is untouched; both clauses of the
prohibition read exactly as they did before this phase, and neither is
stale at this phase's own exit.

## 3. `stock-paths.ts` was not deleted, and nothing was removed from it

D-13/`RM-01`: `stock-paths.ts` survives Phase 64; Phase 66 deletes it.

**Check performed:** `test -f src/mcp/vice/stock-paths.ts` → exists.
`git log -p` review of the module across plans 64-01 and 64-06 (the two
plans that touched it), and its current export surface:

```
export { StockPathError, snapshotPathFor, snapshotMetaPathFor };
export const STOCK_EMULATOR_SIDE_PATH_TOOLS: ReadonlySet<string> = ...
export async function withEmulatorSidePath<T>(...)
export function setIsInsideContainerForTest(...)
export function sanitizeSnapshotName(name: unknown): string { ... }
export { dirname };
```

Every export present before this phase is still present. **Which exports
moved their DEFINITION (not their re-export):** plan 64-01 relocated
`StockPathError`'s class definition, and `snapshotPathFor()`/
`snapshotMetaPathFor()`'s implementations, into `transfer-paths.ts` — a leaf
module with respect to `stock-paths.ts`, chosen specifically to avoid a
`stock-paths.ts` → `transfer-paths.ts` → `stock-paths.ts` import cycle
(`64-01-SUMMARY.md`'s own key-decisions). `stock-paths.ts` re-exports all
three from `transfer-paths.ts` verbatim, so a consumer importing them FROM
`stock-paths.ts` sees no change at all.

**Which consumers still reach them through `stock-paths.ts`, unchanged:**

```bash
grep -rln 'from "./stock-paths.ts"' src/mcp/vice/*.ts src/mcp/vice/*.mts
```

→ `stock-paths.test.ts` (the module's own test file) and
`stock-broker-live.test.ts`, which imports exactly
`{ snapshotPathFor, snapshotMetaPathFor }` from `./stock-paths.ts`
(confirmed at that file's own line 132) — reaching the RELOCATED
definitions through the OLD import path, unchanged by this phase.
`sanitizeSnapshotName()` (unmoved, still defined in `stock-paths.ts` itself)
now delegates its verdict internally to `transfer-paths.ts`'s
`validateSnapshotName()` (plan 64-01), but its own call signature and
throwing behavior for any existing caller is unchanged.

**`withEmulatorSidePath()`, `STOCK_EMULATOR_SIDE_PATH_TOOLS` and
`setIsInsideContainerForTest()` are now DEAD CODE with no production
caller** (the four handlers that used to call `withEmulatorSidePath()` all
migrated off it in plans 64-04/64-06), but nothing in this phase deletes
them — Phase 66's `RM-01` is the one place that both deletes the module and
removes these exports. Confirmed: `grep -rn 'withEmulatorSidePath\b' src/mcp/vice/*.ts src/mcp/vice/*.mts | grep -v '\.test\.' | grep -v 'stock-paths.ts'`
returns no other caller anywhere in the tree.

**Result: confirmed.** `stock-paths.ts` still exists, exports the same
surface, and nothing was removed.

## 4. The two legacy UTF-8 string framers were not converted

D-03 declined converting `vice-broker-client.ts`'s two remaining
`buffer += chunk.toString("utf8")` sites, explicitly instructing that this
must NOT be recorded as an inherited obligation for Phase 66.

**Check performed:**

```bash
grep -n 'toString("utf8")' src/mcp/vice/vice-broker-client.ts
```

Result:

```
534:      buffer += chunk.toString("utf8");
1041:    buffer += chunk.toString("utf8");
```

(`64-CONTEXT.md`'s own D-03 citation names lines 534 and 1013; the second
line has drifted to 1041 across intervening, unrelated edits to the file
between when D-03 was written and this phase's own close — the FIRST line,
534, is unchanged and exact. Both sites are confirmed present, unconverted,
by direct inspection: neither reads any framing this phase added.)

**Why there is nothing here to convert, restated with this phase's own
mechanism named:** the transfer this phase built rides
`broker-endpoint.ts`'s `dialFileTransfer()`, which accumulates its reply as
a raw `Buffer` and searches for the newline terminator with `indexOf(0x0a)`
(`broker-endpoint.ts:662-665`, unchanged by this phase) — never a string
decode. `vice-broker-client.ts`'s two UTF-8 framers live entirely in the
**legacy per-project-discovery dial path**, which `broker-endpoint.ts`'s own
header explicitly forbids importing, and which Phase 66's `RM-02` deletes.
No payload byte this phase moves can reach either framer, by construction —
confirmed by reading `broker-endpoint.ts`'s full file for any import of or
call into `vice-broker-client.ts`, which the header's own written
prohibition already names and which returns none.

**Explicit statement for Phase 66, per D-03's own instruction:** this is
**NOT** an inherited obligation. There is nothing for Phase 66 to convert
here as a consequence of Phase 64's work; the two sites are dead relative to
every path Phase 64 built, and their eventual fate is tied entirely to
`RM-02`'s own deletion of the legacy dial path they live in, not to
anything Phase 64 introduced or left unfinished.

**Result: confirmed.** Both string framers are untouched, and Phase 66 does
not inherit a conversion obligation from this phase.

## 5. The orphaned result-chunking todo was folded for awareness only, not as work

`.planning/todos/pending/2026-09-13-result-chunking-orphaned-by-the-fork-removal.md`
was folded into `64-CONTEXT.md`'s own Folded Todos for **awareness only**:
a cap on tool result CHARACTERS returned to the agent is a different axis
from a cap on payload BYTES crossing the socket, and the planner named three
constraints this phase must hold to.

**A correction, measured rather than assumed, before recording the three
constraints:** the todo's own title and body claim `wrapPossiblyChunked()`
has zero call sites and that its four named tests are "still failing." Both
claims are now STALE, independently of anything Phase 64 did. Measured
2026-09-23:

```bash
git log --oneline -1 -L 1640,1666:src/mcp/vice/vice-proxy.ts
```

shows commit `54a4ac54` ("fix(55-01): restore wrapPossiblyChunked()'s call
site at the tools/call choke point", dated 2026-09-14) restored the call
site the todo's own 2026-09-13 filing described as deleted. Running the
four tests the todo names, directly:

```bash
node --test --test-reporter=tap \
  --test-name-pattern="oversized result is recoverable|exhausted continuation token fails loudly|unknown continuation token|cap stamp and the actual chunk boundary" \
  vice-proxy.test.ts
```

→ all four report `ok` (pass), not `not ok`. **They are not "still-failing"
tests at this phase's close — they are passing tests, and have been since
Phase 55, well before Phase 64 began.** The todo's own frontmatter records
`audit_acknowledged: { milestone: v1.0.0, at: 2026-09-16 }` — that
acknowledgement re-confirmed the todo as a known OPEN item without checking
whether the underlying regression had already been fixed two days earlier.
This is a pre-existing, unrelated documentation-hygiene gap (a stale todo
file, never a Phase 64 defect), named here so a reader of this evidence
does not inherit the todo's own stale claim as current fact. It does not
change this phase's own scope or any of its own deliverables — Phase 64
never touches `vice-proxy.ts`, `anno-tools.ts`, or `wrapPossiblyChunked()`
at all (confirmed: `git log --oneline --all --grep="64-0" -- src/mcp/vice/vice-proxy.ts`
returns empty), and the correction belongs to whoever next reviews that
todo file, not to this plan.

**The three constraints the planner named, checked against this phase's own
work, independent of the correction above:**

- **"The new `XFER-06` cap must not inherit the dead one's vocabulary."**
  Checked: `TRANSFER_MAX_BYTES` (`transfer-hash.mts:37`, 16 MiB) is a
  wholly distinct constant from the old `OUTPUT_CHAR_CAP`
  (`vice-proxy.ts`'s own char-count cap). `grep -c 'maxResultSizeChars\|CHAR_CAP\|continuation' src/mcp/vice/stock-dispatch.ts`
  → `0`. Held.
- **"Must not be wired into `_meta`."** Checked:
  `grep -rn "TRANSFER_MAX_BYTES" src/mcp/vice/*.ts src/mcp/vice/*.mts | grep -v '\.test\.'`
  shows every reference confined to `stock-connect.ts`, `broker-transfer.mts`
  and `transfer-hash.mts` itself — none in `vice-proxy.ts` (the one file that
  stamps `_meta`) and none in `stock-dispatch.ts`. Held.
- **"Must not be described in a way that implies `vice_result_continue` now
  works."** Checked: this phase's own artifacts (`transfer-disjoint-roots.test.ts`,
  this document, and `64-convergence-metric.md`) make no claim about
  `vice_result_continue` at all, and `vice-proxy.ts` itself is untouched by
  this phase (confirmed above). Held.

**Result: confirmed**, with one correction recorded honestly rather than
silently inherited: the todo's own "four still-failing tests" framing is
stale (fixed in Phase 55, before Phase 64 began) — but this phase's own
three named constraints all held regardless, and nothing here retired any
test to manufacture a green result.

## 6. The inert timeout inside the text channel (`CR-01`, `text-protocol.ts:850`) was not touched

`STATE.md` warns that a phase touching it while redesigning the socket path
must say so rather than fix it silently.

**Check performed:**

```bash
git log --oneline --all --grep="64-0" -- src/mcp/vice/text-protocol.ts
```

Result: **empty** — no Phase 64 commit (any plan) touches this file.
`git diff --name-only origin/main -- src/mcp/vice/text-protocol.ts` is
non-empty, but — the same stale-baseline pattern as item 1 above — that
diff traces to the same pre-Phase-64 commit (`b28d59b9`), confirmed via
`git log --oneline -3 -- src/mcp/vice/text-protocol.ts`, whose top entry
predates this phase's own opening.

**Result: confirmed.** No plan in Phase 64 reached `CR-01`. It remains
untouched, exactly as `STATE.md`'s own warning anticipates for a phase that
does not plan to touch it.

---

*Phase: 64-files-as-bytes-both-directions*
*Evidence recorded: 2026-09-23*
