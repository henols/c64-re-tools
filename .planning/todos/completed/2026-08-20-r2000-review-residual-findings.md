---
created: 2026-08-20
source: phase-10 code review (10-REVIEW.md)
severity: warning
resolves_phase:
---

# Residual r2000 review findings not fixed in Phase 10

`10-REVIEW.md` reported 2 Critical / 12 Warning / 7 Info. The two Criticals (CR-01
export-asm clobber, CR-02 bootstrap self-destruct) plus WR-01 (dead
`FORBIDDEN_R2000_FLAGS`) were fixed during phase 10 close-out. These remain open —
deliberately deferred, not overlooked:

- **WR-02 — the deny-by-construction guard test can go vacuous.**
  `stripCommentLines()` swallows the whole file after any line starting with `/*` that
  does not end with `*/`. The reviewer ran the helper verbatim against a synthetic
  source containing a rest-param pass-through and a `.filter()` strip; all three
  assertions still passed. The criterion-1 construction test could therefore rot
  silently. Highest-value item in this list.
- **WR-03 — deletion-pin exemption is over-broad.** The `evidence: "disasm"` exemption
  `continue`s past all three checks, so a line like
  `// see cmdDisasm / toacme, evidence: "disasm"` is invisible to the guard, and the
  exemption is not count-bounded.
- **WR-04 — `acmeVerdict()` uses `lines.find`**, so a transcript with `✓ ACME`
  followed by `✗ ACME` returns `ok: true`. Demonstrated by the reviewer. Prefer
  last-match or explicit duplicate detection.
- **WR-05 — `isInImage()` never checks `image.length`.** A truncated `.d64` extracted
  98 bytes where 254 were claimed, silently. `assertPlainImage()` exists but is opt-in
  and is called by neither walker.
- **WR-06 / WR-07 — two "silently guess" defects contradicting D-02.** NUL-padded
  directory names print in the listing then get rejected verbatim
  (`no entry named "ZEROPAD" ... Available entries: ZEROPAD`); and a 4096-byte `.raw`
  is reparsed as a `.prg` with origin `$62c5`.

Verified CLEAN by the same review and recorded here so it is not re-derived: the
`--vice` guard is complete against 0.9.20's real flag surface; all spawns are argv
arrays with no `shell: true`; the host-path consumer set is still exactly five;
Phase 4's `disasm-*` family is untouched; `files[]` is complete; and
`r2000-verify.ts`'s no-exit-code-trust claim holds in both directions.

Full detail with file:line and repro steps:
`.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-REVIEW.md`

## Resolution

All six residual findings are closed:

- **WR-02** — closed by plan `11-01` (Task 1). Three guard predicates extracted to
  single named functions, shared by the real-source tests and a new committed
  planted-violation test reproducing the finding verbatim.
- **WR-04** — closed by plan `11-01` (Task 2). `acmeVerdict()` rewritten for
  unanimity over all parsed ACME lines instead of `lines.find`'s first-match
  behaviour; two pinned fixtures added.
- **WR-03** — closed by plan `11-02` (Task 3). The `evidence: "disasm"` exemption
  now runs the `toacme`/`cmdDisasm` checks first and is bounded by a
  non-vacuous `exemptionHits === 1` assertion, so a second reintroduction hiding
  behind the exemption is caught.
- **WR-05** — closed by plan `11-02` (Task 1). `sectorSlice()` now bounds every
  sector read against `image.length`; a truncated `.d64` throws naming the
  sector and the actual length instead of silently short-reading.
- **WR-06** — closed by plan `11-02` (Task 1). `petsciiName()` strips `$00` as
  well as `$A0`, so a NUL-padded directory name is guaranteed selectable via
  `extractEntry()`'s `--entry` argument.
- **WR-07** — closed by plan `11-02` (Task 2). Flat captures are now dispatched
  by extension before the length-based branch, so a wrong-size `.raw`/`.bin` is
  refused by name instead of being silently reinterpreted as a `.prg`.
