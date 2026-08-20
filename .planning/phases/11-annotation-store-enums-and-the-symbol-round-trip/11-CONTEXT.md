# Phase 11: Annotation Store, Enums, and the Symbol Round Trip - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

regenerator2000's **project state becomes this project's queryable annotation
store**, reachable from a Claude session through the `vice` MCP server, with two
closed loops on top of it:

1. `memmap.json` → generated enums → a disassembly that renders register writes
   with semantic names.
2. store → `--export_lbl` → `vice_symbols_load` → a name discovered against the
   running machine → `--import_lbl` → store. One loop, not two dumps.

This is **Tier 2 — the container-side MCP surface**, the higher-risk half of the
milestone and the reason it exists. Phase 10 delivered Tier 1 (guarded CLI
shell-out, no ports, no process lifecycle); this phase adds the tool surface.

Requirements in scope: `R2000-10`, `R2000-11`, `R2000-13`, `R2000-14`,
`R2000-15` (5).

**Not in scope:** `.vsf` as a bootstrap input (D-34), non-ACME export formats,
two-project-limit detection (`R2000-04`, permanently folded), HTML export with
xrefs (`R2000-07`, cut).

</domain>

<decisions>
## Implementation Decisions

Every claim marked **measured** below was run against installed
regenerator2000 **0.9.20** during this discussion, on this host. Nothing in this
section is reasoned-from-source-only unless it says so.

### Store access and lifecycle

- **D-16 (user): the store is reached by proxying `r2000_*` tools through our own
  MCP server**, which drives `regenerator2000 --mcp-server-stdio` as a child and
  forwards calls. Not a second MCP server in the manifest, not CLI-only.
  - **Measured:** `--mcp-server-stdio` speaks MCP `2024-11-05` over stdio,
    answers `initialize` with `serverInfo.name = regenerator2000-core-mcp`
    `version 0.9.20`, and lists **28** tools.
  - Why not a second declared MCP server: MCP server config in `.mcp.json` /
    `plugin.json` is **static**, so the project path would be frozen at session
    start — no bootstrap-then-analyse in one session, no second program. It
    would also put 28 tools outside our deny-list and capability-honesty gates,
    and would stop `r2000-launch.ts` being the only spawn path, which is what
    makes **D-07's `--vice` guard** load-bearing.
  - Why not CLI-only: criterion 2's xrefs and disassembly search would mean
    re-implementing r2000's analysis engine in Node — the one thing the
    milestone exists to avoid.
  - **This makes us an MCP *client* for the first time.** New machinery; the
    researcher should settle the client shape (see Open Questions).

- **D-17 (user): per-call lifecycle — spawn, load, mutate, `r2000_save_project`,
  exit.** No long-lived child, no process supervision, no second wedge class.
  - **Measured:** a full flat-64K project loads in **0.12 s** (Phase 10) and a
    save writes the whole project file back.
  - **Known cost, accepted:** `r2000_undo` / `r2000_redo` are useless under this
    lifecycle (history dies with the process), which is one reason they are
    outside the curated surface (D-18).

- **D-18 (user): the surface is a curated subset named for the criteria**, not a
  28-tool passthrough. In: `set_label_name`, `set_comment`, `set_data_type`,
  `add_scope`, `get_cross_references`, `search_disassembly`, `get_symbols`,
  `get_comments`, `get_blocks`, `get_binary_info`, `disassemble`, the enum trio
  (`create_project_enum`, `update_project_enum`, `delete_project_enum`),
  `apply_enum_usage`, `save_project`, `batch_execute`. Out: TUI-shaped tools
  (`jump_to_address`, `get_disassembly_cursor`, `read_selected`,
  `toggle_splitter`), `undo`/`redo` (D-17), and `get_address_details` (D-32).
  - The exact final list is the planner's to fix; the *rule* is that a tool
    earns its place by serving a named criterion.

- **D-19 (user): every `r2000_*` tool takes an explicit `.regen2000proj` path.**
  Composes with D-17, sidesteps the fixed-port one-project-at-a-time limit
  entirely (stdio has no port at all — this may retire the limitation
  **D-15** documents, and the planner should say so if it does), and keeps the
  store's location visible in the transcript instead of ambient session state.

