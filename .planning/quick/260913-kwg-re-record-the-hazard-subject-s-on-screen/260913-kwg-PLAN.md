---
phase: quick-260913-kwg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md
autonomous: true
requirements: [QUICK-260913-kwg]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Every OBSERVATION sentence added to `## On-screen observations` names a capture the executor took in THIS run, identified by its own md5 and by the exact argv line that produced it. No number, no md5 and no phrasing is carried across from the plan brief or from the superseded prose."
    - "The instrument is qualified before it is trusted: the section states, from the executor's own runs, both a POSITIVE control (a capture route that demonstrably renders a readable screen) and a NEGATIVE control (an unrelated committed program pushed through the identical route). Where the negative control's bytes match the subject's, the section says so and says plainly that the route cannot distinguish one program from another and therefore cannot support a per-program claim."
    - "The prior observation is preserved, not deleted and not silently rewritten, and is marked as pertaining to the SUPERSEDED pre-amendment bytes — with the pre-amendment commit named — so a reader can see it is history rather than a current claim."
    - "The post-amendment and pre-amendment images were pushed through ONE identical harness in this run and the result of that comparison is recorded as measured, whichever way it came out. The section never argues from source that the amendment is inert."
    - "The section states explicitly that the isolated single-construction builds (the SMC-alone and alignment-alone runs the superseded prose reports) were NOT re-measured in this run, so no reader mistakes the retained prose for a fresh measurement."
    - "Where a capture route was attempted and did not yield an observation, the refusal is recorded BY NAME — which route, which flags, what it did instead — rather than omitted. A disqualified instrument is itself a recorded observation in this section's voice."
    - "The section's established voice survives: PREDICTION stated first from the amended source (naming the two registers the amendment made statically visible), OBSERVATION recorded second and verbatim, the two free to disagree. The closing paragraph about what no automated check in this repository can establish is retained."
    - "Exactly ONE tracked file changed: `git diff --name-only HEAD` over `src/`, `docs/`, `scripts/`, `installer/` and `.claude-plugin/` prints that one path and nothing else. No fixture source, no committed image, no annostore, no test and no report was touched."
    - "No captured PNG entered the tracked tree. The captures live under the project's gitignored tool-written root and the document carries their md5s and argv lines instead, so a reader regenerates and compares rather than trusting a committed binary."
    - "No planning vocabulary entered the document."
  artifacts:
    - src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md
    - .c64-re-tools/runs/hazard-screens/MANIFEST.txt
  key_links:
    - "Each OBSERVATION sentence in the document <-> a `capture ` record in MANIFEST.txt carrying that same md5 and the argv that produced it."
    - "The negative control's md5 <-> the aligned subject's md5: their relation (equal or not) is what licenses or disqualifies every per-program claim in the section."
---

<objective>
Re-record `## On-screen observations` in the hazard subject's fixture design
document against the CURRENTLY COMMITTED images, on real stock VICE, from
captures the executor takes itself.

Purpose: a prior quick task amended the alignment routine's `$dd00` and
`$d011` writes and regenerated both committed images. The observations in that
section were taken on the pre-amendment bytes and were never re-taken, so the
document currently presents observations of bytes that no longer exist as if
they described the committed ones. The section's own closing paragraph is why
this cannot be argued away from source: whether the screen is right "is a
claim about what a real screen looks like", and nothing in this repository's
automated suite renders a screen and inspects it.

Output: a rewritten `## On-screen observations` section, and a gitignored
evidence manifest of every capture taken.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md
@src/mcp/vice/fixtures/hazard-subject/hazard-subject-align.a
</context>

<planning_time_observations>
These were MEASURED at planning time on this host, genuine stock
`/usr/bin/x64sc` reporting `x64sc (VICE 3.9)`, `DISPLAY=:0`, 2026-09-13. They
exist to ground the argv lines and to tell the executor which routes are
already known to be dead ends. **They are not observations of record.** The
executor re-derives every number it writes into the document; nothing below
may be transcribed into `FIXTURE-DESIGN.md`.

