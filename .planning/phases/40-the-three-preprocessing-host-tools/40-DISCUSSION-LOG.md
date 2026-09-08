# Phase 40: The Three Preprocessing Host Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 40-The Three Preprocessing Host Tools
**Areas discussed:** Tool-id granularity, The failure oracle, Binary resolution, Bank output contract, Skill surface / ownership, Carried items, petcat decline shape

**Note on the phase title:** the phase is named for *three* tools. The owner's
hard direction during this discussion removed `cartconv`, so it now delivers
**two**. The title is left as-is here; correcting it is a ROADMAP edit.

**Areas offered but not selected:** Fixture strategy (raised again later and
partly answered — see the closing section).

---

## Tool-id granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One id per capability | ~6 new ids following acme.build / ghidra.analyze / dxa.disassemble; honest per-capability arg keys, own timeout, own oracle | ✓ |
| One id per binary, typed verb field | 3 ids; arg-key allowlist becomes a union across verbs, weakening refuse-unknown-keys-BY-NAME | |
| One batched survey id per binary | Fewest ids and child processes; one oracle covers several formats at once | |

**User's choice:** One id per capability

| Option | Description | Selected |
|--------|-------------|----------|
| c1541.chain | The named file's real sector chain; PREP-01's headline | ✓ |
| c1541.bam | The block-availability map; named in PREP-01 | ✓ |
| c1541.dir | The directory; named in PREP-01 | ✓ |
| c1541.extract | Whole-image extraction; not named by PREP-01, and it writes | |

**User's choice:** chain + bam + dir, **plus the free-text direction "Replace all
functionality in d64-parse with c1541 functionality"**
**Notes:** This freeform addition reversed two locked statements and became the
single largest decision of the discussion. See the dedicated section below.

| Option | Description | Selected |
|--------|-------------|----------|
| No mutating verb this phase | Every id read-only; the ROADMAP's write-evidence clause satisfied vacuously | ✓ |
| Ship one, with the evidence-first proof | Take extract/bwrite and build the planted before-the-write record test | |

**User's choice:** No mutating verb this phase

---

## The d64-parse.mjs supersession (raised by the user's free-text answer)

Claude flagged the conflict before proceeding: ROADMAP criterion 1 states
`d64-parse.mjs` is *"untouched and undeprecated"* and the supersession is
*"deferred on the record rather than settled as a side effect"*; REQUIREMENTS.md
line 109 excludes *"Superseding or deleting the hand-written `.d64` parser"*.
Three costs were named before the question was re-put: the no-broker property,
the fakery detector with no `c1541` equivalent, and `anno-d64.ts` as a second
copy.

**First response:** the user asked for more explanation of *"directory, BAM, and
`--json` fakery detection"* before deciding. Claude read the implementation and
explained the three suspicion signatures, the BAM cross-reference as the
load-bearing one, and the visited-set cycle guard — then measured `c1541 -entry`
and `c1541 -bam` and corrected its own earlier framing: `c1541` cannot supply the
*judgement*, but it supplies **strictly richer inputs** (first T/S from `-entry`,
a per-SECTOR BAM) than `d64-parse.mjs` computes.

| Option | Description | Selected |
|--------|-------------|----------|
| Cover it, prove it, don't delete yet | Ship covering ids + a both-routes agreement test; record 'deletion scheduled' | |
| Replace fully this phase | Port the detector onto c1541's richer inputs, delete d64-parse.mjs, amend ROADMAP + REQUIREMENTS in-phase | ✓ |
| Add c1541, keep detector on bytes | Explicit hybrid; record 'no, they do different jobs' | |
| Keep it additive, decide later | Honour the locked text; leave the decision unreached a third close | |

**User's choice:** Replace fully this phase

| Option | Description | Selected |
|--------|-------------|----------|
| Leave anno-d64.ts, fix its header | Stays as the MCP server's in-process reader; only comments change | |
| Delete anno-d64.ts too | One .d64 route, no exceptions | ✓ |
| Leave it entirely untouched | Cheapest; leaves a comment pointing at a deleted file | |

