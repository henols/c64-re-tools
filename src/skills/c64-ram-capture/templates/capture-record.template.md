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
| binary sha256 | `<64 hex chars>` | `sha256sum <release>.d64` (or `.prg`), or `node scripts/compare.mjs digest <release>.d64`. This identifies the release by its **bytes**, never by its filename |
| argv digest | `<64 hex chars>` | `argvDigest()` in `src/mcp/vice/capture-predicate.ts` — sha256 over the **exact spawn argv array joined by a single NUL byte**. **Order-sensitive by construction**, which is the whole reason it is a field of its own. It refuses an empty argv array rather than digesting the empty string, so a blank here is a blank and never a plausible-looking digest |
| seed | `4242` | the `-seed` value the instance was launched with — `STOCK_DETERMINISM_SEED` in `src/mcp/vice/broker-launch.mts`. Cite the constant, not a loose number |
| capture route | `memory-read` \| `snapshot` | `memory-read` = the sixteen `vice_memory_read` calls, transcribed. `snapshot` = `node scripts/vsf-slice.mjs slice <run>.vsf --out <run>.bin`. **This row decides which volatility rule applies to this record** — see the closing note |
| checkpoint / trigger address | `$____` | the address armed for this capture |
| release | the registry id this capture belongs to | — |
| run | `<N>` of `<total>` | three runs is this project's minimum for a verified capture |

### The reproducibility key is the triple, not the seed

**`(binary sha256, argv digest, seed)`.** All three rows, together. Two captures
share a reproducibility key only when all three fields are exactly equal.

**MEASURED: the same seed with a reordered argv yielded a 76-byte-different
image.** So the seed alone is not the key, and a record keyed on it claims a
reproducibility it does not have. Two captures whose argv digests differ are
**different keys and must not be compared as a pair**, even at the same seed —
including when the difference is a single reordered element, because the digest
is order-sensitive and a reordered argv is a different launch.

**A record with any of the three fields blank is not a reproducible capture.**
The void protocol below applies to it: it is not a capture with a gap in its
paperwork, it is a capture whose identity cannot be established.

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
- [ ] All three reproducibility-key fields — `binary sha256`, `argv digest`, `seed` — are filled. A blank in any one of them fails this box.
- [ ] The `capture route` row is filled, so a reader knows which volatility rule this record is under.
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

### `$D000-$DFFF`: the rule depends on the `capture route` row

This exclusion is a property of **how the image was transcribed**, not of the
C64. Read the `capture route` row and apply the matching half. Getting this
backwards costs a good capture in one direction and hides 4096 addresses of real
divergence in the other.

| `capture route` | Rule for `$D000-$DFFF` |
|---|---|
| `memory-read` | **Any divergence inside `$D000-$DFFF` is not a divergence.** On this route the range is read through `vice_memory_read`, which samples live I/O: the VIC's registers repeat every `$40` across `$D000-$D3FF` and the SID's across `$D400-$D7FF`, so two reads can never agree there. Classify it as volatile, say so in the record, and do not void a good capture over it. |
| `snapshot` | **The exclusion does not apply, and a divergence there is a real divergence.** A `.vsf`-sliced image is the `C64MEM` array — `mem_ram[]`, which is RAM *under* I/O and not the register read view — so those 4096 addresses are ordinary RAM in a sliced image. There is no transcription step on this route to sample anything. Do not carry the memory-read exclusion across. |

Both halves are live: records taken on the memory-read route still exist and
still need the first row. What is not permitted is applying either half without
reading which route produced the image.