- A boot with NO `-autostart`, `-limitcycles 5000000`, `-exitscreenshot`:
  process exit status 1 (the normal `-limitcycles` termination, not a
  failure), a 1683-byte PNG written, visually the ordinary BASIC start-up
  screen. The rig renders and captures.
- The committed aligned image via `-autostart` at six cycle limits spanning
  2,000,000 to 200,000,000: every capture an identical 832-byte PNG with one
  single md5. The 2,000,000 point is below the cycle count at which the
  control had even reached a settled screen, so the result does not vary with
  how long the program ran.
- Same 832-byte result with warp off, and with `+autostart-warp` and
  `+autostart-handle-tde`.
- `src/mcp/vice/fixtures/petcat/computed-sys.prg` — an unrelated committed
  program — through the identical route produced a capture with the SAME md5
  as the hazard subject's.
- The text monitor (`-remotemonitor -remotemonitoraddress ip4://127.0.0.1:PORT`)
  binds and listens, but every connection attempt was reset before any banner
  arrived.
- The binary monitor (`-binarymonitor -binarymonitoraddress ip4://...`) on a
  direct launch never bound at all within 23 seconds; the launch log carries
  no bind line.
- Host-side X capture is not available on this display: `xwd -root` fails
  `BadMatch` on `X_GetImage`, and an `ffmpeg -f x11grab` grab of the root
  window succeeds but returns a uniformly black frame.
- The advertised MCP tool surface is 45 tools and contains no screen-capture
  or display tool.
- This install has `Drive8Type=0` and reports every drive ROM image missing,
  which is a candidate explanation for an autostart that never runs the
  program — the executor may test it, and must not assert it untested.
</planning_time_observations>

<halt_rules>
- The ONLY tracked file this plan may change is
  `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md`. If a measurement
  suggests a fixture source, a committed image, the annostore, the hazard
  report, the reassembly gate or a test is wrong, STOP and report it in the
  summary. Do not edit it under this plan.
- Do not widen `TEXT_COMMAND_ALLOWLIST` in `src/mcp/vice/text-protocol.ts`,
  and do not route a measurement through the shipped text-channel client to
  reach a command that allowlist withholds. Ad-hoc measurement scripts under
  the scratchpad may speak a socket directly; shipped code may not change.
- Never install anything. If a capability is missing, refuse it by name in the
  evidence manifest with what would have provided it, and carry on.
- No captured PNG is committed. Reason, stated once here and once in the
  document: nothing in this repository's suite renders or inspects a screen,
  so a committed screenshot would be a binary artifact no check can
  regenerate or falsify. The md5 plus the argv line is the regenerable
  residue, and that is what ships.
</halt_rules>

<tasks>

<task type="tracer">
  <name>Task 1: Qualify the capture instrument end-to-end, with a negative control</name>
  <files>.c64-re-tools/runs/hazard-screens/MANIFEST.txt</files>
  <precondition>Genuine stock VICE is present at `/usr/bin/x64sc` and reports `x64sc (VICE 3.9)`; `DISPLAY=:0` is set. Assert both before the first launch and halt by name if either is absent.</precondition>
  <action>
Create the evidence directory under the project's gitignored tool-written
root. Derive its location rather than hardcoding it: resolve `toolsDir()` from
`src/mcp/vice/repo-root.ts` (exported at line 265; Node 24 imports the `.ts`
directly) and use `<toolsDir>/runs/hazard-screens/`, alongside the existing
`runs/oracle/` and `runs/ghidra/` siblings. Nothing here goes in the tracked
tree.

Take four captures, each with its own output path, in one pass. Every launch
uses the argv shape `timeout 180 /usr/bin/x64sc -default ...` with `-default`
FIRST — this project's recorded stock-VICE flag-order constraint — and
`DISPLAY=:0` in the environment. A `-limitcycles` run terminates with process
exit status 1; that is the normal path and must not be treated as a failure,
so capture the status and keep going.

