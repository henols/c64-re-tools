# Phase 64: Files as Bytes, Both Directions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 64-Files as Bytes, Both Directions
**Areas discussed:** Where the bytes ride, Staged-upload lifetime, Cap and integrity, Tool argument shapes, How the phase proves itself, host-tool header reconciliation

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Reap vicerc scratch dirs | Tagged `resolves_phase: 64`; 4,779 leaked dirs measured on a tmpfs | |
| Orphaned result chunking | Dead `maxResultSizeChars` advertisement and a `vice_result_continue` that can only refuse | |
| Fold for awareness only | Neither becomes deliverable work | |

**User's choice:** "you decide" — delegated to Claude.
**Claude's disposition:** vicerc reaping folded as **real work** (its `resolves_phase` tag and 62-CONTEXT's "reaping it is Phase 64" both point here); result chunking folded **for awareness only** (a cap on tool-result characters, not on payload bytes — a different axis). Recorded in CONTEXT.md's Folded Todos with the lifetime-rule caveat that drove D-08.

---

## Where the bytes ride

### Q1 — Which connection carries a file payload?

| Option | Description | Selected |
|--------|-------------|----------|
| Stateless transfer connection | Bytes on a short-lived connection presenting a broker-minted handle; command stays on the grant connection | ✓ |
| The grant connection itself | `{"op":"upload"}` then bytes on the long-lived control connection — the `attach` shape | |
| You decide | | |

**Notes:** Chosen because it resolves the REQUIREMENTS-decision-6 vs ROADMAP-ownership-constraint tension rather than picking a side. Claude surfaced during the discussion that Phase 63 already shipped this exact pattern — `attach` is deliberately not gated by `ownsTarget()` and is authorised by its handle alone (`broker-control.mts:1360-1363`, T-63-01). Rejected option's cost: the control connection would block for the whole transfer.

### Q2 — How is the byte segment framed?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON header line, then exactly N bytes | The `readAttachLine()` precedent; no new envelope format | ✓ |
| Length-prefixed chunks | `[4B BE length][payload]` repeated; streams without a known total | |
| You decide | | |

**Notes:** Research surfaced the common `[4B BE length][1B type][payload]` IPC codec with a 16 MiB cap, and the general point that length-prefixed and newline-delimited framings are routinely combined. base64-inside-the-JSON-line was deliberately not offered — `MAX_LINE_BYTES` is 65536, it inflates 33%, and it returns a payload to string mode.

### Q3 — What happens to the two remaining string framers?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them; record why | Unreachable by construction — the transfer rides `broker-endpoint.ts`, which may not import the legacy module | ✓ |
| Convert them anyway | Mirror Phase 63's wholesale broker-side conversion | |
| You decide | | |

**Notes:** Claude measured that the ROADMAP's three-site constraint is partly stale — `broker-control.mts` was already converted by Phase 63, and the other two sites are in the module `RM-02` deletes in Phase 66.

### Q4 — How does a payload move, given the mandated flow control?

| Option | Description | Selected |
|--------|-------------|----------|
| Stream through a hashing Transform | `createReadStream → hashAndCount → socket`; `pipe()` owns backpressure | ✓ |
| Manual write/drain loop | Explicit `write()`/`drain`; direct control over cap and digest placement | |
| You decide | | |

**Notes:** The rejected option is the hand-rolled copy loop `broker-relay.mts`'s header forbids. Accepted cost: the cap can fire mid-stream, so the refusal path must unwind a partial write.

---

## Staged-upload lifetime

**Claude flagged before asking:** the ROADMAP's own offered option — "deleted as soon as its `AUTOSTART` reply confirms consumption" — is unsafe. The reply confirms acceptance, not completion, and a `vice_disk_attach` image stays attached for the session. It was therefore not offered.

### Q1 — How long does a staged upload live?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-slot, superseded on reuse | Keyed by (grant, kind/unit); bounded to one file per slot | ✓ |
| Retained for the life of the session | Simplest rule; every upload survives until close | |
| You decide | | |

### Q2 — Where do staged files live, at what granularity?

| Option | Description | Selected |
|--------|-------------|----------|
| One directory per session | `rm -rf` of one directory is the whole cleanup | ✓ |
| One flat staging directory | Per-file bookkeeping | |
| You decide | | |

### Q3 — What triggers the crash sweep?

| Option | Description | Selected |
|--------|-------------|----------|
| Broker startup only | SESS-03/04 already reclaim on socket events; only crash residue remains | ✓ |
| Startup plus a periodic timer | Also sweeps on an interval | |
| You decide | | |

### Q4 — Do the vicerc scratch dirs move under the machine-level root?

| Option | Description | Selected |
|--------|-------------|----------|
| Move under `VICE_BROKER_HOME` and reap | Makes BROKER-06 true for all broker-owned scratch | ✓ |
| Reap in place under `tmpdir()` | Smaller change, no BROKER-06 reconciliation | |
| You decide | | |

**Notes:** Named cost stated in the question and accepted — moving off the tmpfs stops the RAM leak but lands the dirs on real disk where they survive reboot, making the sweep load-bearing. Claude recorded afterwards that the two kinds have opposite lifetime rules, so the live-pid guard from the todo's own sketch becomes mandatory.

---

## Cap and integrity

**Not asked, settled by precedent:** sha256 (`host-tool.mts:2282`) and write-to-temp-then-`renameSync` (five modules). The `fsync`-on-Windows limit already has a recorded accepted disposition.

### Q1 — What is the size cap?