**User's choice:** Delete it too
**Notes:** Claude then measured the blast radius and re-put the question rather
than proceeding: four importing test files (three of them *live* tests that
extract a real `.prg` from a `.d64`), a pinned symbol-and-line entry in
`module-classification.ts`, `package.json` `files[]`, `check-npm-packages.mjs`,
and a test asserting another file's header *cites* `anno-d64.ts`. The live-test
consequence — the dxa and Ghidra live tests acquire a broker dependency — was
named as a behaviour change rather than bookkeeping.

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm — delete it, tests go through the seam | Re-point 4 test files + 5 bookkeeping sites; live tests reach c1541 over host_tool | ✓ |
| Delete skill-side only, keep anno-d64.ts | Revise now that the radius is measured; live tests keep working with no broker | |
| Delete it, but move the .prg extraction helper | Production route is c1541-only; test fixtures still come off bytes | |

**User's choice:** Confirm — delete it, tests go through the seam

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse, name the seam | No fallback, per acme.mjs's stated rule against host-only fallbacks | ✓ |
| Keep a byte-level read-only fallback | Preserves works-with-nothing-running; a second implementation of the same answer | |

**User's choice:** Refuse, name the seam

| Option | Description | Selected |
|--------|-------------|----------|
| c1541.read — one named file | Mirrors extractEntry(image, entryName) one-for-one; writes a host file, not the disk | ✓ |
| c1541.extract — whole image | One id, but the caller pays for the whole disk and hits PETSCII name mangling | |
| Both | Two more ids at seven edit sites each; no requirement asks for bulk | |

**User's choice:** c1541.read — one named file
**Notes:** Raised by Claude as a *consequence* of the confirm — nothing in the
chosen id set could extract a file's bytes, which the three live tests need.

---

## The failure oracle

| Option | Description | Selected |
|--------|-------------|----------|
| Positive signal per capability | Each id declares its success output shape; absence is the failure | ✓ |
| Negative signal — match error phrases | Cheap and direct, but provably incomplete: cartconv's silent-empty case has no phrase | |
| Both, positive gates and negative vetoes | Strictly stronger; two declarations and two fixture classes per id | |

**User's choice:** Positive signal per capability
**Notes:** Decided against live measurements Claude took during the discussion —
`c1541`'s unconditional `OPENCBM` stderr line (which breaks any
stderr-non-empty predicate on 100% of calls), `c1541`'s exit 0 on error,
`petcat`'s exit 1 on missing-file only, and `cartconv -f`'s zero-bytes-exit-0 on
a non-cartridge.

| Option | Description | Selected |
|--------|-------------|----------|
| A test assertion per tool | Same test asserts the oracle refuses AND an exit-only predicate passes on that output | ✓ |
| A one-time evidence document | Permanent record, but nothing goes red if the oracle later regresses | |
| Both — test plus recorded transcripts | Live guard plus the provenance for why the oracle is shaped this way | |

**User's choice:** A test assertion per tool

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore petcat's exit — same rule as the other two | One discipline, one code path; exit logged, never consulted | ✓ |
| Use it as an extra veto | Slightly stronger for one class; introduces a per-tool asymmetry | |

**User's choice:** Ignore it — same rule as the other two

| Option | Description | Selected |
|--------|-------------|----------|
| Host-side, in the seam | runHostTool applies it; every caller gets the same verdict. Follows dxa.disassemble | ✓ |
| Container-side, in the skill script | Seam stays a dumb transport; re-derives a cross-cutting seam locally | |
| Split — seam judges, skill enriches | Clean division, probably where Phase 42's parsers sit | |

**User's choice:** Host-side, in the seam

---

## Binary resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Alongside the resolved x64sc | ROADMAP's own reasoning; guarantees tools and emulator are the same VICE build | ✓ |
| Explicit env var per tool, then PATH | Familiar, but the default silently takes whatever shadows first | |
| Absolute paths pinned in config | Maximally deterministic; hard-codes host layout into a portable project | |

**User's choice:** Alongside the resolved x64sc

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tool probe, once per process, fixture-pinned | The ROADMAP note's own ask; three probes, three fixtures | |
| Path only, no version | Cheapest; path already disambiguates stock from fork on this host | ✓ |
| Inherit the x64sc version | One probe; an inference rather than a measurement | |