Capture A, the POSITIVE control: `-warp -limitcycles 5000000 -exitscreenshot
<A.png>`, no `-autostart` at all. Capture B: the same plus `-autostart
src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` at a cycle limit you
choose and record. Capture C, the NEGATIVE control: identical to B but
autostarting `src/mcp/vice/fixtures/petcat/computed-sys.prg`, a committed
program with nothing to do with this fixture. Capture D: identical to B but
autostarting `src/mcp/vice/fixtures/hazard-subject/hazard-subject-misaligned.prg`.

Look at capture A yourself — open the PNG and describe what is on it — so the
rig's ability to render a readable screen is established by inspection and not
by file size. Then compare md5s across A, B, C and D.

The comparison is the whole point of this task, so state its consequence in
the manifest in one sentence, whichever way it comes out. If C's md5 equals
B's, the route is program-blind: it produced identical bytes for two unrelated
programs, and therefore cannot license any claim about what EITHER program put
on screen — record that as the finding. If C differs from B, the route
discriminates and captures B and D are admissible observations.

Write `MANIFEST.txt` with one record per capture on a line beginning `capture `
followed by the label, the md5, the byte size, the process exit status and the
full argv line, and free notes on lines beginning with `# `. Append to this
manifest in later tasks rather than rewriting it.
  </action>
  <verify>
    <automated>M="$(node --input-type=module -e 'import {toolsDir} from "./src/mcp/vice/repo-root.ts"; console.log(toolsDir());')/runs/hazard-screens/MANIFEST.txt"; test -s "$M" && test "$(grep -v '^#' "$M" | grep -c '^capture ')" -ge 4 && test "$(grep -v '^#' "$M" | grep -c '^capture ')" = "$(grep -v '^#' "$M" | grep -oE '\b[0-9a-f]{32}\b' | wc -l)" && test "$(ls "$(dirname "$M")"/*.png | wc -l)" -ge 4</automated>
    <human-check>Capture A was opened and visually confirmed to show a readable C64 screen, not merely a plausible file size.</human-check>
  </verify>
  <done>Four captures exist under the tool-written root with md5s, exit statuses and argv lines recorded in `MANIFEST.txt`; the positive control was visually inspected; and the manifest carries a one-sentence verdict on whether the route can distinguish one program from another.</done>
</task>

<task type="auto">
  <name>Task 2: Measure the post-versus-pre-amendment comparison, and try one second instrument</name>
  <files>.c64-re-tools/runs/hazard-screens/MANIFEST.txt</files>
  <action>
Part one, the equivalence measurement. Extract the pre-amendment aligned and
mis-aligned images from commit `758d7df6` into the session scratchpad — NOT
into the repo tree, where scratch files have previously raced this project's
own test suite. Push each through the IDENTICAL harness Task 1 used for
capture B, same cycle limit, same flags, and record md5s as further `capture `
records. Record whether post-amendment and pre-amendment produce the same
bytes, as measured. Do not reason about it from the source; if Task 1
disqualified the route, say what this comparison is therefore worth, which may
be nothing.

Part two, a second and independent instrument, time-boxed to two attempts
total. The amendment's subject is two registers the machine will happily tell
you about: the code loads `$3f` into `$dd00` and `$1b` into `$d011`, and it
also writes `$d018`, `$d015`, `$d000` and the sprite pointer at `$07f8`.
Reading those back from a machine that has actually executed the committed
image would settle the PREDICTION far more sharply than any photograph. Try,
in this order, and stop at the first that connects:

(a) The project's own supported path — start the `vice-broker` systemd unit
and drive the machine through the `vice` MCP tool surface (`vice_autostart`,
`vice_run_until`, `vice_registers_get`, `vice_vicii_get_state`,
`vice_memory_read`, `vice_sprite_inspect`). If that unit or that tool surface
is not reachable from this session, say so by name and move to (b).

