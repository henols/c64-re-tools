---
status: pending
phase: 08-capability-honesty-and-the-install-story
source: [08-VALIDATION.md]
started: 2026-08-18T20:45:50Z
updated: 2026-08-18
resolved_by:
---

## Current Test

Test 1 below — a human installing stock VICE and the plugin, selecting the stock
backend, and running `c64-ram-capture`'s documented entry-point procedure end to
end. Named in `08-VALIDATION.md` § Manual-Only Verifications as this phase's one
genuinely manual item (DIST-03, success criterion 3).

## Tests

### 1. Human install walkthrough: `apt install vice`, plugin install, stock backend, `c64-ram-capture` end to end

On a clean or containerised Debian or Ubuntu box: follow only `README.md` to run
`apt install vice` (enabling any extra repository component the README names for
your ecosystem), install the plugin by either of the two routes README.md
documents (`npx @henols/c64-re-tools`, or the Claude Code plugin marketplace), set
`VICE_BACKEND=stock` in the `vice` MCP server's `env` block, and then run
`c64-ram-capture`'s documented entry-point procedure end to end against a real
program. Record the VICE version the package manager actually delivered, whether
it matched README's per-ecosystem table for that ecosystem, and whether any step
required knowledge not present in the README.

expected: the tester installs a working stock VICE and the plugin using only
README.md's prose, selects the stock backend, and drives `c64-ram-capture` to a
full RAM capture with no step requiring undocumented knowledge.

why_human: This is a claim about a human successfully following prose
instructions on a machine this project does not control, then driving an actual
Claude Code session against the installed MCP tool surface. No script can
observe "did a person understand this sentence," and no script can substitute
for a live agent session exercising the real tool surface end to end. The
mechanical presence and per-ecosystem version checks (CI-enforced by
`check-skill-fork-honesty.mjs`) are a strong proxy, not proof.

result: partial — see below. The install-only half of this test WAS run live,
as an automated proxy for the human's first few steps (not a substitute for the
full test — see `why_human` above):

- Spun up a fresh, unmodified `debian:trixie` Docker container (no pre-existing
  VICE, no pre-existing project state).
- `sudo apt install vice` **FAILED** on the container's default sources
  ("Unable to locate package vice") — discovered live that Debian ships `vice`
  in the `contrib` component, not `main` (confirmed against
  `packages.debian.org`'s own `pool/contrib/v/vice/` path, both trixie and
  forky). This was a real gap in the README section this same plan wrote in
  Task 1 — now fixed (commit `69e9092`, this plan) by naming the `contrib`
  requirement in the Debian trixie/forky rows, matching the Ubuntu row's
  existing `multiverse` note.
- After enabling `contrib`, `apt install vice` succeeded and delivered
  `3.9+dfsg-1` — exactly matching README's per-ecosystem table claim for
  trixie.
- Separately, on the host (not the container, since installing a second VICE
  build in the container was unnecessary for this check): the exact launch
  command README publishes,
  `x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502`, was
  re-confirmed to bind its monitor port against a genuine unpatched stock VICE
  3.9 binary (`/usr/bin/x64sc`) — see Task 1's own verification record in
  `08-05-SUMMARY.md`.

**NOT run:** installing the plugin into a project inside that container and
driving a live Claude Code session through `c64-ram-capture`'s entry-point
procedure against the container's VICE. This requires an actual human (or a
separate, full agentic Claude Code session) exercising the real MCP tool
surface interactively — exactly the step `why_human` names as unautomatable,
and distinct from the install-only proxy above. `status` stays `pending` for
this half; the blocker is concrete: no human tester and no second live agent
session were available to this executor run.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- The plugin-install + `c64-ram-capture` end-to-end half of Test 1 needs an
  actual human (or a fresh, separate Claude Code session) driving the real
  tool surface inside a container or spare box. The VICE-install half is now
  live-verified, and its one real gap (Debian's `contrib` requirement) is
  fixed in `README.md` (commit `69e9092`).