**User's choice:** Path only, no version
**Notes:** Claude flagged this as a **deliberate divergence** from the Phase 40
ROADMAP Notes bullet, which asks for *"path and version per call"* — a Notes
bullet rather than a success criterion, so the owner's to overrule, recorded so a
planner does not re-add it.

| Option | Description | Selected |
|--------|-------------|----------|
| Once per process, memoised | backend-detect.mts's stated posture; named refusal citing the path tried | ✓ |
| Per call | Always current; a filesystem hit in the broker loop on a path that will not change | |
| Not at all — let spawn fail | Least code; opaque transport-shaped message instead of a diagnosable one | |

**User's choice:** Once per process, memoised

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute path, tool id, exit, elapsed | Extends host-tool.mts:1566's existing format | ✓ |
| Path only on the first call | Less transcript noise; a line read in isolation no longer says which build ran | |

**User's choice:** Absolute path, tool id, exit, elapsed

---

## Bank output contract

| Option | Description | Selected |
|--------|-------------|----------|
| Caller-supplied outDir, seam names the files | Matches dxa.disassemble's shape exactly | |
| Per-run scratch dir, paths returned | No caller path to validate; images live outside the caller's tree | |
| Into .annostore, keyed by run | Provenance rides along; but .annostore is Phase 43's subject | |

**User's choice:** free text — *"In its own folder structure"*
**Notes:** Claude read the pending consolidate-paths todo, which proposes exactly
such a structure, and re-put the question with three concrete readings.

| Option | Description | Selected |
|--------|-------------|----------|
| Emit paths and stop | PREP-03 says 'can each consume' — consumable, not consumed | ✓ |
| Orchestrate all N runs | Invents a fan-out and partial-failure policy no requirement asks for | |

**User's choice:** Emit paths and stop

| Option | Description | Selected |
|--------|-------------|----------|
| Per-run dir, ghidra-runs precedent | tools/cartconv-runs/<runId>/; existing precedent and gitignore pattern | |
| Subdirectory under caller's outDir | Images live where the caller asked; new convention with no precedent | |
| Adopt .c64-re-tools/ now | Right end state, one gitignore entry; a 9-file path migration unrelated to PREP-01..04 | ✓ |

**User's choice:** Adopt .c64-re-tools/ now

| Option | Description | Selected |
|--------|-------------|----------|
| All six writers, clean break | One toolsDir(); old stanzas deleted; 5 pinned test literals updated | ✓ |
| New root for new output only | Keeps the phase focused; leaves the consumer with SEVEN locations instead of six | |
| All six, but as its own plan wave | Same scope, different blast-radius management | |

**User's choice:** All six writers, clean break
**Notes:** Claude surfaced the todo's own operational warning — a live broker
under the old layout must be stopped before the upgrade, because
`.vice-supervisor/` is the container↔host rendezvous point.

| Option | Description | Selected |
|--------|-------------|----------|
| .c64-re-tools/runs/cartconv/<runId>/ | Mirrors runs/ghidra/ one-for-one | ✓ |
| .c64-re-tools/runs/cartconv/<stem>/ | Self-cleaning; breaks runId symmetry and loses run comparison | |
| .c64-re-tools/banks/<stem>/ | Reads as durable derived data; adds a seventh subdirectory name | |

**User's choice:** .c64-re-tools/runs/cartconv/<runId>/
**Notes:** Made moot later the same session by `cartconv`'s removal. The
`.c64-re-tools/` adoption itself survived (see the closing section).

| Option | Description | Selected |
|--------|-------------|----------|
| No cleanup, matching runs/ghidra/ | The single root is what makes 'delete it all' one line | ✓ |
| Reap on the way in | Prevents mixing two invocations; a deletion path in a write-only phase | |

**User's choice:** No cleanup, matching runs/ghidra/

---

## Skill surface / ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Split across the two existing skills | Disk to c64-ram-capture, stub and cartridge to c64-program-recon; no new skill | |
| One new preprocessing skill | A seventh skill owning all three tools | |
| Scripts only, no SKILL.md prose change | Smallest diff; leaves three citations pointing at a deleted file | |

**User's choice:** free text — *"The c1541 and cartconv is logically the same
thing access and extracting data. So they go into a common skill. Petcat ASCII
conversion in a new skill"*
**Notes:** Claude re-put the two ambiguities this left open rather than guessing.