(b) A throwaway script under the scratchpad that launches `x64sc` with
`-default` first followed by `-binarymonitor -binarymonitoraddress
ip4://127.0.0.1:<free port>` and dials it using this repository's own
binary-monitor client (`src/mcp/vice/stock-protocol.ts`, imported read-only).
A direct launch was already seen at planning time to leave that port unbound,
so poll for the listening socket and give up by name rather than hanging.

Whichever way it goes, append the outcome to the manifest: for a connected
monitor, the register values read and at what point in execution; for a
refusal, which route, which flags, and exactly what it did instead. Then stop
— two attempts is the box. A route that refuses is a recorded observation in
this section's voice, not a blocker.

Optionally, and only if a monitor connected, check whether the autostart
actually loaded the program at all by reading a few bytes at the image's own
load address and comparing them with the committed file. This install reports
its drive ROMs missing, which makes "autostart never ran it" a live
possibility rather than a rhetorical one. Record the answer; do not assert it
untested.
  </action>
  <verify>
    <automated>M="$(node --input-type=module -e 'import {toolsDir} from "./src/mcp/vice/repo-root.ts"; console.log(toolsDir());')/runs/hazard-screens/MANIFEST.txt"; test "$(grep -v '^#' "$M" | grep -c '^capture ')" -ge 6 && grep -qiE 'pre-amendment|758d7df6' "$M" && grep -qiE 'instrument|monitor' "$M"</automated>
  </verify>
  <done>The manifest carries at least two further captures covering the pre-amendment images through the identical harness with their md5s, an as-measured statement of whether they match the committed images' captures, and a named outcome for the second-instrument attempt — connected with register values, or refused with the route and flags named.</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite the on-screen observations section from this run's captures</name>
  <files>src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md</files>
  <action>
Rewrite `## On-screen observations` (currently the final section, starting at
line 341) so that every current claim in it comes from Task 1 and Task 2's own
captures. Keep the section's established voice throughout: PREDICTION stated
first from the source, OBSERVATION recorded second and verbatim, the two free
to disagree.

Open the section with a short INSTRUMENT paragraph before any prediction: the
exact argv shape used, where the captures live, that none is committed and
why, and the two controls — the positive one that showed a readable screen,
and the unrelated committed program pushed through the identical route. State
the md5 relation between the negative control and the subject as measured, and
state its consequence in the same breath. If the route turned out to be
program-blind, that sentence is the most important one in the section and must
read as a finding, not an apology.

State the PREDICTION for the ALIGNED build from the amended source, and name
the two registers the amendment made statically visible — the bank select
driven by an immediate load of `$3f` into `$dd00`, and control register 1
driven by an immediate load of `$1b` into `$d011` — alongside the sprite
enable, position and pointer, the custom character set selected through
`$d018`, and the raster split. Then record the OBSERVATION for the aligned
build from your own capture, by md5. Do the same for the MIS-ALIGNED build.

Add a short paragraph recording the post-versus-pre-amendment comparison as
measured, naming commit `758d7df6` as the pre-amendment source and saying what
that comparison establishes given the instrument's qualification — including
"nothing" if the route was disqualified.

Preserve the superseded prose rather than deleting it. Move the existing
aligned and mis-aligned OBSERVATION paragraphs under a clearly titled
subsection marking them as pertaining to the pre-amendment bytes, naming
commit `758d7df6`, and noting that they were taken before the two register
writes were amended and both images regenerated. Their honest admissions —
the reversion the raster construction produces, the entry point that never
returns to BASIC showing the identical reversion, the trigger not pinned down
further — stay word for word. They are history worth keeping.

Add one plain sentence stating that the isolated single-construction builds
described in that retained prose were not rebuilt or re-run in this pass, so
no reader mistakes retained prose for fresh measurement.

