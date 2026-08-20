# Phase 10: Adoption Boundaries, Automated Bootstrap, and the Removal - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

regenerator2000 becomes a **guarded, declared, container-side static-analysis
prerequisite** that turns a raw binary into an analysed `.regen2000proj` with no
human in the loop — and the one thing it makes obsolete (`acme-build`'s
`toacme`-backed `disasm` verb plus its caveat section) is deleted.

This is **Tier 1 — CLI shell-out only**. No ports, no process lifecycle, no
`r2000_*` MCP tools. The same shape as `acme-build` calling `acme`. The
annotation store, the MCP server and the symbol round trip are **Phase 11**.

Requirements in scope: `R2000-01`, `R2000-02`, `R2000-03`, `R2000-09`,
`R2000-05`, `R2000-06` (6).

**Gate satisfied:** Phase 9's recorded verdict is `degrade` / rule `R4`
(`docs/phase9-regenerator2000-probe-findings.md` frontmatter). Criteria 2a/2b
passed cleanly, so criterion 3 proceeds as a **real automated bootstrap**, not a
documented manual step.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap mechanism (criterion 3 — `R2000-09`)

- **D-01 (Claude's call, evidence-backed): the bootstrap synthesises the
  `.regen2000proj` file directly in Node. It does not drive the TUI.** The user
  declined to pick a mechanism ("not sure it's your job to figure that out" — it
  isn't theirs), so this is decided from evidence gathered live during the
  discussion against the installed regenerator2000 0.9.20:
  - `ProjectState`
    (`~/.cargo/registry/src/index.crates.io-*/regenerator2000-core-0.9.20/src/state/project.rs:41-96`)
    has exactly **three** fields without `#[serde(default)]`: `origin`,
    `raw_data_base64`, `blocks`. Everything else — `version` included — defaults.
  - The project file is **plain JSON**. Only the `raw_data_base64` *value* is
    gzip-then-base64 (`encode_raw_data_to_base64`, same file, line ~138). A first
    attempt writing uncompressed bytes failed with `Error loading file: invalid
    gzip header`; gzipping the payload fixed it.
  - A ~15-line Node function producing
    `{origin, raw_data_base64: gzip(body), blocks: [], settings: {...}}` from a
    `.prg` was loaded by `regenerator2000 --headless --export_asm out.a
    --assembler acme`, auto-analysed, and exported correct ACME source —
    including all six illegal opcodes (`lax`, `sax`, `slo`, `dcp`, `isc`, `anc`)
    correctly decoded, cross-references resolved, and a `!cpu 6510` assemble
    hint in the header. Exit 0.
  - The same synthesis over a **full flat 64K** image loaded and exported in
    **0.12 s**.
  - **Why not the probed keystroke route:** it costs `tmux` as a new declared
    prerequisite that criterion 5 would then have to document, and it *still*
    needs a JSON post-edit afterwards to force `use_illegal_opcodes` (Phase 9
    accepted-limits entry 1). Synthesis removes the pty, the modal, the
    keystroke encoding, the terminal-size assumption and the post-edit in one
    move.
  - **Both Phase 9 amendments become unreachable rather than mitigated.** We set
    `system` explicitly, so `file_io.rs`'s `suggested_system` `"C64SC"`
    mismatch is never consulted; we set `use_illegal_opcodes: true` at birth, so
    there is no default to flip.

- **D-02 (user): `.d64` is a first-class input, and the file inside it is named
  explicitly or the bootstrap fails loudly.** Caller names the directory entry;
  with no name given, print the directory listing and exit non-zero telling the
  user to pick. **Never guess** — a silent auto-pick would happily analyse a
  cracktro or loader stub instead of the game, which is precisely the failure
  `c64-provenance-diff` exists to prevent.

- **D-03: the input set is `.prg`, `.d64` (named entry), and flat 64K `.raw`.
  `.vsf` is dropped from this phase.**
  - `.prg` and `.d64` are the user's explicit answer.
  - Flat 64K is **kept because `R2000-06` names it** ("A `.prg` **or flat 64K
    capture** becomes reassemblable ACME source"), it is what
    `c64-ram-capture` already produces, and D-01 makes it a two-line case
    (`origin: 0`, whole buffer) — proven working above. Dropping it would leave
    `R2000-06` partly unmet.
  - `.vsf` is dropped because under D-01 we never hand r2000 a container format
    at all, and parsing VICE snapshots ourselves is real new work whose only
    payoff — machine-type and start-address auto-detection — Phase 9 proved
    unreliable for the machine-type field anyway.
  - **⚠ Planner must reconcile wording:** ROADMAP.md's criterion 3 says "A
    `.prg` or a `.vsf`", and the milestone's standing constraint says "prefer
    `.vsf` over `.raw`". Both are superseded here. Amend the criterion-3 wording
    and mark the standing `.vsf` preference as not applying to Phase 10, rather
    than silently shipping a different input set than the ROADMAP claims.

- **D-04: version tolerance comes from minimality plus a self-check, not from a
  version pin.** The user asked for "the simplest and cleverest way to support
  any version of regenerator2000". Write **only** the three required fields plus
  the settings we deliberately force — every other field is `#[serde(default)]`,
  so a minimal file is maximally forward-compatible by construction. Then prove
  it loaded by actually running r2000 once and checking the result, rather than
  consulting a version table. **No `--version` allow-list**, no known-good range:
  a version gate would block users on a newer r2000 that works fine, and would
  not detect a schema break within a permitted version anyway.

- **D-05 (Claude's call — user said "you decide"): every generated project
  forces `use_illegal_opcodes: true` and an explicit `system`, pinned by a
  test.** No flags, no knob. Illegal-opcode-correct decoding is the entire
  reason the `toacme` caveats existed, so making it optional reintroduces the
  defect as a configuration choice; and an explicit `system` is what closes
  Phase 9's `.vsf` machine-type limit. A flag can be added later if a non-C64
  target ever appears — that is not this milestone.

### Adoption boundaries (criteria 1-2 — `R2000-01`, `R2000-02`)

- **D-06 (Claude's call — user said "you decide"): the guarded launch seam is a
  module under `.claude/mcp/vice/`, with a thin skill-side entry point for CLI
  ergonomics.** Decided on test reachability, which is the deciding fact:
  - `hostpath-consumers.test.ts` enumerates **only** top-level modules of
    `.claude/mcp/vice/` (it walks `HERE`). Criterion 2's assertion is an
    *absence* of translation, and that absence can be asserted **structurally**
    there and nowhere else without building new machinery.
  - CI runs `npm test` **only** inside `.claude/mcp/vice`
    (`.github/workflows/ci.yml`). **Skill-side `*.test.mjs` files never run in
    CI today** — `d64-parse.test.mjs`, `diff-images.test.mjs`,
    `watch-loads.test.mjs` and `dump-artifacts.test.mjs` are all unrun. A guard
    test living in a skill script would be green-by-absence, and criteria 1 and
    2 both say "pinned by a test".
  - Phase 11 puts the `r2000_*` MCP surface in that directory regardless, so the
    seam is already where it will be needed — no relocation later.
  - **Open for research:** exactly how the skill-side entry reaches the seam.
    A skill `.mjs` importing a `.ts` module across the package boundary is
    fragile once `@henols/vice-mcp` is an installed dependency rather than a
    sibling directory. Shelling out to a small CLI entry in the MCP directory
    (the `probe-binmon.mjs` / `smoke.mjs` precedent) is the likely answer; the
    researcher should settle it against `install-resources.ts` and
    `project-paths.mjs`.

- **D-07: `--vice` is unreachable by construction, *and* denied by a scan —
  both, and both pinned.** No caller-supplied argv passthrough: argv is built
  only by fixed per-verb builders, so a caller cannot inject a flag at all. On
  top of that, the final argv is scanned for `--vice` immediately before spawn
  and the launch **throws** a named error if it is ever present, mirroring
  `vice.ts`'s `DENY_LIST` / `denyListRefusalMessage()` precedent. Construction
  alone would silently stop being true the first time someone adds a
  pass-through option; the scan is the regression net. Never strip the flag
  silently — a silent strip hides the bug.

- **D-08: criterion 2's no-translation absence is asserted by extending
  `hostpath-consumers.test.ts`'s closed consumer set**, adding the r2000 module
  to the "must be absent from the hostpath consumer set" side — the exact mirror
  of `DERIV-07`, where translation was wrongly applied. Do **not** write a new
  bespoke test for this; the closed-consumer-set mechanism already exists and
  already runs in CI.

### The reassembly proof (criterion 4 — `R2000-06`)

- **D-09 (user): lean on regenerator2000's own `--verify`** rather than building
  an independent export-assemble-diff harness. `--verify` already spawns a real
  assembler; on the synthesised fixture it reported
  `✓ ACME — byte-identical (44 bytes)` (and ca65 likewise). The caveat was put
  to the user — this is r2000 checking its own export, the shape of internal
  check this project has been burned by repeatedly — and they chose it anyway.
  Recorded as their decision.

- **D-10: the check keys on the parsed ACME result line, never on the exit
  code.** This is not a reversal of D-09; it is what makes D-09 sound. Proven
  live during the discussion:
  - With **no** assembler on `PATH`: `No assemblers found`, **exit 1**. Good.
  - With **ca65 present and ACME absent**: `✗ ACME — ACME not found in PATH
    (skipped)` followed by `✓ All roundtrip verifications passed.`, **exit 0** —
    a false pass, with ACME never run.
  - Criterion 4 is specifically about **ACME** source matching this project's
    `!cpu 6510` expectations, so exit-code-only would let the one assembler that
    matters be skipped silently. Assert the ACME line is `✓` and **fail on
    `skipped`**.

- **D-11 (Claude's call): CI does not install regenerator2000.** The check is a
  named SKIP when r2000 is absent and a hard FAIL under a `VICE_REQUIRE_R2000`
  env var — exactly `disasm-roundtrip.test.ts`'s `VICE_REQUIRE_ACME` pattern,
  including its "exactly one test always runs, never skipped" availability gate.
  Rationale: `cargo install regenerator2000` measured **4m48s–5m39s** and needs
  a Rust toolchain at **rustc >= 1.90**; the user chose `--verify` for being
  "cheapest by far", and putting a five-minute Rust build on every merge
  contradicts that. The phase records its live `--verify` evidence in its own
  artifacts instead. Never use a hand-rolled `if (!available) return` — that
  reports a false PASS rather than a SKIP.

### The removal (criterion 4 — `R2000-05`)

- **D-12 (Claude's call — user asked for "flexible and simple without
  duplicating functionality"): one implementation, one entry point, verb
  deleted, no new skill.**
  - `cmdDisasm()` (`.claude/skills/acme-build/scripts/acme.mjs:208-223`) is
    deleted outright, along with its `disasm` dispatch entry and usage line.
  - `acme-build/SKILL.md`'s `## Disassembly` section (~lines 134-153), its
    `toacme`-on-PATH prerequisite (line 180) and the `disasm` line in its
    opening synopsis (line 16) go with it. The `.dis.a` → `.dis.asm` Read-tool
    workaround, the "define the out-of-range labels" instruction and the
    "indent the illegal-opcode lines" instruction all disappear — they existed
    **only** because `toacme` does a flat linear decode.
  - `acme.mjs` keeps its stated scope intact ("wraps `acme` and `toacme` and
    nothing else — **assembling only**"): after the deletion it wraps `acme`
    alone and gains no second binary dependency.
  - **No 7th skill.** A new skill would cost the installer sync, the plugin
    manifest and `check-skill-tool-coverage.mjs`, and would pre-build Phase
    11's home during Phase 10.
  - The replacement route is documented from the skills that need it
    (`acme-build`, and `c64-program-recon` where static analysis actually
    belongs) — both pointing at the single seam from D-06, not each carrying
    their own copy.

### Install story (criterion 5 — `R2000-03`)

- **D-13: the CI honesty guard must be inverted, not worked around.**
  `scripts/check-skill-fork-honesty.mjs:253` currently lists
  `["regenerator2000", "D-B: this phase's install docs must stay
  regenerator2000-free"]` in `FORBIDDEN_README_SUBSTRINGS`. Criterion 5 requires
  the name **in** README.md. Move it to `REQUIRED_README_SUBSTRINGS` with a
  `whatIsLost` string, and update that file's header comment, which still says
  "the regenerator2000 name Phase 8 removed".

- **D-14: the license is `MIT OR Apache-2.0` (dual), and the notices must say
  the true thing.** `09-RESEARCH.md:55` had this right; `R2000-03`'s own wording
  and `.planning/notes/regenerator2000-integration.md:253` still say Apache-2.0
  only (Phase 9 findings § Corrections, entry 2 — flagged there explicitly for
  this phase to pick up). Both `LICENSE-MIT` and `LICENSE-APACHE` ship in the
  crate. Correct the requirement text and the note as well as writing the
  notice, so the wrong claim stops propagating.

- **D-15: the documented facts are the measured ones, not the estimated ones.**
  - `cargo install regenerator2000` — **no upstream release assets exist**.
  - Toolchain floor **rustc >= 1.90**, the verified figure. Both earlier
    readings (`>= 1.85` from edition 2024, `>= 1.88` from `Cargo.lock` pins)
    undercounted and are superseded; `rust:1.88-slim` fails a real
    `cargo install` (`quantette@0.6.0` needs 1.90, `safe_arch@1.2.0` and
    `wide@1.6.1` need 1.89).
  - Container cost, both numbers, as absolute sizes with no baseline to diff
    against: single-stage **~1.26 GB** (build 5m39s), multi-stage **~251 MB**
    (build 4m48s).
  - The one-project-per-namespace limit is **stated, not detected** (the
    `R2000-04` fold).
  - Apache-2.0 **and** MIT notice per D-14, in
    `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` (the canonical file — the root
    `THIRD-PARTY-NOTICES.md` is a 4-line pointer to it).

### Claude's Discretion

The user explicitly delegated four decisions. They are recorded above as
decisions rather than left open, so the planner does not re-litigate them:
**D-01** (bootstrap mechanism), **D-05** (forced settings), **D-06** (seam
location), **D-12** (replacement surface). **D-11** (CI does not install r2000)
follows from the user's `--verify` choice and is likewise Claude's call.

Still genuinely open for research, not decided here:
- How the skill-side entry point reaches the D-06 seam across the package
  boundary (see D-06's open item).
- Whether `.d64` file extraction extends `d64-parse.mjs` in place or lands
  beside the seam. `parseDirectory()` already follows sector chains, but there is
  **no exported file-extraction function** — following an entry's chain to
  recover its bytes is new, small work. Note that module's documented limits:
  plain 174848-byte, 35-track images only, no error bytes, no 40-track variants.
- Exact CLI verb names for the new route.

### Folded Todos

Both matched todos were folded in by the user.

1. **`.planning/todos/pending/2026-08-17-document-second-binmon-client-as-a-wedge-lookalike.md`**
   (carries `resolves_phase: 10` explicitly). A second binmon client is
   behaviourally identical to a hung emulator — socket open, writes succeed,
   nothing comes back — and nothing tells the user why. Its **item 3 *is*
   criterion 1**: "the never-`--vice` rule needs a real guard, not just prose,
   mirroring the existing `DENY_LIST` pattern in `vice.ts`" → satisfied by
   **D-07**. Items 1-2 land beside criterion 5's doc work: add "another client
   already holds the binary monitor" to `vice-wedge-triage/SKILL.md`'s
   diagnosis table (with its discriminator — a socket that accepts a connection
   but never answers a `PING` is contention, not a wedge, and the broker knows
   whether it already holds a lease on that port), and state the rule positively
   in the install docs — on the stock backend, **exactly one process may hold
   `-binarymonitor`**. Note the hazard is not r2000-specific: a stray `nc`, a
   second Claude session, or VICE's own `-remotemonitor` does the same.

2. **`.planning/todos/pending/2026-08-19-acme-build-scaffold-library-missing-on-both-provisioning-routes.md`**
   (priority high). `acme-build`'s `template.a` `!source`s a `cbm/c64/*.a`
   library that **neither** documented ACME provisioning route supplies — not a
   bare `~/.local/bin/acme`, not the Debian trixie `apt` candidate (both
   verified). CI has the identical gap silently: `ci.yml` installs `acme` and
   only checks the binary exists and prints a banner; it never assembles the
   scaffold. Fits this phase because criterion 4 is already editing
   `acme-build/SKILL.md` and already depends on a real ACME being genuinely
   usable. Closing it means either vendoring a minimal `cbm/c64/*.a` beside the
   scaffold or rewriting `template.a` to use local hardware constants only —
   then updating the SKILL.md "Verified live" claim and making CI **actually
   assemble the scaffold** instead of probing the binary.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The Phase 9 gate — read first
- `docs/phase9-regenerator2000-probe-findings.md` — the go/no-go gate. Its
  frontmatter `verdict` key (`degrade`) and `verdict_rule_applied` (`R4`) are
  what Phase 10's planner reads **before writing any plan**. Also carries:
  § Accepted limits (the two amendments), § Corrections to prior documents
  (the rustc >= 1.90 correction, the dual-license correction, the undocumented
  Import Context Setup modal, `use_illegal_opcodes` scope), § Other findings
  (the `handler.rs:1894` u16 defect, the cross-connection snapshot gap).
- `.planning/phases/09-the-assumption-probe-go-no-go/09-RESEARCH.md` — the
  phase's research base, already corrected in place by plan 09-08.
- `.planning/phases/09-the-assumption-probe-go-no-go/evidence/` — the raw
  transcripts every finding above is derived from.

### Requirements and roadmap
- `.planning/ROADMAP.md` § Phase 10 — the five success criteria and their
  Notes, including the criterion-3-before-criterion-4 ordering hazard.
  **Criterion 3's input list and the milestone's standing "prefer `.vsf`"
  constraint are amended by D-03** — reconcile the wording.
- `.planning/ROADMAP.md` § Standing Constraints — applies to every phase, not
  repeated as per-phase criteria.
- `.planning/REQUIREMENTS.md` — `R2000-01`, `R2000-02`, `R2000-03`
  (Apache-2.0-only wording corrected by D-14), `R2000-09`, `R2000-05`,
  `R2000-06` (names flat 64K capture — see D-03).
- `.planning/notes/regenerator2000-integration.md` — decisions `D-R1`..`D-R4`,
  the overlap map, source-confirmed upstream blockers. Line 253's
  Apache-2.0-only claim is wrong (D-14).

### Project constraints
- `CLAUDE.md` § Constraints — the single-client binary-monitor constraint that
  the whole milestone shape follows from; the `hostpath.ts` / `containerpath.ts`
  / `container-guard.mts` closed-consumer-set rule; the no-build-step rule for
  the shipped server; the `resources/*.mjs` committed-artifact rule.

### Code the phase modifies or reuses
- `.claude/skills/acme-build/scripts/acme.mjs:208-223` — `cmdDisasm()`, the
  14-line `spawnSync` wrapper this phase deletes.
- `.claude/skills/acme-build/SKILL.md:16,134-153,180` — the synopsis line, the
  `## Disassembly` caveat section, the `toacme`-on-PATH prerequisite.
- `.claude/mcp/vice/hostpath-consumers.test.ts` — the closed-consumer-set
  machinery criterion 2 extends (D-08). Note `EXPECTED_IMPORTERS` is an exact
  five-element assertion.
- `.claude/mcp/vice/disasm-roundtrip.test.ts` — the availability-gate and
  never-skipped-test pattern D-11 mirrors, plus its "never interpolate test
  input into a shell command string" and "never treat an ACME stderr WARNING as
  a failure" rules.
- `.claude/mcp/vice/vice.ts` — `DENY_LIST` / `denyListRefusalMessage()`, the
  precedent D-07 mirrors.
- `scripts/check-skill-fork-honesty.mjs:253` — the guard D-13 inverts, plus its
  header comment.
- `.github/workflows/ci.yml` — the ACME install step and the `VICE_REQUIRE_ACME`
  Test step; the file that must learn to assemble the scaffold (folded todo 2).
- `.claude/skills/c64-ram-capture/scripts/d64-parse.mjs` — BAM and directory
  parsing to reuse for D-02; no file-extraction export yet.
- `.claude/mcp/vice/THIRD-PARTY-NOTICES.md` — the canonical notices file (the
  root one is a pointer).

### regenerator2000 0.9.20 source, on disk
Verified present at
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`. Read the source, not
the web — every claim in D-01/D-04/D-10 was checked against it.
- `regenerator2000-core-0.9.20/src/state/project.rs:41-96` — `ProjectState`, the
  three required fields, the `#[serde(default)]` set; `:138-155` —
  `encode_raw_data_to_base64` / `decode_raw_data_from_base64` (gzip+base64);
  `compress_block_types` (the run-length `blocks` shape, indices not addresses).
- `regenerator2000-0.9.20/src/main.rs:141-152` — `validate_headless_mode()`,
  `exit(1)` on any non-`.regen2000proj` input; `:710` — `headless = cli.headless
  || cli.verify || cli.mcp_server_stdio`, so **all three** headless routes
  require a project file.
- `regenerator2000-core-0.9.20/src/mcp/handler.rs:350-352,1264-1271` —
  `r2000_save_project` takes **no arguments** and errors `-32603` when
  `project_path` is `None`. **There is no MCP tool that loads a file** (28 tools,
  none an open/load), so the MCP surface cannot bootstrap either — relevant to
  Phase 11, not just here.
- `regenerator2000-core-0.9.20/src/mcp/handler.rs:1894` — the `raw_data.len() as
  u16` overflow that makes `r2000_get_address_details` report `OutOfRange` for
  any full-64K load.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`disasm-roundtrip.test.ts`** — already the exact "prove it with a real
  assembler" harness: `SKIP_REASON` computed once at module scope, one
  never-skipped availability test, `VICE_REQUIRE_ACME` turning absence into a
  hard FAIL in CI, argv-array spawns rather than shell strings. D-11 copies this
  wholesale rather than inventing a gate.
- **`hostpath-consumers.test.ts`** — already the machinery for asserting an
  *absence* of path translation, with a closed consumer set and per-module
  "must be absent" tests. D-08 extends it.
- **`d64-parse.mjs`** — pure-Node `.d64` parsing (`sectorsPerTrack`,
  `tsToOffset`, `parseBam`, `parseDirectory`), deliberately independent of the
  emulator. Serves D-02's directory listing directly; file extraction is the
  gap.
- **`acme.mjs`'s `findAcmeLib()` probe** — the established shape for "locate an
  external tool's data, don't assume a path", validated by a file we actually
  include. The r2000 route needs the same posture for the binary itself.
- **`vice.ts`'s `DENY_LIST`** — the established "hard-block by name at every
  dispatch seam, never re-derived locally" pattern D-07 mirrors.

### Established Patterns
- **Single seam per concern.** One file owns each cross-cutting responsibility;
  re-deriving a seam locally is a named anti-pattern in `CLAUDE.md`. D-06 and
  D-12 both follow from this.
- **Source header comments carry WHY, what NOT to do, and the dated incident
  that motivated the file.** New modules are expected to match that density.
- **Evidence over assertion.** Four times in v0.2.0 the external check found
  what the internal one could not — Phase 8.1 *falsified* an unwitnessed claim
  and exposed a real defect. D-10 exists because of this posture, and every
  D-01 claim above was run, not reasoned.
- **No build step for the shipped server**, and host-bound `.mts` must be
  compiled into committed `resources/*.mjs` with `resources-sync.test.ts`
  failing CI on drift. The r2000 seam is container-side (D-R4), so it should
  **not** need to become a `resources/` artifact — worth confirming, not
  assuming.

### Integration Points
- **CI test scope is narrower than it looks.** `ci.yml` runs `npm test` only
  inside `.claude/mcp/vice`; **no skill-side `*.test.mjs` runs in CI at all**
  (`d64-parse.test.mjs`, `diff-images.test.mjs`, `watch-loads.test.mjs`,
  `dump-artifacts.test.mjs`). This is the load-bearing fact behind D-06, and
  folded todo 2 wants CI to gain real coverage rather than a version banner.
- **`check-skill-tool-coverage.mjs` and `check-skill-fork-honesty.mjs`** both
  run in CI over skill prose. Editing `acme-build/SKILL.md` and README.md means
  both gates apply; D-13 is one of them actively blocking criterion 5 today.
- **The installer duplicates the skills** (`installer/skills/`, synced by
  `installer/scripts/sync-skills.mjs`) and `check-npm-packages.mjs` validates
  both tarballs' file lists. Deleting a verb and its docs has to land on both
  sides.
- **`.vsf` production is a broker-side concern.** Phase 9 found that splitting
  `vice_memory_write` and `vice_snapshot_save` across separate MCP connections
  produced a snapshot missing the written bytes — any future flow that pokes
  state then snapshots it must issue every step on **one** connection. D-03
  drops `.vsf` from this phase, so this constrains Phase 11, not Phase 10.

</code_context>

<specifics>
## Specific Ideas

- **"It must handle `.prg` and `.d64` files"** — the user's own words, and the
  one input-set requirement stated directly rather than inferred. `.d64` is not
  in the ROADMAP's criterion-3 wording; it is now in scope (D-02, D-03).
- **"I want the simplest and cleverest way to support any version of
  regenerator2000"** — read as an explicit rejection of version pinning and
  version tables, and as licence for the minimal-fields approach in D-04.
- **"Flexible and simple without duplicating functionality, use the best way"**
  — the constraint on D-12. One implementation, referenced from wherever it is
  needed; no copy per skill, no new skill.
- **The mechanism question was handed back** ("not sure it's your job to figure
  that out"). Read as: do not bring implementation-mechanism choices to the user
  again in this phase. Decide them from evidence and record the evidence.

</specifics>

<deferred>
## Deferred Ideas

- **`.vsf` as a bootstrap input** — deferred out of Phase 10 by D-03. **Resolved
  by Phase 11's D-34 (2026-08-20): this was a dangling forward reference, not a
  deferral to a real destination.** `R2000-14`/`R2000-15` are about the symbol
  round trip (VICE label files), not about accepting `.vsf` as a project
  bootstrap input — no `R2000-*` requirement covers that capability. It is now
  filed as backlog instead:
  `.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md`, which
  records the Phase 9 machine-type limit and the single-MCP-connection snapshot
  constraint (both still true) alongside the reason no requirement claims it.
- **`--mcp-server-stdio` instead of the HTTP server for Phase 11.** Found while
  researching this phase: r2000 exposes a **stdio** MCP transport
  (`main.rs:66`, `run_headless_mcp`), not just HTTP on port 3000. That would
  sidestep the fixed-port collision that produced the one-project-at-a-time
  limit (`R2000-04`) entirely — potentially removing the very limitation D-15
  documents. It also implies `--headless`, so it needs a project file, which
  D-01's synthesis now provides. **Phase 11 should evaluate this before
  building against the HTTP transport.**
- **The `r2000_get_address_details` u16 overflow** (`handler.rs:1894`,
  `raw_data.len() as u16` wraps 65536 to 0, so any full-64K project reports
  `OutOfRange`). Worth filing upstream; Phase 11 will need a workaround wherever
  it queries address details against a full-memory image.
- **Non-ACME export formats** (`64tass`, `ca65`, `kick`). r2000 supports all
  four and `--verify` checks whichever are on `PATH`; this project only cares
  about ACME (`!cpu 6510`). Not scope.
- **Two-project-limit detection and reporting** — permanently out of scope by
  the `R2000-04` fold; documented (D-15), never detected. Building detection for
  an upstream port collision is work in the wrong place.
- **The v0.4.0-shaped todo `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`**
  — not folded, not phase-10 scope. Semver-major, and 24 fork-only tools each
  need a drop/reimplement/accept-loss decision.

### Reviewed Todos (not folded)

The `todo.match-phase` scan surfaced 15 matches, all at the same 0.6 keyword
score. Thirteen were keyword noise against this phase (stock-VICE fixture
re-recording, `vice_ping`'s `resolvedBinaryPath`, warp-over-`RESOURCE_SET`,
`RELEASES.json` schema, drive-type prerequisites, plugin-payload relocation,
and similar). They remain pending and unchanged; only the two folded above have
any real bearing on Phase 10.

</deferred>

---

*Phase: 10-Adoption Boundaries, Automated Bootstrap, and the Removal*
*Context gathered: 2026-08-20*