- **D-32 (Claude's call, user said "you decide"): `r2000_get_address_details` is
  excluded from the surface, and the defect is filed upstream.**
  - **Measured on a real full-64K project:** `get_address_details(2064)` returns
    `{"type":"OutOfRange"}` for **every** address, while `get_binary_info`
    (`size: 65536`), `get_cross_references` (`$D011` → `[2066]`),
    `search_disassembly`, `get_blocks` and `disassemble` all answer correctly on
    the *same* project. Root cause `handler.rs:1894`,
    `raw_data.len() as u16` — 65536 wraps to 0.
  - `c64-ram-capture` produces exactly 64K, so this is **every captured
    program**, not an edge case. Shipping a tool that fails on this project's own
    default shape is precisely what `check-skill-fork-honesty.mjs` exists to
    stop.
  - Its answer is a **composite** of instruction semantics, xrefs, labels,
    comments and block type — all reachable through tools that were measured
    working on 64K. No client-side reimplementation: that is what the CLI-only
    route was rejected for.
  - **Filed upstream:**
    <https://github.com/ricardoquesada/regenerator2000/issues/42>, with the
    reproduction, the affected/unaffected tool table and a suggested fix.
  - **Also found, do not re-derive:** `analyzer.rs:576`/`:588` and
    `exporter/html.rs:264` narrow the same value the same way. `flow_analyze`
    survives **by accident** — with `origin == end_addr == $0000` its
    `to_offset` else-branch (`addr >= origin || addr < end_addr`) admits every
    address. `r2000_disassemble` on a 64K project was measured working. Do not
    "fix" our side around a bug that is not biting.

- **D-33 (user): `r2000_batch_execute` is exposed, and every inner call's tool
  name is validated against the curated set before forwarding.** A batch is
  refused whole if any inner name is outside the subset.
  - `batch_execute` dispatches by inner tool **name** — structurally the same
    smuggling shape `vice.ts`'s `DENY_LIST` already guards for `tools_call` /
    `tools_list`. Mirror that precedent; do not invent a second pattern.
  - Batching is what makes D-17's per-call spawn viable: a memory map is dozens
    of labels, comments and block ranges, and without batching that is dozens of
    spawns each paying a load and a whole-file save.
  - r2000's own guidance on the tool: "Use only when you have 5+ independent
    operations... Do not use for operations that depend on each other's results."
  - **Pinned by a test that tries to smuggle a dropped name through a batch.**

### Enum generation (`R2000-13`)

The mechanism is **not** what the requirement's wording assumes. Read this before
planning criterion 3.

- **The mechanism, measured:** `EnumDefinition.variants` is
  `BTreeMap<u16, String>` — a flat **value → name** map. An enum is bound to an
  **instruction address** via `enum_usages` / `r2000_apply_enum_usage`, and
  renders as `EnumName_VARIANT`. **There is no bit-OR composition anywhere in
  0.9.20.** Applying an enum emits its **entire** variant list into the exported
  header (measured: 4 variants defined, 1 used, all 4 emitted). An **unmatched
  value falls back to bare `#$1b`** and still emits the dead definitions.
  - Working output, measured end to end:
    ```
    D011_YSCROLL3_ROW25_SCREENON_TEXT = $1b
    init_screen         lda #D011_YSCROLL3_ROW25_SCREENON_TEXT
                        sta a_D011
    ```

- **D-20 (user): generate program-specific enums — name only the values this
  program actually writes.** For each `lda #imm` feeding a store to a known
  register, decode `imm` against the bit-name table and emit **one** variant for
  that value.
  - A real program writes 2–5 distinct values per register, so headers stay
    short and every bound immediate resolves. This satisfies criterion 3's own
    example literally.
  - Rejected: **all 256 values per register** — a used enum dumps its whole
    variant list, so one register touched = 256 `=` lines; six registers ships a
    ~1500-line preamble. It reassembles and is unreadable, which defeats the
    criterion.
  - Rejected: **single-bit masks only** — measured to give the worst of both:
    `$1b` renders as bare `#$1b` *and* the unused definitions are still emitted.

- **D-21 (user): generated enums live project-level, inside the
  `.regen2000proj`.** Via `r2000_create_project_enum` + `r2000_save_project` —
  measured surviving a reload from disk in the `enums` and `enum_usages` maps.
  - Self-contained, diffable, revertible by one file, and writes **nothing
    machine-global**. Rejected: `save_global_enum()`'s `ProjectDirs` config dir
    — an invisible machine-wide side effect from a container-side tool, shared
    with the human's own r2000 TUI usage, where a name collision silently
    changes an unrelated project. Same posture as Phase 8.1's refusal to write
    into machine-global `~/.claude/plugins/`.

- **D-22 (user): bit names come from `memmap.json`'s 29 structured `bits`
  entries plus a curated address→bit-name table in this repo**, generated from
  memmap and reviewed once, re-runnable per `R2000-13`.
  - **Measured:** `memmap.json` has 959 entries; only **29** carry a structured
    `bits` array; 282 carry `reg`; the rest have bit detail only as prose in
    `desc`.
  - The 29 cover exactly the chips the criterion names: `$01`, `$D011`, `$D016`,
    `$D018`, `$D019`, SID `$D403`–`$D418`, CIA `$DC00`/`01`/`0D`/`0E`/`0F` and
    `$DD00`/`01`/`0D`/`0E`/`0F`.
  - The prose cannot become an identifier mechanically — real values include
    `"Smooth Scroll to Y Dot-Position (0-7)"` and OCR damage
    (`"O = Blank"` with a letter O for zero, `"Read NMls"` for `NMIs`). A
    normaliser plus exception list *is* the curated table, only implicit and
    untested.
  - **Known gap to state honestly:** `$D015`, `$D017`, `$D01A`, `$D01B`–`$D01D`
    are absent from the 29 despite being the most-written VIC-II bitmasks in a
    real game. They are trivially regular (bit N = sprite N) — the curated table
    is where they land, if they land.
  - **`R2000-13`'s wording needs correcting:** it credits r2000 with
    "the enum mechanism and `--dump-enum-files`". `--dump-enum-files` only writes
    the **three built-in** enums (`vic_ii_colors`, `vic_colors`,
    `petscii_shifted`) to a directory and exits — it is how you learn the TOML
    shape, **not** an install path. The install path is
    `r2000_create_project_enum` (D-21).

- **D-23 (user): pair `lda #imm` → `sta <register>` as an adjacent pair only. No
  dataflow.** Bind when the immediate load is immediately followed by a store to
  a known register — the dominant C64 idiom and criterion 3's own example.
  - A miss costs nothing (the immediate stays hex); a **wrong** binding renders a
    confident semantic name over an unrelated value, which is worse than none.
  - **Report coverage explicitly:** count paired vs. total register stores seen,
    so what was skipped is visible rather than implied. (`CLAUDE.md`'s no-silent-
    caps posture.)

### The store vs. the Markdown memory map (`R2000-10`, `R2000-11`)

- **D-24 (user): the store is canonical; the Markdown memory map becomes a
  rendered view.** Recon writes to the store, and the memory map is generated
  from it. Kills the drift class outright and makes criterion 1's "query instead
  of re-deriving" true by construction.

- **D-27 (user): run-scoped facts stay in Markdown as a provenance header.**
  The capture SHA-256, `$01`, `$DD00`, video standard, derived graphics chain and
  raster positions are facts about a **run**, not about an address; the store is
  address-keyed and has no shape for them. Rejected: parking them in a comment at
  a convention address — an abuse of an address-keyed field that leaks into the
  exported ACME header.
  - **⚠ Planner must reconcile D-24 with D-27 rather than treat them as a
    contradiction.** The intended shape: the memory map is *generated*, and the
    provenance header is an **input to the renderer** (hand-authored or supplied
    by `c64-ram-capture`), not a hand-edited region of a generated file. Decide
    and document which, so nobody hand-edits a generated artifact.
  - `templates/memory-map.template.md` (62 lines) is the file this reshapes.
    `c64-ram-capture` already produces the capture hash and `RELEASES.json`
    alongside.

- **D-25 (user): confidence grades live as a machine-readable prefix inside r2000
  line comments** — e.g. a leading `[confirmed-code]` token.
  - **Measured:** line comments persist through save/reload
    (`user_line_comments` in the project file), and both `r2000_get_comments`
    and `r2000_search_disassembly` (which searches comments by default) can
    filter on them. So "show me everything still `[unknown]`" is a real query
    today with **no new storage**.
  - **Why a convention is needed at all:** r2000's block types
    (`code`/`byte`/`word`/`address`/`petscii`/`screencode`/split tables/
    `undefined`) carry classification but **no confidence axis** — `Code` cannot
    distinguish "PC observed executing" from "reachable via a JSR, never run".
    That distinction is the memory-map template's most deliberate feature, and
    its own text forbids promoting a row by editing its grade.
  - Rejected: a sidecar JSON keyed by address — a second store to keep in sync
    with the first, i.e. the drift class this criterion exists to close, and not
    queryable through the same tools.
  - **Pinned by a test**: a typo in the prefix must fail, not silently degrade
    into an ungraded comment.
  - The vocabulary to carry forward is the template's own: `confirmed code`,
    `probable code`, `confirmed data`, `probable data`, `unknown`.

- **D-26 (user): criterion 1 is demonstrated by a recorded two-session
  transcript on one real program.** Session A analyses and writes the store;
  session B, with no access to A's prose, answers a specific question purely
  from `r2000_*` queries.
  - This is the project's evidence-over-assertion posture, and Phase 8.1's
    precedent: running the one unwitnessed claim falsified it.
  - Paired with D-31's committed-fixture test so the query layer cannot rot —
    note Phase 10's **WR-02** is a live example of a construction test that went
    vacuous unnoticed.

### The symbol round trip (`R2000-14`, `R2000-15`)

- **The trap, measured:** `--import_lbl` under `--headless` **discards**.
  `main.rs:800-806` imports into memory, then `if headless && !mcp_server {
  return Ok(()) }` with no save. Verified live: two names imported, then
  `--export_lbl` from disk returned only the pre-existing label. There is **no
  CLI-only route** for R2000-15.

- **D-28 (user): the inbound leg is `--import_lbl` *plus* `--mcp-server-stdio`
  *plus* `r2000_save_project`.**
  - **Measured working end to end:** launched with both flags,
    `r2000_get_symbols {kind: "user"}` showed all three names, `save_project`
    persisted, and a subsequent `--export_lbl` from disk returned all three.
  - Uses r2000's **own** VICE-label parser, so no third copy of the `al C:`
    format in this repo (we already have two: `stock-symbols.ts` and
    `acme.mjs`'s `curateLabels()`), and it satisfies `R2000-15`'s literal
    wording.

- **D-29 (user): the store is the merge point — regenerate the full `.lbl` and
  reload.** A live-discovered name goes into the store first; then the whole
  `.lbl` is re-exported and re-loaded.
  - Makes `vice_symbols_load`'s **replace** semantics (T-05-02-05, deliberate)
    correct rather than a limitation, leaves DERIV-04's settled single-table
    framing untouched, and keeps exactly one merge implementation — r2000's.
  - Rejected: a merge mode on `vice_symbols_load`. It reopens a v0.2.0 decision,
    and while D-07's constraint permits an added *optional* parameter, the
    **semantics** would diverge across backends for a tool advertised on both.

- **D-30 (user): the live half runs against stock, with the fork verified
  unregressed** under the standing `BACK-02` per-phase gate — not as a fresh
  criterion.
  - `stock-symbols.ts` is the implementation this repo owns and can test; the
    fork's symbol tools live inside the emulator process and were never ours.
  - Genuine unpatched stock `x64sc` is available on this host at
    `/usr/bin/x64sc` (the fork shadows it on `PATH`), so the live leg is
    provable here.

- **D-31 (user): committed fixture for CI, a real program for the walkthrough.**
  The automated test runs on every merge; the criterion-4 claim itself is
  recorded against a real program on the host, as Phase 8.2 did.
  - **Only one `.prg` is committed anywhere** in this repo:
    `.planning/phases/09-the-assumption-probe-go-no-go/evidence/fixture/probe-illegal.prg`.
    The real corpus is per-consuming-project via `releases.mjs` / `test-corpus.mjs`
    — deliberately, so tests are portable. The planner picks between reusing
    `probe-illegal.prg` and building a purpose-made small `.prg`.

- **D-35 (Claude's call, evidence-backed): correct `stock-symbols.ts`'s
  "STATED ASSUMPTION, NOT A VERIFIED FACT" note — `--export_lbl` compatibility
  is now verified.** That file's header says regenerator2000's `--export_lbl` is
  *expected* to emit `al C:xxxx .Name` but that `R2000-16(c)` had never been run,
  and forbids any doc claiming "regenerator2000-compatible" as verified. It has
  now been run: `--export_lbl` emitted `al C:0810 .init_screen`, which matches
  that file's own parser `/^al\s+C:[0-9a-f]+\s+\.(\S+)/i` exactly. Update the
  comment to a verified claim **scoped to 0.9.20 and this fixture** — do not
  widen it to "all inputs forever" (the same scoping caveat ROADMAP.md already
  applies to Phase 9's criterion 3(3) `pass`).
  - **Note for `R2000-14`:** `--export_lbl` exports **user-defined labels only**.
    Measured: the annotated project emitted **one** line; the auto-generated
    `a_D011` / `a_D020` / `e_FFD2` externals were **not** exported. Whatever
    criterion 4 claims flows out must be a user label, so the store must have
    been written to first — which is exactly why `DERIV-04` "had no producer".

### Scope corrections this phase owes

- **D-34 (user): `.vsf` is explicitly out of Phase 11, and the roadmap wording is
  corrected.** Phase 10's **D-03** deferred `.vsf` to "Phase 11's
  `c64-ram-capture` extension, `R2000-14`/`R2000-15`" — but those two
  requirements are about **symbols**, not snapshots, so the deferral points at a
  home that does not exist.
  - No `R2000-*` requirement in this phase covers it; Phase 9 proved `.vsf`
    machine-type auto-detection unreliable; and the D-01 synthesis route never
    hands r2000 a container format at all.
  - **Fix all three sites:** ROADMAP.md § Phase 10 criterion 3's note, the
    milestone's standing "prefer `.vsf` over `.raw`" constraint, and Phase 10
    CONTEXT.md's deferred-ideas entry. Then file it as a backlog item with the
    real reason, rather than a dangling forward reference.

### Claude's Discretion

The user delegated these explicitly; they are recorded as decisions so the
planner does not re-litigate them:

- **D-32** — excluding `r2000_get_address_details`, plus filing upstream issue
  #42. ("you decide and create an issue in r2000 GitHub project")
- **D-35** — correcting `stock-symbols.ts`'s unverified-assumption note.

The planner additionally owns: the exact final tool-name list under D-18's rule,
the CLI verb names, and the file layout of the new modules (D-06 fixes the
directory, not the module split).

### Folded Todos

Both matched todos were folded in by the user.

1. **`.planning/todos/pending/2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md`**
   — `scripts/check-npm-packages.mjs:129` collects reachable modules with a
   **static-import-only** regex, while `vice-proxy.ts:218` reaches the r2000 seam
   via `await import("./r2000-cli.ts")`. None of the five existing r2000 modules
   are traversed. `files[]` is correct today and kept in sync **by hand**.
   **Why it belongs here:** this phase adds several more dynamically-imported
   r2000 modules, so the drift the todo warns about becomes materially more
   likely — and a miss ships a tarball that breaks at runtime on **both**
   npm-installer routes (which launch via `npx`). Fix options the todo names:
   widen the regex to `import\s*\(\s*"\.\/…"\)`, or add an explicit
   "these dynamic-import entry points must be in `files[]`" assertion.

2. **`.planning/todos/pending/2026-08-20-r2000-review-residual-findings.md`**
   — six open findings from `10-REVIEW.md`.
   - **WR-02 is the highest-value item and directly guards this phase's
     foundation:** `stripCommentLines()` swallows the whole file after any line
     starting with `/*` that does not end with `*/`, so the
     deny-by-construction guard test for **D-07** can go vacuous. The reviewer
     ran the helper verbatim against a synthetic source containing a rest-param
     pass-through and all three assertions still passed. D-16 keeps
     `r2000-launch.ts` the only spawn path, so this phase depends on that guard
     being real.
   - **WR-03** — the `evidence: "disasm"` deletion-pin exemption `continue`s
     past all three checks and is not count-bounded.
   - **WR-04** — `acmeVerdict()` uses `lines.find`, so `✓ ACME` followed by
     `✗ ACME` returns `ok: true`. Prefer last-match or explicit duplicate
     detection.
   - **WR-05/06/07** — `.d64` walker defects that contradict **D-02's** never-
     guess rule: `isInImage()` never checks `image.length` (a truncated image
     yielded 98 bytes where 254 were claimed, silently); NUL-padded directory
     names print in the listing then get rejected verbatim; a 4096-byte `.raw` is
     reparsed as a `.prg` with origin `$62c5`.
   - Verified **clean** by the same review and recorded so it is not re-derived:
     the `--vice` guard is complete against 0.9.20's real flag surface; all
     spawns are argv arrays with no `shell: true`; the host-path consumer set is
     still exactly five; Phase 4's `disasm-*` family is untouched; `files[]` is
     complete; and `r2000-verify.ts`'s no-exit-code-trust claim holds in both
     directions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` § Phase 11 — the four success criteria and their Notes,
  including the `DERIV-04` backward dependency and the Phase 9 criterion-3(3)
  `pass` that means no amendment lands here.
  **Criterion 3's "named bits" wording is reshaped by D-20** (r2000 has no
  bit-OR composition) — reconcile it.
- `.planning/ROADMAP.md` § Standing Constraints — applies to every phase.
  **The "prefer `.vsf` over `.raw`" constraint is corrected by D-34.**
- `.planning/ROADMAP.md` § Phase 10 criterion 3 Notes — **the `.vsf` deferral
  pointer is wrong and D-34 fixes it.**
- `.planning/REQUIREMENTS.md:82-104` — `R2000-10`, `R2000-11`, `R2000-13`
  (its `--dump-enum-files` claim is corrected by D-22), `R2000-14`, `R2000-15`.
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-CONTEXT.md`
  — **D-01 through D-15 are settled and must not be re-litigated.** Load-bearing
  for this phase: **D-06** (the seam's directory and why), **D-07** (`--vice`
  unreachable by construction *and* denied by scan), **D-05** (forced
  `use_illegal_opcodes` / explicit `system`), **D-15** (the documented facts,
  including the one-project-per-namespace limit that D-19 may retire). Its
  deferred-ideas section is where `--mcp-server-stdio` was flagged for this
  phase to evaluate — D-16 is that evaluation, and it chose stdio.
- `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/10-REVIEW.md`
  — WR-02..WR-07 with file:line and repro steps (folded todo 2).

### The Phase 9 gate and its accepted limits
- `docs/phase9-regenerator2000-probe-findings.md` — frontmatter `verdict`
  (`degrade`) / `verdict_rule_applied` (`R4`). § Accepted limits entry 2 (`.vsf`
  machine-type, feeds D-34), entry 3 (`--export_lbl` format `pass`, scoped to one
  fixture — D-35 extends it, with the same scoping caveat). § Other findings — the
  `handler.rs:1894` u16 defect this phase measured and filed as **D-32**, and the
  cross-connection snapshot gap.

### Project constraints
- `CLAUDE.md` § Constraints — the **single-client binary-monitor** constraint the
  whole milestone shape follows from; the `hostpath.ts` / `containerpath.ts` /
  `container-guard.mts` closed-consumer-set rule; the no-build-step rule for the
  shipped server; the `resources/*.mjs` committed-artifact rule.

### Code this phase extends
- `.claude/mcp/vice/r2000-launch.ts` — the ONE authoritative regenerator2000
  spawn point, with the fixed per-verb argv builders. **Every new r2000 process
  in this phase gets a new builder here**, never a bespoke `spawnSync`.
- `.claude/mcp/vice/r2000-cli.ts` — the `vice-mcp r2000 <verb>` entry point and
  the resolution reasoning behind it; reached from `vice-proxy.ts:218` by
  **dynamic** import (folded todo 1).
- `.claude/mcp/vice/r2000-project.ts` — `synthesizeProject()`, the ONE place a
  `.regen2000proj` is built. **Note:** minimality (D-04) applies at *birth*; a
  save through the MCP writes the full 25-key state back, measured.
- `.claude/mcp/vice/r2000-verify.ts`, `.claude/mcp/vice/r2000-d64.ts` — the other
  two Phase 10 modules, and the second `.d64` walker copy WR-05/06/07 concern.
- `.claude/mcp/vice/stock-symbols.ts` — `DERIV-04`'s symbol store. Its header
  carries the assumption D-35 corrects, the never-a-second-resolver-holder rule,
  the replace-not-merge rule (D-29), and the reason `hostpath.ts` is never
  imported.
- `.claude/mcp/vice/stock-dispatch.ts:679-680`, `.claude/mcp/vice/stock-derived.ts:107-108`
  — how a derived tool is registered and gated.
- `.claude/mcp/vice/vice.ts` — `DENY_LIST` / `denyListRefusalMessage()`, the
  smuggling-guard precedent **D-33** mirrors.
- `.claude/mcp/vice/hostpath-consumers.test.ts` — the closed consumer set
  (exactly five production members) and the per-module absence assertions. New
  r2000 modules join the "must be absent" side, as Phase 10's D-08 did.
- `scripts/check-npm-packages.mjs:129` — the static-import-only closure walk
  (folded todo 1).
- `.claude/skills/c64-program-recon/templates/memory-map.template.md` — the
  62-line prose artifact D-24/D-25/D-27 reshape, and the source of the confidence
  vocabulary.
- `.claude/skills/c64-program-recon/SKILL.md`, `scripts/derive.mjs` — the recon
  playbook and its pure register→address derivations.
- `.claude/skills/c64-memory-mapping/memmap.json` — 959 entries, **29** with a
  structured `bits` array, 282 with `reg`; the D-22 source.
- `.claude/skills/c64-memory-mapping/scripts/driver.mjs` — how memmap is built
  and queried today (`lookup()`, `annotate()`, `SRC_RANK`, the `io` parser that
  produced the 29 `bits` entries).
- `.claude/skills/c64-ram-capture/scripts/releases.mjs`, `test-corpus.mjs` — the
  portable-corpus registry D-31 depends on for the fixture/real-program split.

### regenerator2000 0.9.20 source, on disk
Verified present at
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`. Read the source, not
the web.
- `regenerator2000-core-0.9.20/src/state/types.rs:436-445` — `ImmediateFormat`
  (no enum variant; enums are a separate mechanism); `:461-465` — `CommentKind`
  (`Side` / `Line`, D-25); `:473-479` — **`EnumDefinition`, the flat
  `BTreeMap<u16, String>` that reshapes criterion 3**; `:481-525` —
  `parse_variants` (accepts decimal, `0x`/`$` hex, `0b`/`%` binary as *string*
  keys); `:527-556` — `RawEnumDefinition` and the TOML round trip; `:314-331` —
  `BlockType`'s twelve variants, **with no confidence axis** (D-25).
- `regenerator2000-core-0.9.20/src/assets.rs:378-404` (`load_builtin_enums`),
  `:406-443` (`load_global_enums`), `:445-468` (**`dump_enum_files` — dumps the
  three built-ins and exits; not an install path**, D-22), `:470-510`
  (`save_global_enum`, the machine-global write D-21 rejects), `:370-374`
  (`user_config_enums_dir`).
- `regenerator2000-core-0.9.20/assets/enums/` — the only three built-in enums:
  `enum-vic_ii_colors.toml`, `enum-vic_colors.toml`,
  `enum-petscii_shifted.toml`. All **value** enums; `VicIIColors` already covers
  `$D020`/`$D021`-style single-field registers, so D-20 need not regenerate it.
- `regenerator2000-core-0.9.20/src/state/app_state.rs:70-73` (`enums`,
  `user_global_enums`, `builtin_enums`), `:443` (`validate_new_enum_name`),
  `:464-468` (the `enum_usages` → three-tier resolution order).
- `regenerator2000-core-0.9.20/src/state/blocks.rs:555-583` — collects
  `used_enum_names` and emits each used enum's **whole** definition (the measured
  header-bloat behaviour that kills the 256-variant option).
- `regenerator2000-core-0.9.20/src/disassembler/formatter_acme.rs:58`,
  `:367-369` (`format_enum_reference` → `EnumName_VARIANT`), `:371-385`
  (`format_enum_definition` → `NAME_VARIANT = $xx` lines).
- `regenerator2000-core-0.9.20/src/mcp/handler.rs` — the 28-tool surface.
  `:350-352,1264-1271` — `r2000_save_project` takes **no arguments** and errors
  `-32603` when `project_path` is `None`; **there is no load/open tool**, so the
  path comes from the process launch (D-19). `:1892-1900` — **the
  `raw_data.len() as u16` OutOfRange defect** (D-32, issue #42).
  `:2037-2130` — the enum create/update command path.
- `regenerator2000-core-0.9.20/src/analyzer.rs:576,:588` and
  `src/exporter/html.rs:264` — the same `as u16` narrowing; `flow_analyze`
  survives by accident (D-32).
- `regenerator2000-0.9.20/src/main.rs:33-88` — the flag surface
  (`--import_lbl`, `--export_lbl`, `--export_asm`, `--assembler`, `--headless`,
  `--verify`, `--mcp-server`, `--mcp-server-stdio`, `--vice`, the three
  `--dump-*-files`). `:709-711` — `headless = cli.headless || cli.verify ||
  cli.mcp_server_stdio`, `mcp_server = cli.mcp_server || cli.mcp_server_stdio`.
  `:767-805` — **the ordered pipeline: load → import_lbl → export_lbl →
  assembler → export_asm → export_html → verify.** `:800-806` — **`if headless &&
  !mcp_server { return Ok(()) }`, the no-save path that makes `--import_lbl`
  discard** (D-28). `:267-299` — `import_labels` / `export_labels`. `:382-415` —
  `run_headless_mcp` (stdio vs HTTP-on-3000).

### Upstream
- <https://github.com/ricardoquesada/regenerator2000/issues/42> — the
  `get_address_details` 64K defect, filed from this discussion with the
  reproduction, the affected/unaffected tool table and a suggested fix. Watch it:
  a fix upstream is what would let D-32 be revisited.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`r2000-launch.ts`'s fixed argv builders** — the pattern every new r2000
  process in this phase extends. Adding a builder is the *only* sanctioned way to
  spawn a new verb; a bespoke `spawnSync` at a call site is the named
  anti-pattern.
- **`stock-derived.ts` / `stock-dispatch.ts` / `stock-handler.ts`'s derived-tool
  registration** — `withDerivedTool(name, {needsSession}, handler)` plus
  `derivedAnswer()` for every success. `DERIV-07`'s interception seam (Phase 4)
  is already the established route for a tool that must be handled *before*
  `forwardToVice()`. New `r2000_*` tools are derived tools by definition — they
  never touch the emulator.
- **`vice.ts`'s `DENY_LIST` + `denyListRefusalMessage()`** — the exact precedent
  D-33 mirrors, including its reason for existing: `tools_call` / `tools_list`
  could smuggle a forbidden name as a nested argument.
- **`stock-symbols.ts`'s VICE-label parser** (`/^al\s+C:[0-9a-f]+\s+\.(\S+)/i`),
  its path-escape refusals, and its `MAX_LABEL_FILE_BYTES` / `MAX_LABEL_FILE_LINES`
  / `MAX_SYMBOLS` ceilings — already the hardened reader for the `.lbl` files
  flowing out of the store (D-29's regenerate-and-reload).
- **`disasm-roundtrip.test.ts`'s availability gate** — `SKIP_REASON` at module
  scope, exactly one never-skipped availability test, `VICE_REQUIRE_ACME`
  turning absence into a hard FAIL. **D-11** already applied this to
  regenerator2000 (`VICE_REQUIRE_R2000`); this phase's live-r2000 tests inherit
  it rather than inventing a gate.
- **`driver.mjs`'s `lookup()` and `annotate()`** — already resolve an address
  against memmap and already emit per-bit prose into a disassembly comment. The
  enum generator's bit-name needs overlap with what `annotate()` already knows.

### Established Patterns
- **Single seam per concern.** Re-deriving a cross-cutting seam locally is a
  named `CLAUDE.md` anti-pattern. D-16/D-18/D-21/D-29 all follow from it — one
  MCP-client seam, one tool-gate, one enum home, one merge implementation.
- **Evidence over assertion.** Four times in v0.2.0 the external check found what
  the internal one could not, and Phase 8.1 *falsified* an unwitnessed claim.
  Every measured claim in this document was run, and D-26/D-31 keep that posture
  for the criteria themselves.
- **Never trust a misleading success.** `r2000-verify.ts` exists because a
  zero exit code and an "All roundtrip verifications passed" line were both
  lying. Applies directly to D-32: an `OutOfRange` that means "the length
  wrapped" is the same shape of lie.
- **Source header comments carry WHY, what NOT to do, and the dated incident
  that motivated the file.** New modules match that density.
- **No silent caps.** If coverage is bounded, log what was dropped — D-23's
  paired-vs-total count.
- **No build step for the shipped server**; host-bound `.mts` must be compiled to
  committed `resources/*.mjs` with `resources-sync.test.ts` failing CI on drift.
  The r2000 surface is container-side, so it should **not** need to become a
  `resources/` artifact — worth confirming, not assuming.

### Integration Points
- **`vice-proxy.ts:218`** — where the r2000 seam is reached, by **dynamic**
  import. This is both the integration point for the new tool surface and the
  reason folded todo 1 matters.
- **`vice-proxy.ts:1746`** — the argument-rewriting site that currently knows
  about `vice_display_screenshot.path` and `vice_symbols_load.path`. D-19 adds a
  path argument to every `r2000_*` tool; `CLAUDE.md`'s standing constraint is
  that **derived tools must be intercepted before `forwardToVice()`, not behind
  `call()`**, or they receive host-translated paths and act on them inside the
  container. This is the single most likely place for this phase to reintroduce
  `DERIV-07`'s bug.
- **The two-manifest split** — `tools-manifest.json` (fork, 62) and
  `tools-manifest.stock.json` (stock, 38). Per `D-07`, stock advertises only what
  it implements. A new `r2000_*` family is backend-independent (it never touches
  the emulator), so **which manifest(s) it lands in is a real decision** the
  planner must make explicitly, not by default.
- **CI test scope is narrower than it looks.** `ci.yml` runs `npm test` only
  inside `.claude/mcp/vice`; **no skill-side `*.test.mjs` runs in CI at all**.
  This is the load-bearing fact behind D-06, and it means the enum generator and
  the memory-map renderer belong on the MCP side if they are to be tested.
- **`check-skill-tool-coverage.mjs` and `check-skill-fork-honesty.mjs`** both run
  in CI over skill prose. Any new tool name mentioned in a SKILL.md, and any
  capability claim, is gated by them.
- **The installer duplicates the skills** (`installer/skills/`, synced by
  `installer/scripts/sync-skills.mjs`), and `check-npm-packages.mjs` validates
  both tarballs. Skill edits land on both sides.
- **One MCP connection per flow.** Phase 9 found `vice_memory_write` and
  `vice_snapshot_save` on separate connections produced a snapshot missing the
  written bytes. D-29's regenerate-and-reload loop must not split a poke-then-read
  sequence across connections.

</code_context>

<specifics>
## Specific Ideas

- **"You decide and create an issue in r2000 GitHub project"** — the user's own
  words on the 64K defect. Read as: do not paper over an upstream bug locally
  *and* do not leave it unreported. Issue #42 exists; D-32 is the local
  disposition. The same posture should apply to any further upstream defect this
  phase finds.
- **The user took every evidence-backed recommendation, in all four areas and
  both scope-correction questions.** Read as endorsement of the
  measure-then-decide method rather than of any individual option — the planner
  should keep running things against the real binary rather than reasoning from
  this document alone.
- **Criterion 3's own example, `lda #$1b / sta $d011`, is the acceptance
  target.** It is quoted in the requirement, the roadmap and here; the generated
  output must literally render that pair semantically. It was measured achievable
  (`lda #D011_YSCROLL3_ROW25_SCREENON_TEXT`).
- **Criterion 4's "one closed loop, not two independent one-way dumps"** is the
  phrase to design against. A passing `--export_lbl` test and a passing
  `--import_lbl` test do not satisfy it.

</specifics>

<deferred>
## Deferred Ideas

- **`.vsf` as a bootstrap input** — explicitly out of scope by **D-34**, which
  also fixes the three places that currently point at Phase 11 as its home. File
  as backlog with the real reason (no requirement covers it; Phase 9 found
  machine-type auto-detection unreliable; the synthesis route never hands r2000 a
  container format).
- **A fix for `r2000_get_address_details` upstream** — issue #42. If it lands,
  D-32 can be revisited and the tool added to the surface. Not this phase's work,
  and a PR was offered in the issue, not promised.
- **Enums as a reusable cross-project asset.** D-20 makes them program-specific
  and D-21 makes them project-local, so nothing is shared between projects. A
  shared library of register enums would need either r2000's global config dir
  (rejected for good reason) or an upstream mechanism for per-bit flag enums.
  Worth an upstream feature request eventually: **bitfield enums**, where a value
  renders as an OR of named bits. That single upstream feature would collapse
  D-20's whole problem.
- **`$D015`, `$D017`, `$D01A`, `$D01B`–`$D01D`** — the sprite bitmask registers
  absent from memmap's 29 structured entries. D-22's curated table is where they
  would land; widening memmap itself (fixing the `io` parser or the OCR damage)
  is separate work in `c64-memory-mapping`.
- **Non-ACME export formats** (`64tass`, `ca65`, `kick`) — r2000 supports all
  four and `format_enum_definition` is implemented per formatter, so enums would
  work there too. This project only cares about ACME (`!cpu 6510`). Not scope.
- **Two-project-limit detection** — permanently out by the `R2000-04` fold.
  Note that **D-19 plus stdio may make the limit itself moot**, since stdio binds
  no port; if so, D-15's documented limitation should be *narrowed*, not
  detected.
- **`r2000_undo` / `r2000_redo`** — unusable under D-17's per-call lifecycle.
  They only become meaningful if a future phase revisits the long-lived-child
  option. Undo of an annotation is instead a git revert of the project file
  (D-21's diffability).
- **`r2000_unpack_binary`, `r2000_read_region`, `r2000_search_memory`,
  `r2000_set_immediate_format`, `r2000_toggle_splitter`** — real tools, no
  criterion in this phase asks for them. `set_immediate_format`'s
  `low_byte`/`high_byte` modes are genuinely useful for pointer tables and are
  the strongest candidate for a later addition.
- **The v0.4.0-shaped todo `2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`**
  — not folded. Semver-major, and 24 fork-only tools each need a
  drop/reimplement/accept-loss decision.
- **`2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md`** — a
  repo-layout change that would touch every path in this document. Not folded;
  doing it mid-phase would invalidate the canonical refs above.

### Reviewed Todos (not folded)

`todo.match-phase 11` surfaced **15** matches, all at the same 0.6 keyword score
— the scorer is matching common words, not topic. Thirteen were noise against
this phase and remain pending and unchanged: stock-VICE fixture re-recording, the
`--help` backend discriminator, Phase 3's assumed wire details, broker-test
automatability, drive-type prerequisite docs, the keyboard-fallback load,
`project-paths.mjs`'s git-marker requirement, `RELEASES.json`'s schema,
`vice_ping`'s `resolvedBinaryPath`, warp-over-`RESOURCE_SET`, the CI test-command
reconciliation, the plugin-payload relocation, and the fork-backend removal.
Only the two folded above have real bearing.

</deferred>

---

*Phase: 11-Annotation Store, Enums, and the Symbol Round Trip*
*Context gathered: 2026-08-20*