Retain the closing paragraph on what no automated check in this repository can
establish, unchanged in substance. It is the reason this section exists.

Write no planning vocabulary: no planning-directory path, no slash-prefixed
workflow command name, no phase or plan number, no bare decision or gap
identifier. Commit hashes are fine; they resolve for any reader of the repo.
  </action>
  <verify>
    <automated>F=src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md; grep -q '^## On-screen observations' "$F" && test "$(grep -c 'PREDICTION:' "$F")" -ge 2 && test "$(grep -c 'OBSERVATION:' "$F")" -ge 4 && grep -q '758d7df6' "$F" && test "$(grep -oE '\b[0-9a-f]{32}\b' "$F" | sort -u | wc -l)" -ge 3 && grep -qiE 'no automated check in this repository' "$F" && ! grep -qE '\.planning/|/gsd-|\bD-[0-9]|\bG-[0-9]-[0-9]' "$F" && test "$(git diff --name-only HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/)" = "$F"</automated>
  </verify>
  <done>`## On-screen observations` opens with an instrument-and-controls paragraph, carries fresh PREDICTION/OBSERVATION pairs for both committed builds identified by md5, records the pre-amendment comparison against commit `758d7df6`, retains the superseded observations under an explicit marker, states that the isolation builds were not re-measured, keeps the closing paragraph, carries no planning vocabulary, and is the only tracked file changed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| host process -> emulator | The plan launches `/usr/bin/x64sc` and, in one branch, dials a monitor socket it opened itself. |
| repo tree -> gitignored tool root | Capture artifacts are written outside the tracked tree. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kwg-01 | Tampering | tracked fixture tree | high | mitigate | Task 3's verify asserts `git diff --name-only HEAD` over the product directories equals exactly the one document path, so a stray edit to a fixture source, a committed image or a test fails the gate. |
| T-kwg-02 | Information disclosure | text monitor socket | medium | mitigate | The text monitor is unauthenticated and can read and write host files. This plan never widens `TEXT_COMMAND_ALLOWLIST` and binds only to `127.0.0.1` on an ephemeral port, matching the broker's own bind discipline. |
| T-kwg-03 | Tampering | package manifest | low | accept | No package-manager install occurs anywhere in this plan; no legitimacy gate is required. |
| T-kwg-04 | Repudiation | evidence manifest | medium | mitigate | Every observation written into the document carries an md5 and the argv that produced it, so a reader can regenerate the capture and contradict the prose. |
</threat_model>

<verification>
- `MANIFEST.txt` exists under the gitignored tool-written root with at least
  six `capture ` records, each carrying an md5 and an argv line.
- `git diff --name-only HEAD -- src/ docs/ scripts/ installer/ .claude-plugin/`
  prints exactly `src/mcp/vice/fixtures/hazard-subject/FIXTURE-DESIGN.md`.
- `git status --porcelain` shows no new tracked PNG anywhere.
- Every md5 appearing in the document also appears in `MANIFEST.txt`.
- From `src/mcp/vice`, `npm run test:automated` reports zero failures and its
  SKIPPED SET, compared member by member against the set captured before any
  edit in this plan, is unchanged. Stop any running broker first: a live
  broker deterministically reddens one of this suite's tests. Never pipe the
  command into `tail` — capture the status on the same line, because a pipe
  reports the pipe's status and fakes a green baseline.
</verification>

<success_criteria>
The section's current claims all trace to captures taken in this run; the
instrument that produced them is qualified in the document by a positive and a
negative control; the pre-amendment comparison is recorded as measured; the
superseded observations survive, marked as such; the isolation builds are
declared not re-measured; and exactly one tracked file changed.
</success_criteria>

<output>
Create `.planning/quick/260913-kwg-re-record-the-hazard-subject-s-on-screen/260913-kwg-SUMMARY.md` when done.
</output>