| Option | Description | Selected |
|--------|-------------|----------|
| 16 MiB | ~19× the largest fixed C64 artifact; matches the common IPC cap | ✓ |
| 64 MiB | Headroom for Phase 65's Ghidra outputs so the number is not reopened | |
| You decide | | |

**Notes:** Sizing data presented: `.d64` 174,848 / `.d71` 349,696 / `.d81` 819,200 / `.g64` ≈1 MB / `.prg` ≤64 KB. Accepted cost: Phase 65 may have to revisit the number.

### Q2 — Constant or environment knob?

| Option | Description | Selected |
|--------|-------------|----------|
| Constant, no knob | Follows Phase 62's D-09, where the env-override variant was offered and declined | ✓ |
| Constant with an env override | One more knob | |
| You decide | | |

### Q3 — Where is the cap enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Both ends | Sender from the declared length; receiver independently, because a declared length is untrusted | ✓ |
| Receiver only | One enforcement point | |
| You decide | | |

### Q4 — Uniform or per file kind?

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform across all four tools | Transfer layer stays ignorant of C64 file formats | ✓ |
| Per kind | Tighter bounds; catches a wrong-kind file by size | |
| You decide | | |

---

## Tool argument shapes

**Claude surfaced an unnamed regression before asking:** a game's writes to an attached disk now land in the broker's staged copy, which dies with the session. Named nowhere in ROADMAP.md or REQUIREMENTS.md.

### Q1 — Who names the destination file on a download?

| Option | Description | Selected |
|--------|-------------|----------|
| Client keeps the name; validator is defensive | XFER-03's validator built and tested but with no live producer until Phase 65 | ✓ |
| Broker supplies the name in the download header | Gives XFER-03 a live producer now | |
| You decide | | |

### Q2 — Does `vice_autostart`'s unrestricted client path survive?

| Option | Description | Selected |
|--------|-------------|----------|
| Stays unrestricted | Preserves today's behaviour; confining it would be a regression dressed as hardening | ✓ |
| Confined to the workspace | Symmetric with download containment | |
| You decide | | |

**Notes:** Accepted cost, stated in the question: with a machine-level shared broker this is a route for reading any client-readable file into broker-owned staging, bounded by the 16 MiB cap and the session-scoped staging dir.

### Q3 — What replaces the result's `sentPath`?

| Option | Description | Selected |
|--------|-------------|----------|
| Replaced by the opaque handle | Not a path, so criterion 2 holds; keeps a wedge-triage correlation thread | ✓ |
| Removed outright | Most literal reading of criterion 2 | |
| You decide | | |

### Q4 — What happens to a game's writes to an attached disk?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept the loss, document it by name | Staged image is write-through-to-nowhere | ✓ |
| Pull the image back on session close | Preserves old behaviour on a clean close only | |
| You decide | | |

**Notes:** Claude measured that a read-only attach is not reachable — no resource-set tool on the advertised surface (47 `vice_*` tools) and `AUTOSTART` has no read-only flag.

---

## How the phase proves itself

**Claude established first:** `260914-poo` D-1 ("No test may assert on text at all") is locked, and ROADMAP.md's Phase 53 withdrawal records that moving such a check into CI does not escape it.

### Q1 — How is "no shared filesystem" proved?

| Option | Description | Selected |
|--------|-------------|----------|
| Injected fs root that refuses outside itself | Runtime, behavioural, D-1 clean; needs a real production seam | |
| Disjoint roots plus observation | No production seam; proves nothing leaked, not that nothing was opened | ✓ |
| Real container run in CI | The only true proof; heavy, and this repo has no devcontainer | |

**Notes:** **Chosen against Claude's recommendation.** The weaker guarantee was stated in the option text and taken knowingly. Two consequences recorded in CONTEXT.md: the transfer modules need no injectable filesystem seam (out of scope), and a source-scanning guard is not an available fallback.

### Q2 — How is the convergence metric (6 → 4) evidenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Measured and recorded, not asserted | Honours D-1; Phase 66's exit is the gate | ✓ |
| Mechanical import assertion | Live precedent exists but is a source-text scan | |
| You decide | | |

**Notes:** Claude surfaced that `anno-hazard-report.test.ts:1127` still runs a source-text regex and survived the D-1 purge, so the precedent is genuinely mixed.

---

## host-tool header reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it entirely to Phase 65 | Nothing is stale at this phase's exit; rule and reality move together in Phase 65 | ✓ |
| Amend the second clause now | Avoids Phase 65 inheriting a half-true rule | |
| You decide | | |

**Notes:** Claude measured that the prohibition has two clauses with different fates — "no inline byte payload" survives the whole milestone under the chosen transfer design, and only "every result crosses as `{ path, sha256, byteLength }`" goes stale. The rejected option is D-11's shape from Phase 62, which left Phase 66 with a ledger to reconcile.

---

## Claude's Discretion

One delegation: the todo cross-reference disposition. Recorded above and in CONTEXT.md's Folded Todos with its reasoning.

Fifteen of nineteen decisions were taken as the recommended option. One (D-17, the proof method) was taken against the recommendation, with its weaker guarantee carried into CONTEXT.md verbatim.

## Deferred Ideas

- A read-only disk attach, to make D-16's loss visible rather than silent — not reachable on the current tool surface.
- Revisiting the 16 MiB cap in Phase 65 for Ghidra artifacts — a foreseen reopening.
- No mechanical guard on the convergence metric between Phase 64 and Phase 66.
- `wrapPossiblyChunked()`'s orphaning still needs a product decision on its own axis.
- `CR-01` at `text-protocol.ts:850` — not planned to be touched; record it as a deliberate closure if a plan lands there.
