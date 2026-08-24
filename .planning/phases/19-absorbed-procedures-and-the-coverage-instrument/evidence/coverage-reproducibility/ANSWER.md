# Store-route Answer — COV-01 reproducibility seal

Route: **store only**. Derived from
`src/mcp/vice/fixtures/coverage/nc5-well-documented/store.json` — its labels, its line comments
and their D-25 confidence-grade prefixes, its block listing, and its cross-reference lists. The
program payload in `project.regen2000proj` was not decoded, walked or read on this route.

Canonicalised under `QUESTION.md`'s own rules: one line, lowercase, single ASCII space between
fields, four-digit zero-padded lowercase hex addresses, no trailing newline. `ANSWER.sha256`
holds the sha256 of exactly the line between the two markers below, with the surrounding
whitespace trimmed off.

<!-- CANONICAL-ANSWER-LINE -->
sample=0810,0820,0828,0830 classes=code,code,code,code callers=0,2,1,1
<!-- /CANONICAL-ANSWER-LINE -->

## How each field was derived on this route

**Sample.** Four labels carry line comments. All four comments are non-empty and none equals a
banned-generic entry after normalisation. The one label with strictly more than one caller names
one of its callers in its own comment, so it stays documented. Population 4 with the default
sample size 8 gives a step of `ceil(4 / 8) = 1`, so every documented label is sampled, sorted
ascending by address.

**Classes.** Each sampled address carries a `[confirmed-code]` or `[probable-code]` prefix, both
of which resolve to `code`. The block-type fallback was not reached for any of the four.

**Callers.** Read straight off the recorded cross-reference lists: the entry label is referenced
by nothing, the flag-setting subroutine by two distinct addresses, and the remaining two by one
each.

## Non-retrofit rule

Per this project's T-11-RETROFIT policy, inherited here as **T-19-RETROFIT**: if the bytes-route
re-derivation in `RE-DERIVED-ANSWER.md` disagrees with this line, that disagreement is a real
result to report. This file, `ANSWER.sha256` and `QUESTION.md` must not be edited to force the
comparison green.
