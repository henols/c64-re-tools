---
status: failed
phase: 08-capability-honesty-and-the-install-story
source: [08-VALIDATION.md]
started: 2026-08-18T20:45:50Z
updated: 2026-08-19
resolved_by: Phase 8.1, plan 08.1-04
driven_by: agent-proxy
tested_artifact_sha: 0e6e913e493216579a8a6a680d5e84b9729fd320
tested_artifact_route: local-checkout-HEAD
vice_version: "x64sc (VICE 3.9)"
evidence: 08.1-WALKTHROUGH-EVIDENCE.md
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

**Resolved in Phase 8.1, plan 08.1-04 — result: failed.** The missing half above (a live
Claude Code session driving `c64-ram-capture`'s entry-point procedure against a real
running stock VICE) was run. Full transcript, backend proof, and root-cause investigation:
`.planning/phases/08.1-close-v0-2-0-audit-items-uat-walkthrough-planning-doc-drift/08.1-WALKTHROUGH-EVIDENCE.md`.
Six things, stated plainly:

**(a) What was tested.** The artifact was this repository's local working checkout at
commit `0e6e913e493216579a8a6a680d5e84b9729fd320`, **not a published release**. Measured
distances at the time this ran: `origin/main` was `309` commits behind this checkout, and
npm's latest `@henols/vice-mcp@0.1.12` was published `2026-08-17T15:16:20.212Z` — predating
Phases 7 and 8 entirely. Recording this run as if a published install route had been
exercised would itself be a new false claim, which is why it is named here as this run's
own stated limitation, not glossed over.

**(b) Who drove it.** A live Claude Code agent session (headless `claude -p`, not an
interactive human terminal), not a human witness. This satisfies the mechanism `why_human`
names — no *script* can substitute for a live, adaptive session exercising the real MCP
tool surface — and, in the same breath: a human witness is strictly stronger evidence and
was **not** obtained. Both statements hold at once; neither cancels the other.

**(c) How the install was wired.** The scratch project received the six skills via
README route A (`node installer/bin/cli.mjs <scratch-project>`), then its `vice` MCP
entry was overridden by hand to point at the local checkout (LD-1). Before (as the
installer wrote it): `{"command":"npx","args":["-y","@henols/vice-mcp@0.1.1"],"env":
{"MASTRA_TELEMETRY_DISABLED":"1"}}`. After (the override actually driven): `{"command":
"node","args":["/home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice/vice-proxy.ts"],
"env":{"MASTRA_TELEMETRY_DISABLED":"1","VICE_BACKEND":"stock","CLAUDE_PROJECT_DIR":
"/tmp/gsd-08.1-walkthrough/scratch-project"}}`. Driving rung 1 (`headless-claude-p`)
succeeded on the first attempt — rung 2 (this executor's own session) was never needed,
so there is no additional "not launched through the scratch project's own `.mcp.json`"
limitation to record beyond (a) and (b) above.

**(d) What the backend actually was.** `vice_ping` reported `backend: "stock"`,
`viceVersion: "VICE 3.9.0.0"`. The emulator actually launched, confirmed independently via
the broker's own `epoch.json` and live `ps` argv (not `vice_ping`'s own `resolvedBinaryPath`
field, which is separately documented in the evidence file as unreliable in this broker
architecture — see `08.1-WALKTHROUGH-EVIDENCE.md` FINDING-C3), was genuinely
`/usr/bin/x64sc`, invoked by absolute path because bare `x64sc` on this machine's `$PATH`
resolves to the fork build at `/usr/local/bin/x64sc`.

**(e) The capture result.** **Failed.** The disk attached and the machine booted to BASIC,
but `LOAD"*",8,1` (both via `vice_autostart` and the SKILL's own documented keyboard
fallback) returned `?DEVICE NOT PRESENT ERROR`, so the checkpoint at the program's entry
point (`$080D`) never hit and the 64K capture (`dump-artifacts.mjs write-set`'s own
**65536**-byte assertion) was never reached. Confirmed root cause: the broker launches
stock `x64sc` with `Drive8Type=0` (NONE) by default, and neither `vice_disk_attach` nor
`vice_autostart` sets it, and the stock MCP tool surface has no resource-set tool to fix
it from a client. Confirmed sufficient fix, live: `-drive8type 1541` at launch. Full
diagnosis in the evidence file.

**(f) Every finding.** `FINDING-A1` (corrected/widened in 08.1-03: `acme-build`'s scaffold
needs a `cbm/c64/*.a` library absent from both provisioning routes, including CI's own),
`FINDING-B1`/`FINDING-B2` (08.1-03: `RELEASES.json`'s schema and the `.git`-marker project
-root requirement are undocumented), and `FINDING-C1`-`FINDING-C4` (08.1-04: the
`Drive8Type` default defect above; a correction of this run's own initial "missing ROMs"
misdiagnosis; `vice_ping`'s unreliable `resolvedBinaryPath`; and the SKILL/README's silence
on any drive-type prerequisite). None of these is install-path-shallow (a README wording
fix), so per the phase Notes none was fixed as part of this resolution — each is recorded
and left to size its own follow-up work.

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- **Resolved (Phase 8.1, plan 08.1-04): the plugin-install + `c64-ram-capture` end-to-end
  half of Test 1 was driven live** by a headless Claude Code session against genuine
  `/usr/bin/x64sc`. It surfaced a real, confirmed defect rather than a documentation gap:
  this project's own broker launches stock `x64sc` with `Drive8Type=0` (NONE) by default,
  so no drive answers unit 8 and `LOAD"*",8,1` fails with `?DEVICE NOT PRESENT ERROR` —
  neither `vice_disk_attach` nor `vice_autostart` sets a drive type, and the stock MCP tool
  surface exposes no resource-set tool to fix this from a client. See
  `08.1-WALKTHROUGH-EVIDENCE.md` for the full root-cause trace and confirmed fix
  (`-drive8type 1541` at launch). The VICE-install half remains live-verified from before,
  with its one real gap (Debian's `contrib` requirement) fixed in `README.md`
  (commit `69e9092`).