| Option | Description | Selected |
|--------|-------------|----------|
| One script per binary | Three files, subcommand idiom d64-parse.mjs already uses | ✓ |
| One script per capability | Mirrors the id set exactly; multiplies files both packaging routes must sync | |

**User's choice:** One script per binary

| Option | Description | Selected |
|--------|-------------|----------|
| New skill — image/container access | Owns .d64 via c1541 and .crt via cartconv; matches the owner's framing | ✓ |
| Existing c64-ram-capture | No new skill; but 'ram capture' becomes the cartridge skill too | |

**User's choice:** New skill — image/container access

| Option | Description | Selected |
|--------|-------------|----------|
| Both PREP-02 halves in the petcat skill | One tool, one skill, one owner of its oracle | ✓ |
| Conversion here, handover in c64-program-recon | Separates 'convert' from 'conclude'; splits PREP-02 across two skills | |

**User's choice:** Both halves in the petcat skill

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite the two existing descriptions too | Keeps the overlap gate green by making descriptions true, not by tuning wording | ✓ |
| Only write the new descriptions carefully | Smaller diff; leaves c64-ram-capture advertising a deleted capability | |

**User's choice:** Rewrite the two existing descriptions too

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-agnostic, broker-required | Declares no fork/stock need but names the broker requirement | |
| Silent on backend | Simplest; says nothing about backends since neither is needed | ✓ |

**User's choice:** Silent on backend
**Notes:** Claude verified rather than assumed — `check-skill-fork-honesty.mjs`
fires on mentions of fork-only `vice_*` tools derived from
`capability-registry.ts`, and neither new skill names one, so the gate is silent
by construction. The choice was confirmed safe.

---

## Carried items

| Option | Description | Selected |
|--------|-------------|----------|
| Take WR-03 | Two edits mirroring host-tool-client.ts:419-427; it carries resolves_phase: 40 | ✓ |
| Leave it pending | A pre-existing hole, not a PREP-01..04 gap | |

**User's choice:** Take it

| Option | Description | Selected |
|--------|-------------|----------|
| Take the mkdtemp fix | ROADMAP made it eligible here; removes a recurring false 4-fail signal | ✓ |
| Leave it | Unrelated to PREP-01..04; the race is intermittent and understood | |

**User's choice:** Take it

| Option | Description | Selected |
|--------|-------------|----------|
| A decisions doc plus the amendments | Doc carries the measured reasoning; ROADMAP + REQUIREMENTS amended in place | ✓ |
| Amendments only | Lighter; the measured evidence would live only in this log | |

**User's choice:** A decisions doc plus the amendments

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate paths (already folded) | Confirming so it moves to completed/ with its STATE.md row in the same commit | |
| Installer self-ignore its tools/ | Becomes relevant because the migration moves tools/ to .c64-re-tools/bin/ | |
| Reap vicerc scratch dirs | Adjacent, but a kill-path change this phase never opens | |

**User's choice:** *[No preference]*
**Notes:** Claude decided and recorded it as discretion — fold consolidate-paths
(a consequence, not a choice) and installer-self-ignore (the migration moves the
very directory it is about); leave the vicerc reaper.

---

## petcat decline shape

| Option | Description | Selected |
|--------|-------------|----------|
| ok:true, entrypoint:null, named reason | A resolved 'no' is a success; keeps ok:false meaning 'the tool did not work' | ✓ |
| ok:false with a distinct reason code | Safer against caller sloppiness; conflates two meanings the oracle must separate | |
| ok:true with a required verdict enum | Most explicit and future-proof; a wider response type than the requirement needs | |

**User's choice:** ok:true, entrypoint:null, named reason

| Option | Description | Selected |
|--------|-------------|----------|
| Listing to a file, verdict inline | Follows the seam's no-inline-bytes rule and dxa.disassemble's shape | ✓ |
| Both inline | Simplest for a caller; violates the rule, which has no size exemption | |

**User's choice:** Listing to a file, verdict inline

| Option | Description | Selected |
|--------|-------------|----------|
| Author one with acme | Deterministic, tiny, committed; provenance is explicit | ✓ |
| Find one in the Phase 23 corpus | Real-world provenance; unverified that one exists, and drags a large image in | |
| Both | Strongest; matches d64-parse.test.mjs's synthetic-plus-real posture | |

