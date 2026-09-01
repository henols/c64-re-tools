# Carried-forward verify transcripts — the SHAPE Phase 30 must reproduce, not the content it may reuse

> Moved here by **plan 29-10** (2026-08-30), in the commit that deletes
> `src/mcp/vice/anno-verify.ts` and `src/mcp/vice/anno-verify.test.ts`.

## Why these two files exist at all

`module-classification.ts`'s entry for the verify module names its two pinned
transcripts as **the thing that must survive** the module. The module's own
`note` says it plainly:

> what a later phase inherits is the discipline and its two pinned false-pass
> transcripts, **NOT the route**.

The route is now gone. Without this directory the transcripts would have gone
with it, and the founding incident that produced the never-trust-the-exit-code
discipline would survive only as a sentence claiming it happened. That is
exactly the loss the classification registry exists to prevent, so the
transcripts ride forward here.

They live under `.planning/` **deliberately**: that prefix is outside the
removal gate's scanned scope by construction, so carrying them forward needs no
allow-list entry and cannot be mistaken for a reintroduction of the retired
integration.

## What each file is

| File | What it is |
|---|---|
| `verify-honest-pass.txt` | The **honest pass**. Four assembler result lines with real outcomes: two skipped for absence from `PATH`, ACME and ca65 both byte-identical, aggregate line agreeing with the per-line evidence. This is what a correct transcript looks like. |
| `verify-false-pass-trap.txt` | **THE TRAP (D-10).** ACME was *skipped* — never ran, produced no evidence at all — and yet the aggregate line reads `✓ All roundtrip verifications passed.` and the process exited `0`. Observed **live**, on this host, with ACME absent from `PATH` and ca65 present. A verifier that reads the aggregate line, or the exit code, calls this a pass. |

The trap is the whole reason the deleted module derived its verdict **only**
from parsed per-assembler result lines: it required unanimity across every such
line, let no passing line hide a later failing one, refused to guess when two
were present, read a skipped assembler as a **failure** rather than an absence
of evidence, and never consulted the aggregate summary line — because that line
is the one that lied here.

## Provenance

- **Producer:** `the external analyser 0.9.20`'s own `--verify` output, against
  `ACME 0.97 "Zem"` and `ca65`, captured on this host during **Phase 10**.
- **Original capture, unedited, with both live runs' exit codes:**
  `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-verify-transcript.txt`
- **Immediate source of the bytes in this directory:** the
  `HONEST_PASS_TRANSCRIPT` and `TRAP_TRANSCRIPT` string constants in
  `src/mcp/vice/anno-verify.test.ts`, copied verbatim in the commit that
  deleted that file. Requirement anchors: `EXPORT-01`, `EXPORT-03`.

## Phase 30's obligation — read this before using either file

**These are the SHAPE, not the content.** Phase 30 rebuilds the verify route
over a **direct ACME spawn** (`ROADMAP.md` § Phase 30), which is a different
producer emitting different bytes. Phase 30 is therefore obliged to
**re-record both transcripts from real assembler output** — an honest pass and
a genuine false-pass trap provoked against the new route — and to pin *those*
as its fixtures.

Concretely:

- **DO** read these to learn what the two cases are, why the aggregate line and
  the exit code are both untrustworthy, and what a rebuilt verifier must still
  refuse.
- **DO NOT** assert a rebuilt parser against these bytes. They are the retired
  producer's output. A green test against them proves the new parser can read
  *the deleted tool's* format, which is precisely the evidence Phase 30 does
  not need and must not claim to have.
- **DO** carry the discipline: derive the verdict only from per-assembler
  result lines, require unanimity, treat a skipped assembler as a failure, and
  never consult the aggregate line or the exit code.

A later reader who treats these as fixtures to assert against has inherited the
content and lost the point. That is what this paragraph exists to prevent.
