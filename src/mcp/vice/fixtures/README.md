# Frozen fixtures — bash broker/epoch contract

These three files were captured **live**, on 2026-08-03, from the running bash broker's own
`.vice-supervisor/` state tree, before `vice-supervisor.sh` and `vice-broker.sh` are deleted by
this phase. They are the "before" half of the epoch and broker record contracts that the new
TypeScript broker (`vice-broker.mts`, `broker-epoch.mts`) must reproduce.

## Source paths

| Fixture | Captured from | Observed mode |
|---|---|---|
| `bash-epoch-6510.json` | `.vice-supervisor/6510/epoch.json` (first-launched instance, port 6510) | `600` |
| `bash-epoch-6514.json` | `.vice-supervisor/6514/epoch.json` (last-launched instance, port 6514) | `600` |
| `bash-broker.json` | `.vice-supervisor/broker.json` | `600` |

Two epoch instances were captured, not one, so a per-instance difference in the record (the port
embedded in `vice_args`, the `log` filename, `spawned_at`) is visible in the frozen evidence rather
than inferred from a single sample. At capture time `bash-broker.json`'s `written_by` field read
`"vice-broker.sh"` — the retiring bash daemon's own filename — which is the "before" half of D-26
(the new broker's `written_by` must instead name the deployed JavaScript artifact; task 3 of this
plan changes what the *new* writer emits, not this frozen fixture).

## These are FROZEN EVIDENCE

These three files are **frozen evidence of a contract whose writer this phase deletes.** They are
never to be regenerated, reformatted, "tidied", or hand-edited. `broker-epoch.test.ts` asserts the
epoch contract directly against them; if the bash daemon's behavior is ever in question after it is
gone, this is the only concrete record of what it actually wrote.

Evidence: direct read of live runtime state at `.vice-supervisor/` on the running bash broker
(4 recorded instances at capture time), copied byte-for-byte (`diff` confirmed zero output against
the live source files at capture time, while those live files still existed).
Confidence: HIGH.

---

# Planted-violation fixtures

`planted-*` files in this directory are **deliberate violations**, committed so a
structural guard can be proven by observing it bite rather than by reading it. They carry a
`.txt` suffix (or an inert extension) so that no TypeScript program, no `node --test` glob and no
runtime import ever loads them.

| Fixture | Guard it belongs to | Route it plants |
|---|---|---|
| `planted-disposition-fixture.md` | `docs-review-disposition.test.ts` | a review finding left without a disposition |
| `planted-review-fixture.md` | `docs-review-disposition.test.ts` | a review document the disposition scan must reject |
| `planted-hop-chain-fixture.ts.txt` | `hop-chain-comments.test.ts` | a comment hop chain that does not resolve |
| `planted-phase-pointer-fixture.ts.txt` | `comment-phase-pointers.test.ts`, `hop-chain-comments.test.ts` | a comment pointing at a phase that does not exist |

Each guard reaches its fixture by an explicit path, never by a directory scan, so adding a
fixture here does not silently enrol it in an unrelated guard.
