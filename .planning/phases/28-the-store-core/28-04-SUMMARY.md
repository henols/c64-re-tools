---
phase: 28-the-store-core
plan: 04
subsystem: database
tags: [node-sqlite, annotation-store, validators, 6502, split-tables, cross-references, planted-violation]

# Dependency graph
requires:
  - phase: 28-the-store-core
    provides: "plan 28-01's anno-types.ts (the frozen twelve, SPLIT_DATA_TYPES, the seven error classes, parseStoreAddress, assertRangeShape) and anno-store.ts (the eight-table DDL, openStore's refusals, the revision compare-and-swap, the vacuum-into snapshot, split-and-preserve retype)"
  - phase: 27-shared-seams-extracted
    provides: "shipped-modules.ts's codeOnly(keepLiteralBodies) — the stripper the bank-never-read structural scan and the import-specifier pin both need"
  - phase: 04-disassembler
    provides: "disasm-opcodes.ts's 256-entry OPCODES array with its lowercase mnemonic field, including the illegal-opcode mnemonics — the derivation source for the label denylist"
provides:
  - "COMMENT_TYPES, LABEL_KINDS and XREF_ACCESS_KINDS — the three remaining frozen vocabularies, one home each, with the label-kind capitalisation and the access-kind citation-only provenance both recorded in their doc comments"
  - "MNEMONIC_DENYLIST — 76 distinct mnemonics DERIVED from OPCODES in exactly one place, covering the illegal-opcode names (jam, slo, lax) a hand-typed 56-name list misses"
  - "The full validator set: assertLegalLabel, assertLabelKind, assertCommentType, assertCommentText, assertAccessKind, assertEnumName, parseVariantKey — every one refusing with a named error that carries the offending value"
  - "resolveSplitTargets / producesXrefsFor — pure split-table target resolution over both axes, deriving and returning, never storing"
  - "MAX_COMMENT_BYTES (4096, measured in UTF-8 bytes with a TextEncoder) and MAX_VARIANT_KEY"
  - "AnnoLabelError and AnnoCommentError — two new members of the AnnoStoreError family"
  - "LabelRow, CommentRow, ScopeRow, ProjectEnumRow, XrefRow, SplitTargets"
  - "setLabel/listLabels, setComment/listComments, addScope/listScopes, createProjectEnum/updateProjectEnum/listProjectEnums, putXref/listXrefs — five annotation kinds persisted over the existing DDL with no schema change"
  - "AnnoWriteResult { revision, changed: boolean } — the one write-result shape, where changed is the only no-op signal and the revision never is"
  - "runWriteSequence rollback-on-mutation-failure, so a refusal raised inside a mutation cannot leave an open transaction or an advanced revision"
  - "The committed split-orientation control with its non-degeneracy halves and its collapse planting, plus the address-versus-word orthogonality proof"
affects: [28-05, 28-06, "the MCP annotation surface", "ACME export", "coverage census"]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate:
# chars/4 over the four files actually changed (150,741 chars).
actuals:
  tokens: 37685
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "derived denylist: a vocabulary read off the real 256-entry table in exactly one place, never hand-typed, so the illegal-opcode names cannot be forgotten"
    - "refuse, never normalise: no sanitisation, substitution, trimming or quoting step anywhere on the write path, because a substitution merges two names silently"
    - "changed:false as the only no-op signal, with the revision advancing on every accepted write so it can never double as one"
    - "refusal inside the mutation transaction, paired with rollback-on-throw, so a read-dependent refusal is atomic AND leaves no trace"
    - "keys validated but never canonicalised, so round-trip-by-value means the caller's own bytes come back"
    - "differing-derived-set control with its non-degeneracy asserted first in the same test, plus an inline collapse planting calling the control's own comparison helper"

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-types.ts
    - src/mcp/vice/anno-store.ts
    - src/mcp/vice/anno-types.test.ts
    - src/mcp/vice/anno-store.test.ts

