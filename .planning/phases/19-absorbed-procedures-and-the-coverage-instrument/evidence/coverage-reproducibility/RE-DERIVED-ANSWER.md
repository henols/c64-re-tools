# Bytes-route Re-derivation — COV-01 reproducibility seal

Route: **bytes only**. Derived from
`src/mcp/vice/fixtures/coverage/nc5-well-documented/project.regen2000proj` — its
`raw_data_base64` payload, gunzipped by the existing decoder and walked by
`computeStructuralCensus()` and `decode()`. No line comment, no confidence grade, no block entry
and no cross-reference list was read on this route.

Same canonicalisation as `ANSWER.md`, so the two lines are byte-comparable and hash-comparable.

<!-- CANONICAL-ANSWER-LINE -->
sample=0810,0820,0828,0830 classes=code,code,code,code callers=0,2,1,1
<!-- /CANONICAL-ANSWER-LINE -->

## How each field was derived on this route

**Sample.** Taken from `QUESTION.md`'s shared sample rule, which both routes are required to
apply to the same addresses — sharing the *selection* is what makes the *classification*
comparable.

**Classes.** A recursive descent from the program origin, following `jsr`/`jmp`/branch targets
and terminating at `rts`/`rti`/unconditional `jmp`/`brk`, reaches all four sampled addresses as
instructions. `classAt()` reports `reached-as-instruction` for each, which maps to `code`. No
comment and no block type was consulted.

**Callers.** Counted as the distinct addresses of census-reached instructions whose
`resolvedTarget` equals each sampled address: nothing targets the entry point; two separate `jsr`
sites target the flag-setting subroutine; one `jsr` targets the table reader; one `jmp` targets
the tail. That reproduces the store's own cross-reference bookkeeping without reading it.

## Result

The two routes agree on all three fields, so this line hashes to the sealed
`ANSWER.sha256`. `r2000-coverage.test.ts` recomputes BOTH routes live from the committed fixture
on every run, so the agreement is re-proved rather than merely asserted here — and a missing or
emptied marker fence in this file FAILS that test rather than skipping it (T-19-VACUOUS-CHECK).
