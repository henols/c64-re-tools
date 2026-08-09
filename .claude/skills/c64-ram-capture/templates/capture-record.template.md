# Capture record — `<release>-<checkpoint>-run<N>`

One record per capture. Every field is recorded **in the same step as the
capture**, before the machine is resumed — a value read later describes a
different machine.

## Identity

| Field | Value | How obtained |
|---|---|---|
| image path | `recovery/<release>/dumps/<name>.bin` | — |
| size | `65536` bytes | must be exact; anything else is not a full image |
| sha256 | `<64 hex chars>` | `node scripts/compare.mjs digest <name>.bin` |
| checkpoint / trigger address | `$____` | the address armed for this capture |
| release | the registry id this capture belongs to | — |
| run | `<N>` of `<total>` | three runs is this project's minimum for a verified capture |

## Machine state at the capture instant

Read these *before* resuming, in the same paused window as the memory reads.

| Field | Value | Source |
|---|---|---|
| `$01` (processor port) | `$__` `%________` | `vice_memory_read` — decides which vectors are live |
| video standard | PAL \| NTSC | `vice_vicii_get_state` |
| registers (PC, A, X, Y, SP, flags) | | `vice_registers_get` |
| epoch-drift errors during the capture | `none` | the proxy raises these itself, before and after every forwarded call — no tool reads the epoch on demand |
| checkpoints armed at exit | `0` | `vice_checkpoint_list` — accept only this enumeration as proof |

## Verdict

- [ ] Size is exactly 65536 bytes.
- [ ] No epoch-drift error appeared at any point during the capture.
- [ ] `vice_checkpoint_list` reported zero checkpoints before resuming.
- [ ] Machine resumed exactly once, at the end.

If any box is unchecked, void the run: rename each artifact to
`<name>.VOID-<UTC timestamp>`, write a sibling note giving the reason and — when a
drift error was the cause — both epoch values quoted from that error's own text,
and keep the voided artifacts on disk.

## Comparison against sibling runs

`node scripts/compare.mjs compare <a>.bin <b>.bin` for each pairing, and
`node scripts/compare.mjs floor <a>.bin <b>.bin <c>.bin` across the set.

| Pairing | volatile | drift (1 bit) | divergence (2+ bits) | verdict |
|---|---|---|---|---|
| run1 vs run2 | | | | |
| run1 vs run3 | | | | |
| run2 vs run3 | | | | |

Record the drift floor address count, and state it as a floor rather than a
complete set — more captures of the same checkpoint can only widen it.

**Any divergence inside `$D000-$DFFF` is not a divergence.** That range is
register images, not RAM: reading it samples live hardware, so it can never be
stable across two captures. Classify it as volatile and say so in the record
rather than voiding a good capture over it.