key-decisions:
  - "AnnoLabelError carries its offending identifier in a field named `identifier`, never `name` — `name` is Error.prototype.name, which every constructor in this family assigns the class name to"
  - "AnnoCommentError is a second new error class, because neither of AnnoLabelError's fields fits text that is not an identifier and has no address to collide at"
  - "setDataType returns AnnoWriteResult { revision, changed: boolean } rather than a touched-row count, and retype short-circuits an exact no-op"
  - "runWriteSequence rolls the whole sequence back when the caller's mutation throws"
  - "Project-enum variant keys are validated against the four numeric-string forms but NEVER canonicalised; two keys naming the same value are refused"
  - "The mnemonic denylist is scoped to label names and deliberately NOT applied to project-enum names"
  - "addScope stays additive with no duplicate collapsing, matching the verb's own name in the schema it mirrors"
  - "createProjectEnum refuses a different enum under an existing name and treats a byte-identical repeat as a no-op; there is no delete verb"

patterns-established:
  - "Derived-vocabulary denylist: OPCODES.map to a lowercase mnemonic set in one place, with the specific hand-list misses named in the doc comment"
  - "Two-comparison rule stated once: case-insensitive against the denylist, exact byte equality name-versus-name, both defined in assertLegalLabel's doc comment so the store's own check has one definition to follow"
  - "Structural scan by strict codeOnly rather than hand-excluded line spans: blanking string-literal bodies removes the DDL and every SQL column list from a bank-never-read scan for free"
  - "Column-zero-anchored, export-inclusive module-level-mutable-state scan, with both adjustments to the inherited pattern stated in the test so a later reader does not restore the original"

