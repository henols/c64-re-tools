# Research Questions

Open questions surfaced during exploration, awaiting deeper investigation.

## Does dxa + Ghidra hold up on a real cracked release?
_Raised 2026-08-24 via /gsd-explore — see [[dxa-ghidra-pivot]]_

Every number behind the pivot (dxa 72% data recovery / 0 false positives;
Ghidra's computed-jump and SMC-write resolution; the 18/18 auto-annotation
join) comes from **one 279-byte fixture written by the same person testing
it**. The constructs are real and the tools are real, but a fixture author's
dispatch table is friendlier than a demo coder's.

Answerable against the existing `c64-provenance-diff` fixtures — real releases,
already committed, already provenance-classified. Specific things to measure:

- dxa's data-recovery rate and false-positive count on real packed/cracked code
- whether Ghidra's constant propagation still resolves indirect dispatch when
  the index is computed rather than an immediate `ldx #$02`
- whether the `analyzer.rs`-shaped work we are dropping was doing something the
  dxa+Ghidra pair does not replace
- how the auto-annotation join's two selection rules behave against code that
  banks ROM in and out (an address's meaning becomes bank-dependent, which
  `memmap.json`'s flat address model does not express)

That last one is the most likely to invalidate something.

## Does Ghidra's 6502 decompiler degrade on illegal opcodes in real code?
_Raised 2026-08-24 via /gsd-explore_

Ghidra 12.1.3's `6502.slaspec` defines 57 instructions, all documented — no
illegal NMOS opcodes and no `illegal`/`undocumented` handling. dxa covers the
gap for *discovery* (`-p all-nmos6502`), but Ghidra still has to decompile the
surrounding code. Unknown whether an undecodable byte stops the decompiler at
that instruction, poisons the whole function, or is silently skipped — and the
answer decides whether a custom SLEIGH extension is needed or whether dxa's
coverage is sufficient in practice.

## ~~Local patch, config knob, or upstream fix for the UAT `unverified` disposition?~~ ANSWERED
_Raised 2026-08-29 via /gsd-explore — answered same day_

The end-of-phase UAT gate has no way to record "unverifiable by construction"
and defaults a bare Enter to `result: pass`, which laundered three of phase 28's
abstentions into passes — two of them items its own `28-VERIFICATION.md`
prohibition 28-18 P3 forbids re-filing as done. Full evidence in
`.planning/notes/uat-gate-launders-abstentions.md`.

The fix is small and well-specified (add `result: unverified`; auto-resolve items
arriving with `insufficient_spec` / `verification: judgment` without presenting a
checkpoint; stop mapping empty-response to `pass` for tagged items). **Where the
code goes is the open question**, because `.claude/gsd-core/` is a vendored
install that `/gsd-update` overwrites:

- **Local patch to `workflows/verify-work.md`** — works immediately, silently
  reverts on the next `/gsd-update`, and leaves no trace explaining why UAT
  behavior changed back. Needs at minimum a repo-side regression check that
  fails when the patch disappears.
- **Config knob** — does one exist, or is one addable, that governs UAT result
  vocabulary or the empty-response default? Nothing in `.planning/config.json`'s
  `workflow` block looks close (`human_verify_mode` only chooses mid-flight vs
  end-of-phase batching; `auto_advance` is not consulted by `verify-work`'s
  `process_response` at all). A knob would survive updates but has to be accepted
  upstream to exist.
- **Upstream fix** — this is arguably a defect in GSD rather than a local
  preference: `references/honest-verifier.md` mandates `never passed` for
  abstained `backstop` truths and cites a measured 100% → 17% false-pass
  reduction, and `verify-work.md` then has no vocabulary to honor it. The two
  files disagree with each other. An upstream issue is cheap to file and fixes it
  for every consumer, but is unbounded in latency.

Sub-question worth settling first: is the missing disposition a genuine upstream
oversight, or is there an intended path (a UAT-side equivalent of the `#1602`
`auto_passed[] / source: automated` mechanism at `verify-work.md:262-272`) that
this project simply is not invoking? That mechanism already proves the gate can
write a resolved result without asking the user — which is most of the machinery
the fix needs.

**Answered 2026-08-29: none of the three alone — split the fix by what each half
can guarantee.** The question assumed one location had to carry the whole thing.
It doesn't, and the two halves have different durability requirements:

- The **guarantee** cannot live in `.claude/gsd-core/` at all, because that tree
  is untracked (`git ls-files .claude/` returns only `settings.json`) and absent
  in CI. It lives in tracked `.planning/` instead, enforced by
  `src/mcp/vice/docs-uat-abstention.test.ts`, which checks the **outcome** — an
  abstention-tagged UAT entry recorded `pass` with no resolution-side field.
  Tool-agnostic and update-proof by construction.
- The **ergonomics** (stopping the gate asking unanswerable questions) has to be
  the local patch, since only the gate can decline to prompt. Made cheap to
  restore with `scripts/gsd-patch-uat-abstention.mjs` (idempotent; verified to
  round-trip byte-identically; refuses to force-fit if upstream rewords).
- The **gap between them** — a `/gsd-update` silently reverting the patch — is
  covered by a conditional case that skips when gsd-core is absent and fails when
  it is present-but-unpatched, naming the reapply command.

The sub-question ("is this an upstream oversight, or is there an intended path?")
resolved to **oversight, with the machinery already present**: `#1602`'s
`auto_passed[] / source: automated` path at `verify-work.md:262-272` already
writes a resolved UAT result without asking the user. The fix reuses that exact
mechanism with the opposite value, which is why it is five edits and not a
redesign. `honest-verifier.md` and `verify-work.md` genuinely contradicted each
other — the first mandating "never `passed`" for abstained `backstop` truths, the
second having no vocabulary to honour it. **Still worth filing upstream** so other
consumers get it; not blocking anything here.