**User's choice:** Author one with acme

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed at -2, documented | Target is fixed to C64 everywhere in this project already | ✓ |
| Optional typed dialect field | More flexible; a wrong dialect detokenizes to plausible nonsense | |

**User's choice:** Fixed at -2, documented

---

## Closing round — cartconv removed

Claude summarised all seven areas and asked what remained. Two areas were
offered (fixture strategy, now load-bearing; and explicit ordering guidance).

**User's response:** free text — *"New hard directions, the cartconv shall not be
built and can be totally from the roadmap"*

Claude measured the removal's cost before asking anything: `PREP-03` is
referenced in exactly six prose/table sites across `REQUIREMENTS.md` and
`ROADMAP.md`, plus three `20/20` claims — and **no code or test pins the
requirement count**, so it is bookkeeping rather than a guard cascade.

| Option | Description | Selected |
|--------|-------------|----------|
| Move PREP-03 to Excluded, dated rider | Struck in place with a dated rider; coverage becomes 19/19. Matches v0.8.0's precedent | ✓ |
| Re-map to a future milestone | Preserves the id as future scope; costs an entry someone must revisit | |
| Delete it outright | Cleanest documents; breaks amend-in-place and leaves the 20/20 claims unexplained | |

**User's choice:** Move to Excluded, dated rider

| Option | Description | Selected |
|--------|-------------|----------|
| .c64-re-tools/ survives — it stands on its own | Chosen as a deliberate todo fold; its justification is untouched by cartconv's removal | ✓ |
| Drop it with cartconv | Smallest phase; but the todo has now been reviewed twice without being taken | |

**User's choice:** Yes — it stands on its own

| Option | Description | Selected |
|--------|-------------|----------|
| New disk-access skill anyway | c1541-only; still where d64-parse.mjs's replacement lands | ✓ |
| Keep c1541 in c64-ram-capture | No new disk skill; c64-ram-capture keeps its .d64 claims | |

**User's choice:** New disk-access skill anyway

| Option | Description | Selected |
|--------|-------------|----------|
| Author a synthetic .d64 with c1541 | Deterministic, committed, sha256-pinned; mild circularity acknowledged | ✓ |
| Keep using the Phase 23 corpus | Real provenance; keeps src/ tests reaching into .planning/ for binary inputs | |
| Both | Strongest; matches d64-parse.test.mjs's existing posture | |

**User's choice:** Author a synthetic .d64 with c1541
**Notes:** Claude flagged the tension with the no-mutating-verb decision
(`-format` / `-write` are mutating) and resolved it on the record: the fixture is
authored **once by a throwaway command and committed**, per the project's
established *"throwaway probe scripts are evidence, not deliverables"* pattern.
No mutating id ships.

| Option | Description | Selected |
|--------|-------------|----------|
| State the hard ordering constraints | Name only the three the planner cannot infer, each with its cause | ✓ |
| Leave it all to the planner | Less prescriptive; the three come from GSD machinery and are not inferable | |

**User's choice:** State the hard ordering constraints

---

## Claude's Discretion

- **Todo folding** (`D-28`) — the only question the owner left open. Claude
  folded consolidate-paths and installer-self-ignore, and left the vicerc reaper,
  with reasoning recorded in CONTEXT.md.
- Plan decomposition beyond the three ordering constraints; new-skill directory
  and script names; the new skills' frontmatter wording; test placement; where
  the shape declarations live inside `host-tool.mts`; the `runId` derivation;
  placement of the live-gated corpus assertion.

## Deferred Ideas

- `cartconv` and all cartridge/bank work; `PREP-03` excluded with a dated rider.
- Bank-qualified addressing as a modelled store feature (carried, now moot).
- `c1541.extract` (whole-image extraction).
- Any mutating `c1541` verb on the shipped seam.
- Version probing for the host tools (a live divergence, not a gap).
- Runtime correlation of claimed vs. actually-read sectors.
- A `petcat` BASIC dialect option.
- A retention/cleanup policy for per-run directories.
- Whether `c64-ram-capture` should be renamed now that it no longer owns `.d64`
  work — raised in passing, not decided.