requirements-completed: [STORE-01, STORE-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The three remaining vocabularies (COMMENT_TYPES, LABEL_KINDS, XREF_ACCESS_KINDS) are frozen with exactly their members and one home each, and each assert* accepts a member and refuses a non-member with the offending value plus the full valid list"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the three remaining vocabularies are frozen with exactly their members, and each assert* accepts a member and refuses a non-member by name"
        status: pass
    human_judgment: false
  - id: D2
    description: "MNEMONIC_DENYLIST is derived from disasm-opcodes.ts's OPCODES — its size equals the distinct mnemonic count computed from the table itself, and it carries jam, slo and lax"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the mnemonic denylist is DERIVED from the opcode table -- its size equals the distinct mnemonic count computed here from OPCODES, and it carries the illegal-opcode names a hand-typed list misses"
        status: pass
      - kind: other
        ref: "grep -c 'from \"./disasm-opcodes.ts\"' src/mcp/vice/anno-types.ts == 1 and one non-comment OPCODES.map occurrence"
        status: pass
    human_judgment: false
  - id: D3
    description: "assertLegalLabel enforces the schema's contract as three refusals and no normalisation: a legal name returns unchanged, an illegal character refuses without being sanitised, and a mnemonic refuses case-insensitively"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#assertLegalLabel accepts a legal identifier unchanged, refuses an illegal one WITHOUT sanitising it, and refuses a mnemonic case-insensitively"
        status: pass
    human_judgment: false
  - id: D4
    description: "assertCommentText bounds comment text at MAX_COMMENT_BYTES measured in UTF-8 BYTES, refusing rather than truncating, and refuses the ';' prefix the schema tells callers to omit"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#assertCommentText measures its bound in UTF-8 BYTES, not code units, and refuses the semicolon prefix the schema tells callers to omit"
        status: pass
    human_judgment: false
  - id: D5
    description: "parseStoreAddress accepts an in-range number, a $-prefixed and an 0x/0X-prefixed hex string, and refuses an unprefixed numeric string with AnnoAddressError carrying the offending input and the caller's field name — the recorded divergence from stock-address.ts"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#parseStoreAddress accepts an in-range number and both hex prefixes, and REFUSES an unprefixed numeric string with the divergence named in the message"
        status: pass
    human_judgment: false
  - id: D6
    description: "Criterion 1's control: the research-verified fixture read as lo_hi_address and as hi_lo_address produces DIFFERING resolved-target sets, with both non-degeneracy assertions running first in the same test, and it was observed FAILING against a deliberately collapsed single-orientation implementation"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the collapse planting, observed: a single-orientation implementation makes the control's OWN comparison report the two readings as identical"
        status: pass
      - kind: other
        ref: "planted red, observed and reverted: `const lowFirst = true` in resolveSplitTargets -> 12 pass / 2 fail, the control's failure printing actual 2064,4660,49152,53247 against expected 4104,13330,192,65487"
        status: pass
    human_judgment: false
  - id: D7
    description: "The address-versus-word axis is observable independently of orientation: over identical bytes the two _address members produce cross-references and the two _word members do not, while their resolved target values are equal"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#the second axis: over IDENTICAL bytes the two _address members produce cross-references and the two _word members do not, while the resolved targets are equal"
        status: pass
    human_judgment: false
  - id: D8
    description: "An odd byte count on any of the four split layouts is refused with AnnoRangeShapeError, and a non-split type is refused with AnnoTypeError naming the four layouts"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#resolveSplitTargets refuses an odd byte count on each of the four split layouts, and refuses a non-split type outright"
        status: pass
    human_judgment: false
  - id: D9
    description: "Labels, comments, scopes and project enums each round-trip through the store BY VALUE across a close and a reopen in a fresh handle — including a project enum's complete variant mapping with its keys verbatim"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#round-trip by value: a label survives a close and a reopen with every field equal to what was written"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#round-trip by value: both comment placements coexist at one address, and rewriting one placement replaces rather than accumulates"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#round-trip by value: a scope keeps both inclusive ends, and a project enum's complete variant mapping and description survive a reopen"
        status: pass
    human_judgment: false
  - id: D10
    description: "A label name already bound to a DIFFERENT address is refused with AnnoLabelError naming both addresses, the store is unchanged, and the revision did not advance — observed as the named error rather than a SQLite constraint error, and observed red with the check removed"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the label collision is REFUSED by name before SQLite sees it: both addresses are in the message, the store is unchanged and the revision did not advance"
        status: pass
      - kind: other
        ref: "planted red, observed and reverted: collision check removed from setLabel -> `not ok 18` (22 pass / 1 fail)"
        status: pass
    human_judgment: false
  - id: D11
    description: "Writing the identical label, comment or range type a second time succeeds, leaves exactly one row, and reports changed:false, while the revision still advances by exactly one — so changed:false is the only no-op signal"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#idempotency: a repeated identical label, comment and range type each succeed, leave exactly one row and report changed:false -- while the revision still advances by exactly one"
        status: pass
    human_judgment: false
  - id: D12
    description: "listLabels, listComments, listScopes, listProjectEnums and listXrefs each return rows in ascending id order, and that order is stable across a close and a reopen"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#ordering: every list function returns rows in ascending id order, and the same order after a close and a reopen"
        status: pass
    human_judgment: false
  - id: D13
    description: "Two anno_xref rows sharing a fromAddress and a toAddress but carrying different access_kind values are two rows, never merged; a fifth access-kind value is refused with AnnoTypeError naming the four valid members"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#xref adjacency: one from/to pair with two DIFFERENT access kinds is two rows, and a fifth access-kind value is refused with AnnoTypeError naming the four valid members"
        status: pass
    human_judgment: false
  - id: D14
    description: "anno_xref holds ZERO rows after typing a lo_hi_address range whose targets are fully derivable and after a lo_hi_word range — only an explicit putXref produces a row — and every row this phase writes has bank NULL, with no code outside the row mappers reading a bank value"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#nothing derivable is cached: anno_xref holds ZERO rows after typing a lo_hi_address range whose targets are fully derivable, and after a lo_hi_word range -- only an explicit putXref produces a row"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#the reserved bank field is never READ: every list function returns bank null, and no line of the seam's own code reads a bank value outside the row mappers"
        status: pass
      - kind: other
        ref: "planted red, observed and reverted: a derived xref row inserted inside setDataType for a lo_hi_address range -> `not ok 22` and `not ok 23` (21 pass / 2 fail)"
        status: pass
    human_judgment: false
  - id: D15
    description: "anno-types.ts stays a pure validator layer: no module-level mutable binding (column-zero-anchored, export-inclusive scan on strict codeOnly output) and an import specifier set of exactly three entries"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#anno-types.ts declares no module-level mutable binding, and its import specifier set is exactly the three it needs"
        status: pass
    human_judgment: false
  - id: D16
    description: "PROHIBITION: no sanitisation, substitution, trimming or quoting step exists anywhere on the label write path, so no normalisation could merge two names a human deliberately distinguished; and a legal name already bound to a different address is refused rather than rebound"
    requirement: "STORE-01"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-types.test.ts#assertLegalLabel accepts a legal identifier unchanged, refuses an illegal one WITHOUT sanitising it, and refuses a mnemonic case-insensitively"
        status: pass
      - kind: other
        ref: "grep over non-comment lines of anno-types.ts: zero replace() calls; the only toLowerCase() occurrences are the denylist derivation and the denylist lookup key, neither applied to the name that gets stored; the only trim() calls are inside parseStoreAddress and parseVariantKey, neither on a stored identifier"
        status: pass
    human_judgment: true
    rationale: "The plan designates this prohibition `verification: judgment`. Automated evidence is strong (the accept/refuse matrix, the asserted fact that `init screen` refuses while `init_screen` stays a different legal name, and the observed collision red), but 'no normalisation step exists ANYWHERE on the write path' is a whole-path claim a test cannot close — a reviewer has to read the path."
  - id: D17
    description: "PROHIBITION: nothing derivable from the program bytes is stored in the cross-reference table; the column exists only so a non-derivable, hand-asserted reference has somewhere to live"
    requirement: "STORE-05"
    verification:
      - kind: unit
        ref: "src/mcp/vice/anno-store.test.ts#nothing derivable is cached: anno_xref holds ZERO rows after typing a lo_hi_address range whose targets are fully derivable, and after a lo_hi_word range -- only an explicit putXref produces a row"
        status: pass
      - kind: other
        ref: "planted red, observed and reverted: a derived xref row inserted inside setDataType -> `not ok 22` and `not ok 23`"
        status: pass
    human_judgment: true
    rationale: "The plan designates this prohibition `verification: judgment`. The positive pin plus its observed red close the specific case, but 'nothing derivable is EVER written here' is a claim about every future caller, which a reviewer has to hold rather than a test."

# Metrics
duration: 27 min
completed: 2026-08-27
status: complete
---

# Phase 28 Plan 04: The Rest of the Store, with Validators That Refuse Summary

**Five annotation kinds persisted over the existing DDL with a validator set that refuses rather than guesses — a label denylist derived from the real 256-entry opcode table, comment text bounded in UTF-8 bytes, and the split-orientation control observed red against a deliberately collapsed implementation.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-27T13:39:00Z (approx — first task commit at 13:47Z)
- **Completed:** 2026-08-27T14:06:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **The remaining vocabularies, each with one home.** `COMMENT_TYPES`,
  `LABEL_KINDS` and `XREF_ACCESS_KINDS` are frozen `as const` with derived member
  types. Two provenance facts are recorded in the doc comments rather than left
  to be rediscovered: the label-kind capitalisation is a *decided asymmetry*
  (the block-type vocabulary is lowercase because it is read off the
  `anno_set_data_type` schema and named verbatim in a shipped playbook, while
  the label-kind vocabulary is capitalised because its only mechanical consumer
  is the coverage census, which spells it that way at four sites), and the four
  access-kind spellings are **cited from an external analyser's reference via
  this project's research notes and are not read from any code in this
  repository** — so no later reader treats them as verified project vocabulary.

- **A derived mnemonic denylist, not a hand-typed one.** `MNEMONIC_DENYLIST` is
  built by mapping `disasm-opcodes.ts`'s 256-entry `OPCODES` to its lowercase
  `mnemonic` field in exactly one place: **76 distinct mnemonics**, twenty more
  than the documented 56, because the illegal-opcode names (`jam`, `slo`, `lax`,
  `anc`, …) are in the table and would be missing from any hand list. A label
  named `slo` would otherwise be accepted here and rejected by the assembler at
  export time — a failure a long way from its cause. The expectation in the test
  is *computed from `OPCODES`*, so a change to the opcode table cannot leave a
  stale number behind.

- **The full validator set, every one refusing with a field-carrying error.**
  `assertLegalLabel` enforces the schema's contract as three refusals and **no
  normalisation** — a name containing an illegal character is refused, never
  substituted, and its doc comment states the two comparisons once so the store
  has one definition to follow: case-insensitive against the denylist, exact
  byte equality name-versus-name. `assertCommentText` measures its 4096-byte
  bound with a `TextEncoder` and refuses rather than truncating.
  `assertCommentType` / `assertLabelKind` / `assertAccessKind` route through one
  membership helper. `assertEnumName` and `parseVariantKey` complete the set.

- **Pure split-table resolution over both axes.** `resolveSplitTargets` derives
  and returns; it never stores. Its doc comment carries the worked arithmetic
  from research and — importantly — the reason a byte-identical reassembly
  assertion **cannot** be the orientation control: a retype changes no bytes, so
  such an assertion is green under both orientations and can never go red.

- **Five annotation kinds persisted over plan 28-01's DDL** with no schema
  change, no `SCHEMA_VERSION` bump and no `ALTER TABLE`. Every entry point
  validates first and only then goes through `applyWrite`; every statement is
  `prepare().run()` with bound parameters. `putXref`'s doc comment is where the
  two apparently-conflicting requirement texts are reconciled *in the code*, so
  a later reader does not have to rediscover that they appeared to disagree.

- **Criterion 1's control, committed with both non-degeneracy halves first and
  its collapse planting observed red.** The comparison is a single named helper
  called by both the control and the planting, so the control and its own proof
  cannot drift into two slightly different comparisons.

## Task Commits

1. **Task 1: the remaining vocabularies, the derived denylist, the validator set, pure split-table resolution** — `7701805` (feat)
2. **Task 2: persist labels, comments, scopes, project enums and cross-references** — `df2ebef` (feat)
3. **Task 3: criterion 1's control with its collapse planting, plus the validator suite** — `8991d73` (test)

**Plan metadata:** see the `docs(28-04)` commit that carries this file.

## Files Created/Modified

- `src/mcp/vice/anno-types.ts` (410 → 917 lines) — three frozen vocabularies,
  the derived denylist, `MAX_COMMENT_BYTES`, `MAX_VARIANT_KEY`, five row shapes,
  `SplitTargets`, two new error classes, seven validators,
  `resolveSplitTargets` / `producesXrefsFor`, and four new `WHAT NOT TO DO`
  traps.
- `src/mcp/vice/anno-store.ts` (562 → 1076 lines) — eleven new entry points,
  `AnnoWriteResult`, the rollback-on-mutation-failure fix, and `retype`'s no-op
  short-circuit.
- `src/mcp/vice/anno-types.test.ts` (79 → 549 lines) — the split-orientation
  control with its non-degeneracy halves and collapse planting, the reassembly
  non-control, the second-axis proof, and the validator suite (14
  `assert.throws` calls, every one asserting a field of the thrown error).
- `src/mcp/vice/anno-store.test.ts` (340 → 734 lines) — round-trip-by-value for
  all five kinds, the collision refusal, idempotency, ordering across a reopen,
  xref adjacency, the never-cached pin, and the bank-never-read structural scan.

## Decisions Made

- **`AnnoLabelError`'s identifier field is named `identifier`, not `name`.**
  `name` is `Error.prototype.name`, which every constructor in this family
  assigns the class name to; a public `name` field would overwrite
  `"AnnoLabelError"`, so a `catch` block asking which error it caught would be
  told the answer to a different question.
- **`AnnoCommentError` is a second new error class.** Neither of
  `AnnoLabelError`'s fields fits text that is not an identifier and has no
  address to collide at, and the plan requires every refusal test to assert a
  *field* of the thrown error.
- **`setDataType` returns `AnnoWriteResult { revision, changed: boolean }`.** The
  plan's own idempotency truth requires `changed:false` on a repeated identical
  range type, which a touched-row count cannot express. This also matches the
  shape plan `28-05` already declares for `SetDataTypeResult`. No consumer
  outside the tests existed.
- **`runWriteSequence` rolls back when the caller's mutation throws.** The
  label-collision refusal has to read rows, so it lives inside the mutation's
  transaction — which closes the window in which a concurrent writer binds the
  name between the read and the insert. Without the rollback, a refused write
  left the transaction open with the compare-and-swap already applied.
- **Variant keys are validated but never canonicalised**, and two keys naming
  the same value are refused. Round-tripping by value is the store's contract:
  a caller that wrote `"$40"` reads back `"$40"`.
- **The mnemonic denylist is scoped to label names** and deliberately not
  applied to project-enum names — the schema's mnemonic rule is scoped to the
  symbols an assembler sees.
- **`addScope` stays additive** with no duplicate collapsing, matching the
  verb's own name in the schema it mirrors. Collapsing duplicates would be this
  module inventing a policy the surface does not have.
- **`createProjectEnum` refuses a *different* enum under an existing name** and
  treats a byte-identical repeat as a no-op, so re-running a generation pass is
  safe. There is no delete verb.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AnnoLabelError`'s `name` field would have shadowed `Error.prototype.name`**

- **Found during:** Task 1
- **Issue:** The plan specifies `AnnoLabelError { name, reason }`. Every
  constructor in this error family runs `this.name = "AnnoLabelError"`, so a
  public `name` field carrying the offending label would overwrite the class
  name and break `catch`-side identification.
- **Fix:** The field is `identifier`, with the reason stated in the options
  interface's own doc comment. It serves both label names and project-enum
  names.
- **Files modified:** `src/mcp/vice/anno-types.ts`
- **Verification:** `anno-types.test.ts` asserts `e.identifier` verbatim on
  every label and enum refusal; `anno-store.test.ts` asserts `e.identifier`
  alongside `e.existingAddress` / `e.requestedAddress` on the collision.
- **Committed in:** `7701805`

**2. [Rule 2 - Missing Critical] `AnnoCommentError` added for comment-text refusals**

- **Found during:** Task 1
- **Issue:** The plan's export list adds only `AnnoLabelError`, but
  `assertCommentText` must refuse with an error that carries a field (the plan
  requires a field-level assertion on every refusal) and no existing class has a
  field that fits comment text.
- **Fix:** `AnnoCommentError { reason, byteLength }`, with its distinctness from
  `AnnoLabelError` stated in its doc comment.
- **Files modified:** `src/mcp/vice/anno-types.ts`
- **Verification:** `anno-types.test.ts` asserts `e.byteLength === 6144` on the
  multi-byte case and `e.reason === "semicolon prefix"` on the prefix case.
- **Committed in:** `7701805`

**3. [Rule 3 - Blocking] `runWriteSequence` left an open transaction when a mutation threw**

- **Found during:** Task 2
- **Issue:** The plan places the label-collision refusal *inside* the write
  mutation, and separately requires that after the refusal "the store is
  unchanged, and the revision did not advance". Both could not hold:
  `runWriteSequence` had no rollback around `mutate`, so a throw left the
  transaction open with the revision compare-and-swap already applied, and
  `currentRevision()` on the same connection reported an advanced revision for a
  refused write.
- **Fix:** `mutate` is wrapped in a `try`/`catch` that issues one `rollback` and
  rethrows the caller's original error, with the reasoning written into the code.
  The inner rollback failure is deliberately swallowed so a secondary error
  cannot replace the caller's actual refusal.
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** the collision test asserts `currentRevision(store) === 1`
  after the refusal, and `listLabels(store)` still holds the original binding.
- **Committed in:** `df2ebef`

**4. [Rule 1 - Bug] `setDataType`'s result could not express a no-op**

- **Found during:** Task 2
- **Issue:** The plan requires "the identical range type a second time succeeds,
  leaves exactly one row, and reports `changed:false`". `setDataType` returned
  `{ revision, changed: number }` (a touched-row count), and a repeat produced
  `changed: 2` via a delete-and-reinsert.
- **Fix:** `AnnoWriteResult { revision, changed: boolean }`, and `retype`
  short-circuits when the single overlapping row is byte-exactly the requested
  range and type. This is the shape plan `28-05` already declares for
  `SetDataTypeResult`, so the change moves toward the phase's own target rather
  than away from it. No consumer outside the tests existed (verified by grep
  across `src/` and `scripts/`).
- **Files modified:** `src/mcp/vice/anno-store.ts`
- **Verification:** the idempotency test asserts one row, `changed:false`, and
  `revision === previous + 1` for label, comment and range type alike; all five
  overlap cases that `28-05` will exercise are untouched by the short-circuit,
  which only fires on an exact single-row match.
- **Committed in:** `df2ebef`

### Deliberate divergences recorded in the plan itself

- **`parseVariantKey` lives in `anno-types.ts`, not inline in the store.** The
  plan says the store should validate variant keys "by routing each key through
  `parseStoreAddress`-style parsing appropriate to a value"; the parsing is a
  pure function of a string, so it belongs in the pure module. The store's
  `validatedVariants` helper calls it.
- **The `lo_hi_address`-versus-`lo_hi_word` reference-production row is
  authored in `anno-types.test.ts`, not `anno-store.test.ts`.** This is the
  plan's own recorded divergence from `28-VALIDATION.md`'s file binding: the
  derivation is a pure function of bytes and a type, and putting it behind the
  persistence layer would require the store to accept program bytes it has no
  other reason to see. The store-side half of the same claim (`anno_xref` holds
  zero rows after typing) *is* in `anno-store.test.ts`, so the behaviour the map
  names is fully covered and only its file binding moved.
- **`assertCommentText` grew an options argument** (`{ what,
  allowLeadingSemicolon }`) so a project enum's free-text description shares the
  byte bound without inheriting the semicolon rule, rather than adding a second
  near-identical validator.

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking) plus
3 deliberate divergences, two of which the plan itself records.
**Impact on plan:** every auto-fix was required by one of the plan's own stated
truths, and each one removed a contradiction inside the plan rather than adding
scope. No new dependency, no schema change, no new `package.json` `files[]`
entry.

## Issues Encountered

**A `git checkout --` used to revert a planted violation destroyed the task's
uncommitted work.** During Task 2's first planting, `git checkout --
src/mcp/vice/anno-store.ts` was used to undo the planting — but the file's
Task 2 changes were also uncommitted, so the checkout reverted the whole file to
the Task 1 commit. All of Task 2's store code was reapplied from the working
transcript, then a file copy in the scratchpad became the restore mechanism for
the remaining plantings (Task 2's second planting and Task 3's). No work was
lost permanently and the committed result is identical to what was verified;
the cost was one reapplication cycle. **The lesson, for any later plan doing
planted-violation work: copy the file aside before planting, and restore from the
copy — never from git, while the surrounding work is uncommitted.**

## Verification

All run with the **VICE broker stopped** (`systemctl --user is-active
vice-broker` → `inactive`, no `x64sc` process), because a live broker reddens
`BACK-05` deterministically and both `capability-registry.test.ts` and
`stock-dispatch.test.ts` are inside `test:automated`.

| Check | Result |
|---|---|
| `node --test anno-types.test.ts anno-store.test.ts anno-seam.test.ts` | green (15 + 23 + 14) |
| `node --test anno-index.test.ts block-class.test.ts hostpath-consumers.test.ts comment-phase-pointers.test.ts docs-dangling-refs.test.ts` | green |
| `npm run typecheck` | exits 0 |
| `npm run test:automated` | **2582 tests, 6 failures — no failure outside the named baseline.** All six are in `anno-session.test.ts`: the five `plan 18-06:` cases (`the external analyser` absent from `PATH`) plus the known load-sensitive flake at `:615`. The run exits 1 on that baseline alone; the failure list is the gate, not the exit code. |
| `node scripts/check-npm-packages.mjs` | exits 0 |

**Three observed reds, each named in its commit message and reverted before the
commit:**

1. **Collision check removed from `setLabel`** → `not ok 18 - the label
   collision is REFUSED by name before SQLite sees it` (22 pass / 1 fail).
2. **A derived xref row inserted inside `setDataType`** for a `lo_hi_address`
   range → `not ok 22 - nothing derivable is cached …` and, as a bonus, `not ok
   23 - the reserved bank field is never READ` (21 pass / 2 fail).
3. **`resolveSplitTargets` made to ignore its orientation** (`const lowFirst =
   true`) → `not ok 4` (the control, failing with both sets printed: actual
   `2064,4660,49152,53247` against expected `4104,13330,192,65487`) and `not ok
   5` (the planting test, because the real implementation then agrees with the
   collapsed one) — 12 pass / 2 fail.

## Known Stubs

None. No hardcoded empty value, placeholder string, `TODO` or `FIXME` was
introduced, and no test was skipped or left unrun.

## Threat Flags

None. Every threat in the plan's register with disposition `mitigate` was
mitigated as written:

| Threat ID | Mitigation as shipped |
|---|---|
| `T-28-label` | Named refusal thrown before SQLite; no sanitisation step anywhere; DDL `unique(name)` kept as second line of defence and not what the test observes; observed red with the check removed. |
| `T-28-sqli` | Every new statement is `prepare().run()` with bound parameters; `exec()` untouched by this plan's entry points; the two caller-supplied values reaching a `WHERE` clause (label name, enum name) are validated *and* bound. |
| `T-28-secondtruth` | `listXrefs()` empty after typing a `lo_hi_address` range; observed red by writing a derived row inside `setDataType`. |
| `T-28-blob` | `MAX_COMMENT_BYTES` measured in UTF-8 bytes with a `TextEncoder`; enum variant keys each validated against the four numeric-string forms; descriptions share the byte bound. |
| `T-28-basemismatch` | Unprefixed numeric string refused, with the divergence and its reason in the message and asserted in the test. |
| `T-28-vacantcontrol` | Both non-degeneracy assertions run before the differing-set assertion in the same test; the control observed red against the collapsed implementation. |
| `T-28-SC` | Zero installs. Every import added is a relative path inside `src/mcp/vice/`. |

## Requirements

`STORE-01` and `STORE-05` are both **still shared with sibling plans that have
no SUMMARY yet** — `STORE-01` with `28-03`, `STORE-05` with `28-06` — so
`requirements.ready-ids` reported `0/2 ready` and neither was marked complete in
`REQUIREMENTS.md`. That is the shared-ID gate working as designed: an ID must
not read `Complete` until every plan declaring it has finished. Both will become
ready when `28-03` and `28-06` land.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for `28-05`** (wave 3): it consumes `setDataType` and will widen its
  result into `SetDataTypeResult { revision, changed: boolean,
  contradictedComments }`. The `changed: boolean` half is already in place, so
  `28-05` adds the third field rather than changing the first two. It also owns
  the five-overlap-case coverage (`D11` in `28-01`'s ledger) and
  `parseConfidencePrefix()`'s `extends Error` asymmetry.
- **Ready for `28-06`**: `putXref`, `listXrefs` and the ordering guarantee are in
  place for `STORE-04`/`STORE-05`'s revert and cross-process CAS work, and
  `runWriteSequence` now rolls back cleanly on a mutation failure, which the
  cross-process refusal test will depend on.
- **Carried forward:** `P-10` — `28-05`'s import of `./anno-confidence.ts`
  becomes an edit when that module is renamed under `CUT-04`. Recorded in both
  plans; unchanged by this one.
- **No blockers.**

---
*Phase: 28-the-store-core*
*Completed: 2026-08-27*

## Self-Check: PASSED

All four modified source files exist on disk. All four commit hashes
(`7701805`, `df2ebef`, `8991d73`, `35887f1`) resolve in `git log --all`. The
ROADMAP row reads `| 28. The Store Core | v0.7.0 | 3/6 | In Progress | - |`
(hand-repaired after `roadmap.update-plan-progress` emitted the malformed
`| In Progress|  |` form and left the count at 2/6), the phase-28 section's
`**Plans**: 3/6 plans executed in 4 waves` clause agrees with it, and
`STATE.md`'s `completed_plans` reads 8. The one deviation with a lasting API
consequence is recorded in `.planning/WINDOWS.md` as entry 18.
