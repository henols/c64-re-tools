# Phase 30 verify transcripts — re-recorded from real ACME, through this phase's own producer

> Written by **plan 30-02** (2026-08-30), the plan that earns EXPORT-01's two
> mandatory reds against the rebuilt route.

**These are real captures, not synthesized.** Each transcript is the output of a
real ACME 0.97 run and of `verifyAcmeAssembles()`'s own verdict over the same
source, produced by `capture-transcripts.mjs` in this directory. Nothing here
was trimmed, re-wrapped, redacted, or otherwise edited after capture, beyond the
one declared substitution recorded under *Known sources of non-determinism*
below (temp directory paths become the placeholder `<TMPDIR>`).

## What is in this directory

| File | What it is |
|---|---|
| `verify-honest-pass.txt` | The **honest pass**. One annotation store, one code range, one image, exported to ACME source, assembled by a real ACME, settled by a byte-diff. Carries the exact argv, ACME's stdout and stderr verbatim, and the resulting `AcmeVerifyResult` field by field. Note the stderr **Warning** on a byte-correct assembly, which did *not* make the outcome `failed`. |
| `verify-false-pass-trap.txt` | **The trap, provoked against the NEW route** — three sections, each with real output and each ending with the verdict rule that refuses it: (1) the missing assembler, where the historical truthiness classifier answers `ran` for a spawn that never ran; (2) the stale output file, where ACME exits 1 and leaves a pre-existing file byte-for-byte untouched; (3) exit zero on a wrong byte, where ACME reports success and the byte-diff catches it anyway. |
| `capture-transcripts.mjs` | The program that produced both. See *Regenerating*. |

## Provenance

| File | Producer | Assembler | Host | Captured at | Requirement anchor |
|---|---|---|---|---|---|
| `verify-honest-pass.txt` | `src/mcp/vice/anno-export-asm.ts` (`exportAsm()`) + `src/mcp/vice/acme-verify.ts` (`verifyAcmeAssembles()`), plan 30-01/30-02 | `ACME 0.97 "Zem", 31 Jan 2021`, resolved from `ACME_BIN="acme"` at `/home/henrik/.local/bin/acme` | this development host (Linux, `/tmp` RAM-backed) | 2026-08-30T22:00:23Z | `EXPORT-01` |
| `verify-false-pass-trap.txt` | the same two modules, plus direct `spawnSync(ACME_BIN, …)` runs for the vectors ACME itself has to demonstrate | `ACME 0.97 "Zem", 31 Jan 2021`, same path | same host | 2026-08-30T22:00:23Z | `EXPORT-01`, `EXPORT-03` |

The exact invocation that produced each is recorded *inside* each transcript,
under its `ACME ARGV` / `argv:` line, with temp paths placeholdered. The verify
argv is not retyped there: `capture-transcripts.mjs` rebuilds it from
`acme-verify.ts`'s own exported `ACME_VERIFY_ARGV_FLAGS`, so a flag added to the
module and not to the transcript is impossible rather than merely unlikely.

## DO / DO NOT — and the Phase 29 obligation, answered by name

`.planning/phases/29-the-mcp-surface/fixtures/README.md` § *Phase 30's
obligation* set a task and a prohibition. Both are discharged here:

- **DO** read *these* transcripts to learn what an honest pass and a genuine
  false-pass trap look like against the route that actually exists now.
- **DO NOT** assert anything in this phase against the **Phase 29** transcripts.
  Those were read **for shape only** — the "what each file is" table, the DO /
  DO-NOT block, and the obligation itself — and they are **never asserted
  against**, because a green test over the retired producer's bytes would prove
  the new parser can read *the deleted tool's* format. That is precisely the
  evidence this phase does not need and must not claim to have.
- **DO NOT** hand-edit either `.txt`. They are captured output; see
  *Regenerating*.
- **DO** carry the discipline the Phase 29 README names: derive the verdict only
  from ACME's own per-item result lines, require unanimity, treat a skipped
  assembler as an absence of evidence that is never a pass, and never consult
  the aggregate line or the exit code.

`src/mcp/vice/acme-verify.test.ts` enforces the prohibition mechanically. It
asserts that no `*.test.*` file under `src/mcp/vice/` names the Phase 29
fixtures directory — except that one file, which names it for exactly one
purpose: to assert that neither transcript here is **byte-equal** to its
same-named Phase 29 counterpart. Byte-equality would mean the file was copied
rather than re-recorded, which is the failure the re-record obligation exists to
prevent.

## Regenerating

```bash
node .planning/phases/30-acme-export-and-the-real-acme-oracle/fixtures/capture-transcripts.mjs
```

It requires a real ACME on `$PATH` (or `ACME_BIN` pointing at one) and rewrites
**both** `.txt` files from scratch. Update alongside it:

- the **Provenance** table above — `Captured at`, the assembler release string,
  and the binary path, all of which the script prints on completion;
- this README's own capture date, if the assembler release changed;
- nothing in the `.txt` files themselves. **Do not hand-edit the `.txt`
  content.** A hand-edited transcript is a claim wearing a capture's clothes,
  and the whole reason this directory exists is that the Phase 29 transcripts'
  bytes came out of a source file rather than out of an assembler.

## Known sources of non-determinism

Re-running the capture does **not** produce byte-identical files, for two
declared reasons. Neither affects the assembler behaviour these transcripts pin.

1. **Temp-path placeholder substitution.** Every invocation assembles into a
   fresh `mkdtempSync` directory — that freshness is itself a verdict rule (a
   stale output file is false-pass vector 2). The directory name therefore
   carries a random six-character suffix that changes every run. The capture
   script's `stabilise()` replaces the whole temp directory prefix with
   `<TMPDIR>`, and that is the **only** transformation applied after capture.
2. **The capture timestamp and ACME's own version banner.** The `Captured by …
   on <ISO timestamp>` and `Assembler: <banner>` header lines change with the
   clock and with the installed assembler. A `cmp` against a re-capture is
   expected to differ on those lines; the ACME output, the verdict fields and
   the byte-level evidence are what this directory exists to pin.
