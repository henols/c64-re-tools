# Phase 29: The MCP Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 29-the-mcp-surface
**Areas discussed:** Naming & the coexistence window, Store handle lifecycle & project addressing, Where the read verbs get their bytes, The derivation rule and the cursor verb, The r2000 exit (raised by the user)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Naming & the coexistence window | Prefix for the new family; how an agent picks the right family while both are registered | ✓ |
| Store handle lifecycle & project addressing | Per-call open/close vs session-cached handle; how a call names its store | ✓ |
| Where the read verbs get their bytes | The store's DDL holds no program image | ✓ |
| The derivation rule and the cursor verb | Verbs curated today but absent from the manifest; what `get_disassembly_cursor` becomes | ✓ |

**User's choice:** all four, **plus** a free-text addition: *"The r2000 usage is decided to be removed and if it can't be removed right now everything about it must be disabled an never be included in any tests."*

**Notes:** The free-text addition contradicted ROADMAP.md criterion 2 ("Both families are registered and callable at this phase's close — that is the point of the phase") and `MCP-05`'s coexistence clause. The conflict was raised explicitly before proceeding, along with the consequence that the roadmap and requirement text would need editing and that Phase 29 must then deliver a *complete* replacement rather than a *ready* one. The user did not retract.

---

## The r2000 exit — what "removed / disabled" means

| Option | Description | Selected |
|--------|-------------|----------|
| Unregister + quarantine, keep files (recommended) | Family not registered; files stay on disk for Phase 32; behavioural tests behind MANUAL_ONLY_TESTS; the four structural guards stay live | |
| Delete in Phase 29 — pull CUT forward | `git rm` the modules and tests; Phase 32 collapses into Phase 29 | ✓ |
| Unregister only, tests stay green | Stops being advertised; `r2000-*.test.ts` keeps running until Phase 32 | |

**User's choice:** Delete in Phase 29 — pull CUT forward.
**Notes:** Stated cost of the chosen option, presented before the choice: the new family must be complete on day one, ACME export (Phase 30) has no predecessor left, and Phase 27's capability-or-glue registry gets consumed under deletion pressure rather than read calmly. → CONTEXT D-01.

---

## The r2000 exit — what rides forward with the deletion

| Option | Description | Selected |
|--------|-------------|----------|
| Everything — 29 absorbs 30, 31 and 32 | Surface + renames + skill re-pointing + ACME oracle + grep gate + deletion; ~26k lines; milestone drops to 3 phases | |
| Everything except the ACME oracle | Ordering constraint 2 broken by choice; every export claim inside the window sits at fixture level | |
| Delete only the binary-driving glue | Delete the modules that spawn or speak to regenerator2000; rename the CLI keeping its capability-backed verbs; `export-asm`/`verify` wait for Phase 30 | ✓ (by delegation) |

**User's choice:** "You decide."
**Notes:** Resolved by Claude as the third option, then verified rather than assumed — `r2000-cli.ts`'s import list confirms `bootstrap`, `export-asm` and `verify` are the only verbs reaching `r2000-launch.ts`, so the external dependency can go without inventing an export route ahead of Phase 30's oracle. Facts presented before the question: `module-classification.ts` marks 11 modules `capability` and 8 `glue`, all 19 still carry the prefix on disk, 26,023 lines under `r2000-*.ts`, 16 `files[]` entries, 9 skill files naming 18 distinct `r2000_*` tools, and ordering constraints 2, 3 and 5 all point the other way. → CONTEXT D-02, D-03.

---

## Naming & the coexistence window

| Option | Description | Selected |
|--------|-------------|----------|
| `anno_` / `anno-` (recommended) | Prefix already established on disk by Phase 28; derivable by `readdirSync`; reads narrow for the read verbs | ✓ |
| `c64_` / `c64-` | Domain-named tool surface over `anno-` internals; costs a second prefix | |
| `re_` / `re-` | Matches the repo name; weak namespace token, same two-prefix cost | |

**User's choice:** `anno_` / `anno-`.
**Notes:** Web research surfaced during the question: name collisions across 775 tools in surveyed MCP servers, `search` colliding across 32 distinct servers, and the MCP specification recommending prefix-based disambiguation. → CONTEXT D-05.

---

## Store handle lifecycle & project addressing

| Option | Description | Selected |
|--------|-------------|----------|
| Open/close per call, explicit store path (recommended) | No cross-call state; `revertTo`'s new handle and `transactionStateUnknown` become unreachable across calls; reverses Rule A21, whose premise is deleted | ✓ |
| Session-cached handle, Rule A21 continuity | Fewer opens, carries Phase 18's precedent; wedged-handle class becomes reachable | |
| Per call, path derived from workspace | Simplest surface; makes the `unconfinedModuleDerivedPath` escape the normal path | |

**User's choice:** Open/close per call, explicit store path. → CONTEXT D-06.

---

## Where the read verbs get their bytes

| Option | Description | Selected |
|--------|-------------|----------|
| Required image path argument per call (recommended) | Explicit, resolved under `workspaceRoot`, decoded by `prg-image.ts`; chatty | ✓ |
| Recorded once in `anno_meta` | One place to get wrong, hash makes drift loud; needs a `SCHEMA_VERSION` bump and creates a second on-disk truth | |
| Per call, defaulting to a recorded path | Most convenient; an omitted argument reads as a plausible-looking success — the shape `MCP-04` exists against | |

**User's choice:** Required image path argument per call. → CONTEXT D-07.

---

## The derivation rule and the cursor verb

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest check + a criterion register (recommended) | Mechanical check over the manifest's three dispositions; unclassified verbs in a second register citing requirement ids; cursor folded into the disassemble verb's address argument | ✓ |
| Amend the manifest instead | Single check covers everything; but the manifest describes upstream at a pinned commit and its sha256 comparison stops meaning what it says | |
| Manifest-only, drop the extras | Cleanest check; cannot satisfy criterion 5 / `STORE-06`, which require search | |

**User's choice:** Manifest check + a criterion register. → CONTEXT D-08, D-09.

---

## Claude's Discretion

- **What rides forward with the deletion** — answered "You decide", resolved as CONTEXT D-02 after verifying the CLI's verb-to-module dependencies.
- Three guard fates were presented as Claude's calls and left unchallenged when the user chose "Ready for context": `check-skill-fork-honesty.mjs:504` (strip the route from the skill, re-point the assertion — D-10), `r2000-answer-key.test.ts` (rename and keep — D-11), and `docs-r2000-decisions.test.ts` ↔ `audit-gate.mjs:136` (move together in one commit — D-12).
- Left to the researcher and planner rather than put to the user: the grep gate's scope predicate, the `{available:false, reason}` envelope shape, the batch verb's recursive pre-validation, how `coverage`/`COV-01` re-points off the r2000 project-JSON shapes, and whether Phases 30–32 are renumbered or merely narrowed.

## Deferred Ideas

- ACME export and the real-ACME oracle — Phase 30, unchanged.
- Automatic annotation — Phase 26, held for v0.8.0.
- `packer-finding.mjs`'s `entropySource = "r2000_get_binary_info"` — a stored fact about a past run; fate decided explicitly during the skill re-pointing.
- `render-memmap`'s independence from the store; a retarget must not read the `installer/skills/` copy.
- Nine keyword-matched todos reviewed, none folded — all out of domain. Enumerated in CONTEXT.md's `<deferred>`.

## Closing check

**Question:** Ready for CONTEXT.md, or dig further?
**User's choice:** Ready for context.
