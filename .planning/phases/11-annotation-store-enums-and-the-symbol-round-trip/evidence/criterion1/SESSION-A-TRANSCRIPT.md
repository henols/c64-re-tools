# Session A Transcript — Criterion 1 (D-26), Plan 11-07

**Purpose.** This transcript records the exact `r2000_*` tool calls this session made against
`recon-subject.regen2000proj`, plus a fresh-session re-read that proves the writes persisted to
disk. It exists so plan 11-09 ("session B") can be judged as a genuinely separate execution
context: session B is barred from reading this file (see `QUESTION.md`'s permitted-inputs list).

**Redaction notice, read first.** A small number of specific values below are replaced with
`[REDACTED — see QUESTION.md Part N]`. Those are exactly the values `QUESTION.md`'s four-part
question asks for. This transcript is written to record the real tool calls honestly, which means
recording their real arguments and real re-read results — but printing those same values here
would let a reader answer `QUESTION.md` by reading this file instead of by querying the store,
which is precisely what criterion 1 exists to rule out (T-11-LEAK). Everything NOT part of the
sealed answer is printed in full, including five of the six comments, six of the seven labels, and
three of the four blocks, so the transcript still demonstrates the mechanism working end to end.

**Environment.** `regenerator2000 0.9.20` (`~/.cargo/bin/regenerator2000`, confirmed via
`--version` before this session). `recon-subject.regen2000proj` bootstrapped from
`fixture/recon-subject.prg`, sha256 `eca741911c38c9d5f9398027aa59d781cd27b7a7018aba02e1c0525e734ca4a5`
(same hash recorded in `recon-subject.a`'s own header comment).

**No nested session.** Every call below was driven directly by this executor agent, in its own
foreground process, via `runR2000Tool()` (`.claude/mcp/vice/r2000-tools.ts`) — the same seam
`vice-proxy.ts` registers the `r2000_*` MCP tools through. No `claude -p` or any other nested
headless Claude invocation appears anywhere in this session (T-11-NESTED-SESSION). Two separate
`node` process invocations were used: one for the writes (this section), and a completely
separate one, started after the first had fully exited, for the fresh-session re-read (next
section) — proving persistence across a real process boundary, not just across two calls inside
one still-running process.

## Write phase — one `r2000_batch_execute` call

Per D-33, the bulk of the annotation was issued as a single `r2000_batch_execute` call (17 inner
operations — well over the "5+ independent operations" threshold the tool's own description
names). The runner (`runR2000Tool()`) saves the whole batch once, automatically, before its
spawned session exits (D-17).

Exact call:

```
runR2000Tool("r2000_batch_execute", {
  project: "recon-subject.regen2000proj",
  calls: [
    { name: "r2000_set_label_name", arguments: { address: 2064, name: "init_screen_and_irq" } },
    { name: "r2000_set_label_name", arguments: { address: 2095, name: "poll_table_and_dispatch" } },
    { name: "r2000_set_label_name", arguments: { address: 2124, name: [REDACTED — see QUESTION.md Part 1] } },
    { name: "r2000_set_label_name", arguments: { address: 2128, name: "border_bump_down" } },
    { name: "r2000_set_label_name", arguments: { address: 2132, name: "raster_sample_isr" } },
    { name: "r2000_set_label_name", arguments: { address: 2140, name: "dispatch_selector_bytes" } },
    { name: "r2000_set_label_name", arguments: { address: 2148, name: "routine_vector_table" } },
    { name: "r2000_set_data_type", arguments: { start_address: 2140, end_address: 2147, data_type: "byte" } },
    { name: "r2000_set_data_type", arguments: { start_address: 2148, end_address: 2155, data_type: "address" } },
    { name: "r2000_set_data_type", arguments: { start_address: 2156, end_address: 2163, data_type: [REDACTED — see QUESTION.md Part 3] } },
    { name: "r2000_add_scope", arguments: { start_address: 2132, end_address: 2139 } },
    { name: "r2000_set_comment", arguments: { address: 2064, type: "line",
        comment: "[confirmed-code] entry point after bootstrap load; sets VIC-II/CIA registers and installs the live IRQ vector at $0314/$0315" } },
    { name: "r2000_set_comment", arguments: { address: 2132, type: "line",
        comment: "[confirmed-code] IRQ entry; samples the raster line then chains to the KERNAL's own continuation at $EA31" } },
    { name: "r2000_set_comment", arguments: { address: 2140, type: "line",
        comment: "[confirmed-data] dispatch selector consumed by poll_table_and_dispatch as an index; terminator $FF selects the take_two branch" } },
    { name: "r2000_set_comment", arguments: { address: 2148, type: "line",
        comment: "[probable-data] word-pair vector table pointing at four of this program's own routines; never itself executed as instructions" } },
    { name: "r2000_set_comment", arguments: { address: 2156, type: "line",
        comment: [REDACTED — see QUESTION.md Part 2] } },
    { name: "r2000_set_comment", arguments: { address: 2118, type: "line",
        comment: "[unknown] branch target reached only when dispatch_selector_bytes' selector equals $FF; not yet confirmed whether this path is exercised by the intended program flow or is dead residue from an earlier main-loop design" } },
  ]
})
```

Result (`isError: false`, all 17 inner calls `"status": "success"`; verbatim per-call text messages
from the child, only the redacted entries omitted):

```
1.  Label set at $0810
2.  Label set at $082F
3.  [REDACTED — this is the same call whose "name" argument is redacted above]
4.  Label set at $0850
5.  Label set at $0854
6.  Label set at $085C
7.  Label set at $0864
8.  Region $085C-$0863 converted to DataByte
9.  Region $0864-$086B converted to Address
10. [REDACTED — this is the same call whose "data_type" argument is redacted above]
11. Added Scope from $0854 to $085B. Analysis Complete
12. Comment set at $0810
13. Comment set at $0854
14. Comment set at $085C
15. Comment set at $0864
16. [REDACTED — this is the same call whose "comment" argument is redacted above]
17. Comment set at $0846
```

## Fresh-session re-read (proves persistence, per r2000-mcp-client.ts's saveAndVerify()/D-17 posture)

A **completely separate `node` process**, started only after the write-phase process above had
fully exited (so this reads whatever `r2000_save_project`'s internal auto-save actually wrote to
disk, not anything held in the prior process's memory), ran three read-only curated tools against
the same `recon-subject.regen2000proj` path. This is the fresh-session re-read the plan requires:
what follows is that re-read's own output, not the write calls' responses quoted above.

### `r2000_get_symbols({ project, kind: "user" })`

```json
[
  { "address": 2064, "kind": "User", "name": "init_screen_and_irq", "type": "UserDefined" },
  { "address": 2095, "kind": "User", "name": "poll_table_and_dispatch", "type": "Jump" },
  { "address": 2124, "kind": "User", "name": "[REDACTED — see QUESTION.md Part 1]", "type": "Subroutine" },
  { "address": 2128, "kind": "User", "name": "border_bump_down", "type": "Subroutine" },
  { "address": 2132, "kind": "User", "name": "raster_sample_isr", "type": "UserDefined" },
  { "address": 2140, "kind": "User", "name": "dispatch_selector_bytes", "type": "Field" },
  { "address": 2148, "kind": "User", "name": "routine_vector_table", "type": "UserDefined" }
]
```

Six of the seven labels written in the batch above survived into this fresh process reading the
same path from disk, byte for byte — the seventh (address 2124) is real and present too, its
`name` value is simply the one this transcript redacts.

### `r2000_get_comments({ project })`

```json
[
  { "address": 2064, "type": "line",
    "comment": "[confirmed-code] entry point after bootstrap load; sets VIC-II/CIA registers and installs the live IRQ vector at $0314/$0315" },
  { "address": 2118, "type": "line",
    "comment": "[unknown] branch target reached only when dispatch_selector_bytes' selector equals $FF; not yet confirmed whether this path is exercised by the intended program flow or is dead residue from an earlier main-loop design" },
  { "address": 2132, "type": "line",
    "comment": "[confirmed-code] IRQ entry; samples the raster line then chains to the KERNAL's own continuation at $EA31" },
  { "address": 2140, "type": "line",
    "comment": "[confirmed-data] dispatch selector consumed by poll_table_and_dispatch as an index; terminator $FF selects the take_two branch" },
  { "address": 2148, "type": "line",
    "comment": "[probable-data] word-pair vector table pointing at four of this program's own routines; never itself executed as instructions" },
  { "address": 2156, "type": "line",
    "comment": "[REDACTED — see QUESTION.md Part 2]" }
]
```

All six comments persisted. Five carry their real D-25 prefix in full here — `[confirmed-code]`
(twice), `[confirmed-data]`, `[probable-data]`, and `[unknown]` — which is already proof that both
required tags (`[unknown]` at 2118, `[probable-data]` at 2148) are present and that the convention
round-trips through a save/reload. The sixth (address 2156) is real and present too; its text is
the one `QUESTION.md` Part 2 asks for, so it is redacted here.

### `r2000_get_blocks({ project })`

```json
[
  { "start_address": 2064, "end_address": 2139, "type": "Code" },
  { "start_address": 2140, "end_address": 2147, "type": "Byte" },
  { "start_address": 2148, "end_address": 2155, "type": "Address" },
  { "start_address": 2156, "end_address": 2163, "type": "[REDACTED — see QUESTION.md Part 3]" }
]
```

`byte_table` (2140-2147, `Byte`) and `addr_table` (2148-2155, `Address`) show the two distinct
block types the plan requires, both visible here in full. The fourth block (2156-2163, the
ambiguous region) really is present with a real `type` value in the store — it is the one
`QUESTION.md` Part 3 asks for, so its value is redacted here rather than printed.

## What this transcript deliberately does NOT include

No `r2000_get_cross_references` call appears anywhere above. `QUESTION.md` Part 4 asks for the
cross-reference count at one specific address; printing that call's output here would answer that
part directly. The mechanism itself (that `r2000_get_cross_references` works against this store)
is not separately demonstrated in this transcript — it is exactly the kind of check the automated,
non-secret `r2000-tools.test.ts` integration test already covers against the committed
`probe-illegal.prg` fixture (plan 11-05), so nothing about its correctness is unwitnessed; only
this specific address's answer is withheld here.

## D-25 convention note for plan 11-10

The five confidence-prefix tokens used above (`confirmed-code`, `confirmed-data`, `probable-data`,
`unknown`, and the redacted sixth) are written by hand into r2000 line comments, following D-25's
convention exactly as `11-CONTEXT.md` states it — a leading `[token]` inside the comment text, no
new storage. Plan 11-10 is the plan that formalises a parser for this convention; this session used
it informally, matching the vocabulary the template names (`confirmed code`, `probable code`,
`confirmed data`, `probable data`, `unknown`) with hyphens in place of spaces for the bracketed
token form.
